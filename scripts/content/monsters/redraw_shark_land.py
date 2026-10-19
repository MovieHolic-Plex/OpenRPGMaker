#!/usr/bin/env python3
"""여섯 다리 육상 상어(shark-land) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

물 밖으로 나온 상어: 어뢰형 몸(등 청회색·배 흰색의 뚜렷한 경계), 높이 솟은 세모 등지느러미, 위아래로 갈라진 큰 꼬리,
몸 아래 세 쌍의 짧고 굵은 비늘 다리(앞으로 꺾인 무릎, 발톱 발)로 땅을 박차며, 뾰족한 주둥이 아래 넓은 입에
세모 이빨 줄, 주둥이 쪽 머리 안의 작고 검은 눈, 아가미 틈 다섯 줄.
6번 칸(스킬 땅속 지느러미): 몸을 땅에 파묻듯 낮추고 등지느러미만 내민 채 흙 물결이 아군 쪽으로 밀려간다.

  python3 scripts/content/monsters/redraw_shark_land.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (14, 22, 32)
BACK = [(60, 86, 110), (90, 120, 146), (126, 156, 180), (176, 200, 216)]
FAR = [(44, 64, 84), (60, 86, 110), (70, 98, 124), (70, 98, 124)]
BELLY = (230, 236, 238)
TOOTH = (252, 252, 244)
MOUTH = (110, 30, 40)
EYE = (10, 10, 14)
CLAW = (220, 220, 200)
DIRT = [(110, 86, 60), (150, 124, 90), (186, 164, 128)]
WHITE = (255, 255, 255)
G = 60


def leg(cv, root, foot, far):
    ramp = FAR if far else BACK
    knee = add(lerp(root, foot, 0.5), (2, -1))
    cv.part(chain([root, knee, add(foot, (0, -1))], [4, 3.2, 2.6]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    for dx in (1, 3):
        cv.line4([(f[0], f[1] - 1), (f[0] + dx, f[1])], CLAW)


def shark(cv, x=30, y=46, tilt=0, jaw=0, eye="open", tail=0, gait=0, sink=0, legs=True):
    a = math.radians(tilt)
    R = lambda dx, dy: (x + dx * math.cos(a) - dy * math.sin(a), y + sink + dx * math.sin(a) + dy * math.cos(a))
    # 먼 다리 셋
    if legs:
        for k, dx in enumerate((-10, 0, 10)):
            leg(cv, R(dx - 1, 4), (x + dx - 2 + (gait if k % 2 else -gait), G), True)
    # 꼬리: 위가 큰 초승달
    cv.part(poly(cv.blank(), [R(-18, -2), R(-28, -13 + tail), R(-25, -1), R(-27, 9 - tail), R(-18, 3)]), BACK, ink=INK, gloss=False)
    # 등지느러미
    cv.part(poly(cv.blank(), [R(-4, -7), R(0, -18), R(5, -7)]), BACK, ink=INK, gloss=False)
    # 몸통: 어뢰
    body = [R(-20, 0), R(-12, -6), R(0, -8), R(12, -7), R(20, -3), R(24, 0), R(20, 4), R(8, 7), R(-6, 6), R(-18, 3)]
    cv.part(poly(cv.blank(), body), BACK, ink=INK)
    cv.put(poly(cv.blank(), [R(18, 3), R(8, 6), R(-6, 5), R(-16, 2), R(-6, 2), R(8, 2)]), BELLY)
    # 가슴지느러미
    cv.part(poly(cv.blank(), [R(6, 3), R(1, 10), R(10, 4)]), FAR, ink=INK, gloss=False)
    for k in range(4):
        cv.line4([rnd(R(10 - k * 1.6, -3)), rnd(R(10 - k * 1.6, 1))], BACK[0])
    # 입: 주둥이 아래 넓게, 이빨 줄
    if jaw:
        cv.put(poly(cv.blank(), [R(13, 2), R(22, 1), R(21, 3 + jaw), R(13, 5)]), MOUTH)
        cv.part(poly(cv.blank(), [R(12, 4), R(21, 3 + jaw), R(19, 5 + jaw), R(11, 6)]), [BELLY] * 4, ink=INK, gloss=False)
        for k in range(4):
            cv.put(poly(cv.blank(), [R(14 + k * 2, 3 + jaw * 0.9), R(15 + k * 2, 3 + jaw * 0.9), R(14.5 + k * 2, 1.5 + jaw * 0.6)]), TOOTH)
    for k in range(4):
        cv.put(poly(cv.blank(), [R(14 + k * 2, 1.5), R(15 + k * 2, 1.5), R(14.5 + k * 2, 3)]), TOOTH)
    e = rnd(R(17, -3))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [e, add(e, (1, 0)), add(e, (1, 1)), add(e, (0, 1))]), EYE)
        cv.pixel(e[0], e[1], WHITE)
    if legs:
        for k, dx in enumerate((-8, 2, 12)):
            leg(cv, R(dx, 5), (x + dx + 1 + (-gait if k % 2 else gait), G), False)
    return dict(eye=e, mouth=R(22, 2 + jaw * 0.5), fin=R(0, -18))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 옆으로 쓰러져 배를 보이고 다리를 늘어뜨림
        j = shark(cv, x=32, y=51, tilt=6, eye="shut", legs=False, tail=-3)
        for dx in (-8, 2, 12):
            cv.part(chain([(32 + dx, 56), (34 + dx, G)], [3, 2.4]), FAR, ink=INK, gloss=False)
        return cv.image()
    if name == "idle_a":
        shark(cv)
    elif name == "idle_b":
        shark(cv, y=47, tail=3, gait=1, jaw=1)
    elif name == "idle_c":
        shark(cv, y=46, tilt=-3, tail=-3, gait=-1)
    elif name == "windup":  # 앞몸을 들고 입을 크게 벌린다
        j = shark(cv, x=28, y=44, tilt=-14, jaw=5, tail=4)
        sparkle(cv, add(j["eye"], (2, -5)), WHITE, BACK[3])
    elif name == "move":
        speed_lines(cv, 1, 6, (28, 34, 40), BACK[2])
        shark(cv, x=34, y=46, tilt=3, gait=3, tail=5, jaw=1)
        puff(cv, (8, 57), 2.4, DIRT[1:])
    elif name == "attack":  # 앞으로 몸을 던지며 물어뜯기
        j = shark(cv, x=33, y=46, tilt=8, jaw=4, gait=-2)
        burst(cv, add(j["mouth"], (2, 1)), 4.0, TOOTH, WHITE, spikes=6)
    elif name == "recover":  # 스킬: 땅에 파묻혀 등지느러미만 + 흙 물결
        j = shark(cv, x=24, y=46, sink=8, legs=False, tail=2)
        cv.part(poly(cv.blank(), [(2, G), (6, 52), (16, 49), (28, 51), (40, 49), (50, 52), (62, 55), (62, G)]), DIRT, ink=INK, gloss=False)
        for x0, h in ((44, 5), (52, 7), (60, 9)):
            cv.part(poly(cv.blank(), [(x0 - 4, 52), (x0, 52 - h), (x0 + 3, 52)]), DIRT, ink=INK, gloss=False)
        for p in ((48, 40), (56, 38), (61, 43)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.2), DIRT[2])
    elif name == "hit":
        j = shark(cv, x=28, y=44, tilt=-20, jaw=2, eye="shut", tail=-4, gait=2)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("shark-land", draw, sys.argv[1:], idle_ms=200)
