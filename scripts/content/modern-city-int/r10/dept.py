# R10 department-store boutique and luxury props (3/4 top view).
from lib import *


# ------------------------------------------------------------------ mannequins (1x1 floor, tall)
FORM, FORM_D, FORM_L = (232, 226, 218), (196, 188, 178), (250, 248, 244)


def _plinth(c):
    """Round two-step plinth with a chrome support rod."""
    c.oval(1, 25, 14, 31, (150, 146, 140)); c.oval(2, 25, 13, 29, (226, 222, 214)); c.r(4, 26, 11, 26, FORM_L)
    c.r(7, 20, 8, 27, STEEL_L); c.p(8, 21, STEEL_D)
def _head(c, hair=None, y=0):
    """Egg head on a neck, lit from the upper left; optional sculpted hair cap."""
    c.oval(5, y, 10, y + 6, FORM); c.p(6, y + 1, FORM_L); c.p(9, y + 4, FORM_D)
    c.r(7, y + 6, 8, y + 7, FORM_D)
    if hair: c.oval(5, y, 10, y + 3, hair); c.p(6, y + 1, lt(hair, 1.4)); c.p(10, y + 3, hair); c.p(5, y + 3, hair)
def _torso(c, col, y0, y1, waist=None, shoulder=(2, 13)):
    """Clothed torso: broad shoulders tapering to the waist, lit left flank, shaded right flank, ink outline."""
    L, D = lt(col, 1.25), dk(col, 0.72)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, (waist or y1) - y0)
        inset = 0 if y == y0 + 1 else min(2, int(t * 2))
        x0, x1 = shoulder[0] + inset + (1 if y == y0 else 0), shoulder[1] - inset - (1 if y == y0 else 0)
        c.r(x0 - 1, y, x1 + 1, y, OL); c.r(x0, y, x1, y, col); c.p(x0, y, L); c.p(x1, y, D)
    c.r(shoulder[0] + 1, y1 + 1, shoulder[1] - 1, y1 + 1, OL)
    c.r(shoulder[0] + 1, y0 + 1, shoulder[1] - 1, y0 + 1, L)
def _arms(c, col, y0, y1):
    """Arms hanging at the sides, sleeves in the garment colour, form-coloured hands."""
    for x in (1, 14):
        c.r(x, y0, x, y1, col); c.p(x, y0, lt(col, 1.2)); c.p(x, y1 + 1, FORM)
        c.r(x - 1 if x == 1 else x + 1, y0 + 1, x - 1 if x == 1 else x + 1, y1, OL)
def mannequin_suit():
    """Male mannequin in a navy two-button suit with notched lapels, white shirt, red tie and pocket square."""
    c = C(16, 32); _plinth(c); _head(c)
    _torso(c, NAVY, 7, 20, waist=15); _arms(c, NAVY, 8, 17)
    c.l(5, 8, 7, 13, NAVY_D); c.l(10, 8, 8, 13, NAVY_D)                                  # lapels
    c.r(7, 8, 8, 9, WHITE); c.r(7, 10, 8, 13, RED); c.p(7, 10, RED_L)                    # shirt + tie
    c.p(10, 10, WHITE); c.p(8, 15, GOLD_D); c.p(8, 17, GOLD_D)                           # pocket square + buttons
    c.r(5, 19, 10, 20, NAVY_D)
    return c.done()
def mannequin_casual():
    """Female mannequin in a Breton striped knit with rolled sleeves, belted high-waist jeans."""
    c = C(16, 32); _plinth(c); _head(c, (120, 80, 50))
    _torso(c, (246, 240, 226), 7, 14, waist=14, shoulder=(3, 12)); _arms(c, (246, 240, 226), 8, 13)
    for y in (9, 11, 13): c.r(4, y, 11, y, (60, 110, 190))
    c.p(1, 10, (60, 110, 190)); c.p(14, 10, (60, 110, 190))
    c.r(4, 15, 11, 15, BROWN); c.p(8, 15, GOLD)
    for y in range(16, 22):
        c.r(4, y, 6, y, (80, 120, 180)); c.r(9, y, 11, y, (80, 120, 180)); c.p(4, y, BLUE_L); c.p(11, y, BLUE_D)
    c.r(3, 16, 3, 21, OL); c.r(12, 16, 12, 21, OL); c.r(7, 17, 8, 21, OL)
    return c.done()
def mannequin_dress():
    """Female mannequin in a strapless red evening gown: fitted bodice, cinched waist, flared bias-cut skirt with folds."""
    c = C(16, 32); _plinth(c); _head(c, (60, 40, 30))
    c.r(6, 7, 9, 8, FORM); c.p(6, 7, FORM_L)
    _torso(c, RED, 8, 12, waist=12, shoulder=(4, 11))
    for i, y in enumerate(range(13, 25)):
        w = 2 + (i * 5) // 11
        c.r(6 - w, y, 9 + w, y, OL); c.r(7 - w, y, 8 + w, y, RED if y < 23 else RED_D)
        c.p(7 - w, y, RED_L)
    for x0, x1 in ((7, 4), (8, 9), (9, 12)): c.l(x0, 14, x1, 23, RED_D)                  # skirt folds
    c.r(5, 12, 10, 12, RED_D); c.p(7, 9, RED_L)
    return c.done()
