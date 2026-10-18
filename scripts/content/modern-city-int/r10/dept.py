# R10 department-store boutique and luxury props (3/4 top view).
from lib import *


# ------------------------------------------------------------------ mannequins (1x1 floor, tall)
def _plinth(c):
    c.oval(2, 25, 13, 30, (210, 206, 200)); c.r(3, 26, 12, 27, (236, 234, 228))
    c.r(7, 21, 8, 26, STEEL_D)
def _head(c, hair=None):
    c.oval(5, 1, 10, 6, (236, 232, 226)); c.p(6, 2, WHITE)
    if hair: c.r(5, 1, 10, 2, hair)
def mannequin_suit():
    """Male mannequin in a navy suit with white shirt and red tie on a round plinth."""
    c = C(16, 32); _plinth(c); _head(c)
    c.box(3, 6, 12, 21, NAVY); c.r(4, 7, 11, 7, lt(NAVY, 1.4))
    c.r(7, 7, 8, 12, WHITE); c.r(7, 8, 8, 13, RED); c.l(5, 8, 7, 13, NAVY_D); c.l(10, 8, 8, 13, NAVY_D)
    c.r(4, 15, 11, 15, NAVY_D); c.r(7, 16, 8, 21, NAVY_D)
    return c.done()
def mannequin_casual():
    """Female mannequin in a striped knit and jeans."""
    c = C(16, 32); _plinth(c); _head(c, (120, 80, 50))
    c.box(4, 6, 11, 14, (246, 240, 226))
    for y in (8, 10, 12): c.r(5, y, 10, y, (60, 110, 190))
    c.box(4, 14, 11, 22, (80, 120, 180)); c.l(7, 16, 7, 22, BLUE_D); c.r(5, 14, 10, 14, BROWN)
    return c.done()
def mannequin_dress():
    """Female mannequin in a flared red evening dress."""
    c = C(16, 32); _plinth(c); _head(c, (60, 40, 30))
    c.r(6, 6, 9, 7, (236, 232, 226))
    c.box(5, 7, 10, 13, RED); c.r(6, 8, 9, 8, RED_L)
    for i, y in enumerate(range(13, 25)):
        w = 2 + i // 3
        c.r(7 - w, y, 8 + w, y, RED if y < 23 else RED_D)
    c.l(1, 24, 14, 24, OL); c.l(4, 13, 1, 24, OL); c.l(11, 13, 14, 24, OL); c.l(7, 15, 6, 23, RED_D)
    return c.done()
def mannequin_coat():
    """Mannequin in a camel trench coat with a belt and scarf."""
    c = C(16, 32); _plinth(c); _head(c)
    c.box(3, 6, 12, 23, (196, 156, 100)); c.r(4, 7, 11, 7, (224, 190, 140))
    c.r(5, 6, 10, 8, (150, 40, 50)); c.r(4, 14, 11, 15, BROWN); c.p(8, 14, GOLD)
    c.l(7, 9, 7, 22, BROWN_D); for_buttons = (10, 12, 17, 19)
    for y in for_buttons: c.p(9, y, BROWN_D)
    return c.done()
def mannequin_kids():
    """Short kids mannequin in a yellow raincoat with a backpack."""
    c = C(16, 32); _plinth(c)
    c.oval(5, 7, 10, 12, (236, 232, 226))
    c.box(4, 12, 11, 22, YELLOW); c.r(5, 13, 10, 13, (252, 230, 120)); c.r(4, 15, 4, 20, (60, 140, 220))
    c.r(7, 14, 8, 21, YELLOW_D)
    return c.done()


