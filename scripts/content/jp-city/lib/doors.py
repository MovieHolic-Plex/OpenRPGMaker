"""출입문 부착물 — 가로 2칸(machiya 만 3칸) x 세로 3칸(48px). 문은 띠에서 분리돼 임의 열에 얹는다. 문 높이 약 30px(주인공 24px)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from paint import K, Cv, shade, door_cells
import tune, post

def _fin(c):
    a = c.a.copy(); a = tune.ink(post.contour(a), edge=3, inner=2, soft=1); c.a[:] = a; return c
def _step(c, x, w):
    c.R(x, 44, w, 2, K('hodo', 5)); c.HL(x, 44, w, K('hodo', 6)); c.HL(x, 45, w, K('hodo', -1))
def lattice():
    c = Cv(32, 48); door_cells(c, 32); return _fin(c)
def auto():
    """편의점 자동문: 알루미늄 틀 + 청회색 유리 2짝 + 위 센서 띠. 노란 유리·가로 선반 느낌 제거."""
    c = Cv(32, 48)
    c.R(1, 11, 30, 33, K('conc', 3)); c.HL(1, 11, 30, K('shiro', 4)); c.VL(1, 11, 33, K('conc', 4)); c.VL(30, 11, 33, K('conc', 0))
    c.R(3, 13, 26, 4, K('conc', 1)); c.HL(3, 13, 26, K('shiro', 3)); c.R(14, 14, 4, 2, K('tekko', -2)); c.P(15, 14, K('aka', 3))
    for x0 in (3, 17):
        c.R(x0, 18, 12, 25, K('garasu', 1)); c.R(x0, 18, 12, 4, K('garasu', 0)); c.VL(x0, 18, 25, K('garasu', 3))
        for q in range(7): c.P(x0 + 2 + q, 36 - q, K('garasu', 4)); c.P(x0 + 4 + q, 37 - q, K('garasu', 3)) if q < 5 else None
        c.R(x0 + (9 if x0 == 3 else 0), 28, 3, 9, K('conc', 4))                    # 손잡이 대신 닿는 띠
    c.VL(15, 18, 25, K('conc', 1)); c.VL(16, 18, 25, K('conc', -1))
    c.R(3, 41, 26, 2, K('conc', -1)); c.R(4, 31, 6, 4, K('shiro', 3)); c.P(6, 33, K('aka', 2))          # 아랫레일 + 스티커
    _step(c, 1, 30); return _fin(c)

def lobby():
    """아파트 공용현관: 알루미늄 유리 여닫이 한 짝 + 벽에 붙은 작은 인터폰(작게). 키패드·표시창·우편함 칸은 크게 그리지 않는다."""
    c = Cv(32, 48)
    c.R(2, 11, 28, 33, K('conc', 2)); c.HL(2, 11, 28, K('conc', 4)); c.VL(29, 11, 33, K('conc', -1))
    c.R(4, 13, 18, 31, K('conc', 4)); c.VL(4, 13, 31, K('shiro', 4)); c.VL(21, 13, 31, K('conc', 0))
    c.R(6, 15, 14, 28, K('garasu', 1)); c.R(6, 15, 14, 4, K('garasu', 0)); c.VL(6, 15, 28, K('garasu', 3))
    for q in range(8): c.P(8 + q, 31 - q, K('garasu', 4))
    c.R(6, 33, 14, 1, K('conc', 4)); c.R(18, 28, 2, 8, K('shiro', 4)); c.R(7, 41, 12, 2, K('conc', 1))
    c.R(24, 22, 4, 6, K('tekko', 1)); c.HL(24, 22, 4, K('tekko', 3)); c.P(25, 23, K('midori', 3)); c.P(26, 25, K('shiro', 3)); c.P(26, 26, K('shiro', 3))
    c.R(24, 32, 4, 5, K('conc', 1)); c.HL(24, 32, 4, K('shiro', 3)); c.HL(24, 35, 4, K('conc', -1))
    _step(c, 1, 30); return _fin(c)

def steel():
    """철제 방화문(비상구형): 한 장짜리 넓은 문짝(≈20px) — 자판기와 폭·창 구성이 다르게. 위에 얇은 환기창, 가운데 구획 2개, 레버 손잡이, 아래 보강판."""
    c = Cv(32, 48)
    c.R(3, 11, 26, 33, K('hodo', 0)); c.R(4, 12, 24, 32, K('tekko', -1))
    c.R(5, 13, 22, 30, K('tekko', 2)); c.VL(5, 13, 30, K('tekko', 4)); c.VL(26, 13, 30, K('tekko', -1)); c.HL(5, 13, 22, K('tekko', 4))
    for x0 in range(8, 21, 4): c.R(x0, 15, 2, 5, K('tekko', -2))                        # 환기 루버
    c.R(8, 23, 16, 8, K('tekko', 1)); c.HL(8, 23, 16, K('tekko', 3)); c.HL(8, 30, 16, K('tekko', -2))
    c.R(8, 33, 16, 7, K('tekko', 1)); c.HL(8, 33, 16, K('tekko', 3)); c.HL(8, 39, 16, K('tekko', -2))
    c.R(22, 28, 3, 6, K('shiro', 3)); c.P(23, 27, K('shiro', 4))                          # 레버 손잡이
    c.R(5, 41, 22, 2, K('tekko', -2))
    c.R(13, 7, 6, 3, K('midori', 1)); c.HL(13, 7, 6, K('midori', 4)); c.P(15, 8, K('shiro', 4)); c.P(16, 8, K('shiro', 4))   # 비상구 표지(작게, 문 위)
    _step(c, 2, 28); return _fin(c)

def cafe():
    c = Cv(32, 48)
    c.R(6, 11, 20, 33, K('ita', -3)); c.R(8, 13, 16, 30, K('ita', 1)); c.VL(8, 13, 30, K('ita', 3)); c.VL(23, 13, 30, K('ita', -1)); c.HL(8, 13, 16, K('ita', 3))
    c.R(10, 15, 12, 14, K('mado', 1)); c.R(10, 15, 12, 3, K('mado', 0)); c.VL(16, 15, 14, K('ita', -1))
    for q in range(5): c.P(12 + q, 25 - q, K('mado', 4))
    c.R(10, 31, 12, 10, K('ita', 0)); c.HL(10, 31, 12, K('ita', 2)); c.HL(10, 40, 12, K('ita', -2))
    c.R(22, 27, 2, 4, K('kii', 3)); c.P(23, 27, K('kii', 4))
    for j in range(8):
        for i in range(8):
            d = (i - 3.5) ** 2 + (j - 3.5) ** 2
            if d <= 14: c.P(13 + i, 18 + j, K('aka', 2) if d > 8 else K('shiro', 3))
    c.R(2, 12, 3, 30, K('midori', 0)); c.R(27, 12, 3, 30, K('midori', 0)); c.R(1, 38, 5, 6, K('daidai', 1)); c.R(26, 38, 5, 6, K('daidai', 1))
    _step(c, 5, 22); return _fin(c)
def noren():
    c = Cv(32, 48)
    c.R(3, 12, 26, 32, K('ita', -3)); c.R(5, 14, 22, 30, K('mado', 0)); c.R(5, 14, 22, 4, K('ita', -2))
    for i in range(6, 26, 4): c.VL(i, 24, 20, K('ita', -1))
    for x0 in (2, 17):
        c.R(x0, 12, 13, 18, K('kon', -1)); c.VL(x0, 12, 18, K('kon', 1)); c.VL(x0 + 12, 12, 18, K('kon', -2)); c.HL(x0, 12, 13, K('kon', 2)); c.HL(x0, 29, 13, K('shiro', 2))
        for yy in range(16, 26):
            for xx in range(x0 + 4, x0 + 9):
                if (xx - x0 - 6) ** 2 + (yy - 21) ** 2 <= 9 and (xx - x0 - 6) ** 2 + (yy - 21) ** 2 >= 2: c.P(xx, yy, K('shiro', 4))
    c.VL(15, 12, 18, K('kon', -2)); c.VL(16, 12, 18, K('kon', -2))
    _step(c, 3, 26); return _fin(c)
def rollup():
    c = Cv(32, 48)
    c.R(1, 11, 30, 33, K('hodo', 0)); c.R(3, 13, 26, 31, K('tekko', -3))
    for j in range(13, 25, 3): c.HL(3, j, 26, K('tekko', 3)); c.HL(3, j + 1, 26, K('tekko', 1)); c.HL(3, j + 2, 26, K('tekko', -1))
    c.R(3, 25, 26, 2, K('kii', 2))
    c.R(5, 33, 22, 9, K('tekko', -2)); c.R(7, 35, 4, 3, K('shiro', 3)); c.R(21, 35, 4, 3, K('shiro', 3)); c.R(12, 30, 8, 6, K('hodo', 2))
    c.R(1, 44, 30, 2, K('hodo', 5)); c.HL(1, 44, 30, K('hodo', 6)); c.HL(1, 45, 30, K('hodo', -1)); return _fin(c)
def machiya():
    c = Cv(48, 48)
    c.R(2, 11, 44, 33, K('ita', -3)); c.R(4, 13, 40, 5, K('ita', 1)); c.HL(4, 13, 40, K('ita', 3))
    for x0 in (4, 25):
        c.R(x0, 18, 19, 25, K('ita', -1)); c.R(x0 + 1, 19, 17, 17, K('kinari', 3))
        for i in range(x0 + 3, x0 + 17, 3): c.VL(i, 19, 17, K('ita', -1)); c.VL(i + 1, 19, 17, K('ita', 2))
        c.HL(x0 + 1, 27, 17, K('ita', 0)); c.R(x0 + 1, 36, 17, 7, K('ita', 1)); c.HL(x0 + 1, 36, 17, K('ita', 3))
    c.VL(23, 18, 25, K('ita', -3)); c.VL(24, 18, 25, K('ita', -3)); c.R(21, 28, 1, 5, K('kii', 3)); c.R(26, 28, 1, 5, K('kii', 3))
    c.R(6, 11, 36, 4, K('kon', 0)); c.HL(6, 11, 36, K('kon', 2))
    c.R(1, 44, 46, 2, K('hodo', 5)); c.HL(1, 44, 46, K('hodo', 6)); c.HL(1, 45, 46, K('hodo', -1)); return _fin(c)
def house():
    c = Cv(32, 48)
    c.R(6, 11, 20, 33, K('ita', -3)); c.R(8, 13, 16, 30, K('ita', 0)); c.VL(8, 13, 30, K('ita', 2)); c.VL(23, 13, 30, K('ita', -2))
    c.R(11, 15, 3, 14, K('garasu', 1)); c.HL(11, 15, 3, K('garasu', 3)); c.R(18, 15, 3, 14, K('garasu', 1))
    for j in (31, 37): c.R(10, j, 12, 1, K('ita', -2)); c.HL(10, j + 1, 12, K('ita', 2))
    c.R(20, 26, 2, 5, K('kii', 3)); c.R(26, 14, 4, 3, K('shiro', 3)); c.R(26, 19, 3, 4, K('tekko', -1)); c.P(27, 20, K('midori', 3))
    c.R(2, 8, 4, 5, K('shiro', 2)); c.R(2, 6, 4, 2, K('kii', 3))
    _step(c, 4, 24); return _fin(c)
BUILDERS = {'lattice': lattice, 'auto': auto, 'lobby': lobby, 'steel': steel, 'cafe': cafe, 'noren': noren, 'rollup': rollup, 'machiya': machiya, 'house': house}
