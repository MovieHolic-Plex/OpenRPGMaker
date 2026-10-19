#!/usr/bin/env python3
"""바위 게(crab-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

돌 갑옷 바위 게(crab-rock, 높이 선 회색 몸)와 다른 윤곽: 납작하고 넓은 붉은 등딱지의 갯바위 게.
등딱지 앞 가장자리에 톱니, 위에 흰 반점, 앞쪽 눈자루 둘(등딱지 앞 가장자리에서 솟는 짧은 자루 끝의 검은 눈 —
머리가 따로 없는 게의 얼굴 축), 짝짝이 집게(가까운 집게가 훨씬 크다), 옆으로 벌린 마디 걷는 다리 넷씩.
6번 칸(스킬 거품 포): 큰 집게를 들어 올리고 입에서 아군 쪽으로 거품 덩어리를 뿜는다.

  python3 scripts/content/monsters/redraw_crab_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (34, 12, 10)
SHELL = [(150, 36, 26), (196, 62, 40), (230, 104, 70), (250, 150, 110)]
SHELL_FAR = [(110, 26, 20), (150, 36, 26), (170, 46, 32), (170, 46, 32)]
UNDER = [(200, 160, 120), (230, 200, 160), (246, 226, 196), (246, 226, 196)]
SPOT = (250, 220, 200)
EYE = (12, 10, 10)
FOAM = [(150, 200, 230), (210, 236, 250), (255, 255, 255)]
DUST = [(140, 120, 96), (180, 164, 136)]
WHITE = (255, 255, 255)
G = 60


def walk_leg(cv, root, knee, foot, far):
    ramp = SHELL_FAR if far else SHELL
    cv.part(chain([root, knee], [1.8, 1.6]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, foot], [1.6, 1.0]), ramp, ink=INK, gloss=False)


def claw(cv, root, ang, size, open_, far):
    ramp = SHELL_FAR if far else SHELL
    el = polar(root, ang - 40, 5 * size)
    hand = polar(el, ang, 4 * size)
    cv.part(chain([root, el, hand], [2.6 * size, 2.4 * size, 3 * size]), ramp, ink=INK, gloss=False)
    # 집게: 위 고정 손가락(두툼) + 아래 움직이는 손가락
    palm = [polar(hand, ang + 90, 3 * size), polar(hand, ang - 90, 3 * size), polar(polar(hand, ang, 5 * size), ang - 90, 2.4 * size),
            polar(polar(hand, ang, 5 * size), ang + 90, 2.4 * size)]
    cv.part(poly(cv.blank(), palm), ramp, ink=INK)
    tip = polar(hand, ang, 5 * size)
    up = [polar(tip, ang - 90, 2.2 * size), polar(tip, ang - 90, 0.4), polar(polar(tip, ang - open_ * 0.6, 6 * size), ang, 0)]
    lo = [polar(tip, ang + 90, 2.2 * size), polar(tip, ang + 90, 0.4), polar(tip, ang + open_, 5 * size)]
    cv.part(poly(cv.blank(), up), ramp, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), lo), ramp, ink=INK, gloss=False)
    cv.pixel(*rnd(polar(tip, ang - open_ * 0.6, 5 * size)), SHELL[3])
    return polar(tip, ang, 5 * size)


def crab(cv, c=(30, 46), lift=0, big=(-20, 20), small=(10, 25), stalk=0, eye="open", legs=0.0, mouth=False):
    x, y = c
    # 다리: 등딱지 아래에서 옆으로 벌어진 아치(무릎이 등딱지 옆선보다 높다). 먼 쪽 먼저, 모두 등딱지 뒤에
    spread = ((-21, -15), (-15, -12), (14, 12), (21, 15))
    for far in (True, False):
        for k, (fx, kx) in enumerate(spread):
            off = -2 if far else 1
            root = (x - 6 + k * 4 + off, y + 1)
            foot = (x + fx + off * 2 + legs * (1 if (k + far) % 2 else -1), G - (1 if far else 0))
            knee = (x + kx + off, y - 6 + abs(k - 1.5))
            walk_leg(cv, root, knee, foot, far)
    claw(cv, (x + 8, y), small[0], 0.7, small[1], True)
    # 등딱지: 넓고 납작한 사다리꼴, 앞 가장자리 톱니
    top = y - 9 - lift
    shell = [(x - 13, y + 2), (x - 15, y - 3), (x - 11, top + 1), (x - 2, top - 1), (x + 8, top), (x + 13, y - 5), (x + 14, y - 1),
             (x + 12, y + 3), (x - 6, y + 4)]
    cv.part(poly(cv.blank(), shell), SHELL, ink=INK, belly=UNDER[1])
    for dx in (9, 11, 13):
        cv.pixel(dx + x, int(y - 6 + (dx - 9) * 0.5), SHELL[3])
    for dx, dy in ((-7, -5), (-2, -7), (3, -6), (-4, -2)):
        cv.pixel(x + dx, y + dy - lift, SPOT)
    cv.line4([(x - 11, y), (x + 10, y + 1)], SHELL[0])
    # 눈자루 둘(등딱지 앞쪽에서 솟음)
    e1, e2 = (x + 7, top - 3 - stalk), (x + 10, top - 4 - stalk)
    for base, e in (((x + 6, top + 1), e1), ((x + 9, top + 1), e2)):
        cv.line4([rnd(base), rnd(e)], SHELL[1])
    for e in (e1, e2):
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (0, -1)), add(e, (0, 0)), add(e, (-1, 0))]), EYE)
            cv.pixel(e[0], e[1] - 1, WHITE)
    mouth_p = (x + 14, y - 2)
    if mouth:
        cv.put(ellipse(cv.blank(), mouth_p, 1.4, 1.4), (90, 20, 20))
    tip = claw(cv, (x + 10, y + 1), big[0], 1.0, big[1], False)
    return dict(eye=e2, tip=tip, mouth=mouth_p)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 뒤집혀 다리를 오므린 게
        cv.part(poly(cv.blank(), [(14, 58), (16, 50), (42, 49), (46, 58)]), UNDER, ink=INK)
        cv.line4([(20, 53), (40, 53)], UNDER[0])
        for k in range(5):
            walk_leg(cv, (18 + k * 5, 50), (17 + k * 5, 45), (20 + k * 5, 43), False)
        claw(cv, (44, 55), -10, 0.8, 5, False)
        cv.line([(32, 57), (34, 59)], EYE)
        return cv.image()
    if name == "idle_a":
        crab(cv)
    elif name == "idle_b":
        crab(cv, c=(30, 47), big=(-30, 30), small=(0, 15), stalk=1, legs=1)
    elif name == "idle_c":
        crab(cv, lift=1, big=(-10, 10), small=(15, 30), stalk=-1, legs=-1)
    elif name == "windup":  # 큰 집게를 높이 치켜든다
        j = crab(cv, c=(28, 46), lift=1, big=(-80, 35), small=(-40, 25), stalk=2)
        sparkle(cv, add(j["tip"], (0, -3)), WHITE, SHELL[3])
    elif name == "move":  # 옆걸음
        speed_lines(cv, 1, 8, (34, 40, 46), SHELL[2])
        crab(cv, c=(35, 46), big=(-15, 10), small=(10, 20), legs=3)
        puff(cv, (12, 58), 2.2, DUST)
    elif name == "attack":  # 집게로 꽉 집는다
        j = crab(cv, c=(30, 46), big=(-5, 2), small=(10, 20), stalk=1)
        burst(cv, add(j["tip"], (2, 0)), 4.0, (255, 220, 170), WHITE, spikes=6)
    elif name == "recover":  # 스킬: 거품 포
        j = crab(cv, c=(26, 46), lift=1, big=(-70, 30), small=(-30, 25), stalk=2, mouth=True)
        m = j["mouth"]
        for p, r in (((46, 42), 2.0), ((51, 39), 2.6), ((57, 41), 3.2), ((54, 48), 1.8), ((60, 34), 1.6), ((47, 48), 1.2)):
            cv.part(ellipse(cv.blank(), p, r, r), [FOAM[0], FOAM[1], FOAM[2], FOAM[2]], ink=(40, 70, 100), gloss=False)
        cv.line4([rnd(m), (44, 42)], FOAM[1])
    elif name == "hit":
        j = crab(cv, c=(27, 47), lift=-1, big=(60, 40), small=(70, 30), stalk=-2, eye="shut", legs=-2)
        e = j["eye"]
        for dx, dy in ((3, -6), (6, -4), (5, -9)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("crab-01", draw, sys.argv[1:], idle_ms=200)
