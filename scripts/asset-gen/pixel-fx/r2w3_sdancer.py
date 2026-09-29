"""검무사(class_sword_dancer) 이펙트 11장 — 쌍검 궤적·리본·꽃잎. 장미 자줏빛 + 은빛 강철.
    python3 scripts/asset-gen/pixel-fx/r2w3_sdancer.py [key ...]"""
import math, sys
from lib_r2w3 import *

RS = ['#3a1030', '#b02c74', '#ff6aa6', '#ffc4dc']   # 자줏빛 → 연분홍
ST = ['#3c4866', '#8ea0c4', '#e8f0ff']
W = ['#ffffff']
GD = ['#e8b02c', '#fff0a2']
P = Pal(RS=RS, ST=ST, W=W, GD=GD)               # 10색
SC = [P.RS[2], P.ST[1], P.W[0]]                 # 베기 [바깥, 안, 하이라이트]
PET = dict(k=P.RS[0], d=P.RS[3], c=P.RS[2], b=P.RS[1], a=P.RS[0])
SW = dict(k=P.RS[0], d=P.W[0], c=P.ST[2], b=P.ST[1], a=P.ST[0], g=P.GD[0])


@sheet('sdance_twin', 'target', 64, 8, P, peak=[2, 3, 5])
def sdance_twin(c, f):
    cx, cy = CX, 36
    A = lambda cc, p=1.0: slash(cc, cx + 3, cy + 8, 24, 190, 335, 12, SC, prog=p)
    B = lambda cc, p=1.0: slash(cc, cx - 3, cy - 8, 24, 10, 155, 12, SC, prog=p)
    if f <= 2:
        A(c, [.45, 1, 1][f])
    if f == 2 or f == 3:
        B(c, [.5, 1][f - 2])
    if f >= 3:
        u = ph(f, 3, 7)
        if f <= 4: c.dither(lambda cc: A(cc), f)
        c.dither(lambda cc: B(cc), f + 1) if f <= 5 else None
        flash(c, cx, cy, [10, 7, 4, 2][min(3, f - 3)], [P.RS[2], P.ST[2], P.W[0]]) if f <= 5 else None
        sparks(c, 'sdt', 14, cx, cy, 4, 26, u, [P.W[0], P.RS[3], P.RS[2], P.ST[1]], seed=1)
    for k in range(6):
        x = cx - 16 + k * 6 + (f * 3) % 4; y = 14 + (k * 9 + f * 5) % 36
        stamp(c, 'petal', x, y, PET, rot=f * .7 + k, scale=1) if f >= 2 else None


@sheet('sdance_crescent', 'target', 64, 8, P, peak=[2, 3, 5])
def sdance_crescent(c, f):
    cx, cy = 42, 34
    prog = [.3, .65, 1, 1, 1, 1, 1, 1][f]
    slash(c, cx, cy, 26, 120, 250, 14 if f < 5 else 9, SC, prog=prog)
    if f >= 2:                                    # 궤적을 따라 꽃잎이 흩날린다
        for k in range(10):
            a = math.radians(120 + 130 * (k / 10))
            x, y = cx + math.cos(a) * (26 + (f - 2) * 3 + k % 3 * 2), cy + math.sin(a) * (26 + (f - 2) * 3) + (f - 2) * (2 + k % 3)
            stamp(c, 'petal', x, y, PET, rot=k + f, scale=1)
    if 1 <= f <= 4: flash(c, 20, cy + 2, [7, 5, 3, 2][f - 1], [P.RS[2], P.ST[2], P.W[0]])
    for k in range(3):
        y = cy - 8 + k * 8
        c.line([(cx + 6, y), (cx + 22 - f, y + k - 1)], P.ST[1] if f < 4 else P.ST[0])
    sparks(c, 'sdc', 10, 20, cy, 3, 22, ph(f, 2, 7), [P.W[0], P.RS[3], P.RS[2]], seed=2)


