# 황폐 필드 보정 패스(2026-10-08, WAVE-BRIEF-4): 흙 바닥 3종 + 시그니처 땅 덩이 오토타일 3종 + 고목 밑·골 가장자리 질감.
#  바닥(같은 7단 램프, 칩셋 손 도트 타일 결을 밝기 순서 그대로 옮긴다 — 자체 노이즈 바닥 아님):
#   ashsoil  : 재 섞인 흙 — 점박이 흙(16,224) 결 위에 재 알갱이가 성기게 섞였다(회백 재 램프, 흙 결 순위 그대로).
#   gravel   : 자갈 섞인 흙 — 칩셋 자갈 점박이 흙(192,192) 결을 붉은 흙 램프로 + 손으로 찍은 잔자갈(윤곽 한 겹, 왼쪽 위 빛).
#   redsand  : 붉은 모래흙 — 칩셋 고운 흙(208,192) 결을 붉은 모래 램프로 + 바람 물결 가는 골.
#  오토타일(16변형, 칸 번호 = 위1 + 오른2 + 아래4 + 왼8, 위층 투명 덧그림):
#   ashplain : 회백색 재 평원(걷기) — 두꺼운 회백 재 덩이, 가장자리는 알갱이로 성기게, 남쪽 테에 재 두께 그늘 1px.
#   claypan  : 갈라진 점토 말라붙은 고지(걷기) — 밝은 크림색 점토판, 다각형 틈, 남쪽에 2px 앞면(낮은 턱), 북쪽 테 밝은 모.
#   toxpool  : 고인 오염·붉은 물웅덩이(막힘) — 검붉은 물, 기름 띠 반짝임·녹 거품, 북쪽 둑 흙 앞면 2px, 둘레 젖은 진흙 + 녹 테.
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from ww_base import (PAL, GRAIN, P, hx, hash2, tnoise, smooth, recolor_tile, chip_tex, tiled, voro, _h, sheet_from_cells, cell_of,
                     soft_val, ground_tex, crack_lines)
from ww_auto import edge_depth, tnoise1, N_, E_, S_, W_

PAL.update({
    'wl_ashw':  ['#211c1c', '#433c3a', '#635a56', '#827873', '#a09690', '#bab1aa', '#d3ccc4'],   # 회백 재(재 평원)
    'wl_clay':  ['#2a1f15', '#54412c', '#7d6545', '#a48b63', '#c5ae84', '#ddcca3', '#f1e6c6'],   # 말라붙은 크림 점토
    'wl_rsand': ['#1e0e0b', '#3c1d14', '#5a2c1c', '#7a3f27', '#9a5634', '#b67148', '#cc8e62'],   # 붉은 모래흙
    'wl_toxw':  ['#0d0405', '#240a0a', '#3c110e', '#561a12', '#742818', '#963c22', '#c0663a'],   # 고인 붉은 오염 물
})
GRAIN.update({'wl_ashw': (0.10, 1.8), 'wl_clay': (0.12, 1.6), 'wl_rsand': (0.16, 1.5), 'wl_toxw': (0.06, 2.0)})

BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def _rank_t(tex_xy, mat, lo, hi):
    return recolor_tile(chip_tex(*tex_xy), mat, lo, hi)


# ================================================================ 바닥 결(아무 크기, per 가 있으면 주기로 감긴다)
def tex_ashsoil(W, H, seed=41, per=None):
    """재 섞인 흙: 흙 결(톤) 그대로, 재 덩이 잡음이 큰 곳의 화소를 같은 순위의 회백 재 톤으로 바꾼다(알갱이로 섞임)."""
    _, t = ground_tex('earth'); T = tiled(t, W, H)
    Y, X = np.mgrid[0:H, 0:W]
    if per: n = tnoise(W, H, 12, seed) * 0.65 + tnoise(W, H, 6, seed + 1) * 0.35
    else: n = smooth(W, H, 12, seed) * 0.65 + smooth(W, H, 6, seed + 1) * 0.35
    hx_ = hash2(X % (per or 1 << 20), Y % (per or 1 << 20), seed + 2)
    ash = ((n + (hx_ - 0.5) * 0.9) > 0.80) | ((n > 0.62) & (hx_ > 0.93))          # 재는 덩이 속 알갱이 + 드문 홑알
    rgb = P('rdirt')[T]
    ta = np.clip(T, 2, 3)
    rgb = np.where(ash[..., None], P('wl_ashw')[ta], rgb)
    flake = (hash2(X % (per or 1 << 20), Y % (per or 1 << 20), seed + 3) > 0.985) & (n > 0.45)       # 흰 재 조각
    rgb[flake] = P('wl_ashw')[6]
    cinder = (hash2(X % (per or 1 << 20), Y % (per or 1 << 20), seed + 4) > 0.988)                   # 검은 탄 조각
    rgb[cinder] = P('wl_ashw')[1]
    return rgb.astype(np.uint8)


