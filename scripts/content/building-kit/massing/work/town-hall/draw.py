"""town-hall — 시청(덩어리 모형 M09). 9×9 칸(144×144). 다시 돌리면 같은 그림. 난수 없음.
앞 1층 아케이드(아치 셋, 가운데 아치 안 뒷벽에 문 하나) + 2층 마름돌 본관(손 청석 모임지붕) +
뒤 가운데 종탑(마름돌 몸, 둥근 시계판 — 숫자 없음, 작은 비늘 청석 원뿔 첨탑). 대성당 청석 지붕 결."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, door  # noqa: E402
from bits import darken, outline, fill_pinholes, window  # noqa: E402
from hand import hip_roof  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar, sclamp, ST  # noqa: E402

from nh import cwin  # noqa: E402

W, H = 144, 144
c = Canvas(9, 9)
GY = H - 1
SL = ['C', 'B', 'E', 'F', 'G', 'H', 'I']

# ---------------------------------------------------------------- 종탑(뒤): 몸 → 시계 → 첨탑
TX0, TX1 = 56, 87
tow_ash = Ashlar([5, 6, 5, 6, 5], seed=1, widths=[8, 11, 7, 9, 12, 8, 10, 7])
pix.flat_wall(c, TX0, 22, TX1 - TX0 + 1, 50 - 22, tow_ash,
              shade=lambda x, y: (1 if x < TX0 + 3 else (-2 if x > TX1 - 4 else (-1 if x > TX1 - 9 else 0)))
              - (2 if y < 26 else 0))
# 처마 밑 내쌓기 띠
for x in range(TX0 - 1, TX1 + 2):
    c.put(x, 26, 'r' if x < 80 else 'k')
    c.put(x, 27, 'j' if x % 4 else 'a')
# 시계판(둥근 금테 + 흰 판 + 눈금 점 넷 + 바늘 둘, 숫자 없음)
CXC, CYC, RR = 71.5, 36.0, 6.5
for y in range(29, 47):
    for x in range(62, 82):
        d = math.hypot(x + 0.5 - CXC, y + 0.5 - CYC)
        if d <= RR:
            ch = 'r' if d < RR - 2 else ('K' if x + 0.5 < CXC + 2 else 'τ')
            if d < RR - 2 and x + 0.5 > CXC + 2 and y + 0.5 > CYC + 1:
                ch = 'm'
            c.put(x, y, ch)
        elif d <= RR + 1:
            c.put(x, y, 'a' if x + 0.5 > CXC else 'j')
for (x, y) in [(71, 31), (75, 36), (71, 41), (67, 36)]:
    c.put(x, y, 'U')
for (x, y) in [(71, 33), (71, 34), (71, 35), (71, 36), (72, 36), (73, 36), (74, 37)]:
    c.put(x, y, 'X')
c.put(71, 36, 'K')
# 원뿔 첨탑: 작은 청석 비늘(3×2)이 꼭대기로 좁아진다, 왼 밝음 → 오른 그늘
APX, BASE, HW, ELL = 71.5, 23, 19.0, 4.0
for y in range(0, BASE + int(ELL) + 2):
    for x in range(int(APX - HW) - 1, int(APX + HW) + 2):
        p = pix.cone_param(APX, 1, BASE - 1, HW, ELL, x, y)
        if not p:
            continue
        t, f = p
        row = int((t * 26) // 2.2)
        lv = (t * 26) % 2.2
        ang = math.asin(max(-1, min(1, f)))
        nsc = 14
        col = int((ang + math.pi / 2) / math.pi * nsc + (0.5 if row % 2 else 0))
        u = ((ang + math.pi / 2) / math.pi * nsc + (0.5 if row % 2 else 0)) % 1
        s = 4
        if f < -0.6:
            s = 5
        elif f < -0.1:
            s = 4
        elif f < 0.35:
            s = 3
        elif f < 0.75:
            s = 2
        else:
            s = 1
        k = s
        if lv > 1.4:
            k -= 1                                  # 비늘 아래 겹침 그늘
        elif u < 0.25 and lv < 0.8:
            k += 1                                  # 비늘 왼 위 반짝
        if (row * 5 + col * 3) % 11 == 0:
            k -= 1                                  # 묵은 비늘(손 표 대신 줄·열 식)
        c.put(x, y, SL[max(0, min(6, k))])
for x in range(int(APX - HW), int(APX + HW) + 1):     # 첨탑 처마끝(밑 타원 앞 가장자리)
    dx = x + 0.5 - APX
    if abs(dx) > HW:
        continue
    ye = int(round(BASE + ELL * math.sqrt(max(0, 1 - (dx / HW) ** 2))))
    c.put(x, ye, 'ε' if dx < 0 else 'β')
    c.put(x, ye + 1, '_' if dx > 0 else 'δ')
c.rows(70, 0, ['.K.', 'KLK'][:1])
c.put(71, 0, 'K')

# ---------------------------------------------------------------- 본관 지붕(청석 모임)
R_Y, E_Y = 44, 72
hip_roof(c, 0, W - 1, R_Y, E_Y, 32, 111, seed=6, slate=True)
for x in range(TX0, TX1 + 1):                        # 종탑 밑동이 용마루 뒤로 들어간다(그늘)
    darken(c, x, R_Y - 1, 1)

# ---------------------------------------------------------------- 2층 마름돌 본관
WX0, WX1 = 2, W - 3
U0 = E_Y + 3
up_ash = Ashlar([6, 5, 6, 5], seed=4, widths=[10, 8, 12, 7, 9, 11, 8, 13, 9, 7, 10])
pix.flat_wall(c, WX0, U0, WX1 - WX0 + 1, 100 - U0 + 1, up_ash,
              shade=lambda x, y: (-2 if y < U0 + 2 else (-1 if y < U0 + 4 else 0)) + (1 if x < WX0 + 3 else 0)
              - (1 if x > WX1 - 3 else 0))
cwin(c, 14, U0 + 7, w=8, h=13, glint=0)
cwin(c, 44, U0 + 7, w=8, h=13, glint=2, curtain=True)
cwin(c, 92, U0 + 7, w=8, h=13, lit=True)
cwin(c, 122, U0 + 7, w=8, h=13, glint=1, transom=True, sill=2)
# 가운데: 발코니 문 대신 깃발 둘(청 바탕 금 문양, 글자 없음) + 문장 방패
for bx in (61, 78):
    c.rows(bx, U0 + 3, ['δηηηδ', '.EGB.', '.GHB.', '.GKB.', '.KLB.', '.GKB.', '.GGB.', '.EGB.', '.EFB.', '.E.B.'])
c.rows(67, U0 + 6, ['.YWWWY.', 'YkmmmjY', 'mEGGGBe', 'mGKLKBe', 'mEGKGBe', '.mEGBe.', '..mBe..', '...a...'])
# 층 띠(돌출 돌띠: 윗면 밝게, 앞면, 그늘)
for x in range(0, W):
    c.put(x, 101, 's' if x % 12 else 'n')
    c.put(x, 102, 'm' if x % 12 else 'k')
    c.put(x, 103, 'Y')

# ---------------------------------------------------------------- 1층 아케이드(아치 셋)
A0 = 104
PIL = [(0, 9), (46, 53), (90, 97), (134, 143)]
BAYS = [(10, 45), (54, 89), (98, 133)]
SPRING, APEX = 116, 106
arc_ash = Ashlar([5, 5, 6, 5, 6], seed=9, widths=[7, 9, 6, 10, 8, 7, 11, 9])
pix.flat_wall(c, 0, A0, W, GY - A0 + 1, arc_ash, shade=lambda x, y: -1 if y < A0 + 2 else 0)


def in_arch(x, y, x0, x1):
    if y >= SPRING:
        return x0 <= x <= x1
    cxm = (x0 + x1 + 1) / 2.0
    hw = (x1 - x0 + 1) / 2.0
    dy = (SPRING - y) / (SPRING - APEX + 0.5)
    return dy < 1 and abs(x + 0.5 - cxm) <= hw * math.sqrt(1 - dy * dy)


BACK = 136                    # 아케이드 안 뒷벽 밑(바닥 시작)
for bi, (bx0, bx1) in enumerate(BAYS):
    for y in range(APEX - 1, GY + 1):
        for x in range(bx0, bx1 + 1):
            if not in_arch(x, y, bx0, bx1):
                continue
            d = y - APEX
            if y < BACK:                         # 뒷벽(그늘진 마름돌: 아치 밑 짙고 아래로 조금 밝다)
                ch = arc_ash.color(x + 150, y - APEX, -7 if d < 8 else (-6 if d < 18 else -5)) or 'W'
                if x < bx0 + 4:
                    ch = 'W' if x < bx0 + 2 else 'X'   # 아치 안 왼 옆벽 그늘
            else:                                # 바닥 판석
                ch = 'n' if (x * 3 + (y - BACK) * 7) % 13 else 'k'
                if y == BACK:
                    ch = 'e'
                if (x - bx0) % 12 == 11:
                    ch = 'j'
            c.put(x, y, ch)
    for y in range(APEX - 3, SPRING + 1):         # 홍예석(쐐기돌, 밝기 교대)
        for x in range(bx0 - 2, bx1 + 3):
            if in_arch(x, y, bx0 - 2, bx1 + 2) and not in_arch(x, y, bx0, bx1):
                ang = math.atan2(SPRING - y, x + 0.5 - (bx0 + bx1 + 1) / 2)
                k = int(ang / math.pi * 13)
                ch = ('r', 'n', 'm', 'n', 'k', 'r')[k % 6] if x < (bx0 + bx1) // 2 else ('k', 'j', 'm', 'j', 'i', 'k')[k % 6]
                if (ang / math.pi * 13) % 1 < 0.15:
                    ch = 'e'
                c.put(x, y, ch)
# 기둥(주두·몸·초석) — 왼 밝게, 오른 그늘
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
# 가운데 아치 안 문(뒷벽, 열 4) + 돌 문틀 + 문 위 등
DX, DW = 66, 12
for j in range(BACK - 110):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, 110 + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, 109, 'r' if i < DW // 2 else 'm')
door(c, DX, 111, DW, BACK - 111)
# 양옆 아치 안: 의자(긴 나무 의자) 와 게시판(빈 종이, 글자 없음)
c.rows(18, 124, ['ηηηηηηηηηηηηηηηηηζ', 'εεεεεεεεεεεεεεεεεβ', 'δ.β..........δ.β.', 'δ.β..........δ.β.',
                 'δ.β..........δ.β.'])
c.rows(110, 119, ['ζηηηηηηηηηηηηζ', 'ηr3pδ3rp3δr3pβ', 'ηpr3δpr33δ3rpβ', 'η3p3δ3pr3δpr3β',
                  'ηεεεεεεεεεεεεβ', 'δ____________δ'])
for x in range(W):                              # 땅 닿는 줄(기둥 초석)
    if any(a <= x <= b for a, b in PIL):
        c.put(x, GY - 1, 'e' if x % 5 else 'a')
        c.put(x, GY, 'Y' if x % 6 else 'X')
    else:
        c.put(x, GY, 'k' if x % 5 else 'e')

moss(c, [(6, 68, 2), (130, 66, 0), (2, 140, 2), (138, 139, 2)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

walk = []
PASS = (1, 2, 3, 5, 6, 7)
for cy in range(9):
    r = ''
    for cx in range(9):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 4 and cy in (7, 8):
            r += 'D'
        elif cy >= 7:
            r += '*' if cx in PASS else 'X'
        elif cy >= 5:
            r += 'X'
        else:
            r += '*'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='시청', massing='M09', material='stone', refs=['bd-house-manor', 'bd-house-cathedral'], walk=walk,
            passages=[[x, 8] for x in PASS])
f, w = c.save('town-hall', meta)
print('FAIL', f, 'WARN', w)