def mannequin_coat():
    """Mannequin in a double-breasted camel trench: storm flap, belt with buckle, burgundy scarf, flared hem."""
    c = C(16, 32); _plinth(c); _head(c)
    COAT = (196, 156, 100)
    _torso(c, COAT, 7, 23, waist=14); _arms(c, COAT, 8, 18)
    c.r(5, 7, 10, 9, (150, 40, 50)); c.r(9, 9, 10, 13, (150, 40, 50)); c.p(5, 7, (190, 70, 80))   # scarf + tail
    c.r(3, 15, 12, 15, BROWN); c.box(7, 14, 9, 16, GOLD)                                  # belt + buckle
    c.l(7, 10, 7, 22, BROWN_D)
    for y in (11, 13, 18, 20): c.p(5, y, BROWN_D); c.p(9, y, BROWN_D)
    c.r(4, 8, 6, 9, (224, 190, 140)); c.r(2, 23, 13, 23, dk(COAT, 0.7))
    return c.done()
def mannequin_kids():
    """Short kids mannequin in a yellow hooded raincoat with toggle buttons, blue backpack straps and red boots."""
    c = C(16, 32); _plinth(c); _head(c, YELLOW, y=6)
    c.p(5, 9, YELLOW_D); c.p(10, 9, YELLOW_D)
    _torso(c, YELLOW, 13, 20, waist=20, shoulder=(4, 11))
    c.r(4, 14, 4, 19, (60, 140, 220)); c.r(11, 14, 11, 19, (60, 140, 220))              # backpack straps
    c.r(7, 14, 8, 20, YELLOW_D)
    for y in (15, 18): c.p(6, y, BROWN); c.p(9, y, BROWN)
    c.r(5, 22, 6, 24, RED); c.r(9, 22, 10, 24, RED); c.p(5, 22, RED_L); c.p(9, 22, RED_L)
    return c.done()


# ------------------------------------------------------------------ cases
WALNUT, WALNUT_D, WALNUT_L = (92, 58, 40), (62, 38, 28), (124, 82, 56)
BACKLIT, BACKLIT_D = (255, 238, 196), (226, 198, 150)
VELVET, VELVET_D, VELVET_L = (70, 48, 110), (40, 28, 66), (104, 78, 150)
MARBLE, MARBLE_V = (242, 238, 230), (210, 204, 196)


def _bag(c, x, y, kind, col):
    """One handbag in a 7x7 slot (x..x+6, y..y+6): handle/strap by kind, rounded body with lit flap, shaded base, brass clasp."""
    o, L, D = dk(col, 0.45), lt(col, 1.3), dk(col, 0.72)
    if kind in ('top', 'quilt'):
        c.r(x + 2, y, x + 4, y, o); c.p(x + 1, y + 1, o); c.p(x + 5, y + 1, o)
    elif kind == 'tote':
        c.r(x + 1, y, x + 1, y + 1, o); c.r(x + 5, y, x + 5, y + 1, o); c.r(x + 2, y, x + 4, y, o)
    elif kind == 'chain':
        for px, py in ((1, 1), (2, 0), (4, 0), (5, 1)): c.p(x + px, y + py, GOLD)
        c.p(x + 3, y, GOLD_D)
    if kind == 'clutch':
        c.rbox(x, y + 3, x + 6, y + 6, col, o); c.r(x + 1, y + 4, x + 5, y + 4, L); c.p(x + 3, y + 5, GOLD)
        return
    if kind == 'bucket':
        c.r(x + 2, y, x + 4, y, o); c.rbox(x + 1, y + 2, x + 5, y + 6, col, o); c.r(x + 2, y + 3, x + 4, y + 3, D)
        c.p(x + 2, y + 4, L); c.p(x + 3, y + 2, GOLD); return
    c.rbox(x, y + 2, x + 6, y + 6, col, o)
    c.r(x + 1, y + 3, x + 5, y + 3, L); c.r(x + 1, y + 5, x + 5, y + 5, D)
    if kind == 'quilt': c.dither(x + 1, y + 4, x + 5, y + 5, D)
    c.p(x + 3, y + 4, GOLD); c.p(x + 1, y + 3, lt(L, 1.2))


def _shoes(c, x, y, col, heel=False):
    """A pair of shoes seen from above (two 2x5 lasts): lit toe, dark heel cup, optional stiletto shadow."""
    for sx in (x, x + 3):
        c.r(sx, y, sx + 1, y + 4, col); c.p(sx, y, lt(col, 1.4)); c.r(sx, y + 3, sx + 1, y + 4, dk(col, 0.6))
        c.p(sx + 1, y + 1, dk(col, 0.8))
        if heel: c.p(sx + 1, y + 5, OL)


