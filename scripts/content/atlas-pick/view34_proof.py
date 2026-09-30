#!/usr/bin/env python3
"""3/4 view 계약(modern-style-bible.md 10절)을 지킨 손 도트 증명 그림. 16px, modern3 램프만.
  python3 scripts/content/atlas-pick/view34_proof.py   # tiledata/atlas-pick/style-demo-view34/*.png
계약 요약: 바닥은 위에서 본 1:1(16px 칸). 물체는 윗면(깊이 D 칸 = D×16px) 위에 앞면(높이) 을 붙인다.
옆면은 보이지 않는다(정면 위에서 본 사투영). 그림자 = 같은 램프의 낮은 단, 빛은 왼쪽 위.
같은 구도를 old(정면 도면: 지붕 12px 띠) 와 new(3/4) 로 찍어 나란히 비교한다."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modern_style_bible_proof import (K, Cv, RAMPS, slab, wall_fill, window, door, awning, ac_unit, hero,
                                      car as old_car, vending as old_vending, signal as old_signal, tree as old_tree)
from common import BASE
from PIL import Image

OUT = os.path.join(BASE, 'style-demo-view34')
REV = {}
for _n, _r in RAMPS.items():
    for _i, _h in enumerate(_r): REV.setdefault(_h, (_n, _i))

def hexof(c, x, y):
    p = c.a[y, x]; return (int(p[0]) << 16) | (int(p[1]) << 8) | int(p[2])

def lower(c, x, y, n):
    """그 자리 색을 같은 램프의 n 단 낮춘다(그림자). 빈 칸이면 그대로."""
    if not (0 <= x < c.w and 0 <= y < c.h) or c.a[y, x, 3] == 0: return
    h = hexof(c, x, y)
    if h not in REV: return
    nm, i = REV[h]; c.P(x, y, RAMPS[nm][max(0, i - n)])

def shade(c, x, y, w, h, n):
    for j in range(h):
        for i in range(w): lower(c, x + i, y + j, n)

def ell_shade(c, cx, cy, rx, ry, n):
    """타원 그림자 — 상자 그림자는 바닥에 네모 얼룩이 남는다(적대 검수 1회차)."""
    for j in range(-ry, ry + 1):
        for i in range(-rx, rx + 1):
            if (i / rx) ** 2 + (j / ry) ** 2 <= 1: lower(c, cx + i, cy + j, n)

def blit(dst, src, x, y):
    for j in range(src.h):
        for i in range(src.w):
            if src.a[j, i, 3]: dst.a[y + j, x + i] = src.a[j, i]

def new(w, h): return Cv(w, h)

# ───────────────────────── 지붕(윗면 = 깊이 D×16) ─────────────────────────
def roof_box(c, x, base, ow, od, oh, mat='tekko', kind='ac'):
    """지붕 위 물체. 바닥 앞선 base(=앞면 아래). 윗면 = od 줄(깊이), 앞면 = oh 줄(높이). 그림자는 지붕 바닥에 오른쪽·아래 3px."""
    fy = base - oh; ty = fy - od                     # 앞면 윗선, 윗면 윗선
    shade(c, x + 2, base, ow + 3, 3, 2); shade(c, x + ow, base - od + 2, 3, od + 1, 2)      # 바닥 그림자(-2)
    c.R(x, ty, ow, od, K(mat, 2)); c.HL(x, ty, ow, K(mat, 3)); c.VL(x, ty, od, K(mat, 3))    # 윗면 +2, 뒤 모서리 +3
    c.R(x, fy, ow, oh, K(mat, 0)); c.VL(x, fy, oh, K(mat, 1)); c.VL(x + ow - 1, fy, oh, K(mat, -1))   # 앞면 0
    c.HL(x, fy, ow, K(mat, 1)); c.HL(x, base - 1, ow, K(mat, -2))
    if kind == 'ac':                                 # 실외기: 팬 원
        c.R(x + 3, fy + 2, ow - 6, oh - 3, K(mat, -1)); c.R(x + 4, fy + 3, ow - 8, oh - 5, K(mat, 0)); c.P(x + ow // 2 - 1, fy + oh // 2, K(mat, -2)); c.P(x + ow // 2, fy + oh // 2, K(mat, -2))
    elif kind == 'door':                             # 옥탑 계단실: 문
        c.R(x + ow // 2 - 3, fy + 3, 6, oh - 3, K(mat, -2)); c.VL(x + ow // 2 - 3, fy + 3, oh - 3, K(mat, -3))

def roof_tank(c, x, base, r_w=12):
    """물탱크(원통): 윗면 = 타원 r_w × 8 (+2), 몸 12 (0/-1 세로 결), 뒤 받침 다리."""
    body = 12; top = 8; fy = base - body; ty = fy - top // 2
    shade(c, x + 2, base, r_w + 3, 3, 2); shade(c, x + r_w, base - top + 2, 3, top + 1, 2)
    for j in range(top):                                   # 윗면 타원
        inset = (2, 1, 0, 0, 0, 0, 1, 2)[j]
        c.R(x + inset, fy - top // 2 + j, r_w - 2 * inset, 1, K('tekko', 3 if j in (0, 1) else 2))
    c.HL(x + 2, fy - top // 2, r_w - 4, K('tekko', 4))
    c.R(x, fy + top // 2 - 1, r_w, body + 1, K('tekko', 1)); c.VL(x, fy + top // 2 - 1, body + 1, K('tekko', 2)); c.VL(x + r_w - 2, fy + top // 2 - 1, body + 1, K('tekko', 0)); c.VL(x + r_w - 1, fy + top // 2 - 1, body + 1, K('tekko', -1))
    for k in (3, 7): c.HL(x, fy + top // 2 - 1 + k, r_w, K('tekko', -1))
    c.HL(x + 1, base - 1, r_w - 2, K('tekko', -2))

def roof_top(c, x, y0, w, T, mat='conc', items=()):
    """윗면 T 줄. 뒤 난간 캡(+3) · 난간 안쪽면 3px(0/-2) · 지붕 바닥(+2, 16px 이음) · 좌우 난간 · 앞 난간 캡 2px(+3,+1). 옆면은 그리지 않는다."""
    c.R(x, y0, w, T, K(mat, 2))
    for j in range(16, T, 16): c.HL(x + 1, y0 + j, w - 2, K(mat, 1))
    for i in range(16, w, 16): c.VL(x + i, y0 + 3, T - 5, K(mat, 1))
    c.HL(x, y0, w, K(mat, 3)); c.HL(x, y0 + 1, w, K(mat, 0)); c.HL(x, y0 + 2, w, K(mat, 0)); c.HL(x, y0 + 3, w, K(mat, -2))   # 뒤 난간 + 안쪽면 + 그늘
    c.VL(x, y0, T, K(mat, 3)); c.VL(x + w - 1, y0, T, K(mat, 1))                     # 좌·우 난간 캡
    c.VL(x + 1, y0 + 3, T - 5, K(mat, -1)); c.VL(x + w - 2, y0 + 3, T - 5, K(mat, 3))   # 안쪽 면(왼 난간은 그늘, 오른 난간은 빛)
    c.HL(x, y0 + T - 2, w, K(mat, 3)); c.HL(x, y0 + T - 1, w, K(mat, 1))            # 앞 난간 캡 2px
    for it in items: it(c)

def roof_strip(c, x, y0, w, mat='conc'):
    """옛 방식(정면 도면): 12px 띠 + 앞 lip 4px. 깊이 정보 없음."""
    c.R(x, y0, w, 12, K(mat, 2)); c.HL(x, y0, w, K(mat, 3)); c.VL(x, y0, 12, K(mat, 3)); c.R(x + 2, y0 + 4, w - 4, 2, K(mat, 1)); c.VL(x + w - 1, y0, 12, K(mat, 1))

# ───────────────────────── 건물 ─────────────────────────
def awning34(c, x, y, w, col='aka'):
    """3/4 차양: 앞으로 튀어나온 윗면 7px(줄무늬, 뒤가 어둡고 앞이 밝다) + 앞 가장자리 3px + 벽에 떨어지는 그림자 2px.
    옛 awning() 은 6px 줄무늬 띠 하나 — 튀어나온 판이 아니라 벽에 칠한 띠(정면 도면)."""
    for i in range(w):
        st = (i // 4) % 2
        for j in range(7): c.P(x + i, y + j, K(col, (0 if j < 2 else 1 if j < 5 else 2) + (1 if st else 0)))
        c.P(x + i, y + 7, K(col, 3 if st else 2)); c.P(x + i, y + 8, K(col, 0 if st else -1)); c.P(x + i, y + 9, K(col, -2))
    c.VL(x, y, 10, K(col, 3)); c.VL(x + w - 1, y, 10, K(col, -2))
    for i in range(1, w - 1):
        for j in (10, 11): lower(c, x + i, y + j, 2 if j == 10 else 1)

# ── 입면 깊이(10-2b): 층 슬래브·창·붙임기둥·발코니·들어간 입구·상점 유리 받침 ──
def slab34(c, x, y, w, mat, shadow=True):
    """층 사이 슬래브(돌출 처마). 윗면 3(+3,+3,+2) + 앞면 2(+1,0) + 아래 모서리 1(-2) + 벽에 떨어지는 그림자 3(-3,-2,-1) = 9줄.
    옛 slab() 은 윗면 1 + 앞면 2 (윗면이 없어 벽에 칠한 띠)."""
    c.HL(x, y, w, K(mat, 3)); c.HL(x, y + 1, w, K(mat, 3)); c.HL(x, y + 2, w, K(mat, 2))
    c.HL(x, y + 3, w, K(mat, 1)); c.HL(x, y + 4, w, K(mat, 0)); c.HL(x, y + 5, w, K(mat, -2))
    if shadow:
        for j, t in enumerate((-3, -2, -1)):
            for i in range(w): lower(c, x + i, y + 6 + j, 3 if t == -3 else 2 if t == -2 else 1)

def window34(c, x, y, wall, lit=False):
    """들어간 창 16×14 + 창턱 윗면. 위 안쪽 그늘 2px(-2·-3) + 왼쪽 안쪽 그늘 1px + 오른쪽 안쪽 밝은 1px(+1, 창틀 옆면 반사) +
    창턱 윗면 2px(+3,+2, 좌우 1px 튀어나옴) + 창턱 앞면 1px(0) + 창턱 밑 벽 그림자 2px(-2,-1)."""
    W, H = 16, 14
    window(c, x, y, wall, lit)
    c.VL(x + W - 1, y + 2, H - 3, K('tekko', 1))                                        # 오른쪽 안쪽 밝은 줄
    mat = 'hodo' if wall == 'renga' else 'conc'
    c.HL(x - 1, y + H, W + 2, K(mat, 3)); c.HL(x - 1, y + H + 1, W + 2, K(mat, 2))       # 창턱 윗면 2
    c.HL(x - 1, y + H + 2, W + 2, K(mat, 0))                                            # 창턱 앞면 1
    for i in range(W + 2):
        lower(c, x - 1 + i, y + H + 3, 2); lower(c, x - 1 + i, y + H + 4, 1)            # 벽 그림자 2(오른쪽으로 1px 더 길게)

def pilaster(c, x, y, h, wall='tairu', w=4):
    """붙임기둥(벽에서 앞으로 나온 기둥): 왼쪽 1px 빛(+2), 앞면 w-2 (+1), 오른쪽 1px 그늘(-2), 그 오른쪽 벽에 그림자 1px."""
    c.VL(x, y, h, K(wall, 2)); c.R(x + 1, y, w - 2, h, K(wall, 1)); c.VL(x + w - 1, y, h, K(wall, -2))
    for j in range(h): lower(c, x + w, y + j, 1)

def balcony34(c, x, y, w):
    """발코니 슬래브(창 아래 y 에서 시작): 윗면 4(+3,+3,+2,+2) + 앞면 2(+1,0) + 모서리 1(-2) + 그림자 3, 난간은 슬래브 위 8px(창살 3px 간격 + 손잡이 윗줄)."""
    for j, t in enumerate((3, 3, 2, 2)): c.HL(x, y + j, w, K('conc', t))
    c.HL(x, y + 4, w, K('conc', 1)); c.HL(x, y + 5, w, K('conc', 0)); c.HL(x, y + 6, w, K('conc', -2))
    for j, n in enumerate((3, 2, 1)):
        for i in range(w): lower(c, x + i, y + 7 + j, n)
    ry = y - 8
    for i in range(1, w - 1, 3): c.VL(x + i, ry + 1, 8, K('tekko', 0)); c.P(x + i, ry + 1, K('tekko', 2))
    c.HL(x, ry, w, K('tekko', 2)); c.HL(x, ry + 1, w, K('tekko', 0)); c.VL(x, ry, 9, K('tekko', 2)); c.VL(x + w - 1, ry, 9, K('tekko', -1))

def bulkhead34(c, x, y, w, h_front, mat='tairu'):
    """상점 유리 받침(들어간 유리 앞으로 나온 턱): 윗면 3(+3,+3,+2) + 앞면 h_front(0, 밑줄 -2). y = 윗면 윗줄."""
    c.HL(x, y, w, K('hodo', 3)); c.HL(x, y + 1, w, K('hodo', 3)); c.HL(x, y + 2, w, K('hodo', 2))
    c.R(x, y + 3, w, h_front, K(mat, 0)); c.HL(x, y + 3, w, K(mat, 1)); c.HL(x, y + 3 + h_front - 1, w, K(mat, -2))

def glass34(c, x, y, w, h):
    """들어간 상점 유리 w×h: 위 안쪽 그늘 3px 이 유리 위쪽에 -1·-2 로 드리우고 왼쪽 안쪽 그늘 2px, 오른쪽 안쪽 밝은 1px."""
    c.R(x, y, w, h, K('garasu', -2)); c.R(x + 1, y + 1, w - 2, 5, K('garasu', 0)); c.R(x + 1, y + 6, w - 2, h - 7, K('garasu', 1))
    c.HL(x, y, w, K('tekko', -2)); c.HL(x + 1, y + 1, w - 2, K('garasu', -2)); c.HL(x + 1, y + 2, w - 2, K('garasu', -1))     # 위 안쪽 그늘 3
    c.VL(x + 1, y + 1, h - 1, K('garasu', -2)); c.VL(x + 2, y + 3, h - 4, K('garasu', -1))                                     # 왼쪽 안쪽 그늘 2
    c.VL(x + w - 2, y + 3, h - 4, K('garasu', 2))                                                                              # 오른쪽 안쪽 빛 1

def doorway34(c, x, gF, sill=4):
    """들어간 입구 24 폭(문 16 + 좌우 안쪽 그늘): 문 뒤로 밀려 그늘 진(-1단) 문, 문 앞 바닥 윗면 sill 줄(디딤 3 + 앞 1).
    옆면은 그리지 않는다 — 깊이는 (1) 문틀 위 그늘 (2) 문 색이 한 단 어두움 (3) 앞 바닥 윗면 으로만 보인다."""
    dy = gF - sill - 28
    c.R(x - 4, dy - 1, 24, 30 + sill - 1, K('tairu', -2))                                # 개구부 그늘
    door(c, x, dy, dark=-1)
    for i in range(16): lower(c, x + i, dy + 1, 2); lower(c, x + i, dy + 2, 1); lower(c, x + i, dy + 3, 1)         # 문 위쪽 그늘(처마)
    c.VL(x - 4, dy - 1, 30 + sill - 1, K('tairu', -3)); c.VL(x + 19, dy - 1, 30 + sill - 1, K('tairu', 1))
    for j in range(sill - 1): c.HL(x - 4, gF - sill + j, 24, K('hodo', 3 - j))                                # 디딤 윗면
    c.HL(x - 4, gF - 1, 24, K('hodo', -2))
    return dy

def shop3f(mode='new', D=2):
    """3층 가게 건물 96 폭. 앞면 = 48(가게) + 32 + 32 = 112. 윗면 D×16 = 32. 스프라이트 높이 = 112 + T.
    mode: 'new' = 입면 깊이 적용(슬래브 윗면·들어간 창·붙임기둥·발코니·들어간 입구·유리 받침),
          'mid' = 지붕만 3/4(직전 증명: 벽이 평평한 판), 'old' = 정면 도면(12px 지붕 띠)."""
    W = 96; deep = mode != 'old'; fac = mode == 'new'; H = 128 if fac else 112; T = D * 16 if deep else 12
    c = new(W, H + T); y0 = 0; f0 = T               # 앞면 시작 줄
    if deep:
        roof_top(c, 0, 0, W, T, 'conc', items=(lambda c: roof_box(c, 8, 27, 10, 8, 8, 'tekko', 'ac'),
                                               lambda c: roof_tank(c, 40, 25),
                                               lambda c: roof_box(c, 68, 25, 16, 8, 12, 'conc', 'door')))
    else:
        roof_strip(c, 0, 0, W); ac_unit(c, 10, 1); ac_unit(c, 26, 1)
    for f in range(2):
        fy = f0 + f * 32
        wall_fill(c, 0, fy + 3, W, 29, 'tairu', 'tile')
        if f == 0: c.HL(0, fy, W, K('tairu', -3)); c.HL(0, fy + 1, W, K('tairu', -2)); c.HL(0, fy + 2, W, K('tairu', -1))   # 지붕 처마 그늘 3px
        elif fac: slab34(c, 0, fy, W, 'tairu', shadow=True)
        else: slab(c, 0, fy, W, 'tairu', shadow=True)
        if fac:
            for k in range(3): window34(c, 8 + k * 32, fy + 10, 'tairu', lit=((f, k) in ((0, 1), (1, 2))))
            for px in (30, 62, 92): pilaster(c, px, fy + 9, 23, 'tairu')                    # 창 사이 붙임기둥(4 폭)
            pilaster(c, 2, fy + 9, 23, 'tairu')
            if f == 1: balcony34(c, 34, fy + 21, 28)                                          # 2층 가운데 발코니
        else:
            for k in range(3): window(c, 8 + k * 32, fy + 9, 'tairu', lit=((f, k) in ((0, 1), (1, 2))))
    gy0 = f0 + 64                                   # 1층(가게) 윗선
    if fac: slab34(c, 0, gy0, W, 'tairu', shadow=True)
    else: slab(c, 0, gy0, W, 'tairu', shadow=True)
    gy = gy0 + 7 if not fac else gy0 + 9
    gF = H + T                                       # 바닥 접선(스프라이트 아랫줄 +1)
    c.R(0, gy, W, gF - gy, K('tairu', 0)); c.R(0, gy, W, 1, K('tairu', -2))
    if fac:
        c.VL(0, gy, gF - gy, K('tairu', 1)); pilaster(c, 0, gy, gF - gy, 'tairu', 4)
        # 간판: 왼쪽 유리 위(문 위는 문 그늘), 앞으로 튀어나온 판 = 윗면 2 + 앞 4 + 그림자 1
        c.R(4, gy + 14, 40, 2, K('kinari', 3)); c.R(4, gy + 16, 40, 5, K('kinari', 0)); c.HL(4, gy + 20, 40, K('kinari', -2))
        for i in range(8, 42, 8): c.R(i, gy + 17, 4, 2, K('aka', -1))
        glass34(c, 4, gF - 27, 40, 16)                                                     # 유리 y gF-27..gF-12
        c.VL(24, gF - 26, 15, K('tekko', 0))
        for i in range(7, 42, 6): c.R(i, gF - 20, 4, 6, K(('midori', 'daidai', 'pinku', 'kii', 'sora', 'aka')[(i // 6) % 6], 1))
        bulkhead34(c, 4, gF - 11, 40, 7)                                                   # 유리 받침 윗면 3 + 앞 7 = gF-11..gF-1
        doorway34(c, 52, gF, 5)
        glass34(c, 72, gF - 27, 20, 16); bulkhead34(c, 72, gF - 11, 20, 7)
        awning34(c, 2, gy + 1, W - 4, 'aka')                                               # 차양은 나중에
    else:
        if deep:
            c.R(4, gy + 13, W - 8, 4, K('kinari', 0)); c.HL(4, gy + 13, W - 8, K('kinari', 2))
            for i in range(8, W - 8, 8): c.R(i, gy + 15, 4, 1, K('aka', -1))
            awning34(c, 2, gy + 1, W - 4, 'aka')
        else:
            awning(c, 4, gy + 1, W - 8, 'aka')
            c.R(4, gy + 9, W - 8, 3, K('kinari', 0)); c.HL(4, gy + 9, W - 8, K('kinari', 2))
            for i in range(8, W - 8, 8): c.R(i, gy + 10, 4, 1, K('aka', -1))
        c.R(4, gF - 24, 40, 20, K('garasu', -2)); c.R(5, gF - 23, 38, 5, K('garasu', 0)); c.R(5, gF - 18, 38, 12, K('garasu', 1)); c.VL(24, gF - 24, 20, K('tekko', 0))
        for i in range(7, 42, 6): c.R(i, gF - 12, 4, 6, K(('midori', 'daidai', 'pinku', 'kii', 'sora', 'aka')[(i // 6) % 6], 1))
        c.HL(4, gF - 4, 40, K('hodo', 2)); c.R(4, gF - 4, 40, 4, K('tairu', -2))
        door(c, 52, gF - 28, dark=0)
        c.R(72, gF - 24, 20, 20, K('garasu', -2)); c.R(73, gF - 23, 18, 5, K('garasu', 0)); c.R(73, gF - 18, 18, 12, K('garasu', 1)); c.R(72, gF - 4, 20, 4, K('tairu', -2))
        c.VL(W - 1, gy, gF - gy, K('tairu', 1)); c.HL(0, gF - 1, W, K('tairu', -3))
    if fac: c.HL(0, gF - 1, W, K('tairu', -3))
    return c

def conbini(mode='new', D=2):
    """1층 편의점 144 폭. 앞면 48. 윗면 D×16 = 32 (실외기 줄). 'new' = 튀어나온 간판판(윗면 2 + 앞 12 + 아래 그림자 3) ·
    유리 받침 윗면 3 · 들어간 자동문 · 붙임기둥. 'mid' = 직전(간판이 벽에 칠한 띠), 'old' = 정면 도면."""
    W = 144; H = 48; deep = mode != 'old'; fac = mode == 'new'; T = D * 16 if deep else 12
    c = new(W, H + T); f0 = T; gF = H + T
    if deep:
        roof_top(c, 0, 0, W, T, 'conc', items=(lambda c: roof_box(c, 10, 27, 12, 8, 8, 'tekko', 'ac'),
                                               lambda c: roof_box(c, 26, 27, 12, 8, 8, 'tekko', 'ac'),
                                               lambda c: roof_box(c, 42, 27, 12, 8, 8, 'tekko', 'ac'),
                                               lambda c: roof_tank(c, 100, 26)))
    else:
        roof_strip(c, 0, 0, W); ac_unit(c, 10, 1); ac_unit(c, 26, 1)
    wall_fill(c, 0, f0, W, H, 'conc', 'panel')
    c.HL(0, f0, W, K('conc', -3)); c.HL(0, f0 + 1, W, K('conc', -2)); c.HL(0, f0 + 2, W, K('conc', -1))          # 처마 그늘 3px
    if fac:
        sy = f0 + 6                                                                                           # 간판판 y (윗면 2 위, 앞 12)
        c.HL(4, sy - 2, W - 8, K('sora', 3)); c.HL(4, sy - 1, W - 8, K('sora', 2))                             # 튀어나온 판 윗면 2
        c.R(4, sy, W - 8, 12, K('sora', 0)); c.HL(4, sy, W - 8, K('sora', 1)); c.HL(4, sy + 11, W - 8, K('sora', -2))
        c.R(4, sy + 4, W - 8, 2, K('midori', 1)); c.R(4, sy + 6, W - 8, 1, K('kinari', 2))
        for i in range(10, W - 12, 7): c.R(i, sy + 8, 4, 2, K('kinari', 1))
        for i in range(4, W - 4): lower(c, i, sy + 12, 3); lower(c, i, sy + 13, 2); lower(c, i, sy + 14, 1)   # 판 아래 그림자 3
        gh = 22                                                                                               # 유리 높이
        for x0, ww in ((7, 56), (81, 56)):                                                                    # 들어간 유리벽
            glass34(c, x0, gF - 11 - gh, ww, gh)
            for i in range(x0 + 14, x0 + ww - 1, 14): c.VL(i, gF - 11 - gh + 1, gh - 1, K('tekko', 0))
            for i in range(x0 + 4, x0 + ww - 4, 5):
                c.R(i, gF - 21, 3, 6, K(('aka', 'kii', 'midori', 'sora', 'daidai', 'pinku')[(i // 5) % 6], 1)); c.R(i, gF - 26, 3, 4, K(('kii', 'sora', 'aka', 'midori')[(i // 5) % 4], 0))
            bulkhead34(c, x0, gF - 11, ww, 7, 'conc')
        doorway34(c, W // 2 - 8, gF, 5)
        for x in (0, W - 6): pilaster(c, x, f0 + 3, H - 3, 'conc', 6)
        c.HL(0, gF - 1, W, K('conc', -3))
        return c
    sy = f0 + 4                                                                                               # 간판띠 12
    c.R(6, sy, W - 12, 12, K('sora', 0)); c.HL(6, sy, W - 12, K('sora', 2)); c.HL(6, sy + 11, W - 12, K('sora', -2))
    c.R(6, sy + 4, W - 12, 2, K('midori', 1)); c.R(6, sy + 6, W - 12, 1, K('kinari', 2))
    for i in range(12, W - 14, 7): c.R(i, sy + 8, 4, 2, K('kinari', 1))
    for x0, ww in ((6, 56), (82, 56)):                                                                        # 유리벽
        c.R(x0, gF - 28, ww, 24, K('garasu', -2)); c.R(x0 + 1, gF - 27, ww - 2, 5, K('garasu', 0)); c.R(x0 + 1, gF - 22, ww - 2, 17, K('garasu', 1))
        for i in range(x0 + 14, x0 + ww - 1, 14): c.VL(i, gF - 28, 24, K('tekko', 0))
        for i in range(x0 + 3, x0 + ww - 4, 5): c.R(i, gF - 12, 3, 6, K(('aka', 'kii', 'midori', 'sora', 'daidai', 'pinku')[(i // 5) % 6], 1)); c.R(i, gF - 17, 3, 4, K(('kii', 'sora', 'aka', 'midori')[(i // 5) % 4], 0))
    door(c, W // 2 - 8, gF - 28, dark=0)
    c.R(0, gF - 4, W, 4, K('conc', -2)); c.HL(0, gF - 1, W, K('conc', -3))
    c.R(0, f0 + 3, 6, H - 3, K('conc', 1)); c.VL(0, f0 + 3, H - 3, K('conc', 2)); c.R(W - 6, f0 + 3, 6, H - 3, K('conc', -1))
    return c


# ───────────────────────── 소품 ─────────────────────────
def vending2(mode='new'):
    """자판기 2대 32×32. 윗면 8(깊이 12 를 0.67 배) + 앞면 24. 앞면 = 진열창 + 버튼 + 취출구. 옛 방식은 앞면 26 만."""
    c = new(32, 32)
    T = 8 if mode == 'new' else 2
    for n, (col, cans) in enumerate((('sora', ('aka', 'kii', 'midori', 'daidai')), ('aka', ('sora', 'kii', 'pinku', 'midori')))):
        x = n * 16; fy = T
        c.R(x, 0, 16, T, K(col, 2)); c.HL(x, 0, 16, K(col, 3)); c.VL(x, 0, T, K(col, 3))
        if mode == 'new': c.R(x + 3, 2, 10, 3, K(col, 1)); c.HL(x + 3, 2, 10, K(col, 3))       # 윗면 위 광고판 살짝
        c.R(x, fy, 16, 32 - fy, K(col, 0)); c.VL(x, fy, 32 - fy, K(col, 1)); c.VL(x + 15, fy, 32 - fy, K(col, -2)); c.HL(x, fy, 16, K(col, 1))
        c.HL(x, 31, 16, K(col, -3))
        c.R(x + 2, fy + 2, 12, 12, K('garasu', -2)); c.HL(x + 2, fy + 2, 12, K('garasu', -3))
        for k, m in enumerate(cans): c.R(x + 3 + k * 3, fy + 4, 2, 3, K(m, 1)); c.R(x + 3 + k * 3, fy + 9, 2, 3, K(m, 0))
        c.R(x + 3, fy + 15, 3, 2, K('tekko', -1)); c.R(x + 8, fy + 15, 5, 1, K('kinari', 1))
        c.R(x + 3, fy + 18 if mode == 'new' else fy + 19, 10, 3, K('sumi', 1)); c.HL(x + 3, fy + 18 if mode == 'new' else fy + 19, 10, K('sumi', 2))
    c.VL(16, T, 32 - T, K('tekko', -2))
    return c

def taxi_old():
    """[폐기] 직전 택시: 윗면 12 + 옆면 22 를 세로로 쌓은 띠 — 앞모습(뒤에서 본 정면)으로 읽힌다. 비교용."""
    c = new(64, 36); col = 'kii'; TOP = 12
    o = K(col, -2)
    for j in range(TOP):
        inset = 1 if j in (0, TOP - 1) else 0
        c.R(inset + 1, j, 62 - 2 * inset, 1, K(col, 1))
    for (a, b, m, t) in ((1, 14, col, 0), (14, 20, 'garasu', -1), (20, 44, col, 1), (44, 49, 'garasu', -1), (49, 63, col, 0)):
        c.R(a, 1, b - a, TOP - 2, K(m, t))
    c.HL(2, 1, 12, K(col, 3)); c.HL(21, 1, 22, K(col, 3)); c.HL(50, 1, 12, K(col, 2))
    c.R(28, 3, 8, 4, K('kinari', 1)); c.HL(28, 3, 8, K('kinari', 3)); c.HL(28, 6, 8, K('kinari', -1))
    c.HL(1, 0, 62, o); c.HL(1, TOP - 1, 62, K(col, 3)); c.VL(0, 1, TOP - 2, o); c.VL(63, 1, TOP - 2, o)
    fy = TOP
    c.R(1, fy, 62, 21, K(col, 0)); c.HL(1, fy, 62, K(col, 2))
    c.R(18, fy + 1, 28, 7, K('garasu', -1)); c.HL(18, fy + 1, 28, K('garasu', 0)); c.R(19, fy + 3, 26, 3, K('garasu', 0))
    c.VL(31, fy + 1, 20, K(col, -1)); c.VL(46, fy + 1, 20, K(col, -1)); c.VL(17, fy + 1, 20, K(col, -1))
    for i in range(6, 58):
        c.P(i, fy + 12, K('sumi', 2) if (i // 2) % 2 == 0 else K('kinari', 3)); c.P(i, fy + 13, K('kinari', 3) if (i // 2) % 2 == 0 else K('sumi', 2))
    c.HL(1, fy + 19, 62, K(col, -1)); c.HL(1, fy + 20, 62, K(col, -2))
    for wx in (6, 46):
        c.R(wx - 1, fy + 12, 13, 10, K('sumi', 1)); c.R(wx, fy + 11, 11, 11, K('sumi', 2)); c.R(wx + 3, fy + 14, 5, 5, K('tekko', 1))
        c.HL(wx, fy + 22, 11, K('sumi', 3))
    return c

def taxi_h(facing='right'):
    """택시 가로 방향 64×36 (오른쪽 보기 / 'left' = 좌우 반전). 계약 10-3b: 옆면 + 윗면 3곳(트렁크·지붕·후드).
    스텝 실루엣 — 지붕(윗면 y0~10, 높은 곳) 이 낮은 후드·트렁크(윗면 y7~16) 보다 위에 있고, 앞뒤 유리는 둘을 잇는 기울어진 띠.
    지붕 앞면(y10 두께 줄) → 캐빈 옆유리 y11~16 → 벨트라인 y17 → 차체 옆면 y18~33(체커·문·휠 하우스)."""
    c = new(64, 36); col = 'kii'
    # 윗면 세 조각 (왼쪽 트렁크, 가운데 지붕, 오른쪽 후드)
    def top(x0, x1, ya, yb, t, hi):
        for j in range(ya, yb):
            ins = 1 if j in (ya, yb - 1) else 0
            c.R(x0 + ins, j, x1 - x0 - 2 * ins, 1, K(col, t))
        c.HL(x0 + 1, ya, x1 - x0 - 2, K(col, hi)); c.VL(x0, ya + 1, yb - ya - 2, K(col, hi - 1))          # 위·왼쪽 빛
        c.VL(x1 - 1, ya + 1, yb - ya - 2, K(col, t - 2)); c.HL(x0 + 1, yb - 1, x1 - x0 - 2, K(col, t - 2))   # 오른쪽·아래 그늘
    top(1, 17, 7, 17, 0, 2)                    # 트렁크 윗면
    top(22, 42, 0, 11, 1, 3)                   # 지붕 윗면
    top(47, 63, 7, 17, 0, 2)                   # 후드 윗면
    c.HL(3, 10, 12, K(col, 2)); c.HL(49, 10, 12, K(col, 2))                        # 후드·트렁크 가운데 굴곡선
    # 앞·뒷유리 (지붕 가장자리 → 후드·트렁크 뒤 가장자리): x 방향 5px, y 는 지붕 0~10 에서 7~17 로 기울어진다
    for k in range(5):
        ya = 7 - int(round(k * 7 / 4.0)); yb = int(round(k * 7 / 4.0))       # 뒷유리(x17..21, 지붕쪽이 높다) · 앞유리(x42..46, 지붕쪽이 높다)
        for (x, y0) in ((17 + k, ya), (42 + k, yb)):
            c.R(x, y0, 1, 10, K('garasu', 0)); c.P(x, y0, K(col, -2)); c.P(x, y0 + 9, K(col, -2))     # 위·아래 테두리 = 차체색 그늘
            c.P(x, y0 + 1, K('garasu', 1)); c.P(x, y0 + 8, K('garasu', -1))
    # 지붕 표시등(윗면 위 작은 상자)
    c.R(28, 3, 8, 5, K('kinari', 1)); c.HL(28, 3, 8, K('kinari', 3)); c.HL(28, 7, 8, K('kinari', -1)); c.P(31, 5, K('sumi', 2)); c.P(32, 5, K('sumi', 2))
    # 지붕 앞면(두께 1) + 캐빈 옆유리 y11~16
    c.HL(22, 11, 20, K(col, -1))
    c.R(22, 12, 20, 5, K('garasu', -1)); c.HL(22, 12, 20, K('garasu', 0)); c.R(23, 13, 18, 2, K('garasu', 0)); c.HL(23, 13, 18, K('garasu', 1))
    c.VL(31, 12, 5, K(col, -1)); c.VL(22, 12, 5, K(col, -1)); c.VL(41, 12, 5, K(col, -1))
    for k in range(3): c.P(25 + k * 2, 15 - k, K('garasu', 2))
    # 벨트라인 + 차체 옆면 y18~33
    c.HL(1, 17, 62, K(col, 3))
    c.R(1, 18, 62, 16, K(col, 0)); c.HL(1, 18, 62, K(col, 2)); c.VL(1, 18, 16, K(col, 1))
    c.VL(62, 18, 16, K(col, -1)); c.HL(1, 33, 62, K(col, -2))
    c.VL(20, 19, 13, K(col, -1)); c.VL(31, 19, 13, K(col, -1)); c.VL(43, 19, 13, K(col, -1))            # 문 이음선
    c.R(26, 22, 3, 1, K(col, -2)); c.R(35, 22, 3, 1, K(col, -2))                                       # 손잡이
    for i in range(5, 59):                                                                            # 체커 띠
        c.P(i, 25, K('sumi', 2) if (i // 2) % 2 == 0 else K('kinari', 3)); c.P(i, 26, K('kinari', 3) if (i // 2) % 2 == 0 else K('sumi', 2))
    c.R(0, 20, 2, 3, K('aka', 1)); c.R(62, 19, 2, 4, K('kinari', 3))                                  # 미등 · 전조등
    c.R(0, 30, 3, 3, K('tekko', 1)); c.R(61, 30, 3, 3, K('tekko', 1))                                  # 범퍼
    for wx in (7, 46):                                                                                # 바퀴 + 휠 하우스
        c.R(wx - 1, 27, 14, 7, K(col, -2)); c.R(wx, 27, 12, 9, K('sumi', 1)); c.R(wx + 3, 30, 6, 6, K('tekko', 1))
        c.P(wx + 4, 31, K('tekko', 3)); c.P(wx + 5, 32, K('tekko', 3)); c.HL(wx, 35, 12, K('sumi', 3))
    if facing == 'left':
        a = c.a.copy(); c.a[:, :] = a[:, ::-1]
    return c

def taxi_v(facing='front'):
    """택시 세로 방향 28×56. facing='front' = 아래로 오는 차(앞면이 보임), 'back' = 위로 가는 차(뒷면이 보임).
    위→아래: (반대쪽 끝) 윗면 → 유리 띠 → 긴 지붕 윗면 16 → 유리 띠 → 가까운 쪽 윗면 → 앞(뒤)면 14. 윗면 합 42 + 앞면 14 = 56.
    옆면은 보이지 않는다(옆 바퀴는 앞면 아래 모서리의 검은 조각으로만)."""
    c = new(28, 56); col = 'kii'; front = facing == 'front'
    seq = (('trunk', 6), ('glass', 5), ('roof', 16), ('glass', 7), ('hood', 8)) if front else (('hood', 6), ('glass', 5), ('roof', 16), ('glass', 7), ('trunk', 8))
    y = 0
    for kind, h in seq:
        for j in range(h):
            ins = 2 if (y == 0 and j == 0) else 1 if (kind != 'glass' and j in (0, h - 1) and y == 0) else 0
            if kind == 'glass':
                c.R(3, y + j, 22, 1, K('garasu', (-1, 0, 0, -1, -1, 0, 0)[j % 7]))
                c.VL(1, y + j, 1, K(col, 0)); c.VL(2, y + j, 1, K(col, -1)); c.VL(25, y + j, 1, K(col, -1)); c.VL(26, y + j, 1, K(col, -2))
                c.P(0, y + j, K(col, 1)); c.P(27, y + j, K(col, -2))
            else:
                t = 1 if kind == 'roof' else 0
                c.R(ins, y + j, 28 - 2 * ins, 1, K(col, t))
        if kind == 'glass':
            c.HL(4 + (y % 3), y + 1, 8, K('garasu', 2))                                       # 유리 반사
        else:
            c.HL(1, y, 26, K(col, 3 if kind == 'roof' else 2)); c.VL(0, y + 1, h - 1, K(col, 2)); c.VL(27, y + 1, h - 1, K(col, -2))
            c.HL(1, y + h - 1, 26, K(col, -1 if kind != 'roof' else 2))
            if kind != 'roof': c.VL(14, y + 2, h - 3, K(col, 1))                                # 후드·트렁크 가운데 굴곡선
        y += h
    ry = 12 + 0; c.R(9, ry + 6, 10, 4, K('kinari', 1)); c.HL(9, ry + 6, 10, K('kinari', 3)); c.HL(9, ry + 9, 10, K('kinari', -1))   # 지붕 표시등(지붕 위)
    # 앞(뒤)면 y42~55
    fy = 42
    c.R(0, fy, 28, 14, K(col, 0)); c.HL(0, fy, 28, K(col, 3)); c.VL(0, fy, 14, K(col, 1)); c.VL(27, fy, 14, K(col, -2))     # 위 가장자리(후드·트렁크 앞 모서리 밝게)
    c.HL(0, fy + 1, 28, K(col, 1))
    if front:
        for hx in (2, 19):
            c.R(hx, fy + 3, 7, 4, K('kinari', 3)); c.HL(hx, fy + 3, 7, K('kinari', 3)); c.HL(hx, fy + 6, 7, K('tekko', 1))       # 전조등
        c.R(9, fy + 3, 10, 6, K('sumi', 1)); c.HL(9, fy + 3, 10, K('tekko', 1))                                                # 그릴
        for i in range(10, 18, 2): c.VL(i, fy + 4, 4, K('tekko', 2))
        c.R(11, fy + 10, 6, 2, K('kinari', 3)); c.P(13, fy + 10, K('sumi', 2))                                                 # 번호판
    else:
        for hx in (2, 19):
            c.R(hx, fy + 3, 7, 4, K('aka', 1)); c.HL(hx, fy + 3, 7, K('aka', 3)); c.HL(hx, fy + 6, 7, K('aka', -1))              # 미등
        c.HL(0, fy + 8, 28, K(col, -1)); c.R(11, fy + 5, 6, 3, K('kinari', 3)); c.P(13, fy + 6, K('sumi', 2))                  # 번호판(트렁크)
    c.R(2, fy + 11, 24, 3, K('tekko', 0)); c.HL(2, fy + 11, 24, K('tekko', 2)); c.HL(2, fy + 13, 24, K('tekko', -2))           # 범퍼
    c.R(0, fy + 9, 4, 5, K('sumi', 2)); c.R(24, fy + 9, 4, 5, K('sumi', 1)); c.HL(0, 55, 4, K('sumi', 3)); c.HL(24, 55, 4, K('sumi', 3))   # 바퀴 조각(앞면 아래 모서리)
    return c

def tree34():
    """가로수 32×48. 수관은 위가 밝은 돔(윗면 하이라이트 +2/+3), 오른쪽 아래 -2, 아래 뭉치 그늘. 줄기 4px 밑변 폭 + 밑동 윗면 8×3."""
    c = new(32, 48); cx = 16
    circles = ((cx, 16, 15), (cx - 8, 21, 10), (cx + 9, 21, 10), (cx, 9, 9))
    inside = lambda i, j: any((i - a) ** 2 + (j - b) ** 2 <= r * r for a, b, r in circles)
    for j in range(0, 36):
        for i in range(32):
            if not inside(i, j): continue
            edge = not (inside(i - 1, j) and inside(i + 1, j) and inside(i, j - 1) and inside(i, j + 1))
            d = (i - cx) * 0.6 + (j - 16)
            t = 3 if d < -12 else 2 if d < -6 else 1 if d < -1 else 0 if d < 5 else -1 if d < 10 else -2
            if j >= 27 and i > 6: t = min(t, -1)                                           # 수관 아랫면(그늘)
            c.P(i, j, K('ki', -3 if edge and d > -8 else t - (1 if edge else 0)))
    for k in range(9): c.P(cx - 10 + (k * 5) % 18, 8 + (k * 7) % 16, K('ki', 3))
    for k in range(7): c.P(cx - 8 + (k * 7) % 17, 26 + (k * 5) % 7, K('ki', -3))
    c.R(cx - 2, 36, 4, 10, K('ita', -1)); c.VL(cx - 2, 36, 10, K('ita', 1)); c.VL(cx + 1, 36, 10, K('ita', -2))
    c.HL(cx - 4, 44, 8, K('ita', 1)); c.R(cx - 4, 45, 8, 2, K('ita', -1)); c.HL(cx - 4, 47, 8, K('ita', -2))   # 밑동: 윗면 → 앞
    return c

def signal34():
    """신호등 16×48. 머리 상자: 윗면 3(+2) + 앞 8. 기둥 2px(원통: 밝음/어둠 세로줄), 받침 윗면 타원 3."""
    c = new(16, 48)
    c.R(0, 0, 16, 3, K('tekko', 2)); c.HL(0, 0, 16, K('tekko', 3)); c.VL(0, 0, 3, K('tekko', 3))
    c.R(0, 3, 16, 8, K('tekko', -1)); c.VL(0, 3, 8, K('tekko', 1)); c.VL(15, 3, 8, K('tekko', -2)); c.HL(0, 10, 16, K('tekko', -3))
    for k, (m, t) in enumerate((('midori', 1), ('kii', -2), ('aka', -2))): c.R(2 + k * 4, 5, 3, 3, K(m, t))
    c.R(7, 11, 2, 33, K('tekko', 0)); c.VL(7, 11, 33, K('tekko', 2)); c.VL(8, 11, 33, K('tekko', -2))
    c.R(4, 42, 8, 3, K('tekko', 2)); c.HL(5, 42, 6, K('tekko', 3)); c.R(4, 45, 8, 3, K('tekko', -1)); c.HL(4, 47, 8, K('tekko', -3))
    return c

# ───────────────────────── 바닥(위에서 본 1:1, 16px 칸) ─────────────────────────
def t_pave():
    c = new(16, 16); c.R(0, 0, 16, 16, K('hodo', 0))
    c.HL(0, 0, 16, K('hodo', -1)); c.HL(0, 8, 16, K('hodo', -1)); c.VL(0, 0, 8, K('hodo', -1)); c.VL(8, 8, 8, K('hodo', -1))
    c.HL(1, 1, 7, K('hodo', 1)); c.HL(9, 1, 7, K('hodo', 1)); c.HL(1, 9, 7, K('hodo', 1)); c.HL(9, 9, 7, K('hodo', 1))
    c.P(4, 4, K('hodo', -1)); c.P(12, 5, K('hodo', 1)); c.P(3, 12, K('hodo', 1)); c.P(13, 13, K('hodo', -1))
    return c

def t_alley():
    c = new(16, 16); c.R(0, 0, 16, 16, K('conc', -2)); c.HL(0, 0, 16, K('conc', -3)); c.VL(0, 0, 16, K('conc', -3)); c.HL(1, 1, 15, K('conc', -1)); c.VL(1, 1, 15, K('conc', -1))
    c.P(5, 6, K('conc', -3)); c.P(11, 10, K('conc', -1)); c.P(9, 3, K('conc', -1))
    return c

def t_curb():
    """연석 타일: 위 10줄 = 보도(위에서 본 판석), 점자 블록 4줄, 연석 윗면 3 + 앞면 4 + 도랑 그늘."""
    c = new(16, 16)
    blk = t_pave(); blit(c, blk, 0, 0)
    for i in range(16):
        if (i // 3) % 2 == 0: c.R(i, 4, 1, 2, K('kii', 0)); c.P(i, 4, K('kii', 1))
    c.HL(0, 8, 16, K('hodo', 3)); c.R(0, 9, 16, 2, K('hodo', 2)); c.HL(0, 11, 16, K('hodo', 1))      # 윗면 3
    c.R(0, 12, 16, 3, K('hodo', -1)); c.HL(0, 15, 16, K('yoru', -2))                                     # 앞면 3 + 도랑
    c.R(0, 0, 16, 0, K('hodo', 0))
    return c

def t_road(dash=False):
    c = new(16, 16); c.R(0, 0, 16, 16, K('yoru', 0))
    for (x, y, t) in ((3, 2, 1), (11, 4, -1), (7, 9, 1), (1, 12, 1), (13, 13, -1), (9, 15, 1)): c.P(x, y, K('yoru', t))
    if dash: c.R(2, 7, 12, 2, K('kinari', 0)); c.HL(2, 7, 12, K('kinari', 1)); c.HL(2, 9, 12, K('yoru', -1))
    return c

def ground_sheet():
    c = new(80, 16)
    for n, t in enumerate((t_pave(), t_alley(), t_curb(), t_road(), t_road(True))): blit(c, t, n * 16, 0)
    return c

# ───────────────────────── 장면 ─────────────────────────
SW, SH = 320, 256
GF = 160                                   # 건물 앞 바닥선(칸 10 줄)
ROAD = 192

def ground():
    c = new(SW, SH)
    for ty in range(SH // 16):
        for tx in range(SW // 16):
            if ty * 16 < GF: t = t_alley()
            elif ty == 10: t = t_pave()
            elif ty == 11: t = t_curb()
            else: t = t_road(dash=(ty == 14))
            blit(c, t, tx * 16, ty * 16)
    return c

def scene(mode):
    g = ground()
    A = shop3f(mode); B = conbini(mode)
    ax, bx = 16, 144
    ay, by = GF - A.h if mode == 'new' else GF - A.h, GF - B.h
    if mode == 'old': ay = GF - A.h; by = GF - B.h
    tx, ty_ = 112, 180 - 48                 # 가로수(밑동 y=180)
    # 바닥 그림자(빛 왼쪽 위 → 오른쪽·아래로): 건물 앞 8px + 오른쪽 8px, 소품 발밑
    for (x, w, D) in ((ax, 96, 2), (bx, 144, 2)):
        shade(g, x, GF, w + 4, 8, 2); shade(g, x, GF + 8, w + 4, 2, 1)
        shade(g, x + w, GF - D * 16 + 8, 8, D * 16 - 8 + 8, 2)
    ell_shade(g, 304, 178, 20, 4, 2)                                                   # 자판기
    ell_shade(g, 273, 188, 8, 2, 2)                                                    # 신호등
    ell_shade(g, 132, 182, 18, 4, 2)                                                   # 가로수 (밑동 발치 타원)
    ell_shade(g, 236, 248, 34, 4, 2)                                                   # 택시
    c = g
    hero_b = new(16, 24); hero(hero_b, 0, 0)
    blit(c, hero_b, 184, by + 8 - 24)                                                  # 편의점 지붕 너머: 발이 지붕 밑에 묻혀 머리·어깨(16px)만 지붕선 위로 보인다
    blit(c, A, ax, ay); blit(c, B, bx, by)
    items = []                                                                          # (바닥 y, 그리기)
    if mode == 'new':
        items += [(172, lambda: blit(c, hero_b, 68, 172 - 24)), (176, lambda: blit(c, vending2('new'), 288, 176 - 32)),
                  (180, lambda: blit(c, tree34(), 112, 180 - 48)), (188, lambda: blit(c, signal34(), 264, 188 - 48)),
                  (248, lambda: blit(c, taxi_h(), 200, 248 - 36)), (252, lambda: blit(c, taxi_v('front'), 40, 252 - 56)),
                  (252, lambda: blit(c, taxi_v('back'), 76, 252 - 56))]
    else:
        oc = new(56, 24); old_car(oc, 0, 0, 'kii'); ov = new(16, 26); old_vending(ov, 0, 0); os_ = new(16, 48); old_signal(os_, 0, 0); ot = new(32, 48); old_tree(ot, 0, 0)
        items += [(172, lambda: blit(c, hero_b, 68, 172 - 24)), (176, lambda: (blit(c, ov, 288, 176 - 26), blit(c, ov, 304, 176 - 26))),
                  (180, lambda: blit(c, ot, 112, 180 - 48)), (188, lambda: blit(c, os_, 264, 188 - 48)),
                  (248, lambda: blit(c, oc, 204, 248 - 24))]
    for _, f in sorted(items, key=lambda t: t[0]): f()
    return c, (A, B, ax, ay, bx, by)

def overlay(c, geo):
    """페이지용 진단 그림: 막힌 칸(발자국 = 깊이 D×16) 빨강, 지나가면 가려지는 칸(윗면+앞면 위쪽) 파랑. 자산이 아니다."""
    A, B, ax, ay, bx, by = geo
    im = c.img().convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); px = ov.load()
    for (spr, x, y, W, D) in ((A, ax, ay, 96, 2), (B, bx, by, 144, 2)):
        for j in range(spr.h):
            for i in range(W):
                gy = y + j
                if gy >= GF - D * 16 and gy < GF: px[x + i, gy] = (230, 40, 40, 110)     # 발자국: 막힘
                elif gy < GF - D * 16: px[x + i, gy] = (40, 120, 255, 90)                 # 위쪽: 뒤로 걸으면 가려짐
    return Image.alpha_composite(im, ov)

def save_all():
    os.makedirs(OUT, exist_ok=True)
    pieces = {'shop3f': shop3f('new'), 'conbini': conbini('new'), 'vending2x2': vending2('new'), 'taxi-h': taxi_h(), 'taxi-h-left': taxi_h('left'), 'taxi-v-front': taxi_v('front'), 'taxi-v-back': taxi_v('back'), 'old-taxi': taxi_old(), 'tree': tree34(),
              'signal': signal34(), 'ground': ground_sheet(),
              'old-shop3f': shop3f('old'), 'old-conbini': conbini('old'), 'old-vending2x2': vending2('old')}
    for n, p in pieces.items(): p.save(os.path.join(OUT, n + '.png'))
    cn, geo = scene('new'); cn.save(os.path.join(OUT, 'scene-new.png')); overlay(cn, geo).save(os.path.join(OUT, 'scene-new-overlay.png'))
    co, _ = scene('old'); co.save(os.path.join(OUT, 'scene-old.png'))
    print('ok', OUT, {k: (v.w, v.h) for k, v in pieces.items()})

if __name__ == '__main__':
    save_all()
