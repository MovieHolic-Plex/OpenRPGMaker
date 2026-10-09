"""월드맵 설계 데모 6단계 — 해안선·숲 가장자리·3띠 바다.

5단계까지는 해안이 타일 오토타일(8x8 사분면)이라 직선과 계단이었고, 숲 가장자리도 타일 격자를 따라 일직선이었다.
원본 EasyRPG World 는 해안이 들쭉날쭉하고 모래·거품 줄이 있다. 같은 결을 픽셀 단위로 만든다(무작위 생성기 없음, 해시 노이즈만).

1. 해안선: 육지 타일 마스크를 16배 키워 가우시안(σ4.5)으로 둥글린 뒤 3단 값 노이즈(44·18·7px)로 출렁이게 한다 →
   0.5 등치선이 새 해안선. 육지 타일과 그 이웃 바다 타일에서만 고친다(강 어귀·내륙은 그대로).
   바다 쪽이 된 픽셀은 열린 바다 무늬로, 육지가 된 픽셀은 가장 가까운 육지 바닥 무늬로 채운다.
2. 해안 마감(바깥→안): 거품 줄(흰 청록, 끊기며 출렁) · 1px 어두운 테두리 · 1~2px 모래 줄.
3. 숲 가장자리: 숲 타일 4면 가운데 열린 면을 따라 원본 '외톨이 나무' 타일(둥근 수관 + 줄기)을 7px 간격으로 겹쳐 찍는다.
   수관이 둥글게 튀어나와 타일 직선이 사라진다. 나무는 좌우 반전·바깥 0~3px 오프셋으로 변주.
4. 바다: 해안 픽셀 거리 기준 3띠(얕은 청록 / 기본 / 깊은 남색). 띠 경계는 큰 파장(30px·12px) 노이즈로 완만히 굽고, 경계 ±1.3px 에서만 체크 디더.
"""
import numpy as np
import scipy.ndimage as ndi
import terrain_v4 as V
import boundary_v5 as B5
from boundary_v5 import vnoise, hash2
from terrain_lib import rnd

SEA, RIVER = V.SEA, V.RIVER
OUTLINE = np.array([22, 26, 30], np.float32)
SAND = np.array([226, 206, 146], np.float32)
FOAM = np.array([214, 244, 246], np.float32)
FOAM2 = np.array([150, 214, 226], np.float32)
SHORE = np.tile(SAND, (40, 1))
for _g, _c in ((V.SNOW, (206, 236, 246)), (V.GLACIER, (188, 226, 244)), (V.SWAMP, (98, 84, 52)), (V.MARSH, (88, 70, 92)),
               (V.BADLANDS, (150, 92, 62)), (V.ASH, (104, 100, 104)), (V.BASALT, (72, 64, 74)), (V.CRATER, (90, 78, 70)),
               (V.TUNDRA, (160, 162, 140)), (V.CHASM, (60, 50, 62))):
    SHORE[_g] = _c


class _Fake:
    def __init__(self):
        self.G = np.zeros((3, 3), np.int16)
        self.H = self.W = 3

    def inb(self, x, y):
        return 0 <= x < 3 and 0 <= y < 3


class _FakeK(_Fake):
    def __init__(self, k):
        super().__init__()
        self.G = np.full((3, 3), k, np.int16)


def _interior(k):
    return V.water_tile(_FakeK(k), 1, 1, k)


# 안쪽 물 칸의 가장자리(경계 v9): 강·용암·독 물을 칸 오토타일 대신 매끈한 장으로 — 직각 계단·네모 연못이 사라진다
INLAND = {V.RIVER: dict(sigma=4.5, amp=.13, land=(22, 26, 30), wet=(150, 214, 226), wet_a=.7, th=.72),
          V.LAVA: dict(sigma=4.5, amp=.16, land=(40, 14, 10), wet=(255, 208, 96), wet_a=.8, th=.66),
          V.TOXIC: dict(sigma=4.5, amp=.16, land=(30, 42, 20), wet=(184, 216, 64), wet_a=.7, th=.66)}


