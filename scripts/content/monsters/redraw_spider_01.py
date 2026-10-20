#!/usr/bin/env python3
"""보라색 가시 거미(spider-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

동굴 거미(spider-cave, 둥근 배·모래시계)와 다른 윤곽: 등에 노란 가시가 줄지어 솟은 가시 거미(꼬리게거미처럼).
납작하고 가로로 넓은 배 위 가시 여섯, 배 옆가장자리 노란 띠, 높이 아치진 굵은 털 다리(무릎 마디마다 가시),
앞쪽 머리가슴의 큰 앞눈 둘 + 작은 눈 둘(머리가슴 앞면 안), 굵은 독니와 털 다리수염.
6번 칸(스킬 가시 사격): 배를 앞으로 치켜들어 등 가시를 아군 쪽으로 쏘아 날린다.

  python3 scripts/content/monsters/redraw_spider_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, ik, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (22, 10, 30)
BODY = [(70, 34, 100), (104, 56, 140), (140, 86, 176), (184, 132, 210)]
FAR = [(48, 22, 70), (70, 34, 100), (84, 42, 118), (84, 42, 118)]
SPIKE = [(190, 150, 30), (236, 200, 60), (255, 236, 130), (255, 236, 130)]
BAND = (236, 200, 60)
EYE = (250, 70, 70)
EYE_HI = (255, 220, 220)
FANG = (30, 14, 20)
DUST = [(100, 90, 90), (140, 130, 130)]
WHITE = (255, 255, 240)
G = 60


def leg(cv, hip, foot, rise, far):
    ramp = FAR if far else BODY
    knee = ik(hip, foot, 11, 12, up=True)
    knee = (knee[0], min(knee[1], hip[1] - rise))
    cv.part(chain([hip, knee], [3.0, 2.6]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, foot], [2.4, 1.2]), ramp, ink=INK, gloss=False)
    cv.pixel(*rnd(add(knee, (0, -2))), SPIKE[1] if not far else SPIKE[0])
    return knee


def spider(cv, c=(36, 46), abd_tilt=0, legs=0.0, fang=0, eye="open", rise=10, spikes=True):
    x, y = c
    abd = (x - 13, y - 3 - abd_tilt * 0.3)
    hips = [(x - 2 + k * 2, y + 1) for k in range(4)]
    feet_far = [(x - 24 + legs, G - 1), (x - 14 - legs, G - 1), (x + 10 + legs, G - 1), (x + 20 - legs, G - 1)]
    feet_near = [(x - 20 - legs, G), (x - 9 + legs, G), (x + 14 - legs, G), (x + 24 + legs, G)]
    for h, f in zip(hips, feet_far):
        leg(cv, add(h, (0, -1)), f, rise, True)
    # 납작하고 넓은 배 + 노란 옆 띠 + 등 가시
    a = math.radians(abd_tilt)
    R = lambda dx, dy: (abd[0] + dx * math.cos(a) - dy * math.sin(a), abd[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(ellipse(cv.blank(), abd, 11, 7), BODY, ink=INK)
    cv.line4([rnd(R(-9, 3)), rnd(R(0, 5)), rnd(R(9, 3))], BAND)
    sp = []
    if spikes:
        for k, dx in enumerate((-8, -4, 0, 4, 8)):
            base = R(dx, -5)
            tip = R(dx * 1.3, -11 - (2 if k == 2 else 0))
            cv.part(poly(cv.blank(), [R(dx - 1.6, -5), tip, R(dx + 1.6, -5)]), SPIKE, ink=INK, gloss=False)
            sp.append(tip)
    for h, f in zip(hips, feet_near):
        leg(cv, add(h, (-3, 1)), f, rise - 1, False)
    # 머리가슴(다리 위에 얹혀 앞을 본다)
    cv.part(ellipse(cv.blank(), (x + 2, y - 2), 7, 5.5), BODY, ink=INK)
    # 털 다리수염 + 독니
    cv.part(chain([(x + 5, y + 1), (x + 9, y - 2), (x + 11, y + 1)], [2, 1.8, 1.4]), BODY, ink=INK, gloss=False)
    for dx in (0, 2):
        f0 = (x + 5 + dx, y + 3)
        cv.part(chain([f0, (f0[0] + 1 + fang, f0[1] + 3)], [2, 1]), [FANG] * 4, ink=INK, gloss=False)
    # 눈: 앞면 안에 큰 눈 둘 + 작은 눈 둘
    e = (x + 4, y - 3)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (2, 0))], INK)
    else:
        for p in (e, add(e, (-3, -1))):
            cv.put(poly(cv.blank(), [p, add(p, (1, 0)), add(p, (1, 1)), add(p, (0, 1))]), EYE)
            cv.pixel(*p, EYE_HI)
        cv.pixel(e[0] - 1, e[1] - 3, EYE)
        cv.pixel(e[0] + 2, e[1] - 2, EYE)
    return dict(eye=e, mouth=(x + 9, y + 4), spikes=sp)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 뒤집혀 다리를 오므림
        cv.part(ellipse(cv.blank(), (26, 55), 11, 5), BODY, ink=INK)
        cv.line4([(17, 57), (35, 57)], BAND)
        cv.part(ellipse(cv.blank(), (40, 55), 6, 4.4), BODY, ink=INK)
        for k in range(4):
            cv.line4([(22 + k * 6, 51), (21 + k * 6, 46), (24 + k * 6, 44)], BODY[1])
        cv.line([(42, 53), (44, 55)], INK)
        cv.line([(44, 53), (42, 55)], INK)
        return cv.image()
    if name == "idle_a":
        spider(cv)
    elif name == "idle_b":
        spider(cv, c=(36, 47), legs=1, abd_tilt=4, rise=9)
    elif name == "idle_c":
        spider(cv, c=(36, 45), legs=-1, abd_tilt=-4, fang=1, rise=11)
    elif name == "windup":  # 배를 치켜들고 앞다리를 든다
        j = spider(cv, c=(34, 46), abd_tilt=-25, fang=2, rise=13)
        for t in j["spikes"]:
            cv.pixel(*rnd(add(t, (0, -1))), WHITE)
    elif name == "move":
        speed_lines(cv, 1, 6, (40, 46, 52), BODY[2])
        spider(cv, c=(40, 46), legs=3, rise=8)
        puff(cv, (10, 58), 2.0, DUST)
    elif name == "attack":  # 독니로 문다
        j = spider(cv, c=(40, 47), legs=-2, fang=3, rise=9)
        burst(cv, add(j["mouth"], (3, 0)), 4.0, (240, 230, 180), WHITE, spikes=6)
    elif name == "recover":  # 스킬: 가시 사격
        j = spider(cv, c=(32, 46), abd_tilt=-35, fang=2, rise=12, spikes=False)
        for k, (p, ang) in enumerate((((44, 18), -20), ((52, 24), -10), ((58, 32), 0), ((50, 34), 5), ((60, 42), 10))):
            tip = polar(p, ang, 4)
            cv.part(poly(cv.blank(), [polar(p, ang + 90, 1.5), tip, polar(p, ang - 90, 1.5)]), SPIKE, ink=INK, gloss=False)
            cv.line([polar(p, ang + 180, 2), polar(p, ang + 180, 7)], SPIKE[2])
        sparkle(cv, (58, 18), WHITE, SPIKE[2])
    elif name == "hit":
        j = spider(cv, c=(32, 46), abd_tilt=20, legs=2, eye="shut", rise=14)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("spider-01", draw, sys.argv[1:], idle_ms=190)
