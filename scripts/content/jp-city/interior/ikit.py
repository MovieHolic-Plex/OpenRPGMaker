#!/usr/bin/env python3
"""jp_city 일본 실내 키트 틀 — 블록 `blocks/interior_*.py` 가 이 등록기로 바닥·벽면·천장·가구·탁자·탁상 물건을 그린다.

구조 규칙은 손 도트 실내 v5(`src/editor/handInterior/builder.ts`, `tiledata/hand-interior/v5/room2.py`)와 같다:
  평면 '#' = 막힘. 막힌 칸 바로 아래 두 줄 = 벽면(못 걸음), 나머지 실내 = 바닥. 막힌 칸 중 실내에 8방으로 닿는 칸 = 천장 띠, 나머지 = 공허.
이 파일이 정하는 것(작업자는 그림만 그린다):
  · 바닥 = 짜임 주기 cols×rows 칸 그림 한 장 → 그림자 4변형(0 없음 · 1 벽면 밑 접촉 그림자 · 2 서쪽 덩어리 그림자 · 3 둘 다)을 **램프 단 내리기**로 만든다.
    칸 번호 = ((y%rows)*cols + x%cols)*4 + 그림자.
  · 벽면 = 2줄(32px) × cols 칸 그림 한 장 → 윗줄 위 4행 천장 밑 그늘 + 서쪽 그림자 변형. 번호 = ((줄-1)*cols + x%cols)*2 + 서쪽.
  · 천장 = 칸 하나를 비트(1 남쪽 안 · 2 북쪽 안 · 4 서쪽 안 · 8 동쪽 안 · 16 북쪽 공허)마다 32변형.
  · 가구 = 그림 폭 w*16, 높이 (U+h)*16 (U = ceil(up/16), 위 U 줄이 솟은 부분). 발밑 h 줄이 footprint.
    kind floor(바닥) · wall(북쪽 벽면 바로 아래 첫 바닥 줄, 위로 벽면을 덮어 솟는다) · hang(벽면 윗줄 y 에 거는 것, 그림 높이 hrows 줄) · flat(밟는 바닥 무늬, 2층)
         · door(가로 칸막이의 1칸 틈에 다는 열린 문 — 그림은 16×32 = 틈 아래 벽면 두 줄 높이의 문틀·문짝. 틈 칸 자체에는 이 파일이 천장 띠(인방)를 덧붙인다.
           통행: 인방·윗줄 ★(캐릭터 위로 그려지고 지나간다) · 아랫줄 flat(2층). 좌표 x,y = 평면의 틈 칸)
         · sidedoor(세로 칸막이의 3줄 틈에 다는 열린 문 — 좌표 x,y = 틈의 통로 칸(셋째 줄). 그림 16×48 = 위 두 줄은 칸막이 끝 벽면 위 ★, 셋째 줄은 통로 칸 2층).
    칸 통행: footprint 는 solid(막힘)이 기본, walk 로 준 칸은 flat(밟음·2층), 솟은 칸·걸이 = star(★ 지나감).
  · 탁자 = draw(c, w, h) 로 3×3·1×3·3×1·1×1 을 그려 L/M/R/S × T/M/B/S 조각 16개로 자른다.
  · 탁상 물건 = 16×16, 윗면 있는 가구 칸 위(4층).
팔레트는 modern3 램프(`K(램프, 단)`)만. 반투명 금지. 빛 왼쪽 위. 윤곽 sumi/재질 어두운 단.

블록에서:
    from ikit import Registry, K, Cv, OL
    R = Registry('interior_home', '집 실내')
    @R.floor('tatami', '다다미', cols=4, rows=4, tags=(...), desc='...')
    def _(c): ...                     # c = Cv(cols*16, rows*16), 세계 좌표 그대로(칸마다 반복되면 안 된다)
    @R.obj('kotatsu', '고타쓰', w=2, h=1, up=6, kind='floor', cat='washitsu', ...)
    def _(c): ...                     # c = Cv(w*16, (U+h)*16)
    def build(): return R.build()
    def selftest(): return R.selftest()
"""
import collections, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
JP = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(JP, '..', '..', '..'))
for p in (JP, os.path.join(JP, 'houses'), os.path.join(ROOT, 'scripts', 'content', 'atlas-pick')):
    if p not in sys.path: sys.path.insert(0, p)
