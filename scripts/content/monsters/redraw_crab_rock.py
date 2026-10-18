#!/usr/bin/env python3
"""바위게(crab-rock) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

회청색 각진 돌 등딱지에 금빛 광석 조각이 박힌 게. 자루 눈 둘, 크기가 다른 집게 둘
(앞쪽 큰 집게가 아군 쪽), 무릎이 솟은 마디 다리가 바닥(y=60)을 짚는다.
6번 칸(스킬 skill_mon_shell_guard): 다리를 접어 몸을 낮추고 두 집게로 앞을 가리며
등딱지에 금빛 방벽 고리가 둘러진다.

  python3 scripts/content/monsters/redraw_crab_rock.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, ik, lerp, polar, poly, puff, ring, rnd, run, slash, sparkle, speed_lines

INK = (22, 24, 32)
SHELL = [(70, 82, 100), (106, 120, 140), (142, 158, 176), (186, 198, 210)]
SHELL_FAR = [(52, 60, 76), (70, 82, 100), (88, 100, 118), (88, 100, 118)]
ORE = [(170, 120, 40), (226, 176, 64), (255, 226, 130)]
BELLY = [(140, 110, 96), (180, 150, 128), (208, 184, 160), (208, 184, 160)]
EYE, EYE_HI = (24, 20, 24), (255, 250, 220)
STALK = (120, 104, 92)
GUARD = [(200, 150, 50), (255, 220, 110), (255, 248, 210)]
DUST = [(110, 104, 96), (150, 144, 132)]
WHITE = (255, 252, 240)
GROUND = 60


def walk_leg(cv, hip, foot, far=False):
    """무릎이 높이 솟는 게 다리: 엉덩이 → 무릎(위) → 뾰족한 발끝."""
    ramp = SHELL_FAR if far else SHELL
    knee = ik(hip, foot, 7.5, 9.0, up=True)
    cv.part(chain([hip, knee], [3.0, 2.6]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -1))], [2.4, 1.4]), ramp, gloss=False)


def claw(cv, sh, ang, size=1.0, gape=20, far=False):
    """어깨 → 위팔(위로) → 아래팔 → 불룩한 집게 손 + 굽은 두 손가락. ang = 집게 방향, gape = 벌림 각."""
    ramp = SHELL_FAR if far else SHELL
    el = polar(sh, ang - 55, 5 * size)
    wr = polar(el, ang + 35, 5 * size)
    cv.part(chain([sh, el, wr], [3.0 * size, 2.8 * size, 3.2 * size]), ramp, gloss=False)
    hand_c = polar(wr, ang, 4 * size)
    palm = []
    for a in range(0, 360, 30):
        r = (5.0 - 1.8 * abs(math.sin(math.radians(a)))) * size
        palm.append(polar(hand_c, ang + a, r))
    cv.part(poly(cv.blank(), palm), ramp)
    front = polar(hand_c, ang, 4 * size)
    # 아래 고정 손가락(굽은 갈고리) · 위 움직이는 손가락
    lo0, hi0 = polar(front, ang + 90, 1.6 * size), polar(front, ang - 90, 1.6 * size)
    lo_tip = polar(polar(lo0, ang + gape * 0.3, 5 * size), ang - 90, 1.2 * size)
    hi_tip = polar(polar(hi0, ang - gape, 5.5 * size), ang + 90, 1.2 * size)
    cv.part(poly(cv.blank(), [polar(lo0, ang - 90, 1.4 * size), polar(lo0, ang + 90, 1.6 * size), lo_tip]), ramp, gloss=False)
    cv.part(poly(cv.blank(), [polar(hi0, ang + 90, 1.4 * size), polar(hi0, ang - 90, 1.6 * size), hi_tip]), ramp, gloss=False)
    if not far:
        cv.pixel(*rnd(polar(hand_c, ang - 100, 1.5 * size)), ORE[1])
        cv.pixel(*rnd(polar(hand_c, ang - 60, 2.5 * size)), SHELL[3])
    return lerp(lo_tip, hi_tip, 0.5)


def body(cv, c):
    """각진 돌 등딱지(가로로 넓은 육각) + 배 + 금빛 광석."""
    cv.part(poly(cv.blank(), [add(c, (-11, 3)), add(c, (11, 3)), add(c, (8, 7)), add(c, (-8, 7))]), BELLY, gloss=False)
    shell = [add(c, (-14, 2)), add(c, (-11, -6)), add(c, (-4, -9)), add(c, (5, -9)), add(c, (12, -5)), add(c, (14, 2)),
             add(c, (9, 5)), add(c, (-9, 5))]
    cv.part(poly(cv.blank(), shell), SHELL)
    # 판의 금(각진 돌 조각 경계)
    cv.line4([add(c, (-4, -9)), add(c, (-2, -4)), add(c, (-6, 1))], SHELL[0])
    cv.line4([add(c, (5, -9)), add(c, (4, -3)), add(c, (8, 2))], SHELL[0])
    for p, big in (((-8, -4), True), ((1, -6), False), ((9, -2), True), ((-1, 1), False)):
        q = add(c, p)
        cv.put(poly(cv.blank(), [add(q, (-1, 0)), add(q, (0, -1)), add(q, (1 + big, 0)), add(q, (0, 1))]), ORE[1])
        cv.pixel(*rnd(add(q, (0, -1 if big else 0))), ORE[2])


def eyes(cv, c, look=0, shut=False):
    for dx, h in ((7, 6), (10, 5)):
        base = add(c, (dx, -7))
        top = add(base, (look, -h))
        cv.line4([base, top], STALK)
        if shut:
            cv.line([add(top, (-1, 0)), add(top, (1, 0))], INK)
        else:
            cv.put(ellipse(cv.blank(), top, 1.2, 1.2), EYE)
            cv.pixel(*rnd(add(top, (0, -1))), EYE_HI)


BASE = dict(c=(26.0, 46.0), big=(-25, 22), small=(-50, 18), look=0, shut=False, legs=(0, 0))


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 집게를 딸깍 벌리며 몸이 조금 오른다
        p.update(c=(26.0, 45.0), big=(-35, 40), small=(-40, 34), look=1)
    elif name == "idle_c":  # 옆으로 한 발짝, 집게를 닫는다
        p.update(c=(27.0, 46.0), big=(-15, 4), small=(-58, 4), look=-1, legs=(1, -1))
    elif name == "windup":  # 큰 집게를 높이 치켜들어 활짝 연다
        p.update(c=(23.0, 45.0), big=(-75, 50), small=(-30, 34), look=-1, legs=(-1, 0))
    elif name == "move":  # 몸을 낮추고 옆걸음 돌진
        p.update(c=(24.0, 47.0), big=(-5, 14), small=(-20, 10), look=2, legs=(3, -2))
    elif name == "attack":  # 큰 집게를 앞으로 뻗어 꽉 집는다
        p.update(c=(23.0, 46.0), big=(5, 0), small=(-30, 26), look=2, legs=(2, 1))
    elif name == "recover":  # 스킬 단단해지기: 몸을 낮추고 두 집게로 앞을 가린다
        p.update(c=(25.0, 49.0), big=(-85, 2), small=(-100, 2), look=0, legs=(-1, 1))
    elif name == "hit":  # 맞고 뒤로 들썩, 눈 자루가 눕는다
        p.update(c=(23.0, 45.0), big=(-125, 30), small=(-145, 26), look=-3, shut=True, legs=(-2, 2))
    return p


def draw_crab(cv, P):
    c = P["c"]
    lx, ly = P["legs"]
    for hx, fx in ((-4, -14), (2, 12)):  # 먼 쪽 다리 둘
        walk_leg(cv, add(c, (hx, 2)), (c[0] + fx + lx, GROUND), far=True)
    claw(cv, add(c, (4, -3)), P["small"][0], 0.75, P["small"][1], far=True)
    body(cv, c)
    eyes(cv, c, P["look"], P["shut"])
    for hx, fx in ((-8, -17), (-2, -8), (4, 6), (8, 16)):
        walk_leg(cv, add(c, (hx, 4)), (c[0] + fx - lx + ly, GROUND))
    return claw(cv, add(c, (10, -1)), P["big"][0], 1.3, P["big"][1])


def draw_dead(cv):
    """뒤집혀 배를 하늘로 보이고 다리가 오그라든 모습."""
    cv.part(poly(cv.blank(), [(16, 57), (19, 51), (40, 51), (44, 57), (40, 59), (20, 59)]), SHELL)
    cv.part(poly(cv.blank(), [(19, 51), (22, 47), (37, 47), (40, 51)]), BELLY, gloss=False)
    for x, d in ((22, -1), (27, -1), (33, 1), (38, 1)):
        cv.part(chain([(x, 48), (x + d * 2, 43), (x + d * 4, 45)], [2.2, 1.8, 1.4]), SHELL_FAR, gloss=False)
    cv.part(chain([(43, 55), (48, 56)], [3, 3]), SHELL, gloss=False)
    cv.part(ellipse(cv.blank(), (51, 56), 4.0, 2.6), SHELL)
    cv.part(poly(cv.blank(), [(54, 54), (58, 53), (55, 56)]), SHELL, gloss=False)
    cv.pixel(51, 55, ORE[1])
    cv.pixel(26, 55, ORE[1])
    cv.pixel(34, 56, ORE[2])
    for x in (41, 44):
        cv.line([(x, 51), (x + 1, 49)], STALK)
        cv.line([(x, 48), (x + 2, 48)], INK)
    puff(cv, (12, 56), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    c = P["c"]
    if name == "recover":  # 방벽: 등딱지를 감싸는 금빛 고리(몸 뒤)
        ring(cv, add(c, (1, -3)), 19, -170, -10, GUARD[0], 2)
        ring(cv, add(c, (1, -3)), 16, -160, -20, GUARD[1], 1)
    if name == "move":
        speed_lines(cv, 1, 8, (36, 42, 50), SHELL[2])
    tip = draw_crab(cv, P)
    if name == "move":
        puff(cv, (9, 57), 2.4, DUST)
    elif name == "attack":
        burst(cv, add(tip, (1, 0)), 4.5, ORE[1], WHITE, spikes=7, rot=10)
        slash(cv, add(tip, (-4, -7)), add(tip, (-2, 7)), -3, 2.4, SHELL[3], WHITE)
    elif name == "windup":
        sparkle(cv, add(tip, (0, -3)), WHITE, ORE[2])
    elif name == "recover":
        for p in ((-14, -14), (16, -16), (2, -22)):
            sparkle(cv, add(c, p), GUARD[2], GUARD[1], big=p[0] == 2)
    elif name == "hit":
        for dx, dy in ((8, -18), (11, -16), (6, -21), (13, -20)):
            cv.pixel(c[0] + dx, c[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("crab-rock", draw, sys.argv[1:], idle_ms=170)
