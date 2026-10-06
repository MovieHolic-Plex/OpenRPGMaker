"""Apply separately authored literal spans to this candidate only.

No geometric masks, shading formulas, frame transformations or propagation.
The complete pxgrids remain the authoritative artwork.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
for edits in sorted((ROOT / 'edits' / 'round-rim-rest').glob('*.rows')):
    folder = 'poses' if (ROOT / 'poses' / (edits.stem + '.pxgrid')).exists() else 'actions'
    target = ROOT / folder / (edits.stem + '.pxgrid')
    rows = target.read_text().splitlines()
    for line in edits.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        if not (0 <= y < 128 and 0 <= x and x + len(pixels) <= 128):
            raise ValueError((edits.name, line))
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    target.write_text('\n'.join(rows) + '\n')
    print(target.relative_to(ROOT))
