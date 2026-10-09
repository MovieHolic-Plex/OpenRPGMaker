# 증기 도시 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png, check-autotile.png.
import os, json
from PIL import Image, ImageDraw
from fr_base import Parts, ROOT
from sc_meta import PARTS
import sc_auto as AU

HERE = os.path.dirname(os.path.abspath(__file__))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (우리 라벨, 상자)
CMP = [
    ('beodeul city6_base: houses + street (ref)', 'tiledata/beodeul-city/render/city6_base.png', (900, 380, 1260, 560),
     'steam-city: north brick row + gas lamps + wet cobble', (0, 0, 360, 180)),
    ('beodeul city6_base: stone + roofs (ref)', 'tiledata/beodeul-city/render/city6_base.png', (60, 0, 420, 240),
     'steam-city: clock tower plaza', (380, 170, 740, 410)),
    ('empire-city: factory district (ref)', 'tiledata/beodeul-variants/empire-city/render-1x.png', (0, 40, 360, 260),
     'steam-city: boiler house, chimney, tank, pipe arch', (0, 200, 360, 420)),
    ('machine-factory: machines (ref)', 'tiledata/beodeul-variants/machine-factory/render-1x.png', (0, 0, 360, 220),
     'steam-city: coal yard (hopper, shed, water tower)', (700, 200, 1024, 420)),
    ('empire-city: south houses + street (ref)', 'tiledata/beodeul-variants/empire-city/render-1x.png', (0, 640, 360, 820),
     'steam-city: south row + lane (oil, steam puddle)', (300, 540, 660, 720)),
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


def export(s, im, reach, dens, seen, extra=None):
    Pq = Parts(HERE)
    for (n, fn, kind, ko, desc, rules, brows, layer, role) in PARTS:
        pad = not (n.startswith('autotile-') or n.startswith('ground-'))
        Pq.add(n, fn(), kind, ko, desc, rules, brows, layer, role, pad=pad)
    for n, ok in AU.PASSABLE.items(): Pq.meta[n]['passable'] = ok
    for n in Pq.meta:
        if n.startswith('ground-'): Pq.meta[n]['passable'] = True
    cnt = Pq.finish('증기 도시 거리 (steam-city)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, wx, wy), mean = dens
    d = {'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
         'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['south_entrance']),
         'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
         'walkable': int(g.sum()), 'reached': len(seen), 'isolated': int(g.sum()) - len(seen),
         'isolated_note': '고립 칸은 북쪽 줄집 지붕 뒤(지도 위 끝 0~4줄, 걷기+가림 지붕 칸)뿐이다.',
         'empty_window_strict': [round(wr, 3), [wx, wy]], 'empty_mean_strict': round(mean, 3),
         'empty_note': '엄격 척도: 맨 차도 자갈도 빈 바닥으로 센다(보도·광장·철판·재·덩이는 채움).',
         'count': dict(s.count)}
    if extra: d.update(extra)
    json.dump(d, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    AU.check_sheet(os.path.join(HERE, 'check-autotile.png'))
    return cnt
