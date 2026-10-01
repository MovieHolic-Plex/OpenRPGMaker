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
        im = Image.open(HERE / ('cities-' + ('v7' if TAG == 'v8' else TAG)) / fn).convert('RGB')   # 8단계는 7단계 성곽 도시 그대로
        sheet.paste(im, (col * 16, row0 * 16))
        js['icons'].append(dict(name=name, tier=3, cells=[w, h], col=col, row=row0, firstCell=0, desc=desc))
    row1 = row0 + 6
    if TAG not in ('v5', 'v6'):       # v7: 손 도트 랜드마크 7종을 시트 아래에 덧붙인다
        import numpy as np
        import importlib
        LM = importlib.import_module('landmarks_v8' if TAG == 'v8' else 'landmarks_v7')
        sheet2 = Image.new('RGB', (sheet.width, sheet.height + 8 * 16), tuple(js['key']))
        sheet2.paste(sheet, (0, 0))
        sheet = sheet2
        col, r = 0, row1
        for name, fn, w, h, desc in LM.LANDMARKS:
            if col + w > sheet.width // 16:
                col, r = 0, r + 4
            sheet.paste(Image.fromarray(fn()), (col * 16, r * 16))
            js['icons'].append(dict(name=name, tier=3, cells=[w, h], col=col, row=r, firstCell=0, desc=desc))
            col += w
        row1 = r + 4
    js['rows'] = row1
    sheet.save(HERE / ('ext-%s.png' % TAG))
    (HERE / ('ext-%s.json' % TAG)).write_text(json.dumps(js, ensure_ascii=False))


NEW_SITES = {
    '대성': ('대성', 'ext', 'city_capital', 25, 21, M4.GRASS, 'castle', '서대륙의 수도 — 6x6 이중 성벽'),
    '사바나 마을': ('사바나 마을', 'ext', 'city_fort', 72, 24, M4.SAVANNA, 'castle', '동대륙 성곽 도시 4x4'),
    '내해 항구': ('내해 항구', 'ext', 'city_harbor', 40, 30, M4.GRASS, 'town', '내해 북안 항구 성읍 5x4'),
}


LANDMARK_SITES = [   # 이름, 아이콘, x, y, 밑 바닥(None=그대로), 설명
    ('거대한 탑', 'giant_tower', 47, 30, None, '내해 동안 초원의 거대 탑'),
    ('폐허 도시', 'ruined_city', 78, 24, None, '동대륙 화산재 벌판의 폐허 도시'),
    ('거목', 'giant_tree', 15, 34, None, '서부 숲 가운데 거목'),
    ('분화구 호수', 'crater_lake', 68, 40, None, '붉은 고원의 분화구 호수'),
    ('사막 신전', 'desert_temple', 33, 60, None, '남서 사막의 신전'),
    ('고대 돌원', 'stone_circle', 48, 37, None, '내해 동안 초원의 돌원'),
]
LANDMARK_ROUTES = [   # 8단계
    ('거대한 탑 ─ 내해 항구', '거대한 탑', '내해 항구', []),
    ('거대한 탑 ─ 고대 돌원', '거대한 탑', '고대 돌원', []),
    ('거목 ─ 서 고원 아랫 경사로', '거목', '서 고원 아랫 경사로', []),
    ('사막 신전 ─ 사막 폐허', '사막 신전', '사막 폐허', []),
    ('폐허 도시 ─ 사바나 마을', '폐허 도시', '사바나 마을', []),
    ('분화구 호수 ─ 동 고원 경사로', '분화구 호수', '동 고원 아랫 경사로', []),
]
SKY = ('천공섬', 'sky_island', 58, 49, '두 대륙 사이 바다 위에 뜬 대륙')
SKY_PASTE_ICON = True   # [worldmap-kit] False 면 바다 그림자만 드리우고 아이콘은 빌더가 팔레트 뒤에 붙인다(기본 True = 원래 동작)


def paste_sky(M4_render):
    import numpy as np
    def render(M, ic, meta):
        img, info = M4_render(M, ic, meta)
        import worldmap_easyrpg_plus as wm
        name, spec, x, y, why = SKY
        m = {i['name']: i for i in json.loads(wm.EXT_JSON.read_text())['icons']}[spec]
        w, h = m['cells']
        ext = np.array(Image.open(wm.EXT).convert('RGB'), np.uint8)
        icon = ext[m['row'] * 16:(m['row'] + h) * 16, m['col'] * 16:(m['col'] + w) * 16]
        # 바다에 드리운 그림자: 섬 아래 6칸, 체크 점묘
        Y, X = np.mgrid[0:img.shape[0], 0:img.shape[1]]
        cx, cy = (x + w / 2) * 16, (y + h + 3.2) * 16
        seaish = (img[..., 2].astype(int) > img[..., 0].astype(int) + 20)
        if TAG == 'v8':
            # 8단계: 오른쪽 아래로 비낀 부드러운 그림자 — 안쪽은 꽉, 바깥 고리는 체크, 가장 바깥은 성긴 점
            cx, cy = (x + w / 2 + .8) * 16, (y + h + .55) * 16
            r2 = ((X - cx) / (w * 16 * .34)) ** 2 + ((Y - cy) / 8.0) ** 2
            chk = ((X + Y) & 1) == 0
            inner = (r2 < .45) & seaish
            ring = (r2 >= .45) & (r2 < 1) & chk & seaish
            outer = (r2 >= 1) & (r2 < 1.5) & ((X % 4 == 0) & (Y % 2 == 0)) & seaish
            for m_, k_ in ((inner, [.62, .68, .80]), (ring, [.62, .68, .80]), (outer, [.75, .8, .88])):
                img[m_] = (img[m_].astype(np.float32) * k_).astype(np.uint8)
        else:
            sh = (((X - cx) / (w * 16 * .42)) ** 2 + ((Y - cy) / 9.0) ** 2) < 1
            sh &= ((X + Y) & 1) == 0
            sh &= seaish
            img[sh] = (img[sh].astype(np.float32) * [.55, .6, .75]).astype(np.uint8)
        dst = img[y * 16:(y + h) * 16, x * 16:(x + w) * 16]
        solid = ~np.all(icon == wm.KEY, axis=2)
        if SKY_PASTE_ICON:
            dst[solid] = icon[solid]
        info.setdefault('landmarks', []).append(dict(name=name, x=x, y=y, w=w, h=h, why=why))
        return img, info
    return render


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
    if TAG not in ('v5', 'v6'):       # v7: 해안선·숲 가장자리·3띠 바다
        import coast_v6
        coast_v6.install(M4)
        import importlib
        importlib.import_module('cliff_v8' if TAG == 'v8' else 'cliff_v7').install(M4)
        if cities:
            for name, icon, x, y, g, why in LANDMARK_SITES:
                M4.SITES.append((name, 'ext', icon, x, y, g, 'landmark', why))
            if TAG == 'v8':      # 8단계: 랜드마크와 마을을 잇는 길(같은 길 문법)
                M4.ROUTES.extend(LANDMARK_ROUTES)
            if not getattr(M4, '_sky_installed', False):
                M4.render = paste_sky(M4.render)
                M4._sky_installed = True
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
