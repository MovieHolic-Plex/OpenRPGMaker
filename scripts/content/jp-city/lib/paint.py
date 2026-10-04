"""일본 상가 거리 키트 — 16px 격자 모듈 페인터. 모든 반복 패턴은 16(또는 8·4·2)의 약수 주기.
띠(band) = 폭 n칸. 좌끝 L(1칸) + 중간 (n-3)칸 + 우끝 R(2칸, 1층은 문). 중간은 모듈(1칸 또는 2칸)을 반복하고 남는 1칸은 Fill."""
import os, sys, math
import jpenv
import numpy as np
from modern_style_bible_proof import K, Cv, RAMPS, rgb
import post
from jfont import glyph

def shade(c, x, y, w, h, dt, only=None):
    for j in range(max(y, 0), min(y + h, c.h)):
        for i in range(max(x, 0), min(x + w, c.w)):
            if c.a[j, i, 3]:
                f = post.fam(c.a, i, j)
                if only is None or f in only: c.a[j, i, :3] = post.step(c.a[j, i], dt)

WALLS = ('kinari', 'shiro', 'conc', 'hodo')
FH = 32       # 층 높이 = 2칸
# ───────── 층 띠 (32px) ─────────
def floor_base(c, W, wall):
    c.R(0, 0, W, 28, K(wall, 1)); c.VL(0, 0, 28, K(wall, 2)); c.VL(W - 1, 0, 28, K(wall, -1))
    shade(c, 0, 0, W, 4, -1, (wall,))
def slab(c, W):
    c.R(0, 28, W, 4, K('conc', 4)); c.HL(0, 28, W, K('shiro', 4)); c.HL(0, 31, W, K('conc', 0))

def mod_pairs(c, x, v):        # 1칸: 창 하나(v&1 불 켜짐, v&2 = 창 없는 벽 — 간판 자리)
    if v & 2: return
    wx = x; lit = v & 1
    c.R(wx + 2, 8, 12, 16, K('ita', -3)); c.R(wx + 3, 9, 10, 14, K('mado', 1) if lit else K('garasu', 1)); c.R(wx + 3, 9, 10, 3, K('mado', 0) if lit else K('garasu', 0))
    c.R(wx + 3, 12, 2, 10, K('mado', -1) if lit else K('garasu', -1)); c.VL(wx + 8, 9, 14, K('tekko', 1)); c.HL(wx + 3, 15, 10, K('tekko', 1))
    for k in range(4): c.P(wx + 6 + k, 20 - k, K('mado', 4) if lit else K('garasu', 4))
    c.R(wx + 1, 24, 14, 2, K('shiro', 3)); c.HL(wx + 1, 26, 14, K('hodo', -1)); c.HL(wx + 2, 27, 12, K('hodo', 0))
def mod_ribbon(c, x, v):       # 1칸
    c.R(x + 2, 9, 12, 16, K('mado', 1) if v else K('garasu', 1)); c.R(x + 2, 9, 12, 3, K('mado', 0) if v else K('garasu', 0))
    for q in range(4): c.P(x + 4 + q, 20 - q, K('mado', 4) if v else K('garasu', 4))
def mod_curtain(c, x, v):      # 1칸
    for q in range(5): c.P(x + 3 + q, 9 - q, K('garasu', 4))
    if v: c.R(x + 3, 14, 8, 8, K('mado', 1))
def mod_balcony(c, x, v):      # 2칸
    c.R(x + 5, 3, 22, 14, K('ita', -3)); c.R(x + 6, 4, 20, 12, K('mado', 1) if v & 1 else K('garasu', 1)); c.VL(x + 16, 4, 12, K('tekko', 1)); c.R(x + 6, 4, 20, 3, K('garasu', 0))
    if not v & 1:
        for q in range(5): c.P(x + 8 + q, 13 - q, K('mado', 4))
    if v & 2:  # 빨래
        col = ['shiro', 'sora', 'aka', 'kinari'][(v >> 2) & 3]
        c.R(x + 9, 13, 14, 8, K(col, 3)); c.HL(x + 9, 13, 14, K('tekko', 3)); c.HL(x + 9, 20, 14, K('conc', 0))
