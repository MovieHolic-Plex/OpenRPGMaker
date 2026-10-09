# 자연 숲 마당 바닥 표본(3x3 = 48x48, 이어 붙여도 이음새 없음, 주기 48) — 칩셋 잔디·들풀·흙 칸 결을 장르 램프로 다시 칠하고
# 풀 포기(크고 작은 덩이)는 화소 해시로 흩어 손으로 찍는다(48 감김). 큰 평면 얼룩(위장무늬) 금지 — 어디서나 알갱이 결이 살아 있다.
#  ground-grass        얼룩진 올리브 풀(기본 바탕, 잔 풀 포기 드문드문)
#  ground-grass-tufty  풀 포기가 크고 많은 거친 풀(같은 바탕 → 서로 이음새 없음)
#  ground-grass-shade  수관 벽 밑·큰 나무 밑 그늘 풀(두 단 어둡고 솔잎·낙엽 부스러기)
#  ground-dirt         맨땅 길 흙(잔돌·발자국 눌림·풀 잔털 몇 올)
#  ground-litter       숲 바닥 낙엽·솔잎 깔린 흙(오두막 뒤·나무 사이)
#  ground-garden-soil  채소밭 이랑 흙(칸마다 가로 이랑 한 줄 — 작물 한 칸에 한 포기)
from nfc_base import *
from px2 import _hash

S = 48
X, Y = np.meshgrid(np.arange(S), np.arange(S))
PG = None


def _pg():
    global PG
    if PG is None: PG = P('nfgrass')
    return PG


def grass_tone(Xa, Ya, seed=401, lo=2.6, hi=4.7, per=48):
    """풀 바탕 톤(0..6) 장 — 잔디 결(밝기 순위) + 들풀 알갱이 + 잔 잡음 덩이(8·4 주기, 감김 per). 바닥·오토타일 속 칸이 같이 쓴다."""
    a = tiled(tex('lawn', 'nfgrass', lo, hi)[1], per, per)
    b = tiled(tex('meadow', 'nfgrass', lo + 0.2, hi + 0.5)[1], per, per)
    m = tnoise(per, per, 8, seed) * 0.6 + tnoise(per, per, 4, seed + 1) * 0.4
    t = np.where(m > 0.52, b, a).astype(int)
    t = np.where(m < 0.30, np.maximum(t - 1, 2), t)                      # 잔 그늘 덩이(한 단 — 알갱이는 그대로)
    t = t[Ya % per, Xa % per]
    hx_ = hash2(Xa % per, Ya % per, seed + 2)
    t = np.where(hx_ > 0.985, 6, t)
    t = np.where((hx_ < 0.035), 2, t)
    return t


def _tuft(a, cx, cy, r, seed, dark=1, per=S, mat='nfgrass'):
    """풀 포기 하나: 반지름 r 의 둥근 덩이에 세로 잎 획(2~4px)을 빽빽이 — 획 끝은 밝고(왼쪽 위 빛) 밑동은 짙다."""
    pg = P(mat)
    n = int(r * r * 2.2)
    for i in range(n):
        ang = _hash(i, 1, seed) * 6.2832; d = math.sqrt(_hash(i, 2, seed)) * r
        x = cx + math.cos(ang) * d * 1.15; y = cy + math.sin(ang) * d * 0.8
        h = 2 + int(_hash(i, 3, seed) * 3)
        lean = -1 if _hash(i, 4, seed) < 0.5 else 1
        rel = (y - cy) / max(1, r)                                          # 위쪽(-1) 획은 밝게, 아래쪽(+1)은 짙게
        tip = 4 + (1 if rel < -0.2 else 0) - (1 if rel > 0.45 else 0) + (1 if math.cos(ang) < -0.5 else 0)
        base = dark + (1 if rel < 0 else 0)
        for k in range(h):
            yy = int(round(y)) - k; xx = int(round(x)) + (lean if k == h - 1 and h > 2 else 0)
            t = base + int((tip - base) * k / max(1, h - 1))
            a[yy % per, xx % per] = pg[max(1, min(6, t))]
    # 밑동 그늘(포기 아래쪽 1px 짙은 띠)
    for dx in range(-int(r) + 1, int(r)):
        yy = int(round(cy + r * 0.8 * math.sqrt(max(0, 1 - (dx / r) ** 2))))
        if _hash(dx, yy, seed + 5) > 0.3: a[yy % per, int(cx + dx) % per] = pg[dark]
    return a


def _scatter_tufts(a, seed, n, rmin, rmax, dark=1):
    for i in range(n):
        cx = _hash(i, 11, seed) * S; cy = _hash(i, 12, seed) * S
        r = rmin + _hash(i, 13, seed) * (rmax - rmin)
        _tuft(a, cx, cy, r, seed * 7 + i, dark=dark)
    return a


