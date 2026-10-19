#!/usr/bin/env python3
"""초록 큐브 슬라임(slime-cube) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

반투명 초록 젤리 정육면체: 앞면(오른쪽, 얼굴)·윗면·뒤 옆면 세 면이 보이고 면마다 밝기가 다르다.
모서리마다 밝은 반사 띠, 몸속에 갇힌 뼈 조각(넓적다리뼈·두개골), 앞면에 눈 둘과 네모 입.
움직임은 면이 기우는 전단(shear)과 눌림으로 표현한다.
6번 칸(스킬 삼키기): 앞면이 크게 벌어져 네모난 입이 되고, 입 앞으로 끈적한 점액 판을 뻗어 감싼다.

  python3 scripts/content/monsters/redraw_slime_cube.py [--preview DIR]
"""
from __future__ import annotations

import sys

from jelly_rig import beads
from pixel_lib import Canvas, add, burst, ellipse, poly, rnd, run

INK = (16, 46, 26)
FRONT = [(56, 150, 70), (86, 186, 92), (126, 214, 120), (200, 246, 190)]
TOP = [(110, 210, 110), (150, 232, 140), (190, 246, 176), (230, 255, 220)]
SIDE = [(36, 108, 52), (50, 130, 62), (70, 156, 80), (70, 156, 80)]
EDGE = (226, 255, 220)
BONE = (236, 228, 196)
BONE_SH = (176, 166, 132)
EYE = (12, 30, 16)
MOUTH = (24, 70, 34)
GOO = [(90, 190, 90), (170, 240, 160), (240, 255, 236)]
GROUND = 59


def cube(cv, x0, w, h, d=7, shear=0.0, eye="open", mouth=0):
    """x0 = 앞면 왼쪽 아래 x. 앞면 w×h, 깊이 d(뒤·위로 비스듬). shear 는 윗변이 앞으로 밀리는 양."""
    b = GROUND
    fl, fr = (x0, b), (x0 + w, b)
    tl, tr = (x0 + shear, b - h), (x0 + w + shear, b - h)
    bl, btl, btr = (x0 - d, b - d * 0.6), (x0 - d + shear, b - h - d * 0.6), (x0 + w - d + shear, b - h - d * 0.6)
    cv.part(poly(cv.blank(), [bl, fl, tl, btl]), SIDE, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [btl, tl, tr, btr]), TOP, ink=INK, gloss=False)
    M = cv.part(poly(cv.blank(), [fl, fr, tr, tl]), FRONT, ink=INK, gloss=False)
    # 갇힌 뼈: 넓적다리뼈(사선) + 작은 두개골(뒤 옆면 쪽)
    cx, cy = x0 + w * 0.32 + shear * 0.5, b - h * 0.4
    for p, q in (((cx - 4, cy + 3), (cx + 3, cy - 2)),):
        cv.line([rnd(p), rnd(q)], BONE)
        for e in (p, q):
            cv.pixel(*rnd(add(e, (0, -1))), BONE)
            cv.pixel(*rnd(add(e, (1, 0))), BONE_SH)
    s = rnd((x0 - d * 0.5 + shear * 0.6, b - h * 0.55 - d * 0.3))
    cv.put(ellipse(cv.blank(), s, 2.0, 1.6), BONE)
    cv.pixel(s[0], s[1], BONE_SH)
    cv.pixel(s[0] + 1, s[1], BONE_SH)
    # 모서리 반사: 윗면 앞 모서리 + 앞면 왼 모서리
    cv.line([rnd(add(tl, (1, 1))), rnd(add(tr, (-2, 1)))], EDGE)
    cv.line([rnd(add(tl, (1, 3))), rnd(add(fl, (1, -4)))], FRONT[2])
    # 얼굴(앞면 오른쪽)
    ex = x0 + w * 0.62 + shear * 0.6
    ey = b - h * 0.62
    for k, e in enumerate(((ex, ey), (ex + 6, ey))):
        e = rnd(e)
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
        else:
            top = -2 if eye == "open" else -1 + (0 if k else 0)
            cv.put(poly(cv.blank(), [add(e, (-1, top)), add(e, (1, top - (1 if eye == "angry" and k == 0 else 0))), add(e, (1, 2)), add(e, (-1, 2))]), EYE)
            cv.pixel(e[0], e[1] - 1, (255, 255, 255))
    m = rnd((ex + 3, ey + 7))
    if mouth >= 2:
        cv.put(poly(cv.blank(), [add(m, (-4, -1)), add(m, (4, -1)), add(m, (4, mouth + 1)), add(m, (-4, mouth + 1))]), MOUTH)
        for dx in (-3, 3):
            cv.pixel(m[0] + dx, m[1], BONE)
    elif mouth == 1:
        cv.line([add(m, (-3, 0)), add(m, (3, 0))], MOUTH)
    else:
        cv.line([add(m, (-2, 0)), add(m, (2, 0))], MOUTH)
        cv.pixel(m[0] - 3, m[1] - 1, MOUTH)
        cv.pixel(m[0] + 3, m[1] - 1, MOUTH)
    return dict(front=(x0 + w + shear, b - h * 0.5), mouth=m, top=tr, back=bl)


