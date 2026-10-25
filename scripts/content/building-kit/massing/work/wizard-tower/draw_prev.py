"""wizard-tower — 마법사 탑(덩어리 모형 C15). 가는 마름돌 원통(둘레 돌림띠) + 아주 높은 청석 원뿔 + 금빛 별 깃대,
둥근 창 줄, 아래 아치 문. 4×11 칸(64×176). 문 하나. 글자 없음. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dovecote'))
from towerlib import (Canvas, pix, ST, sclamp, fill_walk, taper_wall, ring_y, on_cyl,  # noqa: E402
                      outline, darken)
from common import door, moss  # noqa: E402

c = Canvas(4, 11)
W, H = 64, 176
GY = H - 1
CX = 32.0
R = 16.0
SAG = 3
TOP = 80

# ---------------------------------------------------------------- 몸통(차가운 회색 마름돌)
ash = pix.Ashlar([5, 5, 4, 5, 6, 5], seed=9, widths=[7, 9, 6, 10, 8, 6, 9, 7, 11, 6, 8, 10, 7], dark=1, warm=True)
taper_wall(c, CX, lambda y: R, TOP, GY, ash, SAG)
base = pix.Ashlar([4, 4], seed=4, widths=[12, 9, 14, 10, 11, 13], dark=2)
taper_wall(c, CX, lambda y: R + 1.6, GY - 7, GY, base, 0)
# 기초 윗면 턱(밝은 선)
for x in range(int(CX - R) - 2, int(CX + R) + 3):
    o = on_cyl(CX, R + 1.6, x)
    if not o:
        continue
    dx, cosv, sh = o
    y = GY - 8 + round(1 * cosv)
    c.put(x, y, sclamp(10 + sh))

# 돌림띠(내민 돌 고리) — 원통 둘레
RINGS = [103, 127, 150]
for ry in RINGS:
    rr = R + 1.0
    for x in range(int(CX - rr) - 1, int(CX + rr) + 2):
        o = on_cyl(CX, rr, x)
        if not o:
            continue
        dx, cosv, sh = o
        y = ry + round(SAG * cosv)
        k = int(math.asin(max(-1, min(1, dx / rr))) * rr + 100) % 6
        c.put(x, y, sclamp(10 + sh if k else 9 + sh))
        c.put(x, y + 1, sclamp(7 + sh))
        c.put(x, y + 2, sclamp(4 + sh))
        g = c.get(x, y + 3)
        if g != '.' and abs(dx) <= R:
            c.put(x, y + 3, darken(g, 2))

# 처마 밑 그늘(원뿔 아래 4줄)
for x in range(int(CX - R), int(CX + R) + 1):
    yy = ring_y(CX, R, TOP, SAG, x)
    if yy is None:
        continue
    for d in range(5):
        g = c.get(x, yy - SAG + d)
        if g != '.':
            c.put(x, yy - SAG + d, darken(g, max(1, 4 - d)))

# ---------------------------------------------------------------- 둥근 창(돌 테 + 납 유리, 하나는 불빛)
def oculus(cx, cy, glow=False, rr=5.0):
    """둥근 창: 돌 테(왼쪽 위 밝게, 오른쪽 아래 어둡게) + 쇠 십자 살 + 유리(하늘 반짝임 또는 불빛) + 밑 창턱."""
    for y in range(int(cy - rr) - 1, int(cy + rr) + 2):
        for x in range(int(cx - rr) - 1, int(cx + rr) + 2):
            ddx, ddy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(ddx, ddy)
            if d > rr:
                continue
            lit = -(ddx + ddy) / max(d, 0.01)
            if d > rr - 1.5:
                ch = ('r' if lit > 0.7 else 'm') if lit > 0.2 else ('i' if lit > -0.5 else 'a')
            elif abs(ddx) < 0.6 or abs(ddy) < 0.6:
                ch = 'X' if not glow else 'τ'
            elif glow:
                ch = 'L' if (ddx < 0 and ddy < 0 and d < 2.4) else ('K' if lit > -0.6 else 'τ')
            else:
                ch = 'D' if ddy < -1 else ('A' if ddy < 1.5 else 'B')
                if ddx < 0 and ddy < 0 and d < 2.8:
                    ch = '^' if d < 1.9 else 'F'
            c.put(x, y, ch)
    # 창 밑 그늘 + 돌 창턱
    y = int(cy + rr) + 1
    for x in range(int(cx - 3), int(cx + 4)):
        c.put(x, y, 'k' if x < cx else 'i')
        c.put(x, y + 1, 'Y')


for (wx, wy, glow) in [(31, 91, False), (31, 115, True), (31, 138, False)]:
    oc = on_cyl(CX, R, wx)
    sag = round(SAG * oc[1]) if oc else 0
    oculus(wx + 0.5, wy + sag, glow)
# 옆 좁은 창(원통이 돌아 나가 좁게 보인다) — 층마다 양옆
SL_L = ['.rk.', 'rDTe', 'r^Ta', 'mDTa', 'mTUa', 'kjea']
SL_R = ['.kY', 'kTa', 'iTY', 'iTY', 'iUY', 'eaW']
SL_LG = ['.rk.', 'rLτe', 'rKτa', 'mKτa', 'mτ7a', 'kjea']
for k, fy in enumerate((88, 112, 135)):
    oc = on_cyl(CX, R, 20)
    c.rows(19, fy + round(SAG * oc[1]), SL_LG if k == 2 else SL_L)
    oc = on_cyl(CX, R, 43)
    c.rows(42, fy + round(SAG * oc[1]), SL_R)

# ---------------------------------------------------------------- 아치 문
DX0, DW, DY0 = 21, 11, GY - 25
for (dx, dy) in [(-2, 6), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (5, -3), (7, -2), (9, 0), (10, 2), (11, 4), (11, 6)]:
    for j in range(2):
        for k in range(2):
            c.put(DX0 + dx + k, DY0 + dy + j, 'n' if (j == 0 and k == 0) else ('k' if j == 0 else 'i'))
for y in range(DY0 + 8, GY):
    c.put(DX0 - 2, y, 'k' if y % 4 else 'j')
    c.put(DX0 - 1, y, 'e')
    c.put(DX0 + DW, y, 'a')
    c.put(DX0 + DW + 1, y, 'i' if y % 4 else 'e')
door(c, DX0, DY0, DW, GY - DY0)
for x in range(DX0 - 2, DX0 + DW + 2):
    c.put(x, GY, 'Y' if x % 3 else 'W')
# 문 위 작은 등(금빛)
c.rows(DX0 + DW + 3, DY0 + 4, ['.Y.', 'XKX', 'XLX', '.τ.'])

# ---------------------------------------------------------------- 아주 높은 청석 원뿔 + 처마
CONE_BASE = 74
HW = R + 7.5
pix.cone(c, CX, 13, CONE_BASE, HW, 6, seed=3)
# 처마 앞 끝 두께(밑 타원 앞 반쪽)
for x in range(int(CX - HW), int(CX + HW) + 1):
    dx = x + 0.5 - CX
    if abs(dx) > HW:
        continue
    ye = CONE_BASE + 6 * math.sqrt(max(0, 1 - (dx / HW) ** 2))
    y = int(round(ye))
    f = dx / HW
    c.put(x, y, 'B' if f > 0.35 else ('C' if f > -0.2 else 'E'))
    c.put(x, y - 1, 'E' if f > 0.35 else ('F' if f > -0.3 else 'G'))
# 원뿔 모서리 밝은 선(왼쪽 사면 빛) — 꼭짓점→왼쪽 처마
for y in range(14, CONE_BASE + 1):
    t = (y - 13) / (CONE_BASE - 13)
    x = int(round(CX - HW * t * 0.97))
    if c.get(x + 1, y) != '.':
        c.put(x + 1, y, 'H' if y % 4 else 'I')
# 원뿔 위 작은 지붕창(둥근 머리 들창) 하나 — 창 앞면만, 위 작은 청석 모자
DM = [
    '.....IC.....',
    '....IGFC....',
    '...IHGFEC...',
    '..IHGGFEEC..',
    '.IHGGGFFEEC.',
    'IHHGGGFFEEEC',
    'BCCCCCCCCCCB',
    '.nrkkkkjjia.',
    '.nkLLKKτXia.',
    '.nkLKKττXia.',
    '.nkXXXXXX7a.',
    '.nkKKτττXia.',
    '.nkKτττ7Xia.',
    '.mjiiieeeaY.',
    '..CCEEEECC..',
]
c.rows(int(CX) - 6, 37, DM)
# 꼭대기: 금 깃대 + 별(글자 없음)
c.rows(int(CX) - 3, 0, [
    '...L...',
    '..LKL..',
    'LLKKKLτ',
    '.LKKKτ.',
    '..KτK..',
    '.Kτ.τK.',
    '...τ...',
    '...K...',
    '...τ...',
    '...K...',
    '..ΚLτ..'.replace('Κ', 'K'),
    '..ijY..',
    '..eaW..',
    '..YWU..',
])

moss(c, [(17, 168, 2), (44, 165, 2), (20, 106, 2)])

# 바깥 윤곽(재질 어두운 단): 돌만
outline(c, {ch: 'a' for ch in ST}, x1=int(CX) - 1, y0=TOP - 2)
outline(c, {ch: 'Y' for ch in ST}, x0=int(CX), y0=TOP - 2)
outline(c, {'H': 'F', 'I': 'F', 'G': 'E', 'F': 'E'}, x1=int(CX) - 1, y0=14, y1=TOP + 3)
outline(c, {'H': 'C', 'G': 'C', 'F': 'C', 'E': 'C'}, x0=int(CX), y0=14, y1=TOP + 3)

walk = ['****', '****', '****', '****', '****', '****', '****', '****', '****', 'XDXX', 'XDXX']
meta = {'name': '마법사 탑', 'massing': 'C15', 'material': 'stone',
        'refs': ['bd-mpart-tower', 'bd-manor-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('wizard-tower', meta)
print('fails', fails, 'warns', warns)
