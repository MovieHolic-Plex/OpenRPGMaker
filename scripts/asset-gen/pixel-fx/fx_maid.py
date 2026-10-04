"""class_maid (메이드) skill FX: broom sweep, feather duster, plate discus, tea time, soap bubbles, spring-clean sky.
Colour identity: navy dress ink, white apron/lace, porcelain blue, tea amber, soap pastel pink/cyan.
Reused layers (not drawn here): noblewoman_gem_hit, knife, cleric_blessing, sailor_tidal_crash.
Run this file to rebuild every maid sheet and the review boards in .omo/r2w4/p5/."""
from lib_r2w4 import *

NAVY = dict(n0='#141428', n1='#2c3464')
LACE = dict(l1='#a8b0c8', l2='#e6ecf6')
PORC = dict(c1='#3a74c8', c2='#8ec4f4')
TEA = dict(t0='#4a2410', t1='#9a5a1e', t2='#e0a040', t3='#ffe6a0')
SOAP = dict(b1='#e878b8', b2='#ffc0e4', b3='#8ef0f0')
WOOD = dict(w1='#7a4c22', w2='#c89048')
P = pal(NAVY, LACE, PORC, TEA, SOAP, WOOD, WHITE)


def broom(c, hx, hy, ang, L):
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    ex, ey = hx + ux * L, hy + uy * L
    c.line([(hx, hy), (ex, ey)], 'w1', 2)
    c.px(hx + ux, hy + uy, 'w2')
    bx, by = ex + ux * 6, ey + uy * 6
    c.poly([(ex + vx * 2, ey + vy * 2), (bx + vx * 5, by + vy * 5), (bx - vx * 5, by - vy * 5), (ex - vx * 2, ey - vy * 2)], 't1')
    c.poly([(ex + vx * 1, ey + vy * 1), (bx + vx * 3, by + vy * 3), (bx - vx * 1, by - vy * 1), (ex, ey)], 't2')
    c.line([(ex + vx * 2.5 + ux, ey + vy * 2.5 + uy), (ex - vx * 2.5 + ux, ey - vy * 2.5 + uy)], 'b1')


@sheet('maid_broom', 64, 8, 'allTargets', P)
def broom_sweep(c, f):
    """빗자루 쓸기: a big broom swings across low to the ground, kicking a grey dust cloud that rolls away left."""
    a = math.radians([-30, 10, 50, 95, 140, 175, 200, 215][f])
    hx, hy = 32, 20
    if f in (1, 2, 3, 4):
        c.sweep(hx, hy, 34, math.degrees(a) - 40, math.degrees(a), 3, ['l1', 'l2'], squash=0.9)
    broom(c, hx, hy, math.radians(40 + f * 12), 22)
    if f >= 2:
        u = (f - 2) / 5
        for i in range(3):
            x = 40 - u * 28 - i * 6
            c.puff(x, 52 - i, 5 + u * 4 - i, ['l1', 'l2', 'w'], seed=i + f, lobes=4)
        burst(c, 36, 52, u, 12, 4, ['l2', 'l1', 'n1'], spd=(8, 24), grav=0.3, spread=(2.4, 3.9))
    if f in (3, 4):
        c.spark(18, 44, 4, 'w', 'l2')


def duster(c, hx, hy, ang, L):
    ux, uy = math.cos(ang), math.sin(ang)
    c.line([(hx, hy), (hx + ux * L, hy + uy * L)], 'w1', 2)
    for i in range(7):
        a = ang + (i - 3) * 0.35
        c.feather(hx + ux * (L + 4) + math.cos(a) * 3, hy + uy * (L + 4) + math.sin(a) * 3, a, 7,
                  'b1' if i % 2 else 'b2', 'w')


@sheet('maid_duster', 64, 10, 'target', P)
def duster_flurry(c, f):
    """먼지떨이 난무: a pink feather duster pats the foe from alternating sides, puffs of dust and loose feathers pop each hit."""
    t = f / 9
    spots = [(26, 26), (38, 40), (24, 42), (40, 24), (32, 34)]
    k = f // 2
    sx, sy = spots[min(k, 4)]
    side = 1 if k % 2 else -1
    hit = f % 2 == 1
    reach = 8 if hit else 14
    ang = math.radians(200 if side > 0 else -20) + (0.3 if hit else -0.2)
    duster(c, sx - math.cos(ang) * (reach + 8), sy - math.sin(ang) * (reach + 8), ang, reach)
    if hit:
        c.puff(sx, sy, 6, ['l1', 'l2', 'w'], seed=f, lobes=5)
        c.spark(sx, sy - 6, 3, 'w', 'b2')
    for j in range(k + 1):
        rr = rng(j + 3)
        x = rr.uniform(12, 52)
        y = 10 + ((t * 30 + j * 11) % 44)
        c.feather(x, y, math.sin(f + j) * 1.2, 5, 'b2', 'w')
    if f >= 8:
        c.twinkles(t, 5, 5, 'w', 'b3', (10, 12, 54, 54))


