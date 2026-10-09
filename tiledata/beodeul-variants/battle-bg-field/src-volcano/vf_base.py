# 화산 지대 필드(volcano-field) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6)을 그대로 부르고,
# 없는 재료(화산재·현무암·응회암·유황·숯·흑요석·연기)만 같은 7단 램프(0=윤곽, 1~6=밝기)로 더한다.
#  - 땅: ground.render 와 같은 방식(칩셋 손 도트 타일을 덩이 잡음으로 섞고 가장자리는 화소 디더). 다만 칩셋 흙·자갈 타일을
#        밝기 순서 그대로 화산재 램프로 다시 칠한다 → 버들항 흙의 점·결을 그대로 갖는다(자체 노이즈 바닥 아님).
#  - 절벽: terrain.render(높이 단·앞면 3줄·계단)을 그대로 그린 뒤 밝기 순서로 현무암/응회암 램프에 옮기고, 앞면에 지층 띠를 얹는다.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음.
import os, sys, math, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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


# ---------------------------------------------------------------- 새 재료 (7단: 0 윤곽, 1~6 밝기. 그림자는 보랏빛, 빛은 따뜻하게)
PAL.update({
    'vash':   ['#120f16', '#221d26', '#342d36', '#4a4048', '#61565a', '#7d716f', '#9d9088'],   # 화산재(어두운 회흑)
    'cinder': ['#150c0c', '#2a1816', '#3f2622', '#55352e', '#6e473c', '#8a5e50', '#a87c6a'],   # 붉은 화산 자갈(스코리아)
    'basalt': ['#0b0b12', '#191a24', '#282a38', '#3a3d4e', '#505468', '#6c7186', '#8e94a8'],   # 현무암
    'tuff':   ['#1a0e0c', '#33201a', '#4a2e24', '#634030', '#7c543e', '#986c50', '#b48a6a'],   # 응회암(붉은 지층)
    'sulf':   ['#261e04', '#4e420a', '#7e6c12', '#ae9a1e', '#d4c034', '#ecde5c', '#faf6a8'],   # 유황
    'char':   ['#0a0707', '#181110', '#281c18', '#3a2a22', '#4e3a2e', '#66503e', '#806852'],   # 그을린 나무
    'obs':    ['#07050c', '#120e1e', '#1f1834', '#2f264e', '#45396c', '#62558e', '#8c80b8'],   # 흑요석
    'smoke':  ['#1e1c22', '#34313a', '#4c4852', '#66626c', '#827e88', '#a09ca6', '#c4c0c8'],   # 화산 연기
    'steam':  ['#5a6c86', '#7e94ae', '#a4b8cc', '#c6d6e2', '#e0ecf4', '#f2f8fc', '#ffffff'],   # 김
    'lava':   ['#3c0806', '#821608', '#ce380c', '#f07014', '#fcb028', '#ffe478', '#fffad0'],   # 용암
    'drygr':  ['#16110a', '#2c2214', '#46361e', '#62502a', '#7e6a38', '#9c864a', '#bca468'],   # 마른 풀
})
GRAIN.update({'vash': (0.12, 1.8), 'cinder': (0.14, 1.6), 'basalt': (0.10, 2.0), 'tuff': (0.12, 1.8), 'sulf': (0.08, 1.8),
              'char': (0.16, 1.4), 'obs': (0.04, 2.2), 'smoke': (0.06, 2.4), 'steam': (0.04, 2.4), 'lava': (0.0, 2), 'drygr': (0.14, 1.4)})


def P(mat): return np.array([hx(c) for c in PAL[mat]], dtype=np.uint8)
def RGB(mat, t): return hx(PAL[mat][max(0, min(6, int(t)))])


# 용암 6단(마왕성 df_kit.LAV 와 같은 값) + 현무암 테두리 7단 — vf_lava 가 쓴다
LAV = [(60, 8, 6), (130, 22, 8), (206, 56, 12), (240, 112, 20), (252, 176, 40), (255, 228, 120)]
OB = [tuple(int(v) for v in hx(c)) for c in PAL['basalt']]


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


# 바닥 재질: 칩셋 원본 타일 → 화산 램프
#   ash    : 점박이 흙(16,224) → 화산재 2~5
#   fine   : 고운 모래흙(64,224) → 고운 재 3~6 (바람에 쌓인 밝은 재)
#   cinder : 보랏빛 자갈(112,288) → 붉은 화산 자갈 1~5
#   scorch : 점박이 흙 → 그을린 재 1~4 (용암·연기 구멍 곁)
GROUND_SRC = {'ash': ((16, 224), 'vash', 1.8, 4.4), 'fine': ((64, 224), 'vash', 2.5, 4.5),
              'cinder': ((112, 288), 'cinder', 1.0, 5.3), 'scorch': ((16, 224), 'vash', 1.0, 3.4)}
