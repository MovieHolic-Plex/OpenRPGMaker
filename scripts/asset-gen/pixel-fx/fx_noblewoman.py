"""class_noblewoman (귀부인) skill FX: perfume mist, fan flurry, gem toss, charm glance, parasol, waltz, chandelier, rose garden.
Colour identity: rose pink + blood red, champagne gold, gem violet/cyan, ivory.
Run this file to rebuild every noblewoman sheet and the review boards in .omo/r2w4/p4/."""
from lib_r2w4 import *

ROSE = dict(r0='#4a0c26', r1='#a01c4c', r2='#e04878', r3='#ff92b4', r4='#ffd6e2')
GOLD = dict(g0='#6a4208', g1='#b87a14', g2='#f0b830', g3='#ffe680', g4='#fff8d0')
GEM = dict(e0='#2a1058', e1='#6a3cc8', e2='#a880f8', e3='#7ce8ff', e4='#e2fcff')
LEAFG = dict(v0='#12381c', v1='#2c7a3c', v2='#5cb45c')
IVORY = dict(i1='#a89cb4', i2='#d8d0e0', i3='#f8f4fc')
BLOOD = dict(b0='#2a0410', b1='#70102c')
P = pal(ROSE, GOLD, GEM, LEAFG, IVORY, BLOOD, WHITE)


def rose(c, x, y, r, k=('r0', 'r1', 'r2', 'r3')):
    c.disc(x, y, r + 1, k[0])
    c.disc(x, y, r, k[1])
    c.disc(x, y, r * 0.72, k[2])
    c.arc(x, y, r * 0.5, 30, 300, k[1], 1)
    c.arc(x, y, r * 0.3, 200, 500, k[3], 1)
    c.px(x - r * 0.3, y - r * 0.3, k[3])


@sheet('noblewoman_perfume', 64, 10, 'allTargets', P)
def perfume(c, f):
    """장미 향수: a cut-glass atomizer sprays a pink mist that swirls into hearts over the enemy."""
    t = f / 9
    if f <= 3:
        c.rect(50, 8, 56, 16, 'e1')
        c.rect(51, 9, 55, 15, 'e2')
        c.rect(52, 6, 54, 7, 'g2')
        c.px(52, 10, 'e4')
        c.line([(50, 10), (44, 6)], 'g2')
        c.disc(43, 5, 2, 'r3')
    for i in range(6):
        u = (t * 1.2 + i * 0.13) % 1.0
        rad = 4 + (f * 2.2 if f < 7 else 14) + i
        a = i * 1.05 + f * 0.5
        x, y = pol(32, 34, rad * 0.9 * (0.4 + u), a, 0.7)
        c.disc(x, y, 3 + u * 5, 'r2' if i % 2 else 'r3')
    if f >= 1:
        c.cloud(32, 36, 8 + f * 2.4, ['r1', 'r2', 'r3', 'r4'], seed=2, parity=f % 2)
    if f >= 3:
        for i in range(4):
            c.heartp(20 + i * 8, 44 - ((f * 4 + i * 8) % 32), 2.5, 'r3', 'r0')
    if f >= 5:
        c.twinkles(t, 5, 3, 'w', 'r4', (10, 10, 54, 50))


