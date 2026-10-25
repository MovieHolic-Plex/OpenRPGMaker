"""dovecote — 비둘기탑(덩어리 모형 M05). 작은 막돌 원통 + 테라코타 원뿔 + 꼭대기 비둘기 들창, 몸통에 비둘기 구멍 줄(작은 턱),
아래 작은 아치 문. 3×5 칸(48×80). 문 하나. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from towerlib import (Canvas, pix, ST, sclamp, fill_walk, tc_cone, cone_eave, taper_wall, ring_y, on_cyl,  # noqa: E402
                      outline, darken, PINK)
from common import door, moss  # noqa: E402

c = Canvas(3, 5)
W, H = 48, 80
GY = H - 1
CX = 24.0
R = 16.5
SAG = 3
TOP = 37

# ---------------------------------------------------------------- 몸통: 작은 막돌(따뜻한 회색 + 분홍 섞기)
ash = pix.Ashlar([4, 4, 5, 4, 4, 5], seed=3, widths=[6, 8, 5, 7, 9, 5, 6, 8, 7, 5, 9, 6, 7, 5, 8], dark=1, warm=True)
taper_wall(c, CX, lambda y: R, TOP, GY, ash, SAG)
# 밑 기초(큰 돌 한 줄, 조금 더 넓다)
base = pix.Ashlar([5], seed=7, widths=[11, 9, 13, 10, 12, 8], dark=2)
taper_wall(c, CX, lambda y: R + 0.7, GY - 4, GY, base, SAG)

# 처마 밑 그늘(원뿔 아래 3줄)
for x in range(int(CX - R), int(CX + R) + 1):
    yy = ring_y(CX, R, TOP, SAG, x)
    if yy is None:
        continue
    for d in range(4):
        g = c.get(x, yy - SAG + d)
        if g != '.':
            c.put(x, yy - SAG + d, darken(g, 3 - d if d < 3 else 1))

# ---------------------------------------------------------------- 비둘기 구멍 줄(둥근 머리 구멍) + 줄마다 돌 턱 띠
HOLE = ['.UU.',
        'UTTW',
        'UT|W',
        'UTTW']
HOLE_N = ['UU',
          'TW',
          'TW',
          'TW']


def ledge(y0):
    """원통 둘레 돌 턱: 윗면 밝게 → 앞 모서리 → 밑 그늘(처진 곡선)."""
    for x in range(int(CX - R) - 1, int(CX + R) + 2):
        o = on_cyl(CX, R + 0.8, x)
        if not o:
            continue
        dx, cosv, sh = o
        y = y0 + round(SAG * cosv)
        k = int(math.asin(max(-1, min(1, dx / R))) * R + 100) % 7
        c.put(x, y, sclamp(10 + sh if k else 8 + sh))
        c.put(x, y + 1, sclamp(7 + sh))
        c.put(x, y + 2, sclamp(1 + sh))
        g = c.get(x, y + 3)
        if g != '.' and abs(dx) <= R:
            c.put(x, y + 3, darken(g, 2))


def hole(dx_px, ybase):
    x = int(CX + dx_px)
    oc = on_cyl(CX, R, x + 1)
    if not oc:
        return
    dx, cosv, sh = oc
    y = ybase + round(SAG * cosv)
    narrow = abs(dx) > R * 0.6
    rows = HOLE_N if narrow else HOLE
    c.rows(x, y, rows)
    # 구멍 왼쪽 위 돌 테 한 화소 밝게
    if c.get(x - 1, y + 1) in ST:
        c.put(x - 1, y + 1, sclamp(9 + sh))


ROW1, ROW2 = 40, 48
for dxp in (-14, -8, -2, 4, 10):
    hole(dxp, ROW1)
ledge(ROW1 + 4)
for dxp in (-11, -5, 1, 7, 12):
    hole(dxp, ROW2)
ledge(ROW2 + 4)
# 턱 위 비둘기 똥 얼룩(흰 점 몇) — 손 좌표
for (x, y) in [(12, 43), (19, 44), (30, 44), (16, 55), (26, 55)]:
    if c.get(x, y) in ST:
        c.put(x, y, 's')

# ---------------------------------------------------------------- 작은 아치 문(가운데 조금 왼쪽)
DX0, DW, DY0 = 18, 10, GY - 21
for (dx, dy) in [(-2, 5), (-2, 3), (-1, 1), (0, -1), (2, -2), (4, -2), (6, -2), (8, -1), (9, 1), (10, 3), (10, 5)]:
    for j in range(2):
        for k in range(2):
            c.put(DX0 + dx + k, DY0 + dy + j, 'm' if (j == 0 and k == 0) else ('i' if j == 0 else 'e'))
for y in range(DY0 + 7, GY):
    c.put(DX0 - 2, y, 'k' if y % 4 else 'i')
    c.put(DX0 - 1, y, 'e')
    c.put(DX0 + DW, y, 'a')
    c.put(DX0 + DW + 1, y, 'e' if y % 4 else 'Y')
door(c, DX0, DY0, DW, GY - DY0)
for x in range(DX0 - 2, DX0 + DW + 2):
    c.put(x, GY, 'Y' if x % 3 else 'W')

# ---------------------------------------------------------------- 원뿔(테라코타) + 꼭대기 비둘기 들창
CONE_BASE = 32
HW = R + 5.5
tc_cone(c, CX, 4, CONE_BASE, HW, 5, seed=4)
cone_eave(c, CX, CONE_BASE, HW, 5)
# 들창(작은 회벽 원통 + 들고나는 구멍 + 작은 원뿔 모자)
c.rows(20, 0, [
    '...ρ....',
    '..ρLν...',
    '.ρLν&θ..',
    'ηρν&θ%9.',
    '.-___:..',
    '.3T|Tw..',
    '.2|T:w..',
    '.10zyv..',
])

# 원뿔이 몸통에 지는 왼쪽 처마 끝 반짝임
moss(c, [(34, 72, 2)])
for (x, y, ch) in [(9, GY - 1, 'N'), (10, GY - 1, 'O'), (37, GY - 1, 'N'), (14, GY - 2, 'O')]:
    c.put(x, y, ch)

# 몸통 돌을 따뜻한 연분홍으로(버들항 방앗간·망루 결). 기초 줄(맨 아래 5px)과 문은 회색 그대로
for y in range(0, GY - 4):
    for x in range(c.w):
        g = c.get(x, y)
        if g in PINK and not (DX0 - 2 <= x <= DX0 + DW + 1 and y >= DY0 - 3):
            c.put(x, y, PINK[g])
# 바깥 윤곽(재질 어두운 단)
outline(c, {ch: 'Y' for ch in ST} | {k: 'J' for k in 'tuvwxyz01234'}, x0=int(CX), y0=TOP - 4)
outline(c, {ch: 'a' for ch in ST} | {k: 't' for k in 'tuvwxyz01234'}, x1=int(CX) - 1, y0=TOP - 4)

walk = ['***', '***', '***', 'XXX', 'XDX']
meta = {'name': '비둘기탑', 'massing': 'M05', 'material': 'stone',
        'refs': ['bd-mpart-tower', 'bd-house-mill1'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('dovecote', meta)
print('fails', fails, 'warns', warns)
