# R10 hypermarket / convenience-store merchandise (3/4 top view).
from lib import *


# ------------------------------------------------------------------ produce
def crate_stand(fill_fn, w=32, top_col=WOOD_L, face=WOOD):
    """Angled wooden crate table: produce heaped on the tilted top, slatted crate front, small price card."""
    c = C(w, 32)
    c.box(1, 7, w - 2, 20, dk(top_col, 0.8))                 # tilted bed seen from above
    c.r(2, 8, w - 3, 19, (196, 160, 104))
    fill_fn(c)
    c.box(1, 19, w - 2, 29, face)                             # crate front
    for x in range(2, w - 2, 5): c.l(x, 20, x, 28, WOOD_D)
    c.r(2, 24, w - 3, 24, WOOD_D)
    c.box(w // 2 - 4, 21, w // 2 + 3, 26, WHITE); c.r(w // 2 - 2, 23, w // 2 + 1, 23, RED)  # price card
    c.r(2, 30, w - 2, 30, SH)
    return c.done()


def heap(c, x0, x1, y0, y1, col, r=2, step=4, alt=None):
    for j, y in enumerate(range(y1, y0 - 1, -3)):
        inset = j * 2
        for i, x in enumerate(range(x0 + inset + r, x1 - inset - r + 1, step)):
            c.ball(x, y, r, alt if alt and (i + j) % 3 == 0 else col)


def fruit_apple(): return crate_stand(lambda c: heap(c, 3, 28, 9, 17, (214, 48, 52), alt=(170, 196, 64)))
def fruit_orange(): return crate_stand(lambda c: heap(c, 3, 28, 9, 17, (246, 150, 40)))
def fruit_banana():
    def f(c):
        for x in range(3, 28, 6):
            for y in (10, 14):
                c.l(x, y + 3, x + 4, y, YELLOW_D); c.l(x, y + 2, x + 4, y - 1, YELLOW); c.l(x + 1, y + 2, x + 4, y, (252, 230, 110))
                c.p(x + 4, y - 1, BROWN)
    return crate_stand(f)
def fruit_watermelon():
    def f(c):
        for x in (7, 16, 25):
            c.oval(x - 5, 9, x + 4, 18, (64, 140, 64))
            for dx in (-3, 0, 3): c.l(x + dx, 10, x + dx, 17, (36, 92, 40))
            c.p(x - 2, 11, (150, 210, 120))
        c.r(10, 11, 14, 12, RED); c.r(10, 13, 14, 13, (60, 30, 30))  # cut half
    return crate_stand(f)
def veg_pyramid():
    def f(c):
        for x in range(4, 14, 5): c.ball(x, 14, 3, (120, 190, 90)); c.p(x, 12, (200, 236, 170))     # cabbages
        for x in range(17, 31, 3): c.l(x, 10, x + 1, 17, ORANGE); c.p(x, 9, LEAF)                    # carrots
        heap(c, 32, 45, 9, 17, (226, 54, 48), r=2, step=4)                                           # tomatoes
    return crate_stand(f, w=48)
def veg_wall():
    """Refrigerated produce wall case: misted green tiers of leaf veg, broccoli and peppers under a lit header."""
    c = C(32, 32)
    c.block(0, 2, 31, 30, 3, (70, 120, 80), (230, 236, 232))
    c.r(1, 6, 30, 7, (120, 200, 140))
    for i, y in enumerate((9, 15, 21)):
        c.r(2, y + 5, 29, y + 5, STEEL_D)
        for x in range(2, 29, 4):
            col = [(100, 176, 80), (60, 128, 60), (226, 70, 50), (240, 196, 50)][(x // 4 + i) % 4]
            c.ball(x + 1, y + 2, 2, col)
    c.r(2, 27, 29, 28, STEEL_D)
    return c.done()
def scale_counter():
    """Produce weighing station: small steel counter with a digital scale and a roll of bags."""
    c = C(16, 32)
    c.block(1, 12, 14, 29, 4, STEEL_L, STEEL)
    c.box(3, 9, 12, 14, WHITE); c.r(4, 10, 11, 11, STEEL_L)
    c.box(4, 4, 11, 9, DARK); c.r(5, 5, 10, 7, (120, 220, 120))
    c.e(9, 19, 13, 23, WHITE_D); c.p(11, 21, STEEL_D)
    return c.done()


# ------------------------------------------------------------------ fresh: fish / meat / deli
def fish_ice():
    """Open ice bed fishmonger table: crushed ice top with whole fish, salmon fillets and shellfish, steel front."""
    c = C(48, 32)
    c.box(0, 8, 47, 22, ICE_D); c.r(1, 9, 46, 21, ICE)
    for x in range(2, 46, 3):
        for y in range(10, 21, 3): c.p(x + (y % 2), y, WHITE)
    for x, y in ((4, 11), (4, 16), (14, 11)):
        c.r(x, y, x + 7, y + 2, (120, 140, 160)); c.r(x, y, x + 7, y, (190, 206, 220)); c.p(x + 1, y + 1, OL)
        c.l(x + 8, y, x + 9, y + 2, (90, 106, 124))
    for x in range(24, 35, 4): c.box(x, 11, x + 3, 19, (246, 140, 96)); c.l(x + 1, 13, x + 2, 17, (252, 200, 170))
    for x in range(37, 45, 3): c.ball(x, 17, 1, (60, 60, 80)); c.ball(x + 1, 12, 1, (220, 110, 80))
    c.box(0, 21, 47, 29, STEEL); c.r(1, 22, 46, 22, STEEL_L); c.r(1, 27, 46, 28, STEEL_D)
    c.r(1, 30, 47, 30, SH)
    return c.done()
def meat_showcase():
    """3-wide serve-over butcher case: curved glass front over rows of red meat trays, white base."""
    c = C(48, 32)
    c.block(0, 3, 47, 30, 3, (190, 40, 50), WHITE)
    c.glass(1, 7, 46, 21, (210, 232, 240))
    for i, y in enumerate((9, 15)):
        for x in range(3, 44, 5):
            c.box(x, y, x + 4, y + 4, WHITE)
            c.r(x + 1, y + 1, x + 3, y + 3, [(196, 50, 60), (226, 110, 110), (170, 40, 50)][(x // 5 + i) % 3])
            c.p(x + 1, y + 1, (250, 220, 220))
    c.r(1, 22, 46, 22, STEEL_D)
    c.r(2, 24, 45, 26, (240, 240, 240)); c.r(4, 25, 12, 25, RED)
    return c.done()
def salmon_tray():
    """Low refrigerated sashimi case: open tilted top of salmon, tuna and sushi packs on black trays."""
    c = C(32, 32)
    c.box(0, 10, 31, 22, (40, 44, 56)); c.r(1, 11, 30, 21, (190, 222, 236))
    cols = [(246, 140, 96), (196, 40, 60), (246, 140, 96), (240, 220, 200)]
    for i, (x, y) in enumerate((x, y) for y in (12, 17) for x in (2, 9, 16, 23)):
        c.box(x, y, x + 6, y + 4, BLACK); c.r(x + 1, y + 1, x + 5, y + 2, cols[(i + y) % 4]); c.p(x + 5, y + 3, LEAF)
    c.box(0, 21, 31, 29, WHITE); c.r(1, 22, 30, 22, WHITE_D); c.r(2, 25, 29, 26, (60, 130, 200))
    c.r(1, 30, 31, 30, SH)
    return c.done()
def egg_stand():
    """Egg tower: stepped wooden stand stacked with white and brown egg cartons."""
    c = C(16, 32)
    c.block(1, 18, 14, 29, 2, WOOD_L, WOOD)
    for i, y in enumerate((4, 9, 14)):
        c.box(1 + i, y, 14 - i, y + 5, (222, 226, 214))
        for x in range(3 + i, 13 - i, 2): c.p(x, y + 2, (246, 236, 214) if i % 2 else (216, 170, 120))
    c.box(4, 22, 11, 26, YELLOW); c.r(6, 24, 9, 24, RED)
    return c.done()


# ------------------------------------------------------------------ bakery
def baguette_basket():
    """Wicker basket of baguettes and rolls on a low stand."""
    c = C(16, 32)
    for x, tilt in ((3, 1), (6, -1), (9, 1), (11, -1)):
        c.l(x, 6, x + tilt * 2, 19, OL); c.l(x + 1, 6, x + 1 + tilt * 2, 19, (220, 160, 80)); c.p(x + 1, 8, (246, 210, 140))
    c.box(1, 15, 14, 28, (176, 128, 64))
    for y in range(17, 27, 3): c.l(2, y, 13, y, (136, 92, 44))
    for x in range(3, 13, 3): c.l(x, 16, x, 27, (204, 160, 96))
    c.r(2, 29, 14, 29, SH)
    return c.done()
def cake_showcase():
    """Bakery cake showcase: wooden base, glass display with whole cakes and slices on two shelves."""
    c = C(32, 32)
    c.block(0, 2, 31, 30, 2, WOOD_L, WOOD)
    c.glass(1, 5, 30, 21, (226, 238, 242))
    for x, col in ((3, WHITE), (11, (120, 70, 50)), (19, PINK), (25, (250, 230, 160))):
        c.box(x, 8, x + 5, 12, col); c.p(x + 2, 8, RED); c.r(x + 1, 11, x + 4, 11, dk(col, 0.85))
    c.r(1, 14, 30, 14, STEEL_L)
    for x in range(3, 29, 5): c.box(x, 16, x + 3, 19, (250, 236, 200)); c.p(x + 1, 16, RED)
    c.r(1, 22, 30, 22, WOOD_D); c.r(4, 25, 27, 26, WOOD_D)
    return c.done()
def donut_case():
    """Self-serve donut case: tilted glass doors over tiers of glazed donuts (pink, chocolate, sugar)."""
    c = C(32, 32)
    c.block(0, 4, 31, 30, 2, (230, 120, 150), (250, 240, 236))
    c.glass(1, 7, 30, 22, (236, 244, 246))
    cols = [PINK, (120, 72, 50), (250, 230, 190), (250, 200, 60)]
    for j, y in enumerate((10, 16)):
        for i, x in enumerate(range(4, 29, 6)):
            c.oval(x - 3, y - 2, x + 2, y + 2, cols[(i + j) % 4]); c.p(x, y, OL); c.p(x - 2, y - 1, WHITE)
    c.r(1, 23, 30, 23, (210, 190, 186)); c.r(14, 25, 17, 27, STEEL_D)
    return c.done()
def bread_rack():
    """Packaged-bread wall rack: open wire shelves of sliced loaves and buns in printed bags."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, STEEL_L, (236, 232, 222))
    for j, y in enumerate((5, 12, 19)):
        for i, x in enumerate(range(2, 28, 7)):
            c.box(x, y, x + 6, y + 5, (250, 240, 214)); c.r(x + 1, y + 1, x + 5, y + 2, (214, 160, 90))
            c.r(x + 2, y + 3, x + 4, y + 3, [RED, BLUE, YELLOW_D, GREEN][(i + j) % 4])
        c.r(1, y + 6, 30, y + 6, STEEL_D)
    return c.done()


# ------------------------------------------------------------------ coolers / open cases
def open_cooler(fill_fn, header=(60, 120, 200)):
    c = C(32, 32)
    c.block(0, 0, 31, 30, 3, header, (226, 232, 238))
    c.r(1, 4, 30, 5, lt(header, 1.4))
    c.r(1, 6, 30, 26, (40, 52, 70))
    fill_fn(c)
    c.r(1, 27, 30, 28, STEEL); c.r(1, 27, 30, 27, STEEL_L)
    return c.done()
def dairy_open():
    def f(c):
        for j, y in enumerate((7, 14, 21)):
            for i, x in enumerate(range(2, 29, 4)):
                if j < 2:
                    c.r(x, y, x + 2, y + 5, WHITE); c.p(x + 1, y, (120, 170, 230)); c.r(x, y + 3, x + 2, y + 3, [(60, 120, 220), RED, (240, 190, 40)][(i + j) % 3])
                else:
                    c.box(x, y + 1, x + 3, y + 4, [PINK, WHITE, (250, 220, 120)][i % 3])
            c.r(1, y + 6, 30, y + 6, STEEL_D)
    return open_cooler(f, (70, 130, 210))
def drink_open():
    def f(c):
        cols = [(220, 60, 50), (60, 160, 90), (250, 160, 40), (90, 140, 230), (240, 240, 240)]
        for j, y in enumerate((7, 14, 21)):
            for i, x in enumerate(range(2, 29, 3)): c.bottle(x, y, cols[(i + j * 2) % 5], 6)
            c.r(1, y + 6, 30, y + 6, STEEL_D)
    return open_cooler(f, (220, 70, 60))
def liquor_case():
    """Glass-door soju/beer fridge: green soju bottles, amber beer and silver cans behind two doors."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 3, (40, 120, 70), DARK_M)
    c.glass(1, 5, 15, 27, (40, 60, 70)); c.glass(16, 5, 30, 27, (40, 60, 70))
    for j, y in enumerate((7, 14, 21)):
        for x in range(2, 14, 3): c.bottle(x, y, (70, 170, 100) if j < 2 else (176, 110, 40), 6)
        for x in range(17, 29, 4): c.can(x, y + 2, [STEEL_L, (220, 200, 60), (60, 90, 170)][j])
    c.r(15, 5, 16, 27, OL); c.r(13, 14, 13, 18, STEEL_L); c.r(18, 14, 18, 18, STEEL_L)
    return c.done()


# ------------------------------------------------------------------ gondolas by product family
def gondola(fill_row, cap=(214, 58, 66)):
    """Double-sided aisle gondola from the south: steel cap with a coloured category strip, three shelves of goods."""
    c = C(32, 32)
    c.block(1, 5, 30, 29, 2, STEEL_L, (236, 236, 230))
    c.r(2, 8, 29, 9, cap); c.r(4, 8, 8, 8, WHITE)
    for k, y in enumerate((11, 17, 23)):
        fill_row(c, y, k)
        c.r(2, y + 5, 29, y + 5, STEEL_D)
    return c.done()
def g_ramen():
    def row(c, y, k):
        for i, x in enumerate(range(2, 28, 4)):
            col = [(214, 46, 46), (240, 120, 40), (180, 30, 40)][(i + k) % 3]
            if k == 0: c.r(x, y + 1, x + 2, y + 4, col); c.r(x, y + 1, x + 2, y + 1, WHITE)        # cup noodles
            else: c.pack(x, y + 1, 4, 4, col); c.p(x + 1, y + 2, YELLOW)
    return gondola(row, (214, 46, 46))
def g_snack():
    def row(c, y, k):
        for i, x in enumerate(range(2, 27, 5)):
            col = [(246, 200, 40), (240, 150, 40), (250, 230, 120)][(i + k) % 3]
            c.r(x + 1, y, x + 3, y, dk(col, 0.8)); c.r(x, y + 1, x + 4, y + 4, col); c.p(x + 2, y + 2, RED)
    return gondola(row, (240, 190, 40))
def g_tea():
    def row(c, y, k):
        for i, x in enumerate(range(2, 29, 3)): c.bottle(x, y - 1, [(70, 160, 80), (40, 120, 60), (150, 200, 90)][(i + k) % 3], 6)
    return gondola(row, (60, 150, 80))
def g_water():
    def row(c, y, k):
        if k == 2:
            for x in range(2, 26, 7): c.box(x, y - 1, x + 6, y + 4, (160, 200, 240)); c.r(x + 1, y, x + 5, y + 1, BLUE)
            return
        for i, x in enumerate(range(2, 29, 3)): c.bottle(x, y - 1, [(150, 200, 246), (90, 150, 230)][(i + k) % 2], 6)
    return gondola(row, (60, 120, 210))
def g_cereal():
    def row(c, y, k):
        for i, x in enumerate(range(2, 27, 5)):
            col = [(150, 80, 190), (230, 90, 160), (110, 70, 160), (240, 180, 60)][(i + k) % 4]
            c.pack(x, y - 1, 4, 6, col); c.p(x + 1, y + 1, YELLOW)
    return gondola(row, (130, 80, 180))
def g_cans():
    def row(c, y, k):
        for i, x in enumerate(range(2, 28, 4)): c.can(x, y + 1, [(206, 50, 50), (60, 110, 190), (240, 190, 50), STEEL][(i + k) % 4])
    return gondola(row, (120, 130, 150))
def g_detergent():
    def row(c, y, k):
        for i, x in enumerate(range(2, 26, 6)):
            col = [(60, 140, 230), (240, 100, 160), (250, 250, 250), (100, 200, 200)][(i + k) % 4]
            c.r(x, y, x + 4, y + 4, col); c.r(x + 3, y - 1, x + 4, y - 1, dk(col, 0.6)); c.r(x, y, x + 4, y, lt(col, 1.3))
    return gondola(row, (60, 160, 210))
def g_household():
    def row(c, y, k):
        if k == 0:
            for x in range(2, 27, 5): c.box(x, y, x + 4, y + 4, WHITE); c.e(x + 1, y + 1, x + 3, y + 3, (230, 230, 230))   # toilet rolls
        elif k == 1:
            for i, x in enumerate(range(2, 27, 5)): c.pack(x, y, 5, 4, [(240, 160, 200), (160, 200, 240)][i % 2])         # tissue boxes
        else:
            for i, x in enumerate(range(2, 28, 3)): c.r(x, y + 1, x + 1, y + 4, [(250, 120, 40), (60, 180, 120), WHITE][i % 3])
    return gondola(row, (240, 140, 180))


# ------------------------------------------------------------------ frozen
def chest_freezer(fill_fn, lid=(180, 220, 240)):
    c = C(32, 32)
    c.box(0, 12, 31, 22, STEEL_D); c.r(1, 13, 30, 21, lid)
    fill_fn(c)
    for x in (10, 21): c.r(x, 13, x, 21, STEEL)
    c.box(0, 21, 31, 29, WHITE); c.r(1, 22, 30, 22, WHITE_D); c.r(1, 27, 30, 28, (60, 110, 200))
    c.r(1, 30, 31, 30, SH)
    return c.done()
def frozen_dumpling():
    def f(c):
        for i, (x, y) in enumerate((x, y) for y in (14, 18) for x in range(2, 29, 5)):
            col = [(240, 240, 236), (220, 60, 60), (250, 200, 80)][(i + y) % 3]
            c.box(x, y, x + 4, y + 3, col); c.p(x + 2, y + 1, (120, 160, 220))
    return chest_freezer(f)
def ice_cream_chest():
    def f(c):
        cols = [PINK, (120, 80, 50), (250, 240, 200), (150, 210, 120), (190, 150, 230)]
        for i, (x, y) in enumerate((x, y) for y in (14, 18) for x in range(2, 29, 3)):
            c.r(x, y, x + 1, y + 2, cols[(i * 2 + y) % 5]); c.p(x, y, WHITE)
    return chest_freezer(f, (200, 230, 250))
def sample_cart():
    """Tasting-corner cart: small cart with a hot plate, sample cups on toothpicks and a striped umbrella overhead."""
    c = C(16, 32)
    c.e(0, 1, 15, 9, OL); c.e(1, 2, 14, 8, RED)
    for x in (3, 8, 12): c.l(x, 3, x, 7, WHITE)
    c.r(7, 9, 8, 14, STEEL_D)
    c.block(1, 14, 14, 28, 4, STEEL_L, (220, 80, 70))
    c.box(3, 13, 8, 17, DARK); c.r(4, 14, 7, 15, (200, 120, 70))
    for x in (10, 12): c.p(x, 15, WHITE); c.p(x, 14, WOOD)
    c.r(3, 22, 12, 23, WHITE)
    return c.done()
def sale_endcap():
    """Special-price endcap: stacked carton tower with a big yellow 'sale' board on a pole."""
    c = C(16, 32)
    c.r(7, 2, 8, 12, STEEL_D)
    c.box(1, 0, 14, 7, YELLOW); c.r(3, 2, 12, 3, RED); c.r(5, 5, 10, 5, RED)
    for i, y in enumerate((10, 16, 22)):
        c.block(1, y, 14, y + 6, 1, lt((200, 150, 90)), (190, 140, 80), shadow=False)
        c.r(4, y + 3, 11, y + 4, [RED, BLUE, GREEN][i])
    c.r(2, 29, 14, 29, SH)
    return c.done()
def self_checkout():
    """Self-checkout kiosk: touch screen pillar, scanner glass, card reader and bagging shelf."""
    c = C(16, 32)
    c.box(3, 1, 12, 12, DARK); c.r(4, 2, 11, 10, SCREEN); c.r(5, 3, 10, 4, (180, 230, 250)); c.r(5, 7, 8, 8, (40, 200, 120))
    c.block(1, 12, 14, 29, 5, (220, 224, 230), (90, 96, 110))
    c.r(3, 14, 9, 16, (70, 200, 120)); c.r(11, 14, 12, 16, OL)
    c.r(3, 21, 12, 22, (40, 44, 52)); c.r(3, 25, 12, 25, STEEL_L)
    return c.done()
def cart_row():
    """Shopping-cart bay: four nested steel carts seen from above-front - open wire baskets, red push handles."""
    c = C(32, 32)
    for i, x in enumerate((19, 13, 7, 1)):
        c.r(x, 8, x + 11, 9, RED_D); c.r(x, 8, x + 11, 8, RED_L)          # push handle (north, toward the wall)
        c.box(x, 10, x + 11, 15, STEEL_D); c.r(x + 1, 11, x + 10, 14, (90, 96, 110))   # open basket top
        for gx in range(x + 2, x + 10, 2): c.p(gx, 12, STEEL_L)
        c.box(x + 1, 15, x + 10, 22, STEEL)                                 # wire front face
        for gx in range(x + 2, x + 10, 2): c.l(gx, 16, gx, 21, STEEL_L)
        c.r(x + 2, 23, x + 9, 24, STEEL_D)                                  # lower tray
    for x in (2, 10, 14, 20, 26, 30): c.box(x - 1, 25, x + 1, 28, BLACK)
    c.r(1, 29, 31, 29, SH)
    return c.done()
def basket_stacker():
    """Shopping-basket stacker: wheeled stand with a tall stack of blue and orange baskets."""
    c = C(16, 32)
    for i, y in enumerate(range(4, 22, 3)):
        col = (60, 120, 210) if i % 3 else (240, 140, 50)
        c.box(1, y, 14, y + 4, col); c.r(2, y + 1, 13, y + 1, lt(col, 1.3))
        for x in range(3, 13, 3): c.p(x, y + 3, dk(col, 0.6))
    c.box(0, 24, 15, 27, STEEL_D); c.box(1, 27, 3, 29, BLACK); c.box(12, 27, 14, 29, BLACK)
    return c.done()
def rice_sacks():
    """Pallet of 10 kg rice sacks: cream paper sacks with red rice-brand bands."""
    c = C(32, 32)
    for j, y in enumerate((8, 15)):
        for i, x in enumerate(range(1 + j * 2, 30 - j * 2, 9)):
            c.box(x, y, x + 9, y + 8, CREAM); c.r(x + 1, y + 1, x + 8, y + 1, WHITE)
            c.r(x + 2, y + 4, x + 7, y + 5, [RED, GREEN, RED][i % 3])
    c.box(0, 23, 31, 28, (176, 128, 64)); c.r(4, 25, 7, 27, OL); c.r(24, 25, 27, 27, OL)
    c.r(1, 29, 31, 29, SH)
    return c.done()
def flower_buckets():
    """Cut-flower buckets: three steel buckets of tulips, roses and sunflowers on a step stand."""
    c = C(16, 32)
    for x, col in ((3, RED), (8, YELLOW), (12, PINK)):
        for dx in (-1, 1): c.l(x + dx, 8, x, 16, LEAF_D)
        c.ball(x - 1, 7, 1, col); c.ball(x + 1, 5, 1, col); c.ball(x, 9, 1, lt(col))
    c.block(1, 15, 14, 28, 3, STEEL_L, STEEL)
    c.r(3, 21, 6, 22, WHITE); c.r(9, 21, 12, 22, WHITE)
    return c.done()
def candy_bins():
    """Bulk candy bins: tilted clear bins of coloured sweets with scoops."""
    c = C(16, 32)
    c.block(0, 6, 15, 29, 2, (240, 120, 160), (250, 240, 240))
    for j, y in enumerate((10, 18)):
        for i, x in enumerate((1, 8)):
            c.box(x, y, x + 6, y + 6, (230, 240, 244))
            for px in range(x + 1, x + 6, 2):
                for py in range(y + 2, y + 6, 2): c.p(px + (py % 2), py, [RED, YELLOW, GREEN, BLUE, PINK][(px + py + i + j) % 5])
    return c.done()
def price_banner():
    """Hanging sale banner on the wall: red pennant board with yellow price bursts."""
    c = C(32, 32)
    c.l(2, 4, 29, 4, OL)
    c.box(2, 6, 29, 22, RED); c.r(3, 7, 28, 8, RED_L)
    for x in (6, 18):
        c.e(x - 1, 11, x + 6, 19, YELLOW_D); c.e(x, 12, x + 5, 18, YELLOW); c.r(x + 1, 14, x + 4, 15, RED)
    for x in range(3, 29, 4): c.p(x, 22, OL); c.p(x + 1, 23, RED_D)
    return c.done()


# ------------------------------------------------------------------ convenience store
def oden_pot():
    """Konbini oden station: steel pot of simmering compartments (daikon, egg, fishcake) under a lid rack."""
    c = C(16, 32)
    c.box(0, 10, 15, 21, STEEL_D); c.r(1, 11, 14, 20, (196, 150, 90))
    for x, y, col in ((3, 13, WHITE), (8, 13, (240, 210, 140)), (12, 14, (230, 230, 220)), (4, 17, (190, 130, 80)), (10, 18, YELLOW)):
        c.ball(x, y, 1, col)
    c.r(7, 11, 7, 20, STEEL); c.r(1, 15, 14, 15, STEEL)
    c.block(0, 20, 15, 29, 1, STEEL_L, STEEL, shadow=False)
    c.l(2, 4, 13, 4, STEEL_D); c.l(3, 5, 3, 10, STEEL_D)
    return c.done()
def hot_snack_case():
    """Counter hot-snack warmer: lit glass box with fried chicken, croquettes and corn dogs."""
    c = C(16, 32)
    c.box(0, 3, 15, 22, (240, 160, 60)); c.glass(1, 4, 14, 21, (250, 214, 150))
    for j, y in enumerate((7, 14)):
        for x in range(2, 13, 4): c.ball(x + 1, y + 2, 2, [(200, 130, 50), (226, 170, 80)][(x + j) % 2])
        c.r(1, y + 5, 14, y + 5, STEEL_D)
    c.block(0, 21, 15, 29, 1, STEEL_L, (220, 100, 50))
    return c.done()
def magazine_rack():
    """Window-side magazine rack: slanted shelves of colourful magazine covers and manga volumes."""
    c = C(32, 32)
    c.block(0, 2, 31, 30, 2, WOOD_L, (230, 228, 220))
    cols = [RED, BLUE, YELLOW, (240, 120, 180), GREEN, ORANGE, PURPLE]
    for j, y in enumerate((6, 13, 20)):
        for i, x in enumerate(range(2, 28, 5)):
            col = cols[(i + j * 3) % 7]
            c.box(x, y, x + 4, y + 6, WHITE); c.r(x + 1, y + 1, x + 3, y + 2, col); c.r(x + 1, y + 4, x + 3, y + 4, dk(col))
        c.r(1, y + 7, 30, y + 7, WOOD_D)
    return c.done()
def copy_machine():
    """Konbini multi-copy machine: cream copier with lid, touch panel and coin slot."""
    c = C(16, 32)
    c.block(0, 6, 15, 30, 5, (230, 230, 220), (214, 214, 204))
    c.r(2, 8, 13, 9, (60, 64, 76)); c.box(10, 13, 14, 17, DARK); c.r(11, 14, 13, 15, SCREEN)
    c.r(2, 18, 7, 19, OL); c.r(2, 23, 13, 25, (180, 180, 170)); c.r(2, 23, 13, 23, WHITE)
    return c.done()
