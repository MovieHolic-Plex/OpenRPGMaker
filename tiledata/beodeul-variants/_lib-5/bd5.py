# 버들항 변형(변형 5) 공용 도우미 — 필드 4곳이 함께 쓴다.
# 버들항 파이프라인(scripts/content/lib/city_v6)의 땅·절벽·길·물 그리기를 그대로 부르고, 없는 조각은 손 도트(hand_*.py)로 채운다.
import sys, os, json, math, random, colorsys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
V6 = ROOT + '/scripts/content/lib/city_v6'
sys.path.insert(0, V6)
import numpy as np
from PIL import Image, ImageDraw
import palette; palette.apply()
import terrain, terrain7, ground, water6, v6pieces, pz, px2
from px2 import _hash
from collections import deque

OBJDIR = ROOT + '/tiledata/beodeul-city/render/objects'
KITDIR = ROOT + '/tiledata/beodeul-city/kits7'
_OBJ = None
def _objs():
    global _OBJ
    if _OBJ is None: _OBJ = json.load(open(ROOT + '/tiledata/beodeul-city/render/city6_objects.json'))
    return _OBJ
def lib_sprite(name, w=None, h=None, nth=0):
    c = [o for o in _objs() if o['name'] == name and (w is None or o['w'] == w) and (h is None or o['h'] == h)]
    o = c[nth % len(c)]
    return Image.open(f"{OBJDIR}/{o['hash']}.png").convert('RGBA')
def kit(kid):
    j = json.load(open(f'{KITDIR}/{kid}.json'))
    im = Image.new('RGBA', (j['w'] * 16, j['h'] * 16))
    for suf in ('.lo.png', '.up.png'):
        p = f'{KITDIR}/{kid}{suf}'
        if os.path.exists(p): im.alpha_composite(Image.open(p).convert('RGBA'))
    return im, j

