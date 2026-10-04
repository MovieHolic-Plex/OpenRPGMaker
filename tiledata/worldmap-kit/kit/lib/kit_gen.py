#!/usr/bin/env python3
"""생성 지형 — 빈 판(96x72칸)에 대륙 구조를 새로 만든다. 지형 편집 `base: "generate"` 가 부른다.

  continents  {style, count, land, seed}   땅 마스크(칸). style:
                blobs        덩이 대륙 count 개(첫 덩이가 시작 대륙으로 가장 크다)
                shards       큰 대륙 하나가 금(해협)으로 count 조각 난 것 — 「20조각 대륙」
                ring         가운데 바다를 두른 고리 대륙(count 개 호로 끊김, 1 이면 닫힌 고리 + 안쪽 섬)
                pangaea      초대륙 하나 + 바깥 섬 count-1 개
                archipelago  작은 섬 count 개 + 시작 섬
                galaxy       우주 — 성계(둥근 거품)와 회랑, 깊은 공허(바다 칸), 소행성대
                peninsula    반도(조선) — 북쪽 대륙에 매달린 반도, 동쪽 척추 산줄기, 서해 다도해, 동쪽 섬나라 호   (kit_geo)
                river-continent  강 문명 대륙(중국·무협) — 서쪽 고원·북서 사막, 서→동 큰 강 둘, 북쪽 장성 쪽 2막 (kit_geo)
                arc-islands  열도(전국) — 비스듬히 휜 긴 본섬과 북·남서·남 섬, 서쪽 끝 대륙 해안        (kit_geo)
  climate     {seed, wet, cold}            위도·해안 거리·습도로 바닥(휘태커 표)을 칠한다
그 다음 kit_fit 이 여정(5막)을 이 땅에 맞추고, features() 가 배치를 피해 산줄기·고개·강·숲·밭·화산을 놓는다.
결과는 make_map_v4 의 GEN·목록으로 넘어가 손 대륙과 같은 렌더를 탄다. 모든 무작위는 seed 로 결정된다.
"""
import math

import numpy as np
import scipy.ndimage as ndi

import make_map_v4 as M4

W, H = M4.W, M4.H
STYLES = ('blobs', 'shards', 'ring', 'pangaea', 'archipelago', 'galaxy', 'peninsula', 'river-continent', 'arc-islands', 'korea', 'real')
DEFAULT = {'blobs': dict(count=4, land=.42), 'shards': dict(count=12, land=.44), 'ring': dict(count=3, land=.40),
           'pangaea': dict(count=6, land=.50), 'archipelago': dict(count=24, land=.36), 'galaxy': dict(count=12, land=.36),
           'peninsula': dict(count=10, land=.40), 'river-continent': dict(count=4, land=.52), 'arc-islands': dict(count=6, land=.36),
           'korea': dict(count=0, land=.40), 'real': dict(count=0, land=.40)}
GEO = ('peninsula', 'river-continent', 'arc-islands', 'korea', 'real')   # 지리 구조: 땅 모양이 정해져 있고 land 는 섬·바다 몫만 조금 바꾼다
HOME_GAP = 4.6          # 시작 대륙과 다른 땅 사이 바다(배 장벽 4칸 이상)
GAP = 2.2               # 다른 땅끼리


EDGE_LAND = [False]


class GenError(ValueError):
    pass


def fbm(scale, salt, octaves=3):
    """부드러운 다층 노이즈(대략 0..1, 평균 .5)."""
    a, tot, out = 1.0, 0.0, 0.0
    for k in range(octaves):
        out = out + a * M4.vn(scale / (2 ** k), salt + 17 * k)
        tot += a
        a *= .5
    return out / tot


def _norm(f):
    lo, hi = np.percentile(f, 1), np.percentile(f, 99)
    return np.clip((f - lo) / max(hi - lo, 1e-6), 0, 1)


def comps(mask, conn=4):
    st = ndi.generate_binary_structure(2, 1 if conn == 4 else 2)
    lab, n = ndi.label(mask, structure=st)
    return lab, n


def clean_land(land, min_land=10, min_lake=8):
    land = land.copy()
    lab, n = comps(land)
    if n:
        sz = ndi.sum(land, lab, range(1, n + 1))
        for i, s in enumerate(sz):
            if s < min_land:
                land[lab == i + 1] = False
    lab, n = comps(~land)
    if n:
        sz = ndi.sum(~land, lab, range(1, n + 1))
        for i, s in enumerate(sz):
            if s < min_lake:
                land[lab == i + 1] = True
    if not EDGE_LAND[0]:                             # 실제 지리 실루엣(korea)은 대륙이 지도 밖으로 이어진다
        land[0, :] = land[-1, :] = False                 # 지도 끝 한 줄은 바다(섬이 잘려 보이지 않게)
        land[:, 0] = land[:, -1] = False
    return land


def _bisect(field, target, lo=-3.0, hi=3.0, it=40):
    """field < t 인 칸 수가 target 이 되는 t."""
    for _ in range(it):
        mid = (lo + hi) / 2
        if (field < mid).sum() < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _separate(land, owner, order, home_gap=HOME_GAP, gap=GAP):
    """덩이(owner)를 order 순서로 자리 잡게 하고, 시작 덩이(order[0])에서 home_gap, 다른 덩이끼리 gap 안쪽 칸을 바다로 — 해협이 생긴다."""
    order = list(order)
    hm = land & (owner == order[0])
    dh = ndi.distance_transform_edt(~hm) if hm.any() else np.full((H, W), 99.0)
    out = hm.copy()
    others = np.zeros((H, W), bool)
    for i in order[1:]:
        m = land & (owner == i) & (dh > home_gap)
        if gap > 0 and others.any():
            m &= ndi.distance_transform_edt(~others) > gap
        out |= m
        others |= m
    return out


def _poisson(rng, n, rmin, box, tries=60, first=None):
    pts = [first] if first else []
    x0, y0, x1, y1 = box
    while len(pts) < n:
        best, bd = None, -1
        for _ in range(tries):
            p = (rng.uniform(x0, x1), rng.uniform(y0, y1))
            d = min((math.hypot(p[0] - q[0], p[1] - q[1]) for q in pts), default=1e9)
            if d > bd:
                best, bd = p, d
        pts.append(best)
        if bd < rmin * .35 and len(pts) > n * .7:
            break
    return pts


def _warp(salt, amp, scale=7.0):
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    dx = (fbm(scale, salt) - .5) * 2 * amp
    dy = (fbm(scale, salt + 5) - .5) * 2 * amp
    return xs + dx, ys + dy


