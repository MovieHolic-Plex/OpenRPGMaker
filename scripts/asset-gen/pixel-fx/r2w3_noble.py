"""귀족(class_noble) 이펙트 10장 — 레이피어 찌르기·결투 장갑·가문 문장·명령. 짙은 청 + 주황 + 은.
    python3 scripts/asset-gen/pixel-fx/r2w3_noble.py [key ...]"""
import math, sys
from lib_r2w3 import *

NV = ['#141a3c', '#2c3c8c', '#5a78d8', '#a8c0ff']    # 가문 남청
OR = ['#7a2c0c', '#e0701c', '#ffb050']                # 귀족 주황(칩 머리색)
ST = ['#6c7898', '#dce4f8']
W = ['#ffffff']
GD = ['#c89420', '#ffe27a']
P = Pal(NV=NV, OR=OR, ST=ST, W=W, GD=GD)               # 12색
CREST = dict(k=P.NV[0], d=P.W[0], c=P.GD[1], b=P.GD[0], a=P.OR[0], g=P.OR[1], r=P.OR[1])   # 금테 방패(남청 빛 위에서 읽히게)
GLOVE = dict(k=P.NV[0], d=P.W[0], c=P.ST[1], b=P.ST[0], a=P.ST[0], g=P.GD[1])
add_glyphs(
    glove=['..k.k.k.', '.kdkdkdk', '.kdkdkdk', 'kkdddddk', 'kddddddk', '.kdddddk', '..kcccck', '..kgggk.', '..kkkk..'],
    rose=['.kkk.', 'kdcdk', 'kcdck', 'kdcdk', '.kkk.', '..k..', '.kk..'],
    chess=['..kk..', '.kddk.', '..kk..', '.kddk.', '.kddk.', 'kddddk', 'kkkkkk'],
)


def thrust(c, x0, y0, x1, y1, cols):
    """레이피어 찌르기 선: 끝이 가늘고 밝다."""
    c.line([(x0, y0), (x1, y1)], cols[0], 3)
    c.line([(x0, y0), (x1, y1)], cols[1], 1)
    c.px(x1, y1, cols[2])


@sheet('noble_thrust', 'target', 64, 8, P, peak=[2, 3, 5])
def noble_thrust(c, f):
    """세 번 찌르기 — 왼쪽(적)으로 곧게 뻗는 은빛 찌르기 셋과 착탄 별."""
    cx, cy = CX, 38
    hits = [(cy - 6, 0), (cy + 2, 1), (cy - 2, 3)]
    for k, (y, t0) in enumerate(hits):
        d = f - t0
        if 0 <= d <= 3:
            ln = [22, 30, 30, 24][d]
            if d <= 1: thrust(c, cx + 26, y, cx + 26 - ln, y + (k - 1), [P.ST[0], P.W[0], P.GD[1]])
            if d >= 1: flash(c, cx - 4 + k * 3, y, [5, 4, 2][d - 1], [P.OR[1], P.GD[1], P.W[0]])
    sparks(c, 'nth', 12, cx - 2, cy, 3, 22, ph(f, 2, 7), [P.W[0], P.GD[1], P.OR[2], P.NV[2]], seed=1)
    if f >= 5: ground_ring(c, cx, 54, 6 + (f - 5) * 5, P.NV[2], 1)


@sheet('noble_gauntlet', 'target', 64, 8, P, peak=[2, 3, 5])
def noble_gauntlet(c, f):
    """결투 신청: 흰 장갑이 날아와 뺨을 치고 붉은 도발 문양이 뜬다."""
    cx, cy = CX, 34
    if f <= 2:
        x = lerp(cx + 26, cx + 2, ease(f / 2)); y = cy - 4 + [0, -3, 0][f]
        stamp(c, 'glove', x, y, GLOVE, rot=-.4 + f * .5, scale=2 if f == 2 else 1)
        c.line([(x + 8, y), (x + 18, y + 1)], P.ST[0])
        return
    u = ph(f, 3, 7)
    flash(c, cx, cy, [10, 7, 4, 2, 1][min(4, f - 3)], [P.OR[1], P.GD[1], P.W[0]])
    stamp(c, 'glove', cx + 10 + u * 8, cy + 6 + u * 14, GLOVE, rot=1.2 + u * 2, scale=1)
    for k in range(3):                                   # 성난 표시(꺾쇠 셋)
        a = -1.8 + k * .6
        x0, y0 = cx + math.cos(a) * (10 + u * 4), cy - 6 + math.sin(a) * (10 + u * 4)
        c.line([(x0, y0), (x0 + math.cos(a) * 5, y0 + math.sin(a) * 5)], P.OR[1], 2)
    rays(c, cx, cy, 8, 6, 12 + u * 12, P.GD[1], rot=f * .2, alt=8 + u * 8)


