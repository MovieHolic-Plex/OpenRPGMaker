"""merchant-house — 모임지붕 2층 상인 집(덩어리 모형 9). 7×7 칸(112×112).
막돌 1층 + 회벽 반목조 2층, 모임지붕, 굴뚝 둘, 1층에 걸린 간판(글자 없음 — 저울 그림)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, chimney, moss, plaster, eave_shadow, post, beam, brace, window, door  # noqa: E402
from gf import hip_roof, foundation, small_rubble, auto_walk  # noqa: E402

W, H = 112, 112
c = Canvas(7, 7)

R_Y, E_Y = 7, 48
hip_roof(c, 0, W - 1, R_Y, E_Y, 32, 79, vshift=6)
chimney(c, 28, 0, 17, cw=8, start=0, slope=1)     # 두 굴뚝은 폭·높이·돌 무늬·밑동 기울기가 다르다(㉗)
chimney(c, 77, 3, 15, cw=6, start=7, slope=-1)

# ---------------------------------------------------------------- 2층 회벽 반목조
WX0, WX1 = 1, W - 2
UY0 = E_Y + 3                     # 47
eave_shadow(c, WX0, UY0, WX1 - WX0 + 1)
UY1 = 78
plaster(c, WX0, UY0 + 5, WX1 - WX0 + 1, UY1 - UY0 - 4, ox=6, oy=3)
# 창턱 띠장(벽 전체) — 기둥이 위를 덮는다
for x in range(WX0, WX1 + 1):
    c.put(x, UY1 - 4, 'ε')
    c.put(x, UY1 - 3, '-')
# 창은 반목조 기둥 사이에 끼운다: 창 양옆 기둥 + 넓은 칸은 도리→띠장 가새(\ /)
for px in (WX0, 9, 23, 47, 61, 85, 99, WX1 - 2):
    post(c, px, UY0 + 2, UY1)
beam(c, WX0, WX1, UY0 + 4)
# 왼 넓은 칸: \ / 가새(도리 → 띠장)
brace(c, 27, UY0 + 7, 34, UY1 - 5)
brace(c, 44, UY0 + 7, 37, UY1 - 5)
# 오른 넓은 칸은 다르게: 가운데 동자 기둥 + 띠장에서 기둥 머리로 오르는 / \ 가새
post(c, 73, UY0 + 7, UY1 - 5)
brace(c, 65, UY1 - 5, 71, UY0 + 8)
brace(c, 82, UY1 - 5, 76, UY0 + 8)
for n, wx in enumerate((12, 50, 88)):     # 창마다 다르게(⑰)
    window(c, wx, UY0 + 8 + (n == 1), w=11, h=11 - (n == 1), box=(n != 1), shutters=False, look=n * 2)
for (x, y) in [(7, 62), (28, 72), (44, 60), (70, 73), (102, 64), (82, 58)]:
    c.put(x, y, 'z')
# 층 사이 내민 보 + 장선 머리
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
DOOR_X, DOOR_W, DOOR_Y = 50, 12, 87
small_rubble(c, WX0, GY0, WX1 - WX0 + 1, H - 2 - GY0, start=3)
for x in range(WX0, WX1 + 1):    # 내민 보 밑 그늘 한 줄
    ch = c.get(x, GY0)
    c.put(x, GY0, {'q': 'l', 'r': 'o', 'o': 'l', 'l': 'f', 'x': 'v', 'z': 'w', 'y': 'x', 'w': 'u'}.get(ch, ch))
for (dx, dy) in [(-2, 4), (-2, 2), (-1, 0), (1, -2), (4, -3), (6, -3), (8, -2), (10, 0), (11, 2), (11, 4)]:
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
# 1층 창 둘(돌 창틀, 덧문)
for wx in (16, 88):
    for y in range(89, 104):
        for x in range(wx - 2, wx + 12):
            c.put(x, y, 'h' if (x == wx - 2 or y == 89) else 'e')
    window(c, wx, 90, w=10, h=11, box=(wx == 16), look=1 if wx == 16 else 3)
# 걸린 간판: 벽에 박은 쇠 받침(벽판 + 가로 팔 + 사선 버팀) + 짧은 사슬 + 테두리 있는 널(저울 그림, 글자 없음)
for y in range(84, 93):                      # 벽판(징 둘) — 짙은 쇠
    c.put(65, y, 'V')
    c.put(66, y, 'W' if y % 4 else 'h')
for x in range(66, 80):                      # 가로 팔: 윗줄 쇠 빛 · 아랫줄 그늘
    c.put(x, 84, 'X' if x % 4 else 'e')
    c.put(x, 85, 'V')
c.put(80, 84, 'V')
c.put(80, 85, 'V')
# 버팀: 벽판에서 팔 밑으로 짧은 쇠 까치발(두 화소 계단 3단)
for k, (x, y) in enumerate([(67, 88), (68, 87), (69, 86)]):
    c.put(x, y, 'W')
    c.put(x, y + 1, 'V')
for (x, y) in [(69, 86), (69, 87), (77, 86), (77, 87)]:   # 사슬
    c.put(x, y, 'e' if y % 2 else 'X')
SX, SY = 67, 88
for j in range(11):
    for i in range(13):
        ch = 'δ'
        if i in (0, 12) or j in (0, 10):
            ch = '-' if (i == 12 or j == 10) else 'ζ'       # 테두리: 어두운 나무
        elif j == 9 or i == 11:
            ch = 'ε'
        elif j == 1 or i == 1:
            ch = 'η'
        c.put(SX + i, SY + j, ch)
SCALE = [  # 저울(글자 없음)
    '....σ....',
    '.ξξξξξξξ.',
    '.τ..ξ..τ.',
    'τ.τ.ξ.τ.τ',
    'ξσξ.ξ.ξσξ',
    '.τ..ξ..τ.',
    '...ξσξ...',
    '..ττττ...',
]
for j, row in enumerate(SCALE):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(SX + 2 + i, SY + 1 + j, ch)
foundation(c, WX0, WX1, H - 2, step=(DOOR_X - 1, DOOR_X + DOOR_W))
for (x, y, ch) in [(2, H - 3, 'N'), (3, H - 3, 'O'), (40, H - 3, 'N'), (106, H - 3, 'O'), (107, H - 3, 'N')]:
    c.put(x, y, ch)

meta = {
    'name': '모임지붕 2층 상인 집', 'massing': '9', 'material': 'plaster',
    'refs': ['bd-house-h106_1', 'bd-house-inn'],
    'walk': auto_walk(c, 3, 3, (5, 6)),
}
print(meta['walk'])
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('merchant-house', meta)
print('fails', fails, 'warns', warns)