def soften_inland(M, img, ground0):
    """강·용암·독 물 칸을 매끈한 장으로 다시 그린다 — 물 칸 안에서만 깎는다(밭·나무·늪 칸으로 번지지 않는다).
    폭은 노이즈로 굽이마다 달라지고, 강은 어귀에서 바다 물빛으로 섞이며 강둑 선은 해안에서 끝난다."""
    Hp, Wp = M.H * 16, M.W * 16
    up = lambda m: np.repeat(np.repeat(m, 16, 0), 16, 1)
    d8 = lambda m, n=1: ndi.binary_dilation(m, structure=np.ones((3, 3), bool), iterations=n)
    sea = M.G == SEA
    seapx = getattr(M, '_seapx', up(sea))                 # 해안 처리 뒤의 바다 픽셀
    landcell = up(M.G >= 10)
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    h1 = hash2(xs, ys, 631)
    sea_t = np.tile(open_sea_tile(), (M.H, M.W, 1))
    dsea = ndi.distance_transform_edt(~seapx)
    for k, P in INLAND.items():
        cells = M.G == k
        if not cells.any():
            continue
        src = cells | sea if k == V.RIVER else cells
        f = ndi.gaussian_filter(up(src).astype(np.float32), P['sigma'], mode='nearest')
        f += (vnoise(Hp, Wp, 22, 640 + k) * .7 + vnoise(Hp, Wp, 8, 650 + k) * .3) * P['amp'] * 2
        cellpx = up(cells) & ~seapx
        wet = cellpx & (f > P.get('th', .5))
        to_land = cellpx & ~wet
        if to_land.any():                                  # 경계 너머 같은 거리의 바닥 픽셀(거울) — 가장 가까운 픽셀을 그대로 쓰면 줄무늬가 났다
            src_ok = landcell & ~up(M.G < 10)
            idx = ndi.distance_transform_edt(~src_ok, return_distances=False, return_indices=True)
            my = np.clip(2 * idx[0] - ys, 0, Hp - 1)
            mx = np.clip(2 * idx[1] - xs, 0, Wp - 1)
            ok = src_ok[my, mx]
            my = np.where(ok, my, idx[0])
            mx = np.where(ok, mx, idx[1])
            img[to_land] = ground0[my[to_land], mx[to_land]]
        tile = np.tile(_interior(k), (M.H, M.W, 1))
        img[wet] = tile[wet]
        if k == V.RIVER:                                   # 어귀: 바다 쪽 8px 안에서 바다 물빛과 덩이 디더
            near = wet & (dsea <= 8)
            mix = near & (h1 < (1 - dsea / 8.0) * .9)
            img[mix] = sea_t[mix]
        allw = wet | seapx                                 # 다른 물 칸(네모)은 넣지 않는다 — 그 칸이 다음 차례에 깎이면 테두리 선만 남았다
        dl = ndi.distance_transform_edt(~allw)            # 땅 픽셀 → 물까지
        dw = ndi.distance_transform_edt(wet)
        zone = up(d8(cells))
        bare = (np.all(img == ground0, axis=2) | to_land) & landcell & zone & ~allw & ~up((M.G < 10) & ~cells)
        far = dsea > 3                                     # 강둑 선은 해안 3px 앞에서 끝난다
        f2 = img.astype(np.float32)
        rim = bare & (dl <= 1.0) & (h1 < .85) & far
        f2[rim] = f2[rim] * .25 + np.array(P['land'], np.float32) * .75
        lip = wet & (dw <= 1.0) & (h1 < .9) & far
        f2[lip] = f2[lip] * (1 - P['wet_a']) + np.array(P['wet'], np.float32) * P['wet_a']
        lip2 = wet & (dw > 1.0) & (dw <= 2.0) & (h1 < .6) & far          # 둘째 줄 — 물가 빛 띠
        f2[lip2] = f2[lip2] * (1 - P['wet_a'] * .55) + np.array(P['wet'], np.float32) * P['wet_a'] * .55
        img[:] = np.clip(f2, 0, 255).astype(np.uint8)
    return img


