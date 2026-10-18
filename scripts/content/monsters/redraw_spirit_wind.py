#!/usr/bin/env python3
"""바람의 정령(spirit-wind) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

회청색 구름 머리(뒤로 흩날리는 구름 갈기)에 빛나는 하늘색 눈, 넓은 어깨에서 갈라지는 바람 팔과 세 갈래 손톱,
등 뒤로 뻗는 깃털 같은 공기 날개 둘, 몸 아래는 말려 내려가는 회오리 꼬리로 떠 있다.
몸에는 비스듬히 감기는 흰 바람 띠. 오른쪽(아군)을 본다.
6번 칸(스킬 skill_mon_gale_wing): 두 날개를 활짝 펴고 팔을 벌려 아군 쪽으로 초승달 칼바람 셋을 날린다.

  python3 scripts/content/monsters/redraw_spirit_wind.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import (EPose, arm_mask, body_field, ellipse, grid, head_mask, m, paint, skeleton, tail_mask,
                           tongue, torso_mask)
from pixel_lib import Canvas, add, arc_trail, polar, rnd, run, slash, sparkle

INK = (22, 32, 54)
RAMP = [(52, 70, 102), (80, 104, 138), (116, 144, 176), (164, 190, 214), (222, 236, 246)]
WING = [(66, 88, 122), (98, 126, 160), (140, 168, 198), (196, 216, 234)]
EYE, EYE_GLOW, MOUTH = (246, 255, 255), (120, 222, 240), (30, 40, 70)
FX = [(150, 196, 226), (206, 232, 246), (255, 255, 255)]


def bands(seed, k=1.0):
    """비스듬히 몸을 감는 바람 띠(1 = 띠 위)."""
    x, y = grid()
    v = np.sin((y * 0.9 - x * 0.5 + seed * 1.3) / (2.2 * k))
    return (v > 0.8).astype(float)


def wing(cv, j, side, spread, ln, lift):
    """어깨 뒤에서 위·뒤로 뻗는 깃털 날개(가늘고 긴 깃 넷 겹침, 위 깃이 가장 길다)."""
    s = add(j["sh_" + side], (-4, 0))
    M = np.zeros((64, 64), bool)
    for i in range(4):
        ang = -128 + lift - i * spread
        M |= m(cv, tongue(cv, s, ang, ln * (1 - i * 0.16), 5.0 - i * 0.6, curl=-3.5))
    return M


def cloud_head(cv, j, seed):
    k, h = j["k"], j["head"]
    M = head_mask(cv, j)
    for dx, dy, r in ((-4, -3, 3.8), (-1, -5.5, 3.4), (-7, 0, 3.2), (-8, -4, 2.6)):
        M |= m(cv, ellipse(cv.blank(), add(h, (dx * k, dy * k)), r * k, r * k))
    # 뒤로 흩날리는 구름 갈기
    for i, (dy, ln) in enumerate(((-4, 9), (0, 8), (3, 6))):
        M |= m(cv, tongue(cv, add(h, (-7 * k, dy * k)), 192 + i * 10 + math.sin(seed + i) * 6, ln * k, 4.2 * k, curl=2))
    return M


def face(cv, j, eyes, mouth):
    """구름 머리 앞쪽의 짙은 얼굴 그늘 + 빛나는 눈 둘 + 입."""
    h, k = j["head"], j["k"]
    cv.put(m(cv, ellipse(cv.blank(), add(h, (2.8 * k, 0.6 * k)), 3.6 * k, 2.6 * k)), RAMP[0])
    for ex, w in ((4.2, 2), (0.6, 1)):  # 가까운 눈 · 먼 눈
        e = rnd(add(h, (ex * k, 0)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (w - 1, 1))], EYE_GLOW)
            continue
        for dx in range(w):
            cv.pixel(e[0] + dx, e[1], EYE)
            cv.pixel(e[0] + dx, e[1] - 1, EYE_GLOW if eyes != "angry" or dx == w - 1 else RAMP[0])
    mo = rnd(add(h, (4.4 * k, 2.6 * k)))
    if mouth:
        cv.put(m(cv, ellipse(cv.blank(), mo, 1.2, mouth * 0.6)), MOUTH)
    else:
        cv.line([add(mo, (-1, 0)), add(mo, (0, 0))], MOUTH)


def claws(cv, j, side):
    k, hd = j["k"], j["hand_" + side]
    e = j["el_" + side]
    a = math.degrees(math.atan2(hd[1] - e[1], hd[0] - e[0]))
    M = np.zeros((64, 64), bool)
    for da in (-32, 0, 32):
        M |= m(cv, tongue(cv, polar(hd, a, 1.0), a + da, 5.5 * k, 2.2 * k, curl=1.0))
    return M


def figure(cv, P: EPose, eyes="open", mouth=0):
    j = skeleton(P)
    spread, ln, lift = P.extra.get("wing", (16, 20, 0))
    wing_f = wing(cv, j, "f", spread, ln, lift - 10)
    wing_n = wing(cv, j, "n", spread * 0.9, ln * 0.95, lift + 8)
    arm_f = arm_mask(cv, j, "f")
    claw_f = claws(cv, j, "f")
    body = tail_mask(cv, j, (8.0, 6.6, 4.6, 2.8, 1.2)) | torso_mask(cv, j) | cloud_head(cv, j, P.seed)
    arm_n = arm_mask(cv, j, "n", (4.2, 3.4, 2.8))
    claw_n = claws(cv, j, "n")
    b = bands(P.seed)
    paint(cv, wing_f, WING[:3], body_field(wing_f, base=0.2, dstep=0.4, ref=body), INK)
    paint(cv, arm_f | claw_f, RAMP[:3], body_field(arm_f | claw_f, base=0.0, ref=body), INK)
    paint(cv, wing_n, WING, body_field(wing_n, base=0.9, dstep=0.5, ref=body), INK, rim=WING[3])
    paint(cv, body, RAMP, body_field(body, base=0.5, dstep=0.55, ref=body, extra=b * 1.5), INK, rim=RAMP[4])
    paint(cv, arm_n, RAMP, body_field(arm_n, base=0.9, ref=body, extra=b), INK)
    paint(cv, claw_n & ~arm_n, [RAMP[3], RAMP[4], FX[2]], body_field(claw_n, base=0.6, ref=body), INK)
    # 가슴 속 바람 눈(소용돌이 심)
    core = rnd(j["core"])
    for p in ((0, 0), (1, 0), (0, 1), (1, -1)):
        cv.pixel(core[0] + p[0], core[1] + p[1], RAMP[4])
    cv.pixel(core[0] + 1, core[1], FX[2])
    face(cv, j, eyes, mouth)
    return j


POSES = dict(
    idle_a=(EPose(c=(31, 32), arm_n=(55, -5), arm_f=(115, 70), tail=0, seed=0, extra=dict(wing=(16, 24, 0))), "open", 0),
    idle_b=(EPose(c=(31, 30), arm_n=(45, -15), arm_f=(108, 60), tail=2, seed=1, lean=-3, extra=dict(wing=(17, 25, -8))), "open", 0),
    idle_c=(EPose(c=(32, 31), arm_n=(62, 5), arm_f=(122, 78), tail=-2, seed=2, lean=3, extra=dict(wing=(15, 24, 6))), "open", 1),
    windup=(EPose(c=(29, 36), lean=-12, k=1.0, arm_n=(-95, -60), arm_f=(-120, -90), tail=4, seed=3, extra=dict(wing=(19, 26, -12))), "angry", 2),
    move=(EPose(c=(35, 33), lean=22, arm_n=(150, 175), arm_f=(160, 185), tail=6, seed=4, extra=dict(wing=(12, 24, 20))), "angry", 0),
    attack=(EPose(c=(36, 32), lean=18, arm_n=(5, -10), arm_f=(150, 170), tail=3, seed=5, extra=dict(wing=(14, 24, 12))), "angry", 2),
    recover=(EPose(c=(28, 32), lean=-6, k=1.06, arm_n=(-35, -15), arm_f=(-140, -165), tail=2, seed=6, extra=dict(wing=(21, 27, -18))), "angry", 3),
    hit=(EPose(c=(26, 34), lean=-24, k=0.95, arm_n=(110, 150), arm_f=(80, 120), tail=-4, seed=7, extra=dict(wing=(10, 20, 26))), "shut", 2),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 흩어지는 낮은 구름: 바닥에 깔린 구름 몸 + 감긴 눈, 위로 풀려 나가는 바람 가닥
        M = np.zeros((64, 64), bool)
        for c, rx, ry in (((30, 56), 10, 3.0), ((24, 54), 4.5, 3.2), ((33, 53), 4.0, 3.4), ((40, 55), 4.0, 2.6)):
            M |= m(cv, ellipse(cv.blank(), c, rx, ry))
        paint(cv, M, RAMP[:4], body_field(M, base=0.3, dstep=0.6), INK, rim=RAMP[3])
        for p in ((36, 53), (39, 53)):
            cv.line([p, add(p, (1, 1))], MOUTH)
        for a, b in (((22, 50), (16, 44)), ((30, 49), (27, 42)), ((38, 50), (42, 45))):
            slash(cv, a, b, 2, 1, FX[0], FX[1])
        return cv.image()
    P, eyes, mouth = POSES[name]
    j = figure(cv, P, eyes, mouth)
    if name == "windup":
        # 쳐든 두 손 사이로 모이는 바람 고리
        mid = ((j["hand_n"][0] + j["hand_f"][0]) / 2, min(j["hand_n"][1], j["hand_f"][1]) - 3)
        arc_trail(cv, mid, 5, 200, 520, 1.6, FX[0], FX[1])
        sparkle(cv, mid, FX[2], FX[1])
    elif name == "move":
        for y, x0 in ((24, 3), (33, 2), (44, 5)):
            cv.line([(x0, y), (x0 + 7, y)], FX[0])
            cv.pixel(x0 + 7, y, FX[1])
    elif name == "attack":
        # 내민 손톱 앞으로 뻗는 칼바람(초승달)
        h = j["hand_n"]
        slash(cv, add(h, (6, -9)), add(h, (8, 9)), 5, 2.4, FX[1], FX[2])
        slash(cv, add(h, (11, -6)), add(h, (12, 6)), 3, 1.4, FX[0], FX[1])
    elif name == "recover":
        # 날개 돌풍: 아군 쪽으로 날아가는 초승달 칼바람 셋 + 몸을 감는 바람 고리
        for (x, y), s in (((50, 16), 7), ((55, 31), 8), ((50, 46), 7)):
            slash(cv, (x - 2, y - s), (x - 1, y + s), 4, 2.2, FX[1], FX[2])
        arc_trail(cv, j["core"], 15, 100, 250, 1.4, FX[0], FX[1])
        sparkle(cv, (58, 22), FX[2], FX[1], big=True)
    elif name == "hit":
        t = j["head"]
        for dx, dy in ((9, -4), (11, 0), (10, 4)):
            cv.pixel(int(t[0] + dx), int(t[1] + dy), (255, 255, 255))
        for a, b in (((46, 26), (52, 23)), ((47, 36), (54, 36))):
            cv.line([a, b], FX[1])
    return cv.image()


if __name__ == "__main__":
    run("spirit-wind", draw, sys.argv[1:], idle_ms=160)
