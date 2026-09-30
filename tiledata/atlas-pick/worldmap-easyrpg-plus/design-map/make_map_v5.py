#!/usr/bin/env python3
"""월드맵 설계 데모 5단계 — 4단계 지도 + 자연 경계·3단 수심. (도시·애니는 후속 모듈)"""
import sys, json, os
from pathlib import Path
HERE = Path(__file__).resolve().parent
TAG = os.environ.get('CITY_TAG', 'v5')   # v6: 성곽 도시 재작업 판(cities-v6, ext-v6, design-1x-v6)
sys.path.insert(0, str(HERE))
import make_map_v4 as M4
import boundary_v5 as B5
from PIL import Image

def ext_with_cities():
    """원본 ext 시트 아래에 성곽 도시 3종을 덧붙인 사본(ext-v5.png/json)을 만든다."""
    import json, numpy as np
    src = HERE.parent / 'world-plus-ext.png'
    js = json.loads((HERE.parent / 'world-plus-ext.json').read_text())
    base = Image.open(src).convert('RGB')
    add = [('city_capital', 'capital-96.png', 0, 6, 6, '수도 — 6x6 이중 성벽 도시'),
           ('city_fort', 'fort-64.png', 6, 4, 4, '성곽 도시 — 4x4'),
           ('city_harbor', 'harbor-80x64.png', 10, 5, 4, '항구 성곽 도시 — 5x4, 남쪽이 부두')]
    row0 = js['rows']
    sheet = Image.new('RGB', (base.width, base.height + 6 * 16), tuple(js['key']))
    sheet.paste(base, (0, 0))
    for name, fn, col, w, h, desc in add:
        im = Image.open(HERE / ('cities-' + TAG) / fn).convert('RGB')
        sheet.paste(im, (col * 16, row0 * 16))
        js['icons'].append(dict(name=name, tier=3, cells=[w, h], col=col, row=row0, firstCell=0, desc=desc))
    js['rows'] = row0 + 6
    sheet.save(HERE / ('ext-%s.png' % TAG))
    (HERE / ('ext-%s.json' % TAG)).write_text(json.dumps(js, ensure_ascii=False))


NEW_SITES = {
    '대성': ('대성', 'ext', 'city_capital', 25, 21, M4.GRASS, 'castle', '서대륙의 수도 — 6x6 이중 성벽'),
    '사바나 마을': ('사바나 마을', 'ext', 'city_fort', 72, 24, M4.SAVANNA, 'castle', '동대륙 성곽 도시 4x4'),
    '내해 항구': ('내해 항구', 'ext', 'city_harbor', 40, 30, M4.GRASS, 'town', '내해 북안 항구 성읍 5x4'),
}


def build_v5(ground=True, depth=True, cities=True):
    if cities:
        import worldmap_easyrpg_plus as wm
        ext_with_cities()
        wm.EXT = HERE / ('ext-%s.png' % TAG)
        wm.EXT_JSON = HERE / ('ext-%s.json' % TAG)
        M4.SITES[:] = [NEW_SITES.get(s[0], s) for s in M4.SITES]
    if ground:
        M4.render_ground = B5.render_ground_v5
    if depth:
        M4.render_depth = B5.render_depth_v5
    M, icon_cells, meta, info0 = M4.build()
    if cities and TAG != 'v5':
        # 항구 부두가 바다에 닿도록: 성읍 바로 남쪽 줄(y=34)에 남은 땅 한 칸을 물로
        M.G[34, 40:45] = 0
    return M, icon_cells, meta

if __name__ == '__main__':
    M, ic, meta = build_v5()
    img, info = M4.render(M, ic, meta)
    Image.fromarray(img).save(HERE / ('design-1x-v5b.png' if TAG == 'v5' else 'design-1x-%s.png' % TAG))
    print('ok', img.shape)
