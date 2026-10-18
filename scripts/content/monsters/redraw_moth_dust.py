#!/usr/bin/env python3
"""가루 나방(moth-dust) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

공중에 뜬 큰 나방: 털 많은 크림빛 가슴과 마디진 배, 깃털 같은 빗살 더듬이, 검은 겹눈.
앞날개는 넓은 삼각(아이보리 바탕에 갈색 띠·호박색 눈알 무늬), 뒷날개는 둥글고 작다. 날개가 위·아래로 퍼덕인다.
6번 칸(스킬, 아키타입 venom): 날개를 활짝 위로 펼쳐 반짝이는 독 비늘가루 구름을 아군 쪽으로 흩날린다.

  python3 scripts/content/monsters/redraw_moth_dust.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (40, 30, 26)
WING = [(150, 128, 100), (206, 190, 160), (236, 226, 200), (250, 246, 230)]
WING_FAR = [(110, 92, 74), (150, 132, 108), (176, 160, 134), (176, 160, 134)]
BAND = (120, 84, 56)
OCEL = [(60, 40, 30), (230, 150, 50), (255, 220, 140)]
FUR = [(150, 130, 104), (210, 196, 168), (240, 232, 212), (255, 252, 240)]
BELLY = [(120, 100, 80), (170, 150, 120), (200, 182, 150), (200, 182, 150)]
EYE = (24, 20, 26)
POWDER = [(200, 170, 230), (240, 220, 255), (255, 255, 255)]
VENOM = [(150, 110, 200), (210, 170, 250)]
WHITE = (255, 252, 244)


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def wing_pts(root, ang, L, shape):
    c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    return [(root[0] + x * L * c - y * L * s_, root[1] + x * L * s_ + y * L * c) for x, y in shape]


FORE = [(0, 0), (0.45, -0.1), (0.92, -0.06), (1.0, 0.08), (0.9, 0.36), (0.6, 0.56), (0.22, 0.5), (0.02, 0.22)]
HIND = [(0, 0), (0.5, 0.05), (0.78, 0.3), (0.62, 0.62), (0.28, 0.62), (0.02, 0.3)]


def fore_wing(cv, root, ang, span, far=False):
    """넓은 삼각 앞날개(바깥 끝이 둥근). ang = 앞 가장자리 각(0=오른쪽, -90=위). 날개 면은 그 각의 시계 방향 쪽."""
    pts = wing_pts(root, ang, span, FORE)
    ramp = WING_FAR if far else WING
    M = cv.part(poly(cv.blank(), pts), ramp)
    W = lambda x, y: wing_pts(root, ang, span, [(x, y)])[0]
    if not far:
        cv.line4([W(0.32, -0.04), W(0.4, 0.22), W(0.28, 0.5)], BAND)
        cv.line4([W(0.86, 0.02), W(0.8, 0.3), W(0.58, 0.5)], BAND)
        oc = W(0.6, 0.24)
        cv.put(ellipse(cv.blank(), oc, 2.6, 2.6), OCEL[0])
        cv.put(ellipse(cv.blank(), oc, 1.6, 1.6), OCEL[1])
        cv.pixel(*rnd(add(oc, (-0.6, -0.6))), OCEL[2])
        for x, y in ((0.95, 0.12), (0.88, 0.3), (0.74, 0.46)):
            cv.pixel(*rnd(W(x, y)), WING[3])
    else:
        cv.pixel(*rnd(W(0.6, 0.24)), OCEL[0])
    return W(1.0, 0.08), M


def hind_wing(cv, root, ang, span, far=False):
    pts = wing_pts(root, ang, span, HIND)
    cv.part(poly(cv.blank(), pts), WING_FAR if far else WING, gloss=False)
    oc = wing_pts(root, ang, span, [(0.45, 0.32)])[0]
    cv.put(ellipse(cv.blank(), oc, 1.6, 1.6), OCEL[0])
    cv.pixel(*rnd(oc), OCEL[1])


def body(cv, c, tilt, eye="open", antenna=0.0):
    P = lambda *pts: xf(c, tilt, pts)
    # 마디진 배(뒤·아래로 처짐)
    abd = P((-2, 2), (-9, 6), (-15, 10))
    cv.part(chain(abd, [6.4, 5.6, 2.6]), BELLY)
    for t in (0.35, 0.65):
        cv.pixel(*rnd(lerp(abd[0], abd[2], t)), BELLY[0])
    # 털 가슴
    cv.part(ellipse(cv.blank(), c, 5.5, 5.0), FUR)
    # 머리 + 털 목도리
    h = P((6, -1))[0]
    cv.part(ellipse(cv.blank(), h, 3.4, 3.2), FUR)
    for dx, dy in ((2, -3), (-1, -4), (1, 3)):
        cv.pixel(*rnd(P((dx, dy))[0]), FUR[3])
    # 빗살 더듬이(뒤로 휘는 깃털)
    for k, base in enumerate(((5, -3), (6, -3))):
        stem = P(base, (base[0] + 2 - antenna, -8), (base[0] - 1 - antenna * 2, -13))
        col = FUR[0] if k == 0 else BAND
        cv.line4(stem, col)
        if k:
            for t in (0.4, 0.65, 0.85):
                q = lerp(stem[1], stem[2], t) if t > 0.5 else lerp(stem[0], stem[1], t * 2)
                cv.pixel(*rnd(add(q, (-1, 0))), FUR[1])
    e = P((8, -1))[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(ellipse(cv.blank(), e, 1.2, 1.2), EYE)
        cv.pixel(*rnd(add(e, (0, -1))), WHITE)
    # 다리 몇 개(가슴 아래로 늘어짐)
    for dx in (-1, 2):
        cv.line4([P((dx, 3))[0], P((dx + 1, 7))[0], P((dx + 3, 8))[0]], BELLY[0])
    return dict(head=h, mouth=P((9, 1))[0])


BASE = dict(c=(30.0, 34.0), tilt=0.0, fw=-80.0, hw=150.0, span=27.0, eye="open", antenna=0.0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 내려 퍼덕, 몸이 살짝 뜬다
        p.update(c=(30.0, 32.0), fw=-40.0, hw=165.0, span=26.0, antenna=0.5)
    elif name == "idle_c":  # 날개를 위로 접어 모으며 내려온다
        p.update(c=(30.0, 36.0), fw=-105.0, hw=140.0, span=27.0, antenna=-0.5)
    elif name == "windup":  # 몸을 뒤로 젖히고 날개를 크게 뒤로
        p.update(c=(27.0, 34.0), tilt=-14.0, fw=-125.0, hw=125.0, span=27.0, antenna=1.0)
    elif name == "move":  # 몸을 앞으로 숙이고 날개를 뒤로 눕혀 돌진
        p.update(c=(38.0, 36.0), tilt=12.0, fw=-160.0, hw=175.0, span=24.0, antenna=1.5)
    elif name == "attack":  # 날개로 덮치며 가루를 쳐 낸다
        p.update(c=(36.0, 30.0), tilt=8.0, fw=-5.0, hw=170.0, span=26.0)
    elif name == "recover":  # 스킬: 날개를 활짝 위로 편다
        p.update(c=(28.0, 38.0), tilt=-6.0, fw=-95.0, hw=150.0, span=29.0, antenna=-1.0)
    elif name == "hit":  # 맞아서 몸이 젖혀지고 날개가 흐트러진다
        p.update(c=(27.0, 36.0), tilt=-24.0, fw=-150.0, hw=115.0, span=24.0, eye="shut", antenna=2.0)
    return p


def draw_moth(cv, P):
    c = P["c"]
    root = add(c, (-1, -2))
    fore_wing(cv, add(root, (2, -1)), P["fw"] + 22, P["span"] * 0.86, far=True)
    hind_wing(cv, add(root, (-1, 2)), P["hw"], P["span"] * 0.6)
    j = body(cv, c, P["tilt"], P["eye"], P["antenna"])
    tip, _ = fore_wing(cv, root, P["fw"], P["span"])
    j["tip"] = tip
    return j


def draw_dead(cv):
    """날개를 펼친 채 땅에 떨어져 옆으로 누운 나방(앞날개가 바닥에 흐트러짐)."""
    hind_wing(cv, (26, 52), 200, 15, far=True)
    fore_wing(cv, (30, 53), 185, 22, far=True)
    cv.part(chain([(18, 56), (27, 55), (36, 55)], [4.2, 5.4, 4.6]), BELLY)
    cv.part(ellipse(cv.blank(), (40, 55), 3.0, 2.8), FUR)
    for x in (28, 31, 34):
        cv.line4([(x, 52), (x + 1, 48), (x + 3, 47)], BELLY[0])
    fore_wing(cv, (32, 54), -8, 20)
    cv.line([(40, 54), (42, 56)], INK)
    cv.line([(42, 54), (40, 56)], INK)
    for p in ((12, 49), (18, 44), (52, 46), (56, 52)):
        cv.pixel(*p, POWDER[1])


def powder_cloud(cv, c, r):
    for i in range(14):
        a = i * 137.5
        d = r * math.sqrt((i + 0.5) / 14)
        p = polar(c, a, d)
        col = POWDER[i % 3]
        cv.pixel(*rnd(p), col)
        if i % 3 == 0:
            cv.pixel(*rnd(add(p, (1, 0))), VENOM[1])
    for dx, dy, rr in ((0, 0, 3.0), (5, 4, 2.4), (-4, 5, 2.0)):
        cv.put(ellipse(cv.blank(), add(c, (dx, dy)), rr, rr * 0.8), VENOM[0])
        cv.put(ellipse(cv.blank(), add(c, (dx - 0.6, dy - 0.6)), rr * 0.5, rr * 0.4), VENOM[1])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_moth(cv, P)
    m = j["mouth"]
    if name == "recover":
        powder_cloud(cv, (50, 40), 11)
        for p in ((42, 26), (48, 20), (56, 28)):
            sparkle(cv, p, WHITE, POWDER[0])
    elif name == "attack":
        slash(cv, add(j["tip"], (0, -6)), add(j["tip"], (2, 12)), 4, 3.0, POWDER[1], WHITE)
        powder_cloud(cv, add(m, (8, 4)), 5)
    elif name == "windup":
        for p in ((44, 20), (48, 26), (46, 32)):
            cv.pixel(*p, POWDER[1])
        sparkle(cv, add(m, (4, -4)), WHITE, POWDER[0])
    elif name == "move":
        for y in (24, 30, 36):
            cv.line([(2, y), (8, y)], WING[1])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((7, -7), (9, -4), (8, -10), (11, -2)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("moth-dust", draw, sys.argv[1:], idle_ms=140)