# ------------------------------------------------------------------ cases
def handbag_case():
    """Luxury handbag wall vitrine: lit glass cubbies each holding one leather bag, brass frame."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, GOLD, (52, 40, 36))
    cols = [(150, 40, 50), (40, 36, 34), (200, 160, 110), (240, 230, 214), (60, 90, 140), (150, 110, 70)]
    for j, y in enumerate((5, 14)):
        for i, x in enumerate((2, 12, 22)):
            c.box(x, y, x + 8, y + 8, (250, 238, 210))
            col = cols[(i + j * 3) % 6]
            c.box(x + 2, y + 3, x + 6, y + 7, col); c.l(x + 3, y + 2, x + 5, y + 2, dk(col)); c.p(x + 4, y + 5, GOLD)
    c.r(1, 23, 30, 23, GOLD_D); c.r(1, 26, 30, 28, (36, 28, 26))
    return c.done()
def watch_case():
    """Watch counter: black lacquer case, glass top with rows of watches on cushions, brass trim."""
    c = C(32, 32)
    c.box(0, 9, 31, 21, GOLD_D); c.r(1, 10, 30, 20, (36, 34, 40))
    for j, y in enumerate((12, 17)):
        for x in range(3, 29, 5):
            c.r(x, y, x + 3, y + 2, (230, 222, 210)); c.oval(x, y - 1, x + 3, y + 2, [GOLD, STEEL_L][(x + j) % 2]); c.p(x + 1, y, OL)
    c.r(1, 10, 30, 10, (120, 120, 140))
    c.box(0, 20, 31, 29, (30, 28, 34)); c.r(1, 21, 30, 21, GOLD); c.r(12, 24, 19, 25, GOLD_D)
    c.r(1, 30, 31, 30, SH)
    return c.done()
def jewelry_island():
    """Round jewellery island: glass ring top with necklaces and rings on velvet, white pedestal."""
    c = C(32, 32)
    c.oval(1, 6, 30, 21, OL); c.e(2, 7, 29, 20, (60, 40, 80))
    c.e(5, 9, 26, 18, (90, 60, 120))
    for x in range(7, 25, 4): c.p(x, 11, GOLD); c.p(x + 1, 12, GOLD); c.p(x, 15, (200, 230, 250)); c.p(x + 2, 16, RED_L)
    c.l(9, 13, 22, 13, GOLD_D)
    c.box(5, 18, 26, 28, WHITE); c.r(6, 19, 25, 19, WHITE_D); c.r(14, 22, 17, 25, GOLD)
    c.r(6, 29, 26, 29, SH)
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
def scarf_table():
    """Folded-knit table: low wooden table with stacks of folded sweaters and scarves in many colours."""
    c = C(32, 32)
    c.box(0, 10, 31, 22, WOOD_D); c.r(1, 11, 30, 21, WOOD_L)
    cols = [(220, 80, 80), (240, 200, 120), (90, 130, 200), (120, 170, 110), (200, 200, 200), (150, 90, 160)]
    for i, x in enumerate(range(2, 28, 5)):
        for j in range(3):
            col = cols[(i + j) % 6]; y = 17 - j * 2
            c.box(x, y, x + 4, y + 3, col); c.r(x + 1, y + 1, x + 3, y + 1, lt(col, 1.25))
    c.box(0, 21, 31, 28, WOOD); c.r(1, 22, 30, 22, WOOD_D); c.r(2, 24, 29, 24, WOOD_L)
    c.r(1, 29, 31, 29, SH)
    return c.done()


# ------------------------------------------------------------------ cosmetics
def cosmetic_island():
    """Cosmetics tester island: white counter, tilted tester tray of lipsticks and palettes, oval mirror on a stand."""
    c = C(32, 32)
    c.oval(10, 0, 21, 9, OL); c.e(11, 1, 20, 8, GLASS); c.p(13, 3, WHITE); c.r(15, 9, 16, 11, STEEL_D)
    c.box(0, 10, 31, 20, (240, 236, 232)); c.r(1, 11, 30, 19, (250, 248, 246))
    for x in range(2, 14, 2): c.r(x, 13, x, 17, [RED, PINK_D, (200, 60, 90), (180, 40, 60)][x % 4]); c.p(x, 13, BLACK)
    for x in (18, 24): c.box(x, 13, x + 5, 17, BLACK); c.r(x + 1, 14, x + 2, 15, PINK); c.r(x + 3, 14, x + 4, 15, (220, 180, 140))
    c.box(0, 19, 31, 28, WHITE); c.r(1, 20, 30, 20, WHITE_D); c.r(3, 23, 28, 23, PINK)
    c.r(1, 29, 31, 29, SH)
    return c.done()
def perfume_wall():
    """Perfume brand wall: glossy backlit shelves of perfume bottles in amber, rose and clear glass."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, (230, 220, 200), (250, 244, 232))
    cols = [(230, 170, 60), PINK, (200, 230, 246), (170, 120, 200), (240, 220, 140)]
    for j, y in enumerate((5, 12, 19)):
        c.r(1, y - 1, 30, y + 5, (252, 248, 236))
        for i, x in enumerate(range(3, 28, 4)):
            col = cols[(i + j) % 5]
            c.r(x, y + 2, x + 2, y + 5, col); c.r(x + 1, y, x + 1, y + 1, GOLD); c.p(x, y + 2, WHITE)
        c.r(1, y + 6, 30, y + 6, GOLD_D)
    c.r(1, 26, 30, 28, (210, 196, 170))
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
def escalator_entry(up=True):
    """Escalator landing seen 3/4 from the floor: black handrails on glass balustrades, steel comb plate and an
    up (green) / down (orange) arrow sign at the mouth."""
    c = C(48, 48)
    arrow = (60, 190, 90) if up else (240, 140, 40)
    c.box(0, 4, 9, 45, (196, 224, 236)); c.r(1, 5, 8, 6, BLACK)                      # west balustrade
    c.box(38, 4, 47, 45, (196, 224, 236)); c.r(39, 5, 46, 6, BLACK)
    c.r(1, 6, 2, 44, BLACK); c.r(45, 6, 46, 44, BLACK)
    c.box(9, 2, 38, 45, (60, 64, 76))
    for y in range(4, 34, 3): c.r(10, y, 37, y, (110, 116, 128)); c.r(10, y + 1, 37, y + 1, (84, 90, 102))
    c.r(10, 34, 37, 37, (220, 200, 60))                                              # yellow edge plate
    c.r(10, 38, 37, 44, STEEL); for_x = range(11, 37, 2)
    for x in for_x: c.p(x, 39, STEEL_L)
    c.box(17, 14, 30, 27, arrow)
    if up:
        for i in range(5): c.r(23 - i, 17 + i, 24 + i, 17 + i, WHITE)
        c.r(22, 22, 25, 25, WHITE)
    else:
        for i in range(5): c.r(23 - i, 24 - i, 24 + i, 24 - i, WHITE)
        c.r(22, 16, 25, 19, WHITE)
    c.r(1, 46, 47, 46, SH)
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
