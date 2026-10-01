"""8단계 절벽: 7단계의 둥근 윤곽은 두고, 벽 결·윗면·턱·밑·협곡·메사를 원본 절벽 문법으로 다시 그린다.

원본 EasyRPG World.png(CC BY 4.0) 절벽 칸(21,4~7)과 물결 절벽(18~20,0~1)을 8배로 재어 본 문법(색만 쓰고 픽셀은 베끼지 않음):
  - 벽 바탕은 291010/411e05 어두운 흙이 반쯤이고, 그 위에 8c5a21/a77b4b 밝은 돌 덩이가 박힌다.
    덩이는 폭 3~6, 높이 2~3, 윗줄 65442a·아랫줄 4f2e21 테를 두르고 줄마다 엇갈린다. 매끈한 띠·물결 줄무늬가 없다.
  - 윗가장자리: 풀 → 1d5728 짙은 풀 한 줄 → 291010/411e05 1~2줄 → 벽.
  - 평판 가장자리(옆·뒤): 1px 짙은 테가 톱니처럼 둘린다. 윗면 안쪽은 바닥 결이 그대로 이어진다.
7단계의 문제와 이번 처리:
  1) V자 물결 지층이 기계적으로 반복되고 좁은 벽에서 사다리처럼 보였다 → 해시 격자에 흩은 돌 덩이 결(주기·폭·높이가 칸마다 다름).
  2) 고원 윗면에 옛 칸 단위 색 덩이(네모난 옅은 영역)가 비쳤다 → 윗면·둘레를 '높이 없는 바닥' 렌더(M._clean)로 통째로 다시 깐다.
  3) 툰드라 고원 위·오른쪽 풀 테가 덩어리져 보였다 → 옛 칸 조각을 지우고 1px 짙은 테 + 들쭉날쭉한 그늘 한 줄로.
  4) 밑이 매끈했다 → 부스러기 돌(작은 덩이)과 오른쪽 아래로 끌리는 체크 그림자.
  5) 협곡 구덩이 바닥이 단색이었다 → 북벽 밑 돌무더기 · 좌우 안벽 · 벽에서 멀어질수록 옅어지는 디더 바닥 · 잔돌.
  6) 메사가 뾰족한 산 스프라이트였다 → 납작한 탁상(윗면 평판 + 앞 절벽면 + 오른쪽 아래 그림자), 여러 덩이로 나뉜 뷰트.
생성 이미지·트레이싱 없음.
"""
import numpy as np
import scipy.ndimage as ndi
import terrain_v4 as V
from boundary_v5 import vnoise, hash2
from cliff_v7 import (_up, _blur, _rows_since, _cols_since, _nearest_fill, _blend, _rock_map, _ground_below,
                      _clean_map, SIG_TOP, SIG_FACE)


def _hx(s):
    return [int(s[i:i + 2], 16) for i in (0, 2, 4)]


ROCKS = ['brown', 'grey', 'red', 'dark', 'ice']
# 7단(0 가장 어두움). brown 은 원본 절벽 칸 색 그대로, 나머지는 같은 명도 간격으로 색상만 옮긴 것.
RAMP7 = {
    'brown': ['291010', '411e05', '4f2e21', '65442a', '8c5a21', 'a77b4b', 'b48858'],
    'grey': ['211f28', '312d3a', '423d4e', '565063', '746e82', '948ea4', 'b0aabc'],
    'red': ['2a0e0c', '47160f', '5e2016', '7a2e1e', 'a4462a', 'c4643a', 'de7c50'],
    'dark': ['0c0a10', '18141e', '241e2a', '342a38', '4a3e4e', '605266', '786a7c'],
    'ice': ['1c3450', '284a6c', '386490', '4c7eaa', '6ea4cc', '96cce4', 'c8e8f4'],
}
TAB7 = np.array([[_hx(c) for c in RAMP7[k]] for k in ROCKS], np.float32)      # (5, 7, 3)
GRASS_DARK = np.array(_hx('1d5728'), np.float32)


