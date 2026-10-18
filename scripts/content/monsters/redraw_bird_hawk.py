#!/usr/bin/env python3
"""매(bird-hawk) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

공중에서 날갯짓하는 갈색 매: 크림빛 가슴에 갈색 세로 반점, 짙은 갈색 등·날개(끝 깃이 손가락처럼 갈라짐),
노란 갈고리 부리와 노란 눈테, 눈 뒤 검은 줄무늬, 부채꼴 꼬리(가로 띠), 아래로 늘어진 노란 발톱.
6번 칸(스킬, 아키타입 brute): 날개를 활짝 위로 치켜 회오리 바람 칼날을 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_bird_hawk.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle

INK = (28, 18, 12)
BACK = [(80, 50, 30), (120, 78, 46), (160, 112, 70), (200, 156, 108)]
BACK_FAR = [(56, 36, 22), (80, 50, 30), (100, 64, 38), (100, 64, 38)]
CHEST = [(170, 150, 120), (220, 204, 174), (240, 230, 208), (252, 248, 236)]
SPOT = (110, 70, 40)
TIP = (50, 32, 20)
BEAK = [(150, 110, 30), (230, 190, 60), (255, 230, 120), (255, 230, 120)]
EYE, EYE_HI = (240, 190, 40), (20, 14, 10)
WIND = [(170, 210, 230), (220, 240, 250), (255, 255, 255)]
WHITE = (255, 252, 244)


def wing(cv, sh, ang, span, far=False, fold=0.0):
    """어깨 -> 손목 -> 날개 끝. 앞 가장자리는 각 ang, 뒷 가장자리는 깃(끝 깃 다섯 갈래)."""
    ramp = BACK_FAR if far else BACK
    wrist = polar(sh, ang, span * 0.45)
    tip_ang = ang + 25 * (1 - fold) - 40 * fold
    tip = polar(wrist, tip_ang, span * 0.6)
    trail_ang = ang + 90
    pts = [sh, wrist, tip]
    feathers = []
    for k in range(5):
        base = lerp(tip, wrist, 0.18 * k)
        f = polar(base, tip_ang + 20 + k * 14, span * (0.18 - k * 0.01))
        feathers += [f, lerp(tip, wrist, 0.18 * k + 0.09)]
    pts += feathers
    pts += [polar(wrist, trail_ang, span * 0.28), polar(sh, trail_ang - 10, span * 0.3)]
    M = cv.part(poly(cv.blank(), pts), ramp)
    if not far:
        # 덮깃 경계 줄 + 끝 깃 짙은 색
        cv.line4([lerp(sh, wrist, 0.3), polar(lerp(sh, wrist, 0.5), trail_ang, span * 0.18), polar(wrist, trail_ang - 30, span * 0.14)], BACK[3])
        for k in range(0, 10, 2):
            cv.pixel(*rnd(feathers[k]), TIP)
    return tip, M


def tail(cv, base, ang, spread):
    pts = [polar(base, ang - 90, 2), polar(base, ang - spread, 12), polar(base, ang, 13), polar(base, ang + spread, 12),
           polar(base, ang + 90, 2)]
    cv.part(poly(cv.blank(), pts), BACK, gloss=False)
    for r in (6, 10):
        cv.line4([polar(base, ang - spread * 0.8, r), polar(base, ang + spread * 0.8, r)], TIP)


def body(cv, c, tilt, talon=0.0, eye="open", beak=0.0):
    rot = lambda *pts: [(c[0] + x * math.cos(math.radians(tilt)) - y * math.sin(math.radians(tilt)),
                         c[1] + x * math.sin(math.radians(tilt)) + y * math.cos(math.radians(tilt))) for x, y in pts]
    # 다리 + 노란 발톱(talon>0 이면 앞으로 뻗어 움켜쥔다)
    hip = rot((-1, 5))[0]
    foot = rot((1 + talon * 8, 11 - talon * 3))[0]
    cv.part(chain([hip, foot], [2.2, 1.6]), CHEST, gloss=False)
    for k in (-40, 0, 40):
        cv.line4([foot, polar(foot, 60 - talon * 60 + k, 3)], BEAK[1])
    # 몸통: 둥근 가슴 + 등
    trunk = rot((-9, -2), (-3, -6), (5, -5), (8, 0), (5, 6), (-3, 7), (-9, 3))
    cv.part(poly(cv.blank(), trunk), BACK)
    cv.put(poly(cv.blank(), rot((2, -3), (7, 0), (5, 6), (-3, 7), (-4, 3))), CHEST[1])
    for dx, dy in ((2, 0), (4, 3), (0, 4), (-2, 6)):
        cv.pixel(*rnd(rot((dx, dy))[0]), SPOT)
    # 머리
    h = rot((8, -6))[0]
    cv.part(ellipse(cv.blank(), h, 4.2, 3.8), BACK)
    cv.put(ellipse(cv.blank(), rot((9, -4))[0], 2.6, 1.6), CHEST[2])
    # 갈고리 부리(beak>0 이면 벌린다)
    b0 = rot((11, -6))[0]
    upper = [b0, rot((15, -6))[0], rot((16, -4))[0], rot((14, -4 + beak * 0.3))[0], rot((11, -4))[0]]
    cv.part(poly(cv.blank(), upper), BEAK, gloss=False)
    if beak:
        cv.part(poly(cv.blank(), [rot((11, -4))[0], rot((14, -3 + beak))[0], rot((11, -3 + beak * 0.5))[0]]), BEAK, gloss=False)
    e = rot((9, -7))[0]
    cv.line4([add(e, (-3, 1)), add(e, (-1, 1))], TIP)  # 눈 뒤 줄무늬
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
    return dict(head=h, beak=rot((17, -5))[0], foot=foot, sh=rot((0, -4))[0], tail=rot((-9, 0))[0])


BASE = dict(c=(30.0, 34.0), tilt=0.0, wing=-110.0, wing_far=-80.0, fold=0.0, tail=170.0, spread=22.0, talon=0.0,
            eye="open", beak=0.0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 아래로 내려 쳐 몸이 뜬다
        p.update(c=(30.0, 30.0), wing=125.0, wing_far=105.0, fold=0.2, spread=18.0)
    elif name == "idle_c":  # 날개를 수평으로 펼쳐 활공, 몸이 내려온다
        p.update(c=(30.0, 35.0), wing=-70.0, wing_far=-50.0, spread=26.0, beak=1.0)
    elif name == "windup":  # 몸을 뒤로 젖혀 날개를 크게 뒤·위로
        p.update(c=(26.0, 34.0), tilt=-18.0, wing=-140.0, wing_far=-115.0, fold=0.2, tail=150.0, beak=2.0, talon=0.4)
    elif name == "move":  # 날개를 접고 앞으로 급강하
        p.update(c=(38.0, 34.0), tilt=24.0, wing=-170.0, wing_far=-160.0, fold=1.0, tail=190.0, spread=10.0)
    elif name == "attack":  # 발톱을 앞으로 내밀어 낚아챈다
        p.update(c=(36.0, 34.0), tilt=-10.0, wing=-120.0, wing_far=-95.0, tail=160.0, talon=1.0, beak=2.0)
    elif name == "recover":  # 스킬: 날개를 활짝 위로 치켜 바람 칼날
        p.update(c=(28.0, 36.0), tilt=-6.0, wing=-95.0, wing_far=-70.0, spread=30.0, beak=2.0)
    elif name == "hit":  # 맞아서 몸이 젖혀지고 깃이 흩어진다
        p.update(c=(26.0, 32.0), tilt=-30.0, wing=-155.0, wing_far=-30.0, fold=0.5, tail=140.0, eye="shut", beak=1.0)
    return p


def draw_hawk(cv, P):
    c = P["c"]
    sh = add(c, (1, -4))
    wing(cv, add(sh, (2, -1)), P["wing_far"], 24, far=True, fold=P["fold"])
    tail(cv, add(c, (-8, 1)), P["tail"] + P["tilt"], P["spread"])
    j = body(cv, c, P["tilt"], P["talon"], P["eye"], P["beak"])
    tip, _ = wing(cv, sh, P["wing"], 27, fold=P["fold"])
    j["tip"] = tip
    return j


def draw_dead(cv):
    """옆으로 쓰러져 날개를 땅에 늘어뜨린 매."""
    wing(cv, (30, 54), 190, 22, far=True, fold=0.3)
    tail(cv, (20, 55), 185, 18)
    cv.part(poly(cv.blank(), [(20, 55), (26, 50), (36, 50), (40, 54), (36, 59), (22, 59)]), BACK)
    cv.put(poly(cv.blank(), [(26, 58), (36, 58), (38, 55), (28, 56)]), CHEST[1])
    cv.part(ellipse(cv.blank(), (42, 54), 3.6, 3.2), BACK)
    cv.part(poly(cv.blank(), [(45, 54), (49, 55), (48, 57), (45, 56)]), BEAK, gloss=False)
    cv.line([(41, 53), (43, 55)], INK)
    cv.line([(43, 53), (41, 55)], INK)
    for x in (30, 33):
        cv.line([(x, 50), (x + 1, 46)], BEAK[1])
    wing(cv, (32, 53), 10, 20, fold=0.4)
    for p in ((14, 46), (20, 42), (48, 46)):
        cv.pixel(*p, BACK[3])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_hawk(cv, P)
    b = j["beak"]
    if name == "recover":
        for k, (a, bb) in enumerate((((44, 22), (60, 30)), ((44, 34), (60, 40)), ((42, 44), (58, 52)))):
            slash(cv, a, bb, 3 + k, 2.6, WIND[0], WIND[2])
        sparkle(cv, (56, 18), WHITE, WIND[1], big=True)
    elif name == "attack":
        f = j["foot"]
        for dx in (0, 4, 8):
            slash(cv, add(f, (dx - 2, -8)), add(f, (dx + 2, 8)), 2, 2.2, WIND[1], WHITE)
        burst(cv, add(f, (6, 0)), 4.0, BEAK[2], WHITE, spikes=6, rot=10)
    elif name == "windup":
        sparkle(cv, add(b, (2, -4)), WHITE, EYE)
    elif name == "move":
        for y in (20, 26, 32):
            cv.line([(2, y), (9, y - 3)], WIND[0])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((7, -7), (9, -4), (8, -10), (11, -1)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
        for p in ((14, 18), (18, 44), (10, 30)):
            cv.pixel(*p, BACK[2])
    return cv.image()


if __name__ == "__main__":
    run("bird-hawk", draw, sys.argv[1:], idle_ms=120)
