"""대치유 — 64px 10칸, 아군마다. cleric_halo 의 빛이 내려와 → 초록·금 빛기둥과 회복 십자 → 빛 방울이 솟아오름. cleric_heal 과 같은 HEAL, cleric_halo 와 같은 HOLY."""
import math, random
from lib_mage import *

KEY = 'cleric_mass_heal'; FRAME = 64; FRAMES = 10; ANCHOR = 'allAllies'
PAL = Pal(G=HEAL, H=HOLY[2:])
PEAK = [2, 4, 7]
CX, FY, CY = 32, 55, 38
_r = random.Random(12)
RAYS = [(_r.uniform(-16, 16), _r.uniform(0, 1)) for _ in range(7)]
BUBBLES = [(_r.uniform(-20, 20), _r.uniform(0, 50), _r.randint(1, 3)) for _ in range(16)]


def plus(c, x, y, s, col, core):
    c.rect(x - s, y - s // 3, x + s, y + s // 3, col); c.rect(x - s // 3, y - s, x + s // 3, y + s, col)
    c.rect(x - s + 1, y, x + s - 1, y, core); c.rect(x, y - s + 1, x, y + s - 1, core)


def draw(c, f):
    G, H = PAL.G, PAL.H
    if f <= 2:  # slanted rays of light arriving from the halo above
        for dx, ph in RAYS:
            ln = [18, 36, 52][f]
            x0 = CX + dx + 6; c.line([(x0, 0), (x0 - 4, ln)], H[1] if ph > .5 else G[3])
            c.px(x0 - 4, ln, H[3])
        c.disc(CX, FY, 6 + f * 6, G[2], 2 + f)
        return
    t = f - 3
    # green column
    if t <= 4:
        w = [14, 13, 11, 8, 5][t]
        c.poly([(CX - w - 3, FY), (CX - w, 0), (CX + w, 0), (CX + w + 3, FY)], G[1])
        c.poly([(CX - w + 2, FY), (CX - w + 3, 0), (CX + w - 3, 0), (CX + w - 2, FY)], G[2])
        c.poly([(CX - w / 2, FY), (CX - w / 3, 0), (CX + w / 3, 0), (CX + w / 2, FY)], G[3])
        if t < 2: c.rect(CX - 1, 0, CX + 1, FY, G[5])
    base = lambda cc: (cc.disc(CX, FY, 24 - max(0, t - 3) * 3, G[2], 6), cc.ring(CX, FY, 24 - max(0, t - 3) * 3, G[4], 1, 6))
    (base(c) if t < 5 else c.dither(base, t))
    # rising bubbles
    for dx, y0, s in BUBBLES:
        y = FY - 4 - ((y0 + t * 8) % 52)
        x = CX + dx + math.sin(y * .25) * 2
        if t >= 5 and (int(y0) + t) % 2: continue
        c.ring(x, y, s, G[4]) if s > 1 else c.px(x, y, G[5])
        if s > 1: c.px(x - 1, y - 1, G[5])
    # recovery plus signs pop at the body
    if 1 <= t <= 5:
        s = [0, 8, 6, 5, 4, 3][t]
        plus(c, CX, CY - 4 - t * 2, s, G[4] if t < 3 else G[3], G[5])
        if t == 1: c.ring(CX, CY - 6, 16, H[2], 1)
    if t == 0:
        c.spark(CX, CY - 4, 10, H[3], diag=True)


if __name__ == '__main__':
    make(KEY)

