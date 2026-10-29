#!/usr/bin/env python3
"""
Syncs the downloads on each screen's spec page with the "Updated Specs"
folder: the spec sheet PDF, After Effects template and Illustrator template.

    python3 api/scripts/sync-spec-files.py ["~/Desktop/Updated Specs"] [--dry-run]

For every file in the FOLDER list below, the live download of the same type
(PDF / AEP / AI) on that screen is compared byte for byte:
  - missing   -> uploaded
  - different -> the new version is uploaded and the old one removed
  - identical -> left alone
Pictures uploaded on the site, and anything not listed here, are never
touched. Run it whenever the folder changes; add new screens to FOLDER.

Files go to the FILES KV namespace and the `assets` table directly (the
same records the spec editor's uploads make), so admins can still rename,
replace or delete them on the site afterwards.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.request
import uuid
from datetime import datetime, timezone

API_DIR = pathlib.Path(__file__).resolve().parent.parent
API_URL = 'https://malls-specs-api.mosesm.workers.dev'
NAMESPACE_ID = 'd94dcda5c0464234a9d1f060538ba2ed'  # malls-specs-files, see wrangler.jsonc
UPLOADED_BY = 'sync-spec-files.py'

TYPES = {
    '.pdf': ('application/pdf', 'document', 'Spec sheet (PDF)'),
    '.aep': ('application/vnd.adobe.aftereffects.project', 'other', 'After Effects template'),
    '.ai': ('application/postscript', 'document', 'Illustrator template'),
}

# Folder inside "Updated Specs" -> the screen(s) its PDF / AEP / AI belong to.
# Each folder holds one spec: "<name>.pdf", "<name>.aep", "<name>.ai".
FOLDER = {
    'Bayside Digi Impact': ['spec-bayside-digi-impact'],
    'Boardwalk': ['spec-boardwalk'],
    'Brooklyn Mall': ['spec-brooklyn-mall'],
    'CRESTA/Cresta Mall - Food Court Digital Impact': ['spec-cresta-food-court'],
    'CRESTA/Cresta Mugg & Bean Impact': ['spec-cresta-mugg-bean-impact'],
    'CRESTA/Cresta Woolworth': ['spec-cresta-woolworth-screen'],
    'Canal Walk/Canal Walk - Centre Court': ['spec-canal-walk-centre-court'],
    'Canal Walk/Canal Walk - Food Court': ['spec-canal-walk-food-court'],
    # One spec covers both the left and right packages.
    'Canal Walk/Canal Walk - Retail Left-Right Packages': [
        'spec-canal-walk-retail-left-packages',
        'spec-canal-walk-retail-right-packages',
    ],
    'Canal Walk/Canal Walk Mall - Cube Court': ['spec-canal-walk-cube-court'],
    'Cape Gate/Cape Gate (Checkers)': ['spec-cape-gate-checkers'],
    'Cape Gate/Cape Gate (Clicks, Woolworths)': ['spec-cape-gate-clicks-woolworths'],
    'Capegate Food Court': ['spec-capegate-food-court'],
    'Clearwater Pick n Pay/Clearwater Food Court': ['spec-clearwater-food-court'],
    'Clearwater Pick n Pay/Clearwater Mugg & Bean': ['spec-clearwater-mugg-bean'],
    'Clearwater Pick n Pay/Clearwater Pick n Pay': ['spec-clearwater-pick-n-pay'],
    'Digi Engage': ['spec-portrait-digital-engage'],
    'Digi Impact': ['spec-digi-impact'],
    'Fourways/Fourways Food Court': ['spec-fourways-food-court'],
    'Fourways/Fourways Pillars': ['spec-fourways-pillars'],
    'Fourways/Fourways promo court': ['spec-fourways-promo-court'],
    'Gardens Digi Impact': ['spec-gardens-digi-impact'],
    'Gateway Digi Impact': ['spec-gateway-digi-impact'],
    'Golden Acre Impact': ['spec-golden-acre-impact'],
    'Landscape (Digital Icon - MTV)': ['spec-landscape-digital-icon-mtv'],
    'Menlyn/Menlyn Aviary Court': ['spec-menlyn-aviary-court'],
    'Monte Casino/Monte Casino Exit to Piazza': ['spec-monte-casino-exit-to-piazza'],
    'Monte Casino/Monte Casino Fego': ['spec-monte-casino-fego'],
    'Monte Casino/Monte Casino Nikos': ['spec-monte-casino-nikos'],
    'Monte Casino/Monte Casino Piazza': ['spec-monte-casino-piazza'],
    'N1 City': ['spec-n1-city'],
    'Pavilion/Pavilion Food Court': ['spec-pavilion-food-court'],
    'Pavilion/Pavilion Fountain Court': ['spec-pavilion-fountain-court'],
    'Table Bay/Table Bay Centre Court': ['spec-table-bay-centre-court'],
    'Table Bay/Table Bay Checkers and Pick and Pay': ['spec-table-bay-checkers-pick-n-pay'],
    'Tyger Valley/Tygervalley Food Court ': ['spec-tygervalley-food-court'],
    'Tyger Valley/Tygervalley Foschini ': ['spec-tygervalley-foschini'],
}


def safe_filename(name):
    """Mirrors safeFilename() in src/files.ts."""
    cleaned = re.sub(r'[^\w.\- ]+', '', name).strip()
    return re.sub(r'\s+', '-', cleaned)[:120] or 'file'


def download_name(folder, ext):
    """A tidy download name from the folder name, e.g. 'Tygervalley Foschini.aep'."""
    return safe_filename(pathlib.PurePosixPath(folder.strip()).name.strip() + ext)


def wrangler(*args):
    return subprocess.run(['npx', 'wrangler', *args], cwd=API_DIR, check=True, capture_output=True, text=True)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def fetch(path, timeout=60):
    # Cloudflare turns away Python's default user agent.
    request = urllib.request.Request(f'{API_URL}{path}', headers={'User-Agent': UPLOADED_BY})
    return urllib.request.urlopen(request, timeout=timeout).read()


def live_downloads():
    data = json.loads(fetch('/data'))
    by_key = {}
    for asset in data.get('assets', []):
        if asset['role'] != 'download':
            continue
        ext = pathlib.PurePosixPath(asset['filename']).suffix.lower()
        by_key.setdefault((asset['specId'], ext), []).append(asset)
    return by_key


def live_bytes(asset):
    key = '/'.join(urllib.request.quote(part) for part in asset['storageKey'].split('/'))
    return fetch(f'/files/{key}', timeout=120)


def q(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def main():
    args = [arg for arg in sys.argv[1:] if arg != '--dry-run']
    dry_run = '--dry-run' in sys.argv
    root = pathlib.Path(args[0] if args else '~/Desktop/Updated Specs').expanduser()
    live = live_downloads()
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    sql, removed_keys = [], []
    counts = {'added': 0, 'replaced': 0, 'unchanged': 0}

    for folder, spec_ids in FOLDER.items():
        directory = root / folder
        if not directory.is_dir():
            print(f'  ! folder missing: {folder}')
            continue
        for path in sorted(directory.iterdir()):
            ext = path.suffix.lower()
            if ext not in TYPES or not path.is_file():
                continue
            mime, kind, caption = TYPES[ext]
            body = path.read_bytes()
            filename = download_name(folder, ext)
            for spec_id in spec_ids:
                existing = live.get((spec_id, ext), [])
                if any(asset['sizeBytes'] == len(body) and sha256(live_bytes(asset)) == sha256(body) for asset in existing):
                    counts['unchanged'] += 1
                    continue
                action = 'replaced' if existing else 'added'
                counts[action] += 1
                print(f'  {"~" if existing else "+"} {spec_id:40} {caption:23} {filename} ({len(body) // 1024} KB)')
                asset_id = f'asset-{uuid.uuid4()}'
                key = f'{spec_id}/{asset_id[6:14]}-{filename}'
                if not dry_run:
                    wrangler('kv', 'key', 'put', key, '--namespace-id', NAMESPACE_ID, '--remote', '--path', str(path),
                             '--metadata', json.dumps({'mimeType': mime, 'filename': filename}))
                sql.append(
                    'INSERT INTO assets (id, spec_id, role, kind, filename, mime_type, size_bytes, storage_key, alt, caption, '
                    'width, height, created_at, created_by) VALUES (' + ', '.join(q(v) for v in [
                        asset_id, spec_id, 'download', kind, filename, mime, len(body), key, '', caption, None, None,
                        now, UPLOADED_BY]) + ');'
                )
                for old in existing:
                    sql.append(f"DELETE FROM assets WHERE id = {q(old['id'])};")
                    removed_keys.append(old['storageKey'])

    print(f"{counts['added']} to add, {counts['replaced']} to replace, {counts['unchanged']} unchanged.")
    if dry_run or not sql:
        return
    sql.append(f"INSERT INTO audit_log (admin, action, target, detail) VALUES ({q(UPLOADED_BY)}, 'file.sync', "
               f"'Updated Specs', {q(json.dumps(counts))});")
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as handle:
        handle.write('\n'.join(sql) + '\n')
    wrangler('d1', 'execute', 'malls-specs', '--remote', '--file', handle.name)
    pathlib.Path(handle.name).unlink()
    # Old versions are removed from storage only after the database no longer points at them.
    for key in removed_keys:
        wrangler('kv', 'key', 'delete', key, '--namespace-id', NAMESPACE_ID, '--remote')
    print('Done.')


if __name__ == '__main__':
    main()
