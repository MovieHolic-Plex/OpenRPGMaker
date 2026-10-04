"""class_hermit (은자) skill FX: bamboo shoots, mountain mist, waterfall, white crane, mountain sky.
Colour identity: bamboo green, ink-wash grey mist, waterfall blue/white, crane white with a red crown, stone slate.
Reused layers (not drawn here): mon_boulder, mon_rock_burst, monk_meditate, mon_spore_cloud, guard_quake.
Run this file to rebuild every hermit sheet and the review boards in .omo/r2w4/p5/."""
from lib_r2w4 import *

BAMB = dict(g0='#12301c', g1='#2e6a2e', g2='#6aae3a', g3='#c4e67a')
MIST = dict(m0='#1c2230', m1='#4e5a70', m2='#8e9ab0', m3='#ccd6e4')
FALLS = dict(h1='#2a5ca8', h2='#5eaaea', h3='#b8ecff')
CRANE = dict(c1='#e0402c', k0='#141418')
STONE = dict(s1='#5a5260', s2='#9a90a0')
P = pal(BAMB, MIST, FALLS, CRANE, STONE, WHITE)


def shoot(c, x, base, h, w=2.4):
    """Bamboo culm rising from base to base-h with node rings and a slanted cut tip."""
    if h <= 0:
        return
    top = base - h
    c.poly([(x - w, base), (x + w, base), (x + w, top + w * 1.4), (x - w, top)], 'g0')
    c.poly([(x - w + 0.8, base), (x + w - 0.8, base), (x + w - 0.8, top + w * 1.4), (x - w + 0.8, top + 0.8)], 'g2')
    c.line([(x - w + 1, base), (x - w + 1, top + 1.5)], 'g3')
    for y in range(int(base) - 6, int(top) + 2, -6):
        c.line([(x - w, y), (x + w, y)], 'g1')
    c.px(x - w + 1, top + 1, 'w')


@sheet('hermit_bamboo', 64, 10, 'target', P)
def bamboo(c, f):
    """죽순 솟구침: the ground cracks under the foe, three sharp bamboo culms spear up in turn, leaves scatter, then they sink."""
    t = f / 9
    c.line([(10, 57), (54, 57)], 's1')
    for j, (x, d) in enumerate(((32, 0), (22, 1), (43, 2))):
        if f < d:
            continue
        u = f - d
        h = [8, 26, 40, 38, 36][min(u, 4)] * (1 - max(0, f - 7) * 0.28) * (0.8 if j else 1)
        shoot(c, x, 58, h, 2.8 if j == 0 else 2.2)
        if u == 1:
            c.spark(x, 58 - h, 4, 'w', 'g3')
            burst(c, x, 57, 0.4, 8, j + 3, ['s2', 's1'], spd=(6, 12), grav=1.0, spread=(-3.0, -0.2))
    if 3 <= f <= 5:
        c.shock(32, 34, 8 + (f - 3) * 7, ['g1', 'g2', 'g3'], squash=0.8)
    if f >= 3:
        rr = rng(5)
        for i in range(8):
            ph = rr.uniform(0, 1)
            x = rr.uniform(14, 50)
            u = min(1.0, (f - 3) / 6 + ph * 0.3)
            c.leaf(x + math.sin(u * 5 + i) * 4, 14 + u * 36, u * 3 + i, 5, 'g2', 'g1')


@sheet('hermit_mist', 64, 10, 'allAllies', P)
def mist(c, f):
    """산안개: ink-wash mist bands roll in from both sides over the party, thicken into a dithered veil, then thin away."""
    t = f / 9
    thick = math.sin(min(1.0, t * 1.2) * math.pi) * 0.9 + 0.1
    for j in range(5):
        y = 16 + j * 9
        dir_ = 1 if j % 2 else -1
        off = ((f * 3 + j * 11) % 40) * dir_
        x0 = 32 - 26 * thick + off * 0.3
        x1 = 32 + 26 * thick + off * 0.3
        c.puff(x0 + 6, y, 4 + thick * 3, ['m1', 'm2', 'm3'], seed=j + f % 3, lobes=4)
        c.puff(x1 - 6, y + 2, 4 + thick * 3, ['m1', 'm2', 'm3'], seed=j + 5 + f % 3, lobes=4)
        c.line([(x0, y + 3), (x1, y + 3)], 'm2')
        for x in range(int(x0), int(x1)):
            for yy in range(y - 2, y + 3):
                if (x + yy + f) % (2 if thick > 0.7 else 3) == 0:
                    c.px(x, yy, 'm3' if yy < y else 'm2')
    if f >= 6:
        c.twinkles(t, 4, 2, 'w', 'm3', (10, 12, 54, 50))


