# 고원 절벽과 하늘 다리 지도 장면. 높이 L[y][x]: 0 = 하늘(협곡 너머 하늘), 1 = 아래 마당, 2 = 고원.
# 남쪽으로 낮아지는 곳마다 그 아래 3줄이 절벽 앞면(천장 밑 벽 규칙: 앞면 3줄). 앞면 밑이 하늘이면 들린 밑동('sky'), 땅이면 발치 그늘('ground').
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본(풀 섞기 · 하늘 표본 · 맨땅) → ② 땅 덩이 오토타일(마른 풀 · 밭 이랑 · 맨땅 길 ·
# 고원 끝 흙 턱 · 하늘 가장자리) → ③ 절벽 앞면 조각 · 계단 · 비탈 → ④ 땅 장식 → 그림자(곱하기) → 물체(밑변 순: 나무·바위·다리) → 맨 위(구름).
import collections
import numpy as np
from PIL import Image
from hc_base import *
from hc_base import _hash
import hc_ground as HG, hc_cliff as HC, hc_auto as HA


class Scene:
    def __init__(s, W, H, seed=1):
        s.W, s.H, s.seed = W, H, seed
        s.L = np.full((H, W), 2, int)
        s.face = {}                      # (x,y) -> (top_y, upper_level, row 0..2)
        s.special = {}                   # 앞면 대신 놓는 칸(계단·비탈): (x,y) -> 'stair'|'ramp'|'slope'
        s.dry = set(); s.crop = set(); s.path = set(); s.dirt = set()
        s.gz = {}
        s.objs = []; s.decals = []; s.top = []
        s.block = np.zeros((H, W), bool)
        s.walk_ok = set(); s.occ = set(); s.marks = {}
        s.count = collections.Counter()

    # ---------------------------------------------------------------- 높이 → 절벽 앞면
    def build_faces(s):
        s.face = {}
        for x in range(s.W):
            y = 1
            while y < s.H:
                up = s.L[y - 1, x]
                if up > s.L[y, x] and (x, y - 1) not in s.face:
                    for j in range(3):
                        if y + j < s.H and s.L[y + j, x] < up: s.face[(x, y + j)] = (y, up, j)
                    y += 3
                else:
                    y += 1
        return s.face

    def is_sky(s, x, y): return 0 <= x < s.W and 0 <= y < s.H and s.L[y, x] == 0 and (x, y) not in s.face
    def is_land(s, x, y): return 0 <= x < s.W and 0 <= y < s.H and s.L[y, x] > 0 and (x, y) not in s.face

    # ---------------------------------------------------------------- 물체
    def at(s, im, cx, cy, block='bottom', rows=1, dx=0, dy=0, shadow=None, sorty=None, name=None, occ=True, walk=()):
        """그림 밑변을 칸 줄 cy 아래 끝, 왼쪽을 칸 cx 에 맞춘다. block: 'bottom' | 'all' | None | [(i,j) 상대, j 는 위로 음수]."""
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

    # ---------------------------------------------------------------- 통행
    def walk_grid(s):
        g = (s.L > 0) & ~s.block
        for c in s.face:
            if c not in s.special: g[c[1], c[0]] = False
        for (x, y) in s.crop: g[y, x] = False
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
    def _nb(pred, x, y):
        return (1 if pred(x, y - 1) else 0) | (2 if pred(x + 1, y) else 0) | (4 if pred(x, y + 1) else 0) | (8 if pred(x - 1, y) else 0)

    def sky_cell(s, x, y):
        """하늘 표본 셋을 3x3 덩이마다 해시로 고르고 좌우 뒤집는다(격자 반복이 보이지 않게)."""
        bx, by = x // 3, y // 3
        if not hasattr(s, '_skys'):
            s._skys = [HG.sky_sample('clear'), HG.sky_sample('puffs', 3), HG.sky_sample('drift', 5)]
            s._skys += [flip(im) for im in s._skys]
        h = _hash(bx, by, s.seed + 5)
        v = 0 if h < .74 else (1 if h < .88 else 2)
        if _hash(bx, by, s.seed + 6) > .5: v += 3
        im = s._skys[v]
        return im.crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16))

    def lip_pred(s, x0, y0):
        lv = s.L[y0, x0]
        def p(x, y):
            if not (0 <= x < s.W and 0 <= y < s.H): return True
            if (x, y) in s.special: return True
            if s.L[y, x] == 0 and (x, y) not in s.face: return True
            return s.L[y, x] >= lv
        return p

    def render(s, stage=9):
        Wp, Hp = s.W * 16, s.H * 16
        base = HG.grass_mix(Wp, Hp, seed=s.seed, periodic=False, dry=getattr(s, 'dry_amount', 0.0))
        img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
        a = np.array(img)
        if s.dirt:
            Yp, Xp = np.mgrid[0:Hp, 0:Wp]
            d = HG.dirt_rgb(Xp, Yp)
            for (x, y) in s.dirt: a[y * 16:y * 16 + 16, x * 16:x * 16 + 16, :3] = d[y * 16:y * 16 + 16, x * 16:x * 16 + 16]
        img = Image.fromarray(a, 'RGBA')
        for y in range(s.H):
            for x in range(s.W):
                sky_under = s.L[y, x] == 0 or ((x, y) in s.face and (s.is_sky(x - 1, y) or s.is_sky(x + 1, y)))
                if sky_under: img.paste(s.sky_cell(x, y), (x * 16, y * 16))
        if stage < 2: return img
        s.sheets = dict(dry=HA.autotile_dry(), crop=HA.autotile_crop(), path=HA.autotile_path(), lip=HC.autotile_lip(), skyrim=HC.autotile_skyrim())
        for (x, y), k in s.gz.items(): img.alpha_composite(HG.grass_overlay(k, x, y), (x * 16, y * 16))
        for key in ('dry', 'crop', 'path'):
            cells = getattr(s, key)
            for (x, y) in cells: img.alpha_composite(cell_of(s.sheets[key], s._nb(lambda a_, b_: (a_, b_) in cells, x, y)), (x * 16, y * 16))
        for y in range(s.H):
            for x in range(s.W):
                if s.is_land(x, y) and (x, y) not in s.special:
                    n = s._nb(s.lip_pred(x, y), x, y)
                    if n != 15: img.alpha_composite(cell_of(s.sheets['lip'], n), (x * 16, y * 16))
                elif s.is_sky(x, y):
                    n = s._nb(lambda a_, b_: not (0 <= a_ < s.W and 0 <= b_ < s.H) or s.is_sky(a_, b_) or (a_, b_) in s.face, x, y)
                    if n != 15: img.alpha_composite(cell_of(s.sheets['skyrim'], n), (x * 16, y * 16))
        # 절벽 앞면(칸 열마다 3줄, 결은 전역 화소)
        done = set()
        for (x, y), (top, up, j) in sorted(s.face.items()):
            if (x, top) in done: continue
            done.add((x, top))
            if any((x, top + jj) in s.special for jj in range(3)): continue
            bot = top + 2
            foot = 'sky' if (0 <= bot < s.H and s.L[bot, x] == 0) else 'ground'
            def side(xx):
                if not (0 <= xx < s.W): return 'cont'
                c = s.face.get((xx, top)) or s.face.get((xx, top + 2))
                if c: return 'cont' if (xx, top) not in s.special else 'inner'
                if s.L[top, xx] >= up and (xx, top) not in s.face: return 'inner'
                return 'end'
            sw, se = side(x - 1), side(x + 1)
            rgb, al = HC.face_pixels(x * 16, top * 16, 16, foot=foot, endW=sw == 'end', endE=se == 'end', innerW=sw == 'inner', innerE=se == 'inner')
            fim = Image.fromarray(np.dstack([rgb.astype(np.uint8), np.where(al, 255, 0).astype(np.uint8)]), 'RGBA')
            img.alpha_composite(fim.crop((0, 0, 16, min(48, (s.H - top) * 16))), (x * 16, top * 16))
        if stage < 3: return img
        for (x, y, im) in s.decals:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        objs = list(s.objs)
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        landm = np.zeros((s.H, s.W), bool)                                # 그림자는 땅 칸에만(하늘·절벽 앞면에는 지지 않는다)
        for y in range(s.H):
            for x in range(s.W): landm[y, x] = s.is_land(x, y)
        SH &= np.kron(landm, np.ones((16, 16), bool))
        A_ = np.array(img).astype(np.float64); A_[SH, :3] = np.floor(A_[SH, :3] * np.array((0.62, 0.62, 0.72)))
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
        e = (cov < thresh) & (s.L > 0)
        for c in set(s.face) | s.dry | s.crop | s.path | s.dirt: e[c[1], c[0]] = False
        return e

    def worst(s, e):
        best = (0, 0, 0); tot = []
        for y in range(0, s.H - 15 + 1):
            for x in range(0, s.W - 20 + 1):
                r = e[y:y + 15, x:x + 20].mean(); tot.append(r)
                if r > best[0]: best = (r, x, y)
        return best, float(np.mean(tot))
