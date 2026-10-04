"""scout_knife_hit: 비수 폭풍 (착탄). Knives rain in from the upper right, stick, then explode into steel shards around a flash.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_knife_hit', 64, 8, 'target'
ANCHOR = 'allTargets'
PAL = pal(STEEL, pick(SHADOW, 'd', 'm', 'v', 'l'), pick(CRIMSON, 'r1'), WHITE)
CX, CY = 32, 36
HITS = [(24, 29), (39, 41), (22, 46), (42, 26), (30, 40), (35, 31), (32, 36)]
HIT_AT = [1, 1, 2, 2, 2, 3, 3]
ANG = math.atan2(-10, 12)  # tip -> handle points up-right


def knife(c, x, y, depth=0):
    """Tip at (x, y); the blade runs back toward the upper right. depth hides the buried tip."""
    ux, uy = math.cos(ANG), math.sin(ANG)
    vx, vy = -uy, ux
    s = depth
    tip = (x + ux * s, y + uy * s)
    b0 = (x + ux * 10, y + uy * 10)
    c.poly([tip, (b0[0] + vx * 2.5, b0[1] + vy * 2.5), (b0[0] - vx * 2, b0[1] - vy * 2)], 's1', outline='s0')
    c.line([tip, b0], 's2')
    g = (x + ux * 11, y + uy * 11)
    c.line([(g[0] + vx * 3, g[1] + vy * 3), (g[0] - vx * 3, g[1] - vy * 3)], 'd')
    c.line([g, (x + ux * 16, y + uy * 16)], 'm', 2)


def flying(c, x, y, lag):
    ux, uy = math.cos(ANG), math.sin(ANG)
    hx, hy = x + ux * lag, y + uy * lag
    c.line([(hx + ux * 13, hy + uy * 13), (hx + ux * 26, hy + uy * 26)], 'v')
    c.line([(hx + ux * 15, hy + uy * 15), (hx + ux * 21, hy + uy * 21)], 'l')
    knife(c, hx, hy)


def draw(c, f):
    for i, (x, y) in enumerate(HITS):
        t = HIT_AT[i]
        if f < t and f >= t - 1:
            flying(c, x, y, 12)
        elif f == t:
            knife(c, x, y, 2)
            c.spark(x, y, 4 if i < 4 else 6, 'w', 's2')
        elif t < f <= 4:
            knife(c, x, y, 2)
    if f == 3:
        c.rays(CX, CY, 12, 9, 22, 'v', rot=0.15, jitter=[1, 0.7, 0.85])
        c.spark(CX, CY, 18, 'w', 'l', diag=True)
        c.ring(CX, CY, 8, 'v', 2)
        c.disc(CX, CY, 3, 'w')
    elif f == 4:
        c.ring(CX, CY, 16, 'v', 3)
        c.ring(CX, CY, 14, 'l', 1)
        c.ring(CX, CY, 9, 's2', 1)
        for i, (x, y) in enumerate(HITS):
            c.px(x + 2, y - 2, 'w')
        c.spark(CX, CY, 7, 'w', 'r1')
    elif f in (5, 6):
        dist = 6 if f == 5 else 12
        r = rng(3)
        for x, y in HITS:
            for j in range(3):
                a = r.uniform(0, 2 * math.pi)
                px_, py_ = x + math.cos(a) * dist, y + math.sin(a) * dist + (f - 5) * 3
                c.line([(px_, py_), (px_ + math.cos(a) * (3 if f == 5 else 1), py_ + math.sin(a) * 2)], 's2' if j else 's1', 1)
        if f == 5:
            c.dring(CX, CY, 17, 'v')
            c.dring(CX, CY, 16, 'm', 1)
        else:
            c.dring(CX, CY, 21, 'd')
    elif f == 7:
        for x, y in [(18, 26), (46, 34), (30, 52), (38, 18), (22, 44)]:
            c.spark(x, y, 1, 's2')


if __name__ == '__main__':
    run(globals())

