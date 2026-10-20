#!/usr/bin/env python3
"""청회색 동굴 박쥐(bat-cave) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

회갈색 박쥐(redraw_bat.py)의 날개 관절(wing)을 쓰되 생김새는 동굴 깊은 곳의 큰귀박쥐로 새로 그린다:
청회색 털, 머리보다 큰 둥근 나팔 귀 둘(속은 연보라), 납작한 잎 모양 코(코잎), 머리 안의 아주 작은 흰 눈,
날개막은 짙은 남색으로 반투명하게 핏줄 무늬, 몸이 작고 둥글며 꼬리막이 다리 사이를 잇는다.
6번 칸(스킬 초음파): 입을 벌리고 귀를 앞으로 세워 겹겹의 보라 음파 고리를 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_bat_cave.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import redraw_bat as B
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, poly, ring, rnd, run, slash, sparkle, speed_lines

INK = (16, 20, 34)
B.INK = INK
FUR = [(64, 78, 98), (96, 112, 134), (134, 150, 170), (176, 190, 206)]
B.MEM = [(40, 50, 90), (60, 74, 124), (86, 102, 156), (120, 136, 186)]
B.MEM_FAR = [(28, 36, 66), (40, 50, 90), (48, 60, 104), (48, 60, 104)]
B.BONE = (24, 30, 52)
B.FANG = (240, 240, 250)
EAR_IN = (180, 150, 210)
LEAF = (150, 130, 170)
EYE = (240, 240, 255)
MOUTH = (90, 30, 50)
SONIC = [(140, 100, 220), (200, 170, 255), (250, 240, 255)]
WHITE = (255, 255, 255)


def head(cv, c, tilt=0, mouth=0, eye="open", ear=0):
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 둥근 나팔 귀 둘(머리보다 크다)
    for base, cc, rr, far in (((-3, -3), (-8 - ear, -9), 3.6, True), ((1, -4), (0 - ear, -11), 4.2, False)):
        cv.part(ellipse(cv.blank(), r(*cc), rr * 0.7, rr), FUR if not far else [FUR[0]] * 4, ink=INK, gloss=False)
        cv.put(ellipse(cv.blank(), r(cc[0] + 0.8, cc[1] + 0.5), rr * 0.35, rr * 0.65), EAR_IN)
        cv.part(chain([r(*base), r(cc[0], cc[1] + rr * 0.6)], [3, 2.4]), FUR, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), c, 5.0, 4.4), FUR, ink=INK)
    # 코잎 + 주둥이
    cv.part(poly(cv.blank(), [r(3, -1), r(7, 0), r(7, 3), r(3, 3)]), FUR, ink=INK, gloss=False)
    cv.put(poly(cv.blank(), [r(6, -3), r(8, -1), r(7, 1), r(5, 0)]), LEAF)
    if mouth:
        cv.put(poly(cv.blank(), [r(3, 2), r(7, 2), r(6, 2 + mouth), r(3, 3 + mouth * 0.5)]), MOUTH)
        cv.pixel(*rnd(r(5, 3)), B.FANG)
    e = rnd(r(1, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
    return r(8, 2)


def draw_bat(cv, P):
    c = P["c"]
    sh = add(c, (-2, -3))
    B.wing(cv, add(sh, (3, -1)), P["wing"] + 58, span=27, far=True)
    B.wing(cv, sh, P["wing"], span=27)
    # 꼬리막(두 다리 사이)
    hip = add(c, (-1, 5))
    cv.part(poly(cv.blank(), [add(hip, (-3, 0)), add(hip, (3, 0)), add(hip, (2 + P["feet"][0], P["feet"][1] + 1)),
                              add(hip, (-4 + P["feet"][0], P["feet"][1]))]), B.MEM, ink=INK, gloss=False)
    B.feet(cv, hip, P["feet"])
    cv.part(ellipse(cv.blank(), c, 5.0, 6.0), FUR, ink=INK)
    for dx, dy in ((-2, 1), (1, 3), (-1, 4)):
        cv.pixel(c[0] + dx, c[1] + dy, FUR[2])
    hc = add(c, (4, -7))
    return dict(mouth=head(cv, hc, P["tilt"], P["mouth"], P["eye"], P["ear"]), head=hc)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 날개를 몸에 감고 바닥에 떨어짐
        cv.part(ellipse(cv.blank(), (30, 55), 9, 4.5), B.MEM, ink=INK)
        cv.line4([(22, 55), (38, 53)], B.BONE)
        cv.part(ellipse(cv.blank(), (40, 54), 4, 3.6), FUR, ink=INK)
        cv.part(ellipse(cv.blank(), (38, 47), 2.6, 4), FUR, ink=INK, gloss=False)
        cv.line([(39, 53), (41, 55)], INK)
        cv.line([(41, 53), (39, 55)], INK)
        return cv.image()
    P = B.params(name)
    P["c"] = (P["c"][0] - 1, P["c"][1] + 2)
    if name == "move":
        speed_lines(cv, 2, 12, (24, 30, 36), B.MEM[2])
    j = draw_bat(cv, P)
    m = j["mouth"]
    if name == "attack":
        slash(cv, add(m, (-1, -7)), add(m, (5, 7)), 3, 2.6, SONIC[1], WHITE)
    elif name == "recover":  # 스킬: 초음파 고리
        for k, r in enumerate((5, 9, 13, 17)):
            ring(cv, add(m, (1, 0)), r, -50, 50, SONIC[k % 2], width=2 if k % 2 == 0 else 1)
        sparkle(cv, add(m, (18, -10)), WHITE, SONIC[1])
    elif name == "windup":
        sparkle(cv, add(m, (1, -6)), WHITE, SONIC[1])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((7, -8), (9, -5), (8, -11)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bat-cave", draw, sys.argv[1:], idle_ms=110)