import numpy as np                                             # noqa: E402
from PIL import Image                                          # noqa: E402
from modern_style_bible_proof import K, Cv, RAMPS              # noqa: E402

OL = K('sumi', -1)
TOP_SHADE = (-2, -2, -1, -1)            # 벽면 윗줄 위 4행(천장 띠 밑 그늘) — room2.py 0.62~0.86 배
FOOT_SHADE = (-2, -1, -1)               # 벽면 밑 바닥 접촉 그림자 3행 — 0.6~0.84 배
WEST_SHADE = (-2, -2, -1, -1, -1, 0)    # 서쪽 덩어리 그림자 6열 — 0.62~0.92 배
VOID_RGB = None
# 쓰임 id — src/editor/handInterior/parts.ts USE_WORDS 와 같다(조수 도구가 이 낱말로 찾고 설명한다).
USE_IDS = ('sit', 'sleep', 'open', 'search', 'read', 'counter', 'travel', 'light', 'save', 'heal', 'switch', 'push', 'trap', 'key', 'gate', 'seal', 'walk', 'block')


def _hx(c): return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


# 색 → (램프, 단 위치) 역표: 그림자는 같은 램프의 낮은 단으로 내린다(팔레트 밖 색을 만들지 않는다).
_INV = {}
for _name, _r in RAMPS.items():
    for _i, _c in enumerate(_r):
        _INV.setdefault(_hx(_c), (_name, _i))
PALETTE = set(_INV)


def step_down(rgb, n):
    """같은 램프에서 n 단 어둡게(n<0). 램프 밖 색은 그대로."""
    hit = _INV.get(tuple(int(v) for v in rgb[:3]))
    if not hit or n == 0: return tuple(int(v) for v in rgb[:3])
    name, i = hit
    return _hx(RAMPS[name][max(0, i + n)])


def shade_rows(a, rows):
    """a: HxWx4 배열. rows[k] = k 번째 행을 내릴 단."""
    out = a.copy()
    for y, n in enumerate(rows):
        if y >= out.shape[0] or not n: continue
        for x in range(out.shape[1]):
            if out[y, x, 3]: out[y, x, :3] = step_down(out[y, x], n)
    return out


def shade_cols(a, cols):
    out = a.copy()
    for x, n in enumerate(cols):
        if x >= out.shape[1] or not n: continue
        for y in range(out.shape[0]):
            if out[y, x, 3]: out[y, x, :3] = step_down(out[y, x], n)
    return out


def blit(dst, src, x, y):
    """dst/src: HxWx4 배열, 불투명 화소만 덮는다."""
    h, w = src.shape[:2]
    for j in range(h):
        for i in range(w):
            if src[j, i, 3] and 0 <= y + j < dst.shape[0] and 0 <= x + i < dst.shape[1]: dst[y + j, x + i] = src[j, i]


def default_ceiling(c, bits):
    """천장 띠 한 칸(손 도트 v5 room2 와 같은 짜임, modern3 색): 어두운 바둑 뚜껑 + 실내 쪽 밝은 테두리, 북쪽 공허 쪽 어두운 끝."""
    S, N, Wb, E, NV = bits & 1, bits & 2, bits & 4, bits & 8, bits & 16
    for y in range(16):
        for x in range(16):
            col = K('yoru', -3) if (x + y) % 2 else K('sumi', 1)
            if S and y >= 12: col = (K('conc', 2), K('conc', 1), K('conc', -1), K('sumi', 0))[y - 12]
            if N and y <= 1: col = (K('sumi', -1), K('conc', -1))[y]
            if Wb and x <= 2: col = (K('sumi', -1), K('conc', 1), K('conc', 0))[x]
            if E and x >= 13: col = (K('conc', 0), K('conc', -1), K('sumi', -1))[x - 13]
            if NV and y == 0: col = K('sumi', -1)
            c.P(x, y, col)


