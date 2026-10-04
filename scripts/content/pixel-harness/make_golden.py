# 정답지(golden set) 12종과 REFMAP 통계 표본 목록을 만든다. 좌표·이름만 쓴다 — REFMAP 화소는 저장소에 넣지 않는다.
# 저장소 루트에서: python3 scripts/content/pixel-harness/make_golden.py  → tiledata/pixel-harness/golden.json
# 좌표 규칙: rect = [x0, y0, x1, y1] (x1·y1 은 포함하지 않음). REFMAP 은 48px 칸 시트 기준.
# 우리 쪽 src 는 저장소 상대 경로. v5 는 interior-meta.json 의 atlas 에서 첫 프레임 · padTop 을 뺀 그림 상자를 푼다.
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
META = 'tiledata/hand-interior/v5/interior-meta.json'
ATLAS = 'tiledata/hand-interior/v5/interior-atlas.png'
OURS = 'tiledata/pixel-harness/ours'
V32 = 'tiledata/hand-interior/v32-demo/out'
PACK = '~/.local/share/oprn/refmap-downloads/_packs/refmap-interior/'
SHEETS = {'A2': 'A2_REFMAP_Interior.png', 'A4': 'A4_REFMAP_Interior.png', 'A5': 'A5_REFMAP_Interior.png',
          'B': 'B_REFMAP_Interior.png', 'C': 'C_REFMAP_Interior.png', 'D': 'D_REFMAP_Interior_Extra.png'}

meta = json.load(open(os.path.join(ROOT, META)))
OBJ = {o['id']: o for o in meta['objects']}
SURF = {f['id']: f for f in meta['floors'] + meta['walls']}

