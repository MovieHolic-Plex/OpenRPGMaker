#!/usr/bin/env python3
"""pirate_isles 굽기 — object-gate 를 통과한(영수증 화소 해시 일치) 조각만 모아 공용 번들 타일셋을 쓴다.

    python3 pi_bake.py          # 쓰기
    python3 pi_bake.py --dry    # 보고만

산출: public/assets/pirate-isles/pirate-isles-chipset.png · src/assets/pirateIslesTileset.json · src/assets/pirateIslesSheet.json
      tiledata/pirate-isles/pins.json(자리 키 핀, 덧붙이기 전용) · tiledata/pirate-isles/bake-report.json
      tiledata/pirate-isles/pieces.json (검수 장면용: 조각 id → 칸 번호 격자·문·접근칸·통행, 오토타일 id → 마스크 표)
칸 통행 종류(pc) = jp_city bake_lib 표: floor · solidfloor · flat · solid · star.
  terrain: 걷는 바닥 = floor, 물·벽 천장·벽 앞면·성벽 윗면 = solidfloor.  debris/flat 조각 = flat(투명 덧그림, 걷는다).
  wall_mounted = solid(벽 앞면 위).  그 밖: solid 목록 칸 solid, 나머지 그림 칸 star(사람 위에 그려지고 아래층 통행을 따른다).
"""
import argparse, collections, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import pi_all  # noqa: E402,F401  (모든 조각 모듈을 불러온다)
import pi_core as C  # noqa: E402
import pi_terrain as TR  # noqa: E402
import bake_lib as BL  # noqa: E402

ROOT = C.ROOT
ID, NAME, TEXTURE, FAMILY = 'pirate_isles', '열대 군도·해적 항구 (손 도트)', 'tex_pirate_isles', 'oprn-pirate'
TPR = 48
P = dict(png=os.path.join(ROOT, 'public/assets/pirate-isles/pirate-isles-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/pirateIslesTileset.json'), sheet=os.path.join(ROOT, 'src/assets/pirateIslesSheet.json'),
         pieces=os.path.join(C.OUT, 'pieces.json'),
         pins=os.path.join(C.OUT, 'pins.json'), report=os.path.join(C.OUT, 'bake-report.json'))
GROUP_KO = dict(terrain='바닥·물·해안', nature='자연', buildings='건물', props='소품', boats='배', interior='실내 가구', anim='움직임')
BLOCK_TERRAIN = ('water', 'deepwater', 'at-deep', 'at-fortwall', 'at-wall-', 'wall-face-')
FLAT_KINDS = ('debris', 'flat')

# 오토타일 이음(문자 대신 조각 id): 이 조각들의 칸을 이웃으로 센다(멤버는 자동 포함)
LANDISH = ['sand', 'grass', 'cobble', 'rockfloor', 'deck', 'at-beach', 'at-grass', 'at-path', 'at-sandpath', 'at-quay', 'at-boardwalk', 'at-fortwall']
CONNECT = {
    'at-beach': LANDISH,
    'at-grass': ['grass', 'cobble', 'rockfloor', 'at-path', 'at-sandpath', 'at-quay', 'at-fortwall', 'at-boardwalk'],
    'at-deep': ['deepwater'],
    'at-path': ['sand', 'cobble', 'at-beach', 'at-sandpath', 'at-quay'],
    'at-sandpath': ['sand', 'cobble', 'at-beach', 'at-path', 'at-quay'],
    'at-quay': ['sand', 'grass', 'cobble', 'rockfloor', 'deck', 'at-beach', 'at-grass', 'at-path', 'at-sandpath', 'at-fortwall', 'at-boardwalk'],
    'at-boardwalk': ['sand', 'grass', 'cobble', 'deck', 'at-beach', 'at-grass', 'at-quay', 'at-sandpath'],
    'at-fortwall': [],
}


def role_of(p):
    k, g = p['kind'], p['group']
    if k == 'terrain':
        if p['id'].startswith(('at-wall-', 'wall-face-', 'at-fortwall')): return 'wall'
        if p['id'] in ('water', 'deepwater', 'at-deep'): return 'water'
        return 'terrain'
    if g == 'buildings': return 'building'
    if p['id'] in ('fence', 'fence-bamboo', 'palisade'): return 'fence'
    return 'prop'