class Registry:
    def __init__(self, block, name):
        self.block, self.name = block, name
        self.floors, self.walls, self.ceils, self.objs, self.tables, self.goods = {}, {}, {}, {}, {}, {}
        self.void = False
        self._built = None

    # ── 등록 ──
    def floor(self, id_, ko, cols=4, rows=4, tags=(), desc=''):
        def deco(fn): self.floors[id_] = dict(ko=ko, cols=cols, rows=rows, draw=fn, tags=list(tags), desc=desc); return fn
        return deco

    def wall(self, id_, ko, cols=4, tags=(), desc=''):
        def deco(fn): self.walls[id_] = dict(ko=ko, cols=cols, draw=fn, tags=list(tags), desc=desc); return fn
        return deco

    def ceiling(self, id_, ko, desc=''):
        def deco(fn): self.ceils[id_] = dict(ko=ko, draw=fn, desc=desc); return fn
        return deco

    def obj(self, id_, ko, w=1, h=1, up=0, kind='floor', cat='home', cat_ko='집', walk=(), solid=None, surface=False,
            stairs=None, use=(), facing=None, desc='', tags=(), place='', pair=(), states=None, hrows=2):
        """up = 발밑 위로 솟는 px(0~48). hang 은 h 를 쓰지 않고 그림 높이 hrows 줄(벽면 윗줄부터)."""
        assert kind in ('floor', 'wall', 'hang', 'flat', 'door', 'sidedoor'), kind
        assert kind not in ('door', 'sidedoor') or (w == 1 and up == 0), ('문은 폭 1칸·up 0 — 그림 16×32(door)·16×48(sidedoor)', id_)
        def deco(fn):
            self.objs[id_] = dict(ko=ko, w=w, h=(0 if kind in ('hang', 'door', 'sidedoor') else h), up=up, kind=kind, cat=cat, cat_ko=cat_ko, walk=[tuple(p) for p in walk],
                                  solid=None if solid is None else [tuple(p) for p in solid], surface=surface, stairs=stairs, use=list(use),
                                  facing=facing, desc=desc, tags=list(tags), place=place, pair=list(pair), states=states, hrows=hrows, draw=fn)
            return fn
        return deco

    def table(self, id_, ko, one_row=False, desc='', tags=()):
        def deco(fn): self.tables[id_] = dict(ko=ko, oneRow=one_row, draw=fn, desc=desc, tags=list(tags)); return fn
        return deco

    def good(self, id_, ko, desc=''):
        def deco(fn): self.goods[id_] = dict(ko=ko, draw=fn, desc=desc); return fn
        return deco

    def add_void(self): self.void = True

    # ── 그리기 ──
    @staticmethod
    def _canvas(fn, w, h, *args):
        c = Cv(w, h); fn(c, *args); return c.a.copy()

    def obj_image(self, id_):
        o = self.objs[id_]
        U = math.ceil(o['up'] / 16)
        rows = 2 if o['kind'] == 'door' else 3 if o['kind'] == 'sidedoor' else o['hrows'] if o['kind'] == 'hang' else U + o['h']
        return self._canvas(o['draw'], o['w'] * 16, rows * 16), U

    def floor_cell(self, id_, x, y, sh):
        f = self.floors[id_]
        a = self._period(('f', id_), f['draw'], f['cols'] * 16, f['rows'] * 16)
        t = a[(y % f['rows']) * 16:(y % f['rows']) * 16 + 16, (x % f['cols']) * 16:(x % f['cols']) * 16 + 16].copy()
        if sh & 1: t = shade_rows(t, FOOT_SHADE)
        if sh & 2: t = shade_cols(t, WEST_SHADE)
        return t

    def wall_cell(self, id_, x, row, west):
        wd = self.walls[id_]
        a = self._period(('w', id_), wd['draw'], wd['cols'] * 16, 32)
        a = shade_rows(a, TOP_SHADE)
        t = a[(row - 1) * 16:(row - 1) * 16 + 16, (x % wd['cols']) * 16:(x % wd['cols']) * 16 + 16].copy()
        if west: t = shade_cols(t, WEST_SHADE)
        return t

    def ceil_cell(self, id_, bits):
        return self._canvas(self.ceils[id_]['draw'], 16, 16, bits)

    _pcache = {}

    def _period(self, key, fn, w, h):
        k = (self.block,) + key
        if k not in Registry._pcache: Registry._pcache[k] = self._canvas(fn, w, h)
        return Registry._pcache[k]

    # ── 굽기 계약(CONTRACT.md) ──
    def build(self):
        if self._built: return self._built
        cells = collections.OrderedDict(); seen = {}; kits = []; groups = []
        interior = dict(floors={}, walls={}, ceilings={}, objects={}, tables={}, goods={}, void=None)

        def add(local, arr, pc, label, desc='', tags=()):
            key = (arr.tobytes(), pc)
            if key in seen: return seen[key]
            cells[local] = dict(img=Image.fromarray(arr.copy(), 'RGBA'), pc=pc, label=label, desc=desc or label, tags=list(tags))
            seen[key] = local
            return local

        if self.void:
            v = np.zeros((16, 16, 4), np.uint8); v[:, :, :3] = _hx(K('sumi', -1)); v[:, :, 3] = 255
            interior['void'] = add('void', v, 'solidfloor', '실내 공허(벽 속·건물 밖)', '막힘. 실내 맵의 건물 밖·두꺼운 벽 속.')
        for id_, f in self.floors.items():
            loc = []
            for y in range(f['rows']):
                for x in range(f['cols']):
                    for sh in range(4):
                        loc.append(add('floor.%s.%d.%d.%d' % (id_, x, y, sh), self.floor_cell(id_, x, y, sh), 'floor',
                                       '%s 바닥%s' % (f['ko'], ('', ' · 벽 밑 그늘', ' · 서쪽 그늘', ' · 벽 밑·서쪽 그늘')[sh]), f['desc'], f['tags']))
            interior['floors'][id_] = dict(ko=f['ko'], cols=f['cols'], rows=f['rows'], tiles=loc)
            groups.append(dict(id='jp:interior-floor-%s' % id_, name='실내 바닥 · %s' % f['ko'], role='terrain', defaultLayer='lower',
                               cells=sorted(set(loc), key=loc.index), desc=f['desc'] or f['ko'], rules='실내 바닥. 손 도트 실내 조립 도구(build_hand_interior_room, tileset jp_city)가 벽 밑·서쪽 그늘 변형까지 고른다.'))
        for id_, wd in self.walls.items():
            loc = []
            for row in (1, 2):
                for x in range(wd['cols']):
                    for west in (0, 1):
                        loc.append(add('wall.%s.%d.%d.%d' % (id_, row, x, west), self.wall_cell(id_, x, row, west), 'solidfloor',
                                       '%s 벽면 %s줄%s' % (wd['ko'], '윗' if row == 1 else '아랫', ' · 서쪽 그늘' if west else ''), wd['desc'], wd['tags']))
            interior['walls'][id_] = dict(ko=wd['ko'], cols=wd['cols'], tiles=loc)
            groups.append(dict(id='jp:interior-wall-%s' % id_, name='실내 벽면 · %s' % wd['ko'], role='wall', defaultLayer='lower',
                               cells=sorted(set(loc), key=loc.index), desc=wd['desc'] or wd['ko'], rules='막힌 칸 바로 아래 두 줄(벽면). 조립 도구가 자동으로 깐다.'))
        for id_, cd in self.ceils.items():
            loc = [add('ceil.%s.%d' % (id_, b), self.ceil_cell(id_, b), 'solidfloor', '%s 천장 띠 %d' % (cd['ko'], b), cd['desc']) for b in range(32)]
            interior['ceilings'][id_] = loc
            groups.append(dict(id='jp:interior-ceiling-%s' % id_, name='실내 천장 띠 · %s' % cd['ko'], role='wall', defaultLayer='lower',
                               cells=sorted(set(loc), key=loc.index), desc=cd['desc'] or cd['ko'], rules='실내에 닿는 막힌 칸. 조립 도구가 자동으로 깐다.'))
        for id_, o in self.objs.items():
            arr, U = self.obj_image(id_)
            R_, C_ = arr.shape[0] // 16, arr.shape[1] // 16
            spec_cells, grid, base = [], [[None] * C_ for _ in range(R_)], None
            if o['kind'] == 'door':
                # 틈 칸 = 인방(천장 띠가 문 위로 이어진다, 남·북 양쪽이 실내인 띠 = 비트 1|2). 지나가는 ★.
                lin = add('obj.%s.lintel' % id_, self._canvas(default_ceiling, 16, 16, 3), 'star', '%s 인방' % o['ko'], o['desc'], o['tags'])
                spec_cells.append([0, 0, lin, 3]); grid.insert(0, [lin])
            for ry in range(R_):
                for cx in range(C_):
                    t = arr[ry * 16:ry * 16 + 16, cx * 16:cx * 16 + 16]
                    if not t[:, :, 3].max(): continue
                    dy = ry if o['kind'] == 'hang' else ry + 1 if o['kind'] == 'door' else ry - 2 if o['kind'] == 'sidedoor' else ry - U
                    if o['kind'] == 'door': pc, layer = ('star', 3) if ry == 0 else ('flat', 2)
                    elif o['kind'] == 'sidedoor': pc, layer = ('star', 3) if ry < 2 else ('flat', 2)
                    elif o['kind'] == 'flat' or (dy >= 0 and o['kind'] != 'hang' and (cx, dy) in o['walk']): pc, layer = 'flat', 2
                    elif o['kind'] == 'hang' or dy < 0: pc, layer = 'star', 3
                    elif o['solid'] is None or (cx, dy) in o['solid']: pc, layer = 'solid', 3
                    else: pc, layer = 'star', 3
                    local = add('obj.%s.%d.%d' % (id_, cx, ry), t, pc, '%s %d,%d' % (o['ko'], cx, ry), o['desc'], o['tags'])
                    grid[ry + (1 if o['kind'] == 'door' else 0)][cx] = local
                    spec_cells.append([cx, dy, local, layer])
            meta = {k: o[k] for k in ('ko', 'w', 'h', 'up', 'kind', 'surface', 'stairs', 'use', 'facing', 'desc', 'tags', 'place', 'pair', 'states') if o[k] not in (None, [], '')}
            meta.update(category=o['cat'], category_ko=o['cat_ko'], cells=spec_cells, w=o['w'], h=o['h'], up=o['up'])
            interior['objects'][id_] = meta
            snap = {'wall': 'wall-north', 'hang': 'wall-north', 'door': 'wall-north', 'sidedoor': 'floor'}.get(o['kind'], 'floor')
            ai = dict(snap=snap, tags=o['tags'], description=o['desc'] or o['ko'], placementRules=o['place'] or '', repeatability='fixed', growthAxis=None,
                      anchor=dict(dx=0, dy=len(grid) - 1), access=[], role="prop")
            kits.append(dict(id='jp-in-%s' % id_, name=o['ko'], grid=grid, parts=[], ai=ai))
        for id_, td in self.tables.items():
            pieces = {}
            for (w, h, cs, rs) in ((3, 3, 'LMR', 'TMB'), (1, 3, 'S', 'TMB'), (3, 1, 'LMR', 'S'), (1, 1, 'S', 'S')):
                if td['oneRow'] and h > 1: continue
                a = self._canvas(td['draw'], w * 16, h * 16, w, h)
                for j, rc in enumerate(rs):
                    for i, cc in enumerate(cs):
                        t = a[j * 16:j * 16 + 16, i * 16:i * 16 + 16]
                        pieces[cc + rc] = [[0, 0, add('table.%s.%s%s' % (id_, cc, rc), t, 'solid', '%s 조각 %s%s' % (td['ko'], cc, rc), td['desc'], td['tags']), 3]]
            interior['tables'][id_] = dict(ko=td['ko'], up=0, oneRow=td['oneRow'], pieces=pieces)
        for id_, gd in self.goods.items():
            interior['goods'][id_] = add('goods.%s' % id_, self._canvas(gd['draw'], 16, 16), 'star', '%s(탁상)' % gd['ko'], gd['desc'] or gd['ko'])
        self._built = dict(cells=cells, autotiles=[], groups=groups, kits=kits, interior=interior,
                           notes='%s — 일본 실내(손 도트 실내 조립 규칙, tileset jp_city). 바닥 %d · 벽면 %d · 천장 %d · 가구 %d · 탁자 %d · 탁상 %d'
                           % (self.name, len(self.floors), len(self.walls), len(self.ceils), len(self.objs), len(self.tables), len(self.goods)))
        return self._built

    def selftest(self):
        """칸 16×16 RGBA · 색 ⊂ modern3 · 알파 0/255 · 가구 크기(그림 = 칸 격자) · 바닥 이음새 없음(주기 그림이 칸마다 반복되지 않는다는 뜻이 아니라, 주기를 3×3 으로 이으면 경계가 이어진다)."""
        b = self.build(); bad = []
        for local, c in b['cells'].items():
            a = np.array(c['img'])
            if a.shape != (16, 16, 4): bad.append('%s 크기 %s' % (local, a.shape)); continue
            al = set(np.unique(a[:, :, 3]).tolist())
            if not al <= {0, 255}: bad.append('%s 반투명 %s' % (local, sorted(al)))
            cols = {tuple(p) for p in a[a[:, :, 3] == 255][:, :3].tolist()}
            off = [c_ for c_ in cols if c_ not in PALETTE]
            if off: bad.append('%s 팔레트 밖 %d색 %s' % (local, len(off), off[:3]))
        for id_, o in self.objs.items():
            arr, U = self.obj_image(id_)
            if o['kind'] not in ('hang', 'door', 'sidedoor') and arr.shape[0] != (U + o['h']) * 16: bad.append('%s 높이' % id_)
            wrong = [u for u in o.get('use') or () if u not in USE_IDS]
            if wrong: bad.append('%s use %s — 쓰임 id 는 %s 중에서(handInterior parts.ts USE_WORDS)' % (id_, wrong, ' '.join(USE_IDS)))
            if o.get('facing') not in (None, 'N', 'S', 'E', 'W'): bad.append('%s facing %r' % (id_, o['facing']))
        return bad


