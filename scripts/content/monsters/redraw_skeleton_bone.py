#!/usr/bin/env python3
"""뼈 뱀(skeleton-bone) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

갈라진 뿔 두개골에서 굵은 척추 마디가 S 자로 이어져 바닥을 휘감는 뼈 뱀: 마디마다 양옆으로 휜 늑골 한 쌍,
뒤로 갈수록 가늘어지는 꼬리뼈, 두개골은 길쭉한 뱀 머리에 뒤로 갈라진 뿔 두 갈래, 눈구멍에 녹색 영혼불,
아래턱이 크게 벌어지는 이빨 줄. 몸 대부분이 바닥에 깔리고 앞쪽 목만 세운다.
6번 칸(스킬 뼈 가시 비): 목을 높이 세워 입을 벌리고, 앞쪽 바닥에서 뼈 가시가 줄지어 솟는다.

  python3 scripts/content/monsters/redraw_skeleton_bone.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle

INK = (30, 26, 20)
BONE = [(150, 136, 104), (204, 190, 154), (234, 224, 194), (252, 248, 230)]
BONE_FAR = [(110, 98, 76), (150, 136, 104), (176, 162, 130), (176, 162, 130)]
HOLLOW = (20, 16, 12)
SOUL, SOUL_HI = (90, 230, 120), (220, 255, 220)
DUST = [(110, 100, 84), (156, 146, 124)]
WHITE = (255, 252, 236)


def spine(path, n):
    """베지어 경로들을 이어 n 개 마디 중심으로 고르게 나눈다."""
    pts = []
    for seg in path:
        pts += bezier(*seg, 16)[:-1]
    pts.append(path[-1][2])
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.dist(pts[i - 1], pts[i]))
    out = []
    for k in range(n):
        t = L[-1] * k / (n - 1)
        i = next(i for i in range(1, len(L)) if L[i] >= t - 1e-6)
        f = (t - L[i - 1]) / max(L[i] - L[i - 1], 1e-6)
        out.append(lerp(pts[i - 1], pts[i], f))
    return out


def draw_serpent(cv, path, neck_up=0.0, tilt=0.0, jaw=2, eye="open", n=13):
    joints = spine(path, n)  # joints[0] = 꼬리 끝, joints[-1] = 목
    # 먼 쪽 늑골(위로) → 척추 → 가까운 쪽 늑골(아래로)
    for i in range(3, n - 2):
        p, q = joints[i - 1], joints[i + 1]
        a = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        ln = 3 + 3 * math.sin(math.pi * (i - 2) / (n - 3))
        r1 = polar(joints[i], a - 70, ln)
        cv.line4([rnd(joints[i]), rnd(r1), rnd(polar(r1, a, 1.5))], BONE_FAR[2])
    for i in range(n - 1):
        w = 2.0 + 2.6 * i / (n - 1)
        cv.part(chain([joints[i], joints[i + 1]], [w, w]), BONE, ink=INK, gloss=False)
    for i in range(n):
        w = 2.4 + 2.8 * i / (n - 1)
        cv.part(ellipse(cv.blank(), joints[i], w / 2 + 0.4, w / 2 + 0.4), BONE, ink=INK, gloss=False)
        cv.pixel(*rnd(add(joints[i], (0, -w / 2 + 0.5))), BONE[3])
    for i in range(3, n - 2):
        p, q = joints[i - 1], joints[i + 1]
        a = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        ln = 3 + 3 * math.sin(math.pi * (i - 2) / (n - 3))
        r1 = polar(joints[i], a + 70, ln)
        cv.line4([rnd(joints[i]), rnd(r1), rnd(polar(r1, a, 1.5))], BONE[2])
    # 두개골
    c = add(joints[-1], (3, -2))
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(poly(cv.blank(), [R(-1, 2), R(10, 2 + jaw * 0.5), R(10, 4 + jaw), R(1, 5 + jaw * 0.4)]), BONE, ink=INK, gloss=False)
    for dx in (4, 6, 8):
        cv.pixel(*rnd(R(dx, 2 + jaw * 0.45 * dx / 10 - 1)), BONE[3])
    for k, ramp in ((-1, BONE_FAR), (1, BONE)):  # 갈라진 뿔 두 갈래
        b = R(-2, -3 + k)
        cv.part(chain([b, R(-7, -6 + k * 2), R(-10, -10 + k * 3)], [2.4, 1.8, 1.0]), ramp, ink=INK, gloss=False)
    skull = [R(-4, 1), R(-3, -4), R(2, -5), R(8, -3), R(12, 0), R(11, 2), R(2, 3)]
    cv.part(poly(cv.blank(), skull), BONE, ink=INK)
    e = rnd(R(3, -2))
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), HOLLOW)
    if eye != "shut":
        cv.pixel(*e, SOUL)
        cv.pixel(e[0] + 1, e[1] - 1, SOUL_HI)
    cv.pixel(*rnd(R(11, 0)), HOLLOW)
    for dx in (5, 7, 9):
        cv.pixel(*rnd(R(dx, 2)), HOLLOW)
    return dict(mouth=R(11, 3 + jaw * 0.5), eye=R(3, -2), tail=joints[0])


def coil(head, hx=0, sway=0.0):
    """꼬리 끝(왼쪽 바닥) → 바닥 S 고리 → 세운 목(head)."""
    return [((6 + sway, 56), (12, 50 + sway), (20, 54)),
            ((20, 54), (30, 60), (38, 54)),
            ((38, 54), (44 + hx * 0.3, 48), head)]


POSES = dict(
    idle_a=dict(head=(40, 34), tilt=0, jaw=2, sway=0),
    idle_b=dict(head=(41, 32), tilt=-6, jaw=3, sway=1.5),
    idle_c=dict(head=(39, 36), tilt=8, jaw=1, sway=-1.5),
    windup=dict(head=(33, 28), tilt=-24, jaw=5, sway=2, hx=-6),
    move=dict(head=(44, 40), tilt=10, jaw=3, sway=3, hx=6, shift=3),
    attack=dict(head=(43, 38), tilt=22, jaw=7, sway=-2, hx=6, shift=2),
    recover=dict(head=(38, 24), tilt=-30, jaw=8, sway=1, hx=-2),
    hit=dict(head=(32, 36), tilt=-34, jaw=4, sway=-3, hx=-6, eye="shut"),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 흩어진 척추 마디 줄 + 떨어진 두개골
        draw_serpent(cv, [((6, 58), (20, 56), (32, 58)), ((32, 58), (38, 59), (42, 57))], tilt=10, jaw=4, eye="shut", n=10)
        cv.part(poly(cv.blank(), [(48, 55), (54, 54), (58, 57), (48, 59)]), BONE, ink=INK, gloss=False)
        cv.line([(46, 51), (48, 53)], HOLLOW)
        return cv.image()
    P = dict(POSES[name])
    shift = P.pop("shift", 0)
    path = coil(P.pop("head"), P.pop("hx", 0), P.pop("sway"))
    if shift:
        path = [tuple(add(p, (shift, 0)) for p in seg) for seg in path]
    j = draw_serpent(cv, path, **P)
    m = j["mouth"]
    if name == "attack":
        burst(cv, add(m, (1, 1)), 4.0, BONE[2], WHITE, spikes=7)
    elif name == "recover":
        # 앞 바닥에서 줄지어 솟는 뼈 가시(바닥 금으로 이어진다) + 입 앞 영혼불
        cv.line4([(40, 59), (62, 59)], BONE[0])
        for k, x in enumerate((44, 50, 56, 61)):
            h = 6 + k * 3
            cv.part(poly(cv.blank(), [(x - 2, 59), (x, 59 - h), (x + 1, 59 - h + 1), (x + 2, 59)]), BONE, ink=INK, gloss=False)
        sparkle(cv, add(m, (3, -3)), SOUL_HI, SOUL, big=True)
    elif name == "windup":
        sparkle(cv, add(j["eye"], (2, -6)), SOUL_HI, SOUL)
    elif name == "move":
        puff(cv, add(j["tail"], (-1, 1)), 2.2, DUST)
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((5, -6), (7, -3), (3, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("skeleton-bone", draw, sys.argv[1:], idle_ms=210)
