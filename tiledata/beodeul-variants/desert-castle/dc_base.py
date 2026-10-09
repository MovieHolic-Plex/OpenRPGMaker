# 사막 성(desert-castle) 공용 바탕 — 재질·캔버스·사암 석조 도우미. 결정적(같은 입력 = 같은 그림).
# 사암·모래 램프와 마름돌 그리기는 desert-pyramid(dp_art.sash = 버들항 성 마름돌 castle6.ash 구조)를 읽기만 해서 그대로 쓰고,
# 기계 재질(강철·녹·놋쇠·전선)은 future-ruins 「기계 재질 규약」 램프(fr_base)를 그대로 쓴다. 공용 라이브러리는 고치지 않는다.
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px, 7단 램프(0 = 색 윤곽, 1~6 = 밝기), pz.fin 안쪽 윤곽.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
for sub in ('desert-pyramid', 'future-ruins', 'graveyard-crypt'):
    p = os.path.join(VAR, sub)
    if p not in sys.path: sys.path.append(p)
if HERE not in sys.path: sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
import dp_wl as wl                       # city_v6 경로·팔레트 등록, 16변형 오토타일 도우미
import dp_art as A                       # 사암·모래 램프, sash 마름돌, 모래 바닥
from dp_art import SS, SA, BR, sash, mix, mul, hx, PAL
import dp_pyr as PY                      # _sand_heap, _block
import dp_props as PP                    # 야자·낙타·말뚝(지도에만 쓰고 다시 내보내지 않는다)
import fr_base as FB                     # 기계 재질 램프(future-ruins 규약)
import pz
from px2 import _hash
import terrain

STEEL, RUST, BRASS, CABLE = FB.STEEL, FB.RUST, FB.BRASS, FB.CABLE
DARK7 = [(8, 6, 12), (12, 10, 18), (18, 16, 26), (26, 22, 36), (34, 30, 46), (44, 40, 58), (56, 52, 72)]
WOOD = [hx(c) for c in (['#24140c'] + ['#4a2c18', '#6a4024', '#8a5830', '#a8723e', '#c48e52', '#dcae72'])]
FIRE = [(58, 10, 4), (122, 28, 6), (192, 60, 12), (236, 108, 20), (252, 164, 44), (255, 216, 96), (255, 250, 200)]
def RP(m): return [hx(v) for v in PAL[m]]
CANVAS, INDIGO, WOOL = RP('canvas'), RP('indigo'), RP('wool')
CRIMSON = [hx(c) for c in ('#2a0a0e', '#5a141c', '#8a2028', '#b03432', '#cc5440', '#e08060', '#f4b490')]   # 천막·깃발 붉은 천
SHADOW = (40, 22, 10)                    # 모래 위 그림자(desert-pyramid 와 같다)
# 실내 사암(지하): 바깥 사암 램프를 두 단 어둡고 붉게 — 바닥보다 벽이 어둡다
SSD = [mul(c, k) for c, k in zip(SS, (1.0, 0.78, 0.74, 0.70, 0.67, 0.64, 0.62))]
RAMPS = {'sstone': SS, 'sand': SA, 'bedrock': BR, 'steel': STEEL, 'rust': RUST, 'brass': BRASS, 'cable': CABLE,
         'dark': DARK7, 'wood': WOOD, 'fire': FIRE, 'canvas': CANVAS, 'indigo': INDIGO, 'crimson': CRIMSON, 'sdark': SSD}

def clamp(k, lo=1, hi=6): return max(lo, min(hi, int(k)))
def H_(*k):
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 3, 9301)

class Px:
    """RGBA 화소 캔버스(손 좌표). put 은 칸 밖을 무시한다."""
    def __init__(s, w, h):
        s.w, s.h = w, h; s.im = Image.new('RGBA', (w, h)); s.p = s.im.load()
    def put(s, x, y, c, a=255):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h: s.p[x, y] = tuple(int(v) for v in c[:3]) + (a,)
    def r(s, mat, k): return RAMPS[mat][clamp(k, 0, 6)]
    def t(s, x, y, mat, k): s.put(x, y, s.r(mat, k))
    def on(s, x, y): return 0 <= x < s.w and 0 <= y < s.h and s.p[x, y][3] > 0
    def get(s, x, y): return s.p[x, y] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)
    def shift(s, x, y, k):
        if s.on(x, y): s.put(x, y, mul(s.p[x, y][:3], k))
    def rect(s, x0, y0, x1, y1, fn):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                c = fn(x, y) if callable(fn) else fn
                if c is not None: s.put(x, y, c)
    def ell(s, cx, cy, rx, ry, fn):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    c = fn(x, y, dx, dy) if callable(fn) else fn
                    if c is not None: s.put(x, y, c)
    def line(s, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n):
            f = i / max(1, n - 1)
            for j in range(w): s.put(round(x0 + (x1 - x0) * f) + j, round(y0 + (y1 - y0) * f), c)
    def paste(s, im, x, y): s.im.alpha_composite(im, (int(x), int(y))); s.p = s.im.load()
    def fin(s, k=0.62):
        return pz.fin(s.im, k)

