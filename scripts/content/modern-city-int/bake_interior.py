#!/usr/bin/env python3
"""modern_city(도쿄풍 현대 도시) 실내 조각을 번들 시트에 덧붙여 굽는다 — 덧붙이기 전용, 앞 번호 불변.

  python3 scripts/content/modern-city-int/bake_interior.py [--dry]

하는 일
 1. 3/4 관문: 조각 그림마다 object-gate 영수증(화소 해시)을 읽는다. 문 넷은 조립 방 그림(assembled.py) 영수증이 덮는다.
    pass 만 굽는다. 판정 프로필이 보정 전이면 «임시통과(provisional)» 로 세어 보고한다(theme_bake.gate_status 와 같은 규칙).
    하나라도 없거나 불합격이면 멈춘다(기준 완화·강제 통과 없음).
 2. 칸: mkit.Registry.build() 의 칸(내용+통행 종류 해시) → 번호. 키가 tiledata/modern-city/pins.json 에 있으면 그 번호, 없으면 끝에 덧붙인다.
    pins.json 에 같이 적으므로 bake_tileset.py 로 거리 시트를 다시 구워도 번호가 그대로 남는다(그 굽기는 끝에서 이 apply() 를 다시 부른다).
 3. 정의(src/assets/modernCityTileset.json): 통행·층·tileMeta 를 이 칸에 쓰고, 그룹(mc:interior-*)·조립 부품(mc-in-*)을 갈아 끼운다.
 4. 방 짓기 사양 src/assets/modernCityRoomSpec.json(HandInteriorSpec, build_hand_interior_room({tileset:"modern_city"})) + 방 표(rooms).
"""
import collections, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
import numpy as np                                  # noqa: E402
from PIL import Image                               # noqa: E402
import bake_lib as BL                               # noqa: E402
import object_gate as OG                            # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DEF = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET = os.path.join(ROOT, 'src/assets/modernCitySheet.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/interior/baked.json')
SPEC = os.path.join(ROOT, 'src/assets/modernCityRoomSpec.json')
EXAMPLES = os.path.join(ROOT, 'tiledata/modern-city/interior/examples')
REPORT = os.path.join(ROOT, 'tiledata/modern-city/interior/bake-report.json')

# 방 종류(조수가 layout.rooms[].kind 에 쓰는 낱말) — 예제 방 사각형의 room 이름과 같다.
KINDS = collections.OrderedDict([
    ('open-office', ('사무실(열린 사무 공간)', ['사무실', '오피스', '사무 공간', '업무 공간', 'office'])),
    ('meeting', ('회의실', ['회의실', '미팅룸', '회의', 'meeting room'])),
    ('hall', ('복도·대기 공간', ['복도', '대기', '휴게', 'hallway', 'hall'])),
    ('store', ('편의점 매장', ['편의점', '매장', '마트', '가게 안', 'convenience store', 'konbini', 'store'])),
    ('backroom', ('창고·뒷방', ['뒷방', '창고방', '재고실', 'backroom', 'stockroom'])),
    ('bedroom', ('침실', ['침실', '안방', '방', 'bedroom'])),
    ('living', ('거실·부엌(LDK)', ['거실', '부엌', '주방', 'LDK', '식당', 'living room', 'kitchen'])),
    ('ward', ('병원 병실·병동', ['병실', '병동', '입원실', '병원', 'hospital ward', 'ward'])),
    ('lobby', ('빌딩 로비', ['로비', '현관 홀', '엘리베이터 홀', 'lobby'])),
    ('cafe', ('카페', ['카페', '커피숍', '찻집', 'cafe', 'coffee shop'])),
    ('bank', ('은행 창구', ['은행', '창구', '지점', 'bank'])),
    ('concourse', ('지하철 대합실', ['역', '대합실', '지하철', '개찰구', 'station', 'subway'])),
    ('warehouse', ('물류 창고', ['창고', '물류 창고', '하역장', 'warehouse'])),
])
BUILDING_OF = {'office-floor': 'mc_office', 'konbini': 'mc_konbini', 'apartment': 'mc_apartment', 'hospital-ward': 'mc_hospital', 'lobby': 'mc_lobby',
               'cafe': 'mc_cafe', 'bank': 'mc_bank', 'concourse': 'mc_station', 'warehouse': 'mc_warehouse'}
