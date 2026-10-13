"""고딕 저택(gothic_manor) 실내 공간 조립 레시피 → src/assets/gothicSpaceSpec.json.

조수 도구 compose_gothic_place(src/editor/tools/gothicPlaceTools.ts)의 실내 갈래가 이 사양으로 방 한 장을 결정론으로 짓는다.
조립 규칙은 마법 학교와 같은 순수 함수 src/editor/wizarding/builder.ts(buildWizardingSpace — 사양을 인자로 받는다). 이 파일은 «어느 방에 무엇을 어디에» 만 적는다.
야외(저택 정원·공동묘지·미술관 앞마당)는 src/editor/gothic/composer.ts 가 따로 짓는다.

  python3 scripts/content/gothic-manor/space_recipes_gm.py          # 사양을 쓴다(굽기 뒤)
  python3 scripts/content/gothic-manor/space_recipes_gm.py --check  # 쓰지 않고 빠진 id 만 본다

재료 id 는 굽기 산출물(src/assets/gothicManorTileset.json)의 키트(structureKits)·1×1 반복 조각(tileGroups `gm:floor:<id>`)·
오토타일 중 하나여야 한다. 관문을 못 넘어 굽기에 없는 id 는 경고를 찍고 사양에서 뺀다 — 다시 굽고 이 스크립트를 다시 돌리면 들어간다.
가구 항목 뜻은 scripts/content/wizarding/space_recipes.py 머리말과 같다(placement · count · clearance · wallTop · wallMatch · with · near · gap · vary · alt).
바닥·벽 밝기 관문: 실내 공간마다 바닥과 북벽 벽면의 평균 밝기 차가 CONTRAST_MIN(35) 미만이면 사양을 쓰지 않는다.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import gmlib  # noqa: E402

TILESET = os.path.join(ROOT, 'src', 'assets', 'gothicManorTileset.json')
OUT = os.path.join(ROOT, 'src', 'assets', 'gothicSpaceSpec.json')
SHEET = os.path.join(ROOT, 'public', 'assets', 'gothic-manor', 'gothic-manor-chipset.png')
CONTRAST_MIN = 35


def _ws(k, ko, rhythm):
    p = f'gm-w{k}-'
    return dict(ko=ko, n=p + 'n', nw=p + 'nw', ne=p + 'ne', w=p + 'w', e=p + 'e', s=p + 's', sw=p + 'sw', se=p + 'se',
                door1=p + 'door1', door2=p + 'door2', rhythm=[r if r == 'n' else p + r for r in rhythm], sRhythm=['s'], capSouth=True)


# 벽 묶음: 남벽은 윗면 한 줄(capSouth) — 3/4 시점에서 방 남벽 정면은 보이지 않는다.
WALLSETS = {
    'manor': _ws('m', '저택 붉은 다마스크 벽지', ['n', 'n', 'n-window', 'n', 'n-sconce', 'n', 'n', 'n-lightning', 'n', 'n-sconce']),
    'stone': _ws('s', '지하 마름돌 벽', ['n', 'n', 'n-sconce', 'n', 'n', 'n']),
    'chapel': _ws('s', '예배당 돌벽(첨두 창)', ['n', 'n-window', 'n', 'n-sconce', 'n', 'n-lightning']),
    'gallery': _ws('g', '미술관 회녹색 회벽', ['n', 'n', 'n', 'n-sconce', 'n', 'n', 'n', 'n-window']),
}
RUNNER = dict(ns='gm-runner-ns', ew='gm-runner-ew', nEnd='gm-runner-n-end', sEnd='gm-runner-s-end')


def F(kit, placement, lo, hi, clearance=1, **kw):
    d = dict(kit=kit, placement=placement, count=[lo, hi], clearance=clearance)
    for k, v in kw.items():
        if v is not None: d[k] = v
    return d


def D(kit, lo, hi, near=None):
    d = dict(kit=kit, count=[lo, hi])
    if near: d['near'] = list(near)
    return d


def FL(base, mix=True):
    return dict(tile=base + '-a', **({'mix': [base + '-b']} if mix else {}))


PAINTINGS = [F('gm-paint-portrait', 'north-wall', 1, 3, 0, wallTop=1, wallMatch='plain'),
             F('gm-paint-cursed', 'north-wall', 0, 1, 0, wallTop=1, wallMatch='plain'),
             F('gm-paint-landscape', 'north-wall', 0, 2, 0, wallTop=2, wallMatch='plain')]
CANDLES = F('gm-candelabra', 'corner', 1, 2, 0, access=False)
HORROR_DECALS = [D('gm-ov-cobweb', 1, 2), D('gm-ov-dust', 1, 3), D('gm-ov-stain', 0, 1)]

SPACES = {
    'hall': dict(
        ko='저택 현관 홀', indoor=True, layout='room', wall='manor',
        size=dict(min=[14, 11], default=[22, 16], max=[40, 30]), floor=FL('gm-fl-marble'), runner=RUNNER,
        defaultDoors=[dict(side='s', kind='double'), dict(side='n', kind='double')],
        furniture=[F('gm-clock', 'north-wall', 1, 1, 0, wallTop=2, wallMatch='plain'),
                   *PAINTINGS,
                   F('gm-armor', 'side-wall', 2, 4, 1),
                   F('gm-sofa', 'edge', 0, 1, 1),
                   F('gm-table-round', 'beside', 0, 1, 0, near=['gm-sofa']),
                   F('gm-candelabra', 'side-wall', 1, 2, 1, access=False),
                   F('gm-vase-plinth', 'corner', 1, 2, 0, access=False)],
        decals=HORROR_DECALS,
        variants=dict(
            corridor=dict(ko='저택 복도', size=dict(min=[8, 14], default=[9, 22], max=[14, 44]),
                          floor=FL('gm-fl-parquet'), defaultDoors=[dict(side='s'), dict(side='n')],
                          furniture=[*PAINTINGS, F('gm-armor', 'side-wall', 1, 3, 1), F('gm-candelabra', 'side-wall', 1, 2, 1, access=False),
                                     F('gm-clock', 'north-wall', 0, 1, 0, wallTop=2, wallMatch='plain')]),
            dining=dict(ko='저택 식당', size=dict(min=[14, 11], default=[18, 13], max=[32, 24]),
                        floor=FL('gm-fl-parquet'), runner=None, defaultDoors=[dict(side='s')],
                        furniture=[F('gm-dining-table', 'center', 1, 1, 1, with_=[['gm-chair', 0, -1], ['gm-chair', 1, -1], ['gm-chair', 2, -1], ['gm-chair', 3, -1],
                                                                                  ['gm-chair', 0, 2], ['gm-chair', 1, 2], ['gm-chair', 2, 2], ['gm-chair', 3, 2]]),
                                   F('gm-wm-n-fireplace', 'north-wall', 1, 1, 1, wallTop=0, wallMatch='plain'),
                                   *PAINTINGS, F('gm-clock', 'north-wall', 0, 1, 0, wallTop=2, wallMatch='plain'),
                                   F('gm-candelabra', 'corner', 2, 3, 0, access=False),
                                   F('gm-pot-shelf', 'side-wall', 0, 1, 0)]),
        )),
    'library': dict(
        ko='저택 서재', indoor=True, layout='room', wall='manor',
        size=dict(min=[14, 11], default=[20, 15], max=[36, 28]), floor=FL('gm-fl-parquet'), runner=None,
        defaultDoors=[dict(side='s')],
        furniture=[F('gm-wm-n-fireplace', 'north-wall', 1, 1, 1, wallTop=0, wallMatch='plain'),
                   F('gm-bookshelf', 'north-wall', 2, 5, 0, wallTop=2, wallMatch='plain'),
                   F('gm-bookshelf', 'grid', 2, 6, 0, gapX=0, gapY=1),
                   F('gm-rug-persian', 'center', 1, 1, 0, access=False, with_=[['gm-table-round', 1, 0]]),
                   F('gm-armchair', 'beside', 1, 2, 0, near=['gm-wm-n-fireplace']),
                   F('gm-desk', 'edge', 1, 1, 1, with_=[['gm-chair', 0, 2]]),
                   F('gm-candelabra', 'beside', 1, 2, 0, near=['gm-desk', 'gm-wm-n-fireplace'], access=False),
                   F('gm-paint-cursed', 'north-wall', 0, 1, 0, wallTop=1, wallMatch='plain')],
        decals=HORROR_DECALS),
    'bedroom': dict(
        ko='저택 침실', indoor=True, layout='room', wall='manor',
        size=dict(min=[12, 10], default=[16, 12], max=[30, 24]), floor=FL('gm-fl-parquet'), runner=None,
        defaultDoors=[dict(side='s')],
        furniture=[F('gm-bed', 'north-wall', 1, 1, 1, wallTop=3, wallMatch='plain'),
                   F('gm-vanity', 'north-wall', 0, 1, 0, wallTop=3, wallMatch='plain'),
                   F('gm-wardrobe', 'side-wall', 1, 1, 0),
                   F('gm-candelabra', 'beside', 1, 1, 0, near=['gm-bed'], access=False),
                   F('gm-paint-portrait', 'north-wall', 0, 2, 0, wallTop=1, wallMatch='plain'),
                   F('gm-armchair', 'edge', 0, 1, 0),
                   F('gm-rug-persian', 'center', 0, 1, 0, access=False)],
        decals=HORROR_DECALS),
    'kitchen': dict(
        ko='저택 부엌', indoor=True, layout='room', wall='stone',
        size=dict(min=[12, 10], default=[16, 12], max=[30, 24]), floor=FL('gm-fl-tile'), runner=None,
        defaultDoors=[dict(side='s')],
        furniture=[F('gm-stove', 'north-wall', 1, 1, 1, wallTop=3, wallMatch='plain'),
                   F('gm-pot-shelf', 'north-wall', 1, 3, 0, wallTop=3, wallMatch='plain'),
                   F('gm-kitchen-table', 'center', 1, 2, 1, with_=[['gm-chair', 0, 2]]),
                   F('gm-barrel', 'corner', 1, 2, 0),
                   F('gm-barrel', 'beside', 1, 3, 0, near=['gm-barrel'])],
        decals=[D('gm-ov-stain', 1, 2, near=['gm-kitchen-table']), D('gm-ov-dust', 1, 2)]),
    'cellar': dict(
        ko='지하실·포도주 창고', indoor=True, layout='room', wall='stone',
        size=dict(min=[12, 10], default=[18, 13], max=[36, 28]), floor=FL('gm-fl-flag'), runner=None,
        defaultDoors=[dict(side='n')],
        furniture=[F('gm-wine-rack', 'north-wall', 2, 4, 0, wallTop=3, wallMatch='plain'),
                   F('gm-wine-rack', 'grid', 2, 4, 0, gapX=1, gapY=1),
                   F('gm-barrel', 'corner', 2, 3, 0),
                   F('gm-barrel', 'beside', 1, 3, 0, near=['gm-barrel']),
                   F('gm-candelabra', 'edge', 1, 1, 0, access=False)],
        decals=[D('gm-ov-stain', 1, 2), D('gm-ov-cobweb', 1, 2), D('gm-bones', 0, 2), D('gm-ov-puddle', 1, 2)]),
    'chapel': dict(
        ko='예배당 안', indoor=True, layout='room', wall='chapel',
        size=dict(min=[13, 12], default=[17, 16], max=[30, 30]), floor=FL('gm-fl-flag'), runner=RUNNER,
        defaultDoors=[dict(side='s', kind='double')],
        furniture=[F('gm-altar', 'north-wall', 1, 1, 1, wallTop=4, wallMatch='plain'),
                   F('gm-candelabra', 'beside', 2, 2, 0, near=['gm-altar'], access=False),
                   F('gm-pew', 'grid', 4, 10, 0, gapX=2, gapY=1),
                   F('gm-statue-gargoyle', 'corner', 0, 2, 0, access=False)],
        decals=[D('gm-ov-dust', 1, 3), D('gm-ov-cobweb', 1, 2)]),
    'crypt': dict(
        ko='지하 납골당', indoor=True, layout='room', wall='stone',
        size=dict(min=[12, 10], default=[16, 13], max=[32, 26]), floor=FL('gm-fl-flag'), runner=None,
        defaultDoors=[dict(side='n')],
        furniture=[F('gm-sarcophagus', 'grid', 2, 6, 0, gapX=2, gapY=1),
                   F('gm-coffin', 'edge', 1, 3, 0),
                   F('gm-coffin-open', 'edge', 0, 1, 0),
                   F('gm-urn', 'beside', 1, 2, 0, near=['gm-sarcophagus']),
                   F('gm-statue-gargoyle', 'corner', 0, 2, 0, access=False),
                   F('gm-candelabra', 'corner', 1, 2, 0, access=False)],
        decals=[D('gm-bones', 1, 3), D('gm-ov-cobweb', 1, 2), D('gm-ov-puddle', 0, 2)]),
    'gallery': dict(
        ko='미술관 전시실', indoor=True, layout='room', wall='gallery',
        size=dict(min=[14, 11], default=[22, 15], max=[44, 30]), floor=FL('gm-fl-marble'), runner=None,
        defaultDoors=[dict(side='s', kind='double'), dict(side='e')],
        furniture=[F('gm-paint-portrait', 'north-wall', 2, 5, 0, wallTop=1, wallMatch='plain'),
                   F('gm-paint-landscape', 'north-wall', 1, 3, 0, wallTop=2, wallMatch='plain'),
                   F('gm-paint-cursed', 'north-wall', 1, 1, 0, wallTop=1, wallMatch='plain'),
                   F('gm-display-case', 'grid', 2, 4, 1, gapX=3, gapY=2),
                   F('gm-museum-bench', 'center', 1, 1, 1),
                   F('gm-bust-plinth', 'side-wall', 2, 4, 1),
                   F('gm-armor', 'side-wall', 0, 2, 1),
                   F('gm-stanchion', 'edge', 1, 2, 0),
                   F('gm-vase-plinth', 'corner', 1, 2, 0, access=False)],
        decals=[D('gm-ov-dust', 0, 2)]),
}


def load_tileset():
    with open(TILESET, encoding='utf-8') as f:
        return json.load(f)


def resolver(ts):
    kits = {k['id']: k for k in ts['structureKits']}
    groups = {g['id'][len('gm:floor:'):]: g for g in ts['tileGroups'] if g['id'].startswith('gm:floor:')}
    autos = {a['id']: a for a in ts['autotileGroups']}

    def info(pid):
        if pid in kits:
            k = kits[pid]; return dict(name=k['name'], w=k['width'], h=k['height'], src='kit')
        if pid in groups and len(groups[pid]['tileIds']) == 1:
            return dict(name=groups[pid]['name'], w=1, h=1, src='tile')
        if pid in autos:
            return dict(name=autos[pid]['name'], w=1, h=1, src='autotile')
        return None
    return info


def contrast_table(ts, spaces, wallsets):
    from PIL import Image
    sheet = Image.open(SHEET).convert('RGBA')
    per = ts['tilesPerRow']; size = ts['tileSize']
    kits = {k['id']: k for k in ts['structureKits']}
    groups = {g['id'][len('gm:floor:'):]: g for g in ts['tileGroups'] if g['id'].startswith('gm:floor:')}

    def lum(tids):
        tot = n = 0
        for t in tids:
            if t is None or t < 0: continue
            im = sheet.crop(((t % per) * size, (t // per) * size, (t % per + 1) * size, (t // per + 1) * size))
            px = im.tobytes()
            for i in range(0, len(px), 4):
                if px[i + 3] < 128: continue
                tot += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; n += 1
        return tot / n if n else 0.0

    def wall_face(wid):
        k = kits[wallsets[wid]['n']]
        tids = []
        for row in k['rows'][1:]:
            for lo, up in zip(row['tiles'], row.get('upperTiles') or [-1] * len(row['tiles'])):
                tids.append(up if up is not None and up >= 0 else lo)
        return lum(tids)

    rows = []
    for key, sp in spaces.items():
        jobs = [(key, sp['floor'], sp['wall'])]
        for vid, v in (sp.get('variants') or {}).items():
            jobs.append((f'{key}.{vid}', v.get('floor') or sp['floor'], v.get('wall', sp['wall'])))
        for name, fl, wid in jobs:
            fk = fl['tile']
            f, w = lum(groups[fk]['tileIds'][:1]) if fk in groups else 0, wall_face(wid)
            rows.append((name, fk, wid, f, w, abs(w - f)))
    return rows


def main(check=False):
    ts = load_tileset()
    info = resolver(ts)
    warnings, used = [], {}

    def ok(pid, where):
        i = info(pid)
        if i is None: warnings.append(f'{where}: {pid} 없음(건너뜀)'); return False
        used[pid] = i; return True

    def clean_furniture(items, where):
        out = []
        for it in items:
            it = dict(it)
            if 'with_' in it: it['with'] = it.pop('with_')
            if not ok(it['kit'], where): continue
            for key in ('near', 'alt'):
                if key in it:
                    it[key] = [x for x in it[key] if ok(x, f"{where}/{it['kit']}.{key}")]
                    if not it[key]: del it[key]
            if 'with' in it:
                it['with'] = [dict(kit=w[0], dx=w[1], dy=w[2], **({'under': True} if len(w) > 3 and w[3] else {})) for w in it['with'] if ok(w[0], f"{where}/{it['kit']}")]
            out.append(it)
        return out

    def clean_floor(fl, where):
        out = dict(fl)
        if not ok(fl['tile'], where): return None
        if 'mix' in fl: out['mix'] = [m for m in fl['mix'] if ok(m, where)]
        return out

    wallsets = {}
    for wid, ws in WALLSETS.items():
        o = {}
        for k, v in ws.items():
            if k in ('rhythm', 'sRhythm'): o[k] = [r for r in v if r in ('n', 's') or ok(r, f'벽 {wid}.{k}')]
            elif k == 'ko': o[k] = v
            elif k == 'capSouth': continue
            elif ok(v, f'벽 {wid}.{k}'): o[k] = v
        for need in ('n', 'w', 'e', 's'):
            if need not in o: raise SystemExit(f'벽 묶음 {wid} 의 필수 조각 {need} 가 굽기에 없다')
        o['northRows'] = used[o['n']]['h']; o['southRows'] = 1 if ws.get('capSouth') else used[o['s']]['h']
        wallsets[wid] = o

    spaces = {}
    for key, sp in SPACES.items():
        assert key in gmlib.SPACES, key
        o = {k: v for k, v in sp.items() if k not in ('furniture', 'decals', 'floor', 'runner', 'variants')}
        o['spaceKo'] = gmlib.SPACES[key]
        o['floor'] = clean_floor(sp['floor'], key)
        if o['floor'] is None: raise SystemExit(f'{key} 바닥이 굽기에 없다')
        if sp.get('runner'):
            r = {k: v for k, v in sp['runner'].items() if ok(v, f'{key} 러너')}
            if 'ns' in r or 'ew' in r: o['runner'] = r
        o['furniture'] = clean_furniture(sp['furniture'], key)
        o['decals'] = []
        for d in sp['decals']:
            if not ok(d['kit'], f'{key} 덧그림'): continue
            d = dict(d)
            if 'near' in d:
                d['near'] = [x for x in d['near'] if ok(x, f"{key} 덧그림 {d['kit']}.near")]
                if not d['near']: del d['near']
            o['decals'].append(d)
        o['npcs'] = []
        if 'variants' in sp:
            vs = {}
            for vid, v in sp['variants'].items():
                vo = {k: x for k, x in v.items() if k not in ('furniture', 'floor', 'runner')}
                if 'floor' in v: vo['floor'] = clean_floor(v['floor'], f'{key}.{vid}')
                if 'runner' in v: vo['runner'] = None if v['runner'] is None else {k: x for k, x in v['runner'].items() if ok(x, f'{key}.{vid} 러너')}
                if 'furniture' in v: vo['furniture'] = clean_furniture(v['furniture'], f'{key}.{vid}')
                vs[vid] = vo
            o['variants'] = vs
        spaces[key] = o

    table = contrast_table(ts, spaces, wallsets)
    print(f"{'공간':<22}{'바닥':<22}{'벽':<10}{'바닥밝기':>8}{'벽밝기':>8}{'차':>7}")
    bad = []
    for name, fk, wid, f, w, d in table:
        flag = '' if d >= CONTRAST_MIN else '  ← 미달'
        print(f'{name:<22}{fk:<22}{wid:<10}{f:8.1f}{w:8.1f}{d:7.1f}{flag}')
        if d < CONTRAST_MIN: bad.append(name)
    if bad: raise SystemExit(f'바닥·벽 밝기 차 {CONTRAST_MIN} 미달: {", ".join(bad)}')

    spec = dict(version=1, tilesetId='gothic_manor', tileCount=ts['count'],
                note='scripts/content/gothic-manor/space_recipes_gm.py 가 굽는다(손 편집 금지). 조립 규칙 src/editor/wizarding/builder.ts.',
                wallsets=wallsets, spaces=spaces,
                pieces={k: dict(name=v['name'], w=v['w'], h=v['h'], src=v['src']) for k, v in sorted(used.items())},
                skipped=sorted(set(warnings)))
    for w in sorted(set(warnings)): print('경고', w)
    print(f'공간 {len(spaces)} · 벽 묶음 {len(wallsets)} · 쓰는 조각 {len(used)} · 건너뜀 {len(set(warnings))}')
    if not check:
        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump(spec, f, ensure_ascii=False, indent=1); f.write('\n')
        print('→', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main(check='--check' in sys.argv)
