#!/usr/bin/env python3
"""풀잎 여우(leaf-fox) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

여우는 개과라 회색 늑대 네발 뼈대(redraw_wolf_grey.py)를 쓰되 생김새를 새로: 늑대보다 가는 몸과 다리, 가늘고 뾰족한 긴 주둥이,
크고 뾰족한 세모 귀(안쪽 크림), 머리 안의 호박색 눈, 주황 털에 흰 턱·가슴, 검은 발목 양말, 몸만큼 큰 복슬 꼬리.
목둘레·꼬리 끝에 초록 잎이 털처럼 돋아 있다(갈기 대신 잎 목도리).
6번 칸(스킬 잎새 폭풍): 꼬리를 크게 휘둘러 날카로운 초록 잎 회오리를 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_leaf_fox.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import Canvas, add, bezier, chain, ellipse, lerp, poly, rnd, run, sparkle

W.INK = (40, 18, 8)
W.FUR = [(176, 80, 24), (220, 116, 40), (244, 156, 70), (255, 196, 120)]
W.FUR_FAR = [(130, 58, 18), (176, 80, 24), (196, 92, 30), (196, 92, 30)]
W.CREAM = [(210, 200, 180), (240, 234, 220), (252, 250, 244), (255, 255, 250)]
W.EYE, W.EYE_HI = (240, 170, 40), (255, 240, 200)
SOCK = (40, 26, 22)
LEAF = [(50, 120, 40), (90, 170, 60), (150, 214, 100), (190, 240, 150)]
WHITE = (255, 255, 240)

_body = W.body
W.BASE = dict(W.BASE, sh=(38.0, 39.0), hp=(21.0, 39.0))


def leg(cv, hip, foot, far=False, front=True):
    ramp = W.FUR_FAR if far else W.FUR
    foot = add(foot, (0, -1))
    if front:
        knee = W.ik_side(hip, foot, 7.0, 7.5, forward=False)
        cv.part(chain([hip, knee], [3.6, 2.2]), ramp, gloss=False)
        cv.part(chain([knee, foot], [2.0, 1.8]), [SOCK] * 4, gloss=False)
    else:
        hock = add(foot, (-3, -5))
        knee = W.ik_side(hip, hock, 6.5, 5.0, forward=True)
        cv.part(chain([hip, knee], [5.0, 2.8]), ramp, gloss=False)
        cv.part(chain([knee, hock, foot], [2.4, 1.8, 1.8]), [SOCK] * 4, gloss=False)
    f = rnd(foot)
    cv.put(poly(cv.blank(), [(f[0] - 1, f[1] - 1), (f[0] + 2, f[1] - 1), (f[0] + 2, f[1] + 1), (f[0] - 1, f[1] + 1)]), SOCK)
    return foot


W.leg = leg


def ruff(cv, sh, puffed=0.0):
    """흰 가슴 + 잎 목도리."""
    cv.part(poly(cv.blank(), [add(sh, (-2, -3)), add(sh, (4, -4)), add(sh, (8, 0)), add(sh, (7, 6)), add(sh, (2, 7)), add(sh, (-1, 3))]), W.FUR)
    cv.put(poly(cv.blank(), [add(sh, (4, -1)), add(sh, (8, 1)), add(sh, (6, 6)), add(sh, (3, 5))]), W.CREAM[2])
    for dx, dy in ((-3, -3), (0, -5 - puffed), (3, -5 - puffed)):
        p = add(sh, (dx, dy))
        cv.part(poly(cv.blank(), [add(p, (-2, 1)), add(p, (0, -3)), add(p, (2, 1))]), LEAF, gloss=False)


def tail(cv, hp, lift=0.0):
    """몸만큼 큰 복슬 꼬리, 끝에 잎."""
    root = add(hp, (-4, -1))
    pts = bezier(root, add(root, (-10, 2 - lift)), add(root, (-15, -10 - lift * 2)), 6)
    M = cv.part(chain(pts, [4, 6, 7.5, 8, 7.5, 6, 4]), W.FUR)
    tip = pts[-1]
    cv.part(ellipse(cv.blank(), tip, 3, 3), [W.CREAM[1]] * 4, gloss=False)
    cv.part(poly(cv.blank(), [add(tip, (-2, -1)), add(tip, (0, -6)), add(tip, (3, -1))]), LEAF, gloss=False)
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    P = lambda *pts: W.xf(neck, tilt, pts)
    jaw_o = P((4, 3))[0]
    jaw = W.xf(jaw_o, mouth, [(0, -1), (8, 0), (8, 1.5), (1, 2.5)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 1), (12, 1)) + [jaw[1], jaw[0]]), W.MOUTH)
        cv.pixel(*rnd(lerp(P((10, 1))[0], jaw[1], 0.3)), W.FANG)
    cv.part(poly(cv.blank(), jaw), W.CREAM, gloss=False)
    skull = P((-4, -1), (-2, -5), (3, -6), (7, -3), (13, 0), (13, 2), (6, 3), (0, 4), (-4, 3))
    cv.part(poly(cv.blank(), skull), W.FUR)
    cv.put(poly(cv.blank(), P((5, 1), (12, 1), (12, 3), (4, 3))), W.CREAM[2])
    cv.pixel(*rnd(P((13, 0))[0]), SOCK)  # 코
    e = ears
    cv.part(poly(cv.blank(), P((-3, -3), (-5 - e * 3, -12 + e * 3), (1, -5))), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), P((0, -5), (1 - e * 4, -14 + e * 4), (5, -5))), W.FUR, gloss=False)
    cv.line4([rnd(P((1.5, -6))[0]), rnd(P((1.5 - e * 3, -10 + e * 3))[0])], W.CREAM[1])
    ey = P((5, -2))[0]
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 1))], W.INK)
    else:
        cv.put(poly(cv.blank(), [add(rnd(ey), (-1, 0)), add(rnd(ey), (1, 0)), add(rnd(ey), (1, 1)), add(rnd(ey), (-1, 1))]), W.EYE)
        cv.pixel(*add(rnd(ey), (1, 0)), W.INK)
    return dict(snout=P((14, 1))[0], mouth=lerp(P((10, 2))[0], jaw[1], 0.5))


W.ruff, W.tail, W.head = ruff, tail, head


def draw_dead(cv):
    tail(cv, (18, 54), -6)
    for h, f in (((22, 56), (28, 52)), ((34, 56), (40, 52))):
        cv.part(chain([h, f], [2.4, 2]), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(14, 58), (18, 51), (34, 50), (40, 53), (40, 59), (14, 59)]), W.FUR)
    cv.part(poly(cv.blank(), [(40, 58), (42, 51), (48, 50), (56, 54), (56, 57), (44, 59)]), W.FUR)
    cv.part(poly(cv.blank(), [(42, 51), (40, 44), (46, 50)]), W.FUR_FAR, gloss=False)
    cv.line([(45, 52), (47, 54)], W.INK)
    cv.line([(47, 52), (45, 54)], W.INK)


def draw_storm(cv):
    """꼬리를 크게 휘두르며 잎 회오리."""
    P = W.params("attack")
    P.update(sh=(34.0, 40.0), hp=(18.0, 39.0), tilt=-4, mouth=6, lift=6)
    j = W.draw_wolf(cv, P)
    for k, p in enumerate(((48, 26), (54, 32), (60, 24), (57, 42), (50, 46), (61, 35), (45, 36))):
        cv.part(poly(cv.blank(), [add(p, (-2, 1)), add(p, (0, -2)), add(p, (3, -1)), add(p, (1, 2))]), LEAF, gloss=False)
    sparkle(cv, (56, 18), WHITE, LEAF[2], big=True)


def draw(name):
    if name == "dead":
        cv = Canvas(64, W.INK)
        draw_dead(cv)
        return cv.image()
    if name == "recover":
        cv = Canvas(64, W.INK)
        draw_storm(cv)
        return cv.image()
    return W.draw(name)


if __name__ == "__main__":
    run("leaf-fox", draw, sys.argv[1:], idle_ms=190)
