#!/usr/bin/env python3
"""snow_north 굽기 — art/ 의 등록부(바닥 낱칸 · 오토타일 6 · 건물 · 야외 소품 · 실내) 중 object-gate 통과분을 한 시트로.

  python3 scripts/content/snow-north/bake_sn.py          # 쓰기
  python3 scripts/content/snow-north/bake_sn.py --dry    # 보고만

산출: public/assets/snow-north/snow-north-chipset.png · src/assets/snowNorthTileset.json · src/assets/snowNorthSheet.json
      tiledata/snow-north/bake-pins.json · bake-report.json
3/4 관문: 낱 조각은 그림 화소 해시의 object-gate 영수증이 pass 여야 한다. 부품(목책·울타리·굴뚝 연기)은 그 부품을 화소 그대로 품은
조립 그림(art/gate_assembled.py, kind structure)의 영수증으로 덮는다. 오토타일 칸(47 모양 + 속 변형 2)은 그 칸을 화소 그대로 품은
견본 그림(terrain/_gate/sn-at-<id>.png, kind terrain)의 영수증으로 덮는다(칸 바이트가 견본 격자 칸 중 하나와 같아야 한다).
움직이는 조각(열린 물·화로·모닥불·굴뚝 연기·실내 화덕 등)은 정지 그림과 같은 id 의 애니메이션 키트로 굽는다(프레임 0 = 정지 그림).
"""
import argparse, collections, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'art'))
import sn_bake_lib as TB   # noqa: E402
BL = TB.BL
from palette import check_palette   # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'snow_north', '북방 설원 (손 도트)', 'tex_snow_north', 'oprn-snow'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'snow-north')
P = dict(png=os.path.join(ROOT, 'public/assets/snow-north/snow-north-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/snowNorthTileset.json'), sheet=os.path.join(ROOT, 'src/assets/snowNorthSheet.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'))
GROUP_KO = dict(terrain='눈·얼음·땅', buildings='건물·지형 구조물', props='야외 소품', interior='실내')
THEME = '설원'

# 다칸 조각의 칸 통행: foot = 맨 아래 막힘 줄 수(그 위는 별 — 뒤로 지나가면 위에 그려진다).
FOOT = {'signpost': 1, 'lamp-post': 1, 'cairn': 1, 'rune-stone': 1, 'ski-rack': 1, 'cauldron': 1, 'brazier': 1,
        'fish-rack': 1, 'hide-rack': 1, 'stall-fish': 1, 'stall-fur': 1, 'stall-wares': 1, 'palisade': 1, 'woodpile': 1, 'well': 1,
        'crates': 1, 'bonfire': 1, 'watchtower': 2}
SOLID_CELLS = {'palisade-gate': [(0, 3), (3, 3), (0, 2), (3, 2)]}
PARTS = {'palisade', 'palisade-v', 'fence', 'fence-v', 'smoke', 'smoke-f1', 'smoke-f2'}
FENCE_IDS = {'palisade', 'palisade-v', 'fence', 'fence-v', 'ice-wall', 'ice-wall-post'}
WATER_ANIM = [('water', '열린 물(잔물결)', ['water', 'water-f1', 'water-f2'], 3)]


def blocked_piece(iid):
    return iid in ('water', 'water-f1', 'water-f2') or iid.startswith(('ceiling', 'wall-')) and not iid.startswith('wall-door-d')


def _regs():
    import terrain as AT, buildings as AB, props as AP   # noqa: E401
    regs, anims = [AT.R, AB.R, AP.R], WATER_ANIM + list(AP.ANIM)
    try:
        import interior as AI
        regs.append(AI.R); anims += list(AI.ANIM)
    except ImportError:
        pass
    return regs, [(a[:-5] if a.endswith('-anim') else a, n, f, fps) for a, n, f, fps in anims]


