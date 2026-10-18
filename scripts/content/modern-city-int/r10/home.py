# R10 cozy home / school / office everyday props (3/4 top view).
from lib import *


# ------------------------------------------------------------------ genkan
def shoe_pile():
    """Genkan shoes: two pairs of sneakers and a pair of loafers lined up on the step (flat, walkable)."""
    c = C(32, 16)
    for x, col in ((2, WHITE), (11, (60, 110, 200)), (21, BROWN)):
        for dx in (0, 4):
            c.oval(x + dx, 4, x + dx + 3, 12, col); c.r(x + dx + 1, 5, x + dx + 2, 6, dk(col, 0.7))
    return c.done()
def umbrella_stand():
    """Umbrella stand: steel tube with three furled umbrellas (red, navy, clear) poking out."""
    c = C(16, 32)
    for x, col, h in ((4, RED, 4), (7, NAVY, 2), (10, (220, 230, 240), 6)):
        c.l(x, h, x, 16, col); c.l(x + 1, h + 2, x + 1, 16, dk(col, 0.7)); c.p(x, h - 1, OL)
    c.block(2, 14, 13, 29, 2, STEEL_L, STEEL)
    c.r(3, 20, 12, 21, STEEL_D)
    return c.done()
def shoe_cabinet():
    """Genkan shoe cabinet: low wood cabinet with louvred doors, keys tray and a small plant on top."""
    c = C(32, 32)
    c.block(0, 10, 31, 29, 4, WOOD_L, WOOD)
    for x0 in (2, 17):
        c.box(x0, 15, x0 + 12, 27, WOOD)
        for y in range(17, 26, 2): c.r(x0 + 2, y, x0 + 10, y, WOOD_D)
    c.box(4, 6, 11, 11, (220, 220, 214)); c.p(6, 8, GOLD); c.p(8, 8, STEEL_D)
    c.box(22, 7, 27, 12, (190, 100, 60)); c.oval(20, 0, 29, 8, LEAF); c.p(23, 2, lt(LEAF, 1.4))
    return c.done()
def school_bag():
    """Randoseru / school bag left on the floor: glossy red flap, silver clasp, side straps."""
    c = C(16, 16)
    c.box(2, 2, 13, 14, RED_D); c.r(3, 3, 12, 8, RED); c.r(4, 3, 11, 3, RED_L)
    c.box(6, 8, 9, 11, STEEL_L); c.r(1, 6, 1, 12, OL); c.r(14, 6, 14, 12, OL)
    return c.done()


# ------------------------------------------------------------------ laundry / bath
def washing_machine():
    """Front-load washing machine: white body, control strip with dial, round porthole door with suds."""
    c = C(16, 32)
    c.block(0, 3, 15, 30, 3, WHITE, WHITE_D)
    c.r(2, 8, 13, 9, DARK_M); c.p(11, 8, SCREEN); c.p(3, 8, GREEN_L)
    c.oval(2, 12, 13, 26, STEEL_D); c.oval(4, 14, 11, 24, (150, 200, 236)); c.r(5, 18, 10, 20, WHITE); c.p(5, 16, GLASS_L)
    return c.done()
def laundry_basket():
    """Woven laundry basket heaped with folded towels and a striped shirt."""
    c = C(16, 16)
    c.oval(1, 1, 14, 8, WHITE); c.r(3, 3, 8, 5, (110, 160, 224)); c.r(8, 4, 12, 6, PINK); c.r(4, 2, 7, 2, WHITE)
    c.box(1, 5, 14, 14, (210, 176, 120))
    for x in range(3, 13, 3): c.l(x, 6, x, 13, (170, 136, 84))
    c.r(2, 9, 13, 9, (170, 136, 84)); c.r(2, 15, 14, 15, SH)
    return c.done()
def drying_rack():
    """Indoor clothes-drying rack: chrome frame with a towel, T-shirt and socks pegged on."""
    c = C(32, 32)
    c.r(1, 6, 30, 7, STEEL_L); c.r(1, 8, 30, 8, STEEL_D)
    c.l(2, 8, 0, 29, STEEL_D); c.l(29, 8, 31, 29, STEEL_D)
    c.box(3, 8, 11, 22, (110, 160, 224)); c.r(4, 9, 10, 9, BLUE_L)
    c.box(13, 8, 21, 18, WHITE); c.r(12, 9, 13, 11, WHITE); c.r(21, 9, 22, 11, WHITE); c.r(15, 12, 19, 12, RED_L)
    c.box(23, 8, 26, 14, PINK); c.box(25, 8, 28, 13, YELLOW)
    c.r(1, 30, 31, 30, SH)
    return c.done()
