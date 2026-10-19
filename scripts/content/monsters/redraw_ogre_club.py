#!/usr/bin/env python3
"""곤봉 든 누런 오거(ogre-club) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

오크보다 훨씬 큰 거구: 배불뚝이 둥근 몸통이 몸의 절반, 어깨 사이로 파묻힌 작은 대머리(목이 없다),
튀어나온 아래턱과 위로 솟은 송곳니 두 개, 머리 안 작은 눈, 큰 코와 늘어진 귀. 누런 황토 피부,
갈색 털가죽 허리 두름, 굵고 짧은 다리, 땅에 닿을 듯 긴 팔. 가까운 손에 나무 둥치째 뽑은 거대 곤봉(옹이·잔가지).
6번 칸(스킬 대지 내려찍기): 곤봉을 두 손으로 땅에 내리꽂아 아군 쪽으로 땅이 갈라지고 돌이 튄다.

  python3 scripts/content/monsters/redraw_ogre_club.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, crack, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

S = 96
G = 92
INK = (36, 26, 12)
SKIN = [(150, 120, 56), (190, 158, 82), (220, 192, 112), (240, 220, 150)]
SKIN_FAR = [(116, 92, 42), (150, 120, 56), (166, 134, 64), (166, 134, 64)]
HIDE = [(86, 58, 34), (120, 84, 50), (150, 110, 68), (176, 136, 90)]
WOOD = [(70, 46, 26), (104, 70, 40), (136, 96, 58), (160, 120, 78)]
LEAF = (90, 130, 60)
TUSK = (246, 238, 210)
EYE = (220, 40, 30)
MOUTH = (100, 30, 24)
DUST = [(130, 110, 80), (176, 156, 120)]
WHITE = (255, 250, 236)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee], [10, 9]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, add(foot, (0, -3))], [9, 8]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 5, f[1] - 5), (f[0] + 5, f[1] - 5), (f[0] + 8, f[1]), (f[0] - 5, f[1])]), ramp, ink=INK, gloss=False)
    for dx in (3, 6):
        cv.pixel(f[0] + dx, f[1] - 2, ramp[0])


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 배불뚝이: 아래가 앞으로 불룩한 큰 타원 + 넓은 어깨
    cv.part(poly(cv.blank(), [R(-10, -14), R(-12, -24), R(-7, -29), R(7, -29), R(13, -25), R(12, -18)]), SKIN, ink=INK)
    M = cv.part(ellipse(cv.blank(), R(3, -12), 15, 14), SKIN, ink=INK)
    cv.shade_side(M, SKIN[0], side=-1, depth=3)
    cv.line4([rnd(R(8, -10)), rnd(R(10, -14))], SKIN[0])  # 배꼽 주름
    cv.pixel(*rnd(R(9, -9)), SKIN[0])
    # 털가죽 허리 두름(삐죽 끝)
    pts = [R(-13, -6), R(15, -6), R(16, 2), R(12, 0), R(9, 4), R(5, 1), R(1, 5), R(-3, 1), R(-7, 4), R(-11, 0), R(-14, 3)]
    cv.part(poly(cv.blank(), pts), HIDE, ink=INK, gloss=False)
    cv.line4([rnd(R(-12, -5)), rnd(R(14, -5))], HIDE[3])


def club(cv, hand, ang):
    tip = polar(hand, ang, 24)
    butt = polar(hand, ang + 180, 5)
    cv.part(chain([butt, hand, lerp(hand, tip, 0.6), tip], [5, 6, 9, 12]), WOOD, ink=INK, gloss=False)
    for t, s in ((0.55, 1), (0.8, -1)):  # 옹이
        p = lerp(hand, tip, t)
        cv.part(ellipse(cv.blank(), polar(p, ang + 90 * s, 3.5), 1.6, 1.6), WOOD, ink=INK, gloss=False)
    tw = polar(lerp(hand, tip, 0.7), ang - 60, 9)
    cv.line4([rnd(lerp(hand, tip, 0.7)), rnd(tw)], WOOD[0])
    cv.pixel(*rnd(tw), LEAF)
    cv.pixel(*rnd(add(tw, (1, 0))), LEAF)
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [10, 8.5]), ramp, ink=INK, gloss=False)
    if not far:
        P.extra["tip"] = club(cv, hand, P.extra.get("club", -70))
    cv.part(chain([el, hand], [8.5, 8]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 5, 4.5), ramp, ink=INK, gloss=False)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 튀어나온 아래턱 + 송곳니
    if jaw:
        cv.put(poly(cv.blank(), [R(0, 3), R(10, 3), R(10, 4 + jaw), R(0, 5)]), MOUTH)
    cv.part(poly(cv.blank(), [R(-4, 3 + jaw * 0.5), R(11, 3 + jaw), R(11, 9 + jaw), R(-2, 9)]), SKIN, ink=INK, gloss=False)
    for dx in (5, 9):
        t0 = R(dx, 3 + jaw * dx / 11)
        cv.part(poly(cv.blank(), [add(t0, (-1, 0)), add(t0, (1, 0)), add(t0, (0, -5))]), [TUSK] * 4, ink=INK, gloss=False)
    # 대머리 정수리
    cv.part(poly(cv.blank(), [R(-7, 4), R(-8, -4), R(-4, -10), R(3, -11), R(9, -7), R(10, 0), R(11, 3), R(2, 5)]), SKIN, ink=INK)
    # 늘어진 귀
    cv.part(poly(cv.blank(), [R(-5, -3), R(-11, -1), R(-10, 4), R(-5, 2)]), SKIN, ink=INK, gloss=False)
    cv.pixel(*rnd(R(-8, 1)), SKIN[0])
    # 큰 코
    cv.part(poly(cv.blank(), [R(8, -4), R(13, -1), R(12, 2), R(8, 1)]), SKIN, ink=INK, gloss=False)
    # 눈썹 + 눈
    cv.line4([rnd(R(1, -6)), rnd(R(8, -5))], SKIN[0])
    e = rnd(R(5, -3))
    if P.extra.get("eye") == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), (250, 240, 200))
        cv.pixel(*e, EYE)
        cv.pixel(e[0], e[1] - 1, EYE)
        cv.pixel(e[0] + 1, e[1], INK)
    return dict(eye=e, mouth=R(10, 4))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=14.0, lower=13.0, thigh=10.0, shin=10.0, hip_w=10, shoulder_w=8, ground=G)


def pose(name):
    b = dict(hip=(42, 66), torso=28.0, neck=6.0, foot_near=(52, 0), foot_far=(34, 0))
    if name == "idle_a":
        return Pose(**b, lean=6, head_tilt=4, arm_near=(70, 80), arm_far=(100, 95), extra=dict(club=-60))
    if name == "idle_b":
        return Pose(**dict(b, hip=(42, 67)), lean=8, head_tilt=8, arm_near=(75, 85), arm_far=(105, 100), extra=dict(club=-55, jaw=2))
    if name == "idle_c":  # 곤봉을 어깨에 걸치려 든다
        return Pose(**b, lean=4, head_tilt=0, arm_near=(60, 10), arm_far=(95, 90), extra=dict(club=-40, jaw=1))
    if name == "windup":
        return Pose(**dict(b, foot_near=(50, 0), foot_far=(28, 0)), lean=-10, head_tilt=-8, arm_near=(-135, -165), arm_far=(-100, -130),
                    extra=dict(club=-165, jaw=4))
    if name == "move":
        return Pose(**dict(b, hip=(47, 65), foot_near=(62, 3), foot_far=(33, 0)), lean=16, head_tilt=10, arm_near=(150, 120), arm_far=(20, 60),
                    extra=dict(club=175, jaw=3))
    if name == "attack":
        return Pose(**dict(b, foot_near=(55, 0), foot_far=(28, 0)), lean=18, head_tilt=12, arm_near=(-10, 20), arm_far=(60, 70),
                    extra=dict(club=15, jaw=5))
    if name == "recover":
        return Pose(**dict(b, hip=(40, 67), foot_near=(53, 0), foot_far=(28, 0)), lean=26, head_tilt=16, arm_near=(30, 60), arm_far=(40, 60),
                    extra=dict(club=72, jaw=6))
    if name == "hit":
        return Pose(**dict(b, hip=(38, 67), foot_near=(48, 0), foot_far=(30, 2)), lean=-18, head_tilt=-22, arm_near=(120, 150), arm_far=(-60, -20),
                    extra=dict(club=170, jaw=2, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    club(cv, (8, 88), -5)
    cv.part(chain([(22, 86), (36, 86)], [8, 8]), SKIN_FAR, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (50, 82), 18, 10), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [(34, 90), (36, 82), (50, 84), (64, 82), (66, 90)]), HIDE, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (74, 82), 9, 8), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [(80, 84), (86, 84), (86, 89), (80, 89)]), SKIN, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(83, 84), (85, 84), (84, 80)]), [TUSK] * 4, ink=INK, gloss=False)
    cv.line([(73, 79), (76, 82)], INK)
    cv.line([(76, 79), (73, 82)], INK)


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 12, (44, 54, 64), SKIN[2])
    J = draw_body(cv, LOOK, P)
    tip = P.extra["tip"]
    if name == "windup":
        sparkle(cv, add(tip, (2, -2)), WHITE, SKIN[3], big=True)
    elif name == "move":
        puff(cv, (22, 88), 3.6, DUST)
    elif name == "attack":
        arc_trail(cv, J["hand_n"], 22, -70, 30, 5, WOOD[2], WHITE)
        burst(cv, add(tip, (3, 2)), 7, (255, 220, 140), WHITE, spikes=7)
    elif name == "recover":
        base = (tip[0] + 2, G - 1)
        crack(cv, base, [(base[0] + 6, 89), (base[0] + 12, 91), (base[0] + 18, 88), (min(93, base[0] + 24), 90)], INK)
        crack(cv, (base[0] + 10, 90), [(base[0] + 14, 86), (base[0] + 19, 85)], INK)
        for p, r in (((8, -16), 3.0), ((16, -10), 2.4), ((5, -24), 2.0), ((20, -20), 1.8)):
            q = add(base, p)
            if q[0] < 92:
                cv.part(ellipse(cv.blank(), q, r, r), DUST + [DUST[1], DUST[1]], ink=INK, gloss=False)
        puff(cv, add(base, (-4, -4)), 4.5, DUST)
        burst(cv, add(base, (3, -6)), 6, DUST[1], WHITE, spikes=6)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((6, -12), (10, -8), (9, -15)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("ogre-club", draw, sys.argv[1:], S=S, idle_ms=260)
