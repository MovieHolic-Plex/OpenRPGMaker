#!/usr/bin/env python3
"""jp_city 블록 `story_objects` — 이야기 기물(샘 돌 수반 — tiledata/jp-city/objects/spec.json). 계약: ../CONTRACT.md
  python3 scripts/content/jp-city/blocks/story_objects.py        # selftest(관문 출구 규칙 · 크기 · 그림 그대로)

**코드로 그린 그림이 아니다**: pieces/<src> PNG 를 그대로 칸으로 자른다(색 맞춤·다시 그리기 없음 — 한 화소라도 바뀌면 오너 면제가 풀린다).
이 그림들은 3/4 관문 미통과 — 오너 면제 묶음(spec.waiver)이다. 출구 검사는 관문 자신의 규칙 하나뿐이다:
object_gate.refusal(그림, kind, context='bundle') 이 None 이 아니면 build() 가 멈춘다(굽기 전체가 멈춘다). 이 블록에 둘째 규칙은 없다.
번호 핀 키 = story_objects/<id>/<x>.<y> (덧붙이기 전용). 새 기물은 spec.json 의 items 끝에만 더한다."""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
from PIL import Image                                     # noqa: E402

BLOCK = 'story_objects'
OBJ = os.path.join(ROOT, 'tiledata', 'jp-city', 'objects')


def spec(): return json.load(open(os.path.join(OBJ, 'spec.json'), encoding='utf-8'))


def pictures():
    """(항목, RGBA 그림) — 번들 출구에서 막힌 그림이 있으면 멈춘다. 그림은 열기만 하고 바꾸지 않는다."""
    import object_gate as OG
    out, blocked = [], []
    for it in spec()['items']:
        im = Image.open(os.path.join(OBJ, 'pieces', it['src'])).convert('RGBA')
        assert im.size == (it['w'] * 16, it['h'] * 16), (it['id'], im.size)
        why = OG.refusal(im, kind=it['kind'], context='bundle')
        if why is not None: blocked.append('jp_city/%s: %s' % (it['src'][:-4], why))
        out.append((it, im))
    if blocked: raise SystemExit('3/4 관문 출구에서 막힘 %d:\n  ' % len(blocked) + '\n  '.join(blocked))
    return out


def build():
    sp = spec(); cells = collections.OrderedDict(); kits = []
    for it, im in pictures():
        decal = it['place'] == 'decal'; block = {tuple(c) for c in it['block']}
        how = '바닥 그림, 밟고 지나간다.' if decal else '서 있는 기물, 막힌 칸 %s%s.' % (
            ' '.join('(%d,%d)' % c for c in sorted(block, key=lambda c: (c[1], c[0]))), ', 나머지 칸은 사람 위에 그려진다' if len(block) < it['w'] * it['h'] else '')
        desc = f"{it['desc']} ({it['en']}) — {how} 3/4 관문 미통과 — 오너 면제 그림({sp['waiver']})."
        grid = []
        for y in range(it['h']):
            row = []
            for x in range(it['w']):
                cell = im.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16))
                if not cell.getbbox(): row.append(None); continue
                local = '%s/%d.%d' % (it['id'], x, y)
                cells[local] = dict(img=cell, pc='flat' if decal else ('solid' if (x, y) in block else 'star'), label='%s (%d,%d)' % (it['name'], x + 1, y + 1),
                                    desc=desc, tags=['이야기 기물', '주제 소품'] + list(it['words']))
                row.append(local)
            grid.append(row)
        kits.append(dict(id='jp-' + it['id'], name=it['name'], grid=grid, parts=[],
                         ai=dict(snap='floor', tags=['이야기 기물', '주제 소품'] + list(it['words']) + [it['place']], description=desc, placementRules=it['rule'],
                                 repeatability='fixed', growthAxis=None, anchor=dict(dx=0, dy=it['h'] - 1), access=[], role='prop')))
    groups = [dict(id='jp:story-objects', name='이야기 기물(샘)', role='prop', defaultLayer='upper', cells=list(cells.keys()),
                   desc='게임들이 바랐는데 그림이 없던 이야기 기물의 칸. 3/4 관문 미통과 — 오너 면제 그림. 낱칸으로 칠하지 않는다.',
                   rules='키트(jp-spring-basin …)로 통째로 찍는다. 빈 땅 채우기에 흩지 않는다 — 이야기가 부를 때만.')]
    return {'cells': cells, 'autotiles': [], 'groups': groups, 'kits': kits,
            'notes': '이야기 기물 %d키트 — 그림 PNG 를 그대로 자른 칸(코드 그림 아님). 3/4 관문 미통과 — 오너 면제 묶음 %s.' % (len(kits), sp['waiver'])}


def selftest():
    import numpy as np
    r = build(); bad = 0
    for it, im in pictures():
        kit = next(k for k in r['kits'] if k['id'] == 'jp-' + it['id'])
        for y, row in enumerate(kit['grid']):
            for x, local in enumerate(row):
                if local is None: continue
                if not np.array_equal(np.asarray(r['cells'][local]['img']), np.asarray(im.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)))): bad += 1; print('그림 다름', local)
    print('%s: kits %d, cells %d, 번들 출구 열림 %d(3/4 관문 미통과 — 오너 면제), 실패 %d' % (BLOCK, len(r['kits']), len(r['cells']), len(r['kits']), bad))
    return bad


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
