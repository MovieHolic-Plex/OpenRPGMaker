"""독 가마솥(화면 층) — 128px 8칸. 무대 가운데 아래에 검은 가마솥이 나타나 독녹색 거품이 끓어오르고 → 폭발하듯 독 기둥과 해골 연기가 치솟음, 섬광 → 독 방울이 왼쪽 적진으로 포물선을 그리며 쏟아지고 솥은 보라 연기로 사라짐. witch_poison_hit 와 같은 TOXIC·HEX 팔레트."""
import math
from lib_druid import *

KEY = 'witch_cauldron'; FRAME = 128; FRAMES = 8; ANCHOR = 'screen'
PAL = Pal(T=TOXIC, H=HEX[:6], I=IRON)
PEAK = [2, 3, 5]
_r = rng(KEY)
CX2, RIM = 72, 96
BUBBLES = [(_r.uniform(-20, 20), _r.uniform(0, 1), _r.randint(2, 5)) for _ in range(14)]
DROPS = [(_r.uniform(-14, 14), _r.uniform(.6, 1.3), _r.uniform(-1.4, -.5), _r.randint(0, 2)) for _ in range(22)]


def pot(c, lit=False):
    T, I = PAL.T, PAL.I
    c.disc(CX2, RIM + 12, 27, I[0], 18)
    c.disc(CX2 - 5, RIM + 8, 18, I[1], 11)
    c.px(CX2 - 14, RIM + 6, I[2]); c.line([(CX2 - 16, RIM + 8), (CX2 - 14, RIM + 3)], I[2])
    for sg in (-1, 1): c.rect(CX2 + sg * 16 - 2, RIM + 26, CX2 + sg * 16 + 2, RIM + 31, I[0])
    c.disc(CX2, RIM, 26, I[0], 6); c.ring(CX2, RIM, 26, I[2], 1, 6)
    c.disc(CX2, RIM, 22, T[2] if lit else T[1], 4); c.disc(CX2 - 3, RIM - 1, 14, T[3], 2)
    # fire under the pot
    for k in range(5):
        x = CX2 - 16 + k * 8
        c.poly([(x - 3, RIM + 31), (x, RIM + 22 - (k % 2) * 4), (x + 3, RIM + 31)], PAL.H[3])
        c.poly([(x - 1, RIM + 31), (x, RIM + 26 - (k % 2) * 3), (x + 1, RIM + 31)], PAL.H[5])


def draw(c, f):
    T, H, I = PAL.T, PAL.H, PAL.I
    if f == 0:   # pot rises out of violet smoke
        for k in range(6): c.dither(lambda cc, k=k: puff(cc, CX2 - 28 + k * 11, RIM + 20 - k % 2 * 5, 9, [H[1], H[2], H[3]]), k)
        pot(c)
        return
    if f <= 2:   # boiling: bubbles swell and rise
        pot(c, lit=f == 2)
        for x, ph, r in BUBBLES:
            y = RIM - 2 - ((ph + f * .35) % 1) * 26 * f
            c.disc(CX2 + x, y, r * (.6 + f * .2), T[1]); c.ring(CX2 + x, y, r * (.6 + f * .2), T[3]); c.px(CX2 + x - 1, y - 1, T[4])
        if f == 2:
            c.disc(CX2, RIM - 4, 18, T[3], 8); c.disc(CX2, RIM - 6, 10, T[4], 5)
        return
    if f == 3:   # eruption: toxic geyser + skull cloud + flash
        rays(c, CX2, RIM - 4, 14, 20, 70, T[3], rot=math.pi * 1.04, alt=50, ry=.9)
        pot(c, lit=True)
        c.poly([(CX2 - 16, RIM - 2), (CX2 - 6, 24), (CX2 + 6, 24), (CX2 + 16, RIM - 2)], T[2])
        c.poly([(CX2 - 9, RIM - 2), (CX2 - 3, 30), (CX2 + 3, 30), (CX2 + 9, RIM - 2)], T[3])
        c.rect(CX2 - 2, 34, CX2 + 1, RIM - 2, T[4])
        c.disc(CX2, 26, 22, T[2], 15); c.disc(CX2, 26, 16, T[3], 11)
        skull(c, CX2, 24, 4, T[4], T[0], T[1])
        return
    t = f - 4   # 0..3 drops arc over to the enemy side, pot fades
    fade(c, t >= 2, lambda cc: pot(cc), f)
    if t <= 1:
        c.dither(lambda cc: (cc.disc(CX2, 30 - t * 6, 22 + t * 6, T[1], 15 + t * 4), skull(cc, CX2, 28 - t * 6, 4, T[2], T[0])), f)
    for k, (dx, sp, vy, kind) in enumerate(DROPS):
        u = t + 1 - k % 3 * .35
        if u <= 0: continue
        x = CX2 + dx - u * 24 * sp; y = 30 + vy * 26 * u + u * u * 12
        if not (-4 < x < 132 and -4 < y < 132): continue
        if kind == 0: c.disc(x, y, 3, T[1]); c.disc(x - 1, y - 1, 2, T[3]); c.px(x - 1, y - 1, T[4])
        elif kind == 1: c.line([(x, y), (x + 4 * sp, y - 3)], T[2], 2); c.px(x, y, T[4])
        else: c.disc(x, y, 2, H[3]); c.px(x, y, H[5])
    for k in range(4):
        c.dither(lambda cc, k=k: puff(cc, CX2 - 20 + k * 13, RIM - 6 - t * 8 - k % 2 * 6, 6 + t, [H[1], H[2]]), k + f)


if __name__ == '__main__':
    make(KEY)