def mod_tile(c, x, v):         # 2칸
    c.R(x + 9, 6, 12, 17, K('ita', -3)); c.R(x + 10, 7, 10, 15, K('mado', 1) if v & 1 else K('garasu', 1)); c.R(x + 10, 7, 10, 3, K('garasu', 0)); c.HL(x + 10, 14, 10, K('tekko', 1))
    c.R(x + 7, 23, 16, 2, K('shiro', 3)); c.HL(x + 7, 25, 16, K('hodo', -1))

def mod_koushi(c, x, v):       # 1칸: 격자창(v&1 = 주황 루버 덧문)
    c.R(x + 1, 6, 14, 18, K('ita', -3))
    if v & 1:
        c.R(x + 2, 7, 12, 16, K('aka', 1))
        for j in range(8, 22, 3): c.HL(x + 2, j, 12, K('aka', 3)); c.HL(x + 2, j + 1, 12, K('aka', -1))
    else:
        c.R(x + 2, 7, 12, 16, K('kinari', 3) if v & 2 else K('mado', 1))
        for i in range(x + 3, x + 14, 3): c.VL(i, 7, 16, K('ita', 0)); c.VL(i + 1, 7, 16, K('ita', -2))
        c.HL(x + 2, 14, 12, K('ita', 0))

def mod_slide(c, x, v):         # 1칸: 알루미늄 새시 미닫이(가로 2장) — v&1 불, v&2 커튼, v&4 面格子(방범 창살)
    lit = v & 1
    c.R(x + 1, 11, 14, 12, K('shiro', 1)); c.HL(x + 1, 11, 14, K('shiro', 4)); c.VL(x + 1, 11, 12, K('shiro', 3)); c.VL(x + 14, 11, 12, K('conc', 0)); c.HL(x + 1, 22, 14, K('conc', -1))
    c.R(x + 2, 12, 6, 10, K('mado', 1) if lit else K('garasu', 1)); c.R(x + 8, 12, 6, 10, K('mado', 1) if lit else K('garasu', 1))
    c.R(x + 2, 12, 12, 2, K('mado', 0) if lit else K('garasu', 0)); c.VL(x + 8, 12, 10, K('shiro', 2))
    for q in range(3): c.P(x + 3 + q, 19 - q, K('mado', 4) if lit else K('garasu', 4))
    if v & 2: c.R(x + 2, 12, 6, 6, K('kinari', 3)); c.HL(x + 2, 17, 6, K('kinari', 1))
    if v & 4:
        for q in range(x + 3, x + 14, 3): c.VL(q, 12, 10, K('tekko', 2))
        c.HL(x + 2, 17, 12, K('tekko', 2))
    c.R(x + 1, 23, 14, 2, K('conc', 3)); c.HL(x + 1, 25, 14, K('conc', -2)); c.HL(x + 1, 26, 14, K('hodo', -1))
def mod_veranda(c, x, v):       # 2칸: 베란다 — 유리문 + 난간(윗면+앞) + v&1 불 v&2 빨래 v&4 실외기
    lit = v & 1
    c.R(x + 3, 3, 26, 14, K('tekko', -2)); c.R(x + 4, 4, 24, 12, K('mado', 1) if lit else K('garasu', 1)); c.R(x + 4, 4, 24, 3, K('mado', 0) if lit else K('garasu', 0))
    c.VL(x + 16, 4, 12, K('shiro', 2))
    for q in range(5): c.P(x + 6 + q, 13 - q, K('mado', 4) if lit else K('garasu', 4))
    if v & 2:
        for k, col in enumerate(('shiro', 'sora', 'kii', 'shiro')): c.R(x + 6 + k * 5, 6, 3, 8, K(col, 3)); c.HL(x + 6 + k * 5, 6, 3, K(col, 4))
        c.HL(x + 4, 5, 24, K('tekko', 3))
    c.R(x + 1, 17, 30, 3, K('conc', 4)); c.HL(x + 1, 17, 30, K('shiro', 4)); c.R(x + 1, 20, 30, 6, K('shiro', 2)); c.HL(x + 1, 20, 30, K('conc', 1))
    for q in range(x + 3, x + 30, 4): c.VL(q, 21, 4, K('conc', 0))
    c.HL(x + 1, 25, 30, K('conc', -1))
    if v & 4: c.R(x + 21, 13, 8, 7, K('shiro', 2)); c.HL(x + 21, 13, 8, K('shiro', 4)); c.R(x + 23, 15, 4, 4, K('tekko', -1)); c.P(x + 25, 16, K('tekko', 3))