_GT = {}
def ground_tex(name):
    if name not in _GT:
        (x, y), mat, lo, hi = GROUND_SRC[name]
        rgb, t = recolor_tile(chip_tex(x, y), mat, lo, hi)
        _GT[name] = (rgb, t)
    return _GT[name]


def soft_val(m, seed, sigma=8.0, warp=8.0):
    """칸 마스크 → 흔들고 흐린 0..1 값(가장자리로 갈수록 옅다)."""
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


def ground_render(W, H, seed, scorch_px=None, fine_mask=None, cinder_mask=None):
    """ground.render 와 같은 섞기: 기본 재 + 고운 재 덩이 + 붉은 자갈 덩이 + 그을린 띠(scorch_px 0..1 가까움).
    W,H 는 화소. 반환 RGB uint8 배열과 라벨(0 재,1 고운 재,2 자갈,3 그을림)."""
    L = {k: tiled(ground_tex(k)[0], W, H) for k in GROUND_SRC}
    dither = np.random.RandomState(seed).rand(H, W) * 0.10 - 0.05
    out = L['ash'].copy(); lab = np.zeros((H, W), np.uint8)
    n1 = smooth(W, H, 64, seed) * 0.7 + smooth(W, H, 20, seed + 1) * 0.3
    m = (n1 + dither) > 0.80
    if fine_mask is not None: m |= soft_mask(fine_mask, seed + 7) & ((smooth(W, H, 6, seed + 9) + dither) > 0.25)
    out[m] = L['fine'][m]; lab[m] = 1
    # 바람 물결: 고운 재 위 가로로 휜 가는 골(어둡게) + 바로 위 밝은 턱
    Y, X = np.mgrid[0:H, 0:W]
    ph = (Y + 2.6 * np.sin(X / 9.0 + smooth(W, H, 24, seed + 12) * 6.28) + smooth(W, H, 7, seed + 13) * 2.0)
    rip = m & (np.floor(ph) % 7 == 0) & (smooth(W, H, 5, seed + 14) > 0.45)
    lit = m & (np.floor(ph) % 7 == 6) & (smooth(W, H, 5, seed + 14) > 0.45)
    pf = P('vash')
    out[rip] = pf[2]; out[lit] = pf[5]
    m = np.zeros((H, W), bool)
    if cinder_mask is not None:
        b = soft_val(cinder_mask, seed + 8, 10.0, 10.0)
        m |= b > (smooth(W, H, 6, seed + 10) * 0.7 + 0.18 + dither * 2)
    out[m] = L['cinder'][m]; lab[m] = 2
    if scorch_px is not None:
        n3 = smooth(W, H, 10, seed + 4)
        m = (scorch_px * 0.85 + n3 * 0.3 + dither) > 0.62
        out[m] = L['scorch'][m]; lab[m] = 3
    return out, lab


# ---------------------------------------------------------------- 절벽: terrain.render → 현무암·응회암 지층
def cliff_render(lev, stairs=(), seed=5):
    """버들항 절벽(앞면 3줄, 갈빗대 결, 윗턱, 밑 그림자, 돌계단)을 그대로 그린 뒤 밝기 순위로 화산 램프에 옮긴다.
    앞면은 fy(앞면 위에서 아래로 0..47)에 따라 현무암/응회암 지층 띠가 번갈아(띠 경계는 가로로 출렁인다)."""
    im = terrain.render(lev, None, stairs, ())
    a = np.array(im).astype(np.float64)
    H, W = len(lev), len(lev[0])
    F = terrain.faces(lev)
    Fk = np.kron(np.array(F), np.ones((16, 16), int))
    Y, X = np.mgrid[0:H * 16, 0:W * 16]
    ly = Y % 16; fy = ly + (Fk - 1) * 16
    al = a[..., 3] > 0
    l = lum(a)
    face = al & (Fk > 0)
    stc = np.zeros((H * 16, W * 16), bool)
    for (sx, sy, w) in stairs: stc[sy * 16 - 3:sy * 16 + 48, sx * 16:(sx + w) * 16] = True
    face &= ~stc
    # 톤: 앞면 화소 밝기 순서 → 1..5
    if face.any():
        lo_, hi_ = np.percentile(l[face], 3), np.percentile(l[face], 97)
    else: lo_, hi_ = 20, 175
    t = np.clip(np.rint(0.7 + (l - lo_) / max(1, hi_ - lo_) * 4.9), 1, 6).astype(int)        # 앞면 밝기 폭을 램프 1..5.6 에 펼친다(버들항 갈빗대 대비)
    # 지층 띠: 높이 fy 를 출렁이는 경계로 나눈 띠 번호
    wob = (smooth(W * 16, H * 16, 18, seed) - 0.5) * 6 + (smooth(W * 16, H * 16, 6, seed + 1) - 0.5) * 2
    # 띠: 위 0..5 = 재 덮인 턱 아래 얇은 회색 재층, 그 아래 현무암, 가운데쯤 출렁이는 응회암 띠 하나(두께 5~11px), 아래 현무암
    th = 5 + smooth(W * 16, H * 16, 24, seed + 5) * 6
    mid = 17 + wob * 1.4
    mat_tuff = face & (fy >= mid) & (fy < mid + th)
    mat_ashl = face & (fy >= 4) & (fy < 7 + wob * 0.4)
    rgbB = P('basalt')[t]; rgbT = P('tuff')[np.clip(t, 1, 5)]; rgbA = P('vash')[np.clip(t + 1, 2, 5)]
    out = a.copy()
    out[..., :3] = np.where(face[..., None], np.where(mat_tuff[..., None], rgbT, np.where(mat_ashl[..., None], rgbA, rgbB)), out[..., :3])
    # 띠 경계: 응회암 띠 위 1px 어두운 틈, 아래 1px 밝은 턱
    e1 = face & (fy >= mid - 1) & (fy < mid) 
    out[e1, :3] = P('basalt')[1]
    e2 = face & (fy >= mid + th) & (fy < mid + th + 1)
    out[e2, :3] = P('basalt')[4]
    # 윗턱(평지 가장자리 풀빛 → 재빛), 계단, 옆 테
    rest = al & ~face
    tr = np.clip(np.rint(0.8 + (l - 20) / (200 - 20) * 5.4), 1, 6).astype(int)
    out[rest & ~stc, :3] = P('vash')[tr][rest & ~stc]
    out[rest & stc, :3] = P('basalt')[np.clip(tr - 1, 1, 5)][rest & stc]
    out[face & stc, :3] = P('basalt')[np.clip(t - 1, 1, 5)][face & stc]
    return Image.fromarray(out.astype(np.uint8), 'RGBA').copy(), F