def cell_pcs(p, a):
    out = {}
    solid = set(map(tuple, p['solid']))
    for y in range(p['h']):
        for x in range(p['w']):
            al = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16, 3]
            if al.max() == 0: continue
            opaque = al.min() == 255
            k = p['kind']
            if k == 'terrain': pc = 'solidfloor' if p['id'].startswith(BLOCK_TERRAIN) else ('floor' if opaque else 'flat')
            elif k in FLAT_KINDS: pc = 'flat'
            elif k == 'wall_mounted': pc = 'solid'
            else: pc = 'solid' if (x, y) in solid else 'star'
            out[(x, y)] = pc
    return out


def placement_rule(p):
    k = p['kind']
    if k == 'wall_mounted': return '실내 벽 앞면(wall-face-*) 칸 위에 얹는다. 바닥에 두지 않는다.'
    if k in FLAT_KINDS: return '바닥 위 덧그림 — 걷는다. 길·문 앞에는 두지 않고 벽·기물 곁에 모아 둔다.'
    if role_of(p) == 'building':
        return ('건물 키트를 통째로 찍는다. 문 칸은 막히고 바로 아래(접근칸)는 길·포석으로 비운다. 건물 밑 땅은 한 재질(마을 = 모래길·포석). '
                '이웃 건물·나무와 1칸 이상 띄우고, 문 앞 2칸에는 소품을 두지 않는다.')
    if 'water' in p['tags'] or '물' in p['tags']: return '물(얕은 물·깊은 물) 칸 위에만 찍는다. 땅에 걸치지 않는다.'
    return '맞는 땅 위에 키트로 찍는다(낱칸 금지). 다른 기물·건물과 1칸 띄우고, 길·문 앞·부두 통로를 막지 않는다.'


