"""Pixels drawn for the atlas dungeons (imported by build-atlas-dungeon-sheets.py).

Every piece is drawn at 16 px per cell in the EasyRPG dungeon look: a dark outline, 3–5 flat shades per material,
light from the upper left, 3/4 top-down (a box shows its lid and a strip of its front face). Pieces are returned as
RGBA images whose size is a whole number of cells; the builder cuts them into 16×16 parts.
"""
from PIL import Image, ImageDraw

K = (24, 16, 12, 255)
WOOD = [(52, 24, 6, 255), (92, 50, 18, 255), (138, 78, 40, 255), (176, 110, 64, 255), (208, 148, 94, 255)]
STONE = [(38, 42, 46, 255), (72, 78, 84, 255), (106, 112, 118, 255), (142, 148, 152, 255), (182, 186, 188, 255), (218, 220, 222, 255)]
GOLD = [(96, 60, 8, 255), (170, 118, 20, 255), (226, 178, 44, 255), (250, 222, 110, 255), (255, 246, 196, 255)]
IRON = [(40, 46, 58, 255), (72, 82, 98, 255), (110, 122, 140, 255), (156, 168, 184, 255), (204, 212, 222, 255)]
BONE = [(120, 108, 84, 255), (176, 164, 136, 255), (220, 210, 186, 255), (244, 238, 222, 255)]
WEB = (236, 236, 244, 210)
WEB2 = (196, 196, 210, 150)
RED = [(88, 16, 20, 255), (150, 30, 34, 255), (206, 60, 52, 255), (240, 120, 96, 255)]
GLASS = (200, 236, 244, 190)
BRASS = [(70, 44, 14, 255), (128, 88, 30, 255), (184, 138, 56, 255), (226, 190, 104, 255), (250, 232, 170, 255)]
T = (0, 0, 0, 0)


def canvas(w, h):
    im = Image.new("RGBA", (w * 16, h * 16), T)
    return im, ImageDraw.Draw(im)


def ascii_sprite(rows, pal):
    h, w = len(rows), len(rows[0])
    im = Image.new("RGBA", (w, h), T)
    px = im.load()
    for y, r in enumerate(rows):
        assert len(r) == w, (y, r)
        for x, ch in enumerate(r):
            if ch != ".":
                px[x, y] = pal[ch]
    return im


# ── coffins (1×2, head north) ──────────────────────────────────────────────────────────────────────────────────
def coffin(kind="wood", open_=False):
    im, d = canvas(1, 2)
    C = WOOD if kind == "wood" else STONE
    # lid outline: hexagon, widest at the shoulders (y=8), foot narrower
    lid = [(4, 2), (11, 2), (14, 8), (13, 25), (2, 25), (1, 8)]
    d.polygon(lid, fill=C[2], outline=K)
    # front face strip under the lid (3/4 view)
    d.polygon([(2, 26), (13, 26), (13, 29), (2, 29)], fill=C[1], outline=K)
    d.line((3, 29, 12, 29), fill=K)
    d.line((3, 27, 12, 27), fill=C[0])
    if open_:
        inner = [(5, 4), (10, 4), (12, 9), (11, 23), (4, 23), (3, 9)]
        d.polygon(inner, fill=(28, 20, 16, 255), outline=C[0])
        # skeleton: skull, spine, ribs, arms
        d.ellipse((6, 5, 9, 8), fill=BONE[2], outline=BONE[0])
        d.point((7, 7), fill=K); d.point((8, 7), fill=K)
        d.line((7, 9, 7, 20), fill=BONE[2]); d.line((8, 9, 8, 20), fill=BONE[1])
        for y in (11, 13, 15):
            d.line((5, y, 10, y), fill=BONE[1])
        d.line((5, 17, 6, 20), fill=BONE[2]); d.line((10, 17, 9, 20), fill=BONE[2])
        d.line((6, 21, 5, 23), fill=BONE[1]); d.line((9, 21, 10, 23), fill=BONE[1])
        # the lid pushed aside, leaning on the right
        d.line((13, 3, 15, 24), fill=C[3]); d.line((14, 3, 15, 10), fill=C[1])
    else:
        # lid bevel and highlight
        d.line((5, 3, 10, 3), fill=C[4]); d.line((2, 9, 4, 3), fill=C[3])
        d.polygon([(5, 5), (10, 5), (12, 9), (11, 23), (4, 23), (3, 9)], outline=C[1])
        if kind == "wood":
            # cross on the lid
            d.line((7, 7, 7, 17), fill=GOLD[2]); d.line((8, 7, 8, 17), fill=GOLD[1])
            d.line((5, 10, 10, 10), fill=GOLD[2]); d.line((5, 11, 10, 11), fill=GOLD[1])
        else:
            # carved knight effigy: head, crossed hands, sword
            d.ellipse((6, 6, 9, 9), fill=C[4], outline=C[1])
            d.line((7, 10, 7, 22), fill=C[4]); d.line((8, 10, 8, 22), fill=C[1])
            d.line((5, 12, 10, 12), fill=C[4])
            d.line((5, 14, 10, 16), fill=C[3]); d.line((10, 14, 5, 16), fill=C[3])
    return im


