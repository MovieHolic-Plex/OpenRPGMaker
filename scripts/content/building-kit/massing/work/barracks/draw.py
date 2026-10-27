"""barracks — 병영(덩어리 모형 C10). 10×6 칸(160×96), 건물은 0..147(문이 칸 4 한 열에 들도록 가운데를 74 에 둔다).
모형대로 1층 긴 마름돌 병영. 버들항 병영처럼 청석 모임지붕(비늘, 갈색 모임 갈빗대) · 용마루 곁 돌 굴뚝 셋(모양 제각각, 윗면 보임) ·
따뜻한 흰 마름돌 벽 · 창 한 줄(남빛 유리, 덧창·창턱 제각각) · 가운데 아치문 하나. 난수 없음."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pix  # noqa: E402
from common import Canvas, moss, door  # noqa: E402
from gf import auto_walk  # noqa: E402
from bd import WarmAshlar, warm_region, slate, shift  # noqa: E402

W, H = 160, 96
c = Canvas(10, 6)
BX0, BX1 = 0, 147
WX0, WX1 = 2, 145
CX = 74
R_Y, E_Y = 11, 53
GY = 95
RL, RR = 42, 105


def rib_l(y): return RL - (RL - 11) * (y - R_Y) / (E_Y - R_Y)
def rib_r(y): return RR + (136 - RR) * (y - R_Y) / (E_Y - R_Y)
def edge_l(y): return RL - 2 - (RL - 2) * (y - R_Y) / (E_Y - R_Y)
def edge_r(y): return RR + 2 + (BX1 - RR - 2) * (y - R_Y) / (E_Y - R_Y)
def in_roof(x, y): return R_Y <= y <= E_Y and edge_l(y) <= x <= edge_r(y)


def roof_shade(x, y):
    if x < rib_l(y):
        return 1
    if x > rib_r(y):
        return -1 if y > 30 else 0
    return 0


# ---------------------------------------------------------------- 지붕(버들항 병영 결 청석, 이 건물은 3px 엇갈림·세 켜 주기)
slate(c, in_roof, BX0, BX1, R_Y, E_Y, split=33, var='anaacanoaanac', stagger=(1, 3, 0), shade=roof_shade, ox=2)
for y in range(R_Y, E_Y + 1):
    xl, xr = int(round(rib_l(y))), int(round(rib_r(y)))
    c.put(xl, y, 'η'); c.put(xl + 1, y, 'η' if y % 6 else 'ξ')
    c.put(xr, y, '_'); c.put(xr - 1, y, '_' if y % 6 else '-')
for x in range(RL - 1, RR + 2):
    c.put(x, R_Y - 1, '-')
    c.put(x, R_Y, 'ε' if x % 5 else 'δ')
for x in range(BX0, BX1 + 1):
    if in_roof(x, E_Y):
        c.put(x, E_Y, 'B' if x % 4 else 'C')
        c.put(x, E_Y + 1, 'C')


# ---------------------------------------------------------------- 굴뚝(용마루 곁, 위에서 본 갓돌 고리 + 연기 구멍)
def chimney(x, top, base, w, holes=1, tall=0):
    ash = WarmAshlar([4, 3, 4], seed=x % 5, widths=[4, 5, 3, 6, 4], mortar=4)
    for y in range(top + 4, base + 1):
        for i in range(w):
            s = 1 if i < 2 else (-2 if i >= w - 2 else 0)
            ch = ash.color(x + i + 40, y - top, s)
            if i == 0: ch = 'z'
            if i == w - 1: ch = 'f'
            c.put(x + i, y, ch)
    for i in range(-1, w + 1):                       # 갓돌: 윗면 고리 + 앞면 띠
        c.put(x + i, top, '0' if i < w - 1 else 'z')
        c.put(x + i, top + 1, 'p' if i in (-1, 0) else ('z' if i >= w - 1 else 'C'))
        c.put(x + i, top + 2, '0' if i < w - 1 else 'z')
        c.put(x + i, top + 3, 'l' if i < w - 1 else 'f')
    if holes == 2:
        c.put(x + w // 2, top + 1, 'p')
    for y in range(top + 3, base + 3):              # 지붕에 지는 그늘
        for k, n in ((w + 1, 2), (w + 2, 1)):
            if in_roof(x + k, y):
                c.put(x + k, y, shift(c.get(x + k, y), -n))
    for i in range(0, w + 2):
        if in_roof(x + i, base + 1):
            c.put(x + i, base + 1, shift(c.get(x + i, base + 1), -2))


chimney(47, 0, 16, 9, holes=2)
chimney(76, 2, 15, 7)
chimney(96, 1, 16, 8)

# ---------------------------------------------------------------- 벽(따뜻한 흰 마름돌, 1층)
WY0 = E_Y + 2
ash = WarmAshlar([6, 5, 6, 5, 6, 5, 6], seed=4, widths=[12, 9, 14, 8, 11, 13, 7, 10, 15, 9, 12, 8])


def wall_shade(x, y):
    s = 0
    if y < WY0 + 3:
        s -= 2 if y < WY0 + 1 else 1
    if x < WX0 + 3:
        s += 1
    if x > WX1 - 3:
        s -= 1
    return s


pix.flat_wall(c, WX0, WY0, WX1 - WX0 + 1, GY - 3 - WY0 + 1, ash, shade=wall_shade)
base = WarmAshlar([3, 3], seed=7, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
pix.flat_wall(c, WX0, GY - 5, WX1 - WX0 + 1, 4, base, shade=lambda x, y: -1 if x > WX1 - 3 else 0)
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'f' if x % 7 else 't')
    c.put(x, GY, 'c' if x % 6 else 'W')
# 모서리 귀돌
for (x0, lit) in ((WX0, True), (WX1 - 6, False)):
    y, k = WY0 + 2, 0
    while y < GY - 7:
        hh = 6 if k % 2 == 0 else 5
        ww = 7 if k % 2 == 0 else 5
        xs = x0 if lit else x0 + (7 - ww)
        for j in range(hh):
            for i in range(ww):
                if j == hh - 1 or (i == ww - 1 and lit) or (i == 0 and not lit):
                    ch = 'f' if lit else 'c'
                elif j == 0 or (i == 0 and lit):
                    ch = '5' if lit else 'y'
                else:
                    ch = '3' if lit else 'l'
                if y + j < GY - 5:
                    c.put(xs + i, y + j, ch)
        y += hh
        k += 1

# ---------------------------------------------------------------- 창 한 줄(돌 상인방 + 남빛 유리 + 덧창·창턱 제각각)
GLINT = [((1, 2), (2, 3), (1, 9)), ((3, 2), (3, 3), (2, 11)), ((1, 3), (1, 4), (3, 12)), ((2, 2), (1, 10), (1, 11))]


def window(wx, wy, g, curtain=False, box=False):
    """돌 상인방 + 좁고 긴 남빛 유리(가운데 문설·가로살) + 창턱. g = 반짝 자리 표 번호."""
    rows = ['zp00pll', 'fffffcc']
    for j in range(15):
        r = 'p'
        for i in range(5):
            ch = 'D' if j < 5 else ('A' if (i + j) % 4 else 'B')
            if j > 11:
                ch = 'B'
            if i == 2:
                ch = 'E'
            if j == 6:
                ch = 'f'
            r += ch
        rows.append(r + 'y')
    rows += ['z0000pl', 'cfffffc']
    c.rows(wx - 3, wy, rows)
    for (i, j) in GLINT[g]:
        c.put(wx - 3 + i, wy + 2 + j, '^' if j < 6 else 'F')
    if curtain:
        for j in range(8, 14):
            c.put(wx - 2, wy + 2 + j, 'q' if j % 2 else 'o')
            c.put(wx - 1, wy + 2 + j, 'o')
    if box:
        c.rows(wx - 3, wy + 17, ['zMNON0l', 'βηηηηηβ'])


for k, (wx, g, sh, cu, bx) in enumerate([(14, 0, 1, 0, 0), (34, 2, 0, 1, 0), (53, 1, 1, 0, 1),
                                         (95, 3, 0, 0, 1), (114, 0, 0, 1, 0), (133, 2, 1, 0, 0)]):
    wy = WY0 + 7 + (k % 2)
    window(wx, wy, g, cu, bx)
    if sh:                                            # 나무 덧창 한 쌍(창 테에 붙는다)
        for j in range(2, 17):
            c.put(wx - 5, wy + j, 'η' if j % 4 else 'ε')
            c.put(wx - 4, wy + j, 'ε' if j % 4 else 'β')
            c.put(wx + 4, wy + j, 'ε' if j % 4 else 'β')
            c.put(wx + 5, wy + j, 'β')

# ---------------------------------------------------------------- 가운데 아치문
DXX, DW, DY = 68, 12, 69
for (dx, dy, ch) in [(-3, 4, '3'), (-3, 5, '0'), (-3, 6, '3'), (-2, 2, '5'), (-2, 3, '3'), (-1, 1, '5'), (0, 0, '3'),
                     (1, -1, '5'), (2, -1, '3'), (3, -2, '5'), (4, -2, '3'), (5, -2, '5'), (6, -2, '5'),
                     (7, -2, '0'), (8, -2, 'p'), (9, -1, 'p'), (10, -1, 'z'), (11, 0, 'z'), (12, 1, 'l'),
                     (13, 2, 'y'), (13, 3, 'l'), (14, 4, 'y'), (14, 5, 'l'), (14, 6, 'y')]:
    c.put(DXX + dx, DY + dy, ch)
for y in range(DY + 7, GY - 1):
    c.put(DXX - 3, y, '3' if y % 5 else '0')
    c.put(DXX - 2, y, 'p')
    c.put(DXX + DW, y, 'f')
    c.put(DXX + DW + 1, y, 'y' if y % 5 else 'l')
door(c, DXX, DY, DW, GY - 1 - DY)
for x in range(DXX - 3, DXX + DW + 2):
    c.put(x, GY - 1, '3' if x % 4 else 'p')
    c.put(x, GY, 'y' if x % 3 else 'f')

warm_region(c, 0, WY0, W - 1, GY)
for (x, y, ch) in [(4, 91, 'N'), (5, 91, 'O'), (30, 91, 'N'), (118, 91, 'O'), (143, 91, 'N'), (60, 90, 'N'), (88, 91, 'O')]:
    c.put(x, y, ch)
moss(c, [(10, 46, 2), (134, 44, 2)])

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_br', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))

meta = {'name': '병영', 'massing': 'C10', 'material': 'stone',
        'refs': ['bd-house-barracks', 'bd-castle'], 'walk': auto_walk(c, 3, 4, (4, 5))}
print('\n'.join(meta['walk']))
fails, warns = c.save('barracks', meta)
print('fails', fails, 'warns', warns)