def vanity_sink():
    """Bathroom vanity: white basin on a wood cabinet, mirror with shelf, toothbrush cup and soap."""
    c = C(32, 32)
    c.box(4, 0, 27, 12, STEEL_L); c.glass(5, 1, 26, 11, (196, 226, 240))
    c.r(4, 13, 27, 14, WHITE)
    c.block(1, 14, 30, 30, 6, WHITE, WOOD)
    c.oval(8, 15, 23, 20, (196, 220, 236)); c.r(15, 15, 16, 16, STEEL); c.p(15, 17, STEEL_D)
    c.r(3, 16, 4, 19, PINK); c.p(3, 15, GREEN_L); c.box(25, 17, 28, 19, (240, 230, 160))
    for x in (8, 22): c.r(x, 24, x + 1, 25, GOLD)
    c.r(16, 22, 16, 29, WOOD_D)
    return c.done()
def bathtub():
    """Japanese ofuro bathtub (2x2): deep white tub with steaming water, lid rolled at the end, bath controller."""
    c = C(32, 32)
    c.block(0, 2, 31, 30, 3, WHITE, WHITE_D)
    c.box(3, 6, 28, 22, (220, 232, 240)); c.r(5, 8, 26, 20, (120, 196, 230)); c.r(6, 9, 25, 10, (170, 222, 244))
    for x in (8, 15, 22): c.l(x, 12, x + 2, 9, (220, 240, 250))
    c.box(3, 6, 8, 22, (160, 170, 150)); c.r(4, 7, 7, 21, (190, 200, 180))
    for y in range(8, 22, 2): c.r(4, y, 7, y, (140, 150, 130))
    c.box(24, 24, 29, 28, DARK); c.r(25, 25, 28, 26, (100, 220, 140))
    return c.done()
def bath_stool():
    """Washing area: small plastic stool and wash bucket (keroyon style) on the tiled floor."""
    c = C(16, 16)
    c.block(1, 6, 8, 14, 2, (240, 210, 120), (210, 170, 70))
    c.oval(8, 2, 15, 9, (250, 230, 120)); c.oval(9, 3, 14, 6, (240, 200, 70)); c.r(10, 9, 13, 13, (210, 170, 70)); c.r(9, 13, 14, 13, OL)
    return c.done()


# ------------------------------------------------------------------ kitchen
def microwave_shelf():
    """Kitchen rack: microwave on top, rice cooker below, toaster on the side - typical small-flat appliance tower."""
    c = C(16, 32)
    c.block(0, 2, 15, 13, 2, WHITE, (230, 230, 226))
    c.r(2, 5, 10, 11, DARK); c.p(3, 6, GLASS_L); c.r(12, 5, 13, 11, STEEL_D); c.p(12, 6, SCREEN)
    c.r(1, 14, 14, 15, STEEL_D)
    c.oval(2, 16, 13, 21, WHITE); c.r(3, 20, 12, 27, WHITE_D); c.r(3, 20, 12, 20, WHITE); c.p(10, 23, (240, 120, 50)); c.r(5, 23, 8, 24, DARK_M)
    c.r(0, 28, 15, 29, STEEL_D); c.r(1, 30, 15, 30, SH)
    return c.done()
def rice_cooker():
    """Rice cooker on the counter: rounded white body, grey lid with steam vent and an orange warm lamp."""
    c = C(16, 16)
    c.oval(1, 1, 14, 8, (200, 204, 212)); c.oval(5, 3, 9, 5, STEEL_D); c.p(10, 4, WHITE)
    c.box(1, 5, 14, 14, WHITE); c.r(2, 5, 13, 6, (200, 204, 212)); c.r(4, 9, 9, 11, DARK_M); c.p(11, 10, ORANGE)
    c.r(2, 15, 14, 15, SH)
    return c.done()
