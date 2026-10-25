"""예배당(chapel, 덩어리 모형 14) — 청석 본당 + 오른쪽 사각 종탑(종창 + 청석 첨탑) + 앞 박공 현관(문). 11×9칸.
다시 돌리면 같은 그림. 난수 없음."""
import os
import sys

ROOT = __import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0]
os.chdir(ROOT)
sys.path.insert(0, 'src/harnesses/building-kit')
sys.path.insert(0, 'scripts/content/building-kit/massing/work/chapel')
from massing_lib import Canvas  # noqa: E402
import pix  # noqa: E402
from pix import ST, SL, sclamp, Ashlar  # noqa: E402

W, H = 11, 9
c = Canvas(W, H)
GN = 127          # 본당·탑 땅 줄
GP = 143          # 현관 땅 줄(한 칸 앞으로 나왔다)

# ---------------------------------------------------------------- 본당 지붕(용마루가 정면과 나란, 서쪽 끝은 모임)
RX0, RX1 = 0, 133
RIDGE = 58
EAVE = 95
HX = 22                     # 용마루 서쪽 끝(모임 꼭짓점)
BACKY = 70                  # 서쪽 뒤 처마 모서리(위에서 보여 앞보다 높다)


def hip_x(y):
    """모임 사선(용마루 끝 → 앞 처마 모서리) 위 x."""
    return HX - (y - RIDGE) * HX / (EAVE - RIDGE)


def roof_in(x, y):
    if y < RIDGE or y > EAVE or x > RX1:
        return False
    if y < BACKY:
        return x >= HX - (y - RIDGE) * HX / (BACKY - RIDGE)
    return x >= 0


def roof_shade(x, y):
    s = 0
    if y >= EAVE - 5:
        s -= 1
    elif y < RIDGE + 12:
        s += 1
    if x > RX1 - 8:
        s -= 1
    return s


front_sh = pix.Shingles(seed=1)
hip_sh = pix.Shingles(seed=4)
pix.shingle_fill(c, 0, RIDGE + 3, RX1, EAVE, front_sh, shade=roof_shade,
                 mask=lambda x, y: roof_in(x, y) and x + 0.5 >= hip_x(y))
pix.shingle_fill(c, 0, RIDGE, RX1, EAVE, hip_sh, shade=lambda x, y: 2 if y < 86 else 1,
                 mask=lambda x, y: roof_in(x, y) and x + 0.5 < hip_x(y))
# 용마루 덮개
for x in range(HX, RX1 + 1):
    k = x % 6
    c.put(x, RIDGE, 'C')
    c.put(x, RIDGE + 1, 'H' if k in (1, 2) else ('G' if k in (3, 4) else 'F'))
    c.put(x, RIDGE + 2, 'G' if k in (1, 2, 3) else 'F')
    c.put(x, RIDGE + 3, 'E' if k else 'B')
# 모임 마루(사선): 밝은 마루기와 2px + 앞 사면 쪽 그늘 1px
for y in range(RIDGE, EAVE + 1):
    hx = hip_x(y)
    x = int(hx)
    c.put(x - 1, y, 'H' if y % 3 else 'G')
    c.put(x, y, 'G')
    if roof_in(x + 1, y):
        c.put(x + 1, y, 'E')
# 모임 면 위 끝(뒤 처마로 내려가는 사선): 어두운 단
for y in range(RIDGE, BACKY + 1):
    x = int(HX - (y - RIDGE) * HX / (BACKY - RIDGE))
    if 0 <= x < c.w:
        c.put(x, y, 'E')
# 처마: 앞 끝 두께(밝은 테 → 어두운 밑면). 모임 면 쪽 처마는 서쪽 끝 세로 선
for x in range(0, RX1 + 1):
    c.put(x, EAVE - 2, 'F' if x % 4 else 'E')
    c.put(x, EAVE - 1, 'E')
    c.put(x, EAVE, 'B' if x % 4 else 'C')
for y in range(BACKY, EAVE):
    c.put(0, y, 'E')
    c.put(1, y, 'F' if y % 4 else 'G')
