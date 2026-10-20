#!/usr/bin/env python3
"""녹색 삼두룡(hydra-three) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

날개 없는 무거운 네발 몸통(낮게 깔린 배, 굵고 짧은 다리, 뭉툭한 꼬리)에서 긴 뱀 목 셋이 솟는다: 목마다 높이·기울기가 달라
세 머리가 따로 움직인다. 머리는 뱀처럼 납작한 쐐기, 노란 배 비늘판이 목 앞쪽을 따라 이어지고 머리 안의 붉은 눈,
뒤로 뻗은 뿔 둘, 갈라진 혀. 녹색 비늘에 짙은 등 무늬. 날개 달린 용(dragon_rig)과 윤곽이 다르다.
6번 칸(스킬 세 갈래 독 숨결): 세 머리가 동시에 앞으로 뻗어 초록 독 숨결 세 줄기를 아군 쪽으로 뿜는다.

  python3 scripts/content/monsters/redraw_hydra_three.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

S = 96
G = 92
INK = (10, 26, 14)
SCALE = [(40, 96, 46), (60, 136, 60), (96, 176, 84), (150, 214, 130)]
FAR = [(28, 70, 34), (40, 96, 46), (48, 110, 52), (48, 110, 52)]
BELLY = (220, 214, 130)
MARK = (24, 60, 30)
HORN = [(150, 140, 110), (196, 186, 150), (230, 222, 190), (230, 222, 190)]
EYE = (230, 40, 30)
MOUTH = (110, 20, 30)
TONGUE = (220, 60, 80)
VENOM = [(80, 150, 30), (150, 214, 60), (220, 255, 150)]
DUST = [(110, 104, 84), (150, 144, 120)]
WHITE = (255, 255, 240)


def leg(cv, top, foot, far):
    ramp = FAR if far else SCALE
    cv.part(chain([top, add(foot, (0, -3))], [10, 8]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    for dx in (0, 3, 6):
        cv.part(poly(cv.blank(), [(f[0] + dx - 2, f[1] - 2), (f[0] + dx + 1, f[1] - 2), (f[0] + dx + 2, f[1])]), [HORN[0]] * 4, ink=INK, gloss=False)


def head(cv, base, ctrl, h, tilt, jaw, eye, far, tongue=False):
    ramp = FAR if far else SCALE
    pts = bezier(base, ctrl, h, 8)
    cv.part(chain(pts, [9, 8, 7.4, 6.8, 6.2, 5.8, 5.4, 5.2, 5]), ramp, ink=INK, gloss=False)
    for i in range(1, 8):
        a, b = pts[i - 1], pts[i + 1]
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        cv.pixel(*rnd(polar(pts[i], ang + 90, 1.8)), BELLY)
        cv.pixel(*rnd(polar(pts[i], ang - 90, 1.6)), MARK)
    a = math.radians(tilt)
    R = lambda dx, dy: (h[0] + dx * math.cos(a) - dy * math.sin(a), h[1] + dx * math.sin(a) + dy * math.cos(a))
    for b_, t_ in (((-2, -3), (-9, -6)), ((0, -3), (-6, -8))):
        cv.part(chain([R(*b_), R(*t_)], [2.4, 0.8]), HORN, ink=INK, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(1, 1), R(11, 1), R(11, 2 + jaw), R(1, 3)]), MOUTH)
        cv.part(poly(cv.blank(), [R(-2, 2), R(10, 1 + jaw), R(10, 3 + jaw), R(-2, 4)]), ramp, ink=INK, gloss=False)
    if tongue:
        t0 = R(11, 2)
        cv.line4([rnd(t0), rnd(R(15, 2))], TONGUE)
        cv.line4([rnd(R(15, 2)), rnd(R(17, 0))], TONGUE)
        cv.line4([rnd(R(15, 2)), rnd(R(17, 4))], TONGUE)
    skull = [R(-4, 3), R(-4, -2), R(0, -4), R(7, -3), R(12, 0), R(11, 2), R(1, 3)] if jaw else \
        [R(-4, 3), R(-4, -2), R(0, -4), R(7, -3), R(12, 0), R(11, 3), R(1, 4)]
    cv.part(poly(cv.blank(), skull), ramp, ink=INK)
    e = rnd(R(4, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(e[0], e[1] - 1, INK)
    return dict(eye=e, mouth=R(12, 1 + jaw * 0.5))


def hydra(cv, dx=0, dy=0, heads=None, tail=0, legs=0, eye="open"):
    o = lambda p: (p[0] + dx, p[1] + dy)
    hip, sh = o((26, 72)), o((50, 70))
    # 먼 다리 + 꼬리
    leg(cv, add(hip, (-3, 4)), (hip[0] - 6 - legs, G), True)
    leg(cv, add(sh, (-3, 4)), (sh[0] + 2 + legs, G), True)
    tp = bezier(add(hip, (-6, 0)), add(hip, (-18, 8 + tail)), add(hip, (-24, 16 - tail)), 6)
    cv.part(chain(tp, [12, 10, 8, 6, 4.6, 3.4, 2]), SCALE, ink=INK, belly=BELLY)
    # 몸통
    cv.part(chain([add(hip, (-4, 0)), lerp(hip, sh, 0.5), add(sh, (4, -2))], [20, 22, 18]), SCALE, ink=INK, belly=BELLY)
    for t in (0.2, 0.45, 0.7):
        p = lerp(hip, sh, t)
        cv.part(ellipse(cv.blank(), add(p, (0, -7)), 3, 1.6), [MARK] * 4, ink=INK, gloss=False)
    # 목 셋: 뒤(먼) → 가운데 → 앞(가까운)
    J = []
    base = add(sh, (2, -6))
    for k, (hp, ctrl, tilt, jaw) in enumerate(heads):
        J.append(head(cv, add(base, (-4 + k * 3, k)), o(ctrl), o(hp), tilt, jaw, eye, far=(k == 0), tongue=(k == 1 and not jaw)))
        if k == 0:  # 먼 머리 다음에 가까운 다리 하나
            pass
    leg(cv, add(hip, (2, 6)), (hip[0] + 2 + legs, G), False)
    leg(cv, add(sh, (2, 6)), (sh[0] + 8 - legs, G), False)
    return J


HEADS = {
    "idle_a": [((58, 22), (44, 40), -6, 0), ((72, 34), (56, 46), 4, 0), ((76, 52), (62, 56), 10, 0)],
    "idle_b": [((56, 24), (42, 40), -12, 2), ((74, 36), (58, 48), 8, 0), ((74, 54), (62, 58), 2, 0)],
    "idle_c": [((60, 20), (46, 38), 0, 0), ((70, 32), (54, 44), -6, 3), ((78, 50), (64, 54), 14, 0)],
    "windup": [((48, 16), (36, 36), -30, 4), ((58, 22), (46, 40), -20, 5), ((66, 34), (58, 46), -14, 4)],
    "move": [((64, 28), (50, 44), 6, 0), ((78, 40), (62, 50), 10, 2), ((82, 56), (68, 60), 14, 0)],
    "attack": [((62, 26), (48, 40), 0, 2), ((74, 34), (58, 44), 8, 3), ((80, 62), (68, 60), 26, 6)],
    "recover": [((62, 24), (48, 40), 6, 5), ((70, 40), (58, 48), 6, 5), ((68, 58), (60, 60), 6, 5)],
    "hit": [((44, 22), (38, 40), -34, 2), ((54, 30), (46, 44), -26, 1), ((60, 46), (54, 54), -20, 2)],
}


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        cv.part(chain([(14, 88), (30, 84), (54, 84), (66, 86)], [6, 16, 16, 10]), SCALE, ink=INK, belly=BELLY)
        for k, (b, c, e) in enumerate((((60, 84), (70, 78), (82, 86)), ((62, 86), (72, 88), (86, 90)), ((58, 82), (66, 72), (78, 76)))):
            j = head(cv, b, c, e, 10 - k * 8, 2, "shut", far=(k == 2))
        return cv.image()
    heads = HEADS[name]
    if name == "move":
        speed_lines(cv, 2, 12, (50, 60, 70), SCALE[2])
    J = hydra(cv, dx=(-6 if name in ("windup", "recover", "hit") else 0), heads=heads,
              tail=(4 if name in ("idle_b", "move") else -2 if name == "idle_c" else 0), legs=(3 if name == "move" else 0),
              eye=("shut" if name == "hit" else "open"))
    if name == "windup":
        for j in J:
            sparkle(cv, add(j["eye"], (2, -6)), WHITE, VENOM[1])
    elif name == "move":
        puff(cv, (14, 88), 3.4, DUST)
    elif name == "attack":
        burst(cv, add(J[2]["mouth"], (3, 1)), 6, (255, 230, 170), WHITE, spikes=7)
    elif name == "recover":
        for k, j in enumerate(J):
            m = j["mouth"]
            pts = bezier(m, add(m, (10, 0)), (93, m[1] + 4 + k * 3), 6)
            cv.part(chain(pts, [3, 4, 5, 6, 6.5, 7, 7]), VENOM, ink=(30, 70, 20), gloss=False)
            cv.line(pts[1:5], VENOM[2])
    elif name == "hit":
        e = J[1]["eye"]
        for dx, dy in ((5, -10), (9, -7), (8, -13)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("hydra-three", draw, sys.argv[1:], S=S, idle_ms=230)
