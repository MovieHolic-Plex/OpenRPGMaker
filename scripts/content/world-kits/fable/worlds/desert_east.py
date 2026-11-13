"""desert_east 첫 판 늘리기 주문(2026-11-13) — 재고 표(scripts/content/world-kits/gap.mts)에서 뽑은 순서:
① 많이 놓이는데 그림이 적은 종류의 다른 그림(변형 — 원본과 같은 칸·같은 통행, 굽기가 ai.variantOf 로 단다) ② 바닥·길·광장 재질(재질 한 칸만 그리고 가장자리는 코드)
③ 새 건물 크기(평지붕 직각 지붕) ④ 없던 이야기 기물(레버·내려가는 뚜껑문·방 문·게시판·세이브 수정)·통.
모델이 읽는 글은 영어. 팔레트는 desert_east 잠긴 팔레트(scripts/content/desert-east/art/palette.json) 그대로."""
import json, os
from PIL import Image

ID, PREFIX, DIR = 'desert_east', 'de-', 'tiledata/desert-east'
TILESET, SHEET = 'src/assets/desertEastTileset.json', 'public/assets/desert-east/desert-east-chipset.png'
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.abspath(os.path.join(_HERE, '..', '..', '..', '..', '..'))
_P = json.load(open(os.path.join(_ROOT, 'scripts/content/desert-east/art/palette.json')))
RAMPS = {k: v for k, v in _P.items() if not k.startswith('_')}
EG = 'adobe:3'
BLURB = ('desert_east - a desert town of the East: Arabia, the Silk Road, Egypt and Mesopotamia. Sun-baked mud-brick (adobe) and sandstone, white lime plaster, flat roof terraces, '
         'turquoise and lapis glazed tiles, brass lanterns, palm trees, camels, striped awnings, carpets and clay jars. Warm, sunny, dry; light from the upper left.')
MATERIALS = """
Ramps by use (stay inside them): sand/rock = desert ground and stones · adobe = mud brick and red clay · stone = sandstone · plaster = white lime plaster · marble = palace marble ·
wood/dwood = timber · palm/grass = leaves and oasis grass · water = water · turq/lapis/gold/red/saffron/indigo = glazed tile, brass, cloth and paint (small areas) · hide = leather and camel hair · fire = flames and glowing coals · sumi/void = the deepest shadows only.
"""

IMG = {
    'prop': [('props@4x.png', 'Finished pieces of THIS chipset with the player between them (4x): their materials, tone steps, top faces seen from above, and their SIZES relative to the player. Draw in exactly this style.')],
    'roof': [('houses@4x.png', 'Houses of THIS chipset with the player beside them (4x): flat roof terraces seen from above as a rectangular block with a parapet rim, over a flat front wall with an arched door. Draw in exactly this style and camera.')],
    'ground': [('ground@6x.png', 'Ground tiles of THIS chipset with the player standing on them (6x): golden sand, packed earth road, sandstone paving. Take how quiet the ground is under the figure - close tones, joints barely darker.')],
}
IMG['wall'] = IMG['roof']
IMG['wallface'] = [('rooms@4x.png', 'Interior wall faces and furniture of THIS chipset with the player (4x): the back wall of a room seen from the front, 32 px high, over the floor.')] + IMG['prop']


def refs(W, rd):
    import wk_common as C
    hero = C.hero()

    def row(ids, bg, pad=6):
        ims = [W.kit_image(k) for k in ids if k in W.kits]
        h = max(i.height for i in ims + [hero]) + 8
        c = Image.new('RGBA', (sum(i.width + pad for i in ims) + 40, h), tuple(bg) + (255,))
        x = 4
        for n, i in enumerate(ims):
            c.alpha_composite(i, (x, h - 4 - i.height)); x += i.width + pad
            if n == 1: c.alpha_composite(hero, (x, h - 4 - 32)); x += 24 + pad
        return c
    C.big(row(['de-well', 'de-palm-young', 'de-jar-big', 'de-stall-spice', 'de-camel', 'de-lantern-post', 'de-bench-stone', 'de-crates-stack', 'de-sacks'], C.BG), 4).save(f'{rd}/props@4x.png')
    C.big(row(['de-house-adobe-4', 'de-house-stone-4', 'de-house-plaster-3'], C.BG), 4).save(f'{rd}/houses@4x.png')
    C.big(row(['de-wall-plaster', 'de-wall-window-plaster', 'de-shelf-pottery', 'de-divan', 'de-wall-stone', 'de-wall-niche-stone'], (120, 96, 72)), 4).save(f'{rd}/rooms@4x.png')
    g = Image.new('RGBA', (64, 48))
    tiles = W.mod_tiles if hasattr(W, 'mod_tiles') else None
    pieces = json.load(open(os.path.join(_ROOT, 'src/assets/desertEastPieces.json')))['tiles']
    lay = [['de-sand', 'de-sand-b', 'de-road', 'de-road-b'], ['de-sand-c', 'de-sand-ripple', 'de-road', 'de-flag'], ['de-sand-d', 'de-sand-pebble', 'de-flag-b', 'de-flag']]
    for y, r in enumerate(lay):
        for x, pid in enumerate(r): g.alpha_composite(W.tile(pieces[pid]), (x * 16, y * 16))
    g.alpha_composite(hero, (20, 12))
    C.big(g, 6).save(f'{rd}/ground@6x.png')


