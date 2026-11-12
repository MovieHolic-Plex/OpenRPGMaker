#!/usr/bin/env python3
"""desert_east 굽기 — art/ 등록부(바닥·모서리 왕 타일·건물·소품·실내)의 object-gate 통과 조각만 16px 칸으로 잘라 한 시트·타일셋 정의로.

  python3 scripts/content/desert-east/bake_de.py          # 쓰기
  python3 scripts/content/desert-east/bake_de.py --dry    # 보고만

산출: public/assets/desert-east/desert-east-chipset.png · src/assets/desertEastTileset.json · desertEastSheet.json · desertEastPieces.json(구성기 사전)
      tiledata/desert-east/bake-pins.json(칸 번호 핀, 덧붙이기 전용) · bake-report.json
3/4 관문: 모든 조각은 그림 화소 해시의 object-gate 영수증이 pass 여야 굽힌다(de_bake_lib.gate_status). 모서리 왕 타일은 한 벌 4×4 묶음 그림(de-wang-<벌>.png)의 영수증이
그 16칸을 화소 그대로 덮는다. 미통과 조각은 굽지 않고 보고서 blocked 에 적는다.
"""
import argparse, collections, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'art'))
import de_bake_lib as TB   # noqa: E402
BL = TB.BL

ID, NAME, TEXTURE, FAMILY = 'desert_east', '사막·동양풍 (손 도트)', 'tex_desert_east', 'oprn-desert-east'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'desert-east')
P = dict(png=os.path.join(ROOT, 'public/assets/desert-east/desert-east-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/desertEastTileset.json'), sheet=os.path.join(ROOT, 'src/assets/desertEastSheet.json'),
         pieces=os.path.join(ROOT, 'src/assets/desertEastPieces.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'))
UNGATED = os.environ.get('DE_UNGATED')   # 개발용: 관문 없이 /tmp 로만 굽는다(저장소 산출물은 절대 안 쓴다)
if UNGATED:
    P = {k: os.path.join(UNGATED, os.path.basename(v)) for k, v in P.items()}
GROUP_KO = dict(terrain='바닥', buildings='건물·유적', props='소품', interior='실내', objects='이야기 기물', variety='다른 그림·새 기물', looks='겉모습 재질')
VARIETY = os.path.join(TD, 'variety')     # 테마 세계 늘리기(2026-11-13): 같은 종류의 다른 그림(변형)·새 집·새 기물·게임마다 고르는 바닥 재질 — scripts/content/world-kits/fable/build.py 가 쓴 spec.json, 3/4 관문 미통과 — 오너 면제 묶음
OBJECTS = os.path.join(TD, 'objects')     # 이야기 기물(샘·제단·화단·기록부·쪽지·표식·파편·비문 돌): 그림 PNG 를 그대로 굽는다 — spec.json, 3/4 관문 미통과 — 오너 면제 묶음
ANIM = []


def registries():
    import terrain as AT, buildings as AB, props as AP
    regs = [AT.R, AB.R, AP.R]
    try:
        import interior as AI
        if hasattr(AI, 'R'): regs.append(AI.R)
    except Exception as e:
        print('실내 등록부 건너뜀:', e)
    return AT, regs


def role_of(it, group):
    if it['kind'] == 'terrain': return 'terrain'
    if group == 'buildings': return 'building'
    if 'fence' in it['id'] or it['id'].startswith('wall-'): return 'fence'
    return 'prop'


