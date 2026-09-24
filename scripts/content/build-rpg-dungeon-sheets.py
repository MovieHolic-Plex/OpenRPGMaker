"""Repaint the EasyRPG dungeon chipset into three reference sheets with the SAME tile numbers
(the climate-sheet method: bake once, recolour pixels, keep numbering and walkability).

  desert-chipset.png  sandstone walls, rim and floors for the pyramid
  sea-chipset.png     blue-green sea rock, pale seabed, brown rock props turned into coral
  lair-chipset.png    the dungeon sheet as is, except rubble and boulders turned into gold and one egg
  cave-chipset.png    the dungeon sheet as is, except the chasm autotile filled with water: a pool with a
                      rough rock lip instead of the canal's squared stone rim (caves, the mine)
  (sea-chipset.png gets the same water-filled chasm, in sea colours)

Usage: python3 scripts/content/build-rpg-dungeon-sheets.py   (writes public/assets/rpg-dungeons/)
"""
import colorsys
from PIL import ImageDraw
import json
import os

from PIL import Image

SRC = "public/assets/easyrpg-chipset-dungeon-transparent.png"
OUT = "public/assets/rpg-dungeons"
COLS = 30


def span(*ranges):
    out = []
    for r in ranges:
        if isinstance(r, int):
            out.append(r)
        else:
            out.extend(range(r[0], r[1] + 1))
    return out


EARTH_WALLS = span((21, 23), (51, 53), (225, 227), (132, 134), (162, 164), (192, 194), (222, 223), (255, 257))
STONE_FLOOR = span((126, 131), (156, 161), (186, 191), (216, 221))
RIM_GRAY = span((369, 371), (399, 401), (429, 431), (459, 461))
TEAL = span((18, 20), (48, 50))
PLATFORM = span((405, 407), (435, 437), (465, 467))
STONE_CLIFF = span((432, 434), (462, 464))
STATUES = span((145, 148), 175, 176, 446, 476, (438, 440), (468, 470), (24, 26), 444, 445, 474, 475)
BARS = span((204, 206), (234, 236))
BOULDERS_GRAY = span(290, 291, 261, 322, 323, 352, 353, 382, 383)
BOULDERS_BROWN = span(258, 288, 259, 260, 318, 319, 348, 349, 412)
DIRT = span((360, 362), (390, 392), (420, 422), (450, 452))

# Dark → light colour ramps; a pixel keeps its relative brightness inside the tile family.
SAND_WALL = [(46, 28, 18), (98, 62, 34), (150, 104, 58), (196, 150, 92), (228, 196, 136), (248, 228, 182)]
SAND_FLOOR = [(70, 50, 30), (140, 104, 62), (196, 158, 100), (222, 190, 132), (240, 218, 168), (252, 240, 206)]
SAND_STONE = [(40, 30, 22), (104, 80, 56), (170, 138, 96), (210, 180, 130), (236, 214, 170), (252, 244, 220)]
SEA_ROCK = [(6, 16, 32), (14, 40, 66), (24, 72, 98), (40, 108, 124), (78, 150, 154), (140, 200, 196)]
SEABED = [(30, 44, 52), (70, 88, 88), (120, 132, 112), (168, 170, 136), (206, 202, 164), (232, 228, 196)]
CORAL = [(54, 12, 26), (122, 32, 52), (190, 62, 82), (232, 106, 116), (250, 160, 150), (255, 214, 196)]
GOLD = [(60, 34, 4), (128, 80, 10), (196, 140, 24), (238, 196, 56), (252, 230, 120), (255, 250, 200)]
EGG = [(70, 54, 50), (140, 118, 104), (198, 180, 160), (228, 216, 196), (246, 238, 224), (255, 252, 244)]


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def ramp_at(ramp, t):
    t = max(0.0, min(1.0, t)) * (len(ramp) - 1)
    i = min(int(t), len(ramp) - 2)
    f = t - i
    a, b = ramp[i], ramp[i + 1]
    return tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3))


