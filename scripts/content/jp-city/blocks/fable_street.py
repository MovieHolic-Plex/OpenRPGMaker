#!/usr/bin/env python3
"""jp_city 블록 `fable_street` — Fable 5.2 로 그린 일본 거리의 바닥 · 테 · 노면 표시 · 경계 줄 · 가로 소품(tiledata/jp-city/fable-street/spec.json). 계약: ../CONTRACT.md
  python3 scripts/content/jp-city/blocks/fable_street.py        # selftest(관문 출구 · 크기 · 칸에서 다시 조립 == 그림 · 층·통행)

그림은 pieces/<키트 id>.png 를 그대로 칸으로 자른다(색 맞춤·다시 그리기 없음 — 한 화소라도 바뀌면 오너 면제가 풀린다).
조각 그림은 scripts/content/jp-city/street/fable_street_spec.py 가 원본 그림(sheets/)에서 만든다 — 다시 지으려면 그 스크립트.
색은 확장 팔레트(tiledata/jp-city/fable-city/palette.json — 거리 바닥 램프 lawn·earth·tarmac 포함). 일본 팔레트 계약이 옮기는 색은 없다(화소 불변).
3/4 관문 미통과 — 오너 면제 묶음(spec.waiver). 출구 검사는 관문 자신의 규칙 하나: object_gate.refusal(그림, kind, context='bundle').
칸 번호 핀 키 = fable_street/<키트 id>/<x>.<y> (덧붙이기 전용, 예약 4,032칸). 같은 화소·같은 통행의 칸은 블록 안에서 하나로 합친다(처음 나온 자리의 키).
층(spec 의 layer):
  ground 바닥 무늬(아래층 칸 — 구성기 실행기가 가족마다 이 키트의 칸을 읽어 1층에 깐다. 물은 막힘)
  bank   제 바닥을 가져오는 조각(둑 면은 막힌 아래층, 둑 계단은 걷는 아래층. 투명한 칸은 위층)
  floor  바닥 덧그림(연석·테·노면 표시·맨홀·디딤돌 — 투명 덧그림, 밟고 지나간다, 2층에 찍는다)
  shade  건물 발치 그늘(바닥별 — 밟고 지나간다)
  prop   서 있는 것(맨 아래 줄에서 그림이 있는 칸은 막힘, 그 위는 ★. 건물 벽면에 붙는 것·물 위의 것·대문 문짝·아치 들보·차양은 전부 ★)"""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402

BLOCK = 'fable_street'
OBJ = os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-street')
PIECES = os.path.join(ROOT, 'src', 'assets', 'jpCityStreetPieces.json')
ANCHOR_RULE = {
    'wall': '건물 정면이나 담 바로 앞 칸에 세운다.', 'kerb': '차도 옆 보도의 연석 줄에 세운다. 차도 칸을 덮지 않는다.', 'lot': '필지 안(마당·앞마당), 건물·담·필지 끝에 붙여 세운다.',
    'open': '광장·공원·마당에 세운다.', 'facade': '건물 벽면 위에 붙인다.', 'road': '차도 칸에만 놓는다.', 'water': '물 칸에만 놓는다.',
    'floor': '바닥에 깔리는 덧그림 — 밟고 지나간다.', 'run': '경계 줄 조각 — 줄 짓기가 끝·가운데·모퉁이·대문을 맞춰 놓는다. 낱개로 놓지 않는다.'}
_CACHE = {}


