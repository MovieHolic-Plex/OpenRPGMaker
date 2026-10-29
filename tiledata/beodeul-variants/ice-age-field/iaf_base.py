# 빙하기 설원 필드(ice-age-field) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6: px2 볼륨 페인터·pz.fin 윤곽·칩셋 타일·palette)
# 과 변형 공용 라이브러리(varlib 의 눈·얼음·서리·전나무 램프, vprops 의 snowcap·pine)를 그대로 부르고,
# 없는 재료(빙하 앞면·찬 물·가죽 천막·털가죽·뼈 그늘)만 같은 7단 램프(0=윤곽, 1~6=밝기)로 더한다. 결정적.
# 화산 지대 필드(vf_base.py) 도우미를 이 폴더에 옮겨 둔 사본(공용 파일은 고치지 않는다).
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
sys.path.insert(0, V6); sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import varlib                     # noqa: F401  눈·얼음·서리·전나무 램프 등록(palette.apply 포함)
import vprops                     # noqa: F401  packed(다진 눈) 램프, snowcap, pine
import px2, pz
from px2 import C, PAL, GRAIN, _hash, vnoise, hx

# ---------------------------------------------------------------- 새 재료 (7단: 0 윤곽, 1~6 밝기. 그림자는 푸른빛, 빛은 흰빛)
PAL.update({
    'glac':   ['#0c1634', '#162c5e', '#22488a', '#346cae', '#5592c8', '#86bcdc', '#c4e6f2'],   # 빙하 앞면(깊은 푸른 얼음)
    'cwater': ['#040e1a', '#08182c', '#0e2a44', '#16405c', '#225a74', '#3e7c90', '#7aaab4'],   # 찬 물(얼음 틈 물길)
    'hide':   ['#1c1008', '#382214', '#583820', '#785030', '#986a42', '#b88a5c', '#d6aa7c'],   # 가죽 천막
    'fur':    ['#181412', '#302824', '#4a403a', '#665a52', '#867a70', '#a69a8e', '#c8bcb0'],   # 회갈색 털가죽
    'tusk':   ['#2a241a', '#544a38', '#7e7258', '#a89a7a', '#ccc0a0', '#e8dec2', '#fffaea'],   # 상아(누런 뼈)
    'frgr':   ['#1c1a14', '#363024', '#524834', '#6e6446', '#8c825e', '#aca27c', '#ccc4a2'],   # 서리 맞은 마른 풀
})
GRAIN.update({'glac': (0.05, 2.4), 'cwater': (0.03, 2.4), 'hide': (0.12, 1.4), 'fur': (0.20, 1.2), 'tusk': (0.06, 2.0), 'frgr': (0.14, 1.3)})


def P(mat): return np.array([hx(c) for c in PAL[mat]], dtype=np.uint8)
def RGB(mat, t): return hx(PAL[mat][max(0, min(6, int(t)))])
SN = [hx(c) for c in PAL['snow']]
IC = [hx(c) for c in PAL['ice']]


# ---------------------------------------------------------------- 잡음
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def smooth(W, H, sc, seed):
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


def tnoise1(N, sc, seed):
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f


def _h(ix, iy, seed):
    ix = np.asarray(ix, np.int64); iy = np.asarray(iy, np.int64)
    h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    h = (h ^ (h >> 16)) & 0xffffff
    return h / float(0x1000000)


def _wrap(i, n): return i % n if n else i


def voro(X, Y, sx, sy, seed, per=None):
    """보로노이(vf_lava 사본): (가장 가까운 거리, 둘째 거리, 칸 번호). 격자 단위 거리. per(px) 주기."""
    gx = X / sx; gy = Y / sy
    ix = np.floor(gx).astype(np.int64); iy = np.floor(gy).astype(np.int64)
    nx = per // sx if per else 0; ny = per // sy if per else 0
    d1 = np.full(X.shape, 9.0); d2 = np.full(X.shape, 9.0); idv = np.zeros(X.shape, np.int64)
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
    return d1, d2, idv


