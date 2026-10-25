"""l-farmhouse — ㄱ자 농가(덩어리 모형 7). 9×6 칸(144×96).
긴 1층 본채(정면과 나란한 용마루, 왼 끝 모임) + 오른쪽 앞으로 나온 박공 정면 날개(문 하나).
날개 지붕 사면이 본채 지붕 속 골(물받이)에서 만난다. 날개 오른 벽은 본채 오른 끝과 같은 선."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
from common import Canvas, chimney, moss, plaster, eave_shadow, post, beam, brace, window, door  # noqa: E402
from gf import gable_front, hip_roof, foundation  # noqa: E402

W, H = 144, 96
c = Canvas(9, 6)

# ---------------------------------------------------------------- 본채(물러난 1층) — 땅선 y=79
R_Y, E_Y = 12, 40
hip_roof(c, 0, 137, R_Y, E_Y, 30, 106, vshift=3)
chimney(c, 22, 2, 24, cw=8)

MX0, MX1 = 2, 95
WY0 = E_Y + 3                                  # 43
eave_shadow(c, MX0, WY0, MX1 - MX0 + 1)
plaster(c, MX0, WY0 + 5, MX1 - MX0 + 1, 77 - (WY0 + 5) + 1, ox=4, oy=1)
for px in (MX0, 27, 54, 81):
    post(c, px, WY0 + 2, 77)
beam(c, MX0, MX1, WY0 + 4)
beam(c, MX0, MX1, 72, h=1)
for wx in (12, 39, 66):
    window(c, wx, WY0 + 8, w=10, h=11, box=True, shutters=False)
brace(c, 6, 70, 9, WY0 + 8)
brace(c, 31, WY0 + 8, 36, 70)
brace(c, 58, 70, 63, WY0 + 8)
brace(c, 85, WY0 + 8, 88, 70)
foundation(c, MX0, MX1, 78)

# ---------------------------------------------------------------- 날개(앞으로 나온 1층 박공 정면) — 땅선 y=95
NX0, NX1 = 92, 137
APEX, KNEE, EAVE, GPEAK = 4, 42, 62, 40
RX0, RX1 = NX0 - 4, min(W - 1, NX1 + 4)
in_g = gable_front(c, RX0, RX1, APEX, KNEE, EAVE, GPEAK, NX0 - 2, NX1 + 2, vshift=6, attic=(9, 7))
ctr = (RX0 + RX1 + 1) / 2.0
half = (RX1 - RX0 + 1) / 2.0


def wing_hw(y):
    if y >= KNEE:
        return half
    return half * (y - APEX + 1) / (KNEE - APEX + 1)


# 골: 날개 왼 사면이 본채 지붕을 가르는 선 — 본채 기와 쪽 2화소 물받이(짙게) + 날개 처마 밑 그늘
DK = dict(common.DARKER)
DK.update({'#': '!', '%': '7', 'θ': '%', '_': '-', '-': '-', 'η': 'ε', 'ζ': '-', 'α': '-', 'σ': 'ξ', 'L': 'ρ'})
for y in range(APEX + 1, EAVE + 1):
    hw = wing_hw(y)
    xl = int(ctr - hw) - 1
    if y <= E_Y + 2:
        for x, n in ((xl, 2), (xl - 1, 1), (xl - 2, 1 if y > R_Y + 4 else 0)):
            ch = c.get(x, y)
            for _ in range(n):
                ch = DK.get(ch, ch)
            c.put(x, y, ch)
# 본채 용마루가 날개 지붕 속으로 들어가는 자리: 마룻기와 끝 막음
for (x, y, ch) in [(int(ctr - wing_hw(R_Y)) - 2, R_Y, 'ζ'), (int(ctr - wing_hw(R_Y + 1)) - 2, R_Y + 1, '-')]:
    c.put(x, y, ch)

WY1 = EAVE + 3                                  # 65
beam(c, NX0, NX1, WY1)
eave_shadow(c, NX0, WY1 + 3, NX1 - NX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, NX0, WY1 + 7, NX1 - NX0 + 1, 93 - (WY1 + 7) + 1, ox=6, oy=4)
for px in (NX0, NX1 - 2):
    post(c, px, WY1 + 3, 93)
DOOR_X, DOOR_W = 113, 12
door(c, DOOR_X, WY1 + 4, DOOR_W, 93 - (WY1 + 4) + 1)
for px in (DOOR_X - 3, DOOR_X + DOOR_W):
    post(c, px, WY1 + 3, 93)
window(c, 97, WY1 + 7, w=9, h=10, box=True)
window(c, 127, WY1 + 7, w=7, h=10, box=False)
foundation(c, NX0, NX1, 94, step=(DOOR_X - 1, DOOR_X + DOOR_W))
# 본채 벽과 날개 벽 이음: 날개 왼 모서리 기둥이 본채 벽 앞에 선다(날개 아래 본채 벽 위로 짧은 그늘)
for y in range(WY0, 78):
    for x in (NX0 - 1,):
        ch = c.get(x, y)
        c.put(x, y, {'3': 'y', 'y': 'x', 'z': 'x', '1': 'y', 'η': 'ε', 'ε': 'β'}.get(ch, ch))

# ---------------------------------------------------------------- 풍화·생활
for (x, y, ch) in [(3, 77, 'N'), (4, 77, 'O'), (28, 77, 'N'), (55, 77, 'O'), (82, 77, 'N'), (93, 93, 'N'),
                   (94, 93, 'O'), (135, 93, 'N'), (18, 66, 'z'), (47, 64, 'z'), (74, 68, 'y'), (101, 89, 'z')]:
    c.put(x, y, ch)
# 문 옆 나무통(땅 위, 벽 앞)
for j, row in enumerate([]):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(102 + i, 87 + j, ch)
moss(c, [(6, 36, 1), (50, 30, 2), (78, 37, 0), (96, 56, 2), (128, 30, 2)])

walk = []
for cy in range(6):
    r = ''
    for cx in range(9):
        op = any(c.g[y][x] != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
            continue
        wing = cx >= 6 or (cx == 5 and cy >= 4)
        if cx == 7 and cy in (4, 5):
            r += 'D'
        elif wing:
            r += 'X' if cy >= 4 else '*'
        else:
            r += 'X' if cy >= 3 else '*'
    walk.append(r)
print('\n'.join(walk))
meta = {'name': 'ㄱ자 농가', 'massing': '7', 'material': 'plaster',
        'refs': ['bd-house-h101_0', 'bd-house-h122_0'], 'walk': walk}
fails, warns = c.save('l-farmhouse', meta)
print('fails', fails, 'warns', warns)
