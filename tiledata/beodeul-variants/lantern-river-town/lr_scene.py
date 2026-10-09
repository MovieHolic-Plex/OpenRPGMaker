# 등불 수향 마을 지도 장면 — 이 팩의 조각만으로 칠한다(조수가 따라 할 순서):
#   1) 맨 바탕 표본(ground-*, 칸마다 이름, 48 주기 → 칸 (x%3, y%3) 조각)
#   2) 땅 덩이 오토타일(아래층: 젖은 석판 → 운하 물, 위층: 연잎) — 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8
#   3) 땅 장식 → 그림자(곱하기, +6,+3) → 물체(밑변 순) → 맨 위(홍등 줄)
# 통행: 운하·연잎 칸 막힘(다리·부두 walk 칸은 연다), 물체 block 칸 막힘.
import collections
import numpy as np
from PIL import Image
from lr_base import cell_of
import lr_ground as LG

GROUNDS = None
AUTOS = None


def _load():
    global GROUNDS, AUTOS
    if GROUNDS is None:
        GROUNDS = {k: f() for k, f in LG.SAMPLES.items()}
        AUTOS = {k: f() for k, f in LG.AUTOS.items()}


class Scene:
    LOWER = ('autotile-flagstone-curb', 'autotile-wet-flagstone', 'autotile-canal')
    UPPER = ('autotile-lotus',)
    BLOCKING = ('autotile-canal', 'autotile-lotus')

    def __init__(s, W, H, base='ground-grass'):
        _load()
        s.W, s.H = W, H
        s.g = np.full((H, W), base, dtype=object)
        s.auto = {k: set() for k in AUTOS}
        s.objs = []; s.decals = []; s.top = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set(); s.occ = set(); s.marks = {}
        s.count = collections.Counter()

    # ---------------------------------------------------------------- 칠하기
    def ground(s, name, x0, y0, x1, y1):
        s.g[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = name

    def ground_cells(s, name, cells):
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: s.g[y, x] = name

    def paint(s, auto, cells):
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: s.auto[auto].add((x, y))

    def erase(s, auto, cells):
        for c in cells: s.auto[auto].discard(c)

    def rect_cells(s, x0, y0, x1, y1): return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]

    # ---------------------------------------------------------------- 물체
    def at(s, im, cx, cy, block='bottom', rows=1, dx=0, dy=0, shadow=None, sorty=None, name=None, occ=True, walk=()):
        """그림 밑변을 칸 줄 cy 아래 끝, 왼쪽을 칸 cx 에 맞춘다. block: 'bottom'(아래 rows 줄) | 'all' | None | [(i,j) 상대, j 는 위로 음수].
        walk: 막힘에서 빼고 걷기로 여는 칸 [(i,j)] (문·다리·부두)."""
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

    def free(s, x, y, w=1, h=1, margin=0):
        for j in range(-margin, h + margin):
            for i in range(-margin, w + margin):
                xx, yy = x + i, y - j
                if not (0 <= xx < s.W and 0 <= yy < s.H): return False
                if (xx, yy) in s.occ or s.block[yy, xx] or s.wet(xx, yy): return False
        return True

    def wet(s, x, y): return any((x, y) in s.auto[a] for a in s.BLOCKING)

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = ~s.block.copy()
        for a in s.BLOCKING:
            for (x, y) in s.auto[a]: g[y, x] = False
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
    def nb(cells, x, y):
        return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)

    def render(s, stage=9):
        img = Image.new('RGBA', (s.W * 16, s.H * 16), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                t = GROUNDS[s.g[y, x]]
                img.paste(t.crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16)), (x * 16, y * 16))
        if stage >= 2:
            for a in s.LOWER + s.UPPER:
                cells = s.auto[a]; sh = AUTOS[a]
                for (x, y) in cells: img.alpha_composite(cell_of(sh, s.nb(cells, x, y)), (x * 16, y * 16))
        if stage >= 3:
            for (x, y, im) in s.decals:
                x0, y0 = max(0, x), max(0, y)
                img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
            mask = Image.new('L', img.size, 0)
            for sy, x, y, im, sh in s.objs:
                if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
            SH = np.array(mask) > 0
            A_ = np.array(img).astype(np.float64); A_[SH, :3] = np.floor(A_[SH, :3] * np.array((0.6, 0.6, 0.7)))
            img = Image.fromarray(A_.astype(np.uint8), 'RGBA').copy()
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
        """빈 바닥 = 맨 풀·흙(포장·물·덩이 오토타일·물체 없는 칸). 판석·벽돌·부두 널은 포장이라 채움으로 센다."""
        cov = s.coverage()
        e = cov < thresh
        bare = np.isin(s.g, ['ground-grass', 'ground-grass-meadow', 'ground-grass-shade', 'ground-dirt'])
        for a in s.auto:
            for (x, y) in s.auto[a]: bare[y, x] = False
        return e & bare

    def worst(s, e):
        best = (0, 0, 0); tot = []
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean(); tot.append(r)
                if r > best[0]: best = (r, x, y)
        return best, float(np.mean(tot))
