"""sky_steam 굽기 — 줄 A(하늘섬)·줄 B(증기 산업도시)의 관문 통과 조각(영수증 PASS·그림 해시 일치)만 모아 공용 타일셋 하나로 굽는다.

  python3 scripts/content/sky-steam/bake_sky.py          # 쓰기
  python3 scripts/content/sky-steam/bake_sky.py --dry    # 보고만

산출: public/assets/sky-steam/sky-steam-chipset.png · src/assets/skySteamTileset.json · src/assets/skySteamSheet.json
      tiledata/sky-steam/pins.json(자리 키 → 칸 번호, 덧붙이기 전용) · tiledata/sky-steam/bake-report.json
칸 분류(pc): floor 걷는 땅(아래층) · solidfloor 막힌 땅(아래층) · solid 막힘(위층) · star 솟은 칸(위층, 걸어 지나감, 사람 위) · flat 투명 바닥 덧그림(위층, 걸음, 사람 밑).
"""
from __future__ import annotations
import argparse, collections, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import sky_a_all  # noqa: F401,E402
import steam_b_all  # noqa: F401,E402
import registry as R  # noqa: E402
import bake_lib as BL  # noqa: E402
from palette import all_colors  # noqa: E402
from sky_a_pack import WALK as A_WALK, walk_mask  # noqa: E402

ROOT = R.REPO
ID, NAME, TEXTURE, FAMILY = 'sky_steam', '하늘섬·증기 도시 (스팀펑크 손 도트)', 'tex_sky_steam', 'oprn-sky-steam'
TPR = 48
T = 16
P = dict(png=os.path.join(ROOT, 'public/assets/sky-steam/sky-steam-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/skySteamTileset.json'),
         sheet=os.path.join(ROOT, 'src/assets/skySteamSheet.json'),
         pins=os.path.join(ROOT, 'tiledata/sky-steam/pins.json'),
         report=os.path.join(ROOT, 'tiledata/sky-steam/bake-report.json'))

# ── 칸 분류 규칙 ──────────────────────────────────────────────────────────────
FILL_PC = {  # 1칸 채움 조각(각 칸이 변형 하나) → pc
    'sky-a-cloud-sea': 'solidfloor', 'sky-a-grass-top': 'floor', 'sky-a-island-edge': 'solidfloor', 'sky-a-cloud-edge': 'solid',
    'steam-t-flag': 'floor', 'steam-t-cobble': 'floor', 'steam-t-yard': 'floor', 'steam-t-grate': 'floor', 'steam-t-floor': 'floor',
}
FILL_NAMES = {
    'sky-a-cloud-sea': ['구름 바다 1', '구름 바다 2', '구름 바다 3', '구름 바다 4'],
    'sky-a-grass-top': ['섬 풀 1', '섬 풀 2', '섬 풀 3', '섬 풀 4'],
    'sky-a-island-edge': ['섬 절벽 앞면 왼끝', '섬 절벽 앞면 가운데', '섬 절벽 앞면 오른끝'],
    'sky-a-cloud-edge': ['구름 바다 위 가장자리 1', '구름 바다 위 가장자리 2', '구름 바다 위 가장자리 3'],
    'steam-t-flag': ['보도 판석 1', '보도 판석 2', '보도 판석 3', '보도 판석 4'],
    'steam-t-cobble': ['자갈 차도 1', '자갈 차도 2', '자갈 차도 3', '자갈 차도 4'],
    'steam-t-yard': ['공장 마당 흙·석탄재 1', '공장 마당 2', '공장 마당 3', '공장 마당 4'],
    'steam-t-grate': ['쇠 격자 바닥 1', '쇠 격자 바닥 2', '증기 새는 격자'],
    'steam-t-floor': ['판자 바닥 1', '판자 바닥 2', '강판 바닥 1', '강판 바닥 2', '바둑 타일 1', '바둑 타일 2'],
}
BLOB = {'steam-at-cobble': ('floor', 'lower'), 'steam-at-yard': ('floor', 'lower'), 'steam-at-brickpave': ('floor', 'lower'), 'steam-at-deck': ('deck', 'lower'), 'steam-at-ceiling': ('solidfloor', 'lower')}
FOUR = {'steam-at-rail': ('floor', 'lower'), 'steam-at-tramrail': ('floor', 'lower'), 'steam-at-pipe': ('solid', 'upper')}
WALL = 'steam-t-wall'
WALL_NAMES = ['벽돌 벽(민)', '벽돌 벽(관 2줄)', '벽돌 벽(작은 창)', '강판 벽(민)', '강판 벽(관 2줄)', '강판 벽(계기판)', '벽지 벽(민)', '벽지 벽(작은 창)', '벽지 벽(계기판)']
WALL_IDS = ['steam-wall-brick', 'steam-wall-brick-pipes', 'steam-wall-brick-window', 'steam-wall-plate', 'steam-wall-plate-pipes', 'steam-wall-plate-gauge',
            'steam-wall-paper', 'steam-wall-paper-window', 'steam-wall-paper-gauge']
