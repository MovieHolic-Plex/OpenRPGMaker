#!/usr/bin/env python3
"""jp_city 블록 `fable_city` — Fable 5.2 로 그린 일본 건물 · 옥상 기물 · 시골 기물(tiledata/jp-city/fable-city/spec.json). 계약: ../CONTRACT.md
  python3 scripts/content/jp-city/blocks/fable_city.py        # selftest(관문 출구 · 크기 · 칸에서 다시 조립 == 그림 · 문 칸 막힘)

그림은 pieces/<키트 id>.png 를 그대로 칸으로 자른다(색 맞춤·다시 그리기 없음 — 한 화소라도 바뀌면 오너 면제가 풀린다).
색은 확장 건물 팔레트(tiledata/jp-city/fable-city/palette.json — 재료마다 6~7단, 버들항 렌더링 계약)다. bake_jp.py 가 그 색을 허용 색에 더한다. 일본 팔레트 계약이 옮기는 색은 없다(화소 불변).
건물 그림은 Fable 부품(parts/)을 scripts/content/jp-city/fable_city_build.py 가 레시피(recipes.json)대로 조립한 것이다 — 다시 지으려면 그 스크립트.
3/4 관문 미통과 — 오너 면제 묶음(spec.waiver). 출구 검사는 관문 자신의 규칙 하나: object_gate.refusal(그림, kind, context='bundle').
칸 번호 핀 키 = fable_city/<id>/<x>.<y> (덧붙이기 전용). 같은 화소·같은 통행의 칸은 블록 안에서 하나로 합친다(처음 나온 자리의 키).
건물: 키트 폭 = 벽 폭(양옆 처마 칸 없음). 맨 아래 D줄 막힘(solid), 그 위 ★. 문 칸 = 맨 아래 줄(막힘 + entrance 부품), 접근칸 = 그 아래 한 줄(키트 밖).
  pass 열(도리이·아케이드 문처럼 걸어서 지나는 문)은 그 열 전체가 ★ 이고 접근칸만 둔다.
기물: 맨 아래 줄 막힘·위 ★(place prop) · 전부 ★(place roof — 지붕 면 위 4층) · 밟는 바닥 그림(place decal)."""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402

BLOCK = 'fable_city'
OBJ = os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-city')
TIER_KO = {'small': '소형', 'medium': '중형', 'large': '대형', 'xlarge': '초대형', 'landmark': '랜드마크'}
_CACHE = {}


