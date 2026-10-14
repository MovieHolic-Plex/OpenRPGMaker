#!/usr/bin/env python3
"""modern_city 실내 키트 틀 — jp_city 실내 틀(scripts/content/jp-city/interior/ikit.py)과 같은 굽기 계약, 팔레트만 modern_city 시트 램프(mpx.py).

구조 규칙은 손 도트 실내 v5(src/editor/handInterior/builder.ts)와 같다:
  평면 '#' = 막힘. 막힌 칸 바로 아래 두 줄 = 벽면(못 걸음), 나머지 실내 = 바닥. 막힌 칸 중 실내에 8방으로 닿는 칸 = 천장 띠, 나머지 = 공허.
  · 바닥 = cols×rows 주기 그림 → 그림자 4변형(0 · 1 벽면 밑 · 2 서쪽 · 3 둘 다) — 같은 램프의 단 내리기. 번호 = ((y%rows)*cols + x%cols)*4 + 그림자.
  · 벽면 = 32px × cols 칸 → 윗줄 위 4행 천장 밑 그늘 + 서쪽 그림자 변형. 번호 = ((줄-1)*cols + x%cols)*2 + 서쪽.
  · 천장 = 비트(1 남 · 2 북 · 4 서 · 8 동 · 16 북쪽 공허) 32변형.
  · 가구 = 폭 w*16, 높이 (U+h)*16(U = ceil(up/16)). kind floor · wall · hang · flat · door · sidedoor (ikit.py 설명 그대로).
  · 탁자 = draw(c, w, h) 로 3×3·1×3·3×1·1×1 을 그려 L/M/R/S × T/M/B/S 조각으로 자른다. 탁상 물건 = 16×16(4층).
그림 함수는 mpx.C 캔버스(램프·단)를 받는다.
"""
import collections, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import mpx                             # noqa: E402
from mpx import C, RAMPS               # noqa: E402

TOP_SHADE = (-2, -2, -1, -1)
FOOT_SHADE = (-2, -1, -1)
WEST_SHADE = (-2, -2, -1, -1, -1, 0)
USE_IDS = ('sit', 'sleep', 'open', 'search', 'read', 'counter', 'travel', 'light', 'save', 'heal', 'switch', 'push', 'trap', 'key', 'gate', 'seal', 'walk', 'block')
KIT_PREFIX = 'mc-in-'
GROUP_PREFIX = 'mc:interior-'

_INV = {}
for _name, _r in RAMPS.items():
    for _i, _c in enumerate(_r):
        _INV.setdefault(mpx._rgb(_c), (_name, _i))
PALETTE = set(_INV)


def step_down(rgb, n):
    hit = _INV.get(tuple(int(v) for v in rgb[:3]))
    if not hit or n == 0: return tuple(int(v) for v in rgb[:3])
    name, i = hit
    return mpx._rgb(RAMPS[name][max(0, i + n)])


def shade_rows(a, rows):
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
    h, w = src.shape[:2]
    for j in range(h):
        for i in range(w):
            if src[j, i, 3] and 0 <= y + j < dst.shape[0] and 0 <= x + i < dst.shape[1]: dst[y + j, x + i] = src[j, i]


def default_ceiling(c, bits):
    """천장 띠 한 칸: 어두운 숯색 판(가는 격자) + 실내 쪽 밝은 몰딩, 북쪽 공허 쪽 어두운 끝."""
    S, N, Wb, E, NV = bits & 1, bits & 2, bits & 4, bits & 8, bits & 16
    for y in range(16):
        for x in range(16):
            col = ('dark', 2) if (x % 8 == 0 or y % 8 == 0) else ('dark', 3) if (x + y) % 2 else ('dark', 3)
            if (x % 8, y % 8) == (1, 1): col = ('dark', 4)
            if S and y >= 12: col = (('grey', 4), ('grey', 3), ('grey', 1), ('ink', 1))[y - 12]
            if N and y <= 1: col = (('ink', 1), ('grey', 1))[y]
            if Wb and x <= 2: col = (('ink', 1), ('grey', 4), ('grey', 3))[x]
            if E and x >= 13: col = (('grey', 3), ('grey', 1), ('ink', 1))[x - 13]
            if NV and y == 0: col = ('ink', 1)
            c.P(x, y, *col)


