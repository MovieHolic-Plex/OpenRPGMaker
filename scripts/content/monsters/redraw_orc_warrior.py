#!/usr/bin/env python3
"""도끼 오크(orc-warrior) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

어깨가 넓고 구부정한 초록 오크: 앞으로 튀어나온 큰 주둥이, 아래턱에서 솟은 두 엄니, 작은 붉은 눈과 굵은 눈썹,
뒤로 묶은 검은 머리. 겹친 강철 흉갑과 둥근 어깨 판, 가죽 허리 치마, 굵은 다리와 장화.
먼 팔에 청동 중심 장식의 둥근 나무 방패, 가까운 손에 반달 날 큰 도끼.
6번 칸(스킬 skill_mon_axe_cleave): 도끼를 머리 뒤에서 크게 휘둘러 내려찍는 반원 궤적.

  python3 scripts/content/monsters/redraw_orc_warrior.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (18, 24, 16)
SKIN = [(52, 96, 40), (84, 136, 56), (120, 172, 76), (160, 204, 108)]
SKIN_FAR = [(40, 72, 32), (52, 96, 40), (66, 112, 48), (66, 112, 48)]
STEEL = [(76, 84, 98), (120, 130, 146), (168, 178, 192), (224, 230, 238)]
STEEL_FAR = [(56, 62, 74), (76, 84, 98), (96, 106, 120), (96, 106, 120)]
LEATHER = [(72, 44, 30), (108, 70, 44), (140, 96, 60), (140, 96, 60)]
LEATHER_FAR = [(72, 44, 30), (72, 44, 30), (108, 70, 44), (108, 70, 44)]
WOOD = [(86, 54, 32), (124, 82, 48), (160, 112, 66), (160, 112, 66)]
BRONZE = [(140, 90, 40), (204, 150, 64), (246, 210, 120)]
HAIR = (30, 26, 24)
EYE = (230, 50, 40)
TUSK = (244, 236, 204)
HAFT = (96, 60, 34)
WHITE = (255, 255, 240)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee], [4.2, 3.6]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -3))], [3.6, 3.2]), LEATHER_FAR if far else LEATHER, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 3, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 3, f[1])]), LEATHER, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 가죽 허리 치마(두 자락)
    cv.part(poly(cv.blank(), [R(-6, -2), R(6, -2), R(7, 5), R(1, 4), R(-1, 6), R(-7, 4)]), LEATHER)
    # 굵은 상체(맨살 등) + 겹친 강철 흉갑
    cv.part(poly(cv.blank(), [R(-7, -1), R(6, -1), R(8, -9), R(7, -15), R(-2, -17), R(-8, -13)]), SKIN)
    cv.part(poly(cv.blank(), [R(-3, -2), R(7, -2), R(8, -9), R(7, -14), R(-1, -15), R(-4, -9)]), STEEL)
    for y in (-6, -10):
        cv.line4([R(-3, y), R(7, y - 1)], STEEL[0])
    cv.pixel(*rnd(R(4, -12)), STEEL[3])
    cv.line([rnd(R(-6, -1)), rnd(R(6, -1))], LEATHER[0])
    cv.pixel(*rnd(R(2, -1)), BRONZE[1])


def axe(cv, hand, ang):
    """손에서 ang 방향으로 자루, 끝에 반달 날(날이 ang+90 쪽=앞). 자루 쪽은 좁고 날 끝은 위아래로 휘어 뻗는다."""
    top = polar(hand, ang, 12)
    butt = polar(hand, ang + 180, 3)
    cv.part(chain([butt, top], [1.3, 1.3]), [INK, HAFT, HAFT, WOOD[2]], gloss=False)
    side = ang + 90
    c = polar(top, ang + 180, 3)
    edge = polar(c, side, 8.5)
    blade = [polar(c, ang, 1.5), polar(polar(c, ang, 2.5), side, 3.5), polar(polar(c, ang, 5.5), side, 7),
             polar(polar(c, ang, 3), side, 8.2), edge, polar(polar(c, ang + 180, 3), side, 8.2),
             polar(polar(c, ang + 180, 5.5), side, 7), polar(polar(c, ang + 180, 2.5), side, 3.5), polar(c, ang + 180, 1.5)]
    cv.part(poly(cv.blank(), blade), STEEL)
    # 벼린 날 끝 하이라이트 + 자루 박힌 부분
    cv.line4([rnd(polar(polar(c, ang, 3.5), side, 7.4)), rnd(edge), rnd(polar(polar(c, ang + 180, 3.5), side, 7.4))], STEEL[3])
    cv.pixel(*rnd(polar(c, side, 1.5)), STEEL[0])
    return edge


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [3.4, 3.0]), ramp, gloss=False)
    cv.part(chain([el, hand], [3.0, 2.8]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.4, 2.4), ramp, gloss=False)
    # 둥근 어깨 판
    cv.part(ellipse(cv.blank(), add(sh, (0, 1)), 4.0, 3.4), STEEL_FAR if far else STEEL)
    if far:
        # 청동 중심 장식 둥근 나무 방패
        s = add(hand, P.extra.get("shield_off", (1, -1)))
        cv.part(ellipse(cv.blank(), s, 6.5, 7.0), WOOD)
        cv.put(ellipse(cv.blank(), s, 2.2, 2.2), BRONZE[1])
        cv.pixel(*rnd(add(s, (-1, -1))), BRONZE[2])
        for d in ((0, -5), (4, 3), (-4, 3)):
            cv.pixel(*rnd(add(s, d)), BRONZE[0])
    else:
        P.extra["_axe_tip"] = axe(cv, hand, P.extra.get("axe", -80))


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뒤로 묶은 머리 꽁지
    cv.part(chain([R(-4, -4), R(-8, -3), R(-10, 0)], [2.2, 1.8, 1.2]), [INK, HAIR, HAIR, HAIR], gloss=False)
    cv.part(ellipse(cv.blank(), R(-1, -1), 5.0, 5.0), SKIN)
    # 큰 주둥이 + 아래턱
    jaw = P.extra.get("jaw", 0)
    cv.part(poly(cv.blank(), [R(1, -2), R(7, -1), R(8, 2), R(6, 4 + jaw), R(0, 4 + jaw), R(-2, 2)]), SKIN, gloss=False)
    cv.line4([R(-3, -6), R(2, -6)], HAIR)
    # 굵은 눈썹 + 붉은 눈
    if P.extra.get("eye") == "shut":
        cv.line([rnd(R(2, -3)), rnd(R(4, -2))], INK)
    else:
        cv.line([rnd(R(1, -4)), rnd(R(5, -3 if P.extra.get("angry") else -4))], INK)
        cv.pixel(*rnd(R(3, -2)), EYE)
    cv.pixel(*rnd(R(7, 0)), INK)  # 콧구멍
    if jaw:
        cv.line([rnd(R(3, 2)), rnd(R(7, 2 + jaw * 0.5))], INK)
    # 아래턱 엄니 둘(위로 솟음)
    for dx in (4, 7):
        cv.line([rnd(R(dx, 3 + jaw)), rnd(R(dx, 1 + jaw * 0.5))], TUSK)
    cv.pixel(*rnd(R(-2, -5)), SKIN[3])
    return dict(eye=R(3, -2), mouth=R(6, 3))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=6.5, thigh=6.5, shin=6.5, hip_w=5.0, shoulder_w=8.0)


def pose(name):
    b = dict(hip=(26, 46), torso=14.0, neck=0.5, foot_near=(33, 0), foot_far=(20, 0))
    if name == "idle_a":  # 방패를 앞에 들고 도끼는 비스듬히 아래로 쥔다
        return Pose(**b, lean=12, arm_near=(95, 60), arm_far=(40, 20), head_tilt=6, extra=dict(axe=-55))
    if name == "idle_b":  # 숨을 몰아쉬며 어깨가 내려앉고 턱을 벌린다
        return Pose(**dict(b, hip=(26, 47)), lean=16, arm_near=(100, 66), arm_far=(45, 25), head_tilt=10,
                    extra=dict(axe=-48, jaw=1))
    if name == "idle_c":  # 도끼를 고쳐 쥔다
        return Pose(**dict(b, foot_near=(34, 0)), lean=10, arm_near=(90, 54), arm_far=(36, 16), head_tilt=2,
                    extra=dict(axe=-64))
    if name == "windup":  # 도끼를 머리 뒤로 높이 젖히고 방패를 앞으로
        return Pose(**dict(b, hip=(24, 46), foot_near=(32, 0), foot_far=(16, 0)), lean=-4,
                    arm_near=(-110, -140), arm_far=(10, -10), head_tilt=-8,
                    extra=dict(axe=-170, angry=True, jaw=2, shield_off=(3, 0)))
    if name == "move":  # 방패를 앞세우고 돌진
        return Pose(**dict(b, hip=(30, 45), foot_near=(40, 2), foot_far=(18, 1)), lean=24,
                    arm_near=(120, 80), arm_far=(15, -5), head_tilt=14,
                    extra=dict(axe=150, angry=True, jaw=1, shield_off=(3, 0)))
    if name == "attack":  # 도끼를 앞으로 내리친다
        return Pose(**dict(b, hip=(24, 46), foot_near=(35, 0), foot_far=(14, 0)), lean=26,
                    arm_near=(0, 20), arm_far=(100, 80), head_tilt=14, extra=dict(axe=-20, angry=True, jaw=2))
    if name == "recover":  # 스킬 쪼개기: 깊이 내려찍고 몸을 숙인 끝 자세
        return Pose(**dict(b, hip=(26, 48), foot_near=(39, 0), foot_far=(15, 0)), lean=34,
                    arm_near=(40, 70), arm_far=(120, 100), head_tilt=18, extra=dict(axe=20, angry=True, jaw=3))
    if name == "hit":  # 맞고 뒤로 젖혀지며 방패를 쳐든다
        return Pose(**dict(b, hip=(25, 47), foot_near=(31, 0), foot_far=(17, 1)), lean=-16,
                    arm_near=(120, 140), arm_far=(-20, -40), head_tilt=-22,
                    extra=dict(axe=-120, eye="shut", jaw=2, shield_off=(2, 0)))
    raise KeyError(name)


def draw_dead(cv):
    """엎어진 오크: 방패가 등 위에, 도끼가 앞에 떨어져 있다."""
    cv.part(chain([(10, 58), (18, 58)], [3.2, 3.0]), LEATHER, gloss=False)
    cv.part(poly(cv.blank(), [(16, 59), (20, 52), (34, 51), (37, 59)]), STEEL)
    cv.part(ellipse(cv.blank(), (24, 52), 6.0, 3.4), WOOD)
    cv.put(ellipse(cv.blank(), (24, 52), 1.8, 1.4), BRONZE[1])
    cv.part(ellipse(cv.blank(), (41, 55), 4.6, 4.2), SKIN)
    cv.part(poly(cv.blank(), [(43, 55), (48, 56), (47, 59), (42, 59)]), SKIN, gloss=False)
    cv.line([(40, 54), (42, 54)], INK)
    cv.pixel(47, 57, TUSK)
    cv.line4([(50, 59), (58, 56)], HAFT)
    cv.part(poly(cv.blank(), [(55, 53), (59, 54), (60, 58), (57, 57)]), STEEL, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 3, 9, (34, 42, 50), SKIN[1])
    J = draw_body(cv, LOOK, P)
    tip = P.extra.get("_axe_tip", J["hand_n"])
    if name == "windup":
        sparkle(cv, add(tip, (2, -2)), WHITE, STEEL[2])
    elif name == "move":
        puff(cv, (12, 57), 2.4, [LEATHER[1], LEATHER[2]])
    elif name == "attack":
        slash(cv, add(tip, (-6, -10)), add(tip, (2, 4)), 2, 2.6, STEEL[2], WHITE)
        burst(cv, add(tip, (2, 1)), 3.6, STEEL[3], WHITE, spikes=6)
    elif name == "recover":
        # 머리 위에서 앞 바닥까지 크게 내려긋는 반원 궤적 + 땅을 찍은 충격
        h = J["head"]
        arc = [polar((h[0] + 2, h[1] + 8), a, 17) for a in range(-110, 61, 10)]
        for k in range(len(arc) - 1):
            w = 0.6 + 1.6 * k / (len(arc) - 1)
            cv.line4([rnd(arc[k]), rnd(arc[k + 1])], WHITE if w > 1.5 else STEEL[2])
            if w > 1.1:
                cv.line4([rnd(polar(arc[k], 70 + k * 10, 1)), rnd(polar(arc[k + 1], 80 + k * 10, 1))], STEEL[2])
        burst(cv, (tip[0], min(tip[1], 57)), 4.0, STEEL[3], WHITE, spikes=7)
        puff(cv, (tip[0] - 4, 57), 2.0, [LEATHER[1], LEATHER[2]])
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -8), (10, -5), (9, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("orc-warrior", draw, sys.argv[1:], idle_ms=300)
