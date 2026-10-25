"""예배당(chapel, 덩어리 모형 14) — 청석 모임지붕 본당 + 오른쪽 둥근 종탑(원뿔 청석 첨탑, 종창) + 앞 박공 현관(문).
11×9칸(176×144). 버들항 「흰 돌 + 청석」 결: 따뜻한 흰 마름돌·연보라 줄눈, 버들항 비늘 청석(밝은 켜 위 · 짙은 켜 아래).
다시 돌리면 같은 그림. 난수 없음. 빛 왼쪽 위."""
import math
import os
import sys

ROOT = os.path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0]
os.chdir(ROOT)
sys.path.insert(0, 'src/harnesses/building-kit')
sys.path.insert(0, 'scripts/content/building-kit/massing/work/chapel')
from massing_lib import Canvas  # noqa: E402
import pix  # noqa: E402
from bd import WarmAshlar, warm_region, slate, shift, WST  # noqa: E402

W, H = 11, 9
c = Canvas(W, H)
GN = 127          # 본당·탑 땅 줄
GP = 143          # 현관 땅 줄(한 칸 앞으로 나왔다)

# ================================================================ 본당 지붕(용마루가 정면과 나란, 양 끝 모임)
R_Y, E_Y = 54, 92         # 용마루 줄 · 처마 줄
RL, RR = 33, 106          # 용마루 서·동 끝
EX0, EX1 = 0, 138         # 처마 모서리(동쪽은 탑 뒤로 들어간다)


def rib_l(y): return RL - (RL - 3) * (y - R_Y) / (E_Y - R_Y)
def rib_r(y): return RR + (EX1 - 3 - RR) * (y - R_Y) / (E_Y - R_Y)
def edge_l(y): return RL - 2 - (RL - 2 - EX0) * (y - R_Y) / (E_Y - R_Y)
def edge_r(y): return RR + 2 + (EX1 - RR - 2) * (y - R_Y) / (E_Y - R_Y)
def in_roof(x, y): return R_Y <= y <= E_Y and edge_l(y) <= x <= edge_r(y)


def roof_shade(x, y):
    if x < rib_l(y):
        return 1
    if x > rib_r(y):
        return -1
    return 0


# 이 건물 몫: 4켜 주기 엇갈림 · 변형 표 따로
slate(c, in_roof, 0, EX1, R_Y, E_Y, split=R_Y + 21, var='naacoanacaon', stagger=(2, 0, 3, 1), shade=roof_shade, ox=1)
# 모임 갈빗대(버들항 병영처럼 갈색 마루기와)
for y in range(R_Y, E_Y + 1):
    xl, xr = int(round(rib_l(y))), int(round(rib_r(y)))
    c.put(xl, y, 'η'); c.put(xl + 1, y, 'η' if y % 5 else 'ξ')
    c.put(xr, y, '_'); c.put(xr - 1, y, '_' if y % 5 else '-')
# 용마루(얇은 마루기와)
for x in range(RL - 1, RR + 2):
    c.put(x, R_Y - 1, '-')
    c.put(x, R_Y, 'ε' if x % 6 else 'δ')
# 처마 끝
for x in range(0, EX1 + 1):
    if in_roof(x, E_Y):
        c.put(x, E_Y - 1, shift(c.get(x, E_Y - 1), -1))
        c.put(x, E_Y, 'B' if x % 4 else 'C')
        c.put(x, E_Y + 1, 'C')
# 서쪽 모임 면 바깥 테(재질 어두운 단)
for y in range(R_Y, E_Y + 1):
    x = int(edge_l(y))
    c.put(x, y, 'E')

# ================================================================ 본당 벽(따뜻한 흰 마름돌)
WX0, WX1 = 2, 137
WY0 = E_Y + 2
nave = WarmAshlar([6, 5, 6, 5, 6], seed=3, widths=[13, 9, 11, 15, 8, 12, 10, 14, 9, 11, 16, 8, 12], mortar=3)


