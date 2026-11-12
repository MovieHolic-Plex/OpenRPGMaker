#!/usr/bin/env python3
"""오너 면제 단계의 입력을 다시 쓴다(모델·관문 기록 없음): tiledata/steampunk-city/fable-redraw/waiver-manifest.json · recolour-trail.json.

  python3 scripts/content/steampunk-city/fable/manifest.py      # art/<묶음>.py 로 _gate 를 내보낸 뒤에

- waiver-manifest.json: `npm run harness -- object-gate owner-waive --manifest …` 가 읽는 목록. 라벨의 무리 = fable/(pieces/·held/ 에 그림이 있는 조각: Fable 한 방과 그 조립) · recolour/(코드 도트의 색만 옮긴 조각).
- recolour-trail.json: 면제 묶음에 싣지 못하는 장별 흔적. `before`(2026-11-12 다시 굽기 전의 화소 해시·옛 영수증)는 그대로 두고 지금 화소 해시만 고친다.
면제 기록 자체는 이 스크립트가 쓰지 않는다 — 오너의 말이 있을 때 owner-waive 단계로만 쓴다(openwiki/harnesses/object-gate.md «오너 면제»).
"""
import json, os, sys
import fb_common as C
sys.path.insert(0, os.path.join(C.ROOT, 'src', 'harnesses', '_core'))
import object_gate as OG   # noqa: E402  (pixel_sha256 만 쓴다)

TD = os.path.join(C.ROOT, 'tiledata', 'steampunk-city')
GROUPS = ('terrain', 'buildings', 'props', 'pipes', 'vehicles', 'street', 'interior')


def main():
    tp = os.path.join(C.FABLE, 'recolour-trail.json')
    old = json.load(open(tp, encoding='utf-8'))
    by = {t['piece']: t for t in old['items']}
    items, trail = [], []
    for g in GROUPS:
        for line in open(os.path.join(TD, g, '_gate', 'items.jsonl'), encoding='utf-8'):
            r = json.loads(line); pid = r['png'][:-4]
            fable = os.path.exists(os.path.join(C.PIECES, g, r['png'])) or os.path.exists(os.path.join(C.FABLE, 'held', r['png']))
            grp = 'fable' if fable else 'recolour'
            rel = f'tiledata/steampunk-city/{g}/_gate/{r["png"]}'
            items.append(dict(png=rel, kind=r['kind'], chipset='steampunk_city', label=f'{grp}/{pid}'))
            t = dict(by.get(f'{g}/{pid}') or dict(group=grp, id=pid, piece=f'{g}/{pid}', kind=r['kind'], how='(새 조각 — how 를 적을 것)', before=None))
            assert t['group'] == grp and t['kind'] == r['kind'], ('무리·종류가 흔적과 다르다', g, pid)
            t['pixelSha256'] = OG.pixel_sha256(os.path.join(C.ROOT, rel))
            trail.append(t)
    n = {k: sum(1 for t in trail if t['group'] == k) for k in ('fable', 'recolour')}
    wr = lambda p, o: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, indent=1) + '\n')
    wr(os.path.join(C.FABLE, 'waiver-manifest.json'), dict(note='object-gate owner-waive 의 --manifest 입력(저장소 뿌리에서 돌린다). 묶음 fable-redraw-steampunk-city-2026-11-12. 두 무리: fable/(Fable 5.2 medium 한 방 그림과 그 조립) · recolour/(옛 조각의 색만 옮긴 것). 기록은 owner-waive 단계만 쓴다.', items=items))
    wr(tp, dict(note=old['note'], counts=n, items=trail))
    print(n, len(items))


if __name__ == '__main__':
    main()
