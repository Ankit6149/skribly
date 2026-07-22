param(
    [string]$ProcessName = "skribly",
    [int]$Samples = 60,
    [int]$IntervalSeconds = 10,
    [string]$OutputPath = "docs/07-validation/evidence/runtime-metrics.csv"
)

$ErrorActionPreference = "Stop"

if ($Samples -lt 2) {
    throw "Samples must be at least 2."
}

if ($IntervalSeconds -lt 1) {
    throw "IntervalSeconds must be at least 1."
}

$process = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $process) {
    throw "Process '$ProcessName' is not running. Start Skribly before running this script."
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$commitSha = "unknown"
try {
    $commitSha = (git rev-parse HEAD).Trim()
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

Write-Host "Capturing Skribly runtime evidence"
Write-Host "Commit: $commitSha"
Write-Host "Process ID: $($process.Id)"
Write-Host "Windows: $($computerInfo.WindowsProductName) $($computerInfo.WindowsVersion) build $($computerInfo.OsBuildNumber)"
Write-Host "Reported desktop scale: $scalePercent%"
Write-Host "Samples: $Samples every $IntervalSeconds second(s)"

$results = New-Object System.Collections.Generic.List[object]
$previousCpuSeconds = [double]$process.CPU
$previousTimestamp = Get-Date

for ($sample = 1; $sample -le $Samples; $sample++) {
    if ($sample -gt 1) {
        Start-Sleep -Seconds $IntervalSeconds
    }

    $current = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
    if (-not $current) {
        throw "Skribly exited before sample $sample."
    }

    $timestamp = Get-Date
    $elapsedSeconds = [math]::Max(($timestamp - $previousTimestamp).TotalSeconds, 0.001)
    $cpuDelta = [math]::Max(([double]$current.CPU - $previousCpuSeconds), 0)
    $cpuPercent = ($cpuDelta / $elapsedSeconds / [Environment]::ProcessorCount) * 100

    $row = [pscustomobject]@{
        TimestampUtc = $timestamp.ToUniversalTime().ToString("o")
        CommitSha = $commitSha
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

$results | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8

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