FLOORS = {  # name: (모듈폭 칸, 모듈 함수, 변형 수, 기본 벽재 고정?)
    'pairs': (1, mod_pairs, 4), 'ribbon': (1, mod_ribbon, 2), 'curtain': (1, mod_curtain, 2),
    'balcony': (2, mod_balcony, 16), 'tile': (2, mod_tile, 2), 'koushi': (1, mod_koushi, 4), 'slide': (1, mod_slide, 8), 'veranda': (2, mod_veranda, 8), 'blank': (1, lambda c, x, v: None, 1)}

def floor_band(kind, wall, n, vs):
    """vs: 모듈마다 변형값 목록. n: 칸 수."""
    W = n * 16; c = Cv(W, FH)
    if kind == 'tile':
        c.R(0, 0, W, 28, K('renga', 1)); shade(c, 0, 0, W, 4, -1, ('renga',))
        for j in range(4, 28, 4): c.HL(0, j, W, K('renga', 0))
        for i in range(4, W, 8):
            for j in range(4, 28, 8): c.VL(i, j, 4, K('renga', 0))
    elif kind == 'curtain':
        c.R(0, 0, W, 28, K('garasu', 1)); shade(c, 0, 0, W, 3, -1, ('garasu',))
        for k in range(0, W, 16): c.VL(k, 0, 28, K('tekko', 1)); c.VL(k + 1, 0, 28, K('tekko', 3))
        c.HL(0, 12, W, K('tekko', 1)); c.HL(0, 24, W, K('tekko', 1))
        c.R(0, 22, W, 6, K('tekko', 2)); c.HL(0, 22, W, K('tekko', 4))
    elif kind == 'koushi':
        floor_base(c, W, wall)
        c.R(0, 0, W, 3, K('ita', -1)); c.HL(0, 0, W, K('ita', 1)); c.R(0, 25, W, 3, K('ita', -1)); c.HL(0, 25, W, K('ita', 1))
        for x in range(0, W, 16): c.VL(x, 3, 22, K('ita', -2)); c.VL(x + 1, 3, 22, K('ita', 1))
        c.R(0, 24, W, 2, K('ita', 1)); c.HL(0, 24, W, K('ita', 3)); c.HL(0, 26, W, K('ita', -3))
    elif kind == 'ribbon':
        floor_base(c, W, wall); c.R(2, 8, W - 4, 18, K('tekko', -2))
        c.R(2, 26, W - 4, 2, K('shiro', 3))
    else: floor_base(c, W, wall)
    if kind != 'curtain':
        pc = 'conc' if kind in ('tile',) else wall
        c.R(0, 0, W, 3, K(pc, 2)); c.HL(0, 0, W, K(pc, 4)); c.HL(0, 3, W, K(pc, -1)); c.HL(0, 4, W, K(pc, 0))            # 보(상인방)
        for x0, sg in ((0, 1), (W - 3, -1)):                                                                          # 기둥
            c.R(x0, 3, 3, 25, K(pc, 2)); c.VL(x0 if sg > 0 else x0 + 2, 3, 25, K(pc, 4) if sg > 0 else K(pc, -1)); c.VL(x0 + (2 if sg > 0 else 0), 3, 25, K(pc, 0)) if sg > 0 else c.VL(x0, 3, 25, K(pc, 3))
    mw, fn, _ = FLOORS[kind]; m = n - 3; cnt = m // mw
    for k in range(cnt): fn(c, 16 + k * mw * 16, vs[k % len(vs)] if vs else 0)
    slab(c, W)
    return c

