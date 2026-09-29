"""별빛 폭풍 화면 층 — 128px 12칸. 위에서 밤하늘 돔이 열리고 → 균열 속 성운 폭발·빛살 → 별똥별이 칸 전체를 가로질러 적진(왼쪽 아래)으로 쏟아짐 → 돔이 닫히며 잔별. mage_star_hit 와 같은 STAR 팔레트."""
import math, random
from lib_mage import *

KEY = 'mage_starfall_sky'; FRAME = 128; FRAMES = 12; ANCHOR = 'screen'
PAL = Pal(N=NIGHT, S=STAR, A=ARCANE[2:4])
PEAK = [3, 6, 9]
_r = random.Random(41)
BG_STARS = [(_r.randint(4, 123), _r.randint(2, 70), _r.randint(0, 3)) for _ in range(46)]
FALLERS = [(_r.uniform(30, 190), _r.uniform(-60, 20), _r.uniform(.85, 1.3), _r.randint(0, 2), _r.randint(4, 9), _r.randint(0, 3)) for _ in range(22)]
CX, TOP = 64, -6


def dome(c, f, h):
    """Night-sky dome hanging from the top; bands darken toward the zenith, rim is dithered afterglow."""
    N = PAL.N
    if h <= 0: return
    rx = 62
    c.dither(lambda cc: cc.disc(CX, TOP, rx + 2, N[2], h + 5), f)
    c.disc(CX, TOP, rx, N[2], h)
    c.disc(CX, TOP, rx - 6, N[1], h * .8)
    c.disc(CX, TOP, rx - 14, N[0], h * .58)
    for x, y, k in BG_STARS:
        if ((x - CX) / rx) ** 2 + ((y - TOP) / h) ** 2 > .82: continue
        tw = (x * 3 + f * 5 + k) % 7
        col = PAL.S[4] if tw == 0 else PAL.S[2] if k == 0 else N[3]
        c.px(x, y, col)
        if k == 1 and tw < 2: c.spark(x, y, 1, PAL.S[3])


def rift(c, w):
    S, A = PAL.S, PAL.A
    cx, cy = 64, 22
    c.disc(cx, cy, w + 6, A[0], (w + 6) * .35)
    c.disc(cx, cy, w + 2, A[1], (w + 2) * .3)
    c.disc(cx, cy, w, S[6], w * .25)
    c.disc(cx, cy, w * .7, S[3], w * .17)
    c.disc(cx, cy, w * .4, S[4], w * .1)


def comet(c, x, y, ln, kind):
    S = PAL.S
    dx, dy = 1.0, -0.8   # tail up-right; heads fall toward the enemy side (lower left)
    tail = S[5] if kind == 0 else S[6] if kind == 1 else S[2]
    c.line([(x, y), (x + dx * ln * 2.4, y + dy * ln * 2.4)], S[1])
    c.line([(x, y), (x + dx * ln * 1.5, y + dy * ln * 1.5)], tail, 2)
    c.line([(x, y), (x + dx * ln * .6, y + dy * ln * .6)], S[3])
    c.star5(x, y, 3 + (ln > 7), S[2], rot=x * .1)
    c.px(x, y, S[4])


def draw(c, f):
    S = PAL.S
    h = [20, 40, 58, 66, 70, 72, 72, 72, 70, 62, 46, 26][f]
    dome(c, f, h)
    if 2 <= f <= 6:
        rift(c, [0, 0, 12, 32, 28, 22, 14][f])
        if f == 3:
            for k in range(11):
                a = math.pi * (.05 + k * .09)
                ln = 76 if k % 2 else 58
                c.line([(64, 22), orbit(64, 22, ln, a)], S[3] if k % 2 else S[6])
    if f >= 4:
        t = f - 4
        for x0, y0, sp, kind, ln, delay in FALLERS:
            if t < delay: continue
            u = t - delay
            x = x0 - u * 17 * sp; y = y0 + 24 + u * 15 * sp
            if -12 < x < 140 and -12 < y < 132: comet(c, x, y, ln, kind)
            elif y >= 128 and u < 7:  # landed: a burst on the floor line
                pass
    if f >= 8:  # big finale comets sweep the whole cell
        for k in range(2):
            x = 118 - (f - 8) * 26 - k * 22; y = 14 + (f - 8) * 24 + k * 18
            comet(c, x, y, 13, k)
            c.spark(x, y, 6, S[3], diag=True)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=14, B=12, L=12, R=12)


if __name__ == '__main__':
    make(KEY)

