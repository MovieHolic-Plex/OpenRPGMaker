"""class_girl_alchemist (꼬마 발명가) skill FX: firecracker pop, gear saw, wind-up robot, repair kit, giant clockwork doll.
Colour identity: brass + copper gears, rose-pink dress accent, spark white/yellow, steel blue.
Reused layers (not drawn here): scout_bomb, bard_tempo, mage_chain_bolt, hero_dust, hero_meteor_impact, guard_fortress_slam.
Run this file to rebuild every girl_alchemist sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

BRASS = dict(b0='#3e2408', b1='#96601c', b2='#d9a957', b3='#ffe29a')
STEEL = dict(i0='#1c2230', i1='#4a5670', i2='#8c9cb8', i3='#dce6f4')
ROSE = dict(r1='#c05078', r2='#ff90b8')
SPARK = dict(y1='#ff9a2a', y2='#ffe45a')
GREEN = dict(g1='#3cb45a', g2='#a8f090')
P = pal(BRASS, STEEL, ROSE, SPARK, GREEN, WHITE)


@sheet('girl_alchemist_pop', 64, 8, 'target', P)
def pop(c, f):
    """꼬마 폭죽 착탄: the cracker bangs into a star-shaped flash, then crackles into little coloured stars and smoke curls."""
    t = f / 7
    if f <= 2:
        r = [8, 14, 12][f]
        star(c, 32, 34, 8, r * 0.4, r, 'b0', rot=f * 0.3)
        star(c, 32, 34, 8, r * 0.3, r - 3, 'y1', rot=f * 0.3)
        star(c, 32, 34, 8, r * 0.2, r - 6, 'y2', rot=f * 0.3)
        c.disc(32, 34, max(1, r * 0.25), 'w')
    if f >= 1:
        rr = rng(4)
        for i in range(10):
            a = i * 2 * math.pi / 10 + rr.uniform(-.2, .2)
            d = 6 + ease(min(1, (f - 1) / 5)) * 20
            x, y = pol(32, 34, d, a)
            y += t * t * 8
            if f < 7:
                c.spark(x, y, 2 if f < 4 else 1, 'w', ['r2', 'y2', 'g2', 'i3'][i % 4])
    if f >= 3:
        for j, (x, y) in enumerate(((22, 28), (40, 26), (30, 44))):
            r = 2.5 + (f - 3) * 0.6
            c.ddisc(x, y - (f - 3) * 2, r + 1, 'i1', parity=f)
            c.disc(x - 0.5, y - (f - 3) * 2 - 0.5, max(0.5, r - 1.2), 'i2')


@sheet('girl_alchemist_gear_saw', 64, 8, 'target', P)
def gear_saw(c, f):
    """톱니 날리기: a spinning brass saw-gear grinds across the foe spraying sparks, leaving scratch marks."""
    t = f / 7
    x = lerp(52, 14, ease(t))
    y = 34 + math.sin(t * math.pi) * -4
    c.gear(x, y, 9, 8, f * 0.5, 'b2', 'b0')
    c.disc(x, y, 4, 'b1')
    c.disc(x, y, 2, '_')
    c.px(x - 3, y - 3, 'b3')
    for j in range(3):
        c.arc(x, y, 12 + j, (f * 60 + j * 120) % 360, (f * 60 + j * 120 + 50) % 360, 'i3', 1)
    if 1 <= f <= 6:
        burst(c, x + 6, y + 3, 0.5, 8, f, ['w', 'y2', 'y1'], spd=(6, 16), grav=0.8, spread=(-0.8, 0.9))
    for k in range(min(f, 4)):
        yy = 28 + k * 4
        c.line([(52 - k * 2, yy), (max(x + 8, 20), yy + 3)], 'r1' if k % 2 else 'i2')


@sheet('girl_alchemist_robot', 64, 10, 'target', P)
def robot(c, f):
    """태엽 로봇: a tiny wind-up robot waddles in with its key turning, blinks red, and blows up into a gear-strewn bang."""
    t = f / 9
    if f <= 5:
        x = lerp(60, 34, f / 5)
        bob = (f % 2)
        y = 50 - bob
        c.rect(x - 6, y - 12, x + 6, y, 'i0')
        c.rect(x - 5, y - 11, x + 5, y - 1, 'i2')
        c.rect(x - 5, y - 11, x + 5, y - 9, 'i3')
        c.rect(x - 4, y - 18, x + 4, y - 12, 'i0')
        c.rect(x - 3, y - 17, x + 3, y - 13, 'i2')
        c.px(x - 2, y - 15, 'r2' if f % 2 else 'y2')
        c.px(x + 1, y - 15, 'r2' if f % 2 else 'y2')
        c.line([(x, y - 18), (x, y - 21)], 'i1')
        c.disc(x, y - 22, 1, 'r2' if f >= 4 else 'r1')
        ka = f * 1.2
        c.line([(x + 6, y - 6), (x + 10, y - 6)], 'b1')
        c.line([(x + 10, y - 6 - 3 * math.cos(ka)), (x + 10, y - 6 + 3 * math.cos(ka))], 'b2', 2)
        c.line([(x - 4, y), (x - 4 - bob, y + 3)], 'i1', 2)
        c.line([(x + 4, y), (x + 4 + bob, y + 3)], 'i1', 2)
        if f >= 4:
            c.spark(x, y - 24, 3, 'w', 'r2')
    else:
        u = (f - 6) / 3
        r = 6 + u * 16
        c.disc(34, 40, r + 2, 'b0')
        c.disc(34, 40, r, 'y1')
        c.disc(34, 40, max(1, r - 5), 'y2')
        if f <= 7:
            c.disc(34, 40, max(1, r - 10), 'w')
        rr = rng(9)
        for i in range(6):
            a = rr.uniform(0, 2 * math.pi)
            gx, gy = pol(34, 40, 8 + u * 22, a)
            c.gear(gx, gy - u * 4, 3, 6, f + i, 'b2', 'b0')
        if f >= 8:
            c.dring(34, 40, r + 5, 'i2', parity=f)
            c.dring(34, 40, r + 7, 'i1', parity=f + 1)


@sheet('girl_alchemist_repair', 64, 10, 'allAllies', P)
def repair(c, f):
    """수리 세트: a wrench and screwdriver whirl round the ally, bolts tighten with a click, and green repair sparks rise."""
    t = f / 9
    for i in range(2):
        a = t * 2 * math.pi * 1.5 + i * math.pi
        x, y = pol(32, 32, 16, a, 0.5)
        ang = a + math.pi / 2
        ux, uy = math.cos(ang), math.sin(ang)
        if i == 0:
            c.line([(x - ux * 5, y - uy * 5), (x + ux * 5, y + uy * 5)], 'i0', 3)
            c.line([(x - ux * 5, y - uy * 5), (x + ux * 5, y + uy * 5)], 'i2', 1)
            c.disc(x + ux * 6, y + uy * 6, 2.5, 'i0')
            c.disc(x + ux * 6, y + uy * 6, 1.6, 'i3')
            c.px(x + ux * 7.5, y + uy * 7.5, '_')
        else:
            c.line([(x - ux * 4, y - uy * 4), (x, y)], 'r1', 3)
            c.line([(x, y), (x + ux * 6, y + uy * 6)], 'i3', 1)
    for j, (bx, by) in enumerate(((20, 22), (44, 26), (26, 44), (40, 42))):
        on = f >= 2 + j * 2
        if on:
            c.disc(bx, by, 2, 'b0')
            c.disc(bx, by, 1.2, 'b2')
            rot = (f - 2 - j * 2) * 0.8
            c.line([pol(bx, by, 1.2, rot), pol(bx, by, 1.2, rot + math.pi)], 'b0')
            if f == 2 + j * 2:
                c.spark(bx, by, 4, 'w', 'g2')
    if f >= 4:
        c.rise(t, 12, 5, ['g2', 'g1', 'w'], 12, 52, 54, 10, sway=2)
        c.gear(32, 50, 5, 8, f * 0.4, 'b1', 'b0')


@sheet('girl_alchemist_mecha_sky', 128, 12, 'screen', P)
def mecha_sky(c, f):
    """거대 태엽 인형: a huge clockwork doll rises behind the stage, its chest gears spin and key turns, then it raises an iron fist."""
    t = f / 11
    shade(c, 64, 64, 34 + 30 * min(1, t * 3), 'i0')
    rise = ease(min(1.0, (f + 1) / 6))
    oy = (1 - rise) * 60
    # body
    c.rect(38, 56 + oy, 90, 118 + oy, 'b0')
    c.rect(40, 58 + oy, 88, 116 + oy, 'b1')
    c.rect(40, 58 + oy, 88, 62 + oy, 'b2')
    c.gear(64, 84 + oy, 14, 12, f * 0.35, 'b2', 'b0')
    c.gear(50, 102 + oy, 7, 8, -f * 0.6, 'b3', 'b0')
    c.gear(78, 102 + oy, 7, 8, -f * 0.6, 'b3', 'b0')
    # head
    c.rect(48, 30 + oy, 80, 56 + oy, 'b0')
    c.rect(50, 32 + oy, 78, 54 + oy, 'i2')
    c.rect(50, 32 + oy, 78, 35 + oy, 'i3')
    eye = 'r2' if f >= 5 else 'i1'
    c.rect(55, 41 + oy, 60, 45 + oy, eye)
    c.rect(68, 41 + oy, 73, 45 + oy, eye)
    c.line([(58, 50 + oy), (70, 50 + oy)], 'i0')
    c.disc(64, 27 + oy, 3, 'r1')
    # key on the back (right)
    ka = f * 0.9
    c.line([(90, 80 + oy), (100, 80 + oy)], 'b1', 3)
    c.line([(100, 80 + oy - 7 * math.cos(ka)), (100, 80 + oy + 7 * math.cos(ka))], 'b2', 4)
    # fist raising on the left (enemy side)
    if f >= 6:
        u = ease(min(1.0, (f - 5) / 4))
        sx, sy = 38, 64 + oy
        fx_, fy_ = lerp(26, 28, u), lerp(94, 42, u)
        c.line([(sx, sy), (fx_ + 4, fy_ + 8)], 'b0', 10)
        c.line([(sx, sy), (fx_ + 4, fy_ + 8)], 'b1', 6)
        c.rect(fx_ - 11, fy_ - 11, fx_ + 11, fy_ + 9, 'b0')
        c.rect(fx_ - 9, fy_ - 9, fx_ + 9, fy_ + 7, 'i2')
        c.rect(fx_ - 9, fy_ - 9, fx_ + 9, fy_ - 6, 'i3')
        for k in range(3):
            c.line([(fx_ - 9 + k * 6 + 5, fy_ - 9), (fx_ - 9 + k * 6 + 5, fy_ - 2)], 'i1')
        if f >= 9:
            c.spark(fx_, fy_ - 10, 5, 'w', 'y2')
    if f >= 4:
        c.twinkles(t, 6, 3, 'w', 'y2', (20, 20, 108, 108), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'girl_alchemist_', 'people5-1', sys.argv[1:] or None) else 0)

