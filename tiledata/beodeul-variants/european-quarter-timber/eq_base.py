# 유럽 목골 구시가(european-quarter-timber) 공용 바탕 — 결정적.
# 버들항 파이프라인(scripts/content/lib/city_v6: palette·px2·pj 벽/지붕 칸·pv 박공·ph2 가파른 지붕·terrain 칩셋)을 그대로 부르고,
# 새 재료(갈색 기와·붉은 벽돌·짙은 목골 들보·꽃)만 같은 7단 규칙(0=윤곽, 1~6 밝아짐)으로 더한다.
# 장르 규격: tiledata/beodeul-kits/genres/european-streets.md (2번 목골 구시가)
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
for p in (V6, os.path.join(HERE, 'vendor'), HERE):
    if p not in sys.path: sys.path.insert(0, p)
import numpy as np
from PIL import Image
import palette; palette.apply()
import px2, pz, pj, pv, ph2, terrain
from px2 import C, PAL, GRAIN, vnoise, _hash
from wl import hash2, tnoise, tnoise1, edge_depth, sheet_from_cells, N_, E_, S_, W_, autotile_composed

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def ramp(name): return [hx(palette.OUT_CHIP[name])] + [hx(c) for c in palette.RAMPS_CHIP[name]]
WD, ST, PL, RED, LEAF, ROOFW, MOSS, WATER = (ramp(n) for n in ('wood', 'stone', 'plaster', 'red', 'leaf', 'roofw', 'moss', 'water'))
def R(mat): return [hx(c) for c in PAL[mat]]
IRON, GOLD, CRYST, CREAM, CLAY, DIRT, BARK, PINK, DARK, CLOTH, ROPE = (R(m) for m in ('iron', 'gold', 'cryst', 'cream', 'clay', 'dirt', 'bark', 'pink', 'dark', 'cloth', 'rope'))

# ---- 새 재료 7단(0=윤곽, 1~6) — 버들항 칩셋 명암 간격에 맞춘 손 램프. 참고 그림의 「갈색 기와·적갈 목골·붉은 벽돌」을 채도 낮게.
TILE = [hx(c) for c in ('#1e130d', '#352418', '#4a3423', '#61462f', '#7a5b3e', '#94744f', '#b09166')]     # 갈색 기와(바랜 흙빛)
BRICK = [hx(c) for c in ('#26100e', '#461b16', '#62271e', '#7c3427', '#954533', '#ac5d45', '#c47c60')]    # 붉은 벽돌(채도 낮게)
BEAM = [hx(c) for c in ('#160b08', '#2a1510', '#3e2017', '#542b1e', '#6a3826', '#7f4a33', '#946048')]     # 적갈 목골 들보
PLAS = [hx(c) for c in ('#3a3228', '#5e5244', '#867862', '#a49478', '#bcac8e', '#cfc1a2', '#ded2b6')]     # 회백 회벽(따뜻한 회색)
STN = [hx(c) for c in ('#1e1e22', '#33343a', '#4a4b50', '#626368', '#7b7c80', '#96979a', '#b4b4b4')]      # 회색 돌(기단·포석)
SLATE = [hx(c) for c in ('#14171d', '#232832', '#323946', '#434b5a', '#576072', '#6e788a', '#8c95a4')]    # 청회 슬레이트(첨탑·내닫이창 지붕)
FLWR = {'red': [hx(c) for c in ('#3a0a10', '#6e1420', '#9c1e26', '#c8302e', '#e0523c', '#f07e5a', '#f8b088')],
        'yel': [hx(c) for c in ('#3a2a06', '#6e5010', '#a07a18', '#c8a024', '#e0c040', '#f0da6a', '#f8eea0')],
        'vio': [hx(c) for c in ('#1e1030', '#3a1e5a', '#56308a', '#7046b0', '#8e66c8', '#ae8ede', '#d2bcf0')],
        'wht': [hx(c) for c in ('#3a3a46', '#6a6a78', '#9a9aa8', '#c0c0cc', '#dcdce4', '#eeeef2', '#ffffff')]}
GLASS = [hx('#081420'), hx('#121e2c'), hx('#1c2a3a'), hx('#2c4656'), hx('#43707e'), hx('#6c98a0'), hx('#a2c4c8')]
AWN = {'red': [hx(c) for c in ('#2b0d10', '#4e1416', '#701e1c', '#8e2a22', '#a8402e', '#be6046', '#d48a6c')],
       'grn': [hx(c) for c in ('#0c1e12', '#16321e', '#20482a', '#2e6036', '#447a48', '#64965e', '#90b482')],
       'blu': [hx(c) for c in ('#0e1630', '#1a2850', '#283a6c', '#384e88', '#4e68a2', '#7088ba', '#9eb0d2')],
       'crm': [hx(c) for c in ('#3a2c1e', '#62503e', '#8a7660', '#ad987e', '#c8b69a', '#dccfb6', '#ece4d2')]}
SHADOW_K = (0.58, 0.62, 0.72)

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
def pad16(im):
    """16의 배수로(왼쪽 아래 정렬)."""
    w = -(-im.width // 16) * 16; h = -(-im.height // 16) * 16
    if (w, h) == im.size: return im
    o = Image.new('RGBA', (w, h)); o.alpha_composite(im, (0, h - im.height)); return o
def ramp_fit(c, Rm):
    l = lum3(c); best = 1; bd = 1e9
    for i in range(1, 7):
        d = abs(lum3(Rm[i]) - l)
        if d < bd: bd, best = d, i
    return Rm[best]
def recolor(im, pred, Rm, box=None):
    """pred(r,g,b) 가 참인 화소를 램프 Rm 의 같은 밝기 단으로(밝기 순위 유지). 아주 어두운 화소(윤곽)는 Rm[0]."""
    px = im.load(); W, Hh = im.size
    x0, y0, x1, y1 = box or (0, 0, W, Hh)
    for y in range(max(0, y0), min(Hh, y1)):
        for x in range(max(0, x0), min(W, x1)):
            p = px[x, y]
            if p[3] < 10 or not pred(p[0], p[1], p[2]): continue
            px[x, y] = (Rm[0] if lum3(p) < 22 else ramp_fit(p, Rm)) + (p[3],)
    return im
def tufts(px, W, Hh, x0, x1, ybase, seed, dens=0.5, hmax=3):
    """밑동 잔풀(버들항 잔디 색)."""
    for x in range(x0, x1):
        if H(x, seed) > dens: continue
        hg = 1 + int(H(x, seed, 1) * hmax)
        for j in range(hg):
            put(px, W, Hh, x, ybase - j, LEAF[5 if j == hg - 1 else (4 if j else 2)])

# ---- 장소 등급: 버들항 낮 색을 한 번에 조금 덜 채도·따뜻하게(오래된 구시가). 채널별 단조 변환이라 7단 밝기 순위는 그대로.
GK = np.array((1.0, 0.975, 0.93)); GD = 0.2
def grade_arr(a, d=GD):
    a = np.clip(a, 0, 255); l = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2])[..., None]
    return np.clip((a * (1 - d) + l * d) * GK, 0, 255)
def grade(im, d=GD):
    a = np.array(im.convert('RGBA')).astype(np.float64); a[..., :3] = grade_arr(a[..., :3], d)
    return Image.fromarray(np.rint(a).astype(np.uint8), 'RGBA')
