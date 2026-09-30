#!/usr/bin/env python3
"""월드맵 4판 데모 장면 조립기 (40×30 칸).

  python3 scripts/content/atlas-pick/worldmap_v4_demo.py          # 장면 PNG 를 굽는다
  python3 scripts/content/atlas-pick/worldmap_v4_demo.py --html   # 비교 페이지(~/claude-viz/worldmap-v4-demo.html)까지

  3판 = worldmap_v3_demo 그대로(v3-A.pxg)
  4판 = 각 슬러그의 v4-A.pxg, 없으면 v3-A.pxg (색은 같은 worldmap3.pal)
4판 장면 = 3판과 같은 땅·강·길 위에 ① 큰 덩이 지형(산맥·숲) 위에 2×2 겹판(mountain_peaks·forest_crowns·conifer_crowns)을
흔들린 격자에 절반쯤 얹고 ② 아이콘 크기 등급(1×1·2×2·3×3·5×5)을 깐다.
추가 산출: 지형만 3판/4판(아이콘 없이) — 같은 조각 반복이 눈에 띄는지 보는 용도.
"""
import os, sys, io, base64, argparse
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import worldmap_context as WC
from worldmap_context import compose_bundle, over, h01, T
import worldmap_v3_demo as V3
from worldmap_v3_gen import ROOT, CAND

W, H = V3.W, V3.H
OUT = os.path.join(ROOT, 'tiledata/atlas-pick/style-demo-worldmap4')
V4_SLUGS = ['coast_grass', 'sea_deep', 'mountain', 'forest', 'conifer', 'mountain_peaks', 'forest_crowns', 'conifer_crowns',
            'hamlet', 'village_2x2', 'town_3x3', 'castle_3x3', 'castle_5x5', 'cave', 'tower']
V3_SLUGS = ['shoal', 'plains_base', 'hills', 'river', 'road', 'bridge_h', 'bridge_v', 'desert', 'trees_scatter', 'plains_scatter']

# (이름, 왼쪽 위 칸 x, y) — 크기는 ISIZE. 발(성문)이 아래 가운데.
ICONS4 = [('castle_5x5', 26, 8), ('town_3x3', 16, 12), ('castle_3x3', 30, 19), ('village_2x2', 12, 19),
          ('hamlet', 20, 20), ('cave', 11, 16), ('tower', 35, 13)]
ISIZE = {'castle_5x5': (5, 5), 'town_3x3': (3, 3), 'castle_3x3': (3, 3), 'village_2x2': (2, 2), 'hamlet': (1, 1),
         'cave': (1, 1), 'tower': (1, 2)}
OVERLAY = {'mountain': 'mountain_peaks', 'forest': 'forest_crowns', 'conifer': 'conifer_crowns'}
COVER = {'mountain': 0.9, 'forest': 0.62, 'conifer': 0.6}   # 몸통 위 겹판 비율(산은 능선이 이어져야 해서 높게)


def piece(slug):
    d = CAND / slug
    for name in (('v4-A',) if slug in V4_SLUGS else ()) + ('v3-A',):
        pxg, png = d / f'{name}.pxg', d / f'{name}.png'
        if not pxg.exists(): continue
        if not png.exists() or png.stat().st_mtime < pxg.stat().st_mtime:
            sys.path.insert(0, WC.PXGRID); import pxgrid; pxgrid.render(str(pxg), str(png))
        return np.array(Image.open(png).convert('RGBA'))
    raise FileNotFoundError(slug)


def build_map4():
    """3판 땅·강·길을 그대로 두고 덩이만 키우고 아이콘 자리를 새로 잡는다."""
    M = V3.build_map()
    land = M['land']
    for n, ix, iy in ICONS4:                       # 아이콘 발자국이 땅 안인지
        for dx in range(ISIZE[n][0]):
            for dy in range(ISIZE[n][1]):
                assert (ix + dx, iy + dy) in land, (n, ix + dx, iy + dy)
    road = set(M['road'])
    road |= V3.poly([(28, 13), (28, 16)]) | V3.poly([(17, 15), (17, 16)]) | V3.poly([(31, 22), (31, 24)])  # 성문 앞 꼬리
    road |= V3.poly([(12, 21), (12, 24)]) | V3.poly([(20, 21), (23, 21)])
    road = {c for c in road if c in land}
    M['road'] = road
    keep = set(M['river']) | road
    for n, ix, iy in ICONS4:
        for dx in range(-1, ISIZE[n][0] + 1):
            for dy in range(-1, ISIZE[n][1] + 1): keep.add((ix + dx, iy + dy))
    # 큰 덩이: 산맥은 능선으로 길게, 숲은 크게
    feat = {k: set() for k in M['feat']}
    order = [('desert', [(24, 24, 6, 3)]), ('conifer', [(22, 4, 5, 2.4), (5, 13, 3, 3), (32, 8, 3.5, 2.4)]),
             ('forest', [(24, 7, 4.2, 3), (7, 20, 4.5, 3.4), (30, 22, 4, 2.6)]),
             ('hills', [(17, 8, 3, 2), (15, 12, 2.5, 1.8), (33, 14, 2, 2)]),
             ('mountain', [(8, 6, 6.5, 3.6), (14, 3.4, 5.5, 2.2), (4, 10, 2.2, 3)])]
    for k, (name, bl) in enumerate(order):
        cells = set()
        for j, b in enumerate(bl): cells |= V3.blob(*b, 300 + 10 * k + j, 0.35)
        feat[name] = V3.cleanup(cells & land)
    for name in feat: feat[name] -= keep
    for a, b in [('desert', 'conifer'), ('desert', 'forest'), ('conifer', 'forest'), ('forest', 'hills'), ('hills', 'mountain'),
                 ('conifer', 'hills'), ('forest', 'mountain'), ('conifer', 'mountain'), ('desert', 'hills'), ('desert', 'mountain')]:
        feat[a] -= feat[b]
    M['feat'] = feat
    return M


