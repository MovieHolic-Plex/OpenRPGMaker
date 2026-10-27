"""bakery — 빵집(덩어리 모형 M33). 6×5 칸(96×80). 난수 없음.
1층 회벽 빵집(손 기와 모임지붕, 촘촘한 회벽 점결, 진열창에 빵) + 쇠 받침대에 걸린 빵 간판
+ 왼쪽에 붙은 둥근 흙 화덕(벽돌 고리 결, 빛나는 아궁이, 막돌 받침, 뒤쪽 작은 굴뚝) + 장작더미(나무 끝 단면)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, plaster, eave_shadow, post, beam, door  # noqa: E402
from gf import foundation  # noqa: E402
from slate import plaster_more  # noqa: E402
from bits import darken, outline, fill_pinholes, window  # noqa: E402
from hand import hip_roof, rubble, chimney  # noqa: E402

W, H = 96, 80
c = Canvas(6, 5)
GY = H - 1

# ---------------------------------------------------------------- 본채 지붕(손 기와 모임)
R_Y, E_Y = 9, 40
MX0, MX1 = 22, 95
hip_roof(c, MX0, MX1, R_Y, E_Y, 44, 74, seed=6)

# ---------------------------------------------------------------- 회벽 + 모서리 기둥 + 문 + 진열창
WX0, WX1 = 24, 93
U0 = E_Y + 3
eave_shadow(c, WX0, U0, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, U0 + 4, WX1 - WX0 + 1, GY - 2 - U0 - 3, ox=3, oy=1)
plaster_more(c, WX0, U0 + 4, WX1, GY - 2, ox=5, oy=2)
plaster_more(c, WX0, U0 + 4, WX1, GY - 2, ox=11, oy=5)
plaster_more(c, WX0, U0 + 4, WX1, GY - 2, ox=17, oy=9)
for y in range(U0 + 4, GY - 2):                  # 촘촘한 회벽 점결(손 규칙 — 잡음 아님): 밝고 어두운 점 섞기
    for x in range(WX0, WX1 + 1):
        if c.get(x, y) != '3':
            continue
        k = (x * 5 + y * 3 + (y // 3) * 7) % 11
        ch = {0: 'z', 3: '5', 6: '0', 8: '5'}.get(k)
        if (x * 7 + y * 11) % 37 == 0:
            ch = 'y'
        elif (x * 3 + y * 13) % 29 == 0:
            ch = 'y'
        if ch:
            c.put(x, y, ch)
for px in (WX0, WX1 - 2):
    post(c, px, U0 + 3, GY - 2)
beam(c, WX0, WX1, U0 + 3, h=1)
for x in range(WX0, WX1 + 1):                    # 벽 밑 그늘(흙 튄 자국)
    darken(c, x, GY - 3, 1)
foundation(c, WX0, WX1, GY - 1, step=(48, 63))
# 문(열 3: 48..63) — 돌 문틀 + 아치 판자문
DX, DW, DY = 50, 12, 56
for j in range(GY - 1 - DY):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, DY + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, DY - 1, 'r' if i < DW // 2 else 'm')
door(c, DX, DY, DW, GY - 1 - DY)
# 진열창(넓은 나무 틀 + 밑 선반에 빵: 둥근 빵·긴 빵·꽈배기)
SX, SY, SW, SH = 70, 52, 19, 15
for y in range(SY, SY + SH):
    for x in range(SX, SX + SW):
        edge = x in (SX, SX + SW - 1) or y in (SY, SY + SH - 1)
        if edge:
            ch = 'η' if (x == SX or y == SY) else 'δ'
        elif x == SX + SW // 2:
            ch = 'ε'
        elif y < SY + 4:
            ch = 'b' if (x + y) % 7 else 'e'           # 유리에 비친 하늘(회청)
        else:
            ch = 'X' if (x + y) % 5 else 'a'           # 가게 안 그늘
        c.put(x, y, ch)
for x in range(SX + 1, SX + SW - 1):                    # 유리 윗줄 반사 사선
    pass
c.put(SX + 2, SY + 1, 'i'); c.put(SX + 3, SY + 2, 'i'); c.put(SX + 12, SY + 1, 'i'); c.put(SX + 13, SY + 2, 'h')
c.rows(SX + 1, SY + 7, [                                 # 진열 빵(윗면 밝게, 아래 굽은 갈색)
    '.ρσρ..ξ...LσL.ρσ.',
    'πσLσπ.ρξ.σπ.πσLσπ',
    'ρπσπμ.πρξ.σL..πρπμ'[:17],
    'μρπρη.ημρ.ρπρ.ημη',
    '.ημη...ηη..ημ..η.',
])
for x in range(SX - 1, SX + SW + 1):                    # 창턱 판(앞으로 내민 윗면 + 그늘)
    c.put(x, SY + SH, 'ξ' if x < SX + SW - 2 else 'η')
    c.put(x, SY + SH + 1, 'ζ')
    c.put(x, SY + SH + 2, 'δ')
    darken(c, x, SY + SH + 3, 1)
# 작은 창(문 왼쪽): 반쯤 연 덧문
window(c, 38, 54, w=7, h=10, kind='half', sky=1, frame='wood')

# 걸린 간판: 쇠 받침대(가로 팔 + 사선 버팀) + 사슬 둘 + 빵 모양 판(밀가루 묻은 둥근 빵)
c.rows(63, 46, [
    'aXUUUUUUUk',
    'aWa...X..X',
    'a..W..X..X',
])
c.rows(66, 49, [
    '..ζηηηζ..',
    '.ηξσσσξη.',
    'ηξσLσLσξβ',
    'ηπσσLσσπβ',
    'ημπσπσπμβ',
    '.ημππμμβ.',
    '..δδδδβ..',
])

# ---------------------------------------------------------------- 화덕(왼쪽, 본채 왼 벽에 붙는다)
OCX, OBASE, ORX, OH = 16.5, 70, 17.0, 22     # 돔 중심 x, 돔 밑(받침 위), 반폭, 높이
CLAY = ['-', 'α', 'δ', 'ε', 'ζ', 'η', 'θ', 'μ', 'ξ', 'σ']
# 받침: 막돌 낮은 담(돔보다 조금 넓다), 위 갓돌 줄
rubble(c, 0, OBASE, 35, GY - OBASE + 1, start=2,
       shade=lambda x, y: (-1 if y < OBASE + 2 else 0) - (1 if x > 30 else 0))
for x in range(0, 35):
    c.put(x, OBASE, 'r' if x < 24 else 'm')
    c.put(x, OBASE + 1, 'k' if x % 6 else 'e')
# 돔: 반구, 빛 왼쪽 위. 벽돌 고리(위도)와 세로 줄눈(경도), 줄마다 엇갈림
L = (-0.55, 0.62, 0.56)
ln = math.sqrt(sum(v * v for v in L))
L = tuple(v / ln for v in L)
for y in range(OBASE - OH - 1, OBASE + 1):
    for x in range(0, 36):
        nx = (x + 0.5 - OCX) / ORX
        ny = (OBASE + 0.5 - y) / OH
        q = nx * nx + ny * ny
        if q > 1 or y > OBASE:
            continue
        nz = math.sqrt(max(0.0, 1 - q))
        lit = nx * L[0] + ny * L[1] + nz * L[2]
        t = 2 + lit * 7.2
        lat = math.asin(min(1.0, ny)) * OH          # 위도 호 길이(px)
        ring = int(lat // 3.6)
        lv = lat - ring * 3.6
        lon = math.atan2(nx, nz) * ORX * max(0.25, math.cos(math.asin(min(1.0, ny))))
        joint = (lon + (2.5 if ring % 2 else 0)) % 6.0
        if lv < 0.9:
            t -= 2                                  # 고리 줄눈
        elif joint < 0.9:
            t -= 1.5                                # 세로 줄눈
        elif lv > 2.6:
            t += 0.6                                # 벽돌 윗모서리 밝음
        if (ring * 5 + int((lon + 40) // 6)) % 7 == 3:
            t -= 0.8                                # 그을린 벽돌
        if q > 0.86:
            t -= 1                                  # 가장자리 어둡게
        c.put(x, y, CLAY[max(0, min(len(CLAY) - 1, int(round(t))))])
# 아궁이: 뾰족 아닌 반원 홍예 + 벽돌 테 + 안쪽 불빛
MX, MW, MY = 11, 12, 56
for y in range(MY, OBASE + 1):
    for x in range(MX - 2, MX + MW + 2):
        dx = x + 0.5 - (MX + MW / 2)
        j = y - MY
        r_out = MW / 2 + 2
        top_out = MY + r_out - math.sqrt(max(0, r_out * r_out - dx * dx)) * 0.9 - 2
        if y < top_out or abs(dx) > r_out:
            continue
        r_in = MW / 2
        top_in = MY + r_out - math.sqrt(max(0, r_in * r_in - dx * dx)) * 0.9
        if abs(dx) >= r_in or y < top_in:
            ch = ('σ' if dx < 0 else 'η') if (int(dx + 20) % 3) else ('ξ' if dx < 0 else 'ε')
            if y >= OBASE - 1:
                ch = 'ζ'
        else:
            d = (y - top_in) / max(1, OBASE - top_in)
            if abs(dx) > r_in - 1.5 or y < top_in + 1.5:
                ch = 'U'
            elif d < 0.35:
                ch = '$' if abs(dx) > 2 else '?'
            elif d < 0.7:
                ch = '<' if abs(dx) > 3 else ('K' if abs(dx) < 1.5 else 'ρ')
            else:
                ch = ('K' if (x % 3) else 'L') if abs(dx) < 3.5 else ('π' if x % 2 else '<')
        c.put(x, y, ch)
for x in range(MX - 1, MX + MW + 1):              # 아궁이 앞 돌판(윗면)
    c.put(x, OBASE + 1, 'r' if x < MX + 6 else 'm')
    c.put(x, OBASE + 2, 'k')
    c.put(x, OBASE + 3, 'e')
for (x, y) in ((MX + 2, MY - 3), (MX + 5, MY - 4), (MX + 9, MY - 3)):   # 아궁이 위 그을음
    darken(c, x, y, 1)
    darken(c, x + 1, y - 1, 1)
# 작은 굴뚝: 돔 뒤 오른쪽 사면에 선다(갓돌 위에서 본 연기 구멍, 밑동은 돔 곡면을 따라 비스듬)
chimney(c, 20, 41, 50, 52, cw=7)
for (x, y) in ((23, 39), (24, 37), (23, 35)):     # 엷은 연기 두어 점(회백)
    c.put(x, y, 'm' if y != 35 else 'k')
    c.put(x + 1, y, 'k')

# 장작더미(아궁이 왼쪽 앞): 통나무 끝 단면(밝은 나이테 + 껍질 테)이 앞을 본다, 위는 껍질 윗면
LOG = ['.ηη.', 'ησξβ', 'ηξμβ', '.δδ.']
for (lx, ly) in ((0, 74), (4, 74), (8, 74), (2, 71), (6, 71), (4, 68)):
    c.rows(lx, ly, LOG)
for x in range(0, 12):                           # 더미 밑 그늘
    darken(c, x, 78, 1)

moss(c, [(30, 74, 1), (88, 74, 0)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
walk = []
for cy in range(5):
    r = ''
    for cx in range(6):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 3 and cy in (3, 4):
            r += 'D'
        else:
            r += '*' if cy < 2 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='빵집', massing='M33', material='plaster', refs=['bd-house-h106_1', 'bd-house-cafe'], walk=walk)
f, w = c.save('bakery', meta)
print('FAIL', f, 'WARN', w)
