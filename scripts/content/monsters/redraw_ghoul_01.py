#!/usr/bin/env python3
"""구울(ghoul-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

검록색 살갗의 깡마른 구울: 등을 둥글게 말고 낮게 웅크린 몸, 앞으로 길게 튀어나온 주둥이 같은 큰 턱과
아래턱에서 위로 솟은 엄니 둘, 가죽이 붙어 드러난 갈비뼈, 무릎 아래까지 늘어지는 아주 긴 팔과 굵은 갈고리 발톱.
뾰족한 귀와 움푹한 노란 눈. 좀비보다 짐승처럼 네발에 가깝게 숙인다.
6번 칸(스킬 시체 먹기 포효): 상체를 일으켜 턱을 하늘로 쳐들고 녹색 굶주림 기운을 둥글게 터뜨린다.

  python3 scripts/content/monsters/redraw_ghoul_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (12, 20, 14)
SKIN = [(46, 70, 50), (70, 100, 70), (100, 132, 92), (138, 166, 120)]
SKIN_FAR = [(32, 50, 38), (46, 70, 50), (60, 86, 62), (60, 86, 62)]
RIB = (160, 186, 140)
RAG = [(54, 44, 36), (80, 66, 52), (104, 88, 70), (104, 88, 70)]
TUSK = (236, 228, 196)
CLAW = (220, 214, 190)
MOUTH = (90, 20, 26)
EYE, EYE_HI = (240, 220, 60), (255, 255, 200)
HUNGER = [(60, 140, 60), (150, 230, 110), (230, 255, 200)]
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([hip, knee], [4.4, 3.0]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (-1, -2))], [3.0, 2.4]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 2), (f[0] + 2, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 3, f[1])]), ramp, gloss=False)
    if not far:
        for dx in (3, 5):
            cv.pixel(f[0] + dx, f[1], CLAW)


def torso(cv, hip, chest, lean, P):
    # 둥글게 말린 등: 등 쪽(왼쪽)이 불룩
    back = add(lerp(hip, chest, 0.6), (-6, -3))
    pts = [add(hip, (-4, 2)), add(hip, (4, 2)), add(chest, (5, 3)), add(chest, (3, -3)), add(chest, (-3, -4)), back]
    M = cv.part(poly(cv.blank(), pts), SKIN)
    cv.shade_side(M, SKIN[0], side=-1, depth=2)
    # 드러난 갈비 넷(배 쪽)
    a = math.radians(lean)
    for i in range(4):
        s = lerp(hip, chest, 0.35 + i * 0.16)
        cv.line4([rnd(add(s, (0, 0))), rnd(add(s, (3 * math.cos(a) + 1, 0))), rnd(add(s, (4 * math.cos(a) + 1, 1)))], RIB)
    # 해진 허리 넝마
    cv.part(poly(cv.blank(), [add(hip, (-5, -1)), add(hip, (5, -1)), add(hip, (4, 4)), add(hip, (1, 3)), add(hip, (-2, 5)), add(hip, (-5, 3))]), RAG, gloss=False)


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [3.4, 2.6]), ramp, gloss=False)
    cv.part(chain([el, hand], [2.6, 2.4]), ramp, gloss=False)
    a = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    cv.part(ellipse(cv.blank(), hand, 2.0, 2.0), ramp, gloss=False)
    for k in (-40, 0, 40):  # 굵은 갈고리 발톱 셋
        c1 = polar(hand, a + k, 3)
        c2 = polar(c1, a + k + 50, 2)
        cv.line4([rnd(hand), rnd(c1), rnd(c2)], CLAW if not far else RIB)


def head(cv, c, tilt, P):
    jaw = P.extra.get("jaw", 2)
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 아래턱(길고 무겁다) + 엄니 둘
    lower = xf_jaw = [r(-1, 2), r(9, 2 + jaw * 0.4), r(9, 4 + jaw), r(1, 5 + jaw * 0.6)]
    if jaw > 1:
        cv.put(poly(cv.blank(), [r(1, 0), r(9, 0), r(9, 3 + jaw), r(1, 4)]), MOUTH)
    cv.part(poly(cv.blank(), lower), SKIN, gloss=False)
    for dx in (5, 8):
        t0 = r(dx, 2 + jaw * 0.4 * dx / 9)
        cv.line4([rnd(t0), rnd(add(t0, (0, -3)))], TUSK)
    # 두개골: 낮은 이마, 길게 튀어나온 주둥이
    cv.part(poly(cv.blank(), [r(-5, 0), r(-4, -5), r(1, -6), r(6, -4), r(10, -1), r(10, 1), r(4, 2), r(-3, 3)]), SKIN)
    # 뾰족한 귀(뒤로 눕힘)
    cv.part(poly(cv.blank(), [r(-3, -4), r(-10, -7), r(-2, -1)]), SKIN, gloss=False)
    e = rnd(r(3, -3))
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), INK)
    if P.extra.get("eye") != "shut":
        cv.pixel(e[0], e[1], EYE)
        cv.pixel(e[0] + 1, e[1] - 1, EYE_HI)
    cv.pixel(*rnd(r(10, -1)), INK)
    return dict(mouth=r(9, 2 + jaw * 0.5), eye=r(3, -3), snout=r(10, 0))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=9.0, lower=9.0, thigh=7.5, shin=8.0, shoulder_w=3, hip_w=4)


def pose(name):
    if name == "idle_a":  # 낮게 웅크려 긴 팔을 바닥 가까이 늘어뜨림
        return Pose(hip=(25, 45), lean=48, torso=11, arm_near=(70, 80), arm_far=(85, 90), foot_near=(31, 0), foot_far=(19, 0),
                    head_tilt=-6, extra=dict(jaw=2))
    if name == "idle_b":  # 어깨를 들썩이며 턱을 딱딱
        return Pose(hip=(25, 45), lean=44, torso=11, arm_near=(75, 85), arm_far=(88, 92), foot_near=(31, 0), foot_far=(19, 0),
                    head_tilt=-2, extra=dict(jaw=4))
    if name == "idle_c":  # 고개를 낮추고 킁킁
        return Pose(hip=(25, 46), lean=54, torso=11, arm_near=(60, 75), arm_far=(80, 88), foot_near=(32, 0), foot_far=(18, 0),
                    head_tilt=10, extra=dict(jaw=1))
    if name == "windup":  # 몸을 낮게 눌러 도약 준비, 팔을 뒤로
        return Pose(hip=(22, 47), lean=40, torso=10, arm_near=(150, 110), arm_far=(160, 120), foot_near=(30, 0), foot_far=(16, 0),
                    head_tilt=-14, extra=dict(jaw=5))
    if name == "move":  # 네발로 튀어 나간다
        return Pose(hip=(28, 43), lean=62, torso=11, arm_near=(40, 70), arm_far=(60, 80), foot_near=(30, 2), foot_far=(16, 0),
                    head_tilt=-4, extra=dict(jaw=3))
    if name == "attack":  # 긴 팔로 크게 할퀸다
        return Pose(hip=(31, 44), lean=40, torso=11, arm_near=(0, 30), arm_far=(30, 50), foot_near=(40, 0), foot_far=(22, 0),
                    head_tilt=6, extra=dict(jaw=6))
    if name == "recover":  # 스킬: 상체를 세우고 턱을 하늘로
        return Pose(hip=(25, 44), lean=8, torso=12, arm_near=(150, 100), arm_far=(170, 110), foot_near=(31, 0), foot_far=(18, 0),
                    head_tilt=-40, extra=dict(jaw=7))
    if name == "hit":  # 맞아서 몸이 뒤로 젖혀진다
        return Pose(hip=(23, 45), lean=10, torso=11, arm_near=(120, 150), arm_far=(135, 160), foot_near=(31, 0), foot_far=(17, 2),
                    head_tilt=-30, extra=dict(jaw=4, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    cv.part(chain([(10, 57), (20, 56)], [3.6, 3.6]), SKIN_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(18, 59), (22, 52), (38, 51), (40, 59)]), SKIN)
    for x in (26, 29, 32, 35):
        cv.line4([(x, 54), (x + 1, 57)], RIB)
    cv.part(chain([(38, 57), (48, 58), (56, 58)], [2.6, 2.4, 2.2]), SKIN, gloss=False)
    cv.part(poly(cv.blank(), [(38, 52), (44, 50), (52, 53), (52, 56), (40, 58)]), SKIN)
    cv.line([(43, 52), (45, 54)], INK)
    cv.line([(45, 52), (43, 54)], INK)
    cv.line4([(50, 55), (50, 52)], TUSK)
    for x in (57, 59):
        cv.pixel(x, 58, CLAW)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    if name == "attack":
        h = J["hand_n"]
        for k in (-3, 0, 3):
            slash(cv, add(h, (5 + k, -12)), add(h, (9 + k, 3)), 2, 2.2, MOUTH, (240, 200, 190))
    elif name == "recover":
        m = J["mouth"]
        for rr in (5, 8, 11):
            cv.line4([polar(m, -110 + k * 10, rr) for k in range(15)], HUNGER[1] if rr < 11 else HUNGER[0])
        cv.line4([m, polar(m, -40, 11)], HUNGER[0])
        burst(cv, add(m, (2, -3)), 3.5, HUNGER[1], HUNGER[2], spikes=6)
        sparkle(cv, add(m, (12, -6)), HUNGER[2], HUNGER[1], big=True)
        cv.line4([add(m, (5, -4)), add(m, (12, -6))], HUNGER[0])
    elif name == "windup":
        sparkle(cv, add(J["eye"], (2, -5)), WHITE, EYE)
    elif name == "move":
        puff(cv, (12, 57), 2.4, RAG[:2])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((6, -6), (8, -3), (5, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("ghoul-01", draw, sys.argv[1:], idle_ms=210)
