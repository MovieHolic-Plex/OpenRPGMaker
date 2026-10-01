"""7단계 절벽: 칸 단위 타일 대신 '픽셀 단위 윤곽'으로 고원 윗면·벽·협곡을 다시 그린다.

원본 EasyRPG 월드 칩셋을 8배로 재어 본 문법(손으로 옮긴 것, 복제 아님):
  - 평판(풀·흙·눈)은 모서리가 둥글고 1~2px 짜리 짙은 갈색 테두리가 톱니처럼 둘린다.
  - 산줄기 띠의 암벽은 V자(쉐브론) 결 · 밝은/어두운 띠 교대 · 가운데가 제일 어둡다.
  - 윗가장자리는 들쭉날쭉한 짙은 입술, 밑은 부스러기로 들쭉날쭉하다.
계단식 직각을 없애는 방법: 칸 마스크를 16배 키워 가우시안으로 뭉갠 뒤 0.5 에서 자르고
값 노이즈로 ±1px 흔든다 → 바깥 모서리는 둥글어지고 안쪽 모서리는 채워지며 한 칸씩 어긋난 경계는 사선이 된다.
"""
import numpy as np
import scipy.ndimage as ndi
import terrain_v4 as V
from boundary_v5 import vnoise, hash2

ROCKS = ['brown', 'grey', 'red', 'dark', 'ice']
TAB = np.stack([np.stack(V.ROCK[k]) for k in ROCKS]).astype(np.float32)   # (5 바위, 5 명암, 3)
SIG_TOP, SIG_FACE = 4.5, 4.0


def _up(a):
    return np.repeat(np.repeat(a, 16, 0), 16, 1)


def _blur(m, sigma, salt, amp=0.055):
    f = ndi.gaussian_filter(m.astype(np.float32), sigma, mode='nearest')
    h, w = m.shape
    f += vnoise(h, w, 5.0, salt) * amp + vnoise(h, w, 2.3, salt + 1) * amp * 0.7
    return f > 0.5


def _rows_since(mask, from_top=True):
    """mask 가 False 인 마지막 줄로부터 몇 줄 떨어졌나(mask 안에서 첫 줄=1)."""
    h = mask.shape[0]
    ar = np.arange(h)[:, None]
    if from_top:
        last = np.maximum.accumulate(np.where(~mask, ar, -1), axis=0)
        return np.where(mask, ar - last, 0)
    nxt = np.minimum.accumulate(np.where(~mask, ar, h + 9)[::-1], axis=0)[::-1]
    return np.where(mask, nxt - ar, 0)


def _cols_since(mask, from_left=True):
    return _rows_since(mask.T, from_left).T


def _nearest_fill(img, dst, good):
    """dst 칸을 good 중 가장 가까운 픽셀 색으로 채운다."""
    if not dst.any() or not good.any():
        return
    _, (iy, ix) = ndi.distance_transform_edt(~good, return_indices=True)
    img[dst] = img[iy[dst], ix[dst]]


def _blend(img, m, col, a):
    img[m] = (img[m].astype(np.float32) * (1 - a) + np.asarray(col, np.float32) * a).astype(np.uint8)


def _rock_map(M, cellmask):
    """cellmask 칸들의 바위 종류를 픽셀 격자로 번져 채운 (Hp,Wp) 정수 지도."""
    H, W = M.H, M.W
    ridx = np.zeros((H, W), np.int32)
    for (x, y), (j, n, rock) in M.face.items():
        ridx[y, x] = ROCKS.index(rock)
    px = _up(cellmask)
    if not px.any():
        return np.zeros(px.shape, np.int32)
    big = _up(ridx)
    _, (iy, ix) = ndi.distance_transform_edt(~px, return_indices=True)
    return big[iy, ix]


