#!/usr/bin/env python3
"""슬라임(slime) 전투 시트 3x3x64 + 초상 64 를 직접 그린다. 붉은 슬라임(redraw_slime_red.py)도 이 몸을 쓴다.

물방울 모양 젤리: 바닥에 넓게 퍼진 아랫단, 위로 솟은 뾰족한 머리끝, 몸 안쪽의 밝은 핵과 거품,
큰 반사광 두 점, 앞(오른쪽)을 보는 동그란 눈 둘과 작은 입. 몸 둘레 1px 외곽선 + 위 빛·아래 그늘.
움직임은 높이·폭을 바꾸는 눌림-늘어남(squash & stretch).
6번 칸(스킬 skill_mon_acid_spit / body_slam): 몸을 뒤로 젖혀 입에서 산성 덩어리를 앞으로 뱉는다.

  python3 scripts/content/monsters/redraw_slime.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, burst, ellipse, lerp, poly, puff, rnd, run, slash, sparkle, speed_lines

GROUND = 60

BLUE = dict(
    ink=(18, 26, 52),
    body=[(40, 88, 168), (70, 136, 216), (120, 186, 244), (200, 232, 255)],
    core=(150, 210, 255),
    eye=(20, 26, 40),
    mouth=(28, 46, 100),
    acid=[(90, 180, 70), (170, 236, 110), (236, 255, 190)],
    splat=[(60, 110, 190), (120, 186, 244)],
)


def blob(cx, base, w, h, lean=0.0, tip=1.0):
    """젤리 윤곽: 바닥 넓은 반타원 + 위로 뾰족한 끝. lean 은 머리끝을 앞뒤로 기울인다."""
    pts = []
    for i in range(25):
        t = i / 24
        a = math.pi * t  # 0 → 오른쪽 바닥, π → 왼쪽 바닥
        x = cx + math.cos(a) * w / 2
        k = math.sin(a)
        y = base - (k ** 0.8) * h * 0.82
        # 위쪽 가운데를 끌어올려 물방울 끝
        y -= tip * max(0.0, k - 0.75) * h * 0.9
        x += lean * k ** 3 * h * 0.045
        pts.append((x, y))
    pts.append((cx - w / 2 + 1, base))
    pts.append((cx + w / 2 - 1, base))
    return pts


def draw_slime(cv, pal, cx=30.0, w=30.0, h=24.0, lean=0.0, tip=1.0, base=GROUND - 1, eye="open", mouth=1, look=0.0):
    M = cv.part(poly(cv.blank(), blob(cx, base, w, h, lean, tip)), pal["body"], ink=pal["ink"], gloss=False)
    top = base - h * 0.82
    # 몸 속 밝은 핵 + 거품
    core = (cx - 2 + lean * 0.8, base - h * 0.38)
    cv.put(ellipse(cv.blank(), core, max(2.0, w * 0.13), max(1.5, h * 0.11)), pal["core"])
    for dx, dy in ((-w * 0.28, -h * 0.18), (w * 0.05, -h * 0.12), (-w * 0.12, -h * 0.55)):
        p = rnd((cx + dx, base + dy))
        if M[p[1], p[0]]:
            cv.pixel(*p, pal["body"][2])
    # 반사광: 왼쪽 위 큰 점(2x2) + 작은 점
    hl = rnd((cx - w * 0.24 + lean * 0.5, top + h * 0.22))
    for d in ((0, 0), (1, 0), (0, 1)):
        p = add(hl, d)
        if M[p[1], p[0]]:
            cv.pixel(*p, pal["body"][3])
    p = add(hl, (3, -1))
    if M[p[1], p[0]]:
        cv.pixel(*p, pal["body"][3])
    # 얼굴(오른쪽으로 치우침)
    ey = base - h * 0.42
    ex = cx + w * 0.12 + lean * 0.6 + look
    face = dict(eyes=[(ex, ey), (ex + 6, ey)], mouth=(ex + 3, ey + 4))
    for i, e in enumerate(face["eyes"]):
        e = rnd(e)
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], pal["eye"])
        elif eye == "x":
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], pal["eye"])
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], pal["eye"])
        elif eye == "angry":
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, 0)), add(e, (1, 2)), add(e, (-1, 2))]), pal["eye"])
            cv.pixel(e[0], e[1], (255, 255, 255))
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -2)), add(e, (1, -2)), add(e, (1, 2)), add(e, (-1, 2))]), pal["eye"])
            cv.pixel(e[0], e[1] - 1, (255, 255, 255))
    m = rnd(face["mouth"])
    if mouth >= 3:
        cv.put(ellipse(cv.blank(), m, 2.0, mouth * 0.6), pal["mouth"])
    elif mouth == 2:
        cv.line([add(m, (-1, 0)), add(m, (1, 0))], pal["mouth"])
        cv.pixel(m[0], m[1] + 1, pal["mouth"])
    elif mouth == 1:
        cv.line([add(m, (-1, 0)), m, add(m, (1, -1))], pal["mouth"])
    return dict(mouth=face["mouth"], top=(cx + lean * h * 0.12, top - tip * h * 0.25), cx=cx)


POSES = dict(
    idle_a=dict(cx=30, w=30, h=24),
    idle_b=dict(cx=30, w=34, h=20, tip=0.7, mouth=2),            # 눌림
    idle_c=dict(cx=30, w=27, h=27, tip=1.2, lean=1.0, look=1),    # 늘어남
    windup=dict(cx=27, w=36, h=17, tip=0.5, lean=-3, eye="angry", mouth=2),   # 납작 웅크림
    move=dict(cx=34, w=24, h=30, tip=1.4, lean=4, base=50, eye="angry"),      # 뛰어오름
    attack=dict(cx=38, w=34, h=22, tip=0.6, lean=5, eye="angry", mouth=4),    # 앞으로 덮침
    recover=dict(cx=27, w=28, h=26, tip=1.1, lean=-4, eye="angry", mouth=5),  # 스킬: 뒤로 젖혀 뱉기
    hit=dict(cx=26, w=32, h=19, tip=0.6, lean=-5, eye="shut", mouth=3),
)


def make_draw(pal):
    def draw(name):
        cv = Canvas(64, pal["ink"])
        if name == "dead":
            # 녹아 퍼진 웅덩이 + X 눈
            cv.part(poly(cv.blank(), [(10, 59), (14, 55), (24, 53), (38, 53), (50, 55), (54, 59)]), pal["body"], ink=pal["ink"], gloss=False)
            for p in ((20, 56), (36, 55)):
                cv.pixel(*p, pal["body"][3])
            for e in ((30, 56), (36, 57)):
                cv.line([add(e, (-1, -1)), add(e, (1, 1))], pal["eye"])
                cv.line([add(e, (-1, 1)), add(e, (1, -1))], pal["eye"])
            for c in ((6, 58), (58, 58)):
                cv.put(ellipse(cv.blank(), c, 1.5, 1.0), pal["body"][1])
            return cv.image()
        P = POSES[name]
        if name == "move":
            speed_lines(cv, 6, 14, (36, 42, 48), pal["body"][2])
            cv.put(ellipse(cv.blank(), (34, 59), 8, 1.0), pal["ink"])  # 바닥 그림자
        j = draw_slime(cv, pal, **P)
        m = j["mouth"]
        if name == "attack":
            slash(cv, (50, 30), (58, 54), -3, 3.0, pal["body"][2], (255, 255, 255))
            burst(cv, (55, 46), 4.5, pal["body"][3], (255, 255, 255), spikes=6)
        elif name == "recover":
            for t, r in ((0.35, 1.6), (0.65, 2.6), (1.0, 3.8)):
                c = lerp(add(m, (2, 0)), (52, m[1] - 6), t)
                cv.put(ellipse(cv.blank(), c, r, r * 0.8), pal["acid"][0])
                cv.put(ellipse(cv.blank(), add(c, (-0.5, -0.5)), r * 0.55, r * 0.45), pal["acid"][1])
            sparkle(cv, (55, m[1] - 12), pal["acid"][2], pal["acid"][1], big=True)
            cv.pixel(58, int(m[1]) - 2, pal["acid"][1])
        elif name == "windup":
            for x in (12, 46):
                cv.pixel(x, 57, pal["body"][2])
        elif name == "hit":
            for p in ((14, 38), (12, 42), (16, 34)):
                cv.put(ellipse(cv.blank(), p, 1.2, 1.2), pal["splat"][1])
            for dx, dy in ((14, -18), (17, -15), (12, -21)):
                cv.pixel(26 + dx, GROUND + dy, (255, 255, 255))
        return cv.image()
    return draw


if __name__ == "__main__":
    run("slime", make_draw(BLUE), sys.argv[1:], idle_ms=220)
