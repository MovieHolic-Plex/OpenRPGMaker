# PAW (ドット絵世界) 맵 공용 엔진. 그림은 재배포 금지 — 렌더 PNG 는 저장소 밖(~/claude-viz/paw-maps)에만 쓴다.
"""Usage in a map file (scripts/content/paw-maps/mNN_slug.py):
    from pawlib import *
    m = Map('m01_slug', 'Title (Korean)', 40, 30)
    m.fill(0, 0, 40, 30, auto('SA-GrassE01.png'))        # XP autotile region (lower layer, auto-joined)
    m.fill(2, 2, 10, 1, tile('ST-Town-E01.png', 17))      # single tile repeated
    m.recipe('ST-RTown-E01.png', 'retro-shop-front', 5, 4) # a catalogued recipe by id (catalog.json)
    m.rect('ST-Town-E01.png', sx, sy, w, h, x, y)         # raw source rect in TILES from a sheet (upper layer)
    m.chip('sakura2.png', x, y)                           # whole chip sheet (by-source/sozai/chips) placed at x,y
    m.save()
Layers: 'lo' ground (drawn first, all cells), 'up' objects. fill()/auto() default lo; rect/recipe/chip default up.
"""
import os, json, glob
from PIL import Image
SRC = '/home/main/.local/share/oprn/pixel-art-world-downloads'
OUT = '/home/main/claude-viz/paw-maps'
HERE = os.path.dirname(os.path.abspath(__file__))
_path = {}
for _p in glob.glob(SRC + '/**/*.png', recursive=True):
    _path.setdefault(os.path.basename(_p), _p)          # first hit wins (root copies before nested duplicates)
for _p in sorted(glob.glob(SRC + '/*.png')): _path[os.path.basename(_p)] = _p
_img = {}
def sheet(name):
    if name not in _img:
        if name not in _path: raise KeyError(f'unknown sheet {name!r} (see catalog.json "sheets")')
        _img[name] = Image.open(_path[name]).convert('RGBA')
    return _img[name]
CATALOG = json.load(open(os.path.join(HERE, 'catalog.json'))) if os.path.exists(os.path.join(HERE, 'catalog.json')) else {}

def _norm(m):
    r = m & 15
    for d, i in ((16, 3), (32, 6), (64, 12), (128, 9)):
        if (m & i) == i and m & d: r |= d
    return r
def _xp_piece(s, mask, frame=0):
    o = Image.new('RGBA', (32, 32)); m = _norm(mask); ox = frame * 96
    for q in range(4):
        right, bottom = q % 2, q // 2; dx, dy = right * 16, bottom * 16
        if m == 0: sx, sy = dx, dy
        else:
            v = m & (4 if bottom else 1); h = m & (2 if right else 8)
            dg = m & ((32 if right else 64) if bottom else (16 if right else 128))
            if v and h and not dg: sx, sy = 64 + dx, dy
            else: sx = 32 + dx if h else (80 if right else 0); sy = 64 + dy if v else (112 if bottom else 32)
        o.alpha_composite(s.crop((ox + sx, sy, ox + sx + 16, sy + 16)), (dx, dy))
    return o

