# 허공(통행 불가 배경): 어두운 남색 바탕 + 덩이진 성운(구름처럼 둥근 덩이, 왼쪽 위 밝은 테·오른쪽 아래 그늘, 바이어 디더 가장자리)
# + 별 점(1px 점, 드물게 십자 반짝임). 탑 내부 꼭대기 층 하늘 구름(덩이·디더 가장자리) 결을 밤하늘 쪽으로 옮겼다.
# 바닥 표본은 주기 48 로 감기게(3x3 이음새 없음), 지도는 주기 없이 넓게 그린다.
import numpy as np
from tr_base import *


def _blob_field(W, H, blobs, per):
    """덩이 마당: 원 덩이들의 (1 - d/r) 최댓값. per=True 면 W·H 로 감긴다."""
    Y, X = np.mgrid[0:H, 0:W]
    f = np.zeros((H, W))
    for (cx, cy, r) in blobs:
        dx = X + .5 - cx; dy = (Y + .5 - cy) * 1.15
        if per:
            dx = (dx + W / 2) % W - W / 2; dy = (dy + H / 2 * 1.15) % (H * 1.15) - H / 2 * 1.15
        f = np.maximum(f, 1 - np.sqrt(dx * dx + dy * dy) / r)
    return f


def stream(rng, x0, y0, x1, y1, n, r0, r1, wob):
    """성운 흐름 하나: 휘는 선을 따라 크고 작은 덩이를 뭉쳐 놓는다."""
    out = []
    for i in range(n):
        t = i / max(1, n - 1)
        x = x0 + (x1 - x0) * t + math.sin(t * 5.3 + x0) * wob
        y = y0 + (y1 - y0) * t + math.cos(t * 4.1 + y0) * wob * .6
        r = r0 + (r1 - r0) * math.sin(math.pi * t) * (0.7 + 0.6 * rng.random())
        out.append((x + rng.normal(0, r * .35), y + rng.normal(0, r * .3), max(3.0, r)))
        if rng.random() < .55: out.append((x + rng.normal(0, r * .8), y + rng.normal(0, r * .6), max(2.5, r * (.4 + .3 * rng.random()))))
    return out


def nebula_layer(W, H, blobs, ramp, per, seed, strength=1.0):
    """덩이 마당 → 성운 톤(-1 없음, 1..4). 왼쪽 위 테 밝게, 오른쪽 아래 그늘, 가장자리는 바이어 디더."""
    f = _blob_field(W, H, blobs, per)
    g = f + (tnoise(W, H, 6, seed, per) - .5) * .18 + (tnoise(W, H, 2.5, seed + 1, per) - .5) * .08
    # 빛: 왼쪽 위로 3px 옮긴 마당과 비교
    sh = np.roll(np.roll(g, 3, 0), 3, 1)          # 오른쪽 아래 이웃이 본 값 = 이 화소의 왼쪽 위 쪽
    lit = g - sh                                  # 양수 = 왼쪽 위 가장자리(밝은 테)
    b = bayer(H, W)
    t = np.full((H, W), -1, int)
    halo = g + b * .10 > .05
    t[halo & (b < .5 + g * 4)] = 1                # 바깥 안개: 성긴 디더 점
    t[g + b * .08 > .14] = 2
    t[g + b * .08 > .30] = 3
    t[(g + b * .08 > .52)] = 4
    t[(lit > .10) & (t >= 2)] += 1                # 왼쪽 위 테
    t[(lit < -.12) & (t >= 2)] -= 1               # 오른쪽 아래 그늘
    t = np.where(t >= 0, np.clip((t * strength).round().astype(int), 0, 5), -1)
    return t


def stars(W, H, seed, per, dens=1.0):
    """별 점 목록 (x, y, 단계 0..2, 색 이름)."""
    rng = np.random.default_rng(seed)
    n = int(W * H / 230 * dens)
    xs = rng.integers(0, W, n); ys = rng.integers(0, H, n); lv = rng.random(n); tint = rng.random(n)
    out = []
    for x, y, l, tt in zip(xs, ys, lv, tint):
        k = 0 if l < .72 else (1 if l < .95 else 2)
        col = 'star' if tt < .74 else ('gold' if tt < .87 else ('violet' if tt < .95 else 'teal'))
        if k == 2 and per and (x < 3 or x > W - 4 or y < 3 or y > H - 4): k = 1
        out.append((int(x), int(y), k, col))
    return out


