#!/usr/bin/env python3
"""청록 잎날개 요정(sylph-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

숲바람 요정: 작은 사람 모양, 뒤로 길게 흩날리는 초록 머리칼(잎 머리장식), 하얀 얼굴에 청록 눈,
등에 잎맥이 비치는 넓은 잎사귀 모양 청록 날개 둘(큰 날개), 잎을 겹쳐 입은 잎 갑옷 원피스,
허리 아래는 잎 치마가 뾰족하게 좁아지고 그 밑으로 가는 다리가 늘어진 채 땅에서 떠 있다. 오른쪽(아군)을 본다.
흰 깃날개·바람 리본 꼬리의 실프(sylph-air)와 달리 날개가 잎이고 머리칼·옷이 초록이며 다리가 있다.
5번 칸(공격): 몸을 틀어 앞으로 날아 차기(발끝에 바람 칼날).
6번 칸(스킬 잎새 돌풍): 날개를 활짝 펴 한 바퀴 휘돌며, 청록 초승달 바람 칼날 셋과 잎을 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_sylph_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle

INK = (14, 34, 36)
SKIN = [(214, 176, 160), (244, 218, 200), (255, 240, 226), (255, 250, 240)]
HAIR = [(66, 124, 30), (110, 172, 44), (162, 210, 76), (218, 242, 140)]
WING = [(26, 110, 112), (52, 162, 158), (110, 210, 198), (190, 246, 232)]
WING_FAR = [(20, 80, 86), (30, 108, 112), (44, 134, 136), (44, 134, 136)]
DRESS = [(30, 100, 74), (54, 146, 100), (100, 196, 132), (160, 232, 170)]
VEIN = (16, 70, 74)
EYE = (40, 200, 190)
MOUTH = (150, 60, 70)
FX = [(80, 200, 190), (170, 240, 228), (255, 255, 255)]
LEAF_FX = [(54, 146, 100), (100, 196, 132), (100, 196, 132), (160, 232, 170)]


def leaf_shape(base, ang, ln, wd, skew=0.0):
    """끝이 뾰족한 잎 윤곽(base → ang 방향)."""
    tip = polar(base, ang, ln)
    nx, ny = math.cos(math.radians(ang + 90)), math.sin(math.radians(ang + 90))
    left, right = [], []
    for i in range(1, 10):
        t = i / 10
        c = lerp(base, tip, t)
        w = wd / 2 * math.sin(math.pi * t ** 0.8)
        left.append((c[0] + nx * w * (1 + skew), c[1] + ny * w * (1 + skew)))
        right.append((c[0] - nx * w * (1 - skew), c[1] - ny * w * (1 - skew)))
    return [base] + left + [tip] + right[::-1], tip


def wing(cv, root, ang, ln, wd, far=False):
    pts, tip = leaf_shape(root, ang, ln, wd, skew=0.15)
    ramp = WING_FAR if far else WING
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=not far)
    vc = WING_FAR[0] if far else VEIN
    cv.line([lerp(root, tip, 0.08), lerp(root, tip, 0.88)], vc)
    for t, s in ((0.3, 1), (0.5, -1), (0.65, 1), (0.42, -1) if ln > 15 else (0.8, -1)):
        p = lerp(root, tip, t)
        cv.line([p, polar(p, ang + s * 38, wd * 0.32)], vc)
    return tip


def fairy(cv, c=(32, 36), lean=0.0, wing_a=0.0, hair=0.0, arm_n=30.0, arm_f=130.0, legs=(0.0, 0.0), kick=None,
          eye="open", mouth=0, spread=0.0):
    """c = 허리. lean>0 은 앞으로 기울임."""
    L = math.radians(lean)
    up = (math.sin(L), -math.cos(L))
    neck = (c[0] + up[0] * 8, c[1] + up[1] * 8)
    hc = add(neck, (1.5 + up[0] * 4, -4.5))
    sh = add(neck, (-1 - up[0], 1.5))
    # 날개: 먼 날개 → 머리칼 뒷덩이 → (몸) → 가까운 날개 순으로 겹친다
    root = add(sh, (-2, 1))
    wing(cv, add(root, (1, -1)), -98 + wing_a * 0.6 - spread * 0.5, 21 + spread * 0.15, 11, far=True)
    wing(cv, root, -130 + wing_a + spread * 0.6, 25 + spread * 0.1, 14)
    # 먼 팔
    hand_f = polar(add(sh, (1, 0)), arm_f, 7)
    cv.part(chain([add(sh, (1, 0)), hand_f], [2.0, 1.6]), [SKIN[0]] * 2 + [SKIN[1]] * 2, ink=INK, gloss=False)
    # 다리(잎 치마 밑으로 늘어짐)
    hip = add(c, (0, 3))
    feet = []
    for k, (dx, sw) in enumerate(((-1.5, legs[0]), (1.5, legs[1]))):
        h0 = add(hip, (dx, 0))
        if kick is not None and k == 1:
            knee = polar(h0, kick + 25, 6)
            foot = polar(knee, kick, 7)
        else:
            knee = add(h0, (-1 + sw * 0.4, 6))
            foot = add(knee, (-2 + sw, 6))
        ramp = SKIN if k == 1 else [SKIN[0]] * 2 + [SKIN[1]] * 2
        cv.part(chain([h0, knee, foot], [2.4, 2.0, 1.6]), ramp, ink=INK, gloss=False)
        cv.part(chain([foot, polar(foot, 20 if kick is None or k == 0 else kick, 2.5)], [2.0, 1.2]), [DRESS[0]] * 4, ink=INK, gloss=False)
        feet.append(foot)
    # 잎 치마: 아래로 뾰족하게 좁아지는 잎 세 겹
    for ang, ln, wd in ((116 - lean, 11, 7), (66 - lean, 10, 7), (92 - lean, 13, 8)):
        pts, _ = leaf_shape(add(c, (0, -1)), ang, ln, wd)
        cv.part(poly(cv.blank(), pts), DRESS, ink=INK)
        cv.line([add(c, (0, 0)), polar(c, ang, ln * 0.7)], DRESS[0])
    # 몸통(잎 갑옷)
    torso = [add(c, (-3.5, 0)), add(neck, (-3, 0)), add(neck, (3, 0)), add(c, (3.5, 0))]
    cv.part(poly(cv.blank(), torso), DRESS, ink=INK)
    for dy in (2.5, 5.5):
        p = lerp(neck, c, dy / 8)
        pts, _ = leaf_shape(add(p, (-2, -1)), 70 - lean, 5, 4)
        cv.part(poly(cv.blank(), pts), DRESS, ink=INK, gloss=False)
    # 머리칼(뒤로 흩날림)
    hs = hair
    mane = [add(hc, (0, -5)), add(hc, (-6, -4)), add(hc, (-12 - hs, -1)), add(hc, (-16 - hs * 1.4, 3 + hs * 0.3)),
            add(hc, (-11 - hs, 4)), add(hc, (-15 - hs * 1.2, 9 + hs * 0.2)), add(hc, (-9 - hs * 0.8, 9)),
            add(hc, (-11 - hs * 0.8, 15)), add(hc, (-5 - hs * 0.4, 12)), add(hc, (-4, 15)), add(hc, (-1, 7)), add(hc, (2, 3))]
    cv.part(poly(cv.blank(), mane), HAIR, ink=INK)
    for a, b in (((-5, -2), (-13 - hs, 2)), ((-5, 2), (-12 - hs, 7)), ((-4, 5), (-8 - hs * 0.6, 12))):
        cv.line([add(hc, a), add(hc, b)], HAIR[0])
    cv.part(ellipse(cv.blank(), add(hc, (-1, -0.5)), 5.2, 5.0), HAIR, ink=INK)
    # 얼굴
    face = add(hc, (1.5, 1))
    cv.part(ellipse(cv.blank(), face, 3.6, 4.0), SKIN, ink=INK)
    # 앞머리 + 잎 머리장식
    cv.part(poly(cv.blank(), [add(hc, (-2, -5)), add(hc, (5, -4)), add(hc, (5, -1)), add(hc, (2, -2)), add(hc, (0, 0))]), HAIR, ink=INK, gloss=False)
    pts, _ = leaf_shape(add(hc, (0, -4)), -60, 6, 4)
    cv.part(poly(cv.blank(), pts), DRESS, ink=INK, gloss=False)
    e = rnd(add(face, (1.5, 0)))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
    else:
        cv.pixel(e[0], e[1], EYE)
        cv.pixel(e[0], e[1] + 1, EYE)
        cv.pixel(e[0] - 1, e[1] - 1 if eye == "angry" else e[1], INK)
        cv.pixel(e[0] - 3, e[1], EYE)
    mo = rnd(add(face, (2, 3)))
    if mouth:
        cv.put(ellipse(cv.blank(), mo, 0.8, 0.5 + mouth * 0.4), MOUTH)
    else:
        cv.pixel(mo[0], mo[1], SKIN[0])
    # 가까운 팔
    shn = add(sh, (1.5, 1))
    elbow = polar(shn, arm_n + 15, 4)
    hand_n = polar(elbow, arm_n, 4)
    cv.part(chain([shn, elbow, hand_n], [2.4, 2.0, 1.8]), SKIN, ink=INK, gloss=False)
    return dict(head=hc, hand=hand_n, feet=feet, face=face)


def leaf_bit(cv, p, ang):
    pts, _ = leaf_shape(p, ang, 6, 4)
    cv.part(poly(cv.blank(), pts), LEAF_FX, ink=INK, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 땅에 쓰러진 요정: 날개가 시들어 덮임
        pts, _ = leaf_shape((30, 55), 196, 20, 9)
        cv.part(poly(cv.blank(), pts), WING_FAR, ink=INK)
        cv.part(chain([(22, 58), (14, 58), (9, 57)], [2.0, 1.8, 1.4]), SKIN, ink=INK, gloss=False)
        pts, _ = leaf_shape((32, 57), 178, 11, 6)
        cv.part(poly(cv.blank(), pts), DRESS, ink=INK)
        cv.part(poly(cv.blank(), [(31, 54), (40, 54), (40, 59), (31, 59)]), DRESS, ink=INK)
        cv.part(chain([(45, 55), (52, 53), (58, 54)], [4.0, 3.6, 2.0]), HAIR, ink=INK)
        cv.part(ellipse(cv.blank(), (45, 55), 3.6, 3.4), SKIN, ink=INK)
        cv.line([(44, 55), (46, 55)], INK)
        pts, _ = leaf_shape((26, 52), -120, 13, 7)
        cv.part(poly(cv.blank(), pts), WING, ink=INK, gloss=False)
        return cv.image()
    if name == "idle_a":
        fairy(cv)
    elif name == "idle_b":
        fairy(cv, c=(32, 35), wing_a=-10, hair=-1, arm_n=20, legs=(-1, 1), spread=-4)
    elif name == "idle_c":
        fairy(cv, c=(32, 37), wing_a=10, hair=3, arm_n=45, arm_f=145, legs=(1, -1), mouth=1, spread=6)
    elif name == "windup":  # 날개를 뒤로 크게 젖혀 바람을 모음
        j = fairy(cv, c=(29, 37), lean=-12, wing_a=-14, hair=1, arm_n=-150, arm_f=-130, legs=(-2, 2), eye="angry", spread=10)
        sparkle(cv, add(j["head"], (8, -8)), FX[2], FX[0])
    elif name == "move":  # 앞으로 활공
        for y, x0 in ((24, 2), (32, 3), (42, 2)):
            cv.line([(x0, y), (x0 + 7, y)], FX[0])
        fairy(cv, c=(36, 36), lean=24, wing_a=14, hair=6, arm_n=150, arm_f=160, legs=(-4, -3), eye="angry", spread=-6)
    elif name == "attack":  # 날아 차기
        j = fairy(cv, c=(30, 34), lean=-20, wing_a=8, hair=4, arm_n=-120, arm_f=200, legs=(-3, 0), kick=-10, eye="angry", mouth=1, spread=4)
        f = j["feet"][1]
        slash(cv, add(f, (4, -9)), add(f, (6, 8)), 4, 2.4, FX[1], FX[2])
        slash(cv, add(f, (9, -6)), add(f, (10, 5)), 3, 1.4, FX[0], FX[1])
    elif name == "recover":  # 스킬: 잎새 돌풍 — 초승달 바람 칼날 셋 + 잎
        j = fairy(cv, c=(22, 36), lean=6, wing_a=-18, hair=4, arm_n=-10, arm_f=-30, legs=(-2, 1), eye="angry", mouth=2, spread=20)
        h = j["hand"]
        for i, (dx, dy, ln, bow, th) in enumerate(((7, 0, 9, 3, 2.0), (15, -1, 13, 4, 2.6), (25, -2, 17, 5, 3.2))):
            x = min(h[0] + dx, 59 - bow)
            slash(cv, (x, h[1] + dy - ln / 2), (x + 1, h[1] + dy + ln / 2), bow, th, FX[0], FX[1])
        for p, a in (((44, 18), -30), ((52, 46), 40), ((40, 46), 10)):
            leaf_bit(cv, p, a)
        sparkle(cv, (57, 12), FX[2], FX[0], big=True)
    elif name == "hit":
        j = fairy(cv, c=(29, 38), lean=-22, wing_a=20, hair=8, arm_n=100, arm_f=60, legs=(3, 4), eye="shut", mouth=1, spread=-10)
        h = j["head"]
        for dx, dy in ((9, -6), (11, -2), (10, -9)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), FX[2])
        leaf_bit(cv, (48, 30), 20)
    return cv.image()


if __name__ == "__main__":
    run("sylph-01", draw, sys.argv[1:], idle_ms=180)
