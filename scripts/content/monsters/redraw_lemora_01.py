#!/usr/bin/env python3
"""푸른 비늘 해룡(lemora-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

작은 물웅덩이에 굵은 똬리 두 고리를 담그고, 그 위로 S 자 목을 높이 세운 바다뱀 용: 푸른 비늘(짙은 등·밝은 옆구리),
목 앞쪽을 따라 이어진 금빛 배 비늘판, 목 뒤쪽과 머리 뒤의 붉은 지느러미, 이빨이 드러난 긴 턱의 큰 머리,
뒤로 휜 상아색 뿔 둘, 머리 안의 노란 눈. 다리·날개 없이 물에서 솟아 있다(삼두룡·뱀과 윤곽이 다르다).
6번 칸(스킬 해일 물줄기): 목을 곧추세우고 벌린 입에서 굵은 물줄기와 물보라를 아군 쪽으로 뿜는다.

  python3 scripts/content/monsters/redraw_lemora_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, rnd, run, sparkle, speed_lines

INK = (10, 24, 44)
SCALE = [(30, 70, 112), (48, 108, 156), (86, 156, 196), (156, 210, 232)]
FAR = [(22, 50, 86), (30, 70, 112), (38, 86, 128), (38, 86, 128)]
PLATE = [(150, 110, 50), (206, 166, 96), (238, 208, 140), (255, 238, 190)]
FIN = [(120, 26, 36), (176, 46, 50), (218, 86, 74), (244, 136, 116)]
HORN = [(170, 150, 110), (216, 200, 156), (240, 232, 200), (240, 232, 200)]
EYE = (255, 214, 60)
MOUTH = (110, 22, 36)
TOOTH = (250, 248, 236)
WATER = [(28, 76, 146), (60, 128, 200), (136, 200, 240), (232, 250, 255)]
WHITE = (255, 255, 255)


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def pool(cv, x0=6, x1=52, front=False):
    """얕은 물웅덩이. front=True 면 몸 앞을 덮는 앞쪽 수면만(몸이 물에 잠겨 보이게)."""
    cx, w = (x0 + x1) / 2, (x1 - x0) / 2
    if not front:
        cv.put(ellipse(cv.blank(), (cx, 57.5), w, 2.6), WATER[1])
        cv.line([(x0 + 2, 56), (x1 - 2, 56)], WATER[2])
        return
    M = np.array(ellipse(cv.blank(), (cx, 57.5), w, 2.6)) > 0
    M[:58] = False
    cv.put(M, WATER[1])
    for xa in range(int(x0) + 3, int(x1) - 3, 7):
        cv.line([(xa, 58), (xa + 3, 58)], WATER[2])
    cv.pixel(x0, 57, WATER[0])
    cv.pixel(x1, 57, WATER[0])


def coils(cv, sway=0.0):
    """물에 잠긴 굵은 똬리 두 고리 + 뒤로 빠진 꼬리 끝."""
    tail = bezier((4, 52 - sway), (8, 44 - sway), (15, 50), 6)
    cv.part(chain(tail, [1.6, 2.4, 3.4, 4.4, 5.4, 6.4, 7.0]), FAR)
    cv.part(poly(cv.blank(), [(5, 48 - sway), (2, 44 - sway), (8, 46 - sway)]), FIN, gloss=False)
    back = bezier((12, 58), (19, 42), (28, 57), 8)
    cv.part(chain(back, [7.5] * 9), SCALE)
    front = bezier((24, 58), (33, 41), (44, 57), 8)
    cv.part(chain(front, [8.5] * 9), SCALE)
    for t in (0.3, 0.5, 0.7):
        p = rnd(front[int(t * 8)])
        cv.pixel(p[0], p[1] - 2, SCALE[3])


def neck(cv, base, hp, bend):
    """똬리에서 솟는 S 자 목: 뒤쪽 붉은 지느러미, 앞쪽 금빛 배 비늘판."""
    mid = add(lerp(base, hp, 0.5), (-bend * 0.4, 0))
    pts = bezier(base, add(lerp(base, mid, 0.5), (bend, 0)), mid, 5)[:-1] + bezier(mid, add(lerp(mid, hp, 0.5), (-bend, 0)), hp, 5)
    n = len(pts)
    widths = [8.0 - 2.4 * i / (n - 1) for i in range(n)]
    # 등 지느러미(목 뒤쪽 = 왼쪽)
    for i in (2, 4, 6, 8):
        a, b = pts[i - 1], pts[i]
        d = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        root = polar(b, d - 90, widths[i] / 2 - 1)
        tip = polar(root, d - 90 - 30, 7.5)
        cv.part(poly(cv.blank(), [polar(root, d, 2.5), tip, polar(root, d + 180, 3)]), FIN, gloss=False)
    M = cv.part(chain(pts, widths), SCALE)
    # 배 비늘판(목 앞쪽 = 오른쪽): 띠 + 판 사이 금
    band = []
    for i in range(n):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        d = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        band.append((polar(pts[i], d + 90, widths[i] / 2 - 1.3), d))
    bm = np.array(chain([b for b, _ in band[:-1]], [2.6] * (n - 1))) > 0
    cv.put(bm & M, PLATE[2])
    for i in range(1, n - 1):
        if i % 1 == 0:
            p, d = band[i]
            cv.line([polar(p, d + 90, -1.5), polar(p, d + 90, 1.5)], PLATE[0] if i % 2 else PLATE[1])
    return pts


def head(cv, hp, tilt=0, mouth=0, eye="open", fin=0.0):
    """큰 뿔 머리. hp = 머리 뒤통수(목 끝). mouth = 아래턱 벌림 각."""
    P = lambda *pts: xf(hp, tilt, pts)
    # 머리 뒤 붉은 지느러미(부채)
    cv.part(poly(cv.blank(), P((-2, -1), (-9 - fin, -6 - fin), (-7, -2), (-10 - fin, 1), (-6, 2), (-8 - fin, 5 + fin), (-1, 3))), FIN, gloss=False)
    # 먼 뿔
    cv.part(chain([P((0, -4))[0], P((-4, -9))[0], P((-9, -10))[0]], [2.6, 2.0, 1.2]), [HORN[0]] * 4, gloss=False)
    # 아래턱
    jo = P((2, 3))[0]
    jaw = xf(jo, tilt + mouth, [(0, -1), (12, 0), (12, 2), (1, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((2, 1), (15, 1)) + [jaw[1], jaw[0]]), MOUTH)
        for x in (5, 8, 11):
            cv.pixel(*rnd(xf(jo, tilt + mouth, [(x, -1)])[0]), TOOTH)
    cv.part(poly(cv.blank(), jaw), SCALE, gloss=False)
    cv.put(poly(cv.blank(), xf(jo, tilt + mouth, [(1, 2), (11, 1.5), (11, 2), (1, 3)])), PLATE[2])
    # 윗머리(두개 + 긴 주둥이)
    cv.part(poly(cv.blank(), P((-3, -3), (1, -6), (7, -5), (16, -1), (16, 2), (4, 3), (-3, 3))), SCALE)
    for x in (6, 9, 12, 15):
        cv.pixel(*rnd(P((x, 3))[0]), TOOTH)
    cv.pixel(*rnd(P((15, -1))[0]), INK)  # 콧구멍
    # 가까운 뿔(뒤로 휜다)
    cv.part(chain([P((2, -5))[0], P((-2, -11))[0], P((-7, -13))[0]], [3.0, 2.2, 1.2]), HORN, gloss=False)
    # 눈(머리 안) + 눈두덩
    e = rnd(P((6, -2))[0])
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (2, 1))], INK)
    elif eye == "x":
        cv.line([add(e, (-1, -1)), add(e, (1, 1))], INK)
        cv.line([add(e, (1, -1)), add(e, (-1, 1))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(e[0] + 1, e[1] - 1, INK)
        cv.pixel(e[0] + 1, e[1], INK)
        cv.line([add(e, (-2, -2)), add(e, (2, -2))], INK)
    return dict(mouth=lerp(P((15, 2))[0], jaw[1], 0.5), snout=P((16, 0))[0], top=P((0, -8))[0])


BASE = dict(base=(34.0, 47.0), hp=(36.0, 18.0), bend=9.0, tilt=0, mouth=10, eye="open", fin=0.0, sway=0.0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":
        p.update(hp=(37.0, 19.0), bend=10.0, tilt=4, mouth=6, sway=1.0, fin=0.5)
    elif name == "idle_c":
        p.update(hp=(35.0, 17.0), bend=8.0, tilt=-4, mouth=14, sway=-1.0, fin=1.0)
    elif name == "windup":  # 목을 뒤로 감아 움츠린다
        p.update(hp=(26.0, 20.0), bend=13.0, tilt=-12, mouth=0, fin=1.5, sway=2.0)
    elif name == "move":  # 물을 밀며 앞으로 솟구친다
        p.update(base=(36.0, 47.0), hp=(42.0, 20.0), bend=6.0, tilt=8, mouth=6, sway=-2.0)
    elif name == "attack":  # 목을 앞으로 내뻗어 문다
        p.update(base=(36.0, 47.0), hp=(42.0, 30.0), bend=4.0, tilt=18, mouth=32, fin=1.5)
    elif name == "recover":  # 스킬: 곧추서서 물줄기
        p.update(base=(30.0, 47.0), hp=(27.0, 18.0), bend=7.0, tilt=-6, mouth=26, fin=1.5, sway=1.0)
    elif name == "hit":
        p.update(hp=(28.0, 16.0), bend=11.0, tilt=-24, mouth=16, eye="shut", sway=-2.0)
    return p


def serpent(cv, P):
    pool(cv)
    coils(cv, P["sway"])
    neck(cv, P["base"], P["hp"], P["bend"])
    j = head(cv, P["hp"], P["tilt"], P["mouth"], P["eye"], P["fin"])
    pool(cv, front=True)
    return j


def draw_dead(cv):
    pool(cv, 4, 60)
    coils(cv, -3)
    pts = bezier((34, 52), (44, 46), (52, 55), 8)
    cv.part(chain(pts, [8, 7.6, 7.2, 6.8, 6.4, 6.2, 6, 5.8, 5.6]), SCALE)
    for i in (2, 4, 6):
        cv.part(poly(cv.blank(), [add(pts[i], (-2, -3)), add(pts[i], (-1, -7)), add(pts[i], (2, -3))]), FIN, gloss=False)
    cv.part(poly(cv.blank(), [(48, 52), (52, 49), (60, 52), (61, 56), (50, 57)]), SCALE)
    cv.part(chain([(51, 50), (47, 46), (43, 45)], [2.4, 1.8, 1.0]), HORN, gloss=False)
    cv.line([(53, 52), (55, 54)], INK)
    cv.line([(55, 52), (53, 54)], INK)
    pool(cv, 4, 60, front=True)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 1, 8, (24, 30, 36), WATER[2])
    j = serpent(cv, P)
    if name == "windup":
        sparkle(cv, add(j["top"], (-3, -3)), WHITE, WATER[2])
    elif name == "move":
        for dx, dy, r in ((52, 54, 2.0), (56, 50, 1.4), (48, 50, 1.2)):
            cv.part(ellipse(cv.blank(), (dx, dy), r, r), [WATER[1], WATER[2], WATER[2], WHITE], ink=WATER[0], gloss=False)
    elif name == "attack":
        burst(cv, add(j["mouth"], (3, 0)), 5.0, WATER[2], WHITE, spikes=7)
    elif name == "recover":
        m = j["mouth"]
        x1 = 61
        cv.put(poly(cv.blank(), [add(m, (0, -2)), (x1, m[1] - 6), (x1, m[1] + 7), add(m, (0, 2))]), WATER[1])
        cv.put(poly(cv.blank(), [add(m, (1, -1)), (x1, m[1] - 3), (x1, m[1] + 4), add(m, (1, 1))]), WATER[2])
        cv.line([add(m, (2, 0)), (x1, m[1])], WHITE)
        for (dx, dy, r) in ((14, -9, 1.6), (22, 9, 1.8), (30, -10, 1.4), (26, 12, 1.2)):
            c = add(m, (dx, dy))
            if c[0] + r < 62:
                cv.part(ellipse(cv.blank(), c, r, r), [WATER[1], WATER[2], WATER[2], WHITE], ink=WATER[0], gloss=False)
        sparkle(cv, (57, m[1] - 12), WHITE, WATER[2])
    elif name == "hit":
        t = j["top"]
        for dx, dy in ((10, 2), (13, 5), (12, -1)):
            cv.pixel(t[0] + dx, t[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("lemora-01", draw, sys.argv[1:], idle_ms=210)
