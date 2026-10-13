"""적대적 QA 장면 — 구운(dry) 시트·키트로 실제 칸 배열을 짜서 원본 해상도로 그린다(그림 = 맵 출력과 같은 경로).

  python3 steam_b_scenes.py [out_dir]     # street · yard · boiler · inn · dock  →  <out>/<id>.png + <id>.json(아래/위층 배열)
장면은 손으로 정한 배치(검수용)다. 조수용 구성기는 src/project/skySteamComposer.ts.
"""
from __future__ import annotations
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bake_sky as BS  # noqa: E402

T = 16
LOWER = ('floor', 'solidfloor')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/steamredo/scenes'


class Scene:
    def __init__(self, sid, name, w, h, baked):
        self.id, self.name, self.w, self.h = sid, name, w, h
        self.d = baked['data']; self.sheet = baked['sheet']; self.cells = baked['kit_cells']
        self.kits = {k['id']: k for k in self.d['structureKits']}
        self.autos = {a['id']: a for a in self.d['autotileGroups']}
        self.lower = [-1] * (w * h); self.upper = [-1] * (w * h)
        self.placed = []

    def fill(self, fid, x0=0, y0=0, w=None, h=None, variants=None):
        w = self.w - x0 if w is None else w; h = self.h - y0 if h is None else h
        cs = self.cells[fid]; vs = variants or sorted(cs)
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if 0 <= x < self.w and 0 <= y < self.h:
                    v = vs[((x * 7 + y * 13) ^ (x * y)) % len(vs)]
                    t, pc = cs[v]
                    (self.lower if pc in LOWER else self.upper)[y * self.w + x] = t

    def auto(self, aid, cells):
        a = self.autos[aid]; S = set(cells)
        n8 = a['neighborhood'] == 8
        dirs = [(0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)] + ([(1, -1, 16), (1, 1, 32), (-1, 1, 64), (-1, -1, 128)] if n8 else [])
        layer = self.lower if a.get('layer', 'lower') == 'lower' else self.upper
        for (x, y) in S:
            if not (0 <= x < self.w and 0 <= y < self.h): continue
            m = 0
            for dx, dy, b in dirs:
                nx, ny = x + dx, y + dy
                if (nx, ny) in S or not (0 <= nx < self.w and 0 <= ny < self.h): m |= b
            layer[y * self.w + x] = a['variantMap'][str(m)]

    def kit(self, kid, x0, y0):
        k = self.kits[kid]
        for y, row in enumerate(k['rows']):
            for x in range(k['width']):
                X, Y = x0 + x, y0 + y
                if not (0 <= X < self.w and 0 <= Y < self.h): continue
                lo, up = row['tiles'][x], row['upperTiles'][x]
                if lo >= 0: self.lower[Y * self.w + X] = lo
                if up >= 0: self.upper[Y * self.w + X] = up
        self.placed.append((kid, x0, y0, k['width'], k['height']))

    def render(self, bg=(14, 12, 22, 255)):
        im = Image.new('RGBA', (self.w * T, self.h * T), bg)
        tpr = self.d['tilesPerRow']
        for i in range(self.w * self.h):
            for t in (self.lower[i], self.upper[i]):
                if t >= 0:
                    c = self.sheet.crop(((t % tpr) * T, (t // tpr) * T, (t % tpr) * T + T, (t // tpr) * T + T))
                    im.alpha_composite(c, ((i % self.w) * T, (i // self.w) * T))
        return im

    def dump(self, out):
        os.makedirs(out, exist_ok=True)
        self.render().save(os.path.join(out, self.id + '.png'))
        json.dump(dict(id=self.id, name=self.name, w=self.w, h=self.h, lower=self.lower, upper=self.upper, placed=self.placed),
                  open(os.path.join(out, self.id + '.json'), 'w'), ensure_ascii=False)


def rect(x0, y0, w, h): return {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w)}


def variants(cells, main=0, every=7):
    """QA B2: 기본 변형 하나 + every 칸에 하나 꼴 다른 변형(바둑판 금지)."""
    keys = sorted(cells)
    return lambda x, y: keys[main] if ((x * 5 + y * 3) % every) else keys[(main + 1 + (x + y) % (len(keys) - 1)) % len(keys)]


def fill2(s, fid, x0, y0, w, h, pick):
    cs = s.cells[fid]
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if 0 <= x < s.w and 0 <= y < s.h:
                t, pc = cs[pick(x, y)]
                (s.lower if pc in LOWER else s.upper)[y * s.w + x] = t


def room(s, wall_ids, floor_id, floor_pick, door_x):
    """실내 방: 테두리 = 천장 오토타일(QA B1), 북벽 = 벽 키트 앞면 2줄(키트의 천장 칸은 오토타일이 덮는다), 바닥, 남벽 문 한 칸."""
    fill2(s, floor_id, 1, 3, s.w - 2, s.h - 4, floor_pick)
    for x in range(1, s.w - 1): s.kit(wall_ids[x % len(wall_ids)], x, 0)
    ring = {(x, y) for y in range(s.h) for x in range(s.w) if x == 0 or x == s.w - 1 or y == 0 or y == s.h - 1}
    ring.discard((door_x, s.h - 1))
    s.auto('steam-at-ceiling', ring)
    fill2(s, floor_id, door_x, s.h - 1, 1, 1, floor_pick)


def street(b):
    s = Scene('street', '증기 도시 거리(전차·가스등·공동주택)', 44, 24, b)
    fl = s.cells['steam-t-flag']
    fill2(s, 'steam-t-flag', 0, 0, 44, 24, variants(fl))
    s.auto('steam-at-cobble', rect(0, 10, 44, 6))
    s.auto('steam-at-tramrail', {(x, 12) for x in range(44)})
    x = 1                                                       # 뒷줄: 발(문 줄)을 y=8 에 맞춰 북쪽 끝까지 건물(QA S1)
    for kid in ('steam-tenement', 'steam-inn', 'steam-workshop', 'steam-clocktower', 'steam-tenement', 'steam-kiosk'):
        k = s.kits[kid]; s.kit(kid, x, 9 - k['height']); x += k['width'] + 1
    for lx in (6, 14, 22, 30, 38): s.kit('steam-gaslamp-tall-lit', lx, 7)       # QA S2
    s.kit('steam-pillarbox', 12, 7); s.kit('steam-bench', 19, 8); s.kit('steam-street-clock', 34, 6); s.kit('steam-soot-tree', 41, 6)
    s.kit('steam-tram', 8, 10)                                   # 전차만 차도에(마차는 남북 길·역 앞만, QA S4)
    x = 2                                                       # 앞줄: 문 앞 보도 한 줄(y=23) 남김(QA S5)
    for kid in ('steam-pumphouse', 'steam-workshop', 'steam-station'):
        k = s.kits[kid]; s.kit(kid, x, 23 - k['height']); x += k['width'] + 3
    s.kit('steam-carriage', 25, 20)                              # 역 앞 승강장 자리
    for lx in (6, 30): s.kit('steam-gaslamp-tall', lx, 20)
    s.kit('steam-bollard', 1, 16); s.kit('steam-valve-post', 33, 17)
    return s


def yard(b):
    s = Scene('yard', '공장 마당(굴뚝·가스 탱크·석탄 선로)', 44, 28, b)
    fill2(s, 'steam-t-yard', 0, 0, 44, 28, variants(s.cells['steam-t-yard']))
    s.auto('steam-at-brickpave', rect(0, 25, 44, 3))
    s.kit('steam-factory-hall', 1, 2); s.kit('steam-chimney-tall', 10, 1); s.kit('steam-boilerhouse', 13, 3)
    s.kit('steam-gasholder', 20, 3); s.kit('steam-foundry', 27, 2); s.kit('steam-watertower', 35, 2); s.kit('steam-engineshed', 0, 17)
    rail = {(x, 15) for x in range(9, 44)} | {(9, y) for y in range(15, 23)}
    s.auto('steam-at-rail', rail)
    s.kit('steam-locomotive', 8, 18); s.kit('steam-coal-wagon', 20, 14); s.kit('steam-coal-wagon', 26, 14); s.kit('steam-buffer-stop', 42, 15)
    pipe = {(15, 9), (15, 10)} | {(x, 11) for x in range(15, 30)} | {(29, 9), (29, 10)}     # QA Y2: 보일러동 밑 → 주물 공장 밑
    s.auto('steam-at-pipe', pipe)
    s.kit('steam-valve-post', 22, 10)
    s.kit('steam-gantry-crane', 30, 17)                          # QA Y4: 크레인 밑·선로 끝·벽 앞 무리
    s.kit('steam-crate-stack', 31, 21); s.kit('steam-crate', 33, 22); s.kit('steam-crate', 34, 22)
    s.kit('steam-coal-pile', 12, 20); s.kit('steam-coal-pile', 12, 22); s.kit('steam-ore-cart', 14, 21)
    s.kit('steam-oil-drum', 18, 9); s.kit('steam-barrel', 19, 9)
    s.kit('steam-pressure-tank', 38, 9); s.kit('steam-boiler-small', 40, 9); s.kit('steam-vent-anim', 37, 8); s.kit('steam-vent-anim', 11, 12)
    s.kit('steam-smoke-anim', 10, 0); s.kit('steam-gear-pile', 15, 21)
    return s


def boiler(b):
    s = Scene('boiler', '보일러실·기관실(실내)', 22, 15, b)
    room(s, ['steam-wall-plate', 'steam-wall-plate-pipes', 'steam-wall-plate', 'steam-wall-plate-gauge'], 'steam-t-floor',
         lambda x, y: (2, 0) if (x * 5 + y * 3) % 7 else (3, 0), 11)
    fill2(s, 'steam-t-grate', 1, 3, 20, 5, lambda x, y: (0, 0) if (x * 5 + y * 3) % 9 else (2, 0))
    s.kit('steam-i-boiler', 2, 3); s.kit('steam-furnace-anim', 6, 4); s.kit('steam-piston-anim', 9, 4); s.kit('steam-i-engine', 13, 4)
    s.kit('steam-i-pipewall', 17, 1); s.kit('steam-i-gauge-panel', 6, 1); s.kit('steam-gear-anim', 13, 1)
    s.kit('steam-i-coal-bunker', 2, 7); s.kit('steam-i-control-desk', 16, 7); s.kit('steam-i-stool', 17, 8)
    s.kit('steam-i-workbench', 2, 12); s.kit('steam-i-toolchest', 4, 12); s.kit('steam-i-crate-parts', 19, 12); s.kit('steam-i-wall-lamp', 4, 1); s.kit('steam-i-wall-lamp', 11, 1)
    s.kit('steam-gauge-anim', 19, 1)
    return s


def inn(b):
    s = Scene('inn', '여관 1층(술 계산대·탁자·침대)', 22, 15, b)
    room(s, ['steam-wall-paper', 'steam-wall-paper-window', 'steam-wall-paper', 'steam-wall-paper-gauge'], 'steam-t-floor',
         lambda x, y: (0, 0) if (x * 5 + y * 3) % 7 else (1, 0), 10)
    s.kit('steam-i-keg-rack', 2, 2); s.kit('steam-i-bar-counter', 2, 5); s.kit('steam-i-stool', 3, 6); s.kit('steam-i-stool', 5, 6)   # QA I1
    s.kit('steam-i-rug', 9, 8); s.kit('steam-i-table', 7, 6); s.kit('steam-i-chair', 6, 7); s.kit('steam-i-table', 12, 9); s.kit('steam-i-chair', 14, 10)
    s.kit('steam-i-stove', 17, 2); s.kit('steam-i-bookshelf', 13, 2); s.kit('steam-i-bed', 19, 5); s.kit('steam-i-bed', 19, 9)
    s.kit('steam-i-wall-lamp', 8, 1); s.kit('steam-i-blueprint-table', 2, 11)                 # QA I2: 톱니 벽판 없음(벽지 벽)
    return s


def island(s, x0, y0, w, h):
    """줄 A 칸으로 큰 섬: 풀 윗면 w×h(걷는 땅) + 남쪽 절벽 앞면 한 줄(왼끝·가운데·오른끝). 건물은 이 풀 위에 문 앞 한 줄을 남기고 놓는다."""
    fill2(s, 'sky-a-grass-top', x0, y0, w, h, variants(s.cells['sky-a-grass-top'], every=4))
    e = s.cells['sky-a-island-edge']
    for x in range(x0, x0 + w):
        t, pc = e[(0, 0) if x == x0 else ((2, 0) if x == x0 + w - 1 else (1, 0))]
        s.lower[(y0 + h) * s.w + x] = t


def dock(b):
    s = Scene('dock', '비공정 부두(하늘섬 A + 증기 부두 B)', 44, 28, b)
    fill2(s, 'sky-a-cloud-sea', 0, 0, 44, 28, variants(s.cells['sky-a-cloud-sea'], every=5))
    deck = rect(14, 4, 18, 13)
    s.auto('steam-at-deck', deck)
    s.kit('steam-hangar', 15, 3); s.kit('steam-dock-crane', 25, 2)
    s.kit('steam-mooring-mast', 28, 6)                           # QA D4: 계류탑은 갑판 동쪽 가장자리, 비공정은 바로 옆
    s.kit('sky-a-airship-anim', 32, 7)
    s.kit('steam-fuel-pump', 26, 12); s.kit('steam-winch', 24, 13); s.kit('steam-crate-stack', 15, 11); s.kit('steam-crate', 17, 12); s.kit('steam-barrel', 18, 12)
    s.kit('steam-gaslamp-tall-lit', 14, 13); s.kit('steam-gaslamp-tall-lit', 30, 13); s.kit('steam-cable-drum', 22, 14)
    island(s, 1, 6, 8, 7)                                         # QA D1·D2: 줄 A 건물은 따로 섬(풀 윗면) 위에만, B 건물과 떨어뜨림
    s.kit('sky-a-house', 2, 6); s.kit('sky-a-windmill-anim', 5, 5); s.kit('sky-a-bush', 1, 10); s.kit('sky-a-flowers', 8, 11)
    s.kit('sky-a-bridge', 9, 9)                                  # QA D5: 다리 양 끝 = 섬 풀 · 갑판
    s.kit('sky-a-island-s', 4, 19); s.kit('sky-a-island-m', 36, 19)   # 먼 작은 섬(장식)
    s.kit('sky-a-cloud-puff', 20, 22); s.kit('sky-a-cloud-mist', 30, 25)
    return s


SCENES = [street, yard, boiler, inn, dock]

if __name__ == '__main__':
    b = BS.bake(dry=True)
    for f in SCENES:
        sc = f(b); sc.dump(OUT); print(sc.id, sc.w, sc.h, len(sc.placed))
