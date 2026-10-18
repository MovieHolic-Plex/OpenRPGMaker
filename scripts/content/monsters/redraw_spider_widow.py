#!/usr/bin/env python3
"""과부 거미(spider-widow) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

윤기 도는 칠흑 물방울 배(뒤로 높이 솟음, 아래쪽에 진홍 모래시계), 작은 머리가슴과 붉은 눈 여럿, 갈고리 독니.
아주 긴 다리 여덟이 무릎을 몸보다 훨씬 높이 세우고, 마디마다 붉은 띠와 가시가 돋았다.
6번 칸(스킬, 아키타입 venom): 앞다리를 벌려 몸을 치켜들고 독니에서 진홍 독액 줄기를 아군 쪽으로 뿜는다.

  python3 scripts/content/monsters/redraw_spider_widow.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, glow, lerp, poly, puff, rnd, run, slash, sparkle

INK = (10, 8, 14)
BODY = [(22, 20, 30), (40, 38, 54), (70, 70, 94), (150, 156, 190)]
BODY_FAR = [(16, 14, 22), (26, 24, 36), (36, 34, 48), (36, 34, 48)]
RED = [(130, 16, 28), (200, 36, 44), (250, 96, 90)]
EYE, EYE_HI = (230, 40, 50), (255, 190, 170)
FANG = [(90, 60, 50), (170, 120, 90), (230, 200, 160), (230, 200, 160)]
VENOM = [(110, 10, 40), (200, 40, 80), (255, 140, 170), (255, 230, 236)]
DUST = [(70, 64, 80), (110, 104, 120)]
WHITE = (255, 248, 244)
GROUND = 60


def leg(cv, hip, foot, rise, far=False):
    """엉덩이 -> 높이 솟은 무릎 -> 가는 정강이 -> 발끝. 무릎에 붉은 띠, 정강이에 가시."""
    ramp = BODY_FAR if far else BODY
    knee = (hip[0] + (foot[0] - hip[0]) * 0.35, hip[1] - rise)
    ankle = lerp(knee, foot, 0.72)
    cv.part(chain([hip, knee], [1.6, 1.2]), ramp, gloss=False)
    cv.part(chain([knee, ankle, foot], [1.2, 1.0, 0.6]), ramp, gloss=False)
    if not far:
        cv.pixel(*rnd(knee), RED[1])
        cv.pixel(*rnd(add(knee, (0, -1))), RED[2])
        for t in (0.3, 0.55):
            p = lerp(knee, ankle, t)
            side = 1 if foot[0] >= hip[0] else -1
            cv.pixel(*rnd(add(p, (side, -1))), BODY[2])
    return knee


BASE = dict(ceph=(40.0, 46.0), abd=(23.0, 36.0), tilt=0.0, abd_rot=-20.0, abd_k=1.0, fang=0.0, eye="open",
            feet=((61, 0), (54, 0), (24, 0), (9, 0)), rises=(15, 17, 16, 13))


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 몸이 내려앉고 배가 숨쉬듯 부푼다
        p.update(ceph=(40.0, 47.0), abd=(23.0, 37.0), abd_k=1.06, rises=(14, 16, 15, 12), feet=((61, 0), (53, 0), (25, 0), (8, 0)))
    elif name == "idle_c":  # 앞다리 하나를 들어 더듬고 배를 치켜든다
        p.update(ceph=(40.0, 45.0), abd=(23.0, 35.0), abd_rot=-28.0, feet=((60, -9), (54, 0), (24, 0), (9, 0)))
    elif name == "windup":  # 앞다리 둘을 머리 위로 벌려 올리고 독니를 연다
        p.update(ceph=(36.0, 43.0), abd=(20.0, 38.0), abd_rot=-10.0, tilt=-14, fang=3.0,
                 feet=((50, -28), (58, -18), (22, 0), (7, 0)), rises=(8, 8, 16, 13))
    elif name == "move":  # 몸을 납작 깔고 다리를 길게 뻗어 미끄러지듯 달려든다
        p.update(ceph=(45.0, 50.0), abd=(29.0, 44.0), abd_rot=-6.0, abd_k=0.95,
                 feet=((62, -1), (57, -4), (30, -4), (14, 0)), rises=(11, 13, 13, 10))
    elif name == "attack":  # 앞으로 덮쳐 독니를 내리꽂는다
        p.update(ceph=(46.0, 48.0), abd=(30.0, 39.0), abd_rot=-24.0, tilt=18, fang=4.0,
                 feet=((62, -14), (59, 0), (31, 0), (16, 0)), rises=(9, 14, 14, 11))
    elif name == "recover":  # 스킬 독 분사: 앞다리를 벌리고 몸을 치켜든다
        p.update(ceph=(38.0, 41.0), abd=(22.0, 39.0), abd_rot=-4.0, tilt=-20, fang=4.0,
                 feet=((48, -26), (56, -14), (22, 0), (8, 0)), rises=(8, 8, 15, 12))
    elif name == "hit":  # 맞아서 뒤로 젖혀지고 다리가 오그라든다
        p.update(ceph=(35.0, 43.0), abd=(19.0, 39.0), abd_rot=-2.0, tilt=-22, eye="shut", fang=2.0,
                 feet=((50, -6), (47, 0), (22, 0), (8, -2)), rises=(11, 12, 13, 11))
    return p


def abdomen(cv, c, rot, k):
    """뒤·위로 솟는 물방울 배 + 윤기 줄 + 아래쪽 진홍 모래시계."""
    a = math.radians(rot)

    def r(dx, dy):
        return (c[0] + (dx * math.cos(a) - dy * math.sin(a)) * k, c[1] + (dx * math.sin(a) + dy * math.cos(a)) * k)
    outline = [r(9, 2), r(7, -5), r(1, -9), r(-6, -9), r(-11, -5), r(-12, 1), r(-9, 7), r(-2, 9), r(5, 7)]
    M = cv.part(poly(cv.blank(), outline), BODY)
    cv.line4([r(-1, -7), r(-6, -7), r(-9, -4)], BODY[3])
    hg = r(-4, 5)
    cv.put(poly(cv.blank(), [add(hg, (-3, -3)), add(hg, (3, -3)), add(hg, (0, 0)), add(hg, (3, 3)), add(hg, (-3, 3)),
                             add(hg, (0, 0))]), RED[1])
    cv.pixel(*rnd(add(hg, (-2, -1))), RED[2])
    return M, r(-12, 2)


def ceph_head(cv, c, tilt, fang, eye):
    a = math.radians(tilt)

    def r(dx, dy):
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(ellipse(cv.blank(), c, 6.0, 4.5), BODY)
    for dx in (3.5, 5.5):
        root = r(dx, 3)
        mid = r(dx + 1.5 + fang * 0.4, 6)
        tip = r(dx - 0.5 + fang * (0.6 if dx > 4 else -0.2), 8.5 + fang * 0.3)
        cv.part(chain([root, mid, tip], [2.2, 1.6, 1.0]), FANG, gloss=False)
    if eye == "shut":
        cv.line([r(2, -2), r(5, -1)], RED[0])
    else:
        for dx, dy, big in ((5, -1, True), (3, -2, True), (1, -3, False), (3, -4, False), (5, -3, False)):
            p = r(dx, dy)
            cv.pixel(*rnd(p), EYE)
            if big:
                cv.pixel(*rnd(add(p, (1, 0))), EYE_HI)
    return r(5, 9)


def draw_spider(cv, P):
    ceph, abd = P["ceph"], P["abd"]
    hips = [add(ceph, (dx, 1)) for dx in (3, 1, -2, -4)]
    feet = [(fx, GROUND + fy) for fx, fy in P["feet"]]
    for h, f, r in zip(hips, feet, P["rises"]):
        leg(cv, add(h, (1, -2)), add(f, (-3, -1)), r - 3, far=True)
    cv.part(chain([abd, ceph], [4, 4]), BODY_FAR, gloss=False)
    _, spinner = abdomen(cv, abd, P["abd_rot"], P["abd_k"])
    for h, f, r in zip(hips, feet, P["rises"]):
        leg(cv, h, f, r)
    jaw = ceph_head(cv, ceph, P["tilt"], P["fang"], P["eye"])
    return dict(jaw=jaw, ceph=ceph, abd=abd, spinner=spinner)


def draw_dead(cv):
    """뒤집혀 다리를 배 위로 오그리고, 모래시계가 하늘을 본다."""
    cv.part(poly(cv.blank(), [(13, 54), (17, 48), (26, 46), (34, 49), (36, 55), (32, 59), (16, 59)]), BODY)
    cv.put(poly(cv.blank(), [(22, 48), (28, 48), (25, 50), (28, 52), (22, 52), (25, 50)]), RED[1])
    cv.part(ellipse(cv.blank(), (41, 56), 5.0, 3.5), BODY)
    for i, x in enumerate((33, 37, 41, 45)):
        hip = (x, 53)
        knee = (x - 3 + i * 2, 42 - (i % 2) * 3)
        foot = (x + 1 + i, 47)
        cv.part(chain([hip, knee], [2.0, 1.6]), BODY_FAR if i % 2 else BODY, gloss=False)
        cv.line4([knee, foot], BODY[1])
        cv.pixel(*knee, RED[1])
    cv.line([(40, 55), (42, 57)], RED[0])
    cv.line([(42, 55), (40, 57)], RED[0])
    puff(cv, (8, 57), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_spider(cv, P)
    jw = j["jaw"]
    if name == "recover":
        start = add(jw, (1, 0))
        pts = bezier(start, (56, start[1] - 6), (62, 34), 12)
        cv.line(pts, VENOM[0], width=4)
        cv.line(pts, VENOM[1], width=2)
        cv.line(pts[1:11], VENOM[3])
        glow(cv, (61, 38), 3.0, [VENOM[1], VENOM[2], VENOM[3]])
        for p in ((55, 22), (59, 26), (53, 31), (61, 40), (58, 44)):
            cv.pixel(*p, VENOM[2])
        glow(cv, start, 2.5, [VENOM[1], VENOM[2], VENOM[3]])
        sparkle(cv, (55, 16), WHITE, VENOM[2], big=True)
    elif name == "attack":
        slash(cv, add(jw, (-4, -10)), add(jw, (5, 6)), 3, 3.0, VENOM[1], WHITE)
        burst(cv, add(jw, (3, 1)), 4.5, VENOM[1], VENOM[3], spikes=6, rot=12)
    elif name == "windup":
        for dx in (0, -2):
            cv.pixel(jw[0] + dx, jw[1] + 1, VENOM[2])
        sparkle(cv, add(j["ceph"], (6, -9)), WHITE, EYE)
    elif name == "move":
        for y in (40, 46, 52):
            cv.line([(2, y), (8, y)], BODY[2])
    elif name == "hit":
        c = j["ceph"]
        for dx, dy in ((9, -8), (11, -5), (10, -11), (12, -2)):
            cv.pixel(c[0] + dx, c[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("spider-widow", draw, sys.argv[1:], idle_ms=180)
