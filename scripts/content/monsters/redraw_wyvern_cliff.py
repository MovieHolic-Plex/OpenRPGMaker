#!/usr/bin/env python3
"""보라 와이번(wyvern-cliff) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

네발 드래곤(dragon_rig.py)과 다른 와이번 체형: 앞다리가 없고 날개 자체가 팔이다(날개 손목의 갈고리 발톱으로 땅을 짚는다).
두 굵은 뒷다리로 서서 몸을 앞으로 숙이고, 길게 뻗은 꼬리 끝에 독침 갈고리. 보라 비늘에 연분홍 배판, 짙은 날개막,
좁고 긴 머리에 뒤로 뻗은 뿔 하나·노란 눈(머리 안). 날개·뒷다리·머리 그리기는 dragon_rig 의 부위 함수를 쓴다.
6번 칸(스킬 독침 강하): 날개를 활짝 펴 솟구치며 꼬리를 앞으로 휘둘러 독침에서 보라 독 방울을 흩뿌린다.

  python3 scripts/content/monsters/redraw_wyvern_cliff.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import dragon_rig as R
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

S, G = R.S, R.G
L = R.Look(
    ink=(24, 10, 34),
    scale=[(80, 40, 110), (116, 62, 150), (156, 96, 188), (200, 150, 224)],
    scale_far=[(58, 28, 82), (80, 40, 110), (94, 50, 128), (94, 50, 128)],
    belly=[(200, 150, 170), (232, 190, 204), (248, 222, 230), (248, 222, 230)],
    memb=[(50, 24, 70), (74, 38, 100), (100, 56, 130), (100, 56, 130)],
    memb_far=[(36, 16, 52), (50, 24, 70), (50, 24, 70), (50, 24, 70)],
    horn=[(150, 140, 120), (200, 190, 160), (236, 228, 200), (255, 250, 230)],
    eye=(255, 220, 60), eye_hi=(255, 255, 200),
    breath=[(110, 40, 150), (170, 90, 210), (230, 190, 255), (255, 255, 255)],
    horns="straight", cheek="none",
    smoke=((150, 120, 170), (200, 180, 220)),
)
VENOM = [(110, 40, 150), (170, 90, 210), (230, 190, 255)]
WHITE = (255, 252, 240)
DUST = [(110, 100, 90), (150, 140, 128)]


def stinger_tail(cv, root, ctrl, end):
    pts = bezier(root, ctrl, end, 8)
    cv.part(chain(pts, [9, 8, 7, 6, 5, 4, 3.4, 2.8, 2.2]), L.scale, ink=L.ink, gloss=False)
    R.spikes_along(cv, pts[:6], [9, 8, 7, 6, 5, 4], L.horn, h=2.6, every=2)
    a = math.degrees(math.atan2(end[1] - pts[-2][1], end[0] - pts[-2][0]))
    sting = [polar(end, a, 8), polar(end, a + 110, 4), polar(end, a + 180, 1), polar(end, a - 110, 4)]
    cv.part(poly(cv.blank(), sting), L.horn, ink=L.ink, gloss=False)
    return polar(end, a, 8)


def wyvern(cv, P):
    c = P["c"]
    t = math.radians(P["tilt"])
    r = lambda dx, dy: (c[0] + dx * math.cos(t) - dy * math.sin(t), c[1] + dx * math.sin(t) + dy * math.cos(t))
    # 먼 날개(팔) → 먼 다리 → 꼬리 → 몸 → 가까운 다리 → 목·머리 → 가까운 날개
    wf, _ = R.wing(cv, L, r(6, -8), P["wfar"], P["span"] * 0.95, far=True)
    R.hind_leg(cv, L, r(-6, 4), (P["feet"][1], G), far=True)
    sting = stinger_tail(cv, r(-14, 2), r(-30, 6 + P["tail"][1]), P["tail"][0])
    body = R.union(ellipse(cv.blank(), r(-6, 2), 12, 10), ellipse(cv.blank(), r(8, -2), 10, 10))
    cv.part(body, L.scale, ink=L.ink)
    R.fill(cv, body & (R.np.array(ellipse(cv.blank(), r(2, 8), 16, 7)) > 0), L.belly)
    for x in (-12, -4, 4):
        R.spike(cv, r(x, -10), -100, 4, 2, L.horn)
    R.hind_leg(cv, L, r(-2, 6), (P["feet"][0], G))
    J = R.neck_head(cv, L, r(12, -6), P)
    wn, tips = R.wing(cv, L, r(4, -6), P["wing"], P["span"])
    J["sting"], J["wrist"] = sting, wn
    return J


BASE = dict(c=(40.0, 60.0), tilt=12, neck=((5, -7), (4, -7), (5, -4)), ha=6, jaw=0, wing=-110, wfar=-95, span=40.0,
            feet=(44, 34), tail=((8, 80), 4))


def pose(name):
    P = dict(BASE)
    if name == "idle_b":
        P.update(c=(40.0, 62.0), wing=-150, wfar=-132, ha=10, tail=((6, 82), 6))
    elif name == "idle_c":
        P.update(c=(40.0, 59.0), wing=-95, wfar=-80, ha=-4, jaw=10, tail=((10, 76), 0))
    elif name == "windup":  # 몸을 세우며 꼬리를 머리 위로 치켜든다
        P.update(c=(36.0, 58.0), tilt=-10, neck=((3, -8), (1, -8), (3, -5)), ha=-20, jaw=24, wing=-95, wfar=-80,
                 tail=((40, 14), -30))
    elif name == "move":
        P.update(c=(48.0, 60.0), tilt=22, ha=12, jaw=10, wing=-170, wfar=-160, span=36.0, feet=(56, 36), tail=((6, 62), -8))
    elif name == "attack":  # 날개 손목 갈고리로 내려찍는다
        P.update(c=(44.0, 60.0), tilt=18, ha=16, jaw=30, wing=-20, wfar=-60, span=34.0, feet=(48, 36), tail=((8, 78), 2))
    elif name == "recover":  # 스킬: 솟구치며 꼬리 독침을 앞으로
        P.update(c=(36.0, 52.0), tilt=0, ha=0, jaw=20, wing=-90, wfar=-72, span=44.0, feet=(42, 32), tail=((76, 70), 20))
    elif name == "hit":
        P.update(c=(34.0, 60.0), tilt=-18, neck=((0, -8), (-3, -7), (-2, -3)), ha=-34, jaw=14, eye="shut", wing=-175, wfar=-160,
                 span=32.0, feet=(40, 30), tail=((4, 84), 8))
    return P


def draw(name):
    cv = Canvas(S, L.ink)
    if name == "dead":
        stinger_tail(cv, (30, 84), (16, 90), (4, 86))
        cv.part(R.union(ellipse(cv.blank(), (36, 84), 12, 7), ellipse(cv.blank(), (52, 85), 10, 6)), L.scale, ink=L.ink)
        R.wing(cv, L, (44, 80), -170, 30)
        P = dict(BASE, neck=((6, 2), (7, 1), (7, 1)), ha=12, jaw=8, eye="x")
        R.neck_head(cv, L, (58, 82), P)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 14, (36, 48, 60), L.scale[2])
    J = wyvern(cv, P)
    m = J["mouth"]
    if name == "windup":
        sparkle(cv, add(J["sting"], (0, -4)), WHITE, VENOM[1], big=True)
    elif name == "move":
        puff(cv, (20, 88), 3.4, DUST)
    elif name == "attack":
        w = J["wrist"]
        for k in range(3):
            slash(cv, add(w, (k * 4 - 2, -10)), add(w, (k * 4 + 4, 10)), 3, 2.2, L.horn[2], WHITE)
    elif name == "recover":
        s = J["sting"]
        for p, rr in (((s[0] + 6, s[1] - 8), 2.4), ((s[0] + 10, s[1] + 2), 3.0), ((s[0] + 4, s[1] + 10), 2.0), ((s[0] + 12, s[1] - 16), 1.6)):
            if p[0] < 92:
                cv.part(ellipse(cv.blank(), p, rr, rr), [VENOM[0], VENOM[1], VENOM[2], VENOM[2]], ink=L.ink, gloss=False)
        glow(cv, s, 3, VENOM)
    elif name == "hit":
        e = J.get("eye", m)
        for dx, dy in ((5, -10), (9, -7), (8, -13)):
            cv.pixel(int(e[0] + dx), int(e[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("wyvern-cliff", draw, sys.argv[1:], S=S, idle_ms=200)