def build_pieces(report):
    AT, regs = registries()
    pieces, prov, blocked = [], 0, []
    wang_ok = {}
    for sid in AT.WANG:
        png = os.path.join(TD, 'terrain', '_gate', 'de-wang-%s.png' % sid)
        wang_ok[sid] = TB.gate_status(png, 'terrain') if os.path.exists(png) else 'PNG 없음'
    for reg in regs:
        g = reg.group
        for it in reg.items:
            pid = 'de-' + it['id']
            png = os.path.join(TD, g, '_gate', pid + '.png')
            if it.get('wang'):
                st = wang_ok[it['wang']]
                # 칸 PNG 는 관문 디렉터리에 없다(묶음만) — 그려서 임시 파일로
                png = os.path.join('/tmp', 'de-wang-tiles', pid + '.png'); os.makedirs(os.path.dirname(png), exist_ok=True)
                reg.render(it).img().save(png)
            else:
                st = TB.gate_status(png, it['kind']) if os.path.exists(png) else 'PNG 없음'
            if UNGATED and st != 'pass': st = 'prov'
            if st == 'prov': prov += 1
            elif st != 'pass': blocked.append((pid, st)); continue
            interior = g == 'interior'
            p = dict(id=pid, name=it['name'], kind=it['kind'], png=png, group='de-' + g, group_ko=GROUP_KO[g],
                     desc=f"{it['name']}. 사막·동양풍 {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면).",
                     role=role_of(it, g), tags=['사막·동양풍'] + list(it.get('tags') or []), rules=it.get('rules') or '')
            if it.get('wang'):
                p.update(wang=it['wang'], wang_name=f"모서리 왕 타일 · {it['wang']}", wang_desc=f"{it['name'].split(' (')[0]} — 꼭짓점 재질로 고르는 16장 한 벌.",
                         wang_rules='구성기(compose_desert_east_map)가 꼭짓점 재질로 번호를 고른다. 손으로 칠할 때는 desertEastPieces.json 의 wang 표(모서리 NW1·NE2·SW4·SE8)를 따른다.')
                if it['wang'] == 'water' and any(it['corners']): p['pc'] = 'solidfloor'
            if interior and (it['id'].startswith('wall-') or it['id'].startswith('ceil-')): p['pc'] = 'solidfloor'
            if it.get('entrance'): p['entrance'] = list(it['entrance'])
            if it.get('passable'): p['passable'] = [list(c) for c in it['passable']]
            pieces.append(p)
    waived = []
    spec = json.load(open(os.path.join(OBJECTS, 'spec.json'), encoding='utf-8')) if os.path.exists(os.path.join(OBJECTS, 'spec.json')) else None
    for it in (spec or {}).get('items', []):
        pid = 'de-' + it['id']
        png = os.path.join(OBJECTS, 'pieces', it['src'])
        # 이 그림들은 영수증이 없다 — gate_status 가 관문 자신의 출구(object_gate.refusal, bundle)에 묻고, 오너 면제 묶음이 화소 해시·종류로 받아 준다. 개발용 임시통과(prov)는 없다.
        st = TB.gate_status(png, it['kind']) if os.path.exists(png) else 'PNG 없음'
        if st != 'pass': blocked.append((pid, st)); continue
        im = Image.open(png); assert im.size == (it['w'] * 16, it['h'] * 16), (pid, im.size)
        flat = it['place'] == 'decal'
        block = {tuple(c) for c in it['block']}
        note = '바닥 그림, 밟고 지나간다.' if flat else '서 있는 기물, 막힌 칸 %s%s.' % (' '.join('(%d,%d)' % c for c in sorted(block, key=lambda c: (c[1], c[0]))), ', 나머지 칸은 사람 위에 그려진다' if len(block) < it['w'] * it['h'] else '')
        pieces.append(dict(id=pid, name=it['name'], kind=it['kind'], png=png, group='de-objects', group_ko=GROUP_KO['objects'],
                           desc=f"{it['desc']} ({it['en']}) — {note} 3/4 관문 미통과 — 오너 면제 그림({spec['waiver']}).",
                           role='prop', tags=['사막·동양풍', '주제 소품'] + list(it['words']), rules=it['rule'], stamp=it['place'],
                           cells_pc={(x, y): 'flat' if flat else 'solid' if (x, y) in block else 'star' for y in range(it['h']) for x in range(it['w'])}))
        waived.append(pid)
    variety = variety_pieces(pieces, blocked)
    report['gate'] = dict(provisional_profile_uncalibrated=prov, blocked=blocked, pieces=len(pieces), wang=wang_ok,
                          owner_waiver=dict(batch=(spec or {}).get('waiver'), note='3/4 관문 미통과 — 오너 면제(통과가 아니다)', pieces=waived),
                          variety_waiver=dict(batch=variety['waiver'], note='3/4 관문 미통과 — 오너 면제(통과가 아니다)', pieces=variety['ids']))
    return pieces, AT, variety


STAMP_TAGS = ('decal', 'prop', 'tall', 'wallmount', 'door', 'overhead')
PLACE_KO = dict(prop='서 있는 기물', tall='서 있는 기물', decal='바닥 그림', wallmount='벽면에 거는 기물', walldoor='벽면의 문')


