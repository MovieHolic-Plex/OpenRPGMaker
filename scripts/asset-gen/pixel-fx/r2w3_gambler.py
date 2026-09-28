"""도박사(class_gambler) 이펙트 — 주사위·슬롯·동전·잭팟. 카지노 붉은색 + 금 + 초록 펠트.
    python3 scripts/asset-gen/pixel-fx/r2w3_gambler.py [key ...]"""
import math, sys
from lib_r2w3 import *

RD = ['#4a0c1c', '#b81e34', '#ff5c66', '#ffb0a8']
GD = ['#7a4c0c', '#e0a624', '#ffe066', '#fff8c8']
GN = ['#0c3a2a', '#1c7a48', '#5cd082']
W = ['#ffffff', '#8a90a8']
P = Pal(RD=RD, GD=GD, GN=GN, W=W)
DIE = dict(k=P.RD[0], d=P.W[0], c=P.W[1], r=P.RD[1], g=P.GD[1], b=P.W[1])
DIEK = dict(k=P.RD[0], d=P.RD[2], c=P.RD[1], r=P.W[0], g=P.GD[1], b=P.RD[1])
COIN = dict(k=P.RD[0], c=P.GD[1], d=P.GD[2], g=P.GD[3], b=P.GD[0])
GEM = dict(k=P.GN[0], d=P.GN[2], c=P.GN[1], b=P.GN[1])
add_glyphs(dice_pips=['kkkkkkk', 'kddddk.', 'kdkdkdk', 'kddddk.'][:0] or ['.'])
DICE_FACE = ['kkkkkkkk', 'kddddddk', 'kdkddkdk', 'kddddddk', 'kdkddkdk', 'kddddddk', 'kdkddkdk', 'kkkkkkkk']


def die(c, x, y, cm, rot=0, scale=1):
    stamp(c, DICE_FACE, x, y, cm, rot=rot, scale=scale)


@sheet('gambler_dice', 'projectile', 32, 4, P)
def gambler_dice(c, f):
    for i in range(1, 5): c.px(22 + i * 2 + (f + i) % 2, 12 + (i * 3 + f) % 8, [P.GD[2], P.GD[1], P.RD[2], P.GD[0]][i - 1])
    die(c, 13, 16 + [-2, 1, -1, 2][f], DIE, rot=[.2, .9, 1.6, 2.4][f], scale=1)
    c.spark(7, 10 + f, 1, P.GD[3])


@sheet('gambler_dice_hit', 'target', 64, 8, P, peak=[2, 3, 5])
def gambler_dice_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    if f <= 2:
        for k, dx in enumerate((-8, 8, 0)):
            die(c, cx + dx, cy - 20 + f * 9 + k * 4, DIE, rot=f + k, scale=1 + (f == 2))
    if f >= 2:
        flash(c, cx, cy, [8, 10, 7, 4, 2, 1][min(5, f - 2)] if f < 8 else 1, [P.RD[2], P.GD[2], P.W[0]])
    R_ = rng('gdh', 2)
    for k in range(6):
        a = R_.uniform(0, math.tau); r = 4 + u * R_.uniform(10, 24)
        die(c, cx + math.cos(a) * r, cy + math.sin(a) * r * .8 - (1 - abs(2 * u - 1)) * 6 + u * u * 10, DIE if k % 2 else DIEK, rot=a + f, scale=1) if f >= 2 and u < .85 else None
    sparks(c, 'gdhs', 12, cx, cy, 3, 24, u, [P.W[0], P.GD[2], P.RD[2], P.GD[1]], seed=3)
    if f in (4, 5, 6): stamp(c, 'star4', cx, cy - 14, dict(k=P.RD[0], d=P.GD[3], c=P.GD[2], b=P.GD[1], a=P.GD[0]), rot=0, scale=1)


