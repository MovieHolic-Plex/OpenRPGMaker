#!/usr/bin/env python3
"""지리 구조 — 문화권을 닮은 땅 모양(실제 지도를 따라 그리지 않고 특징만 살린 생성기). kit_gen.gen_land 가 부른다.

  peninsula        반도(조선): 북쪽 대륙에 매달린 반도, 동쪽으로 치우친 산줄기 척추(백두대간), 서쪽으로 흐르는 강,
                   들쭉날쭉한 서·남해안과 다도해, 남쪽 큰 섬, 동쪽 바다 건너 섬나라 호. count = 다도해 섬 수.
  river-continent  강 문명 대륙(중국·무협): 큰 대륙 하나, 서쪽 고원(설산)·북쪽 사막·남동 습윤,
                   서→동으로 흐르는 큰 강 둘(북쪽 강은 크게 굽는다), 두 강 사이 산맥, 동쪽 바다 섬.
                   2막은 서쪽 관문 너머(서역), 사구 바다는 북쪽 사막. count = 바다 섬 수.
  arc-islands      열도(전국): 비스듬히 휜 긴 본섬 + 북섬·남서섬·남섬, 서쪽 바다 건너 대륙 끝자락, 본섬을 따라 등뼈 산맥. count = 작은 섬 수.

반환 info 에는 땅 모양 말고도 「힌트」가 실린다(kit_gen 이 꺼내 쓴다, 요약 JSON 에는 안 들어간다):
  hint_clim   {t0, t1, temp?, moist?, elev?}   기후 위도 범위(위=t0, 아래=t1)와 더할 장(H,W)
  hint_spines [[(x,y),...]]                    산줄기 척추 — 자동 산줄기보다 먼저, 장소는 비켜 놓인다
  hint_rivers [([(x,y),...], wide)]            이끌린 강 — 바다까지, 장소는 비켜 놓인다
  hint_pole   (x,y)                            산벽(1막/2막 가름)을 우선 시도할 극 — 2막이 그쪽 땅
"""
import math

import numpy as np
import scipy.ndimage as ndi
from scipy.spatial import cKDTree

import make_map_v4 as M4

W, H = M4.W, M4.H


def _kg():
    import kit_gen as KG
    return KG


def _dense(pts, step=.5):
    return np.array(M4.dense([tuple(map(float, p)) for p in pts], step))


def strip(center, half_w, salt, rough_l=.0, rough_r=.0, warp=1.6):
    """가운데 선을 따라 폭이 변하는 땅 띠. half_w(t) -> (왼쪽 반폭, 오른쪽 반폭) — 진행 방향 기준 왼/오른쪽.
    rough_l/r: 그쪽 해안의 잔 들쭉날쭉(칸). 끝은 둥근 마개."""
    KG = _kg()
    P = _dense(center)
    seg = np.diff(P, axis=0)
    L = np.r_[0, np.cumsum(np.hypot(seg[:, 0], seg[:, 1]))]
    tan = np.gradient(P, axis=0)
    tan /= np.maximum(np.hypot(tan[:, 0], tan[:, 1]), 1e-6)[:, None]
    xs, ys = KG._warp(salt, warp, 6.0)
    q = np.stack([xs.ravel(), ys.ravel()], 1)
    _, idx = cKDTree(P).query(q)
    d = q - P[idx]
    along = (d * tan[idx]).sum(1)
    side = tan[idx, 0] * d[:, 1] - tan[idx, 1] * d[:, 0]          # + = 진행 방향 오른쪽(화면 좌표, y 아래)
    t = L[idx] / L[-1]
    hl, hr = half_w(t)
    hl, hr = np.asarray(hl, float) * np.ones_like(t), np.asarray(hr, float) * np.ones_like(t)
    nl = (KG.fbm(2.2, salt + 3, 2).ravel() - .5) * 2 * rough_l + (KG.fbm(6, salt + 4).ravel() - .5) * 1.6
    nr = (KG.fbm(2.2, salt + 5, 2).ravel() - .5) * 2 * rough_r + (KG.fbm(6, salt + 6).ravel() - .5) * 1.6
    inside = np.where(side < 0, -side < hl + nl, side < hr + nr)
    endcap = ((idx == 0) & (along < 0)) | ((idx == len(P) - 1) & (along > 0))
    rad = np.where(idx == 0, (hl + hr) / 2, (hl + hr) / 2)
    capok = np.hypot(d[:, 0], d[:, 1]) < rad + (nl + nr) / 2
    m = np.where(endcap, capok, inside)
    return m.reshape(H, W)


