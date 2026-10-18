#!/usr/bin/env python3
"""고블린 정찰병(goblin-scout) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

작고 마른 초록 고블린: 큰 머리에 뒤로 뾰족 뻗은 긴 귀, 매부리 코, 노란 눈과 송곳니,
누더기 가죽 조끼와 허리띠, 짧은 갈색 반바지, 맨발. 가까운 손에 녹슨 단검, 등에 작은 자루.
몸을 낮게 웅크리고 무릎을 굽힌 채 까딱거린다. 3단 음영 + 1px 짙은 외곽선.
6번 칸(스킬 skill_mon_dagger_throw): 몸을 비틀며 단검 셋을 아군 쪽으로 부채꼴로 던진다.

  python3 scripts/content/monsters/redraw_goblin_scout.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (22, 28, 18)
SKIN = [(62, 110, 44), (98, 150, 60), (138, 186, 82), (176, 214, 118)]
SKIN_FAR = [(46, 84, 34), (62, 110, 44), (80, 128, 52), (80, 128, 52)]
VEST = [(70, 44, 30), (108, 70, 44), (142, 98, 62), (170, 126, 84)]
PANTS = [(60, 50, 40), (92, 76, 58), (120, 100, 76), (120, 100, 76)]
BELT = (40, 30, 24)
BUCKLE = (210, 176, 70)
STEEL = [(110, 116, 126), (176, 184, 194), (236, 240, 246)]
RUST = (150, 80, 44)
HILT = (90, 56, 34)
EYE, EYE_HI = (250, 214, 50), (255, 255, 210)
TOOTH = (246, 240, 214)
SACK = [(110, 90, 60), (150, 124, 84), (184, 158, 110), (184, 158, 110)]
WHITE = (255, 255, 240)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    pr = [PANTS[0], PANTS[0], PANTS[1], PANTS[1]] if far else PANTS
    cv.part(chain([hip, lerp(hip, knee, 0.85)], [3.8, 3.4]), pr, gloss=False)
    cv.part(chain([lerp(hip, knee, 0.8), knee, add(foot, (0, -1))], [2.8, 2.6, 2.2]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 1, f[1] - 2), (f[0] + 3, f[1] - 1), (f[0] + 4, f[1]), (f[0] - 1, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 등의 자루(뒤쪽 = 왼쪽)
    cv.part(ellipse(cv.blank(), add(lerp(hip, chest, 0.6), (-5, 0)), 3.2, 3.8), SACK)
    pts = [add(hip, (-4, 1)), add(hip, (4, 1)), add(chest, (4, 1)), add(chest, (3, -2)), add(chest, (-3, -2)), add(chest, (-5, 1))]
    cv.part(poly(cv.blank(), pts), VEST)
    # 조끼 앞섶 사이 맨살
    a = lerp(hip, chest, 0.35)
    cv.put(poly(cv.blank(), [add(chest, (1, 0)), add(chest, (3, 0)), add(a, (3, 0)), add(a, (2, 0))]), SKIN[1])
    # 허리띠 + 버클
    cv.line([rnd(add(hip, (-4, -1))), rnd(add(hip, (4, -1)))], BELT)
    cv.pixel(*rnd(add(hip, (2, -1))), BUCKLE)


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [2.8, 2.4]), ramp, gloss=False)
    cv.part(chain([el, hand], [2.4, 2.4]), ramp, gloss=False)
    if not far and P.extra.get("dagger", True):
        # 녹슨 단검: 손에서 팔 방향(또는 지정 각)으로
        ang = P.extra.get("blade", math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0])))
        g = polar(hand, ang, 1.5)
        tip = polar(hand, ang, 8)
        cv.line4([rnd(polar(hand, ang + 180, 1.5)), rnd(hand)], HILT)
        cv.line([rnd(polar(g, ang + 90, 1.5)), rnd(polar(g, ang - 90, 1.5))], BELT)
        cv.line4([rnd(g), rnd(tip)], STEEL[1])
        cv.line([rnd(polar(g, ang - 90, 0.8)), rnd(polar(tip, ang + 180, 1))], STEEL[2])
        cv.pixel(*rnd(lerp(g, tip, 0.45)), RUST)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    ear = P.extra.get("ear", 0)
    # 뒤로 길게 뻗은 귀(먼 귀 → 머리 → 가까운 귀)
    cv.part(poly(cv.blank(), [r(-3, -3), r(-12, -7 - ear), r(-3, 0)]), SKIN_FAR, gloss=False)
    cv.part(ellipse(cv.blank(), r(0, -1), 5.4, 5.0), SKIN)
    # 매부리 코 + 턱
    cv.part(poly(cv.blank(), [r(4, -2), r(8, 1), r(5, 2)]), SKIN, gloss=False)
    cv.part(poly(cv.blank(), [r(-1, -1), r(-10, -5 - ear), r(-9, -3 - ear), r(-1, 2)]), SKIN, gloss=False)
    cv.pixel(*rnd(r(-6, -2 - ear * 0.5)), SKIN[0])
    # 눈썹 + 눈
    if P.extra.get("eye") == "shut":
        cv.line([rnd(r(1, -2)), rnd(r(4, -2))], INK)
    else:
        e = rnd(r(2, -2))
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE)
        cv.pixel(e[0] + 1, e[1] - 1 if P.extra.get("angry") else e[1], EYE_HI if not P.extra.get("angry") else INK)
        cv.line([rnd(r(1, -4)), rnd(r(4, -3 if P.extra.get("angry") else -4))], INK)
    # 입 + 송곳니
    mouth = P.extra.get("mouth", 0)
    m = rnd(r(3, 3))
    if mouth:
        cv.put(poly(cv.blank(), [r(1, 2), r(5, 2), r(4, 2 + mouth), r(2, 2 + mouth)]), INK)
        cv.pixel(*rnd(r(2, 2)), TOOTH)
        cv.pixel(*rnd(r(4, 2)), TOOTH)
    else:
        cv.line([rnd(r(1, 3)), rnd(r(4, 3))], INK)
        cv.pixel(*rnd(r(3, 2)), TOOTH)
    # 머리 위 빛
    cv.pixel(*rnd(r(-1, -5)), SKIN[3])
    return dict(eye=r(2, -2), mouth=m)


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.0, lower=6.0, thigh=7.0, shin=7.5, shoulder_w=4.0)


def pose(name):
    b = dict(hip=(28, 46), torso=10.0, foot_near=(35, 0), foot_far=(21, 0))
    if name == "idle_a":
        return Pose(**b, lean=18, arm_near=(40, -10), arm_far=(100, 70), head_tilt=6, extra=dict(blade=-30))
    if name == "idle_b":
        return Pose(**dict(b, hip=(28, 47)), lean=24, arm_near=(50, 0), arm_far=(110, 80), head_tilt=12,
                    extra=dict(blade=-20, ear=2, mouth=2))
    if name == "idle_c":
        return Pose(**dict(b, hip=(29, 46), foot_near=(37, 1)), lean=14, arm_near=(30, -20), arm_far=(90, 60), head_tilt=0,
                    extra=dict(blade=-45, ear=-1))
    if name == "windup":  # 단검을 뒤로 젖혀 든다
        return Pose(**dict(b, hip=(25, 46), foot_near=(33, 0), foot_far=(17, 0)), lean=4,
                    arm_near=(-120, -150), arm_far=(30, 10), head_tilt=-6, extra=dict(blade=-160, angry=True, mouth=2, ear=3))
    if name == "move":  # 낮게 몸을 숙이고 질주
        return Pose(**dict(b, hip=(33, 45), foot_near=(44, 2), foot_far=(20, 1)), lean=40,
                    arm_near=(160, 120), arm_far=(30, 60), head_tilt=20, extra=dict(blade=170, angry=True, ear=4))
    if name == "attack":  # 단검을 앞으로 찌른다
        return Pose(**dict(b, hip=(33, 46), foot_near=(44, 0), foot_far=(22, 0)), lean=30,
                    arm_near=(0, -5), arm_far=(150, 120), head_tilt=16, extra=dict(blade=-5, angry=True, mouth=3, ear=4))
    if name == "recover":  # 스킬: 던지기 직후 팔이 앞으로 뻗어 있다(손엔 단검 없음)
        return Pose(**dict(b, hip=(30, 46), foot_near=(40, 0), foot_far=(19, 0)), lean=24,
                    arm_near=(-25, -10), arm_far=(160, 140), head_tilt=10,
                    extra=dict(dagger=False, angry=True, mouth=3, ear=4))
    if name == "hit":
        return Pose(**dict(b, hip=(25, 47), foot_near=(32, 0), foot_far=(18, 2)), lean=-18,
                    arm_near=(-50, -30), arm_far=(-80, -60), head_tilt=-25, extra=dict(blade=-60, eye="shut", mouth=3, ear=-3))
    raise KeyError(name)


def draw_dead(cv):
    """엎어져 쓰러진 고블린: 머리는 오른쪽, 늘어진 귀, 떨어진 단검."""
    cv.part(chain([(14, 57), (21, 58)], [2.4, 2.4]), SKIN_FAR, gloss=False)
    cv.part(ellipse(cv.blank(), (18, 54), 3.2, 3.4), SACK)
    cv.part(poly(cv.blank(), [(18, 59), (22, 54), (34, 53), (37, 59)]), VEST)
    cv.part(chain([(20, 59), (14, 59)], [3.0, 2.6]), PANTS, gloss=False)
    cv.part(ellipse(cv.blank(), (41, 55), 4.8, 4.2), SKIN)
    cv.part(poly(cv.blank(), [(38, 53), (32, 49), (34, 52)]), SKIN, gloss=False)
    cv.line([(41, 54), (43, 54)], INK)
    cv.pixel(45, 57, TOOTH)
    cv.line([(48, 59), (55, 58)], STEEL[1])
    cv.line4([(46, 59), (48, 59)], HILT)
    cv.pixel(52, 58, RUST)


def thrown_dagger(cv, p, ang):
    tip = polar(p, ang, 4)
    tail = polar(p, ang + 180, 3)
    cv.line([rnd(p), rnd(tip)], STEEL[2])
    cv.line4([rnd(tail), rnd(p)], HILT)
    cv.line([rnd(polar(tail, ang + 180, 4)), rnd(polar(tail, ang + 180, 1))], STEEL[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    h = J["hand_n"]
    if name == "windup":
        sparkle(cv, add(h, (-3, -6)), STEEL[2], STEEL[1])
    elif name == "move":
        speed_lines(cv, 3, 11, (34, 42, 50), SKIN[1])
        puff(cv, (14, 57), 2.0, [PANTS[1], PANTS[2]])
    elif name == "attack":
        tip = polar(h, -5, 8)
        slash(cv, add(tip, (-6, -6)), add(tip, (4, 4)), 2, 2.4, STEEL[1], WHITE)
        burst(cv, add(tip, (2, 0)), 3.5, STEEL[2], WHITE, spikes=6)
    elif name == "recover":
        # 아군 쪽으로 부채꼴로 날아가는 단검 셋
        for k, ang in enumerate((-18, -4, 10)):
            p = polar(h, ang, 12 + k * 3)
            thrown_dagger(cv, p, ang)
        sparkle(cv, add(h, (16, -10)), WHITE, STEEL[1])
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((6, -8), (8, -5), (9, -10)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("goblin-scout", draw, sys.argv[1:], idle_ms=170)
