# R10 hypermarket / convenience-store merchandise (3/4 top view).
# Redrawn 2026-10-18 (hostile VQA): shelves get depth (dark back panel, lit lip, price-tag strip, cast shadow under
# each lip), merchandise gets real silhouettes (cups, pillow bags, PET bottles, jugs, cans), produce is heaped
# back-to-front with darker back rows, fresh cases get curved glass with glare and stainless trim.
from lib import *

BACK = (54, 60, 74)            # shelf back panel inside a gondola / cooler
BACK_D = (38, 42, 54)
TAG = (250, 220, 70)


# ------------------------------------------------------------------ produce
def crate_stand(fill_fn, w=32, top_col=WOOD_L, face=WOOD):
    """Angled wooden crate table: chalk price header on a back riser, produce heaped on the tilted bed,
    slatted crate front with a shadowed lip, splayed legs and a floor shadow."""
    c = C(w, 32)
    c.box(1, 3, w - 2, 9, WOOD_D)                                   # back riser
    c.r(2, 4, w - 3, 8, WOOD_DD)
    c.box(w // 2 - 7, 2, w // 2 + 6, 8, (44, 58, 48)); c.r(w // 2 - 6, 3, w // 2 + 5, 7, (54, 72, 60))   # chalk board
    c.r(w // 2 - 5, 4, w // 2 - 1, 4, WHITE); c.r(w // 2 + 1, 4, w // 2 + 4, 4, YELLOW); c.r(w // 2 - 4, 6, w // 2 + 3, 6, (200, 214, 204))
    c.box(1, 8, w - 2, 21, WOOD_DD)                                 # tilted bed
    c.r(2, 9, w - 3, 20, (150, 112, 62)); c.dither(2, 9, w - 3, 20, (134, 98, 52))
    fill_fn(c)
    c.r(1, 20, w - 2, 21, OL)                                       # bed lip shadow
    c.box(1, 21, w - 2, 29, face)                                   # crate front
    c.r(2, 22, w - 3, 22, lt(face, 1.18))
    for x in range(2, w - 3, 6): c.r(x + 5, 22, x + 5, 28, WOOD_D); c.p(x + 1, 23, WOOD_L)
    c.r(2, 25, w - 3, 25, WOOD_D); c.r(2, 28, w - 3, 28, WOOD_DD)
    c.box(w // 2 - 4, 22, w // 2 + 3, 27, WHITE); c.r(w // 2 - 3, 23, w // 2 + 2, 23, RED); c.r(w // 2 - 2, 25, w // 2 + 1, 25, OL)   # price card
    c.r(2, 30, w - 2, 31, SH); c.p(2, 29, WOOD_DD); c.p(w - 3, 29, WOOD_DD)
    return c.done()


def heap(c, x0, x1, y0, y1, col, r=2, step=4, alt=None, stem=None):
    """Back-to-front heap: back rows darker and narrower, front rows full brightness."""
    rows = list(range(y0, y1 + 1, max(2, r + 1)))
    for j, y in enumerate(rows):
        f = 0.8 + 0.2 * (j / max(1, len(rows) - 1))
        inset = (len(rows) - 1 - j)
        for i, x in enumerate(range(x0 + r + (j % 2) * (step // 2) + inset // 2, x1 - r + 1, step)):
            k = alt if alt and (i * 3 + j) % 4 == 0 else col
            c.ball(x, y, r, dk(k, f) if f < 1 else k)
            if stem: c.p(x, y - r, stem)


def fruit_apple(): return crate_stand(lambda c: heap(c, 2, 29, 10, 19, (214, 44, 50), alt=(150, 190, 60), stem=BROWN_D))
def fruit_orange():
    def f(c):
        heap(c, 2, 29, 10, 19, (246, 146, 36))
        for x in range(5, 28, 4): c.p(x, 18, (96, 140, 50))
    return crate_stand(f)
def fruit_banana():
    def hand(c, x, y, k):
        """One hand of bananas: four curved fingers fanning from a brown crown."""
        for i in range(4):
            yy = y + i
            c.l(x, yy + 2, x + 3, yy, YELLOW_D); c.l(x + 3, yy, x + 7, yy - 1, YELLOW_D)
            c.l(x, yy + 1, x + 3, yy - 1, (250, 214, 64) if (i + k) % 2 else YELLOW); c.l(x + 3, yy - 1, x + 7, yy - 2, (252, 232, 120))
            c.p(x + 7, yy - 2, (96, 130, 40))
        c.r(x - 1, y + 1, x, y + 4, BROWN_D); c.p(x - 1, y + 1, BROWN)
    def f(c):
        for k, (x, y) in enumerate(((4, 10), (14, 10), (23, 11), (8, 15), (19, 15))): hand(c, x, y, k)
    return crate_stand(f)
def fruit_watermelon():
    def melon(c, cx, cy, rx, ry):
        c.e(cx - rx, cy - ry, cx + rx, cy + ry, OL); c.e(cx - rx + 1, cy - ry + 1, cx + rx - 1, cy + ry - 1, (70, 146, 60))
        for dx in range(-rx + 2, rx - 1, 3):
            for y in range(cy - ry + 2, cy + ry - 1): c.p(cx + dx + ((y // 2) % 2), y, (34, 86, 38))
        c.r(cx - rx + 2, cy - ry + 2, cx - 1, cy - ry + 2, (160, 214, 120)); c.p(cx - rx + 2, cy - ry + 3, (160, 214, 120))
    def f(c):
        melon(c, 8, 13, 6, 4); melon(c, 22, 13, 6, 4)
        c.e(9, 13, 22, 20, OL); c.e(10, 14, 21, 19, (60, 130, 50)); c.e(11, 14, 20, 18, (240, 250, 220)); c.e(12, 15, 19, 18, (230, 60, 70))   # cut half
        for x, y in ((13, 16), (16, 15), (18, 17), (15, 17)): c.p(x, y, OL)
        c.p(13, 15, (250, 140, 140))
    return crate_stand(f)
def veg_pyramid():
    def f(c):
        for x in (6, 14):                                                           # cabbages
            c.e(x - 5, 10, x + 4, 19, (60, 110, 50)); c.e(x - 4, 11, x + 3, 18, (120, 190, 90)); c.e(x - 2, 12, x + 1, 16, (190, 232, 150))
            c.l(x - 1, 12, x - 1, 17, (90, 150, 70)); c.p(x - 3, 14, (90, 150, 70)); c.p(x + 2, 14, (90, 150, 70))
        for i, x in enumerate(range(19, 30, 2)):                                    # carrot bunch
            c.l(x, 12, x + 1, 19, ORANGE_D); c.l(x, 12, x, 18, ORANGE); c.p(x, 13, (252, 190, 110))
            c.p(x - 1, 11, LEAF); c.p(x, 10, LEAF_D if i % 2 else LEAF); c.p(x + 1, 11, LEAF)
        heap(c, 31, 46, 10, 19, (222, 46, 40), r=2, step=4)                          # tomatoes
        for x in range(34, 45, 4): c.p(x, 18, (60, 140, 50))
    return crate_stand(f, w=48)
def veg_wall():
    """Refrigerated produce wall case: lit header, misted dark interior, three tilted tiers of leafy greens,
    broccoli, peppers, a mist-bar across the top and a steel bumper."""
    c = C(32, 32)
    c.block(0, 1, 31, 30, 3, (70, 120, 80), (226, 232, 228))
    c.r(1, 5, 30, 6, (120, 200, 140)); c.r(3, 5, 12, 5, WHITE)
    c.r(2, 7, 29, 26, BACK); c.r(2, 7, 29, 7, (150, 220, 200))                    # mist bar
    for x in range(4, 29, 5): c.p(x, 8, (200, 240, 240))
    def leafy(x, y):
        c.e(x - 2, y - 2, x + 2, y + 2, LEAF_D); c.e(x - 2, y - 2, x + 1, y + 1, LEAF); c.p(x - 1, y - 1, (180, 230, 140))
    def broc(x, y):
        c.e(x - 2, y - 2, x + 2, y + 1, (40, 100, 50)); c.p(x - 1, y - 1, (90, 160, 80)); c.p(x + 1, y - 2, (90, 160, 80)); c.p(x, y + 2, (150, 200, 110))
    def pepper(x, y, col):
        c.rbox(x - 1, y - 1, x + 2, y + 2, col, dk(col, 0.6)); c.p(x, y - 1, (60, 120, 50)); c.p(x - 0, y, lt(col, 1.4))
    for i, y in enumerate((11, 17, 23)):
        for k, x in enumerate(range(5, 29, 5)):
            [leafy, broc, lambda a, b: pepper(a, b, RED), leafy, lambda a, b: pepper(a, b, YELLOW)][(k + i * 2) % 5](x, y)
        c.shelf(2, 29, y + 3, STEEL_L, TAG)
    c.r(2, 27, 29, 28, STEEL); c.r(2, 27, 29, 27, STEEL_L)
    return c.done()
def scale_counter():
    """Produce weighing station: small steel counter with a digital scale and a roll of bags."""
    c = C(16, 32)
    c.block(1, 12, 14, 29, 4, STEEL_L, STEEL)
    c.r(2, 18, 13, 18, STEEL_D); c.box(3, 20, 12, 26, STEEL_L); c.r(4, 21, 11, 21, WHITE)   # drawer
    c.box(3, 9, 12, 14, WHITE); c.r(4, 10, 11, 11, STEEL_L); c.r(4, 13, 11, 13, WHITE_D)
    c.box(4, 3, 11, 9, DARK); c.r(5, 4, 10, 7, (36, 60, 44)); c.r(6, 5, 9, 5, (120, 240, 120)); c.p(9, 7, (120, 240, 120))
    c.r(1, 30, 14, 30, SH)
    return c.done()


# ------------------------------------------------------------------ fresh: fish / meat / deli
def _fish(c, x, y, L=9, body=(132, 150, 170)):
    """Whole fish lying west-east: tail fork on the east, eye at the head, silver back over pale belly."""
    c.r(x, y, x + L - 2, y + 2, OL)
    c.r(x + 1, y, x + L - 3, y, dk(body, 0.7)); c.r(x, y + 1, x + L - 2, y + 1, body); c.r(x + 1, y + 2, x + L - 3, y + 2, (226, 232, 238))
    c.p(x, y, OL); c.p(x, y + 2, OL)
    c.p(x + 1, y + 1, OL); c.p(x + 2, y + 1, lt(body, 1.3))
    c.l(x + L - 2, y + 1, x + L, y - 1, dk(body, 0.7)); c.l(x + L - 2, y + 1, x + L, y + 3, dk(body, 0.7))
def fish_ice():
    """Open ice-bed fishmonger table: crushed ice, whole fish in a row, salmon steaks, clams and lemon,
    blue price spikes, stainless front with a blue 'fresh' band."""
    c = C(48, 32)
    c.box(0, 6, 47, 22, STEEL_D); c.r(1, 7, 46, 21, ICE)
    c.dither(1, 7, 46, 21, ICE_D); c.dither(1, 8, 46, 21, WHITE, 1)
    for y in (8, 13):
        _fish(c, 3, y, 10); _fish(c, 3 + 1, y + 3, 10, (160, 120, 110))
    for x in range(17, 30, 4):                                                        # salmon steaks
        c.rbox(x, 9, x + 3, 13, (244, 130, 84), OL); c.p(x + 1, 10, (252, 196, 160)); c.p(x + 2, 12, (252, 196, 160))
        c.rbox(x + 1, 15, x + 4, 19, (232, 80, 70), OL); c.p(x + 2, 16, (250, 160, 150))
    for x in range(33, 44, 3):                                                        # clams + scallops
        c.ball(x, 10, 1, (90, 80, 90)); c.ball(x + 1, 14, 1, (240, 220, 190))
    c.e(34, 16, 39, 20, YELLOW_D); c.e(35, 16, 38, 19, YELLOW); c.p(35, 17, WHITE)        # lemon
    c.e(40, 16, 45, 20, LEAF_D); c.e(41, 16, 44, 19, LEAF)
    for x in (14, 30): c.r(x, 5, x, 9, STEEL_D); c.box(x - 2, 2, x + 2, 6, BLUE); c.r(x - 1, 4, x + 1, 4, WHITE)
    c.r(1, 21, 46, 22, OL)
    c.box(0, 22, 47, 29, STEEL); c.r(1, 23, 46, 23, STEEL_L); c.r(1, 25, 46, 26, (60, 120, 200)); c.r(3, 25, 12, 25, WHITE)
    for x in range(6, 46, 8): c.r(x, 27, x, 28, STEEL_D)
    c.r(1, 30, 47, 31, SH)
    return c.done()
def _marbled(c, x, y, w, h, col):
    c.rbox(x, y, x + w - 1, y + h - 1, col, dk(col, 0.6))
    for i in range(1, w - 1, 2): c.p(x + i, y + 1 + (i % (h - 2 if h > 3 else 1)), (250, 226, 222))
    c.p(x + 1, y + 1, lt(col, 1.3))
def meat_showcase():
    """3-wide serve-over butcher case: steel top deck, curved glass bowing out over two tiers of white trays
    with marbled steaks, mince mounds, chicken and parsley garnish, steel trim, red-striped white front."""
    c = C(48, 32)
    c.box(0, 1, 47, 6, STEEL_D); c.r(1, 2, 46, 3, STEEL_L); c.r(1, 4, 46, 5, STEEL)           # staff-side deck
    c.box(0, 6, 47, 20, OL); c.r(1, 7, 46, 19, (60, 66, 78))                                    # interior
    c.r(1, 7, 46, 8, (240, 250, 255))                                                           # canopy light
    cuts = [(196, 44, 54), (176, 36, 48), (230, 140, 130), (214, 70, 70)]
    for j, y in enumerate((9, 14)):
        c.r(1, y + 4, 46, y + 4, STEEL_D)
        for i, x in enumerate(range(2, 45, 7)):
            c.box(x, y, x + 6, y + 4, WHITE); c.r(x + 1, y + 3, x + 5, y + 3, WHITE_D)
            k = (i + j) % 4
            if k == 2:                                                                          # chicken legs
                for dx in (1, 3): c.oval(x + dx, y + 1, x + dx + 2, y + 3, (236, 190, 150)); c.p(x + dx + 1, y + 1, (250, 220, 190))
            elif k == 3: c.e(x + 1, y + 1, x + 5, y + 3, (190, 56, 64)); c.dither(x + 2, y + 1, x + 4, y + 2, (230, 120, 120))  # mince
            else: _marbled(c, x + 1, y + 1, 5, 3, cuts[k])
            c.p(x + 5, y + 1, LEAF)
    for i in range(14):                                                                         # curved glass bow + glare
        c.p(1 + i * 3, 7 + (i % 2), (210, 236, 246))
    c.l(4, 18, 10, 8, (226, 244, 252)); c.l(6, 18, 12, 8, (200, 230, 244)); c.l(30, 18, 36, 8, (226, 244, 252))
    c.r(0, 20, 47, 21, STEEL_L); c.r(0, 21, 47, 21, STEEL_D)
    c.box(0, 21, 47, 29, WHITE); c.r(1, 22, 46, 22, WHITE_D)
    c.r(1, 24, 46, 25, RED); c.r(1, 26, 46, 26, RED_D); c.r(4, 24, 10, 24, RED_L)
    c.r(1, 28, 46, 28, STEEL_D); c.r(1, 30, 47, 31, SH)
    return c.done()
def salmon_tray():
    """Low refrigerated sashimi case: tilted open top of black sashimi trays under clear lids - salmon,
    tuna, sushi sets with green baran - over a white front with a blue cooling band."""
    c = C(32, 32)
    c.box(0, 8, 31, 22, (40, 44, 56)); c.r(1, 9, 30, 21, (176, 214, 230)); c.dither(1, 9, 30, 21, (196, 226, 240))
    for i, (x, y) in enumerate((x, y) for y in (10, 16) for x in (2, 9, 16, 23)):
        c.box(x, y, x + 6, y + 4, BLACK)
        k = (i + y) % 4
        if k == 0:
            for dx in range(1, 6, 2): c.r(x + dx, y + 1, x + dx + 1, y + 3, (246, 140, 96)); c.p(x + dx, y + 2, (252, 214, 190))
        elif k == 1: c.r(x + 1, y + 1, x + 5, y + 3, (190, 34, 56)); c.r(x + 2, y + 1, x + 4, y + 1, (226, 90, 100))
        else:
            for dx in (1, 3, 5): c.p(x + dx, y + 2, WHITE); c.p(x + dx, y + 1, [(246, 140, 96), (190, 34, 56), YELLOW][dx // 2])
            c.p(x + 2, y + 3, WHITE)
        c.p(x + 5, y + 3, LEAF); c.p(x + 1, y + 1, (250, 250, 255))
    c.r(1, 21, 30, 22, OL)
    c.box(0, 22, 31, 29, WHITE); c.r(1, 23, 30, 23, WHITE_D); c.r(2, 25, 29, 26, (60, 130, 200)); c.r(3, 25, 8, 25, (140, 190, 240))
    c.r(1, 30, 31, 31, SH)
    return c.done()
def egg_stand():
    """Egg tower: stepped wooden stand stacked with white and brown egg cartons."""
    c = C(16, 32)
    c.block(1, 18, 14, 29, 2, WOOD_L, WOOD)
    for i, y in enumerate((4, 9, 14)):
        c.box(1 + i, y, 14 - i, y + 5, (222, 226, 214)); c.r(2 + i, y + 4, 13 - i, y + 4, (190, 194, 184))
        for x in range(3 + i, 13 - i, 2):
            col = (250, 244, 230) if i % 2 else (222, 176, 126)
            c.p(x, y + 2, col); c.p(x, y + 1, lt(col, 1.1))
    c.box(4, 22, 11, 26, YELLOW); c.r(6, 24, 9, 24, RED)
    c.r(2, 30, 14, 30, SH)
    return c.done()


# ------------------------------------------------------------------ bakery
def _loaf(c, x, y, w, col=(214, 150, 70)):
    c.rbox(x, y, x + w - 1, y + 3, col, dk(col, 0.55)); c.r(x + 1, y + 1, x + w - 2, y + 1, lt(col, 1.25))
    for i in range(x + 2, x + w - 2, 3): c.p(i, y + 1, dk(col, 0.8))
def baguette_basket():
    """Wicker basket of scored baguettes and rolls on a low stand with a chalk price tag."""
    c = C(16, 32)
    for x, tilt in ((2, 1), (5, -1), (8, 1), (11, -1)):
        c.l(x, 4, x + tilt * 2, 18, OL); c.l(x + 1, 4, x + 1 + tilt * 2, 18, (222, 160, 76)); c.l(x + 2, 5, x + 2 + tilt * 2, 18, (176, 110, 46))
        for yy in (7, 10, 13): c.p(x + 1 + tilt * (yy - 4) // 7, yy, (250, 220, 160))
    for x in (4, 9): c.ball(x, 15, 2, (214, 150, 70))
    c.box(1, 15, 14, 28, (176, 128, 64)); c.r(2, 16, 13, 16, (210, 168, 100))
    for y in range(17, 28):
        for x in range(2, 14):
            if (x // 2 + y // 2) % 2: c.p(x, y, (150, 104, 50))
    c.r(2, 27, 13, 27, (110, 74, 36))
    c.box(9, 21, 15, 26, (44, 58, 48)); c.r(10, 23, 13, 23, WHITE)
    c.r(2, 29, 14, 30, SH)
    return c.done()
def _cake(c, x, y, top, side, deco):
    c.e(x, y, x + 6, y + 3, dk(side, 0.6)); c.r(x, y + 2, x + 6, y + 5, dk(side, 0.6))
    c.r(x + 1, y + 2, x + 5, y + 4, side); c.r(x + 1, y + 3, x + 5, y + 3, lt(side, 1.1))
    c.e(x + 1, y + 1, x + 5, y + 3, top); c.p(x + 2, y + 1, lt(top, 1.15))
    for dx in (1, 3, 5): c.p(x + dx, y + 1 + (dx % 2), deco)
def cake_showcase():
    """Bakery cake showcase: warm-lit curved glass case on a wood base - whole cakes on the top tier,
    layered slices and macarons below, glare streaks and a brass rail."""
    c = C(32, 32)
    c.box(0, 1, 31, 4, WOOD_D); c.r(1, 2, 30, 3, WOOD_L)
    c.box(0, 4, 31, 22, OL); c.r(1, 5, 30, 21, (250, 236, 200)); c.r(1, 5, 30, 6, (255, 248, 220))
    _cake(c, 2, 7, WHITE, (250, 238, 220), RED); _cake(c, 10, 7, (110, 64, 44), (150, 96, 64), WHITE)
    _cake(c, 18, 7, PINK, (250, 220, 230), RED); _cake(c, 25, 8, (250, 230, 150), (240, 210, 120), ORANGE)
    c.r(1, 14, 30, 14, GOLD); c.r(1, 15, 30, 15, (200, 170, 120))
    for x in range(2, 20, 5):                                                                   # slices (wedges)
        c.r(x, 17, x + 3, 20, (250, 240, 220)); c.r(x, 18, x + 3, 18, (220, 120, 90)); c.r(x, 20, x + 3, 20, (200, 150, 90))
        c.l(x, 17, x + 3, 17, WHITE); c.p(x + 3, 16, RED)
    for i, x in enumerate(range(21, 30, 3)):                                                    # macarons
        col = [(240, 160, 190), (170, 220, 160), (250, 220, 120)][i]
        c.r(x, 17, x + 1, 17, col); c.r(x, 18, x + 1, 18, WHITE); c.r(x, 19, x + 1, 19, col); c.r(x, 20, x + 1, 20, dk(col, 0.7))
    c.l(4, 21, 12, 5, (255, 255, 240)); c.l(6, 21, 14, 5, (255, 250, 230))
    c.r(0, 22, 31, 22, GOLD_D)
    c.box(0, 23, 31, 29, WOOD); c.r(1, 24, 30, 24, WOOD_L)
    for x in range(4, 30, 8): c.r(x, 25, x + 5, 28, WOOD_D); c.r(x + 1, 26, x + 4, 27, (170, 124, 64))
    c.r(1, 30, 31, 31, SH)
    return c.done()
def donut_case():
    """Self-serve donut case: tilted glass doors with chrome pulls over two tiers of iced donuts with sprinkles."""
    c = C(32, 32)
    c.block(0, 2, 31, 30, 2, (230, 120, 150), (250, 240, 236))
    c.r(1, 6, 30, 22, (252, 236, 214)); c.r(1, 6, 30, 6, (255, 250, 236))
    cols = [PINK, (110, 66, 44), (250, 236, 200), (250, 200, 60)]
    sprink = [YELLOW, (90, 200, 230), RED, (120, 220, 120)]
    for j, y in enumerate((10, 17)):
        for i, x in enumerate(range(4, 29, 6)):
            col = cols[(i + j) % 4]
            c.oval(x - 3, y - 2, x + 2, y + 2, (196, 132, 64)); c.e(x - 2, y - 2, x + 1, y + 1, col)
            c.p(x - 1, y - 1, OL); c.p(x, y - 1, dk(col, 0.6)); c.p(x - 2, y - 2, lt(col, 1.3))
            c.p(x - 2, y, sprink[i % 4]); c.p(x + 1, y - 1, sprink[(i + 1) % 4])
        c.r(1, y + 3, 30, y + 3, STEEL_L); c.r(1, y + 4, 30, y + 4, (210, 190, 186))
    c.r(15, 6, 16, 22, STEEL_D)
    c.l(3, 21, 11, 7, WHITE); c.l(19, 21, 26, 8, WHITE)
    c.r(12, 13, 13, 16, STEEL_L); c.r(18, 13, 19, 16, STEEL_L)
    c.r(1, 23, 30, 23, (210, 190, 186)); c.r(3, 25, 28, 26, (230, 120, 150)); c.r(5, 25, 9, 25, (250, 190, 210))
    return c.done()
def bread_rack():
    """Packaged-bread wall rack: chrome wire shelves of bagged shokupan, bun six-packs and bagged rolls,
    each bag with a printed band and coloured twist tie; dark back panel and lip shadows."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, STEEL_L, (236, 232, 222))
    c.r(1, 4, 30, 25, BACK)
    for j, y in enumerate((5, 12, 19)):
        c.r(1, y, 30, y, BACK_D)
        for i, x in enumerate(range(2, 28, 7)):
            k = (i + j) % 3
            if k == 0:                                                                          # shokupan loaf
                c.rbox(x, y + 1, x + 5, y + 5, (252, 244, 226), STEEL_D); c.r(x + 1, y + 1, x + 4, y + 2, (214, 150, 70)); c.r(x + 1, y + 2, x + 4, y + 2, (190, 120, 50))
            elif k == 1:                                                                        # bun six-pack
                c.box(x, y + 2, x + 5, y + 5, (252, 248, 236), STEEL_D)
                for dx in (1, 3): c.ball(x + dx + 1, y + 3, 1, (220, 150, 64))
            else:                                                                               # bagged rolls
                c.rbox(x, y + 1, x + 5, y + 5, (246, 236, 214), STEEL_D); c.r(x + 1, y + 2, x + 4, y + 4, (226, 170, 90)); c.p(x + 1, y + 2, (250, 214, 150))
            c.r(x + 1, y + 4, x + 4, y + 4, [RED, BLUE, YELLOW_D, GREEN][(i + j) % 4]); c.p(x + 5, y + 1, [RED, GREEN, BLUE][(i + j) % 3])
            c.p(x + 1, y + 1, WHITE)
        c.r(1, y + 6, 30, y + 6, STEEL_L)
        for x in range(2, 30, 2): c.p(x, y + 6, STEEL_D)
    c.r(1, 26, 30, 28, (210, 206, 196)); c.r(2, 27, 29, 27, STEEL_D)
    return c.done()


# ------------------------------------------------------------------ coolers / open cases
def open_cooler(fill_fn, header=(60, 120, 200)):
    """Multi-deck open chiller: lit brand header, cold-blue lit interior with three shelves (lit lip, tag strip,
    cast shadow), air-curtain grille and a steel bumper."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 3, header, (226, 232, 238))
    c.r(1, 4, 30, 5, lt(header, 1.4)); c.r(3, 4, 10, 4, WHITE)
    c.r(1, 6, 30, 26, (34, 46, 64)); c.r(1, 6, 30, 6, (200, 236, 255))
    for x in (1, 30): c.r(x, 7, x, 26, (60, 76, 100))
    fill_fn(c)
    c.r(1, 27, 30, 28, STEEL); c.r(1, 27, 30, 27, STEEL_L)
    for x in range(3, 29, 2): c.p(x, 28, STEEL_D)
    return c.done()
def _cooler_shelf(c, y):
    c.r(1, y + 6, 30, y + 6, STEEL_L); c.r(1, y + 7, 30, y + 7, (60, 80, 110))
    for x in range(3, 29, 6): c.p(x, y + 7, TAG); c.p(x + 1, y + 7, TAG)
def dairy_open():
    def f(c):
        for j, y in enumerate((7, 14, 21)):
            for i, x in enumerate(range(2, 29, 4)):
                if j < 2:                                                                       # gable-top milk cartons
                    col = [(60, 120, 220), RED, (240, 190, 40)][(i + j) % 3]
                    c.p(x + 1, y, WHITE_D); c.r(x, y + 1, x + 2, y + 1, WHITE); c.r(x, y + 2, x + 2, y + 5, WHITE)
                    c.r(x + 2, y + 2, x + 2, y + 5, WHITE_D); c.r(x, y + 3, x + 2, y + 4, col); c.p(x, y + 3, lt(col, 1.3))
                elif i % 2: c.e(x, y + 2, x + 3, y + 5, [PINK, (250, 220, 120)][i // 2 % 2]); c.r(x, y + 2, x + 3, y + 2, WHITE)   # yoghurt tubs
                else: c.pack(x, y + 2, 4, 3, (250, 210, 90)); c.r(x, y + 4, x + 3, y + 4, RED)                            # cheese
            if j < 2: _cooler_shelf(c, y)
    return open_cooler(f, (70, 130, 210))
def drink_open():
    def f(c):
        cols = [(220, 60, 50), (60, 160, 90), (250, 160, 40), (90, 140, 230), (236, 236, 236)]
        for j, y in enumerate((7, 14, 21)):
            for i, x in enumerate(range(2, 29, 3)): c.bottle(x, y, cols[(i + j * 2) % 5], 6)
            if j < 2: _cooler_shelf(c, y)
    return open_cooler(f, (220, 70, 60))
def liquor_case():
    """Glass-door soju/beer fridge: LED strip, green soju bottles, amber beer and cans behind two framed
    doors with chrome handles and glare."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 3, (40, 120, 70), DARK_M)
    c.r(2, 4, 29, 4, (150, 230, 170))
    c.r(1, 5, 30, 27, (24, 34, 40)); c.r(2, 5, 29, 5, (220, 250, 255))
    for j, y in enumerate((7, 14, 21)):
        for x in range(3, 14, 3): c.bottle(x, y, (70, 170, 100) if j < 2 else (176, 110, 40), 6)
        for x in range(17, 29, 4): c.can(x, y + 2, [STEEL_L, (220, 200, 60), (60, 90, 170)][j])
        c.r(2, y + 6, 29, y + 6, (90, 100, 110))
    for x0, x1 in ((1, 15), (16, 30)): c.d.rectangle((x0, 5, x1, 27), outline=(*STEEL_D, 255))
    for x0 in (2, 17):
        c.l(x0 + 1, 25, x0 + 8, 8, (130, 170, 180)); c.l(x0 + 3, 25, x0 + 10, 8, (90, 120, 130))
    c.r(13, 12, 13, 19, STEEL_L); c.r(18, 12, 18, 19, STEEL_L); c.p(13, 12, WHITE); c.p(18, 12, WHITE)
    c.r(1, 28, 30, 28, (40, 44, 52))
    return c.done()


# ------------------------------------------------------------------ gondolas by product family
def gondola(fill_row, cap=(214, 58, 66)):
    """Double-sided aisle gondola from the south: steel top cap with a lit category header, dark pegboard back,
    three shelves of goods each sitting on a bright lip with a yellow price-tag strip and a shadow under it,
    a kick plate and a floor shadow."""
    c = C(32, 32)
    c.box(0, 3, 31, 29, OL); c.r(1, 4, 30, 6, STEEL_L); c.r(1, 4, 30, 4, WHITE)            # top cap
    c.r(3, 5, 28, 6, cap); c.r(3, 5, 28, 5, lt(cap, 1.3)); c.r(5, 6, 9, 6, WHITE); c.r(11, 6, 12, 6, WHITE)
    c.r(1, 7, 30, 26, BACK)
    for y in range(8, 26, 2):
        for x in range(4, 28, 3): c.p(x, y, BACK_D)
    for x in (1, 2, 29, 30): c.r(x, 7, x, 27, STEEL if x in (1, 30) else STEEL_D)
    c.r(1, 7, 1, 27, STEEL_L)
    for k, y in enumerate((8, 14, 20)):
        c.r(3, y, 28, y, BACK_D)                                                                 # shadow under the lip above
        fill_row(c, y + 1, k)
        c.shelf(3, 28, y + 5, STEEL_L, TAG)
    c.r(1, 27, 30, 28, (70, 74, 86)); c.r(1, 27, 30, 27, STEEL_D)
    c.r(1, 30, 31, 31, SH)
    return c.done()
def _cup(c, x, y, col):
    c.r(x, y, x + 3, y, WHITE); c.r(x, y + 1, x + 3, y + 3, col); c.r(x, y + 1, x, y + 3, lt(col, 1.25)); c.r(x + 3, y + 1, x + 3, y + 3, dk(col, 0.75))
    c.r(x + 1, y + 2, x + 2, y + 2, YELLOW)
def _pillow(c, x, y, w, col, mark=WHITE):
    c.r(x, y, x + w - 1, y, dk(col, 0.7)); c.r(x, y + 1, x + w - 1, y + 3, col); c.r(x, y + 1, x + w - 1, y + 1, lt(col, 1.3))
    c.r(x + w - 1, y + 1, x + w - 1, y + 3, dk(col, 0.8)); c.p(x + w // 2, y + 2, mark)
def g_ramen():
    def row(c, y, k):
        for i, x in enumerate(range(3, 26, 5)):
            col = [(214, 46, 46), (240, 120, 40), (180, 30, 40)][(i + k) % 3]
            if k == 0: _cup(c, x, y, col)
            elif k == 1: _pillow(c, x, y, 5, col, YELLOW)
            else: c.pack(x, y, 5, 4, col); c.r(x + 1, y + 1, x + 3, y + 1, YELLOW)
    return gondola(row, (214, 46, 46))
def g_snack():
    def row(c, y, k):
        for i, x in enumerate(range(3, 26, 5)):
            col = [(246, 200, 40), (240, 150, 40), (250, 230, 120), (90, 160, 230)][(i + k) % 4]
            if k == 2 and i % 2: c.r(x + 1, y, x + 3, y + 3, col); c.r(x + 1, y, x + 3, y, STEEL_L); c.p(x + 1, y + 1, WHITE); c.r(x + 3, y + 1, x + 3, y + 3, dk(col, 0.7))
            else: _pillow(c, x, y, 5, col, RED)
    return gondola(row, (240, 190, 40))
def g_tea():
    def row(c, y, k):
        for i, x in enumerate(range(3, 28, 3)):
            col = [(70, 160, 80), (40, 120, 60), (150, 200, 90), (200, 140, 60)][(i + k) % 4]
            if k == 2 and i % 3 == 2: c.pack(x - 1, y, 3, 4, col)
            else: c.bottle(x, y - 1, col, 5)
    return gondola(row, (60, 150, 80))
def g_water():
    def row(c, y, k):
        if k == 2:
            for x in range(3, 26, 6):
                c.box(x, y - 1, x + 5, y + 3, (190, 220, 246)); c.r(x + 1, y, x + 4, y + 1, BLUE); c.p(x + 1, y + 2, WHITE); c.p(x + 4, y + 2, WHITE)
            return
        for i, x in enumerate(range(3, 28, 3)): c.bottle(x, y - 1, [(170, 214, 250), (100, 160, 236)][(i + k) % 2], 5)
    return gondola(row, (60, 120, 210))
def g_cereal():
    def row(c, y, k):
        for i, x in enumerate(range(3, 26, 5)):
            col = [(150, 80, 190), (230, 90, 160), (110, 70, 160), (240, 180, 60)][(i + k) % 4]
            c.pack(x, y - 1, 4, 5, col); c.e(x + 1, y + 1, x + 2, y + 2, WHITE); c.p(x + 1, y, YELLOW)
    return gondola(row, (130, 80, 180))
def g_cans():
    def row(c, y, k):
        for i, x in enumerate(range(3, 27, 4)): c.can(x, y, [(206, 50, 50), (60, 110, 190), (240, 190, 50), STEEL][(i + k) % 4])
    return gondola(row, (120, 130, 150))
def g_detergent():
    def row(c, y, k):
        for i, x in enumerate(range(3, 26, 6)):
            col = [(60, 140, 230), (240, 100, 160), (250, 250, 250), (100, 200, 200)][(i + k) % 4]
            c.rbox(x, y, x + 4, y + 3, col, dk(col, 0.55)); c.r(x + 1, y + 1, x + 1, y + 2, lt(col, 1.3))
            c.r(x + 3, y - 1, x + 4, y - 1, dk(col, 0.6)); c.p(x + 3, y + 1, dk(col, 0.7))
            c.r(x + 1, y + 2, x + 2, y + 2, WHITE)
    return gondola(row, (60, 160, 210))
def g_household():
    def row(c, y, k):
        if k == 0:
            for x in range(3, 26, 5):
                c.box(x, y, x + 4, y + 3, (236, 240, 246)); c.e(x + 1, y + 1, x + 3, y + 3, WHITE); c.p(x + 2, y + 2, STEEL)
        elif k == 1:
            for i, x in enumerate(range(3, 26, 5)): c.pack(x, y, 5, 4, [(240, 160, 200), (160, 200, 240)][i % 2]); c.r(x + 1, y, x + 3, y, WHITE)
        else:
            for i, x in enumerate(range(3, 28, 3)):
                col = [(250, 120, 40), (60, 180, 120), (90, 140, 230)][i % 3]
                c.r(x, y, x + 1, y + 3, (230, 236, 244)); c.r(x, y + 1, x + 1, y + 2, col); c.p(x, y, STEEL_D)
    return gondola(row, (240, 140, 180))


# ------------------------------------------------------------------ frozen
def chest_freezer(fill_fn, lid=(180, 220, 240)):
    """Island chest freezer: frosted interior with goods under two sliding glass lids (chrome frames, glare),
    white body with a blue brand band and a grey bumper rail."""
    c = C(32, 32)
    c.box(0, 10, 31, 22, STEEL_D); c.r(1, 11, 30, 21, (150, 190, 214)); c.dither(1, 11, 30, 21, (200, 226, 240))
    fill_fn(c)
    c.r(1, 11, 30, 11, WHITE); c.r(15, 11, 16, 21, STEEL)
    for x0 in (2, 18): c.l(x0, 20, x0 + 8, 12, (236, 248, 255)); c.l(x0 + 2, 20, x0 + 9, 13, (214, 236, 250))
    c.r(1, 21, 30, 22, OL)
    c.box(0, 22, 31, 29, WHITE); c.r(1, 23, 30, 23, WHITE_D); c.r(1, 25, 30, 26, (60, 110, 200)); c.r(3, 25, 9, 25, (140, 180, 240))
    c.r(1, 28, 30, 28, (140, 146, 156))
    c.r(1, 30, 31, 31, SH)
    return c.done()
def frozen_dumpling():
    def f(c):
        for i, (x, y) in enumerate((x, y) for y in (12, 17) for x in range(2, 29, 5)):
            col = [(240, 240, 236), (220, 60, 60), (250, 200, 80)][(i + y) % 3]
            c.rbox(x, y, x + 4, y + 3, col, dk(col, 0.6)); c.p(x + 1, y + 1, lt(col, 1.2)); c.p(x + 2, y + 2, (120, 160, 220))
    return chest_freezer(f)
def ice_cream_chest():
    def f(c):
        cols = [PINK, (120, 80, 50), (250, 240, 200), (150, 210, 120), (190, 150, 230)]
        for i, (x, y) in enumerate((x, y) for y in (12, 17) for x in range(2, 29, 3)):
            col = cols[(i * 2 + y) % 5]
            if i % 3 == 0: c.p(x, y, col); c.p(x + 1, y, col); c.p(x, y + 1, (220, 170, 100)); c.p(x + 1, y + 1, (200, 150, 80)); c.p(x, y + 2, (200, 150, 80))
            else: c.r(x, y, x + 1, y + 2, col); c.p(x, y, lt(col, 1.3)); c.p(x + 1, y + 3, WOOD)
    return chest_freezer(f, (200, 230, 250))
def sample_cart():
    """Tasting-corner cart: striped umbrella, hot plate with sizzling bites, toothpick sample cups."""
    c = C(16, 32)
    c.e(0, 1, 15, 9, OL); c.e(1, 2, 14, 8, RED)
    for x in (3, 7, 11): c.r(x, 3, x + 1, 7, WHITE)
    c.r(2, 3, 13, 3, RED_L); c.r(7, 9, 8, 14, STEEL_D)
    c.block(1, 14, 14, 28, 4, STEEL_L, (220, 80, 70))
    c.box(2, 13, 8, 17, DARK); c.r(3, 14, 7, 16, (60, 60, 66)); c.p(4, 15, (210, 120, 60)); c.p(6, 14, (210, 120, 60)); c.p(5, 16, (230, 160, 90))
    for x in (10, 12): c.box(x - 1, 14, x + 1, 17, WHITE); c.p(x, 13, WOOD); c.p(x, 15, (230, 160, 90))
    c.r(3, 22, 12, 23, WHITE); c.r(4, 22, 7, 22, YELLOW)
    c.r(2, 29, 3, 30, BLACK); c.r(12, 29, 13, 30, BLACK)
    return c.done()
def sale_endcap():
    """Special-price endcap: stacked carton tower with a big yellow 'sale' board on a pole."""
    c = C(16, 32)
    c.r(7, 2, 8, 12, STEEL_D)
    c.box(1, 0, 14, 7, YELLOW); c.r(2, 1, 13, 1, (252, 236, 140)); c.r(3, 2, 12, 3, RED); c.r(5, 5, 10, 5, RED)
    for i, y in enumerate((10, 16, 22)):
        c.block(1, y, 14, y + 6, 1, lt((200, 150, 90)), (190, 140, 80), shadow=False)
        c.r(4, y + 3, 11, y + 4, [RED, BLUE, GREEN][i]); c.r(13, y + 2, 13, y + 5, (160, 112, 60))
    c.r(2, 29, 14, 30, SH)
    return c.done()
def self_checkout():
    """Self-checkout kiosk: touch screen with basket UI, scanner glass with red laser cross, card reader,
    bagging shelf with a carrier bag, red status light pole."""
    c = C(16, 32)
    c.r(13, 0, 13, 6, STEEL_D); c.box(12, 0, 14, 2, (60, 200, 110))
    c.box(2, 1, 11, 11, DARK); c.r(3, 2, 10, 10, SCREEN); c.r(3, 2, 10, 3, (180, 230, 250))
    c.r(4, 5, 9, 5, WHITE); c.r(4, 7, 7, 7, (240, 240, 250)); c.box(7, 8, 10, 10, (40, 200, 120)); c.p(4, 9, YELLOW)
    c.block(0, 12, 15, 29, 6, (220, 224, 230), (90, 96, 110))
    c.box(2, 13, 9, 17, OL); c.r(3, 14, 8, 16, (60, 70, 70)); c.l(3, 15, 8, 15, (255, 70, 60)); c.p(5, 14, (255, 70, 60)); c.p(6, 16, (255, 70, 60))
    c.box(11, 12, 14, 16, WHITE); c.r(12, 13, 13, 15, (230, 230, 236)); c.p(12, 13, BLUE)       # carrier bag
    c.box(2, 20, 7, 24, DARK); c.r(3, 21, 6, 21, (40, 200, 120)); c.r(3, 23, 6, 23, STEEL_D)
    c.r(9, 21, 13, 22, (40, 44, 52)); c.r(9, 25, 13, 25, STEEL_L)
    c.r(1, 30, 15, 30, SH)
    return c.done()
def cart_row():
    """Shopping-cart bay: four nested steel carts - red handles, wire-grid baskets, child seat flap, castors."""
    c = C(32, 32)
    for i, x in enumerate((19, 13, 7, 1)):
        c.r(x, 7, x + 11, 8, RED_D); c.r(x, 7, x + 11, 7, RED_L); c.p(x, 8, OL); c.p(x + 11, 8, OL)
        c.box(x, 9, x + 11, 15, STEEL_D); c.r(x + 1, 10, x + 10, 14, (70, 76, 90))
        for gx in range(x + 2, x + 10, 2): c.l(gx, 10, gx, 14, (120, 126, 140))
        if i == 3: c.r(x + 1, 10, x + 3, 12, (220, 70, 70))                 # folded child-seat flap on the front cart
        c.box(x + 1, 15, x + 10, 22, STEEL)
        for gx in range(x + 2, x + 10, 2): c.l(gx, 16, gx, 21, STEEL_L)
        c.r(x + 2, 18, x + 9, 18, STEEL_D)
        c.r(x + 2, 23, x + 9, 24, STEEL_D)
    for x in (2, 10, 14, 20, 26, 30): c.box(x - 1, 25, x + 1, 28, BLACK); c.p(x, 26, DARK_M)
    c.r(1, 29, 31, 30, SH)
    return c.done()
def basket_stacker():
    """Shopping-basket stacker: wheeled stand with a tall nested stack of blue and orange baskets."""
    c = C(16, 32)
    for i, y in enumerate(range(4, 22, 3)):
        col = (60, 120, 210) if i % 3 else (240, 140, 50)
        c.box(1, y, 14, y + 4, col); c.r(2, y + 1, 13, y + 1, lt(col, 1.3)); c.r(13, y + 1, 13, y + 3, dk(col, 0.7))
        for x in range(3, 13, 2): c.p(x, y + 3, dk(col, 0.6))
        c.r(5, y, 10, y, (40, 44, 52))
    c.l(2, 2, 6, 4, BLACK); c.l(13, 2, 9, 4, BLACK)
    c.box(0, 24, 15, 27, STEEL_D); c.r(1, 25, 14, 25, STEEL_L)
    c.box(1, 27, 3, 29, BLACK); c.box(12, 27, 14, 29, BLACK)
    c.r(1, 30, 15, 30, SH)
    return c.done()
def rice_sacks():
    """Pallet of 10 kg rice sacks: cream paper sacks with stitched tops and red rice-brand bands."""
    c = C(32, 32)
    for j, y in enumerate((8, 15)):
        for i, x in enumerate(range(1 + j * 5, 22, 10)):
            c.rbox(x, y, x + 9, y + 8, CREAM); c.r(x + 1, y + 1, x + 8, y + 1, WHITE); c.r(x + 8, y + 2, x + 8, y + 7, CREAM_D)
            for sx in range(x + 1, x + 9, 2): c.p(sx, y + 2, CREAM_D)
            c.r(x + 2, y + 4, x + 7, y + 5, [RED, GREEN, RED][i % 3]); c.p(x + 4, y + 4, WHITE)
    c.box(0, 23, 31, 28, (176, 128, 64)); c.r(1, 24, 30, 24, (210, 168, 100)); c.r(4, 25, 7, 27, OL); c.r(24, 25, 27, 27, OL)
    c.r(1, 29, 31, 30, SH)
    return c.done()
def flower_buckets():
    """Cut-flower buckets: three steel buckets of tulips, roses and sunflowers on a step stand."""
    c = C(16, 32)
    for x, col in ((3, RED), (8, YELLOW), (12, PINK)):
        for dx in (-1, 1): c.l(x + dx, 8, x, 16, LEAF_D)
        c.ball(x - 1, 7, 1, col); c.ball(x + 1, 5, 1, col); c.ball(x, 9, 1, lt(col))
        c.p(x + 2, 10, LEAF)
    c.block(1, 15, 14, 28, 3, STEEL_L, STEEL)
    c.r(3, 21, 6, 22, WHITE); c.r(9, 21, 12, 22, WHITE); c.r(2, 25, 13, 25, STEEL_D)
    c.r(2, 30, 14, 30, SH)
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
            c.p(x + 1, y + 1, WHITE); c.l(x + 5, y + 1, x + 5, y + 3, STEEL_L)
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
    c.box(0, 10, 15, 21, STEEL_D); c.r(1, 11, 14, 20, (196, 150, 90)); c.dither(1, 11, 14, 20, (176, 130, 74))
    for x, y, col in ((3, 13, WHITE), (8, 13, (240, 210, 140)), (12, 14, (230, 230, 220)), (4, 17, (190, 130, 80)), (10, 18, YELLOW)):
        c.ball(x, y, 1, col)
    c.r(7, 11, 7, 20, STEEL); c.r(1, 15, 14, 15, STEEL)
    c.block(0, 20, 15, 29, 1, STEEL_L, STEEL, shadow=False)
    c.l(2, 4, 13, 4, STEEL_D); c.l(3, 5, 3, 10, STEEL_D)
    for x in (5, 9): c.p(x, 8, (230, 236, 240)); c.p(x + 1, 6, (230, 236, 240))
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
            c.p(x + 1, y + 5, OL)
        c.shelf(1, 30, y + 7, WOOD_L)
    return c.done()
def copy_machine():
    """Konbini multi-copy machine: cream copier with lid, touch panel and coin slot."""
    c = C(16, 32)
    c.block(0, 6, 15, 30, 5, (230, 230, 220), (214, 214, 204))
    c.r(2, 8, 13, 9, (60, 64, 76)); c.box(10, 13, 14, 17, DARK); c.r(11, 14, 13, 15, SCREEN)
    c.r(2, 18, 7, 19, OL); c.r(2, 23, 13, 25, (180, 180, 170)); c.r(2, 23, 13, 23, WHITE)
    return c.done()
