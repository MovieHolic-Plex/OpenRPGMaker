"""달빛 — 64px 10칸. 위에서 초승달이 떠오르며 은빛 입자가 모이고 → 은빛 달빛 기둥이 내리꽂혀 발밑에 원형 달무늬와 충격파 → 기둥이 가늘어지며 은빛 깃털 같은 빛가루가 춤추며 사라짐."""
import math
from lib_druid import *

KEY = 'druid_moonbeam'; FRAME = 64; FRAMES = 10; ANCHOR = 'target'
PAL = Pal(M=MOON, L=LEAF[2:6], N=['#10142e'])
PEAK = [2, 4, 7]
_r = rng(KEY)
MOTES = [(_r.uniform(0, math.tau), _r.uniform(10, 22)) for _ in range(14)]
DUST = [(_r.uniform(-18, 18), _r.uniform(4, 50), _r.uniform(0, math.tau)) for _ in range(22)]


def crescent(c, x, y, r, lit, dark):
    c.disc(x, y, r, lit)
    c.disc(x + r * .45, y - r * .25, r * .85, 0)
    c.px(x - r * .6, y - r * .1, dark)


def column(c, w, top, cols):
    for i, col in enumerate(cols):
        ww = w * (1 - i / len(cols))
        if ww < .5: break
        c.rect(CX - ww, top, CX + ww - 1, GY, col)


def moon_rune(c, r, col, rot):
    c.ring(CX, GY, r, col, 1, r * .3)
    for k in range(6):
        a = rot + k * math.tau / 6
        x, y = orbit(CX, GY, r, a, r * .3)
        c.px(x, y - 1, col)
        c.px(x, y + 1, col)


def draw(c, f):
    M, L = PAL.M, PAL.L
    if f <= 1:   # crescent rises high, motes converge on it
        y = [14, 9][f]
        c.dither(lambda cc: cc.disc(CX, y, 12, M[0]), f)
        c.disc(CX, y, 9, M[0])
        crescent(c, CX, y, 7 + f, M[3], M[2])
        converge(c, CX, y, MOTES, (f + 1) / 2.4, M[2], M[4], tail=2)
        c.dither(lambda cc: cc.rect(CX - 3, y + 8, CX + 2, GY, M[0]), f)
        moon_rune(c, 12 + f * 4, M[1], f * .3)
        return
    if f == 2:   # beam slams down
        c.disc(CX, 8, 12, M[1]); crescent(c, CX, 8, 9, M[4], M[2])
        column(c, 12, 8, [M[1], M[2], M[3], M[4]])
        c.disc(CX, GY, 26, M[2], 7); c.disc(CX, GY, 18, M[3], 5); c.disc(CX, GY, 10, M[4], 3)
        rays(c, CX, GY - 2, 10, 14, 30, M[3], rot=math.pi, ry=.45, alt=22)
        return
    t = f - 3   # 0..6 : beam holds and narrows, rune spins, dust dances
    w = [10, 9, 7, 5, 3, 2, 1][t]
    moon_rune(c, 20 + t * 1.5, M[2] if t < 3 else M[1], t * .35)
    if t <= 2:
        c.ring(CX, GY, [26, 30, 32][t], M[3] if t == 0 else M[1], 2 if t == 0 else 1, [26, 30, 32][t] * .3)
    fade(c, t >= 5, lambda cc: (cc.disc(CX, 6, 10 - t, M[1]), crescent(cc, CX, 6, 8 - t * .6, M[3], M[2]),
                                column(cc, w + 1, 6, [M[0], M[1], M[2], M[3], M[4]] if t < 3 else [M[0], M[1], M[2]])), f)
    if t <= 1: c.disc(CX, GY - 2, 8 - t * 2, M[4], 3)
    for k, (x, y, ph) in enumerate(DUST):
        yy = GY - y - t * 3 + math.sin(ph + t) * 2
        xx = CX + x * (.5 + t * .12) + math.sin(ph + t * 1.3) * 3
        if yy < 1 or (t >= 4 and (k + f) % 2): continue
        col = M[4] if k % 5 == 0 else M[3] if k % 2 else L[3] if k % 7 == 1 else M[2]
        if k % 4 == 0 and t < 5: c.spark(xx, yy, 1, col)
        else: c.px(xx, yy, col)


if __name__ == '__main__':
    make(KEY)

