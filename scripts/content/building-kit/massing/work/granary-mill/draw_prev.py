"""granary-mill — 방앗간(덩어리 모형 13). 2층 본채(1층 막돌·2층 회벽 반목조, 모임지붕) + 오른쪽에 붙은 둥근 곡물탑
(마름돌 원통 + 테라코타 원뿔). 10×7 칸(160×112). 문 하나. 다시 돌리면 같은 그림. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'guildhall'))
from lib4 import (Canvas, pix, ST, sclamp, fill_walk, cone_eave, tc_cone_radial, warm_cylinder, fill_gap_under)  # noqa: E402
from common import (roof, hip_side, HIP_LIT, HIP_DARK, eave_shadow, post, beam, window, door, rubble, moss,  # noqa: E402
                    plaster, chimney)

W, H = 160, 112
c = Canvas(10, 7)
GY = H - 1

# ---------------------------------------------------------------- 본채 모임지붕(용마루가 정면과 나란)
MX1 = 118                # 본채 오른끝(곡물탑 뒤로 들어간다)
RIDGE_Y = 9
EAVE_Y = 45
RL, RR = 26, 92
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


roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, 0, MX1, RIDGE_Y + 2, EAVE_Y, vshift=9, hshift=2)
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
chimney(c, 34, 0, 16, cw=7)

# ---------------------------------------------------------------- 2층 회벽 반목조
WX0, WX1 = 1, 128          # 벽은 곡물탑 뒤까지 이어진다(땅 접합에 틈 없음)
UY0 = EAVE_Y + 3
eave_shadow(c, WX0, UY0, WX1 - WX0 + 1)
UY1 = 76
plaster(c, WX0, UY0 + 5, WX1 - WX0 + 1, UY1 - UY0 - 4, ox=5, oy=1)
for px in (1, 31, 64, 97, 108):
    post(c, px, UY0 + 2, UY1)
beam(c, WX0, WX1, UY0 + 4)
for wx in (12, 44, 79):
    window(c, wx, 56, w=11, h=12, box=True)
for (x, y) in [(6, 62), (25, 70), (40, 58), (58, 72), (93, 61), (103, 70), (73, 54)]:
    c.put(x, y, 'z')
# 내민 보(층 사이)
for x in range(WX0, WX1 + 1):
    c.put(x, 77, 'η' if x % 7 else 'ζ')
    c.put(x, 78, 'ε')
    c.put(x, 79, 'β')
    c.put(x, 80, '_' if x % 6 else '-')
for x in range(4, WX1 - 2, 8):
    c.put(x, 79, 'δ')
    c.put(x + 1, 79, 'δ')

# ---------------------------------------------------------------- 1층 막돌
GY0 = 81
rubble(c, WX0, GY0, WX1 - WX0 + 1, GY - 1 - GY0, [4, 5, 3, 5, 4, 5, 3, 4], start=9)
DX0, DW = 50, 13
DY0 = 85
for (dx, dy) in [(-2, 4), (-2, 2), (-1, 0), (1, -2), (4, -3), (6, -3), (8, -3), (11, -2), (13, 0), (14, 2), (14, 4)]:
    x, y = DX0 + dx, DY0 + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, 'p' if (j == 0 and k == 0) else ('h' if j == 0 else 'e'))
for y in range(DY0 + 6, GY - 1):
    c.put(DX0 - 2, y, 'h' if y % 4 else 'e')
    c.put(DX0 - 1, y, 'e')
    c.put(DX0 + DW, y, 'd')
    c.put(DX0 + DW + 1, y, 'e' if y % 4 else 'X')
door(c, DX0, DY0, DW, GY - DY0)
for wx in (16, 86):
    for y in range(86, 101):
        for x in range(wx - 2, wx + 13):
            c.put(x, y, 'h' if (x == wx - 2 or y == 86) else 'e')
    window(c, wx, 87, w=11, h=11, box=False, shutters=False)
# 곡식 자루 더미(문 오른쪽 벽 앞)
SACKS = [
    '.....-ε......',
    '....ημμη.....',
    '...ησLσξμ....',
    '..ησσσξξμη...',
    '..ηξσξξμηε...',
    '.-ε.εημηε.-ε.',
    'ημ-ξη..ημ-ξη.',
    'μσLσξμησLσξμε',
    'μσσσξμησσξμηε',
    'ηξσξμηεξσξμηε',
    '.εηηε..εηηεε.',
]
c.rows(68, GY - 11, SACKS)
# 기초
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, GY, 'U' if x % 6 else 'T')
for x in range(DX0 - 1, DX0 + DW + 1):
    c.put(x, GY - 1, 'r' if x % 4 else 'm')
    c.put(x, GY, 'Z')

# ---------------------------------------------------------------- 곡물탑(따뜻한 연분홍 돌 원통 + 비늘 기와 원뿔)
TCX = 136.0
R = 23.0
SAG = 6
TOP = 44
tower_ash = pix.Ashlar([4, 5, 4, 5, 4, 5, 4], seed=4, widths=[7, 9, 6, 10, 8, 5, 9, 7, 11, 6, 8, 10, 7, 9, 6, 8], dark=1)
pix.cyl_wall(c, TCX, R, TOP, GY, tower_ash, SAG)
# 몸통 위 처마 그늘
for x in range(int(TCX - R), int(TCX + R) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > R:
        continue
    cosv = math.sqrt(1 - (dx / R) ** 2)
    y0 = TOP + round(SAG * cosv) - SAG
    for d in range(4):
        ch = c.get(x, y0 + d)
        if ch in ST:
            c.put(x, y0 + d, sclamp(ST.index(ch) - (4 - d)))
# 쇠 테(원통 둘레 띠, 가운데 처진다)
for x in range(int(TCX - R), int(TCX + R) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > R:
        continue
    cosv = math.sqrt(1 - (dx / R) ** 2)
    y = 66 + round(SAG * cosv)
    sh = pix.cyl_shade(dx, R)
    c.put(x, y, '-' if sh < -1 else 'ζ')
    c.put(x, y + 1, 'X' if sh >= 0 else 'U')
    c.put(x, y + 2, 'U' if sh >= -1 else 'T')
    if int(dx) % 9 == 0:
        c.put(x, y + 1, 'k')
warm_cylinder(c, TCX, R, TOP - SAG, GY)
base = pix.Ashlar([4, 4], seed=7, widths=[13, 10, 15, 11, 9, 14, 12], dark=1)
pix.cyl_wall(c, TCX, R + 0.6, GY - 6, GY, base, SAG)
# 본채와 탑이 만나는 세로 이음: 탑 왼쪽 테 바로 바깥 1px 짙은 줄눈(1층 막돌·2층 회벽 모두)
for y in range(EAVE_Y + 3, GY + 1):
    x = int(TCX - R) - 1
    while x < TCX and c.get(x + 1, y) not in 'tuvwxyz0245J' + ''.join(ST):
        x += 1
    if x > 100 and c.get(x, y) != '.':
        c.put(x, y, 'J' if y > 80 else ('-' if c.get(x, y) in 'ηεβζδ' else 'w'))
# 좁은 창(짙은 나무 테 + 하늘 유리) — 원통이라 오른쪽 테가 두껍다
for (sx, sy) in [(128, 52), (143, 53), (135, 80)]:
    c.rows(sx - 3, sy, [
        '..ηζζ..',
        '.ηDDA-.',
        'xηF^AB-v',
        'xηDAAB-v',
        'xη^AAB-v',
        'xηεεεε-v',
        'xηDAAB-v',
        'xη^AAB-v',
        'xζ----- v',
        'z0zzyxwv',
        'wvvvvuut',
    ])
# 탑 밑 바람구멍(쇠살) — 문이 아니다
c.rows(144, 98, ['tJJJJt', 'JTUTUJ', 'JUTUTJ', 'tJJJJt'])
# 원뿔 지붕(비늘 기와가 꼭짓점으로 좁아진다)
CONE_BASE = 34
HW = R + 4
tc_cone_radial(c, TCX, 2, CONE_BASE, HW, 6, ncol=9, seed=2)
cone_eave(c, TCX, CONE_BASE, HW, 6)
fill_gap_under(c, int(TCX - HW), int(TCX + HW), CONE_BASE - 4, TOP + 8, lambda x, y: 'J' if x > TCX else 't')
ix = int(TCX)
c.rows(ix - 1, 0, ['.e.', 'eiY'])

# 이끼·풍화
moss(c, [(5, 40, 1), (100, 30, 2), (60, 42, 0), (113, 104, 1), (150, 100, 2)])
for (x, y, ch) in [(3, GY - 2, 'N'), (4, GY - 2, 'O'), (45, GY - 2, 'N'), (104, GY - 2, 'O'), (116, GY - 3, 'N')]:
    c.put(x, y, ch)

# 바깥 윤곽: 탑 돌은 재질 어두운 단
for y in range(c.h):
    for x in range(int(TCX - R) - 1, c.w):
        ch = c.get(x, y)
        if ch == '.':
            continue
        edge = any(not (0 <= x + ax < c.w) or c.get(x + ax, y + ay) == '.' for ax, ay in ((1, 0), (-1, 0)))
        if edge and ch in ST:
            c.put(x, y, ST[max(1, min(3, ST.index(ch) - 4))])
        elif edge and ch in 'tuvwxyz01234':
            c.put(x, y, 't' if x < TCX else 'J')

walk = ['**********', '**********', '**********', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXDXXXXXX', 'XXXDXXXXXX']
meta = {'name': '방앗간', 'massing': '13', 'material': 'plaster',
        'refs': ['bd-house-mill1', 'bd-mpart-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('granary-mill', meta)
print('fails', fails, 'warns', warns)