@sheet('noble_crest', 'allAllies', 64, 10, P, peak=[3, 5, 7])
def noble_crest(c, f):
    """가문의 긍지: 방패 문장이 떠오르고 남청 기가 아군을 감싼다."""
    cx = CX
    u = ph(f, 0, 4)
    y = lerp(50, 22, ease(u))
    glow(c, cx, y, 9 + u * 3, [P.NV[1], P.NV[2], P.NV[3]])
    stamp(c, 'shield', cx, y, CREST, scale=2)
    stamp(c, 'rose', cx, y - 1, dict(k=P.NV[0], d=P.OR[2], c=P.OR[1]), scale=1)
    if f >= 3:
        v = ph(f, 3, 9)
        ring(c, cx, 44, 10 + v * 18, P.NV[3], 1, (10 + v * 18) * .45)
        ground_ring(c, cx, GY, 8 + v * 16, P.GD[1], 1)
    motes(c, 'ncr', 12, cx, GY, 20, 44, f / 9, [P.GD[1], P.NV[3], P.W[0]], seed=2)


@sheet('noble_command', 'allAllies', 64, 8, P, peak=[2, 4, 6])
def noble_command(c, f):
    """명령: 레이피어로 가리키면 아군 위에 주황 화살표 문양이 솟아 속도를 올린다."""
    cx = CX
    u = ph(f, 0, 7)
    for k in range(3):
        y = GY - 6 - ((f * 5 + k * 12) % 36)
        c.poly([(cx - 10, y + 6), (cx, y - 2), (cx + 10, y + 6), (cx + 6, y + 6), (cx, y + 1), (cx - 6, y + 6)], P.OR[1] if k % 2 else P.OR[2])
        c.px(cx, y - 2, P.W[0])
    ground_ring(c, cx, GY, 6 + u * 20, P.GD[1], 2 if f < 3 else 1)
    for k in range(8):
        x = cx - 18 + k * 5
        h = 8 + (k * 7 + f * 4) % 18
        c.line([(x, GY - 2), (x, GY - 2 - h)], P.NV[2] if k % 2 else P.ST[1])


@sheet('noble_parry', 'user', 64, 10, P, peak=[3, 5, 7])
def noble_parry(c, f):
    """받아넘기기: 레이피어가 몸 앞에 은빛 원을 그리며 반격 태세."""
    cx, cy = CX - 6, 38
    a0 = f * 40
    slash(c, cx, cy, 16, a0 + 90, a0 + 260, 6, [P.ST[0], P.ST[1], P.W[0]], prog=min(1, .3 + f * .2))
    if f in (4, 7):
        flash(c, cx - 14, cy - 2, 5, [P.OR[1], P.GD[1], P.W[0]])
        sparks(c, 'npr%d' % f, 8, cx - 14, cy - 2, 2, 12, .6, [P.W[0], P.GD[1], P.OR[2]], seed=f)
    c.ring(cx, cy, 20, P.NV[2], 1, 18) if f % 2 == 0 else c.ring(cx, cy, 19, P.NV[3], 1, 17)
    motes(c, 'npm', 6, cx, GY, 14, 30, f / 9, [P.ST[1], P.NV[3]], seed=3)


@sheet('noble_rose', 'projectile', 32, 4, P)
def noble_rose(c, f):
    """장미 던지기: 가시 줄기를 단 붉은 장미가 왼쪽으로 회전하며 난다."""
    y = 16
    c.line([(12, y), (22, y + [0, 1, 0, -1][f])], P.NV[2], 2)
    stamp(c, 'rose', 8, y, dict(k=P.NV[0], d=P.OR[2], c=P.OR[1]), rot=f * math.pi / 2, scale=2)
    for i in range(3):
        c.px(22 + i * 3, y - 2 + (i + f) % 4, [P.OR[2], P.GD[1], P.OR[1]][i])


@sheet('noble_rose_hit', 'target', 64, 8, P, peak=[2, 3, 5])
def noble_rose_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    if f < 5: flash(c, cx, cy, [4, 8, 10, 6, 3][f], [P.OR[0], P.OR[1], P.OR[2]])
    R_ = rng('nrh', 1)
    for k in range(10):                                  # 꽃잎이 흩어진다
        a = R_.uniform(0, math.tau); sp = R_.uniform(.5, 1)
        r = 4 + ease(u) * 22 * sp
        stamp(c, 'petal', cx + math.cos(a) * r, cy + math.sin(a) * r * .8 + u * u * 8, dict(k=P.OR[0], d=P.OR[2], c=P.OR[1], b=P.OR[0]), rot=a + f, scale=1)
    if f >= 2: sparks(c, 'nrs', 10, cx, cy, 2, 18, ph(f, 2, 7), [P.W[0], P.GD[1], P.OR[2]], seed=2)


