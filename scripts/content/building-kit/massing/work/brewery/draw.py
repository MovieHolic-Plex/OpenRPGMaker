"""brewery — 양조장(덩어리 모형 M32). 9×7 칸(144×112). 다시 돌리면 같은 그림. 난수 없음.
M32 그대로: 네모난 한 채 양조 홀(덧붙인 별채 없음). 버들항(여관·대장간) 결의 4×4 기와를 줄마다 어긋나게 손으로 깐 모임지붕
(왼 모임 밝음 · 오른 모임 그늘, 줄 띠는 처마로 갈수록 어둡다, 낱장 변화는 한 화소 단위로 잔잔하게) + 오른쪽 가운데 앞 사면에서
높이 솟는 벽돌 굴뚝(위에서 본 갓돌 고리 · 어두운 연기 구멍, 밑동은 지붕 경사를 따라 비스듬히) +
단층 회벽(한 층 ≈ 30px, 돌 귀돌 · 잔 막돌 걸레받이) · 나무 틀 창 셋(덧문 / 꽃상자 / 커튼 — 유리는 버들항 짙은 파랑) ·
아치 널문 하나 · 오른쪽 앞 바닥에 통 셋(위 타원 윗면)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, eave_shadow, door  # noqa: E402
from gf import foundation, small_rubble  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import barrel  # noqa: E402
from nh import stipple  # noqa: E402

W, H = 144, 112
c = Canvas(9, 7)

# ---------------------------------------------------------------- 벽돌 굴뚝 치수
CX0, CX1 = 86, 97            # 몸통 열(12)
CTOP = 0
BASE_L, BASE_R = 47, 50      # 밑동: 지붕 경사를 따라 왼쪽 → 오른쪽으로 내려간다
BRICK_W = [5, 3, 6, 4, 5, 2, 6, 4, 3, 5, 6, 4, 5, 3]          # 벽돌 길이(손 순서)
BRICK_F = '=?+=<?+=?=+<=?+?=+<=?=+'                            # 벽돌 바탕(손 순서)


def base_y(x):
    return BASE_L + (BASE_R - BASE_L) * (x - CX0) / (CX1 - CX0)


# ---------------------------------------------------------------- 본채 모임지붕(버들항 4×4 기와)
R_Y, E_Y = 34, 74            # 용마루 · 처마(마지막 기와 줄)
RL, RR = 38, 105             # 용마루 양 끝
X0, X1 = 0, 143
KNEE = R_Y + 22
# 낱장 모양(여관 결): B 몸 · D 골 그늘 · L 빛 받은 돌기
TILE = ['BDBL', 'BDLL', 'DDLL', 'BBDB']
# 줄 띠(위 → 처마): (L, B, D) — 면마다
BANDS = {
    'front': [('π', '<', '&'), ('π', '<', '&'), ('κ', '?', '&'), ('κ', '?', '%'), ('κ', '=', '%'), ('ν', '=', '%'),
              ('ν', '+', '7'), ('λ', '+', '7')],
    'lit':   [('ρ', 'π', '<'), ('ρ', 'π', '<'), ('ρ', 'π', '?'), ('π', 'π', '?'), ('π', 'κ', '?'), ('π', 'κ', '=')],
    'dark':  [('<', '&', '%'), ('<', '&', '%'), ('?', '&', '%'), ('?', '+', '7'), ('=', '%', '7'), ('=', '%', '7')],
}
ONE_UP = {'π': 'ρ', 'ν': 'π', 'λ': 'ν', 'κ': 'π', '?': '<', '=': '?', '+': '=', '&': '+', '%': '&', '7': '%',
          'ρ': 'ρ', '<': 'π'}
ONE_DN = {'π': 'κ', 'ν': 'λ', 'λ': 'λ', 'κ': 'ν', '?': '=', '=': '+', '+': '&', '&': '%', '%': '7', '7': '7',
          'ρ': 'π', '<': '?'}
# 줄 어긋남(손 순서): 0 또는 2 를 주로, 가끔 1·3
ROW_OFF = [0, 2, 0, 2, 1, 3, 0, 2, 0, 2, 3, 1, 0, 2, 2, 0, 1, 3, 2, 0]
# 낱장 변화(손 표, 길이 61 — 소수): 0 보통 · 1 돌기 한 화소 더(새 기와) · 2 돌기 한 화소 이 빠짐 ·
# 3 몸 한 단 밝게 · 4 몸 한 단 어둡게(묵은 기와) · 5 골 한 화소 얕게
TV = '0130204105230140310250413020510342015030241035012403105204130'


def tile_at(face, x, y, y0, y1, seed):
    k = (y - y0) // 4
    r = (y - y0) % 4
    bands = BANDS[face]
    nb = max(1, (y1 - y0 + 4) // 4)
    L, B, D = bands[min(len(bands) - 1, k * len(bands) // nb)]
    off = ROW_OFF[(k + seed) % len(ROW_OFF)]
    t = (x + off) // 4
    u = (x + off) % 4
    v = TV[(t * 5 + k * 17 + seed * 7) % len(TV)]
    ch = TILE[r][u]
    if v == '1' and r == 0 and u == 2:
        ch = 'L'
    elif v == '2' and r == 2 and u == 2:
        ch = 'B'
    elif v == '5' and r == 1 and u == 1:
        ch = 'B'
    col = {'L': L, 'B': B, 'D': D}[ch]
    if v == '3' and ch == 'B':
        col = ONE_UP[col]
    elif v == '4' and ch == 'B':
        col = ONE_DN[col]
    return col


def lx(y):
    return RL - (y - R_Y) * (RL - X0) / (E_Y - R_Y)


def rx(y):
    return RR + (y - R_Y) * (X1 - RR) / (E_Y - R_Y)


def out_l(y):
    return max(float(X0), (RL - 2) - (y - R_Y) * (RL - 2 - X0) / (KNEE - R_Y))


def out_r(y):
    return min(float(X1), (RR + 2) + (y - R_Y) * (X1 - RR - 2) / (KNEE - R_Y))


for y in range(R_Y + 1, E_Y + 1):
    for x in range(X0, X1 + 1):
        if lx(y) < x < rx(y):
            if y >= R_Y + 3:
                c.put(x, y, tile_at('front', x, y, R_Y + 3, E_Y, 0))
        elif out_l(y) - 0.5 <= x <= lx(y):
            c.put(x, y, tile_at('lit', x, y, R_Y + 1, E_Y, 3))
        elif rx(y) <= x <= out_r(y) + 0.5:
            c.put(x, y, tile_at('dark', x, y, R_Y + 1, E_Y, 7))
# 모임 마루(왼 빛 받는 마룻기와 · 오른 짙은 선)
for y in range(R_Y + 1, E_Y + 1):
    x = int(round(lx(y)))
    c.put(x - 1, y, 'σ' if y % 3 else 'ρ')
    c.put(x, y, 'ξ')
    c.put(x + 1, y, 'η')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, 'η')
    c.put(xr, y, 'ε')
    c.put(xr + 1, y, '_')
# 용마루: 마룻대 + 마룻기와 줄(낱장 길이를 손으로 다르게)
RT1 = 'ζζηζζζεζζηζζζζεζηζζζζεζ'      # 길이 23
RT2 = '--α---_--α----α-_---α--α-'     # 길이 25
RT3 = 'ρπρρπρκπρρπρρπρπρρκρρρππρρ'    # 길이 26
for x in range(RL - 1, RR + 2):
    c.put(x, R_Y, RT1[(x * 2) % len(RT1)])
    c.put(x, R_Y + 1, RT2[(x * 3) % len(RT2)])
    c.put(x, R_Y + 2, RT3[(x * 5) % len(RT3)])
# 처마: 기와 끝 두 줄(짙은 테)
for x in range(X0, X1 + 1):
    c.put(x, E_Y + 1, '&' if x % 4 else '%')
    c.put(x, E_Y + 2, '7' if x % 3 else '%')

# 굴뚝 몸: 3px 줄(벽돌 2 + 줄눈 1), 줄마다 어긋나게, 왼쪽 빛·오른쪽 그늘
body_top = CTOP + 6
y = body_top
k = 0
n = 3
while y <= BASE_R:
    x = CX0 - (k * 3 + 1) % 5
    wi = (k * 5) % len(BRICK_W)
    while x <= CX1:
        bw = BRICK_W[wi % len(BRICK_W)]
        wi += 1
        f = BRICK_F[n % len(BRICK_F)]
        n += 1
        for j in range(3):
            for i in range(bw):
                px, py = x + i, y + j
                if px < CX0 or px > CX1 or py > base_y(px):
                    continue
                if j == 2 or i == bw - 1:
                    ch = 'c' if (px + py) % 4 else 'Y'          # 회색 줄눈
                else:
                    ch = f
                    if j == 0 and i == 0:
                        ch = 'κ' if f in '<?' else '<'          # 벽돌 왼 위 모 빛
                    if px >= CX1 - 2:
                        ch = {'=': '&', '?': '+', '+': '&', '<': '=', 'κ': '?'}.get(ch, ch)
                    if px >= CX1 - 1 and j == 1:
                        ch = '%'
                    if px <= CX0 + 1 and ch in '+=&':
                        ch = '?'
                c.put(px, py, ch)
        x += bw
    y += 3
    k += 1
for py in range(body_top, BASE_R + 1):          # 몸통 테: 왼 밝은 · 오른 짙은
    if py <= base_y(CX0):
        c.put(CX0, py, 'κ' if py % 5 else '<')
    if py <= base_y(CX1):
        c.put(CX1, py, '7' if py % 4 else '%')
# 갓돌(위에서 본 고리 + 어두운 연기 구멍) — 몸보다 한 화소씩 넓다
CAP = [
    '.YkkkkkkkkkkY.',
    'YnrmmmmmmmmkjY',
    'YnkUTTTTTTUjia',
    'YnjVTTTTTTVihX',
    'YrkjjiiiiihheX',
    'XmmmkkkkjjiieW',
    '.XiihhhheeeaX.',
]
c.rows(CX0 - 1, CTOP, CAP)
c.put(CX0 + 3, CTOP + 2, 'X')                 # 연기 구멍 속 그을음 결
c.put(CX0 + 7, CTOP + 3, 'U')
# 갓돌 밑 그늘 한 줄(몸에)
for x in range(CX0, CX1 + 1):
    darken(c, x, CTOP + 7, 1)
# 밑동: 지붕 경사를 따라 비스듬히 — 바로 아래 지붕 1~2줄은 그늘, 오른쪽 지붕에 그늘 2열
for x in range(CX0, CX1 + 4):
    yb = int(round(base_y(min(x, CX1))))
    darken(c, x, yb + 1, 2)
    darken(c, x, yb + 2, 1)
for py in range(body_top + 2, BASE_R + 2):
    darken(c, CX1 + 1, py, 2)
    darken(c, CX1 + 2, py, 1)

# ---------------------------------------------------------------- 벽(단층 회벽, 한 층 ≈ 30px)
WX0, WX1 = 2, 141
WY0 = E_Y + 3                                  # 77
GY = 109                                       # 벽 마지막 줄
for y in range(WY0, GY + 1):
    for x in range(WX0, WX1 + 1):
        c.put(x, y, '3')
stipple(c, WX0, WY0, WX1, GY, k=1)
eave_shadow(c, WX0, WY0, WX1 - WX0 + 1, rows=('|', '-', 'c', 'f'))
# 잔 막돌 걸레받이(버들항 연보라 돌)
PL0 = 101
small_rubble(c, WX0, PL0, WX1 - WX0 + 1, GY - PL0 + 1, start=4)
for x in range(WX0, WX1 + 1):                  # 걸레받이 윗돌 모
    c.put(x, PL0 - 1, 'n' if x % 9 else 'k')
    c.put(x, PL0 - 2, 'w' if x % 5 else 'u')
# 귀돌(왼쪽 밝음 · 오른쪽 그늘)
for (x0, lit) in ((WX0, True), (WX1 - 6, False)):
    for kq, (yy, hh) in enumerate([(81, 5), (86, 6), (92, 5)]):
        ww = 7 if kq % 2 == 0 else 4
        xs = x0 if lit else x0 + (7 - ww)
        for j in range(hh):
            for i in range(ww):
                if j == hh - 1 or (i == ww - 1 if lit else i == 0):
                    ch = 'J' if lit else 'c'
                elif j == 0:
                    ch = 'r' if lit else 'k'
                else:
                    ch = ('n' if (i + j + kq) % 6 else 'm') if lit else ('i' if (i + j) % 5 else 'h')
                c.put(xs + i, yy + j, ch)


# 창: 나무 틀(바깥 짙은 테 β · 안 틀 왼/위 밝음) + 버들항 짙은 파랑 유리 + 작은 반짝임 + 십자 살 + 나무 창턱
def win(x, y, w, h, glint, kind):
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) or j in (0, h - 1):
                ch = 'β' if (i == w - 1 or j == h - 1) else 'ζ'
            elif i == 1 or j == 1:
                ch = 'η'
            elif i == w - 2 or j == h - 2:
                ch = 'ε'
            elif i == w // 2 or j == h // 2:
                ch = 'ε'
            else:
                ch = 'D' if j < h // 2 else 'B'
                if j == 2:
                    ch = 'E'
            c.put(x + i, y + j, ch)
    gx, gy = glint
    c.put(x + gx, y + gy, '^')
    c.put(x + gx + 1, y + gy, 'F')
    c.put(x + gx, y + gy + 1, 'F')
    c.put(x + w - 4, y + h // 2 + 2, '>')
    if kind == 'curtain':
        for j in range(2, h - 2):
            if j == h // 2:
                continue
            c.put(x + 2, y + j, '&' if j % 3 else '+')
            c.put(x + w - 3, y + j, '+' if j % 3 else '&')
    if kind == 'shutters':
        for side, sx in ((0, x - 4), (1, x + w)):
            for j in range(h):
                for i in range(4):
                    if i == (3 if side == 0 else 0):
                        ch = '_'
                    elif j in (0, h - 1):
                        ch = 'δ'
                    else:
                        ch = ('η' if i == (0 if side == 0 else 1) else 'ε') if j % 4 else 'δ'
                    c.put(sx + i, y + j, ch)
    # 창턱(나무, 끝이 짙은 테)
    for i in range(-1, w + 1):
        c.put(x + i, y + h, 'η' if i < w // 2 else 'ζ')
        c.put(x + i, y + h + 1, 'δ' if 0 <= i < w else '-')
    if kind == 'box':
        flw = 'MκNLMκOLNMκN'
        for i in range(w):
            c.put(x + i, y + h - 1, flw[i % len(flw)])
            c.put(x + i, y + h - 2, 'N' if i % 3 == 1 else c.get(x + i, y + h - 2))
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'η' if i % 4 else 'ζ')
            c.put(x + i, y + h + 1, 'δ')
            c.put(x + i, y + h + 2, '-')


win(18, 83, 10, 14, (2, 2), 'shutters')
win(74, 82, 11, 15, (3, 2), 'box')
win(97, 83, 10, 14, (2, 3), 'curtain')

# 문(열 3: 48..63) — 돌 문틀 + 아치 판자문
DX, DW = 50, 12
DY = 86
for j in range(GY + 1 - DY):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, DY + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, DY - 1, 'r' if i < DW // 2 else 'm')
    c.put(DX + i, DY - 2, 'e' if i in (-2, DW + 1) else ('n' if i < DW // 2 else 'k'))
door(c, DX, DY, DW, GY + 1 - DY)

# 벽에 기댄 맥아 자루 둘(바닥에 닿는다, 문 왼쪽)
c.rows(37, 100, [
    '..ξσξ...',
    '.ξLσσξ..',
    'ξσσσξηε.',
    'ξσLσσηε.',
    'ησσσξηεδ',
    'ηξσσξηεδ',
    'ηξξξηεδδ',
    'ηξσξξηεδ',
    'δηηηηεδ-',
    '.δδδδ-_.',
])
c.rows(32, 102, [
    '.ξσξ.',
    'ξσLξη',
    'ξσσξη',
    'ηξσηε',
    'ηξξηε',
    'ηξηηε',
    'δηηεδ',
    '.δδ-.',
])

foundation(c, WX0, WX1, GY + 1, step=(DX - 2, DX + DW + 1))

# ---------------------------------------------------------------- 오른쪽 앞 통 셋(위 타원 윗면, 바닥 줄까지)
barrel(c, 108, 92, w=13, h=19, lid='σ')
barrel(c, 130, 95, w=12, h=16)
barrel(c, 119, 94, w=13, h=17, lid='ξ')
for x in range(108, 142):                       # 통 밑 그늘(땅)
    if c.get(x, 111) != '.':
        darken(c, x, 111, 1)

# 풍화·이끼(지붕 그늘진 곳 · 걸레받이)
moss(c, [(5, 106, 2)])

outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

walk = []
for cy in range(7):
    r = ''
    for cx in range(9):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 3 and cy in (5, 6):
            r += 'D'
        else:
            r += '*' if cy < 4 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='양조장', massing='M32', material='plaster', refs=['bd-house-smithy_town', 'bd-house-ware0'],
            walk=walk)
f, w = c.save('brewery', meta)
print('FAIL', f, 'WARN', w)
