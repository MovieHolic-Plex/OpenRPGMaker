#!/usr/bin/env python3
"""갈색 그리핀(griffin-sky) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

앞은 독수리, 뒤는 사자: 흰 깃털 머리에 노란 갈고리 부리와 머리 안의 금빛 눈, 목·가슴의 크림 깃털 목도리,
노란 비늘 앞다리와 검은 갈고리 발톱, 등에서 솟은 큰 갈색 날개(끝 깃 짙음), 황갈색 사자 몸통·뒷다리(발톱 숨긴 둥근 발),
끝에 술이 달린 사자 꼬리. 뒷다리는 발굽 짐승 뼈대(ungulate_rig.py)의 비절 꺾임을 쓰고 발만 사자 발로 그린다.
6번 칸(스킬 하늘 강하): 날개를 활짝 펴 몸을 띄우고 날갯짓으로 바람 칼날 셋을 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_griffin_sky.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import ungulate_rig as U
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

S = 96
G = 92
INK = (30, 18, 10)
LION = [(140, 96, 48), (184, 134, 72), (214, 168, 104), (236, 200, 140)]
LION_FAR = [(104, 70, 34), (140, 96, 48), (156, 108, 56), (156, 108, 56)]
WINGC = [(90, 56, 30), (130, 86, 48), (170, 122, 76), (204, 162, 112)]
WING_FAR = [(66, 40, 22), (90, 56, 30), (104, 66, 36), (104, 66, 36)]
WHITE_F = [(196, 192, 184), (232, 230, 222), (250, 248, 242), (255, 255, 255)]
TALON = [(170, 130, 30), (220, 180, 60), (250, 220, 120), (250, 220, 120)]
TIP = (50, 30, 16)
EYE = (250, 200, 40)
WIND = [(170, 210, 230), (220, 240, 250), (255, 255, 255)]
DUST = [(140, 120, 96), (180, 164, 136)]
WHITE = (255, 255, 255)

B = U.Build(s=1.5, upper=8, lower=8, thigh=11, cannon=8, leg_w=3.2, belly=6.5)
L = U.Look(ramp=LION, far=LION_FAR, ink=INK, hoof=LION)


def paw(cv, foot, far):
    f = rnd(foot)
    cv.part(ellipse(cv.blank(), (f[0] + 2, f[1] - 2), 4, 2.6), LION_FAR if far else LION, ink=INK, gloss=False)


def wing(cv, root, ang, span, far):
    ramp = WING_FAR if far else WINGC
    wrist = polar(root, ang, span * 0.45)
    tip = polar(wrist, ang + 20, span * 0.6)
    feathers = []
    for k in range(6):
        base = lerp(tip, wrist, k / 6)
        feathers += [polar(base, ang + 70 + k * 10, span * (0.3 - k * 0.02)), lerp(tip, wrist, (k + 0.5) / 6)]
    pts = [root, wrist, tip] + feathers + [polar(root, ang + 100, span * 0.3)]
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    if not far:
        for k in range(0, 12, 2):
            cv.pixel(*rnd(feathers[k]), TIP)
        cv.line4([rnd(lerp(root, wrist, 0.3)), rnd(polar(wrist, ang + 100, span * 0.15))], WINGC[3])
    return tip


def talon_leg(cv, sh, foot, far, grab=0):
    ramp = [TALON[0]] * 4 if far else TALON
    knee = add(lerp(sh, foot, 0.5), (4, -2))
    cv.part(chain([sh, knee], [7, 5]), WHITE_F if not far else [WHITE_F[0]] * 4, ink=INK, gloss=False)  # 깃털 넓적다리
    cv.part(chain([knee, foot], [3.4, 3]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    for a in (-20 - grab * 40, 20, 160):
        cv.part(chain([f, polar(f, a, 5)], [2, 1]), [TIP] * 4, ink=INK, gloss=False)


def tail(cv, hip, sw):
    pts = bezier(add(hip, (-6, -2)), add(hip, (-20, 4 - sw)), add(hip, (-24, -16 - sw)), 7)
    cv.part(chain(pts, [3.4, 3, 2.8, 2.6, 2.4, 2.2, 2, 2]), LION, ink=INK, gloss=False)
    e = pts[-1]
    cv.part(ellipse(cv.blank(), e, 3, 4), [TIP, (80, 50, 26), (110, 70, 40), (110, 70, 40)], ink=INK, gloss=False)


def head(cv, c, tilt, beak=0, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 깃털 목도리 + 귀깃
    cv.part(poly(cv.blank(), [R(-10, 6), R(-12, -2), R(-8, -9), R(-14, -12), R(-4, -10), R(4, -9), R(6, 4), R(0, 10)]), WHITE_F, ink=INK)
    cv.part(ellipse(cv.blank(), c, 8, 7), WHITE_F, ink=INK)
    upper = [R(5, -5), R(13, -5), R(17, -1), R(16, 3), R(13, 1 + beak * 0.3), R(6, 1)]
    if beak:
        cv.put(poly(cv.blank(), [R(6, 1), R(14, 1), R(13, 2 + beak), R(6, 3)]), (110, 30, 30))
        cv.part(poly(cv.blank(), [R(6, 2), R(13, 2 + beak), R(11, 4 + beak), R(6, 4)]), TALON, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), upper), TALON, ink=INK, gloss=False)
    e = rnd(R(2, -3))
    cv.line4([add(e, (-3, -1)), add(e, (2, -2))], TIP)  # 눈썹뼈
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0] + 1, e[1], INK)
        cv.pixel(e[0] + 1, e[1] - 1, INK)
    return dict(eye=e, beak=R(17, 1))


def griffin(cv, P):
    hip, sh = P["hip"], P["sh"]
    wing(cv, add(sh, (-6, -8)), P["wf"], 42, True)
    talon_leg(cv, add(sh, (-2, 2)), P["front"][1], True)
    U.leg_hind(cv, B, L, add(hip, (-2, 2)), P["hind"][1], True)
    paw(cv, P["hind"][1], True)
    tail(cv, hip, P.get("tail", 0))
    U.barrel(cv, B, L, hip, sh)
    U.leg_hind(cv, B, L, add(hip, (1, 3)), P["hind"][0], False)
    paw(cv, P["hind"][0], False)
    tip = wing(cv, add(sh, (-10, -7)), P["wn"], 46, False)
    talon_leg(cv, add(sh, (2, 3)), P["front"][0], False, P.get("grab", 0))
    j = head(cv, add(sh, (8, -12)), P.get("tilt", 0), P.get("beak", 0), P.get("eye", "open"))
    j["tip"] = tip
    j["foot"] = P["front"][0]
    return j


POSES = {
    "idle_a": dict(hip=(30, 58), sh=(56, 56), front=((66, 92), (60, 92)), hind=((34, 92), (26, 92)), wn=-130, wf=-112),
    "idle_b": dict(hip=(30, 59), sh=(56, 57), front=((66, 92), (60, 92)), hind=((34, 92), (26, 92)), wn=-150, wf=-132, tilt=4, tail=3),
    "idle_c": dict(hip=(30, 58), sh=(56, 55), front=((67, 91), (60, 92)), hind=((34, 92), (26, 92)), wn=-115, wf=-100, tilt=-4, beak=2, tail=-3),
    "windup": dict(hip=(28, 62), sh=(48, 46), front=((62, 64), (58, 68)), hind=((32, 92), (24, 92)), wn=-100, wf=-88, tilt=-12, beak=4, grab=1, tail=6),
    "move": dict(hip=(34, 56), sh=(62, 56), front=((80, 82), (74, 88)), hind=((20, 86), (28, 92)), wn=-170, wf=-160, tilt=10, tail=8),
    "attack": dict(hip=(30, 58), sh=(56, 54), front=((82, 70), (66, 88)), hind=((34, 92), (26, 92)), wn=-125, wf=-108, tilt=12, beak=5, grab=1, tail=4),
    "recover": dict(hip=(26, 50), sh=(48, 44), front=((60, 62), (56, 64)), hind=((28, 78), (22, 80)), wn=-80, wf=-66, tilt=0, beak=4, tail=5),
    "hit": dict(hip=(28, 60), sh=(50, 54), front=((58, 92), (52, 92)), hind=((32, 92), (24, 92)), wn=-175, wf=-60, tilt=-24, eye="shut", tail=-4),
}


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        tail(cv, (30, 86), -6)
        cv.part(poly(cv.blank(), [(22, 91), (26, 78), (44, 74), (64, 76), (70, 84), (66, 91)]), LION, ink=INK)
        wing(cv, (50, 78), 190, 34, False)
        talon_leg(cv, (64, 84), (74, 90), False)
        j = head(cv, (76, 82), 30, 0, "shut")
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 2, 12, (40, 52, 64), LION[2])
    j = griffin(cv, P)
    if name == "windup":
        sparkle(cv, add(j["beak"], (1, -8)), WHITE, EYE, big=True)
    elif name == "move":
        puff(cv, (16, 88), 3.4, DUST)
    elif name == "attack":
        f = j["foot"]
        for dx in (0, 5, 10):
            slash(cv, add(f, (dx - 3, -12)), add(f, (dx + 2, 10)), 3, 2.6, WIND[1], WHITE)
    elif name == "recover":
        for k, (a, b) in enumerate((((64, 30), (92, 40)), ((66, 50), (92, 58)), ((62, 70), (90, 78)))):
            slash(cv, a, b, 4 + k, 3.2, WIND[0], WIND[2])
        sparkle(cv, (86, 24), WHITE, WIND[1], big=True)
        puff(cv, (30, 88), 3.6, DUST)
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((5, -10), (9, -7), (8, -13)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("griffin-sky", draw, sys.argv[1:], S=S, idle_ms=220)
