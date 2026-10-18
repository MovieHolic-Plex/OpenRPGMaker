# R11 signature props (1/3): west-facing driver cab, school, clinic. Same 3/4 top-view kit as r10/lib.py
# (lighter TOP surface above a darker FRONT face, 1px ink outline, 1px floor shadow).
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'r10'))
from lib import *

NAVYS = (52, 70, 128)
CHALK = (46, 92, 76)


# ------------------------------------------------------------------ driver cab, facing WEST (train heads left)
def cab_front_w():
    """West-facing cab front (2x8 tiles): the windshield runs down the WEST edge (rails converging into a tunnel mouth,
    signal lamp, wipers) and the master-controller console sits right behind it with its dials, ATS monitor and
    T-handle seen from above. Driver stands/sits EAST of it looking west."""
    c = C(32, 128)
    c.box(0, 2, 11, 124, DARK)
    c.r(2, 6, 9, 120, (118, 158, 198)); c.r(2, 6, 9, 36, (170, 210, 240)); c.r(2, 92, 9, 120, (96, 108, 120))
    c.oval(2, 44, 6, 82, (28, 28, 34))
    c.l(9, 108, 3, 70, STEEL_L); c.l(9, 18, 3, 58, STEEL_L); c.l(9, 112, 3, 72, STEEL_D); c.l(9, 14, 3, 56, STEEL_D)
    for y in range(76, 110, 5): c.l(9 - (y - 70) // 7, y, 9 - (y - 70) // 7 - 2, y - 2, (120, 96, 70))
    c.oval(3, 26, 6, 29, (60, 220, 120)); c.oval(3, 96, 6, 99, RED)
    c.l(2, 117, 9, 100, (60, 64, 76)); c.l(2, 9, 9, 28, (60, 64, 76))
    c.r(5, 3, 6, 5, STEEL_D); c.r(5, 121, 6, 123, STEEL_D)
    for y in (40, 84): c.r(2, y, 9, y + 1, DARK)
    c.block(11, 4, 31, 119, 108, DARK_M, (52, 56, 66))
    c.r(12, 5, 12, 111, lt(DARK_M, 1.25))
    c.oval(13, 14, 22, 23, WHITE); c.oval(15, 16, 20, 21, (40, 44, 52)); c.l(17, 19, 14, 15, RED)                  # speedometer
    for y in (30, 40): c.oval(13, y, 19, y + 6, WHITE); c.oval(15, y + 2, 17, y + 4, (40, 44, 52)); c.l(16, y + 3, 14, y + 1, RED)
    c.box(13, 50, 22, 72, BLACK); c.r(14, 51, 21, 71, (40, 160, 200)); c.r(15, 53, 20, 55, (250, 230, 120)); c.r(15, 58, 20, 58, WHITE); c.r(15, 62, 18, 62, WHITE)
    c.r(13, 78, 22, 80, OL)
    for i, y in enumerate((83, 88, 93)): c.oval(14, y, 17, y + 3, [RED, (80, 200, 100), YELLOW][i]); c.box(19, y, 22, y + 3, STEEL_D)
    c.oval(21, 97, 30, 106, STEEL_D); c.oval(23, 99, 28, 104, STEEL)                                                # master controller base
    c.l(25, 101, 14, 98, STEEL_L); c.box(11, 96, 15, 100, RED)                                                      # T-handle pointing west
    c.box(24, 14, 30, 40, (230, 226, 210)); c.r(25, 17, 29, 17, OL); c.r(25, 21, 29, 21, OL); c.r(25, 25, 28, 25, OL)  # timetable holder
    for y in range(46, 74, 6): c.box(25, y, 29, y + 3, STEEL)
    c.r(12, 112, 30, 112, BLACK)
    return c.done()


def cab_seat_w():
    """Driver's seat facing WEST: navy fabric cushion toward the console, tall backrest + headrest on the east side
    behind the driver, chrome pedestal."""
    c = C(16, 32)
    c.box(10, 5, 14, 27, NAVYS); c.r(11, 6, 13, 8, lt(NAVYS, 1.25)); c.r(11, 10, 11, 25, NAVY_D)
    c.box(11, 0, 14, 6, NAVY_D)
    c.box(1, 15, 11, 27, NAVYS); c.r(2, 16, 10, 17, lt(NAVYS, 1.3)); c.r(2, 25, 10, 26, NAVY_D)
    c.r(2, 20, 9, 20, NAVY_D)
    c.r(1, 12, 9, 13, STEEL_D); c.r(1, 11, 3, 14, STEEL_D)
    c.r(5, 28, 8, 29, STEEL_D)
    c.r(2, 30, 14, 30, SH)
    return c.done()


# ------------------------------------------------------------------ school
def blackboard():
    """Green chalkboard (hang, 3 wide): wooden frame, chalk scribbles, chalk tray with an eraser."""
    c = C(48, 32)
    c.box(1, 3, 46, 25, WOOD_D); c.r(3, 5, 44, 22, CHALK); c.r(3, 5, 44, 5, lt(CHALK, 1.3))
    for y, x1 in ((8, 28), (12, 36), (16, 22)): c.l(6, y, x1, y, (226, 232, 224))
    c.r(32, 14, 41, 20, (226, 232, 224)); c.r(34, 16, 39, 18, CHALK); c.l(6, 20, 14, 20, (240, 220, 120))
    c.r(2, 23, 45, 25, WOOD_L); c.r(8, 23, 12, 24, WHITE); c.r(20, 23, 29, 24, (200, 90, 80)); c.r(31, 23, 36, 24, DARK)
    return c.done()


def piano_upright():
    """Upright piano against the wall: black cabinet, music stand with a score, white keys with black sharps, brass pedals."""
    c = C(32, 32)
    c.box(1, 0, 30, 20, BLACK); c.r(3, 2, 28, 8, (52, 54, 66)); c.r(4, 3, 27, 3, lt((52, 54, 66), 1.4))
    c.box(7, 2, 24, 7, CREAM); c.l(9, 4, 13, 4, DARK); c.l(15, 5, 21, 5, DARK)
    c.box(1, 16, 30, 28, (28, 30, 38)); c.r(2, 17, 29, 17, (80, 84, 98))
    c.r(3, 19, 28, 24, WHITE)
    for x in range(5, 28, 2): c.r(x, 19, x, 24, WHITE_D)
    for x in (6, 9, 14, 17, 20, 25): c.r(x, 19, x + 1, 22, BLACK)
    c.r(11, 25, 12, 27, GOLD_D); c.r(18, 25, 19, 27, GOLD_D)
    c.r(2, 29, 29, 29, SH)
    return c.done()


def bunk_bed():
    """Dorm bunk bed (1x2, vertical): ladder on the east side, top mattress with a rolled blue duvet, lower bunk with a grey blanket."""
    c = C(16, 48)
    c.box(1, 0, 14, 12, WOOD_D); c.r(2, 1, 13, 8, (210, 220, 236)); c.r(2, 4, 13, 10, (96, 140, 200)); c.r(2, 4, 13, 4, BLUE_L)
    c.box(1, 12, 14, 44, WOOD)
    c.r(2, 13, 13, 15, WHITE); c.oval(3, 14, 8, 17, WHITE_D)
    c.r(2, 19, 13, 40, (140, 146, 158)); c.r(2, 19, 13, 20, STEEL_L); c.r(2, 28, 13, 28, STEEL_D)
    c.r(1, 3, 2, 44, WOOD_DD); c.r(13, 3, 14, 44, WOOD_DD)
    for y in range(8, 40, 6): c.r(12, y, 14, y, WOOD_L)
    c.r(2, 45, 14, 45, SH)
    return c.done()


def play_mat():
    """Kindergarten foam play mat (flat, 3x2): alphabet jigsaw tiles in red, yellow, green and blue with a rounded border."""
    c = C(48, 32)
    cols = [RED, YELLOW, GREEN, BLUE_L, ORANGE, PINK]
    for i, x in enumerate(range(0, 48, 16)):
        for j, y in enumerate(range(0, 32, 16)):
            col = cols[(i * 2 + j) % 6]
            c.box(x, y, x + 15, y + 15, col, dk(col, 0.7))
            c.r(x + 4, y + 4, x + 11, y + 11, lt(col, 1.25)); c.r(x + 7, y + 4, x + 8, y + 11, WHITE); c.r(x + 5, y + 5, x + 10, y + 5, WHITE)
    return c.done()


def cubby_shelf():
    """Kindergarten cubby wall: wooden cubbies with a coloured bag or a stuffed toy in each, name stickers below."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, WOOD_L, WOOD)
    for j, y in enumerate((4, 16)):
        for i, x in enumerate((2, 12, 22)):
            c.r(x, y, x + 7, y + 9, WOOD_DD)
            col = [RED, YELLOW, GREEN_L, BLUE_L, PINK, ORANGE][(i + j * 3) % 6]
            c.r(x + 1, y + 3, x + 6, y + 9, col); c.r(x + 2, y + 2, x + 5, y + 3, dk(col, 0.7))
            c.r(x + 2, y + 10, x + 5, y + 10, WHITE)
    return c.done()


# ------------------------------------------------------------------ clinic
def dental_chair():
    """Dental chair (2x1, horizontal): reclined padded teal chair, headrest to the west, footrest east, overhead lamp arm and a spittoon bowl."""
    c = C(32, 32)
    c.box(1, 2, 12, 10, STEEL_D); c.r(2, 3, 11, 5, STEEL_L); c.oval(3, 4, 10, 8, YELLOW)
    c.r(11, 5, 16, 6, STEEL_D)
    c.block(2, 12, 30, 27, 8, (96, 190, 190), (60, 140, 150))
    c.box(2, 13, 7, 20, WHITE); c.r(3, 14, 6, 14, WHITE_D)
    c.r(8, 14, 20, 21, (120, 210, 206)); c.r(8, 14, 20, 14, lt((120, 210, 206), 1.2))
    c.r(22, 16, 29, 22, (60, 140, 150))
    c.box(23, 3, 30, 10, WHITE); c.oval(25, 5, 28, 8, ICE_D)
    c.r(24, 22, 24, 27, STEEL_D); c.r(14, 28, 18, 28, STEEL_D)
    c.r(3, 30, 30, 30, SH)
    return c.done()


def psych_couch():
    """Psychiatrist's couch (3x1): long cream chaise with a bolster and a folded blue throw, tissue box on the arm."""
    c = C(48, 32)
    c.block(1, 8, 46, 27, 10, (236, 224, 200), (204, 186, 156))
    c.box(2, 9, 12, 17, CREAM); c.r(3, 10, 11, 11, WHITE)
    c.r(15, 11, 44, 18, (226, 212, 186)); c.r(30, 11, 44, 18, (96, 130, 196)); c.r(30, 11, 30, 18, BLUE_D)
    c.box(41, 5, 46, 9, WHITE); c.r(43, 4, 44, 5, WHITE_D)
    for x in (4, 42): c.r(x, 28, x + 1, 29, WOOD_DD)
    c.r(2, 30, 46, 30, SH)
    return c.done()


def herb_cabinet():
    """Kampo (herbal medicine) cabinet (3x1): many small wooden drawers with brass pulls and kanji labels, dried herbs hanging above."""
    c = C(48, 48)
    c.box(0, 12, 47, 46, WOOD_D)
    for j, y in enumerate(range(15, 44, 6)):
        for i, x in enumerate(range(2, 46, 7)):
            c.r(x, y, x + 5, y + 4, WOOD_L if (i + j) % 2 == 0 else WOOD); c.p(x + 2, y + 2, GOLD); c.r(x + 1, y, x + 4, y, WHITE)
    for x in (6, 16, 28, 40):
        c.l(x, 0, x, 7, WOOD_DD); c.r(x - 2, 7, x + 2, 11, [(120, 150, 70), (170, 120, 60), (90, 120, 60), (160, 90, 70)][x % 4])
    c.r(1, 45, 46, 45, dk(WOOD_D, 0.8))
    return c.done()


def acupuncture_bed():
    """Acupuncture / massage table (2x1): wooden frame, white sheet with a face-hole pillow, rolled towel and a small moxa tray."""
    c = C(32, 32)
    c.block(1, 10, 30, 25, 9, WHITE, WOOD)
    c.box(2, 11, 9, 20, (240, 230, 214)); c.oval(4, 13, 7, 17, WHITE_D)
    c.r(11, 12, 28, 19, WHITE); c.r(24, 12, 28, 19, (150, 190, 230)); c.r(11, 12, 11, 19, WHITE_D)
    c.box(24, 3, 29, 8, STEEL_D); c.r(25, 4, 28, 6, ORANGE_D); c.p(26, 3, STEEL_L)
    for x in (3, 27): c.r(x, 26, x + 1, 29, WOOD_DD)
    c.r(2, 30, 29, 30, SH)
    return c.done()


def vet_table():
    """Veterinary exam table (2x1): stainless raised table with a calm tabby on it, a scale dish and a wipe-down tray."""
    c = C(32, 32)
    c.block(1, 10, 30, 24, 8, STEEL_L, STEEL)
    c.oval(5, 7, 16, 15, (220, 160, 90)); c.oval(14, 6, 19, 11, (230, 176, 104)); c.p(15, 7, OL); c.p(18, 7, OL)
    c.r(9, 9, 12, 12, (190, 120, 60)); c.l(6, 12, 3, 13, (220, 160, 90))
    c.box(22, 11, 29, 17, WHITE); c.r(23, 12, 28, 13, STEEL_L)
    c.r(3, 25, 3, 28, STEEL_D); c.r(28, 25, 28, 28, STEEL_D); c.r(4, 29, 27, 29, SH)
    return c.done()


def pet_kennels():
    """Stacked kennel wall (2x1): two rows of wire-front cages, a sleepy dog and a cat inside, ID cards on the doors."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 3, STEEL_L, STEEL, shadow=False)
    for j, y in enumerate((14, 30)):
        for i, x in enumerate((3, 17)):
            c.box(x, y, x + 11, y + 12, (200, 206, 216)); c.r(x + 1, y + 1, x + 10, y + 11, (96, 100, 112))
            if (i + j) % 2 == 0: c.oval(x + 2, y + 5, x + 9, y + 11, (210, 170, 110)); c.r(x + 7, y + 4, x + 9, y + 6, (190, 140, 80))
            else: c.oval(x + 2, y + 6, x + 9, y + 11, (90, 90, 100)); c.p(x + 4, y + 7, YELLOW)
            for k in range(x + 2, x + 11, 3): c.r(k, y + 1, k, y + 11, STEEL_L)
            c.r(x + 4, y + 13, x + 7, y + 13, WHITE)
    c.r(1, 45, 30, 45, SH)
    return c.done()


def pharmacy_shelf():
    """Pharmacy shelf wall (3x1): rows of coloured medicine boxes and bottles, green cross sign above, price tags on the rails."""
    c = C(48, 48)
    c.block(0, 8, 47, 46, 2, WHITE, (232, 238, 238), shadow=False)
    c.r(18, 0, 29, 8, (60, 150, 100)); c.r(22, 2, 25, 6, WHITE); c.r(20, 3, 27, 5, WHITE)
    cols = [RED, BLUE_L, GREEN_L, YELLOW, PINK, ORANGE, (180, 150, 220), WHITE_D]
    for j, y in enumerate((12, 21, 30, 39)):
        c.r(1, y + 6, 46, y + 6, STEEL_D)
        for i, x in enumerate(range(2, 46, 5)):
            col = cols[(i * 3 + j) % 8]; hh = 5 + (i + j) % 3
            c.r(x, y + 6 - hh, x + 3, y + 5, col); c.r(x, y + 6 - hh, x + 3, y + 6 - hh, lt(col, 1.35)); c.p(x + 1, y + 3, WHITE)
    return c.done()


# ------------------------------------------------------------------ shops
def peg_wall():
    """Variety-store peg wall (2x1): pegboard hung with gadgets in every colour and a bright '100' price flag."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 2, (236, 226, 190), (214, 200, 160), shadow=False)
    c.r(9, 0, 22, 7, YELLOW); c.r(11, 2, 12, 5, RED); c.r(14, 2, 15, 5, RED); c.r(14, 2, 17, 2, RED); c.r(14, 5, 17, 5, RED)
    cols = [RED, BLUE_L, GREEN_L, YELLOW, PINK, ORANGE, PURPLE, (120, 220, 220)]
    for j, y in enumerate((12, 21, 30, 39)):
        for i, x in enumerate(range(2, 30, 5)):
            col = cols[(i + j * 2) % 8]
            c.l(x + 2, y - 1, x + 2, y + 1, STEEL_D); c.r(x, y + 1, x + 3, y + 5, col); c.r(x, y + 1, x + 3, y + 1, lt(col, 1.3))
    c.r(1, 45, 30, 45, SH)
    return c.done()


def stationery_rack():
    """Stationery rack (2x1): pen cups, notebook stacks in pastel covers, tape and stamp pads on tilted shelves."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 2, WHITE, (220, 226, 232), shadow=False)
    c.r(8, 0, 23, 7, BLUE_L); c.r(10, 3, 21, 4, WHITE)
    for j, y in enumerate((12, 22, 32)):
        c.r(1, y + 8, 30, y + 8, STEEL_D)
        for i, x in enumerate(range(2, 30, 6)):
            col = [PINK, BLUE_L, GREEN_L, YELLOW, (200, 170, 230)][(i + j) % 5]
            if j == 0: c.r(x, y + 1, x + 4, y + 7, col); c.r(x, y + 1, x + 4, y + 1, WHITE); c.r(x + 1, y + 3, x + 3, y + 3, dk(col, 0.7))
            elif j == 1: c.r(x, y + 3, x + 4, y + 7, col); c.r(x + 1, y, x + 1, y + 3, RED); c.r(x + 3, y + 1, x + 3, y + 3, BLUE)
            else: c.oval(x, y + 3, x + 4, y + 7, col)
    return c.done()


def laptop_table():
    """Electronics demo table (2x1): three open laptops with lit blue screens, a tablet and a price stand."""
    c = C(32, 32)
    c.block(1, 14, 30, 27, 7, (230, 232, 238), (170, 176, 190))
    for x in (3, 12, 21):
        c.box(x, 3, x + 7, 11, DARK); c.r(x + 1, 4, x + 6, 9, SCREEN); c.r(x + 1, 4, x + 6, 4, SCREEN_D); c.r(x + 2, 6, x + 4, 6, WHITE)
        c.r(x - 1, 12, x + 8, 14, STEEL_L); c.r(x + 2, 13, x + 5, 13, STEEL_D)
    c.r(28, 8, 29, 12, WHITE); c.r(28, 8, 29, 8, RED)
    c.r(2, 29, 29, 29, SH)
    return c.done()


def used_goods_shelf():
    """Second-hand shelf (2x1): mismatched toys, a lamp, a radio and cassette tapes with hand-written price stickers."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, WOOD, (170, 126, 70))
    c.r(1, 12, 30, 12, WOOD_DD); c.r(1, 21, 30, 21, WOOD_DD)
    c.box(3, 4, 9, 11, STEEL_D); c.r(4, 5, 8, 7, STEEL_L); c.p(7, 9, RED)
    c.oval(13, 3, 19, 8, PINK); c.r(15, 8, 17, 11, STEEL_D)
    c.box(22, 6, 28, 11, RED_D); c.p(25, 8, YELLOW)
    for i, x in enumerate(range(3, 27, 5)): c.r(x, 15, x + 3, 20, [BLUE, GREEN, ORANGE, PURPLE, RED][i]); c.p(x + 1, 17, WHITE)
    c.box(4, 23, 12, 28, (240, 220, 140)); c.oval(17, 22, 24, 28, SKIN_D); c.r(26, 24, 29, 28, BLUE_L)
    return c.done()


def flower_cooler():
    """Florist's glass cooler (2x1): bouquets of roses, tulips and sunflowers in buckets behind frosted glass doors."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 2, (214, 232, 226), (180, 208, 204), shadow=False)
    c.r(2, 10, 29, 44, (224, 244, 250))
    for i, x in enumerate((3, 17)):
        c.r(x + 11, 10, x + 11, 44, STEEL_L)
        for j, y in enumerate((14, 28)):
            col = [RED, YELLOW, PINK, (250, 250, 250)][(i * 2 + j) % 4]
            c.r(x + 3, y + 5, x + 7, y + 9, STEEL_D)
            for k in range(0, 8, 3): c.oval(x + k, y, x + k + 3, y + 3, col); c.r(x + k + 1, y + 3, x + k + 1, y + 6, GREEN_D)
    c.r(1, 45, 30, 45, SH)
    return c.done()


def drug_gondola():
    """Drugstore double-sided gondola (2x1): pink and green cosmetic boxes and bottles with a promo header strip."""
    c = C(32, 32)
    c.block(0, 2, 31, 28, 3, (250, 236, 242), (244, 214, 226))
    c.r(2, 3, 29, 5, PINK); c.r(4, 4, 12, 4, WHITE)
    for j, y in enumerate((10, 19)):
        c.r(1, y + 6, 30, y + 6, PINK_D)
        for i, x in enumerate(range(2, 30, 4)):
            col = [PINK, GREEN_L, WHITE, (200, 170, 230), (250, 200, 120)][(i + j) % 5]
            c.r(x, y, x + 2, y + 5, col); c.r(x, y, x + 2, y, lt(col, 1.3)); c.p(x + 1, y + 2, PINK_D)
    return c.done()
