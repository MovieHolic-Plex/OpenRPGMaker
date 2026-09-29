"""엘프 궁사(class_elf_archer, 칩 actor2-6): 초록 머리 엘프, 정령 화살. 새 시트: 정령 화살(투사체)."""
import math

from lib_r2w1 import *

SKILLS = Skills('elf_archer', 'class_elf_archer', 'actor2-6')
SKILLS.add('spirit_arrow', '정령 화살', 1, 'shoot', '바람의 정령이 깃든 화살을 쏜다', 'elf_archer_spirit_arrow', 'ranger_arrow_hit') \
    .add('wind_arrow', '바람 화살', 3, 'shoot', '바람을 감은 화살이 적을 베어 지나간다', 'ranger_arrow', 'samurai_wind_hit') \
    .add('forest_ward', '숲의 가호', 5, 'buff', '나무껍질 가호로 아군 전체의 방어를 높인다', 'druid_bark') \
    .add('pierce', '관통 사격', 7, 'shoot', '정령 화살이 갑옷을 꿰뚫는다', 'elf_archer_spirit_arrow', 'ranger_power_hit') \
    .add('spirit_rain', '정령의 비', 10, 'cast', '하늘로 쏜 화살이 정령이 되어 모든 적 위로 쏟아진다', 'ranger_arrow_rain') \
    .add('leap_volley', '공중 연사', 12, 'leap-strike', '높이 뛰어올라 모든 적에게 화살을 퍼붓는다', ('ranger_arrow_hit', 'allTargets')) \
    .add('moon_arrow', '달빛 화살', 16, 'shoot', '달빛을 머금은 화살이 은빛 기둥을 내린다', 'elf_archer_spirit_arrow', 'druid_moonbeam') \
    .add('starbow', '성궁 일섬', 22, 'finisher', '별하늘을 활시위에 걸어 적진을 관통하는 필살기', 'ranger_storm_charge', 'mage_starfall_sky', 'ranger_storm_hit')

SP = pal(pick(GREEN, 'g0', 'g1', 'g2', 'g3', 'g4'), pick(TEAL, 'c1', 'c2', 'c3', 'c4'), pick(BROWN, 't2', 't3'), WHITE)


@effect('elf_archer_spirit_arrow', 32, 4, 'projectile', SP)
def _(c, f):
    # 촉이 왼쪽. 초록 빛무리에 싸인 화살 + 뒤로 흩어지는 잎·빛가루.
    c.glow(9, 16, 6, ['g1', 'g2', 'c3'])
    for i in range(5):
        x = 14 + i * 3.5 + (f % 2) * 1.5
        y = 16 + math.sin(f * 1.3 + i) * (1 + i * 0.6)
        c.px(x, y, ['c4', 'c3', 'g3', 'g2', 'g1'][i])
        if i % 2 == 0:
            c.px(x + 1, y + (1 if f % 2 else -1), 'g2')
    c.arrow(3, 16, math.pi, 22, 't2', 'c3', 'g3', hi='w', fletch2='g2', head_len=5, head_w=2.5)
    lx, ly = 22 + f * 2, 11 + (f % 2) * 10
    c.leaf(lx, ly, f * 0.9, 4, 'g2', 'g4')
    c.px(4, 16, 'c4')
    c.spark(8, 16 + (1 if f in (1, 2) else -1), 1 + f % 2, 'w', 'c4')