BUILDINGS = {'mc_office': '사무 빌딩 한 층(열린 사무 공간·회의실·복도, office-floor)', 'mc_konbini': '편의점(매장·뒷방, konbini)',
             'mc_apartment': '아파트 1LDK(침실·거실 부엌, apartment)', 'mc_hospital': '병원 병동(4인 병실, hospital-ward)', 'mc_lobby': '사무 빌딩 로비(lobby)',
             'mc_cafe': '카페(cafe)', 'mc_bank': '은행 지점(bank)', 'mc_station': '지하철 대합실(concourse)', 'mc_warehouse': '물류 창고(warehouse)'}


def gate():
    """조각별 관문 상태. 반환 (보고 dict, 막힌 목록)."""
    import pieces, assembled
    from gate_export import ASSEMBLED_ONLY
    rep = collections.Counter(); blocked = []
    def status(img, kind, label):
        r = OG.read_receipt(OG.pixel_sha256(img))
        if not r: return '영수증 없음'
        if r.get('kind') != kind: return '영수증 종류 %s != %s' % (r.get('kind'), kind)
        if r.get('verdict') != 'pass': return '불합격 ' + ' · '.join(r.get('reasons') or [])
        why = OG.refusal(img, kind=kind, context='bundle')
        if why is None: return 'pass'
        return 'prov' if '보정되지 않았다' in why else why
    covered = set()
    for a in assembled.assembled():
        s = status(a['img'], a['kind'], a['label'])
        rep['assembled-' + ('pass' if s in ('pass', 'prov') else 'blocked')] += 1
        if s in ('pass', 'prov'): covered |= set(a['covers'])
        else: blocked.append((a['label'], s))
    for id_, ko, arr, kind in pieces.piece_images():
        o = pieces.R.objs.get(id_)
        if o and o['kind'] in ASSEMBLED_ONLY:
            if id_ in covered: rep['covered-by-assembled'] += 1
            else: blocked.append((id_, '조립 방 영수증이 덮지 않는다'))
            continue
        s = status(Image.fromarray(arr, 'RGBA'), kind, id_)
        if s in ('pass', 'prov'): rep[s] += 1
        else: blocked.append((id_, s))
    return dict(rep), blocked


def room_table():
    ex = {f[:-5]: json.load(open(os.path.join(EXAMPLES, f), encoding='utf-8')) for f in sorted(os.listdir(EXAMPLES)) if f.endswith('.json')}
    rows = []
    for name, e in ex.items():
        for r in e.get('rooms', []):
            cnt = collections.Counter(o['id'] for o in e.get('objects', []) if r['x0'] <= o['x'] <= r['x1'] and r['y0'] <= o['y'] <= r['y1'])
            cnt.update(t['style'] for t in e.get('tables', []) if r['x0'] <= t['x'] <= r['x1'] and r['y0'] <= t['y'] <= r['y1'])
            rows.append([name, BUILDING_OF[name], r['room'], sorted([k, v] for k, v in cnt.items())])
    used = {r[2] for r in rows}
    assert used <= set(KINDS), used - set(KINDS)
    return dict(kinds={k: dict(ko=v[0], alias=v[1]) for k, v in KINDS.items() if k in used}, buildings=BUILDINGS, examples=rows, docPrefix='mc-int-map-')


