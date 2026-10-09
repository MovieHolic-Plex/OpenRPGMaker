# 얼음 동굴 땅·벽·천장 페인터와 오토타일 3종. 모든 칠하기는 (X,Y) 화소 좌표 배열을 받아 RGB 를 돌려준다.
# 주기 잡음(wl.tnoise)이라 3x3칸(48x48) 표본을 이어 붙여도 이음새가 없다. 같은 함수가 맵 전체(768x576 등)도 칠한다.
from wl import *
from wl import N_, E_, S_, W_

def tn(X, sc, seed):
    Hh, Ww = X.shape
    return tnoise(Ww, Hh, sc, seed)

def rgb_of(mat, T):
    return P(mat)[np.clip(T, 0, 6).astype(int)]

def worley(X, Y, cell, seed, per=None):
    """주기 보로노이: 가장 가까운 두 점 거리 차(작을수록 균열선). per = 주기(화소). 반환 (d2-d1)."""
    Hh, Ww = X.shape; per = per or Ww
    n = per // cell
    gx = X // cell; gy = Y // cell
    d1 = np.full(X.shape, 1e9); d2 = np.full(X.shape, 1e9)
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx = gx + i; cy = gy + j
            px = (cx + hash2(cx % n, cy % n, seed)) * cell
            py = (cy + hash2(cx % n, cy % n, seed + 77)) * cell
            d = np.hypot(X - px, Y - py)
            nd1 = np.minimum(d1, d); d2 = np.minimum(d2, np.maximum(d1, d)); d1 = nd1
    return d2 - d1

