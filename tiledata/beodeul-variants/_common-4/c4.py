# 버들항 변형 (담당 4) 공용 모듈 — 버들항 파이프라인(city_v6)을 불러 쓰고, 없는 땅·소품을 같은 결로 손 도트한다.
# 모든 색은 버들항 칩셋의 램프에서만 고른다. 생성 이미지·외부 픽셀 복사 없음. 결정적(같은 시드 → 같은 그림).
import os, sys, math, json, random
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
os.environ.setdefault('PJ_CHIPSET', os.path.join(ROOT, 'public', 'assets', 'atlas-biomes', 'jungle-chipset.png'))
sys.path.insert(0, V6)
import px2, palette
palette.apply()
from px2 import C, vnoise, _hash
import terrain, pz, interior
from terrain import hx

def rgb(h): return hx(h)
def ramp(name): return [hx(c) for c in palette.ramp7(name)]      # 7 tones, [0] = outline
ST, WD, RD, SR, LF, WA, PL = (ramp(n) for n in ('stone', 'wood', 'red', 'straw', 'leaf', 'water', 'plaster'))
# 칩셋에서 직접 잰 땅 색
LAWN = [rgb(c) for c in ('#579f35', '#569e35', '#58a035', '#549d34', '#5aa236', '#509933')]
SAND = [rgb(c) for c in ('#816a56', '#8a745c', '#9e8b64')]
WAT = [rgb(c) for c in ('#296c5c', '#2d7562', '#4b967d', '#6fb89a')]
CH = terrain.CH

# ---------------------------------------------------------------- numpy 잡음
def noise(H, W, sc, seed):
    """부드러운 값 잡음 0..1, 크기 (H,W)."""
    rng = np.random.default_rng(seed)
    gh, gw = int(H / sc) + 3, int(W / sc) + 3
    g = rng.random((gh, gw))
    ys = np.arange(H) / sc; xs = np.arange(W) / sc
    y0 = ys.astype(int); x0 = xs.astype(int); fy = ys - y0; fx = xs - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
    fxx = fx[None, :]; fyy = fy[:, None]
    return (a * (1 - fxx) + b * fxx) * (1 - fyy) + (c * (1 - fxx) + d * fxx) * fyy

def hashgrid(H, W, seed):
    return np.random.default_rng(seed).random((H, W))

def pick(cols, t):
    """t(0..1 배열)로 색 목록에서 고른다 → HxWx3."""
    n = len(cols); idx = np.clip((t * n).astype(int), 0, n - 1)
    return np.array(cols, dtype=np.uint8)[idx]

# ---------------------------------------------------------------- 땅 칠하기
HARD = set()        # 경계를 흐트러뜨리지 않는 종류(포장·마루)
PAINT = {}          # 종류 이름 → f(X,Y,seed) → HxWx3

def painter(name, hard=False):
    def deco(f):
        PAINT[name] = f
        if hard: HARD.add(name)
        return f
    return deco

def _spk(shape, seed, dens):
    return hashgrid(shape[0], shape[1], seed) < dens

@painter('grass')
def _grass(X, Y, seed):
    H, W = X.shape
    n = noise(H, W, 9, seed) * 0.6 + noise(H, W, 3.5, seed + 1) * 0.4
    im = pick(LAWN, n).astype(np.int32)
    dark = _spk((H, W), seed + 2, 0.035); lite = _spk((H, W), seed + 3, 0.03)
    im[dark] = rgb('#4b8232'); im[lite] = rgb('#73b83e')
    big = noise(H, W, 14, seed + 4) > 0.68
    im[big & dark] = rgb('#3f7a2c')
    return im

@painter('sand')
def _sand(X, Y, seed):
    H, W = X.shape
    n = noise(H, W, 6, seed) * 0.55 + noise(H, W, 2.2, seed + 1) * 0.45
    im = pick(SAND, n).astype(np.int32)
    im[_spk((H, W), seed + 2, 0.02)] = rgb('#816a56')
    im[_spk((H, W), seed + 3, 0.012)] = rgb('#c4c6c3')
    return im

