param(
  [Parameter(Mandatory = $true)]
  [string]$BinaryPath,

  [Parameter(Mandatory = $true)]
  [string]$EvidencePath,

  [Parameter(Mandatory = $true)]
  [string]$CommitSha
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BinaryPath = (Resolve-Path $BinaryPath).Path
$EvidencePath = [System.IO.Path]::GetFullPath($EvidencePath)
$appDataRoot = Join-Path $env:APPDATA 'app.skribly.desktop'
$acceptanceRoot = Join-Path $appDataRoot (Join-Path 'storage-acceptance' $CommitSha)
$results = [System.Collections.Generic.List[object]]::new()

if (Test-Path $acceptanceRoot) {
  Remove-Item $acceptanceRoot -Recurse -Force
}
New-Item $acceptanceRoot -ItemType Directory -Force | Out-Null

function Add-Result {
  param(
    [string]$Name,
    [bool]$Passed,
    [object]$Details
  )

  $results.Add([ordered]@{
    name = $Name
    passed = $Passed
    details = $Details
  })
}

function New-HarnessProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [bool]$RedirectOutput = $true
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $BinaryPath
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $RedirectOutput
  $startInfo.RedirectStandardError = $RedirectOutput
  foreach ($argument in $Arguments) {
    [void]$startInfo.ArgumentList.Add($argument)
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw 'Failed to start storage acceptance binary.'
  }
  return $process
}

function Invoke-Harness {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$ExpectFailure
  )

  $process = New-HarnessProcess -Arguments $Arguments -RedirectOutput $true
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  $exitCode = $process.ExitCode
  $output = @()
  if ($stdout) {
    $output += $stdout.TrimEnd() -split "`r?`n"
  }
  if ($stderr) {
    $output += $stderr.TrimEnd() -split "`r?`n"
  }

  if ($ExpectFailure) {
    if ($exitCode -eq 0) {
      throw "Expected storage harness failure for '$($Arguments -join ' ')', but it succeeded. Output: $($output -join [Environment]::NewLine)"
    }
  }
  elseif ($exitCode -ne 0) {
    throw "Storage harness failed for '$($Arguments -join ' ')'. Output: $($output -join [Environment]::NewLine)"
  }

  return [ordered]@{
    exitCode = $exitCode
    output = $output
  }
}

function New-ScenarioPath {
  param([string]$Name)

  $directory = Join-Path $acceptanceRoot $Name
  New-Item $directory -ItemType Directory -Force | Out-Null
  return Join-Path $directory 'skribs.json'
}

function Seed-Scenario {
  param([string]$Path)
  Invoke-Harness -Arguments @('seed', $Path) | Out-Null
}

function Verify-Scenario {
  param(
    [string]$Path,
    [string]$ExpectedMarker,
    [bool]$ExpectedWritable
  )

  $result = Invoke-Harness -Arguments @(
    'verify',
    $Path,
    $ExpectedMarker,
    $ExpectedWritable.ToString().ToLowerInvariant()
  )
  $jsonLine = $result.output | Where-Object { $_.TrimStart().StartsWith('{') } | Select-Object -Last 1
  if (-not $jsonLine) {
    throw 'Verify command returned no JSON output.'
  }
  return $jsonLine | ConvertFrom-Json -Depth 20
}

function Wait-ForReadyMarker {
  param(
    [System.Diagnostics.Process]$Process,
    [string]$ReadyMarker,
    [string]$Description
  )

  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  while (-not (Test-Path $ReadyMarker)) {
    if ($Process.HasExited) {
      throw "$Description exited before reaching the ready marker with code $($Process.ExitCode)."
    }
    if ([DateTime]::UtcNow -gt $deadline) {
      if (-not $Process.HasExited) {
        $Process.Kill($true)
        $Process.WaitForExit()
      }
      throw "Timed out waiting for $Description."
    }
    Start-Sleep -Milliseconds 50
    $Process.Refresh()
  }
}

function Kill-HarnessProcess {
  param([System.Diagnostics.Process]$Process)

  if (-not $Process.HasExited) {
    $Process.Kill($true)
  }
  $Process.WaitForExit()
  return $Process.ExitCode
}

