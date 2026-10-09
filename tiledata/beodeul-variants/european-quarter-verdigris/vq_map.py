# 녹청 지붕 저택가 데모 맵 엔진 — 조수가 따라 할 순서 그대로 칠한다:
#   ① 맨 바탕 표본(ground-*, 칸 (x%3, y%3) 로 3x3 표본을 이어 붙임) → ② 오토타일 덩이(16변형, 위 1·오른 2·아래 4·왼 8)
#   → ③ 건물·소품(키트 그림 그대로, 아래 brows 줄 막힘) → 쇠 난간(위층 오토타일, 막힘).
# 지도에는 이 팩 조각(parts/*.png 와 같은 그림)만 쓴다 — 이웃 장소·버들항 도시 칸을 쓰지 않는다(팩 하나로 닫힘).
import json
from collections import deque
from vq_base import *
import vq_kit as KT

def cell_of(sheet, n): return sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
LOWER_AUTOS = ('autotile-cobblepath', 'autotile-moss', 'autotile-puddle', 'autotile-slush', 'autotile-hedge')
ROADS = ('ground-cobble', 'ground-flagstone', 'ground-wetstone', 'ground-gravel')
GLEG = {'ground-cobble': 'c', 'ground-flagstone': 'f', 'ground-wetstone': 'w', 'ground-lawn': 'l', 'ground-gravel': 'g'}

