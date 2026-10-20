#!/usr/bin/env python3
"""jp_city 블록 `jp_shore` - 바다·강 물가 오토타일과 부두 콘크리트(2026-10-20 사용자 승인 시안 → 굽기).

시안: ~/claude-viz/modern-tiles-proto/water/ (shore.py). 그림 코드는 lib_blocks/water_art.py 를 jp_regions_pack 과 같이 쓴다.

오토타일 4종(8방, canon 47칸, 바깥 지형 하나 가정):
  jp-shore-sea-sand  바다 ↔ 모래사장  : 젖은 모래 띠 → 거품 줄 → 거품 레이스 → 얕은 청록 → 바다. 모래 질감(gnd/sand)이 물 칸 안으로 흔들려 들어온다.
  jp-shore-sea-quay  바다 ↔ 부두·안벽 : 북쪽이 땅이면 갓돌 밑 콘크리트 블록 높이면(3/4) → 젖은 이끼 띠 → 거품 → 그늘 물,
                                        동·서·남쪽 땅은 윤곽 + 그늘 물 띠. 땅 질감을 품지 않으므로 잔디·광장·부두 어느 땅과도 쓴다(호안).
  jp-river-bank      계곡 강 ↔ 숲 바닥 : 북쪽 둑은 흙 높이면 3px + 그늘 물, 동·서·남 둑은 1px 흙 테 + 젖은 띠. 숲 바닥(gnd/forest) 질감을 품는다.
  jp-quay-deck       부두 콘크리트 판 ↔ 물 : 판석 + 물 쪽 갓돌 테(남쪽은 갓돌 윗면·앞면). 땅 쪽(광장·보도)은 이어진 것으로 센다.
바닥 단칸 그룹(지역 구성기 paintJpRegionGround 재료): jp:region-river 「계곡 강」, jp:region-quay 「부두 콘크리트」.
바다 몸통 변형 sea.v1..v9(jp:sea-body) — jp_regions_pack 의 gnd/sea(v0)와 같은 바탕·테두리라 어느 순서로 붙여도 이음매가 없다.
깊이 고리(jp:shore-ring:…)·다리 그늘(jp:shore-bridge:…) 칸 — 안벽·둑 옆 물이 바다 쪽으로 옅어지는 그늘(2026-10-20 셋째 판, water_art.shade_field).
구성기(src/editor/jpCity/shorePass.ts)가 바다·강·부두 칸의 이웃을 보고 이 칸들로 바꾼다.

  python3 scripts/content/jp-city/blocks/jp_shore.py [OUT_DIR]   # selftest + 판 렌더 + 3/4 관문 그림(_gate/items.jsonl)
"""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from lib_blocks import ground_autotile as GA  # noqa: E402
from lib_blocks import water_art as WA  # noqa: E402

BLOCK = 'jp_shore'
ROOT = WA.ROOT
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
CANON = GA.CANON
N_SEA_VAR = WA.N_SEA_BODY   # 바다 몸통 변형 v0(gnd/sea, jp_regions_pack) + v1..v9(여기; v6..v9 는 2026-10-20 셋째 판 덧붙임)
N_RIVER_VAR = 4
N_QUAY_VAR = 4


def _ground_px(name):
    """jp_regions_pack 바닥 몸통 칸의 화소 함수(물가 칸 안으로 파고드는 땅 질감)."""
    import jp_regions_pack as RP
    from house_kit import Cv as HCv
    c = HCv(16, 16); RP.GROUND[name][0](c)
    a = c.a.copy()
    return lambda x, y: (int(a[y % 16, x % 16, 0]) << 16) | (int(a[y % 16, x % 16, 1]) << 8) | int(a[y % 16, x % 16, 2])


def _mloc(prefix, m):
    return '%s.m%d' % (prefix, m)


# 깊이 고리 키: 'N<북 줄 3>W<서 열 3>E<동 열 3>' — 5×5 둘레(거리 2)의 그늘 땅 비트(북 줄은 서→동, 열은 북→남).
_PATS = ('111', '110', '011', '100', '001', '010')
_CPATS = ('111', '110', '011', '100', '001')
RING_KEYS = []
for _p in _PATS:
    RING_KEYS += [WA.ring_key(_p, '000', '000'), WA.ring_key('000', _p, '000'), WA.ring_key('000', '000', _p)]
for _a in _CPATS:
    for _b in _CPATS:
        RING_KEYS += [WA.ring_key(_a, _b, '000'), WA.ring_key(_a, '000', _b)]