def toaster():
    """Pop-up toaster with two slices of golden bread sticking up."""
    c = C(16, 16)
    c.r(4, 2, 6, 6, (220, 170, 90)); c.r(9, 2, 11, 6, (220, 170, 90)); c.r(4, 2, 6, 2, (240, 210, 140)); c.r(9, 2, 11, 2, (240, 210, 140))
    c.block(1, 5, 14, 14, 3, STEEL_L, (220, 80, 70))
    c.r(3, 6, 7, 7, OL); c.r(8, 6, 12, 7, OL); c.r(13, 10, 13, 12, OL)
    return c.done()
def dish_rack():
    """Sink counter with a dish-drying rack: steel sink and tap on the west half, wire rack of standing plates and
    upside-down cups on the east half, cupboard doors below."""
    c = C(32, 32)
    c.r(1, 2, 30, 4, (230, 226, 216)); c.r(2, 3, 29, 3, (200, 120, 90))              # backsplash tiles
    c.block(0, 5, 31, 30, 10, (226, 228, 232), WHITE_D)
    c.box(2, 7, 13, 13, STEEL_D); c.r(3, 8, 12, 12, STEEL_L); c.r(4, 9, 11, 11, STEEL)  # sink basin
    c.l(7, 4, 7, 8, STEEL_D); c.r(6, 4, 8, 4, STEEL_D)                                   # tap
    c.r(15, 12, 29, 13, STEEL_L); c.r(15, 14, 29, 14, STEEL_D)                           # rack tray
    for x in range(16, 24, 2): c.oval(x, 4, x + 2, 13, WHITE); c.l(x + 1, 6, x + 1, 11, WHITE_D)
    for x, col in ((24, (240, 180, 180)), (26, (180, 210, 240))): c.box(x, 8, x + 3, 12, col)
    for x0 in (2, 16):
        c.box(x0, 17, x0 + 13, 28, WHITE); c.r(x0 + 11, 21, x0 + 11, 24, STEEL_D)
    return c.done()
def dining_table4():
    """Family dining table (2x2) laid for dinner: four rice bowls, miso, a shared grill dish and soy bottle."""
    c = C(32, 32)
    c.block(0, 4, 31, 26, 15, WOOD_L, WOOD)
    for x, y in ((4, 6), (22, 6), (4, 13), (22, 13)):
        c.oval(x, y, x + 5, y + 4, WHITE); c.r(x + 1, y + 1, x + 4, y + 2, (250, 250, 240)); c.l(x + 6, y, x + 6, y + 4, BROWN_D)
    c.oval(11, 8, 20, 14, (60, 90, 140)); c.r(13, 10, 18, 12, (200, 120, 70)); c.r(14, 10, 17, 10, (240, 180, 120))
    c.r(15, 5, 16, 7, BLACK)
    for x in (2, 28): c.r(x, 27, x + 1, 30, WOOD_D)
    c.r(1, 31, 31, 31, SH)
    return c.done()


# ------------------------------------------------------------------ living
def kotatsu():
    """Kotatsu (2x2): quilted futon skirt in warm checks under a square wood top with mikan bowl and remote."""
    c = C(32, 32)
    c.oval(0, 6, 31, 31, (176, 70, 70))
    for x in range(4, 30, 6): c.l(x, 8, x, 29, (150, 50, 56))
    for y in range(10, 30, 6): c.l(2, y, 29, y, (150, 50, 56))
    c.block(5, 4, 26, 22, 12, WOOD_L, WOOD)
    c.oval(12, 6, 20, 13, (230, 220, 200))
    for x, y in ((14, 7), (16, 8), (13, 9), (17, 10)): c.ball(x, y, 2, ORANGE)
    c.box(21, 13, 24, 16, DARK)
    return c.done()
def floor_lamp():
    """Arc floor lamp: round marble base, slim stem, warm drum shade glowing."""
    c = C(16, 32)
    c.oval(3, 0, 13, 9, (250, 230, 170)); c.r(5, 2, 11, 7, (255, 244, 200)); c.r(4, 7, 12, 8, (220, 190, 120))
    c.r(7, 9, 8, 26, (90, 80, 70)); c.oval(3, 25, 12, 30, (220, 220, 214)); c.r(5, 26, 10, 27, WHITE)
    return c.done()