# ───────────────────────────── 대륙 구조 ─────────────────────────────
def gen_land(style='blobs', count=None, land=None, seed=1, box=None, region=None, home=None, beyond=None, sands=None):
    """땅 마스크와 정보. 시작 대륙은 늘 가장 큰 덩이. box·region 은 style real(실제 지리)에만."""
    if style not in STYLES:
        raise GenError('continents style 은 %s' % ' | '.join(STYLES))
    d = DEFAULT[style]
    count = int(count if count is not None else d['count'])
    land = float(land if land is not None else d['land'])
    if not (0 if d['count'] == 0 else 1) <= count <= 40:
        raise GenError('continents count 는 1~40')
    if not .2 <= land <= .7:
        raise GenError('continents land(땅 비율)는 0.2~0.7')
    EDGE_LAND[0] = False
    rng = np.random.default_rng(int(seed) * 7919 + STYLES.index(style))
    salt = 3000 + (int(seed) * 131) % 90000
    target = land * W * H
    if style == 'real':
        import kit_realgeo as KReal
        fn = lambda r, s, c, t: KReal.real(r, s, c, t, box=box, region=region, home=home, beyond=beyond, sands=sands)
    elif style in GEO:
        import kit_geo as KGeo
        fn = KGeo.STYLES[style]
    else:
        fn = {'blobs': _blobs, 'shards': _shards, 'ring': _ring, 'pangaea': _pangaea, 'archipelago': _archipelago, 'galaxy': _galaxy}[style]
    try:
        m, info = fn(rng, salt, count, target)
    except ValueError as e:                          # kit_realgeo.RealGeoError — 범위가 바다뿐·땅뿐·너무 좁음
        if style != 'real':
            raise
        raise GenError(str(e))
    EDGE_LAND[0] = bool(info.get('edge_land'))
    m = clean_land(m)
    if style != 'galaxy':                            # 배로 갈 땅(3막)이 모자라면 바깥 섬을 띄운다 — 「대륙 하나」도 여정이 서게
        lab, n = comps(m)
        if n:
            sz = ndi.sum(m, lab, range(1, n + 1))
            home = lab == (int(np.argmax(sz)) + 1)
            other = int((m & ~home).sum())
            need = .04 * W * H if style == 'real' else (.15 if style in GEO else .24) * target   # 실제 지리는 가짜 섬을 거의 안 띄운다 — 배로 갈 땅이 정말 없을 때만
            if other < need:   # 지리 구조는 제 섬을 갖고 있다 — 큰 섬을 덧대면 모양이 안 읽혔다(적대 QA)
                m = clean_land(_add_islands(rng, salt + 500, m, home, .30 * target - other, 5))
                info['islands_added'] = 5
    lab, n = comps(m)
    info.update(style=style, count=count, land=round(land, 3), seed=int(seed), landmasses=int(n),
                land_cells=int(m.sum()))
    return m, info


def _edge_pen(m=5.0):
    """지도 끝에 가까울수록 커지는 벌점 — 대륙이 지도 끝에서 곧게 잘리지 않게."""
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    d = np.minimum(np.minimum(xs, W - 1 - xs), np.minimum(ys, H - 1 - ys))
    return np.clip((m - d) / m, 0, 1) ** 1.5 * 1.6


def _plates(rng, salt, centers, areas, aspect, warp_amp, rough, lobes=(2, 3)):
    """덩이마다 타원 2~3개(엽)의 합 — 둥근 원판 대신 굽은 대륙. 반환: 정규화 거리(작을수록 안쪽) + 노이즈, 덩이 번호."""
    xs, ys = _warp(salt, warp_amp, 10.0)
    xs2, ys2 = _warp(salt + 9, warp_amp * .35, 3.5)
    xs, ys = xs + (xs2 - np.mgrid[0:H, 0:W][1]), ys + (ys2 - np.mgrid[0:H, 0:W][0])
    best = np.full((H, W), 9e9)
    owner = np.full((H, W), -1, int)
    fields = []
    for i, ((cx, cy), A) in enumerate(zip(centers, areas)):
        r = math.sqrt(A / math.pi)
        nl = int(rng.integers(lobes[0], lobes[1] + 1)) if r > 5 else 1
        th = rng.uniform(0, math.pi)
        e = np.full((H, W), 9e9)
        for k in range(nl):
            if k == 0:
                lx, ly, rr = cx, cy, r * (.82 if nl > 1 else 1)
            else:
                a_ = rng.uniform(0, 2 * math.pi)
                dd = r * rng.uniform(.45, .75)
                lx, ly, rr = cx + math.cos(a_) * dd, cy + math.sin(a_) * dd, r * rng.uniform(.45, .7)
            a = aspect[i] * rng.uniform(.85, 1.15)
            t2 = th + rng.uniform(-.5, .5)
            u = ((xs - lx) * math.cos(t2) + (ys - ly) * math.sin(t2)) / (rr * a)
            v = (-(xs - lx) * math.sin(t2) + (ys - ly) * math.cos(t2)) / (rr / a)
            e = np.minimum(e, np.sqrt(u * u + v * v))
        fields.append(e)
        better = e < best
        best[better] = e[better]
        owner[better] = i
    nz = (fbm(9, salt + 40) - .5) * rough + (fbm(3.2, salt + 41) - .5) * rough * .6 + (fbm(1.6, salt + 42, 1) - .5) * rough * .3
    pen = _edge_pen()
    _plates.fields = [f + nz + pen for f in fields]
    return best + nz + pen, owner


def _settle(fields, t, home_gap=HOME_GAP, gap=GAP):
    """덩이를 차례로 자리 잡게 한다 — 덩이마다 제 모양 그대로(보로노이 경계로 자르지 않는다), 앞 덩이 해안에서 gap 안쪽만 바다로.
    그래서 해협이 늘 앞 덩이 해안선을 따라 굽는다(곧은 이등분선 해안 금지)."""
    out = np.zeros((H, W), bool)
    home = None
    others = np.zeros((H, W), bool)
    for i, f in enumerate(fields):
        m = (f < t) & ~out
        if i == 0:
            home = m
            dh = ndi.distance_transform_edt(~home) if home.any() else np.full((H, W), 99.0)
        else:
            m &= dh > home_gap
            if gap > 0 and others.any():
                m &= ndi.distance_transform_edt(~others) > gap
            others |= m
        out |= m
    return out


def _blobs(rng, salt, count, target):
    if count == 1:
        share = [1.0]
    else:
        home = max(.34, 1.6 / count)
        rest = rng.uniform(.5, 1.5, count - 1)
        share = [home] + list(rest / rest.sum() * (1 - home))
    areas = [s * target for s in share]
    rmin = math.sqrt(target / count / math.pi) * 1.6
    home_c = (rng.uniform(W * .3, W * .7), rng.uniform(H * .32, H * .68))
    centers = _poisson(rng, count, rmin, (W * .1, H * .12, W * .9, H * .88), first=home_c)
    while len(centers) < count:
        centers.append((rng.uniform(8, W - 8), rng.uniform(8, H - 8)))
    aspect = [rng.uniform(.75, 1.35) for _ in range(count)]
    f, owner = _plates(rng, salt, centers, areas, aspect, 3.6, .75)
    t = _bisect(f, target * 1.10)
    land = _settle(_plates.fields, t)
    return land, dict(home=home_c)