def handbag_case():
    """Luxury handbag wall vitrine: walnut carcass, brass-framed backlit cubbies with a downlight hot spot,
    six different bag silhouettes (top-handle, chain flap, tote, clutch, quilted, bucket), drawers below."""
    c = C(32, 32)
    c.box(0, 0, 31, 30, WALNUT)
    c.r(1, 1, 30, 2, WALNUT_L); c.r(1, 1, 30, 1, lt(WALNUT_L, 1.15)); c.r(1, 3, 30, 3, GOLD_D)
    slots = [('top', (160, 40, 52)), ('chain', (34, 34, 40)), ('tote', (204, 160, 108)),
             ('clutch', (236, 224, 206)), ('quilt', (60, 92, 150)), ('bucket', (150, 104, 62))]
    for j, y in enumerate((4, 13)):
        for i, x in enumerate((2, 12, 22)):
            c.r(x - 1, y, x + 8, y + 8, GOLD_D)
            c.r(x, y + 1, x + 7, y + 7, BACKLIT_D); c.r(x, y + 1, x + 7, y + 3, BACKLIT); c.r(x + 2, y + 1, x + 5, y + 1, WHITE)
            c.r(x, y + 7, x + 7, y + 7, GOLD)
            kind, col = slots[i + j * 3]
            _bag(c, x + 1, y + 1, kind, col)
            c.p(x + 7, y + 1, WHITE); c.p(x + 6, y + 2, GLASS_L)
    c.r(1, 22, 30, 22, GOLD)
    c.r(1, 23, 30, 28, WALNUT_D); c.r(2, 24, 14, 27, WALNUT); c.r(17, 24, 29, 27, WALNUT)
    c.r(2, 24, 14, 24, WALNUT_L); c.r(17, 24, 29, 24, WALNUT_L)
    c.r(7, 26, 9, 26, GOLD); c.r(22, 26, 24, 26, GOLD)
    c.r(1, 29, 30, 29, dk(WALNUT_D, 0.7)); c.r(1, 31, 31, 31, SH)
    return c.done()
def watch_case():
    """Watch counter: brass-framed glass top over black suede, two rows of watches (gold / steel cases, leather,
    steel and gold straps) with white dials, diagonal glass glare, black lacquer front with a brass brand plaque."""
    c = C(32, 32)
    c.box(0, 5, 31, 19, GOLD_D)
    c.r(1, 6, 30, 18, (40, 34, 44)); c.r(2, 7, 29, 17, (52, 46, 58))
    straps = [(110, 66, 40), STEEL, (34, 34, 40), GOLD_D, (130, 34, 46)]
    for j, y in enumerate((8, 13)):
        for i, x in enumerate(range(3, 27, 6)):
            c.r(x + 1, y - 1, x + 3, y + 5, straps[(i + j * 2) % 5]); c.p(x + 1, y - 1, lt(straps[(i + j * 2) % 5], 1.3))
            c.oval(x, y, x + 4, y + 4, [GOLD, STEEL_L][(i + j) % 2]); c.p(x + 2, y + 2, WHITE); c.p(x + 2, y + 1, CREAM)
            c.p(x + 3, y + 2, OL)
    c.l(2, 17, 4, 15, GLASS_L); c.l(27, 9, 29, 7, GLASS_L)
    c.r(1, 6, 30, 6, lt(GOLD, 1.1))
    c.box(0, 19, 31, 29, (30, 28, 34)); c.r(1, 20, 30, 20, GOLD); c.r(1, 21, 30, 21, (58, 54, 64))
    c.r(11, 23, 20, 26, GOLD_D); c.r(12, 24, 19, 25, (58, 54, 64)); c.r(14, 24, 17, 24, GOLD)
    c.r(1, 28, 30, 28, (18, 16, 22)); c.r(1, 30, 31, 30, SH)
    return c.done()
def jewelry_island():
    """Round jewellery island: brass-rimmed glass drum over violet velvet - three busts with gold necklaces and
    ruby/emerald/sapphire pendants, ring cushions with sparkling stones - on a white marble pedestal with gold band."""
    c = C(32, 32)
    c.e(3, 26, 28, 31, SH)
    c.box(6, 14, 25, 28, MARBLE)
    c.r(7, 15, 9, 27, WHITE); c.r(21, 15, 24, 27, MARBLE_V); c.r(24, 15, 24, 27, dk(MARBLE_V, 0.88))
    c.l(12, 18, 15, 23, MARBLE_V); c.r(7, 24, 24, 24, GOLD); c.r(7, 25, 24, 25, GOLD_D); c.r(7, 27, 24, 27, MARBLE_V)
    c.oval(0, 1, 31, 19, GOLD_D); c.eo(1, 2, 30, 18, GOLD)
    c.e(2, 3, 29, 17, VELVET); c.e(4, 5, 27, 15, VELVET_D)
    for i, x in enumerate((8, 15, 22)):
        c.r(x, 5, x + 2, 5, VELVET_L); c.r(x - 1, 6, x + 3, 9, VELVET_L); c.r(x + 3, 6, x + 3, 9, VELVET)
        for px, py in ((-1, 6), (0, 7), (1, 8), (2, 7), (3, 6)): c.p(x + px, py, GOLD)
        c.p(x + 1, 9, [(230, 40, 70), (40, 200, 110), (60, 120, 240)][i]); c.p(x + 1, 8, lt(GOLD, 1.2))
    for x in (7, 12, 17, 22):
        c.r(x, 12, x + 2, 14, VELVET_L); c.eo(x, 11, x + 2, 13, GOLD); c.p(x + 1, 10, WHITE)
        c.p(x, 10, (200, 230, 255)); c.p(x + 2, 10, (200, 230, 255))
    c.l(4, 9, 8, 4, GLASS_L); c.l(5, 10, 6, 9, WHITE); c.l(23, 16, 27, 12, GLASS_L)
    return c.done()
