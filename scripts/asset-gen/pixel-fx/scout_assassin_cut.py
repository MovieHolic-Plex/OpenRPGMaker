"""scout_assassin_cut: 암살 (필살기 배경). A dark diagonal night band with a crescent moon, one screen-wide cut, a cross cut, and the band splitting apart in crimson petals.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_assassin_cut', 128, 12, 'screen'
PAL = pal(SHADOW, CRIMSON, pick(STEEL, 's2'), WHITE)
A = (124, 10)
B = (4, 118)
L = math.hypot(B[0] - A[0], B[1] - A[1])
UX, UY = (B[0] - A[0]) / L, (B[1] - A[1]) / L
NX, NY = -UY, UX
MID = ((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)
MOON = (A[0] + UX * L * 0.28, A[1] + UY * L * 0.28)


def at(t, o=0.0):
    return (A[0] + UX * L * t + NX * o, A[1] + UY * L * t + NY * o)


def band(c, hw, k, t0=0.0, t1=1.0, shift=0.0):
    c.poly([at(t0, shift - hw), at(t1, shift - hw), at(t1, shift + hw), at(t0, shift + hw)], k)


def band_pair(c, hw, gap, keys):
    for side in (-1, 1):
        for k, w in keys:
            c.poly([at(0, side * gap), at(1, side * gap), at(1, side * (gap + w * hw)), at(0, side * (gap + w * hw))], k)


def moon(c, r=11):
    c.dring(MOON[0], MOON[1], r + 4, 'v')
    c.disc(MOON[0], MOON[1], r, 'l')
    c.disc(MOON[0] - 1, MOON[1] - 1, r - 1, 'w')
    c.disc(MOON[0] + 5, MOON[1] - 3, r - 1, 'k')


def petals(c, n, dist, drop, seed, size=2):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = dist * r.uniform(0.6, 1.1)
        x, y = MID[0] + math.cos(a) * d, MID[1] + math.sin(a) * d * 0.8 + drop * r.uniform(0.5, 1.2)
        k = 'r1' if i % 3 else 'r2'
        c.diamond(x, y, size, size + 1, k)
        c.px(x, y - size, 'r0' if i % 2 else 'w')


def draw(c, f):
    if f == 0:
        band(c, 3, 'd', 0.3, 0.7)
        band(c, 1, 'k', 0.35, 0.65)
        c.spark(MID[0], MID[1], 3, 'l', 'v')
    elif f == 1:
        band(c, 16, 'd')
        band(c, 12, 'k')
        moon(c, 9)
    elif f == 2:
        band(c, 20, 'd')
        band(c, 16, 'k')
        c.line([at(0, -20), at(1, -20)], 'm')
        c.line([at(0, 20), at(1, 20)], 'm')
        for i in range(7):
            x, y = at(0.1 + i * 0.13, (i % 3 - 1) * 9)
            c.spark(x, y, 1, 'l')
        moon(c)
        c.spark(A[0] - 6, A[1] + 6, 5, 'w', 'l', diag=True)
    elif f == 3:
        band(c, 20, 'd')
        band(c, 16, 'k')
        moon(c)
        c.line([at(0.02), at(0.98)], 'r1', 5)
        c.line([at(0.0), at(1.0)], 'r2', 3)
        c.line([at(0.0), at(1.0)], 'w', 1)
        c.spark(MID[0], MID[1], 8, 'w', 'r2')
    elif f == 4:
        band(c, 20, 'd')
        band(c, 16, 'k')
        moon(c)
        c.blade(A, B, 20, 14, ['r0', 'r1', 'r2', 'w'])
        c.spark(B[0] + 8, B[1] - 8, 9, 'w', 'r2', diag=True)
    elif f == 5:
        band(c, 20, 'd')
        band(c, 16, 'k')
        c.blade(A, B, 20, 18, ['r1', 'r2', 'w'])
        c.ring(MID[0], MID[1], 20, 'w', 2)
        c.rays(MID[0], MID[1], 16, 24, 44, 'l', rot=0.1, jitter=[1, 0.8, 0.95, 0.7])
        c.disc(MID[0], MID[1], 7, 'w')
    elif f == 6:
        band(c, 20, 'd')
        band(c, 16, 'k')
        c.blade(A, B, 20, 5, ['r1', 'w'])
        c.blade((10, 18), (118, 110), -16, 10, ['r0', 'r1', 'r2', 'w'], frac=0.8)
        c.ring(MID[0], MID[1], 30, 'r2', 1)
        petals(c, 10, 22, 0, 1)
    elif f == 7:
        band_pair(c, 20, 3, [('d', 1.0), ('k', 0.75)])
        c.line([at(0), at(1)], 'r2', 1)
        c.blade((10, 18), (118, 110), -16, 6, ['r1', 'w'])
        c.ring(MID[0], MID[1], 38, 'r1', 2)
        petals(c, 18, 36, 0, 2)
        moon(c, 10)
    elif f == 8:
        band_pair(c, 18, 8, [('d', 1.0), ('k', 0.6)])
        c.line([(10, 18), (118, 110)], 'r1', 1)
        c.dring(MID[0], MID[1], 46, 'r1')
        petals(c, 18, 44, 8, 3)
        moon(c, 10)
    elif f == 9:
        band_pair(c, 14, 14, [('d', 1.0), ('k', 0.4)])
        c.dring(MID[0], MID[1], 52, 'r0')
        petals(c, 16, 50, 16, 4)
    elif f == 10:
        for side in (-1, 1):
            for i in range(7):
                x, y = at(0.06 + i / 7, side * 26)
                c.dring(x, y, 5, 'd', parity=i)
                c.disc(x, y, 1.5, 'd')
        petals(c, 12, 54, 26, 5, 1)
    elif f == 11:
        petals(c, 8, 56, 34, 6, 1)
        c.spark(MID[0], MID[1], 4, 'w', 'l')


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=12, B=12, L=12, R=12)


if __name__ == '__main__':
    run(globals())

