#!/usr/bin/env python3
"""청색 주황 비늘 괴어(fish-piranha) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

이빨물고기(fish-01, 길쭉한 꼬치형)와 다른 윤곽: 몸높이가 몸길이의 절반이 넘는 둥근 원반형 피라냐.
등은 청회색에 은빛 비늘 점, 아가미부터 배까지 주황 붉은 배, 앞으로 튀어나온 두꺼운 아래턱(주걱턱)에
삼각 톱니 이빨이 위아래로 맞물린다. 머리 안의 붉은 테 두른 눈, 짧은 부채 꼬리, 붉은 배지느러미.
6번 칸(스킬 광란 물어뜯기): 입을 최대로 벌린 채 앞으로 몸을 던지며 이빨 자국 세 줄과 핏빛 물보라.

  python3 scripts/content/monsters/redraw_fish_piranha.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle, speed_lines

INK = (16, 20, 30)
BACK = [(56, 76, 96), (84, 108, 130), (120, 146, 166), (170, 190, 204)]
BELLY = [(190, 70, 40), (230, 110, 60), (250, 150, 90), (255, 190, 140)]
FIN = [(160, 50, 40), (200, 80, 56), (230, 120, 90), (230, 120, 90)]
TOOTH = (250, 248, 236)
MOUTH = (90, 20, 26)
EYE = (220, 40, 30)
SCALE = (190, 206, 218)
WATER = [(120, 170, 210), (190, 225, 245), (250, 255, 255)]
BLOOD = (210, 60, 60)
WHITE = (255, 255, 255)


def piranha(cv, c=(31, 33), tilt=0, jaw=0, eye="open", tail=0, fin=0):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 꼬리(짧은 부채) + 등·배 지느러미
    cv.part(poly(cv.blank(), [R(-13, -1), R(-21, -8 + tail), R(-19, 0), R(-21, 8 + tail), R(-13, 2)]), FIN, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-6, -11), R(-10, -16 + fin), R(-1, -13)]), BACK, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-8, 9), R(-12, 14 - fin), R(-4, 11)]), FIN, ink=INK, gloss=False)
    # 원반 몸
    cv.part(ellipse(cv.blank(), R(-1, 0), 14, 12), BACK, ink=INK)
    # 주황 배(아가미에서 배까지)
    cv.put(poly(cv.blank(), [R(10, 2), R(6, 9), R(-4, 11), R(-12, 5), R(-6, 4), R(4, 2)]), BELLY[1])
    cv.put(poly(cv.blank(), [R(6, 6), R(-2, 9), R(-6, 7), R(2, 5)]), BELLY[2])
    for dx, dy in ((-8, -6), (-4, -8), (0, -6), (-10, -1), (-5, -3), (-1, -1)):
        cv.pixel(*rnd(R(dx, dy)), SCALE)
    # 가슴지느러미
    cv.part(poly(cv.blank(), [R(3, 2), R(-3, 5 + fin * 0.5), R(-1, 1)]), FIN, ink=INK, gloss=False)
    # 아가미 선
    cv.line4([rnd(R(5, -6)), rnd(R(3, 0)), rnd(R(5, 6))], BACK[0])
    # 입: 위턱(이마에서 꺾임) + 앞으로 튀어나온 두꺼운 아래턱
    if jaw:
        cv.put(poly(cv.blank(), [R(8, 1), R(15, -1), R(16, 2 + jaw), R(9, 5)]), MOUTH)
    cv.part(poly(cv.blank(), [R(8, -8), R(13, -4), R(15, -1), R(9, 1)]), BACK, ink=INK, gloss=False)
    lj = [R(8, 3 + jaw * 0.4), R(16, 1 + jaw), R(17, 4 + jaw), R(12, 7 + jaw * 0.5), R(7, 7)]
    cv.part(poly(cv.blank(), lj), BELLY, ink=INK, gloss=False)
    for k in range(4):  # 위아래 삼각 이빨
        x = 10 + k * 1.6
        cv.put(poly(cv.blank(), [R(x, -0.5), R(x + 1.2, -0.5), R(x + 0.6, 1.5)]), TOOTH)
        cv.put(poly(cv.blank(), [R(x + 0.8, 2 + jaw), R(x + 2, 2 + jaw), R(x + 1.4, 0.4 + jaw)]), TOOTH)
    e = rnd(R(7, -4))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(*e, INK)
        cv.pixel(e[0] - 1, e[1] - 1, WHITE)
    return dict(eye=e, mouth=R(16, 1 + jaw * 0.5))


def draw_dead(cv):
    from PIL import Image
    cv2 = Canvas(64, INK)
    piranha(cv2, c=(31, 18), eye="shut", tail=2)
    im = cv2.image().transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    im = im.resize((64, 40), Image.NEAREST)  # 옆으로 누워 납작
    out = Image.new("RGBA", (64, 64))
    out.alpha_composite(im, (0, 21))
    return out


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        return draw_dead(cv)
    if name == "idle_a":
        piranha(cv)
    elif name == "idle_b":
        piranha(cv, c=(31, 31), tilt=-4, jaw=1, tail=3, fin=2)
    elif name == "idle_c":
        piranha(cv, c=(31, 34), tilt=4, tail=-3, fin=-2)
    elif name == "windup":  # 뒤로 물러서며 입을 크게 벌린다
        j = piranha(cv, c=(27, 33), tilt=-16, jaw=5, tail=5)
        sparkle(cv, add(j["eye"], (2, -7)), WHITE, EYE)
    elif name == "move":
        speed_lines(cv, 1, 8, (24, 33, 42), WATER[1])
        piranha(cv, c=(36, 33), tilt=6, jaw=2, tail=-4)
    elif name == "attack":
        j = piranha(cv, c=(35, 33), tilt=10, jaw=1)
        burst(cv, add(j["mouth"], (3, 1)), 4.0, WATER[1], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 광란 물어뜯기 — 이빨 자국 세 줄 + 핏빛 물보라
        j = piranha(cv, c=(29, 34), tilt=8, jaw=6, tail=5, fin=3)
        m = j["mouth"]
        for k in range(3):
            slash(cv, (49 + k * 4, 22), (53 + k * 4, 44), 2, 2.2, WATER[0], WHITE)
        for p in ((57, 48), (60, 41), (51, 50)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.2), BLOOD)
        sparkle(cv, (58, 20), WHITE, WATER[1])
    elif name == "hit":
        j = piranha(cv, c=(28, 31), tilt=-24, jaw=2, eye="shut", tail=-5)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("fish-piranha", draw, sys.argv[1:], idle_ms=170)
