"""천사(class_seraph) 이펙트 — 날개·후광·깃털·성창·부활. 성광 금 + 하늘 청 + 순백.
    python3 scripts/asset-gen/pixel-fx/r2w3_seraph.py [key ...]"""
import math, sys
from lib_r2w3 import *

GD = ['#8a5c14', '#e8b42c', '#ffe680', '#fffbe0']
SK = ['#1c3a78', '#4a86d8', '#9cd0ff', '#e0f4ff']
W = ['#ffffff', '#b8c4e0']
RD = ['#c8324a']
P = Pal(GD=GD, SK=SK, W=W, RD=RD)
FE = dict(k=P.SK[0], d=P.W[0], c=P.SK[3], b=P.SK[2], a=P.SK[1])
FEG = dict(k=P.GD[0], d=P.W[0], c=P.GD[3], b=P.GD[2], a=P.GD[1])
add_glyphs(wing_l=['.........kk', '.......kkdk', '.....kkddck', '...kkddccdk', '.kkddcccdk.', 'kddcccddk..', '.kdcddkk...', '..kdkk.....', '...kk......'])


def wings(c, cx, cy, spread, cols, span=18, feathers=5):
    """양쪽 날개(lib 의 wing 두 개). 접은 상태(0)는 등 뒤로 모인다."""
    wing(c, cx - 3, cy, -1, spread, cols, span=span)
    wing(c, cx + 3, cy, 1, spread, cols, span=span)


@sheet('seraph_feather', 'projectile', 32, 4, P)
def seraph_feather(c, f):
    y = 16 + [0, 2, 0, -2][f]
    tilt = [-2, -1, 0, 1][f]
    c.line([(22, y - tilt), (5, y + tilt)], P.SK[2], 1)                     # 깃대
    for i in range(0, 15, 2):
        x = 6 + i; yy = y + tilt - (i * tilt) // 8 if False else y + tilt + (0 if i == 0 else -(i * (tilt + tilt)) // 15)
        ln = 4 - abs(i - 7) // 3
        c.line([(x, yy), (x + 3, yy - ln - 1)], P.W[0]); c.line([(x, yy), (x + 3, yy + ln + 1)], P.SK[3])
    c.px(4, y + tilt, P.GD[2]); c.px(3, y + tilt, P.GD[1])
    for i in range(1, 5): c.px(24 + i * 2 + (f + i) % 2, y - 3 + (i * 3 + f) % 6, [P.W[0], P.SK[2], P.GD[2], P.SK[1]][i - 1])


@sheet('seraph_feather_hit', 'target', 64, 8, P, peak=[2, 3, 5])
def seraph_feather_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    if f < 3:
        for k in range(5):
            stamp(c, 'feather', cx - 14 + k * 7, -4 + f * 14 + (k % 2) * 6, FE, rot=2.4, scale=1)
    else:
        flash(c, cx, cy, [10, 7, 5, 3, 2][min(4, f - 3)], [P.SK[2], P.W[0], P.W[0]])
        R_ = rng('sfh', 1)
        for k in range(12):
            a = R_.uniform(0, math.tau); r = 4 + u * R_.uniform(8, 24)
            stamp(c, 'feather', cx + math.cos(a) * r, cy + math.sin(a) * r * .8 + u * u * 10, FE if k % 2 else FEG, rot=a + f * .8, scale=1)
    ground_ring(c, cx, 52, 4 + u * 22, P.SK[2], 1)
    sparks(c, 'sfhs', 10, cx, cy, 3, 22, u, [P.W[0], P.SK[3], P.SK[2]], seed=2)


@sheet('seraph_spear', 'target', 64, 10, P, peak=[3, 5, 8])
def seraph_spear(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 3)
    if f <= 4:                                         # 하늘에서 성창이 꽂힌다
        y = lerp(-20, 40, ease(u))
        c.line([(cx, y - 24), (cx, y)], P.GD[2], 3); c.line([(cx, y - 24), (cx, y)], P.W[0], 1)
        c.poly([(cx - 4, y - 2), (cx, y + 8), (cx + 4, y - 2)], P.GD[3])
        c.poly([(cx - 6, y - 24), (cx, y - 30), (cx + 6, y - 24)], P.GD[1])
        for k in range(6): c.line([(cx - 4 + (k * 3) % 9, y - 30 - (k * 5) % 12), (cx - 4 + (k * 3) % 9, y - 26 - (k * 5) % 12)], P.SK[3])
    if f >= 3:
        v = ph(f, 3, 9)
        column(c, cx, 0, GY, [3, 8, 12, 10, 8, 6, 4][f - 3] if f - 3 < 7 else 3, [P.GD[1], P.GD[2], P.GD[3], P.W[0]])
        flash(c, cx, 44, [12, 9, 6, 3][min(3, f - 3)], [P.GD[1], P.GD[2], P.W[0]]) if f < 7 else None
        ground_ring(c, cx, 54, 6 + v * 26, P.GD[2], 2 if v < .3 else 1)
        wings(c, cx, 30, 1.0, [P.SK[1], P.SK[3], P.W[0]], span=20) if f in (4, 5, 6) else None
    sparks(c, 'ssp', 10, cx, 40, 3, 26, ph(f, 3, 9), [P.W[0], P.GD[3], P.GD[2], P.SK[2]], seed=3)