def void_rgb(W, H, seed=7, per=False, nebula=True, star_dens=1.0, neb_blobs=None):
    """허공 그림 RGB(H,W,3). per=True 면 W,H 주기로 감긴다."""
    v = P('void'); b = bayer(H, W)
    base = tnoise(W, H, 64 if not per else 48, seed, per) * .6 + tnoise(W, H, 20, seed + 1, per) * .4
    t = np.where(base + b * .22 > .62, 3, np.where(base + b * .22 > .30, 2, 1))
    out = v[t].copy()
    if nebula:
        rng = np.random.default_rng(seed + 10)
        if neb_blobs is None:
            if per:
                nv = stream(rng, 0, 30, 48, 14, 7, 9, 13, 4)
                nt = stream(rng, 10, 46, 40, 38, 4, 5, 8, 3)
            else:
                nv = []; nt = []
                for k in range(max(2, W * H // 52000)):
                    x0 = rng.uniform(-40, W * .6); y0 = rng.uniform(0, H); ang = rng.uniform(-.7, -.1)
                    L = rng.uniform(.35, .7) * W
                    nv += stream(rng, x0, y0, x0 + L * math.cos(ang), y0 + L * math.sin(ang), int(L / 14), 10, 30, 14)
                for k in range(max(1, W * H // 110000)):
                    x0 = rng.uniform(0, W * .7); y0 = rng.uniform(0, H); L = rng.uniform(.25, .45) * W
                    nt += stream(rng, x0, y0, x0 + L, y0 - L * .35, int(L / 14), 7, 18, 10)
        else:
            nv, nt = neb_blobs
        tv = nebula_layer(W, H, nv, NEBV, per, seed + 20)
        tt = nebula_layer(W, H, nt, NEBT, per, seed + 30)
        pv = P('nebv'); pt = P('nebt')
        m = tv >= 1; out[m] = pv[np.clip(tv[m], 1, 6)]
        m = tt >= 1; out[m] = pt[np.clip(tt[m], 1, 6)]
        neb = (tv >= 2) | (tt >= 2)
    else:
        neb = np.zeros((H, W), bool)
    gs = P('gstar'); gold = P('ggold'); vio = P('gviol'); teal = P('gteal')
    cols = {'star': gs, 'gold': gold, 'violet': vio, 'teal': teal}
    for (x, y, k, col) in stars(W, H, seed + 40, per, star_dens):
        r = cols[col]
        if neb[y, x] and k == 0 and hash2(x, y, seed) < .5: continue
        if k == 0: out[y, x] = r[4] if col == 'star' else r[4]
        elif k == 1:
            out[y, x] = r[6] if col == 'star' else r[5]
        else:
            out[y, x] = r[6]
            for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = (x + dx) % W, (y + dy) % H
                out[yy, xx] = r[4]
            for (dx, dy) in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                xx, yy = (x + dx) % W, (y + dy) % H
                if not per and not (0 <= x + dx < W and 0 <= y + dy < H): continue
                out[yy, xx] = r[2] if col == 'star' else r[3]
    return out


def void_image(W, H, seed=7, **k):
    a = void_rgb(W, H, seed, **k)
    o = np.zeros((H, W, 4), np.uint8); o[..., :3] = a; o[..., 3] = 255
    return Image.fromarray(o, 'RGBA')


def ground_void():
    """바닥 표본: 별만 박힌 허공(48x48, 주기)."""
    return void_image(48, 48, seed=11, per=True, nebula=False, star_dens=1.1)


def ground_void_nebula():
    """바닥 표본: 보라·청록 성운 덩이가 번진 허공(48x48, 주기)."""
    return void_image(48, 48, seed=12, per=True, nebula=True, star_dens=.9)
