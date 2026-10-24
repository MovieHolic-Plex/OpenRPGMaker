#!/usr/bin/env python3
"""Astra Horizon professor (천문박사) dialogue bust, variant A "faithful" — pure code hand pixel art.

64x64 RGBA, transparent background. Matches the overworld chip (ScarloxyPeople14 slot 1):
messy medium-brown hair with a cowlick, grey temple streaks, blue eyes, no glasses,
white lab coat with wide collar flaps, navy shirt with a yellow star.

Run:  python3 scripts/content/monsters/astra_professor_hand/variant_a.py
Writes .omo/astra-prof/hand-a/bust-<expr>.png and hand-a/sheet.png (review sheet).

Expressions are face-only overrides of BASE. Eye and brow patches are authored for the
viewer-left eye and mirrored onto the right eye, so both eyes are always pixel-symmetric
(checked by assert_symmetric). Mouth patches are authored full-width and symmetric.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / '.omo/astra-prof/hand-a'

# 16 colours + transparent '.'. Hair/skin/coat/shirt/eye colours are the chip's own.
PALETTE = {
    'k': '#381c14',  # dark outline / lash / brow core
    'g': '#5c3022',  # hair shadow, brows, mouth interior
    'h': '#874b36',  # hair
    'l': '#a15d4a',  # hair highlight
    'w': '#b9b5ae',  # grey streak
    's': '#f5cca3',  # skin
    'S': '#e4b387',  # skin shade
    'q': '#c38365',  # skin deep shade / mouth line
    'e': '#2c558c',  # iris
    'E': '#64a0dc',  # iris light
    'c': '#f2f6fc',  # coat white / eye white / grey highlight
    'C': '#d6dfed',  # coat shade
    'B': '#9fadc6',  # coat fold
    'n': '#2e3d6c',  # shirt
    'N': '#1c2546',  # clothes outline / pupil
    'y': '#f2c84b',  # star emblem
}

BASE = [
    ".................................kkk............................",
    "................................khlhk...........................",
    "............................kkkkhhkk............................",
    ".........................kkkhhllglhhkkk.........................",
    ".......................kkhhllllhhllllhhkk.......................",
    ".....................kkhhllllhhhhhhllllhhkk.....................",
    "....................khhlllhhhhghhghhhhlllhhk....................",
    "..................khhlllhhhhhhhhhhhhhhhhlllhhk..................",
    ".................khhllhhglhhhglhhlghhhlghhllhhk.................",
    "................khhlhhhgllhhgllhhllghhllghhhlhhk................",
    "...............kghhglhgllhhgllhgghllghhllghlghhgk...............",
    "...............kghglhgllhhhglhhgghhlghhhllghlghgk...............",
    "..............kghglhhglhhhglhhhgghhhlghhhlghhlghgk..............",
    "..............kgglhhglhhhhglhhhgghhhlghhhhlghhlggk..............",
    ".............kghglhhglhhhglhhhhgghhhhlghhhlghhlghgk.............",
    "...........kkghglhhhglhhhghhhhgkkghhhhghhhlghhhlghgkk...........",
    "..........kgghhglhhhglhhhghhhgkSSkghhhghhhlghhhlghhggk..........",
    "............kwwwwwcghlhhghhhhgkSSkghhhhghhlhgcwwwwwk............",
    ".............kwwwwcghlhhghhhgkSssSkghhhghhlhgcwwwwk.............",
    ".............kwwwchghhlhghhhgkSssSkghhhghlhhghcwwwk.............",
    "...........kkwwwwchghhhlghhgkSssssSkghhglhhhghcwwwwkk...........",
    "..........kggwwwchwghhhgkhhgkSssssSkghhkghhhgwhcwwwggk..........",
    "............kwwwchwghhhkSghkSssssssSkhgSkhhhgwhcwwwk............",
    ".............kwchwwkhhgkskgkSssssssSkgkskghhkwwhcwk.............",
    ".............kwchwhkghkSsskSssssssssSkssSkhgkhwhcwk.............",
    ".............kchwwkSkgkSssssssssssssssssSkgkSkwwhck.............",
    ".............kchwhkSSkSssssssssssssssssssSkSSkhwhck.............",
    ".............khwhksssSggggggssssssssggggggSssskhwhk.............",
    "..............khggsssgssssssssssssssssssssgsssgghk..............",
    ".............kSSSwSssssssssssssssssssssssssssSwSSSk.............",
    ".............ksSSwSSsssSSSSssssssssssSSSSsssSSwSSsk.............",
    ".............ksSSwSSsskkkkksssssssssskkkkkssSSwSSsk.............",
    ".............ksSqhSSskkcNNcksssssssskcNNckksSShqSsk.............",
    ".............ksSqkSSSskcNkecsssssssscekNcksSSSkqSsk.............",
    ".............ksSqkSSSssceEecssssssssceEecssSSSkqSsk.............",
    ".............ksSSkSSSssSeeSsssSssssssSeeSssSSSkSSsk.............",
    ".............kSsskSSSssSSSSsssSssssssSSSSssSSSkssSk.............",
    "..............kkkkkSSSsssssSssSsssssSsssssSSSkkkkk..............",
    ".................kkSSSssssSsssSqqSsssSssssSSSkk.................",
    "...................kSSSsssSssssssssssSsssSSSk...................",
    "....................kqSSssSSssssssssSSssSSqk....................",
    ".....................kqSSsssqssssssqsssSSqk.....................",
    "......................kqSssssqqqqqqssssSqk......................",
    ".....................NNkqSssssSSSSssssSqkNN.....................",
    ".....................NcckqSSssssssssSSqkccN.....................",
    "....................NCccckqSSSssssSSSqkcccCN....................",
    "....................NCccckSkSssssssSkSkcccCN....................",
    "...................NcCccckSSkkkkkkkkSSkcccCcN...................",
    "...................NcCccckSSSSSSSSSSSSkcccCcN...................",
    "...............NNNBccccccnnnNssssssNnnnccccccBNNN...............",
    "...........NNNNCCCBccccccnnNnNssssNnNnnccccccBCCCNNNN...........",
    "........NNNCCCCCCCBccccccknnNnNssNnNnnkccccccBCCCCCCCNNN........",
    "......NNCCCCCCCCCCCBcccccNnnnnnNNnnnnnNcccccBCCCCCCCCCCCNN......",
    ".....NCCCCCCCCCCCCCBcccccNnnnnnnnnnnnnNcccccBCCCCCCCCCCCCCN.....",
    "....NCCCCCCCCCCCCCCCBccccNnnnnnyynnnnnNccccBCCCCCCCCCCCCCCCN....",
    "...NCCCCCCCCCCCCCCCCBccccNnnnnyyyynnnnNccccBCCCCCCCCCCCCCCCCN...",
    "..NBCCCCCCCCCCCCCCCCBcccccNnnyyyyyynnNcccccBCCCCCCCCCCCCCCCCBN..",
    "..NBCCCCCBCCCCCCCCCCCBccccNnnnyyyynnnNccccBCCCCCCCCCCCBCCCCCBN..",
    "..NBCCCCCBCCCCCCCCCCCBccccNnnnynnynnnNccccBCCCCCCCCCCCBCCCCCBN..",
    "..NBCCCCCBCCCCCCCCCCCCBcccNnnnnnnnnnnNcccBCCCCCCCCCCCCBCCCCCBN..",
    "..NBCCCCCBCCCCCCCCCCCCBcccNnnnnnnnnnnNcccBCCCCCCCCCCCCBCCCCCBN..",
    "..NBCCCCCCBCCCCCCCCCCCBcccNnnnnnnnnnnNcccBCCCCCCCCCCCBCCCCCCBN..",
    "..NBCCCCCCBCCCCCCCCCCCCBccNnnnnnnnnnnNccBCCCCCCCCCCCCBCCCCCCBN..",
    "..NBCCCCCCBCCCCCCCCCCCCBcccNnnnnnnnnNcccBCCCCCCCCCCCCBCCCCCCBN..",
]

# ---------------------------------------------------------------- expressions
# Each patch: (x0, y0, rows). ' ' keeps the base pixel. EYE/BROW patches are for the
# viewer-left side and are mirrored (x -> 63-x). MOUTH patches are stamped as-is.
EYE_X, EYE_Y = 20, 29      # box x20..28, y29..36 (fully explicit: replaces the base eye)
BROW_X, BROW_Y = 20, 26    # box x20..28, y26..29 (' ' keeps hair tips)
MOUTH_X, MOUTH_Y = 26, 39  # box x26..37, y39..43 (fully explicit)

EYES = {
    # calm: lid crease, lash arc, 3px iris with a glint, soft lower lid, crow's foot (q)
    'base': [
        "sssSSSSss",
        "ssskkkkss",
        "sskkkkkks",
        "SkkcNcNks",
        "sskcekecs",
        "SssceEecs",
        "sssSEEESs",
        "ssssSSSss",
    ],
    # warm smile: cheeks lift the lower lid into a soft arc, crow's feet deepen
    'happy': [
        "sssSSSSss",
        "ssskkkkss",
        "sskkkkkks",
        "qkkcNcNks",
        "qsSceEeSs",
        "qssSSSSss",
        "sssssssss",
        "sssssssss",
    ],
    # tired: lid lowered one row, eyes looking a little down
    'sad': [
        "sssssssss",
        "sssssssss",
        "sssSSSSss",
        "skkkkkkks",
        "sskcNNNcs",
        "ssscekecs",
        "sssSEEESs",
        "ssssSSSss",
    ],
    # stern: heavy flat lid pressing the eye narrower
    'angry': [
        "sssssssss",
        "sssssssss",
        "ssskkkkks",
        "skkkkkkks",
        "sskcNkNcs",
        "ssscEeEcs",
        "ssssSSSss",
        "sssssssss",
    ],
    # widened evenly: lid raised, white all round, small iris
    'surprised': [
        "sssssssss",
        "ssskkkkss",
        "sskcccc" + "ks",
        "sskcNNcks",
        "sskceEcks",
        "ssScEEcSs",
        "sssSccSss",
        "ssssSSsss",
    ],
}

BROWS = {
    'base': [
        "  ssgggss",
        "sSggggggs",
        "sgsssssss",
        "         ",
    ],
    'happy': [
        "  sggggss",
        "sSgssssgs",
        "sssssssss",
        "         ",
    ],
    # inner end raised, outer end dropped
    'sad': [
        "  ssssggs",
        "sSssggsss",
        "sggssssss",
        "         ",
    ],
    # inner end pressed down
    'angry': [
        "  sssssss",
        "sSgggssss",
        "sssssggss",
        "sssssssgS",
    ],
    'surprised': [
        "  sgggggs",
        "sSgssssss",
        "sssssssss",
        "         ",
    ],
}

MOUTHS = {
    'base': [
        "SssssssssssS",
        "SssssssssssS",
        "sqssssssssqs",
        "ssqqqqqqqqss",
        "ssssSSSSssss",
    ],
    'happy': [
        "SssssssssssS",
        "SqssssssssqS",
        "sskkkkkkkkss",
        "ssskgqqgksss",
        "sssskkkkssss",
    ],
    'sad': [
        "ssssssssssss",
        "ssssssssssss",
        "ssssssssssss",
        "ssssqqqqssss",
        "sssqssssqsss",
    ],
    'angry': [
        "ssssssssssss",
        "ssssssssssss",
        "ssssssssssss",
        "ssqqqqqqqqss",
        "sssssSSsssss",
    ],
    'surprised': [
        "ssssssssssss",
        "sssssqqsssss",
        "ssssqggqssss",
        "ssssqggqssss",
        "sssssqqsssss",
    ],
}

EXPRESSIONS = ['base', 'happy', 'sad', 'angry', 'surprised']


def hex_rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def grid_for(expr):
    g = [list(r) for r in BASE]
    assert len(g) == 64 and all(len(r) == 64 for r in g), 'BASE must be 64x64'

    def stamp(x0, y0, rows, mirror):
        assert len({len(r) for r in rows}) == 1, f'ragged patch at {(x0, y0)}'
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == ' ':
                    continue
                g[y0 + j][x0 + i] = ch
                if mirror:
                    g[y0 + j][63 - (x0 + i)] = ch

    stamp(EYE_X, EYE_Y, EYES['base'], True)
    stamp(BROW_X, BROW_Y, BROWS['base'], True)
    stamp(MOUTH_X, MOUTH_Y, MOUTHS['base'], False)
    if expr != 'base':
        stamp(EYE_X, EYE_Y, EYES[expr], True)
        stamp(BROW_X, BROW_Y, BROWS[expr], True)
        stamp(MOUTH_X, MOUTH_Y, MOUTHS[expr], False)
    return g


def assert_symmetric(g, expr):
    for y in range(BROW_Y - 1, EYE_Y + len(EYES['base'])):
        for x in range(EYE_X - 2, 29):
            assert g[y][x] == g[y][63 - x], f'{expr}: eye/brow asymmetric at ({x},{y})'
    for y in range(MOUTH_Y, MOUTH_Y + len(MOUTHS['base'])):
        for x in range(MOUTH_X, 32):
            assert g[y][x] == g[y][63 - x], f'{expr}: mouth asymmetric at ({x},{y})'


def render(g):
    im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.':
                im.putpixel((x, y), hex_rgba(PALETTE[ch]))
    return im


def chip_front():
    sheet = Image.open(ROOT / 'public/assets/generated/charsets/ScarloxyPeople14.png').convert('RGBA')
    return sheet.crop((72 + 24, 64, 72 + 48, 96))  # slot 1, facing down, standing frame


def make_sheet(busts):
    S = 4
    pad = 12
    bg = (226, 234, 220, 255)
    cast = ROOT / 'public/assets/emerald-monster/cast'
    refs = [('chip', chip_front()),
            ('hero', Image.open(cast / 'hero/bust-base.png').convert('RGBA')),
            ('mom', Image.open(cast / 'mom/bust-base.png').convert('RGBA'))]
    w = pad + 5 * (64 * S + pad)
    h = pad + 2 * (64 * S + pad)
    sheet = Image.new('RGBA', (w, h), bg)
    for i, e in enumerate(EXPRESSIONS):
        sheet.alpha_composite(busts[e].resize((64 * S, 64 * S), Image.NEAREST), (pad + i * (64 * S + pad), pad))
    x = pad
    y = pad * 2 + 64 * S
    for name, im in refs:
        big = im.resize((im.width * S, im.height * S), Image.NEAREST)
        sheet.alpha_composite(big, (x, y + (64 * S - big.height)))
        x += big.width + pad
    # same-scale side-by-side: professor base next to hero/mom
    sheet.alpha_composite(busts['base'].resize((64 * S, 64 * S), Image.NEAREST), (x, y))
    return sheet


def main():
    for ch in ''.join(BASE):
        assert ch == '.' or ch in PALETTE, f'unknown palette char {ch!r}'
    assert len(PALETTE) <= 16
    OUT.mkdir(parents=True, exist_ok=True)
    busts = {}
    for e in EXPRESSIONS:
        g = grid_for(e)
        assert_symmetric(g, e)
        im = render(g)
        im.save(OUT / f'bust-{e}.png')
        busts[e] = im
    make_sheet(busts).save(OUT / 'sheet.png')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
