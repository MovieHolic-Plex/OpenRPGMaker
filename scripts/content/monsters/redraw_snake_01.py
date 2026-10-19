#!/usr/bin/env python3
"""초록색 코브라(snake-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

독사(snake-viper)의 낮은 똬리·삼각 머리와 다르게, 코브라는 땅 위 두 겹 똬리에서 몸을 높이 곧추세우고
목 뒤로 넓은 후드(뒷면에 밝은 안경 무늬)를 펼친다. 청록 비늘에 앞쪽 황갈색 배 비늘 띠, 작고 둥근 머리,
머리 안의 호박색 눈(세로 동공), 갈라진 붉은 혀.
6번 칸(스킬 독 뿜기): 후드를 최대로 펼치고 고개를 숙여 입에서 초록 독액 줄기를 아군 쪽으로 뿜는다.

  python3 scripts/content/monsters/redraw_snake_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle

INK = (16, 30, 28)
SCALE = [(40, 84, 76), (64, 122, 106), (98, 160, 134), (150, 202, 168)]
SCALE_FAR = [(30, 62, 58), (40, 84, 76), (52, 102, 92), (52, 102, 92)]
BELLY = [(150, 118, 66), (196, 164, 98), (228, 204, 142), (244, 228, 180)]
HOOD_MARK = (236, 222, 170)
EYE, PUPIL = (244, 196, 60), (20, 16, 10)
TONGUE = (210, 50, 60)
FANG = (250, 248, 236)
MOUTH = (120, 30, 40)
VENOM = [(70, 150, 40), (140, 214, 70), (220, 255, 150)]
DUST = [(84, 92, 76), (130, 136, 112)]
WHITE = (250, 250, 236)
GROUND = 60


def coil(cv, x0, x1, y, h, ramp):
    """똬리 한 겹: 옆으로 누운 굵은 몸통 고리(양끝이 둥글게 말려 드는 납작 타원) + 위쪽 빛 줄."""
    c = ((x0 + x1) / 2, y)
    rx = (x1 - x0) / 2
    M = cv.part(ellipse(cv.blank(), c, rx, h / 2), ramp)
    cv.line4([(c[0] - rx * 0.55, y - h / 2 + 1), (c[0] + rx * 0.3, y - h / 2 + 1)], ramp[3])
    for x in range(int(x0 + 4), int(x1 - 3), 4):  # 배 비늘 마디(아래 가장자리)
        cv.pixel(x, int(y + h / 2 - 1), BELLY[1])
    return M


def neck_pts(base, ctrl, top, n=10):
    return bezier(base, ctrl, top, n)


def normal(pts, i):
    a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
    dx, dy = b[0] - a[0], b[1] - a[1]
    m = math.hypot(dx, dy) or 1
    return (dy / m, -dx / m)  # 위로 오르는 몸에서 왼쪽(등) 방향


def hood(cv, pts, flare):
    """머리 바로 아래 목 위쪽 45% 에 등 쪽으로 넓게 펼친 후드 + 안경 무늬."""
    if flare <= 0:
        return
    n = len(pts)
    seg = list(range(int(n * 0.4), n))
    back, front = [], []
    for k, i in enumerate(seg):
        s = (k + 0.5) / len(seg)
        nx, ny = normal(pts, i)
        wb = 2.5 + flare * 5.5 * math.sin(math.pi * min(0.999, 0.15 + s * 0.85))
        wf = 2.5 + flare * 4.0 * math.sin(math.pi * min(0.999, 0.15 + s * 0.85))
        back.append((pts[i][0] + nx * wb, pts[i][1] + ny * wb))
        front.append((pts[i][0] - nx * wf, pts[i][1] - ny * wf))
    cv.part(poly(cv.blank(), back + front[::-1]), SCALE, gloss=False)
    mid = seg[len(seg) // 2]
    nx, ny = normal(pts, mid)
    m = (pts[mid][0] + nx * (2 + flare * 3.2), pts[mid][1] + ny * (2 + flare * 3.2))
    cv.put(ellipse(cv.blank(), m, 1.6, 1.6), HOOD_MARK)
    cv.pixel(*rnd(m), SCALE[0])


def neck(cv, pts):
    widths = [6.0 - 2.0 * i / (len(pts) - 1) for i in range(len(pts))]
    cv.part(chain(pts, widths), SCALE)
    # 앞쪽(배) 황갈색 비늘 띠 + 가로 마디
    for i in range(1, len(pts) - 1):
        nx, ny = normal(pts, i)
        w = widths[i] / 2 - 1.0
        p = (pts[i][0] - nx * w, pts[i][1] - ny * w)
        cv.put(ellipse(cv.blank(), p, 1.0, 1.0), BELLY[2])
        if i % 2 == 0:
            cv.pixel(*rnd(p), BELLY[0])


def head(cv, c, tilt, mouth=0.0, eye="open", tongue=False):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    if mouth > 0:
        cv.put(poly(cv.blank(), [R(-1, 0), R(6, 0), R(6, 1 + mouth), R(-1, 1)]), MOUTH)
        jaw = [R(-2, 1), R(5, 1 + mouth * 1.1), R(6, 2.5 + mouth * 1.2), R(-2, 3)]
        cv.part(poly(cv.blank(), jaw), BELLY, gloss=False)
        for dx in (4.5,):
            f = R(dx, 0)
            cv.line([rnd(f), rnd(add(f, (0, 2)))], FANG)
    if tongue:
        t0 = R(7, 1)
        cv.line4([rnd(t0), rnd(R(10, 1.5))], TONGUE)
        cv.line4([rnd(R(10, 1.5)), rnd(R(12, 0))], TONGUE)
        cv.line4([rnd(R(10, 1.5)), rnd(R(12, 3))], TONGUE)
    skull = [R(-4, 1), R(-4, -2), R(-1, -4), R(3, -4), R(6, -2.5), R(7.5, -0.5), R(7, 1), R(2, 1.5)] if mouth > 0 else \
        [R(-4, 2), R(-4, -2), R(-1, -4), R(3, -4), R(6, -2.5), R(7.5, -0.5), R(7, 2), R(3, 3), R(-1, 3)]
    cv.part(poly(cv.blank(), skull), SCALE)
    cv.line4([rnd(R(-1, -3)), rnd(R(4, -3))], SCALE[3])
    e = rnd(R(2, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(*e, PUPIL)
        cv.pixel(e[0], e[1] - 1, PUPIL)
    cv.pixel(*rnd(R(6.5, -1.5)), INK)  # 콧구멍
    return dict(mouth=R(7, 1), eye=e)


POSES = {
    #        base       ctrl        top(목 끝)   머리 중심    기울기 후드 입  눈     혀
    "idle_a": ((33, 47), (41, 38), (38, 25), (42, 20), 0, 1.0, 0, "open", False),
    "idle_b": ((33, 47), (42, 39), (37, 26), (41, 21), 4, 0.9, 0, "open", True),
    "idle_c": ((33, 47), (40, 37), (39, 24), (43, 19), -4, 1.0, 0, "open", False),
    "windup": ((32, 47), (43, 40), (32, 22), (35, 16), -18, 1.25, 2, "open", False),
    "attack": ((33, 48), (41, 44), (49, 34), (54, 31), 16, 0.5, 4, "open", False),
    "recover": ((33, 47), (43, 38), (40, 25), (45, 21), 22, 1.35, 3, "open", False),
    "hit": ((32, 48), (36, 42), (29, 28), (27, 23), -30, 0.3, 1, "shut", False),
}


def draw_coils(cv, shift=0):
    # 꼬리 끝(뒤로 가늘게) → 아래 똬리 → 가운데 → 위 똬리(작아지며 쌓인다)
    cv.part(chain([(12 + shift, 57), (7 + shift, 58), (3 + shift, 56)], [4, 3, 1.6]), SCALE_FAR, gloss=False)
    coil(cv, 8 + shift, 44 + shift, 55.5, 7, SCALE_FAR)
    coil(cv, 12 + shift, 40 + shift, 50, 6.5, SCALE)
    coil(cv, 18 + shift, 36 + shift, 45.5, 5.5, SCALE)


def draw_pose(cv, name):
    base, ctrl, top, hc, tilt, fl, mouth, eye, tongue = POSES[name]
    draw_coils(cv)
    pts = neck_pts(base, ctrl, top)
    hood(cv, pts, fl)
    neck(cv, pts)
    return head(cv, hc, tilt, mouth, eye, tongue)


def draw_move(cv):
    """몸을 낮추고 S 자로 땅을 미끄러져 나간다(후드 접음)."""
    pts = bezier((4, 57), (16, 50), (26, 57), 6)[:-1] + bezier((26, 57), (36, 63), (44, 50), 6)
    widths = [1.6, 3, 4, 5, 5.5, 6] + [6.0] * 4 + [5.5, 5, 4.6]
    cv.part(chain(pts, widths[:len(pts)]), SCALE)
    for i in range(2, len(pts) - 1, 2):
        cv.pixel(*rnd(add(pts[i], (0, 1.5))), BELLY[2])
    j = head(cv, (49, 47), -8, 0, "open", True)
    puff(cv, (12, 58), 2.2, DUST)
    for y in (46, 51):
        cv.line([(2, y), (8, y)], SCALE[2])
    return j


def draw_dead(cv):
    pts = bezier((6, 58), (24, 52), (40, 58), 10) + [(46, 57)]
    cv.part(chain(pts, [2, 3.5, 4.5, 5, 5, 5, 5, 5, 5, 5, 4.5, 4.5]), SCALE, gloss=False)
    for i in range(1, len(pts) - 1, 2):
        cv.pixel(*rnd(add(pts[i], (0, 1.5))), BELLY[1])
    a = (49, 56)
    cv.part(poly(cv.blank(), [(45, 58), (45, 54), (49, 52), (54, 54), (56, 57), (52, 59)]), SCALE)
    cv.line([(48, 54), (50, 56)], INK)
    cv.line([(50, 54), (48, 56)], INK)
    cv.line4([(56, 57), (59, 58)], TONGUE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "move":
        draw_move(cv)
        return cv.image()
    j = draw_pose(cv, name)
    m = j["mouth"]
    if name == "windup":
        sparkle(cv, add(j["eye"], (2, -5)), WHITE, EYE)
    elif name == "attack":
        burst(cv, add(m, (5, 2)), 4.5, (240, 230, 190), WHITE, spikes=6)
    elif name == "recover":
        # 독액 줄기: 입에서 아군 쪽으로 퍼지며 내려가는 물방울 + 끝의 튀김
        jet = bezier(add(m, (1, 0)), add(m, (10, -2)), (61, 36), 8)
        cv.part(chain(jet, [1.8, 2.2, 2.4, 2.6, 2.8, 3.0, 3.0, 3.2, 3.2]), VENOM, ink=(30, 70, 20), gloss=False)
        cv.line(jet[1:6], VENOM[2])
        for p in ((57, 42), (60, 45), (54, 46), (59, 30)):
            cv.put(ellipse(cv.blank(), p, 1.1, 1.1), VENOM[1])
        sparkle(cv, (55, 34), WHITE, VENOM[2])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((-3, -6), (0, -8), (3, -6)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("snake-01", draw, sys.argv[1:], idle_ms=210)