def _shards(rng, salt, count, target):
    # 1) 큰 대륙(금 낼 몫까지 조금 크게)
    c = (rng.uniform(W * .4, W * .6), rng.uniform(H * .42, H * .58))
    f, _ = _plates(rng, salt, [c], [target * 1.25], [rng.uniform(1.1, 1.4)], 4.5, .9, lobes=(3, 4))
    base = f < _bisect(f, target * 1.25)
    base = clean_land(base, 30, 30)
    # 2) 금: 조각 씨앗 count 개, 시작 조각은 가중치가 커서 넓다(힘 도표)
    cells = np.argwhere(base)
    if count == 1:
        return base, dict(home=c)
    idx = rng.choice(len(cells), size=min(count * 30, len(cells)), replace=False)
    cand = [(float(cells[k][1]), float(cells[k][0])) for k in idx]
    rmin = math.sqrt(base.sum() / count / math.pi) * 1.5
    seeds = [min(cand, key=lambda p: math.hypot(p[0] - c[0], p[1] - c[1]))]
    while len(seeds) < count:
        p = max(cand, key=lambda p: min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in seeds) + rng.uniform(0, 2))
        seeds.append(p)
    # 금은 거의 곧게(깨진 판처럼 — 적대 QA: 둥근 덩이 군도와 구별이 안 됐다), 시작 조각도 판의 한 조각 크기에 가깝게
    xs, ys = _warp(salt + 60, .7, 5.0)
    jx = (fbm(1.9, salt + 62) - .5) * .5
    ys = ys + (fbm(1.9, salt + 63) - .5) * .5
    home_w = (math.sqrt(base.sum() * (.20 if count <= 20 else .28) / math.pi)) ** 2 * .9   # 조각이 많으면 시작 조각 몫을 키운다(수도 6x6·1막 장소 자리)
    best = np.full((H, W), 9e9)
    owner = np.full((H, W), -1, int)
    for i, (sx, sy) in enumerate(seeds):
        w_ = home_w if i == 0 else rng.uniform(0, rmin * rmin * .25)
        e = (xs + jx - sx) ** 2 + (ys - sy) ** 2 - w_
        better = e < best
        best[better] = e[better]
        owner[better] = i
    owner[~base] = -1
    # 금 폭: 조각 경계에서 1~2.5칸(노이즈), 시작 조각과는 배 장벽 폭
    crack = np.zeros((H, W), bool)
    cw = 1.25 + .6 * fbm(5, salt + 70)                    # 금 폭 1.2~1.9칸 — 이웃 조각 해안이 서로 맞물려 보이게
    for i in range(count):
        mi = owner == i
        if not mi.any():
            continue
        d = ndi.distance_transform_edt(~((owner >= 0) & (owner != i)))
        crack |= mi & (d <= cw * .5 + .5)
    land = base & ~crack
    land = _separate(land, owner, range(count), gap=0)
    return land, dict(home=seeds[0])


def _ring(rng, salt, count, target):
    cx, cy = W / 2 + rng.uniform(-4, 4), H / 2 + rng.uniform(-3, 3)
    xs, ys = _warp(salt, 2.4)
    rx, ry = W * .45, H * .44
    r = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    nz = (fbm(8, salt + 44) - .5) * .30 + (fbm(3, salt + 45) - .5) * .12
    nz = nz + _edge_pen(4.0) * .5
    outer = r + nz < .97
    rr = r + nz
    # 안쪽 반지름: 땅 칸이 target 이 되게
    lo, hi = .1, .95
    for _ in range(30):
        mid = (lo + hi) / 2
        if (outer & (rr > mid)).sum() > target:
            lo = mid
        else:
            hi = mid
    land = outer & (rr > lo)
    ang = np.arctan2((ys - cy) / ry, (xs - cx) / rx)
    owner = np.zeros((H, W), int)
    if count >= 2:
        # 끊는 각: 시작 호(0)가 둘레의 약 40%
        a0 = rng.uniform(-math.pi, math.pi)
        cuts = [a0, a0 + 2 * math.pi * .40]
        rest = sorted(rng.uniform(0, 1, count - 2))
        for u in rest:
            cuts.append(a0 + 2 * math.pi * (.40 + .60 * u))
        cuts = sorted(c % (2 * math.pi) for c in cuts)
        A = ang % (2 * math.pi)
        sec = np.searchsorted(cuts, A) % count
        owner = sec
        # 시작 호 = 가장 긴 호
        span = [(cuts[(k + 1) % count] - cuts[k]) % (2 * math.pi) for k in range(count)]
        home_sec = (int(np.argmax(span)) + 1) % count
        order = [home_sec] + [k for k in range(count) if k != home_sec]
        land = _separate(land, owner, order, gap=HOME_GAP)
    else:
        home_sec = 0
    # 안쪽 바다의 섬(닫힌 고리면 배가 갈 땅이 여기뿐이다)
    n_in = 3 if count == 1 else 1
    inner = ~land & (r < lo - .12)
    ys_, xs_ = np.nonzero(inner)
    isl = np.zeros((H, W), bool)
    if len(xs_):
        for k in range(n_in):
            j = rng.integers(len(xs_))
            ex = (fbm(3, salt + 80 + k) - .5) * 1.4
            rad = rng.uniform(4.0, 6.5) if count == 1 else rng.uniform(3.0, 4.5)
            isl |= (np.hypot(xs - xs_[j], (ys - ys_[j]) * 1.15) + ex * 2) < rad
    isl &= ~land
    d = ndi.distance_transform_edt(~land)
    isl &= d > HOME_GAP
    land |= isl
    ys2, xs2 = np.nonzero(land & (owner == home_sec))
    home = (float(xs2.mean()), float(ys2.mean())) if len(xs2) else (cx, cy)
    return land, dict(home=home)


def _pangaea(rng, salt, count, target):
    c = (W / 2 + rng.uniform(-6, 6), H / 2 + rng.uniform(-4, 4))
    main_share = .78 if count > 1 else 1.0
    f, _ = _plates(rng, salt, [c], [target * main_share], [rng.uniform(1.15, 1.35)], 5.5, 1.1, lobes=(3, 4))
    # 깊은 만: 낮은 진동수 노이즈로 바다를 깊이 파고든다
    bay = (fbm(6, salt + 90) - .5) * 1.1
    main = (f + bay) < _bisect(f + bay, target * main_share)
    main = clean_land(main, 40, 30)
    lab, n = comps(main)
    if n > 1:
        sz = ndi.sum(main, lab, range(1, n + 1))
        main = lab == (int(np.argmax(sz)) + 1)
    land = main.copy()
    if count > 1:
        land = _add_islands(rng, salt + 95, land, main, target * (1 - main_share), count - 1)
    return land, dict(home=c)


def _add_islands(rng, salt, land, home, area, n):
    """바다에 섬 n 개(합 area 칸)를 띄운다 — 시작 대륙에서 배 장벽 폭 이상, 지도 끝에서 반지름+2칸 안쪽."""
    land = land.copy()
    d = ndi.distance_transform_edt(~land)
    dh = ndi.distance_transform_edt(~home)
    ys, xs = np.mgrid[0:H, 0:W]
    rad0 = math.sqrt(area / n / math.pi) * 1.25 + 2
    sea = ~land & (dh > HOME_GAP + 3) & (d > GAP + 2)
    ys_, xs_ = np.nonzero(sea & (xs > rad0) & (xs < W - 1 - rad0) & (ys > rad0) & (ys < H - 1 - rad0))
    placed = []
    for k in range(n):
        if not len(xs_):
            break
        cand = rng.choice(len(xs_), size=min(60, len(xs_)), replace=False)
        j = max(cand, key=lambda j: min([math.hypot(xs_[j] - p[0], ys_[j] - p[1]) for p in placed] or [99]) + d[ys_[j], xs_[j]] * .3)
        placed.append((xs_[j], ys_[j]))
        rad = math.sqrt(area / n / math.pi) * rng.uniform(.8, 1.25)
        ar = rng.uniform(.75, 1.35)
        isl = blob_mask(float(xs_[j]), float(ys_[j]), rad * ar, rad / ar, salt + k, 1.1)
        isl &= (dh > HOME_GAP) & (ndi.distance_transform_edt(~(land & ~home)) > GAP) if (land & ~home).any() else (dh > HOME_GAP)
        land |= isl
    return land


