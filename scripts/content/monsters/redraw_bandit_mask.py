#!/usr/bin/env python3
"""복면 산적(bandit-mask) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

호리호리한 인간 도적: 챙 넓은 검은 모자, 눈만 드러낸 검은 복면(날카로운 흰 눈), 청회색 가죽옷과
엇갈린 가죽 끈, 뒤로 휘날리는 붉은 망토, 갈색 가죽 장화. 가까운 손에 곧은 강철 검.
몸을 낮추고 검을 앞으로 겨눈 펜싱식 자세.
6번 칸(스킬 skill_mon_backstab): 연기 잔상을 남기며 순식간에 파고들어 검을 깊게 찌른다.

  python3 scripts/content/monsters/redraw_bandit_mask.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (16, 16, 22)
SKIN = [(150, 100, 74), (196, 140, 104), (226, 180, 140), (226, 180, 140)]
CLOTH = [(44, 56, 70), (70, 88, 106), (102, 122, 142), (136, 156, 174)]
CLOTH_FAR = [(34, 42, 54), (44, 56, 70), (56, 70, 86), (56, 70, 86)]
CAPE = [(100, 20, 26), (150, 34, 38), (196, 60, 58), (196, 60, 58)]
BLACK = [(20, 20, 26), (36, 36, 46), (56, 56, 70), (80, 80, 96)]
BOOT = [(60, 38, 26), (92, 60, 40), (124, 86, 58), (124, 86, 58)]
STRAP = (70, 46, 30)
STEEL = [(110, 116, 128), (176, 184, 196), (238, 242, 248)]
HILT = (150, 110, 50)
SMOKE = [(70, 72, 84), (110, 112, 126), (150, 152, 166)]
EYE = (250, 250, 240)
WHITE = (255, 255, 255)


def leg(cv, hip, knee, foot, far):
    ramp = CLOTH_FAR if far else CLOTH
    cv.part(chain([hip, knee], [2.8, 2.4]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -2))], [2.6, 2.4]), [BOOT[0]] * 2 + [BOOT[1]] * 2 if far else BOOT, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 3, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 2, f[1])]), BOOT, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뒤로 휘날리는 붉은 망토(어깨 → 뒤 아래)
    fl = P.extra.get("cape", 0)
    cape = [R(-2, -13), R(-4, -14), (hip[0] - 10 - fl, hip[1] - 4 - fl * 0.4), (hip[0] - 12 - fl * 1.3, hip[1] + 3 - fl * 0.6),
            (hip[0] - 7 - fl * 0.6, hip[1] + 2), R(-3, -2)]
    cv.part(poly(cv.blank(), cape), CAPE)
    cv.line4([R(-4, -10), (hip[0] - 9 - fl, hip[1])], CAPE[0])
    # 가죽 웃옷(허리가 잘록) + 엇갈린 끈 + 허리띠
    cv.part(poly(cv.blank(), [R(-3, 1), R(3, 1), R(4, -6), R(4, -12), R(-4, -13), R(-4, -6)]), CLOTH)
    cv.line4([R(-3, -12), R(3, -3)], STRAP)
    cv.line([rnd(R(-4, -1)), rnd(R(4, -1))], STRAP)
    cv.pixel(*rnd(R(1, -1)), HILT)


def arm(cv, sh, el, hand, far, P):
    ramp = CLOTH_FAR if far else CLOTH
    cv.part(chain([sh, el], [2.2, 2.0]), ramp, gloss=False)
    cv.part(chain([el, hand], [2.0, 1.8]), [BLACK[0], BLACK[1], BLACK[1], BLACK[2]], gloss=False)  # 검은 장갑
    if not far and P.extra.get("sword", True):
        ang = P.extra.get("blade", math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0])))
        g = polar(hand, ang, 1.5)
        tip = polar(hand, ang, P.extra.get("reach", 13))
        cv.line4([rnd(polar(hand, ang + 180, 2)), rnd(hand)], STRAP)
        cv.line([rnd(polar(g, ang + 90, 2)), rnd(polar(g, ang - 90, 2))], HILT)
        cv.line4([rnd(g), rnd(tip)], STEEL[1])
        cv.line([rnd(polar(g, ang - 90, 0.8)), rnd(polar(tip, ang + 180, 1.5))], STEEL[2])
        P.extra["_tip"] = tip


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 복면 쓴 머리(검정) + 뒤로 묶은 복면 꼬리
    cv.part(chain([R(-3, -1), R(-7, 0), R(-9, 2)], [1.6, 1.2, 0.8]), BLACK, gloss=False)
    cv.part(ellipse(cv.blank(), R(0, 0), 4.2, 4.4), BLACK)
    # 드러난 눈가 맨살 띠 + 날카로운 흰 눈
    cv.put(poly(cv.blank(), [R(0, -2), R(4, -2), R(4, 0), R(0, 0)]), SKIN[1])
    if P.extra.get("eye") == "shut":
        cv.line([rnd(R(1, -1)), rnd(R(3, -1))], INK)
    else:
        cv.pixel(*rnd(R(2, -1)), EYE)
        cv.pixel(*rnd(R(3, -1)), INK)
    cv.line([rnd(R(0, -3)), rnd(R(4, -3 + (1 if P.extra.get("angry") else 0)))], INK)
    # 챙 넓은 검은 모자: 둥근 꼭대기 + 앞으로 길게 나온 챙
    cv.part(poly(cv.blank(), [R(-3, -3), R(-2, -7), R(2, -8), R(4, -5), R(3, -3)]), BLACK)
    cv.part(poly(cv.blank(), [R(-7, -3), R(7, -4), R(8, -3), R(-6, -2)]), BLACK, gloss=False)
    cv.line([rnd(R(-2, -4)), rnd(R(3, -5))], CAPE[1])  # 모자 띠
    return dict(eye=R(2, -1))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.0, lower=6.0, thigh=8.0, shin=8.0, hip_w=3.0, shoulder_w=4.0)


def pose(name):
    b = dict(hip=(28, 44), torso=12.0, neck=1.0, foot_near=(37, 0), foot_far=(20, 0))
    if name == "idle_a":  # 낮게 겨눈 펜싱 자세
        return Pose(**b, lean=10, arm_near=(20, -10), arm_far=(150, 120), head_tilt=4, extra=dict(blade=-15, cape=1))
    if name == "idle_b":  # 무게를 낮추며 검끝이 내려간다
        return Pose(**dict(b, hip=(28, 45)), lean=14, arm_near=(30, 0), arm_far=(155, 130), head_tilt=8,
                    extra=dict(blade=-5, cape=2))
    if name == "idle_c":  # 발을 고쳐 디디며 검끝이 오른다
        return Pose(**dict(b, foot_near=(38, 0), foot_far=(21, 0)), lean=8, arm_near=(15, -20), arm_far=(145, 110),
                    head_tilt=2, extra=dict(blade=-25, cape=0))
    if name == "windup":  # 검을 뒤로 당겨 찌를 준비
        return Pose(**dict(b, hip=(25, 45), foot_near=(35, 0), foot_far=(16, 0)), lean=4,
                    arm_near=(160, 30), arm_far=(-20, -40), head_tilt=-4, extra=dict(blade=-10, angry=True, cape=2))
    if name == "move":  # 몸을 숙이고 질주, 망토가 크게 휘날린다
        return Pose(**dict(b, hip=(31, 44), foot_near=(42, 2), foot_far=(18, 1)), lean=30,
                    arm_near=(130, 100), arm_far=(30, 60), head_tilt=16, extra=dict(blade=170, angry=True, cape=6))
    if name == "attack":  # 길게 찌른다
        return Pose(**dict(b, hip=(25, 45), foot_near=(37, 0), foot_far=(15, 0)), lean=22,
                    arm_near=(-5, -5), arm_far=(160, 140), head_tilt=10, extra=dict(blade=-5, angry=True, cape=4, reach=12))
    if name == "recover":  # 스킬 급소 찌르기: 낮게 파고들어 깊게 찌른 끝 자세
        return Pose(**dict(b, hip=(25, 47), foot_near=(37, 0), foot_far=(12, 0)), lean=36,
                    arm_near=(10, 5), arm_far=(170, 160), head_tilt=20, extra=dict(blade=5, angry=True, cape=7, reach=12))
    if name == "hit":  # 맞고 휘청, 모자가 젖혀진다
        return Pose(**dict(b, hip=(26, 45), foot_near=(32, 0), foot_far=(18, 1)), lean=-16,
                    arm_near=(-60, -30), arm_far=(-110, -80), head_tilt=-24, extra=dict(blade=-70, eye="shut", cape=-1))
    raise KeyError(name)


def draw_dead(cv):
    """엎어진 산적: 망토가 몸을 덮고, 모자와 검이 따로 떨어졌다."""
    cv.part(chain([(10, 58), (18, 58)], [2.4, 2.2]), BOOT, gloss=False)
    cv.part(poly(cv.blank(), [(14, 59), (18, 53), (32, 52), (36, 59)]), CAPE)
    cv.line4([(20, 55), (31, 54)], CAPE[0])
    cv.part(ellipse(cv.blank(), (39, 56), 3.6, 3.4), BLACK)
    cv.put(poly(cv.blank(), [(40, 55), (42, 55), (42, 56), (40, 56)]), SKIN[1])
    cv.part(poly(cv.blank(), [(46, 55), (52, 54), (53, 56), (45, 57)]), BLACK, gloss=False)
    cv.line([(44, 59), (58, 59)], STEEL[1])
    cv.line([(42, 59), (44, 59)], STRAP)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 3, 9, (34, 40, 50), CAPE[1])
    if name == "recover":
        # 뒤에 남은 연기 잔상(몸 윤곽 흔적) - 몸보다 먼저 그려 뒤에 깔린다
        for p, r in (((10, 38), 4.0), ((14, 46), 4.6), ((8, 50), 3.4), ((16, 32), 2.6)):
            cv.part(ellipse(cv.blank(), p, r, r * 0.9), SMOKE + [SMOKE[2]], gloss=False)
    J = draw_body(cv, LOOK, P)
    tip = P.extra.get("_tip", J["hand_n"])
    if name == "windup":
        sparkle(cv, add(tip, (-1, -3)), WHITE, STEEL[1])
    elif name == "move":
        puff(cv, (14, 57), 2.0, [BOOT[1], BOOT[2]])
    elif name == "attack":
        cv.line4([rnd(add(tip, (-14, -1))), rnd(add(tip, (-4, -1)))], STEEL[2])
        burst(cv, add(tip, (1, 0)), 3.4, STEEL[2], WHITE, spikes=6)
    elif name == "recover":
        # 칼끝 앞 붉은 급소 표식 + 날카로운 섬광
        for k in range(3):
            cv.line4([rnd(add(tip, (-16 + k * 2, -3 + k * 3))), rnd(add(tip, (-6, -3 + k * 3)))], SMOKE[2])
        burst(cv, add(tip, (1, 0)), 4.0, CAPE[2], WHITE, spikes=8, rot=10)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((6, -8), (9, -5), (8, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bandit-mask", draw, sys.argv[1:], idle_ms=170)
