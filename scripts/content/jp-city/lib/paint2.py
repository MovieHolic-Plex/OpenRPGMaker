from paint import *
from paint import FH
from jfont import glyph

def roofsign_band(n, col='aka'):
    W = n * 16; c = Cv(W, 64)
    r = roof_band(n); c.a[32:] = r.a
    x, w, h, base = 8, W - 16, 18, 46
    c.R(x + 3, base - 6, 2, 6, K('tekko', 1)); c.R(x + w - 5, base - 6, 2, 6, K('tekko', 1))
    c.R(x, base - 6 - h, w, 2, K(col, 4)); c.R(x, base - 4 - h, w, h, K(col, 1)); c.VL(x, base - 4 - h, h, K(col, 3)); c.VL(x + w - 1, base - 4 - h, h, K(col, -1)); c.HL(x, base - 5, w, K(col, -2))
    for k in range(w): c.P(x + 2 + k, base, K('hodo', 0))
    return c

def gl(c, x, y, ch, col, bold=False, clip=None):
    g = glyph(ch)
    for yy, xx in zip(*np.nonzero(g)):
        px = x + xx
        if clip and not (clip[0] <= px < clip[1]): continue
        c.P(px, y + yy, col)
        if bold and (not clip or px + 1 < clip[1]): c.P(px + 1, y + yy, col)
def deco_rtext(text, fg='shiro'):          # 옥상 간판 글자(머리 띠 맨 위에서 글자 높이 25)
    c = Cv(16 * len(text), 48)
    for i, ch in enumerate(text): gl(c, i * 16, 25, ch, K(fg, 3), bold=True)
    return c
def deco_vsign(text, bg='aka', fg='shiro', ft=3):   # 세로 간판(소데看板) 1칸 폭, 글자 한 칸씩
    blank = isinstance(text, int); text = ' ' * text if blank else text
    c = Cv(16, 16 * len(text)); H = 16 * len(text)
    c.R(0, 0, 16, H, K(bg, 1)); c.VL(0, 0, H, K(bg, 3)); c.VL(15, 0, H, K(bg, -1)); c.HL(0, 0, 16, K(bg, 4)); c.HL(0, H - 1, 16, K(bg, -2))
    if blank:                                    # 글자 대신 굵은 줄 + 점 (무늬 간판)
        for j in range(H):
            for i in range(16):
                d = (i - 7.5) ** 2 + (j - 11.5) ** 2
                if d <= 30: c.P(i, j, K(fg, ft))
        for yy in range(H - 20, H - 6, 4): c.R(3, yy, 10, 2, K(fg, ft))
    else:
        for i, ch in enumerate(text): gl(c, 0, i * 16, ch, K(fg, ft), clip=(1, 15))
    return c