PLATFORM_B = {'steam-dock-deck'}       # 막힘 칸 밖의 불투명 칸 = 걷는 갑판
ISLAND_A = {p for p in ('sky-a-island-s', 'sky-a-island-m', 'sky-a-rock-root')}
SEATS = ('seat',)
GROUND_KINDS = ('flat', 'debris')

CATEGORY = [  # (조건, 그룹 키, 이름, 역할)
    (lambda p: p['line'] == 'A' and (p['id'] in ISLAND_A or p['id'] in A_WALK), 'A:island', '하늘섬 · 섬·다리·부두', 'terrain'),
    (lambda p: p['line'] == 'A' and p['kind'] == 'structure', 'A:building', '하늘섬 · 건물·탑·비공정', 'building'),
    (lambda p: p['line'] == 'A', 'A:prop', '하늘섬 · 소품·구름 덧그림', 'prop'),
    (lambda p: p['id'].startswith('steam-i-'), 'B:interior', '증기 도시 · 실내 기물(공방·보일러실·기관실·연구소·여관)', 'prop'),
    (lambda p: p['id'] in ('steam-mooring-mast', 'steam-dock-deck', 'steam-gantry-crane', 'steam-dock-crane', 'steam-hangar', 'steam-fuel-pump', 'steam-winch'), 'B:dock', '증기 도시 · 비공정 부두', 'building'),
    (lambda p: p['id'] in ('steam-tram', 'steam-locomotive', 'steam-coal-wagon', 'steam-carriage'), 'B:vehicle', '증기 도시 · 탈것(전차·기관차·화차·마차)', 'prop'),
    (lambda p: p['kind'] == 'structure', 'B:building', '증기 도시 · 건물(공장·보일러동·탑·공동주택·역)', 'building'),
    (lambda p: p['frames'] > 1, 'B:anim', '증기 도시 · 움직이는 기물(증기·톱니·화로·피스톤)', 'prop'),
    (lambda p: True, 'B:prop', '증기 도시 · 거리·마당 소품', 'prop'),
]


def category(p):
    for cond, key, name, role in CATEGORY:
        if cond(p): return key, name, role


def canon(m):
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    out = m & 15
    if n and e and m & 16: out |= 16
    if s and e and m & 32: out |= 32
    if s and w and m & 64: out |= 64
    if n and w and m & 128: out |= 128
    return out


