#!/usr/bin/env python3
"""월드맵 변형(variant) — 이미 있는 세계 위에 「파멸 후」 같은 큰 변화를 덧씌운다 (2026-10-15).

새 지도를 처음부터 다시 만들면 파멸 전/후가 5% 만 다르거나(감사 FF6 #26), 바닥을 잿빛으로 덮는 순간 여정 도달성 검사가
「너무 일찍 3막에 닿는다」며 거부했다(모래 바다 = 사구 바닥 칸이 장벽이라 바닥을 바꾸면 장벽이 사라진다).
변형은 같은 지형(작업·바탕·배치 번호)을 그대로 짓고, 지형이 다 만들어진 **뒤** 칸 배열(G 바닥·O 물체·Hh 높이)에 아래 작업을 얹는다.

terrain 명세의 최상위 키 `variant` (worldmap-terrain/1 의 선택 확장 — 없으면 기존 동작 그대로):
  { "journey": "free" | "keep",   # free(기본): 막 순서 대신 「모든 장소가 어떤 수단으로든 닿는다」만 검사, 막이 바뀐 장소는 notes 로 알린다
                                    # keep: 설계 막 순서 그대로 — 장벽(사구 바다)은 바닥을 바꾸지 않고 침수에서도 지킨다
    "palette": "ruin",            # 색 표(palettes/<id>) 덮어쓰기 — 지형 변화와 별개로 세계 전체의 색을 바꾼다
    "icon_preset": "ruin",        # 같은 칸 수의 폐허 아이콘으로 바꾼다(fantasy 아이콘 세트)
    "icon_ratio": 0.7,            # 바꿀 장소의 비율 0~1 (기본 0.7)
    "icons": {"장소 id": "아이콘 이름"},   # 장소별 지정(같은 칸 수만)
    "protect_roads": [[x,y], ...],  # 기준 지도의 길 칸 — 침수·균열이 먹지 않는다(길 계획은 장소 사이 땅길이 있어야 선다). 도구가 기준 지도에서 채운다
    "ops": [ ... ] }

작업(구역 mask: poly 다각형 | around {place, r} 장소 둘레 | 없으면 세계 전체):
  flood        depth?, amount?, poly?|around?   해안선이 안으로 들어온다(바다가 올라온다). 장소 발자국 둘레 2칸·길목(장소 사이 땅 연결)은 지킨다
  recolor      to, from?, amount?, poly?|around?  땅 바닥을 to 로 바꾼다(from 생략 = 땅 전부, amount 0~1 = 얼룩 비율). keep 모드에선 사구(장벽)는 안 건드린다
  rift         line, width?                     대지가 갈라져 바다가 들어온다(꺾은선, 폭 1~4). 장소 둘레·길목은 남아 땅 목(다리)이 된다
  convert_forest to, poly?|around?              숲을 다른 숲(dead 고사목 등)으로
  fissure      line, kind(lava|chasm), width?   땅이 갈라진 용암·균열 줄기
  clear        what(forest|mount|all), poly?|around?   물체 치우기
"""
import zlib

import numpy as np
import scipy.ndimage as ndi

GROUND_CONST = {
    'grass': 'GRASS', 'farm': 'FARM', 'crop': 'CROP', 'savanna': 'SAVANNA', 'sand': 'SAND', 'dune': 'DUNE', 'dirt': 'DIRT',
    'badlands': 'BADLANDS', 'ash': 'ASH', 'basalt': 'BASALT', 'swamp': 'SWAMP', 'marsh': 'MARSH', 'tundra': 'TUNDRA', 'snow': 'SNOW',
    'glacier': 'GLACIER', 'jungle': 'JUNGLE',
}
FOREST_CONST = {'broad': 'BROAD', 'conifer': 'CONIFER', 'snow': 'SNOWF', 'jungle': 'JUNGLEF', 'dead': 'DEAD'}
OPS = {
    'flood': ((), ('depth', 'amount', 'poly', 'around', 'seed')),
    'recolor': (('to',), ('from', 'poly', 'around', 'amount', 'seed')),
    'rift': (('line',), ('width', 'seed')),
    'convert_forest': (('to',), ('poly', 'around')),
    'fissure': (('line', 'kind'), ('width', 'seed')),
    'clear': ((), ('what', 'poly', 'around')),
}
JOURNEY_MODES = ('free', 'keep')
VARIANT_KEYS = ('journey', 'palette', 'icon_preset', 'icon_ratio', 'icons', 'protect_roads', 'ops')

