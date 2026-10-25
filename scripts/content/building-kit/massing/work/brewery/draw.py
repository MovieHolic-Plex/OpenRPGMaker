"""brewery — 양조장(덩어리 모형 M32). 9×7 칸(144×112). 다시 돌리면 같은 그림. 난수 없음.
2층 양조 본채(손 기와 모임지붕, 2층 반목조 · 1층 잔 막돌) + 오른쪽 모임 사면에서 솟는 높은 막돌 굴뚝(위에서 본 갓돌·연기 구멍,
비스듬한 밑동) + 오른쪽에 붙은 1층 창고(남쪽으로 내려가는 외쪽 지붕, 바깥 끝은 모임 사선) — 열린 앞에 통이 쌓였다."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, plaster, eave_shadow, post, beam, brace, door  # noqa: E402
from gf import foundation  # noqa: E402
from slate import plaster_more  # noqa: E402
from bits import darken, outline, fill_pinholes, window  # noqa: E402
from hand import hip_roof, btiles, ridge, eave, rubble, chimney, barrel  # noqa: E402

from nh import cwin  # noqa: E402

W, H = 144, 112
c = Canvas(9, 7)

# ---------------------------------------------------------------- 창고(오른쪽 1층) 지붕 — 먼저 깔고 본채가 왼끝을 덮는다
SX0, SX1 = 98, 143
S_TOP, S_EAVE = 62, 80
S_RR = 126                     # 앞 사면 오른끝(용마루 끝) — 그 오른쪽은 모임 사선


def s_rx(y):
    return S_RR + (y - S_TOP) * (SX1 - 1 - S_RR) / (S_EAVE - S_TOP)


btiles(c, lambda x, y: x < s_rx(y), SX0, SX1, S_TOP + 3, S_EAVE, 'front', seed=5)
btiles(c, lambda x, y: s_rx(y) <= x <= min(SX1, S_RR + 2 + (y - S_TOP) * 2.2), SX0, SX1, S_TOP + 1, S_EAVE, 'dark',
       seed=9)
for y in range(S_TOP + 1, S_EAVE + 1):
    xr = int(round(s_rx(y)))
    c.put(xr - 1, y, 'η')
    c.put(xr, y, 'ε')
    c.put(xr + 1, y, '_')
ridge(c, SX0, S_RR + 1, S_TOP)
eave(c, SX0, SX1, S_EAVE + 1)

# ---------------------------------------------------------------- 본채 지붕
R_Y, E_Y = 15, 54
MX0, MX1 = 0, 103
lx, rx, out_l, out_r = hip_roof(c, MX0, MX1, R_Y, E_Y, 33, 70, seed=2)
# 높은 굴뚝: 오른쪽(그늘) 모임 사면에 선다 — 밑동이 사면 경사를 따라 오른쪽으로 내려간다
chimney(c, 87, 0, 36, 41, cw=11)

# ---------------------------------------------------------------- 본채 2층(반목조) — 기둥 사이에 창
WX0, WX1 = 2, 101
U0, U1 = E_Y + 3, 80
eave_shadow(c, WX0, U0, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, U0 + 4, WX1 - WX0 + 1, U1 - U0 - 3, ox=2, oy=4)
plaster_more(c, WX0, U0 + 4, WX1, U1, ox=6)
POSTS = [2, 22, 42, 62, 82, 99]
beam(c, WX0, WX1, U0 + 3, h=1)
for px in POSTS:
    post(c, px, U0 + 3, U1)
cwin(c, 10, U0 + 7, w=7, h=12, frame='wood', glint=0)
cwin(c, 29, U0 + 7, w=8, h=12, frame='wood', glint=2, box=True, curtain=True)
cwin(c, 69, U0 + 7, w=8, h=12, frame='wood', glint=1, transom=True, sill=2)
cwin(c, 89, U0 + 8, w=6, h=10, frame='wood', lit=True)
# 가운데 칸: 기둥 밑에서 위 보로 이어지는 가새 하나 + 둥근 환기창(통 바닥 모양)
brace(c, 45, U1 - 1, 56, U0 + 5)
c.rows(50, U0 + 6, ['.ζηζ.', 'ζθεθβ', 'ηεXεβ', 'ζθεθβ', '.δ_δ.'])
# 층 사이 보
for x in range(WX0, WX1 + 1):
    c.put(x, 81, 'η' if x % 7 else 'ζ')
    c.put(x, 82, 'ε')
    c.put(x, 83, '-' if x % 5 else '_')

# ---------------------------------------------------------------- 본채 1층(잔 막돌) + 문 + 창 + 간판
L0 = 84
rubble(c, WX0, L0, WX1 - WX0 + 1, 109 - L0 + 1, start=1,
       shade=lambda x, y: (-1 if y < L0 + 3 else 0) + (1 if x < WX0 + 3 else 0) - (1 if x > WX1 - 3 else 0))
foundation(c, WX0, WX1, 110, step=(32, 48))
# 문(열 2: 32..47) — 돌 문틀 + 아치 판자문
DX, DW = 34, 12
for j in range(110 - 88):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, 88 + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, 87, 'r' if i < DW // 2 else 'm')
door(c, DX, 89, DW, 110 - 89)
cwin(c, 10, 91, w=8, h=11, glint=3, box=True)
cwin(c, 66, 90, w=9, h=12, glint=0, curtain=True)
cwin(c, 87, 91, w=7, h=10, glint=2, transom=True, sill=2)
# 걸린 간판: 벽에 박힌 쇠 받침대(가로 팔 + 사선 버팀) + 사슬 둘 + 테 두른 나무 판(노란 맥주잔, 글자 없음)
c.rows(48, 86, [
    'aXUUUUUUUUUUk',
    'aWa......X.X.',
    'a..W.....X.X.',
])
c.rows(52, 89, [
    'ζηηηηηηηηζ',
    'ηζεεεεεεζβ',
    'ηεrLLKεεεβ',
    'ηεLKKKkεεβ',
    'ηεKKKKεkεβ',
    'ηεKLKKkεεβ',
    'ηετττεεεεβ',
    'ηζεεεεεεζβ',
    'δ________δ',
])
# ---------------------------------------------------------------- 창고 앞(열린 칸 안 통 더미) — 땅선 y=111
G0 = S_EAVE + 3
for x in range(SX0 + 4, SX1 + 1):               # 처마 밑 그늘 + 안쪽 판자 뒷벽
    for y in range(G0, 110):
        if y < G0 + 3:
            ch = '-' if y == G0 else 'δ'
        else:
            k = (x - SX0) % 5
            ch = 'ζ' if k == 0 else ('ε' if k < 3 else 'δ')
            if (y - G0) % 11 == 6 and k:
                ch = 'γ'
        c.put(x, y, ch)
for px in (SX0 + 2, 120, SX1 - 2):              # 기둥 셋(위 도리에 닿는다)
    post(c, px, G0, 109, w=3)
beam(c, SX0 + 2, SX1, G0, h=1)
# 통 셋: 판자 바닥 위에 선다(위 타원 윗면이 보이고, 처마에 닿지 않는다)
for x in range(SX0 + 3, SX1):                     # 안쪽 판자 바닥(위에서 보이는 윗면 2줄)
    c.put(x, 107, 'ξ' if x % 6 else 'η')
    c.put(x, 108, 'η' if x % 6 else 'ε')
    c.put(x, 109, 'δ')
for x in range(SX0 + 4, 121):                     # 왼 칸 판자 시렁(양끝이 기둥에 걸린다): 윗면 2줄 + 앞판
    c.put(x, 93, 'ξ' if x % 5 else 'η')
    c.put(x, 94, 'η')
    c.put(x, 95, 'δ')
    darken(c, x, 96, 1)
barrel(c, 104, 84, w=8, h=9, lid='σ')              # 시렁 위 작은 통 둘(크기 다르게)
barrel(c, 113, 86, w=7, h=7)
barrel(c, 102, 96, w=12, h=12, lid='σ')
barrel(c, 128, 95, w=13, h=13)
barrel(c, 115, 99, w=10, h=9, lid='σ')
for x in range(SX0 + 2, SX1 + 1):
    c.put(x, 110, 'a' if x % 5 else 'Y')
    c.put(x, 111, 'X' if x % 6 else 'W')

# 풍화·이끼(지붕 그늘진 곳)
moss(c, [(6, 40, 2), (60, 38, 0), (110, 66, 2)])

outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

walk = []
for cy in range(7):
    r = ''
    for cx in range(9):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 2 and cy in (5, 6):
            r += 'D'
        else:
            r += '*' if cy < 3 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='양조장', massing='M32', material='plaster', refs=['bd-house-ware0', 'bd-house-smithy_town'],
            walk=walk)
f, w = c.save('brewery', meta)
print('FAIL', f, 'WARN', w)
