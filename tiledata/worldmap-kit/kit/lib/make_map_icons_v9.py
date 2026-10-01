#!/usr/bin/env python3
"""월드맵 설계 데모 9단계(고유 아이콘 확대) — v8 지도를 그대로 두고 장소 아이콘만 전부 고유 그림으로 바꿔 다시 렌더한다.

  python3 make_map_icons_v9.py            → ext-v9-icons.png/json, design-1x-v9-icons.png, map-v9-icons.json
  python3 make_map_icons_v9.py --baseline → 아이콘을 안 바꾼 v8 재현본을 /tmp 에 저장(결정성 확인용)

v8 산출물(ext-v8.*, design-1x-v8.png, map-v4.json)은 읽기만 한다. 쓰는 파일은 전부 이름에 icons 가 들어간다.
make_map_v5.build_v5() 의 흐름(성곽 도시·랜드마크·천공섬·해안·절벽)을 그대로 복제하되, ext 시트 경로와 장소→아이콘 매핑만 바꾼다.
"""
import json
import os
import sys
from pathlib import Path

os.environ['CITY_TAG'] = 'v8'
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import make_map_v5 as M5  # noqa: E402
import make_map_v4 as M4  # noqa: E402
import boundary_v5 as B5  # noqa: E402
import worldmap_easyrpg_plus as wm  # noqa: E402

KEY = (255, 103, 139)
SHADOW_KEY = (254, 103, 139)          # 그림자 키: 이 픽셀 밑 지형을 어둡게 한다(바닥에 드리운 그림자)
SHADOW_MUL = np.array([.64, .70, .82])


def ext_v8_sheet():
    """ext-v8.png/json 이 이미 있으면 읽고, 없으면 만든다(M5.ext_with_cities 는 ext-v8.* 를 쓴다)."""
    png, js = HERE / 'ext-v8.png', HERE / 'ext-v8.json'
    return Image.open(png).convert('RGB'), json.loads(js.read_text())


def build_ext_v9(icons):
    """icons: [(name, ndarray(h,w,3), desc)] → v8 ext 시트 아래에 이어 붙인 ext-v9-icons.png/json."""
    base, js = ext_v8_sheet()
    cols = base.width // 16
    row = js['rows']
    placed = []
    col, rowh = 0, 0
    r = row
    for name, arr, desc in icons:
        h, w = arr.shape[0] // 16, arr.shape[1] // 16
        if col + w > cols:
            col, r, rowh = 0, r + rowh, 0
        placed.append((name, arr, desc, col, r, w, h))
        col += w
        rowh = max(rowh, h)
    nrows = r + rowh
    sheet = Image.new('RGB', (base.width, nrows * 16), tuple(js['key']))
    sheet.paste(base, (0, 0))
    for name, arr, desc, c0, r0, w, h in placed:
        sheet.paste(Image.fromarray(arr), (c0 * 16, r0 * 16))
        js['icons'].append(dict(name=name, tier=1, cells=[w, h], col=c0, row=r0, firstCell=0, desc=desc))
    js['rows'] = nrows
    sheet.save(HERE / 'ext-v9-icons.png')
    (HERE / 'ext-v9-icons.json').write_text(json.dumps(js, ensure_ascii=False))
    return placed


