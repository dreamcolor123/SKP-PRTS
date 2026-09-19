#Requires -Version 7.0
param(
    [string]$Project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$Output
)
$ErrorActionPreference = 'Stop'
$base = '3d8cfe116ad728145fc91f43d4c22f3d65a70c52'
$root = [IO.Path]::GetFullPath($Project)
if (!$Output) { $Output = Join-Path $root '.tools/dual-ui-boundary.json' }
$report = [ordered]@{ baseCommit = $base; passed = $false; protected = @(); allowed = @(); violations = @() }
function Git-Read([string[]]$Arguments) {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = 'git'
    $start.WorkingDirectory = $root
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.CreateNoWindow = $true
    $start.ArgumentList.Add('-c')
    $start.ArgumentList.Add('core.quotepath=false')
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($start)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "git $($Arguments -join ' ') exited $($process.ExitCode): $stderr" }
    return $stdout
}
function Read-Current([string]$path) { return [IO.File]::ReadAllText((Join-Path $root $path)).Replace("`r`n", "`n") }
function Read-Baseline([string]$path) { return (Git-Read @('show', "${base}:$path")).Replace("`r`n", "`n") }
function Assert-EqualText([string]$path, [string]$actual, [string]$expected, [string]$allowedChange) {
    if ($actual -cne $expected) { throw "Undeclared change in $path" }
    $report.allowed += [ordered]@{ path = $path; allowedChange = $allowedChange; passed = $true }
}
try {
    $tracked = (Git-Read @('ls-tree', '-r', '--name-only', $base)).Split("`n", [StringSplitOptions]::RemoveEmptyEntries)
    $prefixes = @(
        'app/src/main/cpp/', 'app/src/main/jniLibs/', 'app/src/main/aidl/', 'testModule/',
        'app/src/main/java/com/linux/permissionmanager/bridge/',
        'app/src/main/java/com/linux/permissionmanager/helper/',
        'app/src/main/java/com/linux/permissionmanager/utils/',
        'app/src/main/java/com/linux/permissionmanager/customizer/'
    )
    $exact = @(
        'app/src/main/java/com/linux/permissionmanager/ui/AppViewModels.kt',
        'app/src/main/java/com/linux/permissionmanager/ui/LocalCustomizerViewModel.kt',
        'app/src/main/java/com/linux/permissionmanager/data/Models.kt',
        'app/src/main/java/com/linux/permissionmanager/PermissionManagerApplication.kt',
        'app/src/main/java/com/linux/permissionmanager/ModuleWebUiShortcutRouterActivity.kt',
        'app/src/main/java/com/linux/permissionmanager/ActivityResultId.java',
        'app/src/main/cpp/CMakeLists.txt', 'build.gradle', 'settings.gradle'
    )
    $protected = @($tracked | Where-Object { $path = $_; ($exact -contains $path) -or @($prefixes | Where-Object { $path.StartsWith($_) }).Count -gt 0 })
    foreach ($path in $protected) {
        $full = Join-Path $root $path
        if (!(Test-Path -LiteralPath $full -PathType Leaf)) { throw "Protected source missing: $path" }
        $expected = (Git-Read @('rev-parse', "${base}:$path")).Trim()
        $actual = (Git-Read @('hash-object', '--no-filters', '--', $path)).Trim()
        if ($actual -ne $expected) { throw "Protected source modified: $path" }
        $report.protected += [ordered]@{ path = $path; gitBlob = $actual }
    }
    foreach ($prefix in $prefixes) {
        foreach ($file in Get-ChildItem -LiteralPath (Join-Path $root $prefix) -File -Recurse) {
            $relative = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
            if ($tracked -notcontains $relative) { throw "Unrecorded file in protected source: $relative" }
        }
    }
    $path = 'app/src/main/java/com/linux/permissionmanager/data/Repositories.kt'
    $source = Read-Current $path
    $addition = "    val managerUi = ManagerUiStore()`n"
    if (($source.Split($addition).Count - 1) -ne 1) { throw 'Expected exactly one ManagerUiStore injection' }
    Assert-EqualText $path ($source.Replace($addition, '')) (Read-Baseline $path) 'Add AppContainer.managerUi only'

    $path = 'app/src/main/java/com/linux/permissionmanager/AppSettings.java'
    $source = Read-Current $path
    $addition = @'
    public static final String KEY_MANAGER_UI_MODE = "manager_ui_mode";
    public static final String KEY_MANAGER_UI_SELECTED = "manager_ui_selected";

    public static boolean saveManagerUiMode(String mode) {
        return preferences.edit().putString(KEY_MANAGER_UI_MODE, mode)
                .putBoolean(KEY_MANAGER_UI_SELECTED, true).commit();
    }
'@
    $addition = $addition.Replace("`r`n", "`n") + "`n"
    if (!$source.Contains($addition)) { throw 'UI persistence addition differs from the reviewed two keys and atomic commit' }
    Assert-EqualText $path ($source.Replace($addition, '')) (Read-Baseline $path) 'Two manager UI preference keys and atomic saveManagerUiMode only'

    $path = 'gradle.properties'
    $source = Read-Current $path
    Assert-EqualText $path $source ((Read-Baseline $path).Replace('SKROOT_UI_REVISION=1', 'SKROOT_UI_REVISION=2')) 'Only UI revision 1 to 2; core version unchanged'

    $path = 'app/build.gradle'
    $source = Read-Current $path
    $pattern = '(?s)\ntasks\.register\(''verifyLegacyUiSource''\) \{.*?\ntasks\.named\(''preBuild''\)\.configure \{ dependsOn ''verifyLegacyUiSource'' \}\n'
    $blocks = [regex]::Matches($source, $pattern)
    if ($blocks.Count -ne 1) { throw 'Expected one legacy source verification task and dependency' }
    if (!$blocks[0].Value.Contains('d2a8ccf8067e031dddbbffc972eb1cb81ed77df5') -or !$blocks[0].Value.Contains('entry.sha256')) {
        throw 'Legacy source verification must retain commit and hash checks'
    }
    Assert-EqualText $path ([regex]::Replace($source, $pattern, '')) (Read-Baseline $path) 'Only verifyLegacyUiSource task and preBuild dependency'
    $report.passed = $true
    Write-Output "DUAL_UI_BOUNDARY PASS PROTECTED=$($protected.Count) ALLOWED=$($report.allowed.Count) BASE=$base"
} catch {
    $report.violations += $_.Exception.Message
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
} finally {
    $destination = [IO.Path]::GetFullPath($Output)
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    [IO.File]::WriteAllText($destination, ($report | ConvertTo-Json -Depth 8) + "`n", (New-Object Text.UTF8Encoding($false)))
}
if (!$report.passed) { exit 1 }
exit 0
