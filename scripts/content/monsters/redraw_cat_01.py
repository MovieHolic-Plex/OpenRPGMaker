#!/usr/bin/env python3
"""황갈색 줄무늬 고양이(cat-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

네발 뼈대·자세는 회색 늑대(redraw_wolf_grey.py)를 쓰되 생김새는 집고양이로 새로 그린다:
작고 둥근 머리에 짧은 코(주둥이가 거의 없다), 큰 초록 눈과 세로 동공, 삼각형 큰 귀, 수염,
황갈색 털에 등에서 내려오는 갈색 줄무늬, 흰 가슴, 길게 S 자로 휘어 끝이 위로 서는 꼬리, 가는 몸.
6번 칸(스킬 냥냥 펀치): 엉덩이를 치켜들고 몸을 낮춘 채 앞발을 번갈아 휘둘러 앞에 발자국 충격 셋을 찍는다.

  python3 scripts/content/monsters/redraw_cat_01.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, poly, rnd, run, sparkle

W.INK = (36, 22, 12)
W.FUR = [(150, 96, 44), (196, 136, 68), (226, 172, 100), (246, 210, 150)]
W.FUR_FAR = [(110, 70, 32), (150, 96, 44), (172, 112, 52), (172, 112, 52)]
W.CREAM = [(200, 186, 160), (236, 228, 210), (250, 246, 236), (255, 255, 250)]
W.EYE, W.EYE_HI = (120, 200, 70), (230, 255, 200)
STRIPE = (110, 62, 26)
PUPIL = (20, 16, 10)
WHISKER = (250, 246, 236)
PAW = [(220, 120, 90), (255, 200, 170), (255, 250, 240)]

_body = W.body
W.BASE = dict(W.BASE, sh=(38.0, 40.0), hp=(20.0, 40.0))


def leg(cv, hip, foot, far=False, front=True):
    """고양이 다리: 늑대보다 가늘고, 발이 작고 둥글다(발톱을 숨긴다)."""
    ramp = W.FUR_FAR if far else W.FUR
    foot = add(foot, (0, -1))
    if front:
        knee = W.ik_side(hip, foot, 7.0, 7.0, forward=False)
        cv.part(chain([hip, knee], [3.4, 2.2]), ramp, gloss=False)
        cv.part(chain([knee, foot], [2.2, 1.8]), ramp, gloss=False)
    else:
        hock = add(foot, (-3, -5))
        knee = W.ik_side(hip, hock, 6.5, 5.0, forward=True)
        cv.part(chain([hip, knee], [5.0, 2.8]), ramp, gloss=False)
        cv.part(chain([knee, hock], [2.8, 1.8]), ramp, gloss=False)
        cv.part(chain([hock, foot], [1.8, 1.8]), ramp, gloss=False)
    f = rnd(foot)
    cv.put(poly(cv.blank(), [(f[0] - 1, f[1] - 1), (f[0] + 1, f[1] - 1), (f[0] + 2, f[1] + 1), (f[0] - 1, f[1] + 1)]), ramp[1] if far else W.CREAM[2])
    return knee


W.leg = leg


def body(cv, sh, hp, breath=0.0):
    # 고양이는 몸이 가늘다: 늑대 몸 위에 흰 가슴과 줄무늬만 더한다(갈기 없음)
    M = _body(cv, sh, hp, breath)
    for t in (0.15, 0.35, 0.55, 0.75):
        top = add(lerp(hp, sh, t), (0, -3))
        cv.line4([top, add(top, (1, 3)), add(top, (0, 5))], STRIPE)
    return M


def ruff(cv, sh, puffed=0.0):
    """갈기 대신 흰 가슴털 + 어깨 줄무늬 하나."""
    pts = [add(sh, (-3, -3)), add(sh, (3, -5 - puffed)), add(sh, (8, -2)), add(sh, (8, 5)), add(sh, (4, 8)), add(sh, (-1, 4))]
    cv.part(poly(cv.blank(), pts), W.FUR)
    cv.put(poly(cv.blank(), [add(sh, (5, -1)), add(sh, (8, 1)), add(sh, (7, 6)), add(sh, (4, 7)), add(sh, (4, 2))]), W.CREAM[2])
    cv.line4([add(sh, (1, -3)), add(sh, (0, 1))], STRIPE)


def tail(cv, hp, lift=0.0):
    """S 자로 휘어 끝이 위로 서는 긴 꼬리, 갈색 고리."""
    root = add(hp, (-5, -1))
    pts = bezier(root, add(root, (-10, 6 - lift)), add(root, (-9, -10 - lift * 2)), 8)
    M = cv.part(chain(pts, [3.2, 3.0, 3.0, 2.8, 2.8, 2.6, 2.6, 2.4, 2.4]), W.FUR)
    for k in (2, 4, 6, 8):
        cv.pixel(*rnd(pts[k]), STRIPE)
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    """둥글고 작은 고양이 머리: 짧은 코, 큰 눈(세로 동공), 큰 삼각 귀, 수염."""
    P = lambda *pts: W.xf(neck, tilt, pts)
    jaw_o = P((4, 4))[0]
    jaw = W.xf(jaw_o, mouth, [(0, -1), (5, 0), (5, 2), (1, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 2), (9, 2)) + [jaw[1], jaw[0]]), W.MOUTH)
    cv.part(poly(cv.blank(), jaw), W.CREAM, gloss=False)
    skull = P((-4, -2), (-2, -6), (3, -7), (8, -5), (10, -1), (10, 2), (6, 4), (0, 5), (-4, 3))
    cv.part(poly(cv.blank(), skull), W.FUR)
    cv.put(poly(cv.blank(), P((6, 1), (10, 1), (9, 4), (5, 4))), W.CREAM[2])  # 흰 주둥이
    for a, b in (((1, -6), (2, -4)), ((4, -7), (4, -5))):
        cv.line4([P(a)[0], P(b)[0]], STRIPE)
    e = ears
    cv.part(poly(cv.blank(), P((-3, -3), (-4 - e * 4, -11 + e * 4), (1, -6))), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), P((1, -6), (2 - e * 5, -13 + e * 5), (6, -6))), W.FUR, gloss=False)
    cv.pixel(*rnd(P((2.5 - e * 3, -8 + e * 3))[0]), PAW[1])
    cv.pixel(*rnd(P((10, 0))[0]), PAW[0])  # 분홍 코
    for dy in (1, 3):  # 수염
        cv.line4([P((9, dy))[0], P((14, dy - 1 + (dy > 2)))[0]], WHISKER)
    ey = P((6, -2))[0]
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 1))], W.INK)
    else:
        cv.put(poly(cv.blank(), [add(rnd(ey), (-1, -1)), add(rnd(ey), (1, -1)), add(rnd(ey), (1, 1)), add(rnd(ey), (-1, 1))]), W.EYE)
        cv.line([rnd(ey), add(rnd(ey), (0, 1))], PUPIL)
        cv.pixel(*add(rnd(ey), (1, -1)), W.EYE_HI)
    return dict(snout=P((11, 1))[0], mouth=lerp(P((8, 2))[0], jaw[1], 0.5))


W.body, W.ruff, W.tail, W.head = body, ruff, tail, head


def draw_dead(cv):
    cv.part(chain(bezier((14, 56), (6, 58), (3, 52), 5), [3, 2.8, 2.6, 2.4, 2.2, 2]), W.FUR, gloss=False)
    for hip, foot in (((20, 56), (24, 52)), ((25, 57), (30, 56)), ((34, 56), (39, 52)), ((37, 57), (43, 56))):
        cv.part(chain([hip, foot], [2.6, 2.2]), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(13, 56), (18, 50), (34, 49), (40, 52), (40, 59), (14, 59)]), W.FUR)
    for x in (19, 24, 29, 34):
        cv.line4([(x, 50), (x + 1, 53)], STRIPE)
    cv.part(ellipse(cv.blank(), (46, 54), 6, 5), W.FUR)
    cv.part(poly(cv.blank(), [(42, 50), (41, 44), (46, 49)]), W.FUR_FAR, gloss=False)
    cv.line([(45, 52), (47, 54)], W.INK)
    cv.line([(47, 52), (45, 54)], W.INK)
    cv.pixel(52, 54, PAW[0])


def draw_punch(cv):
    """엉덩이를 치켜든 낮은 자세 + 앞발 연타 → 앞에 분홍 발자국 충격 셋."""
    P = W.params("windup")
    P.update(sh=(32.0, 44.0), hp=(16.0, 38.0), tilt=6, mouth=10, ears=0.4, feet=((42, -8), (35, 0), (16, 0), (10, 0)), lift=-1)
    j = W.draw_wolf(cv, P)
    paw = (43, 50)
    for k, (x, y) in enumerate(((52, 52), (56, 44), (59, 51))):
        cv.line4([paw, (x, y)], PAW[1])
        cv.put(ellipse(cv.blank(), (x, y), 2.2, 2.0), PAW[0])
        for dx, dy in ((-2, -2), (0, -3), (2, -2)):
            cv.pixel(x + dx, y + dy, PAW[0])
        cv.pixel(x, y, PAW[2])
    sparkle(cv, add(j["snout"], (0, -8)), PAW[2], W.EYE)


def draw(name):
    if name == "dead":
        cv = Canvas(64, W.INK)
        draw_dead(cv)
        return cv.image()
    if name == "recover":
        cv = Canvas(64, W.INK)
        draw_punch(cv)
        return cv.image()
    return W.draw(name)


if __name__ == "__main__":
    run("cat-01", draw, sys.argv[1:], idle_ms=200)
