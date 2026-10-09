# 시간의 틈 지도 조립: 허공 바탕 → 떠 있는 돌(한 덩이 섬 + 구역) → 별빛 다리·징검돌 → 바닥 장식 → 물체(아래부터 위로 정렬).
# 통행: 허공 막힘, 돌 윗면·다리·징검돌 걷기, 물체는 발자국 칸 막힘(키 큰 부드러운 물체는 아랫줄만).
import numpy as np
from collections import deque
from tr_base import *
from tr_base import _hash
import tr_isle as I
import tr_void as V
import tr_auto as A


class Scene:
    def __init__(s, W, H, seed=7):
        s.W, s.H, s.seed = W, H, seed
        s.Wp, s.Hp = W * T, H * T
        s.islands = []          # (Island, walk cells)
        s.walk = set()
        s.bridge = set()
        s.spill = []            # (cells, color)
        s.props = []            # (img, x, ybottom, blocks, name)
        s.decals = []           # (img, px, py, name)
        s.voidprops = []        # 허공 장식(섬 아래에 그린다)
        s.block = set()
        s.marks = {}
        s.count = {}
        s.filled = set()        # 빈 바닥 계산에서 「채움」으로 셀 칸(무늬·장식)

    def add_island(s, isl, walk=None, thr=.72):
        s.islands.append(isl)
        w = walk if walk is not None else I.walk_cells(isl.mask, s.W, s.H, thr)
        s.walk |= w
        return w

    def prop(s, img, x, yb, blocks='bottom', name=None, sort=None):
        """img 의 왼쪽 아래 칸 = (x, yb). blocks: 'bottom'(아랫줄 칠한 칸), 'none', 또는 [(dx,dy)] (dy 0 = 아랫줄, -1 = 그 위)."""
        w, h = img.width // T, img.height // T
        if blocks == 'bottom':
            a = np.array(img)[..., 3]
            bl = [(i, 0) for i in range(w) if (a[img.height - 8:, i * T:(i + 1) * T] > 0).sum() >= 10]
        elif blocks == 'none': bl = []
        elif blocks == 'all': bl = [(i, -j) for i in range(w) for j in range(h)]
        else: bl = list(blocks)
        for (dx, dy) in bl: s.block.add((x + dx, yb + dy))
        s.props.append((img, x, yb, sort if sort is not None else yb, name))
        for i in range(w):
            for j in range(h): s.filled.add((x + i, yb - j))
        if name: s.count[name] = s.count.get(name, 0) + 1

    def voidprop(s, img, px_, py_, name=None):
        s.voidprops.append((img, px_, py_, name))
        if name: s.count[name] = s.count.get(name, 0) + 1

    def decal(s, img, x, y, name=None, dx=0, dy=0):
        s.decals.append((img, x * T + dx, y * T + dy, name))
        for i in range(img.width // T):
            for j in range(img.height // T): s.filled.add((x + i, y + j))
        if name: s.count[name] = s.count.get(name, 0) + 1

    def walk_grid(s):
        g = np.zeros((s.H, s.W), bool)
        for (x, y) in s.walk | s.bridge:
            if 0 <= x < s.W and 0 <= y < s.H: g[y, x] = True
        for (x, y) in s.block:
            if 0 <= x < s.W and 0 <= y < s.H: g[y, x] = False
        return g

    def bfs(s, start):
        g = s.walk_grid(); seen = {start}; q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if 0 <= n[0] < s.W and 0 <= n[1] < s.H and g[n[1], n[0]] and n not in seen: seen.add(n); q.append(n)
        return seen

    def empty(s):
        """20x15 창마다 빈 바닥(걷는 칸 중 무늬·장식·물체 없는 칸) 비율의 최댓값·평균."""
        g = s.walk_grid(); worst = (0, None); vals = []
        for y0 in range(0, s.H - 14):
            for x0 in range(0, s.W - 19):
                n = 0
                for y in range(y0, y0 + 15):
                    for x in range(x0, x0 + 20):
                        if g[y, x] and (x, y) not in s.filled: n += 1
                r = n / 300.0; vals.append(r)
                if r > worst[0]: worst = (r, (x0, y0))
        return round(worst[0], 3), worst[1], round(sum(vals) / max(1, len(vals)), 3)

    def render(s, nebula=None):
        bg = V.void_image(s.Wp, s.Hp, seed=s.seed, neb_blobs=nebula)
        for (img, px_, py_, n) in s.voidprops: bg.alpha_composite(img, (int(px_), int(py_)))
        rock, kind = I.render_islands(s.Wp, s.Hp, s.islands)
        bg.alpha_composite(rock)
        s.kind = kind
        # 별빛 다리: 이웃 = 다리 칸 + 다리 끝에 닿는 돌 칸
        if s.bridge:
            sh = A.starbridge_sheet()
            nb = s.bridge | s.walk
            for (x, y) in s.bridge:
                m = (1 if (x, y - 1) in nb else 0) | (2 if (x + 1, y) in nb else 0) | (4 if (x, y + 1) in nb else 0) | (8 if (x - 1, y) in nb else 0)
                bg.alpha_composite(cell_of(sh, m), (x * T, y * T))
        for (cells, color) in s.spill:
            sh = A.lightspill_sheet(color)
            for (x, y) in cells:
                m = (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
                bg.alpha_composite(cell_of(sh, m), (x * T, y * T))
                s.filled.add((x, y))
        for (img, px_, py_, n) in s.decals: bg.alpha_composite(img, (int(px_), int(py_)))
        for (img, x, yb, so, n) in sorted(s.props, key=lambda p: (p[3], p[1])):
            bg.alpha_composite(img, (x * T, (yb + 1) * T - img.height))
        s.img = bg
        return bg
