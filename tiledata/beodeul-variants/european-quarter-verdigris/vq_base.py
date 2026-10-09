# 녹청 지붕 크림색 석조 저택가(european-quarter-verdigris) 공용 바탕 — 결정적(같은 입력 = 같은 그림).
# 버들항 파이프라인(scripts/content/lib/city_v6) 칩셋의 결(슬레이트 지붕 쌍·자갈·마름돌·흙·잔디)을 그대로 쓰고
# 밝기 순위만 이 장소의 7단 램프(0=윤곽, 1~6 밝아짐)로 옮긴다. 새 재질(녹청 기와·크림 석재·덧문)은 같은 7단 규칙.
# 장르 규격: tiledata/beodeul-kits/genres/european-streets.md (3 — 녹청 지붕 크림 석조 저택가)
#   층 높이 32 · 창 유리 층 위 기준 y 3..13 · 창턱 14..15 · 문은 층 위 6 부터 바닥까지 (목골·회색 석조 팩과 같은 처마선)
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
for p in (V6, os.path.join(HERE, 'vendor'), HERE):
    if p not in sys.path: sys.path.insert(0, p)
import numpy as np
from PIL import Image
import palette; palette.apply()
import terrain
from autotile_edge import edge_fields

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def R7(*cs): return [hx(c) for c in cs]

# ---------------------------------------------------------------- 램프 (0=윤곽, 1~6) — 어둡고 채도 낮은 현실풍 유럽 도시
CREAM = R7('#2f2b25', '#4f4940', '#6f685c', '#8f8777', '#aca392', '#c6bdaa', '#ddd5c1')   # 크림 마름돌 벽
TRIM  = R7('#302c26', '#524c42', '#746c5e', '#948a78', '#b1a792', '#cbc1aa', '#e2d9c3')   # 창틀·모서리돌·코니스(밝은 돌)
PLIN  = R7('#25201a', '#40382c', '#5b503f', '#776952', '#918166', '#a9997b', '#bfb091')   # 1층 받침·기단(누른 돌)
VERD  = R7('#091412', '#11221e', '#19312c', '#22433b', '#2d564b', '#3d6b5d', '#548574')   # 녹청 기와 지붕
VERDL = R7('#152a25', '#22403a', '#31574e', '#436e62', '#588676', '#729e8d', '#94baa8')   # 녹청 덮개(마룻대·추녀·물받이 동판)
SHUT  = R7('#0d1211', '#18201e', '#232d2a', '#2f3a37', '#3d4a46', '#4f5d58', '#68766f')   # 짙은 회록 덧문(겹친 살)
GLASS = R7('#090c11', '#11171f', '#19222c', '#233039', '#33434f', '#4b5f6b', '#6f8590')   # 어두운 창유리(흐린 하늘)
IRON  = R7('#07080a', '#101215', '#191c20', '#24282d', '#30353b', '#40464d', '#575e66')   # 검은 쇠(철책·가로등·발코니)
WOOD  = R7('#130e0a', '#211912', '#30251b', '#403226', '#514131', '#64523f', '#7a6650')   # 회갈 문·마차 나무
BRICK = R7('#190f0c', '#2c1a15', '#40271f', '#53352a', '#664435', '#795643', '#8f6b55')   # 바랜 벽돌(낮은 담·굴뚝)
COB   = R7('#1c1a17', '#312e29', '#47433c', '#5d5850', '#746e65', '#8b857a', '#a49e91')   # 자갈 광장(누른 회색)
FLAG  = R7('#22201d', '#38352f', '#4f4b43', '#666158', '#7d786d', '#959083', '#aea99b')   # 보도 판석
WET   = R7('#0d1015', '#181d24', '#232a33', '#303843', '#3f4854', '#535d69', '#6d7884')   # 젖은 돌(청회)
PUD   = R7('#0a0e14', '#131a23', '#1d2733', '#2a3644', '#3b4a5a', '#56677a', '#8193a3')   # 고인 물(흐린 하늘 비침)
MOSS  = R7('#0e150d', '#1a2517', '#263420', '#33452b', '#435836', '#566c44', '#6d8357')   # 이끼
LAWN  = R7('#0f170e', '#1b2918', '#283a22', '#354b2c', '#445e37', '#577243', '#6c8754')   # 정원 잔디
GRAV  = R7('#1d1b17', '#302d27', '#45413a', '#5a554c', '#706a5f', '#878073', '#9f988a')   # 정원 자갈길
SNOW  = R7('#4b535e', '#66707b', '#818b96', '#9ca5af', '#b6bec6', '#ced5db', '#e5e9ed')   # 녹는 눈(회백)
SLUSH = R7('#2e353d', '#424a53', '#58616b', '#6f7882', '#878f99', '#a0a8b0', '#bac1c8')   # 질척한 눈 녹은 물
LEAF  = R7('#09130c', '#112016', '#192d1e', '#223b26', '#2e4c30', '#3e5f3b', '#55764b')   # 가로수 잎(짙은 녹)
BARK  = R7('#0e0a08', '#1b140f', '#281e17', '#36291f', '#453528', '#564434', '#6b5642')   # 줄기·통
AWNG  = R7('#0b1512', '#13241f', '#1c342d', '#26453c', '#31574c', '#41695d', '#577f72')   # 차양 녹색 줄
AWNC  = R7('#38342c', '#575247', '#756e62', '#91897b', '#aca393', '#c3baa8', '#d7cfbc')   # 차양 크림 줄
FLOWR = R7('#1e0a0d', '#3b1217', '#5d1b21', '#7e2729', '#9c3833', '#b64f43', '#cc6c59')   # 제라늄 붉은 꽃
FLOWY = R7('#241e0a', '#3f3512', '#5c4e1a', '#776722', '#8f7f30', '#a69741', '#bbad5a')   # 누른 꽃
AMBER = R7('#2a1a08', '#583812', '#86581e', '#ad7a2e', '#c99a44', '#ddb868', '#eed49a')   # 등불 빛
DARK  = R7('#050607', '#0b0d10', '#121519', '#1a1e23', '#23282e', '#2e343b', '#3b4249')   # 안쪽 어둠(문 안·연통)
WATER = R7('#0b1418', '#122128', '#1a2f38', '#244049', '#30535c', '#456b72', '#62898c')   # 분수·우물 물(녹청 그림자)
SKY   = R7('#4b5a68', '#5c6c7a', '#6e7f8c', '#83939e', '#98a7b0', '#afbcc3', '#c7d1d6')   # 흐린 겨울 하늘
SHADOW_K = np.array((0.58, 0.61, 0.70))