@sheet('sdance_ribbon', 'allTargets', 64, 10, P, peak=[3, 5, 7])
def sdance_ribbon(c, f):
    cx, cy = CX, 34
    grow = [.35, .6, .85, 1, 1, 1, 1, .85, .6, .35][f]
    for band, (y, ry, col, hi) in enumerate(((26, 6, P.RS[2], P.RS[3]), (40, 7, P.ST[1], P.ST[2]))):
        rr = 22 * grow
        for i in range(56):
            a = f * .55 * (1 if band == 0 else -1) + i * math.tau / 55
            x, yy = cx + math.cos(a) * rr, y + math.sin(a) * ry * grow
            front = math.sin(a) > 0
            if front:
                c.rect(x, yy, x + 1, yy + 1, col); c.px(x, yy - 1, hi)
            elif i % 2 == 0:
                c.px(x, yy, P.RS[0] if band == 0 else P.ST[0])
    for k in range(3):                             # 리본 사이를 가르는 검 반짝임
        a = f * .9 + k * 2.1
        x, y = orbit(cx, 33, 22 * grow, a, 8)
        stamp(c, 'sword', x, y, SW, rot=a + 1.6, scale=1)
    if 3 <= f <= 6: rays(c, cx, cy, 10, 12, 20 + (f - 3) * 2, P.W[0], rot=f * .3, alt=16)
    for k in range(8):
        stamp(c, 'petal', cx - 22 + (k * 11 + f * 6) % 45, 12 + (k * 13 + f * 4) % 40, PET, rot=k + f * .8, scale=1)


@sheet('sdance_wave', 'projectile', 32, 4, P)
def sdance_wave(c, f):
    cx, cy = 12 + f % 2, 16
    slash(c, cx + 6, cy, 11, 130 + f * 3, 230 - f * 3, 8 + f % 2, SC)
    for i in range(3):                             # 오른쪽 뒤로 남는 검기 줄
        c.line([(cx + 8 + i * 3, cy - 5 + i * 5), (cx + 15 + i * 3 + (f + i) % 2, cy - 4 + i * 5)], [P.ST[1], P.RS[2], P.ST[0]][i])
    c.px(6, cy + (f % 2) * 2 - 1, P.W[0])


@sheet('sdance_wave_hit', 'target', 64, 8, P, peak=[1, 3, 5])
def sdance_wave_hit(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 7)
    slash(c, cx, cy, 18 + u * 6, 130, 230, 10 - u * 6, SC, prog=1) if f < 5 else None
    slash(c, cx + 2, cy, 18 + u * 6, 310, 410, 10 - u * 6, SC, prog=1) if 1 <= f < 5 else None
    flash(c, cx, cy, [9, 8, 5, 3, 2, 1, 1, 1][f], [P.RS[2], P.ST[2], P.W[0]])
    ground_ring(c, cx, 52, 5 + u * 22, P.RS[2], 1)
    sparks(c, 'sdw', 12, cx, cy, 3, 24, u, [P.W[0], P.RS[3], P.RS[2], P.ST[1]], seed=3)
    for k in range(5):
        stamp(c, 'petal', cx - 14 + k * 7, 20 + (f * 4 + k * 5) % 24, PET, rot=k + f, scale=1) if f >= 2 else None


@sheet('sdance_blur', 'user', 64, 8, P, peak=[2, 4, 6])
def sdance_blur(c, f):
    cx = CX
    for i in range(4):                             # 몸이 미끄러지며 남기는 잔영 타원
        x = cx + 14 - i * 9 - f * 2
        col = [P.RS[2], P.RS[1], P.ST[1], P.ST[0]][i]
        c.dither(lambda cc, x=x, col=col: cc.disc(x, 38, 6, col, 15), f + i) if f < 6 else c.dither(lambda cc, x=x, col=col: cc.disc(x, 38, 4, col, 13), f + i)
    for k in range(6):
        y = 22 + k * 6
        x0 = cx + 20 - (f * 5 + k * 3) % 14
        c.line([(x0, y), (x0 - 12 - k % 3 * 4, y)], [P.W[0], P.ST[2], P.RS[3]][k % 3])
    for k in range(6):
        stamp(c, 'petal', cx + 10 - ((f * 6 + k * 9) % 44), 26 + (k * 7) % 26, PET, rot=k + f, scale=1)
    ground_ring(c, cx, GY, 10 + f * 2, P.RS[2], 1)


