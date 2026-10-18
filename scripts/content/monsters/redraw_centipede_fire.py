#!/usr/bin/env python3
"""화염 지네(centipede-fire) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

검붉은 마디 갑판이 줄지은 긴 몸통이 뒤쪽은 땅을 기고 앞쪽 다섯 마디는 S자로 치켜 선다.
마디마다 주황빛으로 달아오른 이음매와 등의 불씨 돌기, 마디마다 한 쌍씩 금빛 갈고리 다리,
치켜든 머리에 집게 같은 독턱 둘과 긴 더듬이, 끝 마디에 꼬리 집게. 오른쪽(아군)을 본다.
6번 칸(스킬, 아키타입 venom): 머리를 높이 들고 독턱을 벌려 불붙은 독액을 아군 쪽으로 내뿜는다.

  python3 scripts/content/monsters/redraw_centipede_fire.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, flame, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (30, 8, 10)
PLATE = [(84, 20, 26), (140, 36, 38), (196, 70, 52), (240, 140, 96)]
PLATE_FAR = [(56, 14, 20), (84, 20, 26), (110, 30, 32), (110, 30, 32)]
GLOW = [(220, 90, 30), (255, 170, 60), (255, 236, 150)]
LEG = (210, 160, 60)
LEG_FAR = (130, 90, 40)
FANG = [(120, 80, 30), (210, 170, 70), (250, 226, 140), (250, 226, 140)]
FIRE = [(200, 40, 20), (255, 120, 30), (255, 210, 80), (255, 250, 210)]
SMOKE = [(70, 56, 56), (110, 96, 92)]
WHITE = (255, 250, 236)
GROUND = 60


def spine(P):
    """꼬리(뒤, 바닥) -> 몸 앞(치켜듦) -> 머리 중심. 마디 중심점 목록."""
    back = bezier(P["tail"], P["mid_c"], P["mid"], 7)
    front = bezier(P["mid"], P["neck_c"], P["head"], 6)
    return back + front[1:]


def draw_body(cv, P):
    pts = spine(P)
    n = len(pts)
    seg_r = [3.0 + 1.6 * math.sin(math.pi * min(1, i / (n - 3))) for i in range(n)]
    # 다리: 바닥에 닿은 마디는 아래로 짚고, 들린 마디는 앞으로 갈고리를 휘젓는다
    for i in range(1, n - 1):
        p, r = pts[i], seg_r[i]
        on_ground = p[1] > GROUND - 10
        for far, dx in ((True, -1), (False, 1)):
            col = LEG_FAR if far else LEG
            if on_ground:
                knee = add(p, (dx + 2, -1))
                foot = (p[0] + dx + 3 + (i % 2), GROUND)
                cv.line4([add(p, (0, r * 0.5)), knee, foot], col)
            else:
                wav = P["wave"] * (1 if i % 2 else -1)
                tip = add(p, (4 + dx, 4 + wav))
                cv.line4([p, add(p, (3 + dx, 1)), tip], col)
    # 마디 판: 뒤에서 앞으로 겹쳐 그린다
    for i, p in enumerate(pts[:-1]):
        r = seg_r[i]
        nxt = pts[i + 1]
        ang = math.degrees(math.atan2(nxt[1] - p[1], nxt[0] - p[0]))
        far = i == 0
        cv.part(ellipse(cv.blank(), p, r + 0.6, r), PLATE_FAR if far else PLATE)
        # 이음매 불빛(다음 마디 쪽 가장자리)
        seam = polar(p, ang + 90, r * 0.6)
        cv.pixel(*rnd(lerp(p, nxt, 0.5)), GLOW[0])
        cv.pixel(*rnd(seam), GLOW[1])
        # 등의 불씨 돌기
        top = polar(p, ang - 90, r + 0.5)
        cv.pixel(*rnd(top), GLOW[2] if i % 2 else GLOW[1])
    # 꼬리 집게
    t = pts[0]
    cv.line4([t, add(t, (-5, -2)), add(t, (-7, -5))], LEG)
    cv.line4([t, add(t, (-6, 1)), add(t, (-8, -1))], LEG_FAR)
    return pts, seg_r


def draw_head(cv, h, tilt, gape, eye="open"):
    a = math.radians(tilt)

    def r(dx, dy):
        return (h[0] + dx * math.cos(a) - dy * math.sin(a), h[1] + dx * math.sin(a) + dy * math.cos(a))
    # 더듬이(뒤·위로 길게)
    cv.line4([r(1, -4), r(-2, -10), r(-7, -14)], LEG)
    cv.line4([r(3, -4), r(3, -11), r(0, -16)], LEG_FAR)
    cv.part(poly(cv.blank(), [r(-3, -4), r(3, -5), r(7, -2), r(7, 3), r(2, 5), r(-3, 4)]), PLATE)
    # 독턱 둘(위·아래, gape 만큼 벌어짐)
    for sgn, ramp in ((-1, FANG), (1, FANG)):
        root = r(6, sgn * 1.5 + 1)
        mid = r(10, sgn * (2.5 + gape) + 1)
        tip = r(12, sgn * (0.5 + gape * 0.4) + 1)
        cv.part(chain([root, mid, tip], [2.4, 1.8, 1.0]), ramp, gloss=False)
    e = r(3, -2)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*rnd(e), GLOW[2])
        cv.pixel(*rnd(add(e, (1, 0))), GLOW[1])
    return r(13, 1)


BASE = dict(tail=(8.0, 55.0), mid_c=(18.0, 56.0), mid=(30.0, 52.0), neck_c=(40.0, 46.0), head=(40.0, 28.0),
            tilt=10.0, gape=0.0, wave=0.0, eye="open")


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 앞몸이 살짝 내려앉고 다리가 물결친다
        p.update(head=(41.0, 30.0), neck_c=(41.0, 47.0), tilt=16.0, wave=1.0)
    elif name == "idle_c":  # 머리를 뒤로 젖혀 독턱을 딸깍
        p.update(head=(38.0, 27.0), neck_c=(38.0, 44.0), tilt=0.0, gape=1.0, wave=-1.0)
    elif name == "windup":  # 몸을 S자로 뒤로 감아 머리를 높이
        p.update(tail=(12.0, 55.0), mid=(30.0, 52.0), neck_c=(22.0, 42.0), head=(34.0, 22.0), tilt=-10.0, gape=2.0, wave=1.0)
    elif name == "move":  # 몸을 낮게 펴고 앞으로 미끄러진다
        p.update(tail=(4.0, 55.0), mid_c=(20.0, 55.0), mid=(36.0, 54.0), neck_c=(48.0, 52.0), head=(52.0, 42.0),
                 tilt=18.0, wave=1.5)
    elif name == "attack":  # 앞으로 내리꽂으며 독턱으로 문다
        p.update(tail=(8.0, 55.0), mid=(34.0, 52.0), neck_c=(52.0, 38.0), head=(50.0, 40.0), tilt=40.0, gape=3.0, wave=-1.5)
    elif name == "recover":  # 스킬 불 독액: 머리를 높이 들고 독턱을 벌려 내뿜는다
        p.update(neck_c=(32.0, 40.0), head=(38.0, 22.0), tilt=-6.0, gape=3.0, wave=1.0)
    elif name == "hit":  # 맞아서 뒤로 휘청, 몸이 뒤로 꺾인다
        p.update(neck_c=(26.0, 44.0), head=(30.0, 30.0), tilt=-28.0, gape=1.0, eye="shut", wave=-1.0)
    return p


def draw_dead(cv):
    """몸을 뒤집어 바닥에 늘어지고 다리가 하늘로 오그라든다."""
    pts = bezier((6.0, 56.0), (26.0, 52.0), (50.0, 56.0), 9)
    for i, p in enumerate(pts):
        cv.line([add(p, (0, -3)), add(p, (1, -6))], LEG if i % 2 else LEG_FAR)
    for i, p in enumerate(pts):
        cv.part(ellipse(cv.blank(), p, 3.2, 2.6), PLATE_FAR if i % 2 else PLATE)
    h = (55, 56)
    cv.part(ellipse(cv.blank(), h, 4.0, 3.0), PLATE)
    cv.line([(58, 55), (60, 52)], FANG[1])
    cv.line([(54, 55), (56, 57)], INK)
    cv.line([(56, 55), (54, 57)], INK)
    puff(cv, (30, 47), 2.2, SMOKE)
    puff(cv, (12, 49), 1.8, SMOKE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    pts, _ = draw_body(cv, P)
    mouth = draw_head(cv, pts[-1], P["tilt"], P["gape"], P["eye"])
    if name == "recover":
        jet = bezier(mouth, (54, 20), (60, 34), 10)
        cv.line(jet, FIRE[0], width=5)
        cv.line(jet, FIRE[1], width=3)
        cv.line(jet[:8], FIRE[2])
        flame(cv, (58, 42), 9, 7, FIRE[:3], lean=0.4, seed=2)
        for p in ((52, 14), (58, 22), (61, 28), (49, 26)):
            cv.pixel(*p, FIRE[2])
    elif name == "attack":
        slash(cv, add(mouth, (-6, -10)), add(mouth, (3, 6)), 3, 3.0, FIRE[1], FIRE[3])
        burst(cv, add(mouth, (2, 1)), 4.5, FIRE[1], FIRE[3], spikes=7, rot=5)
    elif name == "windup":
        sparkle(cv, add(mouth, (0, -3)), WHITE, FIRE[2], big=True)
        for p in ((30, 40), (22, 44)):
            cv.pixel(*p, GLOW[2])
    elif name == "move":
        puff(cv, (6, 57), 2.4, SMOKE)
        for y in (44, 50):
            cv.line([(1, y), (6, y)], PLATE[2])
    elif name == "hit":
        h = pts[-1]
        for dx, dy in ((8, -9), (10, -6), (9, -12), (12, -3)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("centipede-fire", draw, sys.argv[1:], idle_ms=170)