# ── treasure chests (1×1) ──────────────────────────────────────────────────────────────────────────────────────
def chest(body, band, open_=False, glow=None):
    im, d = canvas(1, 1)
    if not open_:
        d.rectangle((1, 4, 14, 14), fill=body[2], outline=K)
        d.rectangle((2, 5, 13, 8), fill=body[3])  # curved lid top
        d.line((2, 5, 13, 5), fill=body[4])
        d.line((1, 9, 14, 9), fill=K)  # lid seam
        d.rectangle((2, 10, 13, 13), fill=body[1])
        for x in (3, 12):
            d.line((x, 5, x, 13), fill=band[2]); d.line((x + 1, 5, x + 1, 13), fill=band[1])
        d.rectangle((6, 8, 9, 11), fill=band[3], outline=K)
        d.point((7, 10), fill=K)
        d.line((1, 15, 14, 15), fill=(0, 0, 0, 90))
    else:
        # lid thrown back (seen from its underside) + open box with the loot
        d.rectangle((1, 1, 14, 5), fill=body[1], outline=K)
        d.line((2, 2, 13, 2), fill=body[2])
        d.rectangle((1, 6, 14, 14), fill=body[2], outline=K)
        d.rectangle((2, 7, 13, 9), fill=(34, 20, 12, 255))
        if glow:
            d.rectangle((3, 7, 12, 8), fill=glow[2]); d.point((5, 7), fill=glow[3]); d.point((10, 8), fill=glow[3])
        d.rectangle((2, 10, 13, 13), fill=body[1])
        for x in (3, 12):
            d.line((x, 1, x, 13), fill=band[2])
        d.rectangle((6, 10, 9, 12), fill=band[3], outline=K)
        d.line((1, 15, 14, 15), fill=(0, 0, 0, 90))
    return im


# ── cobwebs ────────────────────────────────────────────────────────────────────────────────────────────────────
def web_corner(side="left"):
    """A corner web hanging in the top corner of a room (on the wall face's lower row or the floor under it)."""
    im, d = canvas(1, 1)
    ax = 0 if side == "left" else 15
    sgn = 1 if side == "left" else -1
    # radial threads from the corner
    for ex, ey in [(15, 1), (14, 6), (11, 11), (6, 14), (1, 15)]:
        d.line((ax, 0, ax + sgn * ex, ey), fill=WEB2)
    # concentric sagging arcs
    for r in (4, 8, 12):
        pts = []
        for k in range(6):
            t = k / 5
            import math
            a = t * math.pi / 2
            x = ax + sgn * round(r * math.cos(a) * (1 - 0.12 * math.sin(a * 2)))
            y = round(r * math.sin(a) * (1 - 0.12 * math.sin(a * 2)))
            pts.append((x, y))
        d.line(pts, fill=WEB)
    return im


def web_big():
    """A 2×2 web spun across the floor between rocks."""
    import math
    im, d = canvas(2, 2)
    cx, cy = 16, 15
    spokes = 10
    ends = []
    for k in range(spokes):
        a = k * 2 * math.pi / spokes + 0.2
        ex, ey = cx + 15 * math.cos(a), cy + 14 * math.sin(a)
        ends.append((a, ex, ey))
        d.line((cx, cy, ex, ey), fill=WEB2)
    for r in (3, 6, 9, 12, 14):
        pts = [(cx + r * math.cos(a) * (0.92 if k % 2 else 1), cy + r * 0.93 * math.sin(a) * (0.92 if k % 2 else 1)) for k, (a, _, _) in enumerate(ends)]
        pts.append(pts[0])
        d.line(pts, fill=WEB)
    d.ellipse((cx - 1, cy - 1, cx + 1, cy + 1), fill=WEB)
    return im


