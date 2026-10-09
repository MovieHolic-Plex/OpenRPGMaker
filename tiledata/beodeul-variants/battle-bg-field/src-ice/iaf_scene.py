# 빙하기 설원 필드 지도 장면: 빙하(윗면·앞면) · 언 호수 · 물길 · 길 · 다진 눈 · 장식 · 물체 → 렌더/통행 격자/BFS.
# 그리는 순서(버들항 bdA.Scene.render 와 같다): 땅 → 다진 눈·호수 얼음·물길 → 길 덧그림 → 빙하 → 앞면 장식 → 땅 장식 → 그림자(곱하기) → 물체(밑변 순) → 맨 위.
import math, collections
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from iaf_base import P, hash2, smooth, soft_mask, cell_of, SN
import iaf_ground as G


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        s.water = set(); s.lake = set(); s.path = set(); s.join = set(); s.packed = set(); s.drift = set()
        s.GT = None; s.FH = None
        s.objs = []; s.decals = []; s.face_decals = []; s.top = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set(); s.occ = set(); s.canopy = set(); s.marks = {}; s.filled = set()
        s.count = collections.Counter()

    # ---------------------------------------------------------------- 빙하
    def set_glacier(s, GT, FH):
        s.GT, s.FH = GT, FH
        s.gl = np.zeros((s.H, s.W), bool); s.face = np.zeros((s.H, s.W), bool)
        for x in range(s.W):
            for y in range(GT[x] + 1): s.gl[y, x] = True
            for y in range(GT[x] + 1, GT[x] + 1 + FH[x]): s.face[y, x] = True
    def ground_y0(s, x): return s.GT[x] + s.FH[x] + 1          # 빙벽 밑 첫 땅 줄

    # ---------------------------------------------------------------- 놓기
    def sprite(s, im, x, y, block=(), shadow=False, sorty=None, name=None):
        s.objs.append(((y + im.height) if sorty is None else sorty, x, y, im, shadow))
        for (cx, cy) in block:
            if 0 <= cx < s.W and 0 <= cy < s.H: s.block[cy, cx] = True
        if name: s.count[name] += 1
    def at(s, im, cx, cy, block='bottom', dx=0, dy=0, shadow=None, sorty=None, name=None):
        x = cx * 16 + dx; y = (cy + 1) * 16 - im.height + dy
        wc = -(-im.width // 16); hc = -(-im.height // 16)
        if block == 'bottom': bl = [(cx + i, cy) for i in range(wc)]
        elif block == 'all': bl = [(cx + i, cy - j) for i in range(wc) for j in range(hc)]
        elif block is None: bl = []
        else: bl = [(cx + i, cy + j) for i, j in block]
        if shadow is None: shadow = im.height >= 40
        s.sprite(im, x, y, bl, shadow, sorty, name)
    def decal(s, im, cx, cy, dx=0, dy=0, name=None):
        s.decals.append((cx * 16 + dx, (cy + 1) * 16 - im.height + dy, im))
        if name: s.count[name] += 1
    def face_decal(s, im, px_x, px_y, name=None):
        s.face_decals.append((px_x, px_y, im))
        if name: s.count[name] += 1

    def cell_ok(s, x, y, path_margin=0, allow_path=False, on_lake=False):
        if not (0 <= x < s.W and 0 <= y < s.H): return False
        if s.gl[y, x] or s.face[y, x] or (x, y) in s.water or (x, y) in s.occ or s.block[y, x]: return False
        if (x, y) in s.canopy and not getattr(s, '_tree_mode', False): return False
        if ((x, y) in s.lake) != on_lake: return False
        if not allow_path and ((x, y) in s.path or (x, y) in s.join): return False
        for j in range(-path_margin, path_margin + 1):
            for i in range(-path_margin, path_margin + 1):
                if (i or j) and ((x + i, y + j) in s.path or (x + i, y + j) in s.water): return False
        return True
    def reserve(s, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.occ.add((x, y))

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = ~(s.gl | s.face | s.block)
        for (x, y) in s.water: g[y, x] = False
        for (x, y) in s.walk_ok: g[y, x] = True
        return g
    def bfs(s, start):
        g = s.walk_grid()
        seen = {start}; q = collections.deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < s.W and 0 <= ny < s.H and (nx, ny) not in seen and g[ny, nx]:
                    seen.add((nx, ny)); q.append((nx, ny))
        return seen

    # ---------------------------------------------------------------- 렌더
    def mask_px(s, cells):
        m = np.zeros((s.H, s.W), bool)
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: m[y, x] = True
        return np.kron(m, np.ones((16, 16), bool))

    def render(s, trail_sheet, packed_tex, drift_sheet=None):
        W, H = s.W, s.H; Wp, Hp = W * 16, H * 16
        img = Image.fromarray(G.snow_rgb(Wp, Hp, s.seed)).convert('RGBA')
        # 다진 눈(야영지)
        if s.packed:
            pm = soft_mask(s.mask_px(s.packed), s.seed + 21, 5.0, 7.0)
            A = np.array(img); pt = np.array(packed_tex.convert('RGBA'))
            Y, X = np.mgrid[0:Hp, 0:Wp]
            T = pt[Y % 48, X % 48]
            A[pm] = T[pm]
            img = Image.fromarray(A, 'RGBA').copy()
        # 언 호수
        lm = soft_mask(s.mask_px(s.lake | s.water), s.seed + 31, 6.0, 10.0)
        wm = soft_mask(s.mask_px(s.water), s.seed + 41, 3.0, 6.0)
        s.lake_px = lm; s.water_px = wm
        if lm.any(): img.alpha_composite(G.ice_layer(lm, seed=s.seed + 33, d_in=ndi.distance_transform_edt(lm)))
        if wm.any(): img.alpha_composite(G.water_layer(wm, seed=s.seed + 43))
        # 눈 번짐(16변형, 바람에 쌓인 눈 더미 판)
        if s.drift and drift_sheet is not None:
            dd = s.drift
            for (x, y) in dd:
                n = (1 if (x, y - 1) in dd else 0) | (2 if (x + 1, y) in dd else 0) | (4 if (x, y + 1) in dd else 0) | (8 if (x - 1, y) in dd else 0)
                img.alpha_composite(cell_of(drift_sheet, n), (x * 16, y * 16))
        # 길(16변형)
        def on(x, y): return (x, y) in s.path or (x, y) in s.join
        for (x, y) in s.path:
            n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            img.alpha_composite(cell_of(trail_sheet, n), (x * 16, y * 16))
        img.alpha_composite(G.footprints_layer(s.path, W, H, seed=s.seed + 71))
        img.alpha_composite(G.footprints_layer(s.packed, W, H, seed=s.seed + 73, dens=0.3))
        # 빙하
        gl, fm, tm, lip, bot = G.glacier_layer(s.GT, s.FH, W, seed=s.seed + 61)
        gh = min(gl.height, Hp)
        sh = G.glacier_shadow(bot, Wp, gh, 6)
        A = np.array(img).astype(np.float64)
        A[:gh][sh[:gh], :3] *= np.array((0.80, 0.84, 0.95))
        img = Image.fromarray(A.astype(np.uint8), 'RGBA').copy()
        img.alpha_composite(gl.crop((0, 0, Wp, gh)), (0, 0))
        for (x, y, im) in s.face_decals: img.alpha_composite(im, (x, y))
        for (x, y, im) in s.decals:
            if x >= 0 and y >= 0: img.alpha_composite(im, (x, y))
        # 그림자(곱하기: 눈 위라 푸른빛)
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, shw in s.objs:
            if shw: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((0.70, 0.74, 0.88))); img = Image.fromarray(A.astype(np.uint8), 'RGBA').copy()
        for sy, x, y, im, shw in sorted(s.objs, key=lambda o: (o[0], o[1])):
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        for (x, y, im) in s.top:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        s.img = img
        return img

    # ---------------------------------------------------------------- 빈 바닥(20x15 창)
    def coverage(s):
        if not hasattr(s, '_cov'): s._cov = np.zeros((s.H, s.W)); s._nobj = 0; s._ndec = 0
        items = [(o[1], o[2], o[3]) for o in s.objs[s._nobj:]] + [(x, y, im) for (x, y, im) in s.decals[s._ndec:]]
        s._nobj = len(s.objs); s._ndec = len(s.decals)
        for x, y, im in items:
            a = np.array(im)[:, :, 3] > 128
            for cy in range(max(0, y // 16), min(s.H, (y + im.height - 1) // 16 + 1)):
                for cx in range(max(0, x // 16), min(s.W, (x + im.width - 1) // 16 + 1)):
                    x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + im.width), min(cy * 16 + 16, y + im.height)
                    if x1 > x0 and y1 > y0: s._cov[cy, cx] = max(s._cov[cy, cx], a[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
        return s._cov
    def empty(s, thresh=0.2):
        cov = s.coverage()
        e = cov < thresh
        e &= ~(s.gl | s.face)
        for c in s.path | s.water | s.packed | s.filled | s.lake | s.drift:
            x, y = c
            if 0 <= x < s.W and 0 <= y < s.H: e[y, x] = False
        return e
    def worst(s, e):
        best = (0, 0, 0)
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean()
                if r > best[0]: best = (r, x, y)
        return best