@painter('wetsand')
def _wetsand(X, Y, seed):
    H, W = X.shape
    im = _sand(X, Y, seed).astype(np.float32) * 0.78
    im[..., 2] *= 1.08
    return np.clip(im, 0, 255).astype(np.int32)

@painter('dirt')
def _dirt(X, Y, seed):
    H, W = X.shape
    n = noise(H, W, 5, seed) * 0.5 + noise(H, W, 2, seed + 1) * 0.5
    im = pick([rgb('#633712'), rgb('#6f4725'), rgb('#885a26'), rgb('#6f4725')], n).astype(np.int32)
    im[_spk((H, W), seed + 2, 0.05)] = rgb('#452a17'); im[_spk((H, W), seed + 3, 0.03)] = rgb('#929491')
    return im

@painter('rocky')
def _rocky(X, Y, seed):
    H, W = X.shape
    n = noise(H, W, 7, seed) * 0.5 + noise(H, W, 2.5, seed + 1) * 0.5
    im = pick([rgb('#4a3c33'), rgb('#614026'), rgb('#6b4e2a'), rgb('#4a3c33')], n).astype(np.int32)
    im[_spk((H, W), seed + 2, 0.05)] = rgb('#372624'); im[_spk((H, W), seed + 3, 0.03)] = rgb('#8b6a39')
    return im