def egg_sac():
    im, d = canvas(1, 1)
    for (x, y, r) in [(4, 9, 3), (10, 10, 4), (7, 5, 3), (11, 5, 2)]:
        d.ellipse((x - r, y - r, x + r, y + r), fill=(214, 210, 196, 255), outline=(120, 112, 100, 255))
        d.point((x - 1, y - 1), fill=(250, 248, 240, 255))
    for x in range(1, 15, 3):
        d.line((x, 14, x + 2, 12), fill=WEB2)
    return im


def cocoon():
    im, d = canvas(1, 2)
    d.line((8, 0, 8, 4), fill=WEB)  # hanging thread
    d.ellipse((3, 4, 12, 28), fill=(206, 202, 190, 255), outline=(110, 104, 94, 255))
    for y in range(7, 27, 3):
        d.arc((3, y - 3, 12, y + 3), 20, 160, fill=(150, 144, 132, 255))
    d.ellipse((5, 6, 10, 11), fill=(226, 222, 212, 255))
    d.line((4, 29, 11, 29), fill=(0, 0, 0, 80))
    return im


# ── traps and switches (1×1, floor) ────────────────────────────────────────────────────────────────────────────
def spike_plate(raised):
    im, d = canvas(1, 1)
    d.rectangle((1, 1, 14, 14), fill=IRON[1], outline=K)
    d.line((2, 2, 13, 2), fill=IRON[2])
    holes = [(4, 4), (8, 4), (12, 4), (4, 8), (8, 8), (12, 8), (4, 12), (8, 12), (12, 12)]
    for x, y in holes:
        if raised:
            d.polygon([(x - 1, y + 1), (x + 1, y + 1), (x, y - 3)], fill=IRON[4], outline=IRON[0])
            d.point((x, y - 2), fill=(255, 255, 255, 255))
        else:
            d.rectangle((x - 1, y - 1, x, y), fill=IRON[0])
    return im


def pressure_plate(pressed=False):
    im, d = canvas(1, 1)
    d.rectangle((2, 2, 13, 13), fill=STONE[1], outline=K)
    if pressed:
        d.rectangle((3, 3, 12, 12), fill=STONE[1]); d.line((3, 3, 12, 3), fill=STONE[0])
    else:
        d.rectangle((3, 3, 12, 11), fill=STONE[3]); d.line((3, 3, 12, 3), fill=STONE[4]); d.line((3, 12, 12, 12), fill=STONE[0])
        d.rectangle((6, 6, 9, 8), outline=STONE[2])
    return im


def floor_lever(on):
    im, d = canvas(1, 1)
    d.rectangle((3, 9, 12, 14), fill=STONE[2], outline=K)
    d.line((4, 10, 11, 10), fill=STONE[4])
    d.rectangle((6, 11, 9, 12), fill=K)
    if on:
        d.line((8, 11, 12, 3), fill=IRON[3], width=2); d.ellipse((10, 1, 14, 5), fill=RED[2], outline=K)
    else:
        d.line((7, 11, 3, 3), fill=IRON[3], width=2); d.ellipse((1, 1, 5, 5), fill=RED[2], outline=K)
    return im


def rune_glyph(color, symbol):
    """A rune carved into the floor, glowing in an element colour (upper, walkable)."""
    import math
    im, d = canvas(1, 1)
    c0, c1, c2 = color
    d.ellipse((1, 1, 14, 14), outline=c0)
    d.ellipse((2, 2, 13, 13), outline=c1)
    if symbol == "wind":
        d.arc((4, 4, 11, 11), 200, 470, fill=c2); d.arc((6, 6, 9, 9), 0, 270, fill=c2)
    elif symbol == "water":
        d.polygon([(8, 3), (11, 9), (8, 12), (5, 9)], outline=c2); d.point((7, 8), fill=c2)
    elif symbol == "earth":
        d.polygon([(4, 11), (8, 4), (12, 11)], outline=c2); d.line((6, 9, 10, 9), fill=c2)
    elif symbol == "fire":
        d.polygon([(8, 3), (11, 8), (10, 12), (6, 12), (5, 8)], outline=c2); d.line((8, 7, 8, 11), fill=c2)
    elif symbol == "star":
        pts = [(8 + 5 * math.cos(-math.pi / 2 + k * 4 * math.pi / 5), 8 + 5 * math.sin(-math.pi / 2 + k * 4 * math.pi / 5)) for k in range(6)]
        d.line(pts, fill=c2)
    elif symbol == "eye":
        d.ellipse((4, 6, 11, 10), outline=c2); d.point((7, 8), fill=c2); d.point((8, 8), fill=c2)
    return im


