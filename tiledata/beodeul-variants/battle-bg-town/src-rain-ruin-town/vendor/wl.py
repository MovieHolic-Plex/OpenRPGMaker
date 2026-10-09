# (동결 사본) 초원 하이로드(plains-highroad) 도우미 — 폐허 마을 지도에서 기존 소품을 다시 쓰려고 복사. 경로만 한 단계 깊게 고쳤다.
# 웨이브 공용 도우미(작업자 A) — 주기 잡음, 16변형 오토타일 만들기, 조각 저장·메타·표.
# 버들항 파이프라인(city_v6)의 팔레트/px2 를 그대로 쓴다. 생성 이미지 없음, 결정적.
import os, sys, json, math
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
sys.path.insert(0, V6)
os.environ.setdefault('PJ_CHIPSET', os.path.join(ROOT, 'public', 'assets', 'atlas-biomes', 'jungle-chipset.png'))
import palette; palette.apply()
import px2, pz
from px2 import C, PAL, GRAIN

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

# ---- 눈·얼음 재료(버들항 눈마을과 같은 7단: 0=윤곽, 1~6)
PAL.update({
 'snow':  ['#2c3c66', '#4c6394', '#7a92c0', '#a6bcdc', '#cadaee', '#e6f0fa', '#ffffff'],
 'ice':   ['#16305c', '#24548c', '#3e84b8', '#6cb4d8', '#9ce0ee', '#cff4f8', '#f2ffff'],
 'frost': ['#20345a', '#3a5a86', '#5f88b0', '#86b0cc', '#aad0e0', '#cceaf0', '#eefcff'],
 'deepice': ['#0a1430', '#122a58', '#1c4a86', '#2c70a8', '#4a98c4', '#78c0dc', '#b8eaf4'],
 'cavestone': ['#0c1226', '#1a2240', '#2c385e', '#44527c', '#62749c', '#8aa0bc', '#bcd0e0'],
})
GRAIN.update({'snow': (0.05, 2.2), 'ice': (0.04, 2.5), 'frost': (0.10, 2), 'deepice': (0.05, 2.2), 'cavestone': (0.10, 2.0)})

def P(mat):
    """재료 7단 팔레트를 (7,3) uint8 배열로."""
    return np.array([hx(c) for c in PAL[mat]], dtype=np.uint8)

# ---------------------------------------------------------------- 주기 잡음(타일 이음새 없음)
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0

