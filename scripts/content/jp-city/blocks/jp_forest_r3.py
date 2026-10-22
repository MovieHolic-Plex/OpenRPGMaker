#!/usr/bin/env python3
"""jp_city 블록 `jp_forest_r3` — 붓으로 칠하는 숲 오토타일(종마다 하나). 2026-10-20.

그림: `scripts/content/jp-city/forest/forest_r3.py`(코드 손 도트, 버들항 숲 역설계 `tiledata/jp-city/forest-r3/SPEC.md`).
칸 하나의 그림은 8방 마스크(정규화 47)와 칸 위치 위상 (x mod 6, y mod 4) 으로만 정해진다. 그래서 편집기의 보통 오토타일 붓과
조수의 지형 도구가 같은 표(`phaseVariants`)로 칠한다 — 손으로 찍는 키트·머리·하늘선이 없다.

  오토타일 jp-forest3-<k>   k = bl 활엽(느티나무·잡목) · bb 대숲 · sk 벚나무 · sg 삼나무 · mp 단풍 · mh 섞인 숲(삼나무+활엽, 진수의 숲·산비탈)
                            neighborhood 8, 위층(3층), variantMap = 위상 (0,0) 표(위상을 모르는 쪽의 대체), phase = 위상 표(단일 종 6×4 = 24장, 섞인 숲 4×4 = 16장 — jp 시트 4096px 안에 들도록).
  섞인 숲은 그 자체가 오토타일이다(mh): 한 수관 밭 안에서 수관마다 종이 다르다. 서로 다른 오토타일이 맞닿으면 서로 「숲 아님」으로 본다.

  python3 scripts/content/jp-city/blocks/jp_forest_r3.py [--kinds bl,sg]   # selftest
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'forest'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import forest_r3 as F  # noqa: E402

BLOCK = 'jp_forest_r3'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
KINDS = (('bl', '활엽 혼효림(느티나무·잡목)'), ('bb', '대숲'), ('sk', '벚나무 숲'), ('sg', '삼나무 숲'), ('mp', '단풍 숲'), ('mh', '섞인 숲(삼나무+활엽)'))
_CACHE = {}
ONLY = None


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}
    autotiles, groups = [], []

    def put(t, k, label):
        key = t.tobytes()
        if key in seen: return seen[key]
        loc = f'{k}/{len(seen)}'
        seen[key] = loc
        cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc='solid', label=label,
                          desc=f'[숲 r3] {label}. 오토타일 jp-forest3-{k} 로 칠한다(낱칸으로 찍지 말 것).', tags=['숲', '수관', k])
        return loc

    for k, ko in KINDS:
        if ONLY and k not in ONLY: continue
        tiles = F.autotile_tiles(k)
        maps = []
        PW_, PH_ = F.per(k)
        for py in range(PH_):
            for px in range(PW_):
                maps.append({str(m): put(tiles[(m, px, py)], k, f'{ko} 수관 (8방 {m}, 위상 {px},{py})') for m in F.CANON})
        member = list(dict.fromkeys(v for mp in maps for v in mp.values()))
        autotiles.append(dict(id=f'jp-forest3-{k}', name=f'숲 · {ko}', neighborhood=8, layer='upper', member=member, connect=None,
                              variantMap={str(m): maps[0][str(F.canon(m))] for m in range(256)},
                              phase=dict(w=PW_, h=PH_, maps=maps), edgeConnects=True))
        groups.append(dict(id=f'jp:forest3-{k}', name=f'숲 · {ko}', role='green', defaultLayer='upper', cells=member,
                           desc=f'{ko}: 붓으로 칠하는 숲 오토타일(위층·막힘). 북쪽은 나무 꼭대기 하늘선, 남쪽은 줄기·그늘 띠, 옆은 둥근 수관 끝, 1줄 띠는 관목 울.',
                           rules=f'오토타일 jp-forest3-{k} 로 구역을 칠한다(편집기 붓·조수 지형 도구 모두). 칸 위치 위상(x mod {PW_}, y mod {PH_})으로 칸이 정해지니 낱칸으로 찍지 않는다.'))
    _CACHE['r'] = (cells, autotiles, groups)
    return _CACHE['r']


def build():
    cells, autotiles, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [dict(a, member=list(a['member']), variantMap=dict(a['variantMap']),
                               phase=dict(a['phase'], maps=[dict(m) for m in a['phase']['maps']])) for a in autotiles],
            'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [],
            'notes': '붓으로 칠하는 숲 오토타일 r3(단일 종 5 + 섞인 숲 2): 8방 마스크 × 위치 위상.'}


def kinds():
    return {}


def _allowed():
    c = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
    return {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in c['colors']}


def selftest(verbose=True):
    out = []
    allowed = _allowed()
    b = build()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        off = {tuple(int(x) for x in p) for p in a[al == 255][:, :3]} - allowed
        if off: out.append('(a) %s 계약 밖 색 %s' % (k, sorted('#%02x%02x%02x' % q for q in off)[:3]))
    for at in b['autotiles']:
        if len(at['variantMap']) != 256: out.append('(b) %s 키 수' % at['id'])
        ph = at['phase']
        if len(ph['maps']) != ph['w'] * ph['h']: out.append('(b) %s 위상 표 수' % at['id'])
        for mp in ph['maps']:
            if len(mp) != 47: out.append('(b) %s 위상 표 키 수 %d' % (at['id'], len(mp)))
            for loc in mp.values():
                if loc not in b['cells']: out.append('(b) %s 칸 없음 %s' % (at['id'], loc))
    if verbose:
        print('[%s] 칸 %d · 오토타일 %d · 그룹 %d · 문제 %d' % (BLOCK, len(b['cells']), len(b['autotiles']), len(b['groups']), len(out)))
        for o in out[:20]: print('  ', o)
    return out


if __name__ == '__main__':
    if '--kinds' in sys.argv: ONLY = set(sys.argv[sys.argv.index('--kinds') + 1].split(','))
    sys.exit(1 if selftest() else 0)