def _pebbles(W, H, seed, per=None, dens=0.010, big=0.25):
    """잔자갈: 2x1~3x2 돌, 윤곽 한 겹(아래·오른쪽 진하게), 왼쪽 위 1px 빛. 돌 재질은 붉은 사암·바랜 마름돌·재 섞기.
    돌려주는 값: RGBA 배열(투명 바탕)."""
    out = np.zeros((H, W, 4), np.uint8)
    r = np.random.default_rng(seed)
    n = int(W * H * dens)
    mats = ['rrock', 'rrock', 'rstone', 'dust']
    for _ in range(n):
        x0 = int(r.integers(0, W)); y0 = int(r.integers(0, H))
        bigs = r.random() < big
        w = int(r.integers(3, 5)) if bigs else int(r.integers(2, 4)); h = 3 if bigs else 2
        pe = P(mats[int(r.integers(0, 4))])
        base = int(r.integers(3, 5))
        for j in range(-1, h + 1):
            for i in range(-1, w + 1):
                inner = 0 <= i < w and 0 <= j < h
                corner = (i in (-1, w)) and (j in (-1, h))
                if corner: continue
                if not inner and (j == -1 or i == -1): c = None                       # 위·왼 윤곽은 생략(빛 받는 쪽은 땅에 녹는다)
                elif not inner: c = pe[1]
                else:
                    if (i, j) in ((0, 0), (w - 1, 0)) and bigs: c = pe[base + 1] if i == 0 else pe[base]
                    elif j == 0: c = pe[min(6, base + 1)]
                    elif j == h - 1: c = pe[base - 1]
                    else: c = pe[base]
                    if i == 0 and j == 0: c = pe[min(6, base + 2)]
                if c is None: continue
                X = x0 + i; Y = y0 + j
                if per: X %= W; Y %= H
                elif not (0 <= X < W and 0 <= Y < H): continue
                if inner or out[Y, X, 3] == 0: out[Y, X, :3] = c; out[Y, X, 3] = 255
    return out


def tex_gravel(W, H, seed=51, per=None):
    """자갈 섞인 흙: 칩셋 자갈 점박이 흙(192,192) 결 → 붉은 흙 1.6~4.6, + 잔자갈."""
    rgb0, t0 = _rank_t((192, 192), 'rdirt', 1.6, 4.6)
    T = tiled(t0, W, H)
    rgb = P('rdirt')[T].copy()
    pb = _pebbles(W, H, seed, per, 0.0075)
    m = pb[..., 3] > 0
    rgb[m] = pb[..., :3][m]
    return rgb.astype(np.uint8)


