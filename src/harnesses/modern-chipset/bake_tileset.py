#!/usr/bin/env python3
"""현대 도시 하네스 합격 에셋 → 에디터용 타일셋(modern_city) 굽기.

  python3 src/harnesses/modern-chipset/bake_tileset.py [--dry] [--budget N] [--selftest] [--out-root DIR]

입력  harness-data/modern-chipset/town_assets*.json(합격 에셋 목록) + tiledata/modern-city/sources/<판>_<글자>.png(합격 PNG 사본) — compose_town.load_assets 가 읽는 것과 같다.
출력  public/assets/modern-city/modern-city-chipset.png      시트(16px 칸, 높이 ≤ 4096)
      src/assets/modernCitySheet.json                        {count, tilesPerRow}
      src/assets/modernCityTileset.json                      타일셋 정의(통행·층·이름표·그룹·오토타일·구조 키트)
      tiledata/modern-city/pins.json                         칸 내용 해시 → 번호(앞 번호 불변, 새 칸은 끝에)
      tiledata/modern-city/bake-report.json                  칸 수·키트 수·검증 숫자·칸 예산 내역
      tiledata/modern-city/kit-index.json                    키트 id → 종류·크기·출처·문·접근 칸(참고문서·예제 맵 담당이 읽는다)
새 그림은 그리지 않는다. 합격 PNG 를 16px 칸으로 자르고, 도로 표시·그림자는 town_lib/compose_town 의 코드를 그대로 불러 칸 오버레이로 굽는다.
"""
import argparse, collections, copy, hashlib, json, math, os, random, shutil, sys, tempfile, time
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import bake_lib as BL            # noqa: E402
import bake_data as D            # noqa: E402
import compose_city as CC        # noqa: E402
import compose_town as CT        # noqa: E402
import town_lib as TL            # noqa: E402
import parking_bundle            # noqa: E402

BAKE_SEED = 1                    # 옥상 설비·간판 배치 시드(고정). 같은 입력 → 같은 그림.
ROOF_ROOM = 16                   # 옥상 설비가 건물 그림 위로 솟아도 되는 높이(px) — 위쪽 패딩 칸 수를 억제
BUDGET = 10000                   # 전체 칸 상한(시트 높이 4096px · 열 48 이면 12288 칸이 한계)
SHOPLIKE = ('shop', 'cafe', 'conv', 'izakaya', 'bakery', 'neon', 'civic_police', 'civic_fire', 'civic_post')
ID = 'modern_city'
FAMILY = 'oprn-modern'
TEXTURE = 'tex_modern_city'
ASSETS = 'harness-data/modern-chipset/town_assets.json'
GROUND_SPEC, GREEN_SPEC = 'v1002-121948:A', 'v1002-184242:A'
SEDAN_LIKE = ('sedan', 'car2', 'car_front', 'car_back')
RAMPS = ['teal', 'navy', 'brick', 'sage', 'lgray']


def paths(out_root):
    j = lambda *p: os.path.join(out_root, *p)
    return dict(png=j('public/assets/modern-city/modern-city-chipset.png'), sheet=j('src/assets/modernCitySheet.json'), tileset=j('src/assets/modernCityTileset.json'),
                pins=j('tiledata/modern-city/pins.json'), report=j('tiledata/modern-city/bake-report.json'), kits=j('tiledata/modern-city/kit-index.json'))


# ====================================================================== 월드(합격 에셋) 읽기
class World: pass


def load_world(inject=False):
    """compose_town.load_assets 를 그대로 불러 에셋·출처(판, 글자)를 읽는다. 크롭 그림에 mc_src=(판, 글자, 슬롯) 속성을 붙인다."""
    orig_slots = TL.sheet_slots

    def slots(load2, spec_list, trim=True):
        res = {}
        for spec in spec_list:
            if not spec or not spec.get('slots'): continue
            for lt in spec.get('letters') or ['A']:
                try: sh = load2(f"{spec['round']}:{lt}")
                except Exception: continue
                for nm, (x, w, h) in spec['slots'].items():
                    crop = sh.crop((x, sh.height - h, x + w, sh.height))
                    if not (np.asarray(crop)[:, :, 3] > 24).any(): continue
                    if trim: crop = crop.crop(TL.alpha_bbox(crop))
                    crop.mc_src = (spec['round'], lt, nm)
                    res.setdefault(nm, []).append(crop)
        return res
    orig_load2 = CT.load2

    def load2(spec):
        im = orig_load2(spec); rid, lt = spec.rsplit(':', 1); im.mc_src = (rid, lt, ''); return im
    TL.sheet_slots, CT.load2 = slots, load2
    try:
        import types
        a = types.SimpleNamespace(shop=None, office=None, apartment=None, house=None, cafe=None, assets=ASSETS)
        pool, props2, vehicles, note, park, extra = CT.load_assets(a)
    finally:
        TL.sheet_slots, CT.load2 = orig_slots, orig_load2
    w = World()
    w.note = note
    data, _files = TL.merge_assets(os.path.join(ROOT, ASSETS))
    w.round_of = {f"{b['name']}:{lt}": b['round'] for b in data.get('buildings', []) for lt in (b.get('letters') or ['A'])}
    w.buildings = [b for b in pool if '~' not in b['name']]          # 벽색 변형은 우리가 직접 만든다(with_variants 의 무작위 추출 대신)
    w.props2, w.trees, w.signs, w.roof = props2, extra['trees'], extra['signs'], extra['roof']
    w.vehicles = vehicles
    w.park = {nm: im for nm, im in park.items()}
    w.ground = CC.load(GROUND_SPEC); w.green = CC.load(GREEN_SPEC)
    w.props_sheet = CC.load('v1002-182800:A')
    w.sides = [(lt, CC.load(f'v1002-085924:{lt}')) for lt in 'ABCDE']
    w.fronts = [(lt, CC.load(f'v1002-184143:{lt}')) for lt in 'AC']
    w.backs = [(lt, CC.load(f'v1002-184145:{lt}')) for lt in 'ABC']
    if inject:   # 자체 시험용: 기존 그림을 다시 칠한 가짜 건물 하나(목록 끝에 붙는다)
        b = dict(w.buildings[0]); im = b['im'].copy(); arr = np.array(im); m = arr[:, :, 3] > 0
        arr[m, 0] = (arr[m, 0].astype(int) + 40).clip(0, 255).astype(np.uint8); b['im'] = Image.fromarray(arr, 'RGBA'); b['name'] = 'bld_selftest:Z'; b['fam'] = 'bld_selftest'
        w.buildings.append(b)
    return w


# ====================================================================== 아이템(키트가 될 것)
def tall_rows(grid):
    """키 큰 소품: 맨 아래 칸 줄 = 막힘, 그 위 줄 = ★(통행 가능, 사람 위에 그림)."""
    out = []
    n = len(grid)
    for y, row in enumerate(grid):
        out.append([(c, ('solid' if y == n - 1 else 'star')) if c is not None else (None, None) for c, _pc in row])
    return out


def grid_of(img, pc_fn):
    cells = BL.cut(img)
    return [[(None, None) if BL.empty(c) else (c, pc_fn(y, len(cells))) for x, c in enumerate(row)] for y, row in enumerate(cells)]


def make_item(**kw):
    it = dict(kw)
    g = it['grid']; it['h'] = len(g); it['w'] = len(g[0])
    it['keys'] = {BL.Sheet.key_of(BL.norm(c), pc) for row in g for c, pc in row if c is not None}
    for row in it.get('upperGrid', []):
        it['keys'].update(BL.Sheet.key_of(BL.norm(c), pc) for c, pc in row if c is not None)
    return it


def building_variants_for(b0):
    """건물 하나의 벽색 변형(있는 것만) → [(which, name, 그림)]."""
    out = []
    for which in ('mint', 'brick'):
        for nm in CT.WALL_VARIANTS[which]:
            im2 = CT.recolor_walls(b0['im'], which, nm)
            if im2 is not None: out.append((which, nm, im2))
    return out


def render_building(w, b0, wall=None, ramp='base'):
    b = dict(b0)
    if wall: b['im'] = wall[2]
    rng = random.Random(f'mc-bake:{BAKE_SEED}:{b0["name"]}')
    sign = None
    if b.get('roof'):
        im_b, info = TL.decorate_roof(b, rng, w.roof, ROOF_ROOM, ramp, {})
        if b['cat'] in SHOPLIKE and w.signs and b.get('doors'): im_b, sign = TL.add_facade_sign(im_b, b, info, w.signs, rng)
    else:
        im_b = b['im']
    return im_b, sign


