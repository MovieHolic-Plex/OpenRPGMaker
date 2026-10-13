#!/usr/bin/env python3
"""prehistoric 굽기 — art/ 의 다섯 등록부(바닥·가장자리 · 집·동굴 · 식물·바위 · 야영·의식·화석·물 건너기 · 실내) 중 object-gate 통과분을 한 시트로.

  python3 scripts/content/prehistoric/bake_ph.py          # 쓰기
  python3 scripts/content/prehistoric/bake_ph.py --dry    # 보고만
  python3 scripts/content/prehistoric/bake_ph.py --dev    # 관문 무시(구성기 시험용 — 커밋 금지, 보고서에 dev 표시)

산출: public/assets/prehistoric/prehistoric-chipset.png · src/assets/prehistoricTileset.json · src/assets/prehistoricSheet.json
      tiledata/prehistoric/bake-pins.json · bake-report.json
3/4 관문: 낱 조각은 그림 화소 해시의 object-gate 영수증이 pass 여야 한다. 가장자리 낱칸(w-*)·실내 벽면·천장·벽화 칸은 혼자 윗면을 보일 수 없는
부품이라 그 칸을 화소 그대로 품은 조립 표본(terrain/_gate_assembled · interior/_gate_assembled, kind terrain)의 영수증으로 덮는다.
움직이는 조각(물·늪·용암·모닥불·화톳불·횃불·타르·증기 구멍·화덕·등잔)은 정지 그림과 같은 id 의 애니메이션 키트로 굽는다(프레임 0 = 정지 그림).
"""
import argparse, collections, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'art'))
import ph_bake_lib as TB   # noqa: E402
BL = TB.BL
from palette import check_palette   # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'prehistoric', '선사 시대 원시 세계 (손 도트)', 'tex_prehistoric', 'oprn-prehistoric'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'prehistoric')
P = dict(png=os.path.join(ROOT, 'public/assets/prehistoric/prehistoric-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/prehistoricTileset.json'), sheet=os.path.join(ROOT, 'src/assets/prehistoricSheet.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'))
GROUP_KO = dict(terrain='바닥·가장자리·물', dwellings='집·동굴', nature='식물·바위', props='야영·의식·화석·물 건너기', interior='실내')
THEME = '선사'

# 다칸 조각의 칸 통행: foot = 맨 아래 막힘 줄 수(그 위는 별). 0 이면 전부 별.
FOOT = {'torch': 1, 'menhir': 1, 'menhir-tall': 1, 'totem': 1, 'totem-b': 1, 'skull-pole': 1, 'bridge-post': 1, 'palisade': 1,
        'drying-rack': 1, 'fish-rack': 1, 'hide-frame': 1, 'skull-shelf': 1, 'hearth': 1, 'fur-bed': 1, 'chief-seat': 1, 'cycad': 1,
        'granary': 2}
# 덩이 판정: 밑줄 칸 중 밑 6줄에 불투명 화소가 12 개 이상인 칸만 막힘, 나머지는 별(나무 수관·뼈대 사이로 지나간다).
SMART = {'jungle-tree', 'araucaria', 'swamp-tree', 'tree-fern', 'dead-tree', 'fern-giant', 'stone-circle', 'ribcage', 'longneck', 'dino-skull',
         'basalt-columns', 'rock-outcrop', 'rock-l', 'rock-mossy', 'fossil-rock', 'volcano-s', 'woodpile', 'berry-bush', 'horsetail', 'stalagmite'}
SMART_ROWS = {'ribcage': 2, 'longneck': 2, 'volcano-s': 3, 'rock-outcrop': 2, 'rock-l': 2, 'rock-mossy': 2, 'fossil-rock': 2, 'basalt-columns': 2}
SUNKEN = ('swamp', 'water', 'lava')
BLOCKED = ({'swamp', 'water', 'lava', 'tarpit', 'ceil'} | {'ceil-' + k for k in ('n', 'e', 'w', 'ne', 'nw', 'ew', 'new')})


def blocked_piece(iid):
    if iid in BLOCKED or iid.startswith(('wall-', 'paint-')): return True
    if iid.startswith('w-'):
        _, pair, key = iid.split('-')
        return pair in SUNKEN and key.count('1') >= 2
    return False


def _regs():
    import terrain as AT, dwellings as AD, nature as AN, props as AP, interior as AI   # noqa: E401
    anims = list(AT.ANIM) + list(AP.ANIM) + list(AI.ANIM)
    return (AT.R, AD.R, AN.R, AP.R, AI.R), anims


def smart_cells(png, W, H, rows=1):
    """밑 rows 줄 칸 중 밑 6줄에 불투명 화소가 12 개 이상인 칸 (x, y)."""
    a = np.asarray(Image.open(png).convert('RGBA'))[:, :, 3]
    out = []
    for y in range(H - rows, H):
        for x in range(W):
            c = a[y * 16 + 10:y * 16 + 16, x * 16:x * 16 + 16]
            if int((c > 0).sum()) >= 12: out.append((x, y))
    return out


