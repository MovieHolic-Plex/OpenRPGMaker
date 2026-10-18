# R11 signature props (1/3): west-facing driver cab, school, clinic. Same 3/4 top-view kit as r10/lib.py
# (lighter TOP surface above a darker FRONT face, 1px ink outline, 1px floor shadow).
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'r10'))
from lib import *

NAVYS = (52, 70, 128)
CHALK = (46, 92, 76)


# ------------------------------------------------------------------ driver cab, facing WEST (train heads left)
def cab_front_w():
    """West-facing cab front (2x8 tiles). WEST edge: silver nose shell with a red livery line wrapping a three-pane
    curved windshield (rounded outer corners, pillars, wipers) that shows the dark tunnel ahead - amber tunnel lamps,
    a green signal with halo, glare streaks. Behind it the console desk: glowing speedometer with tick ring and red
    needle, ATC cab-signal display with speed bars, twin pressure gauges, train-information monitor, lit timetable
    holder, indicator lamps and toggles, radio handset, and twin master-controller handles (brake + power T-handle)
    in notched quadrants. Driver sits EAST of it looking west."""
    c = C(32, 128)
    BODY, BODY_D = (226, 230, 236), (170, 176, 190)
    c.rbox(0, 1, 12, 126, BODY); c.rbox(0, 1, 2, 126, BODY_D)
    c.r(1, 6, 1, 121, RED); c.r(11, 4, 11, 123, BODY_D)
    TUN, TUN_D = (34, 46, 66), (22, 30, 46)
    for y0, y1 in ((5, 42), (46, 82), (86, 122)):
        c.r(3, y0, 10, y1, TUN); c.r(3, y1 - 6, 10, y1, TUN_D); c.r(3, y0, 10, y0, (70, 92, 120))
        for y in range(y0 + 4, y1 - 2, 9): c.p(4, y, (250, 190, 90)); c.p(5, y, (150, 110, 60))
        c.glare(5, y1 - 14, 10, y1 - 9, (110, 140, 180)); c.glare(7, y1 - 9, 10, y1 - 6, (90, 116, 150))
        c.l(10, y1 - 3, 6, y1 - 13, BLACK); c.p(10, y1 - 3, STEEL_D)
    for x, y in ((3, 5), (3, 122), (10, 5), (10, 122)): c.p(x, y, BODY)
    c.p(4, 5, BODY); c.p(4, 122, BODY); c.p(3, 6, BODY); c.p(3, 121, BODY)
    c.p(6, 63, (130, 255, 170)); c.p(7, 63, (90, 220, 130)); c.p(6, 62, (60, 150, 100)); c.p(6, 64, (60, 150, 100)); c.p(5, 63, (60, 150, 100))
    for y in (43, 83): c.r(2, y, 11, y + 2, BODY_D); c.r(2, y + 1, 11, y + 1, OL)
    DESK, DESK_L = (60, 64, 76), (78, 84, 98)
    c.box(12, 3, 31, 122, (40, 42, 50))
    c.r(13, 4, 30, 116, DESK); c.r(13, 4, 30, 4, DESK_L); c.r(13, 4, 13, 116, DESK_L)
    c.r(13, 117, 30, 117, (30, 32, 38)); c.r(13, 118, 30, 121, (46, 48, 58)); c.r(13, 120, 30, 120, (36, 38, 46))
    c.r(12, 123, 31, 124, SH)
    c.oval(13, 7, 25, 19, (250, 190, 90)); c.e(14, 8, 24, 18, (16, 18, 24))
    for x, y in ((15, 13), (16, 10), (19, 9), (22, 10), (23, 13)): c.p(x, y, (90, 230, 130))
    c.p(23, 16, RED_L); c.l(19, 13, 16, 10, RED_L); c.p(19, 13, STEEL_L); c.r(18, 16, 20, 16, (90, 230, 130))
    c.box(13, 22, 25, 40, BLACK); c.r(14, 23, 24, 39, (12, 26, 34))
    for i, x in enumerate(range(15, 24, 2)): c.r(x, 37 - (i + 1) * 2, x, 37, (60, 220, 120) if i < 3 else (250, 200, 70))
    c.r(15, 26, 23, 26, RED); c.r(15, 24, 17, 24, WHITE); c.r(19, 24, 21, 24, WHITE)
    for y in (7, 14):
        c.oval(26, y, 30, y + 4, WHITE); c.p(28, y + 2, OL); c.p(27, y + 1, RED)
    c.box(13, 44, 25, 60, BLACK); c.r(14, 45, 24, 59, (30, 90, 150)); c.r(14, 45, 24, 46, (60, 140, 200))
    for y in (49, 53, 57):
        for x in range(15, 24, 3): c.r(x, y, x + 1, y + 1, WHITE if (x + y) % 2 else (140, 210, 240))
    c.box(26, 22, 30, 46, (240, 234, 212)); c.r(27, 23, 29, 23, (255, 250, 230)); c.r(27, 21, 29, 22, STEEL_D)
    for y in range(26, 44, 3): c.r(27, y, 29 - (y % 2), y, (120, 116, 104))
    c.rbox(26, 50, 30, 66, BLACK); c.r(27, 51, 27, 65, (70, 72, 84))
    for y in range(67, 74, 2): c.p(28, y, BLACK); c.p(29, y + 1, BLACK)
    for i, y in enumerate((64, 69, 74)):
        col = [RED, (80, 220, 110), YELLOW][i]
        c.oval(14, y, 17, y + 3, col); c.p(15, y + 1, lt(col, 1.5))
        c.box(19, y, 23, y + 3, STEEL_D); c.r(20, y + 1, 21, y + 1, STEEL_L)
    for y0, grip in ((80, BLACK), (98, RED)):
        c.rbox(14, y0, 24, y0 + 15, (26, 28, 34))
        for k in range(y0 + 2, y0 + 14, 3): c.r(15, k, 17, k, STEEL_D)
        c.oval(21, y0 + 3, 30, y0 + 12, STEEL_D); c.oval(23, y0 + 5, 28, y0 + 10, STEEL); c.p(24, y0 + 6, STEEL_L)
        c.l(25, y0 + 8, 14, y0 + 6, STEEL_L); c.l(25, y0 + 9, 14, y0 + 7, STEEL_D)
        c.box(11, y0 + 3, 15, y0 + 10, grip); c.p(12, y0 + 4, lt(grip, 1.6) if grip != BLACK else (90, 92, 104))
    return c.done()


def cab_seat_w():
    """Driver's seat facing WEST: plump navy moquette cushion toward the console, tall contoured backrest with a
    separate headrest on the east side, black armrest, chrome gas-lift post on a five-star base."""
    c = C(16, 32)
    L, M, D = lt(NAVYS, 1.35), NAVYS, NAVY_D
    c.e(1, 27, 15, 31, SH)
    c.oval(2, 26, 13, 30, STEEL_D); c.r(4, 27, 11, 27, STEEL_L); c.p(2, 28, BLACK); c.p(13, 28, BLACK)
    c.r(7, 20, 8, 27, STEEL_D); c.r(7, 20, 7, 27, STEEL_L)
    c.cushion(10, 4, 15, 25, L, M, D); c.r(12, 8, 12, 22, dk(M, 0.85))
    c.cushion(10, 0, 15, 5, L, M, D)
    c.cushion(1, 13, 12, 24, L, M, D); c.r(3, 18, 9, 18, dk(M, 0.85)); c.p(3, 15, lt(L, 1.15))
    c.rbox(2, 11, 10, 14, BLACK); c.r(3, 11, 9, 11, (84, 86, 98))
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