@sheet('noblewoman_fan_slap', 64, 8, 'target', P)
def fan_slap(c, f):
    """부채 연타: three snappy fan swats — each leaves a pink petal-fan afterimage and a white slap star."""
    hits = [(18, 20, -0.5), (44, 26, 0.5), (26, 40, -0.2)]
    for i, (hx, hy, rot) in enumerate(hits):
        start = 1 + i * 2
        if f < start:
            continue
        u = f - start
        if u <= 1:
            rot = rot + u * 0.7
            for j, k in enumerate(['r0', 'r1', 'r2', 'i2', 'i3']):
                a = rot + (j - 2) * (0.34 + u * 0.1)
                c.line([(hx, hy), pol(hx, hy, 15 - u * 3, a - 1.57)], k, 2)
            c.arc(hx, hy, 17 + u * 4, math.degrees(rot - 1.57) - 60, math.degrees(rot - 1.57) + 60, 'r3', 1)
            c.spark(hx + math.cos(rot) * 6, hy, 5 - u * 2, 'w', 'r4')
        else:
            c.spark(hx, hy, 2, 'r4', 'r3')
            for j in range(3):
                c.petalp(hx + (j - 1) * 6, hy + (u - 1) * 5 + j, 1.2 + j, 4, 'r3', 'r4')
    if f == 0:
        c.arc(32, 34, 14, 200, 340, 'r3', 1)
        c.spark(32, 34, 3, 'w', 'r3')


@sheet('noblewoman_gem', 32, 4, 'projectile', pal(GEM, GOLD, WHITE))
def gem(c, f):
    """보석 탄: a faceted cut gem spinning, LEFT-flying, with a gold glitter trail."""
    X, Y = 10, 16
    for j in range(5):
        c.px(X + 7 + j * 4 - (f % 2), Y + math.sin(j * 1.4 + f) * 4, 'g3' if j % 2 else 'e3')
        c.px(X + 5 + j * 4, Y + math.sin(j * 1.9 + f * 2) * 2, 'g2')
    sp = f * 0.5
    pts = [pol(X, Y, 7 if i % 2 == 0 else 5, sp + i * math.pi / 3) for i in range(6)]
    c.poly([(p[0] + (p[0] - X) * 0.14, p[1] + (p[1] - Y) * 0.14) for p in pts], 'e0')
    c.poly(pts, 'e1')
    c.poly([(X, Y), pts[0], pts[1]], 'e2')
    c.poly([(X, Y), pts[2], pts[3]], 'e3')
    c.poly([(X, Y), pts[4], pts[5]], 'e0')
    c.px(*pts[1], 'w')
    c.px(X - 1, Y - 1, 'e4')
    c.spark(X + 5, Y - 6, 2, 'w', 'g3') if f % 2 else c.spark(X - 6, Y + 5, 2, 'w', 'e3')


@sheet('noblewoman_gem_hit', 64, 8, 'target', P)
def gem_hit(c, f):
    """보석 착탄: the gem shatters into a fountain of facets and a shower of gold coins/glitter."""
    t = f / 7
    if f <= 2:
        r = [6, 10, 13][f]
        pts = [pol(32, 36, r if i % 2 == 0 else r * 0.65, i * math.pi / 4 + f * 0.3) for i in range(8)]
        c.poly(pts, 'e1')
        c.poly([(32, 36), pts[0], pts[1]], 'e3')
        c.poly([(32, 36), pts[2], pts[3]], 'e2')
        c.spark(32, 36, 4, 'w', 'e4')
    if f >= 2:
        rr = rng(11)
        for i in range(14):
            a = rr.uniform(-3.0, -0.14)
            v = rr.uniform(10, 26) * ease(t * 1.2)
            x, y = 32 + math.cos(a) * v, 38 + math.sin(a) * v + t * t * 24
            s = rr.choice([1, 2, 2, 3])
            k = rr.choice(['e2', 'e3', 'g2', 'g3'])
            c.poly([(x, y - s), (x + s, y), (x, y + s), (x - s, y)], k)
            c.px(x, y - 1, 'w')
        c.shock(32, 48, 6 + (f - 2) * 5, ['e1', 'e3', 'e4'], squash=0.35)
    if f in (2, 3):
        pow_burst(c, 32, 38, 12, ['e1', 'e4', 'w'], n=8)
    if f >= 5:
        c.twinkles(t, 6, 1, 'w', 'g3', (10, 14, 54, 52))


