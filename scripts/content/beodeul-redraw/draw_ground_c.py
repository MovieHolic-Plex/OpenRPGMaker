"""Beodeul 16px ground edges (j363 j365 j393 j394 j423) + Joseon leaf tone texture.

Code hand-pixel art. Each tile is a hand-written grass/dirt mask (g/d). The outer
pixel ring is forced to the autotile seam classes so neighbours still line up;
the interior outline is drawn fresh here. Fill comes pixel-aligned from the
credited textures RTP grass/dirt cells 2502 / 23169 of the Beodeul sheet, then the boundary is shaded:
  - dirt under a grass edge   -> dark rim (grass lip casts a shadow)
  - dirt beside / above grass -> existing darker dirt tone
  - grass above dirt          -> light grass lip; grass below dirt -> deep grass
plus a few grass tufts hanging into the dirt and small pebbles.

Usage: python3 draw_ground_c.py   (writes into the folder of this script)
"""
import json, random
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent / 'art'
HERE = Path(__file__).resolve().parent
_CITY = np.array(Image.open(HERE.parents[2] / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGB'))
def _cell(n): return _CITY[(n // 128) * 16:(n // 128 + 1) * 16, (n % 128) * 16:(n % 128 + 1) * 16]

GRASS = _cell(2502).copy()   # EasyRPG RTP grass in the Beodeul sheet (CC BY 4.0, credited in public/assets/ATTRIBUTION.md)
DIRT_SRC = _cell(23169).copy()   # EasyRPG RTP dirt in the Beodeul sheet (CC BY 4.0)

# palette names (all present in the two textures)
G_DARK, G_MID, G_LIGHT = (63, 114, 62), (110, 153, 67), (139, 177, 78)
D_DARK, D_SHADE, D_BASE, D_LIGHT = (110, 91, 73), (118, 99, 79), (138, 116, 92), (158, 139, 100)
DIRT_COLS = {(110, 91, 73), (118, 99, 79), (129, 106, 86), (135, 119, 86), (138, 116, 92), (158, 139, 100)}
# extra edge colours (shades of the textures)
E_RIM = (96, 79, 63)      # dark dirt rim under grass
E_PEB = (88, 73, 60)      # pebble shadow
E_GDEEP = (50, 96, 54)    # deep grass just below a dirt edge
EDGE = [E_RIM, E_PEB, E_GDEEP]

# hand-drawn masks. ring is overwritten by the seam classes from seams.json
MASKS = {
 '363': """
gggggddddddggggg
ggggdddddddddggg
gggddddddddddggg
ggdddddddddddggg
gdddddddddddddgg
dddddddddddddddg
dddddddddddddddg
gddddddddddddddd
ggdddddddddddddd
dddddddddddddddd
dddddddddddddddd
gddddddddddddddg
ggddddddddddddgg
gggdddddddddddgg
ggggdddddddddggg
gggggdgddddggggg""",
 '365': """
ggddddddddddddgg
gggddddddddddggg
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
ddddddddddddddgd
ggddddddddddddgg
gdddddddddddddgg""",
 '393': """
ggggggggggggdggg
gggggggggggddggg
ggggggggggddddgd
ggggggggdddddddd
ggggggggdddddddd
ggggggdddddddddd
ggggggdddddddddd
gggggddddddddddd
ggdddddddddddddd
dddddddddddddddd
ggdddddddddddddd
gggddddddddddddd
ggdddddddddddddd
gddddddddddddddd
ggdddddddddddddd
gddddddddddddddd""",
 '394': """
gggggdggggggdddd
dgggddgggggddddd
ddgddddggddddddd
dddddddgdddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd
dddddddddddddddd""",
 '423': """
dddddddddddddddd
ggdddddddddddddd
gggddddddddddddd
ggdddddddddddddd
dddddddddddddddd
gddddddddddddddd
ggdddddddddddddd
gggddddddddddddd
ggggdddddddddddd
gggddddddddddddd
gggddddddddddddd
ggdddddddddddddd
gggddddddddddddd
ggggdddddddddddd
gggddddddddddddd
gddddddddddddddd""",
}

# grass tufts hanging into dirt: (x, y) = tuft tip (dirt pixel turned grass)
TUFTS = {'363': [(6, 2), (3, 12), (13, 6)], '365': [], '393': [], '394': [], '423': []}
# revised tiles: organic outline + full 3/4 edge (deep grass > light lip > dark rim)
ENH = {'365', '393', '394', '423'}
# pebbles: (x, y) light top pixel, shadow pixel below it
PEBBLES = {'363': [(9, 9), (5, 11)], '365': [(6, 6), (11, 10), (4, 11)],
           '393': [(11, 7), (7, 12)], '394': [(5, 8), (12, 11)], '423': [(9, 5), (11, 11)]}


def _clean(x, y):
    return x < 10 and y < 10 and tuple(map(int, DIRT_SRC[y, x])) in DIRT_COLS


def dirt_px(x, y):
    """pixel-aligned dirt from tex_dirt. Its lower/right strip holds grass and dark
    seam pixels, so those spots borrow a pixel from the clean upper-left block."""
    if _clean(x, y):
        return tuple(map(int, DIRT_SRC[y, x]))
    for i in range(16):
        sx, sy = (x * 7 + y * 3 + i) % 10, (y * 5 + x + 2 * i) % 10
        if _clean(sx, sy):
            return tuple(map(int, DIRT_SRC[sy, sx]))
    return D_BASE


def draw(key, old):
    m = [list(r) for r in MASKS[key].strip().split('\n')]
    for y in range(16):
        for x in range(16):
            if y in (0, 15) or x in (0, 15):
                m[y][x] = old[key][y][x]
    for (x, y) in TUFTS[key]:
        m[y][x] = 'g'
    img = np.zeros((16, 16, 3), np.uint8)
    at = lambda x, y: m[y][x] if 0 <= x < 16 and 0 <= y < 16 else None
    enh = key in ENH
    for y in range(16):
        for x in range(16):
            if m[y][x] == 'g':
                c = tuple(map(int, GRASS[y, x]))
                if at(x, y + 1) == 'd':
                    c = G_LIGHT                    # grass lip over dirt
                elif at(x, y - 1) == 'd':
                    c = E_GDEEP if (x + y) % 3 else G_DARK   # grass below a dirt edge
                elif enh and at(x, y + 2) == 'd':
                    c = E_GDEEP                    # deep grass just above the lip
                elif at(x - 1, y) == 'd' or at(x + 1, y) == 'd':
                    c = G_MID if c == G_LIGHT else c
            else:
                c = dirt_px(x, y)
                if at(x, y - 1) == 'g':
                    c = E_RIM                      # shadow under the grass edge
                elif at(x - 1, y) == 'g' or at(x + 1, y) == 'g':
                    c = D_SHADE
                elif enh and (at(x - 1, y - 1) == 'g' or at(x + 1, y - 1) == 'g'):
                    c = D_SHADE                    # close the rim round outer corners
                elif at(x, y + 1) == 'g':
                    c = D_SHADE
                elif at(x, y - 2) == 'g' and c in (D_LIGHT, (135, 119, 86)):
                    c = D_BASE if not enh else D_SHADE   # second row under the lip
            img[y, x] = c
    # tufts: tip pixel light, shading it from its root
    for (x, y) in TUFTS[key]:
        img[y, x] = G_MID
        if at(x, y + 1) == 'd':
            img[y + 1, x] = E_RIM
    for (x, y) in PEBBLES[key]:
        if m[y][x] == 'd' and at(x, y + 1) == 'd':
            img[y, x] = D_LIGHT
            img[y + 1, x] = E_PEB
            if at(x + 1, y + 1) == 'd' and 0 < x + 1 < 15:
                img[y + 1, x + 1] = D_DARK
    return img


def leaf_tones(seed=11):
    """32x32 tileable leaf-cluster tones 1..6 (dark..light), wraps on a torus."""
    rnd = random.Random(seed)
    N = 32
    tone = np.ones((N, N), int)          # gaps between clusters = 1
    cover = np.zeros((N, N), bool)
    dabs = []
    for gy in range(9):                  # jittered grid of dab centres
        for gx in range(9):
            dabs.append((gy * 3.56 + rnd.uniform(-1, 1), gx * 3.56 + rnd.uniform(-1, 1) + (1.7 if gy % 2 else 0),
                         rnd.choice([1.7, 2.0, 2.2, 2.4])))
    dabs.sort(key=lambda d: d[0] + rnd.uniform(-0.5, 0.5))   # lower dabs overlap upper ones

    def paint(cy, cx, r):
        cy, cx = round(cy), round(cx)
        R = int(r) + 1
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                dist = (dx * dx + dy * dy) ** 0.5
                if dist > r:
                    continue
                rel = (dx + dy) / (r * 1.414)       # -1 upper-left .. +1 lower-right
                if rel > 0.45 and dist > r - 1.0:
                    t = 2                           # dark lower-right rim
                elif rel > 0.15:
                    t = 3
                elif rel > -0.3:
                    t = 4
                elif (dx, dy) == (-1, -1) and r >= 2.0:
                    t = 6                           # single sparkle on the lit side
                else:
                    t = 5
                y, x = (cy + dy) % N, (cx + dx) % N
                tone[y, x] = t
                cover[y, x] = True
    for d in dabs:
        paint(*d)
    return tone


def main():
    old = json.load(open(HERE / 'seams.json'))['ring']
    tiles = {}
    for k in MASKS:
        tiles[k] = draw(k, old)
        Image.fromarray(tiles[k]).save(OUT / f'j{k}.png')
    json.dump([list(c) for c in EDGE], open(OUT / 'edge_colours.json', 'w'))

    # seam preview: each tile centred in 3x3 grass; 365/394 also among dirt
    S = 4
    sheet = Image.new('RGB', (16 * 3 * 7 + 6 * 8, 16 * 3), (40, 40, 40))
    dirt = np.array([[dirt_px(x, y) for x in range(16)] for y in range(16)], np.uint8)
    blocks = [(k, GRASS) for k in MASKS] + [('365', dirt), ('394', dirt)]
    for i, (k, fill) in enumerate(blocks):
        for by in range(3):
            for bx in range(3):
                t = tiles[k] if (bx, by) == (1, 1) else fill
                sheet.paste(Image.fromarray(np.ascontiguousarray(t)), (i * (48 + 8) + bx * 16, by * 16))
    sheet.resize((sheet.width * S, sheet.height * S), Image.NEAREST).save(OUT / 'preview_4x.png')

    t = leaf_tones()
    json.dump(t.tolist(), open(OUT / 'joseon_leaf_tones.json', 'w'))
    greens = {1: (24, 44, 30), 2: (38, 66, 40), 3: (52, 88, 48), 4: (70, 112, 56), 5: (96, 138, 66), 6: (132, 168, 84)}
    big = np.tile(t, (3, 3))
    rgb = np.array([[greens[v] for v in row] for row in big], np.uint8)
    Image.fromarray(rgb).resize((96 * 8, 96 * 8), Image.NEAREST).save(OUT / 'leaf_preview.png')
    print('tone counts', {v: int((t == v).sum()) for v in range(1, 7)})


if __name__ == '__main__':
    main()
