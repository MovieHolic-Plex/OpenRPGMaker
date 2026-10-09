# 동양풍 성·닌자 마을 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png.
import os, json
from PIL import Image, ImageDraw
from ek_base import Parts, ROOT
from ek_meta import PARTS

HERE = os.path.dirname(os.path.abspath(__file__))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (우리 라벨, 상자)
CMP = [
    ('beodeul city6_base: castle, towers, stone (ref)', 'tiledata/beodeul-city/render/city6_base.png', (60, 0, 420, 240),
     'eastern-castle: tenshu keep, yaguramon, ishigaki', (480, 20, 840, 260)),
    ('mountain-fortress: wall + gate + moat bridge (ref)', 'tiledata/beodeul-variants/mountain-fortress/render-1x.png', (380, 230, 740, 430),
     'eastern-castle: dobei wall, gate, moat, bridge', (420, 220, 780, 420)),
    ('beodeul city6_base: houses + street (ref)', 'tiledata/beodeul-city/render/city6_base.png', (900, 380, 1260, 560),
     'eastern-castle: thatch / plank minka, dojo', (0, 400, 360, 580)),
    ('deep-forest-path: trees, grass (ref)', 'tiledata/beodeul-variants/deep-forest-path/render-1x.png', (200, 200, 560, 400),
     'eastern-castle: bamboo grove, shrine path', (0, 120, 360, 320)),
    ('opera-stage: interior wall + floor (ref)', 'tiledata/beodeul-variants/opera-stage/render-1x.png', (800, 40, 1060, 280),
     'eastern-castle: tatami room + great hall', (66 * 16, 16, 66 * 16 + 416, 16 + 256)),
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


def export(s, im, reach, dens, seen, seen_in):
    Pq = Parts(HERE)
    for (n, fn, kind, ko, desc, rules, brows, layer, role) in PARTS:
        img = fn()
        pad = not (n.startswith('autotile-') or n.startswith('ground-'))
        Pq.add(n, img, kind, ko, desc, rules, brows, layer, role, pad=pad)
    cnt = Pq.finish('동양풍 성·닌자 마을 (eastern-castle)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, (wx, wy)), mean = dens
    out_seen = [c for c in seen if c[0] < 64]
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'},
               'areas': {'outdoor': {'x': 0, 'y': 0, 'w': 64, 'h': 48, 'entrance': list(s.marks['south_entrance'])},
                         'interior': {'x': 66, 'y': 1, 'w': 26, 'h': 16, 'entrance': list(s.marks['interior_entrance']),
                                      'link': 'keep_door (38,13) / 다른 실내 문 → 이 판 입구'}},
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'walkable_outdoor': int(g[:, :64].sum()), 'reached_outdoor': len(out_seen),
               'walkable_interior': int(g[:, 66:].sum()), 'reached_interior': len(seen_in),
               'empty_window_outdoor': [round(wr, 3), [wx, wy]], 'empty_mean_outdoor': round(mean, 3),
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    return cnt
