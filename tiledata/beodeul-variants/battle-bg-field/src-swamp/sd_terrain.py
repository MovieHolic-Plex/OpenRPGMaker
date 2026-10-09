# 늪 던전 바닥 — 버들항 파이프라인(city_v6 ground·water6·terrain7·roman 판석·castle6 마름돌) 위에 늪 재질만 더한다.
#   늪 풀  = ground.render(칩셋 잔디·그늘 풀 덩이)를 늪빛(어둡고 누런 녹색)으로 바래기(점·결은 칩셋 그대로)
#   진흙   = 칩셋 흙길 타일(64,224)의 점 구조를 칩셋 밀림 진흙 색 7단으로 옮기고 젖은 웅덩이·풀 포기
#   늪물   = water6.Water(자연 물가, 깊이 띠·잔물결)를 탁한 녹청으로, 개구리밥·녹조 점
#   독 연못 = 같은 물을 유독한 녹청(밝은 거품 고리·막)으로
#   물가   = beach 띠(water6 자연 물가)를 모래 대신 젖은 진흙으로
#   널다리 = 칩셋 널판(288,80) 결을 썩은 목재로, 빠진 널·이끼·말뚝 앞면
# 다시 돌리면 같은 그림(해시·고정 시드만).
import os, sys, math, colorsys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
from bd5 import *                       # Scene, terrain, ground, terrain7, water6, v6pieces, pz, px2, np, Image
import roman, castle6
from px2 import _hash, vnoise
from roman import ST, mix, mul
from scipy import ndimage

