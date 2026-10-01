"""지도 맥락 크롭: 원본 월드 칩셋(easyrpg-chipset-world.png)의 초원·사막·황무지·언덕 타일 위에 아이콘을 얹는다.
키색(255,103,139)=투명, 그림자 키(254,103,139)=밑 지형을 어둡게(곱 .64/.70/.82)."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(HERE))
import numpy as np
from PIL import Image, ImageDraw

WORLD = ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png'
KEY = np.array([255, 103, 139], np.uint8)
SHADOW = np.array([254, 103, 139], np.uint8)
MUL = np.array([.64, .70, .82])


def tile(world, c, r):
    return world[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]


def terrain(world, cw, ch, kind, seed=1):
    rng = np.random.RandomState(seed)
    t = np.zeros((ch * 16, cw * 16, 3), np.uint8)
    for y in range(ch):
        for x in range(cw):
            if kind == 'grass':
                c, r = [(0, 8), (1, 8), (2, 8), (0, 9), (1, 10), (2, 11), (0, 10)][rng.randint(7)]
            elif kind == 'desert':
                c, r = (10, 2)
            elif kind == 'waste':
                c, r = (7, 2)
            elif kind == 'hills':
                c, r = [(0, 8), (1, 8), (2, 8), (0, 9)][rng.randint(4)]
            t[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = tile(world, c, r)[..., :3]
    return t


def stamp_alpha(canvas, world, c, r, x, y):
    """칩셋 타일(분홍 키 배경)을 지형 위에 올린다."""
    tl = tile(world, c, r)[..., :3]
    m = ~np.all(tl == KEY, -1)
    canvas[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16][m] = tl[m]


def put_hills(canvas, world, cx, cy, cw, ch):
    """언덕 타일 군(칩셋 (3..5,13..15) 의 모양 그대로 배치)."""
    for yy in range(ch):
        for xx in range(cw):
            c = 3 + (xx % 3)
            r = 13 + (yy % 3)
            stamp_alpha(canvas, world, c, r, cx + xx, cy + yy)


def put_icon(canvas, arr, cx, cy):
    """아이콘(키색 배경)을 칸 (cx,cy) 왼쪽 위에 얹는다. 그림자는 밑 지형을 곱한다."""
    h, w = arr.shape[:2]
    reg = canvas[cy * 16:cy * 16 + h, cx * 16:cx * 16 + w]
    key = np.all(arr == KEY, -1)
    shd = np.all(arr == SHADOW, -1)
    reg[shd] = (reg[shd] * MUL).astype(np.uint8)
    solid = ~key & ~shd
    reg[solid] = arr[solid]


def save2(img, path, z):
    Image.fromarray(img).resize((img.shape[1] * z, img.shape[0] * z), Image.NEAREST).save(path)


def label(img, text):
    im = Image.fromarray(img)
    ImageDraw.Draw(im).text((4, 3), text, fill=(255, 255, 255))
    return np.array(im)


def make(arrs, outdir):
    world = np.array(Image.open(WORLD).convert('RGBA'))
    outdir = Path(outdir)
    # 12x9 칸 크롭 ×2배: 같은 지형 위 3~4개 아이콘이 한 세트로 읽히는지
    crops = {
        'grass': ([('large_town_a', 0, 3), ('village_b', 5, 4), ('tower_small_a', 8, 2), ('camp_a', 8, 6), ('landmark_nature', 1, 6)] if False else
                  [('large_town_a', 0, 1), ('village_b', 4, 3), ('tower_small_b', 7, 1), ('camp_b', 9, 6), ('village_a', 0, 6), ('cave', 6, 6)], 'grass', None),
        'desert': ([('village_a', 1, 4), ('camp_a', 5, 2), ('tower_small_a', 9, 1), ('circle', 8, 5), ('ruin', 4, 6)], 'desert', None),
        'hills': ([('castle_a', 0, 5), ('volcano', 4, 2), ('cave', 8, 5), ('tower_small_b', 10, 1)], 'hills', (3, 0, 6, 4)),
        'waste': ([('ruin', 0, 4), ('ruin_city', 4, 3), ('camp_b', 8, 6), ('tower_small_a', 11, 1)], 'waste', None),
    }
    for k, (items, kind, hills) in crops.items():
        cv = terrain(world, 12, 9, kind, seed=3)
        if hills:
            put_hills(cv, world, *hills)
        for (n, cx, cy) in items:
            h, w = arrs[n].shape[0] // 16, arrs[n].shape[1] // 16
            put_icon(cv, arrs[n], min(cx, 12 - w), min(cy, 9 - h))
        save2(cv, outdir / f'map-ctx-{k}-12x9-2x.png', 2)
        save2(cv, outdir / f'map-ctx-{k}-12x9-1x.png', 1)
    # 전부 한 지도(초원 + 길): 3층 배치
    cw, ch = 44, 24
    cv = terrain(world, cw, ch, 'grass', seed=9)
    order = [('capital', 1, 1), ('fort_city', 9, 3), ('harbor_city', 14, 1), ('floating', 22, 0), ('ruin_city', 28, 2), ('castle_a', 34, 1),
             ('castle_b', 38, 2), ('large_town_a', 0, 9), ('large_town_b', 4, 9), ('shrine', 8, 9), ('landmark_nature', 12, 9), ('tower_great', 16, 8),
             ('village_a', 19, 10), ('village_b', 22, 10), ('camp_a', 25, 10), ('camp_b', 29, 10), ('cave', 33, 10), ('ruin', 36, 10),
             ('circle', 39, 10), ('volcano', 41, 10), ("tower_small_a", 3, 17), ("tower_small_b", 6, 17)]
    for (n, cx, cy) in order:
        if n not in arrs:
            continue
        h, w = arrs[n].shape[0] // 16, arrs[n].shape[1] // 16
        if cx + w <= cw and cy + h <= ch:
            put_icon(cv, arrs[n], cx, cy)
    save2(cv, outdir / 'map-all-grass-1x.png', 1)
    save2(cv, outdir / 'map-all-grass-2x.png', 2)