def shift(m, dx, dy):
    """m 을 (dx,dy) 만큼 옮긴다(넘친 곳은 False). shift(m,0,1)[y] = m[y-1]."""
    o = np.zeros_like(m)
    H, W = m.shape
    ys = slice(max(0, dy), H + min(0, dy)); yd = slice(max(0, -dy), H + min(0, -dy))
    xs = slice(max(0, dx), W + min(0, dx)); xd = slice(max(0, -dx), W + min(0, -dx))
    o[ys, xs] = m[yd, xd]
    return o


# ---------------------------------------------------------------- 칩셋 타일 → 다른 램프 (밝기 순위 보존)
def lum(a): return 0.30 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def chip_tex(x, y, w=16, h=16): return np.array(pz.chip(x, y, w, h).convert('RGB')).astype(np.uint8)


def chip_rank(x, y):
    """칩셋 타일 화소 밝기의 순위 0..1(타일의 점·결 무늬)."""
    l = lum(chip_tex(x, y).astype(np.float64))
    vals = np.unique(l)
    return np.searchsorted(vals, l) / max(1, len(vals) - 1)


def tiled(t, W, H):
    ry = -(-H // t.shape[0]); rx = -(-W // t.shape[1]); return np.tile(t, (ry, rx) + (1,) * (t.ndim - 2))[:H, :W]


def soft_mask(m, seed, sigma=5.0, warp=6.0):
    """칸 마스크(화소)를 화소 단위로 흔들고 둥글린다 — 네모 칸 모양이 안 남게."""
    if not m.any(): return m
    H, W = m.shape
    Y, X = np.mgrid[0:H, 0:W]
    dx = np.rint((smooth(W, H, 9, seed) - 0.5) * 2 * warp).astype(int); dy = np.rint((smooth(W, H, 9, seed + 1) - 0.5) * 2 * warp).astype(int)
    mw = m[np.clip(Y + dy, 0, H - 1), np.clip(X + dx, 0, W - 1)]
    b = ndi.gaussian_filter(mw.astype(np.float64), sigma)
    return (b + (smooth(W, H, 4, seed + 2) - 0.5) * 0.3) > 0.5


# ---------------------------------------------------------------- 그리기 도우미
def F(c, k=0.62): return pz.fin(c, k)


def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)


def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)); return o


N_, E_, S_, W_ = 1, 2, 4, 8
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def edge_depth(n, inset=2.4, jag=1.7, rad=5.0, seed=1, size=16):
    """변형 n 의 가장자리 깊이장(vf_auto 사본): 이웃 없는 쪽은 inset±jag 안쪽에서 시작(주기 잡음 → 옆 칸과 이어진다). m<0 투명."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & N_), 'E': not (n & E_), 'S': not (n & S_), 'W': not (n & W_)}
    jN = tnoise1(size, 4, seed + 1); jS = tnoise1(size, 4, seed + 2); jW = tnoise1(size, 4, seed + 3); jE = tnoise1(size, 4, seed + 4)
    d = {'N': Y - (inset + (jN[X] - 0.5) * 2 * jag), 'S': (size - 1 - Y) - (inset + (jS[X] - 0.5) * 2 * jag),
         'W': X - (inset + (jW[Y] - 0.5) * 2 * jag), 'E': (size - 1 - X) - (inset + (jE[Y] - 0.5) * 2 * jag)}
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    return m


def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh


def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))


class Parts:
    """조각 저장 + partmeta.json + parts.md (앞 웨이브와 같은 형식)."""
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        for f in os.listdir(s.dir):
            if f.endswith('.png'): os.remove(os.path.join(s.dir, f))
        s.meta = {}; s.imgs = {}; s.order = []
    def add(s, name, im, kind, ko, desc, rules, brows=None, layer=None, role=None, pad=True):
        im = pad16(im.convert('RGBA')) if pad else im.convert('RGBA')
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if layer: m['layer'] = layer
        if role: m['role'] = role
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
