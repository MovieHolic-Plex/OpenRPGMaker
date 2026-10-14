#!/usr/bin/env python3
"""sengoku_edo 굽기 — 야외(art/terrain·buildings·props) + 실내(art/interior.py, 손 도트 실내 조립 규칙)를 한 시트로.

  python3 scripts/content/sengoku-edo/bake_se.py          # 쓰기
  python3 scripts/content/sengoku-edo/bake_se.py --dry    # 보고만

산출: public/assets/sengoku-edo/sengoku-edo-chipset.png · src/assets/sengokuEdoTileset.json · sengokuEdoSheet.json · sengokuEdoRoomSpec.json
      tiledata/sengoku-edo/bake-pins.json · bake-report.json
3/4 관문: 모든 조각은 그림 화소 해시의 object-gate 영수증이 pass 여야 굽는다(se_bake_lib.gate_status). 프로필 미보정이면 임시통과로 세어 보고한다.
혼자 서지 못하는 부품(담 토막·벽면·문 틈)은 조립 그림 영수증(gate_assembled_se.py, kind structure)이 덮는다 — ASSEMBLED 표.
"""
import argparse, collections, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'lib'))
sys.path.insert(0, os.path.join(HERE, 'art'))
import se_bake_lib as TB   # noqa: E402
BL = TB.BL
import interior as IN      # noqa: E402  (ikit Registry R · 잠긴 팔레트 그림)
import ikit                # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'sengoku_edo', '전국·에도 일본 (손 도트)', 'tex_sengoku_edo', 'oprn-sengoku'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'sengoku-edo')
P = dict(png=os.path.join(ROOT, 'public/assets/sengoku-edo/sengoku-edo-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/sengokuEdoTileset.json'), sheet=os.path.join(ROOT, 'src/assets/sengokuEdoSheet.json'),
         roomspec=os.path.join(ROOT, 'src/assets/sengokuEdoRoomSpec.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'),
         assembled=os.path.join(TD, 'assembled', 'covers.json'))
GROUP_KO = dict(terrain='바닥·길·논·물', buildings='건물', props='소품·나무')
FENCE_IDS = {'se-wall-plaster', 'se-wall-plaster-v', 'se-castle-wall', 'se-castle-wall-v', 'se-fence-bamboo', 'se-hedge'}
TREE_IDS = {'se-tree-pine', 'se-tree-pine-small', 'se-tree-cherry', 'se-tree-maple', 'se-tree-cedar', 'se-bamboo', 'se-tree-willow', 'se-azalea'}


def _art_items():
    import terrain as AT, buildings as AB, props as AP   # noqa: E401
    out = []
    for reg in (AT.R, AB.R, AP.R):
        for it in reg.items:
            png = os.path.join(TD, reg.group, '_gate', 'se-%s.png' % it['id'])
            out.append(dict(it, id='se-' + it['id'], group=reg.group, png=png))
    return out


def _assembled():
    """부품 id → 덮는 조립 그림 영수증 해시 목록(gate_assembled_se.py 가 쓴다)."""
    return json.load(open(P['assembled'], encoding='utf-8')) if os.path.exists(P['assembled']) else {}


def status_of(png, kind, id_, counters, covers):
    s = TB.gate_status(png, kind)
    if s == 'pass': return True
    if s == 'prov': counters['prov'] += 1; return True
    cv = covers.get(id_)
    if cv and cv.get('status') in ('pass', 'prov'):
        counters['assembled'] += 1; return True
    return s


