#!/usr/bin/env python3
"""물접시 갓파(kappa-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

구부정한 작은 물요괴: 연두 피부에 등의 둥근 갈색 거북 등딱지(육각 무늬), 배의 노란 판, 정수리의 물 담긴 흰 접시
(둘레에 삐죽한 초록 머리카락), 노란 오리 부리 주둥이, 머리 안의 둥근 눈, 물갈퀴 손발, 짧은 다리.
6번 칸(스킬 물대포): 몸을 숙여 부리로 아군 쪽에 물줄기를 세차게 뿜는다(접시 물도 출렁).

  python3 scripts/content/monsters/redraw_kappa_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle

INK = (16, 30, 18)
SKIN = [(60, 120, 50), (92, 160, 70), (130, 196, 96), (170, 220, 130)]
SKIN_FAR = [(44, 92, 38), (60, 120, 50), (72, 136, 58), (72, 136, 58)]
SHELL = [(90, 60, 30), (130, 92, 50), (166, 124, 74), (190, 154, 104)]
BELLY = [(190, 170, 70), (224, 206, 110), (244, 232, 160), (244, 232, 160)]
BEAK = [(200, 150, 30), (240, 190, 60), (255, 220, 120), (255, 220, 120)]
PLATE = [(190, 196, 200), (226, 230, 232), (246, 248, 250), (255, 255, 255)]
WATER = [(60, 140, 210), (120, 190, 240), (220, 245, 255)]
HAIR = (40, 90, 40)
EYE = (16, 14, 12)
EYE_HI = (255, 255, 255)
WHITE = (255, 255, 255)
G = 60


def webbed(cv, p, ang, ramp):
    pts = [p, polar(p, ang - 35, 3.4), polar(p, ang, 3.8), polar(p, ang + 35, 3.4)]
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee, add(foot, (0, -1))], [3.6, 3.0, 2.6]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 1), (f[0] + 5, f[1] - 2), (f[0] + 5, f[1]), (f[0] - 2, f[1])]), ramp, ink=INK, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 등딱지(뒤로 둥글게 불룩)
    shell = [R(-2, 2), R(-8, -2), R(-10, -8), R(-8, -14), R(-2, -16), R(2, -12), R(2, -2)]
    cv.part(poly(cv.blank(), shell), SHELL, ink=INK)
    for p in ((-6, -6), (-6, -11), (-3, -9)):
        c = R(*p)
        cv.line4([rnd(add(c, (-1, -1))), rnd(add(c, (1, -1))), rnd(add(c, (1, 1))), rnd(add(c, (-1, 1)))], SHELL[0])
    # 몸 + 배 판
    body = [R(-2, 2), R(5, 2), R(6, -6), R(4, -13), R(-1, -14), R(-2, -6)]
    cv.part(poly(cv.blank(), body), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [R(1, 1), R(5, 1), R(5, -6), R(3, -12), R(1, -10)]), BELLY, ink=INK, gloss=False)
    for dy in (-3, -7):
        cv.line4([rnd(R(1, dy)), rnd(R(5, dy))], BELLY[0])


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el, hand], [2.8, 2.4, 2.2]), ramp, ink=INK, gloss=False)
    webbed(cv, hand, math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0])), ramp)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 삐죽 머리카락 둘레
    for dx in (-5, -2, 2, 5):
        cv.line4([rnd(R(dx, -4)), rnd(R(dx * 1.3, -8))], HAIR)
    cv.part(ellipse(cv.blank(), c, 5.5, 5), SKIN, ink=INK)
    # 부리(아래 부리 벌림)
    if jaw:
        cv.part(poly(cv.blank(), [R(3, 2), R(10, 2 + jaw), R(9, 4 + jaw), R(3, 4)]), BEAK, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(3, -1), R(10, 0), R(11, 2), R(4, 2.5)]), BEAK, ink=INK, gloss=False)
    # 정수리 접시 + 물
    tilt_w = P.extra.get("slosh", 0)
    cv.part(ellipse(cv.blank(), R(0, -5), 4.6, 1.6), PLATE, ink=INK, gloss=False)
    cv.line4([rnd(R(-3, -5.5 - tilt_w * 0.3)), rnd(R(3, -5.5 + tilt_w * 0.3))], WATER[1])
    e = rnd(R(2, -1))
    if P.extra.get("eye") == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), WHITE)
        cv.put(poly(cv.blank(), [add(e, (0, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (0, 1))]), EYE)
    return dict(eye=e, mouth=R(10, 2), plate=R(0, -6))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.0, lower=5.5, thigh=6.0, shin=6.0, hip_w=4, shoulder_w=4)


def pose(name):
    b = dict(hip=(28, 47), torso=12.0, neck=1.0, foot_near=(34, 0), foot_far=(23, 0))
    if name == "idle_a":
        return Pose(**b, lean=20, head_tilt=-6, arm_near=(70, 50), arm_far=(100, 70))
    if name == "idle_b":
        return Pose(**dict(b, hip=(28, 48)), lean=24, head_tilt=-2, arm_near=(80, 60), arm_far=(110, 80), extra=dict(slosh=2, jaw=1))
    if name == "idle_c":
        return Pose(**b, lean=16, head_tilt=-10, arm_near=(60, 30), arm_far=(95, 60), extra=dict(slosh=-2))
    if name == "windup":
        return Pose(**dict(b, foot_near=(33, 0), foot_far=(19, 0)), lean=-4, head_tilt=-20, arm_near=(-120, -90), arm_far=(-140, -110),
                    extra=dict(jaw=2, slosh=3))
    if name == "move":
        return Pose(**dict(b, hip=(31, 46), foot_near=(40, 3), foot_far=(21, 0)), lean=34, head_tilt=4, arm_near=(150, 140), arm_far=(20, 40),
                    extra=dict(slosh=4))
    if name == "attack":
        return Pose(**dict(b, foot_near=(37, 0), foot_far=(19, 0)), lean=30, head_tilt=4, arm_near=(-10, 0), arm_far=(120, 100), extra=dict(jaw=3))
    if name == "recover":
        return Pose(**dict(b, hip=(25, 47), foot_near=(32, 0), foot_far=(18, 0)), lean=36, head_tilt=0, arm_near=(110, 120), arm_far=(130, 140),
                    extra=dict(jaw=4, slosh=-4))
    if name == "hit":
        return Pose(**dict(b, hip=(25, 47), foot_near=(31, 0), foot_far=(20, 1)), lean=-14, head_tilt=-30, arm_near=(-60, -40), arm_far=(-130, -150),
                    extra=dict(eye="shut", slosh=5))
    raise KeyError(name)


def draw_dead(cv):
    cv.part(ellipse(cv.blank(), (26, 54), 10, 5), SHELL, ink=INK)
    cv.part(chain([(14, 57), (20, 57)], [3, 3]), SKIN_FAR, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (41, 54), 5, 4.5), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [(45, 54), (51, 55), (50, 57), (45, 57)]), BEAK, ink=INK, gloss=False)
    cv.line([(40, 52), (42, 54)], EYE)
    cv.line([(42, 52), (40, 54)], EYE)
    cv.part(ellipse(cv.blank(), (37, 50), 3.5, 1.4), PLATE, ink=INK, gloss=False)
    cv.put(ellipse(cv.blank(), (32, 59), 5, 0.7), WATER[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    m = J["mouth"]
    if name == "windup":
        for p in ((-2, -4), (3, -5)):
            cv.pixel(*rnd(add(J["plate"], p)), WATER[1])
        sparkle(cv, add(J["plate"], (5, -4)), WHITE, WATER[1])
    elif name == "move":
        puff(cv, (14, 57), 2.2, [WATER[0], WATER[1]])
    elif name == "attack":
        burst(cv, add(J["hand_n"], (3, 0)), 4.0, WATER[1], WHITE, spikes=6)
    elif name == "recover":
        jet = bezier(add(m, (1, 0)), add(m, (10, -1)), (61, m[1] + 6), 8)
        cv.part(chain(jet, [2.4, 2.8, 3.2, 3.6, 3.8, 4.0, 4.0, 4.2, 4.2]), WATER, ink=(20, 60, 110), gloss=False)
        cv.line(jet[1:7], WATER[2])
        for p in ((52, m[1] - 6), (58, m[1] - 3), (56, m[1] + 12)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.2), WATER[1])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((4, -8), (7, -6), (6, -11)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
        cv.pixel(*rnd(add(J["plate"], (-6, -3))), WATER[1])
    return cv.image()


if __name__ == "__main__":
    run("kappa-01", draw, sys.argv[1:], idle_ms=220)
