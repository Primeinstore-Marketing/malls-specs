#!/usr/bin/env python3
"""
Loads the spec PDFs and After Effects templates from the "Updated Specs"
folder onto the live site, as downloads on each screen's spec page.

    python3 api/scripts/import-spec-files.py ["~/Desktop/Updated Specs"] [--dry-run]

Each file goes into the FILES KV namespace and gets a row in the `assets`
table, exactly as if an admin had uploaded it in the spec editor — so
admins can rename, replace or delete them there afterwards. Safe to
re-run: a screen that already has a download with the same filename is
skipped.

The FILES list below is the mapping. A few source files are misnamed in
the folder; they're given the right download name here (see the notes).
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone

API_DIR = pathlib.Path(__file__).resolve().parent.parent
NAMESPACE_ID = 'd94dcda5c0464234a9d1f060538ba2ed'  # malls-specs-files, see wrangler.jsonc
UPLOADED_BY = 'import-spec-files.py'

PDF = 'application/pdf'
AEP = 'application/vnd.adobe.aftereffects.project'

# (path inside the folder, spec id, download filename or None to keep it)
FILES = [
    ('Boardwalk.pdf', 'spec-boardwalk', None),
    # Misnamed in the folder: this PDF is the Bayside Digi Impact spec.
    ('Clearwater Mugg & Bean.pdf', 'spec-bayside-digi-impact', 'Bayside Digi Impact.pdf'),
    ('Golden Acre Impact .pdf', 'spec-golden-acre-impact', 'Golden Acre Impact.pdf'),
    ('Brooklyn Mall/Brooklyn Mall.pdf', 'spec-brooklyn-mall', None),
    ('Brooklyn Mall/Brooklyn Mall.aep', 'spec-brooklyn-mall', None),
    ('CRESTA/Cresta Mugg & Bean Impact/Cresta Mugg & Bean Impact.pdf', 'spec-cresta-mugg-bean-impact', None),
    ('CRESTA/Cresta Mugg & Bean Impact/Cresta Mugg & Bean Impact.aep', 'spec-cresta-mugg-bean-impact', None),
    ('CRESTA/Cresta Woolworth.pdf', 'spec-cresta-woolworth-screen', None),
    # Misnamed in the folder: this PDF is the Cresta Food Court spec.
    ('Clearwater Pick n Pay/Clearwater Food Court copy.pdf', 'spec-cresta-food-court', 'Cresta Food Court.pdf'),
    ('Canal Walk/Canal Walk - Food Court/Canal Walk - Food Court.pdf', 'spec-canal-walk-food-court', None),
    ('Canal Walk/Canal Walk - Food Court/Canal Walk - Food Court.aep', 'spec-canal-walk-food-court', None),
    # One spec covers both the left and right packages.
    ('Canal Walk/Canal Walk - Retail Left-Right Packages/Canal Walk - Retail Left-Right Packages.pdf', 'spec-canal-walk-retail-left-packages', None),
    ('Canal Walk/Canal Walk - Retail Left-Right Packages/Canal Walk - Retail Left-Right Packages.aep', 'spec-canal-walk-retail-left-packages', None),
    ('Canal Walk/Canal Walk - Retail Left-Right Packages/Canal Walk - Retail Left-Right Packages.pdf', 'spec-canal-walk-retail-right-packages', None),
    ('Canal Walk/Canal Walk - Retail Left-Right Packages/Canal Walk - Retail Left-Right Packages.aep', 'spec-canal-walk-retail-right-packages', None),
    # Its title inside reads "Canal Walk - Food Court", but the size (1980×1080) is Centre Court's.
    ('Canal Walk/Canal Walk -Centre Court.pdf', 'spec-canal-walk-centre-court', 'Canal Walk - Centre Court.pdf'),
    ('Canal Walk/Canal Walk Mall - Cube Court/Canal Walk Mall - Cube Court.pdf', 'spec-canal-walk-cube-court', None),
    ('Canal Walk/Canal Walk Mall - Cube Court/Canal Walk Mall - Cube Court.aep', 'spec-canal-walk-cube-court', None),
    ('Cape Gate/Cape Gate (Checkers)/Cape Gate (Checkers).pdf', 'spec-cape-gate-checkers', None),
    ('Cape Gate/Cape Gate (Checkers)/Cape Gate (Checkers).aep', 'spec-cape-gate-checkers', None),
    ('Cape Gate/Cape Gate (Clicks, Woolworths)/Cape Gate (Clicks, Woolworths).pdf', 'spec-cape-gate-clicks-woolworths', None),
    ('Cape Gate/Cape Gate (Clicks, Woolworths)/Cape Gate (Clicks, Woolworths).aep', 'spec-cape-gate-clicks-woolworths', None),
    ('Capegate Food Court/Capegate Food Court.pdf', 'spec-capegate-food-court', None),
    ('Capegate Food Court/Capegate Food Court.aep', 'spec-capegate-food-court', None),
    ('Clearwater Pick n Pay/Clearwater Food Court/Clearwater Food Court.pdf', 'spec-clearwater-food-court', None),
    ('Clearwater Pick n Pay/Clearwater Food Court/Clearwater Food Court.aep', 'spec-clearwater-food-court', None),
    ('Clearwater Pick n Pay/Clearwater Mugg & Bean/Clearwater Mugg & Bean.pdf', 'spec-clearwater-mugg-bean', None),
    ('Clearwater Pick n Pay/Clearwater Mugg & Bean/Clearwater Mugg & Bean.aep', 'spec-clearwater-mugg-bean', None),
    ('Clearwater Pick n Pay/Clearwater Pick n Pay/Clearwater Pick n Pay.pdf', 'spec-clearwater-pick-n-pay', None),
    ('Clearwater Pick n Pay/Clearwater Pick n Pay/Clearwater Pick n Pay.aep', 'spec-clearwater-pick-n-pay', None),
    ('Digi Engage/Digi Engage.pdf', 'spec-portrait-digital-engage', None),
    ('Digi Engage/Digi Engage.aep', 'spec-portrait-digital-engage', None),
    ('Fourways/Fourways Food Court.pdf', 'spec-fourways-food-court', None),
    # Its title inside reads "Fourways Food Court", but the size (1536×1088) is the Pillars'.
    ('Fourways/Fourways Pillars.pdf', 'spec-fourways-pillars', None),
    ('Fourways/Fourways promo court.pdf', 'spec-fourways-promo-court', 'Fourways Promo Court.pdf'),
    ('Gardens Digi Impact/Gardens Digi Impact.pdf', 'spec-gardens-digi-impact', None),
    ('Gardens Digi Impact/Gardens Digi Impact.aep', 'spec-gardens-digi-impact', None),
    ('Gateway Digi Impact/Gateway Digi Impact.pdf', 'spec-gateway-digi-impact', None),
    ('Gateway Digi Impact/Gateway Digi Impact.aep', 'spec-gateway-digi-impact', None),
    ('Landscape (Digital Icon - MTV)/Landscape (Digital Icon - MTV).pdf', 'spec-landscape-digital-icon-mtv', None),
    ('Landscape (Digital Icon - MTV)/Landscape (Digital Icon - MTV).aep', 'spec-landscape-digital-icon-mtv', None),
    ('Menlyn/Menlyn Aviary Court/Menlyn Aviary Court.pdf', 'spec-menlyn-aviary-court', None),
    ('Menlyn/Menlyn Aviary Court/Menlyn Aviary Court.aep', 'spec-menlyn-aviary-court', None),
    ('Monte Casino/Monte Casino Exit to Piazza/Monte Casino Exit to Piazza.pdf', 'spec-monte-casino-exit-to-piazza', None),
    ('Monte Casino/Monte Casino Exit to Piazza/Monte Casino Exit to Piazza.aep', 'spec-monte-casino-exit-to-piazza', None),
    ('Monte Casino/Monte Casino Fego/Monte Casino Fego.pdf', 'spec-monte-casino-fego', None),
    ('Monte Casino/Monte Casino Fego/Monte Casino Fego.aep', 'spec-monte-casino-fego', None),
    ('Monte Casino/Monte Casino Nikos/Monte Casino Nikos.pdf', 'spec-monte-casino-nikos', None),
    ('Monte Casino/Monte Casino Nikos/Monte Casino Nikos.aep', 'spec-monte-casino-nikos', None),
    ('Monte Casino/Monte Casino Piazza/Monte Casino Piazza.pdf', 'spec-monte-casino-piazza', None),
    ('Monte Casino/Monte Casino Piazza/Monte Casino Piazza.aep', 'spec-monte-casino-piazza', None),
    ('N1 City/N1 City.pdf', 'spec-n1-city', None),
    ('N1 City/N1 City.aep', 'spec-n1-city', None),
    ('Pavilion/Pavilion Food Court/Pavilion Food Court.pdf', 'spec-pavilion-food-court', None),
    ('Pavilion/Pavilion Food Court/Pavilion Food Court.aep', 'spec-pavilion-food-court', None),
    ('Pavilion/Pavilion Fountain Court/Pavilion Fountain Court.pdf', 'spec-pavilion-fountain-court', None),
    ('Pavilion/Pavilion Fountain Court/Pavilion Fountain Court.aep', 'spec-pavilion-fountain-court', None),
]


def safe_filename(name):
    """Mirrors safeFilename() in src/files.ts."""
    cleaned = re.sub(r'[^\w.\- ]+', '', name).strip()
    return re.sub(r'\s+', '-', cleaned)[:120] or 'file'


def wrangler(*args, capture=False):
    return subprocess.run(['npx', 'wrangler', *args], cwd=API_DIR, check=True, capture_output=capture, text=True)


def existing_downloads():
    result = wrangler('d1', 'execute', 'malls-specs', '--remote', '--json', '--command',
                      "SELECT spec_id, filename FROM assets WHERE role = 'download'", capture=True)
    rows = json.loads(result.stdout)[0]['results']
    return {(row['spec_id'], row['filename']) for row in rows}


def sql_quote(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def main():
    args = [arg for arg in sys.argv[1:] if arg != '--dry-run']
    dry_run = '--dry-run' in sys.argv
    folder = pathlib.Path(args[0] if args else '~/Desktop/Updated Specs').expanduser()

    have = existing_downloads()
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    rows = []
    for relative, spec_id, rename in FILES:
        source = folder / relative
        if not source.exists():
            print(f'  ! missing: {relative}')
            continue
        filename = safe_filename(rename or source.name)
        if (spec_id, filename) in have:
            print(f'  = already there: {spec_id} / {filename}')
            continue
        is_aep = source.suffix.lower() == '.aep'
        asset_id = f'asset-{uuid.uuid4()}'
        storage_key = f'{spec_id}/{asset_id[6:14]}-{filename}'
        mime = AEP if is_aep else PDF
        caption = 'After Effects template' if is_aep else 'Spec sheet (PDF)'
        print(f'  + {spec_id:42} {caption:22} {filename}')
        if not dry_run:
            wrangler('kv', 'key', 'put', storage_key, '--namespace-id', NAMESPACE_ID, '--remote',
                     '--path', str(source), '--metadata', json.dumps({'mimeType': mime, 'filename': filename}),
                     capture=True)
        rows.append('(' + ', '.join(sql_quote(v) for v in [
            asset_id, spec_id, 'download', 'other' if is_aep else 'document', filename, mime,
            source.stat().st_size, storage_key, '', caption, None, None, now, UPLOADED_BY,
        ]) + ')')

    if not rows:
        print('Nothing to add.')
        return
    if dry_run:
        print(f'Dry run: would add {len(rows)} files.')
        return
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as handle:
        handle.write(
            'INSERT INTO assets (id, spec_id, role, kind, filename, mime_type, size_bytes, storage_key, '
            'alt, caption, width, height, created_at, created_by) VALUES\n' + ',\n'.join(rows) + ';\n'
            f"INSERT INTO audit_log (admin, action, target, detail) VALUES ({sql_quote(UPLOADED_BY)}, "
            f"'file.import', 'Updated Specs', {sql_quote(json.dumps({'count': len(rows)}))});\n"
        )
        sql_path = handle.name
    wrangler('d1', 'execute', 'malls-specs', '--remote', '--file', sql_path, capture=True)
    pathlib.Path(sql_path).unlink()
    print(f'Added {len(rows)} files.')


if __name__ == '__main__':
    main()
