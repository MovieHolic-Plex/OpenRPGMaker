#!/usr/bin/env python3
"""먹보라 우즈(ooze-black) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

타르 같은 먹보라 점액: 낮고 비대칭인 웅덩이 몸(뒤쪽이 더 두껍게 고였다), 웅덩이 앞쪽 위로 솟은 굵은
촉수 눈자루 둘(끝에 노란 눈 하나씩 — 얼굴 축 앞쪽), 그 아래 앞 가장자리에 가로로 찢어진 톱니 입.
기름막 같은 보라·청록 무지개 광택 줄이 몸 위를 흐른다.
6번 칸(스킬 먹물 늪): 몸을 앞으로 길게 퍼뜨려 바닥 앞쪽에 검은 늪을 깔고, 늪에서 가시 촉수 둘이 솟는다.

  python3 scripts/content/monsters/redraw_ooze_black.py [--preview DIR]
"""
from __future__ import annotations

import sys

from jelly_rig import beads, superblob
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, poly, rnd, run

INK = (8, 4, 14)
TAR = [(30, 18, 44), (56, 34, 78), (88, 58, 112), (150, 120, 180)]
SHEEN = [(70, 120, 140), (130, 90, 170)]
EYE = (250, 220, 60)
PUPIL = (20, 10, 10)
MOUTH = (120, 20, 40)
TOOTH = (220, 210, 220)
DROP = [(40, 24, 60), (100, 70, 130), (190, 170, 220)]
GROUND = 59


def pool_shape(x0, x1, hb, hf, tilt=0):
    """뒤 x0 높이 hb, 앞 x1 높이 hf 인 비대칭 웅덩이 윤곽(위는 두 혹)."""
    pts = [(x0 - 2, GROUND)]
    n = 16
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        hump = hb * (1 - t) ** 0.6 * (0.8 + 0.2 * abs(((t * 3 + tilt) % 1) - 0.5) * 2) + hf * t ** 1.5
        pts.append((x, GROUND - max(2.0, hump * (1 - (2 * t - 1) ** 8))))
    pts.append((x1 + 2, GROUND))
    return pts


def stalk(cv, root, tip, w=3.4, look=1, eye="open"):
    pts = bezier(root, ((root[0] + tip[0]) / 2 - 1, (root[1] + tip[1]) / 2 + 1), tip, 5)
    cv.part(chain(pts, [w + 1.6, w + 0.8, w, w, w - 0.4, w + 0.6]), TAR, ink=INK, gloss=False)
    e = rnd(tip)
    cv.part(ellipse(cv.blank(), tip, 2.6, 2.4), TAR, ink=INK, gloss=False)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.put(ellipse(cv.blank(), tip, 1.6, 1.6), EYE)
        cv.pixel(e[0] + look, e[1], PUPIL)
        if eye == "angry":
            cv.line([add(e, (-2, -2)), add(e, (2, -1))], INK)


