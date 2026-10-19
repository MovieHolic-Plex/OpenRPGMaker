#!/usr/bin/env python3
"""그림자 고양이(cat-shadow) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

고양이 머리·다리(redraw_cat_01.py)와 늑대 네발 뼈대를 쓰되 생김새·자세를 바꿨다: 짙은 보랏빛 털에 더 짙은
줄무늬, 금빛 눈, 몸을 땅에 붙이듯 낮게 웅크린 기는 자세(배가 바닥 가까이), 위로 말아 올린 긴 꼬리 끝에서
그림자 연기가 피어오른다. 집고양이(cat-01)의 선 자세·흰 가슴과 달리 몸이 길고 낮다.
6번 칸(스킬 그림자 발톱): 몸이 그림자 연기로 풀리며 앞발에서 보라 그림자 발톱 세 줄이 길게 뻗는다.

  python3 scripts/content/monsters/redraw_cat_shadow.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_cat_01 as C
import redraw_wolf_grey as W
from pixel_lib import Canvas, add, bezier, chain, ellipse, poly, puff, rnd, run, slash, sparkle

W.INK = (14, 8, 22)
W.FUR = [(56, 36, 86), (86, 60, 124), (120, 92, 166), (156, 130, 204)]
W.FUR_FAR = [(32, 20, 52), (46, 30, 70), (58, 38, 86), (58, 38, 86)]
W.CREAM = [(70, 48, 102), (98, 72, 136), (130, 104, 170), (160, 136, 196)]
W.EYE, W.EYE_HI = (250, 200, 40), (255, 250, 200)
C.STRIPE = (24, 14, 38)
C.WHISKER = (150, 130, 190)
C.PAW = [(140, 90, 200), (200, 160, 250), (255, 240, 255)]
SMOKE = [(96, 70, 140), (150, 124, 196)]
SHADE = [(90, 40, 160), (190, 140, 255)]

# 낮게 기는 자세: 어깨·엉덩이를 바닥 가까이, 몸을 길게
_params = W.params


def params(name):
    p = _params(name)
    # 모든 자세를 같은 양만큼 낮추고 몸을 늘린다(어깨는 더 낮게 — 사냥감을 노리는 자세)
    p["sh"] = (p["sh"][0] + 2, p["sh"][1] + 6)
    p["hp"] = (p["hp"][0] - 2, p["hp"][1] + 4)
    p["tilt"] = p["tilt"] + 4
    p["lift"] = p.get("lift", 0) + 3
    return p


W.params = params
_tail = W.tail


def tail(cv, hp, lift=0.0):
    """위로 높이 말아 올린 꼬리 + 끝에서 피어오르는 그림자 연기."""
    root = add(hp, (-5, -1))
    pts = bezier(root, add(root, (-11, -2 - lift)), add(root, (-6, -16 - lift)), 8)
    M = cv.part(chain(pts, [3.0, 3.0, 2.8, 2.8, 2.6, 2.6, 2.6, 2.8, 3.2]), W.FUR)
    for k in (3, 5, 7):
        cv.pixel(*rnd(pts[k]), C.STRIPE)
    puff(cv, add(pts[-1], (1, -2)), 2.2, SMOKE)
    return M


W.tail = tail


def draw_dead(cv):
    C.draw_dead(cv)
    puff(cv, (24, 47), 2.6, SMOKE)
    cv.line4([(24, 49), (24, 51)], SMOKE[1])


def draw_shadow_claw(cv):
    P = W.params("attack")
    P.update(mouth=20, tilt=0)
    j = W.draw_wolf(cv, P)
    s = j["snout"]
    paw = add(s, (-3, 10))
    for k, dy in enumerate((-8, -2, 4)):
        slash(cv, add(paw, (-2, dy - 6)), (61, dy + paw[1] + 2), 3, 3.0, SHADE[0], SHADE[1])
    puff(cv, add(paw, (-6, 2)), 3.0, SMOKE)
    sparkle(cv, add(s, (-4, -8)), W.EYE_HI, W.EYE)


def draw(name):
    if name == "dead":
        cv = Canvas(64, W.INK)
        draw_dead(cv)
        return cv.image()
    if name == "recover":
        cv = Canvas(64, W.INK)
        draw_shadow_claw(cv)
        return cv.image()
    return W.draw(name)


if __name__ == "__main__":
    run("cat-shadow", draw, sys.argv[1:], idle_ms=200)
