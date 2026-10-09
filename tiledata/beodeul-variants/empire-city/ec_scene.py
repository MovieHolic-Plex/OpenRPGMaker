# 제국 도시 지도 장면: 바닥 마스크(철판 대로·회색 판석·둥근 돌·그을린 콘크리트·흙·풀) + 아래층 오토타일(대로 연석·경계 띠)
# + 땅 장식 + 물체(밑변 순, 철제 울타리 오토타일 칸 포함) + 맨 위(빛줄기·연기) → 렌더 / 통행 격자 / BFS / 빈 바닥 창 검사.
# 그리는 순서는 버들항 장면과 같다: 땅 → 포장 → 덧그림 → 장식 → 그림자(곱하기, +6,+3) → 물체(밑변 순) → 맨 위.
import collections
import numpy as np
from PIL import Image
from ec_base import cell_of
import ec_ground as EG


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        z = lambda: np.zeros((H, W), bool)
        s.m = dict(plate=z(), flag=z(), cob=z(), soot=z(), dirt=z())
        s.curb = set(); s.hazard = set(); s.fence = set()
        s.objs = []; s.decals = []; s.top = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set(); s.occ = set(); s.marks = {}
        s.count = collections.Counter()

    # ---------------------------------------------------------------- 배치
    def rect(s, key, x0, y0, x1, y1, v=True):
        s.m[key][max(0, y0):y1 + 1, max(0, x0):x1 + 1] = v

    def at(s, im, cx, cy, block='bottom', rows=1, dx=0, dy=0, shadow=None, sorty=None, name=None, occ=True, walk=()):
        """그림 밑변을 칸 줄 cy 아래 끝, 왼쪽을 칸 cx 에 맞춘다. block: 'bottom'(아래 rows 줄) | 'all' | None | [(i,j) 상대, j 는 위로 음수].
        walk: 막힘에서 뺄 칸 [(i,j)] (문길·문 칸)."""
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

    def topimg(s, im, x, y): s.top.append((int(x), int(y), im))

    def fence_line(s, cells):
        for c in cells:
            s.fence.add(c); s.block[c[1], c[0]] = True

    def free(s, x, y, w=1, h=1, margin=0):
        for j in range(-margin, h + margin):
            for i in range(-margin, w + margin):
                xx, yy = x + i, y - j
                if not (0 <= xx < s.W and 0 <= yy < s.H): return False
                if (xx, yy) in s.occ or s.block[yy, xx] or (xx, yy) in s.fence: return False
        return True

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = ~s.block.copy()
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

    def render(s):
        img = EG.compose(s.W, s.H, s.m, seed=s.seed)
        sh_curb = EG.autotile_curb(); sh_haz = EG.autotile_hazard(); sh_fence = EG.autotile_ironfence()
        s.sheets = dict(curb=sh_curb, hazard=sh_haz, fence=sh_fence)
        for cells, sh in ((s.curb, sh_curb), (s.hazard, sh_haz)):
            for (x, y) in cells: img.alpha_composite(cell_of(sh, s._nb(cells, x, y)), (x * 16, y * 16))
        for (x, y, im) in s.decals:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        objs = list(s.objs)
        for (x, y) in s.fence:                                               # 울타리 칸 = 밑변 순으로 물체와 함께
            objs.append(((y + 1) * 16, x * 16, y * 16, cell_of(sh_fence, s._nb(s.fence, x, y)), False))
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
        """빈 바닥 = 포장도 장식도 물체도 없는 맨땅(풀·흙). 포장(철판·판석·둥근 돌·콘크리트)과 울타리는 채움으로 센다."""
        cov = s.coverage()
        e = cov < thresh
        filled = s.m['plate'] | s.m['flag'] | s.m['cob'] | s.m['soot']
        for (x, y) in s.fence | s.hazard: filled[y, x] = True
        return e & ~filled

    def worst(s, e):
        best = (0, 0, 0); tot = []
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean(); tot.append(r)
                if r > best[0]: best = (r, x, y)
        return best, float(np.mean(tot))