def build_outdoor_pieces(report, covers):
    items = _art_items()
    pieces, blocked = [], []
    cnt = collections.Counter()
    for it in items:
        if not os.path.exists(it['png']): blocked.append((it['id'], 'PNG 없음 — art 내보내기 먼저')); continue
        ok = status_of(it['png'], it['kind'], it['id'], cnt, covers)
        if ok is not True: blocked.append((it['id'], ok)); continue
        g = it['group']
        role = ('terrain' if it['kind'] == 'terrain' else 'building' if g == 'buildings' and it['id'] not in FENCE_IDS else 'fence' if it['id'] in FENCE_IDS
                else 'prop')
        desc = f"{it['name']}. 전국·에도 {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면)."
        p = dict(id=it['id'], name=it['name'], kind=it['kind'], png=it['png'], group='se-' + g, group_ko=GROUP_KO[g], desc=desc, role=role,
                 tags=list(it.get('tags') or []) + (['나무'] if it['id'] in TREE_IDS else []), rules=it.get('rules') or '',
                 walk=it.get('walk') or [], floor=it.get('floor') or [])
        if it['id'].startswith(('se-water', 'se-paddy')):
            p['blocked_ground'] = True
            p['rules'] = (p['rules'] + ' 걸을 수 없는 땅(막힘).').strip()
        if g == 'buildings' and it.get('entrance'):
            p['entrance'] = list(it['entrance'])
            p['rules'] = ((p['rules'] + ' ') if p['rules'] else '') + ('건물 하나를 키트로 찍는다. 문 칸(entrance)은 막힘이고 그 바로 아래 칸(접근칸)은 길로 비워 둔다. '
                                                                       '문 앞 2칸은 소품을 두지 않는다.')
        elif it['kind'] == 'terrain': p['rules'] = p['rules'] or '한 칸 바닥 — 넓게 칠한다.'
        pieces.append(p)
    report['outdoor_gate'] = dict(provisional_profile_uncalibrated=cnt['prov'], covered_by_assembled=cnt['assembled'], blocked=blocked, pieces=len(pieces))
    return pieces


def interior_registry(report, covers):
    """art/interior.py 의 R 에서 관문 통과분만 남긴다. 천장·공허·문 인방은 이 칩셋 색으로."""
    R = IN.R
    ikit.default_ceiling = R.ceils['se-ceil']['draw']          # 문 인방(door lintel)도 이 칩셋 천장 그림
    R.add_void()
    cnt = collections.Counter(); dropped = []
    for id_ in list(R.objs):
        img = IN.gate_image(id_)
        s = status_of(img, IN.GATE[id_], id_, cnt, covers)
        if s is not True: dropped.append((id_, str(s)[:100])); del R.objs[id_]
    for table, key in ((R.floors, 'floor'), (R.walls, 'wall')):
        for id_ in list(table):
            s = status_of(IN.gate_image(id_), 'terrain', id_, cnt, covers)
            if s is not True: dropped.append((id_, str(s)[:100])); del table[id_]
    report['interior_gate'] = dict(objects=len(R.objs), floors=len(R.floors), walls=len(R.walls), provisional=cnt['prov'],
                                   covered_by_assembled=cnt['assembled'], dropped=dropped)
    return R


def void_cell():
    a = np.zeros((16, 16, 4), np.uint8)
    from px import RGB, MI
    a[:, :, :3] = RGB[MI['sumi']][0]; a[:, :, 3] = 255
    return Image.fromarray(a, 'RGBA')


