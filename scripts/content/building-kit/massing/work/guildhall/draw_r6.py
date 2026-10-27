"""guildhall — 계단 박공 길드 회관(덩어리 모형 10). 3층, 촘촘한 분홍 막돌(버들항 대성당 벽 결), 남쪽 정면 계단 박공.
지붕은 앞뒤 박공(용마루가 북쪽으로 물러나는 세로선, 왼 사면 밝고 오른 사면 어둡다) — 뒤 끝도 같은 계단 박공이라
지붕은 두 계단 박공 사이에 걸린 두 사면이다. 지붕은 벽보다 넓지 않다. 6×9 칸(96×144). 문 하나(아치). 난수 없음.
(앞 판은 draw_prev.py — 검수 반려: 피라미드처럼 보이는 지붕·양옆 처마 내밈, 큰 마름돌, 넓은 귀돌·두꺼운 띠, 파란 간판.)"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib4 import Canvas, pix, SL, dense_rubble, fill_walk  # noqa: E402
from common import door as arch_door  # noqa: E402

W, H = 96, 144
c = Canvas(6, 9)
CX = 48
WALL_Y = 58
GY = H - 1
X0, X1 = 2, W - 3            # 벽·박공·지붕 모두 이 폭 안

# ---------------------------------------------------------------- 계단 박공 윤곽(앞) — 뒤 박공은 D 만큼 위
STEP_W, STEP_H, CAP_Y, N_STEPS = 7, 4, 34, 6
D = 30


def parapet_top(x):
    if x < X0 or x > X1:
        return None
    d = x - X0 if x < CX else X1 - x
    i = d // STEP_W
    if i >= N_STEPS:
        return CAP_Y
    return WALL_Y - STEP_H * (i + 1)


def back_top(x):
    return parapet_top(x) - D


# ---------------------------------------------------------------- 지붕(청석): 뒤 박공 밑 ~ 앞 박공 위
def roof_px(x, y):
    left = x < CX
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
        s = -1 if x < X1 - 10 else -2
        if var == 1:
            var = 0
    return SL[pix.slate_px(lu, lv, pix.TW, pix.TH, var, s)]


for x in range(X0, X1 + 1):
    for y in range(back_top(x) + 4, parapet_top(x)):
        c.put(x, y, roof_px(x, y))
    # 뒤 박공과 만나는 물막이(지붕 위 끝) — 짙은 한 줄 + 그 아래 그늘 한 줄
    bt = back_top(x) + 4
    c.put(x, bt, 'C' if x >= CX else 'B')
    if c.get(x, bt + 1) in SL:
        c.put(x, bt + 1, 'E' if x >= CX else 'F')
# 용마루(앞 꼭대기 갓돌 → 뒤 꼭대기 갓돌): 마루기와 줄, 왼쪽 빛·오른쪽 그늘
for y in range(back_top(CX) + 4, CAP_Y):
    c.put(CX - 2, y, 'G')
    c.put(CX - 1, y, 'H' if y % 4 else 'G')
    c.put(CX, y, 'B')
    c.put(CX + 1, y, 'C' if y % 3 == 0 else 'E')
# 지붕 양 끝(서·동 처마 끝 선): 벽 위에 얹힌 갓기와 — 서쪽 밝은 테, 동쪽 짙은 테
for y in range(back_top(X0) + 4, parapet_top(X0)):
    c.put(X0, y, 'E')
    c.put(X0 + 1, y, 'G' if y % 3 else 'F')
for y in range(back_top(X1) + 4, parapet_top(X1)):
    c.put(X1, y, 'C')
    c.put(X1 - 1, y, 'B')
# 앞 박공에 붙은 물막이 + 오른쪽 사면에 지는 계단 그림자
DK = {'H': 'G', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'C', 'C': 'C'}
for x in range(X0, X1 + 1):
    pt = parapet_top(x)
    if c.get(x, pt - 1) in DK:
        c.put(x, pt - 1, DK[c.get(x, pt - 1)])
for x in range(CX, X1 + 1):
    pt = parapet_top(x)
    for k in range(1, 4):
        if x - k >= X0 and parapet_top(x - k) < pt:
            for y in range(parapet_top(x - k) + 1, pt):
                g = c.get(x, y)
                if g in DK:
                    c.put(x, y, DK[g])
            break

# ---------------------------------------------------------------- 갓돌(회색 돌): 앞 박공 + 뒤 박공


def copings(top_fn, back=False):
    for x in range(X0, X1 + 1):
        pt = top_fn(x)
        left = x < CX
        d = x - X0 if left else X1 - x
        edge_out = d % STEP_W == 0
        if back:
            c.put(x, pt, 'n' if left else 'k')
            c.put(x, pt + 1, 'k' if left else 'j')
            c.put(x, pt + 2, 'e' if left else 'a')
            c.put(x, pt + 3, 'v' if (x + pt) % 4 else 'J')     # 뒤 박공 앞면(분홍 막돌 한 줄)
        else:
            c.put(x, pt, ('r' if not edge_out else 'n') if left else ('m' if not edge_out else 'k'))
            c.put(x, pt + 1, 'm' if left else 'k')
            c.put(x, pt + 2, 'Z' if left else 'Y')


# ---------------------------------------------------------------- 정면 벽 + 앞 박공벽(촘촘한 분홍 막돌, 한 면)
def wall_mask(x, y):
    pt = parapet_top(x)
    return pt is not None and y >= pt + 3


def wall_shade(x, y):
    return -1 if x >= X1 - 3 else 0


dense_rubble(c, X0, 0, X1 - X0 + 1, GY - 3, seed=2, shade=wall_shade, mask=wall_mask)
copings(back_top, back=True)
copings(parapet_top)
# 계단 바깥 끝 세로 모서리(한 단 높은 계단의 옆구리): 왼쪽 반은 밝은 돌 테, 오른쪽 반은 짙은 테
for x in range(X0, X1):
    for top_fn in (parapet_top, back_top):
        a, b = top_fn(x), top_fn(x + 1)
        if b < a and x < CX:       # 오른쪽이 높다
            for y in range(b + 3, a):
                c.put(x + 1, y, 'm' if top_fn is parapet_top else 'k')
        if a < b and x >= CX:      # 왼쪽이 높다
            for y in range(a + 3, b):
                c.put(x, y, 'Y' if top_fn is parapet_top else 'a')

# 꼭대기 돌 구(피니얼)
c.rows(CX - 3, CAP_Y - 6, [
    '..rmk..',
    '.rnmkj.',
    '.nmkje.',
    '..jea..',
    '...Z...',
    '.rmmkjY',
])

# 박공 눈창(둥근 창) — 회색 돌 테 + 어두운 유리 + 네 갈래 살
c.rows(CX - 6, 38, [
    '....rmmk....',
    '..rmDDDAkZ..',
    '.rDFDτAAAkZ.',
    '.mF^DτAAABk.',
    'rmDDDτAAABkZ',
    'mττττττττττY',
    'rmDD^τAAABkZ',
    '.mDDDτAABBk.',
    '.rmDDτABBkZ.',
    '..rmAAABkZ..',
    '....kjjZ....',
])


def tall_window(cx, y0, h, w=9):
    """둥근 머리 좁은 창(대성당 창 결): 회색 돌 테(왼쪽 밝은 m · 오른쪽 그늘 Z) + 납 띠 유리 + 반짝 + 창턱."""
    hw = w // 2
    rows = ['..' + 'm' * (w - 4) + '..', '.m' + 'D' * (w - 4) + 'Z.']
    for j in range(2, h):
        inner = []
        for i in range(w - 4):
            ch = 'A'
            if j < 5:
                ch = 'D'
            if i == 0 and j % 6 in (2, 3):
                ch = '^'
            if i == w - 5:
                ch = 'W'
            if (j - 2) % 7 == 6:
                ch = '>'
            inner.append(ch)
        rows.append('mm' + ''.join(inner) + 'ZZ')
    rows.append('r' + 'm' * (w - 2) + 'k')
    rows.append('Z' * w)
    c.rows(cx - hw, y0, rows)


tall_window(27, 47, 9, w=7)
tall_window(68, 47, 9, w=7)


# 얇은 층 띠(대성당처럼 회색 돌 한 줄 + 그늘 한 줄)
def band(y):
    for x in range(X0, X1 + 1):
        c.put(x, y, 'r' if x % 8 else 'm')
        c.put(x, y + 1, 'Z')


band(WALL_Y)
band(86)
band(114)
for wx in (19, 48, 77):
    tall_window(wx, 64, 19)
    tall_window(wx, 92, 19)
tall_window(15, 121, 16)
tall_window(72, 121, 16)

# 귀돌: 좁은 밝은 돌 기둥(긴 돌·짧은 돌 교대, 막돌보다 밝지만 점묘가 있다)


def quoins(x0, y0, y1, side):
    y, i = y0, 0
    while y < y1:
        h, w = (3, 5) if i % 2 == 0 else (3, 3)
        for yy in range(y, min(y + h, y1)):
            for k in range(w):
                xx = x0 + k if side == 'L' else x0 - k
                if yy == y + h - 1:
                    ch = 'J'
                elif k == w - 1:
                    ch = 'J'
                elif side == 'L':
                    ch = 'p' if (k + yy) % 3 else 'm'
                else:
                    ch = 'v' if (k + yy) % 3 else 'w'
                c.put(xx, yy, ch)
        y += h
        i += 1


for (ya, yb) in [(WALL_Y + 2, 86), (88, 114), (116, GY - 3)]:
    quoins(X0, ya, yb, 'L')
    quoins(X1, ya, yb, 'R')

# 쇠 벽 고리(S자) — 층 띠 위
for (x, y) in [(33, 81), (62, 81), (33, 109), (62, 109)]:
    c.rows(x - 1, y, ['.W.', 'WUX', '.X.'])

# ---------------------------------------------------------------- 아치 문(징 박힌 두 쪽 판자, 회색 돌 홍예)
DX0, DW = 33, 14
DY0 = 118
for (dx, dy) in [(-2, 7), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (6, -3), (9, -3), (11, -2), (13, 0), (14, 2),
                 (14, 4), (14, 7)]:
    x, y = DX0 + dx, DY0 + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, 'r' if (j == 0 and k == 0) else ('m' if j == 0 else 'Z'))
for y in range(DY0 + 9, GY - 1):
    c.put(DX0 - 2, y, 'm' if y % 5 else 'Z')
    c.put(DX0 - 1, y, 'k')
    c.put(DX0 + DW, y, 'Y')
    c.put(DX0 + DW + 1, y, 'k' if y % 5 else 'Z')
arch_door(c, DX0, DY0, DW, GY - DY0 - 1)
for y in range(DY0 + 3, GY - 1):
    if c.get(DX0 + 7, y) not in 'XWki':
        c.put(DX0 + 7, y, '-')

# 걸린 길드 간판(쇠 팔 + 바랜 나무 널 + 쇠 열쇠 그림, 글자 없음)
for x in range(50, 63):
    c.put(x, 119, 'U' if x % 3 else 'X')
c.put(50, 120, 'X')
c.put(51, 120, 'U')
c.put(53, 120, 'e')
c.put(60, 120, 'e')
SIGN = [
    'ζηηηηηηηηη-',
    'ηεεδεεεδεε-',
    'ηεikεεεεεδ-',
    'ηiaYiiiiiε-',
    'ηkYεkYYkYε-',
    'ηεkiεεεYεδ-',
    'ηεεεεδεεεε-',
    'ηδεεδεεεδδ-',
    '-----------',
]
c.rows(51, 121, SIGN)

# 기초: 짙은 회색 돌 3줄
for x in range(X0, X1 + 1):
    c.put(x, GY - 3, 'i' if x % 9 else 'e')
    c.put(x, GY - 2, 'e' if x % 13 else 'a')
    c.put(x, GY - 1, 'a' if x % 11 else 'Y')
    c.put(x, GY, 'Y' if x % 7 else 'W')
for x in range(DX0 - 2, DX0 + DW + 2):
    c.put(x, GY - 1, 'm' if x % 4 else 'k')
    c.put(x, GY, 'e')
for x in range(X0, X1, 12):
    c.put(x, GY - 2, 'Y')
    c.put(x, GY - 1, 'W')

# 풍화·이끼(손 좌표)
for (x, y, ch) in [(3, GY - 4, 'N'), (4, GY - 4, 'M'), (9, GY - 4, 'O'), (30, GY - 4, 'N'), (55, GY - 4, 'M'),
                   (56, GY - 4, 'N'), (88, GY - 4, 'N'), (91, GY - 4, 'M'), (14, 52, 'M'), (15, 52, 'N'),
                   (85, 46, 'M'), (60, 30, 'N'), (61, 30, 'M')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

# 바깥 윤곽(먹선 금지): 벽 가장자리는 분홍 재질 어두운 단
for y in range(c.h):
    for x in (X0, X1):
        g = c.get(x, y)
        if g in 'pvwx':
            c.put(x, y, 'u' if x == X0 else 't')

walk = ['******', '******', '******', '******', '******', 'XXXXXX', 'XXXXXX', 'XXDXXX', 'XXDXXX']
meta = {'name': '계단 박공 길드 회관', 'massing': '10', 'material': 'stone',
        'refs': ['bd-house-cathedral', 'bd-house-h124_0'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('guildhall', meta)
print('fails', fails, 'warns', warns)