def _sea_dist(land):
    return ndi.distance_transform_edt(land)


def _isle(rng, salt, cx, cy, r, ar=1.0, rot=0.0):
    KG = _kg()
    xs, ys = KG._warp(salt, 1.1, 4.0)
    u = ((xs - cx) * math.cos(rot) + (ys - cy) * math.sin(rot)) / (r * ar)
    v = (-(xs - cx) * math.sin(rot) + (ys - cy) * math.cos(rot)) / (r / ar)
    return np.hypot(u, v) + (KG.fbm(2.5, salt + 2, 2) - .5) * .5 < 1


def scatter_isles(rng, salt, land, n, near, dmin, dmax, rad=(1.6, 2.6), avoid=None):
    """near(마스크) 해안에서 dmin~dmax 칸 바다에 작은 섬 n 개(서로 2칸 이상)."""
    KG = _kg()
    d = ndi.distance_transform_edt(~near)
    dl = ndi.distance_transform_edt(~land)
    ok = ~land & (d >= dmin) & (d <= dmax) & (dl >= dmin)
    if avoid is not None:
        ok &= ~avoid
    ys, xs = np.mgrid[0:H, 0:W]
    ok &= (xs > 4) & (xs < W - 5) & (ys > 4) & (ys < H - 5)
    out = land.copy()
    for k in range(n):
        cy_, cx_ = np.nonzero(ok)
        if not len(cx_):
            break
        j = int(rng.integers(len(cx_)))
        r = rng.uniform(*rad)
        m = _isle(rng, salt + 31 * k, float(cx_[j]), float(cy_[j]), r, rng.uniform(.75, 1.35), rng.uniform(0, math.pi))
        if (m & ndi.binary_dilation(out, iterations=2)).any():
            ok &= ~(np.hypot(xs - cx_[j], ys - cy_[j]) < 2.5)
            continue
        out |= m
        ok &= ndi.distance_transform_edt(~out) > r + 2.5
    return out


def river_to_sea(land, pts):
    """꺾은선을 땅 안에서 시작해 첫 바다 칸에서 끝나게(어귀). 끝이 아직 땅이면 마지막 방향으로 늘린다."""
    P = [tuple(map(float, p)) for p in pts]
    ex, ey = P[-1][0] - P[-2][0], P[-1][1] - P[-2][1]
    n = math.hypot(ex, ey) or 1
    for _ in range(40):
        x, y = int(round(P[-1][0])), int(round(P[-1][1]))
        if not (0 <= x < W and 0 <= y < H) or not land[y, x]:
            break
        P.append((P[-1][0] + ex / n, P[-1][1] + ey / n))
    runs, cur = [], []                         # 땅 위 구간들 — 각 구간은 끝의 바다 칸(어귀)까지. 가장 긴 것을 쓴다(상류가 만을 건너도 강이 사라지지 않게)
    for x, y in _dense(P):
        xi, yi = int(round(x)), int(round(y))
        on = 0 <= xi < W and 0 <= yi < H and land[yi, xi]
        if on:
            cur.append((float(x), float(y)))
        elif cur:
            cur.append((float(x), float(y)))
            runs.append(cur)
            cur = []
    out = max(runs, key=len) if runs else []
    if len(out) < 8:
        return None
    return out[::3] + ([out[-1]] if (len(out) - 1) % 3 else [])


