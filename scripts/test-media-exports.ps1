param([string]$DeviceSerial)
$ErrorActionPreference = 'Stop'
$mediaTestRoot = Split-Path $PSScriptRoot -Parent
$adbPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$qaApk = Join-Path $mediaTestRoot 'outputs\media-fix\policybhandar-v43-qa.apk'
$testApk = Join-Path $mediaTestRoot 'outputs\media-fix\policybhandar-v43-qa-tests.apk'
foreach ($file in @($adbPath, $qaApk, $testApk)) { if (!(Test-Path -LiteralPath $file)) { throw "Missing file: $file" } }
$devices = @(& $adbPath devices | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
if (!$DeviceSerial) {
  if ($devices.Count -ne 1) { throw 'Connect one phone with USB debugging enabled, or specify -DeviceSerial.' }
  $DeviceSerial = $devices[0]
}
if ($DeviceSerial -notin $devices) { throw 'The selected phone is not connected/authorized.' }
& $adbPath -s $DeviceSerial install -r $qaApk
if ($LASTEXITCODE -ne 0) { throw 'QA app installation failed.' }
& $adbPath -s $DeviceSerial install -r $testApk
if ($LASTEXITCODE -ne 0) { throw 'Test app installation failed.' }
$testOutput = & $adbPath -s $DeviceSerial shell am instrument -w -r com.policybhandar.qa.test/androidx.test.runner.AndroidJUnitRunner 2>&1
$testExitCode = $LASTEXITCODE
$testOutput | Tee-Object -FilePath (Join-Path $mediaTestRoot 'outputs\media-fix\device-tests.log')
if ($testExitCode -ne 0 -or ($testOutput -join "`n") -match 'FAILURES!!!|INSTRUMENTATION_FAILED|shortMsg=|Process crashed' -or ($testOutput -join "`n") -notmatch 'OK \(\d+ tests?\)') {
  throw 'Device tests did not pass. Inspect outputs/media-fix/device-tests.log.'
}