def _blades(a, seed, dens, mat='nfgrass'):
    """외톨이 잎 획(2~3px) — 바탕 결에 세로 결을 더한다."""
    pg = P(mat)
    for i in range(int(S * S * dens)):
        x = int(_hash(i, 1, seed) * S); y = int(_hash(i, 2, seed) * S)
        a[y, x] = pg[2]; a[(y - 1) % S, x] = pg[4]
        if _hash(i, 3, seed) > 0.5: a[(y - 2) % S, (x + (1 if _hash(i, 4, seed) > 0.5 else -1)) % S] = pg[5]
    return a


GSEED = 401


def grass_rgb(seed=GSEED):
    return _pg()[grass_tone(X, Y, seed)].copy()


def ground_grass():
    a = grass_rgb()
    a = _blades(a, GSEED + 3, 0.010)
    a = _scatter_tufts(a, GSEED + 20, 3, 2.2, 3.4, dark=2)
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_grass_tufty():
    a = grass_rgb()
    a = _blades(a, GSEED + 3, 0.010)
    a = _scatter_tufts(a, GSEED + 31, 3, 5.0, 6.6, dark=1)                 # 큰 포기
    a = _scatter_tufts(a, GSEED + 32, 5, 2.4, 3.6, dark=2)                 # 작은 포기
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_grass_shade():
    pg = _pg()
    t = grass_tone(X, Y, GSEED, lo=1.6, hi=3.8)
    a = pg[t].copy()
    a = _blades(a, GSEED + 5, 0.012)
    # 솔잎·낙엽 부스러기(붉은 갈색 1~2px)
    pb = P('nfbark')
    lit = hash2(X // 2, Y, GSEED + 40) > 0.95
    a[lit] = pb[3]
    a[np.roll(lit, 1, 1) & ~lit & (hash2(X, Y, GSEED + 41) > 0.5)] = pb[5]
    a = _scatter_tufts(a, GSEED + 42, 4, 3.0, 4.6, dark=1)
    a[hash2(X, Y, GSEED + 43) > 0.992] = pg[5]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def dirt_tone(Xa, Ya, seed=451, per=48):
    """맨땅 길 톤(0..6): 칩셋 고운 흙 결(밝기 순위) + 잔 잡음 두 톤 + 눌린 발자국 홈 + 잔돌 점. 방향 없는 무늬."""
    a = tiled(tex('fine', 'nfdirt', 2.4, 5.0)[1], per, per)
    b = tiled(tex('earth', 'nfdirt', 2.2, 4.8)[1], per, per)[::-1, ::-1]
    m = tnoise(per, per, 8, seed) * 0.6 + tnoise(per, per, 4, seed + 1) * 0.4
    t = np.where(m > 0.55, b, a).astype(int)
    t = t[Ya % per, Xa % per]
    xa, ya = Xa % per, Ya % per
    pock = (hash2(xa // 3, ya // 2, seed + 2) > 0.94) & (hash2(xa, ya // 2, seed + 3) > 0.4)
    t = np.where(pock, 2, t)
    t = np.where(np.roll(pock, 1, 0) & ~pock, np.minimum(t + 1, 5), t)
    t = np.where(hash2(xa, ya, seed + 9) > 0.975, 6, t)
    t = np.where(hash2(xa, ya, seed + 10) > 0.985, 1, t)
    return t


def ground_dirt():
    a = P('nfdirt')[dirt_tone(X, Y)].copy()
    pg = _pg()
    gr = (hash2(X, Y // 2, 461) > 0.988)                                   # 풀 잔털 몇 올
    a[gr] = pg[4]; a[np.roll(gr, -1, 0) & ~gr] = pg[2]
    pr = P('nfrock')
    st = hash2(X, Y, 462) > 0.992
    a[st] = pr[5]; a[np.roll(st, 1, 0) & ~st] = pr[2]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_litter():
    """숲 바닥: 흙 결 위에 낙엽(주황·갈색 잎 3~4px 타원) · 솔잎(가는 2px 획) · 이끼 풀 점."""
    t = dirt_tone(X, Y, 471)
    a = P('nfsoil')[np.clip(t - 1, 1, 5)].copy()
    pa, pb, pg = P('nfaut'), P('nfbark'), _pg()
    for i in range(70):
        x = int(_hash(i, 1, 473) * S); y = int(_hash(i, 2, 473) * S)
        k = _hash(i, 3, 473)
        ramp = pa if k < 0.45 else (pb if k < 0.8 else pg)
        base = 2 + int(_hash(i, 4, 473) * 2)
        pts = [(0, 0, base + 1), (1, 0, base + 2), (-1, 1, base), (0, 1, base + 1), (1, 1, base)]
        if _hash(i, 5, 473) > 0.5: pts += [(2, 0, base + 1)]
        for (dx, dy, tt) in pts: a[(y + dy) % S, (x + dx) % S] = ramp[max(1, min(6, tt))]
        a[(y + 2) % S, x % S] = P('nfsoil')[1]
    nd = hash2(X // 2, Y, 475) > 0.96
    a[nd] = pb[4]; a[np.roll(nd, 1, 0) & ~nd & (hash2(X, Y, 476) > 0.4)] = pb[2]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_garden_soil():
    """밭 이랑: 칸마다 가로 이랑 한 줄(윗면 밝은 흙 둑 y4~9, 위·아래 고랑 그늘). 이랑 위 흙덩이·잔돌. 칸 단위라 작물을 칸 가운데 둔다."""
    ps = P('nfsoil')
    t = dirt_tone(X, Y, 481)
    ly = Y % 16
    ridge = np.where(ly < 2, 1, np.where(ly < 4, 2, np.where(ly < 6, 5, np.where(ly < 10, 4, np.where(ly < 12, 3, np.where(ly < 14, 2, 1))))))
    wob = (hash2(X, Y // 16, 482) > 0.7).astype(int)                        # 둑선 1px 흔들림
    ridge = np.where((ly == 4) & (wob == 1), 3, ridge)
    tt = np.clip(ridge + (t - 4) // 2, 1, 6)
    a = ps[tt].copy()
    clod = (hash2(X // 2, Y // 2, 483) > 0.93) & (ly > 4) & (ly < 11)
    a[clod] = ps[6]; a[np.roll(clod, -1, 0) & ~clod] = ps[2]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


GROUNDS = [
    ('ground-grass', ground_grass, '숲 마당 풀', '얼룩진 올리브 풀(버들항 잔디·들풀 결을 올리브 램프로) + 잔 풀 포기 드문드문 — 이 장소의 기본 바탕.',
     '아래층 바탕. 맵 전체를 먼저 이것으로 깐다. ground-grass-tufty·ground-grass-shade 와 이음새 없이 섞인다.'),
    ('ground-grass-tufty', ground_grass_tufty, '풀 포기 많은 풀', '크고 작은 짙은 풀 포기가 빽빽한 거친 풀. 기본 풀과 같은 바탕이라 칸끼리 섞여도 이음새가 없다.',
     '아래층 바탕. 길에서 먼 곳·수관 벽 가까이·나무 둘레에 불규칙한 덩이로 섞는다(일렬·바둑판 금지). 더 짙은 덩이는 autotile-tallgrass.'),
    ('ground-grass-shade', ground_grass_shade, '그늘 풀', '수관 벽·큰 나무 밑의 두 단 어두운 풀 + 붉은 갈색 솔잎·낙엽 부스러기.',
     '아래층 바탕. 수관 벽(autotile-canopy-wall) 남쪽 1~2칸, 줄기 벽 앞, 큰 나무 수관 밑에 깐다. 경계는 풀 포기·덤불로 흐린다.'),
    ('ground-dirt', ground_dirt, '맨땅 길 흙', '밟혀 다져진 맨흙(고운 흙 결·발자국 눌림·잔돌·풀 잔털 몇 올). autotile-dirt-path 의 속 칸과 같은 결.',
     '아래층 바탕. 길 교차점·오두막 앞마당처럼 넓게 드러난 흙. 풀과 맞닿는 가장자리는 반드시 autotile-dirt-path 로 들쭉날쭉하게 마감한다.'),
    ('ground-litter', ground_litter, '숲 바닥 낙엽', '흙 위에 주황·갈색 낙엽, 솔잎, 이끼 풀 점이 깔린 숲 바닥.',
     '아래층 바탕. 오두막 뒤·장작 더미 둘레·나무 사이 그늘 땅에 작은 덩이로. 가장자리는 autotile-tallgrass·덤불로 흐린다.'),
    ('ground-garden-soil', ground_garden_soil, '밭 이랑 흙', '칸마다 가로 이랑 한 줄(밝은 흙 둑 + 위·아래 고랑 그늘)이 난 갈아엎은 밭흙.',
     '아래층 바탕. 울타리(autotile-garden-fence) 안에만 사각에 가깝게 깐다(밭은 사람이 만든 것이라 네모가 맞다). 작물(crop-*)은 이랑 칸 가운데에 한 칸 한 포기.'),
]

if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    row = Image.new('RGBA', (len(GROUNDS) * 152, 150), (20, 20, 24, 255))
    for i, (n, fn, *_r) in enumerate(GROUNDS):
        im = fn(); big = Image.new('RGBA', (144, 144))
        for j in range(3):
            for k in range(3): big.alpha_composite(im, (j * 48, k * 48))
        row.alpha_composite(big, (i * 152 + 4, 3))
    row.resize((row.width * 2, row.height * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'grounds.png'))
    print('ok')
