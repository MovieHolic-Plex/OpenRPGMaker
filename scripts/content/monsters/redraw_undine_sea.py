#!/usr/bin/env python3
"""운디네(undine-sea) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

물의 정령 인어: 금빛 조개 관, 등 뒤로 길게 물결치는 청록 머리칼, 연한 물빛 피부, 가슴의 비늘 배판,
허리 아래는 비늘 무늬가 진 굵은 물고기 꼬리가 뒤로 크게 말리고 끝에 갈라진 지느러미. 오른쪽(아군)을 본다.
몸통 뼈대·명암은 elemental_rig.
6번 칸(스킬 skill_mon_tidal_wave): 두 팔을 쳐들면 아군 쪽 바닥에서 물마루가 하얗게 부서지는 큰 파도가 말려 오른다.

  python3 scripts/content/monsters/redraw_undine_sea.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import (EPose, arm_mask, bezier, body_field, chain, ellipse, grid, m, paint, poly, skeleton,
                           tongue, top_edge, torso_mask)
from pixel_lib import Canvas, add, burst, polar, rnd, run, sparkle

INK = (10, 30, 40)
SKIN = [(130, 186, 196), (176, 222, 226), (224, 248, 248)]
HAIR = [(24, 96, 108), (40, 140, 148), (80, 190, 190), (170, 236, 228)]
TAIL = [(22, 92, 104), (36, 132, 140), (70, 176, 172), (140, 220, 206)]
FIN = [(60, 150, 170), (110, 200, 214), (190, 240, 246)]
GOLD = [(176, 120, 36), (230, 182, 70), (255, 236, 160)]
EYE = (250, 220, 90)
FX = [(40, 110, 190), (80, 170, 230), (170, 226, 250), (250, 255, 255)]


def fish_tail(cv, j, curl, flick):
    """허리에서 아래·뒤로 말리는 굵은 꼬리 + 갈라진 꼬리지느러미. curl 은 말림, flick 은 끝 흔들림."""
    h, k = j["hip"], j["k"]
    p0 = add(h, (0, 1))
    p1 = add(h, (3 + curl * 0.3, 10 * k))
    p2 = add(h, (-4 + curl * 0.5, 17 * k))
    p3 = add(h, (-12 + curl, 16 * k))
    p4 = add(h, (-16 + curl * 1.1 + flick, 9 * k))
    pts = bezier(p0, p1, p2, 6) + bezier(p2, p3, p4, 6)[1:]
    ws = list(np.interp(np.linspace(0, 1, len(pts)), [0, 0.3, 0.7, 1], [7.4, 6.6, 4.0, 2.2]) * k)
    body = m(cv, chain(pts, ws))
    end = pts[-1]
    a = math.degrees(math.atan2(end[1] - pts[-3][1], end[0] - pts[-3][0]))
    fin = m(cv, tongue(cv, end, a - 38, 8 * k, 4.6 * k, curl=-1.5)) | m(cv, tongue(cv, end, a + 32, 7 * k, 4.2 * k, curl=1.5))
    return body, fin


def head(cv, j, flow):
    k, h = j["k"], j["head"]
    face = m(cv, ellipse(cv.blank(), add(h, (1.6 * k, 0.8 * k)), 3.4 * k, 4.0 * k))
    hair = m(cv, ellipse(cv.blank(), add(h, (-0.8 * k, -0.4 * k)), 4.6 * k, 4.8 * k))
    # 등 뒤로 물결치며 흘러내리는 긴 머리칼(세 가닥)
    for i, (dy, ln, w) in enumerate(((-2, 14, 5.0), (1, 12, 4.2), (4, 9, 3.2))):
        base = add(h, (-2.5 * k, dy * k))
        hair |= m(cv, tongue(cv, base, 120 + i * 18 + flow, ln * k, w * k, curl=-2.6 + i * 0.8 + flow * 0.1))
    return hair & ~face, face


def crown(cv, j):
    """머리 위 조개 관: 부채꼴 + 세로 골."""
    h, k = j["head"], j["k"]
    c = add(h, (-0.4 * k, -4.6 * k))
    pts = [add(c, (-3.4 * k, 1)), add(c, (-2.6 * k, -2.4 * k)), add(c, (0, -3.4 * k)), add(c, (2.6 * k, -2.4 * k)), add(c, (3.4 * k, 1))]
    M = m(cv, poly(cv.blank(), pts))
    paint(cv, M, GOLD, body_field(M, base=0.6, dstep=0.6), INK, rim=GOLD[2])
    for dx in (-1.5, 0, 1.5):
        cv.pixel(*rnd(add(c, (dx * k, -1.2 * k))), GOLD[0])


def scales(seed):
    x, y = grid()
    return np.where(((x + (y // 2) % 2 * 1.5 + seed) % 3 < 1) & (y % 2 == 0), -1.0, 0.0)


def figure(cv, P: EPose, eyes="open", mouth=0):
    j = skeleton(P)
    ex = P.extra
    arm_f = arm_mask(cv, j, "f", (2.8, 2.4, 2.0))
    tail, fin = fish_tail(cv, j, P.tail, ex.get("flick", 0))
    torso = torso_mask(cv, j) & m(cv, ellipse(cv.blank(), j["R"](1, -3 * j["k"]), 5.6 * j["k"], 11 * j["k"]))
    hair, face = head(cv, j, ex.get("flow", 0.0))
    arm_n = arm_mask(cv, j, "n", (3.0, 2.6, 2.2))
    ref = torso | tail | hair | face
    paint(cv, hair & ~torso, HAIR[:3], body_field(hair, base=0.2, dstep=0.5, ref=ref), INK)  # 뒤 머리칼(몸 뒤)
    paint(cv, fin, FIN, body_field(fin, base=0.5, dstep=0.5, ref=ref), INK, rim=FIN[2])
    paint(cv, arm_f, SKIN[:2], body_field(arm_f, base=0.0, ref=ref), INK)
    paint(cv, tail, TAIL, body_field(tail, base=0.6, dstep=0.5, ref=ref, extra=scales(P.seed)), INK, rim=TAIL[3])
    paint(cv, torso, SKIN, body_field(torso, base=0.6, ref=ref), INK)
    # 비늘 배판(가슴~허리 앞쪽)
    R, k = j["R"], j["k"]
    plate = m(cv, poly(cv.blank(), [R(1 * k, -7 * k), R(6 * k, -6 * k), R(5 * k, 3 * k), R(2 * k, 7 * k), R(-1 * k, 3 * k)])) & torso
    paint(cv, plate, GOLD, body_field(plate, base=0.4, dstep=0.5, ref=ref, extra=scales(P.seed + 1) * 0.7), INK)
    paint(cv, hair & ~m(cv, ellipse(cv.blank(), j["head"], 5.5 * k, 6 * k)) & torso, HAIR, body_field(hair, base=0.8, ref=ref), INK)
    paint(cv, hair & m(cv, ellipse(cv.blank(), j["head"], 5.5 * k, 6 * k)), HAIR, body_field(hair, base=0.8, dstep=0.6, ref=ref), INK, rim=HAIR[3])
    paint(cv, face, SKIN, body_field(face, base=0.8, dstep=0.5, ref=ref), INK)
    crown(cv, j)
    paint(cv, arm_n, SKIN, body_field(arm_n, base=0.9, ref=ref), INK)
    h = j["head"]
    for ex_, w in ((3.0, 2), (0.2, 1)):
        e = rnd(add(h, (ex_ * k, 0.4 * k)))
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
    idle_a=(EPose(c=(33, 29), arm_n=(70, -10), arm_f=(110, 80), tail=0, seed=0, extra=dict(flick=0, flow=0)), "open", 0),
    idle_b=(EPose(c=(33, 27), arm_n=(58, -22), arm_f=(104, 70), tail=2, seed=1, lean=-3, extra=dict(flick=-3, flow=-6)), "open", 0),
    idle_c=(EPose(c=(33, 28), arm_n=(80, 0), arm_f=(118, 88), tail=-2, seed=2, lean=3, extra=dict(flick=3, flow=6)), "open", 1),
    windup=(EPose(c=(30, 31), lean=-12, arm_n=(-95, -120), arm_f=(-115, -135), tail=4, seed=3, extra=dict(flick=-4, flow=-10)), "angry", 1),
    move=(EPose(c=(37, 30), lean=20, arm_n=(150, 175), arm_f=(160, 185), tail=6, seed=4, extra=dict(flick=5, flow=14)), "angry", 0),
    attack=(EPose(c=(37, 29), lean=14, arm_n=(-2, -10), arm_f=(150, 170), tail=3, seed=5, extra=dict(flick=2, flow=8)), "angry", 1),
    recover=(EPose(c=(28, 30), lean=-4, k=1.04, arm_n=(-60, -85), arm_f=(-120, -95), tail=2, seed=6, extra=dict(flick=-5, flow=-12)), "angry", 2),
    hit=(EPose(c=(28, 32), lean=-22, k=0.96, arm_n=(110, 150), arm_f=(80, 120), tail=-4, seed=7, extra=dict(flick=6, flow=18)), "shut", 1),
)


def drop(cv, p, r=1.5):
    cv.put(m(cv, ellipse(cv.blank(), p, r, r * 1.2)), FX[1])
    cv.pixel(*rnd(add(p, (-0.5, -0.5))), FX[3])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 물웅덩이에 쓰러진 인어: 누운 꼬리·지느러미, 흘러내린 머리칼, 떨어진 조개 관
        pool = m(cv, ellipse(cv.blank(), (32, 58), 15, 1.6))
        cv.put(pool, FX[0])
        tail = m(cv, chain([(36, 56), (26, 57), (17, 56), (12, 53)], [5.0, 4.2, 3.0, 2.0]))
        fin = m(cv, tongue(cv, (12, 53), 200, 6, 4.0, curl=-1)) | m(cv, tongue(cv, (12, 53), 250, 5, 3.4, curl=1))
        hair = m(cv, chain([(42, 54), (48, 56), (52, 57)], [5.0, 3.6, 1.6]))
        face = m(cv, ellipse(cv.blank(), (40, 54), 3.0, 2.6))
        paint(cv, fin, FIN, body_field(fin, base=0.4), INK)
        paint(cv, tail, TAIL, body_field(tail, base=0.5, extra=scales(2)), INK, rim=TAIL[2])
        paint(cv, hair, HAIR[:3], body_field(hair, base=0.4), INK)
        paint(cv, face, SKIN, body_field(face, base=0.5), INK)
        cv.line([(40, 54), (41, 54)], INK)
        shell = m(cv, poly(cv.blank(), [(46, 52), (48, 49), (50, 52)]))
        cv.put(shell, GOLD[1])
        return cv.image()
    P, eyes, mouth = POSES[name]
    j = figure(cv, P, eyes, mouth)
    if name == "windup":
        mid = ((j["hand_n"][0] + j["hand_f"][0]) / 2, min(j["hand_n"][1], j["hand_f"][1]) - 3)
        cv.put(m(cv, ellipse(cv.blank(), mid, 3.0, 3.0)), FX[1])
        cv.put(m(cv, ellipse(cv.blank(), add(mid, (0.5, -0.5)), 1.4, 1.4)), FX[3])
        for a in (30, 150, 270):
            drop(cv, polar(mid, a, 5.5), 1.0)
    elif name == "move":
        for y, x0 in ((24, 3), (33, 2), (43, 4)):
            cv.line([(x0, y), (x0 + 7, y)], FX[1])
        drop(cv, (9, 50))
    elif name == "attack":
        hd = j["hand_n"]
        fb = (min(hd[0] + 6, 56), hd[1])
        cv.put(m(cv, ellipse(cv.blank(), fb, 4.0, 3.2)), FX[1])
        cv.put(m(cv, ellipse(cv.blank(), fb, 2.4, 2.0)), FX[2])
        cv.pixel(*rnd(add(fb, (-1, -1))), FX[3])
        burst(cv, fb, 6.0, FX[2], FX[3], spikes=6)
    elif name == "recover":
        # 해일: 아군 쪽 바닥에서 말려 오르는 큰 파도(물마루 거품)
        wave = [(38, 58), (42, 49), (46, 40), (51, 31), (56, 27), (61, 29), (62, 34), (58, 33), (55, 37), (57, 46), (61, 52), (62, 58)]
        M = m(cv, poly(cv.blank(), wave))
        x, y = grid()
        stripe = np.where(np.sin((x - y * 0.7) / 1.3) > 0.7, 1.0, 0.0)
        paint(cv, M, FX[:3], body_field(M, base=0.3, dstep=0.5, extra=stripe), INK)
        cv.put(top_edge(M), FX[3])
        for p in ((50, 26), (54, 23), (59, 25), (46, 34)):
            cv.pixel(*p, FX[3])
        sparkle(cv, (44, 22), FX[3], FX[2], big=True)
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((8, -3), (10, 1), (9, 5)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), (255, 255, 255))
        for p in ((48, 30), (51, 38)):
            drop(cv, p, 1.2)
    return cv.image()


if __name__ == "__main__":
    run("undine-sea", draw, sys.argv[1:], idle_ms=190)