def ground_shadow(im, cx, cy, rx, ry, a=80):
    p = im.load(); W, H = im.size
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if 0 <= x < W and 0 <= y < H and ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and p[x, y][3] == 0:
                p[x, y] = SHADOW + (a,)
    return im

# ================================================================ 사암 석조(바깥 = 햇빛 받은 밝은 사암)
def stone(X, Y, k=1.0, bw=16, bh=8, seed=0):
    """사암 마름돌 앞면(dp_art.sash = 버들항 성 마름돌 구조, 사암 램프)."""
    c = sash(X, Y, bw=bw, bh=bh, seed=seed)
    return mul(c, k) if k != 1.0 else c

def slab(X, Y, seed=0, lit=True):
    """윗면 판석(성벽 통로·지붕·갓돌): 가로로 긴 판, 줄눈 옅게, 모래 점. 앞면보다 한 단 밝다."""
    c = sash(X, Y, bw=20, bh=6, seed=seed)
    c = mix(c, SS[5], 0.55 if lit else 0.25)
    if H_(X, Y, seed) < 0.05: c = SA[5]
    if H_(X // 3, Y // 2, seed + 9) < 0.06: c = mix(c, SA[4], 0.6)        # 날린 모래 점
    return c

def merlons(px, y0, x0, x1, step=10, mw=6, k=1.0, depth=8, seed=0):
    """앞에서 위로 본 성가퀴: 솟은 돌(윗면 밝음 3줄 + 앞면 마름돌) 과 사이 총안(뒤 통로 판석이 그늘져 보이고 아래 턱).
    버들항 castle6.merlons 구조를 사암 램프로, 조금 크게(사막 성은 성가퀴가 굵다)."""
    for x in range(x0, x1):
        u = (x - x0) % step; m = u < mw
        for j in range(depth):
            y = y0 + j
            if m:
                c = SS[6] if j == 0 else (SS[5] if j < 3 else stone(x, y, 0.96, bw=step, bh=5, seed=seed))
                if u == 0 and j >= 1: c = mix(c, SS[6], 0.4)
                if u == mw - 1: c = SS[3] if j >= 1 else SS[5]
            else:
                c = mul(slab(x, y - 6, seed), 0.74) if j < 3 else (SS[3] if j == 3 else stone(x, y, 0.74, bw=step, bh=5, seed=seed))
            px.put(x, y, mul(c, k))

def slit(px, x, y0, h=9, k=1.0):
    """화살 구멍: 세로 2px 어둠 + 가운데 가로 홈."""
    for y in range(y0, y0 + h): px.put(x, y, mul(SS[1], k)); px.put(x + 1, y, mul(SS[2], k))
    px.put(x - 1, y0 + h // 2, mul(SS[1], k)); px.put(x + 2, y0 + h // 2, mul(SS[2], k))
    px.put(x - 1, y0 - 1, mul(SS[6], k)); px.put(x, y0 - 1, mul(SS[6], k))

def arch_open(px, x0, y0, w, h, k=1.0, lattice=False, glow=False):
    """반원 머리 창·문 구멍: 쐐기돌 틀(왼쪽 밝고 오른쪽 어둡다) + 속 어둠. lattice = 나무 살창(격자, 글자 없음)."""
    cx = x0 + w / 2; r = w / 2
    def inside(x, y, rr):
        return x0 - (rr - r) <= x < x0 + w + (rr - r) and y < y0 + h and (y >= y0 + r or math.hypot(x + 0.5 - cx, y0 + r - (y + 0.5)) <= rr)
    for y in range(y0 - 3, y0 + h + 1):
        for x in range(x0 - 3, x0 + w + 3):
            if inside(x, y, r):
                d = y - y0
                c = DARK7[2] if d < h * 0.4 else DARK7[1]
                if x < x0 + 1: c = DARK7[3]
                if glow: c = mix(c, FIRE[3], 0.25 if d > h * 0.5 else 0.12)
                if lattice and ((x - x0) % 4 == 1 or (y - y0) % 4 == 1) and y >= y0 + 2:
                    c = WOOD[3] if (x - x0) % 4 == 1 else WOOD[2]
                px.put(x, y, mul(c, k))
            elif inside(x, y, r + 2) and y < y0 + h:
                ang = math.atan2(y0 + r - (y + 0.5), x + 0.5 - cx)
                c = SS[6] if x < cx else SS[4]
                if y >= y0 + r: c = SS[5] if x < cx else SS[3]
                if y < y0 + r and int(math.degrees(ang) + 180) % 30 < 4: c = SS[3]
                px.put(x, y, mul(c, k))
    for x in range(x0 - 3, x0 + w + 3):                                   # 문턱·창턱
        px.put(x, y0 + h, mul(SS[6] if x < cx else SS[4], k))

def chevron(px, x0, x1, y0, h=4, k=1.0):
    """갈매기 부조 띠(기하 무늬, 글자 없음)."""
    for x in range(x0, x1):
        for j in range(h):
            u = (x - x0 + j) % 8
            c = SS[6] if u == 0 else (SS[5] if u < 3 else (SS[3] if u == 7 else SS[4]))
            if j == 0: c = SS[6]
            if j == h - 1: c = SS[2]
            px.put(x, y0 + j, mul(c, k))

def string_course(px, x0, x1, y, k=1.0):
    """층 띠(앞으로 나온 돌 띠): 윗면 밝음 · 앞 모 · 아래 그늘."""
    for x in range(x0, x1):
        px.put(x, y, mul(SS[6], k)); px.put(x, y + 1, mul(SS[5] if x < x1 - 2 else SS[4], k))
        px.put(x, y + 2, mul(SS[3], k)); px.put(x, y + 3, mul(SS[2], k * 1.05))

# ================================================================ 모래 쌓임(벽 밑·계단 밑)
def sand_tone(x, y, lum, seed):
    t = 6 if lum > 0.97 else (5 if lum > 0.78 else (4 if lum > 0.5 else (3 if lum > 0.25 else 2)))
    if H_(x, y, seed + 1) > 0.94: t = max(2, t - 1)
    if H_(x, y, seed + 2) > 0.975: t = min(6, t + 1)
    return SA[t]

def sand_bank(px, x0, x1, ybase, hfn, seed, crest=True):
    """벽 밑에 바람이 쌓은 모래 비탈: 기둥마다 높이 hfn(x) 화소. 윗선(마루)은 밝은 1px, 그 아래 바람받이 비탈은 밝게,
    아래로 갈수록 바탕 모래(4)로 녹는다. 잔물결 몇 줄."""
    for x in range(x0, x1):
        hh = hfn(x)
        if hh <= 0: continue
        top = ybase - hh
        for y in range(int(top), ybase):
            v = (y - top) / max(1.0, hh)
            lum = 0.98 if y - top < 1 else (0.86 - 0.5 * v + (0.12 if x < (x0 + x1) / 2 else -0.05))
            c = sand_tone(x, y, lum, seed)
            if crest and y - top == 1: c = SA[5]
            if ((y - top) + math.sin(x / 5.0 + seed) * 1.3) % 6 < 1 and v > 0.25: c = SA[3] if v < 0.8 else SA[4]
            px.put(x, y, c)

# ================================================================ 보정 패스(2026-10-08): 고른 쪽만 윤곽 + 따뜻한 윤곽색
OUTLINE_DARK = (74, 42, 32)              # SS[0] — 사암 윤곽은 회청색이 아니라 짙은 사암 갈색으로 섞는다
def fin_sel(im, borders='NESW', k=0.62, warm=0.8):
    """pz.fin 과 같은 1px 안쪽 윤곽이지만 (1) 그림 둘레는 borders 에 적은 쪽만, 그림 속 투명 구멍 둘레는 언제나,
    (2) 색은 ×k 뒤 짙은 사암색으로 warm 만큼 섞는다(밝은 사암이 회색 테로 보이지 않게).
    성벽처럼 다른 성벽·탑·안뜰 판석과 맞붙는 쪽에 윤곽을 그리면 안뜰 둘레에 회색 네모 테가 생긴다(1차 판의 결함)."""
    a = np.array(im.convert('RGBA')).astype(np.float32); al = a[..., 3] >= 200; H, W = al.shape
    edge = np.zeros_like(al)
    for dy, dx, side in ((1, 0, 'S'), (-1, 0, 'N'), (0, 1, 'E'), (0, -1, 'W')):
        nb = np.zeros_like(al)
        ys = slice(max(0, dy), H + min(0, dy)); yd = slice(max(0, -dy), H + min(0, -dy))
        xs = slice(max(0, dx), W + min(0, dx)); xd = slice(max(0, -dx), W + min(0, -dx))
        nb[yd, xd] = al[ys, xs]
        out = np.zeros_like(al)                                         # 그림 밖으로 나가는 쪽
        if side == 'S': out[-1, :] = True
        if side == 'N': out[0, :] = True
        if side == 'E': out[:, -1] = True
        if side == 'W': out[:, 0] = True
        hole = ~nb & ~out
        edge |= al & (hole | (out & (side in borders)))
    # 어둡게 한 밝기(×k)에 맞는 색을 사암 램프에서 고른다(색상은 따뜻하게 유지) — 원래 색과 warm 비율로 섞는다
    ramp = np.array(SS, np.float32); rl = ramp @ np.array([0.3, 0.59, 0.11], np.float32)
    lum = (a[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)) * k
    rc = np.stack([np.interp(lum, rl, ramp[:, i]) for i in range(3)], -1)
    c = a[..., :3] * k * (1 - warm) + rc * warm
    a[..., :3] = np.where(edge[..., None], c, a[..., :3])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').copy()