RING_KEYS += [WA.ring_key('000', '111', '111'), WA.ring_key('111', '111', '111')]
RING_KEYS = list(dict.fromkeys(RING_KEYS))
# 고리 칸 변형: 한 면 키 3벌, 두 면 키 2벌 — 밑 물 무늬와 디더 어긋남(dv)이 다르다(셋째 판 r2: 긴 벽을 따라 16px 빗살이 보였다).
RING_VARIANTS = {k: (3 if sum(1 for side in (k[1:4], k[5:8], k[9:12]) if '1' in side) == 1 else 2) for k in RING_KEYS}
# 다리 그늘: 강 가장자리(서·동 둑) 마스크와 4칸 폭 강의 고리 키(다리가 둑 위까지 덮으므로 다리 줄 칸은 물로 센다 → 011)
BRIDGE_MASKS = (55, 205)
BRIDGE_RING_KEYS = (WA.ring_key('000', '011', '000'), WA.ring_key('000', '000', '011'), WA.ring_key('000', '111', '000'), WA.ring_key('000', '000', '111'))

SETS = (
    # prefix, autotile id, kind, land, 이름, 바깥 땅 질감
    ('sea-sand', 'jp-shore-sea-sand', 'sea', 'S', '바다 · 모래 해변 물가', 'gnd/sand'),
    ('sea-quay', 'jp-shore-sea-quay', 'sea', 'D', '바다 · 부두 안벽(호안)', None),
    ('river-bank', 'jp-river-bank', 'river', 'G', '계곡 강 · 자연 둑', 'gnd/forest'),
)


def _cell(img, pc, label, desc, tags):
    return dict(img=img, pc=pc, label=label, desc=desc, tags=list(tags))


_CACHE = {}


