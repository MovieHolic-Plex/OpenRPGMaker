"""권투가(class_brawler, 칩 actor3-1): 검은 머리 거리 싸움꾼, 잽·어퍼컷. 새 시트: 어퍼컷(착탄)."""
import math

from lib_r2w1 import *

SKILLS = Skills('brawler', 'class_brawler', 'actor3-1')
SKILLS.add('jab', '잽', 1, 'flurry', '짧고 빠른 잽을 연달아 꽂는다', 'monk_fist_flurry') \
    .add('uppercut', '어퍼컷', 3, 'dash-strike', '파고들어 턱을 올려 친다', 'brawler_uppercut') \
    .add('body_blow', '바디 블로', 5, 'dash-strike', '명치를 파고드는 묵직한 한 방', 'guard_bash') \
    .add('guard_up', '가드 올리기', 7, 'buff', '두 주먹을 올리고 몸을 단단히 굳힌다', 'monk_iron_body') \
    .add('rush', '러시', 10, 'flurry', '연타를 퍼붓다가 어퍼컷으로 끝낸다', 'monk_fist_flurry', 'brawler_uppercut') \
    .add('taunt', '덤벼 봐', 12, 'buff', '주먹을 까딱여 적의 시선을 끈다', 'guard_taunt') \
    .add('hammer', '다이빙 해머', 16, 'leap-strike', '뛰어올라 두 주먹으로 땅을 내려찍는다', 'guard_quake') \
    .add('giga_impact', '기가 임팩트', 22, 'finisher', '온몸의 힘을 실은 한 방으로 적을 날려 버리는 필살기', 'mon_rampage_screen', 'monk_earth_palm')

UP = pal(pick(CRIM, 'r0', 'r1', 'r2', 'r3', 'r4'), pick(GOLD, 'y1', 'y2', 'y3'), pick(STEEL, 's2', 's3'), WHITE)
CX, CY = 32, 34


def glove(c, x, y):
    """위를 향한 붉은 글러브(주먹이 위, 손목이 아래)."""
    c.oval(x, y, 6, 7, 'r0')
    c.oval(x, y, 5, 6, 'r1')
    c.oval(x - 1, y - 1, 4, 4, 'r2')
    c.px(x - 2, y - 4, 'r4')
    c.px(x - 1, y - 4, 'r3')
    c.oval(x - 5, y + 1, 2, 3, 'r1')
    c.rect(x - 4, y + 6, x + 4, y + 9, 's3')
    c.line([(x - 4, y + 9), (x + 4, y + 9)], 's2')


@effect('brawler_uppercut', 64, 9, 'target', UP)
def _(c, f):
    # 0 바닥에서 속도선 → 1~2 글러브가 솟으며 세로 궤적 → 3 턱 높이 충격 → 4~5 광선 확장 → 6~8 머리 위 별이 돈다
    if f == 0:
        for i in range(5):
            x = CX - 8 + i * 4
            c.line([(x, 60), (x, 50 - (i % 2) * 4)], 'r2' if i % 2 else 'y2')
    if 1 <= f <= 3:
        y = {1: 46, 2: 30, 3: 22}[f]
        c.lens((CX, 62), (CX, y + 4), 6, ['r1', 'r2', 'r3', 'y3'])
        glove(c, CX, y)
    if f >= 3:
        u = (f - 3) / 5
        r = 4 + u * 9
        if f <= 6:
            c.burst(CX, 18, r, ['r1', 'r2', 'y2', 'y3', 'w'], rays=8, rot=0.2 + f * 0.1, long=1.6)
        c.dring(CX, 18, 8 + u * 18, 'y2', parity=f % 2)
    if f >= 5:
        for i in range(3):
            a = (f - 5) * 1.1 + i * math.tau / 3
            x, y = pol(CX, 14, 12, a, 0.4)
            c.star4(x, y, 3, 'y2', 'w')
    if f >= 7:
        c.line([(CX - 10, 30), (CX - 16, 26)], 's3')
        c.line([(CX + 10, 30), (CX + 16, 26)], 's3')

