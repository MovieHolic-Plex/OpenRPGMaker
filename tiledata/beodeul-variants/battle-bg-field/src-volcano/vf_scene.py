# 화산 지대 필드 지도 장면: 높이 단(절벽) · 용암 칸 · 길 칸 · 판석 칸 · 장식 · 물체 → 렌더/통행 격자/BFS.
# 그리는 순서는 버들항 bdA.Scene.render 와 같다: 땅 → 길·판석 덧그림 → 절벽(높이) → 용암·열기 → 그림자(곱하기, +6,+3) → 물체(밑변 순).
import math, json, collections
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from vf_base import ground_render, cliff_render, cell_of, P, RGB, hash2, smooth, LAV, soft_mask, flow_layer
import terrain
import vf_lava as VL


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        s.lev = [[0] * W for _ in range(H)]
        s.lava = set(); s.flow = set(); s.path = set(); s.flag = set(); s.cinder = set(); s.fine = set()
        s.stairs = []
        s.objs = []          # (sorty, x, y, img, shadow)
        s.decals = []        # (x, y, img)  땅 장식(사람 아래)
        s.top = []           # (x, y, img)  맨 위(연기)
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set()    # 강제로 걷기(다리·징검돌·문 칸)
        s.occ = set()
        s.marks = {}
        s.count = collections.Counter()

    # ---------------------------------------------------------------- 높이
    def faces(s): return terrain.faces(s.lev)
    def stair_cells(s): return {(x + i, y + j) for x, y, w in s.stairs for i in range(w) for j in (0, 1, 2)}

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
    def decal(s, im, cx, cy, dx=0, dy=0, name=None):
        s.decals.append((cx * 16 + dx, (cy + 1) * 16 - im.height + dy, im))
        if name: s.count[name] += 1

    # ---- 빈 칸 검사
    def cell_ok(s, x, y, lv=None, path_margin=0, allow_path=False):
        if not (0 <= x < s.W and 0 <= y < s.H): return False
        F = getattr(s, '_F', None)
        if F is None: F = s._F = s.faces()
        if (x, y) in s.lava or F[y][x] or (x, y) in s.occ or s.block[y, x] or (x, y) in s.flag or (x, y) in s.flow: return False
        if (x, y) in s.stair_cells(): return False
        if not allow_path and (x, y) in s.path: return False
        if lv is not None and s.lev[y][x] != lv: return False
        for j in range(-path_margin, path_margin + 1):
            for i in range(-path_margin, path_margin + 1):
                if (x + i, y + j) in s.path or (x + i, y + j) in s.lava: return False
        return True
    def free_rect(s, x, y, w, h, **k):
        lv = s.lev[y][x] if 0 <= y < s.H and 0 <= x < s.W else None
        return all(s.cell_ok(x + i, y - j, lv, **k) for i in range(w) for j in range(h))
    def reserve(s, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.occ.add((x, y))

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        F = s.faces(); sc = s.stair_cells()
        g = np.ones((s.H, s.W), bool)
        for y in range(s.H):
            for x in range(s.W):
                if (x, y) in s.lava or s.block[y, x]: g[y, x] = False
                if F[y][x] and (x, y) not in sc: g[y, x] = False
        for (x, y) in s.walk_ok: g[y, x] = True
        return g
    def bfs(s, start):
        g = s.walk_grid(); sc = s.stair_cells()
        seen = {start}; q = collections.deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < s.W and 0 <= ny < s.H) or (nx, ny) in seen or not g[ny, nx]: continue
                if s.lev[ny][nx] != s.lev[y][x] and (nx, ny) not in sc and (x, y) not in sc: continue
                seen.add((nx, ny)); q.append((nx, ny))
        return seen

    # ---------------------------------------------------------------- 렌더
    def mask_px(s, cells):
        m = np.zeros((s.H, s.W), bool)
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: m[y, x] = True
        return np.kron(m, np.ones((16, 16), bool))

    def render(s, path_sheet, flag_tex, heat=True):
        W, H = s.W, s.H; Wp, Hp = W * 16, H * 16
        lm = s.mask_px(s.lava)
        dl = ndi.distance_transform_edt(~lm) if lm.any() else np.full((Hp, Wp), 999.0)
        scorch = np.clip(1 - dl / 40.0, 0, 1)
        for (x, y) in getattr(s, 'scorch_pts', []):
            Y, X = np.mgrid[0:Hp, 0:Wp]
            scorch = np.maximum(scorch, np.clip(1 - np.hypot(X - x * 16 - 8, Y - y * 16 - 8) / 30.0, 0, 1))
        g, lab = ground_render(Wp, Hp, s.seed, scorch_px=scorch, fine_mask=s.mask_px(s.fine), cinder_mask=s.mask_px(s.cinder))
        img = Image.fromarray(g).convert('RGBA').copy()
        # 옛 용암 흐름판(걷기)
        if s.flow:
            fm = soft_mask(s.mask_px(s.flow), s.seed + 31, 4.5, 9.0) & ~lm
            s.flow_px = fm
            img.alpha_composite(flow_layer(fm, seed=s.seed + 33, glow_px=np.clip(1 - dl / 60.0, 0, 1)))
        # 판석 앞뜰
        if s.flag:
            fl = np.array(flag_tex.convert('RGBA'))
            fm = s.mask_px(s.flag)
            A = np.array(img)
            Y, X = np.mgrid[0:Hp, 0:Wp]
            T = fl[Y % 48, X % 48]
            A[fm] = T[fm]
            e = fm & ~ndi.binary_erosion(fm)
            A[e, :3] = P('basalt')[1]
            img = Image.fromarray(A, 'RGBA').copy()
        # 재 오솔길(16변형)
        def on(x, y): return (x, y) in s.path or (x, y) in s.join
        for (x, y) in s.path:
            n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            img.alpha_composite(cell_of(path_sheet, n), (x * 16, y * 16))
        # 절벽
        cl, F = cliff_render(s.lev, s.stairs, seed=s.seed + 5)
        img.alpha_composite(cl)
        # 용암 · 열기
        if s.lava:
            lv = VL.lava_layer(s.lava, W, H, seed=61)
            if heat:
                img.alpha_composite(VL.heat_layer(s.lava, W, H, seed=71, lava_img=lv))
            img.alpha_composite(lv)
        for (x, y, im) in s.decals: img.alpha_composite(im, (x, y)) if x >= 0 and y >= 0 else None
        # 그림자(곱하기)
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((0.55, 0.55, 0.66))); img = Image.fromarray(A.astype(np.uint8), 'RGBA').copy()
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
        """칸마다 물체·장식이 덮은 비율(최대). 물체·장식은 덧붙기만 하므로 이미 센 것은 다시 세지 않는다."""
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
        cov = s.coverage(); F = s.faces(); sc = s.stair_cells()
        e = np.zeros((s.H, s.W), bool)
        for y in range(s.H):
            for x in range(s.W):
                e[y, x] = cov[y, x] < thresh and not ((x, y) in s.path or (x, y) in s.lava or F[y][x] or (x, y) in sc or (x, y) in s.flag
                                                      or (x, y) in s.cinder or (x, y) in s.flow or (x, y) in getattr(s, 'filled', ()))
        return e
    def worst(s, e, step=1):
        best = (0, 0, 0)
        for y in range(0, s.H - 15 + 1, step):
            for x in range(0, s.W - 20 + 1, step):
                r = e[y:y + 15, x:x + 20].mean()
                if r > best[0]: best = (r, x, y)
        return best