def nave_shade(x, y):
    s = 0
    if y < WY0 + 3:
        s -= 2 if y < WY0 + 1 else 1
    if x < WX0 + 3:
        s += 1
    return s


pix.flat_wall(c, WX0, WY0, WX1 - WX0 + 1, GN - WY0 + 1, nave, shade=nave_shade)
base = WarmAshlar([4], seed=9, widths=[14, 11, 16, 12, 10, 15, 13, 9, 17], dark=2)
pix.flat_wall(c, WX0, GN - 5, WX1 - WX0 + 1, 4, base)
for x in range(WX0, WX1 + 1):
    c.put(x, GN - 6, 'n' if x % 7 else 'k')
    c.put(x, GN - 1, 'f' if x % 7 else 't')
    c.put(x, GN, 'c' if x % 6 else 'W')
# 왼쪽 모서리 귀돌(길고 짧은 돌 교대)
y, k = WY0 + 2, 0
while y < GN - 7:
    hh, ww = (6, 7) if k % 2 == 0 else (5, 4)
    for j in range(hh):
        for i in range(ww):
            if y + j >= GN - 6:
                continue
            if j == hh - 1 or i == ww - 1:
                ch = 'f'
            elif j == 0 or i == 0:
                ch = '5'
            else:
                ch = '3'
            c.put(WX0 + i, y + j, ch)
    y += hh
    k += 1

# 뾰족창: 창마다 반짝임·창턱·꽃상자 다르게
GLINTS = [((2, 2), (2, 3), (3, 10)), ((3, 3), (2, 9), (2, 10)), ((2, 1), (3, 2), (2, 12)), ((2, 4), (3, 5), (3, 11))]


def lancet(cx, y0, h, g, sill=0, box=False):
    rows = ['...rmj...',
            '..rmDmj..',
            '.rmDEDmj.']
    for i in range(h - 5):
        r = '.r'
        for xx in range(5):
            ch = 'D' if i < 6 else ('A' if (xx + i) % 4 else 'B')
            if xx == 2:
                ch = 'E'
            if i == 7:
                ch = '>'
            if i > h - 9:
                ch = 'B'
            r += ch
        rows.append(r + 'j.')
    rows.append('.nnnnnnn.' if sill == 0 else 'nnnnnnnnn')
    rows.append('.eYYYYYe.' if sill == 0 else 'eYYYYYYYe')
    c.rows(cx - 4, y0, rows)
    for (i, j) in GLINTS[g]:
        c.put(cx - 4 + i, y0 + 2 + j, '^' if j < 7 else 'F')
    if box:
        c.rows(cx - 4, y0 + h - 1, ['.zMNOMNz.', '.βηηηηηβ.'])


for wx, g, sl, bx in [(11, 0, 0, False), (73, 1, 1, True), (93, 2, 0, False), (115, 3, 1, False)]:
    lancet(wx, WY0 + 5 + (wx % 2), 18, g, sl, bx)

# ================================================================ 둥근 종탑
TCX, TR = 151.5, 17
CAPX, CAPY = 151.5, 4
CBY, CHW, CELL = 56, 21, 5
TY0 = 54
SAG = 3
tash = WarmAshlar([6, 5, 6, 6, 5, 6], seed=6, widths=[9, 12, 7, 11, 8, 13, 10, 7, 12, 9], mortar=3)


def cyl_cos(x):
    dx = x + 0.5 - TCX
    return math.sqrt(max(0.0, 1 - (dx / TR) ** 2))


def cyl_y(x, v):
    """원통 앞면 위 높이 v 의 줄이 화면에서 놓이는 y(가운데가 sag 만큼 처진다)."""
    return TY0 + v - round(SAG * (1 - cyl_cos(x)))


