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
    pal = KP.load_palette(K.WM / 'palettes' / (PALETTE + '.json'), K.WM / 'palettes')
    tint = pal.get('icon_tint', 0.25)
    img, _extra = KP.recolor_terrain(t['C'], t['ukeys'], t['role'], pal, t['G'])
    ic = {k: tuple(v) for k, v in world['ic'].items()}
    sky = tuple(world['sky_site'])
    places = {p['id']: p for p in journey['places']}
    tint_fn = lambda arr: KP.tint_icon(arr, pal, tint, iconset.key, iconset.shadow_key)  # noqa: E731
    rows = []
    for name, meta in iconset.icons.items():
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


if __name__ == '__main__':
    print(json.dumps(render_set(sys.argv[1], sys.argv[2], sys.argv[3]), ensure_ascii=False, indent=1))
