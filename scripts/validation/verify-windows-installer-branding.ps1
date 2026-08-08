param(
  [string]$BundleRoot = 'apps/desktop/src-tauri/target/release/bundle',
  [string]$EvidencePath = 'artifacts/private-test/branding-evidence.json'
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
      return [Convert]::ToHexString($sha256.ComputeHash($bytes)).ToLowerInvariant()
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
