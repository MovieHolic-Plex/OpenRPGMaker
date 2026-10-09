#!/usr/bin/env python3
"""[v9-final 사본] src/ruins/f1/swamp.py 에서 입출력만 바꿨다: run(img, snap, G) 가 배열을 직접 받고 px 를 돌려준다(/tmp 경로·pickle 제거). 칠하는 규칙은 그대로.
서쪽 늪(SWAMP, 칸 x6~16,y30~45) 재작업 후처리.

옛 판: 3색 단색 타일(366250/467458/2c5446) 위에 6px 물 타원을 점처럼 찍어 「물웅덩이」로 읽혔고, 해안과 풀에 일직선으로 붙었다.
이 판: 바닥이었던 픽셀(최종 == 스냅숏)만 다시 칠한다 — 길·나무·해안·다리는 그대로.
 · 불규칙한 윤곽(칸 마스크를 노이즈로 휘게 한 것)
 · 안은 진흙(갈색) · 탁한 녹색 · 짙은 이끼 덩이 + 물웅덩이 몇 개(덩이, 둑 테, 얕은 가장자리, 개구리밥)
 · 풀·해안과 만나는 가장자리는 풀이 섞이는 전이대(안쪽 9px 점묘 + 바깥 7px 덤불 알갱이)
 · 갈대 덩이 · 죽은 나무를 물가와 진흙 위에 배치
색은 전부 원본 World.png 색 집합에서만 쓴다.

  python3 swamp.py [src.npy] [out.npy]   (기본: /tmp/fx34/base_swsrc.npy → /tmp/fx34/base_sw.npy)
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# [worldmap-kit 복사본] 경로 삽입 제거
import numpy as np  # noqa: E402
import scipy.ndimage as ndi  # noqa: E402
import pickle  # noqa: E402
from boundary_v5 import vnoise, hash2  # noqa: E402


def hx(s):
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


# ── 색(전부 원본 World.png) ─────────────────────────────────────────────────────────────
MUD = [hx(c) for c in ('411e05', '4f2e21', '5f4324', '65442a', '714e29')]
MURK = [hx(c) for c in ('2c3529', '454f40', '2c634c', '1d5728', '5b6458')]
MOSS = [hx(c) for c in ('1d5728', '13522e', '218238')]
WATER = [hx(c) for c in ('1d2c33', '354951', '475b63', '094384', '4a8faf')]
GRASS = [hx(c) for c in ('3c8f4b', '419d39', '5ba644', '218238')]
WEED = [hx(c) for c in ('308050', '77ac40')]

RX = dict(b=hx('714e29'), B=hx('4f2e21'), l=hx('77ac40'), g=hx('218238'), d=hx('1d5728'), s=hx('b9cb45'))
REED = [
    "...bB.",
    "...bB.",
    ".l..s.",
    ".ls.sg",
    ".ls.sg",
    "gls.dg",
    "gdl.dg",
    ".dgdd.",
]
REED2 = [
    "..bB.",
    "..bB.",
    ".ls.l",
    ".ls.l",
    "gdsgd",
    ".dgd.",
]
DT = dict(k=hx('291010'), t=hx('63310b'), T=hx('411e05'), u=hx('9a5435'))
DEAD = [
    "..k.....k..",
    ".kuk...kuk.",
    "kuTk.k.kTk.",
    ".kTkkukkTk.",
    "..kTkukTk..",
    "..kkuuTkk.k",
    "k..kuuTk.kuk",
    "kuk.kuTk.kk.",
    ".kTkkuTkkk..",
    "..kkuuTTk...",
    "...kuuTTk...",
    "...kuuTTk...",
    "..kkuuTTkk..",
    ".kuuuuTTTTk.",
]


def sprite(rows, key):
    h, w = len(rows), max(len(r) for r in rows)
    a = np.zeros((h, w, 3), np.uint8)
    m = np.zeros((h, w), bool)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in key:
                a[y, x] = key[ch]
                m[y, x] = True
    return a, m


def run(img, snap, G, out=None, label=None):
    """label: 바닥 경계 v9 의 픽셀 라벨. 주면 늪 윤곽을 그 라벨로(바닥 그림과 같은 경계), 가장자리 풀 섞기는 실제 이웃 바닥 픽셀로."""
    import terrain_v4 as V
    H, W = img.shape[:2]
    sw_c = (G == V.SWAMP)
    up = lambda m: np.repeat(np.repeat(m, 16, 0), 16, 1)
    if label is not None:
        S = label == V.SWAMP
    else:
        # 칸 마스크를 노이즈로 휘어 불규칙한 윤곽
        f = ndi.gaussian_filter(up(sw_c).astype(np.float32), 5.0, mode='nearest')
        f += vnoise(H, W, 26, 1101) * .16 + vnoise(H, W, 11, 1102) * .12 + vnoise(H, W, 5, 1103) * .06
        S = f > .46
    # 바닥이었던 초록 계열 픽셀만 (스냅숏과 같고, 파랑이 아니며, 모래가 아님)
    r, g, b = [img[..., i].astype(int) for i in range(3)]
    same = (img == snap).all(-1)
    greenish = (g >= b + 6) & (g >= r - 4)
    paint = same & greenish
    # 바다 쪽 직선 해안을 건드리지 않도록 바다 칸에서 3px 이내는 제외
    sea_px = up(G < 10)
    near_sea = ndi.binary_dilation(sea_px, iterations=3)
    S &= ~near_sea
    inside = S & paint
    dist_out = ndi.distance_transform_edt(S)            # 윤곽 안쪽 거리
    dist_in = ndi.distance_transform_edt(~S)            # 윤곽 바깥 거리

    # ── 바닥 무늬 ──
    nA = vnoise(H, W, 9, 1201)
    nB = vnoise(H, W, 13, 1202)
    nC = vnoise(H, W, 4, 1203)
    nP = vnoise(H, W, 17, 1204) + .25 * vnoise(H, W, 7, 1205)
    xa = np.arange(W)[None, :] + np.zeros((H, 1), np.int64)
    ya = np.arange(H)[:, None] + np.zeros((1, W), np.int64)
    grain = hash2(xa, ya, 1210)
    px = img.copy()
    # 물웅덩이: 안쪽(윤곽에서 6px 이상)에서만, 임계값을 높게 해 몇 덩이만
    pool = (nP > .42) & (dist_out >= 6) & inside
    pool = ndi.binary_opening(pool, iterations=1) | (ndi.binary_closing(pool, iterations=1) & inside & (dist_out >= 6))
    dpool = ndi.distance_transform_edt(pool)
    bank = ~pool & (ndi.distance_transform_edt(~pool) <= 2.2) & inside
    # 진흙: 둑 근처 + 노이즈 덩이
    mud = inside & ~pool & ((nB > .34) | (bank & (nC > -.1)))
    # 이끼 덩이(짙은 녹색)
    moss = inside & ~pool & ~mud & (nA > .05)
    # 기본: 탁한 녹색
    base_i = np.where(nC > .35, 4, np.where(nA < -.30, 0, np.where(nA < .05, 1, 2)))
    base_i = np.where(grain > .90, 4, base_i)
    base_i = np.where((grain < .06) & (base_i > 0), base_i - 1, base_i)
    murk = np.array(MURK, np.uint8)
    px[inside] = murk[np.clip(base_i, 0, 4)][inside]
    # 이끼
    mi = np.where(grain > .75, 2, np.where(grain > .25, 1, 0))
    px[moss] = np.array(MOSS, np.uint8)[mi][moss]
    # 진흙: 갈색 단계, 둑 가까울수록 어둡다
    mud_i = np.where(nC > .28, 4, np.where(nC > -.05, 3, np.where(nC > -.4, 2, 1)))
    mud_i = np.where(grain > .93, 4, mud_i)
    mud_i = np.where(bank, np.minimum(mud_i, 2), mud_i)
    px[mud] = np.array(MUD, np.uint8)[np.clip(mud_i, 0, 4)][mud]
    # 둑 테: 웅덩이에 닿는 1px 는 진한 갈색
    rim1 = ~pool & (ndi.distance_transform_edt(~pool) <= 1.2) & inside
    px[rim1] = MUD[0]
    # 웅덩이: 가장자리 얕은 물 → 속 깊은 물, 수면 반짝임
    wcol = np.where((dpool <= 1.5)[..., None], WATER[2], np.where((dpool <= 3.2)[..., None], WATER[1], WATER[0]))
    px[pool] = wcol[pool]
    shine = pool & (dpool > 2) & (hash2(xa // 3, ya // 2, 1220) > .93) & (hash2(xa, ya, 1221) > .35)
    px[shine] = WATER[4]
    deepb = pool & (dpool > 3) & (nC > .15) & ~shine
    px[deepb] = WATER[3]
    weed = pool & (dpool <= 5) & (hash2(xa // 2, ya // 2, 1230) > .78)
    px[weed] = np.where(hash2(xa, ya, 1231)[..., None] > .5, WEED[0], WEED[1])[weed]

    # ── 가장자리 전이: 안쪽 9px 는 풀이 섞이고, 바깥 7px 는 덤불 알갱이 ──
    p_gr = np.clip(1 - (dist_out - 1) / 9.0, 0, 1) ** 1.2
    mixg = inside & (grain < p_gr * .85)
    if label is not None:                               # 경계 너머 같은 거리의 실제 바닥 픽셀(풀이 아니라 사바나·툰드라일 수도 있다)
        oi = ndi.distance_transform_edt(S, return_distances=False, return_indices=True)
        my, mx = 2 * oi[0] - ya, 2 * oi[1] - xa
        my, mx = np.clip(my, 0, H - 1), np.clip(mx, 0, W - 1)
        mirror = snap[my, mx]
        ok = ~S[my, mx] & (label[my, mx] >= 10)
        mixg &= ok
        px[mixg] = mirror[mixg]
    else:
        gi = np.where(hash2(xa // 2, ya, 1240) > .66, 3, np.where(hash2(xa, ya // 2, 1241) > .4, 1, 0))
        px[mixg] = np.array(GRASS, np.uint8)[gi][mixg]
    # 바깥 알갱이(풀 위에 짙은 이끼 덩이가 번진다): 스냅숏이 풀색인 곳만
    fringe = paint & ~S & (dist_in <= 7) & ~near_sea
    p_fr = np.clip(1 - dist_in / 7.0, 0, 1) * .55
    clump = hash2(xa // 2, ya // 2, 1250) < p_fr
    clump &= fringe
    ci = np.where(hash2(xa, ya, 1251) > .55, 1, 0)
    px[clump] = np.array(MOSS, np.uint8)[ci][clump]

    # ── 오브젝트: 갈대 덩이 · 죽은 나무 ──
    protect = ~paint | ~(inside | fringe)
    rng_pts = []
    ys, xs = np.nonzero(inside & ~pool & (dist_out >= 2))
    order = np.argsort(hash2(xs, ys, 1300))
    occupied = np.zeros((H, W), bool)
    ra, rm = sprite(REED, RX)
    rb, rbm = sprite(REED2, RX)
    da, dm = sprite(DEAD, DT)
    n_reed = n_dead = 0

    def can(sm_h, sm_w, x, y):
        y0, x0 = y - sm_h + 1, x - sm_w // 2
        if y0 < 0 or x0 < 0 or y + 1 > H or x0 + sm_w > W:
            return False
        win = (slice(y0, y + 1), slice(x0, x0 + sm_w))
        return not protect[win].any() and not pool[win].any() and not occupied[win].any()

    def put(a, m, x, y):
        h_, w_ = m.shape
        y0, x0 = y - h_ + 1, x - w_ // 2
        win = (slice(y0, y + 1), slice(x0, x0 + w_))
        sub = px[win]
        sub[m] = a[m]
        occ = occupied[win]
        occ[:] = True
    # 죽은 나무: 진흙 위 큰 간격으로 몇 그루
    for i in order:
        x, y = int(xs[i]), int(ys[i])
        if n_dead >= 4:
            break
        if mud[y, x] and dist_out[y, x] >= 5 and can(da.shape[0], da.shape[1], x, y):
            if any(abs(x - px_) < 18 and abs(y - py_) < 14 for px_, py_ in rng_pts):
                continue
            put(da, dm, x, y)
            rng_pts.append((x, y))
            n_dead += 1
    # 갈대: 물가(웅덩이 둑 2~5px)에 우선, 안쪽에 드문드문, 가장자리 근처에도
    near_pool = ~pool & (ndi.distance_transform_edt(~pool) <= 5.0)
    cand = []
    for i in order:
        x, y = int(xs[i]), int(ys[i])
        w_ = 1.0 if near_pool[y, x] else (.25 if dist_out[y, x] >= 4 else .12)
        if hash2(np.array([x]), np.array([y]), 1310)[0] < w_ * .055:
            cand.append((x, y))
    placed = []
    for (x, y) in cand:
        spr = (ra, rm) if hash2(np.array([x]), np.array([y]), 1320)[0] > .4 else (rb, rbm)
        if not can(spr[1].shape[0], spr[1].shape[1], x, y):
            continue
        if any(abs(x - qx) < 12 and abs(y - qy) < 9 for qx, qy in placed):
            continue
        put(spr[0], spr[1], x, y)
        placed.append((x, y))
        n_reed += 1
    px[~(inside | fringe | occupied)] = img[~(inside | fringe | occupied)]
    # 스프라이트(occupied)는 이미 px 에 있다. 후처리 범위 밖은 원본 유지.
    outm = ~(inside | fringe | occupied)
    px[outm] = img[outm]
    area = int(inside.sum())
    if not area:   # 늪 칸이 그림에 안 남은 세계(실제 지리의 작은 늪) — 통계만 건너뛴다
        print('swamp px 0 — skipped stats')
        return px
    cols = px[inside]
    uniq, cnt = np.unique(cols.reshape(-1, 3), axis=0, return_counts=True)
    top = cnt.max() / cnt.sum()
    blk = 0
    tot = 0
    ys0, xs0 = np.nonzero(inside)
    for by in range(ys0.min() // 8, ys0.max() // 8 + 1):
        for bx in range(xs0.min() // 8, xs0.max() // 8 + 1):
            m = inside[by * 8:by * 8 + 8, bx * 8:bx * 8 + 8]
            if m.sum() < 40:
                continue
            c = px[by * 8:by * 8 + 8, bx * 8:bx * 8 + 8][m]
            tot += 1
            blk += len({tuple(v) for v in c}) <= 2
    print('swamp px', area, 'pools', int(pool.sum()), 'top color %.0f%%' % (top * 100), 'colors', len(uniq),
          'uniform 8x8 blocks %d/%d' % (blk, tot), 'reeds', n_reed, 'dead', n_dead)
    return px