def spec():
    p = os.path.join(OBJ, 'spec.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else dict(waiver='', items=[])


def walk_through():
    """전부 ★ 인 서 있는 조각 이름: 대문 문짝 · 아치 들보·간판 · 차양 · 카포트."""
    d = json.load(open(PIECES, encoding='utf-8'))
    names = {r['gate'][1] for r in d['runs'].values() if r.get('gate')}
    for n, p in d['pieces'].items():
        if p['layer'] == 'over' or 'cover' in p['tags'] or n in ('arch-beam', 'arch-sign'): names.add(n)
    return names


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


def cell_pc(it, a, x, y, through):
    """칸 하나의 (층, 통행): ('lo'|'up', pc)."""
    t = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
    opaque = bool((t[:, :, 3] == 255).all())
    layer = it['layer']
    if layer == 'ground': return 'lo', ('solidfloor' if it['piece'].startswith('gnd-water') else 'floor')
    if layer == 'bank':
        stair = 'stair' in it['piece']
        if opaque: return 'lo', ('floor' if stair else 'solidfloor')
        return 'up', ('flat' if stair else 'solid')
    if layer in ('floor', 'shade'): return 'up', 'flat'
    if it['anchor'] in ('facade', 'water') or it['piece'] in through: return 'up', 'star'
    return 'up', ('solid' if y == it['h'] - 1 and int((t[:, :, 3] > 0).sum()) >= 24 else 'star')


def group_of(it):
    if it['layer'] == 'ground': return 'gnd-' + it['piece'][4:].replace('-2', '')
    if it['layer'] in ('bank', 'shade'): return it['layer']
    if it['layer'] == 'floor': return 'mark' if 'mark' in it['tags'] else 'border' if 'border' in it['tags'] else 'floor'
    return 'run' if it['anchor'] == 'run' else 'car' if it['anchor'] == 'road' else 'prop'


GROUPS = collections.OrderedDict([
    ('gnd-pave', ('새 거리 바닥 · 보도 블록', 'path', 'lower', '보도 블록 바닥 칸.')), ('gnd-forecourt', ('새 거리 바닥 · 가게 앞마당 판', 'path', 'lower', '가게 앞마당의 모래색 판 바닥 칸.')),
    ('gnd-tarmac', ('새 거리 바닥 · 아스팔트', 'road', 'lower', '차도·주차장의 아스팔트 칸.')), ('gnd-alley', ('새 거리 바닥 · 골목 돌길', 'path', 'lower', '골목 돌길 바닥 칸.')),
    ('gnd-earth', ('새 거리 바닥 · 다진 흙', 'terrain', 'lower', '집 마당의 다진 흙 칸.')), ('gnd-lawn', ('새 거리 바닥 · 잔디', 'green', 'lower', '마당 잔디 칸.')),
    ('gnd-lane', ('새 거리 바닥 · 생활도로 포장', 'path', 'lower', '보도 없는 생활도로·골목의 낡은 포장 칸(사람도 걷는다).')), ('gnd-laneside', ('새 거리 바닥 · 생활도로 길가 띠', 'path', 'lower', '생활도로 북쪽 가장자리 한 줄(배수로와 흰 선).')),
    ('gnd-water', ('새 거리 바닥 · 물', 'water', 'lower', '하천 물 칸(막힘).')), ('bank', ('새 거리 · 둑', 'edge', 'mixed', '하천 둑 면·갓돌·계단 칸.')),
    ('border', ('새 거리 · 재료 테', 'edge', 'upper', '재료가 만나는 자리의 연석·돌 테·잔디 테(투명 덧그림).')), ('mark', ('새 거리 · 노면 표시', 'detail', 'upper', '차선·횡단보도·정지선(투명 덧그림).')),
    ('floor', ('새 거리 · 바닥 덧그림', 'detail', 'upper', '맨홀·배수구·점자 블록·디딤돌·바닥 무늬 덧그림.')), ('shade', ('새 거리 · 건물 발치 그늘', 'detail', 'upper', '건물 남쪽 발치의 그늘(바닥별).')),
    ('run', ('새 거리 · 경계 줄', 'wall', 'upper', '담·산울타리·판자담·난간·가드레일·철망의 끝·가운데·모퉁이·대문 조각.')), ('car', ('새 거리 · 차', 'prop', 'upper', '차도에 서는 차.')),
    ('prop', ('새 거리 · 가로 소품', 'prop', 'upper', '자판기·자전거·가로등·전봇대·표지·벤치·화분·가게 앞 물건·마당 것·나무.'))])


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    sp = spec(); cells = collections.OrderedDict(); seen = {}; kits = []; group_cells = collections.defaultdict(list); through = walk_through()
    how = '3/4 관문 미통과 — 오너 면제 그림(%s).' % sp['waiver']
    for it, im in pictures():
        a = np.array(im); w, h = it['w'], it['h']; gid = group_of(it)
        tags = ['Fable 그림', '새 거리'] + list(it['tags'])[:3]
        grid, base, lo_any = [], [], False
        for y in range(h):
            row, brow = [], []
            for x in range(w):
                t = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].copy()
                if not t[:, :, 3].any(): row.append(None); brow.append(None); continue
                lay, pc = cell_pc(it, a, x, y, through)
                # 서 있는 조각의 윗칸: 밑동 줄로 사람과 y 정렬한다(foot-dy:N) — 밑동보다 북쪽에 선 사람은 가려지고 남쪽 사람은 앞에 선다.
                # 벽면 조각(아치·차양)과 덮개(카포트)는 늘 사람 위다.
                dy = h - 1 - y
                foot = ['foot-dy:%d' % dy] if pc == 'star' and dy > 0 and it['layer'] == 'prop' and it['anchor'] not in ('facade', 'water') and 'cover' not in it['tags'] else []
                key = (t.tobytes(), pc, dy if foot else 0)
                if key not in seen:
                    local = '%s/%d.%d' % (it['id'], x, y); seen[key] = local
                    cells[local] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s (%d,%d)' % (it['name'], x + 1, y + 1), desc='[키트 %s] %s 의 일부. %s' % (it['id'], it['name'], how), tags=tags + foot)
                    group_cells[gid].append(local)
                if lay == 'lo': row.append(None); brow.append(seen[key]); lo_any = True
                else: row.append(seen[key]); brow.append(None)
            grid.append(row); base.append(brow)
        rule = {'ground': '바닥 무늬 — 구성기가 가족 단위로 깐다. 낱개로 찍지 않는다.', 'bank': '하천 둑 줄에 놓는다.', 'shade': '건물 남쪽 발치 줄에 깐다.'}.get(it['layer']) or ANCHOR_RULE[it['anchor']]
        ai = dict(snap='floor', tags=tags, description='%s — 새 거리 조각. %s' % (it['name'], how), placementRules=rule, repeatability='repeat' if it['layer'] in ('ground', 'floor', 'shade') or it['anchor'] == 'run' else 'fixed',
                  growthAxis=None, anchor=dict(dx=0, dy=h - 1), access=[], role='prop')
        kits.append(dict(id=it['id'], name=it['name'], grid=grid, base=base if lo_any else None, parts=[], ai=ai))
    groups = [dict(id='jp:fable-street:' + g, name=GROUPS[g][0], role=GROUPS[g][1], defaultLayer=GROUPS[g][2], cells=group_cells[g], desc=GROUPS[g][3] + ' 3/4 관문 미통과 — 오너 면제 그림.',
                   rules='구성기(거리 장면)가 키트(jp-st-…)로 놓는다.') for g in GROUPS if group_cells.get(g)]
    _CACHE['r'] = (cells, kits, groups)
    return _CACHE['r']


