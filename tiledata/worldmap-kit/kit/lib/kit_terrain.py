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
}
W, H = 96, 72


class TerrainError(ValueError):
    pass


def _pts(v, what, i, n=2):
    if not isinstance(v, list) or len(v) < n or not all(isinstance(p, (list, tuple)) and len(p) == 2 for p in v):
        raise TerrainError('작업 %d: %s 는 [[x,y], ...] 점 %d개 이상' % (i, what, n))
    for x, y in v:
        if not (-4 <= x <= W + 4 and -4 <= y <= H + 4):
            raise TerrainError('작업 %d: 점 (%s,%s) 이 지도(0~%d, 0~%d) 밖이다' % (i, x, y, W - 1, H - 1))
    return [(float(x), float(y)) for x, y in v]


def validate(spec):
    if spec.get('schema') != 'worldmap-terrain/1':
        raise TerrainError('schema 가 worldmap-terrain/1 이 아니다')
    if spec.get('base', 'shared-v9') != 'shared-v9':
        raise TerrainError('base 는 지금 shared-v9 하나뿐이다')
    ops = spec.get('ops', [])
    if not isinstance(ops, list):
        raise TerrainError('ops 는 배열')
    for i, o in enumerate(ops):
        k = o.get('op')
        if k not in OPS:
            raise TerrainError('작업 %d: 모르는 op %r (있는 것: %s)' % (i, k, ', '.join(OPS)))
        need, opt = OPS[k]
        miss = [n for n in need if n not in o]
        if miss:
            raise TerrainError('작업 %d (%s): %s 가 없다' % (i, k, ', '.join(miss)))
        extra = set(o) - set(need) - set(opt) - {'op', 'note'}
        if extra:
            raise TerrainError('작업 %d (%s): 모르는 키 %s' % (i, k, ', '.join(sorted(extra))))
        if 'poly' in o:
            _pts(o['poly'], 'poly', i, 3)
        if 'line' in o:
            _pts(o['line'], 'line', i, 2)
        for g in ('ground',):
            if g in o and o[g] not in GROUNDS:
                raise TerrainError('작업 %d: 바닥 %r 이 없다 (있는 것: %s)' % (i, o[g], ' '.join(GROUNDS)))
        if k == 'forest' and o.get('kind', 'broad') not in FOREST_KIND:
            raise TerrainError('작업 %d: 숲 kind 는 %s' % (i, ' | '.join(FOREST_KIND)))
        if k == 'ridge' and o.get('kind', 'mount') not in RIDGE_KIND:
            raise TerrainError('작업 %d: 산 kind 는 %s' % (i, ' | '.join(RIDGE_KIND)))
        if k == 'clear' and o.get('what', 'all') not in ('forest', 'mount', 'all'):
            raise TerrainError('작업 %d: clear what 은 forest | mount | all' % i)
        if k == 'plateau' and o.get('level', 1) not in (1, 2):
            raise TerrainError('작업 %d: 고원 level 은 1 또는 2' % i)
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
    out = dict(edit)
    out['id'] = '%s+%s' % (base['id'], edit.get('id', 'edit'))
    out['ops'] = list(base.get('ops', [])) + list(edit.get('ops', []))
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
    j = copy.deepcopy(journey)
    places = {p['id']: p for p in j['places']}
    for i, o in enumerate(spec['ops']):
        k = o['op']
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
            M4.RIVERS.append(('편집 강 %d' % i, _pts(o['line'], 'line', i, 2), float(w) if w is not None else 2, 50 + i))
        elif k == 'forest':
            dens = float(min(1.0, max(0.05, o.get('density', .55))))
            M4.FORESTS.append((_pts(o['poly'], 'poly', i, 3), getattr(M4, FOREST_KIND[o.get('kind', 'broad')]), 1 - dens * .75, 950 + i))
        elif k == 'clear':
            M4.CLEAR.append((_pts(o['poly'], 'poly', i, 3), o.get('what', 'all')))
        elif k == 'plateau':
            M4.PLATEAUS.append((_pts(o['poly'], 'poly', i, 3), int(o.get('level', 1)), g if g is not None else M4.GRASS))
        elif k == 'move_place':
            if o['id'] not in places:
                raise TerrainError('작업 %d: 장소 %r 이 여정에 없다 (있는 것: %s)' % (i, o['id'], ', '.join(places)))
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


def coverage(spec, world):
    """작업이 실제로 얼마나 먹었는지 — 숲은 사막·모래언덕·물·길·장소 둘레에 안 자라서, 다각형 대부분이 그런 바닥이면 거의 안 보인다.
    조수가 「숲을 놨는데 왜 없냐」를 스스로 알게 경고 문장으로 돌려준다."""
    if not spec:
        return []
    G, O = world['ground'], world['object']
    out = []
    for i, o in enumerate(spec['ops']):
        if o['op'] != 'forest':
            continue
        poly = [tuple(p) for p in o['poly']]
        cells = [(x, y) for y in range(H) for x in range(W) if _inside(poly, x, y)]
        if not cells:
            continue
        got = sum(1 for x, y in cells if O[y][x] in (1, 2, 3, 4, 5))
        if got < .35 * len(cells):
            seen = {}
            for x, y in cells:
                n = GROUND_NAME.get(G[y][x], str(G[y][x]))
                seen[n] = seen.get(n, 0) + 1
            top = ', '.join('%s %d' % kv for kv in sorted(seen.items(), key=lambda kv: -kv[1])[:4])
            out.append('작업 %d(forest): 칸 %d 중 %d 칸만 숲이 됐다 — 바닥 %s. 숲은 sand·dune·물·길·장소 둘레에는 안 자란다. '
                       '먼저 biome 으로 바닥을 바꾸거나 다각형을 옮겨라' % (i, len(cells), got, top))
    return out