# ───────────────────────────── 반도 (조선) ─────────────────────────────
def peninsula(rng, salt, count, target):
    KG = _kg()
    nx = W * rng.uniform(.47, .55)                  # 목(대륙과 이어지는 곳)
    ny = H * rng.uniform(.30, .34)
    # 1) 북쪽 대륙: 위쪽을 가로지르는 넓은 땅, 서쪽은 아래로 처져 내해(서해)를 두른다
    my = ny - 10 + rng.uniform(-1, 1)
    band = [(11, my + 4), (W * .26, my + rng.uniform(-1.5, 1.5)), (W * .5, my), (W * .74, my + rng.uniform(-2, 1)), (W - 13, my + 2)]
    main = strip(band, lambda t: (6.0 + 1.5 * np.sin(t * 7.0), 7.5 + 2.0 * np.sin(t * 5.0 + 1.0)), salt + 10, 1.6, 2.2, 1.6)
    lobe = [(W * .15, my + 2), (W * .14, my + 9), (W * .16, my + 13)]        # 서쪽으로 조금 처진 땅(서해 북쪽 해안) — 길면 사막 혹이 되어 대륙 띠가 안 읽혔다(적대 QA)
    main |= strip(lobe, lambda t: (4.6 - 1.4 * t, 4.6 - 1.4 * t), salt + 12, 1.4, 1.8, 1.4)
    # 2) 반도: 목에서 남쪽으로, 가운데 선은 살짝 동쪽으로 휜다
    sx = rng.uniform(-2.5, 1.5)
    c = [(nx, ny - 4), (nx + 1.5 + sx, ny + 9), (nx + 1.0 + sx * 1.3, ny + 20), (nx - 1.5 + sx, ny + 29), (nx - 2.5, ny + 35)]
    wid = rng.uniform(7.2, 8.4)

    def hw(t):
        taper = np.clip(1.0 - np.maximum(t - .78, 0) * 2.2, .45, 1)
        return (wid * 1.05 * taper, wid * .78 * taper)  # (서쪽 반폭, 동쪽 반폭): 진행 방향(남) 기준 오른쪽 = 서쪽

    pen = strip(c, lambda t: hw(t)[::-1], salt + 20, rough_l=.6, rough_r=2.4, warp=1.2)   # 왼쪽(동) 매끈, 오른쪽(서) 들쭉날쭉
    home = KG.clean_land(main | pen, 40, 20)
    lab, n = KG.comps(home)
    if n > 1:
        sz = ndi.sum(home, lab, range(1, n + 1))
        home = lab == (int(np.argmax(sz)) + 1)
    land = home.copy()
    # 3) 남쪽 큰 섬(탐라) + 다도해(서·남해안 앞)
    P = _dense(c)
    tip = P[-1]
    jx, jy = tip[0] + rng.uniform(-3, 1), min(tip[1] + rng.uniform(7.5, 9.0), H - 7)
    isl = _isle(rng, salt + 40, jx, jy, rng.uniform(2.8, 3.4), 1.45, rng.uniform(-.2, .2))
    if not (isl & ndi.binary_dilation(land, iterations=4)).any():
        land |= isl
    ys, xs = np.mgrid[0:H, 0:W]
    pen_cells = pen & home & (ys > ny + 4)
    side_w = pen_cells & (xs < np.interp(ys, P[:, 1], P[:, 0]))
    south = pen_cells & (ys > P[-1][1] - 9)
    land = scatter_isles(rng, salt + 50, land, count, side_w | south, 5.0, 9.5, (2.0, 2.8))
    # 4) 동쪽 바다 건너 섬나라 호(셋): 북동 → 남동으로 휜다
    # 반도와 나란한 두 번째 반도처럼 보이지 않게(적대 QA): 더 멀리, 북동에서 남서로 비스듬히, 가늘게, 네 조각
    ex = min(W - 8, P[:, 0].max() + rng.uniform(22, 26))
    arc = [(ex + 1, ny + 2), (ex - 2, ny + 13), (ex - 9, ny + 24), (P[-1][0] + rng.uniform(13, 16), H - 8)]
    A = _dense(arc)
    cut = sorted([rng.uniform(.18, .26), rng.uniform(.50, .60), rng.uniform(.78, .86)])
    Lc = np.r_[0, np.cumsum(np.hypot(*np.diff(A, axis=0).T))]
    tt = Lc / Lc[-1]
    for k, (a, b) in enumerate(zip([0] + cut, cut + [1])):
        part = A[(tt >= a + .04) & (tt <= b - .04)]
        if len(part) < 4:
            continue
        r_ = (2.4, 3.2, 2.8, 2.2)[k]
        m = strip(part[::2].tolist(), lambda t, r_=r_: (r_ * np.clip(1.2 - np.abs(t - .5) * 1.0, .5, 1),) * 2, salt + 70 + k, 1.0, 1.0, 1.0)
        m &= ndi.distance_transform_edt(~home) > 8
        land |= m
    land = KG.clean_land(land)
    # 힌트: 척추(동쪽으로 치우침), 백두산(목 북쪽 눈 봉우리), 서쪽으로 흐르는 강, 목의 두 강(서·동)
    def at(t, s):
        i = int(t * (len(P) - 1))
        tx, ty = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]
        nrm = math.hypot(tx, ty) or 1
        return (P[i][0] + ty / nrm * s, P[i][1] - tx / nrm * s)        # s>0 = 동쪽(남쪽으로 내려가는 진행 방향의 왼쪽)

    spine = [at(t, wid * .42) for t in (.12, .3, .5, .66, .8)]
    baek = [(nx - 3, ny - 8), (nx + 1, ny - 7.5), (nx + 5, ny - 8.5)]
    rivers = []
    for t in (.22, .44, .62):
        s0 = at(t, wid * .2)
        rivers.append(([s0, at(t + .03, -wid * .4), at(t + .05, -wid * 1.4)], .55))
    rivers.append(([at(.68, wid * .25), at(.8, wid * .3), at(.95, wid * .2), (tip[0] + 1, tip[1] + 4)], .5))   # 남쪽으로 흐르는 큰 강
    rivers.append(([(nx - 2, ny - 6), (nx - 9, ny - 3.5), (nx - 16, ny - 2)], .6))     # 목의 서쪽 강
    rivers.append(([(nx + 3, ny - 6), (nx + 9, ny - 3.5), (nx + 15, ny - 1.5)], .7))     # 목의 동쪽 강
    info = dict(home=(nx, ny + 10), hint_clim=dict(t0=.15, t1=.67, elev=_spine_elev([spine, baek], 5.5) * .35),
                hint_spines=[spine, baek], hint_rivers=rivers, hint_pole=(int(W * .5), 2),
                hint_dune=(int(W * .14), int(my + 12)))
    return land, info


