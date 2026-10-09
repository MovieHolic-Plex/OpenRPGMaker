# 원시 시대 마을 + 화산 계곡 (prehistoric-village) 공용 바탕.
# 버들항 파이프라인(scripts/content/lib/city_v6: palette·px2·pz·terrain·ground)을 _lib-5/bd5 로 그대로 부르고,
# 없는 재료(가죽·털가죽·붉은 흙물감·토기·소철·딱정벌레 껍질)만 같은 7단 규칙(0=윤곽, 1~6 밝아짐)으로 더한다.
# 화산 재료(화산재·응회암·현무암·용암·연기)는 화산 지대 필드의 동결 사본(vendor/vf_base)에서 가져온다. 결정적.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'vendor'))
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
from bd5 import *                          # noqa: F401,F403  Scene, terrain, terrain7, ground, pz, px2 (palette 적용됨)
import numpy as np
from PIL import Image
import wl                                  # 16변형 가장자리 깊이장·조각 저장(동결 사본)
from wl import hx, tnoise, hash2, edge_depth, sheet_from_cells, autotile_composed, Cv, N_, E_, S_, W_
import vf_base                             # 화산 램프(vash·tuff·basalt·lava·smoke·steam) 등록
from px2 import C, PAL, GRAIN, _hash, vnoise

# ---------------------------------------------------------------- 새 재료 (7단: 0 윤곽, 1~6 밝기. 그림자 쪽은 붉은 보랏빛, 빛 쪽은 따뜻하게)
PAL.update({
    'hide':  ['#24150c', '#46291a', '#6a4228', '#8e5e38', '#ae7c4c', '#c99c66', '#e2be8a'],   # 무두질한 가죽(밝은 황갈)
    'hide2': ['#1e0f0c', '#3c1e16', '#5e3022', '#7e4430', '#9c5c40', '#b87a58', '#d29c78'],   # 그을린 가죽(붉은 갈색)
    'fur':   ['#1a1410', '#33281e', '#4e3e30', '#6a5644', '#86705a', '#a38c74', '#c2ab92'],   # 털가죽
    'ochre': ['#2a0c08', '#561a10', '#86281a', '#a83a24', '#c45232', '#da7448', '#eca070'],   # 붉은 흙물감
    'pot':   ['#24140c', '#48281a', '#6c3e26', '#8e5632', '#ac6e40', '#c48a56', '#d9a874'],   # 민무늬·빗살 토기
    'cycad': ['#06140e', '#0e2a1c', '#173e28', '#215634', '#2f7040', '#468c4c', '#6aa85a'],   # 소철 잎(검푸른 올리브)
    'shell': ['#06080c', '#101824', '#18282e', '#203c38', '#2c5442', '#46744c', '#7aa660'],   # 딱정벌레 껍질(검녹 광택)
    'meat':  ['#1e0606', '#420c0c', '#6a1814', '#8e2a1e', '#b0442c', '#cc6a48', '#e8a08a'],   # 말린 고기
    'char':  ['#0a0707', '#181110', '#281c18', '#3a2a22', '#4e3a2e', '#66503e', '#806852'],   # 숯·그을린 나무
})
GRAIN.update({'hide': (0.10, 1.6), 'hide2': (0.10, 1.6), 'fur': (0.16, 1.3), 'ochre': (0.05, 2.0), 'pot': (0.08, 1.8),
              'cycad': (0.16, 1.5), 'shell': (0.03, 2.2), 'meat': (0.08, 1.6), 'char': (0.16, 1.4)})


def RGB(mat, t): return hx(PAL[mat][max(0, min(6, int(t)))])
def R(mat): return [hx(c) for c in PAL[mat]]
LAWN = [hx(c) for c in ('#3f7a2c', '#4b8232', '#579f35', '#58a035', '#73b83e', '#8fd24a')]     # 버들항 잔디 6단(밑동 잔풀)
SHADOW = (14, 30, 8)


def F(c, k=0.62): return pz.fin(c, k)
def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
def H(*k):
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 5, 9127)


def put(px, W, Hh, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < Hh: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)


def get(px, W, Hh, x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < Hh else (0, 0, 0, 0)


def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def shadow_under(im, cx, cy, rx, ry, a=70):
    """물체 밑 옅은 접지 그림자(버들항 소품처럼 약하게). 그림 아래에 깔고 그림을 위에 얹는다."""
    sh = blank(im.width, im.height); p = sh.load()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if 0 <= x < im.width and 0 <= y < im.height and ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                p[x, y] = SHADOW + (a,)
    sh.alpha_composite(im); return sh


def tufts(px, W, Hh, x0, x1, ybase, seed, dens=0.5, hmax=3):
    """밑동 잔풀(초원 하이로드·폐허 마을과 같은 획)."""
    for x in range(x0, x1):
        if H(x, seed) > dens: continue
        hgt = 1 + int(H(x, seed, 1) * hmax)
        lean = -1 if H(x, seed, 2) < 0.3 else (1 if H(x, seed, 2) > 0.8 else 0)
        for j in range(hgt):
            xx = x + (lean if j >= hgt - 1 and hgt > 2 else 0)
            t = 5 if j >= hgt - 1 else (4 if j > 0 else 2)
            put(px, W, Hh, xx, ybase - j, LAWN[t])


def limb(c, pts, widths, mat='bark', seed=1, lo=3, mid=4, hi=5):
    """가지·기둥: 점들을 따라 원판을 찍는다. 왼쪽 밝게·오른쪽 어둡게(초원 하이로드 limb 와 같은 획)."""
    c.new()
    n = 24
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                    if d <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.5)
                        t = hi if dx < -0.35 else (lo if dx > 0.35 else mid)
                        if _hash(xx, yy, seed) > 0.9: t -= 1
                        c.tone(xx, yy, mat, t)


def poly_fill(pts, fn):
    """다각형 안 화소마다 fn(x,y)."""
    ys = [p[1] for p in pts]
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        xs = []
        for i in range(len(pts)):
            (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
            if (y1 <= y + 0.5 < y2) or (y2 <= y + 0.5 < y1): xs.append(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(int(round(a)), int(round(b))): fn(x, y)


def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; Hh = (h + 15) // 16 * 16
    if (W, Hh) == (w, h): return im
    o = blank(W, Hh); o.alpha_composite(im, (0, Hh - h)); return o


def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