def variety_pieces(pieces, blocked):
    """variety/spec.json 의 그림을 등록부·이야기 기물 뒤에 덧붙인다(칸 번호는 자리 키 핀 — 덧붙이기 전용). 돌려주는 값 = 면제 묶음·조각 id·겉모습 표(조각 id).
    변형: 원본 조각의 이름·낱말·규칙·역할을 물려받고 칸마다 통행은 spec 의 cells(원본 키트 칸 그대로). 한 화소라도 바꾸면 면제가 풀려 그 조각은 막힌다."""
    path = os.path.join(VARIETY, 'spec.json')
    out = dict(waiver=None, ids=[], looks=None)
    if not os.path.exists(path): return out
    spec = json.load(open(path, encoding='utf-8'))
    out['waiver'] = spec['waiver']
    by = {p['id']: p for p in pieces}
    note = f"3/4 관문 미통과 — 오너 면제 그림({spec['waiver']})."

    def gate(pid, png, kind):
        st = TB.gate_status(png, kind) if os.path.exists(png) else 'PNG 없음'
        if st != 'pass': blocked.append((pid, st)); return False
        return True
    # 새 기물의 변형(게시판 다른 그림)은 그 원본이 같은 목록의 뒤쪽에 있다 — 원본이 아직 없는 변형은 한 바퀴 뒤로 미룬다(칸 번호는 자리 키 핀이라 순서와 무관)
    own = {it['id'] for it in spec['items']}
    order = [it for it in spec['items'] if not (it.get('variantOf') in own)] + [it for it in spec['items'] if it.get('variantOf') in own]
    for it in order:
        png = os.path.join(ROOT, it['src'])
        if not gate(it['id'], png, it['gate']): continue
        im = Image.open(png); assert im.size == (it['w'] * 16, it['h'] * 16), (it['id'], im.size)
        if it['type'] in ('variant', 'house') and it.get('variantOf'):
            base = by.get(it['variantOf'])
            if base is None: blocked.append((it['id'], '원본 조각 %s 이 구워지지 않았다' % it['variantOf'])); continue
            n = it['id'].rsplit('-', 1)[-1]
            p = dict(id=it['id'], name=f"{base['name']} · 다른 그림 {n}", kind=it['gate'], png=png, group='de-variety', group_ko=GROUP_KO['variety'],
                     desc=f"「{base['name']}」({base['id']}) 과 같은 종류의 다른 그림 — {it['en']}. 칸 크기·통행이 원본과 같다. {note}",
                     role=base.get('role', 'prop'), tags=[t for t in base.get('tags', []) if t != '사막·동양풍'] and ['사막·동양풍'] + [t for t in base.get('tags', []) if t != '사막·동양풍'] + ['다른 그림'],
                     rules=base.get('rules') or '', variantOf=base['id'], stamp=base.get('stamp') or ('decal' if base['kind'] == 'flat' else 'overhead' if base['kind'] == 'debris' else 'prop'))
            if it.get('lookWith'): p['lookWith'] = it['lookWith']
            if it['type'] == 'house':
                p['entrance'] = list(it['entrance'])
                if base.get('passable'): p['passable'] = base['passable']
            else:
                p['cells_pc'] = {(x, y): pc for x, y, pc in it['cells']}
        elif it['type'] == 'house':
            p = dict(id=it['id'], name=it['name'], kind=it['gate'], png=png, group='de-variety', group_ko=GROUP_KO['variety'],
                     desc=f"{it['name']} — {it['en']}. 사막·동양풍 건물, 칸 {it['w']}×{it['h']}, 평지붕(직각 지붕) + 남쪽 앞벽. {note}", role='building',
                     tags=['사막·동양풍', '집', '평지붕'], rules='문은 남쪽, 문 바로 아래 칸은 길·마당으로 비운다. 집 줄에 다른 집과 섞어 세운다.', entrance=list(it['entrance']))
        else:
            flat = it['place'] == 'decal'
            block = {tuple(c) for c in it['block']}
            how = '바닥 그림, 밟고 지나간다.' if flat else '%s, 막힌 칸 %s%s.' % (PLACE_KO[it['place']], ' '.join('(%d,%d)' % c for c in sorted(block, key=lambda c: (c[1], c[0]))), ', 나머지 칸은 사람 위에 그려진다' if len(block) < it['w'] * it['h'] else '')
            p = dict(id=it['id'], name=it['name'], kind=it['gate'], png=png, group='de-variety', group_ko=GROUP_KO['variety'], desc=f"{it['name']} ({it['en']}) — {how} {note}",
                     role='prop', tags=['사막·동양풍', '주제 소품'] + list(it['words']), rules=RULES.get(it['id'], ''), stamp={'walldoor': 'door'}.get(it['place'], it['place']),
                     cells_pc={(x, y): 'flat' if flat else 'solid' if (x, y) in block else 'star' for y in range(it['h']) for x in range(it['w'])})
        pieces.append(p); by[p['id']] = p; out['ids'].append(p['id'])
    looks = spec.get('looks')
    if looks:
        ok = set()
        # 재질 칸은 «그 자리에 원래 깔리던 칸» 의 이름·꼬리표를 물려받는다 — 길 판정(tilesetSurface: «흙길»·«포석» 꼬리표)·바닥 판정이 재질을 바꿔도 그대로여야 한다
        # (명세 은행이 찾았다: 꼬리표 없이 구웠더니 자갈·벽돌 길이 길로 세어지지 않아 «길 몫» 이 줄었다).
        import terrain as AT
        orig = {}
        for name, m in looks['tiles'].items():
            for src_id, look_id in m.items(): orig.setdefault(look_id, by.get(src_id))
        corner = {'de-' + it['id']: sum(v << i for i, v in enumerate(it['corners'])) for it in AT.R.items if it.get('wang')}
        wang_piece = {(q['wang'], corner[q['id']]): q for q in pieces if q.get('wang') and q['id'] in corner}
        for sid, sets in looks['wang'].items():
            for name, ids in sets.items():
                for idx, look_id in enumerate(ids): orig.setdefault(look_id, wang_piece.get((sid, idx)))
        for lk in looks['pieces']:
            png = os.path.join(ROOT, lk['src'])
            if not gate(lk['id'], png, 'terrain'): continue
            part = lk['id'].split('-')[2]
            src = orig.get(lk['id'])
            pieces.append(dict(id=lk['id'], name=(src['name'] + ' · 재질 ' if src else '겉모습 재질 칸 ') + lk['id'][len('de-look-'):], kind='terrain', png=png, group='de-looks', group_ko=GROUP_KO['looks'], fixed=True,
                               desc=f"게임마다 고르는 바닥·길·광장 재질 칸({lk['id'][len('de-look-'):]}){' — 「' + src['name'] + '」 자리에 깔린다' if src else ''} — 구성기가 그 게임의 겉모습으로 깐다. {note}", role='terrain',
                               tags=['사막·동양풍'] + [t for t in (src or {}).get('tags', []) if t != '사막·동양풍'] + ['겉모습 재질'], rules='구성기(compose_desert_east_map)가 게임 열쇠로 고른 재질일 때만 깐다. 손으로 칠할 때는 한 맵에 한 재질만.',
                               tile_group=dict(id='looks', name='겉모습 재질(게임마다 고르는 바닥·길·광장)', desc='같은 사막 칩셋으로 지은 게임들이 서로 다른 땅으로 보이게, 조수 실행이 게임마다 하나씩 고르는 재질 칸과 그 가장자리 칸.',
                                               rules='구성기가 깐다 — 한 맵에서 원래 재질과 섞지 않는다.')))
            ok.add(lk['id'])
        out['looks'] = dict(parts=looks['parts'], clash=looks.get('clash') or {}, tiles=looks['tiles'], wang=looks['wang'], ok=ok)
    return out