def tex_redsand(W, H, seed=61, per=None):
    """붉은 모래흙: 칩셋 고운 흙(208,192) 결 → 붉은 모래 2.2~4.8, + 가는 바람 물결(가로로 휜 골, 골 밑 1px 밝음)."""
    _, t0 = _rank_t((208, 192), 'wl_rsand', 2.0, 4.5)
    T = tiled(t0, W, H).copy()
    X, Y = np.meshgrid(np.arange(W), np.arange(H))
    if per:
        ph = Y + 1.8 * np.sin(2 * np.pi * X / per * 3 + 0.5) + 1.2 * np.sin(2 * np.pi * X / per * 2 + 2.1) + 1.6 * tnoise(W, H, 12, seed)
        on = tnoise(W, H, 8, seed + 1) > 0.42
    else:
        ph = Y + 1.8 * np.sin(X / 7.6 + 0.5) + 1.2 * np.sin(X / 13.0 + 2.1) + 3.0 * smooth(W, H, 20, seed)
        on = smooth(W, H, 8, seed + 1) > 0.42
    k = np.floor(ph).astype(int) % 6
    T = np.where((k == 0) & on, np.maximum(T - 1, 1), T)
    T = np.where((k == 1) & on, np.minimum(T + 1, 6), T)
    rgb = P('wl_rsand')[T]
    sp = hash2(X % (per or 1 << 20), Y % (per or 1 << 20), seed + 3) > 0.992                      # 드문 잔돌
    rgb[sp] = P('rrock')[5]
    return rgb.astype(np.uint8)


def sample48(fn, crack=None, seed=3):
    """3x3 바닥 표본(48x48, 이음새 없음). crack = 틈 램프 이름(None 이면 틈 없음)."""
    a = fn(48, 48, per=48).copy()
    if crack:
        Y, X = np.mgrid[0:48, 0:48]
        keep = tnoise(48, 48, 16, seed + 1) > 0.62
        cr, lip = crack_lines(X, Y, seed + 2, per=48, sc=24, keep=keep, thick=0.05)
        a[cr] = P(crack)[1]; a[lip & ~cr] = P(crack)[5]
    return Image.fromarray(a, 'RGB').convert('RGBA')


def ground_ashsoil(): return sample48(tex_ashsoil, 'rdirt', 13)
def ground_gravelsoil(): return sample48(tex_gravel, None)
def ground_redsand(): return sample48(tex_redsand, 'wl_rsand', 17)


# ================================================================ 오토타일(가장자리: 두 옥타브 주기 잡음, 둥근 코너)
def edge_depth2(n, inset, jag, rad, seed):
    """ww_auto.edge_depth 와 같은 규약 + 잔 옥타브(주기 16, 이웃 칸과 이어진다). 가장자리 윤곽이 울퉁불퉁해진다."""
    m = edge_depth(n, inset=inset, jag=jag, rad=rad, seed=seed)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    f = {'N': tnoise1(16, 2, seed + 11)[X], 'S': tnoise1(16, 2, seed + 12)[X], 'W': tnoise1(16, 2, seed + 13)[Y], 'E': tnoise1(16, 2, seed + 14)[Y]}
    miss = {'N': not (n & N_), 'E': not (n & E_), 'S': not (n & S_), 'W': not (n & W_)}
    dist = {'N': Y, 'S': 15 - Y, 'W': X, 'E': 15 - X}
    for k in 'NESW':
        if miss[k]:
            w = np.clip(1 - dist[k] / 7.0, 0, 1)                                   # 가장자리 가까이에서만 흔든다
            m = m - (f[k] - 0.5) * 1.6 * w
    return m


