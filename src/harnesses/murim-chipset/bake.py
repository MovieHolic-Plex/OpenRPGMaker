"""murim-chipset 굽기 — 고른 조각(현재 해시)만 공용 번들 타일셋 murim_wuxia 로 굽는다.

  npm run harness -- murim-chipset bake --prepare-gate   기물 조각 → .tmp/murim-bake/gate/items.jsonl + PNG (object-gate review 입력)
  npm run harness -- murim-chipset bake --dry            .tmp/murim-bake/dry/ 에만 시트·정의·참고문서·장소를 그린다(번들 산출물은 안 쓴다)
  npm run harness -- murim-chipset bake                  실제 굽기 — 기물 조각마다 require_pass(bundle). 하나라도 거절이면 아무것도 쓰지 않는다

산출(손 편집 금지, 다시 구워서 만든다):
  public/assets/murim-wuxia/murim-wuxia-chipset.png (16px, 48열) · src/assets/murimWuxiaTileset.json · src/assets/murimWuxiaSheet.json
  src/assets/murimWuxiaReferences.json + public/assets/murim-wuxia-references/*.png (그림은 경로만 — 바이트 없음)
  tiledata/murim-wuxia/pins.json(자리 키 핀, 덧붙이기 전용) · bake-report.json · examples/<id>.{json,png}
  장소: public/assets/region-references/mur-*.{png,oprn.json} · src/project/regionReferences/mur-*.json · src/project/murimPlaceReferences.ts · regionReferenceSnapshots.ts 로더 줄

게이트(공용 오브젝트 게이트, 계약은 seed bake.gate): 판정은 미리 `npm run harness -- object-gate review --batch items.jsonl` 로 받는다.
이 모듈에는 게이트를 건너뛰는 길이 없다 — 모듈이 없으면 굽지 않고, 영수증이 없거나 pass 가 아니면 ObjectGateRefused 로 멈춘다.
"""
import collections
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import harness as H  # noqa: E402
import tk  # noqa: E402

REPO = tk.REPO
sys.path.insert(0, os.path.join(REPO, 'scripts', 'content', 'jp-city'))
import bake_lib as BL  # noqa: E402  (pc 표·시트·재조립·정의 검사 — jp_city·wizarding 과 같은 보조)

T = 16
TMP = os.path.join(REPO, '.tmp', 'murim-bake')
GATE_DIR = os.path.join(TMP, 'gate')
DRY_DIR = os.path.join(TMP, 'dry')
REL = dict(
    png='public/assets/murim-wuxia/murim-wuxia-chipset.png',
    tileset='src/assets/murimWuxiaTileset.json',
    sheet='src/assets/murimWuxiaSheet.json',
    refs='src/assets/murimWuxiaReferences.json',
    refimg='public/assets/murim-wuxia-references',
    pins='tiledata/murim-wuxia/pins.json',
    report='tiledata/murim-wuxia/bake-report.json',
    examples='tiledata/murim-wuxia/examples',
    region='public/assets/region-references',
    snapdir='src/project/regionReferences',
    placets='src/project/murimPlaceReferences.ts',
    snapts='src/project/regionReferenceSnapshots.ts',
)
WAVE_KO = {'style': '화풍', 'frame': '뼈대', 'inn': '객잔 살림', 'props': '기물', 'dojo': '도장', 'outdoor': '바깥'}
YARD_EDGE = ('nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se', 'inw', 'ine', 'isw', 'ise')
SKIP_KIT_PIECES = {'floor_stone_yard': set(YARD_EDGE) | {'g'}}   # 1칸 가장자리·풀은 오토타일·그룹으로만(키트 없음)


def seed():
    return H.seed()


def BK():
    return seed()['bake']


def slug(item):
    s = item[5:] if item.startswith('prop_') else item
    return s.replace('_', '-')


def kit_id(line, item, piece=None):
    return f"{BK()['prefix']}{line.lower()}-{slug(item)}" + (f'-{piece}' if piece else '')


def is_large(it):
    return it['kind'] == 'object' and it['size'][1] >= 4


