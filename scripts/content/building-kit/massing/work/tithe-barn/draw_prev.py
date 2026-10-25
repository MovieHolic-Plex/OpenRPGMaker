"""tithe-barn — 십일조 헛간(덩어리 모형 M02). 12×6 칸(192×96).
큰 기와 모임지붕(양 끝 모임) 아래 판자 위벽(높은 창 띠) → 앞 측랑 외쪽 지붕(양 끝 작은 모임) → 막돌 아래벽.
가운데 박공 포치에 큰 두 짝 널문 하나. 다른 구멍은 환기 틈·닫힌 덧창뿐."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import gf  # noqa: E402
from common import Canvas, moss  # noqa: E402
from gf import gable_front, hip_roof, foundation, small_rubble  # noqa: E402
from wood import planks, shutter_hatch  # noqa: E402

W, H = 192, 96
c = Canvas(12, 6)

# 긴 지붕용 낱장 변화표: 줄마다 길이를 다르게 이어 붙여 반복 주기가 지붕 너비보다 길다(손 표 재배열)
V = gf.VAR2
gf.VAR2 = [V[i] + V[(i + 5) % len(V)][3:23] + V[(i + 8) % len(V)][7:(19 + i)] for i in range(len(V))]

# ---------------------------------------------------------------- 1) 판자 위벽(높은 벽, 측랑 지붕 뒤로 이어진다)
CY0, CY1 = 30, 44
planks(c, 2, CY0, 188, CY1 - CY0 + 1, bh=4, start=2, shade_top=3)
# 높은 환기 틈(세로 살) — 위벽 띠에 손 위치로
for vx in (24, 58, 132, 166):
    for j in range(5):
        for i in range(5):
            ch = 'A' if i in (1, 3) else ('β' if i in (0, 2) else '_')
            if j == 0:
                ch = 'ξ' if i < 4 else '_'
            c.put(vx + i, 31 + j, ch)
    for i in range(-1, 6):
        c.put(vx + i, 36, 'α')

# ---------------------------------------------------------------- 2) 큰 지붕(양 끝 모임)
R_Y, E_Y = 2, 27
hip_roof(c, 0, 191, R_Y, E_Y, 32, 159, vshift=2)

# ---------------------------------------------------------------- 3) 앞 측랑 외쪽 지붕(양 끝 작은 모임)
A_TOP, A_EAVE = 38, 52
lx, rx, out_l, out_r = hip_roof(c, 2, 189, A_TOP, A_EAVE, 16, 175, vshift=7)
# 윗변: 위벽에 붙는 물막이 판(용마루 줄을 덮어쓴다) + 판자 위벽이 측랑 지붕에 지는 짧은 그늘
for x in range(14, 178):
    c.put(x, A_TOP, 'α' if x % 6 else '-')
    c.put(x, A_TOP + 1, '_' if x % 9 else '|')
    ch = c.get(x, A_TOP + 2)
    c.put(x, A_TOP + 2, common.DARKER.get(ch, ch))

# ---------------------------------------------------------------- 4) 막돌 아래벽
WY0 = A_EAVE + 3                                # 61
GY = 77                                         # 본채 벽 마지막 줄(포치는 앞으로 나와 95 까지)
for x in range(4, 188):                          # 처마 밑 그늘 띠
    c.put(x, WY0, '|' if x % 7 else '-')
    c.put(x, WY0 + 1, '-')
small_rubble(c, 4, WY0 + 2, 184, GY - (WY0 + 2) + 1, start=3)
# 벽 모서리 돌(큰 귀돌, 밝은 왼쪽 · 그늘 오른쪽)
for (x0, lit) in ((4, True), (182, False)):
    for k, (yy, hh) in enumerate([(57, 5), (62, 5), (67, 6), (73, 5)]):
        ww = 6 if k % 2 == 0 else 4
        xs = x0 if lit else x0 + (6 - ww)
        for j in range(hh):
            for i in range(ww):
                if j == hh - 1 or i == ww - 1:
                    ch = 'J'
                elif j == 0 or i == 0:
                    ch = 'r' if lit else 'k'
                else:
                    ch = 'n' if lit else 'i'
                c.put(xs + i, yy + j, ch)
# 환기 틈(좁은 세로 구멍: 돌 틀 + 어둠) 넷, 닫힌 덧창 둘
for sx in (16, 36, 56, 134, 154, 172):
    for j in range(13):
        for i in range(5):
            if i in (0, 4) or j in (0, 12):
                ch = 'm' if (i == 0 or j == 0) else 'e'
            else:
                ch = 'A' if i == 2 else ('B' if j > 2 else 'D')
            c.put(sx + i, 59 + j, ch)
    c.put(sx + 1, 72, 'h')
    c.put(sx + 2, 72, 'h')
    c.put(sx + 3, 72, 'e')
foundation(c, 4, 187, GY + 1)

# ---------------------------------------------------------------- 5) 가운데 박공 포치(큰 두 짝 널문)
PX0, PX1 = 88, 119                              # 포치 벽
RX0, RX1 = PX0 - 5, PX1 + 5
APEX, KNEE, EAVE, GPEAK = 38, 52, 64, 49
in_g = gable_front(c, RX0, RX1, APEX, KNEE, EAVE, GPEAK, PX0 - 2, PX1 + 2, vshift=9, attic=False, post=False)
# 삼각벽 속을 회벽 대신 세로 널로
for y in range(GPEAK, EAVE + 3):
    for x in range(PX0 - 2, PX1 + 3):
        if in_g(x, y) and c.get(x, y) in '3yz10245':
            u = x - PX0
            ch = '-' if u % 4 == 3 else ('θ' if u % 4 == 0 else ('η' if (y + u) % 7 else 'ζ'))
            if x >= (PX0 + PX1) // 2 + 1:
                ch = {'θ': 'η', 'η': 'ζ', 'ζ': 'ε', '-': '_'}[ch]
            c.put(x, y, ch)
# 삼각벽 가운데 둥근 비둘기 구멍
for (dx, dy, ch) in [(0, 0, 'ζ'), (1, 0, 'ζ'), (-1, 1, 'ζ'), (0, 1, 'A'), (1, 1, 'A'), (2, 1, '_'),
                     (-1, 2, 'ζ'), (0, 2, 'A'), (1, 2, 'B'), (2, 2, '_'), (0, 3, '_'), (1, 3, '_')]:
    c.put(103 + dx, 56 + dy, ch)
# 골: 포치 사면이 측랑 지붕을 가르는 선
DK = dict(common.DARKER)
DK.update({'%': '7', 'θ': '%', '_': '-', 'η': 'ε', 'ζ': '-', 'α': '-', 'σ': 'ξ', 'L': 'ρ', '|': '|', '-': '-'})
ctr = (RX0 + RX1 + 1) / 2.0
half = (RX1 - RX0 + 1) / 2.0
for y in range(APEX + 1, KNEE + 1):
    hw = half * (y - APEX + 1) / (KNEE - APEX + 1)
    xl = int(ctr - hw) - 1
    xr = int(ctr + hw)
    if y > A_TOP:
        for x, n in ((xl, 2), (xl - 1, 1), (xr, 1), (xr + 1, 2), (xr + 2, 1)):
            ch = c.get(x, y)
            for _ in range(n):
                ch = DK.get(ch, ch)
            c.put(x, y, ch)
# 포치 벽: 막돌 기둥 + 큰 두 짝 널문
PWY = EAVE + 3                                  # 65
small_rubble(c, PX0, PWY, PX1 - PX0 + 1, 93 - PWY + 1, start=7)
for x in range(PX0, PX1 + 1):
    c.put(x, PWY, '|' if x % 5 else '-')
    c.put(x, PWY + 1, '-' if x % 3 else '_')
# 문 위 나무 인방
for x in range(PX0 + 3, PX1 - 2):
    c.put(x, 67, 'θ' if x % 8 else 'η')
    c.put(x, 68, 'η')
    c.put(x, 69, '-')
DX, DW, DY = 96, 16, 70
for y in range(DY, 94):
    for i in range(DW):
        x = DX + i
        leaf = i // 8
        u = i % 8
        if u == 0:
            ch = 'β' if leaf else '_'
        elif u in (3, 6):
            ch = '-'
        elif u in (1, 4):
            ch = 'θ' if leaf == 0 else 'η'
        else:
            ch = 'η' if leaf == 0 else 'ζ'
        c.put(x, y, ch)
for i in range(DW):                              # 문 사이 그늘 선
    pass
for y in range(DY, 94):
    c.put(DX + 7, y, '_')
    c.put(DX + 8, y, '|')
# 두 짝 Z 띠(밝은 사선 + 가로 띠) — ware0 결
for leaf in (0, 1):
    x0 = DX + leaf * 8
    for yy in (DY + 2, 90):
        for i in range(1, 7):
            c.put(x0 + i, yy, 'ξ' if leaf == 0 else 'θ')
            c.put(x0 + i, yy + 1, 'ε')
    for s in range(15):
        xx = x0 + 1 + round(5 * s / 14) if leaf == 0 else x0 + 6 - round(5 * s / 14)
        c.put(xx, 89 - s, 'σ' if leaf == 0 else 'ξ')
    c.put(x0 + (2 if leaf == 0 else 5), DY + 2, 'k')
    c.put(x0 + (2 if leaf == 0 else 5), 90, 'k')
c.put(DX + 6, 81, 'X')
c.put(DX + 9, 81, 'X')
c.put(DX + 6, 82, 'k')
c.put(DX + 9, 82, 'k')
# 문틀
for y in range(DY - 1, 94):
    c.put(DX - 1, y, 'ε')
    c.put(DX + DW, y, '_')
foundation(c, PX0, PX1, 94, step=(DX - 1, DX + DW))

# ---------------------------------------------------------------- 6) 손 마감: 지붕 이끼·묵은 기와 덩이·풍화
moss(c, [(8, 23, 1), (40, 15, 2), (70, 22, 0), (140, 18, 2), (176, 24, 1), (30, 48, 2), (150, 46, 0),
         (120, 8, 2), (96, 6, 2)])
for (x, y, ch) in [(5, 77, 'N'), (6, 77, 'O'), (40, 77, 'N'), (84, 77, 'O'), (124, 77, 'N'), (186, 77, 'N'),
                   (185, 77, 'O'), (60, 76, 'N'), (91, 93, 'N'), (116, 93, 'O')]:
    c.put(x, y, ch)

walk = []
for cy in range(6):
    r = ''
    for cx in range(12):
        op = any(c.g[y][x] != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 6 and cy == 5:
            r += 'D'
        elif cx in (5, 6, 7):
            r += 'X' if cy >= 4 else '*'
        else:
            r += 'X' if cy >= 3 else '*'
    walk.append(r)
print('\n'.join(walk))
meta = {'name': '십일조 헛간', 'massing': 'M02', 'material': 'wood',
        'refs': ['bd-house-ware0', 'bd-house-cstable'], 'walk': walk}
fails, warns = c.save('tithe-barn', meta)
print('fails', fails, 'warns', warns)
