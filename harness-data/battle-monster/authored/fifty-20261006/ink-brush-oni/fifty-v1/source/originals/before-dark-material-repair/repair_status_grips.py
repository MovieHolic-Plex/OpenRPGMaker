"""Explicit native grip pixels; no transforms, filling or generated shading.

Coordinates are (y, x, literal horizontal palette string), 0 based.
Each pose has its own hand-selected list. Final pxgrids retain all 96 full rows.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCHES = {
    'actions/skill_c.pxgrid': [
        (49, 63, 'ddOrtO.........'),
        (50, 63, 'dOOrtO.........'),
        (51, 63, 'ddOrtslsO......'),
        (52, 63, 'dsfflffsO......'),
        (53, 63, 'dsfrtfsO.......'),
        (54, 63, 'dOsssssO.......'),
        (55, 63, 'dOOrtO.........'),
        (56, 63, 'dOOrtO.........'),
        (57, 63, 'dOOrtO.........'),
        (58, 63, 'dOOrrO.........'),
        (59, 63, 'ddOOO..........'),
    ],
    'actions/poison_a.pxgrid': [
        (69, 39, 'OssfflffsOdddO'),
        (70, 39, '...OsfffsOdddO'),
        (71, 42, 'cOsfllfsOddO'),
        (72, 42, 'cOsflffsOddO'),
        (73, 43, 'rOssflfsOrr'),
        (74, 43, 'tttfsfsOttt'),
        (75, 43, 'rrOssssOrrr'),
        (76, 43, 'cccOOOOddd'),
    ],
    'actions/poison_b.pxgrid': [
        (69, 39, 'OssfflffsOdddO'),
        (70, 39, '...OsfffsOdddO'),
        (71, 42, 'cOsfllfsOddO'),
        (72, 42, 'cOsfflfsOddO'),
        (73, 43, 'rOssflfsOrr'),
        (74, 43, 'tttsffsOttt'),
        (75, 43, 'rrOssssOrrr'),
        (76, 43, 'cccOOOOddd'),
    ],
}


def apply():
    for relative, edits in PATCHES.items():
        path = ROOT / relative
        rows = path.read_text().splitlines()
        for y, x, literal in edits:
            rows[y] = rows[y][:x] + literal + rows[y][x + len(literal):]
        path.write_text('\n'.join(rows) + '\n')


if __name__ == '__main__':
    apply()
