#!/usr/bin/env python3
"""월드맵 5판 데모 장면 조립기 (40x30 칸). 4판과 같은 땅·덩이·아이콘 배치.

  python3 scripts/content/atlas-pick/worldmap_v5_demo.py          # 장면 PNG
  python3 scripts/content/atlas-pick/worldmap_v5_demo.py --html   # 비교 페이지(~/claude-viz/worldmap-v5-demo.html)

5판 = 각 슬러그의 v5-A.pxg(worldmap5.pal: FF6 실측 톤). 4판 장면은 worldmap_v4_demo 를 그대로 불러 온다.
"""
import os, sys, io, base64, argparse
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import worldmap_context as WC
from worldmap_context import compose_bundle, over, h01, T
import worldmap_v3_demo as V3
import worldmap_v4_demo as D4
from worldmap_v3_gen import ROOT, CAND

W, H = D4.W, D4.H
OUT = os.path.join(ROOT, 'tiledata/atlas-pick/style-demo-worldmap5')
SLUGS = ['coast_grass', 'sea_deep', 'mountain', 'forest', 'conifer', 'mountain_peaks', 'forest_crowns', 'conifer_crowns',
         'hamlet', 'village_2x2', 'town_3x3', 'castle_3x3', 'castle_5x5', 'cave', 'tower',
         'shoal', 'plains_base', 'hills', 'river', 'road', 'bridge_h', 'bridge_v', 'desert', 'trees_scatter', 'plains_scatter']
COVER = {'mountain': 0.9, 'forest': 0.5, 'conifer': 0.42}   # FF6 는 숲이 어두운 덩이, 나무 사이 땅이 보인다 → 겹판 성기게


def piece(slug):
    d = CAND / slug
    pxg, png = d / 'v5-A.pxg', d / 'v5-A.png'
    if not png.exists() or png.stat().st_mtime < pxg.stat().st_mtime:
        sys.path.insert(0, WC.PXGRID); import pxgrid; pxgrid.render(str(pxg), str(png))
    return np.array(Image.open(png).convert('RGBA'))


def render5(M, icons, overlays=True):
    WC.use_palette('worldmap5.pal')
    L = {s: piece(s) for s in SLUGS}
    im = np.zeros((H * T, W * T, 4), np.uint8)
    bases = [L['plains_base'][:, k * T:(k + 1) * T] for k in range(3)]
    for y in range(H):
        for x in range(W):
            im[y * T:(y + 1) * T, x * T:(x + 1) * T] = bases[int(h01(x, y, 5) * 3) % 3]
    for name in ('desert', 'hills', 'forest', 'conifer', 'mountain'):
        over(im, compose_bundle(L[name], V3.mask_of(M['feat'][name])), 0, 0)
    if overlays:
        for i, (name, ov) in enumerate(D4.OVERLAY.items()):
            for (x, y, k) in D4.overlay_anchors(M['feat'][name], 700 + 17 * i, COVER[name]):
                D4.stamp(im, L[ov][:, k * 32:(k + 1) * 32], x * T, y * T)
    used = set().union(*M['feat'].values()) | M['river'] | M['road'] | M['deep']
    forest_adj = lambda x, y: any((x + dx, y + dy) in M['feat']['forest'] | M['feat']['conifer'] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    icon_cells = set()
    for n, ix, iy in icons:
        sz = D4.ISIZE[n]
        icon_cells |= {(ix + dx, iy + dy) for dx in range(sz[0]) for dy in range(sz[1])}
    for (x, y) in sorted(M['land']):
        if (x, y) in used or (x, y) in icon_cells: continue
        r = h01(x, y, 31); k = int(h01(x, y, 32) * 3) % 3
        if forest_adj(x, y) and r < 0.14:
            over(im, L['trees_scatter'][:, k * T:(k + 1) * T], x * T, y * T)
        elif r < 0.06 + (0.14 if forest_adj(x, y) else 0):
            over(im, L['plains_scatter'][:, k * T:(k + 1) * T], x * T, y * T)
    over(im, compose_bundle(L['road'], V3.mask_of(M['road'])), 0, 0)
    over(im, compose_bundle(L['river'], V3.mask_of(M['river'])), 0, 0)
    water = {(x, y) for y in range(H) for x in range(W) if (x, y) not in M['land']}
    over(im, compose_bundle(L['coast_grass'], V3.mask_of(water), True), 0, 0)
    over(im, compose_bundle(L['sea_deep'], V3.mask_of(M['deep']), True), 0, 0)
    over(im, compose_bundle(L['shoal'], V3.mask_of(M['shoal']), False), 0, 0)
    for (x, y) in sorted(M['river'] & M['road']):
        road_h = ((x - 1, y) in M['road'] or (x + 1, y) in M['road']) and not ((x, y - 1) in M['road'] and (x, y + 1) in M['road'])
        over(im, L['bridge_h' if road_h else 'bridge_v'], x * T, y * T)
    for n, ix, iy in icons:
        D4.stamp(im, L[n], ix * T, iy * T)
    return Image.fromarray(im)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--html', action='store_true'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    M3 = V3.build_map(); M4 = D4.build_map4()
    imgs = {'4': D4.render(4, M4, D4.ICONS4), '5': render5(M4, D4.ICONS4), '5t': render5(M3, [])}
    for k, im in imgs.items():
        im.save(os.path.join(OUT, f'scene-{k}.png')); print('wrote', f'scene-{k}.png', im.size)
    if a.html:
        import worldmap_v5_page
        worldmap_v5_page.build(imgs, D4.b64, D4.ICONS4, D4.ISIZE)


if __name__ == '__main__':
    main()
