"""마법 학교(wizarding_world) 공간 조립 레시피 → src/assets/wizardingSpaceSpec.json.

조수 도구 build_wizarding_space(src/editor/tools/wizardingSpaceTools.ts) 가 이 사양으로 방·야외 한 장을 결정론으로 짓는다.
조립 규칙은 src/editor/wizarding/builder.ts(순수 함수). 이 파일은 «어느 공간에 무엇을 어디에» 만 적는다.

  python3 scripts/content/wizarding/space_recipes.py          # 사양을 쓴다
  python3 scripts/content/wizarding/space_recipes.py --check  # 쓰지 않고 빠진 id 만 본다

공간 키 = wzlib.SPACES 13개. 재료 id 는 굽기 산출물(src/assets/wizardingWorldTileset.json)의 키트(structureKits)·
1×1 반복 조각(tileGroups `wz:floor:<id>`)·오토타일(autotileGroups) 중 하나여야 한다. 아직 굽지 않은 id(다른 작업자가 그리는 중인
러너·융단 등)는 경고를 찍고 사양에서 뺀다 — 다시 굽고 이 스크립트를 다시 돌리면 들어간다.

가구 항목:
  kit         키트 id(주 조각)
  placement   north-wall | side-wall | free | center | corner | grid | edge | beside
              grid = 큰 가구를 가운데 통로 좌우 대칭 열·줄로 / edge = 벽에 붙은 2~4개 덩이 / beside = near 키트 곁 2~4개 덩이
              홀로 선 1×1(free·center)은 방마다 2개까지만 놓인다
  count       [최소, 최대] — 밀도(sparse/normal/full)와 넓이로 그 사이에서 정한다
  clearance   주 조각 둘레에 다른 가구가 들어오지 못하는 칸 수
  wallTop     north-wall 만: 조각 윗줄 y(0~4). 4 = 벽 앞 바닥, 1~3 = 벽면에 걸침(벽 위 4층에 그린다)
  wallMatch   north-wall 만: 'plain'(창·문이 아닌 벽 위) | 'window'(창 위) — 그 열의 북벽 조각 종류
  side        side-wall 만: 'w' | 'e' (생략하면 양쪽)
  on          'floor'(기본) | 'ground'(숲 바닥, 공터 밖) | 'water'(호수 물 위)
  access      false 면 앞 칸 도달을 요구하지 않는다(나무·보트·장식)
  with        [[키트 id, dx, dy], ...] 함께 찍는 짝(의자·그림자·탁상 소품). under=True 짝은 주 조각보다 먼저 찍는다
  near        beside(가구)·덧그림: 이 키트들 곁에만 놓는다
  gap         grid: 열·줄 사이 빈 칸 수 / rowsFrom grid: 'north' 면 북벽에 붙여 시작 / alt grid: 같은 크기 다른 그림(30%)

바닥·벽 밝기 관문: 실내 공간마다 바닥과 북벽 벽면의 평균 밝기 차가 CONTRAST_MIN(35) 미만이면 사양을 쓰지 않는다.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import wzlib  # noqa: E402  (SPACES 키)

TILESET = os.path.join(ROOT, 'src', 'assets', 'wizardingWorldTileset.json')
CHARSETS = os.path.join(ROOT, 'src', 'assets', 'wizardingCharsets.json')
OUT = os.path.join(ROOT, 'src', 'assets', 'wizardingSpaceSpec.json')
SHEET = os.path.join(ROOT, 'public', 'assets', 'wizarding-world', 'wizarding-world-chipset.png')
CONTRAST_MIN = 35  # 실내 바닥과 북벽 벽면의 평균 밝기 차 하한(0~255). 못 넘으면 굽지 않는다.

# ───────────────────────── 벽 묶음 (실내 고리) ─────────────────────────
# n 북벽(1×4 가로 반복) · nw/ne 북쪽 모서리 · w/e 서·동 벽(세로 반복) · s 남벽(가로 반복) · sw/se 남쪽 모서리
# door1/door2 북벽 문(열림 상태 — 통행) · doorS 남벽 출입구. 없는 자리는 생략(모서리는 n·s, 남쪽 문은 틈).
# capSouth: 남벽은 윗면(천장 끝) 한 줄만 쓴다 — 3/4 시점에서 방 남벽의 정면·창은 보이지 않는다(사용자 2026-10-07 「방 구조가 허접」:
# 아래에 창 달린 벽 정면이 있으면 건물을 반으로 자른 단면처럼 보였다). 이때 남쪽 문은 doorS 대신 바닥 틈.
WALLSETS = {
    'castle': dict(ko='성채 석벽', n='wz-castle-wall-n', nw='wz-castle-wall-nw', ne='wz-castle-wall-ne',
                   w='wz-castle-wall-w', e='wz-castle-wall-e', s='wz-castle-wall-s', sw='wz-castle-wall-sw', se='wz-castle-wall-se',
                   door1='wz-castle-door1-open', door2='wz-castle-door2-open', doorS='wz-castle-door-s',
                   rhythm=['n', 'n', 'wz-castle-wall-n-window', 'n', 'n', 'wz-castle-wall-n-pillar'],
                   sRhythm=['s'], capSouth=True),
    'infirmary': dict(ko='병동 석회벽', n='wz-inf-wall-n', nw='wz-inf-wall-nw', ne='wz-inf-wall-ne',
                      w='wz-inf-wall-w', e='wz-inf-wall-e', s='wz-inf-wall-s', sw='wz-inf-wall-sw', se='wz-inf-wall-se',
                      door1='wz-inf-door-open', rhythm=['n', 'wz-inf-wall-n-window-big', 'n', 'wz-inf-wall-n-window'], sRhythm=['s'], capSouth=True),
    'greenhouse': dict(ko='온실 철틀 유리벽', n='wz-gh-wall-n', nw='wz-gh-corner-nw', ne='wz-gh-corner-ne',
                       w='wz-gh-side-w', e='wz-gh-side-e', s='wz-gh-wall-s', sw='wz-gh-corner-sw', se='wz-gh-corner-se',
                       door1='wz-gh-door-open', rhythm=['n', 'wz-gh-roof', 'n', 'wz-gh-vent-closed', 'wz-gh-roof'], sRhythm=['s']),
    'owlery': dict(ko='부엉이 탑 돌벽', n='wz-owl-wall-n', w='wz-owl-wall-w', e='wz-owl-wall-e', s='wz-owl-wall-s',
                   door1='wz-owl-door-open',
                   rhythm=['n', 'wz-owl-window', 'n', 'wz-owl-wall-n-stained', 'wz-owl-window-bare', 'n', 'wz-owl-wall-n-beam'], sRhythm=['s'], capSouth=True),
    'owlcastle': dict(ko='부엉이 탑(성채 석벽 + 비행 창)', n='wz-castle-wall-n', nw='wz-castle-wall-nw', ne='wz-castle-wall-ne',
                      w='wz-castle-wall-w', e='wz-castle-wall-e', s='wz-castle-wall-s', sw='wz-castle-wall-sw', se='wz-castle-wall-se',
                      door1='wz-owl-door-open', door2='wz-castle-door2-open', doorS='wz-castle-door-s',
                      rhythm=['n', 'n', 'wz-owl-window', 'n', 'n', 'wz-castle-wall-n-pillar', 'n', 'wz-owl-window-bare'], sRhythm=['s'], capSouth=True),
    'postoffice': dict(ko='우체국 목재 벽', n='wz-post-iwall', w='wz-post-ibeam', e='wz-post-ibeam', s='wz-post-wainscot', sw='wz-post-ibeam', se='wz-post-ibeam',
                       rhythm=['n'], sRhythm=['s']),
    'honeydukes': dict(ko='지하 창고 오크 보 벽', n='wz-hd-wall-n', w='wz-castle-wall-w', e='wz-castle-wall-e',
                       s='wz-castle-wall-s', sw='wz-castle-wall-sw', se='wz-castle-wall-se', door1='wz-hd-panel-open', doorS='wz-castle-door-s',
                       rhythm=['n'], sRhythm=['s'], capSouth=True),
    'pitch': dict(ko='경기장 터널 벽·울타리', n='wz-qd-tunnel-wall4', w='wz-qd-fence-v', e='wz-qd-fence-v',
                  s='wz-qd-fence-g', sw='wz-qd-fence-corner-sw', se='wz-qd-fence-corner-se',
                  door1='wz-qd-tunnel-arch', door2='wz-qd-door-open', northFloor='wz-qd-flag', rhythm=['n'],
                  sRhythm=['wz-qd-fence-g'] * 3 + ['wz-qd-fence-s'] * 3 + ['wz-qd-fence-r'] * 3 + ['wz-qd-fence-h'] * 3),
}

CASTLE_RUNNER = dict(ns='wz-castle-runner-ns', ew='wz-castle-runner-ew', nEnd='wz-castle-runner-n-end', sEnd='wz-castle-runner-s-end')


def F(kit, placement, lo, hi, clearance=1, **kw):
    d = dict(kit=kit, placement=placement, count=[lo, hi], clearance=clearance)
    for k, v in kw.items():
        if v is not None: d[k] = v
    return d


def D(kit, lo, hi, near=None):
    d = dict(kit=kit, count=[lo, hi])
    if near: d['near'] = list(near)
    return d


TREES = ['wz-nat-conifer-large', 'wz-nat-conifer-small', 'wz-nat-broadleaf-old', 'wz-nat-twisted-old']


BANNERS = [F(b, 'north-wall', 0, 1, 0, wallTop=1, wallMatch='plain') for b in
           ('wz-furn-banner-lion', 'wz-furn-banner-snake', 'wz-furn-banner-eagle', 'wz-furn-banner-badger')]
SCONCE = F('wz-castle-sconce', 'north-wall', 2, 4, 0, wallTop=2, wallMatch='plain')
CURTAINS = F('wz-furn-curtain-open', 'north-wall', 0, 2, 0, wallTop=1, wallMatch='window')
TABLE_CHAIRS = F('wz-furn-table-small', 'center', 1, 1, 1, with_=[['wz-castle-rug-red', 0, 0, True], ['wz-furn-chair-back-left', -1, 0], ['wz-furn-chair-back-right', 2, 0],
                                                                    ['wz-furn-prop-book-open', 0, 0], ['wz-furn-prop-inkwell', 1, 0]])
# 탁상 소품은 탁자마다 다르게(vary) — 같은 소품이 모든 탁자에 찍히면 도장 찍은 것처럼 보인다.
LONG_TABLE = F('wz-furn-bench-long', 'grid', 8, 12, 0, gap=1, with_=[['wz-furn-bench-seat', 0, -1], ['wz-furn-bench-seat', 0, 2]],
               vary=[[['wz-furn-prop-bottles', 1, 0]], [['wz-inf-candle', 0, 0], ['wz-furn-prop-bottles', 2, 0]],
                     [['wz-furn-prop-book-closed', 2, 0]], [['wz-inf-candle', 1, 0]], []])
# 도서관 열람 탁자: 의자 둘 + 탁상 소품 하나
READ_TABLE = F('wz-furn-table-small', 'grid', 2, 4, 0, gapX=3, gapY=1, with_=[['wz-furn-chair-back-left', -1, 0], ['wz-furn-chair-back-right', 2, 0]],
               vary=[[['wz-furn-prop-book-open', 0, 0], ['wz-furn-prop-inkwell', 1, 0]], [['wz-furn-prop-scroll', 0, 0], ['wz-furn-prop-quill', 1, 0]],
                     [['wz-furn-prop-book-closed', 1, 0]], [['wz-inf-candle', 0, 0], ['wz-furn-prop-book-open', 1, 0]]])
SLATE = dict(tile='wz-castle-floor-flag')

SPACES = {
    # ───────────── 실내 ─────────────
    'shared': dict(
        ko='성채 대연회장(공용 홀)', indoor=True, layout='room', wall='castle',
        size=dict(min=[16, 12], default=[30, 22], max=[48, 40]),
        floor=dict(autotile='wz-castle-flag'), runner=CASTLE_RUNNER,
        defaultDoors=[dict(side='s', kind='double'), dict(side='n', kind='double')],
        furniture=[F('wz-furn-fireplace', 'north-wall', 1, 2, 1, wallTop=1, wallMatch='plain'),
                   LONG_TABLE, *BANNERS, CURTAINS, SCONCE,
                   F('wz-furn-candlestick', 'beside', 2, 2, 0, near=['wz-furn-fireplace']),
                   F('wz-furn-barrel', 'edge', 0, 2, 0)],
        decals=[], npcSpaces=['shared'], npcWords=['학생', '교수', '관리인'],
        variants=dict(
            corridor=dict(ko='성채 복도', size=dict(min=[8, 16], default=[10, 22], max=[16, 48]),
                          floor=dict(autotile='wz-castle-flag'), defaultDoors=[dict(side='s'), dict(side='n')],
                          furniture=[*BANNERS, CURTAINS, F('wz-castle-sconce', 'north-wall', 1, 2, 0, wallTop=2, wallMatch='plain'),
                                     F('wz-furn-candlestick', 'side-wall', 1, 3, 1), F('wz-furn-barrel', 'corner', 0, 1, 0)]),
            common=dict(ko='기숙사 휴게실', size=dict(min=[16, 12], default=[20, 14], max=[40, 30]),
                        floor=SLATE, runner=None, defaultDoors=[dict(side='s')],
                        furniture=[F('wz-furn-fireplace', 'north-wall', 1, 1, 1, wallTop=1, wallMatch='plain'),
                                   F('wz-furn-bookshelf', 'north-wall', 1, 3, 0, wallTop=1, wallMatch='plain'),
                                   TABLE_CHAIRS, *BANNERS, CURTAINS,
                                   F('wz-furn-bookshelf-low', 'north-wall', 1, 2, 0, wallTop=3),
                                   F('wz-furn-cabinet-closed', 'north-wall', 0, 1, 1, wallTop=3),
                                   F('wz-furn-crate-stack', 'corner', 1, 1, 0),
                                   F('wz-furn-barrel', 'beside', 1, 2, 0, near=['wz-furn-crate-stack']),
                                   F('wz-furn-candlestick', 'beside', 2, 2, 0, near=['wz-furn-fireplace']),
                                   F('wz-furn-lantern-hanging', 'north-wall', 0, 2, 0, wallTop=2, wallMatch='plain')]),
        )),
    'owlery': dict(
        ko='부엉이 탑', indoor=True, layout='room', wall='owlcastle',
        size=dict(min=[16, 12], default=[22, 16], max=[40, 30]), floor=SLATE,
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-owl-mailbox', 'north-wall', 1, 1, 1, wallTop=3),
                   F('wz-owl-perch-1x3', 'north-wall', 1, 3, 1, wallTop=2),
                   F('wz-owl-perch-2x3', 'grid', 6, 8, 0, gap=1),
                   F('wz-owl-stair-up', 'corner', 0, 1, 1, access=False),
                   F('wz-owl-water-dish', 'beside', 1, 2, 0, near=['wz-owl-perch-2x3']),
                   F('wz-owl-mail-sack', 'beside', 1, 2, 0, near=['wz-owl-mailbox'])],
        decals=[D('wz-owl-droppings', 2, 4, near=['wz-owl-perch-2x3', 'wz-owl-perch-1x3']), D('wz-owl-feathers', 2, 4, near=['wz-owl-perch-2x3']),
                D('wz-owl-straw', 2, 4, near=['wz-owl-perch-1x3', 'wz-owl-window']), D('wz-owl-pellets', 1, 2, near=['wz-owl-perch-2x3']),
                D('wz-owl-letters', 1, 2, near=['wz-owl-mailbox'])],
        npcSpaces=['owlery'], npcWords=['부엉이', '우편']),
    'potions': dict(
        ko='지하 마법약 교실', indoor=True, layout='room', wall='castle',
        size=dict(min=[16, 12], default=[24, 17], max=[40, 30]), floor=SLATE,
        doors=dict(door2='wz-pot-door-open'), rhythm=['n', 'n', 'wz-pot-vault-arch-pillar', 'n', 'n', 'wz-castle-wall-n-window'],
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-pot-hood', 'north-wall', 1, 2, 0, wallTop=1, wallMatch='plain'),
                   F('wz-pot-shelf', 'north-wall', 1, 2, 0, wallTop=1, wallMatch='plain'),
                   F('wz-nv-pot-teaching-kit-blackboard', 'north-wall', 0, 1, 0, wallTop=2, wallMatch='plain'),
                   F('wz-pot-herb-hanger', 'north-wall', 1, 2, 0, wallTop=1, wallMatch='plain'),
                   F('wz-pot-wall-lamp', 'north-wall', 1, 3, 0, wallTop=2, wallMatch='plain'),
                   F('wz-pot-cauldron-bench-green', 'grid', 6, 8, 0, gapX=2, gapY=1, alt=['wz-pot-cauldron-bench-violet']),
                   F('wz-pot-basin', 'north-wall', 0, 1, 1, wallTop=4),
                   F('wz-nv-pot-ingredient-storage-drawers', 'side-wall', 1, 2, 0),
                   F('wz-nv-pot-ingredient-storage-dried-herbs', 'side-wall', 0, 2, 0),
                   F('wz-pot-prep-bench', 'edge', 1, 2, 0, with_=[['wz-pot-mortar', 0, 0], ['wz-pot-knife-board', 1, 0]]),
                   F('wz-pot-root-basket', 'beside', 1, 2, 0, near=['wz-pot-prep-bench'])],
        decals=[D('wz-pot-stain-violet', 1, 3, near=['wz-pot-cauldron-bench-violet']), D('wz-pot-stain-green', 1, 3, near=['wz-pot-cauldron-bench-green'])],
        npcSpaces=['potions'], npcWords=['마법약']),
    'clocktower': dict(
        ko='시계탑 기어실', indoor=True, layout='room', wall='castle',
        size=dict(min=[16, 12], default=[18, 15], max=[40, 30]), floor=dict(tile='wz-clock-grate'),
        runner=dict(ns='wz-clock-floor-plate', ew='wz-clock-floor-plate'),
        doors=dict(door1='wz-clock-door-open'), rhythm=['n', 'n', 'wz-clock-wall-gear', 'n', 'wz-castle-wall-n-pillar'],
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-clock-dial-back', 'north-wall', 1, 1, 0, wallTop=0, wallMatch='plain'),
                   F('wz-clock-toolrack', 'north-wall', 1, 2, 0, wallTop=1, wallMatch='plain'),
                   F('wz-clock-gear-l-spin', 'corner', 1, 2, 1, access=False),
                   F('wz-clock-gear-m-spin', 'beside', 1, 2, 0, near=['wz-clock-gear-l-spin'], access=False),
                   F('wz-clock-gear-s-spin', 'beside', 1, 2, 0, near=['wz-clock-gear-m-spin', 'wz-clock-gear-l-spin'], access=False),
                   F('wz-clock-stair', 'corner', 0, 1, 1, access=False),
                   F('wz-clock-toolchest', 'edge', 1, 2, 0),
                   F('wz-clock-oilcan', 'beside', 1, 2, 0, near=['wz-clock-toolchest']),
                   F('wz-clock-stool', 'beside', 0, 1, 0, near=['wz-clock-toolchest'])],
        decals=[D('wz-clock-oil-a', 2, 3, near=['wz-clock-gear-l-spin', 'wz-clock-gear-m-spin']), D('wz-clock-oil-b', 1, 2, near=['wz-clock-oilcan'])],
        npcSpaces=[], npcWords=['정비사', '관리인', '교수']),
    'postoffice': dict(
        ko='호그스미드 부엉이 우체국(실내)', indoor=True, layout='room', wall='postoffice',
        size=dict(min=[16, 12], default=[20, 15], max=[36, 28]), floor=dict(tile='wz-post-floor'),
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-post-iwall-win', 'north-wall', 1, 3, 0, wallTop=1, wallMatch='plain', access=False),
                   F('wz-post-sort', 'grid', 2, 2, 0, gap=1, rowsFrom='north'),
                   F('wz-post-counter', 'center', 1, 1, 1, with_=[['wz-post-letters', 1, 0]]),
                   F('wz-post-perch', 'beside', 1, 2, 0, near=['wz-post-sort']),
                   F('wz-post-sack', 'beside', 1, 1, 0, near=['wz-post-counter']),
                   F('wz-post-parcels', 'beside', 1, 2, 0, near=['wz-post-counter', 'wz-post-sack']),
                   F('wz-post-parcel', 'beside', 1, 2, 0, near=['wz-post-parcels']),
                   F('wz-furn-crate-stack', 'corner', 0, 1, 0)],
        decals=[D('wz-post-letters', 1, 3, near=['wz-post-sort'])],
        npcSpaces=['postoffice'], npcWords=['우편', '부엉이', '배달']),
    'wandshop': dict(
        ko='다이애건 앨리 지팡이 가게', indoor=True, layout='room', wall='castle',
        size=dict(min=[16, 12], default=[20, 15], max=[36, 28]), floor=dict(tile='wz-wand-floor-oak'),
        doors=dict(door1='wz-wand-testdoor-open'), rhythm=['n', 'wz-wand-box-wall', 'n', 'wz-castle-wall-n-pillar', 'wz-wand-box-wall'],
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-nv-wand-wandtrial-shelves-west-run', 'side-wall', 0, 1, 0, side='w'),
                   F('wz-nv-wand-wandtrial-shelves-east-run', 'side-wall', 0, 1, 0, side='e'),
                   F('wz-nv-wand-wood-service-counter-counter', 'center', 1, 1, 1, with_=[['wz-wand-display-1', 0, 0], ['wz-wand-tape', 2, 0]]),
                   F('wz-nv-wand-wand-testing-table-height16-table', 'edge', 1, 2, 0),
                   F('wz-nv-wand-wandtrial-target-target', 'edge', 0, 1, 0),
                   F('wz-nv-wand-stock-ladder-ladder', 'north-wall', 0, 1, 0, wallTop=2, wallMatch='plain'),
                   F('wz-furn-cabinet-closed', 'north-wall', 0, 1, 1, wallTop=3),
                   F('wz-furn-candlestick', 'beside', 1, 2, 0, near=['wz-nv-wand-wood-service-counter-counter']),
                   F('wz-furn-crate-stack', 'corner', 1, 2, 0)],
        decals=[D('wz-wand-scorch-1', 1, 2, near=['wz-nv-wand-wandtrial-target-target', 'wz-nv-wand-wand-testing-table-height16-table']),
                D('wz-wand-scorch-2', 1, 2, near=['wz-nv-wand-wandtrial-target-target', 'wz-nv-wand-wand-testing-table-height16-table'])],
        npcSpaces=['wandshop'], npcWords=['지팡이']),
    'library': dict(
        ko='도서관 제한 구역', indoor=True, layout='room', wall='castle',
        size=dict(min=[16, 12], default=[24, 20], max=[40, 30]), floor=SLATE,
        doors=dict(door2='wz-lib-arch'), rhythm=['n', 'n', 'wz-castle-wall-n-pillar'],
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-lib-shelf-chain-3x3', 'north-wall', 1, 3, 0, wallTop=1, wallMatch='plain'),
                   F('wz-lib-shelf-chain-2x3', 'north-wall', 1, 2, 0, wallTop=1, wallMatch='plain'),
                   F('wz-lib-ladder', 'north-wall', 0, 2, 0, wallTop=2, wallMatch='plain'),
                   F('wz-lib-shelf-plain-2x3', 'grid', 14, 18, 0, gapX=0, gapY=1),
                   READ_TABLE,
                   F('wz-lib-record-table', 'edge', 1, 1, 0),
                   F('wz-lib-lectern', 'beside', 1, 1, 0, near=['wz-lib-record-table']),
                   F('wz-furn-bookshelf-low', 'side-wall', 0, 2, 0),
                   F('wz-furn-candlestick', 'beside', 1, 1, 0, near=['wz-lib-record-table'])],
        decals=[], npcSpaces=[], npcWords=['사서', '래번클로', '교수']),
    'greenhouse': dict(
        ko='온실(맨드레이크)', indoor=True, layout='room', wall='greenhouse',
        size=dict(min=[16, 12], default=[24, 17], max=[40, 30]), floor=SLATE,
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-gh-vine-wall', 'north-wall', 1, 4, 0, wallTop=0, wallMatch='plain', access=False),
                   F('wz-gh-earmuff-rack', 'north-wall', 1, 1, 0, wallTop=2, wallMatch='plain'),
                   F('wz-gh-workbench', 'grid', 6, 10, 0, gap=1, with_=[['wz-gh-mandrake-pulled-f', 1, 0]]),
                   F('wz-gh-earmuff-basket', 'beside', 1, 1, 0, near=['wz-gh-earmuff-rack']),
                   F('wz-gh-pot-row', 'beside', 1, 2, 0, near=['wz-gh-workbench']),
                   F('wz-gh-mandrake-pot', 'beside', 1, 3, 0, near=['wz-gh-workbench']),
                   F('wz-gh-pot-full', 'beside', 1, 2, 0, near=['wz-gh-workbench']),
                   F('wz-gh-watercan', 'beside', 1, 1, 0, near=['wz-gh-workbench']),
                   F('wz-gh-soilbox', 'edge', 1, 2, 0),
                   F('wz-gh-pot-empty', 'beside', 0, 2, 0, near=['wz-gh-soilbox']),
                   F('wz-gh-vine-bush', 'corner', 1, 2, 0, access=False),
                   F('wz-gh-toothflower', 'beside', 1, 2, 0, near=['wz-gh-vine-bush']),
                   F('wz-gh-purplethorn', 'beside', 0, 2, 0, near=['wz-gh-vine-bush']),
                   F('wz-gh-tentaclevine', 'beside', 0, 2, 0, near=['wz-gh-vine-bush'])],
        decals=[D('wz-gh-soil-a', 1, 3, near=['wz-gh-workbench', 'wz-gh-soilbox']), D('wz-gh-soil-b', 1, 2, near=['wz-gh-soilbox']),
                D('wz-gh-water-a', 1, 2, near=['wz-gh-watercan']), D('wz-gh-shovel', 0, 1, near=['wz-gh-soilbox'])],
        npcSpaces=['greenhouse'], npcWords=['약초', '온실', '후플푸프']),
    'infirmary': dict(
        ko='병동', indoor=True, layout='room', wall='infirmary',
        size=dict(min=[16, 12], default=[26, 18], max=[40, 30]), floor=dict(tile='wz-castle-floor-oak'),
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-inf-chart', 'north-wall', 1, 3, 0, wallTop=2, wallMatch='plain'),
                   F('wz-inf-bed-empty', 'grid', 4, 6, 0, gap=1, rowsFrom='north', alt=['wz-inf-bed-patient'],
                     with_=[['wz-inf-bed-shadow', 0, 0, True], ['wz-inf-curtain-closed', 2, 0]]),
                   F('wz-inf-shelf', 'side-wall', 1, 1, 0),
                   F('wz-inf-table', 'beside', 1, 2, 0, near=['wz-inf-bed-empty', 'wz-inf-bed-patient'], with_=[['wz-inf-candle', 0, 1]]),
                   F('wz-inf-cart', 'edge', 1, 2, 0),
                   F('wz-inf-basin', 'beside', 1, 1, 0, near=['wz-inf-cart']),
                   F('wz-inf-screen', 'edge', 0, 1, 0)],
        decals=[D('wz-inf-bandage', 1, 2, near=['wz-inf-cart']), D('wz-inf-splint', 0, 2, near=['wz-inf-cart'])],
        npcSpaces=['infirmary'], npcWords=['치료', '환자']),
    'honeydukes': dict(
        ko='허니듀크 지하 창고', indoor=True, layout='room', wall='honeydukes',
        size=dict(min=[16, 12], default=[18, 14], max=[36, 28]), floor=dict(tile='wz-hd-floor-sugar-a'),
        defaultDoors=[dict(side='s')],
        furniture=[F('wz-hd-stairs-down', 'north-wall', 1, 1, 1, wallTop=2, wallMatch='plain'),
                   F('wz-hd-shelf', 'north-wall', 1, 3, 0, wallTop=2, wallMatch='plain'),
                   F('wz-hd-workbench', 'center', 1, 2, 1, with_=[['wz-hd-jar-red', 0, 0], ['wz-hd-box-frog', 1, 0], ['wz-hd-scale', 1, 1], ['wz-hd-jar-green', 2, 0]]),
                   F('wz-hd-stack-2x2', 'corner', 1, 2, 0),
                   F('wz-hd-stack-1x2', 'beside', 1, 3, 0, near=['wz-hd-stack-2x2']),
                   F('wz-hd-tub', 'edge', 1, 2, 0),
                   F('wz-hd-box-beans', 'beside', 0, 2, 0, near=['wz-hd-workbench']),
                   F('wz-hd-jar-violet', 'beside', 0, 2, 0, near=['wz-hd-shelf'])],
        decals=[D('wz-hd-floor-packing', 2, 3, near=['wz-hd-workbench']), D('wz-hd-paper-roll', 1, 2, near=['wz-hd-workbench']),
                D('wz-hd-twine-ball', 0, 2, near=['wz-hd-workbench'])],
        npcSpaces=['honeydukes'], npcWords=['포장', '사탕']),
    # ───────────── 야외 ─────────────
    'carriage': dict(
        ko='금지된 숲 세스트랄 마차 승차장', indoor=False, layout='forest',
        size=dict(min=[16, 12], default=[30, 22], max=[64, 48]),
        floor=dict(tile='wz-nat-forest-floor-a'),
        ground=dict(clearing='wz-nat-dirt', band=4,
                    border=['wz-nat-conifer-large', 'wz-nat-conifer-small', 'wz-nat-broadleaf-old', 'wz-nat-twisted-old',
                            'wz-nat-conifer-small', 'wz-nat-bush-wide', 'wz-nat-rock-moss-big', 'wz-nat-bush']),
        defaultDoors=[dict(side='s', kind='double'), dict(side='n', kind='double')],
        furniture=[F('wz-car-carriage-down', 'center', 1, 1, 1, with_=[['wz-car-harness-s', 1, 5], ['wz-cre-thestral-harness', 0, 7]]),
                   F('wz-car-carriage-right', 'free', 0, 1, 1),
                   F('wz-car-canopy', 'free', 1, 1, 1),
                   F('wz-car-lantern-post', 'beside', 2, 2, 0, near=['wz-car-canopy']),
                   F('wz-car-noticeboard', 'beside', 1, 1, 0, near=['wz-car-canopy']),
                   F('wz-car-harness-hook', 'beside', 0, 1, 0, near=['wz-car-noticeboard']),
                   F('wz-car-trunk', 'beside', 1, 3, 0, near=['wz-car-carriage-down', 'wz-car-carriage-right']),
                   F('wz-cre-thestral-down', 'free', 0, 1, 1, access=False)],
        decals=[D('wz-nat-fern-a', 2, 5, near=TREES), D('wz-nat-fern-b', 1, 4, near=TREES), D('wz-nat-mushrooms', 1, 3, near=TREES),
                D('wz-nat-leaves-a', 2, 5, near=TREES), D('wz-nat-leaves-b', 1, 3, near=TREES), D('wz-nat-grass-tuft', 1, 3, near=TREES)],
        npcSpaces=['carriage'], npcWords=['마차', '여행']),
    'quidditch': dict(
        ko='퀴디치 경기장·선수 터널', indoor=False, layout='room', wall='pitch',
        size=dict(min=[16, 12], default=[32, 24], max=[64, 48]), floor=dict(tile='wz-qd-grass-a'),
        defaultDoors=[dict(side='n'), dict(side='s', kind='double')],
        furniture=[F('wz-qd-goal-kit', 'center', 1, 1, 1, access=False),
                   F('wz-qd-mark-circle', 'free', 1, 1, 1, access=False),
                   F('wz-qd-locker-g', 'north-wall', 1, 1, 0, wallTop=4),
                   F('wz-qd-locker-s', 'beside', 1, 1, 0, near=['wz-qd-locker-g']),
                   F('wz-qd-locker-r', 'beside', 1, 1, 0, near=['wz-qd-locker-s']),
                   F('wz-qd-locker-h', 'beside', 1, 1, 0, near=['wz-qd-locker-r']),
                   F('wz-qd-broom-rack', 'beside', 1, 1, 0, near=['wz-qd-locker-h', 'wz-qd-locker-r']),
                   F('wz-qd-ball-crate-open', 'beside', 1, 1, 0, near=['wz-qd-broom-rack']),
                   F('wz-qd-target', 'side-wall', 1, 3, 1)],
        decals=[D('wz-qd-ball-quaffle', 1, 1, near=['wz-qd-ball-crate-open']), D('wz-qd-ball-bludger', 1, 2, near=['wz-qd-ball-crate-open']),
                D('wz-qd-broom-lying', 1, 1, near=['wz-qd-broom-rack'])],
        npcSpaces=['quidditch'], npcWords=['퀴디치', '교수']),
    'boathouse': dict(
        ko='검은 호수 보트 창고', indoor=False, layout='lake',
        size=dict(min=[16, 12], default=[30, 22], max=[64, 48]), floor=dict(tile='wz-lake-pebble'),
        ground=dict(shore='wz-lake-shore-edge-n', shallow='wz-lake-water-shallow', deep='wz-lake-water-deep',
                    boathouse=['wz-lake-boathouse', 'wz-lake-boathouse-5'], ramp='wz-lake-ramp',
                    dock=dict(v='wz-lake-dock-v', end='wz-lake-dock-end', band='wz-lake-dock-band', piles='wz-lake-dock-piles'),
                    landFrac=0.42, docks=2),
        defaultDoors=[dict(side='w'), dict(side='s')],
        furniture=[F('wz-lake-lamp-post', 'beside', 1, 2, 0, near=['wz-lake-dock-v']),
                   F('wz-lake-bollard', 'beside', 1, 3, 0, near=['wz-lake-dock-v']),
                   F('wz-lake-ropehook', 'beside', 1, 1, 0, near=['wz-lake-boathouse', 'wz-lake-boathouse-5']),
                   F('wz-furn-crate-a', 'beside', 1, 2, 0, near=['wz-lake-boathouse', 'wz-lake-boathouse-5']),
                   F('wz-furn-barrel', 'beside', 1, 2, 0, near=['wz-furn-crate-a']),
                   F('wz-lake-boat-right', 'free', 1, 1, 1, on='water', access=False),
                   F('wz-lake-boat-up-oars', 'free', 1, 2, 1, on='water', access=False),
                   F('wz-nat-reeds-big', 'edge', 0, 2, 0, on='water', access=False)],
        decals=[D('wz-lake-oar-crossed', 0, 1, near=['wz-lake-boathouse', 'wz-lake-boathouse-5']), D('wz-lake-oar-single', 1, 1, near=['wz-lake-boathouse', 'wz-lake-boathouse-5']),
                D('wz-lake-plank-wet', 1, 3, near=['wz-lake-ramp', 'wz-lake-dock-v'])],
        npcSpaces=['boathouse'], npcWords=['보트', '노']),
}


def load_tileset():
    with open(TILESET, encoding='utf-8') as f:
        return json.load(f)


def resolver(ts):
    kits = {k['id']: k for k in ts['structureKits']}
    groups = {g['id'][len('wz:floor:'):]: g for g in ts['tileGroups'] if g['id'].startswith('wz:floor:')}
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
    """실내 공간마다 바닥(타일·오토타일 가운데·섞는 타일)과 북벽 벽면(n 키트 둘째 줄부터) 평균 밝기를 잰다."""
    from PIL import Image
    sheet = Image.open(SHEET).convert('RGBA')
    per = ts['tilesPerRow']; size = ts['tileSize']
    kits = {k['id']: k for k in ts['structureKits']}
    groups = {g['id'][len('wz:floor:'):]: g for g in ts['tileGroups'] if g['id'].startswith('wz:floor:')}
    autos = {a['id']: a for a in ts['autotileGroups']}

    def lum(tids):
        tot = n = 0
        for t in tids:
            if t is None or t < 0: continue
            im = sheet.crop(((t % per) * size, (t // per) * size, (t % per + 1) * size, (t // per + 1) * size))
            px = im.tobytes()
            for i in range(0, len(px), 4):
                r, g, b, a = px[i], px[i + 1], px[i + 2], px[i + 3]
                if a < 128: continue
                tot += 0.299 * r + 0.587 * g + 0.114 * b; n += 1
        return tot / n if n else 0.0

    def piece_tiles(pid):
        if pid in kits: return [t for row in kits[pid]['rows'] for t in row['tiles']]
        if pid in groups: return groups[pid]['tileIds'][:1]
        if pid in autos: return [autos[pid]['variantMap'].get('255', autos[pid]['memberTileIds'][0])]
        return []

    def wall_face(wid):
        k = kits[wallsets[wid]['n']]
        tids = []
        for row in k['rows'][1:]:
            for lo, up in zip(row['tiles'], row.get('upperTiles') or [-1] * len(row['tiles'])):
                tids.append(up if up is not None and up >= 0 else lo)
        return lum(tids)

    rows = []
    for key, sp in spaces.items():
        if not sp.get('indoor'): continue
        jobs = [(key, sp['floor'], sp['wall'])]
        for vid, v in (sp.get('variants') or {}).items():
            jobs.append((f'{key}.{vid}', v.get('floor') or sp['floor'], v.get('wall', sp['wall'])))
        for name, fl, wid in jobs:
            fk = fl.get('autotile') or fl.get('tile')
            tids = piece_tiles(fk) + [t for m in fl.get('mix', []) for t in piece_tiles(m)]
            f, w = lum(tids), wall_face(wid)
            rows.append((name, fk, wid, f, w, abs(w - f)))
    return rows


def npc_suggestions(charsets, spaces, words):
    out = []
    for c in charsets['characters']:
        hit = c['space'] in spaces or any(w in c['name'] or w in c['desc'] for w in words)
        if hit:
            out.append(dict(id=c['id'], name=c['name'], desc=c['desc'][:60], textureKey=f"tex_oprn_charset_wizarding{c['sheet']}",
                            resourceId=f"oprn-charset-wizarding{c['sheet']}", characterIndex=c['index']))
    return out[:8]


def main(check=False):
    ts = load_tileset()
    info = resolver(ts)
    with open(CHARSETS, encoding='utf-8') as f:
        charsets = json.load(f)
    warnings = []
    used = {}

    def ok(pid, where):
        i = info(pid)
        if i is None:
            warnings.append(f'{where}: {pid} 없음(건너뜀)')
            return False
        used[pid] = i
        return True

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
            if 'vary' in it:
                it['vary'] = [[dict(kit=w[0], dx=w[1], dy=w[2]) for w in vs if ok(w[0], f"{where}/{it['kit']}.vary")] for vs in it['vary']]
            if 'with' in it:
                kept = []
                for w in it['with']:
                    if ok(w[0], f"{where}/{it['kit']}"):
                        kept.append(dict(kit=w[0], dx=w[1], dy=w[2], **({'under': True} if len(w) > 3 and w[3] else {})))
                it['with'] = kept
            out.append(it)
        return out

    def clean_floor(fl, where):
        if fl is None: return None
        out = dict(fl)
        key = 'autotile' if 'autotile' in fl else 'tile'
        if not ok(fl[key], where): return None
        if 'mix' in fl: out['mix'] = [m for m in fl['mix'] if ok(m, where)]
        return out

    wallsets = {}
    for wid, ws in WALLSETS.items():
        o = {}
        for k, v in ws.items():
            if k in ('rhythm', 'sRhythm'):
                o[k] = [r for r in v if r in ('n', 's') or ok(r, f'벽 {wid}.{k}')]
            elif k == 'ko': o[k] = v
            elif k == 'capSouth': continue
            elif ok(v, f'벽 {wid}.{k}'): o[k] = v
        for need in ('n', 'w', 'e', 's'):
            if need not in o: raise SystemExit(f'벽 묶음 {wid} 의 필수 조각 {need} 가 굽기에 없다')
        o['northRows'] = used[o['n']]['h']; o['southRows'] = 1 if ws.get('capSouth') else used[o['s']]['h']
        wallsets[wid] = o

    spaces = {}
    for key in wzlib.SPACES:
        if key not in SPACES: raise SystemExit(f'공간 {key} 레시피가 없다')
    for key, sp in SPACES.items():
        assert key in wzlib.SPACES, key
        o = {k: v for k, v in sp.items() if k not in ('furniture', 'decals', 'floor', 'runner', 'variants', 'npcSpaces', 'npcWords', 'doors', 'rhythm', 'ground')}
        o['spaceKo'] = wzlib.SPACES[key]
        o['floor'] = clean_floor(sp['floor'], key)
        if o['floor'] is None: raise SystemExit(f'{key} 바닥이 굽기에 없다')
        if sp.get('runner'):
            r = {k: v for k, v in sp['runner'].items() if ok(v, f'{key} 러너')}
            if 'ns' in r or 'ew' in r: o['runner'] = r
        if 'doors' in sp: o['doors'] = {k: v for k, v in sp['doors'].items() if ok(v, f'{key} 문')}
        if 'rhythm' in sp: o['rhythm'] = [r for r in sp['rhythm'] if r == 'n' or ok(r, f'{key} 북벽 리듬')]
        if 'ground' in sp:
            g = {}
            for k, v in sp['ground'].items():
                if isinstance(v, str): g[k] = v if ok(v, f'{key} 땅') else None
                elif isinstance(v, list) and all(isinstance(x, str) for x in v): g[k] = [x for x in v if ok(x, f'{key} 땅')]
                elif isinstance(v, dict): g[k] = {kk: vv for kk, vv in v.items() if ok(vv, f'{key} 부두')}
                else: g[k] = v
            o['ground'] = g
        o['furniture'] = clean_furniture(sp['furniture'], key)
        o['decals'] = []
        for d in sp['decals']:
            if not ok(d['kit'], f'{key} 덧그림'): continue
            d = dict(d)
            if 'near' in d:
                d['near'] = [x for x in d['near'] if ok(x, f"{key} 덧그림 {d['kit']}.near")]
                if not d['near']: del d['near']
            o['decals'].append(d)
        o['npcs'] = npc_suggestions(charsets, sp.get('npcSpaces', []), sp.get('npcWords', []))
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
    print(f"{'공간':<22}{'바닥':<26}{'벽':<12}{'바닥밝기':>8}{'벽밝기':>8}{'차':>7}")
    bad = []
    for name, fk, wid, f, w, d in table:
        flag = '' if d >= CONTRAST_MIN else '  ← 미달'
        print(f'{name:<22}{fk:<26}{wid:<12}{f:8.1f}{w:8.1f}{d:7.1f}{flag}')
        if d < CONTRAST_MIN: bad.append(name)
    if bad:
        raise SystemExit(f'바닥·벽 밝기 차 {CONTRAST_MIN} 미달: {", ".join(bad)} — 어두운 바닥(wz-castle-floor-flag·wz-castle-floor-oak)으로 바꿀 것')

    spec = dict(version=1, tilesetId='wizarding_world', tileCount=ts['count'],
                note='scripts/content/wizarding/space_recipes.py 가 굽는다(손 편집 금지). 조립 규칙 src/editor/wizarding/builder.ts.',
                wallsets=wallsets, spaces=spaces,
                pieces={k: dict(name=v['name'], w=v['w'], h=v['h'], src=v['src']) for k, v in sorted(used.items())},
                skipped=sorted(set(warnings)))
    for w in sorted(set(warnings)): print('경고', w)
    print(f'공간 {len(spaces)} · 벽 묶음 {len(wallsets)} · 쓰는 조각 {len(used)} · 건너뜀 {len(set(warnings))}')
    if not check:
        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump(spec, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('→', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main(check='--check' in sys.argv)
