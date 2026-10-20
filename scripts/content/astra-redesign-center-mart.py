#!/usr/bin/env python3
"""Astra Horizon: redesign the center / mart exteriors in the shared monster-kit sheets.

Center: teal hip roof (flat top + gold star finial), cream walls, gold star plaque (was a red cross).
Mart:   amber wide flat roof, star-coin plaque (was a bag), "SHOP" sign (was MART).
Each kit is 4x4 tiles (64x64 px). Idempotent enough to re-run on an already redesigned sheet.
Usage: python3 scripts/content/astra-redesign-center-mart.py [--dry out.png]
"""
import re
import sys
from PIL import Image

KIT = 'public/assets/monster-kit/monster-%s.png'
# (sheet, base tile, kind, cut row)
# APPEND-ONLY: the redesigned kits become NEW tile cells at the bottom of the shared overworld sheet.
# Old cells (ids < OLD_COUNT) are never touched, so other projects keep their art.
OLD_COUNT = 2224
SHEET = 'overworld'
# (source base, new base, kind, cut row)
KITS = [(1344, 2224, 'center', 6), (1360, 2240, 'mart', 11)]
JSON_PATH = 'src/assets/monsterKit/monster-overworld.json'
INDEX_PATH = 'src/assets/monsterKit/index.json'
OUTLINE = (56, 60, 88, 255)
T = (0, 0, 0, 0)

CENTER_MAP = {  # red roof -> teal, pink wall -> cream
    (199, 46, 37): (30, 128, 124), (240, 85, 69): (52, 168, 152), (251, 116, 102): (96, 200, 184),
    (154, 2, 0): (16, 88, 96), (100, 1, 0): (10, 56, 70),
    (233, 133, 147): (222, 196, 140), (243, 165, 166): (236, 214, 160), (250, 199, 194): (246, 236, 196),
}
MART_ROOF_MAP = {  # blue roof -> amber (roof rows only)
    (1, 130, 224): (214, 128, 32), (23, 154, 235): (240, 168, 56), (42, 181, 242): (252, 204, 104),
    (0, 106, 181): (160, 84, 20), (0, 77, 133): (112, 52, 16),
}
STAR = ["....#....", "...###...", "...###...", "#########", ".#######.",
        "..#####..", "..#####..", ".###.###.", ".##...##."]
STAR5 = ["..#..", ".###.", "#####", ".#.#.", "#...#"]
LETTERS = {  # 3x5
    'S': ["###", "#..", "###", "..#", "###"], 'H': ["#.#", "#.#", "###", "#.#", "#.#"],
    'O': ["###", "#.#", "#.#", "#.#", "###"], 'P': ["###", "#.#", "###", "#..", "#.."],
}


