"""cottage — 단층 오두막(덩어리 모형 1). 모임지붕 + 굴뚝 하나 + 회벽 반목조. 5×5 칸(80×80)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (Canvas, chimney, moss, roof, hip_side, HIP_LIT, HIP_DARK, plaster, eave_shadow, post, beam, brace,
                    window, door)

W, H = 80, 80
c = Canvas(5, 5)

RIDGE_Y = 9          # 용마루 줄
EAVE_Y = 46          # 처마 마지막 기와 줄(이 아래 처마끝 2줄)
RL, RR = 25, 54      # 용마루 왼끝·오른끝
SL = RL / (EAVE_Y - RIDGE_Y)        # 왼 모임 사선 기울기(화소/줄)
SR = (W - 1 - RR) / (EAVE_Y - RIDGE_Y)


def lx(y):  # 왼 모임 선 x
    return RL - (y - RIDGE_Y) * SL


def rx(y):
    return RR + (y - RIDGE_Y) * SR


CH_X, CH_W = -99, 0  # 굴뚝은 지붕 뒤에 그린다(아래)

# 2) 지붕 — 앞 사면(사다리꼴), 왼 모임(빛), 오른 모임(그늘)
# 3/4 모임지붕: 모임 선은 용마루 끝 → 처마 모서리. 바깥 윤곽은 더 가파르게 떨어져 중간 높이에서 처마 모서리
# 세로선에 닿는다 — 그 사이 삼각형이 위에서 보이는 옆 사면.
KNEE = RIDGE_Y + int((EAVE_Y - RIDGE_Y) * 0.5)


def OUT_L(y):
    return max(0.0, (RL - 3) - (y - RIDGE_Y) * (RL - 3) / (KNEE - RIDGE_Y))


def OUT_R(y):
    return min(W - 1.0, (RR + 3) + (y - RIDGE_Y) * (W - 1 - RR - 3) / (KNEE - RIDGE_Y))


front = lambda x, y: lx(y) + 1 < x < rx(y) - 1  # noqa: E731
roof(c, front, 0, W - 1, RIDGE_Y + 2, EAVE_Y, vshift=3)
hip_side(c, lambda x, y: OUT_L(y) - 0.5 <= x <= lx(y) + 1, 0, W - 1, RIDGE_Y + 1, EAVE_Y, HIP_LIT)
hip_side(c, lambda x, y: rx(y) - 1 <= x <= OUT_R(y) + 0.5, 0, W - 1, RIDGE_Y + 1, EAVE_Y, HIP_DARK, hshift=2)

# 모임 선: 왼쪽은 밝은 마룻기와(빛), 오른쪽은 짙은 선
for y in range(RIDGE_Y + 1, EAVE_Y + 1):
    x = int(round(lx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    c.put(x - 1, y, 'σ' if (y % 3) else 'L')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    c.put(xr + 1, y, 'θ' if (y % 3) else '%')
# 바깥 윤곽(재질 어두운 단)
for y in range(RIDGE_Y + 1, EAVE_Y + 2):
    xo = int(round(OUT_L(y)))
    if 0 <= xo < W:
        c.put(xo, y, '-' if y % 2 else 'α')
    xo = int(round(OUT_R(y)))
    if 0 <= xo < W:
        c.put(xo, y, '-' if y % 3 else '9')

# 용마루(마룻기와 줄): 덮개 + 밝은 윗선
for x in range(RL - 2, RR + 3):
    c.put(x, RIDGE_Y, 'ζ' if x in (RL - 2, RR + 2) else ('σ' if x % 4 else 'ξ'))
    c.put(x, RIDGE_Y + 1, '-' if x % 4 else 'α')
for x in range(RL, RR + 1, 4):
    c.put(x, RIDGE_Y, 'L')

# 처마끝: 기와 끝 동그란 막새 + 짙은 받침
for x in range(W):
    if c.get(x, EAVE_Y + 1) == '.' and not (x < OUT_L(EAVE_Y + 1) - 0.5 or x > OUT_R(EAVE_Y + 1) + 0.5):
        pass
    c.put(x, EAVE_Y + 1, '&' if x % 4 else '9')
    c.put(x, EAVE_Y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(0, EAVE_Y + 1, 'α')
c.put(W - 1, EAVE_Y + 1, '7')

# 굴뚝(오른쪽 뒤 — 용마루 오른끝 바로 아래 앞 사면에서 솟는다)
chimney(c, 45, 0, 17, cw=7)

# 3) 벽 — 처마 밑 그늘 띠 + 회벽 반목조
WX0, WX1 = 2, W - 3
WY0 = EAVE_Y + 3
eave_shadow(c, WX0, WY0, WX1 - WX0 + 1, rows=('|', '-', 'c', 'f', 'l'))
plaster(c, WX0, WY0 + 5, WX1 - WX0 + 1, H - WY0 - 5, ox=0, oy=0)

# 기둥·보
POSTS = [2, 14, 31, 45, 64, 75]
for px in POSTS:
    post(c, px, WY0 + 2, H - 4)
beam(c, WX0, WX1, WY0 + 4)        # 도리(처마 밑)
beam(c, WX0, WX1, H - 6, h=1)     # 하인방
# 가새: 좌측 좁은 칸, 문 오른쪽 칸, 오른쪽 좁은 칸
brace(c, 5, WY0 + 8, 12, H - 8)
brace(c, 42, WY0 + 8, 34, H - 8)
brace(c, 67, H - 8, 73, WY0 + 8)

# 창(문 오른쪽, 꽃상자)
window(c, 50, WY0 + 9, w=10, h=12, box=True, shutters=True)

# 문(왼쪽, 아치·징)
door(c, 18, WY0 + 6, 12, H - (WY0 + 6) - 2)

# 처마 밑 그늘 띠 양 끝은 재질 단(먹선 피함)
for y in range(WY0, WY0 + 2):
    c.put(WX0, y, '-')
    c.put(WX1, y, '-')
# 창 아래 빗물 얼룩(회벽이 조금 바랜다)
for (x, y) in [(52, WY0 + 24), (52, WY0 + 25), (57, WY0 + 24), (57, WY0 + 26)]:
    c.put(x, y, 'z')
# 굴뚝 밑동 물막이(회색 함석)
for x in range(CH_X - 1, CH_X + CH_W + 1):
    pass

# 기초: 짙은 돌 2줄
for x in range(WX0, WX1 + 1):
    c.put(x, H - 2, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, H - 1, 'U' if x % 6 else 'T')
# 문지방 앞 디딤돌
for x in range(17, 31):
    c.put(x, H - 2, 'r' if x % 4 else 'm')
    c.put(x, H - 1, 'Z')

# 이끼·풍화: 벽 아래쪽 기둥 밑동 (손 좌표)
for (x, y, ch) in [(3, H - 3, 'N'), (4, H - 3, 'O'), (15, H - 3, 'N'), (65, H - 3, 'O'), (66, H - 3, 'N'),
                   (76, H - 3, 'N'), (8, H - 3, 'z'), (40, H - 3, 'z'), (71, H - 4, 'y')]:
    c.put(x, y, ch)

moss(c, [(8, 41, 1), (53, 20, 2), (66, 42, 0), (30, 43, 2)])

meta = {
    'name': '단층 오두막', 'massing': '1', 'material': 'plaster',
    'refs': ['bd-house-h101_0', 'bd-house-lodge'],
    'walk': ['*****', '*****', '*****', 'XXXXX', 'XDXXX'],
}
fails, warns = c.save('cottage', meta)
print('fails', fails, 'warns', warns)
