"""keep-tower — 사각 성탑(덩어리 모형 20). 5×9 칸(80×144).
높은 사각 탑: 따뜻한 잔 막돌 몸통 + 회색 마름돌 귀돌, 위는 위에서 내려다본 넓은 흉벽 바닥(사방 흉벽 윗면 띠 +
판석 바닥) 위에 계단 구멍을 덮는 기둥 넷 작은 지붕(문·벽 없음, 제 3/4 모임지붕·그림자), 앞 흉벽은 이(윗면 5줄 + 앞면) 와 총안.
화살창은 짙은 돌 테, 아래 아치 문. 다시 돌리면 같은 그림. 난수 없음."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import Ashlar, sclamp  # noqa: E402
import pix  # noqa: E402
from common import Canvas, moss, plaster, post  # noqa: E402
from gf import small_rubble  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import hip_roof, barrel  # noqa: E402
from nh import cwin, stipple, edge_report  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../src/harnesses/building-kit'))
from massing_lib import P  # noqa: E402

W, H = 80, 144
c = Canvas(5, 9)
GY = H - 1

PX0, PX1 = 0, 79          # 흉벽 바깥(받침돌로 몸통보다 내민다)
BX0, BX1 = 4, 75          # 몸통
PW = 6                    # 흉벽 두께(위에서 본 윗면 띠)
BACK = 0                  # 뒤 흉벽 윗면 시작
FLOOR0 = 9                # 바닥 시작(뒤 흉벽 안쪽 면 아래)
MER = 45                  # 앞 흉벽 이 윗면
BODY = 65                 # 몸통 시작

# ---------------------------------------------------------------- 몸통: 잔 막돌 + 귀돌
body_ash = Ashlar([6, 5, 6, 6, 5, 6, 5, 6, 6, 5, 6], seed=4, warm=False,
                  widths=[9, 7, 11, 8, 6, 10, 9, 12, 7, 10, 8, 6, 11, 9, 7, 10, 8, 12, 6, 9])


def body_shade(x, y):
    f = (x - BX0) / (BX1 - BX0)
    s = 1 if f < 0.15 else (0 if f < 0.5 else (-1 if f < 0.75 else -2))
    if y < BODY + 3:
        s -= 1
    return s


pix.flat_wall(c, BX0, BODY, BX1 - BX0 + 1, GY - 3 - BODY + 1, body_ash, shade=body_shade)
q = Ashlar([6, 5, 6, 5, 6, 6], seed=2, widths=[9, 6, 8, 5, 9, 7, 6, 8])
for y in range(BODY, GY - 2):                 # 귀돌: 왼쪽 밝은 회색, 오른쪽 그늘 회색 — 길고 짧은 돌 번갈아
    k = (y - BODY) // 6
    lv = (y - BODY) % 6
    lw = 8 if k % 2 == 0 else 5
    for i in range(lw):
        if lv == 5 or i == lw - 1:
            ch_l, ch_r = 'e', 'a'
        elif lv == 0:
            ch_l, ch_r = 'r', 'k'
        else:
            ch_l = 'n' if i < lw - 2 else 'k'
            ch_r = 'j' if i < lw - 2 else 'i'
        c.put(BX0 + i, y, ch_l)
        c.put(BX1 - i, y, ch_r if i else 'h')
# 기초: 크고 어두운 돌 + 땅 닿는 줄
base = Ashlar([3, 3], seed=7, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
pix.flat_wall(c, BX0 - 1, GY - 5, BX1 - BX0 + 3, 4, base, shade=lambda x, y: -1 if x > BX1 - 3 else 0)
for x in range(BX0 - 1, BX1 + 2):
    c.put(x, GY - 1, 'a' if x % 7 else 'Y')
    c.put(x, GY, 'X' if x % 6 else 'W')

# 화살창: 돌 테(밝은 왼모·어두운 오른모) 속 짙은 회색 틈(먹 아님)
SLIT_CROSS = [                 # 십자 화살창(가운데)
    '.rnnmj.',
    '.nWUWe.',
    '.nWUWe.',
    'rnaUamj',
    'nUUUUUa',
    'mjaUaei',
    '.nWUWe.',
    '.nWUWe.',
    '.nWUWe.',
    '.nWUWe.',
    '.kYUYa.',
    '.kiiea.',
]
SLIT_PLAIN = [                 # 곧은 긴 틈(왼쪽): 위가 둥근 돌 머리
    '.rnmj.',
    'rnUWmj',
    'nWUUWe',
    'nWUUWe',
    'nWUUWe',
    'nWUUWe',
    'nWUUWe',
    'nWUUWe',
    'nWUUWe',
    'nWUUWe',
    'kYXXYa',
    'kiieea',
]
SLIT_ROUND = [                 # 짧은 틈 + 아래 둥근 구멍(오른쪽, 그늘 쪽이라 테가 한 단 어둡다)
    '.mkkj.',
    '.kWUe.',
    '.kWUe.',
    '.kWUe.',
    '.kWUe.',
    'mkWUjj',
    'kWUUWe',
    'kWUUWa',
    'jkYXaa',
    '.jiea.',
]
c.rows(37, 74, SLIT_CROSS)
c.rows(16, 90, SLIT_PLAIN)
c.rows(58, 95, SLIT_ROUND)

# 아치 문(돌 홍예 + 징 박힌 판자) — 열 2(32..47) 안
DX = 33
c.rows(DX - 2, 114, [
    '.....srrmmj......',
    '...srmaaaamrj....',
    '..srma----amrj...',
    '.srma-δεεδ-amri..',
    '.rma-δεζηεδ-ami..',
    'srm-δηθηθηθδ-mj..',
    'rma-εθηθηθηε-aj..',
    'rm-εηθηθηθηε-ij..',
    'nm-ηθηθηθηθη-jj..',
    'rm-εkηεηεηkε-ij..',
    'nm-ηθηθηθηθη-jj..',
    'rm-εδεδεδεδε-ij..',
    'nmWUUWUUWUUWjj...',
    'rm-ηkθηθηθkη-ij..',
    'nm-ηθηθηθηθη-jj..',
    'rm-εθηθηKθηε-ij..',
    'nm-ηθηθKLKθη-jj..',
    'rm-ηθηθηKθηη-ij..',
    'nm-εδεδεδεδε-jj..',
    'rmWUUWUUWUUWij...',
    'nm-ηkθηθηθkη-jj..',
    'rm-ηθηθηθηθη-ij..',
    'nm-εδεδεδεδε-jj..',
    'rm-δεδεδεδεδ-ij..',
    'ijWWWWWWWWWWWij..',
    'nmmmmmmmmmmmmje..',
    'Ziiiiiiiiiiiiie..',
    'YZZZZZZZZZZZZZY..',
    'UXXXXXXXXXXXXXU..',
    'WUUUUUUUUUUUUUW..',
])

# ---------------------------------------------------------------- 받침돌 띠(내쌓기)
CB = MER + 13
for x in range(PX0, PX1 + 1):
    k = (x - PX0) % 6
    dark = x > PX1 - 7
    lit = x < 9
    c.put(x, CB, 'r' if not dark else 'k')
    c.put(x, CB + 1, ('m' if k else 'j') if not dark else 'j')
    if BX0 <= x <= BX1:
        for d in range(CB + 2, BODY):
            j = d - CB - 2
            if k in (1, 2, 3, 4):
                t = (11 if j == 0 else (9 if k == 1 else 8) - j) - (2 if dark else 0) + (1 if lit else 0)
                if k == 4:
                    t -= 2
            else:
                t = 1 if j > 0 else 3
            c.put(x, d, sclamp(t))
        darken(c, x, BODY, 2 if (x - PX0) % 6 in (0, 5) else 1)
    else:
        c.put(x, CB + 2, 'e' if x < 9 else 'a')
        c.put(x, CB + 3, 'a' if x < 9 else 'Y')

# ---------------------------------------------------------------- 맨 위: 흉벽 고리(윗면 띠) · 판석 바닥 · 망루 · 앞 흉벽
FL0, FL1 = PX0 + PW, PX1 - PW
# 판석 바닥(위에서 본 큰 판석: 13×8 판, 줄마다 반 판 엇갈림, 얕은 줄눈 — 벽 돌처럼 촘촘하지 않게)
SLAB = 'mkmjnmkjmkmn'
for y in range(FLOOR0, MER + 4):
    lv = y - FLOOR0
    for x in range(FL0, FL1 + 1):
        r = lv // 6
        fy = lv % 6
        sx = x + ((5, 2, 8, 0, 6, 3)[r % 6])
        fx = sx % 10
        tone = SLAB[(sx // 10 + r * 5) % len(SLAB)]
        if fy == 5 or fx == 9:
            ch = 'e'
        elif fy == 0 and fx < 8:
            ch = {'m': 'n', 'k': 'm', 'j': 'k', 'n': 'r'}[tone]
        elif fx == 8:
            ch = {'m': 'k', 'k': 'j', 'j': 'i', 'n': 'm'}[tone]
        else:
            ch = tone
        c.put(x, y, ch)
for (x, y) in [(14, 19), (15, 20), (66, 41), (60, 14), (61, 14), (40, 42), (41, 41)]:   # 잔금·얼룩(손 자리)
    c.put(x, y, 'i')
# 흉벽 안쪽 그늘: 뒤 흉벽 아래 2줄, 왼 흉벽 오른쪽 2열
for x in range(FL0, FL1 + 1):
    darken(c, x, FLOOR0, 2)
    darken(c, x, FLOOR0 + 1, 1)
for y in range(FLOOR0, MER):
    darken(c, FL0, y, 2)
    darken(c, FL0 + 1, y, 1)


def ring_top(x, y, side):
    """흉벽 윗면(위에서 본 갓돌): 바깥 모 밝게, 안 모 어둡게, 6~9 화소마다 갓돌 이음."""
    pass


# 옆 흉벽 윗면 띠(6화소) — 왼쪽 밝은 회색, 오른쪽 그늘 회색. 이음은 9줄마다.
for y in range(BACK, MER + 5):
    seam = (y - BACK) % 9 == 8
    for i in range(PW):
        L = ('k', 's', 'r', 'r', 'n', 'j')[i]
        R = ('j', 'm', 'n', 'n', 'k', 'a')[PW - 1 - i] if False else ('a', 'k', 'n', 'n', 'm', 'j')[i]
        c.put(PX0 + i, y, 'e' if seam else L)
        c.put(PX1 - i, y, 'Y' if seam else R)
# 뒤 흉벽: 윗면 띠(갓돌 4줄) + 안쪽 남향 면(바닥 위로 선 낮은 벽 5줄, 막돌)
for x in range(FL0, FL1 + 1):
    seam = (x - FL0) % 10 == 9
    for j, ch in enumerate(('n', 's', 'r', 'r')):
        c.put(x, BACK + j, 'e' if seam else (ch if x < 60 else {'n': 'k', 's': 'n', 'r': 'm'}[ch]))
back_ash = Ashlar([5], seed=8, warm=False, widths=[8, 11, 7, 10, 9, 12, 8, 10])
pix.flat_wall(c, FL0, BACK + 4, FL1 - FL0 + 1, FLOOR0 - BACK - 4, back_ash, shade=lambda x, y: -1)
for x in range(FL0, FL1 + 1):
    darken(c, x, BACK + 4, 1)
    darken(c, x, FLOOR0 - 1, 1)
# 뒤 흉벽 이: 갓돌 띠 위 두 줄을 총안 자리만 비운다(실루엣에 이가 선다)
for x in range(PX0, PX1 + 1):
    if (x - PX0 + 4) % 13 >= 9 and PW + 2 <= x <= PX1 - PW - 2:
        c.put(x, 0, '.')
        c.put(x, 1, '.')
        c.put(x, 2, 'k')

# 계단 덮개: 바닥 가운데 뒤쪽의 계단 구멍 위에 네 기둥 + 작은 모임지붕(문·벽 없음, 옆이 트였다) + 바닥에 그림자
LX0, LX1 = 24, 55
LWY0, LWY1 = 25, 36           # 기둥 밑 = 바닥 줄 36
for y in range(LWY0 - 2, LWY1 + 1):            # 지붕 밑 그늘(바닥)
    for x in range(LX0, LX1 + 1):
        darken(c, x, y, 2 if y < LWY0 + 2 else 1)
SX0, SX1, SY0 = LX0 + 5, LX1 - 5, LWY0 + 1     # 계단 구멍(아래로 내려가는 돌계단, 안쪽일수록 어둡다)
for y in range(SY0, LWY1):
    k = (LWY1 - 1 - y) // 2                     # 앞(아래)에서 몇 번째 단
    for x in range(SX0, SX1 + 1):
        if (LWY1 - 1 - y) % 2 == 0:
            ch = ('m', 'k', 'j', 'i', 'e', 'a')[min(5, k)]      # 단 윗면
        else:
            ch = ('i', 'e', 'a', 'Y', 'Y', 'X')[min(5, k)]      # 단 앞면
        if x == SX1:
            ch = 'Y'
        c.put(x, y, ch)
for y in range(SY0, LWY1 + 1):                 # 구멍 테두리 돌(왼 밝음 · 오른 그늘)
    c.put(SX0 - 1, y, 'n')
    c.put(SX1 + 1, y, 'a')
for x in range(SX0 - 1, SX1 + 2):
    c.put(x, SY0 - 1, 'k')
    c.put(x, LWY1, 'r' if x < (SX0 + SX1) // 2 else 'm')
for px in (LX0, LX1 - 2):                      # 앞 기둥 둘(지붕 처마에서 바닥까지)
    post(c, px, LWY0 - 2, LWY1, w=3)
    c.put(px - 1, LWY1, 'a')
    c.put(px + 3, LWY1, 'Y')
for x in range(LX0, LX1 + 1):                  # 처마 밑 가로 들보
    c.put(x, LWY0 - 2, 'η' if x % 6 else 'ζ')
    c.put(x, LWY0 - 1, 'δ')
# 지붕(작은 테라코타 모임지붕: 위에서 보이는 앞 사면 + 양 끝 모임)
hip_roof(c, LX0 - 4, LX1 + 4, 5, LWY0 - 3, LX0 + 9, LX1 - 9, seed=5)
for y in range(9, LWY1 + 3):                   # 그림자: 오른쪽 바닥
    for k in range(1, 6):
        darken(c, LX1 + 4 + k if y < LWY0 - 2 else LX1 + k, y, 2 if k < 3 else 1)
for x in range(LX0 + 2, LX1 + 6):
    darken(c, x, LWY1 + 1, 1)
# 바닥 위 작은 물건(덮개보다 작다): 왼쪽 통(타원 윗면), 오른쪽 상자(뚜껑 윗면)
barrel(c, 11, 31, w=7, h=8)
for x in range(12, 18):
    darken(c, x, 39, 1)
c.rows(64, 28, [
    'ζσσσσξζ',
    'ηξσξσηβ',
    'XηηηηεX',
    'ηθεθεεβ',
    'XεεεεεX',
])
for x in range(65, 71):
    darken(c, x, 33, 1)

# 앞 흉벽: 이(윗면 5줄 + 앞면 8줄) · 총안(틈 너머 바닥이 이어지고, 아랫돌 윗면)
MW, GW = 9, 4                                 # 이 너비, 총안 너비
for x in range(PX0, PX1 + 1):
    k = (x - PX0 + 2) % (MW + GW)
    dark = x > PX1 - 7
    if k < MW or x < PX0 + 3 or x > PX1 - 2:
        kk = min(k, MW - 1)
        # 윗면(갓돌, 위에서 5줄): 왼모 밝고 오른모 그늘
        tops = ['s', 's', 's', 'r', 'r', 'r', 'n', 'n', 'm']
        for j in range(5):
            ch = tops[kk]
            if j == 4:
                ch = 'j' if kk < MW - 2 else 'e'
            if dark:
                ch = {'s': 'n', 'r': 'm', 'n': 'k', 'm': 'j', 'k': 'i', 'j': 'e', 'e': 'a'}[ch]
            c.put(x, MER + j, ch)
        # 앞면(마름돌 두 줄 + 아래 그늘)
        for y in range(MER + 5, MER + 13):
            t = [8, 7, 7, 7, 6, 6, 6, 5, 4][kk] - (2 if dark else 0)
            if y == MER + 5:
                t += 1
            if y in (MER + 8, MER + 12):
                t -= 3
            if y < MER + 8 and kk == 4:
                t -= 3                       # 위 줄 돌 이음
            if y > MER + 8 and kk in (2, 6):
                t -= 3                       # 아래 줄 돌 이음(엇갈림)
            c.put(x, y, sclamp(t))
    else:
        g = k - MW
        for y in range(MER - 1, MER + 4):     # 틈 너머: 바닥 판석(이 그늘)
            darken(c, x, y, 2 if g < 2 else 1)
        c.put(x, MER + 4, 'Y' if g < 2 else 'a')
        c.put(x, MER + 5, 'm' if g else 'k')    # 아랫돌 윗면
        c.put(x, MER + 6, 'k')
        for y in range(MER + 7, MER + 13):
            c.put(x, y, sclamp(6 - (2 if dark else 0) - (3 if y == MER + 12 else 0)))

# 이끼·풍화(손 자리)
for (x, y, ch) in [(5, 138, 'N'), (6, 139, 'M'), (70, 139, 'M'), (71, 138, 'N')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))
mn, bad = edge_report(c, P)
print('edge min lum %.3f  near-black edge px %d %s' % (mn, len(bad), bad[:6]))

walk = []
for cy in range(9):
    r = ''
    for cx in range(5):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cy == 8 and cx == 2:
            r += 'D'
        else:
            r += '*' if cy < 4 else 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='사각 성탑', massing='20', material='stone', refs=['bd-wall-tower', 'bd-castle'], walk=walk)
f, w = c.save('keep-tower', meta)
print('FAIL', f, 'WARN', w)
