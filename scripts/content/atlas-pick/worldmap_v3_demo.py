#!/usr/bin/env python3
"""월드맵 3판 「바람들 결」 데모 장면 조립기 (40×30 칸).

  python3 scripts/content/atlas-pick/worldmap_v3_demo.py            # 2판·3판 장면 PNG 를 굽는다
  python3 scripts/content/atlas-pick/worldmap_v3_demo.py --html     # 비교 페이지(~/claude-viz/worldmap-v3-demo.html)까지

같은 배치(지도)를 두 판으로 깐다.
  2판 = 사용자가 고른 것(있으면) 아니면 마지막 wvN-A  — worldmap_v3_gen.SRC
  3판 = 각 슬러그의 v3-A.pxg (worldmap3.pal)
깔기 규칙은 엔진 quarterTile 그대로 — worldmap_context.compose_bundle 을 쓴다(물은 뒤집고, 맵 밖은 물).
층 순서: 바닥 → 사막·언덕·숲·침엽수·산 → 흩뿌림 → 길 → 강 → 해안 물 → 깊은 바다 → 여울 → 다리 → 아이콘.
"""
import os, sys, base64, io, argparse
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import worldmap_context as WC
from worldmap_context import compose_bundle, over, h01, T
from worldmap_v3_gen import SRC, CAND, ROOT

W, H = 40, 30
OUT = os.path.join(ROOT, 'tiledata/atlas-pick/style-demo-worldmap3')


# ─────────────────────────── 지도 ───────────────────────────
def blob(cx, cy, rx, ry, seed, noise=0.30):
    s = set()
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + (h01(x, y, seed) - .5) * noise
            if d < 1: s.add((x, y))
    return s