# 파멸 후 아이콘 — 같은 칸 수의 사람 선택 아이콘만(새 그림 없음). fantasy 아이콘 세트의 이름.
RUIN_POOL = {
    (2, 2): ('crypt', 'stone_circle', 'desert_colonnade', 'cave_rock'),
    (3, 3): ('castle_dark', 'flame_fortress'),
    (1, 2): ('witch_tower',),
}
# 이야기·지형이 이름으로 부르는 장소는 그림을 바꾸지 않는다
ICON_KEEP = {'대성', '내해 항구', '고갯길 요새', '천공섬', '화산', '거대한 탑', '폐허 도시', '사막 신전', '사막 폐허', '협곡 폐허', '섬 폐허', '고대 돌원'}

MODE = [None]            # 'free' | 'keep' | None(변형 아님) — 여정 검사가 읽는다


class VariantError(ValueError):
    pass


def _check_pts(v, what, i, n):
    if not isinstance(v, list) or len(v) < n or not all(isinstance(p, (list, tuple)) and len(p) == 2 for p in v):
        raise VariantError('variant.ops[%d]: %s 는 [[x,y], ...] 점 %d개 이상' % (i, what, n))


def validate(v):
    """terrain.validate 가 부른다. 모르는 키·잘못된 값은 거절한다(조용히 버리지 않는다)."""
    if not isinstance(v, dict):
        raise VariantError('variant 는 객체')
    extra = set(v) - set(VARIANT_KEYS)
    if extra:
        raise VariantError('variant: 모르는 키 %s (있는 것: %s)' % (', '.join(sorted(extra)), ', '.join(VARIANT_KEYS)))
    if v.get('journey', 'free') not in JOURNEY_MODES:
        raise VariantError('variant.journey 는 free | keep')
    if 'icon_preset' in v and v['icon_preset'] != 'ruin':
        raise VariantError('variant.icon_preset 은 ruin 만 있다')
    if 'icon_ratio' in v and not 0 <= float(v['icon_ratio']) <= 1:
        raise VariantError('variant.icon_ratio 는 0~1')
    if 'protect_roads' in v and not (isinstance(v['protect_roads'], list) and all(isinstance(c, (list, tuple)) and len(c) == 2 for c in v['protect_roads'])):
        raise VariantError('variant.protect_roads 는 [[x,y], ...]')
    if 'icons' in v and not (isinstance(v['icons'], dict) and all(isinstance(k, str) and isinstance(n, str) for k, n in v['icons'].items())):
        raise VariantError('variant.icons 는 {장소 id: 아이콘 이름}')
    ops = v.get('ops', [])
    if not isinstance(ops, list):
        raise VariantError('variant.ops 는 배열')
    for i, o in enumerate(ops):
        k = o.get('op') if isinstance(o, dict) else None
        if k not in OPS:
            raise VariantError('variant.ops[%d]: 모르는 op %r (있는 것: %s)' % (i, k, ', '.join(OPS)))
        need, opt = OPS[k]
        miss = [n for n in need if n not in o]
        if miss:
            raise VariantError('variant.ops[%d] (%s): %s 가 없다' % (i, k, ', '.join(miss)))
        extra = set(o) - set(need) - set(opt) - {'op', 'note'}
        if extra:
            raise VariantError('variant.ops[%d] (%s): 모르는 키 %s' % (i, k, ', '.join(sorted(extra))))
        if 'poly' in o:
            _check_pts(o['poly'], 'poly', i, 3)
        if 'line' in o:
            _check_pts(o['line'], 'line', i, 2)
        if 'around' in o:
            a = o['around']
            if not (isinstance(a, dict) and isinstance(a.get('place'), str) and isinstance(a.get('r'), (int, float)) and a['r'] > 0):
                raise VariantError('variant.ops[%d]: around 는 {place: 장소 id, r: 반지름 칸}' % i)
        if k == 'recolor':
            if o['to'] not in GROUND_CONST:
                raise VariantError('variant.ops[%d]: recolor to %r — 있는 것: %s' % (i, o['to'], ' '.join(GROUND_CONST)))
            bad = [g for g in o.get('from', []) if g not in GROUND_CONST]
            if bad:
                raise VariantError('variant.ops[%d]: recolor from 에 없는 바닥 %s' % (i, ', '.join(map(str, bad))))
        if k == 'convert_forest' and o['to'] not in FOREST_CONST:
            raise VariantError('variant.ops[%d]: convert_forest to 는 %s' % (i, ' | '.join(FOREST_CONST)))
        if k == 'recolor' and 'amount' in o and not 0 < float(o['amount']) <= 1:
            raise VariantError('variant.ops[%d]: recolor amount 는 0 초과 1 이하' % i)
        if k == 'rift' and 'width' in o and not 1 <= int(o['width']) <= 4:
            raise VariantError('variant.ops[%d]: rift width 는 1~4 칸' % i)
        if k == 'fissure' and o['kind'] not in ('lava', 'chasm'):
            raise VariantError('variant.ops[%d]: fissure kind 는 lava | chasm' % i)
        if k == 'clear' and o.get('what', 'all') not in ('forest', 'mount', 'all'):
            raise VariantError('variant.ops[%d]: clear what 은 forest | mount | all' % i)
        if k == 'flood':
            if 'depth' in o and not 1 <= int(o['depth']) <= 8:
                raise VariantError('variant.ops[%d]: flood depth 는 1~8 칸' % i)
            if 'amount' in o and not 0 < float(o['amount']) <= 1:
                raise VariantError('variant.ops[%d]: flood amount 는 0 초과 1 이하' % i)
    return v