def special(r, g, b):
    """Fire, lava, blue crystal/water, red carpet, green moss stay as drawn."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if s > 0.62 and v > 0.55 and (h < 55 or h > 330):  # fire, lava, red cloth
        return True
    if s > 0.45 and 185 < h < 255 and v > 0.45:  # blue crystal, water
        return True
    if s > 0.4 and 70 < h < 160 and v > 0.3:  # leaves, moss
        return True
    return False


def repaint(img, tiles, ramp, keep_dark=24, lo=None, hi=None, keep_special=True):
    px = img.load()
    for t in tiles:
        x0, y0 = (t % COLS) * 16, (t // COLS) * 16
        cells = [(x, y) for y in range(y0, y0 + 16) for x in range(x0, x0 + 16) if px[x, y][3] > 0]
        if not cells:
            continue
        ls = [lum(*px[x, y][:3]) for x, y in cells]
        a = lo if lo is not None else min(ls)
        b = hi if hi is not None else max(ls)
        for (x, y), L in zip(cells, ls):
            r, g, bb, al = px[x, y]
            if L < keep_dark or (keep_special and special(r, g, bb)):
                continue
            nr, ng, nb = ramp_at(ramp, (L - a) / max(1.0, b - a))
            px[x, y] = (nr, ng, nb, al)


CHASM = span((129, 131), (159, 161), (189, 191), (219, 221))


def chasm_to_water(img, water_tile=120, dark=46, tint=None):
    """Fill the chasm autotile's dark hollow with water (sampled from a water tile), keep its rock lip."""
    px = img.load()
    wx0, wy0 = (water_tile % COLS) * 16, (water_tile // COLS) * 16
    water = [[px[wx0 + x, wy0 + y] for x in range(16)] for y in range(16)]
    for t in CHASM:
        x0, y0 = (t % COLS) * 16, (t // COLS) * 16
        for y in range(16):
            for x in range(16):
                r, g, b, a = px[x0 + x, y0 + y]
                if a == 0:
                    continue
                L = lum(r, g, b)
                if L < dark:
                    wr, wg, wb, _ = water[y][x]
                    if tint:
                        wr, wg, wb = (round(wr * tint[0]), round(wg * tint[1]), round(wb * tint[2]))
                    # the hollow's own shading (darker near the lip) carries over as depth
                    k = 0.72 + 0.28 * (L / dark)
                    px[x0 + x, y0 + y] = (min(255, round(wr * k)), min(255, round(wg * k)), min(255, round(wb * k)), 255)


# A pharaoh's sarcophagus (2 wide, 3 tall), drawn for the tomb: the dungeon sheet has no coffin. It goes into the
# rail/turntable slots of the desert sheet (the pyramid has no rails); the desert tileset marks them solid.
SARCOPHAGUS_SLOTS = [54, 55, 84, 85, 116, 144]
OUTLINE=(46,28,18,255); DARK=(98,62,34,255); MID=(170,126,74,255); BODY=(206,164,104,255); LIGHT=(236,208,150,255)
G0=(110,70,10,255); G1=(196,140,24,255); G2=(238,196,56,255); G3=(252,232,130,255)
BL=(34,58,120,255); BL2=(70,104,176,255); SKIN=(222,170,90,255)
def sarcophagus():
    im = Image.new("RGBA", (32, 48), (0,0,0,0)); d = ImageDraw.Draw(im)
    # footprint: lid x3..28, y2..39 ; front face y40..45 ; shadow row 46
    d.rounded_rectangle((3, 2, 28, 45), 5, fill=OUTLINE)
    d.rounded_rectangle((4, 3, 27, 39), 4, fill=BODY)
    d.rectangle((4, 38, 27, 44), fill=DARK)          # front face of the box
    d.line((5, 39, 26, 39), fill=G1)                  # lid lip
    d.line((5, 42, 26, 42), fill=G0)
    for x in range(7, 26, 4): d.point((x, 41), fill=G2); d.point((x, 43), fill=MID)  # glyph studs
    d.rounded_rectangle((5, 4, 26, 37), 3, outline=G1)   # gold band
    d.line((6, 5, 25, 5), fill=G3)
    # head: striped nemes headdress and mask
    d.pieslice((8, 5, 23, 22), 180, 360, fill=BL)
    d.rectangle((8, 13, 23, 20), fill=BL)
    for x in range(9, 23, 3): d.line((x, 8, x, 20), fill=G2)
    d.ellipse((11, 8, 20, 19), fill=SKIN, outline=G0)
    d.point((13, 12), fill=OUTLINE); d.point((18, 12), fill=OUTLINE)
    d.line((14, 16, 17, 16), fill=G0)
    d.rectangle((14, 19, 17, 21), fill=G1)            # beard
    # collar
    d.arc((8, 17, 23, 27), 0, 180, fill=G2, width=2)
    d.arc((9, 18, 22, 26), 0, 180, fill=BL2)
    # crossed arms with crook and flail
    d.line((8, 25, 22, 29), fill=G1, width=2); d.line((23, 25, 9, 29), fill=G2, width=2)
    # glyph column down the legs
    d.rectangle((13, 30, 18, 36), fill=LIGHT)
    for y in range(31, 36, 2): d.line((14, y, 17, y), fill=DARK)
    d.line((8, 31, 8, 36), fill=MID); d.line((23, 31, 23, 36), fill=MID)
    d.line((4, 6, 4, 37), fill=LIGHT)                 # rim light on the left
    return im


def paste_sarcophagus(img):
    art = sarcophagus()
    for i, t in enumerate(SARCOPHAGUS_SLOTS):
        sx, sy = (i % 2) * 16, (i // 2) * 16
        x0, y0 = (t % COLS) * 16, (t // COLS) * 16
        img.paste((0, 0, 0, 0), (x0, y0, x0 + 16, y0 + 16))
        img.alpha_composite(art.crop((sx, sy, sx + 16, sy + 16)), (x0, y0))


def build():
    base = Image.open(SRC).convert("RGBA")
    os.makedirs(OUT, exist_ok=True)
    # Brightness bounds are shared per family so neighbouring tiles of one autotile stay continuous.
    desert = base.copy()
    repaint(desert, EARTH_WALLS + TEAL + STONE_CLIFF, SAND_WALL, lo=20, hi=150)
    repaint(desert, STONE_FLOOR + RIM_GRAY, SAND_FLOOR, lo=20, hi=150)
    repaint(desert, PLATFORM + DIRT, SAND_FLOOR, lo=30, hi=170)
    repaint(desert, STATUES + BARS + BOULDERS_GRAY, SAND_STONE, lo=15, hi=230)
    repaint(desert, BOULDERS_BROWN, SAND_WALL, lo=15, hi=200)
    paste_sarcophagus(desert)
    desert.save(f"{OUT}/desert-chipset.png", optimize=True)

    sea = base.copy()
    repaint(sea, EARTH_WALLS + TEAL + STONE_CLIFF + RIM_GRAY, SEA_ROCK, lo=20, hi=150)
    repaint(sea, STONE_FLOOR + DIRT + PLATFORM, SEABED, lo=20, hi=160)
    repaint(sea, STATUES + BARS + BOULDERS_GRAY, SEA_ROCK, lo=15, hi=230)
    repaint(sea, BOULDERS_BROWN, CORAL, lo=15, hi=200)
    chasm_to_water(sea, tint=(0.8, 1.0, 1.0))
    sea.save(f"{OUT}/sea-chipset.png", optimize=True)

    cave = base.copy()
    chasm_to_water(cave)
    cave.save(f"{OUT}/cave-chipset.png", optimize=True)

    lair = base.copy()
    repaint(lair, span(259, 260, 382, 383, 322, 323, 352, 353), GOLD, lo=15, hi=230, keep_special=False)
    repaint(lair, [290], EGG, lo=15, hi=230, keep_special=False)
    lair.save(f"{OUT}/lair-chipset.png", optimize=True)

    classes = {"desert": {"sandstone walls": EARTH_WALLS + TEAL + STONE_CLIFF, "sand floor/rim": STONE_FLOOR + RIM_GRAY + PLATFORM + DIRT,
                          "sandstone props": STATUES + BARS + BOULDERS_GRAY + BOULDERS_BROWN, "sarcophagus (drawn)": SARCOPHAGUS_SLOTS},
               "sea": {"sea rock": EARTH_WALLS + TEAL + STONE_CLIFF + RIM_GRAY + STATUES + BARS + BOULDERS_GRAY,
                       "seabed": STONE_FLOOR + DIRT + PLATFORM, "coral": BOULDERS_BROWN},
               "lair": {"gold": span(259, 260, 382, 383, 322, 323, 352, 353), "egg": [290]},
               "cave": {"water-filled chasm": CHASM}}
    with open("tiledata/rpg-dungeons/sheet-classes.json", "w") as f:
        json.dump(classes, f, indent=1)
        f.write("\n")


if __name__ == "__main__":
    build()
