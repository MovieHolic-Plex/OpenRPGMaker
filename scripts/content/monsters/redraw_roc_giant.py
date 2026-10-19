#!/usr/bin/env python3
"""청회색 거대 독수리(roc-giant) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

같은 맹금류인 매(redraw_bird_hawk.py)의 날개·꼬리 관절을 쓰되 생김새는 거대 독수리로 새로 그린다:
청회색 등·날개(끝 깃 검정), 흰 머리와 흰 꼬리, 크고 두꺼운 노란 갈고리 부리, 머리 안의 날카로운 금빛 눈과 짙은 눈썹뼈,
가슴은 짙은 회갈색 깃(매의 크림색 반점 가슴과 다르다), 굵은 노란 다리의 큰 발톱. 매보다 날개가 길고 몸이 크다.
6번 칸(스킬 폭풍 날갯짓): 두 날개를 아래로 내리쳐 아군 쪽으로 회오리 바람과 번개 섞인 돌풍을 일으킨다.

  python3 scripts/content/monsters/redraw_roc_giant.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import redraw_bird_hawk as H
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle

H.INK = (16, 20, 28)
H.BACK = [(54, 70, 90), (84, 104, 128), (118, 140, 164), (160, 182, 202)]
H.BACK_FAR = [(40, 52, 68), (54, 70, 90), (66, 84, 106), (66, 84, 106)]
H.TIP = (22, 26, 34)
H.BEAK = [(170, 120, 20), (240, 196, 50), (255, 230, 120), (255, 240, 170)]
H.EYE, H.EYE_HI = (250, 200, 40), (20, 14, 10)
BREAST = [(62, 58, 60), (90, 84, 86), (116, 110, 112), (116, 110, 112)]
WHITE_F = [(196, 200, 206), (232, 236, 240), (250, 252, 255), (255, 255, 255)]
STORM = [(150, 190, 220), (210, 236, 250), (255, 255, 255)]
BOLT = (255, 240, 120)
WHITE = (255, 255, 255)

_tail = H.tail


def tail(cv, base, ang, spread):
    pts = [polar(base, ang - 90, 2), polar(base, ang - spread, 11), polar(base, ang, 12), polar(base, ang + spread, 11), polar(base, ang + 90, 2)]
    cv.part(poly(cv.blank(), pts), WHITE_F, ink=H.INK, gloss=False)


def body(cv, c, tilt, talon=0.0, eye="open", beak=0.0, part="all"):
    rot = lambda *pts: [(c[0] + x * math.cos(math.radians(tilt)) - y * math.sin(math.radians(tilt)),
                         c[1] + x * math.sin(math.radians(tilt)) + y * math.cos(math.radians(tilt))) for x, y in pts]
    if part == "head":
        return head(cv, rot, eye, beak)
    hip = rot((-1, 6))[0]
    foot = rot((2 + talon * 9, 13 - talon * 4))[0]
    cv.part(chain([hip, lerp(hip, foot, 0.4)], [4.2, 3.6]), BREAST, ink=H.INK, gloss=False)  # 깃털 바지
    cv.part(chain([lerp(hip, foot, 0.4), foot], [2.6, 2.2]), H.BEAK, ink=H.INK, gloss=False)
    for k in (-50, -10, 30, 160):
        cv.line4([rnd(foot), rnd(polar(foot, 60 - talon * 60 + k, 4))], H.INK)
    trunk = rot((-11, -2), (-4, -7), (6, -6), (10, 0), (6, 8), (-4, 8), (-11, 3))
    cv.part(poly(cv.blank(), trunk), BREAST, ink=H.INK)
    cv.put(poly(cv.blank(), rot((-10, -2), (-4, -6), (4, -5), (-2, -1))), H.BACK[1])
    if part == "trunk":
        return dict(foot=foot)
    return head(cv, rot, eye, beak) | dict(foot=foot)


def head(cv, rot, eye, beak):
    # 흰 머리 + 짙은 눈썹뼈
    h = rot((10, -8))[0]
    cv.part(ellipse(cv.blank(), h, 5.0, 4.4), WHITE_F, ink=H.INK)
    cv.part(poly(cv.blank(), rot((5, -6), (10, -4), (8, -3))), WHITE_F, ink=H.INK, gloss=False)  # 목깃
    b0 = rot((13, -9))[0]
    upper = [b0, rot((18, -9))[0], rot((20, -6))[0], rot((19, -4))[0], rot((17, -5 + beak * 0.3))[0], rot((13, -5))[0]]
    cv.part(poly(cv.blank(), upper), H.BEAK, ink=H.INK, gloss=False)
    if beak:
        cv.part(poly(cv.blank(), [rot((13, -5))[0], rot((17, -4 + beak))[0], rot((13, -3 + beak * 0.5))[0]]), H.BEAK, ink=H.INK, gloss=False)
    e = rnd(rot((11, -9))[0])
    cv.line4([add(e, (-2, -1)), add(e, (1, -1))], BREAST[0])  # 눈썹뼈
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], H.INK)
    else:
        cv.pixel(*e, H.EYE)
        cv.pixel(e[0] + 1, e[1], H.EYE_HI)
    return dict(head=h, beak=rot((20, -6))[0], eye=e)


H.tail, H.body = tail, body


def params(name):
    p = dict(H.BASE, c=(28.0, 34.0))
    if name == "idle_b":
        p.update(c=(28.0, 31.0), wing=130.0, wing_far=110.0, fold=0.1, spread=16.0)
    elif name == "idle_c":
        p.update(c=(28.0, 36.0), wing=-60.0, wing_far=-40.0, spread=24.0, beak=1.0)
    elif name == "windup":
        p.update(c=(25.0, 33.0), tilt=-14.0, wing=-120.0, wing_far=-100.0, tail=150.0, beak=3.0, talon=0.3)
    elif name == "move":
        p.update(c=(34.0, 32.0), tilt=16.0, wing=-150.0, wing_far=-140.0, fold=0.6, tail=185.0, spread=12.0)
    elif name == "attack":
        p.update(c=(32.0, 32.0), tilt=-6.0, wing=-130.0, wing_far=-105.0, tail=160.0, talon=1.0, beak=3.0)
    elif name == "recover":  # 날개를 아래로 내려친 순간
        p.update(c=(26.0, 30.0), tilt=-4.0, wing=115.0, wing_far=95.0, fold=0.0, spread=28.0, beak=3.0)
    elif name == "hit":
        p.update(c=(24.0, 32.0), tilt=-28.0, wing=-160.0, wing_far=-40.0, fold=0.5, tail=140.0, eye="shut", beak=2.0)
    return p


def draw_roc(cv, P):
    c = P["c"]
    sh = add(c, (1, -5))
    H.wing(cv, add(sh, (2, -1)), P["wing_far"], 28, far=True, fold=P["fold"])
    tail(cv, add(c, (-10, 1)), P["tail"] + P["tilt"], P["spread"])
    j = body(cv, c, P["tilt"], P["talon"], P["eye"], P["beak"], part="trunk")
    tip, _ = H.wing(cv, add(sh, (-3, 0)), P["wing"], 31, fold=P["fold"])
    j.update(body(cv, c, P["tilt"], P["talon"], P["eye"], P["beak"], part="head"))
    j["tip"] = tip
    return j


def draw_dead(cv):
    H.wing(cv, (30, 54), 190, 24, far=True, fold=0.3)
    tail(cv, (18, 55), 185, 18)
    cv.part(poly(cv.blank(), [(18, 55), (24, 49), (38, 49), (42, 54), (38, 59), (20, 59)]), BREAST, ink=H.INK)
    cv.part(ellipse(cv.blank(), (46, 54), 4.4, 3.8), WHITE_F, ink=H.INK)
    cv.part(poly(cv.blank(), [(49, 53), (55, 54), (54, 57), (49, 56)]), H.BEAK, ink=H.INK, gloss=False)
    cv.line([(45, 53), (47, 55)], H.INK)
    cv.line([(47, 53), (45, 55)], H.INK)
    H.wing(cv, (32, 52), 12, 22, fold=0.4)


def draw(name):
    cv = Canvas(64, H.INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_roc(cv, P)
    if name == "windup":
        sparkle(cv, add(j["beak"], (1, -5)), WHITE, H.EYE)
    elif name == "move":
        for y in (16, 24, 32):
            cv.line([(2, y), (9, y - 3)], STORM[0])
    elif name == "attack":
        f = j["foot"]
        for dx in (0, 4, 8):
            slash(cv, add(f, (dx - 2, -8)), add(f, (dx + 2, 8)), 2, 2.2, STORM[1], WHITE)
    elif name == "recover":
        # 아래로 내려친 날개 앞에서 회오리 돌풍 + 번개
        for k, r in enumerate((5, 8, 11)):
            cx, cy = 50, 44 - k * 2
            pts = [polar((cx, cy), a, r * (0.6 + a / 900)) for a in range(-200, 160, 30)]
            cv.line(pts, STORM[k % 2], width=1)
        cv.line([(52, 24), (49, 30), (54, 32), (50, 40)], BOLT, width=1)
        for a, b in (((40, 50), (60, 54)), ((42, 56), (61, 58))):
            slash(cv, a, b, 2, 2.0, STORM[0], STORM[2])
        sparkle(cv, (58, 22), WHITE, BOLT, big=True)
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("roc-giant", draw, sys.argv[1:], idle_ms=150)
