# 대나무 숲 계곡 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, render-stages.png, grid.json, compare-ref.png, check-autotile.png.
import os, json
from PIL import Image, ImageDraw
from bv_base import Parts, ROOT
from bv_meta import PARTS

HERE = os.path.dirname(os.path.abspath(__file__))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (우리 라벨, 상자)
CMP = [
    ('beodeul city6_base: houses, trees, grass (ref)', 'tiledata/beodeul-city/render/city6_base.png', (200, 580, 520, 820),
     'bamboo-valley: hermit hut yard, shed, rail fence', (224, 112, 544, 352)),
    ('beodeul city6_base: canal, waterfall, stone bridge (ref)', 'tiledata/beodeul-city/render/city6_base.png', (470, 380, 750, 620),
     'bamboo-valley: stream autotile, stone arch bridge', (420, 380, 700, 620)),
    ('deep-forest-path: forest trees + grass (ref)', 'tiledata/beodeul-variants/deep-forest-path/render-1x.png', (200, 200, 520, 440),
     'bamboo-valley: dense bamboo grove, litter, moss', (0, 400, 320, 640)),
    ('eastern-castle (same palette family): bamboo grove, koi pond (ref)', 'tiledata/beodeul-variants/eastern-castle/render-1x.png', (0, 0, 320, 240),
     'bamboo-valley: waterfall pool, pavilion, cliff pine', (560, 20, 880, 260)),
]


def compare_ref(img, out='compare-ref.png'):
    S2 = 2
    rows = []
    for (la, ref, box, lb, mbox) in CMP:
        r = Image.open(os.path.join(ROOT, ref)).convert('RGBA')
        rows.append((la, r.crop(box), lb, img.crop(mbox)))
    pw = max(max(a.width, b.width) for _, a, _, b in rows) * S2
    out_h = sum(max(a.height, b.height) * S2 + 22 for _, a, _, b in rows) + 8
    o = Image.new('RGBA', (pw * 2 + 30, out_h), (28, 28, 34, 255)); d = ImageDraw.Draw(o)
    y = 8
    for (la, a, lb, b) in rows:
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        o.alpha_composite(a.resize((a.width * S2, a.height * S2), Image.NEAREST), (10, y + 14))
        o.alpha_composite(b.resize((b.width * S2, b.height * S2), Image.NEAREST), (pw + 20, y + 14))
        y += max(a.height, b.height) * S2 + 22
    o.convert('RGB').save(os.path.join(HERE, out))


def stages(s, out='render-stages.png', box=(176, 96, 656, 416)):
    """칠하는 순서 그림: ① 맨 바탕 표본 → ② + 땅 덩이 오토타일 → ③ + 건물·소품(같은 자리, 2배)."""
    ims = [s.render(1), s.render(2), s.render(9)]
    lbl = ['1  base ground samples (grass / dirt / flagstone / pebble)', '2  + ground-patch autotiles (stream / litter / moss / trail)', '3  + buildings, bamboo, props']
    w = (box[2] - box[0]) * 2; h = (box[3] - box[1]) * 2
    o = Image.new('RGB', (w, (h + 20) * 3), (28, 28, 34)); d = ImageDraw.Draw(o)
    for i, im in enumerate(ims):
        d.text((6, i * (h + 20) + 4), lbl[i], fill=(230, 230, 230))
        o.paste(im.crop(box).resize((w, h), Image.NEAREST).convert('RGB'), (0, i * (h + 20) + 18))
    o.save(os.path.join(HERE, out))
    return ims[2]


def export(s, im, reach, dens, seen):
    Pq = Parts(HERE)
    passable = {}
    for (n, fn, kind, ko, desc, rules, brows, layer, role, walk) in PARTS:
        img = fn()
        pad = not (n.startswith('autotile-') or n.startswith('ground-'))
        Pq.add(n, img, kind, ko, desc, rules, brows, layer, role, pad=pad)
        passable[n] = walk
    cnt = Pq.finish('대나무 숲 계곡 (bamboo-valley, wuxia)')
    pm = json.load(open(os.path.join(HERE, 'partmeta.json')))
    for n, v in passable.items(): pm[n]['passable'] = v
    json.dump(pm, open(os.path.join(HERE, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, (wx, wy)), mean = dens
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['south_entrance']),
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'walkable': int(g.sum()), 'reached': len(seen),
               'empty_window_worst': [round(wr, 3), [wx, wy]], 'empty_mean': round(mean, 3),
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    import bv_check
    bv_check.build(bv_check.SHEETS(), os.path.join(HERE, 'check-autotile.png'))
    return cnt
