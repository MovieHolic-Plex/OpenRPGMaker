"""brewery — 양조장(덩어리 모형 M32). 9×7 칸(144×112). 다시 돌리면 같은 그림. 난수 없음.
M32 그대로: 네모난 한 채 양조 홀(덧붙인 별채 없음). 손 기와 모임지붕(양 끝 모임 사선) + 오른쪽 가운데 앞 사면에서
높이 솟는 벽돌 굴뚝(위에서 본 갓돌 고리 · 어두운 연기 구멍, 밑동은 지붕 경사를 따라 비스듬히) +
높은 단층 회벽(돌 귀돌 · 잔 막돌 걸레받이) · 아치 창 셋(모두 다르게) · 아치 널문 하나 · 오른쪽 앞 바닥에 통 셋(위 타원 윗면)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, eave_shadow, door  # noqa: E402
from gf import foundation, small_rubble  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
import hand  # noqa: E402
from hand import hip_roof, barrel  # noqa: E402

# 앞 사면 띠를 대장간(smithy_town) 결처럼 밝은 주황 쪽으로(보라 그늘은 골에만)
# 낱장 변화표를 더 촘촘하게(손 표, 길이 155): 같은 8×8 기와 덩이가 되풀이되지 않게
hand.TVAR = ('01020103001200110201003010200130021001020500103002010201300100210301001020'
             '10030201002100110030201020013002010100201030010210200301020051002013001020'
             '1020310')
hand.FACES['front'] = [('π', 'ν', '<'), ('π', 'ν', '<'), ('π', '<', '$'), ('ν', '<', '$'), ('ν', '?', '@')]
from nh import cwin, stipple  # noqa: E402

W, H = 144, 112
c = Canvas(9, 7)

# ---------------------------------------------------------------- 벽돌 굴뚝(먼저 몸통을 깔고, 지붕이 밑동 아래를 덮는다)
CX0, CX1 = 86, 97            # 몸통 열(12)
CTOP = 0
BASE_L, BASE_R = 41, 44      # 밑동: 지붕 경사를 따라 왼쪽 → 오른쪽으로 내려간다
BRICK_W = [5, 3, 6, 4, 5, 2, 6, 4, 3, 5, 6, 4, 5, 3]          # 벽돌 길이(손 순서)
BRICK_F = '=?+=<?+=?=+<=?+?=+<=?=+'                            # 벽돌 바탕(손 순서)


def base_y(x):
    return BASE_L + (BASE_R - BASE_L) * (x - CX0) / (CX1 - CX0)


# ---------------------------------------------------------------- 본채 지붕(모임) — 굴뚝보다 먼저 깐다
R_Y, E_Y = 30, 66
hip_roof(c, 0, 143, R_Y, E_Y, 38, 105, seed=4)
# 용마루 윗 테 두 줄을 손 표로 흔든다(마룻대 결·이 빠진 마룻기와)
RT1 = 'ζζηζζζεζζηζζζζεζηζζζζεζ'      # 길이 23
RT2 = '--α---_--α----α-_---α--α-'     # 길이 25
for x in range(37, 107):
    c.put(x, R_Y, RT1[(x * 2) % len(RT1)])
    c.put(x, R_Y + 1, RT2[(x * 3) % len(RT2)])

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

# ---------------------------------------------------------------- 벽(높은 단층 회벽)
WX0, WX1 = 2, 141
WY0 = E_Y + 3                                  # 69
GY = 109                                       # 벽 마지막 줄
for y in range(WY0, GY + 1):
    for x in range(WX0, WX1 + 1):
        c.put(x, y, '3')
stipple(c, WX0, WY0, WX1, GY, k=1)
eave_shadow(c, WX0, WY0, WX1 - WX0 + 1, rows=('|', '-', 'c', 'f', 'l'))
# 잔 막돌 걸레받이(버들항 연보라 돌) — 문 자리는 비운다
PL0 = 99
small_rubble(c, WX0, PL0, WX1 - WX0 + 1, GY - PL0 + 1, start=4)
for x in range(WX0, WX1 + 1):                  # 걸레받이 윗돌 모(밝은 갓 줄)
    c.put(x, PL0 - 1, 'n' if x % 9 else 'k')
    c.put(x, PL0 - 2, 'w' if x % 5 else 'u')
# 귀돌(왼쪽 밝음 · 오른쪽 그늘) — 높이·너비를 손으로 엇갈리게
for (x0, lit) in ((WX0, True), (WX1 - 6, False)):
    for kq, (yy, hh) in enumerate([(73, 5), (78, 5), (83, 6), (89, 5), (94, 4)]):
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

# 창 셋(모두 다르다): 왼쪽 덧문 달린 큰 아치창 · 가운데 커튼 아치창 · 오른쪽 따뜻한 불빛(끓이는 솥)
cwin(c, 19, 78, w=10, h=19, frame='stone', shutters='both', glint=0, arch=True, sill=2, transom=True)
cwin(c, 76, 77, w=11, h=20, frame='stone', shutters='none', curtain=True, glint=3, arch=True, sill=1)
cwin(c, 98, 79, w=8, h=16, frame='stone', shutters='left', lit=True, arch=True, sill=1)
# 창 위 돌 아치 머릿돌
for (wx, ww, wy) in ((19, 10, 78), (76, 11, 77), (98, 8, 79)):
    for i in range(-1, ww + 1):
        c.put(wx + i, wy - 1, 'r' if i < ww // 2 else 'k')
    c.put(wx + ww // 2, wy - 2, 'n')
    c.put(wx + ww // 2 - 1, wy - 2, 'r')

# 처마 밑 환기 들창 둘(양조 김 빼는 나무 살창 — 크기·살 수 다르게)
def louver(x, y, w, h):
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) or j in (0, h - 1):
                ch = 'η' if (i == 0 or j == 0) else 'β'
            else:
                ch = ('θ' if i < w // 2 else 'η') if j % 2 else '_'
            c.put(x + i, y + j, ch)
    for i in range(-1, w + 1):
        c.put(x + i, y + h, 'm' if i < w // 2 else 'i')


louver(38, 74, 9, 7)
louver(120, 74, 7, 9)

# 문(열 3: 48..63) — 돌 문틀 + 아치 판자문
DX, DW = 50, 12
DY = 84
for j in range(GY + 1 - DY):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, DY + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, DY - 1, 'r' if i < DW // 2 else 'm')
    c.put(DX + i, DY - 2, 'e' if i in (-2, DW + 1) else ('n' if i < DW // 2 else 'k'))
door(c, DX, DY, DW, GY + 1 - DY)
# 문 위 둥근 통 바닥 조각(글자 없음): 나무 원판 + 쇠테
c.rows(DX + 2, 71, [
    '..ζηηζ..',
    '.ηθσξθβ.',
    'ζθσξξηεβ',
    'ηξkkkeXβ',
    'ζθηηηεεβ',
    '.ζεεεεβ.',
    '..δ__δ..',
])

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
moss(c, [(8, 56, 2), (124, 58, 2), (5, 106, 2)])

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
