# 산중 무림 문파 지도 장면(eastern-castle ek_scene 을 본떠 바닥·절벽만 바꿨다). 칠하는 순서 = 조수가 따라 할 순서:
#   ① 맨 바탕 표본(산 풀 = 버들항 ground.render + ground-mtngrass 덧그림 · ground-court 판석 · ground-bedrock 암반 · ground-stairstone)
#   ② 땅 덩이 오토타일(이끼 돌판 · 낙엽 · 안개 풀 · 흙 산길 · 계곡 웅덩이)  ③ 절벽 띠(ws_cliff.cliff_paint, 칸 막힘)
#   ④ 그림자(곱하기, +6,+3) → 물체(밑변 순) → 맨 위(구름·안개).
import collections
import numpy as np
from PIL import Image
from fr_base import cell_of
import ground as G
import ws_ground as WG, ws_auto as WA, ws_cliff as WC
from ws_base import TC


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        z = lambda: np.zeros((H, W), bool)
        s.m = dict(court=z(), rock=z(), stairstone=z())
        s.auto = {k: set() for k in ('mossflag', 'leafpile', 'mistgrass', 'trail', 'pool')}
        s.mtn = set()                      # ground-mtngrass 덧그림 칸
        s.bands = []                       # 절벽 띠 (x0, x1, y0, rows, ends)
        s.objs = []; s.decals = []; s.top = []
        s.block = z(); s.walk_ok = set(); s.occ = set(); s.marks = {}
        s.count = collections.Counter()

    def rect(s, key, x0, y0, x1, y1, v=True): s.m[key][max(0, y0):y1 + 1, max(0, x0):x1 + 1] = v

    def arect(s, key, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < s.W and 0 <= y < s.H: s.auto[key].add((x, y))

    def band(s, x0, x1, tops, bots):
        """절벽 띠: 열 x0..x1, 열마다 위 줄 tops[i] · 아래 끝 bots[i](칸 줄 + 1). 칸 전부 막힘."""
        s.bands.append((x0, list(tops), list(bots)))
        for i, (t, b) in enumerate(zip(tops, bots)): s.block[t:b, x0 + i] = True

    def at(s, im, cx, cy, block='bottom', rows=1, dx=0, dy=0, shadow=None, sorty=None, name=None, occ=True, walk=()):
        x = cx * 16 + dx; y = (cy + 1) * 16 - im.height + dy
        wc = -(-im.width // 16); hc = -(-im.height // 16)
        if block == 'bottom': bl = [(cx + i, cy - j) for i in range(wc) for j in range(rows)]
        elif block == 'all': bl = [(cx + i, cy - j) for i in range(wc) for j in range(hc)]
        elif block is None: bl = []
        else: bl = [(cx + i, cy + j) for i, j in block]
        wk = {(cx + i, cy + j) for i, j in walk}
        bl = [c for c in bl if c not in wk]
        for c in wk: s.walk_ok.add(c)
        if shadow is None: shadow = im.height >= 40
        s.objs.append(((y + im.height) if sorty is None else sorty, x, y, im, shadow))
        for (bx, by) in bl:
            if 0 <= bx < s.W and 0 <= by < s.H: s.block[by, bx] = True
        if name: s.count[name] += 1
        if occ:
            for i in range(wc):
                for j in range(hc): s.occ.add((cx + i, cy - j))

    def decal(s, im, cx, cy, dx=0, dy=0, name=None):
        s.decals.append((cx * 16 + dx, (cy + 1) * 16 - im.height + dy, im))
        if name: s.count[name] += 1

    def topimg(s, im, x, y, name=None):
        s.top.append((int(x), int(y), im))
        if name: s.count[name] += 1

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = ~(s.block | s.m['rock'])
        for (x, y) in s.auto['pool']: g[y, x] = False
        for (x, y) in s.walk_ok:
            if 0 <= x < s.W and 0 <= y < s.H: g[y, x] = True
        return g

    def bfs(s, start):
        g = s.walk_grid(); seen = {start}; q = collections.deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < s.W and 0 <= ny < s.H and (nx, ny) not in seen and g[ny, nx]:
                    seen.add((nx, ny)); q.append((nx, ny))
        return seen

    @staticmethod
    def _nb(cells, x, y):
        return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)

    # ---------------------------------------------------------------- 렌더
    def render(s):
        Wp, Hp = s.W * 16, s.H * 16
        K = lambda m: np.kron(m, np.ones((16, 16))).astype(bool)
        pav = K(s.m['court'] | s.m['rock'] | s.m['stairstone'])
        tr = np.zeros((s.H, s.W), bool)
        for (x, y) in s.auto['trail']: tr[y, x] = True
        grass, _ = G.render(Wp, Hp, [], pav | K(tr), seed=s.seed)
        img = grass
        for (x, y) in s.mtn: img.alpha_composite(WG.mtngrass_overlay(x, y), (x * 16, y * 16))
        out = np.array(img).astype(int)
        Y, X = np.mgrid[0:Hp, 0:Wp]
        for key, fn in (('court', lambda: WG.court_rgb(X, Y)), ('rock', lambda: WG.GRANa[WG.bedrock_k(X, Y)]),
                        ('stairstone', lambda: WG.stairstone_rgb(X, Y))):
            km = K(s.m[key])
            if km.any(): out[..., :3] = np.where(km[..., None], fn(), out[..., :3])
        from scipy import ndimage as ndi                                        # 판석 마당 가장자리 턱(위 모 밝게) + 풀 쪽 아래 그늘
        ped = K(s.m['court'])
        edge = ped & ~ndi.binary_erosion(ped, iterations=1)
        out[..., :3] = np.where(edge[..., None], WG.STa[3], out[..., :3])
        sh = ~pav & (np.roll(ped, 1, 0) | np.roll(ped, 2, 0))
        out[..., :3] = np.where(sh[..., None], (out[..., :3] * .78).astype(int), out[..., :3])
        img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
        s.sheets = {k: fn() for (k, fn) in (('trail', WA.autotile_trail), ('mossflag', WA.autotile_mossflag), ('leafpile', WA.autotile_leafpile),
                                            ('mistgrass', WA.autotile_mistgrass), ('pool', WA.autotile_gorgepool))}
        for key in ('trail', 'mossflag', 'leafpile', 'pool', 'mistgrass'):
            cells = s.auto[key]
            for (x, y) in cells: img.alpha_composite(cell_of(s.sheets[key], s._nb(cells, x, y)), (x * 16, y * 16))
        for (x0, tops, bots) in s.bands:                                         # 절벽 띠(지형 — 윤곽 없이)
            bim, T0 = WC.cliff_band(tops, bots, x0, 5)
            img.alpha_composite(bim, (x0 * 16, T0 * 16))
        for (x, y, im) in s.decals:
            img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A_ = np.array(img).astype(np.float64); A_[SH, :3] = np.floor(A_[SH, :3] * np.array((0.6, 0.6, 0.7)))
        img = Image.fromarray(A_.astype(np.uint8), 'RGBA').copy()
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
            img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        for (x, y, im) in s.top:
            img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        s.img = img
        return img

    # ---------------------------------------------------------------- 빈 바닥(20x15 창)
    def coverage(s):
        cov = np.zeros((s.H, s.W))
        for x, y, im in [(o[1], o[2], o[3]) for o in s.objs] + list(s.decals):
            a = np.array(im)[:, :, 3] > 128
            for cy in range(max(0, y // 16), min(s.H, (y + im.height - 1) // 16 + 1)):
                for cx in range(max(0, x // 16), min(s.W, (x + im.width - 1) // 16 + 1)):
                    x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + im.width), min(cy * 16 + 16, y + im.height)
                    if x1 > x0 and y1 > y0: cov[cy, cx] = max(cov[cy, cx], a[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
        return cov

    def empty(s, thresh=0.12):
        e = s.coverage() < thresh
        filled = s.m['court'] | s.m['rock'] | s.m['stairstone'] | s.block
        for k in s.auto:
            for (x, y) in s.auto[k]: filled[y, x] = True
        for (x, y) in s.mtn: filled[y, x] = filled[y, x]
        return e & ~filled

    def worst(s, e):
        best = (0, 0, 0); tot = []
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean(); tot.append(r)
                if r > best[0]: best = (r, x, y)
        return best, float(np.mean(tot))
