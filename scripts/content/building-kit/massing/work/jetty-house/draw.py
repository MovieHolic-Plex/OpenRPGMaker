"""jetty-house — 위층이 튀어나온 2층 집(덩어리 모형 3). 5×7 칸(80×112).
남북 박공(㉚, 버들항 bd-house-h124_0) + 반목조 2층이 막돌 1층보다 양옆으로 4화소 튀어나온다(내민 들보·까치발·밑 그늘).
gable-cottage 와 같은 규약이지만 낱장 너비·빛 모양·변화표·벽 무늬를 모두 달리 해 8×8 조각이 겹치지 않게."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, plaster, eave_shadow, post, window, door, rubble, brace, moss  # noqa: E402
from nsroof import ns_roof, gable  # noqa: E402

W, H = 80, 112
c = Canvas(5, 7)

APEX, SHOULDER, EAVE = 0, 30, 49
ROOF = dict(
    tw=6, th=4, tw2=5, th2=3,
    hl=[(0, 3), (1, 3), (0, 2), (1, 2), (0, 3), (2, 2), (1, 3)],
    var=['0200010000300', '0001000204000', '1000300000020', '0020000100001', '4000102000000', '0001000030200',
         '0100004000010', '2000010020000', '0003000100400', '0100200000001', '0000010200030', '1004000001000',
         '0020100000200'],
    shift=4,
)
inside, RL = ns_roof(c, 0, W - 1, APEX, SHOULDER, EAVE, ROOF)

# 앞 박공 삼각벽: 다락창 + 동자 기둥
GX0, GX1, GPEAK, GB = 4, W - 5, 29, EAVE
gable(c, GX0, GX1, GPEAK, GB, ox=8, oy=9, board=2, attic=(35, 37, 10, 8))

# ---- 2층 반목조(튀어나옴): x 1..78
UX0, UX1 = 1, W - 2
for x in range(UX0, UX1 + 1):                     # 삼각벽 밑 도리
    c.put(x, EAVE + 1, 'ζ' if x % 11 == 3 else 'η')
    c.put(x, EAVE + 2, 'ε' if x % 5 else 'δ')
    c.put(x, EAVE + 3, '-')
c.put(0, EAVE + 1, '-')
c.put(W - 1, EAVE + 1, '-')
UY0 = EAVE + 4                                     # 51
UY1 = 79
eave_shadow(c, UX0, UY0, UX1 - UX0 + 1, rows=('_', '-', 'c', 'f'))
plaster(c, UX0, UY0 + 4, UX1 - UX0 + 1, UY1 - UY0 - 3, ox=14, oy=11)
for px in (UX0, 26, 51, UX1 - 2):
    post(c, px, UY0, UY1)
# 창턱 높이 띠장(가운데 칸은 가새가 들어가 띠장 없음)
for x0_, x1_ in [(4, 25), (54, 75)]:
    for x in range(x0_, x1_ + 1):
        c.put(x, 72, 'η' if x % 6 else 'ζ')
        c.put(x, 73, 'β')
window(c, 9, 57, w=12, h=11, box=True, look=2)       # 왼 칸: 꽃상자 창
window(c, 60, 58, w=10, h=10, box=False, shutters=True, look=5)   # 오른 칸: 덧문 창
# 가운데 칸: X 자 가새(도리 밑 → 바닥 보, 기둥 사이에 닿게) + 가운데 작은 둥근 환기창
brace(c, 29, UY0 + 1, 47, UY1 - 1)
brace(c, 48, UY0 + 1, 30, UY1 - 1)
for (dx, dy, ch) in [(0, 0, 'η'), (1, 0, 'η'), (2, 0, 'ε'), (-1, 1, 'η'), (0, 1, 'D'), (1, 1, 'D'), (2, 1, 'A'), (3, 1, 'β'),
                     (-1, 2, 'η'), (0, 2, 'A'), (1, 2, 'B'), (2, 2, 'B'), (3, 2, 'β'), (0, 3, 'ε'), (1, 3, 'β'), (2, 3, 'β')]:
    c.put(37 + dx, 64 + dy, ch)
for (x, y) in [(32, 58), (45, 75), (14, 76), (66, 52 + 22)]:
    c.put(x, y, 'z')

# ---- 내민 들보(2층 바닥): 밝은 윗널 + 장선 머리가 줄지어 나온다
JY = 80
for x in range(0, W):
    c.put(x, JY, 'ξ' if (x + 3) % 9 else 'η')
    c.put(x, JY + 1, 'η' if (x + 1) % 8 else 'ζ')
    c.put(x, JY + 2, 'ε')
    c.put(x, JY + 3, 'β')
c.put(0, JY, '-')
c.put(W - 1, JY, '-')
for y in range(JY + 1, JY + 4):
    c.put(0, y, '-')
    c.put(W - 1, y, '_')
for x in range(3, W - 3, 6):                       # 장선 머리(네모 끝마구리)
    c.put(x, JY + 2, 'ξ')
    c.put(x + 1, JY + 2, 'η')
    c.put(x, JY + 3, 'ε')
    c.put(x + 1, JY + 3, '-')

# ---- 1층 막돌(양옆으로 4화소 들어감): x 5..74
GX0_, GX1_ = 5, W - 6
GY0 = JY + 4                                       # 84
rubble(c, GX0_, GY0, GX1_ - GX0_ + 1, H - 2 - GY0, [3, 3, 2, 3, 3, 3, 2], start=3,
       faces='vpvxpvwpvpxvppvwvpxpv', widths=[4, 3, 5, 2, 4, 3, 6, 3, 2, 5, 4, 3])
# 내민 2층 밑 그늘(위 4줄, 위로 갈수록 짙다)
SH = {'o': 'l', 'q': 'o', 'l': 'f', 'x': 'v', 'w': 'u', 'f': 'c', 'J': 'C', 'C': 'C', 'p': 'x', 'z': 'w', 'v': 't',
      'r': 'q', 'u': 't', 't': 't', 'c': 'J'}
for x in range(GX0_, GX1_ + 1):
    for y, n in ((GY0, 3), (GY0 + 1, 2), (GY0 + 2, 1), (GY0 + 3, 1)):
        ch = c.get(x, y)
        for _ in range(n):
            ch = SH.get(ch, ch)
        c.put(x, y, ch)
# 옆 모서리 돌 테(재질 어두운 단) + 까치발(벽 → 내민 들보)
for y in range(GY0, H - 2):
    c.put(GX0_, y, 'u' if y % 3 else 't')
    c.put(GX1_, y, 'C')
for (bx, dirn) in ((GX0_, -1), (GX1_, 1)):
    for k in range(4):
        x = bx + dirn * k
        y = GY0 + 3 - k
        c.put(x, y, 'η' if dirn < 0 else 'ε')
        c.put(x, y + 1, 'β' if dirn < 0 else '-')
for (x, y, ch) in [(4, 84, 'ε'), (3, 84, 'η'), (2, 84, 'η'), (1, 84, '-'), (4, 85, 'β'), (3, 85, 'β'), (2, 85, '-'),
                   (4, 86, 'β'), (3, 86, '-'), (4, 87, '-'),
                   (75, 84, 'ε'), (76, 84, 'ε'), (77, 84, 'β'), (78, 84, '-'), (75, 85, 'β'), (76, 85, '-'), (77, 85, '-'),
                   (75, 86, '-'), (76, 86, '_'), (75, 87, '_')]:
    c.put(x, y, ch)

# 문: 칸 (2,5)~(2,6) 안. 쐐기돌 아치 둘레
DOOR_X, DOOR_W, DOOR_Y = 34, 12, 87
for (dx, dy) in [(-2, 5), (-2, 3), (-1, 1), (1, -1), (4, -2), (6, -2), (8, -1), (10, 1), (11, 3), (11, 5)]:
    x, y = DOOR_X + dx, DOOR_Y + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, 'p' if (j == 0 and k == 0) else ('x' if j == 0 else 'v'))
    c.put(x + 1, y + 1, 't')
for y in range(DOOR_Y + 7, H - 2):
    c.put(DOOR_X - 2, y, 'p' if y % 4 else 'x')
    c.put(DOOR_X - 1, y, 't')
    c.put(DOOR_X + DOOR_W, y, 'J')
    c.put(DOOR_X + DOOR_W + 1, y, 'v' if y % 4 else 'C')
door(c, DOOR_X, DOOR_Y, DOOR_W, H - DOOR_Y - 2)
# 1층 오른쪽 작은 돌창(쇠살) — 2층 창과 다르게
WX, WY = 57, 92
for y in range(WY - 2, WY + 10):
    for x in range(WX - 2, WX + 10):
        c.put(x, y, 'p' if (x == WX - 2 or y == WY - 2) else ('t' if (x == WX + 9 or y == WY + 9) else 'x'))
for y in range(WY, WY + 8):
    for x in range(WX, WX + 8):
        ch = 'B' if y > WY + 4 else ('D' if y > WY + 1 else 'E')
        if (x - WX) % 3 == 2:
            ch = 'X'
        c.put(x, y, ch)
c.put(WX + 1, WY + 1, 'H')
c.put(WX + 4, WY + 2, '^')
for x in range(WX - 3, WX + 11):
    c.put(x, WY + 10, 'm' if x < WX + 4 else 'h')
    c.put(x, WY + 11, 'Y')
# 1층 왼쪽: 벽에 기댄 나무 궤짝(윗면 보이게)
for j, row in enumerate(['-ηηξξηηξη-', '-ξσσξξσξη-', '-εηεεηεεβ-', 'ζη-ηεε-εβ_', 'ζε-εεβ-ββ_',
                         'ζηηηεεηεβ_', 'ζε-εβε-εβ_', 'ζη-ηεε-ββ_', '-__-__-__-']):
    for i, ch in enumerate(row):
        c.put(10 + i, 101 + j, ch)
# 기초
for x in range(GX0_ - 1, GX1_ + 2):
    c.put(x, H - 2, 'h' if x % 5 == 0 else ('i' if x % 3 else 'a'))
    c.put(x, H - 1, 'X' if x % 4 == 1 else 'U')
for x in range(DOOR_X - 2, DOOR_X + DOOR_W + 2):
    c.put(x, H - 2, 'r' if x % 4 else 'm')
    c.put(x, H - 1, 'Z')
moss(c, [(3, 44, 2), (74, 45, 2), (6, 106, 2)])

meta = {
    'name': '위층이 튀어나온 2층 집', 'massing': '3', 'material': 'plaster',
    'refs': ['bd-house-h124_0', 'bd-house-h102_1'],
    'walk': ['.***.', '*****', '*****', 'XXXXX', 'XXXXX', 'XXDXX', 'XXDXX'],
}
from fixups import finalize  # noqa: E402
finalize(c)
fails, warns = c.save('jetty-house', meta)
print('fails', fails, 'warns', warns)