def build():
    if 'b' in _CACHE: return _copy(_CACHE['b'])
    cells = collections.OrderedDict(); autotiles = []; groups = []
    # 바다 몸통 변형 v1..v5
    sea_vars = []
    for v in range(1, N_SEA_VAR):
        loc = 'sea.v%d' % v; sea_vars.append(loc)
        cells[loc] = _cell(WA.water_body('sea', v).img(), 'solidfloor', '바다 · 몸통 변형 %d' % v,
                           '바다 몸통 변형(걸을 수 없음). 바탕·테두리가 gnd/sea 와 같아 어느 순서로 붙여도 이음매가 없다. 구성기가 칸 위치 해시로 고른다.', ['물', '바다', 'water'])
    river_vars = []
    for v in range(N_RIVER_VAR):
        loc = 'river.v%d' % v; river_vars.append(loc)
        cells[loc] = _cell(WA.water_body('river', v).img(), 'solidfloor', '계곡 강 · 몸통%s' % ('' if v == 0 else ' 변형 %d' % v),
                           '계곡·산골 강물(남북으로 흐르는 물살 줄, 걸을 수 없음). 둑은 jp-river-bank 오토타일.', ['물', '강', '계곡', 'water'])
    quay_vars = []
    for v in range(N_QUAY_VAR):
        loc = 'quay.v%d' % v; quay_vars.append(loc)
        cells[loc] = _cell(WA.quay_deck_cell(255, v).img(), 'floor', '부두 콘크리트 · 판%s' % ('' if v == 0 else ' 변형 %d' % v),
                           '항구 부두·안벽 위 콘크리트 판석(걷는다). 물과 맞닿는 칸은 jp-quay-deck 갓돌 테 칸.', ['부두', '안벽', '콘크리트', '항구'])
    # 물가 오토타일 3종
    for prefix, aid, kind, land, name, land_cell in SETS:
        lp = _ground_px(land_cell) if land_cell else None
        members = []
        for i, m in enumerate(CANON):
            if kind == 'river' and m == 255:
                members.append(river_vars[0]); continue
            loc = _mloc(prefix, m); members.append(loc)
            img = WA.shore_cell(kind, land, m, lp, v=(0 if m == 255 else i % 3)).img()
            cells[loc] = _cell(img, 'solidfloor', '%s · %s' % (name, GA.describe_mask(m)),
                               '%s 오토타일 칸(마스크 %d). 물(걸을 수 없음).' % (name, m), ['물', 'autotile', prefix])
        # 곧은 물가(한 변만 땅) 대체 칸 2개씩 — 긴 해안·강둑이 16px 마다 똑같이 되풀이되지 않게 구성기가 해시로 섞는다.
        # 칸 양끝 흔들림이 기본 칸과 같아 어느 순서로 붙어도 이어진다. 그룹 jp:shore-alt:<오토타일>:<마스크>.
        # 부두 안벽(D)도 셋째 판부터 대체 칸 2개 — 거품 점 위치만 다르다(긴 부두 옆면이 16px 마다 같은 무늬로 읽히지 않게).
        if True:
            for side in ('N', 'E', 'S', 'W'):
                m = GA.canon(255 & ~GA.DIRS[side] & ~{'N': 16 | 128, 'S': 32 | 64, 'E': 16 | 32, 'W': 64 | 128}[side])
                alts = []
                for alt in ((1, 2, 3, 4) if land == 'D' else (1, 2)):
                    loc = '%s.m%d.a%d' % (prefix, m, alt); alts.append(loc)
                    cells[loc] = _cell(WA.shore_cell(kind, land, m, lp, v=CANON.index(m) % 3, alt=alt).img(), 'solidfloor',
                                       '%s · %s (대체 %d)' % (name, GA.describe_mask(m), alt), '%s 곧은 물가 대체 칸(마스크 %d). 물(걸을 수 없음).' % (name, m), ['물', 'autotile', prefix])
                # (안벽 대체 칸 3·4 는 셋째 판 r2 덧붙임 — 거품 점이 16px 마다 같은 자리에 오지 않게)
                members += alts
                groups.append(dict(id='jp:shore-alt:%s:%d' % (aid, m), name='%s · %s 대체' % (name, GA.describe_mask(m)), role='water', defaultLayer='lower', cells=alts,
                                   desc='%s 곧은 물가(마스크 %d) 대체 칸 %d개. 구성기가 칸 위치 해시로 기본 칸과 섞는다.' % (name, m, len(alts)), rules='물가 다듬기(shorePass)가 고른다. 손으로 칠하지 않는다.'))
        # 깊이 고리(셋째 판): 몸통 칸(3×3 이 다 물) 중 5×5 둘레에 안벽·둑이 있는 칸 — 벽 그늘이 바다 쪽으로 옅어진다. 모래 해변은 없음.
        if land in WA.PROF:
            for key in RING_KEYS:
                nv = RING_VARIANTS.get(key, 1)
                locs = []
                for vv in range(nv):
                    loc = '%s.ring.%s%s' % (prefix, key, '' if vv == 0 else '.v%d' % vv); locs.append(loc)
                    cells[loc] = _cell(WA.ring_cell(kind, land, key, v=vv).img(), 'solidfloor', '%s · 깊이 그늘 %s%s' % (name, key, '' if vv == 0 else ' 변형 %d' % vv),
                                       '%s 벽·둑 옆 몸통 물의 깊이 그늘 칸(한 칸 바깥 고리, 둘레 땅 %s). 물(걸을 수 없음).' % (name, key), ['물', 'depth', prefix])
                groups.append(dict(id='jp:shore-ring:%s:%s' % (aid, key), name='%s · 깊이 그늘 %s' % (name, key), role='water', defaultLayer='lower', cells=locs,
                                   desc='%s 몸통 물 중 둘레 5×5 에 그늘 땅(%s)이 있는 칸.' % (name, key), rules='물가 다듬기(shorePass)가 고른다. 손으로 칠하지 않는다.'))
        # 다리 상판(출렁다리 1층 칸) 중 남쪽이 둑(땅)인 칸: 상판 아래 1px 물빛 그늘을 짙은 흙 색으로(셋째 판 r2 — 흙 위에 남색 그늘이 비쳤다)
        if kind == 'river':
            import jp_regions_pack as RP
            dk = np.array(RP._finalize()[0]['rg-tsuribashi/b0.1']['img']).copy()
            dk[15, :, :3] = WA.rgb(WA.J('soil', 1))
            cells['bridge-deck.soil'] = _cell(Image.fromarray(dk, 'RGBA'), 'floor', '출렁다리 상판 · 둑 위', '출렁다리 1층 발판 칸 중 남쪽이 흙 둑인 칸(아래 그늘이 흙 색). 물가 다듬기가 바꿔 단다.', ['다리', 'bridge'])
            # 둑과 물이 반씩인 강 가장자리 칸(다리 그늘 m55·m205) 위 발판: 아래 1px 그늘을 그 칸 맨 윗줄이 물인 화소만 물빛, 땅이면 흙 색(r3)
            WATERCOLS = {WA.rgb(WA.J(mm, i)) for mm in ('canal_indigo', 'garasu') for i in range(7) if mm == 'garasu' or i < 5}
            for bm in BRIDGE_MASKS:
                edge = np.array(WA.shore_cell(kind, land, bm, lp, v=CANON.index(bm) % 3, bridge=True).img())
                dk2 = np.array(RP._finalize()[0]['rg-tsuribashi/b0.1']['img']).copy()
                for xx in range(16):
                    under = tuple(int(q) for q in edge[0, xx, :3])
                    dk2[15, xx, :3] = WA.rgb(WA.J('canal_indigo', 0)) if under in WATERCOLS else WA.rgb(WA.J('soil', 1))
                loc = 'bridge-deck.m%d' % bm
                cells[loc] = _cell(Image.fromarray(dk2, 'RGBA'), 'floor', '출렁다리 상판 · 물가 칸 위(마스크 %d)' % bm, '출렁다리 발판 칸 중 남쪽이 둑·물 반씩인 강 가장자리 칸. 물가 다듬기가 바꿔 단다.', ['다리', 'bridge'])
                groups.append(dict(id='jp:shore-bridge-deck-over:m%d' % bm, name='출렁다리 상판 · 물가 위 %d' % bm, role='terrain', defaultLayer='lower', cells=[loc],
                                   desc='출렁다리 발판 칸의 강 가장자리(마스크 %d) 위 변형 — 아래 그늘이 물 위 화소만 물빛.' % bm, rules='물가 다듬기(shorePass)가 단다.'))
            groups.append(dict(id='jp:shore-bridge-deck-soil', name='출렁다리 상판 · 둑 위', role='terrain', defaultLayer='lower', cells=['bridge-deck.soil'],
                               desc='출렁다리 발판 칸의 둑 위 변형(아래 1px 그늘이 흙 색).', rules='물가 다듬기(shorePass)가 다리 키트 발판 중 남쪽이 땅인 칸에 단다.'))
        # 다리 그늘(셋째 판, 강만): 다리 상판 바로 남쪽 물 칸 — 다리가 물에 납작 붙어 보이지 않게
        if kind == 'river':
            bkeys = [('body', lambda: WA.bridge_body_cell(kind, 1))]
            for m in BRIDGE_MASKS:
                bkeys.append(('m%d' % m, lambda m=m: WA.shore_cell(kind, land, m, lp, v=CANON.index(m) % 3, bridge=True)))
            for key in BRIDGE_RING_KEYS:
                bkeys.append((key, lambda key=key: WA.ring_cell(kind, land, key, v=0, bridge=True)))
            for key, fn in bkeys:
                loc = '%s.bridge.%s' % (prefix, key)
                cells[loc] = _cell(fn().img(), 'solidfloor', '%s · 다리 그늘 %s' % (name, key), '%s 다리 상판 바로 남쪽 물(다리 그늘). 물(걸을 수 없음).' % name, ['물', 'bridge-shadow', prefix])
                groups.append(dict(id='jp:shore-bridge:%s:%s' % (aid, key), name='%s · 다리 그늘 %s' % (name, key), role='water', defaultLayer='lower', cells=[loc],
                                   desc='%s 다리 상판 남쪽 물 칸(%s).' % (name, key), rules='물가 다듬기(shorePass)가 다리 키트 남쪽에 고른다.'))
        full = river_vars[0] if kind == 'river' else _mloc(prefix, 255)
        loc_of = lambda m, prefix=prefix, full=full: full if m == 255 else _mloc(prefix, m)
        extra = [] if kind == 'sea' else [l for l in cells if l.startswith(prefix + '.ring.') or l.startswith(prefix + '.bridge.')]
        if kind == 'sea':
            other = [x for x in ('jp-shore-sea-sand', 'jp-shore-sea-quay') if x != aid][0]
            connect = list(members) + sea_vars + ['other:' + other] + extra
            # 바다 몸통 변형(sea.v*·gnd/sea)은 두 바다 오토타일이 같이 쓰므로 어느 쪽 멤버도 아니다 → 속칸 변형(멤버여야 함)으로 걸지 않는다.
            # 넓은 바다의 변형 섞기는 구성기(shorePass)가 칸 위치 해시로 한다.
            interior = None
        else:
            members += river_vars[1:]
            connect = list(members) + extra
            interior = [[full] + river_vars[1:], [full] + river_vars[1:]]
        autotiles.append(dict(id=aid, name=name, neighborhood=8, layer='lower', member=members, connect=connect,
                              variantMap=GA.variant_map(loc_of), interior=interior, edgeConnects=True, outsideConnects=True))
        groups.append(dict(id='jp:shore-' + prefix, name=name, role='water', defaultLayer='lower', cells=list(members),
                           desc='%s — 8방 오토타일(물, 걸을 수 없음).' % name,
                           rules='지역 구성기가 바다·강 칸의 이웃을 보고 자동으로 깐다(shorePass). 붓으로 칠할 때는 같은 물 칸끼리 이웃으로 센다.'))
    # 바다 깊이 고리 칸(안벽 쪽에만 구움)은 두 바다 오토타일이 모두 물 이웃으로 센다(붓으로 칠할 때 땅으로 보지 않게)
    sea_rings = [l for l in cells if l.startswith('sea-quay.ring.') or l.startswith('sea-quay.bridge.')]
    for a in autotiles:
        if a['id'] in ('jp-shore-sea-sand', 'jp-shore-sea-quay'): a['connect'] += sea_rings
    # 부두 콘크리트 판 오토타일
    members = []
    for m in CANON:
        if m == 255: members.append(quay_vars[0]); continue
        loc = _mloc('quay-deck', m); members.append(loc)
        cells[loc] = _cell(WA.quay_deck_cell(m, 0).img(), 'floor', '부두 콘크리트 · %s' % GA.describe_mask(m).replace('열림', '물 쪽'),
                           '부두 콘크리트 판 오토타일 칸(마스크 %d). 물 쪽 변에 갓돌 테(남쪽은 갓돌 윗면·앞면). 걷는다.' % m, ['부두', '안벽', 'autotile'])
    members += quay_vars[1:]
    autotiles.append(dict(id='jp-quay-deck', name='부두 콘크리트 · 갓돌 테', neighborhood=8, layer='lower', member=members,
                          connect=list(members) + ['other:jp-plaza-pave', 'other:jp-sidewalk-curb'],
                          variantMap=GA.variant_map(lambda m: quay_vars[0] if m == 255 else _mloc('quay-deck', m)),
                          interior=[[quay_vars[0]] + quay_vars[1:]] * 2, edgeConnects=True, outsideConnects=True))
    groups.append(dict(id='jp:shore-quay-deck', name='부두 콘크리트 · 갓돌 테', role='terrain', defaultLayer='lower', cells=list(members),
                       desc='부두 콘크리트 판 8방 오토타일 — 물과 맞닿는 변에 갓돌 테. 판석 광장·보도와 맞닿는 변은 이어진다.',
                       rules='지역 구성기가 부두 칸의 물 쪽 이웃을 보고 자동으로 깐다(shorePass).'))
    groups += [
        dict(id='jp:region-river', name='계곡 강', role='water', defaultLayer='lower', cells=[river_vars[0]],
             desc='계곡·산골 강(자연 둑). fill_region 몸통. 지역 구성기가 숲·풀과 맞닿는 칸에 흙 둑(jp-river-bank)을 자동으로 두른다. 도시 수로는 「수로」.',
             rules='계곡 강(자연 둑). 걸을 수 없다. 폭포 jp-rg-waterfall(10×6)은 4칸 폭 강 위에 강 열을 맞춰 놓는다.'),
        dict(id='jp:region-quay', name='부두 콘크리트', role='terrain', defaultLayer='lower', cells=[quay_vars[0]],
             desc='항구 부두·방파제의 콘크리트 판석. fill_region 몸통. 지역 구성기가 물과 맞닿는 변에 갓돌 테·안벽(jp-quay-deck / jp-shore-sea-quay)을 자동으로 단다.',
             rules='부두 콘크리트(걷는다). 바다와 맞붙인다.'),
        dict(id='jp:sea-body', name='바다 · 몸통 변형', role='water', defaultLayer='lower', cells=list(sea_vars),
             desc='바다 몸통 변형 5칸(gnd/sea 와 같은 바탕). 구성기가 칸 위치 해시로 섞는다.', rules='바다 칸 대신 섞어 깐다. 걸을 수 없다.'),
    ]
    out = dict(cells=cells, autotiles=autotiles, groups=groups, kits=[],
               notes='물가 오토타일(바다↔모래·바다↔안벽·강↔숲 둑·부두 갓돌) + 바다·강 몸통 변형 + 부두 콘크리트. 칸 %d.' % len(cells))
    _CACHE['b'] = out
    return _copy(out)


