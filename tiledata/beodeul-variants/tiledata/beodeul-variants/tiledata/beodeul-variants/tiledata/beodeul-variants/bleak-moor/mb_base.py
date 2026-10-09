# 음산한 황야(bleak-moor) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6: palette·px2·pz)을 그대로 부르고,
# 고딕 장르 재질(tiledata/beodeul-kits/genres/gothic.md)만 같은 7단 램프(0=윤곽, 1~6=밝기)로 더한다.
#  - 풀·흙 바닥: 칩셋 손 도트 풀/흙 타일의 밝기 순위를 그대로 시든 회록 풀·흑회 이탄 램프로 다시 칠한다(자체 노이즈 바닥 아님).
#  - 주기 잡음·16변형 가장자리(edge_depth/edge_taper)는 앞 장소(plains-highroad wl·desert-castle dc_fix)와 같은 식을 이 폴더에 복사했다.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음.
import os, sys, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
sys.path.insert(0, V6)
import numpy as np
from PIL import Image
import palette; palette.apply()
import px2, pz
from px2 import C, PAL, GRAIN, _hash, vnoise


def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- 고딕 황야 재료(7단: 0 윤곽, 1~6 밝기, 채도 40~55%, 청회 바탕)
PAL.update({
    'mgrass': ['#121814', '#232c25', '#344033', '#4a5a48', '#5d6c55', '#76846a', '#949e82'],   # 시든 회록 황야 풀
    'mgdry':  ['#1a1812', '#302c22', '#474131', '#5f5843', '#776f56', '#90886c', '#aaa286'],   # 바랜 마른 풀 이삭(회황)
    'heath':  ['#161016', '#2a1d27', '#3e2b39', '#54394b', '#6a4b5e', '#835f72', '#9d7a8b'],   # 헤더(흐린 자줏빛)
    'peat':   ['#0e0b0b', '#1c1715', '#2b2420', '#3a312b', '#4b4037', '#5f5246', '#776858'],   # 흑회 이탄 흙
    'bog':    ['#090d0f', '#121b1d', '#1a2729', '#243535', '#314543', '#465b56', '#677b73'],   # 늪물(검은 찻빛 녹회)
    'gstone': ['#13161e', '#262c39', '#3a4150', '#505867', '#687180', '#838c99', '#a2aab3'],   # 청회 석재(선돌·묘비·풍차 벽)
    'gmoss':  ['#111711', '#1e281e', '#2c3a2a', '#3b4b37', '#4b5c45', '#5f6f55', '#78866a'],   # 회록 이끼
    'btimb':  ['#0d0a0a', '#1b1412', '#291f1b', '#382b25', '#483930', '#5b4a3e', '#725e4f'],   # 검은 목재(교수대·풍차 날개·마차)
    'riron':  ['#0b0b0e', '#19191e', '#28272d', '#38353b', '#4a4246', '#634f49', '#80665a'],   # 녹슨 검은 철
    'sack':   ['#181510', '#2b261e', '#40392d', '#564d3d', '#6c614e', '#837862', '#9c917a'],   # 해진 자루천(허수아비)
    'straw':  ['#1c180e', '#37301f', '#52482e', '#6d613e', '#877a4f', '#a09464', '#b9ae80'],   # 바랜 짚
    'wine':   ['#1c0a0c', '#341216', '#4a181e', '#5a1e24', '#742730', '#8e2f33', '#a6474a'],   # 검붉은(마차 휘장·문 판)
    'amber':  ['#2a1c0a', '#4a3214', '#6e4c1e', '#94692c', '#b4873e', '#c8a050', '#e0c27a'],   # 흐린 호박색 등불
    'fog':    ['#5c646e', '#707884', '#848c98', '#98a0aa', '#a8b0b9', '#b8c0c8', '#cfd5db'],   # 안개
    'crow':   ['#060608', '#0e0e12', '#17171d', '#212128', '#2c2c35', '#3a3a45', '#4c4c58'],   # 까마귀 깃
    'gbone':  ['#25221e', '#433e36', '#625b4f', '#817969', '#9e9683', '#b8b09c', '#ccc6b4'],   # 바랜 뼈빛(수레바퀴 살·말뚝 머리)
})
GRAIN.update({'mgrass': (0.22, 1.5), 'mgdry': (0.16, 1.4), 'heath': (0.24, 1.4), 'peat': (0.20, 1.5), 'bog': (0.05, 2.0),
              'gstone': (0.11, 2.1), 'gmoss': (0.24, 1.5), 'btimb': (0.12, 1.2), 'riron': (0.08, 2.0), 'sack': (0.12, 1.6),
              'straw': (0.14, 1.3), 'wine': (0.08, 1.8), 'amber': (0.02, 2.0), 'fog': (0.04, 2.0), 'crow': (0.05, 2.0), 'gbone': (0.10, 2.0)})


def P(mat): return np.array([hx(c) for c in PAL[mat]], dtype=np.uint8)
def RGB(mat, t): return hx(PAL[mat][max(0, min(6, int(t)))])
def R7(mat): return [hx(c) for c in PAL[mat]]
def F(c, k=0.62): return pz.fin(c, k)


