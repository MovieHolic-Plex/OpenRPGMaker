#!/usr/bin/env python3
"""빛의 정령(spirit-light) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

금빛 광륜을 인 상아빛 얼굴(감은 듯 가는 금빛 눈), 등 뒤로 크게 펼친 상아색 깃날개 한 쌍,
깊은 황금색 주름이 진 빛의 옷자락이 아래로 갈수록 가늘게 흩어지며 떠 있다. 내민 손끝이 하얗게 빛난다.
오른쪽(아군)을 본다.
6번 칸(스킬 skill_mon_holy_light 계열 cast): 두 팔을 하늘로 들고 날개를 활짝 펴면, 아군 쪽 하늘에서 빛기둥이 내리꽂힌다.

  python3 scripts/content/monsters/redraw_spirit_light.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import EPose, arm_mask, body_field, ellipse, grid, m, paint, skeleton, tail_mask, tongue, torso_mask
from pixel_lib import Canvas, add, polar, rnd, ring, run, slash, sparkle

INK = (60, 40, 18)
ROBE = [(150, 100, 34), (196, 144, 52), (230, 188, 84), (248, 222, 140), (255, 246, 210)]
SKIN = [(214, 184, 140), (240, 220, 186), (255, 244, 224)]
FEATHER = [(170, 150, 118), (210, 194, 160), (238, 228, 204), (255, 252, 240)]
GOLD = [(214, 156, 40), (255, 214, 90), (255, 250, 214)]
EYE = (255, 196, 60)


def folds(seed):
    """옷자락 세로 주름(꼬리를 따라 비스듬)."""
    x, y = grid()
    return np.where(np.sin((x * 1.1 + y * 0.35 + seed) / 1.3) > 0.55, -1.2, 0.0)


def wing(cv, j, side, spread, ln, lift):
    """어깨 뒤에서 위·뒤로 펼친 깃날개: 긴 깃 다섯."""
    s = add(j["sh_" + side], (-3, -1))
    M = np.zeros((64, 64), bool)
    for i in range(5):
        ang = -112 + lift - i * spread
        M |= m(cv, tongue(cv, s, ang, ln * (1 - i * 0.13), 5.6 - i * 0.6, curl=-2.5 + i * 0.4))
    return M


def head(cv, j):
    k, h = j["k"], j["head"]
    M = m(cv, ellipse(cv.blank(), h, 4.4 * k, 5.0 * k))
    hair = M.copy()
    hair |= m(cv, tongue(cv, add(h, (-2.5 * k, -1 * k)), 150, 10 * k, 6 * k, curl=-2))  # 등 뒤로 흘러내리는 빛 머리칼
    hair |= m(cv, tongue(cv, add(h, (-1 * k, -3 * k)), 185, 7 * k, 4.4 * k, curl=1.5))
    face = m(cv, ellipse(cv.blank(), add(h, (1.8 * k, 1.0 * k)), 3.4 * k, 4.0 * k))
    return hair & ~face, face


def halo(cv, j, tilt=0.0, bright=False):
    h = j["head"]
    c = add(h, (-1 + tilt, -6.2 * j["k"]))
    outer = m(cv, ellipse(cv.blank(), c, 6.2, 1.9))
    inner = m(cv, ellipse(cv.blank(), c, 4.2, 0.7))
    cv.put(outer & ~inner, GOLD[1])
    top = outer & ~inner
    top[int(c[1]) + 1:] = False
    cv.put(top, GOLD[2] if bright else GOLD[1])
    cv.put(outer & ~inner & np.roll(~outer, -1, 0), GOLD[0])


def figure(cv, P: EPose, eyes="calm", mouth=0, glow=False):
    j = skeleton(P)
    spread, ln, lift = P.extra.get("wing", (14, 22, 0))
    wing_f = wing(cv, j, "f", spread, ln, lift - 12)
    wing_n = wing(cv, j, "n", spread * 0.95, ln, lift + 6)
    arm_f = arm_mask(cv, j, "f", (3.4, 2.8, 2.4))
    robe = tail_mask(cv, j, (9.0, 8.4, 6.0, 3.4, 1.4)) | torso_mask(cv, j)
    hair, face = head(cv, j)
    arm_n = arm_mask(cv, j, "n", (3.8, 3.2, 2.6))
    ref = robe | hair | face
    paint(cv, wing_f, FEATHER[:3], body_field(wing_f, base=0.2, dstep=0.45, ref=ref), INK)
    paint(cv, arm_f, ROBE[:3], body_field(arm_f, base=0.0, ref=ref), INK)
    paint(cv, robe, ROBE, body_field(robe, base=0.6, dstep=0.55, ref=ref, extra=folds(P.seed)), INK, rim=ROBE[4])
    paint(cv, wing_n, FEATHER, body_field(wing_n, base=0.9, dstep=0.5, ref=ref), INK, rim=FEATHER[3])
    paint(cv, hair, GOLD, body_field(hair, base=0.5, dstep=0.6, ref=ref), INK, rim=GOLD[2])
    paint(cv, face, SKIN, body_field(face, base=0.7, dstep=0.5, ref=ref), INK)
    paint(cv, arm_n, ROBE, body_field(arm_n, base=1.0, ref=ref), INK)
    # 손: 하얗게 빛나는 손끝
    for side in ("f", "n"):
        hd = rnd(j["hand_" + side])
        cv.put(m(cv, ellipse(cv.blank(), hd, 1.6, 1.6)), SKIN[1] if side == "f" else SKIN[2])
        if glow and side == "n":
            sparkle(cv, add(hd, (1, -1)), GOLD[2], GOLD[1], big=True)
    # 가슴 보석
    core = rnd(j["core"])
    cv.put(m(cv, poly_diamond(cv, core, 1.6)), GOLD[1])
    cv.pixel(core[0], core[1], GOLD[2])
    # 얼굴: 가는 금빛 눈 + 입
    h, k = j["head"], j["k"]
    for ex, w in ((3.0, 2), (0.2, 1)):
        e = rnd(add(h, (ex * k, 0.4 * k)))
        if eyes == "shut":
            cv.line([add(e, (-1, -1)), add(e, (w - 1, 0))], ROBE[0])
        else:
            for dx in range(w):
                cv.pixel(e[0] + dx, e[1], EYE if eyes == "calm" else (255, 255, 255))
            cv.pixel(e[0] - 1, e[1] - (1 if eyes == "angry" else 0), ROBE[0])
    mo = rnd(add(h, (3.0 * k, 3.4 * k)))
    if mouth:
        cv.put(m(cv, ellipse(cv.blank(), mo, 0.9, mouth * 0.6)), ROBE[0])
    else:
        cv.pixel(mo[0], mo[1], SKIN[0])
    halo(cv, j, tilt=P.lean * 0.12, bright=glow)
    return j


def poly_diamond(cv, c, r):
    from pixel_lib import poly
    return poly(cv.blank(), [add(c, (0, -r)), add(c, (r, 0)), add(c, (0, r)), add(c, (-r, 0))])


POSES = dict(
    idle_a=(EPose(c=(31, 33), arm_n=(70, -10), arm_f=(110, 80), tail=0, seed=0, extra=dict(wing=(14, 22, 0))), "calm", 0, False),
    idle_b=(EPose(c=(31, 31), arm_n=(60, -20), arm_f=(105, 72), tail=2, seed=1, lean=-2, extra=dict(wing=(15, 23, -8))), "calm", 0, False),
    idle_c=(EPose(c=(31, 32), arm_n=(78, 0), arm_f=(115, 88), tail=-2, seed=2, lean=2, extra=dict(wing=(13, 22, 6))), "calm", 0, True),
    windup=(EPose(c=(28, 35), lean=-10, arm_n=(-80, -100), arm_f=(-105, -120), tail=4, seed=3, extra=dict(wing=(16, 24, -14))), "angry", 1, True),
    move=(EPose(c=(35, 33), lean=18, arm_n=(150, 175), arm_f=(160, 190), tail=7, seed=4, extra=dict(wing=(10, 22, 22))), "angry", 0, False),
    attack=(EPose(c=(35, 33), lean=14, arm_n=(0, -8), arm_f=(150, 170), tail=3, seed=5, extra=dict(wing=(12, 22, 12))), "angry", 1, True),
    recover=(EPose(c=(27, 34), lean=-4, k=1.04, arm_n=(-60, -85), arm_f=(-120, -95), tail=2, seed=6, extra=dict(wing=(19, 26, -22))), "angry", 2, True),
    hit=(EPose(c=(26, 35), lean=-22, k=0.96, arm_n=(110, 150), arm_f=(80, 120), tail=-4, seed=7, extra=dict(wing=(9, 18, 26))), "shut", 1, False),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 땅에 내려앉아 접힌 날개·옷자락, 기울어 떨어진 광륜(빛을 잃은 금)
        from pixel_lib import poly
        robe = m(cv, poly(cv.blank(), [(18, 58), (24, 52), (34, 51), (44, 55), (46, 58)]))
        wingm = m(cv, tongue(cv, (30, 54), 200, 14, 5.0, curl=1.5)) | m(cv, tongue(cv, (30, 54), 215, 11, 4.0, curl=1.0))
        paint(cv, wingm, FEATHER[:3], body_field(wingm, base=0.3), INK, rim=FEATHER[2])
        paint(cv, robe, ROBE[:4], body_field(robe, base=0.4, extra=folds(3)), INK)
        face = m(cv, ellipse(cv.blank(), (40, 53), 3.0, 2.6))
        paint(cv, face, SKIN, body_field(face, base=0.5), INK)
        cv.line([(40, 53), (41, 53)], ROBE[0])
        ring(cv, (48, 55), 3.5, 180, 360, ROBE[1])
        cv.line([(44, 56), (52, 55)], ROBE[1])
        return cv.image()
    P, eyes, mouth, glow = POSES[name]
    j = figure(cv, P, eyes, mouth, glow)
    if name == "windup":
        mid = ((j["hand_n"][0] + j["hand_f"][0]) / 2, min(j["hand_n"][1], j["hand_f"][1]) - 2)
        cv.put(m(cv, ellipse(cv.blank(), mid, 3.0, 3.0)), GOLD[1])
        cv.put(m(cv, ellipse(cv.blank(), mid, 1.5, 1.5)), GOLD[2])
        for a in range(0, 360, 45):
            cv.pixel(*rnd(polar(mid, a, 5)), GOLD[1])
    elif name == "move":
        for y, x0 in ((24, 3), (33, 2), (43, 4)):
            cv.line([(x0, y), (x0 + 7, y)], GOLD[0])
        for p in ((10, 28), (6, 38)):
            cv.pixel(*p, GOLD[2])
    elif name == "attack":
        # 내민 손바닥에서 아군 쪽으로 뻗는 빛살
        hd = j["hand_n"]
        a, b = add(hd, (2, 0)), (60, hd[1] + 1)
        cv.line([a, b], GOLD[1], 3)
        cv.line([a, b], GOLD[2])
        sparkle(cv, b, GOLD[2], GOLD[1], big=True)
    elif name == "recover":
        # 아군 쪽 하늘에서 내리꽂히는 빛기둥 + 바닥 빛무리
        for x, w in ((52, 7), (52, 4)):
            cv.put(m(cv, from_rect(cv, x - w / 2, 2, x + w / 2, 58)), GOLD[1] if w > 4 else GOLD[2])
        cv.put(m(cv, ellipse(cv.blank(), (52, 58), 8, 1.4)), GOLD[1])
        for p in ((44, 18), (60, 26), (45, 40), (60, 48)):
            sparkle(cv, p, GOLD[2], GOLD[1])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((8, -3), (10, 1), (9, 5)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), (255, 255, 255))
        for a, b in (((46, 28), (52, 25)), ((47, 38), (54, 38))):
            cv.line([a, b], GOLD[1])
    return cv.image()


def from_rect(cv, x0, y0, x1, y1):
    from PIL import ImageDraw
    im = cv.blank()
    ImageDraw.Draw(im).rectangle([round(x0), round(y0), round(x1) - 1, round(y1)], fill=255)
    return im


if __name__ == "__main__":
    run("spirit-light", draw, sys.argv[1:], idle_ms=190)
