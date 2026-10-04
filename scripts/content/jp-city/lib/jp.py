"""일본 골목 v1 — 16px, modern3 램프. 카페 때 만든 잉크 패스(post.py) 재사용."""
import os, sys, random, math
import numpy as np
from PIL import Image
import jpenv
from modern_style_bible_proof import K, Cv, hero
import post
W, H = 336, 262
ROAD0, ROAD1 = 152, 204          # 길 y 범위
def H32(x, y, s=0): return ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff

def hiproof(c, x, y, w, h, mat='kawara', inset=10, seed=1):
    """우진각(사다리꼴) 기와지붕: 능선 줄이 위, 처마가 아래. 기와 줄 4px, 마루 밝은 줄, 왼쪽 경사면 밝고 오른쪽 어둡다."""
    for j in range(h):
        ins = int(inset * (1 - j / max(h - 1, 1)))
        t0 = 3 if j < 3 else 2 if j < h * .35 else 1 if j < h * .7 else 0
        for i in range(ins, w - ins):
            col = K(mat, t0)
            row = j // 4; off = 4 if row % 2 else 0
            if j % 4 == 3: col = K(mat, t0 - 2)                      # 줄 아래 그늘
            elif (i + off) % 8 == 0: col = K(mat, t0 - 1)           # 기와 골
            elif j % 4 == 0: col = K(mat, min(t0 + 1, 5))           # 줄 위 빛
            elif H32(i, j, seed) % 9 == 0: col = K(mat, t0 + (1 if H32(i, j, 7) & 1 else -1))
            if i < ins + 2 and ins > 0: col = K(mat, t0 + 1)        # 왼쪽 모서리 빛
            if i >= w - ins - 2 and ins > 0: col = K(mat, t0 - 2)   # 오른쪽 경사면 그늘
            c.P(x + i, y + j, col)
    c.HL(x + inset, y, w - 2 * inset, K(mat, 5)); c.HL(x + inset, y + 1, w - 2 * inset, K(mat, 4))  # 용마루
    for i in range(inset, w - inset, 6): c.R(x + i, y - 1, 3, 2, K(mat, 4))                          # 마루 기와
    # 처마 그림자(벽 위)
    for k in range(4): c.HL(x + 1, y + h + k, w - 2, K('kinari', -2 + k // 2) if False else K('conc', -3 + k // 2))

def plaster(c, x, y, w, h, mat='kinari', seed=2):
    c.R(x, y, w, h, K(mat, 1))
    for j in range(h):
        for i in range(w):
            r = H32(x + i, y + j, seed) % 23
            if r == 0: c.P(x + i, y + j, K(mat, 0))
            elif r == 1: c.P(x + i, y + j, K(mat, 2))
    c.VL(x, y, h, K(mat, 2)); c.VL(x + w - 1, y, h, K(mat, -1))

def timber(c, x, y, h):
    c.R(x, y, 3, h, K('ita', 0)); c.VL(x, y, h, K('ita', 2)); c.VL(x + 2, y, h, K('ita', -2))

def lattice_win(c, x, y, w, h, lit=False, seed=0):
    """격자창: 나무틀 + 세로 살 + 안쪽 종이/유리, 튀어나온 창턱 + 그림자."""
    c.R(x - 1, y - 1, w + 2, h + 2, K('ita', -3)); c.R(x, y, w, h, K('mado', 1) if lit else K('kinari', 2))
    c.R(x, y, w, 2, K('mado', 0) if lit else K('kinari', 0))
    for i in range(x + 3, x + w - 1, 4): c.VL(i, y, h, K('ita', -1))
    for j in range(y + 5, y + h - 1, 6): c.HL(x, j, w, K('ita', -1))
    c.R(x - 2, y + h + 1, w + 4, 2, K('ita', 2)); c.HL(x - 2, y + h + 3, w + 4, K('ita', -2)); c.HL(x - 1, y + h + 4, w + 4, K('kinari', -1))

def slide_door(c, x, y, w, h, glass=True):
    """미닫이(격자 유리): 틀 + 세로 살 + 젖빛 유리 + 손잡이."""
    c.R(x - 1, y - 1, w + 2, h + 1, K('ita', -3)); c.R(x, y, w, h, K('ita', 0))
    for k in (0, 1):
        x0 = x + k * (w // 2)
        c.R(x + 1 + k * (w // 2), y + 2, w // 2 - 2, h - 8, K('garasu', 4) if glass else K('ita', 1))
        for i in range(x0 + 4, x0 + w // 2 - 2, 4): c.VL(i, y + 2, h - 8, K('ita', -1))
        for j in range(y + 8, y + h - 8, 8): c.HL(x0 + 1, j, w // 2 - 2, K('ita', -1))
        c.R(x + 1 + k * (w // 2), y + 2, w // 2 - 2, 2, K('garasu', 2))
    c.VL(x + w // 2, y, h, K('ita', -2)); c.R(x + w // 2 - 3, y + h // 2, 1, 5, K('tekko', 4)); c.R(x + w // 2 + 2, y + h // 2, 1, 5, K('tekko', 4))
    c.R(x + 1, y + h - 5, w - 2, 5, K('ita', 2)); c.HL(x + 1, y + h - 5, w - 2, K('ita', 4))

def eave(c, x, y, w, mat='kawara', d=8):
    """작은 차양 지붕(히사시): 기와 면 + 그 밑 그림자 3단."""
    for j in range(d):
        for i in range(w):
            t = 2 if j < 2 else 1 if j < d - 2 else -1
            col = K(mat, t if (i // 4 + j // 2) % 2 else t - 1)
            c.P(x + i, y + j, col)
    c.HL(x, y, w, K(mat, 4)); c.HL(x, y + d - 1, w, K(mat, -3))
    for k in range(3): c.HL(x + 1, y + d + k, w - 2, K('ita', -3 + k // 2) if False else K('conc', -3 + k // 2))

def noren(c, x, y, w, h, col='sora'):
    """노렌: 가로봉 + 세 갈래 천, 흰 글자 블록, 아랫단 물결."""
    c.R(x - 2, y - 2, w + 4, 2, K('ita', 0)); c.HL(x - 2, y - 2, w + 4, K('ita', 3))
    n = 3; pw = w // n
    for k in range(n):
        x0 = x + k * pw
        c.R(x0 + 1, y, pw - 2, h, K(col, 1)); c.VL(x0 + 1, y, h, K(col, 2)); c.VL(x0 + pw - 2, y, h, K(col, -1))
        for j in range(y + 3, y + h - 6, 6): c.R(x0 + pw // 2 - 2, j, 4, 3, K('shiro', 3)); c.HL(x0 + pw // 2 - 2, j, 4, K('shiro', 4))
        c.HL(x0 + 1, y + h - 1, pw - 2, K(col, -2))
    for i in range(x, x + w): c.P(i, y + h, K('conc', -3)) if i % 2 == 0 else None

def vsign(c, x, y, w, h, col='aka'):
    """세로 돌출 간판: 벽 위로 튀어나온 판 + 흰 글자 블록(세로) + 윗면 + 그림자."""
    c.R(x + 1, y - 2, w, 2, K(col, 4)); c.R(x, y, w, h, K(col, 1)); c.VL(x, y, h, K(col, 3)); c.VL(x + w - 1, y, h, K(col, -1)); c.HL(x, y + h - 1, w, K(col, -2))
    for j in range(y + 3, y + h - 4, 6):
        c.R(x + 2, j, w - 4, 3, K('kinari', 3)); c.HL(x + 2, j, w - 4, K('kinari', 4)); c.P(x + 3, j + 1, K(col, 0))
    for j in range(h + 2): c.P(x + w, y + j, K('conc', -2)) ; c.P(x + w + 1, y + j + 1, K('conc', -3)) if j % 2 == 0 else None

def chochin(c, x, y):
    c.R(x + 2, y - 3, 6, 2, K('tekko', 1)); c.R(x, y, 10, 11, K('aka', 2)); c.R(x + 1, y - 1, 8, 1, K('aka', 1))
    c.VL(x, y, 11, K('aka', 3)); c.VL(x + 9, y, 11, K('aka', 0)); c.R(x + 3, y + 3, 4, 4, K('kinari', 3)); c.P(x + 4, y + 4, K('aka', 1))
    for j in (3, 6, 9): c.HL(x + 1, y + j, 8, K('aka', 1))
    c.R(x + 2, y + 11, 6, 2, K('tekko', 1))

def ac_unit(c, x, y):
    c.R(x, y, 14, 4, K('tekko', 3)); c.HL(x, y, 14, K('tekko', 5)); c.R(x, y + 4, 14, 8, K('tekko', 2)); c.R(x + 1, y + 6, 8, 5, K('tekko', 0))
    for i in range(x + 2, x + 9, 2): c.VL(i, y + 6, 5, K('tekko', 1))
    c.VL(x + 13, y + 4, 8, K('tekko', 0)); c.HL(x, y + 12, 14, K('conc', -3)); c.HL(x + 1, y + 13, 14, K('conc', -2))
    for k in range(5): c.P(x + 12, y + 14 + k, K('conc', -1))

def vending(c, x, base, cols=('aka', 'sora', 'midori', 'daidai')):
    """자판기 16×32: 윗면 + 앞면(상품 창 + 버튼 + 배출구) + 오른쪽 그림자."""
    h = 32; y = base - h
    c.R(x, y, 16, 3, K('shiro', 3)); c.HL(x, y, 16, K('shiro', 4))
    c.R(x, y + 3, 16, h - 3, K(cols[0], 1)); c.VL(x, y + 3, h - 3, K(cols[0], 3)); c.VL(x + 15, y + 3, h - 3, K(cols[0], -1))
    c.R(x + 2, y + 5, 12, 12, K('garasu', 0))
    for k, cc in enumerate(('aka', 'sora', 'midori', 'kii', 'daidai', 'sora', 'aka', 'midori', 'kii', 'pinku' if False else 'daidai', 'sora', 'aka')):
        c.R(x + 3 + (k % 4) * 3, y + 6 + (k // 4) * 4, 2, 3, K(cc, 2)); c.P(x + 3 + (k % 4) * 3, y + 6 + (k // 4) * 4, K(cc, 4))
    for k in range(4): c.R(x + 3 + k * 3, y + 19, 2, 2, K('kii', 2) if k == 1 else K('tekko', 3))
    c.R(x + 3, y + 23, 10, 5, K('tekko', -1)); c.HL(x + 3, y + 23, 10, K('tekko', -2))
    c.R(x + 11, y + 19, 3, 2, K('shiro', 2))
    c.R(x + 16, y + 5, 3, h - 4, K('conc', -2)); c.HL(x, base, 19, K('conc', -3))

def bike(c, x, base):
    for cx in (x + 4, x + 18):
        for k in range(16): c.P(int(cx + 4.6 * math.cos(k / 16 * 6.283)), int(base - 5 + 4.6 * math.sin(k / 16 * 6.283)), K('tekko', -1))
        c.P(cx, base - 5, K('tekko', 3))
    c.HL(x + 4, base - 5, 14, K('sora', 1)); c.R(x + 11, base - 11, 2, 7, K('sora', 1)); c.HL(x + 9, base - 12, 6, K('tekko', 0))
    c.R(x + 17, base - 13, 2, 8, K('sora', 1)); c.HL(x + 16, base - 14, 5, K('tekko', 0)); c.R(x + 20, base - 14, 4, 4, K('tekko', 1)); c.HL(x + 20, base - 14, 4, K('tekko', 3))   # 앞 바구니
    c.HL(x + 2, base, 22, K('yoru', -1))

def block_wall(c, x, y, w, h):
    """블록담: 콘크리트 블록 16×8(구멍 블록) + 윗면 + 그림자."""
    c.R(x, y, w, 3, K('conc', 4)); c.HL(x, y, w, K('conc', 6))
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + 3 + j, K('conc', 2 if (i % 16 not in (0,) and j % 8 != 0) else 0))
    for j in range(0, h, 8):
        for i in range(((j // 8) % 2) * 8, w, 16):
            c.R(x + i + 5, y + 3 + j + 3, 6, 2, K('conc', 0)) if H32(i, j) % 3 == 0 else None
    c.HL(x, y + 3 + h - 1, w, K('conc', -2))

def pole(c, x, base, top=-10):
    """콘크리트 전봇대 + 변압기 통 + 완금(횡목) + 애자. 줄 전선은 wires()."""
    h = base - top
    c.R(x, top, 6, h, K('hodo', 3)); c.VL(x, top, h, K('hodo', 5)); c.VL(x + 5, top, h, K('hodo', 0))
    for j in range(top + 20, base, 18): c.HL(x, j, 6, K('hodo', 1))
    c.R(x - 14, top + 6, 34, 3, K('ita', 1)); c.HL(x - 14, top + 6, 34, K('ita', 3)); c.HL(x - 14, top + 9, 34, K('ita', -2))
    for ix in (x - 12, x - 4, x + 9, x + 17): c.R(ix, top + 1, 3, 5, K('shiro', 1)); c.R(ix, top, 3, 1, K('shiro', 3))
    c.R(x - 3, top + 22, 12, 20, K('tekko', 2)); c.R(x - 3, top + 22, 12, 3, K('tekko', 4)); c.VL(x - 3, top + 25, 17, K('tekko', 3)); c.VL(x + 8, top + 25, 17, K('tekko', 0)); c.HL(x - 3, top + 41, 12, K('tekko', -1))
    c.R(x + 9, top + 24, 3, 18, K('conc', -2))
    c.R(x - 2, base - 14, 10, 7, K('ki', -1)) if False else None
    c.R(x - 1, base - 34, 8, 6, K('kii', 2)); c.HL(x - 1, base - 34, 8, K('kii', 4)); c.R(x + 1, base - 32, 4, 2, K('tekko', 0))   # 주의 표지
    c.HL(x - 2, base, 11, K('yoru', -2)); c.HL(x - 1, base + 1, 11, K('yoru', -2))

def wires(c, pts_x, y_top, sag=7, n=4, col=None):
    col = col or K('tekko', -1)
    for k in range(n):
        yb = y_top + k * 2
        for a, b in zip(pts_x, pts_x[1:]):
            for x in range(a, b + 1):
                t = (x - a) / max(b - a, 1); y = yb + int(sag * 4 * t * (1 - t)) + (1 if k else 0)
                c.P(x, y, col)

def house_kawara(W_, H_, seed):
    """기와지붕 단층집: 지붕(우진각) + 회벽 + 나무 기둥·격자창·미닫이 + 실외기 + 블록담 일부."""
    c = Cv(W_, H_)
    RH = 40
    hiproof(c, 0, 0, W_, RH, 'kawara', 12, seed)
    wy = RH + 4
    plaster(c, 2, wy, W_ - 4, H_ - wy - 6, 'kinari', seed)
    for k in range(4): c.HL(2, wy + k, W_ - 4, K('conc', -3 + k // 2) if False else K('kinari', -2 + k // 2))
    timber(c, 2, wy, H_ - wy - 6); timber(c, W_ - 5, wy, H_ - wy - 6)
    c.R(2, wy + 4, W_ - 4, 3, K('ita', 0)); c.HL(2, wy + 4, W_ - 4, K('ita', 2)); c.HL(2, wy + 6, W_ - 4, K('ita', -2))   # 들보
    lattice_win(c, 10, wy + 14, 22, 16, lit=(seed % 2 == 0))
    slide_door(c, W_ - 38, wy + 10, 26, 34)
    ac_unit(c, 44, wy + 22) if W_ > 88 else None
    c.R(0, H_ - 8, W_, 8, K('conc', 2)); c.HL(0, H_ - 8, W_, K('conc', 5)); c.HL(0, H_ - 1, W_, K('conc', -2))    # 기초
    for x in range(8, W_, 16): c.VL(x, H_ - 7, 7, K('conc', 0))
    return c

def shop_noren(W_, H_, seed):
    """2층 회벽 상가 + 기와 차양 + 노렌 + 제등 + 세로 돌출 간판."""
    c = Cv(W_, H_)
    c.R(0, 0, W_, 26, K('conc', 1)); c.R(0, 0, W_, 6, K('conc', 0)); c.HL(0, 0, W_, K('conc', 4))                    # 납작 옥상 난간
    c.R(8, 8, 16, 10, K('tekko', 2)); c.HL(8, 8, 16, K('tekko', 4)); c.R(9, 12, 9, 5, K('tekko', 0))
    c.R(34, 10, 4, 14, K('tekko', 1)); c.HL(32, 10, 8, K('tekko', 3))                                                # 안테나대
    for k in range(3): c.HL(0, 26 + k, W_, K('conc', 4 - k))
    c.HL(0, 29, W_, K('conc', -2))
    plaster(c, 0, 30, W_, 36, 'shiro', seed)
    for k in range(3): c.HL(0, 30 + k, W_, K('conc', -2 + k))
    lattice_win(c, 10, 38, 20, 16, lit=True); lattice_win(c, W_ - 34, 38, 20, 16)
    c.R(W_ - 38, 52, 28, 2, K('tekko', 2)); c.HL(W_ - 38, 52, 28, K('tekko', 4))     # 베란다 난간
    for i in range(W_ - 38, W_ - 10, 3): c.VL(i, 54, 6, K('tekko', 1))
    c.HL(0, 66, W_, K('conc', 5)); c.R(0, 67, W_, 2, K('conc', 3)); c.HL(0, 69, W_, K('conc', -1)); c.HL(0, 70, W_, K('conc', -3))
    # 1층 가게
    plaster(c, 0, 71, W_, H_ - 71, 'shiro', seed + 1)
    for k in range(3): c.HL(0, 71 + k, W_, K('conc', -3 + k))
    eave(c, 3, 74, W_ - 6, 'kawara', 8)
    noren(c, 18, 86, W_ - 36 - 14, 22, 'sora')
    c.R(10, 82, W_ - 20, 26, K('ita', -3)) if False else None
    chochin(c, 4, 92); chochin(c, W_ - 14 - 14, 92)
    slide_door(c, 22, 92, W_ - 50, 36) if False else None
    c.R(0, H_ - 8, W_, 8, K('hodo', 2)); c.HL(0, H_ - 8, W_, K('hodo', 5)); c.HL(0, H_ - 1, W_, K('hodo', -1))
    vsign(c, W_ - 18, 34, 12, 40, 'aka')
    return c

def apt(W_, H_, seed):
    """타일 벽 2층 연립(소형 맨션): 난간 베란다 + 빨래 + 에어컨 + 1층 출입구 + 자판기 공간."""
    c = Cv(W_, H_)
    c.R(0, 0, W_, 14, K('tairu', 1)); c.HL(0, 0, W_, K('tairu', 4)); c.HL(0, 13, W_, K('tairu', -1))
    for k in range(3): c.HL(0, 14 + k, W_, K('conc', 4 - k))
    c.R(0, 16, W_, 50, K('tairu', 2))
    for j in range(16, 66, 6):
        c.HL(0, j, W_, K('tairu', 0))
        for i in range(((j // 6) % 2) * 6, W_, 12): c.VL(i, j, 6, K('tairu', 0))
    for j in range(17, 66, 6): c.HL(0, j, W_, K('tairu', 4)) if False else None
    for k in range(3): c.HL(0, 16 + k, W_, K('tairu', -2 + k))
    for x in (6, 40):
        c.R(x - 1, 26, 26, 28, K('tairu', -3)); c.R(x, 27, 24, 26, K('garasu', 1)); c.R(x, 27, 24, 4, K('garasu', 0))
        c.VL(x + 12, 27, 26, K('tekko', 1))
        for k in range(8): c.P(x + 3 + k, 48 - k, K('garasu', 4))
        c.R(x - 2, 52, 28, 12, K('tekko', 1)); c.HL(x - 2, 52, 28, K('tekko', 4)); c.R(x - 2, 62, 28, 2, K('tekko', 3))
        for i in range(x - 1, x + 26, 4): c.VL(i, 54, 8, K('tekko', 0))
        c.HL(x - 2, 64, 28, K('tairu', -3)); c.HL(x - 1, 65, 28, K('tairu', -2))
    for i in range(10, 20, 1): c.P(i, 56 - (i % 3 == 0), K('shiro', 3))                  # 빨래
    c.R(9, 55, 12, 6, K('shiro', 3)); c.HL(9, 55, 12, K('tekko', 2)); c.R(11, 56, 4, 4, K('sora', 2)); c.R(16, 57, 3, 3, K('aka', 2))
    c.HL(0, 66, W_, K('conc', 5)); c.R(0, 67, W_, 2, K('conc', 3)); c.HL(0, 69, W_, K('conc', -1)); c.HL(0, 70, W_, K('tairu', -3))
    c.R(0, 71, W_, H_ - 71, K('conc', 2))
    for j in range(71, H_, 8):
        c.HL(0, j, W_, K('conc', 0))
        for i in range(((j // 8) % 2) * 8, W_, 16): c.VL(i, j, 8, K('conc', 0))
    for k in range(3): c.HL(0, 71 + k, W_, K('conc', -3 + k))
    slide_door(c, W_ - 30, 88, 22, 40, True)
    c.R(W_ - 32, 84, 26, 3, K('tekko', 2)); c.HL(W_ - 32, 84, 26, K('tekko', 4))
    c.R(0, H_ - 8, W_, 8, K('hodo', 2)); c.HL(0, H_ - 8, W_, K('hodo', 5)); c.HL(0, H_ - 1, W_, K('hodo', -1))
    return c

def tofu(W_, H_, seed):
    """목조 가게(두부집/담뱃가게): 널판 벽 + 줄무늬 차양 + 나무 진열대 + 간판 + 화분."""
    c = Cv(W_, H_)
    hiproof(c, 0, 0, W_, 32, 'kawara', 8, seed + 3)
    c.R(0, 36, W_, H_ - 36, K('ita', 1))
    for x in range(0, W_, 6):
        c.VL(x, 36, H_ - 36, K('ita', -1)); c.VL(x + 1, 36, H_ - 36, K('ita', 2))
        for j in range(36, H_, 9): c.P(x + 3, j + (x // 6) % 5, K('ita', 0))
    for k in range(4): c.HL(0, 36 + k, W_, K('ita', -3 + k // 2))
    c.R(4, 42, W_ - 8, 10, K('kinari', 2)); c.HL(4, 42, W_ - 8, K('kinari', 4)); c.HL(4, 51, W_ - 8, K('ita', -2)); c.R(3, 41, W_ - 6, 1, K('ita', 3))
    for i, n in enumerate((4, 5, 4)): c.R(10 + i * 14, 45, n, 4, K('aka', 1)); c.HL(10 + i * 14, 45, n, K('aka', 3))
    for i in range(3, W_ - 3):
        stripe = ((i - 3) // 6) % 2; col = K('midori', 2 if stripe else 3) if False else (K('shiro', 3) if stripe else K('aka', 2))
        c.R(i, 56, 1, 8, col)
    c.HL(3, 56, W_ - 6, K('shiro', 4)); c.HL(3, 64, W_ - 6, K('aka', 0))
    for i in range(3, W_ - 3): c.P(i, 65, K('ita', -3)); c.P(i, 66, K('ita', -3)) if i % 2 == 0 else None
    c.R(6, 70, W_ - 12, 34, K('ita', -3)); c.R(8, 72, W_ - 16, 30, K('mado', 1)); c.R(8, 72, W_ - 16, 3, K('mado', 0))
    for i in range(12, W_ - 14, 12): c.R(i, 86, 8, 2, K('ita', 1)); c.VL(i + 3, 88, 12, K('ita', -2)); c.R(i + 1, 83, 3, 3, K('kii', 2)); c.R(i + 5, 83, 3, 3, K('daidai', 2))
    c.R(4, 104, W_ - 8, 3, K('ita', 3)); c.HL(4, 104, W_ - 8, K('ita', 5)); c.HL(4, 107, W_ - 8, K('ita', -2))
    c.R(0, H_ - 8, W_, 8, K('hodo', 2)); c.HL(0, H_ - 8, W_, K('hodo', 5)); c.HL(0, H_ - 1, W_, K('hodo', -1))
    return c

def put(sc, cv, x, y, ink=True):
    a = cv.a
    if ink:
        a = post.dither_band(a, a.shape[0] - 26, a.shape[0] - 8, -1, 0, fams=('kinari', 'shiro', 'conc', 'ita'))
        a = post.speckle(a, x + y, ('kinari', 'shiro', 'conc'), 0.012)
        a = post.contour(a)
    for j in range(a.shape[0]):
        for i in range(a.shape[1]):
            if a[j, i, 3] and 0 <= x + i < sc.w and 0 <= y + j < sc.h: sc.a[y + j, x + i] = a[j, i]

def cast(sc, x, y, w, h, depth=3, side=5, tall=60):
    for j in range(depth):
        for i in range(w + side):
            px, py = x + i, y + h + j
            if 0 <= px < sc.w and py < sc.h and sc.a[py, px, 3]: sc.a[py, px, :3] = post.step(sc.a[py, px], -2)
    for j in range(h - tall, h):
        for i in range(side):
            px, py = x + w + i, y + j
            if 0 <= px < sc.w and 0 <= py < sc.h and sc.a[py, px, 3]: sc.a[py, px, :3] = post.step(sc.a[py, px], -2)

def road(sc):
    for y in range(ROAD0, ROAD1):
        for x in range(sc.w):
            r = H32(x, y, 3) % 17
            sc.P(x, y, K('yoru', 1) if r > 1 else (K('yoru', 2) if r == 0 else K('yoru', 0)))
    # 측구(배수 그레이팅) + 갓길 흰 실선
    for x in range(sc.w):
        sc.P(x, ROAD0, K('hodo', 4)); sc.P(x, ROAD0 + 1, K('hodo', 2)); sc.P(x, ROAD0 + 2, K('yoru', -1))
        sc.P(x, ROAD0 + 6, K('shiro', 3)); sc.P(x, ROAD0 + 7, K('shiro', 1)) if x % 14 else None
        sc.P(x, ROAD1 - 8, K('shiro', 3)); sc.P(x, ROAD1 - 7, K('shiro', 1))
        sc.P(x, ROAD1 - 1, K('hodo', 4)); sc.P(x, ROAD1 - 2, K('hodo', 2))
    for x in range(12, sc.w, 44):
        sc.R(x, ROAD0 + 3, 10, 2, K('tekko', 0));
        for k in range(0, 10, 2): sc.P(x + k, ROAD0 + 3, K('tekko', 2))
    # 차 지나간 바퀴 자국, 균열
    rnd = random.Random(9)
    for _ in range(16):
        x = rnd.randint(0, sc.w - 20); y = rnd.randint(ROAD0 + 12, ROAD1 - 14)
        for k in range(rnd.randint(6, 16)): sc.P(x + k, y + (k // 5), K('yoru', -1))
    # 노면 표시 「止まれ」 대신 마름모 횡단예고(삼각) — 간단히 흰 마름모
    for k in range(6): sc.HL(236 + 6 - k, 140 + k, 2 * k + 1, K('shiro', 2)) if False else None

def sidewalk_south(sc):
    y0 = ROAD1
    for y in range(y0, sc.h):
        for x in range(sc.w):
            sc.P(x, y, K('conc', 1))
    for y in range(y0 + 2, sc.h):
        for x in range(sc.w):
            if x % 24 == 0 or (y - y0) % 24 == 0: sc.P(x, y, K('conc', -1))
            elif x % 24 == 1 or (y - y0) % 24 == 1: sc.P(x, y, K('conc', 2))
    for x in range(sc.w): sc.P(x, y0, K('hodo', 4)); sc.P(x, y0 + 1, K('hodo', 2))

def build():
    sc = Cv(W, H)
    # 하늘
    for y in range(0, 46):
        for x in range(W):
            t = 5 - y // 18; sc.P(x, y, K('garasu', t if (x + y) % 2 or y % 18 > 3 else t - 1))
    # 뒤쪽 원경: 먼 건물 실루엣
    for x0, w0, h0 in ((0, 38, 26), (52, 30, 34), (130, 46, 22), (232, 34, 30), (290, 50, 24)):
        sc.R(x0, 46 - h0, w0, h0, K('tairu', 3)); sc.R(x0, 46 - h0, w0, 2, K('tairu', 4))
        for i in range(x0 + 4, x0 + w0 - 4, 7): sc.R(i, 46 - h0 + 6, 3, 3, K('tairu', 1))
    sc.R(0, 46, W, ROAD0 - 46, K('conc', 0))
    y0 = 4
    parts = [(house_kawara(88, 120, 1), 0), (shop_noren(84, 120, 2), 88), (apt(88, 120, 3), 172), (tofu(76, 120, 4), 260)]
    for cv, x in parts:
        pass
    # 지붕이 하늘에 닿지 않게 모든 건물을 같은 지면선(ROAD0)에 맞춘다
    for cv, x in parts:
        yy = ROAD0 - cv.h
        put(sc, cv, x, yy); cast(sc, x, yy, cv.w, cv.h)
    road(sc); sidewalk_south(sc)
    # 북쪽 길가 소품
    v = 172 + 6
    vending(sc, 180, ROAD0 - 1); vending(sc, 200, ROAD0 - 1, ('sora', 'aka'))
    bike(sc, 40, ROAD0 - 1)
    # 남쪽: 블록담 + 전봇대 + 자전거 + 화분
    block_wall(sc, 0, ROAD1 + 8, 140, 22); block_wall(sc, 196, ROAD1 + 8, 140, 22)
    # 담 뒤 식재(소나무 느낌 대신 가로수 윗부분)
    for x0 in (22, 70, 226, 290):
        for j in range(12):
            for i in range(24):
                if (i - 12) ** 2 + (j - 8) ** 2 * 1.8 <= 110: sc.P(x0 + i, ROAD1 - 6 + j, K('ki', 4 if j < 3 else 3 if j < 6 else 2 if j < 9 else 1) if (i * 3 + j * 5) % 7 else K('ki', 5 if j < 6 else 0))
    pole(sc, 256, ROAD1 + 30, top=8)
    wires(sc, [-10, 256, 350], 18, sag=8, n=4)
    wires(sc, [256, 350], 30, sag=4, n=2, col=K('tekko', 0))
    # 그림자 길 위 (전봇대)
    for k in range(18): sc.P(264 + k, ROAD1 + 28 + k // 6, K('conc', -2))
    hero(sc, 132, ROAD1 - 38)
    return sc

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    sc = build(); im = sc.img(); im.save('out/jp.png'); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save('out/jp-3x.png')
