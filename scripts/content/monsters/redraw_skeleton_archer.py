#!/usr/bin/env python3
"""해골 궁수(skeleton-archer) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

상아색 뼈: 둥근 두개골(검은 눈구멍 속 푸른 불씨), 갈비뼈 우리, 골반, 가는 팔다리 뼈와 관절 혹.
낡은 갈색 두건 망토 조각을 어깨에 두르고, 등에 화살통, 먼 손에 나무 활(앞=오른쪽).
6번 칸(스킬 skill_mon_arrow_volley / bone_curse): 활을 하늘로 들어 푸른 저주 불이 붙은 화살 셋을 쏜다.

  python3 scripts/content/monsters/redraw_skeleton_archer.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle, speed_lines

INK = (30, 24, 22)
BONE = [(150, 138, 110), (200, 190, 160), (232, 224, 196), (250, 246, 228)]
BONE_FAR = [(110, 100, 80), (150, 138, 110), (176, 164, 136), (176, 164, 136)]
CLOAK = [(56, 40, 32), (88, 64, 46), (118, 90, 62), (140, 110, 78)]
WOOD = [(90, 56, 30), (136, 88, 46), (176, 124, 70), (200, 150, 90)]
STRING = (220, 220, 200)
SOUL, SOUL_HI = (70, 200, 255), (210, 250, 255)
CURSE = [(40, 80, 160), (70, 160, 240), (190, 240, 255)]
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    ramp = BONE_FAR if far else BONE
    cv.part(chain([hip, knee], [2.2, 2.0]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -1))], [2.0, 1.8]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), knee, 1.2, 1.2), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 1, f[1] - 2), (f[0] + 3, f[1] - 1), (f[0] + 3, f[1]), (f[0] - 1, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 골반
    cv.part(poly(cv.blank(), [add(hip, (-4, -1)), add(hip, (4, -1)), add(hip, (3, 2)), add(hip, (-3, 2))]), BONE, gloss=False)
    # 등뼈
    cv.part(chain([hip, chest], [2.0, 2.0]), BONE_FAR, gloss=False)
    # 갈비뼈 우리: 등뼈에서 앞으로 휘는 갈비 넷
    a = math.radians(lean)
    for i in range(4):
        t = 0.4 + i * 0.17
        s = lerp(hip, chest, t)
        cv.line4([rnd(s), rnd(add(s, (4 * math.cos(a) + 1, 1))), rnd(add(s, (5 * math.cos(a), 3 - i * 0.3)))], BONE[2] if i % 2 == 0 else BONE[1])
    # 어깨에 걸친 망토 조각
    cv.part(poly(cv.blank(), [add(chest, (-5, -2)), add(chest, (2, -3)), add(chest, (0, 2)), add(chest, (-5, 5)), add(chest, (-6, 2))]), CLOAK)
    # 등의 화살통 + 깃
    q0, q1 = add(chest, (-5, -4)), add(chest, (-7, 6))
    cv.part(chain([q0, q1], [2.4, 2.4]), WOOD)
    for dx in (0, 2):
        cv.pixel(*rnd(add(q0, (dx - 1, -2))), (220, 60, 50))


def bow(cv, hand, ang, draw_back=0.0, far=True):
    """활: 손잡이 hand 에서 ang 방향 직각으로 위아래 팔이 휜다. draw_back = 시위를 당긴 깊이."""
    up = polar(hand, ang - 90, 9)
    dn = polar(hand, ang + 90, 9)
    cu = polar(polar(hand, ang - 90, 5), ang, 3)
    cd = polar(polar(hand, ang + 90, 5), ang, 3)
    cv.part(chain([up, cu, hand, cd, dn], [1.4, 2.0, 2.4, 2.0, 1.4]), WOOD, gloss=False)
    nock = polar(hand, ang + 180, 1 + draw_back)
    cv.line4([rnd(up), rnd(nock), rnd(dn)], STRING)
    return nock


def arm(cv, sh, el, hand, far, P):
    ramp = BONE_FAR if far else BONE
    cv.part(chain([sh, el], [2.0, 1.8]), ramp, gloss=False)
    cv.part(chain([el, hand], [1.8, 1.6]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.2, 1.2), ramp, gloss=False)
    if far:
        P.extra["nock"] = bow(cv, hand, P.extra.get("bow", 0), P.extra.get("draw", 0))


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw_open = P.extra.get("jaw", 0)
    cv.part(poly(cv.blank(), [r(-1, 2), r(5, 2 + jaw_open * 0.4), r(5, 4 + jaw_open), r(0, 4 + jaw_open * 0.5)]), BONE, gloss=False)
    cv.part(ellipse(cv.blank(), r(1, -2), 5.0, 4.6), BONE)
    cv.part(poly(cv.blank(), [r(2, 0), r(6, 0), r(6, 3), r(2, 3)]), BONE, gloss=False)  # 위턱
    # 두건(뒤통수를 덮는 낡은 천)
    cv.part(poly(cv.blank(), [r(-5, -3), r(-1, -7), r(3, -7), r(-2, -4), r(-4, 3), r(-6, 2)]), CLOAK, gloss=False)
    # 눈구멍 + 불씨
    e = rnd(r(3, -2))
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), INK)
    if P.extra.get("eye") != "out":
        cv.pixel(e[0], e[1], SOUL)
        cv.pixel(e[0] + 1, e[1] - 1, SOUL_HI)
    cv.pixel(*rnd(r(6, 1)), INK)  # 콧구멍
    for dx in (3, 5):
        cv.pixel(*rnd(r(dx, 3)), INK)  # 이빨 틈
    return dict(eye=r(3, -2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=6.5, thigh=8.0, shin=8.5, shoulder_w=3)


def pose(name):
    base = dict(hip=(26, 42), foot_near=(32, 0), foot_far=(20, 0))
    if name == "idle_a":
        return Pose(**base, lean=4, arm_near=(110, 80), arm_far=(30, 10), head_tilt=0, extra=dict(bow=0))
    if name == "idle_b":  # 몸이 덜그럭 내려앉고 턱이 벌어진다
        return Pose(**dict(base, hip=(26, 43)), lean=8, arm_near=(115, 90), arm_far=(36, 18), head_tilt=6, extra=dict(bow=4, jaw=2))
    if name == "idle_c":  # 화살통에서 화살을 집으려 손을 뒤로
        return Pose(**base, lean=0, arm_near=(-140, -110), arm_far=(26, 6), head_tilt=-4, extra=dict(bow=-4))
    if name == "windup":  # 시위를 귀까지 당긴다
        return Pose(**dict(base, hip=(24, 42), foot_near=(31, 0), foot_far=(16, 0)), lean=-4,
                    arm_near=(-170, 10), arm_far=(-10, -10), head_tilt=-2, extra=dict(bow=-8, draw=6, aim=True))
    if name == "move":  # 몸을 낮추고 옆걸음으로 거리를 잡는다
        return Pose(**dict(base, hip=(30, 44), foot_near=(39, 0), foot_far=(20, 0)), lean=14,
                    arm_near=(150, 110), arm_far=(10, 0), head_tilt=8, extra=dict(bow=6))
    if name == "attack":  # 놓았다: 시위가 튕기고 화살이 날아간다
        return Pose(**dict(base, hip=(25, 42), foot_near=(32, 0), foot_far=(17, 0)), lean=-8,
                    arm_near=(-160, -150), arm_far=(-6, -6), head_tilt=-4, extra=dict(bow=-6, draw=0, shot=True, jaw=2))
    if name == "recover":  # 스킬 화살비: 활을 하늘로 높이 겨눈다
        return Pose(**dict(base, hip=(24, 42), foot_near=(32, 0), foot_far=(16, 0)), lean=-14,
                    arm_near=(-150, -20), arm_far=(-50, -50), head_tilt=-24, extra=dict(bow=-50, draw=5, jaw=3))
    if name == "hit":  # 맞아서 뼈가 흩어질 듯 뒤로 꺾인다
        return Pose(**dict(base, hip=(23, 43), foot_near=(31, 0), foot_far=(17, 2)), lean=-24,
                    arm_near=(-30, 20), arm_far=(60, 90), head_tilt=-30, extra=dict(bow=40, jaw=4, eye="out"))
    raise KeyError(name)


def arrow(cv, tail, head_p, fire=False):
    cv.line4([rnd(tail), rnd(head_p)], WOOD[2] if not fire else CURSE[1])
    a = math.degrees(math.atan2(head_p[1] - tail[1], head_p[0] - tail[0]))
    tip = polar(head_p, a, 2)
    cv.put(poly(cv.blank(), [rnd(polar(head_p, a + 90, 1.4)), rnd(tip), rnd(polar(head_p, a - 90, 1.4))]), (200, 210, 220) if not fire else CURSE[2])
    for k in (-140, 140):
        cv.line([rnd(tail), rnd(polar(tail, a + k, 2.4))], (220, 60, 50) if not fire else CURSE[0])


def draw_dead(cv):
    """무너진 뼈 무더기: 두개골이 굴러가고 활이 부러졌다."""
    for a, b in (((12, 58), (24, 57)), ((20, 59), (30, 56)), ((26, 58), (36, 59)), ((14, 55), (22, 58))):
        cv.part(chain([a, b], [2.0, 2.0]), BONE, gloss=False)
    cv.part(poly(cv.blank(), [(22, 52), (34, 51), (36, 56), (22, 57)]), CLOAK)
    for x in (25, 28, 31):
        cv.line([(x, 52), (x + 1, 55)], BONE[2])
    cv.part(ellipse(cv.blank(), (44, 55), 4.5, 4.0), BONE)
    cv.put(poly(cv.blank(), [(44, 53), (46, 53), (46, 55), (44, 55)]), INK)
    cv.part(chain([(50, 59), (54, 54), (57, 50)], [1.6, 2.2, 1.4]), WOOD, gloss=False)
    cv.part(chain([(6, 59), (9, 55)], [1.6, 1.4]), WOOD, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    nock = P.extra.get("nock")
    if name == "windup" and nock:
        arrow(cv, add(nock, (-1, 0)), add(J["hand_f"], (4, 0)))
        cv.pixel(*rnd(add(J["hand_f"], (5, -1))), SOUL_HI)
    elif name == "attack":
        speed_lines(cv, 46, 56, (rnd(J["hand_f"])[1] - 2, rnd(J["hand_f"])[1] + 2), BONE[2])
        arrow(cv, (55, J["hand_f"][1]), (60, J["hand_f"][1]))
        sparkle(cv, add(J["hand_f"], (3, -1)), WHITE, BONE[2])
    elif name == "recover":
        h = J["hand_f"]
        for k, (dx, dy) in enumerate(((6, -10), (10, -6), (2, -13))):
            t = add(h, (dx - 6, dy + 6))
            arrow(cv, t, add(t, (6, -6)), fire=True)
        burst(cv, add(h, (3, -3)), 3.5, CURSE[1], CURSE[2], spikes=6)
        sparkle(cv, add(h, (14, -16)), CURSE[2], CURSE[1], big=True)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((-7, -6), (-9, -3), (-8, -9)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("skeleton-archer", draw, sys.argv[1:], idle_ms=200)
