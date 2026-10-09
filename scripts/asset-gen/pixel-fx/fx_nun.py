"""class_nun (수녀) skill FX: holy-water vial, cross smash, candle prayer, rosary bind, miracle sky.
Colour identity: violet habit ink, silver cross, candle gold, pale sky blue holy water, stained-glass jewel tones.
Reused layers (not drawn here): bard_hymn, holy, cleric_purify, cleric_blessing, cleric_mass_heal.
Run this file to rebuild every nun sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

HOLYW = dict(h0='#10224a', h1='#2a5cae', h2='#5ea8ee', h3='#bce6ff')
SILVER = dict(i0='#26243a', i1='#5a5a78', i2='#a4a8c4', i3='#e6ecf8')
GOLD = dict(g0='#6a3a0a', g1='#c67e18', g2='#ffc640', g3='#fff2a0')
VIO = dict(v0='#1e0e2e', v1='#4a2a66', v2='#8c62b0')
GLASS = dict(r1='#c22a44', b1='#2e62d0', e1='#2e9a52')
P = pal(HOLYW, SILVER, GOLD, VIO, WHITE)
PSKY = pal(pick(HOLYW, 'h3'), SILVER, GOLD, VIO, GLASS, WHITE)


@sheet('nun_vial', 32, 4, 'projectile', pal(HOLYW, SILVER, pick(GOLD, 'g2'), WHITE))
def vial(c, f):
    """성수 병: a stoppered flask tumbling LEFT, a drip trail of holy water flicking off behind it."""
    a = [0, 0.8, 1.6, 2.4][f]
    x, y = 12, 16
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    body = [(x + ux * dx + vx * dy, y + uy * dx + vy * dy) for dx, dy in ((-5, -4), (3, -4), (3, 4), (-5, 4))]
    c.poly([(px_ + (px_ - x) * 0.25, py_ + (py_ - y) * 0.25) for px_, py_ in body], 'i0')
    c.poly(body, 'h2')
    c.poly([(x + ux * dx + vx * dy, y + uy * dx + vy * dy) for dx, dy in ((-4, 0), (2, 0), (2, 3), (-4, 3))], 'h1')
    neck = [(x + ux * 3 + vx * -1.5, y + uy * 3 + vy * -1.5), (x + ux * 7 + vx * -1.5, y + uy * 7 + vy * -1.5)]
    c.line(neck, 'i2', 3)
    c.line([(x + ux * 7, y + uy * 7), (x + ux * 9, y + uy * 9)], 'g2', 3)
    c.px(x - ux * 2 - vx * 2, y - uy * 2 - vy * 2, 'w')
    c.px(x - ux * 3 - vx * 2, y - uy * 3 - vy * 2, 'h3')
    for j in range(5):
        d = 10 + j * 4 + (f % 2) * 2
        c.px(x + d, y + math.sin(j + f) * 3, 'h3' if j % 2 else 'h2')
    c.spark(x + 18 + f, y - 5 + (f % 2) * 8, 1, 'w', 'h3')


@sheet('nun_cross_smash', 64, 8, 'target', P)
def cross_smash(c, f):
    """십자가 강타: a silver cross swings down from upper right, a cross-shaped flash stamps on the foe, holy shards scatter."""
    t = f / 7
    if f <= 2:
        a = [-0.9, -0.3, 0.35][f]
        px_, py_ = 46, 6
        L = 34
        tip = (px_ - math.sin(a) * L * 0.2 - math.cos(a + 1.2) * 4, py_ + L * (0.6 + f * 0.2))
        c.line([(px_ + 8, py_ - 4), (32, 32)] if f == 2 else [(px_ + 8, py_ - 4), tip], 'i0', 5)
        c.line([(px_ + 8, py_ - 4), (32, 32)] if f == 2 else [(px_ + 8, py_ - 4), tip], 'i2', 3)
        hx, hy = (32, 32) if f == 2 else tip
        c.cross(hx, hy, 4, 'i3', 'i0')
        for j in range(3):
            c.arc(46, 6, 26 + j * 3, 95 + f * 10, 150 + f * 12, 'h3' if j == 1 else 'h2', 1)
    if f >= 2:
        s = [5, 9, 11, 10, 8, 6][f - 2]
        c.cross(32, 34, s, 'g1', 'v1')
        c.cross(32, 34, max(1.5, s - 2), 'g3' if f <= 4 else 'g2')
        if f <= 4:
            c.disc(32, 30, 3, 'w')
            c.shock(32, 34, 8 + (f - 2) * 7, ['h1', 'h2', 'h3'], squash=0.7)
    if f >= 3:
        burst(c, 32, 34, (f - 3) / 4, 12, 7, ['w', 'g3', 'h3', 'h2'], spd=(10, 24), grav=0.4)
    if f >= 5:
        c.twinkles(t, 6, 3, 'w', 'g2', (10, 10, 54, 50))


@sheet('nun_candles', 64, 10, 'target', P)
def candles(c, f):
    """촛불 기도: five candles rise around the ally one by one, flames lick up, then gold motes drift up and heal."""
    t = f / 9
    xs = [12, 22, 32, 42, 52]
    ys = [52, 49, 48, 49, 52]
    for i, (x, y) in enumerate(zip(xs, ys)):
        if f < i:
            continue
        h = 8 + (i % 2) * 2
        c.rect(x - 2, y - h, x + 1, y, 'i2')
        c.rect(x - 2, y - h, x - 1, y, 'i3')
        c.px(x, y - h, 'i1')
        c.line([(x - 3, y + 1), (x + 2, y + 1)], 'g0')
        fy = y - h - 1
        fl = 3 + ((f + i) % 3)
        c.poly([(x - 1.5, fy), (x + 1, fy), (x - 0.3 + math.sin(f + i) * 0.8, fy - fl - 1)], 'g1')
        c.poly([(x - 1, fy), (x + 0.4, fy), (x - 0.3, fy - fl + 1)], 'g2')
        c.px(x - 0.3, fy - 1, 'g3')
        if f >= 5:
            c.dring(x - 0.3, fy - 2, 3 + (f % 2), 'g2', parity=f)
    if f >= 5:
        u = (f - 5) / 4
        c.rise(u, 14, 5, ['g3', 'g2', 'h3'], 10, 54, 50, 6, sway=2, size=2)
        c.ring(32, 34, 10 + u * 12, 'g2', 1, squash=0.8)
        if f >= 7:
            c.cross(32, 26, 3, 'g3', 'g1')


@sheet('nun_rosary', 64, 10, 'allTargets', P)
def rosary(c, f):
    """묵주 결박: a glowing bead chain whips around the foe and cinches into a tightening loop with a silver cross charm."""
    t = f / 9
    r = [28, 25, 22, 19, 17, 16, 16, 17, 19, 22][f]
    squash = 0.6
    cy = 36
    n = 16
    turn = f * 0.45
    shown = n if f >= 3 else int(n * (f + 1) / 4)
    pts = []
    for i in range(shown):
        a = turn + i * 2 * math.pi / n
        x, y = pol(32, cy, r, a, squash)
        pts.append((x, y, math.sin(a) > 0))
    for x, y, front in pts:
        if not front:
            c.disc(x, y, 1.4, 'v1')
    for x, y, front in pts:
        if front:
            c.disc(x, y, 2.2, 'i0')
            c.disc(x, y, 1.5, 'v2' if f < 4 else 'g2')
            c.px(x - 0.5, y - 0.5, 'w' if f in (4, 5) else 'i3')
    if f >= 2:
        ax, ay = pol(32, cy, r, turn + math.pi * 0.5, squash)
        c.line([(ax, ay), (ax, ay + 5)], 'i2', 2)
        c.cross(ax, ay + 10, 4, 'i3', 'i0')
    if 4 <= f <= 6:
        c.shock(32, cy, 6 + (f - 4) * 6, ['h1', 'h2', 'h3'], squash=0.55)
        c.spark(32, cy - 10, 5 - (f - 4), 'w', 'g3')
    if f >= 6:
        c.twinkles(t, 5, 4, 'w', 'g2', (12, 20, 52, 50))


@sheet('nun_miracle_sky', 128, 12, 'screen', PSKY)
def miracle_sky(c, f):
    """성녀의 기적: the stage darkens, a stained-glass rose window opens overhead and pours coloured light shafts down."""
    t = f / 11
    dark = min(1, t * 3) if f < 10 else max(0, 1 - (f - 9) / 2)
    shade(c, 64, 64, 30 + 34 * dark, 'v0')
    g = min(1.0, (f + 1) / 5)
    cx, cy = 64, 40
    R = 26 * g
    if f >= 1:
        c.disc(cx, cy, R + 3, 'i0')
        c.disc(cx, cy, R + 1, 'g1')
        c.disc(cx, cy, R, 'v1')
        segs = 12
        cols = ['r1', 'b1', 'e1', 'g2']
        for i in range(segs):
            a0 = f * 0.05 + i * 2 * math.pi / segs
            a1 = a0 + 2 * math.pi / segs * 0.8
            c.poly([(cx, cy), pol(cx, cy, R - 2, a0), pol(cx, cy, R - 2, (a0 + a1) / 2), pol(cx, cy, R - 2, a1)], cols[i % 4])
        for i in range(segs):
            a = f * 0.05 + i * 2 * math.pi / segs
            c.line([(cx, cy), pol(cx, cy, R, a)], 'i0')
        c.disc(cx, cy, max(1, R * 0.28), 'g3')
        c.cross(cx, cy, max(1.5, R * 0.14), 'w')
    if f >= 4:
        u = min(1.0, (f - 3) / 4)
        for i, (x, k) in enumerate(((34, 'r1'), (50, 'b1'), (64, 'g3'), (78, 'e1'), (94, 'b1'))):
            y1 = cy + R + (120 - cy - R) * u
            w = 3 + (i % 2)
            c.pillar(x, cy + R - 4, y1, w, [k, 'h3' if k == 'g3' else k], parity=f)
        c.rise(t, 18, 7, ['w', 'g3', 'h3'], 20, 108, 118, 60, sway=3)
    if f >= 6:
        c.twinkles(t, 8, 3, 'w', 'g2', (16, 10, 112, 110), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'nun_', 'people4-7', sys.argv[1:] or None) else 0)