def spec():
    p = os.path.join(OBJ, 'spec.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else dict(waiver='', items=[])


def pictures():
    """(항목, RGBA 그림) — 번들 출구에서 막힌 그림이 있으면 멈춘다. 그림은 열기만 하고 바꾸지 않는다."""
    import object_gate as OG
    out, blocked = [], []
    for it in spec()['items']:
        im = Image.open(os.path.join(OBJ, 'pieces', it['id'] + '.png')).convert('RGBA')
        assert im.size == (it['w'] * 16, it['h'] * 16), (it['id'], im.size)
        why = OG.refusal(im, kind=it['kind'], context='bundle')
        if why is not None: blocked.append('jp_city/%s: %s' % (it['id'], why))
        out.append((it, im))
    if blocked: raise SystemExit('3/4 관문 출구에서 막힘 %d:\n  ' % len(blocked) + '\n  '.join(blocked[:20]))
    return out


def solid_cells(it):
    """막힌 칸 집합 (x, y)."""
    w, h = it['w'], it['h']
    if it['type'] == 'building':
        ps = set(it.get('pass', []))
        return {(x, y) for y in range(h - it['depth'], h) for x in range(w) if x not in ps}
    if it['place'] in ('roof', 'decal'): return set()
    return {(x, h - 1) for x in range(w)}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    sp = spec(); cells = collections.OrderedDict(); seen = {}; kits = []; group_cells = collections.defaultdict(list)
    for it, im in pictures():
        a = np.array(im); w, h = it['w'], it['h']; solid = solid_cells(it); decal = it.get('place') == 'decal'
        gid = 'building' if it['type'] == 'building' else ('okujo' if it['place'] == 'roof' else 'inaka')
        tags = ['Fable 그림'] + list(it['tags']) + list(it['words'])
        how = ('3/4 관문 미통과 — 오너 면제 그림(%s).' % sp['waiver'])
        grid = []
        for y in range(h):
            row = []
            for x in range(w):
                t = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].copy()
                if not t[:, :, 3].any(): row.append(None); continue
                pc = 'flat' if decal else ('solid' if (x, y) in solid else 'star')
                key = (t.tobytes(), pc)
                if key not in seen:
                    local = '%s/%d.%d' % (it['id'], x, y); seen[key] = local
                    cells[local] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s (%d,%d)' % (it['name'], x + 1, y + 1),
                                        desc='[키트 %s] %s 의 일부. 키트로 통째로 놓는다. %s' % (it['id'], it['name'], how), tags=tags[:6])
                    group_cells[gid].append(local)
                row.append(seen[key])
            grid.append(row)
        if it['type'] == 'building':
            ps = set(it.get('pass', []))
            parts = [dict(kind='entrance', x=c, y=h - 1, w=1, h=1, label='지나는 문' if c in ps else '출입구') for c in it['doors']]
            access = [dict(x=c, y=h) for c in it['doors']]
            desc = '%s — %s 건물(%s), %d층, 폭 %d칸×높이 %d칸(밑면 막힘 %d줄, 키트 폭 = 벽 폭). 정면 + 위에서 본 지붕 면(직각 지붕). %s%s %s' % (
                it['name'], TIER_KO[it['tier']], it['en'], it['floors'], w, h, it['depth'],
                '실내 program %s. ' % it['program'] if it.get('program') else '', '문 열 %s 은 걸어서 지나간다. ' % sorted(ps) if ps else '', how)
            rules = it['rule'] + ' 다음 건물은 x + %d 에 벽을 맞대 세우거나 1~2칸 골목을 둔다. 아래 %d줄만 막힘이고 그 위는 사람이 뒤로 지나가며 가려지는 칸이다. 문 바로 아래 한 칸은 걷는 바닥으로 둔다.' % (w, it['depth'])
            ai = dict(snap='floor', tags=tags, description=desc, placementRules=rules, repeatability='fixed', growthAxis=None, anchor=dict(dx=w // 2, dy=h - 1), access=access, role='building')
        else:
            parts = []
            where = ('건물 평지붕 면 위에 4층(덧그림 위층)으로 얹는다. 전부 ★ 칸.' if it['place'] == 'roof' else
                     '바닥 그림, 밟고 지나간다.' if decal else '서 있는 기물, 맨 아래 줄 %d칸 막힘%s.' % (w, ', 위 줄은 사람 위에 그려진다' if h > 1 else ''))
            desc = '%s (%s) — %s %s' % (it['name'], it['en'], where, how)
            ai = dict(snap='floor', tags=tags, description=desc, placementRules=it['rule'], repeatability='repeat' if it.get('tile') else 'fixed', growthAxis='x' if it.get('tile') else None,
                      anchor=dict(dx=0, dy=h - 1), access=[], role='prop')
        kits.append(dict(id=it['id'], name=it['name'], grid=grid, parts=parts, ai=ai))
    names = dict(building=('Fable 건물(일본)', 'building', '일본 건물 60종(소형~랜드마크)의 칸. 낱칸으로 칠하지 않는다.', '키트(jp-bldg-f-…)로 통째로 찍는다.'),
                 okujo=('옥상 기물(일본)', 'prop', '평지붕 위 기물(실외기·물탱크·빨래·사당·안테나·간판 탑 …)의 칸.', '키트(jp-prop-okujo-…)로 지붕 면 위 4층에 찍는다.'),
                 inaka=('시골 기물 2(일본)', 'prop', '일본 시골 장면 벌(논·비닐하우스 마당·농기계·농협 앞·길가 신앙·차밭·과수원·어촌·산길·툇마루 앞마당)의 칸.', '키트(jp-prop-inaka2-…)로 통째로 찍는다. 같은 벌끼리 모아 놓는다.'))
    groups = [dict(id='jp:fable-' + g, name=names[g][0], role=names[g][1], defaultLayer='upper', cells=cs, desc=names[g][2] + ' 3/4 관문 미통과 — 오너 면제 그림.', rules=names[g][3])
              for g, cs in group_cells.items()]
    _CACHE['r'] = (cells, kits, groups)
    return _CACHE['r']


def build():
    cells, kits, groups = _finalize(); sp = spec()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()), 'autotiles': [],
            'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits],
            'notes': 'Fable 5.2 그림 %d키트(건물·옥상 기물·시골 기물) — 그림 PNG 를 그대로 자른 칸. 3/4 관문 미통과 — 오너 면제 묶음 %s.' % (len(kits), sp['waiver'])}


def selftest():
    r = build(); bad = 0; sp = spec(); ids = [it['id'] for it in sp['items']]
    assert len(ids) == len(set(ids)), '키트 id 중복'
    n_pos = 0
    for it, im in pictures():
        kit = next(k for k in r['kits'] if k['id'] == it['id']); a = np.array(im); solid = solid_cells(it)
        assert it['id'].startswith(('jp-bldg-f-', 'jp-prop-okujo-', 'jp-prop-inaka2-')), it['id']
        for y, row in enumerate(kit['grid']):
            for x, local in enumerate(row):
                t = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
                if local is None:
                    if t[:, :, 3].any(): bad += 1; print('빈 칸인데 그림', it['id'], x, y)
                    continue
                n_pos += 1; c = r['cells'][local]
                if not np.array_equal(np.asarray(c['img']), t): bad += 1; print('그림 다름', local)
                want = 'flat' if it.get('place') == 'decal' else ('solid' if (x, y) in solid else 'star')
                if c['pc'] != want: bad += 1; print('통행 다름', it['id'], x, y, c['pc'], want)
                al = t[:, :, 3]
                if not ((al == 0) | (al == 255)).all(): bad += 1; print('반투명', it['id'], x, y)
        if it['type'] == 'building':
            for c_ in it['doors']:
                if not (0 <= c_ < it['w']): bad += 1; print('문 열이 키트 밖', it['id'], c_)
                elif kit['grid'][it['h'] - 1][c_] is None: bad += 1; print('문 칸이 비었다', it['id'], c_)
    print('%s: kits %d, 고유 칸 %d (자리 %d), 번들 출구 열림 %d(3/4 관문 미통과 — 오너 면제), 실패 %d' % (BLOCK, len(r['kits']), len(r['cells']), n_pos, len(r['kits']), bad))
    return bad


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
