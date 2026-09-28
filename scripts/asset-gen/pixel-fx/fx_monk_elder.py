"""class_monk_elder (노승) skill FX: incense, ringed staff, temple bell, lotus, lion roar, vajra, zen, nirvana.
Colour identity: incense lavender smoke, temple gold, saffron orange, lotus pink, white light.
Run this file to rebuild every monk_elder sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

SMOKE = dict(m0='#3a3450', m1='#6a6488', m2='#a49cc4', m3='#d8d2ec', m4='#f4f0fc')
GOLD = dict(g0='#6a4208', g1='#b87a14', g2='#f0b830', g3='#ffe680', g4='#fff8d0')
SAFF = dict(o0='#5a2208', o1='#b0480e', o2='#e8781a', o3='#ffae48')
LOTUS = dict(l0='#5a1440', l1='#c0407c', l2='#f078a8', l3='#ffc0d8', l4='#fff0f6')
GREEN = dict(v1='#2c7a3c', v2='#5cb45c')
P = pal(SMOKE, GOLD, SAFF, LOTUS, GREEN, WHITE)


def smoke_col(c, x, top, bot, t, seed, w=6, keys=('m1', 'm2', 'm3')):
    """A rising, swaying incense wisp made of overlapping puffs."""
    r = rng(seed)
    n = 6
    for i in range(n):
        u = (i / n + t) % 1.0
        y = lerp(bot, top, u)
        x0 = x + math.sin(u * 7 + seed) * w * (0.3 + u)
        rad = 1.0 + u * 2.4
        k = keys[min(len(keys) - 1, int(u * len(keys)))]
        c.disc(x0, y, rad, k)
        if u < 0.7:
            c.px(x0 - 1, y - 1, 'm4')


def bowl(c, x, y, s=1.0):
    c.oval(x, y, 9 * s, 3 * s, 'g0')
    c.poly([(x - 8 * s, y), (x + 8 * s, y), (x + 5 * s, y + 5 * s), (x - 5 * s, y + 5 * s)], 'g1')
    c.line([(x - 7 * s, y + 1), (x + 7 * s, y + 1)], 'g3')
    c.oval(x, y, 7 * s, 2 * s, 'm0')


def lotus(c, x, y, r, open_, keys=('l0', 'l1', 'l2', 'l3')):
    """Side-view lotus: back petals, front petals, centre glow. open_ 0..1."""
    n = 7
    for layer, (k, scale) in enumerate(((keys[1], 1.0), (keys[2], 0.85), (keys[3], 0.6))):
        for i in range(n):
            a = -math.pi / 2 + (i - (n - 1) / 2) * (0.5 + 0.35 * open_) * (1.0 - layer * 0.08)
            L = r * scale * (0.65 + 0.35 * open_)
            tip = pol(x, y, L, a, 0.95)
            base = (x + math.cos(a) * 1, y)
            w = 3.2 * scale * (0.5 + open_ * 0.6)
            vx, vy = -math.sin(a), math.cos(a)
            c.poly([(base[0] - vx * w, base[1] - vy * w * 0.3), tip, (base[0] + vx * w, base[1] + vy * w * 0.3)], keys[0])
            c.poly([(base[0] - vx * (w - 1), base[1]), pol(x, y, L - 1.2, a, 0.95), (base[0] + vx * (w - 1), base[1])], k)
    c.oval(x, y + 1, r * 0.9, 2.4, 'v1')
    c.disc(x, y - r * 0.25, 2 + open_ * 2, 'g3')
    c.px(x, y - r * 0.25, 'w')


@sheet('monk_elder_incense', 64, 10, 'allAllies', P)
def incense(c, f):
    """향불: an incense burner with three rising wisps that curl into a soft halo of calm."""
    t = f / 10
    bowl(c, 32, 50)
    c.px(28, 47, 'o3')
    c.px(32, 46, 'o3')
    c.px(36, 47, 'o3')
    for i, x in enumerate((28, 32, 36)):
        c.line([(x, 47), (x, 44)], 'o1')
        smoke_col(c, x, 6 + i * 3, 46, t, i + 1)
    if f >= 3:
        for i in range(3):
            c.arc(32, 30, 22 + i * 3, 200 + (f * 18 + i * 60) % 360, 340 + (f * 18 + i * 60) % 360, 'm3' if i == 1 else 'm2', 1, squash=0.7)
    if f >= 5:
        c.rise(t, 12, 3, ['g4', 'g3', 'g2'], 12, 52, 50, 6, sway=2, size=2)
        c.twinkles(t, 4, 7, 'w', 'g3', (10, 10, 54, 46))
    if f >= 6:
        c.heartp(32, 22 - (f - 6) * 2, 3 + (f > 7), 'l2', 'l0')


@sheet('monk_elder_staff_rings', 64, 8, 'target', P)
def staff_rings(c, f):
    """석장 고리: a ringed staff head slams down; six rings jangle and sound-waves ripple out."""
    if f <= 2:
        y = [6, 18, 30][f]
        c.line([(32, y - 10), (32, y + 6)], 'g0', 4)
        c.line([(32, y - 10), (32, y + 6)], 'o2', 2)
        c.ring(32, y + 9, 6, 'g1', 2)
        c.ring(32, y + 9, 5, 'g3', 1)
        for sx in (-1, 1):
            c.ring(32 + sx * 7, y + 6 + (f % 2), 2, 'g3')
        for i in range(3):
            c.line([(29 + i * 3, y - 18 - i), (29 + i * 3, y - 12)], 'g4' if i == 1 else 'g2')
    if f >= 3:
        u = (f - 3) / 4
        c.line([(32, 20), (32, 42)], 'g0', 4)
        c.line([(32, 20), (32, 42)], 'o2', 2)
        c.ring(32, 46, 6, 'g1', 2)
        for sx in (-1, 1):
            c.ring(32 + sx * (7 + u * 4), 42 - u * 3, 2, 'g3')
        for i in range(3):
            c.arc(32, 44, 10 + i * 6 + u * 12, 200, 340, ['g4', 'g3', 'g2'][i], 1, squash=0.6)
        c.spark(32, 44, 4 - int(u * 3), 'w', 'g3')
        for i in range(4):
            c.px(32 + math.cos(i * 1.6 + f) * (10 + u * 14), 40 + math.sin(i * 1.6 + f) * 8 * (1 - u), 'g4')
    if f == 3:
        pow_burst(c, 32, 46, 11, ['g1', 'g3', 'w'], n=8)


@sheet('monk_elder_temple_bell', 64, 10, 'target', P)
def temple_bell(c, f):
    """범종: a huge bronze bell falls on the target, rings with wave arcs."""
    if f <= 3:
        y = [-8, 6, 20, 30][f]
    else:
        y = 30
    sw = 0 if f <= 3 else int(3 * math.sin(f * 2.3) * (1 - (f - 4) / 6))
    if f <= 8:
        x = 32 + sw
        # dragon handle
        c.ring(x, y - 3, 4, 'g0', 2)
        c.poly([(x - 8, y + 2), (x + 8, y + 2), (x + 13, y + 26), (x - 13, y + 26)], 'g0')
        c.poly([(x - 7, y + 3), (x + 7, y + 3), (x + 11, y + 25), (x - 11, y + 25)], 'g1')
        c.poly([(x - 6, y + 4), (x - 2, y + 4), (x - 4, y + 24), (x - 10, y + 24)], 'g2')
        c.line([(x - 12, y + 26), (x + 12, y + 26)], 'g3', 2)
        c.line([(x - 9, y + 12), (x + 9, y + 12)], 'g0')
        c.line([(x - 10, y + 18), (x + 10, y + 18)], 'g0')
        for i in range(3):
            c.rect(x - 3 + i * 3 - 1, y + 6, x - 3 + i * 3 + 0.5, y + 10, 'g3')
        c.px(x - 8, y + 14, 'g4')
        c.px(x - 7, y + 15, 'g4')
    if f <= 2:
        for i in range(3):
            c.line([(22 + i * 10, y - 8 - i * 2), (22 + i * 10, y - 1)], 'g3')
    if f >= 3:
        u = (f - 3) / 6
        for i in range(3):
            r = 8 + u * 22 + i * 5
            if r < 31:
                c.arc(32, 30, r, 150, 210, 'g3' if i == 0 else 'g2', 1)
                c.arc(32, 30, r, 330, 390, 'g3' if i == 0 else 'g2', 1)
                c.arc(32, 30, r * 0.9, 240, 300, 'm3', 1)
        c.shock(32, 54, 8 + u * 18, ['g1', 'g3', 'g4'], squash=0.3)
    if f == 3:
        pow_burst(c, 32, 54, 12, ['g1', 'g3', 'w'], n=8)
    if f >= 5:
        c.twinkles(f / 10, 5, 4, 'w', 'g3', (8, 10, 56, 50))


@sheet('monk_elder_lotus', 64, 10, 'target', P)
def lotus_heal(c, f):
    """연꽃 개화: a pond ripples, a lotus rises and blooms; green motes lift the ally."""
    t = f / 9
    c.oval(32, 54, 12 + t * 12, 3 + t * 2, 'v1')
    c.ring(32, 54, 8 + t * 20, 'l3', 1, squash=0.28)
    c.ring(32, 54, 14 + t * 20, 'l2', 1, squash=0.28) if f >= 3 else None
    if f >= 1:
        h = min(1.0, f / 3)
        ly = 54 - 12 * h
        c.line([(32, 54), (32, ly)], 'v1', 2)
        c.line([(31, 54), (31, ly)], 'v2')
        for sx in (-1, 1):
            c.oval(32 + sx * 12, 53, 7, 2, 'v2')
            c.oval(32 + sx * 12, 52, 5, 1, 'v1')
        if f >= 2:
            lotus(c, 32, ly, 12 + min(f, 6) * 1.5, min(1.0, (f - 1) / 5))
    if f >= 5:
        c.rise(t, 14, 6, ['g4', 'v2', 'g3'], 16, 48, 48, 8, sway=3, size=2)
        c.pillar(32, 8, 44, 8, ['g2', 'g3', 'w'], parity=f % 2) if f in (6, 7) else None
    if f >= 6:
        c.heartp(32, 16 - (f - 6), 4, 'l2', 'l0')
    if f >= 7:
        c.twinkles(t, 5, 2, 'w', 'l3', (8, 8, 56, 50))


@sheet('monk_elder_roar', 64, 8, 'allTargets', P)
def roar(c, f):
    """사자후: a golden lion-face shock expands, sound rings slam outward around the enemy."""
    u = f / 7
    for i in range(4):
        r = 5 + u * 22 + i * 5
        if u * 22 + i * 5 < 22:
            c.arc(32, 34, r, 90, 270, ['g1', 'g2', 'g3', 'g4'][i], 2 if i < 2 else 1, squash=1.0)
    c.arc(32, 34, 8 + u * 20, 300, 420, 'g3', 1)
    if f <= 3:
        r = [7, 11, 13, 11][f]
        c.disc(32, 34, r, 'g0')
        c.disc(32, 34, r - 1, 'g2')
        # lion mane spikes
        c.spikes(32, 34, 12, r - 1, [r + 6, r + 3, r + 5], ['g1', 'g3'], rot=f * 0.2)
        c.disc(32, 34, r - 3, 'g3')
        c.rect(28, 31, 30, 33, 'o0')
        c.rect(34, 31, 36, 33, 'o0')
        c.rect(29, 37, 35, 38 + f % 2, 'o0')
    c.spikes(32, 34, 10, 10 + u * 8, [24, 30, 20], ['o2', 'g3', 'w'], rot=0.3, span=(2.2, 4.1)) if f in (2, 3, 4) else None
    if f >= 4:
        c.crown(32, 44, (f - 4) / 3, 24, ['g4', 'g3', 'o3'], n=14, seed=5, spread=(-3.0, -0.1))


@sheet('monk_elder_vajra', 64, 10, 'target', P)
def vajra(c, f):
    """금강저: a golden vajra flashes, lightning crashes through it into the target."""
    def vajra_at(x, y, s, tilt):
        for k, g in (('g0', 1), ('g2', 0)):
            c.line([(x, y - 12 * s), (x, y + 12 * s)], k, max(1, int(round(3 * s)) + g))
            for sx in (-1, 1):
                for j in (0, 1, 2):
                    pts = [(x, y - 12 * s), (x + sx * (4 + j * 2) * s, y - 15 * s - j * 0.4), (x + sx * (3 + j * 2) * s, y - 20 * s)]
                    pts2 = [(x, y + 12 * s), (x + sx * (4 + j * 2) * s, y + 15 * s + j * 0.4), (x + sx * (3 + j * 2) * s, y + 20 * s)]
                    c.line(pts, k)
                    c.line(pts2, k)
        c.disc(x, y, 3 * s, 'g0')
        c.disc(x, y, 2 * s, 'g3')
    if f <= 2:
        vajra_at(32, [10, 16, 24][f], 0.9 + f * 0.15, 0)
        c.rays(32, [10, 16, 24][f], 8, 10, 15, 'g3', rot=f * 0.4) if f >= 1 else None
    if 2 <= f <= 5:
        c.bolt((32, 4), (32, 46), f, ['y0' if False else 'g1', 'g3', 'w'], segs=7, jitter=7, widths=[5, 3, 1])
        for sx in (-1, 1):
            c.bolt((32, 22), (32 + sx * 20, 44), f + 3 * sx, ['g1', 'g3', 'w'], segs=4, jitter=4, widths=[3, 2, 1])
    if f >= 3:
        u = (f - 3) / 6
        c.shock(32, 52, 6 + u * 24, ['g1', 'g3', 'g4'], squash=0.3)
        if f <= 6:
            pow_burst(c, 32, 46, 14 - (f - 3) * 2, ['g1', 'g3', 'w'], n=10, rot=f)
        burst(c, 32, 46, u, 14, 6, ['w', 'g4', 'g3', 'g2'], spd=(10, 26), grav=0.4)
    if f >= 7:
        c.twinkles(f / 10, 4, 1, 'w', 'g3', (8, 8, 56, 50))


@sheet('monk_elder_zen', 64, 12, 'user', P)
def zen(c, f):
    """선정: the elder sits in a lotus of light; enso circle closes, aura breathes."""
    t = f / 12
    c.oval(32, 54, 14 + 2 * math.sin(t * 6.28 * 2), 3, 'g0')
    lotus(c, 32, 55, 15, min(1.0, f / 4), keys=('o0', 'o1', 'o2', 'o3'))
    br = 20 + 2 * math.sin(t * 6.28 * 2)
    c.ring(32, 30, br, 'g2', 1)
    if f >= 2:
        c.arc(32, 30, br + 4, -90, -90 + min(340, f * 40), 'g3', 2)
        c.arc(32, 30, br + 4, -90, -90 + min(340, f * 40), 'w', 1)
    if f >= 4:
        for i in range(3):
            c.disc(32 + (i - 1) * 15, 12 + (i % 2) * 4 - int(2 * math.sin(t * 6.28 + i)), 3, 'g2')
            c.disc(32 + (i - 1) * 15, 12 + (i % 2) * 4 - int(2 * math.sin(t * 6.28 + i)), 1.6, 'w')
    c.rise(t, 12, 4, ['g4', 'g3', 'g2'], 18, 46, 52, 6, sway=2, size=2)
    if f >= 8:
        c.pillar(32, 4, 50, 5, ['g2', 'g3', 'w'], parity=f % 2)
        c.heartp(32, 8, 3, 'l2', 'l0')


@sheet('monk_elder_nirvana_sky', 128, 12, 'screen', P)
def nirvana_sky(c, f):
    """열반의 빛: the stage dims, a giant lotus mandala unfolds and light shafts pour down."""
    t = f / 11
    dark = min(1, t * 3) if f < 9 else max(0, 1 - (f - 8) / 3)
    shade(c, 64, 64, 30 + 34 * dark, 'm0')
    if f == 0:
        c.spark(64, 62, 3, 'g3', 'g2')
    if f >= 1:
        n = min(24, f * 4)
        for ring_i, (R, k0, k1) in enumerate(((50, 'g1', 'g3'), (36, 'l1', 'l3'), (22, 'o1', 'o3'))):
            for i in range(12):
                a = i * math.pi / 6 + ring_i * 0.26 + f * (0.03 if ring_i % 2 else -0.03)
                if i * 2 < n:
                    tip = pol(64, 62, R * min(1.0, f / 4), a, 0.62)
                    base = pol(64, 62, R * 0.35, a, 0.62)
                    vx, vy = -math.sin(a), math.cos(a) * 0.62
                    c.poly([(base[0] + vx * 4, base[1] + vy * 4), tip, (base[0] - vx * 4, base[1] - vy * 4)], k0)
                    c.poly([(base[0] + vx * 2, base[1] + vy * 2), pol(64, 62, R * min(1.0, f / 4) * 0.9, a, 0.62), (base[0] - vx * 2, base[1] - vy * 2)], k1)
        c.oval(64, 62, 10, 6, 'g3')
        c.oval(64, 62, 6, 3, 'w')
    if 3 <= f <= 10:
        for i in range(5):
            x = 22 + i * 21
            c.pillar(x, 0, 78, 5 + (i % 2), ['g2', 'g3', 'w'], parity=(f + i) % 2)
    if f >= 5:
        c.twinkles(t, 10, 2, 'w', 'g3', (10, 10, 118, 100), r=3)
        c.rise(t, 24, 8, ['g4', 'g3', 'l3'], 10, 118, 108, 12, sway=3, size=2)


@sheet('monk_elder_nirvana_light', 64, 10, 'allAllies', P)
def nirvana_light(c, f):
    """열반의 빛(아군): a pillar of gold light wraps each ally and lifts them with a lotus at the feet."""
    t = f / 9
    lotus(c, 32, 55, 14, min(1.0, f / 3), keys=('o0', 'o1', 'o2', 'o3')) if f >= 1 else None
    if f >= 2:
        w = 12 if f < 7 else 12 - (f - 6) * 3
        c.pillar(32, 2, 54, max(2, w), ['g2', 'g3', 'g4', 'w'], parity=f % 2)
    if f >= 3:
        c.rise(t, 16, 3, ['w', 'g4', 'g3'], 16, 48, 54, 4, sway=2, size=2)
        c.heartp(32, 14 - (f - 3) * 1.5, 4, 'l2', 'l0') if f <= 7 else None
    c.shock(32, 55, 6 + t * 18, ['g1', 'g3', 'g4'], squash=0.28)
    if f in (2, 3):
        c.spikes(32, 30, 12, 6, [22, 16, 20], ['g2', 'g4'], squash=1.2, rot=0.2)
    if f >= 6:
        c.twinkles(t, 5, 6, 'w', 'g3', (8, 6, 56, 52))


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'monk_elder_', 'people4-4', sys.argv[1:] or None) else 0)
