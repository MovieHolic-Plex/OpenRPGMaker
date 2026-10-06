"""Apply only per-pose literal native pixel runs to the preserved draft."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
symbols = set(json.loads((ROOT / 'palette.json').read_text())) | {'.'}
for patch in sorted((ROOT / 'repairs').glob('joint-*.runs')):
    name = patch.stem.removeprefix('joint-')
    folder = 'poses' if (ROOT / 'before-joint-repair/poses' / (name + '.pxgrid')).exists() else 'actions'
    source = ROOT / 'before-joint-repair' / folder / (name + '.pxgrid')
    rows = [list(row) for row in source.read_text().splitlines()]
    for line in patch.read_text().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        assert set(pixels) <= symbols
        assert 0 <= y < 128 and 0 <= x and x + len(pixels) <= 128
        rows[y][x:x + len(pixels)] = pixels
    (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(row) for row in rows) + '\n')
    print(name, 'explicit runs saved')
