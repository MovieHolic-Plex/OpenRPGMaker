#!/usr/bin/env python3
"""월드맵 지형 편집 층 — `terrains/<id>.json` (`worldmap-terrain/1`).

공용 지형(shared-v9)은 make_map_v4 의 손 다각형·꺾은선으로 만든다. 지형 편집은 그 위에 「작업(ops)」을 차례로 얹는다.
작업은 칸 좌표(96x72, x 오른쪽·y 아래)의 다각형·꺾은선이고, 같은 노이즈 왜곡으로 그려져 손으로 만든 지형과 결이 같다.

  { "schema": "worldmap-terrain/1", "id": "archipelago", "name": "군도", "base": "shared-v9",
    "ops": [ {"op": "sea", "poly": [[44,10],[56,10],[56,60],[44,60]]},
             {"op": "island", "x": 70, "y": 30, "rx": 5, "ry": 3, "ground": "jungle"}, ... ] }

작업 종류(모든 좌표는 칸):
  land    poly, ground?             땅을 더한다(바다·안쪽 바다 위에도). ground 없으면 초원
  sea     poly                      바다로 자른다(대륙을 가르거나 만을 판다). 장소 발자국은 물이면 오류
  island  x, y, rx, ry, ground?     타원 섬
  biome   poly, ground              그 다각형 안 모든 땅의 바닥을 바꾼다
  ridge   line, kind?, width?, peak?  산줄기(kind: mount | small | mesa, width 1~3, peak 가장 높은 점)
  pass    x, y, r?                  산줄기에 고개를 뚫는다(길이 지나갈 자리)
  river   line, widen?              강(꺾은선, 바다로 끝내라). widen 0~1: 그 비율부터 하류가 두 칸 폭
  forest  poly, kind?, density?     숲(kind: broad | conifer | snow | jungle | dead, density 0~1)
  clear   poly, what?               물체를 걷는다(what: forest | mount | all)
  plateau poly, level?, ground?     고원(level 1|2). 가장자리는 절벽이 된다 — 오르는 길은 경사로가 있어야 한다
  move_place id, x, y               여정 장소를 옮긴다(발자국 왼쪽 위 칸)
  volcano x, y, lava?               화산 — 가운데 분화구(반지름 2.6칸)와 둘레 화산 고리(3.6칸), lava 꺾은선은 용암 줄기. 땅이 반지름 4칸은 돼야 한다

base "generate" — 손 대륙 대신 빈 판에 새 구조를 만든다(kit_gen). 여정 장소·장벽은 kit_fit 이 자동으로 맞춘다.
  continents style?, count?, land?, seed?   대륙 구조(blobs | shards | ring | pangaea | archipelago | galaxy | peninsula | river-continent | arc-islands) — 생성 지형의 첫 작업
  climate    seed?, wet?, cold?             기후(바닥). wet·cold 는 -1~1
  wall       line, gate?                    2막을 가르는 산벽을 직접 긋는다(해안에서 해안까지). gate [x,y] 는 관문 요새 자리
  dune_sea   poly                           4막 사구 바다 자리(시작 대륙 1막 땅 안)
  sky_island x, y                           천공섬 자리(열린 바다)
  land·sea·island 는 구조에 접혀 맞춤 전에 반영되고, move_place 는 맞춤의 고정 핀이 된다.
바닥 이름: grass farm crop savanna sand dune dirt badlands ash basalt swamp marsh tundra snow glacier jungle
"""
import copy
import json
from pathlib import Path

GROUNDS = ('grass', 'farm', 'crop', 'savanna', 'sand', 'dune', 'dirt', 'badlands', 'ash', 'basalt', 'swamp', 'marsh', 'tundra', 'snow',
           'glacier', 'jungle')
