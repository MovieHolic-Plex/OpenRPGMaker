"""class_sailor (뱃사람) skill FX: anchor, water jet, rope, rum, harpoon, tide, sail, kraken.
Colour identity: sea blue + foam white, iron grey, rope tan, rum amber, kraken violet.
Run this file to rebuild every sailor sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

SEA = dict(s0='#0a1a40', s1='#16489a', s2='#2a86de', s3='#68d2f4', s4='#c6f6ff')
IRON = dict(i0='#20242e', i1='#464e60', i2='#8690a6', i3='#c6cedc')
ROPE = dict(r0='#4a2c14', r1='#8a5c2c', r2='#c8955a', r3='#f0d49a')
RUM = dict(m0='#5a2408', m1='#b0521a', m2='#f08a26', m3='#ffd060')
KRK = dict(k0='#1c0630', k1='#4a1a6e', k2='#8a34a8', k3='#d070d8', k4='#f6b8f0')
CANVAS = 64


def anchor(c, x, y, s=1.0, rot=0.0, keys=('i0', 'i1', 'i2', 'i3'), stock='r1'):
    """Ship anchor centred at (x, y), ring up; rot in radians (0 = upright). s scales it (1.0 = 22px tall)."""
    k0, k1, k2, k3 = keys

    def T(dx, dy):
        dx, dy = dx * s, dy * s
        return (x + dx * math.cos(rot) - dy * math.sin(rot), y + dx * math.sin(rot) + dy * math.cos(rot))
    for k, g in ((k0, 1.6), (k1, 0.0)):
        c.ring(*T(0, -9), 2.7 * s + g * 0.4, k, 1 if g == 0 else 2)
        c.line([T(0, -6.5), T(0, 8)], k, max(1, int(round(2 * s + g))))
        arm = [T(-7.5, 2.5), T(-6, 6), T(-3, 8), T(0, 8.6), T(3, 8), T(6, 6), T(7.5, 2.5)]
        c.line(arm, k, max(1, int(round(2 * s + g))))
        for sx in (-1, 1):
            c.poly([T(sx * 7.6, 1.5), T(sx * 9.5, 4), T(sx * 5.5, 4.6)], k)
    c.line([T(-5, -5), T(5, -5)], stock, max(1, int(round(2 * s))))
    c.line([T(-0.6, -6.5), T(-0.6, 7)], k2)
    c.px(*T(-0.6, -9 - 2.7), k3)
    for sx in (-1, 1):
        c.px(*T(sx * 8, 3.4), k3)


def rope_path(x0, y0, x1, y1, sag, wob, ph):
    return lambda u: (lerp(x0, x1, u), lerp(y0, y1, u) + sag * math.sin(math.pi * u) + wob * math.sin(u * 9 + ph))


def rope(c, path, w=2, steps=40, k1='r1', k2='r2', k3='r3', tw=0.0):
    pts = [path(i / steps) for i in range(steps + 1)]
    c.line(pts, 'r0', w + 2)
    c.line(pts, k1, w)
    for i in range(0, steps, 2):
        c.px(*pts[i], k2 if (i // 2 + int(tw)) % 2 else k3)


@sheet('sailor_anchor_slam', 64, 9, 'target', pal(SEA, IRON, pick(ROPE, 'r0', 'r1', 'r2'), WHITE))
def anchor_slam(c, f):
    """닻 내려치기: a heavy anchor drops on the target, shock ring, water crown."""
    ys = [4, 14, 28, 33, 33, 33, 33, 33, 33]
    rot = [0.1, 0.05, 0, -0.06, -0.06, -0.06, -0.06, -0.06, -0.06]
    if f <= 3:
        if f < 3:
            for i in range(3):
                c.line([(26 + i * 5, ys[f] - 16 - i * 3), (26 + i * 5, ys[f] - 8)], 'i2' if i == 1 else 's3')
        anchor(c, 32, ys[f] - (0 if f == 3 else 2), 1.15 if f >= 2 else 0.95, rot[f])
    if f == 2:
        c.oval(32, 50, 14, 3, 's1')
    if f >= 3:
        t = (f - 3) / 5
        c.shock(32, 51, 8 + t * 22, ['s1', 's3', 's4'], squash=0.32, w=1 if t < .6 else 1)
        if f <= 6:
            c.spikes(32, 51, 9, 3, [10 + 8 * (1 - t), 16 + 6 * (1 - t), 12], ['s2', 's3', 's4'], span=(-2.7, -0.44), width=1.1)
        c.crown(32, 48, t, 26, ['s4', 's3', 's2', 's1'], n=18, seed=3, size=2)
    if f == 3:
        pow_burst(c, 32, 46, 12, ['s2', 's4', 'w'], n=8)
        c.px(21, 34, 'w')
    if f >= 3:
        anchor(c, 32, 34 + (f - 3) // 2, 1.15, -0.06) if f in (4, 5) else None
    if f in (4, 5):
        pass
    if f >= 6:
        c.dring(32, 51, 20 + (f - 6) * 3, 's2', squash=0.32)


@sheet('sailor_jet', 32, 4, 'projectile', pal(SEA, WHITE))
def jet(c, f):
    """물대포 탄: a fat water jet, blunt foam head on the LEFT, wavy tail streaming right."""
    X, Y = 8, 16
    for i, (dy, k, w) in enumerate(((0, 's1', 9), (0, 's2', 7), (-1, 's3', 4))):
        pts = [(X + 2 + j * 1.6, Y + dy + math.sin(j * 0.9 + f * 1.6 + i) * (0.5 + j * 0.16) * (1 if i < 2 else 0.6)) for j in range(15)]
        c.line(pts, k, max(1, int(w - 0.4 * len(pts) // 8)))
    for j in range(6):
        c.px(X + 8 + j * 4 + (f * 3 + j * 5) % 5, Y - 5 + (j * 7 + f * 2) % 11, 's4' if j % 2 else 's3')
    c.disc(X, Y, 5.5, 's1')
    c.disc(X, Y, 4.5, 's2')
    c.disc(X - 1, Y - 1, 3, 's3')
    c.px(X - 2, Y - 2, 'w')
    c.crown(X + 1, Y, 0.3 + f * 0.1, 8, ['w', 's4', 's3'], n=7, seed=f + 1, spread=(-2.8, 2.8))


@sheet('sailor_jet_hit', 64, 8, 'target', pal(SEA, WHITE))
def jet_hit(c, f):
    """물대포 착탄: a blast of water bursts on the target and rains down."""
    t = f / 7
    if f <= 2:
        r = [8, 14, 18][f]
        c.disc(32, 36, r * 0.55, 's1')
        c.disc(32, 36, r * 0.4, 's2')
        c.disc(31, 35, r * 0.22, 's3')
        c.spikes(32, 36, 10, r * 0.4, [r * 1.5, r * 1.1, r * 1.35], ['s2', 's3', 's4'], rot=0.2 * f, width=1.1)
    if f >= 2:
        c.crown(32, 40, (f - 2) / 6, 27, ['w', 's4', 's3', 's2'], n=22, seed=9, spread=(-3.0, -0.14), size=2)
        c.shock(32, 52, 6 + (f - 2) * 5, ['s1', 's3', 's4'], squash=0.3)
    if f in (2, 3):
        c.spikes(32, 44, 7, 3, [12, 17, 14], ['s2', 's3', 's4'], span=(-2.5, -0.64), width=1.0)
    if f >= 5:
        c.fall(t, 8, 4, ['s3', 's4'], 12, 52, 30, 54, size=2)


@sheet('sailor_rope_whip', 64, 8, 'allTargets', pal(ROPE, IRON, WHITE, pick(SEA, 's3', 's4')))
def rope_whip(c, f):
    """밧줄 채찍: a thick rope lassoes around the target in loops and snaps with a knot."""
    a = f * 0.9
    for loop, (rx, ry, y0) in enumerate(((17, 5, 44), (14, 4.5, 36), (11, 4, 28))):
        if f < loop:
            continue
        end = min(1.0, (f - loop + 1) / 3.5)
        pts = [(32 + math.cos(a * 0.4 + u * 6.28 * end + loop) * rx, y0 + math.sin(a * 0.4 + u * 6.28 * end + loop) * ry) for u in [i / 24 for i in range(25)]]
        c.line(pts, 'r0', 4)
        c.line(pts, 'r1', 2)
        for i in range(0, 25, 2):
            c.px(*pts[i], 'r3' if i % 4 == 0 else 'r2')
    if f <= 4:
        tail = [(32 + 24 + f * 0 + u * 6, 30 - u * 22 + math.sin(u * 8 + f) * 3) for u in [i / 10 for i in range(11)]]
        c.line(tail, 'r0', 4)
        c.line(tail, 'r2', 2)
    if f >= 3:
        c.spark(32, 36, 3 + (f == 4) * 3, 'w', 'r3')
    if f >= 5:
        c.crown(32, 36, (f - 5) / 3, 20, ['r3', 'r2', 's3'], n=10, seed=2, spread=(-3.0, -0.1))
        c.px(32 + (f - 5) * 8, 20, 'i3')


@sheet('sailor_rum', 64, 10, 'user', pal(RUM, pick(IRON, 'i1', 'i2', 'i3'), pick(ROPE, 'r1', 'r2'), WHITE))
def rum(c, f):
    """럼주 한 모금: a foaming tankard rises, amber courage rises around the sailor with bubbles."""
    t = f / 9
    c.oval(32, 56, 10 + 4 * math.sin(t * 6), 3, 'm0')
    if f >= 2:
        c.oval(32, 56, 8, 2, 'm1')
    # tankard near the head (f1..f6)
    if 1 <= f <= 6:
        ty = 20 - min(6, f) * 1.4
        tx = 46 - f * 1.2
        rot = -0.5 + min(f, 4) * 0.1
        c.rect(tx - 5, ty - 4, tx + 4, ty + 7, 'i1')
        c.rect(tx - 4, ty - 3, tx + 3, ty + 6, 'm2')
        c.rect(tx - 4, ty - 3, tx + 3, ty - 1, 'w')
        c.ring(tx + 6, ty + 2, 3, 'i2', 1)
        c.line([(tx - 5, ty + 1), (tx + 4, ty + 1)], 'i3')
        c.line([(tx - 3, ty + 3), (tx - 3, ty + 5)], 'm3')
        for i in range(3):
            c.px(tx - 3 + i * 3, ty - 5 - (f + i) % 3, 'w')
    c.rise(t, 16, 5, ['m3', 'm2', 'm1'], 20, 44, 52, 8, sway=3, size=2)
    if f >= 3:
        h = min(40, (f - 2) * 8)
        for yy in range(int(56 - h), 56):
            for xx in range(20, 45):
                if (xx + yy + f) % 3 == 0 and abs(xx - 32) < 12 - (yy % 5) * 0.4:
                    c.px(xx, yy, 'm1' if (xx + yy) % 2 else 'm2')
        for i in range(9):
            by = 54 - ((f * 6 + i * 9) % 44)
            bx = 22 + (i * 7) % 21
            c.ring(bx, by, 2 + i % 2, 'm3')
            c.px(bx - 1, by - 1, 'w')
    if f >= 5:
        c.twinkles(t, 5, 3, 'w', 'm3', (14, 10, 50, 50))
    if f >= 8:
        c.fall(t, 8, 2, ['m3', 'm2'], 14, 50, 6, 50, size=1)


@sheet('sailor_harpoon', 32, 4, 'projectile', pal(IRON, ROPE, SEA, WHITE))
def harpoon(c, f):
    """작살 탄: barbed iron harpoon flying LEFT, a rope trailing behind in a lazy wave."""
    X, Y = 9, 16
    pts = [(X + 12 + j * 1.9, Y + math.sin(j * 0.8 + f * 1.5) * (1 + j * 0.28)) for j in range(11)]
    c.line(pts, 'r0', 3)
    c.line(pts, 'r2', 1)
    for j in range(0, 11, 2):
        c.px(*pts[j], 'r3')
    c.line([(X + 2, Y), (X + 14, Y)], 'i0', 3)
    c.line([(X + 2, Y), (X + 14, Y)], 'i1', 1)
    c.poly([(X - 7, Y), (X, Y - 4), (X + 2.5, Y), (X, Y + 4)], 'i0')
    c.poly([(X - 6, Y), (X, Y - 3), (X + 1.5, Y), (X, Y + 3)], 'i3')
    c.poly([(X + 1.5, Y - 1), (X + 5, Y - 4.4), (X + 3.2, Y)], 'i2')
    c.poly([(X + 1.5, Y + 1), (X + 5, Y + 4.4), (X + 3.2, Y)], 'i2')
    c.px(X - 5, Y, 'w')
    c.px(X + 6 + f, Y - 2 - (f % 2), 's3')
    c.px(X + 8 + (f * 3) % 5, Y + 3, 's4')


@sheet('sailor_harpoon_hit', 64, 8, 'target', pal(IRON, ROPE, SEA, WHITE))
def harpoon_hit(c, f):
    """작살 착탄: the harpoon bites in, the rope snaps taut and hauls the target back."""
    if f == 0:
        c.line([(46, 30), (33, 34)], 'i0', 3)
        c.poly([(28, 35), (34, 32), (36, 35), (34, 38)], 'i3')
    else:
        sh = min(f, 3)
        hx, hy = 32 + (f - 1) * 0.5, 35
        pts = [(hx + 3 + u * 26, hy - 3 - u * 22 + (math.sin(u * 7 + f * 2) * (3 - min(f, 4) * 0.6)) * (1 - u)) for u in [i / 20 for i in range(21)]]
        c.line(pts, 'r0', 3)
        c.line(pts, 'r2', 1)
        c.line([(hx + 1, hy), (hx + 12, hy - 4)], 'i0', 3)
        c.poly([(hx - 5, hy), (hx, hy - 3.2), (hx + 2.5, hy), (hx, hy + 3.2)], 'i0')
        c.poly([(hx - 4, hy), (hx, hy - 2), (hx + 1.5, hy), (hx, hy + 2)], 'i3')
        c.poly([(hx + 1, hy - 2), (hx + 4, hy - 5), (hx + 3, hy)], 'i2')
        c.poly([(hx + 1, hy + 2), (hx + 4, hy + 5), (hx + 3, hy)], 'i2')
    if 1 <= f <= 3:
        pow_burst(c, 30, 35, 10 - f * 1.5, ['s2', 's4', 'w'], n=8)
    if f >= 3:
        for i in range(3):
            c.line([(44 + f * 2 + i * 3, 40 + i * 4), (52 + f * 2 + i * 3, 40 + i * 4)], 's3')
        c.arc(30, 36, 14 + f, 250, 300, 'w', 1)
    if f >= 5:
        c.crown(30, 36, (f - 5) / 3, 16, ['w', 's4', 's3'], n=10, seed=6)


@sheet('sailor_tidal_crash', 64, 10, 'target', pal(SEA, WHITE))
def tidal_crash(c, f):
    """파도 타고 내려찍기: a wave stands up, its lip curls over the target and crashes down."""
    if f <= 5:
        grow = min(1.0, (f + 1) / 4)
        cx, cy, R = 26 + f * 1.5, 50, 24
        end = 190 + 110 * grow + f * 8            # lip sweeps over the top and down the right side
        # water body under the lip
        pts = [(cx - R, 56), (cx - R, cy)]
        a = 180
        while a <= end:
            pts.append(pol(cx, cy, R - 4, math.radians(a), 1.0))
            a += 12
        pts.append((pts[-1][0], 56))
        c.poly(pts, 's1')
        c.sweep(cx, cy, R, 180, end, 9, ['s1', 's2', 's3', 's4'])
        c.sweep(cx, cy, R - 7, 190, end - 25, 5, ['s0', 's1'])
        lip = pol(cx, cy, R - 1, math.radians(end), 1.0)
        for i in range(6):
            c.px(lip[0] + (i * 3) % 7 - 3, lip[1] + (i * 5) % 6 - 1 + (f - 2), 'w')
        c.spark(lip[0], lip[1], 2, 'w', 's4')
        c.line([(cx - R + 2, 56), (cx + R * 0.3, 56)], 's2')
        if f >= 4:
            c.spikes(lip[0], lip[1] + 2, 6, 2, [8, 11, 7], ['s3', 's4'], span=(0.3, 2.6))
    else:
        u = (f - 5) / 4
        c.disc(32, 46, 21 - u * 6, 's1')
        c.oval(32, 47, 24 - u * 4, 11 - u * 4, 's2')
        c.oval(31, 43, 17 - u * 4, 7, 's3')
        c.shock(32, 52, 12 + u * 16, ['s1', 's3', 's4'], squash=0.3)
        c.crown(32, 44, u, 30, ['w', 's4', 's3', 's2'], n=24, seed=8, spread=(-3.0, -0.14), size=2)
        if f == 6:
            pow_burst(c, 32, 40, 14, ['s2', 's4', 'w'], n=8)


@sheet('sailor_hoist_sail', 64, 10, 'allAllies', pal(pick(ROPE, 'r0', 'r1', 'r2', 'r3'), pick(SEA, 's1', 's3', 's4'), pick(IRON, 'i1', 'i2', 'i3'), WHITE))
def hoist_sail(c, f):
    """돛을 올려라: a sail is hoisted behind the ally and fills with wind."""
    t = f / 9
    top = lerp(52, 8, min(1, t * 1.5))
    fill = 0 if f < 5 else min(4, f - 4)
    mast = 46
    c.line([(mast, 8), (mast, 56)], 'r0', 3)
    c.line([(mast, 8), (mast, 56)], 'r1', 1)
    # sail cloth (billow to the left as the wind fills it)
    left = 20 - fill
    pts = [(mast - 2, top), (left + 6, top + 1), (left - fill * 0.6, top + (52 - top) * 0.45), (left + 4, 50), (mast - 2, 50)]
    c.poly(pts, 'r3')
    c.poly([(mast - 3, top + 2), (left + 8, top + 3), (left + 2 - fill * 0.4, top + (52 - top) * 0.45), (mast - 3, 48)], 'w')
    for i in range(1, 4):
        y = top + i * (50 - top) / 4
        c.line([(mast - 2, y), (left + 4 - fill * 0.3, y + 1)], 'r2')
    c.line([(mast - 2, top), (mast - 2, 50)], 'r1', 1)
    c.line([(left + 6, top + 1), (left - fill * 0.6, top + (52 - top) * 0.45), (left + 4, 50)], 'r1')
    c.line([(mast, 8), (mast + 8, 6 + (f % 2))], 'r1')
    c.poly([(mast + 8, 5), (mast + 14, 8), (mast + 8, 11)], 'i3' if f % 2 else 'w')
    if f >= 4:
        for i in range(5):
            y = 14 + i * 8 + (f % 3)
            x = 6 + ((f * 5 + i * 9) % 24)
            c.line([(x, y), (x + 9, y)], 's3' if i % 2 else 's4')
    if f >= 5:
        c.twinkles(t, 4, 5, 'w', 's3', (8, 10, 56, 54))
    c.oval(32, 57, 15, 2, 's1')
    c.line([(mast - 2, 50), (mast + 3, 54)], 'r2')


@sheet('sailor_kraken_sky', 128, 12, 'screen', pal(SEA, KRK, WHITE))
def kraken_sky(c, f):
    """크라켄의 부름: the sea darkens, a whirlpool opens and giant tentacles rise across the stage."""
    t = f / 11
    dark = min(1, t * 2.5) if f < 9 else max(0, 1 - (f - 8) / 3)
    if dark > 0:
        shade(c, 64, 64, 66 * min(1, dark + 0.2), 's0')
    # whirlpool
    if 1 <= f <= 10:
        for i in range(4):
            r = 46 - i * 9
            c.arc(64, 96, r, (f * 25 + i * 60) % 360, (f * 25 + i * 60) % 360 + 200, 's2' if i % 2 else 's3', 2, squash=0.32)
        c.oval(64, 96, 12, 4, 's0')
    # tentacles
    def tent(x0, sway, hgt, mirror, seed):
        def path(u):
            y = 118 - u * hgt
            x = x0 + mirror * (math.sin(u * 3.2 + sway) * 14 * u + u * u * 20)
            return (x, y)
        return path
    if 2 <= f <= 11:
        up = min(1, (f - 1) / 4) if f < 9 else max(0.0, 1 - (f - 8) / 3.5)
        for (x0, mir, h, sw) in ((26, 1, 84, 0.0), (98, -1, 92, 1.5), (52, -1, 62, 3.0), (78, 1, 70, 4.5)):
            H = h * up
            if H > 6:
                c.tube(tent(x0, sw + f * 0.25, H, mir, 1), 7, 2, ('k0', 'k1', 'k2'), steps=40, dots=3, dotk='k4')
    if f in (4, 5):
        c.spikes(64, 96, 18, 10, [40, 32, 46], ['s2', 's3', 's4'], span=(-3.0, -0.14), squash=0.7)
    c.crown(64, 100, t, 50, ['s4', 's3', 's2'], n=26, seed=4, spread=(-3.0, -0.14), size=2)
    if f >= 6:
        c.twinkles(t, 6, 9, 'w', 'k3', (18, 18, 110, 96))


@sheet('sailor_kraken_hit', 64, 10, 'allTargets', pal(SEA, KRK, WHITE))
def kraken_hit(c, f):
    """크라켄 촉수 강타: a tentacle slams down on the target, ink clouds and spray."""
    t = f / 9
    if f <= 5:
        d = min(1.0, f / 2.4)
        def path(u):
            return (46 - u * 14 + math.sin(u * 4) * 3, -6 + u * (44 * d) - (1 - d) * 0)
        c.tube(path, 6, 3, ('k0', 'k1', 'k2'), steps=28, dots=3, dotk='k4')
        if f < 3:
            for i in range(3):
                c.line([(50 + i * 3, 4 + i * 6), (50 + i * 3, 14 + i * 6)], 's3')
    if f >= 2:
        u = (f - 2) / 7
        c.puff(32, 44, 6 + u * 14, ['k1', 'k2', 'k3'], seed=3, lobes=6)
        c.shock(32, 52, 6 + u * 24, ['s1', 's3', 's4'], squash=0.3)
        c.crown(32, 46, u, 26, ['s4', 's3', 's2'], n=16, seed=5, spread=(-3.0, -0.14), size=2)
    if f == 2:
        pow_burst(c, 32, 44, 13, ['k2', 'k4', 'w'], n=8)
    if f >= 7:
        c.fall(t, 8, 1, ['k2', 'k3'], 12, 52, 30, 54)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'sailor_', 'people4-3', sys.argv[1:] or None) else 0)
