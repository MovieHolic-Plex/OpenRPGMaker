"""class_desert_warrior (사막 전사) skill FX: scimitar crescent, scorpion sting, sunfire aura, million-blade sky.
Colour identity: sand ochre, sun gold/orange, steel scimitar, scorpion venom purple, dusk indigo.
Reused layers (not drawn here): nomad_sand_toss, scout_flurry, nomad_dust_devil, mage_fireball_orb, mage_fire_burst, earth, ninja_thousand_hit.
Run this file to rebuild every desert warrior sheet and the review boards in .omo/r2w4/p5/."""
from lib_r2w4 import *

SAND = dict(d0='#3a2410', d1='#8a5a24', d2='#d09a4a', d3='#f4d898')
SUN = dict(u1='#c83a14', u2='#ff8a1e', u3='#ffd040', u4='#fff6b8')
STL = dict(s1='#5a6680', s2='#b0c0d8', s3='#eef6ff')
VEN = dict(v1='#4a1a6a', v2='#a044d0')
DUSK = dict(n0='#140e26')
P = pal(SAND, SUN, STL, VEN, DUSK, WHITE)


def scimitar(c, hx, hy, ang, L, keys=('s1', 's2', 's3')):
    """A curved scimitar: hilt at (hx, hy), blade bowing toward the tip along ang."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    tip = (hx + ux * L, hy + uy * L)
    c.blade((hx + ux * 3, hy + uy * 3), tip, -L * 0.18, 3, list(keys))
    c.line([(hx - vx * 2.5, hy - vy * 2.5), (hx + vx * 2.5, hy + vy * 2.5)], 'u3', 1)
    c.line([(hx, hy), (hx - ux * 3, hy - uy * 3)], 'd1', 2)


@sheet('desert_warrior_crescent', 64, 8, 'target', P)
def crescent(c, f):
    """초승달 베기: a scimitar sweeps a big sun-gold crescent from high right to low left, sand chips spray off the cut."""
    if f <= 3:
        fr = [0.25, 0.55, 0.85, 1.0][f]
        c.blade((56, 8), (10, 54), 14, 7, ['u1', 'u2', 'u3', 'w'], frac=fr)
        a = math.radians(-120 + 90 * fr)
        scimitar(c, 40 + 10 * math.cos(a + 2.4), 30 + 10 * math.sin(a + 2.4), math.pi * 0.75 - fr * 0.9, 16)
        if f == 3:
            c.spark(28, 34, 7, 'w', 'u3')
    else:
        u = (f - 4) / 3
        c.blade((56, 8), (10, 54), 14 - u * 4, 5 - u * 3, ['d1', 'u2', 'u4'][: 3 - int(u * 1.5)])
        burst(c, 30, 34, u, 14, 5, ['d3', 'd2', 'd1'], spd=(8, 22), grav=1.2)
        c.dring(30, 34, 8 + u * 14, 'u3', parity=f, squash=0.7)
        if f == 4:
            c.shock(30, 34, 12, ['u1', 'u2', 'u4'], squash=0.7)


@sheet('desert_warrior_scorpion', 64, 10, 'target', P)
def scorpion(c, f):
    """전갈 찌르기: a purple scorpion-tail arc curls over from the upper right, the stinger stabs down, venom splashes."""
    t = f / 9
    if f <= 4:
        u = f / 4
        cx_, cy_ = 42, 30
        segs = 7
        pts = []
        for i in range(segs):
            a = math.radians(40 - 250 * u * i / (segs - 1))
            r = 18 - i * 0.8
            pts.append(pol(cx_, cy_, r, a))
        for i, (x, y) in enumerate(pts):
            rr = 4 - i * 0.35
            c.disc(x, y, rr + 1, 'n0')
            c.disc(x, y, rr, 'd1' if i % 2 else 'd2')
            c.px(x - 1, y - 1, 'd3')
        tx, ty = pts[-1]
        ax, ay = lerp(tx, 30, u * u), lerp(ty, 36, u * u)
        c.line([(tx, ty), (ax, ay)], 'v1', 3)
        c.poly([(ax - 3, ay - 2), (ax + 3, ay - 2), (ax, ay + 5)], 'v2')
        c.px(ax, ay + 3, 'w')
    if f >= 4:
        u = (f - 4) / 5
        if f <= 6:
            pow_burst(c, 30, 38, 11 - (f - 4) * 2, ['v1', 'v2', 'w'], rot=f * 0.4)
        burst(c, 30, 38, u, 14, 3, ['w', 'v2', 'v1'], spd=(6, 20), grav=1.4, up=0.3)
        c.ring(30, 50, 6 + u * 14, 'v1', 1, squash=0.3)
        c.dring(30, 50, 10 + u * 14, 'v2', parity=f, squash=0.3)
        if f >= 7:
            c.rise(u, 8, 6, ['v2', 'v1'], 18, 42, 44, 16, sway=2)


@sheet('desert_warrior_sunfire', 64, 10, 'user', P)
def sunfire(c, f):
    """작열: heat shimmer rises, a sun disc blazes behind the warrior with turning rays, orange flame tongues lick at the feet."""
    t = f / 9
    g = ease(min(1.0, (f + 1) / 4))
    rot = t * 1.2
    for j, x0 in enumerate((10, 54)):
        c.wave(x0, 52, x0, 14, 1.5, 1.5, f * 0.9 + j * 2, 'd3' if j else 'u4')
    c.rays(32, 24, 12, 11 * g, 22 * g, 'u2', 1, rot=rot)
    c.rays(32, 24, 12, 11 * g, 17 * g, 'u3', 1, rot=rot + 0.26)
    c.dring(32, 24, 10 * g + 1, 'u1', parity=f)
    c.ring(32, 24, 9 * g, 'u3', 1)
    for i in range(5):
        x = 14 + i * 9
        h = 6 + ((f + i * 2) % 4) * 2
        flame_tongue(c, x, 56, h, 2.5, ['u1', 'u2', 'u3'], seed=i + f, lean=0.1 * math.sin(f + i))
    if f >= 5:
        c.rise(t, 10, 4, ['u4', 'u3', 'u2'], 12, 52, 54, 8, sway=2)
    if f in (3, 7):
        c.spark(32, 24, 5, 'w', 'u4')


@sheet('desert_warrior_blades_sky', 128, 12, 'screen', pal(pick(SAND, 'd1', 'd2', 'd3'), SUN, STL, DUSK, WHITE))
def blades_sky(c, f):
    """백만 곡도: a blazing noon sun over a dusk-dimmed stage, then a storm of scimitars rains down slantwise and flashes."""
    t = f / 11
    dark = min(1, t * 3) if f < 10 else max(0, 1 - (f - 9) / 2)
    shade(c, 64, 64, 30 + 34 * dark, 'n0')
    g = ease(min(1.0, (f + 1) / 4))
    c.rays(64, 26, 16, 12 * g, 24 * g, 'u2', 1, rot=f * 0.08)
    c.disc(64, 26, 12 * g, 'u1')
    c.disc(64, 26, 10 * g, 'u2')
    c.disc(62, 24, 7 * g, 'u3')
    c.disc(61, 23, 3 * g, 'u4')
    if f >= 3:
        rr = rng(12)
        for i in range(22):
            x0 = rr.uniform(24, 136)
            ph = rr.uniform(0, 1)
            u = ((f - 3) / 8 * 1.3 + ph) % 1.0
            x = x0 - u * 44
            y = 20 + u * 96
            ang = math.radians(116)
            if i % 3 == 0:
                c.line([(x + 6, y - 12), (x, y)], 'd3')
            scimitar(c, x, y, ang, 11)
    if f >= 6:
        rr = rng(3)
        for i in range(4):
            x, y = rr.uniform(24, 104), rr.uniform(74, 104)
            if (i + f) % 2 == 0:
                c.spark(x, y, 4, 'w', 'u3')
    if f >= 8:
        c.twinkles(t, 6, 7, 'w', 'u3', (16, 40, 112, 110), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'desert_warrior_', 'people5-4', sys.argv[1:] or None) else 0)