@sheet('seraph_heal', 'allAllies', 64, 10, P, peak=[3, 5, 7])
def seraph_heal(c, f):
    cx = CX
    ring(c, cx, 20 + math.sin(f) * 1.5, 9, P.GD[2], 2, 3)
    ring(c, cx, 20 + math.sin(f) * 1.5, 9, P.GD[3], 1, 3)
    wings(c, cx, 34, min(1.0, .4 + f * .1), [P.SK[1], P.SK[3], P.W[0]], span=22) if f < 9 else None
    motes(c, 'sh', 14, cx, GY, 16, 42, f / 9, [P.W[0], P.GD[3], P.SK[3], P.GD[2]], seed=1)
    for k in range(4):
        stamp(c, 'feather', cx - 18 + k * 12, 8 + ((f * 5 + k * 13) % 44), FE, rot=2.4, scale=1)
    ground_ring(c, cx, GY, 10 + f * 2, P.SK[2], 1)
    if f in (3, 4): flash(c, cx, 38, 10, [P.GD[2], P.W[0]])


@sheet('seraph_bind', 'target', 64, 8, P, peak=[2, 4, 6])
def seraph_bind(c, f):
    cx, cy = CX, 38
    grow = [.2, .5, .8, 1, 1, 1, .7, .3][f]
    for k in range(4):                                  # 성스러운 사슬 고리
        a = f * .5 + k * math.tau / 4
        for i in range(10):
            u = i / 9
            aa = a + u * 3.2
            x, y = cx + math.cos(aa) * (14 * grow), 24 + u * 26 + math.sin(aa) * 4 * grow
            if math.sin(aa) > -.5:
                c.rect(x - 1, y - 1, x + 1, y, P.GD[1]); c.px(x, y - 1, P.GD[3])
    c.ring(cx, 52, 16 * grow, P.GD[2], 1, 5 * grow)
    ring(c, cx, 14, 6, P.GD[2], 1, 2) if f >= 2 else None
    if f in (3, 4): flash(c, cx, cy, 8, [P.GD[2], P.W[0]])
    sparks(c, 'sbd', 8, cx, cy, 4, 22, f / 8, [P.W[0], P.GD[3], P.GD[2]], seed=4)


@sheet('seraph_veil', 'allAllies', 64, 10, P, peak=[3, 5, 7])
def seraph_veil(c, f):
    cx = CX
    grow = [.3, .55, .8, 1, 1, 1, 1, 1, .7, .4][f]
    wings(c, cx, 34, grow, [P.GD[1], P.GD[3], P.W[0]], span=24, feathers=6) if f < 9 else None
    c.ring(cx, 36, 20 * grow, P.SK[2], 1, 24 * grow)
    c.dither(lambda cc: cc.disc(cx, 36, 20 * grow, P.SK[1], 24 * grow), f)
    for k in range(6):
        a = f * .4 + k * math.tau / 6
        x, y = orbit(cx, 36, 20 * grow, a, 24 * grow)
        c.spark(x, y, 1 + (k % 2), P.W[0])
    motes(c, 'sv', 8, cx, GY, 14, 40, f / 9, [P.W[0], P.GD[3]], seed=5)


@sheet('seraph_smite', 'target', 64, 10, P, peak=[3, 5, 8])
def seraph_smite(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 9)
    if f <= 3:
        r = [4, 8, 12, 10][f]
        glow(c, cx, 14, r + 3, [P.GD[1], P.GD[2], P.W[0]])
        rays(c, cx, 14, 8, r, r + 10, P.GD[3], rot=f * .3)
    if f >= 2:
        w = [1, 2, 3, 3, 2, 2, 1, 1][min(7, f - 2)]
        for i, col in enumerate([P.SK[2], P.W[0]]):
            c.line([(cx, 14), (cx, cy + 8)], col, max(1, w - i))
    if f >= 4:
        flash(c, cx, cy + 8, [14, 10, 6, 4, 2][min(4, f - 4)], [P.GD[1], P.GD[3], P.W[0]])
        for sx in (-1, 1):
            c.line([(cx, cy + 8), (cx + sx * (10 + u * 20), cy + 8 - u * 2)], P.GD[3], 3 if u < .6 else 1)
            c.line([(cx, cy + 8), (cx + sx * (6 + u * 12), cy + 8 - 8 - u * 8)], P.GD[2], 1)
        ground_ring(c, cx, 52, 5 + u * 26, P.GD[2], 2 if u < .5 else 1)
    holy_cross(c, cx, cy - 4, 7 + (f in (4, 5)) * 3, 4, [P.GD[1], P.GD[3], P.W[0]]) if 4 <= f <= 7 else None
    sparks(c, 'ssm', 12, cx, cy + 8, 3, 26, ph(f, 3, 9), [P.W[0], P.GD[3], P.GD[2], P.SK[3]], seed=6)


