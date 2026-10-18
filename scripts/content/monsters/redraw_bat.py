#!/usr/bin/env python3
"""회갈색 박쥐(bat, generated-enemy-bat-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

복슬복슬한 회갈색 털 몸통과 목 주위 밝은 털 깃, 길고 뾰족한 분홍 속귀, 들창코와 작은 송곳니.
손가락 뼈 넷이 펼친 분홍빛 주름 날개막이 칸마다 위·가운데·아래로 퍼덕인다.
6번 칸(스킬 skill_mon_blood_suck): 송곳니를 박고 붉은 피 방울을 입으로 빨아들인다.

  python3 scripts/content/monsters/redraw_bat.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle, speed_lines

INK = (30, 22, 24)
FUR = [(84, 70, 66), (122, 104, 96), (160, 142, 130), (196, 182, 168)]
RUFF = [(130, 112, 98), (170, 152, 134), (206, 192, 174), (230, 220, 204)]
MEM = [(150, 84, 98), (196, 120, 132), (226, 158, 166), (244, 196, 200)]
MEM_FAR = [(110, 62, 76), (150, 84, 98), (172, 100, 114), (172, 100, 114)]
BONE = (98, 60, 66)
EAR_IN = (232, 150, 160)
NOSE = (210, 120, 130)
EYE, EYE_HI = (30, 20, 26), (255, 240, 220)
FANG = (250, 246, 230)
MOUTH = (110, 30, 40)
BLOOD = [(120, 10, 24), (196, 30, 44), (250, 90, 96)]
WHITE = (255, 252, 240)


def wing(cv, sh, ang, span=24.0, far=False):
    """팔뼈 → 손목 → 손가락 넷을 부채처럼 펴고 손가락 사이 막을 오목하게(가리비 끝)."""
    k = 0.8 if far else 1.0
    wrist = polar(sh, ang, span * 0.38 * k)
    tips = [polar(wrist, ang + d, span * L * k) for d, L in ((-70, 0.5), (-30, 0.66), (8, 0.7), (46, 0.58))]
    body = add(sh, (0, 11))
    tips.sort(key=lambda f: -math.hypot(f[0] - body[0], f[1] - body[1]))
    pts = [sh, wrist, tips[0]]
    for a, b in zip(tips, tips[1:] + [body]):
        pts.append(lerp(lerp(a, b, 0.5), wrist, 0.28))
        pts.append(b)
    cv.part(poly(cv.blank(), pts), MEM_FAR if far else MEM, gloss=False)
    bone = INK if far else BONE
    cv.line4([sh, wrist], bone)
    for f in tips:
        cv.line4([wrist, f], bone)
    cv.pixel(*rnd(polar(wrist, ang - 110, 2)), FANG if not far else BONE)  # 엄지 발톱
    return wrist


def head(cv, c, tilt=0, mouth=0, eye="open", ear=0):
    def r(dx, dy):
        a = math.radians(tilt)
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 길고 뾰족한 귀 둘(먼 귀가 뒤로 젖혀짐)
    for base, tip, ramp in (((-3, -3), (-9 - ear, -14), FUR), ((1, -4), (3 - ear, -16), FUR)):
        cv.part(poly(cv.blank(), [r(base[0] - 3, base[1] + 1), r(*tip), r(base[0] + 3, base[1] + 1)]), ramp, gloss=False)
        cv.line4([r(base[0], base[1] - 1), lerp(r(base[0], base[1]), r(*tip), 0.65)], EAR_IN)
    cv.part(ellipse(cv.blank(), c, 5.5, 5.0), FUR)
    snout = [r(2, -2), r(7, -1), r(8, 2), r(3, 4)]
    cv.part(poly(cv.blank(), snout), FUR)
    cv.pixel(*rnd(r(7, 0)), NOSE)
    cv.pixel(*rnd(r(8, 0)), NOSE)
    if mouth:
        cv.put(poly(cv.blank(), [r(3, 2), r(8, 2), r(7, 2 + mouth), r(3, 3 + mouth * 0.5)]), MOUTH)
    cv.line([r(5, 3), r(5, 4 + (1 if mouth else 0))], FANG)
    cv.pixel(*rnd(r(7, 3 + (1 if mouth else 0))), FANG)
    e = r(2, -1)
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE)
        cv.pixel(*rnd(add(e, (1, -1))), EYE_HI)
    return r(9, 3)


def feet(cv, hip, d):
    for dx in (-2, 2):
        h = add(hip, (dx, 0))
        f = add(h, d)
        cv.part(chain([h, lerp(h, f, 0.6)], [2.2, 2]), FUR, gloss=False)
        cv.line4([lerp(h, f, 0.6), f], BONE)
        cv.pixel(*rnd(add(f, (1, 0))), FANG)


BASE = dict(c=(30.0, 34.0), tilt=0, wing=-115, mouth=0, eye="open", feet=(0, 7), ear=0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 내리쳐 몸이 뜬다
        p.update(c=(30.0, 31.0), wing=-165, feet=(-1, 6), ear=2)
    elif name == "idle_c":  # 날개가 가장 아래, 몸이 가라앉는다
        p.update(c=(30.0, 36.0), wing=-205, feet=(1, 7), ear=-1)
    elif name == "windup":  # 몸을 뒤로 젖혀 날개를 위로 활짝 펴고 입을 연다
        p.update(c=(26.0, 33.0), tilt=-14, wing=-85, mouth=3, feet=(-2, 6), ear=3)
    elif name == "move":  # 날개를 접고 머리부터 돌진
        p.update(c=(36.0, 36.0), tilt=20, wing=-178, feet=(-6, 3), ear=4)
    elif name == "attack":  # 물어뜯는다
        p.update(c=(37.0, 35.0), tilt=14, wing=-135, mouth=4, feet=(3, 6), ear=2)
    elif name == "recover":  # 스킬 흡혈: 목을 앞으로 내밀어 송곳니를 박고 날개로 감싼다
        p.update(c=(33.0, 35.0), tilt=24, wing=-60, mouth=4, feet=(2, 7), ear=3)
    elif name == "hit":  # 맞고 뒤로 튕기며 날개가 구겨진다
        p.update(c=(26.0, 37.0), tilt=-26, wing=-220, eye="shut", mouth=2, feet=(3, 6), ear=-2)
    return p


def draw_bat(cv, P):
    """먼 날개 → 가까운 날개(몸 뒤로 펼친 실루엣) → 발 → 털 몸통 → 머리 순."""
    c, tilt = P["c"], P["tilt"]
    sh = add(c, (-2, -4))
    wing(cv, add(sh, (4, -1)), P["wing"] + 58, far=True)
    wing(cv, sh, P["wing"])
    feet(cv, add(c, (-1, 6)), P["feet"])
    cv.part(ellipse(cv.blank(), c, 6.0, 7.5), FUR)
    # 목 털 깃(밝은 갈기) + 털 결
    cv.part(ellipse(cv.blank(), add(c, (2, -4)), 4.5, 3.0), RUFF, gloss=False)
    for dx, dy in ((-3, 1), (0, 3), (-2, 4), (2, 2)):
        cv.pixel(c[0] + dx, c[1] + dy, FUR[2])
    hc = add(c, (5, -8))
    mouth_pt = head(cv, hc, tilt, P["mouth"], P["eye"], P["ear"])
    return dict(mouth=mouth_pt, head=hc)


def draw_dead(cv):
    """바닥에 배를 깔고 엎어져 분홍 날개막이 양쪽으로 축 늘어진 모습."""
    cv.part(poly(cv.blank(), [(30, 56), (12, 51), (5, 57), (10, 58), (15, 56), (20, 59), (30, 59)]), MEM_FAR, gloss=False)
    cv.part(ellipse(cv.blank(), (31, 56), 7.0, 3.6), FUR)
    cv.part(poly(cv.blank(), [(37, 53), (35, 46), (39, 52)]), FUR, gloss=False)
    cv.part(poly(cv.blank(), [(39, 53), (42, 45), (42, 53)]), FUR, gloss=False)
    cv.part(ellipse(cv.blank(), (41, 56), 4.2, 3.4), FUR)
    cv.line([(40, 55), (42, 57)], INK)
    cv.line([(42, 55), (40, 57)], INK)
    cv.pixel(45, 56, NOSE)
    cv.part(poly(cv.blank(), [(32, 56), (45, 52), (56, 56), (52, 58), (48, 57), (44, 59), (32, 59)]), MEM, gloss=False)
    for f in ((56, 56), (48, 57), (44, 59)):
        cv.line4([(45, 52), f], BONE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 13, (24, 30, 36), MEM[1])
    j = draw_bat(cv, P)
    m = j["mouth"]
    if name == "attack":
        slash(cv, add(m, (-1, -7)), add(m, (5, 7)), 3, 2.8, MEM[3], WHITE)
        burst(cv, add(m, (3, 1)), 3.5, BLOOD[1], BLOOD[2], spikes=5, rot=10)
    elif name == "recover":
        # 물린 자리에서 피 방울이 호를 그리며 입으로 빨려 든다
        bite = add(m, (3, 2))
        burst(cv, bite, 3.2, BLOOD[1], BLOOD[2], spikes=6, rot=5)
        for k, t in enumerate((0.25, 0.5, 0.75)):
            a = -150 - k * 22
            p = polar(bite, a + 180, 6 + k * 3)
            p = add(p, (0, -4 - k * 2))
            cv.put(ellipse(cv.blank(), p, 1.4, 1.4), BLOOD[1])
            cv.pixel(*rnd(add(p, (-0.5, -0.8))), BLOOD[2])
        sparkle(cv, add(bite, (5, -9)), WHITE, BLOOD[2], big=True)
    elif name == "windup":
        cv.pixel(m[0] + 1, m[1] - 2, WHITE)
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((8, -8), (10, -5), (9, -11), (11, -2)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("bat", draw, sys.argv[1:], idle_ms=110)
