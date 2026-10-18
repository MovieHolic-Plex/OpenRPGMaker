#!/usr/bin/env python3
"""식인 식물(plant-carnivore) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

굵은 뿌리 덩이에서 휘는 줄기가 솟고, 끝에 붉은 속살과 흰 이빨이 줄지은 파리지옥 덫 머리.
줄기 아래 넓은 잎 두 장(팔처럼 흔든다), 덫 등에 노란 반점, 덫 가장자리 가시털.
6번 칸(스킬 skill_mon_vine_whip): 줄기를 뒤로 젖히고 가시 덩굴을 앞으로 길게 뻗어 후려친다.

  python3 scripts/content/monsters/redraw_plant_carnivore.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, poly, polar, puff, rnd, run, slash, sparkle

INK = (16, 26, 18)
STEM = [(40, 82, 40), (64, 120, 52), (96, 156, 66), (140, 192, 96)]
STEM_FAR = [(30, 60, 32), (40, 82, 40), (52, 100, 46), (52, 100, 46)]
TRAP = [(48, 104, 52), (78, 146, 66), (116, 182, 84), (168, 214, 120)]
FLESH = [(140, 30, 44), (196, 54, 60), (232, 96, 92), (250, 150, 140)]
TOOTH = (246, 240, 214)
SPOT = (226, 204, 76)
ROOT = [(70, 50, 34), (104, 74, 48), (136, 102, 66), (136, 102, 66)]
THORN = (210, 196, 120)
SPORE = [(150, 178, 80), (220, 230, 140)]
WHITE = (255, 252, 236)
DIRT = [(92, 72, 52), (132, 108, 80)]
GROUND = 60


def leaf(cv, base, ang, length, far=False):
    """넓은 잎: 잎자루에서 ang 방향으로 뻗는 볼록한 잎 + 가운데 잎맥."""
    tip = polar(base, ang, length)
    mid = lerp(base, tip, 0.5)
    nx, ny = math.cos(math.radians(ang + 90)), math.sin(math.radians(ang + 90))
    w = length * 0.28
    pts = [base, add(mid, (nx * w, ny * w)), tip, add(mid, (-nx * w * 0.7, -ny * w * 0.7))]
    cv.part(poly(cv.blank(), pts), STEM_FAR if far else STEM, gloss=False)
    cv.line([base, lerp(base, tip, 0.85)], STEM[0] if far else STEM[3])
    return tip


def roots(cv, cx, spread=0.0):
    """땅 위로 드러난 뿌리 덩이 + 사방으로 기는 뿌리 발."""
    for dx, ex in ((-9 - spread, -15 - spread), (-4, -8), (5, 9), (9 + spread, 15 + spread)):
        cv.part(chain([(cx + dx * 0.4, GROUND - 4), (cx + dx, GROUND - 1), (cx + ex, GROUND)], [3.4, 2.4, 1.4]), ROOT, gloss=False)
    cv.part(ellipse(cv.blank(), (cx, GROUND - 4), 7, 4), ROOT)


def stem(cv, base, top, bend):
    """뿌리 -> 덫까지 휘는 줄기(bend 만큼 옆으로 부푼 곡선). 줄기 마디 가시."""
    ctrl = add(lerp(base, top, 0.5), (bend, 0))
    pts = bezier(base, ctrl, top, 6)
    cv.part(chain(pts, [6.0, 5.4, 5.0, 4.6, 4.2, 4.0, 4.0]), STEM)
    for k in (2, 4):
        p = pts[k]
        cv.pixel(*rnd(add(p, (-3, 0))), THORN)
        cv.pixel(*rnd(add(p, (3, -1))), THORN)
    return pts


def trap(cv, hinge, ang, gape, teeth=True):
    """파리지옥 덫 머리: 경첩 hinge 에서 ang 방향으로 열린 위·아래 턱. gape = 벌림 각(도)."""
    up_a, lo_a = ang - gape / 2, ang + gape / 2

    def jaw(a, sign):
        tip = polar(hinge, a, 17)
        back = polar(hinge, a - sign * 70, 4)
        belly = polar(lerp(hinge, tip, 0.5), a - sign * 90, 7)
        return [back, belly, polar(tip, a - sign * 60, 2), tip, polar(lerp(hinge, tip, 0.55), a + sign * 90, 1.5), hinge], tip

    # 속살(입 안): 두 턱 사이 부채꼴
    if gape > 6:
        inner = [hinge] + [polar(hinge, up_a + (lo_a - up_a) * i / 6, 15) for i in range(7)]
        cv.put(poly(cv.blank(), inner), FLESH[0])
        cv.put(poly(cv.blank(), [hinge] + [polar(hinge, up_a + (lo_a - up_a) * i / 6, 10) for i in range(1, 6)]), FLESH[1])
    lo, lo_tip = jaw(lo_a, -1)
    cv.part(poly(cv.blank(), lo), TRAP, gloss=False)
    up, up_tip = jaw(up_a, 1)
    cv.part(poly(cv.blank(), up), TRAP)
    # 턱 안쪽 붉은 테
    cv.line([polar(hinge, up_a, 4), polar(hinge, up_a + 2, 15)], FLESH[2])
    cv.line([polar(hinge, lo_a, 4), polar(hinge, lo_a - 2, 15)], FLESH[1])
    if teeth:
        for t in (0.45, 0.65, 0.85):
            a = polar(hinge, up_a + 3, 17 * t)
            cv.line([a, polar(a, up_a + 90, 2)], TOOTH)
            b = polar(hinge, lo_a - 3, 17 * t)
            cv.line([b, polar(b, lo_a - 90, 2)], TOOTH)
    # 등 반점 + 가시털
    for t in (0.35, 0.6):
        cv.pixel(*rnd(polar(polar(hinge, up_a, 17 * t), up_a - 90, 3)), SPOT)
    for t in (0.3, 0.55, 0.8):
        p = polar(polar(hinge, up_a, 17 * t), up_a - 90, 4.5)
        cv.line4([p, polar(p, up_a - 120, 2.5)], THORN)
    return dict(mouth=polar(hinge, ang, 12), up=up_tip, lo=lo_tip)


BASE = dict(cx=24, top=(32.0, 32.0), bend=-5, ang=8, gape=36, leaf_n=-30, leaf_f=-150, spread=0.0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 줄기가 뒤로 기울고 덫이 숨 쉬듯 조금 닫힌다
        p.update(top=(30.0, 31.0), bend=-7, ang=0, gape=26, leaf_n=-40, leaf_f=-140)
    elif name == "idle_c":  # 앞으로 기울며 입을 크게
        p.update(top=(34.0, 33.0), bend=-3, ang=14, gape=48, leaf_n=-20, leaf_f=-160)
    elif name == "windup":  # 줄기를 뒤로 크게 젖혀 머리를 높이 쳐든다
        p.update(top=(22.0, 22.0), bend=-9, ang=-28, gape=62, leaf_n=-70, leaf_f=-110, spread=1.0)
    elif name == "move":  # 뿌리로 기어 앞으로 쏠린다
        p.update(cx=28, top=(40.0, 30.0), bend=-6, ang=4, gape=40, leaf_n=-10, leaf_f=-170, spread=2.0)
    elif name == "attack":  # 줄기를 쭉 뻗어 덥석 문다(덫이 닫힘)
        p.update(cx=26, top=(44.0, 36.0), bend=-10, ang=24, gape=6, leaf_n=0, leaf_f=-180, spread=1.0)
    elif name == "recover":  # 스킬: 덩굴 채찍(머리는 뒤로, 잎 덩굴을 앞으로)
        p.update(top=(26.0, 27.0), bend=-6, ang=-14, gape=50, leaf_n=-6, leaf_f=-120)
    elif name == "hit":  # 맞아서 줄기가 뒤로 꺾이고 덫이 힘없이 벌어진다
        p.update(cx=22, top=(20.0, 33.0), bend=6, ang=-40, gape=30, leaf_n=40, leaf_f=-200)
    return p


def draw_plant(cv, P, whip=False):
    cx = P["cx"]
    base = (cx, GROUND - 6)
    leaf(cv, (cx - 1, GROUND - 13), P["leaf_f"], 14, far=True)
    roots(cv, cx, P["spread"])
    pts = stem(cv, base, P["top"], P["bend"])
    if whip:
        # 가시 덩굴: 줄기 중간에서 앞쪽 아래로 휘어 뻗는 긴 채찍
        s = pts[2]
        vine = bezier(s, (56, 18), (60, 46), 10)
        cv.part(chain(vine, [3.2, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 2.0, 1.8, 1.6, 1.4]), STEM)
        for k in range(2, 10, 2):
            cv.pixel(*rnd(add(vine[k], (1, -2))), THORN)
        tip = vine[-1]
    else:
        tip = None
        leaf(cv, (cx + 1, GROUND - 12), P["leaf_n"], 15)
    j = trap(cv, P["top"], P["ang"], P["gape"])
    j["vine"] = tip
    return j


def draw_dead(cv):
    """덫이 바닥에 축 늘어지고 줄기가 시들어 누운 모습."""
    roots(cv, 18, 1.0)
    cv.part(chain(bezier((18, 54), (28, 50), (40, 55), 6), [5, 4.6, 4.2, 4.0, 3.8, 3.6, 3.4]), STEM_FAR)
    cv.part(poly(cv.blank(), [(38, 52), (50, 50), (58, 54), (56, 58), (40, 58)]), STEM_FAR)
    cv.put(poly(cv.blank(), [(42, 56), (54, 55), (55, 57), (42, 58)]), FLESH[0])
    for x in (45, 49, 53):
        cv.pixel(x, 55, TOOTH)
    cv.part(poly(cv.blank(), [(12, 54), (6, 50), (4, 56)]), STEM_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(26, 54), (32, 48), (34, 54)]), STEM_FAR, gloss=False)
    puff(cv, (46, 47), 2.2, DIRT)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_plant(cv, P, whip=name == "recover")
    m = j["mouth"]
    if name == "attack":
        burst(cv, add(m, (6, 0)), 4.5, FLESH[1], WHITE, spikes=6, rot=12)
        slash(cv, add(m, (2, -9)), add(m, (5, 9)), 4, 3.0, TOOTH, WHITE)
    elif name == "recover":
        v = j["vine"]
        slash(cv, (44, 10), add(v, (1, -2)), -5, 3.0, STEM[3], WHITE)
        burst(cv, add(v, (-1, -3)), 4.0, THORN, WHITE, spikes=6, rot=20)
    elif name == "windup":
        for p in ((10, 20), (16, 14), (8, 30)):
            cv.put(ellipse(cv.blank(), p, 1.2, 1.2), SPORE[1])
    elif name == "move":
        puff(cv, (10, 57), 2.2, DIRT)
    elif name == "hit":
        for dx, dy in ((-2, -10), (2, -12), (-6, -8), (5, -9)):
            cv.pixel(m[0] + dx, m[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("plant-carnivore", draw, sys.argv[1:], idle_ms=320)