# 이끼(처마 끝 몇 점)
for x, y, ch in [(6, 92, 'M'), (7, 92, 'N'), (47, 93, 'N'), (118, 92, 'M'), (119, 93, 'N')]:
    c.put(x, y, ch)

# ---------------------------------------------------------------- 본당 벽(마름돌)
WX0, WX1 = 2, 131
WY0 = 96
nave = Ashlar([6, 5, 6, 6, 5, 6], seed=4)


def nave_shade(x, y):
    s = 0
    if y < WY0 + 4:
        s -= [3, 2, 2, 1][y - WY0]
    return s


pix.flat_wall(c, WX0, WY0, WX1 - WX0 + 1, GN - WY0 + 1, nave, shade=nave_shade)
# 기초 돌(크고 어두운 막돌) + 위 모따기 줄
base = Ashlar([5], seed=9, widths=[14, 11, 16, 12, 10, 15, 13, 9, 17], dark=2)
pix.flat_wall(c, WX0, GN - 4, WX1 - WX0 + 1, 5, base)
for x in range(WX0, WX1 + 1):
    c.put(x, GN - 5, 'n' if x % 7 else 'k')
# 왼쪽 모서리 귀돌(길고 짧은 돌 교대)
QUOIN = [(6, 7), (5, 4), (6, 7), (5, 4), (6, 7), (4, 4)]


def quoins(x0, y0, y1, side):
    y = y0
    i = 0
    while y < y1:
        h, w = QUOIN[i % len(QUOIN)]
        for yy in range(y, min(y + h, y1)):
            for k in range(w):
                xx = x0 + k if side == 'L' else x0 - k
                last = yy == y + h - 1
                if last:
                    ch = 'e'
                elif side == 'L':
                    ch = 'r' if (k == 0 or yy == y) else ('n' if k < w - 1 else 'k')
                else:
                    ch = 'm' if yy == y else ('k' if k > 0 else 'j')
                    if k == w - 1:
                        ch = 'i'
                c.put(xx, yy, ch)
        y += h
        i += 1


quoins(WX0, WY0 + 3, GN - 5, 'L')


def lancet(cx, y0, h, glass=True):
    """뾰족 아치 창: 돌 테(왼쪽 밝게) + 납 띠 유리 + 반짝임 + 창턱."""
    rows = ['...rmj...',
            '..rmDmj..',
            '.rmDEDmj.',
            '.rE^D>Aj.']
    body = ['EHD>A', 'E^D>A', 'EDD>A', '>>>>>', 'EDD>A', 'E^D>A', 'EDD^A', 'EDD>A', '>>>>>',
            'EHD>A', 'EDD>A', 'E^D>A', 'EDD>A', 'EDDDA', 'EDDDA']
    for i in range(h - 6):
        b = body[i % len(body)]
        rows.append('.r' + b + 'j.')
    rows.append('.nnnnnnn.')
    rows.append('.eYYYYYe.')
    c.rows(cx - 4, y0, rows)


for wx in (13, 27, 88, 104, 120):
    lancet(wx, 100, 21)

# ---------------------------------------------------------------- 종탑(오른쪽, 정면과 한 면)
TX0, TX1 = 132, 173
TY0 = 60
tower = Ashlar([6, 6, 5, 6, 6, 5], seed=6)


def tower_shade(x, y):
    s = 0
    if y < TY0 + 3:
        s -= 2
    if 92 <= y <= 95:
        s -= 1
    return s


pix.flat_wall(c, TX0, TY0, TX1 - TX0 + 1, GN - TY0 + 1, tower, shade=tower_shade)
pix.flat_wall(c, TX0, GN - 4, TX1 - TX0 + 1, 5, base)
for x in range(TX0, TX1 + 1):
    c.put(x, GN - 5, 'n' if x % 7 else 'k')
quoins(TX0, TY0 + 2, GN - 5, 'L')
quoins(TX1, TY0 + 2, GN - 5, 'R')
# 층 띠(돌출 띠: 윗면 밝게, 밑 그늘)
for x in range(TX0 - 1, TX1 + 2):
    c.put(x, 91, 's' if x < TX0 + 3 else 'r')
    c.put(x, 92, 'n')
    c.put(x, 93, 'j')
    c.put(x, 94, 'Y')
    c.put(x, 95, 'e' if c.get(x, 95) != '.' else '.')
