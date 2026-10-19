#!/usr/bin/env python3
"""노란 산성 우즈(ooze-acid) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

형태 없는 산성 점액: 바닥에 낮게 깔린 넓은 몸에서 기포가 끓는 목이 위로 솟고(목 끝에 얼굴), 몸 앞쪽에서
길고 굽은 촉수 하나가 앞으로 뻗는다. 몸 표면에 밝은 점액 주름(가로 물결 줄), 바닥에 녹아 흐른 자국.
슬라임처럼 둥근 덩어리가 아니라 목·촉수가 있는 비대칭 몸이다.
6번 칸(스킬 산성 분사): 목을 뒤로 젖혔다 앞으로 꺾어 입에서 노란 산성 줄기를 쏘고, 맞은 자리에서 연기가 끓는다.

  python3 scripts/content/monsters/redraw_ooze_acid.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from jelly_rig import beads, puddle, superblob
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, poly, puff, rnd, run

INK = (60, 44, 8)
GOO = [(170, 140, 20), (220, 196, 40), (246, 232, 110), (255, 252, 210)]
FOLD = (255, 244, 150)
BUBBLE = (255, 250, 190)
EYE = (60, 24, 8)
EYE_GLOW = (255, 120, 40)
MOUTH = (110, 60, 10)
ACID = [(150, 210, 40), (220, 250, 110), (255, 255, 230)]
SMOKE = [(150, 150, 110), (200, 200, 160)]
GROUND = 59


def draw_ooze(cv, cx=28, w=36, h=11, neck=((30, 46), (34, 36), (38, 29)), tent=((44, 54), (52, 52), (56, 46), (54, 40)),
              eye="open", mouth=0, bub=0):
    # 촉수(몸 뒤에서 먼저 그려 몸과 겹친다)
    tp = bezier(tent[0], tent[1], tent[2], 6) + [tent[3]]
    cv.part(chain(tp, [5, 4.4, 3.8, 3.2, 2.6, 2.2, 1.8, 1.4]), GOO, ink=INK, gloss=False)
    body = superblob(cx, GROUND, w, h, n=2.2, flare=2.5)
    M = cv.part(poly(cv.blank(), body), GOO, ink=INK, gloss=False)
    # 목: 굵게 시작해 머리 혹으로
    np_ = bezier(add(neck[0], (-2, 6)), neck[1], neck[2], 8)
    cv.part(chain(np_, [15, 12, 9.6, 8.0, 7.0, 6.4, 6.2, 6.6, 8.0]), GOO, ink=INK)
    # 목에서 흘러내리는 점액 방울(앞쪽으로 늘어진 줄)
    d0 = add(lerp(neck[1], neck[2], 0.4), (3, 0))
    cv.part(chain([d0, add(d0, (1, 3)), add(d0, (1, 5))], [2.2, 1.6, 2.2]), GOO, ink=INK, gloss=False)
    head = neck[2]
    cv.part(ellipse(cv.blank(), head, 5.2, 4.4), GOO, ink=INK)
    # 점액 주름(몸 가로 물결) + 기포
    for k, yy in enumerate((GROUND - 4, GROUND - 7)):
        pts = [(x, yy + (1 if (x // 3 + k) % 2 else 0)) for x in range(int(cx - w * 0.38), int(cx + w * 0.3), 1)]
        for p in pts:
            if M[p[1], p[0]]:
                cv.pixel(*p, FOLD)
    for t, r in ((0.25, 1.4), (0.55, 1.0), (0.8, 0.8)):
        p = rnd(lerp(neck[0], neck[2], min(1.0, t + bub * -0.04)))
        cv.put(ellipse(cv.blank(), add(p, (-1, 0)), r, r), BUBBLE)
    # 정수리 끓는 기포(외곽에 붙은 작은 혹)
    cv.part(ellipse(cv.blank(), add(head, (-3, -4)), 1.6, 1.6), GOO, ink=INK, gloss=False)
    # 얼굴: 머리 앞쪽에 두 눈 + 입
    e1, e2 = rnd(add(head, (3, -1))), rnd(add(head, (0, -1)))
    for e, s in ((e2, 1), (e1, 2)):
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (s - 1, 0))], EYE)
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (s - 1, -1 - (1 if eye == "angry" and s == 2 else 0))), add(e, (s - 1, 1)), add(e, (-1, 1))]), EYE)
            cv.pixel(e[0] + s - 1, e[1], EYE_GLOW)
    m = rnd(add(head, (3, 3)))
    if mouth:
        cv.put(ellipse(cv.blank(), m, 1.6, 1.0 + mouth * 0.4), MOUTH)
    else:
        cv.line([add(m, (-1, 0)), add(m, (1, 0))], MOUTH)
    return dict(head=head, mouth=m, tip=tent[3], back=(cx - w / 2, GROUND - 3))


POSES = dict(
    idle_a=dict(),
    idle_b=dict(neck=((30, 46), (33, 38), (36, 31)), tent=((44, 54), (53, 53), (57, 48), (56, 42)), bub=-2, w=38),
    idle_c=dict(neck=((30, 46), (35, 35), (39, 27)), tent=((44, 54), (52, 50), (54, 44), (51, 39)), bub=-4, w=35),
    windup=dict(neck=((28, 47), (26, 39), (24, 32)), tent=((42, 55), (48, 47), (46, 40), (41, 37)), eye="angry", cx=26, w=38),
    move=dict(neck=((34, 46), (40, 38), (45, 32)), tent=((48, 54), (55, 53), (59, 50), (60, 46)), eye="angry", cx=32, w=34, bub=-3),
    attack=dict(neck=((32, 46), (38, 40), (42, 34)), tent=((46, 54), (50, 42), (56, 34), (60, 36)), eye="angry", mouth=1, cx=30),
    recover=dict(neck=((28, 47), (30, 37), (37, 32)), tent=((42, 55), (47, 52), (49, 47), (47, 44)), eye="angry", mouth=2, cx=26),
    hit=dict(neck=((28, 47), (25, 40), (22, 35)), tent=((42, 55), (47, 52), (50, 50), (49, 46)), eye="shut", mouth=1, cx=27, w=38),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        puddle(cv, 32, GROUND, 50, 4, GOO, INK, bumps=((40, 2.4),))
        cv.part(chain([(46, 55), (52, 56), (56, 55)], [3, 2.4, 1.6]), GOO, ink=INK, gloss=False)
        for x in (18, 28):
            cv.pixel(x, 57, FOLD)
        for e in ((38, 55), (41, 55)):
            cv.pixel(*e, EYE)
        puff(cv, (24, 54), 2.4, SMOKE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        puddle(cv, 14, GROUND, 18, 1, GOO, INK)
    j = draw_ooze(cv, **P)
    if name == "attack":
        burst(cv, add(j["tip"], (-1, -2)), 4.5, ACID[1], ACID[2], spikes=6)
    elif name == "recover":
        m = j["mouth"]
        end = (59, 50)
        pts = bezier(add(m, (1, 0)), (52, m[1] - 4), end, 8)
        cv.line(pts, ACID[0], width=3)
        cv.line(pts[:-2], ACID[1])
        burst(cv, (57, 55), 4.5, ACID[1], ACID[2], spikes=7)
        puff(cv, (54, 47), 2.6, SMOKE)
        for p in ((52, 56), (60, 57), (55, 58)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.0), ACID[1])
        cv.line4([(55, 55), (52, 56), (55, 58), (60, 57)], ACID[0])
    elif name == "windup":
        beads(cv, add(j["head"], (-2, -5)), add(j["head"], (-4, -10)), 1.4, 0.8, (GOO[1], BUBBLE, (255, 255, 255)), n=3)
    elif name == "hit":
        beads(cv, add(j["back"], (4, -2)), add(j["back"], (0, -11)), 2.0, 1.2, (GOO[1], BUBBLE, (255, 255, 255)), n=5)
    return cv.image()


if __name__ == "__main__":
    run("ooze-acid", draw, sys.argv[1:], idle_ms=210)