# ── 돌 덩이 결 (벡터판) ─────────────────────────────────────────────────────────────────
def lump_index(hp, wp, lit, salt, px=7, py=5, dens=.80):
    """(hp,wp) 7단 색 번호. lit: 0~1(1=밝음). 줄마다 엇갈린 해시 격자에 덩이 하나씩."""
    ya = np.arange(hp)[:, None] + np.zeros((1, wp), np.int64)
    xa = np.arange(wp)[None, :] + np.zeros((hp, 1), np.int64)
    # 줄 높이가 줄마다 다르게: 세로 좌표를 느린 잡음으로 휘게 한 뒤 자른다(가로 줄이 곧게 이어지지 않게)
    yw = ya + (vnoise(hp, wp, 11.0, salt + 20) * 1.6).astype(np.int64)
    row = yw // py
    ly = yw - row * py
    off = (hash2(row, row * 0, salt) * px).astype(np.int64)
    xs = xa + off
    col = xs // px
    lx = xs - col * px
    present = hash2(col, row, salt + 1) < dens
    w = 2 + (hash2(col, row, salt + 2) * 4.4).astype(np.int64)            # 2..6
    w = np.minimum(w, px - 1)
    x0 = (hash2(col, row, salt + 3) * (px - w)).astype(np.int64)
    hh = np.where(hash2(col, row, salt + 4) < .55, 2, 3)
    hh = np.minimum(hh, py - 1)
    y0 = np.where(hh + 1 < py, (hash2(col, row, salt + 6) * (py - hh)).astype(np.int64), 0)
    # 바탕: 어두운 두 색 알갱이, 밝은 곳일수록 411e05(1) 쪽이 많다
    bg = np.where(hash2(xa, ya, salt + 5) < .35 + .35 * lit, 1, 0)
    idx = bg.copy()
    inx = (lx >= x0) & (lx < x0 + w)
    top = present & (ly == y0) & inx
    body = present & (ly > y0) & (ly < y0 + hh) & inx
    bot = present & (ly == y0 + hh) & (lx >= x0 - 1) & (lx < x0 + w)
    lft = present & (ly > y0) & (ly < y0 + hh) & (lx == x0 - 1)
    rgt = present & (ly > y0) & (ly < y0 + hh) & (lx == x0 + w)
    u = (lx - x0) / np.maximum(w - 1, 1)
    bk = np.where((u < .45) & (ly == y0 + 1) & (lit > .42), 5, 4)
    bk = np.where((u < .3) & (ly == y0 + 1) & (lit > .8), 6, bk)
    bk = np.where(lit < .28, bk - 1, bk)
    idx = np.where(top, np.where(lit > .2, 3, 2), idx)
    idx = np.where(body, bk, idx)
    idx = np.where(bot | rgt, 2, idx)
    idx = np.where(lft, 3, idx)
    # 아주 어두운 곳(밑 두세 줄)은 덩이를 한 단 더 누른다
    idx = np.where(lit < .12, np.minimum(idx, 2), idx)
    return idx


def _pal7(rk, idx):
    """rk (Hp,Wp) 바위 번호, idx (Hp,Wp) 0..6 → (Hp,Wp,3)."""
    return TAB7[rk, np.clip(idx, 0, 6)]