# 처마 돌림띠(첨탑 밑, 돌 받침 줄)
for x in range(TX0 - 3, TX1 + 4):
    k = (x - TX0 + 3) % 4
    c.put(x, 56, 'r' if x < TX0 + 2 else 'n')
    c.put(x, 57, 'm')
    c.put(x, 58, 'k' if k else 'i')
    c.put(x, 59, ('j' if k in (1, 2) else 'Y') if True else '')
    if TX0 <= x <= TX1:
        c.put(x, 60, 'a' if k in (1, 2) else 'W')
        c.put(x, 61, 'Y' if k in (1, 2) else c.get(x, 61))

# 종창(뾰족 아치, 안에 금 종)
BX = 152
belfry = [
    '.....rmj......',
    '....rmTTmj....',
    '...rmTTTTmj...',
    '..rmTTUUTTmj..',
    '..rTTUτKτUTj..',
    '..rTUτKLKτUj..',
    '..rTUKLLKτUj..',
    '..rTUKLLKKUj..',
    '..rTUKLKKKUj..',
    '..rTKLKKKKτj..',
    '..rTUττττUTj..',
    '..rTTUTKUTTj..',
    '..rTTTTTTTTj..',
    '..rTTTTTTTTj..',
    '..rTUUUUUUTj..',
    '..rWWWWWWWWj..',
    '..rWdWdWdWdj..',
    '.nnnnnnnnnnnj.',
    '.eYYYYYYYYYYe.',
]
c.rows(BX - 7, 66, belfry)
# 아래 좁은 뾰족창(탑 1층)
lancet(BX, 100, 19)

# 첨탑 + 탑 꼭대기(뒤 총안 → 걷는 바닥 → 첨탑 → 앞 총안)
SX0, SX1 = TX0 + 7, TX1 - 7          # 첨탑 밑변(28px): 양옆으로 탑 꼭대기 바닥이 보인다
APX, APY = (SX0 + SX1 + 1) / 2, 4
BY = 50                               # 첨탑 앞 처마 줄(앞 흉벽 뒤)
BACK = 37                             # 첨탑 뒤 모서리 높이
TT0, TT1 = TX0 - 3, min(c.w - 1, TX1 + 3)   # 꼭대기 폭(돌림띠 내쌓기)


def tmerlons(y0, offset, face_h, back=False):
    for x in range(TT0, TT1 + 1):
        k = (x - TT0 + offset) % 8
        if k < 5:
            c.put(x, y0, ['s', 'r', 'r', 'n', 'k'][k])
            c.put(x, y0 + 1, ['r', 'n', 'm', 'm', 'j'][k])
            for y in range(y0 + 2, y0 + 2 + face_h):
                t = [10, 9, 8, 7, 5][k] - (1 if back else 0) - (2 if y == y0 + 1 + face_h else 0)
                c.put(x, y, sclamp(t))
        else:
            yield x, k - 5


# 뒤 흉벽
for x in range(TT0, TT1 + 1):
    for y in range(36, 40):
        c.put(x, y, 'k' if y < 39 else 'i')
for x, g in tmerlons(32, 2, 3, back=True):
    c.put(x, 34, 'i')
    c.put(x, 35, 'k')
# 걷는 바닥(판석 8px): 뒤 흉벽 그늘 1줄
for y in range(40, 48):
    for x in range(TT0, TT1 + 1):
        lv = y - 40
        fx = (x + (3 if 3 < lv < 7 else 0)) % 7
        ch = 'z' if lv else 'w'
        if lv in (3, 7) or fx == 6:
            ch = 'u' if lv else 't'
        elif fx == 0:
            ch = '0' if lv else 'x'
        c.put(x, y, ch)
def in_tri(x, y, ax, ay, bx, by, cx_, cy_):
    def s(px, py, qx, qy, rx, ry):
        return (px - rx) * (qy - ry) - (qx - rx) * (py - ry)
    p = (x + 0.5, y + 0.5)
    d1 = s(*p, ax, ay, bx, by)
    d2 = s(*p, bx, by, cx_, cy_)
    d3 = s(*p, cx_, cy_, ax, ay)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


