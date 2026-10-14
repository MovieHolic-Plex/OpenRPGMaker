"""sf_station 굽기 — object-gate 를 통과한(영수증 화소 해시 일치) 조각만 모아 공용 번들 타일셋을 쓴다.

    python3 sf_bake.py          # 쓰기
    python3 sf_bake.py --dry    # 보고만

산출: public/assets/sf-station/sf-station-chipset.png · src/assets/sfStationTileset.json · src/assets/sfStationSheet.json
      tiledata/sf-station/pins.json(자리 키 핀, 덧붙이기 전용) · tiledata/sf-station/bake-report.json
칸 통행 종류(pc)는 jp_city bake_lib 와 같은 표: floor(아래·걷기) solidfloor(아래·막힘) flat(투명 덧그림·걷기) solid(위·막힘) star(위·걷기 ★).
  terrain 조각: 낱칸 바닥 = floor, 벽 천장(at-wall-*)·벽 앞면(wall-face-*)·우주 공허(void-star) = solidfloor, 투명 덧그림 = flat.
  flat 조각: 불투명 칸 floor, 투명 칸 flat.  wall_mounted: solid(벽 앞면 위에 얹는 위층).  그 밖: solid 목록 칸 solid, 나머지 그림 칸 star.
"""
import argparse, collections, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import sf_all  # noqa: E402,F401
import sf_core as C  # noqa: E402
import sf_terrain  # noqa: E402
import bake_lib as BL  # noqa: E402

ROOT = C.ROOT
ID, NAME, TEXTURE, FAMILY = 'sf_station', 'SF 정거장·네온 거리 (손 도트)', 'tex_sf_station', 'oprn-scifi'
TPR = 48
P = dict(png=os.path.join(ROOT, 'public/assets/sf-station/sf-station-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/sfStationTileset.json'), sheet=os.path.join(ROOT, 'src/assets/sfStationSheet.json'),
         pins=os.path.join(C.OUT, 'pins.json'), report=os.path.join(C.OUT, 'bake-report.json'))
GROUP_KO = dict(outdoor='정거장·식민지 야외', street='네온 거리', interior='정거장 실내', terrain='바닥·벽')
SOLID_TERRAIN = ('at-wall-', 'wall-face-', 'void-star')
BUILDING_TAGS = {'건물', '돔', '에어록', '문', '정거장'}


def role_of(p):
    k, g, tags = p['kind'], p['group'], set(p['tags'])
    if k == 'terrain': return 'wall' if p['id'].startswith(SOLID_TERRAIN[:2]) else 'terrain'
    if k == 'flat': return 'terrain'
    if k == 'structure' and tags & BUILDING_TAGS: return 'building'
    return 'prop'