def install(variant):
    """kit_terrain.apply 가 부른다 — 변형이 있으면 make_map_v4.build 가 칸 배열을 다 만든 뒤 부를 훅을 건다."""
    import make_map_v4 as M4
    if not variant:
        MODE[0] = None
        M4.VARIANT_HOOK = None
        return
    MODE[0] = variant.get('journey', 'free')
    ops = variant.get('ops', [])
    roads = variant.get('protect_roads', [])
    M4.VARIANT_HOOK = (lambda land, G, O, Hh, icon_cells: _run(ops, MODE[0], land, G, O, Hh, icon_cells, roads)) if ops else None


# ──────────────────────────────── 구역 마스크 ────────────────────────────────
def _mask(M4, o, i, icon_cells):
    H, W = M4.H, M4.W
    if 'poly' in o:
        return M4.polymask([(float(x), float(y)) for x, y in o['poly']], .9, 1200 + i, minsize=1)
    if 'around' in o:
        pl = o['around']['place']
        if pl not in icon_cells:
            raise VariantError('variant.ops[%d]: around 장소 %r 가 없다 (있는 것: %s)' % (i, pl, ', '.join(sorted(icon_cells))))
        x, y, w, h = icon_cells[pl]
        cx, cy, r = x + w / 2.0, y + h / 2.0, float(o['around']['r'])
        ys, xs = np.mgrid[0:H, 0:W]
        n = (M4.vn(4.0, 1300 + i) - .5) * 2.0
        return ((xs + .5 - cx) ** 2 + (ys + .5 - cy) ** 2) <= (r * (1 + .12 * n)) ** 2
    return np.ones((H, W), bool)


ROAD_PROTECT = [None]


def _protect(M4, icon_cells, ring, roads=False):
    H, W = M4.H, M4.W
    p = np.zeros((H, W), bool)
    for (x, y, w, h) in icon_cells.values():
        p[max(y - ring, 0):y + h + ring, max(x - ring, 0):x + w + ring] = True
    if roads and ROAD_PROTECT[0] is not None:
        p |= ROAD_PROTECT[0]
    return p


