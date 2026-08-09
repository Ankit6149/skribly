param(
  [string]$BundleRoot = 'apps/desktop/src-tauri/target/release/bundle',
  [string]$EvidencePath = 'artifacts/private-test/branding-evidence.json',
  [switch]$RunInstalledPayloadSmoke
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$configPath = 'apps/desktop/src-tauri/tauri.conf.json'
$iconPath = 'apps/desktop/src-tauri/icons/icon.ico'
$applicationPath = 'apps/desktop/src-tauri/target/release/skribly.exe'
$config = Get-Content $configPath -Raw | ConvertFrom-Json

if ($config.productName -ne 'Skribli') {
  throw "Unexpected product name '$($config.productName)'."
}
if ($config.mainBinaryName -ne 'skribly') {
  throw "The Tauri main binary must be explicitly pinned to 'skribly', got '$($config.mainBinaryName)'."
}
if ($config.bundle.windows.nsis.installerIcon -ne 'icons/icon.ico') {
  throw 'The NSIS installer is not explicitly bound to the Skribli icon.'
}
if ($config.bundle.windows.nsis.uninstallerIcon -ne 'icons/icon.ico') {
  throw 'The NSIS uninstaller is not explicitly bound to the Skribli icon.'
}

$nsisInstallers = @(Get-ChildItem -Path (Join-Path $BundleRoot 'nsis') -File -Filter *.exe)
$msiInstallers = @(Get-ChildItem -Path (Join-Path $BundleRoot 'msi') -File -Filter *.msi)
if ($nsisInstallers.Count -ne 1) {
  throw "Expected exactly one NSIS installer, found $($nsisInstallers.Count)."
}
if ($msiInstallers.Count -ne 1) {
  throw "Expected exactly one MSI installer, found $($msiInstallers.Count)."
}

$expectedPrefix = "$($config.productName)_$($config.version)_"
foreach ($installer in @($nsisInstallers + $msiInstallers)) {
  if (-not $installer.Name.StartsWith($expectedPrefix, [System.StringComparison]::Ordinal)) {
    throw "Installer '$($installer.Name)' does not carry the expected Skribli name/version prefix '$expectedPrefix'."
  }
  if ($installer.Name -match 'tauri') {
    throw "Installer '$($installer.Name)' exposes Tauri framework branding."
  }
}

$application = Get-Item $applicationPath
if ($application.VersionInfo.ProductName -ne $config.productName) {
  throw "Installed executable product name '$($application.VersionInfo.ProductName)' is not '$($config.productName)'."
}

function Test-InstalledNsisPayload {
  param(
    [Parameter(Mandatory = $true)] [System.IO.FileInfo]$Installer,
    [Parameter(Mandatory = $true)] [string]$ExpectedExecutableName
  )

  $temporaryRoot = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    [System.IO.Path]::GetTempPath()
  } else {
    $env:RUNNER_TEMP
  }
  $testRoot = Join-Path $temporaryRoot "skribli-nsis-smoke-$([guid]::NewGuid().ToString('N'))"
  $installDirectory = Join-Path $testRoot 'install'
  $installedApplication = Join-Path $installDirectory $ExpectedExecutableName
  $startMenuDirectory = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  $shortcutPaths = @()
  $preexistingShortcutPaths = @(Get-ChildItem -Path $startMenuDirectory -Filter 'Skribli*.lnk' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object FullName)
  $launchedProcess = $null

  New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
  try {
    $installerProcess = Start-Process -FilePath $Installer.FullName -ArgumentList @('/S', "/D=$installDirectory") -Wait -PassThru
    if ($installerProcess.ExitCode -ne 0) {
      throw "The NSIS smoke installation failed with exit code $($installerProcess.ExitCode)."
    }
    if (-not (Test-Path -LiteralPath $installedApplication -PathType Leaf)) {
      throw "The NSIS payload did not install the required application executable '$ExpectedExecutableName'."
    }

    $acceptanceBinary = Join-Path $installDirectory 'storage_acceptance.exe'
    if (Test-Path -LiteralPath $acceptanceBinary -PathType Leaf) {
      throw 'The NSIS payload installed storage_acceptance.exe, which is a test harness and must never be user-facing.'
    }

    $shell = New-Object -ComObject WScript.Shell
    $shortcutPaths = @(Get-ChildItem -Path $startMenuDirectory -Filter 'Skribli*.lnk' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notin $preexistingShortcutPaths })
    $shortcutTargets = @(
      $shortcutPaths | ForEach-Object {
        [System.IO.Path]::GetFullPath($shell.CreateShortcut($_.FullName).TargetPath)
      }
    )
    $expectedTarget = [System.IO.Path]::GetFullPath($installedApplication)
    if ($shortcutTargets -notcontains $expectedTarget) {
      throw "The Start menu shortcut does not point to the installed '$ExpectedExecutableName' payload."
    }

    $launchedProcess = Start-Process -FilePath $installedApplication -PassThru
    Start-Sleep -Seconds 5
    $launchedProcess.Refresh()
    if ($launchedProcess.HasExited) {
      throw "The installed Skribli executable exited during the five-second startup smoke test with exit code $($launchedProcess.ExitCode)."
    }

    [ordered]@{
      installed_executable = $ExpectedExecutableName
      startup_smoke_seconds = 5
      start_menu_target = $expectedTarget
    }
  } finally {
    if ($null -ne $launchedProcess) {
      $launchedProcess.Refresh()
      if (-not $launchedProcess.HasExited) {
        Stop-Process -Id $launchedProcess.Id -Force -ErrorAction SilentlyContinue
      }
    }
    foreach ($shortcut in $shortcutPaths) {
      Remove-Item -LiteralPath $shortcut.FullName -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $testRoot) {
      $resolvedRoot = (Resolve-Path -LiteralPath $testRoot).Path
      $resolvedTemporaryRoot = (Resolve-Path -LiteralPath $temporaryRoot).Path
      if ($resolvedRoot.StartsWith($resolvedTemporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
      }
    }
  }
}

