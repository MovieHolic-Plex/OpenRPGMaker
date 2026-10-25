"""smithy — 대장간(덩어리 모형 12). 막돌 작업장(모임지붕, 굵은 돌 굴뚝, 연기 없음) + 오른쪽 열린 외쪽 작업칸
(기둥, 안에 불빛 도는 화덕·모루·연장). 7×5 칸(112×80). 문 하나. 난수 없음 — 다시 돌리면 같은 그림.
(앞 판은 draw_prev.py — 검수 반려: 본채·작업칸 사이 1px 틈, 작업칸 바닥 없음, 큰 굴뚝, 굵은 돌.)"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (Canvas, chimney, roof, hip_side, HIP_LIT, HIP_DARK, ROOF_BANDS, eave_shadow, post, window, door,  # noqa: E402
                    rubble, moss, wing_roof, walk_from)

W, H = 112, 80
c = Canvas(7, 5)

MX1 = 71
RIDGE_Y, EAVE_Y = 10, 42
RL, RR = 22, MX1 - 22
KNEE = RIDGE_Y + int((EAVE_Y - RIDGE_Y) * 0.72)


def lx(y):
    return RL - (y - RIDGE_Y) * (RL - 1) / (EAVE_Y - RIDGE_Y)


def rx(y):
    return RR + (y - RIDGE_Y) * (MX1 - 1 - RR) / (EAVE_Y - RIDGE_Y)


def OUT_L(y):
    return max(0.0, (RL - 3) - (y - RIDGE_Y) * (RL - 3) / (KNEE - RIDGE_Y))


def OUT_R(y):
    return min(float(MX1), (RR + 3) + (y - RIDGE_Y) * (MX1 - RR - 3) / (KNEE - RIDGE_Y))


# ---------------------------------------------------------------- 본채 모임지붕
roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, 0, MX1, RIDGE_Y + 2, EAVE_Y, vshift=7)
hip_side(c, lambda x, y: OUT_L(y) - 0.5 <= x <= lx(y) + 1, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_LIT)
hip_side(c, lambda x, y: rx(y) - 1 <= x <= OUT_R(y) + 0.5, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_DARK, hshift=2)
for y in range(RIDGE_Y + 1, EAVE_Y + 1):
    x = int(round(lx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    if x >= 1:
        c.put(x - 1, y, 'σ' if (y % 3) else 'L')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    if xr + 1 <= MX1:
        c.put(xr + 1, y, 'θ' if (y % 3) else '%')
for y in range(RIDGE_Y + 1, EAVE_Y + 2):
    c.put(int(round(OUT_L(y))), y, '-' if y % 2 else 'α')
    c.put(int(round(OUT_R(y))), y, '-' if y % 3 else '9')
for x in range(RL - 3, RR + 4):
    c.put(x, RIDGE_Y, 'ζ' if x in (RL - 3, RR + 3) else ('L' if x % 4 == 1 else ('σ' if x % 4 else 'ξ')))
    c.put(x, RIDGE_Y + 1, '-' if x % 4 else 'α')
for x in range(0, MX1 + 1):
    c.put(x, EAVE_Y + 1, '&' if x % 4 else '9')
    c.put(x, EAVE_Y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(0, EAVE_Y + 1, 'α')
c.put(0, EAVE_Y + 2, '-')
c.put(MX1, EAVE_Y + 1, '9')
c.put(MX1, EAVE_Y + 2, '-')

# ---------------------------------------------------------------- 굵은 막돌 굴뚝(9px, 위에서 본 머리, 비스듬한 밑동)
chimney(c, 39, 0, 20, cw=9, start=3, slope=1)

# ---------------------------------------------------------------- 본채 막돌 벽
WY0 = EAVE_Y + 3            # 45
DOOR_X, DOOR_W, DOOR_Y = 17, 13, 54
rubble(c, 1, WY0, MX1, H - 2 - WY0, [3, 2, 3, 2, 4, 3, 2, 3], start=5)
eave_shadow(c, 1, WY0, MX1, rows=('|', '-', '_'))
for x in range(1, MX1 + 1):         # 처마 그늘이 돌 위로 풀린다
    if c.get(x, WY0 + 3) in 'xpvwz':
        c.put(x, WY0 + 3, 't')
# 모서리 귀돌(왼쪽 빛, 오른쪽은 작업칸에 맞닿아 그늘)
for y in range(WY0 + 3, H - 2):
    k = (y - WY0 - 3) // 4
    c.put(1, y, 'p' if (y - WY0) % 4 else 'J')
    c.put(2, y, 'x' if k % 2 else ('p' if (y - WY0) % 4 else 'J'))
# 문 둘레 쐐기돌 + 문
for (dx, dy) in [(-2, 4), (-2, 2), (-1, 0), (1, -2), (4, -3), (6, -3), (8, -3), (11, -2), (13, 0), (14, 2), (14, 4)]:
    x, y = DOOR_X + dx, DOOR_Y + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, 'p' if (j == 0 and k == 0) else ('h' if j == 0 else 'e'))
for y in range(DOOR_Y + 6, H - 2):
    c.put(DOOR_X - 2, y, 'h' if y % 4 else 'e')
    c.put(DOOR_X - 1, y, 'e')
    c.put(DOOR_X + DOOR_W, y, 'd')
    c.put(DOOR_X + DOOR_W + 1, y, 'e' if y % 4 else 'X')
door(c, DOOR_X, DOOR_Y, DOOR_W, H - DOOR_Y - 1)
# 덧창 단 창: 돌 상인방 + 덧창까지 덮는 긴 돌 창턱(반쯤 끝나지 않게)
WX = 42
for x in range(WX - 6, WX + 17):          # 상인방(쐐기돌 한 줄)
    c.put(x, 54, 'h' if (x - WX) % 4 else 'e')
    c.put(x, 55, 'e' if (x - WX) % 4 else 'd')
window(c, WX, 56, w=11, h=11, box=False, shutters=True, look=2)
for x in range(WX - 6, WX + 17):          # 창턱: 덧창 바깥 끝까지
    c.put(x, 67, 'm' if x < WX + 5 else 'h')
    c.put(x, 68, 'Y')
c.put(WX - 6, 67, 'k')
c.put(WX + 16, 68, 'X')
# 걸린 간판(모루 그림, 글자 없음): 쇠 팔 + 나무판
for x in range(57, 70):
    c.put(x, 48, 'U' if x % 3 else 'X')
c.put(57, 49, 'X')
c.put(58, 49, 'U')
for (x, y) in [(60, 49), (60, 50), (67, 49), (67, 50)]:
    c.put(x, y, 'e')
SX, SY = 58, 51
for j in range(11):
    for i in range(12):
        ch = 'δ'
        if i in (0, 11) or j in (0, 10):
            ch = '-' if (i == 11 or j == 10) else 'η'
        elif j == 9 or i == 1:
            ch = 'ε'
        c.put(SX + i, SY + j, ch)
ANVIL = [
    'hjjjjjjj.',
    '.ehhhhhhe',
    '...ehhe..',
    '...dhed..',
    '..dddddd.',
]
for j, row in enumerate(ANVIL):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(SX + 1 + i, SY + 3 + j, ch)
# 물통(쇠테 나무통) — 위에서 본 타원 윗면(나무 테 + 어두운 물) + 불룩한 몸통
BARREL = [
    '..ηηηηη..',
    '.ηεDDEDε.',
    '.εDDDDDβ.',
    '..εεββδ..',
    '.XUUXUUX.',
    'εηηεεεδδ-',
    'εηεεεεδδ-',
    '.XUUXUUX.',
    'εηεεεδδδ-',
    '.-εεεδδ-.',
]
for j, row in enumerate(BARREL):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(4 + i, H - 2 - len(BARREL) + j, ch)
# 기초
for x in range(1, MX1 + 1):
    c.put(x, H - 2, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, H - 1, 'U' if x % 6 else 'T')
for x in range(DOOR_X - 1, DOOR_X + DOOR_W + 1):
    c.put(x, H - 2, 'r' if x % 4 else 'm')
    c.put(x, H - 1, 'Z')

# ---------------------------------------------------------------- 작업칸: 남쪽으로 내려가는 외쪽 지붕(본채 처마 밑에 맞댐, 오른쪽 모임 끝)
WX0, WX1 = MX1 + 1, W - 1
WEAVE = 56
wing_roof(c, WX0, WX1, EAVE_Y + 3, WEAVE, run=14, bands=ROOF_BANDS[1:], vshift=9)
FY0 = WEAVE + 3              # 59: 작업칸 앞(인방)
for x in range(WX0, WX1 + 1):    # 인방
    c.put(x, FY0, 'η' if x % 7 else 'ζ')
    c.put(x, FY0 + 1, 'ε')
    c.put(x, FY0 + 2, 'β')
    c.put(x, FY0 + 3, '_')
IY0 = FY0 + 4                # 63: 안쪽 시작
# 안쪽 뒷벽: 어두운 막돌(그늘 쪽 색) — 위는 지붕 밑 그늘
DIM = {'v': 't', 'x': 'v', 'p': 'u', 'w': 'u', 'z': 'v', 't': 'J', 'J': 'C', 'C': '|'}
rubble(c, WX0 + 3, IY0, WX1 - WX0 - 5, H - 3 - IY0, [3, 2, 3, 3, 2], start=11)
for y in range(IY0, H - 3):
    for x in range(WX0 + 3, WX1 - 2):
        g = c.get(x, y)
        if g in DIM:
            c.put(x, y, DIM[g])
        if y < IY0 + 2:
            c.put(x, y, '|' if y == IY0 else ':')
# 화덕(돌 단 + 불빛 아궁이) 과 위로 올라가는 돌 갓(지붕 밑으로 사라진다)
HX = 77
HOOD = [
    '...XhjjhjX...',
    '...XjhhjhW...',
    '..XhjhjhjhW..',
    '.XjhhjhhjhhW.',
    'XhhjhjjhjhjhW',
    'WeeeeeeeeeeeW',
]
for j, row in enumerate(HOOD):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(HX + i, IY0 + j, ch)
HEARTH = [
    'kjjhjjhjjhjhd',
    'jhhehhhehhheX',
    'hX|:κκρκκ:|eX',
    'hX:κρKLKρκ:eX',
    'jX8κKLLLKκ8eX',
    'hXκρKKLKKρκeX',
    'jhheXhhheXheX',
    'hhjhehjhheheX',
    'eeeeeeeeeeeeX',
]
for j, row in enumerate(HEARTH):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(HX + i, H - 3 - len(HEARTH) + j, ch)
# 불빛이 뒷벽에 번진다(손 좌표)
for (x, y, ch) in [(76, 69, 'κ'), (76, 70, 'ι'), (90, 69, 'ι'), (90, 70, 'κ'), (91, 70, 'ι'), (76, 71, 'ι'),
                   (90, 71, 'ι')]:
    c.put(x, y, ch)
# 연장 걸이(뒷벽에 박힌 가로대 + 집게·망치)
for x in range(94, 107):
    c.put(x, IY0, 'η')
    c.put(x, IY0 + 1, 'ζ')
for (x, y, ch) in [(95, 65, 'e'), (95, 66, 'h'), (95, 67, 'e'), (96, 68, 'h'), (94, 68, 'h'),    # 집게
                   (99, 65, 'η'), (99, 66, 'η'), (99, 67, 'ε'), (98, 68, 'j'), (99, 68, 'h'), (100, 68, 'e'),  # 망치
                   (103, 65, 'η'), (103, 66, 'ε'), (102, 67, 'h'), (103, 67, 'j'), (104, 67, 'e')]:          # 작은 망치
    c.put(x, y, ch)
# 모루 + 그루터기
ANV2 = [
    'jjjjjjjjj.',
    'hhhhhhhhhe',
    '.ehhhhhe..',
    '...ehe....',
    '..ηηηηεε..',
    '..ηεεεδδ..',
    '..εεεδδ-..',
]
for j, row in enumerate(ANV2):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(95 + i, H - 3 - len(ANV2) + j, ch)
c.put(95, H - 10, 'r')
c.put(96, H - 10, 'r')
# 바닥: 납작한 판돌 2줄(풀이 안 보이게 꽉 채움)
for x in range(WX0, WX1 + 1):
    c.put(x, H - 3, 'g' if (x // 5) % 2 else 'd')
    c.put(x, H - 2, 'e' if x % 5 == 4 else 'h')
    c.put(x, H - 1, 'U' if x % 6 else 'T')
# 기둥(왼쪽은 본채 벽에 화소를 맞댄다)
post(c, WX0, FY0 + 1, H - 3)
post(c, WX1 - 2, FY0 + 1, H - 3)
for x in (WX0, WX0 + 1, WX0 + 2, WX1 - 2, WX1 - 1, WX1):   # 기둥 받침돌
    c.put(x, H - 3, 'h' if x in (WX0, WX1 - 2) else 'e')



meta = {
    'name': '대장간', 'massing': '12', 'material': 'stone',
    'refs': ['bd-house-smithy_town', 'bd-house-smithy'],
    'walk': walk_from(c, 3, 1, 2),
}
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('smithy', meta)
print('fails', fails, 'warns', warns)