class tile:
    """one 32px cell of a sheet, by index t (row-major) or (col,row)"""
    def __init__(self, name, t, row=None):
        self.name = name; s = sheet(name); cols = s.width // 32
        self.cx, self.cy = (t, row) if row is not None else (t % cols, t // cols)
    def image(self, *_): s = sheet(self.name); return s.crop((self.cx * 32, self.cy * 32, self.cx * 32 + 32, self.cy * 32 + 32))
class auto:
    """XP autotile (96x128, or 384x128 animated: frame 0). Cells of the same auto() in one layer join."""
    def __init__(self, name): self.name = name; sheet(name)
    def image(self, mask): return _xp_piece(sheet(self.name), mask)

class Map:
    def __init__(self, mid, title, w, h, kind='exterior', note=''):
        self.id, self.title, self.w, self.h, self.kind, self.note = mid, title, w, h, kind, note
        self.lo = [[None] * w for _ in range(h)]
        self.up = [[[] for _ in range(w)] for _ in range(h)]
        self.over = []          # (x_px, y_px, Image) free-positioned whole images (chips, recipes), drawn after up
        self.used = set()
        self.cls = None         # interior only: per-cell 'C' ceiling / 'W' wall face / 'F' floor / 'D' doorway, set by layout()
    def layout(self, rows, legend, ceil, walls):
        """Interior floor plan. rows: one string per map row; '#' = ceiling (void/roof mass), 'D' = doorway floor
        (splits rooms for the shape check), any other char -> legend[char] floor ref (or f(x, y) -> ref).
        Wall faces are generated, never drawn by hand: under EVERY ceiling cell whose south cell is open, the
        wall rows `walls` (list of refs, top->bottom, or f(x, y) -> list) go down until the next ceiling cell.
        ceil: ref or f(x, y) -> ref. Rooms should not be plain rectangles: notch corners, add alcoves, L-shapes."""
        assert len(rows) == self.h and all(len(r) == self.w for r in rows), ('layout size', self.id)
        self.cls = [['C' if c == '#' else ('D' if c == 'D' else 'F') for c in r] for r in rows]
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                v = ceil if c == '#' else legend[c if c in legend else '.']   # 'D' falls back to legend['.']
                self.cells([(x, y)], v(x, y) if callable(v) else v)
        for x in range(self.w):
            for y in range(1, self.h):
                if self.cls[y][x] != 'C' and self.cls[y - 1][x] == 'C':
                    ws = walls(x, y) if callable(walls) else walls
                    for k, wt in enumerate(ws):
                        if y + k >= self.h or self.cls[y + k][x] == 'C': break
                        self.cells([(x, y + k)], wt); self.cls[y + k][x] = 'W'
        return self
    def lint(self):
        """Structural rules (see README): returns a list of violation strings; save() raises if any."""
        v = []
        if self.kind != 'interior': return v
        if self.cls is None: return ['L1 interior map without Map.layout()']
        c = self.cls
        for y in range(1, self.h):
            for x in range(self.w):
                if c[y - 1][x] == 'C' and c[y][x] in 'FD': v.append(f'L2 floor under ceiling at {x},{y}')
        seen, rooms = set(), []
        for y in range(self.h):
            for x in range(self.w):
                if c[y][x] in 'FW' and (x, y) not in seen:
                    st, comp = [(x, y)], []; seen.add((x, y))
                    while st:
                        a, b = st.pop(); comp.append((a, b))
                        for q in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                            if self._ok(*q) and q not in seen and c[q[1]][q[0]] in 'FW': seen.add(q); st.append(q)
                    rooms.append(comp)
        def rect(comp):
            xs = [p[0] for p in comp]; ys = [p[1] for p in comp]
            return len(comp) == (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1)
        big = [r for r in rooms if len(r) >= 12]
        if big and all(rect(r) for r in big): v.append(f'L3 every room is a plain rectangle ({len(big)} rooms)')
        for px, py, im in self.over:
            a = im.getchannel('A')
            for cy in range(py // 32, (py + im.height - 1) // 32 + 1):
                for cx in range(px // 32, (px + im.width - 1) // 32 + 1):
                    if not self._ok(cx, cy) or c[cy][cx] != 'C': continue
                    box = (max(0, cx * 32 - px), max(0, cy * 32 - py), min(im.width, cx * 32 + 32 - px), min(im.height, cy * 32 + 32 - py))
                    n = sum(1 for p in a.crop(box).getdata() if p > 128)
                    if n > 160: v.append(f'L4 object drawn over ceiling at {cx},{cy}')
        return v
    def _ok(self, x, y): return 0 <= x < self.w and 0 <= y < self.h
    def fill(self, x, y, w, h, ref, layer='lo'):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if not self._ok(xx, yy): continue
                if layer == 'lo': self.lo[yy][xx] = ref
                else: self.up[yy][xx].append(ref)
        self.used.add(ref.name)
    def cells(self, cells, ref, layer='lo'):
        for xx, yy in cells:
            if self._ok(xx, yy):
                if layer == 'lo': self.lo[yy][xx] = ref
                else: self.up[yy][xx].append(ref)
        self.used.add(ref.name)
    def put(self, x, y, ref): self.fill(x, y, 1, 1, ref, 'up')
    def rect(self, name, sx, sy, w, h, x, y):
        """copy a w x h TILE block from sheet `name` starting at tile (sx,sy) to map cell (x,y), upper layer"""
        s = sheet(name); self.over.append((x * 32, y * 32, s.crop((sx * 32, sy * 32, (sx + w) * 32, (sy + h) * 32)))); self.used.add(name)
    def recipe(self, name, rid, x, y):
        r = CATALOG.get('recipes', {}).get(name, {}).get(rid)
        if r is None: raise KeyError(f'no recipe {rid!r} for {name!r}')
        q = r['rect']; self.rect(name, q['x'], q['y'], q['width'], q['height'], x, y)
    def chip(self, name, x, y, sx=0, sy=0, w=None, h=None):
        s = sheet(name); w = w or s.width // 32; h = h or s.height // 32
        self.rect(name, sx, sy, w, h, x, y)
    def image(self, name, x, y, box=None):
        """paste an arbitrary image region (pixels) from sheet at cell x,y — for odd-sized sheets (doors, charas 32x48 etc.)"""
        s = sheet(name); im = s.crop(box) if box else s; self.over.append((x * 32, y * 32, im)); self.used.add(name)
    def render(self):
        out = Image.new('RGBA', (self.w * 32, self.h * 32), (0, 0, 0, 255))
        def same(a, b): return a is not None and b is not None and type(a) is type(b) and a.name == b.name and getattr(a, 'cx', None) == getattr(b, 'cx', None) and getattr(a, 'cy', None) == getattr(b, 'cy', None)
        for y in range(self.h):
            for x in range(self.w):
                r = self.lo[y][x]
                if r is None: continue
                if isinstance(r, auto):
                    m = 0
                    for dx, dy, b in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8), (1, -1, 16), (1, 1, 32), (-1, 1, 64), (-1, -1, 128)):
                        xx, yy = x + dx, y + dy
                        if not self._ok(xx, yy) or same(self.lo[yy][xx], r): m |= b
                    out.alpha_composite(r.image(m), (x * 32, y * 32))
                else: out.alpha_composite(r.image(), (x * 32, y * 32))
        for y in range(self.h):
            for x in range(self.w):
                for r in self.up[y][x]:
                    if isinstance(r, auto):
                        m = 0
                        for dx, dy, b in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8), (1, -1, 16), (1, 1, 32), (-1, 1, 64), (-1, -1, 128)):
                            xx, yy = x + dx, y + dy
                            if not self._ok(xx, yy) or any(same(q, r) for q in self.up[yy][xx]): m |= b
                        out.alpha_composite(r.image(m), (x * 32, y * 32))
                    else: out.alpha_composite(r.image(), (x * 32, y * 32))
        for px, py, im in self.over: out.alpha_composite(im, (px, py))
        return out
    def save(self):
        bad = self.lint()
        if bad: raise AssertionError(f'{self.id} lint: ' + '; '.join(bad[:12]) + (f' (+{len(bad) - 12} more)' if len(bad) > 12 else ''))
        os.makedirs(OUT, exist_ok=True)
        self.render().convert('RGB').save(f'{OUT}/{self.id}.png')
        meta = {'id': self.id, 'title': self.title, 'w': self.w, 'h': self.h, 'kind': self.kind, 'note': self.note, 'sheets': sorted(self.used)}
        json.dump(meta, open(f'{OUT}/{self.id}.json', 'w'), ensure_ascii=False)
        print('saved', self.id, self.w, self.h, len(self.used), 'sheets')
