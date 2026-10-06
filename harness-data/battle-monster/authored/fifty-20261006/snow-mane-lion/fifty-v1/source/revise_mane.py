"""Apply separate hand-picked runs to the pre-revision snapshot, no transforms."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parent
palette = set(json.loads((ROOT / 'palette.json').read_text())) | {'.'}
for path in sorted((ROOT / 'repairs').glob('mane-*.runs')):
    name = path.stem.removeprefix('mane-').replace('-', '_')
    folder = 'poses' if (ROOT / 'before-mane-repair/poses' / (name + '.pxgrid')).exists() else 'actions'
    rows = [list(row) for row in (ROOT / 'before-mane-repair' / folder / (name + '.pxgrid')).read_text().splitlines()]
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        assert 0 <= y < 128 and 0 <= x and x + len(pixels) <= 128
        assert set(pixels) <= palette
        rows[y][x:x + len(pixels)] = pixels
    (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(row) for row in rows) + '\n')
    print(name, 'literal runs applied')
