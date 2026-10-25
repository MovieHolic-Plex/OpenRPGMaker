"""keep-tower — 사각 성탑(덩어리 모형 20). 5×9 칸(80×144). 다시 돌리면 같은 그림. 난수 없음.
버들항 흰 돌 탑: 따뜻한 흰 마름돌 몸통(귀돌, 왼 밝음 → 오른 그늘), 맨 위 사방 흉벽(윗면이 보이는 띠 + 이·총안) 안을
꽉 채운 청석 모임(피라미드) 지붕(버들항 병영 결 비늘, 갈색 갈빗대), 흉벽 밑 내민 돌받침(마시콜레이션),
같은 줄에 맞춘 화살창(돌의 짙은 단), 아래 앞으로 나온 현관채(제 청석 모임지붕 윗면) + 아치 문."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pix  # noqa: E402
from common import Canvas, moss, door  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from bd import WarmAshlar, slate, shift  # noqa: E402

W, H = 80, 144
c = Canvas(5, 9)
GY = H - 1

# ---------------------------------------------------------------- 탑 몸통(따뜻한 흰 마름돌)
TY0 = 44
ash = WarmAshlar([6, 5, 6, 6, 5, 6, 5, 6], seed=6, widths=[11, 7, 13, 9, 12, 8, 10, 14, 9, 7, 12])


def tshade(x, y):
    s = 0
    if x < 6: s += 1
    if x > 66: s -= 1
    if x > 73: s -= 1
    if y < TY0 + 3: s -= 2 if y < TY0 + 1 else 1
    return s


pix.flat_wall(c, 0, TY0, W, GY - 3 - TY0 + 1, ash, shade=tshade)
# 귀돌(왼 밝음 · 오른 그늘), 긴 돌 · 짧은 돌 번갈아
y, k = TY0 + 1, 0
while y < GY - 4:
    hh = 6 if k % 2 == 0 else 5
    ww = 8 if k % 2 == 0 else 5
    for j in range(hh):
        for i in range(ww):
            last = j == hh - 1
            c.put(i, y + j, 'f' if last else ('5' if (j == 0 or i == 0) else ('3' if i < ww - 1 else 'z')))
            c.put(W - 1 - i, y + j, 'c' if last else ('l' if i == 0 else ('y' if i < ww - 1 else 'f')))
    y += hh
    k += 1
for x in range(W):                       # 기단
    c.put(x, GY - 2, 'w' if x % 8 else 'f')
    c.put(x, GY - 1, 'f' if x % 6 else 't')
    c.put(x, GY, 'c' if x % 5 else 'W')


# ---------------------------------------------------------------- 화살창: 같은 열(24·55)·같은 높이, 돌 짙은 단(검정 아님) + 벌어진 돌 테
def slit(cx, y0, h=12):
    for j in range(-2, h + 2):
        for i in range(-2, 3):
            if abs(i) == 2 and (j < 0 or j >= h):
                continue
            if j in (-2, h + 1):
                ch = '5' if i < 1 else 'z'           # 위·아래 큰 돌(윗돌 밝게, 아랫돌 창턱)
            elif abs(i) == 2:
                ch = '3' if i < 0 else 'l'          # 벌어진 테(왼 빛 · 오른 그늘)
            elif j == -1 or j == h:
                ch = 'y'
            elif i == 0:
                ch = 't' if j < h - 2 else 'c'      # 가는 틈: 돌의 짙은 단
            elif i == 1:
                ch = 'c'
            else:
                ch = 'f'                            # 틈 왼 사면(깎은 면)
            c.put(cx + i, y0 + j, ch)
    c.put(cx, y0 + 3, 'c')
    c.put(cx - 1, y0 + h // 2, 't'); c.put(cx + 1, y0 + h // 2, 't')   # 가로 틈(십자)


for sy in (54, 82):
    slit(24, sy)
    slit(55, sy)

# ---------------------------------------------------------------- 흉벽 밑 내민 돌받침(마시콜레이션) y 38..43
for x in range(W):
    i = x % 8
    corbel = i in (1, 2, 3, 4, 5)
    col = ['0', 'p', 'z', 'l'] if corbel else ['l', 'f', 'c', 't']
    if x > 71 and corbel:
        col = ['z', 'l', 'y', 'f']
    for j, ch in enumerate(col):
        c.put(x, 39 + j, ch)
    c.put(x, 43, 'c' if not corbel else 'f')

# ---------------------------------------------------------------- 흉벽: 뒤·옆 윗면 띠, 앞 흉벽(이 + 총안)
PT = 9                                                   # 흉벽 고리 윗줄(뒤)
for y in range(PT, 39):
    for x in range(W):
        if y <= PT + 3:
            ch = '3' if x < 72 else '0'
            if y == PT: ch = 'z'
        elif x <= 5:
            ch = '3' if 0 < x < 5 else ('z' if x == 0 else 'p')        # 왼 흉벽 윗면
        elif x >= 74:
            ch = '0' if x < 79 else 'y'                                 # 오른 흉벽 윗면
        else:
            ch = 'u'                                                    # 안 바닥(지붕이 대부분 덮는다)
        c.put(x, y, ch)
for y in range(PT + 4, 33):
    c.put(6, y, 't'); c.put(73, y, 'z')                                  # 흉벽 안쪽 면(왼 흉벽 그늘 · 오른 흉벽 빛)
for x in range(6, 74):
    c.put(x, PT + 4, 'y'); c.put(x, PT + 5, 'l')                         # 뒤 흉벽 안쪽 면(남향)
# 흉벽 고리 네 모서리 위 이(위에서 본 작은 돌 덩이: 윗면 + 앞면)
for x0 in (0, 74):
    c.rows(x0, PT - 4, ['z00z0z', '055530' if x0 == 0 else '0333z0', '3555z3' if x0 == 0 else 'z000zy', 'llllff'])
# 청석 피라미드 지붕(흉벽 안을 꽉 채운다)
R_Y, E_Y = 3, 30
RL, RR = 36, 43
B_Y = 1                                              # 뒤 사면 윗줄
M_Y = 16                                             # 이 줄부터 흉벽 안을 꽉 채운다


def rib_l(y): return RL - (RL - 8) * (y - R_Y) / (E_Y - R_Y)
def rib_r(y): return RR + (71 - RR) * (y - R_Y) / (E_Y - R_Y)
def in_roof(x, y):
    if not (B_Y <= y <= E_Y):
        return False
    if y >= M_Y:
        return 7 <= x <= 72
    t = (y - B_Y) / (M_Y - B_Y)
    return RL - 2 - (RL - 2 - 7) * t <= x <= RR + 2 + (72 - RR - 2) * t


def rshade(x, y):
    if y < R_Y: return -1                              # 뒤 사면(북향, 조금 어둡다)
    if x < rib_l(y): return 1 if y > R_Y + 3 or x < RL - 4 else 0
    if x > rib_r(y): return -1
    return 0


slate(c, in_roof, 0, W - 1, B_Y, E_Y, split=17, var='nacaoana', stagger=(3, 1), shade=rshade, ox=1)
for y in range(R_Y, E_Y + 1):
    c.put(int(round(rib_l(y))), y, 'η')
    c.put(int(round(rib_r(y))), y, '_')
for x in range(RL - 1, RR + 2):
    c.put(x, R_Y - 1, '-'); c.put(x, R_Y, 'ε' if x % 3 else 'δ')
c.rows(38, 0, ['.K.', 'τLτ', '.τ.'])                       # 꼭대기 쇠 장식(꼭짓점에 닿는다)
for x in range(7, 73):
    if in_roof(x, E_Y):
        c.put(x, E_Y, 'B' if x % 4 else 'C')
    c.put(x, E_Y + 1, 't' if x > 8 else 'u')                             # 처마 그늘이 진 걷는 바닥
    c.put(x, E_Y + 2, 'u')
# 앞 흉벽: 이(윗면 3줄 + 앞면) · 총안(낮은 턱, 안 바닥 그늘)
for x in range(W):
    i = x % 10
    merlon = i < 6 or x < 5 or x > 74
    last = x > 71
    if merlon:
        col = ['z', '5' if not last else '0', '3' if not last else 'z', '0' if not last else 'z', 'p', 'z', 'l', 'y']
        if i == 5 and 4 < x < 75:
            col = ['y', '0', 'z', 'z', 'l', 'y', 'f', 'f']
    else:
        col = ['t', 'c', 't', 'u', '3', 'z', 'l', 'y']
    for j, ch in enumerate(col):
        c.put(x, 31 + j, ch)

# ---------------------------------------------------------------- 앞으로 나온 현관채(청석 모임지붕 윗면 + 아치 문)
PX0, PX1 = 21, 58
PR, PE = 106, 117
pash = WarmAshlar([5, 6, 5, 6, 5], seed=9, widths=[9, 6, 11, 8, 10, 7])
pix.flat_wall(c, PX0, PE + 1, PX1 - PX0 + 1, GY - 3 - PE, pash,
              shade=lambda x, y: (1 if x < PX0 + 3 else 0) - (1 if x > PX1 - 3 else 0) - (2 if y < PE + 3 else 0))
for x in range(PX0, PX1 + 1):
    c.put(x, GY - 2, 'w' if x % 6 else 'f'); c.put(x, GY - 1, 'f'); c.put(x, GY, 'c')
for y in range(PE - 2, GY + 1):                  # 현관채가 탑 벽에 드리운 그늘(오른쪽)
    for kk, n in ((1, 2), (2, 2), (3, 1), (4, 1)):
        darken(c, PX1 + kk, y, n)
for y in range(PE + 1, GY - 2):                  # 현관채 모서리(왼 밝은 귀 · 오른 짙은 귀)
    c.put(PX0, y, '5' if y % 6 else 'z'); c.put(PX0 + 1, y, '3' if y % 6 else 'l')
    c.put(PX1, y, 'f' if y % 6 else 'c'); c.put(PX1 - 1, y, 'y' if y % 6 else 'f')
for x in range(PX0 - 2, PX1 + 5):                # 현관 지붕 위 탑 벽에 지는 그늘 한 줄
    darken(c, x, PR - 1, 1)


def p_in(x, y):
    if not (PR <= y <= PE): return False
    t = (y - PR) / (PE - PR)
    return PX0 - 2 + (1 - t) * 7 <= x <= PX1 + 2 - (1 - t) * 7


def p_sh(x, y):
    t = (y - PR) / (PE - PR)
    if x < PX0 - 2 + (1 - t) * 7 + 4: return 1
    if x > PX1 + 2 - (1 - t) * 7 - 4: return -1
    return 0


slate(c, p_in, PX0 - 2, PX1 + 2, PR, PE, split=111, var='aonca', stagger=(2, 0), shade=p_sh, ox=3)
for y in range(PR, PE + 1):
    t = (y - PR) / (PE - PR)
    c.put(int(round(PX0 - 2 + (1 - t) * 7 + 3)), y, 'η')
    c.put(int(round(PX1 + 2 - (1 - t) * 7 - 3)), y, '_')
for x in range(PX0 + 6, PX1 - 5):
    c.put(x, PR - 1, '-'); c.put(x, PR, 'H' if x % 3 else 'G')
for x in range(PX0 - 2, PX1 + 3):
    if p_in(x, PE): c.put(x, PE, 'B' if x % 4 else 'C')
# 아치 문(열 2: 32..47) + 쐐기돌 테
DX, DW, DY = 34, 12, 120
for (dx, dy, ch) in [(-2, 3, '5'), (-2, 4, '3'), (-1, 1, '5'), (0, 0, '3'), (1, -1, '5'), (2, -1, '3'), (3, -2, '5'),
                     (4, -2, '0'), (5, -2, '5'), (6, -2, '0'), (7, -2, 'p'), (8, -2, 'z'), (9, -1, 'z'), (10, -1, 'l'),
                     (11, 0, 'l'), (12, 1, 'y'), (13, 3, 'y'), (13, 4, 'l'), (12, 2, 'l')]:
    c.put(DX + dx, DY + dy, ch)
for yy in range(DY + 5, GY - 1):
    c.put(DX - 2, yy, '3' if yy % 4 else '0'); c.put(DX - 1, yy, 'p')
    c.put(DX + DW, yy, 'f'); c.put(DX + DW + 1, yy, 'y' if yy % 4 else 'l')
door(c, DX, DY, DW, GY - 1 - DY)
for x in range(DX - 2, DX + DW + 2):
    c.put(x, GY - 1, '3' if x % 4 else 'p'); c.put(x, GY, 'y' if x % 3 else 'f')

moss(c, [(3, 139, 2), (75, 139, 0), (60, 140, 2)])
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
