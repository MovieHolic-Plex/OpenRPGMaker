#!/usr/bin/env python3
"""부유하는 눈(eye-floating) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

핏줄 선 흰 눈알 한가운데 큰 홍채가 오른쪽(아군)을 노려보고, 두꺼운 눈꺼풀이 위아래를 덮는다.
아래로 촉수 다섯 가닥이 칸마다 물결치며 흔들리고, 공중에 떠 있어 바닥에 그림자만 닿는다.
6번 칸(스킬 skill_mon_eye_beam): 홍채가 보랏빛으로 타오르며 아군 쪽으로 굵은 광선을 쏜다.

  python3 scripts/content/monsters/redraw_eye_floating.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, burst, chain, ellipse, glow, lerp, polar, poly, ring, rnd, run, slash, sparkle

INK = (30, 14, 30)
SCLERA = [(176, 150, 150), (226, 210, 204), (246, 238, 230), (255, 252, 246)]
LID = [(76, 30, 70), (118, 52, 104), (160, 84, 138), (196, 126, 170)]
TENT = [(70, 28, 66), (110, 48, 98), (150, 80, 132), (186, 118, 164)]
TENT_FAR = [(52, 20, 50), (76, 30, 70), (100, 44, 90), (100, 44, 90)]
VEIN = (196, 60, 70)
IRIS = [(120, 20, 30), (200, 50, 40), (250, 130, 50), (255, 220, 120)]
IRIS_MAGIC = [(80, 20, 140), (150, 60, 230), (210, 150, 255), (250, 230, 255)]
PUPIL = (16, 6, 16)
BEAM = [(90, 30, 170), (160, 80, 250), (220, 170, 255), (255, 250, 255)]
SHADOW = (40, 26, 48)
WHITE = (255, 252, 236)


def tentacle(cv, root, phase, length, amp, far=False, droop=90.0):
    """root 에서 droop 방향으로 늘어진 S자 촉수(끝으로 갈수록 가늘다)."""
    pts, ws = [], []
    n = 6
    for i in range(n + 1):
        t = i / n
        ang = droop + amp * math.sin(phase + t * 3.0) * t
        if i == 0:
            p = root
        else:
            p = polar(pts[-1], ang, length / n)
        pts.append(p)
        ws.append(4.0 - 3.0 * t)
    cv.part(chain(pts, ws), TENT_FAR if far else TENT, gloss=False)
    # 빨판 점
    if not far:
        for i in (2, 4):
            cv.pixel(*rnd(add(pts[i], (1, 0))), TENT[3])
    return pts[-1]


def eyeball(cv, c, r, look=(1.0, 0.0), lid_top=0.35, lid_bot=0.2, iris=IRIS, dilate=1.0, squint=False):
    """눈알 + 홍채 + 동공 + 위·아래 눈꺼풀(lid_* = 덮는 비율 0..1)."""
    E = cv.part(ellipse(cv.blank(), c, r, r), SCLERA)
    # 핏줄: 뒤쪽 가장자리에서 안쪽으로 구불구불 들어오는 붉은 선
    for a, bend in ((165, 1), (205, -1), (235, 1), (130, -1)):
        p0 = polar(c, a, r - 0.5)
        p1 = polar(c, a + 10 * bend, r * 0.72)
        p2 = polar(c, a - 6 * bend, r * 0.52)
        cv.line4([p0, p1, p2], VEIN)
    ic = add(c, (look[0] * r * 0.38, look[1] * r * 0.38))
    ir = r * 0.52
    cv.part(ellipse(cv.blank(), ic, ir, ir), iris, ink=INK)
    pr = max(1.0, ir * 0.45 * dilate)
    if squint:
        cv.put(ellipse(cv.blank(), ic, 0.8, pr + 0.6), PUPIL)
    else:
        cv.put(ellipse(cv.blank(), add(ic, (0.5, 0)), pr * 0.6, pr + 0.4), PUPIL)
    cv.pixel(ic[0] - ir * 0.4, ic[1] - ir * 0.45, WHITE)
    cv.pixel(ic[0] - ir * 0.4 + 1, ic[1] - ir * 0.45, iris[3])
    # 눈꺼풀: 원 밖으로 크게 그린 살 덩어리를 눈알 마스크와 겹친 부분만
    for frac, sign in ((lid_top, -1), (lid_bot, 1)):
        if frac <= 0:
            continue
        edge = c[1] + sign * r * (1 - 2 * frac)
        m = np.zeros_like(E)
        yy, xx = np.mgrid[0:cv.S, 0:cv.S]
        # 아래로 볼록한(위 눈꺼풀) / 위로 볼록한(아래 눈꺼풀) 경계
        bow = 2.0 * (1 - ((xx - c[0]) / max(r, 1)) ** 2)
        if sign < 0:
            m = E & (yy <= edge + bow * 0.6)
        else:
            m = E & (yy >= edge - bow * 0.6)
        ring_m = m.copy()
        ring_m[:, 1:] |= m[:, :-1]
        ring_m[:, :-1] |= m[:, 1:]
        ring_m[1:] |= m[:-1]
        ring_m[:-1] |= m[1:]
        ring_m &= E
        cv.part(m | (ring_m & ~m & False), LID, gloss=True)
        # 눈꺼풀 끝 속눈썹 선
        lash = (ring_m & ~m)
        cv.rgb[lash] = INK
    return ic


BASE = dict(c=(30.0, 25.0), r=14.0, look=(1.0, 0.0), top=0.30, bot=0.16, phase=0.0, amp=30.0, droop=100.0,
            iris=IRIS, dilate=1.0, squint=False)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 위로 떠오르며 촉수가 아래로 모인다
        p.update(c=(30.0, 23.0), phase=1.6, amp=24.0, top=0.26)
    elif name == "idle_c":  # 내려오며 촉수가 퍼진다, 눈을 반쯤 감는다
        p.update(c=(30.0, 27.0), phase=3.2, amp=36.0, top=0.38, bot=0.20)
    elif name == "windup":  # 뒤로 물러나며 눈을 부릅떠 동공이 바늘처럼 좁아진다
        p.update(c=(26.0, 25.0), top=0.12, bot=0.06, phase=4.6, amp=40.0, droop=115.0, squint=True, iris=IRIS_MAGIC)
    elif name == "move":  # 촉수를 뒤로 끌며 앞으로 날아든다
        p.update(c=(36.0, 27.0), droop=150.0, amp=18.0, phase=0.8, top=0.22)
    elif name == "attack":  # 몸통박치기: 앞으로 튀어나가며 촉수가 앞으로 휘감는다
        p.update(c=(38.0, 26.0), droop=55.0, amp=34.0, phase=2.4, top=0.18, bot=0.10, dilate=1.4)
    elif name == "recover":  # 스킬 광선: 눈을 활짝 열고 보랏빛 홍채에서 광선을 쏜다
        p.update(c=(26.0, 25.0), top=0.06, bot=0.02, phase=5.4, amp=42.0, droop=120.0, iris=IRIS_MAGIC, dilate=0.6)
    elif name == "hit":  # 맞아서 눈을 질끈 감고 뒤로 기울어 촉수가 앞으로 튄다
        p.update(c=(25.0, 24.0), look=(-0.4, -0.5), top=0.47, bot=0.40, phase=2.0, amp=48.0, droop=70.0, squint=True)
    return p


def draw_eye(cv, P):
    c, r = P["c"], P["r"]
    # 바닥 그림자(떠 있음을 보여 준다, 몸과 떨어진 조각이라 effects 와 같이 마지막 덩어리 검사에서 빠진다)
    roots = [polar(c, a, r - 3) for a in (60, 75, 90, 105, 120)]
    for i, rt in enumerate(roots):
        if i % 2 == 1:
            tentacle(cv, rt, P["phase"] + i * 1.3, 15 + (i % 2) * 2, P["amp"], far=True, droop=P["droop"] + (i - 2) * 6)
    for i, rt in enumerate(roots):
        if i % 2 == 0:
            tentacle(cv, rt, P["phase"] + i * 1.3, 17, P["amp"], droop=P["droop"] + (i - 2) * 7)
    ic = eyeball(cv, c, r, P["look"], P["top"], P["bot"], P["iris"], P["dilate"], P["squint"])
    return dict(iris=ic, c=c)


def draw_dead(cv):
    """눈을 감은 채 바닥에 처져 촉수가 납작하게 퍼진 모습."""
    for i, (x, a) in enumerate(((20, 175), (24, 160), (36, 20), (40, 5))):
        tentacle(cv, (x, 55), i * 1.1, 14, 12, far=i % 2 == 1, droop=a)
    c = (30, 50)
    E = cv.part(ellipse(cv.blank(), c, 11.0, 9.0), LID)
    for x in range(21, 40):
        y = int(round(50 + 2.0 * (1 - ((x - 30) / 10) ** 2)))
        cv.pixel(x, y, INK)
        if x % 3 == 0:
            cv.pixel(x, y + 1, INK)
    cv.line4([(24, 45), (28, 43), (32, 44)], LID[3])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "recover":
        glow(cv, add(P["c"], (P["r"] * 0.3, 0)), P["r"] + 2, [BEAM[0]])
    j = draw_eye(cv, P)
    ic = j["iris"]
    if name == "recover":
        # 굵은 광선: 홍채에서 오른쪽 끝까지, 바깥 → 안쪽 3겹
        x0 = ic[0] + 3
        for w, col in ((7, BEAM[1]), (4, BEAM[2]), (2, BEAM[3])):
            cv.put(poly(cv.blank(), [(x0, ic[1] - w / 2 - 1), (63, ic[1] - w / 2), (63, ic[1] + w / 2), (x0, ic[1] + w / 2 + 1)]), col)
        burst(cv, (x0, ic[1]), 6, BEAM[2], BEAM[3], spikes=8, rot=10)
        for k, r in enumerate((8, 13)):
            ring(cv, (x0 + 6 + k * 9, ic[1]), r * 0.5, -70, 70, BEAM[2], 1)
        sparkle(cv, (54, ic[1] - 10), BEAM[3], BEAM[2], big=True)
        sparkle(cv, (46, ic[1] + 10), BEAM[3], BEAM[2])
    elif name == "windup":
        for a in (-30, 0, 30):
            p0 = polar(ic, a, 6)
            p1 = polar(ic, a, 9)
            cv.line([p0, p1], IRIS_MAGIC[2])
        sparkle(cv, add(ic, (8, -10)), IRIS_MAGIC[3], IRIS_MAGIC[2])
    elif name == "attack":
        slash(cv, add(ic, (6, -14)), add(ic, (10, 14)), 5, 3.4, BEAM[2], WHITE)
        burst(cv, add(ic, (10, 0)), 5, IRIS[2], WHITE, spikes=7, rot=5)
    elif name == "hit":
        c = j["c"]
        for dx, dy in ((15, -10), (17, -7), (16, -13), (18, -4)):
            cv.pixel(c[0] + dx, c[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("eye-floating", draw, sys.argv[1:], idle_ms=200)
