#!/usr/bin/env python3
"""현대 계열(일본·강남·학원) 공통 style bible 의 증명 그림(16px, 손 도트, modern3 램프만)을 찍는다.
  python3 scripts/content/atlas-pick/modern_style_bible_proof.py     # tiledata/atlas-pick/style-demo-modern3/{proof,scale,cubes}.png
치수는 전부 modern-style-bible.md 표의 숫자다(이 파일이 그 표의 실행본). 램프는 palette/modern3.pal 을 읽는다.
규칙: 반투명·보간·난수·그라데이션 함수 없음. 그림자는 같은 램프의 낮은 단(sh)."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modern3_check import load_pal
from common import BASE

RAMPS = load_pal()
OUT = os.path.join(BASE, 'style-demo-modern3')

def K(name, t):
    """램프 name 의 단 t (7단: -3…+3, 5단: -2…+2, 3단: -1…+1). 범위를 넘으면 끝 단."""
    r = RAMPS[name]; mid = len(r) // 2
    return r[max(0, min(len(r) - 1, mid + t))]

def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)

class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None: s.a[y, x] = (*rgb(c), 255)
    def R(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.P(x + i, y + j, c)
    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)
    def save(s, p):
        os.makedirs(os.path.dirname(p), exist_ok=True); Image.fromarray(s.a, 'RGBA').save(p)
    def img(s): return Image.fromarray(s.a, 'RGBA')

# ─────────────────────────── 재료 부품 ───────────────────────────
def slab(c, x, y, w, mat, shadow=True):
    """층 사이 슬래브 띠 4px + 그 밑 그림자 3px. 위 1px 하이라이트(+2) · 앞면 2px(+1) · 아래 모서리 1px(-2), 그림자 (-2,-2,-1)."""
    c.HL(x, y, w, K(mat, 2)); c.R(x, y + 1, w, 2, K(mat, 1)); c.HL(x, y + 3, w, K(mat, -2))
    if shadow:
        c.HL(x, y + 4, w, K(mat, -3 if mat in ('conc',) else -2)); c.HL(x, y + 5, w, K(mat, -2)); c.HL(x, y + 6, w, K(mat, -1))

def wall_fill(c, x, y, w, h, mat, kind):
    """벽면. 기본 t0 위에 재료 결. 밋밋함 방지: 줄눈(-1) + 줄눈 밑 밝은 줄(+1) + 왼쪽 빛 기둥(+1)."""
    c.R(x, y, w, h, K(mat, 0))
    if kind == 'tile':      # 8px 타일: 가로 줄눈 8마다, 세로 줄눈 엇갈림 16마다
        for j in range(0, h, 8):
            c.HL(x, y + j, w, K(mat, -1))
            if j + 1 < h: c.HL(x, y + j + 1, w, K(mat, 1))
            for i in range((4 if (j // 8) % 2 else 12), w, 16): c.VL(x + i, y + j + 1, 7 if j + 8 <= h else h - j - 1, K(mat, -1))
    elif kind == 'panel':   # 콘크리트 패널: 세로 이음 16마다 + 얼룩 두 줄
        for i in range(0, w, 16):
            c.VL(x + i, y, h, K(mat, -1))
            if i + 1 < w: c.VL(x + i + 1, y, h, K(mat, 1))
        for i in range(5, w, 32): c.VL(x + i, y + 6, 8, K(mat, -1))
    elif kind == 'brick':   # 붉은 벽돌: 4px 줄 + 엇갈림 8px
        for j in range(0, h, 4):
            c.HL(x, y + j, w, K(mat, -1))
            for i in range(4 if (j // 4) % 2 else 0, w, 8): c.VL(x + i, y + j, 4 if j + 4 <= h else h - j, K(mat, -1))
    c.VL(x, y, h, K(mat, 1))

def window(c, x, y, mat_wall, lit=False, kind='glass', broken=False):
    """창 16×14. 깊이: 위 2px 그늘(-2) · 왼쪽 1px 그늘(-1) · 창턱 1px 밝음(+2) · 창턱 밑 벽 그림자 2px(-2,-1)."""
    W, H = 16, 14
    c.R(x, y, W, H, K('tekko', -1))                      # 틀(안쪽으로 파인 검은 테두리)
    c.R(x + 1, y + 2, W - 2, H - 3, K('mado', 0) if lit else K('garasu', -1))   # 유리
    if lit:
        c.R(x + 1, y + 2, W - 2, 2, K('mado', -1)); c.R(x + 1, y + 4, W - 2, H - 6, K('mado', 1)); c.R(x + 1, y + 4, 2, H - 6, K('mado', 0))
        c.VL(x + 8, y + 2, H - 3, K('tekko', 0))       # 가운데 창살
    else:
        c.R(x + 1, y + 4, W - 2, H - 6, K('garasu', 0))
        c.HL(x + 1, y + 4, W - 2, K('garasu', 1))
        for k in range(5): c.P(x + 3 + k * 2, y + 10 - k, K('garasu', 2))     # 대각 빛 한 줄
        c.VL(x + 8, y + 2, H - 3, K('tekko', 0))
    c.R(x, y, W, 2, K(mat_wall, -3) if mat_wall in ('conc', 'tairu') else K(mat_wall, -2))  # 처마 그늘 2px(창 안쪽 위)
    c.VL(x, y + 2, H - 2, K('tekko', -2)); c.VL(x + 1, y + 2, H - 3, K('garasu', -2) if not lit else K('mado', -1))   # 왼쪽 그늘
    c.HL(x - 1, y + H, W + 2, K('conc', 2) if mat_wall != 'renga' else K('hodo', 3))     # 창턱(밝음, 창보다 좌우 1px 튀어나옴)
    c.HL(x - 1, y + H + 1, W + 2, K(mat_wall, -2)); c.HL(x, y + H + 2, W, K(mat_wall, -1))   # 창턱 밑 그림자

def door(c, x, y, glass=True, dark=0):
    """문 16×28(=히어로 24 의 1.17배). 유리문: 틀 1px, 유리, 손잡이 세로 막대. dark = 안으로 들어간 정도(단 낮춤)."""
    W, H = 16, 28
    c.R(x, y, W, H, K('tekko', -2))
    c.R(x + 1, y + 1, W - 2, H - 1, K('garasu', -2))
    c.R(x + 1, y + 1, W - 2, 3, K('garasu', -2))
    c.R(x + 2, y + 5, W - 4, H - 7, K('garasu', -1 + dark))
    c.R(x + 2, y + 5, W - 4, 5, K('garasu', 0 + dark)); c.VL(x + 8, y + 1, H - 1, K('tekko', 0))
    for k in range(6): c.P(x + 3 + k, y + 16 - k, K('garasu', 1))
    c.VL(x + 6, y + 14, 6, K('kinari', 1)); c.VL(x + 10, y + 14, 6, K('kinari', 1))    # 손잡이
    c.HL(x, y + H, W, K('hodo', 2))                                                    # 문턱

def awning(c, x, y, w, col='aka'):
    """차양 12px 높이 없이 8px: 위 면(+1) 줄무늬 · 앞 가장자리 2px · 밑 그림자 3px(바닥 아닌 벽 위)."""
    for i in range(w):
        st = (i // 4) % 2
        c.R(x + i, y, 1, 2, K(col, 2 if st else 1))
        c.R(x + i, y + 2, 1, 3, K(col, 1 if st else 0))
        c.R(x + i, y + 5, 1, 1, K(col, -2))

def ac_unit(c, x, y):
    """실외기 12×8: 앞면(0) · 윗면 1px(+2) · 팬 원 · 오른쪽 아래 그림자 2px."""
    c.R(x, y, 12, 8, K('tekko', 1)); c.HL(x, y, 12, K('tekko', 3)); c.VL(x, y, 8, K('tekko', 2))
    c.R(x + 3, y + 2, 6, 5, K('tekko', -1)); c.R(x + 4, y + 3, 4, 3, K('tekko', 0)); c.P(x + 5, y + 4, K('tekko', -2)); c.P(x + 6, y + 4, K('tekko', -2))
    c.HL(x + 1, y + 8, 12, K('tekko', -2)); c.VL(x + 12, y + 1, 8, K('tekko', -2)); c.HL(x + 2, y + 9, 12, K('conc', -2))

def hero(c, x, y):
    """히어로 16×24(머리 8 · 몸 10 · 다리 6). 윤곽 = sumi, 그림자 쪽(오른쪽) 한 줄만 어둡게."""
    o = K('sumi', 1); hair = K('sumi', 2); sk = K('daidai', 2); sk2 = K('daidai', 1)
    sh = K('sora', 1); sh2 = K('sora', 0); pa = K('tekko', -1); pa2 = K('tekko', -2)
    rows = [
        '....oooooooo....', '...ohhhhhhhho...', '..ohhhhhhhhhho..', '..ohhhhhhhhhho..', '..ohhssssssho...', '..ohsossssosho..',
        '..osssssssssso..', '...osssssssso...', '....oooooooo....', '...oottttttoo...', '..otttttttttto..', '.oottttttttttoo.',
        '.osttttttttttso.', '.osttttttttttso.', '.oottttttttttoo.', '..ottppppppttto.', '...oppppppppo...', '...oppppppppo...',
        '...oppp..pppo...', '...oppp..pppo...', '...oppp..pppo...', '...oppp..pppo...', '...owww..wwwo...', '...oooo..oooo...']
    cmap = {'o': o, 'h': hair, 's': sk, 't': sh, 'p': pa, 'w': K('sumi', 2)}
    for j, r in enumerate(rows[:24]):
        r = r.ljust(16, '.')
        for i, ch in enumerate(r[:16]):
            if ch in cmap:
                col = cmap[ch]
                if ch == 't' and i >= 11: col = sh2
                if ch == 'p' and i >= 8: col = pa2
                if ch == 's' and i >= 11: col = sk2
                c.P(x + i, y + j, col)

# ─────────────────────────── 증명 블록 ───────────────────────────
def proof():
    W, H = 192, 208
    c = Cv(W, H)
    c.R(0, 0, W, H, K('tekko', -2))                       # 뒤 배경 = 먼 건물 그늘
    # 도로·보도 먼저
    BG = 124                                              # B 건물 바닥선
    for j in range(BG, H): c.HL(0, j, W, K('hodo', 0))
    # 보도(B 앞 124..152)
    for j in range(BG, 152):
        for i in range(W):
            row = (j - BG) // 16
            edge = (j - BG) % 16 == 0 or (i + (8 if row % 2 else 0)) % 16 == 0
            c.P(i, j, K('hodo', -1) if edge else K('hodo', 0))
    for i in range(W):
        if (i // 3) % 2 == 0: c.R(i, 146, 1, 2, K('kii', 0))                 # 점자 블록 띠(노랑) 2px
    c.HL(0, 152, W, K('hodo', 3)); c.R(0, 153, W, 3, K('hodo', 2)); c.HL(0, 156, W, K('hodo', -2))   # 연석 4px
    c.R(0, 157, W, 51, K('yoru', 0)); c.HL(0, 157, W, K('yoru', -2))
    for i in range(0, W, 24): c.R(i + 4, 182, 14, 2, K('kinari', 0)); c.HL(i + 4, 184, 14, K('yoru', -1))  # 중앙선 점선
    c.R(150, 160, 3, 2, K('yoru', 2)); c.R(30, 196, 4, 2, K('yoru', 1)); c.R(110, 168, 5, 1, K('yoru', 1))

    # ── 건물 B(뒤·오른쪽·물러남): x 108..184, 위 y=0..124
    bx, bw = 108, 80
    # 지붕면 12px + 앞 처마 4px
    c.R(bx, 0, bw, 12, K('conc', 2)); c.HL(bx, 0, bw, K('conc', 3)); c.VL(bx, 0, 12, K('conc', 3)); c.R(bx + 2, 4, bw - 4, 2, K('conc', 1))
    c.R(bx + bw - 1, 0, 1, 12, K('conc', 1))
    c.R(bx + 44, 3, 16, 8, K('conc', 0)); c.R(bx + 44, 3, 16, 2, K('conc', 1)); c.HL(bx + 45, 11, 16, K('conc', -2))   # 옥탑 물탱크 자리(윗면·앞면·그림자)
    slab(c, bx, 12, bw, 'conc', shadow=False)
    # 2층·1층(위 두 층) 벽
    for f in range(2):
        y0 = 16 + f * 32
        wall_fill(c, bx, y0 + 3, bw, 29, 'conc', 'panel')
        slab(c, bx, y0, bw, 'conc', shadow=True) if f > 0 else (c.HL(bx, y0 + 0, bw, K('conc', -3)), c.HL(bx, y0 + 1, bw, K('conc', -2)), c.HL(bx, y0 + 2, bw, K('conc', -1)))
        if f > 0:
            c.HL(bx, y0 + 4, bw, K('conc', -3)); c.HL(bx, y0 + 5, bw, K('conc', -2)); c.HL(bx, y0 + 6, bw, K('conc', -1))
        for wx in (bx + 12, bx + 52):
            window(c, wx, y0 + 9, 'conc', lit=(f == 0 and wx == bx + 52))
        if f == 1:      # 2층 왼쪽에 난간 + 실외기(튀어나온 것 = 그림자)
            c.R(bx + 10, y0 + 19, 20, 1, K('tekko', 3)); c.R(bx + 10, y0 + 20, 20, 1, K('tekko', 1))
            for i in range(11, 30, 3): c.VL(bx + i, y0 + 19, 5, K('tekko', 2))
            c.R(bx + 10, y0 + 24, 20, 1, K('tekko', 1)); c.HL(bx + 10, y0 + 25, 20, K('conc', -3)); c.HL(bx + 11, y0 + 26, 20, K('conc', -2))
    ac_unit(c, bx + 34, 16 + 32 + 14)                          # 실외기(벽걸이, 창 사이 벽)
    slab(c, bx, 16 + 64, bw, 'conc', shadow=True)              # 1층(가게) 위 슬래브
    # 1층 = 물러선 가게. 처마 밑 그림자 6px, 안쪽 벽은 한 단 어둡게, 문은 더 어둡게, 바닥은 4px 위
    gy = 16 + 64 + 7
    c.R(bx, gy, bw, 124 - gy, K('conc', -2)); c.R(bx, gy, bw, 6, K('conc', -3))
    c.R(bx + 4, gy + 6, bw - 8, 124 - gy - 6 - 4, K('conc', -1))               # 안쪽 벽
    c.R(bx + 4, gy + 6, bw - 8, 2, K('conc', -2))
    c.R(bx, gy, 4, 124 - gy, K('conc', 1)); c.VL(bx, gy, 124 - gy, K('conc', 2)); c.VL(bx + 3, gy + 6, 124 - gy - 6, K('conc', -3))   # 왼 기둥(앞으로 튀어나온 것: 밝음 + 안쪽 그림자)
    c.R(bx + bw - 4, gy, 4, 124 - gy, K('conc', -1)); c.VL(bx + bw - 4, gy, 124 - gy, K('conc', 0))
    # 간판띠(안쪽 벽 위)
    c.R(bx + 8, gy + 9, bw - 16, 8, K('sora', -1)); c.HL(bx + 8, gy + 9, bw - 16, K('sora', 0))
    for i in range(bx + 12, bx + bw - 12, 6): c.R(i, gy + 12, 3, 3, K('kinari', 1))
    door(c, bx + 32, 124 - 4 - 28, dark=-1)                                     # 물러선 문(한 단 어둡게)
    c.R(bx + 8, 124 - 4 - 16, 18, 14, K('garasu', -2)); c.R(bx + 9, 124 - 4 - 15, 16, 4, K('garasu', -1))   # 쇼윈도
    c.R(bx + 56, 124 - 4 - 16, 16, 14, K('garasu', -2)); c.R(bx + 57, 124 - 4 - 15, 14, 4, K('garasu', -1))
    c.R(bx + 4, 124 - 4, bw - 8, 4, K('hodo', -2)); c.HL(bx + 4, 124 - 4, bw - 8, K('hodo', -3))              # 가게 앞 바닥(4px 위, 그늘)
    # ── 건물 A(앞·왼쪽·튀어나옴): x 8..104, y 8..132  + 오른쪽 옆면 4px
    ax, aw = 8, 96; oy = 8
    # (그림자는 B 를 다 그린 뒤 덧칠: 색은 그 자리 색의 낮은 단)
    def lowered(x, y, n):
        px = tuple(int(v) for v in c.a[y, x, :3]); h = (px[0] << 16) | (px[1] << 8) | px[2]
        for nm, r in RAMPS.items():
            if h in r:
                i = r.index(h); return r[max(0, i - n)]
        return h
    for j in range(16, 124):
        for i in range(bx, bx + 12):
            n = 2 if i < bx + 8 else 1
            c.P(i, j, lowered(i, j, n))
    # 지붕면 12px + 앞 처마
    c.R(ax, oy, aw + 4, 12, K('conc', 2)); c.HL(ax, oy, aw + 4, K('conc', 3)); c.VL(ax, oy, 12, K('conc', 3)); c.R(ax + 2, oy + 4, aw, 2, K('conc', 1))
    ac_unit(c, ax + 10, oy + 1); ac_unit(c, ax + 26, oy + 1)
    c.R(ax + 60, oy + 2, 20, 8, K('conc', 1)); c.HL(ax + 60, oy + 2, 20, K('conc', 3)); c.HL(ax + 61, oy + 10, 20, K('conc', -1))   # 옥탑 계단실 윗면
    slab(c, ax, oy + 12, aw, 'tairu', shadow=False)
    for f in range(2):
        y0 = oy + 16 + f * 32
        wall_fill(c, ax, y0 + 3, aw, 29, 'tairu', 'tile')
        if f == 0:
            c.HL(ax, y0, aw, K('tairu', -3)); c.HL(ax, y0 + 1, aw, K('tairu', -2)); c.HL(ax, y0 + 2, aw, K('tairu', -1))
        else:
            slab(c, ax, y0, aw, 'tairu', shadow=True)
        for k in range(3):
            window(c, ax + 8 + k * 32, y0 + 9, 'tairu', lit=((f, k) in ((0, 1), (1, 2))))
    slab(c, ax, oy + 16 + 64, aw, 'tairu', shadow=True)
    # 1층 = 앞으로 나온 가게. 처마 밑 그림자 3px, 간판띠, 유리 진열창, 문
    gy = oy + 16 + 64 + 7
    c.R(ax, gy, aw, 132 - gy, K('tairu', 0)); c.R(ax, gy, aw, 1, K('tairu', -2))
    awning(c, ax + 4, gy + 1, aw - 8, 'aka')
    c.R(ax + 4, gy + 9, aw - 8, 3, K('kinari', 0)); c.HL(ax + 4, gy + 9, aw - 8, K('kinari', 2))   # 간판띠 글자 자리
    for i in range(ax + 8, ax + aw - 8, 8): c.R(i, gy + 10, 4, 1, K('aka', -1))
    c.R(ax + 4, 132 - 24, 40, 20, K('garasu', -2)); c.R(ax + 5, 132 - 23, 38, 5, K('garasu', 0)); c.R(ax + 5, 132 - 18, 38, 12, K('garasu', 1))
    c.VL(ax + 24, 132 - 24, 20, K('tekko', 0))
    for i in range(ax + 7, ax + 42, 6): c.R(i, 132 - 12, 4, 6, K(('midori', 'daidai', 'pinku', 'kii', 'sora', 'aka')[(i // 6) % 6], 1))   # 진열대 물건
    c.HL(ax + 4, 132 - 4, 40, K('hodo', 2)); c.R(ax + 4, 132 - 4, 40, 4, K('tairu', -2))
    door(c, ax + 52, 132 - 28, dark=0)
    c.R(ax + 72, 132 - 24, 20, 20, K('garasu', -2)); c.R(ax + 73, 132 - 23, 18, 5, K('garasu', 0)); c.R(ax + 73, 132 - 18, 18, 12, K('garasu', 1))
    c.R(ax + 72, 132 - 4, 20, 4, K('tairu', -2))
    c.R(ax + aw - 4, gy, 4, 132 - gy, K('tairu', 1))
    c.HL(ax, 132, aw + 4, K('tairu', -3))            # 바닥 접선
    # 옆면(오른쪽 4px, 그늘)
    sx = ax + aw
    for j in range(oy + 12, 132):
        c.R(sx, j, 4, 1, K('tairu', -2))
    for f in range(3):
        y0 = oy + 12 + f * 32 if f < 3 else 0
        c.R(sx, y0, 4, 4, K('tairu', -1)); c.HL(sx, y0, 4, K('tairu', 0))
    c.VL(sx + 3, oy + 12, 132 - oy - 12, K('tairu', -3)); c.VL(sx, oy + 12, 132 - oy - 12, K('tairu', -1))
    # 바닥 그림자: A 아래 → 오른쪽 아래로 보도 위(-2 단)
    def floor_shadow():
        # 빛 = 왼쪽 위 → 그림자는 A 밑·오른쪽으로. 8px 깊이(-2) + 4px 가장자리(-1), 오른쪽 끝은 계단 2단
        for j in range(132, 148):
            reach = sx + 16 - ((j - 132) // 6) * 4
            for i in range(ax + 4, min(reach, W)):
                n = 2 if (j - 132) < 8 else 1
                c.P(i, j, lowered(i, j, n))
    floor_shadow()
    # 히어로(A 문 앞, 문 높이와 비교) + 자판기 옆? (히어로만)
    hero(c, ax + 48, 132 - 24 + 12)
    return c

# ─────────────────────────── 규모 그림(히어로 16×24 기준) ───────────────────────────
def car(c, x, y, col='shiro'):
    """차 56×24(옆모습): 몸통 12 + 지붕 8 + 바퀴 밑 4. 윗면 +2 · 몸 0 · 아래 -2 · 유리 garasu."""
    b = y + 8
    c.R(x + 12, y, 30, 9, K(col, 0)); c.HL(x + 13, y, 28, K(col, 2)); c.VL(x + 12, y + 1, 8, K(col, 2)); c.VL(x + 41, y + 1, 8, K(col, -1))
    c.R(x + 14, y + 2, 12, 6, K('garasu', 0)); c.R(x + 28, y + 2, 12, 6, K('garasu', 0)); c.HL(x + 14, y + 2, 12, K('garasu', 2)); c.HL(x + 28, y + 2, 12, K('garasu', 2))
    c.VL(x + 27, y + 2, 6, K(col, -1))
    c.R(x, b + 1, 56, 10, K(col, 0)); c.HL(x + 1, b, 54, K(col, 1)); c.HL(x, b + 1, 56, K(col, 2)); c.R(x, b + 8, 56, 2, K(col, -1)); c.HL(x, b + 10, 56, K(col, -2))
    c.R(x, b + 3, 3, 3, K('kii', 1)); c.R(x + 53, b + 3, 3, 3, K('aka', 1)); c.HL(x + 8, b + 4, 40, K(col, -1))
    for wx in (x + 5, x + 42):
        c.R(wx, b + 7, 10, 8, K('sumi', 2)); c.R(wx + 1, b + 6, 8, 9, K('sumi', 2)); c.R(wx + 3, b + 9, 4, 4, K('tekko', 2)); c.P(wx + 4, b + 10, K('tekko', 3))
    c.HL(x + 1, y + 24 - 1, 54, K('yoru', -2))

def vending(c, x, y):
    """자판기 16×26: 윗면 +2 · 앞 0 · 오른쪽 -2 · 진열창 garasu · 상품 색띠 · 투입구 · 취출구."""
    c.R(x, y, 16, 26, K('sora', 0)); c.HL(x, y, 16, K('sora', 2)); c.VL(x, y, 26, K('sora', 1)); c.VL(x + 15, y, 26, K('sora', -2)); c.HL(x, y + 25, 16, K('sora', -3))
    c.R(x + 2, y + 3, 12, 12, K('garasu', -2)); c.HL(x + 2, y + 3, 12, K('garasu', -3))
    for k, m in enumerate(('aka', 'kii', 'midori', 'daidai')):
        c.R(x + 3 + k * 3, y + 5, 2, 3, K(m, 1)); c.R(x + 3 + k * 3, y + 10, 2, 3, K(m, 0))
    c.R(x + 3, y + 17, 3, 2, K('tekko', -1)); c.R(x + 8, y + 17, 5, 1, K('kinari', 1)); c.R(x + 3, y + 21, 10, 3, K('sumi', 1)); c.HL(x + 3, y + 21, 10, K('sumi', 2))

def signal(c, x, y):
    """신호등 16×48: 가로형 머리(16×7) + 기둥 2px + 받침. 머리 윗면 +2, 램프 3개(초록 켜짐)."""
    c.R(x, y, 16, 7, K('tekko', -1)); c.HL(x, y, 16, K('tekko', 1)); c.VL(x, y, 7, K('tekko', 0)); c.HL(x, y + 6, 16, K('tekko', -3))
    for k, (m, t) in enumerate((('midori', 1), ('kii', -2), ('aka', -2))): c.R(x + 2 + k * 4, y + 2, 3, 3, K(m, t))
    c.R(x + 7, y + 7, 2, 39, K('tekko', 0)); c.VL(x + 7, y + 7, 39, K('tekko', 2)); c.VL(x + 8, y + 7, 39, K('tekko', -2))
    c.R(x + 5, y + 44, 6, 4, K('tekko', -1)); c.HL(x + 5, y + 44, 6, K('tekko', 1))

def tree(c, x, y):
    """가로수 32×48: 줄기 4px×16(밑변과 같은 폭) + 수관 32×34. 왼쪽 위 +2 · 몸 0 · 오른쪽 아래 -2, 가장자리 1px -3."""
    cx = x + 16
    circles = ((cx, y + 16, 15), (cx - 8, y + 21, 10), (cx + 9, y + 21, 10), (cx, y + 9, 9))
    inside = lambda i, j: any((i - a) ** 2 + (j - b) ** 2 <= r * r for a, b, r in circles)
    for j in range(y, y + 34):
        for i in range(x, x + 32):
            if not inside(i, j): continue
            edge = not (inside(i - 1, j) and inside(i + 1, j) and inside(i, j - 1) and inside(i, j + 1))
            d = (i - cx) + (j - (y + 16))
            t = 2 if d < -10 else 1 if d < -2 else 0 if d < 8 else -1 if d < 16 else -2
            c.P(i, j, K('ki', -3 if edge and d > -6 else t - (1 if edge else 0)))
    for k in range(6): c.P(cx - 8 + (k * 5) % 14, y + 12 + (k * 7) % 14, K('ki', 3))    # 잎 하이라이트(제자리 6점)
    c.R(cx - 2, y + 34, 4, 14, K('ita', -1)); c.VL(cx - 2, y + 34, 14, K('ita', 1)); c.VL(cx + 1, y + 34, 14, K('ita', -2))
    c.R(cx - 4, y + 46, 8, 2, K('ita', -2)); c.HL(cx - 4, y + 46, 8, K('ita', -1))

def scale():
    W, H = 272, 64; G = 60                       # 바닥선 y=60
    c = Cv(W, H); c.R(0, 0, W, H, K('yoru', 1)); c.R(0, G, W, 4, K('hodo', 0)); c.HL(0, G, W, K('hodo', 2))
    x = 6
    hero(c, x, G - 24); x += 24
    c.R(x, G - 40, 22, 40, K('conc', 0)); c.VL(x, G - 40, 40, K('conc', 1))
    door(c, x + 3, G - 28); x += 30
    c.R(x, G - 40, 24, 40, K('conc', 0)); c.VL(x, G - 40, 40, K('conc', 1))
    window(c, x + 4, G - 30, 'conc', lit=False); x += 32
    for j in range(G - 32, G + 1): c.P(x + 2, j, K('kinari', 2))            # 층 32 괄호
    for j in (G - 32, G): c.R(x, j, 5, 1, K('kinari', 2))
    x += 12
    car(c, x, G - 24); x += 64
    vending(c, x, G - 26); x += 24
    signal(c, x, G - 48); x += 24
    tree(c, x, G - 48)
    return c

def cubes():
    mats = ('conc', 'tairu', 'renga', 'kawara', 'ita', 'garasu', 'yuka', 'kokuban', 'lino', 'kinari')
    W, H = 34 * len(mats), 34; c = Cv(W, H); c.R(0, 0, W, H, K('hodo', 0))
    for n, m in enumerate(mats):
        x = 2 + n * 34; y = 4
        for j in range(5):                       # 윗면(+2) — 평행사변형, 위 1px +3
            c.R(x + 4 - j + 3, y + j, 18, 1, K(m, 3 if j == 0 else 2))
        c.R(x + 3, y + 5, 18, 16, K(m, 0)); c.VL(x + 3, y + 5, 16, K(m, 1))   # 앞면 0
        c.R(x + 3, y + 5, 18, 2, K(m, -2))                                       # 처마 그림자 -2
        for j in range(16): c.R(x + 21, y + 5 + j - 0, 4, 1, K(m, -2))          # 오른쪽면 -2
        c.R(x + 25, y + 6, 1, 16, K(m, -3))
        c.R(x + 24, y + 21, 6, 2, K('hodo', -2)); c.R(x + 3, y + 21, 22, 2, K('hodo', -2)); c.R(x + 26, y + 23, 4, 1, K('hodo', -1))   # 바닥 그림자 -2, 부드러운 가장자리 -1
    return c

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    proof().save(os.path.join(OUT, 'proof.png')); scale().save(os.path.join(OUT, 'scale.png')); cubes().save(os.path.join(OUT, 'cubes.png'))
    print('ok', OUT)
