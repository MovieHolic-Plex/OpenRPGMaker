#!/usr/bin/env python3
"""룬 둘러싼 부유 조각돌(ontology-8da61312) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

가운데에 보라 룬 핵(둥근 핵 위쪽 뒤로 어두운 돌 뿔 둘이 박혀 있고, 핵 앞쪽에 앞이 낮게 찢어진 청록 눈이
세로 동공으로 아군 쪽을 노려본다)이 떠 있다. 핵을 3/4 로 기운 청록 룬 궤도가 감싸고, 그 궤도를 따라
잘린 석판 조각 넷이 돈다 — 궤도 뒤 반쪽과 그 위 조각은 어둡게 핵 뒤로, 앞 반쪽과 그 위 조각은
밝고 크게 핵 앞을 덮는다. 앞 조각 면에는 청록 룬 각인이 빛난다.
대기: 핵이 오르내리고 조각이 궤도를 따라 돌며 앞뒤가 바뀐다.
6번 칸(스킬 룬 맥동): 조각이 궤도 밖으로 활짝 펼쳐지고 핵이 빛을 터뜨리며 청록 룬 파편 셋을 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_ontology_8da61312.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, arc_trail, bezier, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

INK = (20, 14, 34)
STONE = [(72, 76, 98), (110, 118, 140), (152, 162, 180), (198, 208, 218)]
STONE_FAR = [(40, 40, 60), (58, 60, 82), (84, 88, 112), (84, 88, 112)]
STONE_DEAD = [(56, 58, 72), (82, 86, 100), (112, 118, 130), (112, 118, 130)]
CORE = [(58, 26, 104), (100, 54, 168), (148, 96, 220), (204, 170, 250)]
CORE_DEEP = (40, 16, 76)
CORE_DIM = [(40, 26, 60), (62, 44, 88), (86, 66, 112), (86, 66, 112)]
RUNE = [(28, 112, 120), (62, 192, 184), (150, 246, 226)]
EYE_W = (226, 255, 246)
PUPIL = (24, 8, 30)
WHITE = (255, 255, 255)

C0 = (28, 30)  # 핵 기본 위치
R_CORE = 11
RX, RY, RING_DY = 22, 7, 6  # 3/4 로 기운 궤도(핵 가운데보다 조금 아래)
# 궤도 조각: (궤도 각, 길이, 폭, 기울기 덧) — 궤도 각 90 = 정면(아래), 270 = 뒤(위)
RING_SHARDS = ((16, 15, 9, 0), (112, 17, 11, 0), (192, 15, 9, 0), (290, 13, 8, 0))


def shard_poly(c, L, W, ang):
    """여섯 모 결정 석판(끝이 한쪽으로 치우쳐 뾰족). ang 은 끝이 향하는 방향(도, 0=위)."""
    loc = [(W * 0.12, -L / 2), (W / 2, -L * 0.18), (W * 0.4, L * 0.34), (-W * 0.06, L / 2), (-W / 2, L * 0.24),
           (-W * 0.44, -L * 0.24)]
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + x * ca - y * sa, c[1] + x * sa + y * ca) for x, y in loc]


def shard(cv, c, L, W, ang, front, ramp=None, carve=True, glow_crack=False):
    pts = shard_poly(c, L, W, ang)
    ramp = ramp or (STONE if front else STONE_FAR)
    M = cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    # 세 면: 빛 받는 왼면 / 가운데 / 그늘진 오른면 (조각의 국소 x 로 나눈다)
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    ys, xs = np.nonzero(M)
    for y, x in zip(ys, xs):
        dx, dy = x - c[0], y - c[1]
        lx, ly = dx * ca + dy * sa, -dx * sa + dy * ca
        if lx < -W * 0.14 + ly * 0.12:
            col = ramp[3] if ly < -L * 0.1 and front else ramp[2]
        elif lx > W * 0.18:
            col = ramp[0]
        else:
            col = ramp[1]
        cv.rgb[y, x] = col
    if glow_crack:  # 스킬: 가운데 면에 갈라진 청록 빛 금
        tip, base = pts[0], pts[3]
        k = [lerp(tip, base, 0.2), add(lerp(tip, base, 0.45), (1, 0)), lerp(tip, base, 0.7)]
        cv.line(k, RUNE[1])
        cv.pixel(*rnd(k[1]), WHITE)
    if carve:  # 청록 룬 각인(작은 갈래 표식). 뒤 조각은 어두운 청록
        m = lerp(c, pts[1], 0.15)
        hi, lo = (RUNE[2], RUNE[1]) if front else (RUNE[1], RUNE[0])
        cv.pixel(*rnd(m), hi)
        cv.pixel(*rnd(add(m, (0, -1))), lo)
        cv.pixel(*rnd(add(m, (0, 1))), lo)
        cv.pixel(*rnd(add(m, (-1, 1))), lo)
    return pts


# 앞(오른쪽)으로 떨어지는 성난 눈. 가로 9칸, 맨 아래 줄이 e 기준 +2. P = 세로 동공(아군 쪽으로 치우침).
EYE_MAPS = {
    "open": ("XXXX.......",
             "XtTXXXX....",
             "XtTTTHTXX..",
             "XtTTTHTTTX.",
             "XtTTHGHTTtX",
             "XttTTHTTttX",
             ".XXttHttXX.",
             "...XXXXX..."),
    "narrow": ("XXXXXXX....",
               "XttTTHTXXX.",
               "XtTTHGHTTtX",
               ".XXttHttXX.",
               "...XXXXX..."),
    "wide": ("XXXX.......",
             "XtTXXXX....",
             "XtTTTHTXX..",
             "XtTTHGHTTX.",
             "XtTTHGHTTtX",
             "XttTTHTTttX",
             ".XXttHttXX.",
             "...XXXXX..."),
}


def core(cv, c, r, eye="open", pulse=0, look=0, glint=False, sig=0):
    M = cv.part(ellipse(cv.blank(), c, r, r), CORE, ink=INK, gloss=False)
    # 구 입체: 뒤(왼쪽) 가장자리 그늘, 오른쪽 아래 깊은 그늘 초승달, 왼쪽 위 큰 반사광
    cv.shade_side(M, CORE[0], side=-1, depth=2)
    deep = M & ~(np.array(ellipse(cv.blank(), add(c, (-2, -2)), r, r)) > 0)
    cv.rgb[deep] = CORE_DEEP
    # 왼쪽 위 테두리를 따라 1px 테 빛
    band = (np.array(ellipse(cv.blank(), add(c, (1, 1)), r, r)) == 0) & M  # 왼쪽 위 초승달
    cv.rgb[band] = CORE[2]
    # 뒤쪽(왼쪽) 마름모 룬 각인: 2px 굵기 테 + 가운데 점, 위쪽에 파인 그늘
    g = rnd(add(c, (-6, -3 + sig)))
    col = (RUNE[2], WHITE) if pulse > 1 else (RUNE[1], WHITE) if pulse else (CORE[2], RUNE[1])
    dm = [add(g, (0, -4)), add(g, (2, 0)), add(g, (0, 4)), add(g, (-2, 0))]
    cv.line([add(p, (0, -1)) for p in dm[:2]], CORE_DEEP)
    cv.put(poly(cv.blank(), dm), col[0])
    cv.put(poly(cv.blank(), [add(g, (0, -2)), add(g, (0, 0)), add(g, (0, 2))]), CORE[0])
    cv.pixel(g[0], g[1], col[1])
    e = rnd(add(c, (3 + look, 0)))
    # 눈두덩 그늘
    cv.put(ellipse(cv.blank(), add(e, (0, 0)), 6.5, 5), CORE[0])
    if eye == "x":
        for d in (-1, 1):
            cv.line([add(e, (-2, -2 * d)), add(e, (2, 2 * d))], PUPIL)
        return e
    if eye == "hurt":  # 눈빛이 금 가듯 깨져 X 로 튄다
        cv.put(ellipse(cv.blank(), e, 4, 3.5), INK)
        cv.line([add(e, (-3, -3)), add(e, (-1, -1)), add(e, (0, 0)), add(e, (3, 3))], RUNE[1])
        cv.line([add(e, (3, -3)), add(e, (1, -1)), add(e, (-1, 1)), add(e, (-3, 3))], RUNE[1])
        cv.pixel(e[0], e[1], WHITE)
        cv.pixel(e[0] + 5, e[1] - 4, RUNE[2])
        return e
    # 눈 위 이마 골: 뒤에서 앞으로 떨어지는 짙은 홈 → 노려보는 얼굴
    cv.line([add(e, (-6, -len(EYE_MAPS[eye]) + 2)), add(e, (-1, -len(EYE_MAPS[eye]) + 2)), add(e, (6, -1))], CORE_DEEP, 2)
    rows = EYE_MAPS[eye]
    pal = {"X": INK, "W": EYE_W, "T": RUNE[1], "t": RUNE[0], "P": PUPIL, "G": WHITE, "H": RUNE[2]}
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in pal:
                cv.pixel(e[0] - 5 + dx, e[1] - len(rows) + 4 + dy, pal[ch])
    if glint:
        cv.pixel(e[0] + 4, e[1] - 3, RUNE[2])
    return e


def tendril(cv, a, b, bend, pulse=0):
    """핵에서 조각으로 뻗는 룬 기운 줄기(굵게 시작해 가늘어지며 휜다)."""
    mid = lerp(a, b, 0.5)
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    ctrl = (mid[0] - dy / n * bend, mid[1] + dx / n * bend)
    pts = bezier(a, ctrl, b, 6)
    cv.put(chain(pts, [2.0, 1.4, 1.0, 1.0, 1.0, 1.0, 1.0]), RUNE[0])
    cv.line4(pts[:2], RUNE[2] if pulse else RUNE[1])


# 조각 배치: 궤도 조각은 (궤도 각, 길이, 폭), 높은 조각은 (핵 기준 dx, dy, 길이, 폭, 끝 방향, 흔들림 위상)
HIGH_SHARDS = ((-12, -12, 18, 8, -34, 0.0), (12, -15, 11, 7, 22, 2.0))


def creature(cv, c=C0, r=R_CORE, phase=0.0, spread=1.0, bob=0, eye="open", pulse=0, push=None, spin=0.0,
             lift=0.0, look=0, glint=False, sig=0, drift=0, loose=(), skip=()):
    """phase = 궤도 회전(도). push = {조각 번호: (dx, dy)} (0~3 궤도, 4~5 높은 조각). lift = 높은 조각 띄움."""
    rc = add(c, (0, RING_DY))
    placed = []
    for i, (a, L, W, tl) in enumerate(RING_SHARDS):
        th = a + phase
        sn = math.sin(math.radians(th))
        inward = 1 - 0.12 * max(sn, 0)  # 앞쪽 조각은 핵 앞으로 들어와 겹친다
        p = (rc[0] + RX * spread * inward * math.cos(math.radians(th)), rc[1] + RY * spread * sn)
        if push and i in push:
            p = add(p, push[i])
        k = 1 + 0.18 * sn  # 앞일수록 크게
        # 결정은 대체로 곧추선 채 궤도를 돈다(바깥쪽으로 조금만 기운다)
        out = math.cos(math.radians(th)) * 18 + tl + spin * (1 if i % 2 else -1)
        placed.append((sn, i, p, L * k, W * k * (0.78 + 0.22 * abs(sn)), out))  # 옆으로 돌면 폭이 줄어든다
    for j, (dx, dy, L, W, ang, ph) in enumerate(HIGH_SHARDS):
        i = 4 + j
        p = add(c, (dx * spread - drift, dy * spread - lift + bob * math.cos(ph)))
        if push and i in push:
            p = add(p, push[i])
        placed.append((-0.5, i, p, L, W, ang + spin * (1 if j else -1)))
    placed.sort(key=lambda q: q[0])
    back = [q for q in placed if q[0] < 0]
    front = [q for q in placed if q[0] >= 0]

    def root(p):  # 줄기 뿌리 = 핵 가장자리 안쪽
        ang = math.degrees(math.atan2(p[1] - c[1], p[0] - c[0]))
        return polar(c, ang, r - 2)

    for sn, i, p, L, W, out in back:
        if i in skip:
            continue
        if i not in loose:
            tendril(cv, root(p), p, 7 if i % 2 else -7, pulse)
        shard(cv, p, L, W, out, False, carve=pulse > 1)
    e = core(cv, c, r, eye=eye, pulse=pulse, look=look, glint=glint, sig=sig)
    tips = {}
    for sn, i, p, L, W, out in front:
        if i in skip:
            continue
        if i not in loose:
            tendril(cv, polar(c, math.degrees(math.atan2(p[1] - c[1], p[0] - c[0])), r), p, 7 if i % 2 else -7, pulse)
        tips[i] = shard(cv, p, L, W, out, True, glow_crack=pulse > 1)[0]
    return dict(eye=e, tips=tips, c=c, pos={q[1]: q[2] for q in placed})


def rune_bolt(cv, c, length):
    """청록 룬 파편: 마름모 결정 + 뒤로 끌리는 빛꼬리."""
    for k in range(3, length, 3):  # 청록 빛가루 꼬리
        cv.pixel(c[0] - k, c[1] + (k // 3) % 2, RUNE[1] if k < length / 2 else RUNE[0])
    cv.line([add(c, (-5, 0)), add(c, (-3, 0))], RUNE[1])
    d = poly(cv.blank(), [add(c, (-4, 0)), add(c, (-1, -3)), add(c, (5, 0)), add(c, (-1, 3)), add(c, (-2, 1))])
    cv.part(d, [RUNE[0], RUNE[1], RUNE[2], WHITE], ink=INK, gloss=False)
    cv.pixel(c[0], c[1], WHITE)


def draw(name):
    cv = Canvas(64, INK)
    if name == "idle_a":
        creature(cv)
    elif name == "idle_b":
        creature(cv, c=add(C0, (0, -2)), phase=10, bob=1.5, glint=True, drift=2,
                 push={0: (1, 1), 1: (2, 1), 2: (-2, -1), 3: (-2, -1)})
    elif name == "idle_c":
        creature(cv, c=add(C0, (0, 1)), phase=20, bob=-1.5, pulse=1, sig=1, drift=4,
                 push={0: (2, 1), 1: (3, 2), 2: (-3, -1), 3: (-3, -2)})
    elif name == "windup":  # 앞 조각을 핵 앞으로 바짝 겹쳐 웅크리고, 룬과 동공에 빛을 모은다
        c = add(C0, (-3, 1))
        j = creature(cv, c=c, phase=-20, spread=0.85, eye="narrow", pulse=2, lift=2, spin=-16,
                     push={0: (-5, 1), 1: (-3, 2)})
        e = j["eye"]
        for d in (-1, 0):  # 동공이 하얗게 달아오른다
            cv.pixel(e[0], e[1] + d, WHITE)
        cv.pixel(e[0] + 6, e[1] - 1, RUNE[2])
        for (dx, dy) in ((-8, -16), (13, -10), (-14, 6)):  # 빨려 드는 룬 빛
            sparkle(cv, add(j["c"], (dx, dy)), WHITE, RUNE[1])
    elif name == "move":  # 핵이 앞으로 쏠리고 조각들이 관성으로 뒤에 끌린다
        speed_lines(cv, 1, 6, (24, 34, 44), STONE_FAR[2])
        creature(cv, c=(36, 29), phase=12, look=1, spin=-34,
                 push={0: (-4, 2), 1: (-9, -3), 2: (2, 0), 3: (-4, 1), 4: (-8, 3), 5: (-9, 4)})
    elif name == "attack":  # 핵이 앞으로 들이밀며 앞 조각을 끈에서 떼어 창처럼 내지른다
        creature(cv, c=(25, 30), phase=10, eye="wide", pulse=1, look=1, skip=(0,),
                 push={2: (-2, 0), 4: (-3, 1), 5: (-3, 0)})
        for (x, y, col) in ((31, 41, RUNE[0]), (35, 39, RUNE[1]), (38, 40, RUNE[1])):  # 끊긴 줄기의 불티
            cv.pixel(x, y, col)
        tip = shard(cv, (44, 37), 16, 9, 62, True)[0]
        slash(cv, add(tip, (3, -14)), add(tip, (3, 12)), -6, 4.6, RUNE[1], WHITE)
        sparkle(cv, add(tip, (1, 0)), WHITE, RUNE[2], big=True)
    elif name == "recover":  # 스킬: 조각이 뒤·위·아래로 터지듯 펼쳐져 금마다 빛나고, 핵이 맥동해 룬 파편을 쏜다
        c = (24, 31)
        creature(cv, c=c, r=11.5, phase=-6, spread=1.0, eye="wide", pulse=2, lift=3, spin=22,
                 push={0: (-4, 14), 1: (-4, 9), 2: (2, -3), 3: (-12, -23), 4: (0, 2), 5: (5, 0)})
        # 맥동: 핵 앞(오른쪽)에 꽉 찬 청록 초승달 빛
        arc_trail(cv, c, 14.5, -62, 62, 4, RUNE[1], RUNE[2])
        for (dx, dy, ln) in ((26, -10, 8), (35, 1, 13), (29, 12, 10)):
            rune_bolt(cv, add(c, (dx, dy)), ln)
        burst(cv, add(c, (15, 0)), 4, RUNE[2], WHITE, spikes=4, rot=0)
    elif name == "hit":  # 핵이 뒤로 밀려 젖혀지고, 끈이 흔들리며 조각이 제멋대로 튄다
        creature(cv, c=(24, 32), phase=30, spread=1.0, eye="hurt", spin=-34, lift=-2,
                 push={0: (3, -5), 1: (-2, 4), 2: (2, -3), 3: (4, -5), 4: (5, -1), 5: (2, -4)})
        for p in ((40, 13), (44, 11), (48, 13), (51, 17)):
            cv.pixel(*p, WHITE)
        cv.pixel(41, 13, WHITE)
    elif name == "dead":  # 룬이 꺼지고 핵이 깨져 조각과 함께 바닥에 흩어진다
        for (x, y, ang, L, W) in ((8, 56, 70, 9, 6), (16, 54, 112, 13, 8), (50, 55, 72, 13, 8), (58, 57, 104, 9, 6)):
            shard(cv, (x, y), L, W, ang, True, ramp=STONE_DEAD, carve=False)
        # 깨진 핵: 가운데 큰 껍데기 조각(꺼진 눈구멍이 비어 있다) + 옆 작은 덩이
        shell = poly(cv.blank(), [(25, 59), (24, 52), (27, 47), (33, 45), (38, 47), (37, 51), (40, 54), (39, 59)])
        cv.part(shell, CORE_DIM, ink=INK, gloss=False)
        cv.put(poly(cv.blank(), [(29, 51), (33, 50), (36, 52), (33, 54), (29, 53)]), PUPIL)  # 빈 눈구멍
        cv.line([(36, 47), (35, 50)], INK)
        cv.line([(26, 55), (28, 57)], CORE_DEEP)
        chunk = poly(cv.blank(), [(40, 59), (42, 55), (45, 55), (46, 59)])
        cv.part(chunk, CORE_DIM, ink=INK, gloss=False)
        shard(cv, (21, 57), 8, 6, 100, True, ramp=STONE_DEAD, carve=False)
        puff(cv, (44, 52), 1.6, [STONE_FAR[1], STONE_FAR[2]])
    return cv.image()


if __name__ == "__main__":
    run("ontology-8da61312", draw, sys.argv[1:], idle_ms=180)
