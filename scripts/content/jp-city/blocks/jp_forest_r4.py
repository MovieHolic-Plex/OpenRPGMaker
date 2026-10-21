#!/usr/bin/env python3
"""jp_city 블록 `jp_forest_r4` — 나무 composer 숲(활엽). 2026-10-20.

붓으로 칠하는 것은 1층 숲 바닥 표시(오토타일 jp-forest4-bl, 모든 마스크가 같은 바닥 칸)이다. 칠하거나 지우면
엔진(shapeAutotileGroupAround → src/project/defaults/treeComposer.ts)이 그 둘레 칸만 나무 그림 조각으로 다시 짠다:
  · 나무 = 그림 한 장(T4 4×5 · T3 3×4 · T2 2×3, 변형 여럿 + 숲 속 그늘판 d). 밑동 자리는 칸 해시와 이웃 몇 칸만으로 정해진다(국소·결정적).
  · 칸마다 덮는 조각을 깊이(남쪽이 앞)로 줄 세워 앞에서부터 4·3·2층에 둔다 — 이웃 수관이 겹친다(버들항 숲처럼).
  · 수관은 숲 밖으로 넘칠 수 있으나 잔디(composer.overhangOnGroups) 위로만. 물·길·집에는 넘치지 않는다.
그림: scripts/content/jp-city/forest/forest_r4.py(코드 손 도트, r5 잔디 맞춤 램프 keyaki_g/h·leafhi_g·bark_g).
규칙 원형: scripts/content/jp-city/forest/forest_r4_compose.py 의 anchor_at / cell_stack (TS 와 해시까지 같다).

  python3 scripts/content/jp-city/blocks/jp_forest_r4.py      # selftest
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'forest'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import forest_r3 as F3  # noqa: E402
import forest_r4 as R  # noqa: E402
import forest_r4_compose as C  # noqa: E402
import forest_r3_scenes as S3  # noqa: E402
import forest_r6_ground as G  # noqa: E402

BLOCK = 'jp_forest_r4'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
T = 16
KINDS = (('bl', '활엽 혼효림(느티나무·잡목)'),)
MOSS = 16109                           # 지역 팩 숲 바닥(이끼·낙엽) 칸(번호 핀으로 고정) — 신사 진수의 숲 바탕
# 같은 나무 그림을 서로 다른 바닥 위에 세운다(2026-10-21 적대 VQA: 잔디색 숲 바닥이 이끼 바닥 옆에서 곧은 경계로 보였다).
# (그룹 코드, 이름, 바탕 칸). apronBases[0] = 그 그룹 숲 바닥의 바탕 칸(TS forestPainter r4ForGround 약속).
FLOORS = (('bl', '', 3281), ('bm', ' · 이끼 바닥', MOSS))
SHAPES = ('T4', 'T3', 'T2')
OVERHANG_ON = ['jp-lawn-dirt', 'jp-gravel-lawn']
APRON_BASES = [3281, 3282, 3283, MOSS]   # 잔디(jp-lawn-dirt 속 칸)·이끼 바닥 — 둘레 그늘은 이 바닥 무늬를 어둡게 한 덧칸
_CACHE = {}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}
    autotiles, groups = [], []

    def put(t, label, pc, tags, desc):
        key = t.tobytes()
        if key in seen: return seen[key]
        loc = f'c{len(seen)}'
        seen[key] = loc
        cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label=label, desc=desc, tags=tags)
        return loc

    for k, ko in KINDS:
        # 둘레 그늘(2층 덧칸): 잔디 칸 3 + 이끼 바닥 × 그늘 코드 64 — 형제 그룹이 같은 덧칸을 쓴다
        apron = []
        for b in APRON_BASES:
            bimg = S3.tile(b)
            for code in range(G.NCODES):
                t = G.apron_tile(bimg, code)
                apron.append(None if t is None else put(t, f'{ko} 숲 둘레 그늘 (바닥 {b}, 그늘 {code})', 'flat', ['숲', '그늘', k],
                                                       f'[숲 r6] {ko} 숲 둘레 땅 그늘(2층 덧칸, 바닥 {b} 위). composer 가 놓는다.'))
        S = C.Sprites(k)
        sprites = []
        for shape in SHAPES:
            for dark in (False, True):
                for name in sorted(S.by_shape.get(shape + ('d' if dark else ''), [])):
                    im = S.img[name]; cov = S.cover[name]
                    ch, cw = cov.shape
                    tiles, covers = [], []
                    for j in range(ch):
                        for i in range(cw):
                            t = np.ascontiguousarray(im[j * T:(j + 1) * T, i * T:(i + 1) * T])
                            if not (t[..., 3] > 0).any(): tiles.append(None); covers.append(0); continue
                            part = '줄기·그늘' if j == ch - 1 else '수관'
                            tiles.append(put(t, f'{ko} 나무 {name} ({i},{j}) {part}', 'star', ['숲', '나무', k],
                                             f'[숲 r4] {ko} 나무 그림 {name} 의 칸. 숲 바닥(jp-forest4-{k})을 칠하면 composer 가 놓는다(낱칸으로 찍지 말 것).'))
                            covers.append(int(round(cov[j, i] * 100)))
                    sprites.append(dict(name=name, shape=shape, dark=dark, w=cw, h=ch, tiles=tiles, cover=covers))
        fam = [fk for fk, _, _ in FLOORS]
        for fk, fsuf, fbase in FLOORS:
            # r6 접지: 숲 바닥(1층) 그늘 변형 64 — 바탕 칸(잔디·이끼 바닥) 무늬를 그늘 코드대로 어둡게
            base = S3.tile(fbase)
            fko = ko + fsuf
            floor_tiles = []
            for code in range(G.NCODES):
                floor_tiles.append(put(G.floor_tile(base, code), f'{fko} 숲 바닥 (그늘 {code})', 'solidfloor', ['숲', '숲 바닥', k],
                                       f'[숲 r6] {fko} 숲 바닥(1층). 오토타일 jp-forest4-{fk} 로 칠하면 나무가 저절로 서고, 나무가 덮은 칸 둘레에 땅 그늘이 깔린다.'))
            floor = floor_tiles[0]
            bases = [fbase] + [x for x in APRON_BASES if x != fbase]          # [0] = 이 그룹 바탕 칸(약속)
            ap = []
            for x in bases:
                bi = APRON_BASES.index(x); ap += apron[bi * G.NCODES:(bi + 1) * G.NCODES]
            autotiles.append(dict(
                id=f'jp-forest4-{fk}', name=f'숲 · {fko}', neighborhood=8, layer='lower', member=list(dict.fromkeys(floor_tiles)), connect=None,
                variantMap={str(m): floor for m in range(256)}, edgeConnects=True,
                composer=dict(kind='trees', version=1, layers=[4, 3, 2], rowStep=2, colStep=3, skip=0.05,
                              shapeOrder=list(SHAPES), shapeOdds=[0.32, 0.94],
                              trunkCols={s_: list(C.TRUNK_COLS[s_]) for s_ in SHAPES},
                              overhangOnGroups=OVERHANG_ON + [f'jp-forest4-{o}' for o in fam if o != fk],
                              overhangOnExtraTiles=[MOSS], sprites=sprites,
                              ground=dict(shadeBits=[[dx, dy] for _, dx, dy in G.SHADE_BITS], shadeCover=C.SHADE_COVER, shadeCoverBase=C.SHADE_COVER_BASE, shadeRows=C.SHADE_ROWS,
                                          floorTiles=floor_tiles, apronLayer=C.APRON_LAYER, apronBases=bases, apronTiles=ap))))
            groups.append(dict(id=f'jp:forest4-{fk}', name=f'숲 · {fko}', role='green', defaultLayer='lower', cells=[floor],
                               desc=f'{fko}: 붓으로 칠하는 숲(1층 숲 바닥). 칠한 구역에 나무 그림이 저절로 겹쳐 선다 — 남쪽 끝은 줄기, 안쪽은 겹친 수관.',
                               rules=f'오토타일 jp-forest4-{fk} 로 구역을 칠한다(편집기 붓·조수 지형 도구 모두). 나무 칸은 composer 가 2~4층에 쓰니 손으로 찍거나 지우지 않는다.'))
    _CACHE['r'] = (cells, autotiles, groups)
    return _CACHE['r']


def build():
    cells, autotiles, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [json.loads(json.dumps(a)) for a in autotiles],
            'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [],
            'notes': '나무 composer 숲 r4(활엽): 1층 숲 바닥 오토타일 + 나무 그림 조각(2~4층, 칸마다 깊이 순).'}


def kinds():
    return {}


def _allowed():
    c = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
    return {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in c['colors']}


def selftest(verbose=True):
    import forest_r3_scenes as S3
    out = []
    allowed = _allowed() | {tuple(int(v) for v in p) for p in S3.tile(S3.GRASS)[..., :3].reshape(-1, 3)}
    b = build()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        off = {tuple(int(x) for x in p) for p in a[al == 255][:, :3]} - allowed
        if off: out.append('(a) %s 계약 밖 색 %s' % (k, sorted('#%02x%02x%02x' % q for q in off)[:3]))
    for at in b['autotiles']:
        cp = at['composer']
        for sp in cp['sprites']:
            if len(sp['tiles']) != sp['w'] * sp['h'] or len(sp['cover']) != len(sp['tiles']): out.append('(b) %s 칸 수' % sp['name'])
            for loc in sp['tiles']:
                if loc is not None and loc not in b['cells']: out.append('(b) %s 칸 없음 %s' % (sp['name'], loc))
        gr = cp['ground']
        if len(gr['floorTiles']) != 64 or len(gr['apronTiles']) != 64 * len(gr['apronBases']): out.append('(b) 접지 표 크기')
        for loc in gr['floorTiles'] + [x for x in gr['apronTiles'] if x is not None]:
            if loc not in b['cells']: out.append('(b) 접지 칸 없음 %s' % loc)
        for s in cp['shapeOrder']:
            if not any(sp['shape'] == s and not sp['dark'] for sp in cp['sprites']): out.append('(b) %s 밝은판 없음' % s)
            if not any(sp['shape'] == s and sp['dark'] for sp in cp['sprites']): out.append('(b) %s 그늘판 없음' % s)
    if verbose:
        print('[%s] 칸 %d · 오토타일 %d · 그림 %d · 문제 %d' % (BLOCK, len(b['cells']), len(b['autotiles']),
                                                      sum(len(a['composer']['sprites']) for a in b['autotiles']), len(out)))
        for o in out[:20]: print('  ', o)
    return out


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
