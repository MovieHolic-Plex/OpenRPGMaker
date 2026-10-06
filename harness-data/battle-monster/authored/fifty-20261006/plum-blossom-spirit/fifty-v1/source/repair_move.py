"""Explicit single native-pixel correction; no inferred filling or frame transform."""
from pathlib import Path


def apply_move_repair(grid):
    # Zero-based (46, 81). Right (47,81) and below (46,82) use C.
    # C is the existing leg shadow #928B9C; retain the skirt and feet.
    if grid[81][46] not in ('.', 'C'):
        raise ValueError('Unexpected source at move (46,81)')
    grid[81][46] = 'C'


if __name__ == '__main__':
    path = Path(__file__).resolve().parent / 'poses/move.pxgrid'
    grid = [list(row) for row in path.read_text().splitlines()]
    apply_move_repair(grid)
    path.write_text('\n'.join(''.join(row) for row in grid) + '\n')
