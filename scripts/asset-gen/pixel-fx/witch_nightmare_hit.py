"""악몽(적 전체 층) — 64px 8칸. 해골 유령이 위에서 덮치며 → 대상 머리 위로 보라 소용돌이와 핏빛 섬광, 몸을 관통 → 잠든 채 보라 연기와 Z 대신 해골 거품이 떠오르며 사라짐. witch_nightmare_sky 와 같은 HEX·BLOOD 팔레트."""
import math
from lib_druid import *

KEY = 'witch_nightmare_hit'; FRAME = 64; FRAMES = 8; ANCHOR = 'allTargets'
PAL = Pal(H=HEX, R=BLOOD, I=IRON[:2])
PEAK = [1, 3, 5]
_r = rng(KEY)
MOTES = [(_r.uniform(0, math.tau), _r.uniform(6, 22)) for _ in range(14)]


def phantom(c, x, y, s, f):
    H, R = PAL.H, PAL.R
    c.disc(x, y, 7 * s + 1, H[1]); c.disc(x, y, 7 * s, H[3])
    c.poly([(x - 7 * s, y), (x + 7 * s, y), (x + 5 * s, y - 14 * s), (x + 1, y - 22 * s), (x - 3 * s, y - 14 * s)], H[2])
    c.disc(x - 1, y - 1, 4 * s, H[4])
    c.rect(x - 4 * s, y - 1, x - 2 * s, y + 1, H[0]); c.rect(x + 2 * s, y - 1, x + 4 * s, y + 1, H[0])
    c.px(x - 3 * s, y, R[2]); c.px(x + 3 * s, y, R[2])
    c.rect(x - 2 * s, y + 4 * s, x + 2 * s, y + 5 * s, H[0])


def draw(c, f):
    H, R, I = PAL.H, PAL.R, PAL.I
    if f == 0:
        phantom(c, CX + 10, 18, 1.1, f)
        for k in range(4): c.px(CX + 16 + k * 3, 6 - k * 2, H[3])
        return
    if f == 1:   # dives through
        c.dither(lambda cc: phantom(cc, CX + 6, 22, 1.2, f), f)
        phantom(c, CX, CY - 4, 1.4, f)
        c.ring(CX, CY - 4, 16, H[4], 1, 12)
        return
    if f == 2:
        rays(c, CX, CY - 2, 12, 8, 30, H[4], alt=20)
        c.disc(CX, CY - 2, 18, H[2]); c.disc(CX, CY - 2, 13, H[3]); c.disc(CX, CY - 2, 8, R[2]); c.disc(CX, CY - 2, 4, H[6])
        return
    t = f - 3   # 0..4 : vortex over the head, sleep bubbles
    vy = CY - 18
    for k in range(3):
        r = (14 - k * 4) * (1 - t * .12)
        c.arc(CX, vy, r, t * 80 + k * 120, t * 80 + k * 120 + 220, H[2 + k], 2 if k == 0 else 1, r * .45)
    if t <= 1:
        c.disc(CX, CY - 2, 8 - t * 3, R[1]); c.disc(CX, CY - 2, 5 - t * 2, R[2])
        c.ring(CX, CY - 2, 22 + t * 6, R[2] if t == 0 else H[3], 1, 18 + t * 5)
    for k in range(4):
        x = CX - 14 + k * 9; y = CY + 6 - t * 3 - (k % 2) * 5
        c.dither(lambda cc, x=x, y=y: puff(cc, x, y, 4 + t * .5, [H[1], H[2], I[1]]), k + f)
    for k in range(3):   # skull bubbles rising like Zs
        y = CY - 22 - t * 4 - k * 7
        if y < 2 or k > t: continue
        x = CX + 10 + k * 5 + math.sin(t + k) * 2
        skull(c, x, y, 1, H[4] if k % 2 else H[5], H[0], H[1])
    for a, r in MOTES:
        x, y = orbit(CX, CY - 4, r + t * 3, a + t * .5, (r + t * 3) * .8)
        if (round(a * 5) + t) % 3: c.px(x, y, H[4] if round(a * 3) % 2 else R[2])


if __name__ == '__main__':
    make(KEY)