FOREST_KIND = {'broad': 'BROAD', 'conifer': 'CONIFER', 'snow': 'SNOWF', 'jungle': 'JUNGLEF', 'dead': 'DEAD'}
RIDGE_KIND = {'mount': 'MOUNT', 'small': 'SMOUNT', 'mesa': 'MESA'}
OPS = {
    'land': (('poly',), ('ground',)), 'sea': (('poly',), ()), 'island': (('x', 'y', 'rx', 'ry'), ('ground',)),
    'biome': (('poly', 'ground'), ()), 'ridge': (('line',), ('kind', 'width', 'peak')), 'pass': (('x', 'y'), ('r',)),
    'river': (('line',), ('widen',)), 'forest': (('poly',), ('kind', 'density')), 'clear': (('poly',), ('what',)),
    'plateau': (('poly',), ('level', 'ground')), 'move_place': (('id', 'x', 'y'), ()),
    'volcano': (('x', 'y'), ('lava',)),
    'continents': ((), ('style', 'count', 'land', 'seed', 'box', 'region', 'home', 'beyond', 'sands')), 'climate': ((), ('seed', 'wet', 'cold')),
    'wall': (('line',), ('gate',)), 'dune_sea': (('poly',), ()), 'sky_island': (('x', 'y'), ()),
}
GEN_ONLY = ('continents', 'climate', 'wall', 'dune_sea', 'sky_island')
BASES = ('shared-v9', 'generate')
W, H = 96, 72


class TerrainError(ValueError):
    pass


def _pts(v, what, i, n=2):
    if not isinstance(v, list) or len(v) < n or not all(isinstance(p, (list, tuple)) and len(p) == 2 for p in v):
        raise TerrainError('ops[%d]: %s 는 [[x,y], ...] 점 %d개 이상' % (i, what, n))
    for x, y in v:
        if not (-4 <= x <= W + 4 and -4 <= y <= H + 4):
            raise TerrainError('ops[%d]: 점 (%s,%s) 이 지도(0~%d, 0~%d) 밖이다' % (i, x, y, W - 1, H - 1))
    return [(float(x), float(y)) for x, y in v]


