#!/usr/bin/env python3
"""고블린 장사(goblin-brute) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

정찰병보다 두 배 굵은 덩치 고블린: 넓은 초록 가슴과 불룩한 어깨, 짧고 굵은 다리, 작은 머리에 앞으로 튀어나온
아래턱과 위로 솟은 큰 엄니 둘, 왼뺨의 흉터, 짧게 처진 귀. 붉은 가죽 치마와 굵은 허리띠,
가까운 손에 못 박힌 두꺼운 나무 곤봉, 넓은 손발. 정찰병(goblin-scout)의 마른 몸·긴 귀·단검과 전혀 다르다.
6번 칸(스킬 땅 울리기): 곤봉을 두 손으로 머리 위에서 땅에 내리쳐 앞쪽으로 충격파와 돌 파편이 튄다.

  python3 scripts/content/monsters/redraw_goblin_brute.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, lerp, polar, poly, puff, ring, rnd, run, sparkle

INK = (18, 26, 14)
SKIN = [(58, 104, 40), (90, 144, 56), (128, 180, 78), (168, 210, 112)]
SKIN_FAR = [(42, 78, 30), (58, 104, 40), (74, 122, 48), (74, 122, 48)]
SKIRT = [(110, 30, 26), (156, 48, 38), (192, 76, 56), (210, 100, 76)]
BELT = [(48, 34, 24), (76, 54, 36), (100, 74, 50), (100, 74, 50)]
WOOD = [(82, 52, 28), (122, 82, 46), (158, 112, 66), (180, 136, 86)]
NAIL = (190, 196, 206)
TUSK = (246, 238, 210)
SCAR = (150, 70, 60)
EYE, EYE_HI = (250, 200, 40), (255, 250, 200)
DUST = [(110, 96, 70), (156, 140, 108)]
ROCK = [(90, 86, 80), (130, 124, 116), (170, 164, 154), (170, 164, 154)]
WHITE = (255, 255, 240)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee], [6.0, 5.0]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, add(foot, (0, -2))], [5.0, 4.4]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 3, f[1] - 3), (f[0] + 6, f[1]), (f[0] - 3, f[1])]), ramp, ink=INK, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 넓은 술통 가슴(위가 더 넓다)
    body = [add(hip, (-6, 1)), add(hip, (6, 1)), add(chest, (9, 3)), add(chest, (7, -4)), add(chest, (-6, -4)), add(chest, (-8, 2))]
    M = cv.part(poly(cv.blank(), body), SKIN, ink=INK)
    cv.shade_side(M, SKIN[0], side=-1, depth=2)
    # 가슴 근육 선 + 배꼽
    c = lerp(hip, chest, 0.7)
    cv.line4([add(c, (1, 0)), add(c, (5, 1))], SKIN[0])
    cv.pixel(*rnd(add(lerp(hip, chest, 0.3), (4, 0))), SKIN[0])
    # 붉은 가죽 치마(톱니 끝) + 굵은 허리띠
    sk = [add(hip, (-7, -1)), add(hip, (7, -1)), add(hip, (8, 6)), add(hip, (5, 4)), add(hip, (2, 7)), add(hip, (-1, 4)),
          add(hip, (-4, 7)), add(hip, (-7, 4))]
    cv.part(poly(cv.blank(), sk), SKIRT, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [add(hip, (-7, -3)), add(hip, (7, -3)), add(hip, (7, 0)), add(hip, (-7, 0))]), BELT, ink=INK, gloss=False)
    cv.pixel(*rnd(add(hip, (4, -2))), NAIL)


def club(cv, hand, ang):
    tip = polar(hand, ang, 15)
    butt = polar(hand, ang + 180, 3)
    cv.part(chain([butt, hand, lerp(hand, tip, 0.5), tip], [2.6, 3.0, 4.4, 5.6]), WOOD, ink=INK, gloss=False)
    for t, k in ((0.65, 1), (0.85, -1), (0.95, 1)):
        p = polar(lerp(hand, tip, t), ang + 90 * k, 3)
        cv.pixel(*rnd(p), NAIL)
        cv.pixel(*rnd(polar(p, ang + 90 * k, 1)), NAIL)
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [6.0, 4.8]), ramp, ink=INK, gloss=False)
    cv.part(chain([el, hand], [4.8, 4.2]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 3.0, 2.8), ramp, ink=INK, gloss=False)
    if not far:
        P.extra["tip"] = club(cv, hand, P.extra.get("club", -60))


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 앞으로 튀어나온 아래턱 + 위로 솟은 엄니
    cv.part(poly(cv.blank(), [R(-2, 1), R(8, 1 + jaw * 0.4), R(8, 5 + jaw), R(-1, 5)]), SKIN, ink=INK, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(1, 1), R(7, 1), R(7, 1 + jaw), R(1, 2)]), (90, 20, 26))
    for dx in (3, 7):
        t0 = R(dx, 2 + jaw * 0.4 * dx / 8)
        cv.part(poly(cv.blank(), [add(t0, (-0.5, 0)), add(t0, (1.5, 0)), add(t0, (0.5, -5))]), [TUSK] * 4, ink=INK, gloss=False)
    # 작은 머리(낮은 이마, 굵은 눈두덩) + 짧게 처진 귀
    cv.part(poly(cv.blank(), [R(-3, -4), R(-6, -2), R(-5, 1)]), SKIN, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-4, 1), R(-4, -4), R(0, -6), R(5, -5), R(7, -2), R(8, 1), R(2, 2)]), SKIN, ink=INK)
    cv.line4([rnd(R(1, -3)), rnd(R(6, -2))], SKIN[0])  # 눈두덩
    e = rnd(R(4, -1))
    if P.extra.get("eye") == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE_HI)
    cv.pixel(*rnd(R(8, 0)), INK)  # 콧구멍
    cv.line4([rnd(R(0, -1)), rnd(R(2, 1))], SCAR)
    return dict(eye=R(4, -1), mouth=R(8, 3))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=6.5, shin=6.5, shoulder_w=6, hip_w=6)


def pose(name):
    base = dict(torso=12, neck=3)
    if name == "idle_a":
        return Pose(hip=(28, 45), lean=6, arm_near=(70, 30), arm_far=(100, 70), foot_near=(35, 0), foot_far=(21, 0),
                    extra=dict(club=-80), **base)
    if name == "idle_b":  # 곤봉을 어깨에 걸치고 숨 몰아쉼
        return Pose(hip=(28, 46), lean=8, arm_near=(80, -40), arm_far=(105, 75), foot_near=(35, 0), foot_far=(21, 0),
                    head_tilt=6, extra=dict(club=-150, jaw=2), **base)
    if name == "idle_c":  # 가슴을 펴며 으스댐
        return Pose(hip=(28, 45), lean=0, arm_near=(60, 10), arm_far=(110, 80), foot_near=(36, 0), foot_far=(20, 0),
                    head_tilt=-6, extra=dict(club=-70, jaw=1), **base)
    if name == "windup":
        return Pose(hip=(25, 45), lean=-10, arm_near=(-100, -130), arm_far=(30, 0), foot_near=(33, 0), foot_far=(17, 0),
                    head_tilt=-6, extra=dict(club=-140, jaw=3), **base)
    if name == "move":
        return Pose(hip=(32, 45), lean=18, arm_near=(140, 110), arm_far=(30, 50), foot_near=(42, 2), foot_far=(22, 0),
                    head_tilt=8, extra=dict(club=170, jaw=2), **base)
    if name == "attack":
        return Pose(hip=(24, 45), lean=20, arm_near=(-10, 30), arm_far=(60, 40), foot_near=(34, 0), foot_far=(15, 0),
                    head_tilt=12, extra=dict(club=40, jaw=4), **base)
    if name == "recover":  # 스킬: 곤봉을 앞 땅에 내리꽂은 순간
        return Pose(hip=(26, 47), lean=28, arm_near=(50, 70), arm_far=(60, 75), foot_near=(34, 0), foot_far=(17, 0),
                    head_tilt=16, extra=dict(club=30, jaw=5), **base)
    if name == "hit":
        return Pose(hip=(24, 45), lean=-18, arm_near=(-40, 0), arm_far=(-60, -20), foot_near=(31, 0), foot_far=(17, 2),
                    head_tilt=-26, extra=dict(club=-110, jaw=3, eye="shut"), **base)
    raise KeyError(name)


def draw_dead(cv):
    club(cv, (8, 58), 5)
    cv.part(chain([(14, 56), (22, 57)], [5, 5]), SKIN_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(20, 59), (24, 50), (40, 49), (42, 59)]), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [(22, 57), (26, 53), (30, 59)]), SKIRT, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (46, 54), 5, 4.4), SKIN, ink=INK)
    cv.line([(45, 52), (47, 54)], INK)
    cv.line([(47, 52), (45, 54)], INK)
    cv.part(poly(cv.blank(), [(50, 55), (51, 55), (51, 51)]), [TUSK] * 4, ink=INK, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    tip = P.extra["tip"]
    if name == "attack":
        arc_trail(cv, J["hand_n"], 14, -60, 40, 3.4, WOOD[2], WHITE)
        burst(cv, add(tip, (2, 1)), 4.5, (255, 220, 120), WHITE, spikes=6)
    elif name == "recover":
        g = (tip[0], 59)
        for r in (5, 9, 13):
            ring(cv, (g[0], 60), r, -90, 0, DUST[1] if r < 13 else DUST[0], width=1)
        burst(cv, (g[0], 57), 4.0, (255, 220, 120), WHITE, spikes=6)
        for k, (dx, dy) in enumerate(((6, -8), (10, -4), (13, -10))):
            p = add(g, (dx, dy))
            cv.part(poly(cv.blank(), [add(p, (-1, -1)), add(p, (2, -1)), add(p, (1, 2)), add(p, (-1, 1))]), ROCK, ink=INK, gloss=False)
            cv.line4([add(g, (2, -2)), p], DUST[1])
    elif name == "windup":
        sparkle(cv, add(tip, (0, -1)), WHITE, WOOD[3], big=True)
    elif name == "move":
        puff(cv, (14, 57), 2.4, DUST)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((6, -6), (8, -3), (4, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("goblin-brute", draw, sys.argv[1:], idle_ms=240)
