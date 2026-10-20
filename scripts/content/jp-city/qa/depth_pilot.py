#!/usr/bin/env python3
"""3/4 깊이 다시 그리기 시범판: 옛 그림(origin/main 렌더 사본) | 새 그림 | 버들항 집 | Actor1(24x32) — 1배·4배.
  python3 scripts/content/jp-city/qa/depth_pilot.py OLD_DIR OUT_DIR
OLD_DIR 에는 옛 그림 PNG(post_office.png, house_hip2.png, bus-right.png, bus-left_open.png)가 있어야 한다."""
import copy, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
JP = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(JP, '..', '..', '..'))
sys.path.insert(0, os.path.join(JP, 'houses')); sys.path.insert(0, os.path.join(JP, 'vehicles'))
import catalog as CA, house_kit as hk  # noqa: E402
import depth34  # noqa: E402,F401
import heavy  # noqa: E402

BG = (112, 120, 104, 255)


def new_pieces():
    out = {}
    for id_ in ('post_office', 'house_hip2'):
        cv, _ = hk.build(CA.CATALOG[id_][2]); out[id_] = cv.img()
    out['bus-right'] = Image.fromarray(heavy.bus_side(True))
    out['bus-left_open'] = Image.fromarray(heavy.bus_side(False, True))
    return out


def actor():
    im = Image.open(os.path.join(ROOT, 'public/assets/easyrpg/charset/Actor1.png')).convert('RGBA')
    fr = im.crop((24, 0, 48, 32)); a = np.array(fr)
    key = a[0, 0, :3].copy()
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
    new = new_pieces(); act = actor()
    beo = Image.open(os.path.join(ROOT, 'public/assets/beodeul-architecture/cream-native.png')).convert('RGBA')
    for k, im in new.items():
        old = Image.open(os.path.join(old_dir, k + '.png')).convert('RGBA')
        im.save(os.path.join(out, f'{k}-new.png'))
        r = row([old, im, beo, act])
        r.save(os.path.join(out, f'{k}-1x.png'))
        r.resize((r.width * 4, r.height * 4), Image.NEAREST).save(os.path.join(out, f'{k}-4x.png'))
        print(k, 'old', old.size, 'new', im.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
