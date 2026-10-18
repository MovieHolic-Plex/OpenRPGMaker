#!/usr/bin/env python3
"""갈색 곰(bear-brown) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

네 발로 선 묵직한 불곰: 솟은 어깨 혹, 처진 배, 둥근 귀와 밝은 황갈 주둥이, 검은 코,
굵은 기둥 다리 끝 넓은 발에 흰 발톱. 일어서면 뒷발로 서서 앞발을 치켜든다.
6번 칸(스킬 skill_mon_savage_maul): 뒷발로 우뚝 서서 앞발 발톱으로 세 줄을 긁어 내린다.

  python3 scripts/content/monsters/redraw_bear_brown.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (30, 18, 12)
FUR = [(92, 54, 30), (132, 82, 46), (168, 112, 64), (196, 144, 92)]
FUR_FAR = [(68, 40, 24), (92, 54, 30), (112, 68, 38), (112, 68, 38)]
MUZ = [(170, 122, 76), (206, 162, 108), (230, 194, 140), (240, 214, 170)]
NOSE = (24, 16, 14)
CLAW = (236, 228, 210)
EYE = (20, 12, 10)
MOUTH = (120, 36, 36)
TOOTH = (248, 244, 230)
DUST = [(120, 104, 84), (164, 146, 120)]
RAKE = [(200, 60, 50), (255, 220, 200)]
WHITE = (255, 252, 240)
GROUND = 60


def rot(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, top, foot, w=6.0, far=False, back=False):
    """굵은 다리 → 넓은 발 + 발톱. back=True 면 뒷다리(허벅지가 두껍고 발목이 뒤로)."""
    ramp = FUR_FAR if far else FUR
    if back:
        knee = add(lerp(top, foot, 0.5), (2, 0))
        cv.part(chain([top, knee, add(foot, (0, -2))], [w + 2, w - 0.5, w - 1.5]), ramp, gloss=False)
    else:
        cv.part(chain([top, add(foot, (0, -2))], [w, w - 1.5]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 2), (f[0] + 3, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 3, f[1])]), ramp, gloss=False)
    if not far:
        for dx in (2, 4):
            cv.pixel(f[0] + dx, f[1], CLAW)


def paw_raised(cv, sh, ang, far=False, length=13):
    """뒷발로 섰을 때 치켜든 앞발: 어깨 → 팔꿈치 → 발바닥 + 발톱 셋."""
    ramp = FUR_FAR if far else FUR
    el = polar(sh, ang, length * 0.55)
    hand = polar(el, ang - 25, length * 0.5)
    cv.part(chain([sh, el, hand], [6.5, 5.5, 5.0]), ramp, gloss=False)
    if not far:
        for k in (-35, 0, 35):
            a = ang - 25 + k
            cv.line4([rnd(polar(hand, a, 2)), rnd(polar(hand, a, 4))], CLAW)
    return hand


def head(cv, c, tilt=0, mouth=0, eye="open"):
    P = lambda *pts: rot(c, tilt, pts)
    cv.part(ellipse(cv.blank(), P((-3, -6))[0], 2.6, 2.6), FUR_FAR, gloss=False)  # 먼 귀
    if mouth:
        jaw = rot(P((3, 3))[0], mouth, [(0, 0), (8, 0), (8, 2), (0, 3)])
        cv.put(poly(cv.blank(), P((3, 2), (10, 1)) + [jaw[1], jaw[0]]), MOUTH)
        cv.part(poly(cv.blank(), jaw), MUZ, gloss=False)
        cv.pixel(*rnd(lerp(jaw[1], jaw[0], 0.2)), TOOTH)
    cv.part(ellipse(cv.blank(), c, 6.5, 5.8), FUR)
    cv.part(poly(cv.blank(), P((2, -2), (9, -1), (11, 1), (10, 3), (3, 4))), MUZ)
    cv.part(ellipse(cv.blank(), P((-1, -6))[0], 2.6, 2.6), FUR, gloss=False)  # 가까운 귀
    cv.pixel(*rnd(P((-1, -6))[0]), MUZ[1])
    n = P((10, 0))[0]
    cv.put(ellipse(cv.blank(), n, 1.2, 1.0), NOSE)
    if mouth:
        cv.pixel(*rnd(P((8, 2))[0]), TOOTH)
    e = P((3, -3))[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
    elif eye == "angry":
        cv.pixel(*rnd(e), EYE)
        cv.line([add(e, (-1, -2)), add(e, (2, -1))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (0, -1))), FUR[3])
    return dict(nose=n, mouth=P((10, 4))[0])


def draw_quad(cv, P):
    """네 발로 선 자세. hump = 어깨 혹 위치, rump = 엉덩이."""
    hump, rump = P["hump"], P["rump"]
    (f1, f2, b1, b2) = P["feet"]
    leg(cv, add(hump, (2, 8)), (f2, GROUND), 5.5, far=True)
    leg(cv, add(rump, (2, 6)), (b2, GROUND), 5.5, far=True, back=True)
    br = P.get("breath", 0)
    body = [add(rump, (-7, 2)), add(rump, (-5, -5)), add(lerp(rump, hump, 0.5), (0, -6)), add(hump, (-1, -9)),
            add(hump, (6, -6)), add(hump, (9, 2)), add(hump, (6, 11 + br)), add(lerp(rump, hump, 0.5), (0, 13 + br)),
            add(rump, (-3, 11)), add(rump, (-8, 7))]
    cv.part(poly(cv.blank(), [add(rump, (-6, 0)), add(rump, (-10, 1)), add(rump, (-7, 4))]), FUR, gloss=False)  # 짧은 꼬리
    cv.part(poly(cv.blank(), body), FUR)
    for dx, dy in ((-2, -7), (1, -8), (-6, -5)):
        cv.pixel(hump[0] + dx, hump[1] + dy, FUR[3])
    mid = lerp(rump, hump, 0.5)
    cv.line4([add(mid, (-3, 2)), add(mid, (-1, 5))], FUR[0])
    cv.line4([add(mid, (2, 3)), add(mid, (4, 6))], FUR[0])
    leg(cv, add(hump, (4, 8)), (f1, GROUND), 6.5)
    leg(cv, add(rump, (0, 6)), (b1, GROUND), 6.5, back=True)
    return head(cv, add(hump, (P.get("neck", 10), P.get("neck_y", 1))), P["tilt"], P["mouth"], P["eye"])


def draw_stand(cv, P):
    """뒷발로 우뚝 선 자세(windup·skill)."""
    hip, lean = P["hip"], P["lean"]
    chest = polar(hip, -90 + lean, 17)
    sh = polar(hip, -90 + lean, 13)
    paw_raised(cv, add(sh, (-2, -1)), P["arm_far"], far=True)
    leg(cv, add(hip, (-3, 2)), (hip[0] - 5, GROUND), 6.0, far=True, back=True)
    body = [add(hip, (-9, 4)), add(hip, (8, 5)), add(chest, (9, 3)), add(chest, (5, -4)), add(chest, (-6, -3)), add(hip, (-10, -4))]
    cv.part(poly(cv.blank(), body), FUR)
    cv.part(ellipse(cv.blank(), lerp(hip, chest, 0.45), 4.0, 6.0), MUZ, gloss=False)  # 밝은 가슴 털
    cv.put(poly(cv.blank(), [add(hip, (-7, 2)), add(hip, (-10, 1)), add(hip, (-8, 5))]), FUR[1])
    leg(cv, add(hip, (2, 3)), (hip[0] + 5, GROUND), 7.0, back=True)
    j = head(cv, polar(chest, -90 + lean * 1.3, 4), P["tilt"], P["mouth"], P["eye"])
    j["hand"] = paw_raised(cv, add(sh, (3, 0)), P["arm_near"])
    return j


QUAD = dict(hump=(30.0, 38.0), rump=(17.0, 40.0), feet=(36, 31, 20, 13), tilt=6, mouth=0, eye="open")


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 옆으로 쓰러진 곰: 배를 보이고 네 다리를 뻗음, 혀가 나옴
        cv.part(poly(cv.blank(), [(10, 58), (12, 49), (22, 45), (38, 46), (44, 52), (42, 59), (12, 59)]), FUR)
        cv.part(ellipse(cv.blank(), (27, 55), 9.0, 3.0), MUZ, gloss=False)
        for a, b in (((18, 50), (14, 43)), ((24, 48), (22, 41)), ((34, 48), (37, 41)), ((39, 50), (44, 44))):
            cv.part(chain([a, b], [5, 4]), FUR_FAR, gloss=False)
            cv.pixel(b[0], b[1] - 2, CLAW)
        cv.part(ellipse(cv.blank(), (49, 54), 6.0, 5.0), FUR)
        cv.part(poly(cv.blank(), [(51, 54), (57, 55), (57, 58), (51, 59)]), MUZ)
        cv.part(ellipse(cv.blank(), (46, 49), 2.4, 2.4), FUR, gloss=False)
        cv.put(ellipse(cv.blank(), (57, 55), 1, 1), NOSE)
        cv.line([(47, 52), (49, 54)], INK)
        cv.line([(49, 52), (47, 54)], INK)
        cv.line4([(54, 59), (56, 59)], (210, 90, 100))
        return cv.image()
    if name in ("windup", "recover"):
        if name == "windup":  # 뒷발로 일어서 두 앞발을 치켜든다
            P = dict(hip=(24.0, 46.0), lean=-4, arm_near=-35, arm_far=-120, tilt=-14, mouth=14, eye="angry")
        else:  # 스킬 할퀴기: 앞으로 숙이며 발톱을 내리긋는다
            P = dict(hip=(26.0, 46.0), lean=18, arm_near=30, arm_far=-40, tilt=8, mouth=18, eye="angry")
        j = draw_stand(cv, P)
        h = j["hand"]
        if name == "windup":
            sparkle(cv, add(h, (2, -5)), WHITE, CLAW)
            puff(cv, (14, 58), 2.0, DUST)
        else:
            for k in range(3):  # 붉은 세 줄 발톱 자국
                a = add(h, (4 + k * 3, -12 + k))
                slash(cv, a, add(a, (5, 18)), 2, 2.2, RAKE[0], RAKE[1])
            burst(cv, add(h, (10, 4)), 3.2, CLAW, WHITE, spikes=6)
        return cv.image()
    P = dict(QUAD)
    if name == "idle_b":  # 숨을 들이켜 등이 오르고 고개를 든다
        P.update(hump=(30.0, 37.0), rump=(17.0, 39.5), tilt=0, breath=1)
    elif name == "idle_c":  # 고개를 숙여 킁킁, 앞발을 조금 내딛음
        P.update(hump=(30.0, 39.0), tilt=18, neck_y=3, feet=(38, 31, 20, 13))
    elif name == "move":  # 어깨를 낮추고 돌진
        P.update(hump=(36.0, 39.0), rump=(22.0, 37.0), feet=(46, 38, 24, 14), tilt=14, mouth=10, eye="angry")
    elif name == "attack":  # 앞발로 내려치며 문다
        P.update(hump=(36.0, 38.0), rump=(21.0, 40.0), feet=(44, 39, 24, 17), tilt=10, mouth=24, eye="angry")
    elif name == "hit":  # 맞고 뒤로 움찔, 고개를 젖힌다
        P.update(hump=(26.0, 40.0), rump=(14.0, 41.0), feet=(32, 28, 18, 11), tilt=-22, mouth=8, eye="shut")
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), FUR[2])
    j = draw_quad(cv, P)
    if name == "move":
        puff(cv, (12, 57), 2.4, DUST)
    elif name == "attack":
        n = j["nose"]
        slash(cv, add(n, (0, -8)), add(n, (5, 9)), 4, 3.2, CLAW, WHITE)
        burst(cv, add(n, (5, 2)), 3.8, RAKE[0], RAKE[1], spikes=6, rot=12)
    elif name == "hit":
        n = j["nose"]
        for dx, dy in ((-2, -9), (1, -11), (-5, -11), (3, -7)):
            cv.pixel(n[0] + dx, n[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bear-brown", draw, sys.argv[1:], idle_ms=320)