@sheet('noblewoman_charm', 64, 10, 'target', P)
def charm(c, f):
    """추파: a glance line and a wink sparkle; hearts spiral around the target and the eyes go pink."""
    t = f / 9
    if f <= 3:
        y = 32
        c.line([(60, y - 6 + f), (40 - f * 3, y)], 'r3', 2)
        c.line([(60, y - 6 + f), (40 - f * 3, y)], 'w', 1)
    for i in range(6):
        a = t * 5 + i * 1.05
        rad = 14 + 6 * math.sin(t * 6 + i)
        x, y = pol(32, 30, rad, a, 0.6)
        if f >= 2:
            c.heartp(x, y, 2 + (i % 2), 'r2' if i % 2 else 'r3', 'r0')
    if f >= 4:
        c.heartp(32, 22 - (f - 4) * 1.2, 5 + (f % 2), 'r2', 'r0')
        c.spark(32, 22 - (f - 4) * 1.2, 2, 'w', 'r4') if f > 5 else None
    c.ring(32, 54, 8 + t * 18, 'r2', 1, squash=0.28) if f >= 2 else None
    if f >= 6:
        c.twinkles(t, 6, 2, 'w', 'r3', (8, 8, 56, 52))


@sheet('noblewoman_parasol', 64, 10, 'allTargets', P)
def parasol(c, f):
    """양산 회전: a huge ruffled parasol spins edge-on and flat, sweeping pink petals and a wind ring."""
    t = f / 9
    wobble = math.sin(t * 6.28 * 2)
    rx = 22 * abs(math.cos(t * 6.28 * 1.5)) + 6
    y = 30
    # canopy: ellipse fan with alternating panels
    for i in range(8):
        a0 = math.pi + i * math.pi / 8
        a1 = a0 + math.pi / 8
        k = 'r2' if i % 2 else 'r3'
        pts = [(32, y), pol(32, y, rx, a0, 0.85), pol(32, y, rx, a1, 0.85)]
        c.poly(pts, k)
    c.line([pol(32, y, rx, a, 0.85) for a in [math.pi + i * math.pi / 16 for i in range(17)]], 'r0')
    c.oval(32, y, rx, rx * 0.5, 'r1', 1) if False else None
    c.line([(32 - rx, y), (32 + rx, y)], 'r1')
    for i in range(7):
        c.disc(32 - rx + i * rx / 3.2, y + 1, 1, 'g3')
    c.line([(32, y - 4), (32, y + 20)], 'g1', 2)
    c.disc(32, y - rx * 0.85 - 1, 1.4, 'g3')
    c.ring(32, 34, 20 + t * 8, 'r3', 1, squash=0.45) if f >= 2 else None
    for i in range(7):
        a = t * 7 + i * 0.9
        x, yy = pol(32, 34, 16 + (i * 3) % 10 + t * 8, a, 0.5)
        c.petalp(x, yy, a + 1.5, 4, 'r2' if i % 2 else 'r3', 'r4')
    if f in (3, 4, 5):
        c.spikes(32, 34, 8, 12, [24, 20, 26], ['r3', 'r4'], squash=0.5, rot=0.4)


@sheet('noblewoman_waltz', 64, 12, 'allAllies', P)
def waltz(c, f):
    """무도회 왈츠: a gold dance-floor circle turns, two silhouettes' shadows waltz in a swirl of skirts and notes."""
    t = f / 12
    for i in range(3):
        c.ring(32, 52, 22 - i * 6, ['g1', 'g2', 'g3'][i], 1, squash=0.3)
    for i in range(12):
        a = t * 6.28 + i * math.pi / 6
        x, y = pol(32, 52, 20, a, 0.3)
        c.disc(x, y, 1, 'g3' if i % 2 else 'g2')
    # waltz swirl ribbon
    pts = [pol(32, 44 - u * 34, 8 + 8 * math.sin(u * 5), t * 12 + u * 9, 0.4) for u in [i / 30 for i in range(31)]]
    c.line(pts, 'r1', 3)
    c.line(pts, 'r3', 1)
    for i in range(3):
        a = t * 6.28 + i * 2.1
        x, y = pol(32, 30, 20, a, 0.6)
        n = ['♪', '♫'][i % 2]
        c.disc(x, y, 2, 'g2')
        c.line([(x + 2, y), (x + 2, y - 7)], 'g2')
        c.line([(x + 2, y - 7), (x + 5, y - 5)], 'g3')
        c.px(x - 1, y - 1, 'w')
    c.rise(t, 10, 5, ['r4', 'r3', 'g3'], 14, 50, 50, 10, sway=3, size=2)
    if f >= 6:
        c.heartp(32, 12 - int(2 * math.sin(t * 12)), 3, 'r2', 'r0')


