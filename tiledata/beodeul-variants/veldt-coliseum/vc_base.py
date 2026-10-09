# 대초원·투기장(veldt-coliseum) 공용 바탕.
# 버들항 파이프라인(scripts/content/lib/city_v6)을 그대로 쓴다: 땅 = ground.render(칩셋 풀 타일 섞기) 결을 그대로 두고
# 색만 마른 풀 램프로 옮긴다(밝기 순위 보존), 석재 = castle6.ash(버들항 성 마름돌), 판석 = 칩셋 판석(192,176), 모래 = 칩셋 모래(64,224).
# 소품은 px2.C(부피 화가) + pz.fin(안쪽 윤곽)으로 찍는다. 새 재질(마른 풀·경기장 모래·가죽)만 같은 7단 규칙으로 더한다.
# 결정적. 생성 이미지·트레이싱 없음. 3/4 시점(윗면+앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math, colorsys
HERE = os.path.dirname(os.path.abspath(__file__))
PH = os.path.abspath(os.path.join(HERE, '..', 'plains-highroad'))
sys.path.insert(0, PH)
from bdA import *                     # noqa: Scene, ground, terrain, pz, px2, palette, np, Image ...
import wl                             # noqa
from wl import PAL, GRAIN, hx, P, tnoise, hash2, Parts, Cv, edge_depth, sheet_from_cells
import plains_auto as PA              # noqa  (earth / flag 팔레트 등록)
from px2 import C, _hash, vnoise
import castle6, roman
from v6pieces import ctex
ST = terrain.ST
mul, mix = roman.mul, roman.mix

# ---------------------------------------------------------------- 새 재질 (7단: 0=윤곽, 1~6)
PAL['dry'] = ['#3a2c10', '#6a5220', '#907030', '#b4943e', '#d2b252', '#e8cc6e', '#f8e8a4']     # 마른 풀 줄기·이삭
PAL['olive'] = ['#1c2410', '#34401a', '#4c5c22', '#66782c', '#829238', '#a0ac4c', '#c4c870']    # 살아 있는 풀(마른 풀 아래 초록)
PAL['sandA'] = ['#3a2a18', '#6a5034', '#8e7048', '#ae8e5e', '#c8a874', '#dcc08c', '#f0dcb0']    # 경기장 모래
PAL['hide'] = ['#24140c', '#48281a', '#6c4026', '#8e5c36', '#ae7a4a', '#c89a64', '#e2c08a']     # 무두질 가죽(천막)
PAL['gwood'] = ['#22201e', '#3e3a36', '#5c5650', '#7e766c', '#9e968a', '#beb6a8', '#dcd6c8']    # 볕에 바랜 고사목
PAL['bonew'] = ['#2e2a24', '#5a5446', '#86806c', '#aeaa96', '#d2d0c0', '#ecebe0', '#ffffff']    # 바랜 뼈
PAL['trail'] = ['#3a2a1a', '#5e4630', '#80643f', '#9c7e50', '#b49660', '#c8ac74', '#dcc496']    # 짐승이 다진 흙길(따뜻한 흙)
PAL['sstone'] = ['#2a221e', '#4a3e36', '#6a5c50', '#8c7e70', '#ac9e8c', '#c8bca8', '#e2dac8']   # 초원 바위(따뜻한 회갈색)
for k, g in (('trail', (0.12, 1.6)), ('gwood', (0.14, 1.4)), ('bonew', (0.06, 2.0)), ('dry', (0.16, 1.4)), ('olive', (0.2, 1.5)), ('sandA', (0.08, 2.0)), ('hide', (0.10, 1.6)), ('sstone', (0.12, 2.2))):
    GRAIN[k] = g
DRY = [hx(c) for c in PAL['dry']]; OLIVE = [hx(c) for c in PAL['olive']]; SANDA = [hx(c) for c in PAL['sandA']]

def F(c, k=0.62): return pz.fin(c, k)

# ---------------------------------------------------------------- 땅: 버들항 풀 → 마른 초원
_DRYMEMO = {}
def _dry_col(c, hue, sk, vk):
    key = (c, hue, sk, vk)
    if key not in _DRYMEMO:
        h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
        if 0.12 < h < 0.5:
            h = hue + (h - 0.27) * 0.35; s = s * sk; v = min(1.0, v * vk)
        _DRYMEMO[key] = tuple(int(round(x * 255)) for x in colorsys.hsv_to_rgb(h, s, v))
    return _DRYMEMO[key]

# 라벨(ground.render): 0 잔디 · 1 밝은 풀밭 · 2 그늘 풀 · 3 잔꽃 풀 · 4 길가 닳은 풀
DRY_LOOK = {0: (0.145, 0.72, 1.14), 1: (0.13, 0.68, 1.22), 2: (0.14, 0.76, 1.19), 3: (0.14, 0.74, 1.22), 4: (0.11, 0.62, 1.18)}
_orig_render = ground.render
def dry_render(W, H, trees_px, road_mask, seed=4):
    im, lab = _orig_render(W, H, trees_px, np.zeros_like(road_mask), seed)     # 길가 닳은 풀(회색 결) 없이
    a = np.array(im)
    lawn = np.array(pz.chip(0, 128, 16, 16).convert('RGB'))
    LT = np.tile(lawn, (H // 16 + 1, W // 16 + 1, 1))[:H, :W]
    a[:, :, :3] = np.where((lab == 2)[..., None], LT, a[:, :, :3]); lab = np.where(lab == 2, 0, lab)   # 그늘 풀 덩이(위장무늬) 대신 잔디
    rgb = a[:, :, :3]
    out = rgb.copy()
    for lb, (hue, sk, vk) in DRY_LOOK.items():
        m = lab == lb
        if not m.any(): continue
        sub = rgb[m]
        cols, inv = np.unique(sub.reshape(-1, 3), axis=0, return_inverse=True)
        lut = np.array([_dry_col(tuple(int(v) for v in c), hue, sk, vk) for c in cols], np.uint8)
        out[m] = lut[inv.reshape(-1)]
    a[:, :, :3] = out
    return Image.fromarray(a, 'RGBA'), lab
ground.render = dry_render            # 이 장소 실행 중에만(파일은 그대로)

# ---------------------------------------------------------------- 마름돌·판석 도우미 (버들항 성 돌)
def ash(X, Y, k=1.0, bw=16, bh=8, seed=0): return castle6.ash(X, Y, k, bw, bh, seed)
def flag_px(X, Y, k=1.0): return mul(ctex(192, 176, X, Y), k)
def sand_px(X, Y): return ctex(64, 224, X, Y)
def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)

def blades(c, specs, mat='dry', base=15):
    """잔 풀 줄기 찍기(plains_pieces._blades 와 같은 결): (x, 높이, 기울기, 시작 톤)."""
    for (x, h, dx, t0) in specs:
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / max(1, h - 1))); yy = base - k
            c.tone(xx, yy, mat, t0 if k < h * 0.5 else min(5, t0 + 1) if k < h - 1 else 6)
            if k < h * 0.5: c.tone(xx + 1, yy, mat, 2 if k < 2 else max(2, t0 - 1))
