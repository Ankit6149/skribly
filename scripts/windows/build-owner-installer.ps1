param(
    [Parameter(Mandatory = $true)][string]$SourceCommit,
    [Parameter(Mandatory = $true)][ValidateSet('BUILD_PRIVATE_OWNER_CANDIDATE')][string]$Acknowledgement,
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'candidate-provenance.ps1')
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

function Read-OwnerGitValue {
    param([string[]]$GitArguments)
    $result = & git -C $repositoryRoot @GitArguments
    if ($LASTEXITCODE -ne 0) { throw 'Could not resolve owner candidate source identity.' }
    $result
}
function Assert-OwnerCheckout {
    $head = [string](Read-OwnerGitValue -GitArguments @('rev-parse', 'HEAD'))
    $dirty = @(Read-OwnerGitValue -GitArguments @('status', '--porcelain', '--untracked-files=all'))
    Assert-OwnerSourceIdentity -RequestedCommit $SourceCommit -CheckoutCommit $head.Trim() -DirtyPaths $dirty
}
function Invoke-OwnerGate {
    param([string]$Name, [string]$Command, [string[]]$CommandArguments)
    Assert-OwnerCheckout
    $started = [DateTime]::UtcNow
    & $Command @CommandArguments
    $exitCode = $LASTEXITCODE
    Assert-OwnerGateResult -Name $Name -ExitCode $exitCode
    $gateResults.Add([pscustomobject]@{ name = $Name; command = $Command; arguments = $CommandArguments;
        exit_code = $exitCode; started_at_utc = $started.ToString('o'); finished_at_utc = [DateTime]::UtcNow.ToString('o') })
    Assert-OwnerCheckout
}
function Get-OwnerSigningState {
    param([string]$Path)
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    [ordered]@{ status = [string]$signature.Status;
        certificate_thumbprint = $(if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null }) }
}

