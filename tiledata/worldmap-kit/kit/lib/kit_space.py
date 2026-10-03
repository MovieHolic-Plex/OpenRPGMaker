#!/usr/bin/env python3
"""우주 구조(continents style "galaxy") — 은하 나선팔 위에 성계(둥근 항행 거품)를 늘어놓고 회랑으로 잇는다.

칸 의미는 땅 지도와 같다(여정 검사·통행·조수 도구가 그대로 돈다):
  땅 칸   = 항행 가능한 성계 공간(성계 거품 + 성계 사이 회랑)
  바다 칸 = 깊은 공허(워프 = 배로만 건넌다)
  산      = 소행성대(성계를 두르는 호) — 2막 장벽은 소행성 띠 + 항로 관문
  사구    = 이온 폭풍 성운(4막 장벽)
  숲      = 성단
팔 하나의 성계 사슬이 공허 틈으로 끊겨 「성단」 count 개가 된다. 시작 성단이 가장 길다.
"""
import math

import numpy as np
import scipy.ndimage as ndi

import make_map_v4 as M4

W, H = M4.W, M4.H
SYS_GROUNDS = ('grass', 'savanna', 'sand', 'tundra', 'snow', 'swamp', 'badlands', 'dirt', 'farm')


def _seg_dist(xs, ys, a, b):
    ax, ay = a
    bx, by = b
    vx, vy = bx - ax, by - ay
    L2 = max(vx * vx + vy * vy, 1e-6)
    t = np.clip(((xs - ax) * vx + (ys - ay) * vy) / L2, 0, 1)
    return np.hypot(xs - (ax + t * vx), ys - (ay + t * vy))


def galaxy_land(rng, salt, count, target):
    """핵 성단(시작 성단: 큰 성계 4~6개가 은하 핵을 두른다) + 나선팔의 작은 성계 염주(팔이 공허 틈으로 끊겨 성단 count-1 개)."""
    import kit_gen as KG
    cx, cy = W / 2 + rng.uniform(-4, 4), H / 2 + rng.uniform(-2, 2)
    arms = 2 if rng.uniform() < .6 else 3
    squash = .72
    b = rng.uniform(.20, .26)
    th0 = rng.uniform(0, 2 * math.pi)
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    wx = (KG.fbm(6, salt + 11) - .5) * 2.0
    wy = (KG.fbm(6, salt + 12) - .5) * 2.0
    X, Y = xs + wx, ys + wy
    nz = (KG.fbm(4, salt + 13) - .5) * .45 + (KG.fbm(1.7, salt + 14, 1) - .5) * .22
    systems, fields = [], []
    # 핵 성단: 핵(반지름 4칸 공허 = 블랙홀) 둘레 고리 위 큰 성계
    nh = int(rng.integers(4, 6))
    ring_r = rng.uniform(10.5, 12.5)
    a0 = rng.uniform(0, 2 * math.pi)
    f = np.full((H, W), 9e9)
    prev = None
    first = None
    for k in range(nh):
        a = a0 + 2 * math.pi * k / nh + rng.uniform(-.25, .25)
        x, y = cx + math.cos(a) * ring_r * 1.25, cy + math.sin(a) * ring_r * squash
        rs = rng.uniform(5.6, 7.0)
        systems.append([float(x), float(y), float(rs), 0])
        f = np.minimum(f, np.hypot(X - x, (Y - y) / .9) / rs)
        if prev:
            f = np.minimum(f, _seg_dist(X, Y, prev, (x, y)) / 2.4)
        prev = (x, y)
        first = first or (x, y)
    if rng.uniform() < .5:                           # 고리를 닫거나(관문 하나로는 못 가르므로 맞춤이 고리를 자른다) 열어 둔다
        f = np.minimum(f, _seg_dist(X, Y, prev, first) / 2.4)
    core = np.hypot((X - cx) / 1.25, (Y - cy) / squash) < 5.0
    fields.append(np.where(core, 9e9, f + nz))
    # 나선팔: 핵 성단 바깥(반지름 20칸~)에서 성계 염주
    chains = []
    for k in range(arms):
        pts = []
        th = 2.6
        while True:
            r = 3.2 * math.exp(b * th * 2.0)
            if r > W * .58:
                break
            a = th0 + 2 * math.pi * k / arms + th
            x, y = cx + math.cos(a) * r * 1.1, cy + math.sin(a) * r * squash
            if r > 19 and 3.5 < x < W - 4.5 and 3.5 < y < H - 4.5:
                if not pts or math.hypot(x - pts[-1][0], y - pts[-1][1]) >= 7.5 + rng.uniform(0, 2.0):
                    pts.append((x, y))
            th += .04
        chains.append(pts)
    total = sum(len(c) for c in chains)
    want = max(count - 1, arms)
    segs = []
    for c in chains:
        n = max(1, round(want * len(c) / max(total, 1)))
        cuts = sorted(rng.choice(range(1, len(c)), size=min(n - 1, len(c) - 1), replace=False)) if len(c) > 1 and n > 1 else []
        prev = 0
        for ct in list(cuts) + [len(c)]:
            if ct > prev:
                segs.append(c[prev:ct])
            prev = ct
    for si, sg in enumerate(segs, start=1):
        f = np.full((H, W), 9e9)
        for i, (x, y) in enumerate(sg):
            rs = rng.uniform(2.7, 4.3)
            systems.append([float(x), float(y), float(rs), si])
            f = np.minimum(f, np.hypot(X - x, (Y - y) / .92) / rs)
            if i:
                f = np.minimum(f, _seg_dist(X, Y, sg[i - 1], (x, y)) / rng.uniform(1.25, 1.6))
        fields.append(f + nz)
    lo, hi = .6, 1.5
    for _ in range(24):
        mid = (lo + hi) / 2
        if KG._settle(fields, mid).sum() < target:
            lo = mid
        else:
            hi = mid
    land = KG._settle(fields, (lo + hi) / 2)
    info = dict(home=tuple(systems[0][:2]), systems=[[round(v, 2) if isinstance(v, float) else v for v in sy] for sy in systems],
                core=[round(cx, 2), round(cy, 2)], arms=arms, clusters=len(segs) + 1,
                spiral=dict(n=arms, b=round(b, 4), th0=round(th0, 4), squash=squash))   # 그림이 나선팔을 핵에서부터 그린다
    return land, info


