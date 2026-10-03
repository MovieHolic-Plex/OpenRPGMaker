"""월드맵 바닥 경계 v9 — 쌍 종류별 전이(2026-10-03, 사용자 지적 「다른 타일의 경계면이 어색한 경우가 너무 많다」).

v5 의 결함(실측 크롭):
  · 모든 쌍에 어두운 점선 테두리를 우선순위가 높은 쪽에 쳤다. 우선순위는 광물(모래·흙·협곡토)이 풀보다 높아서,
    평지 풀↔툰드라·풀↔황무지 경계가 고원 절벽처럼 어둡게 그어졌다.
  · σ=2.4px 로만 둥글려 16px 칸 계단이 그대로 남았다(직선·직각 경계).
  · 바닥마다 16px 타일 하나를 반복 — 넓은 툰드라·사바나에서 격자 무늬가 보였다.

v9:
  1. 라벨: 칸 지시 마스크를 σ≈5.5px 로 흐린 장 + 바닥마다 다른 다층 노이즈의 argmax. 칸 계단이 사라지고 둥근 덩이로 출렁인다.
     한 칸짜리 바닥은 칸 가운데 원으로 남긴다(장소 발자국 밑 바닥이 사라지지 않게).
  2. 전이(경계에서 떨어진 거리 d 픽셀, 상대 바닥 b):
       식생↔식생 · 광물↔광물 : 테두리 없이 덩이 디더(두 질감의 픽셀만 섞는다 — 새 색 없음)
       식생 → 광물 쪽       : 풀 술(식생 질감 덩이)이 광물 위로 번진다. 식생 쪽 끝 1px 에 성긴 어두운 잎 끝
       눈·빙하              : 눈 쪽 끝에 푸른 그늘 1px(성긴), 상대 쪽에 흰 눈가루
       밭                   : 곧은 경계 + 밭 쪽 고랑색 울타리(사람이 만든 땅)
       분화구·균열 협곡      : v5 테두리 그대로(구덩이는 테두리가 맞다)
  3. 질감: 칸마다 좌우(무늬에 방향이 없으면 상하도) 뒤집기 + 거시 명암(같은 질감의 명도 단을 한 단 올리고 내림, 디더 경계).
     색은 전부 그 바닥 질감의 색 — 팔레트 색 표(kit_palette.build_roles)가 새 색을 만나지 않는다.
고원 윗면 밝기·고원 가장자리 사분면 경로는 v5 그대로.
"""
import numpy as np
import scipy.ndimage as ndi
import terrain_v4 as V
from terrain_v4 import (PRI, TEX, GRASS, FARM, CROP, SAVANNA, SAND, DUNE, DIRT, BADLANDS, ASH, BASALT, SWAMP, MARSH,
                        TUNDRA, SNOW, GLACIER, JUNGLE, CHASM, CRATER, _lum)
from boundary_v5 import hash2, vnoise, pair, _plateau_edge, _ground_fill


VEG = {GRASS, JUNGLE, SAVANNA, TUNDRA, SWAMP, MARSH}
FIELD = {FARM, CROP}
MIN = {SAND, DUNE, DIRT, BADLANDS, ASH, BASALT}
ICE = {SNOW, GLACIER}
HOLE = {CHASM, CRATER}
BIGPAT = {MARSH, DIRT, BADLANDS}                                            # 무늬가 커서 뒤집으면 거울 이음매가 보인다
DIRECTIONAL = {SAND, DUNE, SNOW, GLACIER, FARM, CROP}      # 무늬에 위아래가 있다(물결·고랑) — 상하 뒤집기 금지

SIGMA = 7.0
NOISE = ((30.0, .30), (13.0, .15), (5.0, .06))             # (파장 px, 진폭) — 흐린 지시 장(0~1) 단위
FIELD_SIGMA, FIELD_AMP = 1.6, .25                           # 밭은 곧게
NEAR_MIN = .06
WARP = (60.0, 6.5, 22.0, 2.0)                               # (파장, 진폭 px) 두 단 — 라벨 장을 통째로 휜다


def _ramp(g):
    cols = sorted({tuple(int(v) for v in c) for c in TEX[g].reshape(-1, 3)}, key=_lum)
    return np.array(cols, np.uint8)


def _index_of(tex, ramp):
    idx = np.zeros(tex.shape[:2], np.int8)
    for i, c in enumerate(ramp):
        idx[np.all(tex == c, axis=2)] = i
    return idx


