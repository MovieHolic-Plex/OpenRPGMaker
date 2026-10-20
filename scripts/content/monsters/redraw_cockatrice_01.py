#!/usr/bin/env python3
"""비늘 코카트리스(cockatrice-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

앞은 수탉, 뒤는 뱀: 두 굵은 노란 닭 다리로 서고, 흰 깃털 가슴과 붉은 닭 볏·턱볏, 노란 부리, 머리 안의 초록 눈(석화 눈),
등에서 작은 초록 박쥐 날개, 엉덩이부터는 초록 비늘 뱀 꼬리가 땅을 따라 S 자로 뻗어 끝이 위로 말린다.
6번 칸(스킬 석화 시선): 목을 쭉 빼고 볏을 세운 채 눈에서 초록 석화 광선을 아군 쪽으로 쏜다(광선 끝이 돌 조각).

  python3 scripts/content/monsters/redraw_cockatrice_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (24, 22, 14)
FEATH = [(180, 170, 150), (224, 216, 196), (244, 240, 226), (255, 255, 250)]
SCALE = [(40, 100, 50), (64, 140, 70), (100, 180, 100), (150, 214, 140)]
SCALE_FAR = [(30, 74, 38), (40, 100, 50), (50, 116, 58), (50, 116, 58)]
COMB = [(160, 20, 20), (210, 40, 36), (240, 90, 80), (240, 90, 80)]
BEAK = [(200, 150, 30), (240, 196, 60), (255, 230, 130), (255, 230, 130)]
EYE = (90, 230, 90)
MEMB = [(40, 90, 60), (60, 124, 80), (90, 160, 110), (90, 160, 110)]
STONE = [(100, 100, 96), (140, 140, 134), (180, 180, 174), (180, 180, 174)]
RAY = [(90, 200, 90), (180, 255, 170), (240, 255, 240)]
DUST = [(110, 100, 84), (150, 140, 120)]
WHITE = (255, 255, 250)
G = 60


def chicken_leg(cv, hip, foot, far):
    ramp = [BEAK[0]] * 4 if far else BEAK
    knee = add(lerp(hip, foot, 0.45), (-3, 0))
    cv.part(chain([hip, knee], [5, 3.4]), FEATH if not far else [FEATH[0]] * 4, ink=INK, gloss=False)
    cv.part(chain([knee, foot], [2.4, 2.0]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    for a in (-10, 20, 160):
        cv.line4([f, rnd(polar(f, a, 4))], ramp[0])


def cock(cv, x=30, lean=0, neck=0, tilt=0, beak=0, eye="open", wing=0, tail=0, feet=((34, 60), (27, 60)), comb_up=0):
    hip = (x, 44)
    # 뱀 꼬리(땅을 따라 뒤로, 끝이 위로 말림)
    tp = bezier(add(hip, (-4, 2)), (x - 14, 62 + tail), (x - 26, 44 - tail), 9)
    cv.part(chain(tp, [8, 7, 6.4, 5.6, 4.8, 4, 3.4, 2.8, 2.2, 1.6]), SCALE, ink=INK, belly=(200, 220, 150))
    for k in range(2, 9, 2):
        cv.pixel(*rnd(add(tp[k], (0, -1))), SCALE[3])
    chicken_leg(cv, add(hip, (-1, 2)), feet[1], True)
    # 먼 날개
    sh = add(hip, (2, -8))
    for far, wa in ((True, -150 + wing), (False, -160 + wing)):
        tips = [polar(sh, wa + d, l) for d, l in ((-20, 11), (5, 13), (30, 9))]
        cv.part(poly(cv.blank(), [sh, tips[0], add(lerp(tips[0], tips[1], 0.5), (2, 2)), tips[1], add(lerp(tips[1], tips[2], 0.5), (2, 2)), tips[2]]),
                [MEMB[0]] * 4 if far else MEMB, ink=INK, gloss=False)
        if far:
            # 몸통(날개 사이)
            cv.part(ellipse(cv.blank(), add(hip, (3 + lean * 0.2, -5)), 9, 8), FEATH, ink=INK)
    chicken_leg(cv, add(hip, (2, 3)), feet[0], False)
    # 목 + 머리
    nb = add(hip, (8 + lean * 0.3, -10))
    hc = add(nb, (3 + neck, -9 - neck * 0.3))
    cv.part(chain([nb, lerp(nb, hc, 0.5), hc], [7, 5.4, 4.6]), FEATH, ink=INK, gloss=False)
    a = math.radians(tilt)
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    # 볏(톱니 셋)
    for k, dx in enumerate((-2, 0, 2)):
        cv.part(ellipse(cv.blank(), R(dx, -4 - k % 2 - comb_up), 1.8, 2.4 + comb_up * 0.4), COMB, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hc, 4.2, 3.8), FEATH, ink=INK)
    # 부리 + 턱볏
    cv.part(poly(cv.blank(), [R(3, -2), R(8, 0 - beak * 0.3), R(3, 1)]), BEAK, ink=INK, gloss=False)
    if beak:
        cv.part(poly(cv.blank(), [R(3, 1), R(7, 1 + beak), R(3, 2)]), BEAK, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), R(2, 4), 1.4, 2.2), COMB, ink=INK, gloss=False)
    e = rnd(R(1, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [e, add(e, (1, 0)), add(e, (1, 1)), add(e, (0, 1))]), EYE)
        cv.pixel(e[0] + 1, e[1], INK)
    return dict(eye=e, beak=R(8, 0))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        tp = bezier((26, 56), (14, 60), (4, 56), 6)
        cv.part(chain(tp, [7, 6, 5, 4, 3, 2.4, 1.8]), SCALE, ink=INK)
        cv.part(ellipse(cv.blank(), (32, 55), 8, 5), FEATH, ink=INK)
        cv.part(chain([(38, 54), (46, 55)], [4.6, 4]), FEATH, ink=INK, gloss=False)
        cv.part(ellipse(cv.blank(), (49, 55), 3.6, 3.2), FEATH, ink=INK)
        cv.part(poly(cv.blank(), [(52, 55), (56, 56), (52, 57)]), BEAK, ink=INK, gloss=False)
        cv.part(ellipse(cv.blank(), (48, 51), 2.4, 1.4), COMB, ink=INK, gloss=False)
        cv.line([(48, 54), (50, 56)], INK)
        cv.line([(50, 54), (48, 56)], INK)
        cv.line4([(30, 50), (28, 46), (31, 44)], BEAK[1])
        return cv.image()
    if name == "idle_a":
        cock(cv)
    elif name == "idle_b":
        cock(cv, neck=-1, tilt=8, wing=-15, tail=3, comb_up=1)
    elif name == "idle_c":
        cock(cv, neck=1, tilt=-6, beak=1, wing=10, tail=-3)
    elif name == "windup":  # 날개를 펴고 목을 뒤로 젖힌다
        j = cock(cv, x=28, lean=-6, neck=-3, tilt=-18, beak=2, wing=40, tail=4, comb_up=1, feet=((32, 60), (24, 60)))
        sparkle(cv, add(j["eye"], (2, -7)), WHITE, EYE)
    elif name == "move":
        speed_lines(cv, 1, 6, (34, 40, 46), FEATH[2])
        cock(cv, x=34, lean=8, neck=3, tilt=14, wing=-20, tail=6, feet=((44, 58), (30, 60)))
        puff(cv, (14, 58), 2.0, DUST)
    elif name == "attack":  # 부리로 쪼기
        j = cock(cv, x=31, lean=10, neck=6, tilt=40, beak=2, wing=20, feet=((37, 60), (26, 60)))
        burst(cv, add(j["beak"], (2, 1)), 4.0, BEAK[2], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 석화 시선
        j = cock(cv, x=26, lean=4, neck=5, tilt=0, beak=2, wing=30, tail=4, comb_up=2, feet=((31, 60), (23, 60)))
        e = j["eye"]
        cv.line([add(e, (1, 0)), (56, e[1] + 4)], RAY[0], width=3)
        cv.line([add(e, (1, 0)), (56, e[1] + 4)], RAY[2])
        glow(cv, add(e, (1, 0)), 2.2, RAY)
        for p, r in (((58, e[1] + 4), 3.0), ((60, e[1] - 1), 1.6), ((55, e[1] + 9), 1.8)):
            cv.part(ellipse(cv.blank(), p, r, r), STONE, ink=INK, gloss=False)
    elif name == "hit":
        j = cock(cv, x=27, lean=-8, neck=-4, tilt=-30, beak=1, eye="shut", wing=60, tail=-4, feet=((31, 60), (24, 59)))
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("cockatrice-01", draw, sys.argv[1:], idle_ms=200)
