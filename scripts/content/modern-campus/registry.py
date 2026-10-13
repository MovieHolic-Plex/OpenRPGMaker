#!/usr/bin/env python3
"""modern_campus 야외 칸 등록부 — 모든 묶음 그림을 모아 object-gate 영수증을 대조하고, 통과분만 stable id(pins.json, 덧붙이기 전용)로 registry.json 에 쓴다.
다음 단계 bake_mc.py 는 registry.json 의 items 를 읽어 시트를 굽는다(출구에서 require_all 로 한 번 더 확인).
python3 registry.py"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
from object_gate import pixel_sha256, read_receipt           # noqa: E402
from PIL import Image                                          # noqa: E402
BASE = os.path.join(ROOT, 'tiledata', 'modern-campus')
GROUPS = [('props_legacy', '_gate'), ('terrain',), ('props_a',), ('props_b',), ('props_c',), ('buildings',), ('anim',)]
PINS = os.path.join(HERE, 'pins.json')


def main():
    pins = json.load(open(PINS)) if os.path.exists(PINS) else {}
    items, rej = [], []
    for g in GROUPS:
        d = os.path.join(BASE, *g[1:]) if g[0] == 'props_legacy' else os.path.join(BASE, g[0], '_gate')
        if not os.path.isdir(d): continue
        for l in open(os.path.join(d, 'items.jsonl')):
            m = json.loads(l); png = m['png']
            png = os.path.join(d, os.path.basename(png)); im = Image.open(png); sha = pixel_sha256(png); r = read_receipt(sha)
            rec = dict(id=m['label'].split('/')[-1], group=g[0], name=m['name'], kind=m['kind'], cells=[im.width // 16, im.height // 16], png=os.path.relpath(png, ROOT), sha=sha)
            if r and r.get('verdict') == 'pass' and r.get('kind') == m['kind']: items.append(rec)
            else: rej.append(dict(rec, verdict=(r or {}).get('verdict', 'no-receipt')))
    for it in items:
        if it['id'] not in pins: pins[it['id']] = len(pins)
        it['pin'] = pins[it['id']]
    json.dump(pins, open(PINS, 'w'), indent=1, ensure_ascii=False)
    items.sort(key=lambda i: i['pin'])
    json.dump(dict(schema='modern-campus-outdoor/1', note='object-gate 통과분만. 번들 미배선.', items=items, rejected=rej), open(os.path.join(BASE, 'registry.json'), 'w'), indent=1, ensure_ascii=False)
    from collections import Counter
    print('통과 %d · 불합격/미판정 %d' % (len(items), len(rej)))
    print(Counter(i['group'] for i in items)); print([r['id'] for r in rej])


main()
