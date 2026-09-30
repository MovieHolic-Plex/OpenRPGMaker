"""월드맵 설계 데모 5단계 — 자연스러운 지형 경계.

4단계는 바닥 경계를 8x8 사분면 오토타일(4변형)로 이었다. 그래서 (1) 직선·직각 계단이 생기고 (2) 모든 쌍에 같은 '어두운 테두리'가 씌워졌다.
원본 World.png 를 8배로 잘라 잰 결은 이렇다: 경계 출렁임 ±1~2px, 1px 어두운 테두리가 끊겨서(덮임 약 70%) 이어지고,
바깥쪽에 드문 1px 튀김(spray), 오목 모서리는 2~3px 깎여 둥글고, 그라데이션은 없다.

여기서는 같은 결을 '쌍(A 위 B)마다' 픽셀 단위로 만든다. 무작위 생성기 없음 — 결정적 해시 노이즈 + 손으로 정한 쌍별 매개변수.
  1. 지형마다 타일 마스크를 16배 키워 부호 있는 거리장(SDF)을 만들고 σ 로 둥글린다(오목/볼록 모서리가 2~3px 깎인다).
  2. 점수 = SDF + 우선순위 오프셋(높은 쪽이 안쪽으로 물러난다) + 2단 해시 노이즈(6px·3px 파장, ±1.6px / ±.9px) + 픽셀 노이즈.
     점수가 가장 큰 지형이 그 픽셀의 주인이다 → 경계는 출렁이고 끊긴다. 같은 노이즈라서 이웃 타일과 이음매가 없다.
  3. 경계선의 높은 쪽 1px 에 쌍별 테두리색(두 지형의 어두운 색 혼합)을 덮임률 pair_cover 로 칠한다. 대비가 약한 쌍은 덮임률·농도를 낮춘다.
  4. 낮은 쪽 바깥 1~2px 에 드문 튀김(높은 쪽 중간색)을 뿌린다.
"""
import numpy as np
import scipy.ndimage as ndi
import terrain_v4 as V
from terrain_v4 import PRI, TEX, GRASS, FARM, CROP, SNOW, GLACIER, CHASM, CRATER, BASALT, ASH, _lum
from terrain_lib import hx, BAYER

MASK32 = 0xFFFFFFFF


def hash2(ix, iy, salt):
    v = (ix.astype(np.int64) * 73856093) ^ (iy.astype(np.int64) * 19349663) ^ (int(salt) * 83492791) ^ 0x9E3779B9
    v &= MASK32
    v ^= v >> 15
    v = (v * 2246822519) & MASK32
    v ^= v >> 13
    v = (v * 3266489917) & MASK32
    v ^= v >> 16
    return (v & MASK32) / 4294967296.0


