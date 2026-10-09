"""마녀술사(class_sorceress, 칩 actor2-5): 보라 두건 여술사, 저주·흑마법 광역. 새 시트: 저주의 낙인(착탄)."""
import math

from lib_r2w1 import *

SKILLS = Skills('sorceress', 'class_sorceress', 'actor2-5')
SKILLS.add('curse_mark', '저주의 낙인', 1, 'cast', '해골 낙인을 새겨 적의 방어를 깎는다', 'sorceress_curse_mark') \
    .add('dark_orb', '암흑 구체', 3, 'cast', '검은 구체를 날려 적을 터뜨린다', 'witch_drain_orb', 'dark_knight_wave_hit') \
    .add('miasma', '약화의 안개', 5, 'cast', '독한 보라 안개로 모든 적의 힘을 뺀다', 'witch_poison_hit') \
    .add('veil', '어둠의 장막', 7, 'buff', '거울 같은 어둠을 둘러 마법을 튕겨낸다', 'witch_mirror') \
    .add('black_bolt', '흑뢰', 10, 'cast', '검은 번개가 적에서 적으로 튄다', 'mage_chain_bolt') \
    .add('shadow_shift', '그림자 전이', 12, 'blink-strike', '그림자로 녹아 적 앞에 나타나 저주를 꽂는다', 'scout_shadow_puff', 'witch_hex') \
    .add('hex_storm', '저주 폭풍', 16, 'cast', '악몽의 하늘을 열어 모든 적을 저주한다', 'witch_nightmare_sky', 'witch_nightmare_hit') \
    .add('doom_curse', '종말의 저주', 22, 'finisher', '검은 불꽃 아래 모든 적에게 낙인을 새기는 필살기', 'mon_dark_flame', ('sorceress_curse_mark', 'allTargets'))

CM = pal(pick(VIO, 'v0', 'v1', 'v2', 'v3', 'v4'), pick(PINK, 'p1', 'p2', 'p3'), pick(SMOKEC, 'q3', 'q4'), WHITE)
CX, CY, FEET = 32, 34, 56


@effect('sorceress_curse_mark', 64, 10, 'target', CM)
def _(c, f):
    # 발밑 룬 원이 돌며 열리고(0~3) → 해골 낙인이 떠오르고(3~6) → 낙인이 몸에 박히며 금이 가듯 터진다(6~9).
    grow = min(1.0, (f + 1) / 4)
    if f <= 7:
        c.rune_ring(CX, FEET - 2, 24 * grow, 'v2', 'v4', n=10, rot=f * 0.35, squash=0.32, w=2)
        c.ring(CX, FEET - 2, max(1, 18 * grow), 'v1', 1, 0.32)
    if 1 <= f <= 5:
        for i in range(6):
            a = f * 0.5 + i * math.tau / 6
            x, y = pol(CX, FEET - 2, 22 * grow, a, 0.32)
            c.line([(x, y), (x, y - 6 - f * 3)], 'v3' if i % 2 else 'p2')
    if 3 <= f <= 7:
        u = (f - 3) / 4
        y = lerp(FEET - 8, CY - 6, ease(min(1, u * 1.6)))
        r = 7 + u * 2
        c.glow(CX, y, r + 5, ['v1', 'v2', 'p1'])
        c.skull(CX, y - 2, r, 'q4', 'q3', 'v0')
        c.px(CX - r * 0.42, y - 2, 'p3')
        c.px(CX + r * 0.42, y - 2, 'p3')
    if f >= 6:
        u = (f - 6) / 3
        c.burst(CX, CY - 6, 6 + u * 10, ['v1', 'v2', 'v3', 'p2', 'w'], rays=8, rot=0.4, long=1.6)
        for i in range(8):
            a = i * math.tau / 8 + 0.2
            p0 = pol(CX, CY - 6, 8 + u * 8, a)
            p1 = pol(CX, CY - 6, 14 + u * 14, a + 0.18)
            c.line([p0, p1], 'v4' if i % 2 else 'p2')
    if f == 9:
        c.dring(CX, CY - 6, 26, 'v3')
        c.dring(CX, FEET - 2, 26, 'v2', squash=0.32)