RULES = {
    'de-barrel': '집 벽 곁·가게 앞·막다른 골목 어귀에 한두 개. 막힘. 문 앞 접근칸·길 한가운데 금지.',
    'de-barrels': '창고·여관·가게 벽 곁에. 두 칸 막힘. 문 앞 접근칸·길 한가운데 금지.',
    'de-notice-board': '광장 가장자리·성문 곁·바자르 어귀에 하나. 아랫줄 막힘(윗줄은 사람 위에 그려진다). 읽는 이벤트는 아랫줄 칸에 «같은 높이·결정 키» 로.',
    'de-lever-wall': '실내 벽면(벽 두 줄) 위에 건다 — 바닥에 세우지 않는다. 당기는 이벤트는 그 아래 바닥 칸에서 위를 보고.',
    'de-stop-lever': '바닥에 세운다(아랫줄 막힘). 당기는 이벤트는 아랫줄 칸에 «같은 높이·결정 키» 로. 문 앞·통로 한가운데 금지.',
    'de-hatch-down': '지하(묘실·저장고·수로)로 내려가는 입구. 밟고 들어가는 이동 이벤트를 윗줄 칸에 둔다. 모래·포석·실내 바닥 위, 남쪽 한 줄은 비운다.',
    'de-room-door': '실내 벽면(벽 두 줄) 위에 붙인다 — 옆방으로 가는 문. 이동 이벤트는 문 아래 바닥 칸에 «위를 보고 결정 키» 또는 닿으면.',
    'de-save-crystal': '쉼터·여관·던전 방 어귀에 하나. 아랫줄 막힘. 저장 이벤트는 아랫줄 칸에 «같은 높이·결정 키» 로.',
}