@sheet('maid_plate', 32, 4, 'projectile', P)
def plate(c, f):
    """접시 던지기: a porcelain plate spinning flat as it flies LEFT (rim tilts through four phases), air lines behind."""
    ry = [5, 3, 1.5, 3][f]
    x, y = 12, 16
    for j in range(3):
        c.line([(x + 11 + j * 3, y - 3 + j * 3), (x + 16 + j * 3 + (f % 2) * 2, y - 3 + j * 3)], 'l1')
    c.oval(x, y, 9, ry + 1, 'n0')
    c.oval(x, y, 8, ry, 'l2')
    if ry >= 3:
        c.oval(x, y, 5, ry - 1.4, 'w')
        c.oval(x, y, 8, ry, 'c1', 1)
        c.px(x - 3, y - 1, 'c2')
    else:
        c.line([(x - 8, y), (x + 8, y)], 'c1')
    c.px(x - 6 + f * 3, y - ry, 'w')


def cup(c, x, y, s):
    c.oval(x, y + 5 * s, 7 * s, 2 * s, 'l1')
    c.oval(x, y + 4.5 * s, 6 * s, 1.5 * s, 'l2')
    c.poly([(x - 5 * s, y - 1 * s), (x + 5 * s, y - 1 * s), (x + 3.5 * s, y + 4 * s), (x - 3.5 * s, y + 4 * s)], 'l2')
    c.poly([(x - 5 * s, y - 1 * s), (x - 1 * s, y - 1 * s), (x - 1.6 * s, y + 4 * s), (x - 3.5 * s, y + 4 * s)], 'w')
    c.line([(x - 4 * s, y + 1 * s), (x + 4 * s, y + 1 * s)], 'c1')
    c.oval(x, y - 1 * s, 5 * s, 1.2 * s, 't1')
    c.ring(x + 6 * s, y + 1 * s, 1.8 * s, 'l1', 1)


@sheet('maid_tea', 64, 10, 'target', P)
def tea(c, f):
    """홍차 한 잔: a teapot tips and pours an amber stream into a cup, curls of steam rise and warm motes heal the ally."""
    t = f / 9
    tilt = min(0.6, f * 0.15)
    px_, py_ = 40, 16 + [6, 2, 0, 0, 0, 0, 0, 0, 0, 0][f]
    for j in range(2):
        c.wave(px_ - 1 + j * 3, py_ - 9, px_ + j * 3, py_ - 15, 1, 1.0, f * 1.3 + j * 2, 'l2' if j else 'w')
    c.oval(px_, py_, 8, 6, 'n0')
    c.oval(px_, py_, 7, 5, 'c1')
    c.oval(px_ - 2, py_ - 2, 3, 2, 'c2')
    c.rect(px_ - 1, py_ - 8, px_ + 1, py_ - 6, 'c1')
    sx, sy = px_ - 7 - tilt * 3, py_ + tilt * 5
    c.line([(px_ - 5, py_), (sx - 3, sy - 3 + tilt * 4)], 'c1', 2)
    c.ring(px_ + 8, py_, 3, 'c1', 1)
    cup(c, 22, 40, 1.0)
    if 2 <= f <= 6:
        wob = (f % 2)
        c.line([(sx - 3, sy - 2 + tilt * 4), (sx - 4 + wob, 30), (22, 38)], 't2', 2)
        c.line([(sx - 3, sy - 2 + tilt * 4), (22, 38)], 't3', 1)
        c.px(22 + wob, 36, 'w')
    if f >= 4:
        u = (f - 4) / 5
        for j in range(3):
            x0 = 18 + j * 4
            c.wave(x0, 34, x0 + 2, 34 - 10 - u * 12, 1.4, 1.2, f * 0.8 + j, 'l2' if j % 2 else 'w')
    if f >= 6:
        u = (f - 6) / 3
        c.rise(u, 12, 7, ['t3', 't2', 'b2'], 10, 54, 54, 8, sway=2, size=2)
        c.ring(32, 34, 10 + u * 12, 't2', 1, squash=0.8)
        if f >= 7:
            c.heartp(32, 22 - u * 8, 2.5, 'b1', 'n1')


