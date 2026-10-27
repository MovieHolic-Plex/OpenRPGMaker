"""great-hall — 대회당(덩어리 모형 C07). 11×8 칸(176×128). 다시 돌리면 같은 그림. 난수 없음.
버들항 흰 돌·청석 회당: 청석 모임지붕(버들항 대성당·병영 비늘, 갈색 모임 갈빗대) 가운데에서 솟는 큰 네모 돌탑
(흉벽·총안 윗면이 보이는 옥상, 종창 둘), 뒤 오른쪽 작은 굴뚝, 긴 뾰족 아치 창, 버팀벽, 가운데 청석 현관 + 아치 문."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import chimney  # noqa: E402
import pix  # noqa: E402
from bd import WarmAshlar, warm_region, slate, shift  # noqa: E402

W, H = 176, 128
c = Canvas(11, 8)
GY = H - 1

# ---------------------------------------------------------------- 지붕(청석 모임) — 앞 사면 사다리꼴 + 양 끝 모임 사면
R_Y, E_Y = 27, 62
RL, RR = 52, 123             # 용마루 끝(갈빗대 꼭대기)
def rib_l(y):  return RL - (RL - 13) * (y - R_Y) / (E_Y - R_Y)
def rib_r(y):  return RR + (162 - RR) * (y - R_Y) / (E_Y - R_Y)
def edge_l(y): return RL - 3 - (RL - 3) * (y - R_Y) / (E_Y - R_Y)
def edge_r(y): return RR + 3 + (W - 1 - RR - 3) * (y - R_Y) / (E_Y - R_Y)

def in_roof(x, y):
    return R_Y <= y <= E_Y and edge_l(y) <= x <= edge_r(y)

def roof_shade(x, y):
    s = 0
    if x < rib_l(y):
        s += 1                                   # 왼 모임 사면: 빛
    elif x > rib_r(y) and y >= 45:
        s -= 1                                   # 오른 모임 사면 아래: 그늘
    return s

slate(c, in_roof, 0, W - 1, R_Y, E_Y, split=50, var='aanacanaaonaacan', stagger=(0, 2, 1, 3), shade=roof_shade)
# 모임 갈빗대(버들항 병영처럼 갈색 2화소: 왼쪽 밝은 η, 오른쪽 짙은 _)
for y in range(R_Y, E_Y + 1):
    xl = int(round(rib_l(y)))
    xr = int(round(rib_r(y)))
    c.put(xl, y, 'η'); c.put(xl + 1, y, 'ξ' if y % 5 else 'η')
    c.put(xr, y, '_'); c.put(xr - 1, y, '-' if y % 5 else '_')
# 용마루(얇은 마룻기와) + 처마 끝
for x in range(RL - 2, RR + 3):
    c.put(x, R_Y - 2, '-')
    c.put(x, R_Y - 1, 'ε' if x % 4 else 'δ')
    c.put(x, R_Y, 'H' if x % 4 in (1, 2) else 'G')
for x in range(0, W):
    if in_roof(x, E_Y):
        c.put(x, E_Y, 'B' if x % 4 else 'C')

# ---------------------------------------------------------------- 뒤 오른쪽 굴뚝(용마루 곁, 윗면 보임)
chimney(c, 119, 9, 30, 31, cw=9)
warm_region(c, 117, 9, 131, 34, keep=lambda x, y: in_roof(x, y) and y > 30)

# ---------------------------------------------------------------- 가운데 큰 네모 탑 — 지붕에서 솟는다
TX0, TX1 = 63, 112
TOP, FACE, TB = 0, 21, 53      # 옥상 윗줄 · 앞 벽 시작 · 지붕과 만나는 줄
tash = WarmAshlar([6, 5, 6, 5, 6, 6], seed=5, widths=[9, 12, 7, 11, 8, 13, 10, 7, 12, 9])

def tshade(x, y):
    s = 0
    if x < TX0 + 4: s += 1
    if x > TX1 - 5: s -= 1
    if x > TX1 - 2: s -= 1
    if y < FACE + 4: s -= 1
    return s

pix.flat_wall(c, TX0, FACE, TX1 - TX0 + 1, TB - FACE + 1, tash, shade=tshade)
# 모서리 돌(quoin): 긴 돌·짧은 돌 번갈아
for k, y0 in enumerate(range(FACE + 3, TB - 3, 6)):
    wl = 6 if k % 2 == 0 else 4
    for y in range(y0, min(y0 + 5, TB - 3)):
        for i in range(wl):
            c.put(TX0 + i, y, '0' if i < wl - 1 else 'z')
            c.put(TX1 - i, y, 'y' if i == 0 else ('l' if i < wl - 1 else 'f'))
    for i in range(wl):
        if y0 + 5 < TB - 3:
            c.put(TX0 + i, y0 + 5, 'f')
            c.put(TX1 - i, y0 + 5, 'c')
# 흉벽 밑 내민 돌받침 띠(코벨: 밝은 받침 돌 + 사이 그늘)
for x in range(TX0, TX1 + 1):
    cor = (x - TX0) % 7 in (1, 2, 3, 4)
    col = ['0', 'z', 'l'] if cor else ['l', 'f', 'c']
    if x > TX1 - 5:
        col = ['z', 'l', 'f'] if cor else ['f', 'c', 't']
    for j, ch in enumerate(col):
        c.put(x, FACE + j, ch)
# 옥상(위에서 본다): 뒤 흉벽 윗면 3 · 뒤 흉벽 안쪽 면 2 · 옆 흉벽 윗면 4 + 안쪽 면 · 돌판 바닥 8줄 · 앞 흉벽
for y in range(TOP, FACE):
    for x in range(TX0, TX1 + 1):
        if y <= 2:
            ch = '3' if x < TX1 - 6 else '0'                      # 뒤 흉벽 윗면
            if y == 0: ch = 'z'
        elif y <= 4:
            ch = 'z' if x < TX1 - 6 else 'l'                      # 뒤 흉벽 안쪽 면(남향, 빛)
            if y == 4: ch = 'l' if x < TX1 - 6 else 'y'
        elif x <= TX0 + 3:
            ch = '3' if x > TX0 else 'z'                           # 왼 흉벽 윗면
        elif x >= TX1 - 3:
            ch = '0' if x < TX1 else 'y'                           # 오른 흉벽 윗면
        elif x == TX0 + 4:
            ch = 'f'                                               # 왼 흉벽 안쪽 면(동향, 그늘)
        elif x == TX1 - 4:
            ch = 'p'                                               # 오른 흉벽 안쪽 면(서향, 빛)
        else:
            fx, fy = x - TX0 - 5, y - 5
            fx += 4 if (fy // 4) % 2 else 0
            ch = 'u' if (fx // 8 + fy // 4) % 3 else 't'           # 돌판 바닥(줄마다 엇갈린 판석, 흉벽보다 두 단 어둡다)
            if fy % 4 == 0 and fx % 8 < 6: ch = 'w'                # 판석 윗모 빛
            if fy % 4 == 3 or fx % 8 == 7: ch = 'c'
            if y in (5, 6): ch = 'c' if y == 5 else 't'            # 뒤 흉벽 그늘
            if x in (TX0 + 5, TX0 + 6): ch = 'c' if x == TX0 + 5 else 't'   # 왼 흉벽 그늘
        c.put(x, y, ch)
# 바닥 위 나무 뚜껑문(계단 구멍) — 윗면이 보이는 판자 + 쇠 고리
c.rows(97, 6, ['-ηηηηη-', '-ξηξηξ-', '-ηηKηη-', '-ηξηξη-', '_-----_'])
# 앞 흉벽: 이 윗면 3줄(위에서) + 앞면 4줄 — 총안 틈은 바닥이 보이고 낮은 턱이 있다
for x in range(TX0, TX1 + 1):
    i = x - TX0
    merlon = (i % 9) < 5 or i < 4 or i > TX1 - TX0 - 4
    last = x > TX1 - 5
    if merlon:
        col = ['z', '5' if not last else '0', '3' if not last else 'z', '0' if not last else 'z', 'p', 'z', 'l', 'y']
        if (i % 9) == 4 and 3 < i < TX1 - TX0 - 3:
            col = ['y', '0', 'z', 'z', 'z', 'l', 'f', 'y']
    else:
        col = [None, None, None, '3', 'p', 'z', 'l', 'y']           # 틈 위 3줄은 바닥 그대로
    for j, ch in enumerate(col):
        if ch:
            c.put(x, 13 + j, ch)
# 종창 둘(뾰족 아치 + 나무 덧살)
def belfry(cx, y0, h):
    for j in range(h):
        for i in range(-3, 4):
            if j < 3 and abs(i) > j + 1:
                continue
            ch = 'A' if abs(i) < 3 else ('l' if i < 0 else 'f')
            if 0 < abs(i) < 3 and j > 3 and (j % 3 == 1):
                ch = 'ε'                                          # 나무 덧살(루버)
            if abs(i) < 3 and j > 3 and j % 3 == 2:
                ch = 'C'
            c.put(cx + i, y0 + j, ch)
    for i in range(-4, 5):
        c.put(cx + i, y0 + h, 'p' if i < 3 else 'z')
        c.put(cx + i, y0 + h + 1, 'f')
belfry(78, 27, 16)
belfry(97, 27, 16)
c.put(77, 29, 'D'); c.put(96, 29, 'D')
# 탑 밑동: 조금 넓은 돌 받침 띠(지붕을 뚫고 솟는 몸) + 납 물받이(옆·아래) + 지붕에 드리운 그늘
for y in range(TB - 3, TB + 1):
    for x in range(TX0 - 2, TX1 + 3):
        j = y - (TB - 3)
        ch = ('0', 'z', 'l', 'f')[j] if x < TX1 - 3 else ('z', 'l', 'f', 'c')[j]
        if x == TX0 - 2: ch = ('3', '0', 'z', 'l')[j]
        if x == TX1 + 2: ch = 'c'
        c.put(x, y, ch)
for y in range(R_Y - 1, TB - 3):                       # 옆 납 물받이(지붕과 탑 벽 사이 회색 띠)
    for x, ch in ((TX0 - 1, 'k'), (TX0 - 2, 'i'), (TX1 + 1, 'i'), (TX1 + 2, 'e')):
        if in_roof(x, y) or c.get(x, y) != '.':
            c.put(x, y, ch)
for x in range(TX0 - 3, TX1 + 4):                      # 아래 납 물받이 + 짙은 그늘 두 줄
    if in_roof(x, TB + 1):
        c.put(x, TB + 1, 'e' if x % 6 else 'a')
        c.put(x, TB + 2, shift(c.get(x, TB + 2), -2))
        c.put(x, TB + 3, shift(c.get(x, TB + 3), -1))
for y in range(R_Y, TB + 4):                           # 오른쪽 지붕에 드리운 탑 그늘(아래로 갈수록 넓게)
    wdt = 3 + (y - R_Y) // 8
    for k in range(3, 3 + wdt):
        x = TX1 + k
        if in_roof(x, y) and x != int(round(rib_r(y))):
            c.put(x, y, shift(c.get(x, y), -2 if k < 5 else -1))

# ---------------------------------------------------------------- 벽(따뜻한 흰 마름돌) — 버팀벽 사이 창, 가운데 현관
WX0, WX1 = 2, W - 3
WY0 = E_Y + 1
ash = WarmAshlar([6, 5, 6, 6, 5, 6, 5], seed=2,
                 widths=[10, 8, 13, 9, 7, 12, 11, 8, 14, 9, 10, 7, 12, 9, 11, 8])


def wall_shade(x, y):
    s = 0
    if y < WY0 + 3:
        s -= 2 if y < WY0 + 1 else 1               # 처마 밑 그늘
    if x < WX0 + 3:
        s += 1
    elif x > WX1 - 4:
        s -= 1
    return s


pix.flat_wall(c, WX0, WY0, WX1 - WX0 + 1, GY - 3 - WY0 + 1, ash, shade=wall_shade)
for x in range(WX0, WX1 + 1):                     # 기단(3px, 짙은 돌)
    c.put(x, GY - 2, 'w' if x % 9 else 'f')
    c.put(x, GY - 1, 'f' if x % 7 else 't')
    c.put(x, GY, 'c' if x % 6 else 'W')

BUT = [24, 48, 128, 152]
for bx in BUT:
    for y in range(WY0 + 4, GY - 2):
        lower = y >= 98
        w = 8 if lower else 6
        x0 = bx - (1 if lower else 0)
        for i in range(w):
            ch = ('5', '3', '3', '0', 'p', 'z', 'l', 'f')[i + (0 if lower else 2)]
            if (y - WY0) % 7 == 6 and 0 < i < w - 1:
                ch = 'y'
            if i == w - 1:
                ch = 'f'
            c.put(x0 + i, y, ch)
        for k, n in ((0, 2), (1, 2), (2, 1)):
            darken(c, x0 + w + k, y, n)
    for j, row in enumerate(('5333330p', '0ppppzzl', 'lyyyyyyf')):
        for i, ch in enumerate(row):
            c.put(bx - 1 + i, 95 + j, ch)
    for i in range(6):
        c.put(bx + i, WY0 + 4, '5' if i < 4 else '0')
        c.put(bx + i, WY0 + 5, 'p' if i < 4 else 'z')


def lancet(cx, y0, h, var):
    """돌 테 + 가운데 세로 문설 + 가로 띠 둘 + 유리(위 밝은 하늘 반사 → 아래 짙음).
    var: 0 하늘 반사 · 1 위 금빛 장미 조각 · 2 붉은·금 문장 조각 · 3 아래 쪽창 열림."""
    w = 9
    x0 = cx - w // 2
    mid = x0 + w // 2
    for j in range(h + 2):
        for i in range(-1, w + 1):
            x = x0 + i
            y = y0 + j
            dx = abs(x + 0.5 - (x0 + w / 2))
            if j < 5 and dx > (j + 1) * 0.95:
                continue
            frame = i in (-1, w) or (j < 5 and dx > (j + 1) * 0.95 - 1.3) or j >= h
            if frame:
                ch = 'r' if x + 0.5 < x0 + w / 2 else 'j'
                if j >= h:
                    ch = 'm' if j == h else 'e'
            elif x == mid or j in (h // 3, 2 * h // 3):
                ch = 'e' if x == mid else 'E'            # 돌 문설 · 납 가로 띠
            else:
                ch = 'D' if j < 9 else ('A' if (i + j // 3) % 3 else 'B')
            c.put(x, y, ch)
    c.put(x0 + 1, y0 + 6, '^')
    if var == 0:
        for (i, j) in [(1, 8), (2, 9), (6, 12), (6, 13), (2, h - 6)]:
            c.put(x0 + i, y0 + j, '^' if j < 12 else 'F')
    if var == 1:
        for (i, j, ch) in [(3, 5, 'K'), (5, 5, 'L'), (2, 7, 'K'), (6, 7, 'K'), (3, 8, 'L'), (5, 8, 'K')]:
            c.put(x0 + i, y0 + j, ch)
    if var == 3:
        for j in range(2 * h // 3 + 1, h - 1):
            for i in (5, 6, 7):
                c.put(x0 + i, y0 + j, 'η' if i == 5 else 'A')



WINS = [(12, 0), (36, 1), (60, 3), (116, 0), (140, 3), (164, 1)]
for k, (cx, var) in enumerate(WINS):
    lancet(cx, 74 + (k % 2), 28 - (k % 3), var)
# 창 돌 테도 따뜻한 돌로
warm_region(c, 0, WY0, W - 1, GY - 3)

# ---------------------------------------------------------------- 가운데 현관(앞으로 나온 돌 현관 + 청석 모임 지붕)
PX0, PX1 = 71, 104
PE = 86                       # 현관 처마
pash = WarmAshlar([5, 6, 5, 6, 5, 6], seed=7, widths=[8, 11, 7, 12, 9, 10])
pix.flat_wall(c, PX0, PE + 1, PX1 - PX0 + 1, GY - 3 - PE, pash,
              shade=lambda x, y: (1 if x < PX0 + 3 else 0) - (1 if x > PX1 - 3 else 0) - (2 if y < PE + 3 else 0))
for x in range(PX0, PX1 + 1):
    c.put(x, GY - 2, 'w' if x % 5 else 'f'); c.put(x, GY - 1, 'f'); c.put(x, GY, 'c')
for y in range(PE + 1, GY + 1):                  # 현관이 벽에 드리운 그늘(오른쪽)
    for k, n in ((1, 2), (2, 1), (3, 1)):
        darken(c, PX1 + k, y, n)
# 현관 지붕: 짧은 용마루 + 양 끝 모임, 앞 사면 위로 물러남
PR = 72
def in_proof(x, y):
    if not (PR <= y <= PE):
        return False
    t = (y - PR) / (PE - PR)
    return PX0 - 3 + (1 - t) * 9 <= x <= PX1 + 3 - (1 - t) * 9
def pshade(x, y):
    t = (y - PR) / (PE - PR)
    if x < PX0 - 3 + (1 - t) * 9 + 5: return 1
    if x > PX1 + 3 - (1 - t) * 9 - 5: return -1
    return 0
slate(c, in_proof, PX0 - 3, PX1 + 3, PR, PE, split=79, var='naocana', stagger=(1, 3), shade=pshade, ox=1)
for y in range(PR, PE + 1):
    t = (y - PR) / (PE - PR)
    xl = int(round(PX0 - 3 + (1 - t) * 9 + 4)); xr = int(round(PX1 + 3 - (1 - t) * 9 - 4))
    c.put(xl, y, 'η'); c.put(xr, y, '_')
for x in range(PX0 + 5, PX1 - 4):
    c.put(x, PR - 1, '-'); c.put(x, PR, 'H' if x % 3 else 'G')
for x in range(PX0 - 3, PX1 + 4):
    if in_proof(x, PE):
        c.put(x, PE, 'B' if x % 4 else 'C')
# 현관 지붕이 회당 벽에 드리운 그늘
for x in range(PX0 - 3, PX1 + 6):
    for y in (PR - 2, PR - 3):
        pass
# 아치 문(현관 앞면, 열 5: 80..95)
DX, DW = 81, 14
DT = 92
for y in range(DT, GY - 2):
    for x in range(DX - 4, DX + DW + 4):
        dx = x + 0.5 - (DX + DW / 2)
        j = y - DT
        lim = DW / 2 + 4
        if j < 11:
            lim = min(lim, 2 + j * 0.95)
        if abs(dx) > lim:
            continue
        inner = abs(dx) <= lim - 4
        if not inner:
            ch = ('5', '3', '0', '5')[(j // 3) % 4] if dx < 0 else ('l', 'y', 'f', 'l')[(j // 3) % 4]
            if j % 3 == 2:
                ch = 'z' if dx < 0 else 'f'
        else:
            i = int(x - DX)
            ch = ('η', 'θ', 'ε', 'β')[i % 4] if i != DW // 2 else '_'
            if y in (104, 116):
                ch = 'X' if i % 2 else 'W'
            if j < 3:
                ch = 'β'
        c.put(x, y, ch)
for (x, y) in [(85, 104), (91, 104), (85, 116), (91, 116)]:
    c.put(x, y, 'k')
c.put(86, 110, 'K')
c.put(89, 110, 'K')

moss(c, [(4, 56, 2), (170, 56, 0), (3, 121, 2), (170, 122, 0)])
outline(c, 2)
print('pinholes', fill_pinholes(c))

walk = []
for cy in range(8):
    r = ''
    for cx in range(11):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 5 and cy in (6, 7):
            r += 'D'
        else:
            r += '*' if cy < 4 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='대회당', massing='C07', material='stone', refs=['bd-house-cathedral', 'bd-castle'], walk=walk)
f, w = c.save('great-hall', meta)
print('FAIL', f, 'WARN', w)