function Stop-AtStorageStage {
  param(
    [string]$Path,
    [string]$Stage,
    [string]$Marker,
    [int]$PayloadKiB = 8192
  )

  $ready = Join-Path ([System.IO.Path]::GetDirectoryName($Path)) "$Stage.ready.json"
  if (Test-Path $ready) {
    Remove-Item $ready -Force
  }

  $process = New-HarnessProcess -Arguments @(
    'interrupt',
    $Path,
    $Stage,
    $Marker,
    $PayloadKiB.ToString(),
    $ready
  ) -RedirectOutput $false

  Wait-ForReadyMarker -Process $process -ReadyMarker $ready -Description "interruption stage $Stage"
  $readyData = Get-Content $ready -Raw | ConvertFrom-Json
  $exitCode = Kill-HarnessProcess -Process $process

  return [ordered]@{
    stage = $Stage
    pid = $readyData.pid
    forcedExit = $true
    exitCode = $exitCode
    readyMarker = $ready
  }
}

function Stop-WithPartialTemporary {
  param(
    [string]$Path,
    [string]$Marker,
    [int]$PayloadKiB = 8192
  )

  $ready = Join-Path ([System.IO.Path]::GetDirectoryName($Path)) 'partial-temp.ready.json'
  if (Test-Path $ready) {
    Remove-Item $ready -Force
  }
  $process = New-HarnessProcess -Arguments @(
    'partial-temp',
    $Path,
    $Marker,
    $PayloadKiB.ToString(),
    $ready
  ) -RedirectOutput $false

  Wait-ForReadyMarker -Process $process -ReadyMarker $ready -Description 'partial-temporary fixture'
  $exitCode = Kill-HarnessProcess -Process $process
  return [ordered]@{
    forcedExit = $true
    exitCode = $exitCode
    readyMarker = $ready
  }
}

function Run-Scenario {
  param(
    [string]$Name,
    [scriptblock]$Body,
    [object[]]$ArgumentList = @()
  )

  try {
    $details = & $Body @ArgumentList
    Add-Result -Name $Name -Passed $true -Details $details
  }
  catch {
    Add-Result -Name $Name -Passed $false -Details ([ordered]@{
      error = $_.Exception.Message
      stack = $_.ScriptStackTrace
    })
  }
}

