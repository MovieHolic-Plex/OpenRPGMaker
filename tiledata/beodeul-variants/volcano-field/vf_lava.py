# 화산 지대 용암 — 마왕성 df_lava.py(2026-10-07) 복사본. 같은 결(현무암 덩이 물가·밝은 띠·껍질 균열·거품)을 재사용하려고 이 폴더에 둔다: 현무암 돌 테두리 + 흐르는 용암 면(밝은 띠·껍질 판 균열·거품 점) + 둘레 열기.
# 한 규칙으로 두 가지를 그린다.
#   lava_sheet()  : 오토타일 16변형(4x4, N1+E2+S4+W8). 주기 16 잡음이라 칸끼리 이음새 없이 이어진다.
#   lava_layer()  : 지도용. 같은 규칙을 전역 좌표(주기 없음)로 그려 긴 해자에서도 칸 반복이 안 보인다.
import math
import numpy as np
from scipy import ndimage as ndi
from vf_base import OB, LAV

CRUST = [(30, 12, 16), (48, 18, 18), (68, 24, 18), (92, 36, 24)]      # 식은 껍질(검붉은 갈색)
HOTRIM = [(110, 34, 18), (150, 52, 22)]                                # 용암에 비친 바위 가장자리
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def _h(ix, iy, seed):
    ix = np.asarray(ix, np.int64); iy = np.asarray(iy, np.int64)
    h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    h = (h ^ (h >> 16)) & 0xffffff
    return h / float(0x1000000)


def _wrap(i, n):
    return i % n if n else i


