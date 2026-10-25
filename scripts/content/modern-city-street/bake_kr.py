#!/usr/bin/env python3
"""modern_city 한국 업무 지구 소품(지하철 출구 번호 표지·한글 세로 입간판·가로수 보호판, art_kr.py)을 번들 시트 끝에 덧붙인다.

  python3 scripts/content/modern-city-street/bake_kr.py [--dry]       # 관문 영수증 확인 → 시트·정의·핀
  python3 scripts/content/modern-city-street/bake_kr.py gate          # 관문 상태만

덧붙이기 전용(앞 번호 불변). 번호는 이름 핀(kr:<키트>:<x>,<y>)으로 고정한다 — 다시 구워도 같은 칸.
순서: bake_tileset.py → bake_interior → bake_green → bake_anim → 이것. bake_tileset.py main 이 이어 부른다.
3/4 관문(object-gate) 영수증이 없거나 불합격이면 굽지 않는다(AGENTS.md hard rule).
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
import art_kr as A                                  # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DEF = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET = os.path.join(ROOT, 'src/assets/modernCitySheet.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/street-kr/baked.json')
REPORT = os.path.join(ROOT, 'tiledata/modern-city/street-kr/bake-report.json')
KIT_GROUP = 'mc:prop:kr-street'
GATE_KIND = {}


def gate_kind(kind): return GATE_KIND.get(kind, kind)


def gate():
    rep = collections.Counter(); blocked = []
    for pid, _ko, kind, _w, _h, im in A.piece_images():
        k = gate_kind(kind); label = 'modern_city/street-kr/' + pid
        r = OG.read_receipt(OG.pixel_sha256(im))
        if not r: blocked.append((label, '영수증 없음')); continue
        if r.get('kind') != k: blocked.append((label, '영수증 종류 %s != %s' % (r.get('kind'), k))); continue
        if r.get('verdict') != 'pass': blocked.append((label, '불합격 ' + ' · '.join(r.get('reasons') or []))); continue
        why = OG.refusal(im, kind=k, context='bundle')
        if why is None: rep['pass'] += 1
        elif '보정되지 않았다' in why: rep['prov'] += 1
        else: blocked.append((label, why))
    return dict(rep), blocked


DESC = {
    'exit': ('지하철 출구 번호 표지 {n} — 노란 번호판 위 청록 지하철 띠, 기둥·발판. 1칸 폭·2칸 높이.',
             '지하철 입구(mc-prop-subway-*) 바로 옆 보도에 하나. 발밑(아랫줄) = 막힘, 윗줄 = ★. 출구마다 다른 번호.'),
    'sign': ('세로 입간판 「{t}」 — 상자형 한국 거리 간판(지어낸 이름, 실제 상표 없음). 1칸 폭·2칸 높이.',
             '가게 문 옆 보도 건물 쪽 줄. 문 앞 칸은 비운다. 발밑 = 막힘, 윗줄 = ★.'),
    'grate': ('가로수 보호판(주철) — 보도에 박힌 정사각 판, 가운데 흙 구멍. 바닥 그림.',
              '가로수 줄기 칸 바로 아래 보도 칸, 또는 가로수 줄 사이 같은 간격. 통행 가능(사람 밑).'),
}


def apply(root=ROOT, dry=False, check_gate=True):
    report = {}
    if check_gate:
        rep, blocked = gate()
        report['gate'] = dict(rep, blocked=len(blocked))
        if blocked: raise SystemExit('3/4 관문 미통과 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked))
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

    for pid, ko, kind, w, h, im in A.piece_images():
        cells = BL.cut(im); rows = []
        flat = kind == 'flat'
        for y in range(h):
            r = []
            for x in range(w):
                c = cells[y][x]
                if BL.empty(c): r.append(-1); continue
                pc = 'flat' if flat else ('star' if y < h - 1 else 'solid')
                tid = slot(f'kr:{pid}:{x},{y}'); mine[tid] = (c, pc, f'{ko} ({x + 1},{y + 1})', pid); r.append(tid)
            rows.append(r)
        key = 'exit' if '-exit-' in pid else 'grate' if 'grate' in pid else 'sign'
        desc, rules = DESC[key]
        desc = desc.format(n=pid.rsplit('-', 1)[-1], t=ko.split('「')[-1].rstrip('」'))
        kit_defs.append(dict(id=pid, kind='section', name=ko, width=w, height=h, tileSize=16,
                             rows=[dict(tiles=(r if flat else [-1] * w), upperTiles=([-1] * w if flat else r)) for r in rows], learnedFrom='db-authored',
                             ai=dict(description=desc[:400], placementRules=rules, tags=['modern-city', 'prop-street', '한국', ko], role='prop',
                                     repeatability='fixed', layerHome='lower' if flat else 'upper', themes=['현대 도시', '한국 업무 지구'], origin='ai', confidence='high')))
    old = Image.open(PNG).convert('RGBA'); rows_n = math.ceil(count / tpr)
    assert rows_n * 16 <= 8192, rows_n   # 시트는 이미 4096 을 넘었다(실내·움직임 덧붙임) — WebGL 최소 보장 8192 안
    sheet = Image.new('RGBA', (tpr * 16, max(rows_n * 16, old.height)), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid, (cell, *_r) in mine.items():
        x, y = (tid % tpr) * 16, (tid // tpr) * 16
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y)); sheet.paste(BL.norm(cell), (x, y))
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(min(count0, (old.height // 16) * tpr)) if t not in mine and not np.array_equal(
        a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    NOTE = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'flat': '바닥 그림(통행 가능·사람 밑)'}
    for tid, (_cell, pc, label, kid) in mine.items():
        prio, passable, passage, home = BL.PC['floor' if pc == 'flat' else pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        m = dict(label=label, description=f'{NOTE[pc]}. 키트 {kid} 로 찍는다(낱칸으로 칠하지 않는다).', role='prop', passage=passage, defaultLayer=home,
                 tags=['modern-city', 'prop-street', '한국', kid], source='bundled-default', confidence='high', repeatability='fixed')
        if home == 'upper': m['layerBacking'] = 'none'
        data['tileMeta'][tid] = m
    data['count'] = max(data['count'], count)
    if data.get('libraryEnd') is not None: data['libraryEnd'] = data['count']
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] != KIT_GROUP]
    data['tileGroups'].append(dict(id=KIT_GROUP, name='소품 · 한국 업무 지구(출구 번호·세로 간판·가로수 보호판)', role='prop', defaultLayer='mixed', tileIds=sorted(mine),
                                   description='지하철 출구 번호 표지 1~4, 한글 세로 입간판(카페·편의·국밥·약국, 지어낸 이름), 가로수 보호판.',
                                   placementRules='키트째 찍는다(보호판은 아래층, 나머지는 위층). 낱칸으로 칠하지 않는다.', source='bundled-default', confidence='high', layerHome='perCell'))
    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids] + kit_defs
    report.update(count_before=count0, count_after=data['count'], owned_cells=len(mine), kits=[k['id'] for k in kit_defs], sheet=[sheet.width, sheet.height])
    if dry: return report
    sheet.save(PNG, optimize=True)
    wr = lambda p, o, **kw: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, **kw) + '\n')   # noqa: E731
    wr(DEF, data, separators=(',', ':'))
    wr(SHEET, dict(count=data['count'], tilesPerRow=tpr), separators=(',', ': '))
    pins['count'] = max(pins.get('count', 0), data['count'])
    wr(PINS, pins, separators=(',', ':'))
    os.makedirs(os.path.dirname(OWN), exist_ok=True)
    own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
    wr(OWN, own, indent=0)
    wr(REPORT, report, indent=1)
    return report


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'gate':
        rep, blocked = gate(); print(rep, 'blocked', len(blocked))
        for b in blocked: print('  %s: %s' % b)
    else:
        print(json.dumps(apply(dry='--dry' in sys.argv), ensure_ascii=False, indent=1))
