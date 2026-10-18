#!/usr/bin/env python3
"""지옥 사냥개(hound-hell) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

숯빛 가죽에 용암 금이 간 마른 사냥개. 깊은 가슴·잘록한 허리, 발끝으로 서는 긴 다리 넷,
등줄기를 따라 타오르는 불꽃 갈기와 불붙은 꼬리 끝, 이글거리는 노란 눈과 흰 송곳니.
6번 칸(스킬 skill_mon_hellfire_fang): 입을 쩍 벌려 불길에 휩싸인 턱으로 물어뜯는다.

  python3 scripts/content/monsters/redraw_hound_hell.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, burst, chain, flame, ik_side, lerp, poly, puff, rnd, run, slash, sparkle,
                       speed_lines)

INK = (22, 12, 16)
HIDE = [(46, 30, 38), (74, 48, 58), (104, 70, 80), (134, 98, 104)]
HIDE_FAR = [(32, 20, 28), (46, 30, 38), (60, 40, 50), (60, 40, 50)]
FIRE = [(170, 40, 20), (236, 110, 30), (255, 200, 70), (255, 246, 190)]
LAVA = (255, 140, 40)
FANG = (246, 236, 214)
MOUTH = (110, 20, 24)
EYE, EYE_HI = (255, 210, 60), (255, 255, 220)
CLAW = (230, 210, 180)
ASH = [(70, 56, 60), (112, 96, 96)]
WHITE = (255, 252, 236)
GROUND = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, hip, foot, far=False, front=True):
    """허벅지 → 정강이 → 발허리(뒷다리는 뒤꿈치가 뒤로 솟는 개 다리) → 발가락 + 발톱."""
    ramp = HIDE_FAR if far else HIDE
    foot = add(foot, (0, -1))
    if front:
        knee = ik_side(hip, foot, 8.0, 8.0, forward=False)
        cv.part(chain([hip, knee], [4.5, 2.6]), ramp, gloss=False)
        cv.part(chain([knee, foot], [2.6, 2.0]), ramp, gloss=False)
    else:
        hock = add(foot, (-3, -6))
        knee = ik_side(hip, hock, 7.0, 6.0, forward=True)
        cv.part(chain([hip, knee], [6.0, 3.2]), ramp, gloss=False)
        cv.part(chain([knee, hock], [3.2, 2.4]), ramp, gloss=False)
        cv.part(chain([hock, foot], [2.4, 2.0]), ramp, gloss=False)
    f = rnd(foot)
    cv.put(poly(cv.blank(), [(f[0] - 1, f[1] - 1), (f[0] + 2, f[1] - 1), (f[0] + 3, f[1] + 1), (f[0] - 1, f[1] + 1)]), ramp[1])
    if not far:
        cv.pixel(f[0] + 3, f[1] + 1, CLAW)
    return knee


def body(cv, sh, hp, breath=0.0):
    """깊은 가슴(어깨 아래로 처짐) → 잘록한 허리 → 엉덩이. 옆구리 용암 금."""
    pts = [add(hp, (-4, -2)), add(lerp(hp, sh, 0.5), (0, -3)), add(sh, (0, -5)), add(sh, (6, -2)),
           add(sh, (6, 6 + breath)), add(sh, (0, 10 + breath)), add(lerp(hp, sh, 0.45), (0, 5)), add(hp, (2, 6)), add(hp, (-4, 4))]
    M = cv.part(poly(cv.blank(), pts), HIDE)
    # 갈비 위 용암 금(가늘게 갈라진 빛)
    a = add(lerp(hp, sh, 0.55), (0, 1))
    cv.line4([a, add(a, (3, 2)), add(a, (6, 1)), add(a, (8, 4))], LAVA)
    cv.line4([add(hp, (0, 1)), add(hp, (3, 3))], LAVA)
    return M


def mane(cv, sh, hp, h=1.0, seed=0):
    """등줄기 불꽃 갈기: 어깨 쪽이 높고 엉덩이로 갈수록 낮다."""
    for i in range(5):
        t = 0.15 + i * 0.2
        base = add(lerp(add(hp, (-1, -2)), add(sh, (2, -5)), t), (0, 1))
        hh = (4 + 5 * t) * h * (0.8 + 0.3 * ((i + seed) % 2))
        flame(cv, base, hh, 4.5, FIRE[:3], lean=-0.6, tongues=1, seed=i + seed)


def tail(cv, hp, curl=0.0, seed=0):
    root = add(hp, (-4, 0))
    mid = add(root, (-4, -4 - curl))
    tip = add(root, (-4, -10 - curl * 1.5))
    cv.part(chain([root, mid, tip], [3.0, 2.2, 1.6]), HIDE)
    flame(cv, add(tip, (0, 1)), 6 + seed % 2, 4, FIRE[:3], lean=-0.4, tongues=1, seed=seed)


def head(cv, neck, tilt=0, mouth=0, eye="open", fire=False):
    """긴 주둥이의 늑대형 머리 + 뒤로 젖힌 뿔 같은 귀. mouth = 아래턱 벌림 각."""
    P = lambda *pts: xf(neck, tilt, pts)
    # 아래턱(먼저, 벌어지면 아래로 회전)
    jaw_o = P((4, 4))[0]
    jaw = xf(jaw_o, mouth, [(0, -1), (11, 0), (11, 2), (2, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 2), (15, 1)) + [jaw[1], jaw[0]]), MOUTH)
    cv.part(poly(cv.blank(), jaw), HIDE, gloss=False)
    skull = P((-3, -5), (5, -6), (9, -3), (16, -1), (16, 2), (5, 4), (-2, 4))
    cv.part(poly(cv.blank(), skull), HIDE)
    cv.part(poly(cv.blank(), P((-1, -4), (-6, -11), (3, -6))), HIDE_FAR, gloss=False)  # 뒤로 젖힌 귀
    cv.pixel(*rnd(P((15, -1))[0]), INK)  # 코
    # 송곳니: 위턱 둘, 아래턱 하나
    for x in (12, 8):
        cv.pixel(*rnd(P((x, 3))[0]), FANG)
        cv.pixel(*rnd(P((x, 4))[0]), FANG)
    lt = xf(jaw_o, mouth, [(9, -1), (9, -2)])
    for p in lt:
        cv.pixel(*rnd(p), FANG)
    e = P((6, -3))[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
        cv.line([add(e, (-1, -1)), add(e, (2, 0))], INK)
    if fire:  # 입가에서 새는 불씨
        cv.pixel(*rnd(P((17, 4))[0]), FIRE[2])
    return dict(snout=P((17, 1))[0], mouth=lerp(P((15, 2))[0], jaw[1], 0.5))


BASE = dict(sh=(38.0, 37.0), hp=(20.0, 38.0), neck_dx=4, tilt=6, mouth=0, eye="open", breath=0.0,
            feet=((44, 0), (39, 0), (22, 0), (16, 0)), curl=0.0, mh=1.0, seed=0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 숨을 들이켜 가슴이 부풀고 불길이 솟는다
        p.update(sh=(38.0, 36.0), hp=(20.0, 37.5), breath=1.0, mouth=8, curl=1.5, mh=1.25, seed=1)
    elif name == "idle_c":  # 머리를 낮춰 으르렁, 앞발 한 걸음
        p.update(sh=(38.0, 38.0), tilt=16, mouth=4, feet=((46, 0), (39, 0), (22, 0), (16, 0)), curl=0.5, seed=2)
    elif name == "windup":  # 엉덩이를 낮추고 웅크려 도약 준비
        p.update(sh=(34.0, 40.0), hp=(17.0, 41.0), tilt=20, mouth=10, mh=1.35,
                 feet=((42, 0), (36, 0), (19, 0), (13, 0)), curl=3, seed=1)
    elif name == "move":  # 날아오르듯 몸을 쭉 뻗는다
        p.update(sh=(42.0, 33.0), hp=(23.0, 36.0), tilt=-2, mouth=6,
                 feet=((54, -6), (49, -2), (17, -4), (11, -1)), curl=-2, seed=2)
    elif name == "attack":  # 앞으로 덮쳐 문다
        p.update(sh=(42.0, 37.0), hp=(24.0, 35.0), tilt=10, mouth=26,
                 feet=((52, 0), (47, -3), (26, 0), (20, 0)), curl=1, mh=1.2)
    elif name == "recover":  # 스킬 지옥불 이빨: 불길 휘감긴 턱을 크게 벌린다
        p.update(sh=(40.0, 36.0), hp=(21.0, 37.0), tilt=-8, mouth=34, mh=1.6,
                 feet=((49, 0), (43, 0), (22, 0), (16, 0)), curl=3, seed=1)
    elif name == "hit":  # 맞아서 뒤로 주저앉고 머리를 젖힌다
        p.update(sh=(34.0, 37.0), hp=(18.0, 41.0), tilt=-26, mouth=10, eye="shut", mh=0.6,
                 feet=((40, 0), (34, 0), (18, 0), (13, 0)), curl=-3)
    # 머리·불꽃이 오른쪽 여백을 넘지 않게 몸 전체를 왼쪽으로(공격 칸은 조금 더)
    ox = -9 if name in ("attack", "recover", "move") else -6
    p["sh"], p["hp"] = add(p["sh"], (ox, 0)), add(p["hp"], (ox, 0))
    p["feet"] = tuple((x + ox, y) for x, y in p["feet"])
    return p


def draw_hound(cv, P, fire=False):
    sh, hp = P["sh"], P["hp"]
    hip_f, hip_b = add(sh, (2, 6)), add(hp, (1, 3))
    (f1x, f1y), (f2x, f2y), (b1x, b1y), (b2x, b2y) = P["feet"]
    tail(cv, hp, P["curl"], P["seed"])
    leg(cv, add(hip_f, (2, -1)), (f2x, GROUND + f2y), far=True, front=True)
    leg(cv, add(hip_b, (2, -1)), (b2x, GROUND + b2y), far=True, front=False)
    mane(cv, sh, hp, P["mh"], P["seed"])
    body(cv, sh, hp, P["breath"])
    # 목: 어깨 → 머리
    neck = add(sh, (P["neck_dx"], -3))
    cv.part(chain([add(sh, (1, 1)), neck], [7, 6]), HIDE)
    leg(cv, hip_f, (f1x, GROUND + f1y), front=True)
    leg(cv, hip_b, (b1x, GROUND + b1y), front=False)
    return head(cv, add(neck, (1, -1)), P["tilt"], P["mouth"], P["eye"], fire)


def draw_dead(cv):
    """옆으로 쓰러져 불이 꺼지고 연기만 오르는 모습."""
    cv.part(poly(cv.blank(), [(12, 56), (18, 50), (36, 49), (42, 52), (42, 59), (14, 59)]), HIDE)
    for hip, foot in (((20, 57), (26, 54)), ((24, 58), (30, 57)), ((37, 57), (44, 54))):
        cv.part(chain([hip, foot], [3, 2]), HIDE_FAR, gloss=False)
    cv.part(chain([(13, 55), (8, 57), (4, 58)], [3, 2, 1.5]), HIDE, gloss=False)
    cv.part(poly(cv.blank(), [(41, 51), (48, 50), (58, 54), (58, 57), (42, 59)]), HIDE)
    cv.part(poly(cv.blank(), [(43, 51), (41, 46), (46, 50)]), HIDE_FAR, gloss=False)
    cv.line([(46, 52), (48, 54)], INK)
    cv.line([(48, 52), (46, 54)], INK)
    cv.pixel(55, 58, FANG)
    for x, y in ((22, 47), (30, 46), (5, 55)):
        puff(cv, (x, y), 2.4, ASH)
    cv.line4([(26, 51), (29, 53), (32, 52)], (150, 70, 40))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 42), FIRE[0])
    j = draw_hound(cv, P, fire=name in ("windup", "recover", "idle_b"))
    s, m = j["snout"], j["mouth"]
    if name == "attack":
        slash(cv, add(s, (-2, -9)), add(s, (2, 10)), 4, 3.4, FANG, WHITE)
        burst(cv, add(m, (5, 1)), 4.5, FIRE[1], FIRE[3], spikes=6, rot=15)
    elif name == "recover":
        flame(cv, add(m, (3, 6)), 15, 11, FIRE, lean=1.2, tongues=3, seed=2)
        burst(cv, add(m, (7, 2)), 5.0, FIRE[2], WHITE, spikes=7, rot=8)
        sparkle(cv, add(m, (-2, -12)), FIRE[3], FIRE[2], big=True)
        sparkle(cv, add(m, (9, -8)), FIRE[3], FIRE[1])
    elif name == "windup":
        for dx, dy in ((3, 1), (5, -1)):
            cv.pixel(m[0] + dx, m[1] + dy, FIRE[2])
    elif name == "idle_b":
        cv.pixel(m[0] + 2, m[1] - 1, FIRE[2])
    elif name == "hit":
        h = j["snout"]
        for dx, dy in ((-2, -8), (1, -10), (-4, -11), (3, -6)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("hound-hell", draw, sys.argv[1:], idle_ms=150)
