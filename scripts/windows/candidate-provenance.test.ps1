$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'candidate-provenance.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('skribli-provenance-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$testCount = 0
function Assert-Test { param([bool]$Condition, [string]$Message) if (-not $Condition) { throw $Message }; $script:testCount++ }
function Assert-Rejected { param([scriptblock]$Action, [string]$Message)
    $rejected = $false
    try { & $Action } catch { $rejected = $true }
    Assert-Test -Condition $rejected -Message $Message
}
try {
    $oldCommit = 'a' * 40
    $newCheckout = 'b' * 40
    $binaryPath = Join-Path $testRoot 'synthetic-app.bin'
    [IO.File]::WriteAllText($binaryPath, 'Synthetic fixture, never executable.')
    $binary = Get-CandidateFileIdentity -Path $binaryPath
    $manifest = [ordered]@{ schema_version = 1; private_test_only = $true; source = @{ commit_sha = $oldCommit }; application = @{ bytes = $binary.bytes; sha256 = $binary.sha256 } }
    $manifestPath = Join-Path $testRoot 'manifest.json'
    Write-NewCandidateJson -Path $manifestPath -Value $manifest
    $identity = Resolve-RuntimeCandidateIdentity -Executable $binary -ManifestPath $manifestPath
    Assert-Test ($identity.source_commit -eq $oldCommit -and $identity.source_commit -ne $newCheckout) 'An old binary inherited a newer checkout source.'
    Assert-Test ($identity.status -eq 'local-manifest-hash-match') 'Matching local manifest was not identified truthfully.'
    Assert-Test ((Resolve-RuntimeCandidateIdentity -Executable $binary).source_commit -eq 'unknown') 'Missing manifest must leave measured source unknown.'
    $originalHash = (Get-CandidateFileIdentity -Path $manifestPath).sha256
    Assert-Rejected { Write-NewCandidateJson -Path $manifestPath -Value @{ replaced = $true } } 'Existing manifest must not be overwritten.'
    Assert-Test ((Get-CandidateFileIdentity -Path $manifestPath).sha256 -eq $originalHash) 'Failed replacement mutated existing evidence.'
    [IO.File]::WriteAllText($binaryPath, 'Changed synthetic binary.')
    Assert-Rejected { Resolve-RuntimeCandidateIdentity -Executable (Get-CandidateFileIdentity -Path $binaryPath) -ManifestPath $manifestPath } 'Changed executable must not match old manifest.'
    $manifest.schema_version = 99
    $futurePath = Join-Path $testRoot 'future.json'
    Write-NewCandidateJson -Path $futurePath -Value $manifest
    Assert-Rejected { Resolve-RuntimeCandidateIdentity -Executable $binary -ManifestPath $futurePath } 'Unknown manifest version must be rejected.'
    Assert-Rejected { Assert-OwnerSourceIdentity -RequestedCommit $oldCommit -CheckoutCommit $newCheckout -DirtyPaths @() } 'Wrong checkout must reject the owner build.'
    Assert-Rejected { Assert-OwnerSourceIdentity -RequestedCommit 'main' -CheckoutCommit $oldCommit -DirtyPaths @() } 'Mutable branch name must reject the owner build.'
    Assert-Rejected { Assert-OwnerSourceIdentity -RequestedCommit $oldCommit -CheckoutCommit $oldCommit -DirtyPaths @(' M source.ts') } 'Dirty tracked source must reject the owner build.'
    Assert-Rejected { Assert-OwnerSourceIdentity -RequestedCommit $oldCommit -CheckoutCommit $oldCommit -DirtyPaths @('?? untracked.ts') } 'Untracked source must reject the owner build.'
    Assert-OwnerSourceIdentity -RequestedCommit $oldCommit -CheckoutCommit $oldCommit -DirtyPaths @()
    Assert-Rejected { Assert-OwnerToolchain -NodeVersion 'v22.18.0' -NpmVersion '11.6.1' -RequiredNodeVersion '22.23.1' -RequiredNpmVersion '10.9.8' } 'Unsupported local toolchain must reject the owner build.'
    Assert-OwnerToolchain -NodeVersion 'v22.23.1' -NpmVersion '10.9.8' -RequiredNodeVersion '22.23.1' -RequiredNpmVersion '10.9.8'
    Assert-Rejected { Assert-OwnerGateResult -Name 'synthetic-fault' -ExitCode 7 } 'Failed gate must prevent candidate creation.'
    Assert-OwnerGateResult -Name 'synthetic-success' -ExitCode 0

    foreach ($scriptName in @('capture-runtime-evidence.ps1', 'build-owner-installer.ps1', 'candidate-provenance.ps1')) {
        $parseErrors = $null; $tokens = $null
        [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $scriptName), [ref]$tokens, [ref]$parseErrors)
        Assert-Test ($parseErrors.Count -eq 0) "PowerShell parse errors in $scriptName"
    }
    $builder = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'build-owner-installer.ps1') -Raw
    Assert-Test ($builder.IndexOf("-Name 'locked-dependencies'") -lt $builder.IndexOf("-Name 'windows-bundles'")) 'Dependency gate must precede package build.'
    Assert-Test ($builder.IndexOf("-Name 'package-branding'") -lt $builder.IndexOf('Write-NewCandidateJson')) 'Package branding must precede manifest commit.'
    Assert-Test ($builder -notmatch 'Copy-Item.*-Force') 'Candidate copy cannot overwrite prior evidence.'
    $capture = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'capture-runtime-evidence.ps1') -Raw
    Assert-Test ($capture -notmatch '(?m)^\s*CommitSha\s*=') 'Capture must not attribute checkout HEAD as measured source.'
    Write-Host "$testCount synthetic provenance assertions passed. No installer, owner process, or signing operation was executed."
} finally {
    # Verify this fresh generated target stays inside TEMP before recursive cleanup.
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    $resolvedTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedTestRoot.StartsWith($resolvedTempRoot, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path $resolvedTestRoot -Leaf) -notlike 'skribli-provenance-test-*') { throw 'Synthetic cleanup escaped TEMP.' }
    Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}
