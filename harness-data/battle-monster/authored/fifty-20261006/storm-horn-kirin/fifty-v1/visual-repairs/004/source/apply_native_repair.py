"""Apply only the individually selected literal runs; no inferred pixel edits."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POSES = {'idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead'}


def main():
    grids = {}
    paths = {}
    for line in (ROOT / 'native-cluster-repair-runs.txt').read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('@'):
            name = line[1:]
            path = ROOT / ('poses' if name in POSES else 'actions') / (name + '.pxgrid')
            paths[name] = path
            if name not in grids:
                grids[name] = [list(row) for row in path.read_text().splitlines()]
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        grids[name][y][x:x + len(pixels)] = pixels
    for name, grid in grids.items():
        paths[name].write_text('\n'.join(''.join(row) for row in grid) + '\n')
    print('Applied explicit runs:', ', '.join(grids))


if __name__ == '__main__':
    main()
