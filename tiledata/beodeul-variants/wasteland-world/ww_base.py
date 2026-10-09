# 세계 붕괴 후 황폐 필드(wasteland-world) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6)을 그대로 부르고,
# 없는 재료(붉은 갈색 흙·붉은 사암·먼지/재·검붉은 고목·바랜 풀·마른 호수 진흙·녹)만 같은 7단 램프(0=윤곽, 1~6=밝기)로 더한다.
#  - 땅: 칩셋 손 도트 흙 타일(점박이 흙·모래흙)을 밝기 순서 그대로 붉은 흙 램프로 다시 칠한다(자체 노이즈 바닥 아님) → 버들항 흙의 점·결.
#        그 위에 갈라진 땅 무늬(보로노이 틈을 덩이로만), 마른 호수는 오그라든 진흙 판(판마다 톤, 위 모 밝고 아래 모 어둡다).
#  - 균열(깊은 골): terrain.render(앞면 3줄·갈빗대 결·윗턱)을 그대로 그린 뒤 밝기 순위로 붉은 사암 지층 램프에 옮기고,
#        앞면 아래쪽은 어둠 속으로 사라지게 한다(바닥이 안 보이는 골). 골 바닥 칸은 어둠 + 먼지 안개.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 화산 지대(volcano-field) vf_base 의 구조를 따른다.
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
sys.path.insert(0, V6)
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
import palette; palette.apply()
import px2, pz, terrain
from px2 import C, PAL, GRAIN, _hash, vnoise


def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- 새 재료 (7단: 0 윤곽, 1~6 밝기. 그림자는 검붉게, 빛은 따뜻하게)
PAL.update({
    'rdirt':  ['#1e0f0b', '#3a1c12', '#58291a', '#753a22', '#91502e', '#ab683e', '#c4845a'],   # 붉은 갈색 흙
    'rrock':  ['#1a0c0c', '#381918', '#552620', '#72382a', '#8e4d36', '#aa6848', '#c68b66'],   # 붉은 사암 바위
    'rstone': ['#22161a', '#43302f', '#665046', '#87705e', '#a68d76', '#c2ab92', '#ddcab0'],   # 바랜 옛 마름돌(먼지 앉은 분홍빛 황토)
    'dust':   ['#1f1a1c', '#3a3234', '#564b4b', '#726562', '#8f817b', '#ab9e95', '#c8bcb0'],   # 재·먼지(회보랏빛)
    'deadw':  ['#120808', '#26100e', '#3b1a16', '#52261e', '#6a3428', '#824536', '#9a5a48'],   # 검붉은 고목
    'drygr':  ['#1e170c', '#3c2e18', '#5c4828', '#7e663c', '#9e8452', '#bca26c', '#d6c08e'],   # 바랜 마른 풀
    'mud':    ['#271c14', '#463426', '#68503a', '#896c50', '#a88a68', '#c2a684', '#dac4a4'],   # 마른 호수 진흙
    'rust':   ['#1a0a0c', '#3a1610', '#622a14', '#8a421c', '#b0602a', '#cc8442', '#e8b276'],   # 녹(미래 폐허 RUST 와 같은 값)
    'oldwood': ['#1a120e', '#33241b', '#4e3828', '#6a4e38', '#866649', '#a0805c', '#b89a74'],  # 바랜 나무(난파선·널)
    'canvas': ['#1c1812', '#383024', '#574c38', '#776a4e', '#958866', '#b0a582', '#cac1a0'],   # 바랜 천막 천
    'abyss':  ['#060304', '#0e0708', '#170c0c', '#211210', '#2c1814', '#3a2018', '#4a2a1e'],   # 골 속 어둠
})
GRAIN.update({'rdirt': (0.20, 1.5), 'rrock': (0.13, 1.8), 'rstone': (0.11, 2.0), 'dust': (0.10, 1.8), 'deadw': (0.18, 1.4),
              'drygr': (0.14, 1.4), 'mud': (0.12, 1.8), 'rust': (0.14, 1.4), 'oldwood': (0.14, 1.2), 'canvas': (0.08, 1.6),
              'abyss': (0.05, 2.0)})


