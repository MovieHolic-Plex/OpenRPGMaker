"""curtain-wall — 성벽 한 토막(덩어리 모형 C04). 13×7 칸(208×112). 난수 없음.
높이서 내려다본 성벽: 위 = 뒤 흉벽 윗면(이 틈) → 성벽 위 길(버들항 성탑 바닥처럼 네모 판석, 줄 맞춤 격자 — 화면의 가장 큰 밝은 면)
→ 앞 흉벽 이(밝은 윗면 + 앞면) → 받침 띠 → 짧은 남쪽 벽면(마름돌·화살창) → 기단. 양 끝은 옆 흉벽 윗면 띠로 닫는다(잘린 단면이 아니다).
가운데 오른쪽 둥근 탑이 길 위로 높이 솟는다(원통 마름돌 + 내쌓기 고리 + 버들항 테라코타 원뿔). 문은 탑 밑 쪽문 하나."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss  # noqa: E402
from bits import darken, outline, fill_pinholes  # noqa: E402
from hand import barrel  # noqa: E402
from deck import deck  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar, sclamp  # noqa: E402

W, H = 208, 112
c = Canvas(13, 7)
GY = H - 1
X0, X1 = 3, 204          # 성벽 양 끝(옆 흉벽 바깥 모)
SPW = 7                  # 옆 흉벽 윗면 폭
RT = 2                   # 뒤 흉벽 윗면 시작
RI = 7                   # 뒤 흉벽 안쪽(남향) 면
WALK0 = 11               # 길 바닥
FM_TOP = 59              # 앞 흉벽 이 윗면(4줄)
FM_FACE = 63             # 앞 흉벽 앞면
SC = 70                  # 받침 띠
WALL0 = 73               # 남쪽 벽면
pix.TONES = ('79586978579869758976859786957896'
             '86957968597869579687596879586975'
             '95786958796857986975869579867958')

# ---------------------------------------------------------------- 남쪽 벽면(짧다) + 기단
ash = Ashlar([6, 5, 6, 6, 5, 6, 5], seed=2, warm=False,
             widths=[12, 9, 14, 10, 8, 13, 11, 15, 9, 12, 10, 14, 8, 11, 13, 9])


def wall_shade(x, y):
    s = -1
    if y < WALL0 + 4:
        s -= 2 if y < WALL0 + 2 else 1
    if y > GY - 10:
        s -= 0 if (x // 13 + y // 6) % 3 else 1
    return s


pix.flat_wall(c, X0, WALL0, X1 - X0 + 1, GY - 3 - WALL0, ash, shade=wall_shade)
for x in range(X0, X1 + 1):
    k = (x + 3) % 13
    c.put(x, GY - 3, 'k' if k else 'j')
    c.put(x, GY - 2, 'e' if k else 'Y')
    c.put(x, GY - 1, 'a' if k else 'Y')
    c.put(x, GY, 'Y' if x % 5 else 'X')
for x in range(X0, X1 + 1):                        # 받침 띠
    c.put(x, SC, 'r' if x % 11 else 'm')
    c.put(x, SC + 1, 'k' if x % 11 else 'e')
    c.put(x, SC + 2, 'e')
SLIT = ['rnmj', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'kYXa', 'kiea']
for sx in (24, 98, 190):
    c.rows(sx, 80, SLIT)
for sx in (61, 118):                                # 물빠짐 구멍 + 물때
    c.rows(sx, 74, ['YXXa', 'eUWe'])
    for j in range(2, 8):
        darken(c, sx + 1, 74 + j, 1 if j < 5 else 0)

# ---------------------------------------------------------------- 성벽 위 길: 네모 판석(가장 큰 밝은 면)
deck(c, X0 + SPW, WALK0, X1 - SPW, FM_TOP + 3, sw=10, sh=8, ox=4, oy=3)
for x in range(X0 + SPW, X1 - SPW + 1):            # 뒤 흉벽이 드리운 그늘
    darken(c, x, WALK0, 2)
    darken(c, x, WALK0 + 1, 1)
for y in range(WALK0, FM_TOP + 3):                 # 왼 옆 흉벽이 드리운 그늘
    darken(c, X0 + SPW, y, 2)
    darken(c, X0 + SPW + 1, y, 1)

# ---------------------------------------------------------------- 뒤 흉벽: 이 틈이 있는 윗면 + 안쪽 남향 면
for x in range(X0, X1 + 1):
    k = (x - X0) % 12
    gap = 8 <= k and X0 + SPW <= x <= X1 - SPW
    seam = (x - X0) % 12 == 7
    for y in range(0, RI):
        if gap and y < RT + 1:
            continue
        lv = y - (RT + 1 if gap else 0)
        ch = ('s', 'r', 'r', 'n', 'n', 'm', 'm')[min(6, lv)]
        if seam:
            ch = 'k'
        c.put(x, y, ch)
    for y in range(RI, WALK0):
        c.put(x, y, ('j', 'i', 'e', 'a')[y - RI] if (x + y) % 9 else 'e')

# ---------------------------------------------------------------- 옆 흉벽 윗면(양 끝을 닫는다): 갓돌 이음 8줄마다
for y in range(0, FM_TOP):
    seam = (y + 3) % 8 == 0
    for i in range(SPW):
        L = ('k', 's', 'r', 'r', 'n', 'n', 'm')[i]
        R = ('m', 'n', 'n', 'm', 'm', 'k', 'j')[i]
        c.put(X0 + i, y, 'j' if seam else L)
        c.put(X1 - SPW + 1 + i, y, 'i' if seam else R)

# ---------------------------------------------------------------- 앞 흉벽: 이(밝은 윗면 4 + 앞면 7) · 총안
KX = {}
pos, j = X0, 0
while pos <= X1 + 12:
    mw = (9, 8, 10, 9, 8, 10, 9, 9)[j % 8]
    gw = (5, 4, 5, 5, 4, 5)[j % 6]
    for i in range(mw + gw):
        KX[pos + i] = (i, mw)
    pos += mw + gw
    j += 1
for x in range(X0, X1 + 1):
    k, MW = KX[x]
    if x < X0 + SPW or x > X1 - SPW:                # 양 끝은 옆 흉벽에 이어진 막힌 모서리 돌
        k, MW = min(k, 3), 9
    if k < MW:
        tops = ['s', 's', 's', 's', 'r', 'r', 'r', 'r', 'n', 'm'][:MW - 1] + ['m']
        for jj in range(4):
            c.put(x, FM_TOP + jj, 'e' if k == MW - 1 else (tops[k] if jj < 3 else 'm'))
        for y in range(FM_FACE, SC):
            t = ([7, 6, 6, 6, 6, 6, 5, 5, 5, 3][:MW - 1] + [3])[k]
            if y == FM_FACE:
                t += 1
            if y == FM_FACE + 3:
                t = 4
            if y == SC - 1:
                t -= 2
            c.put(x, y, sclamp(t))
    else:
        g = k - MW
        for y in range(FM_TOP - 2, FM_TOP + 3):
            darken(c, x, y, 2 if g < 2 or y >= FM_TOP else 1)
        c.put(x, FM_TOP + 3, 'Y')
        c.put(x, FM_FACE, 'n' if g else 'm')
        c.put(x, FM_FACE + 1, 'e')
        for y in range(FM_FACE + 2, SC):
            c.put(x, y, sclamp((6 if g else 5) if y < SC - 1 else 4))

# ---------------------------------------------------------------- 길 위 물건(바닥에 그림자)
barrel(c, 24, 26, w=10, h=12)
barrel(c, 35, 30, w=8, h=9, lid='σ')
c.rows(70, 40, ['ζηηηηηηζ', 'ηξεξεξεβ', 'ηεβXkεεβ', 'ηξεξεξεβ', 'δεεεεεεδ'])     # 계단 뚜껑문(바닥에 누운 판)
c.rows(182, 30, ['ζσσσσσσξζ', 'ηξσξσξσηβ', 'ηξξξξξηηβ', 'XηηηηηεεX', 'ηθεθεθεεβ', 'XεεεεεεεX'])   # 나무 상자
for (x0, y0, w) in ((24, 38, 11), (35, 39, 9), (182, 36, 10)):
    for i in range(w):
        darken(c, x0 + i + 1, y0, 2)
        darken(c, x0 + i + 2, y0 + 1, 1)

# ---------------------------------------------------------------- 둥근 탑(길 위로 높이 솟는다)
CX, R, SAG = 152.0, 21.0, 4
tash = Ashlar([6, 5, 6, 6, 5, 6, 6], seed=6, warm=False)
TOP = 38
for x in range(int(CX + R) - 2, int(CX + R) + 10):  # 오른쪽 길·벽에 진 탑 그림자
    for y in range(WALK0 + 6, GY - 3):
        if x - (CX + R) < 9 - (y - WALK0) // 10:
            darken(c, x, y, 2 if x - (CX + R) < 3 else 1)
pix.cyl_wall(c, CX, R, TOP, GY, tash, SAG)
bash = Ashlar([4, 4], seed=13, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
pix.cyl_wall(c, CX, R + 0.6, GY - 6, GY, bash, SAG)
RING = 29
for x in range(int(CX - R) - 1, int(CX + R) + 2):
    dx = x + 0.5 - CX
    rr = R + 1.2
    if abs(dx) > rr:
        continue
    cosv = math.sqrt(max(0, 1 - (dx / rr) ** 2))
    y0 = RING + round(SAG * cosv)
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
hw, ell, BASE = R + 6, 5, 27
before = {(x, y): c.get(x, y) for y in range(0, 40) for x in range(118, 190)}
pix.cone(c, CX, 1, BASE, hw, ell, seed=4)
REMAP = {'C': '@', 'B': '!', 'E': '?', 'F': '<', 'G': 'π', 'H': 'σ'}
for (x, y), old in before.items():
    ch = c.get(x, y)
    if ch != old and ch in REMAP:
        c.put(x, y, REMAP[ch])
for x in range(int(CX - hw), int(CX + hw) + 1):
    dx = x + 0.5 - CX
    if abs(dx) > hw:
        continue
    ye = BASE + ell * math.sqrt(max(0, 1 - (dx / hw) ** 2))
    y = int(math.floor(ye + 0.5))
    f = dx / hw
    c.put(x, y, '9' if f > -0.2 else '7')
    if c.get(x, y - 1) != '.':
        c.put(x, y - 1, '?' if f > 0.45 else ('<' if f > -0.1 else 'ν'))
    for d in (1, 2):
        darken(c, x, y + d, 1)
for y in (0, 1, 2):
    c.put(int(CX), y, 'σ' if y < 2 else 'ξ')
c.put(int(CX) - 1, 2, 'ξ')
c.put(int(CX) + 1, 2, 'η')
c.rows(int(CX) - 9, 50, ['rnmj', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'nWUe', 'kYXa', 'kiea'])
c.rows(int(CX) + 4, 66, ['rnmmj', 'nWUUe', 'nWUUe', 'nWUUe', 'nWUUe', 'kYXXa', 'kieea'])
DX, DW, DY = 147, 10, 90
for y in range(DY, GY - 2):
    for x in range(DX - 3, DX + DW + 3):
        dx = x + 0.5 - (DX + DW / 2)
        jj = y - DY
        lim = DW / 2 + 3
        if jj < 8:
            lim = min(lim, 2 + jj * 0.9)
        if abs(dx) > lim:
            continue
        if abs(dx) > lim - 3:
            q = (jj // 3) % 3
            ch = ('r', 'n', 'm')[q] if dx < 0 else ('j', 'e', 'i')[q]
            if jj % 3 == 2:
                ch = 'e' if dx < 0 else 'a'
        else:
            i = int(x - DX)
            ch = ('θ', 'η', 'ε', 'δ')[i % 4]
            if y in (97, 104):
                ch = 'X' if i % 2 else 'U'
        c.put(x, y, ch)
c.rows(DX + 6, 100, ['.k.', 'k.X', '.X.'])
for x in range(DX - 1, DX + DW + 1):
    c.put(x, GY - 2, 'm' if x < DX + 5 else 'k')

moss(c, [(5, 104, 2), (128, 103, 1)])
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