def sparkle(color):
    im, d = canvas(1, 1)
    for x, y, s in [(4, 5, 2), (11, 9, 3), (7, 12, 1), (12, 3, 1)]:
        d.line((x - s, y, x + s, y), fill=color); d.line((x, y - s, x, y + s), fill=color)
        d.point((x, y), fill=(255, 255, 255, 255))
    return im


# ── machinery (ancient ruins) ──────────────────────────────────────────────────────────────────────────────────
def gear(size_cells, C=BRASS):
    import math
    im, d = canvas(size_cells, size_cells)
    n = 16 * size_cells
    cx = cy = n / 2 - 0.5
    ro, ri = n / 2 - 1, n / 2 - 3.5
    teeth = 8 if size_cells == 1 else 12
    pts = []
    for k in range(teeth * 4):
        a = k * 2 * math.pi / (teeth * 4)
        r = ro if (k % 4) in (1, 2) else ri
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=C[2], outline=K)
    hub = n * 0.18
    d.ellipse((cx - ri + 2, cy - ri + 2, cx + ri - 2, cy + ri - 2), outline=C[1])
    d.ellipse((cx - hub, cy - hub, cx + hub, cy + hub), fill=C[3], outline=K)
    d.ellipse((cx - hub / 2.5, cy - hub / 2.5, cx + hub / 2.5, cy + hub / 2.5), fill=K)
    d.arc((cx - ri + 3, cy - ri + 3, cx + ri - 3, cy + ri - 3), 190, 260, fill=C[4])
    if size_cells > 1:
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            d.line((cx + hub * math.cos(a), cy + hub * math.sin(a), cx + (ri - 3) * math.cos(a), cy + (ri - 3) * math.sin(a)), fill=C[1], width=2)
    return im


def pipe(kind):
    im, d = canvas(1, 1)
    C = BRASS
    if kind in ("h", "cross"):
        d.rectangle((0, 5, 15, 10), fill=C[2]); d.line((0, 5, 15, 5), fill=K); d.line((0, 10, 15, 10), fill=K); d.line((0, 6, 15, 6), fill=C[4]); d.line((0, 9, 15, 9), fill=C[1])
    if kind in ("v", "cross"):
        d.rectangle((5, 0, 10, 15), fill=C[2]); d.line((5, 0, 5, 15), fill=K); d.line((10, 0, 10, 15), fill=K); d.line((6, 0, 6, 15), fill=C[4]); d.line((9, 0, 9, 15), fill=C[1])
    if kind == "valve":
        d.rectangle((0, 5, 15, 10), fill=C[2]); d.line((0, 5, 15, 5), fill=K); d.line((0, 10, 15, 10), fill=K); d.line((0, 6, 15, 6), fill=C[4])
        d.ellipse((3, 1, 12, 10), outline=RED[1]); d.line((7, 1, 7, 10), fill=RED[2]); d.line((3, 5, 12, 5), fill=RED[2])
    for x in (0, 15):
        if kind in ("h", "cross", "valve"):
            d.rectangle((x - 1 if x else 0, 4, x + 1 if not x else 15, 11), fill=C[1])
    return im


def piston():
    im, d = canvas(1, 2)
    d.rectangle((3, 1, 12, 8), fill=IRON[2], outline=K); d.line((4, 2, 11, 2), fill=IRON[4])
    d.rectangle((6, 9, 9, 20), fill=IRON[3], outline=K); d.line((7, 9, 7, 20), fill=IRON[4])
    d.rectangle((2, 21, 13, 29), fill=BRASS[2], outline=K); d.line((3, 22, 12, 22), fill=BRASS[4]); d.line((3, 28, 12, 28), fill=BRASS[1])
    for x in (4, 11):
        d.point((x, 25), fill=K)
    d.line((2, 30, 13, 30), fill=(0, 0, 0, 90))
    return im


