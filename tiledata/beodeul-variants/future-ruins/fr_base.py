# 미래 폐허(future-ruins) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6)의 팔레트·윤곽(pz.fin)·칩셋 타일·
# 땅 섞기(ground.render)를 그대로 쓰고, 이 화풍에 처음 나오는 「기계 재질」(강철판·녹·놋쇠·콘크리트·아스팔트·유리·전선·경고 도장·
# 오염 물·오염 풀)만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기, 그림자는 보랏빛으로 식고 빛은 노랗게 데운다)으로 더한다.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(VAR, '_lib3'))
from dlib import T, ST, WD, RD, GD, PL, DK, LF, Cv, new, mix, mul, hx           # noqa  (palette.apply() 는 dlib 가 부른다)
from dlib import _hash, vnoise
import dprops as D
import pz, terrain
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

# ================================================================ 기계 재질 램프 (7단: 0 윤곽 · 1 가장 어두움 … 6 빛)
def _r(*cs): return [hx(c) for c in cs]
STEEL = _r('#0c0e18', '#1a1f2e', '#2c3346', '#454e64', '#64708a', '#8c98b0', '#c2cad8')   # 강철(푸른 회색, 그림자는 남보라)
RUST  = _r('#1a0a0c', '#3a1610', '#622a14', '#8a421c', '#b0602a', '#cc8442', '#e8b276')   # 녹(붉은 갈색 → 주황 빛)
BRASS = _r('#2a1606', '#56340c', '#8a5c18', '#b8862a', '#dcb04a', '#f2d678', '#fff4c4')   # 놋쇠·구리 이음(탑 기계실 BR 과 같은 결)
CONC  = _r('#16141c', '#2e2b34', '#4a4650', '#6a6568', '#8c8682', '#aea79e', '#d2cbbe')   # 콘크리트(따뜻한 회색)
ASPH  = _r('#0e0e14', '#1a1a22', '#262630', '#34343f', '#44444f', '#585862', '#72727c')   # 아스팔트(푸른 흑회)
GLASS = _r('#081624', '#123044', '#1e4e62', '#2e7684', '#4ea2a8', '#8ccfcc', '#e2faf4')   # 돔 유리(버들항 창 청록 계열)
CABLE = _r('#060608', '#101014', '#1a1a20', '#26262e', '#363640', '#4a4a56', '#66666f')   # 고무 전선
WARN  = _r('#22160a', '#4e3610', '#7e5a16', '#a8801e', '#c8a032', '#dcbe56', '#eedc94')   # 바랜 경고 도장(노랑)
TOX   = _r('#061210', '#0a2422', '#103632', '#18483e', '#24604c', '#5e8c5a', '#b8c88a')   # 오염 물(탁한 청록 물 + 누런 거품)
SICK  = _r('#121408', '#262a0e', '#3e4416', '#585e1e', '#727826', '#909434', '#b4b45a')   # 오염 풀·이끼(누런 올리브)
SIGNAL = {'cyan': _r('#06202a', '#0c4450', '#14727a', '#26a8a8', '#5ad8cc', '#a8f6ea', '#f0fffc'),
          'red':  _r('#2a0608', '#560c10', '#8c1418', '#c4241e', '#ee5030', '#ff9262', '#ffd6b8'),
          'amber': _r('#2a1404', '#5a2a06', '#94480a', '#cc7410', '#f0a428', '#ffd060', '#fff2b0')}
RAMPS = {'steel': STEEL, 'rust': RUST, 'brass': BRASS, 'conc': CONC, 'asph': ASPH, 'glass': GLASS, 'cable': CABLE,
         'warn': WARN, 'tox': TOX, 'sick': SICK}

# ================================================================ 기계 재질 규약 수치 (plan.md 「기계 재질 규약」 절과 같다)
RIVET_INSET = 2         # 판 모서리에서 리벳까지 2px
RIVET_STEP = 6          # 긴 변을 따라 리벳 간격 6px (16px 판은 모서리 넷만)
PANEL_FLOOR = (16, 16)  # 바닥 강철판 모듈 = 한 칸
PANEL_WALL = (32, 16)   # 벽·몸통 외장판 = 2x1칸, 줄마다 반 장 엇갈림
PIPE16 = 6              # 16px 관(가는 관) 지름 6px, 이음 테 8px 폭 2px, 16px 마다
PIPE32 = 12             # 32px 관(굵은 관) 지름 12px, 이음 테 16px 폭 3px + 볼트 4개, 32px 마다
CABLE_W = 2             # 전선 굵기 2px(윗줄 3단 빛, 아랫줄 1단)


def clamp(k, lo=1, hi=6): return max(lo, min(hi, int(k)))
def rc(r, k): return r[max(0, min(len(r) - 1, int(k)))]


# ================================================================ 잡음
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


# ================================================================ 칩셋 타일 → 다른 램프 (밝기 순위 보존: 버들항 점·결을 그대로)
def lum(a): return 0.30 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def chip_tex(x, y, w=16, h=16): return np.array(pz.chip(x, y, w, h).convert('RGB')).astype(np.uint8)


def recolor(rgb, ramp, lo, hi):
    l = lum(rgb.astype(np.float64)); vals = np.unique(l)
    rank = np.searchsorted(vals, l) / max(1, len(vals) - 1)
    t = np.clip(np.rint(lo + rank * (hi - lo)), 0, 6).astype(int)
    return np.array(ramp, np.uint8)[t], t


def tiled(t, W, H):
    ry = -(-H // t.shape[0]); rx = -(-W // t.shape[1]); return np.tile(t, (ry, rx) + (1,) * (t.ndim - 2))[:H, :W]


def A(r): return np.array(r, np.uint8)


# ================================================================ 오토타일 가장자리 깊이장 (volcano-field vf_auto 와 같은 규칙)
N_, E_, S_, W_ = 1, 2, 4, 8


def edge_depth(n, inset=2.4, jag=1.7, rad=5.0, seed=1, size=16):
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


# ================================================================ 그리기 도우미
def fin(cv, k=.6): return pz.fin(cv.im if isinstance(cv, Cv) else cv, k)


def shadow_under(im, cx, cy, rx, ry, a=70): return D.shadow(im, cx, cy, rx, ry, a)


def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)); return o


def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)


class Parts:
    """조각 저장 + partmeta.json + parts.md (앞 웨이브와 같은 형식)."""
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        for f in os.listdir(s.dir):
            if f.endswith('.png'): os.remove(os.path.join(s.dir, f))
        s.meta = {}; s.imgs = {}; s.order = []
    def add(s, name, im, kind, ko, desc, rules, brows=None, layer=None, role=None, pad=True):
        im = pad16(im.convert('RGBA')) if pad else im.convert('RGBA')
        assert im.width % 16 == 0 and im.height % 16 == 0, name
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if layer: m['layer'] = layer
        if role: m['role'] = role
        s.meta[name] = m
        im.save(os.path.join(s.dir, name + '.png'))
    def finish(s, title):
        json.dump(s.meta, open(os.path.join(s.out, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title,
                 '손 도트(Pillow, 버들항 7단 램프 + 기계 재질 램프, pz.fin 윤곽). 칸 = 16px. 기계 재질 규약은 plan.md.\n']
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸' % (n, im.width, im.height, m['ko'], m['desc'], im.width // 16, im.height // 16))
        lines.append('\n합계: %d 조각' % len(s.order))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)
