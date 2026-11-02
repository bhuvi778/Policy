"""Check native ABIs and 16 KB ELF load alignment in a Play AAB or APK."""
import json
import struct
import sys
import zipfile
from pathlib import Path

artifact = Path(sys.argv[1])
report_path = Path(sys.argv[2])
abis = set()
libraries = []
failures = []
with zipfile.ZipFile(artifact) as archive:
    for name in archive.namelist():
        parts = name.split('/')
        if not name.endswith('.so') or 'lib' not in parts:
            continue
        index = parts.index('lib')
        abi = parts[index + 1]
        abis.add(abi)
        if abi not in ('arm64-v8a', 'x86_64'):
            continue
        data = archive.read(name)
        if data[:6] != b'\x7fELF\x02\x01':
            failures.append({'file': name, 'error': 'Unexpected ELF format'})
            continue
        offset = struct.unpack_from('<Q', data, 32)[0]
        size, count = struct.unpack_from('<HH', data, 54)
        alignments = [struct.unpack_from('<Q', data, offset + n * size + 48)[0]
                      for n in range(count) if struct.unpack_from('<I', data, offset + n * size)[0] == 1]
        libraries.append({'file': name, 'alignments': alignments})
        if not alignments or any(value < 16384 for value in alignments):
            failures.append({'file': name, 'error': 'ELF load alignment below 16 KB', 'alignments': alignments})
required = {'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'}
if abis != required:
    failures.append({'error': 'Unexpected ABI coverage', 'actual': sorted(abis), 'expected': sorted(required)})
report = {'artifact': artifact.name, 'abis': sorted(abis), 'elf64LibrariesChecked': len(libraries), 'failures': failures, 'libraries': libraries}
report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
print(json.dumps({key: value for key, value in report.items() if key != 'libraries'}))
if failures:
    sys.exit(1)