Assert-OwnerCheckout
$requiredNode = (Get-Content -LiteralPath (Join-Path $repositoryRoot '.nvmrc') -Raw).Trim()
$requiredNpm = '10.9.8'
$nodeVersion = (& node --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Node is unavailable.' }
$npmVersion = (& npm.cmd --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'npm is unavailable.' }
Assert-OwnerToolchain -NodeVersion $nodeVersion -NpmVersion $npmVersion -RequiredNodeVersion $requiredNode -RequiredNpmVersion $requiredNpm
$rustVersion = (& rustc --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Rust is unavailable.' }
$cargoVersion = (& cargo --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cargo is unavailable.' }
$storageShell = Get-Command pwsh -ErrorAction Stop

# Ignored local Vite env files and arbitrary inherited build overrides are not approved source.
foreach ($directory in @($repositoryRoot, (Join-Path $repositoryRoot 'apps/desktop'))) {
    $localEnvironments = @(Get-ChildItem -LiteralPath $directory -Force -File | Where-Object { $_.Name -like '.env*' -and $_.Name -ne '.env.example' })
    if ($localEnvironments.Count -gt 0) { throw 'Remove local build environment overrides before producing a source-bound owner candidate.' }
}
$allowedBuildEnvironment = @('SKRIBLY_TRIAL_ENFORCED', 'SKRIBLY_LICENSE_PUBLIC_KEY', 'VITE_SKRIBLY_ACCOUNT_URL',
    'VITE_SKRIBLY_ACCOUNT_PUBLISHABLE_KEY', 'VITE_SKRIBLY_ACCOUNT_FUNCTION', 'VITE_SKRIBLY_APP_VERSION')
$unexpectedOverrides = @(Get-ChildItem Env: | Where-Object { $_.Name -match '^(VITE_|SKRIBLY_)' -and $_.Name -notin $allowedBuildEnvironment })
if ($unexpectedOverrides.Count -gt 0) { throw 'Unapproved VITE_/SKRIBLY_ build overrides are present.' }
if ($env:CARGO_TARGET_DIR -or $env:RUSTFLAGS -or $env:CARGO_ENCODED_RUSTFLAGS) { throw 'Custom Cargo target/flags are not supported by this source-bound owner builder.' }

$config = Get-Content (Join-Path $repositoryRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$version = [string]$config.version
$publicKey = (Get-Content (Join-Path $repositoryRoot 'scripts/license/owner-alpha-public-key.txt') -Raw).Trim()
if ($publicKey -notmatch '^[A-Za-z0-9_-]{43}$') {
    throw 'The owner entitlement public key is missing or malformed.'
}
$candidateId = "v$version-$($SourceCommit.Substring(0,12))-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))-$([guid]::NewGuid().ToString('N').Substring(0,8))"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path ([Environment]::GetFolderPath('Desktop')) "Skribli-owner-$candidateId"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw 'OutputDirectory already exists. Existing candidate evidence is never replaced.' }

$savedEnvironment = @{}
foreach ($name in $allowedBuildEnvironment) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$gateResults = New-Object 'System.Collections.Generic.List[object]'
$lockIdentity = Get-CandidateFileIdentity -Path (Join-Path $repositoryRoot 'package-lock.json')
Push-Location $repositoryRoot
try {
    $env:SKRIBLY_TRIAL_ENFORCED = '1'
    $env:SKRIBLY_LICENSE_PUBLIC_KEY = $publicKey
    $env:VITE_SKRIBLY_ACCOUNT_URL = 'https://bccgutpkjxtogqbywsxr.supabase.co'
    $env:VITE_SKRIBLY_ACCOUNT_PUBLISHABLE_KEY = 'sb_publishable_bjfNO80Oxx-gjuOAl8uXEA_YtdvCSHL'
    $env:VITE_SKRIBLY_ACCOUNT_FUNCTION = 'account-session'
    $env:VITE_SKRIBLY_APP_VERSION = $version
    Invoke-OwnerGate -Name 'locked-dependencies' -Command 'npm.cmd' -CommandArguments @('ci')
    foreach ($gate in @('governance:validate', 'product-truth:validate', 'site:validate', 'private-test-artifact:validate',
        'react-runtime:validate', 'desktop-theme:validate', 'compact-surface:validate', 'lint', 'typecheck', 'test', 'build')) {
        Invoke-OwnerGate -Name $gate -Command 'npm.cmd' -CommandArguments @('run', $gate)
    }
    Invoke-OwnerGate -Name 'native-format' -Command 'cargo' -CommandArguments @('fmt', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', '--check')
    $env:SKRIBLY_TRIAL_ENFORCED = '0'
    Invoke-OwnerGate -Name 'native-tests' -Command 'cargo' -CommandArguments @('test', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', '--', '--test-threads=1')
    Invoke-OwnerGate -Name 'release-storage-build' -Command 'cargo' -CommandArguments @('build', '--release', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', '--features', 'storage-acceptance', '--bin', 'storage_acceptance')
    $storageEvidence = Join-Path $repositoryRoot "artifacts/owner-candidates/$candidateId/storage-acceptance-evidence.json"
    $storageAppData = Join-Path $repositoryRoot "artifacts/owner-candidates/$candidateId/synthetic-app-data"
    New-Item -ItemType Directory -Path $storageAppData -ErrorAction Stop | Out-Null
    $savedAppData = $env:APPDATA
    try {
        $env:APPDATA = $storageAppData
        Invoke-OwnerGate -Name 'release-storage-matrix' -Command $storageShell.Source -CommandArguments @('-NoProfile', '-File', 'scripts/validation/storage-acceptance.ps1', '-BinaryPath', 'apps/desktop/src-tauri/target/release/storage_acceptance.exe', '-EvidencePath', $storageEvidence, '-CommitSha', $SourceCommit)
    } finally {
        $env:APPDATA = $savedAppData
    }
    $env:SKRIBLY_TRIAL_ENFORCED = '1'
    Invoke-OwnerGate -Name 'trial-enforced-check' -Command 'cargo' -CommandArguments @('check', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml')
    Invoke-OwnerGate -Name 'owner-provenance-regressions' -Command 'powershell.exe' -CommandArguments @('-NoProfile', '-File', 'scripts/windows/candidate-provenance.test.ps1')
    Invoke-OwnerGate -Name 'windows-bundles' -Command 'npm.cmd' -CommandArguments @('run', 'tauri', '--', 'build', '--bundles', 'nsis,msi')
    # Validate only this candidate's bundles; keep older cached artifacts intact.
    $candidateBundleRoot = Join-Path $repositoryRoot "artifacts/owner-candidates/$candidateId/bundles"
    $candidateNsisDirectory = Join-Path $candidateBundleRoot 'nsis'
    $candidateMsiDirectory = Join-Path $candidateBundleRoot 'msi'
    New-Item -ItemType Directory -Path $candidateNsisDirectory, $candidateMsiDirectory -ErrorAction Stop | Out-Null
    $currentNsisPath = Join-Path $repositoryRoot "apps/desktop/src-tauri/target/release/bundle/nsis/Skribli_${version}_x64-setup.exe"
    $currentMsiFiles = @(Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'apps/desktop/src-tauri/target/release/bundle/msi') -File | Where-Object { $_.Name -like "Skribli_${version}_*.msi" })
    if ($currentMsiFiles.Count -ne 1) { throw 'Expected one current-version MSI candidate.' }
    Copy-Item -LiteralPath $currentNsisPath -Destination $candidateNsisDirectory -ErrorAction Stop
    Copy-Item -LiteralPath $currentMsiFiles[0].FullName -Destination $candidateMsiDirectory -ErrorAction Stop
    $brandingEvidence = Join-Path $repositoryRoot "artifacts/owner-candidates/$candidateId/branding-evidence.json"
    Invoke-OwnerGate -Name 'package-branding' -Command 'powershell.exe' -CommandArguments @('-NoProfile', '-File', 'scripts/validation/verify-windows-installer-branding.ps1', '-BundleRoot', $candidateBundleRoot, '-EvidencePath', $brandingEvidence)
    Assert-OwnerCheckout
    if ((Get-CandidateFileIdentity -Path $lockIdentity.path).sha256 -ne $lockIdentity.sha256) { throw 'Dependency lock changed during candidate build.' }
    $application = Get-CandidateFileIdentity -Path (Join-Path $repositoryRoot 'apps/desktop/src-tauri/target/release/skribly.exe')
    $installer = Get-CandidateFileIdentity -Path (Join-Path $repositoryRoot "apps/desktop/src-tauri/target/release/bundle/nsis/Skribli_${version}_x64-setup.exe")
    $msi = Get-CandidateFileIdentity -Path $currentMsiFiles[0].FullName
    New-Item -ItemType Directory -Path $OutputDirectory -ErrorAction Stop | Out-Null
    foreach ($file in @($application, $installer, $msi)) {
        $destination = Join-Path $OutputDirectory $file.file_name
        [IO.File]::Copy($file.path, $destination, $false)
        if ((Get-CandidateFileIdentity -Path $destination).sha256 -ne $file.sha256) { throw 'Candidate copy hash mismatch.' }
    }
    [IO.File]::Copy($brandingEvidence, (Join-Path $OutputDirectory 'branding-evidence.json'), $false)
    [IO.File]::Copy($storageEvidence, (Join-Path $OutputDirectory 'storage-acceptance-evidence.json'), $false)
    $manifest = [ordered]@{
        schema_version = 1; candidate_id = $candidateId; private_test_only = $true; public_release_accepted = $false
        created_at_utc = [DateTime]::UtcNow.ToString('o'); version = $version; product_name = $config.productName
        source = [ordered]@{ commit_sha = $SourceCommit; tree_sha = [string](Read-OwnerGitValue -GitArguments @('rev-parse', 'HEAD^{tree}')); clean = $true; package_lock_sha256 = $lockIdentity.sha256 }
        toolchain = [ordered]@{ node = $nodeVersion; npm = $npmVersion; rustc = $rustVersion; cargo = $cargoVersion }
        gates = @($gateResults.ToArray())
        storage_acceptance = [ordered]@{ evidence_file = 'storage-acceptance-evidence.json'; sha256 = (Get-CandidateFileIdentity -Path $storageEvidence).sha256; synthetic_profile_only = $true }
        application = [ordered]@{ file_name = $application.file_name; bytes = $application.bytes; sha256 = $application.sha256; signing = (Get-OwnerSigningState -Path (Join-Path $OutputDirectory $application.file_name)) }
        installers = @(@($installer, $msi) | ForEach-Object { [ordered]@{ file_name = $_.file_name; bytes = $_.bytes; sha256 = $_.sha256; signing = (Get-OwnerSigningState -Path (Join-Path $OutputDirectory $_.file_name)) } })
        build_configuration = [ordered]@{ trial_enforced = $true; owner_public_key_sha256 = (Get-CandidateFileIdentity -Path (Join-Path $repositoryRoot 'scripts/license/owner-alpha-public-key.txt')).sha256; account_function = 'account-session' }
        remaining_acceptance = @('installed Windows owner runtime', 'install/upgrade/uninstall/data retention/rollback for these hashes', 'signing/trust review', 'owner-only distribution review', 'public release remains held')
    }
    Write-NewCandidateJson -Path (Join-Path $OutputDirectory 'manifest.json') -Value $manifest
    Write-Host "Private owner candidate: $OutputDirectory"
    Write-Host "Application SHA-256: $($application.sha256)"
    Write-Host "NSIS SHA-256: $($installer.sha256)"
    Write-Host 'This is build evidence only; installed Windows and public release acceptance remain pending.'
} finally {
    foreach ($name in $allowedBuildEnvironment) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    Pop-Location
}
