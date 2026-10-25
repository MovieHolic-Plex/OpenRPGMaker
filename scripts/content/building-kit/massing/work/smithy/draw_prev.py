"""smithy — 대장간(덩어리 모형 12). 막돌 작업장(모임지붕, 굵은 돌 굴뚝) + 오른쪽 열린 외쪽 작업칸
(기둥, 안에 불빛 도는 화덕·모루). 7×5 칸(112×80). 문 하나. 다시 돌리면 같은 그림. 난수 없음."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'guildhall'))
from lib4 import Canvas, pix, ST, sclamp, fill_walk  # noqa: E402
from common import (roof, hip_side, HIP_LIT, HIP_DARK, eave_shadow, post, window, door, rubble, moss,  # noqa: E402
                    DARKER)

W, H = 112, 80
c = Canvas(7, 5)
GY = H - 1

# ---------------------------------------------------------------- 본채 모임지붕
MX1 = 75                 # 본채 오른끝
RIDGE_Y = 12
EAVE_Y = 41
RL, RR = 22, 53
KNEE = RIDGE_Y + int((EAVE_Y - RIDGE_Y) * 0.5)
SLL = RL / (EAVE_Y - RIDGE_Y)
SRR = (MX1 - RR) / (EAVE_Y - RIDGE_Y)


def lx(y):
    return RL - (y - RIDGE_Y) * SLL


def rx(y):
    return RR + (y - RIDGE_Y) * SRR


def OUT_L(y):
    return max(0.0, (RL - 3) - (y - RIDGE_Y) * (RL - 3) / (KNEE - RIDGE_Y))


def OUT_R(y):
    return min(MX1 + 0.0, (RR + 3) + (y - RIDGE_Y) * (MX1 - RR - 3) / (KNEE - RIDGE_Y))


front = lambda x, y: lx(y) + 1 < x < rx(y) - 1  # noqa: E731
roof(c, front, 0, MX1, RIDGE_Y + 2, EAVE_Y, vshift=6, hshift=1)
hip_side(c, lambda x, y: OUT_L(y) - 0.5 <= x <= lx(y) + 1, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_LIT)
hip_side(c, lambda x, y: rx(y) - 1 <= x <= OUT_R(y) + 0.5, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_DARK, hshift=2)
for y in range(RIDGE_Y + 1, EAVE_Y + 1):
    x = int(round(lx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    c.put(x - 1, y, 'σ' if (y % 3) else 'L')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    c.put(xr + 1, y, 'θ' if (y % 3) else '%')
for y in range(RIDGE_Y + 1, EAVE_Y + 2):
    xo = int(round(OUT_L(y)))
    c.put(xo, y, '-' if y % 2 else 'α')
    xo = int(round(OUT_R(y)))
    c.put(xo, y, '-' if y % 3 else '9')
for x in range(RL - 2, RR + 3):
    c.put(x, RIDGE_Y, 'ζ' if x in (RL - 2, RR + 2) else ('σ' if x % 4 else 'ξ'))
    c.put(x, RIDGE_Y + 1, '-' if x % 4 else 'α')
for x in range(RL, RR + 1, 4):
    c.put(x, RIDGE_Y, 'L')
for x in range(0, MX1 + 1):
    c.put(x, EAVE_Y + 1, '&' if x % 4 else '9')
    c.put(x, EAVE_Y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(0, EAVE_Y + 1, 'α')

# ---------------------------------------------------------------- 굵은 돌 굴뚝(용마루 위로 솟는다)
CHX0, CHX1 = 27, 40
CH_TOP = 0
CH_BASE = 24
chim = pix.Ashlar([4, 4, 3, 4], seed=3, widths=[6, 4, 7, 5, 4, 6, 5, 7, 4, 5])
pix.flat_wall(c, CHX0, CH_TOP + 4, CHX1 - CHX0 + 1, CH_BASE - CH_TOP - 3, chim,
              shade=lambda x, y: (-2 if x < CHX0 + 2 else (-6 if x > CHX1 - 3 else -5 if x > CHX1 - 6 else -4)))
# 갓돌(윗면이 보인다: 연기 구멍 = 어두운 안)
c.rows(CHX0 - 1, CH_TOP, [
    'ijkkkkkkkkkjjie.',
    'jeTTTTTTTTTTTTaY',
    'jeUTTTTTTTTTTUaY',
    'eaaaaaaaaaaaaaYW',
][:4])
c.rows(CHX0 - 1, CH_TOP + 4, ['WYYYYYYYYYYYYYWU'])
# 밑동 물막이 + 지붕에 지는 그늘
for x in range(CHX0 - 1, CHX1 + 2):
    c.put(x, CH_BASE + 1, 'i' if x < CHX0 + 6 else 'e')
    c.put(x, CH_BASE + 2, 'a' if x in (CHX0 - 1, CHX1 + 1) else 'Y')
DK = {'L': 'ρ', 'ρ': 'π', 'π': '<', '<': '$', '?': '@', '=': '!', '+': '!', '&': '9', 'ν': '+', 'λ': '&',
      '$': '9', '@': '!', '!': '9', '9': '6', 'σ': 'ξ', 'ξ': 'η', 'ζ': '-', '-': '-', 'η': 'ζ', '_': '-', 'θ': '%',
      '%': '9'}
for y in range(RIDGE_Y, CH_BASE + 4):
    for x in (CHX1 + 2, CHX1 + 3, CHX1 + 4):
        if y > CH_BASE + 2 and x > CHX1 + 3:
            continue
        g = c.get(x, y)
        if g in DK:
            c.put(x, y, DK[g])
# 굴뚝 위 희미한 열기 대신: 갓돌 안쪽 불씨 한 점(연기 없음)
c.put(CHX0 + 5, CH_TOP + 2, 'τ')

# ---------------------------------------------------------------- 본채 벽(막돌)
WX0, WX1 = 1, MX1 - 1
WY0 = EAVE_Y + 3
eave_shadow(c, WX0, WY0, WX1 - WX0 + 1, rows=('|', '-', 'J', 'J', 'J'))
rubble(c, WX0, WY0 + 2, WX1 - WX0 + 1, GY - 1 - (WY0 + 2), [4, 3, 5, 4, 3, 4, 5, 3, 4], start=5)
# 처마 밑 그늘(막돌 위 두 줄)
for x in range(WX0, WX1 + 1):
    for y in (WY0 + 2, WY0 + 3):
        g = c.get(x, y)
        c.put(x, y, {'x': 'v', 'z': 'w', 'p': 'w', 'w': 'u', 'v': 't', 'u': 't', 'j': 'e', 'h': 'c', 'g': 'e'}.get(g, g))
for x in range(WX0, WX1 + 1):
    c.put(x, WY0, '|' if x % 5 else '_')
    c.put(x, WY0 + 1, '-' if x % 3 else '_')

# 문(왼쪽): 돌 홍예 + 아치 널문
DX0, DW = 17, 13
DY0 = 54
for (dx, dy) in [(-2, 4), (-2, 2), (-1, 0), (1, -2), (4, -3), (6, -3), (8, -3), (11, -2), (13, 0), (14, 2), (14, 4)]:
    x, y = DX0 + dx, DY0 + dy
    for j in range(2):
        for k in range(2):
            c.put(x + k, y + j, 'p' if (j == 0 and k == 0) else ('h' if j == 0 else 'e'))
for y in range(DY0 + 6, GY - 1):
    c.put(DX0 - 2, y, 'h' if y % 4 else 'e')
    c.put(DX0 - 1, y, 'e')
    c.put(DX0 + DW, y, 'd')
    c.put(DX0 + DW + 1, y, 'e' if y % 4 else 'X')
door(c, DX0, DY0, DW, GY - DY0)
# 창(문 오른쪽, 덧문)
for y in range(53, 69):
    for x in range(41, 56):
        c.put(x, y, 'h' if (x == 41 or y == 53) else 'e')
window(c, 43, 54, w=11, h=12, box=False, shutters=True)
# 창턱 아래 걸린 편자 둘
c.rows(45, 69, ['.ii.', 'i..e', 'e..e'])
c.rows(50, 69, ['.ii.', 'i..e', 'e..e'])
# 걸린 간판(모루 그림, 글자 없음) — 처마 밑 쇠 팔
for x in range(58, 72):
    c.put(x, 47, 'U' if x % 3 else 'X')
c.put(71, 46, 'X')
c.put(71, 48, 'X')
c.put(60, 48, 'e')
c.put(69, 48, 'e')
SIGN = [
    'ηηηηηηηηηηηη',
    'ηεδεεδεεδεε-',
    'ηεikkkkkkiε-',
    'ηεmrrrrrjjδ-',
    'ηεεimkkjeεε-',
    'ηδεεijjeεεδ-',
    'ηεεaeeeeaεε-',
    'ηδεXaaaaXεδ-',
    'ηεεεεεεεεεε-',
    '------------',
]
c.rows(59, 49, SIGN)
# 물통(문 왼쪽 벽에 붙은 담금질 통)
c.rows(3, 64, [
    '..ζηηηηζ..',
    '.ζ>>^>>>-.',
    '.η^>>>>>-.',
    '.ζηηηηηζ-.',
    'ηεXXXXXXε-',
    'ηηεδεηδεδ-',
    'ηηεδεηδεδ-',
    'ηηεδεηδεδ-',
    'ηεXXXXXXε-',
    '.ηεδεηδε-.',
    '.ζδδδδδδ-.',
    '..------..',
])
# 기초
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, GY, 'U' if x % 6 else 'T')
for x in range(DX0 - 1, DX0 + DW + 1):
    c.put(x, GY - 1, 'r' if x % 4 else 'm')
    c.put(x, GY, 'Z')
for x in range(3, 13):
    c.put(x, GY - 1, 'e' if x % 3 else 'a')
c.rows(3, GY - 3, ['.--------.'])
c.rows(3, GY - 2, ['ζδδδδδδδδ-'])

# ---------------------------------------------------------------- 외쪽 작업칸(동쪽으로 물매)
SX0, SX1 = MX1 + 1, W - 1
TOP0, TOP1 = 26, 38           # 지붕 윗변(본채 모임 사면에 기댄다)
VER0, VER1 = 47, 56           # 앞 박공 끝(지붕 앞 가장자리)


def ltop(x):
    return TOP0 + (x - SX0) * (TOP1 - TOP0) / (SX1 - SX0)


def lver(x):
    return VER0 + (x - SX0) * (VER1 - VER0) / (SX1 - SX0)


# 지붕: 기와 줄(남북으로 긴 세로 줄)이 동쪽으로 내려간다 — 줄마다 오른끝이 겹침 그늘
LEAN = [('ν', 'π', '?', '@'), ('λ', 'ν', '=', '!'), ('ν', 'π', '?', '@'), ('λ', 'ν', '+', '!')]
for x in range(SX0, SX1 + 1):
    yt, yv = int(round(ltop(x))), int(round(lver(x)))
    k = (x - SX0) // 5
    r = (x - SX0) % 5
    for y in range(yt + 1, yv):
        hi, lt, md, dk = LEAN[k % len(LEAN)]
        t = (y - yt + k * 2) // 4
        u = (y - yt + k * 2) % 4
        if r == 4:
            ch = dk
        elif r == 3:
            ch = md
        elif u == 3:
            ch = md if r else dk
        elif r == 0:
            ch = hi if u == 0 else lt
        else:
            ch = lt if (t + k) % 5 else 'π'
        if (t * 3 + k) % 11 == 0 and r in (1, 2) and u < 2:
            ch = 'L' if u == 0 else 'ρ'
        if y < yt + 3:
            ch = DARKER.get(ch, ch)          # 본채 처마 밑 그늘
        c.put(x, y, ch)
    # 윗변(본채 지붕에 붙는 물막이)과 앞 가장자리 두께
    c.put(x, yt, '-' if x % 3 else 'α')
    c.put(x, yv, '&' if x % 4 else '9')
    c.put(x, yv + 1, '7' if x % 4 == 1 else '%')
for y in range(int(ltop(SX1)), int(lver(SX1)) + 2):
    c.put(SX1, y, '-' if y % 2 else '9')
for y in range(TOP0 - 2, VER0 + 2):
    c.put(SX0, y, '-' if y % 3 else 'α')

# 열린 칸: 앞 들보 + 기둥 셋 + 어두운 안
BEAM_Y = lambda x: int(round(lver(x))) + 2  # noqa: E731
INX0, INX1 = SX0 + 1, SX1 - 3
for x in range(SX0, SX1 + 1):
    by = BEAM_Y(x)
    for y in range(by + 3, GY - 1):
        yy = y - (by + 3)
        # 안쪽 뒷벽: 거무스름한 막돌 + 화덕 불빛(왼쪽이 밝다)
        glow = max(0, 10 - abs(x - 86)) + max(0, 8 - abs(y - 68))
        ch = 'U' if (yy % 4 == 3 or (x + yy // 4 * 3) % 7 == 0) else 'V'
        if yy < 3:
            ch = 'T'
        if glow > 12:
            ch = '%' if ch == 'U' else '&'
        elif glow > 8:
            ch = '7' if ch == 'U' else '%'
        c.put(x, y, ch)
    c.put(x, by, 'η' if x % 6 else 'ζ')
    c.put(x, by + 1, 'ε')
    c.put(x, by + 2, 'β')
for px in (SX0, 97, SX1 - 2):
    post(c, px, BEAM_Y(px), GY - 1)

# 걸린 연장(집게·망치) — 뒷벽
for (x, y0, n) in [(103, 64, 6), (106, 63, 7)]:
    for j in range(n):
        c.put(x, y0 + j, 'e' if j else 'i')
c.rows(102, 70, ['XX.'])
c.rows(105, 63, ['aXa'])
# 화덕: 돌 단 + 불씨 + 위 쇠 갓(후드)
FORGE = [
    '..aeeeeeeeea..',
    '.aYYYYYYYYYYa.',
    '..Y%&8K8&%Y...',
    '.mrrnnrrmrrnj.',
    'mn8KLLKL8K8%ij',
    'kmK8LKLK88%&ie',
    'jmmkkmkkmkmjie',
    'ikjiijiikjijie',
    'jmkmmjkmmjkkie',
    'ieiieiieeieiYe',
    'eYYeYYeYYeYYWY',
]
c.rows(80, GY - 10, FORGE)
# 후드 위로 연통(뒷벽 안)
for y in range(BEAM_Y(86) + 3, GY - 10):
    c.put(85, y, 'Y')
    c.put(86, y, 'a')
    c.put(87, y, 'e')
    c.put(88, y, 'a')
    c.put(89, y, 'W')
# 모루(나무 받침 위)
ANVIL = [
    'rnnmmkkj.',
    'XikkjjeYY',
    '..aeeY...',
    '..XaaW...',
    '.ηζζζζ-..',
    '.ηεεδε-..',
    '.ζεεδε-..',
]
c.rows(98, GY - 7, ANVIL)
# 화덕 불빛이 기둥 안쪽·들보 밑에 비친다
for y in range(GY - 16, GY - 1):
    if c.get(SX0 + 2, y) in 'εβη':
        c.put(SX0 + 2, y, 'λ' if y % 3 else 'ν')
    if c.get(97, y) in 'εη':
        c.put(97, y, 'λ' if y % 2 else 'ε')
for x in range(SX0 + 1, 97):
    by = BEAM_Y(x) + 2
    if c.get(x, by) == 'β':
        c.put(x, by, 'θ' if x % 3 else 'ι')
# 바닥 불빛 비침
for x in range(80, 96):
    if c.get(x, GY - 1) in 'UVT':
        c.put(x, GY - 1, '%')
# 작업칸 기초
for x in range(SX0, SX1 + 1):
    c.put(x, GY, 'U' if x % 6 else 'T')
    if c.get(x, GY - 1) in 'UVT7%&':
        c.put(x, GY - 1, 'W')

moss(c, [(4, 37, 1), (60, 38, 2), (16, 22, 2), (104, 50, 2)])

walk = ['*******', '*******', '*******', 'XXXXXXX', 'XDXXXXX']
walk[3] = 'XDXXXXX'
meta = {'name': '대장간', 'massing': '12', 'material': 'stone',
        'refs': ['bd-house-smithy_town', 'bd-house-smithy'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('smithy', meta)
print('fails', fails, 'warns', warns)
