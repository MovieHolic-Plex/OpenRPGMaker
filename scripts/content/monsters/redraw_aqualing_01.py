#!/usr/bin/env python3
"""물방울 아이(aqualing-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

두 발로 선 작은 우파루파(아홀로틀)형 물 생물: 몸보다 큰 납작하고 둥근 머리, 머리 양옆 뒤로 뻗은 분홍 겉아가미 셋,
넓은 웃는 입, 머리 안의 크고 둥근 검은 눈(흰 반짝임), 하늘색 몸에 밝은 배, 짧은 팔다리, 위아래 지느러미가 달린 노 모양 꼬리.
6번 칸(스킬 물방울 포): 볼을 부풀려 입에서 큰 물방울 셋을 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_aqualing_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (12, 30, 50)
SKIN = [(50, 120, 170), (80, 166, 210), (130, 206, 236), (200, 240, 252)]
BELLY = [(170, 216, 230), (214, 240, 248), (240, 252, 255), (255, 255, 255)]
GILL = [(190, 70, 110), (236, 120, 150), (255, 176, 196), (255, 176, 196)]
MOUTH = (90, 24, 40)
WATER = [(40, 120, 200), (110, 190, 240), (220, 246, 255)]
WHITE = (255, 255, 255)
G = 60


def critter(cv, x=32, bob=0, lean=0, mouth=0, eye="open", arm=0, tail=0, legs=0, puffed=0):
    hip = (x - 2, 50 + bob)
    # 노 모양 꼬리(뒤로, 위아래 지느러미)
    tp = bezier(add(hip, (-3, 0)), add(hip, (-10, -2 - tail)), add(hip, (-17, -6 - tail * 2)), 6)
    cv.part(chain(tp, [4.2, 4, 3.6, 3.0, 2.2, 1.4, 1.0]), SKIN, ink=INK)
    fin = [add(tp[1], (0, -4)), add(tp[4], (-1, -6)), add(tp[6], (-1, -2)), add(tp[5], (0, 4)), add(tp[2], (0, 4))]
    cv.part(poly(cv.blank(), fin), [GILL[1]] * 2 + [GILL[2]] * 2, ink=INK, gloss=False)
    cv.part(chain(tp, [3.6, 3.4, 3.0, 2.4, 1.8, 1.0, 0.8]), SKIN, gloss=False)
    # 먼 다리
    cv.part(chain([add(hip, (2, 2)), (hip[0] + 4 - legs, G - 1)], [3.2, 2.6]), [SKIN[0]] * 4, ink=INK, gloss=False)
    # 몸
    body = add(hip, (2 + lean * 0.3, -6))
    cv.part(ellipse(cv.blank(), body, 6.4, 7.4), SKIN, ink=INK)
    cv.part(ellipse(cv.blank(), add(body, (2.6, 1.4)), 3.2, 5.2), BELLY, gloss=False)
    # 가까운 다리
    cv.part(chain([add(hip, (0, 3)), (hip[0] - 1 + legs, G)], [3.4, 2.8]), SKIN, ink=INK, gloss=False)
    cv.put(poly(cv.blank(), [(hip[0] - 3 + legs, G - 1), (hip[0] + 2 + legs, G - 1), (hip[0] + 2 + legs, G), (hip[0] - 3 + legs, G)]), SKIN[0])
    # 머리(크고 납작, 앞으로)
    hc = add(body, (4 + lean * 0.5, -10))
    cv.part(ellipse(cv.blank(), hc, 9.5 + puffed * 0.5, 7.4 + puffed * 0.4), SKIN, ink=INK)
    cv.part(ellipse(cv.blank(), add(hc, (4, 3)), 4.4 + puffed, 2.6 + puffed * 0.4), BELLY, gloss=False)
    for k, (dy, ln) in enumerate(((-5, 7), (-1, 8), (3, 6))):
        a = 200 + dy * 6 - tail * 2
        root = add(hc, (-4, dy - 1))
        tip = polar(root, a, ln)
        cv.part(chain([root, lerp(root, tip, 0.5), tip], [2.2, 1.8, 1.2]), GILL, ink=INK, gloss=False)
        cv.pixel(*rnd(polar(lerp(root, tip, 0.6), a - 90, 1.6)), GILL[2])
    # 입
    m0 = add(hc, (2, 3))
    if mouth:
        cv.put(poly(cv.blank(), [m0, add(m0, (8, -1)), add(m0, (8, 1 + mouth)), add(m0, (3, 1 + mouth))]), MOUTH)
    else:
        cv.line([m0, add(m0, (3, 1)), add(m0, (7, 0))], INK)
    # 눈(머리 안, 앞쪽)
    e = rnd(add(hc, (4, -2)))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (2, 1))], INK)
    elif eye == "x":
        cv.line([add(e, (-1, -1)), add(e, (1, 1))], INK)
        cv.line([add(e, (1, -1)), add(e, (-1, 1))], INK)
    else:
        cv.part(ellipse(cv.blank(), add(e, (0.5, 0.5)), 1.8, 2.2), [INK] * 4, gloss=False)
        cv.pixel(e[0] + 1, e[1] - 1, WHITE)
    # 가까운 팔
    sh = add(body, (2, -2))
    hand = polar(sh, 60 - arm, 6)
    cv.part(chain([sh, hand], [2.4, 2.0]), SKIN, ink=INK, gloss=False)
    return dict(head=hc, mouth=add(m0, (8, 0)), eye=e, hand=hand)


def drop(cv, c, r):
    cv.part(ellipse(cv.blank(), c, r, r), [WATER[0], WATER[1], WATER[1], WATER[2]], ink=INK)
    cv.pixel(*rnd(add(c, (r * 0.4, -r * 0.4))), WHITE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 엎어져 아가미가 처짐
        cv.part(chain([(10, 57), (18, 57), (26, 56)], [1.2, 2.6, 3.6]), SKIN, ink=INK)
        cv.part(ellipse(cv.blank(), (31, 56), 6, 3.6), SKIN, ink=INK)
        for dy in (-3, 0):
            cv.part(chain([(38, 54 + dy), (34, 50 + dy)], [1.6, 1.0]), GILL, ink=INK, gloss=False)
        cv.part(ellipse(cv.blank(), (44, 55), 7.5, 4.4), SKIN, ink=INK)
        cv.line([(46, 53), (48, 55)], INK)
        cv.line([(48, 53), (46, 55)], INK)
        puff(cv, (54, 59), 1.4, [WATER[1], WATER[2]])
        return cv.image()
    if name == "idle_a":
        critter(cv)
    elif name == "idle_b":
        critter(cv, bob=1, tail=2, arm=10, puffed=0)
    elif name == "idle_c":
        critter(cv, bob=-1, tail=-2, arm=-12, mouth=1)
    elif name == "windup":  # 몸을 뒤로 젖혀 숨을 들이쉼
        j = critter(cv, x=29, lean=-6, tail=4, arm=40, puffed=2, mouth=0)
        sparkle(cv, add(j["head"], (2, -11)), WHITE, WATER[1])
    elif name == "move":
        speed_lines(cv, 1, 7, (38, 44, 50), WATER[1])
        critter(cv, x=36, lean=6, tail=-3, legs=3, arm=-30)
        puff(cv, (14, 58), 2.0, [WATER[1], WATER[2]])
    elif name == "attack":  # 머리로 들이받으며 물튀김
        j = critter(cv, x=37, lean=10, mouth=2, arm=-40, legs=-2)
        burst(cv, add(j["mouth"], (2, -2)), 4.2, WATER[1], WHITE, spikes=7)
    elif name == "recover":  # 스킬: 물방울 포
        j = critter(cv, x=20, lean=4, mouth=4, puffed=1, arm=-20, tail=3)
        m = j["mouth"]
        for k, (dx, dy, r) in enumerate(((4, 0, 2.2), (11, -2, 3.0), (20, -3, 3.8))):
            drop(cv, add(m, (dx, dy)), r)
        cv.line([add(m, (2, 3)), add(m, (18, 4))], WATER[1])
        sparkle(cv, add(m, (22, -10)), WHITE, WATER[1])
    elif name == "hit":
        j = critter(cv, x=29, lean=-8, eye="shut", mouth=1, arm=50, tail=-4, legs=-2)
        h = j["head"]
        for dx, dy in ((8, -9), (11, -6), (10, -12)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("aqualing-01", draw, sys.argv[1:], idle_ms=200)
