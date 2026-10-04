"""class_ronin (낭인) skill FX: iai draw, rain cut, ash stance, last-blade sky.
Colour identity: crimson + rust blood-red ink, ash grey, cold steel white, rain blue.
Reused layers (not drawn here): hero_pierce, hero_dust, mon_fang_bite, samurai_wind_wave, samurai_blood_hit,
mon_cleave_arc, samurai_final_slash.
Run this file to rebuild every ronin sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

CRIM = dict(r0='#2a0610', r1='#701527', r2='#c02c34', r3='#ff7a6a')
ASH = dict(a0='#1a181e', a1='#4a4650', a2='#8a8490', a3='#c8c2cc')
STEEL = dict(s2='#b8c8dc', s3='#eef6ff')
RAIN = dict(n1='#3a5a90', n2='#7aa8e0')
EMBER = dict(e1='#ff9a3a', e2='#ffe08a')
P = pal(CRIM, ASH, STEEL, RAIN, EMBER, WHITE)


@sheet('ronin_draw', 64, 8, 'target', P)
def draw_cut(c, f):
    """거합 일섬: a still pause, one horizontal white flash across the foe, then the line splits and bleeds crimson."""
    if f == 0:
        c.spark(32, 34, 2, 's3', 's2')
        c.dring(32, 34, 10, 'a2', parity=0)
    elif f == 1:
        c.line([(58, 34), (30, 34)], 's2', 1)
        c.line([(58, 34), (40, 34)], 's3', 1)
    elif f == 2:
        c.poly([(60, 34), (32, 31), (4, 33), (32, 36)], 's2')
        c.poly([(56, 34), (32, 32.5), (8, 33.5), (32, 35)], 'w')
    elif f == 3:
        c.poly([(62, 34), (32, 31), (2, 33), (32, 37)], 'r2')
        c.poly([(58, 34), (32, 32), (6, 33.5), (32, 35.5)], 's3')
        c.spark(32, 34, 8, 'w', 's3')
    else:
        u = (f - 4) / 3
        gap = 2 + u * 5
        c.line([(6, 33 - gap), (58, 33 - gap)], 'r1')
        c.line([(6, 35 + gap), (58, 35 + gap)], 'r1')
        c.line([(10 + u * 8, 33 - gap), (54 - u * 8, 33 - gap)], 'r2')
        c.line([(10 + u * 8, 35 + gap), (54 - u * 8, 35 + gap)], 'r2')
        burst(c, 32, 34, u, 10, 3, ['r3', 'r2', 'r1'], spd=(6, 18), grav=1.0, spread=(-0.4, 0.4))
        burst(c, 32, 34, u, 10, 4, ['r3', 'r2', 'r1'], spd=(6, 18), grav=1.0, spread=(2.7, 3.5))


@sheet('ronin_rain_cut', 64, 10, 'target', P)
def rain_cut(c, f):
    """우중 난도: slanted rain falls over the foe while four diagonal cuts flash through it, each spraying rain drops."""
    t = f / 9
    rr = rng(7)
    for i in range(22):
        x = rr.uniform(0, 70)
        ph = rr.uniform(0, 1)
        y = ((t * 1.6 + ph) % 1.0) * 70 - 6
        c.line([(x - y * 0.3, y), (x - y * 0.3 - 2, y + 5)], 'n1' if i % 3 else 'n2')
    cuts = [((52, 12), (14, 52)), ((12, 14), (52, 50)), ((56, 30), (8, 38)), ((40, 8), (26, 58))]
    for j, (a, b) in enumerate(cuts):
        s = 1 + j * 2
        if f == s:
            c.blade(a, b, 6, 5, ['s2', 's3', 'w'])
        elif f == s + 1:
            c.blade(a, b, 6, 3, ['r1', 'r2'])
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            c.spark(*m, 4, 'w', 'n2')
            burst(c, m[0], m[1], 0.5, 8, j, ['n2', 's3'], spd=(6, 14), grav=0.6)
    if f >= 9:
        c.twinkles(t, 5, 1, 'w', 'r3', (8, 10, 56, 54))


@sheet('ronin_ash_stance', 64, 10, 'user', P)
def ash_stance(c, f):
    """재의 자세: grey ash and a few embers drift up around the ronin while a crimson ground ring slowly tightens."""
    t = f / 9
    r = 22 - t * 6
    c.ring(32, 54, r, 'r1', 2, squash=0.28)
    c.dring(32, 54, r + 3, 'r2', parity=f, squash=0.28)
    c.rise(t, 16, 3, ['a3', 'a2', 'a1'], 12, 52, 54, 6, sway=2)
    c.rise(t * 1.3, 6, 8, ['e2', 'e1', 'r2'], 16, 48, 54, 14, sway=3)
    for j in range(3):
        a = t * 2 * math.pi + j * 2.1
        x, y = pol(32, 30, 14, a, 0.35)
        c.line([(x, y), (x, y - 5)], 'a2')
    if f in (4, 5, 6):
        c.spark(20, 20, 3, 'w', 'r3')


@sheet('ronin_last_sky', 128, 12, 'screen', P)
def last_sky(c, f):
    """낭인의 마지막 검: the stage bleaches to ash-grey under a crimson moon, petals of ash freeze mid-air, then a single white cut splits the sky."""
    t = f / 11
    dark = min(1, t * 3)
    shade(c, 64, 64, 30 + 34 * dark, 'a0')
    if f >= 1:
        g = ease(min(1, f / 6))
        c.disc(80, 40, 16 * g + 2, 'r0')
        c.disc(80, 40, 16 * g, 'r1')
        c.disc(76, 36, 12 * g, 'r2')
        c.disc(84, 40, 12 * g, 'r1')
    if 4 <= f <= 6:
        # the ronin's resolve: a thin red horizon line draws itself left before the cut
        c.line([(112, 96), (112 - (f - 3) * 30, 96)], 'r2')
    rr = rng(5)
    for i in range(26):
        x, y = rr.uniform(16, 112), rr.uniform(20, 108)
        drift = 0 if 5 <= f <= 8 else (f - 8 if f > 8 else -(5 - f)) * 1.5
        c.px(x + drift, y + drift * 0.3, 'a3' if i % 3 else 'a2')
        if i % 5 == 0:
            c.px(x + drift + 1, y + drift * 0.3, 'a2')
    if f in (6, 7):
        c.line([(122, 18), (6, 110)], 'w', 1)
        c.line([(122, 18), (70, 58)], 's3', 3 if f == 7 else 1)
    elif f >= 8:
        u = (f - 8) / 3
        off = 1 + u * 5
        c.poly([(124, 16 - off), (4, 108 - off), (4, 104 - off), (124, 12 - off)], 's2')
        c.line([(124, 18), (4, 110)], 'w', 2 if f < 10 else 1)
        c.line([(124, 18 + off), (4, 110 + off)], 'r2', 1)
        c.twinkles(t, 6, 4, 'w', 'r3', (16, 16, 112, 112), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'ronin_', 'people5-2', sys.argv[1:] or None) else 0)

