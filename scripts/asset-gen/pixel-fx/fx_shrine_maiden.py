"""class_shrine_maiden (무녀) skill FX: ofuda talisman, gohei purification, fox-fire dash, chain seal, torii sky.
Colour identity: vermilion torii red, white paper, black ink script, fox-fire cyan/blue, shrine gold.
Reused layers (not drawn here): holy, guard_barrier, bard_tempo, cleric_mass_heal, cleric_judgment_hit.
Run this file to rebuild every shrine maiden sheet and the review boards in .omo/r2w4/p5/."""
from lib_r2w4 import *

VERM = dict(r0='#3a0a10', r1='#8e1a1e', r2='#e0402c', r3='#ff9a6a')
PAPER = dict(p1='#b8b0a0', p2='#f2ecd8')
INK = dict(k0='#16101a')
FOXF = dict(f1='#2a5ab8', f2='#4ac0f0', f3='#b8f4ff')
SGOLD = dict(g1='#c68a1e', g2='#ffd452', g3='#fff4b0')
P = pal(VERM, PAPER, INK, FOXF, SGOLD, WHITE)


def ofuda(c, x, y, ang, L, W_, glow=None):
    """A paper talisman: white strip with a red border stroke and black script, rotated by ang."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    def q(a, b):
        return (x + ux * a + vx * b, y + uy * a + vy * b)
    hl, hw = L / 2, W_ / 2
    if glow:
        c.poly([q(-hl - 1, -hw - 1), q(hl + 1, -hw - 1), q(hl + 1, hw + 1), q(-hl - 1, hw + 1)], glow)
    c.poly([q(-hl, -hw), q(hl, -hw), q(hl, hw), q(-hl, hw)], 'p1')
    c.poly([q(-hl + 0.5, -hw + 0.5), q(hl - 1, -hw + 0.5), q(hl - 1, hw - 1), q(-hl + 0.5, hw - 1)], 'p2')
    c.line([q(-hl + 1, 0), q(hl - 1.5, 0)], 'r2')
    for j in range(int(L // 3)):
        a = -hl + 2 + j * 3
        if a < hl - 2:
            c.px(*q(a, -hw * 0.45), 'k0')


@sheet('shrine_maiden_ofuda', 32, 4, 'projectile', P)
def ofuda_proj(c, f):
    """부적: a paper talisman flying LEFT, fluttering (tilt swings), a trail of red/white spirit sparks behind."""
    tilt = [-0.25, 0.0, 0.25, 0.0][f]
    wid = [7, 6, 7, 5][f]
    for j in range(5):
        d = 8 + j * 3 + (f % 2)
        yy = 16 + math.sin(j * 1.3 + f * 1.6) * 3
        c.px(10 + d, yy, 'r2' if (j + f) % 2 else 'p2')
    c.spark(24 + (f % 2) * 2, 12 + (f % 3) * 3, 1, 'w', 'r3')
    ofuda(c, 11, 16, tilt, 14, wid, glow='r1')
    c.px(4, 16 + (f % 2), 'w')


@sheet('shrine_maiden_gohei', 64, 10, 'allAllies', P)
def gohei(c, f):
    """고헤이 정화: a gohei wand swings left-right over the party, zigzag paper streamers flick, white motes fall and cleanse."""
    t = f / 9
    sw = math.sin(t * 2 * math.pi * 1.5) * 0.7
    px_, py_ = 32, 8
    L = 22
    tip = (px_ + math.sin(sw) * L, py_ + math.cos(sw) * L * 0.6)
    c.line([(px_, py_ - 2), tip], 'r0', 3)
    c.line([(px_, py_ - 2), tip], 'g1', 1)
    for side in (-1, 1):
        pts = [tip]
        for j in range(1, 5):
            ang = sw + side * 0.5
            x = tip[0] + side * (2 + (j % 2) * 3) + math.sin(ang) * j * 2
            y = tip[1] + j * 3.5
            pts.append((x, y))
        c.line(pts, 'p1', 3)
        c.line(pts, 'p2', 1)
    if f >= 2:
        u = (f - 2) / 7
        c.fall(u, 18, 11, ['p2', 'w', 'f3'], 6, 58, 18, 58, drift=sw * 4)
        c.ring(32, 52, 8 + u * 18, 'f2', 1, squash=0.3)
        c.dring(32, 52, 12 + u * 18, 'f3', parity=f, squash=0.3)
    if f in (4, 7):
        c.spark(tip[0], tip[1], 4, 'w', 'g2')
    if f >= 6:
        c.twinkles(t, 6, 2, 'w', 'f3', (8, 20, 56, 54))


def fox(c, x, y, s, keys, run):
    """Side-on fox spirit running LEFT: body, pointed ears, snout, big flame tail."""
    d, m, l = keys
    lg = [(-5, 4), (-2, 4), (3, 4), (6, 4)]
    for i, (lx, ly) in enumerate(lg):
        o = (2 if (i + run) % 2 else -2) * s
        c.line([(x + lx * s, y + 1 * s), (x + lx * s + o, y + ly * s + 2)], d, 2)
    c.oval(x, y, 8 * s, 3.4 * s, d)
    c.oval(x - 0.5, y - 0.5, 7 * s, 2.4 * s, m)
    hx, hy = x - 9 * s, y - 3 * s
    c.disc(hx, hy, 3 * s, d)
    c.disc(hx, hy - 0.5, 2.2 * s, m)
    c.poly([(hx - 2 * s, hy), (hx - 7 * s, hy + 1.5 * s), (hx - 2 * s, hy + 2 * s)], m)
    c.poly([(hx - 1 * s, hy - 2 * s), (hx - 0.5 * s, hy - 6 * s), (hx + 1.5 * s, hy - 2 * s)], d)
    c.poly([(hx + 1 * s, hy - 2 * s), (hx + 2.5 * s, hy - 6 * s), (hx + 3 * s, hy - 1.5 * s)], m)
    c.px(hx - 1.5 * s, hy - 0.5, 'k0')
    tx, ty = x + 8 * s, y - 1
    wob = math.sin(run * 1.7) * 2
    c.poly([(tx - 1, ty - 3 * s), (tx + 10 * s, ty - 7 * s + wob), (tx + 14 * s, ty - 2 * s + wob), (tx + 8 * s, ty + 2 * s), (tx - 1, ty + 2 * s)], m)
    c.poly([(tx + 5 * s, ty - 4 * s + wob), (tx + 12 * s, ty - 4 * s + wob), (tx + 9 * s, ty)], l)


@sheet('shrine_maiden_fox', 64, 8, 'target', P)
def fox_dash(c, f):
    """여우 돌진: a blue fox-fire spirit dashes in from the right leaving flame wisps, rams the foe, bursts into fox fire."""
    if f <= 3:
        x = [62, 50, 38, 32][f]
        for j in range(4):
            wx = x + 14 + j * 7
            flame_tongue(c, wx, 38 - (j % 2) * 2, 5 - j, 2.2, ['f1', 'f2', 'f3'], seed=j + f, lean=0.4)
        fox(c, x, 36, 1.0, ('f1', 'f2', 'f3'), f)
        if f == 3:
            c.spark(22, 33, 6, 'w', 'f3')
    else:
        u = (f - 4) / 3
        pow_burst(c, 30, 34, 14 - u * 6, ['f1', 'f2', 'f3', 'w'], rot=f * 0.3)
        c.shock(30, 34, 10 + u * 16, ['f1', 'f2', 'f3'], squash=0.7)
        burst(c, 30, 34, u, 12, 9, ['w', 'f3', 'f2', 'f1'], spd=(10, 24), grav=-0.3)
        for j in range(3):
            a = j * 2.1 + f
            x, y = pol(30, 34, 10 + u * 12, a, 0.7)
            flame_tongue(c, x, y, 5 - u * 3, 1.8, ['f1', 'f2', 'f3'], seed=j)


@sheet('shrine_maiden_seal', 64, 10, 'target', P)
def seal(c, f):
    """봉인 부적: four talismans fly in and pin the foe at the corners, red chain lines lace across, a seal glyph stamps."""
    t = f / 9
    corners = [(12, 16), (52, 16), (52, 54), (12, 54)]
    starts = [(-4, -6), (70, -6), (70, 70), (-4, 70)]
    for i, ((cx_, cy_), (sx, sy)) in enumerate(zip(corners, starts)):
        u = min(1.0, max(0.0, (f + 1 - i * 0.6) / 2.6))
        if u <= 0:
            continue
        x, y = lerp(sx, cx_, ease(u)), lerp(sy, cy_, ease(u))
        ofuda(c, x, y, math.pi / 2 + (i % 2) * 0.2, 10, 5)
        if u >= 1 and f <= 5:
            c.spark(x, y - 5, 2, 'w', 'r3')
    if f >= 4:
        u = min(1.0, (f - 4) / 2)
        for a, b in ((0, 2), (1, 3), (0, 1), (2, 3)):
            (x0, y0), (x1, y1) = corners[a], corners[b]
            e = (lerp(x0, x1, u), lerp(y0, y1, u))
            c.dashes((x0, y0), e, 'r1', 3, 1)
            c.dashes((x0 + 1, y0), (e[0] + 1, e[1]), 'r2', 2, 2)
    if f >= 6:
        s = [6, 12, 10, 9][f - 6]
        c.ring(32, 35, s + 2, 'r1', 2)
        c.ring(32, 35, s, 'r2', 1)
        c.rect(32 - s * 0.5, 35 - s * 0.5, 32 + s * 0.5, 35 + s * 0.5, 'p2')
        c.line([(32 - s * 0.3, 35), (32 + s * 0.3, 35)], 'k0')
        c.line([(32, 35 - s * 0.35), (32, 35 + s * 0.35)], 'k0')
        c.line([(32 - s * 0.3, 35 - s * 0.3), (32 - s * 0.3, 35 + s * 0.2)], 'k0')
        if f == 6:
            c.shock(32, 35, 18, ['r1', 'r2', 'r3'])
    if f >= 8:
        c.twinkles(t, 5, 6, 'w', 'r3', (8, 10, 56, 58))


def torii(c, cx, base, h, w, keys):
    d, m, l = keys
    pw = max(1.5, w * 0.07)
    for sx in (-1, 1):
        x = cx + sx * w * 0.32
        c.rect(x - pw - 1, base - h, x + pw + 1, base, d)
        c.rect(x - pw, base - h, x + pw, base, m)
        c.line([(x - pw, base - h), (x - pw, base)], l)
    y1 = base - h
    c.poly([(cx - w * 0.55, y1 - h * 0.1), (cx + w * 0.55, y1 - h * 0.1), (cx + w * 0.5, y1 - h * 0.1 + pw * 2.4), (cx - w * 0.5, y1 - h * 0.1 + pw * 2.4)], d)
    c.poly([(cx - w * 0.6, y1 - h * 0.18), (cx + w * 0.6, y1 - h * 0.18), (cx + w * 0.55, y1 - h * 0.1), (cx - w * 0.55, y1 - h * 0.1)], m)
    c.rect(cx - w * 0.42, y1 + h * 0.08, cx + w * 0.42, y1 + h * 0.08 + pw * 1.5, m)
    c.rect(cx - pw * 0.8, y1 - h * 0.1, cx + pw * 0.8, y1 + h * 0.1, d)


@sheet('shrine_maiden_torii_sky', 128, 12, 'screen', pal(VERM, PAPER, INK, pick(FOXF, 'f2', 'f3'), SGOLD, WHITE))
def torii_sky(c, f):
    """천지 개벽 기도: the stage dims, a huge vermilion torii rises, its gate fills with gold light that pours down, paper streamers fall."""
    t = f / 11
    dark = min(1, t * 3) if f < 10 else max(0, 1 - (f - 9) / 2)
    shade(c, 64, 64, 30 + 34 * dark, 'k0')
    g = ease(min(1.0, (f + 1) / 5))
    base = 110
    h = 70 * g
    if f >= 3:
        u = min(1.0, (f - 2) / 4)
        gx0, gx1 = 64 - 20, 64 + 20
        top = base - h + 16
        for y in range(int(top), base):
            for x in range(int(64 - 19 * u), int(64 + 19 * u) + 1):
                if (x + y + f) % 2 == 0:
                    c.px(x, y, 'g1')
        c.rect(64 - 7 * u, top, 64 + 7 * u, base - 1, 'g2')
        for y in range(int(top), base):
            for x in range(int(64 - 5 * u), int(64 + 5 * u) + 1):
                if (x + y + f) % 2 == 0:
                    c.px(x, y, 'g3')
        c.pillar(64, 4, top, 6 * u + 1, ['g2', 'g3', 'w'], parity=f)
    if f >= 1:
        torii(c, 64, base, h, 80, ('r0', 'r2', 'r3'))
    if f >= 5:
        c.fall(t, 16, 4, ['p2', 'w', 'r3'], 14, 114, 12, 112, drift=-6)
        c.rise(t, 12, 9, ['g3', 'g2', 'f3'], 30, 98, 112, 40, sway=3)
    if f >= 7:
        c.twinkles(t, 8, 2, 'w', 'g2', (16, 12, 112, 108), r=3)


if __name__ == '__main__':
    import sys
    sys.exit(1 if class_main(__name__, 'shrine_maiden_', 'people5-3', sys.argv[1:] or None) else 0)
