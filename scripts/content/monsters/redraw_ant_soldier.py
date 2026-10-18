#!/usr/bin/env python3
"""병정개미(ant-soldier) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

윤기 도는 붉은 갑각의 큰 병정개미: 뒤쪽 둥근 배(마디 띠), 잘록한 허리 마디 둘, 길쭉한 가슴, 
몸보다 큰 네모진 머리와 앞으로 맞물린 톱날 큰턱, 꺾인 더듬이(무릎 관절), 가늘고 긴 다리 여섯(가까운 셋·먼 셋)이 y=60 을 딛는다.
6번 칸(스킬, 아키타입 venom): 배를 앞다리 사이로 말아 넣고 끝에서 개미산 줄기를 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_ant_soldier.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, ik, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (30, 10, 10)
SHELL = [(100, 24, 22), (160, 40, 32), (206, 70, 50), (246, 150, 120)]
SHELL_FAR = [(70, 16, 18), (100, 24, 22), (124, 32, 28), (124, 32, 28)]
JAW = [(70, 30, 20), (130, 70, 40), (190, 130, 80), (240, 200, 150)]
EYE = (20, 16, 18)
ACID = [(160, 190, 50), (210, 240, 100), (250, 255, 200)]
DUST = [(110, 90, 70), (150, 130, 104)]
WHITE = (255, 250, 240)
GROUND = 60


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, hip, foot, far=False, lift=0):
    """가는 두 마디 다리: 엉덩이 -> 몸보다 높이 솟은 무릎(발 쪽으로 45%) -> 발끝. 무릎에서 꺾여 옆으로 벌어진다."""
    ramp = SHELL_FAR if far else SHELL
    foot = add(foot, (0, -lift))
    knee = (hip[0] + (foot[0] - hip[0]) * 0.45, hip[1] - 5)
    cv.part(chain([hip, knee], [2.2, 1.8]), ramp, gloss=False)
    cv.part(chain([knee, foot], [1.8, 1.0]), ramp, gloss=False)
    if not far:
        cv.pixel(*rnd(knee), SHELL[3])
        cv.pixel(*rnd(lerp(knee, foot, 0.5)), SHELL[0])
    return knee


def gaster(cv, c, tilt, curl=0.0):
    """뒤쪽 둥근 배. curl>0 이면 아래·앞으로 말려 들어간다(산 쏘기)."""
    M = cv.part(ellipse(cv.blank(), c, 9.0 - curl * 1.5, 7.0), SHELL)
    for k, dx in enumerate((-5, -1, 3)):
        a = xf(c, tilt, [(dx, -6.5 + abs(dx) * 0.3), (dx - 1, 6 - abs(dx) * 0.3)])
        cv.line4([lerp(a[0], a[1], 0.05), lerp(a[0], a[1], 0.5)], SHELL[0])
    cv.pixel(*rnd(add(c, (-2, -4))), SHELL[3])
    cv.pixel(*rnd(add(c, (-1, -5))), SHELL[3])
    return M


def head(cv, h, tilt, jaw=0.0, eye="open", ant=0.0):
    """네모진 큰 머리 + 앞으로 맞물리는 톱날 큰턱 + 꺾인 더듬이. jaw = 큰턱 벌림 각."""
    P = lambda *pts: xf(h, tilt, pts)
    # 더듬이: 머리 앞 위에서 위로 솟았다가 무릎에서 앞으로 꺾인다
    for k, (base, col) in enumerate((((2, -5), SHELL_FAR[2]), ((4, -5), SHELL[1]))):
        elbow = P((base[0] - 2 - ant, -13))[0]
        tip = P((base[0] + 6 - ant * 2, -17 + k))[0]
        cv.line4([P(base)[0], elbow, tip], col)
    # 큰턱 둘(위·아래)
    for sgn, ramp in ((-1, JAW), (1, JAW)):
        root = P((6, sgn * 1.5 + 2))[0]
        a = sgn * jaw
        mid = xf(root, tilt + a, [(5, sgn * 0.5)])[0]
        tip = xf(root, tilt + a, [(9, -sgn * 2.5)])[0]
        cv.part(chain([root, mid, tip], [2.4, 2.0, 1.0]), ramp, gloss=False)
        cv.pixel(*rnd(lerp(root, mid, 0.6)), JAW[3])
    skull = P((-5, -4), (2, -6), (7, -4), (8, 2), (6, 5), (-3, 5), (-6, 1))
    cv.part(poly(cv.blank(), skull), SHELL)
    e = P((3, -2))[0]
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(ellipse(cv.blank(), e, 1.4, 1.2), EYE)
        cv.pixel(*rnd(add(e, (0, -1))), SHELL[3])
    return dict(jaw=P((15, 2))[0], top=P((2, -6))[0])


BASE = dict(g=(15.0, 45.0), th=(32.0, 45.0), h=(42.0, 40.0), tilt=6.0, gtilt=0.0, jaw=8.0, eye="open", ant=0.0, curl=0.0,
            feet=((52, 0), (37, 0), (14, 0), (47, 0), (31, 0), (19, 0)))


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 몸을 살짝 낮추고 큰턱을 연다
        p.update(g=(15.0, 46.0), th=(32.0, 45.0), h=(42.0, 41.0), tilt=10.0, jaw=18.0, ant=1.0)
    elif name == "idle_c":  # 머리를 들어 더듬이를 휘두르며 큰턱을 딸깍
        p.update(g=(15.0, 45.0), th=(32.0, 43.0), h=(42.0, 37.0), tilt=0.0, jaw=2.0, ant=-1.0)
    elif name == "windup":  # 몸을 뒤로 빼고 앞몸을 치켜 큰턱을 활짝
        p.update(g=(12.0, 47.0), th=(28.0, 42.0), h=(37.0, 34.0), tilt=-14.0, jaw=34.0, ant=1.5,
                 feet=((48, 0), (33, 0), (10, 0), (43, 0), (27, 0), (15, 0)))
    elif name == "move":  # 몸을 낮게 뻗어 돌진, 다리를 크게 벌린다
        p.update(g=(18.0, 45.0), th=(36.0, 45.0), h=(47.0, 42.0), tilt=10.0, jaw=20.0, ant=2.0,
                 feet=((58, -3), (40, 0), (14, -2), (52, 0), (34, -2), (20, 0)))
    elif name == "attack":  # 앞으로 들이받으며 큰턱을 꽉 문다
        p.update(g=(18.0, 45.0), th=(36.0, 44.0), h=(47.0, 42.0), tilt=18.0, jaw=-6.0, ant=2.0,
                 feet=((57, 0), (41, 0), (18, 0), (52, 0), (35, 0), (23, 0)))
    elif name == "recover":  # 스킬: 배를 앞다리 사이로 말아 넣는다
        p.update(g=(26.0, 54.0), gtilt=60.0, th=(30.0, 41.0), h=(39.0, 34.0), tilt=-8.0, jaw=20.0, curl=1.0,
                 feet=((48, 0), (36, 0), (14, 0), (44, 0), (30, 0), (20, 0)))
    elif name == "hit":  # 맞아서 뒤로 젖혀지며 다리가 들린다
        p.update(g=(13.0, 46.0), th=(29.0, 43.0), h=(37.0, 36.0), tilt=-24.0, jaw=12.0, eye="shut", ant=2.5,
                 feet=((50, -4), (35, 0), (12, 0), (45, 0), (29, 0), (17, 0)))
    return p


def draw_ant(cv, P):
    th, g, h = P["th"], P["g"], P["h"]
    hips = [add(th, (3, 3)), add(th, (0, 3)), add(th, (-3, 3))]
    f = P["feet"]
    for hip, (fx, fy) in zip(hips, f[3:]):
        leg(cv, add(hip, (1, -1)), (fx, GROUND + fy), far=True)
    if P["curl"]:
        # 말아 넣은 배: 허리에서 아래·앞으로
        waist = add(th, (-6, 2))
        cv.part(chain([waist, lerp(waist, g, 0.5)], [2.6, 2.2]), SHELL)
        gaster(cv, g, P["gtilt"], P["curl"])
    else:
        waist = add(th, (-6, 1))
        node = lerp(waist, g, 0.5)
        cv.part(ellipse(cv.blank(), add(node, (0, -1)), 2.4, 2.6), SHELL)
        gaster(cv, g, P["gtilt"])
        cv.part(ellipse(cv.blank(), waist, 2.2, 2.4), SHELL)
    # 가슴: 길쭉하고 등이 솟음
    cv.part(poly(cv.blank(), [add(th, (-7, 0)), add(th, (-4, -4)), add(th, (3, -5)), add(th, (7, -2)),
                              add(th, (6, 3)), add(th, (-5, 3))]), SHELL)
    cv.pixel(*rnd(add(th, (0, -4))), SHELL[3])
    neck = add(th, (6, -2))
    cv.part(chain([neck, lerp(neck, h, 0.6)], [2.4, 2.4]), SHELL)
    for hip, (fx, fy) in zip(hips, f[:3]):
        leg(cv, hip, (fx, GROUND + fy))
    return head(cv, h, P["tilt"], P["jaw"], P["eye"], P["ant"])


def draw_dead(cv):
    """뒤집혀 다리를 위로 오그린 개미."""
    for x in (22, 27, 32, 36):
        cv.line4([(x, 52), (x + 2, 46), (x + 4, 45)], SHELL[1])
    cv.part(ellipse(cv.blank(), (16, 55), 8.0, 5.0), SHELL)
    cv.part(ellipse(cv.blank(), (26, 55), 2.4, 2.2), SHELL)
    cv.part(ellipse(cv.blank(), (33, 55), 5.0, 3.6), SHELL)
    cv.part(poly(cv.blank(), [(39, 51), (46, 51), (48, 57), (40, 59)]), SHELL)
    cv.part(chain([(47, 56), (52, 58), (54, 55)], [2.0, 1.6, 1.0]), JAW, gloss=False)
    cv.line4([(42, 51), (44, 45), (49, 44)], SHELL_FAR[2])
    cv.line([(42, 53), (44, 55)], INK)
    cv.line([(44, 53), (42, 55)], INK)
    puff(cv, (28, 46), 2.0, DUST)
    puff(cv, (8, 48), 1.8, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_ant(cv, P)
    jw = j["jaw"]
    if name == "recover":
        tip = add(P["g"], (6, 4))
        jet = bezier(tip, (48, 50), (61, 36), 10)
        cv.line(jet, ACID[0], width=4)
        cv.line(jet, ACID[1], width=2)
        cv.line(jet[3:9], ACID[2])
        for p in ((56, 30), (60, 42), (52, 40), (58, 34)):
            cv.pixel(*p, ACID[2])
        burst(cv, (60, 37), 3.4, ACID[1], WHITE, spikes=6, rot=12)
    elif name == "attack":
        slash(cv, add(jw, (-4, -9)), add(jw, (3, 7)), 3, 3.0, JAW[3], WHITE)
        burst(cv, add(jw, (2, 0)), 4.0, JAW[3], WHITE, spikes=6, rot=8)
    elif name == "windup":
        sparkle(cv, add(jw, (-1, -5)), WHITE, JAW[3], big=True)
    elif name == "move":
        puff(cv, (8, 57), 2.4, DUST)
        for y in (32, 38, 44):
            cv.line([(1, y), (5, y)], SHELL[2])
    elif name == "hit":
        t = j["top"]
        for dx, dy in ((8, -6), (10, -3), (9, -9), (12, 0)):
            cv.pixel(t[0] + dx, t[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("ant-soldier", draw, sys.argv[1:], idle_ms=170)
