#!/usr/bin/env python3
"""적갈색 벌(sylph-hornet-transparent) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

허리가 잘록한 말벌: 적갈색 가슴 앞에 큰 머리가 오른쪽을 보고, 머리 앞쪽을 거의 다 차지하는 호박색 겹눈,
갈고리처럼 맞물린 큰턱, 꺾인 더듬이 둘. 가는 허리(자루마디) 뒤로 길쭉한 검정·호박 줄무늬 배가 뻗고
끝에서 독침이 아래로 휜다. 크고 투명해 보이는 날개 네 장(옅은 하늘색 + 짙은 날개맥),
마디 꺾인 다리 여섯이 허공에 늘어진다. 둥근 거대 벌(bee-giant)과 달리 몸이 가늘고 길며 허리가 잘록하다.
6번 칸(스킬 독침 연사): 배를 몸 아래로 앞까지 말아 독침에서 초록 독 바늘 셋을 아군 쪽으로 연달아 쏜다.

  python3 scripts/content/monsters/redraw_sylph_hornet_transparent.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, burst, chain, ellipse, glow, lerp, poly, rnd, run, sparkle, speed_lines

INK = (34, 16, 12)
BODY = [(96, 32, 22), (148, 56, 34), (194, 92, 50), (232, 146, 92)]
AMBER = [(150, 92, 20), (210, 146, 34), (244, 194, 70), (255, 230, 138)]
BAND = (40, 22, 16)
BAND_HI = (78, 46, 30)
EYE = [(120, 48, 10), (206, 108, 20), (252, 176, 56), (255, 236, 168)]
WING = [(150, 186, 208), (196, 224, 240), (226, 244, 252), (246, 255, 255)]
VEIN = (72, 94, 122)
LEG = [(46, 22, 14), (92, 48, 28), (140, 84, 48), (140, 84, 48)]
STING = (60, 40, 34)
VENOM = [(60, 140, 40), (140, 220, 70), (226, 255, 170)]
WHITE = (255, 252, 236)


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def wing(cv, root, ang, length, width, far=False):
    """길쭉한 투명 날개: 옅은 면 + 짙은 앞 테두리 맥 + 갈래 맥."""
    pts = []
    for i in range(9):
        t = i / 8
        pts.append((length * t, -width * 0.55 * math.sin(math.pi * t) ** 0.7))
    for i in range(8, -1, -1):
        t = i / 8
        pts.append((length * t, width * 0.45 * math.sin(math.pi * min(1, t * 1.1)) ** 0.6))
    ramp = [WING[0], WING[0], WING[1], WING[1]] if far else [WING[1], WING[1], WING[2], WING[3]]
    cv.part(poly(cv.blank(), xf(root, ang, pts)), ramp, ink=VEIN, gloss=False)
    # 날개맥: 앞 테두리 굵은 맥 + 가운데 맥 + 갈래 둘
    cv.line(xf(root, ang, [(1, -0.5), (length * 0.5, -width * 0.42), (length * 0.85, -width * 0.25)]), VEIN)
    cv.line(xf(root, ang, [(2, 0.5), (length * 0.7, 0.2)]), VEIN if not far else WING[0])
    cv.line(xf(root, ang, [(length * 0.45, -width * 0.38), (length * 0.6, 0.2)]), VEIN)
    if not far:
        cv.line(xf(root, ang, [(length * 0.75, -width * 0.25), (length * 0.9, 0.0)]), VEIN)
        cv.pixel(*rnd(xf(root, ang, [(length * 0.3, -width * 0.12)])[0]), WHITE)


def abdomen(cv, attach, ang, L=18.0, W=9.0, curl=6.0, glow_tip=False):
    """자루마디 → 길쭉한 줄무늬 배 → 아래로 휜 독침. attach 에서 ang 쪽으로."""
    stalk_end = xf(attach, ang, [(3, 0)])[0]
    cv.part(chain([attach, stalk_end], [2.4, 2.4]), BODY, gloss=False)
    top, bot = [], []
    for i in range(13):
        t = i / 12
        hw = W / 2 * (math.sin(math.pi * (0.08 + 0.86 * t)) ** 0.6) * (1 - 0.35 * t)
        top.append((3 + L * t, -hw))
        bot.append((3 + L * t, hw))
    M = cv.part(poly(cv.blank(), xf(attach, ang, top + bot[::-1])), AMBER)
    for t0, tw in ((0.24, 0.12), (0.46, 0.12), (0.68, 0.12), (0.88, 0.2)):
        band = poly(cv.blank(), xf(attach, ang, [(3 + L * t0, -W), (3 + L * (t0 + tw), -W), (3 + L * (t0 + tw), W), (3 + L * t0, W)]))
        B = (np.array(band) > 0) & M
        cv.put(B, BAND)
        hi = B & ~np.roll(B, 1, axis=0)
        cv.rgb[hi] = BAND_HI
    base = xf(attach, ang, [(L + 2, 0)])[0]
    mid = xf(attach, ang, [(L + 5, curl * 0.3)])[0]
    tip = xf(attach, ang, [(L + 7, curl)])[0]
    cv.line4([base, mid, tip], STING)
    cv.pixel(*rnd(tip), VENOM[2] if glow_tip else LEG[2])
    return tip


def head(cv, c, tilt=0, eye="open", mouth=0):
    """큰 머리 + 앞쪽 큰 겹눈 + 큰턱 + 꺾인 더듬이."""
    for dx, col in ((-2, LEG[1]), (1, LEG[2])):
        root = xf(c, tilt, [(dx, -4)])[0]
        elbow = xf(root, tilt, [(-2, -6)])[0]
        tip = xf(elbow, tilt, [(6, -2)])[0]
        cv.line4([root, elbow, tip], col)
    cv.part(ellipse(cv.blank(), c, 5.6, 5.4), BODY)
    # 큰턱: 아래 앞에서 갈고리 둘이 맞물린다
    jaw = xf(c, tilt, [(4, 4)])[0]
    for sgn in (-1, 1):
        a = xf(jaw, tilt, [(3 + mouth * 0.4, sgn * (1.2 + mouth * 0.5))])[0]
        b = xf(jaw, tilt, [(4 + mouth * 0.4, sgn * (0.2 + mouth * 0.2))])[0]
        cv.line4([jaw, a, b], AMBER[0] if sgn < 0 else LEG[0])
    e = xf(c, tilt, [(1.8, -0.6)])[0]
    if eye == "shut":
        cv.line([add(e, (-2, 0)), add(e, (2, 0))], INK)
        cv.line([add(e, (-2, -1)), add(e, (2, -1))], EYE[0])
    else:
        cv.part(ellipse(cv.blank(), e, 3.0, 3.8), EYE, ink=INK)
        # 겹눈 무늬(점 둘) + 반짝임
        cv.pixel(e[0] + 1, e[1] + 1, EYE[1])
        cv.pixel(e[0] - 1, e[1] + 2, EYE[1])
        cv.pixel(e[0], e[1] - 2, WHITE)
        if eye == "glow":
            cv.pixel(e[0] + 1, e[1] - 1, WHITE)
    return xf(jaw, tilt, [(5, 0)])[0]


LEG_POSES = {
    "hang": [((1, 5), (-2, 6)), ((1, 6), (-1, 6)), ((2, 5), (0, 7))],
    "back": [((-3, 4), (-5, 3)), ((-2, 5), (-5, 4)), ((-1, 5), (-4, 5))],
    "up": [((2, 4), (4, 2)), ((2, 5), (5, 3)), ((3, 4), (5, 2))],
    "splay": [((-3, 5), (-2, 6)), ((1, 6), (1, 6)), ((4, 4), (5, 5))],
}


def leg(cv, hip, k, f, far=False):
    ramp = LEG if not far else [LEG[0]] * 4
    knee = add(hip, k)
    foot = add(knee, f)
    cv.line4([hip, knee], ramp[1] if not far else LEG[0])
    cv.line4([knee, foot], ramp[2] if not far else LEG[0])
    cv.pixel(*rnd(knee), ramp[0])


BASE = dict(c=(27.0, 28.0), tilt=0, wing=-158, abd=158, curl=6.0, legs="hang", eye="open", mouth=0, glow=False)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 위로 쳐올리며 1칸 뜬다
        p.update(c=(27.0, 27.0), wing=-128, abd=154)
    elif name == "idle_c":  # 날개를 아래로 내리며 1칸 가라앉는다
        p.update(c=(27.0, 29.0), wing=-182, abd=162, legs="splay")
    elif name == "windup":  # 몸을 젖히고 배를 들어 독침을 세운다
        p.update(c=(25.0, 31.0), tilt=-14, wing=-110, abd=205, curl=-5, glow=True, eye="glow", mouth=2)
    elif name == "move":  # 고개를 숙이고 날개를 뒤로 눕혀 돌진
        p.update(c=(31.0, 30.0), tilt=14, wing=-176, abd=168, legs="back")
    elif name == "attack":  # 배를 몸 아래 앞으로 내질러 찌른다
        p.update(c=(27.0, 24.0), tilt=6, wing=-138, abd=62, curl=-5, legs="up", mouth=4, eye="glow")
    elif name == "recover":  # 스킬: 배를 앞으로 말아 독 바늘 연사
        p.update(c=(22.0, 24.0), tilt=-4, wing=-150, abd=72, curl=-5, glow=True, legs="up", eye="glow", mouth=2)
    elif name == "hit":  # 맞고 뒤로 기울며 날개가 흐트러진다
        p.update(c=(24.0, 30.0), tilt=-24, wing=-196, abd=178, eye="shut", legs="splay", mouth=3)
    return p


def draw_hornet(cv, P):
    c, tilt = P["c"], P["tilt"]
    root = xf(c, tilt, [(-1, -4)])[0]
    hc = xf(c, tilt, [(10, 1)])[0]
    # 먼 날개 둘 → 먼 다리 → 배 → 가슴 → 머리 → 가까운 다리 → 가까운 날개 둘
    wing(cv, add(root, (2, 0)), P["wing"] + tilt + 22, 14, 4.6, far=True)
    wing(cv, add(root, (1, -1)), P["wing"] + tilt + 10, 19, 5.6, far=True)
    for i, (k, f) in enumerate(LEG_POSES[P["legs"]]):
        leg(cv, xf(c, tilt, [(-1 + i * 3, 3)])[0], add(k, (1, -1)), f, far=True)
    tip = abdomen(cv, xf(c, tilt, [(-5, 2)])[0], P["abd"] + tilt, curl=P["curl"] if P["abd"] < 180 else -P["curl"],
                  glow_tip=P["glow"])
    cv.part(ellipse(cv.blank(), c, 6.2, 5.0), BODY)
    for dx, dy in ((-3, -2), (0, -3), (3, -2)):
        cv.pixel(*rnd(xf(c, tilt, [(dx, dy)])[0]), BODY[3])
    cv.pixel(*rnd(xf(c, tilt, [(1, -1)])[0]), AMBER[2])  # 가슴 무늬
    cv.pixel(*rnd(xf(c, tilt, [(2, -1)])[0]), AMBER[2])
    cv.part(chain([xf(c, tilt, [(5, 0)])[0], xf(c, tilt, [(6, 1)])[0]], [3, 3]), BODY, gloss=False)  # 목
    jaw = head(cv, hc, tilt, P["eye"], P["mouth"])
    for i, (k, f) in enumerate(LEG_POSES[P["legs"]]):
        leg(cv, xf(c, tilt, [(0 + i * 3, 4)])[0], k, f)
    wing(cv, add(root, (0, 1)), P["wing"] + tilt + 26, 15, 5.0)
    wing(cv, root, P["wing"] + tilt, 21, 6.4)
    return dict(tip=tip, head=hc, jaw=jaw, c=c)


def needle(cv, a, b):
    cv.line([a, b], VENOM[0], 2)
    cv.line([lerp(a, b, 0.2), b], VENOM[1])
    cv.line([lerp(a, b, 0.6), b], VENOM[2])
    cv.pixel(*rnd(b), WHITE)
    cv.pixel(*rnd(lerp(a, b, -0.15)), VENOM[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 뒤집혀 떨어져 다리를 오그리고 날개가 바닥에 깔림
        wing(cv, (26, 56), 186, 19, 4.4, far=True)
        abdomen(cv, (24, 55), 184, L=15.0, W=8.0, curl=3)
        cv.part(ellipse(cv.blank(), (29, 55), 5.5, 4.0), BODY)
        for hx, k, f in ((26, (-1, -4), (2, -3)), (29, (0, -5), (2, -3)), (32, (1, -4), (3, -2))):
            leg(cv, (hx, 52), k, f)
        cv.part(ellipse(cv.blank(), (38, 56), 4.6, 3.8), BODY)
        e = (40, 55)
        for d in ((-1, -1), (1, 1), (-1, 1), (1, -1), (0, 0)):
            cv.pixel(e[0] + d[0], e[1] + d[1], INK)
        cv.line4([(42, 53), (45, 50), (48, 51)], LEG[1])
        wing(cv, (30, 58), 4, 19, 3.6)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 1, 10, (22, 30, 38), WING[1])
    j = draw_hornet(cv, P)
    t = j["tip"]
    if name == "windup":
        sparkle(cv, add(t, (0, -3)), WHITE, VENOM[1])
    elif name == "attack":
        burst(cv, add(t, (2, 1)), 4.2, VENOM[1], WHITE, spikes=7)
    elif name == "recover":  # 독 바늘 셋이 퍼지며 날아간다
        for k, (dy, x0, x1) in enumerate(((-6, 6, 16), (0, 14, 27), (6, 9, 20))):
            a = add(t, (x0, dy * 0.6))
            b = add(t, (x1, dy))
            needle(cv, a, b)
        glow(cv, add(t, (1, 0)), 2.6, [VENOM[0], VENOM[1], VENOM[2]])
        sparkle(cv, add(t, (25, -9)), WHITE, VENOM[1])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((7, -8), (9, -5), (8, -11)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("sylph-hornet-transparent", draw, sys.argv[1:], idle_ms=90)