def cyl_extra(x, y):
    f = (x + 0.5 - TCX) / TR
    return -1 if f > 0.35 else (1 if -0.75 < f < -0.3 else 0)


pix.cyl_wall(c, TCX, TR, TY0, GN, tash, SAG, extra=cyl_extra)
# 기초(어두운 큰 돌) — 원통 바닥 곡선을 따라
tbase = WarmAshlar([4], seed=2, widths=[10, 13, 9, 12, 11], dark=2)
for x in range(int(TCX - TR), int(TCX + TR) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > TR:
        continue
    yb = cyl_y(x, GN - TY0)
    u = math.asin(max(-1, min(1, dx / TR))) * TR + 200
    for j, y in enumerate(range(yb - 5, yb - 1)):
        ch = tbase.color(u, j, pix.cyl_shade(dx, TR))
        if ch:
            c.put(x, y, ch)
    c.put(x, yb - 6, 'n' if dx < 0 else ('k' if dx < TR * 0.5 else 'i'))
    c.put(x, yb - 1, 'f' if dx < TR * 0.6 else 't')
    c.put(x, yb, 'c' if x % 6 else 'W')
# 층 띠(돌출 돌림띠, 곡선)
for x in range(int(TCX - TR), int(TCX + TR) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > TR:
        continue
    yb = cyl_y(x, 30)
    s = pix.cyl_shade(dx, TR)
    c.put(x, yb, pix.sclamp(10 + s))
    c.put(x, yb + 1, pix.sclamp(8 + s))
    c.put(x, yb + 2, pix.sclamp(4 + s))
# 종창(뾰족 아치, 안에 금 종) — 가운데보다 살짝 왼쪽(빛 쪽)
belfry = [
    '....rmj....',
    '...rmTTmj..',
    '..rmTTTTmj.',
    '..rTTUUTTj.',
    '.rTUτKτUTj.',
    '.rTτKLKτUj.',
    '.rTUKLLKτj.',
    '.rTUKLLKKj.',
    '.rTUKLKKKj.',
    '.rTKLKKKKj.',
    '.rTUττττUj.',
    '.rTTUTKUTj.',
    '.rTTTTTTTj.',
    '.rWWWWWWWj.',
    'nnnnnnnnnnj',
    'eYYYYYYYYYe',
]
c.rows(int(TCX) - 6, 67, belfry)
# 아래 좁은 창(탑 1층) — 원통 줄눈을 따라 한 칸 내린다
slit = ['.rmj.', 'rDEDj', 'r^DAj', 'rDDAj', 'rD>Aj', 'rDDAj', 'rBDBj', 'rBBBj', 'nnnnn', 'eYYYe']
c.rows(int(TCX) - 3, 98, slit)
# 원뿔 처마가 원통에 지는 그늘(곡선 2줄)
for x in range(int(TCX - TR), int(TCX + TR) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > TR:
        continue
    y0 = CBY + 1 + round(CELL * cyl_cos(x))
    for j in range(3):
        ch = c.get(x, y0 + j)
        if ch in pix.ST:
            c.put(x, y0 + j, pix.sclamp(pix.ST.index(ch) - (3 - j)))

# ================================================================ 원뿔 첨탑(청석 비늘, 꼭대기로 좁아짐)
pix.cone(c, CAPX, CAPY, CBY, CHW, CELL, seed=7, rowh=5, tw=5)
# 처마(밑 타원 앞 가장자리): 어두운 두께 2줄
for x in range(int(CAPX - CHW), int(CAPX + CHW) + 1):
    dx = x + 0.5 - CAPX
    if abs(dx) > CHW:
        continue
    yb = CBY + round(CELL * math.sqrt(max(0.0, 1 - (dx / CHW) ** 2)))
    f = dx / CHW
    c.put(x, yb, 'C')
    c.put(x, yb - 1, 'B' if f > 0.3 else ('E' if f > -0.5 else 'F'))
# 왼쪽 빛 모서리 · 오른쪽 그늘 모서리
for y in range(CAPY, CBY + 1):
    k = (y - CAPY) / (CBY - CAPY)
    xl = int(CAPX - k * CHW)
    xr = int(CAPX + k * CHW)
    if c.get(xl + 1, y) in 'CBEFGH':
        c.put(xl + 1, y, 'H' if y % 3 else 'G')
    c.put(xr, y, 'C')
    if c.get(xr - 1, y) in 'EFGH':
        c.put(xr - 1, y, 'B')
# 꼭대기 금 십자(꼭짓점에 닿는다)
c.rows(int(CAPX) - 2, 0, ['..L..', '.KLKτ', '..Kτ.', '..τ..', '..τ..', '.BEB.'])

# ================================================================ 현관(앞 박공, 한 칸 앞으로)
PX0, PX1 = 22, 57
PCX = (PX0 + PX1 + 1) / 2             # 40.0
PWY = 118                             # 현관 벽 위 끝
GAP = 100                             # 박공 삼각벽 꼭짓점
RAKE_Y = 96                           # 처마 사선 꼭짓점
VAL_Y = 71                            # 현관 마루가 본당 지붕에 닿는 꼭짓점
HALF = (PX1 - PX0 + 7) / 2            # 처마 반폭(벽 밖 3px)
HWALL = (PX1 - PX0 + 1) / 2


def ybot(x):
    return RAKE_Y + (PWY - RAKE_Y) * abs(x + 0.5 - PCX) / HALF


def ytop(x):
    return VAL_Y + (E_Y + 1 - VAL_Y) * abs(x + 0.5 - PCX) / HALF


def gtop(x):
    return GAP + (PWY - GAP) * abs(x + 0.5 - PCX) / HWALL


def porch_tile(x, y):
    """현관 지붕 기와: 용마루와 나란한 세로 열. 왼쪽 사면 밝은 열, 오른쪽 사면 어두운 열."""
    if x + 0.5 < PCX:
        d = int(PCX - 1 - x)
        col, lu = d // 4, d % 4
        v = (y + col * 3 + 1) % 6
        if lu == 3:
            return 'B' if v != 5 else 'C'
        if v == 5:
            return 'E'
        if v == 4:
            return 'F' if lu < 2 else 'E'
        if v == 0 and lu < 2:
            return 'H'
        if v == 1 and lu == 0:
            return 'H'
        return 'G' if lu < 2 else 'F'
    d = int(x - PCX)
    col, lu = d // 4, d % 4
    v = (y + col * 3 + 4) % 6
    if lu == 3:
        return 'C' if v == 5 else 'B'
    if v == 5:
        return 'B'
    if v == 0 and lu == 0:
        return 'F'
    return 'E' if lu < 2 else ('E' if v % 2 else 'B')


for y in range(VAL_Y, PWY + 2):
    for x in range(PX0 - 3, PX1 + 4):
        if abs(x + 0.5 - PCX) > HALF:
            continue
        if y < ytop(x) or y > ybot(x):
            continue
        c.put(x, y, porch_tile(x, y))
# 골(본당 지붕과 만나는 사선): 본당 쪽 그늘 1, 골 선 C, 현관 쪽 첫 줄
for x in range(PX0 - 3, PX1 + 4):
    if abs(x + 0.5 - PCX) > HALF:
        continue
    yt = int(ytop(x))
    left = x + 0.5 < PCX
    if in_roof(x, yt - 1):
        c.put(x, yt - 1, shift(c.get(x, yt - 1), -1))
    c.put(x, yt, 'C')
    c.put(x, yt + 1, 'G' if left else 'B')
# 현관 마루(꼭짓점에서 북쪽으로 물러나는 세로선)
for y in range(VAL_Y, RAKE_Y + 1):
    c.put(int(PCX) - 1, y, 'H' if y % 4 else 'G')
    c.put(int(PCX), y, 'E' if y % 4 else 'B')
# 처마 사선(비스듬한 어두운 테 + 갈색 박공널)
for x in range(PX0 - 3, PX1 + 4):
    if abs(x + 0.5 - PCX) > HALF:
        continue
    yb = int(ybot(x))
    left = x + 0.5 < PCX
    c.put(x, yb, 'δ' if left else '_')
    c.put(x, yb - 1, 'ε' if left else 'δ')
    c.put(x, yb - 2, 'E' if left else 'B')
# 현관 벽(마름돌) + 박공 삼각벽
pash = WarmAshlar([5, 6, 5, 6, 5], seed=11, widths=[8, 11, 7, 12, 9, 10, 13], mortar=3)
pix.flat_wall(c, PX0, PWY, PX1 - PX0 + 1, GP - PWY + 1, pash,
              shade=lambda x, y: (-2 if y < PWY + 2 else 0) - (1 if x > PX1 - 3 else 0) + (1 if x < PX0 + 3 else 0))
for x in range(PX0, PX1 + 1):
    dx = abs(x + 0.5 - PCX)
    if dx > HWALL:
        continue
    for y in range(int(gtop(x)) + 1, PWY):
        c.put(x, y, pash.color(x + 300, y - GAP, -1 if y < GAP + 4 else 0))
pix.flat_wall(c, PX0, GP - 4, PX1 - PX0 + 1, 3, base)
for x in range(PX0, PX1 + 1):
    c.put(x, GP - 5, 'n' if x % 6 else 'k')
    c.put(x, GP - 1, 'f' if x % 5 else 't')
    c.put(x, GP, 'c' if x % 7 else 'W')
# 박공 갓돌(삼각벽 사선 위 밝은 돌 테)
for x in range(PX0, PX1 + 1):
    if abs(x + 0.5 - PCX) > HWALL:
        continue
    gt = int(gtop(x))
    left = x + 0.5 < PCX
    c.put(x, gt, 's' if left else 'k')
    c.put(x, gt + 1, 'j' if left else 'i')
# 박공 둥근 창
c.rows(int(PCX) - 4, 104, [
    '..rmmj...',
    '.rDEDAj..',
    'rD^HEDAj.',
    'mEHsH>Aj.',
    '.rD>DAj..',
    '..jiij...',
])
# 현관 문(뾰족 아치 + 징 판자 + 쇠띠 + 금 고리) — 칸 2(x 32..47) 안
door = [
    '.....rmj......',
    '....rmτ-mj....',
    '...rm-εδ-mj...',
    '..rm-δεζδ-mj..',
    '..m-δεζηζδ-j..',
    '.rm-εζηθηε-ij.',
    '.r-δηθηθηδ-ij.',
    '.mWUUWUUWUWWj.',
    '.r-ηkθηθkη-ij.',
    '.m-ηθηθηθη-ij.',
    '.r-εθηθηθε-ij.',
    '.m-ηθηθKθη-ij.',
    '.r-ηθηKLKη-ij.',
    '.m-ηθηθKθη-ij.',
    '.r-εθηθηθε-ij.',
    '.mWUUWUUWUWWj.',
    '.r-ηkθηθkη-ij.',
    '.m-ηθηθηθη-ij.',
    '.r-δεδεδεδ-ij.',
    '.jWWWWWWWWWWi.',
    'enmmmmmmmmmmje',
    'eijjjjjjjjjjie',
    'YZZZZZZZZZZZZY',
]
c.rows(33, GP - len(door) + 1, door)
# 현관 꼭대기 돌 십자(처마 꼭짓점에 닿는다)
c.rows(int(PCX) - 2, RAKE_Y - 7, ['..r..', '.rmj.', '..mj.', '..mj.', '..kj.', '.rkji', '.ekje'])
# 현관이 오른쪽 본당 벽에 지는 그늘
for y in range(WY0, GN - 6):
    for x in range(PX1 + 4, PX1 + 7):
        ch = c.get(x, y)
        if ch in pix.ST:
            c.put(x, y, pix.sclamp(pix.ST.index(ch) - (2 if x < PX1 + 6 else 1)))
for y in range(WY0, PWY + 1):
    for x in range(PX1 + 1, PX1 + 4):
        ch = c.get(x, y)
        if ch in pix.ST:
            c.put(x, y, pix.sclamp(pix.ST.index(ch) - 3))

# ================================================================ 회색 돌 글자 → 따뜻한 흰 돌
warm_region(c, 0, 0, c.w - 1, c.h - 1)

# 원통 세로 명암 마감: 왼쪽 가장자리 테 · 왼쪽 빛 띠 · 오른쪽으로 갈수록 어두운 단
for y in range(TY0, GN + 1):
    for x in range(int(TCX - TR), int(TCX + TR) + 1):
        ch = c.get(x, y)
        if ch not in WST:
            continue
        f = (x + 0.5 - TCX) / TR
        d = -1 if f < -0.9 else (1 if -0.6 < f < -0.3 else (-1 if 0.4 < f < 0.7 else (-2 if f >= 0.7 else 0)))
        if d:
            c.put(x, y, WST[max(0, min(len(WST) - 1, WST.index(ch) + d))])

# 이끼·풍화(손으로 고른 자리)
for x, y, ch in [(3, 123, 'M'), (4, 122, 'N'), (19, 124, 'N'), (20, 123, 'M'), (60, 124, 'M'), (23, 140, 'M'),
                 (24, 139, 'N'), (56, 141, 'N'), (84, 124, 'N'), (100, 125, 'M'), (126, 124, 'M'), (127, 123, 'N'),
                 (136, 122, 'N'), (137, 123, 'M'), (165, 121, 'M'), (166, 120, 'N'), (7, 90, 'N'), (120, 91, 'M')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

# ================================================================ 바깥 윤곽: 재질 어두운 단
SLATE = 'CBEFGHI'
WARMS = set(WST) | set('0123456789tuvwxyz')
outs = []
for y in range(c.h):
    for x in range(c.w):
        ch = c.get(x, y)
        if ch == '.':
            continue
        if any(not (0 <= x + ax < c.w and 0 <= y + ay < c.h) or c.get(x + ax, y + ay) == '.'
               for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            outs.append((x, y, ch))
for x, y, ch in outs:
    if ch in SLATE:
        c.put(x, y, 'C' if ch in 'CB' else 'B')
    elif ch in pix.ST or ch in WARMS:
        c.put(x, y, 'c' if ch not in 'WUTY' else ch)
    elif ch in 'ηθξεζδ-_':
        c.put(x, y, '_')
    elif ch in 'KL':
        c.put(x, y, 'τ')

# 안쪽 투명 구멍 세기
holes = 0
for y in range(1, c.h - 1):
    for x in range(1, c.w - 1):
        if c.get(x, y) == '.' and all(c.get(x + ax, y + ay) != '.' for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            holes += 1

walk = [
    '.........*.',
    '........***',
    '........***',
    '***********',
    '***********',
    '***********',
    'XXXXXXXXXXX',
    'XXDXXXXXXXX',
    '.XDX.......',
]
if __name__ == '__main__':
    wl = [list(r) for r in walk]
    for cy in range(H):
        for cx in range(W):
            op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
            if not op:
                wl[cy][cx] = '.'
            elif wl[cy][cx] == '.':
                wl[cy][cx] = '*'
    meta = dict(name='예배당', massing='14', material='stone', refs=['bd-house-cathedral', 'bd-house-h124_0'],
                walk=[''.join(r) for r in wl])
    print('\n'.join(meta['walk']))
    print('holes', holes)
    f, w = c.save('chapel', meta)
    print('FAIL', f, 'WARN', w)
