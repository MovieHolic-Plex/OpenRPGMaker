"""Three explicitly chosen boundary pixels; no inferred or automatic filling."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EDITS = [(17, 31, 'K'), (17, 32, 'K'), (17, 33, 'K')]

def main():
    path = ROOT / 'actions/skill_b.pxgrid'
    rows = path.read_text(encoding='ascii').splitlines()
    for x, y, symbol in EDITS:
        rows[y] = rows[y][:x] + symbol + rows[y][x + 1:]
    path.write_text('\n'.join(rows) + '\n', encoding='ascii')

if __name__ == '__main__':
    main()
