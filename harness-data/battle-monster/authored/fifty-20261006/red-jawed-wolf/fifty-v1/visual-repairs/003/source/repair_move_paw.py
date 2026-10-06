"""Apply three hand-chosen native row runs; no generated pose or shading.

Each run includes the explicitly chosen transparent pixels behind the wrist.
The delivered pxgrid remains a complete literal 64x64 ASCII canvas.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent
BACKUP = ROOT / 'history/before-move-paw-repair'
if not BACKUP.exists():
    BACKUP.mkdir(parents=True)
    files = (list((ROOT / 'poses').glob('*.pxgrid'))
             + list((ROOT / 'actions').glob('*.pxgrid'))
             + [ROOT / 'palette.json', ROOT / 'AUTHORING.md', ROOT / 'TIMING.md'])
    hashes = {}
    for path in files:
        relative = path.relative_to(ROOT)
        destination = BACKUP / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)
        hashes[str(relative)] = hashlib.sha256(path.read_bytes()).hexdigest()
    (BACKUP / 'sha256.json').write_text(json.dumps(hashes, indent=2) + '\n')

# x32..49 inclusive. Wrist/shoulder above y54 are untouched.
# y54: rounded rear edge at x39, top-left fur highlight, short right claw.
# y55: compact underside volume and two pale toe pixels at x47..48.
# y56: short sole x40..48, with no backward heel.
RUNS = (
    (32, 54, '.......KSBLHMBSWK.'),
    (32, 55, '.......KSBMMMSSWWK'),
    (32, 56, '........KKKKKKKKK.'),
)
path = ROOT / 'poses/move.pxgrid'
rows = path.read_text().splitlines()
for x, y, pixels in RUNS:
    rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
path.write_text('\n'.join(rows) + '\n')