@sheet('gambler_slot', 'target', 64, 10, P, peak=[4, 6, 8])
def gambler_slot(c, f):
    cx, cy = CX, 34
    c.rect(cx - 21, cy - 14, cx + 20, cy + 15, P.RD[0]); c.rect(cx - 19, cy - 12, cx + 18, cy + 13, P.RD[1])
    c.rect(cx - 17, cy - 10, cx + 16, cy + 11, P.W[0])
    c.line([(cx - 19, cy - 12), (cx + 18, cy - 12)], P.RD[3])
    symbols = ['die', 'coin', 'star4', 'heart', 'gem']
    stopped = [f >= 4, f >= 6, f >= 8]
    for i in range(3):
        x = cx - 11 + i * 11
        scroll = 0 if stopped[i] else (f * 7 + i * 5) % 20
        for k, dy in enumerate((-scroll, 20 - scroll)):
            y = cy + dy - 10 + 0
            nm = 'star4' if stopped[i] else symbols[(k + i + f) % 5]
            if stopped[i]:
                y = cy
                if k: continue
            if cy - 10 <= y <= cy + 10:
                cm = dict(k=P.RD[0], d=P.GD[3], c=P.GD[2], b=P.GD[1], a=P.GD[0], r=P.RD[1], g=P.GD[1]) if nm != 'heart' else dict(k=P.RD[0], d=P.RD[2], c=P.RD[1], b=P.RD[1], a=P.RD[0])
                if nm in ('die',): die(c, x, y, DIEK)
                elif nm == 'coin': stamp(c, 'coin', x, y, COIN)
                else: stamp(c, nm, x, y, cm)
    c.rect(cx - 17, cy - 1, cx + 16, cy - 1, P.GD[1]); c.rect(cx - 17, cy + 1, cx + 16, cy + 1, P.GD[1]) if f >= 8 else None
    if f >= 8:
        flash(c, cx, cy, [16, 12][min(1, f - 8)], [P.GD[1], P.GD[2], P.W[0]]) if f == 8 else None
        for k in range(10): c.px(cx - 20 + (k * 9 + f * 5) % 41, cy - 16 + (k * 7) % 32, P.GD[3])
    if f == 9:
        for k in range(8):
            a = k * math.tau / 8
            c.line([(cx + math.cos(a) * 14, cy + math.sin(a) * 12), (cx + math.cos(a) * 26, cy + math.sin(a) * 22)], P.GD[2])
    for k in range(3): c.px(cx - 22 + k * 22, cy - 17, P.RD[2] if (f + k) % 2 else P.GD[2])