def build(icon_for_site=None, icons=None):
    """build_v5(v8) 와 같은 흐름. icon_for_site: {장소 이름: 아이콘 이름}."""
    icon_for_site = icon_for_site or {}
    if icons:
        build_ext_v9(icons)
        wm.EXT = HERE / 'ext-v9-icons.png'
        wm.EXT_JSON = HERE / 'ext-v9-icons.json'
    else:
        wm.EXT = HERE / 'ext-v8.png'
        wm.EXT_JSON = HERE / 'ext-v8.json'
    M4.SITES[:] = [M5.NEW_SITES.get(s[0], s) for s in M4.SITES]
    M4.render_ground = B5.render_ground_v5
    M4.render_depth = B5.render_depth_v5
    import coast_v6
    coast_v6.install(M4)
    import cliff_v8
    cliff_v8.install(M4)
    for name, icon, x, y, g, why in M5.LANDMARK_SITES:
        M4.SITES.append((name, 'ext', icon, x, y, g, 'landmark', why))
    M4.ROUTES.extend(M5.LANDMARK_ROUTES)
    M4.render = M5.paste_sky(M4.render)
    # 장소 → 새 아이콘(발자국 크기가 같아야 길·땅 검사가 그대로다)
    meta = {m['name']: m for m in json.loads(wm.EXT_JSON.read_text())['icons']}
    new = []
    for s in M4.SITES:
        name, src, spec, x, y, g, kind, why = s
        if name in icon_for_site:
            ic = icon_for_site[name]
            w, h = meta[ic]['cells']
            ow, oh = (meta[spec]['cells'] if src == 'ext' else spec[2:])
            assert (w, h) == (ow, oh), (name, (w, h), (ow, oh))
            s = (name, 'ext', ic, x, y, g, kind, why)
        new.append(s)
    M4.SITES[:] = new
    M, icon_cells, meta_, info0 = M4.build()
    M.G[34, 40:45] = 0                # 항구 부두가 바다에 닿도록(build_v5 와 같다)
    return M, icon_cells, meta_


def render_base(M, icon_cells, meta):
    """M4.render 에서 장소 아이콘 붙이는 반복만 뺀 것(지형·길·다리·경사로까지)."""
    t = M4.old_grid(M)
    block = M4.road_block(M)
    for name, (x, y, w, h) in icon_cells.items():
        block[y:y + h, x:x + w] = False
    road, bridge, foot, paths = M4.TE.plan_roads(t, icon_cells, M4.ROUTES, block=block)
    protect = foot | road
    for (x, y) in bridge:
        protect[y, x] = True
    img = M4.render_ground(M)
    M4.render_faces(M, img)
    M4.render_objects(M, img)
    M4.render_water(M, img)
    M4.render_depth(M, img)
    M4.render_decor(M, img, protect)
    M4.render_roads(M, img, road, bridge, foot)
    M4.TE.render_bridges(M, img, bridge)
    M4.render_ramps(M, img)
    return img, dict(road=road, bridge=bridge, foot=foot, paths=paths)


CACHE = Path('/tmp/icv9/base')


def base_image(force=False):
    """지형 베이스(장소 아이콘 없음) + 장소 목록. 1분 반 걸리므로 /tmp 에 캐시한다."""
    npy, js = CACHE.with_suffix('.npy'), CACHE.with_suffix('.json')
    if npy.exists() and js.exists() and not force:
        return np.load(npy), json.loads(js.read_text())
    M, ic, meta = build()
    M4.render = M5.paste_sky(render_base)
    img, info = M4.render(M, ic, meta)
    sites = []
    for name, src, spec, x, y, g, kind, why in M4.SITES:
        w, h = ic[name][2:]
        sites.append(dict(name=name, src=src, spec=spec if src == 'ext' else list(spec), x=x, y=y, w=w, h=h, kind=kind, note=why))
    data = dict(sites=sites,
                routes=[dict(name=n_, cells=[list(c) for c in cells]) for n_, cells in info['paths']],
                bridges=[dict(x=x, y=y, dir=d) for (x, y), d in sorted(info['bridge'].items())],
                landmarks=info.get('landmarks', []))
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.save(npy, img)
    js.write_text(json.dumps(data, ensure_ascii=False, default=int))
    return img, data


def paste_icon(img, arr, x, y):
    """key 는 투명, SHADOW_KEY 는 밑 지형을 어둡게(바닥 그림자), 나머지는 그대로."""
    h, w = arr.shape[0], arr.shape[1]
    dst = img[y * 16:y * 16 + h, x * 16:x * 16 + w]
    key = np.all(arr == np.array(KEY, np.uint8), axis=2)
    shd = np.all(arr == np.array(SHADOW_KEY, np.uint8), axis=2)
    solid = ~key & ~shd
    dst[shd] = (dst[shd].astype(np.float32) * SHADOW_MUL).astype(np.uint8)
    dst[solid] = arr[solid]


