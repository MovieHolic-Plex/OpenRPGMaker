#!/usr/bin/env python3
"""엄니 멧돼지(boar-tusk) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

어깨가 솟은 쐐기 몸통에 등갈기가 곤두서고, 낮게 숙인 머리에서 흰 엄니 둘이 위로 휘어 오른쪽을 겨눈다.
가는 발굽 다리 넷(가까운·먼 쪽)이 바닥 y=60 을 딛고, 짧은 꼬리가 말려 있다.
6번 칸(스킬 skill_mon_tusk_charge): 머리를 박고 엄니에 붉은 기운을 두른 채 흙먼지를 뿜으며 돌진한다.

  python3 scripts/content/monsters/redraw_boar_tusk.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, burst, chain, ellipse, ik_side, lerp, polar, poly, puff, rnd, run, slash,
                       sparkle, speed_lines, tapered)

INK = (36, 20, 14)
HIDE = [(78, 46, 30), (120, 74, 46), (160, 106, 66), (196, 146, 98)]
HIDE_FAR = [(58, 34, 24), (78, 46, 30), (100, 62, 40), (100, 62, 40)]
MANE = [(40, 24, 18), (64, 38, 26), (92, 58, 38), (120, 80, 52)]
SNOUT = [(150, 90, 80), (196, 128, 112), (228, 168, 148), (240, 196, 176)]
TUSK = [(170, 156, 120), (222, 210, 176), (246, 240, 218), (255, 255, 246)]
HOOF = (30, 20, 16)
EYE, EYE_HI = (220, 40, 30), (255, 200, 120)
RAGE = [(140, 20, 20), (220, 60, 40), (255, 150, 80), (255, 230, 170)]
DUST = [(150, 120, 86), (196, 168, 124)]
WHITE = (255, 252, 236)
GROUND = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, hip, foot, far=False, front=True):
    """허벅지(굵음) → 정강이(가늚) → 발굽. 앞다리 무릎은 앞, 뒷다리 뒤꿈치는 뒤로 꺾인다."""
    ramp = HIDE_FAR if far else HIDE
    knee = ik_side(hip, add(foot, (0, -2)), 7.0, 7.0, forward=not front)
    cv.part(chain([hip, knee], [5.0 if not front else 4.5, 3.0]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -2))], [3.0, 2.2]), ramp, gloss=False)
    f = rnd(foot)
    cv.put(poly(cv.blank(), [(f[0] - 1, f[1] - 2), (f[0] + 2, f[1] - 2), (f[0] + 2, f[1]), (f[0] - 1, f[1])]), HOOF)
    return knee


def body(cv, sh, hp, lift=0.0):
    """어깨(sh)가 높고 엉덩이(hp)가 낮은 쐐기 몸통 + 등갈기."""
    top = [hp, lerp(hp, sh, 0.35), add(lerp(hp, sh, 0.7), (0, -2 - lift)), add(sh, (1, -3 - lift)), add(sh, (6, 0))]
    bot = [add(sh, (5, 9)), add(lerp(hp, sh, 0.55), (0, 11)), add(hp, (-1, 9)), add(hp, (-4, 4))]
    M = cv.part(poly(cv.blank(), top + bot), HIDE)
    # 배 아래 밝은 털 줄
    cv.line([add(lerp(hp, sh, 0.25), (0, 9)), add(lerp(hp, sh, 0.8), (0, 10))], HIDE[2])
    # 등갈기: 등선을 따라 뒤로 눕는 뾰족한 털 다발
    for i in range(7):
        t = 0.25 + i * 0.11
        base = add(lerp(lerp(hp, sh, 0.35), add(sh, (1, -3 - lift)), (t - 0.25) / 0.7), (0, 0))
        tip = add(base, (-3, -4 - (2 if 2 <= i <= 4 else 0) - lift * 0.5))
        cv.part(poly(cv.blank(), [add(base, (-1.5, 1)), tip, add(base, (2, 1))]), MANE, gloss=False)
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open", glow=False):
    """쐐기 머리: 이마 → 긴 콧등 → 납작한 코판. 엄니는 아래턱에서 위로 휜다."""
    P = lambda *pts: xf(neck, tilt, pts)
    skull = P((-3, -6), (4, -5), (12, -1), (14, 3), (13, 6), (5, 7), (-2, 6))
    cv.part(poly(cv.blank(), skull), HIDE)
    ear = P((0, -5), (-3, -9), (3, -5))
    cv.part(poly(cv.blank(), ear), MANE, gloss=False)
    cv.part(poly(cv.blank(), P((12, -1), (16, 0), (16, 5), (13, 6))), SNOUT, gloss=False)
    nose = P((15, 2))[0]
    cv.pixel(*rnd(nose), INK)
    jaw0 = P((6, 7))[0]
    if mouth:
        cv.put(poly(cv.blank(), P((5, 6), (13, 6), (12, 7 + mouth), (5, 8))), (90, 20, 26))
    tusk_ramp = RAGE if glow else TUSK
    for dx, s in ((0, 1.0), (-2, 0.8)):
        root = P((11 + dx, 5 + mouth * 0.6))[0]
        mid = P((15 + dx, 3 + mouth * 0.5))[0]
        tip = P((16 + dx * 0.5, -3 * s))[0]
        cv.part(chain([root, mid, tip], [2.6, 2.0, 1.0]), tusk_ramp if dx == 0 else TUSK, gloss=False)
    e = P((5, -2))[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI if eye != "rage" else WHITE)
        cv.line([add(e, (-1, -2)), add(e, (2, -1))], INK)  # 찌푸린 눈썹
    return P((17, -3))[0]


BASE = dict(sh=(36.0, 36.0), hp=(18.0, 39.0), tilt=12, mouth=0, eye="open", lift=0.0, glow=False,
            feet=((40, 0), (34, 0), (21, 0), (15, 0)), tail=0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 숨을 들이켜 등갈기가 솟는다
        p.update(sh=(36.0, 35.0), hp=(18.0, 38.0), lift=1.5, tilt=10, tail=1)
    elif name == "idle_c":  # 앞발로 땅을 긁는다
        p.update(sh=(36.0, 37.0), tilt=16, feet=((43, -3), (34, 0), (21, 0), (15, 0)), tail=2)
    elif name == "windup":  # 엉덩이를 낮추고 머리를 쳐들어 엄니를 세운다
        p.update(sh=(32.0, 34.0), hp=(15.0, 42.0), tilt=-14, mouth=3, eye="rage", lift=2.5,
                 feet=((38, 0), (31, 0), (19, 0), (12, 0)), tail=1)
    elif name == "move":  # 질주: 앞뒤 다리를 쭉 뻗는다
        p.update(sh=(40.0, 35.0), hp=(22.0, 37.0), tilt=18, feet=((50, -3), (44, 0), (19, 0), (12, -2)))
    elif name == "attack":  # 엄니로 퍼 올려 찌른다
        p.update(sh=(40.0, 34.0), hp=(22.0, 39.0), tilt=-24, mouth=4, eye="rage", feet=((46, 0), (40, 0), (25, 0), (18, 0)))
    elif name == "recover":  # 스킬 돌진: 머리를 박고 엄니에 붉은 기운
        p.update(sh=(38.0, 38.0), hp=(19.0, 37.0), tilt=30, eye="rage", glow=True, lift=2.0,
                 feet=((47, -2), (41, 0), (19, 0), (12, -2)))
    elif name == "hit":  # 맞아서 뒤로 주저앉으며 머리를 젖힌다
        p.update(sh=(33.0, 36.0), hp=(16.0, 42.0), tilt=-30, eye="shut", mouth=2,
                 feet=((42, 0), (35, 0), (19, 0), (13, 0)), tail=2)
    return p


def draw_boar(cv, P):
    sh, hp, tilt = P["sh"], P["hp"], P["tilt"]
    hip_front = add(sh, (1, 6))
    hip_back = add(hp, (2, 4))
    (f1x, f1y), (f2x, f2y), (b1x, b1y), (b2x, b2y) = P["feet"]
    # 먼 다리(짙게) → 몸 → 가까운 다리 → 머리
    leg(cv, add(hip_front, (2, 0)), (f2x, GROUND + f2y), far=True, front=True)
    leg(cv, add(hip_back, (2, 0)), (b2x, GROUND + b2y), far=True, front=False)
    body(cv, sh, hp, P["lift"])
    # 꼬리: 엉덩이 끝에서 말린 짧은 꼬리
    t0 = add(hp, (-2, 2))
    cv.line4([add(t0, (2, 0)), t0, add(t0, (-3, -2 + P["tail"])), add(t0, (-4, 1 + P["tail"]))], MANE[1])
    leg(cv, hip_front, (f1x, GROUND + f1y), front=True)
    leg(cv, hip_back, (b1x, GROUND + b1y), front=False)
    tip = head(cv, add(sh, (4, 1)), tilt, P["mouth"], P["eye"], P["glow"])
    return dict(tip=tip, head=add(sh, (10, 0)))


def draw_dead(cv):
    """옆으로 쓰러져 다리를 앞으로 뻗고 혀를 내민 모습."""
    body_pts = [(14, 56), (18, 49), (30, 46), (40, 48), (44, 54), (40, 59), (18, 59)]
    cv.part(poly(cv.blank(), body_pts), HIDE)
    for x in range(18, 40, 3):
        cv.part(poly(cv.blank(), [(x - 1, 48), (x - 3, 44), (x + 2, 47)]), MANE, gloss=False)
    for hip, foot in (((22, 56), (24, 52)), ((36, 56), (40, 52))):
        cv.part(chain([hip, foot], [3, 2]), HIDE_FAR, gloss=False)
        cv.pixel(foot[0], foot[1] - 1, HOOF)
    skull = [(41, 50), (50, 50), (56, 54), (55, 59), (42, 59)]
    cv.part(poly(cv.blank(), skull), HIDE)
    cv.part(poly(cv.blank(), [(54, 53), (58, 54), (58, 59), (55, 59)]), SNOUT, gloss=False)
    cv.part(chain([(52, 58), (56, 56), (57, 52)], [2.2, 1.8, 1.0]), TUSK, gloss=False)
    cv.line([(45, 52), (47, 54)], INK)
    cv.line([(47, 52), (45, 54)], INK)
    cv.part(poly(cv.blank(), [(44, 51), (42, 46), (47, 50)]), MANE, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 10, (34, 40, 46), DUST[1])
    if name == "recover":
        puff(cv, (11, 55), 4.5, DUST)
        puff(cv, (5, 51), 3.0, DUST)
        speed_lines(cv, 1, 9, (32, 38), RAGE[1])
    j = draw_boar(cv, P)
    t = j["tip"]
    if name == "attack":
        slash(cv, add(t, (-9, 12)), add(t, (-1, -11)), -5, 3.6, TUSK[2], WHITE)
        burst(cv, add(t, (3, -2)), 4.5, TUSK[2], WHITE, spikes=6, rot=20)
    elif name == "recover":
        burst(cv, add(t, (3, 0)), 6.5, RAGE[1], RAGE[3], spikes=7, rot=5)
        for dy in (-8, 0, 8):
            cv.line([add(t, (6, dy - 1)), add(t, (12, dy))], RAGE[2])
        sparkle(cv, add(t, (-3, -9)), RAGE[3], RAGE[2], big=True)
    elif name == "windup":
        puff(cv, (43, 57), 2.8, DUST)
        sparkle(cv, add(t, (2, -3)), WHITE, TUSK[2])
    elif name == "idle_c":
        pass
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((9, -10), (11, -7), (10, -13), (12, -4)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("boar-tusk", draw, sys.argv[1:], idle_ms=170)
