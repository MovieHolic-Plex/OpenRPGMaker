#!/usr/bin/env python3
"""jp_city 동네 거점 건물 부품 — 코인 세탁소 세탁기, 신사 새전함·방울 줄·금줄, 시계. house_kit 레지스트리(PARTS)에 등록한다.
치수 근거: tiledata/jp-city/research/03-building-types-dimensions.md(코인 세탁소 전면 유리, 학교 층고 3.6m→층 38px, 拝殿 정면)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import shop_parts  # noqa: E402,F401
from house_kit import K, OL, PARTS  # noqa: E402


def washers(c, x, y, w, h):
    """코인 세탁소 전면 유리: 물러선 감실 + 유리 안쪽에 드럼 세탁기 줄(흰 상자 + 둥근 문) · 위에 건조기 줄 · 오른쪽 자동문."""
    c.R(x, y, w, h, K('tekko', -2)); c.R(x, y, w, 2, K('sumi', 1)); c.VL(x, y, h, K('sumi', 1))
    gx, gy, gw, gh = x + 2, y + 3, w - 4, h - 4
    c.R(gx, gy, gw, gh, K('tekko', 2)); c.R(gx + 1, gy + 1, gw - 2, gh - 2, K('garasu', 2))
    c.R(gx + 1, gy + 1, gw - 2, 2, K('garasu', 0))
    dx = x + w - 20                                                        # 자동문 자리
    for row, (by, bh) in enumerate(((gy + 4, 11), (gy + gh - 14, 13))):    # 위 건조기 줄 · 아래 세탁기 줄
        for bx in range(gx + 3, dx - 13, 14):
            c.R(bx, by, 13, bh, K('shiro', 1)); c.HL(bx, by, 13, K('shiro', 2)); c.VL(bx + 12, by, bh, K('tekko', 1))
            r = 3 if row == 0 else 4
            cx, cy = bx + 6, by + bh // 2 + (0 if row == 0 else 1)
            for j in range(-r, r + 1):
                for i in range(-r, r + 1):
                    d = i * i + j * j
                    if d <= r * r: c.P(cx + i, cy + j, K('tekko', -1) if d > (r - 1) ** 2 else K('garasu', -1))
            c.P(cx - 1, cy - 1, K('garasu', 2))
            c.HL(bx + 1, by + 1, 3, K('aka', 1) if row else K('sora', 1))  # 동전 투입 표시
    c.R(dx, y + h - 28, 16, 28, K('tekko', 2)); c.R(dx + 1, y + h - 27, 14, 27, K('garasu', 0))
    c.VL(dx + 7, y + h - 27, 27, K('tekko', 1)); c.VL(dx + 8, y + h - 27, 27, K('tekko', 3))
    c.R(dx - 2, y + h, 20, 2, K('tekko', -1))
    if hasattr(c, 'doors'): c.doors.append(dx + 8)
    for k in range(6): c.P(gx + 4 + k, gy + gh - 4 - k, K('garasu', 3))
    c.HL(x, y + h, w, K('hodo', 2)); c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


def saisen(c, x, y):
    """새전함 24×10(윗면 살 + 앞 판, 賽銭 글자 대신 가로 띠) — y 는 바닥선."""
    t = y - 10
    c.R(x, t, 24, 10, K('ita', 0)); c.HL(x, t, 24, K('ita', 2)); c.HL(x, t + 1, 24, K('ita', 1))
    for i in range(x + 2, x + 23, 3): c.VL(i, t, 3, K('ita', -2))                # 윗면 살
    c.HL(x, t + 4, 24, K('ita', -1)); c.R(x + 3, t + 5, 18, 2, K('kii', 0)); c.VL(x + 23, t, 10, K('ita', -2))
    c.VL(x - 1, t, 10, OL); c.VL(x + 24, t, 10, OL); c.HL(x - 1, t - 1, 26, OL)


def suzu(c, x, y, h):
    """방울 줄: 위 금방울(8×6) + 홍백 꼬인 줄 h px."""
    c.R(x - 3, y, 8, 6, K('kii', 1)); c.HL(x - 3, y, 8, K('kii', 3)); c.HL(x - 3, y + 5, 8, K('kii', -1)); c.P(x, y + 3, K('ita', -2))
    for j in range(y + 6, y + 6 + h):
        c.P(x, j, K('aka', 1) if (j // 2) % 2 else K('shiro', 2)); c.P(x + 1, j, K('shiro', 1) if (j // 2) % 2 else K('aka', 0))


def shimenawa(c, x0, x1, y):
    """금줄: 꼬인 짚 줄 3px(가운데 처짐 2px) + 지그재그 흰 종이(紙垂) 3개."""
    n = x1 - x0
    for i in range(n + 1):
        s = int(2 * (1 - ((2 * i / n) - 1) ** 2))
        for k in range(3): c.P(x0 + i, y + s + k, K('kinari', 2 if (i + k) % 3 == 0 else 1 if k < 2 else -1))
    for q in (0.25, 0.5, 0.75):
        sx = x0 + int(n * q); sy = y + 4
        for k, (dx, dy) in enumerate(((0, 0), (1, 1), (2, 2), (0, 3), (1, 4), (2, 5), (0, 6), (1, 7))):
            c.P(sx + dx, sy + dy, K('shiro', 2)); c.P(sx + dx + 1, sy + dy, K('shiro', 1))


def clock(c, cx, cy, r=6):
    """둥근 시계: 테 sumi · 흰 판 · 시침(10시)·분침(12시)."""
    for j in range(-r - 1, r + 2):
        for i in range(-r - 1, r + 2):
            d = i * i + j * j
            if d <= (r + 1) ** 2: c.P(cx + i, cy + j, OL if d > r * r else K('shiro', 2))
    c.VL(cx, cy - r + 2, r - 1, K('sumi', 1)); c.P(cx - 1, cy - 1, K('sumi', 1)); c.P(cx - 2, cy - 2, K('sumi', 1))
    c.P(cx, cy, K('aka', 0))


def posts(c, x, y, h, mat='ita'):
    """둥근 기둥 6px(왼쪽 밝음) — 신사·역 처마 기둥."""
    c.R(x, y, 6, h, K(mat, 0)); c.VL(x, y, h, K(mat, 2)); c.VL(x + 1, y, h, K(mat, 1)); c.VL(x + 5, y, h, K(mat, -2))
    c.VL(x - 1, y, h, OL); c.VL(x + 6, y, h, OL)


PARTS['washers'] = lambda cv, cx, fy, fh, f, it: washers(cv, cx + it[3], fy + it[4], it[2], fh - it[4])
PARTS['saisen'] = lambda cv, cx, fy, fh, f, it: saisen(cv, cx + it[2], fy + fh)
PARTS['suzu'] = lambda cv, cx, fy, fh, f, it: suzu(cv, cx + it[2], fy + it[3], it[4])
