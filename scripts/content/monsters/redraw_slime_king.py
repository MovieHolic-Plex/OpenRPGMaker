#!/usr/bin/env python3
"""슬라임 왕(slime-king) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

보라 젤리 군주: 위로 높이 솟은 조롱박 몸(머리 혹과 몸통 혹 두 단), 머리 혹에 눌러쓴 둥근 붉은 왕실 모자
(흰 털 테두리 대신 금빛 띠와 꼭대기 방울), 턱 아래로 늘어진 긴 수염 같은 젤리 주름 세 가닥.
금관 파랑 왕(king-slime-01)과 달리 키가 크고 가늘며 눈이 졸린 듯 반쯤 감겼다.
6번 칸(스킬 보라 독 비): 모자를 들어 올리며 머리 위로 보랏빛 방울을 뿜고, 앞쪽으로 독 방울이 비처럼 쏟아진다.

  python3 scripts/content/monsters/redraw_slime_king.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from jelly_rig import beads, jelly, puddle, superblob
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, poly, rnd, run

INK = (36, 12, 52)
BODY = [(96, 40, 140), (140, 70, 190), (184, 120, 226), (232, 200, 250)]
BEARD = [(80, 30, 120), (120, 56, 170), (164, 100, 210), (164, 100, 210)]
BUBBLE = (210, 170, 240)
HAT = [(120, 16, 30), (176, 30, 44), (220, 66, 70), (250, 140, 130)]
GOLD = [(150, 100, 20), (220, 170, 50), (252, 222, 110), (255, 250, 210)]
EYE = (30, 8, 44)
LID = (110, 50, 160)
MOUTH = (50, 14, 70)
DROP = [(150, 60, 200), (210, 150, 250), (255, 240, 255)]
GROUND = 59


def gourd(cx, base, w, h, lean):
    """아래 큰 혹 + 위 작은 혹(머리)을 이은 조롱박 윤곽."""
    lower = superblob(cx, base, w, h * 0.62, n=2.2, flare=1.0)
    hx = cx + lean * 1.2 + 2
    hb = base - h * 0.5
    head = superblob(hx, hb, w * 0.72, h * 0.56, n=2.2, lean=lean * 0.5)
    return lower, head, (hx, hb - h * 0.56)


POSES = dict(
    idle_a=dict(cx=30, w=36, h=38, lean=0, lid=1),
    idle_b=dict(cx=30, w=38, h=36, lean=-0.5, lid=2, sway=1),
    idle_c=dict(cx=30, w=35, h=40, lean=1, lid=1, sway=-1),
    windup=dict(cx=27, w=40, h=32, lean=-2.5, lid=0, hat_up=-1, mouth=2),
    move=dict(cx=34, w=33, h=40, lean=3, base=52, lid=0, mouth=1),
    attack=dict(cx=34, w=38, h=34, lean=5, lid=0, mouth=4, sway=3),
    recover=dict(cx=26, w=36, h=38, lean=-2, lid=0, mouth=3, hat_up=4),
    hit=dict(cx=26, w=38, h=33, lean=-4, lid=3, mouth=2, sway=-3),
)


def hat(cv, top, tilt, up=0):
    x, y = top[0], top[1] - up
    dome = [(x - 7, y + 3 + tilt), (x - 6, y - 3), (x - 2, y - 6), (x + 3, y - 6), (x + 7, y - 2), (x + 7, y + 3 - tilt)]
    cv.part(poly(cv.blank(), dome), HAT, ink=INK)
    # 꼭대기에서 뒤로 늘어진 끝과 금 방울
    tail = [(x - 2, y - 5), (x - 8, y - 4), (x - 10, y - 1)]
    cv.part(chain(tail, [3, 2.4, 2]), HAT, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (x - 10, y + 1), 1.6, 1.6), GOLD, ink=INK, gloss=False)
    # 금빛 띠
    cv.part(poly(cv.blank(), [(x - 8, y + 2 + tilt), (x + 8, y + 2 - tilt), (x + 8, y + 4 - tilt), (x - 8, y + 4 + tilt)]), GOLD, ink=INK, gloss=False)
    for dx in (-5, 0, 5):
        cv.pixel(x + dx, y + 3, HAT[1])
    return (x, y - 6)


def draw_king(cv, cx, w, h, lean=0.0, base=GROUND, lid=1, mouth=0, hat_up=0, sway=0):
    lower, head, top = gourd(cx, base, w, h, lean)
    jelly(cv, lower, BODY, INK, bubbles=[((cx - w * 0.25, base - h * 0.2), 1.8, BUBBLE), ((cx - w * 0.05, base - h * 0.35), 0.5, BUBBLE),
                                        ((cx + w * 0.12, base - h * 0.15), 0.5, BUBBLE)])
    hx = top[0]
    jelly(cv, head, BODY, INK, bubbles=[((hx - 5, base - h * 0.75), 0.5, BUBBLE)],
          shine=((hx - 7, base - h * 0.85), ((0, 0), (1, 0), (0, 1))))
    # 수염 주름 세 가닥: 턱 아래에서 몸통 앞으로 흘러내린다
    chin = (hx + w * 0.18, base - h * 0.44)
    for k in range(3):
        a = chin[0] - 3 + k * 3
        pts = bezier((a, chin[1] - 1), (a + sway * 0.5 + 1, chin[1] + 4), (a + sway - 1, chin[1] + 7 + k), 4)
        cv.part(chain(pts, [3.2, 3.0, 2.6, 2.0, 1.4]), BEARD, ink=INK, gloss=False)
    tip = hat(cv, add(top, (-1, 3)), -1 if lean > 2 else (1 if lean < -2 else 0), hat_up)
    # 졸린 눈: 위 눈꺼풀이 lid 만큼 덮는다
    ey = base - h * 0.66
    for ex, s in ((hx + w * 0.1, 2), (hx + w * 0.26, 3)):
        e = rnd((ex, ey))
        cv.put(poly(cv.blank(), [add(e, (-1, -2)), add(e, (s - 1, -2)), add(e, (s - 1, 2)), add(e, (-1, 2))]), EYE)
        if lid < 3:
            cv.pixel(e[0], e[1] + 1, (255, 255, 255))
        for k in range(min(lid, 3)):
            cv.line([add(e, (-1, -2 + k)), add(e, (s - 1, -2 + k))], LID)
        cv.line([add(e, (-2, -3 + (1 if not lid else 0))), add(e, (s, -3 - (1 if not lid else 0)))], INK)
    m = rnd((hx + w * 0.2, ey + 6))
    if mouth >= 3:
        cv.put(ellipse(cv.blank(), m, 2.4, mouth * 0.45), MOUTH)
    elif mouth:
        cv.line([add(m, (-2, 0)), add(m, (2, 0))], MOUTH)
    else:
        cv.line([add(m, (-2, -1)), add(m, (0, 0)), add(m, (2, -1))], MOUTH)
    return dict(mouth=m, hat=tip, front=(cx + w / 2, base - h * 0.3), back=(cx - w / 2, base - 4))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        puddle(cv, 31, GROUND, 46, 6, BODY, INK, bumps=((30, 3.0),))
        hat(cv, (18, 54), 2)
        for e in ((38, 56), (43, 56)):
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], EYE)
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], EYE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        beads(cv, (13, GROUND - 1), (23, 48), 1.2, 3.0, DROP, n=5)
    j = draw_king(cv, **P)
    if name == "attack":
        # 수염 주름으로 후려치는 보라 물보라
        burst(cv, add(j["front"], (3, 0)), 5.5, DROP[1], DROP[2], spikes=7)
    elif name == "recover":
        # 모자 위로 솟는 독 분수 → 앞으로 휘어 떨어지는 방울 비
        h = j["hat"]
        pts = bezier(add(h, (0, 2)), (h[0] + 12, h[1] - 12), (57, 30), 11)
        for k, p in enumerate(pts):
            r = 1.4 + 0.22 * k
            cv.put(ellipse(cv.blank(), p, r, r), DROP[0])
            if r > 1.6:
                cv.pixel(*rnd(add(p, (-0.5, -0.5))), DROP[2])
        for k, (x, y) in enumerate(((50, 40), (55, 46), (60, 41), (46, 50))):
            cv.line4([pts[-1 - (k % 2)], (x, y)], DROP[1])
            cv.put(ellipse(cv.blank(), (x, y), 1.4, 1.8), DROP[0])
            cv.pixel(x, y - 1, DROP[2])
    elif name == "windup":
        burst(cv, add(j["hat"], (0, -2)), 2.5, GOLD[2], GOLD[3], spikes=4)
    elif name == "hit":
        beads(cv, add(j["back"], (2, -6)), add(j["back"], (-2, -15)), 2.2, 1.0, DROP, n=4)
    return cv.image()


if __name__ == "__main__":
    run("slime-king", draw, sys.argv[1:], idle_ms=240)