@painter('flag', hard=True)
def _flag(X, Y, seed):
    """16px 안팎 다듬은 판석 포장. 줄눈 + 위·왼 하이라이트."""
    H, W = X.shape
    row = (Y // 8).astype(int); off = (row % 2) * 8 + (row // 2 % 3) * 3
    bx = ((X + off) // 16).astype(int)
    lx = (X + off) % 16; ly = Y % 8
    h = hashgrid(H, W, seed)[(row * 7 + bx * 3) % H, (bx * 5 + row) % W]
    base = np.where(h[..., None] < 0.33, np.array(ST[4]), np.where(h[..., None] < 0.66, np.array(ST[3]), np.array(ST[3]))).astype(np.int32)
    n = noise(H, W, 3, seed + 1)
    base = np.where(n[..., None] > 0.62, np.array(ST[4]), base)
    joint = (lx == 15) | (ly == 7)
    hi = ((lx == 0) | (ly == 0)) & ~joint
    im = base.copy(); im[joint] = ST[1]; im[hi] = ST[5]
    return im

@painter('sea')
def _sea(X, Y, seed):
    H, W = X.shape
    n = noise(H, W, 8, seed) * 0.5 + noise(H, W, 3, seed + 1) * 0.5
    im = pick([WA[1], rgb('#296c5c'), rgb('#2d7562'), rgb('#296c5c')], n).astype(np.int32)
    return im

@painter('basalt')
def _basalt(X, Y, seed):
    H, W = X.shape
    n = noise(H, W, 6, seed) * 0.5 + noise(H, W, 2.4, seed + 1) * 0.5
    im = pick([ST[1], ST[2], ST[2], ST[3]], n).astype(np.int32)
    im[_spk((H, W), seed + 2, 0.05)] = ST[0]; im[_spk((H, W), seed + 3, 0.02)] = ST[4]
    return im

def paint_ground(kind, names, seed=1, jitter=3.0):
    """kind: 셀 종류 정수 격자(H,W); names: {정수: 종류 이름}. 부드러운 경계는 잡음으로 어긋나게 찾는다."""
    kind = np.asarray(kind); Hc, Wc = kind.shape; H, W = Hc * 16, Wc * 16
    Y, X = np.mgrid[0:H, 0:W]
    dx = ((noise(H, W, 7, seed + 90) - .5) * 2 * jitter + (noise(H, W, 2.5, seed + 91) - .5) * 2).round().astype(int)
    dy = ((noise(H, W, 7, seed + 92) - .5) * 2 * jitter + (noise(H, W, 2.5, seed + 93) - .5) * 2).round().astype(int)
    ex = kind[Y // 16, X // 16]
    sx = kind[np.clip(Y + dy, 0, H - 1) // 16, np.clip(X + dx, 0, W - 1) // 16]
    hard_ids = [i for i, n in names.items() if n in HARD]
    hard_e = np.isin(ex, hard_ids); hard_s = np.isin(sx, hard_ids)
    fin = np.where(hard_e | hard_s, ex, sx)
    out = np.zeros((H, W, 3), np.int32)
    for i, n in names.items():
        m = fin == i
        if m.any(): out[m] = PAINT[n](X, Y, seed + 10 * (i + 1))[m]
    return out, fin

def shore(out, waterpx, landpx, seed=5, foam=True):
    """물 픽셀 색을 해안 거리로 얕게/깊게 나누고 물거품 줄을 그린다. waterpx/landpx: bool(H,W)."""
    from scipy.ndimage import distance_transform_edt as edt
    H, W = waterpx.shape
    d = edt(waterpx)                       # 물 픽셀에서 가장 가까운 육지까지 거리
    n = noise(H, W, 5, seed); n2 = noise(H, W, 2, seed + 1)
    o = out.copy()
    deep = (d > 10 + n * 4)
    mid = (d > 5 + n * 3) & ~deep
    shal = ~deep & ~mid
    o[deep & waterpx] = np.where((n2[deep & waterpx] > 0.5)[..., None], WA[1], rgb('#1c4a44')).astype(np.int32)
    o[mid & waterpx] = np.where((n2[mid & waterpx] > 0.55)[..., None], rgb('#296c5c'), rgb('#21584e')).astype(np.int32)
    o[shal & waterpx] = np.where((n2[shal & waterpx] > 0.45)[..., None], rgb('#2d7562'), rgb('#4b967d')).astype(np.int32)
    Y, X = np.mgrid[0:H, 0:W]
    # 잔물결: 짧은 가로 획 (밝은 획)
    rip = hashgrid(H, W, seed + 3) < 0.012
    ripx = rip | np.roll(rip, 1, 1) | np.roll(rip, 2, 1)
    o[ripx & waterpx & ~shal] = rgb('#3fa2ae')
    o[ripx & waterpx & shal] = rgb('#6fb89a')
    if foam:
        band = waterpx & (d <= 1.5)
        o[band] = rgb('#f7fdff')
        b2 = waterpx & (d > 1.5) & (d <= 3.6 + n * 1.5) & (((X + Y * 2 + (n * 9).astype(int)) % 5) < 3)
        o[b2] = rgb('#a7d4db')
        b3 = waterpx & (d > 3.6) & (d < 6) & (hashgrid(H, W, seed + 4) < 0.07)
        o[b3] = rgb('#a7d4db')
    return o

# ---------------------------------------------------------------- 장면(물체 정렬·통행 격자)
class Scene:
    def __init__(s, wc, hc):
        s.wc, s.hc = wc, hc
        s.base = None
        s.objs = []            # (sortkey, img, x, y, name)
        s.walk = np.ones((hc, wc), bool)
        s.marks = {}           # 이름 → 셀 (BFS 검사용)
        s.over = []            # 물체 위에 덮는 것 (지붕 등)
    def block(s, x0, y0, x1=None, y1=None):
        x1 = x0 if x1 is None else x1; y1 = y0 if y1 is None else y1
        s.walk[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = False
    def open_(s, x0, y0, x1=None, y1=None):
        x1 = x0 if x1 is None else x1; y1 = y0 if y1 is None else y1
        s.walk[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = True
    def put(s, img, x, y, name='', foot=None, block=None):
        """img를 (x,y) 픽셀 왼위에 놓는다. foot: 정렬 기준 y(기본 바닥). block=(cx0,cy0,cx1,cy1) 셀 막기."""
        if hasattr(img, 'img'): img = pz.fin(img)
        x, y = int(round(x)), int(round(y))
        if foot is not None: foot = int(round(foot))
        s.objs.append(((y + img.height) if foot is None else foot, img, x, y, name))
        if block: s.block(*block)
    def compose(s):
        im = s.base.copy()
        for k, o, x, y, n in sorted(s.objs, key=lambda t: (t[0], t[2])):
            im.alpha_composite(o, (x, y)) if (x >= 0 and y >= 0) else im.paste(o, (x, y), o)
        return im
    def bfs(s, start, targets):
        from collections import deque
        sx, sy = start; seen = {(sx, sy)}; q = deque([(sx, sy)])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < s.wc and 0 <= ny < s.hc and s.walk[ny, nx] and (nx, ny) not in seen:
                    seen.add((nx, ny)); q.append((nx, ny))
        return {n: (t in seen) for n, t in targets.items()}, len(seen)
    def save_grid(s, path, extra=None):
        rows = [''.join('.' if v else '#' for v in r) for r in s.walk]
        d = {'w': s.wc, 'h': s.hc, 'walk': rows, 'legend': '. 걸음 / # 막힘'}
        if extra: d.update(extra)
        json.dump(d, open(path, 'w'), ensure_ascii=False)

def empty_stats(scene, decorated, win=(20, 15)):
    """한 화면(20×15칸) 창을 훑어 가장 빈 창의 빈 바닥 비율. decorated: bool(hc,wc) — 물체·구조·특징이 있는 칸."""
    hc, wc = decorated.shape; worst = (0, 0, 0)
    for y in range(0, hc - win[1] + 1, 3):
        for x in range(0, wc - win[0] + 1, 4):
            r = 1 - decorated[y:y + win[1], x:x + win[0]].mean()
            if r > worst[0]: worst = (r, x, y)
    return worst

# ---------------------------------------------------------------- 새 조각 기록
class Parts:
    def __init__(s): s.items = []
    def add(s, name, img, note=''):
        s.items.append((name, img.convert('RGBA'), note))
    def save(s, d, title):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith('.png'): os.remove(os.path.join(d, f))
        tot = 0; lines = ['# %s — 새로 찍은 조각' % title, '', '버들항 파이프라인(city_v6)의 px2 그리기 함수 + 칩셋 램프 색으로 손 도트. 타일셋 시트에는 아직 넣지 않은 데모 조각이다.', '',
                          '| 파일 | 무엇 | 칸수(16px) |', '|---|---|---|']
        for n, im, note in s.items:
            im.save(os.path.join(d, n + '.png'))
            cells = math.ceil(im.width / 16) * math.ceil(im.height / 16); tot += cells
            lines.append('| %s.png | %s | %d칸 (%d×%d) |' % (n, note, cells, math.ceil(im.width / 16), math.ceil(im.height / 16)))
        lines += ['', '합계 조각 %d개 · %d칸.' % (len(s.items), tot)]
        return '\n'.join(lines), len(s.items), tot

# ---------------------------------------------------------------- 공용 조각: 나선 계단 (등대·마법사 탑)
def spiral_stair(R=22, RY=12, steps=10, flip=False, up=True, seed=3):
    """돌 우물 위에 걸린 나선 계단을 3/4 로 본 그림. 폭 2R+6, 바닥에 놓이며 앞면(돌 테)이 아래에 보인다.
    중앙 기둥, 밟판(나무) 10장이 한 바퀴를 돌며 높아진다(밝아진다)."""
    W = 2 * R + 6; H = 2 * RY + 26
    cx = W // 2; cy = RY + 6 + 8      # 윗면 타원 중심 (아랫 벽면 8px 밑에 앞면)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); p = im.load()
    Yb = cy + RY
    for y in range(H):
        for x in range(W):
            dxn = (x + .5 - cx) / R; dyn = (y + .5 - cy) / RY
            r2 = dxn * dxn + dyn * dyn
            if r2 <= 1.0:
                a = math.atan2(dyn, dxn)
                a = -a if flip else a
                t = ((a + math.pi) / (2 * math.pi)) * steps
                k = int(t); fr = t - k
                # 안쪽 기둥
                if r2 < 0.05: p[x, y] = ST[3]; continue
                # 밟판: 올라갈수록 밝게
                lvl = (k + (0 if up else steps - 1 - 2 * k)) % steps / (steps - 1)
                tone = 2 + int(lvl * 2.6)
                c = WD[min(5, tone)]
                if fr < 0.09: c = WD[1]             # 판 사이 틈
                elif fr < 0.22: c = WD[min(6, tone + 1)]
                if r2 > 0.86: c = ST[4] if dyn < 0 else ST[3]   # 돌 난간 윗면
                p[x, y] = c
    # 안쪽 기둥 (윗쪽으로 솟은 원기둥)
    c = C(W, H, seed=seed)
    c.group(2); c.cylinder(cx, cy - 12, cy + 1, 3, 'stone', capry=1.4)
    col = c.img(False)
    # 앞면: 타원 아래쪽 돌 벽 8px
    for y in range(H):
        for x in range(W):
            dxn = (x + .5 - cx) / R; dyn = (y + .5 - 8 - cy) / RY
            dyn0 = (y + .5 - cy) / RY
            if dxn * dxn + dyn * dyn <= 1.0 and dxn * dxn + dyn0 * dyn0 > 1.0 and y > cy:
                v = 3 - int(abs(dxn) * 1.6) + (1 if dxn < -0.2 else 0)
                if (y - cy) % 4 == 0: v -= 1
                if (x // 4 + (y - cy) // 4) % 3 == 0: v -= 0
                p[x, y] = ST[max(1, min(5, v + 1))]
    im.alpha_composite(col)
    # 윤곽
    res = im.copy(); q = res.load(); ip = im.load()
    for y in range(H):
        for x in range(W):
            if ip[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and ip[nx, ny][3]: q[x, y] = ST[0] + (255,); break
    return res

def darken(im, k):
    a = np.array(im.convert('RGBA'), dtype=np.float32); a[..., :3] *= k
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def to_image(arr):
    return Image.fromarray(np.asarray(arr, dtype=np.uint8)).convert('RGBA')

def save_pair(im, d):
    im.save(os.path.join(d, 'render-1x.png'))
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(d, 'render-2x.png'))

# ---------------------------------------------------------------- 버들항 집 블록으로 집 짓기
_L = [None]
def house(st, w, kinds, rows=2, top='eave', bottom='base', gable=None, chimney=None, two=None):
    """버들항 블록(pj)으로 집 하나. kinds: 'lwmdnwr' 같이 칸 종류(폭 = len). 박공(gable)은 칸 번호."""
    import pj
    import pj_demo as D
    if _L[0] is None: _L[0] = pj.library()
    L = _L[0]
    rr = D.roofrows(st, w, gable, rows)
    body = D.storeyrows(st, kinds, top, bottom)
    if two:   # 2층: 위층 종류 문자열
        body = D.storeyrows(st, two, 'eave', 'jetty') + D.storeyrows(st, kinds, 'plain', bottom)
    ov = []
    pad = 1 if chimney is not None else 0
    grid = (['. ' * w] * pad) + rr + body
    if chimney is not None:
        ov = [('%s.chimney.top' % st, chimney, 0), ('%s.chimney.bot' % st, chimney, 1)]
    im = pj.assemble(grid, L, ov)
    return pj.outlined(im)

# ---------------------------------------------------------------- 공용 조각: 등대 렌즈 (프레넬 등)
def _ell_fill(p, W, H, cx, cy, rx, ry, colf):
    for y in range(max(0, int(cy - ry) - 1), min(H, int(cy + ry) + 2)):
        for x in range(max(0, int(cx - rx) - 1), min(W, int(cx + rx) + 2)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                p[x, y] = colf(dx, dy) + (255,)

def lamp_lens():
    """돌 받침 위 황동 틀 + 노란 유리 렌즈. 40×58. 3/4: 윗 타원 + 앞면 원통."""
    W, H = 40, 62; im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); p = im.load(); cx = 20
    # 받침: 돌 원통 (윗면 y=44)
    for y in range(48, 59):
        for x in range(2, 38):
            dx = (x + .5 - cx) / 18
            if abs(dx) <= 1:
                v = 4 - int((dx + 1) * 1.5) + (1 if dx < -.3 else 0)
                if (y - 48) % 5 == 4: v -= 1
                p[x, y] = ST[max(1, min(5, v))] + (255,)
    _ell_fill(p, W, H, cx, 48, 18, 7, lambda dx, dy: ST[5] if dx + dy < 0 else ST[4])
    _ell_fill(p, W, H, cx, 48, 13, 4.8, lambda dx, dy: ST[3] if dy > 0 else ST[2])
    # 유리 원통 (몸통 y=16..42)
    for y in range(16, 47):
        for x in range(6, 34):
            dx = (x + .5 - cx) / 13.5
            if abs(dx) <= 1:
                glow = 1 - dx * dx * .55 - (y - 16) / 60.0
                t = 5 if glow > .5 else 4 if glow > .25 else 3
                if glow > .8 and abs(dx) < .35: p[x, y] = (255, 253, 230, 255); continue
                p[x, y] = SR[t] + (255,)
    # 황동 세로 살 + 가로 테
    for mx in (-.9, -.45, 0, .45, .9):
        x = int(cx + mx * 13.5)
        for y in range(16, 47): p[x, y] = SR[2] + (255,) if mx <= 0 else SR[1 if False else 2] + (255,)
    # 가로 테 (아래로 볼록한 호)
    for y0 in (18, 32, 46):
        for x in range(6, 34):
            dx = (x + .5 - cx) / 13.5
            if abs(dx) <= 1:
                yy = y0 + int(round(math.sqrt(max(0, 1 - dx * dx)) * 3.4))
                p[x, yy] = SR[2] + (255,) if dx > -.2 else SR[3] + (255,)
    # 윗 타원(유리 덮개)
    _ell_fill(p, W, H, cx, 16, 13.5, 3.2, lambda dx, dy: SR[5] if dx + dy < .2 else SR[4])
    for x in range(6, 34):
        dx = (x + .5 - cx) / 13.5
        if abs(dx) <= 1: p[x, 16 + int(round(math.sqrt(max(0, 1 - dx * dx)) * 3.2))] = SR[2] + (255,)
    # 황동 돔 뚜껑
    for y in range(9, 16):
        for x in range(8, 32):
            dx = (x + .5 - cx) / 11.5; dy = (y + .5 - 16) / 8.0
            if dx * dx + dy * dy <= 1.0:
                v = 4 - int((dx + 1) * 1.7)
                p[x, y] = RD[max(2, min(5, v + 2))] + (255,)
    for y in range(4, 10): p[cx, y] = SR[3] + (255,)
    _ell_fill(p, W, H, cx, 3, 2, 2, lambda dx, dy: SR[5])
    return pz.fin(im)

# ---------------------------------------------------------------- 공용 조각: 망원경 (3발 + 황동 통)
def telescope(pt=0):
    """삼각대에 얹은 황동 망원경. 32×40, 오른쪽 위를 향한다."""
    W, H = 32, 40; im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); p = im.load()
    def ln(x0, y0, x1, y1, col, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = int(round(x0 + (x1 - x0) * i / n)); y = int(round(y0 + (y1 - y0) * i / n))
            for k in range(w):
                if 0 <= x + k < W and 0 <= y < H: p[x + k, y] = col + (255,)
    # 삼발이
    ln(15, 20, 6, 37, WD[3], 2); ln(16, 20, 26, 37, WD[2], 2); ln(16, 20, 16, 38, WD[4], 2)
    ln(9, 32, 24, 32, WD[2], 1)
    # 통: 왼아래→오른위 굵은 원통 (3층 명암)
    for i in range(0, 26):
        x = 4 + i; y = 22 - int(i * .55)
        r = 3 if i < 20 else 4
        for k in range(-r, r + 1):
            t = 5 if k < -r + 1 else 4 if k < 0 else 3 if k < r - 1 else 2
            if i > 19: t = 5 if k < 0 else 3
            if 0 <= y + k < H: p[x, y + k] = SR[t] + (255,)
        if i in (6, 13, 20):
            for k in range(-r, r + 1):
                if 0 <= y + k < H: p[x, y + k] = SR[2] + (255,)
    # 접안 끝 + 렌즈 반짝임
    p[29, 9] = (247, 253, 255, 255); p[28, 9] = PL[6] + (255,)
    # 축 (팔)
    ln(15, 20, 16, 16, ST[3], 2)
    return pz.fin(im)
