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
D = 28


def parapet_top(x):
    if x < X0 or x > X1:
        return None
    d = x - X0 if x < CX else X1 - x
    i = d // STEP_W
    if i >= N_STEPS:
        return CAP_Y
    return WALL_Y - STEP_H * (i + 1)


def back_top(x):
    """뒤 끝은 계단이 아니라 곧은 박공 처마선(위에서 보면 뒤 박공 벽은 안 보이고 지붕 끝 갓기와만 보인다)."""
    if x < X0 or x > X1:
        return None
    d = x - X0 if x <= RL else X1 - x
    return (WALL_Y - 4 - D) - round(d * (WALL_Y - 4 - CAP_Y) / (RL - X0 + 0.5)) - 4


# ---------------------------------------------------------------- 지붕(차분한 회청 석판): 용마루는 남북(화면 세로).
# 기와 줄(course)은 용마루와 나란해 화면에서 세로 띠다 — 사면을 따라 바깥(처마)으로 갈수록 한 줄씩 내려앉는다.
# 줄 폭 3px(안쪽 1px 빛 · 몸 · 바깥 1px 겹침 그늘), 줄 안의 낱장은 세로 4px 마다 이음. 왼 사면 빛, 오른 사면 그늘.
RL = CX - 1                     # 용마루 왼(빛) 화소 = 47, 오른(그늘) = 48 → 가운데 47.5 = 앞 박공 꼭대기와 같은 축
LIT = {'hi': 'k', 'body': 'h', 'alt': 'g', 'sh': 'e', 'seam': 'e'}
DRK = {'hi': 'e', 'body': 'b', 'alt': 'a', 'sh': 'X', 'seam': 'X'}
TVAR = '0001020000100200010000201000'


