"""mon_bandage_wrap: 붕대 속박 (착탄). Linen strips shoot in from the left, coil around the ally in tightening
spiral bands, cinch with a dusty violet curse knot at the peak, then fray and fall away as rags and grave dust.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_bandage_wrap', 64, 10, 'target'
PAL = pal(LINEN, pick(GRAVE, 'v1', 'v2', 'v3'), pick(BONE, 'b0'))
PEAK = 5
TOP, BOT = 26, 52


def strip(c, pts, w=3):
    """Bandage ribbon: dark edge, linen body, light upper fold, stitch ticks."""
    c.line(pts, 'l0', w + 2)
    c.line(pts, 'l1', w)
    c.line([(x, y - 1) for x, y in pts], 'l2', max(1, w - 2))
    c.line([(x - 0.5, y - 1.5) for x, y in pts[: len(pts) // 2 + 1]], 'l3')


def wraps(c, n, rx, phase=0.0, tight=0.0):
    """n front bands around the body, each a tilted ellipse half; back halves darker."""
    for i in range(n):
        y = lerp(BOT - 2, TOP + 2, i / max(1, n - 1)) if n > 1 else CY
        r = rx - tight
        c.arc(CX, y, r, 180, 360, 'b0', 2, squash=0.28)  # back half
    for i in range(n):
        y = lerp(BOT - 2, TOP + 2, i / max(1, n - 1)) if n > 1 else CY
        r = rx - tight
        pts = [(CX + math.cos(a) * r, y + math.sin(a) * r * 0.28 + (a - math.pi / 2) * 0.8)
               for a in [phase + j * math.pi / 10 for j in range(11)]]
        strip(c, pts, 1)


def tail(c, x0, y0, x1, y1, bend, w=3):
    strip(c, bez([(x0, y0), ((x0 + x1) / 2, y0 + bend), (x1, y1)], 12), w)


def draw(c, f):
    if f == 0:
        tail(c, 0, 30, 14, 36, -6)
        tail(c, 0, 46, 10, 44, 4)
    elif f == 1:
        tail(c, 0, 30, CX - 6, 34, -8)
        tail(c, 0, 46, CX - 10, 48, 6)
        tail(c, 2, 20, 18, 26, -4, 2)
    elif f == 2:
        tail(c, 0, 30, CX - 12, 34, -6)
        wraps(c, 2, 16, 0.2)
        tail(c, 0, 48, CX - 14, 48, 4)
    elif f == 3:
        tail(c, 0, 32, CX - 14, 36, -4)
        wraps(c, 3, 15, 0.1)
    elif f == 4:
        tail(c, 2, 34, CX - 14, 38, -2, 2)
        wraps(c, 4, 14, 0.0, 1)
        c.dring(CX, CY, 20, 'v2', squash=0.9)
    elif f == 5:  # peak: cinched tight, curse knot flares
        c.ring(CX, CY, 22, 'v1', 2, squash=0.9)
        c.dring(CX, CY, 25, 'v2', squash=0.9)
        wraps(c, 4, 13, 0.0, 1)
        c.disc(CX + 12, CY - 2, 4, 'l0')
        c.disc(CX + 12, CY - 2, 3, 'l2')
        c.line([(CX + 12, CY + 1), (CX + 16, CY + 8)], 'l1', 2)
        c.line([(CX + 12, CY + 1), (CX + 9, CY + 9)], 'l1', 2)
        c.spark(CX + 12, CY - 2, 6, 'v3', 'v2', diag=True)
        motes(c, CX, CY, 8, 18, 24, 5, ['v2', 'v3'], sq=0.9)
    elif f == 6:
        c.dring(CX, CY, 22, 'v1', squash=0.9)
        wraps(c, 4, 12, 0.15, 1)
        c.disc(CX + 12, CY - 2, 3, 'l2')
        motes(c, CX, CY, 8, 16, 24, 6, ['v2', 'l2'], sq=0.9, dy=-3)
    elif f == 7:  # bands loosen and fray
        wraps(c, 3, 15, 0.4)
        for x, y, d in [(CX - 16, 30, 1), (CX + 16, 40, -1), (CX - 14, 50, 1)]:
            tail(c, x, y, x - 8 * d, y + 8, 3, 2)
        motes(c, CX, CY, 6, 16, 24, 7, ['v1', 'v2'], sq=0.9)
    elif f == 8:
        r = rng(8)
        for i in range(5):
            x, y = CX + r.uniform(-18, 18), r.uniform(32, 52)
            tail(c, x, y, x + r.uniform(-6, 6), y + 6, 2, 2)
        c.dring(CX, FEET, 16, 'v1', squash=0.3)
    else:
        r = rng(9)
        for i in range(5):
            x, y = CX + r.uniform(-20, 20), FEET - r.uniform(0, 3)
            c.line([(x - 3, y), (x + 3, y - 1)], 'l1', 2)
            c.px(x - 2, y - 1, 'l2')
        c.ddisc(CX, FEET, 16, 'v1', squash=0.25)


if __name__ == '__main__':
    run(globals())