# ── laboratory ─────────────────────────────────────────────────────────────────────────────────────────────────
def vat(liquid, broken=False, specimen=False):
    im, d = canvas(1, 2)
    L0, L1, L2 = liquid
    # brass cap
    d.rectangle((2, 1, 13, 4), fill=BRASS[2], outline=K); d.line((3, 2, 12, 2), fill=BRASS[4])
    # glass column
    d.rectangle((3, 5, 12, 24), fill=GLASS if not broken else (0, 0, 0, 0), outline=K)
    if not broken:
        d.rectangle((4, 8, 11, 24), fill=L1)
        d.line((4, 8, 11, 8), fill=L2)
        for x, y in [(6, 12), (9, 16), (7, 20), (10, 10)]:
            d.point((x, y), fill=L2)
        if specimen:
            d.ellipse((5, 11, 10, 16), fill=L0); d.line((7, 16, 7, 22), fill=L0, width=2); d.point((6, 13), fill=(250, 240, 120, 255))
        d.line((4, 6, 4, 23), fill=(255, 255, 255, 140))
    else:
        d.polygon([(3, 24), (3, 14), (5, 18), (6, 12), (8, 20), (10, 15), (12, 19), (12, 24)], fill=GLASS, outline=K)
        d.rectangle((1, 28, 14, 29), fill=L1)
    # base
    d.rectangle((1, 25, 14, 29), fill=IRON[2], outline=K); d.line((2, 26, 13, 26), fill=IRON[4])
    d.line((1, 30, 14, 30), fill=(0, 0, 0, 90))
    return im


def lab_console():
    im, d = canvas(2, 1)
    d.rectangle((1, 3, 30, 14), fill=IRON[1], outline=K); d.line((2, 4, 29, 4), fill=IRON[3])
    for x, c in [(5, (60, 220, 120, 255)), (11, (240, 200, 60, 255)), (17, (220, 60, 60, 255))]:
        d.rectangle((x - 2, 7, x + 2, 11), fill=K); d.rectangle((x - 1, 8, x + 1, 10), fill=c)
    d.rectangle((21, 6, 28, 12), fill=(20, 40, 30, 255), outline=K)
    d.line((22, 10, 24, 8), fill=(80, 240, 140, 255)); d.line((24, 8, 26, 10), fill=(80, 240, 140, 255)); d.line((26, 10, 27, 9), fill=(80, 240, 140, 255))
    d.line((1, 15, 30, 15), fill=(0, 0, 0, 90))
    return im


# ── ship / wreck bits ──────────────────────────────────────────────────────────────────────────────────────────
def mast_stump():
    im, d = canvas(1, 1)
    d.ellipse((3, 3, 12, 12), fill=WOOD[2], outline=K)
    d.ellipse((5, 5, 10, 10), outline=WOOD[1]); d.point((7, 7), fill=WOOD[1])
    d.polygon([(4, 5), (6, 1), (8, 4), (10, 0), (11, 5)], fill=WOOD[3], outline=K)
    d.line((3, 13, 12, 13), fill=(0, 0, 0, 90))
    return im


def floor_hatch(open_=True):
    im, d = canvas(1, 1)
    d.rectangle((1, 1, 14, 14), fill=WOOD[1], outline=K)
    if open_:
        d.rectangle((3, 3, 12, 12), fill=(18, 12, 8, 255))
        for y in (5, 8, 11):  # ladder rungs going down
            d.line((5, y, 10, y), fill=WOOD[3])
        d.line((5, 3, 5, 12), fill=WOOD[2]); d.line((10, 3, 10, 12), fill=WOOD[2])
    else:
        for x in (4, 8, 12):
            d.line((x, 2, x, 13), fill=WOOD[0])
        d.line((2, 2, 13, 2), fill=WOOD[3]); d.rectangle((6, 7, 9, 9), fill=IRON[2], outline=K)
    return im


def shackles():
    im, d = canvas(1, 1)
    d.ellipse((6, 1, 9, 4), outline=IRON[3])
    d.line((7, 4, 4, 10), fill=IRON[2]); d.line((8, 4, 11, 10), fill=IRON[2])
    d.ellipse((1, 9, 6, 14), outline=IRON[3]); d.ellipse((9, 9, 14, 14), outline=IRON[3])
    return im


def ore_vein(C):
    im, d = canvas(1, 1)
    for x, y in [(3, 4), (9, 3), (6, 9), (12, 10), (4, 13)]:
        d.polygon([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)], fill=C[2], outline=C[0])
        d.point((x - 1, y - 1), fill=C[3])
    return im


