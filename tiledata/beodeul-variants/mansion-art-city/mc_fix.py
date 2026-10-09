# 저택·예술 도시 보정 패스(WAVE-BRIEF-4, 2026-10-08).
#  1) 시그니처 땅 덩이 오토타일(16변형, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 이웃 없는 쪽은 투명 → 밑 땅이 보인다)
#       autotile-garden-pond      정원 연못(막힘): 둑 돌 테 + 북쪽 둑 앞면 + 물(깊을수록 어둡게) + 물가 수련
#       autotile-flowerbed-red / -yellow / -white   꽃밭 덩이(막힘): 잎 덩이 + 남쪽 앞면 + 꽃 점, 색만 다른 세 장
#       autotile-leaf-litter      잔디 위 낙엽·흙 맨땅(걷기): 밟혀 드러난 흙 + 흩어진 낙엽, 가장자리 풀 잔털
#  2) 벽돌 바닥 표본 셋(헤링본 · 어두운 테두리 띠 · 둥근 로터리 무늬) — 대로·교차 광장용
#  3) 저택 지붕 변형 둘(청회색 슬레이트 + 돌 굴뚝·토관, 초록 구리 + 구리 갓 굴뚝)
# 바탕 램프는 모두 칩셋 것(px2.PAL 7단: 0 윤곽 .. 6 밝음). 결정적(같은 입력 = 같은 그림).
from mc_base import *
from mc_base import _hash

WA = [hx(c) for c in ['#071528', '#143a27', '#1c4a44', '#21584e', '#3fa2ae', '#7d98a2', '#a7d4db']]   # 칩셋 물
LFC = R['leaf']                                   # 칩셋 잎 7단
RED = R['red']; STRAW = R['straw']; PLA = R['plaster']; WDR = R['wood']
EARTH = [hx(c) for c in ('#2d231e', '#4c3b30', '#6e5b49', '#816a56', '#8a745c', '#9e8b64', '#bcab82')]   # 초원 하이로드 흙과 같은 값
LAWN = [hx(c) for c in ('#3f7a2c', '#4b8232', '#579f35', '#58a035', '#73b83e', '#8fd24a')]


# ------------------------------------------------------------------ 잡음·가장자리
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def tnoise1(N, sc, seed):
    """주기 N 1차원 값 잡음(감김) — 같은 변이 이어진 칸끼리 가장자리 윤곽이 끊기지 않는다."""
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + .5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f


