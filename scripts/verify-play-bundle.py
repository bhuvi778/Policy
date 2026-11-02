import hashlib
import json
import sys
import zipfile
from pathlib import Path

aab, apk, report = map(Path, sys.argv[1:4])
generated = Path(__file__).resolve().parents[1] / 'android/app/build/generated/assets/react/release/index.android.bundle'
with zipfile.ZipFile(aab) as archive:
    aab_bundle = archive.read('base/assets/index.android.bundle')
    prefix = 'BUNDLE-METADATA/com.android.tools.build.debugsymbols/'
    symbol_names = {name[len(prefix):] for name in archive.namelist() if name.startswith(prefix) and not name.endswith('/')}
    with zipfile.ZipFile(report.parent / 'native-debug-symbols.zip') as symbols:
        zip_names = {name for name in symbols.namelist() if not name.endswith('/')}
        assert symbol_names and symbol_names == zip_names, 'Native symbols ZIP does not match AAB metadata'
        assert all(archive.read(prefix + name) == symbols.read(name) for name in symbol_names), 'Stale native symbols found'
with zipfile.ZipFile(apk) as archive:
    apk_bundle = archive.read('assets/index.android.bundle')
result = {
    'aabApkAndGeneratedBundleIdentical': aab_bundle == apk_bundle == generated.read_bytes(),
    'javascriptBytecodeSha256': hashlib.sha256(aab_bundle).hexdigest(),
    'matchingNativeSymbolFiles': len(symbol_names),
}
report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
print(json.dumps(result))
assert result['aabApkAndGeneratedBundleIdentical'], 'Stale JavaScript found in release artifacts'