def bake(dry=False):
    prev = BL.load_pins(P['pins'])
    pins = BL.Pins(prev)
    if not pins.map: pins.next_id = 1                      # 0 번은 빈 칸
    img, info, rejected, adopted = {}, {}, [], []
    dedupe = {}
    piece_cells = {}
    for p in C.PIECES.values():
        st = C.status_of(p)
        if st != 'pass': rejected.append(dict(id=p['id'], why=st)); continue
        adopted.append(p)
        a = C.render(p); im = Image.fromarray(a, 'RGBA')
        pcs = cell_pcs(p, a); cells = {}
        blob = p['id'] in TR.BLOB; a4 = p['id'] in TR.AUTO4
        for (x, y), pc in pcs.items():
            crop = BL.norm(im.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)))
            where = f" ({x + 1},{y + 1})" if p['w'] * p['h'] > 1 else ''
            if blob: where = f" (덩이 {y * 8 + x})"
            if a4: where = f" (이웃 {y * 4 + x})"
            meta = dict(label=f"{p['name'][:60]}{where}"[:80], desc=f"{p['desc'] or p['name']} — {BL.PCNOTE[pc]}.", role=role_of(p),
                        tags=['해적 군도', GROUP_KO[p['group']]] + p['tags'], rep='auto' if (blob or a4) else ('repeat' if p['kind'] == 'terrain' else 'fixed'))
            key = f"{p['id']}/{x}.{y}"
            k2 = (crop.tobytes(), pc)
            if k2 in dedupe and not (blob or a4): tid = dedupe[k2]
            else:
                tid = pins.assign(key); img[tid] = crop; info[tid] = dict(meta, pc=pc); dedupe.setdefault(k2, tid)
            cells[(x, y)] = (tid, pc)
        piece_cells[p['id']] = cells

    count = max(list(img) + [pins.next_id - 1, 0]) + 1
    assert math.ceil(count / TPR) * 16 <= BL.MAX_H, ('시트 높이 초과', count)
    for t in range(count):
        if t not in img: img[t] = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    sheet = BL.render_sheet(img, count, TPR)

    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    passability, priority, terrain, tile_meta = [], [], [], []
    for t in range(count):
        inf = info.get(t)
        if inf is None:
            passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
            tile_meta.append(dict(label='빈 칸', description='빈 칸(번호 고정용) — 쓰지 않는다.', source='bundled-default')); continue
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        m = dict(label=inf['label'], description=inf['desc'][:400], role=inf['role'], passage=passage, defaultLayer=home, tags=list(dict.fromkeys(inf['tags'])),
                 source='bundled-default', confidence='high', repeatability=inf['rep'])
        if inf['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': m['layerBacking'] = 'none'
        tile_meta.append(m)

    def tids_of(pid): return sorted({t for t, _ in piece_cells.get(pid, {}).values()})
    autotile_groups = []
    auto_tables = {}
    for aid, ad in TR.BLOB.items():
        cells = piece_cells.get(aid)
        if not cells: continue
        idx = [cells[(i % 8, i // 8)][0] for i in range(len(TR.BLOB_MASKS))]
        vm = {str(m): idx[TR.BLOB_MASKS.index(TR.canon(m))] for m in range(256)}
        mem = sorted(set(idx))
        conn = sorted(set(mem) | {t for q in CONNECT.get(aid, []) for t in tids_of(q)})
        autotile_groups.append(dict(id='pi-' + aid, name=ad['name'][:80], neighborhood=8, memberTileIds=mem, connectTileIds=conn, variantMap=vm, edgeConnects=True))
        auto_tables[aid] = dict(neighborhood=8, variant={str(m): vm[str(m)] for m in range(256)})
    for aid, ad in TR.AUTO4.items():
        cells = piece_cells.get(aid)
        if not cells: continue
        vm = {str(m): cells[(m % 4, m // 4)][0] for m in range(16)}
        mem = sorted(set(vm.values()))
        conn = sorted(set(mem) | {t for q in CONNECT.get(aid, []) for t in tids_of(q)})
        g = dict(id='pi-' + aid, name=ad['name'][:80], neighborhood=4, memberTileIds=mem, connectTileIds=conn, variantMap=vm, edgeConnects=True)
        autotile_groups.append(g)
        auto_tables[aid] = dict(neighborhood=4, variant=vm)

    groups = collections.OrderedDict(); kits = []; comp = dict(pieces={}, autotiles=auto_tables, floors={})
    for p in adopted:
        cells = piece_cells[p['id']]; tids = sorted({t for t, _ in cells.values()})
        if p['kind'] == 'terrain':
            auto = p['id'] in TR.BLOB or p['id'] in TR.AUTO4
            key = ('auto:' if auto else 'floor:') + p['id']
            groups[key] = dict(id='pi:' + key, name=(p['desc'] or p['name'])[:60], role=role_of(p), defaultLayer='lower', tileIds=set(tids),
                               description=f"{p['name']}. {p['desc']}"[:400],
                               placementRules=('오토타일 — 붓·fill_region 이 이웃에 맞는 칸을 고른다.' if auto else
                                               '벽 천장(at-wall-*) 남쪽 가장자리 바로 아래 두 줄: 위 줄 = 행0, 아래 줄 = 행1(열은 변형).' if p['id'].startswith('wall-face-') else
                                               '낱칸으로 이어 칠한다. 변형(가로 칸)은 드물게 섞는다.'))
            if not auto and not p['id'].startswith('wall-face-'):
                comp['floors'][p['id']] = [cells[(x, 0)][0] for x in range(p['w']) if (x, 0) in cells]
            if p['id'].startswith('wall-face-'):
                comp['floors'][p['id']] = [[cells[(x, y)][0] for x in range(p['w'])] for y in range(p['h'])]
            if auto: continue
            if p['w'] * p['h'] == 1: continue
        else:
            key = p['group'] + ':' + role_of(p)
            if key not in groups:
                groups[key] = dict(id='pi:' + key, name=f"{GROUP_KO[p['group']]} · {role_of(p)}", role=role_of(p), defaultLayer='upper', tileIds=set(),
                                   description=f"해적 군도 {GROUP_KO[p['group']]} 조각 칸 모음({role_of(p)}).",
                                   placementRules='다칸 조각은 낱칸으로 칠하지 않고 같은 이름의 키트(pi-…)로 찍는다.')
            groups[key]['tileIds'] |= set(tids)
        rows = []
        grid = []
        for y in range(p['h']):
            lo = [-1] * p['w']; up = [-1] * p['w']; gr = []
            for x in range(p['w']):
                if (x, y) not in cells: gr.append(None); continue
                t, pc = cells[(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
                gr.append([t, pc])
            rows.append(dict(tiles=lo, upperTiles=up)); grid.append(gr)
        ai = dict(description=(p['desc'] or p['name'])[:400], placementRules=placement_rule(p)[:400],
                  tags=['해적 군도', GROUP_KO[p['group']], p['kind']] + p['tags'], role=role_of(p),
                  repeatability='repeat' if p['kind'] == 'terrain' else 'fixed', layerHome='lower' if p['kind'] == 'terrain' else 'upper',
                  themes=['해적', '열대 섬', '항구'], origin='ai', confidence='high')
        if p['kind'] not in ('terrain', 'wall_mounted') + FLAT_KINDS: ai['snap'] = 'floor'; ai['anchor'] = dict(dx=p['w'] // 2, dy=p['h'] - 1)
        if p['kind'] == 'wall_mounted': ai['snap'] = 'wall-north'
        kit = dict(id='pi-' + p['id'], kind='section', name=p['name'][:80], width=p['w'], height=p['h'], tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai)
        ent = p.get('entrance'); appr = p.get('approach')
        if ent:
            kit['parts'] = [dict(id='door', kind='entrance', dx=ent[0], dy=ent[1], w=1, h=1)]
            ax, ay = appr if appr else (ent[0], ent[1] + 1)
            ai['access'] = [dict(dx=ax, dy=ay)]
        kits.append(kit)
        comp['pieces'][p['id']] = dict(w=p['w'], h=p['h'], kind=p['kind'], group=p['group'], role=role_of(p), grid=grid,
                                       entrance=list(ent) if ent else None, approach=list(appr) if appr else (list((ent[0], ent[1] + 1)) if ent else None),
                                       tags=p['tags'])
    tile_groups = []
    for g in groups.values():
        g['tileIds'] = sorted(g['tileIds'])
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer(g['defaultLayer'], g['tileIds'], priority, tile_meta)
        g.update(source='bundled-default', confidence='high'); tile_groups.append(g)
    data = collections.OrderedDict(id=ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=16, tilesPerRow=TPR, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta, tileGroups=tile_groups,
                                   autotileGroups=autotile_groups, animationStrips=[], structureKits=kits)
    rep = collections.OrderedDict()
    chk = BL.check_definition(data, TPR)
    for code in ('group-prefix', 'kit-prefix'): chk['by_code'].pop(code, None); chk['examples'].pop(code, None)
    chk['violations'] = sum(chk['by_code'].values()); rep['definition'] = chk
    exp = {('pi-' + p['id']): BL.norm(Image.fromarray(C.render(p), 'RGBA')) for p in adopted}
    mism = [k['id'] for k in kits if not BL.same_image(BL.reassemble(k, sheet, TPR), exp[k['id']])]
    rep['reassembly'] = dict(kits=len(kits), mismatched=len(mism), ids=mism[:20])
    rep['palette'] = dict(cells_off_palette=sum(1 for t in range(count) if any(C.palette_issues(np.array(img[t]), str(t)))))
    rep['tiles'] = dict(count=count, rows=math.ceil(count / TPR), kits=len(kits), groups=len(tile_groups), autotiles=len(autotile_groups))
    rep['adopted'] = dict(pieces=len(adopted), by_group=dict(collections.Counter(p['group'] for p in adopted)))
    rep['rejected'] = rejected
    out = dict(data=data, sheet=sheet, report=rep, piece_cells=piece_cells, comp=comp)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    wr(P['pieces'], comp, separators=(',', ':'))
    wr(P['pins'], dict(version=1, tilesPerRow=TPR, count=count, cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1]))), indent=0)
    d2 = json.load(open(P['tileset'], encoding='utf-8')); s2 = Image.open(P['png']).convert('RGBA')
    rep['reassembly_from_files'] = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, TPR), exp[k['id']]))
    wr(P['report'], rep, indent=1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'adopted', 'reassembly', 'palette')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'] if r['definition']['violations'] else '')
    print('거절', len(r['rejected']), [x['id'] for x in r['rejected']][:40])
