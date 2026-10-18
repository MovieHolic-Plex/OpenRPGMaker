#!/usr/bin/env python3
"""거대 벌(bee-giant) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

털 난 둥근 가슴에 큰 겹눈 머리가 오른쪽을 보고, 노랑·검정 줄무늬 배가 뒤로 늘어져 끝에 독침이 있다.
투명한 날개 두 쌍이 칸마다 위·가운데·아래로 퍼덕이고, 가는 다리 셋이 허공에 늘어진다.
6번 칸(스킬 skill_mon_poison_sting): 배를 몸 아래로 앞까지 말아 독침에서 빛나는 독 바늘을 쏜다.

  python3 scripts/content/monsters/redraw_bee_giant.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import (Canvas, add, burst, chain, ellipse, glow, lerp, polar, poly, rnd, run, slash, sparkle,
                       speed_lines)

INK = (46, 28, 14)
FUR = [(150, 96, 22), (214, 150, 36), (246, 198, 70), (255, 236, 150)]
FUR_FAR = [(110, 70, 20), (150, 96, 22), (190, 130, 34), (190, 130, 34)]
BAND = (40, 26, 16)
BAND_HI = (78, 54, 30)
WING = [(120, 170, 196), (170, 214, 232), (214, 240, 250), (246, 255, 255)]
WING_INK = (60, 92, 120)
EYE = [(70, 10, 18), (150, 24, 34), (226, 66, 54), (255, 190, 150)]
STING = [(40, 30, 30), (88, 70, 66), (150, 130, 120), (220, 210, 200)]
LEG = [(36, 24, 14), (70, 48, 26), (110, 80, 44), (110, 80, 44)]
VENOM = [(70, 30, 110), (140, 70, 200), (196, 140, 250), (244, 220, 255)]
WHITE = (255, 252, 236)


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def wing(cv, root, ang, length, width, far=False):
    """잎 모양 날개(뿌리 → 끝). far 는 뒤 날개: 더 짙고 짧다."""
    pts = []
    for i in range(9):
        t = i / 8
        pts.append((length * t, -width * math.sin(math.pi * t) ** 0.8))
    for i in range(8, -1, -1):
        t = i / 8
        pts.append((length * t, width * 0.35 * math.sin(math.pi * t)))
    ramp = [WING[0], WING[0], WING[1], WING[1]] if far else WING
    m = poly(cv.blank(), xf(root, ang, pts))
    cv.part(m, ramp, ink=WING_INK, gloss=False)
    # 날개맥: 뿌리에서 끝으로 한 줄 + 갈래
    vein = xf(root, ang, [(1, -1), (length * 0.55, -width * 0.45), (length * 0.9, -width * 0.2)])
    cv.line(vein, WING[0] if not far else WING_INK)
    cv.line(xf(root, ang, [(length * 0.55, -width * 0.45), (length * 0.7, -width * 0.85)]), WING[0])
    return m


def abdomen(cv, attach, ang, L=17.0, W=12.0, glow_tip=False):
    """줄무늬 배. attach 에서 ang 쪽으로 뻗고 끝에 독침."""
    top, bot = [], []
    for i in range(13):
        t = i / 12
        hw = W / 2 * math.sin(math.pi * (0.16 + 0.8 * t)) ** 0.7
        top.append((L * t, -hw))
        bot.append((L * t, hw))
    m = poly(cv.blank(), xf(attach, ang, top + bot[::-1]))
    M = cv.part(m, FUR)
    for t0 in (0.30, 0.52, 0.74):
        band = poly(cv.blank(), xf(attach, ang, [(L * t0, -W), (L * (t0 + 0.11), -W), (L * (t0 + 0.11), W), (L * t0, W)]))
        B = (np.array(band) > 0) & M
        cv.put(B, BAND)
        # 줄 윗단 반사광
        hi = B & ~np.roll(B, 1, axis=0)
        cv.rgb[hi] = BAND_HI
    tip = xf(attach, ang, [(L + 4.5, 0)])[0]
    base = xf(attach, ang, [(L - 1.5, 0)])[0]
    cv.part(chain([base, lerp(base, tip, 0.5), tip], [3.0, 2.0, 1.0]), STING, gloss=False)
    cv.pixel(*rnd(tip), VENOM[3] if glow_tip else STING[3])
    return tip


def leg(cv, hip, knee_d, foot_d, far=False):
    ramp = LEG if not far else [LEG[0], LEG[0], LEG[1], LEG[1]]
    knee = add(hip, knee_d)
    foot = add(knee, foot_d)
    cv.part(chain([hip, knee], [2.0, 2.0]), ramp, gloss=False)
    cv.line4([knee, foot], ramp[1] if not far else ramp[0])
    cv.pixel(*rnd(add(foot, (1, 0))), ramp[1])
    return foot


def head(cv, c, tilt=0, eye="open", mouth=0):
    """둥근 머리 + 앞쪽 큰 겹눈 + 더듬이 둘 + 큰턱."""
    # 더듬이(뒤 → 앞): 위로 솟았다 앞으로 꺾인다
    for dx, col in ((-1, LEG[1]), (2, LEG[2])):
        root = add(c, (dx, -4))
        elbow = xf(root, tilt, [(-1, -6)])[0]
        tip = xf(elbow, tilt, [(5, -3)])[0]
        cv.line4([root, elbow, tip], col)
        cv.pixel(*rnd(tip), FUR[2])
    cv.part(ellipse(cv.blank(), c, 5.5, 5.0), FUR)
    jaw = xf(c, tilt, [(4, 3)])[0]
    up = xf(jaw, tilt, [(3 + mouth * 0.3, -1 - mouth * 0.4)])[0]
    lo = xf(jaw, tilt, [(3, 1 + mouth * 0.6)])[0]
    cv.line4([jaw, up], INK)
    cv.line4([jaw, lo], INK)
    e = xf(c, tilt, [(2.0, -0.5)])[0]
    if eye == "shut":
        cv.line([add(e, (-2, 0)), add(e, (2, 0))], INK)
        cv.line([add(e, (-2, -1)), add(e, (2, -1))], EYE[0])
    else:
        cv.part(ellipse(cv.blank(), e, 3.0, 3.6), EYE, ink=INK)
        cv.pixel(e[0] - 1, e[1] - 2, EYE[3])
        cv.pixel(e[0], e[1] - 2, WHITE)
        if eye == "glow":
            cv.pixel(e[0] + 1, e[1], WHITE)
    return jaw


BASE = dict(c=(28.0, 32.0), tilt=0, wing=-40, abd=150, abdL=17.0, legs="hang", eye="open", mouth=0, glow=False)


def params(name):
    p = dict(BASE)
    if name == "idle_a":
        pass
    elif name == "idle_b":  # 날개를 내리치며 몸이 1칸 뜬다
        p.update(c=(28.0, 31.0), wing=-22, abd=146)
    elif name == "idle_c":  # 날개 가운데, 몸을 1칸 낮춘다
        p.update(c=(28.0, 33.0), wing=-70, abd=154)
    elif name == "windup":  # 몸을 뒤로 젖히고 배를 위로 감아올려 독침을 세운다
        p.update(c=(27.0, 34.0), tilt=-12, wing=-85, abd=232, abdL=15.0, glow=True, mouth=4, eye="glow")
    elif name == "move":  # 앞으로 고개를 숙이고 날개를 뒤로 젖혀 돌진
        p.update(c=(33.0, 34.0), tilt=16, wing=-160, abd=170, legs="back")
    elif name == "attack":  # 배를 몸 아래로 앞까지 내질러 독침으로 찌른다
        p.update(c=(29.0, 30.0), tilt=6, wing=-20, abd=80, abdL=18.0, legs="up", mouth=5)
    elif name == "recover":  # 스킬 독침: 배를 앞으로 말아 독 바늘을 쏜다
        p.update(c=(26.0, 29.0), tilt=-6, wing=-60, abd=62, abdL=17.0, glow=True, legs="up", eye="glow", mouth=3)
    elif name == "hit":  # 맞고 뒤로 기울며 날개가 구겨진다
        p.update(c=(25.0, 33.0), tilt=-26, wing=-120, abd=176, eye="shut", legs="splay", mouth=2)
    return p


LEG_POSES = {
    "hang": [((-1, 5), (-2, 7)), ((1, 6), (0, 7)), ((3, 5), (3, 7))],
    "back": [((-3, 4), (-6, 4)), ((-1, 5), (-4, 5)), ((1, 5), (-2, 6))],
    "up": [((-2, 5), (2, 5)), ((0, 6), (4, 4)), ((2, 5), (6, 3))],
    "splay": [((-3, 5), (-3, 7)), ((1, 6), (2, 7)), ((4, 4), (6, 6))],
}


def draw_bee(cv, P):
    c, tilt = P["c"], P["tilt"]
    thorax_rear = xf(c, tilt, [(-4, 1)])[0]
    head_c = xf(c, tilt, [(9, -1)])[0]
    root = xf(c, tilt, [(-1, -4)])[0]
    # 뒤 날개 → 먼 다리 → 배 → 가슴 → 머리 → 가까운 다리 → 앞 날개
    wing(cv, add(root, (1, 0)), P["wing"] + tilt + 14, 15, 5, far=True)
    for i, (k, f) in enumerate(LEG_POSES[P["legs"]]):
        leg(cv, xf(c, tilt, [(-1 + i * 3, 4)])[0], add(k, (1, -1)), f, far=True)
    tip = abdomen(cv, thorax_rear, P["abd"] + tilt, P["abdL"], 12.0, P["glow"])
    cv.part(ellipse(cv.blank(), c, 7.0, 6.5), FUR)
    # 가슴 털 결
    for dx, dy in ((-3, -3), (0, -4), (3, -3), (-4, 0)):
        p = xf(c, tilt, [(dx, dy)])[0]
        cv.pixel(*rnd(p), FUR[3])
    for dx, dy in ((-2, 3), (2, 4), (-5, 2)):
        p = xf(c, tilt, [(dx, dy)])[0]
        cv.pixel(*rnd(p), FUR[0])
    jaw = head(cv, head_c, tilt, P["eye"], P["mouth"])
    for i, (k, f) in enumerate(LEG_POSES[P["legs"]]):
        leg(cv, xf(c, tilt, [(0 + i * 3, 5)])[0], k, f)
    wing(cv, root, P["wing"] + tilt, 18, 6.5)
    return dict(tip=tip, head=head_c, jaw=jaw, c=c)


def draw_dead(cv):
    """뒤집혀 바닥에 떨어져 다리를 오그리고 날개가 바닥에 깔린 모습."""
    wing(cv, (24, 56), 190, 16, 4, far=True)
    tip = abdomen(cv, (24, 55), 186, 15.0, 10.0)
    cv.part(ellipse(cv.blank(), (29, 55), 6.0, 4.5), FUR)
    for hx, k, f in ((26, (-1, -4), (2, -3)), (29, (0, -5), (2, -3)), (32, (1, -4), (3, -2))):
        leg(cv, (hx, 51), k, f)
    cv.part(ellipse(cv.blank(), (38, 56), 4.5, 3.8), FUR)
    e = (40, 56)
    for d in ((-1, -1), (1, 1), (-1, 1), (1, -1), (0, 0)):
        cv.pixel(e[0] + d[0], e[1] + d[1], INK)
    cv.line4([(41, 53), (44, 49), (47, 50)], LEG[1])
    wing(cv, (28, 58), 4, 17, 3.5)
    return tip


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_bee(Canvas(64, INK), P)
    if name == "move":
        speed_lines(cv, 2, 12, (26, 31, 37), WING[1])
    elif name == "recover":
        glow(cv, j["tip"], 8, [VENOM[0], VENOM[1]])
    elif name == "windup":
        glow(cv, j["tip"], 4.5, [VENOM[0]])
    j = draw_bee(cv, P)
    t = j["tip"]
    if name == "attack":
        slash(cv, add(t, (-8, -6)), add(t, (8, 6)), 5, 3.4, VENOM[2], WHITE)
        burst(cv, add(t, (2, 1)), 4.5, VENOM[2], WHITE, spikes=6, rot=10)
    elif name == "recover":
        # 독 바늘 셋이 아군 쪽으로 날아간다(앞 바늘이 가장 길고 밝다)
        for k, (dy, ln) in enumerate(((-3, 9), (1, 12), (5, 7))):
            a = add(t, (5 + k * 4, dy - 4 + k))
            b = add(a, (ln, -1 + k))
            cv.line([add(a, (-3, 0)), a], VENOM[1])
            cv.line([a, b], VENOM[2])
            cv.pixel(*rnd(b), WHITE)
        burst(cv, t, 3.5, VENOM[2], VENOM[3], spikes=6, rot=15)
        sparkle(cv, add(t, (-5, -6)), VENOM[3], VENOM[2], big=True)
        sparkle(cv, (57, 22), VENOM[3], VENOM[2])
    elif name == "windup":
        sparkle(cv, add(t, (3, -4)), VENOM[3], VENOM[2])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((6, -6), (8, -4), (7, -8), (9, -2)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bee-giant", draw, sys.argv[1:], idle_ms=120)