def tnoise(W, H, sc, seed):
    """W,H 를 sc 칸 격자로 나눈 값 잡음. 가장자리가 감겨(wrap) 이어 붙여도 이음새가 없다. W%sc==0 필요."""
    gw, gh = max(1, W // sc), max(1, H // sc)
    rng = np.random.default_rng(seed); g = rng.random((gh, gw))
    xs = (np.arange(W) + 0.5) / sc; ys = (np.arange(H) + 0.5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % gw; y1 = (y0 + 1) % gh; x0 %= gw; y0 %= gh
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    fxx = fx[None, :]; fyy = fy[:, None]
    return (a * (1 - fxx) + b * fxx) * (1 - fyy) + (c * (1 - fxx) + d * fxx) * fyy

def tnoise1(N, sc, seed):
    gw = max(1, N // sc); rng = np.random.default_rng(seed); g = rng.random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f

def hgrid(W, H, seed):
    return np.random.default_rng(seed).random((H, W))

def tone_img(T, mat, alpha=None):
    """톤 배열(HxW, 0..6) -> RGBA. alpha(bool/uint8) 로 투명 처리."""
    pal = P(mat); rgb = pal[np.clip(T, 0, 6)]
    a = np.full(T.shape, 255, np.uint8) if alpha is None else (np.asarray(alpha).astype(np.uint8) * (255 if np.asarray(alpha).dtype == bool else 1))
    return Image.fromarray(np.dstack([rgb, a]), 'RGBA')

# ---------------------------------------------------------------- 16변형 오토타일
N_, E_, S_, W_ = 1, 2, 4, 8

def edge_depth(n, inset=2.4, jag=1.7, rad=5.0, seed=1, size=16):
    """변형 번호 n(위1·오른2·아래4·왼8)의 가장자리 깊이장. 이웃 없는 쪽은 inset±jag 만큼 안쪽에서 시작(주기 잡음이라 옆 칸과 이어진다).
    반환 (m, missing): m<0 = 투명(칸 밖), m>=0 = 칸 안(가장자리에서 m 화소), 이웃이 모두 있으면 m=99."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & N_), 'E': not (n & E_), 'S': not (n & S_), 'W': not (n & W_)}
    jN = tnoise1(size, 4, seed + 1); jS = tnoise1(size, 4, seed + 2); jW = tnoise1(size, 4, seed + 3); jE = tnoise1(size, 4, seed + 4)
    d = {}
    d['N'] = Y - (inset + (jN[X] - 0.5) * 2 * jag)
    d['S'] = (size - 1 - Y) - (inset + (jS[X] - 0.5) * 2 * jag)
    d['W'] = X - (inset + (jW[Y] - 0.5) * 2 * jag)
    d['E'] = (size - 1 - X) - (inset + (jE[Y] - 0.5) * 2 * jag)
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            rc = rad - np.hypot(rad - da, rad - db)
            m = np.where(sel, np.minimum(m, rc), m)
    return m, miss

def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh

def autotile_terrain(shader, seed=1, inset=2.4, jag=1.7, rad=5.0):
    """shader(X,Y,m,n,seed)-> (T 톤 HxW, mat) : 칸 안 화소의 톤. 가장자리(m<1.2)는 shader 가 윤곽·테를 칠한다. 투명=m<0."""
    cells = []
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        X, Y = np.meshgrid(np.arange(16), np.arange(16))
        res = shader(X, Y, m, n, seed)
        cells.append(res_to_img(res, m >= 0))
    return sheet_from_cells(cells)

def res_to_img(res, alpha):
    """shader 결과: (T,mat) 또는 RGB 배열(HxWx3) -> RGBA."""
    if isinstance(res, tuple):
        T, mat = res; return tone_img(T, mat, alpha)
    rgb = np.asarray(res).astype(np.uint8); a = np.where(alpha, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, a]), 'RGBA')

def autotile_composed(draw_cell):
    """draw_cell(n)-> 32x32 RGBA(칸 둘레 8화소 여백 포함: 팔이 여백까지 이어져 윤곽이 칸 가장자리에서 안 생긴다). 가운데 16x16 을 잘라 쓴다."""
    cells = []
    for n in range(16):
        big = draw_cell(n); cells.append(big.crop((8, 8, 24, 24)))
    return sheet_from_cells(cells)

def outline_rgba(arr, mat, tone=0, inside=False):
    """RGBA 배열(Image) 바깥 4방향 이웃에 윤곽을 칠한다(투명 화소 중 불투명 이웃이 있는 것)."""
    im = arr.copy(); px = im.load(); w, h = im.size; add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and px[xx, yy][3] > 0: add.append((x, y)); break
    c = hx(PAL[mat][tone]) + (255,)
    for x, y in add: px[x, y] = c
    return im

# ---------------------------------------------------------------- 조각 저장 / 메타
class Parts:
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        s.meta = {}; s.imgs = {}; s.order = []
        s.mpath = os.path.join(outdir, 'partmeta.json')
    def pad16(s, im):
        w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
        if (W, H) == (w, h): return im
        o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)) if False else o.alpha_composite(im, (0, H - h)); return o
    def add(s, name, im, kind, ko, desc, rules, brows=None, layer=None, role=None, pad=True):
        if pad: im = s.pad16(im.convert('RGBA'))
        else: im = im.convert('RGBA')
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if layer: m['layer'] = layer
        if role: m['role'] = role
        s.meta[name] = m
        im.save(os.path.join(s.dir, name + '.png'))
        return im
    def finish(s, title):
        json.dump(s.meta, open(s.mpath, 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title]
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s / %dx%d칸' % (n, im.width, im.height, m['ko'] + ': ' + m['desc'], im.width // 16, im.height // 16))
        lines.append('\n합계: %d 조각' % len(s.order))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)

def sheet_img(imgs, cols=8, scale=3, bg=(88, 150, 60, 255), pad=6, label=True):
    """(이름, 이미지) 목록을 번호 붙여 한 장 판으로."""
    from PIL import ImageDraw
    cw = max(i.width for _, i in imgs) * scale + pad; ch = max(i.height for _, i in imgs) * scale + pad + (10 if label else 0)
    rows = (len(imgs) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * cw, rows * ch), bg); d = ImageDraw.Draw(sh)
    for k, (n, im) in enumerate(imgs):
        x = (k % cols) * cw + pad // 2; y = (k // cols) * ch + pad // 2
        sh.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y))
        if label: d.text((x, y + im.height * scale + 1), '%d %s' % (k + 1, n), fill=(255, 255, 255, 255))
    return sh

# ---------------------------------------------------------------- 오토타일 미리보기: 샘플 모양에 변형을 깔아 이음을 본다
SAMPLE = ["..........",
          ".XXXXXX...",
          ".X....X.X.",
          ".X.XXXXXX.",
          ".X.X..X.X.",
          ".XXX..XXX.",
          "..........",]
def auto_preview(sheet, bg, scale=4, sample=SAMPLE):
    h = len(sample); w = len(sample[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): out.alpha_composite(bg, (x * 16, y * 16))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and sample[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
    return out.resize((w * 16 * scale, h * 16 * scale), Image.NEAREST)
def grass_bg(seed=3, size=16):
    import terrain
    return terrain.CH.crop((0, 128, 16, 144)).convert('RGBA')

# ---------------------------------------------------------------- 화소 캔버스(32x32, 가운데 칸 + 8 여백)
class Cv:
    def __init__(s, w=32, h=32):
        s.w, s.h = w, h; s.m = [[None] * w for _ in range(h)]
    def set(s, x, y, mat, t):
        if 0 <= x < s.w and 0 <= y < s.h: s.m[y][x] = (mat, t)
    def rect(s, x0, y0, x1, y1, mat, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.set(x, y, mat, t)
    def img(s, outline=True):
        im = Image.new('RGBA', (s.w, s.h)); px = im.load()
        for y in range(s.h):
            for x in range(s.w):
                if s.m[y][x]: px[x, y] = hx(PAL[s.m[y][x][0]][s.m[y][x][1]]) + (255,)
        if outline:
            add = []
            for y in range(s.h):
                for x in range(s.w):
                    if s.m[y][x]: continue
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < s.w and 0 <= yy < s.h and s.m[yy][xx]: add.append((x, y, s.m[yy][xx][0])); break
            for x, y, mt in add: px[x, y] = hx(PAL[mt][0]) + (255,)
        return im


PAL['flame']=['#3a0c00','#8a2000','#d04a00','#f08a10','#ffc030','#ffe680','#fffbd0']
GRAIN['flame']=(0.0,1)