def deco_plate(text, bg='aka', fg='shiro', ft=3):   # 글자 두 개 가로 간판 32x16
    c = Cv(32, 16); blank = not text
    c.R(0, 0, 32, 16, K(bg, 1)); c.HL(0, 0, 32, K(bg, 4)); c.VL(0, 0, 16, K(bg, 3)); c.VL(31, 0, 16, K(bg, -1)); c.HL(0, 15, 32, K(bg, -2))
    if blank:                                    # 무늬 간판: 원 + 물결
        for j in range(16):
            for i in range(32):
                d = (i - 9.5) ** 2 + (j - 7.5) ** 2
                if d <= 30: c.P(i, j, K(fg, ft))
        for i in range(17, 29): c.P(i, 6 + (i // 2) % 2 * 2, K(fg, ft)); c.P(i, 10 - (i // 2) % 2 * 2, K(fg, ft))
    else:
        for i, ch in enumerate(text[:2]): gl(c, i * 16, 0, ch, K(fg, ft), bold=True, clip=(1, 31))
    return c
def deco_board(text, bg='ita', fg='kinari', ft=2):  # 지상층 간판 널 위 글자(칸 폭 = 글자 수)
    c = Cv(16 * len(text), 16)
    c.R(0, 1, c.w, 14, K(bg, -2)); c.HL(0, 1, c.w, K(bg, 1)); c.HL(0, 14, c.w, K(bg, -3))
    for i, ch in enumerate(text): gl(c, i * 16, 0, ch, K(fg, ft), bold=True)
    return c

def deco_fe(end=False):
    c = Cv(32, 32); x = 4; py = FH - 12
    c.R(x, py, 22, 3, K('tekko', 3)); c.HL(x, py, 22, K('tekko', 5)); c.R(x, py + 3, 22, 1, K('tekko', -2))
    for i in range(x + 1, x + 22, 3): c.VL(i, py - 6, 6, K('tekko', 1))
    c.HL(x, py - 7, 22, K('tekko', 4))
    if not end:
        for k in range(14):
            yy = py + 4 + int(k * (FH - 5) / 14)
            if yy + 2 <= 32: c.R(x + 2 + k, yy, 8, 2, K('tekko', 2)); c.HL(x + 2 + k, yy, 8, K('tekko', 4))
    c.R(x - 1, 6, 1, FH - 6, K('tekko', -1))
    return c
def deco_sign_h(col):
    c = Cv(32, 32); sx, sy, sw = 2, 8, 28
    c.R(sx, sy - 2, sw, 2, K(col, 4)); c.R(sx, sy, sw, 12, K(col, 1)); c.VL(sx, sy, 12, K(col, 3)); c.VL(sx + sw - 1, sy, 12, K(col, -1)); c.HL(sx, sy + 11, sw, K(col, -2))
    for q in range(4, sw - 4, 5): c.R(sx + q, sy + 3, 3, 5, K('shiro', 3)); c.HL(sx + q, sy + 3, 3, K('shiro', 4))
    for i in range(0, sw - 2, 2): c.P(sx + 2 + i, sy + 12, K('hodo', -1))
    return c
def deco_vstack(col):
    c = Cv(16, 32); vx = 1
    c.R(vx + 1, 5, 11, FH - 12, K(col, 1)); c.VL(vx + 1, 5, FH - 12, K(col, 3)); c.VL(vx + 11, 5, FH - 12, K(col, -1)); c.R(vx + 2, 3, 11, 2, K(col, 4)); c.HL(vx + 1, FH - 7, 11, K(col, -2))
    for j in range(8, FH - 10, 6): c.R(vx + 4, j, 6, 3, K('shiro', 3)); c.HL(vx + 4, j, 6, K('shiro', 4))
    for j in range(0, FH - 6, 2): c.P(vx + 12, 6 + j, K('hodo', -1))
    return c
def deco_wallad(col):
    c = Cv(64, 32); x, y, w, h = 1, 5, 62, 18
    c.R(x, y, w, h, K(col, 1)); c.HL(x, y, w, K(col, 4)); c.VL(x, y, h, K(col, 3)); c.VL(x + w - 1, y, h, K(col, -1)); c.HL(x, y + h - 1, w, K(col, -2))
    for k in range(5): c.R(x + 4 + k * 8, y + 4, 6, 4, K('shiro', 3))
    c.R(x + 4, y + h - 10, w - 8, 3, K('shiro', 3)); c.R(x + 4, y + h - 6, w - 18, 2, K('kii', 3))
    for j in range(h):
        for i in range(w):
            if (i - w + 12) ** 2 + (j - h // 2) ** 2 <= 36: c.P(x + i, y + j, K('kii', 3))
    for i in range(0, w - 2, 2): c.P(x + 2 + i, y + h, K('hodo', -1))
    return c

def cell(): return Cv(16, 16)
def sw_cell(kind='plain'):
    c = cell()
    for y in range(16):
        for x in range(16):
            col = K('hodo', 2)
            if x == 0 or y == 0: col = K('hodo', 0)
            elif x == 1 or y == 1: col = K('hodo', 3)
            c.P(x, y, col)
    if kind == 'tactile':
        for x in range(16):
            if x % 4 < 2: c.P(x, 8, K('kii', 2)); c.P(x, 9, K('kii', 1))
            else: c.P(x, 8, K('kii', 3)); c.P(x, 9, K('kii', 2))
    if kind == 'shade': shade(c, 0, 0, 16, 16, -1, ('hodo',))
    return c
def asphalt(c):
    for y in range(16):
        for x in range(16): c.P(x, y, K('yoru', 1) if (x * 7 + y * 13) % 17 else K('yoru', 2))
def road_cell(kind):
    c = cell(); asphalt(c)
    if kind == 'n':
        for x in range(16): c.P(x, 0, K('hodo', 5)); c.P(x, 1, K('hodo', 3)); c.P(x, 2, K('yoru', -1))
    if kind == 's':
        for x in range(16): c.P(x, 15, K('hodo', 5)); c.P(x, 14, K('hodo', 3)); c.P(x, 13, K('yoru', -1))
    if kind == 'dash': c.R(0, 7, 12, 2, K('shiro', 3))
    return c
def cw_cell(kind):
    c = road_cell({'n': 'n', 'm': 'c', 's': 's'}[kind]); y0, y1 = {'n': (6, 16), 'm': (0, 16), 's': (0, 10)}[kind]
    c.R(4, y0, 8, y1 - y0, K('shiro', 3)); c.VL(4, y0, y1 - y0, K('shiro', 4)); c.VL(11, y0, y1 - y0, K('shiro', 1))
    return c
def guard_cell():
    c = cell(); y = 14
    for x in range(16):
        c.P(x, y - 8, K('shiro', 4)); c.P(x, y - 7, K('shiro', 3)); c.P(x, y - 6, K('tekko', 1)); c.P(x, y - 3, K('shiro', 3)); c.P(x, y - 2, K('tekko', 1))
    x = 6
    c.R(x, y - 9, 3, 10, K('shiro', 3)); c.VL(x, y - 9, 10, K('shiro', 5)); c.VL(x + 2, y - 9, 10, K('tekko', 0)); c.R(x - 1, y - 11, 5, 2, K('shiro', 4)); c.P(x + 1, y - 5, K('aka', 3))
    for x in range(0, 16, 2): c.P(x, y + 1, K('hodo', 0))
    return c


def planter():            # 화단 32x16
    c = Cv(32, 16)
    c.R(1, 6, 30, 9, K('tairu', -1)); c.HL(1, 6, 30, K('shiro', 3)); c.HL(1, 7, 30, K('shiro', 1)); c.VL(1, 6, 9, K('tairu', 1)); c.VL(30, 6, 9, K('tekko', -2)); c.HL(1, 14, 30, K('tekko', -3))
    c.R(3, 8, 26, 4, K('midori', -1))
    for i in range(4, 28, 3):
        c.P(i, 7, K('midori', 2)); c.P(i + 1, 8, K('midori', 2)); c.P(i, 9, K('shiro', 4) if i % 6 == 4 else K('pinku', 3))
    for i in range(0, 30, 2): c.P(2 + i, 15, K('hodo', 0))
    return c
def pot():                # 화분 16x32
    c = Cv(16, 32)
    for (x, y, w) in ((3, 8, 10), (2, 12, 12), (4, 6, 8), (5, 3, 6)):
        pass
    c.R(4, 14, 8, 10, K('midori', 0)); c.R(3, 10, 10, 8, K('midori', 1)); c.R(2, 6, 12, 8, K('midori', 2)); c.R(5, 3, 6, 5, K('midori', 3)); c.P(4, 8, K('midori', 4)); c.P(8, 5, K('midori', 4)); c.P(11, 10, K('midori', 4))
    c.R(4, 22, 8, 7, K('daidai', 1)); c.HL(3, 22, 10, K('daidai', 3)); c.VL(4, 23, 6, K('daidai', 2)); c.VL(11, 23, 6, K('daidai', -1)); c.HL(4, 29, 8, K('daidai', -2))
    for i in range(10): c.P(5 + i, 30, K('hodo', 0)) if i % 2 == 0 else None
    return c
def bench():              # 벤치 32x16
    c = Cv(32, 16)
    for j, t in ((4, 3), (7, 2), (10, 1)): c.R(2, j, 28, 2, K('ki', t)); c.HL(2, j, 28, K('ki', t + 1))
    c.R(3, 12, 2, 3, K('tekko', 1)); c.R(27, 12, 2, 3, K('tekko', 1)); c.VL(3, 1, 11, K('tekko', 2)); c.VL(28, 1, 11, K('tekko', -1))
    for i in range(0, 28, 2): c.P(4 + i, 15, K('hodo', 0))
    return c
def bollard():            # 볼라드 16x16
    c = Cv(16, 16)
    c.R(6, 3, 4, 11, K('shiro', 3)); c.VL(6, 3, 11, K('shiro', 4)); c.VL(9, 3, 11, K('hodo', 0)); c.R(6, 3, 4, 2, K('aka', 2)); c.R(6, 8, 4, 2, K('aka', 2)); c.HL(6, 2, 4, K('shiro', 4))
    for i in range(5, 12): c.P(i, 14, K('hodo', 0))
    return c
def manhole():
    c = road_cell('c')
    for j in range(16):
        for i in range(16):
            d = (i - 7.5) ** 2 + (j - 7.5) ** 2
            if d <= 30: c.P(i, j, K('tekko', 0) if d > 22 else K('tekko', -2) if (i + j) % 4 else K('tekko', 1))
    return c


def deco_ac(kind=0):          # 실외기 1칸 x 1층 (벽 중간 높이)
    c = Cv(16, 32)
    c.R(2, 12, 12, 9, K('shiro', 2)); c.HL(2, 12, 12, K('shiro', 4)); c.VL(2, 12, 9, K('shiro', 3)); c.VL(13, 12, 9, K('conc', 0)); c.HL(2, 20, 12, K('conc', -1))
    c.R(4, 14, 7, 5, K('tekko', -1)); c.HL(4, 14, 7, K('tekko', 1))
    for i in range(5, 11, 2): c.VL(i, 15, 3, K('tekko', 3))
    c.P(12, 13, K('kii', 3)) if kind else None
    c.R(2, 21, 12, 1, K('tekko', 1)); c.R(4, 22, 2, 2, K('tekko', 0)); c.R(10, 22, 2, 2, K('tekko', 0))
    for q in range(3): c.P(6 + q * 2, 24 + q, K('conc', 1))                       # 물 흘린 자국
    return c
def deco_pipe():              # 배수관 1칸 x 1층
    c = Cv(16, 32)
    c.R(11, 0, 3, 32, K('tekko', 2)); c.VL(11, 0, 32, K('tekko', 4)); c.VL(13, 0, 32, K('tekko', -1))
    for j in (3, 15, 27): c.R(10, j, 5, 2, K('tekko', 3)); c.HL(10, j, 5, K('tekko', 5)); c.HL(10, j + 2, 5, K('hodo', -1))
    return c
def deco_laundry():           # 베란다 빨래 2칸 x 1층
    c = Cv(32, 32)
    c.HL(2, 8, 28, K('tekko', 2)); c.VL(2, 6, 4, K('tekko', 1)); c.VL(29, 6, 4, K('tekko', 1))
    cols = ['shiro', 'sora', 'kii', 'shiro', 'aka', 'shiro']
    for k, col in enumerate(cols):
        x = 4 + k * 4; h = 9 + (k % 3) * 2
        c.R(x, 9, 3, h, K(col, 3)); c.HL(x, 9, 3, K(col, 4)); c.VL(x + 2, 9, h, K(col, 1)); c.P(x, 8, K('tekko', 3)); c.P(x + 2, 8, K('tekko', 3))
    c.R(2, 22, 28, 2, K('tekko', 1)); c.HL(2, 22, 28, K('tekko', 4))
    return c
def deco_sunshade(col='sora'):  # 접이식 차양 2칸 x 1층(1층 위 창 위)
    c = Cv(32, 16)
    for i in range(1, 31):
        s = (i // 4) % 2
        c.R(i, 2, 1, 6, K(col, 3 if s else 1)); c.P(i, 8, K('shiro', 3) if s else K(col, 0))
    c.HL(1, 1, 30, K(col, 4)); c.R(1, 9, 30, 2, K('hodo', -2)) if False else None
    for i in range(2, 30, 2): c.P(i, 9, K('hodo', -1))
    return c


# ───────── 일본 생활 거리 (인도 없는 생활도로·주차장·소품) ─────────
def lane_cell(kind):          # 생활도로: 흰 외곽선(外側線)
    c = cell(); asphalt(c)
    if kind == 'n': c.HL(0, 3, 16, K('shiro', 3)); c.HL(0, 4, 16, K('shiro', 1))
    if kind == 's': c.HL(0, 11, 16, K('shiro', 1)); c.HL(0, 12, 16, K('shiro', 3))
    if kind == 'man':           # 일시정지 선: 흰 굵은 선
        c.R(0, 5, 16, 3, K('shiro', 3)); c.HL(0, 5, 16, K('shiro', 4))
    return c
def lot_cell(kind):           # 월 정액 주차장
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('yoru', 2) if (x * 5 + y * 11) % 13 else K('yoru', 3))
    if kind in ('line', 'stop'): c.R(0, 0, 2, 16, K('shiro', 3)); c.VL(0, 0, 16, K('shiro', 4))
    if kind == 'stop':
        c.R(4, 2, 9, 3, K('conc', 4)); c.HL(4, 2, 9, K('shiro', 4)); c.HL(4, 5, 9, K('conc', -1))
    if kind == 'num':           # 칸 번호 자리(작은 사각 표시)
        c.R(0, 0, 2, 16, K('shiro', 3)); c.R(6, 6, 4, 5, K('shiro', 2)); c.R(7, 7, 2, 3, K('yoru', 2))
    return c
def gravel_cell():            # 주택 앞 자갈·맨땅
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('soil', 1) if (x * 7 + y * 3) % 11 else K('soil', 2))
    for k in range(7): c.P((k * 5 + 2) % 16, (k * 7 + 1) % 16, K('conc', 3))
    return c

def curve_mirror():           # 커브미러 16x48: 주황 기둥 + 둥근 거울 2장
    c = Cv(16, 48)
    c.R(7, 12, 2, 34, K('daidai', 2)); c.VL(7, 12, 34, K('daidai', 4)); c.VL(8, 12, 34, K('daidai', 0))
    for y0 in (3, 16):
        for j in range(12):
            for i in range(14):
                d = ((i - 6.5) / 6.5) ** 2 + ((j - 5.5) / 5.5) ** 2
                if d <= 1: c.P(1 + i, y0 + j, K('daidai', 3) if d > .72 else K('sora', 3) if (i + j) % 5 else K('shiro', 4))
        c.P(4, y0 + 3, K('shiro', 4)); c.P(5, y0 + 2, K('shiro', 4))
    c.R(6, 44, 4, 2, K('hodo', 5)); c.HL(5, 47, 7, K('hodo', -1))
    return c
def post_box():               # 우체통 16x32
    c = Cv(16, 32)
    c.R(4, 6, 9, 20, K('aka', 1)); c.VL(4, 6, 20, K('aka', 3)); c.VL(12, 6, 20, K('aka', -1)); c.R(3, 4, 11, 3, K('aka', 3)); c.HL(3, 4, 11, K('aka', 4)); c.HL(3, 7, 11, K('aka', -2))
    c.R(5, 10, 7, 2, K('tekko', -3)); c.R(6, 15, 5, 5, K('kii', 3)); c.R(5, 26, 8, 3, K('aka', 0)); c.HL(4, 29, 10, K('hodo', -1))
    for i in range(0, 10, 2): c.P(5 + i, 30, K('hodo', 0))
    return c
def garbage_net():            # 쓰레기 그물 32x16: 노랑 그물 + 봉투 더미
    c = Cv(32, 16)
    for (x, w, h) in ((4, 10, 7), (12, 9, 8), (20, 8, 6), (9, 8, 9)):
        c.R(x, 15 - h, w, h, K('shiro', 2)); c.HL(x, 15 - h, w, K('shiro', 4)); c.VL(x + w - 1, 15 - h, h, K('conc', 0))
    for k in range(6): c.P(7 + k * 4, 9 + k % 3, K('kii', 3))
    for j in range(2, 15):
        for i in range(2, 30):
            if (i + j) % 3 == 0 and (i // 3 + j // 3) % 2 == 0: c.P(i, j, K('kii', 2) if j > 4 else K('kii', 3))
    c.HL(2, 2, 28, K('kii', 3)); c.VL(2, 2, 13, K('tekko', 1)); c.VL(29, 2, 13, K('tekko', 1))
    for i in range(0, 30, 2): c.P(2 + i, 15, K('hodo', 0))
    return c
def bike_rack():              # 자전거 거치대 32x16: 지붕 아래 빈 거치대 + 자전거 한 대
    c = Cv(32, 16)
    c.R(1, 0, 30, 2, K('midori', 1)); c.HL(1, 0, 30, K('midori', 4)); c.VL(1, 2, 12, K('tekko', 2)); c.VL(30, 2, 12, K('tekko', 2))
    for i in range(5, 28, 5): c.VL(i, 9, 5, K('tekko', 3)); c.P(i, 8, K('tekko', 4))
    c.HL(2, 14, 28, K('tekko', 1))
    for i in range(0, 28, 2): c.P(2 + i, 15, K('hodo', 0))
    return c
def stop_sign():              # 일시정지 표지 16x48: 빨강 역삼각 + 흰 테두리
    c = Cv(16, 48)
    c.R(7, 14, 2, 32, K('tekko', 3)); c.VL(7, 14, 32, K('tekko', 5)); c.VL(8, 14, 32, K('tekko', 0))
    for j in range(14):
        w = 14 - j
        for i in range(w + 1):
            x = 1 + j // 2 + i
            if j < 2 or i < 1 or i > w - 1 or True: c.P(x, j, K('shiro', 4) if (j < 2 or i < 2 or i > w - 2) else K('aka', 2))
    c.R(6, 3, 4, 1, K('shiro', 4)); c.R(7, 5, 2, 1, K('shiro', 4))
    c.R(6, 44, 4, 2, K('hodo', 5)); c.HL(5, 47, 7, K('hodo', -1))
    return c
def nobori(col='aka'):        # 幟 16x48: 세로 깃발 + 가는 기둥 (문양만)
    c = Cv(16, 48)
    c.R(2, 3, 1, 42, K('tekko', 2)); c.R(2, 3, 12, 1, K('tekko', 3))
    c.R(3, 4, 10, 30, K(col, 1)); c.VL(3, 4, 30, K(col, 3)); c.VL(12, 4, 30, K(col, -1)); c.HL(3, 33, 10, K(col, -2))
    for j in range(10, 28):
        for i in range(10): 
            if (i - 4.5) ** 2 + (j - 17) ** 2 <= 20: c.P(3 + i, j, K('shiro', 3))
    c.R(1, 44, 4, 2, K('hodo', 5)); c.HL(0, 47, 6, K('hodo', -1))
    return c
def coin_p():                 # 코인 파킹 P 표지 16x32
    c = Cv(16, 32)
    c.R(7, 12, 2, 18, K('tekko', 3)); c.VL(7, 12, 18, K('tekko', 5))
    c.R(1, 0, 14, 13, K('sora', 1)); c.VL(1, 0, 13, K('sora', 3)); c.VL(14, 0, 13, K('sora', -1)); c.HL(1, 0, 14, K('sora', 4)); c.HL(1, 12, 14, K('sora', -2))
    g = glyph('Ｐ'); 
    for yy, xx in zip(*np.nonzero(g)):
        if 1 <= xx <= 14 and yy <= 12: c.P(xx, yy, K('shiro', 4))
    c.R(5, 29, 6, 2, K('hodo', 5)); c.HL(4, 31, 8, K('hodo', -1))
    return c


# ───────── 일본식 도로 (QA 반영) ─────────
def stopline_cell():           # 정지선: 차선 직각 굵은 흰 선
    c = road_cell('c'); c.R(6, 0, 4, 16, K('shiro', 3)); c.VL(6, 0, 16, K('shiro', 4)); c.VL(9, 0, 16, K('shiro', 1)); return c
def stopline_n():
    c = road_cell('n'); c.R(6, 3, 4, 13, K('shiro', 3)); c.VL(6, 3, 13, K('shiro', 4)); c.VL(9, 3, 13, K('shiro', 1)); return c
def stopline_s():
    c = road_cell('s'); c.R(6, 0, 4, 13, K('shiro', 3)); c.VL(6, 0, 13, K('shiro', 4)); c.VL(9, 0, 13, K('shiro', 1)); return c
def zebra_cell(kind):          # 줄이 차 진행 방향(가로)과 평행, 줄 8px + 간격 8px
    c = road_cell({'n': 'n', 'c': 'c', 's': 's'}[kind]); y0 = {'n': 3, 'c': 0, 's': 0}[kind]; y1 = {'n': 16, 'c': 16, 's': 13}[kind]
    for j in range(y0, y1):
        if (j + (0 if kind != 'n' else 5)) % 16 in range(4, 12):
            c.HL(0, j, 16, K('shiro', 3))
    # 마모
    for (x, y) in ((3, 5), (11, 9), (7, 6), (13, 4), (2, 10)):
        if c.a[y, x, 3] and kind == 'c' and 4 <= y < 12: c.P(x, y, K('conc', 4))
    return c
def tactile_dot():             # 점형 블록(횡단 앞 경고): 노란 바탕 + 돌기
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('kii', 2))
    for y in range(2, 16, 4):
        for x in range(2, 16, 4): c.R(x, y, 2, 2, K('kii', 4)); c.P(x + 1, y + 1, K('kii', 0))
    c.VL(0, 0, 16, K('kii', 0)); c.HL(0, 0, 16, K('kii', 3)); c.HL(0, 15, 16, K('kii', 0)); c.VL(15, 0, 16, K('kii', 0)); return c
def tactile_bar():             # 선형 블록(유도): 노란 바탕 + 세로 돌기선
    c = cell()
    for y in range(16):
        for x in range(16): c.P(x, y, K('kii', 2))
    for x in range(2, 16, 4): c.R(x, 0, 2, 16, K('kii', 4)); c.VL(x + 1, 0, 16, K('kii', 0))
    c.VL(0, 0, 16, K('kii', 0)); c.HL(0, 0, 16, K('kii', 3)); c.HL(0, 15, 16, K('kii', 0)); c.VL(15, 0, 16, K('kii', 0)); return c

def signal2():                 # 차량 신호(가로 3구, 왼쪽부터 청·황·적) + 보행 신호(위 적·아래 청+사람) + 押ボタン. 32x96
    c = Cv(32, 96); x = 20; base = 94
    c.R(x, 6, 3, 88, K('tekko', 2)); c.VL(x, 6, 88, K('tekko', 4)); c.VL(x + 2, 6, 88, K('tekko', 0))
    c.R(4, 4, 20, 3, K('tekko', 2)); c.HL(4, 4, 20, K('tekko', 4))
    c.R(2, 7, 20, 9, K('tekko', -2)); c.HL(2, 7, 20, K('tekko', 1))
    for i, col in enumerate(('midori', 'kii', 'aka')):
        cx = 4 + i * 6; c.R(cx, 9, 5, 5, K(col, 3) if i == 0 or i == 2 else K(col, -1)); c.P(cx + 1, 9, K('shiro', 4)) if i == 0 else None
    c.R(2, 16, 20, 2, K('tekko', 1))
    c.R(23, 36, 8, 18, K('tekko', -2)); c.HL(23, 36, 8, K('tekko', 1))
    c.R(25, 38, 4, 6, K('aka', 3)); c.R(26, 40, 2, 3, K('shiro', 3)); c.P(26, 39, K('shiro', 3)); c.P(27, 39, K('shiro', 3))     # 서 있는 사람(적)
    c.R(25, 46, 4, 6, K('tekko', -1)); c.R(26, 47, 2, 1, K('midori', 0))
    c.R(23, 58, 6, 5, K('kii', 2)); c.HL(23, 58, 6, K('kii', 4)); c.R(25, 59, 2, 3, K('tekko', -1))                              # 押しボタン
    c.R(x - 1, 91, 5, 3, K('hodo', 5)); c.HL(x - 1, 94, 7, K('hodo', -1)); return c

def pole_tall(H=256):          # 전봇대 48xH: 콘크리트 기둥 + 완금 + 변압기 + 접지 + 기초
    c = Cv(48, H); x = 20; top = 6; base = H - 4; h = base - top
    c.R(x, top, 7, h, K('hodo', 3)); c.VL(x, top, h, K('hodo', 5)); c.VL(x + 6, top, h, K('hodo', 0))
    for j in range(top + 18, base, 14): c.HL(x, j, 7, K('hodo', 1))
    c.R(x - 14, top + 6, 36, 3, K('ki', 1)); c.HL(x - 14, top + 6, 36, K('ki', 3)); c.HL(x - 14, top + 9, 36, K('ki', -2))
    for ix in (x - 12, x - 4, x + 10, x + 18): c.R(ix, top + 1, 3, 5, K('shiro', 1)); c.R(ix, top, 3, 1, K('shiro', 3))
    c.R(x - 3, top + 22, 13, 20, K('tekko', 2)); c.R(x - 3, top + 22, 13, 3, K('tekko', 4)); c.VL(x - 3, top + 25, 17, K('tekko', 3)); c.VL(x + 9, top + 25, 17, K('tekko', 0)); c.HL(x - 3, top + 41, 13, K('tekko', -1))
    c.R(x + 10, top + 24, 2, 40, K('conc', -2)); c.R(x - 1, base - 36, 9, 6, K('kii', 2)); c.HL(x - 1, base - 36, 9, K('kii', 4)); c.R(x + 1, base - 34, 5, 2, K('tekko', 0))
    c.R(x - 1, base - 2, 9, 3, K('hodo', 5)); c.HL(x - 2, base + 1, 11, K('hodo', -1)); return c


# ───────── 마치야 고증·자판기 군집·재활용함 ─────────
def deco_inuyarai():          # 犬矢来: 대나무 반원 울타리 16x16(처마 아래 벽 밑)
    c = Cv(16, 16)
    for j in range(2, 15):
        w = 7 - int((14 - j) * 0.35)
        for i in range(2, 14): 
            if abs(i - 7.5) <= w: c.P(i, j, K('ki', 2) if (i // 2) % 2 else K('ki', 1))
    for j in (4, 9, 13): c.HL(2, j, 12, K('tekko', 0))
    c.VL(2, 3, 11, K('ki', 3)); c.HL(1, 15, 14, K('hodo', -1)); return c
def deco_mushiko():           # 虫籠窓: 회벽 위 타원 격자창 16x16
    c = Cv(16, 16)
    c.R(1, 3, 14, 11, K('shiro', 2))
    for j in range(16):
        for i in range(16):
            d = ((i - 7.5) / 6.0) ** 2 + ((j - 8.0) / 4.5) ** 2
            if d <= 1: c.P(i, j, K('ita', -2) if d > .62 else K('ita', 0))
    for i in range(4, 12, 2): c.VL(i, 5, 7, K('ita', 3))
    c.HL(2, 14, 12, K('shiro', 4)); return c
def vend_cluster(cols):       # 자판기 무리: 벽에 붙여 나란히(+옆 재활용함). 폭 = 칸 수*16
    n = len(cols); W = 16 * ((20 * n + 15) // 16 + 1); c = Cv(W, 32)
    for k, col in enumerate(cols):
        import props as P0
        P0.vending2(c, 1 + k * 20, 30, col)
    rx = 1 + n * 20 + 2
    c.R(rx, 20, 11, 10, K('sora', 1)); c.HL(rx, 20, 11, K('sora', 4)); c.VL(rx, 20, 10, K('sora', 3)); c.VL(rx + 10, 20, 10, K('sora', -1))
    c.R(rx + 2, 22, 7, 2, K('tekko', -3)); c.R(rx + 2, 25, 7, 2, K('tekko', -3)); c.HL(rx, 30, 11, K('sora', -2))
    for i in range(0, 12, 2): c.P(rx + i, 31, K('hodo', 0))
    return c
