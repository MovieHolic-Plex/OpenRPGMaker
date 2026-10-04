#!/usr/bin/env python3
"""월드맵 6판 데모 장면 조립기 (37x43 칸). 목표 그림 실측(tiledata/atlas-pick/worldmap-v6-target.md)에 맞춘 한 장.

  python3 scripts/content/atlas-pick/worldmap_v6_demo.py            # 장면 PNG (style-demo-worldmap6/scene-6.png)
  python3 scripts/content/atlas-pick/worldmap_v6_demo.py --round N  # 라운드 N 스냅샷도 scene-6-rN.png 로 남긴다

배치: 북쪽 성벽 마을과 밭, 가운데 성, 남서 성벽 도시, 동쪽 산, 남쪽 해안과 침엽수 숲.
6판 조각 = 각 슬러그의 v6-A.pxg (worldmap6.pal). 손으로 좌표 찍은 조각만 쓴다(생성 밑그림 없음).
"""
import os, sys, argparse
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import worldmap_context as WC
from worldmap_context import compose_bundle, over, h01, T
from worldmap_v3_gen import ROOT, CAND

W, H = 37, 43
OUT = os.path.join(ROOT, 'tiledata/atlas-pick/style-demo-worldmap6')
SLUGS = ['coast_grass', 'sea_deep', 'shoal', 'plains_base', 'meadow', 'hills', 'mountain', 'forest', 'conifer',
         'mountain_peaks', 'mountain_cliff', 'forest_crowns', 'conifer_crowns', 'trees_scatter', 'road', 'river', 'bridge_h', 'bridge_v',
         'field_wheat', 'field_crop', 'shore_rocks', 'wall_h', 'wall_v', 'wall_tower', 'castle_keep', 'city_district',
         'gate_tower', 'house_blue_a', 'house_blue_b', 'hall_blue', 'tower_blue', 'timber_a', 'timber_b']
OVERLAY = {'mountain': 'mountain_peaks', 'forest': 'forest_crowns', 'conifer': 'conifer_crowns'}
COVER = {'mountain': 0.4, 'forest': 0.55, 'conifer': 0.85}
ISIZE = {'house_blue_a': (2, 2), 'house_blue_b': (2, 2), 'hall_blue': (3, 2), 'tower_blue': (1, 2), 'gate_tower': (2, 2),
         'timber_a': (2, 3), 'timber_b': (2, 3), 'castle_keep': (4, 4), 'city_district': (4, 3)}


# ─────────────────────────── 지도 ───────────────────────────
def blob(cx, cy, rx, ry, seed, noise=0.30):
    s = set()
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + (h01(x, y, seed) - .5) * noise
            if d < 1: s.add((x, y))
    return s