def _spine_elev(lines, r):
    m = np.zeros((H, W), bool)
    for ln in lines:
        for x, y in _dense(ln):
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < W and 0 <= yi < H:
                m[yi, xi] = True
    if not m.any():
        return np.zeros((H, W))
    return np.clip(1 - ndi.distance_transform_edt(~m) / r, 0, 1)


# ───────────────────────────── 강 문명 대륙 (중국·무협) ─────────────────────────────
def river_continent(rng, salt, count, target):
    KG = _kg()
    main_share = .80
    c = (W * .50 + rng.uniform(-2, 2), H * .50 + rng.uniform(-2, 2))
    f, _ = KG._plates(rng, salt, [c, (W * .30, H * .42), (W * .66, H * .62)], [target * main_share * .62, target * main_share * .25, target * main_share * .22],
                      [1.35, 1.1, 1.0], 4.2, .8, lobes=(2, 3))
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    bay = (KG.fbm(5, salt + 90) - .5) * .7 * np.clip((xs - W * .55) / (W * .3), 0, 1)     # 만은 동쪽 해안에만
    f = f + bay
    main = f < KG._bisect(f, target * main_share)
    main = KG.clean_land(main, 40, 30)
    lab, n = KG.comps(main)
    if n > 1:
        sz = ndi.sum(main, lab, range(1, n + 1))
        main = lab == (int(np.argmax(sz)) + 1)
    land = main.copy()
    ys_, xs_ = np.nonzero(main)
    x0, x1, y0, y1 = xs_.min(), xs_.max(), ys_.min(), ys_.max()

    def P(u, v):
        return (x0 + (x1 - x0) * u, y0 + (y1 - y0) * v)

    # 동쪽 바다 섬: 남동의 큰 섬 + 남쪽 섬 + 작은 섬들
    dm = ndi.distance_transform_edt(~main)
    for k, (u, v, r, ar) in enumerate([(1.0, .78, 3.4, .55), (.66, 1.0, 3.0, 1.5)]):
        cx_, cy_ = P(u, v)
        best = None
        for step in range(30):
            ccx, ccy = cx_ + (step * .7 if k == 0 else 0), cy_ + (step * .7 if k == 1 else 0)
            m = _isle(rng, salt + 110 + k, ccx, ccy, r, ar, rng.uniform(-.3, .3))
            if not (m & (dm <= 6)).any() and m.sum() >= 18:
                best = m
                break
        if best is not None:
            land |= best
    east = main & (xs > x0 + (x1 - x0) * .62)
    land = scatter_isles(rng, salt + 130, land, count, east, 5.5, 11, (2.0, 3.2))
    land = KG.clean_land(land)
    # 힌트: 북쪽 큰 강(크게 북쪽으로 굽는 고리) · 남쪽 큰 강(굽이치며 동으로) · 두 강 사이 산맥 · 서쪽 고원 둘레 산 · 북쪽 장성(산벽 극)
    ry = rng.uniform(-.03, .03)
    yellow = [P(.20, .48 + ry), P(.30, .44 + ry), P(.38, .32 + ry), P(.48, .30 + ry), P(.53, .42 + ry), P(.66, .45 + ry), P(.82, .41 + ry), P(1.05, .40 + ry)]
    yangtze = [P(.12, .68), P(.26, .74), P(.36, .67), P(.46, .73), P(.58, .66), P(.72, .70), P(.86, .63), P(1.05, .63)]
    rivers = [(yellow, .25), (yangtze, .2)]
    qinling = [P(.26, .58), P(.37, .57), P(.48, .56), P(.58, .55)]
    plateau = [P(.05, .45), P(.10, .62), P(.14, .78), P(.28, .88)]
    taihang = [P(.60, .14), P(.62, .26)]
    wx = np.clip(1 - (xs - x0) / ((x1 - x0) * .32), 0, 1)                     # 서쪽 고원 0..1
    north = np.clip(1 - (ys - y0) / ((y1 - y0) * .45), 0, 1)
    moist = .32 * (xs - x0) / max(x1 - x0, 1) + .18 * (ys - y0) / max(y1 - y0, 1) - .35 * wx * north - .30 * north - .08
    elev = wx ** 1.4 * .45
    temp = -wx ** 1.3 * .32
    info = dict(home=c, hint_clim=dict(t0=.26, t1=.98, temp=temp, moist=moist, elev=elev, glacier=False),   # 고원은 설산·툰드라(빙판이면 얼음 호수로 읽혔다)
                hint_spines=[qinling, plateau, taihang], hint_rivers=rivers, hint_pole=tuple(int(v) for v in P(.0, .18)),         # 2막 = 북서 관문(옥문관) 너머 서역 — 강 상류(서남 고원)는 1막 쪽
                hint_dune=tuple(int(v) for v in P(.58, .0)))          # 사구 바다 = 북쪽 큰 사막
    return land, info