def blob_tile(patch, icorner, m):
    """wzlib.blob_tile 과 같은 사분면 합성(N1 E2 S4 W8 NE16 SE32 SW64 NW128)."""
    out = np.zeros((16, 16, 4), np.uint8)
    N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    for (qx, qy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
        vert = N if qy == 0 else S
        hor = W if qx == 0 else E
        diag = {(0, 0): m & 128, (1, 0): m & 16, (0, 1): m & 64, (1, 1): m & 32}[(qx, qy)]
        if vert and hor and diag: src, sx, sy = patch, 16 + qx * 8, 16 + qy * 8
        elif vert and hor: src, sx, sy = icorner, qx * 8, qy * 8
        elif hor: src, sx, sy = patch, 16 + qx * 8, (0 if qy == 0 else 32) + qy * 8
        elif vert: src, sx, sy = patch, (0 if qx == 0 else 32) + qx * 8, 16 + qy * 8
        else: src, sx, sy = patch, (0 if qx == 0 else 32) + qx * 8, (0 if qy == 0 else 32) + qy * 8
        out[qy * 8:qy * 8 + 8, qx * 8:qx * 8 + 8] = src[sy:sy + 8, sx:sx + 8]
    return out


def opacity(cell):
    a = np.asarray(cell)[:, :, 3]
    return (a > 0).mean()


class Pins:
    def __init__(self, path):
        prev = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
        self.map = dict(prev.get('cells', {})); self.strips = dict(prev.get('strips', {}))
        used = list(self.map.values()) + [b + n - 1 for b, n in self.strips.values()]
        self.next_id = max(used) + 1 if used else 1          # 0 번은 빈 칸
        self.used = set()

    def one(self, key):
        self.used.add(key)
        if key not in self.map: self.map[key] = self.next_id; self.next_id += 1
        return self.map[key]

    def block(self, key, n):
        self.used.add(key)
        if key in self.strips and self.strips[key][1] == n: return self.strips[key][0]
        if self.next_id % TPR + n > TPR: self.next_id += TPR - self.next_id % TPR
        self.strips[key] = [self.next_id, n]; self.next_id += n
        return self.strips[key][0]


def cell_pc(p, x, y, cell, walk):
    """조각 칸 하나의 pc. 빈 칸(완전 투명)은 None."""
    op = opacity(cell)
    if op == 0: return None
    solid = (x, y) in {tuple(s) for s in p['solid']}
    if p['id'] in ISLAND_A or p['id'] in A_WALK or p['id'] in PLATFORM_B:
        walks = ((x, y) in walk) if walk is not None else (not solid)
        if walks: return 'floor' if op == 1 else 'flat'
        return 'solidfloor' if op == 1 else 'solid'
    if p['kind'] in GROUND_KINDS: return 'flat'
    if p['kind'] in SEATS: return 'solid'
    return 'solid' if solid else 'star'


def bake(dry=False):
    pieces = [p for p in list(R.pieces_of('A')) + list(R.pieces_of('B'))]
    adopted, rejected = [], []
    for p in pieces:
        st = R.status_of(p)
        (adopted if st == 'pass' else rejected).append(p if st == 'pass' else dict(id=p['id'], status=st))
    pins = Pins(P['pins'])
    img, info = {}, {}
    dedupe = {}
    strips, kits, autos = [], [], []
    groups = collections.OrderedDict()
    kit_cells = {}                   # kit id → {(x,y): (tid, pc)}  (예제·검사용)

    def put(key, im, pc, meta, unique=False):
        im = BL.norm(im)
        k2 = (im.tobytes(), pc)
        if k2 in dedupe and not unique: return dedupe[k2]
        tid = pins.one(key)
        img[tid] = im; info[tid] = dict(meta, pc=pc); dedupe.setdefault(k2, tid)
        return tid

    def group(key, name, role, desc, rules, layer='upper'):
        if key not in groups:
            groups[key] = dict(id=f'sky:{key}', name=name, role=role, defaultLayer=layer, tileIds=set(), description=desc, placementRules=rules)
        return groups[key]

    def add_kit(kid, name, w, h, cells, desc, rules, tags, role, snap=None, frames=1):
        rows = []
        for y in range(h):
            lo = [-1] * w; up = [-1] * w
            for x in range(w):
                if (x, y) not in cells: continue
                t, pc = cells[(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(description=desc[:400], placementRules=rules[:400], tags=tags, role=role, repeatability='fixed', layerHome='upper',
                  themes=['스팀펑크', '하늘섬' if kid.startswith('sky-a-') else '증기 도시'], origin='ai', confidence='high')
        if snap: ai['snap'] = snap; ai['anchor'] = dict(dx=w // 2, dy=h - 1)
        if frames > 1: ai['tags'] = ai['tags'] + [f'애니메이션 {frames}프레임']
        kits.append(dict(id=kid, kind='section', name=name, width=w, height=h, tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai))
        kit_cells[kid] = cells

    line_ko = {'A': '하늘섬', 'B': '증기 도시'}
    for p in adopted:
        pid = p['id']; lk = line_ko[p['line']]
        frames = [R.render(p, f) for f in range(p['frames'])]
        f0 = frames[0]
        crop = lambda im, x, y: im.crop((x * T, y * T, x * T + T, y * T + T))
        base_tags = ['sky_steam', lk] + list(p['tags'])

        if pid in FILL_PC:
            pc = FILL_PC[pid]
            g = group('fill:' + pid, p['name'], 'water' if pid == 'sky-a-cloud-sea' else 'terrain', f"{lk} 채움 칸: {p['name']} — 변형 {p['w']}종(16px 주기, 이음새 없음).",
                      '낱칸으로 이어 칠한다. 변형은 (x+y) 같은 결정 규칙으로 섞고 한 영역에 한 재질만 쓴다.', layer='lower' if pc in BL.LOWER_PC else 'upper')
            for x in range(p['w']):
                nm = FILL_NAMES.get(pid, [p['name']] * p['w'])[x]
                tid = put(f'{pid}/{x}.0', crop(f0, x, 0), pc, dict(label=nm, desc=f"{p['name']} 변형 {x + 1} — {BL.PCNOTE[pc]}.", role='terrain', tags=base_tags, rep='repeat'))
                g['tileIds'].add(tid)
                kit_cells.setdefault(pid, {})[(x, 0)] = (tid, pc)
            continue

        if pid == WALL:
            g = group('B:wall', '증기 도시 · 실내 벽(천장 테 + 벽 앞면 2칸)', 'wall', '실내 벽 1×3 키트 9종: 맨 위 = 천장 테(위에서 본 벽 윗면), 아래 두 칸 = 벽 앞면(재질·관·창·계기).',
                      '방 북쪽 벽은 키트를 가로로 이어 찍는다(천장 줄 y0, 벽 앞면 y0+1·y0+2). 맨 아래 벽 칸 바로 밑이 방 바닥 첫 줄. 동·서·남 벽은 천장 줄 칸만 이어 테두리를 두른다.', layer='lower')
            for k in range(9):
                cells = {}
                for y in range(3):
                    tid = put(f'{pid}/{k}.{y}', crop(f0, k, y), 'solidfloor', dict(label=f"{WALL_NAMES[k]} {('천장 테', '벽 위', '벽 아래')[y]}",
                              desc=f"실내 벽 {WALL_NAMES[k]} — {('천장 테(벽 윗면)', '벽 앞면 위 칸', '벽 앞면 아래 칸(걸레받이)')[y]}. {BL.PCNOTE['solidfloor']}.", role='wall', tags=base_tags + ['벽'], rep='repeat'))
                    cells[(0, y)] = (tid, 'solidfloor'); g['tileIds'].add(tid)
                add_kit(WALL_IDS[k], WALL_NAMES[k], 1, 3, cells, f'실내 북벽 한 칸 폭: 천장 테 + 벽 앞면 2칸 ({WALL_NAMES[k]}).',
                        '방 북쪽 끝에서 가로로 이어 찍는다. 같은 방은 같은 재질, 변형(관·창·계기)은 3~5칸마다 하나.', base_tags + ['벽'], 'wall')
            continue

        if pid in BLOB:
            mode, layer = BLOB[pid]
            src = np.asarray(f0)
            patch, ic = src[:, :48], src[:16, 48:64]
            masks = sorted({canon(m) for m in range(256)})
            tid_of = {}
            g = group('auto:' + pid, p['name'], 'terrain', f"{lk} 8방 오토타일 47칸: {p['name']}.", '붓·fill_region 이 이웃(8방)에 맞는 칸을 고른다. 낱칸 번호로 칠하지 않는다.', layer=layer)
            for m in masks:
                t = Image.fromarray(blob_tile(patch, ic, m), 'RGBA')
                # 갑판(아래층 불투명, 바깥 모서리 = 구름): 남쪽 이웃이 없는 칸은 앞 거더 면이 보이는 가장자리 → 막힌 땅. 나머지는 걷는 땅.
                pc = ('solidfloor' if not (m & 4) else 'floor') if mode == 'deck' else mode
                tid_of[m] = put(f'{pid}/m{m}', t, pc, dict(label=f"{p['name']} (이웃 {m})", desc=f"{p['name']} 오토타일 칸(이웃 마스크 {m}) — {BL.PCNOTE[pc]}.",
                                                               role='terrain', tags=base_tags + ['autotile'], rep='auto'), unique=True)
            mem = sorted(set(tid_of.values())); g['tileIds'] |= set(mem)
            autos.append(dict(id=pid, name=p['name'], neighborhood=8, memberTileIds=mem, connectTileIds=mem,
                              variantMap={str(m): tid_of[canon(m)] for m in range(256)}, layer=layer, edgeConnects=True))
            kit_cells[pid] = {(0, 0): (tid_of[255], info[tid_of[255]]['pc'])}
            continue

        if pid in FOUR:
            pc, layer = FOUR[pid]
            g = group('auto:' + pid, p['name'], 'terrain', f"{lk} 4방 오토타일 16칸: {p['name']}.", '붓·lay_path 가 이웃(상하좌우)에 맞는 칸을 고른다. 낱칸 번호로 칠하지 않는다.', layer=layer)
            tid_of = {}
            for m in range(16):
                tid_of[m] = put(f'{pid}/m{m}', crop(f0, m % 4, m // 4), pc, dict(label=f"{p['name']} (이웃 {m})", desc=f"{p['name']} 4방 오토타일 칸(N1 E2 S4 W8 마스크 {m}) — {BL.PCNOTE[pc]}.",
                                                                                 role='terrain', tags=base_tags + ['autotile'], rep='auto'), unique=True)
            mem = sorted(set(tid_of.values())); g['tileIds'] |= set(mem)
            autos.append(dict(id=pid, name=p['name'], neighborhood=4, memberTileIds=mem, connectTileIds=mem,
                              variantMap={str(m): tid_of[m] for m in range(16)}, layer=layer, edgeConnects=True))
            kit_cells[pid] = {(0, 0): (tid_of[15], pc)}
            continue

        # 일반 조각 → 키트
        walk = None
        if pid in A_WALK: walk = {tuple(w) for w in A_WALK[pid]}
        elif pid in ISLAND_A: walk = {tuple(w) for w in walk_mask(f0, ('grass',))}
        ck, cname, crole = category(p)
        g = group(ck, cname, crole, f'{cname} 조각 칸 모음.', '다칸 조각은 낱칸으로 칠하지 않고 같은 id 의 키트(kit:sky_steam/<id>)로 찍는다.')
        cells = {}
        for y in range(p['h']):
            for x in range(p['w']):
                pc = None
                for fr in frames:
                    q = cell_pc(p, x, y, crop(fr, x, y), walk)
                    if q: pc = pc or q
                if pc is None: continue
                where = f" ({x + 1},{y + 1})" if p['w'] * p['h'] > 1 else ''
                meta = dict(label=f"{p['name']}{where}", desc=f"{p['name']} — {BL.PCNOTE[pc]}.", role=crole, tags=base_tags + [p['kind']], rep='fixed')
                if p['frames'] > 1:
                    base = pins.block(f'{pid}/{x}.{y}', p['frames'])
                    for f in range(p['frames']):
                        img[base + f] = BL.norm(crop(frames[f], x, y)); info[base + f] = dict(meta, pc=pc, label=f"{meta['label']} · {f + 1}/{p['frames']}프레임")
                    strips.append(dict(baseTile=base, frames=p['frames'], fps=6))
                    cells[(x, y)] = (base, pc); g['tileIds'] |= {base + f for f in range(p['frames'])}
                else:
                    tid = put(f'{pid}/{x}.{y}', crop(f0, x, y), pc, meta)
                    cells[(x, y)] = (tid, pc); g['tileIds'].add(tid)
        snap = 'wall-north' if p['kind'] == 'wall_mounted' else ('floor' if p['kind'] not in ('structure', 'terrain') else None)
        nsolid = len(p['solid'])
        rules = ('키트 하나로 찍는다(낱칸 금지). 왼쪽 위가 원점(dx 0, dy 0). '
                 + (f"막힘 칸 {nsolid}개(그림 아래쪽 줄), 그 위 칸은 사람이 뒤로 지나가는 위층(★). " if nsolid else '막힘 칸 없음(위층 덧그림). ')
                 + ('문 앞(맨 아래 줄 바로 아래 칸)은 비워 길과 잇는다. ' if p['kind'] == 'structure' and 'vehicle' not in p['tags'] else '')
                 + ('벽 앞면 칸 위에만 붙인다. ' if p['kind'] == 'wall_mounted' else ''))
        add_kit(pid, p['name'], p['w'], p['h'], cells, f"{lk} {p['name']} ({p['w']}×{p['h']}칸, {p['kind']}).", rules, base_tags + [p['kind']], crole if crole in BL.ENUM['krole'] else 'prop',
                snap=snap, frames=p['frames'])

    count = max(list(img) + [0, pins.next_id - 1]) + 1
    assert math.ceil(count / TPR) * T <= BL.MAX_H, ('시트 높이 초과', count)
    for t in range(count):
        if t not in img: img[t] = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    sheet = BL.render_sheet(img, count, TPR)

    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    passability, priority, terrain, tile_meta = [], [], [], []
    for t in range(count):
        inf = info.get(t)
        if inf is None:
            passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
            tile_meta.append(dict(label='빈 칸', description='빈 칸(번호 고정·애니메이션 행 맞춤용) — 쓰지 않는다.', source='bundled-default')); continue
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        m = dict(label=inf['label'][:80], description=inf['desc'][:400], role=inf['role'] if inf['role'] in BL.ENUM['grole'] else 'prop', passage=passage, defaultLayer=home,
                 tags=list(dict.fromkeys(inf['tags'])), source='bundled-default', confidence='high', repeatability=inf['rep'])
        if inf['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': m['layerBacking'] = 'none'
        tile_meta.append(m)

    tile_groups = []
    for g in groups.values():
        g['tileIds'] = sorted(g['tileIds'])
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer(g['defaultLayer'], g['tileIds'], priority, tile_meta)
        g.update(source='bundled-default', confidence='high')
        tile_groups.append(g)
    data = collections.OrderedDict(id=ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=T, tilesPerRow=TPR, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta, tileGroups=tile_groups,
                                   autotileGroups=autos, animationStrips=sorted(strips, key=lambda s: s['baseTile']), structureKits=kits)

    rep = collections.OrderedDict()
    chk = BL.check_definition(data, TPR)
    for code in ('group-prefix', 'kit-prefix'): chk['by_code'].pop(code, None); chk['examples'].pop(code, None)
    chk['violations'] = sum(chk['by_code'].values()); rep['definition'] = chk
    expected = {}
    for k in kits:
        if k['id'] in WALL_IDS:
            i = WALL_IDS.index(k['id']); expected[k['id']] = BL.norm(R.render(R.PIECES[WALL]).crop((i * T, 0, i * T + T, 3 * T)))
        else: expected[k['id']] = BL.norm(R.render(R.PIECES[k['id']], 0))
    mism = [k['id'] for k in kits if not BL.same_image(BL.reassemble(k, sheet, TPR), expected[k['id']])]
    rep['reassembly'] = dict(kits=len(kits), mismatched=len(mism), ids=mism[:20])
    pal = {tuple(c[:3]) for c in all_colors()}
    rep['palette'] = dict(cells_off_palette=sum(1 for t in range(count) if BL.off_palette(img[t], pal)))
    rep['tiles'] = dict(count=count, rows=math.ceil(count / TPR), sheetPx=[TPR * T, math.ceil(count / TPR) * T], strips=len(strips), kits=len(kits),
                        groups=len(tile_groups), autotiles=len(autos))
    rep['adopted'] = dict(A=sum(p['line'] == 'A' for p in adopted), B=sum(p['line'] == 'B' for p in adopted))
    rep['rejected'] = rejected
    out = dict(data=data, sheet=sheet, report=rep, kit_cells=kit_cells)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    wr(P['pins'], dict(version=1, tilesPerRow=TPR, cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1])), strips=pins.strips), indent=0)
    d2 = json.load(open(P['tileset'], encoding='utf-8')); s2 = Image.open(P['png']).convert('RGBA')
    rep['reassembly_from_files'] = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, TPR), expected[k['id']]))
    wr(P['report'], rep, indent=1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'adopted', 'reassembly', 'palette')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'] if r['definition']['violations'] else '')
    print('거절', r['rejected'], '파일 재조립 불일치', r.get('reassembly_from_files'))
