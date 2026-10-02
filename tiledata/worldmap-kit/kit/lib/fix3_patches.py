#!/usr/bin/env python3
"""fix3 지형·렌더 보정 모음 (v9-final 의 build_final 을 건드리지 않고 fix3_build.py 가 불러 쓴다).

  1) soften_world   장소 밑 사각 패치 제거: 사구 바다 속 섬 둘(사막 신전·사막 폐허)의 발자국을 사구로 되돌리고,
                    숲 속 장소의 직사각 공터는 모서리에 나무를 되심고 바깥 가장자리를 몇 군데 파 불규칙하게 한다.
  2) dune_fx3       사구 후처리 복사본: (a) 메사 칸 둘레의 하얀 사각 능선을 없앤다 (b) 사구 속 섬 장소 둘레 1칸쯤은 마루 무늬를 지워 평평한 모래로 둔다(윤곽은 노이즈로 불규칙).
  3) paste_icon_soft 아이콘 그림자 키 픽셀을 아이콘 칸 가장자리에서 서서히 줄여(베이어 디더, 새 색 없음) 그림자 판의 직선 사각 테두리를 없앤다.
  4) render_ramps_fix3 서쪽 고원의 경사로(이름 「서 고원 …」, 칸 x15~19,y26~33)를 풀밭 위 가는 줄 대신 짧은 2단 계단으로 그린다. 다른 경사로는 옛 그대로.
"""
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'src' / 'journey'))
import make_map_v4 as M4  # noqa: E402
import terrain_v4 as V  # noqa: E402
from boundary_v5 import hash2  # noqa: E402

KEY = (255, 103, 139)
SHADOW_KEY = (254, 103, 139)
SHADOW_MUL = np.array([.64, .70, .82])
DUNE_ISLAND_SITES = ('사막 신전', '사막 폐허')
GROUND_BLOB_SITES = ('설원 마을',)
LOG = {}


def h1(x, y, salt):
    return float(hash2(np.array([x]), np.array([y]), salt)[0])


# ───────────────────────── 1) 지형 보정 ─────────────────────────
def soften_world(M, ic):
    G, O = M.G, M.O
    H, W = G.shape
    log = dict(dune_islands={}, forest_clearings={})
    for n in DUNE_ISLAND_SITES:
        x, y, w, h = ic[n]
        before = sorted({int(v) for v in G[y:y + h, x:x + w].ravel()})
        G[y:y + h, x:x + w] = M4.DUNE
        log['dune_islands'][n] = dict(rect=[x, y, w, h], ground_before=before)
    ys, xs = np.mgrid[0:H, 0:W]
    M.dune_sea = (G == M4.DUNE) & (xs < 40)
    forest_codes = set(V.FORESTS)
    for n, (x, y, w, h) in ic.items():
        if n.endswith('경사로'):
            continue
        # 장소 둘레 2칸 고리의 숲 비율
        ring2 = [(a, b) for b in range(y - 2, y + h + 2) for a in range(x - 2, x + w + 2)
                 if (a < x - 1 or a >= x + w + 1 or b < y - 1 or b >= y + h + 1) and 0 <= a < W and 0 <= b < H]
        frac = sum(1 for a, b in ring2 if int(O[b, a]) in forest_codes) / max(len(ring2), 1)
        if frac < .45:
            continue
        cnt = {}
        for a, b in ring2:
            if int(O[b, a]) in forest_codes:
                cnt[int(O[b, a])] = cnt.get(int(O[b, a]), 0) + 1
        code = max(cnt, key=cnt.get)
        planted, notched = [], []
        for b in range(y - 1, y + h + 1):
            for a in range(x - 1, x + w + 1):
                if x <= a < x + w and y <= b < y + h:
                    continue
                if not (0 <= a < W and 0 <= b < H) or G[b, a] < 10 or int(O[b, a]) in V.MOUNTS or M.RAMP[b, a]:
                    continue
                corner = (a in (x - 1, x + w)) and (b in (y - 1, y + h))
                if int(O[b, a]) == 0 and (corner or h1(a, b, 6101) < .38):
                    O[b, a] = code
                    planted.append((a, b))
        for (a, b) in ring2:
            if 0 <= a < W and 0 <= b < H and int(O[b, a]) == code and h1(a, b, 6102) < .28:
                O[b, a] = 0
                notched.append((a, b))
        log['forest_clearings'][n] = dict(rect=[x, y, w, h], ring_forest_frac=round(frac, 2), planted=len(planted), notched=len(notched))
    log['ground_blobs'] = {}
    for n in GROUND_BLOB_SITES:
        x, y, w, h = ic[n]
        cf = int(G[y, x])
        changed = []
        for b in range(y - 2, y + h + 2):
            for a in range(x - 2, x + w + 2):
                if x <= a < x + w and y <= b < y + h or not (0 <= a < W and 0 <= b < H):
                    continue
                d = max(x - a, a - (x + w - 1), y - b, b - (y + h - 1))
                if int(G[b, a]) != cf and G[b, a] >= 10 and int(G[b, a]) not in (M4.RIVER,) and not M.RAMP[b, a]:
                    if h1(a, b, 6103) < (.7 if d == 1 else .3):
                        changed.append((a, b, int(G[b, a])))
                        G[b, a] = cf
        log['ground_blobs'][n] = dict(rect=[x, y, w, h], code=cf, cells_changed=len(changed), from_codes=sorted({c for _, _, c in changed}))
    LOG.update(log)
    return log


