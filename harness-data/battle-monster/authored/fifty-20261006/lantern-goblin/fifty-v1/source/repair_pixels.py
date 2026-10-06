"""Explicit native cluster repairs, zero-based (x, y, literal ASCII pixels).

No geometry, derived shading, pose transforms or automatic hole filling.
The original complete grids remain the source; only these chosen rows change.
"""
from pathlib import Path

PATCHES = {
    'poses/windup.pxgrid': [
        # Fingers wrap the right bail post at x21, y41. Upper-left knuckles,
        # lower-right back-of-hand shadow, wrist and rising forearm are explicit.
        (21, 39, 'KKKK'),
        (20, 40, 'KLLLSK'),
        (20, 41, 'GLLSSK'),
        (20, 42, 'GLSSRK'),
        (20, 43, 'GLSSLSK'),
        (22, 44, 'KLLLSSK'),
        (24, 45, 'KLLLSSRK'),
        (24, 46, '.KLLLSSRK'),
        (24, 47, '..KLLLSSRK'),
        (24, 48, '...KLLLSSSRK'),
        (25, 49, '...KLLLSSSRK..'),
        (25, 50, '.....KLLLSSSRKBN'),
        (25, 51, '......KLLLSSSRKN'),
        (25, 52, '.......KLLLSSSSRK'),
        (25, 53, '.........KLLLSSSSRK'),
    ],
    'actions/skill_b.pxgrid': [
        # Open luminous rim at y50; a hot narrow neck joins the three branches.
        # Keep the entire bail and the gripping fingers at y44..49 intact.
        (69, 50, 'GYFWWFFWW'),
        (69, 51, 'YFWWF'),
        (69, 52, 'FWWFY'),
        (69, 53, 'FWWFY'),
        (69, 54, 'FWFYY'),
        # Restore the dark right paper boundary, then a one-pixel air channel.
        # These authored edges separate the lower flame from the closed wall.
        (76, 51, 'K.OFW'),
        (76, 52, 'K.OFW'),
        (76, 53, 'K.OFW'),
        (76, 54, 'K.OFFO..'),
        (76, 55, 'K.OFFO'),
        (76, 56, 'K.OFFO'),
        (76, 57, 'K.OFFO'),
        (76, 58, 'K.OFFO'),
    ],
}


def patch_rows(rows, changes):
    for x, y, pixels in changes:
        for dx, symbol in enumerate(pixels):
            rows[y][x + dx] = symbol


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    for relative, changes in PATCHES.items():
        path = root / relative
        rows = [list(row) for row in path.read_text().splitlines()]
        patch_rows(rows, changes)
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n')
        print('Wrote explicit clusters:', relative)
