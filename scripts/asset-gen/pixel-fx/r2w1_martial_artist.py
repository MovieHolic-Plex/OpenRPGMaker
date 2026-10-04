"""무술가(class_martial_artist, 칩 actor3-3): 머리 묶은 무술가, 기공 발차기. 새 시트: 초승달 차기(착탄)."""
import math

from lib_r2w1 import *

SKILLS = Skills('martial_artist', 'class_martial_artist', 'actor3-3')
SKILLS.add('straight', '정권 찌르기', 1, 'dash-strike', '기를 실은 정권으로 곧게 찌른다', 'monk_chi_burst') \
    .add('crescent', '초승달 차기', 3, 'leap-strike', '뛰어올라 초승달을 그리며 내려 찬다', 'martial_artist_crescent_kick') \
    .add('chi_shot', '기공탄', 5, 'cast', '두 손에 모은 기를 쏘아 보낸다', 'monk_chi_orb', 'monk_chi_burst') \
    .add('breath', '호흡법', 7, 'buff', '깊은 호흡으로 기를 다스려 체력을 회복한다', 'monk_meditate') \
    .add('whirl', '선풍 연각', 10, 'spin', '돌며 차 올려 모든 적을 걷어찬다', 'monk_whirl_kick') \
    .add('phantom', '잔영각', 12, 'blink-strike', '잔상을 남기고 사라졌다가 초승달 차기를 꽂는다', 'scout_afterimage', 'martial_artist_crescent_kick') \
    .add('hundred_step', '백보신권', 16, 'cast', '백 걸음 밖까지 닿는 권기로 적을 날린다', 'monk_chi_orb', 'monk_earth_palm') \
    .add('sky_dragon', '천룡 승천각', 22, 'finisher', '회오리 기류와 함께 모든 적을 하늘로 차올리는 필살기', 'mon_gale_screen', ('martial_artist_crescent_kick', 'allTargets'))

CK = pal(pick(AMBER, 'm0', 'm1', 'm2', 'm3'), pick(TEAL, 'c1', 'c2', 'c3', 'c4'), pick(FIREC, 'f3', 'f4'), WHITE)
CX, CY = 32, 34


@effect('martial_artist_crescent_kick', 64, 10, 'target', CK)
def _(c, f):
    # 0 기가 모임 → 1~3 오른쪽 위에서 왼쪽 아래로 초승달 궤적 → 4 착탄 → 5~6 되차기 작은 초승달 → 7~9 기 고리 흩어짐
    if f == 0:
        for i in range(8):
            a = i * math.tau / 8
            c.px(*pol(CX + 6, CY - 8, 14, a), 'c3' if i % 2 else 'm2')
        c.glow(CX + 6, CY - 8, 4, ['c2', 'c4'])
    if 1 <= f <= 4:
        frac = {1: 0.35, 2: 0.7, 3: 1.0, 4: 1.0}[f]
        keys = ['m0', 'm1', 'm2', 'm3', 'w'] if f < 4 else ['m1', 'm3', 'w']
        c.blade((58, 8), (8, 52), 14, 9 if f < 4 else 5, keys, frac=frac)
        c.blade((56, 12), (12, 50), 10, 3, ['c2', 'c4'], frac=frac)
    if f >= 4 and f <= 7:
        u = (f - 4) / 3
        c.burst(CX - 4, CY + 4, 5 + u * 8, ['m1', 'm2', 'f3', 'f4', 'w'], rays=8, rot=0.5, long=1.5)
    if 5 <= f <= 6:
        c.blade((14, 50), (48, 18), -8, 5, ['c1', 'c2', 'c3', 'c4'], frac=0.6 if f == 5 else 1.0)
    if f >= 7:
        u = (f - 7) / 2
        c.ring(CX - 4, CY + 4, 10 + u * 14, 'c2', 1)
        c.dring(CX - 4, CY + 4, 14 + u * 14, 'c3', parity=f % 2)
        for i in range(6):
            a = i * math.tau / 6 + f * 0.3
            c.px(*pol(CX - 4, CY + 4, 18 + u * 10, a), 'm3')

