"""Apply individually authored native ASCII runs to preserved original grids.

Each .runs file belongs to exactly one pose. No frame transforms, shared pose
patches, procedural colour, geometry, interpolation or automatic hole repair.
Coordinates in the files are y, x, literal final pixels; dots explicitly erase.
The deliverable is still the full 128 x 128 .pxgrid, not this helper format.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT / 'palette.json').read_text())
for patch in sorted((ROOT / 'repairs').glob('*.runs')):
    # The following revision has its own snapshot and independent decoder.
    if patch.name.startswith('mane-'):
        continue
    name = patch.stem
    folder = 'poses' if (ROOT / 'original/poses' / (name + '.pxgrid')).exists() else 'actions'
    rows = [list(row) for row in (ROOT / 'original' / folder / (name + '.pxgrid')).read_text().splitlines()]
    for line in patch.read_text().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        if not (0 <= y < 128 and 0 <= x and x + len(pixels) <= 128):
            raise ValueError((patch.name, y, x, pixels))
        if not set(pixels) <= set(palette) | {'.'}:
            raise ValueError((patch.name, pixels))
        rows[y][x:x + len(pixels)] = pixels
    (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(row) for row in rows) + '\n')
    print('Authored runs applied:', name)