def cleanup(s, passes=2):
    """이웃 없는 외딴 칸·1칸 구멍을 정리(덩이 가장자리를 묶음이 다루기 쉽게)."""
    for _ in range(passes):
        n = lambda x, y: sum((x + dx, y + dy) in s for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        s = {c for c in s if n(*c) >= 2}
        holes = {(x, y) for y in range(H) for x in range(W) if (x, y) not in s and n(x, y) >= 3}
        s |= holes
    return s


def poly(points, width=1):
    """직교 꺾은선 → 칸 집합(width 칸 폭. 2 = 오른쪽·아래로 한 칸 더)."""
    cells = set()
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for dx in range(width):
                    for dy in range(width):
                        cells.add((x + dx, y + dy))
    return cells


ICONS = [('town', 17, 15), ('castle', 28, 11), ('cave', 11, 16), ('port', 33, 15)]
ISIZE = {'town': (2, 2), 'castle': (2, 2), 'cave': (1, 1), 'port': (2, 2)}


def build_map():
    land = set()
    for i, (cx, cy, rx, ry) in enumerate([(20, 15, 15, 10.5), (10, 8, 8, 6), (27, 6, 7, 4), (35, 16, 4, 5.5),
                                          (9, 22, 7, 4), (22, 23, 9, 5), (34, 4, 3, 2), (4, 26, 3, 2.2)]):
        land |= blob(cx, cy, rx, ry, 100 + i)
    land = cleanup(land)
    river = poly([(18, 9), (21, 9), (21, 18), (25, 18), (25, 28)], 2)
    road = poly([(13, 16), (32, 16)]) | poly([(28, 14), (28, 16)]) | poly([(23, 16), (23, 24)])
    land |= river | road
    feat = {}
    order = [('desert', [(24, 24, 6, 3)]), ('conifer', [(22, 5, 4, 2), (6, 14, 2.5, 2.5), (31, 9, 3, 2)]),
             ('forest', [(26, 8, 4, 3), (8, 19, 4, 3), (31, 22, 3, 2)]),
             ('hills', [(17, 8, 3, 2), (15, 12, 2.5, 1.8), (30, 13, 2, 2)]),
             ('mountain', [(9, 7, 5, 3.4), (14, 4, 4, 2)])]
    for k, (name, bl) in enumerate(order):
        cells = set()
        for j, b in enumerate(bl):
            cells |= blob(*b, 200 + 10 * k + j, 0.35)
        feat[name] = cleanup(cells & land)
    keep = set(river) | set(road)
    for x, y, in [(ix + dx, iy + dy) for n, ix, iy in ICONS for dx in range(-1, ISIZE[n][0] + 1) for dy in range(-1, ISIZE[n][1] + 1)]:
        keep.add((x, y))
    # 겹침 정리: 뒤에 오는 것이 위. 강·길·아이콘 칸에서는 지형 무늬를 뺀다.
    for name in feat:
        feat[name] -= keep
    for a, b in [('desert', 'conifer'), ('desert', 'forest'), ('conifer', 'forest'), ('forest', 'hills'), ('hills', 'mountain'),
                 ('conifer', 'hills'), ('forest', 'mountain'), ('conifer', 'mountain'), ('desert', 'hills'), ('desert', 'mountain')]:
        feat[a] -= feat[b]
    # 깊은 바다: 땅에서 체비쇼프 거리 3 이상인 물
    deep = set()
    for y in range(H):
        for x in range(W):
            if (x, y) in land: continue
            near = any((x + dx, y + dy) in land for dx in range(-2, 3) for dy in range(-2, 3))
            if not near: deep.add((x, y))
    shoal = {c for c in [(2, 19), (3, 19), (2, 20), (3, 20), (4, 20), (36, 3), (37, 3), (37, 4), (36, 4),
                         (37, 26), (38, 26), (37, 27), (38, 27), (36, 27), (2, 6), (3, 6), (2, 7)] if c in deep}
    return dict(land=land, river=river, road=road, feat=feat, deep=deep, shoal=shoal)


def mask_of(cells):
    return [''.join('1' if (x, y) in cells else '0' for x in range(W)) for y in range(H)]


# ─────────────────────────── 그림 ───────────────────────────
def load(gen, slug):
    """gen 2 → SRC 의 2판 소스 png, gen 3 → v3-A.png(없거나 낡으면 pxgrid 로 굽는다)."""
    d = CAND / slug
    if gen == 2:
        return np.array(Image.open(d / f'{SRC[slug]}.png').convert('RGBA'))
    pxg = d / 'v3-A.pxg'; png = d / 'v3-A.png'
    if not png.exists() or png.stat().st_mtime < pxg.stat().st_mtime:
        sys.path.insert(0, WC.PXGRID); import pxgrid; pxgrid.render(str(pxg), str(png))
    return np.array(Image.open(png).convert('RGBA'))


def render(gen, M):
    WC.use_palette('worldmap3.pal' if gen == 3 else 'worldmap.pal')
    L = {s: load(gen, s) for s in SRC}
    im = np.zeros((H * T, W * T, 4), np.uint8)
    bases = [L['plains_base'][:, k * T:(k + 1) * T] for k in range(3)]
    for y in range(H):
        for x in range(W):
            im[y * T:(y + 1) * T, x * T:(x + 1) * T] = bases[int(h01(x, y, 5) * 3) % 3]
    for name in ('desert', 'hills', 'forest', 'conifer', 'mountain'):
        over(im, compose_bundle(L[name], mask_of(M['feat'][name])), 0, 0)
    # 흩뿌림: 풀칸 6% 에 풀 무늬, 숲 가장자리 풀칸 14% 에 나무 한 그루
    used = set().union(*M['feat'].values()) | M['river'] | M['road'] | M['deep']
    forest_adj = lambda x, y: any((x + dx, y + dy) in M['feat']['forest'] | M['feat']['conifer'] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    icon_cells = {(ix + dx, iy + dy) for n, ix, iy in ICONS for dx in range(ISIZE[n][0]) for dy in range(ISIZE[n][1])}
    for (x, y) in sorted(M['land']):
        if (x, y) in used or (x, y) in icon_cells: continue
        r = h01(x, y, 31); k = int(h01(x, y, 32) * 3) % 3
        if forest_adj(x, y) and r < 0.14:
            over(im, L['trees_scatter'][:, k * T:(k + 1) * T], x * T, y * T)
        elif r < 0.06 + (0.14 if forest_adj(x, y) else 0):
            over(im, L['plains_scatter'][:, k * T:(k + 1) * T], x * T, y * T)
    road_and_bridge = M['road']
    over(im, compose_bundle(L['road'], mask_of(road_and_bridge)), 0, 0)
    over(im, compose_bundle(L['river'], mask_of(M['river'])), 0, 0)
    water = {(x, y) for y in range(H) for x in range(W) if (x, y) not in M['land']}
    over(im, compose_bundle(L['coast_grass'], mask_of(water), True), 0, 0)
    over(im, compose_bundle(L['sea_deep'], mask_of(M['deep']), True), 0, 0)
    over(im, compose_bundle(L['shoal'], mask_of(M['shoal']), False), 0, 0)
    # 다리: 길이 강을 건너는 칸(강 ∩ 길). 세로 흐름 → bridge_h, 가로 흐름 → bridge_v
    for (x, y) in sorted(M['river'] & M['road']):
        # 길이 가로(동서)로 지나면 강은 세로 흐름 → bridge_h.  길이 세로로 지나면 강은 가로 흐름 → bridge_v
        road_h = ((x - 1, y) in M['road'] or (x + 1, y) in M['road']) and not ((x, y - 1) in M['road'] and (x, y + 1) in M['road'])
        over(im, L['bridge_h' if road_h else 'bridge_v'], x * T, y * T)
    for n, ix, iy in ICONS:
        over(im, L[n], ix * T, iy * T)
    return Image.fromarray(im)


def b64(img):
    b = io.BytesIO(); img.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--html', action='store_true'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    M = build_map()
    imgs = {g: render(g, M) for g in (2, 3)}
    for g, im in imgs.items():
        im.save(os.path.join(OUT, f'scene-{g}.png')); print('wrote', f'scene-{g}.png', im.size)
    if a.html:
        import worldmap_v3_page
        worldmap_v3_page.build(imgs, b64)


if __name__ == '__main__':
    main()