spire_sh = pix.Shingles(seed=9)
for y in range(APY, BY + 1):
    for x in range(SX0, SX1 + 1):
        front = in_tri(x, y, SX0, BY + 1, SX1 + 1, BY + 1, APX, APY)
        left = in_tri(x, y, SX0, BY + 1, SX0, BACK, APX, APY)
        right = in_tri(x, y, SX1 + 1, BY + 1, SX1 + 1, BACK, APX, APY)
        if not (front or left or right):
            continue
        i = spire_sh.idx(x - SX0, y - APY)
        if front:
            s = 0 if x < APX + 5 else -1
        elif left:
            s = 1
        else:
            s = -2
        c.put(x, y, SL[pix.shade_idx(i, s)])
# 모임 모서리(앞 모서리 두 줄): 왼쪽은 밝은 마루기와, 오른쪽은 어두운 골
for y in range(APY, BY + 1):
    k = (y - APY) / (BY + 1 - APY)
    xl = int(APX - k * (APX - SX0))
    xr = int(APX + k * (SX1 + 1 - APX)) - 1
    c.put(xl, y, 'H' if (y % 3) else 'G')
    if xl + 1 < APX:
        c.put(xl + 1, y, 'F')
    c.put(xr, y, 'B')
    if xr - 1 > APX:
        c.put(xr - 1, y, 'E' if y % 3 else 'C')
# 첨탑 처마(앞 끝 두께)
for x in range(SX0, SX1 + 1):
    c.put(x, BY - 1, 'G' if x < APX else 'F')
    c.put(x, BY, 'E')
# 앞 흉벽(첨탑 밑을 가린다): 이 윗면 2 + 앞면 5, 틈으로 바닥이 보인다
for x, g in tmerlons(48, 5, 6):
    c.put(x, 48, 'x' if g < 2 else 'z')
    c.put(x, 49, 'w' if g < 2 else 'y')
    c.put(x, 50, 'n' if g else 'k')
    c.put(x, 51, 'm')
    for y in range(52, 56):
        c.put(x, y, 'k' if y < 54 else 'i')
# 꼭대기 금 십자
c.rows(int(APX) - 2, 0, ['..L..', '.KLK.', '..K..', '..K..', '..τ..', '.ττ..'])

# ---------------------------------------------------------------- 현관(앞 박공, 한 칸 앞으로)
PX0, PX1 = 38, 73
PCX = (PX0 + PX1 + 1) / 2             # 56.0
PWY = 115                             # 현관 벽 위 끝
GAP = 98                              # 박공 삼각 꼭짓점
RAKE_Y = 92                           # 지붕 앞 꼭짓점(박공 위 처마 끝)
VAL_Y = 79                            # 지붕이 본당 지붕과 만나는 마루 끝
porch = Ashlar([6, 5, 6, 6, 5], seed=8)
pix.flat_wall(c, PX0, PWY, PX1 - PX0 + 1, GP - PWY + 1, porch,
              shade=lambda x, y: (-2 if y < PWY + 2 else 0) - (1 if x > PX1 - 3 else 0))
pix.flat_wall(c, PX0, GP - 3, PX1 - PX0 + 1, 4, base)
quoins(PX0, PWY + 2, GP - 4, 'L')
quoins(PX1, PWY + 2, GP - 4, 'R')
# 박공 삼각벽(마름돌)
for y in range(GAP, PWY):
    k = (y - GAP) / (PWY - GAP)
    half = k * (PX1 - PX0 + 1) / 2
    for x in range(int(PCX - half), int(PCX + half) + 1):
        ch = porch.color(x + 300, y - GAP, -1 if y < GAP + 4 else 0)
        c.put(x, y, ch)
