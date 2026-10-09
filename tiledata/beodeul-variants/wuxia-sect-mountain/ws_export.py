# 산중 무림 문파 내보내기: parts/*.png + partmeta.json(role·passable·설명) + parts.md, render-1x/2x, grid.json, compare-ref.png, check-autotile.png.
import os, json
from PIL import Image, ImageDraw
from fr_base import Parts
from ws_base import HERE
from ws_meta import PARTS

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (이 장소 라벨, 상자)
CMP = [
    ('beodeul city6_base: tiled roofs, stone, plaster (ref)', 'tiledata/beodeul-city/render/city6_base.png', (600, 300, 920, 520),
     'wuxia-sect-mountain: main hall + scripture tower + terrace', (400, 0, 720, 220)),
    ('mountain-fortress: cliff band + stairs (ref)', 'tiledata/beodeul-variants/mountain-fortress/render-1x.png', (380, 480, 700, 700),
     'wuxia-sect-mountain: cliff band + steep stair + court', (380, 400, 700, 620)),
    ('eastern-castle: koi pond, pines (same genre, ref)', 'tiledata/beodeul-variants/eastern-castle/render-1x.png', (256, 0, 576, 220),
     'wuxia-sect-mountain: waterfall + gorge pool + pavilion', (0, 120, 320, 340)),
    ('deep-forest-path: trees, grass (ref)', 'tiledata/beodeul-variants/deep-forest-path/render-1x.png', (200, 200, 520, 420),
     'wuxia-sect-mountain: sanmen, maples + leaf piles, misty grass', (160, 540, 480, 760)),
]
# 고친 판(이전 → 지금): _qa/map_v1.png 가 있으면 같은 상자로 나란히.
CMPV = [('BEFORE (v1): one huge flagstone field, straight cliff bands, box-like mist', 'AFTER: smaller court + stage, wavy cliff bands, cloud bands, curb', (320, 160, 720, 480))]


def compare_ref(img, out='compare-ref.png'):
    S2 = 2; rows = []
    for (la, path, box, lb, mybox) in CMP:
        ref = Image.open(os.path.join(ROOT, path)).convert('RGBA')
        rows.append((la, ref.crop(box), lb, img.crop(mybox)))
    v1 = os.path.join(HERE, '_qa', 'map_v1.png')
    if os.path.exists(v1):
        prev = Image.open(v1).convert('RGBA')
        for (la, lb, box) in CMPV: rows.append((la, prev.crop(box), lb, img.crop(box)))
    bgp = os.path.join(HERE, 'battle-bg.png')
    if os.path.exists(bgp):
        bg = Image.open(bgp).convert('RGBA')
        rows.append(('battle-bg.png (left half): peaks, hall roof, court', bg.crop((0, 40, 320, 360)), 'map render-1x: same court / cliff / pines', img.crop((300, 160, 620, 480))))
    pw = max(max(a.width, b.width) for _, a, _, b in rows) * S2
    oh = sum(max(a.height, b.height) * S2 + 22 for _, a, _, b in rows) + 8
    o = Image.new('RGBA', (pw * 2 + 30, oh), (28, 28, 34, 255)); d = ImageDraw.Draw(o); y = 8
    for (la, a, lb, b) in rows:
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        o.alpha_composite(a.resize((a.width * S2, a.height * S2), Image.NEAREST), (10, y + 14))
        o.alpha_composite(b.resize((b.width * S2, b.height * S2), Image.NEAREST), (pw + 20, y + 14))
        y += max(a.height, b.height) * S2 + 22
    o.convert('RGB').save(os.path.join(HERE, out))


def export(s, im, reach, dens, seen):
    Pq = Parts(HERE)
    for (n, fn, kind, ko, desc, rules, brows, layer, role, passable) in PARTS:
        pad = not (n.startswith('autotile-') or n.startswith('ground-') or n.endswith('-strip'))
        Pq.add(n, fn(), kind, ko, desc, rules, brows, layer, role, pad=pad)
    cnt = Pq.finish('산중 무림 문파 (wuxia-sect-mountain)')
    pm = json.load(open(os.path.join(HERE, 'partmeta.json')))
    for (n, *_r) in PARTS: pm[n]['passable'] = _r[-1]
    json.dump(pm, open(os.path.join(HERE, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid(); (wr, (wx, wy)), mean = dens
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'},
               'levels': {'top': 'y0~10 대전 마당', 'cliff_a': 'y11~14 절벽 띠(잔도 y11)', 'middle': 'y15~30 연무장', 'cliff_b': 'y31~33 절벽 띠', 'bottom': 'y34~47 산문 마당·산길'},
               'entrance': list(s.marks['south_entrance']), 'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'walkable': int(g.sum()), 'reached': len(seen),
               'empty_window': [round(wr, 3), [wx, wy]], 'empty_mean': round(mean, 3), 'count': dict(s.count)},
              open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    import ws_check
    ws_check.build(os.path.join(HERE, 'check-autotile.png'))
    return cnt
