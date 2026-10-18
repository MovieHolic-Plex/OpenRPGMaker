#!/usr/bin/env python3
"""뿔 딱정벌레(beetle-horn) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

푸른 금속빛 장수풍뎅이: 높이 둥근 딱지날개(가운데 이음선·윤기 띠), 앞가슴 등판의 짧은 뿔,
머리에서 앞·위로 길게 휘어 오르는 큰 뿔(끝이 두 갈래), 가시 돋친 마디 다리 여섯(가까운 셋·먼 셋)이 y=60 을 딛는다.
6번 칸(스킬, 아키타입 venom): 딱지날개를 활짝 열고 속날개를 떨며 초록 독가루를 아군 쪽으로 흩뿌린다.

  python3 scripts/content/monsters/redraw_beetle_horn.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, ik, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (10, 14, 30)
SHELL = [(28, 44, 92), (48, 78, 150), (86, 128, 206), (190, 220, 255)]
SHELL_FAR = [(18, 28, 60), (30, 46, 92), (44, 66, 126), (44, 66, 126)]
HORN = [(60, 50, 52), (130, 112, 104), (196, 182, 160), (240, 232, 212)]
LEG = [(20, 24, 40), (40, 48, 78), (70, 82, 120), (70, 82, 120)]
WING = [(120, 140, 150), (180, 200, 206), (226, 238, 240)]
TOXIC = [(60, 120, 40), (120, 200, 70), (200, 250, 140), (240, 255, 210)]
EYE = (250, 200, 60)
DUST = [(110, 100, 90), (150, 140, 128)]
WHITE = (250, 252, 255)
GROUND = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, hip, foot, far=False):
    """넓적다리(위로 꺾임) -> 가시 정강이 -> 발목마디(바닥을 짚는 갈고리)."""
    ramp = SHELL_FAR if far else LEG
    knee = ik(hip, add(foot, (0, -1)), 8.0, 9.0, up=True)
    cv.part(chain([hip, knee], [2.2, 1.6]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -1))], [1.6, 1.0]), ramp, gloss=False)
    if not far:
        mid = lerp(knee, foot, 0.5)
        side = 1 if foot[0] >= knee[0] else -1
        cv.pixel(*rnd(add(mid, (side, 0))), LEG[2])
        cv.pixel(*rnd(add(knee, (0, -1))), LEG[2])
    cv.pixel(*rnd(add(foot, (1 if foot[0] >= hip[0] else -1, 0))), ramp[0])


def body(cv, c, rot, open_=0.0):
    """딱지날개 돔(뒤) + 앞가슴 등판(앞). open_>0 이면 날개가 위로 들려 갈라진다."""
    P = lambda *pts: xf(c, rot, pts)
    if open_:
        # 들린 딱지날개 둘(뒤·위로 열림) + 그 사이로 펼친 긴 속날개 막
        for ang, ln, w in ((-140, 24, 9), (-115, 24, 8)):
            root = P((-1, -6))[0]
            tip = polar(root, ang, ln)
            mem = [root, polar(root, ang - 10, ln * 0.55), tip, polar(root, ang + 9, ln * 0.62)]
            cv.part(poly(cv.blank(), mem), WING + [WING[2]], ink=WING[0], gloss=False)
            cv.line([root, lerp(root, tip, 0.9)], WING[0])
        far = P((0, -6), (-10, -17), (-16, -15), (-9, -3))
        cv.part(poly(cv.blank(), far), SHELL_FAR)
        near = P((2, -5), (-4, -19), (-11, -18), (-8, -2))
        cv.part(poly(cv.blank(), near), SHELL)
        cv.line4(P((-1, -7), (-6, -16)), SHELL[3])
        dome = P((-14, 3), (-12, -2), (-4, -4), (3, -3), (3, 5), (-10, 7))
        cv.part(poly(cv.blank(), dome), SHELL_FAR, gloss=False)
    else:
        dome = P((-16, 3), (-15, -4), (-10, -10), (-2, -11), (4, -8), (6, -2), (5, 5), (-4, 7), (-13, 7))
        cv.part(poly(cv.blank(), dome), SHELL)
        cv.line4(P((5, -6), (-4, -9), (-12, -6)), SHELL[3])
        cv.line4(P((5, -3), (-6, -2), (-15, 1)), SHELL[0])
    pron = P((3, -7), (9, -8), (13, -5), (14, 1), (10, 5), (4, 5))
    cv.part(poly(cv.blank(), pron), SHELL)
    cv.pixel(*rnd(P((8, -6))[0]), SHELL[3])
    # 앞가슴 짧은 뿔
    cv.part(poly(cv.blank(), P((9, -8), (14, -12), (16, -11), (13, -6))), HORN, gloss=False)
    return P((14, 0))[0], P((-15, 2))[0]


def head(cv, neck, tilt, eye="open"):
    """머리 + 앞·위로 휘어 오르는 큰 뿔(끝 두 갈래)."""
    P = lambda *pts: xf(neck, tilt, pts)
    cv.part(poly(cv.blank(), P((0, -3), (5, -4), (7, 0), (5, 4), (0, 4))), SHELL_FAR)
    pts = P((5, 1), (11, -1), (15, -6), (16, -12))
    cv.part(chain(pts, [4.6, 3.8, 2.8, 1.8]), HORN)
    tip = pts[-1]
    fork = P((19, -11))[0]
    cv.part(chain([P((15, -9))[0], fork], [1.8, 1.0]), HORN, gloss=False)
    e = P((3, -1))[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
    cv.pixel(*rnd(P((6, 3))[0]), HORN[2])
    return dict(tip=tip, fork=fork, mouth=P((7, 3))[0])


BASE = dict(c=(26.0, 44.0), rot=0.0, tilt=0.0, open_=0.0, eye="open",
            feet=((48, 0), (33, 0), (13, 0)), far_dx=4)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 몸을 조금 낮추고 뿔을 숙인다
        p.update(c=(26.0, 45.0), tilt=6.0)
    elif name == "idle_c":  # 몸을 들어 뿔을 치켜든다
        p.update(c=(26.0, 43.0), rot=-3.0, tilt=-8.0, feet=((49, 0), (33, 0), (12, 0)))
    elif name == "windup":  # 뒤로 웅크려 뿔을 낮게 겨눈다
        p.update(c=(22.0, 46.0), rot=6.0, tilt=18.0, feet=((44, 0), (30, 0), (9, 0)))
    elif name == "move":  # 몸을 앞으로 기울여 돌진
        p.update(c=(29.0, 45.0), rot=4.0, tilt=14.0, feet=((51, -2), (36, 0), (16, -3)))
    elif name == "attack":  # 뿔로 떠올려 들이받는다
        p.update(c=(31.0, 42.0), rot=-10.0, tilt=-22.0, feet=((51, 0), (39, 0), (20, 0)))
    elif name == "recover":  # 스킬: 딱지날개를 열고 독가루
        p.update(c=(26.0, 44.0), rot=-6.0, tilt=-4.0, open_=1.0)
    elif name == "hit":  # 맞아서 뒤로 들리며 뿔이 젖혀진다
        p.update(c=(23.0, 43.0), rot=-14.0, tilt=-20.0, eye="shut", feet=((43, -2), (30, 0), (11, 0)))
    return p


def draw_beetle(cv, P):
    c = P["c"]
    hips = [add(c, (dx, 5)) for dx in (8, 2, -5)]
    feet = [(fx, GROUND + fy) for fx, fy in P["feet"]]
    for h, f in zip(hips, feet):
        leg(cv, add(h, (1, -1)), add(f, (P["far_dx"], -1)), far=True)
    neck, _ = body(cv, c, P["rot"], P["open_"])
    j = head(cv, add(neck, (0, 0)), P["tilt"], P["eye"])
    for h, f in zip(hips, feet):
        leg(cv, h, f)
    return j


def draw_dead(cv):
    """배를 드러내고 뒤집혀 다리를 허공에 오그린 모습."""
    cv.part(poly(cv.blank(), [(12, 56), (16, 50), (30, 49), (40, 52), (40, 58), (14, 59)]), SHELL)
    cv.put(poly(cv.blank(), [(16, 51), (34, 50), (36, 52), (18, 53)]), LEG[1])
    for i, x in enumerate((20, 26, 32)):
        knee = (x - 2, 43 - i % 2 * 2)
        cv.part(chain([(x, 51), knee], [2.2, 1.8]), LEG, gloss=False)
        cv.line4([knee, (x + 2, 45)], LEG[1])
    cv.part(chain([(40, 55), (46, 53), (52, 55), (55, 52)], [3.4, 3.0, 2.4, 1.6]), HORN)
    cv.line([(41, 53), (43, 55)], INK)
    puff(cv, (8, 57), 2.0, DUST)


def toxic_cloud(cv, c):
    for dx, dy, r in ((0, 0, 4.5), (7, -4, 3.5), (9, 5, 3.0), (-3, 7, 2.6), (14, 1, 2.4)):
        cv.put(ellipse(cv.blank(), add(c, (dx, dy)), r, r * 0.8), TOXIC[1])
        cv.put(ellipse(cv.blank(), add(c, (dx - 0.8, dy - 0.8)), r * 0.55, r * 0.45), TOXIC[2])
    for dx, dy in ((4, -9), (16, -6), (12, 10), (-6, -4), (19, 5)):
        cv.pixel(c[0] + dx, c[1] + dy, TOXIC[3])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_beetle(cv, P)
    t = j["tip"]
    if name == "recover":
        toxic_cloud(cv, (46, 20))
        for dx, dy in ((-6, 6), (-10, 2), (-3, 11)):
            cv.pixel(t[0] + dx + 14, t[1] + dy, TOXIC[2])
    elif name == "attack":
        slash(cv, add(t, (-2, 16)), add(t, (8, -4)), -5, 3.4, HORN[2], WHITE)
        burst(cv, add(t, (3, 3)), 4.0, HORN[3], WHITE, spikes=6, rot=8)
    elif name == "windup":
        sparkle(cv, add(t, (1, -1)), WHITE, HORN[3], big=True)
        puff(cv, (12, 57), 2.4, DUST)
    elif name == "move":
        for y in (34, 40, 48):
            cv.line([(2, y), (9, y)], SHELL[2])
        puff(cv, (14, 57), 2.4, DUST)
    elif name == "hit":
        for dx, dy in ((2, -4), (4, -1), (3, -7), (6, 1)):
            cv.pixel(t[0] + dx, t[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("beetle-horn", draw, sys.argv[1:], idle_ms=180)
