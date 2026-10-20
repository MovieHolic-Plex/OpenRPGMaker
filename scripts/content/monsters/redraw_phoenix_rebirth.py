#!/usr/bin/env python3
"""불새(phoenix-rebirth) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

공중에 떠 있는 큰 불새: 매 날개 관절(redraw_bird_hawk.wing)을 96 칸 길이로 쓰되 깃을 주홍→금빛으로 칠하고 끝 깃에 불꽃,
가늘고 긴 목과 작은 머리(금빛 부리, 머리 안의 흰 눈, 뒤로 휘날리는 불꽃 볏 셋), 붉은 가슴,
몸 뒤로 길게 늘어진 공작 같은 꼬리 깃 셋(끝에 눈알 불꽃), 다리는 접어 몸 아래에.
6번 칸(스킬 환생의 불길): 날개를 위로 활짝 펴 몸 전체가 금빛으로 타오르고, 불꽃 깃털 비가 아군 쪽으로 쏟아진다.

  python3 scripts/content/monsters/redraw_phoenix_rebirth.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import redraw_bird_hawk as H
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, flame, glow, lerp, polar, poly, rnd, run, sparkle, speed_lines

S = 96
INK = (50, 14, 6)
H.INK = INK
H.BACK = [(180, 40, 20), (226, 80, 30), (250, 140, 50), (255, 200, 110)]
H.BACK_FAR = [(130, 26, 14), (170, 40, 20), (196, 56, 24), (196, 56, 24)]
H.TIP = (255, 230, 120)
BODY = [(170, 30, 20), (214, 60, 30), (246, 110, 50), (255, 170, 90)]
GOLD = [(200, 140, 30), (240, 190, 60), (255, 230, 120), (255, 250, 200)]
FIRE = [(230, 80, 20), (255, 170, 40), (255, 240, 160)]
EYE = (255, 255, 240)
WHITE = (255, 255, 240)


def plume(cv, root, ctrl, end, w=3.0):
    pts = bezier(root, ctrl, end, 8)
    cv.part(chain(pts, [w, w, w * 0.9, w * 0.8, w * 0.7, w * 0.6, w * 0.6, w * 0.7, w]), GOLD, ink=INK, gloss=False)
    glow(cv, end, 3.4, [FIRE[0], FIRE[1], FIRE[2]])


def phoenix(cv, c=(46, 44), wing=-110, wing_far=-85, tilt=0, beak=0, eye="open", tail=0, fold=0.0, blaze=False):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    H.wing(cv, R(2, -5), wing_far, 40, far=True, fold=fold)
    # 꼬리 깃 셋(뒤로 길게, 아래로 처짐)
    for k, (dy, dd) in enumerate(((-2, -8), (2, 4), (5, 14))):
        plume(cv, R(-10, dy), R(-26, dy + 8 + tail), (max(6, c[0] - 38 - k * 2), min(86, c[1] + 18 + dd + tail)), 3.2 - k * 0.4)
    # 몸통
    cv.part(poly(cv.blank(), [R(-12, 0), R(-4, -8), R(8, -8), R(13, -2), R(8, 7), R(-4, 8)]), BODY, ink=INK)
    cv.put(poly(cv.blank(), [R(4, -4), R(11, -1), R(7, 5), R(0, 6)]), GOLD[1])
    # 접은 다리
    cv.part(chain([R(0, 7), R(4, 12), R(8, 12)], [2.4, 2, 1.6]), GOLD, ink=INK, gloss=False)
    # 목 + 머리
    nb, hc = R(9, -6), R(18, -16)
    cv.part(chain([nb, lerp(nb, hc, 0.5), hc], [6, 4.6, 4]), BODY, ink=INK, gloss=False)
    for k, ang in enumerate((-150, -170, 170)):  # 불꽃 볏
        base = add(hc, (-2, -2 + k))
        tip = polar(base, ang + tilt, 9 + k * 2)
        cv.part(chain([base, lerp(base, tip, 0.5), tip], [3, 2, 0.8]), [FIRE[0], FIRE[1], FIRE[2], FIRE[2]], ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hc, 4.6, 4.2), BODY, ink=INK)
    bh = polar(hc, tilt, 3)
    upper = [polar(bh, tilt - 60, 2), polar(bh, tilt, 7), polar(polar(bh, tilt, 7), tilt + 110, 2), polar(bh, tilt + 70, 1.5)]
    cv.part(poly(cv.blank(), upper), GOLD, ink=INK, gloss=False)
    if beak:
        cv.part(poly(cv.blank(), [polar(bh, tilt + 70, 1.5), polar(bh, tilt + 25, 5), polar(bh, tilt + 90, 2.5 + beak)]), GOLD, ink=INK, gloss=False)
    e = rnd(polar(hc, tilt - 60, 1.6))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [e, add(e, (1, 0)), add(e, (1, 1)), add(e, (0, 1))]), EYE)
        cv.pixel(e[0] + 1, e[1] + 1, INK)
    tip, _ = H.wing(cv, R(0, -6), wing, 44, fold=fold)
    if blaze:
        for p in (R(0, -14), R(-8, -4), tip):
            flame(cv, add(p, (0, 2)), 8, 6, FIRE, tongues=2)
    return dict(eye=e, beak=polar(bh, tilt, 8), tip=tip, chest=R(6, 0))


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":  # 재가 되어 바닥의 잿불 더미(환생 직전 불씨 하나)
        for c, r in (((36, 88), 9), ((52, 87), 11), ((66, 89), 7)):
            cv.part(ellipse(cv.blank(), c, r, r * 0.45), [(60, 50, 46), (90, 80, 74), (120, 110, 100), (140, 130, 120)], ink=INK, gloss=False)
        for p in ((40, 84), (55, 82), (62, 86)):
            cv.put(ellipse(cv.blank(), p, 1.4, 1.0), FIRE[1])
        flame(cv, (52, 84), 10, 6, FIRE, tongues=1)
        plume(cv, (66, 88), (76, 86), (84, 90), 2.4)
        return cv.image()
    if name == "idle_a":
        phoenix(cv)
    elif name == "idle_b":
        phoenix(cv, c=(46, 40), wing=120, wing_far=100, fold=0.2, tail=3)
    elif name == "idle_c":
        phoenix(cv, c=(46, 46), wing=-70, wing_far=-50, tilt=-6, beak=1, tail=-3)
    elif name == "windup":
        j = phoenix(cv, c=(42, 44), wing=-140, wing_far=-118, tilt=-18, beak=3, tail=5)
        glow(cv, j["chest"], 5, FIRE)
        sparkle(cv, add(j["beak"], (2, -6)), WHITE, FIRE[1], big=True)
    elif name == "move":
        speed_lines(cv, 2, 14, (30, 40, 50, 60), FIRE[1])
        phoenix(cv, c=(56, 44), wing=-170, wing_far=-160, tilt=14, fold=0.8, tail=6)
    elif name == "attack":
        j = phoenix(cv, c=(52, 46), wing=-130, wing_far=-105, tilt=12, beak=4, tail=2)
        burst(cv, add(j["beak"], (4, 1)), 6, FIRE[1], FIRE[2], spikes=7)
    elif name == "recover":  # 스킬: 환생의 불길
        j = phoenix(cv, c=(40, 46), wing=-80, wing_far=-60, tilt=-4, beak=4, tail=4, blaze=True)
        for k, p in enumerate(((68, 30), (78, 44), (88, 34), (74, 60), (86, 66), (66, 74), (90, 54))):
            a = 30 + k * 7
            cv.part(chain([polar(p, a + 180, 5), p, polar(p, a, 3)], [1.4, 2.6, 0.8]), GOLD, ink=INK, gloss=False)
            glow(cv, polar(p, a, 3), 1.8, [FIRE[1], FIRE[2]])
    elif name == "hit":
        j = phoenix(cv, c=(40, 42), wing=-170, wing_far=-40, tilt=-28, beak=2, eye="shut", tail=-5, fold=0.5)
        e = j["eye"]
        for dx, dy in ((5, -10), (9, -7), (8, -13)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("phoenix-rebirth", draw, sys.argv[1:], S=S, idle_ms=160)
