"""wasteland_ruins 그리기 도구 — 흙·균열·돌·풀 포기·골강판·판자·잔해·철근 같은 «재질» 도구와 3/4 입체 상자.

원칙(버들항 기준): 단위(돌·판·벽돌·풀 포기)마다 빛면(왼·위)과 그늘면(오른·아래), 재질마다 5~7단, 큰 단색 면 금지(결·얼룩·때),
윤곽은 표식 OL(render 가 재질 어두운 단으로 바꾼다). 바닥 질감은 칸 주기(16)로 감싸 이어 붙여도 이음이 안 보이게 한다.
"""
from wl_core import *


# ------------------------------------------------------------------ 주기 값 잡음(칸 이음 없는 바닥 결)
def vnoise(x, y, seed=0, cell=4, period=16):
    """주기 period 로 감싼 값 잡음 0..1 (격자 cell). 같은 seed 면 x,y 가 period 만큼 옮겨도 같은 값."""
    gx, gy = x / cell, y / cell
    x0, y0 = int(gx // 1), int(gy // 1); fx, fy = gx - x0, gy - y0
    n = max(1, period // cell)
    def g(i, j): return hsh(i % n, j % n, seed) / 65535.0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx
    b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx
    return a + (b - a) * sy


def field(x, y, seed, period=16):
    return 0.45 * vnoise(x, y, seed, 8, period) + 0.55 * vnoise(x, y, seed + 17, 4, period)


# ------------------------------------------------------------------ 흙
def dirt_px(x, y, seed, wet=0.0):
    """다져진 황무지 흙 한 화소의 색(주기 16). 낮은 대비 얼룩(±1단) + 잔결(밝은 모래알·어두운 알갱이) — 칸 반복이 눈에 띄지 않게 큰 얼룩은 약하게."""
    f = field(x, y, seed) - wet
    d = hsh(x & 15, y & 15, seed + 5) % 29
    t = 4
    if f < 0.30: t = 3
    elif f > 0.74: t = 5
    if d in (0, 1): t -= 1
    elif d == 2: t = 2
    elif d in (3, 4): t += 1
    elif d == 5 and f > 0.5: t = 6
    return K('dirt', t)


def dirt_fill(c, ox, oy, w, h, seed=0, wx=0, wy=0, wet=0.0):
    for y in range(h):
        for x in range(w):
            c.P(ox + x, oy + y, dirt_px(wx + x, wy + y, seed, wet))


def pebble(c, x, y, size=2, mat='conc', hi=5, mid=3, lo=1, shade=None):
    """작은 돌: 위·왼 빛, 아래 한 줄 그늘(땅 그림자). size 1..4."""
    shade = K('dirt', 1) if shade is None else shade
    if size == 1:
        c.P(x, y, K(mat, hi)); c.P(x, y + 1, shade); return
    pts = {2: ['ab', 'bc'], 3: ['.ab', 'abc', 'bcc'], 4: ['.abb', 'abbc', 'bbcc', '.cc.']}[size]
    pal = {'a': K(mat, hi), 'b': K(mat, mid), 'c': K(mat, lo)}
    c.rows(x, y, pts, pal)
    for i in range(size): c.P(x + i + (1 if size > 2 and i == 0 else 0), y + size, shade)


def crack(c, pts, dark=None, lite=None):
    """균열: 어두운 선 + 아래쪽 한 화소 밝은 턱(빛을 받는 깨진 모서리)."""
    for (a, b) in zip(pts, pts[1:]):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for i in range(n + 1):
            x = round(a[0] + (b[0] - a[0]) * i / n); y = round(a[1] + (b[1] - a[1]) * i / n)
            c.P(x, y, dark)
            if lite is not None and not c.get(x, y + 1) == dark: c.P(x, y + 1, lite)


def tuft(c, x, y, kind='grass', big=False):
    """풀 포기(아래가 뿌리 x,y): 잎끝 밝게, 밑동 어둡게, 왼쪽 빛."""
    m = kind
    if not big:
        rows = ['.c.a.', 'c.ba.', '.bbb.', '..d..']
        pal = {'a': K(m, -1), 'b': K(m, 3), 'c': K(m, 4), 'd': K(m, 1)}
        c.rows(x - 2, y - 3, rows, pal)
    else:
        rows = ['..a...a', 'c.b.a.b', '.cb.bb.', 'cbbcbbd', '.dbbbd.', '..ddd..']
        pal = {'a': K(m, -1), 'b': K(m, 3), 'c': K(m, 5 if m != 'dry' else 4), 'd': K(m, 1)}
        c.rows(x - 3, y - 5, rows, pal)


# ------------------------------------------------------------------ 3/4 입체
def box(c, x, y, w, top, front, mat, tt=5, ft=3, topmat=None, lip=True, ao=True, ol=False):
    """윗면 top 행(앞면보다 2단 이상 밝게, 뒤 모서리 한 단 어둡게, 앞 모서리 밝은 턱) + 앞면 front 행(턱 밑 그늘·왼 빛·오른 그늘·바닥 AO)."""
    tm = topmat or mat
    c.R(x, y, w, top, K(tm, tt))
    c.HL(x, y, w, K(tm, tt - 1))
    c.HL(x, y + top - 1, w, K(tm, tt + 1))
    c.VL(x, y + 1, top - 2, K(tm, tt + 1)) if top > 2 else None
    c.VL(x + w - 1, y + 1, top - 1, K(tm, tt - 1))
    fy = y + top
    c.R(x, fy, w, front, K(mat, ft))
    if lip and front > 2: c.HL(x, fy, w, K(mat, ft - 1))
    c.VL(x, fy, front, K(mat, ft + 1)); c.VL(x + w - 1, fy, front, K(mat, ft - 1))
    if ao and front > 3: c.HL(x, fy + front - 1, w, K(mat, ft - 2))
    if ol: c.outline()
    return fy


def corrugated(c, x, y, w, h, mat='metal', base=3, vertical=True, pitch=3, seed=0):
    """골강판: 골마다 빛 줄(왼/위) · 몸 · 그늘 줄. vertical=True 면 세로 골(앞면 판), False 면 가로 골(지붕 윗면을 위에서 볼 때 골이 위아래로 흐름)."""
    for j in range(h):
        for i in range(w):
            k = (i if vertical else j) % pitch
            t = base + (1 if k == 0 else -1 if k == pitch - 1 else 0)
            n = hsh(x + i, y + j, seed) % 31
            if n == 0: t -= 1
            c.P(x + i, y + j, K(mat, t))


def rust_patch(c, x, y, w, h, seed=0, dens=0.55, mat='rust', on=None):
    """녹 얼룩: 값 잡음 덩이(가장자리는 성기게)로 이미 칠한 화소 위에 녹 2~3단. on = 덮어도 되는 색 집합(없으면 불투명 아무거나)."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            if not c.has(xx, yy): continue
            if on is not None and c.get(xx, yy) not in on: continue
            v = field(xx * 2, yy * 2, seed, 64)
            if v > 1 - dens:
                t = 2 if v > 1 - dens * 0.35 else 3 if v > 1 - dens * 0.7 else 4
                if hsh(xx, yy, seed + 9) % 7 == 0: t += 1
                c.P(xx, yy, K(mat, t))


def planks(c, x, y, w, h, mat='wood', base=3, pw=4, vertical=True, seed=0, nails=True):
    """판자: 판마다 명암 ±1, 이음 = 어두운 줄, 판 왼쪽 빛 줄, 옹이·못."""
    for i in range(w if vertical else h):
        bi = i // pw; k = i % pw
        bt = base + (hsh(bi, seed, 3) % 3 - 1)
        for j in range(h if vertical else w):
            t = bt
            if k == 0: t = base - 2
            elif k == 1: t = bt + 1
            if hsh(bi, j // 3, seed + 7) % 11 == 0 and k > 1: t = bt - 1
            xx, yy = (x + i, y + j) if vertical else (x + j, y + i)
            c.P(xx, yy, K(mat, t))
    if nails:
        for i in range(0, w if vertical else h, pw):
            for jj in (1, (h if vertical else w) - 2):
                xx, yy = (x + i + 2, y + jj) if vertical else (x + jj, y + i + 2)
                c.P(xx, yy, K('metal', 5))


def rebar(c, x, y, ln, lean=0, mat='rust'):
    """철근 한 가닥: 끝이 위로 솟는 녹슨 막대(아래 → 위), lean = 기울기(+오른쪽). 빛 화소 하나."""
    for k in range(ln):
        xx = x + (lean * k) // max(1, ln)
        c.P(xx, y - k, K(mat, 2 if k % 3 else 3))
    c.P(x + lean, y - ln + 1, K(mat, 5))


def chunk(c, x, y, w, h, mat='conc', top=None, seed=0):
    """콘크리트·벽돌 덩이(작은 3/4 상자): 윗면 밝게 + 앞면 어둡게 + 깨진 모서리."""
    top = max(1, h // 2) if top is None else top
    c.R(x, y, w, top, K(mat, 5)); c.HL(x, y, w, K(mat, 4)); c.P(x, y, K(mat, 6))
    c.R(x, y + top, w, h - top, K(mat, 2)); c.VL(x + w - 1, y + top, h - top, K(mat, 1))
    if w > 2 and hsh(x, y, seed) % 2: c.clear(x + w - 1, y)


def rubble_scatter(c, x0, y0, w, h, n, seed=0, mats=('conc', 'conc', 'brick'), glass=True, shade=None):
    """잔해 흩기: 크고 작은 덩이 + 벽돌 조각 + 유리 반짝."""
    for k in range(n):
        x = x0 + hsh(k, 1, seed) % max(1, w - 3); y = y0 + hsh(k, 2, seed) % max(1, h - 3)
        m = mats[hsh(k, 3, seed) % len(mats)]
        s = 1 + hsh(k, 4, seed) % 3
        if m == 'brick':
            c.HL(x, y, 3, K('brick', 4)); c.HL(x, y + 1, 3, K('brick', 2)); c.P(x + 3, y + 1, K('brick', 1))
            if shade: c.HL(x, y + 2, 3, shade)
        else:
            pebble(c, x, y, s + 1 if s < 3 else 3, mat=m, hi=5, mid=3, lo=1, shade=shade)
    if glass:
        for k in range(max(1, n // 4)):
            x = x0 + hsh(k, 5, seed) % w; y = y0 + hsh(k, 6, seed) % h
            c.P(x, y, K('glass', 5)); c.P(x + 1, y, K('glass', 3))


# ------------------------------------------------------------------ 폐허 벽 재질
def conc_face(c, x, y, w, h, seed=0, base=3, band=None, grime=3, stains=True):
    """풍화 콘크리트 앞면: 몸 base(값 잡음 ±1) · 왼쪽 빛 · 아래 때(grime) · 빗물 자국 세로 줄 · 층 띠(band = 띠 행 목록, 띠 = 밝은 턱 + 그늘)."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            f = field(xx, yy * 2, seed + 31, 64)
            t = base + (1 if f > 0.68 else -1 if f < 0.26 else 0)
            if i == 0: t += 1
            if i == w - 1: t -= 1
            if j >= h - grime: t = min(t, base - 1) if j < h - 1 else base - 2
            if stains and hsh(xx, 0, seed + 3) % 9 == 0 and j > 1 and hsh(xx, yy // 3, seed) % 3: t -= 1          # 빗물 자국
            c.P(xx, yy, K('conc', t))
    for b in band or ():
        c.HL(x, y + b, w, K('conc', base + 2)); c.HL(x, y + b + 1, w, K('conc', base - 1))


def conc_top(c, x, y, w, h, seed=0, base=5):
    """벽 윗면(위에서 본 벽 두께): 밝은 몸 + 위 가장자리 한 단 어둡게(뒤) + 아래 가장자리 밝은 턱(앞) + 잔결."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            t = base + (1 if hsh(xx, yy, seed + 2) % 7 == 0 else 0) - (1 if hsh(xx, yy, seed + 4) % 11 == 0 else 0)
            c.P(xx, yy, K('conc', t))
    c.HL(x, y, w, K('conc', base - 1)); c.HL(x, y + h - 1, w, K('conc', base + 2))


def hole(c, x, y, w, h, seed=0, inside='soot'):
    """깨진 창 구멍: 어두운 속(위 그늘 짙고 아래 바닥빛) + 위 상인방 그늘 · 아래 창턱 빛 · 깨진 가장자리 몇 화소."""
    for j in range(h):
        for i in range(w):
            t = 0 if j < h // 2 else 1
            if j == h - 1: t = 2
            if i == w - 1 and j > 0: t = max(0, t - 1)
            c.P(x + i, y + j, K(inside, t))
    c.HL(x - 1, y + h, w + 2, K('conc', 6))                  # 창턱 빛
    c.HL(x, y + h + 1, w, K('conc', 2))                      # 창턱 밑 그늘
    for k in range(2):                                       # 깨진 가장자리
        i = hsh(k, seed, 5) % w
        c.P(x + i, y - 1, K(inside, 0)) if hsh(k, seed, 6) % 2 else c.P(x - 1, y + 1 + hsh(k, seed, 7) % max(1, h - 2), K(inside, 1))


def mound(c, cx, by, rx, ry, seed=0, mats=('conc', 'conc', 'brick'), dens=1.0):
    """잔해 더미(위가 둥근 언덕): 몸은 어두운 콘크리트 결, 위에 덩이들을 위→아래로 쌓는다(앞 덩이가 뒤를 덮음). by = 밑변 행."""
    cy = by
    for y in range(by - ry, by + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1:
                v = (by - y) / max(1, ry)
                t = 2 + (1 if hsh(x, y, seed) % 4 == 0 else 0) + (1 if v > 0.6 else 0)
                c.P(x, y, K('conc', t))
    n = int(rx * ry * 0.22 * dens)
    pts = sorted(((cx - rx + 1 + hsh(k, 1, seed) % max(1, 2 * rx - 2), by - hsh(k, 2, seed) % max(1, ry)) for k in range(n)), key=lambda p: p[1])
    for k, (x, y) in enumerate(pts):
        if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 > 0.85: continue
        m = mats[hsh(k, 3, seed) % len(mats)]
        if m == 'brick':
            c.HL(x, y, 3, K('brick', 4)); c.HL(x, y + 1, 3, K('brick', 2)); c.P(x, y, K('brick', 5))
        else:
            s = 2 + hsh(k, 4, seed) % 3
            chunk(c, x, y, s + 1, s, m, max(1, s // 2), seed + k)


def chunk5(c, x, y, w, h, mat='conc', top=None, seed=0):
    """5단 덩이: 윗면(앞 모서리 빛 +1, 몸, 뒤 모서리 -1) · 앞면(몸 · 오른쪽 그늘 · 아래 가장 어두움) · 왼쪽 위 빛 화소 · 깨진 모서리."""
    top = max(2, h // 2) if top is None else top
    r = MAT[mat]; n = len(r)
    T0, T1, T2 = n - 2, n - 3, n - 1                          # 윗면 몸, 뒤 모서리, 빛
    F0, F1, F2 = n - 5, n - 6, max(0, n - 7)                  # 앞면 몸, 그늘, 가장 어두움
    c.R(x, y, w, top, K(mat, T0)); c.HL(x, y, w, K(mat, T1)); c.HL(x, y + top - 1, w, K(mat, T2)); c.P(x, y + 1 if top > 2 else y, K(mat, T2))
    c.R(x, y + top, w, h - top, K(mat, F0)); c.VL(x + w - 1, y + top, h - top, K(mat, F1)); c.HL(x, y + h - 1, w, K(mat, F2))
    if w > 3 and top > 2 and hsh(x, y, seed) % 3 == 0: c.P(x + 1 + hsh(x, y, seed + 1) % (w - 2), y + 1, K(mat, F0))   # 윗면 흠
    if hsh(x, y, seed + 2) % 2: c.clear(x + w - 1, y)
    if hsh(x, y, seed + 3) % 3 == 0: c.clear(x, y + h - 1)


def grit(c, x0, y0, w, h, mat='conc', seed=0, rate=13, cracks=0):
    """이미 칠한 재질 화소에 골재 알(밝은 +2·어두운 -2)과 짧은 잔금을 흩는다 — 넓은 벽면이 평면 채움으로 읽히지 않게."""
    r = MAT[mat]; idx = {col: i for i, col in enumerate(r)}
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            col = c.get(x, y)
            if col not in idx: continue
            d = h2(x, y, seed) % rate
            if d == 0: c.P(x, y, K(mat, idx[col] + 1))
            elif d == 1: c.P(x, y, K(mat, idx[col] - 1))
            elif d == 2 and h2(x, y + 1, seed) % 4 == 0: c.P(x, y, K(mat, idx[col] + 2))
    for k in range(cracks):
        cx = x0 + 2 + h2(k, 1, seed) % max(1, w - 4); cy = y0 + 2 + h2(k, 2, seed) % max(1, h - 6)
        pts = [(cx, cy)]
        for s in range(3): pts.append((pts[-1][0] + (h2(k, s, seed + 5) % 3) - 1, pts[-1][1] + 2))
        for (a, b) in zip(pts, pts[1:]):
            if c.get(*a) in idx and c.get(*b) in idx: c.line(a[0], a[1], b[0], b[1], K(mat, 1))