def _archipelago(rng, salt, count, target):
    home = .33
    sec = .13 if count >= 4 else 0
    rest = rng.uniform(.4, 1.6, max(count - (2 if sec else 1), 0))
    share = [home] + ([sec] if sec else []) + list(rest / max(rest.sum(), 1e-6) * (1 - home - sec))
    count = len(share)
    areas = [s * target for s in share]
    rmin = math.sqrt(target / count / math.pi) * 1.9
    home_c = (rng.uniform(W * .25, W * .55), rng.uniform(H * .3, H * .7))
    centers = _poisson(rng, count, rmin, (W * .06, H * .08, W * .94, H * .92), first=home_c)
    while len(centers) < count:
        centers.append((rng.uniform(5, W - 5), rng.uniform(5, H - 5)))
    aspect = [rng.uniform(.7, 1.45) for _ in range(count)]
    f, owner = _plates(rng, salt, centers, areas, aspect, 2.4, .7, lobes=(1, 2))
    # 덩이마다 따로 문턱: 각 섬이 제 몫의 면적을 갖게(한 문턱이면 큰 섬이 작은 섬을 삼킨다)
    t = _bisect(f, target * 1.10)
    land = _settle(_plates.fields, t)
    return land, dict(home=home_c)


def _galaxy(rng, salt, count, target):
    """우주: 성계 = 둥근 항행 거품, 회랑 = 성계를 잇는 좁은 항로 띠. 시작 성단(성계 여럿이 회랑으로 이어진 것)이 가장 크다."""
    import kit_space as KS
    return KS.galaxy_land(rng, salt, count, target)


# ───────────────────────────── 기후 ─────────────────────────────
def climate(land, seed=1, wet=0.0, cold=0.0, bias=None):
    """위도(위=추움)·해안 거리·습도 노이즈 → 바닥 코드(H,W). 바다 칸은 0.
    bias(지리 구조 힌트): t0·t1 = 위·아래 끝 기온(기본 .08·1.0), temp·moist·elev = 더할 장."""
    s = 7000 + (int(seed) * 173) % 90000
    b = bias or {}
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    dco = ndi.distance_transform_edt(land)
    measured = bool(b.get('measured'))                      # 실제 지리(real): 높이·위도가 자료라 지어낸 높이(해안 거리)와 큰 기온 흔들림을 줄인다
    if measured:
        elev = np.clip(dco / 11.0, 0, 1) * .12 + fbm(8, s) * .1 + b.get('elev', 0)
    else:
        elev = np.clip(dco / 11.0, 0, 1) * .6 + fbm(8, s) * .4 + b.get('elev', 0)
    t0 = float(b.get('t0', .08))
    span = float(b['t1']) - t0 if 't1' in b else .92        # 기본은 옛 식 그대로(.92 — 1.0-.08 로 쓰면 부동소수 끝자리가 달라 저장된 세계가 움직인다)
    temp = t0 + span * (ys / (H - 1)) + (fbm(13, s + 3) - .5) * (.16 if measured else .42) - .22 * elev - float(cold) * .3 + b.get('temp', 0)
    moist = _norm(fbm(10, s + 7)) * .72 + .28 * (1 - np.clip(dco / 9.0, 0, 1)) + float(wet) * .3 + b.get('moist', 0)
    g = np.full((H, W), M4.GRASS, np.int16)
    t, m = temp, moist
    g[(t < .17) & (elev > .62) & (dco > 4)] = M4.GLACIER
    g[(t < .17) & ~((elev > .62) & (dco > 4))] = M4.SNOW
    g[(t >= .17) & (t < .31)] = np.where(m[(t >= .17) & (t < .31)] > .58, M4.SNOW, M4.TUNDRA)
    band = (t >= .31) & (t < .62)
    g[band & (m > .74) & (elev < .4)] = M4.SWAMP
    g[band & (m < .26)] = M4.DIRT
    band2 = (t >= .62) & (t < .80)
    g[band2 & (m < .48)] = M4.SAVANNA
    g[band2 & (m < .24)] = M4.BADLANDS
    band3 = t >= .80
    g[band3] = M4.SAVANNA
    g[band3 & (m < .42)] = M4.SAND
    g[band3 & (m > .66)] = M4.JUNGLE
    # 얼룩 다듬기: 3x3 다수결 두 번
    for _ in range(2):
        g = _majority(g, land)
    if b.get('glacier') is False:
        g[g == M4.GLACIER] = M4.SNOW
    for m, gname in b.get('paint') or []:            # 실제 지리: 사막 지역은 모래로
        g[m & land] = getattr(M4, gname)
    g[~land] = M4.SEA
    return g, dict(temp=temp, moist=moist, elev=elev, dco=dco)


def _majority(g, land):
    out = g.copy()
    vals = np.unique(g[land])
    best = np.zeros((H, W)) - 1
    for v in vals:
        c = ndi.uniform_filter((g == v).astype(float), 3, mode='nearest')
        better = c > best
        best[better] = c[better]
        out[better] = v
    out[~land] = g[~land]
    return out


# ───────────────────────────── 지형 물체(배치 뒤) ─────────────────────────────
def blob_mask(cx, cy, rx, ry, salt, warp=.9):
    import kit_terrain as KTer
    return M4.polymask(KTer.blob(cx, cy, rx, ry, salt), warp, salt, minsize=1)


def line_cells(a, b):
    (x0, y0), (x1, y1) = a, b
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    return {(int(round(x0 + (x1 - x0) * i / n)), int(round(y0 + (y1 - y0) * i / n))) for i in range(n + 1)}


def _seg_cross(p1, p2, q1, q2):
    """두 선분의 교점(없으면 None)."""
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = p1, p2, q1, q2
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-9:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den
    if 0 <= t <= 1 and 0 <= u <= 1:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    return None


def _guides(land, hints):
    """지리 구조 힌트 → 땅에 맞춘 척추 산줄기·강 꺾은선과 맞춤이 비켜 갈 칸(avoid)."""
    import kit_geo as KGeo
    spines, rivers = [], []
    sp_m = np.zeros((H, W), bool)
    rv_m = np.zeros((H, W), bool)
    for line in hints.get('spines') or []:
        cells = [(int(round(x)), int(round(y))) for x, y in M4.dense([tuple(p) for p in line], .5)]
        cells = [(x, y) for x, y in cells if 0 <= x < W and 0 <= y < H and land[y, x]]
        if len(cells) < 6:
            continue
        spines.append([tuple(map(float, p)) for p in line])
        for x, y in cells:
            sp_m[y, x] = True
    for k, (line, wide) in enumerate(hints.get('rivers') or []):
        pts = KGeo.river_to_sea(land, line)
        if not pts:
            continue
        salt = 2100 + k
        cells = M4.river_cells(pts, salt, .9, wide if wide < 1 else None)
        rivers.append((pts, wide, salt))
        for x, y in cells:
            if 0 <= x < W and 0 <= y < H and land[y, x]:
                rv_m[y, x] = True
    av_r = ndi.binary_dilation(rv_m, iterations=2) if rv_m.any() else None
    av = ndi.binary_dilation(sp_m | rv_m, iterations=2) if (sp_m | rv_m).any() else None
    return dict(spines=spines, rivers=rivers, avoid=av, avoid_rivers=av_r, auto=hints.get('auto', 1.0))