def bake(dry=False):
    report = collections.OrderedDict()
    covers = _assembled()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'se', '전국·에도')
    pieces = build_outdoor_pieces(report, covers)
    for p in pieces: O.add_piece(p)
    O.finish_pieces(pieces, lambda p: p.get('role', 'prop'), '걸을 수 있는 바닥(아래층).')

    # ── 실내 ──
    R = interior_registry(report, covers)
    b = R.build()
    if 'void' in b['cells']: b['cells']['void']['img'] = void_cell()
    loc = {}
    for local, c in b['cells'].items():
        pc = c['pc']
        loc[local] = O.put('int/' + local, c['img'], pc, dict(label=c['label'], desc=(c['desc'] + ' — ' + BL.PCNOTE[pc] + '.')[:400], role='wall' if pc == 'solidfloor' else 'prop',
                                                          tags=['전국·에도', '실내'] + list(c['tags']), rep='fixed', piece='interior'))
    n = lambda l: loc[l]
    it = b['interior']
    spec = dict(version=1, source='scripts/content/sengoku-edo/bake_se.py (art/interior.py)', tileSize=16, blank=-1, void=n(it['void']),
                floors={}, walls={}, ceilings={}, objects={}, tables={}, lines={}, daises={}, goods={})
    for k, f in it['floors'].items(): spec['floors'][k] = dict(f, tiles=[n(t) for t in f['tiles']])
    for k, w in it['walls'].items(): spec['walls'][k] = dict(w, tiles=[n(t) for t in w['tiles']])
    for k, c in it['ceilings'].items(): spec['ceilings']['default' if k == 'se-ceil' else k] = [n(t) for t in c]   # 조립기는 천장 'default' 를 찾는다
    for k, o in it['objects'].items(): spec['objects'][k] = dict(o, cells=[[dx, dy, n(l), layer] for dx, dy, l, layer in o['cells']])
    spec['rooms'] = ROOMS
    extra_groups = []
    for g in b['groups']:
        tids = sorted({n(l) for l in g['cells']})
        extra_groups.append(dict(id=g['id'].replace('jp:', 'se:'), name=g['name'], role=g['role'], tileIds=set(tids), description=g['desc'],
                                 placementRules=g['rules'].replace('jp_city', 'sengoku_edo')))
    extra_kits = []
    for k in b['kits']:
        a = k['ai']; grid = k['grid']
        rows = []
        for r in grid:
            lo = [-1] * len(r); up = [-1] * len(r)
            for x, l in enumerate(r):
                if l is None: continue
                (lo if b['cells'][l]['pc'] in TB.LOWER_PC else up)[x] = n(l)
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(snap=a['snap'], tags=['전국·에도', '실내'] + list(a['tags']), description=a['description'][:400], placementRules=(a['placementRules'] or '방 짓기 도구가 놓는다.')[:400],
                  repeatability='fixed', role='prop', anchor=a['anchor'], layerHome='upper', origin='ai', confidence='high')
        extra_kits.append(dict(id=k['id'].replace('jp-in-se-', 'se-in-').replace('jp-in-', 'se-in-'), kind='section', name=k['name'], width=len(grid[0]), height=len(grid), tileSize=16, rows=rows,
                               learnedFrom='db-authored', ai=ai))
    data, sheet, count = TB.finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, extra_groups, extra_kits)
    expected = {pid: pc['src'] for pid, pc in O.piece_cells.items() if pc['W'] * pc['H'] > 1 or pc['piece']['kind'] not in ('terrain', 'flat')}
    ver = TB.verify(data, sheet, TPR, expected)
    # 팔레트: 시트의 모든 불투명 색이 잠긴 팔레트 안(실내 바닥·벽면 그늘 변형 제외 — ikit 그늘은 잠긴 색을 어둡게 섞는다)
    from px import RGB
    pal = {tuple(int(v) for v in c) for ramp in RGB for c in ramp}
    sa = np.array(sheet); m = sa[:, :, 3] == 255
    off = {tuple(c) for c in sa[m][:, :3].tolist()} - pal
    report['tiles'] = dict(count=count, rows=-(-count // TPR), sheetPx=[TPR * 16, -(-count // TPR) * 16], kits=len(data['structureKits']),
                           groups=len(data['tileGroups']), outdoor_pieces=len(pieces), interior_objects=len(spec['objects']), interior_floors=len(spec['floors']),
                           interior_walls=len(spec['walls']), colors_outside_palette=len(off))
    report.update(ver)
    out = dict(data=data, sheet=sheet, spec=spec, report=report)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['roomspec'], spec, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    pins.save()
    wr(P['report'], report, indent=1)
    return out


# 방 종류 표(조수 build_hand_interior_room 이 읽는다). examples = [맵 id, 건물 id, 방 종류, [[가구 id, 개수]]].
ROOMS = dict(
    docPrefix='sengoku-edo-room-',
    kinds=dict(
        washitsu=dict(ko='다다미 방', alias=['다다미', '와시쓰', '방', '객실', '거실']),
        guest=dict(ko='여관 손님방', alias=['여관 방', '하타고', '료칸', '객실']),
        tea=dict(ko='다실', alias=['다실', '차실', '다도']),
        audience=dict(ko='성 알현실', alias=['알현실', '대광간', '영주', '성 안']),
        shop=dict(ko='가게 안(마루 + 흙바닥)', alias=['가게', '상점', '포목점', '쌀집', '술집 안']),
        kitchen=dict(ko='부엌(흙바닥)', alias=['부엌', '도마', '가마도']),
        farm=dict(ko='농가 큰방(이로리)', alias=['농가', '민가', '이로리', '시골집']),
        dojo=dict(ko='도장', alias=['도장', '검술', '무술']),
        bath=dict(ko='목욕간', alias=['목욕', '온천', '욕실']),
        bedroom=dict(ko='침방', alias=['침실', '침방', '잠자리']),
        study=dict(ko='서재', alias=['서재', '서원', '공부방']),
    ),
    buildings=dict(ryokan='여관', samurai='무가 저택', castle='성 천수각', machiya='마치야(가게집)', minka='농가', dojo='도장', onsen='온천'),
    examples=[
        ['ryokan-2f', 'ryokan', 'guest', [['se-zataku', 1], ['se-zabuton', 4], ['se-tokonoma', 1], ['se-andon', 1], ['se-window-shoji', 1], ['se-hibachi', 1]]],
        ['ryokan-2f', 'ryokan', 'bedroom', [['se-futon', 2], ['se-andon', 1], ['se-futon-stack', 1], ['se-writing-desk', 1]]],
        ['ryokan-1f', 'ryokan', 'kitchen', [['se-kamado', 1], ['se-water-jar', 1], ['se-meal-tray', 2], ['se-buckets', 1]]],
        ['ryokan-1f', 'ryokan', 'bath', [['se-bathtub', 1], ['se-buckets', 2]]],
        ['samurai-house', 'samurai', 'washitsu', [['se-tokonoma', 1], ['se-sword-rack', 1], ['se-zataku', 1], ['se-zabuton', 3], ['se-tansu', 1], ['se-scroll', 1]]],
        ['samurai-house', 'samurai', 'tea', [['se-tea-kettle', 1], ['se-tea-set', 1], ['se-zabuton', 2], ['se-scroll', 1]]],
        ['samurai-house', 'samurai', 'bedroom', [['se-futon', 1], ['se-andon', 1], ['se-armor', 1], ['se-writing-desk', 1]]],
        ['castle-hall', 'castle', 'audience', [['se-dais', 1], ['se-tokonoma', 1], ['se-armor', 2], ['se-sword-rack', 1], ['se-zabuton', 6], ['se-kamidana', 1]]],
        ['machiya', 'machiya', 'shop', [['se-shop-counter', 1], ['se-goods-shelf', 2], ['se-cash-box', 1], ['se-kimono-rack', 1], ['se-door-noren', 1], ['se-kamidana', 1]]],
        ['minka', 'minka', 'farm', [['se-irori', 1], ['se-zabuton', 4], ['se-tansu', 1], ['se-water-jar', 1], ['se-kamado', 1]]],
        ['dojo', 'dojo', 'dojo', [['se-weapon-rack', 2], ['se-kamidana', 1], ['se-taiko', 1], ['se-scroll', 1]]],
    ],
)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'reassembly')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'])
    print('야외 관문', {k: (v if not isinstance(v, list) else v) for k, v in r['outdoor_gate'].items()})
    print('실내 관문', r['interior_gate'])
