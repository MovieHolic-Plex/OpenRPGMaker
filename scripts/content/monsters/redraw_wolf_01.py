#!/usr/bin/env python3
"""은회색 큰 늑대(wolf-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

회색 늑대(redraw_wolf_grey.py)의 네발 뼈대를 쓰되 몸을 더 크고 무겁게 바꿨다: 은회색 털에 검은 안장 무늬,
앞으로 넓게 부푼 은빛 가슴털(목에서 무릎까지), 각지고 굵은 긴 주둥이(사각 코끝), 굵은 발목과 큰 앞발,
푸른 눈, 짧고 뭉툭한 귀. 회색 늑대의 갈기 삐침 대신 가슴털이 실루엣을 만든다.
6번 칸(스킬 달 울음): 고개를 하늘로 젖혀 길게 울부짖어 푸른 음파 고리와 서리 별빛이 퍼진다.

  python3 scripts/content/monsters/redraw_wolf_01.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import Canvas, add, chain, lerp, poly, ring, rnd, run, sparkle

W.INK = (18, 20, 30)
W.FUR = [(96, 104, 120), (146, 154, 170), (190, 198, 210), (228, 234, 242)]
W.FUR_FAR = [(64, 70, 84), (96, 104, 120), (116, 124, 140), (116, 124, 140)]
W.CREAM = [(176, 184, 196), (220, 226, 236), (240, 244, 250), (255, 255, 255)]
W.EYE, W.EYE_HI = (90, 170, 250), (220, 240, 255)
SADDLE = (44, 46, 58)
HOWL = [(90, 150, 230), (180, 220, 255), (255, 255, 255)]

W.BASE = dict(W.BASE, sh=(39.0, 36.0), hp=(19.0, 37.0))
_body, _leg = W.body, W.leg


def body(cv, sh, hp, breath=0.0):
    M = _body(cv, sh, hp, breath)
    # 등의 검은 안장(어깨 뒤에서 허리까지)
    cv.put(poly(cv.blank(), [add(hp, (-2, -3)), add(lerp(hp, sh, 0.5), (0, -4)), add(sh, (-3, -5)), add(sh, (-4, -2)),
                             add(lerp(hp, sh, 0.5), (0, -1)), add(hp, (-1, 0))]) , SADDLE)
    return M


def ruff(cv, sh, puffed=0.0):
    """앞으로 넓게 부푼 은빛 가슴털(목에서 앞다리 무릎까지 내려온다)."""
    pts = [add(sh, (-3, -4)), add(sh, (3, -6 - puffed)), add(sh, (9, -3)), add(sh, (12, 3)), add(sh, (11, 8)),
           add(sh, (9, 11)), add(sh, (6, 9)), add(sh, (4, 12)), add(sh, (1, 7)), add(sh, (-2, 4))]
    cv.part(poly(cv.blank(), pts), W.CREAM)
    for a, b in (((7, 3), (9, 8)), ((4, 5), (5, 9)), ((9, -1), (11, 4))):
        cv.line4([add(sh, a), add(sh, b)], W.FUR[1])


def leg(cv, hip, foot, far=False, front=True):
    knee = _leg(cv, hip, foot, far, front)
    # 굵은 발목: 발 위에 털 뭉치
    f = rnd(add(foot, (0, -3)))
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 1), (f[0] + 2, f[1] - 1), (f[0] + 3, f[1] + 2), (f[0] - 2, f[1] + 2)]),
            W.FUR_FAR if far else W.FUR, gloss=False)
    return knee


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    """각지고 굵은 주둥이(사각 코끝), 짧고 뭉툭한 귀, 푸른 눈."""
    P = lambda *pts: W.xf(neck, tilt, pts)
    jaw_o = P((4, 4))[0]
    jaw = W.xf(jaw_o, mouth, [(0, -1), (11, -1), (10, 1), (1, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 2), (16, 2)) + [jaw[1], jaw[0]]), W.MOUTH)
    cv.part(poly(cv.blank(), jaw), W.FUR, gloss=False)
    skull = P((-5, -4), (1, -8), (6, -7), (8, -4), (16, -2), (17, 1), (15, 3), (6, 4), (-4, 5))
    cv.part(poly(cv.blank(), skull), W.FUR)
    cv.put(poly(cv.blank(), P((6, 3), (14, 3), (14, 3), (5, 4))), W.CREAM[2])
    cv.line4([P((2, -6))[0], P((10, -4))[0]], SADDLE)  # 이마 짙은 줄
    e = ears
    cv.part(poly(cv.blank(), P((-4, -4), (-4 - e * 3, -10 + e * 3), (0, -6))), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), P((-1, -6), (0 - e * 4, -11 + e * 4), (4, -6))), W.FUR, gloss=False)
    for p in ((17, -1), (16, -2), (17, 0)):
        cv.pixel(*rnd(P(p)[0]), W.NOSE)
    for x in (13, 9):
        cv.pixel(*rnd(P((x, 3))[0]), W.FANG)
    ey = P((6, -3))[0]
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 1))], W.INK)
    else:
        cv.pixel(*rnd(ey), W.EYE)
        cv.pixel(*rnd(add(ey, (1, 0))), W.EYE_HI)
        cv.line([add(ey, (-1, -1)), add(ey, (2, -1))], W.INK)
    return dict(snout=P((18, 0))[0], mouth=lerp(P((16, 2))[0], jaw[1], 0.5))


W.body, W.ruff, W.leg, W.head = body, ruff, leg, head


def draw_howl(cv):
    """앞다리를 버티고 앉아 고개를 하늘로 젖혀 운다 → 음파 고리 + 서리 별빛."""
    P = W.params("idle_a")
    P.update(sh=(36.0, 36.0), hp=(18.0, 44.0), tilt=-62, mouth=18, eye="shut", ears=0.6, feet=((42, 0), (37, 0), (22, 0), (15, 0)), lift=-3)
    j = W.draw_wolf(cv, P)
    s = j["snout"]
    for r, col in ((5, HOWL[2]), (9, HOWL[1]), (13, HOWL[0])):
        ring(cv, s, r, -110, -10, col)
    cv.line4([s, add(s, (9, -9))], HOWL[1])
    for p in ((54, 8), (58, 16), (48, 4)):
        sparkle(cv, p, HOWL[2], HOWL[0])


def draw_dead(cv):
    W_dead(cv)
    cv.line4([(16, 52), (26, 50), (34, 50)], SADDLE)


W_dead = W.draw_dead


def draw(name):
    if name == "recover":
        cv = Canvas(64, W.INK)
        draw_howl(cv)
        return cv.image()
    if name == "dead":
        cv = Canvas(64, W.INK)
        draw_dead(cv)
        return cv.image()
    return W.draw(name)


if __name__ == "__main__":
    run("wolf-01", draw, sys.argv[1:], idle_ms=190)