# ================================================================ 바닥
def paint_ice(X, Y, seed=1, cracks=False):
    """맨 얼음 바닥: 푸른 얼음, 긁힌 빛줄, 넓고 흐린 반사. cracks=True 면 자잘한 금(보로노이)이 거미줄처럼."""
    n = tn(X, 12, seed) * 0.5 + tn(X, 6, seed + 1) * 0.3 + tn(X, 3, seed + 2) * 0.2
    T = 2.4 + n * 1.9
    T = np.where(tn(X, 24, seed + 3) > 0.62, T + 0.7, T)
    h = hash2(X, Y, seed + 4)
    T = np.rint(T)
    sc = (hash2(X // 3, Y // 2, seed + 5) > 0.955) & ((X + Y) % 3 != 0)     # 긁힌 짧은 빛줄
    T = np.where(sc, np.minimum(T + 2, 6), T)
    T = np.where(h > 0.992, 6, T); T = np.where(h < 0.02, T - 1, T)
    if cracks:
        w = worley(X, Y, 16, seed + 9)
        line = w < 1.15
        T = np.where(line, 1, T)
        lit = np.roll(np.roll(line, 1, 0), 1, 1) & ~line
        T = np.where(lit, np.minimum(T + 2, 6), T)
    return rgb_of('ice', np.clip(T, 1, 6))

def paint_snow(X, Y, seed=3):
    n = tn(X, 12, seed) * 0.5 + tn(X, 6, seed + 1) * 0.5
    T = 4.3 + n * 1.5
    T = np.where(tn(X, 8, seed + 2) < 0.32, T - 1.2, T)
    h = hash2(X, Y, seed + 3)
    T = np.rint(T)
    T = np.where(h > 0.985, 6, T)
    # 발자국 같은 오목(어두운 반달)
    dent = (hash2(X // 6, Y // 6, seed + 5) > 0.93) & (hash2(X, Y, seed + 6) > 0.35) & ((X % 6) < 3) & ((Y % 6) < 2)
    T = np.where(dent, T - 1, T)
    # 얼음이 비치는 푸른 점
    T = np.where((h < 0.012), 3, T)
    return rgb_of('snow', np.clip(T, 2, 6))

def paint_lake(X, Y, seed=5, cracks=True):
    """얼어붙은 호수 한가운데: 짙은 푸른 얼음, 흐름이 굳은 가로 줄, 큰 금, 갇힌 기포."""
    n = tn(X, 12, seed) * 0.55 + tn(X, 4, seed + 1) * 0.45
    T = 2.2 + n * 1.8
    st = (hash2(X // 5, Y, seed + 2) > 0.90) & (tn(X, 12, seed + 3) > 0.4)           # 가로로 굳은 흐름 줄
    T = np.rint(T)
    T = np.where(st, T + 1, T)
    if cracks:
        w = worley(X, Y, 24, seed + 5)
        line = w < 1.3
        T = np.where(line, 1, T)
        lit = np.roll(line, 1, 1) & ~line
        T = np.where(lit, np.minimum(T + 2, 6), T)
    bub = (hash2(X // 4, Y // 4, seed + 7) > 0.975) & ((X % 4) < 2) & ((Y % 4) < 2)    # 2x2 기포
    T = np.where(bub, 5, T)
    return rgb_of('deepice', np.clip(T, 1, 6))

# ================================================================ 벽 앞면 / 천장
def paint_face_ice(X, Y, fy, seed=11):
    """얼음 벽 앞면(32 화소 높이 중 fy=0 이 윗선). 세로 면(패싯)마다 톤이 다르고 왼쪽 가장자리는 밝고 오른쪽은 어둡다."""
    fw = 5 + (hash2(np.arange(1), np.arange(1), seed)[0] * 0).astype(int)   # 자리표시(아래에서 열 번호로 폭을 정함)
    col = X // 6 + (hash2(Y // 16, np.zeros_like(Y), seed + 1) * 3).astype(int)    # 줄마다 어긋난 패싯 폭
    f = hash2(col, np.zeros_like(col), seed + 2)
    T = 2.2 + f * 1.5
    T = T + (tn(X, 6, seed + 3) - 0.5) * 0.9
    lx = (X + (hash2(Y // 16, Y // 16, seed + 4) * 6).astype(int)) % 6
    T = np.where(lx == 0, T + 1.3, np.where(lx == 5, T - 1.0, T))
    T = np.rint(T)
    # 윗선(벽 윗면 모서리): 밝은 띠 2줄
    T = np.where(fy <= 1, 6 - fy * 1, T)
    T = np.where((fy >= 2) & (fy <= 4), np.maximum(T, 4), T)
    # 아래 5줄: 그림자 + 쌓인 눈
    T = np.where(fy >= 27, T - 1, T)
    T = np.where(fy >= 29, T - 1, T)
    sn = (fy >= 28) & (hash2(X // 2, fy // 2, seed + 5) > 0.55 - (fy - 28) * 0.1)
    # 가로 층리 금(드문드문 끊김)
    ln = ((fy + (X // 11) * 3) % 9 == 0) & (hash2(X // 4, fy, seed + 6) > 0.3)
    T = np.where(ln, T - 1, T)
    dg = hash2(X, Y, seed + 7)
    T = np.where(dg > 0.985, 6, T); T = np.where(dg < 0.015, 1, T)
    rgb = rgb_of('ice', np.clip(T, 1, 6))
    rgb = np.where(sn[..., None], P('snow')[5 + (hash2(X, Y, seed + 8) > 0.5).astype(int)], rgb)
    return rgb

def paint_face_rock(X, Y, fy, seed=13):
    """어두운 동굴 암벽 앞면: 세로 결 + 가로 지층 + 서리. 얼음벽보다 한 단 어둡다."""
    n = tn(X, 4, seed) * 0.6 + tn(X, 12, seed + 1) * 0.4
    T = 1.9 + n * 1.8
    T = T + (hash2(X, Y // 4, seed + 2) - 0.5) * 0.9
    T = np.rint(T)
    st = ((fy + (X // 13) * 3) % 8 == 0) & (hash2(X // 4, fy, seed + 3) > 0.25)
    T = np.where(st, T - 1, np.where(((fy + (X // 13) * 3) % 8 == 1) & (hash2(X // 4, fy, seed + 3) > 0.55), T + 1, T))
    vc = (hash2(X, fy // 6, seed + 4) > 0.965) & (hash2(X // 2, fy // 3, seed + 5) > 0.3)
    T = np.where(vc, T - 1, T)
    T = np.where(fy <= 1, 5 - fy, T)
    T = np.where((fy >= 2) & (fy <= 3), np.maximum(T, 4), T)
    T = np.where(fy >= 28, T - 1, T)
    # 서리(오른쪽 위 쪽으로 번진 하얀 점)
    fr = (hash2(X, Y, seed + 6) > 0.93) & (tn(X, 8, seed + 7) > 0.5)
    rgb = rgb_of('cavestone', np.clip(T, 1, 5))
    rgb = np.where(fr[..., None], P('frost')[4], rgb)
    sn = (fy >= 29) & (hash2(X // 2, fy // 2, seed + 8) > 0.6)
    rgb = np.where(sn[..., None], P('snow')[5], rgb)
    return rgb

def paint_ceiling(X, Y, seed=17, tint='cavestone'):
    n = tn(X, 8, seed) * 0.5 + tn(X, 3, seed + 1) * 0.5
    T = 0.8 + n * 1.6
    T = np.rint(T + (hash2(X, Y, seed + 2) - 0.5) * 0.7)
    T = np.where(hash2(X, Y, seed + 3) > 0.992, 3, T)                  # 반짝이는 서리 점
    return rgb_of(tint, np.clip(T, 0, 3))

# ================================================================ 오토타일
def _sheet_by(cellfn):
    cells = [cellfn(n) for n in range(16)]
    return sheet_from_cells(cells)

def _terrain_cell(n, tex_fn, seed, inset, jag, rad, rim='ice', rimtones=(1, 5)):
    m, miss = edge_depth(n, inset, jag, rad, seed)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    rgb = tex_fn(X, Y).astype(np.uint8)
    inside = m >= 0
    alpha = inside.copy()
    rimmask = inside & (m < 1.0)                                  # 바깥 1 화소 = 윤곽(어둡게)
    lipmask = inside & (m >= 1.0) & (m < 2.2) & (m < 90)          # 안쪽 한두 줄 = 밝은 입술
    pal = P(rim)
    rgb = np.where(rimmask[..., None], pal[rimtones[0]], rgb)
    rgb = np.where((lipmask & (((X + Y) % 3) != 0))[..., None], pal[rimtones[1]], rgb)
    return Image.fromarray(np.dstack([rgb, np.where(alpha, 255, 0).astype(np.uint8)]), 'RGBA')

def autotile_frozenlake():
    """얼어붙은 호수 가장자리(아래층 투명 덧그림). 번호 0 = 외톨이 얼음 판, 15 = 호수 속."""
    return _sheet_by(lambda n: _terrain_cell(n, lambda X, Y: paint_lake(X, Y, 5, cracks=False), 21, 1.6, 1.4, 6.0, 'deepice', (0, 5)))

def autotile_snowdrift():
    """눈이 얼음 바닥 위로 번진 자리(아래층 투명 덧그림). 가장자리는 부풀어 오른 눈 테두리."""
    def cell(n):
        c = _terrain_cell(n, lambda X, Y: paint_snow(X, Y, 3), 23, 2.2, 1.9, 6.0, 'snow', (2, 6))
        return c
    return _sheet_by(cell)

def _crack_path(direction, seed=31):
    """중심(8,8)→변의 가운데까지 휘어진 금. 방향마다 위치와 상관없이 같은 모양이라 이웃 칸과 이어진다."""
    ends = {'N': (8, 0), 'E': (15, 8), 'S': (8, 15), 'W': (0, 8)}
    ex, ey = ends[direction]
    pts = []; cx, cy = 8.0, 8.0
    steps = 9
    off = 0.0
    for i in range(steps + 1):
        f = i / steps
        x = 8 + (ex - 8) * f; y = 8 + (ey - 8) * f
        amp = 1.9 * math.sin(math.pi * f) ** 0.8
        j = (hash2(i, ord(direction), seed) - 0.5) * 2 * amp
        if direction in 'NS': x += j
        else: y += j
        pts.append((x, y))
    return pts

def autotile_crack():
    """바닥 균열(아래층 투명 덧그림): 중심에서 이웃 방향으로 금이 뻗는다. 0 = 작은 별금, 15 = 십자."""
    def cell(n):
        c = Cv(16, 16)
        dirs = [d for d, b in (('N', N_), ('E', E_), ('S', S_), ('W', W_)) if n & b]
        def line(p0, p1, tone):
            n_ = int(max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1]))) * 2 + 1
            for i in range(n_ + 1):
                f = i / n_
                c.set(int(round(p0[0] + (p1[0] - p0[0]) * f)), int(round(p0[1] + (p1[1] - p0[1]) * f)), 'ice', tone)
        for d in dirs:
            pts = _crack_path(d)
            for a, b in zip(pts, pts[1:]): line(a, b, 1)
        if not dirs:                                           # 외톨이: 작은 별 모양 금
            for (dx, dy) in ((-2, -1), (2, 1), (-1, 2), (1, -2)): line((8, 8), (8 + dx, 8 + dy), 1)
        # 밝은 가장자리: 금 오른쪽 아래 한 화소
        im = c.img(outline=False); px = im.load()
        out = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); po = out.load()
        for y in range(16):
            for x in range(16):
                if px[x, y][3]:
                    po[x, y] = px[x, y]
        for y in range(15):
            for x in range(15):
                if px[x, y][3] and not px[x + 1, y + 1][3] and po[x + 1, y + 1][3] == 0:
                    po[x + 1, y + 1] = hx(PAL['ice'][5]) + (150,)
        return out
    return _sheet_by(cell)

if __name__ == '__main__':
    import terrain_preview
