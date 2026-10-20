#!/usr/bin/env python3
"""청록 새끼용(dragon-whelp) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

96 칸 거룡(dragon_rig.py)의 축소판이 아닌 아기 비율: 뒷다리로 엉덩방아 찧듯 앉은 통통한 몸, 몸만 한 둥근 머리,
짧은 주둥이와 아직 뭉툭한 뿔 두 개, 머리 안의 크고 둥근 금빛 눈, 연노랑 배 비늘판, 등의 작은 가시 줄,
몸에 비해 작은 박쥐 날개(파닥임), 짧은 앞발, 끝이 화살촉인 굵은 꼬리.
6번 칸(스킬 아기 불꽃): 볼을 부풀렸다가 고개를 내밀어 짧고 동그란 불꽃 덩어리를 아군 쪽으로 뿜는다.

  python3 scripts/content/monsters/redraw_dragon_whelp.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, flame, glow, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (10, 34, 34)
SCALE = [(30, 110, 110), (46, 152, 146), (86, 196, 180), (160, 230, 210)]
FAR = [(22, 80, 82), (30, 110, 110), (38, 126, 124), (38, 126, 124)]
BELLY = [(210, 196, 110), (240, 226, 150), (252, 244, 196), (252, 244, 196)]
MEMB = [(40, 90, 110), (60, 124, 140), (90, 160, 170), (90, 160, 170)]
HORN = [(180, 160, 110), (220, 204, 150), (246, 236, 200), (246, 236, 200)]
EYE = (250, 200, 50)
MOUTH = (110, 30, 30)
FIRE = [(230, 90, 20), (255, 170, 40), (255, 240, 150)]
DUST = [(100, 96, 84), (140, 136, 120)]
WHITE = (255, 255, 240)
G = 60


def wing(cv, root, ang, far):
    ramp = [MEMB[0]] * 4 if far else MEMB
    tips = [polar(root, ang - 25, 10), polar(root, ang, 13), polar(root, ang + 25, 9)]
    pts = [root, tips[0], add(lerp(tips[0], tips[1], 0.5), (2, 2)), tips[1], add(lerp(tips[1], tips[2], 0.5), (2, 2)), tips[2], add(root, (-1, 3))]
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    for t in tips:
        cv.line4([rnd(root), rnd(t)], SCALE[0] if not far else FAR[1])


def whelp(cv, x=26, y=0, wing_a=-130, tilt=0, jaw=0, eye="open", tail=0, cheeks=0.0, paw=(0, 0), lean=0):
    hip = (x, G - 8 + y)
    chest = (x + 7 + lean, G - 17 + y)
    wing(cv, add(chest, (-5, -4)), wing_a + 15, True)
    # 꼬리
    tp = bezier(add(hip, (-4, 3)), add(hip, (-14, 6 - tail)), add(hip, (-18, -6 - tail)), 6)
    cv.part(chain(tp, [6, 5, 4, 3.2, 2.6, 2, 1.4]), SCALE, ink=INK, belly=BELLY[1])
    e = tp[-1]
    cv.part(poly(cv.blank(), [add(e, (-3, 1)), add(e, (0, -4)), add(e, (3, 1))]), SCALE, ink=INK, gloss=False)
    # 먼 뒷발
    cv.part(ellipse(cv.blank(), (hip[0] - 2, G - 2), 4, 2.4), FAR, ink=INK, gloss=False)
    # 통통한 몸(앉은 자세: 엉덩이 크고 가슴 위로)
    cv.part(chain([hip, chest], [16, 12]), SCALE, ink=INK)
    cv.put(poly(cv.blank(), [add(hip, (5, 5)), add(chest, (5, 2)), add(chest, (2, -3)), add(hip, (1, 2))]), BELLY[1])
    for t in (0.3, 0.6):
        p = lerp(add(hip, (4, 4)), add(chest, (4, 0)), t)
        cv.line4([rnd(add(p, (-1, 0))), rnd(add(p, (2, 0)))], BELLY[0])
    for t in (0.1, 0.35, 0.6):  # 등 가시
        p = lerp(add(hip, (-6, -5)), add(chest, (-5, -5)), t)
        cv.part(poly(cv.blank(), [add(p, (-1, 1)), add(p, (0, -3)), add(p, (2, 1))]), HORN, ink=INK, gloss=False)
    # 가까운 뒷다리(굵은 허벅지 + 발)
    cv.part(ellipse(cv.blank(), add(hip, (2, 1)), 6, 5), SCALE, ink=INK)
    cv.part(ellipse(cv.blank(), (hip[0] + 5, G - 2), 4.4, 2.4), SCALE, ink=INK, gloss=False)
    wing(cv, add(chest, (-3, -5)), wing_a, False)
    # 큰 머리
    a = math.radians(tilt)
    hc = add(chest, (5, -9))
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    for b, t in (((-3, -6), (-8, -11)), ((0, -7), (-3, -13))):
        cv.part(chain([R(*b), R(*t)], [2.8, 1.4]), HORN, ink=INK, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(3, 2), R(11, 2), R(10, 3 + jaw), R(3, 4)]), MOUTH)
        cv.part(poly(cv.blank(), [R(1, 4), R(10, 3 + jaw), R(9, 5 + jaw), R(1, 6)]), SCALE, ink=INK, belly=BELLY[1])
    cv.part(ellipse(cv.blank(), hc, 7 + cheeks, 6.5 + cheeks * 0.6), SCALE, ink=INK, belly=BELLY[1])
    cv.part(poly(cv.blank(), [R(3, -3), R(11, -1), R(12, 2), R(4, 3)]), SCALE, ink=INK, gloss=False)  # 짧은 주둥이
    cv.pixel(*rnd(R(11, 0)), INK)
    e_ = rnd(R(2, -2))
    if eye == "shut":
        cv.line([add(e_, (-1, 0)), add(e_, (2, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e_, (-1, -2)), add(e_, (1, -2)), add(e_, (2, 0)), add(e_, (1, 1)), add(e_, (-1, 1))]), EYE)
        cv.put(poly(cv.blank(), [add(e_, (1, -1)), add(e_, (1, 0))]), INK)
        cv.pixel(e_[0] + 1, e_[1] - 1, INK)
        cv.pixel(e_[0] + 1, e_[1], INK)
        cv.pixel(e_[0] - 1, e_[1] - 2, WHITE)
    # 짧은 앞발
    sh = add(chest, (3, 2))
    hand = add(sh, (4 + paw[0], 5 + paw[1]))
    cv.part(chain([sh, hand], [3.4, 2.8]), SCALE, ink=INK, gloss=False)
    return dict(eye=e_, mouth=R(12, 2 + jaw * 0.5), hand=hand, horn=R(-3, -13))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        from PIL import Image
        cv2 = Canvas(64, INK)
        whelp(cv2, x=30, eye="shut", wing_a=-170, tilt=10)
        im = cv2.image().rotate(-90, resample=Image.NEAREST, center=(32, 40))
        bb = im.getbbox()
        out = Image.new("RGBA", (64, 64))
        out.alpha_composite(im, (32 - (bb[0] + bb[2]) // 2, G - bb[3]))
        return out
    if name == "idle_a":
        whelp(cv)
    elif name == "idle_b":
        whelp(cv, y=-1, wing_a=-95, tilt=-5, tail=3)
    elif name == "idle_c":
        whelp(cv, wing_a=-150, tilt=6, jaw=2, tail=-2)
    elif name == "windup":  # 볼을 부풀려 불을 머금는다
        j = whelp(cv, x=24, wing_a=-90, tilt=-14, cheeks=1.5, lean=-2, paw=(-2, -4))
        glow(cv, add(j["mouth"], (-3, 0)), 2.5, FIRE)
        sparkle(cv, add(j["horn"], (3, 0)), WHITE, FIRE[1])
    elif name == "move":  # 날개를 파닥이며 깡충 뛴다
        speed_lines(cv, 1, 7, (30, 38, 46), SCALE[2])
        whelp(cv, x=30, y=-5, wing_a=-100, tilt=8, tail=5, lean=2)
        puff(cv, (24, 58), 2.2, DUST)
    elif name == "attack":  # 머리를 내밀어 앙 문다
        j = whelp(cv, x=29, wing_a=-120, tilt=12, jaw=4, lean=3, paw=(4, -2))
        burst(cv, add(j["mouth"], (3, 0)), 4.0, (255, 230, 170), WHITE, spikes=6)
    elif name == "recover":  # 스킬: 아기 불꽃
        j = whelp(cv, x=22, wing_a=-100, tilt=4, jaw=5, lean=2, tail=4)
        m = j["mouth"]
        for k, (dx, r) in enumerate(((5, 3.0), (11, 4.2), (18, 5.0))):
            c = (min(m[0] + dx, 58), m[1] + 1)
            glow(cv, c, r, FIRE)
        cv.line([rnd(m), (54, int(m[1]) + 1)], FIRE[1], width=2)
    elif name == "hit":
        j = whelp(cv, x=24, wing_a=-170, tilt=-24, jaw=2, eye="shut", tail=-4, lean=-3)
        e = j["eye"]
        for dx, dy in ((4, -8), (7, -6), (6, -11)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("dragon-whelp", draw, sys.argv[1:], idle_ms=200)
