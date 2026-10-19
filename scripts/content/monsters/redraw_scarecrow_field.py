#!/usr/bin/env python3
"""붉은 외투 허수아비(scarecrow-field) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

땅에 박힌 나무 기둥 하나로 깡충 뛰는 허수아비: 다리 대신 기둥, 어깨를 가로지르는 가로 막대에 꿰인
해진 붉은 외투(소매 끝·옷자락에서 지푸라기가 삐져나옴), 꿰맨 삼베 자루 머리(바느질 입, 머리 안 두 단추 눈 중
가까운 눈만 크게), 챙 넓은 찌그러진 밀짚모자, 가까운 손에 쥔 녹슨 낫.
6번 칸(스킬 까마귀 떼): 두 팔을 활짝 벌리고 외투 속에서 검은 까마귀 셋이 아군 쪽으로 날아간다.

  python3 scripts/content/monsters/redraw_scarecrow_field.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, arc_trail, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle

INK = (30, 20, 12)
SACK = [(150, 124, 80), (188, 160, 110), (214, 190, 140), (232, 214, 170)]
COAT = [(110, 26, 24), (150, 40, 34), (186, 64, 50), (210, 96, 76)]
STRAW = [(180, 140, 40), (222, 186, 70), (250, 226, 120), (250, 226, 120)]
WOOD = [(70, 48, 28), (104, 72, 42), (134, 98, 60), (134, 98, 60)]
RUST = [(110, 110, 120), (170, 172, 180), (214, 216, 222), (244, 244, 248)]
BUTTON = (40, 30, 30)
STITCH = (70, 40, 24)
CROW = [(20, 18, 26), (44, 40, 56), (80, 76, 96)]
CROW_EYE = (240, 60, 40)
DUST = [(110, 92, 60), (150, 130, 90)]
WHITE = (255, 250, 236)
G = 60


def straw(cv, p, ang, n=3):
    for k in range(n):
        a = ang - 25 + k * 25
        cv.line4([rnd(p), rnd(polar(p, a, 3 + k % 2))], STRAW[2 - k % 2])


def scarecrow(cv, x=30, hop=0, lean=0, tilt=0, arms=(10, 10), sickle=-60, mouth=0, eye="open", spread=0):
    base_y = G - hop
    top = (x + lean, 26 - hop)
    # 기둥(땅에 닿는 끝은 뾰족)
    cv.part(chain([(x, base_y - 1), lerp((x, base_y), top, 0.5), top], [3, 3.2, 3.2]), WOOD, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(x - 1.5, base_y - 2), (x + 1.5, base_y - 2), (x, base_y)]), WOOD, ink=INK, gloss=False)
    sh = add(top, (0, 3))
    # 가로 막대 + 먼 소매(왼쪽)
    la = polar(sh, 180 + arms[1], 13 + spread)
    ra = polar(sh, -arms[0], 13 + spread)
    cv.part(chain([la, ra], [2.4, 2.4]), WOOD, ink=INK, gloss=False)
    cv.part(chain([sh, lerp(sh, la, 0.85)], [5, 4.2]), COAT, ink=INK, gloss=False)
    straw(cv, la, 180 + arms[1])
    # 외투 몸통(아래 자락이 갈라짐)
    hem = sh[1] + 17
    body = [add(sh, (-5, -1)), add(sh, (5, -1)), (sh[0] + 7, hem - 3), (sh[0] + 5, hem), (sh[0] + 2, hem - 2), (sh[0] - 1, hem + 1),
            (sh[0] - 4, hem - 2), (sh[0] - 7, hem)]
    M = cv.part(poly(cv.blank(), body), COAT, ink=INK)
    cv.shade_side(M, COAT[0], side=-1, depth=2)
    for px in (-6, -1, 5):
        straw(cv, (sh[0] + px, hem), 90, 2)
    cv.line4([rnd(add(sh, (1, 1))), (int(sh[0] + 1), int(hem - 2))], COAT[0])
    for py in (5, 10):
        cv.pixel(int(sh[0] + 2), int(sh[1] + py), STRAW[1])  # 단추 대신 지푸라기 매듭
    cv.part(chain([add(sh, (-6, 9)), add(sh, (6, 9))], [1.6, 1.6]), [STRAW[0]] * 4, ink=INK, gloss=False)  # 새끼줄 허리
    # 머리: 삼베 자루
    a = math.radians(tilt)
    hc = add(top, (1, -6))
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(poly(cv.blank(), [R(-5, 5), R(-6, -1), R(-4, -5), R(3, -5), R(6, -1), R(6, 4), R(2, 6)]), SACK, ink=INK)
    cv.part(chain([R(-4, 5), R(4, 5)], [1.6, 1.6]), [STRAW[0]] * 4, ink=INK, gloss=False)  # 목 끈
    # 바느질 입
    if mouth:
        cv.put(poly(cv.blank(), [R(0, 2), R(5, 1), R(5, 2 + mouth), R(0, 3)]), (40, 20, 14))
    cv.line4([rnd(R(0, 2)), rnd(R(5, 1))], STITCH)
    for dx in (1, 3):
        cv.pixel(*rnd(R(dx, 3)), STITCH)
    e = rnd(R(3, -2))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], BUTTON)
        cv.line([add(e, (-1, 1)), add(e, (1, 0))], BUTTON)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), BUTTON)
        cv.pixel(e[0] - 1, e[1] - 1, SACK[3])
    cv.pixel(*rnd(R(-1, -2)), BUTTON)
    # 밀짚모자(넓은 챙 + 찌그러진 꼭지)
    cv.part(chain([R(-9, -4), R(9, -5)], [2.2, 2.2]), STRAW, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-4, -5), R(-3, -10), R(1, -11), R(3, -8), R(4, -5)]), STRAW, ink=INK, gloss=False)
    cv.line4([rnd(R(-3, -6)), rnd(R(3, -6))], COAT[1])
    # 가까운 소매 + 손(지푸라기) + 낫
    cv.part(chain([sh, lerp(sh, ra, 0.85)], [5, 4.2]), COAT, ink=INK, gloss=False)
    hand = ra
    blade_end = polar(hand, sickle, 7)
    cv.part(chain([hand, blade_end], [1.8, 1.8]), WOOD, ink=INK, gloss=False)
    curve = bezier(blade_end, polar(blade_end, sickle + 70, 9), polar(blade_end, sickle + 140, 9), 6)
    cv.part(chain(curve, [2.2, 2.4, 2.2, 1.8, 1.4, 1.0, 0.8]), RUST, ink=INK, gloss=False)
    straw(cv, hand, -arms[0])
    return dict(eye=e, hand=hand, blade=curve[3], sh=sh)


def crow(cv, c, flap):
    x, y = c
    cv.part(ellipse(cv.blank(), c, 3, 2), CROW + [CROW[2]], ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(x - 1, y), (x - 5, y - 4 * flap), (x + 1, y - 1)]), CROW + [CROW[2]], ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(x - 2, y), (x - 6, y + 1), (x - 3, y + 1)]), CROW + [CROW[2]], ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (x + 3, y - 1), 1.6, 1.6), CROW + [CROW[2]], ink=INK, gloss=False)
    cv.pixel(x + 5, y - 1, (230, 180, 60))
    cv.pixel(x + 3, y - 2, CROW_EYE)


def draw_dead(cv):
    cv.part(chain([(6, 57), (30, 57)], [3, 3]), WOOD, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(20, 59), (22, 51), (38, 50), (42, 59)]), COAT, ink=INK)
    for px in (22, 30, 38):
        straw(cv, (px, 51), -90, 2)
    cv.part(poly(cv.blank(), [(42, 59), (42, 51), (48, 49), (53, 52), (53, 59)]), SACK, ink=INK)
    cv.line([(46, 53), (48, 55)], BUTTON)
    cv.line([(48, 53), (46, 55)], BUTTON)
    cv.part(chain([(52, 47), (60, 53)], [2.2, 2.2]), STRAW, ink=INK, gloss=False)
    straw(cv, (13, 58), -60, 3)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        scarecrow(cv)
    elif name == "idle_b":
        scarecrow(cv, hop=2, tilt=6, arms=(5, 15), sickle=-50, mouth=1)
    elif name == "idle_c":
        scarecrow(cv, lean=1, tilt=-5, arms=(15, 5), sickle=-70)
    elif name == "windup":  # 낫을 머리 뒤로 젖힌다
        j = scarecrow(cv, x=27, lean=-3, tilt=-10, arms=(55, -10), sickle=-60, mouth=2)
        sparkle(cv, add(j["blade"], (0, -2)), WHITE, RUST[3])
    elif name == "move":  # 기둥으로 깡충 뛰어 다가온다
        scarecrow(cv, x=34, hop=5, lean=4, tilt=12, arms=(-10, 20), sickle=-20, mouth=1)
        puff(cv, (30, 58), 2.4, DUST)
        cv.line4([(20, 55), (24, 50)], DUST[1])
    elif name == "attack":  # 낫 내려 베기
        j = scarecrow(cv, x=30, lean=3, tilt=10, arms=(-25, 5), sickle=40, mouth=3)
        arc_trail(cv, j["hand"], 9, -80, 40, 3.0, RUST[2], WHITE)
    elif name == "recover":  # 스킬: 외투 속 까마귀 떼
        j = scarecrow(cv, x=24, hop=1, tilt=-8, arms=(30, 30), sickle=-80, mouth=4, spread=2)
        for c, f in (((47, 30), 1.0), ((56, 40), -0.6), ((45, 46), 0.8)):
            crow(cv, c, f)
        for p in ((38, 30), (59, 24)):
            cv.pixel(*p, CROW[2])
    elif name == "hit":
        j = scarecrow(cv, x=27, lean=-5, tilt=-24, arms=(-30, 40), sickle=70, eye="shut")
        e = j["eye"]
        for dx, dy in ((3, -10), (6, -8), (5, -13)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
        straw(cv, (40, 34), -30, 3)
    return cv.image()


if __name__ == "__main__":
    run("scarecrow-field", draw, sys.argv[1:], idle_ms=240)
