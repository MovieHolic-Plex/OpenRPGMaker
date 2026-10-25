"""manor — 저택(덩어리 모형 19). 12×8 칸 화폭, 그림은 왼쪽 11칸(0..175) — 문을 한 칸 가운데(열 5)에 두려고 축을 87.5 에 둔다.
ㄷ자 평면: 양 날개(0..47 · 128..175)가 앞으로 나와 땅선 127 에 닿고, 가운데 본채(48..127)는 물러나 벽 밑이 95 에 선다.
가운데 앞으로 조금 나온 현관(72..103, 밑 111)에 문 하나(열 5). 현관 앞 안뜰은 투명.
지붕 = 버들항 청석(병영·대성당 파랑): 본채 앞 사면은 가로 비늘 줄, 날개 모임지붕의 동서 사면은 세로 비늘 열(왼 밝음 · 오른 그늘),
남쪽 모임 삼각면은 가로 줄. 굴뚝 둘(폭·높이·갓 모양이 다르다)은 용마루 바로 아래, 위에서 본 갓돌 고리 + 연기 구멍.
벽 = 따뜻한 흰 회벽(2층) + 흰 마름돌(1층, 연보라 줄눈). 한 층 한 줄 창. 난수 없음 — 변화는 손으로 쓴 표와 좌표로만."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, door  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from nh import edge_report  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../src/harnesses/building-kit'))
from massing_lib import P  # noqa: E402

W, H = 192, 128
c = Canvas(12, 8)

# ---------------------------------------------------------------- 좌표
AX = 87.5                       # 대칭축
LW0, LW1 = 0, 47                # 왼 날개
RW0, RW1 = 128, 175             # 오른 날개
RIDGE = 12                      # 용마루(가로) 줄
WAPEX = 40                      # 날개 남쪽 모임 꼭짓점
WEAVE = 58                      # 날개 마지막 청석 줄(그 아래 처마 3줄)
CEAVE = 36                      # 본채 앞 사면 마지막 청석 줄
VALLEY_Y = CEAVE + 2            # 골이 본채 처마와 만나는 높이

# ---------------------------------------------------------------- 청석 비늘
SL = ['C', 'B', 'E', 'F', 'G', 'H', 'I']
# 비늘 한 장(가로 4 × 줄 4): 위가 밝고 아래·오른 틈이 짙다. 숫자 = SL 인덱스
SCALE = [
    [4, 4, 3, 1],
    [4, 3, 2, 1],
    [3, 2, 2, 1],
    [2, 2, 1, 1],
]
# 장마다 손으로 쓴 변화: 0 보통 · 1 새 장(밝다) · 2 묵은 장(어둡다) · 3 이 빠진 장 · 4 반짝 장
VARS = ('0102003001020000401002003000100200041000020010300020001004002010'
        '0030010200001040020010003002001000140020000102003010000201004000')
JIT = [0, 1, 0, 3, 1, 0, 2, 1, 3, 0, 1, 2]   # 줄마다 엇갈림 덧(손 순서)
UP = {2: 3, 3: 4, 4: 5, 5: 6}
DN = {6: 5, 5: 4, 4: 3, 3: 2}
SUP = {2: 3, 3: 4}               # 밝은 사면: 몸만 한 단(반짝 H 는 장 변화로만)


def scale_px(u, v, shade, seed):
    """u = 줄을 따라가는 좌표, v = 용마루에서 처마 쪽으로 내려가는 좌표."""
    row = v // 4
    lv = v % 4
    off = 2 * (row % 2) + JIT[(row + seed) % len(JIT)]
    t = (u + off) // 4
    lu = (u + off) % 4
    var = VARS[(row * 7 + t * 3 + seed * 11) % len(VARS)]
    i = SCALE[lv][lu]
    if var == '1' and lv < 2 and i > 1:
        i = UP.get(i, i)
    elif var == '2' and i > 1:
        i = DN.get(i, i)
    elif var == '3' and (lv, lu) in ((1, 1), (2, 2)):
        i = 1
    elif var == '4' and lv == 0 and lu == 0:
        i = 5 if shade > 0 else 4     # 반짝은 빛 받는 면에만
    for _ in range(abs(shade)):
        if i > 1:
            i = SUP.get(i, i) if shade > 0 else DN.get(i, i)
    return SL[i]


# ---------------------------------------------------------------- 지붕
def wing_roof(x0, outer_left):
    """날개 모임지붕: 세로 용마루(x0+23|24, RIDGE..WAPEX), 남쪽 모임 삼각면, 동서 사면(세로 비늘 열), 안쪽은 본채와 골."""
    xr = x0 + 23
    for y in range(RIDGE + 1, WEAVE + 1):
        for lx in range(48):
            x = x0 + lx
            # 바깥 어깨(뒤 모임): 바깥쪽 위 모서리를 사선으로
            d_out = lx if outer_left else 47 - lx
            if y < RIDGE + 1 + max(0, 8 - d_out):
                continue
            # 안쪽 골: 그 너머는 본채 앞 사면
            if y <= VALLEY_Y:
                if outer_left and lx > 24 + (y - RIDGE) * 23 / (VALLEY_Y - RIDGE):
                    continue
                if not outer_left and lx < 23 - (y - RIDGE) * 23 / (VALLEY_Y - RIDGE):
                    continue
            if lx <= 23:
                hip = WEAVE - lx * (WEAVE - WAPEX) / 23.0
            else:
                hip = WAPEX + (lx - 24) * (WEAVE - WAPEX) / 23.0
            if y >= hip:                                  # 남쪽 모임 삼각면: 가로 줄
                v = y - WAPEX
                s = 0 if y < WEAVE - 4 else -1
                ch = scale_px(x + 2, v + 2, s, 5 if outer_left else 9)
            elif lx <= 23:                                # 서쪽 사면: 밝은 세로 열
                v = xr - x
                s = 1 if v > 3 else 0
                ch = scale_px(y + (3 if outer_left else 0), v, s, 2 if outer_left else 7)
            else:                                         # 동쪽 사면: 그늘 세로 열
                v = x - (xr + 1)
                s = -2 if v > 2 else -1
                ch = scale_px(y + (1 if outer_left else 2), v, s, 4 if outer_left else 8)
            c.put(x, y, ch)
    # 용마루(세로, 얇은 마룻기와): 왼 빛 · 오른 그늘
    for y in range(RIDGE + 1, WAPEX + 1):
        c.put(xr, y, 'σ' if y % 5 == 2 else 'ξ')
        c.put(xr + 1, y, 'ε' if y % 4 else 'η')
    # 모임 마루(꼭짓점 → 처마 모서리)
    for y in range(WAPEX, WEAVE + 1):
        k = (y - WAPEX) * 23 / (WEAVE - WAPEX)
        xl = int(round(xr - k))
        c.put(xl, y, 'ξ' if y % 4 else 'σ')
        c.put(xl + 1, y, 'η')
        xx = int(round(xr + 1 + k))
        c.put(xx, y, 'β')
        c.put(xx - 1, y, 'ε')
    # 뒤 모임 어깨 마루
    for i in range(9):
        lx = i if outer_left else 47 - i
        y = RIDGE + 1 + (8 - i)
        c.put(x0 + lx, y, 'ξ' if outer_left else 'β')
        c.put(x0 + lx + (1 if outer_left else -1), y, 'η' if outer_left else 'ε')
    # 골(본채 앞 사면과 만나는 사선): 짙은 골 + 본채 쪽 그늘
    for y in range(RIDGE + 1, VALLEY_Y + 1):
        k = (y - RIDGE) * 23 / (VALLEY_Y - RIDGE)
        if outer_left:
            xv = int(round(x0 + 24 + k))
            c.put(xv, y, 'C')
            darken(c, xv + 1, y, 1)
        else:
            xv = int(round(x0 + 23 - k))
            c.put(xv, y, 'B')
            c.put(xv + 1, y, 'G' if y % 3 else 'H')   # 밝은 사면 가장자리 빛
    # 처마(남쪽): 빛 받은 끝 줄 + 짙은 처마 + 벽 위 그늘
    for lx in range(48):
        x = x0 + lx
        c.put(x, WEAVE + 1, 'H' if (lx + (0 if outer_left else 1)) % 3 == 0 else 'G')
        c.put(x, WEAVE + 2, 'B' if lx % 7 else 'C')
        c.put(x, WEAVE + 3, 'X' if lx % 5 else 'W')


def centre_roof():
    """본채 앞 사면(가로 비늘 줄) + 가로 용마루 + 처마. 양 끝은 날개 지붕과 골로 만난다."""
    for y in range(RIDGE + 1, CEAVE + 1):
        k = (y - RIDGE) * 23 / (VALLEY_Y - RIDGE)
        xa = int(round(LW0 + 24 + k)) + 1
        xb = int(round(RW0 + 23 - k)) - 1
        for x in range(xa, xb + 1):
            v = y - (RIDGE + 1)
            s = 1 if v < 7 else (0 if v < CEAVE - RIDGE - 5 else -1)
            c.put(x, y, scale_px(x, v, s, 0))
    for x in range(LW1 + 1, RW0):
        c.put(x, CEAVE + 1, 'H' if x % 3 == 0 else 'G')
        c.put(x, CEAVE + 2, 'B' if x % 6 else 'C')
        c.put(x, CEAVE + 3, 'X' if x % 4 else 'W')
    # 가로 용마루(얇은 마룻기와) — 바깥 어깨까지
    for x in range(LW0 + 8, RW1 - 7):
        c.put(x, RIDGE, 'σ' if x % 6 == 1 else 'ξ')
    for x in range(LW0 + 9, RW1 - 8):
        c.put(x, RIDGE + 1, 'η' if x % 5 else 'ε')


# ---------------------------------------------------------------- 벽
DOTS = [  # 회벽 점묘(손으로 씀): 이 건물 전용 결
    '......y........z......x....',
    '..z..........y.............',
    '...........0.......z.....y.',
    'y.....z...........5........',
    '..........y.....z.......0..',
    '....5.............y........',
    '.z........x....0.......z...',
    '.......y.............5.....',
    '...0..........z...y........',
]


def stucco(x0, y0, x1, y1, ox=0):
    for y in range(y0, y1 + 1):
        m = DOTS[(y + ox) % len(DOTS)]
        for x in range(x0, x1 + 1):
            ch = m[(x + ox * 5) % len(m)]
            c.put(x, y, '3' if ch == '.' else ch)


ASH_W = [9, 6, 11, 7, 8, 12, 6, 10, 7, 9, 13, 6, 8, 11, 7, 10, 9, 6, 12, 8]
ASH_F = '3p2o3q53p2o35p3o2q3p'      # 돌 바탕(따뜻한 흰 · 흰 회)
ASH_HI = {'3': '5', 'p': '2', '2': '4', 'o': 'q', 'q': 'r', '5': 's'}
ASH_LO = {'3': 'z', 'p': 'g', '2': 'z', 'o': 'l', 'q': 'o', '5': '3'}
ASH_H = [5, 4, 5, 5, 4, 5]


def ashlar(x0, y0, x1, y1, seed=0, shade=None):
    """흰 마름돌(줄 4~5px, 돌 폭 6~13px): 연보라 줄눈 'l' + 아래 그늘 'f'."""
    y = y0
    row = 0
    while y <= y1:
        h = ASH_H[(row + seed) % len(ASH_H)]
        x = x0 - [0, 5, 2, 8, 3, 6, 1][(row + seed) % 7]
        k = (row * 5 + seed * 3) % len(ASH_W)
        while x <= x1:
            w = ASH_W[k % len(ASH_W)]
            face = ASH_F[(k + row) % len(ASH_F)]
            for j in range(h):
                for i in range(w):
                    xx, yy = x + i, y + j
                    if not (x0 <= xx <= x1 and y0 <= yy <= y1):
                        continue
                    if j == h - 1 or i == w - 1:
                        ch = 'l' if j == h - 1 and i != w - 1 else 'y'
                        if j == h - 1 and (xx + row) % 9 == 0:
                            ch = 'f'
                    elif j == 0 or i == 0:
                        ch = ASH_HI[face]
                    elif j == h - 2 or i == w - 2:
                        ch = ASH_LO[face]
                    else:
                        ch = face
                    if shade and shade(xx, yy) < 0 and ch not in 'lyf':
                        ch = ASH_LO.get(ch, ch)
                    c.put(xx, yy, ch)
            x += w
            k += 1
        y += h
        row += 1


def band(x0, x1, y):
    for x in range(x0, x1 + 1):
        c.put(x, y, 's' if x % 13 else 'r')
        c.put(x, y + 1, 'p' if x % 9 else 'z')
        c.put(x, y + 2, 'y' if x % 7 else 'x')


def quoins(x, y0, y1, right):
    """모서리 귀돌(길고 짧은 돌 번갈아): 왼 모서리 밝음, 오른 모서리 그늘."""
    for y in range(y0, y1 + 1):
        k = (y - y0) // 5
        lv = (y - y0) % 5
        long_ = k % 2 == 0
        wdt = 5 if long_ else 3
        for i in range(wdt):
            xx = x - i if right else x + i
            if lv == 4:
                ch = 'l' if i < wdt - 1 else 'y'
            elif right:
                ch = ('k', 'm', 'n', 'n', 'm')[i] if lv else 'n'
            else:
                ch = ('s', 'r', 'r', 'n', 'n')[i] if lv else 's'
            c.put(xx, y, ch)


def under_eave(x0, x1, y):
    for x in range(x0, x1 + 1):
        c.put(x, y, 't' if x % 5 else 'c')
        c.put(x, y + 1, 'x' if x % 3 else 'u')
        c.put(x, y + 2, 'z' if x % 4 else 'x')


def foundation(x0, x1, y):
    """기초 3줄: 회색 받침돌 + 짙은 밑돌(벽에 붙인다)."""
    for x in range(x0, x1 + 1):
        c.put(x, y, 'j' if x % 8 else 'i')
        c.put(x, y + 1, 'e' if (x + 3) % 7 else 'a')
        c.put(x, y + 2, 'Y' if x % 5 else 'X')


def win(x, y, w=9, h=14, shutters='both', glint=0, curtain=False, box=False, sill=1, top='flat'):
    """버들항 창: 흰 테(왼·위 밝음 s, 오른 p) + 가운데 살 + 차분한 남색 유리(아래 짙은 청회) + 갈색 덧문."""
    mid = x + w // 2
    for j in range(h):
        for i in range(w):
            xx = x + i
            if top == 'arch' and j == 0 and i in (0, 1, w - 2, w - 1):
                continue
            if top == 'arch' and j == 1 and i in (0, w - 1):
                continue
            if i == 0:
                ch = 's'
            elif i == w - 1:
                ch = 'p'
            elif j == 0:
                ch = 's'
            elif j == 1 and top == 'flat':
                ch = 'p'
            elif j == h - 1:
                ch = 'z'
            elif xx == mid:
                ch = '3'
            elif j == h // 2:
                ch = 'x'
            else:
                ch = 'D' if j < h // 2 else '>'
            c.put(xx, y + j, ch)
    gx = x + 1 + glint % 2
    gy = y + 2 + glint % 3
    c.put(gx, gy, 'b')
    c.put(gx, gy + 1, '^' if glint % 3 == 0 else 'b')
    if curtain:
        for j in range(2, h - 1):
            if j != h // 2:
                c.put(x + 1, y + j, 'l' if j % 2 else 'o')
                c.put(x + w - 2, y + j, 'o' if j % 2 else 'l')
    def shut(sx, flip):
        for j in range(h):
            for k in range(2):
                if j in (0, h - 1):
                    ch = '-'
                elif k == (1 if flip else 0):
                    ch = 'β' if j % 3 else 'ε'
                else:
                    ch = '-' if j % 3 else '_'
                c.put(sx + k, y + j, ch)
    if shutters in ('both', 'left'):
        shut(x - 2, False)
    if shutters in ('both', 'right'):
        shut(x + w, True)
    for i in range(-sill, w + sill):
        if box and 0 <= i < w:
            flw = 'NκOLMκNOLM'
            c.put(x + i, y + h - 1, flw[(i + glint) % len(flw)])
            c.put(x + i, y + h, 'η' if i % 3 else 'ζ')
            c.put(x + i, y + h + 1, 'β')
        else:
            c.put(x + i, y + h, 's' if i < w // 2 else 'p')
            c.put(x + i, y + h + 1, 'y' if i < w // 2 else 'x')


def wing_wall(x0, outer_left, wins_up, wins_dn, seed):
    x1 = x0 + 47
    under_eave(x0, x1, WEAVE + 4)
    stucco(x0, WEAVE + 7, x1, 92, ox=seed)
    band(x0, x1, 93)
    ashlar(x0, 96, x1, 124, seed=seed)
    foundation(x0, x1, 125)
    quoins(x0, WEAVE + 7, 124, False)
    quoins(x1, WEAVE + 7, 124, True)
    for kw in wins_up + wins_dn:
        win(**kw)


# ---------------------------------------------------------------- 그리기
centre_roof()
wing_roof(LW0, True)
wing_roof(RW0, False)

# 본채 벽(물러남): 2층 회벽 + 1층 마름돌, 밑 95
CW0, CW1 = LW1 + 1, RW0 - 1
under_eave(CW0, CW1, CEAVE + 4)
stucco(CW0, CEAVE + 7, CW1, 67, ox=4)
band(CW0, CW1, 68)
ashlar(CW0, 71, CW1, 92, seed=3)
foundation(CW0, CW1, 93)
win(55, 46, h=13, shutters='both', glint=0)
win(83, 46, h=12, shutters='none', glint=1, top='arch', sill=0)
win(112, 46, h=13, shutters='both', glint=2, curtain=True)
win(55, 74, h=14, shutters='left', glint=4, box=True)
win(112, 74, h=14, shutters='right', glint=3)

# 날개 벽(앞으로 나옴): 층마다 창 한 줄, 창마다 다르게
wing_wall(LW0, True,
          [dict(x=10, y=67, h=14, glint=0), dict(x=29, y=67, h=14, glint=5, curtain=True)],
          [dict(x=10, y=99, h=15, glint=2, box=True, shutters='left'), dict(x=29, y=99, h=15, glint=1, shutters='both')],
          seed=1)
wing_wall(RW0, False,
          [dict(x=137, y=67, h=14, glint=3, curtain=True), dict(x=156, y=67, h=14, glint=1, shutters='right')],
          [dict(x=137, y=99, h=15, glint=4, shutters='both'), dict(x=156, y=99, h=15, glint=0, box=True)],
          seed=5)

# 날개가 본채 벽·지붕 처마에 드리운 그늘(빛 왼쪽 위): 왼 날개 → 본채 왼쪽 아래 사선, 오른 날개 모서리 1px
for y in range(CEAVE + 4, 96):
    reach = CW0 + 2 + int((y - CEAVE - 4) * 0.42)
    for x in range(CW0, reach + 1):
        darken(c, x, y, 1)
for y in range(CEAVE + 4, 96):
    darken(c, CW1, y, 1)

# 현관(72..103, 밑 111): 청석 모임지붕(꼭짓점 72, 처마 84) + 마름돌 벽 + 아치 문(열 5)
PX0, PX1 = 70, 105
PR_TOP, PAPEX, PEAVE = 62, 71, 82
pr = (PX0 + PX1) / 2.0           # 87.5
for y in range(PR_TOP, PEAVE + 1):
    for x in range(PX0, PX1 + 1):
        d = abs(x + 0.5 - pr)
        if y < PR_TOP + max(0, d - 9) * 0.6:
            continue
        lx = x - PX0
        if lx <= 17:
            hip = PEAVE - lx * (PEAVE - PAPEX) / 17.0
        else:
            hip = PAPEX + (lx - 18) * (PEAVE - PAPEX) / 17.0
        if y >= hip:
            ch = scale_px(x + 1, y - PAPEX + 1, 0 if y < PEAVE - 2 else -1, 6)
        elif lx <= 17:
            ch = scale_px(y + 2, 87 - x, 1, 3)
        else:
            ch = scale_px(y, x - 88, -1, 10)
        c.put(x, y, ch)
for y in range(PR_TOP, PAPEX + 1):
    c.put(87, y, 'σ' if y % 4 == 1 else 'ξ')
    c.put(88, y, 'ε')
for y in range(PAPEX, PEAVE + 1):
    k = (y - PAPEX) * 17 / (PEAVE - PAPEX)
    c.put(int(round(87 - k)), y, 'ξ')
    c.put(int(round(88 + k)), y, 'β')
for x in range(PX0, PX1 + 1):
    c.put(x, PEAVE + 1, 'H' if x % 3 == 1 else 'G')
    c.put(x, PEAVE + 2, 'B' if x % 5 else 'C')
    c.put(x, PEAVE + 3, 'X' if x % 3 else 'W')
for y in range(PR_TOP + 2, PEAVE + 4):    # 현관 지붕이 본채 벽에 던지는 오른쪽 그늘
    for x in (PX1 + 1, PX1 + 2):
        if c.get(x, y) not in '.':
            darken(c, x, y, 2 if x == PX1 + 1 else 1)

PW0, PW1, PT = 72, 103, PEAVE + 4          # 현관 벽 86..111
ashlar(PW0, PT, PW1, 109, seed=6, shade=lambda x, y: -1 if x > PW1 - 3 else 0)
quoins(PW0, PT, 109, False)
quoins(PW1, PT, 109, True)
for x in range(PW0, PW1 + 1):              # 현관 기초(문 아래는 문지방)
    c.put(x, 110, 'e' if x % 6 else 'a')
    c.put(x, 111, 'Y' if x % 4 else 'X')
for y in range(PT, 112):                    # 현관이 본채·안뜰 쪽으로 드리운 그늘(본채 벽 위만)
    if y <= 95:
        darken(c, PW1 + 1, y, 2)
        darken(c, PW1 + 2, y, 1)
DX, DW, DY = 82, 12, 88
for y in range(DY - 2, 112):                # 문틀 돌(왼 밝음 · 오른 그늘)
    c.put(DX - 1, y, 'r' if (y - DY) % 5 else 'l')
    c.put(DX + DW, y, 'k' if (y - DY) % 5 else 'l')
for i in range(-1, DW + 1):                 # 아치 위 쐐기돌 줄
    c.put(DX + i, DY - 2, 'r' if i < DW // 2 else 'm')
c.rows(DX + DW // 2 - 2, DY - 3, ['sr3m'])
door(c, DX, DY, DW, 112 - DY)
for x in (PW0 + 4, PW1 - 6):                # 현관 벽 작은 등(쇠 받침, 글자 없음)
    c.rows(x, PT + 5, ['.W.', 'XKX', 'WτW', '.X.'])

# ---------------------------------------------------------------- 굴뚝 둘(용마루 바로 아래, 위에서 본 갓돌 + 연기 구멍)
CH_STONE = ['3p53', 'o2pq', '5o3p', 'p3q2']


def chimney(x0, top, base, w, cap):
    for y in range(top, base + 1):
        for i in range(w):
            x = x0 + i
            j = y - top
            if j < len(cap):
                ch = cap[j][i]
                if ch == '.':
                    continue
            else:
                b = j - len(cap)
                course = b // 3
                lv = b % 3
                u = (i + (2 if course % 2 else 0)) % 4
                ch = CH_STONE[course % 4][u]
                if lv == 2 or (u == 3 and lv != 1):
                    ch = 'l'
                if i == 0:
                    ch = 'r' if lv != 2 else 'l'
                if i >= w - 2:
                    ch = {'l': 'f', '3': 'y', 'p': 'g', '5': 'z', 'o': 'l', '2': 'z', 'q': 'o', 'r': 'n'}.get(ch, ch)
                if y >= base - 1:
                    ch = 'f' if i < w - 1 else 'c'
            c.put(x, y, ch)
    for y in range(top + len(cap), base + 3):     # 지붕에 지는 그늘(오른쪽 2px + 밑)
        for x in (x0 + w, x0 + w + 1):
            if c.get(x, y) in SL:
                darken(c, x, y, 2 if x == x0 + w else 1)
    for x in range(x0 + 1, x0 + w + 2):
        if c.get(x, base + 1) in SL:
            darken(c, x, base + 1, 1)


# 왼 굴뚝: 넓고 높다, 갓돌 고리 + 큰 연기 구멍
chimney(36, 0, 18, 9, [
    '.mrrrrrm.',
    'rnTTUTTmj',
    'rnUTTTUkj',
    'ssrrnnmki',
    'eiiiiihea',
])
# 오른 굴뚝: 좁고 낮다, 판돌 갓 + 굴뚝 단지 둘
chimney(131, 3, 19, 7, [
    '.r.m.m.',
    'nTnkTk.',
    'srrnmmk',
    'jiiihea',
])

# ---------------------------------------------------------------- 마감
outline(c, 2)
print('pinholes', fill_pinholes(c))
for y in range(H):                          # 바깥 테두리 먹빛 회색 → 재질 어두운 단
    for x in range(W):
        ch = c.get(x, y)
        if ch in 'UVTW' and any(not (0 <= x + a < W and 0 <= y + b < H) or c.get(x + a, y + b) == '.'
                                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.put(x, y, 'X')
mn, bad = edge_report(c, P)
print('edge min lum %.3f  near-black edge px %d %s' % (mn, len(bad), bad[:6]))

walk = [
    '***********.',
    '***********.',
    '***********.',
    '***XXXXX***.',
    'XXXXXXXXXXX.',
    'XXXXXDXXXXX.',
    'XXX.XDX.XXX.',
    'XXX.....XXX.',
]
meta = {'name': '저택', 'massing': '19', 'material': 'stone',
        'refs': ['bd-house-manor', 'bd-house-barracks'], 'walk': walk}
fails, warns = c.save('manor', meta)
print('fails', fails, 'warns', warns)
