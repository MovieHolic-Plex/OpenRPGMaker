"""tower-house — 원통 망루가 붙은 집(덩어리 모형 15). 2층 회벽 반목조 집(모임지붕) + 오른쪽에 붙은 높은 마름돌 원통 망루
(내쌓기 받침 고리, 좁은 창, 테라코타 원뿔). 9×8 칸(144×128). 문 하나. 다시 돌리면 같은 그림. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'guildhall'))
from lib4 import (Canvas, pix, ST, sclamp, fill_walk, cone_eave, tc_cone_radial, warm_cylinder, fill_gap_under,
                  WS_DARK)  # noqa: E402
from common import (roof, hip_side, HIP_LIT, HIP_DARK, eave_shadow, post, beam, brace, window, door, moss,  # noqa: E402
                    plaster, chimney)

W, H = 144, 128
c = Canvas(9, 8)
GY = H - 1

# ---------------------------------------------------------------- 집 모임지붕
MX1 = 108
RIDGE_Y = 34
EAVE_Y = 70
RL, RR = 26, 82
KNEE = RIDGE_Y + int((EAVE_Y - RIDGE_Y) * 0.5)
SLL = RL / (EAVE_Y - RIDGE_Y)
SRR = (MX1 - RR) / (EAVE_Y - RIDGE_Y)


def lx(y):
    return RL - (y - RIDGE_Y) * SLL


def rx(y):
    return RR + (y - RIDGE_Y) * SRR


def OUT_L(y):
    return max(0.0, (RL - 3) - (y - RIDGE_Y) * (RL - 3) / (KNEE - RIDGE_Y))


def OUT_R(y):
    return min(MX1 + 0.0, (RR + 3) + (y - RIDGE_Y) * (MX1 - RR - 3) / (KNEE - RIDGE_Y))


roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, 0, MX1, RIDGE_Y + 2, EAVE_Y, vshift=1, hshift=3)
hip_side(c, lambda x, y: OUT_L(y) - 0.5 <= x <= lx(y) + 1, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_LIT)
hip_side(c, lambda x, y: rx(y) - 1 <= x <= OUT_R(y) + 0.5, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_DARK, hshift=2)
for y in range(RIDGE_Y + 1, EAVE_Y + 1):
    x = int(round(lx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    c.put(x - 1, y, 'σ' if (y % 3) else 'L')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    c.put(xr + 1, y, 'θ' if (y % 3) else '%')
for y in range(RIDGE_Y + 1, EAVE_Y + 2):
    xo = int(round(OUT_L(y)))
    c.put(xo, y, '-' if y % 2 else 'α')
for x in range(RL - 2, RR + 3):
    c.put(x, RIDGE_Y, 'ζ' if x in (RL - 2, RR + 2) else ('σ' if x % 4 else 'ξ'))
    c.put(x, RIDGE_Y + 1, '-' if x % 4 else 'α')
for x in range(RL, RR + 1, 4):
    c.put(x, RIDGE_Y, 'L')
for x in range(0, MX1 + 1):
    c.put(x, EAVE_Y + 1, '&' if x % 4 else '9')
    c.put(x, EAVE_Y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(0, EAVE_Y + 1, 'α')
chimney(c, 30, RIDGE_Y - 14, RIDGE_Y + 6, cw=7)

# ---------------------------------------------------------------- 2층 회벽 반목조
WX0, WX1 = 1, 118          # 벽은 원통 뒤까지 이어진다(땅 접합에 틈 없음)
UY0 = EAVE_Y + 3
eave_shadow(c, WX0, UY0, WX1 - WX0 + 1)
UY1 = 99
plaster(c, WX0, UY0 + 5, WX1 - WX0 + 1, UY1 - UY0 - 4, ox=7, oy=4)
for px in (1, 24, 54, 84):
    post(c, px, UY0 + 2, UY1)
beam(c, WX0, WX1, UY0 + 4)
for wx in (34, 64):
    window(c, wx, 80, w=11, h=11, box=True)
brace(c, 6, 96, 19, 80)
brace(c, 89, 80, 100, 96)
for (x, y) in [(10, 86), (48, 92), (77, 84), (93, 90)]:
    c.put(x, y, 'z')
# 내민 보(층 사이)
for x in range(WX0, WX1 + 1):
    c.put(x, 100, 'η' if x % 7 else 'ζ')
    c.put(x, 101, 'ε')
    c.put(x, 102, 'β')
    c.put(x, 103, '_' if x % 6 else '-')
for x in range(4, WX1 - 2, 8):
    c.put(x, 102, 'δ')
    c.put(x + 1, 102, 'δ')

# ---------------------------------------------------------------- 1층 회벽 반목조 + 문
LY0 = 104
plaster(c, WX0, LY0, WX1 - WX0 + 1, GY - 1 - LY0, ox=2, oy=6)
for px in (1, 30, 50, 84):
    post(c, px, LY0, GY - 2)
beam(c, WX0, WX1, GY - 4, h=1)
DX0, DW = 34, 13
DY0 = 103
door(c, DX0, DY0, DW, GY - DY0)
for y in range(DY0 + 1, GY - 1):
    c.put(DX0 - 1, y, 'η')
    c.put(DX0 + DW, y, 'β')
window(c, 62, 108, w=12, h=11, box=True, shutters=True)
brace(c, 5, GY - 5, 26, LY0 + 2)
# 문 위 작은 차양(널 + 받침)
for x in range(DX0 - 3, DX0 + DW + 3):
    c.put(x, DY0 - 3, 'σ' if x % 3 else 'ξ')
    c.put(x, DY0 - 2, 'η')
    c.put(x, DY0 - 1, '-')
# 문 옆 등불
c.rows(28, 106, ['.UU', '.X.', 'XYX', 'KLK', 'KKτ', 'XUX'])
# 기초
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, GY, 'U' if x % 6 else 'T')
for x in range(DX0 - 1, DX0 + DW + 1):
    c.put(x, GY - 1, 'r' if x % 4 else 'm')
    c.put(x, GY, 'Z')
# 화분 둘(문 오른쪽 벽 밑)
c.rows(52, GY - 7, ['.NON.', 'NOPON', 'MNONM', 'κνκνκ', 'λκνκλ', '.λλλ.'])

# ---------------------------------------------------------------- 원통 망루(따뜻한 크림·회갈 돌)
TCX = 121.0
R = 21.0
SAG = 6
TOP = 50
tash = pix.Ashlar([5, 5, 6, 5, 5, 6], seed=6, widths=[8, 10, 7, 11, 9, 6, 10, 8, 12, 7, 9, 11, 8, 6, 10, 9], dark=1)
pix.cyl_wall(c, TCX, R, TOP, GY, tash, SAG)
# 내쌓기 아래 그늘
for x in range(int(TCX - R), int(TCX + R) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > R:
        continue
    cosv = math.sqrt(1 - (dx / R) ** 2)
    y0 = TOP + round(SAG * cosv) - SAG
    for d in range(3):
        ch = c.get(x, y0 + d)
        if ch in ST:
            c.put(x, y0 + d, sclamp(ST.index(ch) - (3 - d)))
# 내쌓기 고리(받침돌 줄) — 원뿔 처마 바로 밑
RING = 42
for x in range(int(TCX - R) - 1, int(TCX + R) + 2):
    dx = x + 0.5 - TCX
    rr = R + 1.2
    if abs(dx) > rr:
        continue
    cosv = math.sqrt(max(0, 1 - (dx / rr) ** 2))
    y0 = RING + round(SAG * cosv)
    sh = pix.cyl_shade(dx, rr)
    k = int((math.asin(dx / rr) * rr + 100)) % 5
    c.put(x, y0, sclamp(9 + sh))
    for d in (1, 2):
        c.put(x, y0 + d, sclamp(7 + sh if k else 3 + sh))
    c.put(x, y0 + 3, sclamp(4 + sh))
    for d in (4, 5):
        c.put(x, y0 + d, sclamp((7 if k in (1, 2) else 2) + sh - (d - 4)))
    for d in range(6, 9):          # 고리와 몸통 사이를 메운다
        if c.get(x, y0 + d) == '.':
            c.put(x, y0 + d, sclamp(2 + sh))
warm_cylinder(c, TCX, R + 1.2, RING - 2, GY)
# 기초 돌(회색 큰 돌, 버들항 탑 밑동)
base = pix.Ashlar([4, 4], seed=3, widths=[13, 10, 15, 11, 9, 14, 12], dark=1)
pix.cyl_wall(c, TCX, R + 0.6, GY - 7, GY, base, SAG)
# 집과 탑이 만나는 세로 이음(탑 왼쪽 테 바깥 1px 그늘)
for y in range(TOP, GY + 1):
    x = int(TCX - R) - 1
    while x < TCX and c.get(x + 1, y) not in 'tuvwxyz0245J' + ''.join(ST):
        x += 1
    g = c.get(x, y)
    if g != '.' and x > 90:
        c.put(x, y, {'3': 'y', 'z': 'x', 'y': 'w', '1': 'y', 'η': 'ζ', 'ε': 'δ', 'β': '-', 'm': 'e', 'i': 'a',
                     'a': 'Y', 'U': 'T'}.get(g, '-'))
# 좁은 창(화살 틈) 셋 — 짙은 나무 테 + 어두운 안 + 하늘 반짝
for (sx, sy) in [(113, 58), (129, 76), (112, 95)]:
    c.rows(sx - 3, sy, [
        '..ηζζ..',
        '.ηζDζ-.',
        '.ηDAD-.',
        'xηFAA-v',
        'xη^AA-v',
        'xηDAA-v',
        'xηAAB-v',
        'xη^AB-v',
        'xηAAB-v',
        'xηAAB-v',
        'xζ--- v',
        'z0zzyxv',
        'wvvvvut',
    ])
# 원뿔(비늘 기와가 꼭짓점으로 좁아진다) — 앞 처마가 고리 위에 얹힌다
CONE_BASE = 38
HW = R + 5
tc_cone_radial(c, TCX, 3, CONE_BASE, HW, 6, ncol=9, seed=1)
cone_eave(c, TCX, CONE_BASE, HW, 6)
# 처마와 고리 사이 남은 틈 = 처마 밑 짙은 그늘
fill_gap_under(c, int(TCX - HW), int(TCX + HW), CONE_BASE - 4, RING + 12,
               lambda x, y: 'J' if x > TCX else 't')
ix = int(TCX)
c.rows(ix - 2, 0, ['.KK..', '..X..', '.KLK.'])

moss(c, [(6, 64, 1), (96, 62, 2), (46, 66, 0), (104, 121, 1), (136, 118, 2)])

# 바깥 윤곽: 탑 돌은 재질 어두운 단
for y in range(c.h):
    for x in range(int(TCX - R) - 1, c.w):
        ch = c.get(x, y)
        if ch == '.':
            continue
        edge = any(not (0 <= x + ax < c.w) or c.get(x + ax, y + ay) == '.' for ax, ay in ((1, 0), (-1, 0)))
        if not edge:
            continue
        if ch in ST:
            c.put(x, y, ST[max(1, min(3, ST.index(ch) - 4))])
        elif ch in 'uvwxyz0245':
            c.put(x, y, 't' if x < TCX else 'J')

walk = ['.......**', '.......**', '*********', '*********', '*********', 'XXXXXXXXX', 'XXDXXXXXX', 'XXDXXXXXX']
meta = {'name': '원통 망루가 붙은 집', 'massing': '15', 'material': 'plaster',
        'refs': ['bd-manor-tower', 'bd-mpart-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('tower-house', meta)
print('fails', fails, 'warns', warns)