@sheet('seraph_revive', 'target', 64, 12, P, peak=[4, 7, 10])
def seraph_revive(c, f):
    cx = CX
    u = ph(f, 0, 6)
    wings(c, cx, 34, ease(u), [P.W[1], P.W[0], P.SK[3]], span=24, feathers=6)
    ring(c, cx, 18 - (f % 3 == 0), 8, P.GD[2], 2, 3) if f >= 2 else None
    column(c, cx, 0, GY, [2, 4, 6, 8, 8, 8, 7, 6, 4, 3, 2, 1][f], [P.GD[1], P.GD[2], P.GD[3], P.W[0]]) if f >= 1 else None
    for k in range(3):
        stamp(c, 'ankh', cx - 14 + k * 14, 22 + (k % 2) * 4 - (f % 4), dict(k=P.GD[0], d=P.GD[3]), scale=1) if 4 <= f <= 9 and k == 1 else None
    motes(c, 'sr', 16, cx, GY, 16, 50, f / 11, [P.W[0], P.GD[3], P.GD[2], P.SK[3]], seed=7)
    ground_ring(c, cx, GY, 6 + f * 2.4, P.GD[2], 2 if f < 4 else 1)
    if f in (5, 6): flash(c, cx, 38, 12, [P.GD[2], P.W[0]])


@sheet('seraph_judgment_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def seraph_judgment_sky(c, f):
    cx, cy = 64, 62
    u = ph(f, 0, 5)
    shade(c, cx, cy, 58, 48, P.SK[0])
    wings(c, cx, 44, ease(u), [P.GD[1], P.GD[3], P.W[0]], span=54, feathers=8)
    ring(c, cx, 20, 12 * u + 2, P.GD[2], 2, 4 * u + 1); ring(c, cx, 20, 12 * u + 2, P.W[0], 1, 4 * u + 1)
    glow(c, cx, 44, 10 * u + 2, [P.GD[1], P.GD[2], P.W[0]])
    if f >= 5:
        v = ph(f, 5, 9)
        for k in range(9):                              # 하늘에서 쏟아지는 성창 아홉 자루
            x = 14 + k * 12; y = -20 + clamp(v * 1.5 - k * .03) * 130
            c.line([(x, y - 22), (x, y)], P.GD[2], 2); c.line([(x, y - 22), (x, y)], P.W[0], 1)
            c.poly([(x - 3, y), (x, y + 8), (x + 3, y)], P.GD[3])
    if f >= 9:
        flash(c, cx, 100, [30, 20, 10][min(2, f - 9)], [P.GD[1], P.GD[2], P.W[0]])
        rays(c, cx, 96, 18, 10, 50, P.GD[3], rot=f * .1, alt=34)
    for k in range(24):
        stamp(c, 'feather', 6 + (k * 19 + f * 3) % 116, (k * 23 + f * 9) % 120, FE if k % 2 else FEG, rot=2.4 + f * .2, scale=1)


@sheet('seraph_judgment_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def seraph_judgment_hit(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 7)
    if f < 3:
        column(c, cx, 0, GY, [3, 7, 10][f], [P.GD[1], P.GD[2], P.GD[3], P.W[0]])
    flash(c, cx, 46, [8, 12, 9, 6, 4, 2, 1, 1][f], [P.GD[1], P.GD[3], P.W[0]]) if f < 6 else None
    holy_cross(c, cx, 32, [4, 8, 12, 12, 9, 8, 5, 3][f], [2, 4, 6, 6, 5, 4, 3, 2][f], [P.GD[1], P.GD[3], P.W[0]])
    rays(c, cx, 32, 12, 8, 10 + u * 20, P.GD[2], rot=f * .3, alt=12 + u * 8)
    ground_ring(c, cx, 52, 4 + u * 24, P.GD[2], 1)
    sparks(c, 'sjh', 12, cx, 40, 3, 26, u, [P.W[0], P.GD[3], P.GD[2], P.SK[2]], seed=8)


KEYS = ['seraph_feather', 'seraph_feather_hit', 'seraph_spear', 'seraph_heal', 'seraph_bind', 'seraph_veil', 'seraph_smite', 'seraph_revive',
        'seraph_judgment_sky', 'seraph_judgment_hit']

if __name__ == '__main__':
    sys.modules['r2w3_seraph'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_seraph', sys.argv[1:])
