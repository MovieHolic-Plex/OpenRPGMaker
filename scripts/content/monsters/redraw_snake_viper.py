#!/usr/bin/env python3
"""독사(snake-viper) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

땅에 똬리를 튼 몸(먼 쪽 고리는 어둡게, 가까운 쪽은 밝게) 위로 S자 목이 솟고, 삼각 독사 머리가 오른쪽을 본다.
6번 칸(스킬 skill_mon_venom_fang): 아가리를 쩍 벌리고 보랏빛 독이 흐르는 송곳니를 내리꽂으며 독액이 튄다.

  python3 scripts/content/monsters/redraw_snake_viper.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (16, 34, 24)
SCALE = [(34, 84, 46), (62, 132, 60), (112, 178, 74), (186, 224, 120)]
SCALE_FAR = [(24, 60, 36), (36, 88, 48), (60, 124, 60), (60, 124, 60)]
BELLY = [(170, 150, 70), (222, 202, 108), (246, 232, 156), (255, 248, 200)]
DIAMOND = (24, 50, 30)
EYE, SLIT = (250, 206, 52), (30, 16, 10)
MOUTH = [(110, 30, 44), (170, 52, 64), (212, 94, 100), (212, 94, 100)]
FANG = (250, 248, 232)
TONGUE = (220, 50, 70)
VENOM = [(78, 30, 108), (150, 64, 196), (210, 140, 250), (246, 220, 255)]
DUST = [(150, 132, 104), (196, 178, 140)]
WHITE = (255, 252, 236)


def xf(h, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(h[0] + x * c - y * s, h[1] + x * s + y * c) for x, y in pts]


def ring(c, rx, ry, a0, a1, step):
    return [(c[0] + rx * math.cos(math.radians(a)), c[1] + ry * math.sin(math.radians(a))) for a in range(a0, a1, step)]


def draw_coil(cv, c, rx, ry, phase=0.0):
    """두 겹 똬리: 아래 큰 고리(먼 반쪽 어둡게 → 가까운 반쪽 밝게) 위에 작은 고리를 한 겹 더 얹는다."""
    far = ring(c, rx, ry, 0, -181, -20)
    cv.part(chain(far, [6.5] * len(far)), SCALE_FAR, gloss=False)
    near = ring(c, rx, ry, 180, -1, -20)
    tail = [(c[0] - rx - 3, c[1] + ry - 1), (c[0] - rx - 8, c[1] + ry + 1), (c[0] - rx - 12 + phase, c[1] + ry + 1)]
    cv.part(chain(tail[::-1] + [near[0]], [1.5, 3.0, 5.0, 7.0]), SCALE, gloss=False)
    cv.part(chain(near, [7.5] * len(near)), SCALE, belly=BELLY[1])
    top_c = (c[0] + 2, c[1] - 5)
    upper = ring(top_c, rx - 4, ry - 1.5, 200, -21, -20)
    cv.part(chain(upper, [6.5] * len(upper)), SCALE)
    for p in near[1:-1] + upper[1:-1:2]:  # 마름모 무늬
        x, y = rnd(p)
        cv.pixel(x, y - 2, DIAMOND)
        cv.pixel(x - 1, y - 1, DIAMOND)
        cv.pixel(x + 1, y - 1, DIAMOND)
        cv.pixel(x, y - 3, SCALE[3])
    return upper[-1]


def draw_neck(cv, base, ctrl, head, w0=7.5, w1=4.5):
    """목: 굵은 밑동에서 가늘어지며, 앞쪽(오른쪽)에 크림색 배 비늘 띠가 보이게 배 → 등 순으로 겹친다."""
    pts = bezier(base, ctrl, head, 8)
    widths = [w0 + (w1 - w0) * i / 8 for i in range(9)]
    cv.part(chain(pts, widths), BELLY, gloss=False)
    back = [add(p, (-1.4, -0.6)) for p in pts]
    cv.part(chain(back, [w - 1.6 for w in widths]), SCALE)
    for i in range(2, 8, 2):
        x, y = rnd(back[i])
        cv.pixel(x - 1, y, DIAMOND)
    for i in range(1, 8):  # 배 비늘 가로줄
        p = pts[i]
        cv.pixel(p[0] + widths[i] / 2 - 1, p[1], BELLY[0])


def draw_head(cv, h, a, gape=0.0, tongue=0, eye="open", venom=False):
    """삼각 독사 머리(뒤턱이 넓은 쐐기). h=목과 머리 이음, a=머리 방향(0=오른쪽). gape=아가리 벌린 각."""
    up = [(-3, -2), (-1, -6), (4, -7), (9, -6), (14, -3), (16, -1), (16, 1), (2, 1), (-3, 3)]
    lo = [(-2, 1), (2, 1), (14, 1), (13, 3), (6, 5), (-1, 5)]
    au, al = a - gape * 0.55, a + gape * 0.45
    pivot = xf(h, a, [(0, 1)])[0]
    if gape > 4:  # 입속(붉은 잇몸)
        inside = [pivot, xf(pivot, au, [(15, 0)])[0], xf(pivot, al, [(13, 1)])[0]]
        cv.part(poly(cv.blank(), inside), MOUTH, gloss=False)
    lower = xf(pivot, al, [(x, y - 1) for x, y in lo])
    cv.part(poly(cv.blank(), lower), BELLY, gloss=False)
    upper = xf(pivot, au, [(x, y - 1) for x, y in up])
    cv.part(poly(cv.blank(), upper), SCALE)
    # 머리 위 마름모 + 눈썹 비늘
    crown = xf(pivot, au, [(4, -5), (5, -4), (3, -4), (8, -5)])
    for p in crown:
        cv.pixel(p[0], p[1], DIAMOND)
    brow = xf(pivot, au, [(9, -6), (10, -6), (11, -5)])
    for p in brow:
        cv.pixel(p[0], p[1], SCALE[3])
    e = xf(pivot, au, [(10, -4)])[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    elif eye == "x":
        for d in ((-1, -1), (1, 1), (-1, 1), (1, -1), (0, 0)):
            cv.pixel(e[0] + d[0], e[1] + d[1], INK)
    else:
        cv.pixel(e[0], e[1], EYE)
        cv.pixel(e[0] + 1, e[1], EYE)
        cv.pixel(e[0], e[1] - 1, EYE)
        cv.pixel(e[0] + 1, e[1] - 1, SLIT)
        cv.pixel(e[0] + 1, e[1] + 0, SLIT)
    nostril = xf(pivot, au, [(15, -2)])[0]
    cv.pixel(nostril[0], nostril[1], INK)
    fangs = []
    if gape > 4:  # 위턱 송곳니 둘(앞이 길다)
        for fx, ln in ((13, 5 if venom else 4), (9, 3)):
            root = xf(pivot, au, [(fx, 0)])[0]
            tip = polar(root, au + 100, ln)
            cv.line([root, tip], VENOM[2] if venom else FANG)
            cv.line([add(root, (1, 0)), add(tip, (1, 0))], VENOM[3] if venom else FANG)
            cv.pixel(tip[0], tip[1], VENOM[3] if venom else WHITE)
            fangs.append(tip)
    if tongue:
        t0 = xf(pivot, a, [(16, 0)])[0]
        t1 = polar(t0, a + 6, tongue)
        cv.line4([t0, t1], TONGUE)
        cv.line4([t1, polar(t1, a - 40, 2)], TONGUE)
        cv.line4([t1, polar(t1, a + 50, 2)], TONGUE)
    snout = xf(pivot, au, [(16, 0)])[0]
    return dict(snout=snout, fangs=fangs, eye=e, pivot=pivot)


BASE = dict(coil=(24.0, 53.0), rx=13.0, ry=5.0, neck_c=(30.0, 30.0), head=(40.0, 25.0), ang=6, gape=0, tongue=0,
            eye="open", phase=0, venom=False)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 목을 낮추며 혀를 날름
        p.update(neck_c=(29.0, 33.0), head=(40.0, 28.0), ang=10, tongue=6, phase=1)
    elif name == "idle_c":  # 목을 곧추세워 위협
        p.update(neck_c=(31.0, 27.0), head=(41.0, 22.0), ang=2, phase=-1, gape=8)
    elif name == "windup":  # 목을 뒤로 바짝 접어 S 를 감고 아가리를 쩍
        p.update(coil=(25.0, 53.0), neck_c=(42.0, 34.0), head=(31.0, 20.0), ang=-18, gape=46, rx=12.0)
    elif name == "move":  # 몸을 길게 펴서 바닥을 미끄러진다
        p.update(coil=(22.0, 54.0), rx=15.0, ry=4.0, neck_c=(44.0, 52.0), head=(48.0, 44.0), ang=4, phase=3)
    elif name == "attack":  # 목을 앞으로 내쏘아 물기
        p.update(coil=(21.0, 53.0), rx=12.0, neck_c=(38.0, 30.0), head=(42.0, 34.0), ang=24, gape=52)
    elif name == "recover":  # 스킬 독니: 머리를 높이 쳐들어 독 송곳니를 드러내고 독을 뿜는다
        p.update(neck_c=(27.0, 30.0), head=(36.0, 22.0), ang=-12, gape=64, venom=True)
    elif name == "hit":  # 맞고 머리가 뒤로 젖혀진다
        p.update(coil=(26.0, 54.0), rx=11.0, ry=4.5, neck_c=(26.0, 38.0), head=(32.0, 27.0), ang=-50, eye="shut",
                 gape=14)
    return p


def draw_dead(cv):
    """몸이 바닥에 길게 늘어지고 배가 드러난 채 머리를 떨군 모습."""
    pts = [(3, 58), (8, 59), (15, 58), (22, 56), (30, 57), (37, 58), (42, 57)]
    cv.part(chain(pts, [2, 4, 6, 7, 7, 6, 6]), SCALE)
    for p in pts[2:6]:
        cv.pixel(p[0], p[1] + 2, BELLY[1])
        cv.pixel(p[0] + 1, p[1] + 2, BELLY[1])
        cv.pixel(p[0], p[1] - 2, DIAMOND)
    draw_head(cv, (42, 57), 10, gape=18, eye="x")
    cv.line4([(58, 58), (60, 58), (61, 59)], TONGUE)


def draw_snake(cv, P):
    neck_base = draw_coil(cv, P["coil"], P["rx"], P["ry"], P["phase"])
    draw_neck(cv, add(neck_base, (-1, -1)), P["neck_c"], P["head"])
    return draw_head(cv, P["head"], P["ang"], P["gape"], P["tongue"], P["eye"], P["venom"])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_snake(Canvas(64, INK), P)
    if name == "attack":
        slash(cv, add(j["snout"], (-6, -14)), add(j["snout"], (6, 10)), -6, 4.0, (210, 236, 200), WHITE)
    elif name == "move":
        puff(cv, (9, 56), 4.0, DUST)
    elif name == "recover":
        glow(cv, add(j["eye"], (-2, 0)), 13, [VENOM[0], VENOM[1]])
    elif name == "windup":
        glow(cv, add(j["pivot"], (4, 0)), 6, [VENOM[0]])
    j = draw_snake(cv, P)
    if name == "attack":
        burst(cv, add(j["snout"], (2, 4)), 5.0, (210, 236, 200), WHITE, spikes=6, rot=12)
    elif name == "recover":
        # 독 송곳니에서 아군 쪽으로 쏟아지는 보랏빛 독 방울 줄기
        f = j["fangs"][0]
        for k, p in enumerate(bezier(add(f, (2, 2)), (f[0] + 14, f[1] - 2), (61, f[1] + 18), 7)[1:], 1):
            r = max(0.8, 2.4 - k * 0.25)
            cv.put(ellipse(cv.blank(), p, r + 0.8, r + 0.8), VENOM[0])
            cv.put(ellipse(cv.blank(), p, r, r), VENOM[1] if k % 2 else VENOM[2])
            cv.pixel(p[0] - 0.5, p[1] - 0.8, VENOM[3])
        sparkle(cv, add(j["eye"], (-6, -10)), VENOM[3], VENOM[2], big=True)
        sparkle(cv, add(f, (12, -8)), VENOM[3], VENOM[2])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((6, -4), (8, -6), (7, -2), (9, -3)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("snake-viper", draw, sys.argv[1:], idle_ms=170)