def _strata(P, xa, d0, salt):
    """암벽 결: V자 쉐브론 띠. P=(Hp,Wp,5,3) 팔레트. 반환 (Hp,Wp,3) float."""
    chev = np.abs((xa + (salt * 5) % 14) % 14 - 7) * 0.62 + 1.3 * np.sin(xa * 0.23 + salt)
    ph = d0 - 3.0 + chev
    k = np.floor(ph / 4.6)
    pos = ph - k * 4.6
    even = (k.astype(np.int64) % 2) == 0
    idx = np.where(pos < 1.0, 1, np.where(pos < 2.5, np.where(even, 3, 4), np.where(even, 2, 3)))
    return idx


def _pal(P, idx):
    return np.take_along_axis(P, idx[..., None, None], axis=2)[:, :, 0, :]


def _plateau_level(M, img, lv, hp, wp, keep):
    tm_c = _up((M.Hh >= lv) & (M.G >= 10))
    if not tm_c.any():
        return
    sea_px = _up(M.G < 10)
    tm = _blur(tm_c, SIG_TOP, 700 + lv) & ~sea_px

    fc = np.zeros((M.H, M.W), bool)
    ext = np.zeros((M.H, M.W), bool)
    for (x, y), (j, n, rock) in M.face.items():
        if M.Hh[y, x] == lv - 1:
            fc[y, x] = True
            ext[y, x] = True
            if j == 0 and y > 0:
                ext[y - 1, x] = True
    fm = _blur(_up(ext), SIG_FACE, 710 + lv) & ~sea_px
    face = fm & ~tm
    if fc.any():
        rk = _rock_map(M, fc)
    else:
        rk = np.zeros((hp, wp), np.int32)
    P = TAB[rk]                                                       # (Hp,Wp,5,3)

    # 1) 경계 띠를 가까운 안쪽/바깥 색으로 다시 채워 옛 칸 경계선을 지운다
    din = ndi.distance_transform_edt(tm)
    dout = ndi.distance_transform_edt(~tm)
    rep_in = tm & ((din <= 4) | ~tm_c)
    rep_out = ~tm & ((dout <= 10) | tm_c) & ~face & ~keep
    _nearest_fill(img, rep_in, tm & tm_c & (din > 4))
    img[rep_out] = M._clean[rep_out]

    # 2) 테두리: 바깥 1px 짙은 선, 안쪽 1~2px 눌린 풀
    xa = np.arange(wp)[None, :] + np.zeros((hp, 1), np.int64)
    ya = np.arange(hp)[:, None] + np.zeros((1, wp), np.int64)
    hsh = hash2(xa, ya, 31 + lv)
    ring_out = ~tm & (dout <= 1.0) & ~face
    img[ring_out] = P[ring_out][:, 0, :].astype(np.uint8)
    ring1 = tm & (din <= 1.0) & ~(face & False)
    _blend(img, ring1 & (hsh < 0.8), P[..., 1, :][ring1 & (hsh < 0.8)], 0.62)
    ring2 = tm & (din > 1.0) & (din <= 2.0) & (hsh < 0.4)
    _blend(img, ring2, P[..., 1, :][ring2], 0.30)

    # 3) 벽
    if not face.any():
        return
    Hd = _rows_since(face, True)            # 1부터
    Hu = _rows_since(face, False)           # 1부터(맨 아랫줄=1)
    d0 = (Hd - 1).astype(np.float32)
    idx = _strata(P, xa.astype(np.float32), d0, 7)
    col = _pal(P, idx).astype(np.float32)
    salt_ = hash2(xa, ya, 91)
    col = np.where((salt_ < 0.035)[..., None], P[..., 1, :], col)
    col = np.where((salt_ > 0.97)[..., None], P[..., 4, :], col)
    # 세로 금
    vcrack = (hash2(xa, np.zeros_like(xa), 55) < 0.075) & (d0 > 3) & (((d0 + hash2(xa, xa * 0, 57) * 5) % 9) < 5)
    col = np.where(vcrack[..., None], P[..., 1, :], col)
    # 윗입술: 0=짙은 선, 1=밝은 흙, 2=중간, 3=그늘 홈
    lip = {0: 0, 1: 4, 2: 3}
    for d, pi in lip.items():
        m = face & (d0 == d)
        if d == 1:
            m &= hsh < 0.8
        col[m] = P[m][:, pi, :]
    groove = face & (d0 == 3)
    col[groove] = P[groove][:, 1, :]
    # 원통 음영: 왼쪽 밝게, 오른쪽 어둡게
    dl = _cols_since(face, True)
    dr = _cols_since(face, False)
    lit_l = face & (dl >= 2) & (dl <= 3)
    col[lit_l] = np.minimum(col[lit_l] * 1.12 + 6, 255)
    dk_r = face & (dr >= 2) & (dr <= 4)
    col[dk_r] = col[dk_r] * 0.84
    # 밑: 짙은 선 + 눌린 부스러기
    u0 = (Hu - 1)
    b2 = face & (u0 == 1)
    col[b2] = P[b2][:, 1, :]
    b3 = face & (u0 == 2) & (hsh < 0.55)
    col[b3] = col[b3] * 0.7
    # 윤곽선(좌우·아래), 위는 고원 테두리가 맡는다
    solid = face | tm
    nb = np.zeros_like(face)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(np.roll(solid, dy, 0), dx, 1)
        nb |= ~sh
    outline = face & nb & (d0 > 0)
    col[outline] = P[outline][:, 0, :]
    img[face] = np.clip(col[face], 0, 255).astype(np.uint8)
    # 안쪽 한 줄 더: 왼쪽 윤곽 바로 안은 밝게(테 두른 돌 모서리)
    # 4) 바닥 그림자(빛은 왼쪽 위 → 그림자는 오른쪽 아래)
    sh_src = np.roll(face, 2, 1)
    under = _rows_since(~sh_src & ~face & ~tm, True)   # 그림자 대상 칸 안에서 face 로부터의 거리
    cand = ~face & ~tm & ~sea_px
    dist = _rows_since(~sh_src, True)                   # sh_src 가 True 인 곳 바로 아래부터 1,2,3...
    shm = cand & (~sh_src) & (dist >= 1) & (dist <= 5) & (_ground_below(sh_src, 5))
    k = np.clip(1 - 0.26 * (1 - (dist - 1) / 5.0), 0.7, 1.0)
    img[shm] = (img[shm].astype(np.float32) * np.array([1, 0.97, 1.03]) * k[shm][:, None]).clip(0, 255).astype(np.uint8)