def luxury_island():
    """Luxury leather-goods island (3x2): two-tier marble plinth under spotlights - top-handle and chain bags on a
    white lacquer riser, heels, loafers and a clutch on the lower tier, warm light pools, walnut base with a gold band."""
    c = C(48, 32)
    c.box(0, 9, 47, 28, MARBLE)
    c.r(1, 10, 46, 10, WHITE); c.l(3, 18, 9, 13, MARBLE_V); c.l(36, 19, 43, 12, MARBLE_V)
    c.r(1, 20, 46, 20, GOLD); c.r(1, 21, 46, 27, WALNUT); c.r(1, 21, 46, 21, WALNUT_L); c.r(1, 27, 46, 27, WALNUT_D)
    for x in (8, 23, 38): c.r(x, 23, x + 1, 25, GOLD_D)
    c.r(1, 29, 47, 30, SH)
    for x0 in (2, 35): c.e(x0, 12, x0 + 10, 19, (255, 250, 238))
    _shoes(c, 4, 12, (190, 30, 44), heel=True); _shoes(c, 37, 12, (110, 66, 40))
    _bag(c, 28, 12, 'clutch', (230, 210, 120))
    c.box(13, 1, 34, 15, WHITE); c.r(14, 2, 33, 7, (252, 252, 252)); c.r(14, 8, 33, 8, WHITE_D); c.r(14, 13, 33, 14, WHITE_D)
    c.e(14, 3, 22, 8, (255, 246, 214)); c.e(25, 3, 33, 8, (255, 246, 214))
    _bag(c, 15, 1, 'top', (160, 40, 52)); _bag(c, 26, 1, 'chain', (34, 34, 40))
    c.r(20, 10, 27, 12, GOLD_D); c.r(21, 11, 26, 11, GOLD)
    return c.done()
def glass_showcase():
    """Jewellery vitrine counter (3x1): brass frame, glass top over violet velvet trays of rings, necklaces and pearl
    earrings with sparkles, diagonal glare, lit glass front showing a lower shelf, black plinth."""
    c = C(48, 32)
    c.box(0, 3, 47, 18, GOLD_D); c.r(1, 4, 46, 4, lt(GOLD, 1.1))
    c.r(1, 5, 46, 17, VELVET_D)
    for x0 in (3, 18, 33): c.rbox(x0, 7, x0 + 11, 16, VELVET); c.r(x0 + 1, 7, x0 + 10, 7, VELVET_L)
    for x in (5, 10):
        for y in (9, 13): c.eo(x - 1, y, x + 1, y + 2, GOLD); c.p(x, y, (190, 220, 255))
    for i, x in enumerate((20, 25)):
        for px, py in ((0, 9), (1, 11), (2, 12), (3, 12), (4, 11), (5, 9)): c.p(x + px, py, GOLD)
        c.p(x + 2, 13, [(230, 40, 70), (40, 200, 110)][i]); c.p(x + 3, 13, [(230, 40, 70), (40, 200, 110)][i])
    for x in (36, 41):
        for y in (9, 13): c.p(x, y, GOLD); c.e(x - 1, y + 1, x + 1, y + 3, (236, 232, 222)); c.p(x - 1, y + 1, WHITE)
    c.l(2, 15, 5, 12, GLASS_L); c.l(44, 9, 46, 7, GLASS_L)
    c.box(0, 17, 47, 28, GOLD_D)
    c.glass(1, 18, 46, 25, (186, 206, 220))
    for x in range(4, 44, 7): c.r(x, 22, x + 3, 24, [VELVET, (230, 220, 200), VELVET_L][x % 3]); c.p(x + 1, 21, GOLD)
    c.r(1, 26, 46, 27, (30, 28, 34)); c.r(1, 26, 46, 26, GOLD)
    c.r(1, 29, 47, 29, SH)
    return c.done()
def sunglasses_stand():
    """Rotating eyewear tower: white column with rows of sunglasses and a small mirror."""
    c = C(16, 32)
    c.box(3, 1, 12, 27, WHITE); c.r(4, 2, 11, 2, WHITE_D)
    for i, y in enumerate((5, 10, 15, 20)):
        col = [BLACK, BROWN, (160, 40, 60), BLUE_D][i]
        c.r(4, y, 6, y + 1, col); c.r(9, y, 11, y + 1, col); c.r(7, y, 8, y, col)
    c.box(5, 23, 10, 26, GLASS)
    c.r(2, 28, 13, 29, STEEL_D)
    return c.done()
