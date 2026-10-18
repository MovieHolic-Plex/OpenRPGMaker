#!/usr/bin/env python3
"""이빨 미믹(mimic-chest) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

나무 결 판자에 철 띠를 두른 큰 보물 상자. 경첩(뒤 = 왼쪽)을 축으로 뚜껑이 비스듬히 열려
위아래 두꺼운 이빨 줄, 안쪽 어두운 입 속 노란 눈 하나, 길게 늘어진 붉은 혀. 상자 밑에서 짧고 굵은
갈고리 발 넷이 나와 바닥(y=60)을 짚는다. 모서리 금 장식과 자물쇠.
6번 칸(스킬 skill_mon_mimic_devour): 뚜껑이 뒤로 젖혀지도록 입을 최대로 벌려 아군 쪽으로 덮친다.

  python3 scripts/content/monsters/redraw_mimic_chest.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (24, 16, 12)
WOOD = [(86, 48, 28), (126, 76, 42), (164, 108, 60), (196, 144, 88)]
WOOD_IN = [(40, 22, 16), (62, 34, 24), (84, 48, 30), (84, 48, 30)]
IRON = [(60, 62, 70), (100, 104, 114), (150, 156, 166), (200, 206, 214)]
GOLD = [(150, 104, 30), (220, 170, 60), (255, 230, 140)]
MOUTH = (46, 10, 18)
TOOTH = [(200, 190, 160), (246, 240, 214)]
TONGUE = [(130, 30, 50), (196, 60, 80), (236, 120, 130), (236, 120, 130)]
EYE = (255, 220, 60)
LEG = [(70, 40, 30), (104, 64, 44), (140, 94, 64), (140, 94, 64)]
WHITE = (255, 255, 240)
GROUND = 60


def rot(o, ang):
    a = math.radians(ang)
    return lambda dx, dy: (o[0] + dx * math.cos(a) - dy * math.sin(a), o[1] + dx * math.sin(a) + dy * math.cos(a))


def foot(cv, hip, f, far=False):
    knee = (lerp(hip, f, 0.5)[0] + 2, lerp(hip, f, 0.5)[1] - 1)
    ramp = [LEG[0], LEG[0], LEG[1], LEG[1]] if far else LEG
    cv.part(chain([hip, knee, add(f, (0, -1))], [2.2, 2.0, 1.8]), ramp, gloss=False)
    f0 = rnd(f)
    cv.line([(f0[0] - 1, f0[1]), (f0[0] + 2, f0[1])], INK)


def chest(cv, P):
    """P: c = 상자 밑 앞 중심, tilt = 상자 기울기, lid = 뚜껑 열린 각, tongue = 혀 길이."""
    c, tilt, lid = P["c"], P.get("tilt", 0), P.get("lid", 30)
    W, H, LH = 26, 12, 8
    R = rot(c, tilt)
    # 다리 넷(먼 쪽 둘 먼저)
    lx = P.get("legs", 0)
    feet_x = ((-9, -12 + lx), (7, 6 + lx))
    for hx, fx in feet_x:
        foot(cv, R(hx - 2, -1), (c[0] + fx - 2, GROUND - P.get("air", 0)), far=True)
    # 몸통 상자(앞면)
    box = [R(-W / 2, 0), R(W / 2, 0), R(W / 2, -H), R(-W / 2, -H)]
    cv.part(poly(cv.blank(), box), WOOD)
    # 판자 결 + 철 띠 + 금 모서리
    for y in (-4, -8):
        cv.line4([rnd(R(-W / 2 + 1, y)), rnd(R(W / 2 - 1, y))], WOOD[0])
    for x in (-W / 2 + 4, W / 2 - 5):
        cv.part(poly(cv.blank(), [R(x, 0), R(x + 2, 0), R(x + 2, -H), R(x, -H)]), IRON, gloss=False)
    for x, y in ((-W / 2, 0), (W / 2, 0)):
        cv.put(ellipse(cv.blank(), R(x, y - 1), 1.4, 1.4), GOLD[1])
    # 입 안(상자 윗면 = 위턱 밑): 뚜껑이 열린 만큼 어두운 입 + 혀
    hinge = R(-W / 2, -H)
    front_top = R(W / 2, -H)
    lid_r = rot(hinge, tilt - lid)
    lid_front = lid_r(W, 0)
    cv.put(poly(cv.blank(), [hinge, front_top, lerp(front_top, lid_front, 0.85), lid_r(W * 0.5, 1)]), MOUTH)
    # 아래 이빨 줄(상자 윗 가장자리를 따라)
    for k in range(5):
        b = lerp(R(-W / 2 + 6, -H), front_top, k / 4)
        cv.part(poly(cv.blank(), [add(b, (-1.2, 0)), add(b, (1.2, 0)), add(b, (0, -3))]), TOOTH + TOOTH, gloss=False)
    # 혀: 입 안에서 앞으로 늘어진다
    tl = P.get("tongue", 6)
    if tl:
        root = lerp(hinge, front_top, 0.55)
        tip = add(front_top, (tl * 0.7, tl * 0.7 + 1))
        mid = add(lerp(root, tip, 0.5), (1, -2))
        cv.part(chain([root, mid, tip], [2.2, 2.0, 1.6]), TONGUE, gloss=False)
        cv.pixel(*rnd(lerp(mid, tip, 0.4)), TONGUE[0])
    # 입 속 노란 눈 하나(경첩 쪽 깊숙이)
    if lid > 12:
        e = lerp(hinge, lid_r(W * 0.4, 3), 0.6)
        if P.get("eye") == "shut":
            cv.line([rnd(add(e, (-1, 0))), rnd(add(e, (1, 0)))], EYE)
        else:
            cv.put(ellipse(cv.blank(), e, 1.6, 1.4), EYE)
            cv.pixel(*rnd(add(e, (0.5, 0))), INK)
    # 뚜껑(둥근 윗면 + 앞 판). 위 이빨은 뚜껑 앞 판 아래쪽에
    lid_pts = [lid_r(0, 0), lid_r(W, 0), lid_r(W, -LH * 0.6), lid_r(W * 0.8, -LH), lid_r(W * 0.2, -LH), lid_r(0, -LH * 0.6)]
    cv.part(poly(cv.blank(), lid_pts), WOOD)
    cv.line4([rnd(lid_r(1, -LH * 0.55)), rnd(lid_r(W - 1, -LH * 0.55))], WOOD[3])
    for x in (4, W - 5):
        cv.part(poly(cv.blank(), [lid_r(x, 0), lid_r(x + 2, 0), lid_r(x + 2, -LH), lid_r(x, -LH)]), IRON, gloss=False)
    for k in range(5):
        b = lid_r(6 + k * (W - 7) / 4, 0)
        cv.part(poly(cv.blank(), [polar(b, tilt - lid + 180, 1.2), polar(b, tilt - lid, 1.2), polar(b, tilt - lid + 90, 3)]),
                TOOTH + TOOTH, gloss=False)
    # 자물쇠(뚜껑 앞 가운데 아래)
    lock = lid_r(W - 1, -2)
    cv.part(poly(cv.blank(), [add(lock, (-1, -2)), add(lock, (2, -2)), add(lock, (2, 2)), add(lock, (-1, 2))]), GOLD, gloss=False)
    cv.pixel(*rnd(add(lock, (0.5, 0))), INK)
    # 가까운 다리 둘
    for hx, fx in ((-6, -8 + lx), (10, 10 + lx)):
        foot(cv, R(hx, -1), (c[0] + fx, GROUND - P.get("air", 0)))
    return dict(mouth=lerp(front_top, lid_front, 0.5), lid=lid_front, front=front_top)


POSE = {
    "idle_a": dict(c=(30, 55), tilt=0, lid=24, tongue=6),
    "idle_b": dict(c=(30, 54), tilt=-2, lid=32, tongue=8),  # 숨 쉬듯 뚜껑이 벌어지며 들썩
    "idle_c": dict(c=(30, 55), tilt=1, lid=16, tongue=4, legs=1),  # 다물며 발을 옮긴다
    "windup": dict(c=(26, 54), tilt=-10, lid=50, tongue=9, legs=-2),  # 뒤로 기울어 입을 크게 벌린다
    "move": dict(c=(32, 49), tilt=8, lid=22, tongue=5, legs=2, air=5),  # 껑충 뛰어 다가간다
    "attack": dict(c=(28, 55), tilt=12, lid=8, tongue=0, legs=2),  # 콱 다물어 문다
    "recover": dict(c=(24, 54), tilt=6, lid=80, tongue=12, legs=3),  # 스킬: 통째로 삼키려 입을 최대로
    "hit": dict(c=(28, 55), tilt=-14, lid=36, tongue=10, legs=-2, eye="shut"),
}


def draw_dead(cv):
    """옆으로 넘어진 상자: 뚜껑이 떨어져 나가고 혀가 축 늘어졌다, 다리는 위로."""
    R = rot((16, 59), -90)
    cv.part(poly(cv.blank(), [(14, 59), (40, 59), (40, 48), (14, 48)]), WOOD)
    cv.line4([(15, 53), (39, 53)], WOOD[0])
    for x in (18, 34):
        cv.part(poly(cv.blank(), [(x, 59), (x + 2, 59), (x + 2, 48), (x, 48)]), IRON, gloss=False)
    cv.put(poly(cv.blank(), [(40, 48), (40, 59), (43, 57), (43, 50)]), MOUTH)
    cv.part(chain([(41, 55), (46, 58), (52, 59)], [1.8, 1.6, 1.4]), TONGUE, gloss=False)
    cv.part(poly(cv.blank(), [(44, 46), (58, 50), (57, 54), (43, 50)]), WOOD)
    cv.pixel(55, 52, GOLD[1])
    for x in (20, 30):
        cv.part(chain([(x, 48), (x + 1, 44), (x + 3, 43)], [1.8, 1.6, 1.4]), LEG, gloss=False)
    for p in ((30, 41), (34, 40), (26, 42)):
        cv.pixel(*p, GOLD[2])
    del R


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSE[name]
    if name == "move":
        speed_lines(cv, 3, 9, (40, 34, 30), WOOD[2])
    J = chest(cv, P)
    if name == "windup":
        sparkle(cv, add(J["lid"], (2, -3)), WHITE, GOLD[1])
    elif name == "move":
        puff(cv, (16, 57), 2.2, [WOOD[1], WOOD[2]])
        for p in ((-6, 0), (-12, 2)):
            cv.pixel(*rnd(add(J["front"], p)), GOLD[2])
    elif name == "attack":
        burst(cv, add(J["front"], (5, -2)), 4.0, TOOTH[1], WHITE, spikes=7)
    elif name == "recover":
        # 아군 쪽으로 덮치는 거대한 턱 궤적 + 침방울
        m = J["front"]
        for k, a in enumerate(range(-70, 21, 18)):
            cv.pixel(*rnd(polar(add(m, (-2, -6)), a, 13 + k % 2)), WHITE if k % 2 else TOOTH[1])
        for p in ((7, 4), (9, 0), (4, 8)):
            cv.pixel(*rnd(add(m, p)), TONGUE[2])
        sparkle(cv, add(J["lid"], (3, 2)), WHITE, TOOTH[1])
    elif name == "hit":
        for dx, dy in ((6, -6), (9, -3), (8, -9)):
            cv.pixel(*rnd(add(J["lid"], (dx, dy))), WHITE)
        for p in ((-14, -4), (-18, 0)):
            cv.pixel(*rnd(add(J["front"], p)), GOLD[2])
    return cv.image()


if __name__ == "__main__":
    run("mimic-chest", draw, sys.argv[1:], idle_ms=200)
