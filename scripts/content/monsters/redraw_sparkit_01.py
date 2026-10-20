#!/usr/bin/env python3
"""번개 정령(sparkit-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

뒷다리로 서서 깡충거리는 작은 전기 짐승: 파란 털에 밝은 하늘색 배, 머리 위로 길게 솟고 끝이 둥근 큰 두 귀(안쪽 금색),
크고 둥근 머리 안의 큰 검은 눈(흰 반짝임), 작고 둥근 주둥이, 눈 아래 뺨의 금색 전기 주머니, 배의 금색 번개 무늬,
짧은 앞발, 무릎이 앞으로 꺾이고 뒤꿈치가 솟은 굵은 뒷다리, 번개 모양으로 지그재그 꺾인 금빛 꼬리.
6번 칸(스킬 번개 탄): 뺨 전기 주머니에서 불꽃이 튀며 노란 지그재그 번개 줄기를 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_sparkit_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (12, 22, 48)
FUR = [(38, 74, 136), (64, 112, 184), (110, 160, 222), (180, 214, 248)]
FUR_FAR = [(28, 52, 104), (38, 74, 136), (48, 90, 156), (48, 90, 156)]
BELLY = [(150, 190, 226), (196, 224, 246), (228, 242, 255), (240, 248, 255)]
GOLD = [(168, 112, 24), (228, 172, 48), (255, 218, 96), (255, 246, 196)]
EYE = (18, 22, 40)
MOUTH = (100, 28, 44)
BOLT = [(250, 196, 40), (255, 236, 110), (255, 255, 230)]
WHITE = (255, 255, 250)
DUST = [(110, 120, 140), (160, 170, 190)]
G = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def oval(c, rx, ry, a=0.0, n=20):
    return xf(c, a, [(rx * math.cos(2 * math.pi * i / n), ry * math.sin(2 * math.pi * i / n)) for i in range(n)])


def bolt_tail(cv, root, sway=0.0):
    """번개 모양 꼬리: 뒤로 솟으며 두 번 꺾이는 넓적한 지그재그."""
    r = root
    s = sway
    pts = [add(r, (1, 0)), add(r, (-6, -5 + s)), add(r, (-4, -6 + s)), add(r, (-11, -13 + s * 2)), add(r, (-8, -14 + s * 2)),
           add(r, (-15, -24 + s * 3)), add(r, (-6, -17 + s * 2)), add(r, (-9, -16 + s * 2)), add(r, (-2, -9 + s)),
           add(r, (-4, -8 + s)), add(r, (2, -3))]
    cv.part(poly(cv.blank(), pts), GOLD)
    cv.part(poly(cv.blank(), [add(r, (1, 0)), add(r, (-5, -5 + s)), add(r, (-2, -7 + s)), add(r, (2, -3))]), FUR, gloss=False)


def hind_leg(cv, hip, foot, far=False):
    """둥근 넓적다리(굽힌 무릎) -> 뒤로 솟은 뒤꿈치 -> 바닥에 길게 닿는 발(토끼·캥거루 뒷다리)."""
    ramp = FUR_FAR if far else FUR
    foot = add(foot, (0, -1))
    heel = add(foot, (-6, -2))
    cv.part(chain([add(hip, (0, 3)), heel], [4.6, 3.0]), ramp, gloss=False)
    f = rnd(foot)
    h = rnd(heel)
    cv.part(poly(cv.blank(), [(h[0] - 1, h[1] - 1), (h[0] + 2, h[1] - 1), (f[0] + 3, f[1] - 1), (f[0] + 4, f[1] + 1), (h[0] - 1, f[1] + 1)]), ramp, gloss=False)
    cv.part(poly(cv.blank(), oval(add(hip, (1, 1)), 4.0, 5.0, -20)), ramp)
    if not far:
        cv.pixel(f[0] + 4, f[1], GOLD[2])
        cv.pixel(f[0] + 2, f[1] + 1, GOLD[2])


def arm(cv, sh, ang, ln=6.0, far=False):
    ramp = FUR_FAR if far else FUR
    el = polar(sh, ang, ln * 0.55)
    paw = polar(el, ang - 35, ln * 0.55)
    cv.part(chain([sh, el, paw], [3.0, 2.6, 2.8]), ramp, gloss=False)
    return paw


def ear(cv, base0, base1, tip, ramp, ink=None):
    """끝이 살짝 둥근 긴 귀."""
    mid = lerp(base0, base1, 0.5)
    c = lerp(tip, mid, 0.12)
    n = math.hypot(tip[0] - mid[0], tip[1] - mid[1]) or 1
    px, py = -(tip[1] - mid[1]) / n * 1.3, (tip[0] - mid[0]) / n * 1.3
    M = np.array(poly(cv.blank(), [base0, (c[0] + px, c[1] + py), (c[0] - px, c[1] - py), base1])) | np.array(ellipse(cv.blank(), c, 1.3, 1.3))
    return cv.part(M > 0, ramp, ink=ink, gloss=False)


def head(cv, hc, tilt=0, mouth=0, eye="open", ears=0.0, cheek=0):
    """크고 둥근 머리, 작고 둥근 주둥이, 머리 안의 큰 눈, 눈 아래 뒤쪽 뺨의 금색 전기 주머니."""
    P = lambda *pts: xf(hc, tilt, pts)
    e = ears
    # 먼 귀
    ear(cv, P((-7, -3))[0], P((-2, -6))[0], P((-11 - e * 7, -17 + e * 7))[0], FUR_FAR)
    # 머리(크고 둥글게) + 작고 둥근 주둥이
    M = np.array(poly(cv.blank(), xf(hc, tilt, oval((0, 0), 9.4, 8.4)))) | np.array(poly(cv.blank(), xf(hc, tilt, oval((8.0, 2.0), 3.2, 2.6))))
    cv.part(M > 0, FUR)
    cv.put(poly(cv.blank(), xf(hc, tilt, oval((8.0, 3.0), 2.4, 1.4, n=12))), BELLY[1])
    cv.pixel(*rnd(P((11, 1))[0]), INK)  # 코
    if mouth:
        cv.put(poly(cv.blank(), P((6, 4), (10, 4), (9, 4 + mouth), (7, 4 + mouth))), MOUTH)
    else:
        cv.line([P((7, 4))[0], P((8, 5))[0], P((10, 4))[0]], INK)
    # 가까운 귀(안쪽 금색, 끝이 둥글다)
    tip = P((-4 - e * 9, -21 + e * 9))[0]
    ear(cv, P((-6, -5))[0], P((1, -7))[0], tip, FUR)
    cv.part(poly(cv.blank(), [P((-3.5, -7))[0], P((-3.5 - e * 8, -18 + e * 8))[0], P((-0.5, -7))[0]]), [GOLD[1], GOLD[2], GOLD[2], GOLD[2]], ink=FUR[0], gloss=False)
    # 눈(3x4 검은 눈 + 흰 반짝임)
    ey = rnd(P((3, -2))[0])
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (0, 1)), add(ey, (2, 0))], INK)
    elif eye == "x":
        cv.line([add(ey, (-1, -1)), add(ey, (1, 1))], INK)
        cv.line([add(ey, (1, -1)), add(ey, (-1, 1))], INK)
    else:
        cv.put(poly(cv.blank(), [add(ey, (-1, -2)), add(ey, (1, -2)), add(ey, (1, 1)), add(ey, (-1, 1))]), EYE)
        cv.pixel(ey[0] - 1, ey[1] - 2, WHITE)
        cv.pixel(ey[0], ey[1] - 2, WHITE)
        cv.pixel(ey[0] - 1, ey[1] - 1, WHITE)
        cv.pixel(ey[0] + 1, ey[1] + 1, FUR[2])
    # 뺨 전기 주머니(눈 아래 뒤쪽)
    ck = P((0, 4))[0]
    cv.part(ellipse(cv.blank(), ck, 2.2, 1.7), [GOLD[1], GOLD[2], GOLD[2], GOLD[3]] if not cheek else [GOLD[2], GOLD[3], GOLD[3], WHITE], ink=INK, gloss=False)
    return dict(cheek=rnd(ck), mouth=P((10, 4))[0], snout=P((11, 1))[0], top=P((0, -8))[0])


BASE = dict(x=32.0, bob=0.0, lean=0.0, hdx=0.0, tilt=0, mouth=0, eye="open", ears=0.0, cheek=0, sway=0.0,
            arm=40.0, feet=(0.0, 0.0), lift=(0.0, 0.0))


def params(name):
    p = dict(BASE)
    if name == "idle_b":
        p.update(bob=1.0, sway=1.0, arm=50.0, ears=0.1)
    elif name == "idle_c":
        p.update(bob=-1.0, sway=-1.0, arm=25.0, tilt=-5, mouth=1, cheek=1)
    elif name == "windup":  # 웅크려 볼에 전기를 모은다
        p.update(x=29.0, bob=4.0, lean=-10, tilt=8, ears=0.5, cheek=1, arm=110.0, sway=2.0, feet=(-1.0, -2.0))
    elif name == "move":  # 깡충 뛰어 앞으로
        p.update(x=34.0, bob=-6.0, lean=18, tilt=-4, ears=0.7, arm=-20.0, sway=-2.0, feet=(-4.0, -6.0), lift=(-5.0, -3.0))
    elif name == "attack":  # 머리부터 몸통 박치기
        p.update(x=36.0, bob=2.0, lean=32, tilt=10, mouth=3, ears=0.6, arm=-30.0, cheek=1, feet=(-6.0, -10.0))
    elif name == "recover":  # 스킬: 버티고 서서 볼에서 번개
        p.update(x=22.0, bob=0.0, lean=-6, tilt=-6, mouth=3, cheek=1, ears=0.4, arm=-10.0, sway=1.0)
    elif name == "hit":
        p.update(x=29.0, bob=1.0, lean=-20, tilt=-18, mouth=2, eye="shut", ears=0.55, arm=150.0, sway=-2.0, feet=(-2.0, 1.0))
    return p


def creature(cv, P):
    x, bob, lean = P["x"], P["bob"], P["lean"]
    hip = (x - 3, 48 + bob)
    bc = add(hip, xf((0, 0), lean, [(2, -7)])[0])
    sh = add(hip, xf((0, 0), lean, [(4, -13)])[0])
    hc = add(hip, xf((0, 0), lean, [(5 + P["hdx"], -21)])[0])
    f1, f2 = P["feet"]
    l1, l2 = P["lift"]
    bolt_tail(cv, add(hip, (-4, -1)), P["sway"])
    hind_leg(cv, add(hip, (2, 0)), (x + 1 + f2, G + l2), far=True)
    arm(cv, add(sh, (-1, 0)), P["arm"] + 15, far=True)
    cv.part(poly(cv.blank(), xf(bc, lean, oval((0, 0), 6.6, 9.0))), FUR)
    cv.part(poly(cv.blank(), xf(bc, lean, oval((2.4, 1), 3.6, 6.6))), BELLY, gloss=False)
    # 배의 금색 번개 무늬
    cv.put(poly(cv.blank(), xf(bc, lean, [(3, -4), (0, 0), (2.6, 0), (1, 4), (5, -1), (2.4, -1), (4, -4)])), GOLD[2])
    hind_leg(cv, hip, (x - 2 + f1, G + l1))
    j = head(cv, hc, P["tilt"] + lean * 0.3, P["mouth"], P["eye"], P["ears"], P["cheek"])
    j["paw"] = arm(cv, sh, P["arm"])
    return j


def zig(cv, a, b, n, amp, colors, seed=0):
    pts = [a]
    for i in range(1, n):
        t = i / n
        p = lerp(a, b, t)
        pts.append((p[0], p[1] + (amp if (i + seed) % 2 else -amp)))
    pts.append(b)
    cv.line(pts, colors[0], 3)
    cv.line(pts, colors[1], 1)
    return pts


def draw_dead(cv):
    bolt_tail(cv, (18, 56), 3)
    cv.part(poly(cv.blank(), oval((28, 55), 9, 4.6)), FUR)
    cv.part(chain([(22, 56), (16, 58)], [4, 3]), FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), oval((42, 54), 8.0, 5.8)), FUR)
    for ex, ey in ((38, 50), (41, 50)):
        cv.part(poly(cv.blank(), [(ex, ey), (ex - 9, ey - 2), (ex - 8, ey + 1)]), FUR, gloss=False)
    cv.part(poly(cv.blank(), oval((49, 56), 3.0, 2.4)), FUR, gloss=False)
    cv.pixel(52, 55, INK)
    cv.part(ellipse(cv.blank(), (42, 57), 2, 1.5), [GOLD[0], GOLD[1], GOLD[1], GOLD[1]], gloss=False)
    cv.line([(44, 51), (46, 53)], INK)
    cv.line([(46, 51), (44, 53)], INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 9, (32, 38, 44), FUR[2])
    j = creature(cv, P)
    ck = j["cheek"]
    if name == "windup":
        for dx, dy in ((-3, 2), (3, 3)):
            sparkle(cv, add(ck, (dx, dy + 2)), WHITE, BOLT[0])
        puff(cv, (24, 58), 1.6, DUST)
    elif name == "move":
        puff(cv, (14, 58), 2.0, DUST)
    elif name == "attack":
        burst(cv, add(j["snout"], (3, -1)), 5.0, BOLT[0], WHITE, spikes=7)
        zig(cv, add(j["snout"], (-6, -8)), add(j["snout"], (1, -14)), 3, 1.5, (BOLT[0], WHITE))
    elif name == "recover":
        a = add(ck, (2, 0))
        zig(cv, a, (61, ck[1] - 6), 6, 3, (BOLT[0], BOLT[2]))
        zig(cv, (46, ck[1] - 4), (57, ck[1] - 14), 2, 2, (BOLT[0], BOLT[2]), seed=1)
        for dx, dy in ((-5, 3), (-3, -4)):
            sparkle(cv, add(ck, (dx, dy)), WHITE, BOLT[0])
        burst(cv, (59, ck[1] - 6), 3.0, BOLT[1], WHITE, spikes=6)
    elif name == "hit":
        t = j["top"]
        for dx, dy in ((8, -2), (11, 1), (10, -5)):
            cv.pixel(t[0] + dx, t[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("sparkit-01", draw, sys.argv[1:], idle_ms=180)