class Registry:
    def __init__(self, block, name):
        self.block, self.name = block, name
        self.floors, self.walls, self.ceils, self.objs, self.tables, self.goods = {}, {}, {}, {}, {}, {}
        self.void = True
        self._built = None

    def floor(self, id_, ko, cols=4, rows=4, tags=(), desc='', lay=None):
        def deco(fn): self.floors[id_] = dict(ko=ko, cols=cols, rows=rows, draw=fn, tags=list(tags), desc=desc, lay=lay); return fn
        return deco

    def wall(self, id_, ko, cols=4, tags=(), desc=''):
        def deco(fn): self.walls[id_] = dict(ko=ko, cols=cols, draw=fn, tags=list(tags), desc=desc); return fn
        return deco

    def ceiling(self, id_, ko, desc=''):
        def deco(fn): self.ceils[id_] = dict(ko=ko, draw=fn, desc=desc); return fn
        return deco

    def obj(self, id_, ko, w=1, h=1, up=0, kind='floor', cat='misc', cat_ko='기타', walk=(), solid=None, surface=False,
            stairs=None, use=(), facing=None, desc='', tags=(), place='', pair=(), states=None, hrows=2, gate='low_furniture'):
        assert kind in ('floor', 'wall', 'hang', 'flat', 'door', 'sidedoor'), kind
        assert kind not in ('door', 'sidedoor') or (w == 1 and up == 0), id_
        def deco(fn):
            assert id_ not in self.objs, ('id 중복', id_)
            self.objs[id_] = dict(ko=ko, w=w, h=(0 if kind in ('hang', 'door', 'sidedoor') else h), up=up, kind=kind, cat=cat, cat_ko=cat_ko,
                                  walk=[tuple(p) for p in walk], solid=None if solid is None else [tuple(p) for p in solid], surface=surface,
                                  stairs=stairs, use=list(use), facing=facing, desc=desc, tags=list(tags), place=place, pair=list(pair),
                                  states=states, hrows=hrows, draw=fn, gate=gate)
            return fn
        return deco

    def table(self, id_, ko, one_row=False, desc='', tags=()):
        def deco(fn): self.tables[id_] = dict(ko=ko, oneRow=one_row, draw=fn, desc=desc, tags=list(tags)); return fn
        return deco

    def good(self, id_, ko, desc='', gate='other'):
        def deco(fn): self.goods[id_] = dict(ko=ko, draw=fn, desc=desc, gate=gate); return fn
        return deco

    @staticmethod
    def _canvas(fn, w, h, *args):
        c = C(w, h); fn(c, *args); return c.rgba()

    def obj_image(self, id_):
        o = self.objs[id_]
        U = math.ceil(o['up'] / 16)
        rows = 2 if o['kind'] == 'door' else 3 if o['kind'] == 'sidedoor' else o['hrows'] if o['kind'] == 'hang' else U + o['h']
        return self._canvas(o['draw'], o['w'] * 16, rows * 16), U

    _pcache = {}

    def _period(self, key, fn, w, h):
        k = (self.block,) + key
        if k not in Registry._pcache: Registry._pcache[k] = self._canvas(fn, w, h)
        return Registry._pcache[k]

    def floor_period(self, id_):
        f = self.floors[id_]
        return self._period(('f', id_), f['draw'], f['cols'] * 16, f['rows'] * 16)

    def wall_period(self, id_):
        wd = self.walls[id_]
        return shade_rows(self._period(('w', id_), wd['draw'], wd['cols'] * 16, 32), TOP_SHADE)

    def floor_cell(self, id_, x, y, sh):
        f = self.floors[id_]
        a = self.floor_period(id_)
        t = a[(y % f['rows']) * 16:(y % f['rows']) * 16 + 16, (x % f['cols']) * 16:(x % f['cols']) * 16 + 16].copy()
        if sh & 1: t = shade_rows(t, FOOT_SHADE)
        if sh & 2: t = shade_cols(t, WEST_SHADE)
        return t

    def lay_x(self, id_, x, y):
        f = self.floors[id_]
        if f.get('lay') != 'rowShift': return x
        h = (y + 1) & 0xFFFFFFFF
        h ^= h >> 16; h = (h * 0x85ebca6b) & 0xFFFFFFFF; h ^= h >> 13; h = (h * 0xc2b2ae35) & 0xFFFFFFFF; h ^= h >> 16
        return x + h % f['cols']

    def wall_cell(self, id_, x, row, west):
        wd = self.walls[id_]
        a = self.wall_period(id_)
        t = a[(row - 1) * 16:(row - 1) * 16 + 16, (x % wd['cols']) * 16:(x % wd['cols']) * 16 + 16].copy()
        if west: t = shade_cols(t, WEST_SHADE)
        return t

    def ceil_cell(self, id_, bits):
        return self._canvas(self.ceils[id_]['draw'], 16, 16, bits)

    def table_image(self, id_, w, h):
        return self._canvas(self.tables[id_]['draw'], w * 16, h * 16, w, h)

    def build(self):
        """칸 사전(로컬 이름 → 그림·통행 종류) + 사양(로컬 이름으로 된 floors/walls/…) + 그룹 + 키트."""
        if self._built: return self._built
        cells = collections.OrderedDict(); seen = {}; kits = []; groups = []
        interior = dict(floors={}, walls={}, ceilings={}, objects={}, tables={}, goods={}, void=None)

        def add(local, arr, pc, label, desc='', tags=()):
            key = (arr.tobytes(), pc)
            if key in seen: return seen[key]
            cells[local] = dict(img=Image.fromarray(arr.copy(), 'RGBA'), pc=pc, label=label, desc=desc or label, tags=list(tags))
            seen[key] = local
            return local

        v = np.zeros((16, 16, 4), np.uint8); v[:, :, :3] = mpx._rgb(RAMPS['ink'][0]); v[:, :, 3] = 255
        interior['void'] = add('void', v, 'solidfloor', '실내 공허(벽 속·건물 밖)', '막힘. 실내 맵의 건물 밖·두꺼운 벽 속.')
        for id_, f in self.floors.items():
            loc = []
            for y in range(f['rows']):
                for x in range(f['cols']):
                    for sh in range(4):
                        loc.append(add('floor.%s.%d.%d.%d' % (id_, x, y, sh), self.floor_cell(id_, x, y, sh), 'floor',
                                       '%s 바닥%s' % (f['ko'], ('', ' · 벽 밑 그늘', ' · 서쪽 그늘', ' · 벽 밑·서쪽 그늘')[sh]), f['desc'], f['tags']))
            interior['floors'][id_] = dict(ko=f['ko'], cols=f['cols'], rows=f['rows'], tiles=loc, **({'lay': f['lay']} if f.get('lay') else {}))
            groups.append(dict(id=GROUP_PREFIX + 'floor-' + id_, name='실내 바닥 · %s' % f['ko'], role='terrain', defaultLayer='lower', cells=list(dict.fromkeys(loc)),
                               desc=f['desc'] or f['ko'], rules='실내 바닥. build_hand_interior_room({tileset:"modern_city"}) 가 벽 밑·서쪽 그늘 변형까지 고른다.'))
        for id_, wd in self.walls.items():
            loc = []
            for row in (1, 2):
                for x in range(wd['cols']):
                    for west in (0, 1):
                        loc.append(add('wall.%s.%d.%d.%d' % (id_, row, x, west), self.wall_cell(id_, x, row, west), 'solidfloor',
                                       '%s 벽면 %s줄%s' % (wd['ko'], '윗' if row == 1 else '아랫', ' · 서쪽 그늘' if west else ''), wd['desc'], wd['tags']))
            interior['walls'][id_] = dict(ko=wd['ko'], cols=wd['cols'], tiles=loc)
            groups.append(dict(id=GROUP_PREFIX + 'wall-' + id_, name='실내 벽면 · %s' % wd['ko'], role='wall', defaultLayer='lower', cells=list(dict.fromkeys(loc)),
                               desc=wd['desc'] or wd['ko'], rules='막힌 칸 바로 아래 두 줄(벽면). 조립 도구가 자동으로 깐다.'))
        for id_, cd in self.ceils.items():
            loc = [add('ceil.%s.%d' % (id_, b), self.ceil_cell(id_, b), 'solidfloor', '%s 천장 띠 %d' % (cd['ko'], b), cd['desc']) for b in range(32)]
            interior['ceilings'][id_] = loc
            groups.append(dict(id=GROUP_PREFIX + 'ceiling-' + id_, name='실내 천장 띠 · %s' % cd['ko'], role='wall', defaultLayer='lower', cells=list(dict.fromkeys(loc)),
                               desc=cd['desc'] or cd['ko'], rules='실내에 닿는 막힌 칸. 조립 도구가 자동으로 깐다.'))
        bycat = collections.OrderedDict()
        for id_, o in self.objs.items():
            arr, U = self.obj_image(id_)
            R_, C_ = arr.shape[0] // 16, arr.shape[1] // 16
            spec_cells, grid = [], [[None] * C_ for _ in range(R_)]
            if o['kind'] == 'door':
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
            meta = {k: o[k] for k in ('ko', 'kind', 'surface', 'stairs', 'use', 'facing', 'desc', 'tags', 'place', 'pair', 'states') if o[k] not in (None, [], '', False)}
            meta.update(category=o['cat'], category_ko=o['cat_ko'], cells=spec_cells, w=o['w'], h=o['h'], up=o['up'])
            interior['objects'][id_] = meta
            snap = {'wall': 'wall-north', 'hang': 'wall-north', 'door': 'wall-north', 'sidedoor': 'floor'}.get(o['kind'], 'floor')
            ai = dict(snap=snap, tags=o['tags'], description=(o['desc'] or o['ko'])[:400], placementRules=(o['place'] or '')[:400], repeatability='fixed',
                      anchor=dict(dx=0, dy=len(grid) - 1), role='prop')
            kits.append(dict(id=KIT_PREFIX + id_, name=o['ko'], grid=grid, ai=ai, kind=o['kind']))
            bycat.setdefault(o['cat'], (o['cat_ko'], []))[1].extend(c for r in grid for c in r if c)
        for cat, (ko, locs) in bycat.items():
            groups.append(dict(id=GROUP_PREFIX + 'obj-' + cat, name='실내 가구 · %s' % ko, role='prop', defaultLayer='upper', cells=list(dict.fromkeys(locs)),
                               desc='%s 가구 조각. 낱칸으로 칠하지 말고 build_hand_interior_room 의 objects(id) 나 키트 mc-in-<id> 로 놓는다.' % ko,
                               rules='가구는 칸 묶음 그대로 놓는다. 벽 가구는 북쪽 벽면 바로 아래 첫 바닥 줄, 걸이는 벽면 윗줄.'))
        tlocs = []
        for id_, td in self.tables.items():
            pieces = {}
            for (w, h, cs, rs) in ((3, 3, 'LMR', 'TMB'), (1, 3, 'S', 'TMB'), (3, 1, 'LMR', 'S'), (1, 1, 'S', 'S')):
                if td['oneRow'] and h > 1: continue
                a = self.table_image(id_, w, h)
                for j, rc in enumerate(rs):
                    for i, cc in enumerate(cs):
                        t = a[j * 16:j * 16 + 16, i * 16:i * 16 + 16]
                        loc = add('table.%s.%s%s' % (id_, cc, rc), t, 'solid', '%s 조각 %s%s' % (td['ko'], cc, rc), td['desc'], td['tags'])
                        pieces[cc + rc] = [[0, 0, loc, 3]]; tlocs.append(loc)
            interior['tables'][id_] = dict(ko=td['ko'], up=0, oneRow=td['oneRow'], pieces=pieces)
        gl = []
        for id_, gd in self.goods.items():
            loc = add('goods.%s' % id_, self._canvas(gd['draw'], 16, 16), 'star', '%s(탁상)' % gd['ko'], gd['desc'] or gd['ko'])
            interior['goods'][id_] = loc; gl.append(loc)
        if tlocs: groups.append(dict(id=GROUP_PREFIX + 'tables', name='실내 탁자·카운터(자동 조각)', role='prop', defaultLayer='upper', cells=list(dict.fromkeys(tlocs)),
                                     desc='크기 자유 탁자·카운터 조각(L/M/R × T/M/B/S).', rules='build_hand_interior_room 의 tables:[{style,x,y,w,h}] 로 놓는다.'))
        if gl: groups.append(dict(id=GROUP_PREFIX + 'goods', name='실내 탁상 물건', role='prop', defaultLayer='upper', cells=gl,
                                  desc='탁자·카운터·책상 윗면 위 4층 물건.', rules='goods:[{id,x,y}] — 윗면 있는 가구 칸 위에만.'))
        self._built = dict(cells=cells, groups=groups, kits=kits, interior=interior)
        return self._built

    def selftest(self):
        b = self.build(); bad = []
        for local, c in b['cells'].items():
            a = np.array(c['img'])
            if a.shape != (16, 16, 4): bad.append('%s 크기 %s' % (local, a.shape)); continue
            al = set(np.unique(a[:, :, 3]).tolist())
            if not al <= {0, 255}: bad.append('%s 반투명 %s' % (local, sorted(al)))
            cols = {tuple(p) for p in a[a[:, :, 3] == 255][:, :3].tolist()}
            off = [c_ for c_ in cols if c_ not in PALETTE]
            if off: bad.append('%s 팔레트 밖 %d색' % (local, len(off)))
        for id_, o in self.objs.items():
            wrong = [u for u in o.get('use') or () if u not in USE_IDS]
            if wrong: bad.append('%s use %s' % (id_, wrong))
        return bad
