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

# ---------------------------------------------------------------- 1) 큰 지붕 처마 밑 판자 띠(얇게 — 두 지붕 사이 그늘 턱)
CY0, CY1 = 28, 33
planks(c, 2, CY0, 188, CY1 - CY0 + 1, bh=3, start=2, shade_top=3)

# ---------------------------------------------------------------- 2) 큰 지붕(양 끝 모임)
R_Y, E_Y = 2, 27
hip_roof(c, 0, 191, R_Y, E_Y, 32, 159, vshift=2)

# ---------------------------------------------------------------- 3) 앞 측랑 외쪽 지붕(양 끝 작은 모임)
A_TOP, A_EAVE = 31, 50
lx, rx, out_l, out_r = hip_roof(c, 2, 189, A_TOP, A_EAVE, 16, 175, vshift=7)
# 윗변: 위벽에 붙는 물막이 판(용마루 줄을 덮어쓴다) + 판자 위벽이 측랑 지붕에 지는 짧은 그늘
for x in range(14, 178):
    c.put(x, A_TOP, 'α' if x % 6 else '-')
    c.put(x, A_TOP + 1, '_' if x % 9 else '|')
    ch = c.get(x, A_TOP + 2)
    c.put(x, A_TOP + 2, common.DARKER.get(ch, ch))

# ---------------------------------------------------------------- 4) 막돌 아래벽
WY0 = A_EAVE + 3                                # 61
GY = 93                                         # 본채 벽 마지막 줄 — 포치와 같은 밑선(94 기초)
for x in range(4, 188):                          # 처마 밑 그늘 띠
    c.put(x, WY0, '|' if x % 7 else '-')
    c.put(x, WY0 + 1, '-')
small_rubble(c, 4, WY0 + 2, 184, GY - (WY0 + 2) + 1, start=3)
# 벽 모서리 돌(큰 귀돌, 밝은 왼쪽 · 그늘 오른쪽)
for (x0, lit) in ((4, True), (182, False)):
    for k, (yy, hh) in enumerate([(55, 5), (60, 5), (65, 6), (71, 5), (76, 6), (82, 5), (87, 6)]):
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
# 벽 구멍 여섯 — 모두 다르다: 환기 틈 둘(높이·반짝 다름), 닫힌 덧문 둘(크기 다름), 유리창 하나, 건초 들창 하나


def vent(sx, sy, hgt, glint):
    for j in range(hgt):
        for i in range(5):
            if i in (0, 4) or j in (0, hgt - 1):
                ch = 'm' if (i == 0 or j == 0) else 'e'
            else:
                ch = 'A' if i == 2 else ('B' if j > 2 else 'D')
            c.put(sx + i, sy + j, ch)
    c.put(sx + 2, sy + glint, '^')
    for i in range(-1, 6):                      # 돌 창턱
        c.put(sx + i, sy + hgt, 'n' if i < 2 else 'i')
        c.put(sx + i, sy + hgt + 1, 'Y')


vent(16, 60, 15, 3)
vent(158, 62, 11, 5)
shutter_hatch(c, 34, 61, 10, 13)
shutter_hatch(c, 136, 64, 8, 10)
common.window(c, 56, 62, w=10, h=12, box=False, look=3)
shutter_hatch(c, 170, 58, 12, 14)
for i in range(-1, 13):                          # 건초 들창 위 도르래 들보
    c.put(170 + i, 56, 'η' if i % 5 else 'θ')
    c.put(170 + i, 57, '-')
c.rows(175, 52, ['.XX.', 'XkeX', '.XX.', '.τ..'])
foundation(c, 4, 187, GY + 1)

# ---------------------------------------------------------------- 5) 가운데 박공 포치(큰 두 짝 널문)
PX0, PX1 = 88, 119                              # 포치 벽
RX0, RX1 = PX0 - 5, PX1 + 5
APEX, KNEE, EAVE, GPEAK = 33, 50, 62, 46
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
    c.put(103 + dx, 52 + dy, ch)
# 포치 지붕 두 사면을 다시 깐다: 용마루(남북)가 앞 박공 꼭대기에서 측랑 지붕까지 올라가고,
# 사면은 골(짙은 2px)로 측랑 지붕과 만난다. 왼 사면은 빛, 오른 사면은 그늘. 기와 줄은 가로.
PC = (RX0 + RX1 + 1) // 2                       # 104
RT, VB = APEX, A_EAVE                            # 용마루 뒤끝(측랑 지붕과 만남) · 골 아래끝(측랑 처마)
L_BANDS = [('L', 'ρ', 'π', '?'), ('ρ', 'ρ', 'π', '?'), ('ρ', 'π', '<', '$'), ('π', 'π', '<', '$'), ('π', 'ν', '?', '@')]
R_BANDS = [('ν', 'λ', '+', '9'), ('λ', 'λ', '&', '9'), ('λ', '&', '&', '9'), ('&', '&', '%', '6'), ('&', '%', '%', '6')]


def yv(x):                                       # 골 선
    return RT + abs(PC - x) * (VB - RT) / (PC - RX0)


def yr(x):                                       # 박공 처마(널판 위끝)
    return GPEAK + abs(PC - x) * (EAVE - GPEAK) / (PC - RX0)


common.roof(c, lambda x, y: RX0 <= x < PC and yv(x) <= y < yr(x) - 1, RX0, PC - 1, RT, EAVE, bands=L_BANDS, vshift=4)
common.roof(c, lambda x, y: PC <= x <= RX1 and yv(x) <= y < yr(x) - 1, PC, RX1, RT, EAVE, bands=R_BANDS, vshift=9)
for x in range(RX0, RX1 + 1):
    y0 = int(round(yv(x)))
    lit = x < PC
    c.put(x, y0, '9' if lit else '6')            # 골(측랑 지붕과 만나는 짙은 선 2px)
    c.put(x, y0 + 1, '$' if lit else '9')
    y1 = int(round(yr(x)))                       # 박공 널판(2px, 위 밝음)
    c.put(x, y1 - 1, 'θ' if lit else 'η')
    c.put(x, y1, 'ε' if lit else 'δ')
for y in range(RT, GPEAK):                      # 용마루(남북): 왼쪽 밝음 · 오른쪽 그늘
    c.put(PC - 1, y, 'ρ' if y % 3 else 'π')
    c.put(PC, y, '<' if y % 3 else '$')
c.rows(PC - 2, GPEAK - 2, ['.θη.', 'θηηε'])      # 박공 꼭대기 널 마감
# 포치 벽: 막돌 기둥 + 큰 두 짝 널문
PWY = EAVE + 3                                  # 65
small_rubble(c, PX0, PWY, PX1 - PX0 + 1, GY - PWY + 1, start=7)
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
foundation(c, PX0, PX1, GY + 1, step=(DX - 1, DX + DW))

# ---------------------------------------------------------------- 6) 손 마감: 지붕 이끼·묵은 기와 덩이·풍화
moss(c, [(40, 15, 2), (140, 18, 2), (30, 44, 2)])
for (x, y, ch) in [(5, 93, 'N'), (6, 93, 'O'), (40, 93, 'N'), (84, 93, 'O'), (124, 93, 'N'), (186, 93, 'N'),
                   (60, 92, 'N')]:
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
import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_tb', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))
meta = {'name': '십일조 헛간', 'massing': 'M02', 'material': 'wood',
        'refs': ['bd-house-ware0', 'bd-house-cstable'], 'walk': walk}
fails, warns = c.save('tithe-barn', meta)
print('fails', fails, 'warns', warns)