def vn(X, Y, sx, sy, seed, per=None):
    """값 잡음 0..1. per(px) 를 주면 그 주기로 이어진다(sx, sy 는 per 의 약수)."""
    gx = X / sx; gy = Y / sy
    ix = np.floor(gx).astype(np.int64); iy = np.floor(gy).astype(np.int64)
    fx = gx - ix; fy = gy - iy
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    nx = per // sx if per else 0; ny = per // sy if per else 0
    a = _h(_wrap(ix, nx), _wrap(iy, ny), seed); b = _h(_wrap(ix + 1, nx), _wrap(iy, ny), seed)
    c = _h(_wrap(ix, nx), _wrap(iy + 1, ny), seed); d = _h(_wrap(ix + 1, nx), _wrap(iy + 1, ny), seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def voro(X, Y, sx, sy, seed, per=None):
    """보로노이: (가장 가까운 거리, 둘째 거리, 칸 번호, 씨앗 px x, 씨앗 px y). 격자 단위 거리."""
    gx = X / sx; gy = Y / sy
    ix = np.floor(gx).astype(np.int64); iy = np.floor(gy).astype(np.int64)
    nx = per // sx if per else 0; ny = per // sy if per else 0
    d1 = np.full(X.shape, 9.0); d2 = np.full(X.shape, 9.0); idv = np.zeros(X.shape, np.int64)
    sxp = np.zeros(X.shape); syp = np.zeros(X.shape)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx = ix + dx; cy = iy + dy
            wx = _wrap(cx, nx); wy = _wrap(cy, ny)
            px = cx + .15 + .7 * _h(wx, wy, seed); py = cy + .15 + .7 * _h(wx, wy, seed + 1)
            d = np.sqrt((gx - px) ** 2 + (gy - py) ** 2)
            nid = wx * 7919 + wy * 104729
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            d1 = np.where(closer, d, d1)
            idv = np.where(closer, nid, idv)
            sxp = np.where(closer, px * sx, sxp); syp = np.where(closer, py * sy, syp)
    return d1, d2, idv, sxp, syp


def paint(mask, X, Y, per=None, seed=61):
    """mask(px bool) 안을 용암으로 칠한다. X, Y = 같은 모양의 전역 픽셀 좌표. RGBA uint8 배열을 돌려준다."""
    Hp, Wp = mask.shape
    out = np.zeros((Hp, Wp, 4), np.uint8)
    hx = lambda s: _h(_wrap(X, per or 0), _wrap(Y, per or 0), s)
    d_in = ndi.distance_transform_edt(mask)
    # ---- 현무암 돌 테두리: 크기 5~9px 덩이가 물가를 따라 들쭉날쭉 박힌다(바깥 쪽도 둥글게 깎여 네모 윤곽이 안 남는다)
    lump = 8 if not per else 4
    r1, r2, rid, rsx, rsy = voro(X, Y, lump, lump, seed + 2, per)
    six = np.clip(np.round(rsx - X + np.arange(Wp)[None, :]).astype(int), 0, Wp - 1)
    siy = np.clip(np.round(rsy - Y + np.arange(Hp)[:, None]).astype(int), 0, Hp - 1)
    d_site = d_in[siy, six]
    # 물가선: 칸 경계에서 1~6px 안쪽으로 출렁인다(볼록 모서리는 거리장이라 둥글게 깎인다) -> 네모 윤곽이 안 남는다
    # 오토타일(per=16)은 칸 하나짜리 웅덩이에도 용암이 남도록 물가·바위 띠를 좁게 쓴다
    sa, band, rb, ra = (5.0, 3.2, 3.0, 6.0) if not per else (2.0, 3.0, 2.0, 2.5)
    shore = 1.0 + sa * vn(X, Y, 8, 8, seed + 14, per) ** 1.15
    shore_site = 1.0 + sa * vn(rsx, rsy, 8, 8, seed + 14, per) ** 1.15
    rw_site = rb + ra * vn(rsx, rsy, 16, 8, seed + 1, per) ** 1.3
    notch = mask & (d_in <= shore)
    # 바위: 물가선 바로 안쪽 띠(최소 2px)는 늘, 그 너머는 씨앗이 물가 가까운 덩이만 통째로 -> 덩이 크기가 제각각
    rock = mask & ~notch & ((d_in <= shore + band) | ((d_site > 0) & (d_site <= shore_site + rw_site)))
    lava = mask & ~rock & ~notch
    # 덩이 사이 홈으로 용암이 땅에 바로 닿는 곳은 바위로 메운다
    bare = lava & ndi.binary_dilation(notch)
    rock |= bare; lava &= ~bare
    rpx = r1 * lump
    # ---- 바위 음영(빛 왼쪽 위): 덩이 안 위·왼쪽 밝고 아래·오른쪽 어둡다, 덩이 사이는 틈
    rv = _h(rid, rid * 3 + 1, seed + 5)
    base = np.where(rv < .35, 2, np.where(rv < .8, 3, 2))
    same = lambda dy, dx: np.roll(np.roll(rid, dy, 0), dx, 1) == rid
    solid = rock | lava
    top = ~same(1, 0) | ~np.roll(rock, 1, 0)
    left = ~same(0, 1) | ~np.roll(rock, 1, 1)
    bot = ~same(-1, 0) | ~np.roll(rock, -1, 0)
    right = ~same(0, -1) | ~np.roll(rock, -1, 1)
    k = base.copy()
    k = np.where(rpx < 2.2, k + 1, k)                            # 덩이 가운데 볼록
    k = np.where(top, k + 2, k); k = np.where(left & ~top, k + 1, k)
    k = np.where(right & ~top, k - 1, k); k = np.where(bot, 1, k)
    k = np.where(hx(seed + 6) < .06, k + 1, k)
    k = np.clip(k, 1, 5)
    crack = (r2 - r1) < .14
    k = np.where(crack & ~top, 0, k)
    col = np.array(OB)[k]
    # 바깥(땅) 쪽 윤곽
    outside = ~solid
    edge = rock & (np.roll(outside, -1, 0) | np.roll(outside, 1, 0) | np.roll(outside, -1, 1) | np.roll(outside, 1, 1))
    col = np.where(edge[..., None], np.array(OB[0]), col)
    # 용암에 닿은 바위 가장자리는 붉게 비친다(아래쪽 용암이면 앞면이 더 밝게)
    lv_s = np.roll(lava, -1, 0); lv_n = np.roll(lava, 1, 0); lv_e = np.roll(lava, -1, 1); lv_w = np.roll(lava, 1, 1)
    near_lava = rock & (lv_s | lv_n | lv_e | lv_w) & ~edge
    col = np.where((near_lava & lv_s)[..., None], np.array(HOTRIM[1]), col)
    col = np.where((near_lava & ~lv_s)[..., None], np.array(HOTRIM[0]), col)
    # ---- 용암 면
    flow = vn(X, Y, 16 if not per else 8, 4, seed + 3, per) * .62 + vn(X, Y, 8, 8, seed + 4, per) * .38
    p1, p2, pid, _, _ = voro(X, Y, 8, 4, seed + 7, per) if per else voro(X, Y, 12, 6, seed + 7, per)
    streak = vn(X, Y, 8, 2, seed + 8, per) * .7 + vn(X, Y, 4, 4, seed + 9, per) * .3
    d_r = ndi.distance_transform_edt(lava)                      # 바위에서 떨어진 정도
    # 물가 쪽은 식어서 껍질이 많고, 가운데 물줄기는 뜨거워 밝다
    shoreness = np.clip((14.0 - d_r) / 10.0, 0, 1) if not per else 0.0
    crust = lava & (flow < ((.30 + .14 * shoreness) if not per else .12)) & (d_r > 2.5)
    hot = streak + (np.where(d_r > 12, .07, 0.0) if not per else 0.0)
    lc = np.zeros((Hp, Wp, 3), np.int64); lc[:] = LAV[2]
    lc[hot > .48] = LAV[3]; lc[hot > .66] = LAV[4]; lc[hot > .82] = LAV[5]
    # 껍질 판: 판마다 어둡기가 다르고 위 가장자리가 밝다, 판 틈은 빛나는 균열
    pv = _h(pid, pid * 5 + 3, seed + 10)
    ck = np.where(pv < .3, 0, np.where(pv < .7, 1, 2))
    cc = np.array(CRUST)[ck]
    ptop = np.roll(pid, 1, 0) != pid
    cc = np.where(ptop[..., None], np.array(CRUST[3]), cc)
    pcrack = (p2 - p1) < .16
    lc = np.where(crust[..., None], cc, lc)
    lc = np.where((crust & pcrack)[..., None], np.array(LAV[3]), lc)
    lc = np.where((crust & pcrack & (hx(seed + 11) < .35))[..., None], np.array(LAV[4]), lc)
    # 껍질 둘레 1px 는 붉게 식는 띠
    cring = lava & ~crust & ndi.binary_dilation(crust)
    lc = np.where(cring[..., None], np.array(LAV[1]), lc)
    # 바위 바로 옆 용암은 밝은 띠(뜨거운 물가), 그 안쪽은 한 단 어둡게
    lc = np.where((lava & (d_r <= 1))[..., None], np.array(LAV[4]), lc)
    lc = np.where((lava & (d_r > 1) & (d_r <= 2.2) & (streak < .66))[..., None], np.array(LAV[3]), lc)
    # 거품: 어두운 고리 + 밝은 속 (녹은 곳에만)
    molten = lava & ~crust & (d_r > 3)
    bub = molten & (hx(seed + 12) < (.010 if not per else .004))
    ring = ndi.binary_dilation(bub, structure=np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]])) & molten & ~bub
    lc = np.where(ring[..., None], np.array(LAV[1]), lc)
    lc = np.where(bub[..., None], np.array(LAV[5]), lc)
    spark = molten & (hx(seed + 13) < (.012 if not per else .005)) & ~ring
    lc = np.where(spark[..., None], np.array(LAV[5]), lc)
    rgb = np.where(rock[..., None], col, lc)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(solid, 255, 0)
    return out


