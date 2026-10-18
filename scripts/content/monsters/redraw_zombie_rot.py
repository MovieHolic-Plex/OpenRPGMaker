#!/usr/bin/env python3
"""썩은 좀비(zombie-rot) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

잿빛 녹색 살갗, 앞으로 굽은 등, 찢어진 적갈색 셔츠 사이로 드러난 갈비, 처진 턱과 한쪽만 빛나는 눈.
두 팔을 앞으로 내밀고 무릎을 굽힌 채 비틀거린다. 해진 바지와 맨발.
6번 칸(스킬 skill_mon_rot_breath): 몸을 젖혔다 턱이 빠질 만큼 입을 벌려 썩은 독구름을 앞으로 토한다.

  python3 scripts/content/monsters/redraw_zombie_rot.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (20, 22, 18)
SKIN = [(70, 96, 66), (104, 134, 90), (140, 168, 116), (176, 198, 146)]
SKIN_FAR = [(52, 72, 52), (70, 96, 66), (88, 116, 78), (88, 116, 78)]
SHIRT = [(86, 30, 30), (128, 48, 42), (164, 72, 58), (190, 100, 80)]
PANTS = [(42, 46, 70), (62, 68, 98), (84, 92, 124), (84, 92, 124)]
BONE = (226, 216, 186)
GORE = (120, 24, 30)
EYE, EYE_HI = (230, 240, 120), (255, 255, 220)
ROT = [(70, 54, 90), (110, 120, 70), (160, 180, 90), (210, 228, 140)]
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    pants = [(c[0] * 3 // 4, c[1] * 3 // 4, c[2] * 3 // 4) for c in PANTS] if far else PANTS
    cv.part(chain([hip, knee], [5.0, 4.0]), pants, gloss=False)
    shin_end = lerp(knee, foot, 0.55)
    cv.part(chain([knee, shin_end], [4.0, 3.6]), pants, gloss=False)
    cv.part(chain([shin_end, add(foot, (0, -1))], [2.6, 2.4]), SKIN_FAR if far else SKIN, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 1, f[1] - 2), (f[0] + 3, f[1] - 1), (f[0] + 3, f[1]), (f[0] - 1, f[1])]),
            SKIN_FAR if far else SKIN, gloss=False)
    if not far:  # 무릎의 찢어진 구멍
        cv.pixel(*rnd(add(knee, (1, 0))), SKIN[1])


def torso(cv, hip, chest, lean, P):
    pts = [add(hip, (-4, 1)), add(hip, (5, 1)), add(chest, (6, 1)), add(chest, (4, -3)), add(chest, (-4, -3)), add(chest, (-6, 1))]
    cv.part(poly(cv.blank(), pts), SHIRT)
    # 찢어진 앞섶: 드러난 살 + 갈비 셋
    mid = lerp(hip, chest, 0.55)
    cv.put(poly(cv.blank(), [add(mid, (1, -4)), add(mid, (5, -3)), add(mid, (5, 4)), add(mid, (2, 3))]), SKIN[1])
    for dy in (-2, 0, 2):
        cv.line([add(mid, (2, dy)), add(mid, (4, dy))], BONE)
    cv.pixel(*rnd(add(mid, (3, 4))), GORE)
    # 해진 셔츠 끝단(톱니)
    for dx in (-3, 0, 3):
        cv.pixel(*rnd(add(hip, (dx, 2))), SHIRT[0])
    cv.part(chain([add(hip, (-4, 1)), add(hip, (5, 1))], [3, 3]), PANTS, gloss=False)


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [4.0, 3.2]), SHIRT if not far else [(c[0] * 3 // 4, c[1] * 3 // 4, c[2] * 3 // 4) for c in SHIRT], gloss=False)
    cv.part(chain([el, hand], [3.0, 2.6]), ramp, gloss=False)
    # 갈고리처럼 굽은 손가락 셋
    a = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    for k in (-35, 0, 35):
        tip = polar(hand, a + k + 25, 2.6)
        cv.line([rnd(hand), rnd(tip)], ramp[2] if not far else ramp[1])


def head(cv, c, tilt, P):
    mouth = P.extra.get("mouth", 2)
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 처진 아래턱(벌릴수록 아래로)
    jaw = [r(-2, 2), r(6, 2 + mouth * 0.3), r(6, 4 + mouth), r(-1, 5 + mouth * 0.6)]
    if mouth > 1:
        cv.put(poly(cv.blank(), [r(0, 1), r(6, 1), r(6, 3 + mouth), r(0, 4)]), GORE)
    cv.part(poly(cv.blank(), jaw), SKIN, gloss=False)
    skull = [r(-5, -4), r(-1, -7), r(4, -6), r(7, -3), r(7, 1), r(5, 2), r(-3, 3), r(-6, 0)]
    cv.part(poly(cv.blank(), skull), SKIN)
    # 듬성듬성 남은 머리털(두피 외곽선 위에 얹는다)
    for dx, dy in ((-4, -5), (-2, -7), (0, -7)):
        cv.pixel(*rnd(r(dx, dy)), INK)
    # 이빨(아래·위)
    for dx in (2, 4):
        cv.pixel(*rnd(r(dx, 2)), BONE)
    cv.pixel(*rnd(r(3, 3 + mouth)), BONE)
    if P.extra.get("eye") == "shut":
        cv.line([rnd(r(3, -2)), rnd(r(5, -2))], INK)
    else:
        e = r(4, -2)
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
        cv.pixel(*rnd(r(1, -2)), INK)  # 퀭한 다른 눈
    cv.pixel(*rnd(r(-3, -1)), SKIN[0])  # 썩은 반점
    cv.pixel(*rnd(r(-2, 0)), GORE)
    return dict(mouth=r(7, 2 + mouth * 0.5))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.5, lower=7.0, thigh=8.5, shin=9.0)


def pose(name):
    if name == "idle_a":
        return Pose(hip=(27, 42), lean=24, arm_near=(10, 20), arm_far=(4, 14), foot_near=(32, 0), foot_far=(20, 0),
                    head_tilt=14, extra=dict(mouth=2))
    if name == "idle_b":  # 몸이 앞으로 쏠리며 턱이 처진다
        return Pose(hip=(28, 43), lean=30, arm_near=(20, 34), arm_far=(12, 26), foot_near=(33, 0), foot_far=(20, 0),
                    head_tilt=22, extra=dict(mouth=4))
    if name == "idle_c":  # 한 발을 끌며 비틀, 머리가 옆으로 꺾인다
        return Pose(hip=(27, 42), lean=18, arm_near=(2, 10), arm_far=(-6, 4), foot_near=(35, 2), foot_far=(19, 0),
                    head_tilt=-6, extra=dict(mouth=1))
    if name == "windup":  # 몸을 뒤로 젖히고 두 팔을 머리 앞 위로 쳐든다
        return Pose(hip=(24, 42), lean=-10, arm_near=(-60, -30), arm_far=(-75, -45), foot_near=(31, 0), foot_far=(17, 0),
                    head_tilt=-18, extra=dict(mouth=5))
    if name == "move":  # 앞으로 고꾸라지듯 달려든다
        return Pose(hip=(32, 42), lean=42, arm_near=(10, 4), arm_far=(-4, -6), foot_near=(42, 2), foot_far=(20, 0),
                    head_tilt=24, extra=dict(mouth=3))
    if name == "attack":  # 두 손을 내리찍으며 할퀸다
        return Pose(hip=(32, 42), lean=36, arm_near=(30, 70), arm_far=(20, 60), foot_near=(41, 0), foot_far=(23, 0),
                    head_tilt=30, extra=dict(mouth=6))
    if name == "recover":  # 스킬 썩은 숨결: 가슴을 내밀고 입을 크게 벌린다
        return Pose(hip=(24, 42), lean=6, arm_near=(105, 60), arm_far=(120, 80), foot_near=(30, 0), foot_far=(17, 0),
                    head_tilt=-12, extra=dict(mouth=7))
    if name == "hit":  # 맞아서 뒤로 휘청, 팔이 앞으로 들린다
        return Pose(hip=(22, 43), lean=-22, arm_near=(-20, -10), arm_far=(-30, -20), foot_near=(30, 0), foot_far=(17, 2),
                    head_tilt=-30, extra=dict(mouth=4, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    """엎어져 무너진 몸: 팔 하나를 앞으로 뻗고 머리를 땅에 박았다."""
    cv.part(chain([(14, 57), (20, 58)], [4, 4]), PANTS, gloss=False)
    cv.part(chain([(8, 58), (14, 57)], [3, 3]), SKIN, gloss=False)
    cv.part(poly(cv.blank(), [(19, 54), (36, 52), (38, 58), (19, 59)]), SHIRT)
    for x in (27, 29, 31):
        cv.pixel(x, 53, BONE)
    cv.part(chain([(36, 57), (46, 58), (54, 57)], [3, 2.6, 2.4]), SKIN, gloss=False)
    cv.part(ellipse(cv.blank(), (41, 54), 4.5, 4.0), SKIN)
    cv.line([(40, 52), (42, 54)], INK)
    cv.line([(42, 52), (40, 54)], INK)
    cv.pixel(55, 56, SKIN[2])
    puff(cv, (30, 47), 2.6, ROT[:2])
    cv.pixel(36, 44, ROT[2])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    m = J["mouth"]
    if name == "attack":
        for k in (-3, 0, 3):
            slash(cv, add(J["hand_n"], (-3 + k, -9)), add(J["hand_n"], (3 + k, 6)), 2, 2.0, GORE, (240, 200, 190))
        burst(cv, add(J["hand_n"], (3, 3)), 4.0, ROT[2], WHITE, spikes=6)
    elif name == "recover":
        # 입에서 앞으로 퍼지는 썩은 구름(점점 커진다)
        for t, r in ((0.0, 2.4), (0.35, 3.6), (0.7, 4.8), (1.0, 5.6)):
            c = lerp(add(m, (2, 0)), (55, m[1] - 4), t)
            puff(cv, c, r, [ROT[0], ROT[1]] if t < 0.5 else [ROT[1], ROT[2]])
        for p in ((48, 22), (56, 30), (44, 36)):
            cv.pixel(*p, ROT[3])
    elif name == "windup":
        cv.pixel(m[0] + 1, m[1] + 2, ROT[2])
        cv.pixel(m[0] + 2, m[1] + 4, ROT[2])
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((7, -7), (9, -4), (8, -10), (10, -1)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("zombie-rot", draw, sys.argv[1:], idle_ms=230)