@sheet('hermit_falls', 64, 10, 'target', P)
def falls(c, f):
    """폭포수: a torrent pours from the top edge onto the foe, a heavy white column with streaks, a splash crown at the base."""
    t = f / 9
    reach = min(58, 10 + f * 16)
    fade = f >= 7
    w = 11 if not fade else 11 - (f - 6) * 3
    if w > 0:
        c.rect(32 - w, 3, 32 + w, reach, 'h1')
        c.rect(32 - w + 2, 3, 32 + w - 2, reach, 'h2')
        rr = rng(4)
        for i in range(9):
            x = 32 - w + 2 + rr.uniform(0, 2 * w - 4)
            y0 = ((f * 9 + rr.uniform(0, 50)) % 50) + 3
            c.line([(x, y0), (x, min(reach, y0 + 8))], 'h3' if i % 2 else 'w')
    if reach >= 50:
        u = (f - 3) / 6
        c.crown(32, 56, max(0.05, u), 22, ['w', 'h3', 'h2'], n=18, seed=f // 3)
        c.oval(32, 56, 16 + u * 6, 3, 'h2')
        c.oval(32, 55, 10 + u * 4, 2, 'h3')
        if f in (3, 4):
            c.spark(32, 44, 6, 'w', 'h3')
    if f >= 7:
        c.rise(t, 8, 3, ['m3', 'h3', 'm2'], 12, 52, 54, 20, sway=2)


def crane(c, x, y, s, flap):
    """White crane diving LEFT-down: body, S-neck, red crown, wings at flap (-1 up .. 1 down)."""
    c.oval(x, y, 7 * s, 3.5 * s, 'm2')
    c.oval(x - 0.5, y - 0.5, 6 * s, 2.8 * s, 'w')
    wy = -8 * s * (1 - flap) + 4 * s * flap
    for side, dx in ((0, 2), (1, -1)):
        tip = (x + 10 * s + dx, y + wy - side * 2)
        base = [(x - 3 * s, y - 1), (x + 5 * s, y - 1)]
        c.poly([base[0], tip, (tip[0] + 4 * s, tip[1] + 3 * s), base[1]], 'm3' if side else 'w')
        c.line([tip, (tip[0] + 4 * s, tip[1] + 3 * s)], 'k0')
    hx, hy = x - 11 * s, y + 3 * s
    c.line([(x - 5 * s, y), (x - 8 * s, y - 3 * s), (hx, hy)], 'w', 2)
    c.disc(hx, hy, 1.6 * s, 'w')
    c.px(hx, hy - 1.4 * s, 'c1')
    c.line([(hx - 1, hy + 1), (hx - 5 * s, hy + 3 * s)], 's2')
    c.line([(x + 7 * s, y), (x + 11 * s, y + 1)], 'k0')


@sheet('hermit_crane', 64, 10, 'target', P)
def crane_dive(c, f):
    """학의 날갯짓: a white crane glides in from the upper right, beats its wings once, dives through the foe, a wind slash follows."""
    t = f / 9
    if f <= 4:
        path = [(58, 10), (50, 16), (42, 22), (36, 28), (30, 33)]
        x, y = path[f]
        flap = [-0.6, 1, -0.8, 0.4, 1][f]
        for j in range(3):
            c.line([(x + 10 + j * 5, y - 6 + j * 2), (x + 18 + j * 5, y - 8 + j * 2)], 'm2')
        crane(c, x, y, 1.0, flap)
        if f == 4:
            c.spark(22, 36, 5, 'w', 'h3')
    else:
        u = (f - 5) / 4
        c.blade((56, 10), (8, 50), 8, 4 - u * 2.5, ['m2', 'm3', 'w'][: 3 - int(u * 2)])
        c.blade((50, 20), (14, 56), -6, 3 - u * 2, ['m2', 'w'])
        rr = rng(2)
        for i in range(7):
            a = rr.uniform(2.3, 4.0)
            d = 6 + u * rr.uniform(12, 26)
            c.feather(30 + math.cos(a) * d, 34 + math.sin(a) * d * 0.7 + u * 6, a + u * 2, 6, 'w', 'm2', 'm1')
        if f == 5:
            c.shock(28, 36, 12, ['m1', 'm2', 'w'], squash=0.7)


@sheet('hermit_mountain_sky', 128, 12, 'screen', pal(pick(BAMB, 'g1', 'g2'), MIST, pick(FALLS, 'h2', 'h3'), CRANE, STONE, WHITE))
def mountain_sky(c, f):
    """산의 노래: the stage dims into an ink-wash landscape, jagged peaks rise from the bottom, mist bands drift, a crane crosses the sun."""
    t = f / 11
    dark = min(1, t * 3) if f < 10 else max(0, 1 - (f - 9) / 2)
    shade(c, 64, 64, 30 + 34 * dark, 'm0')
    g = ease(min(1.0, (f + 1) / 6))
    c.disc(84, 34, 9, 'c1')
    c.disc(83, 33, 7, 'c1')
    peaks = [(30, 60, 'm1'), (98, 56, 'm1'), (64, 74, 'm2'), (44, 46, 's1'), (84, 42, 's1')]
    base = 102
    for x, h, k in peaks:
        hh = h * g
        c.poly([(x - h * 0.62, base), (x - 4, base - hh + 5), (x, base - hh), (x + 5, base - hh + 7), (x + h * 0.66, base)], k)
        c.poly([(x, base - hh), (x + 5, base - hh + 7), (x + 1, base - hh + 11), (x - 4, base - hh + 5)], 'm3')
        c.line([(x, base - hh), (x - 4, base - hh + 5)], 'w')
    for j in range(3):
        y = 70 + j * 11
        off = (f * 5 + j * 13) % 30 - 15
        x0, x1 = 20 + off, 108 + off
        for yy in range(y - 2, y + 3):
            for xx in range(int(x0), int(x1)):
                if (xx + yy + j) % (2 if abs(yy - y) < 2 else 4) == 0:
                    c.px(xx, yy, 'm3' if yy <= y else 'm2')
    if f >= 5:
        u = (f - 5) / 6
        x, y = 108 - u * 84, 30 + math.sin(u * 3) * 4
        c.line([(x - 5, y), (x - 1, y - 1), (x + 5, y - 5 + (f % 2) * 6)], 'w', 2)
        c.line([(x - 1, y - 1), (x + 3, y + 3 - (f % 2) * 6)], 'w', 2)
        c.px(x - 6, y, 'c1')
    if f >= 7:
        c.fall(t, 10, 5, ['g2', 'g1'], 20, 108, 20, 100, drift=-10)
        c.twinkles(t, 6, 3, 'w', 'h3', (20, 16, 108, 70), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'hermit_', 'people5-6', sys.argv[1:] or None) else 0)