POSES = dict(
    idle_a=dict(x0=22, w=26, h=26),
    idle_b=dict(x0=21, w=28, h=24, shear=-1, mouth=1),
    idle_c=dict(x0=22, w=25, h=28, shear=1),
    windup=dict(x0=19, w=30, h=21, shear=-4, eye="angry", mouth=1),
    move=dict(x0=26, w=24, h=29, shear=4, eye="angry"),
    attack=dict(x0=23, w=28, h=24, shear=6, eye="angry", mouth=3),
    recover=dict(x0=20, w=26, h=28, shear=-2, eye="angry", mouth=7),
    hit=dict(x0=17, w=28, h=23, shear=-5, eye="shut", mouth=1),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 무너진 정육면체: 낮게 퍼진 판 + 드러난 뼈
        cv.part(poly(cv.blank(), [(10, 59), (14, 52), (46, 51), (54, 59)]), FRONT, ink=INK, gloss=False)
        cv.part(poly(cv.blank(), [(14, 52), (18, 49), (48, 48), (46, 51)]), TOP, ink=INK, gloss=False)
        cv.line([(22, 56), (30, 54)], BONE)
        cv.put(ellipse(cv.blank(), (36, 55), 2.0, 1.6), BONE)
        for e in ((42, 55), (47, 55)):
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], EYE)
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], EYE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        beads(cv, (12, GROUND - 1), (22, GROUND - 8), 1.2, 2.6, GOO, n=6)
    j = cube(cv, **P)
    if name == "attack":
        burst(cv, add(j["front"], (3, -2)), 5.0, GOO[1], GOO[2], spikes=6)
    elif name == "recover":
        # 벌린 입에서 앞으로 뻗는 점액 판: 위아래 두 장이 앞에서 휘어 감싼다
        m = j["mouth"]
        top = [add(m, (2, 0)), (52, m[1] - 8), (60, m[1] - 6), (58, m[1] - 3), (50, m[1] - 4), add(m, (3, 2))]
        bot = [add(m, (2, 6)), (50, m[1] + 9), (58, m[1] + 8), (60, m[1] + 4), (52, m[1] + 4), add(m, (3, 4))]
        cv.part(poly(cv.blank(), top), GOO, ink=INK, gloss=False)
        cv.part(poly(cv.blank(), bot), GOO, ink=INK, gloss=False)
        for p in ((55, m[1] - 5), (54, m[1] + 6), (58, m[1])):
            cv.pixel(*rnd(p), GOO[2])
        cv.line4([(58, m[1] - 3), (58, m[1] + 4)], GOO[1])
    elif name == "windup":
        cv.pixel(*rnd(add(j["top"], (-3, -2))), EDGE)
        cv.pixel(*rnd(add(j["top"], (-2, -3))), EDGE)
    elif name == "hit":
        beads(cv, add(j["back"], (1, -2)), add(j["back"], (-3, -12)), 2.0, 1.0, GOO, n=4)
    return cv.image()


if __name__ == "__main__":
    run("slime-cube", draw, sys.argv[1:], idle_ms=220)
