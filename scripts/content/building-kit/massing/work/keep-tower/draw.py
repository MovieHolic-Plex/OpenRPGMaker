"""keep-tower — 사각 성탑(덩어리 모형 20). 5×9 칸(80×144). 다시 돌리면 같은 그림. 난수 없음.
버들항 성벽 탑 결: 밝은 회백 마름돌(줄 높이·돌 폭 제각각, 돌마다 밝은 윗모·짙은 아랫모, 짙은 회색 줄눈, 크림 돌 섞임),
왼쪽 밝음 → 오른쪽 그늘 단계 + 아래로 갈수록 조금 어둡게, 귀돌. 맨 위 사방 흉벽: 윗면 띠 + 안쪽 면, 흉벽 안 걷는 돌판 바닥
(옆 5px · 앞 8px 이 보인다), 그 안을 채운 청석 모임(피라미드) 지붕. 흉벽 밑 내민 돌받침, 같은 줄의 화살창, 밑 아치 문(모형대로 현관채 없음)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pix  # noqa: E402
from pix import Ashlar  # noqa: E402
from common import Canvas, moss, door  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from bd import slate  # noqa: E402

W, H = 80, 144
c = Canvas(5, 9)
GY = H - 1
TY0 = 47                                   # 몸통 벽 윗줄

# ---------------------------------------------------------------- 몸통: 버들항 성벽 탑 같은 회백 마름돌
ash = Ashlar([7, 6, 8, 6, 7, 5, 8, 6, 7, 6, 5, 7], seed=4,
             widths=[13, 8, 11, 6, 15, 9, 12, 7, 10, 14, 8, 11, 6, 13, 9, 10, 7, 12], warm=True)


def tshade(x, y):
    s = 0
    if x < 4: s += 2
    elif x < 14: s += 1
    elif x > 74: s -= 2
    elif x > 62: s -= 1
    if y > 118: s -= 1                     # 아래로 갈수록 한 단 어둡게(땅 가까이)
    if y < TY0 + 2: s -= 2
    elif y < TY0 + 4: s -= 1
    return s


pix.flat_wall(c, 0, TY0, W, GY - 3 - TY0 + 1, ash, shade=tshade)
# 줄눈을 버들항처럼 짙은 회색(Y·W) 으로: 돌보다 셋 이상 어두운 줄눈 화소를 고른다
for y in range(TY0, GY - 2):
    for x in range(W):
        cc = ash.course_at(y - TY0)
        if cc is None:
            continue
        ci, lv, h = cc
        _, lu, w = ash.stone_at(ci, x + 300)
        if lv == h - 1 or lu == w - 1:
            c.put(x, y, 'Y' if x < 66 else 'W')
# 귀돌(크림·흰 큰 돌, 긴 돌·짧은 돌 번갈아)
y, k = TY0 + 1, 0
while y < GY - 4:
    hh = 7 if k % 2 == 0 else 6
    ww = 9 if k % 2 == 0 else 6
    for j in range(hh):
        for i in range(ww):
            last = j == hh - 1
            if last:
                c.put(i, y + j, 'Y'); c.put(W - 1 - i, y + j, 'W')
                continue
            c.put(i, y + j, 's' if (j == 0 or i == 0) else ('r' if i < ww - 2 else ('n' if i < ww - 1 else 'j')))
            c.put(W - 1 - i, y + j, 'i' if (j == 0 and i < ww - 1) else ('k' if i < ww - 1 else ('Y' if i == ww - 1 else 'j')))
            if i == ww - 1 and k % 2 == 0:
                c.put(i, y + j, 'Y')
    y += hh
    k += 1
for x in range(W):                         # 기단(짙은 큰 돌 2줄 + 땅 줄)
    c.put(x, GY - 2, 'j' if x % 11 else 'Y')
    c.put(x, GY - 1, 'e' if x % 7 else 'Y')
    c.put(x, GY, 'W' if x % 5 else 'U')


# ---------------------------------------------------------------- 화살창: 같은 열(23·56)·같은 높이, 짙은 회(먹 아님) + 벌어진 돌 테
def slit(cx, y0, h=13):
    for j in range(-2, h + 2):
        for i in range(-2, 3):
            if abs(i) == 2 and (j < 0 or j >= h):
                continue
            if j in (-2, h + 1):
                ch = 's' if i < 1 else 'n'
            elif abs(i) == 2:
                ch = 'r' if i < 0 else 'j'
            elif j == -1 or j == h:
                ch = 'k'
            elif i == 0:
                ch = 'W' if j < h - 2 else 'Y'
            elif i == 1:
                ch = 'Y'
            else:
                ch = 'i'
            c.put(cx + i, y0 + j, ch)
    c.put(cx - 1, y0 + h // 2, 'W'); c.put(cx + 1, y0 + h // 2, 'W')


for sy in (60, 89):
    slit(23, sy)
    slit(56, sy)
slit(40, 75, 11)                           # 가운데 하나(두 줄 사이 같은 간격)

# ---------------------------------------------------------------- 흉벽 밑 내민 돌받침(마시콜레이션) y 41..46
for x in range(W):
    corbel = (x % 8) in (1, 2, 3, 4, 5)
    col = ['r', 'm', 'k', 'j', 'i'] if corbel else ['j', 'e', 'Y', 'W', 'W']
    if x > 70 and corbel:
        col = ['n', 'k', 'j', 'i', 'e']
    for j, ch in enumerate(col):
        c.put(x, 41 + j, ch)
    c.put(x, 46, 'Y' if corbel else 'W')

# ---------------------------------------------------------------- 흉벽 고리 + 안 바닥(걷는 돌판)
PT = 8                                     # 뒤 흉벽 윗줄
for y in range(PT, 41):
    for x in range(W):
        if y <= PT + 3:                    # 뒤 흉벽 윗면
            ch = 'r' if x < 70 else 'm'
            if y == PT: ch = 'n'
        elif x <= 4:                       # 왼 흉벽 윗면
            ch = 'r' if x > 0 else 'n'
        elif x >= 75:                      # 오른 흉벽 윗면
            ch = 'm' if x < 79 else 'k'
        else:                              # 돌판 바닥(줄마다 엇갈린 큰 판석)
            fy = y - PT - 4
            fx = x + (4 if (fy // 5) % 2 else 0)
            ch = 'k' if (fx // 9 + fy // 5) % 3 else 'j'
            if fy % 5 == 4 or fx % 9 == 8:
                ch = 'i'
        c.put(x, y, ch)
for x in range(5, 75):
    c.put(x, PT + 4, 'k'); c.put(x, PT + 5, 'j')          # 뒤 흉벽 안쪽 면(남향, 빛)
for y in range(PT + 4, 41):
    c.put(5, y, 'e'); c.put(6, y, 'i')                    # 왼 흉벽 안쪽 면(그늘) + 바닥에 진 그늘
    c.put(74, y, 'n')                                     # 오른 흉벽 안쪽 면(빛)
# 네 모서리 위 이(위에서 본 돌 덩이: 윗면 + 앞면)
for x0 in (0, 73):
    c.rows(x0, PT - 4, ['nrrrrrn', 'rsssrrm', 'rrrrrmk', 'kkkkjji'])
c.rows(37, PT - 4, ['nrrrrn', 'rsssrm', 'rrrrmk', 'kkkjji'])

# 청석 피라미드 지붕(흉벽 안, 옆·앞 걷는 바닥을 남긴다)
RX0, RX1 = 11, 68
R_Y, E_Y = 3, 25
RL, RR = 36, 43
M_Y = 14


def rib_l(y): return RL - (RL - (RX0 + 1)) * (y - R_Y) / (E_Y - R_Y)
def rib_r(y): return RR + ((RX1 - 1) - RR) * (y - R_Y) / (E_Y - R_Y)


def in_roof(x, y):
    if not (1 <= y <= E_Y):
        return False
    if y >= M_Y:
        return RX0 <= x <= RX1
    t = (y - 1) / (M_Y - 1)
    return RL - 2 - (RL - 2 - RX0) * t <= x <= RR + 2 + (RX1 - RR - 2) * t


def rshade(x, y):
    if y < R_Y: return -1
    if x < rib_l(y): return 1 if y > R_Y + 2 else 0
    if x > rib_r(y): return -1
    return 0


slate(c, in_roof, 0, W - 1, 1, E_Y, split=14, var='naocaanc', stagger=(2, 0, 3), shade=rshade, ox=3)
for y in range(R_Y, E_Y + 1):
    c.put(int(round(rib_l(y))), y, 'η')
    c.put(int(round(rib_r(y))), y, '_')
for x in range(RL - 1, RR + 2):
    c.put(x, R_Y - 1, '-'); c.put(x, R_Y, 'ε' if x % 3 else 'δ')
c.rows(38, 0, ['.K.', 'τLτ'])
for x in range(RX0, RX1 + 1):
    c.put(x, E_Y, 'B' if x % 4 else 'C')
    c.put(x, E_Y + 1, 'e')                                # 처마가 바닥에 드리운 그늘 2줄
    c.put(x, E_Y + 2, 'i' if x % 9 else 'e')
for y in range(M_Y, E_Y + 3):                             # 지붕 오른쪽 옆 바닥 그늘
    for x in (RX1 + 1, RX1 + 2):
        if c.get(x, y) in ('k', 'j'):
            c.put(x, y, 'i')
    if c.get(RX0 - 1, y) in ('k', 'j'):
        c.put(RX0 - 1, y, 'j')

# 앞 흉벽: 이(윗면 3줄 + 앞면 4줄) · 총안(안 바닥이 보이는 틈 + 낮은 턱)
for x in range(W):
    i = x % 10
    merlon = i < 6 or x < 5 or x > 74
    last = x > 71
    if merlon:
        col = ['n', 's' if not last else 'r', 'r' if not last else 'm', 'r' if not last else 'm', 'm', 'k', 'j', 'i']
        if i == 5 and 4 < x < 75:
            col = ['k', 'm', 'k', 'k', 'j', 'i', 'e', 'e']
    else:
        col = [None, None, None, 'n', 'r', 'k', 'j', 'i']   # 틈 위 3줄은 바닥 그대로
    for j, ch in enumerate(col):
        if ch:
            c.put(x, 33 + j, ch)

# ---------------------------------------------------------------- 밑 아치 문(열 2: 32..47)
DX, DW, DY = 34, 12, 117
for (dx, dy, ch) in [(-2, 3, 's'), (-2, 4, 'r'), (-1, 1, 's'), (0, 0, 'r'), (1, -1, 's'), (2, -1, 'r'), (3, -2, 's'),
                     (4, -2, 'r'), (5, -2, 's'), (6, -2, 'r'), (7, -2, 'm'), (8, -2, 'k'), (9, -1, 'k'), (10, -1, 'j'),
                     (11, 0, 'j'), (12, 1, 'i'), (13, 3, 'i'), (13, 4, 'j'), (12, 2, 'j')]:
    c.put(DX + dx, DY + dy, ch)
for (dx, dy) in [(-3, 3), (-3, 4), (-2, 2), (-1, 0), (0, -1), (1, -2), (2, -2), (3, -3), (4, -3), (5, -3), (6, -3),
                 (7, -3), (8, -3), (9, -2), (10, -2), (11, -1), (12, 0), (13, 1), (13, 2), (14, 3), (14, 4)]:
    c.put(DX + dx, DY + dy, 'Y')
for yy in range(DY + 5, GY - 1):
    c.put(DX - 2, yy, 'r' if yy % 4 else 's'); c.put(DX - 1, yy, 'm')
    c.put(DX + DW, yy, 'e'); c.put(DX + DW + 1, yy, 'j' if yy % 4 else 'i')
door(c, DX, DY, DW, GY - 1 - DY)
for x in range(DX - 3, DX + DW + 3):
    c.put(x, GY - 1, 'r' if x % 4 else 'm'); c.put(x, GY, 'j' if x % 3 else 'e')

moss(c, [(3, 139, 2), (75, 139, 0), (60, 140, 2), (9, 120, 2)])
outline(c, 2)
print('pinholes', fill_pinholes(c))

walk = []
for cy in range(9):
    r = ''
    for cx in range(5):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 2 and cy in (7, 8):
            r += 'D'
        else:
            r += '*' if cy < 4 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='사각 성탑', massing='20', material='stone', refs=['bd-wall-tower', 'bd-castle'], walk=walk)
f, w = c.save('keep-tower', meta)
print('FAIL', f, 'WARN', w)