def electric_fan():
    """Standing electric fan: round grille with blue blades, neck, round base."""
    c = C(16, 32)
    c.oval(0, 0, 15, 15, STEEL_L); c.oval(2, 2, 13, 13, (200, 220, 236))
    for x0, y0, x1, y1 in ((7, 3, 8, 7), (3, 7, 7, 8), (8, 8, 12, 8), (7, 8, 8, 12)): c.r(x0, y0, x1, y1, (110, 170, 230))
    c.oval(6, 6, 9, 9, WHITE)
    c.r(7, 15, 8, 26, STEEL_D); c.oval(2, 25, 13, 30, WHITE); c.r(5, 27, 6, 27, BLUE)
    return c.done()
def wall_ac():
    """Wall-mounted split air conditioner (hang): white unit with louver and a little blue status lamp."""
    c = C(32, 32)
    c.box(1, 4, 30, 16, WHITE); c.r(2, 5, 29, 6, (250, 250, 250))
    for x in range(4, 28, 3): c.p(x, 9, WHITE_D)
    c.r(2, 13, 29, 15, WHITE_D); c.r(3, 14, 28, 14, STEEL_D); c.p(25, 11, (90, 180, 240))
    return c.done()
def cat_bed():
    """Round cat cushion with a sleeping ginger cat curled up."""
    c = C(16, 16)
    c.oval(0, 3, 15, 15, (200, 140, 170)); c.oval(2, 5, 13, 13, (240, 200, 220))
    c.oval(4, 6, 12, 12, (240, 160, 70)); c.l(5, 9, 11, 9, (200, 110, 40)); c.r(10, 6, 11, 7, (240, 160, 70)); c.p(10, 5, OL); c.p(12, 6, OL)
    return c.done()
def laptop_desk():
    """Study/work desk with an open laptop, mug and lamp (facing the wall)."""
    c = C(32, 32)
    c.block(0, 10, 31, 28, 10, WOOD_L, WOOD)
    c.box(8, 2, 21, 12, DARK); c.r(9, 3, 20, 11, SCREEN); c.r(10, 4, 16, 5, WHITE); c.r(10, 7, 18, 7, SCREEN_D)
    c.box(7, 12, 22, 16, STEEL_L); c.r(8, 13, 21, 15, STEEL)
    c.box(24, 12, 28, 17, WHITE); c.r(25, 13, 27, 13, (130, 80, 50))
    c.l(3, 3, 3, 14, DARK); c.oval(1, 1, 7, 5, (250, 220, 120)); c.r(1, 14, 5, 15, DARK)
    for x in (1, 29): c.r(x, 29, x + 1, 31, WOOD_D)
    return c.done()
def bookshelf_low():
    """Low living-room shelf: manga row, framed family photo, small speaker - not a library bookcase."""
    c = C(32, 32)
    c.block(0, 8, 31, 30, 3, WOOD_L, WOOD_D)
    c.r(1, 13, 30, 19, WOOD_DD)
    for i, x in enumerate(range(2, 16, 2)): c.pack(x, 13, 2, 6, [RED, BLUE, YELLOW, GREEN, PINK, WHITE, ORANGE][i % 7])
    c.box(18, 13, 24, 19, DARK); c.oval(19, 14, 23, 18, DARK_M)
    c.r(1, 21, 30, 21, WOOD); c.r(1, 22, 30, 28, WOOD_DD)
    c.box(3, 22, 13, 28, CREAM); c.r(5, 23, 11, 27, (140, 190, 220))
    c.box(6, 2, 14, 9, GOLD); c.r(7, 3, 13, 8, (170, 210, 220)); c.p(9, 5, SKIN); c.p(11, 5, SKIN)
    c.oval(22, 2, 29, 9, LEAF)
    return c.done()
def potted_monstera():
    """Large monstera in a white pot - split leaves."""
    c = C(16, 32)
    c.oval(0, 0, 15, 20, LEAF_D); c.oval(2, 2, 13, 17, LEAF)
    for y in (5, 9, 13): c.l(4, y, 7, y + 1, LEAF_D); c.l(9, y + 1, 12, y, LEAF_D)
    c.l(7, 3, 8, 18, LEAF_D)
    c.block(3, 19, 12, 30, 2, WHITE, WHITE_D)
    return c.done()
