#!/usr/bin/env python3
"""modern_city 한국 건물 60종(mc-bld-kr-*)·옥상 기물(mc-roof-kr-*)·시골 기물(mc-prop-krr-*)을 번들 시트 끝에 덧붙인다.

  python3 scripts/content/modern-city-street/bake_kr_buildings.py [--dry]     # 관문 출구 규칙 확인 → 시트·정의·핀
  python3 scripts/content/modern-city-street/bake_kr_buildings.py gate        # 관문 상태만
  python3 scripts/content/modern-city-street/bake_kr_buildings.py manifest <out.json>   # owner-waive 단계에 줄 목록

원본: tiledata/modern-city/kr-buildings/ — buildings.txt · roof.txt · rural.txt(목록), parts/(Fable 5.2 한 방 부품), recipes.txt(조립법, kr_buildings_asm.py),
pieces/(굽는 그림 — 건물은 조립 결과, 기물은 그린 그대로). 그림은 **그대로** 굽는다(한 화소라도 바뀌면 오너 면제가 풀린다).
3/4 관문 미통과 — 오너 면제 묶음 fable-krbuildings-2026-11-14. 출구 검사는 관문 자신의 규칙 하나(object_gate.refusal … context='bundle').
덧붙이기 전용. 번호는 이름 핀 krb:<키트>:<x>,<y>. pieces/ 에 그림이 없는 항목은 건너뛴다(아직 안 그렸거나 DROPPED).
순서: … bake_kr → bake_story → 이것. bake_tileset.py main 이 이어 부른다.
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
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
D = os.path.join(ROOT, 'tiledata/modern-city/kr-buildings')
OWN = os.path.join(D, 'baked.json')
REPORT = os.path.join(D, 'bake-report.json')
WAIVER = 'fable-krbuildings-2026-11-14'
NOTE = '3/4 관문 미통과 — 오너 면제 그림(%s).' % WAIVER
T = 16
TIER_KO = dict(small='소형', medium='중형', large='대형', xlarge='초대형', landmark='랜드마크')
SET_KO = dict(vinyl='비닐하우스 마당', paddy='논', chili='고추 말리는 마당', jangdok='장독대', hall='마을 회관 앞', machine='농기계', nonghyup='농협 창고 앞',
              busstop='시골 버스 정류장', orchard='과수원', barn='축사', fishing='어촌', mountain='산길')


def lines(name):
    return [l.rstrip('\n').split('|') for l in open(os.path.join(D, name), encoding='utf-8') if l.strip() and not l.startswith('#')]


def words():
    p = os.path.join(D, 'words.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def items():
    """[dict(id 키트, src, ko, en, w, h, kind 관문 종류, cls, pc(x,y)→칸 통행, …)] — pieces/ 에 그림이 있는 것만."""
    W = words(); out = []
    for i, ko, en, tier, w, h, dx, dw, prog, _sign in lines('buildings.txt'):
        w, h = int(w), int(h); door = [int(dx) + k for k in range(int(dw))] if dx.strip() else []
        out.append(dict(id='mc-bld-kr-' + i, ko=ko, en=en, w=w, h=h, kind='structure', cls='bld', tier=tier, door=door, program=prog.strip() or None, group='mc:building:kr-' + i,
                        tags=['country:kr', 'tier:' + tier, 'setting:city', '한국', '한국 건물', TIER_KO[tier], ko, en] + W.get(i, [])))
    for i, ko, en, w, h in lines('roof.txt'):
        out.append(dict(id='mc-roof-kr-' + i, ko=ko, en=en, w=int(w), h=int(h), kind='other', cls='roof', group='mc:prop:kr-roof',
                        tags=['country:kr', 'setting:city', 'kind:rooftop', '한국', '옥상', '옥상 기물', ko, en] + W.get('roof-' + i, [])))
    for i, s, ko, en, w, h, b in lines('rural.txt'):
        rows = b.split('/'); flat = all(c == '.' for r in rows for c in r)
        out.append(dict(id='mc-prop-krr-' + i, ko=ko, en=en, w=int(w), h=int(h), kind='flat' if flat else 'other', cls='rural', set=s, passRows=rows, flat=flat, group='mc:prop:kr-rural',
                        tags=['country:kr', 'setting:rural', 'kind:' + s, '한국', '시골', SET_KO[s], ko, en] + W.get('krr-' + i, [])))
    got = []
    for it in out:
        p = os.path.join(D, 'pieces', it['id'] + '.png')
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGBA'); assert im.size == (it['w'] * T, it['h'] * T), (it['id'], im.size)
        it['im'] = im; it['png'] = p; got.append(it)
    return got


def gate():
    opened, blocked = [], []
    for it in items():
        why = OG.refusal(it['im'], kind=it['kind'], context='bundle')
        (opened if why is None else blocked).append(it['id'] if why is None else (it['id'], why))
    return opened, blocked


def pc_of(it, x, y):
    if it['cls'] in ('bld', 'roof'): return 'solid'
    c = it['passRows'][y][x]
    return 'flat' if c == '.' else 'star' if c == '*' else 'solid'


def kit_of(it, rows):
    w, h = it['w'], it['h']; ai = dict(tags=['modern-city'] + it['tags'], repeatability='fixed', themes=['현대 도시', '한국'], origin='ai', confidence='high')
    kit = dict(id=it['id'], kind='section', name=it['ko'], width=w, height=h, tileSize=16, learnedFrom='db-authored')
    if it['cls'] == 'bld':
        acc = [dict(dx=x, dy=h) for x in it['door']]
        txt = ('문 앞 접근 칸은 키트 바깥 한 줄 아래: ' + ', '.join('(%d,%d)' % (a['dx'], a['dy']) for a in acc) + '.') if acc else '문이 없는 기념물 — 전부 막힘.'
        ai.update(description=(f"{it['ko']} ({it['en']}) {w}×{h}칸 — 한국 {TIER_KO[it['tier']]} 건물. 정면 + 위에서 본 지붕 면(옥상 기물 포함). 몸통·지붕 칸은 모두 막힘(위층). {txt} {NOTE}")[:400],
                  placementRules='땅(보도·광장·마당) 위 위층. 키트 아래 한 줄이 문 앞 접근 칸이어야 한다. 앞줄 건물은 뒷줄보다 나중에 찍는다. 한 맵에 같은 건물은 한 채.', role='building', layerHome='upper')
        ai['tags'] = ['modern-city', 'building'] + it['tags']
        if acc: ai['access'] = acc
        if it['program']: ai['program'] = it['program']; ai['tags'].append('program:' + it['program'])
        kit['rows'] = [dict(tiles=[-1] * w, upperTiles=r) for r in rows]
        if it['door']: kit['parts'] = [dict(id='door', kind='entrance', dx=it['door'][0], dy=h - 1, w=len(it['door']), h=1, note='문 칸(그림) — 문 칸 자체는 막힘, 바로 아래(키트 바깥 한 줄 아래) 칸이 문 앞 접근 칸')]
    elif it['cls'] == 'roof':
        ai.update(description=(f"{it['ko']} ({it['en']}) {w}×{h}칸 — 건물 지붕 면 위에 얹는 옥상 기물. {NOTE}")[:400],
                  placementRules='건물 키트를 찍은 뒤 그 지붕 면(키트 윗부분의 평지붕 칸) 위 4층(겹침)에 찍는다. 땅에는 놓지 않는다. 지붕 난간 안쪽에 들어가게.', role='prop', layerHome='upper')
        ai['tags'] = ['modern-city', '주제 소품'] + it['tags']
        kit['rows'] = [dict(tiles=[-1] * w, upperTiles=r) for r in rows]
    else:
        flat = it['flat']; how = '바닥 그림, 밟고 지나간다.' if flat else '막힌 칸은 아랫줄(X), 윗줄(*)은 사람 위에 그려진다.'
        ai.update(description=(f"{it['ko']} ({it['en']}) {w}×{h}칸 — 한국 시골 «{SET_KO[it['set']]}» 벌. {how} 통행 {'/'.join(it['passRows'])}. {NOTE}")[:400],
                  placementRules=f"시골 맵의 «{SET_KO[it['set']]}» 장면에 같은 벌(kind:{it['set']})끼리 모아 놓는다. 흙·풀·마당 위. 도시 보도에 흩지 않는다. 문 앞 접근 칸·길 한가운데 금지.",
                  role='prop', layerHome='lower' if flat else 'upper')
        ai['tags'] = ['modern-city', '주제 소품'] + it['tags']
        kit['rows'] = [dict(tiles=(r if flat else [-1] * w), upperTiles=([-1] * w if flat else r)) for r in rows]
    kit['ai'] = ai
    return kit


GROUPS = {'mc:prop:kr-roof': ('소품 · 한국 옥상 기물(물탱크·옥탑방·실외기 줄·빨랫줄·장독대 …)', '건물 지붕 면 위에 얹는 한국 옥상 기물.', '건물 키트 지붕 면 위에 키트째 찍는다. 땅에 놓지 않는다.'),
          'mc:prop:kr-rural': ('소품 · 한국 시골(비닐하우스·논·장독대·마을 회관 앞·농기계·과수원·축사·어촌·산길)', '한국 시골 장면 벌 기물.', '키트째 찍는다. 같은 벌끼리 모아 놓는다. 빈 땅 채우기에 흩지 않는다.')}


def apply(root=ROOT, dry=False, check_gate=True):
    report = {}; its = items()
    if check_gate:
        opened, blocked = gate()
        if blocked: raise SystemExit('3/4 관문 출구에서 막힘 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked[:20]))
        report['gate'] = dict(bundle_open=len(opened), owner_waiver=dict(batch=WAIVER, note='3/4 관문 미통과 — 오너 면제(통과가 아니다)'))
    data = json.load(open(DEF, encoding='utf-8')); pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) else {'version': 1, 'cells': {}}
    count0, tpr = data['count'], data['tilesPerRow']
    count = max([count0] + [v + 1 for v in own['cells'].values()])
    mine = {}; kit_defs = []; groups = {}

    def slot(name):
        nonlocal count
        if name in own['cells']: return own['cells'][name]
        tid = count; count += 1; own['cells'][name] = tid; pins['cells'][name] = tid
        return tid

    for it in its:
        rows = []; seen = {}
        for y in range(it['h']):
            r = []
            for x in range(it['w']):
                cell = it['im'].crop((x * T, y * T, x * T + T, y * T + T))
                if BL.empty(cell): r.append(-1); continue
                pc = pc_of(it, x, y); key = (cell.tobytes(), pc)
                if key in seen: r.append(seen[key]); continue      # 한 키트 안의 같은 화소·같은 통행 칸은 한 칸으로(시트 자리 — 칸으로 건물을 되짚는 코드는 없다)
                tid = slot(f"krb:{it['id']}:{x},{y}"); seen[key] = tid; mine[tid] = (cell, pc, f"{it['ko']} ({x + 1},{y + 1})", it); r.append(tid)
                groups.setdefault(it['group'], []).append(tid)
            rows.append(r)
        kit_defs.append(kit_of(it, rows))
    old = Image.open(PNG).convert('RGBA'); rows_n = math.ceil(count / tpr)
    assert rows_n * 16 <= 8192, rows_n
    sheet = Image.new('RGBA', (tpr * 16, max(rows_n * 16, old.height)), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid, (cell, *_r) in mine.items():
        x, y = (tid % tpr) * 16, (tid // tpr) * 16
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y)); sheet.paste(cell, (x, y))
        assert np.array_equal(np.asarray(sheet.crop((x, y, x + 16, y + 16))), np.asarray(cell)), tid
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(min(count0, (old.height // 16) * tpr)) if t not in mine and not np.array_equal(
        a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    PN = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'flat': '바닥 그림(통행 가능·사람 밑)'}
    for tid, (_cell, pc, label, it) in mine.items():
        prio, passable, passage, home = BL.PC['floor' if pc == 'flat' and it['cls'] == 'rural' else pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        m = dict(label=label, description=f"{PN[pc]}. 키트 {it['id']} 로 찍는다(낱칸으로 칠하지 않는다). 3/4 관문 미통과 — 오너 면제 그림.", role='building' if it['cls'] == 'bld' else 'prop', passage=passage, defaultLayer=home,
                 tags=['modern-city', it['id'], it['ko']], source='bundled-default', confidence='high', repeatability='fixed')
        if home == 'upper': m['layerBacking'] = 'none'
        data['tileMeta'][tid] = m
    data['count'] = max(data['count'], count)
    if data.get('libraryEnd') is not None: data['libraryEnd'] = data['count']
    gids = set(groups) | set(GROUPS) | {it['group'] for it in its}
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] not in gids and not g['id'].startswith('mc:building:kr-')]
    byg = {it['group']: it for it in its if it['cls'] == 'bld'}
    for gid, tids in groups.items():
        if gid in GROUPS:
            name, desc, rule = GROUPS[gid]; mixed = gid.endswith('rural')
            data['tileGroups'].append(dict(id=gid, name=name, role='prop', defaultLayer='mixed' if mixed else 'upper', tileIds=sorted(tids), description=desc + ' ' + NOTE, placementRules=rule,
                                           source='bundled-default', confidence='high', layerHome='perCell' if mixed else 'upper'))
        else:
            it = byg[gid]
            data['tileGroups'].append(dict(id=gid, name='건물 · ' + it['ko'], role='building', defaultLayer='upper', tileIds=sorted(tids), description=f"{it['ko']} 키트의 칸 모음. 건물 한 채 = 키트 하나(칸 낱개로 칠하지 않는다). " + NOTE,
                                           placementRules='키트째 위층에 찍는다.', source='bundled-default', confidence='high', layerHome='upper'))
    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids and not k['id'].startswith(('mc-bld-kr-', 'mc-roof-kr-', 'mc-prop-krr-'))] + kit_defs
    import collections
    report.update(count_before=count0, count_after=data['count'], owned_cells=len(mine), kits=len(kit_defs), by=dict(collections.Counter(it['cls'] for it in its)), sheet=[sheet.width, sheet.height])
    if dry: return report
    sheet.save(PNG, optimize=True)
    wr = lambda p, o, **kw: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, **kw) + '\n')   # noqa: E731
    wr(DEF, data, separators=(',', ':'))
    wr(SHEET, dict(count=data['count'], tilesPerRow=tpr), separators=(',', ': '))
    pins['count'] = max(pins.get('count', 0), data['count'])
    wr(PINS, pins, separators=(',', ':'))
    own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
    wr(OWN, own, indent=0)
    wr(REPORT, report, indent=1)
    return report


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'gate':
        opened, blocked = gate(); print('번들 출구 열림', len(opened), '· 막힘', len(blocked))
        for b in blocked[:30]: print('  %s: %s' % b)
    elif len(sys.argv) > 2 and sys.argv[1] == 'manifest':
        json.dump(dict(items=[dict(png=it['png'], kind=it['kind'], id=it['id'], chipset='modern_city') for it in items()]), open(sys.argv[2], 'w'), ensure_ascii=False, indent=1); print(len(items()))
    else:
        print(json.dumps(apply(dry='--dry' in sys.argv), ensure_ascii=False, indent=1))
