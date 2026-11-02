param(
  [ValidateRange(1,2100000000)][int]$VersionCode = 48,
  [ValidatePattern('^\d+\.\d+\.\d+$')][string]$VersionName = '1.0.47',
  [string]$OutputDirectory = ''
)
$ErrorActionPreference = 'Stop'
$releaseRoot = Split-Path $PSScriptRoot -Parent
if (!$OutputDirectory) { $OutputDirectory = Join-Path $releaseRoot "outputs\playstore-v$VersionCode" }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if (!$env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 17 before building.' }
foreach($setting in @('POLICYBHANDAR_STORE_FILE','POLICYBHANDAR_STORE_PASSWORD','POLICYBHANDAR_KEY_ALIAS','POLICYBHANDAR_KEY_PASSWORD')) {
  if (![Environment]::GetEnvironmentVariable($setting)) { throw "Missing release signing environment variable: $setting" }
}
$releaseProcess = [Diagnostics.ProcessStartInfo]::new()
$releaseProcess.FileName = Join-Path $env:JAVA_HOME 'bin\java.exe'
$releaseProcess.WorkingDirectory = Join-Path $releaseRoot 'android'
$releaseProcess.UseShellExecute = $false
$releaseProcess.CreateNoWindow = $true
$releaseProcess.RedirectStandardOutput = $true
$releaseProcess.RedirectStandardError = $true
foreach($argument in @('-Xmx64m','-Xms64m','-classpath',(Join-Path $releaseProcess.WorkingDirectory 'gradle\wrapper\gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','app:bundleRelease','app:assembleRelease',
  '-PPOLICYBHANDAR_DISTRIBUTION=play','-PPOLICYBHANDAR_APPLICATION_ID=com.policybhandar','-PPOLICYBHANDAR_QA_SIGNING=false',"-PPOLICYBHANDAR_VERSION_CODE=$VersionCode","-PPOLICYBHANDAR_VERSION_NAME=$VersionName",
  '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64','--max-workers=2','--no-parallel','--no-daemon','--no-problems-report','--console=plain')) {
  $releaseProcess.ArgumentList.Add($argument)
}
if (!$env:ANDROID_HOME) { $releaseProcess.Environment['ANDROID_HOME'] = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$releaseProcess.Environment['TEMP'] = 'C:\jtmp'
$releaseProcess.Environment['TMP'] = 'C:\jtmp'
$releaseStdout = [IO.File]::Open((Join-Path $OutputDirectory 'build.log'),[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite)
$releaseStderr = [IO.File]::Open((Join-Path $OutputDirectory 'build-errors.log'),[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite)
try {
  $process = [Diagnostics.Process]::Start($releaseProcess)
  "Signed Play build started (PID $($process.Id)). Logs: $OutputDirectory"
  $stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($releaseStdout)
  $stderrTask = $process.StandardError.BaseStream.CopyToAsync($releaseStderr)
  $process.WaitForExit()
  $null = $stdoutTask.GetAwaiter().GetResult()
  $null = $stderrTask.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) { throw 'Play release build failed. Inspect build.log and build-errors.log.' }
} finally { $releaseStdout.Dispose(); $releaseStderr.Dispose() }
$releaseOutputs = Join-Path $releaseRoot 'android\app\build\outputs'
$files = @{
  'bundle\release\app-release.aab' = "policybhandar-v$VersionCode-$VersionName-playstore.aab"
  'apk\release\app-release.apk' = "policybhandar-v$VersionCode-$VersionName-release.apk"
  'mapping\release\mapping.txt' = 'mapping.txt'
  'native-debug-symbols\release\native-debug-symbols.zip' = 'native-debug-symbols.zip'
}
foreach($source in $files.Keys) {
  $path = Join-Path $releaseOutputs $source
  if (!(Test-Path -LiteralPath $path)) { throw "Missing expected output: $source" }
  Copy-Item -LiteralPath $path -Destination (Join-Path $OutputDirectory $files[$source]) -Force
}
Get-FileHash -LiteralPath @($files.Values | ForEach-Object {Join-Path $OutputDirectory $_}) -Algorithm SHA256 |
  Select-Object @{n='file';e={Split-Path $_.Path -Leaf}},Hash | ConvertTo-Json | Set-Content (Join-Path $OutputDirectory 'artifact-hashes.json')
Get-Content (Join-Path $OutputDirectory 'build.log') -Tail 8
"Signed outputs copied: $OutputDirectory"