# ── ① 변형: (원본 키트, 계약, 관문 종류, 무엇, [변형마다 한 줄]) ──
V = [
    # 자연물(가장 많이 놓임)
    ('de-scrub', 'organic', 'organic', 'desert shrub', ['a grey-green saltbush tuft with tiny pale leaves and a few dry twigs', 'a low thorny camel-thorn bush with dark olive leaves and small yellow flowers']),
    ('de-tuft', 'organic', 'organic', 'tuft of dry grass', ['a fan of pale straw-yellow grass blades bending in the wind', 'three short spiky esparto grass clumps, ochre and dull green']),
    ('de-reeds', 'organic', 'organic', 'waterside reeds', ['tall papyrus stems with round feathery heads', 'cattail reeds with brown seed heads and long blades']),
    ('de-oleander', 'organic', 'organic', 'flowering shrub', ['a pink bougainvillea bush, papery magenta flowers over dark leaves', 'a white jasmine shrub with small star flowers']),
    ('de-aloe', 'organic', 'organic', 'succulent', ['a round barrel cactus with ribs and a crown of red flowers', 'an agave rosette of thick blue-grey pointed leaves']),
    ('de-rock-small', 'organic', 'organic', 'small rock', ['a flat red sandstone slab with layered edges', 'two smooth grey river pebbles side by side']),
    ('de-boulder', 'organic', 'organic', 'big rock', ['a wind-carved sandstone boulder with horizontal layers and an overhang', 'a heap of dark weathered basalt blocks']),
    ('de-outcrop', 'organic', 'organic', 'rocky outcrop', ['a low mesa of layered red and ochre rock with a flat top']),
    ('de-palm-date', 'organic', 'organic', 'date palm', ['a tall date palm with heavy orange date clusters under the fronds, ringed trunk', 'a slender leaning palm with a ragged crown and a few dead brown fronds hanging']),
    ('de-palm-young', 'organic', 'organic', 'young palm', ['a dwarf fan palm with stiff fan-shaped leaves on short stalks', 'a young date palm sprouting from a ring of stones']),
    ('de-palm-pair', 'organic', 'organic', 'pair of palms', ['two doum palms with forked trunks and fan crowns']),
    ('de-palm-stump', 'organic', 'organic', 'palm stump', ['a cut palm trunk with sprouting new leaves at its top']),
    # 시장·물건
    ('de-stall-pottery', 'prop', 'structure', 'market stall', ['a stall under a green-and-white striped awning selling stacked copper pots and trays']),
    ('de-stall-spice', 'prop', 'structure', 'market stall', ['a stall under a plain reed mat roof with open sacks of dates, nuts and dried figs']),
    ('de-stall-carpet', 'prop', 'structure', 'market stall', ['a stall under an indigo awning with hanging woven baskets and bags']),
    ('de-stall-fruit', 'prop', 'structure', 'market stall', ['a stall under an orange awning with melons, pomegranates and grapes in crates']),
    ('de-stall-lantern', 'prop', 'structure', 'market stall', ['a stall under a red awning with hanging bird cages and a perfume bottle shelf']),
    ('de-jar-big', 'prop', 'round_body', 'big water jar', ['a tall unglazed amphora with two handles leaning in a wooden stand', 'a squat turquoise-glazed storage jar with a wooden lid']),
    ('de-jars-group', 'prop', 'round_body', 'group of jars', ['three blue-and-white painted pots of different heights']),
    ('de-basket-spice', 'prop', 'round_body', 'basket', ['a woven palm-leaf basket heaped with dates', 'a round brass bowl of saffron threads on a low stool']),
    ('de-sacks', 'prop', 'round_body', 'sacks', ['two tied hemp grain sacks leaning on each other', 'a pile of striped woollen bundles tied with rope']),
    ('de-crate', 'prop', 'box', 'crate', ['a palm-rib cage crate with a clay jar inside', 'a small iron-banded cedar chest box']),
    ('de-crates-stack', 'prop', 'box', 'stack of crates', ['a stack of rope-tied wooden crates and a rolled mat on top']),
    ('de-carpet-rolls', 'prop', 'round_body', 'rolled carpets', ['three rolled kilim rugs standing upright in red, indigo and saffron']),
    # 등·불
    ('de-lantern-post', 'prop', 'column', 'street lantern', ['a black iron post with a hanging star-pierced brass lantern', 'a carved wooden pole with a cloth-shaded oil lamp on top']),
    ('de-brazier', 'prop', 'container', 'brazier', ['a low clay fire bowl on three stones with glowing coals', 'a copper basin brazier on a tripod with a small flame']),
    ('de-torch-stand', 'prop', 'column', 'torch stand', ['a sandstone pillar topped by a burning oil bowl']),
    ('de-brazier-stand', 'prop', 'column', 'brazier stand', ['a tall bronze stand with a pierced dome burner glowing inside']),
    # 앉을 곳·탁자
    ('de-bench-stone', 'prop', 'seat', 'bench', ['a wooden bench with a woven palm seat and turned legs', 'a mud-brick bench plastered white with a striped cushion']),
    ('de-divan', 'prop', 'seat', 'low sofa', ['a low divan with indigo cushions and a fringed cover']),
    ('de-cushion', 'prop', 'seat', 'floor cushion', ['a square leather pouf with stitched star pattern']),
    ('de-tea-table', 'prop', 'low_furniture', 'low tea table', ['a low octagonal inlaid wooden table with a teapot and two glasses']),
    ('de-shop-counter', 'prop', 'low_furniture', 'shop counter', ['a cedar counter with a set of brass weights and an abacus']),
    ('de-tea-counter', 'prop', 'low_furniture', 'tea counter', ['a tiled counter with a big copper kettle on coals and glasses']),
    # 우물·물
    ('de-well', 'prop', 'container', 'well', ['a round well with a turquoise tiled rim and a bucket on a rope, no roof', 'a square sandstone well under a small timber frame with a pulley']),
    ('de-trough', 'prop', 'container', 'water trough', ['a hollowed palm-log trough full of water']),
    ('de-fountain', 'prop', 'container', 'fountain', ['a star-shaped basin fountain of white marble with a low jet']),
    # 짐승·탈것·말뚝
    ('de-hitch-post', 'prop', 'column', 'hitching post', ['a wooden post with an iron ring and a coiled rope', 'a carved stone hitching post with a brass ring']),
    ('de-camel', 'prop', 'other', 'camel', ['a pale cream dromedary with a red tasselled saddle blanket']),
    ('de-camel-rest', 'prop', 'other', 'resting camel', ['a dark brown camel resting on the ground with saddle bags']),
    ('de-cart-camel', 'prop', 'box', 'cart', ['a two-wheeled donkey cart loaded with water skins and a donkey']),
    ('de-handcart', 'prop', 'box', 'handcart', ['a wheelbarrow of melons with a wooden wheel']),
    # 실내 가구
    ('de-shelf-pottery', 'prop', 'tall_furniture', 'shelf', ['a niche shelf of brass lamps and teapots', 'a wooden rack of rolled scrolls and books']),
    ('de-shelf-inn', 'prop', 'tall_furniture', 'narrow shelf', ['a narrow cupboard with carved lattice doors']),
    ('de-bed-mat', 'prop', 'low_furniture', 'low bed', ['a rope-strung wooden bed with a striped blanket', 'a sleeping mat with a red woollen blanket and a bolster']),
    ('de-jar-tall', 'prop', 'round_body', 'tall jar', ['a tall terracotta jar with a painted black band', 'a slender lapis-glazed vase with gold rim']),
    ('de-vase-tall', 'prop', 'round_body', 'vase', ['a tall brass ewer with a long spout']),
    ('de-chest-brass', 'prop', 'box', 'chest', ['a painted green chest with flower motifs and brass corners']),
    ('de-treasure-chest', 'prop', 'box', 'treasure chest', ['a closed black-and-gold lacquer chest with a gold scarab clasp']),
    ('de-rug-medallion', 'decal', 'flat', 'rug', ['a red kilim with a row of indigo diamonds and fringes at both ends']),
    ('de-tannur-oven', 'prop', 'container', 'clay oven', ['a round clay bread oven with flatbread on its rim']),
    ('de-hookah', 'prop', 'round_body', 'water pipe', ['a tall green-glass water pipe with a coiled hose']),
    ('de-basin-tap', 'prop', 'container', 'wash basin', ['a carved stone basin with a brass lion-head spout']),
    ('de-marble-bench', 'prop', 'seat', 'stone bench', ['a turquoise tiled bench with a white top']),
    ('de-throne', 'prop', 'seat', 'throne', ['a carved ebony and ivory throne under a small fringed canopy on a step']),
    ('de-sarcophagus', 'prop', 'box', 'sarcophagus', ['a plain granite sarcophagus with a carved lid band']),
    ('de-guardian-statue', 'prop', 'figure', 'guardian statue', ['a standing jackal-headed guardian statue on a plinth']),
    ('de-canopic-jars', 'prop', 'round_body', 'jars', ['four small alabaster jars with animal-head lids on a tray']),
    ('de-offering-table', 'prop', 'low_furniture', 'offering table', ['a low stone table with bread loaves, figs and a lit lamp']),
    ('de-column-palace', 'prop', 'column', 'column', ['a slim column with a lotus capital, painted bands in turquoise and red']),
    ('de-kiln', 'prop', 'container', 'kiln', ['a beehive mud-brick kiln with pots stacked on its side']),
    # 둘째 묶음(재고 뒤 — 여전히 «놓이는데 그림 1장» 이던 종류)
    ('de-incense-burner', 'prop', 'container', 'incense burner', ['a tall brass incense burner with a pierced domed lid and a thin curl of smoke', 'a small turquoise-glazed clay incense bowl on a low wooden stool with glowing embers']),
    ('de-notice-board', 'prop', 'front_prop', 'notice board', ['a whitewashed wall-like board of mud brick with a timber frame, pinned parchment sheets and a brass bell (no letters)', 'a notice board made of a carved sandstone slab on a plinth with pinned paper notes and a red ribbon (no letters)']),
    ('de-plunge-pool', 'prop', 'container', 'bath-house plunge pool', ['a sunken bath pool rimmed with green glazed tiles, steaming pale water and two steps at the left']),
]

