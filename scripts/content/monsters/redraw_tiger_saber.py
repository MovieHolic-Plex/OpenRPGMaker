#!/usr/bin/env python3
"""검치호랑이(tiger-saber) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

네발 뼈대·자세는 회색 늑대(redraw_wolf_grey.py)를 쓰되 생김새는 고양잇과로 새로 그린다:
주황 털에 검은 줄무늬, 흰 뺨·배, 짧고 넓은 고양이 머리에 둥근 귀, 위턱에서 아래로 길게 뻗은 상아빛 검치 둘,
초록 눈, 굵은 앞발, 끝이 위로 말린 긴 꼬리(검은 고리). 6번 칸(스킬, 아키타입 brute): 뒷발로 서서 앞발 발톱 세 줄.

  python3 scripts/content/monsters/redraw_tiger_saber.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import add, chain, lerp, poly, rnd, run

W.INK = (30, 16, 10)
W.FUR = [(150, 70, 24), (204, 110, 40), (236, 150, 66), (252, 196, 120)]
W.FUR_FAR = [(104, 48, 20), (150, 70, 24), (176, 88, 32), (176, 88, 32)]
W.CREAM = [(190, 170, 140), (230, 218, 196), (246, 240, 226), (255, 252, 240)]
W.EYE, W.EYE_HI = (120, 220, 80), (230, 255, 200)
W.RAKE = [(200, 60, 40), (255, 226, 200)]
STRIPE = (40, 22, 14)
SABER = [(170, 150, 110), (230, 218, 186), (252, 246, 226), (252, 246, 226)]

_body = W.body


def body(cv, sh, hp, breath=0.0):
    M = _body(cv, sh, hp, breath)
    # 등에서 옆구리로 비스듬히 내려오는 검은 줄무늬
    for t in (0.12, 0.3, 0.48, 0.66, 0.84):
        top = add(lerp(hp, sh, t), (0, -3))
        cv.line4([top, add(top, (-1, 3)), add(top, (0, 6))], STRIPE)
    return M


def ruff(cv, sh, puffed=0.0):
    """고양잇과는 갈기가 없다: 굵은 어깨 근육 덩어리 + 줄무늬 둘."""
    pts = [add(sh, (-5, -3)), add(sh, (-1, -6 - puffed * 0.5)), add(sh, (5, -5)), add(sh, (9, -1)),
           add(sh, (9, 5)), add(sh, (5, 9)), add(sh, (0, 6)), add(sh, (-4, 3))]
    cv.part(poly(cv.blank(), pts), W.FUR)
    cv.line4([add(sh, (2, -4)), add(sh, (1, 0))], STRIPE)
    cv.line4([add(sh, (6, -2)), add(sh, (5, 2))], STRIPE)
    cv.line4([add(sh, (7, 4)), add(sh, (5, 8))], W.CREAM[2])


def tail(cv, hp, lift=0.0):
    """길게 늘어졌다가 끝이 위로 말리는 꼬리, 검은 고리 셋."""
    root = add(hp, (-5, -1))
    p1 = add(root, (-5, 5 - lift))
    p2 = add(root, (-10, 6 - lift * 2))
    tip = add(root, (-13, 1 - lift * 2.6))
    M = cv.part(chain([root, p1, p2, tip], [3.0, 2.6, 2.4, 2.2]), W.FUR)
    for p in (lerp(root, p1, 0.6), lerp(p1, p2, 0.6), tip):
        cv.pixel(*rnd(p), STRIPE)
        cv.pixel(*rnd(add(p, (0, 1))), STRIPE)
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    """넓고 짧은 고양이 머리, 둥근 귀, 아래로 길게 뻗은 검치."""
    P = lambda *pts: W.xf(neck, tilt, pts)
    jaw_o = P((3, 4))[0]
    jaw = W.xf(jaw_o, mouth, [(0, -1), (8, 0), (8, 2), (1, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((3, 2), (11, 1)) + [jaw[1], jaw[0]]), W.MOUTH)
    cv.part(poly(cv.blank(), jaw), W.CREAM, gloss=False)
    skull = P((-4, -4), (2, -7), (8, -6), (12, -3), (13, 1), (11, 3), (3, 5), (-4, 4))
    cv.part(poly(cv.blank(), skull), W.FUR)
    # 흰 뺨(주둥이 둘레) + 이마 줄무늬
    cv.put(poly(cv.blank(), P((5, 0), (12, 0), (12, 3), (4, 4))), W.CREAM[2])
    for a, b in (((2, -6), (3, -3)), ((5, -6), (5, -4)), ((-2, -2), (1, 0))):
        cv.line4([P(a)[0], P(b)[0]], STRIPE)
    # 둥근 귀(먼 귀 + 가까운 귀)
    e = ears
    cv.part(poly(cv.blank(), P((-3, -4), (-4 - e * 3, -9 + e * 2), (-1, -10 + e * 3), (1, -6))), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), P((1, -6), (0 - e * 3, -11 + e * 3), (3, -12 + e * 3), (5, -6))), W.FUR, gloss=False)
    cv.pixel(*rnd(P((2 - e * 2, -9 + e * 2))[0]), W.CREAM[0])
    cv.pixel(*rnd(P((13, -1))[0]), W.NOSE)
    # 검치: 위턱에서 아래로 길게(mouth 가 벌어져도 위턱을 따른다)
    for x, ln, col in ((7, 5, SABER[1]), (10, 8, SABER[2])):
        root = P((x, 3))[0]
        tip = P((x - 1, 3 + ln))[0]
        cv.line4([root, tip], col)
        cv.pixel(*rnd(tip), SABER[0])
    ey = P((7, -3))[0]
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 1))], W.INK)
    else:
        cv.pixel(*rnd(ey), W.EYE)
        cv.pixel(*rnd(add(ey, (1, 0))), W.EYE_HI)
        cv.line([add(ey, (-1, -1)), add(ey, (2, -1))], W.INK)
    return dict(snout=P((14, 1))[0], mouth=lerp(P((11, 2))[0], jaw[1], 0.5))


W.body, W.ruff, W.tail, W.head = body, ruff, tail, head


def draw_dead(cv):
    """옆으로 쓰러진 호랑이: 다리를 뻗고 검치가 땅에 닿는다."""
    cv.part(chain([(14, 56), (7, 57), (3, 54)], [3, 2.6, 2.2]), W.FUR, gloss=False)
    cv.pixel(3, 54, STRIPE)
    for hip, foot in (((20, 56), (25, 51)), ((25, 57), (31, 56)), ((36, 56), (42, 51)), ((39, 57), (46, 56))):
        cv.part(chain([hip, foot], [3, 2.4]), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(12, 56), (18, 49), (36, 48), (42, 52), (42, 59), (14, 59)]), W.FUR)
    for x in (18, 23, 28, 33, 38):
        cv.line4([(x, 49), (x - 1, 52), (x, 55)], STRIPE)
    cv.put(poly(cv.blank(), [(18, 58), (36, 58), (40, 55), (20, 56)]), W.CREAM[1])
    cv.part(poly(cv.blank(), [(40, 50), (47, 49), (54, 52), (54, 57), (42, 59)]), W.FUR)
    cv.put(poly(cv.blank(), [(47, 55), (54, 54), (54, 57), (45, 58)]), W.CREAM[2])
    cv.part(poly(cv.blank(), [(42, 50), (41, 45), (45, 49)]), W.FUR_FAR, gloss=False)
    cv.part(chain([(52, 57), (55, 59)], [1.4, 0.6]), SABER, gloss=False)
    cv.line([(46, 51), (48, 53)], W.INK)
    cv.line([(48, 51), (46, 53)], W.INK)
    cv.pixel(54, 53, W.NOSE)
    for x, y in ((24, 46), (6, 50)):
        W.puff(cv, (x, y), 2.2, W.DUST)


W.draw_dead = draw_dead


if __name__ == "__main__":
    run("tiger-saber", W.draw, sys.argv[1:], idle_ms=190)
