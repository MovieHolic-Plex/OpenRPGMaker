# 등불 수향 마을 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png, check-autotile.png.
import os, json
from PIL import Image, ImageDraw
from lr_base import Parts, ROOT
import lr_meta as M

HERE = os.path.dirname(os.path.abspath(__file__))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (우리 라벨, 상자)  — 상자는 1x 좌표, 같은 크기
CMP = [
    ('beodeul city6_base: canal + arch bridge + stone rim (ref)', 'tiledata/beodeul-city/render/city6_base.png', (640, 920, 960, 1160),
     'lantern-river-town: branch canal, arch bridge, rubble bank', (600, 120, 920, 360)),
    ('eastern-castle: village houses, tile roofs (ref)', 'tiledata/beodeul-variants/eastern-castle/render-1x.png', (0, 400, 320, 640),
     'lantern-river-town: white-wall houses, horse-head gables', (128, 64, 448, 304)),
    ('beodeul city6_base: market square + stalls (ref)', 'tiledata/beodeul-city/render/city6_base.png', (880, 540, 1200, 780),
     'lantern-river-town: market square, stalls, lantern strings', (220, 420, 540, 660)),
    ('deep-forest-path: trees + grass (ref)', 'tiledata/beodeul-variants/deep-forest-path/render-1x.png', (200, 200, 520, 440),
     'lantern-river-town: willow tea garden by the lotus pond', (0, 360, 320, 600)),
    ('fishing-port: pier, boats, water (ref)', 'tiledata/beodeul-variants/fishing-port/render-1x.png', (300, 260, 620, 500),
     'lantern-river-town: docks, sampans, canal steps', (200, 300, 520, 540)),
]


def compare_ref(img, out='compare-ref.png'):
    S2 = 2
    rows = []
    for (la, ref, rb, lb, mb) in CMP:
        r = Image.open(os.path.join(ROOT, ref)).convert('RGBA').crop(rb)
        rows.append((la, r, lb, img.crop(mb)))
    pw = max(max(a.width, b.width) for _, a, _, b in rows) * S2
    bgp = os.path.join(HERE, 'battle-bg.png')
    out_h = sum(max(a.height, b.height) * S2 + 22 for _, a, _, b in rows) + 8 + (360 + 22 if os.path.exists(bgp) else 0)
    o = Image.new('RGBA', (pw * 2 + 30, out_h), (28, 28, 34, 255)); d = ImageDraw.Draw(o)
    y = 8
    for (la, a, lb, b) in rows:
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        o.alpha_composite(a.resize((a.width * S2, a.height * S2), Image.NEAREST), (10, y + 14))
        o.alpha_composite(b.resize((b.width * S2, b.height * S2), Image.NEAREST), (pw + 20, y + 14))
        y += max(a.height, b.height) * S2 + 22
    if os.path.exists(bgp):                                                       # 전투 배경(1x) | 같은 장소 맵 1x 크롭
        bg = Image.open(bgp).convert('RGBA')
        d.text((10, y), 'battle-bg.png (1x)', fill=(230, 230, 230, 255)); d.text((660, y), 'map render 1x: canal houses + arch bridge', fill=(230, 230, 230, 255))
        o.alpha_composite(bg, (10, y + 14)); o.alpha_composite(img.crop((440, 80, 1024, 440)), (660, y + 14))
    o.convert('RGB').save(os.path.join(HERE, out))


def export_parts():
    Pq = Parts(HERE)
    import lr_ground as G
    for (n, ko, desc, rules) in M.GROUND:
        Pq.add(n, G.SAMPLES[n](), 'floor', ko, desc, rules, 0, 'lower', 'terrain', pad=False)
    for (n, fn, ko, desc, rules, brows, layer, role, passable) in M.AUTOS:
        Pq.add(n, fn(), 'autotile', ko, desc, rules, brows, layer, role, pad=False)
    for (n, fn, kind, ko, desc, rules, brows, layer, role) in M.PARTS:
        Pq.add(n, fn(), kind, ko, desc, rules, brows, layer, role, pad=True)
    cnt = Pq.finish('등불 수향 마을 (lantern-river-town, 무협)')
    pm = json.load(open(os.path.join(HERE, 'partmeta.json')))
    for (n, fn, ko, desc, rules, brows, layer, role, passable) in M.AUTOS: pm[n]['passable'] = passable
    for (n, ko, desc, rules) in M.GROUND: pm[n]['passable'] = True
    json.dump(pm, open(os.path.join(HERE, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
    md = open(os.path.join(HERE, 'parts.md')).read().replace('기계 재질 규약은 plan.md.', '재질 규격은 tiledata/beodeul-kits/genres/wuxia.md, 칠하는 순서는 plan.md.')
    open(os.path.join(HERE, 'parts.md'), 'w').write(md)
    return cnt


def export_map(s, im, reach, dens):
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, wx, wy), mean = dens
    marks = {k: (list(v) if not isinstance(v, list) else [list(c) for c in v]) for k, v in s.marks.items()}
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['south_gate']),
               'marks': marks, 'reach': reach, 'walkable': int(g.sum()), 'reached': reach.get('_reached'),
               'empty_window': [round(wr, 3), [wx, wy]], 'empty_mean': round(mean, 3),
               'paint_order': ['ground-* 표본(바탕)', 'autotile-flagstone-curb·autotile-wet-flagstone·autotile-canal(아래층)', 'autotile-lotus(위층)', '건물·다리·소품', 'lantern_string(맨 위)'],
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    import lr_check
    lr_check.build(os.path.join(HERE, 'check-autotile.png'))