def open_sea_tile():
    return V.water_tile(_Fake(), 1, 1, SEA)


def _cell_masks(M):
    sea = M.G == SEA
    land = (M.G >= 10) | (M.G == RIVER)
    riv = M.G == RIVER
    d8 = lambda m: ndi.binary_dilation(m, structure=np.ones((3, 3), bool))
    edit = (sea | ((M.G >= 10) & d8(sea))) & ~riv
    edit &= ~d8(riv) | (M.G >= 10) & ~d8(riv)   # 강 어귀 곁은 원본 유지
    return land, sea, edit


def reshape_coast(M, img, ground0):
    Hp, Wp = M.H * 16, M.W * 16
    land, sea, edit = _cell_masks(M)
    up = lambda m: np.repeat(np.repeat(m, 16, 0), 16, 1)
    field = ndi.gaussian_filter(up(land).astype(np.float32), 4.5, mode='nearest')
    field += vnoise(Hp, Wp, 44, 601) * .17 + vnoise(Hp, Wp, 18, 602) * .10 + vnoise(Hp, Wp, 7, 603) * .05
    newland = field > .5
    E = up(edit)
    seacell_px = up(sea)
    landcell_px = up(M.G >= 10)
    # 새 바다 픽셀 = 편집 구역 안에서 newland 가 아닌 곳
    sea0 = np.tile(open_sea_tile(), (M.H, M.W, 1))
    to_sea = E & ~newland
    to_land = E & newland & seacell_px
    # 육지가 된 바다 픽셀: 가장 가까운 육지 바닥(원 육지 타일 픽셀) 무늬
    if to_land.any():
        idx = ndi.distance_transform_edt(~landcell_px, return_distances=False, return_indices=True)
        sy, sx = idx[0][to_land], idx[1][to_land]
        img[to_land] = ground0[sy, sx]
    img[to_sea] = sea0[to_sea]
    # 원본 바다 타일의 남은 해안 그림이 '육지 쪽'에 남지 않게: 바다 타일 안 육지 판정 픽셀은 위에서 덮였다.
    seapx = np.where(E, ~newland, up(sea))
    seapx &= ~up(M.G == RIVER)
    seapx |= up(sea) & ~E
    # 강 타일은 육지도 바다도 아님: 해안 마감 대상에서 뺀다
    M._seapx = seapx
    finish_coast(M, img, seapx, ~seapx & ~up(M.G == RIVER) & ~up((M.G < 10) & (M.G != SEA)))


def finish_coast(M, img, seapx, landpx):
    Hp, Wp = seapx.shape
    dl = ndi.distance_transform_edt(~landpx)      # 바다 픽셀 → 육지까지 거리
    ds = ndi.distance_transform_edt(~seapx)       # 육지 픽셀 → 바다까지 거리
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    h1 = hash2(xs, ys, 611)
    vn = vnoise(Hp, Wp, 9, 612)
    # 거품: 바다 쪽. 해안에 붙은 줄(1~2px, 끊김) + 출렁이며 떨어진 둘째 줄
    near = seapx & (dl > .5) & (dl <= 1.6) & (h1 < .78)
    wave = seapx & (np.abs(dl - (3.1 + 1.2 * vn)) < .55) & (h1 < .62) & (dl > 1.6)
    palm = np.zeros((Hp, Wp), bool)
    for c in V.WPAL:
        palm |= np.all(img == c, axis=2)
    img[near & palm] = FOAM.astype(np.uint8)
    img[wave & palm] = FOAM2.astype(np.uint8)
    # 육지 쪽: 1px 테두리(끊김), 그 안 1~2px 모래
    f = img.astype(np.float32)
    h2 = hash2(xs, ys, 613)
    rim = landpx & (ds > 0) & (ds <= 1.2)
    f[rim & (h2 < .86)] = f[rim & (h2 < .86)] * .25 + OUTLINE * .75
    sand = landpx & (ds > 1.2) & (ds <= 2.3 + .9 * (h2 > .5))
    sand &= hash2(xs, ys, 614) < .82
    lab = getattr(M, '_label_px', None)
    if lab is None:
        f[sand] = f[sand] * .35 + SAND * .65
    else:                                         # 바닥마다 물가 띠(경계 v9): 설원=얼음 가장자리, 늪=진흙, 협곡토·재·현무암=바위, 툰드라=자갈
        f[sand] = f[sand] * .35 + SHORE[np.clip(lab[sand], 0, len(SHORE) - 1)] * .65
    img[:] = np.clip(f, 0, 255).astype(np.uint8)