def hat_stand():
    """Hat display: tiered round stand with a fedora, beret and straw hat."""
    c = C(16, 32)
    c.r(7, 8, 8, 27, STEEL_D)
    c.oval(1, 3, 9, 8, (60, 50, 44)); c.r(3, 2, 7, 5, (80, 66, 56)); c.r(3, 5, 7, 5, RED)
    c.oval(7, 10, 15, 15, (240, 220, 150)); c.r(9, 9, 13, 12, (250, 232, 170)); c.r(9, 12, 13, 12, BLUE)
    c.oval(2, 16, 10, 21, (150, 40, 60)); c.p(6, 16, OL)
    c.oval(3, 26, 12, 30, STEEL)
    return c.done()
def _fold(c, x, y, col):
    """Folded knit (6x3): lit top fold, collar crease, shaded lower fold."""
    c.r(x, y, x + 5, y + 2, col); c.r(x, y, x + 5, y, lt(col, 1.25)); c.r(x, y + 2, x + 5, y + 2, dk(col, 0.68))
    c.r(x + 2, y + 1, x + 3, y + 1, dk(col, 0.85)); c.p(x + 5, y + 1, dk(col, 0.8))
def scarf_table():
    """Two-tier walnut nesting table: folded sweaters in stacks on the high back tier and the low front tier,
    turned legs, an acrylic price card."""
    c = C(32, 32)
    cols = [(220, 80, 80), (240, 200, 120), (90, 130, 200), (120, 170, 110), (226, 222, 214), (150, 90, 160)]
    c.box(3, 3, 28, 12, WALNUT); c.r(4, 4, 27, 8, WALNUT_L); c.r(4, 4, 27, 4, lt(WALNUT_L, 1.15)); c.r(4, 10, 27, 11, WALNUT_D)
    for x in (4, 26): c.r(x, 12, x + 1, 15, WALNUT_D)
    for i, x in enumerate((5, 12, 19)):
        for j in range(2): _fold(c, x, 5 - j * 2, cols[(i + j) % 6])
    c.box(0, 13, 31, 25, WALNUT); c.r(1, 14, 30, 21, WOOD_L); c.r(1, 14, 30, 14, lt(WOOD_L, 1.12))
    c.r(1, 22, 30, 22, WALNUT_D); c.r(1, 23, 30, 24, WALNUT)
    for x in (1, 29): c.r(x, 25, x + 1, 28, WALNUT_D)
    for i, x in enumerate((2, 9, 16, 23)):
        for j in range(3): _fold(c, x, 18 - j * 2, cols[(i + j + 2) % 6])
    c.box(27, 1, 30, 6, WHITE); c.r(28, 3, 29, 3, RED)
    c.r(1, 29, 31, 29, SH)
    return c.done()


# ------------------------------------------------------------------ cosmetics
def cosmetic_island():
    """Cosmetics island: two oval mirror stations ringed by warm LED glow, rounded white-lacquer counter with a black
    tester tray of gold-cased lipsticks, a pan palette, compacts and a tester bottle; blush brand front with gold logo."""
    c = C(32, 32)
    for x0 in (3, 19):
        c.oval(x0, 0, x0 + 9, 9, (255, 232, 180)); c.e(x0 + 2, 2, x0 + 7, 7, GLASS); c.e(x0 + 2, 5, x0 + 7, 7, GLASS_D)
        c.l(x0 + 3, 5, x0 + 5, 3, WHITE); c.r(x0 + 4, 9, x0 + 5, 11, GOLD_D)
    c.rbox(0, 19, 31, 29, (248, 222, 230)); c.r(1, 27, 30, 27, (255, 196, 216)); c.r(1, 28, 30, 28, dk((248, 222, 230), 0.8))
    c.eo(12, 22, 15, 25, GOLD); c.eo(15, 22, 18, 25, GOLD)
    c.rbox(0, 10, 31, 21, (252, 250, 248)); c.r(2, 11, 29, 11, WHITE); c.r(1, 20, 30, 20, WHITE_D)
    c.rbox(2, 12, 14, 19, (40, 36, 44))
    for i, x in enumerate(range(3, 14, 2)):
        col = [RED, (230, 90, 120), (190, 40, 70), (240, 140, 120), (150, 30, 50), (220, 60, 90)][i]
        c.r(x, 14, x, 16, col); c.p(x, 14, lt(col, 1.4)); c.r(x, 17, x, 18, GOLD)
    c.rbox(16, 12, 24, 19, BLACK)
    for i, (x, y) in enumerate((x, y) for y in (13, 16) for x in (17, 19, 21)):
        col = [(230, 180, 150), (200, 120, 110), (150, 90, 80), (240, 200, 180), (180, 140, 190), (120, 90, 70)][i]
        c.r(x, y, x + 1, y + 1, col); c.p(x, y, lt(col, 1.25))
    c.oval(25, 12, 29, 16, PINK_D); c.p(26, 13, WHITE)
    c.r(27, 17, 28, 19, (250, 210, 220)); c.p(27, 16, GOLD); c.p(27, 17, WHITE)
    c.r(1, 30, 31, 30, SH)
    return c.done()
