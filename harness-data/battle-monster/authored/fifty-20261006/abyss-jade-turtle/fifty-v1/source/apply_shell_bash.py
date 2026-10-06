"""Apply only explicitly authored y/x/ASCII spans; no generated art pixels."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
target = ROOT / 'poses/attack.pxgrid'
rows = target.read_text().splitlines()
for line in (ROOT / 'edits/shell-bash.rows').read_text().splitlines():
    if not line or line.startswith('#'):
        continue
    y, x, pixels = line.split()
    y, x = int(y), int(x)
    if x + len(pixels) > 127:
        raise ValueError((y, x, len(pixels)))
    rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
target.write_text('\n'.join(rows) + '\n')