def build():
    cells, kits, groups = _finalize(); sp = spec()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()), 'autotiles': [],
            'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits],
            'notes': 'Fable 5.2 그림 %d키트(거리 바닥·테·노면 표시·경계 줄·가로 소품) — 그림 PNG 를 그대로 자른 칸. 3/4 관문 미통과 — 오너 면제 묶음 %s.' % (len(kits), sp['waiver'])}


def selftest():
    r = build(); bad = 0; sp = spec(); ids = [it['id'] for it in sp['items']]; through = walk_through()
    assert len(ids) == len(set(ids)), '키트 id 중복'
    n_pos = 0
    for it, im in pictures():
        kit = next(k for k in r['kits'] if k['id'] == it['id']); a = np.array(im)
        assert it['id'].startswith('jp-st-'), it['id']
        for y in range(it['h']):
            for x in range(it['w']):
                t = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
                up = kit['grid'][y][x]; lo = kit['base'][y][x] if kit['base'] else None
                if up is None and lo is None:
                    if t[:, :, 3].any(): bad += 1; print('빈 칸인데 그림', it['id'], x, y)
                    continue
                if up is not None and lo is not None: bad += 1; print('두 층에 다 있다', it['id'], x, y)
                n_pos += 1; c = r['cells'][up or lo]
                if not np.array_equal(np.asarray(c['img']), t): bad += 1; print('그림 다름', it['id'], x, y)
                lay, want = cell_pc(it, a, x, y, through)
                if c['pc'] != want or (lay == 'lo') != (lo is not None): bad += 1; print('층·통행 다름', it['id'], x, y, c['pc'], want)
                al = t[:, :, 3]
                if not ((al == 0) | (al == 255)).all(): bad += 1; print('반투명', it['id'], x, y)
                if c['pc'] in ('floor', 'solidfloor') and not (al == 255).all(): bad += 1; print('아래층 칸이 불투명하지 않다', it['id'], x, y)
    print('%s: kits %d, 고유 칸 %d (자리 %d), 번들 출구 열림 %d(3/4 관문 미통과 — 오너 면제), 실패 %d' % (BLOCK, len(r['kits']), len(r['cells']), n_pos, len(r['kits']), bad))
    return bad


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
