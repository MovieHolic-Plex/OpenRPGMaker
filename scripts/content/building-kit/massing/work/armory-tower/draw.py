"""armory-tower — 무기고 탑(덩어리 모형 C11). 4×7 칸(64×112). 다시 돌리면 같은 그림. 난수 없음.
두꺼운 사각 마름돌 탑: 맨 위는 위에서 내려다본 넓은 흉벽 바닥(사방 갓돌 윗면 띠 + 판석 바닥 + 소품: 창 거치대·
뚜껑 보이는 나무 상자·통·뚜껑문), 앞 흉벽 이(윗면 5줄 + 앞면), 받침돌 띠, 몸은 줄 맞춘 마름돌에 왼 밝음→오른 그늘
계단 명암과 짙은 오른 모서리, 좁은 화살창(짙은 돌 테), 쇠 덧댄 문, 3px 짙은 기단."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import barrel  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar, sclamp  # noqa: E402

W, H = 64, 112
c = Canvas(4, 7)
GY = H - 1
PX0, PX1 = 1, 62
BX0, BX1 = 3, 60
PW = 5
FLOOR0 = 7
MER = 34
BODY = 52

# ---------------------------------------------------------------- 몸: 줄 맞춘 마름돌, 세로 띠별 계단 명암
pix.TONES = ('68475869576847685749586746857968'   # 이 그림의 pix 사본만: 돌 밝기 4~9 고루, 전체로 한 단 어둡게
             '57486957684759687485967485769584'
             '74685947586957486957846958476859')
ash = Ashlar([6, 6, 5, 6, 6, 5], seed=5, warm=False, widths=[9, 7, 11, 8, 10, 6, 12, 9, 7, 10, 8, 11])


def body_shade(x, y):
    f = (x - BX0) / (BX1 - BX0)
    s = 1 if f < 0.15 else (0 if f < 0.4 else (-1 if f < 0.7 else -2))   # 넓이 전체에 걸친 다섯 단(한 단 어둡게)
    if y < BODY + 3:
        s -= 1
    return s


pix.flat_wall(c, BX0, BODY, BX1 - BX0 + 1, GY - 3 - BODY + 1, ash, shade=body_shade)
for y in range(BODY, GY - 2):                     # 모서리: 왼 밝은 귀 1열(오른 모서리는 테두리 한 줄만)
    c.put(BX0, y, 'k' if (y - BODY) % 6 != 5 else 'e')
for x in range(BX0, BX1 + 1):                     # 기단 3px
    c.put(x, GY - 2, 'e' if x < 40 else 'a')
    c.put(x, GY - 1, 'a' if x % 7 else 'Y')
    c.put(x, GY, 'X' if x % 6 else 'W')
for x in range(BX0, BX1 + 1, 9):
    c.put(x, GY - 2, 'Y')

# 화살창(짙은 돌 테 속 짙은 회색 틈)
SLIT = ['.rnmj.', '.nWUe.', '.nWUe.', '.nWUe.', '.nWUe.', '.nWUe.', '.nWUe.', '.nWUe.', '.kYXa.', '.kiea.']
c.rows(13, 60, SLIT)
c.rows(45, 64, SLIT)
c.rows(13, 80, SLIT[:1] + SLIT[1:6] + SLIT[-2:])

# 쇠 덧댄 문(열 2: 32..47) — 돌 홍예 + 판자 + 쇠 띠 셋 + 징 + 고리
DX, DW = 34, 12
for y in range(80, GY - 2):
    for x in range(DX - 3, DX + DW + 3):
        dx = x + 0.5 - (DX + DW / 2)
        j = y - 80
        lim = DW / 2 + 3
        if j < 6:
            lim = min(lim, 3 + j * 1.3)
        if abs(dx) > lim:
            continue
        if abs(dx) > lim - 3:
            ch = ('r', 'n', 'm')[(j // 3) % 3] if dx < 0 else ('j', 'e', 'i')[(j // 3) % 3]
            if j % 3 == 2:
                ch = 'e' if dx < 0 else 'a'
        else:
            i = int(x - DX)
            ch = ('η', 'θ', 'ε', 'β')[i % 4]
            if y in (88, 96, 104):
                ch = 'X' if i % 2 else 'U'
        c.put(x, y, ch)
for y in (88, 96, 104):
    for x in range(DX, DX + DW, 3):
        c.put(x, y, 'k')
c.rows(DX + 8, 99, ['.k.', 'k.X', '.X.'])

# ---------------------------------------------------------------- 받침돌 띠
CB = MER + 13
for x in range(PX0, PX1 + 1):
    k = x % 5
    dark = x > PX1 - 6
    c.put(x, CB, 'r' if not dark else 'k')
    c.put(x, CB + 1, ('m' if k else 'j') if not dark else 'j')
    if BX0 <= x <= BX1:
        for d in range(CB + 2, BODY):
            t = ((8 if k == 1 else 7) - (d - CB - 2) - (2 if dark else 0)) if k in (1, 2, 3) else 3
            c.put(x, d, sclamp(t))
    else:
        c.put(x, CB + 2, 'e' if x < 8 else 'a')
        c.put(x, CB + 3, 'a' if x < 8 else 'Y')

# ---------------------------------------------------------------- 맨 위: 흉벽 고리 + 판석 바닥 + 소품
FL0, FL1 = PX0 + PW, PX1 - PW
FLAG_W = [13, 10, 15, 11, 14, 9, 12, 16, 10, 13]
FLAG_T = 'pnpmpkpnmpkp'
for y in range(FLOOR0, MER):
    lv = y - FLOOR0
    r = lv // 4
    fy = lv % 4
    x = FL0 - ((r * 5) % 11)
    i = r * 3
    while x <= FL1:
        fw = FLAG_W[i % len(FLAG_W)]
        tone = FLAG_T[(i * 5 + r) % len(FLAG_T)]
        for xx in range(max(FL0, x), min(FL1, x + fw - 1) + 1):
            fx = xx - x
            if fy == 3:
                ch = 'g'
            elif fx == fw - 1:
                ch = 'g' if fy else 'h'
            elif fy == 0:
                ch = {'m': 'n', 'k': 'm', 'n': 'r', 'p': 'r'}[tone]
            else:
                ch = tone
            c.put(xx, y, ch)
        x += fw
        i += 1
for x in range(FL0, FL1 + 1):                     # 흉벽 안 그늘(뒤 3줄, 왼 3열)
    darken(c, x, FLOOR0, 2)
    darken(c, x, FLOOR0 + 1, 2)
    darken(c, x, FLOOR0 + 2, 1)
for y in range(FLOOR0, MER):
    darken(c, FL0, y, 2)
    darken(c, FL0 + 1, y, 1)
    darken(c, FL0 + 2, y, 1 if y % 2 else 0)
for y in range(0, MER + 5):                       # 옆 흉벽 윗면 띠(5)
    seam = y % 8 == 7
    for i in range(PW):
        c.put(PX0 + i, y, 'e' if seam else ('k', 's', 'r', 'n', 'j')[i])
        c.put(PX1 - i, y, 'Y' if seam else ('a', 'k', 'n', 'm', 'j')[i])
for x in range(FL0, FL1 + 1):                     # 뒤 흉벽 윗면(갓돌 4) + 안쪽 남향 낮은 면(3)
    seam = (x - FL0) % 9 == 8
    for j, ch in enumerate(('n', 's', 'r', 'r')):
        c.put(x, j, 'e' if seam else (ch if x < 46 else {'n': 'k', 's': 'n', 'r': 'm'}[ch]))
    for j in range(4, FLOOR0):
        c.put(x, j, ('j', 'e', 'a')[j - 4] if (x + j) % 7 else 'Y')
for x in range(PX0, PX1 + 1):                     # 뒤 흉벽 이 사이 틈(실루엣)
    if (x - PX0 + 3) % 12 >= 8 and PW + 1 <= x <= PX1 - PW - 1:
        c.put(x, 0, '.')
        c.put(x, 1, '.')
        c.put(x, 2, 'k')

# 소품: 통 하나(위 타원 윗면) — 오른쪽 흉벽 곁, 바닥에 그림자
barrel(c, 45, 13, w=9, h=11)
for i in range(9):
    darken(c, 46 + i, 24, 1)
for j in range(14, 24):
    darken(c, 54, j, 1)

# 앞 흉벽: 이(윗면 5 + 앞면 8) · 총안
MW, GW = 8, 4
for x in range(PX0, PX1 + 1):
    k = (x - PX0 + 2) % (MW + GW)
    dark = x > PX1 - 6
    if k < MW or x < PX0 + 3 or x > PX1 - 2:
        kk = min(k, MW - 1)
        tops = ['s', 's', 'r', 'r', 'r', 'n', 'n', 'm']
        for j in range(5):
            ch = tops[kk] if j < 4 else ('j' if kk < MW - 2 else 'e')
            if dark:
                ch = {'s': 'n', 'r': 'm', 'n': 'k', 'm': 'j', 'k': 'i', 'j': 'e', 'e': 'a'}[ch]
            c.put(x, MER + j, ch)
        for y in range(MER + 5, MER + 13):
            t = [8, 7, 7, 7, 6, 6, 5, 4][kk] - (2 if dark else 0)
            if y == MER + 5:
                t += 1
            if y in (MER + 8, MER + 12):
                t -= 3
            if (y < MER + 8 and kk == 4) or (y > MER + 8 and kk == 2):
                t -= 3
            c.put(x, y, sclamp(t))
    else:
        g = k - MW
        for y in range(MER, MER + 4):
            c.put(x, y, 'e' if g < 2 else 'j')
        c.put(x, MER + 4, 'a' if g < 2 else 'e')
        c.put(x, MER + 5, 'm' if g else 'k')
        c.put(x, MER + 6, 'k')
        for y in range(MER + 7, MER + 13):
            c.put(x, y, sclamp(6 - (2 if dark else 0) - (3 if y == MER + 12 else 0)))

moss(c, [(4, 104, 2), (55, 105, 0)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))
walk = []
for cy in range(7):
    r = ''
    for cx in range(4):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        r += '.' if not op else ('D' if (cx == 2 and cy in (5, 6)) else ('*' if cy < 3 else 'X'))
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='무기고 탑', massing='C11', material='stone', refs=['bd-wall-tower', 'bd-castle'], walk=walk)
f, w = c.save('armory-tower', meta)
print('FAIL', f, 'WARN', w)
