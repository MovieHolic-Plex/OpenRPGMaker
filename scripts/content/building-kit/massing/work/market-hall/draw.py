"""market-hall — 기둥 위 시장홀(덩어리 모형 M08). 8×6 칸(128×96). 다시 돌리면 같은 그림. 난수 없음.
1층: 나무 기둥 여섯(돌 초석) 사이 트인 장터 — 그늘진 속(천장 장선·뒷기둥·판석 바닥)에 좌판·상자·통·자루.
가운데 칸만 물러난 회벽 계단실 + 판자문(문 칸 하나). 2층: 반목조 홀(기둥 사이 창), 손 기와 모임지붕,
용마루 가운데 등탑(회벽 몸 + 루버) 위 버들항 청석 첨탑."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, plaster, eave_shadow, post, beam, brace, door  # noqa: E402
from slate import plaster_more  # noqa: E402
from bits import darken, outline, fill_pinholes, window  # noqa: E402
from hand import hip_roof, btiles, rubble, barrel  # noqa: E402
import pix  # noqa: E402
from pix import cone  # noqa: E402

from nh import cwin  # noqa: E402

W, H = 128, 96
c = Canvas(8, 6)
GY = H - 1

# ---------------------------------------------------------------- 지붕 + 등탑(청석 첨탑)
R_Y, E_Y = 15, 42
hip_roof(c, 0, W - 1, R_Y, E_Y, 34, 93, seed=4)
CX = 64.0
# 등탑 몸: 회벽 + 모서리 기둥 + 가운데 루버 창(살 사이 어둠). 밑은 앞 사면 위에 앉아 그늘을 드리운다.
LX0, LX1, LT, LB = 57, 70, 16, 26
for y in range(LT, LB + 1):
    for x in range(LX0, LX1 + 1):
        ch = '3' if (x * 3 + y) % 7 else 'z'
        if x >= LX1 - 3:
            ch = 'y' if (x + y) % 4 else 'x'
        if x == LX0 + 3 and y % 3 == 0:
            ch = '5'
        c.put(x, y, ch)
post(c, LX0, LT, LB, w=2)
post(c, LX1 - 1, LT, LB, w=2)
for x in range(LX0, LX1 + 1):                    # 몸 위 테 보
    c.put(x, LT, 'η' if x < 66 else 'ε')
    c.put(x, LT + 1, '-')
c.rows(61, LT + 2, ['ζηηηηζ', 'ηT__Tβ', 'ηεεεεβ', 'ηT__Tβ', 'ηεεεεβ', 'ηT__Tβ', 'δ____δ'])   # 루버
for x in range(LX0 - 1, LX1 + 2):                # 밑 마룻 이음 + 지붕 위 그늘
    c.put(x, LB + 1, 'ε' if x < 64 else 'β')
    darken(c, x, LB + 2, 2)
    darken(c, x, LB + 3, 1)
    if LX0 + 2 < x < LX1 + 2:
        darken(c, x, LB + 4, 1)
# 첨탑: 버들항 청석 원뿔(비늘이 꼭대기로 좁아진다) — 처마가 몸 위로 두 화소 내민다
cone(c, CX, 2, 15, 9.5, 2, seed=2)
for x in range(int(CX - 10), int(CX + 11)):       # 첨탑 처마 끝: 어두운 청석 테
    for y in range(14, 20):
        if c.get(x, y) in 'CBEFGH' and c.get(x, y + 1) not in 'CBEFGH':
            c.put(x, y, 'E' if x < CX else 'C')
            break
c.rows(63, 0, ['LK', 'Kτ'])               # 금빛 꼭지(첨탑 꼭짓점에 닿는다)

# ---------------------------------------------------------------- 2층 반목조 홀(기둥 사이 창) — 앞으로 내민 보 위
WX0, WX1 = 2, W - 3
U0, U1 = E_Y + 3, 61
eave_shadow(c, WX0, U0, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, U0 + 4, WX1 - WX0 + 1, U1 - U0 - 3, ox=3, oy=2)
plaster_more(c, WX0, U0 + 4, WX1, U1, ox=1)
beam(c, WX0, WX1, U0 + 3, h=1)
POSTS = [2, 31, 63, 95, 123]
for px in POSTS:
    post(c, px, U0 + 3, U1)
cwin(c, 10, U0 + 4, w=8, h=10, frame='wood', glint=0)
cwin(c, 41, U0 + 4, w=9, h=10, frame='wood', glint=2, box=True, curtain=True)
cwin(c, 73, U0 + 4, w=9, h=10, frame='wood', lit=True)
cwin(c, 105, U0 + 5, w=7, h=9, frame='wood', glint=1, transom=True, sill=2)
# 내민 바닥보(장선 끝이 보인다) + 받침 까치발
for x in range(0, W):
    c.put(x, 62, 'η' if x % 6 else 'ζ')
    c.put(x, 63, 'ε' if x % 6 else 'θ')
    c.put(x, 64, 'β')
    c.put(x, 65, '_' if x % 3 else '-')

# ---------------------------------------------------------------- 1층: 기둥 위 트인 장터
G0 = 66
POSTS_G = [(0, 4), (24, 28), (47, 51), (76, 80), (99, 103), (123, 127)]
BAYS = [(5, 23), (29, 46), (52, 75), (81, 98), (104, 122)]
FLOOR = 80


def shade_px(x, y, bi):
    """그늘진 속: 천장 장선 → 뒤 어둠(뒷기둥·건너편 풀빛) → 판석 바닥(앞으로 밝아진다)."""
    bx0, bx1 = BAYS[bi]
    if y <= 68:                                   # 천장 장선 밑면
        if (x + 2) % 7 == 0:
            return ('a', 'Y', 'X')[y - 66]
        return ('X', 'W', 'U')[y - 66]
    if y < FLOOR:
        mid = (bx0 + bx1) // 2
        if x in (mid, mid + 1) and y < FLOOR - 1:  # 뒷줄 기둥(그늘 속 나무)
            return '-' if x == mid else '_'
        if 72 <= y <= 77 and abs(x - mid) > 2:     # 건너편 트인 곳 — 흐린 풀빛
            if y in (72, 77):
                return 'V'
            return 'M' if (x + y * 2) % 7 else 'N'
        return 'U' if y < 71 else ('V' if (x + y) % 6 else 'U')
    # 판석: 뒤 어둡고 앞 밝다, 줄눈 엇갈림
    d = y - FLOOR
    ramp = ('W', 'X', 'Y', 'a', 'a', 'e', 'e', 'e', 'i', 'i', 'i', 'j', 'j', 'k', 'k', 'j')
    ch = ramp[min(d, len(ramp) - 1)]
    row = d // 4
    if d % 4 == 3 or (x + row * 5) % 9 == 0:
        ch = DKS.get(ch, ch)
    return ch


DKS = {'W': 'V', 'X': 'W', 'Y': 'X', 'a': 'Y', 'e': 'a', 'i': 'e', 'j': 'i', 'k': 'i'}

for bi, (bx0, bx1) in enumerate(BAYS):
    for y in range(G0, GY + 1):
        for x in range(bx0, bx1 + 1):
            c.put(x, y, shade_px(x, y, bi))
# 앞 끝 디딤돌 줄(땅에 닿는 기단: 밝은 윗모 + 어두운 앞면)
for x in range(W):
    c.put(x, GY - 1, 'k' if x % 9 else 'i')
    c.put(x, GY, 'a' if x % 6 else 'Y')

# 가운데 칸: 물러난 회벽 계단실 + 판자문
SX0, SX1 = 52, 75
for y in range(69, 92):
    for x in range(SX0, SX1 + 1):
        ch = 'w' if (x * 5 + y * 3) % 11 else 'v'
        if y < 72:
            ch = 'u' if (x + y) % 5 else 't'      # 천장 밑 그늘
        if x <= SX0 + 1:
            ch = 'u'
        c.put(x, y, ch)
for x in range(SX0, SX1 + 1):                     # 계단실 위 보 · 밑 문지방 돌
    c.put(x, 69, 'ε')
    c.put(x, 70, '-')
    c.put(x, 91, 'e' if x % 4 else 'a')
for y in range(69, 92):                           # 계단실 모서리 기둥
    c.put(SX0, y, 'ζ')
    c.put(SX0 + 1, y, 'β')
DOOR_X = 65
door(c, DOOR_X, 71, 10, 20)
for y in range(71, 91):                           # 문틀(왼 밝고 오른 그늘)
    c.put(DOOR_X - 1, y, 'η')
    c.put(DOOR_X + 10, y, 'β')
c.rows(56, 73, ['.ττ.', '.KL.', 'ηLKβ', 'ηKLβ', '.ττ.'])   # 벽 등잔
c.rows(55, 80, ['ζηηηηζ', 'η3345β', 'η2433β', 'η3324β', 'η2233β', 'δ____δ'])   # 빈 고지판(글 없음)

# 나무 기둥(돌 초석) + 까치발
for (px0, px1) in POSTS_G:
    for y in range(G0, GY - 3):
        for x in range(px0, px1 + 1):
            i = x - px0
            ch = ('η', 'θ', 'ε', 'ε', 'β')[i]
            if i == 2 and (y * 3 + px0) % 8 == 0:
                ch = 'ζ'
            if i == 3 and (y + px0) % 6 == 0:
                ch = 'δ'
            c.put(x, y, ch)
    c.rows(px0 - 1, GY - 4, ['n' + 'm' * (px1 - px0 + 1) + 'j', 'k' + 'j' * (px1 - px0 + 1) + 'e',
                             'j' + 'i' * (px1 - px0 + 1) + 'a'])
    for k in range(4):                            # 까치발: 기둥에서 바닥보로
        for x, lit in ((px0 - 1 - k, True), (px1 + 1 + k, False)):
            y = G0 + 3 - k
            if 0 <= x < W:
                c.put(x, y, 'η' if lit else 'ε')
                c.put(x, y + 1, 'ε' if lit else 'β')

# 칸 1: 사과·양배추 상자 둘(윗면) + 바구니
def crate(x, y, w, h, goods):
    """나무 상자: 위 3줄은 윗면(물건이 담긴 속), 앞판 널."""
    for i in range(w):
        c.put(x + i, y, 'ζ' if 0 < i < w - 1 else 'δ')
        for j in (1, 2):
            g = goods[(i + j * 2) % len(goods)]
            c.put(x + i, y + j, g if 0 < i < w - 1 else ('η' if i == 0 else 'β'))
        for j in range(3, h):
            ch = 'θ' if i < w // 2 else 'η'
            if i in (0, w - 1):
                ch = 'ε'
            if j in (3, h - 1):
                ch = 'ε' if j == 3 else 'δ'
            if (i + 1) % 4 == 0 and j not in (3, h - 1):
                ch = 'ζ'
            c.put(x + i, y + j, ch)


crate(7, 82, 9, 10, '8κ8&κ')
crate(15, 84, 8, 8, 'NOPNM')
c.rows(8, 77, ['.ζσσζ.', 'ζκ8κ8β', 'ηξξξξβ', '.δδδδ.'])   # 위에 얹은 바구니(사과)
# 칸 2: 덮개 없는 좌판(판 윗면 + 앞판) 위 치즈·빵·천 두루마리
for x in range(31, 46):
    for j, y in enumerate(range(81, 84)):
        c.put(x, y, ('ε', 'ξ', 'σ')[j] if (x - 31) % 7 else ('δ', 'η', 'ξ')[j])
    c.put(x, 84, 'ζ')
    for y in range(85, 92):
        c.put(x, y, 'δ' if (x - 31) % 5 == 0 else ('ε' if y % 3 else 'ζ'))
for x in (31, 45):
    for y in range(84, 93):
        c.put(x, y, 'η' if x == 31 else 'β')
c.rows(32, 78, ['.KK..σσ..GGE.', 'KLKτ.σLσ.HGGE', 'τKτ..ηση.EEEB'])   # 치즈 바퀴·빵·천 두루마리
# 칸 4: 통 둘(타원 윗면)
barrel(c, 82, 80, w=8, h=12)
barrel(c, 89, 79, w=9, h=13)
# 칸 5: 자루 셋(묶은 윗머리) + 생선 상자
c.rows(105, 79, ['..yz....', '.z22y...', 'z23yx.yz', 'y2yxwz22', 'yxxww23y', 'wwwuuyxx', '.uuuuxww', '....wwwu'])
for (sx, sy) in ((105, 79),):
    pass
crate(113, 83, 9, 9, 'jmkrj')
c.rows(106, 87, ['zy2yx', 'y22xw', 'xyxww', 'wwwuu'])

moss(c, [(4, 34, 2), (118, 30, 0), (40, 38, 2)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

DOOR_COL = DOOR_X // 16
walk = []
for cy in range(6):
    r = ''
    for cx in range(8):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cy == 5 and cx == DOOR_COL:
            r += 'D'
        elif cy >= 4:
            r += 'X'
        else:
            r += '*'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='기둥 위 시장홀', massing='M08', material='plaster', refs=['bd-house-inn', 'bd-house-cathedral'], walk=walk)
f, w = c.save('market-hall', meta)
print('FAIL', f, 'WARN', w)
