"""치유의 빛 — 64px 10칸, 대상 아군 위. 위에서 빛 방울이 내려옴 → 초록 빛기둥·십자 반짝임 → 잎사귀 모양 빛 조각이 올라가며 옅어짐."""
import math, random
from lib_mage import *

KEY = 'cleric_heal'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
SIDE = 'ally'   # 검토 합성판에서 아군 위에 얹는다(시트 자체는 대상 기준)
PAL = Pal(G=HEAL, H=HOLY[2:5])
PEAK = [2, 4, 7]
CX, FY, CY = 32, 55, 38
_r = random.Random(2)
MOTES = [(_r.uniform(-20, 20), _r.uniform(0, 40), _r.randint(0, 2)) for _ in range(14)]


def pillar(c, w, top, ramp):
    for i, col in enumerate(ramp):
        ww = w * (1 - i / len(ramp))
        c.poly([(CX - ww - 2, FY), (CX - ww, top), (CX + ww, top), (CX + ww + 2, FY)], col)


def draw(c, f):
    G, H = PAL.G, PAL.H
    # ground glow ellipse
    gr = [4, 8, 14, 20, 22, 22, 21, 18, 14, 9][f]
    base = lambda cc: (cc.disc(CX, FY, gr, G[1], gr * .28), cc.disc(CX, FY, gr * .65, G[3], gr * .18))
    (c.dither(base, f) if f >= 8 else base(c))
    if f <= 2:  # a drop of light descends
        y = [8, 22, 34][f]
        c.line([(CX, y - 12), (CX, y)], G[2]); c.line([(CX, y - 6), (CX, y)], G[4])
        c.glow(CX, y, 3 + f, [G[2], G[4], G[5]])
        for k in range(4):
            x, yy = orbit(CX, y, 8 + f * 2, k * math.pi / 2 + f * .6)
            c.spark(x, yy, 1, H[1])
        return
    if f <= 6:  # pillar + rising motes + big cross glint
        t = f - 3
        w = [10, 12, 11, 8][t]
        pillar(c, w, [0, 0, 0, 6][t], [G[1], G[2], G[3], G[4]] if t < 3 else [G[1], G[2], G[3]])
        if t < 2: c.rect(CX - 1, 0, CX + 1, FY, G[5])
        for dx, y0, kind in MOTES:
            y = FY - 4 - ((y0 + t * 9) % 46)
            x = CX + dx + math.sin(y * .2) * 2
            if kind == 0: c.spark(x, y, 2, G[5], core=H[2])
            elif kind == 1: c.rect(x, y, x + 1, y + 1, G[4])
            else: c.px(x, y, H[1])
        s = [10, 7, 5, 3][t]
        c.spark(CX, CY - 6, s, G[5], diag=True); c.spark(CX, CY - 6, s // 2, H[2])
        if t == 0: c.ring(CX, CY, 18, G[4], 1, 22)
        return
    # afterglow: leaf-shaped light flecks drift upward
    t = f - 7
    for k in range(7):
        x = CX - 18 + k * 6 + math.sin(k + t) * 3
        y = 44 - t * 8 - (k % 3) * 7
        a = -math.pi / 2 + (k - 3) * .25
        if t < 2: feather(c, x, y, 5, a, G[3], G[4])
        else: c.px(x, y, G[3])
    c.dither(lambda cc: pillar(cc, 5 - t, 10 + t * 8, [G[2]]), t)


if __name__ == '__main__':
    make(KEY)

