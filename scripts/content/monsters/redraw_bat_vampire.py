#!/usr/bin/env python3
"""흡혈 박쥐(bat-vampire) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

털 난 몸통에 뾰족한 큰 귀·붉은 눈·흰 송곳니 머리가 오른쪽을 본다. 손가락 뼈 셋이 펼친 검붉은 막 날개가
칸마다 위·가운데·아래로 퍼덕이고, 발톱 달린 뒷발이 아래로 늘어진다.
6번 칸(스킬 skill_mon_sonic_screech): 입을 찢어지게 벌리고 붉은 음파 고리를 아군 쪽으로 내뿜는다.

  python3 scripts/content/monsters/redraw_bat_vampire.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, ring, rnd, run, slash, sparkle, speed_lines

INK = (28, 14, 24)
FUR = [(62, 40, 70), (98, 66, 108), (138, 100, 148), (178, 144, 186)]
MEM = [(84, 20, 34), (132, 34, 50), (176, 58, 70), (210, 96, 100)]
MEM_FAR = [(60, 16, 28), (84, 20, 34), (110, 28, 42), (110, 28, 42)]
BONE = (52, 26, 44)
EAR_IN = (196, 96, 120)
EYE, EYE_HI = (240, 40, 40), (255, 220, 160)
FANG = (250, 246, 230)
MOUTH = (90, 10, 24)
SONIC = [(120, 20, 60), (220, 60, 90), (255, 160, 170), (255, 240, 240)]
WHITE = (255, 252, 236)


def wing(cv, sh, ang, span=23.0, far=False):
    """어깨 sh 에서 팔뼈 → 손목, 손목에서 손가락 셋을 부채처럼 펴고 사이를 막으로 잇는다.
    ang: 팔뼈 방향(도, -90 = 위). 손가락은 팔뼈 기준 바깥(반시계)에서 안쪽(시계)으로 편다."""
    k = 0.78 if far else 1.0
    wrist = polar(sh, ang, span * 0.40 * k)
    fingers = [polar(wrist, ang + d, span * L * k) for d, L in ((-62, 0.62), (-18, 0.74), (34, 0.66))]
    body = add(sh, (1, 10))
    fingers.sort(key=lambda f: -math.hypot(f[0] - body[0], f[1] - body[1]))
    # 막: 어깨 → 손목 → 손가락 끝들(사이를 안쪽으로 오목하게) → 몸 옆
    pts = [sh, wrist, fingers[0]]
    for a, b in ((fingers[0], fingers[1]), (fingers[1], fingers[2]), (fingers[2], body)):
        m = lerp(a, b, 0.5)
        pts.append(lerp(m, wrist, 0.22))
        pts.append(b)
    ramp = MEM_FAR if far else MEM
    cv.part(poly(cv.blank(), pts), ramp, gloss=False)
    bone = INK if far else BONE
    cv.line4([sh, wrist], bone)
    for f in fingers:
        cv.line4([wrist, f], bone)
    claw = polar(wrist, ang - 100, 2.5)
    cv.line4([wrist, claw], BONE if far else EAR_IN)
    return wrist


def head(cv, c, tilt=0, mouth=0, eye="open"):
    def r(dx, dy):
        a = math.radians(tilt)
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    for base, tip in (((-3, -3), (-6, -13)), ((1, -4), (2, -14))):
        e = [r(base[0] - 2.5, base[1] + 1), r(*tip), r(base[0] + 2.5, base[1] + 1)]
        cv.part(poly(cv.blank(), e), FUR, gloss=False)
        cv.line4([r(base[0], base[1]), r(tip[0] + (1 if tip[0] > base[0] else 1), tip[1] + 4)], EAR_IN)
    cv.part(ellipse(cv.blank(), c, 6.0, 5.5), FUR)
    snout = [r(3, -2), r(9, 0), r(8, 3), r(3, 4)]
    cv.part(poly(cv.blank(), snout), FUR)
    cv.pixel(*rnd(r(8, 0)), INK)
    if mouth:
        m = [r(3, 2), r(9, 2 + mouth * 0.2), r(7, 3 + mouth), r(3, 4)]
        cv.put(poly(cv.blank(), m), MOUTH)
        cv.line([r(4, 3 + mouth), r(7, 3 + mouth)], INK)
    for fx in (5, 7):
        cv.line([r(fx, 3), r(fx, 5 + (1 if mouth else 0))], FANG)
    e = r(2, -1)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (2, 1))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE)
        cv.pixel(*rnd(add(e, (1, -1))), EYE_HI)
    return r(10, 2)


def feet(cv, hip, d):
    for i, dx in enumerate((-1, 2)):
        h = add(hip, (dx, 0))
        k = add(h, (d[0] - 1, d[1] - 1))
        f = add(h, d)
        cv.part(chain([h, k], [2, 2]), FUR, gloss=False)
        cv.line4([k, f], BONE)
        cv.pixel(*rnd(add(f, (1, 0))), FANG)


BASE = dict(c=(31.0, 34.0), tilt=0, wing=-110, mouth=0, eye="open", feet=(0, 7))


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 내리쳐 몸이 뜬다
        p.update(c=(31.0, 32.0), wing=-160, feet=(-1, 7))
    elif name == "idle_c":  # 날개를 가장 낮게, 몸이 가라앉는다
        p.update(c=(31.0, 36.0), wing=-200, feet=(1, 7))
    elif name == "windup":  # 몸을 뒤로 젖히고 날개를 높이 펴 입을 벌린다
        p.update(c=(27.0, 34.0), tilt=-12, wing=-90, mouth=3, feet=(-2, 6))
    elif name == "move":  # 날개를 뒤로 접고 머리부터 내리꽂는다
        p.update(c=(36.0, 37.0), tilt=18, wing=-175, feet=(-5, 4))
    elif name == "attack":  # 송곳니로 물어뜯는다
        p.update(c=(36.0, 36.0), tilt=12, wing=-130, mouth=5, feet=(3, 6))
    elif name == "recover":  # 스킬 음파: 머리를 들고 입을 찢어지게 벌린다
        p.update(c=(28.0, 34.0), tilt=-6, wing=-80, mouth=6, feet=(-1, 7))
    elif name == "hit":  # 맞고 뒤로 튕기며 날개가 구겨진다
        p.update(c=(27.0, 36.0), tilt=-24, wing=-215, eye="shut", mouth=2, feet=(3, 6))
    return p


def draw_bat(cv, P):
    c, tilt = P["c"], P["tilt"]
    sh = add(c, (-2, -4))
    wing(cv, add(sh, (4, -1)), P["wing"] + 62, far=True)
    feet(cv, add(c, (-1, 6)), P["feet"])
    cv.part(ellipse(cv.blank(), c, 6.0, 8.0), FUR)
    for dx, dy in ((-2, -4), (1, -5), (-3, 0), (2, 1)):
        cv.pixel(c[0] + dx, c[1] + dy, FUR[3])
    mouth_pt = head(cv, add(c, (5, -8)), tilt, P["mouth"], P["eye"])
    wing(cv, sh, P["wing"])
    return dict(mouth=mouth_pt, head=add(c, (5, -8)))


def draw_dead(cv):
    """바닥에 엎어져 막 날개가 양쪽으로 축 늘어진 모습."""
    for pts, ramp in (([(30, 56), (12, 50), (6, 57), (11, 58), (17, 56), (22, 59), (30, 59)], MEM_FAR),):
        cv.part(poly(cv.blank(), pts), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), (32, 56), 7.0, 4.0), FUR)
    cv.part(poly(cv.blank(), [(37, 52), (41, 47), (40, 53)]), FUR, gloss=False)
    cv.part(ellipse(cv.blank(), (41, 56), 4.5, 3.5), FUR)
    cv.line([(41, 55), (43, 57)], INK)
    cv.line([(43, 55), (41, 57)], INK)
    cv.line([(45, 57), (45, 59)], FANG)
    pts = [(31, 56), (44, 51), (54, 56), (50, 58), (46, 57), (42, 59), (32, 59)]
    cv.part(poly(cv.blank(), pts), MEM, gloss=False)
    for f in ((54, 56), (46, 57)):
        cv.line4([(44, 51), f], BONE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 14, (22, 28, 34), MEM[2])
    j = draw_bat(cv, P)
    m = j["mouth"]
    if name == "attack":
        slash(cv, add(m, (-2, -7)), add(m, (6, 8)), 3, 3.0, SONIC[2], WHITE)
        slash(cv, add(m, (3, -8)), add(m, (10, 6)), 3, 2.4, SONIC[1], SONIC[3])
    elif name == "recover":
        for k, r in enumerate((5, 9, 13, 17)):
            ring(cv, add(m, (-2, 0)), r, -38 + k * 3, 38 - k * 3, SONIC[2] if k % 2 == 0 else SONIC[1], 2 if k < 2 else 1)
        burst(cv, add(m, (1, 0)), 3.5, SONIC[2], SONIC[3], spikes=5, rot=0)
        sparkle(cv, add(m, (14, -12)), SONIC[3], SONIC[2])
        sparkle(cv, add(m, (16, 11)), SONIC[3], SONIC[2], big=True)
    elif name == "windup":
        ring(cv, add(m, (-1, 0)), 4, -40, 40, SONIC[1], 1)
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((8, -8), (10, -5), (9, -11), (11, -2)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bat-vampire", draw, sys.argv[1:], idle_ms=120)
