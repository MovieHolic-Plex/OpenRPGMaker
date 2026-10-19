#!/usr/bin/env python3
"""푸른빛 망령(ghost-01) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

반투명 하늘색 망령: 앞으로 들린 큰 둥근 얼굴(움푹한 눈구멍 속 흰 눈빛, 세로로 길게 벌어진 입),
가슴에 드러난 갈비뼈 우리, 허리 아래로 가늘어지며 뒤쪽에서 소용돌이처럼 말려 올라가는 굵은 꼬리,
앞으로 뻗은 갈고리 손가락 세 개의 팔 둘. 천 유령(ghost-pale)과 달리 옷자락 없이 꼬리 하나로 떠 있다.
6번 칸(스킬 혼 얼리기): 두 손을 모아 앞에 차가운 소용돌이 혼불을 빚어 쏜다.

  python3 scripts/content/monsters/redraw_ghost_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle

INK = (16, 30, 70)
SPIRIT = [(60, 110, 190), (100, 160, 230), (160, 210, 250), (226, 246, 255)]
SPIRIT_FAR = [(44, 80, 150), (60, 110, 190), (80, 136, 210), (80, 136, 210)]
RIB = (220, 240, 255)
HOLLOW = (10, 16, 44)
GLOW = (240, 255, 255)
CHILL = [(80, 170, 240), (180, 236, 255), (255, 255, 255)]


def tail_pts(hip, curl, sway):
    """허리에서 아래·뒤로 흘러 뒤쪽에서 위로 말리는 꼬리 중심선."""
    a = hip
    b = add(hip, (-4 + sway, 12))
    c = add(hip, (-14 + sway, 14))
    d = add(hip, (-18 + sway * 0.5, 8 - curl))
    e = add(hip, (-15, 3 - curl * 1.5))
    return bezier(a, b, c, 6) + bezier(c, d, e, 5)[1:]


def arm(cv, sh, ang, ln, far, spread=0):
    ramp = SPIRIT_FAR if far else SPIRIT
    el = polar(sh, ang, ln * 0.5)
    hand = polar(el, ang + 20, ln * 0.5)
    cv.part(chain([sh, el, hand], [4.0, 3.0, 2.6]), ramp, ink=INK, gloss=False)
    a = ang + 20
    for k in (-40 - spread, 0, 40 + spread):
        f1 = polar(hand, a + k, 2.5)
        f2 = polar(f1, a + k + 40, 1.8)
        cv.line4([rnd(hand), rnd(f1), rnd(f2)], ramp[2] if not far else ramp[1])
    return hand


def draw_ghost(cv, c=(32, 26), tilt=-12, curl=0.0, sway=0.0, arms=((10, 15), (25, 14)), eye="open", mouth=3, spread=0, bob=0):
    c = add(c, (0, bob))
    hip = add(c, (-4, 16))
    # 먼 팔
    sh_f = add(c, (-3, 9))
    far = arm(cv, sh_f, arms[1][0], arms[1][1], True, spread)
    # 꼬리 + 몸통(어깨에서 허리로 좁아짐)
    tp = tail_pts(hip, curl, sway)
    n = len(tp)
    cv.part(chain(tp, [10 - 8.5 * i / (n - 1) for i in range(n)]), SPIRIT, ink=INK, gloss=False)
    torso = [add(c, (-8, 6)), add(c, (6, 6)), add(c, (5, 13)), add(hip, (5, 2)), add(hip, (-5, 2)), add(c, (-9, 12))]
    M = cv.part(poly(cv.blank(), torso), SPIRIT, ink=INK)
    cv.shade_side(M, SPIRIT[0], side=-1, depth=2)
    # 갈비뼈 우리: 등뼈에서 앞으로 휘는 갈비 넷
    spine_top, spine_bot = add(c, (-5, 7)), add(hip, (-3, -1))
    for i in range(4):
        s = lerp(spine_top, spine_bot, 0.15 + i * 0.22)
        cv.line4([rnd(s), rnd(add(s, (5, -1))), rnd(add(s, (8, 1)))], RIB)
    cv.line4([rnd(spine_top), rnd(spine_bot)], SPIRIT[0])
    # 머리: 위로 들린 큰 둥근 얼굴
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    head = [r(-8, 2), r(-9, -5), r(-5, -10), r(2, -11), r(8, -8), r(10, -2), r(9, 4), r(4, 7), r(-4, 6)]
    H = cv.part(poly(cv.blank(), head), SPIRIT, ink=INK)
    cv.shade_side(H, SPIRIT[1], side=-1, depth=2)
    # 이마 위로 흩날리는 혼 머리칼 두 갈래
    cv.part(chain([r(-6, -8), r(-11, -11), r(-15, -9)], [3, 2.2, 1.2]), SPIRIT, ink=INK, gloss=False)
    for dx in (2, 7):
        e = rnd(r(dx, -3))
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], HOLLOW)
        else:
            cv.put(ellipse(cv.blank(), e, 1.8, 2.4), HOLLOW)
            cv.pixel(e[0] + (1 if dx > 3 else 0), e[1] - (1 if eye == "wide" else 0), GLOW)
    m = rnd(r(5, 3))
    cv.put(ellipse(cv.blank(), m, 1.4, 0.8 + mouth * 0.45), HOLLOW)
    sh_n = add(c, (3, 9))
    near = arm(cv, sh_n, arms[0][0], arms[0][1], False, spread)
    return dict(hand=near, far=far, mouth=m, eye=r(7, -3), tail=tp[-1])


POSES = dict(
    idle_a=dict(),
    idle_b=dict(bob=-2, curl=2, sway=1, arms=((20, 15), (32, 14)), mouth=4),
    idle_c=dict(bob=-1, curl=-1, sway=-1, tilt=-6, arms=((0, 15), (16, 14)), mouth=2),
    windup=dict(c=(28, 26), tilt=-24, curl=3, sway=2, arms=((-45, 15), (-65, 14)), mouth=5, eye="wide", spread=10),
    move=dict(c=(38, 24), tilt=6, curl=-2, sway=4, arms=((-10, 16), (5, 15)), mouth=3),
    attack=dict(c=(37, 27), tilt=10, curl=1, sway=3, arms=((30, 17), (45, 16)), mouth=6, eye="wide", spread=12),
    recover=dict(c=(28, 25), tilt=-16, curl=3, sway=1, arms=((-8, 16), (8, 16)), mouth=5, eye="wide", spread=5),
    hit=dict(c=(27, 27), tilt=-34, curl=-3, sway=-3, arms=((150, 13), (170, 12)), mouth=4, eye="shut"),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 흩어지며 바닥에 가라앉은 혼: 납작한 몸 + 꼬리, 얼굴이 무너진다
        cv.part(chain(bezier((52, 52), (36, 60), (12, 54), 8), [8, 7, 6, 5, 4, 3, 2.4, 1.8, 1.2]), SPIRIT, ink=INK, gloss=False)
        cv.part(ellipse(cv.blank(), (48, 52), 7, 5), SPIRIT, ink=INK)
        for p in ((46, 51), (51, 51)):
            cv.line([add(p, (-1, -1)), add(p, (1, 1))], HOLLOW)
            cv.line([add(p, (-1, 1)), add(p, (1, -1))], HOLLOW)
        for x, y in ((30, 50), (22, 48)):
            sparkle(cv, (x, y), RIB, SPIRIT[2])
        cv.line4([(22, 48), (30, 50), (40, 52)], SPIRIT[2])
        return cv.image()
    P = dict(POSES[name])
    j = draw_ghost(cv, **P)
    if name == "attack":
        h = j["hand"]
        for k in (-3, 0, 3):
            slash(cv, add(h, (-2 + k, -8)), add(h, (3 + k, 7)), 2, 2.0, CHILL[0], CHILL[2])
        burst(cv, add(h, (3, 0)), 3.5, CHILL[1], CHILL[2], spikes=6)
    elif name == "recover":
        # 두 손 사이에서 빚어 앞으로 쏘는 소용돌이 혼불(나선 꼬리가 손에 이어진다)
        h = j["hand"]
        orb = (54, h[1] - 2)
        pts = [polar(orb, 200 + k * 40, 6 - k * 0.6) for k in range(9)]
        cv.line4([h] + pts, CHILL[0])
        cv.put(ellipse(cv.blank(), orb, 4.2, 4.2), CHILL[0])
        cv.put(ellipse(cv.blank(), add(orb, (-0.5, -0.5)), 2.6, 2.6), CHILL[1])
        cv.pixel(*rnd(add(orb, (-1, -1))), CHILL[2])
        sparkle(cv, add(orb, (5, -5)), CHILL[2], CHILL[1], big=True)
    elif name == "windup":
        sparkle(cv, add(j["eye"], (4, -6)), GLOW, CHILL[1])
    elif name == "move":
        for y in (34, 40):
            cv.line4([(4, y), (11, y)], SPIRIT[1])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((7, -6), (9, -2), (6, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), GLOW)
    return cv.image()


if __name__ == "__main__":
    run("ghost-01", draw, sys.argv[1:], idle_ms=200)