def _cell_up(a):
    return np.repeat(np.repeat(a, 16, 0), 16, 1)


def label_map(M, lv):
    Gf, ok = _ground_fill(M, lv)
    if Gf is None:
        return None
    Hp, Wp = M.H * 16, M.W * 16
    types = [int(g) for g in np.unique(Gf[ok])]
    best = np.full((Hp, Wp), -1e9, np.float32)
    lab = np.zeros((Hp, Wp), np.int16)
    for g in types:
        m = _cell_up(Gf == g).astype(np.float32)
        field = g in FIELD
        f = ndi.gaussian_filter(m, FIELD_SIGMA if field else SIGMA)
        n = sum(vnoise(Hp, Wp, wl, 900 + 37 * g + k) * a for k, (wl, a) in enumerate(NOISE))
        sc = f + n * (FIELD_AMP if field else 1.0) + (.08 if field else 0)
        sc[f < NEAR_MIN] = -1e9                                   # 근처(칸 둘레)에 없는 바닥은 노이즈로도 못 이긴다 — 엉뚱한 바닥 덩이 금지
        up = sc > best
        best[up] = sc[up]
        lab[up] = g
    # 큰 결 왜곡: 칸 줄을 따라 길게 곧은 경계(생성 지형의 직선 해안·띠)를 ±8px 로 휜다
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    wx = vnoise(Hp, Wp, WARP[0], 971) * WARP[1] + vnoise(Hp, Wp, WARP[2], 973) * WARP[3]
    wy = vnoise(Hp, Wp, WARP[0], 972) * WARP[1] + vnoise(Hp, Wp, WARP[2], 974) * WARP[3]
    sy = np.clip(np.rint(ys + wy), 0, Hp - 1).astype(np.int64)
    sx = np.clip(np.rint(xs + wx), 0, Wp - 1).astype(np.int64)
    lab = lab[sy, sx]
    # 노이즈가 만든 부스러기(먼 바닥의 몇 픽셀 섬)는 가장 가까운 큰 덩이 바닥으로
    junk = np.zeros((Hp, Wp), bool)
    for g in types:
        cc, n = ndi.label(lab == g)
        if n:
            sz = np.bincount(cc.ravel())
            small = sz < 40
            small[0] = False
            junk |= small[cc]
    if junk.any():
        idx = ndi.distance_transform_edt(junk, return_distances=False, return_indices=True)
        lab = lab[idx[0], idx[1]]
    # 한 칸짜리(또는 깎여 거의 사라진) 바닥은 칸 가운데 원으로 되살린다
    own = _cell_up(Gf)
    hit = (lab == own).reshape(M.H, 16, M.W, 16).mean((1, 3))
    yy, xx = np.mgrid[0:16, 0:16]
    disk = (yy - 7.5) ** 2 + (xx - 7.5) ** 2 <= 5.2 ** 2
    for y, x in zip(*np.nonzero(ok & (hit < .28))):
        blk = lab[y * 16:y * 16 + 16, x * 16:x * 16 + 16]
        blk[disk] = Gf[y, x]
    return lab


def _texture_layer(g, H, W, salt):
    """질감 g 를 지도 크기로 — 칸마다 뒤집기, 거시 명암 한 단."""
    t = TEX[g]
    flips = [t, t[:, ::-1]] if g in DIRECTIONAL else [t, t[:, ::-1], t[::-1], t[::-1, ::-1]]
    if g in FIELD or g in BIGPAT:
        flips = [t]
    pick = (hash2(*np.mgrid[0:H, 0:W][::-1], salt) * len(flips)).astype(np.int64)
    out = np.empty((H * 16, W * 16, 3), np.uint8)
    for i, f in enumerate(flips):
        m = _cell_up(pick == i)
        out[m] = np.tile(f, (H, W, 1))[m]
    if g in FIELD:
        return out
    ramp = _ramp(g)
    if len(ramp) < 3:
        return out
    idx = _index_of(out, ramp)
    Hp, Wp = H * 16, W * 16
    tone = vnoise(Hp, Wp, 64.0, salt + 1) * .7 + vnoise(Hp, Wp, 21.0, salt + 2) * .3
    grain = (vnoise(Hp, Wp, 2.2, salt + 3) + 1) / 2 * .6 + hash2(*np.mgrid[0:Hp, 0:Wp][::-1], salt + 4) * .4
    pd = np.clip((-tone - .25) / .35, 0, 1) * .55            # 어두운 덩이: 중간색 일부가 어두운 색으로
    pl = np.clip((tone - .30) / .35, 0, 1) * .45             # 밝은 덩이: 중간색 일부가 밝은 색으로
    mid = idx == len(ramp) // 2
    idx2 = idx.astype(np.int16)
    idx2[mid & (grain < pd)] -= 1
    idx2[mid & (grain < pl)] += 1
    idx2 = np.clip(idx2, 0, len(ramp) - 1)
    return ramp[idx2]


