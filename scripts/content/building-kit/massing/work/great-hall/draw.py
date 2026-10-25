"""great-hall — 대회당(덩어리 모형 C07). 11×8 칸(176×128). 다시 돌리면 같은 그림. 난수 없음.
높고 가파른 잿빛 청석 지붕(정면과 나란한 용마루, 양 끝은 짧은 모임으로 닫는다) 의 마름돌 대회당.
긴 뾰족 아치 창 여섯(유리·납 띠·반짝임이 저마다 다르다) 사이 두 단 버팀벽, 가운데 큰 뾰족 아치 문,
지붕 앞 사면에서 솟는 큰 돌 굴뚝 하나(연기 구멍 둘), 2~3px 짙은 기단."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, door  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import hip_roof, chimney  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar, ST, sclamp  # noqa: E402

W, H = 176, 128
c = Canvas(11, 8)
GY = H - 1

# ---------------------------------------------------------------- 지붕
R_Y, E_Y = 8, 60
hip_roof(c, 0, W - 1, R_Y, E_Y, 34, 141, seed=3, knee_frac=0.45, slate='grey')
# 큰 굴뚝(하나): 앞 사면에서 솟는다 — 갓돌 고리 + 연기 구멍 둘(가운데 칸막이 돌)
chimney(c, 112, 0, 27, 27, cw=18)
for y in (1, 2):
    c.put(119, y, 'n')
    c.put(120, y, 'j')

# ---------------------------------------------------------------- 벽(마름돌) — 버팀벽 사이 창, 가운데 문
WX0, WX1 = 2, W - 3
WY0 = E_Y + 3
ash = Ashlar([6, 5, 6, 6, 5, 6, 5], seed=2,
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
# 기단(3px, 짙은 돌)
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 2, 'e' if x % 9 else 'a')
    c.put(x, GY - 1, 'a' if x % 7 else 'Y')
    c.put(x, GY, 'X' if x % 6 else 'W')

# 버팀벽(두 단): 앞면은 왼 밝은 모 → 오른 그늘 모의 계단 명암, 오른쪽 끝은 짙은 모서리 + 벽에 그늘 3열
BUT = [22, 46, 70, 101, 125, 149]
for bx in BUT:
    for y in range(WY0 + 4, GY - 2):
        lower = y >= 98
        w = 8 if lower else 6
        x0 = bx - (1 if lower else 0)
        for i in range(w):
            ch = ('r', 'n', 'n', 'm', 'm', 'k', 'j', 'a')[i + (0 if lower else 2)]
            if (y - WY0) % 7 == 6 and 0 < i < w - 1:
                ch = 'e'                                   # 돌 줄눈
            if i == w - 1:
                ch = 'a'
            c.put(x0 + i, y, ch)
        for k, n in ((0, 2), (1, 2), (2, 1)):
            darken(c, x0 + w + k, y, n)
    for j, row in enumerate(('srrrrrnm', 'nmmmmkkj', 'jeeeeeea')):        # 빗물 경사 갓돌(윗면 + 앞면)
        for i, ch in enumerate(row):
            c.put(bx - 1 + i, 95 + j, ch)
    for i in range(6):                                                    # 윗단 머리 갓돌
        c.put(bx + i, WY0 + 4, 's' if i < 4 else 'n')
        c.put(bx + i, WY0 + 5, 'm' if i < 4 else 'k')


# 뾰족 아치 창(긴 창): 돌 테 + 납 띠 유리 + 반짝임. 변형: 0 하늘 반사 · 1 금빛 조각 · 2 붉은·금 문장 조각 · 3 열린 쪽창
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
    if var == 2:
        for j in range(h // 3 + 2, 2 * h // 3 - 1):
            for i in (1, 2, 3, 5, 6, 7):
                c.put(x0 + i, y0 + j, ('8', 'K', '8') [(i + j) % 3] if (i + j) % 2 else 'E')
    if var == 3:
        for j in range(2 * h // 3 + 1, h - 1):
            for i in (5, 6, 7):
                c.put(x0 + i, y0 + j, 'η' if i == 5 else 'A')


WINS = [(12, 0), (34, 1), (58, 0), (113, 2), (137, 3), (162, 1)]
for k, (cx, var) in enumerate(WINS):
    lancet(cx, 74 + (k % 2), 28 - (k % 3), var)

# 가운데 큰 뾰족 아치 문(열 5: 80..95) + 홍예석 + 위 방패
DX, DW = 81, 14
for y in range(86, GY - 2):
    for x in range(DX - 4, DX + DW + 4):
        dx = x + 0.5 - (DX + DW / 2)
        j = y - 86
        lim = DW / 2 + 4
        if j < 12:
            lim = min(lim, 1 + j * 0.85)               # 뾰족 머리
        if abs(dx) > lim:
            continue
        inner = abs(dx) <= lim - 4
        if not inner:
            ch = ('r', 'n', 'm', 'r')[(j // 3) % 4] if dx < 0 else ('j', 'i', 'e', 'j')[(j // 3) % 4]
            if j % 3 == 2:
                ch = 'e' if dx < 0 else 'a'
        else:
            i = int(x - DX)
            ch = ('η', 'θ', 'ε', 'β')[i % 4] if i != DW // 2 else '_'
            if y in (100, 114):
                ch = 'X' if i % 2 else 'W'
        c.put(x, y, ch)
for (x, y) in [(85, 100), (91, 100), (85, 114), (91, 114)]:
    c.put(x, y, 'k')
c.put(86, 107, 'K')
c.put(89, 107, 'K')
c.rows(84, 72, ['.YWWWWY.', 'YkmmmmjY', 'mEGGGGBe', 'mGKLLKBe', 'mEGKKGBe', '.mEGGBe.', '..mEBe..', '...ma...'])

moss(c, [(4, 56, 2), (168, 54, 0), (60, 52, 2), (3, 121, 2), (170, 122, 0)])
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
