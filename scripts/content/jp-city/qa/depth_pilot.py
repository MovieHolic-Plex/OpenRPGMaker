#!/usr/bin/env python3
"""3/4 깊이 다시 그리기 비교판: 옛 그림 | 새 그림 | 기준(건물 = 버들항 집, 탈것 = modern-city 경찰차) | Actor1(24x32) — 1배·4배, 조각마다 PNG 한 쌍 + 목록 JSON.
  python3 scripts/content/jp-city/qa/depth_pilot.py OLD_DIR OUT_DIR
OLD_DIR 에는 origin/main 으로 렌더한 옛 그림 <id>.png 가 있어야 한다(건물 id · 탈것 <id>-right.png · bus-*.png · static-*.png)."""
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
JP = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(JP, '..', '..', '..'))
for p in (os.path.join(JP, 'houses'), os.path.join(JP, 'vehicles'), os.path.join(JP, 'lib'), os.path.join(JP, '..', 'atlas-pick')):
    sys.path.insert(0, p)
import catalog as CA, house_kit as hk  # noqa: E402
import depth34  # noqa: E402,F401
import heavy, cars  # noqa: E402
import parts_vehicles as PV  # noqa: E402

BG = (112, 120, 104, 255)
BUILDINGS = ['post_office', 'house_hip2', 'koban', 'warehouse', 'station_small'] + [i for i in CA.DEEP_IDS if i not in ('koban', 'warehouse', 'station_small')]


def pieces():
    """(그룹, 키, 이름, 새 그림 Image, 옛 그림 파일명)."""
    out = []
    for id_ in BUILDINGS:
        cv, _ = hk.build(CA.CATALOG[id_][2])
        out.append(('건물', id_, CA.CATALOG[id_][0], cv.img(), id_ + '.png'))
    for id_ in CA.TOWN_IDS:                                                    # 상점가 화풍(妻入り · 난간 옥상)
        cv, _ = hk.build(CA.CATALOG[id_][2])
        out.append(('상점', id_, CA.CATALOG[id_][0], cv.img(), id_ + '.png'))
    for k, fr, opn in (('bus-right', True, False), ('bus-left_open', False, True)):
        out.append(('움직이는 탈것', k, '노선버스 ' + k[4:], Image.fromarray(heavy.bus_side(fr, opn)), k + '.png'))
    for v in cars.VEHICLES:
        out.append(('움직이는 탈것', v['id'], v['name'], Image.fromarray(np.asarray(v['frames']['right']())), v['id'] + '-right.png'))
    out.append(('정지 소품 차', 'static-car-white', '세단 소품(car.white)', PV.car('white').img(), 'static-car-white.png'))
    out.append(('정지 소품 차', 'static-van-white', '밴 소품(van.white)', PV.car('white', 'van').img(), 'static-van-white.png'))
    out.append(('정지 소품 차', 'static-bus', '버스 소품(bus)', PV.bus().img(), 'static-bus.png'))
    out.append(('정지 소품 차', 'static-bus_r', '버스 소품(bus_r)', PV.bus(True, 'sora').img(), 'static-bus_r.png'))
    return out


def actor():
    im = Image.open(os.path.join(ROOT, 'public/assets/easyrpg/charset/Actor1.png')).convert('RGBA')
    a = np.array(im.crop((24, 0, 48, 32))); key = a[0, 0, :3].copy()
    a[(a[:, :, :3] == key).all(-1)] = 0
    return Image.fromarray(a)


def trim(i):
    bb = i.getbbox()
    return i.crop(bb) if bb else i


def row(imgs, pad=8):
    imgs = [trim(i) for i in imgs]
    H = max(i.height for i in imgs) + 2 * pad; W = sum(i.width for i in imgs) + pad * (len(imgs) + 1)
    o = Image.new('RGBA', (W, H), BG); x = pad
    for i in imgs:
        o.alpha_composite(i, (x, H - pad - i.height)); x += i.width + pad
    o.paste((84, 90, 78, 255), (0, H - pad, W, H))
    return o


def main(old_dir, out):
    os.makedirs(out, exist_ok=True)
    act = actor()
    beo = Image.open(os.path.join(ROOT, 'public/assets/beodeul-architecture/cream-native.png')).convert('RGBA')
    police = Image.open(os.path.join(ROOT, 'public/assets/modern-city/vehicles/mc-veh-police-a.png')).convert('RGBA').crop((0, 0, 48, 32))   # 탈것 기준(같은 배율)
    idx = []
    for grp, k, name, im, oldf in pieces():
        old = Image.open(os.path.join(old_dir, oldf)).convert('RGBA')
        im.save(os.path.join(out, f'{k}-new.png'))
        r = row([old, im, beo if grp in ('건물', '상점') else police, act])
        r.save(os.path.join(out, f'{k}-1x.png'))
        r.resize((r.width * 4, r.height * 4), Image.NEAREST).save(os.path.join(out, f'{k}-4x.png'))
        idx.append(dict(group=grp, key=k, name=name))
    json.dump(idx, open(os.path.join(out, 'index.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(idx), out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
