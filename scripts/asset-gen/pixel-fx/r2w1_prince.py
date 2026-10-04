"""왕자 기사(class_prince, 칩 actor4-1): 금발 왕자, 레이피어·왕가의 빛. 새 시트: 레이피어 연격(착탄)·왕가의 빛(화면)."""
import math

from lib_r2w1 import *

SKILLS = Skills('prince', 'class_prince', 'actor4-1')
SKILLS.add('rapier', '레이피어 찌르기', 1, 'dash-strike', '가느다란 칼끝으로 급소를 정확히 찌른다', 'prince_rapier') \
    .add('royal_ray', '왕가의 빛', 3, 'cast', '왕가의 문장이 빛기둥이 되어 적을 친다', 'cleric_smite') \
    .add('fleuret', '플뢰레 연격', 5, 'flurry', '장미 꽃잎을 흩뿌리며 연달아 찌른다', 'prince_rapier', 'samurai_petals') \
    .add('oath', '고귀한 맹세', 7, 'buff', '검을 세워 맹세하고 빛의 방패를 두른다', 'paladin_shield') \
    .add('flash_thrust', '섬광 찌르기', 10, 'blink-strike', '빛처럼 사라졌다 나타나 일직선으로 꿰뚫는다', 'hero_dust', 'hero_pierce') \
    .add('blessing', '왕의 축복', 12, 'cast', '왕가의 축복으로 아군 전체의 힘을 북돋는다', 'cleric_blessing') \
    .add('crown_judgment', '왕관의 심판', 16, 'leap-strike', '뛰어올라 빛을 실은 검을 내리꽂는다', 'paladin_smite') \
    .add('royal_crown', '로열 크라운', 22, 'finisher', '하늘에 금관을 띄우고 빛의 창을 쏟아붓는 필살기', 'prince_royal_light', 'hero_brave_burst')

RP = pal(pick(STEEL, 's1', 's2', 's3'), pick(GOLD, 'y1', 'y2', 'y3'), pick(PINK, 'p1', 'p2', 'p3'), WHITE)
RL = pal(pick(GOLD, 'y0', 'y1', 'y2', 'y3'), pick(HOLY, 'h1', 'h2', 'h3'), pick(SKY, 'b1', 'b2', 'b3'), pick(CRIM, 'r2'), WHITE)
CX, CY = 32, 34
POINTS = [(26, 24), (36, 38), (24, 42), (34, 28), (30, 34)]


@effect('prince_rapier', 64, 8, 'target', RP)
def _(c, f):
    # 오른쪽에서 가는 칼끝이 다섯 번 찌른다. 찌른 자리마다 금빛 별이 남고 장미 꽃잎이 흩어진다.
    for i, (x, y) in enumerate(POINTS):
        hit = i + 1
        if f == hit - 1 and f < 5:
            c.lens((64, y - 6 + i * 2), (x, y), 2.5, ['s1', 's2', 's3', 'w'])
            c.line([(x + 2, y), (x + 8, y - 1)], 'w')
        if hit <= f:
            age = f - hit
            if age <= 2:
                c.star4(x, y, 4 - age, 'y2', 'w')
            else:
                c.px(x, y, 'y1')
    if f >= 4:
        u = (f - 4) / 3
        r = rng(3)
        for i in range(9):
            a = r.uniform(0, math.tau)
            d = (6 + u * 18) * r.uniform(0.6, 1.1)
            c.petal(30 + math.cos(a) * d, 34 + math.sin(a) * d + u * 4, r.uniform(0, math.tau), 4, ['p1', 'p2', 'p3'][i % 3], 'w' if i % 3 == 2 else None)
    if f == 7:
        c.dring(30, 34, 22, 'y2')


@effect('prince_royal_light', 128, 12, 'screen', RL)
def _(c, f):
    # 0~2 하늘 가운데 빛이 모임 → 3~5 금관이 나타나 보석이 빛남 → 6~9 빛의 창이 왼쪽 적진으로 쏟아짐 → 10~11 빛가루
    cx, cy = 64, 38
    g = min(1.0, (f + 1) / 3)
    if f <= 9:
        c.glow(cx, cy, 10 + g * 18, ['b1', 'h1', 'h2', 'h3'])
        c.rays(cx, cy, 12, 16 + g * 6, 24 + g * 30, 'h2', rot=f * 0.08)
        c.rays(cx, cy, 12, 18, 20 + g * 22, 'y2', rot=f * 0.08 + 0.26)
    if f >= 3:
        u = min(1.0, (f - 2) / 3)
        w = 20 + 16 * u
        c.crown(cx, cy + 10, w + 2, 'y0')
        c.crown(cx, cy + 9, w, 'y1', hi='y3')
        c.crown(cx, cy + 8, w - 6, 'y2')
        for dx in (-w / 4, 0, w / 4):
            c.disc(cx + dx, cy + 6, 1.5, 'r2' if dx == 0 else 'b2')
        if f in (4, 5):
            c.spark(cx, cy - 4, 8, 'w', 'h3', diag=True)
    spears = [(24, 70), (40, 86), (18, 92), (52, 64), (34, 100)]
    for i, (x, y) in enumerate(spears):
        t = (f - 6 - i * 0.5) / 2
        if 0 <= t <= 1:
            yy = lerp(30, y, ease(t))
            c.lens((x + 14, yy - 34), (x, yy), 3, ['h1', 'h2', 'h3', 'w'])
        elif t > 1 and f <= 10:
            c.burst(x, y, 4 + (t - 1) * 3, ['y1', 'h2', 'h3', 'w'], rays=6, long=1.5)
    if f >= 9:
        r = rng(f)
        for i in range(24):
            x = 10 + r.uniform(0, 70)
            y = 50 + r.uniform(0, 50) - (f - 9) * 4
            c.px(x, y, ['h3', 'y2', 'b3'][i % 3])
        if f >= 10:
            c.dring(cx, cy + 6, 30 + (f - 10) * 8, 'y2', parity=f % 2)

