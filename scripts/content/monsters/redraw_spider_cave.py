#!/usr/bin/env python3
"""동굴 거미(spider-cave) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

뒤쪽 큰 둥근 배(붉은 모래시계 무늬)와 앞쪽 작은 머리가슴, 앞을 보는 빨간 눈 여럿과 독니 둘.
다리 여덟(가까운 넷·먼 넷)이 무릎을 높이 세웠다가 바닥 y=60 으로 가늘게 내려온다.
6번 칸(스킬 skill_mon_web_shot): 배를 앞으로 말아 올려 실젖에서 하얀 거미줄 그물을 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_spider_cave.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, glow, ik, lerp, polar, poly, rnd, run, slash, sparkle

INK = (24, 16, 30)
CARA = [(58, 44, 78), (90, 70, 116), (128, 104, 156), (170, 148, 196)]
CARA_FAR = [(40, 30, 56), (58, 44, 78), (76, 60, 100), (76, 60, 100)]
MARK = (200, 40, 50)
EYE, EYE_HI = (240, 50, 50), (255, 210, 170)
FANG = [(120, 100, 70), (200, 180, 130), (240, 226, 180), (240, 226, 180)]
VENOM = [(70, 150, 60), (150, 230, 100)]
WEB = [(150, 150, 170), (220, 220, 236), (255, 255, 255)]
WHITE = (255, 252, 236)
GROUND = 60


def leg(cv, hip, foot, rise, far=False):
    """엉덩이 → 무릎(엉덩이보다 rise 만큼 위, 발 쪽으로 40%) → 발끝. 무릎이 몸 위로 솟는 거미 다리."""
    ramp = CARA_FAR if far else CARA
    knee = (hip[0] + (foot[0] - hip[0]) * 0.42, hip[1] - rise)
    cv.part(chain([hip, knee], [2.0, 1.6]), ramp, gloss=False)
    cv.part(chain([knee, foot], [1.6, 1.0]), ramp, gloss=False)
    # 무릎 마디 밝은 점 + 정강이 털
    if not far:
        cv.pixel(*rnd(knee), CARA[3])
        mid = lerp(knee, foot, 0.45)
        cv.pixel(*rnd(add(mid, (1, 0))), CARA[0])
    return knee


BASE = dict(ceph=(38.0, 44.0), abd=(22.0, 39.0), abd_r=(11.0, 9.5), tilt=0, fang=0, eye="open",
            feet=((55, 0), (47, 0), (28, 0), (19, 0)), far_dx=-3)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 몸을 낮추며 다리가 벌어진다
        p.update(ceph=(38.0, 45.0), abd=(22.0, 40.0), abd_r=(11.5, 9.0), feet=((56, 0), (48, 0), (27, 0), (18, 0)))
    elif name == "idle_c":  # 몸을 들고 배가 부푼다, 앞다리를 들썩
        p.update(ceph=(38.0, 43.0), abd=(22.0, 38.0), abd_r=(10.5, 10.0), feet=((58, -4), (47, 0), (28, 0), (19, 0)))
    elif name == "windup":  # 앞다리 둘을 높이 쳐들고 독니를 벌린다
        p.update(ceph=(35.0, 41.0), abd=(19.0, 40.0), tilt=-12, fang=3, feet=((50, -20), (56, -12), (25, 0), (16, 0)))
    elif name == "move":  # 몸을 낮게 깔고 앞으로 달려든다
        p.update(ceph=(43.0, 47.0), abd=(27.0, 43.0), abd_r=(11.0, 8.5), feet=((60, 0), (53, -3), (33, -3), (22, 0)))
    elif name == "attack":  # 앞으로 덮쳐 독니로 문다
        p.update(ceph=(44.0, 45.0), abd=(28.0, 39.0), tilt=14, fang=4, feet=((60, -8), (54, 0), (34, 0), (24, 0)))
    elif name == "recover":  # 스킬 거미줄: 배를 들어 올려 실젖에서 그물을 쏜다
        p.update(ceph=(37.0, 45.0), abd=(23.0, 35.0), abd_r=(10.5, 9.5), tilt=-6, fang=1)
    elif name == "hit":  # 맞아서 뒤로 들리며 다리가 오그라든다
        p.update(ceph=(34.0, 42.0), abd=(18.0, 40.0), tilt=-18, eye="shut", fang=2,
                 feet=((49, -5), (43, 0), (25, 0), (16, -2)))
    return p


def ceph_head(cv, c, tilt, fang, eye):
    def r(dx, dy):
        a = math.radians(tilt)
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(ellipse(cv.blank(), c, 7.0, 5.5), CARA)
    # 독니 두 개(아래로 휘며 fang 만큼 벌어진다)
    for dx, ramp in ((4.5, FANG), (6.5, FANG)):
        root = r(dx, 3)
        tip = r(dx + 1 + (fang * 0.5 if dx > 5 else -fang * 0.3), 8 + fang * 0.3)
        cv.part(chain([root, lerp(root, tip, 0.5), tip], [2.2, 1.8, 1.0]), ramp, gloss=False)
    # 눈 여섯: 앞 큰 둘 + 위 작은 넷
    if eye == "shut":
        cv.line([r(3, -2), r(6, -1)], INK)
    else:
        for dx, dy, big in ((5, -1, True), (3, -2, True), (2, -4, False), (4, -4, False), (6, -3, False), (0, -3, False)):
            p = r(dx, dy)
            cv.pixel(*rnd(p), EYE)
            if big:
                cv.pixel(*rnd(add(p, (0, -1))), EYE_HI)
    return r(6, 8)


def draw_spider(cv, P):
    ceph, abd, tilt = P["ceph"], P["abd"], P["tilt"]
    hips = [add(ceph, (dx, 1)) for dx in (3, 1, -2, -4)]
    rises = (9, 11, 11, 8)
    feet = [(fx, GROUND + fy) for fx, fy in P["feet"]]
    # 먼 다리 넷(짙고 뒤로 조금 밀림)
    for h, f, r in zip(hips, feet, rises):
        leg(cv, add(h, (1, -2)), add(f, (P["far_dx"], -1)), r - 2, far=True)
    # 배(뒤): 마디 이음 → 큰 타원 + 모래시계 무늬 + 털
    cv.part(chain([abd, ceph], [5, 5]), CARA_FAR, gloss=False)
    rx, ry = P["abd_r"]
    cv.part(ellipse(cv.blank(), abd, rx, ry), CARA)
    m = add(abd, (0, -1))
    cv.put(poly(cv.blank(), [add(m, (-2, -3)), add(m, (2, -3)), add(m, (0, 0)), add(m, (2, 3)), add(m, (-2, 3)), add(m, (0, 0))]), MARK)
    for dx, dy in ((-6, -5), (-3, -7), (2, -7), (6, -5), (-8, -1)):
        cv.pixel(abd[0] + dx, abd[1] + dy, CARA[3])
    spinner = add(abd, (-rx + 1, 2))
    for h, f, r in zip(hips, feet, rises):
        leg(cv, h, f, r)
    jaw = ceph_head(cv, ceph, tilt, P["fang"], P["eye"])
    return dict(jaw=jaw, ceph=ceph, abd=abd, spinner=spinner)


def draw_dead(cv):
    """뒤집혀 다리를 배 위로 오그린 모습."""
    cv.part(ellipse(cv.blank(), (26, 54), 10.0, 6.0), CARA)
    cv.part(ellipse(cv.blank(), (40, 56), 6.0, 4.0), CARA)
    for i, x in enumerate((30, 34, 38, 42)):
        hip = (x, 52)
        knee = (x - 2 + i, 45 - (i % 2) * 2)
        foot = (x + 2, 48)
        cv.part(chain([hip, knee], [2.2, 2.0]), CARA_FAR if i % 2 else CARA, gloss=False)
        cv.line4([knee, foot], CARA[1])
    for p in ((44, 58), (46, 57)):
        cv.pixel(*p, FANG[1])
    cv.line([(41, 55), (43, 57)], INK)
    cv.line([(43, 55), (41, 57)], INK)


def web(cv, c, r):
    """작은 거미줄 그물(바퀴살 6 + 고리 2)."""
    spokes = [polar(c, a, r) for a in range(0, 360, 60)]
    for s in spokes:
        cv.line([c, s], WEB[1])
    for k in (0.5, 1.0):
        pts = [lerp(c, s, k) for s in spokes] + [lerp(c, spokes[0], k)]
        cv.line(pts, WEB[2] if k == 1.0 else WEB[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_spider(cv, P)
    if name == "recover":
        s = add(j["abd"], (3, -P["abd_r"][1]))
        target = (54, 18)
        for dy in (-1, 0, 1):
            cv.line([add(s, (0, dy)), add(target, (0, dy * 2))], WEB[1] if dy else WEB[2])
        web(cv, target, 7)
        sparkle(cv, add(target, (-9, 8)), WHITE, WEB[1])
        sparkle(cv, add(target, (6, 10)), WHITE, WEB[1], big=True)
    elif name == "attack":
        jw = j["jaw"]
        slash(cv, add(jw, (-3, -9)), add(jw, (5, 6)), 3, 3.0, VENOM[1], WHITE)
        burst(cv, add(jw, (3, 0)), 4.0, VENOM[1], WHITE, spikes=6, rot=10)
    elif name == "windup":
        jw = j["jaw"]
        cv.pixel(jw[0], jw[1] + 1, VENOM[1])
        cv.pixel(jw[0] - 2, jw[1] + 1, VENOM[1])
    elif name == "hit":
        c = j["ceph"]
        for dx, dy in ((9, -8), (11, -5), (10, -11), (12, -2)):
            cv.pixel(c[0] + dx, c[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("spider-cave", draw, sys.argv[1:], idle_ms=170)
