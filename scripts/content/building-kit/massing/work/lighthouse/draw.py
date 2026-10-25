"""lighthouse — 등대(덩어리 모형 M38). 둥근 돌 받침 위 원뿔대 흰 돌탑(원통을 따라 처지는 붉은 띠 둘), 맨 위 돌출 회랑(걷는 바닥 + 쇠 난간)
+ 유리 등실(불빛) + 붉은 원뿔 지붕, 아래 아치 문과 받침 계단. 3×9 칸(48×144). 문 하나. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dovecote'))
from towerlib import (Canvas, pix, ST, sclamp, fill_walk, taper_wall, ring_y, on_cyl,  # noqa: E402
                      outline, darken, tc_cone, cone_eave)
from common import door, moss  # noqa: E402

c = Canvas(3, 9)
W, H = 48, 144
GY = H - 1
CX = 24.0
K34 = 0.32          # 3/4 타원 납작비(세로/가로) — 받침·띠·회랑이 같은 비율로 휜다

# ---------------------------------------------------------------- 탑 몸통(흰 마름돌, 위로 가늘어진다)
RB, RT = 17.0, 12.0
TOP, BOT = 50, 134
SAG = 5


def rad(y):
    return RT + (RB - RT) * (y - TOP) / (BOT - TOP)


ash = pix.Ashlar([5, 4, 5, 5, 4], seed=8, widths=[7, 9, 6, 10, 8, 5, 9, 7, 11, 6, 8, 10], dark=-1, warm=False)
taper_wall(c, CX, rad, TOP, BOT, ash, SAG)

# 좁은 창(띠를 칠하기 전에 — 붉은 띠 안의 창은 테가 붉은 돌로 바뀐다)
SLIT = ['.mk.', 'mTUe', 'mDTe', 'm^Te', 'mDTe', 'mTUe', 'nkje', 'iiea']
for (sx, sy) in [(20, 82), (27, 95)]:
    c.rows(sx, sy, SLIT)

# 붉은 띠(같은 돌결을 붉은 램프로) — 띠 위·아래 경계가 원통을 따라 가운데서 처진다
REDR = ['7', '%', '&', '+', '=', '?', '<']
RED = {g: REDR[max(0, min(len(REDR) - 1, ST.index(g) - 3))] for g in ST}
RED.update({'p': '?', 'o': '<', 'g': '+', 'f': '+'})
RED.update({'U': '6', 'W': '7', 'Y': '7', 'a': '%', 'e': '&', 'i': '+', 'j': '=', 'k': '?', 'm': '<', 'n': '<',
            'r': 'κ', 's': 'κ'})
BANDS = [(57, 73), (88, 103)]


def band_y(b, x):
    """띠 경계 y: 양옆이 b, 가운데로 갈수록 처진다(반지름 × 납작비)."""
    r = rad(b)
    dx = x + 0.5 - CX
    if abs(dx) > r:
        return None
    cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
    return b + round(0.42 * r * cosv)


for (b0, b1) in BANDS:
    for x in range(c.w):
        y0 = band_y(b0, x)
        y1 = band_y(b1, x)
        if y0 is None or y1 is None:
            continue
        for y in range(y0, y1):
            g = c.get(x, y)
            if g != '.':
                c.put(x, y, RED.get(g, g))
        # 아래 경계: 흰 돌 위 붉은 띠 밑 1px 그늘 / 위 경계: 붉은 띠 맨 윗줄 밝은 주황 테(빛 받는 모서리)
        g = c.get(x, y1)
        if g in ST:
            c.put(x, y1, darken(g, 2))
        dx = (x + 0.5 - CX) / rad(b0)
        if -0.85 < dx < 0.2:
            c.put(x, y0, '<' if dx < -0.3 else '?')

# ---------------------------------------------------------------- 둥근 돌 받침(바위 없음 — 땅에 바로 닿는다)
PRX = 23.0
PRY = round(PRX * K34 * 10) / 10      # 9.6
FH = 5
PCY = GY - FH - round(PRY)            # 받침 윗면 타원 중심
# 받침 윗면(둥근 판석: 둘레 고리 두 줄 + 방사 줄눈, 왼쪽 위 밝게)
for y in range(int(PCY - PRY) - 1, int(PCY + PRY) + 2):
    for x in range(int(CX - PRX) - 1, int(CX + PRX) + 2):
        ex = (x + 0.5 - CX) / PRX
        ey = (y + 0.5 - PCY) / PRY
        d = ex * ex + ey * ey
        if d > 1:
            continue
        rr = math.sqrt(d)
        ang = math.atan2(ey, ex)
        lit = -0.7 * ex - 0.5 * ey
        t = 9 + round(1.6 * lit)
        ring = 0 if rr < 0.80 else 1
        nseg = 18 if ring else 14
        if (ang + math.pi) * nseg / (2 * math.pi) % 1 < 0.09:
            t -= 3
        if abs(rr - 0.80) < 0.045:
            t -= 3
        if rr > 0.95:
            t -= 1
        ch = sclamp(t)
        if ring and int((ang + math.pi) * nseg / (2 * math.pi)) % 4 == 1 and ch in ('k', 'm'):
            ch = 'p'
        c.put(x, y, ch)
# 받침 앞 둘레 벽(막돌 두 켜 + 맨 아래 어두운 기초 한 줄)
JOINTS = [0, 7, 15, 21, 30, 37, 44, 52, 58, 67, 74, 81, 88, 95]
for x in range(int(CX - PRX) - 1, int(CX + PRX) + 2):
    o = on_cyl(CX, PRX, x)
    if not o:
        continue
    dx, cosv, sh = o
    yt = PCY + round(PRY * cosv)
    u = math.asin(max(-1, min(1, dx / PRX))) * PRX + 50
    for j in range(1, FH + 1):
        y = yt + j
        if y > GY:
            break
        course = 0 if j <= 2 else 1
        uu = u + (4 if course else 0)
        joint = any(abs(uu - jx) < 0.6 for jx in JOINTS)
        if j == FH or y == GY:
            ch = sclamp(2 + sh)                       # 기초 어두운 돌
        elif j == 3:
            ch = sclamp(3 + sh)                       # 켜 사이 줄눈
        elif joint:
            ch = sclamp(3 + sh)
        else:
            t = 7 + sh - (1 if j == 2 or j == 5 else 0)
            if j == 1 or j == 4:
                t += 1
            ch = sclamp(t)
        c.put(x, y, ch)
    # 받침 윗면 앞 모서리(갓돌) 밝은 테
    c.put(x, yt, sclamp(10 + sh) if sh >= 0 else sclamp(8 + sh))

# 탑 밑 기초 띠(받침 위에 앉는 큰 돌 한 켜) + 탑이 받침 윗면에 드리우는 그늘
base = pix.Ashlar([5], seed=3, widths=[11, 9, 13, 10, 12], dark=2)
taper_wall(c, CX, lambda y: RB + 0.7, BOT - 5, BOT, base, SAG)
for x in range(int(CX - RB) - 1, int(CX + RB) + 3):
    yb = ring_y(CX, RB + 0.7, BOT, SAG, x)
    if yb is None:
        continue
    for d in (1, 2):
        g = c.get(x, yb + d)
        if g != '.' and x >= CX - RB + 3:
            c.put(x, yb + d, darken(g, 3 - d))
# 오른쪽 그늘 꼬리(빛 왼쪽 위 → 받침 윗면 오른쪽 아래로)
for x in range(int(CX + RB) - 2, int(CX + RB) + 7):
    for y in range(BOT - 4, BOT + 3):
        ex = (x + 0.5 - CX) / PRX
        ey = (y + 0.5 - PCY) / PRY
        if ex * ex + ey * ey > 0.9:
            continue
        g = c.get(x, y)
        if g in ST and ST.index(g) >= 7 and (x - (CX + RB)) < (y - (BOT - 6)):
            c.put(x, y, darken(g, 2))

# ---------------------------------------------------------------- 문 + 받침에 깎은 계단
DX0, DW, DY0 = 18, 12, 113
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
# 계단 셋: 문턱(BOT) → 땅(GY). 디딤면 밝게, 챌면 그늘, 아래로 갈수록 넓다
STEP_Y = [BOT + 1, BOT + 4, BOT + 7]
for k, y in enumerate(STEP_Y):
    for x in range(DX0 - 1 - k, DX0 + DW + 1 + k):
        edge_l = x == DX0 - 1 - k
        edge_r = x == DX0 + DW + k
        c.put(x, y, 'k' if edge_l else ('e' if edge_r else ('n' if x % 5 else 'm')))
        c.put(x, y + 1, 'e' if edge_r else ('j' if x % 5 else 'i'))
        if y + 2 <= GY:
            c.put(x, y + 2, 'Y' if edge_r else ('a' if x % 4 else 'Y'))
for x in range(DX0 - 3, DX0 + DW + 3):
    c.put(x, GY, 'W' if x % 3 else 'U')

# ---------------------------------------------------------------- 맨 위: 돌출 회랑(타원 바닥이 보인다) + 쇠 난간
DRX = 16.5
DRY = 7.0
DCY = 44
LR = 8.5
LT, LB = 21, 37
LRY = 2.6                                # 등실 밑 타원 납작 높이


def in_ell(x, y, cx, cy, rx, ry):
    ex = (x + 0.5 - cx) / rx
    ey = (y + 0.5 - cy) / ry
    return ex * ex + ey * ey


# 회랑 바닥(밝은 판석 + 방사 줄눈, 왼쪽 밝게) — 걷는 윗면
for y in range(int(DCY - DRY) - 1, int(DCY + DRY) + 2):
    for x in range(int(CX - DRX) - 1, int(CX + DRX) + 2):
        d = in_ell(x, y, CX, DCY, DRX, DRY)
        if d > 1:
            continue
        ex = (x + 0.5 - CX) / DRX
        ey = (y + 0.5 - DCY) / DRY
        ang = math.atan2(ey, ex)
        t = 10 if ex < -0.4 else (9 if ex < 0.25 else 7)
        if ey < -0.2:
            t -= 1                                        # 뒤쪽은 등실 그늘
        if (ang + math.pi) * 12 / (2 * math.pi) % 1 < 0.14:
            t -= 2
        if d > 0.8:
            t -= 1                                        # 바깥 고리 갓돌
        if abs(d - 0.8) < 0.07:
            t -= 2
        c.put(x, y, sclamp(t))
# 뒤 난간(바닥 뒤 테 위로 3px: 쇠 기둥 + 윗띠) — 등실 뒤로 지나간다
for x in range(int(CX - DRX), int(CX + DRX) + 1):
    dx = (x + 0.5 - CX) / DRX
    if abs(dx) > 1:
        continue
    yy = int(round(DCY - DRY * math.sqrt(1 - dx * dx)))
    c.put(x, yy - 3, 'Y')
    if x % 3 == 0 or abs(dx) > 0.93:
        c.put(x, yy - 2, 'W')
        c.put(x, yy - 1, 'W')
# 회랑 앞 끝 두께(밝은 갓 + 그늘 두 줄)
for x in range(int(CX - DRX), int(CX + DRX) + 1):
    o = on_cyl(CX, DRX, x)
    if not o:
        continue
    dx, cosv, sh = o
    y = DCY + round(DRY * cosv)
    c.put(x, y, sclamp(10 + sh) if sh >= 0 else sclamp(8 + sh))
    c.put(x, y + 1, sclamp(6 + sh))
    c.put(x, y + 2, sclamp(4 + sh))
# 까치발(회랑 밑 → 탑 몸통)
for x in range(int(CX - RT) - 3, int(CX + RT) + 4):
    o = on_cyl(CX, RT + 3, x)
    if not o:
        continue
    dx, cosv, sh = o
    y0 = DCY + round(DRY * cosv) + 3
    k = int(dx + 40) % 5
    depth = {0: 3, 1: 4, 2: 3}.get(k, 0)
    for d in range(4):
        if d < depth:
            c.put(x, y0 + d, sclamp(7 + sh - d) if k != 2 else sclamp(4 + sh - d))
        else:
            g = c.get(x, y0 + d)
            if g != '.':
                c.put(x, y0 + d, darken(g, 3 - d // 2))

# ---------------------------------------------------------------- 유리 등실(불빛) — 회랑 바닥 가운데
for x in range(int(CX - LR), int(CX + LR) + 1):
    o = on_cyl(CX, LR, x)
    if not o:
        continue
    dx, cosv, sh = o
    ytop = LT + round(LRY * cosv)
    ybot = LB + round(LRY * cosv)
    mull = x in (int(CX) - 5, int(CX) - 1, int(CX) + 4) or abs(dx) > LR - 1
    for y in range(ytop, ybot + 1):
        if y >= ybot - 2:
            ch = sclamp(5 + sh) if y < ybot else sclamp(2 + sh)
        elif y == ytop or y == ytop + 1:
            ch = sclamp(4 + sh)
        elif mull:
            ch = 'U' if sh < 0 else 'W'
        else:
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
# 등실이 바닥에 드리우는 그늘(오른쪽으로 길게)
for x in range(int(CX - LR) + 1, int(CX + LR) + 4):
    o = on_cyl(CX, LR + 1, x)
    if not o:
        continue
    dx, cosv, sh = o
    y = LB + round(LRY * cosv) + 1
    for yy in ([y] if dx < 2 else [y, y - 1, y - 2]):
        g = c.get(x, yy)
        if g in ST:
            c.put(x, yy, darken(g, 2 if dx > 0 else 1))

# 앞 난간: 가는 쇠 윗띠 하나 + 3px 마다 가는 기둥 — 위·사이로 바닥이 보인다
for x in range(int(CX - DRX), int(CX + DRX) + 1):
    o = on_cyl(CX, DRX, x)
    if not o:
        continue
    dx, cosv, sh = o
    yd = DCY + round(DRY * cosv)
    c.put(x, yd - 3, 'a' if sh > 0 else ('Y' if sh == 0 else 'W'))
    if int(dx + 40) % 3 == 0 or abs(abs(dx) - DRX) < 1.2:
        for d in (1, 2):
            c.put(x, yd - d, 'Y' if sh >= 0 else 'W')

# ---------------------------------------------------------------- 붉은 원뿔 지붕 + 꼭대기 바람구멍 공
CONE_BASE = 21
HW = 11.5
tc_cone(c, CX, 6, CONE_BASE, HW, 3, seed=1)
cone_eave(c, CX, CONE_BASE, HW, 3)
c.rows(int(CX) - 2, 0, ['.ki.', 'krie', 'jiea', '.YW.', '.aY.', '..Y.'])

moss(c, [(int(CX + PRX) - 7, PCY + 6, 1)])

# 바깥 윤곽(재질 어두운 단)
outline(c, {ch: 'i' for ch in 'krnms'} | {ch: 'a' for ch in 'ij'} | {k: '&' for k in '<?=+'}, x1=int(CX) - 1, y0=48, y1=BOT - 6)
outline(c, {ch: 'e' for ch in 'krnms'} | {ch: 'Y' for ch in 'ij'} | {k: '%' for k in '<?=+&'}, x0=int(CX), y0=48, y1=BOT - 6)

import importlib.util as _iu  # noqa: E402
_sp = _iu.spec_from_file_location('edgefix_lh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edgefix.py'))
EF = _iu.module_from_spec(_sp)
_sp.loader.exec_module(EF)
_sp2 = _iu.spec_from_file_location('fixups_lh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixups.py'))
FX = _iu.module_from_spec(_sp2)
_sp2.loader.exec_module(FX)
FX.finalize(c)
print('먹 윤곽 →재질 어두운 단', EF.material_edges(c))
_sp3 = _iu.spec_from_file_location('tint_lh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tint.py'))
TN = _iu.module_from_spec(_sp3)
_sp3.loader.exec_module(TN)
print('  윤곽 색조', TN.tint_edges(c, CX), '· 무채 가장자리', TN.neutral_share(c))

walk = ['***', '***', '***', '***', '***', '***', '***', 'XDX', 'XDX']
meta = {'name': '등대', 'massing': 'M38', 'material': 'stone',
        'refs': ['bd-house-mill1', 'bd-wall-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('lighthouse', meta)
print('fails', fails, 'warns', warns)