def build_pieces(report):
    regs, anims = _regs()
    items, by = [], {}
    for reg in regs:
        for it in reg.items:
            png = os.path.join(TD, reg.group, '_gate', 'sn-%s.png' % it['id'])
            d = dict(it, group=reg.group, png=png); items.append(d); by[it['id']] = d
    frame_ids = {f for _, _, fs, _ in anims for f in fs[1:]}
    anim_base = {fs[0]: (aid, n, fs, fps) for aid, n, fs, fps in anims}
    pieces, prov, covered, blocked = [], 0, 0, []

    def status(it):
        nonlocal prov, covered
        if not os.path.exists(it['png']): return 'PNG 없음 — art 내보내기 먼저'
        if it['id'] in PARTS:
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
        role = ('terrain' if it['kind'] in ('terrain', 'flat') and g != 'interior' else 'building' if g == 'buildings' else 'fence' if iid in FENCE_IDS
                else 'wall' if iid.startswith(('wall-', 'ceiling')) else 'terrain' if it['kind'] == 'terrain' else 'prop')
        where = '실내' if g == 'interior' else '야외'
        desc = f"{it['name']}. 북방 설원 {where} {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면)."
        p = dict(id='sn-' + iid, name=it['name'], kind=it['kind'], png=it['png'], group='sn-' + g, group_ko=GROUP_KO[g], desc=desc, role=role,
                 tags=list(it.get('tags') or []) + (['실내'] if g == 'interior' else []), rules=it.get('rules') or '')
        if iid in PARTS: p['kind_pc'] = 'debris' if iid.startswith('smoke') else 'structure'
        if iid in FOOT: p['foot'] = FOOT[iid]
        if iid in SOLID_CELLS: p['solid_cells'] = SOLID_CELLS[iid]
        if blocked_piece(iid): p['blocked'] = True
        if it.get('entrance'):
            p['entrance'] = list(it['entrance'])
            p['rules'] = ((it.get('rules') or '') + ' 키트 하나로 찍는다. 문 칸(entrance)은 막힘이고 그 바로 아래 칸(접근칸)은 눈길로 비워 둔다. '
                          '건물 둘레 1칸·문 앞 2칸은 소품을 두지 않는다.').strip()
        elif it['kind'] == 'terrain' and not p['rules']: p['rules'] = '한 칸 바닥 — 넓게 칠한다.'
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
    report['gate'] = dict(provisional_profile_uncalibrated=prov, covered_by_assembled=covered, blocked=blocked, pieces=len(pieces),
                          outdoor=sum(1 for p in pieces if p['group'] != 'sn-interior'), interior=sum(1 for p in pieces if p['group'] == 'sn-interior'))
    return pieces


