"""thouse — ㅜ자 집(덩어리 모형 6). 9×8 칸(144×128).
정면과 나란한 2층 본채(양 끝 모임) 앞에 박공 정면 1층 날개(문)가 붙고, 날개 지붕이 본채 지붕 속 골에서 만난다."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
from common import Canvas, chimney, moss, plaster, eave_shadow, post, beam, brace, window, door  # noqa: E402
from gf import gable_front, hip_roof, foundation, auto_walk  # noqa: E402

W, H = 144, 128
c = Canvas(9, 8)

# ---------------------------------------------------------------- 본채(물러난 2층) — 땅선 y=111
R_Y, E_Y = 6, 43
hip_roof(c, 0, W - 1, R_Y, E_Y, 38, 105, vshift=2)
chimney(c, 90, 0, 14, cw=8, start=6, slope=1)

MX0, MX1 = 2, W - 3
UY0 = E_Y + 3                                  # 46
eave_shadow(c, MX0, UY0, MX1 - MX0 + 1)
UY1 = 76
plaster(c, MX0, UY0 + 5, MX1 - MX0 + 1, UY1 - UY0 - 4, ox=2, oy=5)
# 창턱 띠장(벽 전체) — 기둥이 위를 덮는다
for x in range(MX0, MX1 + 1):
    c.put(x, UY1 - 4, 'ε')
    c.put(x, UY1 - 3, '-')
# 2층 창 여섯은 반목조 기둥 사이에 끼운다(창 양옆 기둥)
UWINS = (9, 32, 56, 79, 102, 125)
for px in [MX0] + [p for wx in UWINS for p in (wx - 3, wx + 10)] + [MX1 - 2]:
    post(c, px, UY0 + 2, UY1)
beam(c, MX0, MX1, UY0 + 4)
for n, wx in enumerate(UWINS):            # 여섯 창 모두 다르게(⑰)
    window(c, wx, UY0 + 9 + (n % 3 == 2), w=10, h=11 - (n % 3 == 2), box=(n not in (2, 5)), look=n)
# 층 사이 띠보
for x in range(MX0, MX1 + 1):
    c.put(x, 77, 'η' if x % 7 else 'ζ')
    c.put(x, 78, 'ε')
    c.put(x, 79, 'β')
    c.put(x, 80, '_' if x % 6 else '-')
GY0, GY1 = 81, 109
plaster(c, MX0, GY0, MX1 - MX0 + 1, GY1 - GY0 + 1, ox=9, oy=7)
for px in (MX0, 25, 116, MX1 - 2):
    post(c, px, GY0, GY1)
for n, wx in enumerate((9, 125)):
    window(c, wx, GY0 + 6, w=10, h=11, box=(n == 0), look=(4, 2)[n])
# 1층 바깥 칸 가새
brace(c, 30, GY1 - 4, 40, GY0)      # 띠장(GY1-3) → 층 사이 보(77~80) 밑까지
brace(c, 106, GY1 - 4, 100, GY0 + 10)   # 오른쪽은 짧은 가새(왼쪽과 다르게) — 띠장 → 중간 띠보
for x in range(97, 116):
    c.put(x, GY0 + 9, 'ε')
    c.put(x, GY0 + 10, '-')
for x in range(MX0, MX1 + 1):
    c.put(x, GY1 - 3, 'ε')
    c.put(x, GY1 - 2, '-')
foundation(c, MX0, MX1, 110)
for (x, y) in [(20, 60), (40, 66), (106, 58), (130, 70), (18, 98), (122, 100), (60, 90), (86, 93)]:
    c.put(x, y, 'z')

# ---------------------------------------------------------------- 날개(앞으로 나온 1층 박공 정면) — 땅선 y=127
NX0, NX1 = 48, 95                    # 날개 벽
# 날개 지붕: 본채 층 사이 보(77~80) 바로 밑에 붙는 남향 외쪽 지붕 — 위가 본채 벽에 붙고 처마가 앞(아래),
# 기와 줄은 가로, 양 끝은 모임 사선(왼쪽 밝게 · 오른쪽 어둡게)으로 닫는다. 보를 자르지 않는다.
from common import roof as _roof, hip_side as _hip, HIP_LIT as _HL, HIP_DARK as _HD  # noqa: E402
PX0, PX1 = NX0 - 6, NX1 + 6          # 지붕 너비(처마 쪽)
APEX, EAVE = 81, 95
PRL, PRR = PX0 + 12, PX1 - 12        # 용마루(본채 벽에 붙는 윗변) 양끝
PKNEE = APEX + (EAVE - APEX) // 2


def plx(y):
    return PRL - (y - APEX) * (PRL - PX0 - 1) / (EAVE - APEX)


def prx(y):
    return PRR + (y - APEX) * (PX1 - 1 - PRR) / (EAVE - APEX)


def pol(y):
    return max(float(PX0), PRL - 3 - (y - APEX) * (PRL - 3 - PX0) / (PKNEE - APEX))


def por(y):
    return min(float(PX1), PRR + 3 + (y - APEX) * (PX1 - PRR - 3) / (PKNEE - APEX))


_roof(c, lambda x, y: plx(y) + 1 < x < prx(y) - 1, PX0, PX1, APEX + 2, EAVE, vshift=4)
_hip(c, lambda x, y: pol(y) - 0.5 <= x <= plx(y) + 1, PX0, PX1, APEX + 1, EAVE, _HL)
_hip(c, lambda x, y: prx(y) - 1 <= x <= por(y) + 0.5, PX0, PX1, APEX + 1, EAVE, _HD, hshift=2)
for y in range(APEX + 1, EAVE + 1):
    x = int(round(plx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    c.put(x - 1, y, 'σ' if y % 3 else 'L')
    xr = int(round(prx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    c.put(xr + 1, y, 'θ' if y % 3 else '%')
    c.put(int(round(pol(y))), y, '-' if y % 2 else 'α')
    c.put(int(round(por(y))), y, '-' if y % 3 else '9')
for x in range(PRL - 3, PRR + 4):     # 본채 벽에 붙는 물막이 마룻기와
    c.put(x, APEX, 'ζ' if x in (PRL - 3, PRR + 3) else ('σ' if x % 4 else 'ξ'))
    c.put(x, APEX + 1, '-' if x % 4 else 'α')
for x in range(PX0, PX1 + 1):         # 처마끝
    c.put(x, EAVE + 1, '&' if x % 4 else '9')
    c.put(x, EAVE + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(PX0, EAVE + 1, 'α')
c.put(PX0, EAVE + 2, '-')
c.put(PX1, EAVE + 2, '-')
# 날개 지붕이 본채 1층 벽에 지는 그늘(오른쪽 모임 끝 옆 2화소)
for y in range(APEX + 4, EAVE + 3):
    for x in (int(round(por(y))) + 1, int(round(por(y))) + 2):
        ch = c.get(x, y)
        c.put(x, y, {'3': 'y', 'z': 'x', '1': 'y', 'ε': 'β', 'η': 'ε'}.get(ch, ch))

WY0 = EAVE + 3                       # 98
beam(c, NX0, NX1, WY0)
eave_shadow(c, NX0, WY0 + 3, NX1 - NX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, NX0, WY0 + 7, NX1 - NX0 + 1, H - 2 - WY0 - 7, ox=1, oy=3)
for px in (NX0, NX1 - 2):
    post(c, px, WY0 + 3, H - 3)
DOOR_X, DOOR_W = 66, 12
door(c, DOOR_X, WY0 + 5, DOOR_W, H - (WY0 + 5) - 2)
for px in (DOOR_X - 3, DOOR_X + DOOR_W):
    post(c, px, WY0 + 3, H - 3)
window(c, 82, WY0 + 8, w=9, h=9, box=True, look=5)
# 등불(문 왼쪽 칸)
for (x, y, ch) in [(55, 106, 'U'), (56, 106, 'U'), (56, 107, 'X'), (55, 108, 'X'), (56, 108, 'Y'), (57, 108, 'X'),
                   (55, 109, 'K'), (56, 109, 'L'), (57, 109, 'K'), (55, 110, 'K'), (56, 110, 'K'), (57, 110, 'τ'),
                   (55, 111, 'X'), (56, 111, 'U'), (57, 111, 'X')]:
    c.put(x, y, ch)
foundation(c, NX0, NX1, H - 2, step=(DOOR_X - 1, DOOR_X + DOOR_W))
for (x, y, ch) in [(49, H - 3, 'N'), (50, H - 3, 'O'), (93, H - 3, 'O'), (3, 109, 'N'), (4, 109, 'O'),
                   (139, 109, 'N')]:
    c.put(x, y, ch)

meta = {
    'name': 'ㅜ자 집', 'massing': '6', 'material': 'plaster',
    'refs': ['bd-house-h124_0', 'bd-house-h122_0'],
    'walk': auto_walk(c, 3, 4, (6, 7)),
}
print(meta['walk'])
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('thouse', meta)
print('fails', fails, 'warns', warns)
