#!/usr/bin/env python3
"""거대 지네(centipede-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

화염 지네(centipede-fire, 붉은 몸을 높이 세움)와 다른 윤곽: 땅에 낮게 깔려 칸 폭을 가로지르는 긴 몸.
청록 검은 납작 마디 열넷(마디마다 노란 옆 반점), 마디마다 한 쌍씩 아래로 뻗은 주황 다리(물결처럼 번갈아 움직임),
앞쪽만 살짝 들린 납작 머리: 머리 안의 작은 붉은 눈, 긴 더듬이 둘, 앞으로 휜 독 집게 턱, 꼬리 끝 갈고리 한 쌍.
6번 칸(스킬 독 집게): 머리를 높이 들고 집게 턱에서 보라 독 방울을 아군 쪽으로 튀긴다.

  python3 scripts/content/monsters/redraw_centipede_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (8, 18, 18)
SEG = [(20, 50, 52), (34, 78, 78), (56, 110, 104), (96, 150, 140)]
SPOT = (240, 200, 60)
LEG = [(170, 90, 30), (214, 130, 50), (240, 170, 90), (240, 170, 90)]
LEG_FAR = [(120, 64, 24), (170, 90, 30), (170, 90, 30), (170, 90, 30)]
FANG = [(80, 40, 20), (120, 70, 40), (200, 160, 110), (200, 160, 110)]
EYE = (230, 40, 40)
VENOM = [(110, 40, 150), (170, 90, 210), (230, 190, 255)]
DUST = [(110, 100, 80), (150, 140, 118)]
WHITE = (255, 255, 255)
G = 60
N = 13


def body_pts(head, rise, wave, phase, length=40):
    pts = []
    for i in range(N + 1):
        t = i / N
        x = head[0] - t * length
        lift = rise * max(0.0, 1 - t * 3.2)  # 앞 세 마디만 들린다
        y = G - 5 - lift + wave * math.sin(phase + t * 7)
        pts.append((x, y))
    pts[0] = head
    return pts


def centipede(cv, head=(52, 50), rise=6, wave=0.5, phase=0.0, leg_phase=0.0, fang=0, eye="open", antenna=0):
    pts = body_pts(head, rise, wave, phase)
    # 먼 다리(뒤)
    for i in range(2, N):
        p = pts[i]
        sw = 2.5 * math.sin(leg_phase + i * 1.3)
        cv.line4([rnd(add(p, (-1, 1))), rnd((p[0] - 2 + sw, G - 1))], LEG_FAR[1])
    # 꼬리 갈고리
    t0, t1 = pts[-1], pts[-2]
    for dy in (-3, 2):
        cv.part(chain([t0, add(t0, (-4, dy)), add(t0, (-6, dy - 1))], [1.6, 1.2, 0.8]), LEG, ink=INK, gloss=False)
    # 마디(뒤에서 앞으로)
    for i in range(N, 0, -1):
        p = pts[i]
        r = 3.6 if i > 2 else 3.8
        cv.part(ellipse(cv.blank(), p, 2.4, r), SEG, ink=INK)
        cv.pixel(*rnd(add(p, (0, 1))), SPOT)
    # 가까운 다리(앞)
    for i in range(2, N):
        p = pts[i]
        sw = 2.5 * math.sin(leg_phase + i * 1.3 + math.pi)
        cv.line4([rnd(add(p, (0, 2))), rnd(add(p, (1 + sw * 0.5, 4))), rnd((p[0] + 1 + sw, G))], LEG[1])
    # 머리
    h = pts[0]
    cv.part(ellipse(cv.blank(), h, 4.2, 3.6), SEG, ink=INK)
    # 더듬이
    for k, (dx, dy) in enumerate(((4, -9), (8, -6))):
        cv.line4([rnd(add(h, (1, -3))), rnd(add(h, (dx - 1 + antenna, dy - 2))), rnd(add(h, (dx + 3 + antenna, dy - 4 + k)))], LEG[2] if k else LEG[0])
    # 독 집게 턱
    for k, dy in ((0, 1), (1, 3)):
        a = add(h, (3, dy))
        cv.part(chain([a, add(a, (3 + fang, -1 + k * 2 - fang * 0.3)), add(a, (4 + fang * 0.5, 1 + k * 2))], [1.8, 1.4, 0.8]), FANG, ink=INK, gloss=False)
    e = rnd(add(h, (1, -1)))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE)
    return dict(eye=e, mouth=add(h, (7 + fang, 2)), head=h)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 뒤집혀 다리를 오므린 채 늘어짐
        pts = body_pts((52, 56), 0, 0.0, 0.0)
        for i in range(N, -1, -1):
            cv.part(ellipse(cv.blank(), add(pts[i], (0, 1)), 2.4, 3.0), SEG, ink=INK)
        for i in range(1, N, 2):
            cv.line4([rnd(add(pts[i], (0, -2))), rnd(add(pts[i], (1, -6)))], LEG[1])
        cv.line([(50, 55), (52, 57)], INK)
        cv.line([(52, 55), (50, 57)], INK)
        return cv.image()
    if name == "idle_a":
        centipede(cv)
    elif name == "idle_b":
        centipede(cv, head=(52, 49), rise=7, phase=1.5, leg_phase=1.6, antenna=1)
    elif name == "idle_c":
        centipede(cv, head=(53, 51), rise=5, phase=3.0, leg_phase=3.2, fang=1, antenna=-1)
    elif name == "windup":  # 앞몸을 높이 들고 집게를 벌린다
        j = centipede(cv, head=(48, 38), rise=16, phase=0.8, leg_phase=0.5, fang=2)
        sparkle(cv, add(j["head"], (4, -7)), WHITE, EYE)
    elif name == "move":
        speed_lines(cv, 1, 6, (40, 46, 52), SEG[2])
        centipede(cv, head=(56, 51), rise=4, wave=1.2, phase=2.0, leg_phase=2.5)
        puff(cv, (10, 58), 2.0, DUST)
    elif name == "attack":
        j = centipede(cv, head=(56, 48), rise=8, phase=0.4, leg_phase=1.0, fang=3)
        burst(cv, add(j["mouth"], (1, 0)), 3.6, (240, 230, 180), WHITE, spikes=6)
    elif name == "recover":  # 스킬: 독 집게 — 머리를 높이 들고 보라 독 방울
        j = centipede(cv, head=(44, 34), rise=20, phase=1.2, leg_phase=0.8, fang=3)
        m = j["mouth"]
        for p, r in (((54, 30), 1.8), ((58, 36), 2.2), ((61, 44), 1.6), ((56, 42), 1.2), ((61, 28), 1.0)):
            cv.part(ellipse(cv.blank(), p, r, r), [VENOM[0], VENOM[1], VENOM[2], VENOM[2]], ink=(50, 20, 70), gloss=False)
        cv.line4([rnd(m), (53, 31)], VENOM[1])
    elif name == "hit":
        j = centipede(cv, head=(46, 44), rise=12, wave=2.0, phase=4.0, leg_phase=4.0, eye="shut", antenna=-2)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("centipede-01", draw, sys.argv[1:], idle_ms=170)