def _flacon(c, x, yb, kind, col):
    """Perfume bottle standing on y=yb: square, round or tall silhouette, gold or black cap, glass glint."""
    if kind == 'square':
        c.r(x, yb - 4, x + 2, yb, col); c.r(x + 2, yb - 4, x + 2, yb, dk(col, 0.8)); c.r(x + 1, yb - 6, x + 1, yb - 5, GOLD)
    elif kind == 'round':
        c.e(x, yb - 3, x + 2, yb, col); c.p(x + 1, yb - 4, OL); c.p(x + 1, yb - 5, BLACK)
    else:
        c.r(x, yb - 6, x + 1, yb, col); c.r(x + 1, yb - 6, x + 1, yb, dk(col, 0.8)); c.p(x, yb - 7, GOLD); c.p(x + 1, yb - 7, GOLD_D)
    c.p(x, yb - 3, WHITE)
def perfume_wall():
    """Perfume brand wall: cream lacquer wall with six backlit arched niches, mirrored gold shelf lips and pairs of
    square, round and tall flacons in amber, rose, clear and violet glass; drawer plinth below."""
    c = C(32, 32)
    c.box(0, 0, 31, 30, (232, 222, 204))
    c.r(1, 1, 30, 2, (250, 244, 232)); c.r(1, 3, 30, 3, GOLD_D)
    cols = [(232, 170, 60), PINK, (206, 232, 246), (170, 120, 200), (240, 220, 140), (200, 80, 90)]
    kinds = ['square', 'tall', 'round']
    for j, y in enumerate((5, 15)):
        for i, x in enumerate((2, 12, 22)):
            c.r(x + 1, y, x + 6, y, BACKLIT_D); c.r(x, y + 1, x + 7, y + 8, BACKLIT_D)
            c.r(x + 1, y + 1, x + 6, y + 4, BACKLIT); c.r(x + 2, y + 1, x + 5, y + 1, WHITE)
            c.r(x, y + 9, x + 7, y + 9, GOLD)
            k = i + j * 3
            _flacon(c, x + 1, y + 8, kinds[k % 3], cols[k % 6]); _flacon(c, x + 4, y + 8, kinds[(k + 1) % 3], cols[(k + 2) % 6])
    c.r(1, 25, 30, 25, GOLD_D); c.r(1, 26, 30, 28, (210, 196, 170)); c.r(14, 27, 17, 27, GOLD)
    c.r(1, 29, 30, 29, dk((210, 196, 170), 0.75)); c.r(1, 31, 31, 31, SH)
    return c.done()
def skincare_counter():
    """Skincare brand counter: mint counter with jars, pumps and a lit brand panel."""
    c = C(32, 32)
    c.box(2, 1, 29, 8, (150, 210, 200)); c.r(10, 3, 21, 5, WHITE)
    c.block(0, 9, 31, 29, 7, (230, 244, 240), (170, 220, 210))
    for x in range(3, 28, 5):
        c.r(x, 11, x + 2, 14, [WHITE, (250, 230, 220), (200, 230, 240)][x % 3]); c.r(x + 1, 10, x + 1, 10, STEEL_D)
    c.r(2, 21, 29, 21, WHITE); c.r(12, 24, 19, 26, (120, 190, 180))
    return c.done()
def nail_bar():
    """Nail polish bar: tiered wall rack of rainbow nail-polish bottles."""
    c = C(32, 32)
    c.block(0, 2, 31, 30, 2, PINK, WHITE)
    cols = [RED, (240, 120, 160), PURPLE, BLUE, (90, 200, 200), GREEN, YELLOW, ORANGE, BLACK]
    for j, y in enumerate(range(6, 24, 4)):
        for i, x in enumerate(range(2, 30, 3)): c.r(x, y + 1, x + 1, y + 2, cols[(i + j) % 9]); c.p(x, y, BLACK)
        c.r(1, y + 3, 30, y + 3, WHITE_D)
    return c.done()


# ------------------------------------------------------------------ shoes
def shoe_wall():
    """Shoe wall: white floating shelves with heels, loafers and boots, one pair per slot."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, WOOD_L, (244, 240, 232))
    cols = [BLACK, RED, (190, 150, 110), NAVY, (230, 220, 200), BROWN]
    for j, y in enumerate((6, 13, 20)):
        for i, x in enumerate(range(2, 28, 6)):
            col = cols[(i + j * 2) % 6]
            c.r(x, y + 2, x + 4, y + 4, col); c.r(x + 3, y, x + 4, y + 1, col) if j == 2 else c.p(x, y + 1, col)
            c.p(x + 1, y + 2, lt(col, 1.4))
        c.r(1, y + 5, 30, y + 5, WOOD)
    return c.done()
def sneaker_wall():
    """Sneaker wall: lit cubes of colourful trainers with white soles."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, (60, 64, 76), (40, 44, 52))
    cols = [RED, BLUE, (240, 240, 240), YELLOW, GREEN, ORANGE]
    for j, y in enumerate((5, 12, 19)):
        for i, x in enumerate(range(2, 28, 6)):
            c.box(x, y, x + 5, y + 6, (70, 76, 90))
            col = cols[(i + j) % 6]
            c.r(x + 1, y + 2, x + 4, y + 4, col); c.r(x + 1, y + 5, x + 4, y + 5, WHITE); c.p(x + 1, y + 2, lt(col, 1.4))
    return c.done()