def render_depth_v6(M, img):
    seapx = M._seapx
    Hp, Wp = seapx.shape
    d = ndi.distance_transform_edt(seapx)           # 육지(또는 강)까지 거리(px)
    wob = vnoise(Hp, Wp, 30, 701) * 6.5 + vnoise(Hp, Wp, 12, 702) * 1.6
    f = d + wob
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    chk = ((xs + ys) & 1) == 0
    T1, T2, B = 26.0, 70.0, 1.3

    def step(th):
        hard = f > th
        band = np.abs(f - th) < B
        return np.where(band, np.where(f > th, chk, ~chk) & (np.abs(f - th) < B), hard)
    s1, s2 = step(T1), step(T2)
    palm = np.zeros((Hp, Wp), bool)
    for c in V.WPAL:
        palm |= np.all(img == c, axis=2)
    # 강 어귀 칸에 섞인 바다 화소도 얕은 물빛으로 — 빼 두면 진한 바다 원색이 강 칸 안에 얼룩 네모로 남았다(QA 2026-10-03, 군도 해협)
    mouth = palm & np.repeat(np.repeat(M.G == RIVER, 16, 0), 16, 1)
    palm &= seapx
    shallow = (palm & ~s1) | mouth
    deep = palm & s2
    teal = np.array([100, 210, 214], np.float32)
    img[shallow] = (img[shallow] * .6 + teal * .4).astype(np.uint8)
    img[deep] = (img[deep].astype(np.float32) * np.array([.64, .68, .84])).astype(np.uint8)
    # 산호초: 얕은 띠 안 드문 자리
    dt = V.sea_dist(M)
    for y in range(M.H):
        for x in range(M.W):
            if M.G[y, x] != SEA or not (1 <= dt[y, x] <= 2.2) or rnd(x, y, 909) < .86:
                continue
            for i in range(5):
                cx = x * 16 + 2 + int(rnd(x, y, 910 + i) * 12)
                cy = y * 16 + 2 + int(rnd(x, y, 920 + i) * 12)
                for dx, dy, c in ((0, 0, (46, 143, 143)), (1, 0, (46, 143, 143)), (0, 1, (70, 168, 160)), (1, 1, (46, 143, 143)), (-1, 0, (196, 240, 236))):
                    if seapx[cy + dy, cx + dx] and d[cy + dy, cx + dx] > 5 and palm[cy + dy, cx + dx]:
                        img[cy + dy, cx + dx] = c
    return img


