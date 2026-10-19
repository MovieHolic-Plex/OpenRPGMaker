#!/usr/bin/env python3
"""갈색 말(horse-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

발굽 짐승 뼈대(ungulate_rig.py): 긴 곧은 다리(앞 무릎은 앞으로 접히고 뒷다리 비절은 뒤로 꺾임), 통 같은 몸통,
위로 솟은 굵은 목과 긴 쐐기 머리. 밤색 털에 검은 갈기·꼬리·다리 끝(양말), 이마의 흰 별, 머리 안의 큰 눈,
쫑긋 선 귀, 콧구멍. 6번 칸(스킬 앞발 구르기): 뒷발로 일어서서 앞발을 내리꽂아 땅의 충격파가 아군 쪽으로 퍼진다.

  python3 scripts/content/monsters/redraw_horse_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import ungulate_rig as U
from pixel_lib import Canvas, add, bezier, burst, chain, crack, ellipse, lerp, polar, poly, puff, ring, rnd, run, sparkle, speed_lines

INK = (30, 16, 10)
COAT = [(98, 50, 26), (140, 76, 40), (174, 104, 58), (204, 140, 90)]
COAT_FAR = [(72, 36, 20), (98, 50, 26), (112, 58, 30), (112, 58, 30)]
MANE = [(24, 16, 14), (44, 30, 24), (66, 48, 38), (90, 70, 56)]
HOOF = [(30, 24, 22), (54, 46, 40), (80, 70, 62), (80, 70, 62)]
STAR = (248, 240, 224)
EYE = (20, 12, 8)
EYE_HI = (240, 230, 210)
NOSE = (60, 34, 26)
DUST = [(120, 100, 76), (164, 144, 112)]
SHOCK = [(200, 170, 110), (240, 220, 170)]
WHITE = (255, 250, 240)
G = 60

B = U.Build(upper=8.0, lower=9.0, thigh=11.0, cannon=9.0, leg_w=2.8, belly=6.5)
L = U.Look(ramp=COAT, far=COAT_FAR, ink=INK, hoof=HOOF)


def tail(cv, P):
    r = add(P.hip, (-4, -1))
    sw = P.extra.get("tail", 0)
    pts = bezier(r, add(r, (-8, 3 - sw)), add(r, (-7 - sw, 18)), 6)
    cv.part(chain(pts, [3.2, 4, 4.4, 4.2, 3.6, 2.8, 1.8]), MANE, ink=INK, gloss=False)


def head(cv, poll, tilt, mouth=0, eye="open", ears=0):
    a = math.radians(tilt)
    R = lambda dx, dy: (poll[0] + dx * math.cos(a) - dy * math.sin(a), poll[1] + dx * math.sin(a) + dy * math.cos(a))
    # 아래턱(입 벌림)
    if mouth:
        cv.part(poly(cv.blank(), [R(3, 4), R(10, 5 + mouth), R(11, 7 + mouth), R(4, 6)]), COAT, ink=INK, gloss=False)
    # 머리 쐐기: 이마(poll) → 주둥이
    skull = [R(-2, -2), R(3, -3), R(8, -1), R(12, 2), R(13, 5), R(11, 6), R(4, 5), R(-1, 3)]
    cv.part(poly(cv.blank(), skull), COAT, ink=INK)
    cv.put(poly(cv.blank(), [R(9, 2), R(13, 4), R(12, 6), R(9, 5)]), COAT[0])  # 주둥이 그늘
    cv.pixel(*rnd(R(12, 4)), NOSE)
    # 귀 둘
    cv.part(poly(cv.blank(), [R(-1, -2), R(-2 - ears, -7), R(1, -3)]), COAT_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(0, -2), R(1 - ears, -7), R(3, -3)]), COAT, ink=INK, gloss=False)
    # 이마 흰 별 + 앞머리 갈기
    cv.put(poly(cv.blank(), [R(4, -2), R(6, -1), R(5, 0)]), STAR)
    cv.part(poly(cv.blank(), [R(0, -3), R(4, -3), R(2, 0)]), MANE, ink=INK, gloss=False)
    e = rnd(R(4, 1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, 0)), add(e, (1, 0)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0], e[1], EYE_HI)
    return dict(eye=e, mouth=R(13, 6))


def front(cv, P):
    poll = P.poll
    U.neck(cv, B, L, P.sh, poll, 7.0, 4.5)
    # 갈기: 목 윗선을 따라 뒤로 흩날림
    base = add(P.sh, (-1, -3))
    pts = [lerp(base, poll, t) for t in (0.0, 0.3, 0.6, 0.9)]
    for p in pts:
        cv.part(poly(cv.blank(), [add(p, (-1, -2)), add(p, (-5, 0)), add(p, (1, 1))]), MANE, ink=INK, gloss=False)
    return head(cv, poll, P.tilt, P.extra.get("mouth", 0), P.extra.get("eye", "open"), P.extra.get("ears", 0))


def stockings(cv, P):
    for f in P.feet[:1] + P.feet[2:3]:
        cv.line4([add(rnd(f), (-1, -3)), add(rnd(f), (1, -3))], MANE[1])


POSES = {
    "idle_a": U.Pose(hip=(19, 35), sh=(37, 34), feet=((40, 60), (35, 60), (22, 60), (17, 60)), poll=(45, 19), tilt=40),
    "idle_b": U.Pose(hip=(19, 36), sh=(37, 35), feet=((40, 60), (35, 60), (22, 60), (17, 60)), poll=(46, 21), tilt=55, extra=dict(tail=3)),
    "idle_c": U.Pose(hip=(19, 35), sh=(37, 34), feet=((41, 59), (35, 60), (22, 60), (17, 60)), lift=(2, 0, 0, 0), poll=(44, 18), tilt=30, extra=dict(ears=1, tail=-2)),
    "windup": U.Pose(hip=(18, 38), sh=(30, 26), feet=((40, 38), (36, 40), (22, 60), (16, 60)), lift=(4, 4, 0, 0), poll=(37, 11), tilt=20, extra=dict(mouth=2, ears=2, tail=5)),
    "move": U.Pose(hip=(22, 34), sh=(41, 35), feet=((52, 52), (47, 58), (14, 56), (20, 60)), lift=(4, 0, 2, 0), poll=(51, 23), tilt=50, extra=dict(tail=8, ears=2)),
    "attack": U.Pose(hip=(16, 36), sh=(34, 33), feet=((48, 44), (40, 54), (21, 60), (14, 60)), lift=(4, 2, 0, 0), poll=(44, 21), tilt=60, extra=dict(mouth=3, ears=2, tail=4)),
    "recover": U.Pose(hip=(18, 37), sh=(32, 30), feet=((44, 60), (39, 60), (22, 60), (16, 60)), poll=(41, 16), tilt=35, extra=dict(mouth=3, ears=2, tail=6)),
    "hit": U.Pose(hip=(17, 37), sh=(33, 36), feet=((36, 60), (31, 60), (21, 60), (14, 60)), poll=(38, 22), tilt=-10, extra=dict(eye="shut", ears=2, tail=-4)),
}


def draw_dead(cv):
    cv.part(chain(bezier((14, 52), (6, 56), (4, 59), 4), [3, 3.4, 3, 2.6, 2]), MANE, ink=INK, gloss=False)
    for a, b in (((22, 54), (30, 58)), ((36, 55), (46, 58))):
        cv.part(chain([a, b], [3, 2.4]), COAT_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(12, 59), (14, 50), (24, 46), (40, 46), (46, 52), (44, 59)]), COAT, ink=INK)
    cv.part(chain([(44, 52), (50, 54)], [6, 5]), COAT, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(49, 51), (56, 52), (61, 56), (60, 59), (50, 59)]), COAT, ink=INK)
    cv.part(poly(cv.blank(), [(40, 46), (46, 48), (48, 52), (44, 50)]), MANE, ink=INK, gloss=False)
    cv.line([(52, 53), (54, 55)], EYE)
    cv.line([(54, 53), (52, 55)], EYE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 1, 7, (28, 36, 44), COAT[2])
    if name == "recover":
        for r, col in ((12, SHOCK[0]), (8, SHOCK[1])):
            ring(cv, (44, 60), r, -180, 0, col)
    J = U.draw_body(cv, B, L, P, tail=tail, front_part=front)
    stockings(cv, P)
    if name == "windup":
        sparkle(cv, add(J["mouth"], (2, -6)), WHITE, SHOCK[1])
    elif name == "move":
        puff(cv, (12, 57), 2.4, DUST)
    elif name == "attack":
        burst(cv, add(P.feet[0], (4, 0)), 4.5, SHOCK[1], WHITE, spikes=6)
    elif name == "recover":
        crack(cv, (44, 59), [(49, 58), (54, 59), (60, 58)], INK)
        for p, r in (((52, 52), 1.6), ((57, 49), 1.3), ((49, 48), 1.1)):
            cv.part(ellipse(cv.blank(), p, r, r), DUST + DUST, ink=INK, gloss=False)
        puff(cv, (38, 57), 2.4, DUST)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("horse-01", draw, sys.argv[1:], idle_ms=220)