@sheet('noble_checkmate', 'target', 64, 10, P, peak=[3, 5, 8])
def noble_checkmate(c, f):
    """체크메이트: 체스판 격자가 발밑에 깔리고 거대한 킹 말이 떨어져 짓누른다."""
    cx, cy = CX, 40
    u = ph(f, 0, 3)
    n = int(1 + u * 4)
    for i in range(-n, n):                               # 체스판(원근 타원 안)
        for j in range(3):
            x0 = cx + i * 6; y0 = 46 + j * 3
            if (i + j) % 2 == 0 and abs(i * 6 + 3) < 26:
                c.rect(x0, y0, x0 + 5, y0 + 2, P.NV[1])
            elif abs(i * 6 + 3) < 26:
                c.rect(x0, y0, x0 + 5, y0 + 2, P.ST[0])
    if f <= 4:
        y = lerp(16, 30, ease(ph(f, 1, 4)))
        stamp(c, 'chess', cx, y, dict(k=P.NV[0], d=P.GD[1], c=P.GD[0]), scale=4)
        c.line([(cx - 6, y - 18), (cx - 6, y - 10)], P.GD[1]); c.line([(cx + 6, y - 16), (cx + 6, y - 10)], P.GD[0])
        return
    v = ph(f, 4, 9)
    stamp(c, 'chess', cx, 30 + (1 if f == 5 else 0), dict(k=P.NV[0], d=P.GD[1], c=P.GD[0]), scale=4 if f < 8 else 3)
    flash(c, cx, 48, [10, 7, 4, 2, 1][min(4, f - 5)], [P.OR[1], P.GD[1], P.W[0]])
    ring(c, cx, 50, 6 + v * 24, P.GD[1], 2 if v < .3 else 1, 3 + v * 6)
    sparks(c, 'ncm', 14, cx, 42, 3, 26, v, [P.W[0], P.GD[1], P.OR[2], P.NV[3]], seed=4)


@sheet('noble_duel_sky', 'screen', 128, 12, P, peak=[4, 7, 10])
def noble_duel_sky(c, f):
    """귀족의 결투(필살기) 배경: 가문 깃발과 문장 아래 수십 줄기 찌르기 섬광이 화면을 가른다."""
    cx, cy = 64, 60
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, P.NV[0])
    for i in range(5):                                   # 드리운 가문 깃발
        x = 16 + i * 24; h = 30 * ease(u)
        c.rect(x - 6, 10, x + 6, 10 + h, P.NV[1])
        c.poly([(x - 6, 10 + h), (x, 16 + h), (x + 6, 10 + h)], P.NV[1])
        if h > 12: stamp(c, 'rose', x, 10 + h * .55, dict(k=P.NV[0], d=P.OR[2], c=P.OR[1]), scale=1)
    if f >= 3:
        stamp(c, 'shield', cx, 54, CREST, scale=4 if f < 10 else 3)
    if f >= 5:
        R_ = rng('nds', f)
        for k in range(6 + (f - 5) * 2):                 # 찌르기 섬광: 오른쪽→왼쪽
            y = 30 + R_.uniform(0, 70); x1 = R_.uniform(8, 60); x0 = x1 + R_.uniform(24, 50)
            thrust(c, min(118, x0), y, x1, y + R_.uniform(-3, 3), [P.ST[0], P.W[0], P.GD[1]])
    if f >= 9:
        flash(c, cx - 20, 64, [20, 14, 8][f - 9], [P.OR[1], P.GD[1], P.W[0]])


@sheet('noble_duel_hit', 'allTargets', 64, 8, P, peak=[2, 3, 5])
def noble_duel_hit(c, f):
    cx, cy = CX, 38
    u = ph(f, 0, 7)
    for k in range(4):
        d = f - k
        if 0 <= d <= 2:
            y = cy - 9 + k * 6
            thrust(c, cx + 26, y, cx - 18 + d * 2, y + (k % 2), [P.ST[0], P.W[0], P.GD[1]])
    if f >= 2: flash(c, cx - 6, cy, [12, 9, 6, 4, 2, 1][min(5, f - 2)], [P.NV[2], P.OR[1], P.W[0]])
    rays(c, cx - 6, cy, 10, 6, 10 + u * 18, P.GD[1], rot=f * .25, alt=8 + u * 10) if f >= 3 else None
    sparks(c, 'ndh', 12, cx - 6, cy, 3, 24, u, [P.W[0], P.GD[1], P.OR[2], P.NV[3]], seed=5)


KEYS = ['noble_thrust', 'noble_gauntlet', 'noble_crest', 'noble_command', 'noble_parry', 'noble_rose', 'noble_rose_hit',
        'noble_checkmate', 'noble_duel_sky', 'noble_duel_hit']

if __name__ == '__main__':
    sys.modules['r2w3_noble'] = sys.modules[__name__]
    import r2w3_skills
    r2w3_skills.build_class('class_noble', sys.argv[1:])

