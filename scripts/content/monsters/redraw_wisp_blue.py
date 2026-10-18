#!/usr/bin/env python3
"""푸른 불꽃 정령(wisp-blue) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

팔 없는 도깨비불: 둥근 머리 몸통이 아군 쪽(오른쪽)을 보고, 뒤로 휘어 솟는 큰 비대칭 불꽃 볏,
뾰족한 코, 하얗게 타는 중심, 뒤로 길게 끌리며 두 갈래로 갈라지는 꼬리. 바닥엔 옅은 청색 그림자.
6번 칸(스킬 skill_mon_frost_orb): 몸이 부풀어 볏이 곤두서고, 입 앞에 서리 결정이 박힌 얼음 구체를 뭉친다.

  python3 scripts/content/monsters/redraw_wisp_blue.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, glow, lerp, polar, poly, rnd, run, sparkle

INK = (14, 22, 58)
FL = [(36, 70, 170), (60, 120, 230), (120, 190, 255), (210, 240, 255)]
CORE = (250, 254, 255)
SHADOW = (30, 46, 90)
EYE = (255, 255, 255)
PUPIL = (20, 40, 110)
ICE = [(120, 190, 230), (190, 236, 255), (250, 255, 255)]
WHITE = (255, 255, 255)


def flame_body(c, r, sway, crest, tail, seed, R):
    """머리 위 볏 + 뒤로 끌리는 꼬리를 하나의 불꽃 윤곽으로: 넓은 밑동, 물결치며 뒤로 휘는 혀들."""
    pts = [R(r * 0.7, -r * 0.55)]
    # 볏 혀(앞 → 뒤): 앞쪽은 낮고 뒤로 갈수록 높게, 끝이 뒤로 말린다
    tongues = ((r * 0.35, 0.95), (-r * 0.25, 1.45), (-r * 0.8, 1.15))
    for k, (bx, h) in enumerate(tongues):
        jit = 0.15 * math.sin(seed * 1.9 + k * 2.3)
        hh = r * (0.6 + 1.2 * h * crest + jit)
        back = (4 + sway) * (0.6 + 0.4 * k)
        pts += [R(bx + 2.5, -r * 0.75), R(bx + 1 - back * 0.3, -r * 0.4 - hh * 0.55),
                R(bx - back, -r * 0.35 - hh), R(bx - 1.5 - back * 0.5, -r * 0.5 - hh * 0.45), R(bx - 2.5, -r * 0.8)]
    # 꼬리: 머리 뒤 위에서 물결치며 왼쪽으로 가늘어진다
    tip = R(-r * 1.6 - 9 - sway * 1.5, -r * 0.2 + tail)
    pts += [R(-r * 1.1, -r * 0.65), R(-r * 1.4 - 3, -r * 0.6 + tail * 0.3 - 1.5),
            tip, R(-r * 1.4 - 3, r * 0.15 + tail * 0.5 + 1.5), R(-r * 1.0 - 4, r * 0.45 + tail * 0.4),
            R(-r * 1.2 - 6, r * 0.9 + tail * 0.6), R(-r * 0.6, r * 0.9), R(0, r * 0.95)]
    return pts, tip


def wisp(cv, c, r=9.0, sway=0.0, crest=1.0, tail=0.0, tilt=0.0, eyes="open", mouth=0, seed=0):
    """c = 머리 중심. sway 는 볏·꼬리가 뒤로 휘는 정도, tail 은 꼬리 끝 위아래 흔들림."""
    t = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(t) - dy * math.sin(t), c[1] + dx * math.sin(t) + dy * math.cos(t))
    outline, tip = flame_body(c, r, sway, crest, tail, seed, R)
    # 불꽃 윤곽 + 둥근 머리 + 뾰족한 코를 한 덩어리로(안쪽 금 없이)
    M = poly(cv.blank(), outline)
    ellipse(M, c, r, r * 0.92)
    poly(M, [R(r * 0.6, -2.5), R(r + 5, 1), R(r * 0.6, 3.5)])
    cv.part(M, [FL[0], FL[1], FL[1], FL[2]], gloss=False)
    # 안쪽 불꽃 층(하늘색): 축소한 윤곽
    inner = [lerp(p, R(-r * 0.3, 0), 0.38) for p in outline]
    cv.put(poly(cv.blank(), inner), FL[2])
    cv.line4([lerp(tip, R(-r * 0.6, 0), 0.25), R(-r * 0.9, 0)], FL[2])
    cv.pixel(*rnd(R(r + 3, 0)), FL[2])
    # 안쪽 빛: 하늘색 → 흰 중심
    cv.put(ellipse(cv.blank(), R(-1, 1), r * 0.62, r * 0.58), FL[2])
    cv.put(ellipse(cv.blank(), R(-2, 2), r * 0.32, r * 0.3), CORE)
    for p in ((-r * 0.7, -r * 0.2), (-r * 0.2, r * 0.75)):
        cv.pixel(*rnd(R(*p)), FL[3])
    # 얼굴
    e = R(r * 0.35, -r * 0.2)
    if eyes == "shut":
        cv.line([add(e, (-1, 0)), add(e, (2, 1))], PUPIL)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -2 if eyes != "angry" else -1)), add(e, (2, -2)), add(e, (2, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), PUPIL)
        if eyes == "angry":
            cv.line([add(e, (-1, -2)), add(e, (3, -1))], INK)
    m = R(r * 0.55, r * 0.4)
    if mouth:
        cv.put(ellipse(cv.blank(), m, 1.6, 0.6 + mouth * 0.6), PUPIL)
    else:
        cv.line([add(m, (-1, 0)), add(m, (1, 0))], PUPIL)
    return dict(nose=R(r + 5, 1), mouth=m, top=R(-2, -r * 2.2))


def shadow(cv, x, w):
    cv.put(ellipse(cv.blank(), (x, 58), w, 1.2), SHADOW)


POSES = dict(
    idle_a=dict(c=(34, 32), sway=0, crest=1.0, tail=0, seed=0),
    idle_b=dict(c=(34, 30), sway=2, crest=1.15, tail=2, seed=1),
    idle_c=dict(c=(34, 33), sway=-1, crest=0.9, tail=-2, seed=2, mouth=1),
    windup=dict(c=(30, 31), sway=3, crest=1.25, tail=3, seed=3, tilt=-14, eyes="angry", mouth=2, r=10.0),
    move=dict(c=(38, 34), sway=6, crest=0.75, tail=-1, seed=4, tilt=12, eyes="angry"),
    attack=dict(c=(40, 33), sway=1, crest=1.0, tail=1, seed=5, tilt=6, eyes="angry", mouth=2),
    recover=dict(c=(30, 32), sway=2, crest=1.35, tail=2, seed=6, tilt=-6, eyes="angry", mouth=3, r=10.5),
    hit=dict(c=(29, 34), sway=-3, crest=0.7, tail=-3, seed=7, tilt=-22, eyes="shut", mouth=2, r=8.0),
)


def ice_orb(cv, c, r):
    cv.put(ellipse(cv.blank(), c, r + 1, r + 1), INK)
    glow(cv, c, r, [ICE[0], ICE[1]])
    for a in range(0, 360, 60):  # 결정 가시
        cv.line([rnd(polar(c, a, r * 0.4)), rnd(polar(c, a, r + 2.5))], ICE[2] if a % 120 == 0 else ICE[1])
    cv.pixel(*rnd(add(c, (-1, -1))), WHITE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 꺼져 바닥에 녹아 흩어진 푸른 불씨 + 김
        shadow(cv, 32, 11)
        cv.part(poly(cv.blank(), [(22, 58), (25, 55), (29, 56), (33, 52), (37, 55), (42, 54), (44, 58)]), FL, gloss=False)
        cv.pixel(31, 56, CORE)
        cv.pixel(36, 56, FL[3])
        for x, y in ((27, 47), (34, 43), (30, 39)):
            cv.put(ellipse(cv.blank(), (x, y), 1.6, 1.3), (70, 90, 130))
        cv.pixel(31, 37, (110, 130, 170))
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        for y in (26, 33, 40):
            cv.line([(2, y), (11, y)], FL[1])
    j = wisp(cv, **P)
    n, m = j["nose"], j["mouth"]
    if name == "windup":
        sparkle(cv, add(m, (6, -5)), WHITE, ICE[1])
        cv.pixel(*rnd(add(m, (5, 1))), ICE[1])
    elif name == "attack":
        # 불꽃 머리로 들이받는 냉기 충격
        burst(cv, add(n, (2, 0)), 5.5, FL[2], WHITE, spikes=7, rot=8)
    elif name == "recover":
        ice_orb(cv, add(n, (8, -1)), 4.5)
        for p in ((10, -11), (14, 8), (3, -14)):
            sparkle(cv, add(n, p), WHITE, ICE[1], big=p[0] == 14)
    elif name == "hit":
        t = j["top"]
        for dx, dy in ((10, 4), (12, 8), (14, 2)):
            cv.pixel(int(t[0] + dx), int(t[1] + dy), WHITE)
        for p in ((10, 28), (8, 34)):
            cv.pixel(*p, FL[2])
    return cv.image()


if __name__ == "__main__":
    run("wisp-blue", draw, sys.argv[1:], idle_ms=200)
