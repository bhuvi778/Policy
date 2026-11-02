param(
  [int]$VersionCode = 48,
  [string]$VersionName = '1.0.47',
  [string]$OutputDirectory = '',
  [string]$PythonCommand = 'python'
)
$ErrorActionPreference = 'Stop'
$releaseRoot = Split-Path $PSScriptRoot -Parent
if (!$OutputDirectory) { $OutputDirectory = Join-Path $releaseRoot "outputs\playstore-v$VersionCode" }
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools\36.0.0'
$apk = Join-Path $OutputDirectory "policybhandar-v$VersionCode-$VersionName-release.apk"
$aab = Join-Path $OutputDirectory "policybhandar-v$VersionCode-$VersionName-playstore.aab"
$expectedCertificate = 'de505ad21a3ac9990717be2be6afbc27fee55093c37242ff6da959317addf436'
$signature = & (Join-Path $sdk 'apksigner.bat') verify --verbose --print-certs $apk 2>&1
if ($LASTEXITCODE -ne 0 -or ($signature -join "`n") -notmatch $expectedCertificate) { throw 'APK signature or upload certificate mismatch.' }
$signature | Set-Content (Join-Path $OutputDirectory 'apk-signature.txt')
$alignment = & (Join-Path $sdk 'zipalign.exe') -c -P 16 -v 4 $apk 2>&1
if ($LASTEXITCODE -ne 0) { throw 'APK 16 KB ZIP alignment check failed.' }
$alignment | Set-Content (Join-Path $OutputDirectory 'apk-alignment.txt')
$manifest = & (Join-Path $sdk 'aapt.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or ($manifest -join "`n") -notmatch "name='com.policybhandar' versionCode='$VersionCode' versionName='$([regex]::Escape($VersionName))'") { throw 'Production package/version mismatch.' }
$manifest | Set-Content (Join-Path $OutputDirectory 'apk-manifest.txt')
$jar = & (Join-Path $env:JAVA_HOME 'bin\jarsigner.exe') -verify $aab 2>&1
if ($LASTEXITCODE -ne 0 -or ($jar -join "`n") -notmatch 'jar verified') { throw 'AAB signature verification failed.' }
$jar | Set-Content (Join-Path $OutputDirectory 'aab-signature.txt')
$certificate = & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -printcert -jarfile $aab 2>&1
if ($LASTEXITCODE -ne 0 -or (($certificate -join "`n").Replace(':','').ToLower() -notmatch $expectedCertificate)) { throw 'AAB upload certificate mismatch.' }
$certificate | Set-Content (Join-Path $OutputDirectory 'aab-certificate.txt')
$configPath = Join-Path $releaseRoot 'android\app\build\generated\source\buildConfig\release\com\policybhandar\BuildConfig.java'
$config = Get-Content -Raw -LiteralPath $configPath
if ($config -notmatch 'POLICYBHANDAR_DISTRIBUTION = "play"' -or $config -notmatch "VERSION_CODE = $VersionCode;") { throw 'This was not compiled as the intended Play distribution.' }
& $PythonCommand (Join-Path $PSScriptRoot 'verify-play-native.py') $aab (Join-Path $OutputDirectory 'native-alignment.json')
if ($LASTEXITCODE -ne 0) { throw 'Native ELF/ABI verification failed.' }
& $PythonCommand (Join-Path $PSScriptRoot 'verify-play-bundle.py') $aab $apk (Join-Path $OutputDirectory 'bundle-verification.json')
if ($LASTEXITCODE -ne 0) { throw 'APK/AAB JavaScript verification failed.' }
Push-Location $releaseRoot
try {
  & node scripts/verify-play-sources.cjs (Join-Path $OutputDirectory 'source-verification.json')
  if ($LASTEXITCODE -ne 0) { throw 'The release bundle does not match the current source.' }
} finally { Pop-Location }
$manifest | Select-String '^package:|^sdkVersion:|^targetSdkVersion:|^native-code:'
'Signatures, production identity, Play distribution, sources and 16 KB alignment passed.'
