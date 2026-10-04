"""class_old_warrior (노병) skill FX: veteran thrusts, shield stance, war story, powder flask, medal light, phantom shield-wall sky.
Colour identity: tarnished bronze/brass, worn steel, faded army red, medal gold, powder smoke grey.
Reused layers (not drawn here): guard_bash, mage_fire_burst, hero_meteor_impact, guard_fortress_slam.
Run this file to rebuild every old warrior sheet and the review boards in .omo/r2w4/p5/."""
from lib_r2w4 import *
from lib_monk import chevron

BRONZE = dict(b0='#2a1a0e', b1='#6e4420', b2='#b07a38', b3='#e6bc72')
STEEL = dict(s1='#4e5a70', s2='#9aa8bc', s3='#e4ecf6')
ARMY = dict(r1='#7a1c20', r2='#c43a30')
MEDAL = dict(y2='#ffcc3a', y3='#fff2a8')
SMOKE = dict(q1='#4a4a56', q2='#8a8a96')
P = pal(BRONZE, STEEL, ARMY, MEDAL, SMOKE, WHITE)


def spear(c, x, y, ang, L):
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    c.line([(x - ux * L, y - uy * L), (x - ux * 5, y - uy * 5)], 'b1', 2)
    c.poly([(x, y), (x - ux * 6 + vx * 2.5, y - uy * 6 + vy * 2.5), (x - ux * 5, y - uy * 5), (x - ux * 6 - vx * 2.5, y - uy * 6 - vy * 2.5)], 's2')
    c.line([(x, y), (x - ux * 5, y - uy * 5)], 's3')


@sheet('old_warrior_thrust', 64, 10, 'target', P)
def thrust(c, f):
    """노련한 찌르기: five clean spear thrusts from the right, each a steel streak ending in a small puncture flash."""
    t = f / 9
    spots = [(30, 30), (26, 40), (34, 24), (28, 36), (32, 33)]
    k = f // 2
    x, y = spots[min(k, 4)]
    ang = math.pi + [0.1, -0.15, 0.25, 0.0, -0.05][min(k, 4)]
    if f % 2 == 0:
        spear(c, x + 12, y - math.sin(ang) * 12, ang, 20)
        c.line([(62, y - math.sin(ang) * 30), (x + 14, y - math.sin(ang) * 12)], 's1')
    else:
        c.line([(62, y - math.sin(ang) * 30), (x + 6, y)], 's2', 2)
        c.line([(60, y - math.sin(ang) * 28), (x + 6, y)], 's3')
        spear(c, x, y, ang, 22)
        pow_burst(c, x - 2, y, 6, ['r2', 's3', 'w'], rot=f * 0.5, n=6)
    for j in range(k):
        px_, py_ = spots[j]
        c.px(px_ - 2, py_, 'r2')
        c.px(px_ - 3, py_, 'r1')
    if f >= 9:
        c.spark(30, 33, 7, 'w', 's3')


def round_shield(c, x, y, r):
    c.disc(x, y, r + 1, 'b0')
    c.disc(x, y, r, 'b1')
    c.disc(x - 1, y - 1, r - 1.5, 'b2')
    c.ring(x, y, r - 1, 'b3', 1)
    c.disc(x, y, max(1, r * 0.28), 's2')
    c.px(x - 1, y - 1, 's3')
    for a in range(0, 360, 60):
        c.px(*pol(x, y, r - 3, math.radians(a)), 'b0')


@sheet('old_warrior_stance', 64, 10, 'user', P)
def stance(c, f):
    """방어 태세: a bronze round shield plants in front, boots stamp a dust ring, steel hex panels click into a guard dome."""
    t = f / 9
    g = ease(min(1.0, (f + 1) / 3))
    if f >= 1:
        u = min(1.0, (f - 1) / 4)
        c.ring(32, 55, 8 + u * 16, 'q2', 1, squash=0.25)
        if f <= 3:
            burst(c, 32, 55, u, 10, 2, ['q2', 'q1'], spd=(6, 16), grav=0.4, spread=(-3.1, -0.05))
    shown = min(10, max(0, f - 2) * 2)
    for i in range(shown):
        a = math.radians(200 + i * 14)
        x, y = pol(32, 44, 24, a, 0.9)
        c.diamond(x, y, 3, 3.5, 's1')
        c.diamond(x, y, 2, 2.5, 's2' if (i + f) % 3 else 's3')
    round_shield(c, 22, 36, 10 * g)
    if f in (4, 8):
        c.spark(18, 30, 5, 'w', 'y3')
    if f >= 6:
        c.twinkles(t, 4, 1, 'w', 's3', (8, 12, 56, 50))


@sheet('old_warrior_story', 64, 10, 'allAllies', P)
def story(c, f):
    """무용담: a faded army-red banner unfurls over the party, speech ticks pop up, and golden valour chevrons rise."""
    t = f / 9
    g = ease(min(1.0, (f + 1) / 4))
    x0 = 18
    c.line([(x0, 6), (x0, 40)], 'b1', 2)
    c.disc(x0, 6, 1.5, 'y2')
    L = 30 * g
    pts_top, pts_bot = [], []
    for i in range(11):
        u = i / 10
        wav = math.sin(u * 5 + f * 1.2) * 2 * u
        pts_top.append((x0 + 1 + u * L, 9 + wav))
        pts_bot.append((x0 + 1 + u * L, 23 + wav - u * 3))
    c.poly(pts_top + pts_bot[::-1], 'r1')
    c.poly(pts_top[:-2] + [(p[0], p[1] - 3) for p in pts_bot[:-2]][::-1], 'r2')
    if g > 0.6:
        mx, my = pts_top[5][0], pts_top[5][1] + 6
        c.disc(mx, my, 3, 'y2')
        c.px(mx - 1, my - 1, 'y3')
    for j in range(3):
        if (f + j) % 3 == 0 and f >= 2:
            bx, by = 44 + j * 5, 14 + j * 4
            c.rect(bx - 3, by - 2, bx + 3, by + 2, 's3')
            c.px(bx - 3, by + 3, 's3')
            c.px(bx - 1, by, 'b0')
            c.px(bx + 1, by, 'b0')
    if f >= 4:
        u = (f - 4) / 5
        for j in range(3):
            y = 54 - ((u * 30 + j * 10) % 30)
            chevron(c, 16 + j * 16, y, 3, 'y2', 'b0')
        c.rise(u, 10, 3, ['y3', 'y2', 'b3'], 8, 56, 56, 20, sway=2)


