# Leaf interior for the forest_harmony_grove_47 canopy ("K · 잎 채움", approved 2026-09-24).
# The canopy used to draw a thin leaf fringe around a flat plate of one dark colour. Every pixel of that flat
# colour is now filled with the fringe's own leaf strip (rows 4..7 of the north-edge tile, mask 110): four strips
# per tile, each rolled and randomly mirrored, plus one crown top from the same tile. Tone by depth:
#   depth 0 (x0.78)  every edge tile — its flat part only, the fringe itself is untouched;
#   depth 1 (x0.60)  a full cell (all 8 neighbours canopy) with open ground within 2 cells, incl. the full-mask tile itself;
#   depth 2 (x0.46)  deeper full cells.
# Which pixels are "flat" comes from the pristine green canopy (tiledata/forest-villages/canopy-leaves/flat-canopy.png),
# so a repainted climate sheet keeps exactly the same fringe. Used by bake-forest-canopy-leaves.py and build-climate-chipsets.py.
import json, pathlib, random
from PIL import Image, ImageChops, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parents[3]
FLAT = ROOT / "tiledata/forest-villages/canopy-leaves/flat-canopy.png"
CANOPY = json.loads((ROOT / "src/assets/forestGroveCanopy.json").read_text())
TONES = tuple(CANOPY["interior"]["tones"])            # depth 0, 1, 2
SEEDS = CANOPY["interior"]["leafSeeds"]               # one leaf texture per seed
FULL = CANOPY["variants"][255]                        # offset of the full-mask tile among the 47
STRIP = CANOPY["variants"][110]                       # offset of the north-edge tile that carries the leaf strip
# Interior variants after the 47 canopy offsets: [depth, texture] for offsets 47.. (the full tile is [1, 0]).
INTERIOR = [tuple(v) for v in CANOPY["interior"]["variants"]]


def flat_tiles():
    """The 47 canopy tiles as they were before the leaf fill, in offset order (the green sheet)."""
    sh = Image.open(FLAT).convert("RGBA")
    return [sh.crop(((i % 30) * 16, (i // 30) * 16, (i % 30) * 16 + 16, (i // 30) * 16 + 16)) for i in range(47)]


def flat_masks():
    """Per offset: the positions that are the flat interior colour (exact match) in the green canopy."""
    tiles = flat_tiles(); fill = tiles[FULL].getpixel((8, 8))
    return [[[tiles[i].getpixel((x, y))[3] > 0 and tiles[i].getpixel((x, y))[:3] == fill[:3] for x in range(16)] for y in range(16)]
            for i in range(47)]


def darken(im, k):
    a = im.split()[3]; out = ImageEnhance.Brightness(im.convert("RGB")).enhance(k).convert("RGBA"); out.putalpha(a); return out


def leaf_tile(north, north_mask, fill, seed, bumps=1):
    """16x16, wraps seamlessly: the strip stacked four times with per-band roll/mirror, plus crown tops."""
    strip = north.crop((0, 4, 16, 8)); rnd = random.Random(seed)
    im = Image.new("RGBA", (16, 16), fill)
    for b in range(4):
        s = ImageChops.offset(strip, rnd.randrange(16), 0)
        if rnd.random() < 0.5: s = s.transpose(Image.FLIP_LEFT_RIGHT)
        im.alpha_composite(s, (0, b * 4))
    bump = north.crop((8, 0, 16, 5)); bp = bump.load()
    for yy in range(5):
        for xx in range(8):
            if north_mask[yy][8 + xx]: bp[xx, yy] = (0, 0, 0, 0)
    for _ in range(bumps):
        x, y = rnd.randrange(16), rnd.randrange(16)
        for ox in (-16, 0):
            for oy in (-16, 0): im.alpha_composite(bump, (x + ox, y + oy))
    return im


def bake(sheet, canopy_ids, interior_ids, per=30, masks=None):
    """Fill one sheet in place. canopy_ids: the 47 canopy slots in offset order, still flat; interior_ids: the
    slots for INTERIOR. The leaf texture and the flat colour come from this sheet's own canopy."""
    masks = masks or flat_masks()
    box = lambda t: ((t % per) * 16, (t // per) * 16)
    tile = lambda t: sheet.crop((*box(t), box(t)[0] + 16, box(t)[1] + 16))
    fill = tile(canopy_ids[FULL]).getpixel((8, 8))
    leaves = [leaf_tile(tile(canopy_ids[STRIP]), masks[STRIP], fill, seed) for seed in SEEDS]
    for off, t in enumerate(canopy_ids):
        if off == FULL:
            sheet.paste(darken(leaves[0], TONES[1]), box(t)); continue
        tex = darken(leaves[off % len(leaves)], TONES[0]).load(); cell = tile(t); px = cell.load()
        for y in range(16):
            for x in range(16):
                if masks[off][y][x]: px[x, y] = tex[x, y]
        sheet.paste(cell, box(t))
    for (depth, v), t in zip(INTERIOR, interior_ids):
        sheet.paste(darken(leaves[v], TONES[depth]), box(t))
    return sheet