def shoe_bench():
    """Try-on bench: padded ottoman with a shoe horn and foot mirror."""
    c = C(32, 32)
    c.block(1, 12, 24, 28, 6, (200, 150, 120), (150, 100, 76))
    for x in (6, 12, 18): c.p(x, 15, (120, 80, 60))
    c.box(26, 10, 30, 28, (176, 200, 214)); c.r(27, 11, 29, 27, GLASS); c.p(27, 12, WHITE)
    c.r(1, 29, 30, 29, SH)
    return c.done()


# ------------------------------------------------------------------ circular racks by colour
def round_rack(cols):
    """Round clothing rack seen 3/4: chrome ring with hangers all around, garments of one colour family."""
    c = C(32, 32)
    c.r(15, 18, 16, 27, STEEL_D); c.oval(9, 26, 22, 30, STEEL)
    c.oval(2, 4, 29, 14, STEEL_D); c.eo(3, 5, 28, 13, STEEL_L)
    for i, x in enumerate(range(3, 29, 3)):                         # garments hang from the front of the ring
        col = cols[i % len(cols)]
        c.box(x - 1, 9, x + 2, 22, col); c.r(x, 10, x + 1, 10, lt(col, 1.3)); c.p(x, 8, STEEL_D)
    for i, x in enumerate(range(5, 27, 3)):                         # back row peeking above
        c.r(x, 5, x + 1, 8, dk(cols[(i + 1) % len(cols)], 0.8))
    return c.done()
def rack_warm(): return round_rack([(220, 60, 60), (240, 120, 70), (200, 40, 60), (250, 160, 90)])
def rack_cool(): return round_rack([(60, 110, 200), (90, 160, 220), (40, 70, 150), (120, 190, 230)])
def rack_mono(): return round_rack([(40, 40, 44), (230, 230, 226), (130, 130, 136), (70, 70, 76)])
def rack_pastel(): return round_rack([(250, 190, 210), (200, 230, 200), (210, 200, 240), (250, 236, 180)])


# ------------------------------------------------------------------ service / structure
def fitting_curtain():
    """Fitting-room booth with a drawn velvet curtain, numbered plate and a stool inside."""
    c = C(32, 48)
    c.block(0, 0, 31, 45, 4, (230, 226, 216), (210, 204, 190), shadow=False)
    c.r(2, 6, 29, 6, STEEL_D)
    c.r(2, 7, 29, 42, (60, 40, 70))
    for x in range(3, 29, 3): c.l(x, 7, x, 42, (100, 70, 120)); c.l(x + 1, 7, x + 1, 42, (80, 56, 100))
    c.r(18, 7, 29, 42, (230, 220, 200)); c.box(22, 32, 27, 37, WOOD)      # half-open: stool visible
    c.box(4, 1, 9, 4, GOLD); c.p(6, 2, OL)
    c.r(1, 46, 31, 46, SH)
    return c.done()
def info_desk():
    """Department-store information desk: curved white desk with gold trim, 'i' sign and a brochure stand."""
    c = C(48, 32)
    c.box(20, 0, 27, 7, (40, 90, 170)); c.r(23, 2, 24, 2, WHITE); c.r(23, 4, 24, 6, WHITE)
    c.r(23, 7, 24, 10, STEEL_D)
    c.box(1, 10, 46, 19, CREAM_D); c.r(2, 11, 45, 18, (250, 246, 236))
    c.box(6, 12, 13, 16, DARK); c.r(7, 13, 12, 14, SCREEN); c.box(32, 12, 38, 16, WHITE); c.r(33, 13, 37, 13, PINK)
    c.box(1, 18, 46, 28, WHITE); c.r(2, 19, 45, 20, GOLD); c.r(2, 26, 45, 27, WHITE_D)
    for x in range(8, 42, 8): c.l(x, 21, x, 25, WHITE_D)
    c.r(2, 29, 47, 29, SH)
    return c.done()