# ───────── 옥상 띠 (32px) ─────────
def roof_band(n, left='plain', right='plain'):
    W = n * 16; T = 32; c = Cv(W, T)
    c.R(0, 0, W, T, K('hodo', 3)); c.R(0, 0, W, 5, K('hodo', 4)); c.HL(0, 0, W, K('conc', 5)); c.HL(0, 5, W, K('hodo', 1))
    for j in range(7, T - 6): c.HL(1, j, W - 2, K('hodo', 3 if j % 8 else 2))
    for i in range(16, W, 16): c.VL(i, 7, T - 13, K('hodo', 2))
    if left == 'ac':
        c.R(1, 6, 14, 4, K('tekko', 3)); c.HL(1, 6, 14, K('tekko', 5)); c.R(1, 10, 14, 8, K('tekko', 2)); c.R(2, 12, 8, 5, K('tekko', 0))
        for i in range(3, 10, 2): c.VL(i, 12, 5, K('tekko', 1))
        c.VL(14, 10, 8, K('tekko', 0)); c.HL(1, 18, 14, K('conc', -3))
    if right == 'tank':
        x = W - 26; c.R(x, 7, 12, 8, K('tairu', 2)); c.HL(x, 7, 12, K('tairu', 4)); c.R(x + 12, 9, 2, 8, K('conc', 0)); c.R(x, 15, 12, 2, K('tekko', 1))
    if left == 'stair':      # 옥탑(塔屋): 계단실 상자 + 문
        c.R(1, 3, 14, 18, K('conc', 2)); c.HL(1, 3, 14, K('conc', 5)); c.R(1, 3, 2, 18, K('conc', 3)); c.VL(14, 3, 18, K('conc', -1)); c.HL(1, 20, 14, K('conc', -2))
        c.R(5, 9, 6, 11, K('tekko', 1)); c.R(6, 10, 4, 9, K('tekko', 2)); c.VL(8, 10, 9, K('tekko', -1)); c.R(1, 3, 14, 2, K('conc', 4))
    if right == 'cyl':       # 고가수조: 원통 + 다리 + 사다리
        x = W - 30
        for j in range(5, 17):
            for i in range(0, 14):
                dd = abs(i - 6.5) / 6.5; col = K('tairu', 4) if j < 8 else K('tairu', 3 - int(dd * 3)) if True else K('tairu', 2)
                c.P(x + i, j, K('tairu', 3 - min(3, int(dd * 3.4))) if j >= 7 else K('tairu', 4))
        c.HL(x, 6, 14, K('tairu', 5)); c.HL(x, 16, 14, K('tairu', -2)); c.HL(x, 11, 14, K('tairu', 0))
        c.R(x + 1, 17, 2, 6, K('tekko', 1)); c.R(x + 11, 17, 2, 6, K('tekko', 1)); c.HL(x, 23, 14, K('conc', -2)); c.VL(x + 15, 7, 15, K('tekko', 3))
    # 뒤 난간(핸드레일): 뒤 파라펫 위 가는 기둥
    for i in range(2, W - 2, 8): c.R(i, 1, 1, 4, K('tekko', 3))
    c.HL(1, 1, W - 2, K('tekko', 4))
    c.HL(0, T - 5, W, K('conc', 5)); c.R(0, T - 4, W, 2, K('conc', 4)); c.HL(0, T - 2, W, K('conc', 2)); c.HL(0, T - 1, W, K('hodo', 0))
    return c

def terrace_band(n):          # 16px: 셋백 아래 테라스 윗면
    W = n * 16; c = Cv(W, 16)
    c.R(0, 0, W, 16, K('hodo', 3)); c.HL(0, 0, W, K('conc', 5)); c.R(0, 12, W, 4, K('conc', 3)); c.HL(0, 15, W, K('hodo', -1))
    for i in range(16, W, 16): c.VL(i, 2, 10, K('hodo', 2))
    return c

# ───────── 1층 띠 (48px) ─────────
G = 48
def door_cells(c, W):
    """우끝 2칸(32px) 안: 들어간 문 24px + 돌 문턱."""
    x = W - 28; base = G - 3; top = base - 30
    c.R(x - 2, top - 3, 28, 33, K('ita', -3)); c.R(x, top, 24, 30, K('ita', 0))
    for k in (0, 1):
        x0 = x + k * 12
        c.R(x0 + 1, top + 2, 10, 20, K('garasu', 4))
        for i in range(x0 + 4, x0 + 11, 4): c.VL(i, top + 2, 20, K('ita', -1))
        for j in range(top + 8, top + 22, 8): c.HL(x0 + 1, j, 10, K('ita', -1))
        c.R(x0 + 1, top + 2, 10, 2, K('garasu', 2)); c.R(x0 + 1, top + 23, 10, 7, K('ita', 1)); c.HL(x0 + 1, top + 23, 10, K('ita', 3))
    c.VL(x + 12, top, 30, K('ita', -2)); c.R(x + 9, top + 14, 1, 5, K('tekko', 4)); c.R(x + 14, top + 14, 1, 5, K('tekko', 4))
    c.R(x - 3, base - 2, 30, 2, K('hodo', 5)); c.HL(x - 3, base - 2, 30, K('hodo', 6)); c.HL(x - 3, base - 1, 30, K('hodo', 1))
    shade(c, x, top, 24, 3, -1, ('ita', 'garasu'))

