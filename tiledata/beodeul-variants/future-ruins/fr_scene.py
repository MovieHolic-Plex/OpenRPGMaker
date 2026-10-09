# 미래 폐허 지도 장면: 바닥 마스크(콘크리트·아스팔트·강철판·흙·오염) + 덧그림 오토타일(깨진 포장·녹 번짐·오염 웅덩이)
# + 땅 장식 + 물체(밑변 순) → 렌더 / 통행 격자 / BFS / 빈 바닥 창 검사.
# 그리는 순서는 버들항 장면과 같다: 땅 → 길·포장 → 덧그림 → 장식 → 그림자(곱하기, +6,+3) → 물체(밑변 순) → 맨 위(김·전선).
import collections
import numpy as np
from PIL import Image
from fr_base import cell_of
from fr_ground import compose, autotile_crack, autotile_rust, autotile_toxpool


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        z = lambda: np.zeros((H, W), bool)
        s.m = dict(conc=z(), asph=z(), plate=z(), dirt=z(), lane=z(), lane_v=z(), sick=np.zeros((H, W)))
        s.tox = set(); s.crack = set(); s.rust = set()
        s.objs = []; s.decals = []; s.top = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set()
        s.occ = set()
        s.marks = {}
        s.count = collections.Counter()

    def sprite(s, im, x, y, block=(), shadow=False, sorty=None, name=None):
        s.objs.append(((y + im.height) if sorty is None else sorty, x, y, im, shadow))
        for (cx, cy) in block:
            if 0 <= cx < s.W and 0 <= cy < s.H: s.block[cy, cx] = True
        if name: s.count[name] += 1

    def at(s, im, cx, cy, block='bottom', rows=1, dx=0, dy=0, shadow=None, sorty=None, name=None, occ=True):
        """그림 밑변을 칸 줄 cy 아래 끝, 왼쪽을 칸 cx 에 맞춘다. block: 'bottom'(아래 rows 줄) | 'all' | None | [(i,j) 상대]."""
        x = cx * 16 + dx; y = (cy + 1) * 16 - im.height + dy
        wc = -(-im.width // 16); hc = -(-im.height // 16)
        if block == 'bottom': bl = [(cx + i, cy - j) for i in range(wc) for j in range(rows)]
        elif block == 'all': bl = [(cx + i, cy - j) for i in range(wc) for j in range(hc)]
        elif block is None: bl = []
        else: bl = [(cx + i, cy + j) for i, j in block]
        if shadow is None: shadow = im.height >= 40
        s.sprite(im, x, y, bl, shadow, sorty, name)
        if occ:
            for i in range(wc):
                for j in range(hc): s.occ.add((cx + i, cy - j))

    def decal(s, im, cx, cy, dx=0, dy=0, name=None):
        s.decals.append((cx * 16 + dx, (cy + 1) * 16 - im.height + dy, im))
        if name: s.count[name] += 1

    def topimg(s, im, x, y): s.top.append((x, y, im))

    def free(s, x, y, w=1, h=1, paved_ok=True, margin=0):
        for j in range(-margin, h + margin):
            for i in range(-margin, w + margin):
                xx, yy = x + i, y - j
                if not (0 <= xx < s.W and 0 <= yy < s.H): return False
                if (xx, yy) in s.occ or (xx, yy) in s.tox or s.block[yy, xx]: return False
                if not paved_ok and (s.m['asph'][yy, xx] or s.m['conc'][yy, xx] or s.m['plate'][yy, xx]): return False
        return True

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = ~s.block.copy()
        for (x, y) in s.tox: g[y, x] = False
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
    def render(s):
        img, pav = compose(s.W, s.H, s.m, seed=s.seed)
        s.pav = pav
        sheets = {'crack': autotile_crack(), 'rust': autotile_rust(), 'tox': autotile_toxpool(), 'crack_a': autotile_crack(pave='asph')}
        s.sheets = sheets
        for name, cells in (('crack', s.crack), ('rust', s.rust), ('tox', s.tox)):
            for (x, y) in cells:
                sh = sheets['crack_a'] if (name == 'crack' and s.m['asph'][y, x]) else sheets[name]
                n = (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
                img.alpha_composite(cell_of(sh, n), (x * 16, y * 16))
        for (x, y, im) in s.decals:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((0.58, 0.58, 0.68)))
        img = Image.fromarray(A.astype(np.uint8), 'RGBA').copy()
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
        filled = s.m['asph'] | s.m['conc'] | s.m['plate']
        for (x, y) in s.tox | s.crack | s.rust: filled[y, x] = True
        for (x, y) in getattr(s, 'path', ()): filled[y, x] = True
        return e & ~filled

    def worst(s, e):
        best = (0, 0, 0); tot = []
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean(); tot.append(r)
                if r > best[0]: best = (r, x, y)
        return best, float(np.mean(tot))
