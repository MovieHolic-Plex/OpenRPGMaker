"""dormer-house — 지붕창 3층 집(덩어리 모형 17). 7×8 칸(112×128). 난수 없음.
3층 회벽(귀돌·돌 띠, 층마다 다른 점묘 결), 손 기와 모임지붕(얇은 마룻기와, 양 끝 모임 사선).
지붕창 둘은 서로 다르다: 왼쪽 = 남북 박공 지붕창(위에서 보이는 두 사면, 세로 기와 줄, 용마루가 본 지붕으로 들어가 골),
오른쪽 = 모임 지붕창(앞 사면 + 양 모임). 굴뚝은 오른 모임 사면에 서서 밑동이 경사를 따른다(띠 받침 없음).
층마다 창 셋(덧문·커튼·불빛·꽃상자·창턱 길이 제각각), 1층 가운데 문."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, plaster, eave_shadow, door  # noqa: E402
from gf import foundation  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import hip_roof, chimney  # noqa: E402
from nh import cwin, stipple, edge_report, ns_gable  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../src/harnesses/building-kit'))
from massing_lib import P  # noqa: E402

W, H = 112, 128
c = Canvas(7, 8)
GY = H - 1

# ---------------------------------------------------------------- 본 지붕 + 굴뚝(오른 모임 사면)
R_Y, E_Y = 6, 46
hip_roof(c, 0, W - 1, R_Y, E_Y, 30, 81, seed=8)
chimney(c, 88, 2, 20, 26, cw=9)


# ---------------------------------------------------------------- 왼 지붕창: 남북 박공(작은 3/4 지붕 윗면)
def dormer_wall(x0, x1, y0, y1, k):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c.put(x, y, '3')
    stipple(c, x0, y0, x1, y1, k=k)
    for y in range(y0, y1 + 1):                  # 양 볼 테(왼 밝음 · 오른 그늘)
        c.put(x0, y, 'η')
        c.put(x1, y, 'β')
    for x in range(x0 - 1, x1 + 2):              # 밑 물막이 + 본 지붕에 진 그늘
        c.put(x, y1 + 1, 'i' if x < (x0 + x1) // 2 else 'e')
        darken(c, x, y1 + 2, 2)
        darken(c, x, y1 + 3, 1)
    for y in range(y0 - 2, y1 + 3):              # 오른쪽 기와에 진 그늘
        darken(c, x1 + 1, y, 2)
        darken(c, x1 + 2, y, 1)


def gable_infill(mask, cx, top, gb):
    for y in range(top, gb + 1):
        for x in range(cx - 12, cx + 13):
            if mask(x, y):
                c.put(x, y, '3')
    stipple(c, cx - 12, top, cx + 12, gb, k=2)


def snap():
    return [row[:] for row in c.g]


def rim(before, x0, x1, y0, y1):
    """지붕창이 새로 덮은 화소 둘레의 본 지붕 화소: 왼·위는 한 단, 오른쪽은 두 단 어둡게(본 지붕 위에 선 덩어리)."""
    new = set()
    for y in range(y0, y1 + 1):
        xs = [x for x in range(x0, x1 + 1) if c.g[y][x] != before[y][x]]
        if xs:
            new |= {(x, y) for x in range(xs[0], xs[-1] + 1)}
    for (x, y) in list(new):
        for ax, ay, n in ((-1, 0, 1), (0, -1, 1), (1, 0, 2), (2, 0, 1)):
            q = (x + ax, y + ay)
            if q not in new and 0 <= q[0] < W and 0 <= q[1] < H:
                darken(c, q[0], q[1], n)


DL0, DL1 = 20, 41
b0 = snap()


def gable_dormer(x0, x1, top, peak, base):
    """작은 박공 지붕창(위에서 본 두 사면 + 세로 용마루 + 남쪽 삼각벽).
    위 윤곽 = 용마루 끝에서 양쪽으로 내려가는 골(본 지붕과 만나는 선). 사면 기와 줄은 처마와 나란히 세로."""
    ctr = (x0 + x1 + 1) / 2.0
    half = (x1 - x0 + 1) / 2.0
    rl = int(ctr) - 1                              # 용마루 왼 화소

    def valley(x):                                 # 그 열의 지붕 윗끝
        return top + int(abs(x + 0.5 - ctr) * 0.55)

    def rake(x):                                   # 그 열의 삼각벽 윗끝
        return peak + int(abs(x + 0.5 - ctr) * (base - peak) / half)
    for x in range(x0, x1 + 1):
        left = x <= rl
        d = (rl - x) if left else (x - rl - 1)      # 용마루에서 거리
        for y in range(valley(x), base + 1):
            if y >= rake(x):
                break
            if left:
                ch = 'σ' if y == valley(x) else ('μ' if d % 3 == 2 else ('ρ' if d % 3 == 0 else 'π'))
                if d % 3 != 2 and (y + d // 3 * 2) % 4 == 0:
                    ch = 'ν'                       # 낱장 끝(세로 줄 안에서 엇갈림)
                if x == x0:
                    ch = 'α' if y % 2 else 'δ'     # 바깥 처마끝(재질 어두운 단)
            else:
                ch = '@' if d % 3 == 2 else ('<' if d % 3 == 0 else '?')
                if d % 3 != 2 and (y + d // 3 * 2) % 4 == 0:
                    ch = '='
                if x == x1:
                    ch = '9'
                if y == valley(x):
                    ch = 'π'
            c.put(x, y, ch)
    for y in range(top, peak + 1):                 # 얇은 마룻기와(세로)
        c.put(rl, y, 'L' if y % 4 == 1 else 'σ')
        c.put(rl + 1, y, 'η')
    for x in range(x0, x1 + 1):                    # 박공널(왼 밝음 · 오른 그늘) + 삼각벽
        r = rake(x)
        left = x <= rl
        if r <= base:
            c.put(x, r, 'ξ' if left else 'ε')
            if r + 1 <= base:
                c.put(x, r + 1, 'η' if left else 'δ')
            for y in range(r + 2, base + 1):
                c.put(x, y, '3')
    stipple(c, x0, peak, x1, base, k=2)
    for x in range(x0, x1 + 1):                    # 삼각벽 밑 가로 보
        c.put(x, base, 'η' if x <= rl else 'ε')
    for x in range(x0 - 2, x1 + 3):                # 둘레: 본 지붕 위에 지는 골 그늘(왼 한 단, 오른 두 단)
        v = valley(min(max(x, x0), x1))
        darken(c, x, v - 1, 1)
    for y in range(valley(x0), base + 2):
        darken(c, x0 - 1, y, 1)
        darken(c, x1 + 1, y, 2)
        darken(c, x1 + 2, y, 1)


gable_dormer(DL0, DL1, 17, 26, 35)
dormer_wall(DL0 + 2, DL1 - 2, 36, 43, 1)
cwin(c, DL0 + 7, 36, w=8, h=8, frame='wood', shutters='none', glint=1, sill=0)

# ---------------------------------------------------------------- 오른 지붕창: 모임(앞 사면 + 양 모임), 창은 둥근머리
DR0, DR1 = 68, 89
b1 = snap()
hip_roof(c, DR0, DR1, 18, 33, 75, 82, seed=11, knee_frac=0.75)
from hand import BRIGHT  # noqa: E402
for y in range(19, 34):                          # 지붕창 앞 사면은 본 지붕보다 가팔라 한 단 밝다
    for x in range(DR0 + 1, DR1):
        if c.g[y][x] != b1[y][x]:
            c.put(x, y, BRIGHT.get(c.g[y][x], c.g[y][x]))
for x in range(DR0 - 1, DR1 + 2):                # 지붕창 위로 본 지붕에 지는 골 그늘 한 줄
    for y in range(14, 34):
        if c.g[y][x] != b1[y][x]:
            darken(c, x, y - 1, 1) if c.g[y - 1][x] == b1[y - 1][x] else None
            break
dormer_wall(DR0 + 2, DR1 - 2, 36, 43, 0)
cwin(c, DR0 + 7, 36, w=8, h=8, frame='wood', shutters='none', curtain=True, glint=2, sill=0, arch=True)
rim(b1, DR0 - 1, DR1 + 1, 14, 35)

# ---------------------------------------------------------------- 벽 3층(층마다 다른 점묘 결)
WX0, WX1 = 2, W - 3
eave_shadow(c, WX0, E_Y + 3, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, E_Y + 7, WX1 - WX0 + 1, H - 2 - (E_Y + 7), ox=3, oy=1)
stipple(c, WX0, E_Y + 7, WX1, 71, k=0)
stipple(c, WX0, 76, WX1, 96, k=1)
stipple(c, WX0, 101, WX1, H - 3, k=2)


def band(y):
    for x in range(WX0, WX1 + 1):
        c.put(x, y, 'r' if x % 9 else 'n')
        c.put(x, y + 1, 'm' if x % 9 else 'k')
        c.put(x, y + 2, 'h' if x % 9 else 'e')
        c.put(x, y + 3, 'y')


band(72)
band(97)
q, k = E_Y + 6, 0
while q < H - 2:                                 # 귀돌
    hgt = 5 if k % 2 == 0 else 4
    lw = 7 if k % 2 == 0 else 5
    for j in range(hgt):
        for i in range(lw):
            last = j == hgt - 1
            c.put(WX0 + i, q + j, 'e' if last else ('r' if j == 0 else ('n' if i < lw - 1 else 'k')))
            c.put(WX1 - i, q + j, 'a' if last else ('k' if j == 0 else ('j' if i > 0 else 'h')))
    q += hgt
    k += 1

# 창 여덟 — 칸마다 덧문·커튼·불빛·꽃상자·창턱·반짝임이 다르다
cwin(c, 18, 56, w=8, h=12, glint=0)
cwin(c, 52, 56, w=8, h=12, curtain=True, glint=1, sill=2)
cwin(c, 86, 57, w=8, h=11, shutters='left', glint=2)
cwin(c, 18, 80, w=8, h=13, shutters='right', box=True, glint=3)
cwin(c, 52, 80, w=8, h=13, glint=2, transom=True, sill=0)
cwin(c, 86, 80, w=8, h=13, lit=True)
cwin(c, 17, 104, w=9, h=14, curtain=True, glint=0, transom=True)
cwin(c, 86, 104, w=8, h=14, box=True, glint=1, shutters='left')
# 문(가운데) + 돌 문틀 + 차양 돌
DX, DW = 50, 12
for j in range(H - 2 - 101):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, 101 + j, ch if j % 6 else 'e')
for i in range(-3, DW + 3):
    c.put(DX + i, 100, 'r' if i < DW // 2 else 'm')
    c.put(DX + i, 101, 'h' if i < DW // 2 else 'e')
door(c, DX, 102, DW, H - 2 - 102 + 1)
foundation(c, WX0, WX1, H - 2, step=(DX - 2, DX + DW + 1))
moss(c, [(5, 40, 2), (100, 38, 0)])

outline(c, 2)
print('pinholes', fill_pinholes(c))
for y in range(H):                              # 바깥 테두리의 무채색 짙은 회색 → 푸른 기 도는 재질 어두운 단
    for x in range(W):
        ch = c.get(x, y)
        if ch in 'UVWXTYZ' and any(not (0 <= x + a < W and 0 <= y + b < H) or c.get(x + a, y + b) == '.'
                                   for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.put(x, y, 'b' if (x + y) % 3 else 'a')
        elif ch == '_' and any(not (0 <= x + a < W and 0 <= y + b < H) or c.get(x + a, y + b) == '.'
                               for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.put(x, y, 'α')
mn, bad = edge_report(c, P)
print('edge min lum %.3f  near-black edge px %d %s' % (mn, len(bad), bad[:6]))
walk = []
for cy in range(8):
    r = ''
    for cx in range(7):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        r += '.' if not op else ('D' if (cx == 3 and cy in (6, 7)) else ('*' if cy < 3 else 'X'))
    walk.append(r)
print('\n'.join(walk))
meta = {'name': '지붕창 3층 집', 'massing': '17', 'material': 'plaster', 'refs': ['bd-house-manor', 'bd-house-h104_1'],
        'walk': walk}
fails, warns = c.save('dormer-house', meta)
print('fails', fails, 'warns', warns)