def _copy(b):
    return dict(cells=collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in b['cells'].items()),
                autotiles=[dict(a, member=list(a['member']), connect=list(a['connect']), variantMap=dict(a['variantMap']), interior=[list(t) for t in a['interior']] if a['interior'] else None) for a in b['autotiles']],
                groups=[dict(g, cells=list(g['cells'])) for g in b['groups']], kits=[], notes=b['notes'])


# ═══════════════════════════ 미리보기 · 관문 판(구성기 shorePass 와 같은 규칙) ═══════════════════════════
def _sea_v0():
    import jp_regions_pack as RP
    from house_kit import Cv as HCv
    c = HCv(16, 16); RP.GROUND['gnd/sea'][0](c)
    return Image.fromarray(c.a, 'RGBA')


def ring_key_at(at_, x, y, caster):
    """shorePass.ts ringKeyAt 와 같은 규칙: 5×5 둘레의 북 줄·서 열·동 열 그늘 땅 비트."""
    bit = lambda dx, dy: '1' if caster(at_(x + dx, y + dy)) else '0'
    n = ''.join(bit(dx, -2) for dx in (-1, 0, 1))
    w = ''.join(bit(-2, dy) for dy in (-1, 0, 1))
    e = ''.join(bit(2, dy) for dy in (-1, 0, 1))
    return WA.ring_key(n, w, e)