# ── 고원 한 층 ─────────────────────────────────────────────────────────────────────────
def _plateau_level(M, img, lv, hp, wp, keep, drawn):
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
    rk = _rock_map(M, fc) if fc.any() else np.zeros((hp, wp), np.int32)
    P = TAB7[rk]                                                            # (Hp,Wp,7,3)

    # 1) 윗면·둘레를 높이 없는 바닥 렌더로 통째로 다시 깐다(옛 칸 색 덩이·옛 절벽 조각 제거)
    zone_c = ndi.binary_dilation((M.Hh >= lv) & (M.G >= 10) | ext, iterations=2)
    zone = _up(zone_c) & ~sea_px & ~keep & ~drawn
    if lv == 1:
        img[zone & ~face] = M._clean[zone & ~face]
    else:                                   # 2층: 1층 윗면 위에 있으므로 윗면·가까운 둘레만
        z2 = zone & (tm | (ndi.distance_transform_edt(~tm) <= 12)) & ~face
        img[z2] = M._clean[z2]

    din = ndi.distance_transform_edt(tm)
    dout = ndi.distance_transform_edt(~tm)
    xa = np.arange(wp)[None, :] + np.zeros((hp, 1), np.int64)
    ya = np.arange(hp)[:, None] + np.zeros((1, wp), np.int64)
    hsh = hash2(xa, ya, 31 + lv)
    hs2 = hash2(xa // 2, ya // 2, 37 + lv)

    # 2) 둘레 테(얼굴 없는 옆·뒤 가장자리): 바깥 1px 짙은 선 + 안쪽 1px 짙은 풀/흙(톱니)
    near_face = ndi.binary_dilation(face, iterations=2)
    ramp = ndi.binary_dilation(_up(M.RAMP), iterations=3)
    ring_out = ~tm & (dout <= 1.0) & ~face & ~ramp
    img[ring_out] = P[ring_out][:, 0, :].astype(np.uint8)
    ring_out2 = ~tm & (dout > 1.0) & (dout <= 2.0) & ~face & (hs2 < .35) & ~ramp
    _blend(img, ring_out2, P[ring_out2][:, 1, :], .5)
    ring1 = tm & (din <= 1.0) & ~ramp
    _blend(img, ring1 & (hsh < .85), P[ring1 & (hsh < .85)][:, 1, :], .55)
    ring2 = tm & (din > 1.0) & (din <= 2.0) & (hs2 < .45) & ~ramp
    _blend(img, ring2, P[ring2][:, 2, :], .30)
    # 얼굴 위 윗면 끝: 짙은 풀 한 줄(원본 1d5728) + 드문드문 한 줄 더
    # 풀 윗면이면 원본의 1d5728, 흙·바위 윗면이면 그 바위의 짙은 색
    grassy = _up(np.isin(M.G, [V.GRASS, V.JUNGLE, V.FARM, V.CROP, V.SAVANNA, V.SWAMP, V.MARSH]))
    lipcol = np.where(grassy[..., None], GRASS_DARK[None, None, :], P[..., 1, :])
    lip = tm & near_face & (din <= 1.5) & ~ramp
    _blend(img, lip, lipcol[lip], .55)
    lip2 = tm & near_face & (din > 1.5) & (din <= 2.5) & (hs2 < .4) & ~ramp
    _blend(img, lip2, lipcol[lip2], .30)

    if not face.any():
        return
    # 3) 벽
    Hd = _rows_since(face, True)
    Hu = _rows_since(face, False)
    d0 = (Hd - 1).astype(np.float32)
    dl = _cols_since(face, True)
    dr = _cols_since(face, False)
    Hface = (Hd + Hu - 1).astype(np.float32)
    # 밝기: 위가 밝고 밑 두세 줄은 어둡다, 왼끝 밝고 오른끝 어둡다
    lit = .78 - .45 * np.clip(d0 / np.maximum(Hface - 1, 1), 0, 1) + .06 * vnoise(hp, wp, 9.0, 800 + lv)
    lit = np.where(dl <= 3, lit + .18, lit)
    lit = np.where(dr <= 4, lit - .22, lit)
    lit = np.where(Hu <= 2, .05, lit)
    lit = np.clip(lit, 0, 1)
    idx = lump_index(hp, wp, lit, 820 + lv * 7)
    # 세로 금: 드문드문, 길이 2~5
    vc = (hash2(xa, xa * 0, 55 + lv) < .05) & (d0 > 2) & (((d0 + hash2(xa, xa * 0, 57) * 7) % 8) < 3)
    idx = np.where(vc, 1, idx)
    # 윗입술: 0줄 짙은 선, 1줄 411e05(가끔 흙 턱 밝음)
    idx = np.where(d0 == 0, 0, idx)
    idx = np.where(d0 == 1, np.where(hsh < .18, 4, 1), idx)
    # 밑: 맨 아랫줄 윤곽, 그 위 한 줄 그늘
    idx = np.where(Hu == 1, 0, idx)
    idx = np.where(Hu == 2, np.minimum(idx, 1), idx)
    # 좌우 윤곽 + 왼끝 모서리 밝은 한 줄
    idx = np.where(dl == 1, 0, idx)
    idx = np.where(dr == 1, 0, idx)
    idx = np.where((dl == 2) & (d0 > 1) & (Hu > 2), np.maximum(idx, 3), idx)
    col = np.take_along_axis(P, np.clip(idx, 0, 6)[..., None, None], axis=2)[:, :, 0, :]
    img[face] = np.clip(col[face], 0, 255).astype(np.uint8)
    drawn |= face | ring_out | ring1

    # 4) 밑 부스러기 + 오른쪽 아래 그림자
    solid = face | tm
    ground = ~solid & ~sea_px
    below = _ground_below(face, 5) & ground
    dist = _rows_since(~face, True)                        # face 밑에서부터 1,2,3...
    sh_src = np.roll(face, 2, 1)
    shd = ground & ~near_face & _ground_below(sh_src, 4)
    shd = ground & _ground_below(sh_src, 4)
    chk = ((xa + ya) & 1) == 0
    dark = shd & (dist <= 2)
    img[dark] = (img[dark].astype(np.float32) * .72).astype(np.uint8)
    lite = shd & (dist > 2) & chk
    img[lite] = (img[lite].astype(np.float32) * .80).astype(np.uint8)
    # 부스러기: 밑에서 1~4줄 사이 작은 돌(윗줄 밝음 · 아랫줄 어두움)
    scree_seed = below & (hash2(xa // 3, ya // 2, 61 + lv) < .16) & (dist >= 1) & (dist <= 4)
    sx = scree_seed & (hash2(xa, ya, 63) < .55)
    img[sx] = P[sx][:, 4, :].astype(np.uint8)
    sd = np.roll(sx, 1, 0) & ground & ~sx
    img[sd] = P[sd][:, 1, :].astype(np.uint8)


# ── 협곡 구덩이 ─────────────────────────────────────────────────────────────────────────
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
    rep_out = ~cs & ((dout <= 10) | cs_c)
    img[rep_out] = M._clean[rep_out]
    xa = np.arange(wp)[None, :] + np.zeros((hp, 1), np.int64)
    ya = np.arange(hp)[:, None] + np.zeros((1, wp), np.int64)
    hsh = hash2(xa, ya, 77)
    R = ROCKS.index('red')
    P = TAB7[R]
    dup = _rows_since(cs, True)
    dl = _cols_since(cs, True)
    dr = _cols_since(cs, False)
    wall_d = 14
    # 북벽(앞을 향한 안벽): 돌 덩이 결, 아래로 갈수록 어둡다
    wall = cs & (dup <= wall_d)
    litw = np.clip(.85 - .8 * (dup - 1) / wall_d + .05 * vnoise(hp, wp, 7.0, 771), 0, 1)
    idx = lump_index(hp, wp, litw, 830)
    idx = np.where(dup == 1, 0, idx)
    idx = np.where(dup == 2, np.where(hsh < .25, 4, 1), idx)
    col = P[np.clip(idx, 0, 6)]
    img[wall] = col[wall].astype(np.uint8)
    # 좌우 안벽(2~3px): 서쪽 안벽은 동쪽을 봐서 어둡고, 동쪽 안벽은 빛(왼쪽 위)을 받아 밝다
    side_w = cs & ~wall & (dl <= 2)
    side_e = cs & ~wall & (dr <= 3)
    ide = np.where(dr == 1, 1, np.where(hsh < .4, 4, 3))
    idw = np.where(dl == 1, 0, np.where(hsh < .3, 2, 1))
    # 바닥: 북벽 밑이 가장 어둡고(그늘), 멀어질수록 한 단씩 밝아진다(체크 디더로 경계)
    floor = cs & ~wall & ~side_w & ~side_e
    FL = np.array([_hx(c) for c in ('140808', '200e0c', '2c1512', '3a1d18', '4a261e')], np.float32)
    dwall = ndi.distance_transform_edt(~wall)
    t = np.clip((dwall - 1) / 24.0, 0, 1) * 3.2 + .3 * vnoise(hp, wp, 6.0, 790)
    t = np.clip(t, 0, 3.99)
    lo = np.floor(t).astype(np.int64)
    chk = ((xa + ya) & 1) == 0
    fi = np.where((t - lo > .5) & chk, lo + 1, lo)
    fi = np.clip(fi, 0, 4)
    colf = FL[fi]
    img[floor] = colf[floor].astype(np.uint8)
    img[side_w] = P[idw][side_w].astype(np.uint8)
    img[side_e] = P[ide][side_e].astype(np.uint8)
    # 북벽 밑 돌무더기(벽에서 떨어진 돌): 밑줄 바로 아래 1~3줄
    base = cs & ~wall & (dwall <= 3) & ~side_w & ~side_e
    rub = base & (hash2(xa // 2, ya, 781) < .45)
    img[rub] = P[np.where(hash2(xa, ya, 783) < .5, 3, 2)][rub].astype(np.uint8)
    rubt = rub & ~np.roll(rub, 1, 0)
    img[rubt] = P[4][None, None, :].repeat(hp, 0).repeat(wp, 1)[rubt].astype(np.uint8)
    # 바닥 잔돌: 드문드문 2px 돌(윗줄 붉은 돌, 아랫줄 그늘)
    peb = floor & (dwall > 5) & (hash2(xa // 2, ya // 2, 785) < .07) & (hash2(xa, ya, 786) < .5)
    img[peb] = P[2]
    pb2 = np.roll(peb, 1, 0) & floor & ~peb
    img[pb2] = FL[0].astype(np.uint8)
    # 바깥 테와 입술(남쪽 가장자리는 땅 끝이 밝은 턱으로 보인다)
    ring_out = ~cs & (dout <= 1.0)
    img[ring_out] = P[0].astype(np.uint8)
    lip_out = ~cs & (dout > 1.0) & (dout <= 2.6) & (hsh < 0.6)
    _blend(img, lip_out, P[1], 0.42)
    # 남쪽 가장자리(구멍 위쪽이 땅): 땅 끝 한 줄 밝은 흙 턱
    south_lip = ~cs & (dout <= 2.0) & (dout > 1.0) & np.roll(cs, -2, 0)
    img[south_lip] = P[5].astype(np.uint8)
    crumb = ~cs & (dout > 2.6) & (dout <= 4.2) & (hsh < 0.12)
    img[crumb] = P[2].astype(np.uint8)


# ── 메사: 납작한 탁상 ─────────────────────────────────────────────────────────────────────
def draw_mesas(M, img, cells):
    """cells: 메사 칸 bool. 덩이를 여러 뷰트로 나눠 윗면 평판 + 앞 절벽면 + 오른쪽 아래 그림자로 그린다."""
    hp, wp = M.H * 16, M.W * 16
    if not cells.any():
        return img
    # 뷰트로 나누기: 해시로 칸 몇 개를 비워 덩이를 끊는다(가장자리 칸 우선)
    inner = ndi.binary_erosion(cells)
    ys, xs = np.nonzero(cells)
    cut = np.zeros_like(cells)
    for y, x in zip(ys, xs):
        h = hash2(np.array([x]), np.array([y]), 901)[0]
        if (not inner[y, x] and h < .55) or h < .40:
            cut[y, x] = True
    keepc = cells & ~cut
    lab, n = ndi.label(keepc)
    xa = np.arange(wp)[None, :] + np.zeros((hp, 1), np.int64)
    ya = np.arange(hp)[:, None] + np.zeros((1, wp), np.int64)
    R = ROCKS.index('red')
    P = TAB7[R]
    sea_px = _up(M.G < 10)
    bodies = []
    for k in range(1, n + 1):
        cm = lab == k
        foot = ndi.gaussian_filter(_up(cm).astype(np.float32), 4.0) + vnoise(hp, wp, 6.0, 910 + k) * .06 > .55
        foot &= ~sea_px
        if foot.sum() < 60:
            continue
        ncell = int(cm.sum())
        hgt = 7 + min(ncell, 6)                          # 벽 높이(px): 큰 뷰트가 더 높다
        ys_, xs_ = np.nonzero(foot)
        bodies.append((ys_.max(), foot, hgt, k))
    bodies.sort(key=lambda b: b[0])
    for _, foot, hgt, k in bodies:
        top = np.roll(foot, -hgt, 0)
        sweep = foot.copy()
        for d in range(1, hgt + 1):
            sweep |= np.roll(foot, -d, 0)
        face = sweep & ~top
        body = sweep
        # 그림자: 발자국을 오른쪽 아래로 민 곳
        sh = np.zeros_like(foot)
        for dx, dy in ((2, 1), (3, 2), (4, 2), (5, 3)):
            sh |= np.roll(np.roll(foot, dy, 0), dx, 1)
        sh &= ~body & ~sea_px
        chk = ((xa + ya) & 1) == 0
        dist_sh = ndi.distance_transform_edt(~foot)
        dsel = sh & (dist_sh <= 2.5)
        img[dsel] = (img[dsel].astype(np.float32) * .70).astype(np.uint8)
        lsel = sh & (dist_sh > 2.5) & chk
        img[lsel] = (img[lsel].astype(np.float32) * .78).astype(np.uint8)
        # 앞면
        Hd = _rows_since(face, True)
        Hu = _rows_since(face, False)
        dl = _cols_since(face, True)
        dr = _cols_since(face, False)
        d0 = (Hd - 1).astype(np.float32)
        lit = np.clip(.8 - .5 * d0 / hgt, 0, 1)
        lit = np.where(dl <= 3, lit + .15, lit)
        lit = np.where(dr <= 4, lit - .25, lit)
        lit = np.where(Hu <= 2, .05, lit)
        idx = lump_index(hp, wp, np.clip(lit, 0, 1), 940 + k, px=6, py=4, dens=.85)
        idx = np.where(Hu == 1, 0, idx)
        idx = np.where((dl == 1) | (dr == 1), 0, idx)
        idx = np.where(d0 == 0, 1, idx)                 # 윗모서리 아래 그늘 한 줄
        img[face] = P[np.clip(idx, 0, 6)][face].astype(np.uint8)
        # 윗면: 평평한 붉은 흙 판(4·5단 체크 섞기), 왼쪽 위 밝음, 테 1px
        din = ndi.distance_transform_edt(top)
        ys_, xs_ = np.nonzero(top)
        tx = (xa - xs_.min()) / max(xs_.max() - xs_.min(), 1)
        ty = (ya - ys_.min()) / max(ys_.max() - ys_.min(), 1)
        v = .95 - .55 * tx - .35 * ty + .35 * (hash2(xa, ya, 950 + k) - .5) + .25 * vnoise(hp, wp, 5.0, 955 + k)
        ti = np.where(v > .66, 6, np.where(v > .34, 5, np.where(v > .1, 4, 3)))
        ti = np.where((ti == 5) & (v > .56) & chk, 6, ti)
        ti = np.where((ti == 4) & (v > .26) & chk, 5, ti)
        # 윗면 잔금(짧은 가로 금): 판이 매끈하지 않게
        crk = (hash2(xa // 4, ya, 957 + k) < .05) & (hash2(xa, ya // 3, 958) < .6)
        ti = np.where(crk, 3, ti)
        ti = np.where(din <= 1, 0, ti)                                   # 둘레 테
        front_edge = top & ~np.roll(top, -1, 0)
        ti = np.where(front_edge & (din <= 1), 6, ti)                    # 앞 모서리는 빛 받는 턱
        ti = np.where((din > 1) & (din <= 2) & (hash2(xa, ya, 960) < .5), 3, ti)
        img[top] = P[np.clip(ti, 0, 6)][top].astype(np.uint8)
        # 앞 모서리 뒤로 한 줄 그늘(두께감)
        # 윗면 잔 풀 몇 점
        tuft = top & (din > 3) & (hash2(xa // 3, ya // 3, 970 + k) < .06) & (hash2(xa, ya, 971) < .4)
        img[tuft] = np.array(_hx('3c8f4b'), np.uint8)
    return img


def render_faces_v8(M, img):
    hp, wp = M.H * 16, M.W * 16
    keep = ndi.binary_dilation(_up(M.G == V.CHASM), iterations=12)
    drawn = np.zeros((hp, wp), bool)
    for lv in (1, 2):
        _plateau_level(M, img, lv, hp, wp, keep, drawn)
    _chasm(M, img, hp, wp)
    if hasattr(M, '_ground0'):
        # 해안 재성형(coast_v6)이 옛 바닥(고원 칸 조각 포함)으로 땅을 다시 칠하지 않도록 고친 바닥으로 바꿔 둔다
        M._ground0 = img.copy()
    return img


def install(M4):
    o_ground, o_objects = M4.render_ground, M4.render_objects

    def rg(M):
        g = o_ground(M)
        M._clean = o_ground(_clean_map(M))
        return g

    def ro(M, img):
        mesa = (M.O == V.MESA) & (M.G >= 10)
        saved = M.O.copy()
        M.O[mesa] = V.NONE
        try:
            o_objects(M, img)
        finally:
            M.O[:] = saved
        M._mesa_cells = mesa
        return draw_mesas(M, img, mesa)
    M4.render_ground = rg
    M4.render_faces = render_faces_v8
    M4.render_objects = ro
    # 흙 바닥 장식 '그루터기'가 네모 테(4x4 틀)로 보였다 → 3/4 그루터기(윗면 나이테 + 앞 껍질 + 밑 테)
    V.SPR4['stump'] = V._spr([".kkk.", "kllmk", "ktttk", ".kkk."], dict(k='2a2018', l='988660', m='7a6844', t='5a4830'))