# ─────────────────────────────────────────────────────────── 모으기
def collect():
    """(units, missing). unit = 굽는 조각 하나(키트 하나). 고른 것 중 현재 해시와 맞는 것만."""
    s = seed()
    bk = s['bake']
    items = {it['id']: it for it in s['items']}
    order = [it['id'] for it in s['items']]
    ps = H.pick_state()
    sup = bk.get('supersededStyle', {})
    mix = bk.get('styleFloorMix', {})
    lines_ = list(H.lines())
    units, missing = [], []
    have = {(i, l): p for (i, l), (p, st) in ps.items() if st == 'current'}
    for (i, l), (p, st) in ps.items():
        if st != 'current':
            missing.append(dict(item=i, line=l, why=st))
    for line in lines_:
        for iid in order:
            it = items[iid]
            p = have.get((iid, line))
            if not p or iid in sup or p['round'] not in bk['rounds']:
                continue
            common = line == lines_[0] and not any((iid, l2) in have for l2 in lines_[1:])
            _, rendered = H.render_round(p['round'])
            im = rendered[iid][p['letter']][0]
            if tk.image_hash(im) != p['sha256']:
                raise SystemExit(f'{iid} 줄 {line}: 그림 해시가 고른 기록과 다르다 — 굽지 않는다')
            base = dict(line=line, item=iid, round=p['round'], cand=p['letter'], sha=p['sha256'], by=p.get('by', 'user'),
                        common=common, wave=it['wave'])
            if it.get('pieces'):
                for pc in it['pieces']:
                    x, y = pc['at'][0] * T, pc['at'][1] * T
                    crop = im.crop((x, y, x + pc['size'][0] * T, y + pc['size'][1] * T))
                    units.append(dict(base, piece=pc['id'], img=crop, w=pc['size'][0], h=pc['size'][1], kind=pc['kind'],
                                      walk=pc.get('walkGrid'),
                                      gateKind=pc.get('gateKind') or (it.get('gateKind') if pc['kind'] == 'object' else None),
                                      tileable=pc.get('tileable'), title=f"{it['title']} · {pc['title']}"))
            else:
                units.append(dict(base, piece=None, img=im, w=it['size'][0], h=it['size'][1], kind=it['kind'], walk=it.get('walkGrid'),
                                  gateKind=it.get('gateKind') if it['kind'] == 'object' else None, tileable=it.get('tileable'), title=it['title']))
            # 정식 바닥 세트에 style 바닥을 섞어 깔기 변형으로 더한다(같은 줄 style 고른 것, 관문 J 가 @style 이음을 확인했다)
            if iid in mix and (mix[iid], line) in have:
                sp = have[(mix[iid], line)]
                sim = H.render_round(sp['round'])[1][mix[iid]][sp['letter']][0]
                units.append(dict(base, piece='style', round=sp['round'], cand=sp['letter'], sha=sp['sha256'], by=sp.get('by', 'user'),
                                  img=sim, w=2, h=2, kind='tile', walk=None, gateKind=None, tileable='xy',
                                  title=f"{it['title']} · style 판(섞어 깔기)"))
    for u in units:
        u['kit'] = kit_id(u['line'], u['item'], u['piece'])
        u['label'] = f"murim:{u['round']}:{u['item']}:{u['cand']}" + (f":{u['piece']}" if u['piece'] else '')
        u['pixel_sha256'] = tk.image_hash(u['img'])
    return units, missing


def gate_units(units):
    return [u for u in units if u['gateKind']]


# ─────────────────────────────────────────────────────────── 게이트
def gate_module():
    p = os.path.join(REPO, 'src', 'harnesses', '_core')
    if p not in sys.path:
        sys.path.insert(0, p)
    try:
        import object_gate as OG  # type: ignore
        return OG
    except ImportError:
        return None


def safe(label):
    return re.sub(r'[^A-Za-z0-9_.-]+', '_', label)


