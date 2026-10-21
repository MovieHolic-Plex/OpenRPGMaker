#!/usr/bin/env python3
"""숲 r6 접지 — 숲이 땅에 앉게 하는 땅 그늘(1층 숲 바닥 · 2층 숲 둘레 그늘).

버들항 숲 실측(public/assets/beodeul-ground/woodland-*-shadow.png, 2026-10-20):
  · 그림자는 나무 그림과 따로 땅에 깔린 두 단 반투명 덩이다 — 가 (30,49,27) α65, 속 (29,43,23) α115.
    버들항 잔디 위에서 잔디의 ×0.83(가)·×0.70(속) 밝기가 된다.
  · 그림자 덩이는 수관 폭만큼 넓고, 대부분(50~75%)은 나무 그림 밑에 가려진다. 보이는 부분은 줄기 사이와 오른쪽·아래 —
    보이는 그림자 중심이 나무 덩이 중심보다 오른쪽으로 +5~9px(빛이 왼쪽 위).
  · 줄기는 수관 밑으로 14~18px 드러나고 밑동이 벌어진 뿌리로 땅에 박힌다. 뿌리 줄에 밝은 풀 술이 겹친다.
jp 에서는 반투명을 못 쓰므로(계약: 알파 0/255) jp 잔디 무늬를 같은 비율로 어둡게 한 색(계약 램프 pine_bamboo/lawn_shade)으로 칸을 미리 칠한다.

그늘 영역(칸 3×3 창, 숲 칸마다):
  · 속(×0.70) = 숲 칸을 오른쪽 아래로 (+2, +3) 민 사각형 — 숲 바닥 거의 전부, 남·동 바깥 3px.
  · 가(×0.83) = 숲 칸을 오른쪽 3 · 아래 5 px 넓힌 것(위 1px 깎음) — 숲 둘레에 얇은 띠, 남·동 쪽이 넓다.
  · 두 영역을 반지름 2.6px 원판 다수결로 둥글리고, 칸 안 좌표 해시로 경계를 ±1px 흔든다(세계 좌표로 같은 규칙이라 이웃 칸과 이어진다).
숲 칸의 그림(1층 숲 바닥 오토타일)은 N·W·NW 이웃만, 숲 밖 칸의 그림(2층 둘레 그늘)은 N·W·NW·E·NE 이웃과 그 칸의 잔디 칸(3281·3282·3283)만 본다.
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_r3 as F3  # noqa: E402

T = 16
FACT = {1: 0.83, 2: 0.70, 3: 0.55}
# 그늘 코드 비트 순서(TS treeComposer 와 같다): 가운데·북·서·북서·동·북동 칸이 「그늘 덮개」(나무 그림이 반 넘게 덮은 칸)인가.
SHADE_BITS = (('C', 0, 0), ('N', 0, -1), ('W', -1, 0), ('NW', -1, -1), ('E', 1, 0), ('NE', 1, -1))
NCODES = 1 << len(SHADE_BITS)


def shade_rgb(rgb, level):
    """잔디 색 → 그늘 색(계약 lawn_shade 에 올린 값과 같은 반올림)."""
    if level == 0: return tuple(int(v) for v in rgb)
    return tuple(int(round(v * FACT[level])) for v in rgb)


def _jit(px, py, salt):
    return int(F3.hf('sj', salt, px, py) * 3) - 1


_DISK = [(dx, dy) for dy in range(-5, 6) for dx in range(-5, 6) if dx * dx + dy * dy <= 20]   # r7(2026-10-21 VQA): 모서리를 더 둥글게


def _raw(X, Y, forest):
    """(X, Y) 의 날 영역: 2 속 · 1 가 · 0 없음. 속 = 숲 덮개 칸을 (+2, +3) 민 사각형, 가 = 오른 3 · 아래 5 로 넓힌 사각형."""
    lev = 0
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            if not forest(i, j): continue
            x0, y0 = i * T, j * T
            if x0 + 2 <= X < x0 + T + 2 and y0 + 3 <= Y < y0 + T + 3: return 2
            if x0 <= X < x0 + T + 3 and y0 + 1 <= Y < y0 + T + 5: lev = 1
    return lev


_TAU = 6.283185307179586


def _wave(t, a, b):
    """칸 주기(16px) 매끄러운 흔들림 — 두 배음. 칸 안 좌표만 쓰니 이웃 칸 경계에서 값이 같아 이어진다."""
    return 2.4 * np.sin(_TAU * t / T + a) + 1.3 * np.sin(_TAU * 2 * t / T + b)


def _level0(px, py, forest):
    # 매끄러운 물결 흔들림(r8, 2026-10-21 VQA: 덩이 흔들림은 16px 마다 같은 네모 홈을 냈다) — 세로 경계는 y 로, 가로 경계는 x 로 흔든다
    jx = int(round(_wave(py, 0.7, 2.1))) + _jit(px, py, 'x') * (1 if F3.hf('sjm', 'x', px, py) > 0.6 else 0)
    jy = int(round(_wave(px, 1.9, 0.4))) + _jit(px, py, 'y') * (1 if F3.hf('sjm', 'y', px, py) > 0.6 else 0)
    core = outer = 0
    for dx, dy in _DISK:
        r = _raw(px + dx + jx, py + dy + jy, forest)
        if r == 2: core += 1
        if r >= 1: outer += 1
    n = len(_DISK)
    if core * 2 >= n: return 2
    if outer * 3 >= n: return 1
    return 0


def level_at(px, py, forest):
    """forest(i, j) — 3×3 창에서 (i, j) ∈ {-1,0,1}² 칸이 그늘 덮개인가. (px, py) 는 가운데 칸 안 픽셀. 0 잔디 · 1 가 · 2 속.
    날 영역(사각형 합)을 원판 다수결로 둥글리고(속은 반, 가는 1/3 — 가 띠가 속보다 넓게 번진다), 경계를 칸 주기 물결로 흔든다.
    마지막에 가 띠의 바깥 한 픽셀을 칸 안 해시로 성기게 해(점묘) 잔디로 녹아들게 한다."""
    L = _level0(px, py, forest)
    if L == 1 and F3.hf('sjd', 'o', px, py) < 0.45:
        if any(_level0(px + ax, py + ay, forest) == 0 for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))): return 0
    return L


def shaded_tile(base, forest):
    out = base.copy()
    for py in range(T):
        for px in range(T):
            L = level_at(px, py, forest)
            if L: out[py, px, :3] = shade_rgb(base[py, px, :3], L)
    return out


def _forest_of(code):
    pos = {(dx, dy): bool(code >> k & 1) for k, (n, dx, dy) in enumerate(SHADE_BITS)}
    return lambda i, j: pos.get((i, j), False)


def floor_tile(base, code):
    """숲 바닥 칸(1층, 불투명): 잔디 무늬를 그늘 코드대로 어둡게. code 0 = 그늘 없는 숲 바닥(잔디와 구별되게 점 두 개)."""
    out = shaded_tile(base, _forest_of(code))
    if code == 0:
        for px, py in ((4, 11), (12, 5)): out[py, px, :3] = shade_rgb(base[py, px, :3], 1)
    return out


def apron_tile(base, code):
    """숲 밖 잔디 칸(2층 덧칸): 그늘 픽셀만 불투명, 나머지 투명. 그늘이 한 픽셀도 없으면 None."""
    forest = _forest_of(code)
    out = np.zeros_like(base)
    for py in range(T):
        for px in range(T):
            L = level_at(px, py, forest)
            if L:
                out[py, px, :3] = shade_rgb(base[py, px, :3], L); out[py, px, 3] = 255
    return out if out[..., 3].any() else None


def shade_code(cov, x, y):
    """cov(x, y) — 그 칸이 그늘 덮개인가."""
    c = 0
    for k, (n, dx, dy) in enumerate(SHADE_BITS):
        if cov(x + dx, y + dy): c |= 1 << k
    return c
