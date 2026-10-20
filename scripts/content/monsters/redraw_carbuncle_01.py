#!/usr/bin/env python3
"""금빛 이마 보석 카벙클(carbuncle-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

작은 네발 짐승(여우·고양이 사이): 청록 털에 밝은 크림색 턱·가슴, 몸보다 큰 둥근 머리, 머리 안의 크고 둥근 눈(흰 반짝임),
안쪽이 분홍인 길고 뾰족한 두 귀, 짧고 굵은 네 다리에 뭉툭한 발, 등 뒤로 솟아 소용돌이처럼 말린 아주 큰 꼬리.
이마 한가운데 깎은 면이 보이는 금빛 보석이 박혀 있다.
6번 칸(스킬 보석 광선): 이마 보석이 번쩍이며 금빛 무지개 광선과 보석 조각을 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_carbuncle_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, chain, ellipse, ik_side, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (14, 38, 44)
FUR = [(40, 112, 112), (66, 158, 150), (110, 200, 182), (176, 236, 214)]
FUR_FAR = [(28, 82, 86), (40, 112, 112), (52, 132, 130), (52, 132, 130)]
CREAM = [(170, 214, 196), (214, 240, 226), (240, 252, 244), (255, 255, 250)]
PINK = (238, 132, 150)
GOLD = [(150, 92, 16), (218, 156, 36), (255, 212, 80), (255, 248, 196)]
EYE = (22, 30, 40)
MOUTH = (110, 30, 46)
BEAM = [(238, 132, 150), (110, 220, 230), (255, 212, 80), (255, 250, 220)]
WHITE = (255, 255, 250)
DUST = [(120, 140, 130), (170, 190, 180)]
G = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def oval(c, rx, ry, a=0.0, n=20):
    return xf(c, a, [(rx * math.cos(2 * math.pi * i / n), ry * math.sin(2 * math.pi * i / n)) for i in range(n)])


def tail(cv, root, curl=0.0, lift=0.0):
    """등 뒤로 솟아 안쪽으로 말린 큰 꼬리: 바깥 고리 + 안쪽 말림(따로 외곽선을 둘러 소용돌이가 보이게)."""
    c = add(root, (-6 - lift * 0.5, -10 - lift))
    pts = []
    for i in range(15):
        t = i / 14
        th = math.radians(110 + t * 330 + curl * 8)
        r = 9.2 - t * 5.2
        pts.append((c[0] + math.cos(th) * r, c[1] + math.sin(th) * r))
    outer = [root] + pts[:9]
    cv.part(chain(outer, [5.0, 5.6, 6.0, 6.0, 6.0, 5.8, 5.4, 5.0, 4.6, 4.2]), FUR)
    inner = pts[7:]
    cv.part(chain(inner, [4.2, 3.8, 3.4, 3.2, 3.0, 2.8, 2.6, 2.4]), [FUR[1], FUR[2], FUR[3], CREAM[3]])
    cv.pixel(*rnd(pts[-1]), CREAM[2])
    return c


def leg(cv, hip, foot, far=False, front=True):
    ramp = FUR_FAR if far else FUR
    foot = add(foot, (0, -1.5))
    mid = add(lerp(hip, foot, 0.5), (1.0 if front else -1.0, 0))
    cv.part(chain([hip, mid, foot], [5.2, 4.2, 3.8]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(ellipse(cv.blank(), (f[0] + 1, f[1] + 0.5), 2.6, 1.6), ramp, gloss=False)
    if not far:
        cv.pixel(f[0] + 3, f[1] + 1, CREAM[1])
        cv.pixel(f[0] + 1, f[1] + 1, CREAM[0])


def gem(cv, c, flare=0):
    """깎은 면이 보이는 마름모 보석(위 면 밝게, 아래 면 어둡게)."""
    x, y = rnd(c)
    cv.part(poly(cv.blank(), [(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)]), [GOLD[1]] * 4, gloss=False)
    cv.pixel(x, y - 1, GOLD[2])
    cv.pixel(x + 1, y, GOLD[2])
    cv.pixel(x, y + 1, GOLD[0])
    cv.pixel(x - 1, y, GOLD[3])
    cv.pixel(x, y, GOLD[3] if not flare else WHITE)
    if flare:
        cv.pixel(x - 1, y - 1, WHITE)
        cv.pixel(x, y - 2, WHITE)


def head(cv, hc, tilt=0, mouth=0, eye="open", ears=0.0, flare=0):
    P = lambda *pts: xf(hc, tilt, pts)
    e = ears
    # 먼 귀(뒤)
    far_ear = P((-5, -4), (-9 - e * 5, -17 + e * 6), (-1, -6))
    cv.part(poly(cv.blank(), far_ear), FUR_FAR, gloss=False)
    # 머리(크고 둥글게) + 작은 주둥이
    cv.part(poly(cv.blank(), xf(hc, tilt, oval((0, 0), 9.4, 8.0))), FUR)
    cv.part(poly(cv.blank(), P((4, 2), (10, 1), (12, 3), (11, 5), (6, 6), (3, 5))), CREAM, gloss=False)
    # 뺨 털 삐침
    cv.part(poly(cv.blank(), P((-3, 3), (-8, 7), (-2, 6))), FUR, gloss=False)
    cv.pixel(*rnd(P((12, 2))[0]), INK)  # 코
    if mouth:
        jaw = P((5, 5), (11, 5 + mouth), (6, 6 + mouth))
        cv.put(poly(cv.blank(), P((5, 4), (11, 4)) + [jaw[1], jaw[2]]), MOUTH)
        cv.pixel(*rnd(P((10, 4))[0]), WHITE)
        cv.part(poly(cv.blank(), jaw), CREAM, gloss=False)
    else:
        cv.line([P((7, 5))[0], P((9, 5))[0], P((11, 4))[0]], INK)
    # 가까운 귀(안쪽 분홍)
    near = P((-2, -5), (-3 - e * 6, -19 + e * 7), (4, -6))
    cv.part(poly(cv.blank(), near), FUR, gloss=False)
    cv.part(poly(cv.blank(), P((-1, -7), (-2.5 - e * 5, -16 + e * 6), (2, -7))), [PINK] * 4, ink=FUR[0], gloss=False)
    # 눈(크고 둥글게, 머리 안)
    ey = rnd(P((5, 0))[0])
    if eye == "shut":
        cv.line([add(ey, (-2, 0)), add(ey, (0, 1)), add(ey, (2, 0))], INK)
    elif eye == "x":
        cv.line([add(ey, (-1, -1)), add(ey, (1, 1))], INK)
        cv.line([add(ey, (1, -1)), add(ey, (-1, 1))], INK)
    else:
        cv.put(poly(cv.blank(), [add(ey, (-2, -2)), add(ey, (1, -3)), add(ey, (2, -1)), add(ey, (2, 2)), add(ey, (-2, 2))]), EYE)
        cv.put(poly(cv.blank(), [add(ey, (-1, -2)), add(ey, (0, -2)), add(ey, (0, -1)), add(ey, (-1, -1))]), WHITE)
        cv.pixel(ey[0] + 1, ey[1] + 1, FUR[3])
    g = P((1, -6))[0]
    gem(cv, g, flare)
    return dict(gem=rnd(g), mouth=P((11, 4))[0])


BASE = dict(bc=(30.0, 49.0), pitch=0.0, hc=(42.0, 36.0), tilt=0, mouth=0, eye="open", ears=0.0, flare=0,
            curl=0.0, lift=0.0, feet=((41, 0), (37, 0), (24, 0), (20, 0)))


def params(name):
    p = dict(BASE)
    if name == "idle_b":
        p.update(bc=(30.0, 49.5), hc=(42.0, 37.0), curl=1.0, lift=-1, ears=0.15)
    elif name == "idle_c":
        p.update(bc=(30.0, 48.5), hc=(42.0, 35.5), tilt=-6, curl=-1.0, lift=1, mouth=1, flare=1)
    elif name == "windup":  # 앞을 낮추고 엉덩이를 들어 덮칠 준비
        p.update(bc=(27.0, 50.0), pitch=10, hc=(39.0, 42.0), tilt=6, ears=0.7, lift=2, curl=2.0,
                 feet=((40, 0), (35, 0), (20, 0), (16, 0)))
    elif name == "move":  # 공중으로 뛰어오름
        p.update(bc=(34.0, 42.0), pitch=-12, hc=(47.0, 31.0), tilt=-8, ears=1.0, lift=-3, curl=-2.0,
                 feet=((53, -9), (50, -6), (19, -4), (15, -2)))
    elif name == "attack":  # 덮치며 앞발로 할퀸다
        p.update(bc=(32.0, 48.0), pitch=-14, hc=(44.0, 33.0), tilt=4, mouth=3, ears=0.9,
                 feet=((52, -12), (42, 0), (25, 0), (21, 0)))
    elif name == "hit":
        p.update(bc=(27.0, 49.0), pitch=6, hc=(38.0, 35.0), tilt=-18, mouth=2, eye="shut", ears=1.0, lift=-2, curl=-3,
                 feet=((37, 0), (33, 0), (21, 0), (16, 0)))
    elif name == "recover":  # 스킬: 머리를 들고 이마 보석에서 광선
        p.update(bc=(22.0, 49.0), pitch=-6, hc=(34.0, 34.0), tilt=-8, mouth=2, ears=0.4, flare=1, lift=1, curl=1,
                 feet=((34, 0), (30, 0), (16, 0), (12, 0)))
    return p


def creature(cv, P):
    bc, pitch = P["bc"], P["pitch"]
    hp = xf(bc, pitch, [(-7, 1)])[0]
    sh = xf(bc, pitch, [(5, 1)])[0]
    (f1x, f1y), (f2x, f2y), (b1x, b1y), (b2x, b2y) = P["feet"]
    tail(cv, xf(bc, pitch, [(-8, -2)])[0], P["curl"], P["lift"])
    leg(cv, add(sh, (1, 0)), (f2x, G + f2y), far=True)
    leg(cv, add(hp, (1, 0)), (b2x, G + b2y), far=True, front=False)
    hc = P["hc"]
    import numpy as np
    M = np.array(poly(cv.blank(), xf(bc, pitch, oval((0, 0), 10, 6.4)))) | np.array(chain([add(sh, (0, -2)), add(hc, (-2, 3))], [8, 7]))
    cv.part(M > 0, FUR)
    cv.put(poly(cv.blank(), xf(bc, pitch, [(2, 4), (8, 3), (7, 5), (0, 6)])), CREAM[1])
    # 가슴 털(크림색 복슬)
    cv.put(poly(cv.blank(), [add(sh, (3, -3)), add(hc, (2, 6)), add(sh, (8, 0)), add(sh, (7, 3)), add(sh, (5, 2)), add(sh, (4, 4)), add(sh, (2, 1))]), CREAM[1])
    leg(cv, add(hp, (-1, 1)), (b1x, G + b1y), front=False)
    if P["feet"][0][1] < -8 and P["mouth"]:  # 할퀴는 앞발(위로 쳐든다)
        paw = (f1x, G + f1y)
        cv.part(chain([add(sh, (0, 0)), lerp(sh, paw, 0.5), paw], [5.0, 4.0, 3.6]), FUR, gloss=False)
        cv.part(ellipse(cv.blank(), add(paw, (1, 0)), 2.4, 2.0), FUR, gloss=False)
        for k in (-1, 1, 3):
            cv.line([add(paw, (3, k - 1)), add(paw, (5, k))], CREAM[2])
    else:
        leg(cv, sh, (f1x, G + f1y))
    return head(cv, hc, P["tilt"], P["mouth"], P["eye"], P["ears"], P["flare"])


def draw_dead(cv):
    tail(cv, (20, 54), 2, -6)
    cv.part(poly(cv.blank(), oval((27, 55), 11, 4.4)), FUR)
    for h, f in (((23, 56), (19, 51)), ((33, 56), (37, 51))):
        cv.part(chain([h, f], [3.4, 3]), FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), oval((43, 55), 7.4, 4.6)), FUR)
    cv.part(poly(cv.blank(), [(38, 52), (32, 47), (42, 51)]), FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(47, 56), (52, 55), (51, 58), (46, 59)]), CREAM, gloss=False)
    cv.line([(43, 53), (45, 55)], INK)
    cv.line([(45, 53), (43, 55)], INK)
    x, y = 41, 50
    cv.part(poly(cv.blank(), [(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)]), [GOLD[0], GOLD[1], GOLD[1], GOLD[2]], gloss=False)


def beam(cv, g):
    """이마 보석에서 오른쪽으로 뻗는 무지개 광선 + 보석 조각."""
    x0, y0 = g[0] + 2, g[1]
    x1 = 61
    for dy, col in ((-3, BEAM[0]), (3, BEAM[1])):
        cv.line([(x0 + 4, y0 + dy * 0.5), (x1, y0 + dy)], col)
    cv.put(poly(cv.blank(), [(x0, y0 - 1), (x1, y0 - 2), (x1, y0 + 2), (x0, y0 + 1)]), BEAM[2])
    cv.line([(x0, y0), (x1, y0)], BEAM[3])
    # 광원 빛무리(보석 위)
    for a in range(0, 360, 45):
        p = polar(g, a, 4 if a % 90 else 5)
        cv.pixel(*rnd(p), GOLD[2] if a % 90 else WHITE)
    gem(cv, g, 1)
    # 보석 조각
    for (sx, sy) in ((46, y0 - 8), (54, y0 + 7), (58, y0 - 6), (60, y0 + 12)):
        cv.part(poly(cv.blank(), [(sx, sy - 2), (sx + 2, sy), (sx, sy + 2), (sx - 2, sy)]), [GOLD[1], GOLD[2], GOLD[2], GOLD[3]], ink=GOLD[0], gloss=False)
    sparkle(cv, (51, y0 - 12), WHITE, GOLD[2], big=True)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 9, (36, 42, 48), FUR[2])
    j = creature(cv, P)
    if name == "windup":
        sparkle(cv, add(j["gem"], (0, -6)), WHITE, GOLD[2])
        puff(cv, (14, 58), 1.6, DUST)
    elif name == "move":
        puff(cv, (10, 58), 2.0, DUST)
    elif name == "attack":
        slash(cv, (56, 38), (59, 56), 3, 2.2, CREAM[1], WHITE)
        slash(cv, (59, 36), (62, 52), 3, 1.8, CREAM[1], WHITE)
    elif name == "recover":
        beam(cv, j["gem"])
    elif name == "hit":
        g = j["gem"]
        for dx, dy in ((9, -6), (12, -3), (11, -9)):
            cv.pixel(g[0] + dx, g[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("carbuncle-01", draw, sys.argv[1:], idle_ms=190)
