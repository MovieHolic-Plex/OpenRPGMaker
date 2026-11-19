#!/usr/bin/env python3
"""modern_city 한국 거리 기물·바닥 그림(tiledata/modern-city/kr-street-objects/spec.json)을 번들 시트 끝에 덧붙인다.

  python3 scripts/content/modern-city-street/bake_kr_street.py [--dry]            # 관문 출구 규칙 확인 → 시트·정의·핀
  python3 scripts/content/modern-city-street/bake_kr_street.py gate               # 관문 상태만
  python3 scripts/content/modern-city-street/bake_kr_street.py manifest <out.json>  # owner-waive 단계에 줄 목록
  python3 scripts/content/modern-city-street/bake_kr_street.py --renumber         # main 시트가 움직였을 때: 내 칸 번호를 버리고 지금 시트 끝에 다시 덧붙인다

그림은 pieces/<src> PNG 를 **그대로** 굽는다(색 맞춤·다시 그리기 없음 — 한 화소라도 바뀌면 오너 면제가 풀린다).
3/4 관문 미통과 — 오너 면제 묶음(spec.waiver). 출구 검사는 관문 자신의 규칙 하나뿐이다: object_gate.refusal(그림, kind, context='bundle').
pieces/ 에 그림이 없는 항목은 건너뛴다(떨어진 그림).

키트 id = mc-prop-kr-<id>. 칸 종류는 항목의 cells 줄(X 막힘 · * 솟은 칸 ★ · . 바닥 그림 · 빈칸 없음)을 그대로 따른다.
kind 가 ground 인 항목은 아래층 바닥 칸이다(걷는다, 차선이 아니다) — 키트의 tiles 가 이어 붙는 무늬(가로·세로로 되풀이)이고 칸 그룹 mc:kr-ground:<id> 로도 묶인다.
태그: country:kr · set:<지구 묶음> · slot:<구성기 자리> · max:<한 맵에 놓는 수, 기본 3> — 한국 지구 구성기(src/project/modernCityKoreanDistrict.ts)가 읽는다.

덧붙이기 전용(앞 번호 불변). 번호는 이름 핀(krs:<id>:<x>,<y>)으로 고정한다 — 다시 구워도 같은 칸.
순서: bake_tileset.py → bake_interior → bake_green → bake_anim → bake_kr → bake_story → 이것. bake_tileset.py main 이 이어 부른다.
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
OBJ = os.path.join(ROOT, 'tiledata/modern-city/kr-street-objects')
SPEC = os.path.join(OBJ, 'spec.json')
OWN = os.path.join(OBJ, 'baked.json')
REPORT = os.path.join(OBJ, 'bake-report.json')
KIT_GROUP = 'mc:prop:kr-street'
GROUND_GROUP = 'mc:kr-ground:'
PREFIX = 'mc-prop-kr-'
PIN = 'krs:'
NOTE = '3/4 관문 미통과 — 오너 면제'
T = 16


def spec(): return json.load(open(SPEC, encoding='utf-8'))


def pieces():
    """(항목, RGBA 그림) — pieces/ 에 있는 것만. 크기가 선언과 다르면 멈춘다. 그림은 열기만 하고 바꾸지 않는다."""
    out = []
    for it in spec()['items']:
        p = os.path.join(OBJ, 'pieces', it['src'])
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGBA')
        assert im.size == (it['w'] * T, it['h'] * T), (it['id'], im.size)
        assert len(it['cells']) == it['h'] and all(len(r) == it['w'] for r in it['cells']), it['id']
        out.append((it, im))
    return out


def gate():
    """그림마다 관문의 번들 출구 규칙에 묻는다. (열린 것, 막힌 것[(이름표, 이유)])"""
    opened, blocked = [], []
    for it, im in pieces():
        label = 'modern_city/' + PREFIX + it['id']
        why = OG.refusal(im, kind=it['gate'], context='bundle')
        (opened if why is None else blocked).append(label if why is None else (label, why))
    return opened, blocked


def waived_labels():
    """보고용: 오너 면제로 열린 그림(통과가 아니다). 판정은 gate() 가 한다 — 여기서는 세기만."""
    out = []
    for it, im in pieces():
        sha = OG.pixel_sha256(im); w = OG.read_owner_waiver(sha)
        if w and OG.owner_waiver_applies(w, sha, it['gate'], 'bundle'): out.append(it['id'])
    return out


def apply(root=ROOT, dry=False, check_gate=True, renumber=False):
    report = {}
    sp = spec()
    if check_gate:
        opened, blocked = gate()
        if blocked: raise SystemExit('3/4 관문 출구에서 막힘 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked[:40]))
        report['gate'] = dict(bundle_open=len(opened), owner_waiver=dict(batch=sp['waiver'], note=NOTE + '(통과가 아니다)', pieces=len(waived_labels())))
    data = json.load(open(DEF, encoding='utf-8'))
    pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) and not renumber else {'version': 1, 'cells': {}}
    if renumber: pins['cells'] = {k: v for k, v in pins['cells'].items() if not k.startswith(PIN)}
    tpr = data['tilesPerRow']
    # 내 칸이 이미 정의에 들어 있으면(다시 굽기) 그 앞이 «남의 끝» 이다. 번호를 새로 매길 때는 내 것을 뺀 끝에서 시작한다.
    mine_old = {t for g in data['tileGroups'] if g['id'] == KIT_GROUP or g['id'].startswith(GROUND_GROUP) for t in g['tileIds']}
    count0 = data['count']
    if renumber and mine_old:
        assert max(mine_old) == data['count'] - 1 and len(mine_old) == max(mine_old) - min(mine_old) + 1, '내 칸 뒤에 남의 칸이 있다 — main 의 생성 파일을 받아 온 뒤에 --renumber 를 쓴다'
        count0 = min(mine_old)
    count = max([count0] + [v + 1 for v in own['cells'].values()])
    mine = {}; kit_defs = []; grounds = []

    def slot(name):
        nonlocal count
        if name in own['cells']: return own['cells'][name]
        tid = count; count += 1; own['cells'][name] = tid; pins['cells'][name] = tid
        return tid

    for it, im in pieces():
        w, h = it['w'], it['h']; ground = it['place'] == 'ground'
        kid = PREFIX + it['id']; rows = []
        for y in range(h):
            r = []
            for x in range(w):
                c = it['cells'][y][x]; cell = im.crop((x * T, y * T, x * T + T, y * T + T))
                if c == ' ':
                    assert BL.empty(cell), (it['id'], x, y, '비워야 할 칸에 그림'); r.append(-1); continue
                if BL.empty(cell): r.append(-1); continue
                pc = 'floor' if ground else {'X': 'solid', '*': 'star', '.': 'flat'}[c]
                tid = slot(f"{PIN}{it['id']}:{x},{y}"); mine[tid] = (cell, pc, f"{it['name']} ({x + 1},{y + 1})", kid, it); r.append(tid)
            rows.append(r)
        block = [(x, y) for y in range(h) for x in range(w) if it['cells'][y][x] == 'X']
        how = ('아래층 바닥 칸, 걷는다(차선이 아니다). 키트의 칸 배열을 가로·세로로 되풀이해 깐다.' if ground else
               '바닥 표시, 밟고 지나간다.' if it['place'] == 'decal' else
               '머리 위에 걸린 것, 밑으로 지나간다(사람 위에 그려진다).' if it['place'] == 'hang' else
               '서 있는 기물, 막힌 칸 %s%s.' % (' '.join('(%d,%d)' % c for c in block), ', 나머지 칸은 사람 위에 그려진다' if len(block) < sum(c != ' ' for r in it['cells'] for c in r) else ''))
        desc = f"{it['desc']} ({it['en']}) — {how} {NOTE} 그림({sp['waiver']})."
        tags = ['modern-city', '한국 거리 기물', 'country:kr', 'set:' + it['set']] + ['slot:' + s for s in it.get('slots', [])] + (['max:%d' % it['max']] if it.get('max') else []) + it['words'] + [it['place']]
        kit_defs.append(dict(id=kid, kind='section', name=it['name'], width=w, height=h, tileSize=16,
                             rows=[dict(tiles=r if ground else [-1] * w, upperTiles=[-1] * w if ground else r) for r in rows], learnedFrom='db-authored',
                             ai=dict(description=desc[:400], placementRules=it['rule'], tags=tags, role='terrain' if ground else 'prop',
                                     repeatability='repeat' if ground else 'fixed', layerHome='lower' if ground else 'upper', themes=['현대 도시', '한국 도시'], origin='ai', confidence='high')))
        if ground: grounds.append((it, [t for r in rows for t in r if t >= 0]))
    if not mine: return dict(report, kits=[], note='pieces/ 에 그림이 없다')
    old = Image.open(PNG).convert('RGBA'); rows_n = math.ceil(count / tpr)
    assert rows_n * 16 <= 8192, rows_n
    sheet = Image.new('RGBA', (tpr * 16, max(rows_n * 16, old.height)), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid in mine_old - set(mine):      # 다시 굽기에서 빠진 내 옛 칸은 비운다
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), ((tid % tpr) * 16, (tid // tpr) * 16))
    for tid, (cell, *_r) in mine.items():
        x, y = (tid % tpr) * 16, (tid // tpr) * 16
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y)); sheet.paste(cell, (x, y))     # 그림 그대로(색 맞춤 없음)
        assert np.array_equal(np.asarray(sheet.crop((x, y, x + 16, y + 16))), np.asarray(cell)), tid
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(min(count0, (old.height // 16) * tpr)) if t not in mine and t not in mine_old and not np.array_equal(
        a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    BLANK = dict(label='', description='사용하지 않는 칸.', source='unknown')
    if renumber:
        for key in ('passability', 'priority', 'terrain', 'tileMeta'): data[key] = data[key][:count0]
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(BLANK))
    WHAT = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'flat': '바닥 표시(통행 가능·사람 밑)', 'floor': '아래층 바닥(걷는다 — 차선이 아니다)'}
    for tid, (_cell, pc, label, kid, it) in mine.items():
        prio, passable, passage, home = BL.PC[pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        ground = pc == 'floor'
        data['tileMeta'][tid] = dict(label=label, description=f'{WHAT[pc]}. 키트 {kid} 로 찍는다(낱칸으로 칠하지 않는다). {NOTE} 그림.', role='terrain' if ground else 'prop', passage=passage, defaultLayer=home,
                                     tags=['modern-city', '한국 거리 기물', kid] + (['walk', '보도'] if ground else []) + it['words'], source='bundled-default', confidence='high',
                                     repeatability='repeat' if ground else 'fixed', **({} if ground else dict(layerBacking='none')))
    data['count'] = count
    if data.get('libraryEnd') is not None: data['libraryEnd'] = data['count']
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] != KIT_GROUP and not g['id'].startswith(GROUND_GROUP)]
    upper = sorted(t for t, v in mine.items() if v[1] != 'floor')
    data['tileGroups'].append(dict(id=KIT_GROUP, name='소품 · 한국 거리 기물', role='prop', defaultLayer='upper', tileIds=upper,
                                   description=f'한국 도시 거리의 기물 {len(kit_defs) - len(grounds)}종(상가 골목·빌라촌·아파트 단지·대로변·재래시장·대학가·천변·역 앞과 공용). {NOTE} 그림.',
                                   placementRules='키트째 위층에 찍는다. 낱칸으로 칠하지 않는다. 한국 지구는 compose_modern_city_street {district} 가 자리(slot)에 맞춰 놓는다.',
                                   source='bundled-default', confidence='high', layerHome='upper'))
    for it, ids in grounds:
        data['tileGroups'].append(dict(id=GROUND_GROUP + it['id'], name='한국 거리 바닥 · ' + it['name'].split(' · ')[0], role='terrain', defaultLayer='lower', tileIds=ids,
                                       description=f"{it['desc']} ({it['en']}) — {it['w']}×{it['h']}칸 무늬를 되풀이해 깐다(키트 {PREFIX}{it['id']}). {NOTE} 그림.",
                                       placementRules=it['rule'], source='bundled-default', confidence='high', layerHome='lower'))
    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids and not (k['id'].startswith(PREFIX) and k['id'][len(PREFIX):] in {i['id'] for i in sp['items']})] + kit_defs
    report.update(count_before=count0, count_after=data['count'], owned_cells=len(mine), cells=[min(mine), max(mine)], kits=len(kit_defs), grounds=len(grounds), sheet=[sheet.width, sheet.height],
                  skipped=[it['id'] for it in sp['items'] if not os.path.exists(os.path.join(OBJ, 'pieces', it['src']))])
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
        opened, blocked = gate(); print('번들 출구 열림', len(opened), '· 오너 면제(3/4 관문 미통과)', len(waived_labels()), '· 막힘', len(blocked))
        for b in blocked[:40]: print('  %s: %s' % b)
    elif len(sys.argv) > 2 and sys.argv[1] == 'manifest':
        items = [dict(png=os.path.join(OBJ, 'pieces', it['src']), kind=it['gate'], id=PREFIX + it['id'], chipset='modern_city') for it, _ in pieces()]
        json.dump(dict(items=items), open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(len(items))
    else:
        print(json.dumps(apply(dry='--dry' in sys.argv, renumber='--renumber' in sys.argv), ensure_ascii=False, indent=1))