@sheet('sdance_cross', 'target', 64, 8, P, peak=[2, 3, 5])
def sdance_cross(c, f):
    cx, cy = CX, 36
    L = [6, 16, 24, 24, 20, 14, 8, 4][f]
    w = [1, 3, 4, 3, 2, 1, 1, 1][f]
    for sx in (-1, 1):
        c.line([(cx - sx * L, cy - L), (cx + sx * L, cy + L)], P.RS[2] if f > 1 else P.ST[1], w + 2)
        c.line([(cx - sx * L, cy - L), (cx + sx * L, cy + L)], P.W[0] if f < 5 else P.ST[2], max(1, w))
    if f in (2, 3):
        flash(c, cx, cy, 8, [P.RS[2], P.ST[2], P.W[0]])
    ring(c, cx, cy, 4 + f * 4, P.RS[2] if f < 6 else P.RS[1], 1) if f >= 2 else None
    sparks(c, 'sdx', 12, cx, cy, 3, 26, ph(f, 2, 7), [P.W[0], P.RS[3], P.RS[2]], seed=4)
    for k in range(5): stamp(c, 'petal', cx - 12 + k * 6, 16 + (k * 9 + f * 5) % 34, PET, rot=k * 2 + f, scale=1) if f >= 3 else None


@sheet('sdance_rhythm', 'allAllies', 64, 10, P, peak=[2, 5, 7])
def sdance_rhythm(c, f):
    cx = CX
    for beat in (0, 5):                            # 북소리 두 박
        u = ph(f, beat, beat + 4)
        if 0 < u <= 1:
            r = 4 + u * 28
            c.ring(cx, GY, r, P.RS[3] if u < .5 else P.RS[2], 2 if u < .5 else 1, r * .3)
    for k in range(4):
        a = f * .6 + k * math.tau / 4
        x, y = orbit(cx, 38, 16, a, 7)
        stamp(c, 'sword', x, y, SW, rot=a + 1.6, scale=1)
    motes(c, 'sdr', 10, cx, GY, 14, 38, f / 9, [P.W[0], P.RS[3], P.RS[2]], seed=2)
    for k in range(6): stamp(c, 'petal', cx - 18 + (k * 9 + f * 3) % 37, 14 + (k * 11 + f * 6) % 40, PET, rot=k + f * .6, scale=1)
    if f in (0, 5): flash(c, cx, 42, 6, [P.RS[2], P.RS[3], P.W[0]])


