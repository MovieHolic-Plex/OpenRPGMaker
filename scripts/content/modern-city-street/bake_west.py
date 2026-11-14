#!/usr/bin/env python3
"""modern_city 서양 도시 세트(country:west — 건물 mc-bld-w-* · 기물 mc-prop-w-*)를 번들 시트 끝에 덧붙인다.

  python3 scripts/content/modern-city-street/west_build.py            # 먼저 부품을 건물로 조립
  python3 scripts/content/modern-city-street/bake_west.py manifest    # 오너 면제 단계에 줄 목록(굽게 될 그림)
  python3 scripts/content/modern-city-street/bake_west.py gate        # 관문 출구 상태만
  python3 scripts/content/modern-city-street/bake_west.py [--dry]     # 시트·정의·핀

그림은 Claude Fable 5.2 medium 한 방(부품) + 코드 조립(건물). 3/4 관문 미통과 — 오너 면제 묶음(WAIVER). 그림은 한 화소도 바꾸지 않고 굽는다.
출구 검사는 관문 자신의 규칙 하나: object_gate.refusal(그림, kind, context='bundle') 이 None 이 아니면 그 그림은 굽지 않는다.
아직 그리지 않았거나 버린 것(사양에는 있고 그림이 없는 것)은 건너뛴다 — 보고에 적는다.

덧붙이기 전용(앞 번호 불변). 번호는 핀으로 고정한다: 기물 `west:<키트>:<x>,<y>`, 건물 칸은 내용 해시 `west:c:<해시>`(같은 창 줄이 여러 건물에 되풀이되어 칸을 아낀다).
같은 시트에 다른 일꾼도 굽는다: main 을 합친 뒤 내 칸 번호가 main 의 칸과 겹치면(main 의 count 가 내 첫 칸보다 크고 정의에 내 그룹이 없다) 내 핀을 버리고 새 끝 번호를 받는다.
순서: bake_tileset.py → bake_interior → bake_green → bake_anim → bake_kr → bake_story → 이것.
"""
import hashlib, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
import numpy as np                                  # noqa: E402
from PIL import Image                               # noqa: E402
import bake_lib as BL                               # noqa: E402
import object_gate as OG                            # noqa: E402
import west_spec as W                               # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DEF = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET = os.path.join(ROOT, 'src/assets/modernCitySheet.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
WEST = W.WEST
OWN = os.path.join(WEST, 'baked.json')
REPORT = os.path.join(WEST, 'bake-report.json')
WAIVER = 'fable-westcity-2026-11-14'
GROUP_BLD, GROUP_OBJ = 'mc:bld:west', 'mc:prop:west'
T = 16
NOTE = '3/4 관문 미통과 — 오너 면제 그림'


def items():
    """굽는 그림 목록: (종류 'bld'|'obj', 사양, 그림 경로, 관문 종류). 그림이 없는 것은 뺀다."""
    out = []; B, P, _M = W.buildings()
    for b in B:
        p = os.path.join(WEST, 'buildings', b['id'] + '.png')
        if os.path.exists(p): out.append(('bld', dict(b, h=W.geometry(b, P)[1]), p, 'structure'))
    for o in W.objects():
        p = os.path.join(WEST, 'pieces', o['id'] + '.png')
        if os.path.exists(p): out.append(('obj', o, p, o['kind']))
    return out


def missing():
    B, P, _M = W.buildings(); have = {it[1]['kit'] for it in items()}
    return [x['kit'] for x in B + W.objects() if x['kit'] not in have]


def gate():
    opened, blocked = [], []
    for _t, sp, p, kind in items():
        why = OG.refusal(Image.open(p).convert('RGBA'), kind=kind, context='bundle')
        (opened if why is None else blocked).append(sp['kit'] if why is None else (sp['kit'], why))
    return opened, blocked


