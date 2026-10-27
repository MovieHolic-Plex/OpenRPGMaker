"""inn — 여관(덩어리 모형 11). 막돌 1층 + 반목조 2층 본채(굴뚝 둘, 걸린 간판) + 오른쪽 마구간 외쪽지붕(판자벽, 열린 칸).
10×7 칸(160×112). 문은 본채 하나."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (Canvas, chimney, moss, wing_roof, walk_from, roof, ROOF_BANDS, plaster, eave_shadow, post, beam, brace, window, door,  # noqa: F401
                    rubble)

W, H = 160, 112
c = Canvas(10, 7)

MX1 = 111            # 본채 오른끝
RIDGE_Y = 8
EAVE_Y = 45          # 마지막 기와 줄, 그 아래 처마끝 2줄(46·47)


# ---------------------------------------------------------------- 본채 지붕(모임지붕 — 버들항 여관처럼)
# 모임 선은 용마루 끝 → 처마 모서리. 바깥 윤곽은 더 가파르게 떨어져 KNEE 에서 처마 모서리 세로선에 닿는다.
from common import hip_side, HIP_LIT, HIP_DARK  # noqa: E402
RL, RR = 30, MX1 - 30
KNEE = RIDGE_Y + int((EAVE_Y - RIDGE_Y) * 0.72)


def lx(y):
    return RL - (y - RIDGE_Y) * (RL - 1) / (EAVE_Y - RIDGE_Y)


def rx(y):
    return RR + (y - RIDGE_Y) * (MX1 - 1 - RR) / (EAVE_Y - RIDGE_Y)


def OUT_L(y):
    return max(0.0, (RL - 3) - (y - RIDGE_Y) * (RL - 3) / (KNEE - RIDGE_Y))


def OUT_R(y):
    return min(float(MX1), (RR + 3) + (y - RIDGE_Y) * (MX1 - RR - 3) / (KNEE - RIDGE_Y))


roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, 0, MX1, RIDGE_Y + 2, EAVE_Y, vshift=5)
hip_side(c, lambda x, y: OUT_L(y) - 0.5 <= x <= lx(y) + 1, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_LIT)
hip_side(c, lambda x, y: rx(y) - 1 <= x <= OUT_R(y) + 0.5, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_DARK, hshift=2)
# 모임 선: 왼쪽 밝은 마룻기와, 오른쪽 짙은 선
for y in range(RIDGE_Y + 1, EAVE_Y + 1):
    x = int(round(lx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    if x - 1 >= 0:
        c.put(x - 1, y, 'σ' if (y % 3) else 'L')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    if xr + 1 <= MX1:
        c.put(xr + 1, y, 'θ' if (y % 3) else '%')
# 바깥 윤곽(재질 어두운 단)
for y in range(RIDGE_Y + 1, EAVE_Y + 2):
    xo = int(round(OUT_L(y)))
    c.put(xo, y, '-' if y % 2 else 'α')
    xo = int(round(OUT_R(y)))
    c.put(xo, y, '-' if y % 3 else '9')
# 용마루 덮개
for x in range(RL - 3, RR + 4):
    c.put(x, RIDGE_Y, 'ζ' if x in (RL - 3, RR + 3) else ('L' if x % 4 == 1 else ('σ' if x % 4 else 'ξ')))
    c.put(x, RIDGE_Y + 1, '-' if x % 4 else 'α')
# 처마끝
for x in range(0, MX1 + 1):
    c.put(x, EAVE_Y + 1, '&' if x % 4 else '9')
    c.put(x, EAVE_Y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(0, EAVE_Y + 1, 'α')
c.put(0, EAVE_Y + 2, '-')
c.put(MX1, EAVE_Y + 1, '9')
c.put(MX1, EAVE_Y + 2, '-')

# 굴뚝 둘 — 용마루 바로 아래 앞 사면에서 솟는다
chimney(c, 35, 0, 17, cw=8, start=0, slope=1)
chimney(c, 63, 2, 16, cw=7, start=5, slope=-1)

# ---------------------------------------------------------------- 2층 반목조
WX0, WX1 = 1, MX1
UY0 = EAVE_Y + 3            # 48
eave_shadow(c, WX0, UY0, WX1 - WX0 + 1)
UY1 = 78                    # 2층 아래끝(하인방 위)
plaster(c, WX0, UY0 + 5, WX1 - WX0 + 1, UY1 - UY0 - 4, ox=3, oy=2)
POSTS = [1, 27, 51, 75, 99, 109]
for px in POSTS:
    post(c, px, UY0 + 2, UY1)
beam(c, WX0, WX1, UY0 + 4)
WINS = [11, 36, 60, 84]
# 창 아래 띠장
for x0, x1 in [(4, 26), (30, 50), (54, 74), (78, 98), (102, 107)]:
    for x in range(x0, x1 + 1):
        c.put(x, 73, 'ε')
        c.put(x, 74, '-')
# 창 없는 끝 칸 가새
for n, wx in enumerate(WINS):   # 창마다 다르게: 꽃·커튼·반짝·창턱, 둘째는 덧창, 넷째는 꽃상자 없이
    window(c, wx, 56 + (1 if n == 2 else 0), w=11, h=12 - (1 if n == 2 else 0), box=(n != 3), shutters=(n == 1), look=n)
for (x, y) in [(5, 64), (22, 58), (46, 69), (70, 60), (94, 66), (31, 77), (104, 77)]:
    c.put(x, y, 'z')

# 내민 보(층 사이) + 장선 머리
for x in range(WX0, WX1 + 1):
    c.put(x, 79, 'η' if x % 7 else 'ζ')
    c.put(x, 80, 'ε')
    c.put(x, 81, 'β')
    c.put(x, 82, '_' if x % 6 else '-')
for x in range(4, WX1 - 2, 8):
    c.put(x, 81, 'δ')
    c.put(x + 1, 81, 'δ')
    c.put(x, 82, 'ζ')
    c.put(x + 1, 82, '-')

# ---------------------------------------------------------------- 1층 막돌
GY0 = 83
DOOR_X, DOOR_W = 34, 13
DOOR_Y = 86
rubble(c, WX0, GY0, WX1 - WX0 + 1, H - 2 - GY0, [3, 2, 3, 3, 2, 4, 3, 2, 3], start=3)
# 문 둘레 아치 돌(쐐기돌)
for i, (dx, dy) in enumerate([(-2, 4), (-2, 2), (-1, 0), (1, -2), (4, -3), (6, -3), (8, -3), (11, -2), (13, 0),
                              (14, 2), (14, 4)]):
    x, y = DOOR_X + dx, DOOR_Y + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, 'p' if (j == 0 and k == 0) else ('h' if j == 0 else 'e'))
for y in range(DOOR_Y + 6, H - 2):
    c.put(DOOR_X - 2, y, 'h' if y % 4 else 'e')
    c.put(DOOR_X - 1, y, 'e')
    c.put(DOOR_X + DOOR_W, y, 'd')
    c.put(DOOR_X + DOOR_W + 1, y, 'e' if y % 4 else 'X')
door(c, DOOR_X, DOOR_Y, DOOR_W, H - DOOR_Y - 1)
# 1층 창 둘(돌 창틀)
for wx in (66, 88):
    for y in range(87, 103):
        for x in range(wx - 2, wx + 13):
            c.put(x, y, 'h' if (x == wx - 2 or y == 87) else 'e')
    window(c, wx, 88, w=11, h=12, box=(wx == 66), look=4 if wx == 66 else 5)
# 벽 등불(문 왼쪽)
for (x, y, ch) in [(27, 88, 'U'), (28, 88, 'U'), (28, 89, 'X'), (27, 90, 'X'), (28, 90, 'Y'), (29, 90, 'X'),
                   (27, 91, 'K'), (28, 91, 'L'), (29, 91, 'K'), (27, 92, 'K'), (28, 92, 'K'), (29, 92, 'τ'),
                   (27, 93, 'X'), (28, 93, 'U'), (29, 93, 'X')]:
    c.put(x, y, ch)
# 걸린 간판(글자 없음 — 술잔 그림): 쇠 팔 + 사슬 + 널
for x in range(49, 63):
    c.put(x, 84, 'U' if x % 3 else 'X')
c.put(49, 85, 'X')
c.put(50, 85, 'U')
for (x, y) in [(52, 85), (52, 86), (60, 85), (60, 86)]:
    c.put(x, y, 'e')
SX, SY = 50, 87
for j in range(11):
    for i in range(13):
        ch = 'δ'
        if i in (0, 12) or j in (0, 10):
            ch = '-' if (i == 12 or j == 10) else 'η'
        elif j == 9 or i == 1:
            ch = 'ε'
        c.put(SX + i, SY + j, ch)
MUG = [  # 거품 넘치는 술잔(글자 없음) — 무두질한 나무판에 쇠·놋쇠 빛만
    '..pjp....',
    '.jpjjp...',
    '.σξσσξ...',
    '.ξσξξξδδ.',
    '.σξξξξ.δ.',
    '.ξξξξξ.δ.',
    '.ξξξξξδδ.',
    '.δδδδδ...',
]
for j, row in enumerate(MUG):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(SX + 2 + i, SY + 1 + j, ch)

# 기초
for x in range(WX0, WX1 + 1):
    c.put(x, H - 2, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, H - 1, 'U' if x % 6 else 'T')
for x in range(DOOR_X - 1, DOOR_X + DOOR_W + 1):
    c.put(x, H - 2, 'r' if x % 4 else 'm')
    c.put(x, H - 1, 'Z')

# ---------------------------------------------------------------- 마구간(외쪽지붕, 본채 동쪽에 붙음)
SX0, SX1 = MX1 + 1, W - 1
SEAVE = 76
# 남쪽으로 내려가는 외쪽 지붕: 위 용마루가 본채 처마 바로 밑에 가로로 붙고, 오른쪽 끝은 모임 사선으로 닫는다
wing_roof(c, SX0, SX1, 48, SEAVE, run=20, bands=ROOF_BANDS[1:], vshift=4)
# 판자벽 + 열린 칸
BY0 = SEAVE + 3   # 79
for y in range(BY0, H - 2):
    for x in range(SX0, SX1 + 1):
        r = (y - BY0) % 4
        ch = 'ε' if r < 2 else ('δ' if r == 2 else '-')
        if r == 0 and (x + y) % 9 == 0:
            ch = 'η'
        c.put(x, y, ch)
for px in (SX0, 134, SX1 - 2):
    post(c, px, BY0, H - 3)
for x in range(SX0, SX1 + 1):
    c.put(x, BY0, '-')
    c.put(x, BY0 + 1, 'ε')
    c.put(x, BY0 + 2, 'β')
# 열린 칸 — 안쪽: 위는 처마 그늘, 뒷벽 세로 널(빛이 아래 앞쪽에서 든다), 건초 시렁·마구·쇠스랑, 바닥 짚
BACK = ['|', '|', ':', ':', ',', ':', ',', ',', '_', ',', '_', '_', '-', '_', '-', '-', 'α', '-', 'α', 'α']  # 위 → 아래 밝아짐


def bay(bx0, bx1, kind):
    for y in range(BY0 + 3, H - 2):
        yy = y - (BY0 + 3)
        base = BACK[min(yy, len(BACK) - 1)]
        for x in range(bx0, bx1 + 1):
            u = (x - bx0) % 5
            ch = base
            if u == 4:                       # 널 이음 틈
                ch = '|' if yy < 8 else ':'
            elif u == 0 and yy >= 4:         # 널 왼쪽 가장자리에 빛
                ch = {',': ':', ':': ',', '_': ',', '-': '_', 'α': '-'}.get(base, base)
            if x == bx0:
                ch = '_'
            if x == bx0 + 1 and yy > 2:      # 기둥이 안쪽에 드리운 그늘
                ch = '|' if yy < 10 else ':'
            c.put(x, y, ch)
    if kind == 0:
        # 건초 더미(반벽 위로 넘친다) + 뒷벽에 기댄 쇠스랑 + 못에 걸린 마구
        hay = ['......σL......', '....σρσσLσ....', '..σρσKσρσσLσ..', '.ρσKσρσσKσρσσ.', 'σρσσKρσσρσKσσρ',
               'ησρσσηρσσσρσησ']
        for j, row in enumerate(hay):
            for i, ch in enumerate(row):
                if ch != '.':
                    c.put(bx0 + 2 + i, 92 + j, ch)
        # 뒷벽 나무 못걸이에 얹은 안장(1배에서 갈색 둥근 덩이로 읽힌다)
        for x in range(bx0 + 2, bx1 - 1):
            c.put(x, BY0 + 6, 'η')
            c.put(x, BY0 + 7, 'β')
        SADDLE = ['...ηξξη...', '.ηξσσξξη..', 'ηξξξξξξεβ.', 'εεβεεεεββ-', '.-.....-..']
        for j, row in enumerate(SADDLE):
            for i, ch in enumerate(row):
                if ch != '.':
                    c.put(bx0 + 5 + i, BY0 + 3 + j, ch)
    else:
        # 건초 시렁(사선 살, 뒷벽에 박힘) + 벽 여물통
        for x in range(bx0 + 2, bx1 - 1):
            c.put(x, BY0 + 4, 'η')
            c.put(x, BY0 + 10, 'ε')
        for k in range(bx0 + 2, bx1 - 2, 3):
            for t in range(5):
                c.put(k + t // 2, BY0 + 5 + t, 'ε' if t % 2 else 'δ')
        for i, x in enumerate(range(bx0 + 3, bx1 - 2)):
            if i % 3 != 1:
                c.put(x, BY0 + 3, 'σ' if i % 2 else 'ξ')
        trough = ['ηηηηηηηηηηηη', 'ζξσξξσξσξσξζ', 'ζεεεεεεεεεεζ', 'ζδεδεδεδεδδζ']
        for j, row in enumerate(trough):
            for i, ch in enumerate(row):
                c.put(bx0 + 3 + i, 92 + j, ch)
    # 앞 반벽(널) + 위 난간 — 열린 칸 아래를 막아 빈 어둠이 아니게
    for y in range(97, H - 2):
        for x in range(bx0, bx1 + 1):
            if y in (97, ):
                ch = 'η' if x % 5 else 'ξ'
            elif y == 98:
                ch = 'β'
            else:
                u = (x - bx0) % 4
                ch = 'ε' if u in (0, 1) else ('δ' if u == 2 else '-')
                if u == 0:
                    ch = 'η' if y < 104 else 'ε'
                if y == H - 3:
                    ch = '-'
            c.put(x, y, ch)
    for x in range(bx0 + 2, bx1, 6):          # 반벽 쇠 띠
        c.put(x, 102, 'X')
        c.put(x, 106, 'X')


bay(116, 133, 0)
bay(138, 155, 1)
# 마구간 기초
for x in range(SX0, SX1 + 1):
    c.put(x, H - 2, 'i' if x % 5 else 'a')
    c.put(x, H - 1, 'U' if x % 6 else 'T')



meta = {
    'name': '여관', 'massing': '11', 'material': 'plaster',
    'refs': ['bd-house-inn', 'bd-house-cstable'],
    'walk': walk_from(c, 3, 2, 2),
}
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('inn', meta)
print('fails', fails, 'warns', warns)