@sheet('noblewoman_chandelier', 64, 10, 'target', P)
def chandelier(c, f):
    """샹들리에 낙하: a crystal chandelier plunges on a chain and shatters in a glitter burst with candle flames."""
    def chand(x, y):
        c.line([(x, y - 22), (x, y - 6)], 'g1', 2)
        c.line([(x - 12, y), (x + 12, y)], 'g2', 2)
        c.line([(x - 8, y + 2), (x + 8, y + 2)], 'g1', 2)
        c.line([(x - 6, y - 6), (x - 12, y), ], 'g1')
        c.line([(x + 6, y - 6), (x + 12, y)], 'g1')
        for cx_ in (-12, -6, 0, 6, 12):
            c.rect(x + cx_ - 1, y - 6, x + cx_ + 0.5, y - 2, 'i3')
            c.px(x + cx_, y - 8, 'g3')
        for j, cx_ in enumerate((-10, -4, 2, 8)):
            c.line([(x + cx_, y + 2), (x + cx_, y + 7 + j % 2)], 'e3')
            c.poly([(x + cx_, y + 8 + j % 2), (x + cx_ + 2, y + 10 + j % 2), (x + cx_, y + 12 + j % 2), (x + cx_ - 2, y + 10 + j % 2)], 'e4')
    if f <= 3:
        y = [6, 16, 28, 36][f]
        chand(32, y)
        if f < 3:
            for i in range(3):
                c.line([(24 + i * 8, y - 14), (24 + i * 8, y - 8)], 'g4')
    else:
        u = (f - 4) / 5
        rr = rng(21)
        for i in range(20):
            a = rr.uniform(-3.0, -0.14)
            v = rr.uniform(8, 28) * ease(u * 1.3)
            x, y = 32 + math.cos(a) * v, 46 + math.sin(a) * v * 0.9 + u * u * 20
            s = rr.choice([1, 2, 2, 3])
            k = rr.choice(['e3', 'e4', 'g2', 'g3', 'i3'])
            c.poly([(x, y - s), (x + s, y), (x, y + s), (x - s, y)], k)
        c.shock(32, 52, 8 + u * 22, ['g1', 'g3', 'g4'], squash=0.3)
        for i in range(4):
            c.flame_tongue(c, 22 + i * 7, 52, 8 - u * 6, 2, ['o1' if False else 'r1', 'r2', 'g3'], seed=i) if False else None
    if f in (3, 4):
        pow_burst(c, 32, 48, 15, ['g1', 'g3', 'w'], n=10)


