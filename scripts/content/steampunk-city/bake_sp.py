#!/usr/bin/env python3
"""steampunk_city 굽기 — art/ 의 일곱 등록부(바닥·건물·거리 소품·배관·탈것·거리/마당 기물·실내) 중 object-gate 통과분을 한 시트로.

  python3 scripts/content/steampunk-city/bake_sp.py          # 쓰기
  python3 scripts/content/steampunk-city/bake_sp.py --dry    # 보고만

산출: public/assets/steampunk-city/steampunk-city-chipset.png · src/assets/steampunkCityTileset.json · src/assets/steampunkCitySheet.json
      tiledata/steampunk-city/bake-pins.json · bake-report.json
3/4 관문: 모든 조각은 그림 화소 해시의 object-gate 영수증이 pass 여야 한다(sp_bake_lib.gate_status). 막힌 조각은 굽지 않고 보고서 blocked 에 남긴다.
움직이는 조각(물·증기 구멍·굴뚝 연기·보일러·기관·테슬라 코일·벽난로)은 정지 그림과 같은 id 의 애니메이션 키트로 굽는다(프레임 0 = 정지 그림).
"""
import argparse, collections, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'art'))
import sp_bake_lib as TB   # noqa: E402
BL = TB.BL
from palette import check_palette   # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'steampunk_city', '스팀펑크 도시 (손 도트)', 'tex_steampunk_city', 'oprn-steampunk'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'steampunk-city')
P = dict(png=os.path.join(ROOT, 'public/assets/steampunk-city/steampunk-city-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/steampunkCityTileset.json'), sheet=os.path.join(ROOT, 'src/assets/steampunkCitySheet.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'))
GROUP_KO = dict(terrain='바닥·길·물', buildings='건물', props='거리 소품', pipes='배관 도랑', vehicles='탈것', street='거리·마당 기물', interior='실내')
THEME = '스팀펑크'

# 다칸 조각의 칸 통행: foot = 맨 아래 막힘 줄 수(그 위는 별 — 뒤로 지나가면 위에 그려진다). 0 이면 전부 별(머리 위 겹침).
FOOT = {
    'gas-lamp': 1, 'plaza-lamp': 1, 'barrel': 1, 'steam-vent': 1, 'stack-smoke': 0, 'water-tower': 2,
    'stall-fruit': 2, 'stall-parts': 2, 'stall-fish': 2,
    'locomotive': 2, 'tender': 2, 'coach': 2, 'wagon-coal': 2, 'wagon-box': 2, 'steam-tram': 2,
    'clock-post': 1, 'pillar-box': 1, 'poster-column': 1, 'gear-monument': 1, 'gasometer': 3, 'rail-signal': 1, 'buffer-stop': 1,
    'chimney': 1, 'jib-crane': 2, 'mooring-mast': 1, 'airship-docked': 2, 'tram-shelter': 1,
    'boiler': 2, 'engine': 2, 'tesla-coil': 1, 'drill-press': 1, 'curio-cabinet': 1, 'bookshelf': 1, 'wardrobe': 1, 'dresser': 1,
    'pipe-wall': 2, 'wall-clock-gear': 2,
}
SOLID_CELLS = {'gantry-crane': [(0, 4), (4, 4), (0, 3), (4, 3)]}
# 걸을 수 없는 바닥(물·석축·배관 도랑·승강장/부두 끝·실내 벽면·천장)
BLOCKED = ({'water', 'quay', 'platform-edge', 'deck-edge', 'ceiling', 'wall-door-u'}
           | {'pipe-' + s for s in ('ew', 'ns', 'ne', 'nw', 'se', 'sw', 'new', 'sew', 'nes', 'nsw', 'e', 'w', 'n', 's')}
           | {'wall-%s-%s' % (m, ud) for m in ('brick', 'panel', 'iron', 'window') for ud in ('u', 'd')})
FENCE_IDS = {'fence', 'fence-h3', 'fence-v'}
WATER_ANIM = [('water', '운하 물(잔물결)', ['water', 'water-f1', 'water-f2'], 3)]


def _regs():
    import terrain as AT, buildings as AB, props as AP, pipes as API, vehicles as AV, street as AS, interior as AI   # noqa: E401
    anims = WATER_ANIM + [(a[:-5] if a.endswith('-anim') else a, n, f, fps) for a, n, f, fps in list(AP.ANIM) + list(AI.ANIM)]
    return (AT.R, AB.R, AP.R, API.R, AV.R, AS.R, AI.R), anims


def build_pieces(report):
    regs, anims = _regs()
    items, by = [], {}
    for reg in regs:
        for it in reg.items:
            png = os.path.join(TD, reg.group, '_gate', 'sp-%s.png' % it['id'])
            d = dict(it, group=reg.group, png=png); items.append(d); by[it['id']] = d
    frame_ids = {f for _, _, fs, _ in anims for f in fs[1:]}
    anim_base = {fs[0]: (aid, n, fs, fps) for aid, n, fs, fps in anims}
    pieces, prov, blocked = [], 0, []

    def status(it):
        nonlocal prov
        if not os.path.exists(it['png']): return 'PNG 없음 — art 내보내기 먼저'
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
                else 'wall' if iid.startswith('wall-') or iid == 'ceiling' else 'terrain' if it['kind'] == 'terrain' else 'prop')
        where = '실내' if g == 'interior' else '야외'
        desc = f"{it['name']}. 스팀펑크 도시 {where} {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면)."
        p = dict(id='sp-' + iid, name=it['name'], kind=it['kind'], png=it['png'], group='sp-' + g, group_ko=GROUP_KO[g], desc=desc, role=role,
                 tags=list(it.get('tags') or []) + (['실내'] if g == 'interior' else []), rules=it.get('rules') or '')
        if iid in FOOT: p['foot'] = FOOT[iid]
        if iid in SOLID_CELLS: p['solid_cells'] = SOLID_CELLS[iid]
        if iid in BLOCKED: p['blocked'] = True
        if g == 'buildings':
            p['entrance'] = list(it.get('entrance') or [])
            p['rules'] = ((it.get('rules') or '') + ' 건물 하나를 키트로 찍는다. 문 칸(entrance)은 막힘이고 그 바로 아래 칸(접근칸)은 보도로 비워 둔다. '
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
    report['gate'] = dict(provisional_profile_uncalibrated=prov, blocked=blocked, pieces=len(pieces),
                          outdoor=sum(1 for p in pieces if p['group'] != 'sp-interior'), interior=sum(1 for p in pieces if p['group'] == 'sp-interior'))
    return pieces


def bake(dry=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'sp', THEME)
    pieces = build_pieces(report)
    for p in pieces: O.add_piece(p)
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
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'reassembly', 'palette_violations')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'])
    g = r['gate']; print('관문', {k: v for k, v in g.items() if k != 'blocked'}); [print('  막힘', b) for b in g['blocked']]
