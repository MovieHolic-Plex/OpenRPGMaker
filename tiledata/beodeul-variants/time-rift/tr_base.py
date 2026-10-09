# 시간의 틈·허공 쉼터(time-rift) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6)을 그대로 부른다.
#  - 돌: 버들항 돌 램프 ST(terrain.ST, 0 윤곽 .. 6 밝음), 광장 판석 roman.tex_flag, 칩셋 바위 타일 terrain.ROCK, 대리석 TRV.
#  - 그리기: px2.C 볼륨 페인터 + pz.fin 안쪽 윤곽(버들항 소품과 같은 결).
#  - 새 재료(허공 남색·성운 보라/청록·발광 파랑/보라/금/청록)만 같은 7단 규칙(0 윤곽, 1~6 밝기)으로 더한다.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음.
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
if V6 not in sys.path: sys.path.insert(0, V6)
import numpy as np
from PIL import Image, ImageDraw
import palette; palette.apply()
import px2, pz, terrain, roman
from px2 import C, PAL, GRAIN, _hash, vnoise

T = 16


def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])


ST = terrain.ST                       # 버들항 돌 0..6
TRV = roman.TRV                       # 버들항 대리석(트래버틴) 0..6
# 버들항 돌 램프는 3(89) → 4(146) 사이가 크게 벌어진다. 허공 속 돌은 그 사이를 채운 중간 단을 쓴다(색상은 ST 그대로).
STM = [ST[0], ST[1], ST[2], ST[3], mix(ST[3], ST[4], .5), ST[4], ST[5], ST[6]]   # 8단(0 윤곽..7 밝음) — 바위 면용

# ---------------------------------------------------------------- 새 재료 (7단: 0 윤곽, 1~6 밝기. 그림자는 남보라, 빛은 차갑게)
NEW = {
    'void':   ['#03040a', '#070a16', '#0b1022', '#111830', '#182140', '#212c54', '#2e3b6c'],   # 허공 남색
    'nebv':   ['#0a0818', '#16102c', '#241a44', '#34245c', '#483274', '#62468e', '#8466b0'],   # 성운 보라
    'nebt':   ['#05121a', '#0a1e28', '#102c38', '#183e4a', '#22545e', '#2f6c72', '#468c8a'],   # 성운 청록
    'gblue':  ['#0a1430', '#122c64', '#1c4c9c', '#2c78d0', '#56acee', '#a2dcfa', '#effbff'],   # 발광 파랑(7단 발광 램프)
    'gviol':  ['#160a2c', '#30145e', '#52229a', '#7c38cc', '#a866ea', '#d4a6f8', '#faefff'],   # 발광 보라
    'ggold':  ['#2a1404', '#5c300a', '#94561a', '#c8862a', '#eebc48', '#fce284', '#fffae0'],   # 발광 금
    'gteal':  ['#041c1c', '#0a3c3a', '#126a62', '#1e9c8c', '#3ccab2', '#90eed6', '#e8fff8'],   # 발광 청록
    'gstar':  ['#101830', '#26386a', '#4a64a6', '#7a96d2', '#aec4ec', '#dce8fa', '#ffffff'],   # 별빛(다리·별)
}
for k, v in NEW.items(): PAL[k] = v
GRAIN.update({'void': (0.0, 2), 'nebv': (0.04, 2), 'nebt': (0.04, 2), 'gblue': (0.0, 2), 'gviol': (0.0, 2),
              'ggold': (0.0, 2), 'gteal': (0.0, 2), 'gstar': (0.0, 2)})


def R(mat): return [hx(c) for c in PAL[mat]]
def P(mat): return np.array([hx(c) for c in PAL[mat]], dtype=np.uint8)


VOID = R('void'); NEBV = R('nebv'); NEBT = R('nebt')
GLOW = {'blue': R('gblue'), 'violet': R('gviol'), 'gold': R('ggold'), 'teal': R('gteal')}
GSTAR = R('gstar')

# 4x4 바이어 행렬(디더 경계: 손 도트 그림처럼 단 사이를 점무늬로 잇는다)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def bayer(H, W):
    return np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]


# ---------------------------------------------------------------- 잡음 (numpy)
def hash2(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def tnoise(W, H, sc, seed, per=True):
    """값 잡음 0..1. per=True 면 W·H 주기로 감긴다(표본 이음새 없음)."""
    gw, gh = max(1, int(round(W / sc))), max(1, int(round(H / sc)))
    g = np.random.default_rng(seed).random((gh + 1, gw + 1))
    if per: g[-1, :] = g[0, :]; g[:, -1] = g[:, 0]
    xs = (np.arange(W) + 0.5) * gw / W; ys = (np.arange(H) + 0.5) * gh / H
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x0 + 1)]; c = g[np.ix_(y0 + 1, x0)]; d = g[np.ix_(y0 + 1, x0 + 1)]
    return (a * (1 - fx[None]) + b * fx[None]) * (1 - fy[:, None]) + (c * (1 - fx[None]) + d * fx[None]) * fy[:, None]


# ---------------------------------------------------------------- 그리기 도우미
def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)


def F(c, k=0.62): return pz.fin(c, k)


def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, (0, H - h)); return o


def inset_outline(im, k=0.6):
    """pz.fin 과 같은 안쪽 윤곽(불투명 가장자리 화소를 어둡게) — Image 하나에."""
    return pz.fin(im, k)


def glow_disc(W, H, cx, cy, rx, ry, color, amax=110, steps=4):
    """부드러운 빛 번짐(단계 알파, 바이어 디더) — 투명 그림."""
    im = blank(W, H); a = np.zeros((H, W)); Y, X = np.mgrid[0:H, 0:W]
    d = np.sqrt(((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2)
    v = np.clip(1 - d, 0, 1)
    q = np.floor(v * steps + bayer(H, W) * .999) / steps
    a = (q * amax).astype(np.uint8)
    arr = np.zeros((H, W, 4), np.uint8); arr[..., :3] = color[:3]; arr[..., 3] = a
    return Image.fromarray(arr, 'RGBA')


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
                 '손 도트(Pillow, 버들항 돌 램프 ST·대리석 TRV·px2 볼륨 페인터·pz.fin 윤곽)로 새로 그린 조각만 적는다. 칸 = 16px.\n']
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸' % (n, im.width, im.height, m['ko'], m['desc'], im.width // 16, im.height // 16))
        lines.append('\n합계: %d 조각' % len(s.order))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)


def sheet_from_cells(cells):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i, im in enumerate(cells): sh.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    return sh


def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
