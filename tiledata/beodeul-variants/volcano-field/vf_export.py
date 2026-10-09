# 화산 지대 필드 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png.
import os, json
import numpy as np
from PIL import Image, ImageDraw
from vf_base import Parts, ROOT
from vf_meta import META
import vf_pieces as V, vf_struct as S, vf_mountain as M, vf_auto as A

HERE = os.path.dirname(os.path.abspath(__file__))


def piece_image(name, sheets, flag):
    if name == 'crater_mountain': return M.crater_mountain()
    if name == 'smoke_column': return M.smoke_column()
    if name in ('temple_gate', 'temple_brazier', 'fire_guardian', 'cave_mouth'): return getattr(S, name)()
    if name == 'ground-ash': return A.ground_sample('ash')
    if name == 'ground-fineash': return A.ground_fineash()
    if name == 'ground-lavafield': return A.ground_lavafield()
    if name == 'ground-basaltflag': return flag
    if name == 'face_basalt':
        base = Image.new('RGBA', (48, 64))
        g = A.ground_sample('ash')
        base.alpha_composite(g, (0, 0)); base.alpha_composite(g, (0, 48))
        base.alpha_composite(A.face_basalt())
        return base
    if name.startswith('autotile-'): return sheets[name.split('-', 1)[1]]
    return getattr(V, name)()


def compare_ref(img):
    """같은 2배: [버들항 절벽·계단·돌 | 신전·계단·절벽] / [마왕성 용암 해자 | 용암 강·다리] / [초원 하이로드 고사목·풀 | 그을린 숲·뼈]."""
    city = Image.open(os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_base.png')).convert('RGBA')
    df = Image.open(os.path.join(ROOT, 'tiledata/beodeul-variants/dark-fortress/render-1x.png')).convert('RGBA')
    ph = Image.open(os.path.join(ROOT, 'tiledata/beodeul-variants/plains-highroad/render-1x.png')).convert('RGBA')
    pairs = [('beodeul city6_base: cliff + stairs + stone', city.crop((180, 380, 420, 560)), 'volcano-field: temple gate + stairs + basalt cliff', img.crop((440, 210, 680, 390))),
             ('dark-fortress: lava moat (wave 1 ref)', df.crop((140, 500, 380, 680)), 'volcano-field: lava river + basalt bridge', img.crop((440, 330, 680, 510))),
             ('plains-highroad: dead tree, rocks', ph.crop((380, 180, 620, 360)), 'volcano-field: charred grove + beast bones', img.crop((150, 520, 390, 700)))]
    S2 = 2; pw, phh = 240 * S2, 180 * S2
    out = Image.new('RGBA', (pw * 2 + 30, (phh + 22) * len(pairs) + 8), (28, 28, 34, 255)); d = ImageDraw.Draw(out)
    for i, (la, a, lb, b) in enumerate(pairs):
        y = 8 + i * (phh + 22)
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        out.alpha_composite(a.resize((pw, phh), Image.NEAREST), (10, y + 14))
        out.alpha_composite(b.resize((pw, phh), Image.NEAREST), (pw + 20, y + 14))
    out.convert('RGB').save(os.path.join(HERE, 'compare-ref.png'))


def export(s, im, reach, dens, seen, sheets, flag):
    Pq = Parts(HERE)
    for n, md in META.items():
        img = piece_image(n, sheets, flag)
        pad = not (n.startswith('autotile-') or n.startswith('ground-') or n == 'face_basalt')
        Pq.add(n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
    cnt = Pq.finish('화산 지대 필드 (volcano-field)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['south_entrance']),
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'stairs': [list(t) for t in s.stairs], 'levels': [''.join(str(s.lev[y][x]) for x in range(s.W)) for y in range(s.H)],
               'walkable': int(g.sum()), 'reached': len(seen), 'empty_window': [dens[0], list(dens[1])], 'empty_mean': dens[2],
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    return cnt