def build_pieces(report, dev=False):
    regs, anims = _regs()
    items, by = [], {}
    for reg in regs:
        for it in reg.items:
            png = os.path.join(TD, reg.group, '_gate', 'ph-%s.png' % it['id'])
            d = dict(it, group=reg.group, png=png); items.append(d); by[it['id']] = d
    frame_ids = {f for _, _, fs, _ in anims for f in fs[1:]}
    anim_base = {fs[0]: (aid, n, fs, fps) for aid, n, fs, fps in anims}
    pieces, prov, covered, blocked = [], 0, 0, []

    def status(it):
        nonlocal prov, covered
        if not os.path.exists(it['png']): return 'PNG 없음 — art 내보내기 먼저'
        if dev: return True
        if it['id'].startswith(('w-', 'wall-', 'paint-', 'ceil')):
            s = TB.covered_status(it['id'], it['png'])
            if s in ('pass', 'prov'): covered += 1
        else:
            s = TB.gate_status(it['png'], it['kind'])
        if s == 'pass': return True
        if s == 'prov': prov += 1; return True
        return s

    for it in items:
        if it['id'] in frame_ids: continue
        ok = status(it)
        if ok is not True: blocked.append((it['id'], ok)); continue
        g = it['group']; iid = it['id']
        role = ('terrain' if it['kind'] in ('terrain', 'flat') and g != 'interior' else 'building' if g == 'dwellings' else 'fence' if iid == 'palisade'
                else 'wall' if iid.startswith(('wall-', 'paint-', 'ceil')) else 'terrain' if it['kind'] == 'terrain' else 'prop')
        where = '실내' if g == 'interior' else '야외'
        desc = f"{it['name']}. 선사 시대 원시 세계 {where} {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면)."
        p = dict(id='ph-' + iid, name=it['name'], kind=it['kind'], png=it['png'], group='ph-' + g, group_ko=GROUP_KO[g], desc=desc, role=role,
                 tags=list(it.get('tags') or []) + (['실내'] if g == 'interior' else []), rules=it.get('rules') or '')
        if iid in FOOT: p['foot'] = FOOT[iid]
        if iid in SMART and it['w'] * it['h'] > 1:
            p['solid_cells'] = smart_cells(it['png'], it['w'], it['h'], SMART_ROWS.get(iid, 1))
            if it['kind'] == 'debris': p['kind_pc'] = 'structure'
        if iid in ('lily', 'raft'): p['kind_pc'] = 'debris'   # 물 위 덧그림은 ★ — 밑의 물이 통행을 정한다(연잎을 밟고 물을 건너지 않게)
        if iid == 'tarpit': p['kind_pc'] = 'structure'          # 타르 웅덩이는 가장자리 투명 칸까지 통째로 막힌다
        if blocked_piece(iid): p['blocked'] = True
        if g == 'dwellings':
            p['entrance'] = list(it.get('entrance') or [])
            p['rules'] = ((it.get('rules') or '') + ' 집 하나를 키트로 찍는다. 문 칸(entrance)은 막힘이고 그 바로 아래 칸(접근칸)은 길로 비워 둔다. '
                          '집 둘레 1칸·문 앞 2칸은 소품을 두지 않는다.').strip()
        elif it['kind'] == 'terrain' and not p['rules']: p['rules'] = '한 칸 바닥 — 넓게 칠한다.'
        if iid.startswith('w-'):
            p['rules'] = '꼭짓점 가장자리 낱칸(NW NE SW SE = 1 이면 그 모서리가 안 재질). compose_prehistoric_map 이 꼭짓점 격자로 고른다 — 손으로 칠하지 않는다.'
        if iid in anim_base:
            aid, an, fs, fps = anim_base[iid]
            fr = [by.get(f) for f in fs]
            bad = [f for f, x in zip(fs, fr) if x is None or status(x) is not True]
            if bad: blocked.append((iid + ' 애니메이션', '프레임 관문 미통과/누락 ' + ','.join(bad)))
            else:
                p.update(frames=[x['png'] for x in fr], fps=fps)
                p['tags'] = p['tags'] + ['애니메이션']
                p['desc'] = f"{an} — {len(fr)}프레임 반복(칸 {it['w']}×{it['h']}). " + p['desc']
        pieces.append(p)
    report['gate'] = dict(dev_no_gate=dev, provisional_profile_uncalibrated=prov, covered_by_assembled=covered, blocked=blocked, pieces=len(pieces),
                          outdoor=sum(1 for p in pieces if p['group'] != 'ph-interior'), interior=sum(1 for p in pieces if p['group'] == 'ph-interior'))
    return pieces


def bake(dry=False, dev=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'ph', THEME)
    pieces = build_pieces(report, dev)
    for p in pieces:
        if p.get('kind_pc'):
            k = p['kind']; p['kind'] = p['kind_pc']; O.add_piece(p); p['kind'] = k
        else: O.add_piece(p)
    O.finish_pieces(pieces, lambda p: p.get('role', 'prop'), '바닥(아래층).')
    data, sheet, count = TB.finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, [], [])
    expected = {pid: pc['src'] for pid, pc in O.piece_cells.items() if pc['W'] * pc['H'] > 1 or pc['piece']['kind'] not in ('terrain', 'flat')}
    ver = TB.verify(data, sheet, TPR, expected)
    bad_pal = check_palette(sheet)
    report['tiles'] = dict(count=count, rows=-(-count // TPR), sheetPx=[TPR * 16, -(-count // TPR) * 16], strips=len(data['animationStrips']),
                           kits=len(data['structureKits']), groups=len(data['tileGroups']))
    report['palette_violations'] = len(bad_pal)
    report.update(ver)
    out = dict(data=data, sheet=sheet, report=report, pieces=pieces)
    if dry: return out
    assert not bad_pal, ('팔레트 밖 색', bad_pal[:8])
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    pins.save()
    wr(P['report'], report, indent=1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); ap.add_argument('--dev', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry, dev=a.dev); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'reassembly', 'palette_violations')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'])
    g = r['gate']; print('관문', {k: v for k, v in g.items() if k != 'blocked'}); [print('  막힘', b) for b in g['blocked'][:40]]
    if len(g['blocked']) > 40: print('  …', len(g['blocked']))