def cell_mask_px(cells, x0, y0, w, h):
    m = np.zeros((h * 16, w * 16), bool)
    for (x, y) in cells:
        if x0 <= x < x0 + w and y0 <= y < y0 + h:
            m[(y - y0) * 16:(y - y0 + 1) * 16, (x - x0) * 16:(x - x0 + 1) * 16] = True
    return m


def lava_sheet(seed=61):
    """오토타일 16변형. 칸 하나를 3x3 창 가운데에 두고 이웃(대각은 양옆이 다 있을 때만)을 채워 그린 뒤 가운데만 자른다."""
    from PIL import Image
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    Y, X = np.mgrid[0:48, 0:48]
    for mk in range(16):
        N, E, S, W = bool(mk & 1), bool(mk & 2), bool(mk & 4), bool(mk & 8)
        cells = {(1, 1)}
        if N: cells.add((1, 0))
        if E: cells.add((2, 1))
        if S: cells.add((1, 2))
        if W: cells.add((0, 1))
        if N and E: cells.add((2, 0))
        if S and E: cells.add((2, 2))
        if S and W: cells.add((0, 2))
        if N and W: cells.add((0, 0))
        a = paint(cell_mask_px(cells, 0, 0, 3, 3), X, Y, per=16, seed=seed)
        sh.alpha_composite(Image.fromarray(a[16:32, 16:32], 'RGBA'), (mk % 4 * 16, mk // 4 * 16))
    return sh


def lava_layer(cells, W, H, seed=61):
    """지도 전체 크기 RGBA: 용암 칸만 칠한다(전역 좌표, 주기 없음)."""
    from PIL import Image
    Y, X = np.mgrid[0:H * 16, 0:W * 16]
    a = paint(cell_mask_px(cells, 0, 0, W, H), X, Y, per=None, seed=seed)
    return Image.fromarray(a, 'RGBA')


def heat_layer(cells, W, H, seed=71, solid=None, lava_img=None):
    """용암 둘레 열기: 가까운 땅·벽에 붉은 체커 디더 + 위로 오르는 불티 점. solid(px bool) 은 칠하지 않을 곳(천장)."""
    from PIL import Image
    lm = cell_mask_px(cells, 0, 0, W, H)
    if lava_img is not None: lm = np.array(lava_img)[..., 3] > 0
    Hp, Wp = lm.shape
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dl = ndi.distance_transform_edt(~lm)
    bay = np.tile(BAY, (Hp // 4 + 1, Wp // 4 + 1))[:Hp, :Wp]
    out = np.zeros((Hp, Wp, 4), np.uint8)
    lvl = np.where(dl < 3, .6, np.where(dl < 6, .38, np.where(dl < 10, .18, 0.0)))
    on = (lvl > bay * .7 + .02) & ~lm
    if solid is not None: on &= ~solid
    out[on] = (220, 84, 28, 46)
    # 불티: 용암 위쪽 3~22px 안에서 드물게, 두 칸짜리 세로 점
    above = np.zeros_like(lm)
    for k in range(3, 23): above |= np.roll(lm, -k, 0)
    sp = above & ~lm & (_h(X, Y, seed) < .0045)
    if solid is not None: sp &= ~solid
    out[sp] = LAV[4] + (230,)
    sp2 = np.roll(sp, -1, 0) & ~lm
    out[sp2 & ~sp] = LAV[3] + (150,)
    return Image.fromarray(out, 'RGBA')