def escalator_pair(up=True):
    """Grand escalator (3x3, wall opening): dark soffit with an LED direction sign, glass balustrades in stainless
    frames under black rubber handrails with amber skirt light, grooved steel treads that deepen toward the floor
    with yellow demarcation edges, a yellow comb plate and a diamond-plate landing with a painted arrow."""
    c = C(48, 48)
    sign = (70, 210, 110) if up else (246, 150, 50)
    c.box(0, 0, 47, 7, (44, 48, 58)); c.r(1, 1, 46, 1, (84, 90, 104))
    c.box(16, 1, 31, 6, BLACK); c.r(17, 2, 30, 5, (18, 20, 26))
    for i in range(3):
        if up: c.r(23 - i, 2 + i, 24 + i, 2 + i, sign)
        else: c.r(23 - i, 5 - i, 24 + i, 5 - i, sign)
    c.r(19, 3, 20, 4, dk(sign, 0.6)); c.r(27, 3, 28, 4, dk(sign, 0.6))
    c.r(10, 8, 37, 37, (34, 36, 44))
    y, n = 8, 0
    while y < 37:
        h = 2 + (y - 8) // 9
        f = 0.55 + 0.45 * (y - 8) / 29 if up else 1.0 - 0.35 * (y - 8) / 29
        tread, groove = dk(STEEL_L, f), dk(STEEL_D, f)
        y1 = min(36, y + h - 1)
        c.r(11, y, 36, y1, tread)
        for gx in range(12, 36, 2): c.r(gx, y, gx, y1, groove)
        c.r(11, y, 11, y1, dk(YELLOW, f)); c.r(36, y, 36, y1, dk(YELLOW, f))
        if up: c.r(11, y1 + 1, 36, y1 + 1, (26, 28, 34))
        else: c.r(11, y, 36, y, dk(STEEL_L, min(1.0, f * 1.15)))
        y = y1 + 2; n += 1
    for x0, x1, rail, led in ((0, 9, 8, 10), (38, 47, 38, 37)):
        c.box(x0, 6, x1, 40, STEEL_D)
        c.glass(x0 + 1, 8, x1 - 1, 38, (168, 206, 224))
        c.r(rail, 6, rail + 1, 40, BLACK); c.r(rail, 6, rail, 40, (70, 72, 84))
        c.r(led, 8, led, 37, (250, 182, 64))
    c.rbox(7, 37, 11, 42, BLACK); c.rbox(36, 37, 40, 42, BLACK); c.p(8, 38, (80, 82, 94)); c.p(37, 38, (80, 82, 94))
    c.r(11, 38, 36, 38, YELLOW)
    for x in range(11, 37, 2): c.p(x, 39, YELLOW_D)
    c.r(11, 40, 36, 40, STEEL_D)
    c.box(0, 41, 47, 46, STEEL); c.dither(1, 42, 46, 45, STEEL_L)
    for i in range(3):
        if up: c.r(23 - i, 42 + i, 24 + i, 42 + i, sign)
        else: c.r(23 - i, 44 - i, 24 + i, 44 - i, sign)
    c.r(1, 47, 47, 47, SH)
    return c.done()
def bag_hook_wall():
    """Accessory wall: pegboard with belts, small leather goods and wallets hung on hooks."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, WOOD_L, (220, 210, 190))
    for x in range(3, 30, 4):
        for y in range(5, 25, 4): c.p(x, y, WOOD_D)
    for i, x in enumerate(range(3, 28, 5)):
        col = [BROWN, BLACK, (180, 60, 60), (200, 160, 110), NAVY][i]
        c.r(x, 6, x + 1, 18, col); c.p(x, 18, GOLD)
        c.box(x, 20, x + 3, 24, dk(col, 1.0)); c.p(x + 1, 22, GOLD)
    return c.done()
def gift_wrap():
    """Gift-wrap counter: paper rolls on a rack, ribbons and wrapped boxes on the counter."""
    c = C(32, 32)
    for i, x in enumerate(range(2, 30, 4)): c.box(x, 1, x + 3, 9, [RED, GOLD, (60, 140, 90), PINK, BLUE, WHITE, PURPLE][i])
    c.r(1, 9, 30, 9, STEEL_D)
    c.block(0, 10, 31, 29, 6, (250, 246, 236), (176, 40, 50))
    c.box(4, 11, 10, 16, (60, 120, 200)); c.r(7, 11, 7, 16, GOLD); c.r(4, 13, 10, 13, GOLD)
    c.box(18, 12, 26, 16, (240, 230, 214)); c.r(22, 12, 22, 16, RED)
    c.r(2, 22, 29, 22, GOLD)
    return c.done()
def tie_case():
    """Necktie and cufflink low case: glass top with rolled ties in a grid."""
    c = C(32, 32)
    c.box(0, 10, 31, 21, (100, 80, 60)); c.r(1, 11, 30, 20, (230, 226, 216))
    cols = [NAVY, RED_D, (60, 110, 80), (120, 60, 110), (180, 150, 80), BLUE_D]
    for j, y in enumerate((12, 16)):
        for i, x in enumerate(range(2, 29, 4)):
            c.oval(x, y, x + 3, y + 3, cols[(i + j) % 6]); c.p(x + 1, y + 1, lt(cols[(i + j) % 6], 1.5))
    c.box(0, 20, 31, 28, WOOD_DD); c.r(1, 21, 30, 21, GOLD_D)
    c.r(1, 29, 31, 29, SH)
    return c.done()
def vip_sofa():
    """VIP lounge loveseat in cream leather with gold legs (north-facing back to the wall)."""
    c = C(32, 32)
    c.box(1, 6, 30, 16, (226, 214, 190)); c.r(2, 7, 29, 8, (244, 236, 220))
    c.box(1, 14, 30, 26, (236, 226, 204)); c.r(2, 15, 29, 16, (250, 244, 232)); c.l(15, 15, 15, 25, (200, 186, 160))
    c.box(0, 10, 4, 26, (214, 200, 174)); c.box(27, 10, 31, 26, (214, 200, 174))
    c.r(2, 27, 3, 29, GOLD); c.r(28, 27, 29, 29, GOLD)
    return c.done()