def roof_px(x, y):
    left = x <= RL
    d = (RL - x) if left else (x - RL - 1)
    k = d // 3
    p = d % 3
    P = LIT if left else DRK
    if left and k >= 11:                         # 처마 쪽 두 줄은 한 단 어둡게(사면이 꺾여 내려간다)
        P = {'hi': 'h', 'body': 'e', 'alt': 'd', 'sh': 'a', 'seam': 'a'}
    if (not left) and k >= 12:
        P = {'hi': 'b', 'body': 'a', 'alt': 'X', 'sh': 'W', 'seam': 'W'}
    seam = (y + k * 2 + (k * k) % 3) % 4 == 3
    v = TVAR[(k * 5 + (y + k * 2) // 4 * 3) % len(TVAR)]
    body = P['body'] if v == '0' else (P['alt'] if v == '1' else P['hi'])
    if p == 2:
        return P['sh']
    if seam:
        return P['seam']
    if p == 0:
        return P['hi'] if v != '1' else body
    return body


# 버들항 앞박공 집(h124_0)처럼: 박공 뒤 지붕은 가로 기와 줄 — 위에서 보는 두 사면이 화면 위(북)로 물러난다.
import slate2  # noqa: E402
slate2.slate_roof(c, lambda x, y: X0 <= x <= RL and back_top(x) + 4 <= y < parapet_top(x), X0, RL, 0, CAP_Y,
                  th=3, vshift=1, bands=slate2.LIT_BANDS)
slate2.slate_roof(c, lambda x, y: RL < x <= X1 and back_top(x) + 4 <= y < parapet_top(x), RL + 1, X1, 0, CAP_Y,
                  th=3, vshift=5, bands=slate2.DRK_BANDS)
for x in range(X0, X1 + 1):
    bt = back_top(x) + 4                         # 뒤 박공과 만나는 물막이 그늘
    c.put(x, bt, 'a' if x <= RL else 'X')
# 용마루(앞 박공 꼭대기 → 뒤 박공 꼭대기): 마루 석판 두 줄, 왼쪽 빛 · 오른쪽 그늘
for y in range(back_top(CX) + 4, CAP_Y):
    c.put(RL - 1, y, 'n' if y % 4 else 'k')
    c.put(RL, y, 'r' if y % 4 else 'n')
    c.put(RL + 1, y, 'W')
    c.put(RL + 2, y, 'X' if y % 3 == 0 else 'a')
# 지붕 양 끝(서·동): 벽 위 갓기와 — 서쪽 밝은 테, 동쪽 짙은 테
for y in range(back_top(X0) + 4, parapet_top(X0)):
    c.put(X0, y, 'a')
    c.put(X0 + 1, y, 'k' if y % 3 else 'h')
for y in range(back_top(X1) + 4, parapet_top(X1)):
    c.put(X1, y, 'X')
    c.put(X1 - 1, y, 'b')
# 앞 박공에 붙은 물막이 + 오른쪽 사면에 지는 계단 그림자
DK = {'k': 'h', 'n': 'k', 'h': 'e', 'e': 'a', 'a': 'X', 'b': 'X', 'X': 'X'}
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
    """계단 갓돌: 위에서 보이는 윗면 3px(밝음 · 판석 이음) + 앞 턱 1px + 밑 그늘 1px. 왼쪽 반 밝게, 오른쪽 반 한 단 어둡게."""
    for x in range(X0, X1 + 1):
        pt = top_fn(x)
        left = x <= RL
        d = x - X0 if left else X1 - x
        joint = (d % STEP_W) in (0,) or (d % STEP_W) == 4
        if back:
            top = ('n', 'r', 'm') if left else ('m', 'k', 'k')
        else:
            top = ('r', 's', 'r') if left else ('n', 'r', 'm')
        for j, ch in enumerate(top):
            c.put(x, pt - 3 + j, ('k' if left else 'i') if joint and j > 0 else ch)
        c.put(x, pt, 'k' if left else 'i')                      # 앞 턱
        c.put(x, pt + 1, 'i' if left else 'e')
        c.put(x, pt + 2, 'Y' if left else 'a')                  # 밑 그늘(벽에)


# ---------------------------------------------------------------- 정면 벽 + 앞 박공벽(촘촘한 분홍 막돌, 한 면)
def wall_mask(x, y):
    pt = parapet_top(x)
    return pt is not None and y >= pt + 3


def wall_shade(x, y):
    return -1 if x >= X1 - 3 else 0


for (ya, yb, sd, vy) in ((0, WALL_Y + 2, 2, 0), (WALL_Y + 2, 88, 5, 1), (88, 116, 7, 2), (116, GY - 3, 3, 1)):
    dense_rubble(c, X0, ya, X1 - X0 + 1, yb - ya, seed=sd, shade=wall_shade,
                 mask=lambda x, y: wall_mask(x, y), vy0=ya - vy)   # 층마다 다른 결(위아래 같은 무늬 금지)
# 뒤 끝 갓기와(곧은 박공 처마선 2px: 위 밝음 · 아래 그늘)
for x in range(X0, X1 + 1):
    bt = back_top(x) + 3
    c.put(x, bt, 'k' if x <= RL else 'e')
    c.put(x, bt + 1, 'h' if x <= RL else 'b')
copings(parapet_top)
# 계단 바깥 끝 세로 모서리(한 단 높은 계단의 옆구리): 왼쪽 반은 밝은 돌 테, 오른쪽 반은 짙은 테
for x in range(X0, X1):
    for top_fn in (parapet_top,):
        a, b = top_fn(x), top_fn(x + 1)
        if b < a and x < CX:       # 오른쪽이 높다
            for y in range(b + 3, a):
                c.put(x + 1, y, 'm' if top_fn is parapet_top else 'k')
        if a < b and x >= CX:      # 왼쪽이 높다
            for y in range(a + 3, b):
                c.put(x, y, 'Y' if top_fn is parapet_top else 'a')

# 꼭대기 돌 구(피니얼)
c.rows(CX - 3, CAP_Y - 9, [
    '..rk..',
    '.rnmj.',
    '.nmke.',
    '..je..',
    '..ZY..',
    'rsrnmk',
    'rrnmkj',
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


def tall_window(cx, y0, h, w=9, look=0):
    """둥근 머리 좁은 창: 회색 돌 테 + 납 띠 유리. look 마다 반짝 자리·띠 간격·불빛·덧창·창턱 꽃이 다르다."""
    hw = w // 2
    glint_rows = [(2, 3), (4,), (3, 9), (6, 7), (2, 10), (5,)][look % 6]
    band = [7, 6, 8, 5, 7, 9][look % 6]
    lit = look in (2, 7)
    rows = ['..' + 'm' * (w - 4) + '..', '.m' + ('L' if lit else 'D') * (w - 4) + 'Z.']
    for j in range(2, h):
        inner = []
        for i in range(w - 4):
            if lit:
                ch = 'K' if (i + j) % 4 else 'L'
                if i == w - 5:
                    ch = 'τ'
            else:
                ch = 'D' if j < 5 else 'A'
                if i == (0 if look % 2 == 0 else 1) and j in glint_rows:
                    ch = '^'
                if i == w - 5:
                    ch = 'W' if look % 3 else 'B'
            if (j - 2) % band == band - 1:
                ch = '>' if not lit else 'τ'
            inner.append(ch)
        rows.append('mm' + ''.join(inner) + 'ZZ')
    rows.append('r' + 'm' * (w - 2) + 'k')
    rows.append('Z' * w if look % 3 else 'Y' + 'Z' * (w - 2) + 'Y')
    c.rows(cx - hw, y0, rows)
    if look in (1, 4):                                   # 창턱 꽃
        for i in range(1, w - 1):
            c.put(cx - hw + i, y0 + h, 'NOPN'[(i + look) % 4] if i % 2 else 'O')


tall_window(27, 47, 9, w=7, look=3)
tall_window(68, 47, 9, w=7, look=5)


# 얇은 층 띠(대성당처럼 회색 돌 한 줄 + 그늘 한 줄)
def band(y):
    for x in range(X0, X1 + 1):
        c.put(x, y, 'r' if x % 8 else 'm')
        c.put(x, y + 1, 'Z')


band(WALL_Y)
band(86)
band(114)
for k, wx in enumerate((19, 48, 77)):
    tall_window(wx, 64, 19, look=(0, 2, 4)[k])
    tall_window(wx, 92, 19, look=(1, 3, 5)[k])
tall_window(15, 121, 16, look=6)
tall_window(72, 121, 16, look=7)

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
                   (56, GY - 4, 'N'), (88, GY - 4, 'N'), (91, GY - 4, 'M')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

# 바깥 윤곽(먹선 금지): 벽 가장자리는 분홍 재질 어두운 단
for y in range(c.h):
    for x in (X0, X1):
        g = c.get(x, y)
        if g in 'pvwx':
            c.put(x, y, 'u' if x == X0 else 't')

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_gh', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))
_spt = _iu.spec_from_file_location('tint_gh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tint.py'))
TN = _iu.module_from_spec(_spt)
_spt.loader.exec_module(TN)
print('  윤곽 색조', TN.tint_edges(c, 48), '· 무채 가장자리', TN.neutral_share(c))

walk = ['******', '******', '******', '******', '******', 'XXXXXX', 'XXXXXX', 'XXDXXX', 'XXDXXX']
meta = {'name': '계단 박공 길드 회관', 'massing': '10', 'material': 'stone',
        'refs': ['bd-house-cathedral', 'bd-house-h124_0'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('guildhall', meta)
print('fails', fails, 'warns', warns)
