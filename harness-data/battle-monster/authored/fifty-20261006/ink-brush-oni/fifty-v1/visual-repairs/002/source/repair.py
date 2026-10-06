"""Explicit native row segments chosen for the hand/ink review corrections.

Coordinates are (y, x, literal ASCII). No silhouette/effect synthesis or filling.
Run after author.py; patches are idempotent. The full pxgrid rows are canonical.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCHES = {
    'poses/recover.pxgrid': [
        (63, 65, 'OssfffssOO'),
        (64, 65, 'OsflssOO'),
        (65, 65, 'OsffsO'),
        (66, 65, 'OsfsO'),
        (67, 65, 'sfsO'),
        (68, 65, 'ssO'),
        (69, 65, 'OOO'),
    ],
    'poses/hit.pxgrid': [
        (63, 66, 'sfffssOOO'),
        (64, 65, 'OsflssOO'),
        (65, 65, 'OsffsO'),
        (66, 65, 'OsfsO'),
        (67, 65, 'sfsO'),
        (68, 65, 'ssO'),
        (69, 65, 'OOO'),
    ],
    'actions/skill_b.pxgrid': [
        (29, 86, 'h'),
        (30, 85, 'hh'),
        (31, 84, 'h'),
        (43, 91, 'h'),
        (44, 90, 'h'),
        (45, 89, 'h'),
    ],
    'actions/skill_c.pxgrid': [
        (15, 75, 'v'),
        (16, 76, 'v'),
        (20, 80, 'v'),
        (21, 81, 'v'),
        (36, 79, 'v'),
        (45, 84, 'v'),
    ],
}


def apply():
    for relative, patches in PATCHES.items():
        path = ROOT / relative
        rows = [list(row) for row in path.read_text().splitlines()]
        for y, x, literal in patches:
            rows[y][x:x + len(literal)] = list(literal)
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n')


if __name__ == '__main__':
    apply()