def manifest():
    return dict(items=[dict(png=p, kind=kind, id=sp['kit'], chipset='modern_city') for _t, sp, p, kind in items()])


def tags_of(sp, bld):
    base = ['modern-city', 'building' if bld else 'prop-street', sp['ko'], 'country:west', 'flavour:' + sp['flavour'], '서양', '서양 도시', W.FLAVOUR_KO[sp['flavour']]]
    if bld: base += ['tier:' + sp['tier'], W.TIER_KO[sp['tier']], 'setting:city', 'program:' + sp['program']]
    else: base += ['setting:' + sp['setting'], 'kind:' + sp['set'], W.SET_KO[sp['set']], sp['place']]
    return base + sp['words'] + [sp['en']]


def apply(root=ROOT, dry=False, check_gate=True):
    report = {}; its = items()
    if check_gate:
        opened, blocked = gate(); ok = set(opened)
        report['gate'] = dict(bundle_open=len(opened), blocked=[dict(kit=k, why=w) for k, w in blocked], owner_waiver=dict(batch=WAIVER, note=NOTE + '(통과가 아니다)'))
        its = [it for it in its if it[1]['kit'] in ok]
    data = json.load(open(DEF, encoding='utf-8'))
    pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) else {'version': 1, 'cells': {}}
    count0, tpr = data['count'], data['tilesPerRow']
    has_group = any(g['id'] in (GROUP_BLD, GROUP_OBJ) for g in data['tileGroups'])
    if own['cells'] and not has_group and count0 > min(own['cells'].values()):
        # main 을 합쳤더니 내 번호 자리를 다른 일꾼의 칸이 차지했다 — 내 핀을 버리고 새 끝 번호를 받는다(아직 아무 저장본도 내 번호를 쓰지 않는다: PR 머지 전).
        for k in own['cells']: pins['cells'].pop(k, None)
        report['renumbered_from'] = min(own['cells'].values()); own['cells'] = {}
    for k in [k for k in pins['cells'] if k.startswith('west:') and k not in own['cells']]: pins['cells'].pop(k)
    count = max([count0] + [v + 1 for v in own['cells'].values()])
    mine = {}; kit_defs = []

    def slot(name):
        nonlocal count
        if name in own['cells']: return own['cells'][name]
        tid = count; count += 1; own['cells'][name] = tid; pins['cells'][name] = tid
        return tid

    for typ, sp, path, _kind in its:
        im = Image.open(path).convert('RGBA'); w, h = sp['w'], sp['h']
        assert im.size == (w * T, h * T), (sp['kit'], im.size, w, h)
        rows = []
        for y in range(h):
            r = []
            for x in range(w):
                cell = im.crop((x * T, y * T, x * T + T, y * T + T))
                if BL.empty(cell): r.append(-1); continue
                if typ == 'bld':
                    name = 'west:c:' + hashlib.sha256(np.asarray(cell).tobytes()).hexdigest()[:16]; pc = 'solid'; label = '서양 도시 건물 칸'
                else:
                    name = f"west:{sp['id']}:{x},{y}"; label = f"{sp['ko']} ({x + 1},{y + 1})"
                    pc = 'flat' if sp['place'] == 'flat' else 'star' if sp['place'] == 'over' or y < h - 1 else 'solid'
                tid = slot(name); mine.setdefault(tid, (cell, pc, label, sp, typ)); r.append(tid)
            rows.append(r)
        if typ == 'bld':
            acc = [dict(dx=d, dy=h) for d in sp['doors']]
            doors = ', '.join(f'({d},{h})' for d in sp['doors'])
            desc = (f"{sp['ko']} ({sp['en']}) {w}×{h}칸 — {sp['type']}. 서양 도시 세트({W.FLAVOUR_KO[sp['flavour']]}), {W.TIER_KO[sp['tier']]}, {sp['storeys']}층. 정면 + 위에서 본 지붕 면(옥상 기물 포함). "
                    f"몸통·지붕 칸은 모두 막힘(위층), 문 앞 접근 칸은 키트 바깥 한 줄 아래: {doors}. 실내 program {sp['program']}. {NOTE}({WAIVER}).")
            parts = []; run = []
            for d in sp['doors'] + [None]:
                if run and (d is None or d != run[-1] + 1):
                    parts.append(dict(id='door' if not parts else f'door{len(parts) + 1}', kind='entrance', dx=run[0], dy=h - 1, w=len(run), h=1, note='문 칸(그림) — 문 칸 자체는 막힘, 바로 아래(키트 바깥 한 줄 아래) 보도 칸이 문 앞 접근 칸')); run = []
                if d is not None: run.append(d)
            kit_defs.append(dict(id=sp['kit'], kind='section', name=sp['ko'], width=w, height=h, tileSize=16, rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows], learnedFrom='db-authored',
                                 ai=dict(description=desc[:400], placementRules=f"땅(보도) 위 위층. 키트 아래 한 줄이 문 앞 접근 칸(보도)이어야 한다. {W.FLAVOUR_KO[sp['flavour']]} 거리에만 — 한 거리에 북미 중심가와 유럽 구시가를 섞지 않는다. 벽을 맞대어 세우되 이웃과 층수가 다르게.",
                                         tags=tags_of(sp, True), role='building', repeatability='fixed', layerHome='upper', themes=['현대 도시', '서양 도시'], origin='ai', confidence='high', access=acc), parts=parts))
        else:
            how = {'flat': '바닥 그림, 밟고 지나간다.', 'over': '걸쳐 놓는 띠 — 막지 않고 사람 위에 그려진다.', 'prop': '서 있는 기물, 맨 아랫줄 막힘' + (', 윗줄은 사람 위에 그려진다.' if h > 1 else '.')}[sp['place']]
            rule = {'rooftop': '건물 지붕 면(위에서 본 평지붕) 위에 얹는다. 지붕 난간 안쪽, 서로 겹치지 않게.', 'shopfront': '가게 정면 바로 앞 보도 줄(건물 쪽). 문 앞 접근칸은 비운다. 차양 띠는 가게 1층 윗줄에 겹쳐 찍는다.',
                    'main-street': '보도의 연석 쪽 줄. 문 앞 접근칸·횡단보도 앞은 비운다.', 'cafe-terrace': '카페·식당 앞 보도나 광장에 탁자·의자·화단 상자를 한 벌로.', 'market': '광장·넓은 보도에 좌판을 줄지어. 좌판 사이 한 칸 통로.',
                    'park': '공원·광장의 잔디나 포장 위.', 'alley': '건물 사이 골목 틈(1~2칸)과 건물 뒤. 빨랫줄은 두 건물 사이 위쪽에 걸친다.', 'construction': '공사장 필지(흙바닥) 안과 그 둘레 — 울타리로 둘러싼다.',
                    'tram-bus': '보도 연석 쪽, 정류장 한 벌로.', 'seasonal': '계절 장면에만: 가게 앞·광장·공원.', 'farm': '시골 농장 마당·밭 가.', 'orchard': '과수원 나무 줄 사이.', 'vineyard': '포도밭: 덩굴 줄을 가로로 잇고 줄 끝에 끝 기둥.',
                    'roadside': '시골 길가.', 'village-green': '마을 한가운데 풀밭.'}[sp['set']]
            desc = f"{sp['ko']} ({sp['en']}) {w}×{h}칸 — {how} 서양 도시 세트({W.FLAVOUR_KO[sp['flavour']]}) · 장면 묶음 {W.SET_KO[sp['set']]}. {NOTE}({WAIVER})."
            flat = sp['place'] == 'flat'
            kit_defs.append(dict(id=sp['kit'], kind='section', name=sp['ko'], width=w, height=h, tileSize=16, rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows], learnedFrom='db-authored',
                                 ai=dict(description=desc[:400], placementRules=rule + (' 차도 금지.' if not flat else ''), tags=tags_of(sp, False), role='prop', repeatability='fixed', layerHome='upper',
                                         themes=['현대 도시', '서양 도시'] + (['시골'] if sp['setting'] == 'rural' else []), origin='ai', confidence='high')))
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
    PCN = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'flat': '바닥 그림(통행 가능·사람 밑)'}
    for tid, (_cell, pc, label, sp, typ) in mine.items():
        prio, passable, passage, home = BL.PC[pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID); data['priority'][tid] = prio; data['terrain'][tid] = 0
        kitnote = '서양 도시 건물 키트(mc-bld-w-*)로 찍는다' if typ == 'bld' else f"키트 {sp['kit']} 로 찍는다"
        data['tileMeta'][tid] = dict(label=label, description=f'{PCN[pc]}. {kitnote}(낱칸으로 칠하지 않는다). {NOTE}.', role='building' if typ == 'bld' else 'prop', passage=passage, defaultLayer=home,
                                     tags=['modern-city', 'building' if typ == 'bld' else 'prop-street', 'country:west'] + ([] if typ == 'bld' else [sp['kit']]), source='bundled-default', confidence='high', repeatability='fixed', layerBacking='none')
    data['count'] = max(data['count'], count)
    if data.get('libraryEnd') is not None: data['libraryEnd'] = data['count']
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] not in (GROUP_BLD, GROUP_OBJ)]
    bt = sorted(t for t, v in mine.items() if v[4] == 'bld'); ot = sorted(t for t, v in mine.items() if v[4] == 'obj')
    if bt: data['tileGroups'].append(dict(id=GROUP_BLD, name='건물 · 서양 도시(북미 중심가·유럽 구시가)', role='building', defaultLayer='upper', tileIds=bt,
                                          description=f'서양 도시 세트 건물 칸(country:west). 정면 + 위에서 본 지붕 면. {NOTE}.', placementRules='건물 키트(mc-bld-w-*)째 위층에 찍는다. 낱칸으로 칠하지 않는다.', source='bundled-default', confidence='high', layerHome='upper'))
    if ot: data['tileGroups'].append(dict(id=GROUP_OBJ, name='소품 · 서양 도시·시골(보도·가게 앞·테라스·장터·공원·골목·공사장·정류장·계절·옥상·농장)', role='prop', defaultLayer='upper', tileIds=ot,
                                          description=f'서양 도시 세트 기물 칸(country:west). {NOTE}.', placementRules='키트(mc-prop-w-*)째 위층에 찍는다. 낱칸으로 칠하지 않는다.', source='bundled-default', confidence='high', layerHome='upper'))
    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids and not k['id'].startswith(('mc-bld-w-', 'mc-prop-w-'))] + kit_defs
    report.update(count_before=count0, count_after=data['count'], owned_cells=len(mine), cells=[min(mine), max(mine)] if mine else [], buildings=sum(1 for k in kit_defs if k['id'].startswith('mc-bld-w-')),
                  objects=sum(1 for k in kit_defs if k['id'].startswith('mc-prop-w-')), not_baked=missing(), sheet=[sheet.width, sheet.height])
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
        opened, blocked = gate(); print('번들 출구 열림', len(opened), '· 막힘', len(blocked), '· 그림 없음', len(missing()))
        for b in blocked[:20]: print('  %s: %s' % b)
    elif len(sys.argv) > 1 and sys.argv[1] == 'manifest':
        m = manifest(); out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(WEST, 'waiver-manifest.json')
        json.dump(m, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('manifest', len(m['items']), out)
    else:
        r = apply(dry='--dry' in sys.argv); r['not_baked'] = len(r['not_baked']); r['gate']['blocked'] = len(r['gate']['blocked'])
        print(json.dumps(r, ensure_ascii=False, indent=1))
