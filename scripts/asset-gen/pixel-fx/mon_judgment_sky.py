"""mon_judgment_sky: 암흑의 심판 (마왕 필살기 화면). The world goes black, a crimson eye-sigil opens in the sky,
a rotating magic circle unfolds, the pupil narrows, black-violet lightning spears fall on the allies' side (RIGHT)
in a crimson flash, then the circle shatters into cinders and the darkness lifts."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_judgment_sky', 128, 12, 'screen'
PAL = pal(DARK, CRIM, pick(SHADE, 'd0', 'd1'), WHITE)
PEAK = 7
CX, CY = 64, 40      # sigil in the sky
HX = 92              # strikes land on the allies' side


def darkness(c, full=False):
    shade(c, 64, 64, 52, 'v0', dense='d0')
    if full:
        for y in range(1, 128, 2):
            for x in range(y % 4 // 2, 128, 2):
                if (x + y) % 2 == 1:
                    c.px(x, y, 'd0')


def circle(c, r, rot, keys, sq=0.45, n=6):
    k0, k1 = keys[0], keys[-1]
    c.ring(CX, CY, r, k0, 1, squash=sq)
    c.ring(CX, CY, r - 4, k1, 1, squash=sq)
    pts = [pol(CX, CY, r - 4, rot + i * 2 * math.pi / n * 2, sq) for i in range(n + 1)]
    c.line(pts, k0)
    for i in range(n * 2):
        a = rot + i * math.pi / n
        x, y = pol(CX, CY, r - 2, a, sq)
        c.px(x, y, k1)


def eye(c, w, h, pupil, k_lid='c2', k_in='c1'):
    top = [(CX + w * math.cos(a), CY - h * math.sin(a)) for a in [i * math.pi / 12 for i in range(13)]]
    bot = [(CX + w * math.cos(a), CY + h * math.sin(a)) for a in [i * math.pi / 12 for i in range(13)]]
    c.poly(top + bot[::-1], k_in)
    c.line(top, k_lid, 2)
    c.line(bot, k_lid, 1)
    if pupil > 0:
        c.oval(CX, CY, max(1, pupil), max(1, h - 1), 'v0')
        c.px(CX - 1, CY - h // 2, 'c3')


def spear(c, x, seed, keys, top=None):
    return c.bolt((x - 10, top if top is not None else CY + 6), (x, 110), seed, keys, segs=6, jitter=4)


def draw(c, f):
    if f == 0:
        shade(c, 64, 64, 48, 'v0')
    elif f == 1:
        darkness(c)
        c.line([(CX - 10, CY), (CX + 10, CY)], 'c2')
        c.px(CX, CY, 'c3')
    elif f == 2:        # eye opens
        darkness(c, True)
        eye(c, 18, 4, 0)
        circle(c, 30, 0.0, ['v2', 'v3'])
    elif f == 3:
        darkness(c, True)
        circle(c, 40, 0.3, ['v2', 'c1'])
        eye(c, 20, 8, 5)
    elif f == 4:        # circle turns, pupil narrows
        darkness(c, True)
        circle(c, 46, 0.6, ['v3', 'c2'])
        circle(c, 30, -0.6, ['v2', 'v3'], n=5)
        eye(c, 20, 9, 2)
        converge(c, CX, CY, 0.7, 12, 4, ['v3', 'v5'], r0=50, r1=14, squash=0.45)
    elif f == 5:        # first spear
        darkness(c, True)
        circle(c, 46, 0.9, ['v3', 'c2'])
        eye(c, 20, 9, 1, 'c3')
        spear(c, HX, 5, ['v1', 'v3', 'v5'])
        c.ring(HX, 108, 10, 'c2', 1, squash=0.3)
    elif f == 6:
        darkness(c, True)
        circle(c, 46, 1.2, ['v3', 'c2'])
        eye(c, 20, 9, 1, 'c3')
        spear(c, HX - 18, 6, ['v1', 'v3', 'v5'])
        spear(c, HX + 12, 7, ['v1', 'c2', 'v5'])
        c.ring(HX - 6, 108, 18, 'c2', 1, squash=0.3)
    elif f == 7:        # PEAK: judgment falls in a crimson flash
        darkness(c)
        circle(c, 48, 1.5, ['c2', 'c3'])
        eye(c, 22, 10, 1, 'w', 'c2')
        for i, x in enumerate((HX - 24, HX - 6, HX + 14)):
            spear(c, x, 8 + i, ['v2', 'c2', 'v5', 'w'])
        c.oval(HX - 4, 108, 28, 7, 'c2')
        c.oval(HX - 4, 108, 20, 5, 'c3')
        c.oval(HX - 4, 108, 10, 2.5, 'w')
        pow_burst(c, HX - 4, 104, 14, ['c1', 'c3', 'v5', 'w'], rot=0.2)
    elif f == 8:
        darkness(c)
        circle(c, 50, 1.8, ['v3', 'c1'])
        eye(c, 22, 8, 2)
        for i, x in enumerate((HX - 20, HX + 6)):
            spear(c, x, 11 + i, ['v1', 'v3'])
        c.ring(HX - 4, 108, 30, 'c1', 2, squash=0.3)
        c.flame(HX - 4, 110, 26, 7, ['v1', 'c1', 'v3', 'v4'])
    elif f == 9:        # circle shatters
        shade(c, 64, 64, 50, 'v0')
        r = rng(9)
        for i in range(14):
            a = r.uniform(0, 2 * math.pi)
            x, y = pol(CX, CY, r.uniform(34, 56), a, 0.5)
            c.line([(x, y), (x + math.cos(a) * 4, y + math.sin(a) * 2)], 'c2' if i % 2 else 'v3')
        eye(c, 16, 4, 0, 'c1', 'v1')
        c.flame(HX - 4, 110, 16, 6, ['v1', 'c1', 'v3'])
    elif f == 10:
        shade(c, 64, 64, 46, 'v0')
        embers(c, CX + 10, CY + 30, 18, 10, 20, 44, ['v2', 'v4', 'c3'])
        c.line([(CX - 8, CY), (CX + 8, CY)], 'c1')
    else:
        embers(c, CX + 10, CY + 20, 14, 11, 26, 44, ['v1', 'v3'])
        c.dring(HX - 4, 108, 20, 'v2', squash=0.3)
    fade_oval(c, band=0.3)


if __name__ == '__main__':
    run(globals())

