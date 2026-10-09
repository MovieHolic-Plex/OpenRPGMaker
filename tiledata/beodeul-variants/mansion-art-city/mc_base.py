# 저택·예술 도시(mansion-art-city) 공용 바탕.
# 버들항 파이프라인(scripts/content/lib/city_v6)을 읽기만 하고 그대로 쓴다: 칩셋 팔레트(palette.apply → px2.PAL 7단),
# 볼륨 화가 pz.C(px2.C: 면 법선 + 재질 결 → 7단 양자화), 안쪽 윤곽 pz.fin, 회벽(칩셋 248,16)·돌 램프·금 램프,
# 집 블록(ph2.steep_hip 지붕·v6pieces.stucco_facade 회벽 앞면·portico6 현관·gate_pier6 문기둥·estate_wall 담),
# 땅(ground.render 칩셋 풀 섞기, terrain.paving 칩셋 거리 돌 + 연석, roman.paving5 판석·자갈).
# 이 장소에 처음 나오는 재료만 같은 7단 규칙(0 윤곽 .. 6 밝음)으로 더한다:
#   nob   짙은 붉은 기와(귀족 저택·예술 거리 지붕) — 칩셋 기와 결을 밝기 순위 그대로 옮긴다
#   wine  포도주빛 덧문·벨벳
#   marble 크림 대리석(광장·분수·조각) — 버들항 회벽 크림 쪽
#   boxw  짙은 회양목(생울타리·화단 테) — 버들항 잎 램프를 한 단 어둡고 차갑게
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
if V6 not in sys.path: sys.path.insert(0, V6)
import numpy as np
from PIL import Image, ImageDraw
import palette; palette.apply()
import px2
from px2 import _hash, vnoise
import terrain, pz, pj, ph2, roman, v6pieces, pf, pi, pe, castle6
T = 16


def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def clamp(v, lo=1, hi=6): return max(lo, min(hi, v))
def lum(c): return .3 * c[0] + .59 * c[1] + .11 * c[2]


# ------------------------------------------------------------------ 램프 (버들항 칩셋 것 + 새 재료)
ST = terrain.ST                                  # 돌 7단
WD = terrain.WD                                  # 나무 7단
CRM = roman.CRM                                  # 회벽 크림 7단
GOLD = v6pieces.GOLD                             # 금 7단(칩셋)
LF = [hx(c) for c in px2.PAL['leaf']]
GL = v6pieces.GL                                 # 유리 4단
NEWPAL = {
    'nob':    ['#1e0d1c', '#3a1222', '#561828', '#73202c', '#8e2c32', '#a93e3a', '#c65a4a'],
    'wine':   ['#1c0a18', '#34101f', '#4e1626', '#6a1c2c', '#862834', '#a23c40', '#c05c56'],
    'marble': ['#2b203f', '#6e6070', '#a89a94', '#c8bcb0', '#e0d8c8', '#efe8da', '#fbf8ee'],
    'boxw':   ['#06140e', '#0e2a18', '#173f20', '#245a28', '#357232', '#4d8c3a', '#6aa646'],
    'navy':   ['#0c0c22', '#161a3c', '#22285a', '#30387a', '#44509a', '#6474b8', '#94a2d4'],
    'ochre':  ['#2a1a08', '#4c3010', '#74501c', '#9a7228', '#c09838', '#dcbc58', '#f0dc8a'],
    'sky':    ['#1a2a4a', '#2c4a74', '#40699a', '#5a8cbc', '#7eaed6', '#a8cce8', '#d6ecf8'],
}
for k, v in NEWPAL.items():
    px2.PAL[k] = v
    if k not in px2.GRAIN: px2.GRAIN[k] = {'nob': (.10, 1.8), 'wine': (.08, 1.6), 'marble': (.07, 2.2), 'boxw': (.22, 1.6),
                                         'navy': (.06, 2), 'ochre': (.08, 2), 'sky': (.04, 2)}[k]
R = {k: [hx(c) for c in v] for k, v in px2.PAL.items()}
NOB = R['nob']; WINE = R['wine']; MRB = R['marble']; BOX = R['boxw']
def ramp(m): return R[m]


# ------------------------------------------------------------------ 그림 도우미
def new(w, h): return Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))


def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[int(x), int(y)] = tuple(c[:3]) + (a,)


def I(x):
    if isinstance(x, Image.Image): return x
    if isinstance(x, dict): return I(x['im'])
    if hasattr(x, 'img'): return x.img()
    return x


def fin(c, k=.62): return pz.fin(c, k)


def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)


def pad16(im, left=0):
    w = -(-(im.width + left) // T) * T; h = -(-im.height // T) * T
    o = new(w, h); o.alpha_composite(im, (left, h - im.height)); return o


def recolor_lum(im, ramp_, lo=1, hi=6, mask=None, keep=None):
    """칩셋 결을 보존하며 재질을 바꾼다: 화소 밝기 순위(분위)를 ramp 의 lo..hi 단으로 옮긴다(밝은 결은 밝게, 어두운 결은 어둡게).
    keep(r,g,b) 가 참인 화소는 그대로(굴뚝 돌·금 장식 등)."""
    im = im.copy(); a = np.array(im).astype(int)
    al = a[..., 3] > 0
    if mask is not None: al &= mask
    if keep is not None:
        k = np.vectorize(lambda r, g, b: bool(keep(r, g, b)))(a[..., 0], a[..., 1], a[..., 2]) if al.any() else al
        al &= ~k
    if not al.any(): return im
    L = .3 * a[..., 0] + .59 * a[..., 1] + .11 * a[..., 2]
    vals = np.sort(L[al])
    rank = np.searchsorted(vals, L, side='right') / max(1, len(vals))
    t = np.clip(np.rint(lo + rank * (hi - lo + .999) - .5), lo, hi).astype(int)
    rr = np.array(ramp_, np.uint8)
    out = np.array(im)
    out[al, :3] = rr[t[al]]
    return Image.fromarray(out, 'RGBA').copy()


def nob_roof(im, top=None):
    """칩셋 기와(붉은 테라코타·청색 슬레이트) 지붕 화소만 짙은 붉은 기와 램프로. top: 그 줄 위만."""
    a = np.array(im).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    terra = (r > g + 24) & (r > b + 10) & ~((g > 150) & (b < 90) & (r > 200))          # 테라코타(금빛 장식 제외)
    slate = (b > r + 8) & (b > g + 14)
    wood = (np.abs(r - g) < 60) & (r < 120) & (b < 90) & (r > b)                         # 지붕 끝 나무 띠
    m = (terra | slate | wood) & (a[..., 3] > 0)
    if top is not None: m[top:, :] = False
    return recolor_lum(im, NOB, 1, 5, mask=m)


def shadow_ell(im, cx, cy, rx, ry, a=70):
    """물체 발치 그림자(버들항 소품처럼 짙은 보라 반투명 타원)."""
    o = new(im.width, im.height); p = o.load()
    for y in range(im.height):
        for x in range(im.width):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: p[x, y] = (27, 16, 36, a)
    o.alpha_composite(im); return o


def C(w, h, seed=1):
    c = pz.C(w, h, seed=seed); c.new(); return c
