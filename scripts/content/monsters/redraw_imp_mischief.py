#!/usr/bin/env python3
"""붉은 꼬마 악마(imp-mischief) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

공중에 떠 있는 작은 악마: 몸보다 큰 둥근 머리에 뒤로 휜 검은 뿔 두 개, 뾰족한 긴 귀, 장난스러운 큰 웃음
(이빨 두 개), 머리 안의 노란 눈. 붉은 피부에 볼록 배, 가는 팔다리, 등 뒤 박쥐 날개(막 사이 뼈),
끝이 화살촉인 긴 꼬리. 손에는 작은 세 갈래 쇠스랑.
6번 칸(스킬 장난 불꽃): 쇠스랑을 치켜들고 깔깔 웃으며 아군 쪽으로 보라 불꽃 구슬 셋을 흩뿌린다.

  python3 scripts/content/monsters/redraw_imp_mischief.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, flame, lerp, polar, poly, rnd, run, sparkle, speed_lines

INK = (40, 10, 14)
SKIN = [(150, 30, 34), (196, 52, 50), (232, 92, 76), (250, 140, 118)]
SKIN_FAR = [(110, 22, 28), (150, 30, 34), (170, 40, 42), (170, 40, 42)]
WING = [(70, 22, 40), (104, 34, 56), (136, 52, 74), (136, 52, 74)]
HORN = [(30, 24, 30), (60, 50, 60), (96, 86, 96), (130, 120, 130)]
FORK = [(90, 90, 100), (150, 150, 160), (200, 200, 210), (230, 230, 240)]
EYE = (255, 230, 70)
TOOTH = (250, 246, 230)
FIRE = [(110, 40, 160), (180, 90, 230), (240, 200, 255)]
WHITE = (255, 250, 240)


def wing(cv, root, spread, far):
    """박쥐 날개: root 에서 뒤 위로 뻗은 뼈 셋 사이 막."""
    ramp = [WING[0]] * 4 if far else WING
    tips = [polar(root, a, l) for a, l in ((-140 + spread, 17), (-165 + spread * 0.6, 18), (170 + spread * 0.3, 13))]
    pts = [root, tips[0]]
    for a, b in zip(tips, tips[1:]):
        pts += [lerp(a, b, 0.5) if False else add(lerp(a, b, 0.5), (3, 1)), b]
    pts.append(add(root, (-2, 3)))
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    for t in tips:
        cv.line4([rnd(root), rnd(t)], HORN[1] if not far else WING[1])


def fork(cv, hand, ang):
    tip = polar(hand, ang, 13)
    butt = polar(hand, ang + 180, 4)
    cv.line4([rnd(butt), rnd(tip)], FORK[1])
    for da in (-90, 90):
        side = polar(tip, ang + da, 2)
        cv.line4([rnd(side), rnd(polar(side, ang, 3))], FORK[2])
    cv.line4([rnd(polar(tip, ang + 90, 2)), rnd(polar(tip, ang - 90, 2))], FORK[1])
    cv.line4([rnd(tip), rnd(polar(tip, ang, 4))], FORK[3])
    return polar(tip, ang, 4)


def head(cv, c, tilt=0, grin=1, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뒤로 휜 뿔(먼 뿔 먼저)
    cv.part(chain([R(-1, -5), R(-4, -9), R(-8, -10)], [2.6, 2.0, 1.0]), HORN, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), c, 7, 6.5), SKIN, ink=INK)
    cv.part(chain([R(2, -5), R(0, -10), R(-4, -12)], [3.0, 2.2, 1.0]), HORN, ink=INK, gloss=False)
    # 뾰족 귀(뒤)
    cv.part(poly(cv.blank(), [R(-5, -1), R(-12, -3), R(-5, 2)]), SKIN, ink=INK, gloss=False)
    # 큰 웃음
    if grin:
        m = [R(1, 3), R(6, 2), R(5, 4 + grin), R(2, 4 + grin * 0.5)]
        cv.put(poly(cv.blank(), m), (70, 10, 20))
        cv.pixel(*rnd(R(3, 3)), TOOTH)
        cv.pixel(*rnd(R(5, 3)), TOOTH)
    e = rnd(R(3, -2))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, -1))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(e[0] + 1, e[1], INK)
    cv.pixel(*rnd(R(7, 0)), SKIN[0])  # 코끝
    return dict(eye=e, mouth=R(6, 3))


def imp(cv, c=(30, 30), wing_up=0, tilt=0, grin=1, eye="open", arm_ang=(40, 60), fork_ang=-70, legs=(70, 110), tail_lift=0):
    body = add(c, (0, 9))
    wing(cv, add(body, (-2, -4)), wing_up - 10, True)
    # 꼬리: 엉덩이에서 아래 뒤로 S 자, 끝 화살촉
    tp = bezier(add(body, (-3, 4)), add(body, (-14, 12 - tail_lift)), add(body, (-12, -2 - tail_lift)), 7)
    cv.part(chain(tp, [2.2, 2, 2, 1.8, 1.8, 1.6, 1.6, 1.4]), SKIN, ink=INK, gloss=False)
    e = tp[-1]
    cv.part(poly(cv.blank(), [add(e, (-2, 1)), add(e, (0, -3)), add(e, (2, 1))]), SKIN, ink=INK, gloss=False)
    # 먼 다리
    hipf = add(body, (-1, 4))
    cv.part(chain([hipf, polar(hipf, legs[1], 5), add(polar(hipf, legs[1], 5), (2, 4))], [2.4, 2, 1.8]), SKIN_FAR, ink=INK, gloss=False)
    # 먼 팔
    shf = add(body, (-1, -3))
    cv.part(chain([shf, polar(shf, 140, 5)], [2.2, 1.8]), SKIN_FAR, ink=INK, gloss=False)
    # 볼록 배 몸통
    M = cv.part(ellipse(cv.blank(), body, 5, 6), SKIN, ink=INK)
    cv.put(ellipse(cv.blank(), add(body, (2, 1)), 2.5, 3.5), SKIN[2])
    # 가까운 다리
    hipn = add(body, (2, 4))
    kn = polar(hipn, legs[0], 5)
    cv.part(chain([hipn, kn, add(kn, (3, 3))], [2.6, 2.2, 1.8]), SKIN, ink=INK, gloss=False)
    wing(cv, add(body, (-1, -4)), wing_up, False)
    j = head(cv, c, tilt, grin, eye)
    # 가까운 팔 + 쇠스랑
    sh = add(body, (2, -3))
    el = polar(sh, arm_ang[0], 4.5)
    hand = polar(el, arm_ang[1], 4.0)
    j["fork"] = fork(cv, hand, fork_ang)
    cv.part(chain([sh, el, hand], [2.6, 2.2, 2.0]), SKIN, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.6, 1.6), SKIN, ink=INK, gloss=False)
    j["hand"] = hand
    return j


def draw_dead(cv):
    cv.part(poly(cv.blank(), [(6, 59), (14, 52), (22, 56), (26, 59)]), WING, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (26, 55), 6, 4), SKIN, ink=INK)
    cv.part(chain([(18, 58), (10, 58), (6, 55)], [2, 1.8, 1.4]), SKIN, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (37, 54), 6, 5), SKIN, ink=INK)
    cv.part(chain([(36, 49), (33, 45), (30, 44)], [2.4, 1.8, 1]), HORN, ink=INK, gloss=False)
    cv.line([(38, 52), (40, 54)], INK)
    cv.line([(40, 52), (38, 54)], INK)
    cv.line4([(44, 58), (56, 56)], FORK[1])
    cv.line4([(56, 54), (56, 58)], FORK[2])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        imp(cv)
    elif name == "idle_b":
        imp(cv, c=(30, 28), wing_up=25, tilt=4, legs=(80, 120), tail_lift=2)
    elif name == "idle_c":
        imp(cv, c=(30, 31), wing_up=-12, tilt=-4, grin=2, arm_ang=(30, 50), fork_ang=-60, tail_lift=-1)
    elif name == "windup":  # 쇠스랑을 뒤로 젖혀 찌를 준비
        j = imp(cv, c=(29, 28), wing_up=30, tilt=-8, grin=2, arm_ang=(-120, -140), fork_ang=-110, legs=(100, 130))
        sparkle(cv, add(j["fork"], (0, -2)), WHITE, EYE)
    elif name == "move":  # 앞으로 활강
        speed_lines(cv, 1, 9, (24, 30, 40), SKIN[2])
        imp(cv, c=(36, 30), wing_up=-25, tilt=14, grin=2, arm_ang=(10, 0), fork_ang=0, legs=(150, 165), tail_lift=6)
    elif name == "attack":  # 쇠스랑 찌르기
        j = imp(cv, c=(32, 30), wing_up=10, tilt=10, grin=3, arm_ang=(0, 0), fork_ang=0, legs=(120, 150))
        burst(cv, add(j["fork"], (1, 0)), 4.0, (255, 220, 160), WHITE, spikes=6)
    elif name == "recover":  # 스킬: 치켜든 쇠스랑에서 보라 불꽃 구슬 셋
        j = imp(cv, c=(28, 32), wing_up=35, tilt=-14, grin=4, arm_ang=(-60, -90), fork_ang=-80, legs=(60, 100), tail_lift=3)
        f = j["fork"]
        for p, s in ((add(f, (8, 2)), 1.0), (add(f, (15, 10)), 0.85), (add(f, (21, 20)), 0.7)):
            if p[0] < 61:
                flame(cv, add(p, (0, 3)), 8 * s, 6 * s, FIRE, lean=0.4, tongues=2)
        sparkle(cv, add(f, (0, -2)), WHITE, FIRE[1], big=True)
    elif name == "hit":
        j = imp(cv, c=(28, 30), wing_up=-30, tilt=-22, grin=0, eye="shut", arm_ang=(110, 140), fork_ang=160, legs=(40, 80), tail_lift=-2)
        e = j["eye"]
        for dx, dy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("imp-mischief", draw, sys.argv[1:], idle_ms=160)
