"""대치유 화면 층 — 128px 8칸. 무대 위쪽에 거대한 빛의 원환이 열림 → 회전하며 부챗살 빛을 아래로 → 줄어들며 사라짐. cleric_mass_heal 과 같은 HOLY + HEAL."""
import math
from lib_mage import *

KEY = 'cleric_halo'; FRAME = 128; FRAMES = 8; ANCHOR = 'screen'
PAL = Pal(H=HOLY, G=HEAL[2:5])
PEAK = [2, 4, 6]
CX, CY = 64, 24


def halo(c, r, rot, f, bright):
    H, G = PAL.H, PAL.G
    ry = r * .3
    c.ring(CX, CY, r + 3, H[1], 1, ry + 1)
    c.ring(CX, CY, r, H[3] if bright else H[2], 3, ry)
    c.ring(CX, CY, r - 1, H[5] if bright else H[4], 1, ry - 1)
    c.ring(CX, CY, r - 7, H[2], 1, ry - 2)
    for k in range(16):   # rune ticks between the two rings
        a = rot + k * math.tau / 16
        x0, y0 = orbit(CX, CY, r - 3, a, ry - 1)
        c.px(x0, y0, G[2] if k % 4 == 0 else H[4])
    for k in range(4):
        x, y = orbit(CX, CY, r, rot * 1.5 + k * math.pi / 2, ry)
        c.spark(x, y, 3 if bright else 2, H[5], diag=bright)


def fan(c, r, f, n, reach):
    H, G = PAL.H, PAL.G
    for k in range(n):
        a = math.pi * (.14 + .72 * k / (n - 1))
        x0, y0 = orbit(CX, CY, r * .9, a, r * .27)
        x1, y1 = orbit(CX, CY, reach, a, reach)
        col = [H[3], G[1], H[4], G[0]][(k + f) % 4]
        c.line([(x0, y0), (x1, y1)], col, 2 if (k + f) % 3 == 0 else 1)


def draw(c, f):
    H = PAL.H
    r = [8, 26, 42, 46, 46, 44, 36, 22][f]
    rot = f * .35
    if f == 0:
        c.spark(CX, CY, 6, H[5], diag=True); c.ring(CX, CY, 8, H[3], 1, 3)
        return
    if 2 <= f <= 6:
        reach = [0, 0, 90, 120, 130, 120, 90][f]
        if f >= 5: c.dither(lambda cc: fan(cc, r, f, 13, reach), f)
        else: fan(c, r, f, 13, reach)
    if f == 2:
        c.disc(CX, CY, r * .6, H[4], r * .16); c.disc(CX, CY, r * .35, H[5], r * .09)
    halo(c, r, rot, f, bright=(f in (2, 3)))
    if f >= 3:  # motes drifting down from the halo
        for k in range(10):
            x = 20 + k * 9 + (k % 3) * 2; y = CY + 10 + ((k * 13 + f * 11) % 90)
            c.px(x, y, PAL.G[2] if k % 2 else H[4])
            if (k + f) % 4 == 0: c.spark(x, y, 1, H[5])


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=6, B=6, L=6, R=6)


if __name__ == '__main__':
    make(KEY)