@sheet('sdance_moon', 'target', 64, 10, P, peak=[3, 6, 8])
def sdance_moon(c, f):
    cx, cy = CX, 38
    if f <= 6:
        u = ph(f, 0, 3)
        my = lerp(28, 14, u); mr = 5 + 5 * u
        glow(c, cx, my, mr + 5, [P.ST[0], P.ST[1], P.ST[2]])
        c.disc(cx, my, mr, P.W[0]); c.disc(cx + 2, my - 2, max(1, mr * .3), P.ST[2]); c.px(cx - 4, my + 3, P.ST[2])
    for sx, t0 in ((-1, 3), (1, 4)):               # 달빛 쌍검이 X 로 내리꽂힌다
        u = ph(f, t0, t0 + 2)
        if u > 0:
            x1, y1 = cx - sx * 2, 14 + u * 30
            c.line([(cx + sx * 16 * (1 - u), 4), (x1, y1)], P.RS[2], 4)
            c.line([(cx + sx * 16 * (1 - u), 4), (x1, y1)], P.W[0], 2)
    if f >= 5:
        v = ph(f, 5, 9)
        flash(c, cx, cy, [10, 8, 5, 3, 2][min(4, f - 5)], [P.RS[2], P.ST[2], P.W[0]])
        ground_ring(c, cx, 52, 5 + v * 26, P.ST[2], 2 if v < .4 else 1)
        for k in range(8):
            a = k * math.tau / 8
            c.line([(cx + math.cos(a) * (6 + v * 8), cy + math.sin(a) * (6 + v * 8)), (cx + math.cos(a) * (12 + v * 16), cy + math.sin(a) * (12 + v * 16))], P.RS[3] if k % 2 else P.ST[2])
        sparks(c, 'sdm', 10, cx, cy, 4, 26, v, [P.W[0], P.ST[2], P.RS[3]], seed=5)
    for k in range(5): stamp(c, 'petal', cx - 16 + k * 8, 10 + (f * 5 + k * 9) % 40, PET, rot=k + f, scale=1) if f >= 3 else None


@sheet('sdance_petal_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def sdance_petal_sky(c, f):
    cx, cy = 64, 62
    u = ph(f, 0, 5)
    shade(c, cx, cy, 58, 48, P.RS[0])
    for ring_i, (r, ry, n, spd, sc) in enumerate(((16, 6, 8, 1.0, 1), (30, 12, 12, -.8, 1), (46, 18, 16, .6, 2))):
        orbit_glyphs(c, 'petal', cx, cy + 6 - ring_i * 3, r * u, n, f / 12, PET, ry=ry * u, speed=spd, rot_self=2, scale=sc, phase=ring_i)
    orbit_glyphs(c, 'sword', cx, cy + 4, 36 * u, 6, f / 12, SW, ry=14 * u, speed=-1.2, rot_self=0, scale=2, phase=.5)
    if f >= 6:
        w = ph(f, 6, 9)
        for sx in (-1, 1):
            slash(c, cx, cy, 52, 200 if sx == 1 else 340, 340 if sx == 1 else 200, 20 * (1 - ph(f, 9, 11)) + 3, SC, prog=w)
        if f >= 8: flash(c, cx, cy, [24, 18, 10, 5][min(3, f - 8)], [P.RS[2], P.ST[2], P.W[0]])
    rays(c, cx, cy, 14, 6, 14 + u * 20, P.RS[3], rot=f * .15, alt=10)


@sheet('sdance_petal_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def sdance_petal_hit(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 7)
    L = [8, 18, 24, 20, 14, 8, 4, 2][f]
    for sx in (-1, 1):
        c.line([(cx - sx * L, cy - L), (cx + sx * L, cy + L)], P.RS[2], 3)
        c.line([(cx - sx * L, cy - L), (cx + sx * L, cy + L)], P.W[0] if f < 5 else P.ST[1], 1)
    if f <= 4: flash(c, cx, cy, [8, 10, 7, 4, 2][f], [P.RS[2], P.ST[2], P.W[0]])
    R_ = rng('sph', 1)
    for k in range(14):
        a = R_.uniform(0, math.tau); r = 4 + u * R_.uniform(10, 27)
        stamp(c, 'petal', cx + math.cos(a) * r, cy + math.sin(a) * r * .8 + u * u * 8, PET, rot=a + f, scale=1)
    ground_ring(c, cx, 52, 4 + u * 24, P.RS[2], 1)


KEYS = ['sdance_twin', 'sdance_crescent', 'sdance_ribbon', 'sdance_wave', 'sdance_wave_hit', 'sdance_blur', 'sdance_cross',
        'sdance_rhythm', 'sdance_moon', 'sdance_petal_sky', 'sdance_petal_hit']

if __name__ == '__main__':
    sys.modules['r2w3_sdancer'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_sword_dancer', sys.argv[1:])