# 박공 둥근 창(장미창): 어두운 유리 + 네 잎 빛
c.rows(int(PCX) - 4, 103, [
    '..rmmj...',
    '.rDEDAj..',
    'rD^HEDAj.',
    'mEHsH>Aj.',
    'rD^H>DAj.',
    '.rD>DAj..',
    '..jiij...',
])
porch_l = pix.Shingles(seed=12)
porch_r = pix.Shingles(seed=17)
# 지붕 사면 띠(박공 위 Λ): 아래 = 처마 사선, 위 = 본당 지붕과 만나는 골 사선
for y in range(VAL_Y, PWY + 2):
    for x in range(PX0 - 3, PX1 + 4):
        dx = abs(x + 0.5 - PCX)
        halfw = (PX1 - PX0 + 7) / 2
        ybot = RAKE_Y + (PWY + 1 - RAKE_Y) * (dx / halfw)       # 처마 사선
        ytop = VAL_Y + (EAVE - 1 - VAL_Y) * (dx / halfw)         # 골 사선
        if dx > halfw or y < ytop or y > ybot:
            continue
        # 박공벽보다 위(박공 사선 위 2px 이상)만 지붕
        gtop = GAP + (PWY - GAP) * (dx / ((PX1 - PX0 + 1) / 2))
        if y >= gtop - 1 and dx < (PX1 - PX0 + 1) / 2:
            continue
        left = x + 0.5 < PCX
        i = (porch_l if left else porch_r).idx(x - PX0 + 3, y - VAL_Y)
        s = 1 if left else -1
        if not left and dx > halfw - 4:
            s = -2
        c.put(x, y, SL[pix.shade_idx(i, s)])
# 박공 처마 끝(사선 따라 두께) + 갓돌
for x in range(PX0 - 3, PX1 + 4):
    dx = abs(x + 0.5 - PCX)
    halfw = (PX1 - PX0 + 7) / 2
    if dx > halfw:
        continue
    yb = int(RAKE_Y + (PWY + 1 - RAKE_Y) * (dx / halfw))
    left = x + 0.5 < PCX
    c.put(x, yb, 'B' if not left else 'E')
    c.put(x, yb - 1, 'E' if not left else 'G')
    c.put(x, yb - 2, c.get(x, yb - 2) if left else 'E')
# 골(본당 지붕과 만나는 사선): 위는 본당 기와 그늘, 선은 어둡게, 아래 현관 쪽 첫 줄은 빛
for x in range(PX0 - 3, PX1 + 4):
    dx = abs(x + 0.5 - PCX)
    halfw = (PX1 - PX0 + 7) / 2
    if dx > halfw:
        continue
    yt = int(VAL_Y + (EAVE - 1 - VAL_Y) * (dx / halfw))
    left = x + 0.5 < PCX
    if yt - 1 >= RIDGE + 4:
        c.put(x, yt - 2, 'E')
        c.put(x, yt - 1, 'B')
    c.put(x, yt, 'j' if left else 'e')      # 납 골판(회색 선) — 두 지붕의 이음
    c.put(x, yt + 1, 'C')
    c.put(x, yt + 2, 'G' if left else 'E')
# 마루(꼭짓점에서 북쪽으로 물러나는 세로선): 왼쪽 빛, 오른쪽 그늘
for y in range(VAL_Y, RAKE_Y + 1):
    c.put(int(PCX) - 2, y, 'G')
    c.put(int(PCX) - 1, y, 'H' if y % 4 else 'G')
    c.put(int(PCX), y, 'F' if y % 4 else 'E')
    c.put(int(PCX) + 1, y, 'B')
# 박공 갓돌(삼각벽 사선 위 밝은 돌 테)
for x in range(PX0, PX1 + 1):
    dx = abs(x + 0.5 - PCX)
    hw = (PX1 - PX0 + 1) / 2
    gt = int(GAP + (PWY - GAP) * (dx / hw))
    left = x + 0.5 < PCX
    c.put(x, gt - 1, 's' if left else 'n')
    c.put(x, gt, 'r' if left else 'k')
    c.put(x, gt + 1, 'j' if left else 'i')
# 현관 지붕이 오른쪽 본당 지붕·벽에 지는 그늘(빛 왼쪽 위)
DARKER = {'H': 'G', 'G': 'F', 'F': 'E', 'E': 'B'}
for x in range(int(PCX) + 1, PX1 + 9):
    dx = abs(x + 0.5 - PCX)
    halfw = (PX1 - PX0 + 7) / 2
    if dx <= halfw:
        yt = int(VAL_Y + (EAVE - 1 - VAL_Y) * (dx / halfw))
        rng = range(yt - 4, yt - 1)
    else:
        rng = range(EAVE - 3, EAVE - 1)
    for y in rng:
        if y > RIDGE + 4 and c.get(x, y) in DARKER:
            c.put(x, y, DARKER[c.get(x, y)])