def prepare_gate():
    """object-gate review --batch 입력을 쓴다. 판정 자체는 하지 않는다."""
    units, missing = collect()
    gu = gate_units(units)
    pdir = os.path.join(GATE_DIR, 'png')
    os.makedirs(pdir, exist_ok=True)
    for f in os.listdir(pdir):
        if f.endswith('.png'):
            os.remove(os.path.join(pdir, f))
    rows = []
    for u in gu:
        path = os.path.join(pdir, safe(u['label']) + '.png')
        u['img'].save(path)
        rows.append(dict(png=path, kind=u['gateKind'], name=f"무림 {H.line_label(u['line'])} · {u['title']}", label=u['label']))
    out = os.path.join(GATE_DIR, 'items.jsonl')
    with open(out, 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    by = collections.Counter(u['gateKind'] for u in gu)
    print(f'게이트 대상 {len(gu)}조각(줄 A {sum(1 for u in gu if u["line"] == "A")} · 줄 B {sum(1 for u in gu if u["line"] == "B")}) → {os.path.relpath(out, REPO)}')
    print('종류별 ' + ' · '.join(f'{k} {v}' for k, v in sorted(by.items())))
    print(f'판정: npm run harness -- object-gate review --batch {os.path.relpath(out, REPO)}')
    if missing:
        print(f'고른 기록이 무효라 빠진 것 {len(missing)}: ' + ', '.join(f"{m['item']}/{m['line']}" for m in missing))
    return 0


def enforce_gate(units):
    """조각마다 require_pass(bundle). 거절 목록을 돌려준다(비었으면 통과). 모듈이 없으면 멈춘다."""
    OG = gate_module()
    if OG is None:
        raise SystemExit('공용 오브젝트 게이트 모듈(src/harnesses/_core/object_gate)이 이 체크아웃에 없다 — 굽지 않는다. '
                         '(--dry 로 미리보기, --prepare-gate 로 판정 입력은 만들 수 있다)')
    refused = []
    for u in gate_units(units):
        if hasattr(OG, 'pixel_sha256') and OG.pixel_sha256(u['img']) != u['pixel_sha256']:
            raise SystemExit(f"{u['label']}: 게이트 해시 정의가 tk.image_hash 와 다르다 — 계약 위반, 굽지 않는다")
        try:
            rc = OG.require_pass(u['img'], kind=u['gateKind'], context='bundle', label=u['label'])
            u['receipt'] = rc if isinstance(rc, (str, int, float)) else (rc.get('id') if isinstance(rc, dict) else str(rc))
        except OG.ObjectGateRefused as e:   # noqa: PERF203
            refused.append(dict(label=u['label'], kit=u['kit'], kind=u['gateKind'], why=str(e)))
    return refused


# ─────────────────────────────────────────────────────────── 칸 나누기
def cell_pc(u, letter, cell):
    a = np.asarray(cell)[:, :, 3]
    if not a.any():
        return None
    opaque = bool((a == 255).all())
    k = u['kind']
    if letter == 'U':
        return 'star'
    if letter in ('F', '.'):
        return 'floor' if opaque else 'flat'
    # X
    if k in ('wall', 'tile'):
        return 'solidfloor' if opaque else 'solid'
    return 'solid'      # 지붕·기물: 위층 막힘(사람과 y 정렬)


def default_walk(u):
    ch = 'F' if u['kind'] == 'tile' else 'X'
    return [ch * u['w']] * u['h']


class Pins:
    """자리 키 → 칸 번호. 앞선 굽기(pins.json)의 번호는 그대로, 새 키는 끝에 덧붙인다(0 번은 빈 칸)."""

    def __init__(self, path):
        prev = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
        self.map = dict(prev.get('cells', {}))
        self.next_id = (max(self.map.values()) + 1) if self.map else 1

    def one(self, key):
        if key not in self.map:
            self.map[key] = self.next_id
            self.next_id += 1
        return self.map[key]


def yard_pick(mask):
    """마당 가장자리 오토타일: 이웃 비트(N1 E2 S4 W8 NE16 SE32 SW64 NW128) → 조각 id. frame_r1.yard_patch 와 같은 고르기."""
    n, e, s_, w = not mask & 1, not mask & 2, not mask & 4, not mask & 8
    if n and w:
        return 'nw'
    if n and e:
        return 'ne'
    if s_ and w:
        return 'sw'
    if s_ and e:
        return 'se'
    if n:
        return 'n'
    if s_:
        return 's'
    if w:
        return 'w'
    if e:
        return 'e'
    if not mask & 128:
        return 'inw'
    if not mask & 16:
        return 'ine'
    if not mask & 64:
        return 'isw'
    if not mask & 32:
        return 'ise'
    return 'c'


# ─────────────────────────────────────────────────────────── 굽기(메모리)
def build(units, pins_path):
    s = seed()
    bk = s['bake']
    items = {it['id']: it for it in s['items']}
    LN = H.lines()
    TPR = bk['tilesPerRow']
    pins = Pins(pins_path)
    img, info, dedupe = {}, {}, {}
    cells_of = {}                      # kit id → {(x, y): (tid, pc)}

    for u in units:
        walk = u['walk'] or default_walk(u)
        it = items[u['item']]
        cells = {}
        for y in range(u['h']):
            for x in range(u['w']):
                crop = BL.norm(u['img'].crop((x * T, y * T, x * T + T, y * T + T)))
                pc = cell_pc(u, walk[y][x], crop)
                if pc is None:
                    continue
                key2 = (crop.tobytes(), pc)
                where = f" ({x + 1},{y + 1})" if u['w'] * u['h'] > 1 else ''
                if key2 in dedupe:
                    tid = dedupe[key2]
                else:
                    tid = pins.one(f"{u['line']}/{u['item']}/{u['piece'] or '_'}/{x}.{y}")
                    dedupe[key2] = tid
                    img[tid] = crop
                    info[tid] = dict(pc=pc, label=f"{LN[u['line']]['name']} · {u['title']}{where}", unit=u,
                                     desc=f"{it['brief'][:220]} — {BL.PCNOTE[pc]}.")
                cells[(x, y)] = (tid, pc)
        cells_of[u['kit']] = cells
        u['cells'] = cells

    count = max(list(img) + [pins.next_id - 1]) + 1
    assert math.ceil(count / TPR) * T <= BL.MAX_H, ('시트 높이 초과', count)
    full = {t: img.get(t) or Image.new('RGBA', (T, T), (0, 0, 0, 0)) for t in range(count)}
    sheet = BL.render_sheet(full, count, TPR)

    # 칸 정의
    SOLID = dict(up=False, down=False, left=False, right=False)
    PASS = dict(up=True, down=True, left=True, right=True)
    passability, priority, terrain, tile_meta = [], [], [], []
    for t in range(count):
        inf = info.get(t)
        if inf is None:
            passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
            tile_meta.append(dict(label='빈 칸', description='빈 칸(번호 고정용) — 쓰지 않는다.', source='bundled-default'))
            continue
        u = inf['unit']
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        it = items[u['item']]
        role = role_of(u, it)
        tags = ['murim', '무림', '무협', f"줄{u['line']}", LN[u['line']]['name'], WAVE_KO.get(u['wave'], u['wave'])]
        if u['common']:
            tags.append('줄 공통')
        if u['gateKind']:
            tags.append('게이트:' + u['gateKind'])
        m = dict(label=inf['label'][:80], description=inf['desc'][:400], role=role, passage=passage, defaultLayer=home, tags=tags,
                 source='bundled-default', confidence='high', repeatability='repeat' if u['tileable'] else 'fixed')
        if inf['pc'] == 'flat':
            m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 붓은 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper':
            m['layerBacking'] = 'none'
        tile_meta.append(m)

    # 키트
    kits = []
    for u in units:
        if u['piece'] in SKIP_KIT_PIECES.get(u['item'], ()):
            continue
        kits.append(make_kit(u, items[u['item']], LN))

    # 오토타일(줄마다 마당 돌 가장자리)
    autos = []
    for line in LN:
        pk = {u['piece']: u for u in units if u['item'] == 'floor_stone_yard' and u['line'] == line}
        if not all(p in pk for p in YARD_EDGE):
            continue
        one = {p: pk[p]['cells'][(0, 0)][0] for p in YARD_EDGE}
        mem = sorted(set(one.values()))
        conn = set(mem)
        for p in ('v1', 'v2', 'style'):
            if p in pk:
                conn |= {t for t, _ in pk[p]['cells'].values()}
        autos.append(dict(id=f"{bk['prefix']}{line.lower()}-yard-stone", name=f"{LN[line]['name']} · 마당 돌바닥(풀 가장자리)", neighborhood=8,
                          memberTileIds=mem, connectTileIds=sorted(conn), variantMap={str(m): one[yard_pick(m)] for m in range(256)},
                          layer='lower', edgeConnects=True))

    groups = make_groups(units, items, LN, bk, priority, tile_meta, autos)
    data = collections.OrderedDict(id=bk['tilesetId'], name=bk['name'], textureKey=bk['textureKey'], family=bk['family'], tileSize=T,
                                   tilesPerRow=TPR, count=count, libraryEnd=count, passability=passability, priority=priority,
                                   terrain=terrain, tileMeta=tile_meta, tileGroups=groups, autotileGroups=autos, animationStrips=[],
                                   structureKits=kits)
    return data, sheet, pins, cells_of


def role_of(u, it):
    if u['kind'] == 'tile':
        return 'terrain'
    if u['kind'] == 'roof':
        return 'roof'
    if u['kind'] == 'wall':
        return 'wall'
    if is_large(it):
        return 'building'
    if u['item'] == 'railing_upper':
        return 'fence'
    return 'prop'


def make_kit(u, it, LN):
    rows = []
    for y in range(u['h']):
        lo, up = [-1] * u['w'], [-1] * u['w']
        for x in range(u['w']):
            if (x, y) in u['cells']:
                t, pc = u['cells'][(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
        rows.append(dict(tiles=lo, upperTiles=up))
    walk = u['walk'] or default_walk(u)
    line_tag = '줄 공통(줄 B 에도 이것을 쓴다)' if u['common'] else LN[u['line']]['name']
    rules = [f"키트 하나로 왼쪽 위 원점에 찍는다(낱칸으로 칠하지 않는다). 칸 통행(위→아래) `{' / '.join(walk)}` — X 막힘 · U 지나감(사람 위) · F 바닥 높이."]
    if u['tileable']:
        rules.append({'x': '가로로 이어 찍어도 이음이 없다.', 'y': '세로로 이어 찍어도 이음이 없다.', 'xy': '가로·세로로 이어 깐다(2×2 주기).'}[u['tileable']])
    if it.get('walkNote') and it.get('walkGrid'):
        rules.append(it['walkNote'])
    if u['item'] == 'door_double':
        rules.append('벽 세트 문 칸(mur-…-wall-inn-set-door)의 문간 두 칸에 얹는다. 문짝(아래 줄)은 막힘 — 이동 이벤트는 문짝 칸, 플레이어는 그 아래 바닥 칸에서 들어간다.')
    ai = dict(description=f"{it['title']} — {it['brief']}"[:400], placementRules=' '.join(rules)[:400],
              tags=['murim', '무림', '무협', H.line_label(u['line']), line_tag, WAVE_KO.get(u['wave'], u['wave'])] + ([f"게이트:{u['gateKind']}"] if u['gateKind'] else []),
              role=role_of(u, it), repeatability='repeat' if u['tileable'] else 'fixed', themes=['무림', '중국 무협'], origin='ai', confidence='high')
    if u['tileable']:
        ai['growthAxis'] = {'x': 'horizontal', 'y': 'vertical', 'xy': 'both'}[u['tileable']]
    if u['kind'] == 'object':
        ai['snap'] = 'wall-north' if u['item'] == 'menu_board' else 'floor'
    kit = dict(id=u['kit'], kind='section', name=f"{u['title']} ({'줄 공통' if u['common'] else '줄 ' + u['line']})", width=u['w'], height=u['h'],
               tileSize=T, rows=rows, learnedFrom='db-authored', ai=ai)
    ent = it.get('entrance')
    if ent and not u['piece']:
        kit['parts'] = [dict(id='door', kind='entrance', dx=ent['dx'], dy=ent['dy'], w=ent['w'], h=ent['h'])]
    return kit


def make_groups(units, items, LN, bk, priority, tile_meta, autos):
    gp = bk['groupPrefix']
    groups = collections.OrderedDict()

    def add(key, name, role, desc, rules, tids):
        g = groups.setdefault(key, dict(id=f'{gp}{key}', name=name, role=role, defaultLayer='lower', tileIds=set(), description=desc, placementRules=rules))
        g['tileIds'] |= set(tids)

    for u in units:
        it = items[u['item']]
        L = u['line'].lower()
        nm = LN[u['line']]['name']
        tids = {t for t, _ in u['cells'].values()}
        if u['item'] == 'floor_wood_inn' and u['piece'] == 'foot':
            add(f'{L}:floor-wood-foot', f'{nm} · 마루 벽 밑 줄(그늘)', 'terrain', '벽 바로 아래 두 줄에 까는 그늘 진 마루.', '벽 아래 두 줄에 2칸 주기로 가로로 이어 깐다(칸 (x%2, y%2) 자리 그림).', tids)
        elif u['item'] == 'floor_wood_inn':
            add(f'{L}:floor-wood', f'{nm} · 객잔 마루', 'terrain', '객잔·실내 나무 마루 2×2 판들(v1·v2·v3·style).', '2×2 판 단위로 섞어 깐다 — 칸 (x,y) 에는 고른 판의 (x%2, y%2) 칸. 같은 판을 가로로 셋 넘게 잇지 않는다.', tids)
        elif u['item'] == 'floor_stone_yard' and u['piece'] == 'g':
            add(f'{L}:grass', f'{nm} · 마당 밖 풀', 'terrain', '마당 돌바닥 바깥 풀(조선 잎 램프).', '마당 바깥을 낱칸으로 채운다.', tids)
        elif u['item'] == 'floor_stone_yard':
            add(f'{L}:yard-stone', f'{nm} · 마당 돌바닥', 'terrain', '마당 돌바닥 안쪽 2×2 판(v1·v2·style)과 가장자리·안쪽 모서리 칸.',
                '가장자리는 오토타일 ' + f"{bk['prefix']}{L}-yard-stone" + ' 로 칠하고(fill_region), 안쪽은 2×2 판을 섞어 덧칠한다.', tids)
        elif u['kind'] == 'wall':
            add(f'{L}:wall', f'{nm} · 객잔 벽·문', 'wall', '벽 세트(왼끝·가운데·창·문 칸·오른끝)와 두 짝 판문.', '벽은 2줄 높이, 왼끝 → 가운데/창/문 칸 → 오른끝 순서로 이어 찍는다(키트).', tids)
        elif u['kind'] == 'roof':
            add(f'{L}:roof', f'{nm} · 기와 지붕', 'roof', '지붕 세트 1칸 조각 9개(용마루·사면·처마 × 왼끝·가운데·오른끝).', '용마루 줄·사면 줄·처마 줄 순서, 가운데를 늘려 3~6칸 폭(키트).', tids)
        elif is_large(it):
            add(f'{L}:large', f'{nm} · 대형 구조(산문·정자·정)', 'building', '여러 칸 대형 구조 — 칸 통행 격자가 섞여 있다.', '키트로만 찍는다. 통행 격자(참고문서 mur-large)를 지킨다.', tids)
        else:
            add(f'{L}:{u["wave"]}', f'{nm} · {WAVE_KO.get(u["wave"], u["wave"])}', 'fence' if u['item'] == 'railing_upper' else 'prop',
                f'{nm} 줄의 {WAVE_KO.get(u["wave"], u["wave"])} 조각 칸 모음.', '여러 칸 기물은 낱칸으로 칠하지 않고 같은 이름의 키트(mur-…)로 찍는다.', tids)
    for a in autos:
        groups['auto:' + a['id']] = dict(id=f"{gp}auto:{a['id']}", name=a['name'], role='terrain', defaultLayer='lower', tileIds=set(a['memberTileIds']),
                                         description='마당 돌바닥 가장자리 오토타일 칸(풀과 닿는 테두리·안쪽 모서리).',
                                         placementRules='오토타일 — 붓·fill_region 이 이웃에 맞는 가장자리 칸을 고른다. 안쪽은 2×2 돌판으로 덧칠해도 이어진다.')
    out = []
    for g in groups.values():
        g['tileIds'] = sorted(g['tileIds'])
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer(g['defaultLayer'], g['tileIds'], priority, tile_meta)
        g.update(source='bundled-default', confidence='high')
        out.append(g)
    return out


def verify(data, sheet, units):
    """정의 검사(BL) + 접두 + 재조립(시트+키트만으로 다시 조립 = 고른 그림)."""
    chk = BL.check_definition(data, data['tilesPerRow'])
    for code in ('group-prefix', 'kit-prefix'):
        chk['by_code'].pop(code, None); chk['examples'].pop(code, None)
    gp, kp = BK()['groupPrefix'], BK()['prefix']
    bad_g = [g['id'] for g in data['tileGroups'] if not g['id'].startswith(gp)]
    bad_k = [k['id'] for k in data['structureKits'] if not k['id'].startswith(kp)] + [a['id'] for a in data['autotileGroups'] if not a['id'].startswith(kp)]
    if bad_g:
        chk['by_code']['mur-group-prefix'] = len(bad_g)
    if bad_k:
        chk['by_code']['mur-kit-prefix'] = len(bad_k)
    chk['violations'] = sum(chk['by_code'].values())
    byid = {u['kit']: u for u in units}
    mism = [k['id'] for k in data['structureKits'] if not BL.same_image(BL.reassemble(k, sheet, data['tilesPerRow']), BL.norm(byid[k['id']]['img']))]
    pal = {tk.hx(c) for c in tk.PAL['allowed']}
    pal.add(tk.SHADOW)
    off = []
    for t in range(data['count']):
        cell = BL.read_cell(sheet, t, data['tilesPerRow'])
        a = np.asarray(cell)
        vis = a[:, :, 3] == 255
        bad = {tuple(int(v) for v in c) for c in a[vis][:, :3]} - pal
        if bad:
            off.append(t)
    return dict(definition=chk, reassembly=dict(kits=len(data['structureKits']), mismatched=len(mism), ids=mism[:20]), palette=dict(cells_off_palette=len(off), ids=off[:20]))


# ─────────────────────────────────────────────────────────── 실행
def run(dry=False):
    units, missing = collect()
    if not units:
        raise SystemExit('고른 것(현재 해시)이 없다')
    gu = gate_units(units)
    root = DRY_DIR if dry else REPO
    pins_path = os.path.join(REPO, REL['pins'])
    data, sheet, pins, cells_of = build(units, pins_path)
    rep = verify(data, sheet, units)
    if rep['definition']['violations'] or rep['reassembly']['mismatched']:
        print(json.dumps(rep, ensure_ascii=False, indent=1)[:3000])
        raise SystemExit('정의 검사·재조립 실패 — 굽지 않는다')

    import bake_docs as D   # noqa: E402  (예제·검사·참고문서·장소)
    ex = D.build_examples(data, sheet, units)
    bad_ex = {e['id']: e['problems'] for e in ex if e['problems']}
    if bad_ex:
        print(json.dumps(bad_ex, ensure_ascii=False, indent=1)[:3000])
        raise SystemExit('예제 구조 검사 실패 — 굽지 않는다')

    refused = []
    if not dry:
        refused = enforce_gate(units)            # 쓰기 전에 전부 — 하나라도 거절이면 아무것도 쓰지 않는다
        if refused:
            os.makedirs(TMP, exist_ok=True)
            json.dump(refused, open(os.path.join(TMP, 'refused.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            for r in refused:
                print(f"  거절 {r['label']} ({r['kind']}) → {r['kit']}: {r['why'][:200]}")
            print(f'게이트 거절 {len(refused)}/{len(gu)} — 아무것도 쓰지 않았다(목록 .tmp/murim-bake/refused.json). 고친 그림은 다시 고르고 다시 판정 받는다.')
            return 1

    def P(k):
        return os.path.join(root, REL[k])
    for k in ('png', 'tileset', 'refs', 'pins'):
        os.makedirs(os.path.dirname(P(k)), exist_ok=True)
    os.makedirs(P('refimg'), exist_ok=True)
    os.makedirs(P('examples'), exist_ok=True)
    sheet.save(P('png'), optimize=True)

    def wr(path, obj, **kw):
        open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P('tileset'), data, separators=(',', ':'))
    wr(P('sheet'), dict(count=data['count'], tilesPerRow=data['tilesPerRow']), separators=(',', ': '))
    wr(P('pins'), dict(version=1, tilesPerRow=data['tilesPerRow'], cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1]))), indent=0)
    for e in ex:
        e['image'].save(os.path.join(P('examples'), e['id'] + '.png'))
        wr(os.path.join(P('examples'), e['id'] + '.json'), {k: v for k, v in e.items() if k not in ('image',)}, separators=(',', ':'))
    refs = D.build_references(data, sheet, units, ex, P('refimg'))
    wr(P('refs'), refs, separators=(',', ':'))
    places = D.publish_places(data, refs, ex, root)

    # 파일에서 다시 읽어 한 번 더
    d2 = json.load(open(P('tileset'), encoding='utf-8'))
    s2 = Image.open(P('png')).convert('RGBA')
    byid = {u['kit']: u for u in units}
    again = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, d2['tilesPerRow']), BL.norm(byid[k['id']]['img'])))
    by_line = collections.Counter((u['line'], 'common' if u['common'] else 'line') for u in units if u['piece'] not in SKIP_KIT_PIECES.get(u['item'], ()))
    report = collections.OrderedDict(
        dry=dry, tiles=dict(count=data['count'], rows=math.ceil(data['count'] / data['tilesPerRow']), sheetPx=list(sheet.size)),
        kits=dict(total=len(data['structureKits']), lineA=by_line[('A', 'line')], lineB=by_line[('B', 'line')], common=by_line[('A', 'common')]),
        autotiles=len(data['autotileGroups']), groups=len(data['tileGroups']),
        gate=dict(units=len(gu), checked=not dry, refused=len(refused), receipts={u['label']: u.get('receipt') for u in gu} if not dry else {}),
        references=dict(categories=len(refs), documents=sum(len(c['documents']) for c in refs), images=sum(len(c['images']) for c in refs)),
        places=[p['id'] for p in places], examples=[dict(id=e['id'], w=e['w'], h=e['h']) for e in ex],
        reassembly_from_files=again, palette=rep['palette'], definition=rep['definition']['by_code'], missingPicks=missing,
        units=[dict(kit=u['kit'], label=u['label'], gateKind=u['gateKind'], sha256=u['pixel_sha256'], by=u['by']) for u in units])
    os.makedirs(os.path.dirname(P('report')), exist_ok=True)
    wr(P('report'), report, indent=1)
    print(f"{'미리보기(.tmp/murim-bake/dry)' if dry else '굽기'}: 칸 {data['count']} ({report['tiles']['rows']}행, 시트 {sheet.size[0]}×{sheet.size[1]}) · "
          f"키트 {report['kits']['total']} (줄 A {report['kits']['lineA']} · 줄 B {report['kits']['lineB']} · 줄 공통 {report['kits']['common']}) · "
          f"오토타일 {report['autotiles']} · 그룹 {report['groups']}")
    print(f"참고문서 용도 {report['references']['categories']} · 문서 {report['references']['documents']} · 그림 {report['references']['images']} · 장소 {len(places)} "
          f"({', '.join(report['places'])}) · 다시 읽어 재조립 불일치 {again} · 팔레트 밖 칸 {rep['palette']['cells_off_palette']}")
    print(f"게이트 대상 {len(gu)}조각 — " + ('미리보기라 판정하지 않았다(실제 굽기는 require_pass 필수)' if dry else f'모두 통과(거절 0)'))
    if missing:
        print(f'고른 기록이 무효라 빠진 것 {len(missing)}: ' + ', '.join(f"{m['item']}/{m['line']}" for m in missing))
    return 0
