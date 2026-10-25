"""warehouse — 계단 박공 창고(덩어리 모형 M13). 5×10 칸(80×160). 다시 돌리면 같은 그림. 난수 없음.
5층 좁은 붉은 벽돌 창고. 남쪽 정면은 계단 박공(층계마다 갓돌 윗면 4줄 + 앞면), 그 뒤로 남북 용마루 지붕의
동·서 사면(기와 줄이 용마루와 나란한 세로 줄 — 왼 밝음 · 오른 그늘)이 박공 위로 보인다.
가운데 세로줄 하역문 넷(닫힘·반열림·열림 — 저마다 다르다) + 꼭대기 들보 끝 도르래·밧줄·갈고리 자루 + 아래 큰 아치 문."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss  # noqa: E402
from bits import darken, outline, fill_pinholes, window  # noqa: E402
from hand import btiles  # noqa: E402

from nh import cwin  # noqa: E402

W, H = 80, 160
c = Canvas(5, 10)
GY = H - 1
CX = 40                      # 가운데(39|40 사이)
WX0, WX1 = 2, 77

# ---------------------------------------------------------------- 지붕(박공 뒤): 버들항 박공집처럼 위에서 본 한 장의 사면
# 용마루가 화면 위로 물러나 꼭짓점이 되고, 사면 하나에 가로 기와 줄(버들항 앞 사면 결). 왼끝은 빛 받는 마구리, 오른끝은 그늘.
ROOF_KNEE = 18


def roof_in(x, y):
    hw = 38.0 * min(1.0, (y + 1) / (ROOF_KNEE + 1))
    return abs(x + 0.5 - CX) <= hw


btiles(c, roof_in, WX0, WX1, 1, 63, 'front', seed=6)
for y in range(0, 64):
    xs = [x for x in range(WX0, WX1 + 1) if roof_in(x, y)]
    if not xs:
        continue
    l, r = xs[0], xs[-1]
    btiles(c, lambda x, yy: l < x <= l + 3 and roof_in(x, yy), l, l + 3, y, y, 'lit', seed=2)
    btiles(c, lambda x, yy: r - 3 <= x < r and roof_in(x, yy), r - 3, r, y, y, 'dark', seed=4)
    c.put(l, y, 'α' if y % 2 else 'δ')
    c.put(r, y, '9' if y % 3 else '7')
c.rows(int(CX) - 2, 0, ['.ξσ.', 'ησLξ', 'ζηξη'])   # 꼭대기 마룻기와(짧게, 꼭짓점에 닿는다)

# ---------------------------------------------------------------- 벽돌(손 벽돌: 너비·밝기 제각각, 줄마다 어긋남)
BW = [7, 5, 8, 6, 7, 9, 5, 6, 8, 7, 6, 5, 9, 7, 6, 8, 5, 7]
BF = '=+=?=+&=?+==+=?&+=?=+=&?='       # 벽돌 바탕(붉은 단)
BHI = {'=': '?', '+': '=', '&': '+', '?': '?', '<': '?'}
BLO = {'=': '+', '+': '&', '&': '%', '?': '=', '<': '?'}


def brick(x0, y0, x1, y1, start=0, shade=None, skip=None):
    y = y0
    k = 0
    n = start * 5
    while y <= y1:
        hh = 4 if (k + start) % 5 else 3
        x = x0 - ((k * 3 + start) % 5)
        wi = (k * 4 + start) % len(BW)
        while x <= x1:
            sw = BW[wi % len(BW)]
            wi += 1
            f = BF[n % len(BF)]
            n += 1
            for j in range(hh):
                for i in range(sw):
                    px, py = x + i, y + j
                    if px < x0 or px > x1 or py > y1 or (skip and skip(px, py)):
                        continue
                    if j == hh - 1 or i == sw - 1:
                        col = 'c' if (px * 3 + py) % 7 else 'f'     # 회반죽(밝은 회갈)
                    elif j == 0:
                        col = BHI[f]
                    elif j == hh - 2 and i > 0:
                        col = BLO[f] if (px + py) % 3 else f
                    else:
                        col = f
                    s = shade(px, py) if shade else 0
                    for _ in range(-s):
                        col = BLO.get(col, col) if col not in 'cf' else {'c': 'Y', 'f': 'c'}[col]
                    c.put(px, py, col)
            x += sw
        y += hh
        k += 1


# ---------------------------------------------------------------- 계단 박공 + 벽
STEP_W, STEP_H = 7, 7
EAVE_Y = 62                                      # 박공 밑변(바깥 끝 첫 층계 위)
NST = 5


def gable_top(x):
    d = (x - WX0) if x < CX else (WX1 - x)
    i = d // STEP_W
    if i >= NST:
        return EAVE_Y - STEP_H * NST - 2        # 꼭대기 받침(가운데)
    return EAVE_Y - STEP_H * (i + 1)


def wall_shade(x, y):
    s = 0
    if x > WX1 - 5:
        s -= 1
    return s


brick(WX0, 18, WX1, GY - 2, start=3, shade=wall_shade, skip=lambda x, y: y < gable_top(x) + 4)
# 층계 갓돌: 윗면 4줄(위에서 본 갓돌 — 밝은 회색, 뒤로 물러난 면) + 앞면 2줄 + 밑 그늘 1줄
for x in range(WX0, WX1 + 1):
    t = gable_top(x)
    edge_r = x > CX
    for j, (lc, rc) in enumerate((('n', 'k'), ('r', 'm'), ('s', 'n'), ('r', 'm'))):
        c.put(x, t + j, rc if edge_r else lc)
    c.put(x, t + 4, 'j' if not edge_r else 'e')
    c.put(x, t + 5, 'e' if not edge_r else 'a')
    darken(c, x, t + 6, 1)
# 층계 옆 마구리(층계 끝 세로면: 왼쪽 층계는 밝은 끝, 오른쪽은 그늘 끝)
for x in range(WX0 + 1, WX1):
    a, b = gable_top(x - 1), gable_top(x)
    if b < a and x < CX:                         # 왼쪽: 다음 층계가 올라간다 → 이 열 세로 끝면
        for y in range(b + 4, a + 4):
            c.put(x, y, 'k' if (y - b) % 3 else 'j')
    if b > a and x > CX:
        for y in range(a + 4, b + 4):
            c.put(x - 1, y, 'a' if (y - a) % 3 else 'Y')
# 꼭대기: 작은 둥근 장식돌(위에서 본 윗면)

# 층 띠(얇은 돌띠): 층 사이마다 한 줄. 창·하역창은 띠 사이에만 놓는다
STRINGS = [84, 108, 130]
for sy in STRINGS:
    for x in range(WX0, WX1 + 1):
        c.put(x, sy, 'k' if x % 9 else 'j')
        c.put(x, sy + 1, 'e')
        darken(c, x, sy + 2, 1)

# ---------------------------------------------------------------- 하역창 셋(가운데 세로줄): 문이 아니라 덧창 — 손잡이 없음, 문보다 작다
LD_X, LD_W = 35, 10


def frame(x, y, w, h):
    for j in range(-1, h + 1):
        c.put(x - 1, y + j, 'n' if j % 4 else 'k')
        c.put(x + w, y + j, 'j' if j % 4 else 'e')
    for i in range(-1, w + 1):
        c.put(x + i, y - 1, 'ξ' if i < w // 2 else 'η')      # 나무 인방
        c.put(x + i, y + h, 'm' if i < w // 2 else 'j')     # 돌 창턱(윗면)
        c.put(x + i, y + h + 1, 'e')


def shutter(x, y, w, h, flip=False, brace=True):
    """판자 덧창 한 짝: 세로 판자 + 위·아래 가로대 + Z 사선 버팀(손잡이 없음)."""
    for j in range(h):
        for i in range(w):
            k = i % 3
            ch = ('η', 'ε', 'β')[k] if not flip else ('ε', 'η', 'β')[k]
            if j in (1, h - 2):
                ch = 'ζ' if not flip else 'δ'
            c.put(x + i, y + j, ch)
    if brace:
        for j in range(2, h - 2):
            i = int((j - 2) * (w - 1) / max(1, h - 5))
            c.put(x + (w - 1 - i if flip else i), y + j, 'ξ' if not flip else 'η')


def dark_in(x, y, w, h):
    for j in range(h):
        for i in range(w):
            c.put(x + i, y + j, 'a' if j < 2 else ('Y' if (i + j) % 4 else 'X'))


# 1: 위 하역창 — 두 짝 다 열려 벽에 붙고, 안에 자루 더미
y = 68
frame(LD_X, y, LD_W, 11)
dark_in(LD_X, y, LD_W, 11)
shutter(LD_X - 5, y, 3, 11)
shutter(LD_X + LD_W + 2, y, 3, 11, flip=True)
c.rows(LD_X + 1, y + 6, ['..zzy...', '.z22yxzy', 'z2yyxz2y', 'yyxxwyxw', 'wwwuuwwu'])
# 2: 가운데 하역창 — 두 짝 닫힘(가운데 맞댄 줄 + 두 Z 버팀)
y = 92
frame(LD_X, y, LD_W, 11)
shutter(LD_X, y, LD_W // 2, 11)
shutter(LD_X + LD_W // 2, y, LD_W // 2, 11, flip=True)
for j in range(11):
    c.put(LD_X + LD_W // 2, y + j, 'δ')
# 3: 아래 하역창 — 한 짝만 열림, 안에 통(윗면 타원)
y = 115
frame(LD_X, y, LD_W, 11)
dark_in(LD_X, y, LD_W, 11)
shutter(LD_X + LD_W // 2, y, LD_W // 2, 11, flip=True)
shutter(LD_X - 5, y, 3, 11)
c.rows(LD_X, y + 2, ['.ζζζζ.', 'ζσξξηβ', 'ηξξηηβ', 'XkkkeX', 'ηθεηεβ', 'ηθεηεβ', 'XkkkeX', 'δθεηεβ', '.δδδδ.'])

# 작은 창: 층마다 좌우, 띠 사이에만(저마다 다른 모양)
cwin(c, 12, 67, w=6, h=12, glint=0)
cwin(c, 63, 67, w=6, h=12, glint=2, transom=True, sill=2)
cwin(c, 12, 90, w=6, h=13, glint=1, curtain=True)
cwin(c, 62, 90, w=6, h=13, glint=3, box=True)
cwin(c, 12, 113, w=6, h=12, lit=True)
cwin(c, 63, 113, w=6, h=12, glint=1, shutters='left')
cwin(c, 12, 138, w=6, h=12, glint=0, transom=True, sill=2)
cwin(c, 63, 138, w=6, h=12, glint=2, box=True, shutters='right')
# 아래 큰 아치 문(열 2): 홍예석 + 두 짝 판자문 + 징
DX, DW = 33, 14
for y in range(135, GY - 1):
    for x in range(DX - 3, DX + DW + 3):
        dx = x + 0.5 - (DX + DW / 2)
        top = 135 + (0 if abs(dx) < 4 else int((abs(dx) - 3) ** 1.5 * 0.35))
        if y < top:
            continue
        if abs(dx) > DW / 2 + 1:
            ch = 'r' if dx < 0 else 'j'                       # 홍예·문설주 돌
            if (y - 135) % 6 == 5:
                ch = 'e'
        elif abs(dx) > DW / 2:
            ch = '-'
        else:
            i = int(x - DX)
            k = i % 3
            ch = ('η', 'ε', 'β')[k]
            if y in (142, 152):
                ch = 'X' if i % 2 else 'W'
            if i == DW // 2:
                ch = '_'
        if y == top:
            ch = 'r' if dx < 0 else 'm'
        c.put(x, y, ch)
c.put(DX + DW // 2 - 2, 148, 'K')
c.put(DX + DW // 2 + 1, 148, 'K')
# 기초
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'a' if x % 7 else 'Y')
    c.put(x, GY, 'X' if x % 6 else 'W')
for x in range(DX - 1, DX + DW + 1):
    c.put(x, GY - 1, 'r' if x % 4 else 'm')
    c.put(x, GY, 'Z')

moss(c, [(4, 152, 2), (70, 153, 0)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

walk = []
for cy in range(10):
    r = ''
    for cx in range(5):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 2 and cy in (8, 9):
            r += 'D'
        else:
            r += '*' if cy < 3 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='계단 박공 창고', massing='M13', material='stone', refs=['bd-house-ware0', 'bd-house-cathedral'], walk=walk)
f, w = c.save('warehouse', meta)
print('FAIL', f, 'WARN', w)
