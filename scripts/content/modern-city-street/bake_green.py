#!/usr/bin/env python3
"""modern_city 거리 녹지(큰 가로수·공원 나무·철쭉 덤불·잔디 변형)를 번들 시트 끝에 덧붙여 굽는다 — 덧붙이기 전용, 앞 번호 불변.

  python3 scripts/content/modern-city-street/bake_green.py [--dry]      # 굽기(관문 영수증 확인 → 시트·정의·핀)
  python3 scripts/content/modern-city-street/bake_green.py gate          # object-gate 에 낼 PNG·items.jsonl 쓰기 + 상태

왜 덧붙이기인가: 거리 시트의 나무·잔디·옥상은 사람이 고른 하네스 합격 PNG(harness-data/modern-chipset)를 칸으로 자른 것이고,
bake_tileset.py 가 576 키트를 그 PNG 와 화소 대조(reassembly)한다. 그 칸을 그 자리에서 다시 그리면 키트 대조가 깨지거나(같은 번호 교체)
건물 키트 수백 개의 칸이 새로 생긴다(옥상). 그래서 새 그림은 새 키트·새 그룹으로 붙이고, 거리 구성기가 그것을 쓰게 한다.
옛 키트(mc-prop-street-tree-a 등)와 옛 잔디(mc:green)는 그대로 남는다(기존 맵 보존).

순서: bake_tileset.py(거리) → bake_interior.apply()(실내) → 이 apply()(녹지). bake_tileset.py main 이 셋을 이어 부른다.
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
import art_green as A                               # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DEF = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET = os.path.join(ROOT, 'src/assets/modernCitySheet.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/street-green/baked.json')
REPORT = os.path.join(ROOT, 'tiledata/modern-city/street-green/bake-report.json')
GATE_DIR = os.path.join(ROOT, 'tiledata/modern-city/street-green/_gate')
LAWN_GROUP = 'mc:lawn'
KIT_GROUP = 'mc:prop:tree-big'
PCNOTE = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'flat': '땅 그림자(통행 가능·사람 밑에 그림)', 'floor': '걸을 수 있는 땅'}


def lawn_tile_img(cell):
    """terrain 판정용 주기 그림: 잔디 칸 3×3."""
    t = Image.fromarray(cell, 'RGBA'); im = Image.new('RGBA', (48, 48))
    for dx in (0, 16, 32):
        for dy in (0, 16, 32): im.paste(t, (dx, dy))
    return im


def gate_items():
    """(라벨, 종류, 그림, 이름) — 관문에 낼 그림 전부."""
    out = []
    for pid, ko, kind, _w, _h, im in A.piece_images(): out.append(('modern_city/street-green/' + pid, kind, im, ko))
    for name, ko, cell in A.lawn_cells(): out.append(('modern_city/street-green/lawn-' + name, 'terrain', lawn_tile_img(cell), ko + ' (16px 칸 3×3 반복)'))
    return out


def gate_export():
    os.makedirs(GATE_DIR, exist_ok=True)
    for f in os.listdir(GATE_DIR):
        if f.endswith('.png'): os.remove(os.path.join(GATE_DIR, f))
    rows = []
    for label, kind, im, ko in gate_items():
        p = os.path.join(GATE_DIR, label.split('/')[-1] + '.png'); im.save(p)
        rows.append(dict(png=p, kind=kind, name=ko, label=label))
    with open(os.path.join(GATE_DIR, 'items.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    return rows


def gate():
    rep = collections.Counter(); blocked = []
    for label, kind, im, _ko in gate_items():
        r = OG.read_receipt(OG.pixel_sha256(im))
        if not r: blocked.append((label, '영수증 없음')); continue
        if r.get('kind') != kind: blocked.append((label, '영수증 종류 %s != %s' % (r.get('kind'), kind))); continue
        if r.get('verdict') != 'pass': blocked.append((label, '불합격 ' + ' · '.join(r.get('reasons') or []))); continue
        why = OG.refusal(im, kind=kind, context='bundle')
        if why is None: rep['pass'] += 1
        elif '보정되지 않았다' in why: rep['prov'] += 1
        else: blocked.append((label, why))
    return dict(rep), blocked


def kit_grid(pid, w, h, im):
    """칸 격자 [(셀 그림, 통행 종류)] — 맨 아랫줄: 줄기·덤불 몸(불투명 화소)이 있으면 막힘, 그림자뿐이면 flat. 윗줄은 ★."""
    cells = BL.cut(im)
    grid = []
    for y, row in enumerate(cells):
        r = []
        for x, c in enumerate(row):
            if BL.empty(c): r.append((None, None)); continue
            if y < h - 1: r.append((c, 'star')); continue
            opaque = (np.asarray(c)[:, :, 3] == 255).sum()
            r.append((c, 'solid' if opaque >= 6 else 'flat'))
        grid.append(r)
    return grid


def apply(root=ROOT, dry=False, check_gate=True):
    report = {}
    if check_gate:
        rep, blocked = gate()
        report['gate'] = dict(rep, blocked=len(blocked), profile='uncalibrated → pass 영수증을 임시통과(provisional)로 센다' if rep.get('prov') else 'calibrated')
        if blocked: raise SystemExit('3/4 관문 미통과 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked))
    data = json.load(open(DEF, encoding='utf-8'))
    pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) else {'version': 1, 'cells': {}}
    count0, tpr = data['count'], data['tilesPerRow']
    count = count0; mine = {}; added = 0

    def place(cell, pc, label, desc, tags, role):
        nonlocal count, added
        cell = BL.norm(cell); key = BL.Sheet.key_of(cell, pc)
        if key in pins['cells']:
            tid = pins['cells'][key]
            if key not in own['cells'] and tid < count0: return tid          # 남이 가진 같은 칸(투명 등)은 그대로 쓴다
        else:
            tid = count; count += 1; pins['cells'][key] = tid; added += 1
        own['cells'][key] = tid; mine[tid] = (cell, pc, label, desc, tags, role)
        return tid

    lawn_ids = []
    for name, ko, cell in A.lawn_cells():
        lawn_ids.append(place(Image.fromarray(cell, 'RGBA'), 'floor', ko, f'{ko} — 공원·건물 뒤 녹지 바닥(낱칸, 섞어 칠한다).', ['modern-city', '잔디', 'lawn', name], 'terrain'))
    kits = []
    for pid, ko, kind, w, h, im in A.piece_images():
        grid = kit_grid(pid, w, h, im); rows = []
        for y, row in enumerate(grid):
            r = []
            for x, (c, pc) in enumerate(row):
                if c is None: r.append(-1); continue
                r.append(place(c, pc, f'{ko} ({x + 1},{y + 1})', f'{PCNOTE[pc]}. 키트 {pid} 로 찍는다(낱칸으로 칠하지 않는다).', ['modern-city', '나무', 'prop-street', ko], 'prop'))
            rows.append(r)
        tall = h >= 3
        desc = (f'{ko} {w}×{h}칸 — 잎 덩이 수관(좌상 빛, 명암 7단)·짧은 줄기·땅 그림자. ' + ('보도 가로수: 맨 아랫줄 가운데(줄기)가 보도에 서고 수관은 연석·차도 위로 걸친다.' if 'keyaki' in pid or 'ginkgo' in pid else
                '공원 잔디 가운데. 주변 2칸은 비워 수관이 겹치지 않게.' if 'park' in pid else '공원·건물 뒤 잔디 가장자리, 화단.'))
        rules = '맨 아랫줄: 줄기·덤불 몸 칸 = 막힘, 그림자만 있는 칸 = 통행 가능(사람 밑). 윗줄 = ★(사람 위에 그림). 위층(upper)에 키트째 찍는다.'
        kits.append(dict(id=pid, kind='section', name=ko, width=w, height=h, tileSize=16, rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows], learnedFrom='db-authored',
                         ai=dict(description=desc[:400], placementRules=rules, tags=['modern-city', '나무' if 'azalea' not in pid else '덤불', 'prop-street', ko], role='prop',
                                 repeatability='fixed', layerHome='upper', themes=['현대 도시'], origin='ai', confidence='high')))
    # 시트
    old = Image.open(PNG).convert('RGBA'); rows_n = math.ceil(count / tpr)
    assert rows_n * 16 <= 4096, rows_n
    sheet = Image.new('RGBA', (tpr * 16, rows_n * 16), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid, (cell, *_r) in mine.items():
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), ((tid % tpr) * 16, (tid // tpr) * 16)); sheet.paste(cell, ((tid % tpr) * 16, (tid // tpr) * 16))
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(count0) if t not in mine and not np.array_equal(a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    # 정의
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    for tid, (_cell, pc, label, desc, tags, role) in mine.items():
        prio, passable, passage, home = BL.PC[pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        m = dict(label=label, description=desc, role=role, passage=passage, defaultLayer=home, tags=tags, source='bundled-default', confidence='high', repeatability='repeat' if pc == 'floor' else 'fixed')
        if pc == 'flat': m['layerBacking'] = 'none'; m['locked'] = True
        elif home == 'upper': m['layerBacking'] = 'none'
        data['tileMeta'][tid] = m
    data['count'] = count
    if data.get('libraryEnd') is not None: data['libraryEnd'] = count
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] not in (LAWN_GROUP, KIT_GROUP)]
    data['tileGroups'].append(dict(id=LAWN_GROUP, name='잔디(풀 결·풀 덩이 변형)', role='terrain', defaultLayer='lower', tileIds=lawn_ids,
                                   description='공원·건물 뒤 녹지 바닥. 앞 4칸 = 바탕 잔디(섞어 칠한다), 5~6 = 짙은 풀 덩이, 7 = 토끼풀 꽃, 8 = 민들레. mc:green 보다 밝고 결이 있다.',
                                   placementRules='낱칸으로 칠한다. 바탕 4종을 해시로 섞고 덩이·꽃 칸은 열에 하나 이하로 흩뿌린다(같은 칸을 바둑판으로 반복하지 않는다).',
                                   source='bundled-default', confidence='high', layerHome='lower'))
    kit_ids = sorted({t for k in kits for r in k['rows'] for t in r['upperTiles'] if t >= 0})
    data['tileGroups'].append(dict(id=KIT_GROUP, name='소품 · 큰 나무·덤불(잎 덩이 수관)', role='prop', defaultLayer='mixed', tileIds=kit_ids,
                                   description='큰 가로수(느티나무 2종·은행나무)·공원 큰 나무·철쭉 덤불 키트 칸.', placementRules='키트째 위층에 찍는다. 낱칸으로 칠하지 않는다.',
                                   source='bundled-default', confidence='high', layerHome='perCell'))
    ids = {k['id'] for k in kits}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids] + kits
    report.update(count_before=count0, count_after=count, added_cells=added, owned_cells=len(mine), kits=[k['id'] for k in kits], lawn=lawn_ids, sheet=[sheet.width, sheet.height])
    if dry: return report
    sheet.save(PNG, optimize=True)
    wr = lambda p, o, **kw: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, **kw) + '\n')   # noqa: E731
    wr(DEF, data, separators=(',', ':'))
    wr(SHEET, dict(count=count, tilesPerRow=tpr), separators=(',', ': '))
    pins['count'] = count
    wr(PINS, pins, separators=(',', ':'))
    os.makedirs(os.path.dirname(OWN), exist_ok=True)
    own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
    wr(OWN, own, indent=0)
    wr(REPORT, report, indent=1)
    return report


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'gate':
        rows = gate_export(); rep, blocked = gate()
        print('export', len(rows), os.path.join(GATE_DIR, 'items.jsonl')); print(rep, 'blocked', len(blocked))
        for b in blocked: print('  %s: %s' % b)
    else:
        print(json.dumps(apply(dry='--dry' in sys.argv), ensure_ascii=False, indent=1))
