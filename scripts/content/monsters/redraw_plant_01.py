#!/usr/bin/env python3
"""거대한 식충 식물(plant-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

식인 식물(plant-carnivore, 파리지옥 턱)과 다른 종: 낭상엽 식충 식물. 땅에 넓게 깔린 잎 로제트에서
굵은 줄기가 솟고 그 끝에 위가 열린 큰 항아리 주머니(입술 테 둥근 고리 + 늘어진 뚜껑 잎)가 달렸다.
주머니 안쪽은 진한 자주, 겉은 연두에 붉은 반점·세로 줄, 입술 테 아래 작은 노란 눈 둘(주머니 앞면, 얼굴 축 위).
덩굴손 둘이 옆으로 뻗어 휘둘린다.
6번 칸(스킬 소화액 분사): 주머니를 아군 쪽으로 기울여 녹색 소화액을 왈칵 쏟아 뿌린다.

  python3 scripts/content/monsters/redraw_plant_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle

INK = (18, 34, 16)
LEAF = [(40, 96, 40), (70, 140, 54), (110, 180, 72), (160, 214, 110)]
LEAF_FAR = [(30, 70, 32), (40, 96, 40), (52, 116, 46), (52, 116, 46)]
PITCHER = [(120, 150, 50), (164, 192, 74), (200, 224, 110), (230, 242, 160)]
LIP = [(130, 30, 40), (180, 50, 60), (220, 90, 90), (240, 140, 130)]
INSIDE = (70, 20, 50)
SPOT = (160, 40, 50)
EYE = (255, 220, 60)
JUICE = [(80, 150, 30), (150, 210, 60), (220, 255, 150)]
DUST = [(80, 70, 50), (120, 108, 80)]
WHITE = (250, 255, 230)
G = 60


def rosette(cv, sway=0):
    for a, l, far in ((-170, 15, True), (-15, 15, True), (-160, 12, False), (-25, 12, False)):
        base = (30, 58)
        tip = polar(base, a + sway, l)
        tip = (tip[0], min(tip[1], 59))
        mid = add(lerp(base, tip, 0.5), (0, -3))
        cv.part(poly(cv.blank(), [add(base, (0, 1)), mid, tip, add(lerp(base, tip, 0.6), (0, 2))]), LEAF_FAR if far else LEAF, ink=INK, gloss=False)


def tendril(cv, root, ctrl, tip, far=False):
    pts = bezier(root, ctrl, tip, 6)
    cv.part(chain(pts, [2.4, 2.2, 2, 1.8, 1.6, 1.4, 1.2]), LEAF_FAR if far else LEAF, ink=INK, gloss=False)
    cv.pixel(*rnd(pts[-1]), LEAF[3])


def pitcher(cv, base, top, tilt=0, lid=0.0, eye="open"):
    """줄기 base → 주머니 바닥 top 위에 항아리. tilt 는 주머니 기울기(+ 앞=오른쪽)."""
    a = math.radians(tilt)
    R = lambda dx, dy: (top[0] + dx * math.cos(a) - dy * math.sin(a), top[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(chain(bezier(base, add(lerp(base, top, 0.5), (-4, 0)), top, 6), [5, 5, 4.6, 4.2, 4, 4, 4]), LEAF, ink=INK, gloss=False)
    # 뒤로 늘어진 뚜껑 잎
    cv.part(poly(cv.blank(), [R(-6, -19), R(-12 - lid * 3, -24 + lid * 4), R(-13 - lid * 2, -18 + lid * 6), R(-7, -15)]), LEAF, ink=INK, gloss=False)
    # 항아리 몸(아래가 볼록)
    body = [R(-5, 0), R(-8, -5), R(-8, -11), R(-6, -18), R(6, -18), R(8, -11), R(8, -5), R(5, 0)]
    cv.part(poly(cv.blank(), body), PITCHER, ink=INK)
    for x, y in ((-4, -6), (3, -7), (-1, -10), (5, -3), (-5, -12)):
        cv.pixel(*rnd(R(x, y)), SPOT)
    cv.line4([rnd(R(0, -2)), rnd(R(0, -9))], PITCHER[0])
    # 입술 테(열린 입구)
    cv.part(ellipse(cv.blank(), R(0, -19), 7.5, 2.6), LIP, ink=INK, gloss=False)
    cv.put(ellipse(cv.blank(), R(0, -19.5), 5, 1.2), INSIDE)
    # 입술 바로 아래 앞면의 두 눈(얼굴 축 = 주머니 앞쪽)
    for dx in (0, 5):
        e = rnd(R(dx, -15))
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
            cv.pixel(e[0] + 1, e[1], INK)
            cv.pixel(e[0] + 1, e[1] - 1, INK)
    return dict(mouth=R(6, -19), eye=rnd(R(4, -15)))


def plant(cv, top=(32, 38), tilt=0, lid=0.0, sway=0, t1=((28, 49), (12, 40), (8, 46)), t2=((31, 49), (48, 40), (52, 46)), eye="open"):
    rosette(cv, sway)
    tendril(cv, *t1, far=True)
    j = pitcher(cv, (30, 57), top, tilt, lid, eye)
    tendril(cv, *t2)
    return j


def draw_dead(cv):
    rosette(cv, 12)
    cv.part(chain([(30, 57), (40, 55), (46, 56)], [4, 4, 4]), LEAF_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(44, 59), (44, 53), (50, 50), (58, 51), (60, 56), (58, 59)]), [(110, 120, 60), (140, 150, 70), (170, 176, 100), (170, 176, 100)], ink=INK)
    cv.part(ellipse(cv.blank(), (59, 54), 1.6, 3.4), LIP, ink=INK, gloss=False)
    cv.pixel(52, 54, INK)
    cv.pixel(55, 54, INK)
    cv.put(ellipse(cv.blank(), (55, 59), 3, 0.6), JUICE[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        plant(cv)
    elif name == "idle_b":
        plant(cv, top=(33, 39), tilt=5, lid=0.4, sway=4, t1=((28, 49), (12, 42), (9, 49)), t2=((31, 49), (48, 42), (53, 49)))
    elif name == "idle_c":
        plant(cv, top=(31, 37), tilt=-4, lid=0.2, sway=-4, t1=((28, 49), (13, 38), (8, 42)), t2=((31, 49), (47, 38), (52, 42)))
    elif name == "windup":  # 몸을 뒤로 젖히고 덩굴손을 높이 감아올린다
        j = plant(cv, top=(28, 38), tilt=-18, lid=0.8, t1=((28, 49), (16, 30), (12, 22)), t2=((31, 49), (40, 30), (34, 20)))
        sparkle(cv, (36, 18), WHITE, LEAF[3])
    elif name == "move":  # 앞으로 기울며 잎을 밀어 미끄러진다
        plant(cv, top=(37, 39), tilt=14, lid=0.3, sway=8, t1=((28, 49), (14, 50), (6, 54)), t2=((31, 49), (50, 46), (58, 50)))
        puff(cv, (14, 57), 2.4, DUST)
    elif name == "attack":  # 가까운 덩굴손 채찍
        plant(cv, top=(34, 38), tilt=10, lid=0.5, t1=((28, 49), (16, 40), (12, 44)), t2=((31, 47), (50, 30), (61, 34)))
        burst(cv, (59, 34), 4.0, (240, 255, 190), WHITE, spikes=6)
    elif name == "recover":  # 스킬: 주머니를 기울여 소화액을 쏟는다
        j = plant(cv, top=(30, 40), tilt=40, lid=1.0, t1=((28, 49), (16, 38), (12, 42)), t2=((31, 49), (46, 50), (50, 54)))
        m = j["mouth"]
        jet = bezier(m, add(m, (10, -2)), (60, 46), 8)
        cv.part(chain(jet, [2.4, 2.8, 3.0, 3.2, 3.2, 3.0, 2.8, 2.6, 2.4]), JUICE, ink=INK, gloss=False)
        cv.line(jet[1:6], JUICE[2])
        for p in ((54, 52), (58, 56), (49, 55), (60, 40)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.2), JUICE[1])
        cv.put(ellipse(cv.blank(), (56, 59), 5, 0.8), JUICE[0])
    elif name == "hit":
        j = plant(cv, top=(28, 40), tilt=-24, lid=1.0, sway=-6, t1=((28, 49), (14, 50), (8, 56)), t2=((31, 49), (44, 52), (46, 57)), eye="shut")
        e = j["eye"]
        for dx, dy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("plant-01", draw, sys.argv[1:], idle_ms=260)
