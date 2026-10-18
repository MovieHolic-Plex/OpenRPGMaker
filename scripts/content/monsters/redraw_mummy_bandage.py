#!/usr/bin/env python3
"""붕대 미라(mummy-bandage) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

빛바랜 누런 붕대가 사선 띠로 감긴 마른 몸, 붕대 틈의 검은 살과 붉게 빛나는 한쪽 눈,
풀린 붕대 끝자락이 뒤로 나부낀다. 무릎을 굽힌 채 두 팔을 앞으로 뻗고 느리게 걷는다.
6번 칸(스킬 skill_mon_bandage_bind): 한 팔을 앞으로 내지르며 붕대가 뱀처럼 길게 풀려 아군 쪽으로 뻗는다.

  python3 scripts/content/monsters/redraw_mummy_bandage.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (34, 26, 18)
WRAP = [(150, 126, 84), (196, 174, 124), (226, 210, 164), (246, 236, 200)]
WRAP_FAR = [(112, 92, 60), (150, 126, 84), (170, 148, 104), (170, 148, 104)]
FLESH = (54, 40, 34)
EYE, EYE_HI = (240, 60, 40), (255, 200, 150)
CURSE = [(120, 70, 160), (190, 130, 230), (240, 210, 255)]
DUST = [(140, 120, 90), (190, 170, 130)]
WHITE = (255, 252, 236)


def stripes(cv, M, phase=0, step=4):
    """마스크 안쪽에 사선 붕대 이음선(그늘색)을 긋는다."""
    M = cv.mask(M)
    ys, xs = np.nonzero(M)
    for y, x in zip(ys, xs):
        if (y + x // 3 + phase) % 3 == 0:
            cv.rgb[y, x] = WRAP[0]


def leg(cv, hip, knee, foot, far):
    ramp = WRAP_FAR if far else WRAP
    M1 = cv.part(chain([hip, knee], [4.4, 3.6]), ramp, gloss=False)
    M2 = cv.part(chain([knee, add(foot, (0, -1))], [3.6, 3.0]), ramp, gloss=False)
    if not far:
        stripes(cv, M1 | M2, 1)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 1, f[1] - 2), (f[0] + 3, f[1] - 1), (f[0] + 3, f[1]), (f[0] - 1, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    pts = [add(hip, (-4, 1)), add(hip, (4, 1)), add(chest, (5, 1)), add(chest, (3, -3)), add(chest, (-4, -3)), add(chest, (-5, 1))]
    M = cv.part(poly(cv.blank(), pts), WRAP)
    stripes(cv, M, 0)
    # 붕대가 풀려 갈비 쪽 검은 살이 드러난 틈
    g = lerp(hip, chest, 0.5)
    cv.put(poly(cv.blank(), [add(g, (2, -1)), add(g, (4, 0)), add(g, (3, 2))]), FLESH)
    # 등 뒤로 나부끼는 풀린 붕대 끝
    sway = P.extra.get("sway", 0)
    tail = bezier(add(chest, (-4, 0)), add(chest, (-10, 4 + sway)), add(chest, (-12, 12 + sway)), 8)
    cv.part(chain(tail, [2.2] * len(tail)), WRAP_FAR, gloss=False)


def arm(cv, sh, el, hand, far, P):
    ramp = WRAP_FAR if far else WRAP
    M = cv.part(chain([sh, el], [3.4, 3.0]), ramp, gloss=False)
    M |= cv.part(chain([el, hand], [3.0, 2.6]), ramp, gloss=False)
    if not far:
        stripes(cv, M, 2)
        # 손끝 검은 손가락 둘
        a = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
        for k in (-25, 20):
            cv.line4([rnd(hand), rnd(polar(hand, a + k, 2.5))], FLESH)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    M = cv.part(ellipse(cv.blank(), r(1, -1), 5.2, 5.6), WRAP)
    stripes(cv, M, 3)
    # 눈 띠 틈(검은 살) + 한쪽 눈
    cv.put(poly(cv.blank(), [r(0, -3), r(6, -3), r(6, -1), r(0, -1)]), FLESH)
    if P.extra.get("eye") == "shut":
        cv.line([rnd(r(3, -2)), rnd(r(5, -2))], WRAP[0])
    else:
        e = rnd(r(4, -2))
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE_HI)
        cv.pixel(*rnd(r(1, -2)), (110, 30, 24))
    mouth = P.extra.get("mouth", 0)
    if mouth:
        cv.put(poly(cv.blank(), [r(2, 2), r(6, 2), r(5, 2 + mouth), r(2, 2 + mouth)]), FLESH)
    # 정수리에서 삐져나온 붕대 끝
    cv.part(chain([r(-4, -2), r(-7, 1), r(-8, 5)], [1.8, 1.6, 1.4]), WRAP_FAR, gloss=False)
    return dict(eye=r(4, -2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=8.0, shin=9.0)


def pose(name):
    b = dict(hip=(27, 42), foot_near=(33, 0), foot_far=(20, 0))
    if name == "idle_a":
        return Pose(**b, lean=12, arm_near=(0, 6), arm_far=(-6, 0), head_tilt=6, extra=dict(sway=0))
    if name == "idle_b":
        return Pose(**dict(b, hip=(27, 43)), lean=16, arm_near=(10, 16), arm_far=(4, 10), head_tilt=12, extra=dict(sway=3, mouth=2))
    if name == "idle_c":
        return Pose(**dict(b, foot_near=(35, 2)), lean=8, arm_near=(-8, -2), arm_far=(-14, -8), head_tilt=-4, extra=dict(sway=-2))
    if name == "windup":  # 팔을 뒤로 젖혀 붕대를 감아쥔다
        return Pose(**dict(b, hip=(24, 42), foot_near=(31, 0), foot_far=(16, 0)), lean=-8,
                    arm_near=(-70, -35), arm_far=(-85, -50), head_tilt=-10, extra=dict(sway=4, mouth=2))
    if name == "move":
        return Pose(**dict(b, hip=(31, 42), foot_near=(40, 2), foot_far=(21, 0)), lean=22,
                    arm_near=(6, 0), arm_far=(-4, -10), head_tilt=14, extra=dict(sway=6))
    if name == "attack":  # 두 팔로 내리친다
        return Pose(**dict(b, hip=(31, 42), foot_near=(40, 0), foot_far=(22, 0)), lean=26,
                    arm_near=(20, 60), arm_far=(10, 50), head_tilt=20, extra=dict(sway=5, mouth=3))
    if name == "recover":  # 스킬: 앞팔을 곧게 뻗는다(붕대는 draw 에서)
        return Pose(**dict(b, hip=(25, 42), foot_near=(33, 0), foot_far=(16, 0)), lean=4,
                    arm_near=(-4, -4), arm_far=(-160, -130), head_tilt=0, extra=dict(sway=7, mouth=3))
    if name == "hit":
        return Pose(**dict(b, hip=(23, 43), foot_near=(31, 0), foot_far=(17, 2)), lean=-22,
                    arm_near=(-30, -10), arm_far=(-40, -20), head_tilt=-28, extra=dict(sway=-4, eye="shut", mouth=3))
    raise KeyError(name)


def draw_dead(cv):
    """무너진 붕대 더미와 풀려 흩어진 끝자락, 꺼진 눈."""
    M = cv.part(poly(cv.blank(), [(14, 59), (18, 54), (30, 52), (40, 54), (44, 59)]), WRAP)
    stripes(cv, M, 0)
    cv.part(ellipse(cv.blank(), (46, 55), 4.5, 4.0), WRAP)
    cv.put(poly(cv.blank(), [(45, 53), (50, 53), (50, 55), (45, 55)]), FLESH)
    pts = bezier((14, 57), (8, 50), (4, 58), 8)
    cv.part(chain(pts, [2.0] * len(pts)), WRAP_FAR, gloss=False)
    pts = bezier((50, 58), (56, 54), (59, 58), 6)
    cv.part(chain(pts, [1.8] * len(pts)), WRAP_FAR, gloss=False)
    puff(cv, (28, 47), 2.6, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    h = J["hand_n"]
    if name == "recover":
        # 손끝에서 뱀처럼 굽이치며 아군 쪽으로 뻗는 붕대 + 저주 빛
        pts = [h]
        for i in range(1, 9):
            pts.append((h[0] + i * 3.2, h[1] - 4 + math.sin(i * 1.1) * 3))
        pts = [p for p in pts if p[0] < 61]
        cv.part(chain(pts, [2.6] * len(pts)), WRAP, gloss=False)
        for p in pts[2::2]:
            cv.pixel(*rnd(p), WRAP[0])
        sparkle(cv, add(pts[-1], (-1, -5)), CURSE[2], CURSE[1], big=True)
        cv.pixel(*rnd(add(J["eye"], (1, -1))), CURSE[2])
    elif name == "attack":
        slash(cv, add(h, (-4, -10)), add(h, (4, 4)), 3, 3.0, WRAP[2], WHITE)
        burst(cv, add(h, (3, 2)), 4.0, DUST[1], WHITE, spikes=6)
    elif name == "windup":
        cv.pixel(*rnd(add(J["eye"], (1, -1))), EYE_HI)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -7), (9, -4), (8, -10)):
            cv.pixel(hd[0] + dx, hd[1] + dy, WHITE)
        puff(cv, add(J["chest"], (5, 0)), 2.2, DUST)
    return cv.image()


if __name__ == "__main__":
    run("mummy-bandage", draw, sys.argv[1:], idle_ms=260)
