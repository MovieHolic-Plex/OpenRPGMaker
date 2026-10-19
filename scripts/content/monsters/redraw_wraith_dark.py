#!/usr/bin/env python3
"""먹보라 레이스(wraith-dark) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

먹보라 두건 속 어둠에 노란 눈 둘만 빛나는 레이스: 발 없이 떠서 뒤로 길게 찢겨 흩날리는 넓은 망토,
앙상한 회색 손 둘, 그 손에 쥔 긴 나무 자루와 크게 휜 낫날(자루 끝에 쇠고리).
6번 칸(스킬 영혼 수확): 낫을 머리 위에서 앞으로 크게 휘둘러 보랏빛 초승달 칼바람을 날린다.

  python3 scripts/content/monsters/redraw_wraith_dark.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from cloak_rig import hood, robe, sleeve
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, polar, poly, rnd, run, slash, sparkle

INK = (12, 6, 20)
CLOAK = [(34, 20, 52), (56, 34, 82), (82, 54, 114), (110, 80, 146)]
CLOAK_FAR = [(24, 14, 38), (34, 20, 52), (46, 28, 68), (46, 28, 68)]
VOID = (6, 2, 12)
EYE, EYE_HI = (250, 220, 60), (255, 255, 200)
HAND = [(110, 110, 120), (150, 150, 160), (190, 190, 196), (190, 190, 196)]
WOOD = [(60, 40, 26), (90, 62, 40), (120, 86, 56), (120, 86, 56)]
STEEL = [(110, 118, 136), (170, 178, 196), (220, 226, 238), (255, 255, 255)]
SOUL = [(120, 60, 200), (200, 140, 255), (250, 230, 255)]


def scythe(cv, hand, ang, blade_dir=1):
    """자루: hand 를 지나 ang 방향 위로 16, 아래로 6. 위 끝에서 낫날이 앞(blade_dir)으로 휜다."""
    top = polar(hand, ang, 15)
    bot = polar(hand, ang + 180, 7)
    cv.part(chain([bot, hand, top], [2, 2, 2]), WOOD, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), bot, 1.4, 1.4), STEEL, ink=INK, gloss=False)
    # 낫날: 자루 끝에서 직각으로 나가 아래로 휘는 초승달
    a = ang + 90 * blade_dir
    p1 = polar(top, a, 6)
    p2 = polar(p1, a + 35 * blade_dir, 5)
    tip = polar(p2, a + 75 * blade_dir, 4)
    inner1 = polar(top, a, 4)
    inner2 = polar(inner1, a + 45 * blade_dir, 3)
    cv.part(chain([top, p1, p2, tip], [3.6, 3.2, 2.4, 1.0]), STEEL, ink=INK, gloss=False)
    cv.line4([rnd(polar(top, a, 1)), rnd(inner1), rnd(inner2)], STEEL[3])
    return tip, top


def draw_wraith(cv, c=(30, 22), tilt=0.0, drag=4.0, wave=0.0, near=(20, 14), far=(40, 13), scy=-70, blade=1, eye="open", bob=0):
    c = add(c, (0, bob))
    sh = add(c, (-1, 6))
    # 먼 소매 + 손
    s_f = add(sh, (-4, 2))
    el_f, cuff_f = sleeve(s_f, far[0], far[1])
    cv.part(chain([s_f, el_f, cuff_f], [5, 4.4, 5]), CLOAK_FAR, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), polar(cuff_f, far[0], 2), 1.8, 1.8), HAND, ink=INK, gloss=False)
    # 망토 몸
    pts = robe(sh, 56 + bob * 0.5, 13, 24, tatters=5, drag=drag, wave=wave, lean=2)
    M = cv.part(poly(cv.blank(), pts), CLOAK, ink=INK)
    cv.shade_side(M, CLOAK[0], side=-1, depth=3)
    for k in range(3):  # 세로 주름
        x0 = sh[0] - 3 + k * 4
        cv.line4([(x0, sh[1] + 6), (x0 - drag * 0.2 - 1, 50)], CLOAK[0])
    # 두건
    outer, hole, face, R = hood(c, 7.5, tilt, peak=4)
    H = cv.part(poly(cv.blank(), outer), CLOAK, ink=INK)
    cv.shade_side(H, CLOAK[1], side=-1, depth=2)
    cv.put(poly(cv.blank(), hole), VOID)
    for dx in (1.5, 4.5):
        e = rnd(R(dx, -1))
        if eye == "shut":
            cv.pixel(*e, CLOAK[1])
        else:
            cv.pixel(*e, EYE)
            cv.pixel(e[0] + 1, e[1], EYE_HI if dx > 3 else EYE)
    # 가까운 소매 + 손 + 낫
    s_n = add(sh, (3, 2))
    el_n, cuff_n = sleeve(s_n, near[0], near[1])
    hand = polar(cuff_n, near[0], 2.4)
    blade_tip, blade_top = scythe(cv, hand, scy, blade)
    cv.part(chain([s_n, el_n, cuff_n], [5.4, 4.6, 5.4]), CLOAK, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.0, 2.0), HAND, ink=INK, gloss=False)
    for k in (-1, 1):
        cv.pixel(*rnd(add(hand, (1, k))), HAND[2])
    return dict(hand=hand, tip=blade_tip, top=blade_top, eye=R(4.5, -1))


POSES = dict(
    idle_a=dict(),
    idle_b=dict(bob=-2, wave=1.2, drag=5, near=(25, 14), scy=-74),
    idle_c=dict(bob=-1, wave=2.4, drag=6, tilt=6, near=(15, 14), scy=-64),
    windup=dict(c=(27, 23), tilt=-12, drag=3, wave=0.6, near=(-120, 12), far=(-100, 12), scy=-150, blade=1),
    move=dict(c=(36, 22), tilt=14, drag=12, wave=1.8, near=(10, 14), far=(30, 12), scy=-20, bob=1),
    attack=dict(c=(34, 24), tilt=18, drag=9, wave=3.0, near=(40, 15), far=(55, 13), scy=40, blade=1),
    recover=dict(c=(28, 23), tilt=-6, drag=5, wave=2.0, near=(-30, 15), far=(-10, 13), scy=-35, blade=1),
    hit=dict(c=(26, 24), tilt=-26, drag=1, wave=4.0, near=(140, 12), far=(160, 12), scy=-110, eye="shut"),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 빈 망토가 바닥에 흘러내리고 낫이 그 위에 쓰러졌다
        cv.part(poly(cv.blank(), [(10, 59), (14, 52), (22, 49), (34, 50), (44, 54), (50, 59)]), CLOAK, ink=INK)
        cv.part(poly(cv.blank(), [(32, 50), (38, 46), (44, 47), (46, 52), (40, 54)]), CLOAK, ink=INK)
        cv.put(poly(cv.blank(), [(39, 48), (43, 48), (44, 51), (40, 52)]), VOID)
        cv.part(chain([(20, 58), (56, 56)], [2, 2]), WOOD, ink=INK, gloss=False)
        cv.part(chain([(56, 56), (58, 51), (55, 47)], [3, 2.4, 1.0]), STEEL, ink=INK, gloss=False)
        sparkle(cv, (28, 46), SOUL[2], SOUL[0])
        cv.line4([(28, 47), (28, 49)], SOUL[0])
        return cv.image()
    P = dict(POSES[name])
    j = draw_wraith(cv, **P)
    if name == "attack":
        arc_trail(cv, j["hand"], 14, -70, 50, 3.2, SOUL[0], SOUL[2])
        burst(cv, add(j["tip"], (1, 1)), 3.5, SOUL[1], SOUL[2], spikes=5)
    elif name == "recover":
        # 휘두른 낫에서 앞으로 날아가는 보랏빛 초승달 칼바람 두 겹
        arc_trail(cv, j["hand"], 15, -150, -20, 3.0, SOUL[0], SOUL[1])
        slash(cv, add(j["top"], (6, -6)), (60, 46), 5, 4.2, SOUL[0], SOUL[2])
        slash(cv, add(j["top"], (10, 2)), (58, 54), 3, 2.6, SOUL[1], SOUL[2])
    elif name == "windup":
        sparkle(cv, add(j["tip"], (0, -1)), STEEL[3], STEEL[2], big=True)
    elif name == "move":
        for y in (30, 38, 46):
            cv.line4([(3, y), (10, y)], CLOAK[2])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((5, -6), (7, -3), (4, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), EYE_HI)
    return cv.image()


if __name__ == "__main__":
    run("wraith-dark", draw, sys.argv[1:], idle_ms=210)