# ───────────────────────── 2) 사구 후처리 ─────────────────────────
def island_mask(M, ic):
    """메사 칸: 사구 바다 지역(x<40, y>=52)에서 사구가 아닌 땅 중 메사 물체가 선 칸."""
    G, O = M.G, M.O
    H, W = G.shape
    ys, xs = np.mgrid[0:H, 0:W]
    return (xs < 40) & (ys >= 52) & (G >= 10) & (G != M4.DUNE) & (O == V.MESA)


def dune_fx3(img, M, ic, dune, rnd, vnoise, mesa=None):
    """journey_fx_v9.apply_dune_fx 복사본. dune: 그리는 사구 칸(메사 칸 포함). 사구 속 섬 장소는 마루 무늬를 지운다."""
    CELL = 16
    img = img.copy()
    H, W = dune.shape
    h, w = H * CELL, W * CELL
    dune_px = np.kron(dune.astype(np.uint8), np.ones((CELL, CELL), np.uint8)).astype(bool)
    Y, X = np.mgrid[0:h, 0:w]
    r, g, b = img[..., 0].astype(int), img[..., 1].astype(int), img[..., 2].astype(int)
    sandy = (r > g) & (g > b) & (r > 150) & ((r - b) > 25)
    nz = vnoise(h, w, 38, 901)
    nz2 = vnoise(h, w, 15, 902)
    u = (X * 0.50 + Y * 1.0) / 11.0 + 2.6 * nz + 0.5 * nz2
    f = u - np.floor(u)
    seg = vnoise(h, w, 52, 903) > 0.36
    # 섬 장소 둘레의 평평한 모래: 발자국 사각에서 픽셀 거리 d < 10 + 12*노이즈 인 곳은 마루·그늘을 그리지 않는다
    flat = np.zeros((h, w), bool)
    fn = vnoise(h, w, 18, 911)
    for n in DUNE_ISLAND_SITES:
        x, y, ww, hh = ic[n]
        x0, y0, x1, y1 = x * CELL, y * CELL, (x + ww) * CELL, (y + hh) * CELL
        dx = np.maximum(np.maximum(x0 - X, X - (x1 - 1)), 0)
        dy = np.maximum(np.maximum(y0 - Y, Y - (y1 - 1)), 0)
        d = np.hypot(dx, dy)
        flat |= d < 8 + 14 * fn
    mesa_px = np.zeros((h, w), bool) if mesa is None else np.kron(mesa.astype(np.uint8), np.ones((CELL, CELL), np.uint8)).astype(bool)
    crest = dune_px & sandy & seg & (f < 0.11) & ~flat & ~mesa_px
    shade = dune_px & sandy & seg & (f >= 0.11) & (f < 0.33) & ~flat & ~mesa_px
    out = img.astype(np.float32)
    out[shade] *= np.array([0.84, 0.81, 0.76], np.float32)
    out[crest] = out[crest] * 0.35 + np.array([255, 246, 214], np.float32) * 0.65
    img = np.clip(out, 0, 255).astype(np.uint8)
    land = (M.G >= 10) & ~dune
    foot = np.zeros((H, W), bool)
    for n, (x, y, ww, hh) in ic.items():
        if n in DUNE_ISLAND_SITES:
            continue
        foot[y:y + hh, x:x + ww] = True
    ridge_dark = np.array([139, 111, 63], np.uint8)
    ridge_light = np.array([255, 240, 196], np.uint8)
    pre_ridge = img.copy()
    for y in range(H):
        for x in range(W):
            if not dune[y, x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, bb = x + dx, y + dy
                if not (0 <= a < W and 0 <= bb < H) or not (land[bb, a] or foot[bb, a]):
                    continue
                x0, y0 = x * CELL, y * CELL
                for t in range(CELL):
                    wob = int(round((rnd(x * 16 + t, y, 905) - .5) * 2.4))
                    if dx:
                        px = x0 + (CELL - 3 if dx > 0 else 0) + wob
                        for k in range(3):
                            xx = px + k
                            if x0 - 1 <= xx < x0 + CELL + 1:
                                img[y0 + t, xx] = ridge_dark
                        lx = px - 1 if dx > 0 else px + 3
                        if 0 <= lx < w:
                            img[y0 + t, lx] = ridge_light
                    else:
                        py = y0 + (CELL - 3 if dy > 0 else 0) + wob
                        for k in range(3):
                            yy = py + k
                            if y0 - 1 <= yy < y0 + CELL + 1:
                                img[yy, x0 + t] = ridge_dark
                        ly = py - 1 if dy > 0 else py + 3
                        if 0 <= ly < h:
                            img[ly, x0 + t] = ridge_light
    img[mesa_px] = pre_ridge[mesa_px]                 # 메사 그림 위로는 능선을 긋지 않는다
    return img


# ───────────────────────── 3) 아이콘 붙이기(부드러운 그림자) ─────────────────────────
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16.0
FADE_PX = 4
BRIGHT_MEAN = 190.0
SHADOW_HUG_PX = 3
SHADOW_STATS = {}


def paste_icon_soft(img, arr, x, y, name=None):
    h, w = arr.shape[0], arr.shape[1]
    dst = img[y * 16:y * 16 + h, x * 16:x * 16 + w]
    key = np.all(arr == np.array(KEY, np.uint8), axis=2)
    shd = np.all(arr == np.array(SHADOW_KEY, np.uint8), axis=2)
    solid = ~key & ~shd
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
    wgt = np.clip(d / float(FADE_PX), 0, 1)
    bright = float(dst.astype(np.float32).mean()) > BRIGHT_MEAN       # 눈 같은 밝은 바닥에서만 그림자 판 테두리가 푸른 사각으로 튄다
    if not bright:
        wgt = np.ones_like(wgt)
    else:
        import scipy.ndimage as ndi
        near = ndi.binary_dilation(solid, structure=np.ones((3, 3), bool), iterations=SHADOW_HUG_PX)
        shd = shd & near                                              # 물체에서 멀리 떨어진 그림자 판은 버린다
    bay = BAYER4[(yy + y * 16) % 4, (xx + x * 16) % 4]
    use = shd & (bay < wgt)
    dst[use] = (dst[use].astype(np.float32) * SHADOW_MUL).astype(np.uint8)
    dst[solid] = arr[solid]
    if name:
        SHADOW_STATS[name] = dict(shadow_px=int(np.all(arr == np.array(SHADOW_KEY, np.uint8), axis=2).sum()), applied=int(use.sum()), bright_ground=bright)


# ───────────────────────── 4) 서쪽 고원 경사로 → 짧은 계단 ─────────────────────────
def _hx(s):
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


STAIR_GROUPS = []
DRAW_STAIRS = False          # 시험 결과: 풀밭 위 3단 줄무늬 띠도 사각 판처럼 읽혀서 서쪽 고원 경사로는 그리지 않는다(길은 그대로)


def render_ramps_fix3(M, img, old_render):
    """x<=20, 24<=y<=34 의 경사로 덩이만 3단 풀 계단으로, 나머지는 old_render 가 그린다.
    원래 바닥 픽셀(풀 질감)을 그대로 쓰고 밝기만 바꾼다: 디딤판 = 윗면(약간 밝게, 맨 앞 1px 더 밝게), 단면 = 앞면(어둡고 갈색 기운), 단면 밑 1px 가장 어둡게.
    덩이 맨 아래와 오른쪽 옆에 접지 그림자. 새 색 팔레트 없음(밝기 배율만)."""
    import scipy.ndimage as ndi
    lab, n = ndi.label(M.RAMP, structure=np.ones((3, 3)))
    west = np.zeros_like(M.RAMP)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if xs.max() <= 20 and 24 <= ys.min() and ys.max() <= 34:
            west |= lab == i
            STAIR_GROUPS.append(dict(cells=sorted((int(a), int(b)) for b, a in zip(ys, xs)), bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]))
    rest = M.RAMP & ~west
    saved = M.RAMP
    M.RAMP = rest
    old_render(M, img)
    M.RAMP = saved
    if not DRAW_STAIRS:
        return img
    H, W = M.RAMP.shape
    K_HI = np.array([1.28, 1.26, 1.18], np.float32)
    K_TR = np.array([1.12, 1.11, 1.06], np.float32)
    K_RI = np.array([.68, .62, .56], np.float32)
    K_DK = np.array([.52, .48, .44], np.float32)
    for g in STAIR_GROUPS:
        cells = set(map(tuple, g['cells']))
        cy0 = min(b for a, b in cells)
        cy1 = max(b for a, b in cells)
        total = (cy1 - cy0 + 1) * 16
        nsteps = 3 if total >= 32 else 2
        step = total / float(nsteps)
        y0 = cy0 * 16
        for (cx, cy) in sorted(cells):
            # 이 칸이 덩이 안에서 가장 아랫줄이면 단 경계를 칸 경계에 맞추려 하지 않는다(연속 배율)
            for ry in range(16):
                py = cy * 16 + ry
                rel = py - y0
                k = min(int(rel / step), nsteps - 1)
                pos = rel - k * step
                if pos < 1.0:
                    kk = K_HI
                elif pos < step * 0.55:
                    kk = K_TR
                elif pos < step - 1.0:
                    kk = K_RI
                else:
                    kk = K_DK
                row = img[py, cx * 16:cx * 16 + 16].astype(np.float32)
                img[py, cx * 16:cx * 16 + 16] = np.clip(row * kk, 0, 255).astype(np.uint8)
            if (cx, cy + 1) not in cells and cy + 1 < H:
                sh = img[(cy + 1) * 16:(cy + 1) * 16 + 5, cx * 16:(cx + 1) * 16]
                sh[:] = (sh.astype(np.float32) * np.array([.74, .72, .78])[None, None, :]).astype(np.uint8)
    return img
