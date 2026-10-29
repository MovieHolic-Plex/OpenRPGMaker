# 빙하기 설원 필드 새 조각 1 — 얼음·빙벽·뼈(손 도트, 버들항 팔레트·px2 볼륨 페인터·pz.fin 윤곽). RGBA Image 를 돌려준다. 결정적.
# 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위.
import math
import numpy as np
from PIL import Image
from iaf_base import C, PAL, P, RGB, F, put, blank, hash2, smooth, _hash, vnoise, SN, IC
from parts5b import lump, slab
from vprops import snowcap


def _px(w, h):
    im = blank(w, h); return im, im.load()


def _blob(px, W, H, cx, cy, rx, ry, mat, lo=2, hi=5, outline=True, seed=1, lit=True):
    """작은 덩이(바위·얼음 덩어리): 윗왼 밝고 아래오른 어둡다, 가장자리 1px 어두운 테."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry; d = dx * dx + dy * dy
            if d > 1 or not (0 <= x < W and 0 <= y < H): continue
            if outline and d > 0.80: t = lo - 1
            else:
                v = 0.5 - 0.55 * dx - 0.65 * dy + (_hash(x, y, seed) - 0.5) * 0.25
                t = int(round(lo + (hi - lo) * max(0, min(1, v))))
            put(px, W, H, x, y, RGB(mat, max(0, t)))


# ================================================================ 빙벽 동굴 입구
def glacier_cave(fh=5):
    """빙벽 앞면에 뚫린 얼음 굴 입구(4 x fh칸): 둥근 아치 굴 — 둘레는 두껍게 깎인 얼음 테(왼·위 안쪽 빗면 밝음, 오른쪽 그늘, 바깥 1px 윤곽),
    아치 위에 얹힌 눈 처마와 고드름, 안쪽은 깊어질수록 짙푸르고 바닥 가까이 푸른 얼음 빛, 문턱엔 굴 안으로 밀려든 눈.
    발치 양옆에 떨어져 나온 얼음 덩이. 바깥은 투명이라 빙벽 앞면이 비친다. 아랫줄 가운데 칸이 들어가는 칸."""
    from scipy import ndimage as ndi
    W, H = 64, fh * 16
    Y, X = np.mgrid[0:H, 0:W].astype(float) + 0.5
    cx, hw = 32.0, 14.5
    sp = H - 36.0                                                              # 아치가 둥글기 시작하는 높이
    jag = np.array([[hash2(int(x) // 3, int(y) // 3, 11) for x in range(W)] for y in range(H)])
    O = (np.abs(X - cx) <= hw) & (Y >= sp) | (((X - cx) / hw) ** 2 + ((Y - sp) / (hw * 1.05)) ** 2 <= 1)
    O &= Y < H - 0.5
    rim_r = 4.2 + (jag - 0.5) * 2.4
    dist = ndi.distance_transform_edt(~O)
    R = (dist > 0) & (dist <= rim_r) & (Y < H - 1)
    im = blank(W, H); px = im.load()
    for y in range(H):
        for x in range(W):
            if O[y, x]:
                f = (y - (sp - hw)) / max(1, H - (sp - hw))
                bay = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y % 4][x % 4] / 16.0
                g = (f - 0.35) / 0.4 - abs(x + 0.5 - cx) / hw * 0.6                 # 아래 가운데로 갈수록 푸른 빛이 밝아진다
                t = 0 if g < bay else (1 if g < 1.0 + bay else 2)
                c = RGB('glac', t)
                d_floor = H - 1 - y
                if d_floor < 6 - abs(x + 0.5 - cx) * 0.25: c = RGB('snow', 5 if d_floor > 2 else 4) if hash2(x, y, 4) > 0.2 else RGB('snow', 3)
                put(px, W, H, x, y, c)
            elif R[y, x]:
                ang = math.atan2(y + 0.5 - (sp + 4), x + 0.5 - cx)                 # 아치 중심에서 바깥 방향
                inner = dist[y, x] <= 1.5
                if dist[y, x] > rim_r[y, x] - 1.0: t = 1
                elif inner: t = 6 if (x + 0.5 < cx and y < H - 10) else (2 if x + 0.5 > cx else 5)
                else:
                    t = 5 if (math.cos(ang) < -0.2 or math.sin(ang) < -0.5) else (3 if math.cos(ang) > 0.3 else 4)
                    if hash2(x // 2, y // 2, 12) > 0.8: t -= 1
                put(px, W, H, x, y, RGB('glac', t))
    # 고드름(아치 안쪽 윗가장자리)
    for x in range(int(cx - hw) + 1, int(cx + hw)):
        yt = next((y for y in range(H) if O[y, x]), None)
        if yt is None or hash2(x, 1, 7) > 0.6: continue
        L = 2 + int(hash2(x, 2, 7) ** 1.4 * 8)
        for j in range(L): put(px, W, H, x, yt + j, IC[6] if j < L - 1 else IC[4])
    # 아치 위 눈 처마
    for x in range(W):
        ys = [y for y in range(H) if R[y, x]]
        if not ys: continue
        y0 = ys[0]
        h = 2 + int(hash2(x, 3, 13) * 2.4) if abs(x + 0.5 - cx) < hw + 4 else 1 + int(hash2(x, 4, 13) * 1.6)
        for j in range(h):
            put(px, W, H, x, y0 - 1 + j, SN[6] if j == 0 else (SN[5] if j < h - 1 else SN[3]))
    # 발치 떨어진 얼음 덩이
    for (bx, by, r) in ((7.5, H - 4.0, 5.0), (56.5, H - 4.5, 5.4), (13.0, H - 2.5, 2.8), (52, H - 2.0, 2.4)):
        _blob(px, W, H, bx, by, r * 1.15, r * 0.8, 'glac', lo=2, hi=6, seed=int(bx))
        for x in range(int(bx - r * 0.9), int(bx + r * 0.4)): put(px, W, H, x, int(by - r * 0.8) + 1, SN[6])
    return F(im, 0.7)


# ================================================================ 얼음에 갇힌 짐승(윤곽만)
def frozen_beast():
    """빙벽 앞면 속에 갇힌 거대 털짐승 그림자(6x3): 굽은 등혹·긴 엄니·늘어진 코·네 다리 윤곽만 짙푸르게 비치고,
    둘레 얼음은 맑게 밝다. 얼굴·눈 없음. 반투명이라 빙벽 결이 겹쳐 보인다."""
    W, H = 96, 48
    Y, X = np.mgrid[0:H, 0:W].astype(float) + 0.5
    def ell(cx, cy, rx, ry): return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1
    m = ell(46, 24, 27, 12) | ell(36, 14, 15, 9) | ell(68, 18, 11, 10) | ell(58, 16, 9, 8)
    for (lx, w) in ((26, 7), (38, 7), (54, 7), (64, 6)):                          # 다리(앞다리가 조금 굵다)
        m |= (X >= lx) & (X < lx + w) & (Y >= 26) & (Y < 42 - (2 if lx in (38, 64) else 0))
    m |= ell(21, 26, 4, 3)                                                        # 꼬리
    # 코: 머리 앞에서 아래로 늘어져 끝이 말린다
    for i in range(22):
        t = i / 21.0; cxn = 76 + 5 * math.sin(t * 1.4); cyn = 22 + 18 * t; r = 3.2 - 1.6 * t
        m |= ell(cxn, cyn, r, r)
    m |= ell(79, 41, 2.2, 1.6)
    # 엄니: 입에서 앞아래로 나와 위로 크게 휜다
    tusk = np.zeros_like(m)
    for i in range(40):
        t = i / 39.0; a = math.pi * (0.95 - 1.15 * t)
        tx = 78 + 12 * math.cos(a) + 6 * t; ty = 30 - 10 * math.sin(a) * 0.9 + 4 * t
        r = 2.2 - 1.3 * t
        tusk |= ell(tx, ty, r, r)
    from scipy import ndimage as ndi
    halo = ndi.binary_dilation(m | tusk, iterations=3) & ~(m | tusk)
    edge = m & ~ndi.binary_erosion(m, iterations=1)
    im = blank(W, H); px = im.load()
    GL = [tuple(int(v) for v in c) for c in P('glac')]
    for y in range(H):
        for x in range(W):
            if halo[y, x]:
                if hash2(x // 2, y // 2, 5) > 0.25: px[x, y] = GL[5] + (150,)
            elif tusk[y, x]:
                px[x, y] = (GL[5] if y < 30 else GL[4]) + (205,)
            elif m[y, x]:
                d = 0 if edge[y, x] else 1
                if (x + y * 2) % 7 == 0 and hash2(x, y, 6) > 0.3 and not edge[y, x]: d = 2       # 털 결(엷은 사선)
                px[x, y] = GL[d] + (235 if edge[y, x] else 200,)
    # 얼음 금이 그림자를 가로지른다
    for (x0, y0, L, dy) in ((12, 8, 18, 1), (50, 4, 22, 1), (70, 34, 16, -1), (30, 36, 14, -1)):
        for j in range(L):
            x = x0 + j; y = y0 + dy * (j // 3)
            if 0 <= x < W and 0 <= y < H: px[x, y] = GL[0] + (230,)
            if 0 <= x < W and 0 <= y + 1 < H: px[x, y + 1] = GL[5] + (200,)
    return im


# ================================================================ 얼어붙은 폭포
def icefall(fh=5):
    """빙벽 꼭대기에서 흘러내리다 언 폭포(2 x fh+1 칸): 처마 위로 넘친 둥근 얼음 입술, 굵기가 다른 얼음 기둥 줄기(왼 밝음·오른 그늘·흰 결),
    발치는 둥글게 부푼 얼음 둔덕이 한 칸 아래 땅까지 번진다."""
    W, H = 32, fh * 16 + 16
    im, px = _px(W, H)
    rng = np.random.default_rng(23)
    tubes = [(5, 4.0), (11, 3.4), (16.5, 4.2), (22, 3.2), (27, 3.6)]
    for (cx, r) in tubes:
        wob = rng.uniform(0, 6.28)
        for y in range(2, H - 10):
            xc = cx + 0.8 * math.sin(y / 9.0 + wob); rr = r * (0.85 + 0.25 * math.sin(y / 13.0 + wob * 2))
            for x in range(int(xc - rr) - 1, int(xc + rr) + 2):
                dx = (x + 0.5 - xc) / rr
                if abs(dx) > 1 or not (0 <= x < W): continue
                t = 5 if dx < -0.45 else (4 if dx < 0.15 else (3 if dx < 0.7 else 2))
                if abs(dx) > 0.9: t = 1
                if (y + int(cx)) % 11 == 0 and dx < 0.3: t = 6
                put(px, W, H, x, y, RGB('ice', t))
    # 윗 입술
    for x in range(1, W - 1):
        for y in range(0, 5):
            dy = (y - 2.5) / 2.5; dx = (x - 16) / 15.5
            if dx * dx + dy * dy <= 1: put(px, W, H, x, y, RGB('ice', 6 if y < 2 else 5) if x < 22 else RGB('ice', 4))
    # 발치 둔덕(위 밝음, 아래 그늘)
    for y in range(H - 18, H):
        for x in range(W):
            dx = (x + 0.5 - 16) / 16.5; dy = (y + 0.5 - (H - 8)) / 8.5
            if dx * dx + dy * dy > 1: continue
            v = 0.55 - 0.5 * dx - 0.7 * dy
            t = 5 if v > 0.7 else (4 if v > 0.35 else (3 if v > 0.05 else 2))
            if dx * dx + dy * dy > 0.82: t = 1
            put(px, W, H, x, y, RGB('ice', t))
    for (x, y) in ((8, H - 13), (12, H - 12), (20, H - 14), (6, H - 9)): put(px, W, H, x, y, RGB('ice', 6))
    return F(im, 0.72)


# ================================================================ 얼음 다리 · 유빙
def ice_bridge(rows=5):
    """얼음 다리(3 x rows 칸): 물길 위로 두껍게 언 천연 얼음판. 윗면은 호수 얼음 결(사선 반짝·금·눈가루), 양 가장자리에 바람에 쌓인 눈 띠와
    밀려 솟은 모난 얼음 조각 몇, 서쪽 가장자리 밝은 테 · 동쪽 가장자리 두께 그늘, 동쪽 물 위로 다리 그림자. 북·남 끝은 얼음판에 녹아든다."""
    import iaf_ground as G
    W, H = 48, rows * 16
    Y, X = np.mgrid[0:H, 0:W]
    e0 = 5 + (np.array([hash2(y // 4, 1, 3) for y in range(H)]) * 2.0).astype(int)
    e1 = 43 - (np.array([hash2(y // 4, 2, 3) for y in range(H)]) * 2.0).astype(int)
    m = (X >= e0[:, None]) & (X < e1[:, None])
    fe = np.minimum(Y, H - 1 - Y)
    m &= ~((fe < 4) & (hash2(X, Y, 9) > fe / 4.0))
    ice = np.array(G.ice_layer(np.pad(m, 8), seed=47, d_in=np.full((H + 16, W + 16), 10.0)))[8:-8, 8:-8]
    im = Image.fromarray(ice, 'RGBA').copy(); px = im.load()
    for y in range(H):
        for x in range(W):
            if not m[y, x]: continue
            lx = x - e0[y]; rx = e1[y] - 1 - x
            if lx < 1: put(px, W, H, x, y, IC[1])
            elif lx < 2: put(px, W, H, x, y, IC[6])
            elif rx < 1: put(px, W, H, x, y, IC[0])
            elif rx < 4: put(px, W, H, x, y, IC[1] if rx < 2 else IC[2])
            elif (lx < 4 or rx < 5) and hash2(x // 2, y // 3, 5) > 0.35: put(px, W, H, x, y, SN[5] if lx < 4 else SN[4])
    rng = np.random.default_rng(31)
    for (cx, cy, w, h) in ((9, 14, 4.0, 3.0), (39, 30, 4.4, 3.2), (10, 47, 3.4, 2.6), (38, 60, 3.8, 2.8), (40, 9, 3.0, 2.4)):
        if cy + h < H - 2: _blob(px, W, H, cx, cy, w, h, 'ice', lo=2, hi=6, seed=int(cx * 5 + cy))
        for x in range(int(cx - w + 1), int(cx)): put(px, W, H, x, int(cy - h) + 1, SN[6])
    for y in range(8, H - 8):
        for x in range(43, 48):
            if px[x, y][3] == 0: px[x, y] = RGB('cwater', 0) + (int(150 - (x - 43) * 28),)
    return im


def ice_floe(size='l', seed=1):
    """물길에 뜬 유빙: 들쭉날쭉한 얼음판 윗면(눈가루) + 앞면 두께 3~4px + 물에 닿는 어두운 줄과 물결 테."""
    W, H = (48, 32) if size == 'l' else (32, 16)
    im, px = _px(W, H)
    rx, ry = (19.0, 8.5) if size == 'l' else (12.5, 4.6)
    cx, cy = W / 2, (H / 2 - 3) if size == 'l' else (H / 2 - 2)
    th = 4 if size == 'l' else 3
    def top(x, y):
        a = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
        rr = 1 + 0.18 * math.sin(a * 3 + seed) + 0.10 * math.sin(a * 7 + seed * 2)
        return ((x + 0.5 - cx) / (rx * rr)) ** 2 + ((y + 0.5 - cy) / (ry * rr)) ** 2 <= 1
    for y in range(H):
        for x in range(W):
            if top(x, y):
                t = 5 if (x - cx) < rx * 0.2 else 4
                if hash2(x // 2, y // 2, seed) > 0.6: t = 6 if t == 5 else 5
                if not top(x, y - 1): t = 6
                put(px, W, H, x, y, RGB('snow', t) if hash2(x // 3, y // 2, seed + 1) > 0.35 else RGB('ice', t))
            elif any(top(x, y - k) for k in range(1, th + 1)):
                k = next(k for k in range(1, th + 1) if top(x, y - k))
                put(px, W, H, x, y, RGB('ice', 3 if k == 1 else 2))
            elif top(x, y - th - 1) or top(x - 2, y - th) or top(x + 2, y - th):
                put(px, W, H, x, y, RGB('cwater', 4))
    return F(im, 0.72)


def pressure_ridge():
    """압력 얼음 둑(3x2): 언 호수 얼음판이 밀려 기울어 솟은 얼음 덩이 무리 — 덩이마다 윗면 밝고 앞면 중간, 오른쪽 그늘, 밑동 눈 번짐."""
    W, H = 48, 32
    c = C(W, H, seed=301); c.shadow(24, 28.5, 21, 2.4, 70)
    rng = np.random.default_rng(5)
    pieces = [(6, 15, 9, 3, 9), (14, 9, 10, 4, 13), (25, 12, 9, 3, 11), (33, 16, 10, 3, 8), (20, 19, 8, 3, 7), (39, 19, 7, 2, 6), (2, 21, 7, 2, 5)]
    for gi, (x0, yt, w, d, h) in enumerate(pieces):
        c.group(gi + 1)
        slab(c, x0, yt, w, d, h, 'ice', top=6 if gi % 2 == 0 else 5, front=(4, 3), seed=gi + 3, tex=0.25)
    for x in range(1, 47):
        for y in range(25, 30):
            if (x - 24) ** 2 / 23.0 ** 2 + (y - 27.5) ** 2 / 2.6 ** 2 <= 1 and hash2(x, y, 3) > 0.15:
                c.tone(x, y, 'snow', 5 if y < 27 else 4)
    return F(c, 0.7)


# ================================================================ 거대 짐승 뼈
def _bone_seg(c, pts, widths, mat='bone', seed=1):
    c.new()
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.5); dy = (yy + 0.5 - y) / max(r, 0.5)
                        t = 5 if (dx + dy) < -0.4 else (4 if (dx + dy) < 0.5 else 2)
                        if _hash(xx, yy, seed) > 0.93: t -= 1
                        c.tone(xx, yy, mat, t)


def mammoth_ribs():
    """거대 짐승 갈비뼈(5x3): 반쯤 눈에 묻힌 등뼈와 휜 갈비 일곱 쌍(먼 쪽은 어둡게), 등뼈 마디 돌기, 밑동 눈 더미."""
    W, H = 80, 48
    c = C(W, H, seed=311); c.shadow(40, 44.5, 36, 2.6, 80)
    spine = [(6, 26), (18, 18), (32, 14), (46, 13), (60, 15), (72, 21), (77, 27)]
    # 먼 쪽 갈비(어둡게, 먼저)
    for i, sx in enumerate((16, 25, 34, 43, 52, 61)):
        sy = 18 - 4 * math.sin((sx - 6) / 70 * math.pi) + 2
        c.group(10 + i)
        _bone_seg(c, [(sx + 2, sy), (sx + 8, sy + 8), (sx + 9, sy + 18), (sx + 6, 40)], [1.6, 1.5, 1.3, 1.1], 'bone', 40 + i)
        for y in range(c.h):
            for x in range(c.w):
                if c.id[y][x] == c.nid and c.fix[y][x] is not None: c.fix[y][x] = max(1, c.fix[y][x] - 2)
    c.group(1)
    _bone_seg(c, spine, [2.6, 3.0, 3.2, 3.2, 3.0, 2.6, 2.2], 'bone', 3)
    for i, (x, y) in enumerate(spine[1:-1]):                                    # 등뼈 돌기
        _bone_seg(c, [(x, y - 1), (x - 1, y - 5)], [1.4, 0.9], 'bone', 50 + i)
    # 가까운 쪽 갈비
    for i, sx in enumerate((12, 21, 30, 39, 48, 57, 66)):
        sy = 18 - 4 * math.sin((sx - 6) / 70 * math.pi)
        c.group(20 + i)
        L = 1.0 - abs(i - 3) * 0.06
        _bone_seg(c, [(sx, sy + 1), (sx - 7 * L, sy + 9), (sx - 8 * L, sy + 19 * L), (sx - 4, 43)], [2.2, 2.0, 1.8, 1.5], 'bone', 60 + i)
    # 밑동 눈 더미
    c.group(40)
    for x in range(0, W):
        hgt = 4 + 2.5 * math.sin(x / 7.0) + 1.5 * math.sin(x / 3.1)
        for y in range(int(45 - hgt), 46):
            if 0 <= y < H:
                t = 6 if y < 45 - hgt + 1.2 else (5 if y < 43 else 4)
                c.tone(x, y, 'snow', t)
    return F(c, 0.66)


def mammoth_skull():
    """거대 짐승 머리뼈(3x2): 눈에 반쯤 묻힌 둥근 정수리(위에 눈), 깊은 콧구멍 그늘, 앞으로 뻗어 위로 휜 굵은 엄니 한 쌍."""
    W, H = 48, 32
    c = C(W, H, seed=321); c.shadow(22, 28.5, 19, 2.2, 80)
    c.group(1)
    c.ellipsoid(17, 16, 12, 10, 'bone', amb=0.25, bump=0.35, bsc=3)
    c.ellipsoid(25, 20, 7, 6, 'bone', amb=0.25, bias=-0.04)
    for (x, y) in ((22, 17), (23, 17), (22, 18), (23, 18), (24, 18), (13, 20), (14, 20), (14, 21)):
        c.tone(x, y, 'bone', 1)
    c.tone(21, 17, 'bone', 2); c.tone(12, 20, 'bone', 2)
    for (x, y) in ((27, 22), (28, 22), (28, 23)): c.tone(x, y, 'bone', 1)
    # 엄니(먼 쪽 먼저, 어둡게)
    c.group(2)
    pts = [(29, 23), (35, 25), (40, 23), (43, 18), (43, 13)]
    _bone_seg(c, [(p[0] - 3, p[1] - 2) for p in pts] + [(38, 9)], [2.2, 2.0, 1.7, 1.3, 0.9, 0.6], 'tusk', 7)
    for y in range(c.h):
        for x in range(c.w):
            if c.id[y][x] == c.nid and c.fix[y][x] is not None: c.fix[y][x] = max(1, c.fix[y][x] - 2)
    c.group(3)
    _bone_seg(c, [(28, 25), (35, 29), (42, 27), (46, 21), (45, 13), (42, 9)], [2.8, 2.6, 2.2, 1.7, 1.2, 0.7], 'tusk', 8)
    # 밑동 눈
    c.group(4)
    for x in range(2, 34):
        hgt = 4 + 1.6 * math.sin(x / 4.0)
        for y in range(int(29 - hgt), 30):
            c.tone(x, y, 'snow', 6 if y < 29 - hgt + 1.2 else (5 if y < 28 else 4))
    im = F(c, 0.66)
    return snowcap(im, 2, 3)


def tusk_arch():
    """엄니 문(3x3): 눈 더미에 박힌 거대 엄니 둘이 서로를 향해 휘어 꼭대기에서 가죽 끈으로 묶였다, 끈에 매단 뼈 장식 둘. 가운데 칸은 지나간다."""
    W, H = 48, 48
    c = C(W, H, seed=331); c.shadow(24, 45, 22, 2.2, 70)
    c.group(1)
    _bone_seg(c, [(7, 44), (6, 32), (8, 20), (14, 10), (22, 5)], [3.0, 2.8, 2.4, 1.8, 1.2], 'tusk', 3)
    c.group(2)
    _bone_seg(c, [(41, 44), (42, 32), (40, 20), (34, 10), (26, 5)], [3.0, 2.8, 2.4, 1.8, 1.2], 'tusk', 4)
    c.group(3); c.new()
    for (x, y) in ((21, 4), (22, 4), (23, 5), (24, 5), (25, 4), (26, 4), (22, 6), (25, 6), (23, 7), (24, 7)):
        c.tone(x, y, 'hide', 4 if x < 24 else 3)
    for (x0, L) in ((20, 7), (28, 5)):                                         # 늘어진 끈 + 뼈 장식
        c.new()
        for j in range(L): c.tone(x0, 7 + j, 'hide', 3)
        c.tone(x0, 8 + L, 'bone', 5); c.tone(x0 - 1, 9 + L, 'bone', 4); c.tone(x0 + 1, 9 + L, 'bone', 3); c.tone(x0, 10 + L, 'bone', 3)
    c.group(4)
    for (cx, w) in ((7, 7), (41, 7)):                                          # 밑동 눈 더미
        lump(c, cx, 39, w, 2.2, 3, 'snow', top=6, front=(5, 4), seed=cx, tex=0.1)
    return F(c, 0.66)


def bone_scatter(seed=1):
    """흩어진 뼈 조각(1칸 장식, 걷기): 짧은 뼈 둘·관절 하나가 눈에 반쯤 묻혔다."""
    c = C(16, 16, seed=341 + seed)
    _bone_seg(c, [(3, 11), (10, 9)], [1.2, 1.0], 'bone', 1)
    c.tone(2, 10, 'bone', 5); c.tone(2, 12, 'bone', 4); c.tone(11, 8, 'bone', 5); c.tone(11, 10, 'bone', 4)
    _bone_seg(c, [(9, 13), (13, 12)], [0.9, 0.8], 'bone', 2)
    c.ellipsoid(6, 5, 2.4, 1.8, 'bone', amb=0.3)
    for x in range(1, 15):
        if c.m[13][x] is None and _hash(x, 1, seed) > 0.4: c.tone(x, 14, 'snow', 5)
    return F(c, 0.7)


# ================================================================ 얼음 덩이 · 세락
def _crystal(c, cx, ybot, w, h, lean=0.0, mat='ice', seed=1):
    """얼음 결정 뾰족돌: 납작한 끝 + 왼 면 밝음 · 오른 면 어둠 · 가운데 능선 흰 줄."""
    c.new()
    top = ybot - h
    for yi in range(int(top), int(ybot) + 1):
        f = (yi - top) / max(1, h)
        half = 0.8 + (w / 2 - 0.8) * f ** 0.7
        x0 = cx + lean * (1 - f) * h * 0.3
        for xi in range(int(x0 - half - 1), int(x0 + half + 2)):
            x = xi + 0.5
            if abs(x - x0) > half: continue
            if yi <= top + 1: t = 6
            elif x < x0 - 0.6: t = 5 if f < 0.6 else 4
            elif x < x0 + 0.6: t = 6 if f < 0.75 else 5
            else: t = 3 if f < 0.7 else 2
            c.tone(xi, yi, mat, t)


def ice_shards(seed=1):
    """눈 위로 솟은 얼음 결정 무리(2x2): 크기·기울기가 다른 푸른 얼음 뾰족돌 다섯, 밑동 눈."""
    c = C(32, 32, seed=351 + seed); c.shadow(16, 29.5, 13, 2.0, 80)
    for (x, yb, w, h, ln, m) in ((14, 27, 7, 21, 0.25, 'ice'), (21, 28, 6, 14, -0.2, 'glac'), (8, 29, 5, 11, 0.35, 'ice'), (25, 30, 4, 8, -0.1, 'ice'), (17, 30, 5, 7, 0.0, 'glac')):
        _crystal(c, x, yb, w, h, ln, m, seed)
    c.new()
    for x in range(3, 30):
        for y in range(28, 31):
            if (x - 16) ** 2 / 13.5 ** 2 + (y - 29.5) ** 2 / 1.8 ** 2 <= 1: c.tone(x, y, 'snow', 5 if y < 30 else 4)
    return F(c, 0.7)


def serac(seed=1):
    """빙하 세락(2x3): 모나게 갈라진 키 큰 얼음 봉우리 셋 — 결정처럼 깎인 면(왼 면 밝음·가운데 능선 흰 줄·오른 면 그늘), 꼭대기와 턱에 눈,
    가로 금, 밑동 눈 더미. 맨 아랫줄 2칸 막힘."""
    W, H = 32, 48
    c = C(W, H, seed=361 + seed); c.shadow(16, 45.5, 13, 2.2, 90)
    for gi, (x, yb, w, h, ln, m) in enumerate(((15, 43, 15, 40, 0.15, 'glac'), (24, 44, 10, 26, -0.25, 'glac'), (8, 45, 10, 20, 0.3, 'ice'))):
        c.group(gi + 1); _crystal(c, x, yb, w, h, ln, m, seed + gi)
    for (x0, y0, L) in ((10, 22, 8), (19, 31, 6), (6, 37, 5), (13, 14, 5)):
        for j in range(L):
            xx, yy = x0 + j, y0 + j // 3
            if c.m[yy][xx]: c.tone(xx, yy, c.m[yy][xx], 1); c.tone(xx, yy + 1, c.m[yy][xx], 5)
    for y in range(c.h - 1):                                                      # 턱·꼭대기 눈(윗면이 빈 화소)
        for x in range(c.w):
            if c.m[y][x] in ('glac', 'ice') and (y == 0 or c.m[y - 1][x] is None) and _hash(x, y, seed) > 0.25:
                c.tone(x, y, 'snow', 6)
                if c.m[y + 1][x]: c.tone(x, y + 1, 'snow', 5)
    c.group(4)
    lump(c, 16, 41, 14, 2.0, 3, 'snow', top=6, front=(5, 4), seed=seed, tex=0.1)
    return F(c, 0.68)


def tusk_single(seed=1):
    """눈에 박혀 선 거대 엄니 하나(1x2): 굵은 밑동에서 휘어 올라 끝이 뾰족하다, 밑동 눈 더미. 밑동 칸만 막힘."""
    W, H = 16, 32
    c = C(W, H, seed=421 + seed); c.shadow(8, 29.5, 6, 1.4, 90)
    c.group(1)
    _bone_seg(c, [(6, 29), (5, 22), (6, 14), (9, 8), (13, 4)], [2.6, 2.4, 2.0, 1.4, 0.7], 'tusk', seed)
    for y in (12, 18, 24):                                                       # 상아 나이테 금
        for x in range(2, 10):
            if c.m[y][x] == 'tusk': c.darken(x, y, 1)
    c.group(2)
    lump(c, 7, 26, 6, 1.8, 2, 'snow', top=6, front=(5, 4), seed=seed, tex=0.05)
    return F(c, 0.66)


def rock_rimed(seed=1):
    """서리 앉은 바위(2x2): 둥근 회색 바위(버들항 돌 램프) 위 두꺼운 눈 모자, 바람 맞은 왼쪽에 상고대, 앞 턱의 짧은 고드름."""
    W, H = 32, 32
    c = C(W, H, seed=371 + seed); c.shadow(16, 28.5, 14, 2.4, 90)
    c.group(1)
    c.ellipsoid(16, 19, 13, 9.5, 'stone', amb=0.18, bump=0.6, bsc=3.5)
    c.ellipsoid(10, 15, 6.5, 5, 'stone', amb=0.2, bias=0.05, bump=0.5, bsc=2.5)
    im = F(c, 0.64)
    im = snowcap(im, 4, seed + 2)
    px = im.load()
    for y in range(12, 26):                                                      # 왼쪽 상고대(바람 쪽 흰 깃)
        for x in range(0, 8):
            if px[x, y][3] > 200 and (x == 0 or px[x - 1, y][3] < 200) and hash2(x, y, seed) > 0.35:
                put(px, W, H, x, y, SN[6])
                if x > 0 and hash2(x, y, seed + 1) > 0.5: put(px, W, H, x - 1, y, SN[5])
    for x in range(8, 26, 3):                                                    # 앞 턱 고드름
        yb = None
        for y in range(H - 1, 0, -1):
            if px[x, y][3] > 200: yb = y; break
        if yb and yb < H - 2 and hash2(x, 3, seed) > 0.4:
            for j in range(1, 3): put(px, W, H, x, yb + j, IC[5] if j == 1 else IC[4])
    return im


def rocks_snowy(seed=1):
    """눈 덮인 잔돌(1칸 장식, 걷기)."""
    c = C(16, 16, seed=381 + seed)
    for (cx, cy, rx, ry) in ((4, 11, 3.0, 2.2), (11, 12, 3.4, 2.4), (9, 7, 2.2, 1.7)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'stone', amb=0.22, bump=0.4)
    return snowcap(F(c, 0.66), 1, seed)


def _soft(c):
    """눈 더미는 윤곽선 없이 — 밑 가장자리 1px 만 그늘(3), 윗가장자리는 바탕 눈에 녹아든다."""
    im = c.img(False); px = im.load(); W, H = im.size
    src = im.copy().load()
    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 200 and (y + 1 >= H or src[x, y + 1][3] < 200): put(px, W, H, x, y, SN[3])
    return im


def drift_big(seed=1):
    """바람에 깎인 큰 눈 둔덕(3x2): 둥근 윗면, 바람 반대쪽(오른쪽)으로 말려 내려온 처마 능선, 앞면 푸른 그늘. 밑동 줄 막힘."""
    W, H = 48, 32
    c = C(W, H, seed=391 + seed); c.shadow(26, 28, 21, 2.4, 50)
    c.group(1)
    lump(c, 23, 8, 20, 6.5, 9, 'snow', top=5, front=(4, 3), seed=seed, tex=0.08)
    c.group(2)
    lump(c, 14, 6, 9, 4, 5, 'snow', top=6, front=(5, 4), seed=seed + 1, tex=0.05)
    # 처마 능선: 윗면 오른쪽 가장자리 1px 밝은 말린 테 + 아래 짙은 그늘 줄
    for x in range(20, 44):
        y = int(10 + (x - 20) * 0.18 + 1.5 * math.sin(x / 3.5))
        c.tone(x, y, 'snow', 6); c.tone(x, y + 1, 'snow', 3)
    for (x, y) in ((8, 12), (9, 12), (30, 9), (31, 9), (36, 11)): c.tone(x, y, 'snow', 6)
    return _soft(c)


def drift_small(seed=1):
    """작은 눈 둔덕(2x1 장식, 걷기): 낮은 눈 더미, 윗면 밝고 앞 가장자리 그늘."""
    W, H = 32, 16
    c = C(W, H, seed=401 + seed)
    lump(c, 15, 4, 13, 3.0, 3, 'snow', top=5, front=(4, 3), seed=seed, tex=0.05)
    lump(c, 9, 3, 6, 2.0, 2, 'snow', top=6, front=(5, 4), seed=seed + 1, tex=0.05)
    return _soft(c)


def snow_den():
    """설동(3x2): 큰 눈 언덕 앞에 판 굴 입구 — 아치 모양 어두운 구멍, 다져진 눈 문턱, 입구 위 처마 눈과 짧은 고드름, 둘레 발자국.
    둔덕 몸은 막히고 아랫줄 가운데 칸(굴 입구)만 걷기·이동 이벤트."""
    W, H = 48, 32
    c = C(W, H, seed=411); c.shadow(24, 29, 22, 2.4, 50)
    c.group(1)
    lump(c, 24, 3, 22, 7.5, 13, 'snow', top=5, front=(4, 3), seed=4, tex=0.08)
    c.group(2)
    lump(c, 15, 2, 9, 3.5, 4, 'snow', top=6, front=(5, 4), seed=5, tex=0.05)
    im = F(c, 0.84)
    px = im.load()
    cx, top = 24, 15
    for y in range(top, H - 2):
        for x in range(cx - 8, cx + 9):
            dx = (x + 0.5 - cx) / 7.5; dy = (y + 0.5 - (top + 7.5)) / 7.5
            if y + 0.5 < top + 7.5 and dx * dx + dy * dy > 1: continue
            if abs(dx) > 1: continue
            f = (y - top) / (H - 2 - top)
            put(px, W, H, x, y, RGB('glac', 0) if f < 0.65 else RGB('glac', 1))
            if (y + 0.5 < top + 7.5 and dx * dx + dy * dy > 0.72) or abs(dx) > 0.86: put(px, W, H, x, y, RGB('snow', 2))
    for x in range(cx - 7, cx + 8):                                              # 처마 고드름
        if hash2(x, 1, 3) > 0.45:
            yt = top + int(7.5 - 7.5 * math.sqrt(max(0, 1 - ((x + 0.5 - cx) / 7.5) ** 2)))
            for j in range(1 + int(hash2(x, 2, 3) * 3)): put(px, W, H, x, yt + j, IC[5])
    for x in range(cx - 9, cx + 10):                                             # 문턱 다진 눈
        for y in (H - 3, H - 2):
            if abs(x - cx) < 9 - (y - (H - 3)) * 2: put(px, W, H, x, y, RGB('snow', 4 if y == H - 3 else 3) if hash2(x, y, 5) > 0.25 else RGB('snow', 5))
    return im
