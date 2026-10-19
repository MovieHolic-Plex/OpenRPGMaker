#!/usr/bin/env python3
"""파란 이빨물고기(fish-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

공중(물속)에 떠 있는 길쭉한 꼬치고기형: 몸이 가늘고 길며(피라냐의 둥근 몸과 다르다) 등은 짙은 파랑,
배는 은백, 옆줄을 따라 검은 반점 줄. 아래턱이 앞으로 튀어나온 긴 주둥이에 바늘 이빨, 머리 안의 큰 노란 눈,
뒤쪽에 작은 등지느러미 둘, 깊게 갈라진 초승달 꼬리. 몸 전체가 S 자로 헤엄친다(마디 굽힘).
6번 칸(스킬 물보라 돌진): 몸을 활처럼 휘었다가 튕기며 앞으로 물보라 고리와 거품을 쏜다.

  python3 scripts/content/monsters/redraw_fish_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, ring, rnd, run, sparkle, speed_lines

INK = (12, 22, 40)
BACK = [(30, 60, 120), (50, 92, 166), (80, 130, 200), (130, 176, 230)]
BELLY = [(170, 184, 196), (210, 222, 230), (236, 242, 246), (250, 252, 255)]
FIN = [(40, 80, 150), (70, 120, 190), (110, 160, 220), (110, 160, 220)]
SPOT = (14, 30, 60)
TOOTH = (250, 250, 240)
MOUTH = (110, 30, 40)
EYE = (250, 210, 60)
WATER = [(90, 160, 220), (170, 220, 250), (240, 252, 255)]
WHITE = (255, 255, 255)


def spine(c, length, bend, phase):
    """머리(오른쪽 끝) → 꼬리 쪽 마디 점들. bend 는 S 자 굽힘 폭."""
    pts = []
    for i in range(9):
        t = i / 8
        x = c[0] + length * (0.5 - t)
        y = c[1] + bend * math.sin(phase + t * math.pi * 1.4) * t
        pts.append((x, y))
    return pts


def fish(cv, c=(29, 32), length=36, bend=2.0, phase=0.0, tilt=0, jaw=0, eye="open", tail_flip=0):
    pts = spine(c, length, bend, phase)
    if tilt:
        a = math.radians(tilt)
        pts = [(c[0] + (x - c[0]) * math.cos(a) - (y - c[1]) * math.sin(a), c[1] + (x - c[0]) * math.sin(a) + (y - c[1]) * math.cos(a)) for x, y in pts]
    widths = [7, 11, 12.5, 12.5, 11, 9, 7, 4.6, 3]
    # 꼬리 지느러미(깊게 갈라진 초승달)
    t0, t1 = pts[-1], pts[-2]
    ang = math.degrees(math.atan2(t0[1] - t1[1], t0[0] - t1[0]))
    cv.part(poly(cv.blank(), [polar(t0, ang + 90, 1.5), polar(t0, ang - 50 + tail_flip, 9), polar(t0, ang, 3), polar(t0, ang + 50 + tail_flip, 9), polar(t0, ang - 90, 1.5)]), FIN, ink=INK, gloss=False)
    # 지느러미: 등 둘(뒤쪽), 배 하나
    for k, h in ((4, 5), (6, 4)):
        p = pts[k]
        cv.part(poly(cv.blank(), [add(p, (2, -widths[k] / 2 + 1)), add(p, (-2, -widths[k] / 2 - h)), add(p, (-3, -widths[k] / 2 + 1))]), FIN, ink=INK, gloss=False)
    p = pts[5]
    cv.part(poly(cv.blank(), [add(p, (2, widths[5] / 2 - 1)), add(p, (-3, widths[5] / 2 + 4)), add(p, (-3, widths[5] / 2 - 1))]), FIN, ink=INK, gloss=False)
    # 몸: 등 파랑 + 배 은백
    cv.part(chain(pts, widths), BACK, ink=INK, belly=BELLY[1])
    for i in range(1, 8):
        a, b = pts[i - 1], pts[i]
        cv.put(ellipse(cv.blank(), add(lerp(a, b, 0.5), (0, widths[i] * 0.22)), max(1.0, widths[i] * 0.3), max(0.8, widths[i] * 0.16)), BELLY[2])
    for i in (2, 3, 4, 5, 6):
        cv.pixel(*rnd(pts[i]), SPOT)
    # 머리 + 튀어나온 아래턱 + 바늘 이빨
    h = pts[0]
    hd = math.degrees(math.atan2(pts[0][1] - pts[1][1], pts[0][0] - pts[1][0]))
    snout = polar(h, hd, 7)
    if jaw:
        cv.put(poly(cv.blank(), [polar(h, hd + 20, 2), snout, polar(snout, hd + 90, jaw + 1), polar(h, hd + 70, 3)]), MOUTH)
    upper = [polar(h, hd - 90, 4), polar(h, hd - 40, 5), snout, polar(snout, hd + 90, 1), polar(h, hd + 25, 2)]
    cv.part(poly(cv.blank(), upper), BACK, ink=INK, gloss=False)
    lower_tip = polar(polar(snout, hd, 2), hd + 90, 1 + jaw)
    lower = [polar(h, hd + 40, 2), polar(snout, hd + 90, 1 + jaw * 0.6), lower_tip, polar(lower_tip, hd + 90, 2), polar(h, hd + 80, 4)]
    cv.part(poly(cv.blank(), lower), BELLY, ink=INK, gloss=False)
    m0 = polar(h, hd + 40, 2.5)
    cv.line4([rnd(m0), rnd(snout)], INK)  # 입 선
    for t in (0.2, 0.45, 0.7, 0.92):
        q = lerp(m0, snout, t)
        cv.pixel(*rnd(add(q, (0, 1))), TOOTH)
        if jaw:
            cv.pixel(*rnd(add(lerp(polar(h, hd + 70, 3), lower_tip, t), (0, -1))), TOOTH)
    gh = polar(h, hd + 180, 5)
    cv.line4([rnd(polar(gh, hd - 80, 4)), rnd(gh), rnd(polar(gh, hd + 80, 4))], BACK[0])  # 아가미
    e = rnd(polar(h, hd - 150, 3.2))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0], e[1], INK)
        cv.pixel(e[0] - 1, e[1] - 1, WHITE)
    return dict(eye=e, snout=lower_tip, tail=t0)


def bubbles(cv, ps):
    for p, r in ps:
        cv.part(ellipse(cv.blank(), p, r, r), [WATER[0], WATER[1], WATER[2], WATER[2]], ink=INK, gloss=False)


def draw_dead(cv):
    j = fish(cv, c=(32, 55), length=38, bend=0.5, tilt=180, eye="shut")
    cv.put(ellipse(cv.blank(), (32, 59), 12, 0.7), WATER[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        cv2 = Canvas(64, INK)
        # 배를 위로 뒤집혀 바닥에 누운 물고기: 위아래 뒤집기
        fish(cv2, c=(30, 7), length=38, bend=0.4, eye="shut")
        im = cv2.image().transpose(0)  # 좌우 그대로, 위아래만
        from PIL import Image
        im = cv2.image().transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        out = Image.new("RGBA", (64, 64))
        out.alpha_composite(im, (0, -4))
        return out
    if name == "idle_a":
        fish(cv)
    elif name == "idle_b":
        fish(cv, c=(30, 30), bend=3.0, phase=1.6, tail_flip=8)
    elif name == "idle_c":
        fish(cv, c=(30, 33), bend=2.5, phase=3.2, tail_flip=-8, jaw=1)
    elif name == "windup":  # 몸을 활처럼 뒤로 휘며 입을 벌린다
        j = fish(cv, c=(28, 32), length=36, bend=6.0, phase=-1.4, tilt=-14, jaw=3)
        sparkle(cv, add(j["eye"], (3, -5)), WHITE, EYE)
    elif name == "move":
        speed_lines(cv, 1, 9, (22, 30, 40), WATER[1])
        fish(cv, c=(36, 32), length=42, bend=1.0, phase=0.4, tilt=6)
        bubbles(cv, (((8, 28), 1.4), ((5, 36), 1.0)))
    elif name == "attack":  # 길게 뻗어 물어뜯기
        j = fish(cv, c=(34, 32), length=42, bend=1.0, tilt=8, jaw=4)
        burst(cv, add(j["snout"], (3, -1)), 4.0, WATER[1], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 물보라 고리 + 거품
        j = fish(cv, c=(26, 32), length=38, bend=4.0, phase=2.0, tilt=-4, jaw=4, tail_flip=10)
        s = j["snout"]
        for r, col in ((5, WATER[1]), (9, WATER[0]), (13, WATER[1])):
            ring(cv, add(s, (-2, 0)), r, -60, 60, col, width=1)
        bubbles(cv, (((54, 24), 1.6), ((58, 34), 2.2), ((53, 41), 1.4), ((60, 44), 1.0)))
    elif name == "hit":
        j = fish(cv, c=(28, 30), length=38, bend=5.0, phase=2.8, tilt=-22, eye="shut", tail_flip=-10)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("fish-01", draw, sys.argv[1:], idle_ms=180)
