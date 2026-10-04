# Shared, side-effect-free candidate identity and preflight helpers.
function Get-CandidateFileIdentity {
    param([Parameter(Mandatory = $true)][string]$Path)
    $item = Get-Item -LiteralPath $Path -ErrorAction Stop
    if ($item.PSIsContainer) { throw 'Candidate identity requires a file.' }
    [pscustomobject]@{
        path = $item.FullName
        file_name = $item.Name
        bytes = $item.Length
        sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

function Resolve-RuntimeCandidateIdentity {
    param([Parameter(Mandatory = $true)]$Executable, [string]$ManifestPath = '')
    $result = [ordered]@{ status = 'unknown'; source_commit = 'unknown'; manifest_path = ''; manifest_sha256 = '' }
    if ([string]::IsNullOrWhiteSpace($ManifestPath)) { return [pscustomobject]$result }
    $manifestFile = Get-CandidateFileIdentity -Path $ManifestPath
    $manifest = Get-Content -LiteralPath $manifestFile.path -Raw | ConvertFrom-Json
    if ($manifest.schema_version -ne 1 -or $manifest.private_test_only -ne $true -or
        $manifest.source.commit_sha -notmatch '^[0-9a-f]{40}$' -or
        $manifest.application.sha256 -notmatch '^[0-9a-f]{64}$' -or
        $manifest.application.sha256 -ne $Executable.sha256 -or
        [long]$manifest.application.bytes -ne [long]$Executable.bytes) {
        throw 'Candidate manifest does not identify the measured application executable.'
    }
    $result.status = 'local-manifest-hash-match'
    $result.source_commit = $manifest.source.commit_sha
    $result.manifest_path = $manifestFile.path
    $result.manifest_sha256 = $manifestFile.sha256
    [pscustomobject]$result
}

function Assert-OwnerSourceIdentity {
    param([string]$RequestedCommit, [string]$CheckoutCommit, [string[]]$DirtyPaths)
    if ($RequestedCommit -cnotmatch '^[0-9a-f]{40}$' -or $CheckoutCommit -cnotmatch '^[0-9a-f]{40}$' -or
        $RequestedCommit -cne $CheckoutCommit) { throw 'The approved full source SHA must match the checked-out HEAD.' }
    if (@($DirtyPaths | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) {
        throw 'Owner builds require a clean tracked and untracked working tree.'
    }
}

function Assert-OwnerToolchain {
    param([string]$NodeVersion, [string]$NpmVersion, [string]$RequiredNodeVersion, [string]$RequiredNpmVersion)
    if ($NodeVersion.TrimStart('v') -ne $RequiredNodeVersion -or $NpmVersion -ne $RequiredNpmVersion) {
        throw "Owner build requires Node $RequiredNodeVersion and npm $RequiredNpmVersion; found $NodeVersion / $NpmVersion."
    }
}

function Assert-OwnerGateResult {
    param([string]$Name, [int]$ExitCode)
    if ($ExitCode -ne 0) { throw "Owner candidate gate '$Name' failed with exit code $ExitCode." }
}

function Write-NewCandidateJson {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    # CreateNew is an atomic no-overwrite boundary, including concurrent invocations.
    $json = $Value | ConvertTo-Json -Depth 12
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $writer = New-Object IO.StreamWriter($stream, (New-Object Text.UTF8Encoding($false)))
        try { $writer.Write($json); $writer.Flush(); $stream.Flush($true) } finally { $writer.Dispose() }
    } finally { $stream.Dispose() }
}