# ---- ramps (7 tones: outline + 6) ----
def hx(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
def ramp(name):
    return [hx(palette.OUT_CHIP[name])] + [hx(c) for c in palette.RAMPS_CHIP[name]]
LEAF, WOOD, STONE, MOSS, WATER, STRAW, PLASTER, RED, ROOFW, ROOFC = (ramp(n) for n in ('leaf', 'wood', 'stone', 'moss', 'water', 'straw', 'plaster', 'red', 'roofw', 'roofc'))
TREES = {'oakA': (224, 512, 4, 5), 'oakB': (288, 512, 3, 4), 'bushC': (336, 512, 2, 2), 'bushD': (368, 512, 3, 3), 'bushE': (368, 560, 2, 2)}
def _tint(im, dh, dv):
    o = im.copy(); p = o.load(); memo = {}
    for yy in range(o.height):
        for xx in range(o.width):
            r, g, b, a = p[xx, yy]
            if not a: continue
            c = memo.get((r, g, b))
            if c is None:
                h_, s_, v_ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s_ > 0.18: h_ = (h_ + dh) % 1.0
                v_ = max(0, min(1, v_ * dv)); rr, gg, bb = colorsys.hsv_to_rgb(h_, s_, v_); c = (round(rr * 255), round(gg * 255), round(bb * 255)); memo[(r, g, b)] = c
            p[xx, yy] = c + (a,)
    return o
_TV = {}
def tree_look(k, v):
    if (k, v) not in _TV:
        x, y, w, h = TREES[k]; im = terrain.CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
        if v == 1: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        elif v == 2: im = _tint(im, 0.018, 1.07)
        elif v == 3: im = _tint(im, -0.02, 0.92).transpose(Image.FLIP_LEFT_RIGHT)
        _TV[(k, v)] = im
    return _TV[(k, v)]

def trunk_check(im, base_rows=3):
    """나무 검사: 줄기 밑변 폭과 수관 폭. 반환 (밑변 폭 px, 수관 최대 폭 px, 수관이 그림 가장자리에 닿았는지)."""
    a = np.array(im)[:, :, 3] > 128
    H, W = a.shape
    rows = [a[H - 1 - i].sum() for i in range(base_rows)]
    top = a[:H - 16].sum(axis=1).max()
    touch = bool(a[:, 0].any() or a[:, -1].any() or a[0, :].any())
    return int(rows[0]), int(top), touch

class Scene:
    def __init__(s, name, W, H, seed=1):
        s.name, s.W, s.H, s.seed = name, W, H, seed
        g = lambda v: [[v] * W for _ in range(H)]
        s.lev = g(0); s.water = g(False); s.nat = g(False); s.masonry = g(False)
        s.cobble = g(False); s.track = g(False); s.flow = g('still')
        s.block = g(False); s.stairs = []; s.falls = []
        s.objs = []          # (sorty, x, y, img, shadow)
        s.ground_objs = []   # drawn flat under everything sorted (paving stones, rugs)
        s.canopies = []      # px boxes for the shade grass
        s.marks = {}         # named cells (exits, points of interest) for BFS
        s.parts = {}         # name -> (img, cells, note) new hand-pixel parts
        s.tree_used = []
        s.covermask = None
        s.extra_paving = []  # (mask, texfn, edge) other paving
        s.overlays = []      # (img, x, y) flat overlays above ground/roads below objects
        s.top_overlays = []  # above objects
        s.track_water_join = True
        s.sand = g(False)     # 맨 모래(풀 테두리 없음): 만·해변
    # ---- terrain ----
    def rect(s, g, x0, x1, y0, y1, v=True):
        for y in range(max(0, y0), min(s.H - 1, y1) + 1):
            for x in range(max(0, x0), min(s.W - 1, x1) + 1): g[y][x] = v
    def level_rect(s, x0, x1, y0, y1, v): s.rect(s.lev, x0, x1, y0, y1, v)
    def faces(s): return terrain.faces(s.lev)
    def stair_cells(s): return {(x + i, y + j) for x, y, w in s.stairs for i in range(w) for j in (0, 1, 2)}
    # ---- placing ----
    def sprite(s, im, x, y, block=(), shadow=None, sorty=None):
        """im: RGBA; (x,y) px top-left. block: cells (cx,cy) that become impassable."""
        if shadow is None: shadow = im.height >= 40
        s.objs.append(((y + im.height) if sorty is None else sorty, x, y, im, shadow))
        for c in block:
            if 0 <= c[0] < s.W and 0 <= c[1] < s.H: s.block[c[1]][c[0]] = True
    def at(s, im, cx, cy, block='bottom', dx=0, dy=0, shadow=None, sorty=None):
        """im sits with its bottom edge on the bottom of cell row cy, its left on column cx."""
        x = cx * 16 + dx; y = (cy + 1) * 16 - im.height + dy
        wc = -(-im.width // 16); hc = -(-im.height // 16)
        if block == 'bottom': bl = [(cx + i, cy) for i in range(wc)]
        elif block == 'all': bl = [(cx + i, cy - j) for i in range(wc) for j in range(hc)]
        elif block is None: bl = []
        else: bl = [(cx + i, cy + j) for i, j in block]
        s.sprite(im, x, y, bl, shadow, sorty)
    def lib(s, name, cx, cy, w=None, h=None, nth=0, block='bottom', **k):
        s.at(lib_sprite(name, w, h, nth), cx, cy, block, **k)
    def kit(s, kid, cx, cy):
        im, j = kit(kid)
        x, y = cx * 16, cy * 16
        bl = [(cx + i, cy + r) for r, row in enumerate(j['walk']) for i, ch in enumerate(row) if ch == 'X']
        s.sprite(im, x, y, bl, shadow=im.height >= 40)
        return j
    def tree(s, kind, cx, cy, look=None, top=True):
        """cx,cy = cell of the bottom-left of the tree; the two middle bottom cells are the trunk."""
        x, y, w, h = TREES[kind]
        if look is None:
            used = {(k, v) for tx, ty, k, v in s.tree_used if abs(tx - cx) <= 6 and abs(ty - cy) <= 6}
            v0 = int(_hash(cx, cy, 77 + s.seed) * 4)
            for d in range(4):
                look = (v0 + d) % 4
                if (kind, look) not in used: break
        s.tree_used.append((cx, cy, kind, look))
        im = tree_look(kind, look)
        wc = w
        if kind.startswith('oak'):
            mid = [(cx + wc // 2 - 1, cy), (cx + wc // 2, cy)] if wc % 2 == 0 else [(cx + wc // 2, cy)]
        else: mid = [(cx + i, cy) for i in range(wc)]
        s.sprite(im, cx * 16, (cy + 1) * 16 - im.height, mid, shadow=(kind.startswith('oak')))
        if kind.startswith('oak'): s.canopies.append((cx * 16, (cy + 1) * 16 - im.height, im.width, im.height))
        return im

    # ---- free-cell placing (occupancy) ----
    def _occ(s):
        if not hasattr(s, 'occ'): s.occ = set()
        return s.occ
    def reserve(s, x0, y0, x1, y1):
        o = s._occ()
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): o.add((x, y))
    def cell_free(s, x, y, lv=None, margin=0):
        """놓을 수 있는 칸인가: 안 물·안 절벽면·안 길·안 차지된 칸 (margin 칸 안쪽 길도 피함)."""
        if not (0 <= x < s.W and 0 <= y < s.H): return False
        o = s._occ(); F = getattr(s, '_F', None)
        if F is None: F = s._F = s.faces()
        if s.water[y][x] or F[y][x] or (x, y) in o or s.block[y][x]: return False
        if lv is not None and s.lev[y][x] != lv: return False
        for j in range(-margin, margin + 1):
            for i in range(-margin, margin + 1):
                xx, yy = x + i, y + j
                if 0 <= xx < s.W and 0 <= yy < s.H and (s.cobble[yy][xx] or s.track[yy][xx]): return False
        return True
    def put(s, im, cx, cy, fw=None, margin=0, block=True, shadow=None, dx=0, dy=0, occ_h=1, tag=None):
        """빈 칸 검사 후 놓기. (cx,cy)=바닥 왼쪽 칸. fw=밑변 칸 수. 성공하면 True."""
        wc = fw or -(-im.width // 16)
        lv = s.lev[cy][cx] if 0 <= cy < s.H and 0 <= cx < s.W else 0
        for j in range(occ_h):
            for i in range(wc):
                if not s.cell_free(cx + i, cy - j, lv, margin) or s.lev[cy - j][cx + i] != lv: return False
        s.at(im, cx, cy, block=('bottom' if block else None), dx=dx, dy=dy, shadow=shadow)
        if block:   # sprite block uses the sprite's own width; keep to fw
            pass
        o = s._occ()
        for j in range(occ_h):
            for i in range(wc): o.add((cx + i, cy - j))
        return True
    def put_tree(s, kind, cx, cy, look=None, margin=0):
        x, y, w, h = TREES[kind]
        lv = s.lev[cy][cx]
        for i in range(w):
            if not s.cell_free(cx + i, cy, lv, margin): return False
        s.tree(kind, cx, cy, look)
        o = s._occ()
        for i in range(w): o.add((cx + i, cy))
        return True
    def newpart(s, name, im, cells, note=''): s.parts[name] = (im, cells, note)
    # ---- BFS / grid ----
    def walk_grid(s):
        F = s.faces(); sc = s.stair_cells()
        return [[(not s.block[y][x]) and (not s.water[y][x]) and (not F[y][x] or (x, y) in sc) for x in range(s.W)] for y in range(s.H)]
    def bfs(s, start, walk=None):
        walk = walk or s.walk_grid(); sc = s.stair_cells()
        seen = {start}; q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < s.W and 0 <= ny < s.H) or (nx, ny) in seen or not walk[ny][nx]: continue
                if s.lev[ny][nx] != s.lev[y][x] and (nx, ny) not in sc and (x, y) not in sc: continue
                seen.add((nx, ny)); q.append((nx, ny))
        return seen
    def check_reach(s, start, targets):
        r = s.bfs(start); return {k: (v in r) for k, v in targets.items()}
    # ---- render ----
    def road_px(s):
        m = np.kron((np.array(s.cobble, bool) | np.array(s.track, bool)) & ~np.array(s.sand, bool), np.ones((16, 16), bool))
        return m
    def render(s, sea_beach=None, with_water=True, frame=0):
        W, H = s.W, s.H; Wp, Hp = W * 16, H * 16
        img, lab = ground.render(Wp, Hp, s.canopies, s.road_px(), s.seed)
        s.lab = lab
        F = s.faces(); sc = s.stair_cells()
        # dirt track (sand autotile) and cobble (chipset paving autotile)
        SV = terrain7.sand_variants(); RV = terrain7.road_variants()
        def on(g, x, y): return 0 <= x < W and 0 <= y < H and g[y][x]
        for y in range(H):
            for x in range(W):
                if s.track[y][x]:
                    m = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if on(s.track, x + dx, y + dy) or on(s.cobble, x + dx, y + dy) or (s.track_water_join and on(s.water, x + dx, y + dy)))
                    img.alpha_composite(SV[m], (x * 16, y * 16))
        for y in range(H):
            for x in range(W):
                if s.sand[y][x]: img.alpha_composite(SV[15], (x * 16, y * 16))
        if any(any(r) for r in s.cobble):
            joins = [[bool(s.track[y][x]) for x in range(W)] for y in range(H)]
            img.alpha_composite(terrain.paving(s.cobble, 160, 96, joins=joins))
        for mask, tex, edge, joins in s.extra_paving:
            import roman
            img.alpha_composite(roman.paving5(mask, tex, joins=joins, edge=edge))
        for im, x, y in s.overlays: img.alpha_composite(im, (x, y))
        # water: quay rim (non-natural), surface, beach, then cliffs on top
        if with_water and any(any(r) for r in s.water):
            img.alpha_composite(v6pieces.canal6(s.water, s.nat))
            WA = water6.Water(s.water, s.flow, natural=s.nat)
            s.WA = WA
            img.alpha_composite(v6pieces.beach_layer(WA.beach, WA.surf, Wp, Hp))
            img.alpha_composite(Image.fromarray(WA.frame(frame), 'RGBA'))
        tr = terrain.render(s.lev, s.masonry, s.stairs, s.falls, frame=0)
        img.alpha_composite(tr)
        # shadows (trees, tall objects) like the harbour render: multiply, offset (+6,+3)
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in s.objs:
            if sh and im.height >= 40: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SH = np.array(mask) > 0
        A = np.array(img).astype(np.float64); A[SH, :3] = np.floor(A[SH, :3] * np.array((0.52, 0.58, 0.74))); img = Image.fromarray(A.astype(np.uint8), 'RGBA')
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
            img.alpha_composite(im, (x, y)) if (x >= 0 and y >= 0) else img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        for im, x, y in s.top_overlays: img.alpha_composite(im, (x, y))
        s.img = img
        return img
    def coverage(s):
        """cell coverage by sprites (alpha fraction), for the density check."""
        cov = np.zeros((s.H, s.W))
        for sy, x, y, im, sh in s.objs:
            a = np.array(im)[:, :, 3] > 128
            for j in range(a.shape[0]):
                pass
            full = np.zeros((s.H * 16, s.W * 16), bool)
            x0, y0 = max(0, x), max(0, y); x1, y1 = min(s.W * 16, x + im.width), min(s.H * 16, y + im.height)
            if x1 > x0 and y1 > y0: full[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
            cov = np.maximum(cov, full.reshape(s.H, 16, s.W, 16).mean(axis=(1, 3)))
        return cov
    def density(s, wx=20, wy=15, step=4, thresh=0.25):
        """빈 바닥 비율. 빈 칸 = 물체 덮임 <thresh, 길·물·절벽면·계단 아님. 반환 (최대 비율, 그 창의 왼쪽 위 칸, 전체 빈칸 비율)"""
        cov = s.coverage(); F = s.faces(); sc = s.stair_cells()
        empty = np.zeros((s.H, s.W), bool)
        for y in range(s.H):
            for x in range(s.W):
                empty[y][x] = cov[y][x] < thresh and not (s.cobble[y][x] or s.track[y][x] or s.water[y][x] or F[y][x] or (x, y) in sc or (x, y) in getattr(s, 'fill', ()))
        best = (0, (0, 0))
        for y0 in range(0, max(1, s.H - wy + 1), step):
            for x0 in range(0, max(1, s.W - wx + 1), step):
                r = empty[y0:y0 + wy, x0:x0 + wx].mean()
                if r > best[0]: best = (r, (x0, y0))
        s.empty = empty
        return best[0], best[1], empty.mean()
    def save(s, outdir, extra_grid=None):
        os.makedirs(outdir + '/parts', exist_ok=True)
        s.img.save(outdir + '/render-1x.png')
        s.img.resize((s.img.width * 2, s.img.height * 2), Image.NEAREST).save(outdir + '/render-2x.png')
        wg = s.walk_grid()
        grid = {'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(s.W)) for y in range(s.H)],
                'legend': {'.': 'walkable', '#': 'blocked'}, 'marks': {k: list(v) for k, v in s.marks.items()},
                'stairs': [list(t) for t in s.stairs], 'levels': [''.join(str(s.lev[y][x]) for x in range(s.W)) for y in range(s.H)]}
        if extra_grid: grid.update(extra_grid)
        json.dump(grid, open(outdir + '/grid.json', 'w'), ensure_ascii=False)
        lines = ['# 새로 찍은 조각 (손 도트, 버들항 팔레트)\n']
        n = 0
        for name, (im, cells, note) in s.parts.items():
            im.save(f'{outdir}/parts/{name}.png'); n += 1
            lines.append(f'- `{name}.png` — {im.width}x{im.height}px ({cells}). {note}')
        lines.append(f'\n합계: {n}종')
        open(outdir + '/parts.md', 'w').write('\n'.join(lines) + '\n')
        return n

def grid_from_strings(rows):
    return [[ch != '.' for ch in r] for r in rows]

def noise_edge(seed, n, base, amp, sc=6):
    """1-D wandering edge: list of n ints, base +- amp, smooth."""
    r = random.Random(seed); v = [r.random() for _ in range(n // sc + 3)]
    out = []
    for i in range(n):
        a = v[i // sc]; b = v[i // sc + 1]; t = (i % sc) / sc; t = t * t * (3 - 2 * t)
        out.append(int(round(base + amp * ((a * (1 - t) + b * t) * 2 - 1))))
    return out

# ---- 자연 덩어리 도우미 ----
def value_noise(seed, W, H, sc=7):
    """0..1 부드러운 2-D 값 잡음 (덩어리 밀도용)."""
    r = random.Random(seed); gw, gh = W // sc + 3, H // sc + 3
    g = [[r.random() for _ in range(gw)] for _ in range(gh)]
    out = [[0.0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            fx, fy = x / sc, y / sc; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
            tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
            a = g[iy][ix] * (1 - tx) + g[iy][ix + 1] * tx; b = g[iy + 1][ix] * (1 - tx) + g[iy + 1][ix + 1] * tx
            out[y][x] = a * (1 - ty) + b * ty
    return out

def cluster(s, rng, cx, cy, rx, ry, n, makers, margin=0, tries=14):
    """타원 안에 n 개를 흩어 놓는다. makers = [callable(s, x, y)->bool ...] (가중치 없이 돌려 씀). 놓은 수 반환."""
    placed = 0
    for i in range(n * tries):
        if placed >= n: break
        a = rng.random() * 6.2832; d = math.sqrt(rng.random())
        x = int(round(cx + math.cos(a) * rx * d)); y = int(round(cy + math.sin(a) * ry * d))
        if not (0 <= x < s.W and 1 <= y < s.H): continue
        if rng.choice(makers)(s, x, y): placed += 1
    return placed
