#!/usr/bin/env python3
"""절벽 하피(harpy-cliff) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

사람 상반신(헝클어진 붉은 머리·노란 맹금 눈)에 팔 대신 큰 깃털 날개, 허리 아래는 깃털 바지와
갈고리 발톱 새다리다. 오른쪽(아군)을 보며 공중에 떠서 날개를 위·가운데·아래로 친다.
6번 칸(스킬 skill_mon_gale_wing): 두 날개를 앞으로 내리쳐 초승달 바람 칼날 셋을 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_harpy_cliff.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, arc_trail, burst, chain, ellipse, lerp, polar, poly, ring, rnd, run, slash,
                       sparkle, speed_lines)

INK = (34, 20, 26)
SKIN = [(176, 112, 86), (220, 156, 120), (244, 196, 156), (255, 226, 196)]
HAIR = [(96, 26, 30), (150, 44, 40), (200, 72, 56), (236, 116, 84)]
FEATH = [(70, 66, 96), (106, 102, 140), (150, 148, 184), (196, 196, 222)]
FEATH_FAR = [(52, 48, 74), (70, 66, 96), (90, 86, 120), (90, 86, 120)]
TIP = [(150, 60, 50), (196, 92, 66)]
PANTS = [(84, 60, 44), (120, 90, 62), (156, 122, 84), (186, 154, 110)]
TALON = [(150, 120, 40), (210, 176, 70), (240, 214, 120), (240, 214, 120)]
CLAW = (40, 30, 30)
EYE, EYE_HI = (250, 200, 40), (255, 255, 220)
WIND = [(110, 190, 200), (170, 232, 236), (236, 255, 255)]
WHITE = (255, 252, 236)


def wing(cv, sh, ang, length=20.0, spread=1.0, far=False):
    """어깨 sh 에서 ang 방향으로 뼈대 앞날(어깨 → 팔꿈치 → 손목 → 끝)을 긋고, 그 뒤쪽(ang-90)으로
    깃 끝이 톱니처럼 갈라지는 날개면을 붙인다. 깃 끝 한 칸은 붉은 띠. spread 가 작으면 깃이 짧게 접힌다."""
    ramp = FEATH_FAR if far else FEATH
    elbow = polar(sh, ang, length * 0.34)
    wrist = polar(elbow, ang + 12, length * 0.30)
    tip = polar(wrist, ang + 24, length * 0.36)
    lead = [sh, elbow, wrist, tip]
    # 앞날을 끝(t=0) → 어깨(t=1)로 고르게 나눈 점마다 뒤쪽으로 깃 하나
    seglen = [math.dist(lead[k], lead[k + 1]) for k in range(3)]
    total = sum(seglen)

    def along(t):  # t=0 날개 끝, t=1 어깨
        d = (1 - t) * total
        for k in range(3):
            if d <= seglen[k] or k == 2:
                return lerp(lead[k], lead[k + 1], min(1.0, d / max(seglen[k], 0.01)))
            d -= seglen[k]

    n = 6
    roots, tips = [], []
    for i in range(n):
        t = i / (n - 1)
        p = along(t)
        fl = length * (0.66 - 0.36 * t) * spread + 2
        back = ang - 90 + 38 * (1 - t)
        roots.append(p)
        tips.append(polar(p, back - 8, fl))
    edge = []
    for i in range(n):
        edge.append(tips[i])
        if i < n - 1:
            edge.append(lerp(lerp(roots[i], tips[i], 0.6), lerp(roots[i + 1], tips[i + 1], 0.6), 0.5))
    cv.part(poly(cv.blank(), [tip] + edge + [add(sh, (0, 3)), sh, elbow, wrist]), ramp, gloss=False)
    cv.part(chain(lead, [4.0, 3.2, 2.6, 1.6]), ramp)
    if not far:
        for i in range(1, n - 1):
            root = lerp(roots[i], tips[i], 0.25)
            cv.line([root, lerp(roots[i], tips[i], 0.8)], FEATH[0])
            cv.pixel(*rnd(lerp(roots[i], tips[i], 0.9)), TIP[1])
    return tip


def leg(cv, hip, knee_d, foot_d, grip=False, far=False):
    ramp = PANTS if not far else [PANTS[0], PANTS[0], PANTS[1], PANTS[1]]
    knee = add(hip, knee_d)
    foot = add(knee, foot_d)
    cv.part(chain([hip, knee], [5.0, 4.0]), ramp, gloss=False)
    cv.part(chain([knee, foot], [2.2, 2.0]), TALON if not far else [TALON[0], TALON[0], TALON[1], TALON[1]], gloss=False)
    for a in ((20, 50, 100) if not grip else (-20, 30, 80)):
        t = polar(foot, a, 3)
        cv.line4([foot, t], CLAW)
    return foot


def torso_head(cv, c, tilt, mouth=0, eye="open", hair=0.0):
    def r(dx, dy):
        a = math.radians(tilt)
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 몸통(깃털 가슴판)
    cv.part(poly(cv.blank(), [r(-4, -7), r(4, -7), r(5, 2), r(3, 8), r(-4, 8), r(-5, 1)]), FEATH)
    for y in (-3, 1, 5):
        cv.line([r(-3, y), r(0, y + 1.5), r(3, y)], FEATH[0])
    # 목 + 머리
    hc = r(2, -12)
    cv.part(poly(cv.blank(), [r(-1, -9), r(3, -9), r(3, -7), r(-1, -7)]), SKIN, gloss=False)
    # 뒤로 흩날리는 머리카락(머리보다 먼저)
    for k, (dx, dy) in enumerate(((-9, -4 + hair), (-8, 1 + hair), (-6, -8 + hair * 0.5))):
        cv.part(poly(cv.blank(), [r(-1, -16), r(dx, dy - 12), r(1, -10)]), HAIR, gloss=False)
    cv.part(ellipse(cv.blank(), hc, 4.5, 4.5), SKIN)
    # 앞머리 + 정수리
    cv.part(poly(cv.blank(), [r(-3, -17), r(4, -17), r(6, -14), r(3, -15), r(1, -13), r(-3, -13)]), HAIR, gloss=False)
    # 얼굴: 매부리 코, 노란 맹금 눈, 입
    cv.pixel(*rnd(r(6.5, -11)), SKIN[1])
    cv.pixel(*rnd(r(7, -10)), INK)
    e = r(4, -13)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), INK)
        cv.line([add(e, (-1, -1)), add(e, (2, 0))], INK)
    if mouth:
        cv.put(poly(cv.blank(), [r(4, -9), r(7, -9), r(6, -9 + mouth * 0.7)]), (110, 20, 30))
    else:
        cv.pixel(*rnd(r(5, -9)), INK)
    return dict(sh=r(-2, -5), sh2=r(2, -5), hip=r(0, 7), head=hc, mouth=r(7, -9))


BASE = dict(c=(30.0, 30.0), tilt=6, wing=-140, spread=1.0, wfar=-120, mouth=0, eye="open", hair=0.0,
            legs=(((-1, 6), (1, 6)), ((2, 6), (2, 6))), grip=False)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 아래로 쳐 몸이 뜬다
        p.update(c=(30.0, 28.0), wing=-200, wfar=-190, hair=1.5, spread=0.8)
    elif name == "idle_c":  # 날개를 반만 들고 가라앉는다
        p.update(c=(30.0, 32.0), wing=-165, wfar=-150, hair=-1.0, spread=0.9)
    elif name == "windup":  # 날개를 머리 위로 높이 젖히고 발톱을 웅크린다
        p.update(c=(27.0, 31.0), tilt=-8, wing=-105, wfar=-90, spread=1.0, mouth=3, grip=True,
                 legs=(((-3, 5), (3, 4)), ((0, 5), (4, 4))))
    elif name == "move":  # 날개를 뒤로 접고 비스듬히 내리꽂는다
        p.update(c=(36.0, 32.0), tilt=24, wing=-190, wfar=-185, spread=0.45, hair=3.0,
                 legs=(((-6, 3), (-4, 3)), ((-4, 4), (-4, 3))))
    elif name == "attack":  # 발톱을 앞으로 내질러 할퀸다
        p.update(c=(32.0, 28.0), tilt=-14, wing=-120, wfar=-110, mouth=4, grip=True,
                 legs=(((4, 5), (6, 2)), ((6, 4), (7, 1))))
    elif name == "recover":  # 스킬 바람 칼날: 두 날개를 앞으로 휘둘러 내리친다
        p.update(c=(28.0, 30.0), tilt=10, wing=-15, wfar=-35, spread=0.9, mouth=5, hair=2.5)
    elif name == "hit":  # 맞아서 뒤로 젖혀지고 깃털이 흩어진다
        p.update(c=(26.0, 31.0), tilt=-26, wing=-230, wfar=-215, spread=0.7, eye="shut", mouth=2, hair=-2.0,
                 legs=(((2, 5), (3, 6)), ((4, 5), (4, 5))))
    return p


def draw_harpy(cv, P):
    c, tilt = P["c"], P["tilt"]
    probe = Canvas(64, INK)
    j = torso_head(probe, c, tilt)  # 어깨·엉덩이 좌표만 먼저 얻는다
    wing(cv, add(j["sh2"], (1, -1)), P["wfar"], 17, P["spread"], far=True)
    (k1, f1), (k2, f2) = P["legs"]
    leg(cv, add(j["hip"], (2, 0)), k2, f2, P["grip"], far=True)
    leg(cv, j["hip"], k1, f1, P["grip"])
    j = torso_head(cv, c, tilt, P["mouth"], P["eye"], P["hair"])
    hand = wing(cv, j["sh"], P["wing"], 21, P["spread"])
    j["hand"] = hand
    return j


def draw_dead(cv):
    """바닥에 엎어져 날개 하나가 펼쳐져 깔리고 머리카락이 흩어진 모습."""
    wing(cv, (30, 55), 185, 22, 0.6, far=True)
    cv.part(poly(cv.blank(), [(26, 54), (38, 52), (40, 58), (26, 59)]), FEATH)
    cv.part(chain([(26, 57), (19, 58)], [4, 3]), PANTS, gloss=False)
    cv.line4([(19, 58), (15, 58), (13, 56)], TALON[1])
    for t in ((12, 55), (12, 58)):
        cv.pixel(*t, CLAW)
    cv.part(poly(cv.blank(), [(38, 53), (50, 50), (53, 58), (39, 59)]), HAIR, gloss=False)
    cv.part(ellipse(cv.blank(), (44, 55), 4.0, 3.6), SKIN)
    cv.part(poly(cv.blank(), [(40, 52), (48, 51), (48, 53), (41, 54)]), HAIR, gloss=False)
    cv.line([(44, 55), (46, 57)], INK)
    cv.line([(46, 55), (44, 57)], INK)
    wing(cv, (36, 56), -10, 18, 0.5)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 12, (20, 27, 34), FEATH[2])
    j = draw_harpy(cv, P)
    if name == "attack":
        f = add(j["hip"], (13, 3))
        for k in range(3):
            slash(cv, add(f, (-2 + k * 3, -9)), add(f, (4 + k * 3, 8)), 3, 2.0, WIND[1], WHITE)
    elif name == "recover":
        # 초승달 바람 칼날 셋: 앞(오른쪽)으로 날아간다
        h = j["hand"]
        for k, (dx, dy, r) in enumerate(((6, -6, 7), (14, 2, 6), (8, 10, 5))):
            center = add(h, (dx, dy))
            arc_trail(cv, center, r, -70, 70, 2.6, WIND[1], WIND[2])
        for dy in (-12, 16):
            cv.line([add(h, (2, dy)), add(h, (12, dy - 2))], WIND[0])
        sparkle(cv, add(h, (22, -10)), WHITE, WIND[1], big=True)
        sparkle(cv, add(h, (24, 12)), WHITE, WIND[1])
    elif name == "windup":
        ring(cv, add(j["head"], (-2, -6)), 10, 200, 300, WIND[0], 1)
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((7, -6), (9, -3), (8, -9), (10, 0)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
        for p in ((h[0] - 10, h[1] + 4), (h[0] - 14, h[1] + 12), (h[0] + 6, h[1] + 20)):
            cv.line([p, add(p, (2, -1))], FEATH[2])
    return cv.image()


if __name__ == "__main__":
    run("harpy-cliff", draw, sys.argv[1:], idle_ms=120)