# ---------------------------------------------------------------- 잡음(주기 잡음 = 3x3 표본·16변형 이음새 없음)
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def tnoise(W, H, sc, seed):
    gw, gh = max(1, W // sc), max(1, H // sc)
    g = np.random.default_rng(seed).random((gh, gw))
    xs = (np.arange(W) + 0.5) / sc; ys = (np.arange(H) + 0.5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % gw; y1 = (y0 + 1) % gh; x0 %= gw; y0 %= gh
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    return (a * (1 - fx[None]) + b * fx[None]) * (1 - fy[:, None]) + (c * (1 - fx[None]) + d * fx[None]) * fy[:, None]


def tnoise1(N, sc, seed):
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f


def smooth(W, H, sc, seed):
    r = np.random.RandomState(seed).rand(H // sc + 3, W // sc + 3)
    im = Image.fromarray((r * 255).astype(np.uint8)).resize(((W // sc + 3) * sc, (H // sc + 3) * sc), Image.BICUBIC)
    return np.array(im)[:H, :W].astype(float) / 255


# ---------------------------------------------------------------- 칩셋 타일 → 고딕 램프(밝기 순위 보존 = 버들항 점·결 그대로)
def lum(a): return 0.30 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def chip_tex(x, y, w=16, h=16): return np.array(pz.chip(x, y, w, h).convert('RGB')).astype(np.uint8)


def recolor_tile(rgb, mat, lo, hi):
    l = lum(rgb.astype(np.float64)); vals = np.unique(l)
    rank = np.searchsorted(vals, l) / max(1, len(vals) - 1)
    t = np.clip(np.rint(lo + rank * (hi - lo)), 0, 6).astype(int)
    return P(mat)[t], t


# 칩셋 원본 칸: 잔디(0,128) · 들풀(304,304) · 그늘 풀(112,2144) · 점박이 흙(16,224) · 고운 모래흙(64,224)
SRC = {'lawn': (0, 128), 'meadow': (304, 304), 'shade': (112, 2144), 'earth': (16, 224), 'fine': (64, 224)}
_T = {}
def tex(src, mat, lo, hi):
    k = (src, mat, lo, hi)
    if k not in _T: _T[k] = recolor_tile(chip_tex(*SRC[src]), mat, lo, hi)
    return _T[k]


def tiled(t, W, H):
    ry = -(-H // t.shape[0]); rx = -(-W // t.shape[1]); return np.tile(t, (ry, rx) + (1,) * (t.ndim - 2))[:H, :W]


# ---------------------------------------------------------------- 16변형 가장자리(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)
N_, E_, S_, W_ = 1, 2, 4, 8


def edge_taper(n, inset, jag, rad, seed, size=16, foot=0.6, ramp=6.0):
    """desert-castle dc_fix.edge_taper 와 같은 식: 이웃 없는 쪽 가장자리가 inset±jag 안쪽에서 굽이치고, 칸 모서리로 갈수록 foot 까지 줄어
    오목한 모서리에서도 네모 혹이 생기지 않는다. 반환 m(<0 투명, >=0 칸 안 깊이)."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    j = {k: tnoise1(size, 4, seed + i + 1) for i, k in enumerate('NSWE')}
    def tap(t): return np.clip(np.minimum(t + 0.5, size - 0.5 - t) / ramp, 0, 1)
    def prof(k, t): return foot + tap(t) * (inset - foot + (j[k][t] - 0.5) * 2 * jag)
    d = {'N': Y - prof('N', X), 'S': (size - 1 - Y) - prof('S', X), 'W': X - prof('W', Y), 'E': (size - 1 - X) - prof('E', Y)}
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    return m


def nearest_side(n, inset, jag, rad, seed, **kw):
    """화소마다 가장 가까운 빈 쪽(N/E/S/W, 속은 '')."""
    ms = {}
    for k, bit in (('N', 1), ('E', 2), ('S', 4), ('W', 8)):
        ms[k] = np.full((16, 16), 99.0) if n & bit else edge_taper(15 & ~bit, inset, jag, rad, seed, **kw)
    st = np.stack([ms[k] for k in 'NESW']); idx = st.argmin(0); dmin = st.min(0)
    lab = np.array(list('NESW'))[idx]
    return np.where(dmin >= 50, '', lab)


def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh


def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))


def nb_code(on, x, y):
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)


# ---------------------------------------------------------------- 그리기 도우미
def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)); return o


def limb(c, pts, widths, mat='btimb', seed=1, lit=(5, 4, 3)):
    """가지·줄기: 점들을 따라 원판을 찍는다. 왼쪽 밝게, 오른쪽 어둡게(빛 왼쪽 위)."""
    c.new()
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.5)
                        t = lit[0] if dx < -0.35 else (lit[2] if dx > 0.35 else lit[1])
                        if _hash(xx, yy, seed) > 0.9: t -= 1
                        c.tone(xx, yy, mat, t)


class Parts:
    """조각 저장 + partmeta.json + parts.md (앞 장소와 같은 형식)."""
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
        return im
    def finish(s, title):
        json.dump(s.meta, open(os.path.join(s.out, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title]
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s / %dx%d칸' % (n, im.width, im.height, m['ko'] + ': ' + m['desc'], im.width // 16, im.height // 16))
        lines.append('\n합계: %d 조각' % len(s.order))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)