@sheet('noblewoman_rose_sky', 128, 12, 'screen', P)
def rose_sky(c, f):
    """붉은 장미 정원: the stage dims blood-red; a great rose blooms in the sky and briar vines lash across the ground."""
    t = f / 11
    dark = min(1, t * 3) if f < 9 else max(0, 1 - (f - 8) / 3)
    shade(c, 64, 64, 30 + 34 * dark, 'b0')
    if f >= 1:
        r = min(1.0, f / 4)
        n = 5
        for layer, (R, k0, k1) in enumerate(((36, 'r0', 'r1'), (28, 'r1', 'r2'), (20, 'r2', 'r3'), (12, 'r3', 'r4'))):
            for i in range(9):
                a = i * 0.7 + layer * 0.5 + f * 0.05
                c.disc(64 + math.cos(a) * R * r * 0.55, 50 + math.sin(a) * R * r * 0.4, R * r * 0.42, k0)
            for i in range(9):
                a = i * 0.7 + layer * 0.5 + f * 0.05
                c.disc(64 + math.cos(a) * R * r * 0.5, 49 + math.sin(a) * R * r * 0.36, R * r * 0.3, k1)
        c.arc(64, 50, 10 * r, 40, 340, 'r0', 1)
        c.arc(64, 50, 5 * r, 200, 500, 'r0', 1)
    if f >= 2:
        for i in range(6):
            x0 = 14 + i * 20
            L = min(1.0, (f - 1) / 5) if f < 9 else max(0.0, 1 - (f - 8) / 3)
            def path(u, x0=x0, i=i):
                return (x0 + math.sin(u * 5 + i + f * 0.3) * 8, 118 - u * (50 + (i % 3) * 14) * L)
            if L > 0.1:
                c.tube(lambda u, path=path: path(u), 3, 1.2, ('v0', 'v1'), steps=22)
                x, y = path(1.0)
                rose(c, x, y, 3 + (i % 2), ('r0', 'r1', 'r2', 'r3'))
                for u in (0.3, 0.55, 0.8):
                    px_, py_ = path(u)
                    c.line([(px_, py_), (px_ + 4, py_ - 3)], 'v2')
    if f >= 4:
        c.fall(t, 26, 3, ['r3', 'r2', 'r4'], 8, 120, 6, 118, drift=8, size=2)
    if f >= 6:
        c.twinkles(t, 8, 4, 'w', 'r3', (10, 10, 118, 100), r=3)


@sheet('noblewoman_rose_thorn', 64, 10, 'allTargets', P)
def rose_thorn(c, f):
    """장미 가시: thorned briars burst up around the enemy and bind it, a rose blossoming at the top."""
    t = f / 9
    grow = min(1.0, (f + 1) / 5) if f < 8 else max(0.0, 1 - (f - 7) / 3)
    for i, (x0, mir) in enumerate(((16, 1), (48, -1), (28, -1), (38, 1))):
        def path(u, x0=x0, mir=mir, i=i):
            return (x0 + mir * math.sin(u * 4.5 + i) * 9, 58 - u * (44 - i * 4) * grow)
        if grow > 0.08:
            pts = c.tube(path, 3.2, 1.4, ('v0', 'v1', 'v2'), steps=26)
            for k in range(3, 26, 4):
                x, y = pts[k]
                d = 1 if k % 8 else -1
                c.poly([(x, y), (x + d * 5, y - 2), (x + d * 1.5, y + 2)], 'i3')
            x, y = pts[-1]
            rose(c, x, y, 3 + (i % 2))
    if f >= 3:
        for i in range(3):
            c.arc(32, 36 - i * 8, 13 + i, 20 + f * 25, 200 + f * 25, 'v1', 2, squash=0.4)
            c.arc(32, 36 - i * 8, 13 + i, 20 + f * 25, 200 + f * 25, 'v2', 1, squash=0.4)
    c.shock(32, 56, 6 + t * 20, ['r1', 'r3', 'r4'], squash=0.3) if f >= 1 else None
    if f == 1 or f == 2:
        c.spikes(32, 54, 10, 4, [14, 10, 16], ['v1', 'v2'], span=(-2.9, -0.24))
    if f >= 4:
        c.fall(t, 8, 2, ['r3', 'r2'], 10, 54, 14, 56, drift=4)
        c.twinkles(t, 4, 5, 'w', 'r3', (10, 10, 54, 48))


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'noblewoman_', 'people4-5', sys.argv[1:] or None) else 0)
