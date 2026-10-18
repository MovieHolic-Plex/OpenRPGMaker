#!/usr/bin/env python3
"""불의 정령(spirit-fire) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

타오르는 화염 거인 상반신: 뒤로 크게 나부끼는 불꽃 관(뾰족한 불길 다섯)을 인 머리에 하얗게 타는 눈,
넓은 어깨와 가슴 한가운데 검은 용암 껍질 사이로 끓는 마그마 핵, 어깨에서 떨어져 떠 있는 불씨 팔
(위팔·아래팔 덩이 사이가 비고 손은 불꽃 발톱), 몸 아래는 위로 솟는 결의 불꼬리. 오른쪽(아군)을 본다.
몸통 뼈대·명암은 elemental_rig.
6번 칸(스킬 skill_mon_flame_burst): 두 팔을 쳐들어 핵이 하얗게 터지고, 아군 쪽 바닥에서 불기둥이 솟는다.

  python3 scripts/content/monsters/redraw_spirit_fire.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import EPose, body_field, chain, ellipse, grid, head_mask, m, paint, skeleton, tail_mask, tongue, torso_mask
from pixel_lib import Canvas, add, burst, flame, polar, rnd, run, sparkle

INK = (54, 12, 8)
FIRE = [(150, 26, 18), (204, 54, 22), (240, 112, 30), (255, 178, 56), (255, 232, 140)]
FAR = [(110, 20, 16), (160, 36, 20), (204, 70, 26)]
CRUST = [(40, 16, 14), (70, 30, 22), (100, 44, 30)]
MAGMA = [(255, 140, 30), (255, 214, 90), (255, 252, 220)]
EYE = (255, 255, 236)
FX = [(204, 54, 22), (250, 134, 34), (255, 214, 86), (255, 252, 220)]


def licks(seed):
    """위로 솟는 불길 결(세로로 일렁이는 밝은 줄)."""
    x, y = grid()
    v = np.sin(x * 0.9 + np.sin(y * 0.35 + seed * 1.3) * 2.0) + np.sin(y * 0.5 + seed)
    return np.where(v > 1.1, 1.0, 0.0)


def crown(cv, j, seed, blaze=1.0):
    """머리 위로 솟아 뒤로 휘는 불꽃 관: 가운데가 가장 높은 뾰족 불길 넷 + 뒤로 나부끼는 긴 갈기 하나."""
    h, k = j["head"], j["k"]
    M = np.zeros((64, 64), bool)
    for i, (dx, ang, ln, w) in enumerate(((3, -78, 6, 3.4), (0, -92, 11, 4.4), (-3, -108, 9, 4.0), (-5, -128, 8, 3.6), (-6, -168, 10, 4.2))):
        wob = math.sin(seed * 1.9 + i * 1.7) * 5
        M |= m(cv, tongue(cv, add(h, (dx * k, -3 * k)), ang + wob, ln * k * blaze, w * k, curl=-1.6 - i * 0.2))
    return M


def ember_arm(cv, j, side, wide):
    """떠 있는 불씨 팔: 어깨 불길 -> (틈) -> 아래팔 덩이 -> (틈) -> 불꽃 발톱 셋."""
    k = j["k"]
    s, e, hd = j["sh_" + side], j["el_" + side], j["hand_" + side]
    upper = m(cv, chain([s, polar(s, math.degrees(math.atan2(e[1] - s[1], e[0] - s[0])), 5.5 * k)], [wide * k, (wide - 0.8) * k]))
    a = math.degrees(math.atan2(hd[1] - e[1], hd[0] - e[0]))
    fore = m(cv, chain([polar(e, a + 180, 1.0 * k), polar(e, a, 3.6 * k)], [(wide - 0.6) * k, (wide - 1.4) * k]))
    hand = m(cv, ellipse(cv.blank(), polar(hd, a, 0.6 * k), 2.2 * k, 2.2 * k))
    for da in (-34, 0, 34):
        hand |= m(cv, tongue(cv, polar(hd, a, 1.2 * k), a + da, 4.6 * k, 2.0 * k, curl=1.2))
    return upper, fore, hand


def magma_core(cv, j, open_=1.0):
    """가슴의 마그마 핵: 검은 용암 껍질 판 사이 갈라진 틈으로 끓는 빛."""
    R, k = j["R"], j["k"]
    crust = m(cv, ellipse(cv.blank(), R(1.2 * k, -3 * k), 3.9 * k, 4.4 * k))
    paint(cv, crust, CRUST, body_field(crust, base=0.0, dstep=0.6), INK)
    c = R(1.4 * k, -3 * k)
    core = m(cv, ellipse(cv.blank(), c, 2.4 * k * open_, 2.8 * k * open_))
    cv.put(core, MAGMA[0])
    cv.put(m(cv, ellipse(cv.blank(), c, 1.4 * k * open_, 1.7 * k * open_)), MAGMA[1])
    cv.pixel(*rnd(add(c, (0.4, -0.4))), MAGMA[2])
    for a in (-60, 40, 150, 220):  # 껍질 금
        p = polar(c, a, 2.6 * k * open_)
        cv.line([p, polar(c, a + 8, 4.6 * k)], MAGMA[0])


def face(cv, j, eyes, mouth):
    h, k = j["head"], j["k"]
    cv.put(m(cv, ellipse(cv.blank(), add(h, (3.0 * k, 0.2 * k)), 2.8 * k, 1.4 * k)), FIRE[0])
    for ex, w in ((4.0, 2), (0.6, 1)):
        e = rnd(add(h, (ex * k, 0)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (w - 1, 1))], MAGMA[1])
            continue
        for dx in range(w):
            cv.pixel(e[0] + dx, e[1], EYE)
        cv.pixel(e[0] - 1 + (w + 1 if eyes == "angry" else 0), e[1] - 1, FIRE[0])
        if eyes == "angry":
            cv.line([add(e, (-1, -2)), add(e, (w, -1))], INK)
    mo = rnd(add(h, (4.2 * k, 3.0 * k)))
    if mouth:
        cv.put(m(cv, ellipse(cv.blank(), mo, 1.4, mouth * 0.7)), INK)
        cv.pixel(mo[0], mo[1], MAGMA[1])
    else:
        cv.line([add(mo, (-1, 0)), add(mo, (1, 0))], INK)


def figure(cv, P: EPose, eyes="open", mouth=0):
    j = skeleton(P)
    ex = P.extra
    lk = licks(P.seed)
    up_f, fo_f, hd_f = ember_arm(cv, j, "f", 3.4)
    cr = crown(cv, j, P.seed, ex.get("blaze", 1.0))
    tail = tail_mask(cv, j, (8.4, 7.0, 4.8, 2.6, 1.0))
    # 꼬리 끝에서 떨어져 나가는 불꽃 혀 둘
    t = j["tail"][-1]
    tail |= m(cv, tongue(cv, t, -150 + P.tail * 3, 6 * j["k"], 2.6 * j["k"], curl=2))
    body = tail | torso_mask(cv, j) | head_mask(cv, j)
    up_n, fo_n, hd_n = ember_arm(cv, j, "n", 4.0)
    ref = body | cr
    for M in (up_f, fo_f, hd_f):
        paint(cv, M, FAR, body_field(M, base=0.2, ref=ref, extra=lk * 0.6), INK)
    paint(cv, cr, FIRE, body_field(cr, base=1.2, dstep=0.5, ref=ref, extra=lk), INK, rim=FIRE[4])
    paint(cv, body, FIRE, body_field(body, base=0.6, dstep=0.6, ref=ref, extra=lk * 1.2), INK, rim=FIRE[4])
    magma_core(cv, j, ex.get("core", 1.0))
    face(cv, j, eyes, mouth)
    for M in (up_n, fo_n):
        paint(cv, M, FIRE[1:], body_field(M, base=0.6, ref=ref, extra=lk), INK)
    paint(cv, hd_n, FIRE[2:], body_field(hd_n, base=0.4, ref=ref), INK, rim=FIRE[4])
    return j


POSES = dict(
    idle_a=(EPose(c=(30, 32), arm_n=(55, -10), arm_f=(118, 70), tail=0, seed=0), "open", 0),
    idle_b=(EPose(c=(30, 30), arm_n=(45, -20), arm_f=(110, 60), tail=2, seed=1, lean=-3, extra=dict(blaze=1.12)), "open", 1),
    idle_c=(EPose(c=(31, 31), arm_n=(64, 2), arm_f=(124, 80), tail=-2, seed=2, lean=3, extra=dict(blaze=0.92)), "open", 0),
    windup=(EPose(c=(28, 35), lean=-14, arm_n=(-55, -80), arm_f=(-140, -115), tail=4, seed=3, extra=dict(blaze=1.2, core=1.15)), "angry", 2),
    move=(EPose(c=(35, 33), lean=22, arm_n=(150, 175), arm_f=(160, 185), tail=6, seed=4, extra=dict(blaze=1.25)), "angry", 0),
    attack=(EPose(c=(35, 32), lean=16, arm_n=(4, -6), arm_f=(150, 170), tail=3, seed=5, extra=dict(blaze=1.1)), "angry", 2),
    recover=(EPose(c=(27, 33), lean=-6, k=1.06, arm_n=(-40, -75), arm_f=(-145, -110), tail=2, seed=6, extra=dict(blaze=1.35, core=1.3)), "angry", 3),
    hit=(EPose(c=(25, 34), lean=-24, k=0.95, arm_n=(110, 150), arm_f=(80, 120), tail=-4, seed=7, extra=dict(blaze=0.75, core=0.7)), "shut", 2),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 꺼져 가는 불: 바닥의 식은 용암 덩이 + 마지막 불씨, 피어오르는 연기
        rock = m(cv, ellipse(cv.blank(), (31, 56), 9, 3.4)) | m(cv, ellipse(cv.blank(), (27, 54), 4.5, 3.0))
        paint(cv, rock, CRUST, body_field(rock, base=0.3, dstep=0.6), INK)
        cv.put(m(cv, ellipse(cv.blank(), (31, 55), 2.2, 1.2)), MAGMA[0])
        cv.pixel(31, 55, MAGMA[1])
        flame(cv, (37, 55), 6, 4, [FIRE[1], FIRE[3]], tongues=2, seed=3)
        for p, c in (((26, 47), CRUST[2]), ((29, 43), CRUST[1]), ((27, 39), CRUST[1])):
            cv.put(m(cv, ellipse(cv.blank(), p, 1.6, 1.3)), c)
        return cv.image()
    P, eyes, mouth = POSES[name]
    j = figure(cv, P, eyes, mouth)
    if name == "windup":
        mid = ((j["hand_n"][0] + j["hand_f"][0]) / 2, min(j["hand_n"][1], j["hand_f"][1]) - 3)
        cv.put(m(cv, ellipse(cv.blank(), mid, 3.4, 3.4)), FX[1])
        cv.put(m(cv, ellipse(cv.blank(), mid, 2.0, 2.0)), FX[2])
        cv.pixel(*rnd(mid), FX[3])
    elif name == "move":
        for y, x0 in ((24, 3), (34, 2), (44, 5)):
            cv.line([(x0, y), (x0 + 7, y)], FX[1])
            cv.pixel(x0 + 7, y, FX[2])
    elif name == "attack":
        h = j["hand_n"]
        fb = (min(h[0] + 6, 55), h[1])
        cv.put(m(cv, ellipse(cv.blank(), fb, 4.2, 3.4)), FX[0])
        cv.put(m(cv, ellipse(cv.blank(), fb, 2.8, 2.2)), FX[2])
        cv.pixel(*rnd(fb), FX[3])
        burst(cv, fb, 6.5, FX[2], FX[3], spikes=7)
    elif name == "recover":
        # 불기둥: 아군 쪽 바닥에서 솟는 두 줄기
        flame(cv, (52, 59), 30, 10, FX, tongues=3, seed=6)
        flame(cv, (43, 59), 16, 7, FX[:3], tongues=2, seed=2)
        sparkle(cv, (56, 18), FX[3], FX[2], big=True)
    elif name == "hit":
        hd = j["head"]
        for dx, dy in ((9, -4), (11, 0), (10, 4)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), (255, 255, 255))
        for p in ((47, 28), (50, 36)):
            cv.pixel(*p, FX[2])
    return cv.image()


if __name__ == "__main__":
    run("spirit-fire", draw, sys.argv[1:], idle_ms=120)