def best_ring_key(key, baked):
    """구운 고리 키 중 가장 가까운 것(없는 그늘을 더하는 비트는 2배 벌점). 비트가 하나도 없으면 None. shorePass.ts bestRingKey 와 같다."""
    bits = key[1:4] + key[5:8] + key[9:12]
    if '1' not in bits: return None
    if key in baked: return key
    best, bs = None, 1e9
    for k in baked:
        kb = k[1:4] + k[5:8] + k[9:12]
        sc = sum(2 if (q == '1' and a == '0') else 1 if (q == '0' and a == '1') else 0 for a, q in zip(bits, kb))
        if sc < bs: best, bs = k, sc
    return best


def compose_grid(grid, b=None):
    """문자 격자 → RGBA. W 바다 · R 강 · S 모래 · G 숲 바닥 · D 부두 콘크리트 · L 잔디(다른 땅) · B 다리 상판(물로 센다).
    shorePass.ts 와 같은 규칙: 물 칸은 8방 물 마스크로 가장자리/몸통, 바다는 이웃 땅에 모래가 있으면 모래 물가, 없으면 안벽.
    부두 칸은 물 쪽만 열림(땅은 이어짐). 맵 밖은 이어진 것으로 본다."""
    b = b or build()
    C = b['cells']; at = {a['id']: a for a in b['autotiles']}
    import jp_regions_pack as RP
    from house_kit import Cv as HCv
    def gimg(name):
        c = HCv(16, 16); RP.GROUND[name][0](c); return Image.fromarray(c.a, 'RGBA')
    land_img = {'S': gimg('gnd/sand'), 'G': gimg('gnd/forest')}
    sea_body = [_sea_v0()] + [C['sea.v%d' % v]['img'] for v in range(1, N_SEA_VAR)]
    riv_body = [C['river.v%d' % v]['img'] for v in range(N_RIVER_VAR)]
    quay_body = [C['quay.v%d' % v]['img'] for v in range(N_QUAY_VAR)]
    Hh, Ww = len(grid), len(grid[0])
    water = lambda t: t in 'WRB'
    def at_(x, y):
        if 0 <= x < Ww and 0 <= y < Hh: return grid[y][x]
        return None
    def mask(x, y, pred):
        m = 0
        for nm, (dx, dy) in dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1)).items():
            t = at_(x + dx, y + dy)
            if t is None or pred(t): m |= GA.DIRS[nm]
        return GA.canon(m)
    alts = {g['id'][len('jp:shore-alt:'):]: g['cells'] for g in b['groups'] if g['id'].startswith('jp:shore-alt:')}
    def pick(aid, m, h):
        pool = [at[aid]['variantMap'][str(m)]] + alts.get('%s:%d' % (aid, m), [])
        return pool[h % len(pool)]
    rings = {}; bridges = {}
    for g in b['groups']:
        if g['id'].startswith('jp:shore-ring:'):
            aid, key = g['id'][len('jp:shore-ring:'):].rsplit(':', 1); rings.setdefault(aid, {})[key] = g['cells']
        elif g['id'].startswith('jp:shore-bridge:'):
            aid, key = g['id'][len('jp:shore-bridge:'):].rsplit(':', 1); bridges.setdefault(aid, {})[key] = g['cells']
    deck = RP._finalize()[0]['rg-tsuribashi/b0.1']['img']
    out = Image.new('RGBA', (Ww * 16, Hh * 16))
    for y in range(Hh):
        for x in range(Ww):
            t = grid[y][x]; h = GA.cell_hash(x, y)
            if t == 'B':
                south = at_(x, y + 1)
                if south is not None and not water(south): im = C['bridge-deck.soil']['img']
                elif south == 'R' and ('bridge-deck.m%d' % mask(x, y + 1, water)) in C: im = C['bridge-deck.m%d' % mask(x, y + 1, water)]['img']
                else: im = deck
            elif water(t):
                m = mask(x, y, water)
                under_bridge = at_(x, y - 1) == 'B'
                if m == 255:
                    aid = 'jp-river-bank' if t == 'R' else 'jp-shore-sea-quay'
                    caster = (lambda q: q is not None and not water(q)) if t == 'R' else (lambda q: q is not None and not water(q) and q != 'S')
                    key = ring_key_at(at_, x, y, caster)
                    best = best_ring_key(key, rings.get(aid, {}))
                    im = None
                    if under_bridge and t == 'R':
                        pool = bridges.get(aid, {}).get(best or 'body')
                        if pool: im = C[pool[0]]['img']
                    if im is None and best:
                        pool = rings[aid][best]; im = C[pool[h % len(pool)]]['img']
                    if im is None:
                        im = (sea_body if t == 'W' else riv_body)[h % (N_SEA_VAR if t == 'W' else N_RIVER_VAR)]
                elif t == 'R':
                    pool = bridges.get('jp-river-bank', {}).get('m%d' % m) if under_bridge else None
                    im = C[pool[0]]['img'] if pool else C[pick('jp-river-bank', m, h)]['img']
                else:
                    nbs = [at_(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
                    north = at_(x, y - 1)
                    sandy = 'S' in nbs and not (north is not None and not water(north) and north != 'S')
                    im = C[pick('jp-shore-sea-sand' if sandy else 'jp-shore-sea-quay', m, h)]['img']
            elif t == 'D':
                m = mask(x, y, lambda q: not water(q))
                im = quay_body[h % N_QUAY_VAR] if m == 255 else C[at['jp-quay-deck']['variantMap'][str(m)]]['img']
            elif t in land_img:
                im = land_img[t]
            else:
                c = HCv(16, 16); RP.GROUND['gnd/forest'][0](c); im = Image.fromarray(c.a, 'RGBA')
            out.paste(im, (x * 16, y * 16))
    return out


def canonical(L, w):
    """land 로 둘러싼 물 웅덩이 + 물 속 땅 섬(바깥 모서리·변·안쪽 모서리를 한 번에) — 시안 shore.canonical() 과 같은 판."""
    return [L * 9, L + w * 7 + L, L + w * 7 + L, L + w * 2 + L * 3 + w * 2 + L, L + w * 2 + L * 3 + w * 2 + L, L + w * 7 + L, L + w * 7 + L, L * 9]


QUAY_BOARD = [
    'LLLLLLLLLLLL',
    'DDDDDDDDDDDD',
    'DDDDDDDDDDDD',
    'WWWWDDDWWWWW',
    'WWWWDDDWWWWW',
    'WWWWDDDWWWWW',
    'WWWWWWWWWWWW',
    'WWWWWWWWWWWW',
]
BLOB = [
    'SSSSSSSSSSSSSS',
    'SSSSWWWWSSSSSS',
    'SSWWWWWWWWSSSS',
    'SWWWWWWWWWWSSS',
    'SWWWWSSWWWWWSS',
    'SWWWWSSWWWWWWS',
    'SSWWWWWWWWWWWS',
    'SSSWWWWWWWWSSS',
    'SSSSSWWWWSSSSS',
    'SSSSSSSSSSSSSS',
]


HARBOR_BOARD = [
    'LLLLLLLLLLLLLLLLLL',
    'DDDDDDDDDDDDDDDDDD',
    'WWWWWWWDDDDDDWWWWW',
    'WWWWWWWDDDDDDWWWWW',
    'WWWWWWWDDDDDDWWWWW',
    'WWWWWWWDDDDDDWWWWW',
    'WWWWWWWDDDDDDWWWWW',
    'WWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWW',
]
RIVER_BOARD = [
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
    'GGGGGRRRRGGGG',
    'GGGGGRRRRGGGG',
    'GGGGGRRRRGGGG',
    'GGGGGRRRRGGGG',
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
    'GGBBBBBBBBGGG',
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
    'GGGRRRRGGGGGG',
    'GGGRRRRGGGGGG',
    'GGGRRRRGGGGGG',
    'GGGRRRRGGGGGG',
    'GGGGRRRRGGGGG',
    'GGGGRRRRGGGGG',
]


def boards():
    """(이름, 격자) — 관문·눈 확인용 판."""
    return [('sea-sand', canonical('S', 'W')), ('sea-sand-blob', BLOB), ('river-bank', canonical('G', 'R')),
            ('quay-wall', QUAY_BOARD), ('sea-quay', canonical('D', 'W')), ('harbor-depth', HARBOR_BOARD), ('river-meander-bridge', RIVER_BOARD)]


def _allowed():
    from lib_blocks_lines.core import _owner
    cc = {int(h[1:], 16) for h in json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json')))['colors']}
    return set(_owner()) | cc


def selftest(verbose=True):
    out = []
    b = build()
    allowed = _allowed()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        if c['pc'] in ('floor', 'solidfloor') and not al.all(): out.append('(a) %s 아래층인데 투명 화소' % k)
        for r, g, bb in {tuple(map(int, p)) for p in a[al == 255][:, :3]}:
            if ((r << 16) | (g << 8) | bb) not in allowed: out.append('(a) %s 팔레트 밖 #%02x%02x%02x' % (k, r, g, bb)); break
    for at in b['autotiles']:
        vm = at['variantMap']
        if set(vm) != {str(i) for i in range(256)}: out.append('(b) %s 키 256 아님' % at['id'])
        if any(vm[str(m)] != vm[str(GA.canon(m))] for m in range(256)): out.append('(b) %s canon 불일치' % at['id'])
        if len({vm[str(m)] for m in CANON}) != 47: out.append('(b) %s canon 47 아님' % at['id'])
        miss = [v for v in vm.values() if v not in b['cells']]
        if miss: out.append('(b) %s 없는 칸 %s' % (at['id'], miss[:3]))
        if any(x not in at['member'] for t in (at['interior'] or []) for x in t): out.append('(b) %s 속칸 변형이 멤버가 아니다' % at['id'])
    # (c) 몸통 변형 테두리: 같은 물(바다·강·부두)의 몸통 변형끼리 테두리 화소가 전부 같아야 한다(해시로 아무렇게나 붙는다)
    sea = [np.array(_sea_v0())] + [np.array(b['cells']['sea.v%d' % v]['img']) for v in range(1, N_SEA_VAR)] + [np.array(b['cells']['sea-sand.m255']['img']), np.array(b['cells']['sea-quay.m255']['img'])]
    riv = [np.array(b['cells']['river.v%d' % v]['img']) for v in range(N_RIVER_VAR)]
    for nm, lst in (('바다', sea), ('강', riv)):
        ref = lst[0]
        for i, a in enumerate(lst[1:], 1):
            if not (np.array_equal(a[0], ref[0]) and np.array_equal(a[-1], ref[-1]) and np.array_equal(a[:, 0], ref[:, 0]) and np.array_equal(a[:, -1], ref[:, -1])):
                out.append('(c) %s 몸통 변형 %d 테두리가 v0 과 다르다' % (nm, i))
    q = [np.array(b['cells']['quay.v%d' % v]['img']) for v in range(N_QUAY_VAR)]
    for i, a in enumerate(q[1:], 1):
        if not np.array_equal(a[-1], q[0][-1]): out.append('(c) 부두 판 변형 %d 가로 줄눈(y=15) 다름' % i)
    # (c2) 같은 변끼리 이음: 북쪽이 땅인 가장자리 칸을 가로로 붙였을 때 맞닿는 열의 화소 계열 차이
    fam = lambda p: GA.FAMILY.get(tuple(int(v) for v in p[:3]), tuple(int(v) for v in p[:3]))
    for at in b['autotiles']:
        if at['id'] == 'jp-quay-deck': continue          # 판석 세로 줄눈은 일부러 칸 끝에 있다
        vm = at['variantMap']
        for m_a, m_b, dx in ((255 - 1 - 16 - 128, 255 - 1 - 16 - 128, 1), (255 - 8 - 128 - 64, 255 - 8 - 128 - 64, 0)):
            ta, tb = np.array(b['cells'][vm[str(GA.canon(m_a))]]['img']), np.array(b['cells'][vm[str(GA.canon(m_b))]]['img'])
            ea, eb = (ta[:, 15], tb[:, 0]) if dx else (ta[15], tb[0])
            diff = sum(1 for p, q2 in zip(ea, eb) if fam(p) != fam(q2))
            if diff > 3: out.append("(c2) %s 같은 변 이음 화소 %d 다름(자연 물가 거품 잡음 1px 계단 3까지 허용)" % (at["id"], diff))
    # (c3) 곧은 물가 대체 칸은 물가를 따라가는 양끝 열(행)이 기본 칸과 같은 램프 계열이어야 한다
    fam = lambda p: GA.FAMILY.get(tuple(int(v) for v in p[:3]), tuple(int(v) for v in p[:3]))
    for g in b['groups']:
        if not g['id'].startswith('jp:shore-alt:'): continue
        aid, m = g['id'][len('jp:shore-alt:'):].rsplit(':', 1); m = int(m)
        base = np.array(b['cells'][[a for a in b['autotiles'] if a['id'] == aid][0]['variantMap'][str(m)]]['img'])
        horiz = not (m & GA.DIRS['N']) or not (m & GA.DIRS['S'])      # 북·남 변 → 양끝은 왼·오른 열
        for loc in g['cells']:
            a = np.array(b['cells'][loc]['img'])
            ends = ((a[:, 0], base[:, 0]), (a[:, 15], base[:, 15])) if horiz else ((a[0], base[0]), (a[15], base[15]))
            d = sum(1 for e1, e2 in ends for p, q2 in zip(e1, e2) if fam(p) != fam(q2))
            if d > 2: out.append('(c3) %s 대체 칸 양끝이 기본 칸과 %d 화소 다름' % (loc, d))
    if verbose:
        print('jp_shore: 칸 %d · 오토타일 %d · 그룹 %d · 문제 %d' % (len(b['cells']), len(b['autotiles']), len(b['groups']), len(out)))
        for m in out[:30]: print('  ', m)
    return len(out)


def preview(outdir=OUTDIR):
    os.makedirs(outdir, exist_ok=True)
    gate = os.path.join(outdir, '_gate'); os.makedirs(gate, exist_ok=True)
    lines = []
    for name, g in boards():
        im = compose_grid(g)
        im.save(os.path.join(outdir, 'board-%s.png' % name))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(outdir, 'board-%s-x4.png' % name))
        p = os.path.join(gate, 'jp-shore-%s.png' % name); im.save(p)
        lines.append(dict(png=p, kind='terrain', name='jp-shore-%s' % name, label='jp_city/water/jp-shore-%s' % name))
    # 같은 판(2026-10-20 물·가로수)에서 새로 그리거나 바꾼 조각: 등대·폭포(jp_regions_pack), 가로수 2종(jp_street_trees)
    import jp_regions_pack as RP, jp_street_trees as ST
    rr = RP._finalize()[2]
    for kid, rid in (('jp-rg-lighthouse', 'rg-lighthouse'), ('jp-rg-waterfall', 'rg-waterfall')):
        p = os.path.join(gate, '%s.png' % kid); rr[rid].save(p)
        lines.append(dict(png=p, kind='structure', name=kid, label='jp_city/water/%s' % kid))
    for kid, *_ in ST.TREES:
        p = os.path.join(gate, '%s.png' % kid); ST.render(kid).save(p)
        lines.append(dict(png=p, kind='organic', name=kid, label='jp_city/water/%s' % kid))
    with open(os.path.join(gate, 'items.jsonl'), 'w', encoding='utf-8') as f:
        for l in lines: f.write(json.dumps(l, ensure_ascii=False) + '\n')
    # 칸 시트(47 + 몸통) 4종
    b = build()
    for at in b['autotiles']:
        vm = at['variantMap']; locs = [vm[str(m)] for m in CANON] + [x for x in at['member'] if x not in [vm[str(m)] for m in CANON]]
        S = Image.new('RGBA', (len(locs) * 17, 16), (40, 40, 48, 255))
        for i, l in enumerate(locs): S.alpha_composite(b['cells'][l]['img'], (i * 17, 0))
        S.resize((S.width * 3, 48), Image.NEAREST).save(os.path.join(outdir, 'cells-%s-x3.png' % at['id']))
    return outdir


if __name__ == '__main__':
    bad = selftest()
    print(preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    sys.exit(1 if bad else 0)
