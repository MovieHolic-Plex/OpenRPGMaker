#!/usr/bin/env python3
"""Astra Horizon professor (천문박사) dialogue bust, variant B "older scholar" — pure code hand pixel art.

64x64 RGBA, transparent background. Same hair / coat / shirt as the overworld chip
(ScarloxyPeople14 slot 1): messy medium-brown hair with a cowlick, grey temples and fringe
streaks, blue eyes, white lab coat with wide lapels, navy shirt with a yellow star.
Older than the chip: more grey, crow's feet, under-eye and smile lines, and small thin
half-moon reading glasses sitting low on the nose (1px grey frame, below the eyes).

Run:  python3 scripts/content/monsters/astra_professor_hand/variant_b.py
Writes .omo/astra-prof/hand-b/bust-<expr>.png and hand-b/sheet.png (review sheet: the five
expressions at 4x, then the chip front frame and the hero / mom busts at the same 4x).

BASE is the full 64x64 grid as row strings. Each expression is a list of face-only row
patches (y, x0, chars) laid over BASE. assert_symmetric checks the eye/brow box pixel by
pixel against its mirror (x -> 64 - x) for every expression.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / '.omo/astra-prof/hand-b'

# 16 colours + transparent '.'. Hair, skin, coat, shirt, star and iris are the chip's own colours.
PALETTE = {
    'O': '#23262e',  # outline, pupil, upper lid
    'H': '#874b36',  # hair
    'h': '#5c3022',  # hair shade
    'd': '#381c14',  # hair dark / brows / mouth line
    'G': '#c9c5be',  # grey hair
    'g': '#908a84',  # grey hair shade / glasses frame
    'S': '#f5cca3',  # skin
    's': '#e4b387',  # skin shade, age lines
    'k': '#c38365',  # skin deep shade, lower lid, mouth inside
    'W': '#f2f6fc',  # coat white, eye white, lens glint
    'w': '#d6dfed',  # coat shade
    'v': '#a2adc2',  # coat fold
    'N': '#2e3d6c',  # shirt
    'n': '#1c2546',  # shirt shade
    'Y': '#f2c84b',  # star emblem
    'E': '#2c558c',  # iris
}

BASE = [
    '..................................O.............................',
    '.................................OHO............................',
    '......................O.........OHHO............................',
    '......................OHO......OHHO.......O.....................',
    '......................OHHOOOOOOOHHOOOO...OHO....................',
    '......................OHhHHHHHHHHdhHHHOOOHhO....................',
    '.....................OOHHHHHHddhHdddhHHHHhhOO...................',
    '...................OOHHHHHHddhhhdhhhddhHHhhhOO..................',
    '..................OHHHHHHddhhhHHdhHHhhddhhhhhhO.................',
    '.................OhdHHHHdhhhHHHHdhHHHHhhdhhHHdhO................',
    '................OhdHHhddhhHHHdhHdhHdhHHHhddhHHdhO...............',
    '...............OhhdHHhhhhHHHdhhHdhHhdhHHHhhhHHdhhO..............',
    '...............OhdHHhdhHHHHdhhHHdhHHhdhHHhhdhHHdhhO.............',
    '..............OhhdHHhdHHHGdhhHHHdhHHHhdGghhdhHHdhHHO............',
    '..............OhdHHhdGHHGdhhHHHHdhHHHHhdGghGdhHHdOO.............',
    '.............OhhdHHhhGHHGghHHHHHhhHHHHHhGghGhhHHdhO.............',
    '............OhhdHHhhGGHGdhHHHHHHHHHHHhhHdGgGGhhHHdO.............',
    '.............OOdHHghGGHGghHHHHHHdHHHHhhhHGgGGhgHHdhO............',
    '..............OHHghGGgGdhHHHHHHdsdHHhHhhhdGgGGhgHHdO............',
    '.............OdHGghGGgGghHHHHHdsSsdHhHhhhhGgGGhgGHdhO...........',
    '.............OHGghGGghdhHHHHHHsSSSsHhhHhhhdhgGGhgGHdhO..........',
    '............OdGGghGGghhhHHHdHdSSSSSdhdHhhhhhgGGhgGGOO...........',
    '...........OdHGghGGghGhHHHdsHsSsssSshsdHhhhGhgGGhgO.............',
    '............OOGgdGGgdGhhhhsSdSSSSSSSdSshhhhGdgGGdgO.............',
    '..............OdGGgdGGhdhdSSsSSSSSSSsSSdhdhGGdgGGdgO............',
    '..............OdGGgdGGdsdsSSSSSSSSSSSSSsdsdGGdgGGdgO............',
    '.............OdGGgdGGgsSshSSSSSSSSSSSSShsSsgGGdgGGdhO...........',
    '.............OdGGgdGGgSdddddhSSSSSSShdddddSgGGdgGGOO............',
    '............OdGGgdGGghdSSSSSSSSSSSSSSSSSSSdhgGGdgGO.............',
    '.............OOGgdGGsSSSSSSSSSSSSSSSSSSSSSSSsGGdgO..............',
    '...............OSOOsSSOOOOOSSSSSSSSSSSOOOOOSSsOOSO..............',
    '...............OSksssOWOOOWSSSSSSSSSSSWOOOWOssskSO..............',
    '...............OSkssSSWWOEWSSSSSSSSSSSWEOWWSSsskSO..............',
    '...............OSksssSWEOEWSSSSSSSSSSSWEOEWSssskSO..............',
    '...............OSkssSSsEEEsSSSSSSSSSSSsEEEsSSsskSO..............',
    '...............OSsssSSSkkkSSSSSSSSSSSSSkkkSSSsssSO..............',
    '...............OSssggSSsssSSSgggggggSSSsssSSggssSO..............',
    '................OsssSggggggggSSSSSSSggggggggSsssO...............',
    '.................OOsSGSSSSSGSSSSSsSSSGSSSSsGSsOO................',
    '...................OsGSSSSSGSSSSSsSSSGSSSSSGsO..................',
    '...................OsSGGGGGsSSssSksSSsGGGGGssO..................',
    '....................OsSSSSSSkSSSsSSSkSSSSSssO...................',
    '....................OsSSSSSSSdSSSSSdSSSSSSssO...................',
    '.....................OsSSSSSSSdddddSSSSSSssO....................',
    '......................OsSSSSSSSsssSSSSSSssO.....................',
    '.......................OsSSSSSSSSSSSSSSssO......................',
    '........................OsSSSssssssSSSSsO.......................',
    '..........................OOSSSSSSSSSOO.........................',
    '............................OOOOOOOOO...........................',
    '......................OOWWWwOkkkkkkkOwWWWOO.....................',
    '..................OWWWWWWWONNkssssskNNOWWWWWWWO.................',
    '...............OWWWWWWWWWWWONnOsssOnNOWWWWWWWWWWWO..............',
    '.............OOWWWWWWWWWWwWONNNOsONNNOWwWWWWWWWWWWOO............',
    '...........OWWOWWWWWWWWWWwWOnNNNONNNnOWwWWWWWWWWWWOWWO..........',
    '..........OWWWWOWWWWWWWWWwWOnONNNNNOnOWwWWWWWWWWWOWWWWO.........',
    '.........OWWWWwvOOWWWWWWWwWOnNOnNnONnOWwWWWWWWWOOvwWWWWO........',
    '........OWWWWwwwwvOWWWWWWwWOnNNNNNNNnOWwWWWWWWOvwwwwWWWWO.......',
    '.......OWvWWwwwwwwvOWWWWWwWOnNNNYNNNnOWwWWWWWOvwwwwwwWWvWO......',
    '......OvvvwwwwwwwwwvOWWWWwWOnNYYYYYNnOWwWWWWOvwwwwwwwwwvvvO.....',
    '.....OvvwwvwwwwwwwwwvOWWWwOnNNNYYYNNNnOwWWWOvwwwwwwwwwvwwvvO....',
    '....OvvwwwvwwwwwwwwwwvOWWwOnNNNYNYNNNnOwWWOvwwwwwwwwwwvwwwvvO...',
    '....OvvwwwwvwwwwwwwwwvOWwWOnNNNNNNNNNnOWwWOvwwwwwwwwwvwwwwvvO...',
    '...OvvwwwwwvwwwwwwwwwwvOwWOnNNNNNNNNNnOWwOvwwwwwwwwwwvwwwwwvvO..',
    '...OvvwwwwwwvwwwwwwwwwvOwwOnNNNNNNNNNnOwwOvwwwwwwwwwvwwwwwwvvO..',
]

# Face-only overrides: (y, x0, chars) written over BASE.  Eyes/brows are symmetric about x = 32.
EXPRESSIONS = {
    'base': [],
    'happy': [
        (30, 22, 'SOOOSSSSSSSSSSSSSOOOS'),
        (31, 20, 'kSOWOEOSSSSSSSSSSSOEOWOSk'),
        (32, 21, 'OWEOEWSSSSSSSSSSSWEOEWO'),
        (33, 20, 'kSkkkkkSSSSSSSSSSSkkkkkSk'),
        (34, 21, 'sSsssSSSSSSSSSSSSSsssSs'),
        (35, 23, 'SSSSSSSSSSSSSSSSSSS'),
        (40, 28, 'sSssSksSs'),
        (41, 27, 'sdSSSSSSSds'),
        (42, 30, 'ddddd'),
        (43, 31, 'kkk'),
        (44, 31, 'ddd'),
    ],
    'sad': [
        (26, 22, 'SSSSSdhSSSSSSShdSSSSS'),
        (27, 23, 'SSddSSSSSSSSSSSddSS'),
        (28, 21, 'SSddSSSSSSSSSSSSSSSddSS'),
        (29, 21, 'hdSSSSSSSSSSSSSSSSSSSdh'),
        (30, 22, 'SOOOOSSSSSSSSSSSOOOOS'),
        (31, 21, 'SOOOOWSSSSSSSSSSSWOOOOS'),
        (42, 29, 'SdddddS'),
        (43, 29, 'dsssssd'),
        (44, 28, 'sSSSSSSSs'),
    ],
    'angry': [
        (26, 22, 'SSSSSSSSSSSSSSSSSSSSS'),
        (27, 22, 'ddSSSSSSSSSSSSSSSSSdd'),
        (28, 21, 'SSSddSSsSSSSSSSsSSddSSS'),
        (29, 26, 'ddhSSSSSSShdd'),
        (31, 26, 'OSSSSSSSSSSSO'),
        (40, 29, 'sssSkss'),
        (42, 29, 'SSSSSSS'),
        (43, 29, 'ddddddd'),
        (44, 30, 'sssss'),
    ],
    'surprised': [
        (25, 22, 'SdddddSSSSSSSSSdddddS'),
        (26, 22, 'hSSSSSSSSSSSSSSSSSSSh'),
        (27, 23, 'SSSSSSSSSSSSSSSSSSS'),
        (28, 21, 'SOOOOOSSSSSSSSSSSOOOOOS'),
        (29, 21, 'OWOOOWSSSSSSSSSSSWOOOWO'),
        (30, 20, 'kSWWOEWSSSSSSSSSSSWEOWWSk'),
        (31, 20, 'SSWEOEWSSSSSSSSSSSWEOEWSS'),
        (32, 19, 'SkSWEEEWSSSSSSSSSSSWEEEWSkS'),
        (33, 20, 'SSsWWWsSSSSSSSSSSSsWWWsSS'),
        (34, 19, 'SSSSkkkSSSSSSSSSSSSSkkkSSSS'),
        (35, 23, 'SSSSSSSSSSSSSSSSSSS'),
        (41, 28, 'sSSdddSSs'),
        (42, 29, 'SdkkkdS'),
        (43, 31, 'kkk'),
        (44, 31, 'ddd'),
    ],
}
FACE_BOX = (17, 24, 47, 47)   # x0, y0, x1, y1 — overrides must stay inside the face
EYE_BOX = (21, 25, 30, 36)    # left eye + brow; mirrored onto x -> 64 - x


def grid_for(expr):
    g = [list(r) for r in BASE]
    x0b, y0b, x1b, y1b = FACE_BOX
    for y, x0, chars in EXPRESSIONS[expr]:
        assert y0b <= y <= y1b and x0b <= x0 and x0 + len(chars) - 1 <= x1b, (expr, y, x0)
        for i, c in enumerate(chars):
            g[y][x0 + i] = c
    return g


def assert_symmetric(g, expr):
    x0, y0, x1, y1 = EYE_BOX
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            assert g[y][x] == g[y][64 - x], f'{expr}: eye asymmetry at ({x},{y}) {g[y][x]!r} vs ({64 - x},{y}) {g[y][64 - x]!r}'


def hex_rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def render(g):
    im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for y, row in enumerate(g):
        for x, c in enumerate(row):
            if c != '.':
                im.putpixel((x, y), hex_rgba(PALETTE[c]))
    return im


def chip_front():
    sheet = Image.open(ROOT / 'public/assets/generated/charsets/ScarloxyPeople14.png').convert('RGBA')
    return sheet.crop((72 + 24, 64, 72 + 48, 96))  # slot 1, facing down, standing frame


def make_sheet(busts):
    S, pad, bg = 4, 12, (226, 234, 222, 255)
    order = ['base', 'happy', 'sad', 'angry', 'surprised']
    refs = [chip_front()] + [Image.open(ROOT / f'public/assets/emerald-monster/cast/{n}/bust-base.png').convert('RGBA')
                             for n in ('hero', 'mom')]
    w = pad + len(order) * (64 * S + pad)
    h = pad + 2 * (64 * S + pad)
    sheet = Image.new('RGBA', (w, h), bg)
    for i, e in enumerate(order):
        sheet.alpha_composite(busts[e].resize((64 * S, 64 * S), Image.NEAREST), (pad + i * (64 * S + pad), pad))
    y = pad * 2 + 64 * S
    tiles = [busts['base']] + refs
    for i, t in enumerate(tiles):
        big = t.resize((t.width * S, t.height * S), Image.NEAREST)
        x = pad + i * (64 * S + pad)
        sheet.alpha_composite(big, (x + (64 * S - big.width) // 2, y + (64 * S - big.height)))
    return sheet


def main():
    assert len(PALETTE) <= 16
    assert len(BASE) == 64 and all(len(r) == 64 for r in BASE)
    used = set(''.join(BASE)) - {'.'}
    assert used <= set(PALETTE), used - set(PALETTE)
    OUT.mkdir(parents=True, exist_ok=True)
    busts = {}
    for e in EXPRESSIONS:
        g = grid_for(e)
        assert_symmetric(g, e)
        busts[e] = render(g)
        busts[e].save(OUT / f'bust-{e}.png')
    make_sheet(busts).save(OUT / 'sheet.png')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
