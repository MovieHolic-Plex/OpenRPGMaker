#!/usr/bin/env python3
"""떠도는 검(sword-flying) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

혼이 깃들어 스스로 떠다니는 넓고 살짝 휜 강철 검: 칼끝은 오른쪽 위(아군 쪽)를 향하고,
가운데 홈이 팬 칼몸, 날개처럼 위로 젖혀진 금 코등이(가운데 붉은 보석, 날개 끝 청록 알),
갈색 가죽 손잡이, 끝에는 작은 해골 머리 장식(눈구멍이 청록으로 빛나는 것이 이 검의 '눈')이 달렸다.
보라 마력 리본이 칼몸을 휘감아 앞뒤로 감긴다. 물건이므로 얼굴은 해골 장식 하나뿐이다.
6번 칸(스킬 환영검): 몸을 크게 휘돌려 보라 궤적을 남기고, 보라 유령 칼 셋을 불러 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_sword_flying.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, arc_trail, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle,
                       speed_lines)

INK = (18, 20, 32)
STEEL = [(74, 90, 106), (124, 144, 160), (180, 198, 210), (232, 242, 248)]
GOLD = [(112, 80, 30), (170, 130, 46), (220, 182, 74), (252, 228, 142)]
GRIP = [(54, 32, 22), (92, 58, 36), (130, 88, 54), (130, 88, 54)]
BONE = [(150, 136, 104), (206, 192, 156), (236, 226, 196), (252, 248, 230)]
GEM = [(120, 20, 40), (200, 40, 60), (255, 120, 120)]
TEAL = [(30, 120, 120), (90, 220, 200), (200, 255, 244)]
AURA = [(96, 52, 170), (156, 100, 232), (214, 184, 255)]
GHOST = [(110, 70, 190), (180, 150, 246), (236, 224, 255)]
WHITE = (255, 255, 255)
L = 30  # 칼몸 길이


def frame(g, ang):
    d = (math.cos(math.radians(ang)), math.sin(math.radians(ang)))
    p = (-d[1], d[0])

    def F(u, v):
        return (g[0] + d[0] * u + p[0] * v, g[1] + d[1] * u + p[1] * v)
    return F


def blade_pts(F, length, w, curve=1.6):
    """칼몸 윤곽(코등이 → 칼끝): 앞날(+v)은 배가 불룩, 등(-v)은 곧다. curve 만큼 등 쪽으로 휜다."""
    back, edge = [], []
    for i in range(9):
        t = i / 8
        bend = -curve * t * t
        hw = w / 2 * (1 - t ** 5)
        back.append(F(length * t, bend - hw))
        edge.append(F(length * t, bend + hw * (1 + 0.25 * math.sin(math.pi * t))))
    tip = F(length + 2, -curve - 0.4)
    return back, edge, tip


def skull(cv, c, eye="glow"):
    """해골 머리 장식(오른쪽을 본다). 눈구멍이 검의 눈."""
    cv.part(ellipse(cv.blank(), c, 3.8, 3.4), BONE, ink=INK)
    cv.part(poly(cv.blank(), [add(c, (-1, 2)), add(c, (3, 2)), add(c, (3, 4)), add(c, (-1, 4))]), BONE, ink=INK, gloss=False)
    cv.line([add(c, (0, 3)), add(c, (2, 3))], BONE[0])
    cv.pixel(c[0] + 1, c[1] + 3, INK)
    e = rnd(add(c, (1.5, -0.5)))
    if eye == "x":
        cv.line([add(e, (-1, -1)), add(e, (1, 1))], INK)
        cv.line([add(e, (1, -1)), add(e, (-1, 1))], INK)
        return
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), INK)
    cv.pixel(e[0] - 3, e[1], INK)
    if eye == "shut":
        return
    cv.pixel(e[0], e[1] - 1, TEAL[1])
    cv.pixel(e[0], e[1], TEAL[2] if eye == "glow" else TEAL[1])
    cv.pixel(e[0] + 1, e[1] - 1, TEAL[2])


def sword(cv, g, ang, aura=0.0, eye="glow", ghost=False, aura_on=True, w=6.4):
    F = frame(g, ang)
    if ghost:  # 유령 칼(속이 비치는 보라 윤곽, 짧은 코등이·손잡이)
        back, edge, tip = blade_pts(F, 15, 4.4, 1.0)
        cv.part(poly(cv.blank(), back + [tip] + edge[::-1]), [GHOST[1]] * 4, ink=GHOST[0], gloss=False)
        cv.line([F(1, -0.2), F(13, -1.0)], GHOST[2])
        cv.part(poly(cv.blank(), [F(-1, -3.5), F(0.5, -3.5), F(0.5, 3.5), F(-1, 3.5)]), [GHOST[2]] * 4, ink=GHOST[0], gloss=False)
        cv.part(chain([F(-1.5, 0), F(-4, 0)], [2, 2]), [GHOST[1]] * 4, ink=GHOST[0], gloss=False)
        return F(17, -1)
    # 마력 리본(뒤 반)
    ribbon = [F(-2 + (L + 2) * i / 20, 5.6 * math.sin(i / 20 * math.pi * 2.4 + aura)) for i in range(21)]
    if aura_on:
        cv.line(ribbon, AURA[0], 2)
        cv.line(ribbon, AURA[1], 1)
    # 손잡이 + 해골
    pm = F(-11.5, 0)
    cv.part(chain([F(-1, 0), F(-9, 0)], [3.2, 3.0]), GRIP, ink=INK, gloss=False)
    for u in (-3, -5, -7):
        cv.pixel(*rnd(F(u, -0.5)), GRIP[0])
    # 칼몸
    back, edge, tip = blade_pts(F, L, w)
    M = cv.part(poly(cv.blank(), back + [tip] + edge[::-1]), STEEL, ink=INK, gloss=False)
    half = poly(cv.blank(), [F(0, 0)] + [lerp(b, e, 0.5) for b, e in zip(back, edge)] + [tip] + back[::-1])
    cv.put(half, STEEL[1])
    edge_half = poly(cv.blank(), [lerp(b, e, 0.5) for b, e in zip(back, edge)] + [tip] + edge[::-1])
    cv.put(edge_half, STEEL[2])
    cv.line([lerp(b, e, 0.8) for b, e in zip(edge[1:7], edge[1:7])], STEEL[3])
    cv.line([lerp(b, e, 0.42) for b, e in zip(back[1:6], edge[1:6])], STEEL[0])  # 가운데 홈
    cv.pixel(*rnd(lerp(back[7], edge[7], 0.5)), STEEL[3])
    # 금 코등이: 양쪽 날개가 칼끝 쪽으로 젖혀진다
    for s in (-1, 1):
        wing = [F(-1.5, 0), F(0.5, s * 2), F(1.5, s * 5), F(4.5, s * 8.5), F(3, s * 6), F(2, s * 7.5), F(0, s * 5.5),
                F(-1, s * 6.5), F(-2, s * 3)]
        cv.part(poly(cv.blank(), wing), GOLD, ink=INK, gloss=False)
        cv.line([F(0, s * 1.5), F(3, s * 7)], GOLD[3] if s < 0 else GOLD[2])
        cv.pixel(*rnd(F(4, s * 8)), TEAL[1])
    cv.part(ellipse(cv.blank(), g, 2.0, 2.0), GOLD, ink=INK, gloss=False)
    cv.pixel(*rnd(g), GEM[1])
    cv.pixel(*rnd(add(g, (0, -1))), GEM[2])
    cv.pixel(*rnd(add(g, (-1, 0))), GEM[0])
    skull(cv, pm, eye)
    # 마력 리본(앞 반: 칼몸 위로 감기는 마디만)
    if aura_on:
        for i in range(20):
            if math.cos(i / 20 * math.pi * 2.4 + aura) > 0:
                cv.line([ribbon[i], ribbon[i + 1]], AURA[1], 2)
                cv.line([ribbon[i], ribbon[i + 1]], AURA[2], 1)
        for i in range(0, 21, 5):
            if math.cos(i / 20 * math.pi * 2.4 + aura) > 0.3:
                cv.pixel(*rnd(ribbon[i]), AURA[2])
    return dict(tip=tip, g=g, pommel=pm, F=F)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 바닥에 납작하게 떨어져 마력이 꺼진다
        j = sword(cv, (25, 55), -2, eye="x", aura_on=False, w=6.0)
        puff(cv, (58, 58), 1.4, [STEEL[0], STEEL[1]])
        puff(cv, (5, 58), 1.2, [STEEL[0], STEEL[1]])
        return cv.image()
    if name == "idle_a":
        sword(cv, (22, 44), -55, aura=0.0)
    elif name == "idle_b":
        sword(cv, (22, 43), -51, aura=1.0)
    elif name == "idle_c":
        sword(cv, (22, 45), -59, aura=2.0)
    elif name == "windup":  # 칼끝을 뒤로 젖혀 힘을 모은다
        j = sword(cv, (28, 42), -100, aura=0.6)
        sparkle(cv, add(j["tip"], (2, 1)), WHITE, AURA[2], big=True)
    elif name == "move":  # 칼끝을 앞으로 눕혀 날아든다
        speed_lines(cv, 2, 12, (26, 33, 40), AURA[1])
        sword(cv, (24, 36), -14, aura=1.6)
    elif name == "attack":  # 아래로 내리꽂으며 찌른다
        j = sword(cv, (22, 24), 22, aura=2.4)
        arc_trail(cv, (22, 24), 29, -62, 14, 3.0, AURA[0], AURA[2])
        burst(cv, add(j["tip"], (0, 0)), 4.0, AURA[1], WHITE, spikes=7)
    elif name == "recover":  # 스킬: 휘돌며 유령 칼 셋
        arc_trail(cv, (15, 40), 22, 200, 300, 3.0, AURA[0], AURA[2])
        sword(cv, (14, 42), -78, aura=0.4)
        for (x, y) in ((36, 18), (40, 31), (36, 44)):
            speed_lines(cv, x - 10, x - 3, (y,), GHOST[1])
            sword(cv, (x, y), 0, ghost=True)
        sparkle(cv, (59, 25), WHITE, GHOST[1])
        sparkle(cv, (58, 40), WHITE, GHOST[2])
    elif name == "hit":  # 맞고 뒤로 넘어가며 눈빛이 꺼진다
        j = sword(cv, (32, 40), -128, aura=3.0, eye="shut")
        p = j["pommel"]
        for dx, dy in ((7, -7), (9, -4), (8, -10)):
            cv.pixel(p[0] + dx, p[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("sword-flying", draw, sys.argv[1:], idle_ms=200)
