#!/usr/bin/env python3
"""어둠의 정령(spirit-dark) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

먹보라 그림자 몸: 뒤로 크게 휜 초승달 볏을 인 머리에 노란 눈 둘, 넓은 어깨에서 갈라진 여섯 그림자 팔
(앞 둘은 굵고 갈고리 손톱, 뒤 넷은 점점 짙고 가늘게), 가슴 한가운데 세로로 벌어진 보랏빛 틈,
아래로 너덜너덜 갈라지며 흩어지는 연기 꼬리로 떠 있다. 오른쪽(아군)을 본다.
6번 칸(스킬, 암흑 cast): 여섯 팔을 부채처럼 펼치고 가슴 틈이 열리며 아군 쪽으로 검보라 구체 셋을 쏜다.

  python3 scripts/content/monsters/redraw_spirit_dark.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from elemental_rig import EPose, body_field, chain, ellipse, grid, head_mask, m, paint, skeleton, tail_mask, tongue, torso_mask
from pixel_lib import Canvas, add, polar, rnd, run, sparkle

INK = (14, 8, 22)
BODY = [(40, 26, 56), (62, 40, 84), (88, 60, 116), (122, 90, 152), (160, 130, 190)]
DEEP = [(30, 20, 44), (46, 30, 66), (64, 44, 90)]
RIFT = [(150, 50, 200), (210, 110, 250), (255, 220, 255)]
EYE, EYE2 = (255, 230, 60), (255, 160, 30)

def smoke(seed):
    x, y = grid()
    return np.where(np.sin(x * 0.7 + y * 0.5 + seed * 1.7) + np.sin(y * 1.1 - x * 0.35) > 1.5, 0.9, 0.0)


def arms(P, j):
    """(어깨, 팔꿈치, 손) 여섯: 0..1 앞 굵은 팔, 2..5 뒤 팔. 각도는 P.extra['fan'] 로 펼침."""
    k = j["k"]
    fan = P.extra.get("fan", 1.0)
    base_n, base_f = P.arm_n, P.arm_f
    out = []
    for i in range(6):
        near = i % 2 == 0
        tier = i // 2  # 0 위 · 1 가운데 · 2 아래
        sh = j["R"]((5 if near else -3) * k, (-7 + tier * 3.5) * k)
        a0, a1 = base_n if near else base_f
        da = (tier - 1) * 28 * fan * (1 if near else -1)
        ln = (8 - tier * 0.6) * k
        el = polar(sh, a0 + da, ln)
        hd = polar(el, a1 + da * 1.2, (7 - tier * 0.5) * k)
        out.append((sh, el, hd, near, tier))
    return out


def claw(cv, el, hd, k, w=1.8):
    a = math.degrees(math.atan2(hd[1] - el[1], hd[0] - el[0]))
    M = np.zeros((64, 64), bool)
    for da in (-35, 10):
        M |= m(cv, tongue(cv, hd, a + da, 4.0 * k, w * k, curl=1.6))
    return M


def crest(cv, j, lift=0.0):
    """머리 뒤로 휜 초승달 볏."""
    h, k = j["head"], j["k"]
    a = add(h, (1 * k, -4 * k))
    pts = [polar(add(h, (-5 * k, 0)), -40 - i * 22 + lift, (9 + i * 0.6) * k) for i in range(7)]
    pts = [a] + pts
    ws = [4.6, 4.2, 3.6, 3.0, 2.4, 1.8, 1.2, 0.6]
    return m(cv, chain(pts, [w * k for w in ws]))


def figure(cv, P: EPose, eyes="open", rift=1.0, mouth=0):
    j = skeleton(P)
    k = j["k"]
    A = arms(P, j)
    tail = tail_mask(cv, j, (8.6, 7.4, 5.0, 3.0, 1.2))
    for i, dy in enumerate((3, 7)):  # 갈라진 연기 가닥
        tail |= m(cv, tongue(cv, add(j["hip"], (-2, 9 * k + dy)), 120 + i * 30, 7 * k, 3.0 * k, curl=1.5))
    body = tail | torso_mask(cv, j) | head_mask(cv, j)
    cr = crest(cv, j, P.extra.get("crest", 0.0))
    # 뒤 팔(먼 쪽, 아래부터 위로) -> 볏 -> 몸 -> 앞 팔
    for sh, el, hd, near, tier in sorted([a for a in A if not a[3]], key=lambda a: -a[4]):
        M = m(cv, chain([sh, el, hd], [3.2 * k, 2.6 * k, 2.0 * k])) | claw(cv, el, hd, k, 1.4)
        paint(cv, M, DEEP, body_field(M, base=0.0, dstep=0.4, ref=body), INK)
    paint(cv, cr, BODY, body_field(cr, base=0.4, dstep=0.6, ref=body), INK, rim=BODY[4])
    paint(cv, body, BODY, body_field(body, base=0.4, dstep=0.5, ref=body, extra=smoke(P.seed)), INK, rim=BODY[3])
    # 가슴 틈
    c = j["R"](1 * k, -1 * k)
    w = 1.2 + rift * 1.0
    gap = m(cv, ellipse(cv.blank(), c, w, 4.6 * k))
    cv.put(gap, RIFT[0])
    cv.put(m(cv, ellipse(cv.blank(), c, max(0.6, w - 1), 3.2 * k)), RIFT[1])
    cv.pixel(*rnd(c), RIFT[2])
    for sh, el, hd, near, tier in sorted([a for a in A if a[3]], key=lambda a: -a[4]):
        M = m(cv, chain([sh, el, hd], [(4.2 - tier * 0.6) * k, (3.4 - tier * 0.5) * k, (2.6 - tier * 0.4) * k])) | claw(cv, el, hd, k)
        paint(cv, M, BODY if tier == 0 else BODY[:4], body_field(M, base=1.3 - tier * 0.4, ref=body), INK, rim=BODY[4] if tier == 0 else None)
    # 얼굴: 노란 눈(가까운 눈 2칸, 먼 눈 1칸) + 찢어진 입
    h = j["head"]
    for ex, wd in ((3.4, 2), (0.3, 1)):
        e = rnd(add(h, (ex * k, 0)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (wd - 1, 1))], EYE2)
            continue
        for dx in range(wd):
            cv.pixel(e[0] + dx, e[1], EYE)
        cv.pixel(e[0] - 1, e[1] + (0 if eyes != "angry" else -1), EYE2)
    mo = rnd(add(h, (4.0 * k, 3.4 * k)))
    if mouth:
        cv.put(m(cv, ellipse(cv.blank(), mo, 1.6, mouth * 0.6)), INK)
        cv.pixel(mo[0], mo[1], RIFT[0])
    else:
        cv.line([add(mo, (-2, 0)), add(mo, (1, -1))], INK)
    j["arms"] = A
    return j


POSES = dict(
    idle_a=(EPose(c=(31, 31), arm_n=(55, 5), arm_f=(125, 80), seed=0, extra=dict(fan=1.0)), "open", 1.0, 0),
    idle_b=(EPose(c=(31, 29), arm_n=(48, -5), arm_f=(118, 70), seed=1, lean=-3, tail=2, extra=dict(fan=1.15, crest=-6)), "open", 1.4, 0),
    idle_c=(EPose(c=(31, 30), arm_n=(62, 15), arm_f=(132, 90), seed=2, lean=3, tail=-2, extra=dict(fan=0.9, crest=4)), "open", 1.0, 1),
    windup=(EPose(c=(28, 33), lean=-12, arm_n=(-80, -40), arm_f=(-110, -140), seed=3, tail=4, extra=dict(fan=1.3, crest=-10)), "angry", 2.0, 2),
    move=(EPose(c=(35, 31), lean=20, arm_n=(150, 170), arm_f=(160, 185), seed=4, tail=6, extra=dict(fan=0.6, crest=12)), "angry", 1.0, 0),
    attack=(EPose(c=(36, 31), lean=16, arm_n=(0, -10), arm_f=(150, 175), seed=5, tail=3, extra=dict(fan=0.8, crest=8)), "angry", 1.5, 2),
    recover=(EPose(c=(27, 31), lean=-6, k=1.05, arm_n=(-20, -5), arm_f=(-160, -175), seed=6, tail=2, extra=dict(fan=1.6, crest=-12)), "angry", 3.0, 3),
    hit=(EPose(c=(26, 33), lean=-22, k=0.95, arm_n=(110, 150), arm_f=(70, 110), seed=7, tail=-4, extra=dict(fan=0.7, crest=14)), "shut", 0.5, 2),
)


def orb(cv, c, r):
    cv.put(m(cv, ellipse(cv.blank(), c, r + 1, r + 1)), INK)
    cv.put(m(cv, ellipse(cv.blank(), c, r, r)), RIFT[0])
    cv.put(m(cv, ellipse(cv.blank(), add(c, (0.5, -0.5)), r * 0.55, r * 0.55)), RIFT[1])
    cv.pixel(*rnd(add(c, (0.5, -0.5))), RIFT[2])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        # 바닥에 고인 그림자 웅덩이 + 꺼져 가는 노란 눈, 위로 흩어지는 연기
        M = m(cv, ellipse(cv.blank(), (32, 57), 13, 2.2)) | m(cv, ellipse(cv.blank(), (28, 55), 6, 3.0))
        M |= m(cv, crest_flat(cv))
        paint(cv, M, BODY[:4], body_field(M, base=0.3, extra=smoke(8)), INK, rim=BODY[3])
        cv.line([(30, 55), (31, 55)], EYE2)
        cv.pixel(34, 55, EYE2)
        for x, y in ((22, 49), (36, 47), (42, 51)):
            cv.put(m(cv, ellipse(cv.blank(), (x, y), 1.4, 1.2)), DEEP[2])
        return cv.image()
    P, eyes, rift, mouth = POSES[name]
    j = figure(cv, P, eyes, rift, mouth)
    if name == "windup":
        orb(cv, add(j["head"], (2, -10)), 2.4)
    elif name == "move":
        for y, x0 in ((24, 3), (33, 2), (43, 4)):
            cv.line([(x0, y), (x0 + 7, y)], DEEP[2])
    elif name == "attack":
        hd = j["arms"][0][2]
        for d, r in (((5, 0), 3.0), ((10, -3), 1.2), ((9, 4), 1.0)):
            orb(cv, add(hd, d), r)
    elif name == "recover":
        for c, r in (((50, 18), 2.6), ((56, 32), 3.4), ((50, 46), 2.6)):
            orb(cv, c, r)
        for a, b in (((40, 22), (46, 19)), ((44, 32), (50, 32)), ((40, 42), (46, 45))):
            cv.line([a, b], RIFT[0])
        sparkle(cv, j["R"](1, -1), RIFT[2], RIFT[1], big=True)
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((8, -3), (10, 1), (9, 5)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), (255, 255, 255))
        for a, b in (((46, 28), (52, 25)), ((47, 38), (54, 38))):
            cv.line([a, b], BODY[3])
    return cv.image()


def crest_flat(cv):
    from pixel_lib import poly
    return poly(cv.blank(), [(36, 56), (42, 50), (48, 49), (44, 52), (40, 57)])


if __name__ == "__main__":
    run("spirit-dark", draw, sys.argv[1:], idle_ms=200)