for y in range(WY0, PWY + 1):
    for x in range(PX1 + 1, PX1 + 4):
        ch = c.get(x, y)
        if ch in ST:
            c.put(x, y, sclamp(ST.index(ch) - 2))
# 현관 꼭대기 돌 십자
c.rows(int(PCX) - 2, VAL_Y - 7, ['..r..', '.rmj.', '..mj.', '..mj.', '..kj.', '.ekje', '.YYYY'])

# 현관 문: 뾰족 아치 홍예 + 징 박힌 판자 + 쇠띠 + 금 고리
DX0 = 49
door = [
    '.....rmj......',
    '....rmτ-mj....',
    '...rm-εδ-mj...',
    '..rm-δεζδ-mj..',
    '..m-δεζηζδ-j..',
    '.rm-εζηθηε-ij.',
    '.r-δηθηθηδ-ij.',
    '.r-εηθηθηε-ij.',
    '.mWUUWUUWUWWj.',
    '.r-ηkθηθkη-ij.',
    '.m-ηθηθηθη-ij.',
    '.r-ηθηθηθη-ij.',
    '.m-εθηθηθε-ij.',
    '.r-ηθηθKθη-ij.',
    '.m-ηθηKLKη-ij.',
    '.r-ηθηθKθη-ij.',
    '.m-εθηθηθε-ij.',
    '.r-ηθηθηθη-ij.',
    '.mWUUWUUWUWWj.',
    '.r-ηkθηθkη-ij.',
    '.m-ηθηθηθη-ij.',
    '.r-ηθηθηθη-ij.',
    '.m-εδεδεδε-ij.',
    '.r-δεδεδεδ-ij.',
    '.jWWWWWWWWWWi.',
    'enmmmmmmmmmmje',
    'eijjjjjjjjjjie',
    'YZZZZZZZZZZZZY',
]
c.rows(DX0 - 1, GP - len(door) + 1, door)

# 이끼·풍화(손으로 고른 자리)
for x, y, ch in [(3, 123, 'M'), (4, 122, 'N'), (5, 123, 'M'), (19, 124, 'N'), (20, 123, 'M'), (60, 141, 'M'),
                 (39, 140, 'M'), (40, 139, 'N'), (72, 141, 'N'), (84, 125, 'M'), (85, 124, 'N'), (126, 124, 'M'),
                 (133, 123, 'N'), (134, 124, 'M'), (170, 125, 'M'), (171, 124, 'N'), (100, 125, 'N'), (114, 126, 'M')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

# 바깥 윤곽: 재질 어두운 단
for y in range(c.h):
    for x in range(c.w):
        ch = c.get(x, y)
        if ch == '.':
            continue
        edge = any(not (0 <= x + ax < c.w and 0 <= y + ay < c.h) or c.get(x + ax, y + ay) == '.'
                   for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if not edge:
            continue
        if ch in SL:
            c.put(x, y, 'C' if ch in 'CB' else ('E' if ch != 'H' else 'F'))
        elif ch in ST:
            i = ST.index(ch)
            c.put(x, y, ST[max(1, min(2, i - 5))])
        elif ch in 'xyz0uw':
            c.put(x, y, 't')

walk = [
    '********X**',
    '***********',
    '***********',
    '***********',
    '***********',
    '***********',
    'XXXXXXXXXXX',
    'XXXDXXXXXXX',
    '..XDX......',
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
    for cy in range(3):
        for cx in range(W):
            if wl[cy][cx] == 'X':
                wl[cy][cx] = '*'
    meta = dict(name='예배당', massing='14', material='stone', refs=['bd-house-cathedral', 'bd-mpart-tower'],
                walk=[''.join(r) for r in wl])
    print('\n'.join(meta['walk']))
    f, w = c.save('chapel', meta)
    print('FAIL', f, 'WARN', w)
