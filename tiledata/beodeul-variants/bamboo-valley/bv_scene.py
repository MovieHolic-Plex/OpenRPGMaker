# 대나무 숲 계곡 지도 장면(ek_scene 규칙을 이 장소 바닥·오토타일로 바꿨다).
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본(풀 · 흙 · 판석 · 물가 자갈) → ② 땅 덩이 오토타일(대나무 잎 땅 · 이끼 · 오솔길 · 개울)
# → ③ 풀 덧그림·땅 장식 → 그림자(곱하기) → 물체(밑변 순, 울타리 오토타일 칸 포함) → 맨 위(안개).
import collections
import numpy as np
from PIL import Image
from bv_base import cell_of
import bv_ground as BG


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        z = lambda: np.zeros((H, W), bool)
        s.m = dict(dirt=z(), flag=z(), pebble=z())
        s.stream = set(); s.litter = set(); s.moss = set(); s.trail = set(); s.fence = set()
        s.gz = {}
        s.objs = []; s.decals = []; s.top = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set(); s.occ = set(); s.marks = {}
        s.count = collections.Counter()

    def rect(s, key, x0, y0, x1, y1, v=True):
        s.m[key][max(0, y0):y1 + 1, max(0, x0):x1 + 1] = v

    def at(s, im, cx, cy, block='bottom', rows=1, dx=0, dy=0, shadow=None, sorty=None, name=None, occ=True, walk=()):
        """그림 밑변을 칸 줄 cy 아래 끝, 왼쪽을 칸 cx 에 맞춘다. block: 'bottom'(아래 rows 줄) | 'all' | None | [(i,j) 상대, j 는 위로 음수]."""
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

    def decal(s, im, cx, cy, dx=0, dy=0, name=None, top=False):
        (s.top if top else s.decals).append((cx * 16 + dx, (cy + 1) * 16 - im.height + dy, im))
        if name: s.count[name] += 1

    def fence_line(s, cells):
        for c in cells:
            s.fence.add(c); s.block[c[1], c[0]] = True

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = ~s.block.copy()
        for (x, y) in s.stream: g[y, x] = False
        for (x, y) in s.walk_ok:
            if 0 <= x < s.W and 0 <= y < s.H: g[y, x] = True
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
    @staticmethod
    def _nb(cells, x, y):
        return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)

    def render(s, stage=9):
        """stage: 1 = 맨 바탕만, 2 = + 땅 덩이 오토타일, 9 = 전부(단계별 그림을 따로 뽑을 때)."""
        img = BG.compose(s.W, s.H, s.m, seed=s.seed)
        if stage < 2: return img
        s.sheets = dict(litter=BG.autotile_litter(), moss=BG.autotile_moss(), trail=BG.autotile_trail(), stream=BG.autotile_stream(),
                        fence=BG.autotile_rail())
        for (x, y), k in s.gz.items(): img.alpha_composite(BG.grass_overlay(k, x, y), (x * 16, y * 16))
        for key in ('litter', 'moss', 'trail', 'stream'):
            cells = getattr(s, key)
            for (x, y) in cells: img.alpha_composite(cell_of(s.sheets[key], s._nb(cells, x, y)), (x * 16, y * 16))
        if stage < 3: return img
        for (x, y, im) in s.decals:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        objs = list(s.objs)
        for (x, y) in s.fence:
            objs.append(((y + 1) * 16, x * 16, y * 16, cell_of(s.sheets['fence'], s._nb(s.fence, x, y)), False))
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A_ = np.array(img).astype(np.float64); A_[SH, :3] = np.floor(A_[SH, :3] * np.array((0.6, 0.6, 0.7)))
        img = Image.fromarray(A_.astype(np.uint8), 'RGBA').copy()
        for sy, x, y, im, sh in sorted(objs, key=lambda o: (o[0], o[1])):
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        for (x, y, im) in s.top:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        s.img = img
        return img

    # ---------------------------------------------------------------- 빈 바닥(20x15 창)
    def coverage(s):
        cov = np.zeros((s.H, s.W))
        items = [(o[1], o[2], o[3]) for o in s.objs] + [(x, y, im) for (x, y, im) in s.decals]
        for x, y, im in items:
            a = np.array(im)[:, :, 3] > 128
            for cy in range(max(0, y // 16), min(s.H, (y + im.height - 1) // 16 + 1)):
                for cx in range(max(0, x // 16), min(s.W, (x + im.width - 1) // 16 + 1)):
                    x0, y0 = max(cx * 16, x), max(cy * 16, y); x1, y1 = min(cx * 16 + 16, x + im.width), min(cy * 16 + 16, y + im.height)
                    if x1 > x0 and y1 > y0: cov[cy, cx] = max(cov[cy, cx], a[y0 - y:y1 - y, x0 - x:x1 - x].sum() / 256.0)
        return cov

    def empty(s, thresh=0.12):
        cov = s.coverage()
        e = cov < thresh
        filled = s.m['flag'] | s.m['pebble']
        for (x, y) in s.fence | s.stream | s.litter | s.moss | s.trail: filled[y, x] = True
        return e & ~filled

    def worst(s, e):
        best = (0, 0, 0); tot = []
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean(); tot.append(r)
                if r > best[0]: best = (r, x, y)
        return best, float(np.mean(tot))