def draw_ooze(cv, x0=12, x1=50, hb=16, hf=8, tilt=0, stalks=((38, 46), (41, 33), (44, 46), (49, 36)), eye="open", mouth=0, look=1):
    M = cv.part(poly(cv.blank(), pool_shape(x0, x1, hb, hf, tilt)), TAR, ink=INK, gloss=False)
    # 기름막 광택 줄
    for k, (col, dy) in enumerate(((SHEEN[0], 4), (SHEEN[1], 7))):
        for x in range(x0 + 2 + k * 3, x1 - 6):
            y = GROUND - int(hb * 0.55 * (1 - (x - x0) / (x1 - x0))) - dy + (x // 4 + k) % 2
            if 0 < y < 64 and M[y, x] and M[y - 1, x]:
                cv.pixel(x, y, col)
    cv.pixel(x0 + 4, GROUND - hb + 3, TAR[3])
    cv.pixel(x0 + 5, GROUND - hb + 3, TAR[3])
    (r1, t1), (r2, t2) = stalks[0:2], stalks[2:4]
    stalk(cv, r1, t1, 3.0, look, eye)
    stalk(cv, r2, t2, 3.4, look, eye)
    # 앞 가장자리 톱니 입
    m = (x1 - 3, GROUND - 4)
    open_ = mouth
    cv.put(poly(cv.blank(), [add(m, (-7, -1 - open_ * 0.3)), add(m, (2, -2 - open_)), add(m, (2, 1)), add(m, (-7, 0))]), MOUTH)
    for dx in (-6, -3, 0):
        cv.pixel(*rnd(add(m, (dx, -1 - open_ * 0.6))), TOOTH)
        if open_:
            cv.pixel(*rnd(add(m, (dx + 1, 0))), TOOTH)
    return dict(mouth=m, front=(x1, GROUND - 4), back=(x0, GROUND - hb * 0.5), eye=t2)


POSES = dict(
    idle_a=dict(),
    idle_b=dict(hb=15, hf=9, tilt=0.3, stalks=((38, 46), (40, 34), (44, 46), (50, 37)), look=1),
    idle_c=dict(hb=17, hf=7, tilt=0.6, stalks=((38, 46), (42, 32), (44, 46), (48, 35)), look=0),
    windup=dict(x0=10, x1=46, hb=19, hf=6, stalks=((34, 46), (33, 34), (40, 46), (41, 33)), eye="angry", mouth=1),
    move=dict(x0=18, x1=56, hb=10, hf=11, tilt=0.5, stalks=((44, 48), (49, 37), (50, 48), (56, 40)), eye="angry"),
    attack=dict(x0=16, x1=54, hb=12, hf=12, stalks=((44, 48), (51, 39), (50, 48), (57, 44)), eye="angry", mouth=4),
    recover=dict(x0=8, x1=44, hb=15, hf=8, stalks=((32, 46), (34, 32), (38, 46), (42, 34)), eye="angry", mouth=2),
    hit=dict(x0=8, x1=46, hb=13, hf=6, tilt=0.8, stalks=((34, 47), (30, 37), (40, 47), (36, 36)), eye="shut", mouth=1),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        cv.part(poly(cv.blank(), pool_shape(6, 56, 5, 3)), TAR, ink=INK, gloss=False)
        cv.part(chain([(40, 56), (46, 53), (51, 55)], [2.6, 2.2, 2.0]), TAR, ink=INK, gloss=False)
        cv.line([(50, 54), (52, 56)], EYE)
        cv.line([(52, 54), (50, 56)], EYE)
        for x in (16, 26):
            cv.pixel(x, 56, SHEEN[1])
        return cv.image()
    P = dict(POSES[name])
    j = draw_ooze(cv, **P)
    if name == "attack":
        burst(cv, add(j["front"], (2, -8)), 5.0, DROP[1], DROP[2], spikes=7)
    elif name == "recover":
        # 앞 바닥에 깔린 먹물 늪 + 솟는 가시 촉수 둘(늪과 몸이 이어진다)
        cv.part(poly(cv.blank(), [(42, GROUND), (44, GROUND - 3), (52, GROUND - 4), (61, GROUND - 2), (61, GROUND)]), TAR, ink=INK, gloss=False)
        for base, tip in (((49, GROUND - 3), (52, 38)), ((56, GROUND - 3), (59, 44))):
            pts = bezier(base, (base[0] - 2, (base[1] + tip[1]) / 2), tip, 5)
            cv.part(chain(pts, [4, 3.4, 2.8, 2.0, 1.4, 1.0]), TAR, ink=INK, gloss=False)
            for k in (0.35, 0.6):
                b = pts[int(k * 5)]
                cv.pixel(*rnd(add(b, (-2, 0))), TAR[2])
                cv.pixel(*rnd(add(b, (-3, -1))), TAR[2])
            cv.pixel(*rnd(add(tip, (0, 2))), DROP[2])
    elif name == "move":
        beads(cv, (8, GROUND - 1), (17, GROUND - 4), 0.8, 2.0, DROP, n=5)
    elif name == "windup":
        beads(cv, add(j["eye"], (1, -2)), add(j["eye"], (4, -9)), 1.6, 1.0, DROP, n=4)
    elif name == "hit":
        beads(cv, add(j["back"], (4, 0)), add(j["back"], (-1, -10)), 2.0, 1.2, DROP, n=5)
    return cv.image()


if __name__ == "__main__":
    run("ooze-black", draw, sys.argv[1:], idle_ms=230)
