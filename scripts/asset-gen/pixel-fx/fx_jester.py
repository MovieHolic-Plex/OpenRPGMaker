"""class_jester (광대) skill FX: juggling balls, confetti popper, jack-in-the-box, comedy/tragedy masks, balloon pop, carnival sky.
Colour identity: royal blue motley + gold bells, primary circus red/yellow/blue, white face paint.
Reused layers (not drawn here): scout_knife, scout_knife_hit, hero_whirl, bard_finale_hit.
Run this file to rebuild every jester sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

MOT = dict(b0='#0c1040', b1='#2939c5', b2='#2073ee', b3='#8ec4ff')
CIR = dict(r0='#5a0a18', r1='#d8283c', y1='#ffd640', y2='#fff4a0', g1='#34b04c', p1='#ff6cb0')
INK = dict(k0='#140e1c', k1='#6a5a7a')
P = pal(MOT, CIR, INK, WHITE)
BALL = ['r1', 'y1', 'b2', 'g1', 'p1']


def ball(c, x, y, k, r=2.5):
    c.disc(x, y, r + 1, 'k0')
    c.disc(x, y, r, k)
    c.px(x - r * 0.4, y - r * 0.4, 'w')


def dither_cone(c, apex, tip, half, k, parity=0):
    """Spotlight cone from apex widening to +-half at tip, drawn on a 1-in-2 checker so it stays see-through."""
    (ax, ay), (tx, ty) = apex, tip
    L = math.hypot(tx - ax, ty - ay) or 1
    ux, uy = (tx - ax) / L, (ty - ay) / L
    for y in range(int(min(ay, ty)) - half - 1, int(max(ay, ty)) + half + 2):
        for x in range(int(min(ax, tx)) - half - 1, int(max(ax, tx)) + half + 2):
            if (x + y + parity) % 2:
                continue
            dx, dy = x - ax, y - ay
            along = dx * ux + dy * uy
            if 0 <= along <= L and abs(-dx * uy + dy * ux) <= half * along / L:
                c.px(x, y, k)


@sheet('jester_juggle', 64, 10, 'target', P)
def juggle(c, f):
    """저글링: five balls wheel in an arc over the foe, then peel off one by one and bonk down onto it."""
    t = f / 9
    for i in range(5):
        drop = 3 + i
        if f < drop:
            a = math.pi + (t * 2.4 + i / 5) * 2 * math.pi
            x, y = pol(32, 22, 18, a, 0.55)
            ball(c, x, y, BALL[i])
            c.px(*pol(32, 22, 18, a - 0.35, 0.55), 'k1')
        elif f < drop + 2:
            u = (f - drop + 1) / 2
            x0, y0 = pol(32, 22, 18, math.pi + i, 0.55)
            x, y = lerp(x0, 26 + i * 3, u), lerp(y0, 36, u * u)
            ball(c, x, y, BALL[i], 3)
            c.line([(x, y - 3), (x, y - 7)], 'k1')
        elif f == drop + 2:
            pow_burst(c, 26 + i * 3, 36, 7, ['k0', BALL[i], 'w'], n=6)
            c.spark(26 + i * 3, 34, 3, 'w', 'y2')
    if f >= 5:
        c.twinkles(t, 5, 2, 'w', 'y1', (8, 12, 56, 48))


@sheet('jester_confetti', 64, 8, 'allTargets', P)
def confetti(c, f):
    """색종이 폭죽: a striped cone popper bursts over the foe and showers tumbling paper squares and streamers."""
    t = f / 7
    if f <= 2:
        s = [4, 7, 5][f]
        c.poly([(32, 18 - s), (32 - s, 18 + s * 1.6), (32 + s, 18 + s * 1.6)], 'r1', 'k0')
        c.line([(32 - s * 0.5, 18 + s * 0.3), (32 + s * 0.5, 18 + s * 0.3)], 'y1')
        if f == 2:
            pow_burst(c, 32, 12, 12, ['k0', 'y1', 'w'], n=10)
    if f >= 2:
        rr = rng(11)
        for i in range(34):
            a = rr.uniform(-math.pi, 0)
            v = rr.uniform(10, 28)
            u = (f - 2) / 5
            x = 32 + math.cos(a) * v * ease(min(1, u * 1.6)) + math.sin(u * 8 + i) * 2
            y = 14 + math.sin(a) * v * 0.7 * ease(min(1, u * 1.6)) + u * u * 34
            k = BALL[i % 5]
            if i % 4 == 0:
                c.line([(x, y), (x + math.sin(i + f) * 3, y + 3)], k)
            elif (i + f) % 2:
                c.rect(x, y, x + 1, y + 1, k)
            else:
                c.px(x, y, k)
    if f >= 3:
        c.spark(20 + f * 2, 20, 2, 'w', 'y2')


@sheet('jester_jack_box', 64, 10, 'target', P)
def jack_box(c, f):
    """깜짝 상자: a gift box lands at the foe, the lid pops, a spring boxing-glove shoots out and slugs it, then boings back."""
    t = f / 9
    # 0: the box drops in from above with speed lines, 1: it lands and squashes.
    bx, by = 38, [36, 51, 50, 50, 50, 50, 50, 50, 50, 50][f]
    if f == 0:
        for j in (-4, 0, 4):
            c.line([(bx + j, by - 22), (bx + j, by - 15)], 'b3')
    if f == 1:
        c.shock(bx, by + 1, 10, ['k1', 'b3'], squash=0.25)
        for s in (-1, 1):
            c.px(bx + s * 11, by - 2, 'y2')
            c.px(bx + s * 13, by - 4, 'w')
    c.rect(bx - 7, by - 10, bx + 7, by, 'k0')
    c.rect(bx - 6, by - 9, bx + 6, by - 1, 'r1')
    c.rect(bx - 1, by - 9, bx + 1, by - 1, 'y1')
    c.line([(bx - 6, by - 5), (bx + 6, by - 5)], 'y1')
    if f <= 1:
        c.rect(bx - 8, by - 13, bx + 8, by - 10, 'k0')
        c.rect(bx - 7, by - 12, bx + 7, by - 11, 'b2')
        c.px(bx - 1 + f, by - 14, 'y2')
    else:
        c.poly([(bx + 6, by - 10), (bx + 14, by - 20), (bx + 16, by - 18), (bx + 8, by - 9)], 'b2', 'k0')
        ext = [0, 0, 8, 18, 22, 22, 18, 12, 6, 2][f]
        rise = [0, 0, 6, 8, 8, 8, 8, 6, 4, 2][f]
        pts = []
        for j in range(9):
            u = j / 8
            pts.append((bx - ext * u, by - 10 - rise * u + (2 if j % 2 else -2) * (1 - u * 0.3)))
        c.line(pts, 'k1', 2)
        c.line(pts, 'y2', 1)
        gx, gy = pts[-1]
        c.disc(gx - 3, gy, 5, 'k0')
        c.disc(gx - 3, gy, 4, 'r1')
        c.disc(gx - 4, gy - 1, 2, 'p1')
        c.rect(gx - 1, gy - 2, gx + 1, gy + 2, 'w')
        if f in (4, 5):
            pow_burst(c, gx - 9, gy, 9 + (f - 4) * 3, ['k0', 'y1', 'w'], n=8)
            c.spark(gx - 10, gy - 6, 4, 'w', 'y2')
        if f >= 6:
            for j in range(3):
                c.arc(gx - 3, gy, 7 + j * 2, 200, 260, 'b3', 1)
    if f >= 5:
        c.twinkles(t, 4, 6, 'w', 'y1', (6, 14, 30, 40))


def mask(c, x, y, s, happy, k='w'):
    c.oval(x, y, s + 1, s * 1.15 + 1, 'k0')
    c.oval(x, y, s, s * 1.15, k)
    ey = y - s * 0.3
    for sx in (-1, 1):
        if happy:
            c.arc(x + sx * s * 0.42, ey + 1, s * 0.25, 200, 340, 'k0', 1)
        else:
            c.arc(x + sx * s * 0.42, ey - 1, s * 0.25, 20, 160, 'k0', 1)
            c.px(x + sx * s * 0.42, ey + s * 0.35, 'b2')
    if happy:
        c.arc(x, y + s * 0.2, s * 0.5, 20, 160, 'r1', 2)
    else:
        c.arc(x, y + s * 0.75, s * 0.45, 200, 340, 'r1', 2)


@sheet('jester_masks', 64, 10, 'user', P)
def masks(c, f):
    """가면 바꾸기: a smiling and a weeping mask orbit the jester, flip over, and swap places in a puff of stars."""
    t = f / 9
    for i, happy in enumerate((True, False)):
        a = t * 2 * math.pi + i * math.pi
        x, y = pol(32, 26, 16, a, 0.45)
        front = math.sin(a) > 0
        s = 6 if front else 4.5
        flip = (f + i) % 5 == 2
        if flip:
            c.oval(x, y, 1.5, s * 1.15, 'k0')
            c.line([(x, y - s), (x, y + s)], 'y2')
        else:
            mask(c, x, y, s, happy ^ (f >= 5), 'w' if front else 'b3')
    if f in (4, 5):
        c.puff(32, 26, 7, ['k1', 'b3', 'w'], seed=3)
        c.spark(32, 18, 5, 'w', 'y1')
    for j in range(3):
        a = t * 4 + j * 2.1
        c.spark(*pol(32, 28, 22, a, 0.6), 1 + (f + j) % 2, 'y2', 'y1')
    c.ring(32, 52, 12, 'b1', 1, squash=0.3)


@sheet('jester_balloons', 64, 10, 'allTargets', P)
def balloons(c, f):
    """풍선 폭죽: a bunch of balloons floats up around the foe, then pops one after another into bright bangs."""
    t = f / 9
    spots = [(18, 26), (28, 18), (38, 22), (46, 30), (24, 34), (40, 38)]
    for i, (x, y) in enumerate(spots):
        k = BALL[i % 5]
        pop = 4 + i
        rise = min(1.0, (f + 1) / 4)
        yy = y + (1 - rise) * 20 + math.sin(t * 6 + i) * 1.2
        if f < pop:
            c.oval(x, yy, 4 + 1, 5 + 1, 'k0')
            c.oval(x, yy, 4, 5, k)
            c.px(x - 2, yy - 2, 'w')
            c.px(x - 1, yy - 3, 'w')
            c.poly([(x - 1, yy + 5), (x + 1, yy + 5), (x, yy + 7)], k)
            c.line([(x, yy + 7), (x + math.sin(i + f) * 2, yy + 13), (32, 54)], 'k1')
        elif f == pop:
            pow_burst(c, x, yy, 9, ['k0', k, 'w'], n=8)
            c.spark(x, yy, 4, 'w', 'y2')
        elif f == pop + 1:
            burst(c, x, yy, 0.6, 7, i, [k, 'y2', 'w'], spd=(6, 14), grav=0.5)
    if f >= 6:
        c.twinkles(t, 4, 8, 'w', 'y1', (10, 12, 54, 48))


@sheet('jester_carnival_sky', 128, 12, 'screen', pal(MOT, CIR, pick(INK, 'k0'), WHITE))
def carnival_sky(c, f):
    """대소동 카니발: a striped circus big-top unfurls over the stage, bunting swings, spotlights sweep and pies fly."""
    t = f / 11
    g = ease(min(1.0, (f + 1) / 5))
    shade(c, 64, 64, 34 + 30 * min(1, t * 3), 'b0')
    top = 12 + (1 - g) * 40
    W = 52 * g
    stripes = 10
    for i in range(stripes):
        x0 = 64 - W + i * (2 * W / stripes)
        x1 = x0 + 2 * W / stripes
        k = 'r1' if i % 2 == 0 else 'w'
        c.poly([(64, top), (x0, top + 34 * g), (x1, top + 34 * g)], k)
    c.line([(64 - W, top + 34 * g), (64 + W, top + 34 * g)], 'y1', 2)
    for i in range(stripes):
        x = 64 - W + (i + 0.5) * (2 * W / stripes)
        c.disc(x, top + 36 * g, 2 * g + 0.5, 'y1' if i % 2 else 'b2')
    c.line([(64, top), (64, top - 8)], 'k0', 2)
    c.poly([(64, top - 8), (74, top - 5), (64, top - 2)], 'y1')
    if f >= 3:
        for j in range(12):
            u = j / 11
            x = lerp(16, 112, u)
            y = 70 + 8 * math.sin(math.pi * u) + math.sin(f * 0.8 + j) * 1.2
            c.poly([(x - 3, y), (x + 3, y), (x, y + 5)], BALL[j % 5])
        c.line([(16, 70)] + [(lerp(16, 112, j / 11), 70 + 8 * math.sin(math.pi * j / 11)) for j in range(12)], 'k0')
    if f >= 4:
        for s, base in ((-1, 30), (1, 98)):
            a = math.pi / 2 + s * (0.3 + 0.35 * math.sin(f * 0.7 + s))
            tip = pol(base, 116, 70, -a)
            dither_cone(c, (base, 116), tip, 8, 'y2', parity=f)
            c.disc(base, 115, 2, 'y1')
    if f >= 6:
        for i in range(4):
            u = ((f - 6) / 5 + i * 0.27) % 1.0
            x = lerp(118, 12, u)
            y = 88 - 26 * math.sin(math.pi * u)
            c.oval(x, y, 5, 3, 'k0')
            c.oval(x, y - 1, 4, 2, 'y2')
            c.oval(x, y + 1, 4, 1.5, 'r1')
        c.twinkles(t, 8, 5, 'w', 'y1', (14, 20, 114, 110), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'jester_', 'people5-0', sys.argv[1:] or None) else 0)

