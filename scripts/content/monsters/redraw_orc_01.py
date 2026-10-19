#!/usr/bin/env python3
"""갈색 오크(orc-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

키 크고 등이 약간 굽은 갈색 피부 오크: 각진 턱에서 위로 솟은 두 엄니, 얼굴을 가로지르는 붉은 흉터,
뒤로 묶은 검은 상투 머리, 어깨를 덮은 털가죽 망토(털 끝이 삐죽), 가슴을 X 자로 가로지르는 가죽 띠,
붉은 치마와 정강이 감개, 가까운 손에 쇠테 두른 무거운 곤봉. 고블린 장사보다 키·팔이 길고 머리가 크다.
6번 칸(스킬 전투 함성): 곤봉을 치켜들고 가슴을 젖혀 포효해 붉은 기합 고리와 함께 몸에 붉은 기운이 오른다.

  python3 scripts/content/monsters/redraw_orc_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, lerp, polar, poly, puff, ring, rnd, run, sparkle

INK = (24, 16, 10)
SKIN = [(96, 62, 38), (136, 92, 58), (172, 124, 80), (200, 156, 108)]
SKIN_FAR = [(72, 46, 28), (96, 62, 38), (114, 76, 46), (114, 76, 46)]
FUR = [(84, 70, 56), (124, 108, 88), (164, 150, 126), (196, 184, 160)]
STRAP = [(52, 34, 22), (78, 52, 34), (100, 70, 46), (100, 70, 46)]
SKIRT = [(110, 28, 24), (150, 44, 36), (184, 70, 54), (184, 70, 54)]
WRAP = [(150, 136, 110), (190, 176, 148), (214, 202, 176), (214, 202, 176)]
WOOD = [(52, 34, 22), (78, 52, 34), (100, 70, 46), (124, 108, 88)]
IRON = [(70, 74, 84), (120, 126, 138), (170, 176, 188), (210, 216, 226)]
HAIR = (20, 16, 14)
TUSK = (244, 236, 206)
SCAR = (190, 50, 44)
EYE, EYE_HI = (190, 50, 44), (255, 200, 170)
RAGE = [(110, 28, 24), (190, 50, 44), (255, 200, 170)]
DUST = [(84, 70, 56), (124, 108, 88)]
WHITE = (244, 236, 206)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee], [5.0, 4.2]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, add(foot, (0, -2))], [4.0, 3.6]), WRAP if not far else [c for c in SKIN_FAR], ink=INK, gloss=False)
    if not far:
        for t in (0.3, 0.6):
            cv.pixel(*rnd(lerp(knee, foot, t)), WRAP[0])
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 3, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 3, f[1])]), ramp, ink=INK, gloss=False)


def torso(cv, hip, chest, lean, P):
    body = [add(hip, (-5, 1)), add(hip, (5, 1)), add(chest, (7, 3)), add(chest, (5, -4)), add(chest, (-5, -4)), add(chest, (-7, 2))]
    M = cv.part(poly(cv.blank(), body), SKIN, ink=INK)
    cv.shade_side(M, SKIN[0], side=-1, depth=2)
    # X 가죽 띠
    cv.line([add(chest, (-5, -2)), add(hip, (5, -1))], STRAP[1], width=2)
    cv.line([add(chest, (5, -2)), add(hip, (-4, -1))], STRAP[0], width=1)
    cv.pixel(*rnd(lerp(chest, hip, 0.5)), IRON[2])
    # 치마
    sk = [add(hip, (-6, -1)), add(hip, (6, -1)), add(hip, (7, 7)), add(hip, (3, 5)), add(hip, (0, 8)), add(hip, (-3, 5)), add(hip, (-6, 7))]
    cv.part(poly(cv.blank(), sk), SKIRT, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [add(hip, (-6, -3)), add(hip, (6, -3)), add(hip, (6, 0)), add(hip, (-6, 0))]), STRAP, ink=INK, gloss=False)
    # 어깨 털가죽 망토(등 뒤로 삐죽 털 끝)
    fur = [add(chest, (-8, 4)), add(chest, (-9, 0)), add(chest, (-6, -5)), add(chest, (0, -6)), add(chest, (6, -4)),
           add(chest, (6, 0)), add(chest, (2, 1)), add(chest, (-3, 2)), add(chest, (-6, 7)), add(chest, (-7, 3)), add(chest, (-10, 8))]
    cv.part(poly(cv.blank(), fur), FUR, ink=INK)


def club(cv, hand, ang):
    tip = polar(hand, ang, 16)
    butt = polar(hand, ang + 180, 3)
    cv.part(chain([butt, hand, tip], [2.6, 3.4, 5.6]), WOOD, ink=INK, gloss=False)
    for t in (0.6, 0.9):
        p = lerp(hand, tip, t)
        cv.part(chain([polar(p, ang + 90, 3), polar(p, ang - 90, 3)], [2, 2]), IRON, ink=INK, gloss=False)
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [5.0, 4.0]), ramp, ink=INK, gloss=False)
    cv.part(chain([el, hand], [4.0, 3.6]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.6, 2.4), ramp, ink=INK, gloss=False)
    if not far:
        P.extra["tip"] = club(cv, hand, P.extra.get("club", -60))
        cv.part(ellipse(cv.blank(), lerp(el, hand, 0.5), 2.2, 2.2), STRAP, ink=INK, gloss=False)  # 팔찌


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 뒤로 묶은 상투
    cv.part(chain([R(-4, -5), R(-8, -6), R(-10, -3)], [3.2, 2.6, 2.0]), [HAIR] * 4, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-3, 2), R(9, 2 + jaw * 0.4), R(9, 6 + jaw), R(-1, 6)]), SKIN, ink=INK, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(2, 2), R(8, 2), R(8, 2 + jaw), R(2, 3)]), (90, 18, 22))
    for dx in (4, 8):
        t0 = R(dx, 2.5 + jaw * 0.4 * dx / 9)
        cv.part(poly(cv.blank(), [t0, add(t0, (1.2, 0)), add(t0, (0.4, -4))]), [TUSK] * 4, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-5, 2), R(-5, -4), R(-1, -7), R(5, -6), R(8, -3), R(9, 2), R(2, 3)]), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [R(-5, -2), R(-5, -5), R(-1, -8), R(5, -7), R(2, -5)]), [HAIR] * 4, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-3, -2), R(-6, -3), R(-4, 1)]), SKIN, ink=INK, gloss=False)  # 귀
    cv.line4([rnd(R(1, -3)), rnd(R(7, -3))], SKIN[0])
    e = rnd(R(5, -2))
    if P.extra.get("eye") == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE_HI)
    cv.line4([rnd(R(3, -5)), rnd(R(7, 1))], SCAR)
    cv.pixel(*rnd(R(9, 0)), INK)
    return dict(eye=R(5, -2), mouth=R(9, 3))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=8.0, lower=7.5, thigh=8.5, shin=8.5, shoulder_w=5, hip_w=5)


def pose(name):
    if name == "idle_a":
        return Pose(hip=(27, 41), lean=10, torso=13, arm_near=(70, 30), arm_far=(100, 70), foot_near=(34, 0), foot_far=(20, 0),
                    head_tilt=4, extra=dict(club=-70))
    if name == "idle_b":
        return Pose(hip=(27, 42), lean=12, torso=13, arm_near=(75, 40), arm_far=(105, 80), foot_near=(34, 0), foot_far=(20, 0),
                    head_tilt=8, extra=dict(club=-60, jaw=2))
    if name == "idle_c":  # 곤봉을 손바닥에 툭툭
        return Pose(hip=(27, 41), lean=8, torso=13, arm_near=(60, -10), arm_far=(80, 0), foot_near=(35, 0), foot_far=(19, 0),
                    head_tilt=0, extra=dict(club=-100, jaw=1))
    if name == "windup":
        return Pose(hip=(25, 41), lean=-8, torso=13, arm_near=(-110, -140), arm_far=(40, 10), foot_near=(33, 0), foot_far=(17, 0),
                    head_tilt=-6, extra=dict(club=-150, jaw=3))
    if name == "move":
        return Pose(hip=(31, 41), lean=22, torso=13, arm_near=(150, 110), arm_far=(20, 50), foot_near=(42, 2), foot_far=(20, 0),
                    head_tilt=10, extra=dict(club=170, jaw=2))
    if name == "attack":
        return Pose(hip=(26, 41), lean=22, torso=13, arm_near=(-10, 30), arm_far=(60, 40), foot_near=(37, 0), foot_far=(17, 0),
                    head_tilt=14, extra=dict(club=40, jaw=4))
    if name == "recover":  # 스킬: 곤봉을 치켜들고 하늘을 향해 포효
        return Pose(hip=(26, 41), lean=-10, torso=13, arm_near=(-70, -100), arm_far=(-20, 30), foot_near=(34, 0), foot_far=(17, 0),
                    head_tilt=-26, extra=dict(club=-95, jaw=6))
    if name == "hit":
        return Pose(hip=(23, 41), lean=-20, torso=13, arm_near=(-40, 0), arm_far=(-60, -20), foot_near=(30, 0), foot_far=(17, 2),
                    head_tilt=-26, extra=dict(club=-120, jaw=3, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    club(cv, (8, 58), 0)
    cv.part(chain([(14, 57), (24, 57)], [4, 4]), WRAP, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(22, 59), (24, 51), (40, 50), (42, 59)]), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [(30, 52), (40, 49), (44, 52), (38, 54)]), FUR, ink=INK)
    cv.part(ellipse(cv.blank(), (47, 54), 5, 4.4), SKIN, ink=INK)
    cv.line([(46, 52), (48, 54)], INK)
    cv.line([(48, 52), (46, 54)], INK)
    cv.part(poly(cv.blank(), [(51, 56), (52, 56), (52, 52)]), [TUSK] * 4, ink=INK, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "recover":  # 몸 둘레 붉은 기운(몸 뒤에 먼저)
        for r, col in ((20, RAGE[0]), (16, RAGE[1])):
            ring(cv, (27, 34), r, -80, 60, col, width=2 if r == 20 else 1)
    J = draw_body(cv, LOOK, P)
    tip = P.extra["tip"]
    if name == "attack":
        arc_trail(cv, J["hand_n"], 13, -60, 40, 3.4, WOOD[2], WHITE)
        burst(cv, add(tip, (2, 1)), 4.5, (255, 220, 120), WHITE, spikes=6)
    elif name == "recover":
        m = J["mouth"]
        for r in (4, 7, 10):
            ring(cv, m, r, -60, 30, RAGE[2] if r == 4 else RAGE[1])
        sparkle(cv, add(tip, (0, -2)), WHITE, RAGE[2], big=True)
    elif name == "windup":
        sparkle(cv, add(tip, (0, -1)), WHITE, IRON[3], big=True)
    elif name == "move":
        puff(cv, (13, 57), 2.4, DUST)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((6, -6), (8, -3), (4, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("orc-01", draw, sys.argv[1:], idle_ms=230)
