#!/usr/bin/env python3
"""룬 둘러싼 부유 조각돌(ontology-8da61312) 전투 시트 3x3x64 + 초상 64 를 좌표로 직접 그린다 (2차).

가운데에 보라 결정 핵(네 면으로 깎인 길쭉한 팔면체, 왼쪽 위 면이 빛을 받는다)이 떠 있고, 핵 앞면에 청록 룬
표식(마름모 테 안에 세로로 빛나는 금)이 박혀 아군 쪽을 겨눈다. 핵 둘레에는 짙은 청록 기운 테가 한 겹 감돈다.
잘린 석판 조각 다섯이 3/4 로 기운 궤도를 **줄기 없이** 자유롭게 돈다(FF6·크로노 트리거식 부유 구조물):
궤도 뒤 조각은 어둡고 작게 핵 뒤로, 앞 조각은 밝고 크게 핵 앞으로. 조각마다 핵을 향한 모서리에 청록 기운이 맺힌다.

대기(0·1·2·1 왕복): 핵이 2~3px 오르내리며 룬이 어두움→밝음으로 맥동하고, 조각은 궤도를 따라 3~5px 미끄러지며 돈다.
windup: 조각이 핵 바로 곁으로 끌려와 바깥을 향해 곧추서고(가시 왕관), 룬이 하얗게 달아오른다 — 스킬·공격 예고.
attack: 앞 조각 하나를 창처럼 아군 쪽으로 쏘아 보낸다. skill(0,2): 조각을 넓게 터뜨려 펼치고 룬 파편 셋을 쏜다.
hit: 핵이 하얗게 번쩍이며 금이 가고 뒤로 밀린다, 조각은 바깥으로 튕기고 돌 부스러기가 튄다(눈·표정 없음).
dead: 룬이 꺼지고 핵이 두 동강 나 조각들과 바닥에 흩어진다.

  python3 scripts/content/monsters/redraw_ontology_8da61312.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

import numpy as np

from pixel_lib import Canvas, add, lerp, poly, polar, rnd, run, speed_lines

INK = (20, 14, 34)
STONE = [(72, 76, 98), (110, 118, 140), (152, 162, 180), (198, 208, 218)]
STONE_FAR = [(44, 44, 64), (62, 64, 88), (88, 92, 116), (88, 92, 116)]
STONE_DEAD = [(56, 58, 72), (82, 86, 100), (112, 118, 130), (112, 118, 130)]
CORE = [(58, 26, 104), (100, 54, 168), (148, 96, 220), (204, 170, 250)]
CORE_DIM = [(40, 26, 60), (62, 44, 88), (86, 66, 112), (86, 66, 112)]
FLASH = [(176, 150, 226), (220, 206, 250), (246, 240, 255), (255, 255, 255)]
RUNE = [(28, 112, 120), (62, 192, 184), (150, 246, 226)]
AURA = (24, 70, 84)
WHITE = (255, 255, 255)

C0 = (31, 25)  # 핵 기본 위치
CW, CH = 22, 29  # 핵 폭·높이
RX, RY, RING_DY = 24, 7, 9  # 3/4 로 기운 궤도(핵 가운데보다 조금 아래)
# 궤도 조각: (궤도 각, 길이, 폭, 끝 방향 덧) — 궤도 각 90 = 정면(아래), 270 = 뒤(위)
SHARDS = ((18, 13, 10, 10), (100, 14, 12, -4), (170, 13, 10, -12), (234, 11, 9, 6), (302, 12, 9, -6))


# ── 조각 ───────────────────────────────────────────────────

def shard_poly(c, L, W, ang):
    """깨진 석판 조각(모가 진 여섯 모, 위 모서리가 비스듬히 잘렸다). ang 은 조각 위쪽이 향하는 방향(도, 0=위)."""
    loc = [(-W * 0.5, -L * 0.34), (W * 0.18, -L * 0.5), (W * 0.5, -L * 0.18), (W * 0.4, L * 0.5), (-W * 0.22, L * 0.42),
           (-W * 0.5, L * 0.12)]
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + x * ca - y * sa, c[1] + x * sa + y * ca) for x, y in loc]


GLYPHS = (((0, 0), (0, -1), (0, 1), (0, 2), (-1, -2), (1, -2)),  # ᛉ
          ((1, -1), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (1, 0)),  # ᚦ
          ((0, 0), (1, -2), (0, -1), (-1, 0), (0, 1), (1, 2)),  # ᚲ
          ((0, 0), (0, -2), (-1, -1), (1, -1), (-1, 0), (1, 0), (0, 1)),  # ᛜ
          ((0, 0), (-1, -2), (-1, -1), (1, 1), (1, 2)))  # ᛋ


def shard(cv, c, L, W, ang, front, ramp=None, carve=True, hot=False, rim=None, glyph=0):
    """돌 조각 하나. rim = 핵 쪽 방향(도) — 그쪽 모서리에 청록 기운 두 칸."""
    pts = shard_poly(c, L, W, ang)
    ramp = ramp or (STONE if front else STONE_FAR)
    M = cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    ys, xs = np.nonzero(M)
    top = ys.min() if len(ys) else 0
    for y, x in zip(ys, xs):  # 윗면(3/4 로 보이는 잘린 면) / 빛 받는 왼면 / 앞면 / 그늘진 오른면
        dx, dy = x - c[0], y - c[1]
        lx, ly = dx * ca + dy * sa, -dx * sa + dy * ca
        if y - top < 2.4 - abs(dx) * 0.12:  # 화면에서 가장 위 두 줄 = 3/4 로 보이는 윗면(돌린 조각도 위쪽이 밝다)
            col = ramp[3] if front else ramp[2]
        elif lx < -W * 0.22:
            col = ramp[2]
        elif lx > W * 0.24:
            col = ramp[0]
        else:
            col = ramp[1]
        cv.rgb[y, x] = col
    if carve:  # 새긴 룬(조각마다 다른 글자)
        m = rnd(add(c, (0, 1)))
        hi, lo = (WHITE, RUNE[2]) if hot else (RUNE[2], RUNE[1]) if front else (RUNE[1], RUNE[0])
        if ramp is STONE_DEAD:  # 꺼진 룬: 빛 없는 홈만
            hi = lo = (40, 42, 54)
        g = GLYPHS[glyph % len(GLYPHS)]
        for d in g[1:]:
            cv.pixel(m[0] + d[0], m[1] + d[1], lo)
        cv.pixel(m[0] + g[0][0], m[1] + g[0][1], hi)
    if rim is not None:  # 핵 쪽 윤곽 두 칸이 청록 기운으로 빛난다(조각을 붙잡는 힘)
        col = RUNE[1] if front else RUNE[0]
        ys2, xs2 = np.nonzero(M)
        ux, uy = math.cos(math.radians(rim)), math.sin(math.radians(rim))
        score = (xs2 - c[0]) * ux + (ys2 - c[1]) * uy
        for j in np.argsort(-score)[:2]:
            cv.rgb[ys2[j], xs2[j]] = col
    return pts


# ── 핵 ─────────────────────────────────────────────────────

def core(cv, c, w=CW, h=CH, glow=0, state="live", tilt=0.0):
    """네 면 결정 핵. glow 0~3 = 룬 밝기. state: live / hit(흰 번쩍·금) / dim(꺼짐)."""
    cx, cy = c
    T = (cx + tilt, cy - h / 2)
    R = (cx + w / 2, cy - h * 0.08)
    B = (cx + 1 - tilt, cy + h / 2)
    Lp = (cx - w / 2, cy - h * 0.12)
    M = (cx + w * 0.12, cy + h * 0.05)  # 앞 모서리(3/4 라 조금 오른쪽, 내려다봐서 허리선이 앞에서 처진다)
    ramp = {"live": CORE, "hit": FLASH, "dim": CORE_DIM}[state]
    whole = cv.part(poly(cv.blank(), [T, R, B, Lp]), ramp, ink=INK, gloss=False)
    faces = (([T, Lp, M], ramp[3] if state != "dim" else ramp[2]), ([Lp, B, M], ramp[2]),
             ([T, R, M], ramp[1]), ([R, B, M], ramp[0]))
    for pts, col in faces:
        f = (np.array(poly(cv.blank(), pts)) > 0) & whole
        cv.rgb[f] = col
    # 왼쪽 위 모서리 1px 테 빛(구슬 윤기 대신 깎인 모서리)
    if state == "live":
        cv.line([add(T, (0, 1)), add(Lp, (1, 0))], CORE[3])
        cv.line([add(Lp, (1, 1)), add(B, (0, -2))], CORE[2])
    # 앞면 룬: 짙은 마름모 홈 + 세로 빛 금(아군 쪽을 겨누는 「눈」 대신 표식)
    g = rnd(lerp(M, Lp, 0.3))
    g = (g[0], g[1] + 1)
    if state == "dim":
        cv.line([add(g, (0, -3)), add(g, (0, 3))], CORE_DIM[0])
        return whole
    rim, slit, hot = {0: (CORE[0], RUNE[0], RUNE[1]), 1: (CORE[0], RUNE[1], RUNE[2]),
                      2: (RUNE[0], RUNE[2], WHITE), 3: (RUNE[1], WHITE, WHITE)}[glow]
    if state == "hit":
        rim, slit, hot = FLASH[0], WHITE, WHITE
    dm = [add(g, (0, -5)), add(g, (3, 0)), add(g, (0, 5)), add(g, (-3, 0))]
    cv.line(dm + [dm[0]], rim)
    cv.line([add(g, (0, -3)), add(g, (0, 3))], slit)
    cv.pixel(g[0], g[1], hot)
    if glow >= 2 and state == "live":
        cv.pixel(g[0] - 1, g[1], slit)
        cv.pixel(g[0] + 1, g[1], slit)
    if state == "hit":  # 핵을 가로지르는 금(위 오른쪽 → 아래 왼쪽)
        cv.line([add(T, (2, 4)), add(g, (2, -2)), add(g, (-1, 2)), add(B, (-3, -4))], INK)
    return whole


def aura(cv, whole, color=AURA, gap=1):
    """핵 외곽선 바깥 한 겹 기운(비어 있는 칸에만, 한 칸 걸러 찍은 성긴 빛 — 외곽선과 겹 테가 되지 않게)."""
    M = whole.copy()
    for _ in range(gap + 1):
        g = M.copy()
        g[1:] |= M[:-1]
        g[:-1] |= M[1:]
        g[:, 1:] |= M[:, :-1]
        g[:, :-1] |= M[:, 1:]
        M = g
    yy, xx = np.indices(M.shape)
    ring = M & ~cv.a & ((yy + xx) % 2 == 0)
    cv.rgb[ring] = color
    cv.a[ring] = True


# ── 몸 전체 ─────────────────────────────────────────────────

def creature(cv, c=C0, phase=0.0, spread=1.0, glow=0, push=None, spin=0.0, skip=(), state="live", hot=False,
             bob=None, aura_col=AURA, wh=(CW, CH), point_out=False, tilt=0.0, ticks=False):
    """phase = 궤도 회전(도). push = {조각 번호: (dx, dy)}. bob = {조각 번호: dy}."""
    rc = add(c, (0, RING_DY))
    placed = []
    for i, (a, L, W, tl) in enumerate(SHARDS):
        th = a + phase
        sn, cs = math.sin(math.radians(th)), math.cos(math.radians(th))
        p = (rc[0] + RX * spread * cs, rc[1] + RY * spread * sn)
        if bob and i in bob:
            p = add(p, (0, bob[i]))
        if push and i in push:
            p = add(p, push[i])
        k = 1 + 0.16 * sn  # 앞일수록 크게
        if point_out:  # 끝이 핵 바깥을 향한다
            ang = math.degrees(math.atan2(p[1] - c[1], p[0] - c[0])) + 90
        else:
            ang = cs * 16 + tl
        ang += spin * (1 if i % 2 else -1)
        placed.append((sn, i, p, L * k, W * k * (0.8 + 0.2 * abs(sn)), ang))
    placed.sort(key=lambda q: q[0])
    to_core = lambda p: math.degrees(math.atan2(c[1] - p[1], c[0] - p[0]))
    for sn, i, p, L, W, ang in placed:
        if sn < 0 and i not in skip:
            shard(cv, p, L, W, ang, False, hot=hot, rim=to_core(p), glyph=i)
    whole = core(cv, c, w=wh[0], h=wh[1], glow=glow, state=state, tilt=tilt)
    if aura_col:
        aura(cv, whole, aura_col)
    if ticks:  # 네 꼭짓점에서 바깥으로 뻗는 짧은 빛살(충전)
        cx, cy = c
        for (x, y, dx, dy) in ((cx + tilt, cy - wh[1] / 2 - 2, 0, -1), (cx + wh[0] / 2 + 2, cy - wh[1] * 0.08, 1, 0),
                               (cx - wh[0] / 2 - 2, cy - wh[1] * 0.12, -1, 0)):
            x, y = rnd((x, y))
            for d in range(3):
                if not cv.a[y + dy * d, x + dx * d] or d == 0:
                    cv.pixel(x + dx * d, y + dy * d, WHITE if d == 0 else RUNE[2] if d == 1 else RUNE[1])
    for sn, i, p, L, W, ang in placed:
        if sn >= 0 and i not in skip:
            shard(cv, p, L, W, ang, True, hot=hot, rim=to_core(p), glyph=i)
    return {q[1]: q[2] for q in placed}


def rune_bolt(cv, c, length):
    """청록 룬 파편: 마름모 결정 + 뒤로 끌리는 빛꼬리."""
    for j, k in enumerate(range(4, length, 2)):
        cv.pixel(c[0] - k, c[1] + (0, 1, 0, -1)[j % 4], RUNE[2] if j == 0 else RUNE[1] if k < length * 0.6 else RUNE[0])
    d = poly(cv.blank(), [add(c, (-4, 0)), add(c, (0, -3)), add(c, (4, 0)), add(c, (0, 3))])
    cv.part(d, [RUNE[0], RUNE[1], RUNE[2], WHITE], ink=INK, gloss=False)
    cv.pixel(c[0], c[1], WHITE)
    cv.pixel(c[0] + 1, c[1], WHITE)


def chip(cv, p, col=STONE[1]):
    """튀는 돌 부스러기(2x2 + 외곽)."""
    m = poly(cv.blank(), [p, add(p, (3, -1)), add(p, (1, 2))])
    cv.part(m, [STONE[0], col, STONE[2], STONE[2]], ink=INK, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "idle_a":
        creature(cv, phase=0, glow=0, bob={0: 1, 1: 0, 2: -1, 3: 0, 4: 1})
    elif name == "idle_b":
        creature(cv, c=add(C0, (0, -2)), phase=12, glow=1, spin=7, bob={0: -1, 1: 1, 2: 1, 3: -1, 4: 0})
    elif name == "idle_c":
        creature(cv, c=add(C0, (0, -3)), phase=24, glow=2, spin=14, bob={0: -2, 1: 2, 2: 2, 3: -1, 4: -1},
                 aura_col=RUNE[1])
    elif name == "windup":  # 조각이 핵 곁으로 끌려와 바깥을 향해 곧추서고(가시 왕관) 꼭짓점에 빛살 — 예고
        c = add(C0, (-3, -1))
        creature(cv, c=c, phase=-10, spread=0.74, glow=3, hot=True, point_out=True, aura_col=RUNE[1], ticks=True,
                 push={1: (0, 3), 3: (-1, -4), 4: (1, -5)})
        for (dx, dy) in ((-19, -12), (18, -13), (-24, -1)):  # 빨려 드는 룬 빛(작은 십자)
            p = rnd(add(c, (dx, dy)))
            cv.pixel(p[0], p[1], WHITE)
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                cv.pixel(p[0] + d[0], p[1] + d[1], RUNE[1])
    elif name == "move":  # 핵이 앞으로 쏠리고 조각이 관성으로 뒤에 끌린다
        speed_lines(cv, 2, 9, (22, 32, 42), CORE[2])
        creature(cv, c=(37, 28), phase=6, glow=1, spin=-20,
                 push={0: (-5, 1), 1: (-7, 3), 2: (-3, -1), 3: (-6, 0), 4: (-8, 2)})
    elif name == "attack":  # 앞 조각을 아군 쪽으로 쏘아 창처럼 찌른다
        c = (26, 28)
        creature(cv, c=c, phase=6, glow=2, skip=(0,), tilt=2, push={2: (2, 0), 3: (-1, 0), 4: (-3, -2)})
        for (x, y, col) in ((41, 33, RUNE[1]), (39, 33, RUNE[0]), (42, 30, RUNE[0]), (40, 36, RUNE[0]), (37, 31, RUNE[0])):  # 날아간 자리 빛 부스러기(빈 칸에만)
            if not cv.a[y, x]:
                cv.pixel(x, y, col)
        shard(cv, (51, 33), 15, 9, 90, True, hot=True, glyph=0)
        x, y = 59, 33
        cv.pixel(x, y, WHITE)
        for d, col in ((1, WHITE), (2, RUNE[2]), (3, RUNE[1])):
            cv.pixel(x + d, y, col)
            cv.pixel(x, y - d, col)
            cv.pixel(x, y + d, col)
    elif name == "recover":  # 스킬: 조각을 넓게 터뜨려 펼치고, 달아오른 룬이 파편 셋을 쏜다
        c = (25, 30)
        creature(cv, c=c, phase=-8, spread=1.0, glow=3, hot=True, point_out=True, aura_col=RUNE[1],
                 push={0: (-3, 8), 1: (-4, 6), 2: (4, -2), 3: (2, -14), 4: (6, -9)})
        for (dx, dy, ln) in ((24, -10, 9), (32, 0, 14), (26, 10, 10)):
            rune_bolt(cv, add(c, (dx, dy)), ln)
        for d in range(2, 6):  # 핵 앞으로 터지는 빛 줄기
            cv.pixel(c[0] + 9 + d, c[1], WHITE if d < 4 else RUNE[2])
    elif name == "hit":  # 핵이 하얗게 번쩍이며 금 가고 뒤로 밀린다, 조각은 바깥으로 튕긴다
        c = (25, 29)
        creature(cv, c=c, phase=18, spread=1.15, state="hit", spin=-24, aura_col=None,
                 push={0: (2, -3), 1: (-3, 3), 2: (-3, -2), 3: (-2, -4), 4: (4, -4)})
        for p in ((44, 12), (49, 16), (42, 8)):
            chip(cv, p)
        for (x, y) in ((33, 17), (36, 15)):  # 금에서 튀는 빛 사선
            cv.pixel(x, y, WHITE)
            cv.pixel(x + 1, y - 1, RUNE[2])
    elif name == "dead":  # 룬이 꺼지고 핵이 두 동강 나 조각과 함께 바닥에 흩어진다
        for (x, y, ang, L, W) in ((9, 55, 64, 9, 6), (17, 56, 112, 13, 8), (49, 55, 72, 12, 8), (57, 57, 104, 9, 6)):
            shard(cv, (x, y), L, W, ang, True, ramp=STONE_DEAD, carve=L >= 12, glyph=x)
        # 두 동강 난 핵: 왼쪽 반(눕고) · 오른쪽 반(기울어)
        left = poly(cv.blank(), [(24, 59), (26, 50), (32, 47), (33, 53), (31, 59)])
        cv.part(left, CORE_DIM, ink=INK, gloss=False)
        right = poly(cv.blank(), [(35, 59), (35, 51), (40, 44), (44, 49), (42, 59)])
        cv.part(right, CORE_DIM, ink=INK, gloss=False)
        cv.line([(27, 52), (30, 50)], CORE_DIM[3])
        cv.line([(37, 50), (40, 46)], CORE_DIM[2])
        cv.pixel(36, 55, (32, 22, 46))  # 꺼진 룬 홈
        cv.pixel(36, 56, (32, 22, 46))
        shard(cv, (21, 57), 7, 5, 84, True, ramp=STONE_DEAD, carve=False)
        shard(cv, (46, 59), 5, 4, 100, True, ramp=STONE_DEAD, carve=False)
    return cv.image()


if __name__ == "__main__":
    run("ontology-8da61312", draw, sys.argv[1:], idle_ms=180, idle_islands=6)
