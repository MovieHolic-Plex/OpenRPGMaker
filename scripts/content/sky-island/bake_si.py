#!/usr/bin/env python3
"""sky_island 굽기 — art/ 의 네 등록부(지형·건물·소품·실내) 중 object-gate 영수증이 pass 인 조각만 16px 칸으로 잘라 한 시트로.

  python3 scripts/content/sky-island/bake_si.py          # 쓰기
  python3 scripts/content/sky-island/bake_si.py --dry    # 보고만

먼저 조각을 내보낸다(art/<group>.py 를 돌리면 tiledata/sky-island/<group>/_gate/ 에 PNG·items.jsonl) → object-gate review --batch → 이 굽기.
산출: public/assets/sky-island/sky-island-chipset.png · src/assets/skyIslandTileset.json · src/assets/skyIslandSheet.json
      tiledata/sky-island/bake-pins.json(자리 키 → 칸 번호, 덧붙이기 전용) · bake-report.json
칸 통행은 조각이 정한다(art 등록부의 pc). 없으면 종류로: 지형·바닥 표시는 걷는 바닥, 건물은 전부 막힘, 키 큰 소품은 윗줄 ★·맨 아랫줄 막힘.
"""
import argparse, collections, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'art'))
import si_bake_lib as TB   # noqa: E402
BL = TB.BL
from si_gate_kinds import GATE_KIND   # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'sky_island', '하늘섬 (손 도트)', 'tex_sky_island', 'oprn-sky'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'sky-island')
P = dict(png=os.path.join(ROOT, 'public/assets/sky-island/sky-island-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/skyIslandTileset.json'), sheet=os.path.join(ROOT, 'src/assets/skyIslandSheet.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'))
GROUP_KO = dict(terrain='섬·구름·다리 바닥', buildings='건물', props='섬 소품', interior='실내')
FENCE_IDS = {'fence-h', 'fence-v', 'fence-w', 'fence-e'}
TREE_IDS = {'tree-round', 'tree-blossom', 'tree-pine', 'tree-young', 'bush', 'bush-flower'}


def items():
    import terrain as AT, buildings as AB, props as AP, interior as AI   # noqa: E401
    out = []
    for reg in (AT.R, AB.R, AP.R, AI.R):
        for it in reg.items:
            pngs = reg.pngs(it)
            out.append(dict(it, group=reg.group, pngs=pngs, gate_kind=GATE_KIND.get(it['id'], it['kind'])))
    return out


def role_of(it):
    if it['group'] == 'buildings' or it['id'] in ('stall', 'airship'): return 'building'
    if it['id'] in FENCE_IDS: return 'fence'
    if it['group'] == 'interior' and it['id'].startswith(('wall-', 'void')): return 'wall'
    if it['gate_kind'] in ('terrain', 'flat') and it['w'] * it['h'] == 1: return 'terrain'
    return 'prop'


def build_pieces(report):
    pieces, prov, blocked = [], 0, []
    for it in items():
        if not all(os.path.exists(p) for p in it['pngs']): blocked.append((it['id'], 'PNG 없음 — art 내보내기 먼저')); continue
        bad = None
        for p in it['pngs']:
            s = TB.gate_status(p, it['gate_kind'])
            if s == 'prov': prov += 1
            elif s != 'pass': bad = s; break
        if bad: blocked.append((it['id'], bad[:120])); continue
        g = it['group']
        role = role_of(it)
        desc = f"{it['name']}. 하늘섬 {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면)."
        rules = it.get('rules') or ''
        p = dict(id='si-' + it['id'], name=it['name'], kind=it['gate_kind'], png=it['pngs'][0], group='si-' + g, group_ko=GROUP_KO[g], desc=desc, role=role,
                 tags=list(it.get('tags') or []) + (['나무'] if it['id'] in TREE_IDS else []), rules=rules, pc=it.get('pc'))
        if len(it['pngs']) > 1: p['frames'] = it['pngs']; p['fps'] = 4
        if g == 'buildings' and it.get('entrance'):
            p['entrance'] = list(it['entrance'])
            p['rules'] = (rules + ' 문 칸(entrance)은 막힘이고 바로 아래 칸(접근칸)은 길로 비운다. 건물 둘레 1칸·문 앞 2칸에 나무·소품을 두지 않는다.').strip()
        pieces.append(p)
    report['gate'] = dict(provisional_profile_uncalibrated=prov, blocked=blocked, pieces=len(pieces))
    return pieces


def bake(dry=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'si', '하늘섬')
    pieces = build_pieces(report)
    for p in pieces: O.add_piece(p)
    O.finish_pieces(pieces, lambda p: p.get('role', 'prop'), '하늘섬 바닥(아래층).')
    data, sheet, count = TB.finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, [], [])
    expected = {pid: pc['src'] for pid, pc in O.piece_cells.items() if pc['W'] * pc['H'] > 1 or pc['piece']['kind'] not in ('terrain', 'flat')}
    ver = TB.verify(data, sheet, TPR, expected)
    report['tiles'] = dict(count=count, rows=-(-count // TPR), sheetPx=[TPR * 16, -(-count // TPR) * 16], strips=len(data['animationStrips']),
                           kits=len(data['structureKits']), groups=len(data['tileGroups']), pieces=len(pieces))
    report.update(ver)
    out = dict(data=data, sheet=sheet, report=report)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    pins.save()
    wr(P['report'], report, indent=1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'reassembly')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'])
    print('관문', {k: (v if not isinstance(v, list) else len(v)) for k, v in r['gate'].items()})
    for b in r['gate']['blocked']: print('  막힘', b)
