"""개구리 변신 — 64px 10칸. 보라 반짝이가 나선으로 감기고 → 펑! 분홍보라 연기 폭발과 별 → 연기 속에서 초록 개구리가 나타나 개굴(말풍선 대신 음표 모양 거품) → 연기가 걷히며 개구리가 한 번 뛰어 사라지는 잔광."""
import math
from lib_druid import *

KEY = 'witch_frog_puff'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(H=HEX, T=TOXIC, P=['#ff8ae0', '#ffd4f4'])
PEAK = [3, 5, 7]
_r = rng(KEY)
PUFFS = [(k * math.tau / 9 + _r.uniform(-.2, .2), _r.uniform(.8, 1.2)) for k in range(9)]
STARS = [(_r.uniform(0, math.tau), _r.uniform(14, 26)) for _ in range(8)]


def frog(c, x, y, s, blink=False, hop=0):
    H, T = PAL.H, PAL.T
    y -= hop
    c.disc(x, y, 7 * s + 1, T[0], 5 * s + 1)
    c.disc(x, y, 7 * s, T[2], 5 * s)
    c.disc(x - 1, y - 1, 5 * s, T[3], 3 * s)
    c.disc(x, y + 2 * s, 5 * s, T[4], 2 * s)
    for sg in (-1, 1):   # eyes
        c.disc(x + sg * 4 * s, y - 5 * s, 2.5 * s + .5, T[0]); c.disc(x + sg * 4 * s, y - 5 * s, 2 * s, T[4])
        if blink: c.line([(x + sg * 4 * s - 1, y - 5 * s), (x + sg * 4 * s + 1, y - 5 * s)], T[0])
        else: c.px(x + sg * 4 * s, y - 5 * s, H[0])
        c.rect(x + sg * 6 * s - 1, y + 4 * s, x + sg * 6 * s + 1, y + 5 * s, T[1])   # feet
    c.line([(x - 3 * s, y + 1), (x + 3 * s, y + 1)], T[0])   # mouth


def smoke(c, r, cols, f, dith=False):
    for k, (a, s) in enumerate(PUFFS):
        if dith and k % 3 == 1: continue
        x, y = orbit(CX, CY + 2, r * s, a + f * .15, r * s * .75)
        rr = 6 * s + r * .15 - (r - 20) * .35 * dith
        fn = lambda cc, x=x, y=y, rr=rr: puff(cc, x, y, rr, cols)
        fade(c, dith, fn, k + f)


def draw(c, f):
    H, T, P = PAL.H, PAL.T, PAL.P
    if f <= 2:   # glitter spiral
        for k in range(16):
            a = k * .7 + f * 1.3
            r = 24 - k * 1.2 - f * 3
            if r < 2: continue
            x, y = orbit(CX, CY, r, a, r * .9)
            c.px(x, y, P[1] if k % 3 == 0 else H[4])
            if k % 4 == 0: c.spark(x, y, 2, P[0], P[1])
        c.glow(CX, CY, 3 + f * 3, [H[3], P[0], P[1]])
        return
    if f == 3:   # POOF
        for a, r in STARS: c.star5(*orbit(CX, CY, r, a), 3, P[1], rot=a)
        c.disc(CX, CY, 22, H[4]); c.disc(CX, CY, 17, P[0]); c.disc(CX, CY, 11, P[1]); c.disc(CX, CY, 6, H[6])
        return
    if f == 4:
        smoke(c, 14, [H[2], H[4], P[0]], f)
        for a, r in STARS: c.star5(*orbit(CX, CY, r + 6, a + .3), 3, P[0], rot=a + 1)
        c.disc(CX, CY + 2, 10, H[4]); c.disc(CX, CY + 2, 6, P[1])
        return
    t = f - 5   # 0..4 : smoke clears, frog revealed, croak, hop
    smoke(c, 16 + t * 3, [H[1], H[2], H[3]] if t < 2 else [H[1], H[2]], f, dith=t >= 2)
    hop = [0, 0, 0, 6, 12][t]
    frog(c, CX, GY - 6, 1.3 if t < 2 else 1.2, blink=t == 1, hop=hop)
    if t in (1, 2):   # croak bubbles
        for k in range(2 + t):
            bubble(c, CX + 12 + k * 4, GY - 20 - k * 6, 2 + k, T[3], T[4])
    if t >= 3:
        c.dither(lambda cc: cc.ring(CX, GY - 1, 10 + t * 3, T[2], 1, 3), f)
        for k in range(4): c.px(CX - 8 + k * 5, GY - 2 - hop * .5 - k % 2 * 3, P[1] if k % 2 else H[5])
    if t == 0:
        for a, r in STARS[:5]: c.spark(*orbit(CX, CY, r + 10, a + .6), 2, P[1])


if __name__ == '__main__':
    make(KEY)