def bake_autotiles(O, report):
    """오토타일 6 그룹: 47 모양 칸 + 속 변형 2 칸. 견본 그림 영수증 + 칸 바이트 일치로 덮는다. 엔진 비트 = autotileEngine AUTOTILE_DIR 과 같다."""
    import terrain as T, autotile as AT
    groups, tgroups, tiles_by = [], [], {}
    ok_n = 0
    for a in T.AUTOTILES:
        gid = a['id']
        sample = os.path.join(TD, 'terrain', '_gate', 'sn-at-%s.png' % gid)
        st = TB.gate_status(sample, 'terrain')
        if st not in ('pass', 'prov'):
            report['gate']['blocked'].append(('at-' + gid, '견본 ' + st)); continue
        cellset = TB.cell_set(sample)
        d = os.path.join(TD, 'autotile', gid)
        blocked = gid == 'water'
        pc = 'solidfloor' if blocked else 'floor'
        tmap, miss = {}, []
        for m in AT.CANON:
            im = BL.norm(Image.open(os.path.join(d, 'm%03d.png' % m)).convert('RGBA'))
            if im.tobytes() not in cellset: miss.append(m); continue
            meta = dict(label=f"{a['name']} (모양 {m})", desc=f"{a['name']} 오토타일 칸 — {a['inside']} 안쪽, {a['outside']} 쪽으로 가장자리 둑. — {BL.PCNOTE[pc]}.",
                        role='terrain', tags=[THEME, '오토타일', a['name']], rep='auto', piece='sn-at-' + gid)
            tmap[m] = O.put(f'at/{gid}/m{m}!', im, pc, meta)
        bodies = []
        for k in (1, 2):
            im = BL.norm(Image.open(os.path.join(d, 'b%d.png' % k)).convert('RGBA'))
            if im.tobytes() not in cellset: miss.append('b%d' % k); continue
            meta = dict(label=f"{a['name']} 속 변형 {k}", desc=f"{a['name']} 가득 찬 속 칸 변형 — {BL.PCNOTE[pc]}.", role='terrain',
                        tags=[THEME, '오토타일', a['name']], rep='auto', piece='sn-at-' + gid)
            bodies.append(O.put(f'at/{gid}/b{k}!', im, pc, meta))
        if any(isinstance(x, int) for x in miss):
            report['gate']['blocked'].append(('at-' + gid, '견본에 없는 모양 ' + ','.join(map(str, miss)))); continue
        vm = {str(m): tmap[AT.canon(m)] for m in range(256)}
        members = sorted(set(tmap.values()) | set(bodies))
        tiles_by[gid] = members
        groups.append(dict(id=f'sn-at-{gid}', name=f"{a['name']} (설원 오토타일)", neighborhood=8, memberTileIds=members, variantMap=vm,
                           interiorVariants=[[tmap[255]] + bodies], layer='lower'))
        tgroups.append(dict(id=f'sn:at-{gid}', name=a['name'], role='terrain', tileIds=set(members),
                            description=f"{a['name']} 오토타일 — {a['inside']} 덩이. 가장자리는 {a['outside']} 쪽 둑으로 저절로 맞는다.",
                            placementRules=(a.get('rules') or '') + ' 덩이로 칠하면 47 모양 가장자리가 맞는다(낱칸 번호로 칠하지 않는다).'))
        ok_n += 1
    # 얼음은 열린 물을 이어진 이웃으로 본다(얼음 구멍 둘레에 눈 둑을 만들지 않는다).
    for g in groups:
        if g['id'] == 'sn-at-ice' and 'water' in tiles_by:
            g['connectTileIds'] = sorted(set(g['memberTileIds']) | set(tiles_by['water']))
            g['triggerTileIds'] = g['connectTileIds']
    report['autotiles'] = dict(groups=ok_n)
    return groups, tgroups


def bake(dry=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'sn', THEME)
    pieces = build_pieces(report)
    for p in pieces:
        if p.get('kind_pc'):
            k = p['kind']; p['kind'] = p['kind_pc']; O.add_piece(p); p['kind'] = k
        else: O.add_piece(p)
    O.finish_pieces(pieces, lambda p: p.get('role', 'prop'), '바닥(아래층).')
    agroups, tgroups = bake_autotiles(O, report)
    data, sheet, count = TB.finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, tgroups, [])
    data['autotileGroups'] = agroups
    expected = {pid: pc['src'] for pid, pc in O.piece_cells.items() if pc['W'] * pc['H'] > 1 or pc['piece']['kind'] not in ('terrain', 'flat')}
    ver = TB.verify(data, sheet, TPR, expected)
    bad_pal = check_palette(sheet)
    report['tiles'] = dict(count=count, rows=-(-count // TPR), sheetPx=[TPR * 16, -(-count // TPR) * 16], strips=len(data['animationStrips']),
                           kits=len(data['structureKits']), groups=len(data['tileGroups']), autotiles=len(agroups))
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
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'reassembly', 'palette_violations', 'autotiles')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'])
    g = r['gate']; print('관문', {k: v for k, v in g.items() if k != 'blocked'}); [print('  막힘', b) for b in g['blocked'][:40]]