# ──────────────────────────────── 작업 ────────────────────────────────
def _flood(M4, o, i, mode, land, G, O, Hh, icon_cells):
    depth = int(o.get('depth', 2))
    amount = float(o.get('amount', .8))
    zone = _mask(M4, o, i, icon_cells)
    protect = _protect(M4, icon_cells, 2, roads=True)
    if mode == 'keep':
        protect |= (G == M4.DUNE)
    sea = (G == M4.SEA)
    solid = G >= 1                                       # 강·용암·독늪도 바다에 먹힐 수 있다
    dist = ndi.distance_transform_cdt(~sea, metric='taxicab')   # 바다까지의 칸 거리(바다 칸 0)
    v = M4.vn(3.0, int(o.get('seed', 1400)) + i)
    score = v + .22 * (dist - 1)
    cand = solid & ~sea & zone & ~protect & (dist <= depth) & (score < amount)
    # 먹힌 자리에 낀 한두 칸짜리 섬은 같이 잠긴다(지저분한 점 방지) — 장소가 없는 작은 덩이만
    after = solid & ~cand
    lab, n = ndi.label(after)
    if n:
        sizes = ndi.sum(after, lab, range(1, n + 1))
        for k, s in enumerate(sizes):
            comp = lab == k + 1
            if s < 4 and not (comp & protect).any():
                cand |= comp
    cand = _keep_links(M4, cand, solid, icon_cells)
    G[cand] = M4.SEA
    O[cand] = 0
    Hh[cand] = 0
    land[cand] = False
    return int(cand.sum())


def _keep_links(M4, cand, solid, icon_cells):
    """침수 뒤에도 원래 이어져 있던 장소끼리 땅으로 이어져 있게 — 끊긴 쌍은 원래 땅의 최단 길목을 되돌린다."""
    names = list(icon_cells)
    foot = {n: [(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)] for n, (x, y, w, h) in icon_cells.items()}
    lab0, _ = ndi.label(solid)
    for _ in range(40):
        lab1, _ = ndi.label(solid & ~cand)
        by0 = {}
        for n in names:
            x, y = foot[n][0]
            by0.setdefault(int(lab0[y, x]), []).append(n)
        broken = None
        for comp0, ns in by0.items():
            if comp0 == 0:
                continue
            keys = {}
            for n in ns:
                x, y = foot[n][0]
                keys.setdefault(int(lab1[y, x]), []).append(n)
            if len(keys) > 1:
                ks = list(keys)
                broken = (keys[ks[0]][0], keys[ks[1]][0])
                break
        if broken is None:
            return cand
        a, b = broken
        path = _bfs_path(solid, foot[a][0], set(foot[b]))
        if not path:
            return cand
        for (x, y) in path:
            cand[y, x] = False
    return cand


def _bfs_path(passable, start, goals):
    from collections import deque
    H, W = passable.shape
    prev = {start: None}
    dq = deque([start])
    while dq:
        cur = dq.popleft()
        if cur in goals:
            out = []
            while cur is not None:
                out.append(cur)
                cur = prev[cur]
            return out
        x, y = cur
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and passable[ny, nx] and (nx, ny) not in prev:
                prev[(nx, ny)] = cur
                dq.append((nx, ny))
    return None


def _recolor(M4, o, i, mode, land, G, O, Hh, icon_cells):
    to = getattr(M4, GROUND_CONST[o['to']])
    zone = _mask(M4, o, i, icon_cells)
    if o.get('from'):
        src = np.isin(G, [getattr(M4, GROUND_CONST[g]) for g in o['from']])
    else:
        src = (G >= 10) & (G != M4.CHASM) & (G != M4.CRATER)
    cells = src & zone & land
    if 'amount' in o and float(o['amount']) < 1:
        cells &= M4.vn(3.5, int(o.get('seed', 1600)) + i) < float(o['amount'])      # 덩어리 얼룩 — 칸마다 흩뿌리지 않는다
    if mode == 'keep':
        cells &= (G != M4.DUNE)                          # 장벽(모래 바다)은 바닥을 바꾸면 사라진다
    cells &= ~_protect(M4, icon_cells, 0)                 # 장소 발치 바닥은 장소 정리 단계가 정한다
    G[cells] = to
    if M4.EDIT_GROUND is not None:
        M4.EDIT_GROUND |= cells                           # 지역 팔레트가 이 칸을 다시 덮지 않게
    return int(cells.sum())