def _ground_below(src, n):
    """src 바로 아래 n 줄 안에 src 가 있는 픽셀."""
    out = np.zeros_like(src)
    acc = src.copy()
    for _ in range(n):
        acc = np.roll(acc, 1, 0)
        acc[0] = False
        out |= acc
    return out


def _chasm(M, img, hp, wp):
    gc = (M.G == V.CHASM)
    if not gc.any():
        return
    near = ndi.binary_dilation(_up(gc), iterations=10)
    dark = (img.astype(np.int32).sum(axis=2) < 170) & near
    cs_c = ndi.binary_closing(dark, iterations=3) | _up(gc)
    sea_px = _up(M.G < 10)
    f = ndi.gaussian_filter(cs_c.astype(np.float32), 2.6, mode='nearest')
    f += vnoise(hp // 16, wp // 16, 5.0, 760).repeat(16, 0).repeat(16, 1) * 0.05
    cs = (f > 0.5) & ~sea_px
    din = ndi.distance_transform_edt(cs)
    dout = ndi.distance_transform_edt(~cs)
    rep_in = cs & ((din <= 3) | ~cs_c)
    rep_out = ~cs & ((dout <= 10) | cs_c)
    _nearest_fill(img, rep_in, cs & cs_c & (din > 3))
    img[rep_out] = M._clean[rep_out]
    xa = np.arange(wp)[None, :] + np.zeros((hp, 1), np.int64)
    ya = np.arange(hp)[:, None] + np.zeros((1, wp), np.int64)
    hsh = hash2(xa, ya, 77)
    # 북쪽 벽: 구멍 안에서 위에서 14px 이내 = 바위 벽
    dup = _rows_since(cs, True)
    wall_d = 15
    wall = cs & (dup <= wall_d)
    rk = np.full((hp, wp), ROCKS.index('red'), np.int32)
    P = TAB[rk]
    d0 = (dup - 1).astype(np.float32)
    idx = _strata(P, xa.astype(np.float32), d0, 13)
    col = _pal(P, idx).astype(np.float32)
    col = np.where((hsh < 0.04)[..., None], P[..., 1, :], col)
    col = np.where((hsh > 0.97)[..., None], P[..., 4, :], col)
    top = wall & (d0 <= 1)
    col[top] = P[top][:, 0, :]
    lipm = wall & (d0 == 2)
    col[lipm] = P[lipm][:, 4, :]
    # 벽 밑으로 갈수록 어두워진다
    fade = np.clip(1 - (d0 - 3) / 14.0 * 0.55, 0.45, 1.0)
    col = col * np.where(d0 > 3, fade, 1.0)[..., None]
    img[wall] = np.clip(col[wall], 0, 255).astype(np.uint8)
    inner = cs & ~wall
    base = np.array([24, 17, 30], np.float32)
    nz = vnoise(hp // 16, wp // 16, 3.0, 790).repeat(16, 0).repeat(16, 1)
    cold = base + nz[..., None] * 5 + np.array([0, 0, 4]) * (hsh[..., None] > 0.9)
    cold = np.where((hsh > 0.93)[..., None], np.array([40, 30, 54]), cold)
    cold = np.where((hsh < 0.04)[..., None], np.array([14, 10, 20]), cold)
    img[inner] = np.clip(cold[inner], 0, 255).astype(np.uint8)
    # 벽 밑 그림자(구멍 바닥이 어둡게 이어짐)
    below = cs & ~wall & (dup <= wall_d + 6)
    _blend(img, below, (12, 8, 14), 0.42 * np.clip(1 - (dup[below] - wall_d) / 7.0, 0, 1).mean())
    # 바깥 테두리와 입술
    ring_out = ~cs & (dout <= 1.0)
    img[ring_out] = TAB[ROCKS.index('red')][0].astype(np.uint8)
    lip_out = ~cs & (dout > 1.0) & (dout <= 2.6) & (hsh < 0.65)
    _blend(img, lip_out, TAB[ROCKS.index('red')][1], 0.42)
    ring_in = cs & ~wall & (din <= 1.2)
    img[ring_in] = TAB[ROCKS.index('dark')][0].astype(np.uint8)
    # 북쪽 이외의 둘레: 벽 없이 바로 어두운 구멍, 가장자리에 부스러기
    crumb = ~cs & (dout > 2.6) & (dout <= 4.2) & (hsh < 0.12)
    img[crumb] = TAB[ROCKS.index('red')][1].astype(np.uint8)


def render_faces_v7(M, img):
    hp, wp = M.H * 16, M.W * 16
    keep = ndi.binary_dilation(_up(M.G == V.CHASM), iterations=12)
    for lv in (1, 2):
        _plateau_level(M, img, lv, hp, wp, keep)
    _chasm(M, img, hp, wp)
    return img


def _clean_map(M):
    import copy
    M2 = copy.copy(M)
    M2.Hh = np.zeros_like(M.Hh)
    G = M.G.copy()
    ch = (G == V.CHASM)
    if ch.any():
        _, (iy, ix) = ndi.distance_transform_edt(ch, return_indices=True)
        G = G[iy, ix]
    M2.G = G
    return M2


def install(M4):
    o_ground = M4.render_ground

    def rg(M):
        g = o_ground(M)
        M._clean = o_ground(_clean_map(M))
        return g
    M4.render_ground = rg
    M4.render_faces = render_faces_v7