def lum3(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def clamp(v, a, b): return a if v < a else (b if v > b else v)

def _h(x, y, s):
    h = (int(x) * 374761393 + int(y) * 668265263 + (int(s) * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0
def H(*k):
    v = 0
    for i, kk in enumerate(k): v = (v * 131 + int(kk) * (7 + i * 13)) & 0xffffffff
    return _h(v, 5, 9133)

def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0

def tnoise(W, Hh, sc, seed):
    """W,Hh 를 sc 격자로 나눈 감김 값 잡음(이어 붙여도 이음새 없음). W%sc==0."""
    gw, gh = max(1, W // sc), max(1, Hh // sc)
    g = np.random.default_rng(seed).random((gh, gw))
    xs = (np.arange(W) + .5) / sc; ys = (np.arange(Hh) + .5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % gw; y1 = (y0 + 1) % gh; x0 %= gw; y0 %= gh
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    fxx = fx[None, :]; fyy = fy[:, None]
    return (a * (1 - fxx) + b * fxx) * (1 - fyy) + (c * (1 - fxx) + d * fxx) * fyy

def vnoise(x, y, sc, seed):
    """점 하나의 값 잡음(감김 없음) — 지도 배치용."""
    xs, ys = x / sc, y / sc; x0, y0 = math.floor(xs), math.floor(ys); fx, fy = xs - x0, ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = _h(x0, y0, seed); b = _h(x0 + 1, y0, seed); c = _h(x0, y0 + 1, seed); d = _h(x0 + 1, y0 + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

# ---------------------------------------------------------------- 그림 도우미
def mk(w, h):
    im = Image.new('RGBA', (int(w), int(h))); return im, im.load()
def put(px, W, Hh, x, y, c, a=255):
    x, y = int(x), int(y)
    if 0 <= x < W and 0 <= y < Hh: px[x, y] = tuple(c[:3]) + (a,)
def get(px, W, Hh, x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < Hh else (0, 0, 0, 0)
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

class Pen:
    """그림 한 장과 픽셀 쓰기 도우미. p(x,y,R,k) = 램프 R 의 k 단."""
    def __init__(s, w, h):
        s.im, s.px = mk(w, h); s.W, s.H = int(w), int(h)
    def p(s, x, y, R, k, a=255):
        put(s.px, s.W, s.H, x, y, R[clamp(int(k), 0, 6)], a)
    def c(s, x, y, col, a=255): put(s.px, s.W, s.H, x, y, col, a)
    def g(s, x, y): return get(s.px, s.W, s.H, x, y)
    def rect(s, x0, y0, x1, y1, R, k):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)): s.p(x, y, R, k)
    def hline(s, x0, x1, y, R, k):
        for x in range(int(x0), int(x1)): s.p(x, y, R, k)
    def vline(s, x, y0, y1, R, k):
        for y in range(int(y0), int(y1)): s.p(x, y, R, k)
    def paste(s, im, x, y): s.im.alpha_composite(im, (int(x), int(y))); s.px = s.im.load()
    def dark(s, x, y, k=0.7):
        q = s.g(x, y)
        if q[3]: s.px[int(x), int(y)] = mul(q, k) + (q[3],)

def fin(im, k=0.62):
    """버들항 색 윤곽(pz.fin 과 같은 규칙): 실루엣 바깥 테 1화소를 그 색의 k 배로 어둡게(파랑 조금 남김)."""
    a = np.array(im.convert('RGBA')).astype(np.float64); al = a[..., 3] >= 200
    pad = np.pad(al, 1, constant_values=False)
    edge = al & ~(pad[2:, 1:-1] & pad[:-2, 1:-1] & pad[1:-1, 2:] & pad[1:-1, :-2])
    a[edge, 0] *= k; a[edge, 1] *= k; a[edge, 2] = np.minimum(255, a[edge, 2] * k * 1.1)
    return Image.fromarray(np.floor(a).astype(np.uint8), 'RGBA')

def pad16(im, left=False):
    """16 의 배수로 넓힌다(물체는 왼쪽 아래 정렬)."""
    w, h = im.size; W = (w + 15) // 16 * 16; Hh = (h + 15) // 16 * 16
    if (W, Hh) == (w, h): return im
    o = Image.new('RGBA', (W, Hh)); o.alpha_composite(im, (0 if not left else W - w, Hh - h)); return o

def ramp_fit(c, R):
    l = lum3(c); best = 1; bd = 1e9
    for i in range(1, 7):
        d = abs(lum3(R[i]) - l)
        if d < bd: bd, best = d, i
    return R[best]

# ---------------------------------------------------------------- 칩셋 결 → 램프 단(밝기 순위만, 색은 버린다)
CH = terrain.CH
def chip(x, y): return np.array(CH.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(np.float64)
def L(a): return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
def rank(day, lo, hi, t0=1, t1=6):
    return np.clip(np.rint(t0 + (L(day) - lo) / max(1, hi - lo) * (t1 - t0)), t0, t1).astype(int)
def rank_q(day, t0=1, t1=6):
    """칸 안 밝기 분위수로 단을 나눈다(순위 보존)."""
    l = L(day); qs = np.quantile(l, np.linspace(0, 1, t1 - t0 + 2)[1:-1])
    return (t0 + np.searchsorted(qs, l, side='right')).astype(int)

# 칩셋 결 위치 (jungle-chipset-v6): 슬레이트 지붕 쌍(뒤 경사 빛 256,224 / 256,240 · 앞 경사 그늘 272,224 / 처마 272,240),
# 회색 자갈 160,96 · 176,96 · 144,96, 마름돌 크림 224,160, 흙 64,224, 잔디 0,128, 초원 점 304,304
ROOF_BACK0, ROOF_BACK, ROOF_FRONT, ROOF_EAVE = (256, 224), (256, 240), (272, 224), (272, 240)
COBBLE_AT = (160, 96); ASHLAR_AT = (224, 160); DIRT_AT = (64, 224); LAWN_AT = (0, 128); MEADOW_AT = (304, 304)
_TT = {}
def chip_t(at, lo=1, hi=6, q=True):
    key = (at, lo, hi, q)
    if key not in _TT:
        d = chip(*at); _TT[key] = rank_q(d, lo, hi) if q else rank(d, L(d).min(), L(d).max(), lo, hi)
    return _TT[key]

A_ = lambda R: np.array(R, np.float64)
def img_of(rgb, a=None):
    rgb = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    if a is None: a = np.full(rgb.shape[:2], 255, np.uint8)
    elif a.dtype == bool: a = np.where(a, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, a]), 'RGBA')

def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh
N_, E_, S_, W_ = 1, 2, 4, 8
