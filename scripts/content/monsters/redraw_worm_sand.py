#!/usr/bin/env python3
"""모래 지렁이(worm-sand) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

모래 둔덕을 뚫고 솟은 굵은 황갈색 마디 지렁이: 마디마다 짙은 고리 주름과 밝은 등 윤기, 아래쪽은 연한 배.
머리 끝은 앞(오른쪽)을 향한 둥근 아가리로, 벌리면 안쪽에 고리 모양으로 돋은 흰 이빨 줄이 보인다.
6번 칸(스킬, 아키타입 venom): 몸을 높이 치켜들고 아가리를 활짝 벌려 누런 독 모래 줄기를 아군 쪽으로 뿜는다.

  python3 scripts/content/monsters/redraw_worm_sand.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (34, 22, 14)
SKIN = [(120, 80, 46), (170, 120, 70), (206, 160, 100), (236, 204, 148)]
BELLY = [(150, 110, 76), (200, 160, 120), (226, 194, 156), (226, 194, 156)]
SAND = [(140, 110, 66), (190, 160, 104), (222, 196, 140), (240, 222, 176)]
MAW = (90, 26, 34)
GULLET = (40, 10, 16)
TOOTH = (250, 244, 224)
SPRAY = [(170, 150, 60), (220, 200, 90), (250, 240, 170)]
WHITE = (255, 252, 240)
GROUND = 60


def mound(cv, cx, w, h):
    """지렁이가 뚫고 나온 모래 둔덕 + 흩어진 알갱이."""
    pts = [(cx - w, GROUND), (cx - w * 0.6, GROUND - h * 0.6), (cx - w * 0.2, GROUND - h),
           (cx + w * 0.3, GROUND - h * 0.9), (cx + w * 0.7, GROUND - h * 0.4), (cx + w, GROUND)]
    cv.part(poly(cv.blank(), pts), SAND, gloss=False)
    for dx, dy in ((-w * 0.4, -h * 0.5), (w * 0.2, -h * 0.6), (w * 0.5, -h * 0.25)):
        cv.pixel(*rnd((cx + dx, GROUND + dy)), SAND[3])


def worm(cv, P):
    """둔덕 속 뿌리 -> 몸 -> 머리. 마디 원을 뒤에서 앞으로 겹쳐 그린다."""
    pts = bezier(P["root"], P["ctrl"], P["head"], 11)
    n = len(pts)
    radii = [7.0 - 1.4 * (i / (n - 1)) ** 1.5 for i in range(n)]
    for i, (p, r) in enumerate(zip(pts, radii)):
        cv.part(ellipse(cv.blank(), p, r, r), SKIN)
        nxt = pts[min(i + 1, n - 1)]
        ang = math.degrees(math.atan2(nxt[1] - p[1], nxt[0] - p[0]))
        # 배(몸 아래쪽 = 진행 방향 오른손 쪽) 밝은 띠
        cv.put(ellipse(cv.blank(), polar(p, ang + 90, r * 0.55), r * 0.45, r * 0.45), BELLY[1])
        # 고리 주름: 진행 방향에 수직인 짧은 선
        if i % 1 == 0 and 0 < i < n - 1:
            a, b = polar(p, ang - 90, r - 0.5), polar(p, ang + 90, r - 0.5)
            cv.line4([lerp(a, b, 0.05), lerp(a, b, 0.7)], SKIN[0])
            cv.pixel(*rnd(polar(p, ang - 90, r - 1.5)), SKIN[3])
    return pts, radii


def head(cv, c, r, ang, gape):
    """둥근 아가리. gape 0=닫힘(입술이 오므라든 별 모양), 1=활짝(이빨 고리)."""
    face = polar(c, ang, r * 0.4)
    cv.part(ellipse(cv.blank(), face, r * 0.95, r * 1.05), SKIN)
    mr = 1.0 + gape * (r * 0.62)
    mc = polar(face, ang, r * 0.35)
    if gape > 0:
        cv.put(ellipse(cv.blank(), mc, mr * 0.7, mr), MAW)
        cv.put(ellipse(cv.blank(), mc, mr * 0.35, mr * 0.55), GULLET)
        for k in range(10):
            t = polar((0, 0), k * 36, 1)
            p = (mc[0] + t[0] * mr * 0.7, mc[1] + t[1] * mr)
            cv.pixel(*rnd(p), TOOTH)
    else:
        for k in range(4):
            cv.line4([mc, polar(mc, ang + 45 + k * 90, 2.2)], SKIN[0])
        cv.pixel(*rnd(mc), MAW)
    # 머리 윗등 감각 돌기 둘
    for da in (-100, -70):
        cv.pixel(*rnd(polar(face, ang + da, r + 0.2)), SKIN[3])
    return mc


BASE = dict(root=(20.0, 60.0), ctrl=(20.0, 22.0), head=(40.0, 26.0), gape=0.0, mound=(22, 14, 7))


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 몸을 반대로 살짝 휘며 고개를 숙인다
        p.update(ctrl=(24.0, 24.0), head=(40.0, 30.0), gape=0.35)
    elif name == "idle_c":  # 뒤로 젖혔다가 아가리를 조금 연다
        p.update(ctrl=(16.0, 22.0), head=(36.0, 24.0), gape=0.6)
    elif name == "windup":  # 몸을 뒤로 휘어 높이 치켜든다
        p.update(ctrl=(6.0, 18.0), head=(26.0, 14.0), gape=0.8)
    elif name == "move":  # 몸을 앞으로 낮게 쭉 뻗어 미끄러진다
        p.update(root=(16.0, 60.0), ctrl=(26.0, 40.0), head=(50.0, 40.0), gape=0.3, mound=(18, 14, 6))
    elif name == "attack":  # 앞으로 내리꽂으며 아가리로 덮친다
        p.update(ctrl=(32.0, 14.0), head=(48.0, 36.0), gape=1.0)
    elif name == "recover":  # 스킬: 높이 치켜들어 아가리를 활짝
        p.update(ctrl=(14.0, 16.0), head=(36.0, 18.0), gape=1.0)
    elif name == "hit":  # 맞아서 뒤로 꺾이고 몸이 움찔
        p.update(ctrl=(8.0, 30.0), head=(22.0, 26.0), gape=0.5)
    return p


def draw_dead(cv):
    """둔덕 위에 축 늘어져 길게 누운 지렁이."""
    mound(cv, 16, 14, 5)
    pts = bezier((14.0, 56.0), (30.0, 46.0), (50.0, 56.0), 10)
    for i, p in enumerate(pts):
        r = 4.6 - i * 0.12
        cv.part(ellipse(cv.blank(), p, r, r * 0.9), SKIN)
        if 0 < i < len(pts) - 1:
            cv.line4([add(p, (0, -r + 1)), add(p, (0, r - 2))], SKIN[0])
    cv.part(ellipse(cv.blank(), (52, 56), 3.6, 3.4), SKIN)
    cv.line([(51, 55), (53, 57)], INK)
    cv.line([(53, 55), (51, 57)], INK)
    puff(cv, (30, 44), 2.2, SAND[:2])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    pts, radii = worm(cv, P)
    hd = pts[-1]
    ang = math.degrees(math.atan2(hd[1] - pts[-3][1], hd[0] - pts[-3][0]))
    ang = max(-40, min(70, ang))
    mc = head(cv, hd, radii[-1] + 0.6, ang, P["gape"])
    mound(cv, *P["mound"])
    if name == "recover":
        jet = bezier(mc, (54, 18), (61, 40), 10)
        for w, col in ((5, SPRAY[0]), (3, SPRAY[1])):
            cv.line(jet, col, width=w)
        cv.line(jet[:7], SPRAY[2])
        for p in ((52, 12), (58, 24), (61, 30), (48, 26), (56, 44)):
            cv.pixel(*p, SPRAY[2])
        puff(cv, (59, 50), 3.0, SAND[1:3])
    elif name == "attack":
        slash(cv, add(mc, (-4, -10)), add(mc, (4, 7)), 3, 3.0, TOOTH, WHITE)
        burst(cv, add(mc, (3, 1)), 4.0, SPRAY[1], WHITE, spikes=6, rot=12)
    elif name == "windup":
        sparkle(cv, add(mc, (4, -4)), WHITE, SPRAY[1])
        for x, y in ((8, 52), (36, 52)):
            cv.pixel(x, y, SAND[3])
    elif name == "move":
        for y in (34, 40, 46):
            cv.line([(2, y), (8, y)], SAND[2])
        puff(cv, (34, 57), 2.2, SAND[:2])
    elif name == "hit":
        for dx, dy in ((6, -9), (8, -6), (7, -12), (10, -3)):
            cv.pixel(hd[0] + dx, hd[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("worm-sand", draw, sys.argv[1:], idle_ms=200)
