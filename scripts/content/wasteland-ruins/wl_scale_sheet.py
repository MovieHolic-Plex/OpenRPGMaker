#!/usr/bin/env python3
"""크기 비교판: 주인공(Actor1 0번, 아래 보기 가운데 칸 24×32, 16px 맵에서 1배)을 황무지 기물마다·버들항 기물마다 옆에 세운다.
    python3 wl_scale_sheet.py <out-dir>
산출: scale-wasteland-1x.png / -3x.png, scale-beodeul-1x.png / -3x.png, scale-table.json(그림 높이·주인공 대비 비율).
칸 격자(16px)를 옅게 깔아 키를 셀 수 있게 한다. 주인공 발은 기물 바닥 줄에 맞춘다."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wl_all  # noqa: F401
import wl_core as C
import numpy as np
from PIL import Image, ImageDraw

ROOT = C.ROOT
BEODEUL_KITS = [
    ('bd-out-log-door', 'door (log wall door cell)'), ('bd-house-h101_2', 'house 3x6'), ('bd-house-h102_1', 'house 5x8'), ('bd-out-cabin-small', 'log cabin'),
    ('bd-prop-crate_apple', 'crate'), ('bd-pick-aqueduct-sewer-crate-stack', 'crate stack'), ('bd-prop-fish_barrel', 'barrel'), ('bd-pick-mining-valley-barrel', 'barrel'),
    ('bd-out-hay-barrels', 'hay/barrels/crate'), ('bd-prop-goods_pile', 'goods pile'), ('bd-out-fence-run', 'fence'), ('bd-farm-fence-run-4', 'farm fence'),
    ('bd-prop-veg_cart', 'hand cart'), ('bd-pick-walled-market-wagon', 'covered wagon'), ('bd-tree-eef4bc', 'tree 1x3'), ('bd-tree-d43edd', 'tree 4x5'),
    ('bd-pick-mountain-pass-boulder-l', 'boulder'), ('bd-prop-well_roofed', 'roofed well'), ('bd-farm-fenced-plot', 'fenced field'),
]


def hero():
    im = Image.open(os.path.join(ROOT, 'public/assets/easyrpg/charset/Actor1.png'))
    bg = im.getpixel((0, 0))
    a = np.array(im.convert('RGBA')); idx = np.array(im)
    a[idx == bg, 3] = 0
    return a[64:96, 24:48]


def bbox_h(a):
    ys = np.nonzero(a[..., 3] > 0)[0]
    return (int(ys.max() - ys.min() + 1), int(ys.min())) if len(ys) else (0, 0)


def beodeul_kit(kid):
    ts = json.load(open(os.path.join(ROOT, 'src/assets/beodeulCityTileset.json')))
    sheet = np.array(Image.open(os.path.join(ROOT, 'public/assets/beodeul-city/beodeul-city-chipset.png')).convert('RGBA'))
    k = next(x for x in ts['structureKits'] if x['id'] == kid)
    out = np.zeros((k['height'] * 16, k['width'] * 16, 4), np.uint8)
    for j, row in enumerate(k['rows']):
        for layer in ('tiles', 'upperTiles'):
            for i, t in enumerate(row.get(layer) or []):
                if t is None or t < 0: continue
                src = sheet[(t // 128) * 16:(t // 128 + 1) * 16, (t % 128) * 16:(t % 128 + 1) * 16]
                blk = out[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16]
                m = src[..., 3] > 0; blk[m] = src[m]
    return out


def wasteland_objects():
    rep = json.load(open(os.path.join(C.OUT, 'bake-report.json')))
    rejected = {r['id'] for r in rep['rejected']}
    out = []
    for p in C.PIECES.values():
        if p['id'] in rejected: continue
        if p['group'] == 'ground' and not p['id'].startswith('crop-bed'): continue
        out.append((p['id'], p['name'], C.render(p)))
    return out


def board(items, hero_a, path_base, title):
    """items: (id, label, rgba). 한 줄에 여럿, 줄 높이는 가장 큰 것. 바탕은 옅은 회 + 16px 격자."""
    W = 1200; gap = 12; pad = 4
    hh, _ = bbox_h(hero_a)
    cells = []
    for (pid, label, a) in items:
        h, w = a.shape[:2]
        cw = max(24 + 4 + w, len(pid) * 6 + 4); ch = max(h, 32)
        cells.append((pid, label, a, cw, ch))
    x = y = 0; rowh = 0; pos = []
    for c in cells:
        if x + c[3] + 2 * pad > W: x = 0; y += rowh + gap + 12; rowh = 0
        pos.append((x, y)); x += c[3] + 2 * pad + gap; rowh = max(rowh, c[4] + 2 * pad)
    H = y + rowh + 12
    img = Image.new('RGBA', (W, H + 20), (92, 88, 82, 255))
    d = ImageDraw.Draw(img)
    for gx in range(0, W, 16): d.line([(gx, 0), (gx, H + 20)], fill=(100, 96, 90, 255))
    for gy in range(0, H + 20, 16): d.line([(0, gy), (W, gy)], fill=(100, 96, 90, 255))
    table = []
    for (pid, label, a, cw, ch), (px, py) in zip(cells, pos):
        base = py + pad + ch                                     # 바닥 줄
        img.alpha_composite(Image.fromarray(hero_a), (px + pad, base - 32))
        img.alpha_composite(Image.fromarray(a), (px + pad + 28, base - a.shape[0]))
        oh, _ = bbox_h(a)
        table.append(dict(id=pid, label=label, w_px=a.shape[1], h_px=a.shape[0], drawn_h_px=oh, hero_h_px=hh, ratio_to_hero=round(oh / hh, 2)))
        d.text((px + pad, base + 1), pid[:28], fill=(240, 236, 228, 255))
    img = img.convert('RGB')
    img.save(path_base + '-1x.png')
    img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(path_base + '-3x.png')
    return table


def main(out, only=None):
    os.makedirs(out, exist_ok=True)
    h = hero()
    if only:                                                     # 작업자 확인용: 고른 조각만 + 버들항 기준 몇 개
        ids = only.split(',')
        objs = [(p['id'], p['name'], C.render(p)) for p in C.PIECES.values() if p['id'] in ids]
        refs = [(k, lab, beodeul_kit(k)) for k, lab in BEODEUL_KITS[:5] + BEODEUL_KITS[13:14]]
        t = board(objs + refs, h, os.path.join(out, 'check'), 'check')
        for r in t: print(r['id'], '%dx%d' % (r['w_px'], r['h_px']), 'drawn', r['drawn_h_px'], 'ratio', r['ratio_to_hero'])
        return
    wl = board(wasteland_objects(), h, os.path.join(out, 'scale-wasteland'), 'wasteland')
    bd = board([(k, lab, beodeul_kit(k)) for k, lab in BEODEUL_KITS], h, os.path.join(out, 'scale-beodeul'), 'beodeul')
    json.dump(dict(hero=dict(frame='Actor1 char 0 down middle', w=24, h=32, drawn_h=bbox_h(h)[0]), wasteland=wl, beodeul=bd), open(os.path.join(out, 'scale-table.json'), 'w'), indent=1, ensure_ascii=False)
    print('wasteland', len(wl), 'beodeul', len(bd))


if __name__ == '__main__': main(sys.argv[1], sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--only' else None)
