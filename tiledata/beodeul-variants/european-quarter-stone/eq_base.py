# 석조 유럽 시가지(european-quarter-stone) 공용 바탕 — 결정적.
# 버들항 파이프라인(scripts/content/lib/city_v6: palette·px2·pz·terrain·pj)의 칩셋 결(돌벽·슬레이트·자갈)을 그대로 쓰되,
# 밝기 순위만 이 장소의 7단 램프(0=윤곽, 1~6 밝아짐)로 옮긴다(색은 버린다 → 어둡고 채도 낮은 회색 석조 도시).
# 장르 규격: tiledata/beodeul-kits/genres/european-streets.md (1 — 회색 석조 대형 건물가)
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(HERE, '..', '_lib-5'), os.path.join(HERE, 'vendor'), HERE):
    if p not in sys.path: sys.path.insert(0, p)
from bd5 import *                       # noqa: F401,F403  terrain·ground·pz·px2·palette(적용됨)·tree_look·hx
import numpy as np
from PIL import Image
import pj, pv, pz, terrain
from px2 import _hash, vnoise
from wl import edge_depth, sheet_from_cells, N_, E_, S_, W_, autotile_composed, tnoise, tnoise1, hash2

def R7(*cs): return [hx(c) for c in cs]
# ---------------------------------------------------------------- 램프 (0=윤곽, 1~6)
ASH   = R7('#131317', '#25252a', '#35353a', '#45454a', '#56565a', '#69686a', '#7f7d7c')   # 회색 마름돌 벽
ASH_W = R7('#16130f', '#29241f', '#3a342d', '#4b443b', '#5d554a', '#71685b', '#878070')   # 따뜻한 회갈 마름돌
ASH_D = R7('#0f1013', '#1d1e22', '#2a2b30', '#38393e', '#47484d', '#58595d', '#6d6d70')   # 그을린 짙은 회색 마름돌
TRIM  = R7('#1b1b20', '#323238', '#48484e', '#606065', '#79787a', '#92908d', '#aca9a2')   # 창틀 돌·코니스·기둥(밝은 돌)
SLATE = R7('#0c0e14', '#161922', '#20242f', '#2a2f3c', '#363c4b', '#474e5f', '#5f6779')   # 검은 슬레이트(맨사르드)
ZINC  = R7('#181c22', '#262b33', '#353b45', '#464d58', '#59616d', '#707885', '#8c94a0')   # 아연 덮개·용마루·윗지붕
IRON  = R7('#08090c', '#121419', '#1c1f26', '#272b33', '#343944', '#464c58', '#606776')   # 검은 쇠(난간·가로등)
GLASS = R7('#0a0d13', '#121821', '#1b2530', '#26343f', '#384a56', '#55707c', '#8aa4ac')   # 어두운 창유리(하늘 비침)
WOOD  = R7('#120a07', '#20140d', '#2e1d13', '#3e281a', '#503424', '#644430', '#7c5a40')   # 짙은 문·창살 나무
AWN_R = R7('#1c090b', '#381214', '#541c1e', '#6e2628', '#863230', '#9e463c', '#b66252')   # 바랜 검붉은 차양 줄
AWN_C = R7('#36322c', '#544e46', '#706960', '#8b8378', '#a49b8e', '#bab0a0', '#cec4b2')   # 바랜 크림 차양 줄
AWN_G = R7('#09130f', '#112019', '#1a2e25', '#233c31', '#2e4c3e', '#3d5f4f', '#557865')   # 짙은 병록(카페 쇠가구·차양)
BRICK = R7('#180d0b', '#2b1814', '#40231c', '#533024', '#663c2e', '#7c4c3a', '#94624c')   # 바랜 붉은 벽돌
LEAF  = R7('#08120c', '#0f1d14', '#16291c', '#203823', '#2b4a2d', '#3a5d38', '#4f7448')   # 짙은 가로수 잎
BARK  = R7('#0d0907', '#1a120d', '#271b14', '#35251b', '#443023', '#553e2e', '#6a503c')   # 줄기·통 나무
AMBER = R7('#2a1a08', '#583812', '#86581e', '#ad7a2e', '#c99a44', '#ddb868', '#eed49a')   # 등불·켜진 창
COB   = R7('#141519', '#25272c', '#36383e', '#484a50', '#5b5d62', '#706f72', '#888684')   # 회색 포석
FLAG  = R7('#1d1c1e', '#302f32', '#434246', '#57565a', '#6b6a6c', '#807e7e', '#989592')   # 보도 판석(조금 따뜻)
GRAV  = R7('#1a1816', '#2c2925', '#3e3a34', '#514b43', '#645d53', '#797064', '#90867a')   # 안마당 자갈
PUD   = R7('#07090e', '#0e131b', '#161e28', '#202b37', '#2e3c4a', '#46586a', '#70869a')   # 고인 물(흐린 하늘)
SNOW  = R7('#4a505a', '#626a74', '#7b838d', '#949ca5', '#adb4bb', '#c5cbd0', '#dce0e3')   # 녹는 눈(회백)
LEAFF = R7('#170e09', '#2a1c12', '#3d2918', '#50361f', '#634428', '#775434', '#8c6846')   # 떨어진 갈색 잎
LEAFY = R7('#1f1b0e', '#363016', '#4d441f', '#635829', '#786c34', '#8c8042', '#a09656')   # 떨어진 누른 잎
FLOWR = R7('#200a0e', '#401218', '#641c22', '#86282a', '#a43a34', '#be5244', '#d4705a')   # 창가 제라늄
SHADOW_K = np.array((0.60, 0.62, 0.70))

