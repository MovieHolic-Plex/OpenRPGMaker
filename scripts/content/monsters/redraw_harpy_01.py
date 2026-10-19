#!/usr/bin/env python3
"""청회색 날개 하피(harpy-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

절벽 하피(harpy-cliff, 작게 웅크려 나는 보라 몸)와 다른 윤곽: 땅을 디디고 선 키 큰 하피. 사람 상체(창백한 피부,
가슴을 덮는 청회색 깃털 띠)에 팔 자체가 날개(어깨에서 손끝까지 긴 깃이 아래로 늘어짐), 허리 아래 깃털 치마,
무릎이 뒤로 꺾인 새 다리와 노란 비늘 정강이·검은 갈고리 발톱. 긴 갈색 머리칼이 뒤로 흩날리고
얼굴(옆얼굴)에 날카로운 노란 눈 하나, 매부리코.
6번 칸(스킬 깃털 폭풍): 두 날개를 앞으로 크게 쳐서 칼날 같은 깃털 다섯 개를 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_harpy_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, ik_side, lerp, polar, poly, rnd, run, slash, sparkle, speed_lines

INK = (24, 26, 36)
SKIN = [(196, 160, 140), (226, 196, 176), (244, 222, 206), (250, 236, 224)]
FEATH = [(66, 84, 104), (98, 122, 146), (136, 160, 182), (178, 198, 214)]
FEATH_FAR = [(50, 64, 82), (66, 84, 104), (78, 98, 120), (78, 98, 120)]
HAIR = [(70, 40, 24), (104, 62, 36), (136, 88, 54), (136, 88, 54)]
SCALE = [(180, 140, 40), (226, 186, 70), (246, 216, 120), (246, 216, 120)]
CLAW = (30, 26, 30)
EYE = (250, 210, 40)
LIP = (170, 80, 80)
WIND = [(170, 200, 220), (220, 236, 246), (255, 255, 255)]
WHITE = (255, 255, 255)
G = 60


def wing_arm(cv, sh, ang, span, far, fold=0.0):
    """팔 = 날개: 어깨→팔꿈치→손. 앞 가장자리 아래로 긴 깃 다섯."""
    ramp = FEATH_FAR if far else FEATH
    el = polar(sh, ang, span * 0.45)
    hand = polar(el, ang + 20 - fold * 60, span * 0.5)
    down = ang - 90  # 팔 뒤쪽(아래·뒤)으로 늘어지는 깃
    feathers = []
    for k in range(6):
        p = lerp(hand, sh, k / 5.5)
        feathers.append(polar(p, down - 25 + k * 6, span * (0.62 - k * 0.07)))
    pts = [sh, el, hand] + feathers + [add(sh, (0, 3))]
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    for f in feathers[::2]:
        cv.line4([rnd(lerp(el, hand, 0.4)), rnd(f)], ramp[0])
    cv.part(chain([sh, el, hand], [3.4, 3.0, 2.4]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.4, 1.4), [SKIN[0]] * 4 if far else SKIN, ink=INK, gloss=False)
    return hand


def leg(cv, hip, foot, far, grab=0.0):
    ramp = FEATH_FAR if far else FEATH
    hock = add(foot, (-3, -7))
    knee = ik_side(hip, hock, 5, 5, forward=True)
    cv.part(chain([hip, knee], [5, 4]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, hock, foot], [2.4, 2.0, 2.0]), SCALE, ink=INK, gloss=False)
    for a in (-10 - grab * 40, 30, 150):
        cv.line4([rnd(foot), rnd(polar(foot, a, 3))], CLAW)


def head(cv, c, tilt=0, mouth=0, eye="open", hair=0):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뒤로 흩날리는 머리칼(먼저)
    hp = bezier(R(-2, -3), R(-9, -2 + hair), R(-14, 6 + hair), 5)
    cv.part(chain(hp, [6, 6, 5.4, 4.6, 3.6, 2.4]), HAIR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(-4, 3), R(-4, -3), R(-1, -5), R(3, -4), R(5, -1), R(6, 1), R(5, 3), R(4, 5), R(0, 5)]), SKIN, ink=INK)
    cv.pixel(*rnd(R(6, 1)), SKIN[0])  # 매부리코 끝
    cv.part(poly(cv.blank(), [R(-4, -3), R(-1, -6), R(4, -5), R(3, -3), R(-2, -2)]), HAIR, ink=INK, gloss=False)  # 앞머리
    if mouth:
        cv.line([rnd(R(3, 3)), rnd(R(5, 3 + mouth * 0.5))], (90, 30, 40))
    else:
        cv.pixel(*rnd(R(4, 3)), LIP)
    e = rnd(R(2, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], INK)
        cv.pixel(e[0], e[1] - 1, INK)
    return dict(eye=e)


def harpy(cv, hip=(30, 40), lean=8, tilt=0, wn=(-170, 30), wf=(-155, 20), fold=(0, 0), feet=((34, 60), (24, 60)), mouth=0, eye="open", hair=0, grab=0.0):
    chest = polar(hip, -90 + lean, 11)
    sh = add(chest, (0, 1))
    wing_arm(cv, add(sh, (-2, -1)), wf[0], 26, True, fold[1])
    leg(cv, add(hip, (-2, 2)), feet[1], True)
    # 깃털 치마
    sk = [add(hip, (-6, -2)), add(hip, (5, -2)), add(hip, (7, 6)), add(hip, (3, 4)), add(hip, (0, 8)), add(hip, (-3, 4)), add(hip, (-8, 7))]
    cv.part(poly(cv.blank(), sk), FEATH, ink=INK, gloss=False)
    # 상체(피부) + 가슴 깃털 띠
    body = [add(hip, (-4, -1)), add(hip, (4, -1)), add(chest, (4, 2)), add(chest, (3, -2)), add(chest, (-3, -2)), add(chest, (-4, 2))]
    cv.part(poly(cv.blank(), body), SKIN, ink=INK)
    cv.part(poly(cv.blank(), [add(chest, (-4, 1)), add(chest, (4, 1)), add(chest, (4, 5)), add(chest, (-4, 5))]), FEATH, ink=INK, gloss=False)
    leg(cv, add(hip, (2, 2)), feet[0], False, grab)
    hand = wing_arm(cv, sh, wn[0], 28, False, fold[0])
    j = head(cv, polar(chest, -90 + lean * 1.2, 6), tilt, mouth, eye, hair)
    j["hand"] = hand
    j["foot"] = feet[0]
    return j


def draw_dead(cv):
    cv.part(poly(cv.blank(), [(6, 59), (12, 50), (30, 52), (28, 59)]), FEATH_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(24, 59), (26, 52), (40, 51), (44, 59)]), FEATH, ink=INK)
    cv.part(chain([(18, 57), (10, 58)], [2, 2]), SCALE, ink=INK, gloss=False)
    cv.part(chain(bezier((44, 54), (52, 50), (58, 56), 4), [5, 5, 4, 3, 2]), HAIR, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), (47, 55), 4, 3.6), SKIN, ink=INK)
    cv.line([(46, 54), (48, 56)], INK)
    cv.line([(48, 54), (46, 56)], INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        harpy(cv)
    elif name == "idle_b":
        harpy(cv, hip=(30, 41), wn=(-150, 0), wf=(-135, 0), tilt=4, hair=2)
    elif name == "idle_c":
        harpy(cv, wn=(175, 0), wf=(-170, 0), fold=(0.3, 0.3), tilt=-4, hair=-1)
    elif name == "windup":  # 날개를 머리 위로 크게 치켜 올린다
        j = harpy(cv, hip=(30, 40), lean=-6, tilt=-10, wn=(-125, 0), wf=(-110, 0), mouth=2, hair=3)
        sparkle(cv, add(j["eye"], (4, -6)), WHITE, EYE)
    elif name == "move":  # 날개를 펴고 낮게 활공하며 발톱을 앞으로
        speed_lines(cv, 1, 8, (26, 32, 40), FEATH[2])
        harpy(cv, hip=(31, 36), lean=30, tilt=14, wn=(-170, 0), wf=(-160, 0), fold=(0.2, 0.2), feet=((44, 50), (36, 52)), hair=6, grab=0.5)
    elif name == "attack":  # 발톱 할퀴기
        j = harpy(cv, hip=(30, 36), lean=-12, tilt=-6, wn=(-140, 0), wf=(-125, 0), feet=((47, 44), (30, 56)), mouth=3, hair=3, grab=1.0)
        for dx in (0, 4, 8):
            slash(cv, add(j["foot"], (dx - 1, -7)), add(j["foot"], (dx + 3, 7)), 2, 2.0, WIND[1], WHITE)
    elif name == "recover":  # 스킬: 깃털 폭풍
        j = harpy(cv, hip=(24, 40), lean=14, tilt=6, wn=(-30, 0), wf=(-50, 0), fold=(0.6, 0.6), mouth=4, hair=5)
        for k, (x, y) in enumerate(((44, 20), (52, 27), (46, 34), (56, 38), (49, 45))):
            a = 8 + k * 6
            tip = polar((x, y), a, 4)
            tail_ = polar((x, y), a + 180, 4)
            cv.part(chain([tail_, (x, y), tip], [1.4, 2.4, 0.8]), FEATH, ink=INK, gloss=False)
            cv.line([polar(tail_, a + 180, 1), polar(tail_, a + 180, 5)], WIND[0])
        sparkle(cv, (58, 20), WHITE, WIND[1], big=True)
    elif name == "hit":
        j = harpy(cv, hip=(25, 41), lean=-18, tilt=-24, wn=(-150, 0), wf=(170, 0), fold=(0.5, 0.2), feet=((31, 60), (22, 59)), eye="shut", hair=-3)
        e = j["eye"]
        for dx, dy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("harpy-01", draw, sys.argv[1:], idle_ms=180)
