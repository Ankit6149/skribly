# Package an already compiled ARM64 private preview without Windows symlink privileges.
# Run the documented Tauri android:build first. This is a packaging fallback, not a compiler.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$NativeLibrary,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$NativeSha256,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$BuiltSourceCommit
)
$ErrorActionPreference = 'Stop'
if (-not $env:CARGO_TARGET_DIR -or -not $env:NDK_HOME) { throw 'CARGO_TARGET_DIR and NDK_HOME are required.' }
$expected = [IO.Path]::GetFullPath((Join-Path $env:CARGO_TARGET_DIR 'aarch64-linux-android/debug/libskribli_mobile_lib.so'))
$source = (Resolve-Path -LiteralPath $NativeLibrary).Path
if ($source -ne $expected) { throw 'Only the compiled ARM64 debug library from CARGO_TARGET_DIR is accepted.' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash -ne $NativeSha256) { throw 'Native library does not match the hash recorded after compilation.' }
Push-Location (Join-Path $PSScriptRoot '../..')
try {
    & git cat-file -e "$BuiltSourceCommit^{commit}"
    if ($LASTEXITCODE -ne 0) { throw 'Compiled source commit is not available.' }
    $runtimePaths = @('apps/android/src', 'apps/android/public', 'apps/android/index.html', 'apps/android/src-tauri/Cargo.toml', 'apps/android/src-tauri/Cargo.lock', 'apps/android/src-tauri/build.rs', 'apps/android/src-tauri/src', 'apps/android/src-tauri/tauri.conf.json', 'apps/android/src-tauri/capabilities', 'apps/android/package.json', 'apps/android/vite.config.ts', 'apps/android/tsconfig.json', 'apps/desktop/src-tauri/icons', 'packages', 'package.json', 'package-lock.json')
    & git diff --exit-code $BuiltSourceCommit -- @runtimePaths
    if ($LASTEXITCODE -ne 0) { throw 'Runtime/build inputs changed since compilation; rebuild before packaging.' }
    $untracked = & git ls-files --others --exclude-standard -- @runtimePaths
    if ($LASTEXITCODE -ne 0 -or $untracked) { throw 'Untracked runtime/build inputs must be committed and compiled before packaging.' }
} finally { Pop-Location }
$index = Join-Path $PSScriptRoot 'dist/index.html'
if (-not (Test-Path -LiteralPath $index) -or (Get-Item -LiteralPath $source).LastWriteTimeUtc -lt (Get-Item -LiteralPath $index).LastWriteTimeUtc) {
    throw 'Compile the native library after building the current frontend; stale native assets are not accepted.'
}
$project = Join-Path $PSScriptRoot 'src-tauri/gen/android'
$plugin = Get-Content -Raw -LiteralPath (Join-Path $project 'buildSrc/src/main/java/app/skribly/mobilepreview/kotlin/RustPlugin.kt')
if ($plugin -notmatch 'rustBuild\$targetArchCapitalized\$profileCapitalized' -or $plugin -notmatch 'merge\$targetArchCapitalized\$\{profileCapitalized\}JniLibFolders') {
    throw 'Generated Rust task contract changed; inspect before excluding a build task.'
}
$tools = Join-Path $env:NDK_HOME 'toolchains/llvm/prebuilt/windows-x86_64/bin'
$header = & (Join-Path $tools 'llvm-readelf.exe') -h $source
if ($LASTEXITCODE -ne 0 -or ($header -join "`n") -notmatch 'Machine:\s+AArch64') { throw 'Compiled library is not AArch64 ELF.' }
$dynamic = & (Join-Path $tools 'llvm-readelf.exe') -d $source
if ($LASTEXITCODE -ne 0 -or ($dynamic -join "`n") -match 'libc\+\+_shared.so') { throw 'Additional native runtime packaging requires review.' }
$config = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'src-tauri/tauri.conf.json') | ConvertFrom-Json
$properties = Get-Content -Raw -LiteralPath (Join-Path $project 'app/tauri.properties')
if ($properties -notmatch ('tauri.android.versionName=' + [regex]::Escape($config.version) + '(\r?\n|$)')) { throw 'Generated Android version does not match source configuration.' }
& node (Join-Path $PSScriptRoot 'prepare-android-build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Private manifest preparation failed.' }
$jni = Join-Path $project 'app/src/main/jniLibs/arm64-v8a'
New-Item -ItemType Directory -Force -Path $jni | Out-Null
$destination = Join-Path $jni 'libskribli_mobile_lib.so'
if ((Test-Path -LiteralPath $destination) -and ((Get-Item -LiteralPath $destination).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'JNI destination must be a regular generated file; review the existing link.'
}
Copy-Item -LiteralPath $source -Destination $destination
& (Join-Path $tools 'llvm-strip.exe') --strip-debug $destination
if ($LASTEXITCODE -ne 0) { throw 'Stripping the staged copy failed.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $source, $destination | Format-List
Push-Location $project
try {
    & ./gradlew.bat :app:assembleArm64Debug -x :app:rustBuildArm64Debug -PabiList=arm64-v8a -ParchList=arm64 -PtargetList=aarch64 --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Android Gradle packaging failed.' }
} finally { Pop-Location }
Write-Output 'Private debug APK assembled. Inspect the final APK and signer before distribution; device acceptance is still required.'