def awning(c, W, col):
    for i in range(2, W - 2):
        s = (i // 8) % 2
        c.R(i, 6, 1, 4, K(col, 4 if s else 3)); c.R(i, 10, 1, 5, K('shiro', 3) if s else K(col, 2)); c.P(i, 15, K('shiro', 1) if s else K(col, 0))
        if (i % 8) in (3, 4): c.P(i, 16, K('hodo', -2))
    shade(c, 2, 17, W - 4, 3, -2, ('hodo',))

NOREN = '酒麺茶寿'
def ground_band(kind, n, awn='aka', v=0):
    W = n * 16; c = Cv(W, G)
    c.R(0, 0, W, G, K('hodo', 2))
    for j in range(3, G, 5): c.HL(0, j, W, K('hodo', 1))
    shade(c, 0, 0, W, 5, -1, ('hodo',)); shade(c, 0, 0, W, 2, -1, ('hodo',))
    if kind in ('shutter', 'glass'):
        awning(c, W, awn); sy = 22; sh = G - 22 - 6
        if kind == 'shutter':
            c.R(0, sy, W, sh, K('tekko', -2))
            for j in range(sy + 1, sy + sh, 3): c.HL(1, j, W - 2, K('tekko', 2)); c.HL(1, j + 1, W - 2, K('tekko', 1))
        else:
            c.R(0, sy - 2, W, sh + 2, K('tekko', -2)); c.R(1, sy, W - 2, sh, K('mado', 1)); c.R(1, sy, W - 2, 3, K('mado', 0))
            for x in range(16, W - 16, 16):
                c.R(x + 3, sy + 10, 8, 2, K('ita', 1)); c.VL(x + 6, sy + 12, sh - 12, K('ita', -2)); c.R(x + 4, sy + 7, 3, 3, K('aka', 2)); c.R(x + 8, sy + 7, 3, 3, K('kii', 2)); c.VL(x, sy, sh, K('tekko', 1))
            for q in range(6): c.P(4 + q, sy + sh - 3 - q, K('mado', 4))
    elif kind == 'konbini':
        c.R(0, 0, W, G, K('shiro', 2)); c.R(0, 3, W, 9, K('murasaki', 1)); c.HL(0, 3, W, K('murasaki', 4)); c.R(0, 7, W, 2, K('shiro', 4)); c.R(0, 9, W, 3, K('daidai', 2))
        for x in range(0, W, 16): c.R(x + 5, 5, 5, 2, K('shiro', 3))
        shade(c, 0, 12, W, 3, -2, ('shiro',))
        c.R(0, 17, W, G - 24, K('tekko', -2)); c.R(1, 18, W - 2, G - 26, K('mado', 1)); c.R(1, 18, W - 2, 3, K('mado', 0))
        for x in range(16, W - 16, 16): c.R(x + 4, 28, 8, 8, K(['aka', 'sora', 'kii', 'midori'][(v if isinstance(v, int) else v[0]) % 4], 2)); c.HL(x + 4, 28, 8, K('shiro', 3))
        for q in range(6): c.P(4 + q, 30 - q, K('mado', 4))
    elif kind == 'izakaya':
        c.R(0, 0, W, G, K('ita', 0))
        for x in range(0, W, 4): c.VL(x, 0, G, K('ita', -1)); c.VL(x + 1, 0, G, K('ita', 2))
        shade(c, 0, 0, W, 5, -2, ('ita',))
        c.R(0, 4, W, 9, K('ita', -3)); c.R(1, 5, W - 2, 7, K('kinari', 2))
        for x in range(0, W, 16): c.R(x + 4, 7, 4, 3, K('aka', 1)); c.R(x + 10, 7, 3, 3, K('aka', 1))
        for x in range(16, W - 16, 16):
            c.R(x + 1, 17, 14, 22, K('ita', -3)); c.R(x + 2, 18, 12, 20, K('kinari', 3)); c.R(x + 2, 18, 12, 3, K('kinari', 1))
            for q in range(x + 5, x + 14, 4): c.VL(q, 18, 20, K('ita', 0))
            for q in (24, 31): c.HL(x + 2, q, 12, K('ita', 0))
            c.R(x + 1, 38, 14, 1, K('ita', 3))
        c.R(2, 20, 8, 10, K('aka', 2)); c.HL(2, 20, 8, K('kii', 3)); c.HL(2, 29, 8, K('tekko', 1)); c.R(5, 23, 2, 4, K('kii', 3))
    elif kind == 'machiya':
        c.R(0, 0, W, G, K('ita', 0))
        for x in range(0, W, 4): c.VL(x, 16, G - 16, K('ita', -1)); c.VL(x + 1, 16, G - 16, K('ita', 2))   # 세로 판벽
        c.R(0, 0, W, 16, K('ita', -2)); c.HL(0, 0, W, K('ita', 1)); c.HL(0, 15, W, K('ita', -3))   # 간판 널(글자는 부착물)
        for x in range(0, W, 16): c.R(x + 1, 2, 14, 12, K('ita', -3)); c.HL(x + 1, 2, 14, K('ita', -1))
        shade(c, 0, 16, W, 4, -2, ('ita',))
        for x in range(16, W - 32, 16):                                              # 노렌(감색 천 + 흰 글자)
            c.R(x + 1, 16, 14, 23, K('kon', -1)); c.VL(x + 1, 16, 23, K('kon', 1)); c.VL(x + 14, 16, 23, K('kon', -2)); c.HL(x + 1, 16, 14, K('kon', 2)); c.HL(x + 1, 38, 14, K('shiro', 2))
            vv = v[(x // 16 - 1) % len(v)] if isinstance(v, (list, tuple)) else v
            if vv < 4:
                g = glyph(NOREN[vv])
                for yy, xx in zip(*np.nonzero(g)):
                    if 1 <= xx <= 14 and 17 + yy <= 33: c.P(x + xx, 17 + yy, K('shiro', 4))
            elif vv == 4:      # 가문(원 + 십자)
                for yy in range(16):
                    for xx in range(16):
                        d = (xx - 7.5) ** 2 + (yy - 7.5) ** 2
                        if 22 <= d <= 38 or (d < 22 and (xx in (7, 8) or yy in (7, 8))): c.P(x + xx, 17 + yy, K('shiro', 4))
            else:              # 무지 + 아랫단 줄
                c.HL(x + 3, 24, 10, K('kon', 1)); c.HL(x + 3, 30, 10, K('kon', 1))
            for yy in range(34, 38): c.VL(x + 8, yy, 1, K('kon', -1)) if False else c.P(x + 8, yy, K('kon', -1))
        c.R(2, 20, 8, 12, K('shiro', 3)); c.HL(2, 20, 8, K('shiro', 4)); c.R(2, 32, 8, 2, K('aka', 1)); c.VL(9, 20, 12, K('shiro', 1))   # 입간판 초롱 모양
    elif kind == 'garage':
        c.R(0, 0, W, G, K('hodo', 1)); shade(c, 0, 0, W, 6, -2, ('hodo',))
        c.R(0, 12, W, G - 18, K('tekko', -3))
        for x in range(16, W - 16, 16): c.R(x + 5, 12, 5, G - 18, K('hodo', 3)); c.VL(x + 5, 12, G - 18, K('hodo', 5)); c.VL(x + 9, 12, G - 18, K('hodo', 0))
        c.R(0, 8, W, 4, K('kii', 2))
        for x in range(0, W, 8): c.R(x, 8, 4, 4, K('tekko', -2))
    c.R(0, G - 6, W, 6, K('hodo', 3)); c.HL(0, G - 1, W, K('hodo', -1))
    return c


def eave_band(n, R='kawara'):      # 16px: 기와 차양(庇)
    W = n * 16; c = Cv(W, 16)
    c.R(0, 0, W, 16, K(R, 0)); c.R(0, 0, W, 3, K('tekko', -3))
    for j in range(3, 16):
        r = (j - 3) // 4; off = 4 if r % 2 else 0
        for i in range(W):
            u = (i + off) % 8; v = (j - 3) % 4
            c.P(i, j, K(R, -2) if v == 3 else K(R, -1) if u == 7 else K(R, 2) if v == 0 else K(R, 1) if u == 0 else K(R, 0))
    c.HL(0, 15, W, K(R, -3)); c.HL(0, 14, W, K(R, -2))
    return c

def roof_tile_band(n, R='kawara'):  # 32px: 기와 앞 경사 + 용마루
    W = n * 16; T = 32; c = Cv(W, T)
    for j in range(T):
        r = j // 4; off = 4 if r % 2 else 0
        for i in range(W):
            u = (i + off) % 8; v = j % 4
            t = 3 if r < 2 else 2 if r < 5 else 1
            c.P(i, j, K(R, t - 3) if v == 3 else K(R, t - 2) if u == 7 else K(R, t + 2) if v == 0 else K(R, t + 1) if u == 0 else K(R, t))
    c.R(0, 0, W, 4, K(R, 2)); c.HL(0, 0, W, K(R, 3)); c.HL(0, 3, W, K(R, -2))
    for i in range(0, W, 8): c.R(i + 1, 1, 6, 2, K(R, 3))
    c.HL(0, T - 1, W, K(R, -3)); c.HL(0, T - 2, W, K(R, -2)); c.HL(0, T - 3, W, K(R, -1))
    return c


def hip_band(n, mat='kawara', T=32):
    """3면 우진각: 앞 경사(가로 기와줄, 주기 8) + 좌·우 경사(왼쪽 첫 칸·오른쪽 끝 칸 안). 능선 + 추녀마루."""
    W = n * 16; c = Cv(W, T); rl = 12; tb = 6
    xl = lambda j: rl * (1 - j / T)
    for j in range(T):
        for i in range(W):
            a = xl(j); b = W - a; face = None
            if i < a:
                yb = tb * (1 - i / rl)
                if j >= yb: face = 'L'
            elif i >= b:
                ib = W - 1 - i; yb = tb * (1 - ib / rl)
                if j >= yb: face = 'R'
            else: face = 'F'
            if face is None: continue
            if face == 'F':
                r = j // 4; off = 4 if r % 2 else 0; u = (i + off) % 8; v = j % 4
                t = 3 if r < 2 else 2 if r < 5 else 1
                if r >= T // 4 - 1: t = 0
                col = K(mat, t - 3) if v == 3 else K(mat, t - 2) if u == 7 else K(mat, t + 2) if v == 0 else K(mat, t + 1) if u == 0 else K(mat, t)
            else:
                d = i if face == 'L' else W - 1 - i; cidx = d // 4; off = 3 if cidx % 2 else 0; u = d % 4; v = (j + off) % 6
                t = (3 if face == 'L' else 0) - (1 if d < 5 else 0)
                col = K(mat, t - 3) if u == 0 else K(mat, t - 2) if v == 5 else K(mat, t + 2) if v == 0 else K(mat, t + 1) if (u == 3 or (v == 1 and u < 3)) else K(mat, t)
            c.P(i, j, col)
    for i in range(rl, W - rl):
        c.P(i, 0, K(mat, 5)); c.P(i, 1, K(mat, 4)); c.P(i, 2, K(mat, -1))
    for j in range(T):
        a = int(xl(j)); b = W - 1 - a
        c.P(a, j, K(mat, 5)); c.P(a + 1, j, K(mat, 4)); c.P(a - 1, j, K(mat, -3)) if a >= 1 else None; c.P(a + 2, j, K(mat, -2))
        c.P(b, j, K(mat, 3)); c.P(b - 1, j, K(mat, 2)); c.P(b + 1, j, K(mat, -3)) if b + 1 < W else None; c.P(b - 2, j, K(mat, -2))
    for i in range(0, rl):
        yb = int(tb * (1 - i / rl)); c.P(i, yb, K(mat, -3)); c.P(W - 1 - i, yb, K(mat, -3))
    for j in range(tb, T): c.P(0, j, K(mat, -3)); c.P(1, j, K(mat, -2)); c.P(W - 1, j, K(mat, -3)); c.P(W - 2, j, K(mat, -3))
    c.HL(0, T - 1, W, K(mat, -3)); c.HL(0, T - 2, W, K(mat, -2)); c.HL(0, T - 3, W, K(mat, -1))
    return c