def load_kit(sheet, base):
    im = Image.open(KIT % sheet).convert('RGBA')
    cols = im.width // 16
    k = Image.new('RGBA', (64, 64), T)
    for i in range(16):
        t = base + i
        c, r = t % cols, t // cols
        k.paste(im.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), ((i % 4) * 16, (i // 4) * 16))
    return im, cols, k


def store_kit(im, cols, k, base):
    for i in range(16):
        t = base + i
        c, r = t % cols, t // cols
        im.paste(k.crop(((i % 4) * 16, (i // 4) * 16, (i % 4) * 16 + 16, (i // 4) * 16 + 16)), (c * 16, r * 16))


def draw(k, bitmap, x0, y0, col, hi=None):
    for dy, row in enumerate(bitmap):
        for dx, ch in enumerate(row):
            if ch == '#':
                c = col
                if hi and dy <= 1 + (dx < len(row) // 2) and dx < len(row) // 2 + 1 and dy < len(bitmap) // 2:
                    c = hi
                k.putpixel((x0 + dx, y0 + dy), c + (255,))


def recolor(k, mp, y_max=64):
    for y in range(min(y_max, 64)):
        for x in range(64):
            p = k.getpixel((x, y))
            if p[3] and p[:3] in mp:
                k.putpixel((x, y), mp[p[:3]] + (255,))


def cut_top(k, cut):
    for y in range(cut):
        for x in range(64):
            k.putpixel((x, y), T)
    for x in range(64):
        if k.getpixel((x, cut))[3]:
            k.putpixel((x, cut), OUTLINE)


def center(k, cut):
    recolor(k, CENTER_MAP)
    # plaque: circle centre (31.5,21.5): navy field, gold rim, gold star
    for y in range(14, 30):
        for x in range(24, 40):
            d2 = (x - 31.5) ** 2 + (y - 21.5) ** 2
            if not k.getpixel((x, y))[3]:
                continue
            if d2 <= 5.7 ** 2:
                k.putpixel((x, y), (34, 44, 98, 255))
            elif d2 <= 6.9 ** 2:
                k.putpixel((x, y), (232, 188, 70, 255))
    draw(k, STAR, 27, 17, (250, 222, 110), (255, 246, 190))
    cut_top(k, cut)
    # star finial on the flat top (dark outline then gold)
    for dy, row in enumerate(STAR5):
        for dx, ch in enumerate(row):
            if ch == '#':
                k.putpixel((30 + dx, 1 + dy), (250, 222, 110, 255))
    for dy in range(-1, 6):
        for dx in range(-1, 6):
            x, y = 30 + dx, 1 + dy
            if 0 <= x < 64 and 0 <= y < 64 and not k.getpixel((x, y))[3]:
                n = [(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if any(0 <= nx < 64 and 0 <= ny < 64 and k.getpixel((nx, ny))[3] and k.getpixel((nx, ny))[:3] == (250, 222, 110) for nx, ny in n):
                    k.putpixel((x, y), OUTLINE)


def mart(k, cut):
    recolor(k, MART_ROOF_MAP, y_max=40)
    # plaque: clear the bag, draw a star on the white plate
    for y in range(16, 26):
        for x in range(27, 38):
            k.putpixel((x, y), (244, 254, 250, 255))
    draw(k, STAR, 28, 16, (214, 128, 32))
    # sign: replace MART letters with SHOP, amber underline
    for y in range(41, 48):
        for x in range(37, 56):
            p = k.getpixel((x, y))
            if p[3] and p[:3] == (0, 106, 181):
                k.putpixel((x, y), (244, 254, 250, 255))
    x = 39
    for ch in 'SHOP':
        draw(k, LETTERS[ch], x, 42, (160, 84, 20))
        x += 4
    for y in range(41, 52):
        for xx in range(36, 57):
            p = k.getpixel((xx, y))
            if p[3] and p[:3] == (199, 46, 37):
                k.putpixel((xx, y), (240, 168, 56, 255))
    cut_top(k, cut)


def main():
    import json
    dry = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == '--dry' else None
    path = KIT % SHEET
    im = Image.open(path).convert('RGBA')
    cols = im.width // 16
    old = im.crop((0, 0, im.width, OLD_COUNT // cols * 16))  # pristine old cells
    new_count = OLD_COUNT + 16 * len(KITS)
    out = Image.new('RGBA', (im.width, new_count // cols * 16), T)
    out.paste(old, (0, 0))
    kits_out, befores = [], []
    for src, dst, kind, cut in KITS:
        _, _, k0 = load_kit_from(old, cols, src)
        k = k0.copy()
        (center if kind == 'center' else mart)(k, cut)
        store_kit(out, cols, k, dst)
        kits_out.append(k)
        befores.append(k0)
    if dry:
        sheet = Image.new('RGBA', (len(kits_out) * 68, 140), (88, 128, 80, 255))
        for i, (k0, k) in enumerate(zip(befores, kits_out)):
            sheet.alpha_composite(k0, (i * 68 + 2, 2))
            sheet.alpha_composite(k, (i * 68 + 2, 72))
        sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(dry)
        return
    out.save(path)
    print('wrote', path, out.size)
    d = json.load(open(JSON_PATH))
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        del d[key][OLD_COUNT:]
        for src, dst, kind, cut in KITS:
            for i in range(16):
                v = d[key][src + i]
                d[key].append(json.loads(json.dumps(v)))
    d['count'] = new_count
    json.dump(d, open(JSON_PATH, 'w'), ensure_ascii=False, separators=(',', ':'))
    txt = open(INDEX_PATH).read()
    txt = re.sub(r'("id": "monster_overworld".*?"count": )\d+', lambda m: m.group(1) + str(new_count), txt, count=1, flags=re.S)
    open(INDEX_PATH, 'w').write(txt)
    print('json count ->', new_count)


def load_kit_from(im, cols, base):
    k = Image.new('RGBA', (64, 64), T)
    for i in range(16):
        t = base + i
        c, r = t % cols, t // cols
        k.paste(im.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), ((i % 4) * 16, (i // 4) * 16))
    return im, cols, k


if __name__ == '__main__':
    main()
