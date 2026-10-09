"""mon_screech_ring: 초음파 (착탄, 전체). Magenta sound arcs roll in from the left, ring around the ally head and leave sleepy Z marks rising.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_screech_ring', 64, 8, 'allTargets'
PAL = pal(SONIC, pick(DUSK, 'v1', 'v3'), WHITE)
HX, HY = CX - 1, CY - 7                                   # ally head


def arcs(c, x, n, r0, gap, keys, w=1):
    for i in range(n):
        c.arc(x + i * gap, HY, r0 + i * 2, -50, 50, keys[i % len(keys)], w)


def jagged(c, x, y, r, n, k, amp=1.5, rot=0.0, squash=1.0):
    pts = [pol(x, y, r + (amp if i % 2 else -amp), rot + i * 2 * math.pi / n, squash) for i in range(n)]
    c.line(pts + [pts[0]], k)


def draw(c, f):
    if f == 0:
        arcs(c, -2, 2, 5, 5, ['m2', 'm3'])
        c.px(1, HY, 'm4')
    elif f == 1:
        arcs(c, 2, 3, 6, 5, ['m1', 'm2', 'm3'], 2)
        arcs(c, 4, 3, 6, 5, ['m3', 'm4', 'w'])
    elif f == 2:
        arcs(c, 10, 3, 8, 4, ['m1', 'm2', 'm3'], 2)
        arcs(c, 12, 3, 8, 4, ['m3', 'm4', 'w'])
        jagged(c, HX, HY, 9, 16, 'm2')
    elif f == 3:
        jagged(c, HX, HY, 15, 22, 'm1', 2, 0.1)
        jagged(c, HX, HY, 14, 22, 'm3', 2, 0.1)
        jagged(c, HX, HY, 9, 16, 'm4', 1.5, 0.3)
        c.rays(HX, HY, 10, 18, 24, 'm2', rot=0.15)
        for a in (-2.6, -0.4, 1.2, 2.3):
            c.spark(*pol(HX, HY, 20, a), 2, 'w', 'm4')
    elif f == 4:
        c.dring(HX, HY, 20, 'm2')
        jagged(c, HX, HY, 12, 18, 'm3', 1.5, 0.4)
        for s in (-1, 1):                                  # head-shake marks
            c.arc(HX + s * 9, HY, 4, -40 if s > 0 else 140, 40 if s > 0 else 220, 'm4')
            c.arc(HX + s * 12, HY, 5, -30 if s > 0 else 150, 30 if s > 0 else 210, 'm3')
    elif f == 5:
        c.dring(HX, HY, 14, 'm3', parity=1)
        c.brush(HX, HY - 9, 5, 180, 520, 0.5, 1, 'v3', squash=0.5)
        zee(c, HX + 6, HY - 14, 3, 'm4')
        c.px(HX + 5, HY - 15, 'w')
    elif f == 6:
        c.brush(HX, HY - 10, 6, 260, 600, 0.5, 1, 'v3', squash=0.5)
        zee(c, HX + 5, HY - 18, 3, 'm3')
        zee(c, HX + 11, HY - 26, 5, 'm4')
        c.line([(HX + 11, HY - 27), (HX + 16, HY - 27)], 'w')
    else:
        zee(c, HX + 8, HY - 24, 3, 'm2')
        zee(c, HX + 15, HY - 33, 5, 'm3')
        c.ddisc(HX, HY - 10, 5, 'v1', squash=0.5)


if __name__ == '__main__':
    run(globals())

