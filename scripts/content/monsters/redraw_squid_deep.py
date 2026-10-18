#!/usr/bin/env python3
"""심해 오징어(squid-deep) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

짙은 보라 두꺼운 외투막이 뒤·위로 비스듬히 뻗고(끝에 마름모 지느러미 둘), 머리에 큰 황금 눈,
머리 아래에서 아군 쪽(오른쪽)으로 굵은 흡반 팔 여덟이 말려 뻗고 그중 긴 촉완 둘이 더 멀리 나간다.
몸에 청록빛 발광점이 줄지어 있다. 물속처럼 떠서 흔들린다.
6번 칸(스킬): 몸을 부풀리며 아군 쪽으로 검은 먹물 구름을 뿜는다.

  python3 scripts/content/monsters/redraw_squid_deep.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, arc_trail, bezier, burst, chain, ellipse, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (20, 10, 30)
BODY = [(58, 26, 78), (90, 42, 116), (130, 66, 156), (180, 120, 200)]
BODY_FAR = [(40, 18, 56), (58, 26, 78), (74, 34, 98), (74, 34, 98)]
SUCKER = (220, 180, 210)
EYE = [(140, 96, 20), (240, 196, 50), (255, 244, 170)]
PUPIL = INK
GLOW = (90, 230, 210)
SMOKE = [(36, 24, 48), (64, 48, 82), (100, 84, 120), (140, 126, 160)]
WHITE = (255, 250, 255)


def arm(cv, base, ang, ln, curl, w, ramp, suckers=True):
    """밑동 base 에서 ang 방향으로 뻗다가 curl 만큼 말리는 흡반 팔. 끝 좌표를 돌려준다."""
    pts, p, a = [base], base, ang
    n = 6
    for i in range(n):
        p = polar(p, a, ln / n)
        a += curl * (i / n) * 1.4
        pts.append(p)
    widths = [w * (1 - i / (n + 1)) + 0.6 for i in range(n + 1)]
    cv.part(chain(pts, widths), ramp, gloss=False)
    if suckers:
        for q in pts[2:-1:2]:
            cv.pixel(*rnd(polar(q, a + 90 if curl >= 0 else a - 90, 0.5)), SUCKER)
    return pts[-1]


def figure(cv, c, tilt=0.0, puff_k=1.0, reach=1.0, curl=1.0, eye="open", spread=0.0):
    """c = 머리(눈) 중심. tilt: 외투막 각 보정. reach: 팔 길이 배율. curl: 팔 말림 배율."""
    mant_ang = -150 + tilt  # 외투막이 뻗는 방향(뒤·위)
    tip = polar(c, mant_ang, 22 * puff_k)
    # 지느러미 둘(외투막 끝)
    for side in (-1, 1):
        f0 = polar(tip, mant_ang + 180, 3)
        cv.part(poly(cv.blank(), [polar(f0, mant_ang + 90 * side, 1), polar(tip, mant_ang + 70 * side, 7),
                                  polar(tip, mant_ang, 2), polar(f0, mant_ang + 180, 4)]), BODY, gloss=False)
    # 먼 쪽 팔(뒤에 깔림)
    head_base = polar(c, mant_ang + 180, 3)
    for k, (da, ln, cu) in enumerate(((25, 15, 18), (55, 13, 22), (80, 11, 26))):
        arm(cv, add(head_base, (0, 2)), da + spread * 0.6, ln * reach, cu * curl, 2.6, BODY_FAR, suckers=False)
    # 외투막: 머리에서 끝으로 가늘어지는 두꺼운 원뿔
    w0 = 9.5 * puff_k
    side = mant_ang + 90
    body = [polar(c, side, w0 * 0.85), polar(polar(c, mant_ang, 10 * puff_k), side, w0),
            polar(polar(c, mant_ang, 18 * puff_k), side, w0 * 0.55), tip,
            polar(polar(c, mant_ang, 18 * puff_k), side + 180, w0 * 0.55),
            polar(polar(c, mant_ang, 10 * puff_k), side + 180, w0 * 0.95), polar(c, side + 180, w0 * 0.8)]
    cv.part(poly(cv.blank(), body), BODY)
    cv.line4([rnd(polar(polar(c, mant_ang, 4), side + 180, w0 * 0.6)), rnd(polar(polar(c, mant_ang, 16 * puff_k), side + 180, w0 * 0.35))], BODY[3])
    for t in (6, 11, 16):  # 발광점 줄
        cv.pixel(*rnd(polar(polar(c, mant_ang, t * puff_k), side, w0 * 0.3)), GLOW)
    # 머리 + 큰 황금 눈
    cv.part(ellipse(cv.blank(), add(c, (1, 1)), 6.5, 6.0), BODY)
    if eye == "shut":
        cv.line4([rnd(add(c, (-2, 0))), rnd(add(c, (3, 1)))], INK)
    else:
        cv.put(ellipse(cv.blank(), c, 3.4, 3.0), EYE[1])
        cv.put(ellipse(cv.blank(), add(c, (0.6, 0.6)), 1.6, 1.4 if eye == "open" else 0.6), PUPIL)
        cv.pixel(*rnd(add(c, (-1.4, -1.4))), EYE[2])
        if eye == "angry":
            cv.line4([rnd(add(c, (-3, -4))), rnd(add(c, (3, -3)))], INK)
    # 가까운 쪽 팔 다섯 + 긴 촉완 둘(아군 쪽)
    tips = []
    for da, ln, cu, w in ((-15, 14, -14, 3.0), (10, 17, 16, 3.2), (35, 15, 20, 3.0), (60, 13, 24, 2.8)):
        tips.append(arm(cv, add(head_base, (2, 3)), da + spread, ln * reach, cu * curl, w, BODY))
    long_tips = []
    for da, cu in ((-5 - spread * 0.3, 8), (22 + spread * 0.3, 10)):
        long_tips.append(arm(cv, add(head_base, (3, 3)), da, 23 * reach, cu * curl, 1.8, BODY, suckers=False))
    for t in long_tips:  # 촉완 끝 곤봉
        cv.part(ellipse(cv.blank(), t, 2.0, 1.6), BODY, gloss=False)
        cv.pixel(*rnd(t), SUCKER)
    return dict(head=c, tip=tip, tips=tips, long=long_tips)


POSES = dict(
    idle_a=dict(c=(30, 30), tilt=0, reach=1.0, curl=1.0),
    idle_b=dict(c=(30, 28), tilt=-4, reach=0.92, curl=1.25, spread=-6),
    idle_c=dict(c=(30, 31), tilt=4, reach=1.06, curl=0.8, spread=6),
    windup=dict(c=(26, 30), tilt=-14, reach=0.75, curl=1.7, puff_k=1.05, eye="angry", spread=-14),
    move=dict(c=(34, 30), tilt=10, reach=1.08, curl=0.3, puff_k=0.95, eye="angry", spread=-10),
    attack=dict(c=(30, 30), tilt=4, reach=1.25, curl=0.15, eye="angry", spread=6),
    recover=dict(c=(28, 28), tilt=-8, reach=0.85, curl=1.4, puff_k=1.12, eye="angry", spread=20),
    hit=dict(c=(25, 32), tilt=-22, reach=0.8, curl=2.0, eye="shut", spread=-20),
)


def draw_dead(cv):
    """바닥에 축 늘어진 오징어: 외투막이 옆으로 눕고 팔이 흩어진다, 눈은 감겼다."""
    cv.part(poly(cv.blank(), [(6, 56), (12, 50), (26, 48), (34, 52), (34, 58), (10, 59)]), BODY)
    cv.part(poly(cv.blank(), [(4, 58), (8, 52), (10, 59)]), BODY, gloss=False)
    cv.line4([(14, 51), (28, 50)], BODY[3])
    for x in (16, 22, 28):
        cv.pixel(x, 55, GLOW)
    cv.part(ellipse(cv.blank(), (36, 54), 5, 4.5), BODY)
    cv.line4([(34, 53), (38, 54)], INK)
    for (a, b, c2) in (((40, 56), (48, 58), (54, 55)), ((40, 54), (46, 52), (52, 54)), ((39, 58), (50, 59), (58, 58))):
        cv.part(chain([a, b, c2], [2.4, 1.6, 0.8]), BODY, gloss=False)
    puff(cv, (52, 50), 2.2, SMOKE[1:])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 2, 8, (36, 30, 52), BODY[2])
    J = figure(cv, **P)
    if name == "attack":
        for t in J["long"]:
            burst(cv, (min(t[0] + 2, 60), t[1]), 3.6, SUCKER, WHITE, spikes=6)
        arc_trail(cv, J["head"], 22, -20, 40, 2.4, BODY[3], WHITE)
    elif name == "windup":
        sparkle(cv, add(J["head"], (0, -9)), WHITE, EYE[1])
    elif name == "recover":  # 먹물 구름: 아군 쪽으로 뿜어져 부푸는 덩어리 셋 + 날아가는 먹방울
        for p, r in (((50, 32), 6.0), ((56, 24), 4.6), ((56, 40), 4.8)):
            cv.part(ellipse(cv.blank(), p, r, r * 0.85), SMOKE)
        for p in ((44, 22), (61, 32), (46, 44)):
            cv.part(ellipse(cv.blank(), p, 1.4, 1.2), SMOKE, gloss=False)
        sparkle(cv, add(J["head"], (-1, -10)), WHITE, GLOW)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((6, -8), (9, -5), (8, -11)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("squid-deep", draw, sys.argv[1:], idle_ms=200)
