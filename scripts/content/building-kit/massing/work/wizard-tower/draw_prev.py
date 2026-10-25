"""wizard-tower — 마법사 탑(덩어리 모형 C15), 6차 다시 그림.
분홍 막돌 원통(줄이 밑 타원 따라 휘고 왼쪽 밝음 → 오른쪽 어둠 계단) + 큰 버들항 테라코타 원뿔(작은 비늘이 꼭대기로
좁아진다, 밑 타원이 깊어 윗면이 크게 보인다) + 회색 돌 받침 + 돌림띠 둘 + 아치 창 + 아치 문. 4×11 칸(64×176). 문 하나. 난수 없음."""
import importlib.util as _iu
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'dovecote'))
from towerlib import Canvas, fill_walk  # noqa: E402
from common import door  # noqa: E402


def _load(name, fn):
    sp = _iu.spec_from_file_location(name, os.path.join(HERE, fn))
    m = _iu.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


TF = _load('towerfix_wz', 'towerfix.py')
FX = _load('fixups_wz', 'fixups.py')
EF = _load('edgefix_wz', 'edgefix.py')

c = Canvas(4, 11)
W, H = 64, 176
GY = H - 1
TCX = 32.0
R = 17.0
SAG = 6

# ---------------------------------------------------------------- 네모 돌 단(윗면 포석이 위에서 보이고 앞면 마름돌 4줄)
BOT = GY - 5                 # 탑 밑(단 윗면 위)
PX0, PX1 = 1, 62
PTOP, PFR = BOT - 13, GY - 4
FLAG_W = [9, 7, 10, 8, 11, 7, 9, 10]
WR = 'WYaeghijkmn'
for y in range(PTOP, PFR + 1):
    row = (y - PTOP) // 5
    lv = (y - PTOP) % 5
    off = [0, 4, 7, 2, 5][row % 5]
    u = PX0 - off
    k = row * 3
    xs = []
    while u < PX1 + 14:
        xs.append(u)
        u += FLAG_W[k % len(FLAG_W)]
        k += 1
    for x in range(PX0, PX1 + 1):
        su = max(v for v in xs if v <= x)
        lu = x - su
        sid = xs.index(su) + row * 5
        t = 8 if x < 18 else (7 if x < 44 else 6)
        t += [0, 1, 0, -1, 0, 1, 0, 0, -1, 1, 0][sid % 11]
        if lv == 4 or lu == 0:
            t -= 3
        elif lv == 0 or lu == 1:
            t += 1
        c.put(x, y, WR[max(0, min(len(WR) - 1, t))])
for x in range(PX0, PX1 + 1):
    c.put(x, PTOP, 'a' if x < 40 else 'Y')
    c.put(x, PFR, 'r' if x % 9 else 'n')
FW = [10, 8, 12, 9, 11, 7, 13]
for y in range(PFR + 1, GY + 1):
    j = y - PFR - 1
    u = PX0 - (j * 5) % 7
    k = j * 2
    while u <= PX1:
        w = FW[k % len(FW)]
        for x in range(max(PX0, u), min(PX1 + 1, u + w)):
            base = 'i' if x < 20 else ('g' if x < 44 else 'e')
            ch = 'a' if (x == u + w - 1 or j == 3) else (('k' if x < 20 else 'i') if j == 0 else base)
            c.put(x, y, ch)
        u += w
        k += 1
# 단 양끝 세로 모서리(왼쪽 밝게 · 오른쪽 그늘)
for y in range(PTOP, GY + 1):
    c.put(PX0, y, 'e' if y < PFR else 'Y')
    c.put(PX1, y, 'Y' if y < PFR else 'W')

# ---------------------------------------------------------------- 몸통
SHAFT_TOP = 70
TF.shaft(c, TCX, R, SHAFT_TOP, BOT, SAG, start=3)
TF.plinth(c, TCX, R, BOT, SAG, rows=4, out=1.5, start=1)
# 탑이 단 윗면에 지는 그림자(빛 왼쪽 위 → 오른쪽 뒤로)
for y in range(PTOP + 1, PFR):
    for x in range(int(TCX), PX1):
        e = ((x - (TCX + 12)) / (R + 8)) ** 2 + ((y - (BOT - 4)) / 6.0) ** 2
        g = c.get(x, y)
        if e < 1 and g in WR and abs(x + 0.5 - TCX) > R + 1.6:
            c.put(x, y, WR[max(0, WR.index(g) - (3 if e < 0.6 else 2))])
# 돌림띠 둘(같은 곡선, 윗턱 밝게 · 밑 그늘)
for ry in (104, 136):
    TF.ring_band(c, TCX, R, ry, SAG, rows=3, out=0.8)

