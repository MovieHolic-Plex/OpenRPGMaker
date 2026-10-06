"""Apply explicit artist-written native spans; no propagation between poses.

Every .rows file names its own frame and contains y x literal pixels.
Rebuild order for old drafts: author.py, repair.py, apply_native_edits.py.
The complete pxgrids are authoritative. This helper never infers art pixels.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

for edits in sorted((ROOT / 'edits' / 'dome-impact-mouth').glob('*.rows')):
    folder = 'poses' if (ROOT / 'poses' / (edits.stem + '.pxgrid')).exists() else 'actions'
    target = ROOT / folder / (edits.stem + '.pxgrid')
    rows = target.read_text().splitlines()
    for record in edits.read_text().splitlines():
        if not record or record.startswith('#'):
            continue
        y, x, pixels = record.split()
        y, x = int(y), int(x)
        if not (0 <= y < 128 and 0 <= x and x + len(pixels) <= 128):
            raise ValueError((edits.name, record))
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    target.write_text('\n'.join(rows) + '\n')
    print(target.relative_to(ROOT))
