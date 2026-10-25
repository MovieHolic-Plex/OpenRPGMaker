"""cross-house — 교차 박공 십자형 집(덩어리 모형 18). 9×8 칸(144×128).
정면과 나란한 본채(양 끝 모임) 를 더 높은 박공 날개가 남북으로 가로지른다: 날개 용마루가 본채 용마루 뒤까지 솟고,
앞으로 나온 박공 정면에 문. 두 지붕이 만나는 곳은 골(물받이 그늘)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
from common import Canvas, chimney, moss, plaster, eave_shadow, post, beam, brace, window, door  # noqa: E402
from gf import gable_front, hip_roof, foundation, auto_walk  # noqa: E402
from slate import plaster_more  # noqa: E402

W, H = 144, 128
c = Canvas(9, 8)

# ---------------------------------------------------------------- 본채(물러난 단층) — 땅선 y=111
R_Y, E_Y = 22, 60
hip_roof(c, 0, W - 1, R_Y, E_Y, 34, 109, vshift=6)
chimney(c, 114, 8, 26, cw=7, start=2, slope=-1)
chimney(c, 22, 14, 30, cw=6, start=6, slope=1)

MX0, MX1 = 2, W - 3
UY0 = E_Y + 3
eave_shadow(c, MX0, UY0, MX1 - MX0 + 1)
plaster(c, MX0, UY0 + 5, MX1 - MX0 + 1, 109 - UY0 - 4, ox=4, oy=2)
plaster_more(c, MX0, UY0 + 5, MX1, 104, ox=2)
for px in (MX0, 24, 44, 97, 117, MX1 - 2):
    post(c, px, UY0 + 2, 107)
beam(c, MX0, MX1, UY0 + 4)
for k, wx in enumerate((10, 30, 104, 124)):
    window(c, wx, UY0 + 12, w=9, h=12, box=(k % 2 == 0), look=k)
for x in range(MX0, MX1 + 1):
    c.put(x, 105, 'ε')
    c.put(x, 106, '-')
foundation(c, MX0, MX1, 110)
for (x, y) in [(20, 74), (38, 92), (109, 78), (131, 95), (15, 100), (128, 101)]:
    c.put(x, y, 'z')

# ---------------------------------------------------------------- 날개(남북으로 가로지르는 높은 박공) — 땅선 y=127
NX0, NX1 = 50, 93
RX0, RX1 = NX0 - 4, NX1 + 4
APEX, KNEE, EAVE, GPEAK = R_Y + 3, 82, 82, 57   # 날개 용마루 뒤끝은 본채 용마루 바로 아래, 처마 모서리까지 곧은 골
in_g = gable_front(c, RX0, RX1, APEX, KNEE, EAVE, GPEAK, NX0 - 2, NX1 + 2, vshift=2, attic=(9, 7))
ctr = (RX0 + RX1 + 1) / 2.0
half = (RX1 - RX0 + 1) / 2.0


def wing_hw(y):
    if y >= KNEE:
        return half
    return half * (y - APEX + 1) / (KNEE - APEX + 1)


DK = dict(common.DARKER)
DK.update({'#': '!', '%': '7', 'θ': '%', '_': '-', '-': '-', 'η': 'ε', 'ζ': '-', 'α': '-', 'L': 'ρ', 'σ': 'ξ',
           'ξ': 'η'})
SH = {'3': 'z', 'z': 'x', 'y': 'w', '1': 'y', 'ε': 'β', 'η': 'ε', 'β': '_', 'c': 'Y', 'f': 'c', 'l': 'f',
      '-': '-', '|': '|', 'ζ': '-', '_': '_', 'A': 'A'}
for y in range(APEX + 1, EAVE + 3):
    hw = wing_hw(y)
    xl = int(round(ctr - hw)) - 1
    xr = int(round(ctr + hw))
    if R_Y <= y <= E_Y + 2:   # 본채 지붕 위: 골(물받이) — 왼쪽은 밝은 함석 1 + 짙은 골 1, 오른쪽은 날개 그늘 3
        g = c.get(xl, y)
        c.put(xl, y, DK.get(DK.get(g, g), g))
        g = c.get(xl - 1, y)
        c.put(xl - 1, y, DK.get(g, g))
        c.put(xl - 2, y, 'ν' if y % 3 else 'σ')
        for k, n in ((0, 3), (1, 2), (2, 1), (3, 1)):
            x = xr + k
            ch = c.get(x, y)
            for _ in range(n):
                ch = DK.get(ch, ch)
            c.put(x, y, ch)
    elif y > E_Y + 2:          # 본채 벽 위: 날개가 오른쪽 벽에 그늘
        for k in range(0, 5):
            x = xr + k
            ch = c.get(x, y)
            c.put(x, y, SH.get(ch, ch))
            if k < 2:
                ch = c.get(x, y)
                c.put(x, y, SH.get(ch, ch))
        ch = c.get(xl, y)
        c.put(xl, y, {'3': 'y', 'z': 'x', 'y': 'x', '1': 'y'}.get(ch, ch))
WY0 = EAVE + 3                       # 85
beam(c, NX0, NX1, WY0)
eave_shadow(c, NX0, WY0 + 3, NX1 - NX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, NX0, WY0 + 7, NX1 - NX0 + 1, H - 2 - WY0 - 7, ox=1, oy=3)
plaster_more(c, NX0, WY0 + 7, NX1, H - 3, ox=7)
for px in (NX0, NX1 - 2):
    post(c, px, WY0 + 3, H - 3)
DOOR_X, DOOR_W = 66, 12
door(c, DOOR_X, WY0 + 13, DOOR_W, H - (WY0 + 13) - 2)
for px in (DOOR_X - 3, DOOR_X + DOOR_W):
    post(c, px, WY0 + 3, H - 3)
beam(c, DOOR_X - 3, DOOR_X + DOOR_W + 2, WY0 + 10, h=1)
window(c, 82, WY0 + 14, w=8, h=10, box=True, look=5)
# 등불(문 왼쪽 칸)
for (x, y, ch) in [(56, 103, 'U'), (57, 103, 'U'), (57, 104, 'X'), (56, 105, 'X'), (57, 105, 'Y'), (58, 105, 'X'),
                   (56, 106, 'K'), (57, 106, 'L'), (58, 106, 'K'), (56, 107, 'K'), (57, 107, 'K'), (58, 107, 'τ'),
                   (56, 108, 'X'), (57, 108, 'U'), (58, 108, 'X')]:
    c.put(x, y, ch)
foundation(c, NX0, NX1, H - 2, step=(DOOR_X - 1, DOOR_X + DOOR_W))
for (x, y, ch) in [(51, H - 3, 'N'), (52, H - 3, 'O'), (91, H - 3, 'O'), (3, 109, 'N'), (4, 109, 'O'),
                   (139, 109, 'N'), (46, 109, 'O'), (99, 109, 'N')]:
    c.put(x, y, ch)

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_ch', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))

meta = {
    'name': '교차 박공 십자형 집', 'massing': '18', 'material': 'plaster',
    'refs': ['bd-house-h124_0', 'bd-house-h122_0'],
    'walk': auto_walk(c, 4, 4, (6, 7)),
}
print('\n'.join(meta['walk']))
fails, warns = c.save('cross-house', meta)
print('fails', fails, 'warns', warns)
