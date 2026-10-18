#!/usr/bin/env python3
"""실프(sylph-air) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

흰 깃날개 바람 요정: 뒤로 쓸린 흰 볏 머리칼, 하얀 얼굴에 하늘색 눈, 등 뒤로 길게 휜 흰 깃날개 한 쌍,
가는 상반신과 팔, 허리 아래는 파란 바람 리본 두 가닥이 꼬리처럼 감겨 내려가며 떠 있다. 오른쪽(아군)을 본다.
몸통 뼈대·명암은 elemental_rig(빛의 정령과 같은 뼈대), 날개 모양은 redraw_spirit_light.wing 을 쓴다.
6번 칸(스킬 skill_mon_gale_wing): 날개를 활짝 펴 위로 치고, 내민 손에서 아군 쪽으로 회오리 칼바람이 뻗는다.

  python3 scripts/content/monsters/redraw_sylph_air.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import (EPose, arm_mask, bezier, body_field, chain, ellipse, grid, m, paint, skeleton, tail_mask, tongue,
                           torso_mask)
from pixel_lib import Canvas, add, arc_trail, polar, rnd, run, slash, sparkle
from redraw_spirit_light import wing

INK = (12, 18, 40)
SKIN = [(206, 180, 176), (240, 222, 214), (255, 246, 240)]
HAIR = [(92, 120, 176), (150, 180, 226), (214, 232, 252)]
FEATHER = [(96, 120, 160), (160, 182, 212), (214, 226, 244), (255, 255, 255)]
DRESS = [(52, 86, 150), (86, 130, 196), (136, 180, 230)]
RIBBON = [(34, 70, 150), (62, 118, 204), (120, 180, 240), (206, 232, 255)]
EYE = (90, 200, 240)
FX = [(150, 200, 236), (214, 238, 252), (255, 255, 255)]


def ribbons(cv, j, sway):
    """허리 아래 회오리: 굵게 말려 내려가는 바람 꼬리 + 뒤로 풀려 나간 리본 한 가닥."""
    h, k = j["hip"], j["k"]
    M = tail_mask(cv, j, (7.0, 6.0, 4.4, 2.8, 1.2))
    a = add(h, (-3, 2))
    pts = bezier(a, add(a, (-8 + sway, 2)), add(a, (-14 + sway, -3)), 6)
    M |= m(cv, chain(pts, list(np.linspace(2.6, 0.8, len(pts)) * k)))
    return M


def head(cv, j, swept=0.0):
    k, h = j["k"], j["head"]
    face = m(cv, ellipse(cv.blank(), add(h, (1.6 * k, 0.8 * k)), 3.4 * k, 4.0 * k))
    hair = m(cv, ellipse(cv.blank(), add(h, (-0.6 * k, -0.6 * k)), 4.4 * k, 4.6 * k))
    for i, (dy, ln, w) in enumerate(((-3, 12, 4.4), (0, 10, 3.6), (3, 7, 2.8))):  # 뒤로 길게 쓸린 볏
        hair |= m(cv, tongue(cv, add(h, (-2 * k, dy * k)), 172 + i * 12 + swept, ln * k, w * k, curl=2.4 - i * 0.6))
    return hair & ~face, face


def figure(cv, P: EPose, eyes="open", mouth=0):
    j = skeleton(P)
    spread, ln, lift = P.extra.get("wing", (12, 24, 0))
    wing_f = wing(cv, j, "f", spread, ln, lift - 12)
    wing_n = wing(cv, j, "n", spread, ln * 1.02, lift + 4)
    arm_f = arm_mask(cv, j, "f", (2.8, 2.4, 2.0))
    rib = ribbons(cv, j, P.tail)
    torso = torso_mask(cv, j) & m(cv, ellipse(cv.blank(), j["R"](1, -4 * j["k"]), 5.2 * j["k"], 10 * j["k"]))
    hair, face = head(cv, j, P.extra.get("swept", 0.0))
    arm_n = arm_mask(cv, j, "n", (3.0, 2.6, 2.2))
    ref = torso | hair | face | rib
    x, y = grid()
    twist = np.where(np.sin((x * 0.8 - y * 0.9 + P.seed * 2) / 1.4) > 0.6, 1.0, 0.0)
    paint(cv, wing_f, FEATHER[:3], body_field(wing_f, base=0.3, dstep=0.45, ref=ref), INK)
    paint(cv, arm_f, SKIN[:2], body_field(arm_f, base=0.0, ref=ref), INK)
    paint(cv, rib, RIBBON, body_field(rib, base=0.5, dstep=0.5, ref=ref, extra=twist), INK, rim=RIBBON[3])
    paint(cv, torso, DRESS, body_field(torso, base=0.5, ref=ref), INK)
    paint(cv, wing_n, FEATHER, body_field(wing_n, base=1.0, dstep=0.5, ref=ref), INK, rim=FEATHER[3])
    paint(cv, hair, HAIR, body_field(hair, base=0.6, dstep=0.6, ref=ref), INK, rim=HAIR[2])
    paint(cv, face, SKIN, body_field(face, base=0.8, dstep=0.5, ref=ref), INK)
    paint(cv, arm_n, SKIN, body_field(arm_n, base=0.9, ref=ref), INK)
    # 허리 바람 매듭 + 손끝
    core = rnd(j["R"](0, 6 * j["k"]))
    cv.pixel(core[0], core[1], RIBBON[3])
    cv.pixel(core[0] + 1, core[1], RIBBON[2])
    h, k = j["head"], j["k"]
    for ex, w in ((3.0, 2), (0.2, 1)):
        e = rnd(add(h, (ex * k, 0.4 * k)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (w - 1, 1))], INK)
            continue
        for dx in range(w):
            cv.pixel(e[0] + dx, e[1], EYE)
        cv.pixel(e[0] - 1 + (w if eyes == "angry" else 0), e[1] - 1, INK)
    mo = rnd(add(h, (3.0 * k, 3.4 * k)))
    if mouth:
        cv.put(m(cv, ellipse(cv.blank(), mo, 0.9, mouth * 0.6)), INK)
    else:
        cv.pixel(mo[0], mo[1], SKIN[0])
    return j


POSES = dict(
    idle_a=(EPose(c=(32, 30), arm_n=(65, -15), arm_f=(115, 80), tail=0, seed=0, extra=dict(wing=(12, 24, 0))), "open", 0),
    idle_b=(EPose(c=(32, 28), arm_n=(52, -28), arm_f=(108, 70), tail=2, seed=1, lean=-3, extra=dict(wing=(13, 25, -10), swept=-6)), "open", 0),
    idle_c=(EPose(c=(32, 29), arm_n=(75, -2), arm_f=(122, 88), tail=-2, seed=2, lean=3, extra=dict(wing=(11, 24, 8), swept=5)), "open", 1),
    windup=(EPose(c=(29, 32), lean=-12, arm_n=(-95, -120), arm_f=(-115, -135), tail=4, seed=3, extra=dict(wing=(15, 26, -16), swept=-8)), "angry", 1),
    move=(EPose(c=(36, 31), lean=22, arm_n=(150, 175), arm_f=(160, 185), tail=7, seed=4, extra=dict(wing=(9, 24, 22), swept=10)), "angry", 0),
    attack=(EPose(c=(36, 30), lean=16, arm_n=(-2, -10), arm_f=(150, 170), tail=3, seed=5, extra=dict(wing=(11, 24, 12), swept=6)), "angry", 1),
    recover=(EPose(c=(28, 31), lean=-4, k=1.04, arm_n=(-20, -5), arm_f=(-140, -160), tail=2, seed=6, extra=dict(wing=(18, 27, -26), swept=-10)), "angry", 2),
    hit=(EPose(c=(27, 33), lean=-24, k=0.96, arm_n=(110, 150), arm_f=(80, 120), tail=-4, seed=7, extra=dict(wing=(8, 20, 26), swept=14)), "shut", 1),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 땅에 엎드린 요정: 접힌 날개, 풀린 바람 리본
        wingm = m(cv, tongue(cv, (30, 54), 205, 15, 5.0, curl=1.5)) | m(cv, tongue(cv, (30, 54), 218, 12, 4.0, curl=1.0))
        rib = m(cv, chain([(26, 57), (20, 58), (14, 56), (10, 57)], [3.0, 2.4, 1.6, 1.0])) | m(cv, chain([(28, 57), (36, 58), (44, 57)], [3.6, 3.0, 2.0]))
        face = m(cv, ellipse(cv.blank(), (42, 54), 3.0, 2.6))
        hair = m(cv, ellipse(cv.blank(), (39, 53), 3.4, 3.0)) & ~face
        paint(cv, rib, RIBBON[:3], body_field(rib, base=0.4), INK)
        paint(cv, wingm, FEATHER[:3], body_field(wingm, base=0.3), INK, rim=FEATHER[2])
        paint(cv, hair, HAIR, body_field(hair, base=0.4), INK)
        paint(cv, face, SKIN, body_field(face, base=0.5), INK)
        cv.line([(42, 54), (43, 54)], INK)
        return cv.image()
    P, eyes, mouth = POSES[name]
    j = figure(cv, P, eyes, mouth)
    if name == "windup":
        mid = ((j["hand_n"][0] + j["hand_f"][0]) / 2, min(j["hand_n"][1], j["hand_f"][1]) - 3)
        arc_trail(cv, mid, 4.5, 180, 500, 1.4, FX[0], FX[1])
        sparkle(cv, mid, FX[2], FX[1])
    elif name == "move":
        for y, x0 in ((22, 3), (31, 2), (41, 4)):
            cv.line([(x0, y), (x0 + 7, y)], FX[0])
            cv.pixel(x0 + 7, y, FX[1])
    elif name == "attack":
        hd = j["hand_n"]
        slash(cv, add(hd, (5, -8)), add(hd, (7, 8)), 4, 2.2, FX[1], FX[2])
        slash(cv, add(hd, (10, -5)), add(hd, (11, 5)), 3, 1.3, FX[0], FX[1])
    elif name == "recover":
        # 회오리 칼바람: 손에서 아군 쪽으로 커지는 나선 고리 셋
        hd = j["hand_n"]
        for i, (dx, r) in enumerate(((8, 3.0), (15, 4.5), (23, 6.0))):
            c = (min(hd[0] + dx, 58 - r), hd[1] + i)
            arc_trail(cv, c, r, -60 + i * 30, 240 + i * 30, 1.6, FX[0], FX[1])
        sparkle(cv, (56, 18), FX[2], FX[1], big=True)
        sparkle(cv, (48, 48), FX[2], FX[1])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((8, -3), (10, 1), (9, 5)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), (255, 255, 255))
        for a, b in (((46, 28), (52, 25)), ((47, 38), (54, 38))):
            cv.line([a, b], FX[0])
    return cv.image()


if __name__ == "__main__":
    run("sylph-air", draw, sys.argv[1:], idle_ms=170)