def v5(id_):
    if id_ in OBJ:
        o = OBJ[id_]; a = o['atlas']; y0 = a['y'] + a.get('padTop', 0)
        return dict(set='v5', src=ATLAS, rect=[a['x'], y0, a['x'] + o['image']['w'], y0 + o['image']['h']], tile=16, v5id=id_)
    a = SURF[id_]['atlas']
    return dict(set='v5', src=ATLAS, rect=[a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']], tile=16, v5id=id_, surface=True)

def r32(name, rect=None, surface=False):
    src = f'{OURS}/refmap32-{name}.png'
    d = dict(set='refmap32', src=src, tile=32)
    if rect: d['rect'] = rect
    if surface: d['surface'] = True
    return d

def v32(name, rect=None, surface=False):
    d = dict(set='v32', src=f'{V32}/{name}.png', tile=32)
    if rect: d['rect'] = rect
    if surface: d['surface'] = True
    return d

OUT_PACK = '~/.local/share/oprn/refmap-downloads/_packs/refmap-town-outside/'
OUT_SHEETS = {k: f'{k}_REFMAP_Town_Outside.png' for k in ('A1', 'A2', 'A3', 'A4', 'B', 'C', 'D2')}

def ref(sheet, rect, surface=False):
    d = dict(sheet=sheet, file=SHEETS[sheet], rect=list(rect), tile=48)
    if surface: d['surface'] = True
    return d

def out(sheet, rect, surface=True):
    """마을 바깥 팩 좌표(roof·facade·ground 재료). 항목의 pack 으로 harness_io 가 팩을 고른다."""
    d = dict(pack='town-outside', sheet=sheet, file=OUT_SHEETS[sheet], rect=list(rect), tile=48)
    if surface: d['surface'] = True
    return d

VH = 'tiledata/px48/parts/village-house/out'
def px48(src, rect=None, surface=True):
    d = dict(set='px48', src=src, tile=48)
    if rect: d['rect'] = rect
    if surface: d['surface'] = True
    return d

ROOM = 'room-empty'
GOLDEN = [
    dict(id='bed', ko='침대', material='cloth', refmap=ref('B', (0, 624, 48, 768)),
         ours=[v5('bed blue'), r32('bed'), v32('obj32-bed-blue')]),
    dict(id='table', ko='식탁', material='wood', refmap=ref('C', (0, 96, 144, 240)),
         ours=[v5('dining 2x2'), r32('dining'), v32('obj32-dining-2x2')]),
    dict(id='bookshelf', ko='책장', material='wood', refmap=ref('B', (48, 288, 96, 432)),
         ours=[v5('bookshelf 2w'), r32('bookshelf'), v32('obj32-bookshelf-2w')]),
    dict(id='barrel', ko='통', material='wood', refmap=ref('C', (576, 96, 624, 192)),
         ours=[v5('barrel'), r32('barrel'), v32('obj32-barrel')]),
    dict(id='hearth', ko='화덕', material='stone', refmap=ref('B', (240, 0, 336, 144)),
         ours=[v5('bread oven'), r32('oven'), v32('obj32-fireplace')]),
    dict(id='window', ko='창문', material='glass', refmap=ref('B', (96, 48, 144, 96)),
         ours=[v5('curtained window'), r32('window')]),
    dict(id='plant', ko='화분', material='plant', refmap=ref('B', (0, 528, 48, 624)),
         ours=[v5('potted fern'), r32('plant')]),
    dict(id='rug', ko='깔개', material='cloth', refmap=ref('A2', (192, 480, 288, 576), surface=True),
         ours=[v5('rug red'), r32('rug')]),
    dict(id='floor_wood', ko='나무 바닥', material='wood', refmap=ref('A5', (0, 96, 48, 192), surface=True),
         ours=[v5('floor:boards'), r32(ROOM, [288, 192, 416, 288], True), v32('room32', [128, 192, 288, 256], True)]),
    dict(id='floor_stone', ko='돌 바닥', material='stone', refmap=ref('A5', (0, 288, 48, 384), surface=True),
         ours=[v5('floor:flag'), r32(ROOM, [32, 128, 160, 224], True)]),
    dict(id='wall', ko='벽', material='stone', refmap=ref('A5', (0, 384, 48, 480), surface=True),
         ours=[v5('wall:stone'), r32(ROOM, [32, 32, 160, 96], True), r32(ROOM, [288, 32, 416, 96], True) | {'variant': 'plaster'},
               v32('room32', [128, 32, 160, 96], True)]),
    dict(id='door', ko='문', material='wood', refmap=ref('B', (624, 432, 672, 480)),
         note='REFMAP 실내 팩 타일 시트에는 선 문짝이 없다(문은 캐릭터 시트 몫, C 시트 출입구는 속이 검정). 나무 뚜껑문(돌 테 + 널)을 짝으로 쓴다.',
         ours=[v5('round door'), r32(ROOM, [240, 318, 304, 352], True), v32('room32', [184, 288, 232, 320], True)]),
    # 바깥 재료 정답지(2026-09-29): 표본 밖 REFMAP 한 벌씩 + px48 마을 조각
    dict(id='roof_out', ko='바깥 지붕(붉은 기와)', material='roof', refmap=out('A3', (0, 0, 96, 96)),
         ours=[px48(f'{VH}/roof-red-m.png', [0, 40, 48, 136])]),
    dict(id='facade_out', ko='바깥벽(회벽)', material='facade', refmap=out('A3', (0, 96, 96, 192)),
         ours=[px48(f'{VH}/wall-plaster-m.png', [0, 8, 48, 76])]),
    dict(id='ground_out', ko='바깥 땅(풀)', material='ground', refmap=out('A2', (0, 0, 96, 96)),
         ours=[px48('tiledata/px48/ref/grass/out/final.png')]),
]

# 통계 표본(정답지와 겹치지 않음) — 재료 범주별 분포를 만든다. 정답지 REFMAP 12종은 표본 밖에서 시험한다.
S = lambda sheet, rect, mat, name, surface=False: dict(ref(sheet, rect, surface), material=mat, id=name)
SAMPLES = [
    S('B', (48, 0, 96, 48), 'wood', 'stool'), S('B', (96, 0, 144, 48), 'wood', 'side_table'),
    S('C', (0, 48, 48, 96), 'wood', 'small_table'), S('C', (48, 0, 144, 96), 'wood', 'chairs'),
    S('B', (0, 288, 48, 432), 'wood', 'drawers'), S('B', (144, 288, 192, 384), 'wood', 'cupboard'),
    S('B', (720, 192, 768, 240), 'wood', 'barrel_b'), S('B', (624, 96, 720, 192), 'wood', 'barrel_stack'),
    S('C', (720, 336, 768, 384), 'wood', 'crate'), S('C', (48, 288, 96, 432), 'wood', 'bookshelf_dark'),
    S('A5', (48, 96, 96, 192), 'wood', 'plank_v', True), S('A5', (96, 96, 144, 192), 'wood', 'plank_h2', True),
    S('A5', (288, 96, 336, 192), 'wood', 'plank_grey', True), S('A5', (336, 96, 384, 192), 'wood', 'plank_riveted', True),
    S('A5', (288, 480, 336, 576), 'wood', 'panel_wall', True),
    S('A5', (48, 288, 96, 384), 'stone', 'flag_diag', True), S('A5', (144, 288, 192, 384), 'stone', 'cobble_round', True),
    S('A5', (240, 288, 288, 384), 'stone', 'flag_slant', True), S('A5', (336, 288, 384, 384), 'stone', 'flag_pink', True),
    S('A5', (192, 0, 240, 48), 'stone', 'cobble_grey', True), S('A5', (96, 384, 144, 480), 'stone', 'brick_rough', True),
    S('A5', (192, 384, 240, 480), 'stone', 'wall_bluestone', True), S('A4', (0, 240, 96, 336), 'stone', 'wall_whitebrick', True),
    S('D', (0, 48, 96, 144), 'stone', 'brick_oven'),
    S('A4', (96, 624, 192, 720), 'stone', 'wall_brick_a4', True), S('A4', (192, 624, 288, 720), 'stone', 'wall_bluestone_a4', True),
    S('A5', (144, 384, 192, 480), 'stone', 'wall_brick_pillar', True), S('A2', (576, 480, 672, 576), 'stone', 'flag_frame', True),
    S('B', (96, 624, 144, 768), 'cloth', 'bed_pink'), S('B', (288, 624, 336, 768), 'cloth', 'bed_green'),
    S('B', (240, 528, 384, 624), 'cloth', 'curtain_red'), S('C', (240, 96, 336, 192), 'cloth', 'curtain_purple'),
    S('A2', (288, 480, 384, 576), 'cloth', 'rug_brown', True), S('A2', (384, 480, 480, 576), 'cloth', 'rug_green', True),
    S('A2', (480, 480, 576, 576), 'cloth', 'rug_red_leopard', True), S('B', (576, 288, 624, 336), 'cloth', 'sack'),
    S('A5', (192, 192, 240, 240), 'cloth', 'carpet_red', True), S('A5', (0, 192, 48, 240), 'cloth', 'carpet_green', True),
    S('B', (192, 528, 240, 624), 'metal', 'armor'), S('C', (336, 0, 384, 144), 'metal', 'stove'),
    S('D', (96, 0, 144, 48), 'metal', 'anvil'), S('D', (96, 96, 144, 144), 'metal', 'pan'),
    S('B', (528, 0, 576, 96), 'metal', 'bars'),
    S('B', (48, 576, 96, 624), 'plant', 'flower_pot'), S('B', (432, 480, 480, 528), 'plant', 'planter'),
    S('C', (288, 384, 336, 432), 'plant', 'small_tree'), S('C', (576, 0, 624, 96), 'plant', 'herbs'),
    S('B', (672, 288, 720, 336), 'ceramic', 'jar_blue'), S('B', (720, 288, 768, 336), 'ceramic', 'jar_clay'),
    S('C', (576, 192, 624, 240), 'ceramic', 'pot_clay'), S('B', (96, 528, 144, 576), 'ceramic', 'teapot'),
    S('C', (672, 288, 720, 336), 'ceramic', 'jar_white'), S('C', (720, 288, 768, 336), 'ceramic', 'jar_lidded'),
    S('B', (0, 48, 48, 96), 'glass', 'window_plain'), S('C', (144, 0, 192, 48), 'glass', 'window_lattice'),
    S('C', (144, 96, 192, 192), 'glass', 'window_curtain_plant'),
]
# 바깥 재료 표본(마을 바깥 팩, 2026-09-29). 지붕 13 · 바깥벽 10 · 땅 6. 정답지(A3 붉은 지붕·A3 회벽·A2 풀)는 뺐다.
O = lambda sheet, rect, mat, name: dict(out(sheet, rect), material=mat, id=name)
SAMPLES += [
    O('A3', (96, 0, 192, 96), 'roof', 'roof_green'), O('C', (0, 684, 144, 720), 'roof', 'roof_red_strip'),
    O('C', (144, 684, 288, 720), 'roof', 'roof_green_strip'),
] + [O('C', (x, y, x + 48, y + 48), 'roof', f'roof_{c}_slope_{x}_{y}') for x, y, c in (   # C 큰 박공 지붕 비탈(불투명 48 창)
    (408, 48, 'red'), (504, 48, 'red'), (624, 48, 'red'), (696, 96, 'red'), (576, 144, 'red'),
    (408, 312, 'green'), (504, 312, 'green'), (672, 384, 'green'), (600, 432, 'green'), (672, 144, 'green'))] + [
    O('A3', (96, 96, 192, 192), 'facade', 'plaster_trim'), O('A3', (192, 0, 288, 96), 'facade', 'plank_light'),
    O('A3', (288, 0, 384, 96), 'facade', 'plank_rail'), O('A3', (192, 96, 288, 192), 'facade', 'plank_dark'),
    O('A3', (288, 96, 384, 192), 'facade', 'plank_dark_rail'), O('A4', (0, 624, 96, 720), 'facade', 'brick_white'),
    O('A4', (96, 624, 192, 720), 'facade', 'brick_red'), O('A4', (192, 624, 288, 720), 'facade', 'cobble_blue'),
    O('A4', (288, 624, 384, 720), 'facade', 'plaster_plain'), O('A4', (672, 624, 768, 720), 'facade', 'wood_boards'),
    O('A2', (96, 0, 192, 96), 'ground', 'grass_tuft'), O('A2', (0, 192, 96, 288), 'ground', 'dirt'),
    O('A2', (96, 192, 192, 288), 'ground', 'dirt_grass'), O('A2', (0, 288, 96, 384), 'ground', 'dirt_dark'),
    O('A2', (384, 288, 480, 384), 'ground', 'paving'), O('A2', (480, 288, 576, 384), 'ground', 'cobble_path'),
]

# 짝 없는 우리 그림(사용자 지적 결함 확인용): 둥근 덩이 명암(베개)·띠가 보이는 소품
EXTRAS = [dict(id='jar', ko='항아리', material='ceramic', ours=[r32('jar')]),
          dict(id='sack', ko='자루', material='cloth', ours=[r32('sack')]),
          dict(id='crate', ko='궤짝', material='wood', ours=[r32('crate')]),
          dict(id='wardrobe', ko='옷장', material='wood', ours=[r32('wardrobe'), v5('wardrobe'), v32('obj32-wardrobe')]),
          dict(id='water_jar', ko='물항아리', material='ceramic', ours=[v5('water jar'), v32('obj32-water-jar')]),
          dict(id='room', ko='견본 방 전체', material='wood', ours=[r32('room', surface=True)])]

def main():
    out = dict(version=1, note='REFMAP 은 상용 제3자 팩 — 좌표만 기록한다. 화소·크롭은 저장소 밖(~/.local/share/oprn/pixel-harness, ~/claude-viz)에만.',
               refmapPack=PACK, refmapPacks={'interior': PACK, 'town-outside': OUT_PACK}, rect='[x0,y0,x1,y1) px', tile='원본 칸 크기(px). REFMAP 48, v5 16, 32px 견본 32',
               materials=['wood', 'stone', 'cloth', 'metal', 'plant', 'ceramic', 'glass', 'roof', 'facade', 'ground'],
               golden=GOLDEN, extras=EXTRAS, samples=SAMPLES)
    p = os.path.join(ROOT, 'tiledata/pixel-harness/golden.json')
    json.dump(out, open(p, 'w'), ensure_ascii=False, indent=1)
    print(p, len(GOLDEN), 'golden', len(SAMPLES), 'samples', sum(len(g['ours']) for g in GOLDEN), 'ours')

if __name__ == '__main__':
    main()