def apply(root=ROOT, dry=False, check_gate=True):
    import pieces
    report = {}
    if check_gate:
        rep, blocked = gate()
        report['gate'] = dict(rep, blocked=len(blocked), profile='uncalibrated → pass 영수증을 임시통과(provisional)로 센다' if rep.get('prov') else 'calibrated')
        if blocked: raise SystemExit('3/4 관문 미통과 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked))
    R = pieces.R
    b = R.build()
    data = json.load(open(DEF, encoding='utf-8'))
    pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) else {'version': 1, 'cells': {}}
    count0, tpr = data['count'], data['tilesPerRow']
    count = count0
    idmap, mine, added = {}, {}, 0
    for local, c in b['cells'].items():
        cell = BL.norm(c['img']); key = BL.Sheet.key_of(cell, c['pc'])
        if key in pins['cells']:
            tid = pins['cells'][key]
            if key in own['cells'] or tid >= count0: mine[tid] = (cell, c)     # 이 굽기가 소유한 칸(그림·메타를 쓴다)
        else:
            tid = count; count += 1; pins['cells'][key] = tid; mine[tid] = (cell, c); added += 1
        idmap[local] = tid
        if tid in mine: own['cells'][key] = tid
    # 시트
    old = Image.open(PNG).convert('RGBA')
    rows = math.ceil(count / tpr)
    assert rows * 16 <= 4096, rows
    sheet = Image.new('RGBA', (tpr * 16, rows * 16), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid, (cell, _c) in mine.items():
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), ((tid % tpr) * 16, (tid // tpr) * 16))
        sheet.paste(cell, ((tid % tpr) * 16, (tid // tpr) * 16))
    # 앞 번호 그림 불변 검사
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(count0) if t not in mine and not np.array_equal(a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    # 정의 배열
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    for tid, (_cell, c) in mine.items():
        prio, passable, passage, home = BL.PC[c['pc']]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        m = dict(label=c['label'], description=c['desc'] or c['label'], role='terrain' if c['pc'] in ('floor', 'solidfloor') else 'prop', passage=passage, defaultLayer=home,
                 tags=['modern-city', '실내'] + list(c['tags']), source='bundled-default', confidence='high', repeatability='repeat' if c['pc'] == 'floor' else 'fixed')
        if c['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'
        elif home == 'upper': m['layerBacking'] = 'none'
        data['tileMeta'][tid] = m
    data['count'] = count
    if data.get('libraryEnd') is not None: data['libraryEnd'] = count
    # 그룹·조립 부품 갈아 끼우기
    data['tileGroups'] = [g for g in data['tileGroups'] if not g['id'].startswith('mc:interior-')]
    for g in b['groups']:
        ids = sorted({idmap[l] for l in g['cells']})
        data['tileGroups'].append(dict(id=g['id'], name=g['name'], role=g['role'], defaultLayer=g['defaultLayer'], tileIds=ids, description=g['desc'][:400], placementRules=g['rules'][:400],
                                       source='bundled-default', confidence='high', layerHome=g['defaultLayer'] if g['defaultLayer'] in ('lower', 'upper') else 'perCell'))
    data['structureKits'] = [k for k in data['structureKits'] if not k['id'].startswith('mc-in-')]
    for k in b['kits']:
        grid = k['grid']; w = max(len(r) for r in grid); h = len(grid)
        krows = [dict(tiles=[-1] * w, upperTiles=[idmap[c] if c else -1 for c in (r + [None] * (w - len(r)))]) for r in grid]
        ai = k['ai']
        data['structureKits'].append(dict(id=k['id'], kind='section', name=k['name'], width=w, height=h, tileSize=16, rows=krows, learnedFrom='interior-catalog',
                                          ai=dict(description=ai['description'], placementRules=ai['placementRules'] or '실내 가구 — build_hand_interior_room 의 objects 로 놓는다.',
                                                  tags=['modern-city', '실내'] + list(ai['tags']), role='prop', repeatability='fixed', layerHome='upper', themes=['현대 도시', '실내'],
                                                  origin='ai', confidence='high')))
    # 방 짓기 사양
    it = b['interior']; n = lambda l: idmap[l]   # noqa: E731
    spec = collections.OrderedDict(version=1, source='scripts/content/modern-city-int/pieces.py', tileSize=16, blank=-1, void=n(it['void']),
                                   floors={k: dict(f, tiles=[n(t) for t in f['tiles']]) for k, f in it['floors'].items()},
                                   walls={k: dict(w, tiles=[n(t) for t in w['tiles']]) for k, w in it['walls'].items()},
                                   ceilings={k: [n(t) for t in c] for k, c in it['ceilings'].items()},
                                   objects={k: dict(o, cells=[[dx, dy, n(l), layer] for dx, dy, l, layer in o['cells']]) for k, o in it['objects'].items()},
                                   tables={k: dict(t, pieces={p: [[dx, dy, n(l), layer] for dx, dy, l, layer in cells] for p, cells in t['pieces'].items()}) for k, t in it['tables'].items()},
                                   lines={}, daises={}, goods={k: n(g) for k, g in it['goods'].items()}, rooms=room_table())
    report.update(count_before=count0, count_after=count, added_cells=added, owned_cells=len(mine), kits=len(b['kits']), groups=len(b['groups']),
                  objects=len(spec['objects']), floors=len(spec['floors']), walls=len(spec['walls']), tables=len(spec['tables']), goods=len(spec['goods']),
                  sheet=[sheet.width, sheet.height], room_kinds=len(spec['rooms']['kinds']), room_examples=len(spec['rooms']['examples']))
    if dry: return report
    sheet.save(PNG, optimize=True)
    w = lambda p, o, **kw: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, **kw) + '\n')   # noqa: E731
    w(DEF, data, separators=(',', ':'))
    w(SHEET, dict(count=count, tilesPerRow=tpr), separators=(',', ': '))
    pins['count'] = count
    w(PINS, pins, separators=(',', ':'))
    own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
    w(OWN, own, indent=0)
    w(SPEC, spec, separators=(',', ':'))
    w(REPORT, report, indent=1)
    return report


if __name__ == '__main__':
    print(json.dumps(apply(dry='--dry' in sys.argv), ensure_ascii=False, indent=1))