class Map:
    def __init__(s, W, H, base='ground-cobble'):
        s.W, s.H = W, H
        s.base = [[base] * W for _ in range(H)]
        s.auto = {}
        s.objs = []
        s.block = [[False] * W for _ in range(H)]
        s.occ = set(); s.marks = {}; s.count = {}
    def paint(s, name, cells):
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: s.base[y][x] = name
    def rect(s, x0, y0, x1, y1): return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    def mask(s, name):
        if name not in s.auto: s.auto[name] = [[False] * s.W for _ in range(s.H)]
        return s.auto[name]
    def auto_set(s, name, cells, v=True):
        m = s.mask(name)
        for (x, y) in cells:
            if 0 <= x < s.W and 0 <= y < s.H: m[y][x] = v
    def nbits(s, m, x, y):
        on = lambda xx, yy: 0 <= xx < s.W and 0 <= yy < s.H and m[yy][xx]
        return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
    def free(s, x0, y0, w, h=1):
        return all(0 <= x < s.W and 0 <= y < s.H and (x, y) not in s.occ for x in range(x0, x0 + w) for y in range(y0 - h + 1, y0 + 1))
    def put(s, name, cx, cy, flip=False, force=False, block_rows=None, shadow=None, open_cols=()):
        """조각 name 을 왼쪽 아래 칸 (cx, cy) 에 찍는다. 막힘 = partmeta brows 줄(block_rows 로 지도에서만 늘릴 수 있다 — 뒤가 막힌 건물 줄).
        open_cols = 막지 않을 열(열린 대문 가운데)."""
        im = pad16(KT.img(name)); m = KT.K[name][1]
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        wc, hc = im.width // 16, im.height // 16
        br = m.get('brows', 0) if m['kind'] in ('object', 'tree') else 0
        if block_rows is not None: br = block_rows
        if not force and not s.free(cx, cy, wc, max(1, br)): return False
        x = cx * 16; y = (cy + 1) * 16 - im.height
        if shadow is None: shadow = m['kind'] in ('object', 'tree') and im.height >= 32 and m.get('role') != 'wall'
        s.objs.append(((cy + 1) * 16 if m['kind'] != 'decal' else -1, x, y, im, shadow, name))
        for j in range(br):
            for i in range(wc):
                if i in open_cols: continue
                if 0 <= cx + i < s.W and 0 <= cy - j < s.H: s.block[cy - j][cx + i] = True
        for j in range(max(1, br)):
            for i in range(wc): s.occ.add((cx + i, cy - j))
        s.count[name] = s.count.get(name, 0) + 1
        return True
    def render(s):
        W, H = s.W, s.H
        img = Image.new('RGBA', (W * 16, H * 16)); samp = {}
        for y in range(H):
            for x in range(W):
                n = s.base[y][x]
                if n not in samp: samp[n] = KT.img(n)
                img.alpha_composite(samp[n].crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16)), (x * 16, y * 16))
        for name in LOWER_AUTOS:
            if name not in s.auto: continue
            sh = KT.img(name); m = s.auto[name]
            for y in range(H):
                for x in range(W):
                    if m[y][x]:
                        img.alpha_composite(cell_of(sh, s.nbits(m, x, y)), (x * 16, y * 16))
                        if name == 'autotile-hedge': s.block[y][x] = True
        objs = list(s.objs)
        if 'autotile-ironrail' in s.auto:
            sh = KT.img('autotile-ironrail'); m = s.auto['autotile-ironrail']
            for y in range(H):
                for x in range(W):
                    if m[y][x]:
                        objs.append(((y + 1) * 16, x * 16, y * 16, cell_of(sh, s.nbits(m, x, y)), False, 'rail'))
                        s.block[y][x] = True
        for o in [o for o in objs if o[0] < 0]: img.alpha_composite(o[3], (o[1], o[2]))
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, shd, _ in objs:
            if shd: mask.paste(255, (x + 5, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * SHADOW_K)
        img = Image.fromarray(A.astype(np.uint8), 'RGBA')
        for sy, x, y, im, shd, _ in sorted([o for o in objs if o[0] >= 0], key=lambda o: (o[0], o[1])):
            if x < 0 or y < 0: im = im.crop((max(0, -x), max(0, -y), im.width, im.height)); x, y = max(0, x), max(0, y)
            img.alpha_composite(im, (x, y))
        s.img = img
        return img
    def walk(s):
        f = s.auto.get('autotile-ironrail'); hd = s.auto.get('autotile-hedge')
        return [[not s.block[y][x] and not (f and f[y][x]) and not (hd and hd[y][x]) for x in range(s.W)] for y in range(s.H)]
    def bfs(s, start):
        wk = s.walk(); seen = {start}; q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < s.W and 0 <= ny < s.H and (nx, ny) not in seen and wk[ny][nx]: seen.add((nx, ny)); q.append((nx, ny))
        return seen
    def coverage(s):
        cov = np.zeros((s.H, s.W))
        for sy, x, y, im, shd, name in s.objs:
            if sy < 0: continue
            a = np.array(im)[:, :, 3] > 128
            full = np.zeros((s.H * 16, s.W * 16), bool)
            x0, y0 = max(0, x), max(0, y); x1, y1 = min(s.W * 16, x + im.width), min(s.H * 16, y + im.height)
            if x1 > x0 and y1 > y0: full[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
            cov = np.maximum(cov, full.reshape(s.H, 16, s.W, 16).mean(axis=(1, 3)))
        return cov
    def emptiness(s, autos_full=False):
        """빈 바닥: 물체 덮임 < 0.25 이고 길·광장·보도 바닥이 아니고 (autos_full=False 면) 오토타일 덩이도 아닌 칸. 20x15 창 최댓값."""
        cov = s.coverage(); e = np.zeros((s.H, s.W), bool)
        for y in range(s.H):
            for x in range(s.W):
                road = s.base[y][x] in ROADS or s.auto.get('autotile-cobblepath', [[0] * s.W] * s.H)[y][x]
                patch = any(s.auto[n][y][x] for n in s.auto if n not in ('autotile-cobblepath',))
                e[y, x] = cov[y, x] < 0.25 and not road and (autos_full or not patch) and not s.block[y][x]
        best = (0, (0, 0))
        for y0 in range(0, s.H - 15 + 1, 3):
            for x0 in range(0, s.W - 20 + 1, 4):
                r = e[y0:y0 + 15, x0:x0 + 20].mean()
                if r > best[0]: best = (r, (x0, y0))
        return best, e.mean()
    def save(s, outdir, extra=None):
        s.img.save(outdir + '/render-1x.png')
        s.img.resize((s.img.width * 2, s.img.height * 2), Image.NEAREST).save(outdir + '/render-2x.png')
        wk = s.walk()
        g = {'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if wk[y][x] else '#' for x in range(s.W)) for y in range(s.H)],
             'legend': {'.': 'walkable', '#': 'blocked'}, 'marks': {k: list(v) for k, v in s.marks.items()},
             'ground': [''.join(GLEG[s.base[y][x]] for x in range(s.W)) for y in range(s.H)],
             'ground_legend': {v: k for k, v in GLEG.items()},
             'autotiles': {n: [''.join('1' if m[y][x] else '0' for x in range(s.W)) for y in range(s.H)] for n, m in s.auto.items()},
             'objects': [{'name': name, 'x': x // 16, 'y_bottom': (y + im.height) // 16 - 1} for sy, x, y, im, shd, name in s.objs]}
        if extra: g.update(extra)
        json.dump(g, open(outdir + '/grid.json', 'w'), ensure_ascii=False)
