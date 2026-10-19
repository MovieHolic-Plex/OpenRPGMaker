#!/usr/bin/env python3
"""남청색 전갈(scorpion-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

모래 전갈(scorpion-sand, 황토색·높이 선 몸)과 다른 윤곽: 땅에 납작 붙은 짙은 남청 광택 전갈.
넓고 낮은 머리가슴(앞 가장자리 가운데 작은 눈 한 쌍이 머리 안에), 일곱 마디 배, 마디 다섯 개짜리 꼬리가
등 위로 크게 C 자로 말려 앞을 향한 청록 독침, 앞으로 길게 뻗은 넓적한 집게발 둘, 옆으로 벌린 다리 넷 쌍.
6번 칸(스킬 독침 사격): 꼬리를 앞으로 튕겨 독침에서 청록 독침 세 발이 아군 쪽으로 날아간다.

  python3 scripts/content/monsters/redraw_scorpion_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (8, 10, 24)
SHELL = [(26, 34, 70), (44, 56, 108), (72, 88, 150), (130, 150, 210)]
SHELL_FAR = [(18, 24, 50), (26, 34, 70), (34, 44, 88), (34, 44, 88)]
STING = [(30, 130, 120), (70, 200, 180), (180, 255, 240), (180, 255, 240)]
EYE = (230, 220, 120)
DUST = [(100, 96, 90), (150, 144, 130)]
WHITE = (255, 255, 255)
G = 60


def leg(cv, root, knee, foot, far):
    ramp = SHELL_FAR if far else SHELL
    cv.part(chain([root, knee], [1.8, 1.5]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, foot], [1.5, 1.0]), ramp, ink=INK, gloss=False)


def pincer(cv, root, ang, open_, far):
    ramp = SHELL_FAR if far else SHELL
    el = polar(root, ang - 25, 5)
    hand = polar(el, ang + 10, 5)
    cv.part(chain([root, el, hand], [2.2, 2.2, 3.6]), ramp, ink=INK, gloss=False)
    tip = polar(hand, ang, 5)
    cv.part(poly(cv.blank(), [polar(hand, ang - 90, 2.6), polar(tip, ang - open_, 3), tip, polar(hand, ang + 90, 1)]), ramp, ink=INK)
    cv.part(poly(cv.blank(), [polar(hand, ang + 90, 2.2), polar(tip, ang + open_ * 0.8, 3), polar(hand, ang, 2)]), ramp, ink=INK, gloss=False)
    return tip


def scorpion(cv, x=26, y=52, tail_curl=0.0, tail_lift=0, near_claw=(-5, 18), far_claw=(-12, 14), legs=0.0, eye="open", rear=0):
    # 먼 다리 + 먼 집게
    for k in range(4):
        root = (x - 2 + k * 3, y + 1)
        leg(cv, root, (x - 4 + k * 5, y - 5), (x - 8 + k * 6 + legs * (1 if k % 2 else -1), G - 1), True)
    pincer(cv, (x + 9, y - 1), far_claw[0], far_claw[1], True)
    # 꼬리: 배 끝에서 등 위로 C 자. 마디 다섯 + 독침
    base = (x - 9, y - 2 - rear)
    pts = [base]
    ang = -125 - tail_lift
    for k in range(5):
        ang += 22 + tail_curl
        pts.append(polar(pts[-1], ang, 5.2 - k * 0.3))
    for k in range(5, 0, -1):
        cv.part(ellipse(cv.blank(), pts[k], 2.6 - k * 0.15, 2.6 - k * 0.15), SHELL, ink=INK)
    tip_base = pts[-1]
    sting_tip = polar(tip_base, ang + 50, 5)
    cv.part(poly(cv.blank(), [polar(tip_base, ang - 40, 2.2), polar(tip_base, ang + 140, 2.2), sting_tip]), STING, ink=INK, gloss=False)
    # 배 일곱 마디(뒤 → 앞, 낮게)
    for k in range(7):
        c = (x - 8 + k * 2.4, y - 1 - rear * (1 - k / 7))
        cv.part(ellipse(cv.blank(), c, 2.8, 3.4 - abs(k - 3) * 0.15), SHELL, ink=INK)
    # 머리가슴(넓고 낮다)
    cv.part(poly(cv.blank(), [(x + 6, y + 2), (x + 6, y - 4), (x + 10, y - 6), (x + 15, y - 4), (x + 16, y), (x + 14, y + 2)]), SHELL, ink=INK)
    e = (x + 13, y - 4)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] - 2, e[1], EYE)
    # 가까운 다리 + 가까운 집게
    for k in range(4):
        root = (x + k * 3, y + 2)
        leg(cv, root, (x - 2 + k * 5, y - 3), (x - 5 + k * 7 + legs * (-1 if k % 2 else 1), G), False)
    tip = pincer(cv, (x + 14, y), near_claw[0], near_claw[1], False)
    return dict(eye=e, sting=sting_tip, claw=tip)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 뒤집혀 꼬리를 늘어뜨림
        for k in range(7):
            cv.part(ellipse(cv.blank(), (20 + k * 2.4, 56), 2.6, 3), SHELL, ink=INK)
        cv.part(chain([(18, 56), (12, 57), (7, 55), (4, 57)], [3, 2.6, 2.2, 1.6]), SHELL, ink=INK, gloss=False)
        cv.part(poly(cv.blank(), [(34, 58), (35, 52), (42, 51), (44, 58)]), SHELL, ink=INK)
        for k in range(4):
            cv.line4([(24 + k * 4, 53), (25 + k * 4, 48)], SHELL[2])
        pincer(cv, (43, 56), 0, 8, False)
        cv.line([(38, 53), (40, 55)], INK)
        return cv.image()
    if name == "idle_a":
        scorpion(cv)
    elif name == "idle_b":
        scorpion(cv, tail_curl=2, tail_lift=4, near_claw=(-10, 24), far_claw=(-16, 20), legs=1)
    elif name == "idle_c":
        scorpion(cv, tail_curl=-2, tail_lift=-3, near_claw=(0, 12), far_claw=(-8, 10), legs=-1)
    elif name == "windup":  # 꼬리를 뒤로 크게 젖히고 집게를 벌린다
        j = scorpion(cv, tail_curl=-6, tail_lift=12, near_claw=(-30, 30), far_claw=(-40, 28), rear=2)
        sparkle(cv, add(j["sting"], (0, -2)), WHITE, STING[1])
    elif name == "move":
        speed_lines(cv, 1, 7, (40, 46, 52), SHELL[2])
        scorpion(cv, x=31, tail_curl=1, near_claw=(5, 10), far_claw=(-2, 8), legs=3)
        puff(cv, (10, 58), 2.0, DUST)
    elif name == "attack":  # 꼬리를 앞으로 내리꽂는다
        j = scorpion(cv, x=27, tail_curl=10, tail_lift=-6, near_claw=(5, 6), far_claw=(-5, 6))
        burst(cv, add(j["sting"], (2, 1)), 4.0, STING[2], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 독침 세 발
        j = scorpion(cv, x=22, tail_curl=6, tail_lift=-2, near_claw=(-20, 20), far_claw=(-30, 20), rear=1)
        s = j["sting"]
        for k, end in enumerate(((60, s[1] - 6), (61, s[1] + 2), (59, s[1] + 10))):
            a = math.degrees(math.atan2(end[1] - s[1], end[0] - s[0]))
            start = lerp(s, end, 0.35)
            cv.line([start, polar(end, a + 180, 3)], STING[0])
            cv.put(poly(cv.blank(), [end, polar(end, a + 150, 3), polar(end, a - 150, 3)]), STING[1])
        sparkle(cv, add(s, (2, -1)), WHITE, STING[1], big=True)
    elif name == "hit":
        j = scorpion(cv, x=24, tail_curl=-4, tail_lift=16, near_claw=(-50, 30), far_claw=(-60, 30), legs=-2, eye="shut", rear=3)
        e = j["eye"]
        for dx, dy in ((3, -6), (6, -4), (5, -9)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("scorpion-01", draw, sys.argv[1:], idle_ms=190)