@sheet('old_warrior_flask', 32, 4, 'projectile', P)
def flask(c, f):
    """화약 항아리: a round clay powder jar tumbling LEFT, its lit fuse spitting sparks and grey smoke behind it."""
    x, y = 13, 17
    a = [0, 0.7, 1.4, 2.1][f]
    c.disc(x, y, 7, 'b0')
    c.disc(x, y, 6, 'b1')
    c.disc(x - 1.5, y - 1.5, 3.5, 'b2')
    c.line([(x - 5, y + 1), (x + 5, y + 1)], 'b0')
    nx, ny = pol(x, y, 6, a - math.pi / 2)
    c.disc(nx, ny, 1.5, 'b3')
    fx, fy = pol(x, y, 10, a - math.pi / 2 + 0.4)
    c.line([(nx, ny), (fx, fy)], 'q2')
    c.spark(fx, fy, 2 + (f % 2), 'y3', 'r2')
    for j in range(3):
        c.disc(x + 12 + j * 4, y - 4 + (j + f) % 3 - j, 1.5 + j * 0.3, 'q1' if j else 'q2')
    c.px(x + 10, y - 2 + f % 2, 'y2')


@sheet('old_warrior_medal', 64, 10, 'allAllies', P)
def medal(c, f):
    """훈장의 빛: a star medal on a red ribbon swings in overhead, flashes gold, and warm rays fall on the party as heal motes rise."""
    t = f / 9
    y = min(18, -4 + f * 8)
    sw = math.sin(f * 0.9) * 0.18 * (1 - t)
    mx = 32 + sw * 20
    c.poly([(mx - 4, y - 14), (mx + 4, y - 14), (mx + 2, y - 4), (mx - 2, y - 4)], 'r1')
    c.line([(mx - 1, y - 14), (mx - 1, y - 4)], 'r2')
    star(c, mx, y + 2, 5, 7, 3, 'b1', rot=-math.pi / 2 + sw)
    star(c, mx, y + 2, 5, 6, 2.6, 'y2', rot=-math.pi / 2 + sw)
    c.disc(mx, y + 2, 1.5, 'y3')
    if f >= 3:
        u = (f - 3) / 6
        if f in (3, 4):
            c.spark(mx, y + 2, 8 - (f - 3) * 2, 'w', 'y3', diag=True)
        c.rays(mx, y + 2, 8, 10, 12 + u * 30, 'y2', 1, rot=f * 0.1, squash=1.0)
        c.rise(u, 14, 8, ['y3', 'y2', 'b3'], 8, 56, 56, 22, sway=2, size=2)
        c.ring(32, 52, 8 + u * 18, 'y2', 1, squash=0.3)
    if f >= 7:
        c.twinkles(t, 5, 5, 'w', 'y3', (8, 20, 56, 54))


@sheet('old_warrior_ironwall_sky', 128, 12, 'screen', pal(BRONZE, STEEL, ARMY, pick(MEDAL, 'y2'), dict(z0='#10141e'), WHITE))
def ironwall_sky(c, f):
    """불굴의 방패벽: the stage dims, ghostly shields of old comrades fade in rank by rank, lock together, and a steel wall shock sweeps forward."""
    t = f / 11
    dark = min(1, t * 3) if f < 10 else max(0, 1 - (f - 9) / 2)
    shade(c, 64, 64, 30 + 34 * dark, 'z0')
    ranks = [(40, 9, 30), (60, 11, 54), (82, 12, 78)]
    for ri, (y, r, x0) in enumerate(ranks):
        shown = f - ri * 2
        if shown <= 0:
            continue
        n = 6 - ri
        span = [80, 72, 56][ri]
        step = span / max(1, n - 1)
        for i in range(n):
            if shown * 2 <= i:
                continue
            x = 64 - span / 2 + i * step
            ghost = shown < 3
            if ghost:
                c.ddisc(x, y, r, 's2', parity=f + i)
                c.ring(x, y, r, 's1', 1)
            else:
                c.disc(x, y, r + 1, 'b0')
                c.disc(x, y, r, 'b1' if ri != 1 else 's1')
                c.disc(x - 1, y - 1, r - 2, 'b2' if ri != 1 else 's2')
                c.ring(x, y, r - 1, 'b3' if ri != 1 else 's3', 1)
                c.disc(x, y, max(1, r * 0.3), 's3')
                c.line([(x - r * 0.6, y), (x + r * 0.6, y)], 'r2')
    if f >= 8:
        u = (f - 8) / 3
        yy = 98 - u * 8
        c.line([(20, yy), (108, yy)], 's3', 2)
        c.line([(24, yy + 3), (104, yy + 3)], 's2')
        burst(c, 64, yy, u, 16, 5, ['w', 's3', 's2'], spd=(20, 46), grav=0.6, squash=0.4, spread=(-3.1, -0.05))
    if f >= 6:
        c.twinkles(t, 6, 9, 'w', 'y2', (16, 24, 112, 104), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'old_warrior_', 'people5-7', sys.argv[1:] or None) else 0)