# 실내 벽면(1×2, 불투명, 가로로 이어 붙는다) — 방마다 벽이 게임마다 다르다
WALLS = [
    ('de-wall-plaster', 'a lime-plastered wall with a band of blue-and-white painted tiles at its foot and a plain cornice'),
    ('de-wall-stone', 'a coursed sandstone wall with a carved frieze of small arches near the top'),
    ('de-wall-tomb', 'a dark limestone tomb wall painted with a band of hieroglyph-like pictures (no readable letters) on ochre'),
    ('de-wall-palace', 'a palace wall of white marble panels with a gold-and-lapis geometric star band'),
    ('de-wall-hammam', 'a bath-house wall of green-glazed square tiles with a white grout grid and a dark skirting'),
]

# 벽면에 이어 붙는 가족(창 난 벽·벽감 벽): (가족 원본, 벽면 원본). 벽면 변형마다 «그 벽면 그림 + 원본 가족 그림이 벽면과 다른 화소(창·벽감)» 를 코드로 얹어
# 같은 순번의 변형을 만든다(build.py). 굽기가 ai.lookWith = 벽면 원본을 달아 게임 열쇠가 벽면과 같은 순번을 고르게 한다 — 안 그러면 한 방에 두 벽이 섞인다.
ACCENTS = [('de-wall-window-plaster', 'de-wall-plaster'), ('de-wall-niche-stone', 'de-wall-stone')]

