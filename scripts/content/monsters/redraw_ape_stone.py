#!/usr/bin/env python3
"""돌판 몸 바위 유인원(ape-stone) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

고릴라 체형: 어깨가 엉덩이보다 훨씬 높고 넓으며, 긴 앞팔 주먹(너클)으로 땅을 짚고 짧은 뒷다리로 선다.
짙은 회갈색 털에 등·어깨·팔뚝을 덮은 회색 돌판(갈라진 판석), 작은 머리에 툭 튀어나온 눈두덩과
그 아래 깊이 박힌 노란 눈, 앞으로 나온 넓은 주둥이(밝은 회색 얼굴 가죽), 정수리의 뾰족한 돌 볏.
6번 칸(스킬 가슴 두드리기): 두 발로 일어서서 돌판 가슴을 두드려 주황 충격 고리가 퍼진다.

  python3 scripts/content/monsters/redraw_ape_stone.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, crack, ellipse, ik_side, lerp, polar, poly, puff, ring, rnd, run, sparkle, speed_lines

INK = (22, 20, 20)
FUR = [(58, 50, 46), (84, 74, 66), (110, 98, 88), (134, 122, 110)]
FUR_FAR = [(42, 36, 34), (58, 50, 46), (68, 60, 54), (68, 60, 54)]
PLATE = [(110, 112, 116), (150, 152, 156), (186, 188, 190), (214, 216, 218)]
FACE = [(120, 108, 100), (160, 146, 134), (190, 176, 164), (190, 176, 164)]
EYE = (250, 210, 60)
CRACK = (70, 70, 74)
SHOCK = [(200, 110, 40), (250, 170, 70), (255, 230, 170)]
DUST = [(110, 100, 90), (160, 150, 136)]
WHITE = (255, 250, 236)
G = 60


def arm(cv, sh, hand, far, plate=True):
    ramp = FUR_FAR if far else FUR
    el = ik_side(sh, hand, 10, 10, forward=False)
    cv.part(chain([sh, el], [6.5, 5.5]), ramp, gloss=False)
    cv.part(chain([el, hand], [5.5, 5.0]), ramp, gloss=False)
    if plate and not far:  # 팔뚝 돌판
        mid = lerp(el, hand, 0.45)
        ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
        cv.part(poly(cv.blank(), [polar(mid, ang + 150, 4), polar(mid, ang - 150, 4), polar(mid, ang - 30, 4), polar(mid, ang + 30, 4)]), PLATE, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 3.6, 3.0), ramp, gloss=False)
    return el


def leg(cv, hip, foot, far):
    ramp = FUR_FAR if far else FUR
    knee = ik_side(hip, add(foot, (0, -1)), 6.5, 6.5, forward=True)
    cv.part(chain([hip, knee, add(foot, (0, -1))], [7, 5.5, 4.5]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 2), (f[0] + 4, f[1] - 2), (f[0] + 5, f[1]), (f[0] - 3, f[1])]), FACE, gloss=False)


def head(cv, c, tilt=0, mouth=0, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(poly(cv.blank(), [R(-1, -4), R(1, -9), R(4, -5)]), PLATE, gloss=False)  # 돌 볏
    cv.part(poly(cv.blank(), [R(-5, 3), R(-5, -3), R(-1, -5), R(4, -5), R(6, -2), R(6, 4), R(0, 6)]), FUR)
    # 주둥이(얼굴 가죽)
    if mouth:
        cv.put(poly(cv.blank(), [R(3, 3), R(9, 3), R(9, 4 + mouth), R(3, 5)]), (110, 30, 30))
        cv.part(poly(cv.blank(), [R(2, 4 + mouth), R(8, 4 + mouth), R(8, 6 + mouth), R(2, 6 + mouth)]), FACE, gloss=False)
        cv.line([rnd(R(4, 3)), rnd(R(4, 4 + mouth))], WHITE)
    cv.part(poly(cv.blank(), [R(2, -1), R(8, 0), R(9, 3), R(7, 5 if not mouth else 3), R(2, 5 if not mouth else 3)]), FACE, gloss=False)
    cv.part(poly(cv.blank(), [R(0, -3), R(7, -3), R(8, -1), R(1, -1)]), FUR, gloss=False)  # 눈두덩
    cv.pixel(*rnd(R(8, 1)), INK)
    e = rnd(R(5, 0))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] - 1, e[1], INK)
    return dict(eye=e, mouth=R(9, 4))


def ape(cv, hip=(20, 46), sh=(32, 33), hand_n=(42, 58), hand_f=(36, 58), feet=((25, 59), (15, 59)), hd=(0, 0), tilt=0, mouth=0, eye="open"):
    hc = add(sh, (7 + hd[0], -1 + hd[1]))
    arm(cv, add(sh, (-3, -1)), hand_f, True)
    leg(cv, add(hip, (-2, 0)), feet[1], True)
    # 몸통: 엉덩이에서 높은 어깨로 솟는 쐐기 + 둥근 배
    body = [add(hip, (-6, 2)), add(hip, (-6, -5)), add(sh, (-10, -3)), add(sh, (-5, -8)), add(sh, (4, -7)), add(sh, (6, 0)), add(sh, (3, 8)), add(hip, (6, 4)), add(hip, (2, 6))]
    M = cv.part(poly(cv.blank(), body), FUR)
    cv.shade_side(M, FUR[0], side=-1, depth=2)
    # 등·어깨 돌판(겹친 판석)
    for p0, p1, w in ((add(sh, (-9, -4)), add(sh, (-2, -8)), 4.5), (add(sh, (-3, -8)), add(sh, (4, -6)), 4.0), (add(hip, (-5, -5)), add(sh, (-10, -1)), 4.0)):
        cv.part(chain([p0, p1], [w, w]), PLATE, gloss=False)
    crack(cv, rnd(add(sh, (-6, -6))), [rnd(add(sh, (-5, -4)))], CRACK)
    leg(cv, add(hip, (2, 1)), feet[0], False)
    j = head(cv, hc, tilt, mouth, eye)
    arm(cv, add(sh, (1, 0)), hand_n, False)
    return j


def draw_dead(cv):
    cv.part(poly(cv.blank(), [(10, 59), (12, 50), (24, 46), (40, 47), (46, 53), (44, 59)]), FUR)
    for p0, p1 in (((15, 49), (24, 46)), ((25, 46), (36, 47))):
        cv.part(chain([p0, p1], [4, 4]), PLATE, gloss=False)
    cv.part(chain([(42, 57), (54, 58)], [4.5, 4]), FUR_FAR, gloss=False)
    cv.part(ellipse(cv.blank(), (49, 53), 5, 4.5), FUR)
    cv.part(poly(cv.blank(), [(50, 54), (56, 54), (56, 57), (50, 57)]), FACE, gloss=False)
    cv.line([(47, 51), (49, 53)], INK)
    cv.line([(49, 51), (47, 53)], INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        ape(cv)
    elif name == "idle_b":
        ape(cv, hip=(20, 47), sh=(32, 34), hd=(0, 1), tilt=4)
    elif name == "idle_c":
        ape(cv, sh=(31, 32), hand_n=(43, 58), tilt=-4, mouth=1)
    elif name == "windup":  # 일어서며 두 주먹을 높이
        j = ape(cv, hip=(20, 45), sh=(27, 26), hand_n=(34, 10), hand_f=(26, 11), feet=((24, 59), (14, 59)), tilt=-12, mouth=2)
        sparkle(cv, (38, 7), WHITE, EYE)
    elif name == "move":  # 너클 보행으로 돌진
        speed_lines(cv, 1, 7, (32, 40, 48), FUR[2])
        ape(cv, hip=(22, 44), sh=(36, 34), hand_n=(50, 58), hand_f=(42, 56), feet=((28, 58), (12, 57)), tilt=8)
        puff(cv, (10, 57), 2.4, DUST)
    elif name == "attack":  # 앞팔로 내리찍기
        ape(cv, hip=(20, 46), sh=(32, 34), hand_n=(53, 50), hand_f=(38, 58), tilt=10, mouth=3)
        burst(cv, (57, 52), 5.0, DUST[1], WHITE, spikes=7)
    elif name == "recover":  # 스킬: 일어서 가슴 두드리기
        for r, col in ((18, SHOCK[0]), (13, SHOCK[1])):
            ring(cv, (30, 30), r, -70, 70, col, width=2 if r == 18 else 1)
        ape(cv, hip=(21, 45), sh=(26, 25), hand_n=(31, 30), hand_f=(28, 32), feet=((25, 59), (15, 59)), tilt=-22, mouth=4)
        burst(cv, (33, 31), 3.5, SHOCK[1], SHOCK[2], spikes=6)
        sparkle(cv, (44, 18), WHITE, SHOCK[1], big=True)
    elif name == "hit":
        j = ape(cv, hip=(18, 46), sh=(27, 32), hand_n=(37, 56), hand_f=(30, 58), feet=((23, 59), (13, 59)), hd=(-1, -1), tilt=-20, eye="shut")
        e = j["eye"]
        for dx, dy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("ape-stone", draw, sys.argv[1:], idle_ms=240)
