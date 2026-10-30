import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

root = Path(__file__).resolve().parents[1]
sources = json.loads((root / 'model-sources.json').read_text(encoding='utf-8'))
destination = root / 'model-source'
destination.mkdir(exist_ok=True)
for kind in ['classifier', 'segmentation', 'detector']:
    entry = sources[kind]
    archive = destination / entry['archive']
    if not archive.exists():
        print('Downloading official Fishial ' + kind, flush=True)
        urllib.request.urlretrieve(entry['url'], archive)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest.lower() != entry['sha256'].lower():
        raise ValueError('Model checksum mismatch: ' + kind)
    target = destination / entry['directory']
    with zipfile.ZipFile(archive) as package:
        for item in package.infolist():
            resolved = (target / item.filename).resolve()
            if not resolved.is_relative_to(target.resolve()):
                raise ValueError('Unsafe archive path')
        package.extractall(target)
    print(kind + ' verified', flush=True)
