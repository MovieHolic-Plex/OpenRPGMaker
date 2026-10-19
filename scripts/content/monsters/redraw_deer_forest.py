#!/usr/bin/env python3
"""숲사슴(deer-forest) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

발굽 짐승 뼈대(ungulate_rig.py)를 말보다 가늘고 다리가 긴 사슴 비율로: 붉은 갈색 털에 등의 흰 점,
흰 엉덩이 반점과 짧게 선 꼬리, 가는 목, 짧은 쐐기 머리에 큰 귀, 머리 안의 큰 검은 눈, 검은 코,
가지가 여럿 갈라진 뿔(끝에 이끼 잎이 매달림), 갈라진 발굽. 갈기 없음.
6번 칸(스킬 숲의 부름): 고개를 쳐들어 울자 뿔에서 초록 잎과 빛이 아군 쪽으로 흩날린다.

  python3 scripts/content/monsters/redraw_deer_forest.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import ungulate_rig as U
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (34, 20, 12)
COAT = [(120, 62, 34), (162, 92, 52), (196, 126, 78), (220, 160, 112)]
COAT_FAR = [(90, 46, 26), (120, 62, 34), (136, 72, 40), (136, 72, 40)]
CREAM = (240, 228, 206)
HOOF = [(40, 30, 24), (62, 48, 38), (84, 68, 56), (84, 68, 56)]
ANTLER = [(130, 106, 76), (176, 150, 112), (214, 192, 150), (232, 214, 176)]
MOSS = (110, 170, 70)
EYE = (16, 10, 8)
EYE_HI = (240, 230, 210)
LEAF = [(60, 130, 50), (110, 190, 80), (200, 240, 150)]
DUST = [(120, 96, 70), (164, 140, 108)]
WHITE = (255, 252, 240)

B = U.Build(upper=8.5, lower=10.0, thigh=11.0, cannon=10.5, leg_w=2.2, belly=5.4, hoof="split")
L = U.Look(ramp=COAT, far=COAT_FAR, ink=INK, hoof=HOOF)


def tail(cv, P):
    r = add(P.hip, (-5, -2))
    up = P.extra.get("flag", 0)
    cv.part(poly(cv.blank(), [add(r, (0, -1)), add(r, (-4, -3 - up)), add(r, (-3, 2))]), [CREAM] * 4, ink=INK, gloss=False)


def spots(cv, P):
    cv.put(ellipse(cv.blank(), add(P.hip, (-2, 2)), 2.4, 2.8), CREAM)  # 흰 엉덩이
    for t, dy in ((0.2, -1), (0.4, 0), (0.6, -1), (0.8, 0), (0.3, 2), (0.55, 2)):
        cv.pixel(*rnd(add(lerp(P.hip, P.sh, t), (0, dy))), CREAM)


def antlers(cv, R, spread=0):
    for side, col in ((-1, [ANTLER[0]] * 4), (1, ANTLER)):
        base = R(1 + side * 0.5, -3)
        main = [base, R(-1 + side, -9), R(-4 + side * 2 - spread, -15), R(-8 - spread, -18)]
        cv.part(chain(main, [1.8, 1.6, 1.4, 1.0]), col, ink=INK, gloss=False)
        for k, (dx, dy) in ((1, (4, -4)), (2, (4, -5))):
            p = main[k]
            cv.part(chain([p, add(p, (dx, dy))], [1.3, 0.8]), col, ink=INK, gloss=False)
        if side > 0:
            cv.pixel(*rnd(add(main[2], (4, -5))), MOSS)


def head(cv, poll, tilt, mouth=0, eye="open", spread=0):
    a = math.radians(tilt)
    R = lambda dx, dy: (poll[0] + dx * math.cos(a) - dy * math.sin(a), poll[1] + dx * math.sin(a) + dy * math.cos(a))
    ab = math.radians(tilt - 40)  # 뿔은 주둥이보다 덜 돌아 정수리에서 위·뒤로 선다
    crown = R(0, -2)
    Ra = lambda dx, dy: (crown[0] + dx * math.cos(ab) - dy * math.sin(ab), crown[1] + dx * math.sin(ab) + dy * math.cos(ab))
    antlers(cv, lambda dx, dy: Ra(dx - 1, dy + 3), spread)
    if mouth:
        cv.part(poly(cv.blank(), [R(3, 3), R(8, 4 + mouth), R(8, 5 + mouth), R(3, 4)]), COAT, ink=INK, gloss=False)
    skull = [R(-2, -2), R(2, -3), R(6, -1), R(10, 2), R(10, 4), R(4, 4), R(-1, 3)]
    cv.part(poly(cv.blank(), skull), COAT, ink=INK)
    cv.put(poly(cv.blank(), [R(4, 3), R(9, 3), R(9, 4), R(4, 4)]), CREAM)
    cv.pixel(*rnd(R(10, 2)), EYE)
    # 큰 귀(뒤 옆으로)
    cv.part(poly(cv.blank(), [R(-1, -1), R(-7, -4), R(-6, -1), R(-1, 1)]), COAT, ink=INK, gloss=False)
    e = rnd(R(3, 0))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(e[0], e[1] - 1, EYE_HI)
    return dict(eye=e, mouth=R(10, 3), crown=Ra(-5, -13))


def front(cv, P):
    U.neck(cv, B, L, P.sh, P.poll, 4.4, 3.2)
    cv.put(ellipse(cv.blank(), lerp(P.sh, P.poll, 0.35), 1.4, 1.4), CREAM)  # 목 흰 반점
    spots(cv, P)
    return head(cv, P.poll, P.tilt, P.extra.get("mouth", 0), P.extra.get("eye", "open"), P.extra.get("spread", 0))


POSES = {
    "idle_a": U.Pose(hip=(20, 36), sh=(36, 35), feet=((39, 60), (34, 60), (23, 60), (18, 60)), poll=(43, 22), tilt=40),
    "idle_b": U.Pose(hip=(20, 37), sh=(36, 36), feet=((39, 60), (34, 60), (23, 60), (18, 60)), poll=(44, 25), tilt=60, extra=dict(flag=2)),
    "idle_c": U.Pose(hip=(20, 36), sh=(36, 35), feet=((39, 60), (34, 60), (23, 60), (18, 60)), poll=(42, 21), tilt=25, extra=dict(spread=1)),
    "windup": U.Pose(hip=(19, 37), sh=(34, 37), feet=((38, 60), (33, 60), (22, 60), (17, 60)), poll=(41, 30), tilt=95, extra=dict(flag=3)),
    "move": U.Pose(hip=(23, 34), sh=(40, 35), feet=((52, 50), (47, 55), (12, 52), (20, 58)), lift=(4, 2, 3, 0), poll=(49, 25), tilt=70, extra=dict(flag=4)),
    "attack": U.Pose(hip=(19, 37), sh=(36, 38), feet=((42, 60), (36, 60), (22, 60), (16, 60)), poll=(44, 34), tilt=120, extra=dict(spread=-1, flag=2)),
    "recover": U.Pose(hip=(19, 36), sh=(34, 33), feet=((38, 60), (33, 60), (22, 60), (17, 60)), poll=(39, 19), tilt=-25, extra=dict(mouth=2, spread=2, flag=3)),
    "hit": U.Pose(hip=(18, 37), sh=(33, 36), feet=((36, 60), (31, 60), (21, 60), (15, 60)), poll=(37, 23), tilt=-10, extra=dict(eye="shut")),
}


def draw_dead(cv):
    for a, b in (((22, 54), (32, 58)), ((36, 55), (46, 58))):
        cv.part(chain([a, b], [2.2, 1.8]), COAT_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(12, 59), (14, 51), (24, 48), (38, 48), (44, 53), (42, 59)]), COAT, ink=INK)
    for x in (20, 26, 32):
        cv.pixel(x, 51, CREAM)
    cv.part(chain([(42, 54), (48, 56)], [3.6, 3]), COAT, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(47, 53), (54, 54), (58, 57), (57, 59), (48, 59)]), COAT, ink=INK)
    cv.part(chain([(49, 53), (46, 47), (42, 44)], [1.6, 1.4, 1]), ANTLER, ink=INK, gloss=False)
    cv.part(chain([(46, 47), (49, 43)], [1.2, 0.8]), ANTLER, ink=INK, gloss=False)
    cv.line([(50, 55), (52, 57)], EYE)
    cv.line([(52, 55), (50, 57)], EYE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 1, 7, (28, 36, 44), COAT[2])
    J = U.draw_body(cv, B, L, P, tail=tail, front_part=front)
    if name == "windup":
        sparkle(cv, add(J["crown"], (2, -2)), WHITE, LEAF[2])
    elif name == "move":
        puff(cv, (10, 57), 2.2, DUST)
    elif name == "attack":
        burst(cv, add(J["mouth"], (3, -6)), 4.5, LEAF[2], WHITE, spikes=6)
    elif name == "recover":
        for p, k in (((46, 12), 0), ((52, 20), 1), ((58, 14), 2), ((56, 28), 1), ((49, 6), 2), ((61, 23), 0)):
            cv.put(poly(cv.blank(), [add(p, (-2, 0)), add(p, (0, -2)), add(p, (2, 0)), add(p, (0, 2))]), LEAF[k % 2])
            cv.pixel(*p, LEAF[2])
        sparkle(cv, add(J["crown"], (0, -1)), WHITE, LEAF[2], big=True)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("deer-forest", draw, sys.argv[1:], idle_ms=220)
