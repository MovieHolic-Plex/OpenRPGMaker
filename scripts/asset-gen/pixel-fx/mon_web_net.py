"""mon_web_net: 거미줄 (착탄). The silk wad bursts into a radial web over the ally, then tightens into sticky bands around the body.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_web_net', 64, 8, 'target'
PAL = pal(SILK, pick(TOXV, 'u1', 'u2', 'u3'), WHITE)
WX, WY = CX, CY - 3
SPOKES = [i * math.pi / 4 + 0.2 for i in range(8)]


def web(c, R, rings, k_spoke, k_ring, sag=1.5, sq=0.9):
    tips = []
    for a in SPOKES:
        tip = pol(WX, WY, R, a, sq)
        c.line([(WX, WY), tip], k_spoke)
        tips.append(tip)
    for j in range(1, rings + 1):
        r = R * j / (rings + 0.6)
        pts = [pol(WX, WY, r, a, sq) for a in SPOKES]
        for i in range(8):
            p0, p1 = pts[i], pts[(i + 1) % 8]
            m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
            dx, dy = WX - m[0], WY - m[1]
            L = math.hypot(dx, dy) or 1
            m = (m[0] + dx / L * sag, m[1] + dy / L * sag)       # threads sag toward the hub
            c.line([p0, m, p1], k_ring)
    return tips


def bands(c, parity=None):
    for i, y in enumerate((WY - 5, WY + 3, WY + 10)):
        pts = [(WX - 13 + j * 2, y + math.sin(j * 0.9 + i) * 1.2 + (j - 6) * 0.25) for j in range(14)]
        if parity is None:
            c.line(pts, 'k1', 2)
            c.line([(x, y - 1) for x, y in pts], 'k3')
        else:
            for j, (x, y) in enumerate(pts):
                if (j + parity) % 2 == 0:
                    c.px(x, y, 'k2')


def draw(c, f):
    if f == 0:
        c.disc(WX - 7, WY, 5, 'k1')
        c.disc(WX - 8, WY - 1, 3, 'k3')
        for a in SPOKES:
            c.line([pol(WX - 7, WY, 5, a), pol(WX - 7, WY, 9, a)], 'k2')
        c.spark(WX - 5, WY, 3, 'w', 'k3')
    elif f == 1:
        web(c, 11, 0, 'k2', 'k2')
        c.disc(WX, WY, 3, 'k2')
        c.px(WX - 1, WY - 1, 'w')
    elif f == 2:
        web(c, 20, 1, 'k2', 'k1')
        web(c, 11, 0, 'k3', 'k3')
        c.disc(WX, WY, 2, 'k3')
    elif f == 3:
        tips = web(c, 25, 3, 'k2', 'k2', sag=2)
        for x, y in tips:
            c.spark(x, y, 2, 'w', 'k3')
        c.disc(WX, WY, 2, 'u2')
        c.px(WX, WY, 'u3')
        for j in (1, 2, 3):
            x, y = pol(WX, WY, 25 * j / 3.6, SPOKES[j * 2], 0.9)
            c.px(x, y, 'w')
    elif f == 4:
        web(c, 18, 2, 'k1', 'k1', sag=2.5, sq=0.85)
        bands(c)
        for x, y in ((WX - 11, WY - 5), (WX + 12, WY + 3), (WX - 9, WY + 10)):
            c.disc(x, y, 1, 'u2')
    elif f == 5:
        for a in SPOKES:
            c.dline((WX, WY), pol(WX, WY, 21, a, 0.85), 'k1')
        bands(c)
        for x, y in ((WX + 11, WY - 5), (WX - 12, WY + 3)):
            c.disc(x, y, 1, 'u3')
    elif f == 6:
        bands(c)
        for x, y in ((WX - 14, WY + 12), (WX + 13, WY - 7), (WX + 3, WY + 12)):
            c.line([(x, y), (x, y + 3)], 'k1')
            c.px(x, y + 4, 'u2')
    else:
        bands(c, parity=0)
        c.px(WX - 14, WY + 16, 'u2')


if __name__ == '__main__':
    run(globals())

