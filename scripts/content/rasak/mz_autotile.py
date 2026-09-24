# RPG Maker MZ autotile expansion (rmmz_core.js Tilemap tables), used to bake
# user-supplied MZ sheets into a single OPRN atlas. Pure geometry: no sheet
# pixels live in this repository.
#
# Quarter order in every table entry: top-left, top-right, bottom-left,
# bottom-right. Each quarter is [qsx, qsy] in 24px units inside the block.
import numpy as np

FLOOR = [
    [[2,4],[1,4],[2,3],[1,3]],[[2,0],[1,4],[2,3],[1,3]],[[2,4],[3,0],[2,3],[1,3]],[[2,0],[3,0],[2,3],[1,3]],
    [[2,4],[1,4],[2,3],[3,1]],[[2,0],[1,4],[2,3],[3,1]],[[2,4],[3,0],[2,3],[3,1]],[[2,0],[3,0],[2,3],[3,1]],
    [[2,4],[1,4],[2,1],[1,3]],[[2,0],[1,4],[2,1],[1,3]],[[2,4],[3,0],[2,1],[1,3]],[[2,0],[3,0],[2,1],[1,3]],
    [[2,4],[1,4],[2,1],[3,1]],[[2,0],[1,4],[2,1],[3,1]],[[2,4],[3,0],[2,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],
    [[0,4],[1,4],[0,3],[1,3]],[[0,4],[3,0],[0,3],[1,3]],[[0,4],[1,4],[0,3],[3,1]],[[0,4],[3,0],[0,3],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[2,2],[1,2],[2,3],[3,1]],[[2,2],[1,2],[2,1],[1,3]],[[2,2],[1,2],[2,1],[3,1]],
    [[2,4],[3,4],[2,3],[3,3]],[[2,4],[3,4],[2,1],[3,3]],[[2,0],[3,4],[2,3],[3,3]],[[2,0],[3,4],[2,1],[3,3]],
    [[2,4],[1,4],[2,5],[1,5]],[[2,0],[1,4],[2,5],[1,5]],[[2,4],[3,0],[2,5],[1,5]],[[2,0],[3,0],[2,5],[1,5]],
    [[0,4],[3,4],[0,3],[3,3]],[[2,2],[1,2],[2,5],[1,5]],[[0,2],[1,2],[0,3],[1,3]],[[0,2],[1,2],[0,3],[3,1]],
    [[2,2],[3,2],[2,3],[3,3]],[[2,2],[3,2],[2,1],[3,3]],[[2,4],[3,4],[2,5],[3,5]],[[2,0],[3,4],[2,5],[3,5]],
    [[0,4],[1,4],[0,5],[1,5]],[[0,4],[3,0],[0,5],[1,5]],[[0,2],[3,2],[0,3],[3,3]],[[0,2],[1,2],[0,5],[1,5]],
    [[0,4],[3,4],[0,5],[3,5]],[[2,2],[3,2],[2,5],[3,5]],[[0,2],[3,2],[0,5],[3,5]],[[0,0],[1,0],[0,1],[1,1]],
]
WALL = [
    [[2,2],[1,2],[2,1],[1,1]],[[0,2],[1,2],[0,1],[1,1]],[[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
    [[2,2],[3,2],[2,1],[3,1]],[[0,2],[3,2],[0,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[0,2],[1,2],[0,3],[1,3]],[[2,0],[1,0],[2,3],[1,3]],[[0,0],[1,0],[0,3],[1,3]],
    [[2,2],[3,2],[2,3],[3,3]],[[0,2],[3,2],[0,3],[3,3]],[[2,0],[3,0],[2,3],[3,3]],[[0,0],[3,0],[0,3],[3,3]],
]
WATERFALL = [
    [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
]

T = 48
Q = 24
# MZ plays water surfaces 0,1,2,1 and waterfalls 0,1,2.
WATER_FRAMES = [0, 1, 2, 1]
WATERFALL_FRAMES = [0, 1, 2]


def compose(sheet, table_entry, bx, by):
    """bx/by are block origins in 48px tile units (may be .5 for A4)."""
    out = np.zeros((T, T, 4), dtype=np.uint8)
    ox, oy = int(round(bx * 2)), int(round(by * 2))
    for i, (qsx, qsy) in enumerate(table_entry):
        sx, sy = (ox + qsx) * Q, (oy + qsy) * Q
        dx, dy = (i % 2) * Q, (i // 2) * Q
        out[dy:dy + Q, dx:dx + Q] = sheet[sy:sy + Q, sx:sx + Q]
    return out


def a1_block(kind, frame_index):
    """Returns (bx, by, table, animated_axis) for A1 kind at MZ frame index."""
    tx, ty = kind % 8, kind // 8
    surf = WATER_FRAMES[frame_index % 4]
    if kind == 0:
        return surf * 2, 0, FLOOR, 'x'
    if kind == 1:
        return surf * 2, 3, FLOOR, 'x'
    if kind == 2:
        return 6, 0, FLOOR, None
    if kind == 3:
        return 6, 3, FLOOR, None
    bx = (tx // 4) * 8
    by = ty * 6 + ((tx // 2) % 2) * 3
    if kind % 2 == 0:
        return bx + surf * 2, by, FLOOR, 'x'
    return bx + 6, by + WATERFALL_FRAMES[frame_index % 3], WATERFALL, 'y'


def a1_kinds():
    return range(16)


def a2_block(kind):
    return (kind % 8) * 2, (kind // 8) * 3, FLOOR


def a3_block(kind):
    return (kind % 8) * 2, (kind // 8) * 2, WALL


def a4_block(kind):
    """kind 0..47 within A4 (MZ ty = 10 + kind // 8)."""
    tx, ty = kind % 8, 10 + kind // 8
    by = int((ty - 10) * 2.5 + (0.5 if ty % 2 == 1 else 0))
    return tx * 2, by, (WALL if ty % 2 == 1 else FLOOR)