Run-Scenario -Name 'real-app-data-directory-semantics' -Body {
  $expectedPrefix = [System.IO.Path]::GetFullPath($appDataRoot).TrimEnd('\')
  $actual = [System.IO.Path]::GetFullPath($acceptanceRoot)
  if (-not $actual.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Acceptance path '$actual' is outside the Tauri app-data root '$expectedPrefix'."
  }
  [ordered]@{
    appDataRoot = $appDataRoot
    acceptanceRoot = $acceptanceRoot
    identifier = 'app.skribly.desktop'
  }
}

$forcedTerminationBody = {
  param([string]$Stage)
  $path = New-ScenarioPath "kill-$Stage"
  Seed-Scenario $path
  $marker = "recovered-$Stage"
  $termination = Stop-AtStorageStage -Path $path -Stage $Stage -Marker $marker
  $verification = Verify-Scenario -Path $path -ExpectedMarker $marker -ExpectedWritable $true
  [ordered]@{
    termination = $termination
    verification = $verification
  }
}

foreach ($stageValue in @('afterTemporarySync', 'afterBackupRotation', 'beforePrimaryReplace', 'afterPrimaryReplace')) {
  Run-Scenario `
    -Name "forced-process-termination-$stageValue" `
    -Body $forcedTerminationBody `
    -ArgumentList @($stageValue)
}

Run-Scenario -Name 'forced-process-termination-during-partial-temporary-write' -Body {
  $path = New-ScenarioPath 'partial-temporary'
  Seed-Scenario $path
  $termination = Stop-WithPartialTemporary -Path $path -Marker 'must-not-replace-durable-primary'
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'generation-3' -ExpectedWritable $true
  [ordered]@{
    termination = $termination
    verification = $verification
  }
}

Run-Scenario -Name 'primary-and-backup1-corrupt-recovers-backup2' -Body {
  $path = New-ScenarioPath 'backup2-recovery'
  Seed-Scenario $path
  Invoke-Harness -Arguments @('corrupt', $path, 'primary') | Out-Null
  Invoke-Harness -Arguments @('corrupt', $path, 'backup1') | Out-Null
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'generation-1' -ExpectedWritable $true
  [ordered]@{ verification = $verification }
}

Run-Scenario -Name 'corrupt-only-storage-fails-closed-across-restarts' -Body {
  $path = New-ScenarioPath 'corrupt-only'
  Invoke-Harness -Arguments @('corrupt', $path, 'primary') | Out-Null
  $first = Invoke-Harness -Arguments @('expect-load-failure', $path)
  $second = Invoke-Harness -Arguments @('expect-load-failure', $path)
  if (-not (Test-Path $path)) {
    throw 'Corrupt-only primary was removed instead of being preserved.'
  }
  [ordered]@{
    firstLaunch = $first
    secondLaunch = $second
    preserved = $true
  }
}

Run-Scenario -Name 'future-schema-is-preserved-and-blocks-downgrade-writes' -Body {
  $path = New-ScenarioPath 'future-schema'
  Seed-Scenario $path
  Invoke-Harness -Arguments @('future', $path, 'primary') | Out-Null
  $futureHashBefore = (Get-FileHash $path -Algorithm SHA256).Hash
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'generation-2' -ExpectedWritable $false
  $saveFailure = Invoke-Harness -Arguments @('save', $path, 'must-not-overwrite-future', '4') -ExpectFailure
  $futureHashAfter = (Get-FileHash $path -Algorithm SHA256).Hash
  if ($futureHashBefore -ne $futureHashAfter) {
    throw 'Unsupported future-schema primary changed after a blocked save.'
  }
  [ordered]@{
    verification = $verification
    saveFailure = $saveFailure
    futurePrimarySha256 = $futureHashAfter
  }
}

Run-Scenario -Name 'temporary-file-creation-denied-is-surfaced' -Body {
  $path = New-ScenarioPath 'temporary-denied'
  Seed-Scenario $path
  $directory = [System.IO.Path]::GetDirectoryName($path)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $originalAcl = Get-Acl $directory
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $identity,
    [System.Security.AccessControl.FileSystemRights]'CreateFiles,CreateDirectories',
    [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Deny
  )
  try {
    $restrictedAcl = Get-Acl $directory
    [void]$restrictedAcl.AddAccessRule($rule)
    Set-Acl -Path $directory -AclObject $restrictedAcl
    $failure = Invoke-Harness -Arguments @('save', $path, 'temporary-denied-attempt', '4') -ExpectFailure
  }
  finally {
    Set-Acl -Path $directory -AclObject $originalAcl
  }
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'generation-3' -ExpectedWritable $true
  [ordered]@{
    identity = $identity
    failure = $failure
    verification = $verification
  }
}

Run-Scenario -Name 'directory-permission-denial-is-surfaced' -Body {
  $path = New-ScenarioPath 'permission-denied'
  Seed-Scenario $path
  $directory = [System.IO.Path]::GetDirectoryName($path)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $originalAcl = Get-Acl $directory
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $identity,
    [System.Security.AccessControl.FileSystemRights]'Write,Delete,CreateFiles,CreateDirectories',
    [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Deny
  )
  try {
    $restrictedAcl = Get-Acl $directory
    [void]$restrictedAcl.AddAccessRule($rule)
    Set-Acl -Path $directory -AclObject $restrictedAcl
    $failure = Invoke-Harness -Arguments @('save', $path, 'permission-denied-attempt', '4') -ExpectFailure
  }
  finally {
    Set-Acl -Path $directory -AclObject $originalAcl
  }
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'generation-3' -ExpectedWritable $true
  [ordered]@{
    identity = $identity
    failure = $failure
    verification = $verification
  }
}

Run-Scenario -Name 'primary-replacement-lock-is-surfaced-and-recovers-temporary' -Body {
  $path = New-ScenarioPath 'primary-lock'
  Seed-Scenario $path
  $stream = [System.IO.File]::Open(
    $path,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    $failure = Invoke-Harness -Arguments @('save', $path, 'recovered-after-primary-lock', '4096') -ExpectFailure
  }
  finally {
    $stream.Dispose()
  }
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'recovered-after-primary-lock' -ExpectedWritable $true
  [ordered]@{
    failure = $failure
    verification = $verification
  }
}

Run-Scenario -Name 'backup-lock-is-surfaced-and-recovers-temporary' -Body {
  $path = New-ScenarioPath 'backup-lock'
  Seed-Scenario $path
  $backup1 = "$path.bak.1"
  $stream = [System.IO.File]::Open(
    $backup1,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    $failure = Invoke-Harness -Arguments @('save', $path, 'recovered-after-backup-lock', '4096') -ExpectFailure
  }
  finally {
    $stream.Dispose()
  }
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'recovered-after-backup-lock' -ExpectedWritable $true
  [ordered]@{
    failure = $failure
    verification = $verification
  }
}

Run-Scenario -Name 'read-only-primary-replacement-failure-is-surfaced' -Body {
  $path = New-ScenarioPath 'read-only-primary'
  Seed-Scenario $path
  (Get-Item $path).IsReadOnly = $true
  try {
    $failure = Invoke-Harness -Arguments @('save', $path, 'read-only-attempt', '4') -ExpectFailure
  }
  finally {
    (Get-Item $path).IsReadOnly = $false
  }
  $verification = Verify-Scenario -Path $path -ExpectedMarker 'read-only-attempt' -ExpectedWritable $true
  [ordered]@{
    failure = $failure
    verification = $verification
  }
}

Run-Scenario -Name 'metadata-only-diagnostics-exclude-note-content' -Body {
  $path = New-ScenarioPath 'diagnostics'
  Seed-Scenario $path
  Invoke-Harness -Arguments @('save', $path, 'private-diagnostic-marker', '4') | Out-Null
  $diagnosticResult = Invoke-Harness -Arguments @('diagnostics', $path)
  $jsonLine = $diagnosticResult.output | Where-Object { $_.TrimStart().StartsWith('{') } | Select-Object -Last 1
  $diagnosticOutput = ($jsonLine | ConvertFrom-Json).path
  $diagnosticText = Get-Content $diagnosticOutput -Raw
  if ($diagnosticText.Contains('private-diagnostic-marker') -or $diagnosticText.Contains('Skribli storage acceptance fixture')) {
    throw 'Storage diagnostics exposed note content or a target title.'
  }
  [ordered]@{
    diagnosticsPath = $diagnosticOutput
    diagnosticsSha256 = (Get-FileHash $diagnosticOutput -Algorithm SHA256).Hash
    contentFree = $true
  }
}

$binaryHash = (Get-FileHash $BinaryPath -Algorithm SHA256).Hash
$allPassed = -not ($results | Where-Object { -not $_.passed })
$evidence = [ordered]@{
  schemaVersion = 1
  generatedAtUtc = [DateTime]::UtcNow.ToString('o')
  commitSha = $CommitSha
  githubRunId = $env:GITHUB_RUN_ID
  githubRunAttempt = $env:GITHUB_RUN_ATTEMPT
  runnerName = $env:RUNNER_NAME
  runnerOs = $env:RUNNER_OS
  windowsVersion = [Environment]::OSVersion.VersionString
  powershellVersion = $PSVersionTable.PSVersion.ToString()
  buildMode = 'release'
  binaryPath = $BinaryPath
  binarySha256 = $binaryHash
  tauriIdentifier = 'app.skribly.desktop'
  appDataRoot = $appDataRoot
  acceptanceRoot = $acceptanceRoot
  scenarioCount = $results.Count
  allPassed = $allPassed
  scenarios = $results
  linkedFrontendFailureTest = 'apps/desktop/src/stores/storageFailureMessages.test.ts'
}

$evidenceDirectory = [System.IO.Path]::GetDirectoryName($EvidencePath)
New-Item $evidenceDirectory -ItemType Directory -Force | Out-Null
$evidence | ConvertTo-Json -Depth 30 | Set-Content $EvidencePath -Encoding UTF8

Write-Host "Storage acceptance evidence: $EvidencePath"
Write-Host "Scenarios: $($results.Count); all passed: $allPassed"

if (-not $allPassed) {
  $failed = $results | Where-Object { -not $_.passed }
  Write-Host 'Failed scenario details:'
  Write-Host ($failed | ConvertTo-Json -Depth 20)
  $failedNames = ($failed | ForEach-Object { $_.name }) -join ', '
  throw "Storage acceptance failed: $failedNames"
}
