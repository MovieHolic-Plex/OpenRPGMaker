# Rasak Fantasy(MZ 48px) 조수 지식 묶음 만들기 — 칸 이름표·재료 묶음·자동타일 그룹·참고문서(MD+그림).
#
# 조수는 타일셋 그림을 보지 않는다. 배우는 것은 타일셋에 붙은 글과 번호뿐이다(openwiki/teaching-assistant-tilesets.md):
#   tileMeta(칸 이름표, tile_query 로 검색) · tileGroups(재료 이름 도구) · autotileGroups(칠할 때 가장자리 모양) ·
#   referenceDocuments(칠하기 전에 용도의 MD 전 페이지와 그림을 전부 읽어야 한다 — tilesetReferenceEvidence.ts).
# 이 스크립트는 그 넷을 사용자 로컬 자료(팩에서 구운 아틀라스·이름표·재구성 프리뷰 4층 맵)로 만든다.
# 팩 그림은 재배포 금지라 결과물(그림이 든 JSON·PNG)은 저장소 밖에만 쓴다. 저장소에는 이 스크립트와 글만 둔다.
#
#   python3 scripts/content/rasak/build_assistant_pack.py \
#       --assets ~/third-party-assets/rasak --original /tmp/mzai/pack/original-tilesets.json --out /tmp/mzai/pack
#
# 입력(모두 사용자 로컬):
#   <assets>/knowledge/names.json, mz-autotile-masks.json   이름표·마스크 표(tiledata/rasak-fantasy/ 에 같은 글 사본)
#   <assets>/baked/<묶음>/atlas.layers.png, manifest.layers.json   연구 프로젝트가 쓰는 4층용 아틀라스
#   <assets>/maps/rasak_preview_<p>.layers.map.json   제작자 프리뷰 4층 재구성
#   --original   apply-assistant-pack.mts dump 가 저장소(SQLite)에서 뽑은 원래 tileMeta·priority·passability
# 출력: <out>/pack.json (타일셋별 tileMeta·priority·passability·tileGroups·autotileGroups·referenceDocuments + 검증 수치),
#       --preview-dir(/tmp/mzai/pack-preview)/*.png (참고문서 그림 사본 — 눈으로 확인용), <out>/docs/*.md (MD 사본)
# 저장소 반영·재로드·시험용 JSON 내보내기는 apply-assistant-pack.mts 가 한다.
import argparse, base64, collections, io, json, os, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

T = 48
COLS = 96
BUNDLES = ['rasak_field', 'rasak_swamp', 'rasak_cave', 'rasak_town', 'rasak_interior']
N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128
DIRS = [(0, -1, N), (1, 0, E), (0, 1, S), (-1, 0, W), (1, -1, NE), (1, 1, SE), (-1, 1, SW), (-1, -1, NW)]
# p27b 둘레 암반(A4 kind 7)은 2022 옛 그림을 현재 시트로 맞춘 결과라 안쪽이 모양 15 로 재구성된다(names-review). 표 검증·예제에서 뺀다.
OLD_ART = {('p27b', 'A4', 7)}
FONT_PATH = '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf'
PREVIEW_DIR = Path('/tmp/mzai/pack-preview')
MONO_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'

# 작업 단위 용도 — 묶음마다 프리뷰 한 장이 한 용도다. windows = 완성 예제 창(x, y, w, h), cross = 층 분해 그림 창.
PURPOSES = {
    'field_garden': {
        'bundle': 'rasak_field', 'preview': 'p01', 'name': '일본 정원·성 마을',
        'desc': '일본식 성·누각·정원(창호 벽·기와 지붕·돌담·가레산스이 모래밭·석등·징검돌·벚나무·연못). 프리뷰 p01 기준.',
        'windows': [(0, 5, 8, 8), (9, 7, 9, 8), (0, 13, 10, 7)],
        'cross': (9, 7, 8, 7),
        'path': (('A2', 0), ('A2', 1)), 'cave': False,
        'main_ground': ('A2', 0),
        'alts': [('A2', 1), ('A2', 3), ('A2', 13), ('A1', 4), ('A3', 0), ('A3', 15), ('A4', 16), ('A4', 38), ('A4', 46),
                 ('A5', 'stone_paving_gray'), ('A5', 'stone_floor_tiles')],
    },
    'field_cliff': {
        'bundle': 'rasak_field', 'preview': 'p02', 'name': '절벽·폭포 숲',
        'desc': '풀밭 고원·갈색 자갈 절벽·폭포·개울·동굴 입구·숲 나무. 절벽 몸통과 가장자리는 A5 평면 칸 조립, 그림자는 절벽 오른쪽 칸. 프리뷰 p02 기준.',
        'windows': [(0, 2, 9, 9), (10, 2, 7, 10)],
        'cross': (0, 3, 8, 7),
        'path': (('A2', 0), ('A2', 1)), 'cave': False,
        'main_ground': ('A2', 0),
        'alts': [('A2', 1), ('A2', 6), ('A2', 13), ('A1', 7), ('A1', 11), ('A4', 0), ('A4', 8), ('A4', 24), ('A4', 32), ('A4', 40)],
    },
    'swamp': {
        'bundle': 'rasak_swamp', 'preview': 'p28', 'name': '늪지',
        'desc': '짙은 풀밭 위 늪 물 웅덩이·흙길·풀숲(2층)·버드나무·고사목·연잎·수정·반딧불. 프리뷰 p28 기준.',
        'windows': [(0, 0, 10, 8), (20, 8, 10, 8), (5, 11, 10, 7)],
        'cross': (0, 0, 8, 7),
        'path': (('A2', 8), ('A2', 9)), 'cave': False,
        'main_ground': ('A2', 8),
        'alts': [('A2', 10), ('A2', 13), ('A2', 22), ('A2', 29), ('A4', 9), ('A4', 25), ('A4', 33), ('A4', 41)],
    },
    'cave_ice': {
        'bundle': 'rasak_cave', 'preview': 'p27a', 'name': '얼음 동굴',
        'desc': '얼음 바닥(A5)·얼음 동굴 천장과 얼음 벽(A4)·검은 낭떠러지 구덩이(2층)·얼음 다리·얼음 바위·화석. 프리뷰 p27a 기준.',
        'windows': [(1, 0, 10, 9), (5, 10, 10, 9)],
        'cross': (1, 1, 8, 7),
        'path': (('A4', 32), ('A5', 'ice_floor_main')), 'cave': True,
        'main_ground': ('A5', 'ice_floor_main'),
        'alts': [('A1', 6), ('A1', 7), ('A2', 16), ('A2', 17), ('A2', 23), ('A2', 4), ('A4', 2), ('A4', 10), ('A4', 44),
                 ('A5', 'ice_ceiling_icicles'), ('A5', 'ice_wall_face'), ('A5', 'cave_entrance_dark')],
    },
    'cave_lava': {
        'bundle': 'rasak_cave', 'preview': 'p27b', 'name': '용암 동굴',
        'desc': '짙은 회색 자갈 바닥·용암 호수와 용암 폭포(A1)·검은 동굴 벽(A4)·용암 균열(2층)·화산 바위·석순. 프리뷰 p27b 기준.',
        'windows': [(3, 0, 11, 8), (4, 8, 10, 9)],
        'cross': (5, 1, 8, 7),
        'path': (('A4', 7), ('A2', 9)), 'cave': True,
        'main_ground': ('A2', 9),
        'alts': [('A2', 8), ('A2', 10), ('A2', 22), ('A4', 1), ('A4', 9), ('A4', 15), ('A4', 19), ('A4', 27)],
    },

    'town_village': {
        'bundle': 'rasak_town', 'preview': 'ex_village', 'name': '작은 마을',
        'desc': '풀밭 위 흙길·A3 지붕+벽 집·우물·밭·울타리·연못·나무 덩이. 제작자 타일 프리뷰가 없어 우리가 MZ 규칙대로 조립한 예제 ex_village 기준.',
        'windows': [(1, 1, 10, 8), (9, 5, 10, 8), (14, 12, 10, 8)],
        'cross': (1, 1, 8, 7),
        'path': (('A2', 0), ('A2', 1)), 'cave': False,
        'main_ground': ('A2', 0),
        'alts': [('A2', 8), ('A2', 16), ('A2', 17), ('A1', 0), ('A1', 4), ('A3', 1), ('A3', 5), ('A3', 17), ('A3', 9), ('A3', 13), ('A3', 24)],
        'recipe': 'house',
    },
    'town_city': {
        'bundle': 'rasak_town', 'preview': 'ex_city', 'name': '도시 광장',
        'desc': '회색 막돌 큰길·판석 광장·석조 2층 건물(A3)·석상·화단·가로등·시장 좌판. 조립 예제 ex_city 기준.',
        'windows': [(0, 0, 10, 8), (9, 6, 12, 8), (8, 14, 12, 8)],
        'cross': (9, 13, 8, 7),
        'path': (('A2', 0), ('A2', 19)), 'cave': False,
        'main_ground': ('A2', 19),
        'alts': [('A2', 3), ('A2', 11), ('A2', 27), ('A2', 13), ('A2', 21), ('A1', 8), ('A1', 10), ('A3', 19), ('A3', 27), ('A3', 28), ('A3', 31),
                 ('A4', 0), ('A4', 24), ('A4', 32), ('A4', 40)],
        'recipe': 'city',
    },
    'interior_house': {
        'bundle': 'rasak_interior', 'preview': 'ex_house_room', 'name': '민가 실내',
        'desc': '천장 테두리(A4 윗면)·벽면(A4 벽 두 줄)·마루(A2)·양탄자·벽걸이 창·벽난로·침대·옷장·식탁과 의자·탁상 소품(4층). 조립 예제 ex_house_room 기준.',
        'windows': [(0, 0, 10, 12), (6, 0, 10, 12)],
        'cross': (4, 1, 8, 7),
        'path': (('A2', 0), ('A2', 17)), 'cave': False, 'interior': True,
        'main_ground': ('A2', 0),
        'alts': [('A2', 10), ('A2', 1), ('A2', 11), ('A2', 18), ('A2', 25), ('A4', 1), ('A4', 7), ('A4', 11), ('A4', 29), ('A4', 30), ('A4', 43)],
        'recipe': 'room',
    },
    'interior_tavern': {
        'bundle': 'rasak_interior', 'preview': 'ex_tavern', 'name': '여관·주점 실내',
        'desc': '넓은 널마루 홀·카운터(A2 탁자형 자동타일)·술통·벽걸이 선반·긴 식탁과 벤치·벽난로·계단·입구 깔개(2층). 조립 예제 ex_tavern 기준.',
        'windows': [(0, 0, 12, 9), (12, 0, 12, 9), (0, 7, 14, 9)],
        'cross': (14, 2, 8, 7),
        'path': (('A2', 10), ('A2', 0)), 'cave': False, 'interior': True,
        'main_ground': ('A2', 10),
        'alts': [('A2', 0), ('A2', 15), ('A2', 16), ('A2', 24), ('A2', 12), ('A4', 0), ('A4', 2), ('A4', 8), ('A4', 30), ('A4', 40)],
        'recipe': 'room',
    },
}
# 규칙 문서 머리의 「읽는 순서」 줄(@@ORDER@@)은 나눈 뒤에 채워진다 — 그 길이만큼 페이지 한도에서 미리 뺀다.
ORDER_RESERVE = 500


def SRC(P):
    """기준 맵 이름: 제작자 프리뷰 재현(pNN) 또는 우리가 엔진으로 조립한 예제(ex_*, 마을·실내 — 제작자 타일 프리뷰 없음)."""
    return f"조립 예제 {P['preview']}" if P['preview'].startswith('ex_') else f"프리뷰 {P['preview']}"


TILESET_PURPOSES = {b: [p for p, v in PURPOSES.items() if v['bundle'] == b] for b in BUNDLES}

ROLE_KO = {'water': '물', 'ground': '땅 바닥', 'decor': '바닥 장식', 'wall': '벽', 'roof': '윗면·지붕', 'flat': '평면 바닥(A5)'}
GROUP_ROLE = {'water': 'water', 'ground': 'terrain', 'decor': 'terrain', 'wall': 'wall', 'roof': 'roof', 'flat': 'terrain'}


def font(size, mono=False):
    return ImageFont.truetype(MONO_PATH if mono else FONT_PATH, size)


# ───────────────────────── 자료 읽기 ─────────────────────────