def compose(icon_arrays, sites, base=None, only_old=False):
    """icon_arrays: {아이콘 이름: ndarray}. v8 ext 시트에 있는 이름은 시트에서 오린다."""
    img = (base if base is not None else base_image()[0]).copy()
    ext8, js8 = ext_v8_sheet()
    e8 = np.array(ext8, np.uint8)
    m8 = {m['name']: m for m in js8['icons']}
    for s in sites:
        if s['src'] == 'ext':
            ic = s['spec']
            if ic in icon_arrays and not only_old:
                arr = icon_arrays[ic]
            else:
                m = m8[ic]
                w, h = m['cells']
                arr = e8[m['row'] * 16:(m['row'] + h) * 16, m['col'] * 16:(m['col'] + w) * 16]
        else:
            c, r, w, h = s['spec']
            import terrain_render as TR
            arr = TR.S.a[r * 16:(r + h) * 16, c * 16:(c + w) * 16]
        paste_icon(img, arr, s['x'], s['y'])
    return img


def site_table(sites, icon_of):
    """장소 → (v8 아이콘, v9 아이콘)."""
    rows = []
    for s in sites:
        v8 = s['spec'] if s['src'] == 'ext' else 'orig_%d_%d_%dx%d' % tuple(s['spec'])
        rows.append(dict(name=s['name'], kind=s['kind'], x=s['x'], y=s['y'], w=s['w'], h=s['h'], v8=v8, v9=icon_of.get(s['name'], v8)))
    return rows


def main():
    import icons_v9 as I
    arrays = {ic['name']: ic['fn']() for ic in I.ICONS}
    img, data = base_image()
    sites = [dict(s) for s in data['sites']]
    icon_of = {ic['site']: ic['name'] for ic in I.ICONS}
    v8_rows = site_table(sites, {})
    for s in sites:
        if s['name'] in icon_of:
            s['src'], s['spec'] = 'ext', icon_of[s['name']]
    out = compose(arrays, sites, base=img)
    Image.fromarray(out).save(HERE / 'design-1x-v9-icons.png')
    Image.fromarray(out).resize((out.shape[1] * 2, out.shape[0] * 2), Image.NEAREST).save(HERE / 'design-2x-v9-icons.png')
    # 확장 시트(아이콘 도감용) + 장소→아이콘 매핑
    build_ext_v9([(ic['name'], arrays[ic['name']], '%s — %s' % (ic['kind'], ic['desc'])) for ic in I.ICONS])
    js = json.loads((HERE / 'ext-v9-icons.json').read_text())
    v8_of = {r['name']: r['v8'] for r in v8_rows}
    js['sites'] = [dict(r, v8=v8_of[r['name']]) for r in site_table(sites, icon_of)]
    js['v9'] = [dict(name=ic['name'], cells=list(ic['cells']), site=ic['site'], kind=ic['kind'], desc=ic['desc']) for ic in I.ICONS]
    js['note'] = '9단계: 장소 아이콘 고유화. 새 아이콘은 ext-v8 시트 아래에 이어 붙였다. SHADOW 키(254,103,139)는 밑 지형을 어둡게 하는 그림자 표시.'
    (HERE / 'ext-v9-icons.json').write_text(json.dumps(js, ensure_ascii=False))
    (HERE / 'map-v9-icons.json').write_text(json.dumps(dict(
        width=96, height=72, base='map-v4.json(v8 지형 그대로) + 장소 아이콘 교체', sites=js['sites'], routes=data['routes'], bridges=data['bridges']), ensure_ascii=False))
    print('ok', out.shape, 'icons', len(arrays))


if __name__ == '__main__':
    main()
