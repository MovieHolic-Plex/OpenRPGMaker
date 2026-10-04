"""독 가마솥(적 전체 층) — 64px 8칸. 독 방울이 위에서 떨어져 → 철퍽 튀며 독녹색 섬광·방울 왕관 → 몸에 독 웅덩이·거품이 끓고 해골 연기가 피어올라 사라짐. witch_cauldron 과 같은 TOXIC·HEX 팔레트."""
import math
from lib_druid import *

KEY = 'witch_poison_hit'; FRAME = 64; FRAMES = 8; ANCHOR = 'allTargets'
PAL = Pal(T=TOXIC, H=HEX[:6], I=IRON[:2])
PEAK = [1, 3, 5]
_r = rng(KEY)
SPLASH = [(-math.pi * (k + .5) / 10 + _r.uniform(-.12, .12), _r.uniform(2.8, 4.6)) for k in range(10)]
BUB = [(_r.uniform(-18, 18), _r.uniform(-18, 10), _r.randint(1, 3)) for _ in range(14)]


def drop(c, x, y, r):
    T = PAL.T
    c.disc(x, y, r + 1, T[0]); c.poly([(x - r, y), (x, y - r * 2.4), (x + r, y)], T[0])
    c.disc(x, y, r, T[2]); c.poly([(x - r + 1, y), (x, y - r * 2), (x + r - 1, y)], T[2])
    c.px(x - 1, y - 1, T[4])


def draw(c, f):
    T, H, I = PAL.T, PAL.H, PAL.I
    if f == 0:
        drop(c, CX, 12, 4); drop(c, CX - 12, 4, 3); drop(c, CX + 10, 0, 2)
        c.line([(CX, 2), (CX, 6)], T[3])
        return
    if f == 1:   # splat
        c.disc(CX, CY - 4, 20, T[2], 16); c.disc(CX, CY - 4, 14, T[3], 11); c.disc(CX, CY - 4, 7, T[4], 6)
        rays(c, CX, CY - 4, 10, 10, 28, T[3], rot=.15)
        drop(c, CX - 14, 12, 3)
        return
    t = f - 2   # 0..5
    # puddle on the ground
    w = [16, 22, 24, 24, 22, 18][t]
    fade(c, t >= 4, lambda cc: (cc.disc(CX, GY, w, T[0], 4), cc.disc(CX, GY - 1, w - 4, T[1], 3), cc.px(CX - w + 6, GY - 2, T[3])), f)
    if t <= 2:   # crown of droplets
        for k, (a, v) in enumerate(SPLASH):
            e = t + 1
            x = CX + math.cos(a) * v * e * 3.2; y = CY - 2 + math.sin(a) * v * e * 3 + e * e * 1.6
            if y > GY: continue
            c.disc(x, y, 2 - (e > 2), T[2]); c.px(x, y, T[4] if e < 3 else T[3])
        if t == 0:
            c.disc(CX, CY - 4, 10, T[2], 9); c.disc(CX, CY - 4, 5, T[4], 5)
            c.ring(CX, CY, 22, T[3], 2, 16)
        if t == 1: c.dither(lambda cc: cc.ring(CX, CY, 26, T[2], 2, 20), f)
    for k, (x, y, r) in enumerate(BUB):   # bubbles boil on the body
        if t < 1: break
        yy = CY + y - t * 3 - k % 3 * 2
        if (k + t) % 4 == 0: c.px(CX + x, yy, T[4])
        elif t < 5 or k % 2: bubble(c, CX + x, yy, r, T[3], T[4])
    if t >= 2:   # skull wisp rises
        u = t - 2
        fade(c, u >= 2, lambda cc: (cc.disc(CX, CY - 16 - u * 5, 9 + u, H[2], 7 + u), skull(cc, CX, CY - 17 - u * 5, 2, T[2] if u < 2 else H[4], H[0])), f)
        for k in range(3):
            c.dither(lambda cc, k=k: puff(cc, CX - 12 + k * 12, CY - 4 - u * 4 - k % 2 * 4, 4 + u * .5, [H[1], I[1]]), k + f)


if __name__ == '__main__':
    make(KEY)

