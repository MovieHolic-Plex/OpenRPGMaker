#!/usr/bin/env python3
"""회색 늑대(wolf-grey) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

잿빛 털의 날렵한 늑대: 목둘레 덥수룩한 갈기, 밝은 크림색 배·주둥이 아래, 곧게 선 뾰족한 귀,
긴 주둥이와 노란 눈, 발끝으로 서는 네 다리(뒷다리는 뒤꿈치가 솟는 개 다리), 아래로 늘어진 숱 많은 꼬리.
6번 칸(스킬 skill_mon_savage_maul): 뒷발로 일어서 앞발 발톱으로 세 줄을 긁어 내린다.

  python3 scripts/content/monsters/redraw_wolf_grey.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ik_side, lerp, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (20, 22, 30)
FUR = [(70, 78, 92), (110, 120, 134), (150, 160, 172), (196, 204, 212)]
FUR_FAR = [(50, 56, 68), (70, 78, 92), (88, 96, 110), (88, 96, 110)]
CREAM = [(150, 144, 132), (196, 190, 174), (226, 222, 206), (240, 238, 226)]
EYE, EYE_HI = (240, 196, 60), (255, 250, 210)
FANG = (246, 240, 226)
MOUTH = (120, 36, 44)
NOSE = (24, 22, 28)
CLAW = (228, 222, 204)
DUST = [(112, 104, 92), (156, 148, 132)]
RAKE = [(200, 56, 60), (255, 222, 210)]
WHITE = (255, 252, 244)
GROUND = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, hip, foot, far=False, front=True):
    """앞다리: 곧은 팔꿈치 -> 발목. 뒷다리: 굵은 허벅지 -> 뒤로 솟는 뒤꿈치 -> 발허리. 끝에 발 + 발톱."""
    ramp = FUR_FAR if far else FUR
    foot = add(foot, (0, -1))
    if front:
        knee = ik_side(hip, foot, 8.5, 8.0, forward=False)
        cv.part(chain([hip, knee], [4.2, 2.6]), ramp, gloss=False)
        cv.part(chain([knee, foot], [2.6, 2.0]), ramp, gloss=False)
    else:
        hock = add(foot, (-3, -6))
        knee = ik_side(hip, hock, 7.5, 6.0, forward=True)
        cv.part(chain([hip, knee], [6.0, 3.2]), ramp, gloss=False)
        cv.part(chain([knee, hock], [3.2, 2.2]), ramp, gloss=False)
        cv.part(chain([hock, foot], [2.2, 2.0]), ramp, gloss=False)
    f = rnd(foot)
    cv.put(poly(cv.blank(), [(f[0] - 1, f[1] - 1), (f[0] + 2, f[1] - 1), (f[0] + 3, f[1] + 1), (f[0] - 1, f[1] + 1)]), ramp[1])
    if not far:
        cv.pixel(f[0] + 3, f[1] + 1, CLAW)
        cv.pixel(f[0] + 1, f[1] + 1, CLAW)
    return knee


def paw_up(cv, sh, ang, far=False):
    """뒷발로 섰을 때 치켜든 앞다리(위팔 -> 아래팔 -> 펼친 발톱). ang 은 위팔 각(0 = 오른쪽)."""
    ramp = FUR_FAR if far else FUR
    el = add(sh, (math.cos(math.radians(ang)) * 8, math.sin(math.radians(ang)) * 8))
    paw = add(el, (math.cos(math.radians(ang + 50)) * 7, math.sin(math.radians(ang + 50)) * 7))
    cv.part(chain([sh, el], [5.0, 3.2]), ramp, gloss=False)
    cv.part(chain([el, paw], [3.2, 3.0]), ramp, gloss=False)
    if not far:
        for k in (-40, 0, 40):
            tip = add(paw, (math.cos(math.radians(ang + 50 + k)) * 3, math.sin(math.radians(ang + 50 + k)) * 3))
            cv.line([paw, tip], CLAW)
    return paw


def body(cv, sh, hp, breath=0.0):
    """가슴은 깊고 허리는 잘록. 배 쪽 크림색 띠."""
    pts = [add(hp, (-5, -3)), add(lerp(hp, sh, 0.5), (0, -4)), add(sh, (0, -5)), add(sh, (6, -2)),
           add(sh, (6, 6 + breath)), add(sh, (0, 10 + breath)), add(lerp(hp, sh, 0.45), (0, 5)), add(hp, (2, 6)), add(hp, (-5, 4))]
    M = cv.part(poly(cv.blank(), pts), FUR)
    belly = [add(sh, (5, 6 + breath)), add(sh, (0, 10 + breath)), add(lerp(hp, sh, 0.45), (0, 5)),
             add(lerp(hp, sh, 0.45), (0, 3)), add(sh, (0, 7 + breath))]
    cv.put(poly(cv.blank(), belly), CREAM[1])
    # 등줄기 짙은 털(안장 무늬)
    cv.line4([add(hp, (-3, -2)), add(lerp(hp, sh, 0.5), (0, -3)), add(sh, (-2, -4))], FUR[0])
    return M


def ruff(cv, sh, puffed=0.0):
    """목·어깨를 감싸는 덥수룩한 갈기: 뒤로 뻗는 털 삐침 다섯."""
    pts = [add(sh, (-5, -3)), add(sh, (-7, -7 - puffed)), add(sh, (-3, -6)), add(sh, (-3, -11 - puffed)),
           add(sh, (1, -7)), add(sh, (2, -12 - puffed)), add(sh, (5, -6)), add(sh, (8, -3)),
           add(sh, (10, 3)), add(sh, (7, 9)), add(sh, (3, 5)), add(sh, (-2, 2))]
    cv.part(poly(cv.blank(), pts), FUR)
    cv.line4([add(sh, (6, 2)), add(sh, (8, 6))], CREAM[2])


def tail(cv, hp, lift=0.0):
    """아래로 늘어졌다 끝이 살짝 들리는 숱 많은 꼬리. lift 가 크면 높이 쳐든다."""
    root = add(hp, (-5, -1))
    mid = add(root, (-6, 4 - lift))
    tip = add(root, (-10, 9 - lift * 2.2))
    M = cv.part(chain([root, mid, tip], [4.0, 5.0, 2.4]), FUR)
    cv.pixel(*rnd(add(tip, (0, 0))), CREAM[2])
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    """늑대 머리: 길고 곧은 주둥이, 곧게 선 두 귀(ears>0 이면 뒤로 젖힘). mouth = 아래턱 벌림 각."""
    P = lambda *pts: xf(neck, tilt, pts)
    jaw_o = P((4, 4))[0]
    jaw = xf(jaw_o, mouth, [(0, -1), (11, 0), (11, 2), (2, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 2), (15, 1)) + [jaw[1], jaw[0]]), MOUTH)
    cv.part(poly(cv.blank(), jaw), CREAM, gloss=False)
    skull = P((-4, -4), (3, -6), (8, -4), (16, -1), (16, 2), (6, 4), (-3, 5))
    cv.part(poly(cv.blank(), skull), FUR)
    # 뺨·주둥이 아래 크림색
    cv.put(poly(cv.blank(), P((4, 3), (15, 2), (15, 3), (3, 5))), CREAM[2])
    # 귀: 먼 귀(뒤) + 가까운 귀(앞)
    e = ears
    cv.part(poly(cv.blank(), P((-3, -4), (-4 - e * 4, -12 + e * 3), (1, -5))), FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), P((0, -5), (1 - e * 5, -13 + e * 4), (5, -5))), FUR, gloss=False)
    cv.pixel(*rnd(P((1 - e * 3, -8 + e * 2))[0]), CREAM[0])
    cv.pixel(*rnd(P((16, -1))[0]), NOSE)
    cv.pixel(*rnd(P((15, -1))[0]), NOSE)
    for x in (12, 8):
        cv.pixel(*rnd(P((x, 3))[0]), FANG)
    if mouth:
        for x in (12, 8):
            cv.pixel(*rnd(P((x, 4))[0]), FANG)
        for p in xf(jaw_o, mouth, [(9, -1), (5, -1)]):
            cv.pixel(*rnd(p), FANG)
    ey = P((6, -3))[0]
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 1))], INK)
    else:
        cv.pixel(*rnd(ey), EYE)
        cv.pixel(*rnd(add(ey, (1, 0))), EYE_HI)
        cv.line([add(ey, (-1, -1)), add(ey, (2, 0))], INK)
    return dict(snout=P((17, 1))[0], mouth=lerp(P((15, 2))[0], jaw[1], 0.5))


BASE = dict(sh=(38.0, 37.0), hp=(20.0, 38.0), neck_dx=4, tilt=4, mouth=0, eye="open", breath=0.0, ears=0.0,
            feet=((44, 0), (39, 0), (22, 0), (16, 0)), lift=0.0, ruff=0.0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 숨을 들이켜 가슴이 오르고 꼬리가 들린다
        p.update(sh=(38.0, 36.0), hp=(20.0, 37.5), breath=1.0, tilt=0, mouth=6, lift=1.5, ruff=1.0)
    elif name == "idle_c":  # 머리를 낮추고 으르렁, 귀를 젖힌다
        p.update(sh=(38.0, 38.0), tilt=14, mouth=10, ears=0.6, feet=((46, 0), (39, 0), (22, 0), (16, 0)), lift=0.5)
    elif name == "windup":  # 엉덩이를 낮추고 웅크려 도약 준비, 갈기를 세운다
        p.update(sh=(34.0, 41.0), hp=(17.0, 41.0), tilt=18, mouth=14, ears=1.0, ruff=2.0,
                 feet=((42, 0), (36, 0), (19, 0), (13, 0)), lift=3)
    elif name == "move":  # 몸을 쭉 뻗고 공중으로 도약
        p.update(sh=(42.0, 33.0), hp=(23.0, 35.0), tilt=-2, mouth=8, ears=1.0,
                 feet=((54, -6), (49, -2), (17, -4), (11, -1)), lift=-2)
    elif name == "attack":  # 앞으로 덮쳐 목을 문다
        p.update(sh=(42.0, 37.0), hp=(24.0, 35.0), tilt=10, mouth=28, ears=1.0, ruff=1.0,
                 feet=((52, 0), (47, -3), (26, 0), (20, 0)), lift=1)
    elif name == "hit":  # 맞아서 엉덩이가 내려앉고 머리를 젖힌다
        p.update(sh=(34.0, 37.0), hp=(18.0, 41.0), tilt=-26, mouth=12, eye="shut", ears=1.0,
                 feet=((40, 0), (34, 0), (18, 0), (13, 0)), lift=-3)
    ox = -5 if name in ("attack", "move") else -1
    p["sh"], p["hp"] = add(p["sh"], (ox, 0)), add(p["hp"], (ox, 0))
    p["feet"] = tuple((x + ox, y) for x, y in p["feet"])
    return p


def draw_wolf(cv, P):
    sh, hp = P["sh"], P["hp"]
    hip_f, hip_b = add(sh, (2, 6)), add(hp, (1, 3))
    (f1x, f1y), (f2x, f2y), (b1x, b1y), (b2x, b2y) = P["feet"]
    tail(cv, hp, P["lift"])
    leg(cv, add(hip_f, (2, -1)), (f2x, GROUND + f2y), far=True, front=True)
    leg(cv, add(hip_b, (2, -1)), (b2x, GROUND + b2y), far=True, front=False)
    body(cv, sh, hp, P["breath"])
    neck = add(sh, (P["neck_dx"], -3))
    cv.part(chain([add(sh, (1, 1)), neck], [7, 6]), FUR)
    ruff(cv, sh, P["ruff"])
    leg(cv, hip_f, (f1x, GROUND + f1y), front=True)
    leg(cv, hip_b, (b1x, GROUND + b1y), front=False)
    return head(cv, add(neck, (1, -1)), P["tilt"], P["mouth"], P["eye"], P["ears"])


def draw_rear(cv):
    """스킬 할퀴기: 뒷발로 우뚝 서서 앞발을 치켜든다. 몸통이 비스듬히 선다."""
    hp, sh = (24.0, 46.0), (31.0, 30.0)
    tail(cv, hp, -3)
    leg(cv, add(hp, (1, 1)), (22, GROUND), far=True, front=False)
    paw_up(cv, add(sh, (-1, 1)), -75, far=True)
    pts = [add(hp, (-5, 2)), add(hp, (-6, -4)), add(sh, (-6, 0)), add(sh, (-2, -5)), add(sh, (5, -3)),
           add(sh, (6, 4)), add(lerp(hp, sh, 0.4), (6, 0)), add(hp, (5, 4))]
    cv.part(poly(cv.blank(), pts), FUR)
    cv.put(poly(cv.blank(), [add(sh, (5, 0)), add(sh, (6, 4)), add(lerp(hp, sh, 0.4), (6, 0)),
                             add(lerp(hp, sh, 0.4), (3, 0)), add(sh, (3, 2))]), CREAM[1])
    ruff(cv, add(sh, (-1, 0)), 1.5)
    leg(cv, hp, (30, GROUND), front=False)
    neck = add(sh, (3, -6))
    cv.part(chain([add(sh, (0, 0)), neck], [7, 6]), FUR)
    j = head(cv, add(neck, (1, -1)), -10, 30, "open", 1.0)
    j["paw"] = paw_up(cv, add(sh, (4, 4)), 10)
    return j


def draw_dead(cv):
    """옆으로 쓰러져 다리를 뻗고 혀를 늘어뜨린 모습."""
    tail_m = chain([(14, 56), (8, 57), (3, 56)], [4, 4, 2])
    cv.part(tail_m, FUR, gloss=False)
    for hip, foot in (((20, 56), (25, 51)), ((25, 57), (31, 56)), ((36, 56), (42, 51)), ((39, 57), (46, 56))):
        cv.part(chain([hip, foot], [3, 2]), FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(12, 56), (18, 49), (36, 48), (42, 52), (42, 59), (14, 59)]), FUR)
    cv.line4([(16, 52), (26, 50), (36, 50)], FUR[0])
    cv.put(poly(cv.blank(), [(18, 58), (36, 58), (40, 55), (20, 56)]), CREAM[1])
    cv.part(poly(cv.blank(), [(40, 50), (46, 49), (58, 53), (58, 57), (42, 59)]), FUR)
    cv.put(poly(cv.blank(), [(46, 57), (57, 56), (58, 57), (44, 59)]), CREAM[2])
    cv.part(poly(cv.blank(), [(42, 50), (38, 44), (45, 49)]), FUR_FAR, gloss=False)
    cv.line([(47, 51), (49, 53)], INK)
    cv.line([(49, 51), (47, 53)], INK)
    cv.pixel(58, 54, NOSE)
    cv.put(poly(cv.blank(), [(52, 58), (55, 58), (54, 59)]), MOUTH)
    for x, y in ((24, 46), (6, 54)):
        puff(cv, (x, y), 2.2, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "recover":
        j = draw_rear(cv)
        p = j["paw"]
        for k, dx in enumerate((3, 7, 11)):
            slash(cv, add(p, (dx - 2, -10 + k)), add(p, (dx + 1, 9 + k)), 2, 2.4, RAKE[0], RAKE[1])
        burst(cv, add(p, (8, 0)), 3.6, CLAW, WHITE, spikes=6, rot=10)
        puff(cv, (18, 57), 2.4, DUST)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), FUR[2])
    j = draw_wolf(cv, P)
    s, m = j["snout"], j["mouth"]
    if name == "move":
        puff(cv, (8, 57), 2.4, DUST)
    elif name == "attack":
        slash(cv, add(s, (-2, -9)), add(s, (2, 10)), 4, 3.4, FANG, WHITE)
        burst(cv, add(m, (5, 1)), 4.0, RAKE[0], RAKE[1], spikes=6, rot=15)
    elif name == "windup":
        sparkle(cv, add(s, (-4, -9)), WHITE, EYE)
    elif name == "hit":
        for dx, dy in ((-2, -8), (1, -10), (-4, -11), (3, -6)):
            cv.pixel(s[0] + dx, s[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("wolf-grey", draw, sys.argv[1:], idle_ms=180)