def overlay_anchors(cells, seed, cover=0.5):
    """덩이 cells 위 2×2 겹판 앵커(왼쪽 위): 격자 2칸에서 ±1 흔들고 cover 확률로 뽑는다.
    아랫줄 두 칸은 덩이 안이어야 하고(발이 몸통 위), 윗줄은 밖으로 나와도 된다. 같은 아랫줄을 두 번 쓰지 않는다."""
    out, used = [], set()
    for gy in range(-1, H, 2):
        for gx in range(-1, W, 2):
            if h01(gx, gy, seed) > cover: continue
            x = gx + int(h01(gx, gy, seed + 1) * 3) - 1 + 1
            y = gy + int(h01(gx, gy, seed + 2) * 3) - 1 + 1
            base = {(x, y + 1), (x + 1, y + 1)}
            if not base <= cells or base & used: continue
            if (x, y) not in cells and (x + 1, y) not in cells and h01(x, y, seed + 3) < 0.5: continue
            used |= base
            out.append((x, y, int(h01(x, y, seed + 4) * 3) % 3))
    return sorted(out, key=lambda a: a[1])


def stamp(im, src, x, y):
    """맵 밖으로 나가는 부분을 잘라 알파 합성."""
    h, w = src.shape[:2]
    x0, y0 = max(0, -x), max(0, -y); x1, y1 = min(w, im.shape[1] - x), min(h, im.shape[0] - y)
    if x1 > x0 and y1 > y0: over(im, src[y0:y1, x0:x1], x + x0, y + y0)


def render(gen, M, icons, overlays=True):
    WC.use_palette('worldmap3.pal')
    if gen == 3:
        L = {s: V3.load(3, s) for s in V3.SRC}
    else:
        L = {s: piece(s) for s in V4_SLUGS + V3_SLUGS}
    im = np.zeros((H * T, W * T, 4), np.uint8)
    bases = [L['plains_base'][:, k * T:(k + 1) * T] for k in range(3)]
    for y in range(H):
        for x in range(W):
            im[y * T:(y + 1) * T, x * T:(x + 1) * T] = bases[int(h01(x, y, 5) * 3) % 3]
    for name in ('desert', 'hills', 'forest', 'conifer', 'mountain'):
        over(im, compose_bundle(L[name], V3.mask_of(M['feat'][name])), 0, 0)
    if gen == 4 and overlays:
        for i, (name, ov) in enumerate(OVERLAY.items()):
            for (x, y, k) in overlay_anchors(M['feat'][name], 700 + 17 * i, COVER[name]):
                stamp(im, L[ov][:, k * 32:(k + 1) * 32], x * T, y * T)
    used = set().union(*M['feat'].values()) | M['river'] | M['road'] | M['deep']
    forest_adj = lambda x, y: any((x + dx, y + dy) in M['feat']['forest'] | M['feat']['conifer'] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    icon_cells = set()
    for n, ix, iy in icons:
        sz = ISIZE.get(n) or V3.ISIZE[n]
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
        stamp(im, L[n], ix * T, iy * T)
    return Image.fromarray(im)


def b64(img):
    b = io.BytesIO(); img.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--html', action='store_true'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    M3 = V3.build_map(); M4 = build_map4()
    imgs = {
        '3': render(3, M3, V3.ICONS),
        '4': render(4, M4, ICONS4),
        '3t': render(3, M3, []),                    # 지형만(같은 땅·덩이)
        '4t': render(4, M3, []),
        '4t0': render(4, M3, [], overlays=False),   # 겹판 끈 것(덩이만)
    }
    for k, im in imgs.items():
        im.save(os.path.join(OUT, f'scene-{k}.png')); print('wrote', f'scene-{k}.png', im.size)
    if a.html:
        import worldmap_v4_page
        worldmap_v4_page.build(imgs, b64, ICONS4, ISIZE)


if __name__ == '__main__':
    main()