def ashplain_sheet(seed=31):
    """회백색 재 평원: 두껍게 쌓인 회백 재(칩셋 고운 흙 결 순위 → 재 3~5) + 굵은 바람 물결 + 탄 조각.
    가장자리 2~4px 는 재 알갱이가 성기게 흩어져 밑 흙에 녹고, 덩이 남쪽 안 테 1px 그늘(재 두께)."""
    _, t0 = _rank_t((208, 192), 'wl_ashw', 2.6, 5.0)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    ph = (Y + np.round(1.3 * np.sin(2 * np.pi * X / 16 + 0.6) + 0.7 * np.sin(2 * np.pi * X / 8 + 1.9))).astype(int)
    cells = []
    for n in range(16):
        m = edge_depth2(n, inset=1.6, jag=2.2, rad=6.0, seed=seed)
        T = t0.copy()
        T = np.where((ph % 8 == 0) & (m > 2.0), np.maximum(T - 1, 2), T)
        T = np.where((ph % 8 == 1) & (m > 2.0), np.minimum(T + 1, 6), T)
        T = np.where(hash2(X, Y, seed + 5) > 0.975, 1, T)                        # 탄 조각
        T = np.where(hash2(X, Y, seed + 6) > 0.97, 6, T)                         # 흰 재 조각
        solid = m >= 1.2
        gr = hash2(X, Y, seed + 7)
        fringe = (m >= -1.8) & (m < 1.2) & (gr < np.clip((m + 1.8) / 3.0, 0, 1) * 0.85)
        below = np.vstack([solid[1:], np.full((1, 16), bool(n & S_))])
        T = np.where(solid & ~below, 2, T)                                         # 덩이 남쪽 안 테 1px 그늘(재 두께)
        T = np.where(fringe, np.clip(T, 3, 5), T)
        on = solid | fringe
        rgb = P('wl_ashw')[np.clip(T, 0, 6)]
        al = np.where(solid, 255, np.where(fringe, 230, 0))
        cells.append(Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA'))
    return sheet_from_cells(cells)


def claypan_sheet(seed=37):
    """갈라진 점토 말라붙은 고지: 밝은 크림 점토판(칩셋 고운 흙 결 → 점토 3.6~5.6), 주기 16 보로노이 다각형 틈(1px 진한 골 + 판 위 모 밝게).
    덩이는 땅보다 2px 높은 말라붙은 판: 남쪽(아래 이웃 없음) 가장자리에 2px 앞면(점토 2·3, 세로 결) + 1px 윤곽,
    북쪽 테 1px 가장 밝은 모, 동서 가장자리 1px 윤곽."""
    _, t0 = _rank_t((208, 192), 'wl_clay', 3.6, 5.6)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    # 속 틈: 주기 16 으로 감기는 굽은 금 두 줄(가로·세로, 반대쪽 모서리에서 같은 자리로 나가 이웃 칸과 이어진다) + 막다른 가지.
    #  넓은 보로노이 칸 틈은 칸마다 같은 판이 되풀이돼 포석처럼 보여서 쓰지 않는다.
    gap = np.zeros((16, 16), bool)
    def hy(x): return int(round(6 + 1.6 * np.sin(2 * np.pi * x / 16 + 0.4) + 0.8 * np.sin(4 * np.pi * x / 16 + 1.3)))
    def vx(y): return int(round(11 + 1.8 * np.sin(2 * np.pi * y / 16 + 2.0) + 0.7 * np.sin(4 * np.pi * y / 16)))
    for x in range(16):
        if x in (14,): continue                                                  # 금이 한 군데 끊긴다
        y0, y1 = hy(x), hy(x + 1)
        for y in range(min(y0, y1), max(y0, y1) + 1): gap[y % 16, x % 16] = True
    for y in range(16):
        if y in (1, 2): continue
        x0, x1 = vx(y), vx(y + 1)
        for x in range(min(x0, x1), max(x0, x1) + 1): gap[y % 16, x % 16] = True
    x, y = 4, hy(4)
    for (dx, dy) in ((0, 1), (1, 0), (0, 1), (0, 1), (1, 0), (0, 1)):              # 막다른 가지
        x += dx; y += dy; gap[y % 16, x % 16] = True
    off = 0
    jN = tnoise1(16, 3, seed + 21); jS = tnoise1(16, 3, seed + 22); jW = tnoise1(16, 3, seed + 23); jE = tnoise1(16, 3, seed + 24)
    cells = []
    for n in range(16):
        m = edge_depth2(n, inset=2.0, jag=1.6, rad=5.5, seed=seed)
        inside = m >= 0
        T = np.clip(t0 + off, 2, 6)
        T = np.where(~gap & np.roll(gap, 1, 0), np.minimum(T + 1, 6), T)      # 틈 아래 판 위 모(말려 올라 빛)
        T = np.where(~gap & np.roll(gap, -1, 0), np.maximum(T - 1, 2), T)     # 틈 위 판 아래 모 그늘
        # 가장자리 갈라짐: 모서리에서 안쪽으로 2~4px 짧은 금(말라 오그라든 판 끝)
        eg = np.zeros((16, 16), bool)
        for side, jj in (('N', jN), ('S', jS), ('W', jW), ('E', jE)):
            bit = {'N': N_, 'S': S_, 'W': W_, 'E': E_}[side]
            if n & bit: continue
            for k in range(16):
                if jj[k] < 0.74 or jj[(k + 1) % 16] > jj[k] or jj[(k - 1) % 16] > jj[k]: continue
                L = 2 + int(jj[k] * 3)
                for t in range(L + 3):
                    yy, xx = {'N': (t, k), 'S': (15 - t, k), 'W': (k, t), 'E': (k, 15 - t)}[side]
                    if m[yy, xx] >= 0 and m[yy, xx] < L: eg[yy, xx] = True
        T = np.where(eg & ~gap, 2, T)
        T = np.where(gap, 1, T)
        out = np.zeros((16, 16, 4), np.uint8)
        rgb = P('wl_clay')[T]
        out[inside, :3] = rgb[inside]; out[inside, 3] = 255
        # 북쪽 테 밝은 모, 가장자리 윤곽
        edge_in = inside & ~(np.roll(inside, 1, 0) & np.roll(inside, -1, 0) & np.roll(inside, 1, 1) & np.roll(inside, -1, 1))
        if n & N_: edge_in[0, :] = False
        if n & S_: edge_in[15, :] = False
        if n & W_: edge_in[:, 0] = False
        if n & E_: edge_in[:, 15] = False
        top_lip = edge_in & ~np.roll(inside, 1, 0)
        top_lip[0, :] &= not (n & N_)
        out[edge_in] = (*P('wl_clay')[2], 255)
        out[top_lip & inside] = (*P('wl_clay')[6], 255)
        # 남쪽 앞면 2px + 밑 윤곽(아래 이웃 없을 때만): 판 밑변 바로 아래
        if not (n & S_):
            for x in range(16):
                col = np.where(inside[:, x])[0]
                if not len(col): continue
                yb = col[-1]
                for k, tt in ((1, 3), (2, 2)):
                    if yb + k < 16:
                        c = P('wl_clay')[tt - (1 if hash2(x, k, seed + 4) > 0.7 else 0)]
                        out[yb + k, x, :3] = c; out[yb + k, x, 3] = 255
                if yb + 3 < 16: out[yb + 3, x] = (*P('rdirt')[1], 255)
                out[yb, x] = (*P('wl_clay')[4], 255)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def toxpool_sheet(seed=43):
    """고인 오염·붉은 물웅덩이(막힘): 검붉은 물(톤 2~3) + 가로 물결(톤 4) + 기름 띠 반짝임(톤 5·6, 성기게) + 녹 거품 점.
    북쪽 가장자리(위 이웃 없음): 물 위에 2px 흙 둑 앞면(붉은 흙 2·1), 그 밑 물은 한 단 어둡게(둑 그림자).
    둘레: 물 바로 바깥 1px 녹 테(녹 3·4), 그 밖 2px 젖은 진흙(붉은 흙 1·2, 바깥은 체커로 성기게)."""
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    tw = P('wl_toxw'); rd = P('rdirt'); ru = P('rust')
    rip = (Y + np.round(0.8 * np.sin(2 * np.pi * X / 16 * 2 + 0.3))).astype(int)
    base = np.where(tnoise(16, 16, 8, seed) > 0.55, 3, 2)
    cells = []
    for n in range(16):
        m = edge_depth2(n, inset=4.2, jag=1.5, rad=5.5, seed=seed)
        water = m >= 0
        T = base.copy()
        T = np.where((rip % 5 == 0) & (hash2(X // 3, Y, seed + 2) > 0.35), 4, T)
        sheen = (rip % 5 == 2) & (hash2(X // 2, Y, seed + 3) > 0.72)
        T = np.where(sheen, 5, T)
        T = np.where(sheen & (hash2(X, Y, seed + 4) > 0.8), 6, T)
        out = np.zeros((16, 16, 4), np.uint8)
        # 북쪽 둑: 위 이웃 없음 → 물의 맨 위 2px 를 흙 앞면으로, 그 아래 2px 물은 어둡게
        bank = np.zeros((16, 16), bool); shade = np.zeros((16, 16), bool)
        if not (n & N_):
            for x in range(16):
                col = np.where(water[:, x])[0]
                if not len(col): continue
                y0 = col[0]
                bank[y0:y0 + 2, x] = True; shade[y0 + 2:y0 + 4, x] = True
        T = np.where(shade, np.minimum(T, 1), T)
        rgb = tw[np.clip(T, 0, 6)]
        out[water, :3] = rgb[water]; out[water, 3] = 255
        bk = water & bank
        bc = np.where((Y % 2 == 0)[..., None], rd[2], rd[1])
        out[bk, :3] = bc[bk]
        # 둑 앞면 위 1px 밝은 흙 모
        # 녹 거품 점(물가 가까이)
        scum = water & ~bank & (m < 2.5) & (hash2(X, Y, seed + 6) > 0.7)
        out[scum, :3] = np.where((hash2(X, Y, seed + 7) > 0.5)[..., None], ru[4], ru[3])[scum]
        # 물 바깥: 1px 녹 테 → 2px 젖은 진흙(바깥 1px 은 체커)
        ring1 = (~water) & (m >= -1.2)
        ring2 = (~water) & (m < -1.2) & (m >= -2.6)
        ring3 = (~water) & (m < -2.6) & (m >= -3.8) & ((X + Y) % 2 == 0)
        out[ring1, :3] = np.where((hash2(X, Y, seed + 8) > 0.55)[..., None], ru[2], rd[1])[ring1]; out[ring1, 3] = 255
        out[ring2, :3] = rd[2]; out[ring2, 3] = 255
        out[ring3, :3] = rd[2]; out[ring3, 3] = 200
        # 북쪽 테 위(둑 꼭대기) 1px 밝은 흙
        if not (n & N_):
            for x in range(16):
                col = np.where(water[:, x])[0]
                if len(col) and col[0] - 1 >= 0:
                    out[col[0] - 1, x] = (*rd[5], 255)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ================================================================ 오토타일 이어 붙인 시험 그림
SHAPES = {
    '5x5 blob': ["  ###  ", " ##### ", "#######", "#######", " ##### ", "  ###  "],
    'spiral': ["#######", "#     #", "# ### #", "# # # #", "# #   #", "# #####"],
    'L + nose': ["###    ", "###    ", "####   ", "###### ", "#######", "  ##   "],
    'ring+dots': ["  ####  ", " #    # ", "#  ##  #", " #    # ", "  ####  ", "#  #  # "],
}


def draw_shape(sheet, rows, bg):
    h = len(rows); w = max(len(r) for r in rows)
    cells = {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == '#'}
    im = Image.new('RGBA', ((w + 2) * 16, (h + 2) * 16))
    for y in range(h + 2):
        for x in range(w + 2): im.alpha_composite(bg, (x * 16, y * 16))
    for (x, y) in cells:
        n = (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
        im.alpha_composite(cell_of(sheet, n), ((x + 1) * 16, (y + 1) * 16))
    return im


def check_autotile(sheets, bg_img, path, scale=3):
    """오토타일마다: 시트 원본(4x4) + 모양 4가지를 흙 바닥 위에 이어 붙인 그림, scale 배."""
    bg = bg_img.crop((0, 0, 16, 16))
    rows = []
    for name, sh in sheets.items():
        tiles = [sh.resize((64 * 2, 64 * 2), Image.NEAREST)]
        for sn, sr in SHAPES.items(): tiles.append(draw_shape(sh, sr, bg))
        rows.append((name, tiles))
    pad = 14
    rw = [sum(t.width for t in ts) + pad * (len(ts) + 1) for _, ts in rows]
    rh = [max(t.height for t in ts) + 22 for _, ts in rows]
    out = Image.new('RGBA', (max(rw), sum(rh) + 6), (28, 28, 34, 255)); d = ImageDraw.Draw(out)
    y = 4
    for (name, ts), h in zip(rows, rh):
        d.text((pad, y), 'autotile-%s  (sheet 2x | 5x5 blob | spiral | L+nose | ring+dots)' % name, fill=(230, 230, 230, 255))
        x = pad
        for t in ts:
            out.alpha_composite(t, (x, y + 16)); x += t.width + pad
        y += h
    out = out.resize((out.width * scale // 2, out.height * scale // 2), Image.NEAREST)
    out.convert('RGB').save(path)
    return out.size
