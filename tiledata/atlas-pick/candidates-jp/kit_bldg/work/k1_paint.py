#!/usr/bin/env python3
"""kit_bldg 후보 k1-A/B/C 를 한 화소씩 손으로 찍는 도우미 (사각형·선·도안뿐, 보간·잡음 없음).
  python3 k1_paint.py A|B|C   # → ../k1-X.pxg
A = 강남풍 현대(ALC 패널·알루미늄 창틀·짙은 유리)   B = 그늘 강화(타일 외벽·깊이 들어간 창·짙은 난간 그림자)
C = 실루엣 다시 읽기(벽돌 쇼와 건물·아치 쌍창+발코니 난간·계단식 난간·원통 물탱크·초롱 세로간판)
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit
S = sys.argv[1]; assert S in 'ABC'
info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
G = [[None] * W for _ in range(H)]

class P:
    def __init__(s, slug): s.ox, s.oy = AT[slug]
    def px(s, x, y, k):
        G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.px(x + i, y + j, leg[c])
def k(r, t): return (r, t)
SL = k('mconc', 2)   # 층 이음 줄(계약)

# ───────────── 벽 재질 (16×32 안의 한 화소) ─────────────
def wallpx(x, y):
    if y in (0, 31): return SL
    if S == 'A':                                  # ALC 패널: 가로 홈 y16, 세로 홈 x11(윗)/x3(아랫)
        if y in (1, 30): return k('mconc', 3)
        if y == 16: return k('mconc', 3)
        if y == 17: return k('mconc', 5)
        jx = 11 if y < 16 else 3
        if x == jx: return k('mconc', 3)
        if x == jx + 1: return k('mconc', 5)
        return k('mconc', 4)
    if S == 'B':                                  # 타일: 8px 줄, 줄마다 어긋난 세로 줄눈, 타일 윗변 밝게·아랫변 어둡게
        r = y % 8
        if r == 0: return k('mtile', 1)
        jx = 11 if (y // 8) % 2 == 0 else 3
        if x == jx: return k('mtile', 1)
        if r == 1: return k('mtile', 4)
        if r == 7: return k('mtile', 2)
        return k('mtile', 3)
    c = y // 4; r = y % 4                         # C 벽돌: 4px 줄, 줄마다 어긋난 세로 줄눈
    if r == 3: return k('mbrick', 5)
    jx = 7 if c % 2 == 0 else 3
    if x % 8 == jx: return k('mbrick', 5)
    if r == 0: return k('mbrick', 4)
    return k('mbrick', 3)

def base_wall(p, x0=0, x1=16):
    for y in range(32):
        for x in range(x0, x1): p.px(x, y, wallpx(x, y))

EDGE = {'A': (k('mconc', 6), k('mconc', 5), k('mconc', 3), k('mconc', 2)),
        'B': (k('mtile', 5), k('mtile', 4), k('mtile', 2), k('mtile', 1)),
        'C': (k('mbrick', 5), k('mbrick', 4), k('mbrick', 2), k('mbrick', 1))}[S]

for slug in ('wall_l', 'wall_m', 'wall_r'):
    p = P(slug); base_wall(p)
    if slug == 'wall_l':
        for y in range(1, 31): p.px(0, y, EDGE[0]); p.px(1, y, EDGE[1])
    if slug == 'wall_r':
        for y in range(1, 31): p.px(14, y, EDGE[2]); p.px(15, y, EDGE[3])

# ───────────── 창 ─────────────
def win_A(p, kind):
    base_wall(p)
    p.rect(2, 3, 12, 1, k('mconc', 3))                       # 문미 그늘
    p.rect(2, 4, 12, 23, k('mmetal', 4))
    p.rect(2, 4, 12, 1, k('mmetal', 6)); p.rect(2, 4, 1, 23, k('mmetal', 5)); p.rect(13, 4, 1, 23, k('mmetal', 2)); p.rect(2, 26, 12, 1, k('mmetal', 2))
    p.rect(2, 27, 12, 1, k('mwhite', 2)); p.rect(2, 28, 12, 1, k('mconc', 3))
    glass_fill(p, kind)
    p.rect(7, 5, 1, 21, k('mmetal', 4)); p.rect(8, 5, 1, 21, k('mmetal', 2))

def win_B(p, kind):
    base_wall(p)
    p.rect(2, 3, 12, 2, k('mbrick', 2))                      # 깊은 문미 그늘
    p.rect(2, 3, 12, 1, k('mbrick', 1))
    p.rect(2, 5, 1, 22, k('mbrick', 3)); p.rect(3, 5, 1, 22, k('mmetal', 2))
    p.rect(4, 5, 9, 1, k('mmetal', 2)); p.rect(13, 5, 1, 22, k('mmetal', 5)); p.rect(4, 26, 9, 1, k('mmetal', 3))
    p.rect(1, 27, 14 - 0, 0, None) if False else None
    p.rect(2, 27, 12, 1, k('mwhite', 3)); p.rect(2, 28, 12, 1, k('mtile', 1)); p.rect(2, 29, 12, 1, k('mtile', 2))
    glass_fill(p, kind)
    p.rect(8, 6, 1, 20, k('mmetal', 3)); p.rect(9, 6, 1, 20, k('mmetal', 1))

def glass_fill(p, kind):
    x0, y0, x1, y1 = (3, 5, 13, 26) if S == 'A' else (4, 6, 13, 26)
    w, h = x1 - x0, y1 - y0
    if kind == 'plain':
        if S == 'A':
            p.rect(x0, y0, w, h, k('mdglass', 3)); p.rect(x0, y0, w, 2, k('mdglass', 5)); p.rect(x0, y0 + 2, w, 3, k('mdglass', 4))
            for i in range(6): p.px(4 + i, 13 - i, k('mdglass', 6))
            for i in range(4): p.px(9 + i, 20 - i, k('mdglass', 6))
        else:
            p.rect(x0, y0, w, h, k('mdglass', 2)); p.rect(x0, y0, w, 3, k('mdglass', 3)); p.rect(x0, y1 - 4, w, 4, k('mdglass', 1))
            p.rect(x0, y0, w, 1, k('mdglass', 0))
            for i in range(5): p.px(5 + i, 13 - i, k('mdglass', 5))
            for i in range(3): p.px(10 + i, 19 - i, k('mdglass', 4))
    elif kind == 'lit':
        p.rect(x0, y0, w, h, k('hinoki', 5)); p.rect(x0, y0, w, 3, k('taxi', 5)); p.rect(x0, y0 + 3, w, 1, k('taxi', 4))
        p.rect(x0, y1 - 6, w, 6, k('hinoki', 3)); p.rect(x0, y1 - 6, w, 1, k('hinoki', 4))
        p.rect(x0 + 1, y0 + 8, 2, 8, k('akachin', 3)); p.rect(x0 + 1, y0 + 8, 1, 8, k('akachin', 4))      # 커튼
        p.rect(10, 14, 2, 2, k('sumi', 3)); p.rect(9, 16, 4, 6, k('sumi', 2)); p.rect(9, 16, 1, 6, k('sumi', 3))   # 사람 그림자
        if S == 'B':
            p.rect(x0, y0, w, 2, k('hinoki', 3)); p.rect(x0, y0, 1, h, k('hinoki', 2))
    else:                                                    # sign: 색 판 + 가나 한 자
        bg = {'A': ('akachin', 3), 'B': ('neon', 3), 'C': ('kblue', 3)}[S]
        p.rect(x0, y0, w, h, k(*bg)); p.rect(x0, y0, w, 1, k(bg[0], 5)); p.rect(x0, y1 - 1, w, 1, k(bg[0], 1))
        p.rect(x0, y0, 1, h, k(bg[0], 4)); p.rect(x1 - 1, y0, 1, h, k(bg[0], 1))
        gx = x0 + (w - 6) // 2 + 0
        p.art(gx, 8, ['.####.', '......', '######', '....##', '...##.', '..##..', '##....', '......'], {'#': k('washi', 5)})
        for dx in range(gx, gx + 7, 2): p.px(dx, 18, k('taxi', 4))
        p.rect(gx, 21, 6, 1, k('washi', 3)); p.rect(gx, 23, 4, 1, k('washi', 2))

def win_C(p, kind):
    base_wall(p)
    p.rect(2, 4, 12, 1, k('mconc', 5))                       # 돌 처마띠(문미)
    p.rect(2, 5, 12, 1, k('mbrick', 1))
    for wx in (3, 9):
        gl = {'plain': ('mdglass', 3), 'lit': ('hinoki', 5), 'sign': ('kblue', 3)}[kind]
        p.rect(wx, 6, 4, 18, k('mmetal', 2))                 # 창틀
        p.rect(wx + 1, 7, 2, 16, k(*gl)); p.rect(wx + 1, 7, 2, 2, k(gl[0], gl[1] + 2)); p.rect(wx, 6, 1, 18, k('mmetal', 4))
        p.px(wx, 6, k('mbrick', 3)); p.px(wx + 3, 6, k('mbrick', 3))          # 아치 모서리
        p.px(wx, 7, k('mbrick', 3)); p.px(wx + 3, 7, k('mbrick', 3))
        p.rect(wx + 1, 14, 2, 1, k('mmetal', 3))
        if kind == 'lit':
            p.rect(wx + 1, 7, 2, 2, k('taxi', 5)); p.rect(wx + 1, 19, 2, 4, k('hinoki', 3))
            if wx == 9: p.rect(wx + 1, 12, 2, 2, k('sumi', 3)); p.rect(wx + 1, 14, 2, 5, k('sumi', 2))
        if kind == 'plain':
            p.px(wx + 1, 9, k('mdglass', 6)); p.px(wx + 2, 8, k('mdglass', 6))
        if kind == 'sign':
            p.px(wx + 1, 12, k('washi', 5)); p.px(wx + 2, 12, k('washi', 5)); p.rect(wx + 1, 15, 2, 1, k('washi', 4)); p.rect(wx + 1, 18, 2, 1, k('taxi', 4))
    # 발코니 난간(실루엣): 위 손잡이 + 난간대 + 바닥판
    p.rect(2, 24, 12, 1, k('mmetal', 5))
    for x in range(2, 14):
        if x % 2 == 0: p.rect(x, 25, 1, 2, k('mmetal', 3))
        else: p.rect(x, 25, 1, 2, k('mbrick', 1))
    p.rect(2, 27, 12, 1, k('mconc', 5)); p.rect(2, 28, 12, 1, k('mconc', 3)); p.rect(2, 29, 12, 1, k('mbrick', 2))

WIN = {'A': win_A, 'B': win_B, 'C': win_C}[S]
for slug, kind in (('win_plain', 'plain'), ('win_lit', 'lit'), ('win_sign', 'sign')):
    WIN(P(slug), kind)

# ───────────── 옥상 ─────────────
FL = k('mpave', 3); FLJ = k('mpave', 2); SH = k('mpave', 1)
TOP = {'A': (k('mconc', 6), k('mconc', 5), k('mconc', 5)), 'B': (k('mtile', 5), k('mtile', 4), k('mtile', 3)), 'C': (k('mconc', 6), k('mconc', 5), k('mconc', 4))}[S]
FACE = {'A': (k('mconc', 3), k('mconc', 4)), 'B': (k('mtile', 1), k('mtile', 3)), 'C': (k('mbrick', 2), k('mbrick', 3))}[S]
FSH = {'A': k('mconc', 3), 'B': k('mtile', 1), 'C': k('mbrick', 2)}[S]     # 면 아래 그늘줄
SHD = k('mpave', 0) if S == 'B' else SH        # B 는 그림자 더 깊게
def floor_px(x, y):
    if y == 7 or x == 7: return FLJ
    return FL

def side_left(p, y0, y1):        # 왼 난간 윗면 띠 x0..2
    for y in range(y0, y1):
        p.px(0, y, TOP[0]); p.px(1, y, TOP[1]); p.px(2, y, TOP[2])
def side_right(p, y0, y1):
    for y in range(y0, y1):
        p.px(13, y, TOP[1]); p.px(14, y, TOP[2] if S != 'B' else k('mtile', 3)); p.px(15, y, k('mconc', 3) if S != 'B' else k('mtile', 2))

def notch(p, x0, x1, y):         # C: 난간 윗면 계단식 톱니 (실루엣)
    pass

def roof_n(p, xs, left, right, repeat=False):
    for x in xs:
        for y in range(0, 3): p.px(x, y, TOP[y])
        if repeat and x % 8 == 7:
            for y in range(0, 3): p.px(x, y, k('mconc', 4) if S != 'B' else k('mtile', 2))
        p.px(x, 3, FACE[0])
        for y in range(4, 12): p.px(x, y, FACE[1])
        p.px(x, 12, FACE[0])
        p.px(x, 13, SHD); p.px(x, 14, SHD); p.px(x, 15, FL)
        if S == 'C':                              # C 벽돌 난간 안쪽 면에도 벽돌 줄
            for y in (6, 9): p.px(x, y, k('mbrick', 4))
        if S == 'B':
            p.px(x, 4, k('mtile', 2)); p.px(x, 11, k('mtile', 1))

def roof_floor(p, xs, ys):
    for y in ys:
        for x in xs: p.px(x, y, floor_px(x, y))

# 뒤 난간 3
p = P('roof_nl'); roof_n(p, range(3, 16), 1, 0); roof_floor(p, range(3, 16), [15]); side_left(p, 0, 16)
for y in (13, 14): p.px(2, y, TOP[2])
for x in (3, 4, 5): p.px(x, 15, SH)
for y in range(3, 16): p.px(2, y, TOP[2])
p = P('roof_nm'); roof_n(p, range(16), 0, 0, True)
p = P('roof_nr'); roof_n(p, range(0, 13), 0, 1); side_right(p, 0, 16)
for x in range(13, 16): pass
for y in range(0, 3):
    p.px(13, y, TOP[y]); p.px(14, y, TOP[y]); p.px(15, y, k('mconc', 3) if S != 'B' else k('mtile', 2))
# 옥상 바닥 + 옆 난간
p = P('roof_ml'); roof_floor(p, range(6, 16), range(16)); side_left(p, 0, 16)
for x in (3, 4, 5):
    for y in range(16): p.px(x, y, SHD if x < 5 else SH)
p = P('roof_mm'); roof_floor(p, range(16), range(16))
p = P('roof_mr'); roof_floor(p, range(0, 13), range(16)); side_right(p, 0, 16)
# 앞 난간 3
def roof_s(p, xs, repeat=False):
    for x in xs:
        for y in range(0, 9): p.px(x, y, floor_px(x, y))
        for y in range(3): p.px(x, 9 + y, TOP[y])
        if repeat and x % 8 == 7:
            for y in range(3): p.px(x, 9 + y, k('mconc', 4) if S != 'B' else k('mtile', 2))
        p.px(x, 12, FACE[0]); p.px(x, 13, FACE[1]); p.px(x, 14, FACE[1]); p.px(x, 15, FSH)
        if S == 'C':
            p.px(x, 14, k('mbrick', 5) if x % 8 != 3 else k('mbrick', 3))
p = P('roof_sl'); roof_s(p, range(3, 16)); side_left(p, 0, 12)
for y in range(0, 9):
    for x in (3, 4, 5): p.px(x, y, SHD if x < 5 else SH)
for y in range(12, 16):
    p.px(0, y, EDGE[0]); p.px(1, y, EDGE[1]); p.px(2, y, FACE[1])
p.px(0, 15, EDGE[1]); p.px(1, 15, FSH); p.px(2, 15, FSH)
p = P('roof_sm'); roof_s(p, range(16), True)
p = P('roof_sr'); roof_s(p, range(0, 13)); side_right(p, 0, 12)
for y in range(12, 16):
    p.px(13, y, FACE[1]); p.px(14, y, EDGE[2]); p.px(15, y, EDGE[3])
p.px(13, 15, FSH); p.px(14, 15, EDGE[3])

# ───────────── 옥상 설비 (object, 투명 바탕) ─────────────
p = P('rt_tank')
if S in 'AB':
    d = S == 'B'
    p.rect(5, 7, 22, 15, k('mmetal', 4))                      # 몸통
    p.rect(5, 7, 22, 1, k('mmetal', 6)); p.rect(5, 8, 22, 1, k('mmetal', 5))
    p.rect(5, 7, 1, 15, k('mmetal', 5)); p.rect(26, 7, 1, 15, k('mmetal', 1 if d else 2)); p.rect(25, 8, 1, 14, k('mmetal', 2 if d else 3))
    for x in (11, 16, 21): p.rect(x, 9, 1, 12, k('mmetal', 2 if d else 3))       # 리브
    p.rect(5, 21, 22, 1, k('mmetal', 1 if d else 2))
    p.rect(4, 4, 24, 3, k('mmetal', 5)); p.rect(4, 4, 24, 1, k('mwhite', 3)); p.rect(4, 4, 1, 3, k('mwhite', 3)); p.rect(27, 4, 1, 3, k('mmetal', 2))  # 뚜껑 윗면
    p.rect(14, 1, 5, 3, k('mmetal', 3)); p.rect(14, 1, 5, 1, k('mmetal', 5)); p.rect(18, 2, 1, 2, k('mmetal', 1))   # 맨홀 뚜껑
    for x in (7, 23):                                          # 다리
        p.rect(x, 22, 2, 7, k('mmetal', 3)); p.rect(x, 22, 1, 7, k('mmetal', 5))
    p.rect(9, 25, 14, 1, k('mmetal', 3)); p.rect(9, 26, 14, 1, k('mmetal', 2))   # 가로대
    for x in range(8, 30): p.px(x, 29, '~')
    for x in range(10, 31): p.px(x, 30, '-')
    if d:
        p.rect(6, 22, 20, 2, '~')                              # 몸통 밑 그늘
else:                                                          # C: 원통 물탱크 + 뾰족 지붕
    for j, w in enumerate((2, 6, 10, 14)):
        x0 = 16 - w // 2; p.rect(x0, 2 + j * 2, w, 2, k('mmetal', 3)); p.rect(x0, 2 + j * 2, 1, 2, k('mmetal', 5)); p.rect(x0 + w - 1, 2 + j * 2, 1, 2, k('mmetal', 1))
    p.rect(9, 10, 14, 13, k('mmetal', 4)); p.rect(9, 10, 2, 13, k('mmetal', 6)); p.rect(10, 10, 1, 13, k('mmetal', 5)); p.rect(21, 10, 2, 13, k('mmetal', 2)); p.rect(22, 10, 1, 13, k('mmetal', 1))
    for y in (13, 18): p.rect(9, y, 14, 1, k('mmetal', 2))
    p.rect(9, 22, 14, 1, k('mmetal', 1))
    for x in (11, 20): p.rect(x, 23, 2, 6, k('mmetal', 3)); p.px(x, 23, k('mmetal', 5))
    p.rect(11, 26, 11, 1, k('mmetal', 2))
    for x in range(10, 28): p.px(x, 29, '~')
    for x in range(12, 29): p.px(x, 30, '-')

p = P('rt_ac')
if S in 'AB':
    p.rect(2, 3, 12, 10, k('mwhite', 2)); p.rect(2, 3, 12, 1, k('mwhite', 4)); p.rect(2, 3, 1, 10, k('mwhite', 3)); p.rect(13, 3, 1, 10, k('mwhite', 1 if S == 'A' else 0)); p.rect(2, 12, 12, 1, k('mwhite', 0))
    p.rect(4, 5, 7, 7, k('mmetal', 1)); p.rect(5, 6, 5, 5, k('mmetal', 3)); p.px(7, 8, k('mmetal', 1)); p.px(8, 8, k('mmetal', 1)); p.px(7, 7, k('mmetal', 5)); p.px(6, 9, k('mmetal', 5))
    for y in (7, 9): p.rect(5, y, 5, 1, k('mmetal', 2))
    p.rect(3, 13, 2, 1, k('mmetal', 2)); p.rect(11, 13, 2, 1, k('mmetal', 2))
    for x in range(4, 15): p.px(x, 14, '~')
    for x in range(6, 15): p.px(x, 15, '-')
else:
    p.rect(1, 4, 14, 8, k('kasa', 3)); p.rect(1, 4, 14, 1, k('kasa', 4)); p.rect(1, 4, 1, 8, k('kasa', 4)); p.rect(14, 4, 1, 8, k('kasa', 1)); p.rect(1, 11, 14, 1, k('kasa', 1))
    for x in (4, 7, 10): p.rect(x, 5, 1, 6, k('kasa', 1))
    p.rect(2, 12, 2, 2, k('mmetal', 2)); p.rect(12, 12, 2, 2, k('mmetal', 2))
    for x in range(3, 15): p.px(x, 14, '~')
    for x in range(5, 15): p.px(x, 15, '-')

# ───────────── 층 간판 (wall, 투명) ─────────────
def fsign(slug, body, x0, x1, left=False, right=False):
    p = P(slug); ba, bb = body
    for x in range(x0, x1):
        p.px(x, 3, k('washi', 5)); p.px(x, 4, k(ba, 5)); p.rect(x, 5, 1, 6, k(ba, 3)); p.px(x, 11, k(ba, 2)); p.px(x, 12, k(ba, 1))
        p.px(x, 13, '-'); p.px(x, 14, '-')
        if S == 'B': p.px(x, 15, '-')
        if x % 4 == 1: p.px(x, 7, k(ba, 5)); p.px(x, 8, k(ba, 4))     # 색전구 점
    if left:
        for y in range(3, 13): p.px(x0, y, k('washi', 5)); p.px(x0 + 1, y, k(ba, 4))
        p.px(x0, 3, None) if S == 'C' else None
        p.rect(x0 + 2, 0, 2, 3, k('mmetal', 3)); p.px(x0 + 2, 0, k('mmetal', 5))
        for y in (13, 14): p.px(x0, y, None)
    if right:
        for y in range(3, 13): p.px(x1 - 1, y, k(ba, 1)); p.px(x1 - 2, y, k(ba, 2))
        p.rect(x1 - 4, 0, 2, 3, k('mmetal', 3)); p.px(x1 - 4, 0, k('mmetal', 5))
        p.px(x1 - 1, 3, None) if S == 'C' else None
    if S == 'C':                                           # 모서리 깎기(실루엣)
        if left: p.px(x0, 12, None); p.px(x0, 3, None); p.px(x0, 4, None) if False else None
        if right: p.px(x1 - 1, 12, None); p.px(x1 - 1, 3, None)
    return p

CM = {'A': ('kblue', 'akachin'), 'B': ('korange', 'ai'), 'C': ('kgreen', 'neon')}[S]
fsign('fsign_l', (CM[0], 0), 2, 16, left=True)
fsign('fsign_m', (CM[0], 0), 0, 16)
fsign('fsign_m2', (CM[1], 0), 0, 16)
fsign('fsign_r', (CM[0], 0), 0, 14, right=True)

# ───────────── 세로 돌출 간판 ─────────────
VC = {'A': 'neonc', 'B': 'shu', 'C': 'taxi'}[S]
def vbox(p, y0, y1):
    for y in range(y0, y1):
        p.px(3, y, k('washi', 5)); p.px(4, y, k(VC, 5)); p.rect(5, y, 6, 1, k(VC, 3)); p.px(11, y, k(VC, 2)); p.px(12, y, k(VC, 1))
        p.px(13, y, '-'); p.px(14, y, '-')
p = P('vsign_t')
p.rect(7, 0, 2, 3, k('mmetal', 3)); p.px(7, 0, k('mmetal', 5)); p.px(6, 0, k('mmetal', 4)); p.px(9, 0, k('mmetal', 2))
p.rect(3, 3, 10, 1, k('washi', 5)); p.rect(4, 3, 8, 1, k(VC, 5)); p.px(3, 3, k('washi', 5)); p.px(12, 3, k(VC, 2))
vbox(p, 4, 16); p.rect(3, 15, 10, 1, k(VC, 1)); p.px(3, 15, k(VC, 2))
p.rect(6, 6, 4, 5, k(VC, 4)); p.rect(6, 6, 4, 1, k('washi', 4)); p.rect(6, 10, 4, 1, k(VC, 2))
p = P('vsign_m')
vbox(p, 0, 16); p.rect(3, 0, 10, 1, k(VC, 1)); p.rect(4, 1, 8, 1, k(VC, 5)); p.px(3, 0, k(VC, 2)); p.px(3, 1, k('washi', 5)); p.px(12, 0, k(VC, 1))
p.rect(6, 4, 4, 8, k(VC, 4)); p.rect(6, 4, 4, 1, k('washi', 4)); p.rect(6, 11, 4, 1, k(VC, 2)); p.rect(7, 6, 2, 1, k('lacq', 3)); p.rect(7, 8, 2, 1, k('lacq', 3))
p.rect(3, 15, 10, 1, k(VC, 1)); p.px(3, 15, k(VC, 2)); p.px(12, 15, k(VC, 1))
p = P('vsign_b')
p.rect(3, 0, 10, 1, k(VC, 1)); p.rect(4, 1, 8, 1, k(VC, 5)); p.px(3, 1, k('washi', 5)); p.px(3, 0, k(VC, 2))
vbox(p, 2, 10)
p.rect(6, 4, 4, 4, k(VC, 4)); p.rect(6, 4, 4, 1, k('washi', 4))
p.rect(3, 10, 10, 1, k(VC, 1)); p.rect(4, 11, 8, 1, k(VC, 0)); p.px(3, 10, k(VC, 2))
for x in range(5, 15): p.px(x, 12, '-')
for x in range(7, 15): p.px(x, 13, '-')
if S == 'C':                                       # 초롱 모양: 아랫 술
    p.rect(7, 12, 2, 3, k('lacq', 2)); p.px(7, 14, k('akachin', 3)); p.px(8, 14, k('akachin', 3))

# ───────────── 계단 입구 (16×32, 불투명) ─────────────
p = P('stair_door'); base_wall(p)
p.rect(2, 3, 12, 1, k('mconc', 2))                         # 차양 그늘줄
p.rect(2, 4, 12, 1, k('mconc', 5)); p.rect(2, 5, 12, 1, k('mconc', 3))
p.rect(3, 6, 10, 23, k('mmetal', 3)); p.rect(3, 6, 1, 23, k('mmetal', 5)); p.rect(12, 6, 1, 23, k('mmetal', 1))         # 문틀
p.rect(4, 7, 8, 21, k('masph', 0))
steps = [(8, 'masph', 1), (11, 'masph', 2), (14, 'masph', 3), (17, 'mpave', 0), (20, 'mpave', 1), (23, 'mpave', 3), (26, 'mconc', 4)]
for y, r, t in steps:
    p.rect(4, y, 8, 2, k(r, t)); p.rect(4, y, 8, 1, k(r, min(t + 2, 7) if r == 'mpave' else t + 1))
    p.rect(4, y + 2, 8, 1, k('masph', 1) if y < 20 else k('masph', 2))
p.rect(5, 7, 6, 1, k('taxi', 2)); p.rect(6, 7, 4, 1, k('taxi', 4))                # 안쪽 전등
p.rect(4, 8, 1, 19, k('mmetal', 5))                                              # 난간
if S == 'B':
    p.rect(4, 7, 8, 3, k('masph', 0)); p.rect(4, 7, 1, 21, k('masph', 0)); p.rect(4, 8, 1, 19, k('mmetal', 2))
    p.rect(3, 6, 10, 1, k('mmetal', 1))
# 층 안내판
if S == 'C':
    p.rect(13, 12, 1, 1, k('shu', 4))
else:
    pass
for y0, c in ((2, 'akachin'), (5, 'kblue')): pass
p.rect(13, 11, 1, 1, k('washi', 3))
# 바닥 문턱
p.rect(3, 29, 10, 1, k('mconc', 4)); p.rect(3, 30, 10, 1, k('mconc', 3))
for x in (0, 1, 2, 13, 14, 15):
    p.px(x, 29, wallpx(x, 29)); p.px(x, 30, wallpx(x, 30))

# ───────────── 내보내기 ─────────────
missing = []
for slug, (ox, oy) in AT.items():
    pass
POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
legend, rev, rows = {}, {}, []
for r in G:
    line = ''
    for c in r:
        if c is None: line += '.'
        elif isinstance(c, str): line += c
        else:
            if c not in rev:
                assert len(rev) < len(POOL), '색이 너무 많다'
                ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
            line += rev[c]
    rows.append(line)
out = os.path.join(KIT, f'k1-{S}.pxg')
open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=f'kit_bldg k1-{S}'))
print(out, len(legend), '색')
