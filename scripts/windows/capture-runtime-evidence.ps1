param(
    [string]$ProcessName = "skribly",
    [int]$ProcessId = 0,
    [string]$CandidateManifestPath = '',
    [int]$Samples = 60,
    [int]$IntervalSeconds = 10,
    [string]$OutputPath = "docs/07-validation/evidence/runtime-metrics.csv"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot 'candidate-provenance.ps1')

if ($Samples -lt 2) {
    throw "Samples must be at least 2."
}

if ($IntervalSeconds -lt 1) {
    throw "IntervalSeconds must be at least 1."
}

$matchingProcesses = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
if ($ProcessId -gt 0) {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
} elseif ($matchingProcesses.Count -gt 1) {
    throw "Multiple processes named '$ProcessName' are running. Specify -ProcessId to select the exact process."
} else { $process = $matchingProcesses | Select-Object -First 1 }
if (-not $process) {
    throw "Process '$ProcessName' is not running. Start Skribli before running this script."
}
$processStartUtc = $process.StartTime.ToUniversalTime().ToString('o')
$executable = Get-CandidateFileIdentity -Path $process.Path
$candidate = Resolve-RuntimeCandidateIdentity -Executable $executable -ManifestPath $CandidateManifestPath
if ($candidate.status -eq 'unknown') { Write-Warning 'Build source identity is unknown. Checkout HEAD will not be attributed to this executable.' }
if (Test-Path -LiteralPath $OutputPath) { throw 'Runtime evidence already exists. Choose a new OutputPath; evidence is not overwritten.' }

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$checkoutCommitSha = "unknown"
try {
    $checkoutCommitSha = (git -C (Join-Path $PSScriptRoot '../..') rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { $checkoutCommitSha = 'unknown' }
} catch {
    Write-Warning "Could not read the current Git commit SHA."
}

$computerInfo = Get-ComputerInfo
$scalePercent = "unknown"
try {
    $desktop = Get-ItemProperty "HKCU:\Control Panel\Desktop" -ErrorAction Stop
    if ($desktop.LogPixels) {
        $scalePercent = [math]::Round(($desktop.LogPixels / 96.0) * 100)
    }
} catch {
    Write-Warning "Could not read the current desktop scale from the registry."
}

Write-Host "Capturing Skribli runtime evidence"
Write-Host "Measured application source: $($candidate.source_commit) ($($candidate.status))"
Write-Host "Checkout HEAD (separate context): $checkoutCommitSha"
Write-Host "Executable: $($executable.path)"
Write-Host "Executable SHA-256: $($executable.sha256)"
Write-Host "Process ID: $($process.Id)"
Write-Host "Windows: $($computerInfo.WindowsProductName) $($computerInfo.WindowsVersion) build $($computerInfo.OsBuildNumber)"
Write-Host "Reported desktop scale: $scalePercent%"
Write-Host "Samples: $Samples every $IntervalSeconds second(s)"

$results = New-Object System.Collections.Generic.List[object]
$previousCpuSeconds = [double]$process.CPU
$previousTimestamp = Get-Date
$resultsStart = $previousTimestamp

for ($sample = 1; $sample -le $Samples; $sample++) {
    if ($sample -gt 1) {
        Start-Sleep -Seconds $IntervalSeconds
    }

    $current = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
    if (-not $current -or $current.StartTime.ToUniversalTime().ToString('o') -ne $processStartUtc -or $current.Path -ne $executable.path) {
        throw "Skribli exited before sample $sample."
    }

    $timestamp = Get-Date
    $elapsedSeconds = [math]::Max(($timestamp - $previousTimestamp).TotalSeconds, 0.001)
    $cpuDelta = [math]::Max(([double]$current.CPU - $previousCpuSeconds), 0)
    $cpuPercent = ($cpuDelta / $elapsedSeconds / [Environment]::ProcessorCount) * 100

    $row = [pscustomobject]@{
        TimestampUtc = $timestamp.ToUniversalTime().ToString("o")
        CheckoutCommitSha = $checkoutCommitSha
        MeasuredSourceCommitSha = $candidate.source_commit
        BuildIdentityStatus = $candidate.status
        ExecutablePath = $executable.path
        ExecutableSha256 = $executable.sha256
        ExecutableBytes = $executable.bytes
        ProcessStartUtc = $processStartUtc
        CandidateManifestPath = $candidate.manifest_path
        CandidateManifestSha256 = $candidate.manifest_sha256
        ProcessId = $current.Id
        CpuPercent = [math]::Round($cpuPercent, 3)
        WorkingSetMb = [math]::Round($current.WorkingSet64 / 1MB, 2)
        PrivateMemoryMb = [math]::Round($current.PrivateMemorySize64 / 1MB, 2)
        HandleCount = $current.HandleCount
        ThreadCount = $current.Threads.Count
        WindowsProduct = $computerInfo.WindowsProductName
        WindowsVersion = $computerInfo.WindowsVersion
        WindowsBuild = $computerInfo.OsBuildNumber
        DesktopScalePercent = $scalePercent
        ElapsedCaptureSeconds = [math]::Round(($timestamp - $resultsStart).TotalSeconds, 3)
        MeasurementScope = 'selected parent process only; excludes WebView child processes'
    }

    $results.Add($row)
    Write-Host ("[{0}/{1}] CPU {2}% | RAM {3} MB | Handles {4} | Threads {5}" -f `
        $sample,
        $Samples,
        $row.CpuPercent,
        $row.WorkingSetMb,
        $row.HandleCount,
        $row.ThreadCount)

    $previousCpuSeconds = [double]$current.CPU
    $previousTimestamp = $timestamp
}

$finalExecutable = Get-CandidateFileIdentity -Path $executable.path
if ($finalExecutable.sha256 -ne $executable.sha256) { throw 'Executable file changed during capture; evidence rejected.' }
# CreateNew prevents a second capture from replacing accepted evidence.
$csv = ($results | ConvertTo-Csv -NoTypeInformation) -join [Environment]::NewLine
$stream = [IO.File]::Open([IO.Path]::GetFullPath($OutputPath), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
    $writer = New-Object IO.StreamWriter($stream, (New-Object Text.UTF8Encoding($false)))
    try { $writer.Write($csv); $writer.Flush(); $stream.Flush($true) } finally { $writer.Dispose() }
} finally { $stream.Dispose() }

$first = $results[0]
$last = $results[$results.Count - 1]
$handleGrowth = $last.HandleCount - $first.HandleCount
$maxCpu = ($results | Measure-Object CpuPercent -Maximum).Maximum
$maxWorkingSet = ($results | Measure-Object WorkingSetMb -Maximum).Maximum

Write-Host ""
Write-Host "Evidence written to $OutputPath"
Write-Host "Handle growth: $handleGrowth"
Write-Host "Maximum sampled CPU: $maxCpu%"
Write-Host "Maximum working set: $maxWorkingSet MB"

if ($handleGrowth -gt 10) {
    Write-Warning "Handle count grew by more than 10. Investigate before accepting the Windows runtime gate."
}
