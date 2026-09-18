param([string]$Project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$ErrorActionPreference = 'Stop'
$nativeDir = Join-Path $Project 'app/src/main/jniLibs/arm64-v8a'
foreach ($name in @('libmagica.so', 'libpermissionmanager.so')) {
    if (Test-Path -LiteralPath (Join-Path $nativeDir $name)) { throw "$name must be produced by CMake, not stored in jniLibs" }
}
$cmake = Get-Content -LiteralPath (Join-Path $Project 'app/src/main/cpp/CMakeLists.txt') -Raw
foreach ($target in @('add_library( # Sets the name of the library.', 'permissionmanager', 'add_library(magica SHARED')) {
    if (!$cmake.Contains($target)) { throw "CMake source target missing: $target" }
}
$build = Get-Content -LiteralPath (Join-Path $Project 'app/build.gradle') -Raw
if (!$build.Contains("path file('src/main/cpp/CMakeLists.txt')")) { throw 'Gradle externalNativeBuild is not enabled' }
$pins = @{
    'libresetprop.so' = '70558e6d6199fa5a961b7bafeb8f96d8157cc63810db8df2a3cded1881763697'
    'libcve2026_43499_ghostlock.so' = '7b2d158fad8af96082b3954d1ecb65e91e7a62d8cd475ba067698a0dfcd20778'
    'libkernel_module_kit_static.a' = 'd066b9a55ce5319552ec2f42bc3ae11d38f3f1f541220ee2e7de645b63b8a3aa'
}
foreach ($item in $pins.GetEnumerator()) {
    $path = if ($item.Key -like '*.a') { Join-Path $Project "testModule/kernel_module_kit/lib/$($item.Key)" } else { Join-Path $nativeDir $item.Key }
    $hash = (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()
    if ($hash -ne $item.Value) { throw "Hash mismatch: $($item.Key)" }
    Write-Output "$($item.Key) SHA256=$hash PASS"
}
$apk = Join-Path $Project 'app/build/outputs/apk/debug/app-debug.apk'
if (!(Test-Path -LiteralPath $apk)) { throw 'Debug APK not found; run :app:assembleDebug first' }
$zip = [IO.Compression.ZipFile]::OpenRead($apk)
try {
    foreach ($name in @('libmagica.so','libpermissionmanager.so','libresetprop.so','libcve2026_43499_ghostlock.so')) {
        if (!$zip.GetEntry("lib/arm64-v8a/$name")) { throw "APK missing native library: $name" }
    }
    $nativeEntries = @($zip.Entries | Where-Object { $_.FullName -like 'lib/arm64-v8a/*.so' })
    if ($nativeEntries.Name -contains 'libmagica.so' -and (Test-Path -LiteralPath (Join-Path $nativeDir 'libmagica.so'))) { throw 'Unexpected source library duplicate' }
    Write-Output "APK_NATIVE_ENTRIES PASS COUNT=$($nativeEntries.Count) SOURCE_BUILT=libmagica.so,libpermissionmanager.so"
} finally { $zip.Dispose() }
Write-Output 'SOURCE_NATIVE_LAYOUT PASS'
exit 0
