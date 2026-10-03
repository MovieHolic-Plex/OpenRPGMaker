"""월드맵 아이콘 하네스 — 아이콘 한 장을 사람·검수자가 볼 그림으로 만든다.

- icon-x8.png : 아이콘 단품 8배(키색 투명, 그림자 키색은 반투명 검정), 어두운 바탕
- ctx-x3.png  : 그 아이콘을 실제 월드맵(같은 지형·같은 여정, original 팔레트)의 맞는 역할 자리에 붙여 둘레까지 잘라 낸 3배
- ctx-x1.png  : 같은 자리 1배(게임에서 보이는 크기)
지도 자리는 그 아이콘이 원래 배정된 장소를 먼저 쓰고, 지도에 안 쓰이는 변형이면 같은 역할·같은 칸 수의 첫 장소를 빌린다.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
KIT = ROOT / 'tiledata' / 'worldmap-kit' / 'kit'
JOURNEY = 'fantasy-5act'
PALETTE = 'original'
MARGIN = 5   # 둘레 칸 수
BG = (38, 36, 44, 255)


def _kit():
    os.environ.setdefault('CITY_TAG', 'v8')
    for p in (KIT, KIT / 'lib'):
        if str(p) not in sys.path:
            sys.path.insert(0, str(p))
    import build_world as B
    import kit_common as K
    import kit_palette as KP
    import kit_world as W
    return B, K, KP, W


def themed_terrain(set_id, t):
    """세트의 테마(themes/<세트>.json)대로 지형을 칠한다: 팔레트 + 덧칠(포장도로·철길·시가지·그을음), 우주면 우주 지도.
    테마 파일이 없으면 original 팔레트 그대로. 반환 (그림, 팔레트, 아이콘 틴트)."""
    B, K, KP, W = _kit()
    import kit_theme as KT
    tp = K.WM / 'themes' / (set_id + '.json')
    theme = KT.load_theme(tp) if tp.exists() else None
    pal = KP.load_palette(K.WM / 'palettes' / ((theme['palette'] if theme else PALETTE) + '.json'), K.WM / 'palettes')
    road_px = t['role'][np.searchsorted(t['ukeys'], KP.key_of(t['C']))] == KP.GID['road']
    if theme and theme['kind'] == 'space':
        return KT.render_space(KT.Ctx(t['world']), road_px=road_px), pal, 0.0
    img, _extra = KP.recolor_terrain(t['C'], t['ukeys'], t['role'], pal, t['G'])
    if theme:
        img = KT.force_road_band(img, t['world'], t['C'], t['ukeys'], t['role'], pal, road_px)
    if theme and theme['overlays']:
        img, _rep = KT.apply_land(img, t['world'], theme, road_px)
    return img, pal, pal.get('icon_tint', 0.25)


def icon_rgba(arr, key, shadow_key):
    a = np.zeros((arr.shape[0], arr.shape[1], 4), np.uint8)
    a[..., :3] = arr
    a[..., 3] = 255
    a[np.all(arr == np.array(key, np.uint8), axis=2)] = (0, 0, 0, 0)
    a[np.all(arr == np.array(shadow_key, np.uint8), axis=2)] = (0, 0, 0, 90)
    return Image.fromarray(a, 'RGBA')


def on_bg(im, s, bg=BG):
    b = Image.new('RGBA', im.size, bg)
    b.alpha_composite(im)
    return b.resize((im.width * s, im.height * s), Image.NEAREST)


def reference(out):
    """EasyRPG 월드 시트의 마을·성·탑 칸(정면 3/4 의 기준) 4배."""
    sheet = Image.open(ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png').convert('RGB')
    arr = np.array(sheet.crop((288, 128, 384, 256)))
    im = icon_rgba(arr, (255, 103, 139), (254, 103, 139))
    on_bg(im, 4, (120, 150, 90, 255)).save(out)


def render_set(set_id, dest, cache):
    """세트의 아이콘마다 dest/<이름>/ 에 그림 세 장. 반환: [{name, role, cells, desc, place}]"""
    B, K, KP, W = _kit()
    roles, roles_data = K.load_roles()
    journey = K.load_journey(JOURNEY)
    iconset = K.IconSet(set_id)
    assign = K.assign_icons(roles, journey, iconset)
    t = B.build_terrain(journey, roles, roles_data, iconset, assign, str(cache))
    world = t['world']
    img, pal, tint = themed_terrain(set_id, t)
    ic = {k: tuple(v) for k, v in world['ic'].items()}
    sky = tuple(world['sky_site'])
    places = {p['id']: p for p in journey['places']}
    tint_fn = lambda arr: KP.tint_icon(arr, pal, tint, iconset.key, iconset.shadow_key)  # noqa: E731
    rows = []
    for name, meta in iconset.icons.items():
        if not meta.get('_own', True):      # 부분 세트(extends)의 바탕 아이콘은 이 세트 항목이 아니다
            continue
        cells = tuple(meta['cells'])
        own = [p for p, n in assign.items() if n == name]
        same = [p for p, pl in places.items() if pl.get('role') == meta['role'] and p in ic and tuple(ic[p][2:]) == cells]
        if not own and sky[0] in places and places[sky[0]].get('role') == meta['role'] and tuple(sky[3:]) == cells:
            same.insert(0, sky[0])
        place = (own or same or [None])[0]
        d = Path(dest) / name
        d.mkdir(parents=True, exist_ok=True)
        icon = icon_rgba(iconset.array(name), iconset.key, iconset.shadow_key)
        on_bg(icon, 8).save(d / 'icon-x8.png')
        icon.save(d / 'icon.png')
        if place:
            a2 = dict(assign)
            a2[place] = name
            final = W.paste_icons(img, ic, sky, iconset, a2, tint_fn)
            x, y, w, h = (sky[1:] if place == sky[0] else ic[place])
            H, Wd = final.shape[0] // 16, final.shape[1] // 16
            x0, y0 = max(0, x - MARGIN), max(0, y - MARGIN)
            x1, y1 = min(Wd, x + w + MARGIN), min(H, y + h + MARGIN)
            crop = Image.fromarray(final[y0 * 16:y1 * 16, x0 * 16:x1 * 16])
            crop.save(d / 'ctx-x1.png')
            crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST).save(d / 'ctx-x3.png')
        rows.append(dict(name=name, role=meta['role'], cells=list(cells), desc=meta.get('desc', ''),
                         place=place, used=bool(own)))
    return rows


_CTX = {}


def _set_context(set_id, cache):
    """세트마다 한 번: 지형(아이콘 없음)·배정·틴트 함수. 후보를 여러 장 붙일 때 다시 그리지 않는다."""
    if set_id in _CTX:
        return _CTX[set_id]
    B, K, KP, W = _kit()
    roles, roles_data = K.load_roles()
    journey = K.load_journey(JOURNEY)
    iconset = K.IconSet(set_id)
    assign = K.assign_icons(roles, journey, iconset)
    t = B.build_terrain(journey, roles, roles_data, iconset, assign, str(cache))
    img, pal, tint = themed_terrain(set_id, t)
    ctx = dict(W=W, iconset=iconset, assign=assign, world=t['world'], img=img,
               tint_fn=lambda arr: KP.tint_icon(arr, pal, tint, iconset.key, iconset.shadow_key))
    _CTX[set_id] = ctx
    return ctx


def render_candidate(set_id, name, place, png, out_dir, cache):
    """후보 PNG(키색 바탕, 원래 아이콘과 같은 칸 수)를 그 아이콘의 지도 자리에 붙여 icon-x8 · ctx-x3 · ctx-x1 을 만든다."""
    c = _set_context(set_id, cache)
    iconset = c['iconset']
    arr = np.array(Image.open(png).convert('RGB'))
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    icon = icon_rgba(arr, iconset.key, iconset.shadow_key)
    on_bg(icon, 8).save(out / 'icon-x8.png')
    icon.save(out / 'icon.png')
    if not place:
        return
    world = c['world']
    ic = {k: tuple(v) for k, v in world['ic'].items()}
    sky = tuple(world['sky_site'])
    a2 = dict(c['assign'])
    a2[place] = name
    orig = iconset.array

    def patched(n):
        return arr if n == name else orig(n)
    iconset.array = patched
    try:
        final = c['W'].paste_icons(c['img'], ic, sky, iconset, a2, c['tint_fn'])
    finally:
        iconset.array = orig
    x, y, w, h = (sky[1:] if place == sky[0] else ic[place])
    H, Wd = final.shape[0] // 16, final.shape[1] // 16
    x0, y0 = max(0, x - MARGIN), max(0, y - MARGIN)
    x1, y1 = min(Wd, x + w + MARGIN), min(H, y + h + MARGIN)
    crop = Image.fromarray(final[y0 * 16:y1 * 16, x0 * 16:x1 * 16])
    crop.save(out / 'ctx-x1.png')
    crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST).save(out / 'ctx-x3.png')


def palette_of(set_id):
    """허용 색: 세트 시트 색 ∪ EasyRPG 월드 시트 색(키색 제외)."""
    _B, K, _KP, _W = _kit()
    iconset = K.IconSet(set_id)
    cols = {tuple(c) for c in iconset.sheet.reshape(-1, 3).tolist()}
    world = np.array(Image.open(ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png').convert('RGB'))
    cols |= {tuple(c) for c in world.reshape(-1, 3).tolist()}
    cols.discard(tuple(iconset.key))
    cols.discard(tuple(iconset.shadow_key))
    return cols


if __name__ == '__main__':
    print(json.dumps(render_set(sys.argv[1], sys.argv[2], sys.argv[3]), ensure_ascii=False, indent=1))