$installedPayloadEvidence = if ($RunInstalledPayloadSmoke) {
  Test-InstalledNsisPayload -Installer $nsisInstallers[0] -ExpectedExecutableName "$($config.mainBinaryName).exe"
} else {
  [ordered]@{
    installed_executable = $null
    startup_smoke_seconds = 0
    start_menu_target = $null
  }
}

$nsisVersionInfo = $nsisInstallers[0].VersionInfo
foreach ($value in @($nsisVersionInfo.ProductName, $nsisVersionInfo.FileDescription, $nsisVersionInfo.OriginalFilename)) {
  if ($value -match 'tauri') {
    throw "The NSIS installer exposes Tauri framework branding in Windows version metadata: '$value'."
  }
}

Add-Type -AssemblyName System.Drawing

function Get-IconPixelHash {
  param([Parameter(Mandatory = $true)]$Icon)

  $bitmap = $Icon.ToBitmap()
  try {
    $bytes = [byte[]]::new($bitmap.Width * $bitmap.Height * 4)
    $cursor = 0
    for ($y = 0; $y -lt $bitmap.Height; $y += 1) {
      for ($x = 0; $x -lt $bitmap.Width; $x += 1) {
        $argb = $bitmap.GetPixel($x, $y).ToArgb()
        $bytes[$cursor] = ($argb -shr 24) -band 0xff
        $bytes[$cursor + 1] = ($argb -shr 16) -band 0xff
        $bytes[$cursor + 2] = ($argb -shr 8) -band 0xff
        $bytes[$cursor + 3] = $argb -band 0xff
        $cursor += 4
      }
    }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      return -join ($sha256.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
}

$canonicalIcon = [System.Drawing.Icon]::new((Resolve-Path $iconPath).Path, 32, 32)
$applicationIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($application.FullName)
$nsisIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($nsisInstallers[0].FullName)
try {
  if ($null -eq $applicationIcon) { throw 'The installed executable has no associated Windows icon.' }
  if ($null -eq $nsisIcon) { throw 'The NSIS installer has no associated Windows icon.' }

  $canonicalPixelHash = Get-IconPixelHash -Icon $canonicalIcon
  $applicationPixelHash = Get-IconPixelHash -Icon $applicationIcon
  $nsisPixelHash = Get-IconPixelHash -Icon $nsisIcon
  if ($applicationPixelHash -ne $canonicalPixelHash) {
    throw 'The installed executable icon does not match the canonical Skribli icon.'
  }
  if ($nsisPixelHash -ne $canonicalPixelHash) {
    throw 'The NSIS installer icon does not match the canonical Skribli icon.'
  }

  $evidenceDirectory = Split-Path -Parent $EvidencePath
  New-Item -ItemType Directory -Force -Path $evidenceDirectory | Out-Null
  [ordered]@{
    schema_version = 1
    product_name = $config.productName
    version = $config.version
    canonical_icon_path = $iconPath
    canonical_icon_sha256 = (Get-FileHash -Algorithm SHA256 -Path $iconPath).Hash.ToLowerInvariant()
    canonical_icon_pixel_sha256 = $canonicalPixelHash
    application_path = $application.FullName.Substring((Resolve-Path '.').Path.Length + 1).Replace('\', '/')
    application_product_name = $application.VersionInfo.ProductName
    application_icon_pixel_sha256 = $applicationPixelHash
    installed_executable = $installedPayloadEvidence.installed_executable
    startup_smoke_seconds = $installedPayloadEvidence.startup_smoke_seconds
    start_menu_target = $installedPayloadEvidence.start_menu_target
    nsis_installer = $nsisInstallers[0].Name
    nsis_product_name = $nsisVersionInfo.ProductName
    nsis_file_description = $nsisVersionInfo.FileDescription
    nsis_icon_pixel_sha256 = $nsisPixelHash
    msi_installer = $msiInstallers[0].Name
    tauri_branding_detected = $false
  } | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $EvidencePath
} finally {
  $canonicalIcon.Dispose()
  if ($null -ne $applicationIcon) { $applicationIcon.Dispose() }
  if ($null -ne $nsisIcon) { $nsisIcon.Dispose() }
}

Write-Host "Windows installer branding evidence: $EvidencePath"
