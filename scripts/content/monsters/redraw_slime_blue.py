#!/usr/bin/env python3
"""푸른 슬라임(slime-blue) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

군청색 젤리: 어깨처럼 각지게 두꺼운 윗면(초타원 n=3.4), 윗면을 가르는 밝은 물결 띠, 몸속에 떠오르는
밝은 기포, 두 눈 위를 덮는 굵은 눈살. 기본 슬라임(redraw_slime.py)의 물방울 끝 대신 넓적한 떡 모양이다.
6번 칸(스킬 물방울 포): 몸을 뒤로 젖혀 크게 벌린 입에서 점점 커지는 물방울 줄기를 앞으로 쏜다.

  python3 scripts/content/monsters/redraw_slime_blue.py [--preview DIR]
"""
from __future__ import annotations

import sys

from jelly_rig import beads, eyes, jelly, puddle, superblob
from pixel_lib import Canvas, add, burst, ellipse, rnd, run

INK = (14, 18, 54)
BODY = [(28, 48, 140), (44, 80, 196), (88, 132, 236), (176, 214, 255)]
TOP = (120, 164, 246)
BUBBLE = (150, 196, 255)
EYE = (10, 12, 34)
MOUTH = (16, 22, 80)
WATER = [(70, 150, 230), (170, 220, 255), (255, 255, 255)]
GROUND = 59

POSES = dict(
    idle_a=dict(cx=30, w=36, h=22, lean=0, bob=0),
    idle_b=dict(cx=30, w=39, h=19, lean=0, bob=1, mouth=1),
    idle_c=dict(cx=30, w=33, h=25, lean=1.5, bob=-2),
    windup=dict(cx=27, w=41, h=15, lean=-3, eye="angry", brow=1, mouth=0),
    move=dict(cx=36, w=30, h=26, lean=4, base=48, eye="angry", brow=1),
    attack=dict(cx=36, w=40, h=19, lean=6, eye="angry", brow=1, mouth=3),
    recover=dict(cx=25, w=34, h=24, lean=-4, eye="angry", brow=1, mouth=4),
    hit=dict(cx=26, w=37, h=18, lean=-5, eye="shut", mouth=2),
)


def draw_slime(cv, cx, w, h, lean=0.0, bob=0, base=GROUND, eye="open", brow=0, mouth=0):
    pts = superblob(cx, base, w, h, n=3.4, lean=lean, flare=1.5)
    top = base - h
    bubbles = [((cx - w * 0.28, base - h * 0.35 + bob), 1.6, BUBBLE), ((cx - w * 0.08, base - h * 0.62 + bob), 1.1, BUBBLE),
               ((cx - w * 0.2, base - h * 0.75 + bob), 0.5, BUBBLE), ((cx + w * 0.05, base - h * 0.22), 0.5, BUBBLE)]
    M = jelly(cv, pts, BODY, INK, bubbles=bubbles, shine=((cx - w * 0.32 + lean * 0.5, top + 3), ((0, 0), (1, 0), (0, 1), (3, 0))))
    # 윗면을 가르는 밝은 물결 띠
    for x in range(int(cx - w * 0.38), int(cx + w * 0.3)):
        y = int(round(top + 2 + (1 if (x // 3) % 2 else 0) + lean * 0.3 * ((x - cx) / w)))
        if M[y, x] and M[y - 1, x]:
            cv.pixel(x, y, TOP)
    ex = cx + w * 0.26 + lean * 0.7
    ey = base - h * 0.55
    eyes(cv, (ex + 4, ey), (ex - 2, ey), eye, EYE, size=3)
    # 굵은 눈살: 두 눈 위를 한 줄로 덮는 짙은 띠
    b = -1 if brow else 0
    cv.line([rnd((ex - 4, ey - 5 + b)), rnd((ex + 6, ey - 5 - b))], INK, width=2 if brow else 1)
    m = rnd((ex + 2, ey + 6))
    if mouth >= 3:
        cv.put(ellipse(cv.blank(), m, 2.4, mouth * 0.6), MOUTH)
        cv.pixel(m[0] - 1, m[1] - int(mouth * 0.6) + 1, (230, 240, 255))
    elif mouth == 2:
        cv.line([add(m, (-2, 0)), add(m, (2, 0))], MOUTH)
    elif mouth == 1:
        cv.line([add(m, (-1, 0)), m, add(m, (1, -1))], MOUTH)
    else:
        cv.line([add(m, (-1, -1)), m, add(m, (1, -1))], MOUTH)
    return dict(mouth=m, top=(cx, top), front=(cx + w / 2, base - h * 0.4), back=(cx - w / 2, base - 3))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        puddle(cv, 32, GROUND, 46, 5, BODY, INK, bumps=((24, 2.5), (38, 2.0)))
        for e in ((40, 56), (45, 56)):
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], EYE)
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], EYE)
        for x in (16, 30):
            cv.pixel(x, 57, BUBBLE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        # 튀어 오른 몸 뒤로 늘어진 물 꼬리(바닥에서 몸까지 이어진다)
        beads(cv, (14, GROUND - 1), (25, 44), 1.2, 3.4, WATER, n=6)
    j = draw_slime(cv, **P)
    m = j["mouth"]
    if name == "attack":
        burst(cv, add(j["front"], (4, 3)), 5.0, WATER[1], WATER[2], spikes=7, rot=8)
    elif name == "recover":
        end = beads(cv, add(m, (2, 0)), (58, m[1] - 9), 1.4, 4.6, WATER, n=6, wobble=1.2)
        cv.pixel(*rnd(add(end, (1, -2))), WATER[2])
    elif name == "windup":
        cv.put(ellipse(cv.blank(), add(j["back"], (1, 0)), 2.2, 1.6), BODY[2])
    elif name == "hit":
        beads(cv, add(j["back"], (1, -2)), add(j["back"], (-5, -10)), 2.2, 1.0, WATER, n=4)
    return cv.image()


if __name__ == "__main__":
    run("slime-blue", draw, sys.argv[1:], idle_ms=220)