@sheet('maid_bubbles', 64, 10, 'allTargets', P)
def bubbles(c, f):
    """비눗물 파도: a foamy wave of soap bubbles rolls in from the right, bubbles pop into sparkles over the slipping foes."""
    t = f / 9
    front = 60 - t * 58
    for x in range(int(front), 64):
        d = x - front
        top = 46 + 2.5 * math.sin(x * 0.35 + f * 1.1) - min(6, d * 0.8)
        for y in range(int(top), 62):
            k = 'c1' if y > top + 5 or d < 2 else 'c2'
            if y >= 58 and (x + y) % 2:
                continue
            c.px(x, y, k)
        c.px(x, top, 'l2')
    for i in range(7):
        bx = front + 2 + i * 6
        c.disc(bx, 40 + 2.5 * math.sin(bx * 0.35 + f * 1.1) - 1, 2.2 + (i % 2), 'l2')
        c.px(bx - 1, 39 + 2.5 * math.sin(bx * 0.35 + f * 1.1) - 1, 'w')
    rr = rng(8)
    for i in range(18):
        bx = rr.uniform(0, 64)
        by = rr.uniform(10, 52)
        born = rr.uniform(0, 0.8)
        if bx < front - 2 and t + 0.1 < born:
            continue
        age = max(0.0, t - born)
        r = rr.uniform(2, 5)
        y = by - age * 18
        if age > 0.35 and (i + f) % 3 == 0:
            c.spark(bx, y, 2, 'w', 'b3')
            continue
        k = ['b1', 'b3', 'c2'][i % 3]
        c.ring(bx, y, r, k, 1)
        c.px(bx - r * 0.4, y - r * 0.5, 'w')
        if r > 3:
            c.px(bx + r * 0.3, y + r * 0.4, 'b2')
    if f >= 6:
        c.twinkles(t, 5, 3, 'w', 'b2', (6, 14, 58, 54))


@sheet('maid_clean_sky', 128, 12, 'screen', pal(NAVY, LACE, PORC, SOAP, pick(TEA, 't2'), WOOD, WHITE))
def clean_sky(c, f):
    """대청소 대작전: the stage dims, a whirlwind of laundry, brooms and soap bubbles spins around the middle, then a sparkling burst."""
    t = f / 11
    dark = min(1, t * 3) if f < 10 else max(0, 1 - (f - 9) / 2)
    shade(c, 64, 64, 30 + 34 * dark, 'n0')
    g = ease(min(1.0, (f + 1) / 5))
    rot = f * 0.5
    for j in range(3):
        c.arc(64, 64, (22 + j * 12) * g, (f * 30 + j * 100) % 360, (f * 30 + j * 100 + 200) % 360, 'l1' if j % 2 else 'c2', 1, squash=0.55)
    items = 10
    for i in range(items):
        a = rot + i * 2 * math.pi / items
        rad = (20 + (i % 3) * 12) * g
        x, y = pol(64, 64 - i * 1.5 + 6, rad, a, 0.55)
        kind = i % 4
        if kind == 0:
            c.poly([(x - 5, y - 4), (x + 5, y - 4), (x + 4, y + 5), (x - 4, y + 5)], 'l2')
            c.line([(x - 5, y - 4), (x + 5, y - 4)], 'c1')
        elif kind == 1:
            c.line([(x - 6, y + 3), (x + 4, y - 3)], 'w1', 2)
            c.poly([(x + 4, y - 3), (x + 9, y - 7), (x + 10, y - 1)], 't2')
        elif kind == 2:
            c.ring(x, y, 4, 'b1', 1)
            c.px(x - 1, y - 2, 'w')
        else:
            c.poly([(x - 4, y - 3), (x + 4, y - 3), (x + 3, y + 3), (x - 3, y + 3)], 'b2')
            c.line([(x - 4, y - 3), (x + 4, y - 3)], 'b1')
    rr = rng(6)
    for i in range(20):
        a = rot * 1.4 + rr.uniform(0, 6.28)
        x, y = pol(64, 70, rr.uniform(8, 48) * g, a, 0.5)
        c.ring(x, y - t * 20, 1.5, 'b3', 1)
    if f >= 8:
        u = (f - 8) / 3
        c.shock(64, 64, 16 + u * 30, ['c1', 'c2', 'w'], squash=0.6)
        c.twinkles(t, 10, 4, 'w', 'b3', (16, 20, 112, 108), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'maid_', 'people5-5', sys.argv[1:] or None) else 0)
