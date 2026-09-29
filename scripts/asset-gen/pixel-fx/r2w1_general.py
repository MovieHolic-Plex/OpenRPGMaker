"""장군(class_general, 칩 actor3-7): 왕관 투구 장군, 호령·진형. 새 시트: 군기(아군 전체)."""
import math

from lib_r2w1 import *

SKILLS = Skills('general', 'class_general', 'actor3-7')
SKILLS.add('command_blade', '지휘검', 1, 'dash-strike', '지휘검을 앞세워 일직선으로 찌른다', 'hero_pierce') \
    .add('rally', '호령', 3, 'buff', '군기를 세우고 호령해 아군 공격력을 올린다', 'general_banner') \
    .add('phalanx', '방진', 5, 'buff', '방패 진형을 짜 아군 전체의 방어를 높인다', 'guard_barrier') \
    .add('charge_order', '돌격 명령', 7, 'dash-strike', '선두에 서서 적진으로 돌격한다', 'guard_charge', 'hero_dust') \
    .add('encircle', '포위 섬멸', 10, 'spin', '적진 한가운데서 대검을 돌려 모든 적을 벤다', 'hero_whirl') \
    .add('volley_order', '전군 사격', 12, 'shoot', '궁병대에 명해 모든 적 위로 화살비를 내린다', 'ranger_arrow', 'ranger_arrow_rain') \
    .add('war_drum', '진격의 북', 16, 'buff', '북소리와 함성으로 아군 전체의 속도와 힘을 올린다', 'hero_warcry', 'general_banner') \
    .add('grand_army', '천하 대진', 22, 'finisher', '군기 아래 전군의 창이 하늘에서 쏟아지는 필살기', 'general_banner', 'valkyrie_lance_rain', 'valkyrie_lance_hit')

BN = pal(pick(CRIM, 'r0', 'r1', 'r2', 'r3'), pick(GOLD, 'y0', 'y1', 'y2', 'y3'), pick(BROWN, 't1', 't2'), pick(STEEL, 's2', 's3'), WHITE)
FEET = 56
PX = 46  # 깃대는 아군 등 뒤(오른쪽)에 선다


@effect('general_banner', 64, 10, 'allAllies', BN)
def _(c, f):
    # 0~2 깃대가 땅에서 솟음 → 3~5 붉은 군기가 펼쳐짐 → 6~9 펄럭이며 금빛 불티, 발밑 충격파
    rise = min(1.0, (f + 1) / 3)
    top = lerp(FEET, 6, ease(rise))
    c.line([(PX, FEET), (PX, top)], 't1', 3)
    c.line([(PX, FEET), (PX, top)], 't2', 1)
    c.star4(PX, top - 2, 3, 'y2', 'y3')
    if f <= 2:
        c.shockring(PX, FEET, 4 + f * 4, 't2', None, 0.35, 1)
    if f >= 3:
        w = 16 * min(1.0, (f - 2) / 3)
        ph = f * 0.9
        topl = [(PX + 1 + i * w / 6, top + 3 + math.sin(ph + i * 0.9) * 1.6 * (i / 6)) for i in range(7)]
        botl = [(x, y + 12 - (i / 6) * 2) for i, (x, y) in enumerate(topl)]
        c.poly(topl + botl[::-1], 'r1')
        inner = [(x, y + 1) for x, y in topl[:-1]] + [(x, y - 1) for x, y in botl[:-1][::-1]]
        c.poly(inner, 'r2')
        c.line(topl, 'r3')
        c.line(botl, 'r0')
        if w > 8:
            mx, my = topl[3][0], topl[3][1] + 6
            c.crown(mx, my + 2, 7, 'y1', gem='w', hi='y3')
    if f >= 5:
        u = (f - 5) / 4
        c.shockring(32, FEET, 12 + u * 16, 'y1', 'y2', 0.3, 1)
        r = rng(f)
        for i in range(6):
            x = 18 + r.uniform(0, 30)
            y = FEET - 6 - r.uniform(0, 30) - u * 6
            c.px(x, y, 'y3' if i % 2 else 'y2')

