"""town-hall — 시청(덩어리 모형 M09). 9×9 칸(144×144). 다시 돌리면 같은 그림. 난수 없음.
앞 1층 아케이드(아치 셋, 옆 둘은 난간으로 막힌 그늘진 회랑, 가운데 아치 안 뒷벽에 문 하나) +
2층 흰 마름돌 본관(버들항 청석 모임지붕) + 뒤 가운데 가는 종루(작은 시계판, 종창) 위로
높고 가는 청석 첨탑(꼭대기로 좁아지는 비늘, 갈색 모서리, 꼭짓점에 닿는 금 꼭지)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, door  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar  # noqa: E402
from nh import cwin  # noqa: E402
from bd import WarmAshlar, warm_region, slate, shift  # noqa: E402

W, H = 144, 144
c = Canvas(9, 9)
GY = H - 1

# ================================================================ 종루 + 첨탑 (뒤 가운데)
CX = 71.5                     # 가운데 축
BX0, BX1 = 62, 81             # 종루 몸(20px)
SP_TOP, SP_BASE, SP_HW = 6, 40, 11.0    # 첨탑 꼭짓점 · 처마 줄 · 처마 반폭
B_TOP = SP_BASE + 1           # 종루 갓 띠
R_Y, E_Y = 60, 82             # 본관 용마루 · 처마

bel_ash = WarmAshlar([5, 4, 5, 4, 5], seed=3, widths=[7, 5, 8, 6, 9, 5, 7, 6])


def bshade(x, y):
    s = 0
    if x < BX0 + 3:
        s += 1
    if x > BX1 - 4:
        s -= 1
    if x > BX1 - 2:
        s -= 1
    if y < B_TOP + 4:
        s -= 1                # 첨탑 처마 밑 그늘
    return s


pix.flat_wall(c, BX0, B_TOP, BX1 - BX0 + 1, R_Y - B_TOP + 1, bel_ash, shade=bshade)
# 모서리 돌(긴 돌·짧은 돌 번갈아, 왼 밝게)
for k, y0 in enumerate(range(B_TOP + 3, R_Y, 5)):
    wl = 4 if k % 2 == 0 else 3
    for y in range(y0, min(y0 + 4, R_Y + 1)):
        for i in range(wl):
            c.put(BX0 + i, y, '3' if y == y0 else ('0' if i < wl - 1 else 'z'))
            c.put(BX1 - i, y, 'z' if y == y0 else ('y' if i < wl - 1 else 'w'))
    c.put(BX0 + wl, y0 + 3, 'f')
    c.put(BX1 - wl, y0 + 3, 'f')
# 종창 둘(좁은 둥근 아치 + 나무 덧살, 안은 짙은 그늘)
for sx in ():
    for j in range(13):
        for i in range(3):
            if j == 0 and i != 1:
                continue
            ch = 'A' if j < 3 else ('D' if j % 3 else 'ε')
            if i == 2 and j > 0:
                ch = 'D' if ch == 'A' else ch
            c.put(sx + i, B_TOP + 4 + j, ch)
    c.put(sx - 1, B_TOP + 17, 'w')
    for i in range(4):
        c.put(sx - 1 + i, B_TOP + 17, '0' if i < 2 else 'y')
# 작은 시계판(가운데, 지름 9: 흰 판 · 금테 한 화소 · 바늘 둘, 숫자 없음)
CCX, CCY, RR = 71.5, 50.5, 4.5
for y in range(46, 58):
    for x in range(66, 78):
        d = math.hypot(x + 0.5 - CCX, y + 0.5 - CCY)
        if d <= RR - 0.6:
            c.put(x, y, 's' if (x + 0.5 < CCX and y + 0.5 < CCY) else ('r' if x + 0.5 < CCX + 2 else 'm'))
        elif d <= RR + 0.6:
            c.put(x, y, 'σ' if (x + 0.5 < CCX) else ('η' if y + 0.5 < CCY + 2 else 'ε'))
for (x, y) in [(71, 47), (71, 48), (71, 49), (71, 50), (72, 50), (73, 50)]:
    c.put(x, y, 'X')
c.put(71, 50, 'U')
# 갓 띠(첨탑 처마 밑 내쌓기)
for x in range(BX0 - 1, BX1 + 2):
    c.put(x, B_TOP, '3' if x < 72 else 'z')
    c.put(x, B_TOP + 1, 'w' if x % 3 else 'f')

# ---------------------------------------------------------------- 첨탑: 사각뿔 남면, 비늘은 꼭대기로 좁아진다
SPH = SP_BASE - SP_TOP


def sp_hw(y):
    return SP_HW * (y - SP_TOP) / SPH


def in_spire(x, y):
    return SP_TOP <= y <= SP_BASE and abs(x + 0.5 - CX) <= sp_hw(y) + 0.5


# 비늘 한 장(가로 단위 u 0..1, 세로 lv 0..2): 머리 밝고 아래 겹침 짙음
SC_ROWS = 3
for y in range(SP_TOP, SP_BASE + 1):
    hw = sp_hw(y)
    if hw < 0.2:
        continue
    t = (y - SP_TOP)
    row, lv = divmod(t, SC_ROWS)
    n = max(1, int(round(hw * 2 / 3.6)))          # 줄마다 비늘 수 — 위로 갈수록 적다
    for x in range(int(CX - hw) - 1, int(CX + hw) + 2):
        if not in_spire(x, y):
            continue
        u = (x + 0.5 - (CX - hw)) / max(0.5, 2 * hw)     # 0..1 가로 위치
        q = u * n + (0.5 if row % 2 else 0)
        col, fu = int(q), q % 1
        if lv == 0:
            ch = 'H' if fu < 0.45 else 'G'
        elif lv == 1:
            ch = 'G' if fu < 0.3 else ('F' if fu < 0.8 else 'B')
        else:
            ch = 'E' if fu < 0.7 else 'B'
        if fu > 0.86:
            ch = 'B'
        s = 0
        if u > 0.62:
            s -= 1                                 # 오른쪽 그늘
        if u > 0.85:
            s -= 1
        if u < 0.2 and lv < 2:
            s += 0
        if (row * 5 + col * 3) % 7 == 0 and lv == 1:
            s -= 1                                 # 묵은 비늘
        c.put(x, y, shift(ch, s))
# 모서리(갈색 처마 모서리 선: 왼쪽 밝은 갈색, 오른쪽 짙은 갈색) + 처마 끝 줄
for y in range(SP_TOP + 1, SP_BASE + 1):
    hw = sp_hw(y)
    xl = int(math.floor(CX - hw))
    xr = int(math.ceil(CX + hw)) - 1
    c.put(xl, y, 'η')
    c.put(xr, y, 'ε')
for x in range(int(CX - SP_HW) - 1, int(CX + SP_HW) + 2):
    if c.get(x, SP_BASE) != '.' or abs(x + 0.5 - CX) <= SP_HW + 1:
        c.put(x, SP_BASE, 'ε' if x < CX else '_')
        c.put(x, SP_BASE - 1, c.get(x, SP_BASE - 1) if c.get(x, SP_BASE - 1) != '.' else 'B')
# 금 꼭지(공 + 가는 꼭지, 꼭짓점에 닿는다)
c.rows(70, 0, ['.K.', '.K.', '.K.', 'LKτ', 'Kττ', '.τ.'])
for y in range(6, SP_TOP + 2):
    c.put(71, y, 'η' if y < SP_TOP + 1 else c.get(71, y))
c.put(71, SP_TOP, 'η')
c.put(72, SP_TOP, 'ε')

# ================================================================ 본관 지붕(버들항 청석 모임)
RL, RR = 38, 105


def edge_l(y):
    return (RL - 3) - (RL - 3) * (y - R_Y) / (E_Y - R_Y)


def edge_r(y):
    return (RR + 3) + (W - 1 - RR - 3) * (y - R_Y) / (E_Y - R_Y)


def rib_l(y):
    return RL - (RL - 14) * (y - R_Y) / (E_Y - R_Y)


def rib_r(y):
    return RR + (W - 15 - RR) * (y - R_Y) / (E_Y - R_Y)


def in_roof(x, y):
    return R_Y <= y <= E_Y and edge_l(y) <= x <= edge_r(y)


def roof_shade(x, y):
    s = 0
    if x < rib_l(y):
        s += 1
    elif x > rib_r(y):
        s -= 1
    if y < R_Y + 3:
        s -= 1                    # 용마루 밑 그늘
    return s


slate(c, in_roof, 0, W - 1, R_Y, E_Y, split=R_Y + 12, var='anaocaanoacana', stagger=(1, 3, 0, 2), shade=roof_shade, ox=1)
# 모임 마루(청석 마룻장: 왼쪽 밝은 H/I 줄, 오른쪽 짙은 C 줄)
for y in range(R_Y + 1, E_Y + 1):
    xl = int(round(rib_l(y)))
    xr = int(round(rib_r(y)))
    c.put(xl, y, 'I' if y % 4 else 'H')
    c.put(xl + 1, y, 'G')
    c.put(xr - 1, y, 'E')
    c.put(xr, y, 'C' if y % 4 else 'B')
# 용마루(얇은 마룻기와) — 종루 몸 앞을 지나간다
for x in range(RL - 2, RR + 3):
    c.put(x, R_Y - 1, 'E' if x % 5 else 'B')
    c.put(x, R_Y, 'H' if x % 5 in (1, 2) else 'G')
# 처마 끝(짙은 테)
for x in range(0, W):
    c.put(x, E_Y, 'B' if x % 4 else 'C')
    c.put(x, E_Y + 1, 'C')

# ================================================================ 2층 흰 마름돌 본관
WX0, WX1 = 2, W - 3
U0 = E_Y + 2
BAND = 109
up_ash = WarmAshlar([6, 5, 6, 5], seed=4, widths=[10, 8, 12, 7, 9, 11, 8, 13, 9, 7, 10])
pix.flat_wall(c, 0, U0, W, BAND - U0, up_ash,
              shade=lambda x, y: (-2 if y < U0 + 2 else (-1 if y < U0 + 4 else 0)) + (1 if x < 4 else 0)
              - (1 if x > W - 5 else 0))
cwin(c, 14, U0 + 6, w=8, h=13, glint=0)
cwin(c, 42, U0 + 6, w=8, h=13, glint=2, curtain=True)
cwin(c, 94, U0 + 6, w=8, h=13, lit=True)
cwin(c, 122, U0 + 6, w=8, h=13, glint=1, transom=True, sill=2)
# 가운데: 깃발 둘(청 바탕 금 줄, 글자 없음) + 문장 방패
for bx, pat in ((60, ['δηηηδ', '.EGB.', '.GHB.', '.GKB.', '.KLB.', '.GKB.', '.GGB.', '.EGB.', '.EFB.', '.E.B.']),
                (79, ['δηηηδ', '.EGB.', '.GGB.', '.EHB.', '.GKB.', '.KLB.', '.GKB.', '.EGB.', '.EFB.', '.EB..'])):
    c.rows(bx, U0 + 3, pat)
c.rows(67, U0 + 6, ['.YWWWY.', 'YkmmmjY', 'mEGGGBe', 'mGKLKBe', 'mEGKGBe', '.mEGBe.', '..mBe..', '...a...'])
# 층 띠(돌출 돌띠)
for x in range(0, W):
    c.put(x, BAND, 's' if x % 12 else 'n')
    c.put(x, BAND + 1, 'm' if x % 12 else 'k')
    c.put(x, BAND + 2, 'Y')

# ================================================================ 1층 아케이드(아치 셋)
A0 = BAND + 3
PIL = [(0, 9), (46, 53), (90, 97), (134, 143)]
BAYS = [(10, 45), (54, 89), (98, 133)]
SPRING, APEX = A0 + 12, A0 + 2
arc_ash = Ashlar([5, 5, 6, 5, 6], seed=9, widths=[7, 9, 6, 10, 8, 7, 11, 9])
pix.flat_wall(c, 0, A0, W, GY - A0 + 1, arc_ash, shade=lambda x, y: -1 if y < A0 + 2 else 0)


def in_arch(x, y, x0, x1):
    if y >= SPRING:
        return x0 <= x <= x1
    cxm = (x0 + x1 + 1) / 2.0
    hw = (x1 - x0 + 1) / 2.0
    dy = (SPRING - y) / (SPRING - APEX + 0.5)
    return dy < 1 and abs(x + 0.5 - cxm) <= hw * math.sqrt(1 - dy * dy)


BACK = 140                    # 회랑 안 뒷벽 밑
LOGGIA = set()
for bi, (bx0, bx1) in enumerate(BAYS):
    for y in range(APEX - 1, GY + 1):
        for x in range(bx0, bx1 + 1):
            if not in_arch(x, y, bx0, bx1):
                continue
            d = y - APEX
            if y < BACK:                         # 뒷벽(그늘진 마름돌)
                ch = arc_ash.color(x + 150 + bi * 37, y - APEX, -7 if d < 8 else (-6 if d < 18 else -5)) or 'W'
                if x < bx0 + 4:
                    ch = 'W' if x < bx0 + 2 else 'X'
                if d < 2:
                    ch = 'U'                     # 아치 밑 천장 그늘
            else:                                # 바닥 판석
                ch = 'n' if (x * 3 + (y - BACK) * 7) % 13 else 'k'
                if y == BACK:
                    ch = 'e'
                if (x - bx0) % 12 == 11:
                    ch = 'j'
            c.put(x, y, ch)
            LOGGIA.add((x, y))
    for y in range(APEX - 3, SPRING + 1):         # 홍예석
        for x in range(bx0 - 2, bx1 + 3):
            if in_arch(x, y, bx0 - 2, bx1 + 2) and not in_arch(x, y, bx0, bx1):
                ang = math.atan2(SPRING - y, x + 0.5 - (bx0 + bx1 + 1) / 2)
                k = int(ang / math.pi * 13)
                ch = ('r', 'n', 'm', 'n', 'k', 'r')[k % 6] if x < (bx0 + bx1) // 2 else ('k', 'j', 'm', 'j', 'i', 'k')[k % 6]
                if (ang / math.pi * 13) % 1 < 0.15:
                    ch = 'e'
                c.put(x, y, ch)
                LOGGIA.discard((x, y))
# 기둥(주두·몸·초석)
for (px0, px1) in PIL:
    n = px1 - px0
    for y in range(A0, GY - 1):
        for x in range(px0, px1 + 1):
            i = x - px0
            ch = ('k', 'r', 's', 'n', 'm', 'm', 'j', 'i', 'e', 'a')[min(9, i * 10 // (n + 1))]
            if (y - A0) % 8 == 7:
                ch = 'e' if i < n - 1 else 'a'
            c.put(x, y, ch)
    c.rows(px0, SPRING - 2, ['s' + 'r' * (n - 1) + 'm', 'n' + 'k' * (n - 1) + 'e', 'j' + 'e' * (n - 1) + 'a'])
# 가운데 아치 안 문 + 돌 문틀 + 문 위 이맛돌
DX, DW = 66, 12
D_TOP = APEX + 3
for j in range(BACK - D_TOP + 1):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, D_TOP - 1 + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, D_TOP - 2, 'r' if i < DW // 2 else 'm')
c.rows(70, D_TOP - 4, ['srrm', '.ne.'])
door(c, DX, D_TOP, DW, BACK - D_TOP)
# 문 앞 디딤돌(바닥 판석 위 밝은 돌 한 단)
for x in range(DX - 3, DX + DW + 3):
    c.put(x, BACK, 'r' if x < DX + DW // 2 else 'm')
    c.put(x, BACK + 1, 'k' if x < DX + DW // 2 else 'j')
# 왼 회랑 뒷벽: 불 켜진 창(덧문 하나) · 오른 회랑 뒷벽: 게시판(빈 종이, 글자 없음)
cwin(c, 24, A0 + 6, w=8, h=10, lit=True, shutters='left', sill=1)
c.rows(110, A0 + 6, ['ζηηηηηηηηηηηηζ', 'ηr3pδ3rp3δr3pβ', 'ηpr3δpr33δ3rpβ', 'η3p3δ3pr3δpr3β',
                      'ηεεεεεεεεεεεεβ', 'δ____________δ'])
# 옆 아치 둘 앞 돌난간(갓돌 · 동자 기둥 · 받침) — 회랑은 막혀 있고 그늘이 사이로 보인다
PAR = 131
for (bx0, bx1) in (BAYS[0], BAYS[2]):
    for x in range(bx0, bx1 + 1):
        i = x - bx0
        L = x < bx0 + (bx1 - bx0) * 0.6
        c.put(x, PAR, 's' if L else 'r')
        c.put(x, PAR + 1, 'n' if L else 'm')
        c.put(x, PAR + 2, 'j' if i % 6 else 'e')
        for y in range(PAR + 3, GY - 2):
            k = i % 6
            if k in (1, 2, 3):                    # 동자 기둥(가운데 불룩)
                bulge = (y - PAR - 3) in (3, 4, 5, 6)
                ch = ('r', 'n', 'k')[k - 1] if (bulge or k == 2) else ('X' if k == 1 else ('n' if k == 2 else 'W'))
                if k == 3 and bulge:
                    ch = 'j'
            elif k == 4:
                ch = 'U'                          # 기둥 오른쪽 그림자
            else:
                ch = c.get(x, y) if (x, y) in LOGGIA else 'X'
                ch = 'W' if ch in ('n', 'k', 'j', 'e') else ch
            c.put(x, y, ch)
        c.put(x, GY - 2, 'm' if L else 'j')
        c.put(x, GY - 1, 'e' if i % 7 else 'a')
# 땅 닿는 줄(기초)
for x in range(W):
    c.put(x, GY, 'Y' if x % 6 else 'X')
    if c.get(x, GY - 1) in ('n', 'k'):
        c.put(x, GY - 1, 'e')

# ================================================================ 흰 돌로(회랑 안 그늘·문·창은 그대로)
WARM_KEEP = lambda x, y: (x, y) in LOGGIA and y < PAR  # noqa: E731
warm_region(c, 0, A0, W - 1, GY, keep=lambda x, y: WARM_KEEP(x, y) or (DX - 2 <= x <= DX + DW + 1 and D_TOP <= y <= BACK))
moss(c, [(6, E_Y + 3, 2), (131, E_Y + 2, 0), (2, 139, 2), (138, 139, 2)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

walk = []
for cy in range(9):
    r = ''
    for cx in range(9):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 4 and cy in (7, 8):
            r += 'D'
        elif cy >= 5:
            r += 'X'
        else:
            r += '*'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='시청', massing='M09', material='stone', refs=['bd-house-cathedral', 'bd-house-manor'], walk=walk)
f, w = c.save('town-hall', meta)
print('FAIL', f, 'WARN', w)
