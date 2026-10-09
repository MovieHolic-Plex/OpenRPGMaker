# 하늘 도시 바닥·덩이 붓 — 「큰 면에 이어 깔아도 반복이 안 보이는」 판 (2026-10-08 보정)
#
# 실측 약점: 조수가 ground-cloudsea 의 대표 칸(16px)을 맵 전체에 칠했더니 구름 덩이+하늘 구멍이 칸마다 되풀이돼
# 체크무늬 천처럼 보였다(/tmp/asst-bd/sc3.png). 대리석·구름 길도 판 귀 상감 점·덩이 격자가 같은 주기로 찍혔다.
#
# 이음 규칙(모든 바닥 공통):
#   Q 칸 = 16px 주기의 「조용한」 칸. 버들항 잔디 칸처럼 거의 한 톤에 잔 얼룩만 — 혼자 수백 칸을 이어 칠해도 무늬가 안 보인다.
#   표본 키트(6×6칸) = Q 위에 큰 무늬(뭉게 덩이·골·하늘 틈·판석 결)를 얹되, 무늬는 키트 테두리 2px 와 가운데 칸(3,3)을 건드리지 않는다.
#   → 키트 테두리는 언제나 Q 와 같다. 그래서 어떤 키트·변형을 어떤 순서로 붙이든, Q 칸 사이 어디에 찍든 이음매가 없다.
#   → 키트 가운데 칸(팩 문서의 「대표 칸」)은 Q 그 자체라 대표 칸으로 면을 채워도 격자가 생기지 않는다.
#   오토타일 덩이 붓(구름 둑·구름 틈·구름 길)의 속 칸(15번)도 같은 Q 라 바닥 키트와 그대로 이어진다.
import math, random
import numpy as np
from PIL import Image
from sc_base import CL, CP, SK, TRV, ST, SL, GOLD, T, new, mix, mul, _hash, vnoise, autotile_sheet
import sc_sky as S

K = 6                     # 표본 키트 칸 수(6×6)
KP = K * T                # 96px

def _arr(im): return np.array(im.convert('RGBA'))
def _img(a): return Image.fromarray(a.astype(np.uint8), 'RGBA')

# ================================================================ Q 칸(조용한 16px 칸)
def _q(base, specks, seed):
    """base 한 톤 + 잔 얼룩. specks = [(색, 개수, 크기)]. 위치는 칸 안에서 흩어진 블루노이즈(서로 3px 이상)."""
    a = np.zeros((T, T, 4), np.uint8); a[:, :, :3] = base; a[:, :, 3] = 255
    r = random.Random(seed); used = []
    for (col, n, sz) in specks:
        k = 0; tries = 0
        while k < n and tries < 400:
            tries += 1
            x, y = r.randrange(T), r.randrange(T)
            if any(min(abs(x - u), T - abs(x - u)) + min(abs(y - v), T - abs(y - v)) < 4 for u, v in used): continue
            used.append((x, y)); k += 1
            pts = [(0, 0)] if sz == 1 else ([(0, 0), (1, 0)] if sz == 2 else [(0, 0), (1, 0), (-1, 0), (0, 1)])
            for dx, dy in pts: a[(y + dy) % T, (x + dx) % T, :3] = col
    return _img(a)

def _q_puffscale(seed, ramp, base, lo_col, hi_col, n=5, rmin=4, rmax=7):
    """16px 주기 잔 덩이 결: 블루노이즈 자리(서로 5px 이상)의 작은 덩이 다섯 — 덩이 아래 가장자리 반 단 그늘, 위 가장자리 흰 점(체크 디더).
    한 단 안쪽 대비라 수백 칸을 이어 칠해도 무늬 격자가 아니라 「잔 구름 결」로 읽힌다(대표 칸 하나로 칠해도 빈 판이 아니다)."""
    r = random.Random(seed); pts = []
    while len(pts) < n:
        x, y = r.uniform(0, T), r.uniform(0, T)
        if all(min(abs(x - u), T - abs(x - u)) ** 2 + min(abs(y - v), T - abs(y - v)) ** 2 > 30 for u, v in pts): pts.append((x, y))
    puffs = []
    for (x, y) in pts:
        rad = r.uniform(rmin, rmax); puffs.append((x, y, rad, rad * .75))
    puffs.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, pid = S.paint_puffs(T, T, puffs, ramp, period=True)
    a = np.zeros((T, T, 4), np.uint8); a[:, :, 3] = 255; a[:, :, :3] = base
    for y in range(T):
        for x in range(T):
            k = pid[y, x]
            if k == 0: continue
            if pid[(y + 1) % T, x] != k: a[y, x, :3] = lo_col
            if pid[(y - 1) % T, x] != k and (x + y) % 2 == 0: a[y, x, :3] = hi_col
    return _img(a)

def q_cloud():
    """구름 바다 윗면(구름 융단·둑 속): 흰 라벤더 CL5 에 잔 덩이 결(덩이 아래 반 단 그늘·위 흰 점)."""
    return _q_puffscale(13, CL, CL[5], mix(CL[5], CL[4], .38), mix(CL[5], CL[6], .6))
def q_sky():
    """구름 아래 깊은 하늘: SK3 에 엇갈린 옅은 안개 줄 셋(길이 4~8px, 끝 디더)과 짙은 점 넷 — 한 단 안쪽 대비의 하늘 결."""
    a = np.zeros((T, T, 4), np.uint8); a[:, :, 3] = 255; a[:, :, :3] = SK[3]
    lite = mix(SK[3], SK[4], .36); lite2 = mix(SK[3], SK[4], .2); dark = mix(SK[3], SK[2], .25)
    for (x0, y, L) in ((3, 3, 7), (11, 9, 8), (0, 14, 4)):
        for k in range(L):
            X = (x0 + k) % T
            if k in (0, L - 1):
                if (X + y) % 2: a[y, X, :3] = lite2
            else: a[y, X, :3] = lite
            if 1 <= k <= L - 3 and k % 3 == 1: a[(y + 1) % T, X, :3] = lite2
    for (x, y) in ((6, 7), (13, 2), (3, 12), (14, 14)): a[y, x, :3] = dark
    return _img(a)
def q_path():
    """다져진 구름 길: 상아빛 CP5 에 잔 덩이 결(눌린 덩이라 대비를 더 낮춘다)."""
    return _q_puffscale(13, CP, CP[5], mix(CP[5], CP[4], .35), mix(CP[5], CP[6], .6))

JOINT = lambda: mix(TRV[5], TRV[3], .40)
EDGE_HI = lambda: mix(TRV[5], TRV[6], .40)
def q_marble():
    """흰 대리석 판석 한 칸(16px 판): 버들항 포룸 광장처럼 줄눈은 옅게(오른쪽·아래 1px 반 단 어둡게, 왼쪽·위 반 단 밝게), 판 안은 한 톤.
    상감 점 없음 — 상감·큰 판·얼룩은 키트에만."""
    a = np.zeros((T, T, 4), np.uint8); a[:, :, 3] = 255
    for y in range(T):
        for x in range(T):
            c = TRV[5]
            if x == 15 or y == 15: c = JOINT()
            elif x == 0 or y == 0: c = EDGE_HI()
            a[y, x, :3] = c
    for (x, y, k) in ((4, 5, .25), (11, 9, .2), (7, 12, .18)):
        a[y, x, :3] = mix(TRV[5], TRV[4], k)
    return _img(a)

def tile_q(q, w, h):
    o = new(w * T, h * T)
    for y in range(h):
        for x in range(w): o.paste(q, (x * T, y * T))
    return o

