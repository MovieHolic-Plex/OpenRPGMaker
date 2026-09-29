"""해적(class_pirate, 칩 actor2-4): 붉은 두건 해적, 곡도·대포. 새 시트: 포탄(투사체)·일제 포격(화면)."""
import math

from lib_r2w1 import *

SKILLS = Skills('pirate', 'class_pirate', 'actor2-4')
SKILLS.add('cutlass', '곡도 베기', 1, 'dash-strike', '곡도를 휘둘러 X자로 벤다', 'hero_cross') \
    .add('cannon', '대포 사격', 3, 'shoot', '어깨에 멘 대포로 포탄을 쏜다', 'pirate_cannonball', 'mon_rock_burst') \
    .add('plunder', '해적 난도', 5, 'flurry', '거칠게 파고들어 곡도를 마구 휘두른다', 'scout_flurry') \
    .add('rum', '럼주 한 모금', 7, 'buff', '럼주를 들이켜고 불같은 기세로 공격력을 올린다', 'hero_flame_aura') \
    .add('anchor', '닻 휘두르기', 10, 'spin', '쇠사슬 닻을 돌려 모든 적을 후려친다', 'hero_whirl') \
    .add('smoke_deck', '연막 갑판', 12, 'cast', '연막탄을 던져 모든 적의 눈을 가린다', 'scout_bomb', 'scout_smoke') \
    .add('wave_raid', '파도 강습', 16, 'leap-strike', '파도를 타고 뛰어올라 적진에 물보라를 내리꽂는다', 'ninja_splash') \
    .add('broadside', '일제 포격', 22, 'finisher', '유령선의 포문을 모두 열어 적진을 불바다로 만드는 필살기', 'pirate_broadside', ('mage_meteor_blast', 'allTargets'))

BALL = pal(pick(STEEL, 's0', 's1', 's2', 's3'), pick(SMOKEC, 'q1', 'q2', 'q3', 'q4'), pick(FIREC, 'f2', 'f3', 'f4'), WHITE)
SHIP = pal(pick(FIREC, 'f1', 'f2', 'f3', 'f4'), pick(SMOKEC, 'q0', 'q1', 'q2', 'q3'), pick(STEEL, 's0', 's1'), pick(SEA, 'a1', 'a2', 'a3'), WHITE)


@effect('pirate_cannonball', 32, 4, 'projectile', BALL)
def _(c, f):
    # 포탄은 왼쪽으로 날아간다. 뒤(오른쪽)에 연기 덩이가 흘러가고 도화선 불티가 돈다.
    for i in range(4):
        x = 17 + i * 4 + (f % 2) * 2
        r = 2.2 + i * 0.6 - (f % 2) * 0.4
        c.disc(x, 16 + ((i + f) % 3 - 1), r, ['q3', 'q2', 'q2', 'q1'][i])
        if i < 2:
            c.px(x - 1, 15 + ((i + f) % 3 - 1), 'q4')
    for j in range(3):
        y = 11 + j * 5
        c.line([(15 + (f + j) % 3, y), (21 + (f + j) % 3 * 2, y)], 'q2')
    c.disc(10, 16, 6, 's0')
    c.disc(10, 16, 5, 's1')
    c.disc(9, 15, 3, 's2')
    c.px(8, 13, 's3')
    c.px(7, 14, 'w')
    a = f * math.pi / 2
    sx, sy = pol(13, 11, 2, a)
    c.spark(sx, sy, 2, 'f4', 'f2')
    c.px(*pol(13, 11, 3, a + math.pi), 'f3')


def hull(c, fire):
    # 오른쪽 하늘에 뜬 검은 유령선 옆구리: 포문 넷, 돛대 둘. 아군(오른쪽 아래)을 가리지 않게 위로 띄운다.
    _hull(c, fire, -22)


def _hull(c, fire, dy):
    def S(pts):
        return [(x, y + dy) for x, y in pts]
    c.poly(S([(66, 70), (118, 66), (114, 84), (72, 86)]), 'q0')
    c.line(S([(66, 70), (118, 66)]), 'q1')
    for x in (84, 102):
        c.line(S([(x, 67), (x, 36)]), 'q1', 2)
        c.poly(S([(x + 1, 40), (x + 12, 46), (x + 1, 60)]), 'q1')
    for i, x in enumerate((74, 84, 94, 104)):
        y = 75 - i * 0.6 + dy
        c.rect(x, y, x + 4, y + 3, 'f2' if fire[i] else 's0')
    # 배 밑으로 흩어지는 유령 안개(바다 대신)
    for i in range(9):
        c.px(70 + i * 5, 88 + dy + (i % 2), 'a2' if i % 2 else 'a3')
        c.px(68 + i * 5, 91 + dy, 'a1')


@effect('pirate_broadside', 128, 12, 'screen', SHIP)
def _(c, f):
    ports = [(74, 54), (84, 54), (94, 53), (104, 53)]
    # 일제 포격: 포문이 차례로 불을 뿜고(0~3) → 포탄 넷이 왼쪽으로(3~7) → 왼쪽 적진에 폭발(7~10) → 연기(11)
    fire = [f >= i and f <= i + 2 for i in range(4)]
    hull(c, fire)
    for i, (x, y) in enumerate(ports):
        if i <= f <= i + 1:
            c.burst(x - 2, y + 1, 4 + (f - i) * 2, ['f1', 'f3', 'f4', 'w'], rays=6, long=1.5)
            c.puff(x - 8, y - 2, 4 + (f - i) * 2, ['q1', 'q2', 'q3'], seed=i)
    targets = [(24, 60), (40, 74), (30, 88), (50, 56)]
    for i in range(4):
        t = (f - 3 - i * 0.5) / 4
        if 0 <= t <= 1:
            x0, y0 = ports[i]
            tx, ty = targets[i]
            x = lerp(x0 - 8, tx, t)
            y = lerp(y0, ty, t) - math.sin(math.pi * t) * 14
            c.line([(x + 3, y), (x + 14, y + 2)], 'q2', 2)
            c.disc(x, y, 3.2, 's0')
            c.disc(x - 1, y - 1, 1.8, 's1')
    if f >= 7:
        for i, (tx, ty) in enumerate(targets):
            u = f - 7 - i * 0.4
            if 0 <= u <= 3.6:
                r = 5 + u * 5
                if u < 2.2:
                    c.burst(tx, ty, r, ['f1', 'f2', 'f3', 'f4', 'w'], rays=8, rot=i, long=1.4)
                else:
                    c.puff(tx, ty - u * 2, r * 0.8, ['q0', 'q1', 'q2', 'q3'], seed=i + 5)
    if f >= 10:
        c.puff(64, 40 - (f - 10) * 4, 10 + (f - 10) * 3, ['q1', 'q2', 'q3'], seed=9, lobes=7)
        for i in range(8):
            c.px(20 + i * 8, 66 - ((i * 7 + f) % 10), 'f3')

