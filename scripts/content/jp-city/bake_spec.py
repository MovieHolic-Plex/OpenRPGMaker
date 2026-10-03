#!/usr/bin/env python3
"""jp_city 건물 부품 사전 생성기 — 카탈로그(jp_shopstreet16.catalog.json) + 굽기 결과(pins.json·jpCityTileset.json·시트 PNG)에서
`src/assets/jpCityBuildingSpec.json` 을 만든다. 손으로 고치지 않는다(같은 입력 → 바이트 동일).

  python3 scripts/content/jp-city/bake_spec.py [--check] [--out PATH]

--check : 파일을 쓰지 않고, 지금 파일이 생성 결과와 바이트까지 같은지만 본다(다르면 종료 코드 1).

부품 사전은 칸 **번호**(= 새 시트 타일 번호)만 담는다. 원본 칸 번호와 새 시트 번호는 같고, 통행이 다른 쓰임이 필요하면 pins.json 의
`jp16/<번호>@<pc>` 복제 칸을 쓴다(bake_jp.raw 와 같은 규칙). 띠 칸은 줄(row)마다 pc 가 정해진다(band_row_pc: 지면 층 둘째·셋째 줄 = 막힘),
부착물 칸은 문 아래 두 줄만 막힘(deco_row_pc), 거리 칸은 street_pc. 이 pc 가 정의 JSON 의 통행·층과 맞는지 생성 중에 단언한다.
TS 조립기(src/editor/jpCity/builder.ts)와 Python 원본 Kit(lib/jpstreet.py) 의 일치는 diff_builder.py / diff_builder.mjs 가 증명한다.
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))
import bake_jp as B            # noqa: E402
import bake_lib as BL          # noqa: E402
import bake_names as KO        # noqa: E402
from PIL import Image          # noqa: E402

OUT = os.path.join(ROOT, 'src', 'assets', 'jpCityBuildingSpec.json')
SHEET = os.path.join(ROOT, 'public', 'assets', 'jp-city', 'jp-city-chipset.png')
TILESET = os.path.join(ROOT, 'src', 'assets', 'jpCityTileset.json')
PINS = os.path.join(ROOT, 'tiledata', 'jp-city', 'pins.json')

WALL_KO = KO.WALL
KIND_KO = KO.FLOOR_KIND
# bake_jp.bake() 안 지역 사전이라 import 할 수 없어 옮겨 적었다(예제 이름표만, 그림·번호와 무관).
RECIPE_KO = {'izakaya_tower': '이자카야 타워', 'konbini_block': '편의점 블록', 'garage_flats': '차고 아파트', 'shutter_office': '셔터 사무소',
             'setback_shop': '셋백 점포', 'narrow_shutter': '좁은 셔터 점포', 'wide_konbini': '넓은 편의점', 'izakaya_alt': '이자카야 (벽돌)',
             'garage_tall': '차고 고층', 'big_setback': '큰 셋백 건물', 'machiya_izakaya': '마치야 이자카야', 'sushi_bar': '초밥집', 'ramen_tower': '라멘 타워',
             'bento_corner': '도시락 가게', 'sento_front': '대중목욕탕 정면', 'danchi_flats': '단지 아파트', 'bar_row': '술집 거리 건물', 'office_shutter': '셔터 사무소 (큰)',
             'mansion_veranda': '베란다 맨션', 'office_slide': '미닫이창 사무소', 'mixed_tenant': '복합 임대 건물', 'slim_tower': '가는 타워',
             'L_office_cafe': 'L자 사무소 + 카페', 'L_machiya_annex': 'L자 마치야 + 별채', 'L_flats_lot': 'L자 아파트 + 주차장'}
# jpstreet.Kit.assemble 이 부착물을 창 위에 얹는지 검사하는 종류(gen.lint_specs 와 같은 목록).
WINDOW_SENSITIVE = ('sign_h', 'plate', 'sunshade', 'ac', 'laundry', 'wallad', 'mushiko')
DECO_GROUP_KO = {'door': '문', 'sign_h': '가로 간판', 'vstack': '세로 간판 적층', 'vsign': '세로 간판', 'plate': '간판판', 'board': '입간판판', 'wallad': '벽 광고',
                 'rtext': '옥상 글자 간판', 'facade_ad': '외벽 광고', 'vision': '대형 영상 화면', 'mural': '외벽 벽화', 'ac': '에어컨 실외기', 'pipe': '배관',
                 'laundry': '빨래', 'sunshade': '차양', 'inuyarai': '개 막이 울타리', 'mushiko': '무시코 창(격자 덧창)', 'fe': '비상계단', 'fe_end': '비상계단'}


def to_input(spec):
    """카탈로그 spec(n·head·roof·eave·floors·ground·ground_vs·door·decos·setback) → TS 조립기 입력(camelCase). 값은 그대로, 이름만 바꾼다."""
    o = {'w': spec['n']}
    if spec.get('head'): o['head'] = spec['head']
    o['roof'] = spec['roof']
    if spec.get('eave'): o['eave'] = spec['eave']
    o['floors'] = [dict(({'band': f['band']} if 'band' in f else {'kind': f['kind'], 'wall': f.get('wall') or 'kinari'}), variants=list(f.get('vs', [0]))) for f in spec['floors']]
    o['ground'] = spec['ground']
    if spec.get('ground_vs') is not None: o['groundVariants'] = list(spec['ground_vs'])
    if spec.get('door'): o['door'] = {'type': spec['door'][0], 'col': spec['door'][1]}
    if spec.get('setback'): o['setback'] = dict(upper=spec['setback']['upper'], ins=spec['setback']['ins'])
    ds = []
    for d in spec.get('decos', []):
        e = {'deco': d['deco'], 'col': d['col'], 'floor': d['floor']}
        if 'row' in d: e['row'] = d['row']
        if 'cols' in d: e['cols'] = list(d['cols'])
        ds.append(e)
    o['decos'] = ds
    return o


def l_to_input(spec):
    """L자 카탈로그 spec → TS 입력: 본채 필드 + wing(별채 필드 + side·depth·yard)."""
    o = to_input(spec['main'])
    o['wing'] = dict(to_input(spec['wing']), side=spec.get('side', 'L'), depth=spec.get('depth', 2), yard=spec.get('yard', 'lot'))
    return o


def build():
    src = B.Src(); cat = src.cat
    pins = json.load(open(PINS, encoding='utf-8'))['cells']
    ts = json.load(open(TILESET, encoding='utf-8'))
    sheet = Image.open(SHEET).convert('RGBA')
    used = set()

    def tid(i, pc):
        """bake_jp.raw 와 같은 규칙: 기본 pc 면 원본 번호, 아니면 같은 그림 복제 칸(pins.json)."""
        if pc == src.primary[i]: t = i
        else:
            t = pins.get(f'jp16/{i}@{pc}')
            assert t is not None, ('복제 칸이 굽기에 없다 — bake_jp.py 가 이 (칸, 통행) 조합을 구워야 한다', i, pc)
        # 정의 JSON 의 통행·층과 맞는가
        up = ts['priority'][t] == 'upper'; ps = any(ts['passability'][t].values())
        got = ('star' if ps else 'solid') if up else ('floor' if ps else 'solidfloor')
        want = pc if pc != 'flat' else 'floor'
        assert got == want, ('통행 불일치', i, pc, t, got)
        used.add((t, pc))
        return t

    def cell(nm, pc):
        i = src.idx_of(nm) if nm else None
        if i is None or src.alpha[i] == 'blank': return None
        return tid(i, pc)

    bands = {}
    for bid, rec in cat['bands'].items():
        p = bid.split('.')
        ko, _role = KO.band_ko(bid)
        if p[0] == 'fl': kind = 'floor'
        elif bid.startswith('roofsign.'): kind = 'roofsign'
        elif bid.startswith('roof.'): kind = 'roof'
        elif bid == 'terrace': kind = 'terrace'
        elif bid.startswith('gr.'): kind = 'ground'
        elif bid.startswith('eave'): kind = 'eave'
        else: raise KeyError(bid)
        rows = rec['rows']
        pc = lambda r: B.band_row_pc(bid, r)
        e = dict(ko=ko, kind=kind, rows=rows, modw=rec['modw'])
        e['L'] = [cell(rec['L'][r], pc(r)) for r in range(rows)]
        e['R'] = [[cell(rec['R'][k][r], pc(r)) for r in range(rows)] for k in (0, 1)]
        e['mods'] = {v: [[cell(mod[j][r], pc(r)) for r in range(rows)] for j in range(rec['modw'])] for v, mod in rec['mods'].items()}
        e['F'] = [cell(rec['F'][r], pc(r)) for r in range(rows)] if rec['F'] else None
        bands[bid] = e

    # 층 띠 종류 · 허용 벽 재질 · 몸통 변형
    floor_kinds = {}
    for bid, b in bands.items():
        if b['kind'] != 'floor': continue
        _, kind, wall = bid.split('.')
        fk = floor_kinds.setdefault(kind, dict(ko=KIND_KO[kind], walls=[], variants=sorted(int(v) for v in b['mods']), modw=b['modw']))
        fk['walls'].append(wall)
        assert fk['variants'] == sorted(int(v) for v in b['mods']), ('같은 종류인데 벽마다 변형이 다르다', bid)
    walls = {w: WALL_KO[w] for w in WALL_KO}
    grounds = {}
    for bid, b in bands.items():
        if b['kind'] != 'ground': continue
        grounds[bid] = dict(ko=b['ko'], door=cat['doorDefault'][bid], modw=b['modw'], variants=sorted(int(v) for v in b['mods']))
    roofs = {bid: dict(ko=b['ko'], pitched=bid in ('roof.tile', 'roof.slate', 'roof.hip', 'roof.hip.slate')) for bid, b in bands.items() if b['kind'] == 'roof'}
    heads = {bid: dict(ko=b['ko']) for bid, b in bands.items() if b['kind'] == 'roofsign'}
    eaves = {bid: dict(ko=b['ko']) for bid, b in bands.items() if b['kind'] == 'eave'}

    decos = {}
    for did, d in cat['decos'].items():
        g = did.split('.')[0]
        rows = []
        for r in range(d['h']):
            rows.append([cell(d['cells'][r][c], B.deco_row_pc(did, r, d['h'])) for c in range(d['w'])])
        decos[did] = dict(ko=KO.deco_ko(did), group=g, groupKo=DECO_GROUP_KO[g], w=d['w'], h=d['h'], cells=rows, avoidsWindows=g in WINDOW_SENSITIVE)
    doors = {did[5:]: dict(ko=decos[did]['ko'], w=decos[did]['w'], h=decos[did]['h']) for did in decos if did.startswith('door.')}

    street = {}
    for sn, nm in cat['street'].items():
        i = src.idx_of(nm)
        if i is None or src.alpha[i] == 'blank': continue
        street[sn] = tid(i, B.street_pc(sn))
    # 마당으로 쓸 수 있는 거리 칸: 불투명 아래층(L자 별채 앞 땅). 투명·막힌 칸은 뺀다.
    yards = [sn for sn, t in street.items() if ts['priority'][t] == 'lower' and any(ts['passability'][t].values())
             and BL.alpha_class(BL.read_cell(sheet, t)) == 'opaque']

    # 칸 성질: 이 사전의 칸 번호 중 아래층 / 막힘 / 온전히 불투명(= 아래 칸을 가린다)
    def all_tids():
        s = set()
        for b in bands.values():
            s.update(t for t in b['L'] if t is not None); s.update(t for col in b['R'] for t in col if t is not None)
            s.update(t for mod in b['mods'].values() for col in mod for t in col if t is not None); s.update(t for t in (b['F'] or []) if t is not None)
        for d in decos.values(): s.update(t for row in d['cells'] for t in row if t is not None)
        s.update(street.values())
        return sorted(s)
    tids = all_tids()
    lower = [t for t in tids if ts['priority'][t] == 'lower']
    solid = [t for t in tids if ts['priority'][t] == 'upper' and not any(ts['passability'][t].values())]
    opaque = [t for t in tids if BL.alpha_class(BL.read_cell(sheet, t)) == 'opaque']

    examples = {}
    for rn, sp in cat['recipes'].items():
        examples[rn] = dict(ko=RECIPE_KO[rn], input=to_input(sp))
    for rn, sp in cat['lRecipes'].items():
        examples[rn] = dict(ko=RECIPE_KO[rn], input=l_to_input(sp))

    spec = dict(
        version=1, tileset='jp_city', tileSize=16, tilesPerRow=ts['tilesPerRow'], count=ts['count'],
        note='scripts/content/jp-city/bake_spec.py 가 만든다. 손으로 고치지 않는다. 칸 번호 = jp_city 시트 타일 번호.',
        limits=dict(minWidth=3, floorRows=2, maxLayersOverBase=1),
        walls=walls, floorKinds=floor_kinds, grounds=grounds, roofs=roofs, heads=heads, eaves=eaves, bands=bands,
        decos=decos, doors=doors, doorDefault=cat['doorDefault'], street=street, yards=yards,
        lower=lower, solid=solid, opaque=opaque, examples=examples,
    )
    stats = dict(bands=len(bands), floorKinds=len(floor_kinds), grounds=len(grounds), roofs=len(roofs), heads=len(heads), eaves=len(eaves), decos=len(decos),
                 doors=len(doors), street=len(street), yards=len(yards), tiles=len(tids), lower=len(lower), solid=len(solid), opaque=len(opaque), examples=len(examples))
    return spec, stats


def dumps(spec):
    return json.dumps(spec, ensure_ascii=False, separators=(',', ':')) + '\n'


def main():
    ap = argparse.ArgumentParser(description='jp_city 건물 부품 사전 생성')
    ap.add_argument('--check', action='store_true', help='파일을 쓰지 않고 지금 파일이 생성 결과와 같은지만 본다')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    spec, stats = build()
    text = dumps(spec)
    if a.check:
        cur = open(a.out, encoding='utf-8').read() if os.path.exists(a.out) else None
        print(json.dumps(dict(stats=stats, identical=(cur == text)), ensure_ascii=False))
        sys.exit(0 if cur == text else 1)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write(text)
    print(json.dumps(dict(out=os.path.relpath(a.out, ROOT), bytes=len(text.encode('utf-8')), **stats), ensure_ascii=False))


if __name__ == '__main__':
    main()