# 집 변형(평지붕): (원본, 무엇) — 지붕 블록 + 벽 블록을 따로 그려 코드로 잇는다
HOUSES = [
    ('de-house-adobe-4', ['a whitewashed mud-brick house with a blue door, a rug airing on the roof terrace and a row of clay jars', 'a two-tone ochre mud house with palm-trunk beam ends sticking out under the parapet and a curtain doorway']),
    ('de-house-adobe-3', ['a narrow pink-clay house with a small round window and a green wooden door']),
    ('de-house-stone-4', ['a sandstone house with a carved lintel over the door and a roof terrace with a little pergola of palm leaves']),
    ('de-house-plaster-4', ['a white plastered house with turquoise window shutters, a turquoise door and dried peppers on the roof']),
    ('de-house-adobe-5', ['a large mud-brick house with two small windows, a heavy timber door and a roof terrace with a ladder hatch and drying dates']),
    ('de-house-shop', ['a shop house with a red-and-white striped awning over a counter of spice jars, and a blank brass sign board hanging on chains (no letters)']),
]

# 새 건물 크기(새 종류 — 구성기 집 줄에 넣는다): (id, 이름, 칸 w×h, 문 칸 x, 무엇)
NEW_HOUSES = [
    ('house-wide-5', '낮고 넓은 흙집(창 둘)', 5, 4, 2, 'a wide low mud-brick house with two small shuttered windows, a timber door and a roof terrace with a water jar and a reed sunshade'),
    ('house-hut-2', '작은 흙움막(갈대 지붕 테라스)', 2, 3, 0, 'a tiny one-room mud hut with a reed mat over its roof terrace and a low curtained doorway'),
    ('house-tower-3', '좁은 탑집(비둘기 구멍)', 3, 5, 1, 'a narrow tall tower house of mud brick, pigeon holes in rows near the top, one small window, roof parapet with crenels'),
]

