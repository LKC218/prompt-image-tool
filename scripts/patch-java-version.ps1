$javaVersion = "17"
$targetVersion = "21"

$files = @(
    "android\app\capacitor.build.gradle",
    "android\capacitor-cordova-android-plugins\build.gradle"
)

$nodeModulesFiles = Get-ChildItem "node_modules\@capacitor*\*\android\build.gradle" -ErrorAction SilentlyContinue
$nodeModulesFiles += Get-ChildItem "node_modules\@capacitor\android\capacitor\build.gradle" -ErrorAction SilentlyContinue

$allFiles = $files + ($nodeModulesFiles | Select-Object -ExpandProperty FullName)

foreach ($file in $allFiles) {
    if (Test-Path $file) {
        $content = [System.IO.File]::ReadAllText($file)
        $modified = $false

        if ($content -match "JavaVersion\.VERSION_$targetVersion") {
            $content = $content -replace "JavaVersion\.VERSION_$targetVersion", "JavaVersion.VERSION_$javaVersion"
            $modified = $true
        }
        if ($content -match "jvmToolchain\($targetVersion\)") {
            $content = $content -replace "jvmToolchain\($targetVersion\)", "jvmToolchain($javaVersion)"
            $modified = $true
        }

        if ($modified) {
            [System.IO.File]::WriteAllText($file, $content)
            Write-Output "Patched: $file"
        }
    }
}

Write-Output "Java version patch complete ($targetVersion -> $javaVersion)"
