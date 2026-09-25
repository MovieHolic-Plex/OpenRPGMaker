# Rasak 마을·실내 완성 예제 맵 조립기 — 제작자 타일 프리뷰가 없는 묶음(rasak_town·rasak_interior)의 "정답 예제".
#
# 참고문서 빌더(build_assistant_pack.py)는 용도마다 기준 맵 `maps/rasak_preview_<id>.layers.map.json` 을 읽는다.
# field·swamp·cave 는 제작자 프리뷰를 역재구성한 맵이 그 자리에 들어가고, 마을·실내는 이 스크립트가 조립한 맵이 들어간다.
# 자동타일은 MZ 기본 규칙(같은 kind 끼리 잇기, 맵 가장자리 = 이어짐)으로 모양을 계산한다 — MZ 에디터가 그리는 것과 같다.
#
#   python3 scripts/content/rasak/compose_examples.py --assets ~/third-party-assets/rasak [--only ex_village]
#
# 그림(렌더 PNG)은 저장소 밖(--assets/maps)에만 쓴다. 이 파일에는 배열을 만드는 규칙만 있다.
import argparse, json, os, sys
from pathlib import Path
from PIL import Image

T, COLS = 48, 96
N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128
DIRS = [(0, -1, N), (1, 0, E), (0, 1, S), (-1, 0, W), (1, -1, NE), (1, 1, SE), (-1, 1, SW), (-1, -1, NW)]
REPO = Path(__file__).resolve().parents[3]


