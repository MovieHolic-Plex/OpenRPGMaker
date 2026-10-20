#!/usr/bin/env python3
"""연보라 가면 정령(spirit-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

다리 없이 떠 있는 연보라 정령: 얼굴 자리에 뼈처럼 흰 가면(눈구멍 안에서 노란 빛이 탄다)을 썼고,
머리 위로 토끼처럼 긴 귀 둘이 뒤로 젖혀져 있다. 목에는 빛바랜 금 목걸이(가운데 붉은 장식),
몸은 아래로 갈수록 가늘어져 분홍·보라 리본 꼬리 세 갈래로 겹겹이 풀려 뒤로 끌린다.
작은 유령 손(손톱 셋)이 몸 앞에 떠 있다. 유령(ghost/specter/wraith/banshee)과 달리 천 자락이 아니라
가면 얼굴·토끼 귀·금 목걸이·리본 꼬리가 정체성이다.
6번 칸(스킬 혼불): 꼬리를 뒤로 펼치고 손을 내밀어 보라 혼불 셋을 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_spirit_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, bezier, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, slash,
                       sparkle, speed_lines)

INK = (30, 18, 46)
BODY = [(112, 82, 156), (156, 122, 198), (196, 168, 228), (234, 218, 250)]
BODY_FAR = [(86, 62, 124), (112, 82, 156), (138, 104, 180), (138, 104, 180)]
RIB_A = [(132, 56, 124), (190, 92, 166), (232, 146, 202), (252, 198, 230)]
RIB_B = [(92, 50, 140), (140, 84, 190), (184, 130, 226), (184, 130, 226)]
MASK = [(178, 168, 150), (226, 220, 204), (246, 243, 232), (255, 255, 250)]
GOLD = [(104, 80, 34), (150, 118, 50), (192, 160, 80), (230, 206, 128)]
GEM = (190, 40, 60)
EYE = (255, 214, 70)
EYE_HI = (255, 250, 196)
EAR_IN = (232, 160, 206)
WISP = [(108, 46, 168), (168, 98, 230), (222, 182, 255)]
WHITE = (255, 255, 255)


def spirit(cv, c, lean=0.0, ear=0.0, sway=0.0, arm=40.0, eye="open", stream=0.0, reach=7.0):
    """c = 몸 가운데. lean 은 앞(+)으로 숙임, sway 는 꼬리 끝 흔들림, stream 은 꼬리를 뒤로 눕히는 정도."""
    a = math.radians(lean)

    def R(dx, dy):
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))

    hc = R(3, -12)
    # 먼 귀(뒤, 짙게)
    er = R(-1, -17)
    etip = polar(er, -128 - ear * 1.2, 12)
    cv.part(chain([er, lerp(er, etip, 0.5), etip], [3.2, 3.6, 1.6]), BODY_FAR, ink=INK, gloss=False)
    # 리본 꼬리(뒤 → 앞). 몸 아래에서 갈라져 왼쪽 아래로 흐르다 끝이 말려 올라간다.
    def trail(offs, ph):
        n = len(offs) - 1
        out = []
        for i, (dx, dy) in enumerate(offs):
            t = i / n
            out.append(add(c, (dx - stream * 1.3 * t, dy - stream * 0.55 * t + sway * t * t * ph)))
        return out
    tails = (
        (RIB_B, [(-3, 3), (-9, 6), (-15, 6), (-20, 3), (-23, -1), (-22, -4)], 1.0, [5.0, 5.0, 4.4, 3.4, 2.0, 1.0]),
        (RIB_A, [(-1, 8), (-6, 14), (-12, 18), (-18, 19), (-22, 17), (-23, 14)], -1.0, [5.4, 5.4, 4.8, 3.6, 2.2, 1.0]),
    )
    for ramp, offs, ph, w in tails:
        pts = trail(offs, ph)
        cv.part(chain(pts, w), ramp, ink=INK, gloss=False)
        cv.line([lerp(pts[1], pts[2], 0.3), lerp(pts[3], pts[4], 0.3)], ramp[2])
    # 몸통 + 가운데 꼬리(한 덩이): 위가 둥근 물방울, 아래로 가늘어지며 갈고리처럼 말린다
    sp = trail([(1, -3), (0, 4), (-4, 10), (-10, 13), (-15, 12), (-18, 8), (-17, 5)], 0.6)
    cv.part(chain(sp, [12.0, 14.0, 11.0, 7.6, 5.0, 3.0, 1.4]), BODY, ink=INK)
    cv.put(ellipse(cv.blank(), R(4, 1), 2.4, 3.4), BODY[2])
    cv.pixel(*rnd(R(5, -1)), BODY[3])
    # 몸 앞자락을 따라 흐르는 분홍 리본 띠(겹겹이 보이게)
    fr = trail([(5, 3), (2, 9), (-4, 12), (-10, 13)], 0.6)
    cv.line4(fr, RIB_A[2])
    # 금 목걸이
    nk = R(1, -6)
    cv.part(ellipse(cv.blank(), nk, 6.4, 2.2), GOLD, ink=INK)
    cv.line([add(nk, (-4, 0)), add(nk, (3, 0))], GOLD[0])
    md = R(4, -4)
    cv.part(ellipse(cv.blank(), md, 1.6, 1.6), GOLD, ink=INK, gloss=False)
    cv.pixel(*rnd(md), GEM)
    # 머리 + 가면
    cv.part(ellipse(cv.blank(), hc, 7.0, 6.6), BODY, ink=INK)
    mc = R(6, -12)
    mask = poly(cv.blank(), [R(1.5, -18), R(7, -18.5), R(10, -15), R(10.5, -10), R(8, -6.5), R(4.5, -6),
                             R(2, -9), R(1.5, -14)])
    cv.part(mask, MASK, ink=INK)
    # 가면 금(왼쪽 위)
    cv.line([R(3, -17), R(4, -15)], MASK[0])
    # 눈구멍 둘(먼 눈 작게, 가까운 눈 크게) + 입 틈
    for (dx, dy, big) in ((4, -13, False), (8, -13, True)):
        e = rnd(R(dx, dy))
        if eye == "x":
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], INK)
            cv.line([add(e, (1, -1)), add(e, (-1, 1))], INK)
            continue
        if big:
            cv.put(poly(cv.blank(), [add(e, (-1, -2)), add(e, (1, -2)), add(e, (1, 1)), add(e, (-1, 1))]), INK)
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (0, -1)), add(e, (0, 1)), add(e, (-1, 1))]), INK)
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (big, 0))], EYE)
        elif big:
            cv.put(poly(cv.blank(), [add(e, (0, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (0, 0))]), EYE)
            cv.pixel(e[0], e[1] - 1, EYE_HI)
            if eye == "glow":
                cv.pixel(e[0] + 1, e[1] - 1, EYE_HI)
        else:
            cv.pixel(e[0], e[1], EYE)
            cv.pixel(e[0], e[1] - 1 if eye == "glow" else e[1], EYE if eye != "glow" else EYE_HI)
    cv.line([R(6, -9), R(8, -9)], MASK[0])
    # 가까운 귀(앞, 밝게) — 머리 뒤 위로 길게
    er = R(2, -18)
    etip = polar(er, -112 - ear, 14)
    cv.part(chain([er, lerp(er, etip, 0.45), etip], [3.6, 4.2, 1.8]), BODY, ink=INK, gloss=False)
    cv.line([lerp(er, etip, 0.2), lerp(er, etip, 0.8)], EAR_IN)
    # 유령 손
    sh = R(5, -1)
    hand = polar(sh, arm, reach)
    cv.part(chain([sh, lerp(sh, hand, 0.6), hand], [3.0, 2.2, 2.6]), BODY, ink=INK, gloss=False)
    for k in (-40, 0, 40):
        tip = polar(hand, arm + k, 3)
        cv.line4([hand, tip], BODY[3])
        cv.pixel(*rnd(tip), INK)
    return dict(head=hc, hand=hand, mask=mc, c=c)


def orb(cv, c, r):
    """보라 혼불: 둥근 머리 + 뒤로 끌리는 불꼬리."""
    tail = [add(c, (-r * 0.4, 0)), add(c, (-r * 1.6, -r * 0.4)), add(c, (-r * 2.6, -r * 0.1))]
    cv.put(chain(tail, [r * 1.6, r * 1.0, 0.8]), WISP[0])
    glow(cv, c, r, [WISP[0], WISP[1], WISP[2]])
    cv.pixel(*rnd(add(c, (r * 0.3, -r * 0.3))), WHITE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 가면이 떨어지고 몸이 바닥에 풀려 퍼진다
        cv.part(chain(bezier((8, 58), (18, 55), (30, 57), 4), [1.2, 3.0, 4.0, 4.6, 4.8]), RIB_B, ink=INK, gloss=False)
        cv.part(chain(bezier((12, 59), (24, 57), (34, 58), 4), [1.0, 2.6, 3.6, 4.2, 4.4]), RIB_A, ink=INK, gloss=False)
        cv.part(ellipse(cv.blank(), (33, 56), 7.5, 3.6), BODY, ink=INK)
        cv.part(chain([(30, 53), (24, 50), (18, 51)], [3.0, 3.4, 1.6]), BODY_FAR, ink=INK, gloss=False)
        cv.part(ellipse(cv.blank(), (38, 54), 4.5, 1.6), GOLD, ink=INK)
        mask = poly(cv.blank(), [(42, 50), (49, 49), (52, 53), (50, 58), (44, 58), (41, 55)])
        cv.part(mask, MASK, ink=INK)
        for e in ((45, 53), (49, 53)):
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], INK)
            cv.line([add(e, (1, -1)), add(e, (-1, 1))], INK)
        cv.line([(47, 50), (46, 52)], MASK[0])
        puff(cv, (55, 57), 1.6, [WISP[0], WISP[1]])
        return cv.image()
    if name == "idle_a":
        spirit(cv, (30, 33))
    elif name == "idle_b":
        spirit(cv, (30, 32), ear=8, sway=4, arm=48)
    elif name == "idle_c":
        spirit(cv, (30, 34), ear=-6, sway=-4, arm=32, eye="glow")
    elif name == "windup":  # 몸을 젖히고 손을 뒤로 들어 손톱을 세운다
        j = spirit(cv, (28, 34), lean=-14, ear=14, sway=3, arm=-160, reach=7, eye="glow")
        sparkle(cv, add(j["hand"], (0, -4)), WHITE, WISP[2])
    elif name == "move":  # 꼬리를 뒤로 눕히고 앞으로 미끄러진다
        speed_lines(cv, 1, 9, (28, 36, 44), BODY_FAR[2])
        spirit(cv, (36, 32), lean=12, ear=18, stream=6, sway=-1, arm=20)
    elif name == "attack":  # 유령 손으로 할퀸다
        j = spirit(cv, (34, 32), lean=10, ear=10, stream=3, arm=10, reach=10, eye="glow")
        h = j["hand"]
        for k in (-4, 0, 4):
            slash(cv, add(h, (3, -9 + k)), add(h, (9, 3 + k)), 2, 1.8, WISP[1], WHITE)
    elif name == "recover":  # 스킬: 보라 혼불 셋
        j = spirit(cv, (24, 32), lean=4, ear=12, stream=-1, sway=3, arm=-10, reach=8, eye="glow")
        h = j["hand"]
        for (dx, dy, r) in ((5, -2, 2.0), (13, -8, 2.6), (21, 0, 3.2)):
            orb(cv, add(h, (dx, dy)), r)
        sparkle(cv, add(h, (16, 7)), WHITE, WISP[1])
        sparkle(cv, add(h, (12, -13)), WHITE, WISP[2])
    elif name == "hit":  # 뒤로 밀리며 가면 눈빛이 꺼진다
        j = spirit(cv, (26, 34), lean=-18, ear=22, sway=-3, stream=-2, arm=70, eye="shut")
        m = j["mask"]
        for dx, dy in ((9, -6), (11, -2), (12, -8)):
            cv.pixel(m[0] + dx, m[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("spirit-01", draw, sys.argv[1:], idle_ms=200)
