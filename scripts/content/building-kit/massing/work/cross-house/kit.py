"""cross-house 전용 손 도트 도우미(기와 열 폭 5 — l-farmhouse 사본은 4)(2026-10-25 재도전). 난수·잡음 없음 — 변화는 draw.py 가 넘기는 손 표(숫자 문자열)로만.

지붕 규약 ㉚(버들항 bd-house-h124_0 · h122_0):
- 남북 박공 사면(왼 밝음 · 오른 어두움): 기와는 용마루와 나란한 세로 열. 열 폭 4, 이웃 열은 반 장 엇갈림.
- 정면과 나란한 앞 사면: 가로 줄 기와, 처마로 갈수록 어두운 띠.
- 모임 끝: 왼쪽은 밝은 세로 열, 오른쪽은 그늘 세로 열. 모임선 왼 ηη · 오른 __.
- 골: 두 지붕이 만나는 사선은 짙은 '-' 두 화소 + 본채 쪽 한 화소 그늘.
표(tab)는 건물마다 다르게 손으로 써서 다른 건물과 같은 8×8 조각이 나오지 않게 한다(㉟)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas  # noqa: E402,F401

LIGHTER = {'<': 'π', '?': '<', '=': '?', '+': '=', '&': '+', 'π': 'ρ', 'ρ': 'L', 'ν': 'π', 'λ': 'ν', '$': '@',
           '@': '?', '!': '@', '9': '!', '6': '9', 'L': 'L', '#': '?', '*': '?', '%': '&', '7': '%', 'θ': 'ν',
           'σ': 'L'}
DARKER = {'π': '<', 'ρ': 'π', '<': '?', '?': '=', '=': '+', '+': '&', '&': '9', 'L': 'σ', 'σ': 'ρ', 'ν': '+',
          'λ': '&', '$': '9', '@': '!', '!': '9', '9': '6', '#': '!', '*': '#', '%': '7', 'θ': '%', '7': '6',
          '6': '6'}


def code(tab, i, j):
    row = tab[j % len(tab)]
    return row[i % len(row)]


# ---------------------------------------------------------------- 남북 박공 사면(세로 열)
LIT_TONES = {  # (윗빛, 몸, 아랫몸, 낱장 밑 그늘)
    '0': ('L', 'ρ', 'π', '#'),
    '1': ('L', 'L', 'ρ', '?'),
    '2': ('ρ', 'π', '<', '#'),
    '3': ('σ', 'ρ', 'π', '#'),
    '4': ('L', 'ρ', '<', '!'),
    '5': ('L', 'σ', 'ρ', '?'),
}
DARK_TONES = {
    '0': ('π', '<', '=', '@'),
    '1': ('ρ', 'π', '?', '@'),
    '2': ('<', '=', '+', '!'),
    '3': ('ν', '<', '=', '@'),
    '4': ('π', '=', '@', '!'),
    '5': ('<', '?', '=', '@'),
}


def ns_slope(c, inside, x0, x1, y0, y1, tab, lit=True, colw=5, th=4, phase=0, dark_from=0.78):
    """세로 열 기와. 열 오른끝 1화소 = 열 사이 그늘(세로 줄무늬), 낱장 아래 1화소 = 낱장 그늘(옅게)."""
    tones = LIT_TONES if lit else DARK_TONES
    sep0 = '#' if lit else '!'
    span = max(1, y1 - y0)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            col = (x - x0 + phase) // colw
            u = (x - x0 + phase) % colw
            st = (col % 2) * (th // 2)
            k = (y - y0 + st) // th
            r = (y - y0 + st) % th
            cd = code(tab, col, k)
            H, B, M, D = tones.get(cd, tones['0'])
            if u == colw - 1:
                ch = sep0 if cd != '1' else ('*' if lit else '@')
            elif r == th - 1:
                ch = D
            elif r == 0:
                ch = H if u < 2 else B
            elif r == 1:
                ch = H if (u == 0 and lit) else B
            else:
                ch = M if u >= colw - 2 else B
            if cd == '6' and r >= th - 2 and u < 2:   # 이끼 낀 낱장
                ch = 'O' if r == th - 2 else 'M'
            if (y - y0) / span > dark_from and ch not in ('O', 'M'):
                ch = DARKER.get(ch, ch)
            c.put(x, y, ch)


# ---------------------------------------------------------------- 정면과 나란한 앞 사면(가로 줄)
FRONT_BANDS = [  # (윗빛, 몸, 아랫몸, 줄 그늘) — 위(용마루) → 아래(처마)
    ('L', 'ρ', '<', '$'),
    ('ρ', 'π', '<', '$'),
    ('π', '<', '?', '@'),
    ('π', '?', '=', '@'),
    ('ν', '=', '+', '!'),
    ('ν', '+', '&', '!'),
    ('λ', '&', '&', '9'),
]


def front_plane(c, inside, x0, x1, y0, y1, tab, bands=None, tw=5, th=4, phase=0):
    bands = bands or FRONT_BANDS
    nk = max(1, (y1 - y0 + th) // th)
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        H, B, M, D = bands[min(len(bands) - 1, k * len(bands) // nk)]
        off = (k % 2) * (tw // 2) + phase
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            t = (x + off) // tw
            u = (x + off) % tw
            cd = code(tab, t, k)
            h2, b2, m2, d2 = H, B, M, D
            if cd == '1':
                h2, b2, m2 = LIGHTER.get(H, H), LIGHTER.get(B, B), LIGHTER.get(M, M)
            elif cd == '2':
                h2, b2, m2 = B, M, DARKER.get(M, M)
            if r == th - 1:
                ch = d2
            elif u == tw - 1:
                ch = DARKER.get(m2, d2) if cd != '4' else d2
            elif r == 0:
                ch = h2 if u < 2 else b2
            elif r == th - 2:
                ch = m2 if u >= 1 else b2
            else:
                ch = b2
            if cd == '4' and r == th - 2:
                ch = d2
            if cd == '6' and r >= th - 2 and u < 2:
                ch = 'O' if r == th - 2 else 'M'
            c.put(x, y, ch)


# ---------------------------------------------------------------- 모임지붕 본채(정면과 나란한 용마루)
HIPR_TONES = {
    '0': ('θ', '%', '9', '9'),
    '1': ('ν', 'θ', '%', '9'),
    '2': ('%', '9', '7', '6'),
    '3': ('θ', '%', '7', '9'),
    '4': ('θ', '%', '9', '7'),
    '5': ('ν', '%', '9', '9'),
}


def hip_roof(c, x0, x1, ridge_y, eave_y, rl, rr, tab_front, tab_hl, tab_hr, knee_frac=0.5, eave=True):
    """정면과 나란한 용마루(rl..rr) + 양 끝 모임. 돌려줌: (모임선 왼 lx, 오른 rx)."""
    SL = (rl - x0) / (eave_y - ridge_y)
    SR = (x1 - rr) / (eave_y - ridge_y)

    def lx(y):
        return rl - (y - ridge_y) * SL

    def rx(y):
        return rr + (y - ridge_y) * SR
    knee = ridge_y + int((eave_y - ridge_y) * knee_frac)

    def out_l(y):
        return max(float(x0), (rl - 2) - (y - ridge_y) * (rl - 2 - x0) / (knee - ridge_y))

    def out_r(y):
        return min(float(x1), (rr + 2) + (y - ridge_y) * (x1 - rr - 2) / (knee - ridge_y))

    front_plane(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, x0, x1, ridge_y + 2, eave_y, tab_front)
    ns_slope(c, lambda x, y: out_l(y) - 0.5 <= x <= lx(y) + 1, x0, x1, ridge_y + 1, eave_y, tab_hl, lit=True,
             phase=1, dark_from=0.85)
    tones = HIPR_TONES
    for y in range(ridge_y + 1, eave_y + 1):        # 오른 모임: 그늘 세로 열
        for x in range(x0, x1 + 1):
            if not (rx(y) - 1 <= x <= out_r(y) + 0.5):
                continue
            col = (x - x0 + 2) // 5
            u = (x - x0 + 2) % 5
            st = (col % 2) * 2
            k = (y - ridge_y + st) // 4
            r = (y - ridge_y + st) % 4
            H, B, M, D = tones.get(code(tab_hr, col, k), tones['0'])
            ch = D if u == 4 else (M if r == 3 else (H if r == 0 and u < 2 else B))
            c.put(x, y, ch)
    for y in range(ridge_y + 1, eave_y + 1):        # 모임선
        x = int(round(lx(y)))
        c.put(x, y, 'η')
        c.put(x + 1, y, 'η')
        x = int(round(rx(y)))
        c.put(x - 1, y, '_')
        c.put(x, y, '_')
    for y in range(ridge_y + 1, eave_y + 3):        # 바깥 윤곽(재질 어두운 단)
        c.put(int(round(out_l(y))), y, '-' if y % 2 else 'α')
        c.put(int(round(out_r(y))), y, '-' if y % 3 else '9')
    for x in range(rl - 2, rr + 3):                 # 용마루
        c.put(x, ridge_y, 'ζ' if x % 5 else 'η')
        c.put(x, ridge_y + 1, '-')
    c.put(rl - 2, ridge_y, '-')
    c.put(rr + 2, ridge_y, '-')
    if eave:
        eave_rows(c, x0, x1, eave_y)
    return lx, rx, out_l, out_r


def eave_rows(c, x0, x1, eave_y, tab='0102'):
    """처마 끝: 기와 마구리 줄(어두운 테라코타) + 처마 밑 짙은 띠."""
    for x in range(x0, x1 + 1):
        k = code([tab], x // 3, 0)
        c.put(x, eave_y + 1, '9' if x % 4 == 0 else ('&' if k != '2' else '%'))
        c.put(x, eave_y + 2, '_' if x % 6 else '-')
    c.put(x0, eave_y + 1, '-')
    c.put(x1, eave_y + 1, '-')


# ---------------------------------------------------------------- 남북 박공 날개 지붕(오각형) + 골
def ns_roof(c, ctr, half, apex_y, knee_y, eave_y, tab_l, tab_r, valley_to=None, lower=None):
    """ctr: 용마루 가운데(화소 경계 실수), half: 처마 반폭.
    apex_y→knee_y 는 사선(골 또는 북쪽 박공 끝선), knee_y→eave_y 는 세로 처마.
    lower=(y_ridge, y_knee2): 십자 날개처럼 apex→y_ridge 위 삼각 + y_ridge→y_knee2 아래 역삼각(골) 모양.
    valley_to: 사선이 골(본채 지붕과 만남)인 구간 끝 y — 그 구간 사선은 '-' 골, 바깥은 본채 지붕에 그늘.
    돌려줌: inside(x,y)."""

    def hw(y):
        if lower:
            yr, yk = lower
            if y < yr:
                return half * (y - apex_y + 1) / (yr - apex_y + 1)
            if y < yk:
                return max(0.6, half * (y - yr + 1) / (yk - yr + 1))
            return half
        if y >= knee_y:
            return half
        return half * (y - apex_y + 1) / (knee_y - apex_y + 1)

    def inside(x, y):
        return apex_y <= y <= eave_y and abs(x + 0.5 - ctr) <= hw(y)

    cl = int(ctr) - 1                    # 용마루 왼 화소
    x0, x1 = int(ctr - half) - 1, int(ctr + half) + 1
    ns_slope(c, lambda x, y: inside(x, y) and x <= cl, x0, cl, apex_y, eave_y, tab_l, lit=True,
             phase=(cl - x0 + 1) % 5)
    ns_slope(c, lambda x, y: inside(x, y) and x > cl, cl + 1, x1, apex_y, eave_y, tab_r, lit=False, phase=0)
    # 용마루(세로): 왼 마룻기와 · 오른 그늘
    for y in range(apex_y, eave_y + 1):
        if not inside(cl, y):
            continue
        c.put(cl, y, '<' if (y // 2) % 2 else '*')
        if inside(cl + 1, y):
            c.put(cl + 1, y, ('7', 'ε', '6', '7')[y % 4])
    return inside, hw


def rim(c, inside, x0, x1, y0, y1, left=('-', 'β'), right=('-', '_'), skip=None):
    """오각형 지붕 바깥 테: 왼쪽 갈색 두 화소(바깥 -, 안 β), 오른쪽 -,_ ."""
    for y in range(y0, y1 + 1):
        xs = [x for x in range(x0, x1 + 1) if inside(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        if skip and skip(y):
            continue
        c.put(l, y, left[0])
        if r - l > 3:
            c.put(l + 1, y, left[1] if y % 3 else 'α')
            c.put(r, y, right[0])
            c.put(r - 1, y, right[1] if y % 4 else '9')


def valley(c, inside, x0, x1, y0, y1, side_shadow=True):
    """골: 날개 사면이 본채 앞 사면과 만나는 사선 — 날개 쪽 끝 2화소 '-', 본채 쪽 1화소 그늘."""
    for y in range(y0, y1 + 1):
        xs = [x for x in range(x0, x1 + 1) if inside(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        c.put(l, y, '-')
        c.put(r, y, '-')
        if r - l > 4:
            c.put(l + 1, y, '_' if y % 2 else '-')
            c.put(r - 1, y, '-')
        if side_shadow:
            for x in (l - 1, r + 1):
                g = c.get(x, y) if 0 <= x < c.w else '.'
                if g != '.':
                    c.put(x, y, DARKER.get(DARKER.get(g, g), g))
            g = c.get(r + 2, y) if r + 2 < c.w else '.'
            if g != '.':
                c.put(r + 2, y, DARKER.get(g, g))


# ---------------------------------------------------------------- 박공 삼각벽
def gable_wall(c, ctr, gpeak, gbase, ghalf, dots, ox=0, attic=None):
    """삼각벽: 박공널(바깥 -, 널 η/ε, 안 그늘 β) + 회벽 점묘 + 가운데 동자 기둥 + 다락창."""

    def gw(y):
        return ghalf * (y - gpeak + 1) / (gbase - gpeak + 1)

    def ing(x, y):
        return gpeak <= y <= gbase and abs(x + 0.5 - ctr) <= gw(y)
    for y in range(gpeak, gbase + 1):
        for x in range(int(ctr - ghalf) - 1, int(ctr + ghalf) + 2):
            if not ing(x, y):
                continue
            d = gw(y) - abs(x + 0.5 - ctr)
            left = x + 0.5 < ctr
            if d < 1:
                ch = '-'
            elif d < 2:
                ch = 'η' if left else 'ε'
            elif d < 3:
                ch = 'ε' if left else 'β'
            elif d < 4:
                ch = 'β' if left else '_'
            elif d < 5:
                ch = 'y'
            else:
                m = dots[(y + 2) % len(dots)]
                k = m[(x + ox) % len(m)]
                ch = '3' if k == '.' else k
            c.put(x, y, ch)
    cx = int(ctr) - 1
    for y in range(gpeak + 3, gbase + 1):
        c.put(cx, y, 'ε')
        c.put(cx + 1, y, 'β')
    c.put(cx, gpeak, 'η')
    c.put(cx + 1, gpeak, 'ε')
    if attic:
        aw, ah, ay = attic
        small_window(c, cx + 1 - aw // 2, ay, aw, ah)
    return ing


def small_window(c, x, y, w, h):
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) or j in (0, h - 1):
                ch = 'η' if (i == 0 or j == 0) else 'β'
            elif i == w // 2:
                ch = 'ε'
            else:
                ch = 'E' if j == 1 else ('A' if j < h - 2 else 'B')
            c.put(x + i, y + j, ch)
    c.put(x + 1, y + 1, 'H')
    c.put(x + 1, y + 2, '^')
    for i in range(-1, w + 1):
        c.put(x + i, y + h, 'β' if i < w // 2 else '_')


# ---------------------------------------------------------------- 회벽·목재
def plaster(c, x0, y0, x1, y1, dots, ox=0, oy=0, base='3', mask=None):
    for y in range(y0, y1 + 1):
        m = dots[(y + oy) % len(dots)]
        for x in range(x0, x1 + 1):
            if mask and not mask(x, y):
                continue
            k = m[(x + ox) % len(m)]
            c.put(x, y, base if k == '.' else k)


def eave_shadow(c, x0, x1, y, rows=('_', '-', 'c', 'f', 'l'), mask=None):
    for j, ch in enumerate(rows):
        for x in range(x0, x1 + 1):
            if mask and not mask(x, y + j):
                continue
            col = ch
            if ch in 'cfl' and (x * 5 + j * 3) % 13 == 0:
                col = {'c': 'Y', 'f': 'c', 'l': 'y'}[ch]
            c.put(x, y + j, col)


def post(c, x, y0, y1, w=3, grain=0):
    for y in range(y0, y1 + 1):
        c.put(x, y, 'η' if w >= 3 else 'ε')
        for i in range(1, w - 1):
            c.put(x + i, y, 'ε')
        c.put(x + w - 1, y, 'β')
    for k, y in enumerate(range(y0 + 2 + grain % 4, y1, 6 + grain % 3)):
        c.put(x + 1, y, 'δ' if (k + grain) % 2 else 'ζ')


def beam(c, x0, x1, y, h=2, grain=0):
    for x in range(x0, x1 + 1):
        c.put(x, y, 'η' if (x + grain) % 11 else 'ζ')
        for j in range(1, h):
            c.put(x, y + j, 'ε' if (x + grain) % 7 else 'δ')
    for x in range(x0, x1 + 1):
        c.put(x, y + h, '-' if (x + grain) % 5 else 'α')


def brace(c, x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for s in range(n + 1):
        x = round(x0 + (x1 - x0) * s / n)
        y = round(y0 + (y1 - y0) * s / n)
        c.put(x, y, 'ε')
        c.put(x + 1, y, 'β')


def foundation(c, x0, x1, y, pat, step=None):
    """기초 두 줄: 윗줄 잔돌(손 무늬 pat), 아랫줄 짙은 돌."""
    for x in range(x0, x1 + 1):
        c.put(x, y, pat[(x - x0) % len(pat)])
        c.put(x, y + 1, 'U' if (x * 3) % 7 else 'X')
    if step:
        for x in range(step[0], step[1] + 1):
            c.put(x, y, 'r' if x % 4 else 'm')
            c.put(x, y + 1, 'Y' if x % 3 else 'Z')


def put_rows(c, x, y, rows):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                c.put(x + i, y + j, ch)


def interior_holes(c):
    def op(x, y):
        return 0 <= x < c.w and 0 <= y < c.h and c.g[y][x] != '.'
    return [(x, y) for y in range(c.h) for x in range(c.w) if c.g[y][x] == '.' and
            all(op(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