# ---------------------------------------------------------------- 그리기 도우미
def F(c, k=0.62): return pz.fin(c, k)


def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)


def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)); return o


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


def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh


def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))


# ---------------------------------------------------------------- 옛 용암 흐름(식은 용암 벌판): 걷는 바닥
def flow_layer(mask_px, seed=11, glow_px=None, per=None):
    """식은 용암판(아아 용암): 크기 제각각 모난 덩이(덩이마다 톤, 왼·위 모 밝고 오른·아래 어둡다, 덩이 틈은 검고
    강 가까이는 붉게 빛난다) + 드문 재 점. 판은 땅보다 2px 높아 북·서 가장자리는 밝은 턱, 남쪽 끝은 어두운 앞면 + 윤곽."""
    import vf_lava as VL
    H, W = mask_px.shape
    m = mask_px
    Y, X = np.mgrid[0:H, 0:W]
    d1, d2, rid, _, _ = VL.voro(X, Y, 8 if per else 7, 6 if per else 5, seed, per)
    rv = hash2(rid, rid * 3 + 1, seed + 1)
    base = np.where(rv < 0.3, 2, np.where(rv < 0.8, 3, 4))
    same = lambda dy, dx: np.roll(np.roll(rid, dy, 0), dx, 1) == rid
    top = ~same(1, 0); left = ~same(0, 1); bot = ~same(-1, 0); right = ~same(0, -1)
    t = base.copy()
    t = np.where(top, t + 2, np.where(left, t + 1, t))
    t = np.where((right | bot) & ~top, t - 1, t)
    g = hash2(X, Y, seed + 2)
    t = np.where(g > 0.95, t + 1, np.where(g < 0.04, t - 1, t))
    crack = (d2 - d1) < 0.12
    t = np.where(crack & ~top, 0, t)
    t = np.clip(t, 0, 5)
    rgb = P('basalt')[t]
    glowp = 0.0 if glow_px is None else glow_px
    hot = m & crack & ~top & (hash2(X // 2, Y // 2, seed + 4) < 0.10 + 0.55 * glowp)
    rgb = np.where(hot[..., None], np.array(LAV[1]), rgb)
    rgb = np.where((hot & (hash2(X, Y, seed + 5) > 0.7))[..., None], np.array(LAV[2]), rgb)
    dust = m & (hash2(X, Y, seed + 6) > 0.975) & ~crack
    rgb = np.where(dust[..., None], P('vash')[4], rgb)
    up = np.roll(m, 1, 0); dn = np.roll(m, -1, 0); lf = np.roll(m, 1, 1); rt = np.roll(m, -1, 1)
    dn2 = np.roll(m, -2, 0)
    etop = m & ~up; eleft = m & ~lf & ~etop
    rgb = np.where(etop[..., None], P('basalt')[5], rgb)
    rgb = np.where(eleft[..., None], P('basalt')[4], rgb)
    front1 = m & ~dn; front2 = m & dn & ~dn2
    rgb = np.where(front2[..., None], P('basalt')[1], rgb)
    rgb = np.where(front1[..., None], P('basalt')[0], rgb)
    eright = m & ~rt & ~front1
    rgb = np.where(eright[..., None], P('basalt')[1], rgb)
    out = np.zeros((H, W, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(out, 'RGBA').copy()