def _rift(M4, o, i, mode, land, G, O, Hh, icon_cells):
    pts = [(float(x), float(y)) for x, y in o['line']]
    width = int(o.get('width', 2))
    cand = np.zeros((M4.H, M4.W), bool)
    for (x, y) in M4.river_cells(pts, int(o.get('seed', 1700)) + i, .8):
        if 0 <= x < M4.W and 0 <= y < M4.H:
            cand[y, x] = True
    if width > 1:
        cand = ndi.binary_dilation(cand, iterations=width // 2)
    protect = _protect(M4, icon_cells, 2, roads=True)
    if mode == 'keep':
        protect |= (G == M4.DUNE)
    solid = G >= 1
    cand &= solid & (G != M4.SEA) & ~protect
    cand = _keep_links(M4, cand, solid, icon_cells)
    G[cand] = M4.SEA
    O[cand] = 0
    Hh[cand] = 0
    land[cand] = False
    return int(cand.sum())


def _convert_forest(M4, o, i, mode, land, G, O, Hh, icon_cells):
    import terrain_v4 as V
    zone = _mask(M4, o, i, icon_cells)
    cells = np.isin(O, V.FORESTS) & zone
    O[cells] = getattr(M4, FOREST_CONST[o['to']])
    return int(cells.sum())


def _fissure(M4, o, i, mode, land, G, O, Hh, icon_cells):
    code = M4.LAVA if o['kind'] == 'lava' else M4.CHASM
    pts = [(float(x), float(y)) for x, y in o['line']]
    protect = _protect(M4, icon_cells, 2, roads=True)
    n = 0
    width = int(o.get('width', 1))
    for (x, y) in M4.river_cells(pts, int(o.get('seed', 1500)) + i, .7):
        for dx in range(width):
            xx = x + dx
            if 0 <= xx < M4.W and 0 <= y < M4.H and land[y, xx] and G[y, xx] >= 10 and not protect[y, xx] and not (mode == 'keep' and G[y, xx] == M4.DUNE):
                G[y, xx] = code
                O[y, xx] = 0
                Hh[y, xx] = 0
                n += 1
    return n


def _clear(M4, o, i, mode, land, G, O, Hh, icon_cells):
    import terrain_v4 as V
    zone = _mask(M4, o, i, icon_cells)
    what = o.get('what', 'all')
    kill = {'forest': lambda: np.isin(O, V.FORESTS), 'mount': lambda: np.isin(O, M4.MOUNTS), 'all': lambda: O > 0}[what]()
    cells = kill & zone & ~_protect(M4, icon_cells, 0)
    O[cells] = 0
    return int(cells.sum())


HANDLERS = {'flood': _flood, 'rift': _rift, 'recolor': _recolor, 'convert_forest': _convert_forest, 'fissure': _fissure, 'clear': _clear}


def _run(ops, mode, land, G, O, Hh, icon_cells, roads=()):
    import make_map_v4 as M4
    if roads:
        p = np.zeros((M4.H, M4.W), bool)
        for x, y in roads:
            p[max(y - 1, 0):y + 2, max(x - 1, 0):x + 2] = True      # 길 칸과 한 칸 둘레
        ROAD_PROTECT[0] = p
    for i, o in enumerate(ops):
        try:
            n = HANDLERS[o['op']](M4, o, i, mode, land, G, O, Hh, icon_cells)
        except VariantError as e:
            from kit_common import KitError
            raise KitError('지형 편집: ' + str(e))
        if n == 0:
            M4.WARN.append('variant.ops[%d](%s)%s: 바뀐 칸이 0 — 구역이 바다 위이거나 조건(from·장소 둘레 보호)이 모두 걸러냈다' % (
                i, o['op'], (' 「%s」' % o['note']) if o.get('note') else ''))


# ──────────────────────────────── 아이콘 ────────────────────────────────
def adjust_assign(assign, terrain, journey, iconset):
    """장소→아이콘 배정에 변형의 아이콘 바꾸기를 입힌다. 칸 수(발자국)가 같은 것만 — 지형은 발자국에 맞춰 만들어진다."""
    v = (terrain or {}).get('variant')
    if not v or not (v.get('icon_preset') or v.get('icons')):
        return assign
    import make_map_v4 as M4
    out = dict(assign)
    places = {p['id']: p for p in journey['places']}

    def cells(name):
        return tuple(iconset.icons[name]['cells'])
    if v.get('icon_preset') == 'ruin':
        if iconset.id != 'fantasy':
            M4.WARN.append('variant.icon_preset ruin 은 fantasy 아이콘 세트에서만 쓴다(지금 %s) — 아이콘은 그대로 두었다. icons 로 장소별 지정을 써라' % iconset.id)
        else:
            ratio = float(v.get('icon_ratio', .7))
            for pid, p in sorted(places.items()):
                if pid in ICON_KEEP or p['role'] == 'floating' or zlib.crc32(('ruin:' + pid).encode()) % 100 >= ratio * 100:
                    continue
                pool = [n for n in RUIN_POOL.get(cells(out[pid]), ()) if n in iconset.icons and n != out[pid]]
                if pool:
                    out[pid] = pool[zlib.crc32(pid.encode()) % len(pool)]
    for pid, name in (v.get('icons') or {}).items():
        from kit_common import KitError
        if pid not in places:
            raise KitError('지형 편집: variant.icons 장소 %r 가 여정에 없다 (있는 것: %s)' % (pid, ', '.join(places)))
        if name not in iconset.icons:
            raise KitError('지형 편집: variant.icons 아이콘 %r 이 세트 %s 에 없다' % (name, iconset.id))
        if cells(name) != cells(out[pid]):
            raise KitError('지형 편집: 아이콘 %s(%dx%d)는 장소 %s 의 발자국(%dx%d)과 칸 수가 달라 못 바꾼다' % (name, *cells(name), pid, *cells(out[pid])))
        out[pid] = name
    return out


# ──────────────────────────────── 여정 검사 완화 ────────────────────────────────
# free 모드가 버리는 막 순서 규칙(설계서 정답표 기준). 나머지(비공정으로도 못 닿음·길이 장벽을 지남·줄거리 끊김·첫 화면)는 그대로 지킨다.
FREE_DROP = ('막 불일치', '열쇠 장소 조건', '최종 장소가 R', '산벽 최소 두께', '바다 장벽이 너무 좁다', '걸어서 처음부터 닿으면 안 되는', '첫 화면에 다음 막의 먼 곳')


def relax(bad, world, info):
    """free 모드: 막 순서 불일치는 notes 로 돌리고, 대신 「어떤 수단으로도 안 닿는 장소」를 오류로 센다. 반환 (bad, notes)."""
    import journey_plan_v9 as P
    keep = [b for b in bad if not b.startswith(FREE_DROP)]
    notes = []
    for n in P.PLACES:
        name = n[0]
        st = world.place_stage(name)
        if st is None:
            keep.append('변형 지도: %s 에 어떤 수단(걷기·배·사막선·비공정)으로도 닿지 않는다 — 땅·길이 끊겼다. 침수 amount·depth 를 줄이거나 그 장소 둘레를 구역에서 빼라' % name)
        elif st != P.EXPECT_STAGE.get(name):
            notes.append('%s: 설계 %s막 → 변형 지도 %s막' % (name, P.EXPECT_STAGE.get(name, 0) + 1, st + 1))
    return keep, notes