# 새 종류·이야기 기물(objects/spec.json 꼴): (id, 이름, en, 관문 종류, w, h, place, block, words, 계약, 그리기 글)
NEW_OBJECTS = [
    ('barrel', '나무 통(물·기름)', 'wooden barrel', 'round_body', 1, 1, 'prop', [[0, 0]], ['통', '나무 통', '술통', '물통', 'barrel'], 'prop', 'a wooden barrel with iron hoops and a clay jug on top'),
    ('barrels', '통 둘(테 두른 나무 통)', 'two barrels', 'round_body', 2, 1, 'prop', [[0, 0], [1, 0]], ['통', '나무 통', '술통', 'barrels'], 'prop', 'two hooped wooden barrels side by side, one with a brass tap'),
    ('notice-board', '게시판(나무 판에 붙은 종이·포고문)', 'notice board', 'front_prop', 2, 2, 'tall', [[0, 1], [1, 1]], ['게시판', '알림판', '포고문', '공고', '기록판', 'notice board'], 'prop', 'a wooden notice board on two posts with a little roof, pinned paper notes and a cloth flag (no letters)'),
    ('lever-wall', '벽 레버(놋 손잡이 · 돌 벽 상자)', 'wall-mounted lever', 'wall_mounted', 1, 2, 'wallmount', [[0, 0], [0, 1]], ['벽걸이', '레버', '벽 레버', '스위치', 'lever', 'switch'], 'wallmount', 'a stone box set in the wall with a brass lever handle pointing up and a chain'),
    ('stop-lever', '바닥 레버(돌 받침 위 큰 놋 레버)', 'floor lever', 'other', 1, 2, 'tall', [[0, 1]], ['레버', '바닥 레버', '스위치', '조작 레버', 'lever', 'switch'], 'prop', 'a big brass lever with a red grip on a carved stone base'),
    ('hatch-down', '지하로 내려가는 돌계단 입구', 'stone stairs going down', 'flat', 2, 2, 'decal', [], ['계단', '지하', '지하 입구', '입구', '뚜껑문', '내려가는 계단', 'stairs', 'cellar'], 'stairs', 'a sandstone-rimmed opening in the ground with steps going down into darkness'),
    ('room-door', '방 문(나무 아치 문)', 'arched wooden door between rooms', 'wall_structure', 1, 2, 'walldoor', [[0, 0], [0, 1]], ['문', 'door', '방문', '나무 문', '출입문'], 'wallmount', 'a closed arched wooden door with iron studs and a brass ring in a plastered frame, filling the canvas width'),
    ('save-crystal', '세이브 수정(빛나는 청록 수정 받침)', 'glowing save crystal', 'figure', 1, 2, 'tall', [[0, 1]], ['세이브', '세이브 수정', '수정', '저장', 'save crystal', 'crystal'], 'prop', 'a glowing turquoise crystal floating over a small carved sandstone plinth'),
]

# ② 바닥·길·광장 재질: (재질 id, 쓰는 램프, 무엇) — 한 칸(16×16, 이어 붙는) 두 장씩
TEXTURES = [
    ('ground-red', ['adobe'], 'red desert sand like Wadi Rum: soft reddish sand with faint wind ripples and a few darker grains'),
    ('ground-pale', ['plaster', 'sand'], 'pale gypsum sand, almost white with a warm tint, very quiet, faint ripples'),
    ('road-cobble', ['rock'], 'a road of small rounded grey cobbles set in sand-coloured mortar'),
    ('road-brick', ['adobe'], 'a road paved with fired red bricks in a running bond, worn edges'),
    ('plaza-zellige', ['plaster', 'turq'], 'a plaza paved with square white glazed tiles with a small turquoise star at each corner'),
    ('plaza-marble', ['marble'], 'a plaza of large polished pale marble slabs with thin joints'),
    ('plaza-herring', ['adobe', 'sand'], 'a plaza of herringbone-laid tan bricks'),
]


