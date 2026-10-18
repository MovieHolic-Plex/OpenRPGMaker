#!/usr/bin/env python3
"""다이어울프(wolf-dire) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

회색 늑대(redraw_wolf_grey.py)의 네발 뼈대·자세를 그대로 쓰되 종이 다르다:
청회색 털에 목·어깨·등줄기를 덮는 칠흑 갈기(길고 뾰족한 털 삐침이 등까지 이어짐), 붉은 눈, 더 굵은 송곳니,
어깨의 흉터 세 줄. 6번 칸(스킬, 아키타입 brute): 뒷발로 우뚝 서서 앞발로 검붉은 세 줄 할퀴기.

  python3 scripts/content/monsters/redraw_wolf_dire.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import add, lerp, poly, run

W.INK = (14, 14, 22)
W.FUR = [(56, 66, 86), (88, 102, 124), (122, 138, 160), (164, 180, 198)]
W.FUR_FAR = [(38, 44, 60), (56, 66, 86), (70, 82, 104), (70, 82, 104)]
W.CREAM = [(120, 126, 136), (160, 166, 176), (196, 202, 210), (220, 224, 230)]
W.EYE, W.EYE_HI = (230, 50, 40), (255, 200, 170)
W.RAKE = [(150, 30, 50), (255, 190, 190)]
MANE = [(14, 14, 22), (30, 30, 42), (50, 50, 66), (76, 78, 96)]
SCAR = (190, 196, 206)

_ruff, _body = W.ruff, W.body


def ruff(cv, sh, puffed=0.0):
    """칠흑 갈기: 목·어깨를 감싸고 등으로 길게 이어지는 뾰족한 털 삐침."""
    pts = [add(sh, (-14, -3)), add(sh, (-12, -8 - puffed)), add(sh, (-9, -5)), add(sh, (-7, -11 - puffed)),
           add(sh, (-4, -7)), add(sh, (-2, -14 - puffed)), add(sh, (1, -8)), add(sh, (3, -14 - puffed)),
           add(sh, (5, -7)), add(sh, (9, -4)), add(sh, (11, 3)), add(sh, (8, 10)), add(sh, (5, 6)),
           add(sh, (2, 8)), add(sh, (0, 3)), add(sh, (-6, 0))]
    cv.part(poly(cv.blank(), pts), MANE)
    for a, b in (((-10, -6), (-8, -3)), ((-4, -9), (-3, -5)), ((2, -10), (2, -6)), ((8, 2), (6, 7))):
        cv.line4([add(sh, a), add(sh, b)], MANE[3])


def body(cv, sh, hp, breath=0.0):
    M = _body(cv, sh, hp, breath)
    mid = lerp(hp, sh, 0.62)
    for dx in (0, 2, 4):
        cv.line4([add(mid, (dx - 1, -1)), add(mid, (dx + 1, 3))], SCAR)
    return M


W.ruff, W.body = ruff, body

_head = W.head


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    j = _head(cv, neck, tilt, mouth, eye, ears)
    # 굵은 송곳니: 위턱 앞쪽으로 한 칸 더 내린다
    f = W.xf(neck, tilt, [(12, 4), (12, 5)])
    for p in f:
        cv.pixel(int(round(p[0])), int(round(p[1])), W.FANG)
    return j


W.head = head


if __name__ == "__main__":
    run("wolf-dire", W.draw, sys.argv[1:], idle_ms=180)
