#!/usr/bin/env python3
"""뼈 무더기 기어다니는 놈(bonepile-crawler) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

다리 넷 짐승 해골이 아니라 뼈를 쌓아 올린 무더기: 바닥에 넓게 깔린 뼈 더미(갈비뼈·넓적다리뼈·작은 두개골 둘이 박힘)
앞쪽에서 큰 사람 두개골이 고개를 내밀고, 그 아래 뼈 팔 둘(굵은 위팔·아래팔·갈퀴 손가락)로 땅을 짚고 무더기를 끌고 온다.
두개골 눈구멍 안에 초록 혼불(눈은 두개골 얼굴 안에만). 턱이 따로 움직인다.
6번 칸(스킬 뼈 조각 비): 팔을 치켜들어 무더기에서 뼈 조각을 아군 쪽으로 흩뿌린다(초록 혼불 꼬리).

  python3 scripts/content/monsters/redraw_bonepile_crawler.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (34, 26, 16)
BONE = [(150, 130, 96), (200, 182, 140), (232, 220, 186), (250, 244, 222)]
BONE_FAR = [(110, 94, 70), (150, 130, 96), (170, 150, 112), (170, 150, 112)]
SOCKET = (30, 20, 16)
SOUL = [(40, 140, 70), (110, 230, 120), (220, 255, 210)]
DUST = [(110, 96, 80), (150, 136, 112)]
WHITE = (255, 255, 240)
G = 60


def femur(cv, a, b, ramp, w=1.6):
    cv.part(chain([a, b], [w, w]), ramp, ink=INK, gloss=False)
    for p in (a, b):
        cv.part(ellipse(cv.blank(), p, w + 0.9, w + 0.9), ramp, ink=INK, gloss=False)


def small_skull(cv, c, ramp, face=1):
    cv.part(ellipse(cv.blank(), c, 3.2, 2.8), ramp, ink=INK)
    cv.pixel(*rnd(add(c, (face, 0))), SOCKET)


def pile(cv, x, heave=0):
    """바닥 무더기: 뒤쪽 넓게, 위로 갈비뼈·넓적다리뼈가 삐죽."""
    base = [(x - 22, G), (x - 20, 50 - heave), (x - 12, 44 - heave), (x - 2, 42 - heave), (x + 6, 46 - heave), (x + 8, G)]
    cv.part(poly(cv.blank(), base), BONE_FAR, ink=INK, gloss=False)
    femur(cv, (x - 18, 49 - heave), (x - 6, 41 - heave), BONE)
    femur(cv, (x - 14, 56), (x + 2, 52 - heave), BONE)
    for k in range(4):  # 갈비뼈 아치
        c = (x - 9 + k * 3, 48 - heave)
        cv.line4([rnd(add(c, (-2, 3))), rnd(add(c, (-1, -2))), rnd(add(c, (2, -3)))], BONE[2])
    small_skull(cv, (x - 16, 55), BONE)
    small_skull(cv, (x - 4, 45 - heave), BONE, face=-1)


def arm(cv, sh, hand, far=False, claw=0):
    ramp = BONE_FAR if far else BONE
    el = add(lerp(sh, hand, 0.5), (2, -6))
    cv.part(chain([sh, el], [1.8, 1.6]), ramp, ink=INK, gloss=False)
    cv.part(chain([el, hand], [1.4, 1.2]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), el, 1.8, 1.8), ramp, ink=INK, gloss=False)
    h = rnd(hand)
    for d in (-1, 1, 3):
        cv.line4([h, (h[0] + 3 + claw, h[1] + d)], ramp[2])


def skull(cv, c, tilt=0, jaw=0, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jw = math.radians(jaw)
    hinge = R(-2, 3)
    J = lambda dx, dy: (hinge[0] + dx * math.cos(a + jw) - dy * math.sin(a + jw), hinge[1] + dx * math.sin(a + jw) + dy * math.cos(a + jw))
    cv.part(poly(cv.blank(), [J(0, -1), J(9, -1), J(9, 2), J(1, 3)]), BONE, ink=INK, gloss=False)
    for k in range(3):
        cv.pixel(*rnd(J(3 + k * 2, -1)), BONE[3])
    cv.part(ellipse(cv.blank(), R(0, -2), 7.2, 6.4), BONE, ink=INK)
    cv.part(poly(cv.blank(), [R(2, 1), R(8, 0), R(8, 3), R(3, 4)]), BONE, ink=INK, gloss=False)
    for k in range(3):
        cv.pixel(*rnd(R(4 + k * 1.6, 3)), BONE[3])
    cv.pixel(*rnd(R(6, 0)), SOCKET)  # 코 구멍
    e = rnd(R(3, -3))
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (2, -1)), add(e, (2, 1)), add(e, (-1, 1))]), SOCKET)
    if eye == "open":
        cv.pixel(e[0], e[1], SOUL[1])
        cv.pixel(e[0] + 1, e[1], SOUL[2])
    elif eye == "x":
        cv.pixel(e[0], e[1] - 1, BONE[0])
        cv.pixel(e[0] + 1, e[1], BONE[0])
    cv.line([rnd(R(-4, -6)), rnd(R(-1, -4))], BONE[0])  # 금
    return dict(eye=e, mouth=J(9, 1))


def crawler(cv, x=34, heave=0, reach=0, lift=0, tilt=0, jaw=0, eye="open", claw=0):
    sh_far, sh = (x + 1, 46 - heave), (x + 3, 48 - heave)
    arm(cv, sh_far, (x + 13 + reach * 0.6, G - 2 - lift * 0.5), far=True, claw=claw)
    pile(cv, x, heave)
    j = skull(cv, (x + 6 + reach * 0.3, 38 - heave - lift * 0.3), tilt, jaw, eye)
    arm(cv, sh, (x + 15 + reach, G - lift), claw=claw)
    return j


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 무너져 흩어진 뼈
        for a, b in (((8, 58), (20, 55)), ((22, 59), (34, 57)), ((14, 52), (24, 50))):
            femur(cv, a, b, BONE)
        small_skull(cv, (30, 52), BONE)
        cv.part(ellipse(cv.blank(), (44, 55), 6.4, 5.0), BONE, ink=INK)
        cv.line([(45, 53), (47, 55)], SOCKET)
        cv.line([(47, 53), (45, 55)], SOCKET)
        cv.part(poly(cv.blank(), [(39, 59), (49, 59), (48, 61), (40, 61)]), BONE_FAR, ink=INK, gloss=False)
        return cv.image()
    if name == "idle_a":
        crawler(cv)
    elif name == "idle_b":
        crawler(cv, heave=1, reach=-1, jaw=8)
    elif name == "idle_c":
        crawler(cv, heave=-1, reach=1, tilt=-6, claw=1)
    elif name == "windup":  # 팔을 치켜들고 턱을 벌림
        j = crawler(cv, x=30, heave=3, lift=10, reach=-4, tilt=-14, jaw=20)
        sparkle(cv, add(j["eye"], (1, -8)), WHITE, SOUL[1])
    elif name == "move":
        speed_lines(cv, 1, 6, (42, 48, 54), BONE[1])
        crawler(cv, x=38, reach=4, tilt=6)
        puff(cv, (14, 58), 2.2, DUST)
    elif name == "attack":  # 갈퀴 손으로 내리찍고 문다
        j = crawler(cv, x=36, heave=-2, reach=8, tilt=14, jaw=26, claw=2)
        burst(cv, (55, 56), 4.2, BONE[3], WHITE, spikes=7)
    elif name == "recover":  # 스킬: 뼈 조각 비
        j = crawler(cv, x=28, heave=4, lift=14, reach=-2, tilt=-10, jaw=30)
        for k, (p, ang) in enumerate((((44, 20), -30), ((52, 28), -12), ((58, 18), -40), ((56, 40), 10), ((48, 34), -5))):
            tail = polar(p, ang + 180, 5)
            cv.line([tail, p], SOUL[0])
            cv.part(chain([polar(p, ang + 180, 1.5), polar(p, ang, 1.5)], [1.2, 1.2]), BONE, ink=INK, gloss=False)
        sparkle(cv, (60, 30), WHITE, SOUL[1], big=True)
    elif name == "hit":
        j = crawler(cv, x=31, heave=-2, reach=-6, lift=4, tilt=-24, jaw=12, eye="x")
        e = j["eye"]
        for dx, dy in ((5, -8), (8, -6), (7, -11)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bonepile-crawler", draw, sys.argv[1:], idle_ms=200)