def hxs(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
# ---------------------------------------------------------------- 새 재질 7단(0=윤곽, 1..6) — 칩셋 밀림 진흙·늪물 색에서 뽑았다
MUD = [hxs(c) for c in ('#1a140c', '#2a2218', '#30281a', '#3e3524', '#54482f', '#6b5c3c', '#87764e')]
OLIVE = [hxs(c) for c in ('#1c2614', '#2f3a1e', '#465430', '#5c693f', '#626f42', '#7a8650', '#98a264')]
MURK = [hxs(c) for c in ('#0a1a14', '#122e24', '#183a2e', '#1f4838', '#2a5a48', '#41765e', '#74aa8c')]
TOX = [hxs(c) for c in ('#08160e', '#123222', '#1c4a2a', '#2a6634', '#3f8440', '#6aa850', '#b4d888')]
WOOD = [hxs(c) for c in ('#1b1024', '#2a1c12', '#3d2a18', '#53391f', '#6a4a2a', '#7f5d36', '#9a7650')]   # 썩은 널(칩셋 목재를 회갈색으로)
LEAF = roman.LEAFR
MOSS = [(20, 58, 39), (32, 80, 48), (75, 130, 50), (88, 160, 53), (115, 184, 62)]

def weather(c, k=0.5):
    """창백한 돌을 이끼 낀 오래된 돌로(고대 숲과 같은 식): 녹회색 쪽으로, 조금 어둡게."""
    return mix(mul(c, 0.92), (120, 132, 112), 0.22 * k)

def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

# ---------------------------------------------------------------- 늪 풀: 칩셋 풀을 늪빛으로(채도↓·명도↓·노랗게)
_SG = {}
def swamp_grass(c, k=1.0):
    key = (c[:3], k)
    if key in _SG: return _SG[key]
    r, g, b = [v / 255 for v in c[:3]]
    h, s_, v = colorsys.rgb_to_hsv(r, g, b)
    if s_ > 0.2 and 0.15 < h < 0.45:                 # 녹색 계열만
        h = h - 0.045 * k; s_ = s_ * (1 - 0.30 * k); v = v * (1 - 0.18 * k)
    rr, gg, bb = colorsys.hsv_to_rgb(h, s_, v)
    o = (int(rr * 255), int(gg * 255), int(bb * 255)); _SG[key] = o
    return o

def swampify(img, k=1.0):
    a = np.array(img); flat = a[..., :3].reshape(-1, 3)
    u, inv = np.unique(flat, axis=0, return_inverse=True)
    m = np.array([swamp_grass(tuple(int(v) for v in c), k) for c in u], np.uint8)
    a[..., :3] = m[inv.reshape(-1)].reshape(a.shape[0], a.shape[1], 3)
    return Image.fromarray(a, 'RGBA')

# ---------------------------------------------------------------- 진흙: 칩셋 흙길 타일의 점 구조 → 진흙 7단
SAND = np.array(terrain.CH.crop((64, 224, 80, 240)).convert('RGB')).astype(int)
_sl = SAND.sum(axis=2); _lo, _hi = _sl.min(), _sl.max()
SAND_T = np.where(_sl >= _hi - 5, 5, np.where(_sl <= _lo + 5, 3, 4))      # 타일의 밝은 점 5, 바탕 4, 어두운 점 3
def mud_px(X, Y, seed=3, wet=0.0):
    """진흙 한 화소. wet 0..1 (물가일수록 어둡고 번들). 큰 덩이 잡음으로 마른 진흙/젖은 진흙 두 톤 덩이, 칩셋 점, 드문 풀 포기·잔돌."""
    t = int(SAND_T[(Y + (X // 16) * 5) % 16, (X + (Y // 16) * 7) % 16])
    n = vnoise(X, Y, 11, seed) * 0.7 + vnoise(X, Y, 4, seed + 1) * 0.3
    if n < 0.40: t -= 1                                   # 젖은 덩이
    if wet > 0.6: t -= 1
    if wet > 0.85: t -= 1
    if n > 0.66 and _hash(X, Y, seed + 2) < 0.06: t += 1
    c = MUD[max(1, min(6, t))]
    if wet > 0.5 and _hash(X, Y, seed + 3) < 0.03: c = MURK[5]               # 번들거리는 물기
    if n > 0.55 and _hash(X // 3, Y // 3, seed + 4) < 0.05 and (X % 3 == 1) and wet < 0.4:   # 마른 풀 포기
        c = OLIVE[4] if Y % 3 == 0 else OLIVE[3]
    return c

def mud_tile(w=48, h=48, seed=3):
    im = Image.new('RGBA', (w, h)); px = im.load()
    for y in range(h):
        for x in range(w): px[x, y] = mud_px(x, y, seed) + (255,)
    return im

# ---------------------------------------------------------------- 늪물·독물 색 옮기기(water6 프레임 → 늪)
def murk_water(arr, poison=None, seed=5):
    """water6 프레임(HxWx4)을 늪물로: 녹청 띠를 MURK 단으로, 잔물결·반짝임은 한 단 밝게. poison(HxW bool) 칸은 독물 TOX 로."""
    a = arr.astype(np.float64); rgb = a[..., :3]; al = a[..., 3] > 0
    L = rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11
    # water6 의 톤: 깊음 ~52 .. 얕음 ~85, 잔물결 ~110+, 반짝 ~190
    t = np.digitize(L, [50, 56, 62, 72, 100, 150]) + 0          # 0..6
    t = np.clip(t, 1, 6)
    out = np.array(MURK, np.float64)[t]
    if poison is not None:
        P = poison & al
        out[P] = np.array(TOX, np.float64)[np.clip(t[P], 1, 6)]
    o = np.zeros_like(arr); o[..., :3] = np.clip(out, 0, 255).astype(np.uint8); o[..., 3] = arr[..., 3]
    return o

# ---------------------------------------------------------------- 개구리밥·녹조(물 위 부유물)
def duckweed(W, H, surf, d, seed=7, dens=0.5):
    """물 위 개구리밥: 큰 덩이 잡음이 높은 곳에 3x2 잎 조각(왼쪽 위 밝음·오른쪽 아래 그늘)이 모여 뜬다. 물가 가까이 더 많다.
    반환 (가면, 톤) — 톤은 OLIVE 단."""
    Y, X = np.mgrid[0:H, 0:W]
    n = water6.vnoise2(W, H, 30, seed) * 0.75 + water6.vnoise2(W, H, 9, seed + 1) * 0.25
    near = np.clip(1 - d / 34.0, 0, 1)
    gx, gy = X // 4, Y // 3                                        # 잎 하나 = 4x3 칸 격자의 한 조각
    lx, ly = X % 4, Y % 3
    cx = (gx * 4).astype(np.int64); cy = (gy * 3).astype(np.int64)
    nc = n[np.clip(cy, 0, H - 1), np.clip(cx, 0, W - 1)]; ncr = near[np.clip(cy, 0, H - 1), np.clip(cx, 0, W - 1)]
    on = ((nc * 0.85 + ncr * 0.3) > (1.02 - dens * 0.5)) & (water6.nhash(gx, gy, seed + 2) < 0.55)
    shape = ((ly == 0) & (lx >= 1) & (lx <= 2)) | ((ly == 1) & (lx <= 2))
    dot = on & shape & surf & (d > 2.5)
    tone = np.where((ly == 0) | (lx == 0), 5, np.where(lx == 2, 3, 4))
    return dot, tone

# ---------------------------------------------------------------- 썩은 널다리(칩셋 널판 결)
PLANK = np.array(terrain.CH.crop((288, 80, 336, 128)).convert('RGB')).astype(int)    # 세로 널 48x48
_pl = PLANK.sum(axis=2)
def plank_tone(lx, ly):
    """칩셋 널판 화소 → 톤 1..6 (밝기 순위)."""
    v = _pl[ly % 48, lx % 48]
    return 1 if v < 150 else (2 if v < 210 else (3 if v < 260 else (4 if v < 310 else (5 if v < 360 else 6))))

def deck_px(X, Y, ori, seed=11):
    """널다리 화소(버들항 잔교처럼 널마다 한 톤 + 1화소 어두운 이음 + 잔 결). ori='h' 동서 다리(널은 남북으로 짧게 누움 = 칩셋 세로 널 결),
    'v' 남북 다리(가로 널). 결은 칩셋 널판 타일에서 ±1 단만 빌리고, 이끼·썩은 얼룩은 드물게."""
    if ori == 'h': lx, ly = X, Y
    else: lx, ly = Y, X
    board = lx // 5; bx = lx % 5
    base = 3 + int(_hash(board, ly // 32, seed + 1) * 2.99)               # 널마다 3..5
    g = plank_tone(lx, ly) - 3                                          # 칩셋 결(-2..+3) → ±1
    t = base + (1 if g >= 2 else (-1 if g <= -2 else 0))
    if bx == 4: t = 1                                                   # 널 사이 이음
    elif bx == 0: t = min(6, t + 1)                                     # 빛 받는 널 모
    if (ly % 32) in (3, 4) and bx in (1, 3) and _hash(board, ly // 32, seed + 2) < 0.6: t = 2   # 못
    c = WOOD[max(1, min(6, t))]
    m = vnoise(X, Y, 6, seed + 2); mm = vnoise(X, Y, 3, seed + 5)
    if m > 0.82 and mm > 0.62 and bx != 4: c = MOSS[0] if mm < 0.72 else MOSS[1]     # 이끼(드물게)
    elif m < 0.16 and bx != 4 and t > 2: c = WOOD[max(1, t - 2)]                      # 젖어 검게 썩은 자리(드물게)
    return c, board

# ================================================================ 화소 단위 물(섬 윤곽이 칸 계단이 되지 않게) — water6.Water 를 그대로 쓰고 수면 가면만 바꾼다
class PWater(water6.Water):
    def __init__(s, pmask, lilies=()):
        Hp, Wp = pmask.shape; s.H, s.W = Hp, Wp
        s.surf = pmask.copy()
        s.beach = np.zeros_like(pmask)
        d = ndimage.distance_transform_edt(s.surf); s.d = d
        Y, X = np.mgrid[0:Hp, 0:Wp]
        TONES = np.array([(42, 106, 96), (33, 88, 78), (28, 74, 68), (26, 70, 64), (20, 60, 54)], np.float64)
        v = np.clip((d - 1.5) / 26.0, 0, 1) * 0.78 + (water6.vnoise2(Wp, Hp, 56, 5) - 0.5) * 0.42 + (water6.vnoise2(Wp, Hp, 19, 6) - 0.5) * 0.16 + (water6.nhash(X, Y, 5) - 0.5) * 0.07
        base = TONES[np.digitize(v, [0.10, 0.28, 0.50, 0.74])]
        nb = np.zeros((Hp, Wp), np.int32) + 99
        for k in range(1, 13):
            sh = np.zeros_like(s.surf); sh[k:] = ~s.surf[:-k]
            nb = np.where((nb == 99) & sh, k, nb)
        f = np.where(nb <= 11, 0.72 + 0.02 * np.clip(nb - 6, 0, 5), 1.0)
        s.base = base * f[..., None]; s.X, s.Y = X, Y
        s.fl = np.full((Hp, Wp), 4, np.int32)
        s.obst = []; s.shade = np.ones((Hp, Wp)); s.refl = []; s.boats = []; s.lilies = list(lilies)

# ---------------------------------------------------------------- 늪 풀 바닥: ground.render 와 같은 칩셋 풀 넷을 늪 비율로(그늘 풀이 바탕)
def swamp_ground(Wp, Hp, canopies, seed=4):
    L = {k: ground.tiled(ground.tex(*v), Wp, Hp) for k, v in ground.TEX.items()}
    L['worn'] = ground.tiled(ground.tex(16, 1776)[4:12, 4:12], Wp, Hp)
    dither = np.random.RandomState(seed).rand(Hp, Wp) * 0.10 - 0.05
    out = L['shade'].copy()
    n1 = ground.smooth(Wp, Hp, 64, seed) * 0.7 + ground.smooth(Wp, Hp, 22, seed + 1) * 0.3
    m = (n1 + dither) > 0.64; out[m] = L['lawn'][m]
    n2 = ground.smooth(Wp, Hp, 36, seed + 2)
    tm = Image.new('L', (Wp, Hp), 0)
    for x, y, w, h in canopies: tm.paste(255, (max(0, x), max(0, y + h // 3), min(Wp, x + w), min(Hp, y + h + 6)))
    from PIL import ImageFilter
    tb = np.array(tm.filter(ImageFilter.GaussianBlur(9))).astype(float) / 255
    n3 = ground.smooth(Wp, Hp, 18, seed + 3)
    m = (tb * 0.75 + n3 * 0.45 + dither) > 0.62; out[m] = L['shade'][m]       # 나무 밑 그늘 풀: 덩이 잡음으로 가장자리를 흐트린다
    return Image.fromarray(out).convert('RGBA')

def soft_field(cells, W, H, sigma=7.0, amp=0.22, seed=1):
    """칸 집합 → 화소 단위 부드러운 0..1 장(가우스 흐림 + 잡음). 0.5 문턱이 칸 계단 없는 자연 윤곽."""
    g = np.zeros((H, W)); 
    for (x, y) in cells:
        if 0 <= x < W and 0 <= y < H: g[y, x] = 1.0
    f = ndimage.gaussian_filter(np.kron(g, np.ones((16, 16))), sigma)
    Wp, Hp = W * 16, H * 16
    return f + (water6.vnoise2(Wp, Hp, 23, seed) - 0.5) * amp + (water6.vnoise2(Wp, Hp, 7, seed + 1) - 0.5) * amp * 0.35

# ================================================================ 늪 장면: bd5.Scene 의 그리기 순서를 늪 재질로
class SwampScene(Scene):
    def __init__(s, *a, **k):
        super().__init__(*a, **k)
        g = lambda v: [[v] * s.W for _ in range(s.H)]
        s.mud = g(False); s.poison = g(False); s.deck = {}; s.stone = set(); s.lilies = []; s.trail = set()
        s.ground_top = []     # (img,x,y) 땅·물 위(널다리 다음, 그림자 전)
    def walk_grid(s):
        return [[(not s.block[y][x]) and ((not s.water[y][x]) or (x, y) in s.deck or (x, y) in s.stone) for x in range(s.W)] for y in range(s.H)]
    def cell_free(s, x, y, lv=None, margin=0):
        if (x, y) in s.deck or (x, y) in s.stone: return False
        return super().cell_free(x, y, lv, margin)

    def set_terrain(s, land, pond, mudc):
        """land: 땅 칸 집합, pond: 독 연못 칸(섬 안 물), mudc: 진흙 칸. 화소 단위 부드러운 윤곽 → 칸 격자(물 = 화소 45% 이상)."""
        W, H = s.W, s.H
        LF = soft_field(land, W, H, 7.5, 0.30, 61)
        PF = soft_field(pond, W, H, 6.5, 0.42, 63)
        s.PP = (PF > 0.5)
        s.PW = (LF < 0.5) | s.PP
        MF = soft_field(mudc, W, H, 5.5, 0.38, 65)
        s.PM = (MF > 0.5) & ~s.PW
        fr = s.PW.reshape(H, 16, W, 16).mean(axis=(1, 3))
        fp = s.PP.reshape(H, 16, W, 16).mean(axis=(1, 3))
        for y in range(H):
            for x in range(W):
                s.water[y][x] = bool(fr[y, x] >= 0.45); s.nat[y][x] = s.water[y][x]
                s.poison[y][x] = bool(fp[y, x] >= 0.3)
                s.mud[y][x] = bool(s.PM[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].mean() > 0.5)

    def render(s, frame=0):
        W, H = s.W, s.H; Wp, Hp = W * 16, H * 16
        img = swamp_ground(Wp, Hp, s.canopies, s.seed)
        px = img.load()
        mm = s.PM
        ys, xs = np.nonzero(mm)
        for y, x in zip(ys, xs): px[int(x), int(y)] = mud_px(int(x), int(y), 3, 0.0) + (255,)
        ring = ndimage.binary_dilation(mm, iterations=2) & ~mm
        ys, xs = np.nonzero(ring)
        for y, x in zip(ys, xs):
            r, g, b, a = px[int(x), int(y)]; px[int(x), int(y)] = (int(r * 0.78), int(g * 0.80), int(b * 0.78), 255)
        if s.trail:                                   # 섬 위 밟힌 오솔길: 테두리 풀 없이 한 단 어두운 젖은 진흙(가장자리 들쭉날쭉)
            TF = soft_field(s.trail, W, H, 3.2, 0.45, 67) > 0.42
            TF &= ~s.PW
            ys, xs = np.nonzero(TF)
            for y, x in zip(ys, xs):
                c = mud_px(int(x), int(y), 6, 0.55)
                if _hash(int(x) // 3, int(y) // 2, 69) < 0.05: c = MUD[1]          # 발자국 우묵
                px[int(x), int(y)] = c + (255,)
        SV = s._mud_track_variants()
        def on(g, x, y): return 0 <= x < W and 0 <= y < H and g[y][x]
        for y in range(H):
            for x in range(W):
                if s.track[y][x]:
                    m = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if on(s.track, x + dx, y + dy) or (x + dx, y + dy) in s.deck)
                    img.alpha_composite(SV[m], (x * 16, y * 16))
        img = swampify(img, 0.7)
        for im, x, y in s.overlays: img.alpha_composite(im, (x, y))
        # 물(화소 가면) — 물가 띠는 땅 쪽 진흙
        WA = PWater(s.PW, s.lilies); s.WA = WA
        fr = WA.frame(frame)
        P = s.PP
        fr = murk_water(fr, P)
        dot, tone = duckweed(Wp, Hp, WA.surf, WA.d, 7, 0.55)
        dot &= ~ndimage.binary_dilation(P, iterations=3)
        fr[dot, :3] = np.array(OLIVE, np.uint8)[tone[dot]]
        Y, X = np.mgrid[0:Hp, 0:Wp]
        scum = P & (WA.d < 3.5) & (water6.nhash(X // 2, Y // 2, 91) < 0.55)
        fr[scum, :3] = np.array(TOX[4], np.uint8)
        img.alpha_composite(s._mud_bank(WA, Wp, Hp))
        img.alpha_composite(Image.fromarray(fr, 'RGBA'))
        img.alpha_composite(s._deck_layer(Wp, Hp))
        for im, x, y in s.ground_top: img.alpha_composite(im, (x, y))
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh and im.height >= 40: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A_ = np.array(img).astype(np.float64); A_[SH, :3] = np.floor(A_[SH, :3] * np.array((0.52, 0.58, 0.74))); img = Image.fromarray(A_.astype(np.uint8), 'RGBA')
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
            img.alpha_composite(im, (x, y)) if (x >= 0 and y >= 0) else img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        for im, x, y in s.top_overlays: img.alpha_composite(im, (x, y))
        s.img = img
        return img

    def _mud_track_variants(s):
        if hasattr(s, '_mtv'): return s._mtv
        s._mtv = terrain7.sand_variants(sand_tile=mud_tile(16, 16, 9), lawn_xy=(112, 2144))
        return s._mtv

    def _mud_bank(s, WA, Wp, Hp):
        """물가 띠: 물에서 2~9화소(잡음) 안쪽 땅을 젖은 진흙으로, 그 바깥 1~2화소는 어두운 풀 테. 물에 닿는 1화소는 짙은 진흙."""
        out = np.zeros((Hp, Wp, 4), np.uint8)
        land = ~WA.surf
        dw = ndimage.distance_transform_edt(land)            # 땅 화소 → 가장 가까운 물까지
        thr = 2.0 + 7.0 * water6.vnoise2(Wp, Hp, 29, 83) + 2.0 * water6.vnoise2(Wp, Hp, 7, 84)
        band = land & (dw <= thr)
        ys, xs = np.nonzero(band)
        for y, x in zip(ys, xs):
            wet = max(0.0, min(1.0, 1.0 - (dw[y, x] - 1) / 5.0))
            c = mud_px(int(x), int(y), 4, wet)
            if dw[y, x] < 1.5: c = MUD[1]
            out[y, x, :3] = c; out[y, x, 3] = 255
        rim = land & (dw > thr) & (dw <= thr + 2.0) & (water6.nhash(s.WA.X, s.WA.Y, 6) < 0.35)
        ys, xs = np.nonzero(rim)
        for y, x in zip(ys, xs):
            out[y, x, :3] = (LEAF[1] if _hash(int(x), int(y), 7) < 0.5 else OLIVE[3]); out[y, x, 3] = 255
        return Image.fromarray(out, 'RGBA')

    def _deck_layer(s, Wp, Hp):
        """널다리 칸(deck_cell, 이웃 비트로) + 남쪽 끝 아래 물에 박힌 말뚝 + 사당 앞 돌 단(판석 윗면·마름돌 앞면)."""
        im = Image.new('RGBA', (Wp, Hp)); px = im.load()
        D = s.deck; S = s.stone
        isd = lambda x, y: (x, y) in D or (x, y) in S
        for (cx, cy), ori in D.items():
            n = (1 if isd(cx, cy - 1) else 0) | (2 if isd(cx + 1, cy) else 0) | (4 if isd(cx, cy + 1) else 0) | (8 if isd(cx - 1, cy) else 0)
            im.alpha_composite(deck_cell(n, ori, cx * 16, cy * 16), (cx * 16, cy * 16))
            if not (n & 4) and cy + 1 < s.H:
                for k, pxo in enumerate((2, 11)):
                    if _hash(cx, cy, 17 + k) < 0.3: continue
                    for ly in range(0, 7):
                        for i in range(3):
                            X, Y = cx * 16 + pxo + i, (cy + 1) * 16 + ly
                            c = (WOOD[4], WOOD[3], WOOD[2])[i]
                            if ly >= 4: c = DM_[1] if i < 2 else MURK[1]
                            px[X, Y] = c + (255,)
                    Y = (cy + 1) * 16 + 7
                    for i in (-1, 3): px[cx * 16 + pxo + i, Y] = MURK[5] + (255,)
        for (cx, cy) in S:
            s_ = (cx, cy + 1) in S; w_ = (cx - 1, cy) in S or (cx - 1, cy) in D; e_ = (cx + 1, cy) in S or (cx + 1, cy) in D; n_ = isd(cx, cy - 1)
            for ly in range(16):
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    if not n_ and ly < 1: continue
                    if not s_ and ly >= 9:                          # 앞면: 젖은 옛 마름돌 2줄 + 물때, 맨 아래는 물에 잠김
                        fy = ly - 9
                        c = weather(castle6.ash(X, fy + 2, 0.9, bw=16, bh=4, seed=31), 1.1)
                        if fy == 0: c = weather(ST[4], 1)
                        c = mul(c, 0.86 - 0.06 * fy)
                        if fy == 4 and _hash(X // 2, cy, 33) < 0.55: c = DM_[1]          # 물 닿는 줄의 이끼 띠
                        if fy >= 5: c = mix(c, MURK[2], 0.55) if fy == 5 else MURK[2]
                    else:
                        c = flag_map(X, Y)
                        if not n_ and ly == 1: c = weather(ST[6], 1)
                    if not w_ and lx == 0: c = ST[1]
                    if not e_ and lx == 15: c = ST[1]
                    px[X, Y] = c + (255,)
        return im

# ================================================================ 이어 붙는 표본(48 주기)·판석·널 칸
def vper(X, Y, sc, seed, P=48): return vnoise(X, Y, sc, seed, per=P // sc)
def mud_px_p(X, Y, seed=3, P=48):
    """48(또는 16) 주기로 감기는 진흙 화소(표본·오토타일용)."""
    t = int(SAND_T[Y % 16, X % 16])
    n = vper(X, Y, 12, seed, P) * 0.7 + vper(X, Y, 4, seed + 1, P) * 0.3
    if n < 0.40: t -= 1
    if n > 0.66 and _hash(X % P, Y % P, seed + 2) < 0.06: t += 1
    c = MUD[max(1, min(6, t))]
    if n > 0.55 and _hash((X % P) // 3, (Y % P) // 3, seed + 4) < 0.05 and (X % 3 == 1): c = OLIVE[4] if Y % 3 == 0 else OLIVE[3]
    return c

def murk_px_p(X, Y, seed=5, P=48, depth=1.0):
    """48 주기 늪물 화소: 덩이 깊이 띠(MURK 2..4) + 잔물결 + 개구리밥 조각."""
    n = vper(X, Y, 16, seed, P) * 0.6 + vper(X, Y, 8, seed + 1, P) * 0.3 + _hash(X % P, Y % P, seed + 2) * 0.1
    t = 2 if n * depth > 0.55 else (3 if n * depth > 0.32 else 4)
    if depth < 0.5: t = 4
    c = MURK[t]
    gy = (Y % P) // 6; ph = int(_hash(gy, 0, seed + 3) * P)
    if (Y % 6 == 2) and ((X + ph) % P) % 16 < 3 and _hash(((X + ph) % P) // 16, gy, seed + 4) < 0.5: c = MURK[5]
    gx4, gy3 = (X % P) // 4, (Y % P) // 3
    if _hash(gx4, gy3, seed + 5) < 0.06 and vper(X, Y, 12, seed + 6, P) > 0.55:
        lx, ly = X % 4, Y % 3
        if (ly == 0 and 1 <= lx <= 2) or (ly == 1 and lx <= 2): c = OLIVE[5] if (ly == 0 or lx == 0) else OLIVE[4]
    return c

FLAG_ROWS = (12, 12, 12, 12)
FLAG_W = ((14, 18, 16), (20, 12, 16), (16, 16, 16), (12, 22, 14))
def flag_px(X, Y, seed=5, P=48):
    """48 주기 이끼 판석(사당 앞 돌 단): 줄 12화소·판 12~22화소, 줄눈 어둡고 이끼, 판마다 명도, 위·왼 모 밝음."""
    yy = Y % P; row = yy // 12; ly = yy % 12
    widths = FLAG_W[row]; off = (row * 7) % P; xs = (X + off) % P
    acc = 0; col = 0; lx = 0; w = widths[0]
    for i, wv in enumerate(widths):
        if xs < acc + wv: col, lx, w = i, xs - acc, wv; break
        acc += wv
    if ly == 11 or lx == w - 1:
        c = mix(mul(ST[3], 0.92), (120, 132, 112), 0.25)
        if vper(X, Y, 6, seed + 9, P) > 0.62: c = DM_[1] if _hash(X % P, Y % P, seed) < 0.6 else DM_[2]
        return c
    h = _hash(col, row, seed + 2)
    base = mix(ST[4], ST[5], 0.15 + 0.35 * h)
    if ly == 0 or lx == 0: base = mix(base, ST[5], 0.4)
    if _hash(X % P, Y % P, seed + 3) < 0.05: base = mix(base, ST[3], 0.6)
    c = mix(mul(base, 0.92), (120, 132, 112), 0.25)
    m = vper(X, Y, 12, seed + 12, P)
    if m > 0.84: c = DM_[2] if vper(X, Y, 4, seed + 13, P) > 0.5 else DM_[1]
    return c
def flag_map(X, Y, seed=5):
    """맵의 돌 단 판석: 버들항 광장 판석(roman.tex_flag)을 바래고 줄눈에 이끼, 드물게 이끼 덩이(주기 없음)."""
    t = roman.tex_flag(X, Y, seed)
    c = weather(t, 1.6)
    if t == ST[3] and vnoise(X, Y, 3.0, seed + 11) > 0.42: c = DM_[1] if _hash(X, Y, seed) < 0.6 else DM_[2]
    m = vnoise(X, Y, 9.0, seed + 12)
    if m > 0.86: c = DM_[2] if vnoise(X, Y, 2.0, seed + 13) > 0.55 else DM_[1]
    return c
DM_ = [(22, 40, 28), (32, 58, 34), (46, 78, 40), (64, 102, 46), (86, 128, 54)]

def deck_cell(n, ori, X0=0, Y0=0, seed=11):
    """널다리 한 칸(16x16 RGBA). n = 이웃 비트(위1·오른2·아래4·왼8). ori 'h' = 동서 다리(널이 남북으로 짧게 누움), 'v' = 남북 다리.
    이웃 없는 위쪽은 2~3화소 물이 비치고, 아래쪽은 널 두께 앞면 4줄(3/4 앞면). 옆 가장자리 1화소 어둡게."""
    im = Image.new('RGBA', (16, 16)); px = im.load()
    n_, e_, s_, w_ = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    top = 0 if n_ else (3 if ori == 'h' else 1)
    left = 0 if w_ else (2 if ori == 'v' else 0)
    right = 15 if e_ else (13 if ori == 'v' else 15)
    face0 = 16 if s_ else 12
    for ly in range(16):
        for lx in range(16):
            X, Y = X0 + lx, Y0 + ly
            if ly < top or lx < left or lx > right: continue
            if ly >= face0:
                k = ly - face0
                c = WOOD[4] if k == 0 else (WOOD[2] if k < 3 else WOOD[1])
                if (X // 5) % 2 == 0 and k == 1: c = WOOD[3]
                if ori == 'h' and X % 5 == 4 and k > 0: c = WOOD[1]
            else:
                c, board = deck_px(X, Y, ori, seed)
                if ly == top and not n_: c = WOOD[6] if ori == 'h' else WOOD[5]
                if (not w_ and lx == left) or (not e_ and lx == right): c = WOOD[1]
                if _hash(board + ((Y if ori == 'h' else X) // 48) * 31, 7, 13) < 0.035 and top + 1 < ly < face0 - 1: c = MURK[1]
            px[lx, ly] = c + (255,)
    return im