def building_item(w, b0, wall=None, ramp='base'):
    fam, letter = b0['name'].split(':')
    if wall: pass
    im_b, sign = render_building(w, b0, wall, ramp)
    canvas, off = BL.building_canvas(im_b)
    short = fam.replace('bld_', '').replace('_', '-')
    suffix = ''.join(['-' + wall[1] if wall else '', '-roof-' + ramp if ramp != 'base' else ''])
    kid = f'mc-bld-{short}-{letter}{suffix}'
    ko = D.BUILDING_KO.get(fam, fam)
    vtxt = ''.join([f' · {D.WALL_KO.get(wall[1], wall[1])}' if wall else '', f' · {D.ROOF_KO.get(ramp, ramp)}' if ramp != 'base' else ''])
    grid = grid_of(canvas, lambda y, n: 'solid')
    h = len(grid); wc = len(grid[0])
    doors = []; access = []
    for d0, d1 in b0['doors']:
        c0, c1 = d0 // 16, (d1 - 1) // 16
        doors.append(dict(x0=d0, x1=d1, cells=[c0, c1]))
        access.append([[x, h] for x in range(c0, c1 + 1)])
    parts = [dict(id=f'door{i + 1}' if len(doors) > 1 else 'door', kind='entrance', dx=d['cells'][0], dy=h - 1, w=d['cells'][1] - d['cells'][0] + 1, h=1,
                  note='문 칸(그림) — 문 칸 자체는 막힘, 바로 아래(키트 바깥 한 줄 아래) 보도 칸이 문 앞 접근 칸') for i, d in enumerate(doors)]
    acc_txt = ', '.join(f'({x},{h})' for a in access for x, _ in a)
    it = make_item(
        id=kid, kind='building', cat='building' if not (wall or ramp != 'base') else 'building-variant', name=f'{ko} {letter}{vtxt}', ko=ko, layer='upper', grid=grid, expected=canvas,
        group=f'building:{short}', gname=f'건물 · {ko}', grole='building', gdesc=f'{ko}({fam}) 키트의 칸 모음. 건물 한 채 = 키트 하나(칸 낱개로 칠하지 않는다).',
        grules='땅(보도·포석) 위 위층에 찍는다. 문 칸 바로 아래 한 줄이 보도(접근 칸)여야 한다. 지붕 윗면까지 포함한 그림이라 뒷줄 건물은 앞줄 건물보다 먼저 찍는다.',
        tmeta_role='building', tags=['modern-city', 'building', ko],
        desc=f'{ko} {letter}{vtxt} {wc}×{h}칸. 투명 배경 건물 윗면+정면 그림. 몸통·지붕 칸은 모두 막힘(위층), 문 앞 접근 칸은 키트 바깥 한 줄 아래: {acc_txt}.',
        rules='땅(보도) 위 위층. 키트 아래 한 줄이 문 앞 접근 칸(보도)이어야 한다. 앞줄 건물은 뒷줄보다 나중에 찍어 겹침 순서를 정한다.',
        parts=parts, repeatability='fixed',
        meta=dict(kind='building', source=dict(round=w.round_of.get(b0['name']), letter=letter, name=fam), door=dict(x0=doors[0]['x0'], x1=doors[0]['x1']),
                  doors=doors, anchor=dict(dx=0, dy=h - 1, note='왼쪽 아래 칸 = 건물 발(밑변)'), access=[dict(dx=x, dy=h) for a in access for x, _ in a],
                  pad=dict(top=off['padTop'], right=off['padRight']), floors=b0.get('floors'), cat=b0.get('cat'), sign=list(sign) if sign else None,
                  variant=dict(wall=wall[1] if wall else None, roof=ramp if ramp != 'base' else None)))
    return it


