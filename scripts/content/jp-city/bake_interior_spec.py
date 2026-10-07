#!/usr/bin/env python3
"""jp_city 일본 실내 사양 굽기 — 블록 `blocks/interior_*.py` 의 interior 사전 + 번호 핀 → `src/assets/jpInteriorSpec.json`.
모양은 손 도트 실내 사양(`src/assets/handInteriorSpec.json`, `src/editor/handInterior/builder.ts` 의 HandInteriorSpec)과 같다 —
조립기 하나가 두 칩셋을 다 짓는다(build_hand_interior_room 의 tileset: "jp_city").
`bake_jp.py` 가 끝에서 부른다(핀이 정해진 뒤). 따로: python3 scripts/content/jp-city/bake_interior_spec.py
방 표(`rooms`)는 예제 맵 정의 `tiledata/jp-city/interior/rooms.json` 이 있으면 싣는다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'interior'))
from preview import registries                    # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PINS = os.path.join(ROOT, 'tiledata', 'jp-city', 'pins.json')
ROOMS = os.path.join(ROOT, 'tiledata', 'jp-city', 'interior', 'rooms.json')
OUT = os.path.join(ROOT, 'src', 'assets', 'jpInteriorSpec.json')


def build_spec(pins=None, regs=None):
    pins = pins or json.load(open(PINS, encoding='utf-8'))['cells']
    regs = regs if regs is not None else registries()
    spec = dict(version=1, source='scripts/content/jp-city/blocks/interior_*.py', tileSize=16, blank=-1, void=None,
                floors={}, walls={}, ceilings={}, objects={}, tables={}, lines={}, daises={}, goods={})
    for r in regs:
        it = r.build()['interior']
        n = lambda local: pins['%s/%s' % (r.block, local)]   # noqa: E731 — 핀에 없으면 KeyError(굽기 전에 부르면 안 된다)
        if it['void'] and spec['void'] is None: spec['void'] = n(it['void'])
        for k, f in it['floors'].items(): spec['floors'].setdefault(k, dict(f, tiles=[n(t) for t in f['tiles']]))
        for k, w in it['walls'].items(): spec['walls'].setdefault(k, dict(w, tiles=[n(t) for t in w['tiles']]))
        for k, c in it['ceilings'].items(): spec['ceilings'].setdefault(k, [n(t) for t in c])
        for k, o in it['objects'].items():
            assert k not in spec['objects'], ('가구 id 중복', k, r.block)
            spec['objects'][k] = dict(o, cells=[[dx, dy, n(loc), layer] for dx, dy, loc, layer in o['cells']])
        for k, t in it['tables'].items():
            spec['tables'][k] = dict(t, pieces={p: [[dx, dy, n(loc), layer] for dx, dy, loc, layer in cells] for p, cells in t['pieces'].items()})
        for k, g in it['goods'].items(): spec['goods'][k] = n(g)
    assert spec['void'] is not None, 'interior_shell 의 공허 칸이 없다'
    if os.path.exists(ROOMS): spec['rooms'] = json.load(open(ROOMS, encoding='utf-8'))
    return spec


def main():
    import rooms; rooms.main()                       # 예제 맵의 방 사각형 → rooms.json(사양의 방 표)
    spec = build_spec()
    open(OUT, 'w', encoding='utf-8').write(json.dumps(spec, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('jpInteriorSpec: 바닥 %d · 벽면 %d · 천장 %d · 가구 %d · 탁자 %d · 탁상 %d → %s' % (
        len(spec['floors']), len(spec['walls']), len(spec['ceilings']), len(spec['objects']), len(spec['tables']), len(spec['goods']), os.path.relpath(OUT, ROOT)))


if __name__ == '__main__': main()