class Canvas:
    """네 층 + 그림자 칸 판. 칸 값은 ('k', slot, kind) 자동타일 종류 또는 정수 아틀라스 번호."""

    def __init__(self, ctx, bundle, w, h, mid, name):
        self.ctx, self.b, self.w, self.h, self.id, self.name = ctx, bundle, w, h, mid, name
        self.L = {n: [None] * (w * h) for n in (1, 2, 3, 4)}
        self.SH = [0] * (w * h)
        self.owner = {}          # (layer, i) → 물체 id — 같은 층 겹침 검사
        self.errors = []         # 조립 규칙 위반(main 이 하나라도 있으면 실패)

    def ok(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    # ── 칠하기 ──
    def kind(self, layer, key, cells):
        """key = 'A2:3'·'A4:17' 같은 slot:kind, 또는 A5 그룹 'A5:<그룹 id>'(그룹 첫 칸) / 'A5#<n>'(A5 n 번 칸)."""
        for x, y in cells:
            if not self.ok(x, y):
                continue
            self.L[layer][y * self.w + x] = self.ctx.key_value(self.b, key)

    def tile(self, layer, t, x, y):
        if self.ok(x, y):
            self.L[layer][y * self.w + x] = t

    def clear(self, layer, cells):
        for x, y in cells:
            if self.ok(x, y):
                self.L[layer][y * self.w + x] = None

    def obj(self, oid, x, y, layer=None, over=False):
        """names.json 물체를 왼위 (x,y) 에 찍는다. 물체의 층을 기본으로 쓴다.
        검사(적대적 시각 QA 2026-09-25): 맵 밖으로 잘림 · 같은 층 다른 물체 덮어쓰기(over=True 로만 허용) ·
        바닥 물체가 지붕·벽(A3)이나 벽면(A4 벽)을 딛음 · 벽걸이가 벽면 밖 · 4층 소품 밑에 3층 물체 없음."""
        o = self.ctx.object(self.b, oid)
        ly = layer or o['layer']
        cells = [(x + c, y + r, t) for r, row in enumerate(o['cells']) for c, t in enumerate(row) if t >= 0]
        where = f'{oid}@({x},{y})'
        for cx, cy, _ in cells:
            if not self.ok(cx, cy):
                self.errors.append(f'{where}: 맵 밖으로 잘림 ({cx},{cy})')
                continue
            prev = self.owner.get((ly, cy * self.w + cx))
            if prev and not over:
                self.errors.append(f'{where}: {ly}층 ({cx},{cy}) 에서 {prev} 를 덮어씀')
            if ly == 4 and self.L[3][cy * self.w + cx] is None and not oid.startswith(('building_', 'trees_', 'sb_')) and self.ground(cx, cy) != 'table':
                self.errors.append(f'{where}: 4층 소품 밑 ({cx},{cy}) 에 3층 물체가 없음')
        if ly == 2:
            for cx, cy, _ in cells:
                if self.ok(cx, cy) and self.ground(cx, cy) not in ('floor', 'table'):
                    self.errors.append(f'{where}: 2층 바닥 장식이 ({cx},{cy}) {self.ground(cx, cy)} 위')
        if ly == 3 and cells:
            wall_mount = '벽걸이' in o['name']
            bottom = max(cy for _, cy, _ in cells)
            for cx, cy, _ in cells:
                if not self.ok(cx, cy):
                    continue
                g = self.ground(cx, cy)
                if oid.startswith(('building_', 'sb_')):
                    continue
                if wall_mount and g != 'wall':
                    self.errors.append(f'{where}: 벽걸이인데 ({cx},{cy}) 가 벽면이 아님({g})')
                if not wall_mount and cy == bottom and g in ('wall', 'roof', 'ceiling'):
                    self.errors.append(f'{where}: 바닥 물체의 밑줄 ({cx},{cy}) 이 {g} 위')
        for cx, cy, t in cells:
            if self.ok(cx, cy):
                self.tile(ly, t, cx, cy)
                self.owner[(ly, cy * self.w + cx)] = oid
        return o

    def ground(self, x, y):
        """1층 칸 성격: 'wall'(A4 벽면·A3 벽) · 'roof'(A3 지붕) · 'ceiling'(A4 윗면) · 'water'(A1) · 'floor'."""
        v = self.L[1][y * self.w + x]
        if isinstance(v, tuple):
            _, slot, kind = v
            if slot == 'A3':
                return 'wall' if (kind % 16) >= 8 else 'roof'
            if slot == 'A4':
                return 'wall' if self.ctx.ttype(self.b, slot, kind) == 'wall' else 'ceiling'
            if slot == 'A1':
                return 'water'
            if slot == 'A2' and '탁자' in self.ctx.kind_name(self.b, f'{slot}:{kind}'):
                return 'table'
        return 'floor' 

    def shadow(self, x, y, bits=5):
        if self.ok(x, y):
            self.SH[y * self.w + x] |= bits

    # ── 건물(MZ A3): 지붕 윗면 kind 와 벽 kind 로 w×(roof+wall) 집 한 채 ──
    def house(self, x, y, w, roof_h, wall_h, roof, wall):
        self.kind(1, roof, rect(x, y, w, roof_h))
        self.kind(1, wall, rect(x, y + roof_h, w, wall_h))

    # ── 모양 계산 ──
    def resolve(self):
        out = {}
        for n, cells in self.L.items():
            res = []
            for i, v in enumerate(cells):
                if v is None:
                    res.append(-1)
                elif isinstance(v, int):
                    res.append(v)
                else:
                    res.append(self.ctx.shape_tile(self.b, v, self.mask(cells, i, v)))
            out[n] = res
        return out

    def mask(self, cells, i, v):
        x, y = i % self.w, i // self.w
        m = 0
        for dx, dy, bit in DIRS:
            nx, ny = x + dx, y + dy
            if not self.ok(nx, ny):
                m |= bit  # 맵 가장자리 = 이어짐(MZ 에디터와 같음)
                continue
            u = cells[ny * self.w + nx]
            if isinstance(u, tuple) and connects(v, u):
                m |= bit
        return m

    def to_map(self):
        L = self.resolve()
        return {'id': f'rasak_preview_{self.id}', 'name': self.name, 'width': self.w, 'height': self.h, 'tileSize': T,
                'tilesetId': self.b, 'lowerTiles': L[1], 'upperTiles': L[3], 'events': [],
                'lowerOverlayTiles': L[2], 'upperOverlayTiles': L[4], 'shadowBits': list(self.SH)}


def connects(v, u):
    """MZ 기본: 같은 slot·kind 끼리. A1 물 kind 끼리는 서로 잇는다(connectRulesObserved.A1_water)."""
    if v == u:
        return True
    if v[1] == 'A1' and u[1] == 'A1':
        return not (v[2] >= 4 and v[2] % 2 == 1) and not (u[2] >= 4 and u[2] % 2 == 1)
    return False


def rect(x, y, w, h):
    return [(x + i, y + j) for j in range(h) for i in range(w)]


def line_h(x, y, w):
    return rect(x, y, w, 1)


def line_v(x, y, h):
    return rect(x, y, 1, h)


class Ctx:
    def __init__(self, root):
        self.root = root
        names_local = root / 'knowledge' / 'names.json'
        self.names = json.loads((names_local if names_local.exists() else REPO / 'tiledata/rasak-fantasy/names.json').read_text())
        masks = json.loads((REPO / 'tiledata/rasak-fantasy/mz-autotile-masks.json').read_text())
        self.floor = {int(k): v for k, v in masks['floor']['maskToShape'].items()}
        self.wall = {int(k): v for k, v in masks['wall']['maskToShape'].items()}
        self.fall = {int(k): v for k, v in masks['waterfall']['maskToShape'].items()}
        self.man, self.idx, self.a5 = {}, {}, {}

    def load(self, b):
        if b in self.man:
            return
        man = json.loads((self.root / 'baked' / b / 'manifest.json').read_text())
        self.man[b] = man
        idx, a5 = {}, {}
        for i, e in enumerate(man['entries']):
            if not e:
                continue
            if 'kind' in e and e.get('frame', 0) == 0:
                idx[(e['slot'], e['kind'], e['shape'])] = i
            elif e.get('slot') == 'A5':
                a5[e['n']] = i
        self.idx[b], self.a5[b] = idx, a5

    def key_value(self, b, key):
        self.load(b)
        if key.startswith('A5#'):
            return self.a5[b][int(key[3:])]
        if key.startswith('A5:'):
            k = next(k for k in self.names['bundles'][b]['kinds'] if k['slot'] == 'A5' and k['kind'] == key)
            return k['tiles'][0]
        slot, kind = key.split(':')
        return ('k', slot, int(kind))

    def kind_name(self, b, key):
        for k in self.names['bundles'][b]['kinds']:
            if f"{k['slot']}:{k['kind']}" == key:
                return k.get('name', '')
        return ''

    def ttype(self, b, slot, kind):
        if slot == 'A1':
            return 'waterfall' if (kind >= 4 and kind % 2 == 1) else 'floor'
        if slot == 'A3':
            return 'wall'
        if slot == 'A4':
            e = self.man[b]['entries'][self.idx[b][(slot, kind, 0)]]
            return 'wall' if e.get('wall') else 'floor'
        return 'floor'

    def shape_tile(self, b, v, mask):
        _, slot, kind = v
        tt = self.ttype(b, slot, kind)
        shape = self.floor[mask] if tt == 'floor' else self.wall[mask & 15] if tt == 'wall' else self.fall[mask & (E | W)]
        t = self.idx[b].get((slot, kind, shape))
        if t is None:
            raise KeyError(f'{b} {slot}:{kind} shape {shape} 없음')
        return t

    def object(self, b, oid):
        objs = self.names['bundles'][b]['objects']
        for o in objs:
            if o['id'] == oid:
                return o
        # 같은 이름 변형이 여럿이면 빌더가 id 뒤에 _<칸 번호> 를 붙인다 — 첫 변형을 쓴다.
        for o in objs:
            if o['id'].startswith(oid + '_'):
                return o
        raise KeyError(f'{b} 물체 {oid} 없음')


def render(ctx, m, path):
    b = m['tilesetId']
    atlas = Image.open(ctx.root / 'baked' / b / 'atlas.png').convert('RGBA')
    w, h = m['width'], m['height']
    img = Image.new('RGBA', (w * T, h * T), (0, 0, 0, 255))
    shadow_start = ctx.man[b]['shadowStart']
    def put(t, i):
        if t is None or t < 0:
            return
        tile = atlas.crop(((t % COLS) * T, (t // COLS) * T, (t % COLS + 1) * T, (t // COLS + 1) * T))
        img.alpha_composite(tile, ((i % w) * T, (i // w) * T))
    for i in range(w * h):
        put(m['lowerTiles'][i], i)
        put(m['lowerOverlayTiles'][i], i)
        if m['shadowBits'][i]:
            put(shadow_start + m['shadowBits'][i] - 1, i)
        put(m['upperTiles'][i], i)
        put(m['upperOverlayTiles'][i], i)
    img.convert('RGB').save(path)


# 예제 맵 명세는 compose_examples_specs.py (이름표 kind 번호·물체 id 를 쓴다).


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--assets', default='~/third-party-assets/rasak')
    ap.add_argument('--only', action='append')
    a = ap.parse_args()
    root = Path(os.path.expanduser(a.assets))
    ctx = Ctx(root)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from compose_examples_specs import EXAMPLES
    for name, fn in EXAMPLES.items():
        if a.only and name not in a.only:
            continue
        c = fn(ctx)
        if c.errors:
            print(f'{name}: 조립 규칙 위반 {len(c.errors)}건', file=sys.stderr)
            for e in c.errors:
                print('  -', e, file=sys.stderr)
            sys.exit(1)
        m = c.to_map()
        out = root / 'maps' / f"{m['id']}.layers.map.json"
        out.write_text(json.dumps(m, ensure_ascii=False))
        render(ctx, m, root / 'maps' / f"{m['id']}.render.png")
        used = {n: sum(1 for t in m[k] if t >= 0) for n, k in [(1, 'lowerTiles'), (2, 'lowerOverlayTiles'), (3, 'upperTiles'), (4, 'upperOverlayTiles')]}
        print(name, m['width'], 'x', m['height'], 'layers', used, 'shadow', sum(1 for v in m['shadowBits'] if v), '->', out)


if __name__ == '__main__':
    main()
