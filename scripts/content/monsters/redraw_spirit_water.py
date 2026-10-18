#!/usr/bin/env python3
"""물의 정령(spirit-water) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

바다 소용돌이 정령 상반신: 머리 뒤에 떠 있는 물의 고리(광륜), 뒤로 말려 부서지는 물마루 머리,
투명한 물빛 몸 속에 흰 물보라 심지와 기포, 팔은 끝이 말려 부서지는 파도 마루(손 대신 물마루 갈퀴),
허리 아래는 나선으로 감겨 내려가는 조류 꼬리(흰 물살 줄무늬). 오른쪽(아군)을 본다.
몸통 뼈대·명암은 elemental_rig.
6번 칸(스킬 skill_mon_tidal_wave): 두 팔을 쳐들어 광륜이 커지고, 아군 쪽 바닥에서 소용돌이 물기둥이 솟는다.

  python3 scripts/content/monsters/redraw_spirit_water.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import (EPose, body_field, chain, ellipse, grid, head_mask, m, paint, skeleton, tail_mask, tongue,
                           top_edge, torso_mask)
from pixel_lib import Canvas, add, bezier, burst, polar, rnd, run, sparkle

INK = (10, 24, 58)
WATER = [(24, 66, 150), (40, 104, 196), (70, 150, 226), (130, 200, 244), (220, 246, 255)]
FAR = [(20, 50, 120), (32, 80, 164), (52, 116, 196)]
FOAM = (240, 252, 255)
EYE = (255, 255, 255)
FX = [(40, 104, 196), (90, 170, 236), (170, 226, 252), (250, 255, 255)]


def swirl(seed):
    """나선 물살 줄무늬(1 = 흰 물살)."""
    x, y = grid()
    v = np.sin((y * 0.8 + x * 0.45 + seed * 1.4) / 1.6) + np.sin(x * 0.3 - seed) * 0.4
    return np.where(v > 1.05, 1.0, 0.0)


def halo(cv, j, r):
    """머리 뒤의 물 고리: 두 겹 링(바깥 짙음, 안 밝음) + 위쪽 반짝임."""
    h, k = j["head"], j["k"]
    c = add(h, (-2.0 * k, -1.0 * k))
    outer = m(cv, ellipse(cv.blank(), c, r * k, (r + 1) * k)) & ~m(cv, ellipse(cv.blank(), c, (r - 1.6) * k, (r - 0.6) * k))
    return outer, c


def crest_head(cv, j, seed):
    """머리 + 뒤로 말려 부서지는 물마루 셋(끝이 아래로 말림)."""
    h, k = j["head"], j["k"]
    M = head_mask(cv, j)
    for i, (dx, dy, ang, ln, w) in enumerate(((0, -4, -112, 9, 5.0), (-3, -3, -150, 11, 5.2), (-4, 0, -186, 9, 4.4))):
        M |= m(cv, tongue(cv, add(h, (dx * k, dy * k)), ang + math.sin(seed + i) * 6, ln * k, w * k, curl=-3.6))
    return M


def wave_arm(cv, j, side, wide):
    """물살 팔: 어깨 -> 팔꿈치 -> 손목, 손 자리에서 위로 말려 부서지는 파도 마루(갈퀴 셋)."""
    k = j["k"]
    s, e, hd = j["sh_" + side], j["el_" + side], j["hand_" + side]
    arm = m(cv, chain([s, e, hd], [wide * k, (wide - 0.6) * k, (wide - 1.0) * k]))
    a = math.degrees(math.atan2(hd[1] - e[1], hd[0] - e[0]))
    crest = m(cv, tongue(cv, polar(hd, a + 180, 1.0), a - 50, 9 * k, 5.4 * k, curl=-3.8))
    for da in (-75, -10):
        crest |= m(cv, tongue(cv, polar(hd, a, 1.5 * k), a + da, 4.0 * k, 2.0 * k, curl=-1.5))
    return arm, crest


def spiral_tail(cv, j):
    """나선 조류 꼬리: 기본 꼬리 + 꼬리 끝에서 안으로 한 번 더 말리는 소용돌이."""
    k = j["k"]
    M = tail_mask(cv, j, (8.6, 7.2, 5.0, 3.0, 1.6))
    t, prev = j["tail"][-1], j["tail"][-2]
    a = math.degrees(math.atan2(t[1] - prev[1], t[0] - prev[0]))
    pts = [t, polar(t, a - 70, 3.5 * k), polar(polar(t, a - 70, 3.5 * k), a - 160, 3.0 * k)]
    M |= m(cv, chain(pts, [1.8 * k, 1.4 * k, 0.8 * k]))
    return M


def face(cv, j, eyes, mouth):
    h, k = j["head"], j["k"]
    for ex, w in ((4.0, 2), (0.6, 1)):
        e = rnd(add(h, (ex * k, 0)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (w - 1, 1))], INK)
            continue
        for dx in range(w):
            cv.pixel(e[0] + dx, e[1], EYE)
            cv.pixel(e[0] + dx, e[1] + 1, INK)
        if eyes == "angry":
            cv.line([add(e, (-1, -2)), add(e, (w, -1))], INK)
    mo = rnd(add(h, (4.2 * k, 3.0 * k)))
    if mouth:
        cv.put(m(cv, ellipse(cv.blank(), mo, 1.2, mouth * 0.6)), INK)
    else:
        cv.line([add(mo, (-1, 0)), add(mo, (0, 0))], WATER[0])


def figure(cv, P: EPose, eyes="open", mouth=0):
    j = skeleton(P)
    ex = P.extra
    sw = swirl(P.seed)
    ring, rc = halo(cv, j, ex.get("halo", 9.0))
    arm_f, crest_f = wave_arm(cv, j, "f", 3.4)
    body = spiral_tail(cv, j) | torso_mask(cv, j) | crest_head(cv, j, P.seed)
    arm_n, crest_n = wave_arm(cv, j, "n", 4.0)
    paint(cv, ring & ~body, [WATER[1], WATER[3], WATER[4]], body_field(ring, base=0.6, dstep=0.7, ref=body), INK)
    paint(cv, arm_f | crest_f, FAR, body_field(arm_f | crest_f, base=0.2, ref=body, extra=sw * 0.6), INK)
    paint(cv, body, WATER, body_field(body, base=0.6, dstep=0.6, ref=body, extra=sw * 1.4), INK, rim=FOAM)
    # 몸 속 물보라 심지와 기포
    core = j["core"]
    cv.put(m(cv, ellipse(cv.blank(), core, 2.2 * j["k"], 2.8 * j["k"])), WATER[3])
    cv.put(m(cv, ellipse(cv.blank(), add(core, (0.5, -0.5)), 1.0, 1.4)), FOAM)
    for d in ((-3, 5), (2, 8), (-1, 11)):
        p = j["R"](d[0] * j["k"], d[1] * j["k"])
        cv.pixel(*rnd(p), WATER[4])
    face(cv, j, eyes, mouth)
    paint(cv, arm_n, WATER[1:], body_field(arm_n, base=0.5, ref=body, extra=sw), INK)
    paint(cv, crest_n & ~arm_n, WATER[2:], body_field(crest_n, base=0.5, ref=body), INK)
    cv.put(top_edge(crest_n) & crest_n, FOAM)
    return j


POSES = dict(
    idle_a=(EPose(c=(31, 33), arm_n=(55, -10), arm_f=(118, 70), tail=0, seed=0), "open", 0),
    idle_b=(EPose(c=(31, 31), arm_n=(45, -22), arm_f=(110, 60), tail=2, seed=1, lean=-3, extra=dict(halo=10.4)), "open", 0),
    idle_c=(EPose(c=(32, 32), arm_n=(64, 2), arm_f=(124, 80), tail=-2, seed=2, lean=3, extra=dict(halo=9.8)), "open", 1),
    windup=(EPose(c=(29, 36), lean=-14, arm_n=(-55, -80), arm_f=(-140, -115), tail=4, seed=3, extra=dict(halo=8.6)), "angry", 2),
    move=(EPose(c=(35, 34), lean=22, arm_n=(150, 175), arm_f=(160, 185), tail=6, seed=4), "angry", 0),
    attack=(EPose(c=(35, 33), lean=16, arm_n=(4, -6), arm_f=(150, 170), tail=3, seed=5), "angry", 2),
    recover=(EPose(c=(27, 34), lean=-6, k=1.05, arm_n=(-40, -75), arm_f=(-145, -110), tail=2, seed=6, extra=dict(halo=9.4)), "angry", 3),
    hit=(EPose(c=(25, 35), lean=-24, k=0.95, arm_n=(110, 150), arm_f=(80, 120), tail=-4, seed=7, extra=dict(halo=8.0)), "shut", 2),
)


def drop(cv, p, r=1.5):
    cv.put(m(cv, ellipse(cv.blank(), p, r, r * 1.2)), FX[1])
    cv.pixel(*rnd(add(p, (-0.5, -0.5))), FX[3])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 흩어진 물웅덩이 + 바닥에 떨어져 깨진 물 고리, 기포
        pool = m(cv, ellipse(cv.blank(), (31, 57), 13, 2.2)) | m(cv, ellipse(cv.blank(), (27, 55), 5, 2.4))
        paint(cv, pool, WATER[:4], body_field(pool, base=0.4, dstep=0.7), INK, rim=FOAM)
        arc = m(cv, ellipse(cv.blank(), (41, 54), 4.0, 2.4)) & ~m(cv, ellipse(cv.blank(), (41, 54), 2.4, 1.2))
        arc[54:, :] = False
        cv.put(arc, WATER[3])
        for x, y in ((24, 50), (30, 47)):
            cv.put(m(cv, ellipse(cv.blank(), (x, y), 1.4, 1.4)), WATER[3])
            cv.pixel(x - 1, y - 1, FOAM)
        return cv.image()
    P, eyes, mouth = POSES[name]
    j = figure(cv, P, eyes, mouth)
    if name == "windup":
        mid = ((j["hand_n"][0] + j["hand_f"][0]) / 2, min(j["hand_n"][1], j["hand_f"][1]) - 3)
        cv.put(m(cv, ellipse(cv.blank(), mid, 3.0, 3.0)), FX[1])
        cv.put(m(cv, ellipse(cv.blank(), add(mid, (0.5, -0.5)), 1.4, 1.4)), FX[3])
    elif name == "move":
        for y, x0 in ((25, 3), (34, 2), (44, 5)):
            cv.line([(x0, y), (x0 + 7, y)], FX[2])
        drop(cv, (9, 51))
    elif name == "attack":
        h = j["hand_n"]
        fb = (min(h[0] + 7, 55), h[1])
        cv.put(m(cv, ellipse(cv.blank(), fb, 4.0, 3.2)), FX[1])
        cv.put(m(cv, ellipse(cv.blank(), fb, 2.4, 2.0)), FX[2])
        cv.pixel(*rnd(add(fb, (-1, -1))), FX[3])
        burst(cv, fb, 6.0, FX[2], FX[3], spikes=6)
    elif name == "recover":
        # 소용돌이 물기둥: 아래가 넓고 위로 꼬이며 솟는 기둥 + 흰 나선 물살 + 꼭대기 물보라
        pts = bezier((50, 59), (58, 44), (50, 20), 12)
        col = m(cv, chain(pts, list(np.linspace(11, 4, len(pts)))))
        x, y = grid()
        stripe = np.where(np.sin((y + x * 1.4) / 1.6) > 0.6, 1.2, 0.0)
        paint(cv, col, FX[:3], body_field(col, base=0.3, dstep=0.5, extra=stripe), INK)
        for p in ((47, 18), (51, 16), (54, 19), (49, 22)):
            cv.pixel(*p, FX[3])
        sparkle(cv, (57, 14), FX[3], FX[2], big=True)
    elif name == "hit":
        hd = j["head"]
        for dx, dy in ((9, -4), (11, 0), (10, 4)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), (255, 255, 255))
        for p in ((47, 30), (50, 38)):
            drop(cv, p, 1.2)
    return cv.image()


if __name__ == "__main__":
    run("spirit-water", draw, sys.argv[1:], idle_ms=180)
