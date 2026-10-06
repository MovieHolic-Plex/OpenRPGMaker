"""Apply only explicitly authored ASCII spans; never infer or propagate pixels."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
for edit in sorted((ROOT / 'edits/rigid-shell-rounded-stun').glob('*.rows')):
    folder = 'poses' if edit.stem == 'attack' else 'actions'
    target = ROOT / folder / (edit.stem + '.pxgrid')
    rows = target.read_text().splitlines()
    for line in edit.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        if x + len(pixels) > 128:
            raise ValueError((edit.name, line))
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    target.write_text('\n'.join(rows) + '\n')
    print(target.relative_to(ROOT))
