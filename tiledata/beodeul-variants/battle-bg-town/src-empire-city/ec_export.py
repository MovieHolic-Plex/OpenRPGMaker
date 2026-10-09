# 제국 도시 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png.
import os, json
from PIL import Image, ImageDraw
from ec_base import Parts, ROOT
from ec_meta import PARTS

HERE = os.path.dirname(os.path.abspath(__file__))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (우리 라벨, 상자)
CMP = [
    ('beodeul city6_base: castle stone, slate roofs (ref)', 'tiledata/beodeul-city/render/city6_base.png', (60, 0, 420, 240),
     'empire-city: citadel (iron plate + grey stone, blue-grey roofs)', (468, 0, 828, 240)),
    ('mountain-fortress: fortress wall + gate passage (ref)', 'tiledata/beodeul-variants/mountain-fortress/render-1x.png', (380, 230, 740, 430),
     'empire-city: south wall, gatehouse, turrets', (440, 700, 800, 900)),
    ('sky-city: temple, towers, plaza (ref)', 'tiledata/beodeul-variants/sky-city/render-1x.png', (330, 60, 690, 260),
     'empire-city: plaza, statue, loudspeakers', (448, 220, 808, 420)),
    ('future-ruins: factory gate + steel plate yard (ref)', 'tiledata/beodeul-variants/future-ruins/render-1x.png', (848, 240, 1088, 420),
     'empire-city: hangar, apron, iron avenue', (580, 460, 820, 640)),
    ('future-ruins: tanks, pipes, machine (ref)', 'tiledata/beodeul-variants/future-ruins/render-1x.png', (900, 120, 1140, 300),
     'empire-city: factory district', (0, 40, 240, 220)),
    ('beodeul city6_base: houses + street (ref)', 'tiledata/beodeul-city/render/city6_base.png', (900, 380, 1260, 560),
     'empire-city: officer houses + boulevard', (840, 40, 1200, 220)),
]


def compare_ref(img, out='compare-ref.png'):
    S2 = 2
    rows = []
    for (la, path, ba, lb, bb) in CMP:
        ref = Image.open(os.path.join(ROOT, path)).convert('RGBA')
        rows.append((la, ref.crop(ba), lb, img.crop(bb)))
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


def export(s, im, reach, dens, seen):
    Pq = Parts(HERE)
    for (n, fn, kind, ko, desc, rules, brows, layer, role) in PARTS:
        img = fn()
        pad = not (n.startswith('autotile-') or n.startswith('ground-'))
        Pq.add(n, img, kind, ko, desc, rules, brows, layer, role, pad=pad)
    cnt = Pq.finish('제국 도시 (empire-city)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, (wx, wy)), mean = dens
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['south_entrance']),
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'walkable': int(g.sum()), 'reached': len(seen), 'isolated': int(g.sum()) - len(seen),
               'empty_window': [round(wr, 3), [wx, wy]], 'empty_mean': round(mean, 3),
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    return cnt
