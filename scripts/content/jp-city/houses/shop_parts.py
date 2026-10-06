#!/usr/bin/env python3
"""jp_city 상점·상가 부품 — house_kit 레지스트리(PARTS/ROOFS/JOINS)에 등록한다.
부품 시그니처: PARTS[k](cv, cx, fy, fh, floor, item) — cx = 칸 x(px), fy = 층 벽 위, fh = 층 높이, item = 레시피 튜플.
치수 출처: modern-style-bible §4·§10-2b(간판판 윗면 2 + 앞 12~18 + 그림자 3, 차양 윗면 7 + 앞 3 + 그림자 2, 1층 가게 물러섬)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
import jpenv  # noqa: E402,F401
import jfont  # noqa: E402
import house_kit as hk  # noqa: E402
from house_kit import K, OL, PARTS, ROOFS, JOINS, JOIN_H, hip_roof, gable_front  # noqa: E402
from modern_style_bible_proof import vending  # noqa: E402

GOODS = {
    'veg':    [('midori', 1), ('aka', 0), ('daidai', 1), ('kii', 1), ('midori', 0), ('murasaki', 0)],
    'fruit':  [('aka', 1), ('daidai', 2), ('kii', 2), ('midori', 2), ('pinku', 2)],
    'fish':   [('tekko', 2), ('sora', 2), ('tekko', 3), ('daidai', 2)],
    'meat':   [('pinku', 1), ('aka', 1), ('pinku', 2), ('renga', 1)],
    'flower': [('aka', 2), ('kii', 3), ('pinku', 3), ('murasaki', 3), ('shiro', 2), ('daidai', 2)],
    'sake':   [('midori', -1), ('ita', -1), ('sora', -1), ('kinari', 1)],
    'bread':  [('yuka', 2), ('yuka', 1), ('kii', 0), ('yuka', 3)],
    'sweets': [('pinku', 3), ('kinari', 2), ('midori', 2), ('yuka', 2), ('shiro', 2)],
    'books':  [('aka', 0), ('sora', 1), ('kii', 1), ('midori', 1), ('kon', 2), ('shiro', 1)],
    'drug':   [('shiro', 2), ('sora', 2), ('pinku', 2), ('midori', 2), ('kii', 2)],
    'mart':   [('aka', 1), ('kii', 2), ('midori', 2), ('sora', 2), ('daidai', 2), ('shiro', 2)],
    'tools':  [('tekko', 2), ('aka', 0), ('kii', 1), ('tekko', 0)],
}


def text(c, x, y, s, col, step=17):
    """16x16 글자를 step 간격으로 찍는다(glyphs.json)."""
    for i, ch in enumerate(s):
        if ch == ' ': continue
        g = jfont.glyph(ch)
        for j in range(16):
            for k in range(16):
                if g[j, k]: c.P(x + i * step + k, y + j, col)


def text_w(s, step=17):
    return step * len(s) - (step - 16)


# ─────────────────────────── 간판·차양·노렌 ───────────────────────────
def sign(c, x, y, w, s, bg='sora', fg=('shiro', 2), h=20, frame=True):
    """간판판: 윗면 2(+2/+1) · 앞면 h(bg 0, 테 -2) · 아래 그림자 3 (벽 위)."""
    c.HL(x, y, w, K(bg, 2)); c.HL(x, y + 1, w, K(bg, 1))
    c.R(x, y + 2, w, h, K(bg, 0))
    if frame:
        c.HL(x + 1, y + 3, w - 2, K(bg, 1)); c.HL(x + 1, y + h, w - 2, K(bg, -1)); c.VL(x + w - 2, y + 3, h - 2, K(bg, -1)); c.VL(x + 1, y + 3, h - 2, K(bg, 1))
    c.HL(x, y + h + 2, w, K(bg, -2))
    c.HL(x - 1, y - 1, w + 2, OL); c.VL(x - 1, y, h + 3, OL); c.VL(x + w, y, h + 3, OL); c.HL(x - 1, y + h + 3, w + 2, OL)
    if s:
        tw = text_w(s)
        text(c, x + (w - tw) // 2, y + 2 + (h - 16) // 2 + 1, s, K(*fg))
    return y + h + 4


def wall_shadow(c, x, y, w, floor, n=3):
    m, b = floor['mat'], floor['base']
    for k in range(n): c.HL(x, y + k, w, K(m, b - 3 + k) if k < 3 else K(m, b - 1))


def awning(c, x, y, w, col='aka', stripe=True, floor=None):
    """차양: 앞으로 튀어나온 윗면 7(줄무늬) · 앞 가장자리 3(물결 끝) · 벽 그림자 2."""
    for i in range(w):
        st = (i // 4) % 2 if stripe else 0
        for j in range(7):
            t = (2 if st else 1) - (1 if j >= 5 else 0)
            if not stripe: t = 1 + (1 if j < 2 else 0) - (1 if j >= 5 else 0)
            c.P(x + i, y + j, K(col if (st or not stripe) else 'shiro', t if (st or not stripe) else (2 if j < 5 else 1)))
        for j in range(3):
            c.P(x + i, y + 7 + j, K(col, 0 if j < 2 else -1))
        if i % 6 in (2, 3): c.P(x + i, y + 10, K(col, -1))           # 물결 끝
    c.HL(x - 1, y - 1, w + 2, OL); c.VL(x - 1, y, 10, OL); c.VL(x + w, y, 10, OL)
    for i in range(w):
        if i % 6 not in (2, 3): c.P(x + i, y + 10, OL)
        else: c.P(x + i, y + 11, OL)
    if floor:
        wall_shadow(c, x, y + 12, w, floor, 2)
    return y + 12


def noren(c, x, y, w, col='kon', s='', h=18):
    """노렌: 봉(tekko) + 천(갈라진 폭 w/n) + 흰 글자."""
    c.HL(x - 2, y, w + 4, K('ita', 2)); c.HL(x - 2, y + 1, w + 4, K('ita', -1)); c.HL(x - 3, y - 1, w + 6, OL)
    n = max(2, w // 8)
    for i in range(w):
        gap = any(i == round(w * k / n) for k in range(1, n))
        for j in range(h):
            if gap and j > 3: continue
            t = 0 if j < h - 2 else -1
            if (i * n // w) % 2 == 0 and j < 2: t += 1
            c.P(x + i, y + 2 + j, K(col, t))
        if not gap: c.P(x + i, y + 2 + h, OL)
    c.VL(x - 1, y + 2, h, OL); c.VL(x + w, y + 2, h, OL)
    if s:
        tw = text_w(s)
        text(c, x + (w - tw) // 2, y + 3, s, K('shiro', 2))


def lantern(c, x, y, s='', col='aka'):
    """赤提灯 10x14: 위아래 검은 테 · 몸통 가로 줄 · 가운데 글자 대신 흰 줄."""
    c.R(x + 2, y, 6, 2, K('sumi', 1)); c.R(x + 2, y + 12, 6, 2, K('sumi', 1))
    for j in range(2, 12):
        half = 5 if 3 <= j <= 10 else 4
        for i in range(5 - half, 5 + half):
            t = 1 if i < 4 else 0 if i < 7 else -1
            if j % 3 == 0: t -= 1
            c.P(x + i, y + j, K(col, t))
        c.P(x + 5 - half - 1, y + j, OL); c.P(x + 5 + half, y + j, OL)
    c.VL(x + 4, y + 4, 6, K('shiro', 1)); c.VL(x + 5, y + 4, 6, K('shiro', 0))
    c.VL(x + 4, y - 3, 3, K('tekko', -1))


def barber(c, x, y):
    """理容 사인폴 6x18."""
    c.R(x, y, 6, 3, K('tekko', 3)); c.R(x, y + 15, 6, 3, K('tekko', 1))
    for j in range(3, 15):
        for i in range(1, 5):
            k = (i + j) % 6
            col = ('aka', 1) if k < 2 else ('sora', 2) if k < 4 else ('shiro', 2)
            c.P(x + i, y + j, K(*col))
        c.P(x, y + j, OL); c.P(x + 5, y + j, OL)
    c.HL(x, y - 1, 6, OL); c.HL(x, y + 18, 6, OL)


def pots(c, x, y, n=3):
    """화분 줄: 화분 6x5 + 잎 덩이."""
    for k in range(n):
        px = x + k * 8
        c.R(px, y + 6, 6, 5, K('renga', 1)); c.HL(px, y + 6, 6, K('renga', 3)); c.VL(px + 5, y + 7, 4, K('renga', -1))
        for (dx, dy, t) in ((1, 2, 2), (2, 1, 1), (3, 2, 0), (4, 3, -1), (2, 3, 1), (0, 4, 0), (5, 4, -1), (1, 4, 1), (3, 4, 0), (4, 1, 1)):
            c.P(px + dx, y + dy + 1, K('ki', t))
        c.HL(px, y + 11, 6, OL)


def bikes(c, x, y, n=2):
    """자전거 옆모습 18x11(정면 고정 시점에서 길 따라 세운 것)."""
    for k in range(n):
        bx = x + k * 10
        for (cx_, cy) in ((bx + 3, y + 7), (bx + 13, y + 7)):
            for a in range(-3, 4):
                for b in range(-3, 4):
                    if 7 <= a * a + b * b <= 12: c.P(cx_ + a, cy + b, K('sumi', 1))
        c.HL(bx + 4, y + 4, 8, K('aka', 1)); c.P(bx + 7, y + 5, K('aka', 0)); c.P(bx + 8, y + 6, K('aka', 0))
        c.VL(bx + 12, y + 2, 4, K('tekko', 2)); c.HL(bx + 11, y + 1, 4, K('tekko', 3)); c.HL(bx + 3, y + 3, 3, K('sumi', 2))
        c.R(bx + 13, y + 1, 4, 3, K('tekko', 1))


def crates(c, x, y, n=3, col='kii'):
    """빈 상자(맥주 상자) 쌓음 8x6."""
    for k in range(n):
        px, py = x + (k % 2) * 9, y - (k // 2) * 6
        c.R(px, py, 8, 6, K(col, 0)); c.HL(px, py, 8, K(col, 2)); c.VL(px + 7, py, 6, K(col, -2))
        for i in range(px + 1, px + 7, 2): c.P(i, py + 1, K(col, -2))
        c.HL(px, py + 6, 8, OL)


# ─────────────────────────── 1층 가게 정면 ───────────────────────────
def shop_glass(c, x, y, w, h, goods='mart', door='mid'):
    """유리 쇼윈도 + 자동문: 8px 물러선 감실(위 2줄 -2, 다음 2줄 -1, 왼쪽 2칸 -1) · 알루미늄 틀 · 안쪽 진열 선반."""
    c.R(x, y, w, h, K('tekko', -2)); c.R(x, y, w, 2, K('sumi', 1)); c.VL(x, y, h, K('sumi', 1))
    gx, gy, gw, gh = x + 2, y + 3, w - 4, h - 4
    c.R(gx, gy, gw, gh, K('tekko', 2))
    c.R(gx + 1, gy + 1, gw - 2, gh - 2, K('garasu', 1))
    c.R(gx + 1, gy + 1, gw - 2, 2, K('garasu', -1)); c.VL(gx + 1, gy + 1, gh - 2, K('garasu', 0))
    cols = GOODS[goods]
    for row, sy in enumerate(range(gy + 5, gy + gh - 4, 6)):        # 선반 줄
        c.HL(gx + 2, sy + 4, gw - 4, K('tekko', 0))
        for i in range(gx + 3, gx + gw - 3, 3):
            m, t = cols[(i // 3 + row * 2) % len(cols)]
            c.R(i, sy + 1, 2, 3, K(m, t)); c.P(i, sy + 1, K(m, t + 1))
    for i in range(0, gw - 6, 16):
        c.VL(gx + i, gy, gh, K('tekko', 2)); c.VL(gx + i + 1, gy, gh, K('tekko', 0))
    if door:
        dx = x + (w - 16) // 2 if door == 'mid' else x + (w - 20 if door == 'right' else 4)
        c.R(dx, y + h - 28, 16, 28, K('tekko', 2)); c.R(dx + 1, y + h - 27, 14, 27, K('garasu', 0))
        c.VL(dx + 7, y + h - 27, 27, K('tekko', 1)); c.VL(dx + 8, y + h - 27, 27, K('tekko', 3))
        for k in range(5): c.P(dx + 2 + k, y + h - 8 - k, K('garasu', 2))
        c.R(dx - 2, y + h, 20, 2, K('tekko', -1))                   # 매트
        if hasattr(c, 'doors'): c.doors.append(dx + 8)
    for k in range(6): c.P(gx + 4 + k, gy + gh - 4 - k, K('garasu', 3))
    c.HL(x, y + h, w, K('hodo', 2)); c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


def shop_open(c, x, y, w, h, goods='veg'):
    """열린 가게(八百屋·魚屋): 말아 올린 셔터 상자 + 어두운 안 + 안쪽 선반 + 앞 판매대(윗면 4 + 앞 6)에 상품."""
    c.R(x, y, w, h, K('yoru', -1))
    c.R(x, y, w, 4, K('tekko', 1)); c.HL(x, y, w, K('tekko', 3)); c.HL(x, y + 3, w, K('tekko', -2))      # 셔터 상자
    cols = GOODS[goods]
    for sy in (y + 7, y + 13):                                                                          # 안쪽 선반
        c.HL(x + 2, sy + 4, w - 4, K('ita', 0))
        for i in range(x + 3, x + w - 3, 3):
            m, t = cols[(i // 3 + sy) % len(cols)]
            c.R(i, sy + 1, 2, 3, K(m, t - 1))
    c.R(x + 3, y + 4, w - 6, 2, K('yoru', -3))
    ty = y + h - 11                                                                                     # 판매대
    c.R(x + 1, ty, w - 2, 5, K('ita', 2)); c.HL(x + 1, ty, w - 2, K('ita', 3))
    c.R(x + 1, ty + 5, w - 2, 6, K('ita', 0)); c.HL(x + 1, ty + 10, w - 2, K('ita', -2))
    for i in range(x + 2, x + w - 4, 4):
        c.VL(i, ty + 6, 4, K('ita', -1))
    if goods == 'fish':
        c.R(x + 2, ty, w - 4, 4, K('shiro', 1))
        for i in range(x + 3, x + w - 8, 7):
            c.HL(i, ty + 1, 5, K('tekko', 2)); c.HL(i + 1, ty + 2, 4, K('tekko', 0)); c.P(i, ty + 1, K('sumi', 1)); c.P(i + 5, ty + 2, K('tekko', 1))
    else:
        for i in range(x + 3, x + w - 5, 5):                                                            # 바구니 + 상품 무더기
            m, t = cols[(i // 5) % len(cols)]
            c.R(i, ty + 1, 4, 3, K(m, t)); c.P(i, ty + 1, K(m, t + 1)); c.P(i + 1, ty, K(m, t + 1)); c.P(i + 2, ty, K(m, t))
            c.HL(i, ty + 4, 4, K('ita', -1))
    c.HL(x - 1, y + h, w + 2, K('hodo', 2)); c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)
    if hasattr(c, 'doors'): c.doors.append(x + w // 2)


def kiosk(c, x, y):
    """たばこ屋 창구 24x16: 미닫이 유리 + 앞 진열대."""
    c.R(x, y, 24, 16, K('tekko', 2)); c.R(x + 1, y + 1, 22, 10, K('garasu', 0)); c.VL(x + 12, y + 1, 10, K('tekko', 3))
    for i in range(x + 2, x + 22, 3): c.R(i, y + 3, 2, 3, K(('aka', 'sora', 'shiro', 'midori')[(i // 3) % 4], 1))
    c.R(x - 1, y + 11, 26, 3, K('ita', 2)); c.HL(x - 1, y + 11, 26, K('ita', 3)); c.R(x - 1, y + 14, 26, 2, K('ita', -1))
    c.VL(x - 2, y, 16, OL); c.VL(x + 25, y, 16, OL); c.HL(x - 2, y + 16, 28, OL)


def post_box(c, x, y):
    """빨간 우체통 10x18(둥근 머리)."""
    c.R(x + 1, y + 3, 8, 13, K('aka', 1)); c.HL(x + 2, y + 2, 6, K('aka', 2)); c.HL(x + 3, y + 1, 4, K('aka', 3))
    c.VL(x + 1, y + 3, 13, K('aka', 2)); c.VL(x + 8, y + 3, 13, K('aka', -1)); c.HL(x + 3, y + 6, 4, K('sumi', 1))
    c.R(x + 3, y + 16, 4, 2, K('tekko', -1))
    c.VL(x, y + 3, 13, OL); c.VL(x + 9, y + 3, 13, OL); c.HL(x + 3, y, 4, OL); c.P(x + 1, y + 2, OL); c.P(x + 8, y + 2, OL)


def red_lamp(c, x, y):
    """交番 빨간 등 6x6."""
    c.R(x + 1, y + 1, 4, 4, K('aka', 2)); c.P(x + 2, y + 2, K('aka', 3)); c.R(x, y + 5, 6, 1, K('tekko', 1))
    c.HL(x + 1, y, 4, OL); c.VL(x, y + 1, 4, OL); c.VL(x + 5, y + 1, 4, OL)


def canopy(c, x, y, w, mat='conc'):
    """평 캐노피(현관 위 차양판): 윗면 6 + 앞 3 + 벽 그림자 3."""
    c.R(x, y, w, 6, K(mat, 2)); c.HL(x, y, w, K(mat, 3)); c.R(x, y + 6, w, 3, K(mat, 0)); c.HL(x, y + 8, w, K(mat, -2))
    c.HL(x - 1, y - 1, w + 2, OL); c.VL(x - 1, y, 9, OL); c.VL(x + w, y, 9, OL); c.HL(x - 1, y + 9, w + 2, OL)


def karahafu(c, x, y, w, mat='tairu', base=0):
    """唐破風(목욕탕 현관 지붕): 가운데가 솟은 곡선 처마 + 흰 破風 + 아래 그림자."""
    import math
    for i in range(w):
        u = (i - w / 2) / (w / 2)
        bump = round(7 * math.exp(-(u * 2.2) ** 2) - 2 * abs(u))
        top = y + 6 - bump
        for j in range(top, y + 12):
            k = (j - top) % 3
            c.P(x + i, j, K(mat, base + (1 if k == 0 else -1 if k == 2 else 0) + (1 if u < 0 else 0)))
        c.P(x + i, top - 1, OL)
        c.P(x + i, y + 12, K('shiro', 1)); c.P(x + i, y + 13, K('shiro', -1)); c.P(x + i, y + 14, OL)
    c.VL(x - 1, y + 4, 11, OL); c.VL(x + w, y + 4, 11, OL)


def chimney(c, x, ybot, h, w=12):
    """목욕탕 굴뚝(벽돌, 위로 가늘어짐 없음, 위 테 2줄)."""
    for j in range(ybot - h, ybot):
        for i in range(w):
            t = 1 if i < 3 else -1 if i >= w - 3 else 0
            if (j - ybot) % 4 == 0 or (i + (2 if (j // 4) % 2 else 0)) % 6 == 0: t -= 1
            c.P(x + i, j, K('renga', t))
        c.P(x - 1, j, OL); c.P(x + w, j, OL)
    c.R(x - 1, ybot - h, w + 2, 3, K('tekko', 1)); c.HL(x - 1, ybot - h, w + 2, K('tekko', 3)); c.HL(x - 2, ybot - h - 1, w + 4, OL)
    c.VL(x - 2, ybot - h, 3, OL); c.VL(x + w + 1, ybot - h, 3, OL)
    text(c, x + (w - 16) // 2, ybot - h + 8, '', 0)


# ─────────────────────────── PARTS 등록 ───────────────────────────
def _p_sign(cv, cx, fy, fh, f, it):
    # ('sign', 칸, 폭, 글자, 바탕, 글자색튜플, y오프셋[, 높이])
    sign(cv, cx + it[7] if len(it) > 8 else cx, fy + it[6], it[2], it[3], it[4], it[5], it[8] if len(it) > 8 else 20) if False else \
        sign(cv, cx, fy + it[6], it[2], it[3], it[4], it[5], it[7] if len(it) > 7 else 20)
    wall_shadow(cv, cx, fy + it[6] + (it[7] if len(it) > 7 else 20) + 4, it[2], f, 2)


PARTS['sign'] = _p_sign
PARTS['awning'] = lambda cv, cx, fy, fh, f, it: awning(cv, cx + it[4], fy + it[5], it[2], it[3], it[6] if len(it) > 6 else True, f)
PARTS['noren'] = lambda cv, cx, fy, fh, f, it: noren(cv, cx + it[5], fy + (it[6] if len(it) > 6 else fh - 29), it[2], it[3], it[4])
PARTS['lantern'] = lambda cv, cx, fy, fh, f, it: lantern(cv, cx + it[2], fy + it[3])
PARTS['barber'] = lambda cv, cx, fy, fh, f, it: barber(cv, cx + it[2], fy + fh - 22)
PARTS['pots'] = lambda cv, cx, fy, fh, f, it: pots(cv, cx + it[2], fy + fh - 11, it[3])
PARTS['bikes'] = lambda cv, cx, fy, fh, f, it: bikes(cv, cx + it[2], fy + fh - 10, it[3])
PARTS['crates'] = lambda cv, cx, fy, fh, f, it: crates(cv, cx + it[2], fy + fh - 6, it[3], it[4] if len(it) > 4 else 'kii')
PARTS['vend'] = lambda cv, cx, fy, fh, f, it: vending(cv, cx + it[2], fy + fh - 26)
PARTS['shopglass'] = lambda cv, cx, fy, fh, f, it: shop_glass(cv, cx + it[4], fy + it[5], it[2], fh - it[5], it[3], it[6] if len(it) > 6 else 'mid')
PARTS['shopopen'] = lambda cv, cx, fy, fh, f, it: shop_open(cv, cx + it[4], fy + it[5], it[2], fh - it[5], it[3])
PARTS['kiosk'] = lambda cv, cx, fy, fh, f, it: kiosk(cv, cx + it[2], fy + fh - 18)
PARTS['postbox'] = lambda cv, cx, fy, fh, f, it: post_box(cv, cx + it[2], fy + fh - 18)
PARTS['redlamp'] = lambda cv, cx, fy, fh, f, it: red_lamp(cv, cx + it[2], fy + it[3])
PARTS['canopy'] = lambda cv, cx, fy, fh, f, it: canopy(cv, cx + it[3], fy + it[4], it[2], it[5] if len(it) > 5 else 'conc')
PARTS['karahafu'] = lambda cv, cx, fy, fh, f, it: karahafu(cv, cx + it[3], fy + it[4], it[2], it[5] if len(it) > 5 else 'tairu')


# ─────────────────────────── 지붕·층 사이 ───────────────────────────
def irimoya(cv, X0, X1, top, h, r, opt):
    """入母屋: 아래 寄棟 치마(짧은 隅棟) + 위로 한 단 좁은 平入り 切妻 덩어리. 두 단 실루엣이 핵심."""
    m, b = r['rmat'], r['rbase']
    ytop = 10; ymid = ytop + (top - 4 - ytop) * 9 // 20
    inset = opt.get('inset', 18)
    hip_roof(cv, X0 - 4, X1 + 4, ymid, top - 4, inset, m, b)
    hk.gable_side(cv, X0 - 4 + inset - 4, X1 + 4 - inset + 4, ytop, ymid + 1, m, b + 1)


def sawtooth(cv, X0, X1, top, h, r, opt):
    """鋸屋根(공장): 앞면 위가 톱니. 이빨마다 왼쪽 완경사 지붕 띠(뒤로 depth) + 오른쪽 수직 유리 띠."""
    n = opt.get('n', 3); tw = (X1 - X0 + 1) // n; rise = opt.get('rise', 16); depth = opt.get('depth', 10)
    m, b = r['rmat'], r['rbase']
    for k in range(n):
        x0 = X0 + k * tw
        for i in range(tw):
            ey = top - round(rise * i / (tw - 4)) if i < tw - 4 else top - rise
            for y in range(ey, top):                                           # 앞 박공벽(톱니 단면)
                cv.P(x0 + i, y, K('conc', 0 if i < tw - 4 else -1))
            for y in range(ey - depth, ey):
                if i < tw - 4:
                    cv.P(x0 + i, y, K(m, b + (1 if i % 4 == 1 else -1 if i % 4 == 3 else 0) + 1))
                else:
                    cv.P(x0 + i, y, K('garasu', 1 if y % 3 else 0))
            cv.P(x0 + i, ey - depth - 1, OL)
        cv.VL(x0 + tw - 4, top - rise - depth, rise + depth, OL)
    cv.VL(X0 - 1, top - depth - 1, depth + 1, OL); cv.VL(X1 + 1, top - rise - depth - 1, rise + depth + 1, OL)


def gable_front_big(cv, X0, X1, top, h, r, opt):
    f = r['floors'][-1]
    gable_front(cv, X0, X1, top, opt.get('rise', 34), opt.get('depth', 14), r['rmat'], r['rbase'], f['mat'], f['base'], f['kind'])


def flat_sign(cv, X0, X1, top, h, r, opt):
    """평지붕 + 옥상 간판탑(雑居ビル): 윗면 + 앞 난간 위로 세운 간판."""
    hk.flat_roof(cv, X0, X1, top - h, top, opt.get('mat', 'conc'), opt.get('items', ()))
    s, bg = opt['sign'], opt.get('bg', 'aka')
    w = hk.C * opt.get('sw', 4)
    sx = X0 + opt.get('sx', 1) * hk.C
    sign(cv, sx, top - h - 6, w, s, bg, ('shiro', 2))
    for px in (sx + 4, sx + w - 6):
        cv.R(px, top - h + 17, 2, 8, K('tekko', 0))


ROOFS['irimoya'] = irimoya
ROOFS['sawtooth'] = sawtooth
ROOFS['gable_front_big'] = gable_front_big
ROOFS['flat_sign'] = flat_sign
hk.ROOF_H.update({'irimoya': 46, 'sawtooth': 28, 'gable_front_big': 50, 'flat_sign': 32})


def balcony_row(cv, X0, X1, jy, opt, r):
    """맨션 발코니 줄: 슬래브 앞면 4 + 콘크리트 판 난간 12(위 캡 2) + 세대 칸막이."""
    unit = opt.get('unit', 3) * hk.C
    mat = opt.get('mat', 'conc'); col = opt.get('panel', 'conc')
    ry = jy - 12
    cv.R(X0 - 2, ry, X1 - X0 + 5, 12, K(col, 1)); cv.HL(X0 - 2, ry, X1 - X0 + 5, K(col, 3)); cv.HL(X0 - 2, ry + 1, X1 - X0 + 5, K(col, 2))
    for x in range(X0 - 2, X1 + 3):
        if (x - X0) % 8 == 0: cv.VL(x, ry + 3, 9, K(col, 0))
    for x in range(X0 + unit, X1, unit):
        cv.R(x - 1, ry - 10, 2, 10, K('shiro', 1)); cv.VL(x, ry - 10, 10, K('shiro', -1))       # 칸막이(위로 튀어나온 판)
    cv.HL(X0 - 2, jy, X1 - X0 + 5, K(mat, 2)); cv.R(X0 - 2, jy + 1, X1 - X0 + 5, 2, K(mat, 0)); cv.HL(X0 - 2, jy + 3, X1 - X0 + 5, K(mat, -2))
    cv.HL(X0 - 3, ry - 1, X1 - X0 + 7, OL); cv.VL(X0 - 3, ry, 16, OL); cv.VL(X1 + 3, ry, 16, OL); cv.HL(X0 - 3, jy + 4, X1 - X0 + 7, OL)


def shop_band(cv, X0, X1, jy, opt, r):
    """1층 가게 위 띠(슬래브 4)."""
    hk.belt(cv, X0, jy, X1 - X0 + 1, opt.get('mat', 'conc'))


JOINS['balcony_row'] = balcony_row
JOINS['shop_band'] = shop_band
JOIN_H.update({'balcony_row': 4, 'shop_band': 4})


# ─────────────────────────── 추가 부품(2차) ───────────────────────────
GOODS['paper'] = [('shiro', 2), ('shiro', 1), ('kinari', 2), ('shiro', 2)]


def carport(c, x, yb, w, h=30):
    """카포트: 가는 기둥 2 + 반투명 대신 garasu 판 지붕(윗면 6 + 앞 2) + 바닥 그림자."""
    ty = yb - h
    c.R(x, ty, w, 6, K('garasu', 2)); c.HL(x, ty, w, K('garasu', 3)); c.R(x, ty + 6, w, 2, K('tekko', 1))
    for i in range(x + 3, x + w - 2, 6): c.VL(i, ty + 1, 5, K('garasu', 1))
    c.HL(x - 1, ty - 1, w + 2, OL); c.HL(x - 1, ty + 8, w + 2, OL); c.VL(x - 1, ty, 8, OL); c.VL(x + w, ty, 8, OL)
    for px in (x + 2, x + w - 5):
        c.R(px, ty + 8, 3, h - 8, K('tekko', 1)); c.VL(px, ty + 8, h - 8, K('tekko', 3)); c.VL(px + 3, ty + 8, h - 8, OL)
    c.R(x + 2, yb - 2, w - 4, 2, K('hodo', 0))


def mushiko(c, x, y, w, h=10):
    """虫籠窓(町家 2층 회벽 세로 살창)."""
    c.R(x, y, w, h, K('sumi', 2)); c.R(x, y, w, 2, K('sumi', 1))
    for i in range(x + 1, x + w - 1, 3): c.VL(i, y + 1, h - 1, K('shiro', 1)); c.VL(i + 1, y + 1, h - 1, K('shiro', -1))
    c.HL(x - 1, y + h, w + 2, K('shiro', 2)); c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL); c.HL(x - 1, y - 1, w + 2, OL)


def vsign(c, x, y, s, bg='aka', fg=('kii', 3)):
    """벽에 붙인 세로 간판: 폭 20, 글자마다 17px."""
    h = 17 * len(s) + 3
    c.R(x, y, 20, h, K(bg, 0)); c.VL(x, y, h, K(bg, 2)); c.VL(x + 1, y, h, K(bg, 1)); c.VL(x + 19, y, h, K(bg, -2))
    c.HL(x, y, 20, K(bg, 2)); c.HL(x, y + h - 1, 20, K(bg, -2))
    for k, ch in enumerate(s): text(c, x + 2, y + 2 + k * 17, ch, K(*fg))
    c.VL(x - 1, y, h, OL); c.VL(x + 20, y, h, OL); c.HL(x - 1, y - 1, 22, OL); c.HL(x - 1, y + h, 22, OL)
    c.VL(x + 21, y + 1, h, K('conc', -2))


def stairwell(c, x, y, h, w=16):
    """団地 계단실: 벽 개구부 안 어두운 계단(사선) + 난간."""
    c.R(x, y, w, h, K('yoru', -1)); c.R(x, y, w, 2, K('yoru', -3))
    for k in range(0, h - 4, 3):
        c.HL(x + 2 + (k * (w - 6)) // h, y + h - 3 - k, 4, K('conc', -1))
    c.HL(x, y + h - 10, w, K('conc', 1)); c.HL(x, y + h - 9, w, K('conc', -1))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)
    if getattr(c, 'floor_i', 1) == 0 and hasattr(c, 'doors'): c.doors.append(x + w // 2)


def band_stripe(c, x, y, w, cols=(('midori', 1), ('shiro', 2), ('sora', 1))):
    """편의점 띠(세 줄 색띠) 10px."""
    hh = [3, 4, 3]
    yy = y
    for (m, t), n in zip(cols, hh):
        c.R(x, yy, w, n, K(m, t)); c.HL(x, yy, w, K(m, t + 1)); yy += n
    c.HL(x - 1, y - 1, w + 2, OL); c.HL(x - 1, yy, w + 2, OL); c.VL(x - 1, y, 10, OL); c.VL(x + w, y, 10, OL)


def curtain_wall(c, x, y, w, h, mat='garasu'):
    """유리 커튼월: 16px 멀리언 + 층 스팬드럴."""
    c.R(x, y, w, h, K(mat, 0))
    for j in range(h):
        if j % 14 in (0, 1): c.HL(x, y + j, w, K('tekko', 2 if j % 14 == 0 else 0))
    for i in range(0, w, 16):
        c.VL(x + i, y, h, K('tekko', 2)); c.VL(x + i + 1, y, h, K('tekko', 0))
    for i in range(x + 3, x + w - 6, 16):
        for k in range(6): c.P(i + k, y + 11 - k, K(mat, 2))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


_wall0 = hk.wall
def _wall(c, x, y, w, h, mat, base, kind):
    if kind == 'curtain':
        curtain_wall(c, x, y, w, h, 'garasu'); return
    _wall0(c, x, y, w, h, mat, base, kind)
hk.wall = _wall

PARTS['carport'] = lambda cv, cx, fy, fh, f, it: carport(cv, cx + it[3], fy + fh, it[2], it[4] if len(it) > 4 else 30)
PARTS['mushiko'] = lambda cv, cx, fy, fh, f, it: mushiko(cv, cx + it[3], fy + it[4], it[2], it[5] if len(it) > 5 else 10)
PARTS['vsign'] = lambda cv, cx, fy, fh, f, it: vsign(cv, cx + it[2], fy + it[3], it[4], it[5] if len(it) > 5 else 'aka', it[6] if len(it) > 6 else ('kii', 3))
PARTS['stairwell'] = lambda cv, cx, fy, fh, f, it: stairwell(cv, cx + it[2], fy + 4, fh - 4, it[3] if len(it) > 3 else 16)
PARTS['band'] = lambda cv, cx, fy, fh, f, it: band_stripe(cv, cx, fy + it[3], it[2], it[4] if len(it) > 4 else (('midori', 1), ('shiro', 2), ('sora', 1)))
PARTS['carport_fl'] = PARTS['carport']