def lum3(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def H(*k):
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 5, 7717)

def put(px, W, Hh, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < Hh: px[x, y] = tuple(c[:3]) + (a,)
def get(px, W, Hh, x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < Hh else (0, 0, 0, 0)
def mk(w, h):
    im = Image.new('RGBA', (w, h)); return im, im.load()
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
def fin(im, k=0.62): return pz.fin(im, k)

# ---------------------------------------------------------------- 칩셋 결(16x16) → 램프 단
CHIP = terrain.CH
def chip(x, y): return np.array(CHIP.crop((x, y, x + 16, y + 16)).convert('RGB')).astype(np.float64)
def L(a): return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
def rank(day, lo, hi, t0=1, t1=6):
    """칩셋 화소 밝기를 램프 단(t0..t1)으로: 밝기 순위만 쓰고 색은 버린다."""
    return np.clip(np.rint(t0 + (L(day) - lo) / max(1, hi - lo) * (t1 - t0)), t0, t1).astype(int)
def tex_tones(cx, cy, W, Hh, lo, hi, t0=1, t1=6, dx=0, dy=0):
    """칩셋 칸 (cx,cy) 를 W x Hh 로 이어 붙인 밝기 단 배열(HxW int)."""
    t = rank(chip(cx, cy), lo, hi, t0, t1)
    Y, X = np.mgrid[0:Hh, 0:W]
    return t[(Y + dy) % 16, (X + dx) % 16]
def tones_img(T, ramp, alpha=None):
    a = np.array(ramp, np.uint8)[np.clip(T, 0, 6)]
    al = np.full(T.shape, 255, np.uint8) if alpha is None else np.where(alpha, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([a, al]), 'RGBA')
def arr_img(rgb, alpha=None):
    rgb = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    al = np.full(rgb.shape[:2], 255, np.uint8) if alpha is None else np.where(alpha, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')

# 칩셋 결 위치: 크림 마름돌 블록(224,160) · 회청 돌담(256,144) · 슬레이트(256,224) · 회색 자갈(160,96) · 흙(64,224)
ASHLAR_AT = (224, 160); WALLB_AT = (256, 144); SLATE_AT = (256, 224); SLATEF_AT = (272, 224); COBBLE_AT = (160, 96); DIRT_AT = (64, 224)

def regrade(im, ramp, lo=40, hi=200, t0=1, t1=6):
    """그림(RGBA) 전체를 램프 하나로: 밝기 순위만 남긴다(윤곽 화소는 0단)."""
    a = np.array(im.convert('RGBA')).astype(np.float64)
    t = np.clip(np.rint(t0 + (L(a[..., :3]) - lo) / max(1, hi - lo) * (t1 - t0)), t0, t1).astype(int)
    t = np.where(L(a[..., :3]) < 22, 0, t)
    rgb = np.array(ramp, np.float64)[t]
    return Image.fromarray(np.dstack([np.rint(rgb).astype(np.uint8), a[..., 3].astype(np.uint8)]), 'RGBA')

def desat(im, d=0.55, k=0.86, tint=(0.97, 0.98, 1.04)):
    """칩셋 그림(나무·꽃 등)을 이 장소 톤으로: 채도 d 만큼 덜고 밝기 k, 살짝 차갑게. 채널별 단조라 밝기 순위 유지."""
    a = np.array(im.convert('RGBA')).astype(np.float64)
    l = L(a[..., :3])[..., None]
    a[..., :3] = np.clip((a[..., :3] * (1 - d) + l * d) * k * np.array(tint), 0, 255)
    return Image.fromarray(np.rint(a).astype(np.uint8), 'RGBA')

def pad16(im):
    w = -(-im.width // 16) * 16; h = -(-im.height // 16) * 16
    if (w, h) == im.size: return im
    o = Image.new('RGBA', (w, h)); o.alpha_composite(im, (0, h - im.height)); return o

def shadow_under(im, k=0.55, dx=3, dy=0, rows=3):
    """물체 밑동에 붙는 짧은 그림자(오른쪽 아래)는 지도 렌더가 그린다. 여기서는 쓰지 않는다(자리만)."""
    return im