def _cut_line(pts, bad, keep_all=True, min_pts=10):
    """꺾은선을 bad 칸에서 끊는다 — 조각들(촘촘한 점) 목록."""
    segs, seg = [], []
    for p in _dense(pts, .5):
        x, y = int(round(p[0])), int(round(p[1]))
        if 0 <= x < W and 0 <= y < H and not bad[y, x]:
            seg.append(p)
        else:
            if len(seg) >= min_pts:
                segs.append(seg)
            seg = []
    if len(seg) >= min_pts:
        segs.append(seg)
    return segs if keep_all else sorted(segs, key=len)[-1:]


def features(land, G, lay, clim, seed=1, guide=None):
    """배치(lay)를 피해 산줄기·고개·강·숲·밭·화산을 make_map_v4 목록에 넣는다. 반환: 보고용 개수.
    guide(지리 구조): 척추 산줄기·이끌린 강을 먼저 놓고, 자동 산줄기·강은 그만큼 줄인다."""
    guide = guide or dict(spines=[], rivers=[])
    rng = np.random.default_rng(int(seed) * 104729 + 11)
    s = 9000 + (int(seed) * 211) % 90000
    lab, n = comps(land)
    foot = lay['foot']                    # 장소 발자국 마스크
    halo2 = ndi.binary_dilation(foot, iterations=2)
    corr = lay['corridor']               # 길 자리(곧은 띠)
    dune = lay['dune']
    band = lay['wall_mask']
    no = halo2 | ndi.binary_dilation(dune, iterations=2) | ndi.binary_dilation(band, iterations=1) | lay['protect']
    dco = clim['dco']
    temp = clim['temp']
    out = dict(ridges=0, passes=0, rivers=0, forests=0, farms=0)
    ridge_lines = []
    # 척추 산줄기(지리 구조): 금지 칸에서 끊고 조각마다 산줄기 하나
    for si, line in enumerate(guide['spines']):
        for seg in _cut_line(line, no | ~land | (dco < 1.5)):
            ln = seg[::4] + ([seg[-1]] if (len(seg) - 1) % 4 else [])
            if len(ln) < 2:
                continue
            gx, gy = int(round(ln[len(ln) // 2][0])), int(round(ln[len(ln) // 2][1]))
            gsum = G[max(gy - 3, 0):gy + 4, max(gx - 3, 0):gx + 4]
            dry = np.isin(gsum, (M4.SAND, M4.BADLANDS, M4.DIRT)).mean() > .55
            obj = M4.MESA if dry else (M4.SMOUNT if temp[gy, gx] < .34 else M4.MOUNT)
            M4.RIDGES.append(('척추 산줄기 %d' % len(M4.RIDGES), ln, ln[len(ln) // 2], float(rng.uniform(1.9, 2.4)), obj, 1200 + len(M4.RIDGES)))
            ridge_lines.append(ln)
            out['ridges'] += 1
    # 이끌린 강(지리 구조): 하류(어귀 쪽) 조각만 — 바다에 닿아야 강이다
    for pts, wide, salt in guide['rivers']:
        bad = ndi.binary_dilation(halo2 | dune | lay['protect'], iterations=1)   # 산벽은 건넌다(협곡) — 물은 걸어서 못 건너니 장벽은 그대로, 새는지는 여정 검사가 본다
        D = _dense(pts, .5)
        last = -1
        for i, (x, y) in enumerate(D):
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < W and 0 <= yi < H and land[yi, xi] and bad[yi, xi]:
                last = i
        D = D[last + 1:]
        if len(D) < 10:
            continue
        p2 = [tuple(p) for p in D[::3]] + ([tuple(D[-1])] if (len(D) - 1) % 3 else [])
        cells = M4.river_cells(p2, salt, .9, wide if wide < 1 else None)
        if any(0 <= x < W and 0 <= y < H and land[y, x] and (halo2[y, x] or dune[y, x] or lay['protect'][y, x]) for x, y in cells):
            continue
        M4.RIVERS.append(('큰 강 %d' % len(M4.RIVERS), p2, wide, salt))
        out['rivers'] += 1
    auto_scale = guide.get('auto', 1.0) * (.5 if guide['spines'] else 1.0)   # 실제 지리(real)는 0 — 산·강은 자료에서만
    # 산줄기: 땅 덩이마다 넓이에 맞춰 0~4줄
    for k in range(1, n + 1):
        mk = lab == k
        area = int(mk.sum())
        nr = 0 if area < 110 else int(min(4, 1 + area // 420) * auto_scale)
        if nr == 0:
            continue
        ys, xs = np.nonzero(mk)
        cov = np.cov(np.vstack([xs, ys])) if len(xs) > 2 else np.eye(2)
        ev, evec = np.linalg.eigh(cov)
        ax = evec[:, int(np.argmax(ev))]
        ext = 2.2 * math.sqrt(max(ev.max(), 1))
        inner = mk & (dco >= 2.5) & ~no
        iy, ix = np.nonzero(inner)
        if not len(ix):
            continue
        for r_ in range(nr):
            j = rng.integers(len(ix))
            cx, cy = float(ix[j]), float(iy[j])
            ang = math.atan2(ax[1], ax[0]) + rng.uniform(-.6, .6)
            L = min(16.0, max(6.0, ext * rng.uniform(.35, .6)))
            pts = []
            for t in np.linspace(-.5, .5, 5):
                off = rng.uniform(-1.4, 1.4)
                pts.append((cx + math.cos(ang) * L * t - math.sin(ang) * off, cy + math.sin(ang) * L * t + math.cos(ang) * off))
            # 금지 칸(장소 둘레·사구·산벽) 앞에서 끊고 가장 긴 조각만
            seg, best = [], []
            for p in _dense(pts, .5):
                x, y = int(round(p[0])), int(round(p[1]))
                ok = 0 <= x < W and 0 <= y < H and mk[y, x] and not no[y, x] and dco[y, x] >= 1.5
                if ok:
                    seg.append(p)
                else:
                    if len(seg) > len(best):
                        best = seg
                    seg = []
            if len(seg) > len(best):
                best = seg
            if len(best) < 10:
                continue
            line = best[::4] + ([best[-1]] if (len(best) - 1) % 4 else [])
            if len(line) < 2:
                continue
            gx, gy = int(round(line[len(line) // 2][0])), int(round(line[len(line) // 2][1]))
            gsum = G[max(gy - 3, 0):gy + 4, max(gx - 3, 0):gx + 4]
            dry = np.isin(gsum, (M4.SAND, M4.BADLANDS, M4.DIRT)).mean() > .45
            obj = M4.MESA if dry else (M4.SMOUNT if temp[gy, gx] < .34 else M4.MOUNT)
            M4.RIDGES.append(('생성 능선 %d' % len(M4.RIDGES), line, line[len(line) // 2], float(rng.uniform(1.4, 2.2)), obj, 1200 + len(M4.RIDGES)))
            ridge_lines.append(line)
            out['ridges'] += 1
    # 고개: 길 자리가 산줄기를 가로지르는 곳마다
    for line in ridge_lines:
        for (a, b) in zip(line, line[1:]):
            for (p, q) in lay['edges']:
                hit = _seg_cross(a, b, p, q)
                if hit:
                    M4.PASSES.append((hit[0], hit[1], 1.9))
                    out['passes'] += 1
    # 산 근처 길 자리는 넉넉히 뚫는다(능선 가지·작은 산이 길을 막지 않게)
    ridge_any = np.zeros((H, W), bool)
    for line in ridge_lines:
        for p in _dense(line, .5):
            x, y = int(round(p[0])), int(round(p[1]))
            if 0 <= x < W and 0 <= y < H:
                ridge_any[y, x] = True
    near_r = ndi.binary_dilation(ridge_any, iterations=4) & corr
    for y, x in zip(*np.nonzero(near_r)):
        if (x + y) % 2 == 0:
            M4.PASSES.append((x + .5, y + .5, 1.1))
    # 강: 높은 곳에서 해안 거리를 따라 바다로
    for k in range(1, n + 1):
        mk = lab == k
        area = int(mk.sum())
        nv = 0 if area < 90 else int(min(4, area // 300 + 1) * (.5 if guide['rivers'] else 1) * guide.get('auto', 1.0))
        tries = 0
        made = 0
        while made < nv and tries < nv * 6:
            tries += 1
            src = mk & (dco >= 3) & ~no & ~corr
            iy, ix = np.nonzero(src)
            if not len(ix):
                break
            w_ = dco[iy, ix] ** 2
            j = rng.choice(len(ix), p=w_ / w_.sum())
            path = _descend(ix[j], iy[j], land, dco, rng)
            if path is None or len(path) < 6:
                continue
            pts = [(float(x), float(y)) for x, y in path[::3]] + [tuple(map(float, path[-1]))]
            salt = 300 + len(M4.RIVERS)
            wide = .6 if len(path) >= 14 else 2
            cells = M4.river_cells(pts, salt, .9, wide if wide < 1 else None)
            bad = False
            on_corr = 0
            for (x, y) in cells:
                if not (0 <= x < W and 0 <= y < H) or not land[y, x]:
                    continue
                if halo2[y, x] or dune[y, x] or band[y, x] or lay['protect'][y, x]:
                    bad = True
                    break
                on_corr += corr[y, x]
            if bad or on_corr > 4:
                continue
            M4.RIVERS.append(('생성 강 %d' % len(M4.RIVERS), pts, wide, salt))
            made += 1
            out['rivers'] += 1
    # 숲: 바닥별 숲 종류 + 큰 덩이(낮은 진동수)로 무리 지게
    clump = fbm(9, s + 30) > .47
    kinds = [(M4.GRASS, M4.BROAD, .50), (M4.TUNDRA, M4.CONIFER, .48), (M4.SNOW, M4.SNOWF, .58), (M4.JUNGLE, M4.JUNGLEF, .34),
             (M4.SWAMP, M4.DEAD, .58), (M4.MARSH, M4.DEAD, .55), (M4.SAVANNA, M4.BROAD, .74), (M4.ASH, M4.DEAD, .70)]
    for gcode, obj, thr in kinds:
        mk = land & (G == gcode) & (clump | (gcode == M4.JUNGLE))
        if mk.sum() < 6:
            continue
        M4.FORESTS.append((mk, obj, thr, 1300 + len(M4.FORESTS)))
        out['forests'] += 1
    # 밭: 마을·성 곁 초원·사바나
    for p in lay['places']:
        if p['kind'] not in ('town', 'castle') or p.get('dune'):
            continue
        x, y, w, h = p['rect']
        for (fx, fy, fw, fh) in ((x - 4, y + h - 1, 3, 2), (x + w + 1, y + 1, 3, 2), (x, y + h + 1, 3, 2)):
            if rng.uniform() < .45:
                continue
            sl = (slice(max(fy, 0), fy + fh), slice(max(fx, 0), fx + fw))
            area = G[sl]
            if area.size != fw * fh or not np.isin(area, (M4.GRASS, M4.SAVANNA)).all() or no[sl].any() and halo2[sl].sum() > 2 or corr[sl].any():
                continue
            M4.FARMS.append((fx, fy, fw, fh, M4.FARM if rng.uniform() < .6 else M4.CROP))
            out['farms'] += 1
    return out


def _dense(pts, step):
    return M4.dense([tuple(p) for p in pts], step)


def _descend(x, y, land, dco, rng):
    """해안 거리가 줄어드는 쪽으로 걸어 바다에 닿는 칸 목록(8방향, 약간의 흔들림)."""
    path = [(int(x), int(y))]
    seen = {path[0]}
    for _ in range(80):
        cx, cy = path[-1]
        best, bv = None, 9e9
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            a, b = cx + dx, cy + dy
            if not (0 <= a < W and 0 <= b < H) or (a, b) in seen:
                continue
            if not land[b, a]:
                path.append((a, b))
                return path
            v = dco[b, a] + rng.uniform(0, .9)
            if v < bv:
                best, bv = (a, b), v
        if best is None:
            return None
        path.append(best)
        seen.add(best)
    return None


# ───────────────────────────── 전체: 생성 + 맞춤 + 기후 + 물체 ─────────────────────────────
GEN_OPS = ('continents', 'climate', 'land', 'sea', 'island', 'move_place', 'wall', 'dune_sea', 'sky_island')


def generate(spec, journey, salt=0):
    """spec(base generate)의 구조 작업으로 땅·기후·여정 배치를 만들고 make_map_v4 목록을 채운다.
    반환: (장소 좌표·길이 바뀐 여정 사본, 배치 요약). 나머지 작업(biome·ridge·river·forest …)은 kit_terrain.apply 가 그 뒤에 얹는다."""
    import copy
    import kit_common as K
    import kit_fit as KF
    import kit_terrain as KTer
    import journey_world_v9 as J
    import fix3_patches as P
    roles, _ = K.load_roles()
    ops = spec.get('ops', [])
    cont = next((o for o in ops if o['op'] == 'continents'), {})
    cop = next((o for o in ops if o['op'] == 'climate'), {})
    seed = int(cont.get('seed', 1))
    style = cont.get('style', 'blobs')
    land, info = gen_land(style, cont.get('count'), cont.get('land'), seed, cont.get('box'), cont.get('region'), cont.get('home'), cont.get('beyond'), cont.get('sands'))
    hints = {k[5:]: info.pop(k) for k in list(info) if k.startswith('hint_')}
    edit = np.zeros((H, W), bool)
    paint = []
    for i, o in enumerate(ops):
        k = o['op']
        g = getattr(M4, o['ground'].upper()) if o.get('ground') else None
        if k == 'land':
            m = M4.polymask(KTer._pts(o['poly'], 'poly', i, 3), 1.5, 700 + i, minsize=3)
            land |= m
            if g is not None:
                paint.append((m, g))
        elif k == 'sea':
            land &= ~M4.polymask(KTer._pts(o['poly'], 'poly', i, 3), 1.2, 760 + i, minsize=2)
        elif k == 'island':
            m = M4.polymask(KTer.blob(float(o['x']), float(o['y']), float(o['rx']), float(o['ry']), 900 + i), .9, 120 + i, minsize=3)
            land |= m
            paint.append((m, g if g is not None else M4.GRASS))
    land = clean_land(land)
    space = style == 'galaxy'
    if space:
        import kit_space as KS
        G = KS.space_ground(land, info['systems'], seed)
        clim = None
    else:
        G, clim = climate(land, int(cop.get('seed', seed)), float(cop.get('wet', 0)), float(cop.get('cold', 0)), hints.get('clim'))
    for m, g in paint:
        G[m & land] = g
        edit |= m & land
    sky_id = [p['id'] for p in journey['places'] if p['role'] == 'floating'][0]
    pins, ov = {}, {}
    for o in ops:
        if o['op'] == 'move_place':
            pins[o['id']] = (int(o['x']), int(o['y']))
        elif o['op'] == 'sky_island':
            pins[sky_id] = (int(o['x']), int(o['y']))
        elif o['op'] == 'wall':
            ov['wall'] = o['line']
            if o.get('gate'):
                gate = [b for b in journey['barriers'] if b['means'] == 'pass'][0]['gate']
                pins[gate] = tuple(int(v) for v in o['gate'])
        elif o['op'] == 'dune_sea':
            ov['dune_sea'] = o['poly']
    guide = _guides(land, hints)
    if hints.get('pole') and 'wall' not in ov:
        ov['wall_pole'] = hints['pole']
    if hints.get('dune') and 'dune_sea' not in ov:
        ov['dune_pole'] = hints['dune']
    if hints.get('home'):
        ov['home_pole'] = hints['home']
    if hints.get('home_gap'):
        ov['home_gap'] = hints['home_gap']
    if hints.get('dune_small'):
        ov['dune_small'] = True
    if hints.get('dune_coast'):
        ov['dune_coast'] = hints['dune_coast']
    if hints.get('wall') and 'wall' not in ov:            # 실제 국경(압록강·두만강)을 산벽으로
        ov['wall'] = hints['wall']
        ov['a_pole'] = hints.get('a_pole')
    import journey_check_v9 as JC
    JC.MIN_SEA_GAP[0] = 2 if style == 'real' else 4     # 실제 해협(영국 해협 등)은 칸 한두 개
    lay = None
    for avoid in (guide['avoid'], guide['avoid_rivers'], None):     # 척추·강을 비켜 놓다가 자리가 없으면 강만, 그래도 없으면 비키지 않는다
        try:
            lay = KF.fit(land, G, journey, roles, pins, dict(ov, avoid=avoid), salt, seed)
            break
        except KF.FitError:
            if avoid is None:
                raise
    if guide['spines'] or guide['rivers']:
        lay['notes'].append('지리 구조 힌트: 척추 산줄기 %d줄·이끌린 강 %d줄%s' % (
            len(guide['spines']), len(guide['rivers']), '' if lay.get('avoid') is guide['avoid'] else ' (자리가 모자라 일부는 장소에 끊긴다)'))
    land = lay['land']
    G[~land] = M4.SEA
    _decorate(G, land, lay, journey, seed, space=space, rim=hints.get('dune_rim'), real=style == 'real')
    if style == 'real' and info.get('islands_added'):
        lay['notes'].append('실제 지리에 배로 갈 땅(3막)이 모자라 가상 섬 %d개를 덧붙였다 — 싫으면 box 를 바다 건너 실제 땅이 들어오게 넓혀라' % info['islands_added'])
    if not space:
        _harmonize(G, land, lay)
    feat = KS.space_features(land, G, lay, info['systems'], seed) if space else features(land, G, lay, clim, seed, guide)
    M4.GEN = dict(land=land, ground=G, edit=edit)
    # 여정 사본: 장소 좌표·시작 칸·길(같은 땅 안 최소 신장 나무 + 관문 양쪽)
    j = copy.deepcopy(journey)
    for p in j['places']:
        if p['id'] in lay['rect']:
            p['x'], p['y'] = lay['rect'][p['id']][:2]
    sx, sy, sw, sh = lay['rect'][lay['start']]
    j['start']['cell'] = [sx + sw // 2, sy + sh // 2]
    j['roads'] = [dict(id='%s ─ %s' % (a, b), **{'from': a, 'to': b}, via=[]) for a, b in lay['edge_names']]
    j['terrain_nodes'] = dict(ramps=[], note='생성 지형: 고원·경사로 없음')
    j['terrain'] = 'generate'
    J.LAYOUT = dict(wall=lay['wall'], dune=lay['dune'])
    P.DUNE_ISLAND_SITES = tuple(p['id'] for p in lay['places'] if p['dune'])
    lab, n = comps(land)
    summary = dict(base='generate', style=style, seed=seed, salt=int(salt), count=info['count'], land=info['land'],
                   landmasses=int(n), home_cells=int(lay['home'].sum()), act1_cells=int(lay['A'].sum()),
                   act2_cells=int(lay['B'].sum()), dune_cells=int(lay['dune'].sum()),
                   ship_landmasses=len(set(np.unique(lab[land & ~lay['home']])) - {0}),
                   wall_cells=len(lay['wall']), gate=lay['gate'], harbour=lay['harbour'], start=list(j['start']['cell']),
                   places={k: [int(v[0]), int(v[1])] for k, v in lay['rect'].items()}, roads=len(j['roads']),
                   features=feat, notes=lay['notes'], min_sea_gap=JC.MIN_SEA_GAP[0], real=info.get('real'), systems=info.get('systems'), core=info.get('core'), spiral=info.get('spiral'), road_ends=[[r['id'], r['from'], r['to']] for r in j['roads']])
    reg = np.full((H, W), '~', '<U1')
    reg[land] = 's'
    reg[lay['A']] = 'a'
    reg[lay['B']] = 'b'
    reg[lay['dune']] = 'd'
    reg[lay['wall_mask']] = 'w'
    summary['regions'] = [''.join(r) for r in reg]
    summary['regions_legend'] = 'a 1막(관문 앞) · b 2막(관문 너머) · w 산벽 · d 4막 사구 바다 · s 3막(배로 가는 땅) · ~ 바다'
    J.LAYOUT['summary'] = summary
    return j, summary


COLD = (M4.SNOW, M4.GLACIER)
HOT = (M4.SAND, M4.DUNE, M4.ASH, M4.BASALT)


def _harmonize(G, land, lay):
    """기후 어긋남 지우기(적대 QA 2026-10-03): 눈·빙하가 사막·사구·화산재에 바로 붙지 않게 사이에 툰드라/황무지 띠,
    화산·용암 곁 얼음은 녹이고, 한 칸짜리 바닥 점은 이웃 다수로. 장소 발자국 둘레(2칸)는 장소 바닥이라 손대지 않는다."""
    keep = ndi.binary_dilation(lay['foot'], iterations=2) | lay['dune']
    cold = np.isin(G, COLD) & land
    hot = np.isin(G, HOT) & land
    if cold.any() and hot.any():
        dh = ndi.distance_transform_edt(~hot)
        G[cold & (dh <= 2.5) & ~keep] = M4.TUNDRA                    # 얼음 쪽을 툰드라로
        stuck = cold & (dh <= 2.5) & keep                            # 장소 눈밭이 사막에 붙은 곳: 사막 쪽을 황무지로
        if stuck.any():
            near = hot & (ndi.distance_transform_edt(~stuck) <= 2.5) & ~lay['dune'] & ~ndi.binary_dilation(lay['foot'], iterations=1)
            G[near] = M4.DIRT
    hotv = np.zeros_like(land)
    for vx, vy in M4.VOLCANOES:
        ys, xs = np.mgrid[0:H, 0:W]
        hotv |= np.hypot(xs - vx, ys - vy) <= 6.5
    melt = hotv & np.isin(G, COLD) & land & ~keep
    G[melt] = M4.TUNDRA
    # 한 칸 점: 4이웃에 같은 바닥이 없고 3x3 다수가 다른 바닥
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            g = G[y, x]
            if not land[y, x] or keep[y, x] or g < 10:
                continue
            nb = [G[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if g in nb:
                continue
            vals = [v for v in G[y - 1:y + 2, x - 1:x + 2].ravel() if v >= 10 and v != g]
            if len(vals) >= 5:
                G[y, x] = max(set(vals), key=vals.count)


def _snow_peaks(cx, cy, r, lay, land, D, salt):
    no = ndi.binary_dilation(lay['foot'], iterations=2) | lay['corridor'] | ndi.binary_dilation(D, iterations=2) | lay['protect']
    for k in range(8):
        a = 2 * math.pi * ((M4.rnd(k, salt, 3) + k / 8.0) % 1.0)
        pts = [(cx + math.cos(a + t) * (r + 1.6), cy + math.sin(a + t) * (r + 1.6)) for t in (-.35, 0, .35)]
        cells = {(int(round(x)), int(round(y))) for x, y in M4.dense(pts, .5)}
        if all(0 <= x < W and 0 <= y < H and land[y, x] and not no[y, x] for x, y in cells):
            M4.RIDGES.append(('눈 고지 %d' % len(M4.RIDGES), pts, pts[1], 1.2, M4.SMOUNT, 1500 + len(M4.RIDGES)))
            return


def _decorate(G, land, lay, journey, seed, space=False, rim=None, real=False):
    """배치에 맞춰 바닥을 손본다: 사구 바다·둘레 모래, 장소 바닥 무리(눈 마을 둘레 눈밭 …), 화산재, 길 자리의 빙하."""
    s = 8000 + (int(seed) * 97) % 90000
    D = lay['dune']
    if D.any():
        G[D] = M4.DUNE
        rw = (2.2, 2.2) if rim is None else rim               # 지리 구조가 좁은 땅이면 둘레 모래를 얇게(반도 남쪽이 통째로 모래가 됐다)
        rim = land & ~D & (ndi.distance_transform_edt(~D) <= rw[0] + rw[1] * fbm(4, s))
        G[rim & ~np.isin(G, (M4.SNOW, M4.GLACIER, M4.TUNDRA))] = M4.SAND
        G[rim & np.isin(G, (M4.SNOW, M4.GLACIER, M4.TUNDRA))] = M4.DIRT
    P = {p['id']: p for p in journey['places']}
    import kit_fit as KF
    for i, (pid, (x, y, w, h)) in enumerate(lay['rect'].items()):
        p = P[pid]
        gname = (p.get('ground') or '').upper()
        cx, cy = x + (w - 1) / 2, y + (h - 1) / 2
        if p['role'] == 'volcano':
            ash = blob_mask(cx, cy, 6.5, 5.8, s + 40 + i, 1.0) & land & ~D
            G[ash] = M4.ASH
            G[blob_mask(cx, cy, 3.6, 3.2, s + 41 + i, .6) & land & ~D] = M4.BASALT
            continue
        if '늪' in pid:
            G[blob_mask(cx, cy, 4.2, 3.6, s + 50 + i, 1.0) & land & ~D] = M4.MARSH
            continue
        if not gname or gname not in KF.FAMILY or p['act'] == 3 or space or real:   # 우주는 성계마다 성운 하나 — 장소 바닥 무리가 얼룩이 된다. 실제 지리는 바닥이 실제 기후다(적도 아프리카에 눈밭이 생겼다)
            continue
        fam = KF.FAMILY[gname]
        win = G[max(y - 3, 0):y + h + 3, max(x - 3, 0):x + w + 3]
        if np.isin(win, fam).mean() >= .55:
            continue
        r = max(w, h) / 2 + 2.4
        tier2 = {'SNOW': M4.TUNDRA, 'SAND': M4.SAVANNA, 'ASH': M4.DIRT, 'BADLANDS': M4.DIRT}.get(gname)
        if tier2 is not None:                            # 바깥 고리(눈밭 → 툰드라, 모래 → 사바나): 섬처럼 뚝 떨어진 바닥 덩이가 되지 않게
            m2 = blob_mask(cx, cy, (r + 3.2) * 1.1, (r + 3.0) * .95, s + 70 + i, 1.2) & land & ~D & ~np.isin(G, fam + (M4.DUNE,))
            G[m2] = tier2
        m = blob_mask(cx, cy, r * 1.1, r * .95, s + 60 + i, 1.0) & land & ~D
        G[m] = getattr(M4, gname)
        if gname == 'SNOW':                              # 더운 땅의 눈 마을 = 눈 덮인 고지: 곁에 작은 눈산
            _snow_peaks(cx, cy, r, lay, land, D, s + 80 + i)
    G[lay['corridor'] & (G == M4.GLACIER)] = M4.SNOW
    # 화산 목록: 장소 화산의 화구(앞), 길 자리 고리 틈, 용암 줄기
    vol = [pid for pid in lay['rect'] if P[pid]['role'] == 'volcano']
    M4.VOLCANO_ICON_N = len(vol[:1])
    for pid in vol[:1]:
        x, y, w, h = lay['rect'][pid]
        cx, cy = x + (w - 1) / 2, y + (h - 1) / 2
        M4.VOLCANOES.insert(0, (cx, cy))
        ys, xs = np.mgrid[0:H, 0:W]
        near = np.hypot(xs - cx, ys - cy) <= 4.6
        M4.CLEAR.append((ndi.binary_dilation(lay['corridor'] & near), 'mount'))
        # 용암: 길 자리가 없는 쪽으로
        best = None
        for k in range(16):
            a = 2 * math.pi * k / 16
            pts = [(cx + math.cos(a) * r_, cy + math.sin(a) * r_) for r_ in (3.4, 5.0, 6.8)]
            cells = M4.river_cells(pts, 6, .6)
            ok = all(0 <= cx_ < W and 0 <= cy_ < H and land[cy_, cx_] and not lay['corridor'][cy_, cx_] and not
                     ndi.binary_dilation(lay['foot'], iterations=1)[cy_, cx_] for cx_, cy_ in cells)
            if ok:
                best = pts
                break
        if best:
            M4.LAVA_LINES.append(best)
    # 오아시스: 「오아시스」 장소 곁 모래 위 작은 못
    for pid, (x, y, w, h) in lay['rect'].items():
        if '오아시스' not in pid:
            continue
        halo = ndi.binary_dilation(lay['foot'], iterations=1) | lay['corridor']
        for ox, oy in ((x + w + 2.2, y + .5), (x - 3.2, y + .5), (x + .5, y + h + 2.0), (x + .5, y - 3.0)):
            m = M4.polymask(M4.ellipse(ox, oy, 1.9, 1.3, 10, 70, .2), .6, 610, minsize=3) & land
            if m.sum() >= 4 and not (m & halo).any() and np.isin(G[m], (M4.SAND, M4.SAVANNA, M4.DIRT)).all():
                M4.OASIS = (ox, oy, 1.9, 1.3)
                break