def jobs(W):
    import wk_common as C
    J = []
    for base, con, gk, what, lines in V:
        k = W.kits[base]
        for n, line in enumerate(lines, 1):
            kind = {'organic': 'organic', 'decal': 'decal'}.get(con) or {'structure': 'structure', 'round_body': 'round_body', 'container': 'container', 'column': 'column', 'box': 'box', 'figure': 'figure', 'other': 'animal' if 'camel' in base else 'other', 'seat': 'box', 'low_furniture': 'box', 'tall_furniture': 'box'}.get(gk, 'other')
            J.append(dict(id=f'v-{base[3:]}-{n}', ko=f'{k["name"]} 변형 {n}', name=f'{what} (new look {n})', w=k['width'] * 16, h=k['height'] * 16, cls='prop', contract=con, kind=kind,
                          text=line + '.', base=base, what=what, gate=gk, variantOf=base))
    for base, line in WALLS:
        k = W.kits[base]
        J.append(dict(id=f'v-{base[3:]}-1', ko=f'{k["name"]} 변형', name='interior wall face (new look)', w=16, h=32, cls='wallface', contract='wallface', kind='wallface', text=line + '.', base=base, what='wall face', gate='terrain', variantOf=base))
    for base, lines in HOUSES:
        k = W.kits[base]
        ent = W.kit_entrance(base) or [k['width'] // 2]
        for n, line in enumerate(lines, 1):
            J += house_jobs(f'v-{base[3:]}-{n}', f'{k["name"]} 변형 {n}', k['width'], k['height'], ent, line, base=base)
    for hid, ko, w, h, door, line in NEW_HOUSES:
        J += house_jobs(f'n-{hid}', ko, w, h, [door], line)
    for oid, ko, en, gk, w, h, place, block, words, con, line in NEW_OBJECTS:
        kind = {'stairs': 'stairs', 'wallmount': 'wallmount'}.get(con) or {'round_body': 'round_body', 'front_prop': 'other', 'other': 'other', 'figure': 'figure'}.get(gk, 'other')
        J.append(dict(id=f'n-{oid}', ko=ko, name=en, w=w * 16, h=h * 16, cls='prop', contract=con, kind=kind, text=line + '.', gate=gk, obj=dict(id=oid, name=ko, en=en, kind=gk, w=w, h=h, place=place, block=block, words=words)))
    for tid, ramps, line in TEXTURES:
        J.append(dict(id=f't-{tid}-a', ko=f'재질 {tid} A', name=f'{tid} ground tile', w=16, h=16, cls='ground', contract='ground', kind='ground', text=line + f'. Use only these ramps: {", ".join(ramps)}.', gate='terrain', prio=1))
        J.append(dict(id=f't-{tid}-b', ko=f'재질 {tid} B', name=f'{tid} ground tile, variant B', w=16, h=16, cls='ground', contract='tilevar', kind='ground', text=line + f'. Use only these ramps: {", ".join(ramps)}.', gate='terrain',
                      needs=[[f't-{tid}-a', 'VARIANT A (copy its border rows and columns exactly)']]))
    for j in J: j['cap'] = C.cap_for(j['w'], j['h'])
    return J


def house_jobs(hid, ko, wc, hc, ent, line, base=None):
    """평지붕 집: 지붕 블록(위 hc-2 줄) + 벽 블록(아래 2줄). 지붕이 2,760화소를 넘으면 왼쪽·오른쪽 반으로 나눈다."""
    W_, roof_h = wc * 16, (hc - 2) * 16
    door_px = f'the door is in the cell columns {ent[0]}..{ent[-1]} of this wall (pixels {ent[0] * 16}..{ent[-1] * 16 + 15}): an arched or square door opening 12-14 px wide and 24 px tall, centred in that cell, its bottom on the last row - the player walks through it'
    out = []
    common = dict(gate='structure', house=dict(id=hid, base=base, w=wc, h=hc, ent=ent, ko=ko))
    if W_ * roof_h <= 2760:
        out.append(dict(id=f'{hid}-roof', ko=f'{ko} 지붕', name='flat roof block of a house', w=W_, h=roof_h, cls='roof', contract='roof', kind='roof', text=line + '. Draw ONLY its roof block.', **common))
    else:
        lw = (wc + 1) // 2 * 16
        out.append(dict(id=f'{hid}-roofl', ko=f'{ko} 지붕 왼쪽', name='LEFT part of a flat roof block', w=lw, h=roof_h, cls='roof', contract='roof', kind='roof',
                        text=line + f'. Draw ONLY the LEFT {lw} px of its roof block: the parapet rim runs along the top, left and bottom edges only; the RIGHT edge is open (it continues in the right part drawn separately).', **common))
        out.append(dict(id=f'{hid}-roofr', ko=f'{ko} 지붕 오른쪽', name='RIGHT part of a flat roof block', w=W_ - lw, h=roof_h, cls='roof', contract='roof', kind='roof',
                        text=line + f'. Draw ONLY the RIGHT {W_ - lw} px of its roof block: the parapet rim runs along the top, right and bottom edges only; the LEFT edge is open and must continue the left part (given below as row strings) seamlessly at the same rows.',
                        needs=[[f'{hid}-roofl', 'THE LEFT PART of this roof (continue it across the shared edge)']], **common))
    out.append(dict(id=f'{hid}-wall', ko=f'{ko} 벽', name='front wall block of a house', w=W_, h=32, cls='wall', contract='wall', kind='wall', door=door_px, text=line + '. Draw ONLY its front wall block (one storey, 32 px).',
                    needs=[[out[0]['id'], 'THE ROOF BLOCK that sits directly above this wall (match its materials and colours)']], **common))
    return out


WAIVER = 'fable-variety-desert-east-2026-11-13'
DROP = {'n-lever-wall': '사막 실내의 벽면 칸은 칸 역할이 terrain 이라 놓기 도구(stamp_tileset_object 의 벽걸이 규칙 — 아래층이 wall·roof 역할)가 받지 않는다. 놓을 수 없는 그림은 굽지 않는다(바닥 레버 de-stop-lever 가 그 일을 한다)',
        'n-house-tower-3': '지붕 덩이가 48px 로 벽(32px)보다 높다(지붕 높이 상한 44px·몫 55% 초과) — 1배에서 빈 지붕 판으로 읽힌다', 'v-fountain-1': '답이 잘렸다(48×48, 한 번만 그린다)'}

# 겉모습 갈래: 재질 이름 → (주문의 재질 id). 맨 앞 "" = 원래 그림.
LOOK_PARTS = {'ground': ['', 'red', 'pale'], 'road': ['', 'cobble', 'brick'], 'plaza': ['', 'zellige', 'marble', 'herring']}
LOOK_TEX = {'ground': 'ground-{}', 'road': 'road-{}', 'plaza': 'plaza-{}'}
# 한 칸 바닥: 재질의 A·B 두 장을 원래 변주 칸 자리에
LOOK_SINGLES = {'ground': {'de-sand': 'a', 'de-sand-b': 'b', 'de-sand-c': 'a', 'de-sand-d': 'b', 'de-sand-ripple': 'b', 'de-sand-pebble': 'a'},
                'road': {'de-road': 'a', 'de-road-b': 'b'}, 'plaza': {'de-flag': 'a', 'de-flag-b': 'b'}}
# 왕 타일 벌 → (A 쪽 갈래, B 쪽 갈래). 그 벌이 쓰는 원래 재질 램프(새 재질로 옮길 꾸밈 색).
WANG = {'road': ('ground', 'road'), 'grass': ('ground', None), 'dune': ('ground', 'ground'), 'flag': ('ground', 'plaza')}
# 같이 고르지 않는 짝(바닥과 길·광장이 같은 색이라 경계가 안 보인다): 바닥 재질 → 그 바닥에서는 원래 그림으로 되돌리는 길·광장 재질
CLASH = {'pale': ['zellige', 'marble'], 'red': ['brick']}
DEFAULT_RAMPS = {'ground': {'sand', 'rock'}, 'road': {'sand', 'rock', 'adobe'}, 'plaza': {'stone'}}


def build_looks(W, textures, save, report):
    """재질 칸(Fable) → 한 칸 바닥 + 모서리 왕 타일(desert_east art/terrain.py 의 가장자리 꼴·꾸밈 코드에 새 재질을 넣는다)."""
    import itertools, sys as _s
    import numpy as np
    from PIL import Image
    _s.path.insert(0, os.path.join(_ROOT, 'scripts/content/desert-east/art'))
    import terrain as AT
    import px as PX
    rgb = lambda m, t: PX.RGB[PX.MI[m]][max(0, min(PX.NT[PX.MI[m]] - 1, t))]
    tex = {}
    for part, names in LOOK_PARTS.items():
        for name in names[1:]:
            a, b = textures(LOOK_TEX[part].format(name))
            if a is None or b is None: report['missing'].append(f'texture {part}:{name}'); continue
            for im in (a, b):    # 재질 칸은 불투명이어야 한다 — 행 끝이 모자란 화소는 왼쪽 이웃으로 채운다
                px_ = im.load()
                for y in range(16):
                    for x in range(16):
                        if px_[x, y][3] == 0: px_[x, y] = px_[x - 1, y] if x else px_[x + 1, y]
            tex[(part, name)] = (np.array(a.convert('RGBA')), np.array(b.convert('RGBA')))
    pieces, tiles, wang = [], {}, {}
    body = {}
    for key_, (A_, _) in tex.items():
        flat = [tuple(int(c) for c in p) for p in A_[:, :, :3].reshape(-1, 3)]
        ramp = W.rev[max(set(flat), key=flat.count)].split(':')[0]
        body[key_] = [C_hx(c) for c in W.ramps[ramp]]

    def emit(pid, im):
        src = save(pid, im)
        pieces.append(dict(id=pid, src=src))
        report['looks'] += 1
        return pid
    # 한 칸 바닥
    for part, names in LOOK_PARTS.items():
        for name in names[1:]:
            if (part, name) not in tex: continue
            A, B = tex[(part, name)]
            ids = {}
            for ab, arr in (('a', A), ('b', B)):
                ids[ab] = emit(f'de-look-{part}-{name}-{ab}', Image.fromarray(arr, 'RGBA'))
            tiles[name] = {piece: ids[ab] for piece, ab in LOOK_SINGLES[part].items()}
    # 원래 재질 함수(갈래가 원래 그림일 때)
    default_fn = {'ground': lambda x, y: AT.sand_base(x, y, 3), 'road': lambda x, y: AT.road(x, y, 5), 'plaza': lambda x, y: AT.flag(x, y, 7)}
    deco_fn = {'road': AT.deco_road, 'grass': AT.deco_grass, 'dune': AT.deco_dune, 'flag': AT.deco_flag}
    seeds = {'road': 51, 'grass': 63, 'dune': 89, 'flag': 97}
    amps = {'road': 0.42, 'grass': 0.42, 'dune': 0.4, 'flag': 0.0}
    for sid, (pa, pb) in WANG.items():
        opts = [LOOK_PARTS[pa]] + ([LOOK_PARTS[pb]] if pb and pb != pa else [])
        for combo in itertools.product(*opts):
            look = dict(zip([pa] + ([pb] if pb and pb != pa else []), combo))
            if not any(look.values()): continue
            if any(v and (k, v) not in tex for k, v in look.items()): continue
            if any(look.get(pa) == g_ and look.get(pb) in bad for g_, bad in CLASH.items()): continue
            name = '+'.join(v for v in combo if v)
            # 이 조합의 이름은 갈래 순서대로 고른 재질만 잇는다(빈 갈래는 뺀다) — 구성기(desertPaletteFromTileset)와 같은 규칙

            def side_rgb(part, x, y, fallback):
                """part 갈래의 이 화소 — 새 재질이면 재질 칸 화소, 아니면 원래 함수의 색."""
                v = look.get(part)
                if v: return tuple(int(c) for c in tex[(part, v)][0][y % 16, x % 16, :3])
                m_, t_ = fallback(x, y)
                return rgb(m_, t_)

            def remap(part, mt):
                """꾸밈 화소(원래 재질 램프의 색)를 그 쪽 새 재질의 가장 가까운 밝기 색으로. 다른 램프(풀·물·흙 둑)는 그대로."""
                v = look.get(part) if part else None
                if not v or mt[0] not in DEFAULT_RAMPS[part]: return rgb(*mt)
                # 그 재질의 바탕 램프(가장 많이 쓴 색의 램프) 전체 단에서 고른다 — 재질 칸의 작은 강조색(청록 별 등)이 가장자리 선으로 번지지 않게
                l0 = lum(rgb(*mt))
                return min(body[(part, v)], key=lambda c: abs(lum(c) - l0))
            fa = default_fn[pa]
            fb = {'road': default_fn['road'], 'grass': lambda x, y: AT.grass(x, y, 5), 'dune': AT.dune_top, 'flag': default_fn['plaza']}[sid]
            pb_ = pb if pb else None
            tiles16 = []
            for idx in range(16):
                cn = (idx & 1, (idx >> 1) & 1, (idx >> 2) & 1, (idx >> 3) & 1)
                isB = lambda x, y, cn=cn: AT.field(cn, min(15, max(0, x)), min(15, max(0, y)), seeds[sid], amps[sid]) > 0.5
                arr = np.zeros((16, 16, 4), np.uint8)
                for y in range(16):
                    for x in range(16):
                        b = isB(x, y)
                        r = deco_fn[sid](b, x, y, lambda dx, dy: isB(x + dx, y + dy))
                        if r is not None: c = remap(pb_ if b else pa, r)
                        elif b:
                            c = side_rgb(pb_, x, y, fb) if pb_ else rgb(*fb(x, y))
                            if sid == 'dune' and look.get('ground'): c = remap('ground', fb(x, y))
                        else: c = side_rgb(pa, x, y, fa)
                        arr[y, x, :3] = c; arr[y, x, 3] = 255
                tiles16.append(emit(f'de-look-{sid}-{name.replace("+", "-")}-{idx}', Image.fromarray(arr, 'RGBA')))
            wang.setdefault(sid, {})[name] = tiles16
    return dict(parts=LOOK_PARTS, clash=CLASH, tiles=tiles, wang=wang, pieces=pieces)


def C_hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
