param(
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$config = Get-Content (Join-Path $repositoryRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$version = [string]$config.version
$publicKey = (Get-Content (Join-Path $repositoryRoot 'scripts/license/owner-alpha-public-key.txt') -Raw).Trim()
if ($publicKey -notmatch '^[A-Za-z0-9_-]{43}$') {
    throw 'The owner entitlement public key is missing or malformed.'
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path ([Environment]::GetFolderPath('Desktop')) "Skribli-v$version"
}

$env:SKRIBLY_TRIAL_ENFORCED = '1'
$env:SKRIBLY_LICENSE_PUBLIC_KEY = $publicKey
$env:VITE_SKRIBLY_ACCOUNT_URL = 'https://bccgutpkjxtogqbywsxr.supabase.co'
$env:VITE_SKRIBLY_ACCOUNT_PUBLISHABLE_KEY = 'sb_publishable_bjfNO80Oxx-gjuOAl8uXEA_YtdvCSHL'
$env:VITE_SKRIBLY_ACCOUNT_FUNCTION = 'account-session'
$env:VITE_SKRIBLY_APP_VERSION = $version

Push-Location $repositoryRoot
try {
    npm run tauri -- build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE." }
    $installer = Join-Path $repositoryRoot "apps/desktop/src-tauri/target/release/bundle/nsis/Skribli_${version}_x64-setup.exe"
    if (-not (Test-Path -LiteralPath $installer)) { throw "The installer was not produced: $installer" }
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    $destination = Join-Path $OutputDirectory (Split-Path $installer -Leaf)
    Copy-Item -LiteralPath $installer -Destination $destination -Force
    $hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    Write-Host "Owner installer: $destination"
    Write-Host "SHA-256: $hash"
} finally {
    Pop-Location
}