def cleanup(s, passes=2):
    for _ in range(passes):
        n = lambda x, y: sum((x + dx, y + dy) in s for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        s = {c for c in s if n(*c) >= 2}
        s |= {(x, y) for y in range(H) for x in range(W) if (x, y) not in s and n(x, y) >= 3}
    return s


def poly(points, width=1):
    cells = set()
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for dx in range(width):
                    for dy in range(width): cells.add((x + dx, y + dy))
    return cells


def rrect(x0, y0, x1, y1, cut=1):
    """모서리를 깎은 사각(목표 그림의 밭은 둥근 육각형에 가깝다)."""
    s = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx, dy = min(x - x0, x1 - x), min(y - y0, y1 - y)
            if dx + dy >= cut: s.add((x, y))
    return s


def mask_of(cells):
    return [''.join('1' if (x, y) in cells else '0' for x in range(W)) for y in range(H)]


def overlay_anchors(cells, seed, cover=0.5, step=2):
    out, used = [], set()
    for gy in range(-1, H, step):
        for gx in range(-1 + (gy // step % 2 if step == 1 else 0), W, 2):
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
    h, w = src.shape[:2]
    x0, y0 = max(0, -x), max(0, -y); x1, y1 = min(w, im.shape[1] - x), min(h, im.shape[0] - y)
    if x1 > x0 and y1 > y0: over(im, src[y0:y1, x0:x1], x + x0, y + y0)


# 아이콘: (이름, 왼쪽 위 칸 x, y)
TOWN = (6, 3, 19, 11)      # 북쪽 성벽 마을 사각(x0,y0,x1,y1)
CITY = (2, 28, 14, 37)     # 남서 성벽 도시
ICONS = [
    # 북쪽 성벽 마을(성문 아래 가운데)
    ('gate_tower', 12, 10), ('hall_blue', 8, 5), ('house_blue_a', 13, 5), ('house_blue_b', 16, 6),
    ('timber_a', 9, 7), ('timber_b', 15, 8), ('tower_blue', 7, 8),
    # 가운데 성
    ('castle_keep', 16, 19), ('city_district', 12, 20), ('house_blue_a', 20, 20), ('house_blue_b', 20, 22),
    # 남서 성벽 도시
    ('gate_tower', 8, 36), ('city_district', 3, 30), ('city_district', 8, 30), ('house_blue_a', 4, 34), ('hall_blue', 9, 34),
    ('timber_a', 12, 30),
    ('house_blue_b', 6, 34), ('timber_b', 12, 34),
    ('house_blue_a', 17, 6), ('house_blue_b', 11, 8), ('timber_a', 17, 8),
]


def build_map():
    land = set()
    for i, (cx, cy, rx, ry) in enumerate([(18, 21, 19, 19), (18, 8, 16, 8), (28, 34, 9, 6), (8, 34, 8, 6), (22, 38, 9, 3.6)]):
        land |= blob(cx, cy, rx, ry, 100 + i)
    land = {c for c in land if 0 <= c[0] < W and 0 <= c[1] < 39 - (2 if c[0] < 3 else 0)}
    for c in blob(38, 9, 3.2, 3.5, 143) | blob(38, 31, 3.2, 3.6, 144) | blob(0, 14, 1.8, 3, 145) | blob(0, 29, 1.8, 3, 146):
        land.discard(c)
    # 만: 서쪽 아래와 남동쪽을 물이 파고든다
    for c in blob(1, 40, 6, 5, 140) | blob(35, 41, 6, 4, 141) | blob(21, 43, 8, 3, 142):
        land.discard(c)
    land = cleanup(land)
    # 길: 북쪽 성문 → 성 → 남서 도시, 구불구불(2칸 폭이 아니라 1칸)
    road = (poly([(12, 12), (12, 14), (14, 14), (14, 17), (18, 17), (18, 23), (18, 24), (16, 24), (16, 27), (10, 27), (10, 33)])
            | poly([(18, 24), (24, 24), (24, 30), (22, 30), (22, 35)]) | poly([(19, 14), (26, 14), (26, 10)]))
    river = poly([(30, 0), (30, 3), (27, 3), (27, 12), (22, 12), (22, 16)], 1) | poly([(22, 16), (26, 16), (26, 22)], 1)
    river = {c for c in river if c not in poly([(22, 16), (26, 16)])}   # 성 앞 갈림 정리
    land |= road | river
    keep = set(road) | set(river)
    for n, ix, iy in ICONS:
        for dx in range(-1, ISIZE[n][0] + 1):
            for dy in range(-1, ISIZE[n][1] + 1): keep.add((ix + dx, iy + dy))
    walls = wall_cells() & land
    keep |= walls
    feat = {}
    order = [('conifer', [(14, 40, 7, 2.6), (30, 37, 5.5, 3.2), (4, 18, 3, 4), (29, 4, 4, 3), (3, 6, 2.6, 4), (22, 34, 2.4, 2)]),
             ('forest', [(24, 28, 3.5, 3)]),
             ('hills', [(8, 22, 3, 2.2), (25, 20, 3, 2), (22, 9, 2.6, 1.8)]),
             ('mountain', [(33, 14, 4.5, 4.5), (31, 21, 4, 3.5), (34, 25, 3.5, 3.5), (30, 29, 4, 2.6), (35, 6, 3, 4)]),
             ('meadow', [(28, 12, 5.5, 3.4), (7, 23, 4.4, 3), (24, 21, 3.6, 2.4), (14, 22, 4, 2.6)]),
             ('field_wheat', []), ('field_crop', [])]
    for k, (name, bl) in enumerate(order):
        cells = set()
        for j, b in enumerate(bl): cells |= blob(*b, 300 + 10 * k + j, 0.75 if name == 'mountain' else 0.35)
        feat[name] = cleanup(cells & land)
    feat['field_wheat'] = (rrect(21, 4, 27, 10, 2) | rrect(2, 12, 7, 18, 2)) & land
    feat['field_crop'] = (rrect(20, 15, 26, 20, 2) | rrect(8, 14, 13, 19, 2) | rrect(3, 20, 8, 25, 2)) & land
    for name in feat: feat[name] -= keep
    for a, b in [('conifer', 'forest'), ('forest', 'hills'), ('hills', 'mountain'), ('conifer', 'hills'), ('forest', 'mountain'),
                 ('conifer', 'mountain'), ('meadow', 'mountain'), ('meadow', 'forest'), ('meadow', 'conifer'), ('meadow', 'hills'),
                 ('hills', 'field_wheat'), ('hills', 'field_crop'), ('forest', 'field_wheat'), ('forest', 'field_crop'),
                 ('conifer', 'field_wheat'), ('conifer', 'field_crop'), ('meadow', 'field_wheat'), ('meadow', 'field_crop'),
                 ('mountain', 'field_wheat'), ('mountain', 'field_crop')]:
        feat[a] -= feat[b]
    deep = set()
    for y in range(H):
        for x in range(W):
            if (x, y) in land: continue
            if not any((x + dx, y + dy) in land for dx in range(-2, 3) for dy in range(-2, 3)): deep.add((x, y))
    shoal = {c for c in [(1, 39), (2, 39), (2, 40), (3, 40), (34, 40), (35, 40), (35, 41)] if c in deep}
    return dict(land=land, river=river, road=road, feat=feat, deep=deep, shoal=shoal, walls=walls)


def wall_cells():
    """성벽 선(칸). 마을·도시 사각 둘레, 모서리는 한 칸 깎은 계단(목표 그림의 다각 성벽). 성문 자리는 비운다."""
    s = set()
    for (x0, y0, x1, y1), gate, cut in ((TOWN, (12, 13), 1), (CITY, (8, 9), 2)):
        for x in range(x0 + cut, x1 - cut + 1):
            s.add((x, y0))
            if x not in gate: s.add((x, y1))
        for y in range(y0 + cut, y1 - cut + 1): s.add((x0, y)); s.add((x1, y))
        for i in range(cut):   # 모서리 계단
            for (cx, cy, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
                s.add((cx + sx * (cut - i), cy + sy * i)); s.add((cx + sx * (cut - i), cy + sy * (i + 1)))
    return s


# ─────────────────────────── 그림 ───────────────────────────
def piece(slug):
    d = CAND / slug
    pxg, png = d / 'v6-A.pxg', d / 'v6-A.png'
    if not png.exists() or png.stat().st_mtime < pxg.stat().st_mtime:
        sys.path.insert(0, WC.PXGRID); import pxgrid; pxgrid.render(str(pxg), str(png))
    return np.array(Image.open(png).convert('RGBA'))


def vnoise(x, y, seed, sc):
    """격자 값 잡음(0..1) - 큰 얼룩 톤 변화용, 좌표 결정적."""
    gx, gy = x / sc, y / sc; x0, y0 = int(np.floor(gx)), int(np.floor(gy)); fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = h01(x0, y0, seed), h01(x0 + 1, y0, seed); c, d = h01(x0, y0 + 1, seed), h01(x0 + 1, y0 + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def shade(im, x0, y0, x1, y1, f):
    blk = im[y0:y1, x0:x1, :3].astype(np.float32) * f
    im[y0:y1, x0:x1, :3] = np.clip(blk, 0, 255).astype(np.uint8)


def ground_mottle(im, M):
    """풀 칸 큰 얼룩: 목표 그림의 어두운 올리브 띠와 밝은 풀밭을 픽셀 단위로 깔되 물결 경계를 만든다(2톤 문턱)."""
    plain = M['land'] - set().union(*M['feat'].values()) - M['river'] - M['road'] - M['walls']
    for (x, y) in plain:
        for py in range(0, T, 4):
            for px in range(0, T, 4):
                X, Y = x * T + px, y * T + py
                n = vnoise(X, Y, 411, 46) * .65 + vnoise(X, Y, 412, 17) * .35
                f = 0.86 if n < 0.36 else (1.07 if n > 0.66 else 1.0)
                if f != 1.0: shade(im, X, Y, X + 4, Y + 4, f)


def cast_shadows(im, M):
    """산 절벽 아래(남)·오른쪽(동)에 1~2칸 드리운 그림자(목표 실측: 그림자 1~2칸)."""
    mt = M['feat']['mountain']; land = M['land']
    for (x, y) in mt:
        if (x, y + 1) not in mt and (x, y + 1) in land and (x, y + 1) not in M['walls']:
            shade(im, x * T, (y + 1) * T, (x + 1) * T, (y + 1) * T + 7, 0.62)
            shade(im, x * T, (y + 1) * T + 7, (x + 1) * T, (y + 1) * T + 11, 0.82)
        if (x + 1, y) not in mt and (x + 1, y) in land:
            shade(im, (x + 1) * T, y * T, (x + 1) * T + 4, (y + 1) * T, 0.7)


def mountain_strata(im, M):
    """산 윗면 지층: 45도 결 줄무늬로 밝고 어두운 갈색 띠(목표: 6톤 갈색 + 사선 해칭)."""
    for (x, y) in M['feat']['mountain']:
        for py in range(T):
            for px in range(T):
                X, Y = x * T + px, y * T + py
                v = ((X + Y) // 3) % 7
                n = vnoise(X, Y, 431, 13)
                f = 1.0 + (0.10 if v == 0 else (-0.10 if v == 3 else 0.0)) + (n - .5) * 0.30
                im[Y, X, :3] = np.clip(im[Y, X, :3].astype(np.float32) * f, 0, 255).astype(np.uint8)


def render6(M, icons=ICONS, overlays=True):
    WC.use_palette('worldmap6.pal')
    L = {s: piece(s) for s in SLUGS}
    im = np.zeros((H * T, W * T, 4), np.uint8)
    bases = [L['plains_base'][:, k * T:(k + 1) * T] for k in range(3)]
    for y in range(H):
        for x in range(W):
            im[y * T:(y + 1) * T, x * T:(x + 1) * T] = bases[int(h01(x, y, 5) * 3) % 3]
    for name in ('meadow', 'field_wheat', 'field_crop', 'hills', 'forest', 'conifer', 'mountain'):
        over(im, compose_bundle(L[name], mask_of(M['feat'][name])), 0, 0)
    ground_mottle(im, M)
    mt = M['feat']['mountain']
    for (x, y) in sorted(mt):
        k = int(h01(x, y, 91) * 3) % 3
        south_open, east_open = (x, y + 1) not in mt, (x + 1, y) not in mt
        ledge = (x, y - 1) in mt and (x, y + 1) in mt and h01(x // 3, y, 92) < 0.10 and (x - 1, y) in mt and (x + 1, y) in mt
        if south_open: over(im, L['mountain_cliff'][:, k * T:(k + 1) * T], x * T, y * T)
        elif east_open: over(im, L['mountain_cliff'][:, (3 + k) * T:(4 + k) * T], x * T, y * T)
        elif ledge: over(im, L['mountain_cliff'][:, k * T:(k + 1) * T], x * T, y * T)
    mountain_strata(im, M)
    cast_shadows(im, M)
    if overlays:
        for i, (name, ov) in enumerate(OVERLAY.items()):
            for (x, y, k) in overlay_anchors(M['feat'][name], 700 + 17 * i, COVER[name], 1 if name == 'mountain' else 2):
                stamp(im, L[ov][:, k * 32:(k + 1) * 32], x * T, y * T)
    used = set().union(*M['feat'].values()) | M['river'] | M['road'] | M['deep'] | M['walls']
    forest_adj = lambda x, y: any((x + dx, y + dy) in M['feat']['forest'] | M['feat']['conifer'] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    icon_cells = set()
    for n, ix, iy in icons:
        sz = ISIZE[n]
        icon_cells |= {(ix + dx, iy + dy) for dx in range(sz[0]) for dy in range(sz[1])}
    for (x, y) in sorted(M['land']):
        if (x, y) in used or (x, y) in icon_cells: continue
        r = h01(x, y, 31); k = int(h01(x, y, 32) * 3) % 3
        if r < (0.26 if forest_adj(x, y) else 0.035):
            over(im, L['trees_scatter'][:, k * T:(k + 1) * T], x * T, y * T)
    over(im, compose_bundle(L['road'], mask_of(M['road'])), 0, 0)
    over(im, compose_bundle(L['river'], mask_of(M['river'])), 0, 0)
    water = {(x, y) for y in range(H) for x in range(W) if (x, y) not in M['land']}
    over(im, compose_bundle(L['coast_grass'], mask_of(water), True), 0, 0)
    over(im, compose_bundle(L['sea_deep'], mask_of(M['deep']), True), 0, 0)
    over(im, compose_bundle(L['shoal'], mask_of(M['shoal']), False), 0, 0)
    # 기슭 자갈
    # 물가 흙 턱: 남쪽 물가 풀 칸을 통째 절벽 턱으로(목표 그림의 갈색 기슭)
    for (x, y) in sorted(M['land']):
        if (x, y + 1) in water and (x, y) not in M['walls'] and (x, y) not in icon_cells and (x, y) not in M['river'] and (x, y) not in M['road'] and h01(x, y, 95) < 0.7:
            k = int(h01(x, y, 96) * 3) % 3
            over(im, L['mountain_cliff'][:, k * T:(k + 1) * T], x * T, y * T)
    for (x, y) in sorted(M['land']):
        if (x, y) in M['walls'] or (x, y) in icon_cells: continue
        if any((x + dx, y + dy) in water for dx, dy in ((0, 1), (1, 0), (-1, 0))) and h01(x, y, 61) < 0.22:
            k = int(h01(x, y, 62) * 3) % 3
            over(im, L['shore_rocks'][:, k * T:(k + 1) * T], x * T, y * T)
    for (x, y) in sorted(M['river'] & M['road']):
        road_h = ((x - 1, y) in M['road'] or (x + 1, y) in M['road']) and not ((x, y - 1) in M['road'] and (x, y + 1) in M['road'])
        over(im, L['bridge_h' if road_h else 'bridge_v'], x * T, y * T)
    # 성벽: 가로·세로 선 + 모서리·성문 옆 탑
    for (x, y) in sorted(M['walls']):
        hor = (x - 1, y) in M['walls'] or (x + 1, y) in M['walls']
        ver = (x, y - 1) in M['walls'] or (x, y + 1) in M['walls']
        if hor and ver: stamp(im, L['wall_tower'], x * T, y * T)
        elif hor: stamp(im, L['wall_h'], x * T, y * T)
        else: stamp(im, L['wall_v'], x * T, y * T)
    for n, ix, iy in sorted(icons, key=lambda a: a[2] + ISIZE[a[0]][1]):
        stamp(im, L[n], ix * T, iy * T)
    return Image.fromarray(im)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--round', type=int, default=0); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    M = build_map(); im = render6(M)
    im.save(os.path.join(OUT, 'scene-6.png')); print('wrote scene-6.png', im.size)
    if a.round: im.save(os.path.join(OUT, f'scene-6-r{a.round}.png')); print('wrote round', a.round)


if __name__ == '__main__':
    main()