def validate(spec):
    if spec.get('schema') != 'worldmap-terrain/1':
        raise TerrainError('schema 가 worldmap-terrain/1 이 아니다')
    base = spec.get('base', 'shared-v9')
    if base not in BASES:
        raise TerrainError('base 는 %s' % ' | '.join(BASES))
    ops = spec.get('ops', [])
    if not isinstance(ops, list):
        raise TerrainError('ops 는 배열')
    for i, o in enumerate(ops):
        k = o.get('op')
        if k not in OPS:
            raise TerrainError('ops[%d]: 모르는 op %r (있는 것: %s)' % (i, k, ', '.join(OPS)))
        need, opt = OPS[k]
        miss = [n for n in need if n not in o]
        if miss:
            raise TerrainError('ops[%d] (%s): %s 가 없다' % (i, k, ', '.join(miss)))
        extra = set(o) - set(need) - set(opt) - {'op', 'note'}
        if extra:
            raise TerrainError('ops[%d] (%s): 모르는 키 %s' % (i, k, ', '.join(sorted(extra))))
        if k in GEN_ONLY and base != 'generate':
            raise TerrainError('ops[%d] (%s): base "generate"(새 대륙 구조)에서만 쓴다 — 공용 지형(shared-v9)에는 대륙 구조가 이미 있다' % (i, k))
        if k == 'continents':
            import kit_gen as KG
            if o.get('style', 'blobs') not in KG.STYLES:
                raise TerrainError('ops[%d]: continents style 은 %s' % (i, ' | '.join(KG.STYLES)))
            if not (0 if KG.DEFAULT[o.get('style', 'blobs')]['count'] == 0 else 1) <= int(o.get('count', 4)) <= 40:   # korea·real 은 실제 지리라 섬 수 0 이 기본
                raise TerrainError('ops[%d]: continents count 는 1~40' % i)
            if o.get('style') == 'real':
                import kit_realgeo as KReal
                if 'region' in o and o['region'] not in KReal.REGIONS:
                    raise TerrainError('ops[%d]: continents region 은 %s 중 하나 — 없는 지역이면 box [서경, 남위, 동경, 북위] 를 직접 준다' % (i, ', '.join(KReal.REGIONS)))
                if 'region' not in o and 'box' not in o:
                    raise TerrainError('ops[%d]: style real 은 region(지역 이름) 이나 box [서경, 남위, 동경, 북위] 가 있어야 한다' % i)
                if 'box' in o:
                    try:
                        KReal.fit_box(o['box'])
                    except KReal.RealGeoError as e:
                        raise TerrainError('ops[%d]: %s' % (i, e))
                for kk, what in (('home', '여정을 시작할 땅'), ('beyond', '관문 너머(2막) 땅 쪽'), ('sands', '4막 사구 바다 자리')):
                    if kk in o and not (isinstance(o[kk], list) and len(o[kk]) == 2):
                        raise TerrainError('ops[%d]: continents %s 는 [경도, 위도] — %s' % (i, kk, what))
            elif any(kk in o for kk in ('box', 'region', 'home', 'beyond', 'sands')):
                raise TerrainError('ops[%d]: box·region·home·beyond·sands 는 style "real"(실제 지리)에서만 쓴다' % i)
            if not .2 <= float(o.get('land', .42)) <= .7:
                raise TerrainError('ops[%d]: continents land(땅 비율)는 0.2~0.7' % i)
        if k == 'climate':
            for kk in ('wet', 'cold'):
                if kk in o and not -1 <= float(o[kk]) <= 1:
                    raise TerrainError('ops[%d]: climate %s 는 -1~1' % (i, kk))
        if k == 'wall' and 'gate' in o and not (isinstance(o['gate'], list) and len(o['gate']) == 2):
            raise TerrainError('ops[%d]: wall gate 는 [x,y]' % i)
        if 'poly' in o:
            _pts(o['poly'], 'poly', i, 3)
        if 'line' in o:
            _pts(o['line'], 'line', i, 2)
        if 'lava' in o:
            _pts(o['lava'], 'lava', i, 2)
        for g in ('ground',):
            if g in o and o[g] not in GROUNDS:
                raise TerrainError('ops[%d]: 바닥 %r 이 없다 (있는 것: %s)' % (i, o[g], ' '.join(GROUNDS)))
        if k == 'forest' and o.get('kind', 'broad') not in FOREST_KIND:
            raise TerrainError('ops[%d]: 숲 kind 는 %s' % (i, ' | '.join(FOREST_KIND)))
        if k == 'ridge' and o.get('kind', 'mount') not in RIDGE_KIND:
            raise TerrainError('ops[%d]: 산 kind 는 %s' % (i, ' | '.join(RIDGE_KIND)))
        if k == 'clear' and o.get('what', 'all') not in ('forest', 'mount', 'all'):
            raise TerrainError('ops[%d]: clear what 은 forest | mount | all' % i)
        if k == 'plateau' and o.get('level', 1) not in (1, 2):
            raise TerrainError('ops[%d]: 고원 level 은 1 또는 2' % i)
    return spec


def load(ref, wm_dir):
    """ref = terrains/<id> 의 id 또는 JSON 파일 경로. None/'shared-v9' 이면 None(기본 지형)."""
    if ref in (None, '', 'shared-v9'):
        return None
    p = Path(ref)
    if not (p.suffix == '.json' and p.exists()):
        p = Path(wm_dir) / 'terrains' / (ref + '.json')
    if not p.exists():
        have = ', '.join(sorted(q.stem for q in (Path(wm_dir) / 'terrains').glob('*.json')))
        raise TerrainError('지형 %s 이 없다 (있는 것: shared-v9, %s)' % (ref, have))
    spec = json.loads(p.read_text())
    spec.setdefault('id', p.stem)
    return validate(spec)


def merge(base, edit):
    """테마 지형(base) 위에 편집(edit)의 작업을 잇는다. 둘 중 하나가 없으면 다른 하나."""
    if base is None or edit is None:
        return base if edit is None else edit
    bb = base.get('base', 'shared-v9')
    if 'base' in edit and edit['base'] != bb:
        return edit                                  # 바탕을 바꾸면(공용 ↔ 생성) 테마 지형 작업은 버린다
    out = dict(edit)
    out['base'] = bb
    out['id'] = '%s+%s' % (base['id'], edit.get('id', 'edit'))
    eops = list(edit.get('ops', []))
    mine = {o.get('op') for o in eops} & {'continents', 'climate'}
    # 생성 바탕에서 편집이 구조(continents)·기후를 직접 고르면 테마의 것은 버린다 — 둘 다 두면 앞(테마)의 것이 이겨 편집이 무시됐다
    bops = [o for o in base.get('ops', []) if not (bb == 'generate' and o.get('op') in mine)]
    out['ops'] = bops + eops
    return validate(out)