# ───────────────────────────── 열도 (전국) ─────────────────────────────
def arc_islands(rng, salt, count, target):
    KG = _kg()
    a = rng.uniform(-2, 2)
    honshu = [(W * .26 + a, H * .84), (W * .42 + a, H * .70), (W * .58 + a, H * .58), (W * .66 + a, H * .42), (W * .70 + a, H * .22)]
    wid = rng.uniform(7.4, 8.4)

    def hw(t):
        bulge = 1 + .25 * np.exp(-((t - .55) / .18) ** 2)
        taper = np.clip(1.15 - np.abs(t - .5) * .7, .55, 1) * np.clip(.62 + t * 1.1, .62, 1)   # 남서 끝은 가늘게(뭉툭한 덩이로 읽혔다)
        return (wid * bulge * taper * .95, wid * bulge * taper * .95)

    home = strip(honshu, hw, salt + 10, 1.4, 1.6, 1.4)
    home = KG.clean_land(home, 40, 20)
    land = home.copy()
    hd = ndi.distance_transform_edt(~home)
    parts = [  # (가운데 선, 반폭, 이름)
        ([(W * .73 + a, H * .13), (W * .82 + a, H * .07)], 5.4),             # 북섬
        ([(W * .14 + a, H * .82), (W * .17 + a, H * .94)], 3.6),             # 남서섬
        ([(W * .37 + a, H * .95), (W * .48 + a, H * .90)], 2.6),             # 남섬
    ]
    for k, (ln, r) in enumerate(parts):
        best = None
        for push in range(0, 12):
            dx, dy = (push * .6, -push * .4) if k == 0 else ((-push * .6, push * .2) if k == 1 else (push * .2, push * .5))
            ln2 = [(x + dx, y + dy) for x, y in ln]
            m = strip(ln2, lambda t, r=r: (r * np.clip(1.2 - np.abs(t - .5), .6, 1),) * 2, salt + 30 + k, 1.0, 1.0, 1.0)
            m &= np.mgrid[0:H, 0:W][0] < H - 2
            if not (m & (hd <= 5.0)).any() and m.sum() >= 14:
                best = m
                break
        if best is not None:
            land |= best
    # 서쪽 대륙 해안(바다 건너 큰 나라의 끝자락)
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    cont = strip([(W * .09, H * .10), (W * .10, H * .30), (W * .08, H * .52)],
                 lambda t: (4.6 + 1.6 * np.sin(t * 3.1), 4.0 + 2.0 * np.sin(t * 3.1)), salt + 60, 1.2, 2.4, 1.8)
    cont |= strip([(W * .12, H * .32), (W * .19, H * .42), (W * .20, H * .52)], lambda t: (2.6 - t, 2.6 - t), salt + 62, 1.0, 1.4, 1.0)   # 반도 끝자락
    cont &= (ndi.distance_transform_edt(~home) > 9) & (xs > 2)
    land |= cont
    land = scatter_isles(rng, salt + 80, land, count, home, 5.0, 9.0, (2.0, 2.7))
    land = KG.clean_land(land)
    spine = [honshu[0], honshu[1], honshu[2], honshu[3], honshu[4]]
    spine = [(x + 1.0, y) for x, y in spine]
    P = _dense(honshu)
    rivers = []
    for t in (.3, .55, .8):
        i = int(t * (len(P) - 1))
        tx, ty = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]
        nrm = math.hypot(tx, ty) or 1
        nxv, nyv = -ty / nrm, tx / nrm
        s = 1 if rng.uniform() < .5 else -1
        rivers.append(([(P[i][0] + nxv * 1.5 * s, P[i][1] + nyv * 1.5 * s), (P[i][0] + nxv * wid * 1.5 * s, P[i][1] + nyv * wid * 1.5 * s)], .6))
    info = dict(home=tuple(P[len(P) // 2]), hint_clim=dict(t0=.0, t1=.78, elev=_spine_elev([spine], 4.0) * .3),
                hint_spines=[spine[:3], spine[2:]], hint_rivers=rivers, hint_pole=tuple(int(v) for v in honshu[-1]))
    return land, info


STYLES = {'peninsula': peninsula, 'river-continent': river_continent, 'arc-islands': arc_islands}
DEFAULT = {'peninsula': dict(count=10, land=.40), 'river-continent': dict(count=4, land=.52), 'arc-islands': dict(count=6, land=.36)}