def P(mat): return np.array([hx(c) for c in PAL[mat]], dtype=np.uint8)
def RGB(mat, t): return hx(PAL[mat][max(0, min(6, int(t)))])
def R7(mat): return [hx(c) for c in PAL[mat]]


# 불(모닥불) — 버들항 'fire' 램프
FIRE = [hx(c) for c in PAL['fire']]


# ---------------------------------------------------------------- 잡음
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def smooth(W, H, sc, seed):
    """ground.smooth 와 같은 부드러운 잡음 0..1 (픽셀)."""
    r = np.random.RandomState(seed).rand(H // sc + 3, W // sc + 3)
    im = Image.fromarray((r * 255).astype(np.uint8)).resize(((W // sc + 3) * sc, (H // sc + 3) * sc), Image.BICUBIC)
    return np.array(im)[:H, :W].astype(float) / 255


def tnoise(W, H, sc, seed):
    """주기 잡음(가장자리가 감긴다) — 바닥 표본 3x3 이음새 없음."""
    gw, gh = max(1, W // sc), max(1, H // sc)
    g = np.random.default_rng(seed).random((gh, gw))
    xs = (np.arange(W) + 0.5) / sc; ys = (np.arange(H) + 0.5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % gw; y1 = (y0 + 1) % gh; x0 %= gw; y0 %= gh
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    return (a * (1 - fx[None]) + b * fx[None]) * (1 - fy[:, None]) + (c * (1 - fx[None]) + d * fx[None]) * fy[:, None]


def _h(ix, iy, seed):
    ix = np.asarray(ix, np.int64); iy = np.asarray(iy, np.int64)
    h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffff) / float(0x1000000)


def _wrap(i, n): return i % n if n else i


def voro(X, Y, sx, sy, seed, per=None):
    """보로노이(마왕성 df_lava.voro 와 같은 식): (가장 가까운 거리, 둘째 거리, 칸 번호, 씨앗 px x, 씨앗 px y)."""
    gx = X / sx; gy = Y / sy
    ix = np.floor(gx).astype(np.int64); iy = np.floor(gy).astype(np.int64)
    nx = per // sx if per else 0; ny = per // sy if per else 0
    d1 = np.full(X.shape, 9.0); d2 = np.full(X.shape, 9.0); idv = np.zeros(X.shape, np.int64)
    sxp = np.zeros(X.shape); syp = np.zeros(X.shape)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx = ix + dx; cy = iy + dy
            wx = _wrap(cx, nx); wy = _wrap(cy, ny)
            px = cx + .15 + .7 * _h(wx, wy, seed); py = cy + .15 + .7 * _h(wx, wy, seed + 1)
            d = np.sqrt((gx - px) ** 2 + (gy - py) ** 2)
            nid = wx * 7919 + wy * 104729
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            d1 = np.where(closer, d, d1)
            idv = np.where(closer, nid, idv)
            sxp = np.where(closer, px * sx, sxp); syp = np.where(closer, py * sy, syp)
    return d1, d2, idv, sxp, syp


# ---------------------------------------------------------------- 칩셋 타일을 다른 램프로 (밝기 순서 보존)
def lum(a): return 0.30 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def recolor_tile(rgb, mat, lo, hi):
    """칩셋 타일 화소의 밝기 '순위'를 램프 톤 lo..hi 로 옮긴다(타일의 점·결 무늬 그대로)."""
    l = lum(rgb.astype(np.float64))
    vals = np.unique(l)
    rank = np.searchsorted(vals, l) / max(1, len(vals) - 1)
    t = np.clip(np.rint(lo + rank * (hi - lo)), 0, 6).astype(int)
    return P(mat)[t], t


def chip_tex(x, y, w=16, h=16): return np.array(pz.chip(x, y, w, h).convert('RGB')).astype(np.uint8)


def tiled(t, W, H):
    ry = -(-H // t.shape[0]); rx = -(-W // t.shape[1]); return np.tile(t, (ry, rx) + (1,) * (t.ndim - 2))[:H, :W]


# 바닥 재질: 칩셋 원본 타일 → 황폐 램프
#   earth  : 점박이 흙(16,224) → 붉은 흙 1.8~4.6 (기본 바닥)
#   hard   : 고운 모래흙(64,224) → 다져진 붉은 흙 2.4~4.8 (바람에 쓸린 단단한 땅 덩이)
#   dust   : 고운 모래흙(64,224) → 재·먼지 2.6~4.9 (재가 쌓인 자리)
#   mud    : 고운 모래흙(64,224) → 마른 호수 진흙 2.6~5.0
#   dark   : 점박이 흙 → 그늘진 붉은 흙 1.0~3.4 (골 가장자리)
GROUND_SRC = {'earth': ((16, 224), 'rdirt', 1.8, 4.6), 'hard': ((64, 224), 'rdirt', 2.4, 4.8),
              'dust': ((64, 224), 'dust', 2.6, 4.9), 'mud': ((64, 224), 'mud', 2.6, 5.0), 'dark': ((16, 224), 'rdirt', 1.0, 3.4)}
_GT = {}
def ground_tex(name):
    if name not in _GT:
        (x, y), mat, lo, hi = GROUND_SRC[name]
        _GT[name] = recolor_tile(chip_tex(x, y), mat, lo, hi)
    return _GT[name]


def soft_val(m, seed, sigma=8.0, warp=8.0):
    H, W = m.shape
    if not m.any(): return np.zeros((H, W))
    Y, X = np.mgrid[0:H, 0:W]
    dx = np.rint((smooth(W, H, 9, seed) - 0.5) * 2 * warp).astype(int); dy = np.rint((smooth(W, H, 9, seed + 1) - 0.5) * 2 * warp).astype(int)
    mw = m[np.clip(Y + dy, 0, H - 1), np.clip(X + dx, 0, W - 1)]
    return ndi.gaussian_filter(mw.astype(np.float64), sigma)


def soft_mask(m, seed, sigma=5.0, warp=6.0):
    """칸 마스크(화소)를 화소 단위로 흔들고 둥글린다 — 네모 칸 모양이 안 남게."""
    if not m.any(): return m
    H, W = m.shape
    Y, X = np.mgrid[0:H, 0:W]
    dx = np.rint((smooth(W, H, 9, seed) - 0.5) * 2 * warp).astype(int); dy = np.rint((smooth(W, H, 9, seed + 1) - 0.5) * 2 * warp).astype(int)
    mw = m[np.clip(Y + dy, 0, H - 1), np.clip(X + dx, 0, W - 1)]
    b = ndi.gaussian_filter(mw.astype(np.float64), sigma)
    return (b + (smooth(W, H, 4, seed + 2) - 0.5) * 0.3) > 0.5


def crack_lines(X, Y, seed, per=None, sc=22, keep=None, thick=0.075):
    """갈라진 땅 틈: 큰 보로노이 칸의 경계선(1px 주) — keep(0..1 배열)이 큰 곳만 남겨 덩이로 갈라진다.
    돌려주는 값: (틈 화소, 틈 바로 아래 밝은 턱 화소)."""
    d1, d2, rid, _, _ = voro(X, Y, sc, sc, seed, per)
    cr = (d2 - d1) < thick
    if keep is not None: cr &= keep
    lip = np.roll(cr, 1, 0) & ~cr
    return cr, lip


def mud_plates(X, Y, seed, per=None, sc=11):
    """마른 호수 진흙 판: (톤 배열 0..6, 틈 마스크). 판마다 톤, 판 위 모(위로 말려 빛 받는다) 밝고 아래 모 어둡다, 판 사이 틈은 1~2px."""
    d1, d2, rid, _, _ = voro(X, Y, sc, sc * 0.8 if per is None else sc, seed, per)
    rv = _h(rid, rid * 3 + 1, seed + 1)
    t = np.where(rv < 0.3, 3, np.where(rv < 0.8, 4, 5)).astype(int)
    gap = (d2 - d1) < 0.10
    same = lambda dy, dx: np.roll(np.roll(rid, dy, 0), dx, 1) == rid
    top = ~same(1, 0) & ~gap
    bot = ~same(-1, 0) & ~gap
    t = np.where(top, t + 1, t)
    t = np.where(bot & ~top, t - 1, t)
    g = hash2(X, Y, seed + 2)
    t = np.where(g > 0.96, t + 1, np.where(g < 0.04, t - 1, t))
    t = np.where(gap, 1, t)
    t = np.where(np.roll(gap, 1, 0) & ~gap, np.maximum(t - 2, 1), t)        # 틈 바로 아래는 그늘
    return np.clip(t, 0, 6), gap


def ground_render(W, H, seed, dark_px=None, dust_mask=None, mud_mask=None, hard_mask=None):
    """붉은 흙 기본 + 다져진 땅 덩이 + 갈라진 틈(덩이로) + 재 쌓인 자리 + 마른 호수 진흙 판 + 골 곁 그늘.
    W,H 는 화소. 반환 RGB uint8 배열과 라벨(0 흙,1 다져진 땅,2 재,3 진흙,4 그늘)."""
    L = {k: tiled(ground_tex(k)[0], W, H) for k in GROUND_SRC}
    dither = np.random.RandomState(seed).rand(H, W) * 0.10 - 0.05
    out = L['earth'].copy(); lab = np.zeros((H, W), np.uint8)
    Y, X = np.mgrid[0:H, 0:W]
    n1 = smooth(W, H, 56, seed) * 0.7 + smooth(W, H, 18, seed + 1) * 0.3
    m = (n1 + dither) > 0.74
    if hard_mask is not None: m |= soft_mask(hard_mask, seed + 7) & ((smooth(W, H, 6, seed + 9) + dither) > 0.2)
    out[m] = L['hard'][m]; lab[m] = 1
    # 갈라진 땅: 큰 칸 틈(다져진 땅 덩이 안과 그 둘레에 많이, 그 밖은 드문드문)
    keep = (smooth(W, H, 40, seed + 21) > 0.52) | (m & (smooth(W, H, 12, seed + 22) > 0.35))
    cr, lip = crack_lines(X, Y, seed + 23, None, 22, keep, 0.07)
    pe = P('rdirt')
    out[cr] = pe[1]; out[lip] = pe[5]
    # 잔 틈(가지): 작은 칸 경계, 큰 틈 곁에서만
    near = ndi.binary_dilation(cr, iterations=5)
    cr2, lip2 = crack_lines(X, Y, seed + 24, None, 9, near & (hash2(X // 3, Y // 3, seed + 25) > 0.35), 0.06)
    cr2 &= ~cr
    out[cr2] = pe[2]; out[lip2 & ~cr] = pe[4]
    # 재 쌓인 자리
    if dust_mask is not None:
        b = soft_val(dust_mask, seed + 8, 7.0, 9.0)
        md = b > (smooth(W, H, 6, seed + 10) * 0.6 + 0.22 + dither * 2)
        out[md] = L['dust'][md]; lab[md] = 2
        # 재 위 바람 물결(가는 가로 골)
        ph = (Y + 2.4 * np.sin(X / 8.0 + smooth(W, H, 24, seed + 12) * 6.28) + smooth(W, H, 7, seed + 13) * 2.0)
        rip = md & (np.floor(ph) % 9 == 0) & (smooth(W, H, 5, seed + 14) > 0.5)
        out[rip] = P('dust')[2]
    # 마른 호수 진흙
    if mud_mask is not None:
        mm = soft_mask(mud_mask, seed + 31, 4.0, 7.0)
        t, gap = mud_plates(X, Y, seed + 33)
        rgb = P('mud')[t]
        salt = mm & ~gap & (smooth(W, H, 7, seed + 34) > 0.62) & (hash2(X, Y, seed + 35) > 0.55)
        rgb = np.where(salt[..., None], P('bone')[6] if 'bone' in PAL else P('mud')[6], rgb)
        out[mm] = rgb[mm]; lab[mm] = 3
        # 옛 물가 줄: 진흙 가장자리 둘레 3~4px 어두운 젖은 띠 + 바깥 흰 소금 테
        dd = ndi.distance_transform_edt(~mm)
        ring1 = (~mm) & (dd <= 2.0) & (hash2(X // 2, Y, seed + 36) > 0.15)
        ring2 = (~mm) & (dd > 2.0) & (dd <= 3.5) & (hash2(X, Y // 2, seed + 37) > 0.45)
        out[ring1] = P('mud')[2]; out[ring2] = P('mud')[5]
        lab[ring1 | ring2] = 3
    if dark_px is not None:
        n3 = smooth(W, H, 10, seed + 4)
        md = (dark_px * 0.85 + n3 * 0.3 + dither) > 0.66
        md &= lab != 3
        out[md] = L['dark'][md]; lab[md] = 4
    return out, lab


# ---------------------------------------------------------------- 깊은 골: terrain.render → 붉은 사암 지층, 아래는 어둠
def chasm_render(lev, seed=5, void=()):
    """버들항 절벽(앞면 3줄, 갈빗대 결, 윗턱)을 그대로 그린 뒤 밝기 순위로 황폐 램프에 옮긴다.
    앞면 지층(위→아래): 겉흙(붉은 흙) · 붉은 사암 · 밝은 재 층(얇게 출렁인다) · 붉은 사암 · 어두운 사암 → 밑 1/3 은 어둠으로 사라진다.
    void: 골 바닥 칸(앞면이 아닌 낮은 칸) — 어둠과 먼지 안개로 칠한다. 반환 (RGBA, faces)."""
    im = terrain.render(lev, None, (), ())
    a = np.array(im).astype(np.float64)
    H, W = len(lev), len(lev[0])
    F = terrain.faces(lev)
    Fk = np.kron(np.array(F), np.ones((16, 16), int))
    Y, X = np.mgrid[0:H * 16, 0:W * 16]
    ly = Y % 16; fy = ly + (Fk - 1) * 16
    al = a[..., 3] > 0
    l = lum(a)
    face = al & (Fk > 0)
    if face.any(): lo_, hi_ = np.percentile(l[face], 3), np.percentile(l[face], 97)
    else: lo_, hi_ = 20, 175
    t = np.clip(np.rint(0.7 + (l - lo_) / max(1, hi_ - lo_) * 4.9), 1, 6).astype(int)
    wob = (smooth(W * 16, H * 16, 18, seed) - 0.5) * 6 + (smooth(W * 16, H * 16, 6, seed + 1) - 0.5) * 2
    th = 3 + smooth(W * 16, H * 16, 24, seed + 5) * 3
    mid = 15 + wob * 1.2
    soil = face & (fy >= 3) & (fy < 8 + wob * 0.4)
    ashl = face & (fy >= mid) & (fy < mid + th)
    deep = face & (fy >= 27 + wob * 0.6)
    rgbR = P('rrock')[t]; rgbS = P('rdirt')[np.clip(t, 1, 5)]; rgbA = P('dust')[np.clip(t + 1, 3, 6)]
    rgbD = P('rrock')[np.clip(t - 1, 1, 4)]
    out = a.copy()
    sel = np.where(ashl[..., None], rgbA, np.where(soil[..., None], rgbS, np.where(deep[..., None], rgbD, rgbR)))
    out[..., :3] = np.where(face[..., None], sel, out[..., :3])
    e1 = face & (fy >= mid - 1) & (fy < mid); out[e1, :3] = P('rrock')[1]
    e2 = face & (fy >= mid + th) & (fy < mid + th + 1); out[e2, :3] = P('rrock')[4]
    # 밑으로 갈수록 어둠에 잠긴다: fy 30..47 을 체커 디더로 어둡게
    BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    bay = np.tile(BAY, (H * 16 // 4 + 1, W * 16 // 4 + 1))[:H * 16, :W * 16]
    fade = np.clip((fy - 29 - wob * 0.5) / 16.0, 0, 1)
    dk = face & (fade > bay * 0.9 + 0.05)
    ab = P('abyss')
    out[dk, :3] = ab[np.clip(3 - (fade[dk] * 3).astype(int), 0, 3)]
    dk2 = face & (fade > 0.85)
    out[dk2, :3] = ab[1]
    # 윗턱(평지 가장자리 풀빛 → 흙빛)
    rest = al & ~face
    tr = np.clip(np.rint(0.8 + (l - 20) / (200 - 20) * 5.4), 1, 6).astype(int)
    out[rest, :3] = P('rdirt')[tr][rest]
    # 골 바닥(앞면 아래 칸): 어둠 + 먼지 안개 띠
    vm = np.zeros((H, W), bool)
    for (x, y) in void:
        if 0 <= x < W and 0 <= y < H and not F[y][x]: vm[y, x] = True
    vp = np.kron(vm, np.ones((16, 16), bool))
    if vp.any():
        haze = smooth(W * 16, H * 16, 12, seed + 9)
        k = np.where(haze > 0.62, 2, np.where(haze > 0.45, 1, 0))
        k = np.where((hash2(X, Y, seed + 10) > 0.985), 3, k)
        out[vp, :3] = ab[k][vp]; out[vp, 3] = 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').copy(), F


def near_rim(lev, void, seed=9):
    """골 남쪽(가까운 쪽) 가장자리: 높은 땅 칸이 골 위로 끝나는 곳에 1~3px 들쭉날쭉한 흙 턱 + 1px 어두운 윤곽 + 밝은 윗모.
    terrain 의 북쪽 테두리(밝은 2px) 대신 이것을 덮는다. RGBA 레이어."""
    H, W = len(lev), len(lev[0])
    im = Image.new('RGBA', (W * 16, H * 16)); px = im.load()
    vs = set(void)
    pe = R7('rdirt')
    for (x, y) in vs:
        if (x, y + 1) in vs or y + 1 >= H: continue
        if lev[y + 1][x] <= lev[y][x]: continue
        # (x,y) 는 골 맨 아랫줄, (x,y+1) 은 가까운 쪽 땅. 땅 윗변이 골 쪽으로 0~3px 튀어나온다
        for lx in range(16):
            X = x * 16 + lx
            j = int(_hash(X // 2, y, seed) * 3.2)
            for k in range(j):
                put(px, W * 16, H * 16, X, y * 16 + 15 - k, pe[4] if k == j - 1 else pe[3])
            put(px, W * 16, H * 16, X, y * 16 + 15 - j, pe[0])
            put(px, W * 16, H * 16, X, y * 16 + 16, pe[5] if _hash(X, y, seed + 1) > 0.3 else pe[6])
            if _hash(X, y, seed + 2) > 0.55: put(px, W * 16, H * 16, X, y * 16 + 17, pe[4])
    return im


# ---------------------------------------------------------------- 그리기 도우미
def F(c, k=0.62): return pz.fin(c, k)


def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)


def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)); return o


def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def shear_down(im, k, pivot_left=True):
    """세로 열마다 아래로 밀어 기울인다(오른쪽이 가라앉는다): 열 x 를 round(x*k) px 아래로. 화소는 그대로(회전 아님).
    높이는 늘어난다. k<0 이면 왼쪽이 가라앉는다."""
    a = np.array(im.convert('RGBA'))
    h, w = a.shape[:2]
    sh = [int(round((x if k > 0 else (w - 1 - x)) * abs(k))) for x in range(w)]
    mx = max(sh)
    o = np.zeros((h + mx, w, 4), np.uint8)
    for x in range(w): o[sh[x]:sh[x] + h, x] = a[:, x]
    return Image.fromarray(o, 'RGBA')


def shear_right(im, k):
    """가로 줄마다 오른쪽으로 밀어 기울인다(위가 오른쪽으로 기운다): 줄 y 를 round((h-1-y)*k) px. 화소는 그대로."""
    a = np.array(im.convert('RGBA'))
    h, w = a.shape[:2]
    sh = [int(round((h - 1 - y) * k)) for y in range(h)]
    mx = max(sh)
    o = np.zeros((h, w + mx, 4), np.uint8)
    for y in range(h): o[y, sh[y]:sh[y] + w] = a[y]
    return Image.fromarray(o, 'RGBA')


class Parts:
    """조각 저장 + partmeta.json + parts.md (앞 웨이브와 같은 형식)."""
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        for f in os.listdir(s.dir):
            if f.endswith('.png'): os.remove(os.path.join(s.dir, f))
        s.meta = {}; s.imgs = {}; s.order = []
    def add(s, name, im, kind, ko, desc, rules, brows=None, layer=None, role=None, pad=True, passable=None):
        im = pad16(im.convert('RGBA')) if pad else im.convert('RGBA')
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if layer: m['layer'] = layer
        if role: m['role'] = role
        if passable is not None: m['passable'] = passable
        s.meta[name] = m
        im.save(os.path.join(s.dir, name + '.png'))
    def finish(s, title):
        json.dump(s.meta, open(os.path.join(s.out, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title]
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s / %dx%d칸' % (n, im.width, im.height, m['ko'] + ': ' + m['desc'], im.width // 16, im.height // 16))
        lines.append('\n합계: %d 조각' % len(s.order))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)


def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh


def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
