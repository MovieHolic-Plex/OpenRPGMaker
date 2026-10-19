#!/usr/bin/env python3
"""하얀 유니콘(unicorn-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

발굽 짐승 뼈대(ungulate_rig.py) 위에 말(horse-01)보다 가늘고 다리가 긴 몸, 짧고 갈라진 발굽(갈색 말과 다름),
턱 밑 염소 수염, 이마의 나선 금빛 뿔, 물결치는 연보라·하늘색 긴 갈기와 사자꼬리처럼 끝만 술진 꼬리,
머리 안의 큰 푸른 눈. 6번 칸(스킬 성광 돌격): 뿔을 앞으로 겨누고 뿔끝에서 빛줄기가 아군 쪽으로 뻗는다.

  python3 scripts/content/monsters/redraw_unicorn_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import ungulate_rig as U
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (56, 50, 80)
COAT = [(180, 176, 206), (222, 220, 240), (244, 244, 252), (255, 255, 255)]
COAT_FAR = [(150, 146, 180), (180, 176, 206), (196, 192, 220), (196, 192, 220)]
MANE = [(130, 110, 200), (170, 150, 236), (150, 200, 246), (220, 236, 255)]
HOOF = [(170, 130, 60), (210, 170, 80), (240, 210, 120), (240, 210, 120)]
HORN = [(200, 150, 50), (240, 200, 90), (255, 236, 160), (255, 250, 220)]
EYE = (60, 110, 210)
EYE_HI = (230, 240, 255)
NOSE = (200, 150, 170)
LIGHT = [(255, 220, 120), (255, 244, 190), (255, 255, 250)]
DUST = [(140, 136, 160), (190, 186, 210)]
WHITE = (255, 255, 255)

B = U.Build(upper=8.5, lower=9.5, thigh=11.5, cannon=9.5, leg_w=2.4, belly=5.6, hoof="split")
L = U.Look(ramp=COAT, far=COAT_FAR, ink=INK, hoof=HOOF)


def tail(cv, P):
    r = add(P.hip, (-4, -1))
    sw = P.extra.get("tail", 0)
    pts = bezier(r, add(r, (-7, -2 - sw)), add(r, (-10 - sw, 12)), 6)
    cv.part(chain(pts, [2.2, 2, 1.8, 1.8, 1.8, 2.4, 3]), COAT, ink=INK, gloss=False)
    e = pts[-1]
    cv.part(poly(cv.blank(), [add(e, (-3, -2)), add(e, (2, -2)), add(e, (1, 5)), add(e, (-1, 3)), add(e, (-3, 5))]), MANE, ink=INK, gloss=False)


def head(cv, poll, tilt, mouth=0, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (poll[0] + dx * math.cos(a) - dy * math.sin(a), poll[1] + dx * math.sin(a) + dy * math.cos(a))
    # 수염
    cv.part(poly(cv.blank(), [R(7, 5), R(9, 5), R(7, 9)]), MANE, ink=INK, gloss=False)
    if mouth:
        cv.part(poly(cv.blank(), [R(4, 4), R(10, 5 + mouth), R(10, 6 + mouth), R(4, 5)]), COAT, ink=INK, gloss=False)
    skull = [R(-2, -2), R(3, -3), R(7, -1), R(11, 2), R(11, 4), R(9, 5), R(3, 5), R(-1, 3)]
    cv.part(poly(cv.blank(), skull), COAT, ink=INK)
    cv.pixel(*rnd(R(10, 3)), NOSE)
    # 나선 뿔(이마에서 앞 위로)
    base = R(3, -3)
    tip = R(10, -12)
    cv.part(chain([base, lerp(base, tip, 0.5), tip], [2.8, 2.0, 0.8]), HORN, ink=INK, gloss=False)
    for t in (0.25, 0.5, 0.75):
        cv.pixel(*rnd(lerp(base, tip, t)), HORN[0])
    # 귀
    cv.part(poly(cv.blank(), [R(-1, -2), R(-1, -7), R(2, -3)]), COAT, ink=INK, gloss=False)
    e = rnd(R(4, 1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(e[0], e[1] - 1, EYE_HI)
        cv.pixel(e[0] - 1, e[1], INK)
    return dict(eye=e, horn=tip, mouth=R(10, 5))


def front(cv, P):
    poll = P.poll
    U.neck(cv, B, L, P.sh, poll, 6.0, 4.0)
    # 물결 갈기: 목 윗선에서 뒤로 길게 흐르는 세 가닥(두 색)
    base = add(P.sh, (-1, -3))
    wv = P.extra.get("wave", 0)
    for k, t in enumerate((0.15, 0.45, 0.8)):
        p = lerp(base, poll, t)
        col = MANE if k % 2 == 0 else [MANE[0], MANE[2], MANE[3], MANE[3]]
        pts = bezier(p, add(p, (-5, 2 + wv)), add(p, (-8, 8 - wv)), 4)
        cv.part(chain(pts, [3, 2.8, 2.4, 1.8, 1.2]), col, ink=INK, gloss=False)
    return head(cv, poll, P.tilt, P.extra.get("mouth", 0), P.extra.get("eye", "open"))


POSES = {
    "idle_a": U.Pose(hip=(19, 34), sh=(36, 33), feet=((39, 60), (34, 60), (22, 60), (17, 60)), poll=(43, 17), tilt=45),
    "idle_b": U.Pose(hip=(19, 35), sh=(36, 34), feet=((39, 60), (34, 60), (22, 60), (17, 60)), poll=(43, 18), tilt=38, extra=dict(wave=2, tail=2)),
    "idle_c": U.Pose(hip=(19, 34), sh=(36, 33), feet=((40, 59), (34, 60), (22, 60), (17, 60)), lift=(2, 0, 0, 0), poll=(44, 18), tilt=55, extra=dict(wave=-2, tail=-2)),
    "windup": U.Pose(hip=(18, 36), sh=(30, 27), feet=((38, 40), (34, 42), (22, 60), (16, 60)), lift=(4, 4, 0, 0), poll=(36, 12), tilt=25, extra=dict(mouth=2, wave=3, tail=4)),
    "move": U.Pose(hip=(23, 33), sh=(41, 34), feet=((52, 50), (47, 56), (13, 54), (20, 60)), lift=(4, 0, 2, 0), poll=(51, 22), tilt=75, extra=dict(wave=4, tail=6)),
    "attack": U.Pose(hip=(17, 35), sh=(34, 35), feet=((42, 60), (37, 60), (21, 60), (15, 60)), poll=(43, 28), tilt=95, extra=dict(wave=3, tail=4)),
    "recover": U.Pose(hip=(16, 34), sh=(32, 33), feet=((38, 60), (33, 60), (20, 60), (14, 60)), poll=(40, 22), tilt=80, extra=dict(mouth=1, wave=4, tail=6)),
    "hit": U.Pose(hip=(17, 36), sh=(33, 35), feet=((36, 60), (31, 60), (21, 60), (14, 60)), poll=(37, 20), tilt=-5, extra=dict(eye="shut", wave=-3, tail=-4)),
}


def draw_dead(cv):
    for a, b in (((22, 54), (30, 58)), ((36, 55), (46, 58))):
        cv.part(chain([a, b], [2.4, 2]), COAT_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(12, 59), (14, 51), (24, 48), (40, 48), (46, 53), (44, 59)]), COAT, ink=INK)
    cv.part(chain(bezier((14, 53), (6, 54), (4, 58), 4), [2, 2, 2, 2.4, 3]), MANE, ink=INK, gloss=False)
    cv.part(chain([(44, 53), (50, 55)], [5, 4]), COAT, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(49, 52), (56, 53), (60, 57), (59, 59), (50, 59)]), COAT, ink=INK)
    cv.part(chain([(52, 52), (58, 47)], [2, 0.8]), HORN, ink=INK, gloss=False)
    cv.part(chain(bezier((42, 49), (40, 45), (36, 46), 3), [3, 2.6, 2, 1.4]), MANE, ink=INK, gloss=False)
    cv.line([(52, 54), (54, 56)], INK)
    cv.line([(54, 54), (52, 56)], INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    if name == "move":
        speed_lines(cv, 1, 7, (26, 34, 42), MANE[2])
    J = U.draw_body(cv, B, L, P, tail=tail, front_part=front)
    h = J["horn"]
    if name == "windup":
        glow(cv, h, 3, [LIGHT[0], LIGHT[2]])
    elif name == "move":
        for p in ((10, 50), (16, 44)):
            sparkle(cv, p, WHITE, MANE[2])
    elif name == "attack":
        burst(cv, add(h, (2, 1)), 4.5, LIGHT[1], WHITE, spikes=6)
    elif name == "recover":
        # 뿔끝 빛줄기: 아군 쪽으로 곧게 뻗는 두꺼운 광선 + 별
        end = (62, h[1] + 4)
        cv.line([h, end], LIGHT[0], width=4)
        cv.line([h, end], LIGHT[2], width=2)
        glow(cv, h, 3.5, [LIGHT[1], LIGHT[2]])
        for p in ((52, h[1] - 4), (58, h[1] + 10)):
            sparkle(cv, p, WHITE, LIGHT[0], big=True)
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("unicorn-01", draw, sys.argv[1:], idle_ms=210)
