# 미래 폐허 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png.
import os, json
import numpy as np
from PIL import Image, ImageDraw
from fr_base import Parts, ROOT
from fr_meta import PARTS

HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.join(ROOT, 'tiledata', 'beodeul-variants')

# 비교 시트 크롭 좌표(1x): (라벨, 기준 이미지 경로, 상자) | (라벨, 우리 상자)
CMP = [
    ('beodeul city6_base: stone, roofs, paving', 'tiledata/beodeul-city/render/city6_base.png', (300, 200, 540, 380),
     'future-ruins: factory gate + steel plate yard', (848, 240, 1088, 420)),
    ('tower-interior: machine room (wave 2 ref)', 'tiledata/beodeul-variants/tower-interior/render-1x.png', (874, 40, 1082, 196),
     'future-ruins: tanks, pipes, machine', (900, 140, 1108, 296)),
    ('ruined-village: ruined houses on grass (ref)', 'tiledata/beodeul-variants/ruined-village/render-1x.png', (40, 40, 280, 220),
     'future-ruins: west street block, overpass', (0, 160, 240, 340)),
    ('volcano-field: cliff stairs + temple gate (ref)', 'tiledata/beodeul-variants/volcano-field/render-1x.png', (440, 210, 680, 390),
     'future-ruins: glass dome + plaza', (470, 120, 710, 300)),
    ('deep-forest-path: grass, trees (ref)', 'tiledata/beodeul-variants/deep-forest-path/render-1x.png', (200, 300, 440, 480),
     'future-ruins: polluted wasteland, toxic pool', (520, 600, 760, 780)),
]


def compare_ref(img):
    S2 = 2
    rows = []
    for (la, path, ba, lb, bb) in CMP:
        ref = Image.open(os.path.join(ROOT, path)).convert('RGBA')
        rows.append((la, ref.crop(ba), lb, img.crop(bb)))
    pw = max(max(a.width, b.width) for _, a, _, b in rows) * S2
    out_h = sum(max(a.height, b.height) * S2 + 22 for _, a, _, b in rows) + 8
    out = Image.new('RGBA', (pw * 2 + 30, out_h), (28, 28, 34, 255)); d = ImageDraw.Draw(out)
    y = 8
    for (la, a, lb, b) in rows:
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        out.alpha_composite(a.resize((a.width * S2, a.height * S2), Image.NEAREST), (10, y + 14))
        out.alpha_composite(b.resize((b.width * S2, b.height * S2), Image.NEAREST), (pw + 20, y + 14))
        y += max(a.height, b.height) * S2 + 22
    out.convert('RGB').save(os.path.join(HERE, 'compare-ref.png'))


def export(s, im, reach, dens, seen):
    Pq = Parts(HERE)
    for (n, fn, kind, ko, desc, rules, brows, layer, role) in PARTS:
        img = fn()
        pad = not (n.startswith('autotile-') or n.startswith('ground-') or n.startswith('mat_'))
        Pq.add(n, img, kind, ko, desc, rules, brows, layer, role, pad=pad)
    cnt = Pq.finish('미래 폐허 (future-ruins)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, (wx, wy)), mean = dens
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['west_entrance']),
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'walkable': int(g.sum()), 'reached': len(seen), 'empty_window': [round(wr, 3), [wx, wy]], 'empty_mean': round(mean, 3),
               'toxic_cells': len(s.tox), 'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    return cnt
