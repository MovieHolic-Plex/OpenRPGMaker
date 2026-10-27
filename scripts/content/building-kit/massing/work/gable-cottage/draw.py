"""gable-cottage — 박공 정면 오두막(덩어리 모형 2). 4×6 칸(64×96).
남북 박공(㉚, 버들항 bd-house-h124_0): 앞 박공 삼각벽 뒤로 오각형 지붕이 물러나고 기와는 세로 열. 굴뚝은 오른 사면 용마루 곁.
문은 칸 (1,4)~(1,5) 안에만(㊱)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, chimney, plaster, eave_shadow, post, beam, window, door, moss  # noqa: E402
from nsroof import ns_roof, gable  # noqa: E402

W, H = 64, 96
c = Canvas(4, 6)

APEX, SHOULDER, EAVE = 4, 31, 60
ROOF = dict(
    tw=7, th=4, tw2=4, th2=4,
    hl=[(1, 4), (2, 3), (1, 3), (0, 4), (2, 3), (1, 4), (0, 3), (1, 2)],
    var=['0010200004001', '2000013000200', '0105000020010', '0002000100004', '3000100002001', '0020004000100',
         '1000020010000', '0004000200105', '0200100000020', '0001000403000', '1000200010000', '0030010000200'],
    shift=0,
)
inside, RL = ns_roof(c, 0, W - 1, APEX, SHOULDER, EAVE, ROOF)
# 굴뚝: 오른 사면 용마루 곁(뒤쪽 높은 자리) — 밑동은 사면 따라 오른쪽이 낮다
chimney(c, 39, 8, 21, cw=7, start=2, slope=1)
# 굴뚝 몸은 버들항처럼 검붉은 벽돌빛 막돌(갓돌은 회색 그대로)
RED = {'h': '=', 'j': '?', 'e': '&', 'd': '%', 'V': '%', 'X': '7', 'U': '7', 'k': '?', 'Z': '%', 'T': '7'}
for y in range(12, 24):
    for x in range(39, 46):
        g = c.get(x, y)
        if g not in RED:
            continue
        if x == 39:
            ch = '-'
        elif x == 40:
            ch = '?' if y % 3 else '<'
        elif x == 45:
            ch = '7'
        else:
            ch = RED[g]
        c.put(x, y, ch)

# 앞 박공 삼각벽(밑변 = 처마 줄)
GX0, GX1, GPEAK, GB = 3, W - 4, 40, EAVE
gable(c, GX0, GX1, GPEAK, GB, ox=3, oy=2, attic=(27, 48, 9, 7))

# 도리(삼각벽 밑) — 처마 끝까지 한 줄
WX0, WX1 = 2, W - 3
for x in range(1, W - 1):
    c.put(x, EAVE + 1, 'η' if x % 9 else 'ζ')
    c.put(x, EAVE + 2, 'ε')
    c.put(x, EAVE + 3, '-')
c.put(0, EAVE + 1, '-')
c.put(W - 1, EAVE + 1, '-')
# 벽
WY0 = EAVE + 4                      # 64
eave_shadow(c, WX0, WY0, WX1 - WX0 + 1, rows=('_', 'c', 'f', 'l'))
plaster(c, WX0, WY0 + 4, WX1 - WX0 + 1, H - 2 - WY0 - 4, ox=11, oy=6)
for px in (WX0, 32, WX1 - 2):
    post(c, px, WY0, H - 3)
# 허리 가로대(문 칸 오른쪽 칸만) + 가새 하나(가로대에서 도리로)
for x in range(35, WX1 - 2):
    c.put(x, 86, 'η' if x % 7 else 'ζ')
    c.put(x, 87, 'β')
DOOR_X, DOOR_W, DOOR_Y = 18, 12, 70
# 문틀(나무 기둥 사이 회벽 → 문 둘레 그늘 한 줄)
for y in range(DOOR_Y + 2, H - 2):
    c.put(DOOR_X - 1, y, 'f')
    c.put(DOOR_X + DOOR_W, y, 'c')
door(c, DOOR_X, DOOR_Y, DOOR_W, H - DOOR_Y - 2)
# 문 위 작은 차양 판(문 칸 안)
for x in range(DOOR_X - 1, DOOR_X + DOOR_W + 1):
    c.put(x, DOOR_Y - 2, 'η' if x < DOOR_X + 6 else 'ε')
    c.put(x, DOOR_Y - 1, '-')
window(c, 41, 69, w=11, h=12, box=True, shutters=True, look=4)
# 문 왼쪽 벽 칸: 좁은 쪽창(다른 창과 다르게: 덧문 없이 커튼)
window(c, 6, 71, w=7, h=10, box=False, look=1)
# 기초: 어두운 막돌 두 줄(문 앞은 밟는 돌)
for x in range(WX0, WX1 + 1):
    c.put(x, H - 2, 'a' if x % 6 == 0 else ('i' if x % 4 else 'h'))
    c.put(x, H - 1, 'U' if x % 5 else 'X')
for x in range(DOOR_X - 1, DOOR_X + DOOR_W + 1):
    c.put(x, H - 2, 'r' if x % 3 else 'm')
    c.put(x, H - 1, 'Z')
# 나무통 하나(오른 끝, 윗면 타원 보이게)
for j, row in enumerate(['.-εηε-.', '-ηξξξε-', 'ζεηηεβ-', 'ζXXXXW-', 'ζεηεεβ-', 'ζεηεεβ-', 'ζXXXXW-', '.-ββ--.']):
    for i, ch in enumerate(row):
        if ch != '.':
            c.put(54 + i, 86 + j, ch)
moss(c, [(2, 57, 2), (58, 58, 2)])
for (x, y, ch) in [(3, H - 3, 'N'), (4, H - 3, 'O'), (31, H - 3, 'N'), (52, H - 3, 'O')]:
    c.put(x, y, ch)

meta = {
    'name': '박공 정면 오두막', 'massing': '2', 'material': 'plaster',
    'refs': ['bd-house-h124_0', 'bd-house-h101_2'],
    'walk': ['.**.', '****', '****', '****', 'XDXX', 'XDXX'],
}
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('gable-cottage', meta)
print('fails', fails, 'warns', warns)