def tnoise(W, H, sc, seed):
    gw, gh = max(1, W // sc), max(1, H // sc); g = np.random.default_rng(seed).random((gh, gw))
    xs = (np.arange(W) + .5) / sc; ys = (np.arange(H) + .5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % gw; y1 = (y0 + 1) % gh; x0 %= gw; y0 %= gh
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    fxx = fx[None, :]; fyy = fy[:, None]
    return (a * (1 - fxx) + b * fxx) * (1 - fyy) + (c * (1 - fxx) + d * fxx) * fyy


X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


def edge_depth(n, inset=2.4, jag=1.8, rad=5.5, seed=1):
    """변형 n 의 가장자리 깊이장 m(화소): m<0 칸 밖(투명), m>=0 칸 안. 이웃 없는 변은 inset±jag 안쪽에서 시작하고
    윤곽은 주기 16 잡음 두 겹(큰 혹 + 잔 혹)이라 둥글고 울퉁불퉁하다. 이웃 없는 두 변이 만나는 볼록 모서리는 rad 로 둥글게.
    반환 (m, dN, dE, dS, dW) — 변마다 깊이(이웃 있는 변은 99)."""
    def jj(k):
        return (tnoise1(16, 8, seed * 10 + k) - .5) * 2 * jag * .7 + (tnoise1(16, 4, seed * 10 + k + 5) - .5) * 2 * jag * .45
    big = 99.0 + 0 * X16
    dN = np.where(n & 1, big, Y16 - (inset + jj(1)[X16]))
    dS = np.where(n & 4, big, (15 - Y16) - (inset + jj(2)[X16]))
    dW = np.where(n & 8, big, X16 - (inset + jj(3)[Y16]))
    dE = np.where(n & 2, big, (15 - X16) - (inset + jj(4)[Y16]))
    m = np.minimum(np.minimum(dN, dS), np.minimum(dW, dE))
    for a, b in ((dN, dW), (dN, dE), (dS, dW), (dS, dE)):
        if a.max() < 90 and b.max() < 90:
            sel = (a < rad) & (b < rad)
            rc = rad - np.hypot(rad - a, rad - b)
            m = np.where(sel, np.minimum(m, rc), m)
    return m, dN, dE, dS, dW


def rgba(rgb, alpha):
    a = np.where(alpha, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA')


def sheet(cells):
    sh = new(64, 64)
    for k, c in enumerate(cells): sh.alpha_composite(c, (k % 4 * 16, k // 4 * 16))
    return sh


def pal(R_, T): return np.array(R_, np.int32)[np.clip(np.asarray(T), 0, len(R_) - 1).astype(int)]


# ------------------------------------------------------------------ ① 정원 연못
_RIP = [(3, 2, 5), (6, 10, 4), (9, 5, 6), (12, 12, 4), (14, 1, 3)]


def _water(depth, dN):
    """물 톤: 물가(얕은 곳) 3, 가운데 2, 북쪽 둑 그늘 1. 가로 잔물결(주기 16), 드문 반짝."""
    n = tnoise(16, 16, 8, 31) * .6 + tnoise(16, 16, 4, 32) * .4
    T = np.where(depth < 3.5, 3, np.where(n < .42, 2, 3)).astype(int)
    T = np.where((depth >= 6) & (n < .62), 2, T)
    for (ry, rx, ln) in _RIP:
        on = (Y16 == ry) & (((X16 - rx) % 16) < ln)
        T = np.where(on, np.where(((X16 - rx) % 16) == 0, 5, 4), T)
    T = np.where(hash2(X16, Y16, 33) > .993, 6, T)
    T = np.where(dN < 2.0, 1, np.where(dN < 3.2, np.minimum(T, 2), T))       # 북쪽 둑 밑 그늘
    return T


def pond_cell(n, seed=41):
    m, dN, dE, dS, dW = edge_depth(n, inset=1.6, jag=1.6, rad=6.0, seed=seed)
    inside = m >= 0
    rim = 2.6                                                                   # 둑 돌 폭
    # 둑 돌: 4x3 화소 둥근 돌을 엇갈려(주기 16), 돌마다 왼쪽 위 밝음 · 오른쪽 아래 어두움
    row = Y16 // 3; xo = (X16 + (row % 2) * 2) % 16; col = xo // 4; lx = xo % 4; ly = Y16 % 3
    hb = hash2(col + 5 * row, row, seed + 1)
    st = 4 + np.rint((hb - .5) * 1.6)
    st = np.where((lx == 0) & (ly == 0), st + 1, st)
    st = np.where((lx == 3) | (ly == 2), st - 2, st)
    st = np.where(hash2(X16, Y16, seed + 2) > .9, st - 1, st)
    T = None
    rgb = np.zeros((16, 16, 3), np.int32)
    stone = inside & (m < rim)
    # 북쪽 둑 앞면(3/4 — 수면이 땅보다 낮아 북쪽 물가의 흙·돌 벽이 보인다): 돌 테 바로 안쪽 2px
    face = inside & ~stone & (dN < rim + 2.2) & (dN <= np.minimum(np.minimum(dE, dW), dS) + .5)
    wdep = m - rim
    wt = _water(wdep, dN - rim - 2.2)
    rgb[:] = pal(WA, wt)
    fT = np.where(dN - rim < 1.0, 3, 2)
    fT = np.where(((X16 + (Y16 % 2)) % 5) == 0, fT - 1, fT)
    rgb = np.where(face[..., None], pal(ST, fT), rgb)
    # 남·동 물가 안쪽 1px: 밝은 물가 선(돌에 비친 빛)
    lip = inside & ~stone & ~face & (np.minimum(dS, dE) - rim < 1.0) & (dN - rim > 2.5)
    rgb = np.where(lip[..., None], pal(WA, 4 + 0 * X16), rgb)
    rgb = np.where(stone[..., None], pal(ST, np.clip(st, 2, 6)), rgb)
    # 돌 바깥 1px 윤곽(아래·오른쪽은 짙게) + 이끼 점
    outer = stone & (m < .9)
    rgb = np.where(outer[..., None], pal(ST, np.where(np.minimum(dS, dE) < np.minimum(dN, dW), 1, 2)), rgb)
    moss = stone & ~outer & (hash2(X16, Y16, seed + 3) > .86)
    rgb = np.where(moss[..., None], pal(LFC, 2 + 0 * X16), rgb)
    im = rgba(rgb, inside)
    _lilies(im, n, m - rim, seed)
    return im


def _lilies(im, n, wd, seed):
    """수련: 물가가 있는 변형에만(덩이 가운데 15번은 비워 큰 연못에 격자 무늬가 생기지 않게). 잎 5x3(갈라진 홈) + 꽃 2x2."""
    if n == 15: return
    p = im.load(); miss = 4 - bin(n).count('1')
    want = 1 if miss <= 1 else 2
    cand = [(x, y) for y in range(2, 13) for x in range(2, 12)]
    cand.sort(key=lambda c: _hash(c[0], c[1] + n * 17, seed + 7))
    placed = []
    for (x0, y0) in cand:
        if len(placed) >= want: break
        if n in (14, 11, 13, 7) and _hash(n, 3, seed) < .45 and not placed: continue
        ok = all(0 <= x0 + dx < 16 and 0 <= y0 + dy < 16 and wd[y0 + dy, x0 + dx] >= 1.2 for dx in range(-1, 6) for dy in range(-1, 4))
        if not ok or any(abs(x0 - a) < 7 and abs(y0 - b) < 5 for a, b in placed): continue
        placed.append((x0, y0))
        shape = ['.LLL.', 'LLLLL', '.LLL.']
        notch = (2, 0) if _hash(x0, y0, seed + 8) < .5 else (3, 0)
        for dy, row in enumerate(shape):
            for dx, ch in enumerate(row):
                if ch != 'L' or (dx, dy) == notch: continue
                t = 5 if dy == 0 or (dy == 1 and dx < 2) else (4 if dy == 1 else 3)
                p[x0 + dx, y0 + dy] = LFC[t] + (255,)
        for dx in range(1, 4): p[x0 + dx, y0 + 3] = WA[1] + (255,)                       # 잎 밑 물그늘
        if _hash(x0, y0, seed + 9) < .7:
            fc = RED[5] if _hash(x0, y0, seed + 10) < .5 else PLA[6]
            fx, fy = x0 + 3, y0
            p[fx, fy] = fc + (255,); p[fx + 1, fy] = mul(fc, .82) + (255,); p[fx, fy - 1 if fy > 0 else fy] = mul(fc, 1.1) + (255,)


def autotile_pond(): return sheet([pond_cell(n) for n in range(16)])


# ------------------------------------------------------------------ ② 꽃밭 덩이(색 셋)
FLOWER = {
    'red':    (RED, (6, 5, 4, 2)),        # (램프, (반짝, 밝음, 가운데, 그늘))
    'yellow': (STRAW, (6, 5, 4, 3)),
    'white':  (PLA, (6, 5, 4, 2)),
}


def flowerbed_cell(n, color, seed=53):
    m, dN, dE, dS, dW = edge_depth(n, inset=2.0, jag=1.7, rad=5.0, seed=seed)
    inside = m >= 0
    ramp_, (t6, t5, t4, t2) = FLOWER[color]
    # 잎 덩이(주기 16 둥근 잎 뭉치): 잡음으로 밝고 어두운 덩이, 위·왼쪽 빛
    nz = tnoise(16, 16, 4, seed + 1) * .65 + tnoise(16, 16, 8, seed + 2) * .35
    lt = 3 + np.rint((nz - .5) * 3.0)
    lt = np.where(hash2(X16, Y16, seed + 3) > .9, lt + 1, lt)
    lt = np.where(hash2(X16, Y16, seed + 4) < .08, lt - 1, lt)
    front = inside & (dS < 3.0) & (dS <= np.minimum(dE, dW) + .5)               # 남쪽 앞면(덩이 높이 3px)
    lt = np.where(front, np.where(dS < 1.0, 1, 2), lt)
    lt = np.where(inside & (m < 1.0) & ~front, np.where(np.minimum(dN, dW) < np.minimum(dE, dS), 3, 2), lt)   # 가장자리 테
    lt = np.where(inside & (np.minimum(dN, dW) < 2.0) & (m >= 1.0) & ~front, np.maximum(lt, 4), lt)            # 위·왼 빛 테
    rgb = pal(LFC, np.clip(lt, 1, 6))
    # 꽃: 칸 안 주기 16 의 엇갈린 자리(12송이) — 2x2 꽃잎(왼위 반짝) + 오른아래 그늘 1px
    im = rgba(rgb, inside); p = im.load()
    spots = []
    for i in range(14):
        gx = (i % 4) * 4 + int(_hash(i, 1, seed + 5) * 3); gy = (i // 4) * 4 + int(_hash(i, 2, seed + 5) * 3) + (2 if i % 4 % 2 else 0)
        spots.append((gx % 16, gy % 16))
    for (x, y) in spots:
        pts = [((x) % 16, y % 16, t6), ((x + 1) % 16, y % 16, t5), ((x) % 16, (y + 1) % 16, t5), ((x + 1) % 16, (y + 1) % 16, t4)]
        if any(not (0 <= yy < 16) or m[yy, xx] < 1.4 or (front[yy, xx]) for xx, yy, _ in pts): continue
        for xx, yy, t in pts: p[xx, yy] = ramp_[t] + (255,)
        sx, sy = (x + 2) % 16, (y + 1) % 16
        if m[sy, sx] >= 1.4 and not front[sy, sx]: p[sx, sy] = ramp_[t2] + (255,)
        cx_, cy_ = (x + 1) % 16, (y + 2) % 16
        if m[cy_, cx_] >= 1.0 and not front[cy_, cx_]: p[cx_, cy_] = LFC[1] + (255,)
    # 앞면에 드문 꽃 머리(덩이 위에서 늘어진 송이)
    for x in range(16):
        for y in range(16):
            if front[y, x] and dS[y, x] >= 1.0 and _hash(x, y, seed + 6) > .82: p[x, y] = ramp_[t4] + (255,)
    return im


def autotile_flowerbed(color): return sheet([flowerbed_cell(n, color) for n in range(16)])


# ------------------------------------------------------------------ ③ 잔디 위 낙엽·흙 맨땅
def litter_cell(n, seed=67):
    m, dN, dE, dS, dW = edge_depth(n, inset=2.2, jag=2.2, rad=6.0, seed=seed)
    base = tnoise(16, 16, 8, seed + 1) * .6 + tnoise(16, 16, 4, seed + 2) * .4
    T = 3 + np.rint((base - .5) * 2.4)
    h = hash2(X16, Y16, seed + 3)
    T = np.where(h > .94, 5, np.where(h < .06, 2, T))
    peb = (hash2(X16 // 2, Y16 // 2, seed + 4) > .94) & ((X16 + Y16) % 2 == 0)
    T = np.where(peb, 6, T)
    T = np.where((m >= 0) & (m < 1.0), 2, T)                                  # 풀에 닿는 눌린 테
    rgb = pal(EARTH, np.clip(T, 0, 6))
    soil = m >= 0
    # 풀 잔털: 바깥 1~2px 에 초록 점(흙이 풀에 묻힌 가장자리)
    tuft = (m < 0) & (m > -1.9) & (hash2(X16, Y16, seed + 5) > .78 + .05 * (-m))
    rgb = np.where(tuft[..., None], np.array(LAWN)[(hash2(X16, Y16, seed + 6) * 6).astype(int).clip(0, 5)], rgb)
    # 흙 안 풀 포기 드문 점
    sprig = soil & (m > 2) & (hash2(X16, Y16, seed + 7) > .965)
    rgb = np.where(sprig[..., None], np.array(LAWN[2]), rgb)
    im = rgba(rgb, soil | tuft); p = im.load()
    # 낙엽: 3x2 잎(주황·갈색·노랑), 흙 위·풀 가장자리 위에 흩어짐(주기 16)
    LEAVES = [(STRAW[4], STRAW[3], STRAW[2]), (RED[5], RED[4], RED[2]), (WDR[5], WDR[4], WDR[2]), (STRAW[5], STRAW[4], STRAW[3])]
    for i in range(9):
        x = int(_hash(i, 1, seed + 8) * 16); y = int(_hash(i, 2, seed + 8) * 16)
        col = LEAVES[int(_hash(i, 3, seed + 8) * 4)]
        flipd = _hash(i, 4, seed + 8) < .5
        pts = [(0, 0, 0), (1, 0, 1), (1, 1, 1), (2, 1, 2)] if flipd else [(1, 0, 0), (2, 0, 1), (0, 1, 1), (1, 1, 2)]
        cells = [((x + dx) % 16, (y + dy) % 16, k) for dx, dy, k in pts]
        if any(m[yy, xx] < -.5 for xx, yy, _ in cells): continue
        for xx, yy, k in cells: p[xx, yy] = col[k] + (255,)
    return im


def autotile_litter(): return sheet([litter_cell(n) for n in range(16)])


# ------------------------------------------------------------------ 덩이 모양(시험·지도 공용)
def mask_of(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)


def atile(sh, k): return sh.crop((k % 4 * 16, k // 4 * 16, k % 4 * 16 + 16, k // 4 * 16 + 16))


def lay(img, sh, cells, ox=0, oy=0):
    for (x, y) in cells: img.alpha_composite(atile(sh, mask_of(cells, x, y)), (ox + x * T, oy + y * T))


def shapes():
    """시험 모양: 5x5 덩이 · 나선 · 코가 튀어나온 L · 외톨이·한 줄·한 칸 오목."""
    blob = {(x, y) for x in range(5) for y in range(5)} - {(0, 0), (4, 4)}
    sp = set(); x, y = 0, 0
    for (dx, dy, k) in ((1, 0, 6), (0, 1, 6), (-1, 0, 5), (0, -1, 4), (1, 0, 3), (0, 1, 2), (-1, 0, 1)):
        for _ in range(k): sp.add((x, y)); x += dx; y += dy
    sp.add((x, y))
    L = {(x, y) for x in range(2) for y in range(6)} | {(x, y) for x in range(2, 6) for y in range(4, 6)} | {(2, 2), (6, 5), (3, 3)}
    misc = {(0, 0)} | {(x, 2) for x in range(4)} | {(x, y) for x in range(3) for y in range(4, 7)} - {(1, 5)}
    return [('5x5', blob), ('spiral', sp), ('L+nose', L), ('single/line/ring', misc)]


def avenue_paving(mask, joins, rotaries=(), band=6):
    """큰 벽돌 대로·교차 광장: 속은 헤링본, 풀·담·건물에 닿는 변에서 band px 는 어두운 테두리 띠, 띠 안쪽 1px 크림 돌 선,
    맨 바깥 1px 짙은 줄눈(버들항 paving5 의 연석 자리). 지도 밖·joins(길·광장) 쪽은 이어진다(띠 없음). rotaries: (cx, cy, R) px 원."""
    H_ = len(mask); W_ = len(mask[0]); im = new(W_ * T, H_ * T); px = im.load()
    def on(x, y): return not (0 <= x < W_ and 0 <= y < H_) or mask[y][x] or joins[y][x]
    for cy in range(H_):
        for cx in range(W_):
            if not mask[cy][cx]: continue
            n, s, w, e = on(cx, cy - 1), on(cx, cy + 1), on(cx - 1, cy), on(cx + 1, cy)
            nw, ne, sw, se = on(cx - 1, cy - 1), on(cx + 1, cy - 1), on(cx - 1, cy + 1), on(cx + 1, cy + 1)
            for ly in range(16):
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    d = min(ly if not n else 99, 15 - ly if not s else 99, lx if not w else 99, 15 - lx if not e else 99)
                    # 오목 모서리(두 변은 이어지고 대각선만 빈 곳): 띠가 꺾여 이어지게 모서리 사각 띠
                    if n and w and not nw: d = min(d, max(lx, ly))
                    if n and e and not ne: d = min(d, max(15 - lx, ly))
                    if s and w and not sw: d = min(d, max(lx, 15 - ly))
                    if s and e and not se: d = min(d, max(15 - lx, 15 - ly))
                    c = None
                    for (rx, ry, rr) in rotaries:
                        c = rotary_px(X, Y, rx, ry, rr)
                        if c is not None: break
                    if c is None:
                        if d == 0: c = ST[1]
                        elif d < band: c = band_px(X, Y)
                        elif d == band: c = CRM[5] if (X + Y) % 7 else CRM[4]
                        elif d == band + 1: c = TCR[1]
                        else: c = herring_px(X, Y)
                    px[X, Y] = tuple(c[:3]) + (255,)
    return im
