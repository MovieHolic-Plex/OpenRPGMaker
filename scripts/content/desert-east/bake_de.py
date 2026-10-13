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
GROUP_KO = dict(terrain='바닥', buildings='건물·유적', props='소품', interior='실내')
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
    report['gate'] = dict(provisional_profile_uncalibrated=prov, blocked=blocked, pieces=len(pieces), wang=wang_ok)
    return pieces, AT


def bake(dry=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'de', '사막·동양풍')
    pieces, AT = build_pieces(report)
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