class Bundle:
    def __init__(self, root, bid, names, original):
        self.id = bid
        man = json.loads((root / 'baked' / bid / 'manifest.layers.json').read_text())
        self.entries = man['entries']
        self.count = man['count']
        self.atlas = Image.open(root / 'baked' / bid / 'atlas.layers.png').convert('RGBA')
        self.names = names['bundles'][bid]
        self.orig = original[bid]
        assert len(self.orig['priority']) == self.count, (bid, len(self.orig['priority']), self.count)
        self.cache = {}
        # kind 찾기: (slot, kind) → kind 기록. A5 는 그룹 이름(kind="A5:<id>")으로.
        self.kinds = {}
        self.kind_of_tile = {}
        for k in self.names['kinds']:
            key = ('A5', k['kind'][3:]) if k['slot'] == 'A5' else (k['slot'], k['kind'])
            k['key'] = key
            self.kinds[key] = k
            if k['slot'] == 'A5':
                for t in k['tiles']:
                    self.kind_of_tile.setdefault(t, k)
        for i, e in enumerate(self.entries):
            if e and 'kind' in e and e['slot'] in ('A1', 'A2', 'A3', 'A4'):
                k = self.kinds.get((e['slot'], e['kind']))
                if k:
                    self.kind_of_tile[i] = k
        self.obj_of_tile = {}
        for o in self.names['objects']:
            for r, row in enumerate(o['cells']):
                for c, t in enumerate(row):
                    if t >= 0:
                        self.obj_of_tile.setdefault(t, (o, r, c))
        self.shadow = self.names['shadow']

    def tile(self, i):
        if i not in self.cache:
            self.cache[i] = self.atlas.crop(((i % COLS) * T, (i // COLS) * T, (i % COLS + 1) * T, (i // COLS + 1) * T))
        return self.cache[i]

    def cls(self, t):
        """자동타일 판정용 칸 분류: ('A1f'|'A1w'|'A2'|'A3'|'A4t'|'A4w'|'A5'|'obj'|None, kind)."""
        if t is None or t < 0:
            return (None, None)
        e = self.entries[t]
        if not e:
            return ('obj', None)
        s = e['slot']
        if s == 'A1':
            return ('A1w' if (e['kind'] >= 4 and e['kind'] % 2 == 1) else 'A1f', e['kind'])
        if s == 'A2':
            return ('A2', e['kind'])
        if s == 'A3':
            return ('A3', e['kind'])
        if s == 'A4':
            return ('A4w' if e.get('wall') else 'A4t', e['kind'])
        if s == 'A5':
            return ('A5', None)
        return ('obj', None)


def load_maps(root):
    maps = {}
    for p in [v['preview'] for v in PURPOSES.values()]:
        m = json.loads((root / 'maps' / f'rasak_preview_{p}.layers.map.json').read_text())
        w, h = m['width'], m['height']
        m['L'] = {1: list(m['lowerTiles']), 2: list(m.get('lowerOverlayTiles') or [-1] * (w * h)),
                  3: list(m['upperTiles']), 4: list(m.get('upperOverlayTiles') or [-1] * (w * h))}
        m['SH'] = list(m.get('shadowBits') or [0] * (w * h))
        maps[p] = m
    return maps


def normalize_decor(b, m):
    """2층형 kind(names.json layer 2 — 가장자리 투명 장식·구덩이)가 1층에 놓인 칸을 2층으로 옮긴다.
    재구성은 그 칸 아래에 바탕이 없어 1층에 두었지만, 조수에게 가르치는 규칙은 「장식 = 2층」이다.
    옮긴 칸의 1층은 이웃 1층 땅 kind 중 가장 흔한 것의 대표 번호(없으면 비움)로 채우고, 검증에서는 그 1층 칸을 뺀다."""
    w, h = m['width'], m['height']
    n = {'id': m['id'], 'width': w, 'height': h, 'tilesetId': m['tilesetId'],
         'L': {L: list(v) for L, v in m['L'].items()}, 'SH': list(m['SH']), 'replaced': set(), 'moved': 0}
    for i, t in enumerate(m['L'][1]):
        k = b.kind_of_tile.get(t)
        if not k or k['layer'] != 2 or m['L'][2][i] >= 0:
            continue
        x, y = i % w, i // w
        near = collections.Counter()
        for dx, dy, _ in DIRS:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                nk = b.kind_of_tile.get(m['L'][1][ny * w + nx])
                if nk and nk['layer'] == 1:
                    near[nk['key']] += 1
        n['L'][2][i] = t
        n['L'][1][i] = b.kinds[near.most_common(1)[0][0]]['representativeTile'] if near else -1
        n['replaced'].add(i)
        n['moved'] += 1
    return n


# ───────────────────────── 자동타일 그룹 ─────────────────────────

def masks_tables(masks):
    floor = {int(k): v for k, v in masks['floor']['maskToShape'].items()}
    wall = {int(k): v for k, v in masks['wall']['maskToShape'].items()}
    wf = {int(k): v for k, v in masks['waterfall']['maskToShape'].items()}
    return floor, wall, wf


def variant_map(kind, tables):
    floor, wall, wf = tables
    tiles = kind['tiles']
    if kind['autotile'] == 'floor':
        return 8, {str(m): tiles[floor[m]] for m in range(256)}
    if kind['autotile'] == 'wall':
        return 4, {str(m): tiles[wall[m]] for m in range(16)}
    # 폭포: 좌우(E·W)만 본다. OPRN 4이웃 마스크의 N·S 비트는 무시하도록 16칸 모두 채운다.
    return 4, {str(m): tiles[wf[m & (E | W)]] for m in range(16)}


def tile_sets(b):
    """연결 규칙 후보가 쓰는 칸 집합(아틀라스 번호)."""
    sets = collections.defaultdict(set)
    for i, e in enumerate(b.entries):
        c, k = b.cls(i)
        if c is None:
            continue
        if c in ('A1f', 'A1w'):
            sets['A1'].add(i)
        if c == 'A4t':
            sets['A4t'].add(i)
        if c in ('A4t', 'A4w'):
            sets['A4'].add(i)
        if c == 'A3':
            sets['A3'].add(i)
        if c == 'A5':
            sets['A5'].add(i)
        if c == 'obj' and e and e.get('slot') not in ('shadow',):
            sets['obj'].add(i)
    # 1층에 놓이는 불투명 바닥성 물체(일본성 마루·돌담·눈 바닥 — names.json layer 1)만 따로.
    for o in b.names['objects']:
        if o['layer'] == 1:
            for row in o['cells']:
                sets['obj1'].update(t for t in row if t >= 0)
    sets['comp'] = {i for i, e in enumerate(b.entries) if e and e.get('slot') == 'composite'}
    return sets


def own_members(kind):
    return set(kind['tiles'])


def connect_candidates(b, kind, sets):
    """kind 분류별 connectTileIds 후보. 이름 → 칸 집합. 'own' = 같은 kind 만(OPRN 기본)."""
    own = own_members(kind)
    slot, kno = kind['key']
    cls = b.cls(kind['tiles'][0])[0]
    c = {'own': own}
    if cls in ('A1f', 'A1w'):
        c['water'] = own | sets['A1']
    elif cls == 'A2':
        if kind['layer'] == 1:
            c['nonA12'] = own | sets['A3'] | sets['A4'] | sets['A5'] | sets['obj1'] | sets['comp']
            c['nonA12+obj'] = own | sets['A3'] | sets['A4'] | sets['A5'] | sets['obj'] | sets['comp']
            c['A4A5'] = own | sets['A4'] | sets['A5']
    elif cls == 'A3':
        c['A4t'] = own | sets['A4t']
        c['A3'] = own | sets['A3']
    elif cls == 'A4t':
        c['A4t'] = own | sets['A4t']
        c['A4'] = own | sets['A4']
    elif cls == 'A4w':
        c['A4t'] = own | sets['A4t']
        c['walls'] = own | (sets['A4'] - sets['A4t'])
        c['A4'] = own | sets['A4']
        pair = b.kinds.get(('A4', kno - 8))
        if pair:
            c['pairTop'] = own | own_members(pair)
    return cls, c


def mask_at(arr, w, h, x, y, conn, nb):
    m = 0
    for dx, dy, bit in (DIRS if nb == 8 else DIRS[:4]):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and arr[ny * w + nx] in conn:
            m |= bit
    return m


def autotile_agreement(b, maps, previews, groups_by_member, border=False):
    """엔진식(같은 층 배열, 맵 밖 = 끊김) 재성형이 프리뷰 모양과 같은 칸 비율. 층·슬롯별."""
    res = collections.defaultdict(lambda: [0, 0])
    for p in previews:
        m = maps[p]
        w, h = m['width'], m['height']
        for L in (1, 2):
            arr = m['L'][L]
            for y in range(h):
                for x in range(w):
                    t = arr[y * w + x]
                    g = groups_by_member.get(t)
                    if not g:
                        continue
                    e = b.entries[t]
                    if (p, e['slot'], e['kind']) in OLD_ART:
                        continue
                    if not border and (x in (0, w - 1) or y in (0, h - 1)):
                        continue
                    if L == 1 and y * w + x in m.get('replaced', ()):
                        continue
                    mk = mask_at(arr, w, h, x, y, g['_connect'], g['neighborhood'])
                    ok = g['variantMap'][str(mk)] == t
                    for key in (f'L{L}', f'L{L}:{e["slot"]}', f'{p}:L{L}', 'all'):
                        res[key][0] += ok
                        res[key][1] += 1
    return {k: {'ok': a, 'n': n, 'pct': round(100 * a / n, 1)} for k, (a, n) in sorted(res.items())}


def build_autotile_groups(b, maps, tables, raw_maps):
    """kind 마다 그룹 하나. 연결 규칙은 분류별로 후보를 프리뷰에 대 보고 가장 잘 맞는 것을 고른다."""
    sets = tile_sets(b)
    previews = [PURPOSES[p]['preview'] for p in TILESET_PURPOSES[b.id]]
    kinds = [k for k in b.names['kinds'] if k['autotile']]
    per_kind = {}
    for k in kinds:
        nb, vm = variant_map(k, tables)
        cls, cands = connect_candidates(b, k, sets)
        per_kind[k['key']] = {'kind': k, 'cls': cls, 'nb': nb, 'vm': vm, 'cands': cands}
    # 분류마다 후보 이름 → (맞은 칸, 전체 칸)
    score = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    for p in previews:
        m = maps[p]
        w, h = m['width'], m['height']
        for L in (1, 2):
            arr = m['L'][L]
            for y in range(1, h - 1):
                for x in range(1, w - 1):
                    t = arr[y * w + x]
                    k = b.kind_of_tile.get(t)
                    if not k or not k['autotile']:
                        continue
                    if (p, k['slot'], k['kind']) in OLD_ART:
                        continue
                    if L == 1 and y * w + x in m.get('replaced', ()):
                        continue
                    pk = per_kind[k['key']]
                    # 2층 장식 kind 는 2층 배열만 본다(엔진은 칠한 층 배열의 이웃만 본다).
                    for cname, conn in pk['cands'].items():
                        mk = mask_at(arr, w, h, x, y, conn, pk['nb'])
                        sc = score[(pk['cls'], k['layer'])][cname]
                        sc[0] += pk['vm'][str(mk)] == t
                        sc[1] += 1
    choice = {}
    for key, cs in score.items():
        best = max(cs.items(), key=lambda kv: (kv[1][0], kv[0] == 'own'))
        choice[key] = best[0]
    groups = []
    for key, pk in per_kind.items():
        k = pk['kind']
        cname = choice.get((pk['cls'], k['layer']), 'own')
        if cname not in pk['cands']:
            cname = 'own'
        conn = pk['cands'][cname]
        g = {
            'id': f"rasak_{k['slot'].lower()}_k{k['kind']}",
            'name': k['name'],
            'neighborhood': pk['nb'],
            'memberTileIds': list(dict.fromkeys(k['tiles'])),
            'variantMap': pk['vm'],
            '_connect': conn, '_rule': cname,
        }
        if cname != 'own':
            g['connectTileIds'] = sorted(conn)
        groups.append(g)
    by_member = {t: g for g in groups for t in g['memberTileIds']}
    same_kind = []
    for g in groups:
        g2 = dict(g)
        g2['_connect'] = set(g['memberTileIds'])
        same_kind.append(g2)
    verify = {
        'rawChosen': autotile_agreement(b, raw_maps, previews, by_member),
        'rawSameKind': autotile_agreement(b, raw_maps, previews, {t: g for g in same_kind for t in g['memberTileIds']}),
        'rules': {f'{c}|L{l}': {'chosen': choice[(c, l)], 'candidates': {n: {'ok': a, 'n': t, 'pct': round(100 * a / t, 1) if t else None} for n, (a, t) in cs.items()}}
                  for (c, l), cs in sorted(score.items())},
        'chosen': autotile_agreement(b, maps, previews, by_member),
        'sameKind': autotile_agreement(b, maps, previews, {t: g for g in same_kind for t in g['memberTileIds']}),
    }
    return groups, verify


# ───────────────────────── 칸 이름표·통행·묶음 ─────────────────────────

def pass_ko(v):
    return '통과' if v is True else '막힘' if v is False else '통행 미정'


def build_tile_meta(b):
    """칸마다 이름표. 통행·★ 는 names.json 이 값을 줄 때만 바꾸고 passage·passability 를 같이 맞춘다."""
    meta, prio, passab = [], list(b.orig['priority']), [dict(x) for x in b.orig['passability']]
    changes = collections.Counter()
    for i in range(b.count):
        old = b.orig['tileMeta'][i] if i < len(b.orig['tileMeta']) else {}
        e = b.entries[i]
        m = {'label': '', 'description': '', 'source': 'imported', 'defaultLayer': old.get('defaultLayer', 'lower'),
             'passage': old.get('passage', 'passable')}
        passable = None
        star = False
        k = b.kind_of_tile.get(i)
        obj = b.obj_of_tile.get(i)
        if k is not None:
            role = k['role']
            layer = k['layer']
            if k['slot'] == 'A5':
                n = e.get('n') if e else None
                m['label'] = f"{k['name']} (A5 {n})"
                shape_note = f"A5 평면 칸 {n} — 자동타일 아님, 번호 그대로 놓인다"
            else:
                shape = e['shape']
                frame = e.get('frame', 0)
                tail = '대표·안쪽' if shape == 0 else f'모양 {shape}'
                m['label'] = f"{k['name']} — {tail}" + (f" · 물결 {frame}" if frame else '')
                shape_note = (f"{k['slot']} 자동타일 kind {k['kind']}. 칠할 때는 대표 {k['representativeTile']} 을 쓰면 "
                              f"{'2층' if layer == 2 else '1층'} 이웃에 맞춰 가장자리 모양이 잡힌다. 모양 번호를 손으로 고르지 않는다")
                if frame:
                    shape_note += f'. 애니메이션 {frame}번째 칸 — 맵에는 프레임 0 번호만 쓴다'
            passable = k['passable']
            m['description'] = f"{ROLE_KO[role]} · {layer}층 · {pass_ko(passable)} · {shape_note}"
            m['role'] = role
            m['defaultLayer'] = 'lower'
            m['tags'] = ['rasak', k['slot'], ROLE_KO[role], f'{layer}층']
            changes['kind'] += 1
        elif obj is not None:
            o, r, c = obj
            w, h = o['size']
            pr = o['passable'][r][c]
            st = bool(o['star'][r][c]) if o.get('star') else False
            passable, star = pr, st
            pos = f" ({r},{c})" if w * h > 1 else ''
            m['label'] = f"{o['name']}{pos}"
            cells = json.dumps(o['cells'], separators=(',', ':'))
            ly = o['layer']
            m['description'] = (f"물체 {o['id']} · {w}×{h}칸 중 {r}행 {c}열 · {ly}층 · 이 칸 "
                                f"{'★ 통과(캐릭터 위에 그림)' if st else pass_ko(pr)} · 통행 요약 {o.get('passableSummary', '')}"
                                + (f" · stamp_layer_block layers[\"{ly}\"]={cells}" if w * h <= 16 else f" · 칸 배열은 참고문서 번호 사전(물체 {o['id']})"))
            m['role'] = 'object'
            m['defaultLayer'] = 'lower' if ly == 1 else 'upper'
            m['tags'] = ['rasak', o['sheet'], '물체', f'{ly}층']
            changes['object'] += 1
        elif e and e.get('slot') == 'shadow':
            m['label'] = f"옛 그림자 조각 비트 {e['bits']}"
            m['description'] = '4층 판에서는 쓰지 않는다 — 그림자는 paint_shadow(사분면 비트)로 칠한다'
            changes['shadow'] += 1
        elif e and e.get('slot') == 'composite':
            m['label'] = f"합성 칸 {i} (프리뷰 재현 전용)"
            m['description'] = f"한 칸에 물체가 셋 이상 겹친 프리뷰 칸을 합친 그림(구성 {e.get('partTiles')}). 새 맵에서는 쓰지 않는다"
            changes['composite'] += 1
        elif e and e.get('empty'):
            m['label'] = f"빈 칸 {i}"
            m['description'] = '투명한 빈 시트 칸 — 쓰지 않는다'
            changes['empty'] += 1
        else:
            m['label'] = old.get('label', f'칸 {i}')
            m['description'] = old.get('description', '')
            changes['unnamed'] += 1
        if passable is not None or star:
            newp = 'star' if star else ('passable' if passable else 'solid')
            if newp != old.get('passage'):
                changes['passageChanged'] += 1
            m['passage'] = newp
            flag = bool(star or passable)
            if any(v != flag for v in passab[i].values()):
                changes['passabilityChanged'] += 1
            passab[i] = {'up': flag, 'down': flag, 'left': flag, 'right': flag}
            if star and prio[i] != 'upper':
                prio[i] = 'upper'
                changes['priorityChanged'] += 1
        # 1층 바닥성 물체는 홈 레이어가 1층이어야 paint_tiles 1층이 3층으로 옮기지 않는다.
        if obj is not None and obj[0]['layer'] == 1 and prio[i] != 'lower':
            prio[i] = 'lower'
            changes['priorityChanged'] += 1
        meta.append(m)
    return meta, prio, passab, dict(changes)


def build_tile_groups(b):
    groups = []
    for k in b.names['kinds']:
        tiles = list(dict.fromkeys(k['tiles']))
        rep = k['representativeTile']
        if k['slot'] == 'A5':
            gid = f"rasak_a5_{k['kind'][3:]}"
        else:
            gid = f"rasak_{k['slot'].lower()}_k{k['kind']}"
        layer_note = '2층(layer "2")에 칠한다' if k['layer'] == 2 else '1층(layer "1")에 칠한다'
        groups.append({
            'id': gid, 'name': k['name'], 'role': GROUP_ROLE[k['role']], 'defaultLayer': 'lower',
            'tileIds': [rep] + [t for t in tiles if t != rep],
            'description': f"{ROLE_KO[k['role']]} · {layer_note} · {pass_ko(k['passable'])} · 몸통 {rep}"
                           + (' · 자동타일(가장자리 자동)' if k['autotile'] else ' · A5 평면(번호 그대로)'),
            'placementRules': ('대표 번호로 면을 칠하면 가장자리는 자동. ' if k['autotile'] else '') + layer_note,
            'source': 'imported', 'confidence': 'medium',
        })
    return groups


# ───────────────────────── 그리기 ─────────────────────────

def shadow_tile(bits, alpha=127):
    s = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    for bit, (qx, qy) in ((1, (0, 0)), (2, (24, 0)), (4, (0, 24)), (8, (24, 24))):
        if bits & bit:
            d.rectangle((qx, qy, qx + 23, qy + 23), fill=(0, 0, 0, alpha))
    return s


def checker(w, h, a=(58, 58, 64), b2=(78, 78, 86), step=12):
    im = Image.new('RGBA', (w, h), a + (255,))
    d = ImageDraw.Draw(im)
    for y in range(0, h, step):
        for x in range(0, w, step):
            if (x // step + y // step) % 2:
                d.rectangle((x, y, x + step - 1, y + step - 1), fill=b2 + (255,))
    return im


def render(b, win, layers=(1, 2, 'sh', 3, 4), bg=None, marker=None):
    """창 배열(win = {'w','h','L':{1..4},'SH'})을 에디터·게임과 같은 순서(1→2→그림자→3→4)로 그린다."""
    w, h = win['w'], win['h']
    c = bg.copy() if bg is not None else Image.new('RGBA', (w * T, h * T), (0, 0, 0, 255))
    for n in range(w * h):
        x, y = (n % w) * T, (n // w) * T
        for L in (1, 2, 'sh', 3, 4):
            if L == 'mk':
                continue
            if marker is not None and L == 3 and marker[0] + marker[1] * w == n:
                pass
            if L not in layers:
                continue
            if L == 'sh':
                v = win['SH'][n]
                if v > 0:
                    c.alpha_composite(shadow_tile(v), (x, y))
                continue
            t = win['L'][L][n]
            if t is not None and t >= 0:
                c.alpha_composite(b.tile(t), (x, y))
    return c


def cut_window(m, x0, y0, w, h):
    W = m['width']
    win = {'w': w, 'h': h, 'x0': x0, 'y0': y0, 'L': {}, 'SH': []}
    for L in (1, 2, 3, 4):
        win['L'][L] = [m['L'][L][(y0 + y) * W + x0 + x] for y in range(h) for x in range(w)]
    win['SH'] = [m['SH'][(y0 + y) * W + x0 + x] for y in range(h) for x in range(w)]
    return win


def framed(img, w, h, title=None, grid=True, ticks=True):
    """칸 좌표(창 안 배열 행·열)를 가장자리에 적고 옅은 격자를 그린다."""
    pad_l, pad_t = (26, 22) if ticks else (0, 0)
    head = 30 if title else 0
    out = Image.new('RGBA', (img.width + pad_l + 4, img.height + pad_t + head + 4), (24, 24, 28, 255))
    out.alpha_composite(img, (pad_l, pad_t + head))
    d = ImageDraw.Draw(out)
    if grid:
        ov = Image.new('RGBA', img.size, (0, 0, 0, 0))
        g = ImageDraw.Draw(ov)
        for x in range(0, img.width, T):
            g.line((x, 0, x, img.height), fill=(255, 255, 255, 46))
        for y in range(0, img.height, T):
            g.line((0, y, img.width, y), fill=(255, 255, 255, 46))
        out.alpha_composite(ov, (pad_l, pad_t + head))
    if ticks:
        f = font(13, mono=True)
        for x in range(w):
            d.text((pad_l + x * T + T // 2, pad_t + head - 3), str(x), fill=(255, 230, 120), font=f, anchor='mb')
        for y in range(h):
            d.text((pad_l - 4, pad_t + head + y * T + T // 2), str(y), fill=(255, 230, 120), font=f, anchor='rm')
    if title:
        d.text((6, 5), title, fill=(255, 255, 255), font=font(18))
    return out


def to_data_url(img):
    buf = io.BytesIO()
    img.convert('RGBA').save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def draw_character(c, x, y):
    """오류 그림용 캐릭터 표시(사람 모양 실루엣). 3층보다 먼저, 2층·그림자 뒤에 그린다."""
    d = ImageDraw.Draw(c)
    cx, cy = x * T + T // 2, y * T
    d.ellipse((cx - 9, cy + 4, cx + 9, cy + 22), fill=(230, 60, 60, 255), outline=(255, 255, 255, 255), width=2)
    d.rectangle((cx - 11, cy + 22, cx + 11, cy + 46), fill=(230, 60, 60, 255), outline=(255, 255, 255, 255), width=2)


# ───────────────────────── 참고문서 ─────────────────────────

def arr2d(flat, w):
    return [flat[i:i + w] for i in range(0, len(flat), w)]


def grid_json(rows):
    return '[' + ',\n'.join('[' + ','.join(str(v) for v in r) + ']' for r in rows) + ']'


def layer_stats(b, m):
    w, h = m['width'], m['height']
    out = {}
    for L in (1, 2, 3, 4):
        cnt = collections.Counter()
        for t in m['L'][L]:
            if t is None or t < 0:
                continue
            c, _ = b.cls(t)
            k = b.kind_of_tile.get(t)
            if c in ('A1f', 'A1w'):
                cnt['A1 물·폭포'] += 1
            elif c == 'A2':
                cnt['A2 장식(2층형)' if k and k['layer'] == 2 else 'A2 땅'] += 1
            elif c == 'A3':
                cnt['A3 지붕·벽'] += 1
            elif c == 'A4t':
                cnt['A4 윗면'] += 1
            elif c == 'A4w':
                cnt['A4 벽'] += 1
            elif c == 'A5':
                cnt['A5 평면'] += 1
            elif b.entries[t] and b.entries[t].get('slot') == 'composite':
                cnt['합성 칸'] += 1
            else:
                cnt['물체(B~E·추가 시트)'] += 1
        out[L] = (sum(cnt.values()), cnt)
    sh = collections.Counter(v for v in m['SH'] if v)
    out['sh'] = (sum(sh.values()), sh)
    out['size'] = (w, h)
    return out


BITS_KO = {1: '좌상', 2: '우상', 4: '좌하', 8: '우하'}


def bits_ko(v):
    return '+'.join(BITS_KO[b] for b in (1, 2, 4, 8) if v & b)


def kind_row(b, k, used):
    kid = k['kind'][3:] if k['slot'] == 'A5' else k['kind']
    at = {'floor': '자동 8이웃', 'wall': '자동 4이웃(벽)', 'waterfall': '자동 좌우(폭포)', None: 'A5 평면'}[k['autotile']]
    u = f"{used}칸" if used else '-'
    return f"| {k['slot']} {kid} | {k['name']} | {ROLE_KO[k['role']]} | {k['layer']} | {'O' if k['passable'] else 'X'} | **{k['representativeTile']}** | {at} | {u} |"


def usage_in_map(b, m):
    kinds = collections.Counter()
    objs = collections.Counter()
    objlayer = collections.defaultdict(collections.Counter)
    for L in (1, 2, 3, 4):
        for t in m['L'][L]:
            if t is None or t < 0:
                continue
            k = b.kind_of_tile.get(t)
            if k is not None:
                kinds[k['key']] += 1
                continue
            o = b.obj_of_tile.get(t)
            if o:
                objs[o[0]['id']] += 1
                objlayer[o[0]['id']][L] += 1
    return kinds, objs, objlayer


def pick_extras(b, used_ids, limit=8):
    used = [o for o in b.names['objects'] if o['id'] in used_ids]
    sheets = {o['sheet'] for o in used}
    heads = {o['name'].split('(')[0].split()[0] for o in used}
    out = []
    for o in b.names['objects']:
        if o['id'] in used_ids or o['sheet'] not in sheets:
            continue
        head = o['name'].split('(')[0].split()[0]
        if head in heads and o['size'][0] * o['size'][1] >= 2:
            out.append(o)
            heads.discard(head)
        if len(out) >= limit:
            break
    return out


def object_line(code, o, layer_used=None):
    w, h = o['size']
    ly = o['layer']
    cells = json.dumps(o['cells'], separators=(',', ':'))
    lu = ''
    if layer_used and layer_used.get(4):
        lu = f" · 프리뷰에서 4층 겹침 {layer_used[4]}칸"
    
    ps = o.get('passableSummary', '')
    if ps == 'partial':
        blocked = [f'{r},{c}' for r, row in enumerate(o['passable']) for c, v in enumerate(row) if v is False]
        ps = f"일부(막힘 행,열: {' '.join(blocked)})"
    return f"- **{code}** {o['name']} — {w}×{h}, {ly}층, 통행 {ps}{lu} · `\"{ly}\": {cells}`"


def fix_old_art(b, p, m, win, groups_by_member):
    """p27b 둘레 암반(A4 k7)을 엔진이 잡는 모양으로 바꾼다 — 옛 그림 모양을 조수에게 가르치지 않는다. 바꾼 칸 수."""
    n = 0
    W, H = m['width'], m['height']
    for i, t in enumerate(win['L'][1]):
        e = b.entries[t] if t is not None and t >= 0 else None
        if e and (p, e.get('slot'), e.get('kind')) in OLD_ART:
            g = groups_by_member[t]
            x, y = win['x0'] + i % win['w'], win['y0'] + i // win['w']
            mk = mask_at(m['L'][1], W, H, x, y, g['_connect'], g['neighborhood'])
            nt = g['variantMap'][str(mk)]
            if nt != t:
                win['L'][1][i] = nt
                n += 1
    return n


def swatch_image(b, entries, main_ground_rep, groups_by_kind, title):
    """자동타일 종류 견본: kind 마다 3×3(벽 3×2, 폭포 2×3) 덩어리를 엔진 모양으로 그리고 이름·대표 번호를 단다."""
    cell_w, cell_h = 3 * T + 40, 3 * T + 44
    cols = max(1, min(6, 1380 // cell_w))
    rows = (len(entries) + cols - 1) // cols
    img = Image.new('RGBA', (cols * cell_w + 10, rows * cell_h + 40), (30, 30, 36, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 8), title, fill=(255, 255, 255), font=font(18))
    for idx, (code, k) in enumerate(entries):
        ox, oy = 10 + (idx % cols) * cell_w, 40 + (idx // cols) * cell_h
        g = groups_by_kind.get(k['key'])
        if k['autotile'] == 'wall':
            bw, bh = 3, 2
        elif k['autotile'] == 'waterfall':
            bw, bh = 2, 3
        else:
            bw, bh = 3, 3
        patch = Image.new('RGBA', (3 * T, 3 * T), (0, 0, 0, 0))
        base = b.tile(main_ground_rep)
        for yy in range(3):
            for xx in range(3):
                patch.alpha_composite(base, (xx * T, yy * T))
        if g:
            arr = [k['tiles'][0]] * (bw * bh)
            for yy in range(bh):
                for xx in range(bw):
                    mk = mask_at(arr, bw, bh, xx, yy, set(g['memberTileIds']), g['neighborhood'])
                    patch.alpha_composite(b.tile(g['variantMap'][str(mk)]), (xx * T, yy * T))
        else:  # A5 평면: 묶음의 칸을 시트 순서대로(최대 9), 대표 칸은 노란 테
            for j, t in enumerate(k['tiles'][:9]):
                patch.alpha_composite(b.tile(t), ((j % 3) * T, (j // 3) * T))
                if t == k['representativeTile']:
                    ImageDraw.Draw(patch).rectangle(((j % 3) * T, (j // 3) * T, (j % 3) * T + T - 1, (j // 3) * T + T - 1), outline=(255, 220, 0, 255), width=3)
        img.alpha_composite(patch, (ox, oy))
        d.text((ox, oy + 3 * T + 3), f"{code} 대표 {k['representativeTile']}", fill=(255, 230, 120), font=font(13))
        d.text((ox, oy + 3 * T + 20), k['name'][:14], fill=(230, 230, 230), font=font(12))
    return img


def catalog_images(b, entries, title, max_w=1380, max_h=1380):
    """물체 도감: 칸 묶음 그대로(48px) + 코드·첫 칸 번호. 넘치면 여러 장."""
    pages = []
    pad = 8
    label_h = 34
    placed = []
    x = y = 0
    row_h = 0
    items = sorted(entries, key=lambda e: (-e[1]['size'][1], -e[1]['size'][0]))
    for code, o in items:
        w, h = o['size']
        bw, bh = max(w * T, 74), h * T + label_h
        if x + bw > max_w - 20:
            x = 0
            y += row_h + pad
            row_h = 0
        if y + bh > max_h - 50:
            pages.append(placed)
            placed, x, y, row_h = [], 0, 0, 0
        placed.append((code, o, x, y))
        x += bw + pad
        row_h = max(row_h, bh)
    if placed:
        pages.append(placed)
    out = []
    for pi, pl in enumerate(pages):
        wmax = max(px + max(o['size'][0] * T, 74) for _, o, px, _ in pl) + 30
        hmax = max(py + o['size'][1] * T + label_h for _, o, _, py in pl) + 50
        img = Image.new('RGBA', (min(max_w, wmax), hmax), (30, 30, 36, 255))
        d = ImageDraw.Draw(img)
        d.text((10, 8), title + (f' ({pi + 1}/{len(pages)})' if len(pages) > 1 else ''), fill=(255, 255, 255), font=font(18))
        for code, o, px, py in pl:
            ox, oy = 10 + px, 40 + py
            w, h = o['size']
            img.alpha_composite(checker(w * T, h * T), (ox, oy))
            for r, row in enumerate(o['cells']):
                for c, t in enumerate(row):
                    if t >= 0:
                        img.alpha_composite(b.tile(t), (ox + c * T, oy + r * T))
            first = next(t for row in o['cells'] for t in row if t >= 0)
            d.text((ox, oy + h * T + 2), f"{code} {o['layer']}층", fill=(255, 230, 120), font=font(13))
            d.text((ox, oy + h * T + 18), f"#{first}", fill=(200, 220, 255), font=font(12, mono=True))
        out.append(img)
    return out


def win_json(win, layers=(1, 2, 3, 4, 'shadow')):
    parts = []
    for L in layers:
        if L == 'shadow':
            rows = arr2d([v if v else 0 for v in win['SH']], win['w'])
            if not any(any(r) for r in rows):
                continue
            parts.append(f'"shadow":{grid_json(rows)}')
            continue
        rows = arr2d([t if t is not None and t >= 0 else -1 for t in win['L'][L]], win['w'])
        if all(v == -1 for r in rows for v in r):
            continue
        parts.append(f'"{L}":{grid_json(rows)}')
    return '{' + ',\n'.join(parts) + '}'


RULE_TEXT = {
    ('A1f', 'water'): '물(A1)은 다른 물 종류·폭포와도 이어진다(물끼리는 물가를 안 그린다)',
    ('A2', 'nonA12'): '1층 땅(A2)은 벽·윗면(A3·A4)·A5 평면·1층 바닥성 물체 쪽으로는 가장자리를 안 그리고, 다른 땅·물 쪽으로만 그린다',
    ('A4t', 'A4t'): '윗면·천장(A4 윗면)은 다른 윗면 종류와도 이어진다',
    ('A4w', 'A4'): '벽(A4 벽)은 윗면·다른 벽 쪽과 이어진다(벽 윗줄에 윗면이 있어도 이어진 것으로 본다)',
    ('A3', 'A3'): '지붕·벽(A3)은 다른 A3 와도 이어진다',
}


def rule_sentences(rules):
    out = []
    for key, v in rules.items():
        cls = key.split('|')[0]
        t = RULE_TEXT.get((cls, v['chosen']))
        if t:
            out.append(t)
    out.append('그 밖(2층 장식 포함)은 같은 종류끼리만 이어진다. 맵 가장자리 밖은 끊긴 것으로 본다 — 맵 끝까지 칠한 물·풀은 끝 줄에 가장자리가 생긴다')
    return out


def components(cells, w, h, members=False):
    """4이웃 연결 덩이 크기(큰 순). members=True 면 덩이 칸 목록."""
    cells = set(cells)
    seen, out = set(), []
    for c in cells:
        if c in seen:
            continue
        st, n, got = [c], 0, []
        seen.add(c)
        while st:
            i = st.pop()
            n += 1
            got.append(i)
            x, y = i % w, i // w
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and j in cells and j not in seen:
                    seen.add(j)
                    st.append(j)
        out.append(got if members else n)
    return sorted(out, key=len, reverse=True) if members else sorted(out, reverse=True)


def iter_run(cells, w, h, x, y, dx, dy):
    x, y = x + dx, y + dy
    while 0 <= x < w and 0 <= y < h and y * w + x in cells:
        yield (x, y)
        x, y = x + dx, y + dy


def density_stats(b, m, main_key):
    """프리뷰 밀도: 물체·장식 덮임, 물체 수(시작 칸 기준), 덩이 크기, 가장 큰 빈 바닥 정사각형, 길·물 덩이."""
    w, h = m['width'], m['height']
    A = w * h
    L = m['L']
    occ = [i for i in range(A) if L[3][i] >= 0 or L[4][i] >= 0]
    dec = [i for i in range(A) if L[2][i] >= 0]
    anchors = 0
    for Ly in (3, 4):
        for t in L[Ly]:
            o = b.obj_of_tile.get(t)
            if o:
                first = next((r, c) for r, row in enumerate(o[0]['cells']) for c, v in enumerate(row) if v >= 0)
                anchors += (o[1], o[2]) == first

    def empty(i):
        if L[2][i] >= 0 or L[3][i] >= 0 or L[4][i] >= 0:
            return False
        k = b.kind_of_tile.get(L[1][i])
        return bool(k and k['passable'])
    best = 0
    for k in range(1, min(w, h) + 1):
        if any(all(empty((y0 + y) * w + x0 + x) for y in range(k) for x in range(k)) for y0 in range(h - k + 1) for x0 in range(w - k + 1)):
            best = k
        else:
            break
    waters, paths = [], []
    for i, t in enumerate(L[1]):
        k = b.kind_of_tile.get(t)
        if k and k['role'] == 'water':
            waters.append(i)
        elif k and k['role'] == 'ground' and k['key'] != main_key:
            paths.append(i)
    wset = set(waters)
    near = sum(1 for i in dec if any(0 <= i % w + dx < w and 0 <= i // w + dy < h and
                                     ((i // w + dy) * w + i % w + dx in wset or L[3][(i // w + dy) * w + i % w + dx] >= 0) for dx, dy, _ in DIRS))
    fills = []
    for body in components(waters, w, h, members=True)[:4]:
        xs, ys = [i % w for i in body], [i // w for i in body]
        fills.append(round(100 * len(body) / ((max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1))))
    pset = set(paths)
    widths = []
    for i in paths:
        x, y = i % w, i // w
        hr = 1 + sum(1 for _ in iter_run(pset, w, h, x, y, 1, 0)) + sum(1 for _ in iter_run(pset, w, h, x, y, -1, 0))
        vr = 1 + sum(1 for _ in iter_run(pset, w, h, x, y, 0, 1)) + sum(1 for _ in iter_run(pset, w, h, x, y, 0, -1))
        widths.append(min(hr, vr))
    widths.sort()
    return {'waterFill': fills, 'pathWidth': (widths[len(widths) // 2], widths[-1]) if widths else None,
            'area': A, 'objShare': round(100 * len(occ) / A), 'decorShare': round(100 * len(dec) / A), 'objects': anchors,
            'per100': round(100 * anchors / A, 1), 'objClusters': components(occ, w, h), 'decorClumps': components(dec, w, h),
            'decorNear': round(100 * near / len(dec)) if dec else 0, 'maxEmpty': best,
            'pathRuns': components(paths, w, h), 'waterBodies': components(waters, w, h)}


def recipe_md(P, b, cat):
    """마을·실내 용도의 짓는 법(집 A3 지붕+벽 / 도시 / 방 A4 천장+벽면+바닥). 번호는 이 묶음 대표 번호."""
    r = P.get('recipe')
    if not r:
        return ''
    rep = lambda slot, kind: b.kinds[(slot, kind)]['representativeTile']
    nm = lambda slot, kind: b.kinds[(slot, kind)]['name']
    c = cat[1:-1]
    if r in ('house', 'city'):
        combos = [(('A3', 0), ('A3', 10)), (('A3', 16), ('A3', 25)), (('A3', 4), ('A3', 12)), (('A3', 19), ('A3', 27)), (('A3', 1), ('A3', 28)), (('A3', 5), ('A3', 9))]
        combo_txt = ' · '.join(f"{nm(*a)[:10]} {rep(*a)} + {nm(*w)[:12]} {rep(*w)}" for a, w in combos)
        out = f"""## 집 짓기 — MZ A3 지붕+벽 (이 팩의 집은 이렇게만 짓는다)
1. **지붕**: A3 지붕 kind 대표 번호를 가로 w × 세로 3줄(작은 집 2줄) `paint_tiles layer:"1" mode:"rect"` 로. 모양은 엔진이 잡는다.
2. **벽**: 지붕 바로 아래 줄부터 **같은 가로 폭** w × 2줄(2층 집 3줄)을 A3 벽 kind 대표 번호로 rect. 지붕 없이 벽만, 벽 없이 지붕만 금지.
3. **문**: 문 물체(1×2, 이름에 「벽 아랫줄에 놓음」)를 벽 두 줄에 맞춰 3층에 — 문 윗칸이 벽 윗줄. 문 바로 아래 칸까지 길을 잇는다.
4. **창**: 창 물체(이름에 「벽걸이」)를 벽 윗줄 3층에, 문 양옆으로 1칸 이상 띄워 1~2개.
5. **굴뚝·지붕창**: 굴뚝(4층, 이름에 「지붕 위」)은 지붕 맨 윗줄 칸 위에 `layers:{{"4": …}}`.
6. **그림자**: 집 오른쪽 바로 옆 칸 세로줄(지붕+벽 줄 전부)에 `paint_shadow` 비트 5(좌상+좌하).
7. 집과 집 사이·집 둘레는 1칸 이상 띄우고, 벽 옆에 덤불·꽃상자·술통·장작 덩이를 붙인다.
- 어울리는 지붕+벽 짝(대표 번호): {combo_txt}.
- 예: 붉은 기와 집 6×5 를 (x,y) 에 — `paint_tiles {{mapId, layer:"1", mode:"rect", tile:{rep('A3', 0)}, from:{{x,y}}, to:{{x:x+5,y:y+2}}, {c}}}` →
  `paint_tiles {{…, tile:{rep('A3', 10)}, from:{{x,y:y+3}}, to:{{x:x+5,y:y+4}}}}` → 문·창 `stamp_layer_block layers:{{"3": 배열}}` → 그림자 (x+6,y)~(x+6,y+4).
- A4 벽·윗면(성벽·목책·천막·생울타리)은 집이 아니라 담·성채·천막용이다. `build_house`·`author_house`·`build_village` 는 이 팩에서 쓰지 않는다.
"""
        if r == 'city':
            out += """
## 도시 — 큰길·광장·좌판
- 도시 큰길은 폭 5~7칸 곧은 길이 맞다(회색 막돌 포장). 골목·집 앞 길은 1~2칸.
- 광장은 판석 포장을 모서리를 깎은 넓은 덩이로 깔고, 가운데 석상, 네 귀에 가로등, 가장자리에 화단(돌 화단 위 4층 꽃 줄)·벤치.
- **시장 좌판** = 차양(3×2)을 (x,y) 에, 좌판 몸체(3×2)를 (x,y+2) 에 — 차양 아랫줄 바로 밑에 몸체. 좌판 옆에 상자·바구니 덩이.
- 2층 건물은 벽 3줄에 창을 윗줄에 여럿, 문은 아래 두 줄.
"""
        return out + '\n'
    return f"""## 방 짓기 — MZ 실내 (A4 천장 테두리 + A4 벽면 + A2 바닥)
1. **천장**: 방 바깥과 둘레 1칸을 A4 윗면(천장) 대표 번호로 1층 rect — 맵 전체를 먼저 칠해도 된다. 예 {nm('A4', 0)} {rep('A4', 0)}.
2. **벽면**: 방 안쪽 맨 윗 2줄을 A4 벽 대표 번호로 rect(가로 폭 = 방 안쪽 폭). 예 {nm('A4', 27)} {rep('A4', 27)} · {nm('A4', 24)} {rep('A4', 24)}.
3. **바닥**: 벽면 아래를 A2 바닥 대표 번호로 rect. **실내는 네모 방이 정상**이다(야외의 「직사각형 금지」는 실내 방에 쓰지 않는다).
4. **출입구**: 아래 테두리 한 칸을 바닥 번호로 칠해 뚫는다. 그 앞은 비워 둔다.
5. **벽에 붙는 것**: 이름에 「벽걸이」가 있는 창·액자·선반·커튼은 벽면 두 줄 위 3층. 키 큰 가구(책장·옷장·찬장 1×2·2×2)는 **아랫줄이 바닥 첫 줄**에 오게 — 윗줄이 벽면에 걸친다. 벽난로(3×2)도 윗줄 벽면·아랫줄 바닥.
6. **가구**: 침대·옷장은 벽을 따라, 식탁은 방 가운데에 의자를 앞뒤(위 보는·아래 보는)로. 이름에 「탁상 소품」이 있는 그릇·잔·촛대는 식탁 칸 위 **4층**.
7. **깔개**: 양탄자 kind(층=1)는 바닥 일부를 rect 로 바꿔 깔고, 2층 깔개(층=2)는 바닥 위에 얹는다. 방 가운데 한두 개.
8. **그림자**: 서쪽 천장 테두리 바로 오른쪽 바닥 칸 세로줄에 비트 5(벽면 칸에는 칠하지 않는다).
- 카운터·작업대 = A2 탁자형 자동타일(이름에 「탁자형 자동타일」)을 1층 rect 한 줄 — 막힘. 그 뒤 벽에 벽걸이 선반, 발치에 술통.
- `run_interior_room_pipeline`·`furnish_interior_space`·`place_concept` 는 이 팩에서 쓰지 않는다(다른 칩셋 번호).

"""


def density_section(P, st, cat):
    """규칙 문서 머리에 넣는 밀도·길·장식 규칙(수치는 프리뷰 실측). 30×20 맵 기준 목표를 준다."""
    goal_obj = max(12, round(st['per100'] * 6 * 0.6))
    goal_occ = max(8, round(st['objShare'] * 0.6))
    goal_dec = max(3, round(st['decorShare'] * 0.6))
    k = max(4, st['maxEmpty'] + 2)
    cl = st['decorClumps']
    clump = f"{min(cl[:6])}~{max(cl)}칸" if cl else '없음'
    runs = st['pathRuns'][:5]
    indoor = P.get('interior')
    lines = [
        f"## 밀도·길·장식 — 가장 먼저 지킬 것 ({SRC(P)} 실측)",
        f"- 실측: 물체가 덮은 칸 {st['objShare']}% · 2층 장식 {st['decorShare']}% · 물체 {st['objects']}개(100칸당 {st['per100']}) · "
        f"빈 바닥 정사각형 최대 {st['maxEmpty']}×{st['maxEmpty']} · 장식 덩이 {clump}(장식 칸의 {st['decorNear']}%가 물가·물체 옆)"
        + (f" · 물 덩이 {st['waterBodies'][:4]}칸" if st['waterBodies'] else '') + (f" · 길 덩이 {runs}칸" if runs else '') + '.',
        f"- **30×20 맵 목표**: 물체 {goal_obj}개 이상(칸 {goal_occ}% 이상을 3·4층 물체가 덮음), 2층 장식 {goal_dec}% 이상, "
        f"**빈 {'바닥' if P['cave'] or indoor else '풀밭'}이 {k}×{k} 넘게 남지 않게** 한다. 다 칠한 뒤 show_map_region 으로 빈 곳을 찾아 채운다.",
        "- 물체 여럿은 stamp_layer_block 한 번에 한 배열로 찍는다(예: 10×8 창 하나에 나무·풀·돌을 함께, 빈칸 -1) — 한 개씩 부르지 않는다.",
        "- **모양은 자연스럽게 — 직사각형 금지**: 물·흙·모래 같은 면은 네모 하나로 칠하지 않는다(오류 그림 ③)"
        + (f" — 프리뷰 물 덩이는 둘러싼 사각형의 {'·'.join(str(f) for f in st['waterFill'])}%만 채운다" if st['waterFill'] else '') + ". "
        "크기가 다른 사각형 2~3개를 겹치고 가장자리 칸 몇 개를 더하거나 빼서 들쭉날쭉하게. 9×6 연못 예(왼쪽 위 x,y): "
        "rect (x+1,y)~(x+6,y+2) · rect (x,y+2)~(x+4,y+5) · rect (x+4,y+1)~(x+8,y+4), 그다음 cells 로 물 더하기 (x+7,y) (x+5,y+5), "
        "바닥으로 되돌리기 (x+8,y+4) (x,y+5). 또는 `fill_region shape:\"ellipse\"`(값은 rect|ellipse|circle 셋뿐) 뒤에 가장자리 칸을 cells 로 더하고 뺀다.",
        f"- **길**: 폭 1~2칸의 굽이진 줄 하나"
        + (f"(프리뷰 길 폭 중앙값 {st['pathWidth'][0]}칸·최대 {st['pathWidth'][1]}칸)" if st['pathWidth'] else '')
        + " — `paint_tiles mode:\"line\"` 여러 번을 끝끼리 이어 꺾어 간다(2~4칸마다 한 칸 옆으로). 폭 3칸 넘는 곧은 길·십자로 금지, "
        "1~2칸 토막을 띄엄띄엄 찍기 금지(오류 그림 ⑤). 끝은 목적지(입구·물가·다리·맵 가장자리)에 닿게."
        + (" 정원 돌길은 디딤돌 물체(1칸)를 한 칸씩 굽이진 줄로 놓는다." if P['bundle'] == 'rasak_field' else ''),
        "- **2층 장식·덤불 덩이**: 3~9칸의 들쭉날쭉한 덩이를 물가·나무 밑동·벽 발치에 붙인다(프리뷰 덩이 " + clump
        + f", 장식 칸의 {st['decorNear']}%가 물가·물체 옆). 사각형·ㄴ자·2×1 막대 금지, 길을 따라 일정 간격으로 늘어놓기 금지(오류 그림 ⑥). "
        "`paint_tiles layer:\"2\" mode:\"cells\"` 에 칸 목록을 준다. 층 분해 그림 ②와 예제 배열의 \"2\" 가 본보기.",
    ]
    if indoor:
        lines = lines[:4] + [
            "- **실내는 네모 방이 정상**: 방·복도는 rect 로 짓는다(천장 테두리·벽면·바닥, 위 「방 짓기」). 들쭉날쭉하게 만들지 않는다.",
            "- **가구 덩이**: 벽을 따라 2~4개씩 붙여 놓고(침대+옷장+화분, 선반장+술통+상자), 방 가운데는 식탁 무리 하나와 깔개. "
            "가구를 방 한가운데 한 줄로 늘어놓거나 벽에서 1칸 띄워 둥둥 뜨게 두지 않는다. 출입구 앞 2칸은 비운다.",
        ]
    elif P.get('recipe') == 'city':
        lines = [l.replace("폭 3칸 넘는 곧은 길·십자로 금지", "골목은 폭 1~2칸(도시 큰길만 5~7칸 곧은 길 허용)") for l in lines]
    if P['cave']:
        lines.append("- **동굴은 손으로 짓는다**: 둘레·천장(윗면)을 1층에 넓게 칠하고 방·통로 바닥을 그 안에 한 줄로 파낸 뒤, 벽을 바닥 윗줄에 칠한다. "
                     "사전의 윗면·벽·바닥 번호와 예제 배열만 쓴다.")
    lines.append("- **이 타일셋에서 쓰지 않는 도구**(다른 칩셋 번호를 깔아 코드가 거부): run_dungeon_room_pipeline·start/advance_dungeon_room_build·"
                 "run_interior_room_pipeline·start/advance_interior_room_session·furnish_interior_space·author_village·run_village_pipeline·"
                 "generate_map·build_house·build_village·author_house·build_castle·place_concept·place_props·build_wall·build_roof.")
    return '\n'.join(lines) + '\n'


def pick_cross(b, m, cw, chh):
    W, H = m['width'], m['height']
    best, arg = -1, (0, 0)
    for y0 in range(0, H - chh + 1):
        for x0 in range(0, W - cw + 1):
            idx = [(y0 + y) * W + x0 + x for y in range(chh) for x in range(cw)]
            if any(m['L'][L][i] >= 0 and b.entries[m['L'][L][i]] and b.entries[m['L'][L][i]].get('slot') == 'composite' for L in (1, 2, 3, 4) for i in idx):
                continue
            n2 = sum(1 for i in idx if m['L'][2][i] >= 0)
            nsh = sum(1 for i in idx if m['SH'][i])
            n4 = sum(1 for i in idx if m['L'][4][i] >= 0)
            n3 = sum(1 for i in idx if m['L'][3][i] >= 0)
            sc = 4 * min(n2, 8) + 4 * min(nsh, 6) + 3 * min(n4, 6) + min(n3, 20)
            if sc > best:
                best, arg = sc, (x0, y0)
    return arg[0], arg[1], cw, chh


def build_purpose(pid, b, maps, groups, tables, out_dir, rules):
    P = PURPOSES[pid]
    m = maps[P['preview']]
    stats = layer_stats(b, m)
    kinds_used, objs_used, obj_layers = usage_in_map(b, m)
    groups_by_member = {t: g for g in groups for t in g['memberTileIds']}
    groups_by_kind = {}
    for g in groups:
        k = b.kind_of_tile.get(g['memberTileIds'][0])
        if k:
            groups_by_kind[k['key']] = g
    main_k = b.kinds[P['main_ground']]
    cat = f'`referencePurpose: "{pid}"`'
    tsid = b.id

    # ── 번호 사전: 쓰인 kind + 같은 역할 대안 ──
    kind_list = [b.kinds[key] for key, _ in kinds_used.most_common()]
    for key in P['alts']:
        k = b.kinds.get(key)
        if k and k not in kind_list:
            kind_list.append(k)
    kcode = {k['key']: f'K{i + 1}' for i, k in enumerate(kind_list)}
    used_obj_ids = [oid for oid, _ in objs_used.most_common()]
    obj_by_id = {o['id']: o for o in b.names['objects']}
    extras = pick_extras(b, set(used_obj_ids)) if len(used_obj_ids) < 40 else []
    obj_list = [obj_by_id[i] for i in used_obj_ids] + extras
    ocode = {o['id']: f'O{i + 1}' for i, o in enumerate(obj_list)}

    # ── 예제 창 ──
    wins = []
    fixed_total = 0
    for (x0, y0, w, h) in P['windows']:
        win = cut_window(m, x0, y0, w, h)
        fixed_total += fix_old_art(b, P['preview'], m, win, groups_by_member)
        # 합성 칸(프리뷰 재현 전용)이 든 창은 예제로 쓰지 않는다 — 사전이 「쓰지 말 것」이라 한 번호를 가르치게 된다.
        comp = [t for L in (1, 2, 3, 4) for t in win['L'][L] if t is not None and t >= 0 and b.entries[t] and b.entries[t].get('slot') == 'composite']
        assert not comp, (pid, (x0, y0, w, h), comp)
        wins.append(win)
    images = []

    # 1) 층 분해 그림 — 2층·그림자·4층이 모두 보이는 8×7 창을 고른다(합성 칸 없는 곳)
    cx, cy, cw, chh = pick_cross(b, m, *P['cross'][2:])
    cw_win = cut_window(m, cx, cy, cw, chh)
    fix_old_art(b, P['preview'], m, cw_win, groups_by_member)
    panels = [('① 1층 바닥', (1,)), ('② +2층 장식', (1, 2)), ('③ +그림자', (1, 2, 'sh')), ('④ +3층 물체', (1, 2, 'sh', 3)),
              ('⑤ +4층 = 완성', (1, 2, 'sh', 3, 4)), ('⑥ 3·4층만', (3, 4))]
    pimgs = []
    for name, ls in panels:
        bg = checker(cw * T, chh * T) if ls == (3, 4) else None
        pimgs.append(framed(render(b, cw_win, ls, bg=bg), cw, chh, title=name))
    pw, ph = pimgs[0].width, pimgs[0].height
    cross = Image.new('RGBA', (pw * 3 + 20, ph * 2 + 50), (24, 24, 28, 255))
    ImageDraw.Draw(cross).text((8, 8), f'{P["name"]} — 층 분해 ({SRC(P)} ({cx},{cy})부터 {cw}×{chh}칸, 그리는 순서 1→2→그림자→3→4)',
                               fill=(255, 255, 255), font=font(17))
    for i, im in enumerate(pimgs):
        cross.alpha_composite(im, (5 + (i % 3) * (pw + 5), 40 + (i // 3) * (ph + 5)))
    images.append(('cross', '층 분해', f'{SRC(P)} ({cx},{cy})부터 {cw}×{chh}칸을 층별로 쌓은 그림. ①1층 ②+2층 ③+그림자 ④+3층 ⑤+4층(완성) ⑥3·4층만(체크 무늬 = 빈칸). 칸 좌표는 창 안 배열의 열·행.', cross))

    # 2) 예제 창 그림
    for i, win in enumerate(wins):
        im = framed(render(b, win), win['w'], win['h'], title=f'예제 {i + 1} — {SRC(P)} ({win["x0"]},{win["y0"]})부터 {win["w"]}×{win["h"]}칸 (48px 원본)')
        images.append((f'example{i + 1}', f'예제 {i + 1} 완성 그림',
                       f'예제 {i + 1}의 네 층+그림자 배열을 찍은 결과(원본 48px, nearest). 가장자리 숫자 = 배열의 열·행 번호.', im))

    # 3) 자동타일 견본 (사전 K 코드 순)
    sw = swatch_image(b, [(kcode[k['key']], k) for k in kind_list], main_k['representativeTile'], groups_by_kind,
                      f'{P["name"]} — 바닥 종류 견본 (K코드 · 대표 번호 · 엔진이 3×3 덩어리를 잡은 모양)')
    images.append(('kinds', '바닥 종류 견본', '번호 사전의 K 코드 순서. 자동타일은 대표 번호로 3×3(벽 3×2·폭포 2×3)을 칠했을 때 엔진이 잡는 가장자리, 2층 장식은 이 용도의 주 바닥 위. A5 평면은 묶음의 칸을 시트 순서대로 보이고 대표 칸에 노란 테.', sw))

    # 4) 물체 도감
    cats = catalog_images(b, [(ocode[o['id']], o) for o in obj_list], f'{P["name"]} — 물체 도감 (O코드 · 층 · #첫 칸 번호)')
    for i, im in enumerate(cats[:2]):
        images.append((f'objects{i + 1}', f'물체 도감 {i + 1}', '번호 사전의 O 코드. 체크 무늬 = 투명(배열 -1 또는 투명 픽셀). #번호 = 배열 첫 칸.', im))
    dropped_catalog = max(0, len(cats) - 2)

    # 5) 오류 나란히
    err_img, err_notes = error_pairs(b, P, m, wins, groups_by_member, main_k, kind_list)
    err_caption = ('정상(왼쪽)|오류(오른쪽): ①물체를 1층 ②장식을 3층 ④1층 다시 칠함 ⑤벽면 빠뜨림 ⑥벽걸이를 바닥 줄에. 빨간 사람 = 캐릭터가 서는 자리.'
                   if P.get('interior') else
                   '정상(왼쪽)|오류(오른쪽) 6쌍: ①물체를 1층 ②장식을 3층 ④1층 다시 칠함 ⑤길 토막 ⑥장식 사각형 ③직사각형 연못(맨 아래 줄, 9×6 조리법). 빨간 사람 = 캐릭터가 서는 자리(2층·그림자 뒤, 3층 앞).')
    images.append(('errors', '정상/오류 나란히', err_caption, err_img))
    assert len(images) <= 8, (pid, len(images))

    # ── MD ──
    w, h = stats['size']
    lines = []
    def dist(L):
        n, c = stats[L]
        return f"{n}칸 / {w * h} (" + ', '.join(f'{k} {v}' for k, v in c.most_common()) + ')' if n else '0칸'
    shn, shc = stats['sh']
    sh_desc = f"{shn}칸 (" + ', '.join(f'{v}={bits_ko(v)} {c}' for v, c in shc.most_common()) + ')' if shn else '0칸 — 이 프리뷰는 그림자를 쓰지 않는다'
    obj3 = sum(1 for oid in used_obj_ids if obj_by_id[oid]['layer'] == 3)
    dens = density_stats(b, m, P['main_ground'])
    doc1 = f"""layer-model: mz4
@@ORDER@@
# {P['name']} — 규칙 (Rasak Fantasy MZ 48px · 타일셋 `{tsid}`)

{P['desc']} 번호는 이 타일셋 아틀라스의 0기준 칸 번호(한 줄 96칸, 48px) — 다른 타일셋 번호를 섞지 않는다. 쓰기 도구마다 {cat}.

{recipe_md(P, b, cat)}{density_section(P, dens, cat)}
## 네 층 + 그림자
| 층 | 도구 인자 | 무엇을 | {SRC(P)} 실측 ({w}×{h}) |
|---|---|---|---|
| 1층 바닥 | `"1"` (=lower) | 물·땅·벽·윗면 자동타일(A1~A4), A5 평면 바닥, 불투명 바닥성 물체 | {dist(1)} |
| 2층 바닥 장식 | `"2"` | 1층 위에 겹치는 가장자리 투명 자동타일(풀 가장자리·풀숲·균열·구덩이) | {dist(2)} |
| 그림자 | `paint_shadow` / `"shadow"` | 벽·절벽 오른쪽·아래 바닥 칸의 반투명 사분면 | {sh_desc} |
| 3층 물체 | `"3"` (=upper) | 나무·바위·건물 부품·소품(B~E·추가 시트) | {dist(3)} |
| 4층 물체 위 물체 | `"4"` | 3층 물체와 같은 칸에 겹치는 두 번째 물체(나무 수관이 담장 위, 등불 위 장식) | {dist(4)} |

{f"(재구성에서 1층에 있던 2층형 장식 {m['moved']}칸은 규칙대로 2층으로 옮겨 셌다.)" if m.get('moved') else ''}
그리는 순서는 1층 → 2층 → 그림자 → 3층 → 4층. 캐릭터는 2층·그림자 위, 3층 아래에 선다(★ 칸은 캐릭터 위).
통행은 위층부터 본다: 3·4층 물체가 막으면 막힘, ★ 는 건너뛰고 아래를 본다. 1층 물·벽·윗면은 막힘, 땅은 통과.

## 만드는 순서 (이 순서를 지킨다 — 1층을 다시 칠하면 그 칸의 2·3·4층·그림자가 지워진다)
1. **1층 바탕**: 주 바닥을 먼저 넓게 — 예 `paint_tiles {{mapId, layer:"1", mode:"rect", tile:{main_k['representativeTile']}, from, to, {cat[1:-1]}}}`
   ({main_k['name']}). 물·흙길·벽·윗면도 **대표 번호 하나**로 rect/fill/cells 로 칠한다 — 가장자리 모양은 엔진이 이웃을 보고 잡는다.
   같은 일을 재료 이름으로: `fill_region {{material:"<번호 사전의 이름 그대로>", layer:"1", rect}}`.
2. **2층 장식**: 2층형 kind(사전의 층=2)를 `paint_tiles layer:"2"`(또는 `fill_region layer:"2"`)로 1층 위에 얹는다. 역시 대표 번호.
3. **3층 물체**: 여러 칸 물체는 `stamp_layer_block {{x,y, layers:{{"3": 사전의 칸 배열}}, {cat[1:-1]}}}` 로 한 번에. 한 칸 물체는 `paint_tiles layer:"3" mode:"cells"`.
   물체의 (x,y)는 배열 왼쪽 위 칸. 배열의 -1 은 그 칸을 건드리지 않는다.
4. **4층**: 3층 물체가 이미 있는 칸에 또 물체를 겹칠 때만 `layers:{{"4": …}}`. 빈 칸에 올릴 물체는 3층이다(프리뷰 물체 {len(used_obj_ids)}종 중 3층 {obj3}종).
5. **그림자**: 벽·절벽·건물 오른쪽 옆 바닥 칸의 왼쪽 두 사분면 `paint_shadow {{cells:[{{x,y,quarters:["tl","bl"]}}]}}`(비트 5), 벽 끝 아래 칸은 좌상만(1) 등.
6. 확인: `show_map_region` 그림(네 층+그림자)을 보고 예제 그림과 비교한다.

## 도구 고르기
- 면·길·물가: `paint_tiles`(rect/fill/line/cells, 대표 번호) 또는 `fill_region`(재료 이름). **모양 번호(모양 1~47)를 손으로 고르지 않는다.**
- 여러 칸·여러 층 물체, 예제 통째 옮기기: `stamp_layer_block`. 예제를 번호 그대로 재현할 때는 `reshape:false`, 새 자리에 붙여 이웃과 이어 붙일 때는 기본(true).
- 그림자: `paint_shadow`(quarters 또는 bits: 1=좌상 2=우상 4=좌하 8=우하). 지우기: `tile_erase layer:"shadow"`.
- 지우기: `tile_erase layer:"2"|"3"|"4"|"shadow"` — 층을 골라 지운다(`"all"` 은 전부).
- 사전에 없는 물체는 `tile_query {{ask:"labels", mapId, query:"한글 이름"}}` 로 찾는다(칸 이름표는 「물체 이름 (행,열)」, 설명에 층·통행·배열).
  재료 이름 도구(`fill_region`)의 material 은 사전의 이름을 **글자 그대로** 쓴다. `place_props`·`build_wall`·`build_roof` 는 이 팩에서 쓰지 않는다.

## 금지
- 물체(3층 번호)를 1층에 찍기 — 바닥이 그 물체 그림으로 바뀌고 투명한 곳이 검게 뚫린다(오류 그림 ①). paint_tiles 1층은 물체를 3층으로 옮겨 주지만 stamp_layer_block 은 준 층에 그대로 쓴다.
- 2층 장식을 3층에 — 풀숲이 캐릭터 위에 그려진다(오류 그림 ②).
- 물·흙·모래 면을 rect 하나로(오류 그림 ③), 바닥 모양 번호를 손으로 이어 붙이기(가장자리가 끊긴다 — 대표 번호로 칠하고 엔진에 맡긴다).
- 2층을 칠한 뒤 그 칸 1층을 다시 칠하기 — 2층이 지워진다(오류 그림 ④). 1층을 먼저 다 끝낸다.
- 번호 사전·tile_query 결과에 없는 번호, 이름이 「합성 칸」「옛 그림자 조각」「빈 칸」인 번호.
"""
    # 사전
    kind_rows = []
    for k in kind_list:
        kind_rows.append(kind_row(b, k, kinds_used.get(k['key'], 0)).replace('| ' + k['slot'], f"| {kcode[k['key']]} | {k['slot']}", 1))
    doc2 = f"""# {P['name']} — 번호 사전 ① 바닥 종류 (타일셋 `{tsid}`)

바닥은 **대표 번호**(굵게)만 칠한다. 대표 = 모양 0(사방이 같은 종류로 이어진 안쪽). 층=1 은 `layer:"1"`, 층=2 는 `layer:"2"`.
`fill_region` 의 material 은 「이름」 열을 글자 그대로(괄호 포함). 프리뷰 사용 = {SRC(P)} 에서 그 종류가 놓인 칸 수(-: 같은 역할 대안).
견본 그림 = 이미지 「바닥 종류 견본」(K 코드 순).

| 코드 | 슬롯 kind | 이름 | 역할 | 층 | 통행 | 대표 | 모양 | 프리뷰 사용 |
|---|---|---|---|---|---|---|---|---|
""" + '\n'.join(kind_rows) + f"""

연결 규칙(이 타일셋 프리뷰 모양에 가장 잘 맞는 것으로 골랐다 — 칠하면 엔진이 이대로 가장자리를 잡는다):
{chr(10).join('- ' + r for r in rule_sentences(rules))}
- A5 평면(모양 열 「A5 평면」)은 자동타일이 아니다: 번호 그대로 놓이고, 3×3 조각(테두리 조각)은 견본 그림 배치대로 칸마다 고른다.
- 이 표 밖의 종류도 있다: `tile_query {{ask:"labels", mapId, query:"물"}}` 처럼 한글로 찾는다(이름표 「이름 — 대표·안쪽」 칸이 대표).
"""
    obj_lines = [object_line(ocode[o['id']], o, obj_layers.get(o['id'])) for o in obj_list]
    doc3 = f"""# {P['name']} — 번호 사전 ② 물체 (타일셋 `{tsid}`)

물체 배열은 `stamp_layer_block {{mapId, x, y, layers:{{"<층>": 배열}}, {cat[1:-1]}}}` 에 그대로 넣는다(행=위→아래, -1=건드리지 않음).
층=1 은 불투명 바닥성 물체(1층에 깐다), 3 은 보통 물체, 4 는 프리뷰에서 주로 다른 물체 위에 겹친 것. 빈 칸에 올릴 때는 3층.
통행: all=전부 통과, none=전부 막힘, 일부=적힌 칸(배열 행,열)만 막힘. 여러 줄 물체의 윗줄은 캐릭터 위에 그려진다. 도감 그림 = 이미지 「물체 도감」(O 코드).
O1~O{len(used_obj_ids)} 은 프리뷰에 쓰인 물체(많이 쓰인 순){', 그 뒤는 같은 시트의 쓸 만한 대안' if extras else ''}. 그 밖의 물체는 tile_query 로 한글 이름 검색.

""" + '\n'.join(obj_lines) + '\n'
    # 예제
    ex_docs = []
    for i, win in enumerate(wins):
        k_in = collections.Counter()
        o_in = collections.Counter()
        for L in (1, 2, 3, 4):
            for t in win['L'][L]:
                if t is None or t < 0:
                    continue
                k = b.kind_of_tile.get(t)
                if k:
                    k_in[kcode.get(k['key'], k['name'][:8])] += 1
                o = b.obj_of_tile.get(t)
                if o:
                    o_in[ocode.get(o[0]['id'], o[0]['id'])] += 1
        note = ''
        if P['preview'] == 'p27b':
            note = '\n둘레 암반(A4 kind 7)은 프리뷰가 옛 그림이라, 이 배열에서는 엔진이 대표 번호로 칠했을 때 잡는 모양으로 바꿔 두었다.'
        ex_docs.append(f"""## 예제 {i + 1} — {SRC(P)} ({win['x0']},{win['y0']})부터 {win['w']}×{win['h']}칸 (그림: 「예제 {i + 1} 완성 그림」)
들어 있는 것: 바닥 {', '.join(f'{c} {n}' for c, n in k_in.most_common())} · 물체 {', '.join(f'{c} {n}' for c, n in o_in.most_common()) or '없음'}{note}
빈 맵의 (x,y)에 그대로 옮기기: `stamp_layer_block {{mapId, x, y, reshape:false, {cat[1:-1]}, layers: 아래}}` (-1 = 빈칸/건드리지 않음)
```json
{win_json(win)}
```
""")
    ex_head = ("프리뷰를 잘라 낸 창의 네 층+그림자 전체 배열(행=위→아래). 층 분해는 이미지 「층 분해」.\n"
               "1·2층 바닥 번호는 엔진이 이웃을 보고 고른 **모양 번호**라 사전의 대표 번호와 다르다 — 예제를 통째로 옮길 때만 그대로 쓰고(reshape:false), "
               "새로 칠할 때는 대표 번호로 칠한다. 3·4층은 사전의 물체 배열 그대로다.\n\n")
    doc4 = f"# {P['name']} — 완성 예제 (타일셋 `{tsid}`)\n\n" + ex_head + '\n'.join(ex_docs)
    doc5 = f"""# {P['name']} — 오류 예와 자동 검사 범위

그림 「정상/오류 나란히」: 같은 창을 정상(왼쪽)·오류(오른쪽)로 칠한 실제 렌더.
{err_notes}

## 자동 검사가 막는 것
- 범위 밖 번호(`tile-out-of-range`)·맵 밖 칸(`region-out-of-bounds`): stamp_layer_block·paint_shadow 는 **하나라도 틀리면 아무 칸도 쓰지 않는다**.
- 참고문서를 다 읽기 전의 칠하기 도구 호출은 거부된다(이 용도 MD 전 페이지 + 그림 전부).
- paint_tiles `layer:"1"`/`"lower"` 에 물체 번호(홈 레이어 3층)를 주면 3층으로 옮기고 알린다. 1층 바닥성 물체(사전 층=1)는 1층에 남는다.
- 통행이 바뀌면 경고를 돌려준다(막힌 칸 수). 1·2층 자동타일은 칠할 때마다 이웃 기준으로 다시 모양을 잡는다.

## 자동 검사가 못 보는 것 (눈으로 확인)
- stamp_layer_block 은 층 선택을 믿는다 — 물체를 `"1"` 에, 장식을 `"3"` 에 줘도 그대로 쓴다(오류 ①②).
- 1층을 다시 칠해 2층·3층·그림자가 지워진 것(오류 ④), 그림자 누락·방향, 물체가 물 위에 뜬 것, 건물 부품 순서, 아름다움.
- 통행 경고는 도달 가능성(길이 막혔는지)을 보장하지 않는다. `show_map_region` 그림을 예제 그림과 나란히 보고 확인한다.
"""
    docs = [('rules', '규칙·밀도·층·순서', doc1), ('kinds', '번호 사전 ① 바닥 종류 + 오류·검사 범위', doc2 + '\n' + doc5.replace('# ', '## ', 1)),
            ('objects', '번호 사전 ② 물체', doc3), ('examples', '완성 예제', doc4)]
    # 긴 문서는 페이지(6000자)마다 나뉘어 읽힌다. 배열이 페이지 경계에서 잘리지 않게 필요하면 예제를 문서로 나눈다.
    final_docs = []
    for did, name, md in docs:
        if did == 'examples' and len(md) > 6000:
            for i, part in enumerate(ex_docs):
                final_docs.append((f'example{i + 1}', f'완성 예제 {i + 1}', f"# {P['name']} — 완성 예제 {i + 1} (타일셋 `{tsid}`)\n\n" + (ex_head if i == 0 else '') + part))
        elif len(md) + (ORDER_RESERVE if '@@ORDER@@' in md else 0) > 6000:
            # 줄 단위로 나눠 문서마다 한 페이지 — 물체 한 줄(배열)이 페이지 경계에서 잘리지 않게.
            parts, cur = [], ''
            full = len(md) + (ORDER_RESERVE if '@@ORDER@@' in md else 0)
            target = full / -(-full // 5300) + 200  # 고르게 나눈다(마지막 조각이 한두 줄만 남지 않게)
            for line in md.splitlines(keepends=True):
                if len(cur) + len(line) > min(5800, target) - (ORDER_RESERVE if '@@ORDER@@' in cur else 0) and cur:
                    parts.append(cur)
                    cur = f"# {name} (이어서)\n\n"
                cur += line
            parts.append(cur)
            for i, part in enumerate(parts):
                final_docs.append((f'{did}{i + 1}', f'{name} ({i + 1}/{len(parts)})', part))
        else:
            final_docs.append((did, name, md))
    img_ids = [iid for iid, _, _, _ in images]
    order = (f"읽는 순서 — 이 용도(categoryId \"{pid}\", tilesetId \"{tsid}\")의 전부다. id 를 지어내지 말 것:\n"
             f"문서 documentId: {' → '.join(d for d, _, _ in final_docs)} · 그림 imageId: {' → '.join(img_ids)}")
    final_docs = [(d, n, md.replace('@@ORDER@@', order)) for d, n, md in final_docs]
    assert all(len(md) <= 6000 for _, _, md in final_docs), [(d, len(md)) for d, _, md in final_docs]
    category = {
        'id': pid, 'name': P['name'],
        'description': f"{P['desc']} MZ식 4층(1 바닥·2 바닥 장식·3 물체·4 물체 위)+그림자. 규칙→번호 사전→완성 예제→오류 순서로 읽는다.",
        'documents': [{'id': did, 'name': name, 'markdown': md} for did, name, md in final_docs],
        'images': [],
    }
    for iid, name, caption, im in images:
        category['images'].append({'id': iid, 'name': name, 'caption': caption, 'dataUrl': to_data_url(im)})
        im.convert('RGB').save(PREVIEW_DIR / f'{pid}_{iid}.png')
    for did, name, md in final_docs:
        (out_dir / 'docs' / f'{pid}_{did}.md').write_text(md)
    info = {
        'documents': [{'id': did, 'chars': len(md), 'pages': -(-len(md) // 6000)} for did, _, md in final_docs],
        'images': [{'id': iid, 'size': [im.width, im.height], 'bytes': len(base64.b64decode(to_data_url(im).split(',')[1]))} for iid, _, _, im in images],
        'kinds': len(kind_list), 'kindsUsed': len(kinds_used), 'objects': len(obj_list), 'objectsUsed': len(used_obj_ids),
        'windows': [(wn['x0'], wn['y0'], wn['w'], wn['h']) for wn in wins], 'oldArtCellsReplaced': fixed_total, 'density': dens,
        'catalogPagesDropped': dropped_catalog,
    }
    return category, info


def side_by_side(rows, title):
    """정상 | 오류 나란히. rows = [[(제목, 정상그림, 오류그림, 설명), …], …] — 한 줄에 쌍 한두 개."""
    pairs = [p for r in rows for p in r]
    cell_w = max(a.width + b2.width for _, a, b2, _ in pairs) + 30
    cell_w = max(a.width + b2.width for r in rows if len(r) > 1 for _, a, b2, _ in r) + 30 if any(len(r) > 1 for r in rows) else cell_w
    row_h = [max(max(a.height, b2.height) for _, a, b2, _ in r) + 70 for r in rows]
    width = max(max(cell_w * len(r), max(a.width + b2.width + 30 for _, a, b2, _ in r)) for r in rows) + 10
    img = Image.new('RGBA', (width, sum(row_h) + 44), (30, 30, 36, 255))
    d = ImageDraw.Draw(img)
    d.text((10, 8), title, fill=(255, 255, 255), font=font(18))
    y = 40
    for r, rh in zip(rows, row_h):
        for ci, (name, good, bad, note) in enumerate(r):
            x = 10 + ci * cell_w
            d.text((x, y), name, fill=(255, 230, 120), font=font(15))
            d.text((x, y + 21), note, fill=(225, 225, 225), font=font(12))
            yy = y + 42
            img.alpha_composite(good, (x, yy))
            img.alpha_composite(bad, (x + good.width + 10, yy))
            d.text((x + 4, yy + 3), '정상', fill=(120, 255, 140), font=font(15), stroke_width=2, stroke_fill=(0, 0, 0))
            d.text((x + good.width + 14, yy + 3), '오류', fill=(255, 110, 110), font=font(15), stroke_width=2, stroke_fill=(0, 0, 0))
        y += rh
    return img


def crop_win(win, x0, y0, w, h):
    x0 = max(0, min(x0, win['w'] - w))
    y0 = max(0, min(y0, win['h'] - h))
    W = win['w']
    out = {'w': w, 'h': h, 'x0': win['x0'] + x0, 'y0': win['y0'] + y0, 'L': {}, 'SH': []}
    for L in (1, 2, 3, 4):
        out['L'][L] = [win['L'][L][(y0 + y) * W + x0 + x] for y in range(h) for x in range(w)]
    out['SH'] = [win['SH'][(y0 + y) * W + x0 + x] for y in range(h) for x in range(w)]
    return out, (x0, y0)


def best_box(win, cells, w, h):
    """cells(창 안 칸 번호) 를 가장 많이 담는 w×h 상자의 왼쪽 위."""
    W, H = win['w'], win['h']
    pts = [(i % W, i // W) for i in cells]
    best, arg = -1, (0, 0)
    for y0 in range(0, max(1, H - h + 1)):
        for x0 in range(0, max(1, W - w + 1)):
            n = sum(1 for x, y in pts if x0 <= x < x0 + w and y0 <= y < y0 + h)
            if n > best:
                best, arg = n, (x0, y0)
    return arg


def shape_all(wn, groups_by_member, layers=(1, 2)):
    """창 배열의 자동타일 칸을 엔진 규칙(그룹 variantMap + 연결 집합)으로 한 번에 모양 잡는다."""
    for L in layers:
        src = list(wn['L'][L])
        for i, t in enumerate(src):
            g = groups_by_member.get(t)
            if g:
                mk = mask_at(src, wn['w'], wn['h'], i % wn['w'], i // wn['w'], g['_connect'], g['neighborhood'])
                wn['L'][L][i] = g['variantMap'][str(mk)]


def wcopy(wn):
    return {'w': wn['w'], 'h': wn['h'], 'x0': wn['x0'], 'y0': wn['y0'], 'L': {L: list(v) for L, v in wn['L'].items()}, 'SH': list(wn['SH'])}


def opaque(b, t):
    return sum(1 for a in b.tile(t).getchannel("A").tobytes() if a > 128)


def error_pairs(b, P, m, wins, groups_by_member, main_k, kind_list):
    """정상/오류 네 쌍을 실제로 변조해 그린다(6×5칸 crop). 설명 문장(맵 좌표 포함)도 돌려준다."""
    CW, CH = 6, 5
    notes, pairs = [], []
    win = wins[0]

    # ① 물체를 1층에: 3층 물체 칸을 1층에 옮겨 적는다(바닥이 사라진다)
    objcells = [i for i, t in enumerate(win['L'][3]) if t is not None and t >= 0 and b.obj_of_tile.get(t) and b.obj_of_tile[t][0]['layer'] != 1]
    bx, by = best_box(win, objcells, CW, CH)
    good, _ = crop_win(win, bx, by, CW, CH)
    bad = wcopy(good)
    moved = []
    for i, t in enumerate(good['L'][3]):
        if t is not None and t >= 0 and b.obj_of_tile.get(t) and b.obj_of_tile[t][0]['layer'] != 1:
            bad['L'][1][i], bad['L'][3][i], bad['L'][2][i] = t, -1, -1
            moved.append((good['x0'] + i % CW, good['y0'] + i // CW))
    pairs.append(('① 물체를 1층에 찍음', framed(render(b, good), CW, CH, ticks=False), framed(render(b, bad), CW, CH, ticks=False),
                  f'3층 물체 {len(moved)}칸을 layers["1"] 로: 바닥이 물체 그림으로 바뀌고 투명한 곳이 검다.'))
    notes.append(f"- ① 물체를 1층에: {SRC(P)} ({good['x0']},{good['y0']})부터 {CW}×{CH}칸의 3층 물체 {len(moved)}칸(맵 좌표 {moved[:4]}…)을 1층에 적으면 "
                 f"그 칸 바닥이 사라지고 투명 부분이 검게 뚫린다. stamp_layer_block 은 막지 않는다.")

    # ② 장식을 3층에: 가장 불투명한 2층 장식 칸에 캐릭터를 세운다
    # 캐릭터가 설 수 있는(통과) 2층 장식이 가장 많은 예제 창
    def walk2(wn):
        return [i for i, t in enumerate(wn['L'][2]) if t is not None and t >= 0 and b.kind_of_tile.get(t) and b.kind_of_tile[t]['passable']]
    src = max(wins, key=lambda wn: len(walk2(wn)))
    cells2 = walk2(src)
    if len(cells2) < 3:  # 걸을 수 있는 2층 장식이 거의 없는 용도면 사전의 2층형 장식으로 한 덩이 만든다
        src = wcopy(win)
        deco = next((k for k in kind_list if k['layer'] == 2 and k['passable'] and k['autotile'] == 'floor'), None) \
            or next((k for k in b.names['kinds'] if k['layer'] == 2 and k['passable'] and k['autotile'] == 'floor'), None)
        g = groups_by_member[deco['tiles'][0]]
        blk = [(x, y) for y in range(1, 4) for x in range(1, 5)]
        arr = [-1] * (src['w'] * src['h'])
        for x, y in blk:
            arr[y * src['w'] + x] = deco['tiles'][0]
        for x, y in blk:
            mk = mask_at(arr, src['w'], src['h'], x, y, set(g['memberTileIds']), 8)
            src['L'][2][y * src['w'] + x] = g['variantMap'][str(mk)]
        cells2 = [y * src['w'] + x for x, y in blk]
    ci = max(cells2, key=lambda i: (opaque(b, src['L'][2][i]), src['L'][3][i] in (None, -1)))
    cx, cy = ci % src['w'], ci // src['w']
    good2, (ox, oy) = crop_win(src, cx - CW // 2, cy - CH // 2, CW, CH)
    bad2 = wcopy(good2)
    lifted = 0
    for i, t in enumerate(good2['L'][2]):
        if t is not None and t >= 0 and bad2['L'][3][i] in (None, -1):
            bad2['L'][3][i], bad2['L'][2][i] = t, -1
            lifted += 1
    cxy = (cx - ox, cy - oy)

    def with_char(wn):
        base = render(b, wn, (1, 2, 'sh'))
        draw_character(base, *cxy)
        base.alpha_composite(render(b, wn, (3, 4), bg=Image.new('RGBA', base.size, (0, 0, 0, 0))))
        return framed(base, wn['w'], wn['h'], ticks=False)
    pairs.append(('② 2층 장식을 3층에 찍음', with_char(good2), with_char(bad2), '2층 장식이 3층에 있으면 캐릭터(빨강) 위에 그려진다.'))
    notes.append(f"- ② 장식을 3층에: 2층 장식 {lifted}칸을 3층으로 올리면 캐릭터가 맵 ({good2['x0'] + cxy[0]},{good2['y0'] + cxy[1]}) 칸에 섰을 때 "
                 "장식이 몸 위에 그려진다. 통행 검사로는 안 보인다.")

    # ③ 연못 모양: 직사각형 하나 / 사각형 셋 겹치고 가장자리 칸을 더하고 뺀 들쭉날쭉(규칙 문서의 9×6 조리법 그대로, 엔진 모양)
    blob_kind = next((k for k in kind_list if k['role'] == 'water' and k['autotile'] == 'floor'), None) \
        or next((k for k in kind_list if k['role'] == 'ground' and k['autotile'] == 'floor' and k is not main_k), None)
    PW, PH, ox, oy = 11, 8, 1, 1
    pond_base = main_k if main_k['autotile'] or main_k['slot'] == 'A5' else main_k
    def pond_win():
        return {'w': PW, 'h': PH, 'x0': 0, 'y0': 0, 'L': {1: [pond_base['representativeTile']] * (PW * PH), 2: [-1] * (PW * PH), 3: [-1] * (PW * PH), 4: [-1] * (PW * PH)}, 'SH': [0] * (PW * PH)}
    rect_p, rag_p = pond_win(), pond_win()
    wt = blob_kind['representativeTile']
    for y in range(6):
        for x in range(9):
            rect_p['L'][1][(oy + y) * PW + ox + x] = wt
    def put(x0, y0, x1, y1, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                rag_p['L'][1][(oy + y) * PW + ox + x] = t
    put(1, 0, 6, 2, wt); put(0, 2, 4, 5, wt); put(4, 1, 8, 4, wt)
    for x, y in ((7, 0), (5, 5)):
        put(x, y, x, y, wt)
    for x, y in ((8, 4), (0, 5)):
        put(x, y, x, y, pond_base['representativeTile'])
    for wn in (rect_p, rag_p):
        shape_all(wn, groups_by_member)
    pond_pair = ('③ 직사각형 연못 vs 들쭉날쭉 연못', framed(render(b, rag_p), PW, PH, ticks=False), framed(render(b, rect_p), PW, PH, ticks=False),
                 '정상 = 규칙의 9×6 조리법(사각형 셋 + 칸 넷). 오류 = rect 하나 — 프리뷰에 없는 모양.')
    notes.append(f"- ③ 직사각형 연못: {blob_kind['name']} 을(를) rect 하나로 칠하면 네모 연못이 된다. 규칙 문서의 9×6 조리법(겹친 사각형 셋 + 가장자리 칸 넷)으로 칠한 것이 정상. "
                 "모양 번호를 손으로 이어 붙이거나 reshape:false 로 대표 번호만 늘어놓아도 물가가 끊긴다 — 대표 번호로 칠하고 엔진에 맡긴다.")

    # ④ 2층 뒤 1층 다시 칠하기: 2층이 사라진다
    src4 = max(wins, key=lambda wn: sum(1 for t in wn['L'][2] if t is not None and t >= 0))
    c4 = [i for i, t in enumerate(src4['L'][2]) if t is not None and t >= 0]
    if not c4:
        src4, c4 = src, cells2
    bx, by = best_box(src4, c4, CW, CH)
    good4, _ = crop_win(src4, bx, by, CW, CH)
    bad4 = wcopy(good4)
    wiped = []
    for i, t in enumerate(good4['L'][2]):
        if t is not None and t >= 0:
            bad4['L'][2][i] = -1
            wiped.append((good4['x0'] + i % CW, good4['y0'] + i // CW))
    pairs.append(('④ 2층 뒤에 그 칸 1층을 다시 칠함', framed(render(b, good4), CW, CH, ticks=False), framed(render(b, bad4), CW, CH, ticks=False),
                  f'2층 장식 {len(wiped)}칸이 지워진다(3·4층·그림자도). 1층을 먼저 끝낸다.'))
    notes.append(f"- ④ 순서 틀림: {SRC(P)} ({good4['x0']},{good4['y0']})부터 {CW}×{CH}칸에서 1층을 다시 칠하면 2층 장식 {len(wiped)}칸(맵 좌표 {wiped[:4]}…)이 사라진다. "
                 "paint_tiles 1층은 3·4층·그림자도 비운다.")
    # ⑤ 길: 한 줄로 이어 칠함 / 1~2칸 토막을 띄엄띄엄
    base_k, path_k = b.kinds[P['path'][0]], b.kinds[P['path'][1]]
    ww, hh = CW, CH
    good5 = {'w': ww, 'h': hh, 'x0': 0, 'y0': 0, 'L': {1: [base_k['representativeTile']] * (ww * hh), 2: [-1] * (ww * hh), 3: [-1] * (ww * hh), 4: [-1] * (ww * hh)}, 'SH': [0] * (ww * hh)}
    bad5 = wcopy(good5)
    run = [(0, 1), (1, 1), (2, 1), (3, 1), (3, 2), (3, 3), (4, 3), (5, 3), (0, 2), (1, 2), (2, 2), (4, 2), (4, 4), (5, 4)]
    dashes = [(0, 1), (2, 1), (3, 3), (5, 3), (5, 4), (1, 2)]
    for x, y in run:
        good5['L'][1][y * ww + x] = path_k['representativeTile']
    for x, y in dashes:
        bad5['L'][1][y * ww + x] = path_k['representativeTile']
    for wn in (good5, bad5):
        shape_all(wn, groups_by_member)
    pairs.append(('⑤ 길을 토막으로 찍음', framed(render(b, good5), ww, hh, ticks=False), framed(render(b, bad5), ww, hh, ticks=False),
                  f"{path_k['name'][:14]}: 한 줄(line/rect)로 이어야 길이 된다. 토막은 둥근 조각."))
    notes.append(f"- ⑤ 길 토막: {path_k['name']} 대표 {path_k['representativeTile']} 를 1~2칸씩 띄엄띄엄 찍으면 칸마다 둥근 조각이 생긴다. "
                 "정상 = paint_tiles mode:\"line\"/\"rect\" 한 번(또는 이어진 칸 목록)으로 끊김 없이, 끝은 목적지에 닿게.")

    # ⑥ 2층 장식 덩이: 물가를 따라 들쭉날쭉(정상) / 같은 칸 수의 사각형(오류). 장식 kind = 프리뷰 2층에 가장 많이 쓰인 것,
    #    바탕 = 프리뷰에서 그 장식 밑에 가장 많이 깔린 1층 종류(장식이 보이게).
    deco_count, under = collections.Counter(), collections.Counter()
    for i, t in enumerate(m['L'][2]):
        k = b.kind_of_tile.get(t)
        if k:
            deco_count[k['key']] += 1
            uk = b.kind_of_tile.get(m['L'][1][i])
            if uk and uk['layer'] == 1 and uk['role'] != 'water':
                under[uk['key']] += 1
    deco_k = b.kinds[deco_count.most_common(1)[0][0]] if deco_count else (next((k for k in kind_list if k['layer'] == 2), None) or next(k for k in b.names['kinds'] if k['layer'] == 2))
    under_k = b.kinds[under.most_common(1)[0][0]] if under else main_k
    water6 = [(x, y) for y in range(CH) for x in range(4, CW)] + [(3, 2), (3, 3)]
    hug = [(3, 0), (3, 1), (2, 1), (2, 2), (1, 2), (2, 3), (2, 4), (3, 4), (1, 4)]
    box = [(x, y) for y in range(0, 3) for x in range(0, 3)]
    good6 = {'w': CW, 'h': CH, 'x0': 0, 'y0': 0, 'L': {1: [under_k['representativeTile']] * (CW * CH), 2: [-1] * (CW * CH), 3: [-1] * (CW * CH), 4: [-1] * (CW * CH)}, 'SH': [0] * (CW * CH)}
    if blob_kind and blob_kind['role'] == 'water':
        for x, y in water6:
            good6['L'][1][y * CW + x] = blob_kind['representativeTile']
    bad6 = wcopy(good6)
    for x, y in hug:
        if good6['L'][1][y * CW + x] == under_k['representativeTile']:
            good6['L'][2][y * CW + x] = deco_k['representativeTile']
    for x, y in box:
        bad6['L'][2][y * CW + x] = deco_k['representativeTile']
    for wn in (good6, bad6):
        shape_all(wn, groups_by_member)
    pairs.append(('⑥ 2층 장식을 사각형으로', framed(render(b, good6), CW, CH, ticks=False), framed(render(b, bad6), CW, CH, ticks=False),
                  f"{deco_k['name'][:12]}: 물가·밑동을 따라 들쭉날쭉(정상) / 3×3 사각형(오류)."))
    near_pct = density_stats(b, m, P['main_ground'])['decorNear']
    notes.append(f"- ⑥ 장식 모양: 프리뷰 2층 장식 칸의 {near_pct}%가 물가·물체 옆에 붙어 있다. {deco_k['name']} 을(를) 3×3 사각형으로 칠하면 인공적으로 보인다 — "
                 "물가·나무 밑동을 따라 cells 모드로 들쭉날쭉한 칸 목록을 준다.")
    if P.get('interior'):
        pairs, notes = pairs[0:3], [n for n in notes if n[2] in '①②④']
        # ⑤ 벽면 빠뜨림: 벽(A4 벽형) 칸을 바닥 대표로 — 천장 바로 밑에 바닥이 붙는다
        g5, _ = crop_win(win, 0, 0, CW, CH)
        b5 = wcopy(g5)
        n5 = 0
        for i, t in enumerate(g5['L'][1]):
            k = b.kind_of_tile.get(t)
            if k and k['role'] == 'wall':
                b5['L'][1][i] = main_k['representativeTile']
                for L in (3, 4):
                    b5['L'][L][i] = -1
                n5 += 1
        shape_all(b5, groups_by_member)
        pairs.append(('⑤ 벽면을 빠뜨림', framed(render(b, g5), CW, CH, ticks=False), framed(render(b, b5), CW, CH, ticks=False),
                      f'벽면 {n5}칸 없이 천장 바로 밑에 바닥 — 방이 납작하고 창·액자를 걸 곳이 없다.'))
        notes.append(f"- ⑤ 벽면 빠뜨림: 방 안쪽 맨 윗 2줄은 A4 벽 번호다. 바닥으로 칠하면 천장 테두리 바로 밑이 바닥이 되어 방이 납작해진다(그림 ⑤ 오른쪽).")
        # ⑥ 벽걸이를 바닥 줄에: 이름에 「벽걸이」가 있는 3층 물체를 2줄 아래로
        hung = [i for i, t in enumerate(win['L'][3]) if t is not None and t >= 0 and b.obj_of_tile.get(t) and '벽걸이' in b.obj_of_tile[t][0]['name']]
        if hung:
            bx, by = best_box(win, hung, CW, CH)
            g6, _ = crop_win(win, bx, max(0, by), CW, CH)
            b6 = wcopy(g6)
            moved6 = 0
            for i in range(CW * CH - 1, -1, -1):
                t = g6['L'][3][i]
                if t is not None and t >= 0 and b.obj_of_tile.get(t) and '벽걸이' in b.obj_of_tile[t][0]['name']:
                    b6['L'][3][i] = -1
                    j = i + 2 * CW
                    if j < CW * CH:
                        b6['L'][3][j] = t
                    moved6 += 1
            pairs.append(('⑥ 벽걸이를 바닥 줄에', framed(render(b, g6), CW, CH, ticks=False), framed(render(b, b6), CW, CH, ticks=False),
                          '창·액자(이름에 「벽걸이」)는 벽면 줄에. 바닥으로 내리면 창이 바닥에 떠 있다.'))
            notes.append("- ⑥ 벽걸이 위치: 이름에 「벽걸이」가 있는 물체는 벽면 두 줄 위 3층이다. 2줄 아래 바닥에 놓으면 창·액자가 방 가운데 떠 보인다(그림 ⑥).")
        rows = [pairs[0:2], pairs[2:4], pairs[4:5]]
        return side_by_side(rows, f"{P['name']} — 정상 | 오류 (48px)"), '\n'.join(sorted(notes, key=lambda n: n[2]))
    rows = [pairs[0:2], pairs[2:4], pairs[4:5], [pond_pair]]  # ①② · ④⑤ · ⑥ · ③(연못, 넓어서 한 줄)
    return side_by_side(rows, f"{P['name']} — 정상 | 오류 (48px)"), '\n'.join(sorted(notes, key=lambda n: n[2]))


# ───────────────────────── main ─────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--assets', default='~/third-party-assets/rasak')
    ap.add_argument('--original', default='/tmp/mzai/pack/original-tilesets.json')
    ap.add_argument('--out', default='/tmp/mzai/pack')
    ap.add_argument('--preview-dir', default='/tmp/mzai/pack-preview', help='참고문서 그림 사본(눈으로 확인용)')
    a = ap.parse_args()
    root = Path(os.path.expanduser(a.assets))
    out = Path(a.out)
    global PREVIEW_DIR
    PREVIEW_DIR = Path(a.preview_dir)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (out / 'docs').mkdir(parents=True, exist_ok=True)
    # 이름표·마스크 표: 사용자 로컬 작업본이 있으면 그것, 없으면 저장소 사본(tiledata/rasak-fantasy/).
    repo_copy = Path(__file__).resolve().parents[3] / 'tiledata' / 'rasak-fantasy'
    def knowledge(name):
        local = root / 'knowledge' / name
        return json.loads((local if local.exists() else repo_copy / name).read_text())
    names = knowledge('names.json')
    masks = knowledge('mz-autotile-masks.json')
    original = json.loads(Path(a.original).read_text())
    tables = masks_tables(masks)
    maps = load_maps(root)
    pack = {'generated': 'build_assistant_pack.py', 'tilesets': {}, 'verification': {}, 'purposes': {}}
    for bid in BUNDLES:
        b = Bundle(root, bid, names, original)
        norm = {p: normalize_decor(b, maps[p]) for p in [PURPOSES[q]['preview'] for q in TILESET_PURPOSES[bid]]}
        groups, verify = build_autotile_groups(b, norm, tables, maps)
        verify['decorMovedToLayer2'] = {p: n['moved'] for p, n in norm.items()}
        pack.setdefault('normalized', {}).update({n['id']: {'L1': n['L'][1], 'L2': n['L'][2], 'replaced': sorted(n['replaced'])} for n in norm.values()})
        meta, prio, passab, changes = build_tile_meta(b)
        tgroups = build_tile_groups(b)
        cats = []
        for pid in TILESET_PURPOSES[bid]:
            cat, info = build_purpose(pid, b, norm, groups, tables, out, verify['rules'])
            cats.append(cat)
            pack['purposes'][pid] = info
        clean = [{k: v for k, v in g.items() if not k.startswith('_')} for g in groups]
        pack['tilesets'][bid] = {'tileMeta': meta, 'priority': prio, 'passability': passab, 'tileGroups': tgroups,
                                 'autotileGroups': clean, 'referenceDocuments': cats}
        pack['verification'][bid] = {'autotile': verify, 'metaChanges': changes,
                                     'rules': {g['id']: g['_rule'] for g in groups if g['_rule'] != 'own'}}
        print(bid, 'groups', len(groups), 'tileGroups', len(tgroups), 'changes', changes)
        print('  autotile chosen(norm)', {k: v['pct'] for k, v in verify['chosen'].items() if ':' not in k or k.startswith('p')})
        print('  autotile chosen(raw)', {k: v['pct'] for k, v in verify['rawChosen'].items() if ':' not in k or k.startswith('p')})
        print('  autotile sameKind', {k: v['pct'] for k, v in verify['sameKind'].items() if ':' not in k or k.startswith('p')})
        print('  rules', {k: v['chosen'] for k, v in verify['rules'].items()})
    (out / 'pack.json').write_text(json.dumps(pack, ensure_ascii=False))
    (out / 'report.json').write_text(json.dumps({'verification': pack['verification'], 'purposes': pack['purposes']}, ensure_ascii=False, indent=1))
    print(json.dumps(pack['purposes'], ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
