"""Explicit native hit-wall rows; no geometric or automatic contour edits."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent

# Each run is chosen for this hit frame, in native zero-based coordinates.
# The wall emerges behind the handle and widens gradually toward the belly.
# Nothing inside the handle's intentional opening is changed.
EDITS = [
    (32, 57, 'OBLHHHLLL'),
    (31, 58, 'OBLHTHHHLLL'),
    (30, 59, 'OBLHHTTHHHLLL'),
    (29, 60, 'OBLHHHTTHHHLLL'),
    (28, 61, 'OBLHHHHTTHHHLLL'),
    (27, 62, 'OBLHHHHTHHHHLLL'),
    (26, 63, 'OBLHHHHHHHHHHLLL'),
    (26, 64, 'OBLHHHHHHHHHHLLL'),
    (25, 65, 'OBLHHHHHHHHHHHLLL'),
    (25, 66, 'OBLLLHHHHHHHHHLLL'),
    (25, 67, 'OBLLLHHHHHHHHLLL'),
    (25, 68, 'OBLLLHHHHHHHHLLL'),
    (25, 69, 'OBLLLHHHHHHHLLLL'),
    (26, 70, 'OBLLLHHHHHHLLLLL'),
    (26, 71, 'OBLLLHHHHHLLLLLL'),
    (26, 72, 'OBLLLHHHHHLLLLLL'),
]


def apply():
    path = ROOT / 'poses/hit.pxgrid'
    rows = [list(row) for row in path.read_text().splitlines()]
    for x, y, pixels in EDITS:
        rows[y][x:x + len(pixels)] = pixels
    path.write_text('\n'.join(''.join(row) for row in rows) + '\n')


def snapshot():
    out = ROOT / 'before-repair-004'
    if out.exists():
        return
    out.mkdir()
    hashes = {}
    for folder in ('poses', 'actions'):
        (out / folder).mkdir()
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            rel = path.relative_to(ROOT)
            shutil.copy2(path, out / rel)
            hashes[str(rel)] = hashlib.sha256(path.read_bytes()).hexdigest()
    for name in ('palette.json', 'AUTHORING.md', 'TIMING.md', 'author.py',
                 'repair_002.py', 'repair_003.py', 'render.py'):
        shutil.copy2(ROOT / name, out / name)
    hashes['palette.json'] = hashlib.sha256((ROOT / 'palette.json').read_bytes()).hexdigest()
    (out / 'source-hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')


if __name__ == '__main__':
    snapshot()
    apply()
