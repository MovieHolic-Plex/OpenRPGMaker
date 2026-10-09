"""class_nomad (유목민) skill FX: javelin, sand toss, bolas, mirage, dust devil, camel charge, oasis, desert wrath.
Colour identity: sand tan/ochre, dust brown, javelin steel, oasis teal + palm green, sun orange.
Run this file to rebuild every nomad sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

SAND = dict(s0='#5a3a1a', s1='#a06e32', s2='#dcaa5c', s3='#f6d896', s4='#fff4cc')
DUST = dict(d0='#3a2818', d1='#6e5034', d2='#a8865a')
STEEL = dict(i0='#20242e', i1='#464e60', i2='#8690a6', i3='#e0e8f4')
WOOD = dict(w0='#4a2c14', w1='#8a5c2c', w2='#c8955a')
OASIS = dict(a0='#0a3a48', a1='#1a8aa4', a2='#5ad0e0', a3='#c4f6fc', p1='#2c7a3c', p2='#5cb45c', p3='#a4e078')
SUN = dict(u1='#e8681a', u2='#ffa430', u3='#ffe070')
HEAT = dict(h1='#e8b878', h2='#f8dca8')
P = pal(SAND, DUST, STEEL, WOOD, OASIS, SUN, HEAT, WHITE)


def wind_lines(c, t, n, seed, x0, x1, y0, y1, keys=('s3', 's2', 's4'), L=(6, 14)):
    r = rng(seed)
    for i in range(n):
        ph = r.uniform(0, 1)
        y = r.uniform(y0, y1)
        ln = r.uniform(*L)
        u = (t + ph) % 1.0
        x = lerp(x1, x0 - ln, u)
        c.line([(x, y), (x + ln, y + math.sin(i) * 1.5)], keys[i % len(keys)])


@sheet('nomad_javelin', 32, 4, 'projectile', pal(STEEL, WOOD, SAND, WHITE))
def javelin(c, f):
    X, Y = 6, 16
    c.line([(X + 2, Y), (X + 26, Y)], 'w0', 3)
    c.line([(X + 2, Y), (X + 26, Y)], 'w1', 1)
    c.poly([(X - 4, Y), (X + 3, Y - 3), (X + 6, Y), (X + 3, Y + 3)], 'i1')
    c.poly([(X - 3, Y), (X + 3, Y - 2), (X + 4, Y), (X + 3, Y + 2)], 'i3')
    for j in range(3):
        c.line([(X + 20 + j * 2, Y), (X + 24 + j * 2, Y - 4 + (f % 2))], 's3')
        c.line([(X + 20 + j * 2, Y), (X + 24 + j * 2, Y + 4 - (f % 2))], 's2')
    for j in range(4):
        c.px(X + 10 + ((f * 5 + j * 6) % 20), Y + (j % 2) * 6 - 3, 's4')
    c.line([(X + 8, Y - 1), (X + 10, Y - 1)], 's2')


@sheet('nomad_javelin_hit', 64, 8, 'target', P)
def javelin_hit(c, f):
    """투창 착탄: the javelin buries in and quivers; dust bursts out of the wound."""
    sh = [0, 0, 1, -1, 1, 0, 0, 0][f]
    if f <= 6:
        x = 32 + sh
        c.line([(x, 36), (x + 22, 12)], 'w0', 4)
        c.line([(x, 36), (x + 22, 12)], 'w1', 2)
        c.poly([(x - 8, 40), (x - 1, 34), (x + 2, 36), (x, 39)], 'i1')
        c.poly([(x - 7, 40), (x - 1, 35), (x, 37)], 'i3')
        for j in range(3):
            c.line([(x + 18 + j * 2, 16 - j), (x + 24 + j * 2, 14 - j * 2)], 's3')
    if f <= 3:
        c.spark(28, 38, 6 - f, 'w', 's3')
        pow_burst(c, 30, 38, 11 - f * 2, ['s1', 's4', 'w'], n=8)
    if f >= 1:
        u = f / 7
        burst(c, 30, 40, u, 14, 3, ['s4', 's3', 's2', 's1'], spd=(8, 22), grav=0.6)
        c.puff(30, 42, 4 + u * 10, ['d1', 'd2', 's2'], seed=2, lobes=6) if f >= 2 else None
        c.shock(32, 54, 6 + u * 20, ['s1', 's3', 's4'], squash=0.3)


@sheet('nomad_sand_toss', 64, 8, 'target', P)
def sand_toss(c, f):
    """모래 뿌리기: a fistful of sand fans out in a wide arc and covers the target in a blinding cloud."""
    u = f / 7
    if f <= 3:
        c.spikes(56 - f * 6, 20 + f * 4, 14, 2, [10 + f * 4, 14 + f * 4, 8 + f * 3], ['s1', 's2', 's3'], span=(2.6, 3.9), width=0.7)
        rr = rng(4)
        for i in range(22):
            a = rr.uniform(2.5, 3.9)
            d = rr.uniform(6, 16 + f * 8)
            c.px(56 - f * 6 + math.cos(a) * d, 20 + f * 4 + math.sin(a) * d * 0.9 + 4, rr.choice(['s2', 's3', 's4']))
    if f >= 3:
        c.cloud(32, 36, 5 + (f - 3) * 5, ['s0', 's1', 's2', 's3'], seed=6, parity=f % 2)
        wind_lines(c, u, 6, 3, 6, 58, 26, 46)
    if f >= 5:
        c.rise(u, 14, 5, ['s4', 's3', 's2'], 12, 52, 50, 10, sway=4)
        for i in range(3):
            c.ring(32, 30, 8 + (f - 5) * 2 + i * 3, 's3', 1, squash=0.6) if i == 0 else None


@sheet('nomad_bolas', 32, 4, 'projectile', pal(WOOD, STEEL, SAND, WHITE))
def bolas(c, f):
    """볼라 탄: three stone weights on cords, spinning as a triangle; LEFT-flying."""
    X, Y = 15, 16
    a = f * 0.8
    pts = [pol(X, Y, 9, a + i * 2.09, 0.85) for i in range(3)]
    for p_ in pts:
        c.line([(X, Y), p_], 'w2')
    c.disc(X, Y, 1.5, 'w1')
    for i, p_ in enumerate(pts):
        c.disc(p_[0], p_[1], 3.4, 'i0')
        c.disc(p_[0], p_[1], 2.6, 'i1')
        c.px(p_[0] - 1, p_[1] - 1, 'i3')
    c.arc(X, Y, 11, 200, 260, 's3', 1, squash=0.85)
    c.arc(X, Y, 11, 20, 80, 's3', 1, squash=0.85)
    for j in range(3):
        c.px(X + 12 + j * 4 - (f % 2), Y + (j - 1) * 3, 's2')


@sheet('nomad_bolas_hit', 64, 8, 'target', P)
def bolas_hit(c, f):
    """볼라 착탄: the cords wrap round the legs; the stones swing and thump, the target trips."""
    u = f / 7
    wraps = min(4, f + 1)
    for i in range(wraps):
        y = 50 - i * 4
        a0 = 200 + i * 40
        c.arc(32, y, 12 + (i % 2), a0, a0 + 250, 'w0', 3, squash=0.32)
        c.arc(32, y, 12 + (i % 2), a0, a0 + 250, 'w2', 1, squash=0.32)
    for i in range(3):
        a = f * 0.55 + i * 2.09
        x, y = pol(32, 44, max(4, 18 - f * 1.8), a, 0.5)
        c.line([(32, 46), (x, y)], 'w1')
        c.disc(x, y, 3.4, 'i0')
        c.disc(x, y, 2.6, 'i1')
        c.px(x - 1, y - 1, 'i3')
    if f <= 3:
        pow_burst(c, 32, 46, 10 - f * 2, ['s1', 's4', 'w'], n=8)
    c.shock(32, 54, 6 + u * 18, ['s1', 's3', 's4'], squash=0.3)
    if f >= 3:
        c.puff(20, 52, 4 + u * 3, ['d1', 'd2', 's2'], seed=4)
        c.puff(44, 52, 4 + u * 3, ['d1', 'd2', 's2'], seed=5)
        c.rise(u, 6, 1, ['s3', 's4'], 14, 50, 50, 24, sway=2)


@sheet('nomad_mirage', 64, 10, 'user', P)
def mirage(c, f):
    """신기루: heat shimmer bands ripple upward, translucent dithered after-images split off both sides."""
    t = f / 10
    for i in range(7):
        y = 56 - ((i * 8 + f * 5) % 56)
        w = 18 - abs(y - 30) * 0.25
        c.wave(32 - w, y, 32 + w, y, 1.6, 2.5, t * 12 + i, 'h2', 1)
        if i % 2:
            c.wave(32 - w * 0.8, y + 2, 32 + w * 0.8, y + 2, 1.2, 3.0, -t * 10 + i, 'h1', 1)
    if f >= 2:
        off = min(1.0, (f - 1) / 4) * 16
        if f >= 8:
            off = off * (10 - f) / 2
        for sx in (-1, 1):
            x = 32 + sx * off
            for yy in range(12, 54):
                for xx in range(int(x) - 8, int(x) + 9):
                    if (xx + yy) % 2 == 0 and abs(xx - x) < 6 - abs(yy - 30) * 0.06 and 14 < yy < 52:
                        if abs(yy - 22) < 8 and abs(xx - x) < 4.5 or abs(yy - 38) < 14 and abs(xx - x) < 6.5:
                            c.px(xx, yy, 'a3' if sx > 0 else 'h2')
    c.oval(32, 56, 14, 3, 's0') if False else None
    c.twinkles(t, 6, 8, 'w', 's3', (10, 8, 54, 52))
    if f >= 3:
        c.arc(32, 30, 24, 180, 360, 'u2', 1, squash=0.5) if f % 2 else None
        c.disc(52, 8, 3, 'u3')


@sheet('nomad_dust_devil', 64, 10, 'allTargets', P)
def dust_devil(c, f):
    """모래회오리: a funnel of sand widens upward, layered swirl bands spin, debris flies off."""
    t = f / 10
    grow = min(1.0, (f + 1) / 4) if f < 8 else max(0.0, 1 - (f - 7) / 3)
    for row in range(14):
        y = 56 - row * 3.6 * grow
        rad = (4 + row * 1.6) * grow
        sx = math.sin(row * 0.5 + t * 12) * 2
        a0 = (t * 720 + row * 40) % 360
        k = ['s1', 's2', 's3', 's4'][row % 4] if row % 3 else 'd2'
        c.arc(32 + sx, y, rad, a0, a0 + 230, k, 2, squash=0.28)
        c.arc(32 + sx, y, rad, a0 + 20, a0 + 130, 's4', 1, squash=0.28)
    for i in range(10):
        a = t * 14 + i * 0.63
        d = (i * 5 + f * 4) % 28
        x, y = pol(32, 52 - d * 1.2, 6 + d * 0.9, a, 0.4)
        if grow > 0.2:
            c.px(x, y, 'd1' if i % 2 else 's3')
            c.px(x + 1, y, 'd2')
    c.oval(32, 57, 14 * grow, 3, 'd1')
    if 1 <= f <= 7:
        c.spikes(32, 56, 8, 3, [10, 8, 12], ['s2', 's3'], span=(-2.8, -0.34), squash=0.6)


@sheet('nomad_camel', 64, 8, 'target', P)
def camel(c, f):
    """낙타 돌격: a camel silhouette in ochre dashes in from the right with a spear-lunge and dust plume."""
    x = [70, 58, 46, 36, 30, 28, 28, 28][f]
    a = [0.0, 0.2, 0.4, 0.6, 1.0, 0.6, 0.3, 0.1][f]
    if f <= 6:
        # body
        y = 40 + (1 if f % 2 else 0)
        c.oval(x + 6, y, 12, 6, 's0')
        c.oval(x + 6, y, 11, 5, 's1')
        c.oval(x + 4, y - 1, 8, 3, 's2')
        c.disc(x + 1, y - 5, 4, 's1')            # front hump
        c.disc(x + 12, y - 5, 4, 's1')           # back hump
        c.disc(x + 1, y - 6, 2, 's2')
        c.disc(x + 12, y - 6, 2, 's2')
        # neck + head
        c.line([(x - 4, y - 2), (x - 9, y - 10), (x - 14, y - 12)], 's0', 4)
        c.line([(x - 4, y - 2), (x - 9, y - 10), (x - 14, y - 12)], 's1', 2)
        c.disc(x - 15, y - 12, 3, 's1')
        c.poly([(x - 21, y - 11), (x - 16, y - 14), (x - 15, y - 9)], 's2')
        c.px(x - 16, y - 13, 'i3')
        # legs
        for j, lx in enumerate((-2, 2, 10, 14)):
            sw = math.sin(f * 1.6 + j * 1.5) * 4
            c.line([(x + lx, y + 4), (x + lx + sw, y + 13)], 's0', 2)
        # spear
        c.line([(x + 4, y - 10), (x - 20, y - 8)], 'w1', 2)
        c.poly([(x - 26, y - 8), (x - 20, y - 11), (x - 20, y - 5)], 'i3')
        # saddle
        c.rect(x + 5, y - 8, x + 9, y - 4, 'r1' if False else 'u1')
    if f <= 6:
        for j in range(5):
            c.puff(x + 20 + j * 7 + 4, 52 - (j % 2) * 3, 3 + j * 0.8, ['d1', 'd2', 's2'], seed=j + f)
        for j in range(4):
            c.line([(x + 28 + j * 3, 30 + j * 6), (x + 42 + j * 3, 30 + j * 6)], 's3')
    if f >= 3:
        u = (f - 3) / 4
        pow_burst(c, 30, 40, 13 - u * 8, ['s1', 's4', 'w'], n=8) if f <= 5 else None
        c.shock(32, 54, 6 + u * 20, ['s1', 's3', 's4'], squash=0.3)
        burst(c, 30, 44, u, 12, 9, ['s4', 's3', 's2'], spd=(8, 24), grav=0.6)


@sheet('nomad_oasis', 64, 12, 'allAllies', P)
def oasis(c, f):
    """오아시스: a spring wells up into a pond, palm trees sway, and mist-cool droplets heal."""
    t = f / 12
    g = min(1.0, (f + 1) / 4)
    c.oval(32, 54, 24 * g, 6 * g, 'a0')
    c.oval(32, 54, 21 * g, 4.5 * g, 'a1')
    c.oval(31, 53, 15 * g, 3 * g, 'a2')
    if f >= 1:
        for i in range(3):
            c.ring(32 + i * 2, 54, 4 + ((f * 3 + i * 6) % 18), 'a3', 1, squash=0.28)
    for (x0, h, s) in ((14, 30, 1), (50, 26, -1)):
        if f >= 2:
            hh = h * min(1.0, (f - 1) / 4)
            sway = math.sin(t * 6.28 * 2 + x0) * 1.5
            top = (x0 + sway + s * 3, 52 - hh)
            c.line([(x0, 53), (x0 + s * 2 + sway * 0.5, 52 - hh * 0.5), top], 'w0', 3)
            c.line([(x0, 53), (x0 + s * 2 + sway * 0.5, 52 - hh * 0.5), top], 'w2', 1)
            for k in range(6):
                a = -math.pi / 2 + (k - 2.5) * 0.55 + math.sin(t * 6.28 + k) * 0.08
                tip = (top[0] + math.cos(a) * 13 * min(1, hh / 15), top[1] + math.sin(a) * 9 + 4)
                mid = (top[0] + math.cos(a) * 7, top[1] + math.sin(a) * 6 - 2)
                c.line([top, mid, tip], 'p1', 2)
                c.line([top, mid, tip], 'p2', 1)
            c.disc(top[0], top[1], 1.4, 'w1')
    if f >= 4:
        c.rise(t, 14, 3, ['a3', 'p3', 'a2'], 14, 50, 50, 6, sway=3, size=2)
        c.heartp(32, 22 - int(3 * math.sin(t * 6.28)), 3, 'p3', 'p1') if f >= 6 else None
    c.twinkles(t, 6, 1, 'w', 'a3', (8, 8, 56, 52))


@sheet('nomad_wrath_sky', 128, 12, 'screen', P)
def wrath_sky(c, f):
    """사막의 분노: the sky blurs into a sand-storm wall, a blood sun burns above and dust streaks race across."""
    t = f / 11
    dark = min(1, t * 3) if f < 9 else max(0, 1 - (f - 8) / 3)
    shade(c, 64, 64, 30 + 34 * dark, 'd0')
    if f >= 1:
        r = 12 + min(f, 4) * 3
        c.disc(64, 34, r + 2, 'u1')
        c.disc(64, 34, r, 'u2')
        c.disc(64, 34, r - 5, 'u3')
        c.spikes(64, 34, 16, r + 2, [r + 12, r + 7, r + 10], ['u1', 'u2'], rot=f * 0.1)
    for i in range(14):
        y = 30 + i * 6
        n = 3
        for j in range(n):
            x = ((i * 37 + j * 45 + f * (22 + i)) % 150) - 10
            L = 14 + (i % 4) * 6
            c.line([(x, y + math.sin(x * 0.15) * 2), (x + L, y + math.sin((x + L) * 0.15) * 2)], ['s1', 's2', 's3', 'd2'][(i + j) % 4], 1 + (i % 3 == 0))
    for i in range(3):
        c.arc(64, 92 - i * 6, 46 - i * 6, 190 + f * 20 + i * 40, 350 + f * 20 + i * 40, 's3', 2, squash=0.28)
    if f >= 3:
        c.twinkles(t, 6, 2, 'w', 's3', (16, 20, 112, 100), r=3)


@sheet('nomad_wrath_spears', 64, 10, 'allTargets', P)
def wrath_spears(c, f):
    """사막의 분노 창: a rain of javelins hammers into the ground around the target; each plants and rattles."""
    t = f / 9
    spears = [(14, 0), (24, 2), (34, 1), (44, 3), (52, 0), (20, 4), (40, 5), (30, 6)]
    for i, (x, start) in enumerate(spears):
        if f < start:
            continue
        u = min(1.0, (f - start + 1) / 3.0)
        tipy = lerp(-10, 40 + (i % 3) * 5, u)
        shake = 0 if u < 1 else int(math.sin(f * 3 + i) * 1.4)
        xx = x + shake
        c.line([(xx - 3, tipy - 22), (xx, tipy)], 'w0', 3)
        c.line([(xx - 3, tipy - 22), (xx, tipy)], 'w1', 1)
        c.poly([(xx - 1, tipy + 5), (xx - 3, tipy - 1), (xx + 2, tipy - 1)], 'i3')
        c.poly([(xx - 3, tipy - 21), (xx - 7, tipy - 24), (xx - 5, tipy - 19)], 'u1')
        if u >= 1:
            c.puff(xx, tipy + 6, 3.5, ['d1', 'd2', 's2'], seed=i)
    if f >= 2:
        c.shock(32, 54, 6 + t * 26, ['s1', 's3', 's4'], squash=0.3)
    if f >= 4:
        c.rise(t, 10, 4, ['s4', 's3', 's2'], 10, 54, 52, 20, sway=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'nomad_', 'people4-6', sys.argv[1:] or None) else 0)
