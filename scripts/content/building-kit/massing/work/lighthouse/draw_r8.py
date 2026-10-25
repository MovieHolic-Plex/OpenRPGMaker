"""lighthouse — 등대(덩어리 모형 M38). 바위 받침 위 원뿔대 흰 돌탑(붉은 가로 띠 셋), 맨 위 돌출 회랑(걷는 바닥 + 쇠 난간)
+ 유리 등실(불빛) + 붉은 원뿔 지붕, 아래 아치 문과 바위에 깎은 계단. 5×10 칸(80×160). 문 하나. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dovecote'))
from towerlib import (Canvas, pix, ST, sclamp, fill_walk, taper_wall, ring_y, on_cyl,  # noqa: E402
                      outline, darken, tc_cone, cone_eave)
from common import door, moss  # noqa: E402

c = Canvas(5, 10)
W, H = 80, 160
GY = H - 1
CX = 40.0

# ---------------------------------------------------------------- 탑 몸통(흰 마름돌, 위로 가늘어진다)
RB, RT = 19.0, 13.0
TOP, BOT = 52, 146
SAG = 3


def rad(y):
    return RT + (RB - RT) * (y - TOP) / (BOT - TOP)


ash = pix.Ashlar([5, 4, 5, 5, 4], seed=8, widths=[7, 9, 6, 10, 8, 5, 9, 7, 11, 6, 8, 10], dark=-1, warm=False)
taper_wall(c, CX, rad, TOP, BOT, ash, SAG)

# 붉은 띠(같은 돌결을 붉은 램프로)
REDR = ['7', '%', '&', '+', '=', '?', '<']
RED = {g: REDR[max(0, min(len(REDR) - 1, ST.index(g) - 3))] for g in ST}
RED.update({'p': '?', 'o': '<', 'g': '+', 'f': '+'})
BANDS = [(62, 80), (98, 116)]
for (b0, b1) in BANDS:
    for x in range(c.w):
        dx = x + 0.5 - CX
        for y in range(b0 - SAG, b1 + SAG + 1):
            r = rad(y)
            if abs(dx) > r:
                continue
            cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
            yb0 = b0 + round(SAG * cosv)
            yb1 = b1 + round(SAG * cosv)
            if yb0 <= y < yb1:
                g = c.get(x, y)
                c.put(x, y, RED.get(g, g))
# 띠 경계 얇은 그늘(흰 돌 위 붉은 띠 밑 1px)
for (b0, b1) in BANDS:
    for x in range(c.w):
        dx = x + 0.5 - CX
        r = rad(b1)
        if abs(dx) > r:
            continue
        cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
        y = b1 + round(SAG * cosv)
        g = c.get(x, y)
        if g in ST:
            c.put(x, y, darken(g, 2))

# 좁은 창(띠 사이 흰 칸에 하나씩, 엇갈려)
SLIT = ['.mk.', 'mTUe', 'mDTe', 'm^Te', 'mDTe', 'mTUe', 'nkje', 'iiea']
for (sx, sy) in [(37, 84), (42, 120), (35, 54)]:
    c.rows(sx, sy, SLIT)

# ---------------------------------------------------------------- 바위 받침(둥근 바위 덩이, 왼쪽 위 빛)
ROCKS = [  # (cx, cy, rx, ry, 바탕 단) — 뒤에서 앞으로
    (14, 140, 13, 9, 6), (66, 141, 13, 9, 5), (40, 141, 24, 8, 6),
    (6, 150, 9, 9, 6), (24, 149, 12, 9, 7), (58, 150, 12, 9, 5), (74, 151, 8, 8, 4),
    (15, 155, 11, 5, 6), (66, 155, 12, 5, 5),
]
WARMR = {'i': 'f', 'j': 'g', 'e': 'c', 'k': 'u', 'a': 'c'}
for k, (rx0, ry0, rrx, rry, bt) in enumerate(ROCKS):
    for y in range(int(ry0 - rry) - 1, min(GY, int(ry0 + rry)) + 1):
        for x in range(int(rx0 - rrx) - 1, int(rx0 + rrx) + 2):
            nx = (x + 0.5 - rx0) / rrx
            ny = (y + 0.5 - ry0) / rry
            d = nx * nx + ny * ny
            if d > 1 or not (0 <= x < W):
                continue
            lit = -0.62 * nx - 0.78 * ny
            t = bt + round(2.4 * lit)
            if d > 0.78:
                t -= 2 if lit < 0.2 else 1
            # 결: 바위 위 짧은 금(손 표)
            if (x * 3 + y * 5 + k * 7) % 23 == 0 and d < 0.7:
                t -= 2
            ch = sclamp(t)
            if k % 2 and ch in WARMR:
                ch = WARMR[ch]
            c.put(x, y, ch)
# 맨 아래 줄은 땅에 닿는 그늘
for x in range(W):
    if c.get(x, GY) != '.':
        c.put(x, GY, darken(c.get(x, GY), 1))

# 탑 밑 기초(회색 큰 돌 한 줄) — 바위 위에 앉는다
base = pix.Ashlar([5], seed=3, widths=[11, 9, 13, 10, 12], dark=2)
taper_wall(c, CX, lambda y: RB + 0.7, BOT - 5, BOT, base, SAG)

# ---------------------------------------------------------------- 문 + 바위에 깎은 계단
DX0, DW, DY0 = 34, 12, 123
for (dx, dy) in [(-2, 6), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (5, -3), (7, -3), (9, -2), (11, 0), (12, 2), (12, 4), (12, 6)]:
    for j in range(2):
        for kk in range(2):
            c.put(DX0 + dx + kk, DY0 + dy + j, 'r' if (j == 0 and kk == 0) else ('n' if j == 0 else 'k'))
for y in range(DY0 + 8, BOT + 1):
    c.put(DX0 - 2, y, 'r' if y % 4 else 'n')
    c.put(DX0 - 1, y, 'k')
    c.put(DX0 + DW, y, 'j')
    c.put(DX0 + DW + 1, y, 'k' if y % 4 else 'i')
door(c, DX0, DY0, DW, BOT + 1 - DY0)
STEP_Y = [BOT + 1, BOT + 5, BOT + 9]
for x in range(DX0 - 6, DX0 + DW + 6):
    c.put(x, GY, 'W' if x % 3 else 'U')
for k, y in enumerate(STEP_Y):
    for x in range(DX0 - 3 - k, DX0 + DW + 3 + k):
        c.put(x, y, 'n' if x % 5 else 'm')
        c.put(x, y + 1, 'k' if x % 5 else 'j')
        c.put(x, y + 2, 'e' if x % 4 else 'a')
        if y + 3 <= GY:
            c.put(x, y + 3, 'Y')
for y in range(BOT + 1, GY + 1):
    k = (y - BOT - 1) // 4
    c.put(DX0 - 4 - k, y, 'a')
    c.put(DX0 + DW + 3 + k, y, 'W')

# ---------------------------------------------------------------- 맨 위: 돌출 회랑(바닥이 보인다) + 쇠 난간
DCY, DRX, DRY = 45, 22.0, 8.5      # 회랑 윗면 타원
# 뒤 난간(회랑 바닥 뒤쪽 테 — 등실 뒤로 지나간다)
for x in range(int(CX - DRX), int(CX + DRX) + 1):
    dx = (x + 0.5 - CX) / DRX
    if abs(dx) > 1:
        continue
    yb = DCY - DRY * math.sqrt(1 - dx * dx)
    yy = int(round(yb))
    for d in range(1, 6):
        if d == 5:
            c.put(x, yy - d, 'a')
        elif d == 4 or x % 5 == 1:
            c.put(x, yy - d, 'W')
# 회랑 바닥(쇠 판 + 줄눈, 왼쪽 밝게)
for y in range(int(DCY - DRY) - 1, int(DCY + DRY) + 2):
    for x in range(int(CX - DRX) - 1, int(CX + DRX) + 2):
        ex = (x + 0.5 - CX) / DRX
        ey = (y + 0.5 - DCY) / DRY
        if ex * ex + ey * ey > 1:
            continue
        ang = math.atan2(ey, ex)
        t = 8 if ex < -0.3 else (7 if ex < 0.4 else 6)
        if (ang + math.pi) * 16 / (2 * math.pi) % 1 < 0.13:
            t -= 2
        c.put(x, y, sclamp(t))
# 회랑 앞 끝 두께 + 받침 까치발
for x in range(int(CX - DRX), int(CX + DRX) + 1):
    o = on_cyl(CX, DRX, x)
    if not o:
        continue
    dx, cosv, sh = o
    y = DCY + round(DRY * cosv)
    c.put(x, y, sclamp(9 + sh))
    c.put(x, y + 1, sclamp(5 + sh))
    c.put(x, y + 2, sclamp(3 + sh))
# 까치발(회랑 밑 → 탑 몸통): 작은 세모 받침이 원통 둘레로, 사이는 그늘
for x in range(int(CX - RT) - 3, int(CX + RT) + 4):
    o = on_cyl(CX, RT + 3, x)
    if not o:
        continue
    dx, cosv, sh = o
    y0 = DCY + round(DRY * cosv) + 3
    k = int(dx + 40) % 6
    depth = {0: 3, 1: 4, 2: 3}.get(k, 0)
    for d in range(4):
        if d < depth:
            c.put(x, y0 + d, sclamp(7 + sh - d) if k != 2 else sclamp(4 + sh - d))
        else:
            g = c.get(x, y0 + d)
            if g != '.':
                c.put(x, y0 + d, darken(g, 3 - d // 2))

# ---------------------------------------------------------------- 유리 등실(불빛) — 회랑 바닥 위
LR = 9.5
LT, LB = 22, 41
for x in range(int(CX - LR), int(CX + LR) + 1):
    o = on_cyl(CX, LR, x)
    if not o:
        continue
    dx, cosv, sh = o
    ytop = LT + round(2 * cosv)
    ybot = LB + round(2 * cosv)
    u = math.asin(max(-1, min(1, dx / LR))) * LR
    mull = x in (int(CX) - 6, int(CX) - 1, int(CX) + 5) or abs(dx) > LR - 1
    for y in range(ytop, ybot + 1):
        if y >= ybot - 3:
            ch = sclamp(6 + sh) if y < ybot else sclamp(3 + sh)       # 아래 쇠 벽
        elif y == ytop or y == ytop + 1:
            ch = sclamp(4 + sh)                                       # 위 테
        elif mull:
            ch = 'U' if sh < 0 else 'W'
        else:
            # 유리 속 불빛: 가운데 노랑, 가장자리 청록 반사
            f = abs(dx) / LR
            v = (y - ytop) / (ybot - ytop)
            if f < 0.35 and 0.2 < v < 0.75:
                ch = 'L' if (f < 0.18 and 0.3 < v < 0.6) else 'K'
            elif f < 0.6:
                ch = 'K' if 0.3 < v < 0.65 else 'τ'
            else:
                ch = '^' if (dx < 0 and v < 0.5) else ('>' if dx < 0 else 'D')
            if dx < -LR * 0.5 and (y - ytop) in (3, 4):
                ch = 'I'
        c.put(x, y, ch)

# 앞 난간(회랑 앞 테를 따라: 쇠 기둥 + 위 띠 + 가운데 띠) — 짙은 쇠, 바닥보다 어둡다
for x in range(int(CX - DRX), int(CX + DRX) + 1):
    o = on_cyl(CX, DRX, x)
    if not o:
        continue
    dx, cosv, sh = o
    yd = DCY + round(DRY * cosv)
    c.put(x, yd - 5, sclamp(5 + sh) if sh >= 0 else sclamp(3 + sh))
    c.put(x, yd - 4, sclamp(1 + sh))
    if int(dx + 40) % 5 == 0 or abs(abs(dx) - DRX) < 1:
        for d in range(1, 5):
            c.put(x, yd - d, sclamp(3 + sh) if d != 4 else sclamp(1 + sh))

# ---------------------------------------------------------------- 붉은 원뿔 지붕 + 꼭대기 바람구멍 공
CONE_BASE = 21
HW = 12.5
tc_cone(c, CX, 6, CONE_BASE, HW, 3, seed=1)
cone_eave(c, CX, CONE_BASE, HW, 3)
c.rows(int(CX) - 2, 0, ['.ki.', 'krie', 'jiea', '.YW.', '.aY.', '..Y.'])

moss(c, [(3, 146, 1), (62, 152, 2), (20, 136, 2)])

# 바깥 윤곽(재질 어두운 단)
outline(c, {ch: 'i' for ch in 'krnms'} | {ch: 'a' for ch in 'ij'} | {k: '&' for k in '<?=+'}, x1=int(CX) - 1, y0=50, y1=146)
outline(c, {ch: 'e' for ch in 'krnms'} | {ch: 'Y' for ch in 'ij'} | {k: '%' for k in '<?=+&'}, x0=int(CX), y0=50, y1=146)

import importlib.util as _iu  # noqa: E402
_sp = _iu.spec_from_file_location('edgefix_lh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edgefix.py'))
EF = _iu.module_from_spec(_sp)
_sp.loader.exec_module(EF)
_sp2 = _iu.spec_from_file_location('fixups_lh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixups.py'))
FX = _iu.module_from_spec(_sp2)
_sp2.loader.exec_module(FX)
FX.finalize(c)
print('먹 윤곽 →재질 어두운 단', EF.material_edges(c))

walk = ['*****', '*****', '*****', '*****', '*****', '*****', '*****', '*XXX*', 'XXDXX', 'XXDXX']
meta = {'name': '등대', 'massing': 'M38', 'material': 'stone',
        'refs': ['bd-house-mill1', 'bd-wall-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('lighthouse', meta)
print('fails', fails, 'warns', warns)
