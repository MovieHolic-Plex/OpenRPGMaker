#!/usr/bin/env python3
"""좀비(zombie-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

키 크고 어깨가 넓은 잿빛 녹색 좀비: 썩어 꺼진 볼(한쪽 뺨에 구멍), 벌어진 입의 들쭉날쭉한 이빨,
찢어진 짙은 남색 외투(어깨가 흘러내려 굵은 팔이 드러난다), 해진 반바지 아래 굵은 맨다리와 큰 맨발.
썩은 좀비(zombie-rot)의 굽은 등·내민 팔과 달리 몸을 꼿꼿이 세우고 한 팔은 늘어뜨린 채 다른 팔로 휘두른다.
6번 칸(스킬 부패의 손아귀): 땅을 내려친 손에서 썩은 손 둘이 앞쪽 땅을 뚫고 솟아 붙잡는다.

  python3 scripts/content/monsters/redraw_zombie_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, polar, poly, puff, rnd, run, slash, sparkle

INK = (18, 22, 20)
SKIN = [(78, 100, 80), (112, 140, 106), (148, 174, 132), (182, 204, 160)]
SKIN_FAR = [(56, 74, 60), (78, 100, 80), (96, 120, 92), (96, 120, 92)]
COAT = [(28, 32, 58), (44, 52, 88), (66, 76, 116), (90, 100, 140)]
COAT_FAR = [(20, 22, 42), (28, 32, 58), (40, 46, 78), (40, 46, 78)]
SHORTS = [(70, 56, 40), (100, 82, 58), (130, 108, 78), (130, 108, 78)]
TOOTH = (226, 220, 180)
GORE = (110, 26, 30)
EYE, EYE_HI = (220, 70, 60), (255, 200, 170)
DIRT = [(80, 62, 44), (120, 96, 66), (150, 124, 90), (170, 146, 110)]
ROT = [(90, 110, 60), (150, 180, 90), (220, 236, 160)]
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    skin = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee], [5.0, 4.2]), SHORTS if not far else [(c[0] * 3 // 4, c[1] * 3 // 4, c[2] * 3 // 4) for c in SHORTS], gloss=False)
    cv.part(chain([knee, add(foot, (0, -1))], [3.6, 3.0]), skin, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 3, f[1] - 2), (f[0] + 5, f[1]), (f[0] - 2, f[1])]), skin, gloss=False)
    if not far:
        cv.pixel(*rnd(add(knee, (0, 2))), GORE)


def torso(cv, hip, chest, lean, P):
    # 넓은 어깨에서 좁아지는 외투 몸통 + 찢긴 아랫단
    pts = [add(hip, (-5, 2)), add(hip, (5, 2)), add(chest, (6, 2)), add(chest, (5, -3)), add(chest, (-5, -3)), add(chest, (-7, 2))]
    cv.part(poly(cv.blank(), pts), COAT)
    for dx, dy in ((-4, 4), (-1, 3), (2, 5)):
        cv.part(poly(cv.blank(), [add(hip, (dx - 1, 1)), add(hip, (dx + 2, 1)), add(hip, (dx, dy))]), COAT, gloss=False)
    # 외투 앞섶이 벌어져 드러난 배(살 + 꿰맨 자국)
    m = add(hip, (2, -5))
    cv.put(poly(cv.blank(), [add(m, (0, -4)), add(m, (3, -4)), add(m, (3, 3)), add(m, (1, 3))]), SKIN[1])
    cv.line([add(m, (1, -3)), add(m, (2, 2))], SKIN[0])
    cv.pixel(*rnd(add(m, (2, 0))), GORE)


def arm(cv, sh, el, hand, far, P):
    skin = SKIN_FAR if far else SKIN
    # 흘러내린 소매(위팔 절반만) + 드러난 굵은 아래팔
    mid = add(sh, ((el[0] - sh[0]) * 0.5, (el[1] - sh[1]) * 0.5))
    cv.part(chain([sh, mid], [5.4, 4.8]), COAT_FAR if far else COAT, gloss=False)
    cv.part(chain([mid, el], [4.0, 3.6]), skin, gloss=False)
    cv.part(chain([el, hand], [3.6, 3.2]), skin, gloss=False)
    a = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    cv.part(ellipse(cv.blank(), hand, 2.2, 2.2), skin, gloss=False)
    if not far:
        for k in (-30, 10):
            cv.line4([rnd(hand), rnd(polar(hand, a + k, 3.4))], skin[2])


def head(cv, c, tilt, P):
    mouth = P.extra.get("mouth", 2)
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = [r(-2, 2), r(6, 2), r(6, 4 + mouth), r(0, 5 + mouth * 0.6)]
    if mouth > 1:
        cv.put(poly(cv.blank(), [r(1, 1), r(6, 1), r(6, 3 + mouth), r(1, 4)]), GORE)
    cv.part(poly(cv.blank(), jaw), SKIN, gloss=False)
    # 높고 길쭉한 머리(정수리 납작) + 앞이마 튀어나옴
    cv.part(poly(cv.blank(), [r(-4, -5), r(0, -7), r(5, -6), r(6, -3), r(7, 1), r(4, 2), r(-2, 3), r(-4, 0)]), SKIN)
    # 헝클어진 짙은 머리털 몇 가닥
    for p in ((-3, -6), (-1, -7), (1, -8), (-4, -4)):
        cv.pixel(*rnd(r(*p)), INK)
    # 이빨: 위 3, 아래 2(들쭉날쭉)
    for dx in (2, 4, 6):
        cv.pixel(*rnd(r(dx, 2)), TOOTH)
    for dx in (3, 5):
        cv.pixel(*rnd(r(dx, 3 + mouth)), TOOTH)
    # 꺼진 볼 구멍
    cv.pixel(*rnd(r(1, 0)), GORE)
    cv.pixel(*rnd(r(0, 1)), SKIN[0])
    # 눈: 앞눈 붉은 눈빛, 뒷눈은 퀭한 구멍
    if P.extra.get("eye") == "shut":
        cv.line([rnd(r(3, -3)), rnd(r(5, -3))], INK)
    else:
        e = rnd(r(4, -3))
        cv.pixel(*e, EYE)
        cv.pixel(*add(e, (1, 0)), EYE_HI)
        cv.line([add(e, (-1, -1)), add(e, (2, -1))], INK)
        cv.pixel(*rnd(r(1, -3)), INK)
    return dict(mouth=r(7, 2 + mouth * 0.5), eye=r(4, -3))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=8.0, lower=7.5, thigh=8.5, shin=9.5, shoulder_w=4, hip_w=4)


def pose(name):
    if name == "idle_a":  # 꼿꼿이 서서 한 팔은 늘어뜨리고 한 팔은 앞으로 반쯤
        return Pose(hip=(27, 40), lean=6, torso=13, arm_near=(60, 30), arm_far=(95, 85), foot_near=(33, 0), foot_far=(21, 0),
                    head_tilt=8, extra=dict(mouth=2))
    if name == "idle_b":  # 고개가 옆으로 툭 떨어지며 입이 벌어진다
        return Pose(hip=(27, 41), lean=4, torso=13, arm_near=(70, 50), arm_far=(100, 90), foot_near=(33, 0), foot_far=(21, 0),
                    head_tilt=24, extra=dict(mouth=4))
    if name == "idle_c":  # 무릎이 꺾이며 휘청
        return Pose(hip=(26, 41), lean=10, torso=13, arm_near=(50, 20), arm_far=(85, 70), foot_near=(34, 1), foot_far=(19, 0),
                    head_tilt=-4, extra=dict(mouth=1))
    if name == "windup":  # 가까운 팔을 뒤로 크게 젖혀 휘두를 준비
        return Pose(hip=(25, 41), lean=-6, torso=13, arm_near=(-150, -100), arm_far=(40, 20), foot_near=(33, 0), foot_far=(17, 0),
                    head_tilt=-10, extra=dict(mouth=5))
    if name == "move":  # 질질 끌며 앞으로 쏠린다
        return Pose(hip=(31, 41), lean=22, torso=13, arm_near=(20, 10), arm_far=(10, 0), foot_near=(40, 0), foot_far=(18, 2),
                    head_tilt=16, extra=dict(mouth=3))
    if name == "attack":  # 가까운 팔로 앞을 후려친다
        return Pose(hip=(31, 41), lean=20, torso=13, arm_near=(-10, 20), arm_far=(70, 50), foot_near=(41, 0), foot_far=(22, 0),
                    head_tilt=14, extra=dict(mouth=6))
    if name == "recover":  # 스킬: 무릎 꿇듯 숙여 땅을 내려친다
        return Pose(hip=(23, 45), lean=30, torso=12, arm_near=(60, 85), arm_far=(85, 90), foot_near=(31, 0), foot_far=(15, 0),
                    head_tilt=20, extra=dict(mouth=5))
    if name == "hit":  # 맞아서 뒤로 젖혀진다
        return Pose(hip=(23, 41), lean=-18, torso=13, arm_near=(-30, 0), arm_far=(-50, -20), foot_near=(30, 0), foot_far=(17, 2),
                    head_tilt=-30, extra=dict(mouth=4, eye="shut"))
    raise KeyError(name)


def grave_hand(cv, base, h, ang):
    """땅에서 솟은 썩은 손: 아래팔 + 벌린 손가락 셋."""
    top = polar(base, ang, h)
    cv.part(chain([base, top], [3.4, 3.0]), SKIN, gloss=False)
    for k in (-35, 0, 35):
        cv.line4([rnd(top), rnd(polar(top, ang + k, 3.2))], SKIN[2])
    cv.pixel(*rnd(polar(base, ang, h * 0.5)), GORE)


def draw_dead(cv):
    """앞으로 고꾸라져 엎어진 몸: 한 팔을 앞으로 뻗었다."""
    cv.part(chain([(8, 57), (18, 57)], [4, 4]), SKIN_FAR, gloss=False)
    cv.part(chain([(14, 56), (22, 56)], [5, 5]), SHORTS, gloss=False)
    cv.part(poly(cv.blank(), [(20, 59), (21, 52), (38, 51), (40, 59)]), COAT)
    cv.part(chain([(38, 57), (48, 58), (56, 57)], [3.6, 3.2, 3.0]), SKIN, gloss=False)
    cv.part(ellipse(cv.blank(), (43, 53), 4.5, 4.0), SKIN)
    cv.line([(42, 51), (44, 53)], INK)
    cv.line([(44, 51), (42, 53)], INK)
    cv.pixel(46, 55, TOOTH)
    puff(cv, (26, 49), 2.4, ROT[:2])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    if name == "attack":
        h = J["hand_n"]
        slash(cv, add(h, (-4, -10)), add(h, (4, 6)), 3, 3.0, ROT[1], WHITE)
        burst(cv, add(h, (3, 2)), 4.0, GORE, (240, 190, 180), spikes=6)
    elif name == "recover":
        # 내려친 손 앞 땅에 금 + 흙덩이, 앞쪽에서 썩은 손 둘이 솟는다(바닥 흙 띠로 몸과 이어진다)
        h = J["hand_n"]
        cv.part(poly(cv.blank(), [add(h, (-2, 1)), (61, 57), (61, 60), add(h, (-3, 4))]), DIRT, gloss=False)
        grave_hand(cv, (47, 58), 13, -100)
        grave_hand(cv, (57, 58), 17, -82)
        for x, y in ((44, 54), (53, 52)):
            cv.part(ellipse(cv.blank(), (x, y), 1.2, 1.0), DIRT, gloss=False)
        puff(cv, (52, 55), 2.2, ROT[:2])
    elif name == "windup":
        sparkle(cv, add(J["eye"], (3, -4)), WHITE, EYE)
    elif name == "move":
        puff(cv, (14, 57), 2.4, DIRT[:2])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((6, -6), (8, -3), (7, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("zombie-01", draw, sys.argv[1:], idle_ms=230)
