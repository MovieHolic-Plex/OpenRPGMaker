#!/usr/bin/env python3
"""jp-inaka 파일럿 검토 시트: 조각마다 [버들항 기준 | 조각] 을 1배·4배로, 그리고 시골 풀밭 위에 Actor1 사람과 함께 놓은 작은 지도 조각(2배).

  python3 scripts/content/jp-city/inaka/pilot_sheet.py --ids inaka-vinyl-greenhouse,inaka-kominka-thatched,inaka-red-tractor --out <png>

조각은 저장소에 굽지 않고 bake_inaka._finalize() 렌더를 바로 쓴다(render_kit 와 같은 경로).
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-inaka'))
KITS7 = os.path.join(ROOT, 'tiledata', 'beodeul-city', 'kits7')
ROW_OF = {'inaka-vinyl-greenhouse'}
REF = {'inaka-vinyl-greenhouse': 'bd-out-longhouse', 'inaka-kominka-thatched': 'bd-out-longhouse', 'inaka-red-tractor': 'bd-out-cabin-small'}
REF.update({k: 'bd-out-cabin-small' for k in ('inaka-kura-storehouse', 'inaka-bus-stop-shelter', 'inaka-agri-tin-shed', 'inaka-waterwheel-mill',
                                              'inaka-keitora-white', 'inaka-single-car-train', 'inaka-unmanned-veg-stand', 'inaka-jizo-shrine-row')})
REF.update({k: 'bd-out-cabin' for k in ('inaka-dagashiya', 'inaka-wooden-station')})
REF.update({k: 'bd-out-well-plaza' for k in ('inaka-well-handpump', 'inaka-retro-postbox-vending', 'inaka-sluice-gate', 'inaka-stepping-stones')})
REF.update({k: 'bd-out-woodpile' for k in ('inaka-rice-rack-hasagi', 'inaka-bicycle-parked', 'inaka-scarecrow-pair', 'inaka-sunflower-patch', 'inaka-hydrangea-hedge')})
REF.update({k: 'bd-out-fence-run' for k in ('inaka-bamboo-fence-gate', 'inaka-mossy-stone-wall', 'inaka-mossy-stone-wall-mid', 'inaka-red-iron-bridge')})
REF.update({k: 'bd-out-signpost' for k in ('inaka-wooden-pole-transformer', 'inaka-roadside-mirror', 'inaka-fire-watchtower')})


def beo(name):
    c = None
    for part in ('lo', 'up'):
        f = os.path.join(KITS7, f'{name}.{part}.png')
        if os.path.exists(f):
            im = Image.open(f).convert('RGBA')
            c = im if c is None else (c.alpha_composite(im) or c)
    return c


def grass_bg(w, h, key='grass'):
    from inaka_art_ground import autotile_cells
    cells = autotile_cells()[0]
    tiles = [cells[k][0] for k in cells if k.startswith('at/%s.' % key) and (k.endswith('m255') or '.b' in k)]
    a = np.zeros((h, w, 4), np.uint8)
    for ty in range(0, h, 16):
        for tx in range(0, w, 16):
            t = tiles[((tx // 16) * 7 + (ty // 16) * 3) % len(tiles)]
            a[ty:ty + 16, tx:tx + 16] = t[:min(16, h - ty), :min(16, w - tx)]
    return Image.fromarray(a)


def actor():
    s = Image.open(os.path.join(ROOT, 'public', 'assets', 'easyrpg', 'charset', 'Actor1.png')).convert('RGBA')
    f = s.crop((24, 0, 48, 32))
    a = np.array(f); key = a[0, 0, :3].copy()          # RM 칩 배경 색(왼쪽 위 화소)을 투명으로
    a[(a[..., :3] == key).all(-1), 3] = 0
    return Image.fromarray(a)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    import bake_inaka
    _, _, renders, _ = bake_inaka._finalize()
    rows = []
    for kid in a.ids.split(','):
        im = renders[kid]
        ref = beo(REF.get(kid, 'bd-out-longhouse'))
        pad = 8
        pair = Image.new('RGBA', (ref.width + im.width + pad * 3, max(ref.height, im.height) + pad * 2), (40, 44, 52, 255))
        pair.alpha_composite(ref, (pad, pair.height - pad - ref.height)); pair.alpha_composite(im, (ref.width + pad * 2, pair.height - pad - im.height))
        n = 3 if kid in ROW_OF else 1                      # 하우스류는 흙 고랑 사이로 나란히 놓아 「농장」으로 읽히는지 본다
        gap = 16
        snip_w, snip_h = n * im.width + (n - 1) * gap + 64, im.height + 48
        snip = grass_bg(snip_w, snip_h)
        if n > 1:
            dirt = grass_bg(snip_w, snip_h, 'dirt')
            for i in range(1, n):
                x0 = 16 + i * im.width + (i - 1) * gap
                snip.paste(dirt.crop((x0, 8, x0 + gap, 16 + im.height + 8)), (x0, 8))
        for i in range(n):
            snip.alpha_composite(im, (16 + i * (im.width + gap), 16))
        snip.alpha_composite(actor(), (16 + n * im.width + (n - 1) * gap + 12, 16 + im.height - 32))
        parts = [pair, pair.resize((pair.width * 4, pair.height * 4), Image.NEAREST), snip.resize((snip.width * 2, snip.height * 2), Image.NEAREST)]
        rows.append((kid, parts))
    W = max(sum(p.width for p in ps) + 16 * (len(ps) + 1) for _, ps in rows)
    H = sum(max(p.height for p in ps) + 40 for _, ps in rows) + 10
    sheet = Image.new('RGBA', (W, H), (24, 26, 30, 255)); d = ImageDraw.Draw(sheet); y = 6
    for kid, ps in rows:
        d.text((16, y), f'{kid}  |  1x [beodeul ref | piece]   4x [same]   2x map snippet with Actor1 for scale', fill=(230, 230, 230, 255)); y += 18
        x = 16
        for p in ps:
            sheet.alpha_composite(p, (x, y)); x += p.width + 16
        y += max(p.height for p in ps) + 22
    sheet.save(a.out); print(a.out, sheet.size)


if __name__ == '__main__':
    main()
