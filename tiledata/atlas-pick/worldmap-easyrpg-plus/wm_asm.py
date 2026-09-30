"""엔진 사분면 규칙으로 5x5 캔버스를 조립하고, 다시 킷 12칸으로 뽑는다.
킷 12칸 = (48x64). 배치: row0 iso/변형/inner, row1 NW N NE, row2 W body E, row3 SW S SE."""
import numpy as np
from wm_lib import CELL, KIT_LAYOUT, cellmap_full, cellmap_inner

Q = CELL // 2
# 킷 안의 (열,행)
ROLE = dict(iso=(0, 0), inner=(2, 0), nw=(0, 1), n=(1, 1), ne=(2, 1),
            w=(0, 2), body=(1, 2), e=(2, 2), sw=(0, 3), s=(1, 3), se=(2, 3))


def kcell(kit, role):
    c, r = ROLE[role]
    return kit[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]


def assemble(kit, cm, outside, iso_whole=True):
    ch, cw = len(cm), len(cm[0])
    out = np.tile(outside, (ch, cw, 1)).astype(np.uint8)

    def has(x, y):
        return 0 <= x < cw and 0 <= y < ch and cm[y][x]
    for cy in range(ch):
        for cx in range(cw):
            if not cm[cy][cx]:
                continue
            if iso_whole and not any(has(cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)):
                out[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = kcell(kit, 'iso')
                continue
            for qy in (0, 1):
                for qx in (0, 1):
                    sx = -1 if qx == 0 else 1
                    sy = -1 if qy == 0 else 1
                    v = has(cx, cy + sy)
                    h = has(cx + sx, cy)
                    d = has(cx + sx, cy + sy)
                    if not v and not h:
                        role = ('nw', 'ne', 'sw', 'se')[qy * 2 + qx]
                    elif not v:
                        role = 'n' if qy == 0 else 's'
                    elif not h:
                        role = 'w' if qx == 0 else 'e'
                    elif not d:
                        role = 'inner'
                    else:
                        role = 'body'
                    src = kcell(kit, role)
                    y0, x0 = cy * CELL + qy * Q, cx * CELL + qx * Q
                    out[y0:y0 + Q, x0:x0 + Q] = src[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q]
    return out


def extract_kit(canvases, variant_tile):
    """canvases: dict iso/inner/full -> 5x5 캔버스."""
    kit = np.zeros((4 * CELL, 3 * CELL, 3), np.uint8)
    for (c, r), (kind, (cx, cy)) in KIT_LAYOUT.items():
        kit[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = \
            canvases[kind][cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL]
    kit[0:CELL, CELL:2 * CELL] = variant_tile
    return kit


def canvases_from(kit, outside):
    return dict(iso=assemble(kit, [[False, False, False, False, False]] * 2 + [[False, False, True, False, False]] + [[False] * 5] * 2, outside),
                inner=assemble(kit, cellmap_inner(), outside),
                full=assemble(kit, cellmap_full(), outside))
