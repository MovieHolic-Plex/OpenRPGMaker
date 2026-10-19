#!/usr/bin/env python3
"""분홍 마디 기생충(parasite-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

땅에서 몸 앞쪽을 들어 올린 통통한 분홍 마디 벌레: 반투명 분홍 마디 열(마디 사이 짙은 주름), 등을 따라 보라 혈관 줄,
배 쪽의 작은 갈고리 발 줄, 앞 끝은 둥근 빨판 입(가운데 원형 이빨 고리)이 앞을 향하고, 그 위 머리 마디에 작은 검은 눈 둘.
꼬리 끝은 가늘게 말린다.
6번 칸(스킬 알 뿌리기): 몸을 곧추세워 빨판 입에서 끈적한 연두 알 덩어리를 아군 쪽으로 쏟는다.

  python3 scripts/content/monsters/redraw_parasite_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (60, 16, 34)
FLESH = [(190, 90, 120), (230, 130, 156), (246, 170, 190), (255, 210, 222)]
VEIN = (130, 60, 140)
FOLD = (160, 70, 100)
HOOK = (90, 30, 50)
MOUTH = (110, 20, 40)
TOOTH = (250, 240, 230)
EYE = (20, 10, 14)
EGG = [(110, 160, 40), (170, 210, 80), (230, 250, 170)]
SLIME = (190, 230, 120)
WHITE = (255, 255, 255)
G = 60


def worm(cv, head, ctrl, tail=(8, 57), mouth=0, eye="open", tilt=0):
    pts = bezier(tail, ctrl, head, 10)
    widths = [2, 4, 6, 8, 9, 10, 10, 10, 10, 9.5, 9]
    # 꼬리 끝 말림
    cv.part(chain([tail, add(tail, (-3, -2)), add(tail, (-2, -5))], [2, 1.6, 1.2]), FLESH, ink=INK, gloss=False)
    cv.part(chain(pts, widths), FLESH, ink=INK)
    for i in range(2, 10):
        a, b = pts[i - 1], pts[i + 1]
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        w = widths[i] / 2 - 0.5
        cv.line4([rnd(polar(pts[i], ang + 90, w)), rnd(polar(pts[i], ang - 90, w))], FOLD)
        cv.pixel(*rnd(polar(pts[i], ang - 90, w * 0.5)), VEIN)
        if pts[i][1] > 46:
            cv.pixel(*rnd(polar(pts[i], ang + 90, w + 1)), HOOK)
    # 머리 마디 + 빨판 입
    h = pts[-1]
    hd = math.degrees(math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])) + tilt
    mc = polar(h, hd, 4)
    cv.part(ellipse(cv.blank(), mc, 3.4 + mouth * 0.3, 4.6 + mouth * 0.5), FLESH, ink=INK, gloss=False)
    cv.put(ellipse(cv.blank(), polar(mc, hd, 1), 2 + mouth * 0.4, 3 + mouth * 0.5), MOUTH)
    for k in range(6):
        cv.pixel(*rnd(polar(polar(mc, hd, 1), k * 60, 2 + mouth * 0.4)), TOOTH)
    up = hd - 90  # 머리 마디 등쪽(입 뒤)
    e1 = rnd(polar(polar(h, hd + 180, 2.5), up, 1.8))
    e2 = rnd(polar(polar(h, hd + 180, 0), up, 2.2))
    for e in (e1, e2):
        if eye == "shut":
            cv.pixel(*e, INK)
        else:
            cv.put(poly(cv.blank(), [e, add(e, (1, 0)), add(e, (1, 1)), add(e, (0, 1))]), EYE)
    return dict(eye=e2, mouth=polar(mc, hd, 3))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        worm(cv, (50, 56), (30, 60), (8, 57), eye="shut")
        cv.put(ellipse(cv.blank(), (34, 59), 10, 0.6), SLIME)
        return cv.image()
    if name == "idle_a":
        worm(cv, (44, 32), (26, 66))
    elif name == "idle_b":
        worm(cv, (45, 34), (28, 68), mouth=1)
    elif name == "idle_c":
        worm(cv, (43, 30), (24, 64), tilt=-8)
    elif name == "windup":  # 몸을 뒤로 젖혀 웅크린다
        j = worm(cv, (36, 24), (34, 66), mouth=2, tilt=-20)
        sparkle(cv, add(j["eye"], (2, -5)), WHITE, FLESH[3])
    elif name == "move":
        speed_lines(cv, 1, 6, (40, 46, 52), FLESH[2])
        worm(cv, (54, 44), (30, 52), (12, 58))
    elif name == "attack":  # 빨판 입으로 들이받아 문다
        j = worm(cv, (52, 38), (30, 66), mouth=3, tilt=10)
        burst(cv, add(j["mouth"], (2, 0)), 4.0, FLESH[3], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 알 뿌리기
        j = worm(cv, (40, 26), (28, 66), mouth=4, tilt=6)
        m = j["mouth"]
        cv.line4([rnd(m), (50, 30)], SLIME)
        for p, r in (((51, 31), 2.2), ((55, 35), 2.4), ((59, 30), 1.8), ((57, 41), 2.0), ((52, 39), 1.6), ((61, 37), 1.4)):
            cv.part(ellipse(cv.blank(), p, r, r), [EGG[0], EGG[1], EGG[2], EGG[2]], ink=(40, 70, 20), gloss=False)
    elif name == "hit":
        j = worm(cv, (34, 30), (36, 64), eye="shut", tilt=-30)
        e = j["eye"]
        for dx, dy in ((3, -6), (6, -4), (5, -9)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("parasite-01", draw, sys.argv[1:], idle_ms=210)
