# 고원 절벽과 하늘 다리 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, render-stages.png, grid.json, compare-ref.png, check-autotile.png.
import os, json
from PIL import Image, ImageDraw
from hc_base import Parts, ROOT
from hc_meta import PARTS

HERE = os.path.dirname(os.path.abspath(__file__))

# 비교 시트(2배): (기준 라벨, 기준 그림, 상자) | (우리 라벨, 상자)
CMP = [
    ('beodeul city6_base: earth cliff terrace, grass, trees (ref)', 'tiledata/beodeul-city/render/city6_base.png', (470, 380, 790, 620),
     'highland-cliff-bridge: plateau cliff face 3 rows, terrace ramp, lip', (64, 256, 384, 496)),
    ('deep-forest-path: forest trees + grass (ref)', 'tiledata/beodeul-variants/deep-forest-path/render-1x.png', (200, 200, 520, 440),
     'highland-cliff-bridge: lower meadow grove, field', (0, 560, 320, 800)),
    ('wuxia-sect-mountain (same wave): cliff band, plank walk (ref)', 'tiledata/beodeul-variants/wuxia-sect-mountain/render-1x.png', (560, 120, 880, 360),
     'highland-cliff-bridge: plank bridge over the sky canyon', (336, 96, 656, 336)),
    ('bamboo-valley (same wave): stream bank autotile edge (ref)', 'tiledata/beodeul-variants/bamboo-valley/render-1x.png', (420, 380, 740, 620),
     'highland-cliff-bridge: sky rim + E-W chasm + vertical bridge', (640, 160, 960, 400)),
]

HIST = [('canyon edge + bridge east end', (336, 96, 656, 336)),
        ('terrace ramp, cliff face, ramp foot', (64, 256, 384, 496))]


def compare_ref(img, out='compare-ref.png'):
    S2 = 2
    rows = []
    for (la, ref, box, lb, mbox) in CMP:
        r = Image.open(os.path.join(ROOT, ref)).convert('RGBA')
        rows.append((la, r.crop(box), lb, img.crop(mbox)))
    for i, prev in enumerate(('history-v1.png', 'history-v2.png')):
        p = os.path.join(HERE, prev)
        if os.path.exists(p):                                            # 고친 기록: 이전 판 | 지금 판(같은 자리)
            pv = Image.open(p).convert('RGBA')
            for (lb, box) in HIST:
                rows.append(('BEFORE (v%d): %s' % (i + 1, lb), pv.crop(box), 'AFTER: ' + lb, img.crop(box)))
    bg = os.path.join(HERE, 'battle-bg.png')
    if os.path.exists(bg):                                               # 전투 배경 | 같은 장소 지도(같은 게임 그림인가)
        rows.append(('battle-bg.png (640x360, crop)', Image.open(bg).convert('RGBA').crop((160, 60, 480, 300)),
                     'highland-cliff-bridge map: bridge + canyon', img.crop((336, 96, 656, 336))))
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


def stages(s, out='render-stages.png', box=(64, 96, 544, 456)):
    """칠하는 순서 그림: ① 맨 바탕 표본 → ② + 땅 덩이 오토타일·절벽 앞면 → ③ + 다리·비탈·나무·소품(같은 자리, 2배)."""
    ims = [s.render(1), s.render(2), s.render(9)]
    lbl = ['1  base ground samples (grass mix / sky samples / dirt)', '2  + ground-patch autotiles (dry grass / crops / path / cliff lip / sky rim) + cliff faces',
           '3  + bridge, terrace ramp, stairs, trees, props, clouds']
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
    cnt = Pq.finish('고원 절벽과 하늘 다리 (highland-cliff-bridge, natural-forest-cliff)')
    pm = json.load(open(os.path.join(HERE, 'partmeta.json')))
    for n, v in passable.items(): pm[n]['passable'] = v
    json.dump(pm, open(os.path.join(HERE, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
    md = open(os.path.join(HERE, 'parts.md')).read().replace('기계 재질 램프', '이 장소 새 재질 램프(dan·sora·kumo·nuren·nuri·michi·sage)').replace(' 기계 재질 규약은 plan.md.', ' 재질·놓는 법은 plan.md.')
    open(os.path.join(HERE, 'parts.md'), 'w').write(md)
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    (wr, (wx, wy)), mean = dens
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['west_entrance']),
               'levels': [''.join(str(int(v)) for v in row) for row in s.L], 'levels_legend': {'0': 'sky', '1': 'lower meadow', '2': 'yard', '3': 'plateau'},
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'walkable': int(g.sum()), 'reached': len(seen),
               'empty_window_worst': [round(wr, 3), [wx, wy]], 'empty_mean': round(mean, 3),
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    import hc_check
    hc_check.build(hc_check.SHEETS(), os.path.join(HERE, 'check-autotile.png'))
    return cnt
