#!/usr/bin/env python3
"""켄타우로스 전사(centaur-plains) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

발굽 짐승 뼈대(ungulate_rig.py, 1.5 축척) 하체 = 회갈색 얼룩 말 몸 + 말 어깨 자리에서 솟는 사람 상체:
그을린 피부, 가죽 어깨 갑옷과 가슴 띠, 뒤로 묶은 검은 머리, 옆얼굴의 수염과 머리 안의 눈.
먼 손에 둥근 나무 방패, 가까운 손에 긴 창. 말 꼬리는 검고 길다.
6번 칸(스킬 돌격 창): 앞발을 들어 올리며 창을 앞으로 겨눠 창끝에서 바람 쐐기가 아군 쪽으로 뻗는다.

  python3 scripts/content/monsters/redraw_centaur_plains.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import ungulate_rig as U
from pixel_lib import Canvas, add, arc_trail, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

S = 96
INK = (28, 18, 12)
COAT = [(100, 78, 58), (138, 112, 86), (172, 146, 116), (200, 178, 150)]
COAT_FAR = [(76, 58, 42), (100, 78, 58), (114, 90, 66), (114, 90, 66)]
SPOT = (226, 214, 190)
MANE = [(24, 18, 16), (44, 34, 28), (66, 52, 42), (88, 72, 60)]
HOOF = [(24, 18, 16), (44, 34, 28), (66, 52, 42), (66, 52, 42)]
SKIN = [(150, 96, 62), (186, 128, 86), (212, 158, 112), (230, 186, 140)]
LEATHER = [(80, 54, 30), (116, 80, 46), (150, 108, 66), (150, 108, 66)]
WOOD = [(80, 54, 30), (116, 80, 46), (150, 108, 66), (150, 108, 66)]
STEEL = [(110, 116, 128), (170, 176, 188), (214, 220, 230), (244, 248, 252)]
EYE = (24, 16, 12)
WIND = [(170, 210, 230), (214, 220, 230), (244, 248, 252)]
DUST = [(138, 112, 86), (172, 146, 116)]
WHITE = (244, 248, 252)

B = U.Build(s=1.5, upper=8.0, lower=9.0, thigh=11.0, cannon=8.5, leg_w=2.8, belly=6.2)
L = U.Look(ramp=COAT, far=COAT_FAR, ink=INK, hoof=HOOF)


def tail(cv, P):
    r = add(P.hip, (-6, -1))
    sw = P.extra.get("tail", 0)
    pts = bezier(r, add(r, (-12, 4 - sw)), add(r, (-10 - sw, 26)), 6)
    cv.part(chain(pts, [4.5, 6, 6.5, 6, 5, 4, 2.4]), MANE, ink=INK, gloss=False)


def spots(cv, P):
    for dx, dy in ((-4, 2), (2, 6), (8, 3), (-8, 7)):
        cv.put(ellipse(cv.blank(), add(lerp(P.hip, P.sh, 0.45), (dx, dy)), 1.6, 1.2), SPOT)


def spear(cv, hand, ang):
    tip = polar(hand, ang, 14)
    butt = polar(hand, ang + 180, 18)
    cv.part(chain([butt, tip], [2.2, 2.2]), WOOD, ink=INK, gloss=False)
    head = [polar(tip, ang, 8), polar(tip, ang + 90, 2.6), polar(tip, ang + 180, 1), polar(tip, ang - 90, 2.6)]
    cv.part(poly(cv.blank(), head), STEEL, ink=INK, gloss=False)
    cv.part(chain([polar(tip, ang + 180, 1), polar(tip, ang + 180, 4)], [2.8, 2.8]), LEATHER, ink=INK, gloss=False)
    return polar(tip, ang, 8)


def upper_body(cv, P):
    """말 어깨 위로 솟는 사람 상체: 먼 팔·방패 → 몸통 → 머리 → 가까운 팔·창."""
    x = P.extra
    waist = add(P.sh, (2, -5))
    lean = x.get("lean", 0)
    chest = polar(waist, -90 + lean, 16)
    shf, shn = add(chest, (-3, 2)), add(chest, (3, 3))
    # 먼 팔 + 방패
    hf = polar(polar(shf, x.get("af", 110), 9), x.get("af", 110) - 30, 8)
    cv.part(chain([shf, hf], [4.4, 3.6]), [SKIN[0], SKIN[0], SKIN[1], SKIN[1]], ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hf, 7.5, 8), WOOD, ink=INK)
    cv.part(ellipse(cv.blank(), hf, 2.4, 2.4), STEEL, ink=INK, gloss=False)
    cv.line4([rnd(add(hf, (-6, 0))), rnd(add(hf, (6, 0)))], WOOD[0])
    # 상체
    body = [add(waist, (-6, 2)), add(waist, (6, 2)), add(chest, (7, 3)), add(chest, (5, -3)), add(chest, (-5, -3)), add(chest, (-7, 3))]
    M = cv.part(poly(cv.blank(), body), SKIN, ink=INK)
    cv.shade_side(M, SKIN[0], side=-1, depth=2)
    cv.line([add(chest, (-5, -1)), add(waist, (5, 0))], LEATHER[1], width=3)
    cv.part(poly(cv.blank(), [add(waist, (-7, 0)), add(waist, (7, 0)), add(waist, (7, 4)), add(waist, (-7, 4))]), LEATHER, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [add(chest, (-7, 1)), add(chest, (-5, -4)), add(chest, (2, -5)), add(chest, (4, -1)), add(chest, (-2, 2))]), LEATHER, ink=INK, gloss=False)
    # 머리
    hc = polar(chest, -90 + lean * 1.2, 8)
    a = math.radians(x.get("tilt", 0))
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(chain([R(-4, -3), R(-9, -2), R(-12, 3)], [4, 3.2, 2.2]), MANE, ink=INK, gloss=False)  # 묶은 머리
    cv.part(poly(cv.blank(), [R(-5, 4), R(-5, -3), R(-1, -6), R(4, -5), R(6, -1), R(7, 2), R(5, 5), R(0, 6)]), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [R(-5, -2), R(-3, -6), R(4, -6), R(2, -4), R(-2, -3)]), MANE, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(1, 3), R(6, 3), R(5, 7), R(1, 6)]), MANE, ink=INK, gloss=False)  # 수염
    if x.get("mouth"):
        cv.line([rnd(R(4, 3)), rnd(R(6, 4))], (110, 30, 30))
    e = rnd(R(3, -1))
    if x.get("eye") == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, 0)), add(e, (1, 0)), add(e, (1, 1)), add(e, (-1, 1))]), SPOT)
        cv.pixel(e[0] + 1, e[1], EYE)
        cv.pixel(e[0] + 1, e[1] + 1, EYE)
    # 가까운 팔 + 창
    el = polar(shn, x.get("an", (80, 0))[0], 9)
    hand = polar(el, x.get("an", (80, 0))[1], 8)
    tip = spear(cv, hand, x.get("spear", -70))
    cv.part(chain([shn, el, hand], [5, 4.2, 3.8]), SKIN, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.6, 2.6), SKIN, ink=INK, gloss=False)
    return dict(eye=e, tip=tip, hand=hand)


def front(cv, P):
    spots(cv, P)
    return upper_body(cv, P)


POSES = {
    "idle_a": U.Pose(hip=(26, 56), sh=(54, 56), feet=((58, 92), (51, 92), (30, 92), (23, 92)),
                     extra=dict(lean=0, af=110, an=(80, 0), spear=-80)),
    "idle_b": U.Pose(hip=(26, 57), sh=(54, 57), feet=((58, 92), (51, 92), (30, 92), (23, 92)),
                     extra=dict(lean=3, af=115, an=(85, 5), spear=-78, tail=3, tilt=4)),
    "idle_c": U.Pose(hip=(26, 56), sh=(54, 56), feet=((60, 90), (51, 92), (30, 92), (23, 92)), lift=(3, 0, 0, 0),
                     extra=dict(lean=-2, af=105, an=(75, -10), spear=-84, tail=-3, tilt=-4)),
    "windup": U.Pose(hip=(24, 60), sh=(48, 48), feet=((62, 66), (56, 70), (30, 92), (21, 92)), lift=(5, 5, 0, 0),
                     extra=dict(lean=-14, af=100, an=(-150, -120), spear=-20, tilt=-10, mouth=1, tail=6)),
    "move": U.Pose(hip=(30, 54), sh=(60, 56), feet=((76, 84), (70, 90), (18, 86), (28, 92)), lift=(5, 0, 3, 0),
                   extra=dict(lean=10, af=150, an=(100, -40), spear=-5, tilt=10, tail=10)),
    "attack": U.Pose(hip=(24, 56), sh=(52, 55), feet=((62, 92), (55, 92), (28, 92), (20, 92)),
                     extra=dict(lean=16, af=140, an=(80, -20), spear=8, tilt=14, mouth=1, tail=5)),
    "recover": U.Pose(hip=(22, 60), sh=(46, 50), feet=((60, 70), (55, 74), (27, 92), (19, 92)), lift=(5, 5, 0, 0),
                      extra=dict(lean=4, af=130, an=(100, -50), spear=-12, tilt=4, mouth=1, tail=8)),
    "hit": U.Pose(hip=(24, 58), sh=(50, 58), feet=((54, 92), (48, 92), (28, 92), (20, 92)),
                  extra=dict(lean=-20, af=150, an=(-60, -30), spear=-120, tilt=-22, eye="shut", tail=-5)),
}


def draw_dead(cv):
    spear(cv, (12, 88), -3)
    for a, b in (((30, 84), (44, 90)), ((52, 84), (66, 90))):
        cv.part(chain([a, b], [4, 3.4]), COAT_FAR, ink=INK, gloss=False)
    cv.part(chain(bezier((16, 80), (8, 84), (6, 90), 4), [5, 5.5, 5, 3.6, 2.4]), MANE, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(14, 91), (18, 78), (34, 72), (58, 72), (66, 80), (64, 91)]), COAT, ink=INK)
    cv.part(poly(cv.blank(), [(60, 91), (62, 80), (78, 78), (82, 84), (80, 91)]), SKIN, ink=INK)
    cv.part(ellipse(cv.blank(), (86, 84), 5.5, 5), SKIN, ink=INK)
    cv.part(chain([(82, 80), (76, 79)], [3, 2.2]), MANE, ink=INK, gloss=False)
    cv.line([(85, 82), (87, 84)], EYE)
    cv.line([(87, 82), (85, 84)], EYE)
    cv.part(ellipse(cv.blank(), (70, 76), 6, 4), WOOD, ink=INK)


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 2, 12, (42, 52, 62), COAT[2])
    J = U.draw_body(cv, B, L, P, tail=tail, front_part=front)
    t = J["tip"]
    if name == "windup":
        sparkle(cv, add(t, (0, -3)), WHITE, STEEL[3], big=True)
    elif name == "move":
        puff(cv, (16, 88), 3.6, DUST)
    elif name == "attack":
        burst(cv, add(t, (2, 0)), 6.0, STEEL[2], WHITE, spikes=7)
    elif name == "recover":
        # 창끝 바람 쐐기: 아군 쪽으로 뻗는 원뿔 + 속도선
        cone = [t, (93, t[1] - 10), (93, t[1] + 10)]
        cv.put(poly(cv.blank(), cone), WIND[0])
        cv.put(poly(cv.blank(), [t, (93, t[1] - 5), (93, t[1] + 5)]), WIND[1])
        cv.line([t, (93, t[1])], WIND[2])
        sparkle(cv, add(t, (0, -1)), WHITE, STEEL[3], big=True)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((5, -10), (9, -7), (8, -13)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("centaur-plains", draw, sys.argv[1:], S=S, idle_ms=220)
