#!/usr/bin/env python3
"""거대 쥐(rat-giant) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

네발 자세 흐름은 회색 늑대(redraw_wolf_grey.py)를 쓰되 쥐 몸으로 새로 그린다:
몸을 낮게 붙이고 등을 둥글게 구부린 갈색 털 덩어리, 짧은 다리와 분홍 발, 뾰족한 주둥이에 분홍 코와 수염,
크고 둥근 분홍 속귀, 누런 앞니 둘, 붉은 눈, 몸보다 긴 분홍 비늘 꼬리.
6번 칸(스킬, 아키타입 brute): 뒷발로 일어서 앞발 발톱으로 세 줄 할퀴기.

  python3 scripts/content/monsters/redraw_rat_giant.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import add, bezier, chain, ellipse, ik_side, lerp, poly, rnd, run

W.INK = (26, 18, 14)
W.FUR = [(78, 56, 40), (118, 88, 62), (156, 122, 90), (196, 164, 128)]
W.FUR_FAR = [(56, 40, 30), (78, 56, 40), (96, 70, 50), (96, 70, 50)]
W.CREAM = [(150, 126, 100), (196, 176, 150), (222, 206, 182), (236, 226, 208)]
W.EYE, W.EYE_HI = (220, 40, 40), (255, 190, 170)
W.CLAW = (240, 196, 196)
PINK = [(150, 80, 90), (206, 126, 134), (236, 170, 172), (250, 210, 210)]
TOOTH = (236, 210, 120)
WHISK = (220, 210, 196)
DROP = 6  # 늑대보다 몸을 이만큼 낮춘다


def leg(cv, hip, foot, far=False, front=True):
    """짧은 쥐 다리: 굵은 허벅지 -> 짧은 정강이 -> 분홍 발."""
    ramp = W.FUR_FAR if far else W.FUR
    foot = add(foot, (0, -1))
    knee = ik_side(hip, foot, 5.0, 5.0, forward=not front)
    cv.part(chain([hip, knee], [4.4 if not front else 3.4, 2.4]), ramp, gloss=False)
    cv.part(chain([knee, foot], [2.2, 1.6]), PINK if not far else ramp, gloss=False)
    f = rnd(foot)
    cv.put(poly(cv.blank(), [(f[0] - 1, f[1]), (f[0] + 2, f[1]), (f[0] + 3, f[1] + 1), (f[0] - 1, f[1] + 1)]), PINK[1])
    if not far:
        cv.pixel(f[0] + 3, f[1] + 1, W.CLAW)
    return knee


def body(cv, sh, hp, breath=0.0):
    """둥글게 솟은 등(엉덩이 쪽이 제일 높다) + 밝은 배."""
    top = add(lerp(hp, sh, 0.35), (0, -9 - breath))
    pts = bezier(add(hp, (-6, 4)), add(hp, (-7, -8)), top, 5) + bezier(top, add(sh, (2, -7)), add(sh, (6, 0)), 5)[1:]
    pts += [add(sh, (5, 6 + breath)), add(lerp(hp, sh, 0.5), (0, 7 + breath)), add(hp, (0, 6))]
    M = cv.part(poly(cv.blank(), pts), W.FUR)
    cv.put(poly(cv.blank(), [add(sh, (4, 5 + breath)), add(lerp(hp, sh, 0.5), (0, 6 + breath)),
                             add(lerp(hp, sh, 0.5), (0, 4)), add(sh, (2, 3))]), W.CREAM[1])
    # 등의 거친 털 결
    for t in (0.15, 0.35, 0.55, 0.75):
        p = add(lerp(hp, sh, t), (0, -7 if 0.2 < t < 0.6 else -5))
        cv.line4([p, add(p, (-2, -1))], W.FUR[0])
    return M


def ruff(cv, sh, puffed=0.0):
    """쥐는 갈기 대신 목덜미 털이 곤두선다."""
    for dx in (-2, 1, 4):
        cv.line4([add(sh, (dx, -5)), add(sh, (dx - 2, -8 - puffed))], W.FUR[0])


def tail(cv, hp, lift=0.0):
    """몸보다 긴 분홍 비늘 꼬리: 땅을 따라 뒤로 끌다가 끝이 위로 휜다."""
    root = add(hp, (-6, 3))
    pts = bezier(root, add(root, (-6, 12 - lift)), add(root, (-14, 2 - lift * 2.5)), 8)
    M = cv.part(chain(pts, [2.4, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0, 1.0]), PINK, gloss=False)
    for p in pts[1:-1:2]:
        cv.pixel(*rnd(p), PINK[0])
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    """뾰족한 쥐 주둥이 + 크고 둥근 귀 + 누런 앞니 + 수염."""
    P = lambda *pts: W.xf(neck, tilt, pts)
    jaw_o = P((4, 3))[0]
    jaw = W.xf(jaw_o, mouth, [(0, -1), (7, 0), (6, 2), (1, 2)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 1), (11, 1)) + [jaw[1], jaw[0]]), W.MOUTH)
    cv.part(poly(cv.blank(), jaw), W.CREAM, gloss=False)
    skull = P((-4, -3), (1, -6), (6, -4), (13, 0), (12, 2), (4, 4), (-3, 4))
    cv.part(poly(cv.blank(), skull), W.FUR)
    cv.put(poly(cv.blank(), P((5, 1), (12, 1), (11, 2), (4, 3))), W.CREAM[2])
    # 큰 둥근 귀: 먼 귀 + 가까운 귀(분홍 속귀)
    e = ears
    far_c, near_c = P((-2 - e * 2, -7 + e))[0], P((1 - e * 3, -8 + e * 2))[0]
    cv.part(ellipse(cv.blank(), far_c, 2.6, 3.0), W.FUR_FAR, gloss=False)
    cv.part(ellipse(cv.blank(), near_c, 3.0, 3.4), W.FUR, gloss=False)
    cv.put(ellipse(cv.blank(), near_c, 1.6, 2.0), PINK[2])
    nose = P((13, 0))[0]
    cv.pixel(*rnd(nose), PINK[1])
    cv.pixel(*rnd(add(nose, (0, -1))), PINK[3])
    # 앞니 둘
    for x in (10, 11):
        cv.pixel(*rnd(P((x, 3))[0]), TOOTH)
        cv.pixel(*rnd(P((x, 4))[0]), TOOTH)
    # 수염(밖으로 삐친 한 픽셀 선)
    for dy in (0, 1):
        cv.line4([P((11, dy + 1))[0], P((15, dy * 3 - 1))[0]], WHISK)
    ey = P((6, -2))[0]
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 1))], W.INK)
    else:
        cv.pixel(*rnd(ey), W.EYE)
        cv.pixel(*rnd(add(ey, (1, 0))), W.EYE_HI)
    return dict(snout=P((14, 1))[0], mouth=lerp(P((11, 2))[0], jaw[1], 0.5))


_params = W.params


def params(name):
    p = _params(name)
    p["sh"], p["hp"] = add(p["sh"], (0, DROP)), add(p["hp"], (2, DROP))
    return p


W.leg, W.body, W.ruff, W.tail, W.head, W.params = leg, body, ruff, tail, head, params

def draw_dead(cv):
    """배를 드러내고 뒤집힌 쥐: 짧은 다리가 위로 오그라들고 꼬리가 늘어진다."""
    pts = bezier((16, 56), (6, 60), (2, 52), 6)
    cv.part(chain(pts, [2.2, 2.0, 1.8, 1.4, 1.2, 1.0, 1.0]), PINK, gloss=False)
    cv.part(ellipse(cv.blank(), (30, 54), 13, 5), W.FUR)
    cv.put(ellipse(cv.blank(), (30, 52), 9, 2.4), W.CREAM[1])
    for x in (22, 27, 34, 38):
        cv.line4([(x, 50), (x + 1, 46), (x + 2, 45)], PINK[1])
    cv.part(poly(cv.blank(), [(41, 51), (48, 52), (54, 56), (48, 58), (41, 58)]), W.FUR)
    cv.part(ellipse(cv.blank(), (43, 49), 2.6, 2.6), W.FUR, gloss=False)
    cv.put(ellipse(cv.blank(), (43, 49), 1.2, 1.2), PINK[2])
    cv.pixel(54, 56, PINK[1])
    cv.pixel(52, 57, TOOTH)
    cv.line([(46, 53), (48, 55)], W.INK)
    cv.line([(48, 53), (46, 55)], W.INK)
    for x, y in ((22, 44), (8, 48)):
        W.puff(cv, (x, y), 2.0, W.DUST)


W.draw_dead = draw_dead


if __name__ == "__main__":
    run("rat-giant", W.draw, sys.argv[1:], idle_ms=150)
