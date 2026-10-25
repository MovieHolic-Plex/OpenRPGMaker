"""jetty-house — 위층이 튀어나온 2층 집(덩어리 모형 3). 5×7 칸(80×112). 막돌 1층 위로 반목조 2층이 튀어나온다, 박공 정면."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, plaster, eave_shadow, post, beam, brace, window, door, rubble  # noqa: E402
from gf import gable_front, foundation, small_rubble  # noqa: E402

W, H = 80, 112
c = Canvas(5, 7)

APEX, KNEE, EAVE, GPEAK = 3, 25, 49, 28
gable_front(c, 0, W - 1, APEX, KNEE, EAVE, GPEAK, 3, W - 4, vshift=7, attic=(10, 8))

# ---- 2층(튀어나옴): 0..79
UX0, UX1 = 1, W - 2
UY0 = EAVE + 3           # 52
beam(c, UX0, UX1, UY0)
eave_shadow(c, UX0, UY0 + 3, UX1 - UX0 + 1, rows=('-', 'c', 'f', 'l'))
UY1 = 76
plaster(c, UX0, UY0 + 7, UX1 - UX0 + 1, UY1 - UY0 - 6, ox=7, oy=4)
for px in (UX0, 26, 51, UX1 - 2):
    post(c, px, UY0 + 3, UY1)
window(c, 9, UY0 + 7, w=11, h=11, box=True, look=1)          # 두 창은 다르게(⑰): 꽃·커튼·반짝
window(c, 59, UY0 + 8, w=11, h=10, box=False, shutters=False, look=3)
# 창턱 높이 띠장(반목조 가로 부재)
for x0_, x1_ in [(4, 25), (29, 50), (54, 75)]:
    for x in range(x0_, x1_ + 1):
        c.put(x, UY0 + 20, 'ε')
        c.put(x, UY0 + 21, '-')
# 가운데 칸: 도리 밑에서 창턱 띠장까지 이어지는 가새 둘(\ /) — 보에서 보로
brace(c, 29, UY0 + 4, 46, UY0 + 19)          # 가운데 칸: 도리 → 띠장 긴 가새 하나 + 오른쪽 위 짧은 까치발
brace(c, 48, UY0 + 4, 44, UY0 + 9)
for (x, y) in [(31, 60), (44, 70), (14, 74), (66, 74)]:
    c.put(x, y, 'z')
# 내민 보(튀어나온 바닥 끝): 밝은 윗면 + 장선 머리
for x in range(0, W):
    c.put(x, 77, 'ξ' if x % 6 else 'η')
    c.put(x, 78, 'η' if x % 7 else 'ζ')
    c.put(x, 79, 'ε')
    c.put(x, 80, 'β')
c.put(0, 77, 'η')
c.put(W - 1, 77, '-')
for x in range(W):
    c.put(x, 81, '_' if (x - 2) % 7 > 2 else '-')
for x in range(2, W - 2, 7):    # 장선 머리(내민 들보 끝)
    for i in range(3):
        c.put(x + i, 81, 'ζ' if i == 0 else ('ε' if i == 1 else 'β'))
        c.put(x + i, 82, 'δ' if i < 2 else '-')
c.put(0, 78, '-')
c.put(0, 79, '-')
c.put(0, 80, '-')
c.put(W - 1, 78, '9')
c.put(W - 1, 79, '-')
c.put(W - 1, 80, '-')

# ---- 1층 막돌(안으로 3px 들어감)
GX0, GX1 = 3, W - 4
GY0 = 82
DOOR_X, DOOR_W, DOOR_Y = 34, 12, 87
small_rubble(c, GX0, GY0, GX1 - GX0 + 1, H - 2 - GY0, start=5)
# 내민 2층 밑 그늘(위 2~3줄 어둡게)
SH = {'v': 't', 'w': 'u', 'x': 'v', 'u': 't', 'g': 'e', 'f': 'c', 'z': 'w', 'p': 'x', 'j': 'g', 'h': 'f',
      't': 'c', 'e': 'd', 'c': 'J', 'J': 'C', 'C': 'C', 'r': 'q', 'q': 'o', 'o': 'l', 'l': 'f', '*': 'J', 'y': 'x'}
for x in range(GX0, GX1 + 1):
    for y, n in ((83, 2), (84, 2), (85, 1), (86, 1)):
        ch = c.get(x, y)
        for _ in range(n):
            ch = SH.get(ch, ch)
        c.put(x, y, ch)
# 모서리 까치발(내민 보 받침)
for (bx, dirn) in ((GX0, 1), (GX1, -1)):
    for k in range(5):
        c.put(bx + dirn * k, 83 + (4 - k), 'ε' if dirn > 0 else 'β')
        c.put(bx + dirn * k, 83 + (4 - k) - 1, 'η' if dirn > 0 else 'ε')
    for y in range(83, 89):
        c.put(bx, y, 'ε' if dirn > 0 else 'β')
# 문 둘레 쐐기돌 아치
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
# 작은 1층 창(돌 창틀) — 오른쪽
WX, WY = 57, 91
for y in range(WY - 1, WY + 11):
    for x in range(WX - 2, WX + 11):
        c.put(x, y, 'h' if (x == WX - 2 or y == WY - 1) else 'e')
window(c, WX, WY, w=9, h=9, box=False, look=5)
# 등불(문 왼쪽)
for (x, y, ch) in [(27, 90, 'U'), (28, 90, 'U'), (28, 91, 'X'), (27, 92, 'X'), (28, 92, 'Y'), (29, 92, 'X'),
                   (27, 93, 'K'), (28, 93, 'L'), (29, 93, 'K'), (27, 94, 'K'), (28, 94, 'K'), (29, 94, 'τ'),
                   (27, 95, 'X'), (28, 95, 'U'), (29, 95, 'X')]:
    c.put(x, y, ch)
foundation(c, GX0, GX1, H - 2, step=(DOOR_X - 1, DOOR_X + DOOR_W))
for (x, y, ch) in [(5, H - 3, 'N'), (6, H - 3, 'O'), (14, H - 3, 'N'), (71, H - 3, 'O'), (72, H - 3, 'N')]:
    c.put(x, y, ch)

meta = {
    'name': '위층이 튀어나온 2층 집', 'massing': '3', 'material': 'plaster',
    'refs': ['bd-house-h102_1', 'bd-house-inn'],
    'walk': ['.***.', '*****', '*****', '*****', 'XXXXX', 'XXDXX', 'XXDXX'],
}
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('jetty-house', meta)
print('fails', fails, 'warns', warns)