def run_block(R, outdir):
    """블록 파일의 __main__: selftest + 눈 확인 그림(_all-x3.png: 등록 순서대로 가구·바닥·벽면)."""
    bad = R.selftest()
    os.makedirs(outdir, exist_ok=True)
    sheet_parts = []
    for id_ in R.floors: sheet_parts.append((id_, R._period(('f', id_), R.floors[id_]['draw'], R.floors[id_]['cols'] * 16, R.floors[id_]['rows'] * 16)))
    for id_ in R.walls:
        a = R._period(('w', id_), R.walls[id_]['draw'], R.walls[id_]['cols'] * 16, 32)
        sheet_parts.append((id_, shade_rows(a, TOP_SHADE)))
    for id_ in R.objs: sheet_parts.append((id_, R.obj_image(id_)[0]))
    for id_, td in R.tables.items(): sheet_parts.append((id_, R._canvas(td['draw'], 48, 32, 3, 2)))
    for id_, gd in R.goods.items(): sheet_parts.append((id_, R._canvas(gd['draw'], 16, 16)))
    W = 640; x = y = 4; rowh = 0; place = []
    for id_, a in sheet_parts:
        h, w = a.shape[:2]
        if x + w + 4 > W: x, y, rowh = 4, y + rowh + 6, 0
        place.append((x, y, a)); x += w + 6; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 4, W, 4), np.uint8); sheet[:, :, :3] = (58, 56, 66); sheet[:, :, 3] = 255
    for (x0, y0, a) in place: blit(sheet, a, x0, y0)
    im = Image.fromarray(sheet, 'RGBA')
    im.save(os.path.join(outdir, '_all.png'))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(outdir, '_all-x3.png'))
    b = R.build()
    print('%s: 칸 %d · 바닥 %d · 벽면 %d · 천장 %d · 가구 %d · 탁자 %d · 탁상 %d · 실패 %d' % (
        R.block, len(b['cells']), len(R.floors), len(R.walls), len(R.ceils), len(R.objs), len(R.tables), len(R.goods), len(bad)))
    for m in bad[:20]: print('  ✗', m)
    return bad
