#!/usr/bin/env python3
"""은빛 슬라임(slime-metal) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

수은처럼 흐르는 액체 금속: 바닥에 납작한 은빛 웅덩이를 깔고 그 위에 낮고 넓은 각진 돔이 솟는다.
돔 표면에 밝은·어두운 반사 띠가 사선으로 번갈아 지나가고(금속광), 얼굴 축 앞쪽에 납작한 큰 코 혹과
가늘게 찢어진 두 눈. 몸이 흐를 때 웅덩이가 뒤로 끌리며 방울이 떨어진다.
6번 칸(스킬 강철 창): 돔을 뒤로 눌렀다가 얼굴 앞에서 몸의 일부를 길고 뾰족한 강철 가시로 굳혀 찌른다.

  python3 scripts/content/monsters/redraw_slime_metal.py [--preview DIR]
"""
from __future__ import annotations

import sys

import numpy as np

from jelly_rig import beads, superblob
from pixel_lib import Canvas, add, burst, ellipse, poly, rnd, run, sparkle

INK = (24, 26, 34)
METAL = [(92, 98, 112), (150, 156, 170), (200, 206, 218), (246, 250, 255)]
DARK_BAND = (70, 76, 92)
BRIGHT_BAND = (232, 238, 248)
POOL = [(70, 76, 92), (120, 126, 142), (176, 182, 196), (220, 226, 236)]
EYE = (16, 18, 26)
MOUTH = (40, 42, 54)
SPARK = [(150, 156, 170), (230, 236, 248), (255, 255, 255)]
GROUND = 59


def bands(cv, M, x0, offset):
    """사선 반사 띠: x+y 대각선을 따라 어둡고 밝은 띠를 번갈아 넣는다(몸 마스크 안에서만)."""
    S = cv.S
    yy, xx = np.mgrid[0:S, 0:S]
    d = (xx - yy * 0.6 - x0 + offset) % 14
    inner = M.copy()
    inner[1:] &= M[:-1]
    inner[:, 1:] &= M[:, :-1]
    inner[:, :-1] &= M[:, 1:]
    cv.rgb[inner & (d < 2)] = DARK_BAND
    cv.rgb[inner & (d >= 2) & (d < 3)] = BRIGHT_BAND


POSES = dict(
    idle_a=dict(cx=31, w=34, h=17, lean=0, pool=44, off=0),
    idle_b=dict(cx=31, w=36, h=15, lean=0, pool=46, off=3),
    idle_c=dict(cx=31, w=32, h=19, lean=1.5, pool=42, off=6),
    windup=dict(cx=28, w=38, h=12, lean=-3, pool=48, off=2, eye="angry"),
    move=dict(cx=38, w=30, h=18, lean=5, pool=40, off=9, eye="angry", pool_dx=-8),
    attack=dict(cx=33, w=36, h=15, lean=7, pool=44, off=4, eye="angry", mouth=2),
    recover=dict(cx=26, w=32, h=16, lean=-4, pool=40, off=7, eye="angry", mouth=1),
    hit=dict(cx=27, w=36, h=13, lean=-5, pool=46, off=11, eye="shut", mouth=2),
)


def draw_metal(cv, cx, w, h, lean=0.0, pool=44, off=0, eye="open", mouth=0, pool_dx=0):
    # 바닥 웅덩이
    cv.part(poly(cv.blank(), superblob(cx + pool_dx, GROUND, pool, 4, n=3.0, flare=2.0)), POOL, ink=INK, gloss=False)
    M = cv.part(poly(cv.blank(), superblob(cx, GROUND - 2, w, h, n=3.0, lean=lean)), METAL, ink=INK, gloss=False)
    bands(cv, M, cx, off)
    top = GROUND - 2 - h
    # 큰 하이라이트 줄
    cv.line([rnd((cx - w * 0.3 + lean * 0.4, top + 3)), rnd((cx - w * 0.12 + lean * 0.5, top + 2))], (255, 255, 255))
    # 납작한 큰 코 혹(얼굴 앞)
    nx = cx + w * 0.4 + lean * 0.8
    ny = GROUND - 2 - h * 0.45
    cv.part(ellipse(cv.blank(), (nx, ny), 3.0, 2.0), METAL, ink=INK, gloss=True)
    cv.pixel(*rnd((nx - 1, ny - 1)), (255, 255, 255))
    ey = ny - 4
    for ex, s in ((nx - 7, 1), (nx - 2, 2)):
        e = rnd((ex, ey))
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (s, 1))], EYE)
        elif eye == "angry":
            cv.line([add(e, (-1, -1)), add(e, (s, 0))], EYE)
            cv.line([add(e, (-1, 0)), add(e, (s, 1))], EYE)
        else:
            cv.line([add(e, (-1, 0)), add(e, (s, 0))], EYE)
            cv.line([add(e, (-1, 1)), add(e, (s, 1))], EYE)
            cv.pixel(e[0] + s - 1, e[1], (255, 255, 255))
    m = rnd((nx - 3, ny + 4))
    if mouth == 2:
        cv.put(ellipse(cv.blank(), m, 1.6, 1.2), MOUTH)
    elif mouth == 1:
        cv.line([add(m, (-2, 0)), add(m, (1, 0))], MOUTH)
    else:
        cv.line([add(m, (-2, -1)), add(m, (0, 0)), add(m, (1, -1))], MOUTH)
    return dict(nose=(nx, ny), front=(nx + 3, ny), back=(cx - w / 2, GROUND - 3), top=(cx, top))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        M = cv.part(poly(cv.blank(), superblob(32, GROUND, 52, 5, n=3.0, flare=2.0)), POOL, ink=INK, gloss=False)
        bands(cv, M, 32, 5)
        cv.part(ellipse(cv.blank(), (44, 54), 2.5, 1.6), METAL, ink=INK)
        for e in ((36, 56), (40, 56)):
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        beads(cv, (8, GROUND - 1), (20, GROUND - 4), 1.0, 2.0, SPARK, n=5)
    j = draw_metal(cv, **P)
    if name == "attack":
        burst(cv, add(j["front"], (4, -1)), 5.0, SPARK[1], SPARK[2], spikes=6)
    elif name == "recover":
        # 코 앞에서 굳어 뻗는 강철 가시(뿌리 굵고 끝 뾰족) + 끝의 번쩍임
        a = j["front"]
        spear = [add(a, (-2, -3)), (60, a[1] - 3), (62, a[1] - 2), (60, a[1] - 1), add(a, (-2, 3))]
        cv.part(poly(cv.blank(), spear), METAL, ink=INK)
        cv.line([add(a, (0, -1)), (58, a[1] - 2)], BRIGHT_BAND)
        sparkle(cv, (58, a[1] - 6), SPARK[2], SPARK[1], big=True)
    elif name == "windup":
        sparkle(cv, add(j["top"], (-3, 0)), SPARK[2], SPARK[1])
    elif name == "hit":
        beads(cv, add(j["back"], (2, -3)), add(j["back"], (-3, -12)), 2.0, 1.0, SPARK, n=4)
    return cv.image()


if __name__ == "__main__":
    run("slime-metal", draw, sys.argv[1:], idle_ms=200)