def lift_platform():
    im, d = canvas(2, 2)
    d.rectangle((2, 4, 29, 29), fill=WOOD[2], outline=K)
    for y in range(8, 29, 5):
        d.line((3, y, 28, y), fill=WOOD[1])
    d.line((3, 5, 28, 5), fill=WOOD[4])
    for x, y in [(2, 4), (27, 4), (2, 27), (27, 27)]:
        d.rectangle((x, y - 3, x + 2, y + 2), fill=IRON[2], outline=K)
    d.line((3, 1, 3, 4), fill=(140, 120, 90, 255)); d.line((28, 1, 28, 4), fill=(140, 120, 90, 255))
    d.line((2, 30, 29, 30), fill=(0, 0, 0, 90))
    return im


def healing_basin():
    """A round stone basin brimming with glowing water (2×2)."""
    im, d = canvas(2, 2)
    d.ellipse((1, 3, 30, 28), fill=STONE[2], outline=K)
    d.ellipse((3, 5, 28, 24), fill=STONE[4])
    d.ellipse((5, 7, 26, 22), fill=(40, 140, 170, 255), outline=STONE[1])
    d.ellipse((8, 9, 23, 19), fill=(90, 210, 220, 255))
    d.ellipse((12, 11, 19, 16), fill=(190, 250, 245, 255))
    for x, y in [(9, 12), (21, 15), (15, 9)]:
        d.point((x, y), fill=(255, 255, 255, 255))
    d.arc((1, 20, 30, 30), 20, 160, fill=STONE[0])
    return im


def bone_pile():
    im, d = canvas(1, 1)
    d.ellipse((3, 2, 9, 7), fill=BONE[2], outline=BONE[0]); d.point((5, 5), fill=K); d.point((7, 5), fill=K)
    d.line((2, 10, 13, 8), fill=BONE[2], width=2); d.line((4, 13, 12, 12), fill=BONE[1], width=2); d.line((9, 5, 14, 12), fill=BONE[2])
    for x, y in [(2, 10), (13, 8), (4, 13), (12, 12)]:
        d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=BONE[3])
    return im


def recolor(img, ramp, keep_dark=20):
    """Map every opaque pixel to `ramp` by its brightness (dark outline kept)."""
    out = img.copy()
    px = out.load()
    ls = [0.299 * r + 0.587 * g + 0.114 * b for (r, g, b, a) in (px[x, y] for y in range(out.height) for x in range(out.width)) if a > 0]
    if not ls:
        return out
    lo, hi = min(ls), max(ls)
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            L = 0.299 * r + 0.587 * g + 0.114 * b
            if L < keep_dark:
                continue
            t = (L - lo) / max(1.0, hi - lo) * (len(ramp) - 1)
            i = min(int(t), len(ramp) - 2)
            f = t - i
            c = tuple(round(ramp[i][k] + (ramp[i + 1][k] - ramp[i][k]) * f) for k in range(3))
            px[x, y] = (*c, a)
    return out


RAMPS = {
    "red": [(40, 4, 8), (110, 16, 22), (190, 40, 34), (240, 96, 64), (255, 180, 130), (255, 236, 210)],
    "green": [(8, 36, 20), (20, 90, 50), (50, 160, 90), (120, 220, 150), (200, 250, 214), (240, 255, 244)],
    "amber": [(48, 26, 4), (120, 70, 10), (196, 130, 24), (240, 186, 60), (255, 226, 140), (255, 248, 214)],
    "gold": [(70, 44, 6), (150, 106, 20), (220, 170, 40), (250, 214, 100), (255, 240, 180), (255, 255, 240)],
    "violet": [(26, 8, 44), (70, 24, 110), (130, 60, 190), (186, 120, 236), (226, 190, 255), (248, 236, 255)],
    "pink": [(60, 10, 40), (140, 40, 100), (220, 90, 170), (250, 150, 210), (255, 210, 236), (255, 244, 250)],
    "cyan": [(4, 36, 44), (10, 96, 110), (30, 170, 180), (100, 230, 230), (190, 252, 250), (240, 255, 255)],
    "ghost": [(6, 30, 34), (20, 80, 90), (60, 170, 170), (140, 230, 220), (210, 255, 250), (245, 255, 255)],
    "white": [(70, 80, 96), (130, 142, 160), (186, 198, 212), (220, 230, 240), (240, 246, 252), (255, 255, 255)],
}