def sprite_item(img, kid, ko, kind, cat, gkey, gname, grole, tall, where, extra_tags, source, variant=None, layer='upper', flip=False, desc_extra=''):
    if flip: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    canvas, off = BL.sprite_canvas(img)
    if canvas is None: return None
    grid0 = grid_of(canvas, lambda y, n: 'solid')
    grid = tall_rows(grid0) if (tall and len(grid0) >= 2) else grid0
    h = len(grid); wc = len(grid[0])
    foot = '발밑 줄은 막힘, 윗줄은 ★(통행 가능·사람 위에 그림)' if (tall and h >= 2) else '모든 칸 막힘'
    it = make_item(
        id=kid, kind=kind, cat=cat, name=ko, ko=ko, layer=layer, grid=grid, expected=canvas,
        group=gkey, gname=gname, grole=grole, gdesc=f'{gname} 키트의 칸 모음.', grules=where,
        tmeta_role='prop', tags=['modern-city'] + extra_tags,
        desc=f'{ko} {wc}×{h}칸(투명 배경 위층 키트). {foot}. {desc_extra}'.strip(), rules=where, parts=[], repeatability='fixed',
        meta=dict(kind=kind, source=source, door=None, anchor=dict(dx=wc // 2, dy=h - 1, note='아래 줄 가운데 = 발밑'), access=[], pad=dict(left=off['padLeft'], right=off['padRight'], top=off['padTop']),
                  image=dict(srcBBox=off['srcBBox'], srcSize=off['srcSize'], trimmed=off['trimmed'], note='알파 bbox 로 자른 뒤 밑변 정렬·좌우 가운데로 16 배수 캔버스에 놓았다(padLeft 만큼 오른쪽으로)'), variant=variant))
    return it


# ====================================================================== 땅·도로 칸
def ground_cells(w):
    out = []
    for idx, ko, grp, role, tags, desc in D.GROUND:
        out.append(dict(cell=CC.cell(w.ground, idx), pc='floor', label=ko, role=role, tags=['modern-city'] + tags, desc=desc, group=grp, cat='ground', src=f'{GROUND_SPEC}#{idx}'))
    for idx, ko, grp, role, tags, kind, desc in D.GREEN:
        out.append(dict(cell=CC.cell(w.green, idx, 8), pc='solidfloor' if kind == 'solid' else 'floor', label=ko, role=role, tags=['modern-city'] + tags, desc=desc, group=grp, cat='ground', src=f'{GREEN_SPEC}#{idx}'))
    return out


YEL = (210, 165, 76, 255)           # compose_town 도로 표시와 같은 색
STOP_RGB = (228, 233, 232)             # compose_town 의 STOP(228,232,236) 을 modern4 흰색 램프 4번(#e4e9e8)으로 — 최대 4/255 차이
STOPC = STOP_RGB + (255,)


def overlay_cells(w):
    """compose_town 도로 표시 코드(노란 이중 중앙선·정지선·화살표·맨홀·배수구)를 칸 오버레이로. 반환 [(키, 칸, 라벨, 그룹, 설명)]."""
    out = []

    def tile(draw_fn):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); draw_fn(d); return im
    # 노란 이중 중앙선: 도로 96px 의 정중앙(48)에 2줄(46, 49) → 6칸 폭 도로의 세 번째 줄 칸 y=14, 네 번째 줄 칸 y=1. 구간 끝은 4px 안쪽에서 시작/끝(compose_town).
    for nm, ko, fn in (('h-up', '노란 중앙선(가로, 위 줄)', lambda d: d.rectangle([0, 14, 15, 14], fill=YEL)),
                       ('h-dn', '노란 중앙선(가로, 아래 줄)', lambda d: d.rectangle([0, 1, 15, 1], fill=YEL)),
                       ('h-up-l', '노란 중앙선 끝(가로, 위 줄, 왼쪽 끝)', lambda d: d.rectangle([4, 14, 15, 14], fill=YEL)),
                       ('h-up-r', '노란 중앙선 끝(가로, 위 줄, 오른쪽 끝)', lambda d: d.rectangle([0, 14, 11, 14], fill=YEL)),
                       ('h-dn-l', '노란 중앙선 끝(가로, 아래 줄, 왼쪽 끝)', lambda d: d.rectangle([4, 1, 15, 1], fill=YEL)),
                       ('h-dn-r', '노란 중앙선 끝(가로, 아래 줄, 오른쪽 끝)', lambda d: d.rectangle([0, 1, 11, 1], fill=YEL)),
                       ('v-lt', '노란 중앙선(세로, 왼쪽 줄)', lambda d: d.rectangle([14, 0, 14, 15], fill=YEL)),
                       ('v-rt', '노란 중앙선(세로, 오른쪽 줄)', lambda d: d.rectangle([1, 0, 1, 15], fill=YEL)),
                       ('v-lt-t', '노란 중앙선 끝(세로, 왼쪽 줄, 위 끝)', lambda d: d.rectangle([14, 4, 14, 15], fill=YEL)),
                       ('v-lt-b', '노란 중앙선 끝(세로, 왼쪽 줄, 아래 끝)', lambda d: d.rectangle([14, 0, 14, 11], fill=YEL)),
                       ('v-rt-t', '노란 중앙선 끝(세로, 오른쪽 줄, 위 끝)', lambda d: d.rectangle([1, 4, 1, 15], fill=YEL)),
                       ('v-rt-b', '노란 중앙선 끝(세로, 오른쪽 줄, 아래 끝)', lambda d: d.rectangle([1, 0, 1, 11], fill=YEL))):
        horiz = nm.startswith('h')
        out.append(dict(key='center-' + nm, cell=tile(fn), label=ko, group='marking-center', desc=(f'도로(6칸 폭) 한가운데의 노란 이중선. 가로 도로는 세 번째·네 번째 줄에 위/아래 줄 칸을, 세로 도로는 세 번째·네 번째 칸에 왼쪽/오른쪽 줄 칸을 2층에 깐다. 구간 끝 칸은 교차로 쪽 끝에.' if horiz or True else ''), tags=['marking', 'center-line', '중앙선']))
    # 정지선: 차선 폭 42px(3~45 / 51~93)에 2px 두께. 서쪽 접근 x=10..11, 동쪽 접근 x=4..5, 북쪽 접근 y=10..11, 남쪽 접근 y=4..5.
    def stop_v(x0):   # 세로 정지선 3조각(차선 시작/가운데/끝) — 차선 하나 = 칸 3개
        return {'s': lambda d: d.rectangle([x0, 3, x0 + 1, 15], fill=STOPC), 'm': lambda d: d.rectangle([x0, 0, x0 + 1, 15], fill=STOPC), 'e': lambda d: d.rectangle([x0, 0, x0 + 1, 12], fill=STOPC)}

    def stop_h(y0):
        return {'s': lambda d: d.rectangle([3, y0, 15, y0 + 1], fill=STOPC), 'm': lambda d: d.rectangle([0, y0, 15, y0 + 1], fill=STOPC), 'e': lambda d: d.rectangle([0, y0, 12, y0 + 1], fill=STOPC)}
    for side, ko, fns in (('w', '정지선(서쪽 접근, 세로선)', stop_v(10)), ('e', '정지선(동쪽 접근, 세로선)', stop_v(4)), ('n', '정지선(북쪽 접근, 가로선)', stop_h(10)), ('s', '정지선(남쪽 접근, 가로선)', stop_h(4))):
        for part, pko in (('s', '차선 시작 칸'), ('m', '가운데 칸'), ('e', '차선 끝 칸')):
            out.append(dict(key=f'stop-{side}-{part}', cell=tile(fns[part]), label=f'{ko} {pko}', group='marking-stop',
                            desc='횡단보도 바깥에 차선마다 깐다. 차선 하나는 칸 3개(시작·가운데·끝) — 6칸 폭 도로에 두 차선이므로 시작/가운데/끝을 두 번 이어 깐다.', tags=['marking', 'stop-line', '정지선']))
    # 직진 화살표 10x16 / 16x10 — 칸 안 (3,0) / (0,3)에 놓는다(compose_town 의 차선 가운데 오프셋 +3)
    for nm, ko, vertical, flip in (('right', '직진 화살표(오른쪽)', False, False), ('left', '직진 화살표(왼쪽)', False, True), ('up', '직진 화살표(위)', True, False), ('down', '직진 화살표(아래)', True, True)):
        a = TL.arrow_img(vertical, flip); arr = np.array(a); arr[arr[:, :, 3] > 0, :3] = STOP_RGB; a = Image.fromarray(arr, 'RGBA')
        c = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); c.paste(a, ((16 - a.width) // 2, (16 - a.height) // 2))
        out.append(dict(key='arrow-' + nm, cell=c, label=ko, group='marking-arrow', desc='차선 가운데에 한 칸. 정지선 앞 40px 안쪽에 둔다. 이 방향으로 달리는 차선에.', tags=['marking', 'arrow', '화살표']))
    # 맨홀 두 종·배수구: road_marks_v2 슬롯(글자 A)
    def first(nm, letter='A'):
        for im in w.props2.get(nm, []):
            if im.mc_src[1] == letter: return im
        return w.props2[nm][0]
    for nm, ko in (('manhole', '맨홀(고리)'), ('manhole_b', '맨홀(격자)')):
        im = first(nm); c = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); c.paste(im, ((16 - im.width) // 2, (16 - im.height) // 2))
        out.append(dict(key=nm, cell=c, label=ko, group='marking-manhole', desc='차선 위 철판 맨홀 한 칸(2층). 차선 가운데 어디나, 두 종을 번갈아.', tags=['marking', 'manhole', '맨홀'], src=im.mc_src))
    im = first('drain'); cv = Image.new('RGBA', (32, 16), (0, 0, 0, 0)); cv.paste(im, ((32 - im.width) // 2, (16 - im.height) // 2))
    for i in range(2):
        out.append(dict(key=f'drain-{i}', cell=cv.crop((i * 16, 0, i * 16 + 16, 16)), label=f'배수구({"왼" if i == 0 else "오른"}쪽 반)', group='marking-manhole',
                        desc='도로 가장자리(연석 곁) 배수구 2칸 한 쌍(왼쪽 반+오른쪽 반, 2층).', tags=['marking', 'drain', '배수구'], src=im.mc_src))
    return out


def shadow_cells():
    """town_lib.make_shadows 를 합성 장면에 돌려 그림자 띠를 칸으로 자른다(건물·나무·가로등·작은/큰 소품)."""
    PX = 160
    kind = [['side'] * 10 for _ in range(10)]
    out = []
    # 건물: 48x48 사각 몸체(칸 3~5 × 2~4), 발 y=64(→ 아래 띠 5px)
    solid = Image.new('RGBA', (48, 48), (200, 200, 200, 255))
    sp = [dict(k='bld', img=solid, x=48, y=32, foot=64)]
    lay, _ = TL.make_shadows(sp, kind, PX)
    cells = BL.cut(lay)
    merged = collections.OrderedDict()
    for cy in range(10):
        for cx in range(10):
            c = cells[cy][cx]
            if BL.empty(c): continue
            v = 'N' if cy < 2 else 'S' if cy > 4 else ''; hz = 'W' if cx < 3 else 'E' if cx > 5 else ''
            code = v + hz
            if code == 'E': code += {2: '-위', 4: '-아래'}.get(cy, '-가운데')
            if code == 'S': code += {3: '-왼쪽', 5: '-오른쪽'}.get(cx, '-가운데')
            merged.setdefault(BL.Sheet.key_of(BL.norm(c), 'flat'), dict(cell=c, codes=[]))['codes'].append(code)
    for i, m in enumerate(merged.values()):
        codes = sorted(set(m['codes']))
        out.append(dict(key=f'shadow-bld-{i}', cell=m['cell'], label='건물 그림자 ' + '·'.join(codes), group='shadow', desc='건물 오른쪽·아래에 드리우는 반투명 그림자(2층, 보도 위에만). 빛은 왼쪽 위. 이름의 위치(E=오른쪽 띠, S=아래 띠, SE=오른쪽 아래 모서리)대로 건물 키트 발밑·옆 칸에 깐다.', tags=['shadow', '그림자']))
    for nm, img, x, foot, label in (('tree', Image.new('RGBA', (32, 48), (0, 150, 0, 255)), 48, 96, '나무 그림자(납작 타원)'), ('lamp', Image.new('RGBA', (8, 48), (0, 0, 150, 255)), 56, 96, '가로등·기둥 그림자(비스듬한 짧은 띠)'),
                                    ('bench', Image.new('RGBA', (16, 12), (150, 0, 0, 255)), 56, 96, '작은 소품 그림자(납작 타원 16폭)'), ('bench', Image.new('RGBA', (32, 12), (150, 0, 0, 255)), 48, 96, '중간 소품 그림자(납작 타원 32폭)')):
        sp = [dict(k='prop', name=nm, img=img, x=x, y=foot - img.height, foot=foot)]
        lay, _ = TL.make_shadows(sp, kind, PX); cl = BL.cut(lay)
        n = 0
        for cy in range(10):
            for cx in range(10):
                c = cl[cy][cx]
                if BL.empty(c): continue
                n += 1; out.append(dict(key=f'shadow-{nm}-{x}-{n}', cell=c, label=f'{label} {n}', group='shadow', desc=f'{label}. 소품 발밑 칸 둘레에 2층으로. 소품 키트의 발밑 줄과 같은 칸에서 시작한다.', tags=['shadow', '그림자']))
    return out


def road_items(w, ids):
    """도로 구간 키트(칸 단위 composite 로 아스팔트에 표시를 구워 넣는다). ids = {라벨: 칸 번호가 아니라 (셀, pc, label, ...) 생성 함수가 아니라 칸 이미지 사전}."""
    T0 = CC.cell(w.ground, 0)

    def over(base, ov):
        im = base.copy(); im.alpha_composite(ov); return im
    OV = {o['key']: o['cell'] for o in ids}
    T = lambda i: CC.cell(w.ground, i)
    # 표시를 아스팔트에 구운 칸 (pc floor)
    def baked(key): return over(T0, OV[key])
    items = []

    def kit(kid, ko, tiles, desc, rules, axis=None, kind='road'):
        grid = [[(c, 'floor') for c in row] for row in tiles]
        h = len(grid); wc = len(grid[0])
        expected = Image.new('RGBA', (wc * 16, h * 16))
        for y, row in enumerate(tiles):
            for x, c in enumerate(row): expected.paste(c, (x * 16, y * 16))
        it = make_item(id=kid, kind=kind, cat='ground', name=ko, ko=ko, layer='lower', grid=grid, expected=BL.norm(expected), group='roadkit', gname='도로 구간 키트', grole='terrain',
                       gdesc='도로·보도·교차로를 한 번에 까는 구간 키트(아래층, 표시가 구워진 칸 포함).', grules='아래층(1층)에 찍는다. 도로는 6칸 폭 두 차선이 기본.',
                       tmeta_role='terrain', tags=['modern-city', 'road', '도로', ko], desc=desc, rules=rules, parts=[], repeatability='repeat',
                       meta=dict(kind=kind, source=dict(round=GROUND_SPEC.split(':')[0], letter='A', name='ground'), door=None, anchor=dict(dx=0, dy=0, note='왼쪽 위 칸'), access=[], pad=None, growthAxis=axis, variant=None))
        it['growth'] = axis
        items.append(it)
    asp = [T0]
    kit('mc-road-ew-2lane', '도로 구간(가로, 2차선 6칸 폭)', [[T0], [T0], [baked('center-h-up')], [baked('center-h-dn')], [T0], [T0]],
        '가로(동서) 도로 6칸 폭 한 칸 분량: 위 두 줄 차선 · 노란 이중 중앙선 · 아래 두 줄 차선. 가로로 이어 찍는다(1×6).', '1층. 가로로 반복. 끝은 교차로 쪽에서 중앙선 끝 칸(2층)으로 마무리.', axis='horizontal')
    kit('mc-road-ns-2lane', '도로 구간(세로, 2차선 6칸 폭)', [[T0, T0, baked('center-v-lt'), baked('center-v-rt'), T0, T0]],
        '세로(남북) 도로 6칸 폭 한 줄 분량: 왼쪽 두 칸 차선 · 노란 이중 중앙선 · 오른쪽 두 칸 차선. 세로로 이어 찍는다(6×1).', '1층. 세로로 반복.', axis='vertical')
    kit('mc-street-ew-section', '거리 단면(가로 도로 + 양쪽 보도 12줄)', [[T(6)], [T(6)], [T(8)], [T0], [T0], [baked('center-h-up')], [baked('center-h-dn')], [T0], [T0], [T(9)], [T(6)], [T(6)]],
        '가로 도로 한 칸 폭 단면: 보도 2줄 · 북쪽 연석 · 도로 6줄(노란 이중선) · 남쪽 연석 · 보도 2줄 = 12줄. 가로로 이어 찍는다(1×12).', '1층. 가로로 반복. 교차로 칸 전후로 끊고 교차로 키트를 맞붙인다.', axis='horizontal', kind='street')
    kit('mc-street-ns-section', '거리 단면(세로 도로 + 양쪽 보도 12칸)', [[T(6), T(6), T(10), T0, T0, baked('center-v-lt'), baked('center-v-rt'), T0, T0, T(11), T(6), T(6)]],
        '세로 도로 한 줄 단면: 보도 2칸 · 서쪽 연석 · 도로 6칸(노란 이중선) · 동쪽 연석 · 보도 2칸 = 12칸. 세로로 이어 찍는다(12×1).', '1층. 세로로 반복.', axis='vertical', kind='street')
    kit('mc-crosswalk-on-ew-road', '횡단보도(가로 도로 위, 6줄)', [[T(4)] for _ in range(6)], '가로 도로를 건너는 횡단보도 세로 6칸(1×6). 도로 6칸 폭을 가로지른다.', '1층. 정지선·중앙선과 겹치지 않게 교차로 바깥 2칸에.', kind='crosswalk')
    kit('mc-crosswalk-on-ns-road', '횡단보도(세로 도로 위, 6칸)', [[T(5) for _ in range(6)]], '세로 도로를 건너는 횡단보도 가로 6칸(6×1).', '1층. 정지선·중앙선과 겹치지 않게 교차로 바깥 2칸에.', kind='crosswalk')
    kit('mc-intersection-6x6', '교차로 중심(6×6 아스팔트)', [[T0] * 6 for _ in range(6)], '두 6칸 폭 도로가 만나는 교차로 중심 6×6 아스팔트.', '1층. 사방에 도로 구간 키트와 횡단보도 키트를 맞붙인다.', kind='junction')
    # 12x12 교차로: compose_town._build 의 한 교차로(바깥 보도 모서리·연석·횡단보도·정지선 포함) — 도로 6칸 + 양쪽 3칸씩
    N = 12; c = r = 3; RW = 6
    g = [[None] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            road_r = r <= y < r + RW; road_c = c <= x < c + RW
            g[y][x] = T0 if (road_r or road_c) else T(6)
    for x in list(range(0, c - 1)) + list(range(c + RW + 1, N)): g[r - 1][x] = T(8); g[r + RW][x] = T(9)
    for y in list(range(0, r - 1)) + list(range(r + RW + 1, N)): g[y][c - 1] = T(10); g[y][c + RW] = T(11)
    g[r - 1][c - 1], g[r - 1][c + RW], g[r + RW][c - 1], g[r + RW][c + RW] = T(12), T(13), T(14), T(15)
    for y in range(r, r + RW): g[y][c - 2] = T(4); g[y][c + RW + 1] = T(4)
    for x in range(c, c + RW): g[r - 2][x] = T(5); g[r + RW + 1][x] = T(5)
    # 정지선(차선 3칸씩): 서쪽 접근(x=0, 가로 도로 위 줄 차선) · 동쪽 접근(x=11) · 북쪽 접근(y=0) · 남쪽 접근(y=11)
    for k, part in enumerate('sme'):
        g[r + k][0] = over(T0, OV[f'stop-w-{part}']); g[r + 3 + k][11] = over(T0, OV[f'stop-e-{part}'])
        g[0][c + 3 + k] = over(T0, OV[f'stop-n-{part}']); g[11][c + k] = over(T0, OV[f'stop-s-{part}'])
    kit('mc-intersection-12x12', '교차로(12×12, 보도 모서리·횡단보도·정지선 포함)', g,
        '두 6칸 폭 도로가 만나는 교차로 전체: 바깥 보도 모서리 · 둥근 연석 · 사방 횡단보도 · 정지선(차선마다) · 중심 6×6. 한 번에 찍는다.', '1층. 도로 구간 키트(1×6·6×1)·거리 단면 키트를 사방에 맞붙인다. 신호등은 네 보도 모서리에.', kind='junction')
    return items


# ====================================================================== 소품·차량 아이템
def prop_items(w):
    items = []
    seen = collections.Counter()

    def add(nm, img, source_name=None, flip=False):
        ko, grp, tall, where = D.PROPS.get(nm, (nm, 'street', False, '보도.'))
        rid, lt, slot = img.mc_src
        n = seen[(nm, lt)]; seen[(nm, lt)] += 1
        kid = f'mc-prop-{nm.replace("_", "-")}-{lt.lower()}' + (f'-{n + 1}' if n else '')
        kind = 'prop'
        it = sprite_item(img, kid, ko, 'prop', 'prop', f'prop:{grp}', f'소품 · {D.PROP_GROUPS[grp]}', 'prop', tall, where, ['prop-street', ko, nm],
                         dict(round=rid, letter=lt, name=source_name or slot or nm))
        if it: items.append(it)
    # 기본 소품 시트(가로등·신호등·볼라드·소화전·자판기·가로수·쓰레기통·정류장 표지)
    for nm, (x, wd, h) in CC.PROPS.items():
        im = CC.prop(w.props_sheet, nm); im.mc_src = ('v1002-182800', 'A', nm); add(nm, im)
    for nm, ims in sorted(w.props2.items()):
        if nm in CT.PROP_EXCLUDE or nm in ('manhole', 'manhole_b', 'drain'): continue
        for im in ims: add(nm, im)
    for k in list(CT.TREE_KINDS) + list(CT.TREE_PROPS):
        for im in w.trees.get(k, []):
            add(k, im)
            if k == 'hedge':
                r = im.rotate(90, expand=True); r.mc_src = (im.mc_src[0], im.mc_src[1], 'hedge_v'); add('hedge_v', r)
    for k in ('board_a', 'board_b'):
        for im in w.signs.get(k, []): add(k, im)
    for nm, im in sorted(w.park.items()):
        im.mc_src = (im.mc_src[0], im.mc_src[1], nm); add(nm, im)
    return items


def vehicle_items(w, colors):
    """colors: 기본(은색 원본) 외에 굽는 차 색 목록. 승용차류만 색을 바꾼다. 가로 차량은 오른쪽 향함 + 왼쪽 향함(거울) 둘 다."""
    items = []
    srcs = []   # (이름, 글자, 그림, 판)
    for lt, im in w.sides: srcs.append(('sedan', lt, im, 'v1002-085924'))
    for lt, im in w.fronts: srcs.append(('car_front', lt, im, 'v1002-184143'))
    for lt, im in w.backs: srcs.append(('car_back', lt, im, 'v1002-184145'))
    cnt = collections.Counter()
    for v in w.vehicles:
        rid, lt, _ = v['im'].mc_src
        srcs.append((v['name'], lt, v['im'], rid))
    for nm, lt, im, rid in srcs:
        ko, grp = D.VEHICLES[nm]
        for color in (['base'] + (list(colors) if nm in SEDAN_LIKE else [])):
            img = im if color == 'base' else CT.recolor_car(im, color)
            for flip in ((False, True) if nm not in ('car_front', 'car_back') else (False,)):
                kid = f'mc-veh-{nm.replace("_", "-")}-{lt.lower()}' + ('' if color == 'base' else f'-{color}') + ('-l' if flip else '')
                vtxt = ('' if color == 'base' else f' · {D.COLOR_KO.get(color, color)}') + (' · 왼쪽 향함' if flip else (' · 오른쪽 향함' if nm not in ('car_front', 'car_back') else ''))
                it = sprite_item(img, kid, f'{ko}{vtxt}', 'vehicle', 'vehicle' if color == 'base' else 'vehicle-color', f'vehicle:{grp}', f'차량 · {D.VEHICLE_GROUPS[grp]}', 'prop', False,
                                 '차선(도로 위) 또는 연석 곁 주차 자리. 움직이지 않는 그림이다(정차 차량).', ['prop-vehicle', ko, nm], dict(round=rid, letter=lt, name=nm),
                                 variant=dict(color=None if color == 'base' else color, flip=flip), flip=flip, desc_extra='움직이지 않는 정차 그림. 도로 위 칸은 이 칸이 막혀 걸을 수 없다.')
                if it: items.append(it)
    return items


# ====================================================================== 계획(칸 예산)
COLOR_ORDER = ['black', 'navy', 'red', 'white', 'beige', 'green', 'teal', 'ochre']


def plan(w, budget, base_keys, log, prev):
    """필수(땅·표시·그림자·소품·차량 기본·건물 기본)를 먼저 깔고, 남는 예산으로 변형(차 색·건물 지붕색·벽색)을 라운드로빈으로 더한다.
    지난 굽기(pins.json 의 variants)에서 구운 변형은 예산과 상관없이 먼저 유지한다 — 변형 목록이 굽기마다 흔들리면 이미 깐 맵의 키트가 사라진다.
    반환 (변형 건물 아이템 [정준 순서], 차 색 목록, 고른 변형 [(건물, 종류, 이름)])."""
    keys = set(base_keys)
    fams = collections.OrderedDict()
    for b in w.buildings: fams.setdefault(b['name'].split(':')[0], []).append(b)
    order = {b['name']: i for i, b in enumerate(w.buildings)}
    for b in w.buildings: keys |= building_item(w, b)['keys']
    log['budget'] = dict(limit=budget, mandatory_cells=len(keys))
    if len(keys) > budget: log['budget']['warning'] = '필수 칸만으로 예산 초과'
    log['rounds'] = []
    wallopts = {b['name']: {v[1]: v for v in building_variants_for(b)} for b in w.buildings}
    opts_for = {}                      # 건물 → [(종류, 이름)] — 지붕색·벽색을 번갈아, 건물마다 시작 위치를 어긋나게
    for fi, (fam, bs) in enumerate(fams.items()):
        for li, b in enumerate(bs):
            ops = []
            wl = list(wallopts[b['name']])
            rl = list(RAMPS) if b.get('roof') else []
            if rl: r0 = (fi + li) % len(rl); rl = rl[r0:] + rl[:r0]
            if wl: w0 = fi % len(wl); wl = wl[w0:] + wl[:w0]
            for i in range(max(len(rl), len(wl))):
                if i < len(rl): ops.append(('roof', rl[i]))
                if i < len(wl): ops.append(('wall', wl[i]))
            opts_for[b['name']] = ops
    chosen, colors = set(), []
    keep_b = [tuple(x) for x in (prev or {}).get('buildings', []) if x[0] in order and (x[1] == 'roof' and x[2] in RAMPS or x[1] == 'wall' and x[2] in wallopts[x[0]])]
    keep_c = [c for c in (prev or {}).get('carColors', []) if c in COLOR_ORDER]
    byname = {b['name']: b for b in w.buildings}
    def variant_item(name, typ, val): return building_item(w, byname[name], wall=wallopts[name][val] if typ == 'wall' else None, ramp=val if typ == 'roof' else 'base')
    def color_keys(col): return set().union(*[it['keys'] for it in vehicle_items(w, [col]) if f'-{col}' in it['id']])
    for name, typ, val in keep_b: keys |= variant_item(name, typ, val)['keys']; chosen.add((name, typ, val))
    for col in keep_c: keys |= color_keys(col); colors.append(col)
    log['budget']['kept_from_previous_bake'] = dict(building_variants=len(chosen), car_colors=list(colors))
    skipped = 0; skipped_before = -1
    for k in range(14):
        added = 0
        for col in COLOR_ORDER[2 * k:2 * k + 2]:     # 차 색: 라운드마다 두 가지(한 색 = 승용차류 전부, 전부 아니면 전무)
            if col in colors: continue
            kk = color_keys(col)
            if len(keys | kk) <= budget: keys |= kk; colors.append(col)
        for fam, bs in fams.items():
            for b in bs:
                ops = opts_for[b['name']]
                if k >= len(ops): continue
                typ, val = ops[k]
                if (b['name'], typ, val) in chosen: continue
                it = variant_item(b['name'], typ, val)
                if len(keys | it['keys']) > budget: skipped += 1; continue
                keys |= it['keys']; chosen.add((b['name'], typ, val)); added += 1
        log['rounds'].append(dict(round=k, building_variants_added=added, cells_after=len(keys)))
        if added == 0 and k >= 4 and skipped_before == skipped: break
        skipped_before = skipped
    colors = sorted(colors, key=COLOR_ORDER.index)
    picked = sorted(chosen, key=lambda c: (order[c[0]], c[1], c[2]))
    items = [variant_item(*c) for c in picked]
    log['budget'].update(skipped_candidates=skipped, total_planned_cells=len(keys), car_colors=colors)
    return items, colors, [list(c) for c in picked]


# ====================================================================== 굽기 본체
def bake(out_root, dry=False, budget=BUDGET, inject=False, quiet=False):
    t0 = time.time()
    P = paths(out_root)
    w = load_world(inject=inject)
    log = {}
    # 1) 땅·표시·그림자·도로 키트 — 번호와 무관한 칸 목록
    gcells = ground_cells(w); ovs = overlay_cells(w); shs = shadow_cells()
    roads = road_items(w, ovs)
    props = prop_items(w)
    parking = parking_bundle.load(ROOT, make_item)
    # 필수 키 집합(계획용): 땅·표시·그림자·도로 키트·소품·차량 기본
    base_keys = set()
    for g in gcells: base_keys.add(BL.Sheet.key_of(BL.norm(g['cell']), g['pc']))
    for o in ovs + shs: base_keys.add(BL.Sheet.key_of(BL.norm(o['cell']), 'flat'))
    for it in roads + props + parking + vehicle_items(w, []): base_keys |= it['keys']
    base_keys.add(BL.Sheet.key_of(BL.norm(Image.new('RGBA', (16, 16))), 'blank'))
    pins = BL.load_pins(P['pins'])
    extra_buildings, car_colors, picked_variants = plan(w, budget, base_keys, log, pins.get('variants'))
    veh = vehicle_items(w, car_colors)
    blds = [building_item(w, b) for b in w.buildings] + extra_buildings
    # 2) 번호 배정(핀 고정)
    sh = BL.Sheet(pins)
    BLANK = sh.add(Image.new('RGBA', (16, 16)), 'blank', '빈 칸', 'empty', '투명 빈 칸. 쓰지 않는다.', ['modern-city'], 'blank')
    groups = collections.OrderedDict()

    def grp(key, name, role, layer, desc, rules):
        if key not in groups: groups[key] = dict(id='mc:' + key.replace(':', ':'), name=name, role=role, layer=layer, ids=[], desc=desc, rules=rules)
        return groups[key]
    GN = {'road': ('도로 · 아스팔트·점선 차선', '도로 바닥. 가로·세로 6칸 폭 두 차선이 기본.'), 'crosswalk': ('횡단보도', '교차로 바깥 2칸. 줄이 차 진행과 평행.'), 'sidewalk': ('보도 포석', '건물 앞·연석 안쪽.'),
          'curb': ('연석 · 보도 테두리(자동 4방향)', '보도 칠하면 도로 쪽 연석이 저절로 붙는다(오토타일 mc-sidewalk-curb).'), 'green': ('녹지·공원 바닥', '공원 안쪽. 잔디·꽃밭·길.'),
          'plaza': ('벽돌 포장(공원 광장)', '분수·광장 둘레. 3·4번 체크무늬.'), 'water': ('연못 물', '연못 안쪽. 막힘.'), 'hedge': ('생울타리(공원 둘레)', '공원 둘레. 막힘.')}
    for g in gcells:
        tid = sh.add(g['cell'], g['pc'], g['label'], g['role'], g['desc'], g['tags'], 'ground'); g['id'] = tid
        gr = grp(g['group'], GN[g['group']][0], 'terrain' if g['group'] not in ('water', 'hedge') else ('water' if g['group'] == 'water' else 'fence'), 'lower', f"{GN[g['group']][0]} — 현대 도시 땅 시트({GROUND_SPEC}/{GREEN_SPEC})의 칸. 낱칸으로 칠한다.", GN[g['group']][1]); gr['ids'].append(tid)
    MN = {'marking-center': '노란 중앙선(오버레이, 2층)', 'marking-stop': '정지선(오버레이, 2층)', 'marking-arrow': '직진 화살표(오버레이, 2층)', 'marking-manhole': '맨홀·배수구(오버레이, 2층)', 'shadow': '그림자 띠(오버레이, 2층)'}
    for o in ovs + shs:
        g_ = o['group']
        tid = sh.add(o['cell'], 'flat', o['label'], 'detail', o['desc'], ['modern-city'] + o.get('tags', []), 'overlay' if g_ != 'shadow' else 'shadow'); o['id'] = tid
        gr = grp(g_, MN[g_], 'terrain', 'upper', f'{MN[g_]} — 투명 배경 표시 칸.', '도로 위(또는 보도 위)에 2층으로 얹는 투명 칸. 붓은 위층에 깔고 바닥은 지우지 않는다. 캐릭터 밑에 그려진다.'); gr['ids'].append(tid)
    kits = []; kit_index = collections.OrderedDict(); item_by_id = {}
    PCNOTE = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)', 'floor': '걸을 수 있는 땅', 'solidfloor': '막힌 땅'}

    def realize(it):
        rows = []; ids = []
        for y, row in enumerate(it['grid']):
            r = []
            for x, (c, pc) in enumerate(row):
                if c is None: r.append(-1); continue
                role = {'floor': 'terrain', 'solid': it['tmeta_role'], 'star': it['tmeta_role']}.get(pc, it['tmeta_role'])
                tid = sh.add(c, pc, f"{it['name']} ({x + 1},{y + 1})", it['tmeta_role'], f"{PCNOTE[pc]}. 키트 {it['id']} 로 찍는다(낱칸으로 칠하지 않는다).", it['tags'], it['cat'])
                r.append(tid); ids.append(tid)
            rows.append(r)
        it['ids'] = rows; it['uids'] = sorted(set(ids))
        gr = grp(it['group'], it['gname'], it['grole'], 'mixed' if it.get('upperGrid') else 'lower' if it['layer'] == 'lower' else 'upper', it['gdesc'], it['grules'])
        gr['ids'] = sorted(set(gr['ids']) | set(ids))
        w_, h_ = it['w'], it['h']
        if it['layer'] == 'lower': krows = [dict(tiles=r, upperTiles=[-1] * w_) for r in rows]
        else: krows = [dict(tiles=[-1] * w_, upperTiles=r) for r in rows]
        for y, upper_row in enumerate(it.get('upperGrid', [])):
            for x, (cell, pc) in enumerate(upper_row):
                if cell is None: continue
                tid = sh.add(cell, pc, f"{it['name']} 차량 ({x+1},{y+1})", 'prop',
                             f"{PCNOTE[pc]}. 키트 {it['id']} 차량 위층.", it['tags'], it['cat'])
                krows[y]['upperTiles'][x] = tid
                ids.append(tid)
        it['uids'] = sorted(set(ids)); gr['ids'] = sorted(set(gr['ids']) | set(ids))
        ai = dict(description=it['desc'][:400], placementRules=it['rules'][:400], tags=list(it['tags']), role=('building' if it['kind'] == 'building' else 'prop' if it['layer'] == 'upper' else 'terrain'),
                  repeatability=it['repeatability'], layerHome='lower' if it['layer'] == 'lower' else 'upper', themes=['현대 도시'], origin='ai', confidence='high')
        if it.get('growth'): ai['growthAxis'] = it['growth']
        if it['meta'].get('access'): ai['access'] = it['meta']['access']     # 문 앞 접근 칸(키트 원점 기준 dx,dy — 키트 바깥 한 줄 아래). StructureKitAiMeta 타입에는 아직 없는 필드
        kit = dict(id=it['id'], kind='section', name=it['name'], width=w_, height=h_, tileSize=16, rows=krows, learnedFrom='db-authored', ai=ai)
        if it['parts']: kit['parts'] = it['parts']
        kits.append(kit); item_by_id[it['id']] = it
        m = dict(it['meta']); m.update(name=it['name'], w=w_, h=h_, layer='lower' if it['layer'] == 'lower' else 'upper', cells=len(it['uids']))
        assert it['id'] not in kit_index, ('키트 id 중복', it['id'])
        kit_index[it['id']] = dict(kind=m.pop('kind'), name=m.pop('name'), w=m.pop('w'), h=m.pop('h'), source=m.pop('source'), door=m.pop('door'), anchor=m.pop('anchor'), access=m.pop('access'), **m)
    for it in roads: realize(it)
    for it in blds: realize(it)
    for it in props: realize(it)
    for it in veh: realize(it)
    for it in parking: realize(it)
    # 3) 오토타일: 보도·연석 4방향 (bit N=1 E=2 S=4 W=8 가 1 이면 그 이웃이 보도 계열)
    gid = {i: gcells[i]['id'] for i in range(16)}          # 땅 시트 0..15 칸의 번호
    sid = lambda i: gid[i]
    # bit N=1 E=2 S=4 W=8 가 1 이면 그 이웃이 보도 계열. 비어 있는 방향 = 도로(연석이 그 쪽에 선다)
    CURB = {15: 6, 14: 9, 13: 10, 11: 8, 7: 11, 12: 14, 6: 15, 9: 12, 3: 13}
    vm = {str(mask): sid(CURB.get(mask, 6)) for mask in range(16)}
    member = sorted({sid(i) for i in [6] + list(range(8, 16))}); connect = sorted({sid(i) for i in range(6, 16)})
    autotiles = [dict(id='mc-sidewalk-curb', name='보도·연석(4방향 자동)', neighborhood=4, memberTileIds=member, connectTileIds=connect, variantMap=vm, layer='lower', edgeConnects=True)]
    # 4) 시트 번호 마무리: 핀에서 쓰이지 않은 번호(legacy)는 이전 시트 그림을 그대로 보존
    count = sh.next_id
    prev_tpr = pins.get('tilesPerRow')
    tpr = BL.pick_tpr(count, prev_tpr)
    legacy = [i for i in range(count) if i not in sh.cells]
    old_def = None
    if legacy and os.path.exists(P['png']):
        old_png = Image.open(P['png']).convert('RGBA'); old_tpr = pins.get('tilesPerRow') or tpr
        if os.path.exists(P['tileset']): old_def = json.load(open(P['tileset'], encoding='utf-8'))
        for t in legacy:
            if (t % old_tpr + 1) * 16 <= old_png.width and (t // old_tpr + 1) * 16 <= old_png.height: sh.cells[t] = BL.norm(BL.read_cell(old_png, t, old_tpr))
    sheet_img = BL.render_sheet(sh.cells, count, tpr)
    # 5) 정의 JSON
    passability, priority, terrain, tileMeta = [], [], [], []
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for tid in range(count):
        inf = sh.info.get(tid)
        if inf is None:
            if old_def and tid < old_def['count']:
                passability.append(old_def['passability'][tid]); priority.append(old_def['priority'][tid]); terrain.append(0)
                m = dict(old_def['tileMeta'][tid]); m['description'] = '옛 굽기 칸(번호 고정용) — 지금은 쓰지 않는다. ' + m.get('description', ''); tileMeta.append(m)
            else:
                passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
                tileMeta.append(dict(label='', description='사용하지 않는 칸(번호 고정용).', source='unknown'))
            continue
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        meta = dict(label=inf['label'], description=inf['desc'], role=inf['role'], passage=passage, defaultLayer=home, tags=inf['tags'], source='bundled-default', confidence='high',
                    repeatability='repeat' if inf['pc'] in ('floor',) else 'fixed')
        if inf['pc'] in ('flat',): meta['locked'] = True; meta['layerBacking'] = 'none'; meta['description'] += ' 투명 오버레이: 붓은 위층, 캐릭터 밑에 그린다(2층).'
        elif home == 'upper': meta['layerBacking'] = 'none'
        tileMeta.append(meta)
    tileGroups = []
    for key, g in groups.items():
        ids = sorted(set(g['ids']))
        tileGroups.append(dict(id=g['id'], name=g['name'], role=g['role'], defaultLayer=g['layer'], tileIds=ids, description=g['desc'], placementRules=g['rules'], source='bundled-default', confidence='high', layerHome=g['layer'] if g['layer'] in ('lower', 'upper') else 'perCell'))
    data = collections.OrderedDict(id=ID, name='현대 도시 · 도쿄풍 (도트)', textureKey=TEXTURE, family=FAMILY, tileSize=16, tilesPerRow=tpr, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tileMeta, tileGroups=tileGroups, autotileGroups=autotiles, animationStrips=[], structureKits=kits)
    # 6) 검증 — 쓰기 전에 메모리 시트·정의로, 쓴 뒤에는 파일에서 다시 읽어서
    res = collections.OrderedDict()
    palette = BL.load_palette(os.path.join(ROOT, 'harness-data/modern-chipset/palette.pal'))
    res['tiles'] = dict(count=count, tilesPerRow=tpr, rows=math.ceil(count / tpr), sheet=[tpr * 16, math.ceil(count / tpr) * 16], used=len(sh.cells) - len(legacy), legacy=len(legacy), height_ok=math.ceil(count / tpr) * 16 <= 4096)
    kinds = collections.Counter(k['kind'] for k in kit_index.values())
    res['kits'] = dict(total=len(kits), by_kind=dict(kinds), buildings=sum(1 for i in kit_index.values() if i['kind'] == 'building'),
                       props=sum(1 for i in kit_index.values() if i['kind'] == 'prop'), vehicles=sum(1 for i in kit_index.values() if i['kind'] == 'vehicle'),
                       road=sum(1 for i in kit_index.values() if i['kind'] in ('road', 'street', 'crosswalk', 'junction')))
    res['autotile'] = dict(possible=True, groups=[a['id'] for a in autotiles], note='보도·연석 4방향 오토타일(mc-sidewalk-curb): 보도를 칠하면 도로 쪽 연석 8종·모서리 4종이 자동. 반대편 두 줄이 도로인 얇은 보도·세 방향이 도로인 곶은 일반 보도 칸으로 떨어진다(조각이 없음). 도로 구간·교차로·횡단보도는 키트 7종+교차로 2종.')
    cat_counts = collections.Counter(sh.info[t]['cat'] for t in sh.info)
    res['cells_by_category'] = dict(cat_counts)
    tot = sum(1 for it in item_by_id.values() for row in it['ids'] for t in row if t >= 0); uniq = len({t for it in item_by_id.values() for row in it['ids'] for t in row if t >= 0})
    res['dedupe'] = dict(kit_cells_total=tot, unique_cells=uniq, saved=tot - uniq, note='칸 해시(내용+통행 종류)가 같은 칸은 한 번만 싣는다(건물 변형끼리·소품 거울/색 변형이 벽·바닥 칸을 나눠 쓴다)')
    res['tall_props'] = sorted(i for i, it in item_by_id.items() if it['kind'] == 'prop' and any(pc == 'star' for row in it['grid'] for c, pc in row))
    # 팔레트
    off = collections.defaultdict(lambda: dict(cells=0, colors={}))
    for t in sh.order:
        c = sh.cells[t]; o = BL.off_palette(c, palette)
        if o:
            e = off[sh.info[t]['cat']]; e['cells'] += 1
            for col, n in o.items(): e['colors'][col] = e['colors'].get(col, 0) + n
    res['palette'] = {cat: dict(cells_with_off_palette=e['cells'], distinct_colors=len(e['colors']), pixels=sum(e['colors'].values()), cells_total=cat_counts[cat]) for cat, e in sorted(off.items())}
    res['palette_total'] = dict(cells_with_off_palette=sum(e['cells'] for e in off.values()), distinct_colors=len({c for e in off.values() for c in e['colors']}), new_cells=len(sh.order))
    res['palette_note'] = '팔레트(modern4 = harness-data/modern-chipset/palette.pal) 밖 색의 출처: 땅·녹지 시트(원본 색), 도로 표시 코드(노란 선 YEL·정지선 STOP·화살표), 차 색 변형(CAR_RAMPS 램프), 벽색·지붕색 변형(compose_town WALL_VARIANTS/town_lib ROOF_VARIANTS)'
    # 재조립 픽셀 일치 (메모리 시트 → PNG → 정의 → 다시 조립)
    if not dry:
        for p in P.values(): os.makedirs(os.path.dirname(p), exist_ok=True)
    verify = verify_reassembly(sheet_img, tpr, kits, item_by_id)
    res['reassembly'] = verify
    res['definition_checks'] = check_definition(data)
    res['autotile_check'] = autotile_check(data)
    res['pass_classes'] = dict(collections.Counter(sh.info[t]['pc'] for t in sh.info))
    res['sheet_hash'] = hashlib.sha1(sheet_img.tobytes()).hexdigest()
    res['budget'] = log['budget']; res['variant_rounds'] = log['rounds']
    res['baked_variants'] = dict(building_base=sum(1 for k in kit_index.values() if k['kind'] == 'building' and not (k['variant'].get('wall') or k['variant'].get('roof'))),
                                 building_roof_color=sorted(i for i, k in kit_index.items() if k['kind'] == 'building' and k['variant'].get('roof') and not k['variant'].get('wall')),
                                 building_wall_color=sorted(i for i, k in kit_index.items() if k['kind'] == 'building' and k['variant'].get('wall')),
                                 car_colors=['silver(원본)'] + car_colors, vehicle_flip='가로 차량은 오른쪽 향함 + 왼쪽 향함(-l)')
    res['roof_bake'] = dict(method='compose_town 과 같은 town_lib.decorate_roof(옥상 정리·설비 재배치) + add_facade_sign(상점류 간판)을 고정 시드(bake_seed=%d, 건물 이름별 Random)로 한 번 돌린 결과를 굽는다. 지붕색 변형은 같은 시드(같은 배치)에 램프만 바꾼다.' % BAKE_SEED,
                            roof_room_px=ROOF_ROOM, padding='건물 그림 위쪽에 투명 패딩(밑변 = 발, 폭은 16 배수 그대로). 소품·차량은 알파 bbox 로 잘라 밑변 정렬·좌우 가운데로 16 배수 캔버스에(오프셋은 kit-index 의 pad/image).')
    res['elapsed_sec'] = round(time.time() - t0, 1)
    pins_out = dict(version=1, tilesPerRow=tpr, count=count, variants=dict(buildings=picked_variants, carColors=car_colors), cells={k: v for k, v in sorted(sh.pins.items(), key=lambda kv: kv[1])})
    out = dict(data=data, sheet_img=sheet_img, tpr=tpr, count=count, pins=pins_out, kit_index=kit_index, report=res, items=item_by_id)
    if dry: return out
    sheet_img.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: (open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n'))
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=tpr), separators=(',', ': '))
    wr(P['pins'], pins_out, separators=(',', ':'))
    wr(P['kits'], dict(version=1, tileset=ID, tileSize=16, tilesPerRow=tpr, count=count, kits=kit_index), separators=(',', ':'))
    # 파일에서 다시 읽어 한 번 더 검증
    sheet2 = Image.open(P['png']).convert('RGBA'); d2 = json.load(open(P['tileset'], encoding='utf-8'))
    res['reassembly_from_files'] = verify_reassembly(sheet2, d2['tilesPerRow'], d2['structureKits'], item_by_id)
    res['files'] = {k: os.path.relpath(v, out_root) for k, v in P.items()}
    wr(P['report'], res, indent=1)
    return out


ENUM = dict(passage={'passable', 'solid', 'star'}, layer={'lower', 'upper'}, rep={'auto', 'center', 'fixed', 'repeat'}, grole={'building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop'},
            glayer={'lower', 'upper', 'event', 'mixed'}, source={'ai', 'bundled-default', 'imported', 'unknown', 'user'}, krole={'building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop'})


def check_definition(data):
    """src/project/types/base.ts 의 TilesetDef·TileAiMetadata·TileGroupMetadata·StructureKitDef·AutotileGroup 필드·값 범위를 손으로 옮긴 검사(타입 검사기는 돌리지 않는다)."""
    bad = collections.Counter(); ex = {}
    def no(code, info=None):
        bad[code] += 1; ex.setdefault(code, info)
    n = data['count']
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        if len(data[key]) != n: no('len-' + key)
    for i in range(n):
        p = data['passability'][i]
        if set(p) != {'up', 'down', 'left', 'right'} or not all(isinstance(v, bool) for v in p.values()): no('passability-shape', i)
        if data['priority'][i] not in ENUM['layer']: no('priority', i)
        m = data['tileMeta'][i]
        if m.get('passage') is not None and m['passage'] not in ENUM['passage']: no('passage', i)
        if m.get('defaultLayer') is not None and m['defaultLayer'] not in ENUM['layer']: no('defaultLayer', i)
        if m.get('repeatability') is not None and m['repeatability'] not in ENUM['rep']: no('repeatability', i)
        if m.get('source') not in ENUM['source']: no('source', i)
        if m.get('layerBacking') not in (None, 'none') and not isinstance(m.get('layerBacking'), int): no('layerBacking', i)
        if m.get('passage') == 'solid' and (p['up'] or p['down']) or m.get('passage') in ('passable', 'star') and not p['up']: no('passage-vs-passability', i)
    ids = set()
    for g in data['tileGroups']:
        if g['id'] in ids: no('group-dup', g['id'])
        ids.add(g['id'])
        if g['role'] not in ENUM['grole']: no('group-role', g['id'])
        if g['defaultLayer'] not in ENUM['glayer']: no('group-layer', g['id'])
        if g.get('layerHome') not in (None, 'lower', 'upper', 'perCell'): no('group-layer-home', g['id'])
        if any(not (0 <= t < n) for t in g['tileIds']): no('group-tile-range', g['id'])
        if not g.get('description') or not g.get('placementRules'): no('group-text', g['id'])
    kids = set()
    for k in data['structureKits']:
        if k['id'] in kids: no('kit-dup', k['id'])
        kids.add(k['id'])
        if k['kind'] != 'section' or k['learnedFrom'] not in ('user-paint', 'db-authored', 'interior-catalog', 'pack-preset'): no('kit-kind', k['id'])
        if len(k['rows']) != k['height']: no('kit-height', k['id'])
        for r in k['rows']:
            if len(r['tiles']) != k['width'] or len(r.get('upperTiles') or []) != k['width']: no('kit-width', k['id'])
            for t in r['tiles'] + r['upperTiles']:
                if t != -1 and not (0 <= t < n): no('kit-tile-range', k['id'])
        for pt in k.get('parts', []):
            if pt['kind'] not in ('entrance', 'sign', 'anchor', 'window') or not (0 <= pt['dx'] and pt['dx'] + pt['w'] <= k['width'] and 0 <= pt['dy'] and pt['dy'] + pt['h'] <= k['height']): no('kit-part', k['id'])
            if pt['kind'] == 'entrance':
                for x in range(pt['dx'], pt['dx'] + pt['w']):
                    t = k['rows'][pt['dy']]['upperTiles'][x]
                    if t >= 0 and data['passability'][t]['up']: no('door-cell-not-solid', k['id'])
        if k['id'].startswith('mc-bld-'):   # 건물: 모든 칸 막힘
            for r in k['rows']:
                for t in r['upperTiles']:
                    if t >= 0 and data['passability'][t]['up']: no('building-cell-passable', k['id'])
    for a in data['autotileGroups']:
        if any(not (0 <= t < n) for t in a['memberTileIds'] + list(a['variantMap'].values()) + a.get('connectTileIds', [])): no('autotile-range', a['id'])
        if a['neighborhood'] not in (4, 8) or len(a['variantMap']) != (16 if a['neighborhood'] == 4 else 256): no('autotile-shape', a['id'])
    return dict(violations=sum(bad.values()), by_code=dict(bad), examples=ex, tiles_checked=n, kits_checked=len(data['structureKits']), groups_checked=len(data['tileGroups']))


def autotile_check(data):
    """보도·연석 오토타일이 교차로·거리 단면 키트의 보도 계열 칸을 그대로 재현하는지(편집기 엔진과 같은 규칙: 이웃이 connectTileIds 면 비트 켜짐, 키트 밖은 이어진 것으로 본다)."""
    at = data['autotileGroups'][0]; conn = set(at['connectTileIds']); mem = set(at['memberTileIds']); vm = at['variantMap']
    kits = {k['id']: k for k in data['structureKits']}; out = {}
    for kid in ('mc-intersection-12x12', 'mc-street-ew-section', 'mc-street-ns-section'):
        k = kits[kid]; w, h = k['width'], k['height']; g = [r['tiles'] for r in k['rows']]; n = bad = 0
        for y in range(h):
            for x in range(w):
                if g[y][x] not in mem: continue
                n += 1
                c = lambda dx, dy: True if not (0 <= x + dx < w and 0 <= y + dy < h) else g[y + dy][x + dx] in conn
                mask = (1 if c(0, -1) else 0) | (2 if c(1, 0) else 0) | (4 if c(0, 1) else 0) | (8 if c(-1, 0) else 0)
                if vm[str(mask)] != g[y][x]: bad += 1
        out[kid] = dict(cells=n, mismatched=bad)
    return out


def verify_reassembly(sheet_img, tpr, kits, item_by_id):
    bad = []; px_bad = 0; n = 0; groups = collections.Counter(); bad_groups = collections.Counter()
    for k in kits:
        it = item_by_id[k['id']]; got = BL.reassemble(k, sheet_img, tpr); n += 1; groups[it['kind']] += 1
        if not BL.same_image(got, it['expected']):
            bad.append(k['id']); bad_groups[it['kind']] += 1
            a = np.asarray(got).astype(int); b = np.asarray(BL.norm(it['expected'])).astype(int)
            if a.shape == b.shape: px_bad += int((a != b).any(-1).sum())
            else: px_bad += a.shape[0] * a.shape[1]
    return dict(kits_checked=n, by_kind=dict(groups), mismatched_kits=len(bad), mismatched_pixels=px_bad, mismatched_ids=bad[:12])


# ====================================================================== 자체 시험
def selftest(out_main):
    """같은 입력 → 같은 바이트, 에셋 하나 추가 → 앞 번호 불변. 임시 폴더에서만 한다."""
    tmp = tempfile.mkdtemp(prefix='mc-bake-')
    r = {}
    try:
        P = paths(tmp)
        t0 = bake(tmp, budget=BUDGET); a = {k: open(v, 'rb').read() for k, v in P.items() if k != 'report'}
        t1 = bake(tmp, budget=BUDGET); b = {k: open(v, 'rb').read() for k, v in P.items() if k != 'report'}
        r['rebake_identical'] = {k: (a[k] == b[k]) for k in a}
        r['rebake_all_identical'] = all(a[k] == b[k] for k in a)
        old_pins = json.load(open(P['pins']))['cells']
        old_def = json.load(open(P['tileset']))
        t2 = bake(tmp, budget=BUDGET + 400, inject=True)
        new_pins = json.load(open(P['pins']))['cells']; new_def = json.load(open(P['tileset']))
        moved = [k for k, v in old_pins.items() if new_pins.get(k) != v]
        kit_changed = [k['id'] for k in old_def['structureKits'] if (next((x for x in new_def['structureKits'] if x['id'] == k['id']), None) or {}).get('rows') != k['rows']]
        # 앞 번호의 그림도 같아야 한다
        so = Image.open(paths(tmp)['png']).convert('RGBA')
        r['add_asset'] = dict(old_count=old_def['count'], new_count=new_def['count'], pinned_moved=len(moved), kits_changed=len(kit_changed), kits_before=len(old_def['structureKits']), kits_after=len(new_def['structureKits']),
                              added_cells=new_def['count'] - old_def['count'], note='가짜 건물 bld_selftest:Z(+예산 400) 추가', stable=(len(moved) == 0 and len(kit_changed) == 0))
        # 앞 번호 그림 불변: 시트를 다시 굽기 전 PNG(a['png']) 와 비교
        import io
        sa = Image.open(io.BytesIO(a['png'])).convert('RGBA'); same = True; tpr_a = old_def['tilesPerRow']; tpr_b = new_def['tilesPerRow']
        for tid in range(old_def['count']):
            if sa.crop(((tid % tpr_a) * 16, (tid // tpr_a) * 16, (tid % tpr_a) * 16 + 16, (tid // tpr_a) * 16 + 16)).tobytes() != so.crop(((tid % tpr_b) * 16, (tid // tpr_b) * 16, (tid % tpr_b) * 16 + 16, (tid // tpr_b) * 16 + 16)).tobytes(): same = False; break
        r['add_asset']['old_cell_pixels_unchanged'] = same
        r['add_asset']['pass'] = bool(r['add_asset']['stable'] and same)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return r


def main():
    ap = argparse.ArgumentParser(description='현대 도시 타일셋(modern_city) 굽기')
    ap.add_argument('--dry', action='store_true', help='파일을 쓰지 않고 칸·키트·검증 숫자만 계산한다')
    ap.add_argument('--budget', type=int, default=BUDGET, help='전체 칸 상한(기본 %d)' % BUDGET)
    ap.add_argument('--selftest', action='store_true', help='다시 굽기 동일·에셋 추가 시 번호 불변을 임시 폴더에서 시험하고 bake-report.json 에 기록')
    ap.add_argument('--out-root', default=ROOT, help='산출물 루트(기본 저장소 루트)')
    a = ap.parse_args()
    out = bake(a.out_root, dry=a.dry, budget=a.budget)
    rep = out['report']
    if a.selftest:
        rep['selftest'] = selftest(a.out_root)
        if not a.dry: open(paths(a.out_root)['report'], 'w', encoding='utf-8').write(json.dumps(rep, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({k: rep[k] for k in ('tiles', 'kits', 'reassembly', 'palette_total', 'baked_variants', 'budget', 'elapsed_sec') if k in rep} | ({'selftest': rep['selftest']} if 'selftest' in rep else {}), ensure_ascii=False, indent=1, default=str))


if __name__ == '__main__': main()
