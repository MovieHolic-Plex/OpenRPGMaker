#!/usr/bin/env python3
"""갈색 큰뿔 산양(goat-mountain) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

발굽 짐승 뼈대(ungulate_rig.py)를 사슴보다 다리가 짧고 몸통이 두툼한 산양 비율로: 갈색 털에 짙은 등줄,
흰 배·다리 안쪽, 목 아래 늘어진 털, 짧은 머리에 흰 턱수염, 머리 옆으로 크게 말린 고리 뿔(나이테 마디),
가로 동공의 노란 눈(머리 안), 짧게 선 꼬리, 갈라진 검은 발굽.
6번 칸(스킬 바위 박치기): 뒷발로 일어섰다가 뿔을 앞으로 내리꽂아 앞의 바위가 깨져 파편이 아군 쪽으로 튄다.

  python3 scripts/content/monsters/redraw_goat_mountain.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import ungulate_rig as U
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (30, 20, 14)
COAT = [(104, 70, 42), (144, 102, 64), (178, 136, 92), (204, 168, 124)]
COAT_FAR = [(80, 52, 30), (104, 70, 42), (118, 80, 48), (118, 80, 48)]
BELLY = (232, 220, 196)
HOOF = [(30, 24, 22), (50, 42, 38), (72, 62, 56), (72, 62, 56)]
HORN = [(110, 96, 74), (156, 140, 110), (196, 182, 150), (220, 210, 184)]
STRIPE = (66, 42, 24)
EYE = (240, 200, 60)
PUPIL = (20, 14, 10)
ROCK = [(96, 92, 86), (136, 132, 124), (176, 172, 162), (176, 172, 162)]
DUST = [(120, 104, 84), (160, 146, 124)]
WHITE = (255, 252, 240)

B = U.Build(upper=6.5, lower=7.0, thigh=9.0, cannon=7.0, leg_w=3.0, belly=6.8, hoof="split")
L = U.Look(ramp=COAT, far=COAT_FAR, ink=INK, hoof=HOOF, belly=BELLY)


def tail(cv, P):
    r = add(P.hip, (-5, -2))
    cv.part(poly(cv.blank(), [add(r, (0, -1)), add(r, (-3, -4 - P.extra.get("flag", 0))), add(r, (-2, 2))]), COAT, ink=INK, gloss=False)


def head(cv, poll, tilt, mouth=0, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (poll[0] + dx * math.cos(a) - dy * math.sin(a), poll[1] + dx * math.sin(a) + dy * math.cos(a))
    # 흰 턱수염
    cv.part(poly(cv.blank(), [R(4, 4), R(8, 4), R(5, 10), R(4, 8)]), [BELLY] * 4, ink=INK, gloss=False)
    if mouth:
        cv.part(poly(cv.blank(), [R(3, 3), R(8, 4 + mouth), R(8, 5 + mouth), R(3, 4)]), COAT, ink=INK, gloss=False)
    skull = [R(-3, -2), R(2, -4), R(6, -2), R(9, 1), R(9, 3), R(4, 4), R(-2, 3)]
    cv.part(poly(cv.blank(), skull), COAT, ink=INK)
    cv.pixel(*rnd(R(9, 2)), INK)
    cv.part(poly(cv.blank(), [R(-2, 0), R(-6, 1), R(-2, 2)]), COAT, ink=INK, gloss=False)  # 귀
    # 말린 고리 뿔: 정수리에서 뒤로 감아 돌아 눈 아래로
    c = R(-3, -1)
    pts = [polar(c, -60 + tilt - k * 32, 5.5 - k * 0.5) for k in range(9)]
    pts = [R(1, -3)] + pts
    cv.part(chain(pts, [3.6, 3.4, 3.2, 3.0, 2.8, 2.6, 2.2, 1.8, 1.4, 1.0]), HORN, ink=INK, gloss=False)
    for p in pts[2:8:2]:
        cv.pixel(*rnd(p), HORN[0])
    e = rnd(R(3, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, 0)), add(e, (1, 0)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], PUPIL)
    return dict(eye=e, horn=R(-1, -6), front=R(10, 0))


def front(cv, P):
    U.neck(cv, B, L, P.sh, P.poll, 6.5, 4.6)
    cv.line4([add(P.hip, (-2, -3)), add(P.sh, (-1, -4))], STRIPE)  # 등줄
    cv.part(poly(cv.blank(), [lerp(P.sh, P.poll, 0.3), add(lerp(P.sh, P.poll, 0.3), (4, 7)), add(lerp(P.sh, P.poll, 0.6), (3, 3))]), COAT, ink=INK, gloss=False)  # 목 아래 늘어진 털
    return head(cv, P.poll, P.tilt, P.extra.get("mouth", 0), P.extra.get("eye", "open"))


POSES = {
    "idle_a": U.Pose(hip=(20, 41), sh=(37, 40), feet=((40, 60), (35, 60), (23, 60), (18, 60)), poll=(44, 29), tilt=35),
    "idle_b": U.Pose(hip=(20, 42), sh=(37, 41), feet=((40, 60), (35, 60), (23, 60), (18, 60)), poll=(45, 31), tilt=50, extra=dict(flag=2, mouth=1)),
    "idle_c": U.Pose(hip=(20, 41), sh=(37, 40), feet=((41, 59), (35, 60), (23, 60), (18, 60)), lift=(2, 0, 0, 0), poll=(43, 28), tilt=20),
    "windup": U.Pose(hip=(19, 43), sh=(31, 32), feet=((38, 46), (35, 48), (23, 60), (17, 60)), lift=(3, 3, 0, 0), poll=(37, 20), tilt=10, extra=dict(mouth=2, flag=3)),
    "move": U.Pose(hip=(23, 40), sh=(40, 41), feet=((51, 55), (46, 58), (14, 56), (21, 60)), lift=(3, 0, 2, 0), poll=(48, 33), tilt=70, extra=dict(flag=4)),
    "attack": U.Pose(hip=(21, 41), sh=(38, 43), feet=((45, 60), (40, 60), (24, 60), (17, 60)), poll=(46, 38), tilt=95, extra=dict(flag=2)),
    "recover": U.Pose(hip=(18, 42), sh=(34, 44), feet=((40, 60), (36, 60), (22, 60), (15, 60)), poll=(41, 41), tilt=110, extra=dict(mouth=2, flag=3)),
    "hit": U.Pose(hip=(18, 42), sh=(34, 41), feet=((37, 60), (32, 60), (22, 60), (15, 60)), poll=(38, 29), tilt=-15, extra=dict(eye="shut")),
}


def draw_dead(cv):
    for a, b in (((22, 54), (30, 58)), ((36, 55), (44, 58))):
        cv.part(chain([a, b], [2.6, 2.2]), COAT_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(12, 59), (14, 50), (24, 47), (38, 47), (44, 53), (42, 59)]), COAT, ink=INK)
    cv.part(poly(cv.blank(), [(44, 59), (45, 52), (51, 50), (56, 53), (56, 59)]), COAT, ink=INK)
    cv.part(chain([(46, 50), (42, 47), (40, 51), (43, 54)], [3, 2.6, 2, 1.4]), HORN, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(53, 57), (57, 57), (56, 60)]), [BELLY] * 4, ink=INK, gloss=False)
    cv.line([(49, 53), (51, 55)], INK)
    cv.line([(51, 53), (49, 55)], INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 1, 7, (34, 40, 46), COAT[2])
    J = U.draw_body(cv, B, L, P, tail=tail, front_part=front)
    if name == "windup":
        sparkle(cv, add(J["horn"], (0, -4)), WHITE, HORN[3])
    elif name == "move":
        puff(cv, (10, 57), 2.2, DUST)
    elif name == "attack":
        burst(cv, add(J["horn"], (6, 2)), 4.5, (255, 236, 180), WHITE, spikes=6)
    elif name == "recover":
        # 뿔 앞의 바위가 깨져 파편이 아군 쪽으로
        base = (54, 56)
        cv.part(poly(cv.blank(), [(48, 60), (49, 52), (53, 49), (58, 51), (60, 60)]), ROCK, ink=INK)
        cv.line4([(53, 50), (52, 54), (55, 57)], INK)
        for p, r in (((58, 42), 1.6), ((61, 47), 1.2), ((54, 40), 1.2)):
            cv.part(ellipse(cv.blank(), p, r, r), ROCK, ink=INK, gloss=False)
        burst(cv, (49, 50), 4.0, (255, 236, 180), WHITE, spikes=6)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("goat-mountain", draw, sys.argv[1:], idle_ms=230)