def tiles_drop(tiles):
    """겉모습 재질 칸은 구성기 사전의 한 칸 바닥 목록(tiles)에서 뺀다 — looks 표로만 읽는다."""
    return [k for k in tiles if k.startswith('de-look-')]


def bake(dry=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'de', '사막·동양풍')
    pieces, AT, variety = build_pieces(report)
    for p in pieces: O.add_piece(p)
    O.finish_pieces(pieces, lambda p: p.get('role', 'prop'), '걸을 수 있는 바닥(아래층).')
    data, sheet, count = TB.finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, [], [])
    expected = {pid: pc['src'] for pid, pc in O.piece_cells.items() if pc['W'] * pc['H'] > 1 or pc['piece']['kind'] not in ('terrain', 'flat')}
    ver = TB.verify(data, sheet, TPR, expected)
    # 구성기 사전: 한 칸 바닥 id → 칸, 왕 타일 벌 → 16칸(번호 = NW1+NE2+SW4+SE8)
    tiles, wang = {}, collections.OrderedDict()
    for pid, pc in O.piece_cells.items():
        p = pc['piece']
        if pc['W'] * pc['H'] != 1 or (0, 0) not in pc['cells']: continue
        t = pc['cells'][(0, 0)][0]
        if p.get('wang'):
            wang.setdefault(p['wang'], [-1] * 16)[sum(v << i for i, v in enumerate(next(it for it in AT.R.items if 'de-' + it['id'] == pid)['corners']))] = t
        else: tiles[pid] = t
    kits = sorted(k['id'] for k in data['structureKits'])
    pieces_json = dict(version=1, tiles=tiles, wang=wang, kits=kits)
    # 겉모습(게임마다 고르는 재질): 조각 id → 칸. 다 구워진 재질·벌만 싣는다(구성기는 없으면 원래 칸으로 돌아간다).
    lk = variety.get('looks')
    if lk:
        cell = lambda pid: O.piece_cells[pid]['cells'][(0, 0)][0]
        lt = {name: {piece: cell(pid) for piece, pid in m.items()} for name, m in lk['tiles'].items() if all(pid in lk['ok'] for pid in m.values())}
        lw = {sid: {name: [cell(pid) for pid in ids] for name, ids in sets.items() if all(pid in lk['ok'] for pid in ids)} for sid, sets in lk['wang'].items()}
        pieces_json['looks'] = dict(parts={part: [n for n in names if not n or n in lt] for part, names in lk['parts'].items()}, clash=lk['clash'], tiles=lt, wang=lw)
        for name in tiles_drop(tiles): tiles.pop(name)
    report['tiles'] = dict(count=count, rows=-(-count // TPR), kits=len(data['structureKits']), groups=len(data['tileGroups']), pieces=len(pieces),
                           single_tiles=len(tiles), wang_sets={k: sum(1 for t in v if t >= 0) for k, v in wang.items()})
    report.update(ver)
    if dry: return report
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    wr(P['pieces'], pieces_json, separators=(',', ':'))
    pins.save()
    wr(P['report'], report, indent=1)
    return report


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    r = bake(dry=a.dry)
    print(json.dumps(r['tiles'], ensure_ascii=False)); print('재조립', r['reassembly'])
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'])
    print('관문', {k: (v if not isinstance(v, list) else len(v)) for k, v in r['gate'].items()})
    for b in r['gate']['blocked']: print('  막힘', b)
