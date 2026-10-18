#!/usr/bin/env python3
"""땅의 정령(spirit-earth) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

떠 있는 이끼 암석 정령: 모난 큰 바위 가슴에 금빛으로 빛나는 갈라진 틈(심장), 그 위 돌 얼굴 바위(호박색 눈·굳은 입),
양 어깨에서 굵은 뿌리 덩굴로 이어진 바위 주먹 둘, 몸 아래로 뿌리에 매달려 떠 있는 작은 돌 셋.
바위 윗면엔 이끼가 덮이고, 면마다 빛 쪽(오른쪽 위)이 밝은 각진 명암. 오른쪽(아군)을 본다.
6번 칸(스킬 skill_mon_quake_stomp): 두 바위 주먹을 땅에 내리꽂아 아군 쪽 바닥으로 금빛 균열과 솟는 바위 가시가 달린다.

  python3 scripts/content/monsters/redraw_spirit_earth.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import EPose, body_field, ellipse, grid, m, paint, poly, skeleton, top_edge
from pixel_lib import Canvas, add, bezier, burst, chain, lerp, polar, rnd, run, sparkle

INK = (28, 24, 22)
ROCK = [(70, 66, 62), (102, 96, 86), (136, 128, 112), (172, 164, 142), (206, 198, 176)]
MOSS = [(56, 92, 44), (86, 128, 56), (130, 168, 72)]
ROOT = [(70, 50, 34), (104, 76, 48), (140, 106, 66)]
GLOW = [(210, 140, 40), (252, 204, 80), (255, 246, 196)]
EYE = (255, 222, 110)


def rock(cv, c, r, rot, seed, squash=1.0):
    """각진 바위 마스크(꼭짓점 7개, 반지름이 조금씩 다름)."""
    pts = []
    for i in range(7):
        a = rot + i * 360 / 7
        rr = r * (0.8 + 0.25 * math.sin(seed * 3.1 + i * 1.9))
        p = polar((0, 0), a, rr)
        pts.append(add(c, (p[0], p[1] * squash)))
    return m(cv, poly(cv.blank(), pts))


def facets(M, seed):
    """면 나눔: 바위 안을 비스듬한 선 둘로 나눠 면마다 밝기 차이(각진 돌)."""
    x, y = grid()
    ys, xs = np.nonzero(M)
    if not len(xs):
        return 0
    cx, cy = xs.mean(), ys.mean()
    f = np.where((x - cx) * 0.8 + (y - cy) * -0.6 + math.sin(seed) * 1.5 > 0, 0.7, 0.0)
    f += np.where((x - cx) * -0.3 + (y - cy) * 1.0 > 2.5, -0.8, 0.0)
    return f


def stone(cv, M, seed, ref, moss=True, base=0.6):
    paint(cv, M, ROCK, body_field(M, base=base, dstep=0.35, tilt=1.4, ref=ref, extra=facets(M, seed)), INK)
    if moss:
        cap = top_edge(M)
        cap2 = np.zeros_like(cap)
        cap2[1:] = cap[:-1] & M[1:]
        x, _ = grid()
        cv.put(cap, MOSS[2])
        cv.put(cap2 & (np.sin(x * 1.3 + seed) > -0.3), MOSS[1])


def vine(cv, a, b, bow, w=2.4):
    mid = lerp(a, b, 0.5)
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    c = (mid[0] - dy / n * bow, mid[1] + dx / n * bow)
    pts = bezier(a, c, b, 6)
    return m(cv, chain(pts, [w] * len(pts)))


def figure(cv, P: EPose, eyes="open", crack=1.0, fists=None):
    j = skeleton(P)
    k, R = j["k"], j["R"]
    chest_c = R(0, 0)
    head_c = R(3 * k, -14 * k)
    fist_n = fists[0] if fists else j["hand_n"]
    fist_f = fists[1] if fists else j["hand_f"]
    pebbles = [R(-4 * k, 13 * k), R(2 * k, 18 * k), R(-1 * k, 23 * k)]
    chest = rock(cv, chest_c, 10.5 * k, -10 + P.lean, 1, squash=0.92)
    head = rock(cv, head_c, 6.6 * k, 20 + P.lean, 4)
    sh_n, sh_f = R(7 * k, -4 * k), R(-6 * k, -5 * k)
    # 뿌리 덩굴(어깨 -> 주먹, 가슴 -> 작은 돌, 머리 -> 가슴)
    roots_back = vine(cv, sh_f, fist_f, -3, 2.6)
    roots = vine(cv, sh_n, fist_n, 3, 2.8)
    hang = vine(cv, R(-1 * k, 7 * k), pebbles[0], 2, 2.2) | vine(cv, pebbles[0], pebbles[1], -2, 1.8) | vine(cv, pebbles[1], pebbles[2], 2, 1.4)
    neck = vine(cv, R(1 * k, -8 * k), head_c, 1, 3.0)
    ref = chest | head
    rf = rock(cv, fist_f, 4.6 * k, 30, 7)
    paint(cv, roots_back, ROOT[:2], body_field(roots_back, base=0.0, ref=ref), INK)
    stone(cv, rf, 7, ref, base=0.0)
    paint(cv, hang, ROOT, body_field(hang, base=0.6, ref=ref), INK)
    for i, p in enumerate(pebbles):
        stone(cv, rock(cv, p, (3.4 - i * 0.7) * k, i * 40, 10 + i), 10 + i, ref, moss=i == 0)
    paint(cv, neck, ROOT, body_field(neck, base=0.6, ref=ref), INK)
    stone(cv, chest, 1, ref)
    stone(cv, head, 4, ref)
    # 가슴 금빛 틈(심장): 지그재그 균열 + 가운데 빛
    if crack > 0:
        cc = R(1 * k, 1 * k)
        zig = [R(-3 * k, -5 * k), R(0, -2 * k), R(-1 * k, 1 * k), R(2 * k, 3 * k), R(1 * k, 6 * k)]
        cv.line(zig, GLOW[0], 2 if crack > 1 else 1)
        cv.line(zig[1:4], GLOW[1])
        cv.pixel(*rnd(cc), GLOW[2])
        if crack > 1:
            sparkle(cv, cc, GLOW[2], GLOW[1])
    # 얼굴: 짙은 눈두덩 + 빛나는 눈 + 굳은 입
    h = head_c
    for ex in (3.0 * k, -0.2 * k):
        e = rnd(add(h, (ex, -0.5 * k)))
        cv.line([add(e, (-1, -1)), add(e, (1, -1 if eyes != "angry" else 0))], INK)
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (0, 0))], INK)
        else:
            cv.pixel(e[0], e[1], EYE)
            cv.pixel(e[0] - 1, e[1], EYE if ex > 0 else GLOW[0])
    mo = rnd(add(h, (2.6 * k, 3.2 * k)))
    cv.line([add(mo, (-2, 0)), add(mo, (1, 0))] if eyes != "angry" else [add(mo, (-2, 0)), add(mo, (0, 1)), add(mo, (2, 0))], INK)
    # 앞 덩굴 + 앞 주먹(가장 앞)
    paint(cv, roots, ROOT, body_field(roots, base=0.8, ref=ref), INK)
    stone(cv, rock(cv, fist_n, 5.2 * k, 10, 9), 9, ref, base=0.9)
    j.update(head_c=head_c, fist_n=fist_n, fist_f=fist_f, chest_c=chest_c)
    return j


POSES = dict(
    idle_a=(EPose(c=(29, 28), arm_n=(55, 10), arm_f=(120, 80), seed=0), "open", 1, None),
    idle_b=(EPose(c=(29, 26), arm_n=(48, 2), arm_f=(115, 72), seed=1, lean=-2), "open", 1, None),
    idle_c=(EPose(c=(29, 27), arm_n=(62, 18), arm_f=(125, 88), seed=2, lean=2), "open", 1.5, None),
    windup=(EPose(c=(27, 29), lean=-10, k=1.04, seed=3), "angry", 2, ((36, 6), (18, 8))),
    move=(EPose(c=(34, 28), lean=14, seed=4), "angry", 1, ((48, 30), (20, 38))),
    attack=(EPose(c=(36, 27), lean=12, seed=5), "angry", 2, ((55, 26), (26, 40))),
    recover=(EPose(c=(26, 25), lean=8, k=1.04, seed=6), "angry", 2, ((42, 50), (14, 50))),
    hit=(EPose(c=(24, 29), lean=-18, k=0.96, seed=7), "shut", 0.5, ((18, 18), (12, 36))),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 무너진 돌무더기: 바닥에 흩어진 바위·뿌리, 얼굴 바위는 옆으로 누워 눈빛이 꺼짐
        ref = np.zeros((64, 64), bool)
        parts = [((24, 55), 6.5, 0.7, 1), ((34, 56), 5.0, 0.7, 2), ((42, 56), 3.6, 0.8, 3), ((17, 57), 2.6, 0.9, 5)]
        root = vine(cv, (14, 58), (46, 57), 2, 1.6)
        paint(cv, root, ROOT, body_field(root, base=0.5), INK)
        for c, r, sq, s in parts:
            M = rock(cv, c, r, s * 25, s, squash=sq)
            ref |= M
            stone(cv, M, s, ref)
        h = rock(cv, (33, 51), 4.6, 80, 4)
        stone(cv, h, 4, h)
        cv.line([(31, 51), (33, 51)], INK)
        cv.line([(35, 51), (36, 51)], INK)
        return cv.image()
    P, eyes, crack, fists = POSES[name]
    j = figure(cv, P, eyes, crack, fists)
    if name == "windup":
        for p in (j["fist_n"], j["fist_f"]):
            for d in ((-4, -3), (4, -2)):
                cv.pixel(*rnd(add(p, d)), ROCK[3])
    elif name == "move":
        for y, x0 in ((22, 3), (32, 2), (42, 4)):
            cv.line([(x0, y), (x0 + 6, y)], ROCK[2])
        for p in ((8, 50), (12, 54)):
            cv.pixel(*p, ROCK[1])
    elif name == "attack":
        burst(cv, add(j["fist_n"], (5, 0)), 5.5, GLOW[1], GLOW[2], spikes=6)
        for d in ((3, -6), (6, 5), (-1, 7)):
            cv.pixel(*rnd(add(j["fist_n"], d)), ROCK[3])
    elif name == "recover":
        # 대지 강타: 주먹이 내리꽂힌 바닥에서 아군 쪽으로 달리는 금빛 균열 + 솟는 바위 가시
        crack = [(42, 58), (46, 57), (49, 58), (53, 57), (57, 58), (61, 57)]
        cv.line(crack, GLOW[0], 2)
        cv.line(crack, GLOW[1])
        for x, h in ((49, 9), (55, 13), (60, 8)):
            M = m(cv, poly(cv.blank(), [(x - 3, 58), (x - 0.5, 58 - h), (x + 1, 58 - h + 2), (x + 3, 58)]))
            paint(cv, M, ROCK, body_field(M, base=0.8, dstep=0.4, tilt=1.6), INK)
        for p in ((47, 46), (53, 40), (59, 43), (45, 52)):
            cv.pixel(*p, ROCK[3])
        sparkle(cv, (42, 54), GLOW[2], GLOW[1], big=True)
    elif name == "hit":
        h = j["head_c"]
        for dx, dy in ((8, -3), (10, 1), (9, 5)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), (255, 255, 255))
        for p in ((44, 22), (47, 30), (44, 36)):
            cv.pixel(*p, ROCK[2])
    return cv.image()


if __name__ == "__main__":
    run("spirit-earth", draw, sys.argv[1:], idle_ms=260)