def blob(cx, cy, rx, ry, salt):
    """섬 윤곽 — 타원에 2·3·5 겹 굽이를 얹은 다각형. 작은 타원은 노이즈 왜곡을 거치면 모두 같은 십자 덩이가 됐다(QA 4차)."""
    import math
    import make_map_v4 as M4
    n = 18
    p = [M4.rnd(k, salt, 31) * 6.2832 for k in range(3)]
    amp = (.22 + .12 * M4.rnd(3, salt, 31), .14 + .08 * M4.rnd(4, salt, 31), .08)
    tilt = (M4.rnd(5, salt, 31) - .5) * 1.2
    out = []
    for k in range(n):
        a = 6.2832 * k / n
        r = 1 + amp[0] * math.sin(2 * a + p[0]) + amp[1] * math.sin(3 * a + p[1]) + amp[2] * math.sin(5 * a + p[2])
        r += (M4.rnd(k, salt, 37) - .5) * .16
        x, y = math.cos(a) * rx * r, math.sin(a) * ry * r
        out.append((cx + x * math.cos(tilt) - y * math.sin(tilt), cy + x * math.sin(tilt) + y * math.cos(tilt)))
    return out


def apply(spec, journey):
    """make_map_v4 의 목록에 작업을 얹고, move_place 를 반영한 여정 사본을 돌려준다. 프로세스당 한 번(빌드 전)."""
    if spec is None:
        return journey
    import make_map_v4 as M4
    if spec.get('base') == 'generate':
        import kit_gen as KG
        M4.use_blank_base()
        try:
            journey, _summary = KG.generate(spec, journey, int(spec.get('fit_salt', 0)))
        except KG.GenError as e:
            raise TerrainError(str(e))
    j = copy.deepcopy(journey)
    places = {p['id']: p for p in j['places']}
    gen = spec.get('base') == 'generate'
    for i, o in enumerate(spec['ops']):
        k = o['op']
        if gen and k in ('continents', 'climate', 'land', 'sea', 'island', 'move_place', 'wall', 'dune_sea', 'sky_island'):
            continue                                 # 구조 작업은 kit_gen 이 이미 반영했다
        g = getattr(M4, o['ground'].upper()) if o.get('ground') else None
        if k == 'land':
            M4.EXTRA_LAND.append((_pts(o['poly'], 'poly', i, 3), g, 1.5))
        elif k == 'sea':
            M4.EXTRA_SEA.append((_pts(o['poly'], 'poly', i, 3), 1.2))
        elif k == 'island':
            key = 'edit%d' % i
            M4.ISLES[key] = blob(float(o['x']), float(o['y']), float(o['rx']), float(o['ry']), 900 + i)
            M4.ISLE_GROUND[key] = g if g is not None else M4.GRASS
        elif k == 'biome':
            M4.EXTRA_BIOMES.append((_pts(o['poly'], 'poly', i, 3), g, 1.4))
        elif k == 'ridge':
            line = _pts(o['line'], 'line', i, 2)
            peak = tuple(o['peak']) if o.get('peak') else line[len(line) // 2]
            M4.RIDGES.append(('편집 능선 %d' % i, line, peak, float(min(3.0, max(1.0, o.get('width', 2.0)))),
                              getattr(M4, RIDGE_KIND[o.get('kind', 'mount')]), 600 + i))
        elif k == 'pass':
            M4.PASSES.append((float(o['x']), float(o['y']), float(o.get('r', 1.5))))
        elif k == 'river':
            w = o.get('widen')
            # widen 0 = 처음부터 두 칸. make_map_v4 는 `if wide:` 로 보므로 0 을 아주 작은 값으로(조수 시험: 0 이 한 칸이 됐다)
            M4.RIVERS.append(('편집 강 %d' % i, _pts(o['line'], 'line', i, 2), max(float(w), 1e-3) if w is not None else 2, 50 + i))
        elif k == 'forest':
            dens = float(min(1.0, max(0.05, o.get('density', .55))))
            M4.FORESTS.append((_pts(o['poly'], 'poly', i, 3), getattr(M4, FOREST_KIND[o.get('kind', 'broad')]), ('density', dens), 950 + i))
        elif k == 'clear':
            M4.CLEAR.append((_pts(o['poly'], 'poly', i, 3), o.get('what', 'all')))
        elif k == 'plateau':
            M4.PLATEAUS.append((_pts(o['poly'], 'poly', i, 3), int(o.get('level', 1)), g if g is not None else M4.GRASS))
        elif k == 'volcano':
            M4.VOLCANOES.append((float(o['x']) + .5, float(o['y']) + .5))
            if o.get('lava'):
                M4.LAVA_LINES.append(_pts(o['lava'], 'lava', i, 2))
        elif k == 'move_place':
            if o['id'] not in places:
                raise TerrainError('ops[%d]: 장소 %r 이 여정에 없다 (있는 것: %s)' % (i, o['id'], ', '.join(places)))
            places[o['id']]['x'], places[o['id']]['y'] = int(o['x']), int(o['y'])
    return j


def _inside(poly, x, y):
    """칸 가운데 (x+.5, y+.5) 가 다각형 안인가(왜곡 전 좌표)."""
    px, py, hit = x + .5, y + .5, False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


GROUND_NAME = {10: 'grass', 11: 'farm', 27: 'crop', 12: 'savanna', 13: 'sand', 14: 'dune', 15: 'dirt', 16: 'badlands', 17: 'ash',
               18: 'basalt', 19: 'swamp', 20: 'marsh', 21: 'tundra', 22: 'snow', 23: 'glacier', 24: 'jungle', 0: 'sea', 1: 'river'}


def _label(i, o):
    return 'ops[%d](%s%s)' % (i, o['op'], (' 「%s」' % o['note']) if o.get('note') else '')


def coverage(spec, world):
    """작업이 실제로 얼마나 먹었는지 — 숲·바닥 작업이 다각형 대부분에서 안 먹으면 왜 그런지 칸 수로 나눠 알린다.
    조수가 「숲을 놨는데 왜 없냐」「사구를 칠했는데 모래다」를 스스로 알게 한다(조수 역할 시험 2026-10-03)."""
    if not spec:
        return []
    G, O, Hh = world['ground'], world['object'], world['height_level']
    near = set()
    for p in world['places']:
        for y in range(p['y'] - 1, p['y'] + p['h'] + 1):
            for x in range(p['x'] - 1, p['x'] + p['w'] + 1):
                near.add((x, y))
    roads = {tuple(c) for c in world.get('road_cells', [])}
    out = []
    for i, o in enumerate(spec['ops']):
        if o['op'] == 'volcano':
            x0, y0 = int(o['x']), int(o['y'])
            ring = sum(1 for y in range(y0 - 4, y0 + 5) for x in range(x0 - 4, x0 + 5)
                       if 0 <= x < W and 0 <= y < H and O[y][x] == 8)
            if ring < 8:
                out.append('%s: 화산 고리가 %d칸뿐이다 — 둘레 반지름 4칸이 땅이어야 한다(섬이면 rx·ry 4 이상)' % (_label(i, o), ring))
            continue
        if o['op'] == 'island':
            cx, cy = int(round(o['x'])), int(round(o['y']))
            if not (0 <= cx < W and 0 <= cy < H) or G[cy][cx] < 10:
                out.append('%s: 섬 가운데 (%d,%d) 가 땅이 아니다 — 섬이 거의 안 생겼다(rx·ry 를 키워라)' % (_label(i, o), cx, cy))
                continue
            seen, st = {(cx, cy)}, [(cx, cy)]
            while st:
                x, y = st.pop()
                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + a, y + b
                    if 0 <= X < W and 0 <= Y < H and (X, Y) not in seen and G[Y][X] != 0:
                        seen.add((X, Y))
                        st.append((X, Y))
            xs, ys = [c[0] for c in seen], [c[1] for c in seen]
            want = 3.1416 * float(o['rx']) * float(o['ry'])
            box = 'x %d~%d, y %d~%d' % (min(xs), max(xs), min(ys), max(ys))
            if len(seen) > 2.6 * want + 12:
                out.append('%s: 섬이 다른 땅과 붙었다 — 이어진 땅이 %d칸(섬만이면 약 %d칸), 범위 %s. 가운데를 옮기거나 rx·ry 를 줄여 바다 2칸 이상 떼라'
                           % (_label(i, o), len(seen), want, box))
            elif min(xs) <= 1 or min(ys) <= 1 or max(xs) >= W - 2 or max(ys) >= H - 2:
                out.append('%s: 섬이 지도 끝에 닿는다(%s) — 안쪽으로 옮겨라' % (_label(i, o), box))
            continue
        if o['op'] not in ('forest', 'biome'):
            continue
        poly = [tuple(p) for p in o['poly']]
        cells = [(x, y) for y in range(H) for x in range(W) if _inside(poly, x, y)]
        if not cells:
            continue
        if o['op'] == 'biome':
            want = o['ground']
            land_cells = [(x, y) for x, y in cells if G[y][x] >= 10]
            got = sum(1 for x, y in land_cells if GROUND_NAME.get(G[y][x]) == want)
            if land_cells and got < .6 * len(land_cells):
                seen = {}
                for x, y in land_cells:
                    n = GROUND_NAME.get(G[y][x], str(G[y][x]))
                    if n != want:
                        seen[n] = seen.get(n, 0) + 1
                top = ', '.join('%s %d' % kv for kv in sorted(seen.items(), key=lambda kv: -kv[1])[:4])
                if want == 'dune':
                    out.append('%s: 땅 %d칸 중 %d칸만 dune 이 됐다(나머지 %s) — 모래언덕은 여정 장벽 「서남 대사막」(x<40, y 약 52 이상) 안에만 남고 '
                               '다른 곳은 걷는 모래(sand)가 된다. 걸어서 못 가는 사구가 필요하면 그 안에 둬라' % (_label(i, o), len(land_cells), got, top))
                    continue
                out.append('%s: 땅 %d칸 중 %d칸만 %s 이 됐다 — 나머지는 %s. 뒤의 작업(고원 바닥·밭·장소 밑 정리·작은 얼룩 흡수)이 덮었다. '
                           '다각형을 넓히거나 겹치는 plateau 의 ground 를 맞춰라' % (_label(i, o), len(land_cells), got, want, top))
            continue
        why = dict(물=0, 장소둘레=0, 길=0, 산고원=0, 사막=0, 숲=0, 밀도=0)
        for x, y in cells:
            g, ob = G[y][x], O[y][x]
            if ob in (1, 2, 3, 4, 5):
                why['숲'] += 1
            elif g < 10:
                why['물'] += 1
            elif (x, y) in near:
                why['장소둘레'] += 1
            elif (x, y) in roads:
                why['길'] += 1
            elif ob or Hh[y][x] >= 2:
                why['산고원'] += 1
            elif g in (13, 14):
                why['사막'] += 1
            else:
                why['밀도'] += 1
        dens = float(o.get('density', .55))
        blocked = len(cells) - why['숲'] - why['밀도']
        if why['숲'] < .35 * len(cells) and (blocked > why['밀도'] or dens < .8):
            rest = ', '.join('%s %d' % (k, v) for k, v in why.items() if v and k != '숲')
            tip = ' 「밀도」 칸은 density 를 올리면 채워진다(지금 %.2f)' % dens if why['밀도'] and dens < .8 else ''
            out.append('%s: 칸 %d 중 %d칸만 숲이 됐다 — 안 된 칸: %s. 숲은 물·장소 둘레 1칸·길·산·2단 고원에는 안 놓이고, '
                       '사막(sand·dune)에선 지워진다.%s' % (_label(i, o), len(cells), why['숲'], rest, tip))
    return out


# ── 여정 규칙을 조수가 읽을 말로 ──────────────────────────────────────────────
def _act(journey, k):
    a = journey['acts'][k]
    m = journey['means'].get(a['means']) if a.get('means') else None
    return a['name'], (m['name'] if m else '걷기')


def place_rules(journey):
    """장소 id → 한 줄 규칙: 몇 막에 무엇으로 처음 닿아야 하는가, 무엇을 주는가, 처음부터 걸어서 닿으면 안 되는가, 길로 이어진 장소."""
    means_src = {m['source']: (k, m) for k, m in journey['means'].items()}
    entries = {n: k for k, ns in journey.get('entries', {}).items() for n in ns}
    no_walk = set(journey.get('checks', {}).get('must_not_walk', []))
    roads = {}
    for r in journey.get('roads', []):
        roads.setdefault(r['from'], []).append(r['to'])
        roads.setdefault(r['to'], []).append(r['from'])
    out = {}
    for p in journey['places']:
        name, how = _act(journey, p['act'])
        bits = ['%s에 %s(으)로 처음 닿는다' % (name.split(' · ')[0], how)]
        if p['id'] in entries:
            bits.append('%s 타고 내리는 자리' % journey['means'][entries[p['id']]]['name'])
        if p['id'] in means_src:
            k, m = means_src[p['id']]
            bits.append('%s 을(를) 주는 열쇠 장소 — 「%s」 안쪽에 있어야 한다' % (m['name'], journey['acts'][p['act']]['name']))
        if p['id'] in no_walk:
            bits.append('처음부터 걸어서 닿으면 안 된다(장벽 뒤)')
        if roads.get(p['id']):
            bits.append('길: ' + ', '.join(sorted(set(roads[p['id']]))))
        out[p['id']] = ' · '.join(bits)
    return out


def explain(bad, journey):
    """여정 검사 실패 문장(내부 용어) → 조수가 고칠 수 있는 문장."""
    import re
    acts = journey['acts']
    means = journey['means']
    barrier = {b['means']: b for b in journey['barriers']}
    out = []
    for s in bad:
        m = re.match(r'막 불일치: (.+) 설계 (\d+)막 / BFS (\S+)막', s)
        if m:
            n, exp, got = m.group(1), int(m.group(2)) - 1, m.group(3)
            name, how = _act(journey, exp)
            if got == 'None':
                out.append('%s 에 아예 못 닿게 됐다 — %s에 %s(으)로 닿아야 한다. 그 사이 땅·길·고개를 끊지 마라.' % (n, name, how))
            elif int(got) - 1 < exp:
                b = barrier.get(acts[exp]['means'])
                out.append('%s 에 너무 일찍(%s막에) 닿는다 — %s에 %s(으)로 처음 닿아야 한다. %s 뒤에 두고 걸어서 오는 땅·길을 떼라.'
                           % (n, got, name, how, '「%s」(%s)' % (b['name'], b['desc']) if b else '장벽'))
            else:
                out.append('%s 에 너무 늦게(%s막에) 닿는다 — %s에 %s(으)로 닿아야 한다. 앞 막 땅과 길로 이어라.' % (n, got, name, how))
            continue
        m = re.match(r'열쇠 장소 조건: (\w+) → (.+) \(R(\S+)\)', s)
        if m:
            mk, src = m.group(1), m.group(2)
            mm = means.get(mk, {'name': mk, 'act': 0})
            name, how = _act(journey, mm['act'])
            out.append('%s 은(는) %s 을(를) 주는 열쇠 장소라 %s에 %s(으)로 처음 닿아야 한다 — 그 막의 장벽 밖으로 옮기거나 다른 길로 잇지 마라.'
                       % (src, mm['name'], name, how))
            continue
        m = re.match(r'줄거리 구간 끊김: (.+) → (.+)', s)
        if m:
            out.append('줄거리 %s → %s 를 그 막의 수단으로 갈 수 없다 — 둘 사이 땅(또는 배·사막선이 지나는 물·사구)이 끊겼다.' % m.groups())
            continue
        if s.startswith('바다 장벽이 너무 좁다'):
            out.append('서·동 대륙 사이 바다가 너무 좁아졌다(생성 4칸·실제 지리 2칸 이상) — 그 바다에 섬·땅을 놓거나 대륙을 넓히지 마라(배 없이 건너진다).')
            continue
        m = re.match(r'걸어서 처음부터 닿으면 안 되는 곳이 닿는다: (.+)', s)
        if m:
            out.append('%s 에 처음부터 걸어서 닿는다 — 장벽 뒤에 있어야 한다. 시작 땅과 잇는 땅·길을 떼라.' % m.group(1))
            continue
        out.append(s)
    return out
