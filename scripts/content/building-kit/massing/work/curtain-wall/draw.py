"""curtain-wall — 성벽 한 토막(덩어리 모형 C04). 13×7 칸(208×112). 난수 없음.
양 끝까지 이어지는 곧은 마름돌 성벽: 뒤 흉벽(이 윗면+안쪽 남향면) → 위에서 보이는 성벽 위 길(판석 9px)
→ 앞 흉벽 이(윗면 4 + 앞면 8) → 받침 띠 → 벽면(화살창·물빠짐 구멍) → 짙은 기단.
왼쪽 토막엔 나무 덧방(호딩) 회랑: 앞으로 내민 판자 회랑 + 남향 외쪽 청회색 슬레이트 지붕(양끝 모임).
가운데 오른쪽 둥근 탑(원통 마름돌 + 내쌓기 고리 + 청회색 원뿔 지붕). 문은 탑 밑 뾰족 홍예 쪽문 하나."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import barrel  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar, sclamp, ST  # noqa: E402

W, H = 208, 112
c = Canvas(13, 7)
GY = H - 1

# 세로 층(y)
BM_TOP = 4       # 뒤 흉벽 이 윗면 시작
BC_TOP = 9       # 뒤 갓돌 윗면
BI_TOP = 12      # 뒤 흉벽 안쪽면
WALK0 = 15       # 성벽 위 길(위에서 보이는 판석 바닥 36px — 보이는 성벽 높이의 1/3 넘게)
FM_TOP = 51      # 앞 흉벽 이 윗면
FM_FACE = 55     # 앞 흉벽 앞면
SC = 63          # 받침 띠
WALL0 = 66       # 벽면
# 돌 밝기 표를 넓게(5~9 단이 고루 섞이게) — 이 그림의 pix 사본에만
pix.TONES = ('79586978579869758976859786957896'
             '86957968597869579687596879586975'
             '95786958796857986975869579867958')

ash = Ashlar([6, 5, 6, 6, 5, 6, 5, 6, 6], seed=2, warm=False, widths=[12, 9, 14, 10, 8, 13, 11, 15, 9, 12, 10, 14, 8, 11, 13, 9])


def wall_shade(x, y):
    s = -1                                # 남쪽 수직면은 위에서 보이는 길·갓돌보다 한 단 어둡다
    if y < WALL0 + 4:
        s -= 2 if y < WALL0 + 2 else 1    # 받침 띠·흉벽이 던지는 그늘
    if y > GY - 9:
        s -= 1                            # 땅 가까이 한 단 어둡게
    elif y > GY - 22:
        s -= 0 if (x // 13 + y // 6) % 3 else 1   # 아래쪽 1/3: 돌마다 한 단씩 섞여 어두워진다
    return s


pix.flat_wall(c, 0, WALL0, W, GY - 3 - WALL0, ash, shade=wall_shade)
for x in range(W):                  # 기단 4px: 1px 내민 받침돌 윗면 + 짙은 앞면 + 땅 닿는 줄
    k = (x + 3) % 13
    c.put(x, GY - 3, 'k' if k else 'j')
    c.put(x, GY - 2, 'e' if k else 'Y')
    c.put(x, GY - 1, 'a' if k else 'Y')
    c.put(x, GY, 'Y' if x % 5 else 'X')

# 받침 띠(앞으로 1px 내민 줄: 위 밝은 테 + 앞면 + 아래 그늘)
for x in range(W):
    c.put(x, SC, 'r' if x % 11 else 'm')
    c.put(x, SC + 1, 'k' if x % 11 else 'e')
    c.put(x, SC + 2, 'e')

# 뒤 흉벽: 갓돌 윗면(밝음) + 안쪽 남향면(그늘) + 이(윗면 3 + 안쪽면)
BMW, BGW = 7, 5
for x in range(W):
    k = (x + 1) % (BMW + BGW)
    seam = (x + 4) % 10 == 0
    for y in range(BC_TOP, BI_TOP):
        c.put(x, y, 'e' if seam else ('n', 'r', 'm')[y - BC_TOP])
    for y in range(BI_TOP, WALK0):
        c.put(x, y, ('Y', 'a', 'e', 'e', 'j')[y - BI_TOP] if (x + y) % 9 else 'a')
    if k < BMW:
        for y in range(BM_TOP, BM_TOP + 3):
            c.put(x, y, 'e' if k == BMW - 1 else ('r', 'n', 'm')[y - BM_TOP])
        for y in range(BM_TOP + 3, BC_TOP):
            c.put(x, y, 'a' if y == BM_TOP + 3 else ('e' if k < BMW - 1 else 'a'))

# 성벽 위 길: 위에서 본 넓고 얕은 판석(줄 높이 4, 판 너비 손 표), 벽면보다 밝다. 뒤 흉벽이 드리운 그늘.
FLAG_W = [17, 14, 19, 15, 18, 13, 16, 20, 14, 17, 15, 19]
FLAG_T = 'pnpmpkpnmpkp'
for y in range(WALK0, FM_TOP + 3):
    lv = y - WALK0
    r = lv // 4
    fy = lv % 4
    x = -((r * 7) % 13)
    i = r * 5
    while x < W:
        fw = FLAG_W[i % len(FLAG_W)]
        tone = FLAG_T[(i * 3 + r) % len(FLAG_T)]
        for xx in range(x, x + fw):
            if not (0 <= xx < W):
                continue
            fx = xx - x
            if fy == 3:
                ch = 'g'                                  # 앞 줄눈(얕다, 따뜻한 회갈)
            elif fx == fw - 1:
                ch = 'g' if fy else 'h'                   # 옆 줄눈
            elif fy == 0:
                ch = {'m': 'n', 'k': 'm', 'n': 'r', 'p': 'r'}[tone]
            elif fx == fw - 2 and fy == 2:
                ch = {'m': 'k', 'k': 'j', 'n': 'm', 'p': 'g'}[tone]
            else:
                ch = tone
            c.put(xx, y, ch)
        x += fw
        i += 1
for x in range(W):                                        # 뒤 흉벽 그늘(3줄 + 흐린 1줄)
    darken(c, x, WALK0, 2)
    darken(c, x, WALK0 + 1, 2)
    darken(c, x, WALK0 + 2, 1)
    darken(c, x, WALK0 + 3, 1 if x % 3 else 0)

# 앞 흉벽: 이(윗면 4 + 앞면 8), 총안(사이로 길 바닥 + 문턱 윗면)
MERL = []                                   # 이 너비·총안 너비(손 표) → 열마다 (k, 이 너비) 또는 총안
pos, j = -3, 0
while pos < W + 12:
    mw = (9, 8, 10, 9, 8, 10, 9, 9)[j % 8]
    gw = (5, 4, 5, 5, 4, 5)[j % 6]
    MERL.append((pos, mw, gw))
    pos += mw + gw
    j += 1
KX = {}
for (p0, mw, gw) in MERL:
    for i in range(mw + gw):
        KX[p0 + i] = (i, mw)
MW = 9
for x in range(W):
    k, MW = KX[x]
    if k < MW:
        tops = ['s', 's', 's', 's', 'r', 'r', 'r', 'r', 'n', 'm'][:MW - 1] + ['m']
        for j in range(4):
            c.put(x, FM_TOP + j, 'e' if k == MW - 1 else tops[k] if j < 3 else 'm')
        for y in range(FM_FACE, SC):
            t = ([7, 6, 6, 6, 6, 6, 5, 5, 5, 3][:MW - 1] + [3])[k]
            if y == FM_FACE:
                t += 1
            if y == FM_FACE + 4:
                t = 4 if k != 4 else t - 2
            if y > FM_FACE + 4 and k == 4:
                t -= 3
            if y == SC - 1:
                t -= 2
            c.put(x, y, sclamp(t))
    else:
        g = k - MW
        for y in range(FM_TOP - 2, FM_TOP + 3):      # 총안 사이로 보이는 길 바닥: 이 그늘
            darken(c, x, y, 2 if g < 2 or y >= FM_TOP else 1)
        c.put(x, FM_TOP + 3, 'Y')
        c.put(x, FM_TOP + 4, 'n' if g else 'm')
        c.put(x, FM_TOP + 5, 'm' if g else 'k')
        c.put(x, FM_TOP + 6, 'e')
        for y in range(FM_TOP + 7, SC):
            c.put(x, y, sclamp((6 if g else 5) if y < SC - 1 else 4))

# 벽면 화살창·물빠짐 구멍(한 번씩 다른 자리)
SLIT = ['rnmj', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'kYXa', 'kiea']
for sx in (22, 98, 192):
    c.rows(sx, 76, SLIT)
for sx, sy in ((61, 69), (118, 69)):
    c.rows(sx, sy, ['YXXa', '.UW.'.replace('.', 'e')])
    for j in range(3, 9):                   # 물때 자국
        darken(c, sx + 1, sy + j, 1 if j < 6 else 0)

# ---------------------------------------------------------------- 성벽 위 소품(윗면 있는 것)
barrel(c, 30, 28, w=10, h=12)
barrel(c, 41, 31, w=8, h=9, lid='σ')
c.rows(96, 34, [                           # 쌓은 포탄: 둥근 윗면 밝음
    '..kmm.kmm..',
    '.jmrnejrne.',
    '.ekmeaekmea',
    'kmmjkmmjkmm',
    'jrneerneern',
    'akmeakmeake',
    '.aYY.aYY.aY',
])
c.rows(184, 30, [                          # 나무 상자: 뚜껑 윗면 3줄 + 앞판·쇠 모서리
    'ζσσσσσσσξζ',
    'ηξσξσξσξηβ',
    'ηξξξξξξηηβ',
    'XηηηηηηεεX',
    'ηθεθεθεθεβ',
    'ηθεθεθεθεβ',
    'XεεεεεεεεX',
])
c.rows(70, 36, [                           # 계단 뚜껑문(바닥에 누운 판, 쇠 고리)
    'ζηηηηηηζ',
    'ηξεξεξεβ',
    'ηεβXkεεβ',
    'ηξεξεξεβ',
    'δεεεεεεδ',
])
for (x0, y0, w) in ((30, 40, 11), (41, 40, 9), (96, 41, 11), (184, 37, 10)):   # 소품 그림자(바닥)
    for i in range(w):
        darken(c, x0 + i + 1, y0, 1)

# ---------------------------------------------------------------- 둥근 탑(가운데 오른쪽)
CX, R, SAG = 152.0, 20.0, 4
tash = Ashlar([6, 5, 6, 6, 5, 6, 6], seed=6, warm=False)
TOP = 36
for x in range(int(CX + R) - 2, int(CX + R) + 9):   # 탑이 오른쪽 성벽·길에 던지는 그늘(위가 넓고 아래로 좁게)
    for y in range(WALK0, GY - 3):
        if x - (CX + R) < 8 - (y - WALK0) // 9:
            darken(c, x, y, 2 if x - (CX + R) < 3 - (y - WALK0) // 25 else 1)
pix.cyl_wall(c, CX, R, TOP, GY, tash, SAG)
bash = Ashlar([4, 4], seed=13, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
pix.cyl_wall(c, CX, R + 0.6, GY - 6, GY, bash, SAG)
# 내쌓기 고리(y 38 부근)
for x in range(int(CX - R) - 1, int(CX + R) + 2):
    dx = x + 0.5 - CX
    rr = R + 1.2
    if abs(dx) > rr:
        continue
    cosv = math.sqrt(max(0, 1 - (dx / rr) ** 2))
    y0 = 28 + round(SAG * cosv)
    sh = pix.cyl_shade(dx, rr)
    k = int((math.asin(dx / rr) * rr + 100)) % 6
    c.put(x, y0, sclamp(10 + sh))
    for d in (1, 2, 3):
        c.put(x, y0 + d, sclamp((8 if d == 1 else 7) + sh if k else 3 + sh))
    c.put(x, y0 + 4, sclamp(5 + sh))
    for d in (5, 6, 7):
        t = ((8 if k == 1 else 7) + sh - (d - 5)) if k in (1, 2, 3) else (1 + sh + (1 if d == 5 else 0))
        c.put(x, y0 + d, sclamp(t))
    c.put(x, y0 + 8, sclamp(3 + sh))
# 원뿔 지붕(보라 청석 → 청회색으로 바꿔 칠함)
hw, ell, BASE = R + 6, 5, 26
before = {(x, y): c.get(x, y) for y in range(0, 40) for x in range(118, 188)}
pix.cone(c, CX, 1, BASE, hw, ell, seed=4)
REMAP = {'C': '@', 'B': '!', 'E': '?', 'F': '<', 'G': 'π', 'H': 'σ'}   # 버들항 테라코타 비늘
for (x, y), old in before.items():
    ch = c.get(x, y)
    if ch != old and ch in REMAP:
        c.put(x, y, REMAP[ch])
for x in range(int(CX - hw), int(CX + hw) + 1):    # 처마: 위 밝은 테 + 아래 짙은 밑면
    dx = x + 0.5 - CX
    if abs(dx) > hw:
        continue
    ye = BASE + ell * math.sqrt(max(0, 1 - (dx / hw) ** 2))
    y = int(math.floor(ye + 0.5))
    f = dx / hw
    c.put(x, y, '9' if f > -0.2 else '7')
    if c.get(x, y - 1) != '.':
        c.put(x, y - 1, '?' if f > 0.45 else ('<' if f > -0.1 else 'ν'))
    for d in (1, 2):                                # 처마 밑 그늘(고리 위)
        darken(c, x, y + d, 1)
for y in (0, 1, 2):                                 # 꼭대기 마구리(원뿔 꼭짓점에 닿는다)
    c.put(int(CX), y, 'σ' if y < 2 else 'ξ')
c.put(int(CX) - 1, 2, 'ξ')
c.put(int(CX) + 1, 2, 'η')
# 탑 창: 화살창 둘(서로 다른 높이·폭)
c.rows(int(CX) - 9, 48, ['rnmj', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'kYXa', 'kiea'])
c.rows(int(CX) + 3, 62, ['rnmmj', 'nWUUe', 'nWUUe', 'nW^Ue', 'nWUUe', 'kYXXa', 'kieea'])
# 쪽문(뾰족 홍예, 두꺼운 돌 테 + 판자 + 쇠 띠), x 147..157
DX, DW, DY = 147, 10, 88
for y in range(DY, GY - 2):
    for x in range(DX - 3, DX + DW + 3):
        dx = x + 0.5 - (DX + DW / 2)
        j = y - DY
        lim = DW / 2 + 3
        if j < 8:
            lim = min(lim, 2 + j * 0.9)
        if abs(dx) > lim:
            continue
        if abs(dx) > lim - 3:
            q = (j // 3) % 3
            ch = ('r', 'n', 'm')[q] if dx < 0 else ('j', 'e', 'i')[q]
            if j % 3 == 2:
                ch = 'e' if dx < 0 else 'a'
        else:
            i = int(x - DX)
            ch = ('θ', 'η', 'ε', 'δ')[i % 4]
            if y in (95, 103):
                ch = 'X' if i % 2 else 'U'
        c.put(x, y, ch)
c.rows(DX + 6, 98, ['.k.', 'k.X', '.X.'])
for x in range(DX - 1, DX + DW + 1):               # 문턱 돌
    c.put(x, GY - 2, 'm' if x < DX + 5 else 'k')

moss(c, [(3, 104, 2), (128, 103, 1)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))
walk = []
for cy in range(7):
    r = ''
    for cx in range(13):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 9 and cy in (5, 6):
            r += 'D'
        elif cy < 4:
            r += '*'
        else:
            r += 'X'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='성벽 토막', massing='C04', material='stone', refs=['bd-castle', 'bd-wall-tower'], walk=walk)
f, w = c.save('curtain-wall', meta)
print('FAIL', f, 'WARN', w)