def floor_cushions():
    """Pair of zabuton floor cushions with a tea tray between them (flat, walkable)."""
    c = C(32, 16)
    c.box(1, 2, 12, 14, (120, 90, 160)); c.r(2, 3, 11, 4, (150, 120, 190)); c.p(6, 8, GOLD)
    c.box(19, 2, 30, 14, (60, 110, 120)); c.r(20, 3, 29, 4, (90, 140, 150)); c.p(24, 8, GOLD)
    c.oval(13, 5, 18, 10, (150, 108, 52)); c.p(15, 7, (120, 180, 110))
    return c.done()


# ------------------------------------------------------------------ school / office
def teacher_podium():
    """Classroom teacher's lectern: wood podium with attendance book and chalk box."""
    c = C(32, 32)
    c.block(2, 8, 29, 29, 7, WOOD_L, WOOD)
    c.box(6, 9, 15, 14, (60, 110, 190)); c.r(7, 10, 14, 10, BLUE_L)
    c.box(19, 10, 25, 14, WHITE); for_ = [WHITE, YELLOW, PINK]
    for i, col in enumerate(for_): c.r(20 + i * 2, 11, 20 + i * 2, 13, col)
    c.r(4, 20, 27, 21, WOOD_D)
    return c.done()
def cleaning_locker():
    """Classroom cleaning locker: tall grey steel cabinet with vent slits, a broom and dustpan leaning on it."""
    c = C(16, 32)
    c.block(1, 0, 14, 30, 2, STEEL_L, (150, 160, 170))
    for y in (5, 7, 9): c.r(4, y, 11, y, STEEL_D)
    c.r(11, 15, 12, 18, STEEL_D)
    c.l(0, 6, 3, 28, (200, 170, 100)); c.r(0, 26, 4, 30, (60, 140, 84))
    return c.done()
def water_cooler():
    """Office water dispenser: blue bottle on a white stand, hot/cold taps, paper cup sleeve."""
    c = C(16, 32)
    c.oval(3, 0, 12, 4, (150, 200, 240)); c.box(3, 2, 12, 12, (110, 170, 230)); c.r(4, 3, 6, 11, (170, 220, 250))
    c.block(1, 12, 14, 30, 2, WHITE, WHITE_D)
    c.r(4, 17, 5, 19, RED); c.r(10, 17, 11, 19, BLUE); c.r(3, 22, 12, 23, STEEL_D)
    c.r(13, 14, 14, 24, WHITE); c.r(13, 14, 14, 14, STEEL)
    return c.done()
def copier():
    """Office multifunction copier: grey body, scanner lid, touch panel, output tray with pages, paper drawers."""
    c = C(32, 32)
    c.box(2, 2, 29, 9, (230, 230, 226)); c.r(3, 3, 28, 4, WHITE); c.box(20, 4, 27, 8, DARK); c.r(21, 5, 26, 7, SCREEN)
    c.block(1, 8, 30, 30, 4, (220, 222, 226), (190, 194, 200))
    c.r(4, 12, 18, 14, WHITE); c.r(4, 14, 18, 14, WHITE_D)
    for y in (18, 23): c.box(3, y, 28, y + 4, (176, 180, 188)); c.r(13, y + 2, 18, y + 2, DARK_M)
    return c.done()
def whiteboard_stand():
    """Rolling whiteboard with marker scribbles, a sticky-note cluster and marker tray."""
    c = C(32, 32)
    c.box(0, 0, 31, 22, STEEL_L); c.r(1, 1, 30, 21, WHITE)
    c.l(3, 5, 14, 5, BLUE); c.l(3, 8, 10, 8, BLUE); c.l(4, 12, 9, 16, RED); c.l(9, 16, 16, 10, RED)
    for x, y, col in ((20, 3, YELLOW), (25, 3, PINK), (20, 8, (150, 220, 160))): c.r(x, y, x + 3, y + 3, col)
    c.r(2, 22, 29, 23, STEEL_D); c.r(5, 22, 7, 22, RED); c.r(9, 22, 11, 22, BLUE)
    c.l(4, 24, 4, 29, STEEL_D); c.l(27, 24, 27, 29, STEEL_D); c.r(1, 29, 30, 29, STEEL_D)
    for x in (2, 6, 25, 29): c.oval(x - 1, 29, x + 1, 31, BLACK)
    return c.done()
