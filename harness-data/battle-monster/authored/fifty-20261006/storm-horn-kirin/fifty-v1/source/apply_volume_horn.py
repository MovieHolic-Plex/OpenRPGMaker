"""Apply explicitly selected ASCII runs, without deriving or moving pixels."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POSES = {'idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead'}

def main():
    grids, paths = {}, {}
    for line in (ROOT / 'volume-horn-runs.txt').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        if line.startswith('@'):
            name = line[1:]
            paths[name] = ROOT / ('poses' if name in POSES else 'actions') / (name + '.pxgrid')
            if name not in grids:
                grids[name] = [list(row) for row in paths[name].read_text().splitlines()]
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        grids[name][y][x:x + len(pixels)] = pixels
    for name, rows in grids.items():
        paths[name].write_text('\n'.join(''.join(row) for row in rows) + '\n')
    print('Wrote literal runs for:', ', '.join(grids))

if __name__ == '__main__':
    main()
