#!/usr/bin/env python3
"""modern_city 이야기 기물(보관함·잔해·쪽지·기계 장치·장부 — tiledata/modern-city/objects/spec.json)을 번들 시트 끝에 덧붙인다.

  python3 scripts/content/modern-city-street/bake_story.py [--dry]     # 관문 출구 규칙 확인 → 시트·정의·핀
  python3 scripts/content/modern-city-street/bake_story.py gate        # 관문 상태만

그림은 pieces/<src> PNG 를 **그대로** 굽는다(색 맞춤·다시 그리기 없음 — 한 화소라도 바뀌면 오너 면제가 풀린다).
이 그림들은 3/4 관문 미통과 — 오너 면제 묶음(spec.waiver)이다. 출구 검사는 관문 자신의 규칙 하나뿐이다:
object_gate.refusal(그림, kind, context='bundle') 이 None 이 아니면 굽지 않는다. 이 스크립트에 둘째 규칙(임시 통과 등)은 없다.

덧붙이기 전용(앞 번호 불변). 번호는 이름 핀(story:<id>:<x>,<y>)으로 고정한다 — 다시 구워도 같은 칸.
순서: bake_tileset.py → bake_interior → bake_green → bake_anim → bake_kr → 이것. bake_tileset.py main 이 이어 부른다.
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
OBJ = os.path.join(ROOT, 'tiledata/modern-city/objects')
SPEC = os.path.join(OBJ, 'spec.json')
OWN = os.path.join(OBJ, 'baked.json')
REPORT = os.path.join(OBJ, 'bake-report.json')
KIT_GROUP = 'mc:prop:story'
PREFIX = 'mc-prop-'
T = 16


def spec(): return json.load(open(SPEC, encoding='utf-8'))


def pieces():
    """(항목, RGBA 그림) — 크기가 선언과 다르면 멈춘다. 그림은 열기만 하고 바꾸지 않는다."""
    out = []
    for it in spec()['items']:
        im = Image.open(os.path.join(OBJ, 'pieces', it['src'])).convert('RGBA')
        assert im.size == (it['w'] * T, it['h'] * T), (it['id'], im.size)
        out.append((it, im))
    return out


def gate():
    """그림마다 관문의 번들 출구 규칙에 묻는다. (열린 것, 막힌 것[(이름표, 이유)])"""
    opened, blocked = [], []
    for it, im in pieces():
        label = 'modern_city/' + it['src'][:-4]
        why = OG.refusal(im, kind=it['kind'], context='bundle')
        (opened if why is None else blocked).append(label if why is None else (label, why))
    return opened, blocked


def waived_labels():
    """보고용 이름표: 오너 면제로 열린 그림(통과가 아니다). 판정은 gate() 가 한다 — 여기서는 세기만."""
    out = []
    for it, im in pieces():
        sha = OG.pixel_sha256(im); w = OG.read_owner_waiver(sha)
        if w and OG.owner_waiver_applies(w, sha, it['kind'], 'bundle'): out.append(it['id'])
    return out


def apply(root=ROOT, dry=False, check_gate=True):
    report = {}
    sp = spec()
    if check_gate:
        opened, blocked = gate()
        if blocked: raise SystemExit('3/4 관문 출구에서 막힘 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked))
        report['gate'] = dict(bundle_open=len(opened), owner_waiver=dict(batch=sp['waiver'], note='3/4 관문 미통과 — 오너 면제(통과가 아니다)', pieces=waived_labels()))
    data = json.load(open(DEF, encoding='utf-8'))
    pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) else {'version': 1, 'cells': {}}
    count0, tpr = data['count'], data['tilesPerRow']
    count = max([count0] + [v + 1 for v in own['cells'].values()])
    mine = {}; kit_defs = []

    def slot(name):
        nonlocal count
        if name in own['cells']: return own['cells'][name]
        tid = count; count += 1; own['cells'][name] = tid; pins['cells'][name] = tid
        return tid

    for it, im in pieces():
        w, h, decal = it['w'], it['h'], it['place'] == 'decal'
        block = {tuple(c) for c in it['block']}
        kid = PREFIX + it['id']; rows = []
        for y in range(h):
            r = []
            for x in range(w):
                cell = im.crop((x * T, y * T, x * T + T, y * T + T))
                if BL.empty(cell): r.append(-1); continue
                pc = 'flat' if decal else ('solid' if (x, y) in block else 'star')
                tid = slot(f"story:{it['id']}:{x},{y}"); mine[tid] = (cell, pc, f"{it['name']} ({x + 1},{y + 1})", kid, it); r.append(tid)
            rows.append(r)
        how = '바닥 그림, 밟고 지나간다.' if decal else '서 있는 기물, 막힌 칸 %s%s.' % (' '.join('(%d,%d)' % c for c in sorted(block)), ', 나머지 칸은 사람 위에 그려진다' if len(block) < w * h else '')
        desc = f"{it['desc']} ({it['en']}) — {how} 3/4 관문 미통과 — 오너 면제 그림({sp['waiver']})."
        kit_defs.append(dict(id=kid, kind='section', name=it['name'], width=w, height=h, tileSize=16,
                             rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows], learnedFrom='db-authored',
                             ai=dict(description=desc[:400], placementRules=it['rule'], tags=['modern-city', '이야기 기물', '주제 소품'] + it['words'] + [it['place']], role='prop',
                                     repeatability='fixed', layerHome='upper', themes=['현대 도시'], origin='ai', confidence='high')))
    old = Image.open(PNG).convert('RGBA'); rows_n = math.ceil(count / tpr)
    assert rows_n * 16 <= 8192, rows_n
    sheet = Image.new('RGBA', (tpr * 16, max(rows_n * 16, old.height)), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid, (cell, *_r) in mine.items():
        x, y = (tid % tpr) * 16, (tid // tpr) * 16
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y)); sheet.paste(cell, (x, y))     # 그림 그대로(색 맞춤 없음)
        assert np.array_equal(np.asarray(sheet.crop((x, y, x + 16, y + 16))), np.asarray(cell)), tid
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(min(count0, (old.height // 16) * tpr)) if t not in mine and not np.array_equal(
        a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    NOTE = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'flat': '바닥 그림(통행 가능·사람 밑)'}
    for tid, (_cell, pc, label, kid, it) in mine.items():
        prio, passable, passage, home = BL.PC[pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        m = dict(label=label, description=f'{NOTE[pc]}. 키트 {kid} 로 찍는다(낱칸으로 칠하지 않는다). 3/4 관문 미통과 — 오너 면제 그림.', role='prop', passage=passage, defaultLayer=home,
                 tags=['modern-city', '이야기 기물', kid] + it['words'], source='bundled-default', confidence='high', repeatability='fixed', layerBacking='none')
        data['tileMeta'][tid] = m
    data['count'] = max(data['count'], count)
    if data.get('libraryEnd') is not None: data['libraryEnd'] = data['count']
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] != KIT_GROUP]
    data['tileGroups'].append(dict(id=KIT_GROUP, name='소품 · 이야기 기물(보관함·잔해·쪽지·기계 장치·장부)', role='prop', defaultLayer='upper', tileIds=sorted(mine),
                                   description='게임들이 바랐는데 그림이 없던 이야기 기물. ' + ' · '.join(it['name'] for it, _ in pieces()) + '. 3/4 관문 미통과 — 오너 면제 그림.',
                                   placementRules='키트째 위층에 찍는다. 낱칸으로 칠하지 않는다. 빈 땅 채우기에 흩지 않는다 — 이야기가 부를 때만.', source='bundled-default', confidence='high', layerHome='upper'))
    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids] + kit_defs
    report.update(count_before=count0, count_after=data['count'], owned_cells=len(mine), cells=[min(mine), max(mine)], kits=[k['id'] for k in kit_defs], sheet=[sheet.width, sheet.height])
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
        for b in blocked: print('  %s: %s' % b)
    else:
        print(json.dumps(apply(dry='--dry' in sys.argv), ensure_ascii=False, indent=1))