def _parent_nbs(M, x, y, sx, sy):
    out = []
    for a, b in ((x, y + sy), (x + sx, y), (x + sx, y + sy)):
        if M.inb(a, b) and M.G[b, a] >= 10 and M.Hh[b, a] < M.Hh[y, x]:
            out.append((a, b))
    return out


def _parent(M, x, y, sx, sy):
    from collections import Counter
    c = [int(M.G[b, a]) for a, b in _parent_nbs(M, x, y, sx, sy)]
    return Counter(c).most_common(1)[0][0] if c else int(M.G[y, x])


def _parent_level(M, x, y, sx, sy):
    c = [int(M.Hh[b, a]) for a, b in _parent_nbs(M, x, y, sx, sy)]
    return max(c) if c else 0


def _cls(g):
    if g in HOLE:
        return 'hole'
    if g == MARSH:
        return 'wet'
    if g in ICE:
        return 'ice'
    if g in FIELD:
        return 'field'
    if g in MIN:
        return 'min'
    return 'veg'


def render_ground_v9(M):
    Hp, Wp = M.H * 16, M.W * 16
    tile_lv = _cell_up(M.Hh)
    land_px = _cell_up(M.G >= 10)
    final = np.zeros((Hp, Wp), np.int16)
    for lv in sorted({int(v) for v in np.unique(M.Hh[M.G >= 10])}):
        lab = label_map(M, lv)
        if lab is None:
            continue
        sel = land_px & (tile_lv == lv)
        final[sel] = lab[sel]
    present = [int(g) for g in np.unique(final) if g >= 10]
    tex = {g: _texture_layer(g, M.H, M.W, 7000 + g * 13) for g in present}
    img = np.zeros((Hp, Wp, 3), np.uint8)
    for g in present:
        m = final == g
        img[m] = tex[g][m]
    # 가장 가까운 다른 바닥(같은 높이 단·땅 안)까지의 거리와 그 바닥
    lvkey = np.where(land_px, final.astype(np.int32) + 1000 * tile_lv, -1)
    near_d = np.full((Hp, Wp), 99.0, np.float32)
    near_g = np.zeros((Hp, Wp), np.int16)
    for g in present:
        for lv in np.unique(tile_lv[final == g]):
            src = lvkey == g + 1000 * lv
            if not src.any():
                continue
            d = ndi.distance_transform_edt(~src).astype(np.float32)
            upd = (d < near_d) & land_px & (tile_lv == lv) & (final != g)
            near_d[upd] = d[upd]
            near_g[upd] = g
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    hpx = hash2(xs, ys, 4545)
    clump = (vnoise(Hp, Wp, 3.4, 4646) + 1) / 2 * .82 + hpx * .18   # 3~4px 덩이 디더(외톨이 1px 점이 적게)
    out = img.copy()
    band = (near_d <= 4.5) & land_px & (final >= 10)
    by_pair = {}
    if band.any():
        a_arr, b_arr = final[band], near_g[band]
        for a, b in set(zip(a_arr.tolist(), b_arr.tolist())):
            if a >= 10 and b >= 10 and a != b:
                by_pair[(a, b)] = None
    # 번짐(눈가루·풀 술·디더)은 넓은 덩이에서만 — 길 밑 한 칸짜리 눈 띠가 길 옆에 흰 점을 뿌렸다(사용자 지적 2026-10-03)
    wide = {}

    def from_wide(b):
        if b not in wide:
            src = ndi.binary_opening(final == b, structure=np.ones((3, 3), bool), iterations=4)
            wide[b] = ndi.distance_transform_edt(~src).astype(np.float32) if src.any() else np.full((Hp, Wp), 99.0, np.float32)
        return wide[b]
    for (a, b) in by_pair:
        m = band & (final == a) & (near_g == b)
        if _cls(a) != 'hole' and _cls(a) != 'field' and _cls(a) != 'wet':
            m_spill = m & (from_wide(b) <= near_d + 1.5)
        else:
            m_spill = m
        d = near_d
        ca, cb = _cls(a), _cls(b)
        if 'hole' in (ca, cb):
            if ca == 'hole':                                       # 구덩이 쪽 끝 1px 에 v5 테두리
                P = pair(a, b) if PRI[a] >= PRI[b] else pair(b, a)
                e = m & (d <= 1.0) & (hpx < P['cover'])
                out[e] = (out[e] * (1 - P['strength']) + P['rim'] * P['strength']).astype(np.uint8)
            continue
        if ca == 'wet' or cb == 'wet':                             # 독 늪: 섞지 않고 독 늪 쪽 끝에 어두운 테
            if ca == 'wet':
                e = m & (d <= 1.0) & (hpx < .7)
                out[e] = _ramp(a)[0]
            continue
        if ca == 'field' or cb == 'field':
            if ca == 'field' and cb != 'field':                    # 밭 가장자리 고랑색 울타리
                fur = _ramp(a)[0]
                e = m & (d <= 1.0) & (hpx < .78)
                out[e] = fur
            continue
        if ca == 'ice' or cb == 'ice':
            if ca == 'ice' and cb != 'ice':                        # 눈 쪽 끝 그늘
                sh = _ramp(a)[0]
                e = m & (d <= 1.0) & (hpx < .55)
                out[e] = sh
                e = m_spill & (d <= 3.0) & (d > 1.0) & (clump < .22 * (3.2 - d) / 2.2)
                out[e] = tex[b][e]
            elif cb == 'ice' and ca != 'ice':                      # 눈가루
                e = m_spill & (d <= 3.5) & (clump < .40 * (4.0 - d) / 3.0)
                out[e] = tex[b][e]
            else:                                                  # 설원↔빙하
                e = m_spill & (d <= 3.0) & (clump < .5 * (3.5 - d) / 2.5)
                out[e] = tex[b][e]
            continue
        if ca == cb:                                               # 식생↔식생, 광물↔광물: 덩이 디더
            e = m_spill & (d <= 3.5) & (clump < .5 * (4.0 - d) / 3.0)
            out[e] = tex[b][e]
        elif ca == 'min' and cb == 'veg':                          # 광물 위로 풀 술
            e = m_spill & (d <= 4.0) & (clump < .55 * (4.5 - d) / 3.5)
            out[e] = tex[b][e]
        else:                                                      # 식생 쪽 끝: 성긴 어두운 잎 끝 + 광물 알갱이 조금
            dk = _ramp(a)[0]
            e = m & (d <= 1.0) & (clump < .38)
            out[e] = dk
            e = m_spill & (d <= 2.5) & (d > 1.0) & (hpx < .10)
            out[e] = tex[b][e]
    img = out
    lit = V._lit(img)
    img = np.where(tile_lv[..., None] > 0, lit, img)
    for y in range(M.H):
        for x in range(M.W):
            if M.G[y, x] < 10 or M.Hh[y, x] == 0:
                continue
            if _plateau_edge(M, x, y):                             # 고원 가장자리: 4단계 사분면이 기본 질감과 다른 픽셀(테두리·면)만 옮긴다
                g = int(M.G[y, x])
                for qx, qy, sx, sy in V._q_iter():
                    px0, py0 = x * 16 + qx * 8, y * 16 + qy * 8
                    q = V.ground_quadrant(M, x, y, qx, qy, sx, sy)
                    ref = V._lit(TEX[g][qy * 8:qy * 8 + 8, qx * 8:qx * 8 + 8])
                    dif = np.any(q != ref, axis=2)
                    lo = _parent_level(M, x, y, sx, sy)
                    if lo > 0:                                     # 가장자리 아래로 보이는 낮은 땅도 고원이면 밝힌다(v5 는 어두운 사각형이 남았다)
                        par = np.all(q == V._tex_at(_parent(M, x, y, sx, sy), px0, py0), axis=2)
                        q = np.where(par[..., None], V._lit(q), q)
                    blk = img[py0:py0 + 8, px0:px0 + 8]
                    blk[dif] = q[dif]
    M._label_px = final                                            # 후처리(늪·사구·해안)가 같은 경계를 따르게
    return img