def vnoise(h, w, scale, salt, ox=0, oy=0):
    """매끈한 값 노이즈 [-1,1]. scale=격자 간격(px)."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    xs = (xs + ox) / scale
    ys = (ys + oy) / scale
    x0, y0 = np.floor(xs).astype(np.int64), np.floor(ys).astype(np.int64)
    fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = hash2(x0, y0, salt), hash2(x0 + 1, y0, salt)
    c, d = hash2(x0, y0 + 1, salt), hash2(x0 + 1, y0 + 1, salt)
    return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) * 2 - 1


# ─── 쌍별 매개변수 ───
def mean_col(g):
    return TEX[g].reshape(-1, 3).mean(0)


def dark_col(g):
    u = sorted({tuple(int(v) for v in c) for c in TEX[g].reshape(-1, 3)}, key=_lum)
    return np.array(u[0], np.float32)


def mid_col(g):
    u = sorted({tuple(int(v) for v in c) for c in TEX[g].reshape(-1, 3)}, key=_lum)
    return np.array(u[len(u) // 2], np.float32)


def light_col(g):
    u = sorted({tuple(int(v) for v in c) for c in TEX[g].reshape(-1, 3)}, key=_lum)
    return np.array(u[-1], np.float32)


_PAIR = {}


def pair(a, b):
    """a 가 b 보다 우선순위가 높을 때(a 가 위) 테두리 매개변수."""
    k = (a, b)
    if k in _PAIR:
        return _PAIR[k]
    contrast = float(np.abs(mean_col(a) - mean_col(b)).sum())           # 색 거리(0~600)
    rim = dark_col(a) * .62 + dark_col(b) * .38
    rim = rim * .8 if contrast > 60 else rim * .92 + mean_col(a) * .08   # 약한 대비는 덜 어둡게
    cover = float(np.clip(.38 + contrast / 260, .42, .80))               # 테두리가 덮는 비율(원본 ≈70%)
    strength = float(np.clip(.45 + contrast / 180, .55, 1.0))
    spray = float(np.clip(.06 + contrast / 2400, .05, .16))
    ice = SNOW in (a, b) or GLACIER in (a, b)
    if ice:
        rim = mean_col(b if a in (SNOW, GLACIER) else a) * .78 + np.array([16, 34, 52], np.float32) * .2
        cover, strength = min(cover, .62), .75
    _PAIR[k] = dict(rim=rim.astype(np.float32), cover=cover, strength=strength, spray=spray, contrast=contrast)
    return _PAIR[k]


OFF_K = .42          # 우선순위 1단당 안쪽으로 물러나는 px
NOISE = dict(mid=(20.0, 6.0), big=(6.0, 1.7), small=(3.0, .95), px=.55)
SIGMA = 2.4


def _ground_fill(M, lv):
    """레벨 lv 의 타일 지형맵. 다른 레벨·물 칸은 가장 가까운 같은 레벨 땅으로 메운다(경계를 만들지 않는다)."""
    ok = (M.G >= 10) & (M.Hh == lv)
    if not ok.any():
        return None, ok
    idx = ndi.distance_transform_edt(~ok, return_distances=False, return_indices=True)
    return M.G[idx[0], idx[1]], ok


def label_map(M, lv):
    Gf, ok = _ground_fill(M, lv)
    if Gf is None:
        return None
    Hp, Wp = M.H * 16, M.W * 16
    types = [int(g) for g in np.unique(Gf[ok])]
    # 이 레벨에 실제로 있는 지형만 겨룬다. (메운 칸 때문에 생기는 지형은 ok 안에 있는 것들뿐)
    best = np.full((Hp, Wp), -1e9, np.float32)
    lab = np.zeros((Hp, Wp), np.int16)
    for g in types:
        m = np.repeat(np.repeat(Gf == g, 16, 0), 16, 1)
        if not m.any():
            continue
        sdf = ndi.distance_transform_edt(m) - ndi.distance_transform_edt(~m)
        sdf = ndi.gaussian_filter(sdf.astype(np.float32), SIGMA)
        amp = .35 if g in (FARM, CROP) else 1.0
        n = (vnoise(Hp, Wp, NOISE['mid'][0], 500 + g) * NOISE['mid'][1]
             + vnoise(Hp, Wp, *(NOISE['big'][0],), 100 + g) * NOISE['big'][1]
             + vnoise(Hp, Wp, NOISE['small'][0], 200 + g) * NOISE['small'][1]
             + (hash2(*np.mgrid[0:Hp, 0:Wp][::-1], 300 + g) * 2 - 1) * NOISE['px']) * amp
        sc = sdf - OFF_K * PRI[g] + n
        up = sc > best
        best[up] = sc[up]
        lab[up] = g
    return lab


def _neighbors(lab, dy, dx):
    return np.roll(np.roll(lab, dy, 0), dx, 1)


def render_ground_v5(M):
    Hp, Wp = M.H * 16, M.W * 16
    img = np.zeros((Hp, Wp, 3), np.uint8)
    tile_lv = np.repeat(np.repeat(M.Hh, 16, 0), 16, 1)
    land_px = np.repeat(np.repeat(M.G >= 10, 16, 0), 16, 1)
    final = np.zeros((Hp, Wp), np.int16)
    for lv in sorted({int(v) for v in np.unique(M.Hh[M.G >= 10])}):
        lab = label_map(M, lv)
        if lab is None:
            continue
        sel = land_px & (tile_lv == lv)
        final[sel] = lab[sel]
    # 텍스처
    texf = {g: np.tile(TEX[g], (M.H, M.W, 1)) for g in np.unique(final) if g >= 10}
    for g, t in texf.items():
        m = final == g
        img[m] = t[m]
    # 테두리·튀김(원본 결): 높은 쪽 1px 안에 끊긴 어두운 선, 낮은 쪽 바깥에 드문 튀김
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    rimh = hash2(xs, ys, 4242)
    sph = hash2(xs, ys, 4343)
    out = img.astype(np.float32)
    # 이웃 4방향 중 낮은 우선순위가 하나라도 있으면 경계(높은 쪽)
    pri = np.zeros(max(PRI) + 40, np.int16)
    for g, p in PRI.items():
        pri[g] = p
    pp = pri[final]
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = _neighbors(final, dy, dx)
        nbv = _neighbors(land_px.astype(np.int16), dy, dx) > 0
        diff = (nb != final) & nbv & land_px & (pp > pri[nb]) & (nb >= 10) & (final >= 10)
        if not diff.any():
            continue
        pairs = {(int(a), int(b)) for a, b in set(zip(final[diff].tolist(), nb[diff].tolist()))}
        for a, b in pairs:
            P = pair(a, b)
            m = diff & (final == a) & (nb == b) & (rimh < P['cover'])
            out[m] = out[m] * (1 - P['strength']) + P['rim'] * P['strength']
    # 튀김: 낮은 쪽 픽셀 중 높은 쪽과 2px 이내인 것 일부를 높은 쪽 중간색으로
    for g in np.unique(final):
        if g < 10:
            continue
        lowm = final == g
        hi = (pri[final] > PRI[g]) & land_px & (final >= 10)
        if not hi.any():
            continue
        dist = ndi.distance_transform_edt(~hi)
        near = lowm & (dist <= 2.3) & (dist > 1.0)
        for a in np.unique(final[ndi.binary_dilation(lowm, iterations=3) & hi]):
            if a < 10 or PRI[a] <= PRI[g]:
                continue
            P = pair(int(a), int(g))
            m = near & (sph < P['spray'] * .8)
            m &= ndi.binary_dilation(final == a, iterations=3)
            out[m] = out[m] * .4 + mid_col(int(a)) * .6
    img = np.clip(out, 0, 255).astype(np.uint8)
    # 고원 윗면 밝기(4단계 _lit), 고원 가장자리 타일은 4단계 경로
    lit = V._lit(img)
    img = np.where(tile_lv[..., None] > 0, lit, img)
    for y in range(M.H):
        for x in range(M.W):
            if M.G[y, x] < 10 or M.Hh[y, x] == 0:
                continue
            if _plateau_edge(M, x, y):
                for qx, qy, sx, sy in V._q_iter():
                    px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                    img[py0:py0 + 8, px0:px0 + 8] = V.ground_quadrant(M, x, y, qx, qy, sx, sy)
    return img


def _plateau_edge(M, x, y):
    for qx, qy, sx, sy in V._q_iter():
        nbs = ((x, y + sy), (x + sx, y), (x + sx, y + sy))
        v, h, d = (V._pconn(M, x, y, a, b, sy == 1 and a == x) for (a, b) in nbs)
        if sy == 1 and v:
            d = h
        if not (v and h and d):
            return True
    return False


# ─── 바다 수심: 그라데이션 대신 3단 + 디더 경계 ───
def render_depth_v5(M, img):
    d = V.sea_dist(M)
    d = np.where(M.G == V.SEA, d, 0)
    d = ndi.gaussian_filter(d, 0.5)
    Hp, Wp = M.H * 16, M.W * 16
    big = ndi.zoom(np.pad(d, 1, mode='edge'), 16, order=1)[16 - 8:16 - 8 + Hp, 16 - 8:16 - 8 + Wp]
    f = big + vnoise(Hp, Wp, 10.0, 501) * .55 + vnoise(Hp, Wp, 4.0, 502) * .25
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    chk = ((xs + ys) & 1).astype(np.float32)                 # 2x2 체크 디더(한 줄 폭)
    seamask = np.repeat(np.repeat(M.G == V.SEA, 16, 0), 16, 1)
    palm = np.zeros(seamask.shape, bool)
    for c in V.WPAL:
        palm |= np.all(img == c, axis=2)
    palm &= seamask
    T1, T2, BAND = 2.3, 6.2, .42

    def step(th):
        # f 가 th 를 넘으면 1. 경계 ±BAND 안에서는 체크 디더, 그 밖은 단호하게.
        hard = f > th
        band = np.abs(f - th) < BAND
        dith = np.where(f > th, chk > .5, chk < .5)
        return np.where(band, dith, hard)
    s1, s2 = step(T1), step(T2)
    shallow = palm & ~s1
    deep = palm & s2
    teal = np.array([100, 210, 214], np.float32)
    img[shallow] = (img[shallow] * .6 + teal * .4).astype(np.uint8)
    img[deep] = (img[deep].astype(np.float32) * np.array([.64, .68, .84])).astype(np.uint8)
    # 산호초(4단계와 같음)
    from terrain_lib import rnd
    for y in range(M.H):
        for x in range(M.W):
            if M.G[y, x] != V.SEA or not (1 <= d[y, x] <= 2.2) or rnd(x, y, 909) < .86:
                continue
            for i in range(5):
                cx = x * 16 + 2 + int(rnd(x, y, 910 + i) * 12)
                cy = y * 16 + 2 + int(rnd(x, y, 920 + i) * 12)
                for dx, dy, c in ((0, 0, (46, 143, 143)), (1, 0, (46, 143, 143)), (0, 1, (70, 168, 160)), (1, 1, (46, 143, 143)), (-1, 0, (196, 240, 236))):
                    if seamask[cy + dy, cx + dx] and palm[cy + dy, cx + dx]:
                        img[cy + dy, cx + dx] = c
    return img
