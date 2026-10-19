#!/usr/bin/env python3
"""바위 골렘(golem-stone) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

이끼 골렘(golem)·강철 골렘과 다른 윤곽: 등이 높이 솟은 꼽추형 화강암 거인. 머리가 어깨 앞쪽 아래에 박혀 있고
(목이 없다) 이마 바위 그늘 아래 붉은 눈 하나가 빛난다. 등에는 크고 작은 둥근 돌이 산처럼 쌓여 있고,
앞팔이 땅에 닿을 만큼 길며 손 대신 둥근 바위 공이 달렸다. 모래빛 회색, 돌 사이 틈은 짙은 줄.
6번 칸(스킬 바위 던지기): 등의 바위 하나를 뽑아 머리 위로 들어 아군 쪽으로 던진다(날아가는 바위 + 궤적).

  python3 scripts/content/monsters/redraw_golem_stone.py [--preview DIR]
"""
from __future__ import annotations

import sys

from pixel_lib import Canvas, add, burst, crack, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (30, 26, 22)
STONE = [(98, 90, 78), (138, 128, 110), (176, 166, 146), (206, 198, 178)]
STONE_FAR = [(74, 68, 60), (98, 90, 78), (114, 106, 92), (114, 106, 92)]
EYE, EYE_HI = (230, 60, 40), (255, 190, 150)
CRACK = (54, 46, 40)
DUST = [(120, 112, 96), (170, 160, 140)]
WHITE = (255, 250, 236)
GROUND = 60


def boulder(cv, c, r, ramp, ry=None):
    return cv.part(ellipse(cv.blank(), c, r, ry or r * 0.85), ramp)


def stone_arm(cv, sh, hand, ramp, n=3):
    for i in range(n + 1):
        t = i / n
        boulder(cv, lerp(sh, hand, t * 0.85), 3.8 - t * 0.6, ramp, 3.4 - t * 0.5)
    boulder(cv, hand, 4.8, ramp, 4.4)


def head(cv, c, eye="open"):
    x, y = c
    cv.part(poly(cv.blank(), [(x - 5, y + 4), (x - 5, y - 2), (x - 1, y - 5), (x + 5, y - 4), (x + 7, y - 1), (x + 6, y + 4)]), STONE)
    cv.part(poly(cv.blank(), [(x - 2, y - 5), (x + 5, y - 5), (x + 8, y - 2), (x + 1, y - 1)]), STONE, gloss=False)  # 이마 바위
    e = (int(x + 4), int(y + 1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, 0)), add(e, (1, 0)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0] + 1, e[1], EYE_HI)
    cv.line4([(x + 1, y + 3), (x + 5, y + 3)], INK)
    return e


def golem(cv, dx=0, dy=0, hd=(0, 0), near=(46, 55), far=(38, 56), feet=((22, 56), (32, 56)), eye="open", lifted=False, back_tilt=0):
    o = lambda p: (p[0] + dx, p[1] + dy)
    # 먼 팔(몸 뒤)
    stone_arm(cv, o((30, 34)), far, STONE_FAR)
    # 짧은 다리
    for f, ramp in ((feet[0], STONE_FAR), (feet[1], STONE)):
        boulder(cv, (f[0], f[1] - 4 + dy * 0.5), 4.2, ramp)
        boulder(cv, f, 4.4, ramp, 3.0)
    # 꼽추 몸통: 엉덩이 → 높은 등 → 등 위 쌓인 돌
    boulder(cv, o((24, 44)), 10, STONE, 8.5)
    boulder(cv, o((20 + back_tilt, 31)), 9, STONE, 8)
    boulder(cv, o((15 + back_tilt * 1.5, 21)), 5.5, STONE, 4.6)
    boulder(cv, o((23 + back_tilt * 1.5, 20)), 3.8, STONE, 3.2)
    if not lifted:
        boulder(cv, o((17 + back_tilt * 2, 14)), 3.4, STONE, 3)
    boulder(cv, o((31, 36)), 7, STONE, 6.5)  # 앞 어깨
    crack(cv, rnd(o((19, 27))), [rnd(o((22, 32))), rnd(o((19, 37)))], CRACK)
    crack(cv, rnd(o((26, 46))), [rnd(o((29, 49)))], CRACK)
    stone_arm(cv, o((33, 36)), near, STONE)
    e = head(cv, o((38 + hd[0], 37 + hd[1])), eye)
    return e


def draw_dead(cv):
    for c, r in (((14, 56), 4), ((22, 54), 6), ((32, 53), 7), ((42, 55), 5), ((50, 57), 3), ((28, 46), 3.4)):
        boulder(cv, c, r, STONE)
    crack(cv, (30, 49), [(33, 53), (31, 57)], CRACK)
    cv.line([(41, 54), (43, 54)], INK)
    puff(cv, (8, 53), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        golem(cv)
    elif name == "idle_b":
        golem(cv, dy=1, hd=(0, 1), near=(46, 55), far=(37, 56))
    elif name == "idle_c":
        golem(cv, hd=(1, -1), near=(47, 54), far=(39, 55), back_tilt=-1)
    elif name == "windup":  # 몸을 젖히고 두 바위 주먹을 머리 위로
        e = golem(cv, dx=-3, hd=(0, -2), near=(36, 12), far=(28, 14), feet=((18, 56), (30, 56)), eye="open", back_tilt=-2)
        sparkle(cv, (40, 8), WHITE, EYE)
    elif name == "move":
        speed_lines(cv, 1, 6, (30, 38, 46), STONE[2])
        golem(cv, dx=3, hd=(1, 1), near=(54, 52), far=(40, 50), feet=((22, 56), (39, 55)))
        puff(cv, (12, 57), 2.4, DUST)
    elif name == "attack":  # 긴 앞팔을 앞으로 휘둘러 내지른다
        golem(cv, dx=1, hd=(2, 1), near=(56, 40), far=(36, 54), feet=((21, 56), (33, 56)))
        burst(cv, (59, 40), 4.5, DUST[1], WHITE, spikes=7, rot=10)
    elif name == "recover":  # 스킬: 등 바위를 뽑아 던진다
        golem(cv, dx=-2, hd=(0, -1), near=(40, 22), far=(34, 26), feet=((20, 56), (31, 56)), lifted=True, back_tilt=-1)
        cv.line([(42, 18), (47, 15), (51, 17)], DUST[1])
        cv.line([(43, 22), (49, 21)], DUST[0])
        boulder(cv, (55, 22), 6.0, STONE, 5.4)
        crack(cv, (53, 19), [(56, 23), (54, 26)], CRACK)
        for p in ((47, 28), (60, 31)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.2), STONE[2])
    elif name == "hit":
        e = golem(cv, dx=-4, hd=(-2, -3), near=(40, 50), far=(30, 52), feet=((18, 56), (29, 56)), eye="shut", back_tilt=-2)
        for ddx, ddy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + ddx, e[1] + ddy, WHITE)
        boulder(cv, (7, 30), 2.2, STONE)
    return cv.image()


if __name__ == "__main__":
    run("golem-stone", draw, sys.argv[1:], idle_ms=320)
