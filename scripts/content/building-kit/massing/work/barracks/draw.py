"""barracks — 병영(덩어리 모형 C10). 10×6 칸(160×96), 건물은 0..147(문이 칸 4 한 열에 들도록 가운데를 74 에 둔다).
2층 마름돌 긴 몸채 · 청석 모임지붕(양 끝 모임) · 돌 굴뚝 셋 · 좁은 아치창 두 줄 · 가운데 아치문 하나."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pix  # noqa: E402
from pix import Ashlar, sclamp  # noqa: E402
from common import Canvas, moss, door  # noqa: E402
from slate import slate_hip_roof, slate_eave  # noqa: E402
from gf import auto_walk  # noqa: E402

W, H = 160, 96
c = Canvas(10, 6)
BX0, BX1 = 0, 147          # 지붕 폭
WX0, WX1 = 2, 145          # 벽 폭
CX = 74                    # 가운데
R_Y, E_Y = 4, 37
GY = 95


# ---------------------------------------------------------------- 돌 굴뚝(지붕보다 먼저 아래 몸, 지붕 뒤 → 지붕 위에 다시)
def stone_chimney(c, x, top, base, w=9):
    ash = Ashlar([4, 3, 4, 3], seed=x % 7, widths=[5, 4, 6, 3, 5, 4], warm=False)
    for y in range(top + 3, base + 1):
        for i in range(w):
            s = 1 if i < 2 else (-2 if i >= w - 2 else 0)
            ch = ash.color(x + i + 50, y - top, s)
            if i == 0:
                ch = 'e'
            if i == w - 1:
                ch = 'Y'
            c.put(x + i, y, ch)
    # 갓돌(내민 판석) 3줄 + 연기 구멍
    for i in range(-1, w + 1):
        c.put(x + i, top, 'r' if i < w // 2 else 'm')
        c.put(x + i, top + 1, 'k' if 0 < i < w - 1 else 'e')
        c.put(x + i, top + 2, 'a' if i in (-1, w) else ('U' if i < w - 1 else 'W'))
    for i in range(2, w - 2):
        c.put(x + i, top, 'T' if i % 2 else 'U')
    # 밑동 납 물막이 + 오른쪽으로 지붕에 지는 그늘
    for i in range(-1, w + 1):
        c.put(x + i, base + 1, 'i' if i < w // 2 else 'a')
        c.put(x + i, base + 2, 'Y' if i in (-1, w) else 'W')
    DK = {'I': 'G', 'H': 'G', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'C', 'σ': 'ξ', 'ξ': 'η'}
    for y in range(top + 5, base + 4):
        for k in (w + 1, w + 2):
            g = c.get(x + k - (0 if y < base + 2 else -1), y)
            if g in DK:
                c.put(x + k - (0 if y < base + 2 else -1), y, DK[g])


# ---------------------------------------------------------------- 지붕
def front_shade(x, y):
    # 손으로 정한 큰 결: 지붕 가운데 아래쪽이 조금 밝고, 굴뚝 뒤 그늘은 굴뚝이 따로 준다
    # 굴뚝 오른쪽 아래·처마 쪽만 조금 어둡게(넓은 밝은 덩이는 두지 않는다)
    return 0


lx, rx, out_l, out_r = slate_hip_roof(c, BX0, BX1, R_Y, E_Y, 36, 111, seed=3, front_shade=front_shade)
# 앞 사면을 버들항 성 지붕 결(둥근 윗머리 반짝 + 두 줄 겹침 그늘, 5×6 장)로 다시 깐다. 처마 쪽 두 줄은 한 단 그늘.
import slate2  # noqa: E402
slate2.slate_roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, BX0, BX1, R_Y + 2, E_Y - 1, th=4, vshift=2)
for _y in range(0, E_Y + 2):            # 왼쪽 모임 사면 흰 줄무늬를 한 단 낮춘다
    for _x in range(0, 60):
        _g = c.get(_x, _y)
        if _g in ('I', 'H'):
            c.put(_x, _y, {'I': 'H', 'H': 'G'}[_g])
slate_eave(c, BX0, BX1, E_Y + 1)
for cx_ in (30, CX - 4, 110):
    stone_chimney(c, cx_, 0, 17, w=8)

# ---------------------------------------------------------------- 벽(2층 마름돌)
WY0 = E_Y + 4                                   # 38
ash = Ashlar([6, 5, 6, 5, 6, 6, 5, 6, 5, 6], seed=2, warm=True)


def wall_shade(x, y):
    s = 0
    if y < WY0 + 3:
        s -= 2 if y < WY0 + 1 else 1           # 처마 밑 그늘
    if x < WX0 + 3:
        s += 1
    if x > WX1 - 3:
        s -= 1
    return s


pix.flat_wall(c, WX0, WY0, WX1 - WX0 + 1, GY - 2 - WY0 + 1, ash, shade=wall_shade)
# 층 사이 돌림띠(내민 돌: 밝은 윗면 · 짙은 아랫그늘)
SC = 64
for x in range(WX0, WX1 + 1):
    c.put(x, SC, 'r' if x % 11 else 'n')
    c.put(x, SC + 1, 'm' if x % 7 else 'k')
    c.put(x, SC + 2, 'e' if x % 5 else 'a')
    c.put(x, SC + 3, sclamp(4 if x % 9 else 3))
# 기초 받침(어두운 큰 돌 + 땅 닿는 줄)
base = Ashlar([3, 3], seed=7, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
pix.flat_wall(c, WX0, GY - 7, WX1 - WX0 + 1, 6, base, shade=lambda x, y: -1 if x > WX1 - 3 else 0)
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'a' if x % 7 else 'Y')
    c.put(x, GY, 'W' if x % 6 else 'U')
# 모서리 귀돌(밝은 왼쪽 · 그늘 오른쪽, 큰 돌·작은 돌 번갈아)
for (x0, lit) in ((WX0, True), (WX1 - 6, False)):
    y = WY0 + 2
    k = 0
    while y < GY - 8:
        hh = 6 if k % 2 == 0 else 5
        ww = 7 if k % 2 == 0 else 5
        xs = x0 if lit else x0 + (7 - ww)
        for j in range(hh):
            for i in range(ww):
                if y + j in (SC, SC + 1, SC + 2, SC + 3):
                    continue
                if j == hh - 1 or (i == ww - 1 and lit) or (i == 0 and not lit):
                    ch = 'Y' if lit else 'W'
                elif j == 0 or (i == 0 and lit):
                    ch = 's' if lit else 'k'
                else:
                    ch = 'r' if lit else 'i'
                c.put(xs + i, y + j, ch)
        y += hh
        k += 1


# ---------------------------------------------------------------- 좁은 아치창(버들항 성 결: 밝은 돌 테 + 짙은 남빛 유리 + 하늘 반짝)
UP = {  # 2층 좁은 아치창 — 반짝 자리·덧창·불빛이 창마다 다르다
    0: ['.rmmj.', 'rDDDAi', 'mF^DAi', 'mE^AAi', 'mDAABi', 'mDAABi', 'mYaaai', 'mE^AAi', 'mDAABi', 'mDAABi', 'mBAABi', 'mBBBAi', 'nmmmie', 'aYYYYa'],
    1: ['.rmmj.', 'rDDDAi', 'mDDF^i', 'mDAE^i', 'mAAABi', 'mAABBi', 'mYaaai', 'mDAAAi', 'mAA^Bi', 'mAABBi', 'mBABBi', 'mBBBBi', 'nmmmie', 'aYYYYa'],
    2: ['.rmmj.', 'rDLKAi', 'mLKKτi', 'mKKτAi', 'mKτττi', 'mτττBi', 'mYaaai', 'mDAABi', 'mDAABi', 'mE^ABi', 'mBAABi', 'mBBBAi', 'nmmmie', 'aYYYYa'],
    3: ['.rmmj.', 'rDDDAi', 'mF^DAi', 'mDAAAi', 'mDAABi', 'mDABBi', 'mYaaai', 'mqoqoi', 'mολοli'.replace('ο','o').replace('λ','l'), 'mololi', 'mlllli', 'mBBBAi', 'nmmmie', 'aYYYYa'],
    4: ['.rmmj.', 'rDDDAi', 'mDAADi', 'mD^AAi', 'mF^ABi', 'mDAABi', 'mYaaai', 'mDAABi', 'mDAABi', 'mAAABi', 'mBA^Bi', 'mBBBAi', 'nmmmie', 'aYYYYa'],
}
LO = {  # 1층은 네모 머리(돌 상인방) — 2층과 모양부터 다르다, 창마다 또 다르다
    0: ['knnnmj', 'aYYYYa', 'mDDDAi', 'mF^DAi', 'mE^AAi', 'mYaaai', 'mDAABi', 'mDAABi', 'mBAABi', 'mBBBAi', 'kmmmie', 'aYYYYa'],
    1: ['knnnmj', 'aYYYYa', 'mDDDAi', 'mDDF^i', 'mAAABi', 'mYaaai', 'mAA^Bi', 'mAABBi', 'mBBBBi', 'mBBBBi', 'NOkmie', 'aYYYYa'],
    2: ['knnnmj', 'aYYYYa', 'mτKKτi', 'mKLKτi', 'mKKττi', 'mYaaai', 'mτKτ7i', 'mKττ7i', 'mτττ7i', 'mτ777i', 'kmmmie', 'aYYYYa'],
    3: ['knnnmj', 'aYYYYa', 'mDDDAi', 'mD^AAi', 'mDAAAi', 'mYaaai', 'mqoolι'.replace('ι','i'), 'moolli', 'mollli', 'mBBBAi', 'kONmie', 'aYYYYa'],
    4: ['knnnmj', 'aYYYYa', 'mDDDAi', 'mDAADi', 'mF^ABi', 'mYaaai', 'mDAABi', 'mDA^Bi', 'mBAABi', 'mBBBAi', 'kmmmie', 'aYYYYa'],
}
UP_ORDER = [0, 1, 4, 2, 3, 1, 4]
LO_ORDER = [1, 3, 0, None, 4, 2, 0]
UP_Y, LO_Y = WY0 + 6, SC + 7
for k, wx in enumerate((17, 36, 55, 74, 93, 112, 131)):
    c.rows(wx - 2, UP_Y, UP[UP_ORDER[k]])
    for yy in (UP_Y - 1,):                     # 2층 아치 위 쐐기돌
        c.put(wx, yy, 's')
        c.put(wx + 1, yy, 'n')
        c.put(wx - 1, yy, 'r')
        c.put(wx + 2, yy, 'j')
    if LO_ORDER[k] is not None:
        c.rows(wx - 2, LO_Y, LO[LO_ORDER[k]])

# ---------------------------------------------------------------- 가운데 아치문(돌 홍예 + 징 판자 + 계단 돌)
DXX, DW = 68, 12
# 홍예(밝은 쐐기돌 테)
for (dx, dy, ch) in [(-3, 4, 'r'), (-3, 5, 'n'), (-3, 6, 'r'), (-2, 2, 's'), (-2, 3, 'r'), (-1, 1, 's'), (0, 0, 'r'),
                     (1, -1, 's'), (2, -1, 'r'), (3, -2, 's'), (4, -2, 'r'), (5, -2, 's'), (6, -2, 's'),
                     (7, -2, 'n'), (8, -2, 'm'), (9, -1, 'm'), (10, -1, 'k'), (11, 0, 'k'), (12, 1, 'j'),
                     (13, 2, 'i'), (13, 3, 'j'), (14, 4, 'i'), (14, 5, 'j'), (14, 6, 'i')]:
    c.put(DXX + dx, 70 + dy, ch)
for y in range(70 + 7, GY - 1):
    c.put(DXX - 3, y, 'r' if y % 5 else 'n')
    c.put(DXX - 2, y, 'm')
    c.put(DXX + DW, y, 'e')
    c.put(DXX + DW + 1, y, 'i' if y % 5 else 'j')
door(c, DXX, 70, DW, GY - 1 - 70)
for x in range(DXX - 3, DXX + DW + 2):             # 문 앞 디딤돌
    c.put(x, GY - 1, 'r' if x % 4 else 'm')
    c.put(x, GY, 'i' if x % 3 else 'Z')
# 양쪽 깃발(남빛 천 + 금 별 모양 점, 글자 없음) — 2층 창 사이에 건다
for bx in (44, 101):
    for j, row in enumerate(['τXXXXτ', '.FGGE.', '.FGGE.', '.FKKE.', '.FLKE.', '.FGGE.', '.FGGE.', '.FG.E.', '.F..E.']):
        for i, ch in enumerate(row):
            if ch != '.':
                c.put(bx + i, WY0 + 6 + j, ch)

# ---------------------------------------------------------------- 풍화·이끼(손 좌표)
for (x, y, ch) in [(4, 92, 'N'), (5, 92, 'O'), (30, 92, 'N'), (118, 92, 'O'), (143, 92, 'N'), (60, 91, 'N'),
                   (88, 92, 'O'), (20, 80, 'e'), (128, 50, 'e'), (50, 85, 'e')]:
    c.put(x, y, ch)
moss(c, [(10, 30, 2), (130, 28, 2), (60, 22, 2)])

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_br', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))

meta = {'name': '병영', 'massing': 'C10', 'material': 'stone',
        'refs': ['bd-house-barracks', 'bd-castle'], 'walk': auto_walk(c, 3, 4, (4, 5))}
print('\n'.join(meta['walk']))
fails, warns = c.save('barracks', meta)
print('fails', fails, 'warns', warns)
