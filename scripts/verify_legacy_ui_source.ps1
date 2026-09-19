param([string]$Project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Project)
$manifest = Get-Content -LiteralPath (Join-Path $root 'docs/legacy-ui-source.json') -Raw | ConvertFrom-Json
if ($manifest.commit -ne 'd2a8ccf8067e031dddbbffc972eb1cb81ed77df5' -or $manifest.tag -ne 'v4.6.2.1') {
    throw 'Legacy UI reference identity changed'
}
function Resolve-ProjectFile([string]$relative) {
    $path = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (!$path.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path outside project: $relative"
    }
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing source: $relative" }
    return $path
}
function Assert-Hash([string]$relative, [string]$expected) {
    $path = Resolve-ProjectFile $relative
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Legacy source SHA-256 mismatch: $relative ($actual)" }
    return $path
}
foreach ($file in $manifest.snapshots) {
    $null = Assert-Hash $file.path $file.sha256
}
$legacyRoot = Join-Path $root 'app/src/main/java/com/linux/permissionmanager/ui/legacy'
$actualSources = @(Get-ChildItem -LiteralPath $legacyRoot -Filter '*.kt' -Recurse -File)
if ($actualSources.Count -ne $manifest.adapted.Count) { throw 'Unexpected Kotlin source in isolated legacy UI' }
foreach ($file in $manifest.adapted) {
    $path = Assert-Hash $file.path $file.sha256
    $source = Get-Content -LiteralPath $path -Raw
    if ($source -notmatch '(?m)^package com\.linux\.permissionmanager\.ui\.legacy(?:\.|\r?$)') {
        throw "Legacy source escaped its package: $($file.path)"
    }
    if ($source -match '(?m)^import\s+com\.linux\.permissionmanager\.ui\.(?:rhine|motion|scene|theme|components|screens)(?:\.|\r?$)') {
        throw "New UI import in legacy source: $($file.path)"
    }
    if ($source -match '\b(?:RhineIcons|RhineButton|TerminalPalette|TerminalTopBar|LocalTerminalAppearance|rememberTerminalMotionEnabled)\b') {
        throw "New UI component used in legacy source: $($file.path)"
    }
}
Write-Output "LEGACY_REFERENCE PASS COMMIT=$($manifest.commit) SNAPSHOTS=$($manifest.snapshots.Count)"
Write-Output "LEGACY_ADAPTATION PASS FILES=$($manifest.adapted.Count) NO_RHINE_OR_TERMINAL_IMPORTS=true"
exit 0
