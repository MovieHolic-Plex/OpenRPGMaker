"""guildhall — 계단 박공 길드 회관(덩어리 모형 10). 3층, 촘촘한 분홍 막돌(버들항 대성당 벽 결), 남쪽 정면 계단 박공.
지붕 = 버들항 h124_0 규약(㉚): 계단 앞 박공 뒤로 오각형 청석 지붕이 화면 위로 크게 물러나 꼭짓점에서 닫힌다.
기와는 용마루와 나란한 세로 열, 왼 사면 밝고 오른 사면 어둡고, 처마 끝은 비스듬한 어두운 테. 색은 버들항 대성당 청석 분포(㉝).
지붕+박공이 높이의 절반. 6×11 칸(96×176). 문 하나(아치). 난수 없음.
(앞 판은 draw_prev.py — 관문: 지붕이 얇은 회색 띠라 정면 입면도로 보임.)"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib4 import Canvas, pix, SL, dense_rubble, fill_walk  # noqa: E402
from common import door as arch_door  # noqa: E402

W, H = 96, 176
c = Canvas(6, 11)
CX = 48
WALL_Y = 90
GY = H - 1
X0, X1 = 2, W - 3            # 벽·박공·지붕 모두 이 폭 안

# ---------------------------------------------------------------- 계단 박공 윤곽(앞) — 뒤 박공은 D 만큼 위
STEP_W, STEP_H, CAP_Y, N_STEPS = 7, 5, 55, 6
EAVE_Y, APEX_Y = 40, 1      # 지붕 처마 모서리(좌우 세로 끝 위) · 용마루 꼭짓점


def parapet_top(x):
    if x < X0 or x > X1:
        return None
    d = x - X0 if x < CX else X1 - x
    i = d // STEP_W
    if i >= N_STEPS:
        return CAP_Y
    return WALL_Y - STEP_H * (i + 1)


def back_top(x):
    """지붕 윗 윤곽: 좌우 처마 모서리(EAVE_Y)에서 용마루 꼭짓점(APEX_Y)으로 닫히는 오각형 위 두 변(테 화소 줄)."""
    if x < X0 or x > X1:
        return None
    d = x - X0 if x <= RL else X1 - x
    return EAVE_Y - round(d * (EAVE_Y - APEX_Y) / (RL - X0 + 0.5)) - 3


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
# ㉚ 버들항 h124_0 규약: 세로 열 기와 · 가운데 용마루 · 바깥 2px 테. 길드 회관은 차분한 회청 석판으로 옮겨 칠한다.
import h124roof as HR  # noqa: E402
# 버들항 청석(대성당 지붕 분포: B·E 그늘, G·F 몸, H 빛) — 왼 사면 G/F/H + E 이음, 오른 사면 E/B
BLUE = {'#': 'E', '?': 'G', 'L': 'H', 'ρ': 'G', 'π': 'E', '@': 'B', '=': 'B', '<': 'E', '7': 'B', '6': 'C',
        '-': 'B', 'β': 'E', '_': 'A', '*': 'B'}
HR.paint(c, lambda x, y: X0 <= x <= X1 and back_top(x) + 2 <= y < parapet_top(x), RL, X0, X1, 0, WALL_Y,
         ox=3, oy=1, cmap=BLUE)
# 오른 사면(그늘): 4px 세로 열 청석 — 열 왼 1px 은 E(빛 받는 결), 몸 B, 열 오른 1px C(골), 4줄마다 겹침 C.
# 낱장 머리 몇 장은 E/F 로(손으로 쓴 표, 줄마다 엇갈림) — 한 색 판·잡점 금지.
RT = '0102001200100210020010012000102'
for y in range(0, WALL_Y):
    for x in range(RL + 2, X1 + 1):
        if not (back_top(x) + 2 <= y < parapet_top(x)):
            continue
        u = x - RL - 2
        col = u // 4
        v = y + (col % 2) * 2                 # 열마다 낱장 이음이 2줄 엇갈린다
        t = RT[(col * 7 + (v // 4) * 3) % len(RT)]
        uu, vv = u % 4, v % 4
        if vv == 3 or uu == 3:
            ch = 'B'                          # 겹침·골 그늘
        elif uu == 0:
            ch = 'F' if (vv == 0 and t != '0') else 'E'   # 낱장 왼 머리만 가끔 빛
        else:
            ch = 'E'
            if t == '2' and vv == 2:
                ch = 'C'                      # 몇 장은 한 단 어둡게(낡은 청석)
        c.put(x, y, ch)
# 처마 쪽(바깥 6px)은 사면이 꺾여 내려가 한 단 어둡다
DKB = {'I': 'G', 'H': 'G', 'G': 'F', 'F': 'E', 'E': 'B', 'D': 'B', 'C': 'B', 'B': 'A', 'A': 'A'}
for y in range(0, WALL_Y):
    for x in list(range(X0, X0 + 5)) + list(range(X1 - 4, X1 + 1)):
        g = c.get(x, y)
        if g in DKB and back_top(x) + 2 <= y < parapet_top(x):
            if x <= RL and g in 'HG':
                c.put(x, y, 'F')
            elif x > RL and g in 'EF':
                c.put(x, y, 'B')
# 바깥 테: 서·동 세로 끝 + 비스듬한 처마(어두운 테 2px)
for y in range(back_top(X0) + 2, parapet_top(X0)):
    c.put(X0, y, 'B')
    c.put(X0 + 1, y, 'E')
    c.put(X1, y, 'B')
    c.put(X1 - 1, y, 'C')
for x in range(X0, X1 + 1):
    bt = back_top(x)
    left = x <= RL
    c.put(x, bt, 'B')                              # 바깥 테
    c.put(x, bt + 1, 'E' if left else 'C')
    if left and x + 1 <= RL:                      # 테 안쪽 빛 한 줄(처마 끝 기와 머리)
        c.put(x + 1, bt + 2, 'H' if x % 3 else 'G')
# 비스듬한 테가 계단식으로 끊기지 않게: 한 화소 이상 내려가는 곳은 사이를 채운다
for x in range(X0, X1):
    a_, b_ = back_top(x), back_top(x + 1)
    if abs(a_ - b_) > 1:
        lo, hi = sorted((a_, b_))
        xx = x if a_ > b_ else x + 1
        for y in range(lo + 1, hi):
            c.put(xx, y, 'B')
# 용마루 꼭짓점 갓기와
c.rows(RL - 1, APEX_Y - 1, ['.HB.', 'HHBB'])
# 앞 박공에 붙은 물막이 + 오른쪽 사면에 지는 계단 그림자
for x in range(X0, X1 + 1):
    pt = parapet_top(x)
    if c.get(x, pt - 1) in DKB:
        c.put(x, pt - 1, DKB[c.get(x, pt - 1)])
for x in range(CX, X1 + 1):
    pt = parapet_top(x)
    for k in range(1, 4):
        if x - k >= X0 and parapet_top(x - k) < pt:
            for y in range(parapet_top(x - k) + 1, pt):
                g = c.get(x, y)
                if g in DKB:
                    c.put(x, y, DKB[g])
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


for (ya, yb, sd, vy) in ((0, WALL_Y + 2, 2, 0), (WALL_Y + 2, 120, 5, 1), (120, 148, 7, 2), (148, GY - 3, 3, 1)):
    dense_rubble(c, X0, ya, X1 - X0 + 1, yb - ya, seed=sd, shade=wall_shade,
                 mask=lambda x, y: wall_mask(x, y), vy0=ya - vy)   # 층마다 다른 결(위아래 같은 무늬 금지)
copings(parapet_top)
# 계단 바깥 끝 세로 모서리(한 단 높은 계단의 옆구리): 왼쪽 반은 밝은 돌 테, 오른쪽 반은 짙은 테
for x in range(X0, X1):
    a, b = parapet_top(x), parapet_top(x + 1)
    if b < a and x < CX:
        for y in range(b + 3, a):
            c.put(x + 1, y, 'm')
    if a < b and x >= CX:
        for y in range(a + 3, b):
            c.put(x, y, 'Y')


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
c.rows(CX - 6, 65, [
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


tall_window(27, 76, 9, w=7, look=3)
tall_window(68, 76, 9, w=7, look=5)


# 얇은 층 띠(대성당처럼 회색 돌 한 줄 + 그늘 한 줄)
def band(y):
    for x in range(X0, X1 + 1):
        c.put(x, y, 'r' if x % 8 else 'm')
        c.put(x, y + 1, 'Z')


band(WALL_Y)
band(118)
band(146)
for k, wx in enumerate((19, 48, 77)):
    tall_window(wx, 96, 19, look=(0, 2, 4)[k])
    tall_window(wx, 124, 19, look=(1, 3, 5)[k])
tall_window(15, 153, 16, look=6)
tall_window(74, 153, 16, look=7)

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


for (ya, yb) in [(WALL_Y + 2, 118), (120, 146), (148, GY - 3)]:
    quoins(X0, ya, yb, 'L')
    quoins(X1, ya, yb, 'R')

# 쇠 벽 고리(S자) — 층 띠 위
for (x, y) in [(33, 113), (62, 113), (33, 141), (62, 141)]:
    c.rows(x - 1, y, ['.W.', 'WUX', '.X.'])

# ---------------------------------------------------------------- 아치 문(징 박힌 두 쪽 판자, 회색 돌 홍예)
DX0, DW = 34, 12
DY0 = 150
for (dx, dy) in [(-2, 7), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (5, -3), (7, -3), (9, -2), (11, 0), (12, 2),
                 (12, 4), (12, 7)]:
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
    if c.get(DX0 + 6, y) not in 'XWki':
        c.put(DX0 + 6, y, '-')

# 걸린 길드 간판(쇠 팔 + 바랜 나무 널 + 쇠 열쇠 그림, 글자 없음)
for x in range(50, 63):
    c.put(x, 151, 'U' if x % 3 else 'X')
c.put(50, 152, 'X')
c.put(51, 152, 'U')
c.put(53, 152, 'e')
c.put(60, 152, 'e')
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
c.rows(51, 153, SIGN)

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
# 청석 지붕 윤곽은 청석 짙은 단으로(공용 색조는 파랑을 자두색으로 바꾼다 — 지붕 영역만 되돌린다)
for x in range(X0, X1 + 1):
    for y in range(0, parapet_top(x) - 3):
        g = c.get(x, y)
        if g in ('*', 'J', 'F', 'D'):
            if any(c.get(x + dx, y + dy) == '.' or not (0 <= x + dx < c.w and 0 <= y + dy < c.h)
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.put(x, y, 'B')

walk = ['******', '******', '******', '******', '******', '******', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXDXXX', 'XXDXXX']
meta = {'name': '계단 박공 길드 회관', 'massing': '10', 'material': 'stone',
        'refs': ['bd-house-h124_0', 'bd-house-cathedral'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('guildhall', meta)
print('fails', fails, 'warns', warns)