# ---------------------------------------------------------------- 아치 창(나무 테 + 청록 유리 + 흰 창턱) — 층마다 다르게
ARCH = {
    'a': ['..ηηη..', '.ηDEDη.', 'ηDE^ADη', 'ηA^AABη', 'ηAADABη', 'ηζζζζζη', 'ηAABABη', 'ηABAABη', 'ηAABBBη', 'ηζζζζζη',
          'rmmmkki', '.YYaaY.'],
    'b': ['..ηηη..', '.ηLKKη.', 'ηLKLKτη', 'ηKLKKτη', 'ηKKτKτη', 'ηζζζζζη', 'ηKKτKτη', 'ηKτKττη', 'ητKτττη', 'ηζζζζζη',
          'rmmkkji', '.YaaYW.'],
    'c': ['..ηηη..', '.ηDDDη.', 'ηD^EADη', 'ηAAA^Bη', 'ηAADABη', 'ηAAABBη', 'ηζζζζζη', 'ηAABABη', 'ηABBBBη',
          'rmmkkii', '.YYaaY.'],
}
SIDE = ['.ηη.', 'ηD^η', 'ηADη', 'ηAAη', 'ηζζη', 'ηABη', 'ηBBη', 'mkki', '.YY.']
SIDE_R = ['.ηζ', 'ηDζ', 'ηBζ', 'ηAζ', 'ηζζ', 'ηBζ', 'ηBζ', 'kie', '.aW']


def put_rows(x, y, rows):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                c.put(x + i, y + j, ch)


def sag_at(x):
    dx = x + 0.5 - TCX
    return round(SAG * math.sqrt(max(0.0, 1 - (dx / R) ** 2)))


for (wy, key) in ((80, 'a'), (112, 'b')):
    put_rows(int(TCX) - 4, wy + sag_at(int(TCX)) - SAG, ARCH[key])
for (wy, side) in ((84, 'L'), (116, 'R'), (118, 'L'), (86, 'R')):
    if side == 'L':
        x = int(TCX) - 13
        put_rows(x, wy + sag_at(x + 2) - SAG, SIDE)
    else:
        x = int(TCX) + 10
        put_rows(x, wy + sag_at(x + 1) - SAG, SIDE_R)

# ---------------------------------------------------------------- 아치 문(돌 테) + 작은 등
DX0, DW = 21, 10
DY0 = BOT - 26
for (dx, dy) in [(-2, 6), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (5, -3), (7, -2), (9, 0), (10, 2), (11, 4), (11, 6)]:
    for j in range(2):
        for k in range(2):
            c.put(DX0 + dx + k, DY0 + dy + j, 'q' if (j == 0 and k == 0) else ('o' if j == 0 else 'l'))
for y in range(DY0 + 8, BOT - 3):
    c.put(DX0 - 2, y, 'o' if y % 4 else 'l')
    c.put(DX0 - 1, y, 'f')
    c.put(DX0 + DW, y, 'c')
    c.put(DX0 + DW + 1, y, 'l' if y % 4 else 'f')
door(c, DX0, DY0, DW, BOT - 3 - DY0)
for x in range(DX0 - 2, DX0 + DW + 2):          # 문턱 돌(받침과 이어진다)
    c.put(x, BOT - 3, 'k' if x % 4 else 'i')
# 문 앞 디딤돌 둘(단 윗면 → 앞면을 파고 땅으로)
for k in range(2):
    y = PFR - 3 + k * 4
    for x in range(DX0 - 1, DX0 + DW + 1):
        c.put(x, y, 'r' if x % 6 else 'n')
        c.put(x, y + 1, 'm' if x % 6 else 'k')
        c.put(x, y + 2, 'a' if x % 5 else 'Y')
        c.put(x, y + 3, 'W' if k == 0 else 'Y')
for y in range(PFR - 3, GY + 1):
    c.put(DX0 - 2, y, 'a')
    c.put(DX0 + DW + 1, y, 'W')
put_rows(DX0 + DW + 3, DY0 + 5, ['.Y.', 'XKX', 'XLX', '.τ.'])

# ---------------------------------------------------------------- 큰 테라코타 원뿔(밑 타원 깊게 — 윗면이 크게 보인다)
CONE_BASE = 62
HW = R + 6
ELL = 9
# 원뿔이 몸통 윗단에 지는 그늘
for x in range(int(TCX - R), int(TCX + R) + 1):
    dx = x + 0.5 - TCX
    if abs(dx) > R:
        continue
    ye = int(round(CONE_BASE + ELL * math.sqrt(max(0, 1 - (dx / HW) ** 2)))) + 2
    for d in range(4):
        g = c.get(x, ye + d)
        if g in TF.WARM and g not in ('J', 'C'):
            c.put(x, ye + d, TF.WARM[min(9, TF.WARM.index(g) + (4 - d))])
TF.cone(c, TCX, 9, CONE_BASE, HW, ELL, th=3, sw=3.6, start=2)
TF.cone_eave(c, TCX, CONE_BASE, HW, ELL)
# 꼭대기 쇠 장식(공 + 짧은 침)
put_rows(int(TCX) - 2, 0, ['..Y..', '..a..', '.kiY.', '.iYW.', '..W..', '..Y..', '.aYW.', '.YWU.', '..U..', '..W..', '..W..'])   # 막대가 원뿔 꼭대기 화소까지 내려와 붙는다

FX.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', EF.material_edges(c))
TN = _load('tint_wz', 'tint.py')
print('  윤곽 색조', TN.tint_edges(c, TCX), '· 무채 가장자리', TN.neutral_share(c))

walk = ['****', '****', '****', '****', '****', '****', '****', '****', '****', 'XDXX', 'XDXX']
meta = {'name': '마법사 탑', 'massing': 'C15', 'material': 'stone',
        'refs': ['bd-mpart-tower', 'bd-manor-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('wizard-tower', meta)
print('fails', fails, 'warns', warns)