@sheet('gambler_coin', 'target', 64, 8, P, peak=[2, 3, 5])
def gambler_coin(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    R_ = rng('gcn', 3)
    for k in range(9):                              # 동전 비
        x0 = R_.uniform(-18, 18); t0 = R_.uniform(0, .4)
        v = clamp((u - t0) * 2.2)
        y = -4 + v * 46
        if v > 0 and y < 50:
            stamp(c, 'coin', cx + x0, y, COIN, scale=1) if k % 2 == f % 2 or v > .3 else c.rect(cx + x0 - 1, y - 1, cx + x0 + 1, y + 1, P.GD[2])
    if f >= 2:
        flash(c, cx, 44, [9, 7, 5, 3, 2, 1][min(5, f - 2)], [P.GD[1], P.GD[3], P.W[0]])
        for k in range(8):
            a = -math.pi * (k / 7)
            r = 4 + ph(f, 2, 7) * 22
            stamp(c, 'coin', cx + math.cos(a) * r, 46 + math.sin(a) * r * .9 + ph(f, 2, 7) ** 2 * 6, COIN, scale=1)
    ground_ring(c, cx, 52, 5 + u * 22, P.GD[2], 1)
    sparks(c, 'gcn', 10, cx, 42, 3, 24, u, [P.W[0], P.GD[3], P.GD[2], P.GD[1]], seed=6)


@sheet('gambler_bluff', 'user', 64, 10, P, peak=[3, 5, 7])
def gambler_bluff(c, f):
    cx = CX
    cards = 5
    u = ph(f, 0, 4)
    for i in range(cards):                          # 포커 패를 부채처럼 펼쳐 얼굴을 가린다
        a = (i - 2) * .34 * u
        x, y = cx + math.sin(a) * 20 * u, 40 - math.cos(a) * 12 * u - (f % 2 if f >= 5 else 0)
        stamp(c, 'card_back' if i % 2 else 'card', x, y, dict(k=P.RD[0], a=P.RD[0], b=P.RD[1], c=P.RD[2], d=P.W[0], r=P.RD[1], g=P.GD[1]), rot=a, scale=2)
    c.line([(cx - 14, 34), (cx + 14, 34)], P.GD[1]) if f >= 5 else None
    if f >= 4:
        for k in range(3):
            y = 20 + k * 8 + math.sin(f + k) * 2
            c.line([(cx - 22, y), (cx - 16, y)], P.GD[2]); c.line([(cx + 16, y), (cx + 22, y)], P.GD[2])
    motes(c, 'gb', 8, cx, GY, 13, 38, f / 9, [P.W[0], P.GD[2], P.RD[2]], seed=4)
    ground_ring(c, cx, GY, 12 + f % 4, P.GD[1], 1)
    if f in (3, 4): flash(c, cx, 36, 8, [P.RD[2], P.GD[2], P.W[0]])


@sheet('gambler_allin', 'target', 64, 10, P, peak=[3, 6, 8])
def gambler_allin(c, f):
    cx, cy = CX, 38
    stack = min(f + 1, 6)
    for i in range(stack):                          # 칩 더미가 솟는다
        y = 50 - i * 4
        c.disc(cx, y, 9, P.RD[0], 3); c.disc(cx, y - 1, 8, P.RD[1], 3); c.disc(cx, y - 1, 5, P.W[0], 2)
        c.line([(cx - 8, y - 1), (cx + 8, y - 1)], P.RD[2]) if i % 2 else None
    if f >= 6:
        u = ph(f, 6, 9)
        for k in range(12):
            a = k * math.tau / 12; r = 8 + u * 22
            stamp(c, 'coin', cx + math.cos(a) * r, 34 + math.sin(a) * r * .8, COIN, scale=1)
        flash(c, cx, 34, [12, 8, 4, 2][min(3, f - 6)], [P.RD[2], P.GD[2], P.W[0]])
        rays(c, cx, 34, 12, 10, 26, P.GD[2], rot=f, alt=18)
    if f >= 3: stamp(c, 'crown', cx, 50 - stack * 4 - 6, dict(k=P.RD[0], d=P.GD[2], c=P.GD[1], b=P.GD[1], r=P.RD[2], g=P.GD[3]), scale=1)
    sparks(c, 'gai', 8, cx, 40, 4, 22, f / 9, [P.W[0], P.GD[2], P.GD[1]], seed=7)


@sheet('gambler_ace', 'target', 64, 10, P, peak=[3, 5, 8])
def gambler_ace(c, f):
    cx, cy = CX, 36
    if f <= 2:
        stamp(c, 'card', cx, -2 + f * 22, dict(k=P.RD[0], d=P.W[0], c=P.W[1], r=P.RD[1], g=P.GD[1]), scale=3)
        c.line([(cx, 0), (cx, f * 22 - 8)], P.GD[2])
        return
    u = ph(f, 3, 9)
    stamp(c, 'card', cx, 30 + u * 6, dict(k=P.RD[0], d=P.W[0], c=P.W[1], r=P.RD[1], g=P.GD[1]), scale=3 if f < 7 else 2)
    stamp(c, 'heart', cx, 30 + u * 6, dict(k=P.RD[0], d=P.RD[2], c=P.RD[1], b=P.RD[1], a=P.RD[0]), scale=2) if f < 7 else None
    if f in (3, 4): flash(c, cx, cy, 14, [P.RD[1], P.GD[2], P.W[0]])
    for sx in (-1, 1):
        beam(c, cx + sx * 22, 6, cx, cy, 3, [P.RD[1], P.GD[2], P.W[0]]) if 4 <= f <= 6 else None
    ring(c, cx, cy, 6 + u * 22, P.GD[2], 1) if f >= 4 else None
    sparks(c, 'ga', 14, cx, cy, 6, 26, u, [P.W[0], P.GD[3], P.RD[2], P.GD[1]], seed=8)


@sheet('gambler_jackpot_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def gambler_jackpot_sky(c, f):
    cx, cy = 64, 62
    shade(c, cx, cy, 58, 48, P.RD[0])
    u = ph(f, 0, 5)
    for i in range(3):                              # 거대한 슬롯 세 릴이 밤하늘에 뜬다
        x = cx - 30 + i * 30
        stop = f >= 5 + i
        y = 46 if not stop else 58
        c.rect(x - 12, 24 * (1 - u) + 20, x + 12, 24 * (1 - u) + 76, P.RD[1]); c.rect(x - 10, 24 * (1 - u) + 22, x + 10, 24 * (1 - u) + 74, P.W[0])
        stamp(c, 'star4' if stop else ['coin', 'heart', 'gem'][(f + i) % 3], x, 24 * (1 - u) + 48, dict(k=P.RD[0], d=P.GD[3], c=P.GD[2], b=P.GD[1], a=P.GD[0], g=P.GD[1]) if stop else (COIN if (f + i) % 3 == 0 else dict(k=P.RD[0], d=P.RD[2], c=P.RD[1], b=P.RD[1], a=P.RD[0]) if (f + i) % 3 == 1 else GEM), scale=3)
    if f >= 8:
        v = ph(f, 8, 11)
        R_ = rng('gjs', 1)
        for k in range(40):
            x0 = R_.uniform(6, 122); t0 = R_.uniform(0, .5)
            y = clamp((v - t0) * 1.6) * 118
            if y > 0: stamp(c, 'coin', x0, y, COIN, scale=1 + (k % 3 == 0))
        flash(c, cx, 60, [22, 14, 8, 4][min(3, f - 8)], [P.RD[2], P.GD[2], P.W[0]])
        rays(c, cx, 60, 16, 12, 44, P.GD[2], rot=f * .2, alt=30)
    for k in range(20): c.px(8 + (k * 23 + f * 11) % 112, 8 + (k * 17) % 100, [P.GD[3], P.RD[3]][k % 2])


@sheet('gambler_jackpot_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def gambler_jackpot_hit(c, f):
    cx, cy = CX, 36
    u = ph(f, 0, 7)
    R_ = rng('gjh', 1)
    for k in range(10):
        x0 = R_.uniform(-20, 20); t0 = R_.uniform(0, .3)
        v = clamp((u - t0) * 2)
        if 0 < v < 1: stamp(c, 'coin', cx + x0, -4 + v * 52, COIN, scale=1)
    if f >= 2:
        flash(c, cx, 46, [10, 8, 5, 3, 2][min(4, f - 2)], [P.RD[2], P.GD[2], P.W[0]])
        stamp(c, 'star4', cx, 34, dict(k=P.RD[0], d=P.W[0], c=P.GD[3], b=P.GD[2], a=P.GD[1]), rot=f * .4, scale=[1, 2, 3, 3, 2, 1][min(5, f - 2)])
    ground_ring(c, cx, 52, 4 + u * 24, P.GD[2], 1)
    sparks(c, 'gjh', 14, cx, 40, 3, 26, u, [P.W[0], P.GD[3], P.GD[2], P.RD[2]], seed=9)


@sheet('gambler_coin_flip', 'target', 64, 8, P, peak=[2, 4, 6])
def gambler_coin_flip(c, f):
    cx, cy = CX, 36
    ph_ = [0, 1, 2, 3, 4, 5, 6, 7][f]
    y = 44 - math.sin(min(1.0, f / 4.5) * math.pi) * 30 if f < 5 else 44
    wobble = abs(math.cos(f * 1.4))
    if f < 5:
        r = max(1, round(7 * wobble))
        c.disc(cx, y, 7, P.GD[0], r); c.disc(cx, y - 1, 6, P.GD[1], max(1, r - 1)); c.px(cx - 2, y - 2, P.GD[3])
        c.line([(cx, y + 8), (cx, 50)], P.GD[0]) if f in (1, 2) else None
    else:
        u = ph(f, 5, 7)
        flash(c, cx, 42, [11, 7, 4][f - 5], [P.RD[2], P.GD[2], P.W[0]])
        for k in range(4):                          # 연타 네 번의 X/일자 궤적
            yy = 26 + k * 6; xx = cx - 16 + (k % 2) * 4
            c.line([(xx, yy), (xx + 22, yy + (k % 2) * 4 - 2)], [P.W[0], P.GD[2], P.RD[2], P.W[0]][k], 2 if f == 5 else 1)
        sparks(c, 'gcf', 12, cx, 40, 3, 24, u, [P.W[0], P.GD[3], P.GD[2], P.RD[2]], seed=11)
        ground_ring(c, cx, 52, 4 + u * 20, P.GD[2], 1)
    for k in range(4): c.px(cx - 16 + (k * 11 + f * 5) % 33, 14 + (k * 9) % 22, P.GD[3])


KEYS = ['gambler_dice', 'gambler_dice_hit', 'gambler_slot', 'gambler_coin', 'gambler_coin_flip', 'gambler_bluff', 'gambler_allin', 'gambler_ace', 'gambler_jackpot_sky', 'gambler_jackpot_hit']

if __name__ == '__main__':
    sys.modules['r2w3_gambler'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_gambler', sys.argv[1:])