def cell_pcs(p, a):
    """조각 그림 a(RGBA ndarray) → {(x,y): pc}. 빈 칸은 뺀다."""
    out = {}
    solid = set(map(tuple, p['solid']))
    for y in range(p['h']):
        for x in range(p['w']):
            al = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16, 3]
            if al.max() == 0: continue
            opaque = al.min() == 255
            k = p['kind']
            if k == 'terrain':
                pc = 'solidfloor' if p['id'].startswith(SOLID_TERRAIN) else ('floor' if opaque else 'flat')
            elif k == 'flat': pc = 'floor' if opaque else 'flat'
            elif k == 'wall_mounted': pc = 'solid'
            else: pc = 'solid' if (x, y) in solid else 'star'
            out[(x, y)] = pc
    return out


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
        auto = p['id'] in sf_terrain.AUTO
        for (x, y), pc in pcs.items():
            crop = BL.norm(im.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)))
            where = f" ({x + 1},{y + 1})" if p['w'] * p['h'] > 1 else ''
            if auto: where = f" (이웃 {y * 4 + x})"
            meta = dict(label=f"{p['name']}{where}"[:80], desc=f"{p['desc'] or p['name']} — {BL.PCNOTE[pc]}.", role=role_of(p),
                        tags=['sf', GROUP_KO[p['group']], '줄' + p['line']] + p['tags'], rep='auto' if auto else ('repeat' if p['kind'] == 'terrain' else 'fixed'))
            key = f"{p['id']}/{x}.{y}"
            k2 = (crop.tobytes(), pc)
            if k2 in dedupe and not auto: tid = dedupe[k2]
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
        if inf['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 붓은 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': m['layerBacking'] = 'none'
        tile_meta.append(m)

    # 오토타일 그룹(4방향, 시트 칸 = 마스크)
    autotile_groups = []
    for aid, ad in sf_terrain.AUTO.items():
        cells = piece_cells.get(aid)
        if not cells: continue
        vm = {str(m): cells[(m % 4, m // 4)][0] for m in range(16)}
        mem = sorted(set(vm.values()))
        g = dict(id='sf-' + aid, name=ad['name'], neighborhood=4, memberTileIds=mem, connectTileIds=mem, variantMap=vm, edgeConnects=True)
        if ad['kind'] == 'flat': g['layer'] = 'upper'
        autotile_groups.append(g)
    # 도로 오토타일은 횡단보도·차선 칸도 «도로»로 센다(그 칸 옆에 연석이 생기지 않게)
    road = next((g for g in autotile_groups if g['id'] == 'sf-at-road'), None)
    if road:
        extra = [t for pid in ('crosswalk', 'lane-dash', 'asphalt') for (t, _) in piece_cells.get(pid, {}).values()]
        road['connectTileIds'] = sorted(set(road['memberTileIds']) | set(extra))

    # 그룹·키트
    groups = collections.OrderedDict(); kits = []
    for p in adopted:
        cells = piece_cells[p['id']]; tids = sorted({t for t, _ in cells.values()})
        if p['kind'] == 'terrain' or (p['kind'] == 'flat' and p['group'] == 'terrain'):
            key = ('auto:' if p['id'] in sf_terrain.AUTO else 'floor:') + p['id']
            groups[key] = dict(id='sf:' + key, name=p['desc'] or p['name'], role=role_of(p), defaultLayer='lower', tileIds=set(tids),
                               description=f"{p['name']}. {p['desc']}",
                               placementRules=('오토타일 — 붓·fill_region 이 이웃에 맞는 칸을 고른다.' if p['id'] in sf_terrain.AUTO else
                                               '낱칸으로 이어 칠한다. 변형(가로 칸)은 드물게 섞는다.' if not p['id'].startswith('wall-face-') else
                                               '천장 오토타일(at-wall-*) 남쪽 가장자리 바로 아래 두 줄에만 깐다: 위 줄은 이 조각의 행0, 아래 줄은 행1 칸(열은 변형).'))
        else:
            key = p['group'] + ':' + role_of(p)
            if key not in groups:
                groups[key] = dict(id='sf:' + key, name=f"{GROUP_KO[p['group']]} · {'건물' if role_of(p) == 'building' else '기물'}", role=role_of(p), defaultLayer='upper',
                                   tileIds=set(), description=f"{GROUP_KO[p['group']]}의 {'건물' if role_of(p) == 'building' else '기물'} 조각 칸 모음.",
                                   placementRules='다칸 조각은 낱칸으로 칠하지 않고 같은 이름의 키트(sf-…)로 찍는다.')
            groups[key]['tileIds'] |= set(tids)
        if p['kind'] == 'terrain' and p['id'] in sf_terrain.AUTO: continue
        if p['kind'] == 'terrain' and p['w'] * p['h'] == 1: continue
        rows = []
        for y in range(p['h']):
            lo = [-1] * p['w']; up = [-1] * p['w']
            for x in range(p['w']):
                if (x, y) not in cells: continue
                t, pc = cells[(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(description=(p['desc'] or p['name'])[:400], placementRules=placement_rule(p)[:400],
                  tags=['sf', GROUP_KO[p['group']], '줄' + p['line'], p['kind']] + p['tags'], role=role_of(p) if role_of(p) != 'terrain' else 'terrain',
                  repeatability='repeat' if p['kind'] == 'terrain' else 'fixed', layerHome='lower' if p['kind'] in ('terrain',) else 'upper',
                  themes=['SF', '우주 정거장' if p['line'] == 'A' else '사이버 네온 거리'], origin='ai', confidence='high')
        if p['kind'] not in ('terrain', 'flat', 'wall_mounted'): ai['snap'] = 'floor'; ai['anchor'] = dict(dx=p['w'] // 2, dy=p['h'] - 1)
        if p['kind'] == 'wall_mounted': ai['snap'] = 'wall-north'
        kit = dict(id='sf-' + p['id'], kind='section', name=p['name'], width=p['w'], height=p['h'], tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai)
        if role_of(p) == 'building':
            kit['parts'] = [dict(id='door', kind='entrance', dx=p['w'] // 2, dy=p['h'] - 1, w=1, h=1)]
        kits.append(kit)
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
    exp = {('sf-' + p['id']): BL.norm(Image.fromarray(C.render(p), 'RGBA')) for p in adopted}
    mism = [k['id'] for k in kits if not BL.same_image(BL.reassemble(k, sheet, TPR), exp[k['id']])]
    rep['reassembly'] = dict(kits=len(kits), mismatched=len(mism), ids=mism[:20])
    rep['palette'] = dict(cells_off_palette=sum(1 for t in range(count) if any(C.palette_issues(np.array(img[t]), str(t)))))
    rep['tiles'] = dict(count=count, rows=math.ceil(count / TPR), kits=len(kits), groups=len(tile_groups), autotiles=len(autotile_groups))
    rep['adopted'] = dict(pieces=len(adopted), by_group=dict(collections.Counter(p['group'] for p in adopted)))
    rep['rejected'] = rejected
    out = dict(data=data, sheet=sheet, report=rep, piece_cells=piece_cells)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    wr(P['pins'], dict(version=1, tilesPerRow=TPR, count=count, cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1]))), indent=0)
    d2 = json.load(open(P['tileset'], encoding='utf-8')); s2 = Image.open(P['png']).convert('RGBA')
    rep['reassembly_from_files'] = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, TPR), exp[k['id']]))
    wr(P['report'], rep, indent=1)
    return out


def placement_rule(p):
    k = p['kind']
    if k == 'wall_mounted': return '벽 앞면(wall-face-*) 위 줄 칸에 얹는다. 바닥에 두지 않는다.'
    if k == 'flat': return '바닥 위 덧그림 — 걷는다. 다른 기물과 겹쳐도 되지만 문 앞은 비운다.'
    if p['id'].startswith('wall-face-'): return '천장 오토타일 남쪽 가장자리 아래 두 줄(위=행0·아래=행1). 열은 변형.'
    if role_of(p) == 'building': return '맨 아래 줄 가운데가 문. 문 앞 한 칸은 바닥(길)로 비운다. 이웃 건물과 1칸 이상 띄운다. 건물 뒤(북쪽)는 어두운 바닥으로 채운다.'
    return '바닥 위에 키트로 찍는다(낱칸 금지). 다른 기물과 1칸 띄우고, 길·문 앞을 막지 않는다.'


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'adopted', 'reassembly', 'palette')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'] if r['definition']['violations'] else '')
    print('거절', len(r['rejected']), [x['id'] for x in r['rejected']][:30])
