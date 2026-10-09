# 황폐 필드 지도 장면: 높이 단(깊은 골 = 낮은 칸) · 좁은 균열 칸 · 길 칸 · 재 칸 · 진흙 칸 · 장식 · 물체 → 렌더/통행 격자/BFS.
# 그리는 순서는 버들항 bdA.Scene.render · 화산 지대 vf_scene 과 같다:
#   땅 → 길·재·균열 덧그림 → 골(앞면 지층 + 어둠 + 가까운 테) → 장식 → 그림자(곱하기, +6,+3) → 물체(밑변 순) → 맨 위.
import collections
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from ww_base import ground_render, chasm_render, near_rim, cell_of, P, hash2
import terrain


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        s.lev = [[1] * W for _ in range(H)]          # 1 = 땅, 0 = 깊은 골
        s.crack = set(); s.path = set(); s.dust = set(); s.mud = set(); s.hard = set(); s.join = set()
        s.objs = []; s.decals = []; s.top = []; s.placed = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set(); s.occ = set(); s.marks = {}
        s.count = collections.Counter()

    def faces(s): return terrain.faces(s.lev)
    def void(s): return {(x, y) for y in range(s.H) for x in range(s.W) if s.lev[y][x] == 0}

    # ---------------------------------------------------------------- 놓기
    def sprite(s, im, x, y, block=(), shadow=False, sorty=None, name=None):
        s.objs.append(((y + im.height) if sorty is None else sorty, x, y, im, shadow))
        for (cx, cy) in block:
            if 0 <= cx < s.W and 0 <= cy < s.H: s.block[cy, cx] = True
        if name: s.count[name] += 1
    def at(s, im, cx, cy, block='bottom', dx=0, dy=0, shadow=None, sorty=None, name=None):
        """그림 밑변을 칸 줄 cy 아래 끝에, 왼쪽을 칸 cx 에 맞춘다. block: 'bottom' | 'all' | None | [(i,j) 상대]."""
        x = cx * 16 + dx; y = (cy + 1) * 16 - im.height + dy
        wc = -(-im.width // 16); hc = -(-im.height // 16)
        if block == 'bottom': bl = [(cx + i, cy) for i in range(wc)]
        elif block == 'all': bl = [(cx + i, cy - j) for i in range(wc) for j in range(hc)]
        elif block is None: bl = []
        else: bl = [(cx + i, cy + j) for i, j in block]
        if shadow is None: shadow = im.height >= 40
        s.sprite(im, x, y, bl, shadow, sorty, name)
        if name: s.placed.append((name, cx, cy, wc))
    def decal(s, im, cx, cy, dx=0, dy=0, name=None):
        s.decals.append((cx * 16 + dx, (cy + 1) * 16 - im.height + dy, im))
        if name: s.count[name] += 1

    def cell_ok(s, x, y, path_margin=0, allow_path=False):
        if not (0 <= x < s.W and 0 <= y < s.H): return False
        F = getattr(s, '_F', None)
        if F is None: F = s._F = s.faces()
        if s.lev[y][x] == 0 or (x, y) in s.crack or (x, y) in s.occ or s.block[y, x]: return False
        if y + 1 < s.H and s.lev[y + 1][x] == 0 and y + 1 < s.H: return False         # 골 바로 북쪽 테 칸(윗턱)은 비운다
        if not allow_path and (x, y) in s.path: return False
        for j in range(-path_margin, path_margin + 1):
            for i in range(-path_margin, path_margin + 1):
                if (x + i, y + j) in s.path: return False
        return True
    def reserve(s, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.occ.add((x, y))

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = np.ones((s.H, s.W), bool)
        for y in range(s.H):
            for x in range(s.W):
                if s.lev[y][x] == 0 or (x, y) in s.crack or s.block[y, x]: g[y, x] = False
        for (x, y) in s.walk_ok: g[y, x] = True
        return g
    def bfs(s, start):
        g = s.walk_grid()
        seen = {start}; q = collections.deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < s.W and 0 <= ny < s.H) or (nx, ny) in seen or not g[ny, nx]: continue
                seen.add((nx, ny)); q.append((nx, ny))
        return seen

    # ---------------------------------------------------------------- 렌더
    def mask_px(s, cells):
        m = np.zeros((s.H, s.W), bool)
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: m[y, x] = True
        return np.kron(m, np.ones((16, 16), bool))

    def render(s, sheets):
        W, H = s.W, s.H; Wp, Hp = W * 16, H * 16
        vd = s.void()
        vm = s.mask_px(vd)
        dl = ndi.distance_transform_edt(~vm) if vm.any() else np.full((Hp, Wp), 999.0)
        dark = np.clip(1 - dl / 26.0, 0, 1)
        cm = s.mask_px(s.crack)
        if cm.any(): dark = np.maximum(dark, np.clip(1 - ndi.distance_transform_edt(~cm) / 14.0, 0, 1) * 0.8)
        g, lab = ground_render(Wp, Hp, s.seed, dark_px=dark, mud_mask=s.mask_px(s.mud) if s.mud else None,
                               hard_mask=s.mask_px(s.hard) if s.hard else None)
        img = Image.fromarray(g).convert('RGBA').copy()
        def nb(cells, extra=()):
            ex = set(extra)
            def on(x, y): return (x, y) in cells or (x, y) in ex
            return lambda x, y: (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
        n_dust = nb(s.dust)
        for (x, y) in s.dust: img.alpha_composite(cell_of(sheets['dust'], n_dust(x, y)), (x * 16, y * 16))
        n_path = nb(s.path, s.join)
        for (x, y) in s.path: img.alpha_composite(cell_of(sheets['trail'], n_path(x, y)), (x * 16, y * 16))
        n_cr = nb(s.crack, vd)
        for (x, y) in s.crack: img.alpha_composite(cell_of(sheets['crack'], n_cr(x, y)), (x * 16, y * 16))
        cl, F = chasm_render(s.lev, seed=s.seed + 5, void=vd)
        img.alpha_composite(cl)
        img.alpha_composite(near_rim(s.lev, vd, seed=s.seed + 6))
        for (x, y, im) in s.decals: img.alpha_composite(im, (x, y)) if x >= 0 and y >= 0 else None
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((0.58, 0.52, 0.55))); img = Image.fromarray(A.astype(np.uint8), 'RGBA').copy()
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
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
        e = np.zeros((s.H, s.W), bool)
        for y in range(s.H):
            for x in range(s.W):
                e[y, x] = cov[y, x] < thresh and not ((x, y) in s.path or s.lev[y][x] == 0 or (x, y) in s.crack or (x, y) in s.mud
                                                      or (x, y) in s.dust or (x, y) in s.hard or (x, y) in getattr(s, 'filled', ()))
        return e
    def worst(s, e, step=1):
        best = (0, 0, 0)
        for y in range(0, s.H - 15 + 1, step):
            for x in range(0, s.W - 20 + 1, step):
                r = e[y:y + 15, x:x + 20].mean()
                if r > best[0]: best = (r, x, y)
        return best