# ================================================================ 키트 조립(보호 영역: 테두리 2px + 가운데 칸)
def protect_mask(margin=2):
    m = np.zeros((KP, KP), bool)
    m[:margin, :] = m[-margin:, :] = True; m[:, :margin] = m[:, -margin:] = True
    c0 = (K // 2) * T; m[c0:c0 + T, c0:c0 + T] = True
    return m

def finish_kit(a, q):
    """보호 영역을 Q 로 되돌린다(무늬가 실수로 닿아도 이음매가 생기지 않게)."""
    base = _arr(tile_q(q, K, K)); pm = protect_mask()
    a = a.copy(); a[pm] = base[pm]
    return _img(a)

def _free(cx, cy, rx, ry, pad=3):
    """(cx,cy) 반지름 (rx,ry) 무늬가 보호 영역에 안 닿는가."""
    c0 = (K // 2) * T - 1; c1 = c0 + T + 2
    if cx - rx < pad or cy - ry < pad or cx + rx > KP - pad or cy + ry > KP - pad: return False
    if cx + rx > c0 and cx - rx < c1 and cy + ry > c0 and cy - ry < c1: return False
    return True

def place(seed, specs, tries=600):
    """specs = [(rx, ry)] 큰 것부터. 서로 덜 겹치게 흩는다. 반환 [(cx,cy,rx,ry)]."""
    r = random.Random(seed); out = []
    for (rx, ry) in specs:
        best = None
        for t in range(tries):
            cx, cy = r.uniform(0, KP), r.uniform(0, KP)
            if not _free(cx, cy, rx, ry): continue
            ov = sum(max(0, (rx + q[2]) * .8 - math.hypot(cx - q[0], (cy - q[1]) * 1.3)) for q in out)
            if ov <= 0: best = (cx, cy); break
            if best is None or ov < best[2]: best = (cx, cy, ov)
        if best: out.append((best[0], best[1], rx, ry))
    return out

# ---------------------------------------------------------------- 구름 바다 무늬
def billow_puffs(cx, cy, rx, ry, seed):
    """뭉게 덩이 하나 = 덩이 4~8개(가운데 높고 큰 덩이, 둘레 작은 덩이), 아래가 눌린 꽃양배추."""
    r = random.Random(seed); n = 3 + int(rx / 4); out = []
    for i in range(n):
        a = r.uniform(0, 2 * math.pi); d = r.uniform(.15, .85)
        x = cx + math.cos(a) * rx * d * .8; y = cy + math.sin(a) * ry * d * .7 - ry * .1
        rad = rx * r.uniform(.30, .48) * (1.15 - d * .5)
        out.append((x, y, max(3.0, rad), max(2.6, rad * r.uniform(.72, .84))))
    out.append((cx, cy - ry * .2, rx * .55, ry * .55))
    return out

def paint_billows(a, groups, ramp=CL, shadow=None, soft=True):
    """groups = [[puff...]]. 덩이들을 한꺼번에 뒤→앞으로 찍고, 아래 윤곽은 바탕에 녹게(soft) 한 단만 어둡게, 오른쪽 아래에 옅은 그림자."""
    puffs = [p for g in groups for p in g]
    if not puffs: return a
    puffs.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, pid = S.paint_puffs(KP, KP, puffs, ramp)
    m = tone >= 0
    if shadow is not None:
        sh = np.zeros_like(m); sh[3:, 2:] = m[:-3, :-2]; sh &= ~m
        yy, xx = np.mgrid[0:KP, 0:KP]
        edge = sh & ~(np.roll(sh, -1, 0) & np.roll(sh, 1, 1))
        sh2 = sh & ~(edge & ((xx + yy) % 2 == 0))
        a[sh2, :3] = shadow
    t = tone.copy()
    if soft:
        t[t == 1] = 3; t[t == 2] = 3
    pal = np.array(ramp, np.uint8)
    a[m, :3] = pal[np.clip(t[m], 0, 6)]
    return a

def paint_trough(a, cx, cy, L, seed, col_dark, col_mid):
    """구름 골: 덩이 사이로 비스듬히 지나는 옅은 그늘 띠(두께 2~3px, 양끝 체크 디더로 사라짐)."""
    r = random.Random(seed); ang = r.uniform(-.25, .25)
    for k in range(int(L)):
        u = k / max(1, L - 1); x = cx + (k - L / 2) * math.cos(ang); y = cy + (k - L / 2) * math.sin(ang) + 2.2 * math.sin(u * math.pi * 2 + seed)
        th = 1 + int(2 * math.sin(math.pi * u) ** .7)
        for j in range(th):
            X, Y = int(x), int(y) + j
            if not (0 <= X < KP and 0 <= Y < KP): continue
            if (u < .15 or u > .85) and (X + Y) % 2: continue
            a[Y, X, :3] = col_dark if j == 0 else col_mid
    return a

def paint_skyhole(a, cx, cy, rx, ry, seed):
    """하늘 틈: 구름 바다에 뚫린 작은 구멍. 위쪽 가장자리는 구름 앞면(라벤더 덩이 띠)이 늘어져 보이고, 아래쪽 가장자리는 흰 테.
    구멍 안은 깊은 하늘(SK3 바탕, 먼 구름 줄 하나)."""
    yy, xx = np.mgrid[0:KP, 0:KP]
    ang = np.arctan2(yy + .5 - cy, xx + .5 - cx)
    k = 1 + .10 * np.sin(ang * 4 + seed) + .06 * np.sin(ang * 7 + seed * 1.7)
    rr = ((xx + .5 - cx) / (rx * k)) ** 2 + ((yy + .5 - cy) / (ry * k)) ** 2
    hole = rr <= 1
    # 구멍 안 하늘 + 위 그늘
    a[hole, :3] = SK[3]
    dith = ((xx + yy) % 2 == 0)
    up = hole & ~np.roll(hole, 3, 0)          # 구멍 위쪽 3px(앞면 바로 밑 하늘 그늘)
    a[up, :3] = SK[2]
    a[hole & ~np.roll(hole, 5, 0) & ~up & dith, :3] = SK[2]
    # 먼 구름 줄
    r = random.Random(seed); y0 = int(cy + ry * .35); L = int(rx * 1.1); x0 = int(cx - L / 2 + r.uniform(-2, 2))
    for i in range(L):
        X = x0 + i
        if 0 <= X < KP and hole[y0, X]: a[y0, X, :3] = SK[4] if (i % 7) else SK[5]
        if 0 <= X < KP and i > 2 and i < L - 3 and hole[y0 - 1, X] and not up[y0 - 1, X]: a[y0 - 1, X, :3] = SK[5]
    # 위쪽 가장자리: 구름 앞면(구멍 밖 위쪽 링 4px) — 아래로 볼록한 덩이 줄
    ring_out = ~hole & np.roll(hole, -1, 0) | ~hole & np.roll(hole, -2, 0) | ~hole & np.roll(hole, -3, 0) | ~hole & np.roll(hole, -4, 0)
    upper = ring_out & (yy + .5 < cy + ry * .15)
    lump = np.sin((xx + seed * 3) * .55) * .5 + .5
    face1 = upper & ~hole & np.roll(hole, -1, 0)
    a[upper, :3] = CL[3]
    a[upper & (lump > .55) & ~face1, :3] = CL[4]
    a[face1, :3] = CL[1]
    a[upper & ~np.roll(upper | hole, 1, 0), :3] = CL[4]
    # 아래·옆 가장자리: 흰 테 + 쪽빛 윤곽
    edge1 = ~hole & (np.roll(hole, 1, 0) | np.roll(hole, 1, 1) | np.roll(hole, -1, 1)) & ~upper
    edge2 = ~hole & ~edge1 & ~upper & (np.roll(edge1, 1, 0) | np.roll(edge1, 1, 1) | np.roll(edge1, -1, 1))
    a[edge1, :3] = CL[2]
    a[edge2 & (yy > cy), :3] = CL[6]
    return a

def _falloff():
    """보호 영역에서 멀어질수록 0→1 (무늬가 테두리·가운데 칸 앞에서 둥글게 끝나게)."""
    from scipy import ndimage as ndi
    m = np.zeros((KP, KP), bool); m[0, :] = m[-1, :] = m[:, 0] = m[:, -1] = True     # 테두리에서만 감쇠(가운데 칸은 덩이를 줄여 비킨다)
    d = ndi.distance_transform_edt(~m)
    return np.clip((d - 3.0) / 7.0, 0, 1)

def cover_puffs(seed, sc, thr, gain, step=9, rmin=4, rmax=13, extra=None):
    """키트 안 구름 덮임(노이즈 덩이 × 보호 영역 감쇠)으로 덩이 목록을 만든다(데모 맵 구름 바다와 같은 방식)."""
    fo = _falloff()
    def cover(X, Y):
        xi, yi = int(min(KP - 1, max(0, X))), int(min(KP - 1, max(0, Y)))
        n = vnoise(X * .85 + Y * .3, Y * 1.25, sc, seed) * .7 + vnoise(X, Y, sc * .45, seed + 1) * .3
        if extra: n += extra(X, Y)
        return max(0., min(1., (n - thr) * gain)) * fo[yi, xi]
    puffs = S._puffs(KP, KP, cover, seed, step=step, rmin=rmin, rmax=rmax)
    # 덩이가 보호 영역에 닿지 않게 반지름을 줄인다
    out = []
    pm = protect_mask(1)
    from scipy import ndimage as ndi
    dist = ndi.distance_transform_edt(~pm)
    for (x, y, rx, ry) in puffs:
        xi, yi = int(min(KP - 1, max(0, x))), int(min(KP - 1, max(0, y)))
        lim = dist[yi, xi] - 1.5
        if lim < 2.5: continue
        k = min(1., lim / max(rx, ry * 1.25))
        out.append((x, y, rx * k, ry * k))
    return out

def kit_cloudsea(variant):
    """구름 바다 6×6 키트(바탕 = 깊은 하늘 Q). 하늘 위로 불규칙한 뭉게구름 덩이가 흘러간다(덩이 크기·자리·덮임이 변형마다 다르다).
    테두리 2px·가운데 칸은 하늘 Q 라 키트끼리·하늘 칸과 어떤 순서로 붙여도 이어진다."""
    q = q_sky(); a = _arr(tile_q(q, K, K))
    seed, sc, thr, gain = {'a': (11, 40, .44, 2.6), 'b': (23, 34, .42, 2.4), 'c': (37, 46, .47, 3.0), 'd': (41, 30, .40, 2.2)}[variant]
    c0 = (K // 2) * T + 8
    repel = lambda X, Y: -.28 * math.exp(-((X - c0) ** 2 + (Y - c0) ** 2) / (2 * 17 ** 2))   # 가운데 칸을 고리처럼 감싸지 않게 덩이를 비켜 둔다
    puffs = cover_puffs(seed, sc, thr, gain, step=10, rmin=4, rmax=16, extra=repel)
    a = paint_billows(a, [puffs], CL, shadow=SK[2], soft=False)
    return finish_kit(a, q)

def kit_cloudcarpet(variant):
    """구름 융단 6×6 키트(바탕 = 구름 Q, 빈틈없이 덮인 구름 바다). 낮은 물결 결 + 솟은 뭉게 덩이 무리, c 는 작은 하늘 틈 둘.
    구름 둑(autotile-cloudbank) 속 칸과 같은 Q 라 둑으로 칠한 큰 덩이 속에 이 키트를 찍어도 이어진다."""
    q = q_cloud(); a = _arr(tile_q(q, K, K))
    seed, sc, thr, gain, holes = {'a': (13, 36, .50, 2.6, []), 'b': (29, 30, .46, 2.4, []), 'c': (43, 44, .56, 3.0, [(11, 7), (7, 5)])}[variant]
    if holes:
        for i, (cx, cy, rx, ry) in enumerate(place(seed, [(rx + 4, ry + 5) for rx, ry in holes])):
            a = paint_skyhole(a, cx, cy, rx - 4, ry - 5, seed + i)
        hole = np.all(a[:, :, :3] == np.array(SK[3], np.uint8), 2) | np.all(a[:, :, :3] == np.array(SK[2], np.uint8), 2)
    # 낮은 물결: 톤 4~6 만(윤곽 없음) — 융단이 울렁이는 결
    lows = cover_puffs(seed + 100, sc * .8, thr - .08, gain, step=10, rmin=5, rmax=12)
    lows = sorted(lows, key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, _ = S.paint_puffs(KP, KP, lows, CL)
    m = tone >= 0
    if holes: m &= ~__import__('scipy.ndimage', fromlist=['x']).binary_dilation(hole, iterations=6)
    t = np.clip(tone, 4, 6); t[(tone <= 2) & m] = 4
    a[m, :3] = np.array(CL, np.uint8)[t[m]]
    puffs = cover_puffs(seed, sc, thr + .08, gain, step=10, rmin=4, rmax=11)
    if holes:
        from scipy import ndimage as ndi
        hd = ndi.distance_transform_edt(~hole)
        puffs = [p for p in puffs if hd[int(min(KP - 1, p[1])), int(min(KP - 1, p[0]))] > p[2] + 4]
    a = paint_billows(a, [puffs], CL, shadow=CL[4])
    return finish_kit(a, q)

def kit_sky(variant):
    """깊은 하늘 6×6 키트(구름 둑 사이 열린 하늘). a: 먼 구름 줄 셋 / b: 먼 작은 뭉게 둘 + 줄 / c: 짙은 하늘 결 + 줄."""
    q = q_sky(); a = _arr(tile_q(q, K, K))
    r = random.Random({'a': 3, 'b': 5, 'c': 8}[variant])
    yy, xx = np.mgrid[0:KP, 0:KP]
    if variant == 'c':     # 짙은 결(큰 덩이 SK2, 체크 디더 경계)
        for (cx, cy, rx, ry) in place(81, [(22, 9), (14, 6)]):
            ang = np.arctan2(yy - cy, xx - cx); k = 1 + .15 * np.sin(ang * 3 + cx)
            d = ((xx - cx) / (rx * k)) ** 2 + ((yy - cy) / (ry * k)) ** 2
            a[d < .75, :3] = SK[2]
            a[(d >= .75) & (d < 1) & ((xx + yy) % 2 == 0), :3] = SK[2]
    if variant == 'b':
        groups = [billow_puffs(cx, cy, rx - 1, ry - 1, 90 + i) for i, (cx, cy, rx, ry) in enumerate(place(91, [(9, 6), (7, 5)]))]
        far = [mix(SK[3], CL[k], .55) for k in range(7)]
        far = [SK[2], SK[3], mix(SK[4], CL[3], .5), mix(SK[4], CL[4], .5), mix(SK[5], CL[5], .5), SK[6], CL[5]]
        a = paint_billows(a, groups, far, shadow=None)
    n = {'a': 3, 'b': 1, 'c': 2}[variant]
    for (cx, cy, rx, ry) in place(70 + n, [(r.randint(14, 24), 3) for _ in range(n)]):
        L = int(rx * 2); x0 = int(cx - rx); y0 = int(cy)
        th = r.choice((2, 3))
        for k in range(L):
            u = k / max(1, L - 1); hh = th * math.sin(math.pi * u) ** .6
            for j in range(int(round(hh))):
                X, Y = x0 + k, y0 - j
                if (u < .12 or u > .88) and (X + Y) % 2: continue
                a[Y, X, :3] = SK[5] if j == int(round(hh)) - 1 else SK[4]
    return finish_kit(a, q)

# ================================================================ 덩이 붓 가장자리(구름 둑·구름 틈·구름 길)
# 가장자리 윤곽은 칸 안 좌표의 16px 주기 물결(덩이 셋이 볼록하게) — 옆 칸과 같은 값에서 만나 이음매가 없다.
def _lobe(u, lobes):
    """u(0..16) 에서 윤곽까지 깊이와 가장 가까운 덩이 안 상대 위치 b(-1..1). lobes=[(c, r, base)] 16 주기 반원 덩이.
    덩이 꼭대기 깊이 = base, 덩이 사이 홈 = base+r(덩이가 모자란 곳은 덩이 중심선까지 채움)."""
    best, bb = 99., 1.
    for (c, r, base) in lobes:
        for k in (-16, 0, 16):
            dx = u - (c + k)
            if abs(dx) < r:
                d = base + r - math.sqrt(r * r - dx * dx)
                if d < best: best, bb = d, dx / r
            else:
                d = base + r
                if d < best: best, bb = d, (1. if dx > 0 else -1.)
    return best, bb

PROF = {   # 쪽마다 반원 덩이 (가운데, 반지름, 꼭대기 깊이) — 칸 안 좌표 16 주기. 칸마다 큰 덩이 하나 + 작은 덩이 하나(크기·깊이 다르게)라
           # 이어 칠해도 같은 간격 톱니로 안 보인다. 깊이 0.5~5.5 로 흔들어 곧은 줄이 안 보이게.
    'N': [(4.0, 6.5, 0.5), (12.5, 3.0, 4.5)],
    'S': [(6.0, 6.0, 0.5), (14.0, 3.4, 3.2)],
    'W': [(5.0, 5.8, 1.0), (13.0, 3.2, 4.8)],
    'E': [(2.5, 3.6, 4.0), (10.0, 6.2, 0.8)],
}
PROF_FRINGE = {   # 구름 번짐: 덩이가 더 크고 깊이 차가 커서 띠가 울퉁불퉁한 둑으로 읽힌다
    'N': [(6.0, 7.0, 0.5), (14.5, 3.0, 6.0)],
    'S': [(3.0, 5.0, 2.5), (11.0, 6.5, 0.5)],
    'W': [(7.0, 7.0, 0.5), (15.0, 3.0, 5.5)],
    'E': [(1.0, 3.2, 5.0), (9.0, 7.0, 0.8)],
}
FACE_H = 5      # 앞면(남쪽) 덩이 띠 높이

def _depths(m, x, y, prof=None):
    prof = prof or PROF
    """칸 안 화소 (x,y) 에서 이웃 없는 쪽마다 (윤곽 안쪽 깊이 e(양수=속), 덩이 안 위치 b). 반환 dict side->(e,b)."""
    N, E, S_, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    out = {}
    u, v = x + .5, y + .5
    if not N: d, bb = _lobe(u, prof['N']); out['N'] = (v - d, bb)
    if not S_: d, bb = _lobe(u, prof['S']); out['S'] = ((16 - v) - d, bb)
    if not W: d, bb = _lobe(v, prof['W']); out['W'] = (u - d, bb)
    if not E: d, bb = _lobe(v, prof['E']); out['E'] = ((16 - u) - d, bb)
    # 볼록 모서리: 반지름 7 로 크게 둥글린다
    for (a_, b_) in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if a_ in out and b_ in out:
            R = 13.0; ea, eb = out[a_][0], out[b_][0]
            if ea < R and eb < R:
                e = R - math.hypot(R - ea, R - eb)
                key = a_ if ea < eb else b_
                other = b_ if key == a_ else a_
                out[key] = (min(out[key][0], e), out[key][1])
                out[other] = (max(out[other][0], out[key][0] + .01), out[other][1])   # 모서리 호는 한 쪽 면으로만 칠한다
    return out

def cloud_edge_cell(m, inner, outer, ramp, invert=False, shadow=None, face=True, prof=None):
    """덩이 붓 칸 하나.
    invert=False(구름 둑·구름 길): 칠한 칸 = 구름(속 inner Q), 칸 밖 = outer(None 이면 투명).
    invert=True(구름 틈): 칠한 칸 = 구멍(속 inner Q = 하늘), 구멍 둘레 = 구름 outer Q.
    윤곽 = 반원 덩이가 이어진 물결(옆 칸과 같은 값에서 만난다). 구름의 면 방향에 따라:
    북·서 = 덩이마다 흰 테(덩이 사이 홈은 한 단 그늘), 동 = 그늘 + 짙은 윤곽, 남 = 앞면 덩이 띠(아래로 볼록, 덩이마다 왼쪽 밝음, 덩이 사이 금)
    + 짙은 윤곽, 그 아래 바탕에 그림자."""
    qi = inner.load() if inner else None; qo = outer.load() if outer else None
    im = new(T, T); p = im.load()
    flip = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}
    fh = FACE_H if face else 3
    for y in range(T):
        for x in range(T):
            ds = _depths(m, x, y, prof)
            if not ds:
                p[x, y] = qi[x, y][:3] + (255,); continue
            side, (e, b) = min(ds.items(), key=lambda kv: kv[1][0])
            if invert:
                cface = flip[side]
                ce = (fh - e) if side == 'N' else -e      # 구멍 위쪽: 구름 앞면이 구멍 안으로 늘어진다
                b = -b if side in ('E', 'W') else b
            else:
                cface = side; ce = e
            if ce > 0:
                # 북동 모서리 꼭대기: 동쪽 짙은 윤곽이 북쪽 흰 테 위로 튀어나오지 않게 북쪽 면으로 칠한다
                nside = 'S' if invert else 'N'
                if cface == 'E' and nside in ds and abs(ds[nside][0]) < 2.5:
                    cface = 'N'; ce = abs(ds[nside][0]); b = 0.
                c = (qo if invert else qi)[x, y][:3]
                crease = abs(b) > .80
                if cface in ('N', 'W'):
                    if ce < 1: c = ramp[3]
                    elif ce < 2.5 and not crease: c = ramp[6] if abs(b) < .55 else ramp[5]
                    elif ce < 3.5 and crease: c = ramp[4]
                    elif ce < 4.2 and abs(b) < .45 and (x + y) % 2: c = ramp[6]            # 덩이 꼭대기 흰빛 한 겹 더
                    elif 5.0 <= ce < 6.0 and abs(b) < .75: c = ramp[4]                     # 덩이 밑 둥근 그늘(한 겹 안쪽 덩이 경계)
                    elif 6.0 <= ce < 7.0 and abs(b) < .55 and (x + y) % 2: c = ramp[4]
                elif cface == 'E':
                    if ce < 1: c = ramp[1]
                    elif ce < 2.5: c = ramp[3] if not crease else ramp[2]
                    elif ce < 3.5 and ((x + y) % 2 or crease): c = ramp[4]
                    elif 5.0 <= ce < 6.0 and abs(b) < .7: c = ramp[4]
                elif cface == 'S':
                    if ce < 1: c = ramp[1]
                    elif ce < fh + 1:
                        k = (ce - 1) / fh               # 0 아래 .. 1 위
                        t = 2.2 + k * 2.6 - b * 1.1
                        if crease: t = 2
                        c = ramp[int(round(max(2, min(5, t))))]
                    elif ce < fh + 2 and (x + y) % 2:
                        c = ramp[4]
                    elif fh + 2 <= ce < fh + 3.2 and abs(b) < .6:
                        c = ramp[6]                     # 앞면 위 덩이 윗면 흰빛
                p[x, y] = c + (255,)
            else:
                oute = -ce
                shade = cface == 'S' and shadow is not None and oute < 3 and (oute < 1.6 or (x + y) % 2)
                if invert:
                    p[x, y] = (shadow if shade else qi[x, y][:3]) + (255,)
                elif shade:
                    p[x, y] = shadow + (255,)
                elif outer is not None:
                    p[x, y] = qo[x, y][:3] + (255,)
    return _tidy(im, m, ramp, inner, outer, invert)

def _tidy(im, m, ramp, inner, outer, invert):
    """외톨이 화소 정리: 구름 화소 중 구름 이웃이 1개 이하면 지우고, 빈 화소가 구름에 3면 이상 둘러싸이면 채운다.
    위가 빈 짙은 윤곽(동쪽 윤곽 꼭대기 돌기)은 북쪽 흰 테 색으로. 칸 밖은 이웃이 있는 쪽이면 구름으로 본다."""
    a = np.array(im)
    qc = np.array((outer if invert else inner).convert('RGBA'))
    cloud_rgb = None
    hole_q = np.array(inner.convert('RGBA')) if invert else None
    def is_cloud(px, x, y):
        if invert:
            return not (px[3] and tuple(px[:3]) in SKYSET)
        return px[3] > 0
    N, E, S_, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    for it in range(2):
        cl = np.zeros((T + 2, T + 2), bool)
        for y in range(T):
            for x in range(T): cl[y + 1, x + 1] = is_cloud(a[y, x], x, y)
        # 칸 밖: 구름 둑은 이웃 있는 쪽 = 구름, 구멍 붓은 이웃 있는 쪽 = 구멍(구름 아님)
        if not invert:
            cl[0, 1:-1] = N; cl[-1, 1:-1] = S_; cl[1:-1, 0] = W; cl[1:-1, -1] = E
        else:
            cl[0, 1:-1] = not N; cl[-1, 1:-1] = not S_; cl[1:-1, 0] = not W; cl[1:-1, -1] = not E
        for y in range(T):
            for x in range(T):
                n4 = int(cl[y, x + 1]) + int(cl[y + 2, x + 1]) + int(cl[y + 1, x]) + int(cl[y + 1, x + 2])
                if cl[y + 1, x + 1] and n4 <= 1:
                    if invert: a[y, x] = list(hole_q[y, x][:3]) + [255]
                    else: a[y, x] = 0
                elif not cl[y + 1, x + 1] and n4 >= 3:
                    a[y, x] = list(qc[y, x][:3]) + [255] if not invert else list(ramp[3]) + [255]
                    if not invert and not cl[y, x + 1]: a[y, x] = list(ramp[3]) + [255]
                    elif not invert and not cl[y + 2, x + 1]: a[y, x] = list(ramp[1]) + [255]
    # 위가 빈 짙은 윤곽 → 흰 테 윤곽색
    for y in range(T):
        for x in range(T):
            up = (a[y - 1, x] if y > 0 else None)
            upc = (is_cloud(up, x, y - 1) if up is not None else (N if not invert else not N))
            if tuple(a[y, x][:3]) == tuple(ramp[1]) and is_cloud(a[y, x], x, y) and not upc:
                a[y, x][:3] = ramp[3]
    return Image.fromarray(a, 'RGBA')

SKYSET = set()

def autotile_cloudbank():
    """구름 둑(위층, 막힘): 하늘 위에 구름 덩이를 칠한다. 속 = 구름 바다 Q, 가장자리 = 볼록한 덩이 윤곽, 남쪽 앞면 띠, 밖은 투명."""
    qi = q_cloud()
    return autotile_sheet(lambda m, *_: cloud_edge_cell(m, qi, None, CL, shadow=SK[2]))
def autotile_cloudgap():
    """구름 틈(위층, 막힘): 구름 바다에 하늘 구멍을 칠한다. 속 = 깊은 하늘 Q, 둘레 = 구름 바다 Q(불투명)."""
    qs, qc = q_sky(), q_cloud()
    return autotile_sheet(lambda m, *_: cloud_edge_cell(m, qs, qc, CL, invert=True, shadow=SK[2]))
def autotile_cloudfringe2():
    """구름 번짐(위층, 막힘): 섬 밑면 뿌리 끝을 묻는 구름 띠. 덩이가 크고 깊이가 들쭉날쭉한 둑(속 = 구름 Q), 끝은 둥글다.
    1차 판(칸마다 같은 솜뭉치 하나)은 이어 칠하면 구슬 줄이 됐다."""
    qi = q_cloud()
    return autotile_sheet(lambda m, *_: cloud_edge_cell(m, qi, None, CL, shadow=SK[2], prof=PROF_FRINGE))
def autotile_cloudpath2():
    """구름 길(아래층, 걷기): 속 = 구름 길 Q, 가장자리 = 상아빛 덩이 테 + 남쪽 앞면 3px, 밖 투명, 남쪽 아래 구름 바다 그림자."""
    qp = q_path()
    return autotile_sheet(lambda m, *_: cloud_edge_cell(m, qp, None, CP, shadow=CL[3], face=False))

# ================================================================ 시험 그림 도우미
def stamp_field(kits, w, h, seed, q=None, pick=None):
    """w×h 칸 면을 키트(6×6)로 이어 찍는다. kits 여럿이면 블록마다 해시로 골라 섞는다(조수가 섞어 찍는 것과 같다)."""
    o = new(w * T, h * T)
    for by in range(0, h, K):
        for bx in range(0, w, K):
            k = kits[int(_hash(bx // K, by // K, seed) * len(kits)) % len(kits)] if pick is None else kits[pick(bx // K, by // K)]
            o.alpha_composite(k, (bx * T, by * T))
    return o

def check_autotile(sheet, under, masks, gap=1):
    """masks: [list of str rows]. under: 바탕 그림 함수(w,h)->RGBA."""
    tiles = []
    for rows in masks:
        H = len(rows); W = len(rows[0]); mk = [[c == '#' for c in r] for r in rows]
        bg = under(W, H)
        from sc_base import at_paint
        at_paint(bg, sheet, mk)
        tiles.append(bg)
    tw = sum(t.width for t in tiles) + gap * T * (len(tiles) - 1); th = max(t.height for t in tiles)
    o = Image.new('RGBA', (tw, th), (24, 24, 32, 255)); x = 0
    for t in tiles: o.alpha_composite(t, (x, 0)); x += t.width + gap * T
    return o

def _init_skyset():
    qs = np.array(q_sky()); SKYSET.update(tuple(int(v) for v in px[:3]) for row in qs for px in row)
    SKYSET.add(tuple(SK[2])); SKYSET.update(tuple(c) for c in (SK[3], SK[4], SK[5]))
_init_skyset()

# ================================================================ 구름 길·대리석 바닥 키트
def kit_cloudpath(variant):
    """구름 길 속 6×6 키트(바탕 = 구름 길 Q). 발에 눌려 납작해진 덩이 포석: 덩이 사이 금(반 단 그늘 1px)과
    덩이 왼쪽 위 흰 점만 — 솟은 덩이가 아니라 밟는 면. 변형마다 포석 덩이 자리·크기·덮임이 다르다."""
    q = q_path(); a = _arr(tile_q(q, K, K))
    seed, sc, thr = {'a': (51, 30, .38), 'b': (63, 22, .34), 'c': (77, 40, .38)}[variant]
    lows = sorted(cover_puffs(seed, sc, thr, 2.4, step=8, rmin=4, rmax=9), key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, pid = S.paint_puffs(KP, KP, lows, CP)
    m = pid > 0
    seam = np.zeros_like(m)
    for dx, dy in ((0, 1), (1, 0)):
        nb = np.roll(np.roll(pid, -dy, 0), -dx, 1)
        seam |= m & (nb != pid)
    seam_c = mix(CP[5], CP[3], .55)
    a[seam, :3] = seam_c
    # 덩이 윗면 흰 점: 덩이 위 가장자리 바로 아래 한 줄(위쪽 이웃이 다른 덩이/빈칸)
    top = m & ~seam & (np.roll(pid, 1, 0) != pid)
    yy, xx = np.mgrid[0:KP, 0:KP]
    a[top & ((xx + yy) % 3 != 0), :3] = CP[6]
    a[m & ~seam & ~top & (tone >= 6) & ((xx + yy) % 2 == 0), :3] = mix(CP[5], CP[6], .5)
    a[m & ~seam & (tone <= 3) & ((xx + yy) % 2 == 0), :3] = mix(CP[5], CP[4], .6)
    return finish_kit(a, q)

def _marble_slab_px(a, x0, y0, w, h, tone_k, seed, smudge=False, crack=False):
    """판석 하나(x0,y0,w,h px, 오른쪽·아래 1px 줄눈 포함). 판 톤(반 단 안팎)·버들항식 옅은 얼룩·잔금."""
    base = mix(TRV[5], TRV[6], tone_k) if tone_k >= 0 else mix(TRV[5], TRV[4], -tone_k)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx, ly = x - x0, y - y0
            if lx == w - 1 or ly == h - 1: c = JOINT()
            elif lx == 0 or ly == 0: c = EDGE_HI() if tone_k < .3 else TRV[6]
            else: c = base
            a[y, x, :3] = c
    r = random.Random(seed)
    if smudge:          # 판 위 옅은 얼룩(버들항 광장의 닳은 자국): 3~6px 덩이, 반 단 어둡게, 가장자리 체크 디더
        cx, cy = x0 + r.uniform(4, w - 5), y0 + r.uniform(4, h - 5); rx, ry = r.uniform(2.5, 4.5), r.uniform(1.5, 2.5)
        for y in range(y0 + 2, y0 + h - 2):
            for x in range(x0 + 2, x0 + w - 2):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d < .6 or (d < 1 and (x + y) % 2): a[y, x, :3] = mix(base, TRV[3], .45)
    if crack:           # 귀퉁이에서 들어온 잔금
        x, y = x0 + w - 3, y0 + 2
        for k in range(int(min(w, h) * .7)):
            if not (x0 + 1 < x < x0 + w - 2 and y0 + 1 < y < y0 + h - 2): break
            a[y, x, :3] = mix(TRV[4], TRV[3], .5)
            x -= 1 if r.random() < .6 else 0; y += 1 if r.random() < .7 else 0

def _inlay(a, cx, cy):
    """판 네 귀가 만나는 줄눈 위의 슬레이트 마름모 상감(반지름 3)."""
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d = abs(dx) + abs(dy); X, Y = cx + dx, cy + dy
            if d <= 3: a[Y, X, :3] = SL[4] if d <= 1 else (SL[3] if dx + dy > 0 else SL[5])
            elif d == 4: a[Y, X, :3] = TRV[3]

def kit_marble(variant):
    """흰 대리석 판석 6×6 키트(바탕 = 16px 판 Q). 안쪽 4×4칸은 큰 판(3×2·2×2·2×1칸)으로 짜고, 톤 다른 판·옅은 얼룩·잔금을 섞는다.
    b 는 판 귀가 만나는 줄눈 위 상감 하나. 큰 판·상감은 테두리 칸과 가운데 칸을 비켜 있어 키트끼리 어떤 순서로도 이어진다."""
    q = q_marble(); a = _arr(tile_q(q, K, K))
    r = random.Random({'a': 5, 'b': 17, 'c': 29}[variant])
    taken = {(3, 3)}; bigcells = set()
    big = {'a': [(3, 2), (2, 2), (2, 1), (1, 2)], 'b': [(2, 2), (2, 2), (2, 1), (1, 2)], 'c': [(3, 1), (2, 2), (1, 2), (2, 1)]}[variant]
    for (w, h) in big:
        for _ in range(300):
            cx, cy = r.randint(1, K - 1 - w), r.randint(1, K - 1 - h)
            cells = {(cx + i, cy + j) for i in range(w) for j in range(h)}
            if cells & taken: continue
            taken |= cells; bigcells |= cells
            _marble_slab_px(a, cx * T, cy * T, w * T, h * T, r.choice((.12, -.12, .25, -.2)), r.randint(0, 999), smudge=r.random() < .6, crack=variant == 'c' and r.random() < .5)
            break
    singles = {'a': 5, 'b': 4, 'c': 7}[variant]
    for _ in range(singles):
        for _ in range(100):
            x, y = r.randrange(K), r.randrange(K)
            if (x, y) not in taken: break
        taken.add((x, y))
        _marble_slab_px(a, x * T, y * T, T, T, r.choice((.3, -.15, -.25, .45)), r.randint(0, 999), smudge=r.random() < .4, crack=variant == 'c' and r.random() < .35)
    if variant == 'b':
        for _ in range(400):
            gx, gy = r.randint(2, K - 2), r.randint(2, K - 2)
            four = {(gx - 1, gy - 1), (gx, gy - 1), (gx - 1, gy), (gx, gy)}
            if (3, 3) in four or four & bigcells: continue      # 네 칸이 낱 판(줄눈이 실제로 만나는 곳)일 때만
            break
        _inlay(a, gx * T - 1, gy * T - 1)
    return finish_kit(a, q)

# ================================================================ 구름 가장자리 조각(흩날리는 구름 꼬리)
def cloud_wisp(w, h, seed, flip=False):
    """구름 둑 가장자리에서 바람에 끌려 나온 꼬리 구름(위층, 투명 바탕): 굵은 머리에서 가늘어지는 덩이 줄, 아래 윤곽은 옅게.
    둑 윤곽의 곧은 데를 끊어 주는 데 쓴다."""
    r = random.Random(seed); puffs = []
    n = max(4, w // 7)
    for i in range(n):
        u = i / (n - 1)
        rad = (h * .34) * (1 - .70 * u) + r.uniform(-.5, .5)
        x = h * .36 + 1 + u * (w - h * .36 - 6); y = h * .62 - rad * .2 + r.uniform(-1., 1.) + u * 1.2
        puffs.append((x, y, max(1.8, rad), max(1.5, rad * .72)))
    puffs.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, _ = S.paint_puffs(w, h, puffs, CL)
    t = tone.copy(); t[t == 1] = 2
    im = new(w, h); p = im.load()
    for y in range(h):
        for x in range(w):
            if tone[y, x] >= 0:
                if (x > w * .78) and (x + y) % 2 and t[y, x] <= 3: continue      # 꼬리 끝 디더로 사라짐
                p[x, y] = CL[int(t[y, x])] + (255,)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im

# ================================================================ 부유섬 바닥 가장자리(석재 섬)
def stone_rim_cell(m, N, E, S_, W):
    """대리석으로 포장한 섬 윗면 가장자리(위층 덧그림): 볼록 모서리는 반지름 6 으로 둥글게 깎이고(깎인 곳 = 하늘 바탕 칸 화소), 이웃 없는 쪽에 갓돌 연석 3px(바깥 1px 짙은 줄눈·밝은 윗면·안쪽 그늘),
    갓돌은 24px 마다 이음매, 남쪽은 갓돌 아래 앞면 2px 가 칸 끝에서 시작한다(아래 face_island_stone 에 이어짐). 속은 투명(밑 바닥이 보인다)."""
    im = new(T, T); p = im.load(); qs = q_sky().load()
    for y in range(T):
        for x in range(T):
            d = {}
            if not N: d['N'] = y
            if not S_: d['S'] = 15 - y
            if not W: d['W'] = x
            if not E: d['E'] = 15 - x
            if not d: continue
            # 볼록 모서리: 반지름 6 으로 둥글게 깎는다(깎인 바깥은 투명 — 밑 바닥 대신 그 아래층이 보이므로, 석재 섬은 섬 모양 칸 밖이 하늘)
            for (a_, b_) in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
                if a_ in d and b_ in d and d[a_] < 6 and d[b_] < 6:
                    rr = 6 - math.hypot(6 - d[a_] - .5, 6 - d[b_] - .5)
                    d[a_] = min(d[a_], int(math.floor(rr))) if rr < d[a_] else d[a_]
            side, e = min(d.items(), key=lambda kv: kv[1])
            if e < 0: p[x, y] = qs[x, y][:3] + (255,); continue          # 깎인 모서리 = 섬 밖 하늘(구름 바다 바탕 칸과 같은 화소)
            if e > 3: continue
            along = x if side in ('N', 'S') else y
            seam = along % 8 == 7 and side in ('N', 'S') or along % 8 == 7 and side in ('W', 'E')
            if side == 'S':
                c = (ST[1], ST[3], TRV[6], TRV[5])[e] if e < 4 else None
            elif side == 'N':
                c = (ST[2], TRV[6], TRV[5], mix(TRV[5], TRV[3], .5))[e]
            elif side == 'W':
                c = (ST[2], TRV[6], TRV[5], mix(TRV[5], TRV[3], .5))[e]
            else:
                c = (ST[1], TRV[4], TRV[5], mix(TRV[5], TRV[3], .5))[e]
            if seam and 0 < e < 3: c = TRV[3]
            p[x, y] = c + (255,)
    return im
def autotile_islandrim_stone(): return autotile_sheet(stone_rim_cell)

def face_stone_sample():
    """석재 섬 단면 3×3(48x48, 가로 이음새 없음): 맨 위 갓돌 그늘 1px, 마름돌 두 단(8px 단, 24px 마다 엇갈린 이음매, 왼쪽 위 밝음),
    그 아래는 버들항 절벽 바위 결(face_island 와 같은 식)로 이어져 밑면 뿌리로 내려간다."""
    import sc_island as I
    im = new(48, 48); p = im.load()
    for y in range(48):
        for x in range(48):
            if y == 0: c = ST[1]
            elif y < 17:
                course = (y - 1) // 8; ly = (y - 1) % 8
                off = 12 if course % 2 else 0
                lx = (x + off) % 24
                c = mix(TRV[4], ST[4], .35) if course == 0 else mix(TRV[4], ST[3], .5)
                if ly == 7 or lx == 23: c = ST[1]
                elif ly == 0 or lx == 0: c = mix(c, TRV[6], .45)
                elif ly == 6: c = mul(c, .9)
                if _hash((x + off) // 24, course, 9) < .35 and 2 < lx < 21 and 1 < ly < 6 and (x + y) % 5 == 0: c = mul(c, .9)
            else:
                c = I.face_px(x, y - 17 + 6, per=48)
                if y < 19: c = mul(c, .62)
            p[x, y] = c + (255,)
    return im

def face_end(sample, side):
    """단면 끝 조각 1×3: 단면 표본 왼쪽(side='w') 또는 오른쪽(side='e') 열을 가져와 끝을 둥글게 깎고 그늘·윤곽을 넣는다.
    단면이 섬 가장자리에서 칼로 자른 듯 끝나지 않게 한다(밑은 좁아진다)."""
    src = sample.crop((0, 0, 16, 48)) if side == 'w' else sample.crop((32, 0, 48, 48))
    a = np.array(src).copy()
    out = np.zeros_like(a)
    for y in range(48):
        cut = int(round(1 + (y / 47) ** 1.4 * 9))           # 아래로 갈수록 더 깎인다
        for x in range(16):
            xx = x if side == 'e' else 15 - x                 # 바깥쪽에서 안쪽 거리 = 15-xx
            outer = 15 - xx
            if outer < cut - 0 and side == 'e' and x > 15 - cut: continue
            if side == 'w' and x < cut: continue
            c = a[y, x].copy()
            edge = (x == cut) if side == 'w' else (x == 15 - cut)
            near = (x - cut) if side == 'w' else (15 - cut - x)
            if edge: c[:3] = mix(ST[1], SK[0], .25)
            elif near < 3: c[:3] = mul(tuple(c[:3]), .62 if side == 'e' else .82)
            out[y, x] = c
    return Image.fromarray(out, 'RGBA')

# ================================================================ 2차 보정(적대 검수 qa/sky-city.md): 6칸 격자 없애기
# 1차 판은 6×6 키트 테두리·가운데 칸을 Q 로 묶어 이음매는 없앴지만, 무늬가 블록 경계를 못 넘어 6칸(96px) 주기의 빈 띠·빈 구멍이 남았다.
# 2차 규칙: 바탕 키트는 무늬 없는 Q 3×3(어디에 몇 번 찍어도 같은 면) 하나. 무늬는 전부 「자유 배치 조각」으로 —
#   하늘·구름: 투명 바탕 구름 덩이 물체(모든 칸 막힘)를 아무 칸에나 겹쳐 흩는다(격자에 묶이지 않는다).
#   구름 길·대리석: 테두리가 Q 와 같은 작은 바닥 조각(1×1~3×3)을 아무 칸 위치에나 찍는다(칸 격자에만 맞으면 이음매 없음).
# → 주기는 16px 바탕 칸뿐이고, 무늬 자리는 조수(또는 데모의 흩기 함수)가 칸 단위로 고르므로 블록 격자가 생기지 않는다.
def kit_base(q, n=3): return tile_q(q, n, n)

def _cluster_puffs(w, h, seed, n=None, flat=.62, big=1.0):
    """w×h px 안을 거의 채우는 뭉게 덩이 무리(아래가 눌린 적운). 가운데 높고 양끝 낮은 둔덕 + 위로 솟은 혹 몇."""
    r = random.Random(seed); out = []
    n = n or max(4, int(w * h / 150))
    for i in range(n):
        u = r.uniform(.08, .92)
        top = h * (.18 + .55 * (2 * abs(u - .5)) ** 1.6)                 # 가운데가 높다
        rad = min(h * .42, w * .2 * big) * r.uniform(.55, 1.0) * (1.1 - abs(u - .5))
        x = w * u; y = r.uniform(top + rad * .8, h - 2 - rad * flat)
        out.append((x, y, max(2.6, rad), max(2.2, rad * r.uniform(.74, .86))))
    for i in range(max(2, n // 3)):                                       # 밑단 덩이(바닥을 고르게)
        u = (i + .5) / max(2, n // 3)
        rad = h * r.uniform(.18, .26)
        out.append((w * (.12 + .76 * u) + r.uniform(-2, 2), h - 2 - rad * .7, rad, rad * .7))
    return out

def cloud_clump(w, h, seed, shadow=True, soft=False, big=1.0):
    """하늘 위 구름 덩이 물체(투명 바탕): 덩이마다 왼쪽 위 흰빛·라벤더 그늘·아래 짙은 윤곽, 밑에 하늘 그림자 2px.
    키트 구름 바다와 같은 그리기(paint_puffs)라 한 하늘에 섞여도 같은 화풍이다."""
    pad = 3
    W2, H2 = w, h
    puffs = _cluster_puffs(W2 - 2 * pad, H2 - pad - 3, seed, big=big)
    puffs = [(x + pad, y + pad, rx, ry) for (x, y, rx, ry) in puffs]
    puffs.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, _ = S.paint_puffs(W2, H2, puffs, CL)
    m = tone >= 0
    a = np.zeros((H2, W2, 4), np.uint8)
    if shadow:
        sh = np.zeros_like(m); sh[3:, 2:] = m[:-3, :-2]; sh &= ~m
        yy, xx = np.mgrid[0:H2, 0:W2]
        edge = sh & ~(np.roll(sh, -1, 0) & np.roll(sh, 1, 1))
        sh &= ~(edge & ((xx + yy) % 2 == 0))
        a[sh, :3] = SK[2] if not soft else CL[4]; a[sh, 3] = 255
    t = tone.copy()
    if soft: t[t == 1] = 2
    a[m, :3] = np.array(CL, np.uint8)[np.clip(t[m], 0, 6)]; a[m, 3] = 255
    return _img(a)

CLUMPS = [  # 이름, 칸 w, h, seed — 크기·모양이 다른 하늘 구름 덩이(모두 막힘). 큰 것은 덩이 무리, 작은 것은 외톨 뭉게.
    ('cloud_clump_xl', 8, 4, 101), ('cloud_clump_l1', 6, 3, 102), ('cloud_clump_l2', 5, 3, 103), ('cloud_clump_m1', 4, 3, 104),
    ('cloud_clump_m2', 4, 2, 105), ('cloud_clump_m3', 3, 2, 106), ('cloud_clump_s1', 2, 2, 107), ('cloud_clump_s2', 2, 1, 108),
    ('cloud_clump_tall', 3, 3, 109), ('cloud_clump_long', 7, 2, 110),
]
BILLOWS = [  # 구름 융단 위 솟은 뭉게(그림자 = 구름 그늘, 아래 윤곽 한 단 옅게). 덩이를 크게 — 작은 뭉게가 도장처럼 되풀이되지 않게
    ('cloud_billow_xl', 7, 3, 205), ('cloud_billow_l', 5, 3, 201), ('cloud_billow_m1', 4, 3, 202), ('cloud_billow_m2', 3, 2, 203), ('cloud_billow_s', 2, 2, 204),
    ('cloud_billow_l2', 6, 3, 206), ('cloud_billow_m3', 4, 2, 207), ('cloud_billow_m4', 3, 3, 208),
]
def clump(name):
    for (n, w, h, sd) in CLUMPS:
        if n == name: return cloud_clump(w * T, h * T, sd)
    for (n, w, h, sd) in BILLOWS:
        if n == name: return cloud_clump(w * T, h * T, sd, soft=True, big=1.7)
    raise KeyError(name)

def sky_streak(w, seed):
    """먼 구름 줄(물체, 투명): 하늘 깊이에 가는 띠 둘이 엇갈려 지나간다(윗줄 밝음, 양끝 디더)."""
    r = random.Random(seed); im = new(w, T); p = im.load()
    for (x0, y0, L, th) in ((r.randint(0, 6), 9, int(w * .7), 3), (int(w * .35), 13, int(w * .55), 2)):
        for k in range(L):
            u = k / max(1, L - 1); hh = th * math.sin(math.pi * u) ** .6
            for j in range(int(round(hh))):
                X, Y = x0 + k, y0 - j
                if not (0 <= X < w and 0 <= Y < T): continue
                if (u < .12 or u > .88) and (X + Y) % 2: continue
                p[X, Y] = (SK[5] if j == int(round(hh)) - 1 else SK[4]) + (255,)
    return im

# ---------------------------------------------------------------- 구름 길·대리석 자유 배치 바닥 조각
def path_patch(w, h, seed):
    """구름 길 조각 w×h칸: 테두리 2px 는 구름 길 Q, 속은 눌린 덩이 포석(덩이 사이 옅은 금·윗변 흰 점)."""
    W2, H2 = w * T, h * T
    q = q_path(); a = _arr(tile_q(q, w, h))
    r = random.Random(seed); puffs = []
    for gy in range(4, H2 - 3, 7):
        for gx in range(4, W2 - 3, 8):
            x, y = gx + r.uniform(-2, 2), gy + r.uniform(-1.5, 1.5)
            d = min(x - 3, W2 - 3 - x, y - 3, H2 - 3 - y)
            if d < 2.5 or r.random() < .18: continue
            rad = min(r.uniform(3.6, 5.6), d)
            puffs.append((x, y, rad, rad * .78))
    puffs.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, pid = S.paint_puffs(W2, H2, puffs, CP)
    m = pid > 0
    seam = np.zeros_like(m)
    for dx, dy in ((0, 1), (1, 0)):
        nb = np.roll(np.roll(pid, -dy, 0), -dx, 1); seam |= m & (nb != pid)
    a[seam, :3] = mix(CP[5], CP[3], .55)
    top = m & ~seam & (np.roll(pid, 1, 0) != pid)
    yy, xx = np.mgrid[0:H2, 0:W2]
    a[top & ((xx + yy) % 3 != 0), :3] = CP[6]
    a[m & ~seam & (tone <= 3) & ((xx + yy) % 2 == 0), :3] = mix(CP[5], CP[4], .6)
    pm = np.zeros((H2, W2), bool); pm[:2] = pm[-2:] = True; pm[:, :2] = pm[:, -2:] = True
    base = _arr(tile_q(q, w, h)); a[pm] = base[pm]
    return _img(a)

PATCHES_PATH = [('cloudpath_cobble_a', 2, 2, 301), ('cloudpath_cobble_b', 3, 2, 302), ('cloudpath_cobble_c', 2, 3, 303), ('cloudpath_cobble_d', 3, 3, 304)]

def marble_patch(kind, seed):
    """대리석 바닥 조각. 칸 격자에 맞춰 아무 데나 찍는다(바깥 줄눈이 Q 칸 줄눈과 같다).
    big WxH: 큰 판 하나 / tone: 톤 다른 낱 판 / worn: 잔금·얼룩 판 2×2 / inlay: 낱 판 넷이 만나는 줄눈 위 상감."""
    r = random.Random(seed)
    if kind[0] == 'big':
        w, h = kind[1], kind[2]; a = _arr(tile_q(q_marble(), w, h))
        _marble_slab_px(a, 0, 0, w * T, h * T, r.choice((.12, -.12, .22)), seed, smudge=r.random() < .7)
    elif kind[0] == 'tone':
        a = _arr(tile_q(q_marble(), 1, 1)); _marble_slab_px(a, 0, 0, T, T, kind[1], seed, smudge=kind[1] < 0)
    elif kind[0] == 'worn':
        a = _arr(tile_q(q_marble(), 2, 2))
        _marble_slab_px(a, 0, 0, 2 * T, T, -.15, seed, crack=True, smudge=True)
        _marble_slab_px(a, 0, T, T, T, .2, seed + 1, crack=True)
        _marble_slab_px(a, T, T, T, T, -.25, seed + 2, smudge=True)
    elif kind[0] == 'inlay':
        a = _arr(tile_q(q_marble(), 2, 2)); _inlay(a, T - 1, T - 1)
    return _img(a)

PATCHES_MARBLE = [('marble_slab_2x2', ('big', 2, 2), 401), ('marble_slab_3x2', ('big', 3, 2), 402), ('marble_slab_2x1', ('big', 2, 1), 403),
                  ('marble_slab_1x2', ('big', 1, 2), 404), ('marble_slab_3x3', ('big', 3, 3), 405), ('marble_slab_light', ('tone', .4), 406),
                  ('marble_slab_dark', ('tone', -.3), 407), ('marble_slab_worn', ('worn',), 408), ('marble_inlay', ('inlay',), 409)]
def path_piece(name):
    for (n, w, h, sd) in PATCHES_PATH:
        if n == name: return path_patch(w, h, sd)
    raise KeyError(name)
def marble_piece(name):
    for (n, k, sd) in PATCHES_MARBLE:
        if n == name: return marble_patch(k, sd)
    raise KeyError(name)

def scatter_cells(mask, sizes, seed, fill=.45, gap=0, avoid=None):
    """칸 마스크(mask[y][x]) 안에 조각(이름, w, h)을 겹치지 않게 흩는다(격자 블록 없음). fill = 덮을 칸 비율 목표.
    반환 [(이름, x, y)]."""
    H = len(mask); W = len(mask[0]); r = random.Random(seed)
    used = [[False] * W for _ in range(H)]
    cells = [(x, y) for y in range(H) for x in range(W) if mask[y][x]]
    target = int(len(cells) * fill); got = 0; out = []
    tries = 0
    while got < target and tries < len(cells) * 40:
        tries += 1
        name, w, h = r.choice(sizes)
        x, y = r.choice(cells)
        ok = all(0 <= x + i < W and 0 <= y + j < H and mask[y + j][x + i] and not used[y + j][x + i] for i in range(-gap, w + gap) for j in range(-gap, h + gap)
                 if 0 <= x + i < W and 0 <= y + j < H) and all(0 <= x + i < W and 0 <= y + j < H and mask[y + j][x + i] for i in range(w) for j in range(h))
        if not ok: continue
        for i in range(w):
            for j in range(h): used[y + j][x + i] = True
        out.append((name, x, y)); got += w * h
    return out

def marble_field(mask, seed, fill=.5):
    """대리석 면(전투 배경·데모 광장 텍스처): Q 판 위에 대리석 조각을 흩는다. 반환 RGBA(마스크 크기 px)."""
    H = len(mask); W = len(mask[0])
    o = tile_q(q_marble(), W, H)
    sizes = [(n, (k[1] if k[0] == 'big' else (1 if k[0] == 'tone' else 2)), (k[2] if k[0] == 'big' else (1 if k[0] == 'tone' else 2))) for (n, k, sd) in PATCHES_MARBLE]
    sizes = [s for s in sizes if s[0] != 'marble_inlay'] * 3 + [s for s in sizes if s[0] == 'marble_inlay']
    for (n, x, y) in scatter_cells(mask, sizes, seed, fill):
        o.alpha_composite(marble_piece(n), (x * T, y * T))
    return o

def scatter_big_first(mask, sizes, seed, fill=.5, gap=0, tries_per=80, hop=.5):
    """scatter_cells 와 같되 큰 조각부터 자리를 잡는다(무리 가운데에 큰 덩이, 빈틈에 작은 덩이)."""
    H = len(mask); W = len(mask[0]); r = random.Random(seed)
    used = [[False] * W for _ in range(H)]
    cells = [(x, y) for y in range(H) for x in range(W) if mask[y][x]]
    if not cells: return []
    target = int(len(cells) * fill); got = 0; out = []
    order = sorted(set(sizes), key=lambda s: -s[1] * s[2])
    for (name, w, h) in order:
        for t in range(tries_per * max(1, len(cells) // 60)):
            if got >= target: break
            x, y = r.choice(cells)
            if not all(0 <= x + i < W and 0 <= y + j < H and mask[y + j][x + i] for i in range(w) for j in range(h)): continue
            if any(used[y + j][x + i] for i in range(-gap, w + gap) for j in range(-gap, h + gap) if 0 <= x + i < W and 0 <= y + j < H): continue
            for i in range(w):
                for j in range(h): used[y + j][x + i] = True
            out.append((name, x, y)); got += w * h
            if r.random() < hop: break                      # 한 크기만 몰리지 않게 다음 크기로
    # 남은 목표는 작은 조각으로 채운다
    small = [s for s in order if s[1] * s[2] <= 4]
    k = 0
    while got < target and small and k < len(cells) * 20:
        k += 1; (name, w, h) = r.choice(small); x, y = r.choice(cells)
        if not all(0 <= x + i < W and 0 <= y + j < H and mask[y + j][x + i] for i in range(w) for j in range(h)): continue
        if any(used[y + j][x + i] for i in range(-gap, w + gap) for j in range(-gap, h + gap) if 0 <= x + i < W and 0 <= y + j < H): continue
        for i in range(w):
            for j in range(h): used[y + j][x + i] = True
        out.append((name, x, y)); got += w * h
    return out
