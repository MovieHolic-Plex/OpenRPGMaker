"""guildhall — 계단 박공 길드 회관(덩어리 모형 10). 3층 분홍 마름돌, 남쪽 정면 계단 박공, 청석 지붕이 북쪽으로 물러난다
(세로 용마루, 왼 사면 밝고 오른 사면 어둡다). 6×9 칸(96×144). 문 하나(아치). 다시 돌리면 같은 그림. 난수 없음."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib4 import Canvas, pix, SL, pink_ashlar, pink_band, tall_window, PK_DARK, fill_walk  # noqa: E402
from common import door as arch_door  # noqa: E402,F401

W, H = 96, 144
c = Canvas(6, 9)
CX = 48                 # 가운데(47|48 사이)
WALL_Y = 58             # 박공 밑변 = 정면 벽 위 끝
GY = H - 1

# ---------------------------------------------------------------- 계단 박공 윤곽
STEP_W = 7
STEP_H = 5
CAP_Y = 22              # 꼭대기 갓돌 윗면
N_STEPS = 6


def parapet_top(x):
    """박공 위 끝 y(갓돌 윗면). 박공 밖이면 None."""
    if x < 2 or x > W - 3:
        return None
    d = x if x < CX else W - 1 - x          # 바깥에서 몇 px
    i = (d - 2) // STEP_W
    if i >= N_STEPS:
        return CAP_Y
    return WALL_Y - STEP_H * (i + 1)


def back_rake(x):
    """뒤(북쪽) 박공 사선 = 지붕 위 끝."""
    return int(round(abs(x + 0.5 - CX) * 25 / 48))


# ---------------------------------------------------------------- 지붕(청석) — 박공 위와 양옆 처마
SV = '0102003010201000210301002001020'


def roof_px(x, y):
    left = x < CX
    yy = y - back_rake(x)            # 사선에서 얼마나 내려왔나
    row = y // pix.TH
    lv = y % pix.TH
    off = 2 if row % 2 else 0
    lu = (x + off + (1 if left else 3)) % pix.TW
    col = (x + off) // pix.TW
    var = int(pix.SLATE_VAR[(row * 11 + col * 3 + 5) % len(pix.SLATE_VAR)])
    if left:
        s = 1
        if var == 2:
            var = 0
        if (row + col) % 3 == 0 and var == 0:
            var = 1
    else:
        s = -1 if abs(x + 0.5 - CX) < 34 else -2
        if var == 1:
            var = 0
    if yy < 2:
        s -= 1                       # 사선 바로 아래(갓기와 그늘)
    return SL[pix.slate_px(lu, lv, pix.TW, pix.TH, var, s)]


for x in range(W):
    pt = parapet_top(x)
    ybot = WALL_Y if pt is None else pt
    for y in range(back_rake(x), ybot):
        c.put(x, y, roof_px(x, y))
# 뒤 사선 갓기와(지붕 위 끝 두께): 왼쪽 밝은 테, 오른쪽 어두운 테
for x in range(W):
    y = back_rake(x)
    if x < CX:
        c.put(x, y, 'E')
        c.put(x, y + 1, 'H' if x % 3 else 'G')
    else:
        c.put(x, y, 'C')
        c.put(x, y + 1, 'E')
# 세로 용마루(갓돌 꼭대기 → 북쪽 끝): 왼쪽 빛, 오른쪽 그늘
for y in range(0, CAP_Y):
    c.put(CX - 2, y, 'G')
    c.put(CX - 1, y, 'H' if y % 4 else 'G')
    c.put(CX, y, 'B')
    c.put(CX + 1, y, 'C' if y % 3 == 0 else 'E')
c.put(CX - 1, 0, 'G')
c.put(CX, 0, 'E')
# 양옆 처마 끝(지붕이 벽 밖으로 2px 나온 띠): 아래 끝은 짙게
for y in range(back_rake(0), WALL_Y):
    c.put(0, y, 'E' if y % 3 else 'B')
    c.put(1, y, 'G' if y % 5 else 'F')
    c.put(W - 2, y, 'B')
    c.put(W - 1, y, 'C' if y % 2 else 'B')
for x in (0, 1, W - 2, W - 1):
    c.put(x, WALL_Y - 1, 'C' if x > 2 else 'B')
    c.put(x, WALL_Y - 2, 'B' if x > 2 else 'E')

# 박공에 붙은 물막이(지붕이 박공 갓돌과 만나는 선) + 오른쪽 사면의 계단 그림자
DK = {'H': 'G', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'C', 'C': 'C'}
for x in range(2, W - 2):
    pt = parapet_top(x)
    if c.get(x, pt - 1) in DK:
        c.put(x, pt - 1, DK[c.get(x, pt - 1)])
for x in range(CX, W - 2):
    pt = parapet_top(x)
    # 이 칸 왼쪽이 더 높은 계단이면(챌판 오른쪽) 3px 그림자
    for k in range(1, 4):
        if x - k >= 2 and parapet_top(x - k) < pt:
            for y in range(parapet_top(x - k) + 1, pt):
                g = c.get(x, y)
                if g in DK:
                    c.put(x, y, DK[g])
            break

# ---------------------------------------------------------------- 정면 벽 + 박공벽(분홍 마름돌, 한 면)


def wall_mask(x, y):
    pt = parapet_top(x)
    return pt is not None and y >= pt + 3


def wall_shade(x, y):
    s = 0
    if x >= W - 6:
        s -= 1                      # 오른쪽 모서리 쪽 살짝 그늘
    return s


pink_ashlar(c, 2, 0, W - 4, H - 4, course=4, seed=1, shade=wall_shade, mask=wall_mask)

# 계단 갓돌: 윗면 2줄(위에서 보인다) + 앞면 1줄 + 밑 그늘. 바깥쪽으로 1px 내민다.
for x in range(1, W - 1):
    xx = min(max(x, 2), W - 3)
    pt = parapet_top(xx)
    left = x < CX
    d = x if left else W - 1 - x
    i = (d - 2) // STEP_W if d >= 2 else 0
    edge_out = (d - 2) % STEP_W == 0 or d < 2          # 계단 바깥 끝
    edge_in = (d - 2) % STEP_W == STEP_W - 1          # 계단 안쪽 끝(다음 챌판에 붙음)
    top = '3' if left else '0'
    if edge_out:
        top = '1' if left else 'y'
    c.put(x, pt, top)
    c.put(x, pt + 1, '2' if left else 'z')
    c.put(x, pt + 2, 'x' if not edge_in else 'w')
    if c.get(x, pt + 3) != '.' and c.get(x, pt + 3) != 'J':
        g = c.get(x, pt + 3)
        c.put(x, pt + 3, PK_DARK.get(g, g))
# 계단 챌판(계단 사이 세로면 — 남쪽 면과 한 면이라 벽돌 그대로, 위 갓돌 옆구리만)
for x in range(2, W - 2):
    pt = parapet_top(x)
    if x + 1 < W - 2 and parapet_top(x + 1) < pt and x < CX:
        # 왼쪽 반: 오른쪽 이웃이 높다 — 높은 계단 갓돌의 왼끝 옆구리 밝게
        for y in range(parapet_top(x + 1), pt):
            c.put(x + 1, y, '3' if y == parapet_top(x + 1) else ('1' if y < parapet_top(x + 1) + 2 else c.get(x + 1, y)))
# 꼭대기 갓돌 위 돌 구(피니얼)
c.rows(CX - 3, CAP_Y - 7, [
    '..32x..',
    '.31zyx.',
    '.2zyxw.',
    '..xwv..',
    '...J...',
    '.3zyxw.',
    '1zyyxwv',
])

# 박공 둥근 창(눈창) — 돌 테 + 어두운 유리 + 네 갈래 창살
c.rows(CX - 6, 31, [
    '....3zzx....',
    '..3zDDDAxv..',
    '.3DFDτAAAxv.',
    '.zF^DτAAABx.',
    '3zDDDτAAABxv',
    'zττττττττττw',
    '3zDD^τAAABxv',
    '.zDDDτAABBx.',
    '.3zDDτABBxv.',
    '..3zAAABxv..',
    '....xwwv....',
    '....JJJJ....',
])
# 박공 작은 창 둘(다락) — 좁은 둥근 머리
tall_window(c, 27, 44, 10, w=7)
tall_window(c, 68, 44, 10, w=7)

# ---------------------------------------------------------------- 층 띠·창
pink_band(c, 1, W - 2, WALL_Y)
pink_band(c, 1, W - 2, 86)
pink_band(c, 1, W - 2, 114)
for wx in (19, 48, 77):
    tall_window(c, wx, 64, 19)
    tall_window(c, wx, 92, 19)
# 3층 가운데 창 위 길드 문장(방패 — 금 저울, 글자 없음)
# 1층: 문(왼쪽 가운데) + 창 둘
tall_window(c, 15, 121, 16)
tall_window(c, 72, 121, 16)

# 귀돌(모서리 긴 돌·짧은 돌 교대) — 벽보다 밝은 큰 돌
QUOIN = [(5, 8), (5, 5)]


def quoins(x0, y0, y1, side):
    y, i = y0, 0
    while y < y1:
        h, w = QUOIN[i % 2]
        for yy in range(y, min(y + h, y1)):
            for k in range(w):
                xx = x0 + k if side == 'L' else x0 - k
                if yy == y + h - 1 or (k == w - 1):
                    ch = 'J'
                elif side == 'L':
                    ch = '3' if (k == 0 or yy == y) else ('2' if k < w - 2 else 'z')
                else:
                    ch = '0' if yy == y else ('z' if k > 1 else 'y')
                    if k == 0:
                        ch = 'x'
                c.put(xx, yy, ch)
        y += h
        i += 1


quoins(2, WALL_Y + 4, GY - 3, 'L')
quoins(W - 3, WALL_Y + 4, GY - 3, 'R')
# 띠가 귀돌을 덮어야 한다 — 다시 찍기
pink_band(c, 1, W - 2, 86)
pink_band(c, 1, W - 2, 114)

# 쇠 벽 고리(벽 묶음 쇠, S자) — 층 띠 위
for (x, y) in [(33, 80), (62, 80), (33, 108), (62, 108)]:
    c.rows(x - 1, y, ['.W.', 'WUX', '.X.'])

# ---------------------------------------------------------------- 아치 문(징 박힌 두 쪽 판자, 돌 홍예)
DX0, DW = 33, 14
DY0 = 117
for i, (dx, dy) in enumerate([(-2, 7), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (6, -3), (9, -3), (11, -2),
                              (13, 0), (14, 2), (14, 4), (14, 7)]):
    x, y = DX0 + dx, DY0 + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, '3' if (j == 0 and k == 0) else ('z' if j == 0 else 'x'))
for y in range(DY0 + 9, GY - 1):
    c.put(DX0 - 2, y, '2' if y % 5 else 'J')
    c.put(DX0 - 1, y, 'x')
    c.put(DX0 + DW, y, 'w')
    c.put(DX0 + DW + 1, y, 'y' if y % 5 else 'J')
arch_door(c, DX0, DY0, DW, GY - DY0 - 1)
# 가운데 맞닿은 선(두 쪽 문)
for y in range(DY0 + 3, GY - 1):
    if c.get(DX0 + 7, y) not in 'XWki':
        c.put(DX0 + 7, y, '-')
# 문 위 이맛돌
c.rows(DX0 + 5, DY0 - 5, ['3zzx', '2zyw', 'xwvJ'])

# 걸린 길드 간판(쇠 팔 + 청색 널 + 금 열쇠 그림, 글자 없음) — 문 오른쪽
for x in range(50, 63):
    c.put(x, 119, 'U' if x % 3 else 'X')
c.put(50, 120, 'X')
c.put(51, 120, 'U')
c.put(53, 120, 'e')
c.put(60, 120, 'e')
SIGN = [
    'ηηηηηηηηηηη',
    'ηGGGGGGGGFζ',
    'ηGFGGGGGFEζ',
    'ηGGKKGGGFEζ',
    'ηGKFLKKKKEζ',
    'ηGGKKGGKFEζ',
    'ηGGGGGGLFEζ',
    'ηFGGGGGFEEζ',
    'ζζζζζζζζζζ-',
]
c.rows(51, 121, SIGN)

# 기초: 짙은 회색 돌 3줄
for x in range(2, W - 2):
    c.put(x, GY - 3, 'i' if x % 9 else 'e')
    c.put(x, GY - 2, 'e' if x % 13 else 'a')
    c.put(x, GY - 1, 'a' if x % 11 else 'Y')
    c.put(x, GY, 'Y' if x % 7 else 'W')
for x in range(DX0 - 2, DX0 + DW + 2):
    c.put(x, GY - 1, 'm' if x % 4 else 'k')
    c.put(x, GY, 'e')
for x in range(2, W - 2, 12):
    c.put(x, GY - 2, 'Y')
    c.put(x, GY - 1, 'W')

# 풍화·이끼(손 좌표): 기초 위, 박공 계단 그늘
for (x, y, ch) in [(3, GY - 4, 'N'), (4, GY - 4, 'M'), (9, GY - 4, 'O'), (30, GY - 4, 'N'), (55, GY - 4, 'M'),
                   (56, GY - 4, 'N'), (88, GY - 4, 'N'), (91, GY - 4, 'M'), (14, 52, 'M'), (15, 52, 'N'),
                   (85, 46, 'M'), (60, 28, 'N'), (61, 28, 'M'), (20, 2 + 28, 'N')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

walk = ['******', '******', '******', '******', '******', 'XXXXXX', 'XXXXXX', 'XXDXXX', 'XXDXXX']
meta = {'name': '계단 박공 길드 회관', 'massing': '10', 'material': 'stone',
        'refs': ['bd-house-cathedral', 'bd-house-h124_0'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('guildhall', meta)
print('fails', fails, 'warns', warns)
