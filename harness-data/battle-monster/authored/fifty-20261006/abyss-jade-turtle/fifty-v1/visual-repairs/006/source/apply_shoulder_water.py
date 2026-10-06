"""Apply hand-selected native ASCII spans; no geometry or pose generation.

Only the two named grids are read and written. Rows apply in recorded order.
The complete final 128x128 literal grids remain the artwork source.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGETS = {'attack': 'poses', 'skill_b': 'actions'}

for name, folder in TARGETS.items():
    path = ROOT / folder / (name + '.pxgrid')
    rows = path.read_text(encoding='ascii').splitlines()
    for line in (ROOT / 'edits/shoulder-water' / (name + '.rows')).read_text(encoding='ascii').splitlines():
        if not line or line.startswith('#'):
            continue
        sy, sx, pixels = line.split()
        y, x = int(sy), int(sx)
        if x < 1 or x + len(pixels) > 127 or y < 1 or y > 124:
            raise ValueError((name, y, x, pixels))
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    path.write_text('\n'.join(rows) + '\n', encoding='ascii')