# ─── 숲 가장자리 ───
def forest_edge(M, img):
    def isf(x, y):
        return M.inb(x, y) and M.G[y, x] >= 10 and int(M.O[y, x]) in V.FORESTS
    spr = {}
    for k in V.FORESTS:
        rgb, a = V.obj_cell4(k, 'iso')
        spr[k] = (rgb, a, np.nonzero(a.any(0))[0][[0, -1]], np.nonzero(a.any(1))[0][[0, -1]])
    jobs = []
    Hp, Wp = img.shape[:2]
    wob = vnoise(Hp, Wp, 26, 1400) * 4.5 + vnoise(Hp, Wp, 9, 1401) * 1.5     # 숲 가장자리 출렁임(경계 v9) — 고정 0~3px 는 칸 직선이 그대로 보였다
    for y in range(M.H):
        for x in range(M.W):
            k = int(M.O[y, x])
            if not isf(x, y) or M.is_face(x, y):
                continue
            for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                nx, ny = x + dx, y + dy
                if not M.inb(nx, ny) or isf(nx, ny):
                    continue
                if M.G[ny, nx] >= 10 and (M.is_face(nx, ny) or M.RAMP[ny, nx]):
                    continue
                for i in range(2):                  # 타일 한 면에 나무 둘(7~9px 간격)
                    jit = (rnd(x, y, 1100 + i + 3 * (dx + 2 * dy + 3)) - .5) * 3
                    out = rnd(x, y, 1200 + i + 5 * (dx + 2 * dy + 3)) * 3
                    t = 4 + 8 * i + jit
                    ex = x * 16 + 8 + dx * 8 + (0 if dx else int(t) - 8)
                    ey = y * 16 + 8 + dy * 8 + (0 if dy else int(t) - 8)
                    w_ = float(wob[min(max(ey, 0), Hp - 1), min(max(ex, 0), Wp - 1)])
                    out = min(out + min(max(w_, -3.0), 4.0), 4.0)    # 바깥 4px 넘으면 숲과 사이가 벌어진다(QA 7.1)
                    if dy:
                        cx, cy = x * 16 + t, (y * 16 - 1 - out if dy < 0 else y * 16 + 17 + out)
                    else:
                        cy, cx = y * 16 + t + 2, (x * 16 - 1 - out if dx < 0 else x * 16 + 17 + out)
                    jobs.append((cy, cx, k, rnd(x, y, 1300 + i + 7 * (dx + 2 * dy + 3)) < .5, dy))
    jobs.sort(key=lambda j: j[0])
    for cy, cx, k, flip, dy in jobs:
        rgb, a, xr, yr = spr[k]
        x0, x1 = xr
        y0, y1 = yr
        w, h = x1 - x0 + 1, y1 - y0 + 1
        px = int(round(cx - w / 2))
        # 남쪽 면: 줄기가 바깥으로, 그 밖: 수관 중심을 가장자리에
        py = int(round(cy - h / 2 - (2 if dy > 0 else 0)))
        sa = a[y0:y1 + 1, x0:x1 + 1]
        sr = rgb[y0:y1 + 1, x0:x1 + 1]
        if flip:
            sa, sr = sa[:, ::-1], sr[:, ::-1]
        ya, yb = max(py, 0), min(py + h, Hp)
        xa, xb = max(px, 0), min(px + w, Wp)
        if ya >= yb or xa >= xb:
            continue
        ma = sa[ya - py:yb - py, xa - px:xb - px]
        mr = sr[ya - py:yb - py, xa - px:xb - px]
        dst = img[ya:yb, xa:xb]
        dst[ma] = mr[ma]
    return img


def install(M4):
    """make_map_v4.render 가 부르는 함수들을 6단계 판으로 바꾼다."""
    o_ground, o_water, o_objects = M4.render_ground, M4.render_water, M4.render_objects

    def rg(M):
        g = o_ground(M)
        M._ground0 = g.copy()
        return g

    def ro(M, img):
        o_objects(M, img)
        return forest_edge(M, img)

    def rw(M, img):
        o_water(M, img)
        reshape_coast(M, img, M._ground0)
        soften_inland(M, img, M._ground0)
        return img
    M4.render_ground, M4.render_objects, M4.render_water, M4.render_depth = rg, ro, rw, render_depth_v6
