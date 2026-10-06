"""Apply only the explicitly selected native row strings; no inferred edits."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def apply():
    name = None
    changed = {}
    for line in (ROOT / 'skirt-fall-rows.txt').read_text().splitlines():
        if line.startswith('#') or not line.strip():
            continue
        if line.startswith('['):
            name = line[1:-1]
            path = ROOT / 'poses' / (name + '.pxgrid')
            if not path.exists():
                path = ROOT / 'actions' / (name + '.pxgrid')
            changed[name] = (path, [list(r) for r in path.read_text().splitlines()])
            continue
        sy, sx, pixels = line.split()
        y, x = int(sy), int(sx)
        path, rows = changed[name]
        if x < 1 or x + len(pixels) > 63 or y < 1 or y > 60:
            raise ValueError((name, y, x, pixels))
        rows[y][x:x+len(pixels)] = pixels
    for path, rows in changed.values():
        path.write_text('\n'.join(''.join(r) for r in rows) + '\n')

if __name__ == '__main__':
    apply()
