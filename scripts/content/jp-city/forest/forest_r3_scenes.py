#!/usr/bin/env python3
"""숲 r3 검수 장면 — 붓으로 칠한 모양(덩이·띠·L·빈터 고리·물/길/집 맞닿음)을 jp 실제 땅 위에 오토타일 표로 칠한다.

  python3 forest_r3_scenes.py OUT [--kinds bl,sg,...] [--gif]
엔진과 같은 경로: 칸마다 8방 마스크 → 정규화 → (x mod 6, y mod 4) 위상 표에서 칸을 뽑는다(forest_r3.autotile_tiles).
버들항 기준(같은 배율): 버들항 잔디 위에 woodland 덩이 4장을 붙인 숲.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_r3 as F  # noqa: E402

ROOT = F.ROOT
T = 16
SHEET = np.array(Image.open(os.path.join(ROOT, 'public/assets/jp-city/jp-city-chipset.png')).convert('RGBA'))
TS = json.load(open(os.path.join(ROOT, 'src/assets/jpCityTileset.json'), encoding='utf-8'))
TPR = 96
AT = {a['id']: a for a in TS['autotileGroups']}
KITS = {k['id']: k for k in TS['structureKits']}
GRASS = 3281   # jp-lawn-dirt 속(잔디)


def tile(i):
    return SHEET[(i // TPR) * T:(i // TPR + 1) * T, (i % TPR) * T:(i % TPR + 1) * T]


def ground(Wd, H, pond=None, road=None):
    """잔디 + 연못·길 오토타일(8방)."""
    img = np.zeros((H * T, Wd * T, 4), np.uint8)
    lay = {}
    for name, M in (('jp-water-pond', pond), ('jp-lane-road', road)):
        if M is not None: lay[name] = M
    for y in range(H):
        for x in range(Wd):
            img[y * T:(y + 1) * T, x * T:(x + 1) * T] = tile(GRASS)
            for name, M in lay.items():
                if not M[y, x]: continue
                m = 0
                for bit, (dx, dy) in F.OFFS.items():
                    xx, yy = x + dx, y + dy
                    if xx < 0 or yy < 0 or xx >= Wd or yy >= H or M[yy, xx]: m |= bit
                t = AT[name]['variantMap'].get(str(m), AT[name]['variantMap']['255'])
                img[y * T:(y + 1) * T, x * T:(x + 1) * T] = tile(t)
    return img


def stamp_kit(img, kid, x, y):
    k = KITS[kid]
    for j, row in enumerate(k['rows']):
        for i in range(k['width']):
            for t in (row.get('tiles', [-1] * k['width'])[i], row.get('upperTiles', [-1] * k['width'])[i]):
                if t is not None and t >= 0:
                    F.over(img, tile(t), (x + i) * T, (y + j) * T)


def shapes():
    """(이름, 설명, 폭, 높이, 숲 마스크, 땅 그리기 함수)."""
    out = []
    W_, H_ = 26, 16
    yy, xx = np.mgrid[0:H_, 0:W_]
    blob = ((xx - 12.5) / 9.5) ** 2 + ((yy - 7.5) / 6.0) ** 2 + 0.18 * np.sin(xx * 0.9) * np.cos(yy * 0.7) < 1.0
    out.append(('blob', 'irregular blob of forest painted with the brush', W_, H_, blob, lambda: ground(W_, H_)))
    st = np.zeros((H_, W_), bool)
    st[2, 2:24] = True                 # 1줄 띠(위로 넘치는 수관이 보이게 맵 위 끝에서 두 줄 띄운다)
    st[5:7, 2:24] = True               # 2줄 띠
    st[9:12, 2:24] = True              # 3줄 띠
    st[13:16, 3] = True; st[13:16, 7:9] = True   # 세로 1·2칸 띠
    out.append(('strips', 'long horizontal strips 1, 2 and 3 tiles tall, and vertical strips 1 and 2 tiles wide', W_, H_, st, lambda: ground(W_, H_)))
    L = np.zeros((H_, W_), bool); L[2:14, 3:9] = True; L[9:14, 9:22] = True
    out.append(('lshape', 'L-shaped forest (inner corner at the bend)', W_, H_, L, lambda: ground(W_, H_)))
    ring = np.zeros((H_, W_), bool); ring[1:15, 3:23] = True; ring[5:10, 9:17] = False
    out.append(('ring', 'forest ring around a clearing (inner edges face the clearing)', W_, H_, ring, lambda: ground(W_, H_)))
    pond = np.zeros((H_, W_), bool); pond[9:15, 3:12] = True
    road = np.zeros((H_, W_), bool); road[:, 14:16] = True
    tch = np.zeros((H_, W_), bool); tch[1:9, 1:14] = True; tch[9:13, 12:14] = True; tch[1:16, 16:25] = True; tch[9:14, 18:25] = False
    def g5():
        img = ground(W_, H_, pond=pond, road=road)
        return img
    out.append(('touching', 'forest touching a pond (south-west), both sides of a road, and a house (south-east clearing)', W_, H_, tch, g5))
    return out


TILES = {}


def tiles(sp):
    if sp not in TILES: TILES[sp] = F.autotile_tiles(sp)
    return TILES[sp]


def scene(sp, name, Wd, H, M, gfn):
    img = gfn()
    if name == 'touching':
        stamp_kit(img, 'jp-bldg-house-hiraya', 15, 9) if False else None
    forest = F.paint_map(sp, M, tiles(sp))
    F.over(img, forest, 0, 0)
    if name == 'touching':
        stamp_kit(img, 'jp-bldg-house-shed-modern', 17, 9)
    return img


def beodeul_ref(Wd=26, H=16):
    """버들항 숲(같은 배율): 버들항 잔디 + woodland 덩이를 숲 덩이로 붙였다."""
    B = os.path.join(ROOT, 'public/assets/beodeul-ground/')
    src = np.array(Image.open(os.path.join(ROOT, 'tiledata/beodeul-ground/tree-studies/current-grove.png')).convert('RGBA')).astype(int)
    grass = None
    for y0 in range(0, src.shape[0] - 32, 4):
        for x0 in range(0, src.shape[1] - 32, 4):
            w = src[y0:y0 + 32, x0:x0 + 32]
            if (w[..., 1] > w[..., 0] + 20).all() and (w[..., 1] > 90).all():
                grass = w.astype(np.uint8); break
        if grass is not None: break
    img = np.zeros((H * T, Wd * T, 4), np.uint8)
    for y in range(0, H * T, 32):
        for x in range(0, Wd * T, 32):
            img[y:y + 32, x:x + 32] = grass[:min(32, H * T - y), :min(32, Wd * T - x)]
    for k, (x, y) in (('west', (2, 1)), ('east', (8, 1)), ('north', (14, 1)), ('west', (14, 5)), ('north-open', (8, 8)), ('east', (19, 6))):
        s = np.array(Image.open(B + f'woodland-{k}-shadow.png').convert('RGBA'))
        a = np.array(Image.open(B + f'woodland-{k}.png').convert('RGBA'))
        F.over(img, s, x * T, y * T); F.over(img, a, x * T, y * T)
    return img


def adjacent_scene(pair, Wd=26, H=16):
    """서로 다른 두 숲 오토타일이 맞닿은 덩이(왼쪽 반 A, 오른쪽 반 B, 경계는 비스듬한 계단). 서로를 숲 밖으로 본다."""
    yy, xx = np.mgrid[0:H, 0:Wd]
    M = ((xx - 12.5) / 11.0) ** 2 + ((yy - 7.5) / 7.0) ** 2 < 1.0
    left = xx < 11 + yy // 3
    img = ground(Wd, H)
    F.over(img, F.paint_map(pair[0], M & left, tiles(pair[0])), 0, 0)
    F.over(img, F.paint_map(pair[1], M & ~left, tiles(pair[1])), 0, 0)
    return img


def paint_gif(sp, path, scale=2):
    """붓 시험: 붓질이 쌓이며 칸이 실시간으로 맞춰지는 모습."""
    Wd, H = 24, 14
    base = ground(Wd, H)
    M = np.zeros((H, Wd), bool)
    strokes = []
    for t in range(0, 40):   # 큰 덩이를 둥근 붓으로
        cx, cy = 4 + t * 0.4, 4 + 2.5 * np.sin(t * 0.3)
        strokes.append((cx, cy, 1.6))
    for t in range(0, 22):   # 아래로 내려가는 띠
        strokes.append((16 + 0.2 * t, 4 + t * 0.4, 1.0))
    for t in range(0, 18):   # 오른쪽 1~2칸 가는 띠
        strokes.append((19 + t * 0.25, 11.5, 0.6))
    frames = []
    yy, xx = np.mgrid[0:H, 0:Wd]
    for k, (cx, cy, r) in enumerate(strokes):
        M |= (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r
        if k % 2: continue
        img = base.copy()
        F.over(img, F.paint_map(sp, M, tiles(sp)), 0, 0)
        # 붓 커서
        im = Image.fromarray(img).resize((Wd * T * scale, H * T * scale), Image.NEAREST)
        frames.append(im.convert('P', palette=Image.ADAPTIVE, colors=255))
    for _ in range(6): frames.append(frames[-1])
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=120, loop=0)


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    kinds = sys.argv[sys.argv.index('--kinds') + 1].split(',') if '--kinds' in sys.argv else F.KINDS
    Image.fromarray(beodeul_ref()).save(os.path.join(out, 'ref-beodeul.png'))
    if '--mix' in sys.argv:
        for name, pair in (('adj-bl-sg', ('bl', 'sg')), ('adj-sk-mh', ('sk', 'mh'))):
            Image.fromarray(adjacent_scene(pair)).save(os.path.join(out, f'{name}.png')); print(name, 'ok', flush=True)
        sys.exit(0)
    for sp in kinds:
        if '--gif-only' in sys.argv:
            paint_gif(sp, os.path.join(out, f'{sp}-paint.gif')); print(sp, 'gif ok', flush=True); continue
        for name, desc, Wd, H, M, gfn in shapes():
            Image.fromarray(scene(sp, name, Wd, H, M, gfn)).save(os.path.join(out, f'{sp}-{name}.png'))
        print(sp, 'scenes ok', flush=True)
        if '--gif' in sys.argv:
            paint_gif(sp, os.path.join(out, f'{sp}-paint.gif'))
            print(sp, 'gif ok', flush=True)
