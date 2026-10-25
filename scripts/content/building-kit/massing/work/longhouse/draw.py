"""longhouse — 롱하우스(덩어리 모형 5). 11×5 칸(176×80).
사람 칸: 정면과 나란한 긴 1층(양 끝 모임지붕) · 회벽 반목조 · 문 하나.
가축 칸: 오른쪽에 낮은 외쪽 지붕 판자벽 칸이 화소를 맞대고 붙는다(문 없음, 닫힌 건초창만)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
from common import Canvas, chimney, moss, plaster, eave_shadow, post, beam, brace, window, door  # noqa: E402
from gf import hip_roof, foundation, auto_walk, tiles, FRONT_BANDS  # noqa: E402
from common import hip_side, HIP_DARK  # noqa: E402
from wood import planks, shutter_hatch  # noqa: E402

W, H = 176, 80
c = Canvas(11, 5)

# ---------------------------------------------------------------- 가축 칸 외쪽 지붕(먼저 — 본채 지붕이 위를 덮는다)
LX0, LX1 = 128, 175
LT_EAVE = 50


def lt_top(x):          # 외쪽 지붕 윗변: 본채 쪽에서 오른쪽으로 조금 내려간다
    return 20 + (x - LX0) * 0.16


def lt_hip(x):          # 오른 끝 모임 사선(안쪽 선)
    return 166 + (x - 0) * 0


def lt_hip_line(y):
    t0 = lt_top(166)
    return 166 + (y - t0) * (175 - 166) / (LT_EAVE - t0)


def lt_out(y):
    t0 = lt_top(168)
    if y >= 35:
        return 175.0
    return 168 + (y - t0) * (175 - 168) / (35 - t0)


def in_lt(x, y):
    return LX0 <= x <= LX1 and lt_top(x) <= y <= LT_EAVE and x <= lt_out(y) + 0.5


LT_BANDS = [
    ('ρ', 'π', '<', '@'),
    ('ρ', 'π', '<', '!'),
    ('π', 'π', '?', '!'),
    ('π', '<', '?', '9'),
    ('ν', '<', '=', '9'),
    ('ν', '?', '=', '9'),
]
tiles(c, lambda x, y: in_lt(x, y) and x < lt_hip_line(y) - 1, LX0, LX1, 19, LT_EAVE, LT_BANDS, vshift=6, hshift=1)
hip_side(c, lambda x, y: in_lt(x, y) and x >= lt_hip_line(y) - 1, LX0, LX1, 19, LT_EAVE, HIP_DARK, hshift=1)
for y in range(19, LT_EAVE + 1):
    xs = [x for x in range(LX0, LX1 + 1) if in_lt(x, y)]
    if not xs:
        continue
    xh = int(round(lt_hip_line(y)))
    if xh <= xs[-1]:
        c.put(xh - 1, y, '_')
        c.put(xh, y, '_')
        c.put(xh + 1, y, 'θ' if y % 3 else '%')
    c.put(xs[-1], y, '-' if y % 3 else '9')
# 윗변: 본채 벽에 붙은 물막이(짙은 단 + 그 아래 한 줄 그늘)
for x in range(LX0, LX1 + 1):
    ys = [y for y in range(15, LT_EAVE) if in_lt(x, y)]
    if not ys:
        continue
    t = ys[0]
    c.put(x, t, 'α' if x % 5 else '-')
    if x < 168:
        c.put(x, t + 1, common.DARKER.get(c.get(x, t + 1), c.get(x, t + 1)))
# 처마끝
for x in range(LX0, LX1 + 1):
    c.put(x, LT_EAVE + 1, '&' if x % 4 else '9')
    c.put(x, LT_EAVE + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(LX1, LT_EAVE + 1, '-')
c.put(LX1, LT_EAVE + 2, '-')

# ---------------------------------------------------------------- 본채 모임지붕
R_Y, E_Y = 5, 40
X1 = 131
lx, rx, out_l, out_r = hip_roof(c, 0, X1, R_Y, E_Y, 36, 95, vshift=1)
chimney(c, 58, 0, 19, cw=8)

# 본채 지붕이 외쪽 지붕에 지는 그늘(이음 바로 오른쪽 3화소) + 골 물받이
SH = dict(common.DARKER)
SH.update({'θ': '%', '%': '7', '_': '-', 'α': '-'})
for y in range(19, LT_EAVE + 1):
    for k in range(0, 3 if y > 24 else 2):
        x = X1 + 1 + k
        if in_lt(x, y):
            ch = c.get(x, y)
            c.put(x, y, SH.get(ch, ch))
for y in range(20, E_Y + 3):
    c.put(X1, y, '-' if y % 3 else 'α')

# ---------------------------------------------------------------- 사람 칸 벽(회벽 반목조)
MX0, MX1 = 2, 129
WY0 = E_Y + 3                                   # 43
eave_shadow(c, MX0, WY0, MX1 - MX0 + 1)
plaster(c, MX0, WY0 + 5, MX1 - MX0 + 1, 77 - (WY0 + 5) + 1, ox=3, oy=2)
POSTS = [MX0, 15, 36, 63, 90, 116, 127]
for px in POSTS:
    post(c, px, WY0 + 2, 77)
beam(c, MX0, MX1, WY0 + 4)
beam(c, MX0, MX1, 72, h=1)
brace(c, 5, 70, 12, WY0 + 8)
brace(c, 119, WY0 + 8, 124, 70)
brace(c, 66, 70, 71, WY0 + 8)
for wx in (45, 76, 101):
    window(c, wx, WY0 + 8, w=10, h=11, box=True)
door(c, 20, WY0 + 6, 12, 77 - (WY0 + 6) + 1)
# 문 위 작은 차양 대신 쇠 등잔걸이(문 오른쪽)
for (x, y, ch) in [(33, 52, 'U'), (34, 52, 'U'), (34, 53, 'X'), (33, 54, 'X'), (34, 54, 'Y'), (35, 54, 'X'),
                   (33, 55, 'K'), (34, 55, 'L'), (35, 55, 'K'), (33, 56, 'τ'), (34, 56, 'K'), (35, 56, 'τ')]:
    c.put(x, y, ch)
foundation(c, MX0, MX1, 78, step=(19, 32))

# ---------------------------------------------------------------- 가축 칸 판자벽(본채 벽과 화소를 맞댄다)
BX0, BX1 = 130, 173
BY0 = LT_EAVE + 3                               # 53
planks(c, BX0, BY0, BX1 - BX0 + 1, 77 - BY0 + 1, bh=4, start=1, shade_top=3)
# 모서리 기둥(오른쪽) + 본채와 이음 기둥 그늘
for y in range(BY0, 78):
    c.put(BX0, y, '_')
    c.put(BX0 + 1, y, '-')
    c.put(BX1 - 1, y, 'ε')
    c.put(BX1, y, '_')
shutter_hatch(c, 142, BY0 + 4, 14, 11)
# 작은 환기 틈(살창, 어둡게 — 문 아님)
for i in range(8):
    for j in range(3):
        c.put(160 + i, BY0 + 6 + j, ('A' if i % 2 else 'β') if j < 2 else '-')
# 판자벽 아래 물튀김 얼룩 + 기초
for x in range(BX0, BX1 + 1):
    if x % 3:
        c.put(x, 76, common.DARKER.get(c.get(x, 76), c.get(x, 76)) if c.get(x, 76) in common.DARKER else c.get(x, 76))
foundation(c, BX0, BX1, 78)
# 건초 몇 가닥(덧문 아래 걸림)
for (x, y, ch) in [(146, 69, "σ"), (147, 69, "K"), (151, 69, "L")]:
    c.put(x, y, ch)

# ---------------------------------------------------------------- 풍화
for (x, y, ch) in [(3, 77, 'N'), (4, 77, 'O'), (37, 77, 'N'), (91, 77, 'O'), (92, 77, 'N'), (126, 77, 'N'),
                   (131, 77, 'N'), (132, 77, 'O'), (171, 77, 'N'), (50, 66, 'z'), (85, 64, 'z'), (110, 67, 'y')]:
    c.put(x, y, ch)
moss(c, [(8, 35, 1), (44, 30, 2), (104, 34, 0), (150, 44, 2), (20, 20, 2)])

meta = {
    'name': '롱하우스', 'massing': '5', 'material': 'plaster',
    'refs': ['bd-house-h101_0', 'bd-house-cstable'],
    'walk': auto_walk(c, 3, 1, (3, 4)),
}
print('\n'.join(meta['walk']))
fails, warns = c.save('longhouse', meta)
print('fails', fails, 'warns', warns)