def space_ground(land, systems, seed):
    """성계마다 성운 종류 하나(가장 가까운 성계를 따른다). 회랑도 가까운 성계 색."""
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    best = np.full((H, W), 9e9)
    g = np.full((H, W), M4.GRASS, np.int16)
    for i, (x, y, r, si) in enumerate(systems):
        d = np.hypot(xs - x, ys - y) / r
        name = SYS_GROUNDS[(M4.hh(int(x * 7), int(y * 7), int(seed) + 41) + i) % len(SYS_GROUNDS)]
        code = getattr(M4, name.upper())
        better = d < best
        best[better] = d[better]
        g[better] = code
    g[~land] = M4.SEA
    return g


def space_features(land, G, lay, systems, seed):
    """소행성대(성계를 두르는 호)·성단(성긴 숲)·회랑 고개. 강·밭은 없다."""
    import kit_gen as KG
    rng = np.random.default_rng(int(seed) * 7727 + 3)
    foot = lay['foot']
    halo2 = ndi.binary_dilation(foot, iterations=2)
    no = halo2 | ndi.binary_dilation(lay['dune'], iterations=2) | ndi.binary_dilation(lay['wall_mask'], iterations=1) | lay['protect']
    out = dict(belts=0, clusters=0, passes=0)
    lines = []
    for i, (x, y, r, si) in enumerate(systems):
        if r < 3.6 or rng.uniform() < .35:
            continue
        rr = r * rng.uniform(.62, .78)
        a0 = rng.uniform(0, 2 * math.pi)
        span = rng.uniform(2.4, 4.4)
        pts = [(x + math.cos(a0 + span * k / 10) * rr, y + math.sin(a0 + span * k / 10) * rr * .92) for k in range(11)]
        seg, best = [], []
        for p in M4.dense(pts, .5):
            cx_, cy_ = int(round(p[0])), int(round(p[1]))
            ok = 0 <= cx_ < W and 0 <= cy_ < H and land[cy_, cx_] and not no[cy_, cx_]
            if ok:
                seg.append(p)
            else:
                if len(seg) > len(best):
                    best = seg
                seg = []
        if len(seg) > len(best):
            best = seg
        if len(best) < 8:
            continue
        line = best[::3] + ([best[-1]] if (len(best) - 1) % 3 else [])
        M4.RIDGES.append(('소행성대 %d' % len(M4.RIDGES), line, line[len(line) // 2], 1.15, M4.MOUNT, 1600 + len(M4.RIDGES)))
        lines.append(line)
        out['belts'] += 1
    for line in lines:
        for a, b in zip(line, line[1:]):
            for p, q in lay['edges']:
                hit = KG._seg_cross(a, b, p, q)
                if hit:
                    M4.PASSES.append((hit[0], hit[1], 1.7))
                    out['passes'] += 1
    clump = KG.fbm(5, int(seed) + 620) > .55
    mk = land & clump & ~np.isin(G, (M4.DUNE,))
    if mk.sum() > 6:
        M4.FORESTS.append((mk, M4.BROAD, .62, 1700))
        out['clusters'] = 1
    return out
