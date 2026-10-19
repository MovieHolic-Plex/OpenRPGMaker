#!/usr/bin/env python3
"""푸른 번개장어(eel-electric) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

물에 떠서 S 자로 크게 굽이치는 긴 원통 몸(뱀처럼 똬리를 틀지 않는다): 짙은 남색 등, 노란 번개 무늬 줄,
연한 하늘색 배, 등에서 꼬리 끝까지 이어진 얇은 지느러미 막, 둥근 납작 머리에 작은 노란 눈(머리 안),
아래로 처진 넓은 입. 몸에서 노란 전기 불꽃이 튄다.
6번 칸(스킬 방전): 몸을 둥글게 감아 올리며 전신이 빛나고 아군 쪽으로 번개 갈래가 뻗는다.

  python3 scripts/content/monsters/redraw_eel_electric.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, sparkle, speed_lines

INK = (10, 16, 36)
BODY = [(24, 40, 96), (40, 66, 140), (70, 100, 180), (120, 150, 220)]
BELLY = (170, 210, 236)
FIN = [(40, 80, 150), (70, 120, 190), (100, 150, 210), (100, 150, 210)]
STRIPE = (250, 220, 60)
EYE = (255, 230, 80)
MOUTH = (80, 20, 40)
SPARK = [(250, 200, 40), (255, 240, 120), (255, 255, 230)]
WHITE = (255, 255, 255)


def path(head, length, amp, phase, waves=1.3, tilt=0):
    pts = []
    for i in range(14):
        t = i / 13
        x = -t * length
        y = amp * math.sin(phase + t * math.pi * 2 * waves) * min(1.0, t * 3)
        a = math.radians(tilt)
        pts.append((head[0] + x * math.cos(a) - y * math.sin(a), head[1] + x * math.sin(a) + y * math.cos(a)))
    return pts


def eel(cv, pts, jaw=0, eye="open", glow=False):
    widths = [7, 7.5, 7.5, 7, 6.6, 6.2, 5.8, 5.2, 4.6, 4, 3.4, 2.8, 2.2, 1.6]
    # 지느러미 막(몸 위쪽을 따라)
    top = [add(p, (0, -widths[i] / 2 - 2)) for i, p in enumerate(pts[3:], 3)]
    bot = [add(p, (0, -widths[i] / 2 + 1)) for i, p in enumerate(pts[3:], 3)]
    cv.part(poly(cv.blank(), top + bot[::-1]), FIN, ink=INK, gloss=False)
    cv.part(chain(pts, widths), BODY if not glow else [BODY[1], BODY[2], BODY[3], SPARK[2]], ink=INK, belly=BELLY)
    for i in range(2, 13, 2):  # 번개 무늬(지그재그 줄)
        a, b = pts[i], pts[i + 1]
        cv.line4([rnd(add(a, (0, -1))), rnd(add(lerp(a, b, 0.5), (0, 1))), rnd(add(b, (0, -1)))], STRIPE)
    h = pts[0]
    hd = math.degrees(math.atan2(pts[0][1] - pts[1][1], pts[0][0] - pts[1][0]))
    # 둥근 머리
    hc = polar(h, hd, 2)
    cv.part(ellipse(cv.blank(), hc, 5, 4.2), BODY, ink=INK, belly=BELLY)
    m = polar(hc, hd, 4.5)
    if jaw:
        cv.put(poly(cv.blank(), [polar(hc, hd + 30, 2), m, polar(m, hd + 90, jaw + 1), polar(hc, hd + 80, 3)]), MOUTH)
    cv.line4([rnd(polar(hc, hd + 40, 2)), rnd(polar(m, hd + 60, 1))], INK)
    e = rnd(polar(hc, hd - 50, 2.2))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, 0)), add(e, (0, 0)), add(e, (0, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0], e[1], INK)
    return dict(eye=e, mouth=m, mid=pts[6])


def bolt(cv, a, b, col, seed=0):
    pts = [a]
    for k in range(1, 5):
        p = lerp(a, b, k / 5)
        pts.append(add(p, (0, (2.5 if (k + seed) % 2 else -2.5))))
    pts.append(b)
    cv.line(pts, col)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        pts = path((50, 56), 44, 1.5, 0.0, 1.0)
        eel(cv, pts, eye="shut")
        return cv.image()
    if name == "idle_a":
        j = eel(cv, path((48, 26), 42, 7, 0.0))
    elif name == "idle_b":
        j = eel(cv, path((48, 24), 42, 7, 1.2))
        cv.pixel(*rnd(add(j["mid"], (0, -7))), SPARK[1])
    elif name == "idle_c":
        j = eel(cv, path((48, 28), 42, 7, 2.4), jaw=1)
    elif name == "windup":  # 머리를 뒤로 젖혀 감아 올린다
        j = eel(cv, path((40, 20), 38, 9, 3.6, tilt=-20), jaw=2)
        for p in ((20, 26), (28, 40)):
            sparkle(cv, p, SPARK[2], SPARK[0])
    elif name == "move":
        speed_lines(cv, 1, 7, (20, 30, 40), FIN[2])
        j = eel(cv, path((56, 30), 48, 5, 0.6))
    elif name == "attack":  # 머리를 내리꽂아 무는 순간 짧은 방전
        j = eel(cv, path((54, 32), 44, 6, 1.6, tilt=10), jaw=4)
        burst(cv, add(j["mouth"], (3, 0)), 4.5, SPARK[1], SPARK[2], spikes=6)
    elif name == "recover":  # 스킬: 몸 전체가 빛나며 번개 갈래
        pts = [polar((26, 32), a, 12 - k * 0.5) for k, a in enumerate(range(-20, 300, 25))]
        pts = [(46, 26)] + pts
        j = eel(cv, pts[:14], jaw=4, glow=True)
        m = j["mouth"]
        for k, end in enumerate(((62, 14), (62, 30), (60, 46))):
            bolt(cv, add(m, (1, 0)), end, SPARK[1] if k != 1 else SPARK[2], seed=k)
        sparkle(cv, (56, 22), WHITE, SPARK[0], big=True)
    elif name == "hit":
        j = eel(cv, path((44, 22), 40, 10, 4.6, tilt=-30), eye="shut")
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("eel-electric", draw, sys.argv[1:], idle_ms=180)
