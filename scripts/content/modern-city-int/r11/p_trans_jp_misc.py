# R11 signature props (3/3): transport, hotels, Japanese traditional, offices/industry/arts/salon. Same 3/4 top-view kit as r10/lib.py.
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'r10'))
from lib import *


# ------------------------------------------------------------------ transport
def checkin_counter():
    """Airport check-in counter (4x1): white desk with monitors, luggage-weighing belt on the west end, airline colour band and tag printers."""
    c = C(64, 48)
    c.block(0, 14, 63, 43, 6, (240, 244, 250), (150, 170, 210))
    c.r(1, 15, 62, 17, (40, 90, 170)); c.r(2, 16, 61, 16, RED)
    for x in (24, 38, 52): c.box(x, 4, x + 8, 11, DARK); c.r(x + 1, 5, x + 7, 9, SCREEN); c.r(x + 3, 12, x + 5, 14, STEEL_D)
    c.box(2, 18, 21, 30, DARK_M); c.r(3, 19, 20, 29, (84, 90, 104))
    for x in range(5, 20, 4): c.r(x, 19, x, 29, DARK)
    c.box(8, 23, 16, 27, (200, 120, 70))
    c.r(24, 22, 60, 22, WHITE_D)
    c.r(2, 44, 62, 44, SH)
    return c.done()


def baggage_belt():
    """Baggage carousel (4x2, flat-ish): rubber belt loop with slatted ends, suitcases in several colours riding it."""
    c = C(64, 48)
    c.box(1, 6, 62, 41, DARK_M); c.r(3, 8, 60, 39, (72, 76, 90)); c.r(8, 14, 55, 33, DARK)
    c.oval(3, 8, 20, 39, (72, 76, 90)); c.oval(44, 8, 60, 39, (72, 76, 90))
    c.r(10, 16, 53, 31, STEEL_D)
    for x in range(10, 54, 4): c.r(x, 16, x, 31, STEEL)
    for i, (x, y, w, h, col) in enumerate(((6, 11, 8, 6, BLUE), (24, 8, 10, 6, RED), (44, 10, 7, 5, GREEN), (14, 34, 8, 6, ORANGE), (36, 35, 10, 5, PURPLE))):
        c.box(x, y, x + w, y + h, col); c.r(x + 1, y + 1, x + w - 1, y + 1, lt(col, 1.3)); c.r(x + w - 2, y + h + 1, x + w - 1, y + h + 2, BLACK)
    c.r(2, 42, 61, 42, SH)
    return c.done()


def xray_lane():
    """Security X-ray lane (3x1): steel tunnel with rubber flaps, roller conveyor, grey bins and an operator monitor."""
    c = C(48, 32)
    c.block(0, 8, 47, 27, 6, STEEL_L, STEEL_D)
    c.box(14, 3, 33, 19, (90, 96, 110)); c.r(16, 5, 31, 17, DARK); c.r(16, 8, 31, 8, (60, 64, 76)); c.r(16, 13, 31, 13, (60, 64, 76))
    for x in range(2, 14, 3): c.r(x, 15, x + 1, 23, STEEL_D)
    for x in range(35, 46, 3): c.r(x, 15, x + 1, 23, STEEL_D)
    c.box(3, 3, 9, 9, (200, 206, 214)); c.box(38, 3, 45, 9, (200, 206, 214))
    c.box(18, 22, 28, 27, BLACK); c.r(19, 23, 27, 25, (60, 200, 140))
    c.r(2, 29, 45, 29, SH)
    return c.done()


def flight_board():
    """Departures board (hang, 3 wide): black panel with amber flight rows, destination columns and a green 'on time' status."""
    c = C(48, 32)
    c.box(0, 4, 47, 27, BLACK); c.r(2, 6, 45, 8, (60, 64, 76))
    for y in (11, 15, 19, 23):
        c.r(4, y, 12, y + 1, (250, 190, 60)); c.r(16, y, 30, y + 1, (250, 190, 60)); c.r(34, y, 42, y + 1, [(90, 230, 120), (250, 190, 60), (230, 90, 90)][y % 3])
    c.r(3, 28, 4, 31, STEEL_D); c.r(43, 28, 44, 31, STEEL_D)
    return c.done()


def fuel_pump():
    """Gas station pump island (2x2, floor): two red-and-white pumps with hose and nozzle holsters on a raised kerb island with a yellow bollard."""
    c = C(32, 48)
    c.block(0, 24, 31, 44, 4, (176, 180, 192), (120, 126, 140))
    for x in (2, 17):
        c.block(x, 4, x + 11, 30, 6, WHITE, RED)
        c.box(x + 2, 7, x + 9, 13, BLACK); c.r(x + 3, 8, x + 8, 10, (90, 230, 120)); c.r(x + 3, 11, x + 6, 11, YELLOW)
        c.r(x + 1, 17, x + 10, 17, RED_D); c.box(x + 8, 18, x + 10, 27, STEEL_D)
        c.l(x + 9, 28, x + 5, 34, BLACK)
    c.r(14, 28, 17, 40, YELLOW); c.r(14, 32, 17, 33, BLACK)
    c.r(1, 45, 30, 45, SH)
    return c.done()


def bus_bay_sign():
    """Bus stop pole bay (2x2, floor): bench under a glass shelter roof edge with a route sign, timetable and a rubber bumper strip."""
    c = C(32, 48)
    c.block(1, 6, 30, 26, 5, (210, 232, 244), (130, 170, 200))
    c.r(3, 9, 28, 14, (226, 244, 250)); c.r(3, 9, 28, 9, WHITE)
    c.box(6, 1, 12, 8, GREEN); c.r(7, 2, 11, 3, WHITE)
    c.block(3, 30, 28, 38, 3, WOOD_L, WOOD)
    c.r(3, 40, 28, 41, YELLOW); c.r(3, 40, 28, 40, BLACK)
    c.r(2, 44, 29, 44, SH)
    return c.done()


# ------------------------------------------------------------------ hotels
def capsule_pods():
    """Capsule-hotel pods (3x2, wall): two stacked rows of white cabin openings with roller blinds half open, light-up numbers, a small ladder."""
    c = C(48, 48)
    c.block(0, 6, 47, 46, 3, (228, 232, 240), (180, 190, 208), shadow=False)
    for j, y in enumerate((10, 28)):
        for i, x in enumerate((2, 18, 34)):
            c.box(x, y, x + 12, y + 14, (70, 74, 90)); c.r(x + 1, y + 1, x + 11, y + 13, (236, 224, 200))
            c.r(x + 1, y + 1, x + 11, y + 6, (60, 70, 100)); c.r(x + 1, y + 6, x + 11, y + 6, STEEL_L)
            c.r(x + 2, y + 9, x + 10, y + 12, WHITE); c.r(x + 2, y + 9, x + 5, y + 10, (150, 190, 230))
            c.r(x + 5, y - 3 if y > 10 else y, x + 7, y, YELLOW); c.p(x + 6, y, ORANGE)
    c.r(1, 45, 46, 45, SH)
    return c.done()


def key_rack():
    """Reception key board (hang): wooden board with numbered brass hooks, keys with tags and a bell."""
    c = C(32, 32)
    c.box(1, 3, 30, 24, WOOD_DD); c.r(3, 5, 28, 22, WOOD)
    for y in (8, 15):
        for x in range(5, 27, 4): c.r(x, y, x, y + 3, GOLD); c.r(x - 1, y + 3, x + 1, y + 4, [RED, WHITE, BLUE_L][x % 3])
    c.oval(23, 24, 28, 29, GOLD); c.p(25, 26, WHITE)
    return c.done()


# ------------------------------------------------------------------ Japanese traditional
def rock_bath():
    """Onsen rock bath (4x3): irregular boulders ringing steaming turquoise water, a wooden bucket and a towel on a flat stone, steam wisps."""
    c = C(64, 48)
    c.oval(2, 8, 61, 44, (96, 90, 84)); c.oval(5, 11, 58, 40, (60, 150, 160)); c.oval(9, 14, 54, 36, (96, 190, 196)); c.oval(16, 19, 46, 31, (130, 214, 214))
    rocks = [(0, 20, 8, 10), (10, 6, 10, 7), (24, 5, 10, 7), (40, 7, 10, 7), (54, 18, 9, 10), (50, 36, 10, 8), (28, 38, 12, 8), (8, 36, 10, 8)]
    for x, y, w, h in rocks: c.oval(x, y, x + w, y + h, (130, 124, 116)); c.oval(x + 1, y + 1, x + w - 2, y + h - 3, (162, 156, 146)); c.p(x + 2, y + 2, (196, 190, 178))
    for x, y in ((22, 22), (34, 26), (40, 20), (28, 30)): c.l(x, y, x + 3, y - 1, WHITE)
    c.box(52, 2, 60, 8, WOOD_D); c.r(53, 3, 59, 4, WOOD_L)
    for x, y in ((18, 1), (34, 0), (46, 2)): c.l(x, y + 4, x + 1, y, (230, 240, 244)); c.l(x + 1, y, x + 2, y - 1, (220, 232, 238))
    return c.done()


def buddha_altar():
    """Temple Buddha altar (3x2): gold seated Buddha on a lotus pedestal, red lacquer dais, incense bowl, flower vases and two candles."""
    c = C(48, 48)
    c.block(0, 20, 47, 44, 5, (150, 40, 40), (110, 30, 36))
    c.r(14, 28, 33, 29, GOLD_D); c.r(2, 28, 12, 29, GOLD_D); c.r(35, 28, 45, 29, GOLD_D)
    c.oval(14, 22, 33, 34, GOLD_D); c.oval(16, 23, 31, 32, GOLD)
    c.oval(20, 6, 27, 14, GOLD); c.oval(22, 8, 25, 12, GOLD_D); c.r(23, 2, 24, 4, GOLD)
    c.oval(16, 12, 31, 26, GOLD); c.oval(18, 15, 29, 24, GOLD_D); c.r(21, 17, 26, 19, GOLD)
    c.oval(4, 30, 10, 36, (230, 100, 140)); c.oval(37, 30, 43, 36, (230, 100, 140))
    c.box(20, 36, 27, 41, STEEL_D); c.r(22, 33, 22, 36, ORANGE); c.r(24, 33, 24, 36, ORANGE)
    c.r(1, 45, 46, 45, SH)
    return c.done()


def incense_burner():
    """Temple incense burner (1x1): bronze cauldron on three legs, sticks glowing red in grey ash and thin smoke."""
    c = C(16, 32)
    c.box(2, 12, 13, 24, (110, 90, 60)); c.r(3, 13, 12, 15, (150, 124, 84)); c.r(4, 14, 11, 16, (190, 190, 180))
    for x in (5, 8, 11): c.r(x, 7, x, 14, (150, 90, 60)); c.p(x, 7, RED)
    for x, y in ((4, 2), (8, 0), (12, 3)): c.p(x, y, (210, 214, 220)); c.p(x + 1, y + 2, (190, 194, 200))
    for x in (3, 7, 11): c.r(x, 25, x + 1, 28, (90, 70, 46))
    c.r(2, 30, 13, 30, SH)
    return c.done()


def tea_hearth():
    """Tea-ceremony room (2x2): sunken hearth in tatami with an iron kettle on a trivet, tea bowl, whisk, water jar and a folded tea cloth."""
    c = C(32, 32)
    c.r(0, 0, 31, 31, (190, 196, 130))
    for y in range(2, 30, 2): c.r(1, y, 30, y, (176, 184, 112))
    c.box(7, 7, 24, 24, (60, 40, 30)); c.r(9, 9, 22, 22, (150, 140, 124))
    c.oval(11, 11, 20, 20, DARK); c.oval(13, 12, 18, 18, (60, 62, 74)); c.r(15, 10, 16, 12, STEEL_D)
    c.box(2, 3, 8, 8, (60, 40, 30)); c.oval(3, 4, 7, 7, (80, 130, 70))
    c.box(23, 26, 30, 30, WOOD_DD); c.r(24, 27, 29, 28, WOOD)
    c.oval(2, 22, 7, 27, GREEN_D); c.p(4, 23, GREEN_L)
    return c.done()


def shoji_screen():
    """Shoji screen (3x1, wall): white paper panes in a dark wood lattice grid with a lower solid wood rail, light glowing through."""
    c = C(48, 48)
    c.box(0, 8, 47, 46, WOOD_DD)
    c.r(2, 10, 45, 40, (250, 244, 224))
    for x in range(2, 46, 7): c.r(x, 10, x, 40, WOOD_D)
    for y in (17, 24, 31): c.r(2, y, 45, y, WOOD_D)
    c.r(2, 10, 45, 10, WOOD_D); c.r(2, 40, 45, 40, WOOD_D)
    c.r(2, 42, 45, 44, WOOD); c.r(2, 42, 45, 42, WOOD_L)
    c.r(1, 45, 46, 45, SH)
    return c.done()


def tokonoma():
    """Tokonoma alcove (3x1, wall): raised wood floor with an ikebana vase, hanging calligraphy scroll above, a small incense dish."""
    c = C(48, 48)
    c.box(0, 8, 47, 46, (96, 70, 46)); c.r(2, 10, 45, 36, (216, 200, 156)); c.r(2, 38, 45, 44, WOOD)
    c.box(16, 1, 31, 25, (240, 232, 210)); c.r(17, 2, 30, 4, (150, 40, 40)); c.r(22, 6, 25, 22, BLACK); c.r(19, 12, 28, 14, BLACK)
    c.r(23, 0, 24, 1, WOOD_D)
    c.oval(9, 33, 16, 41, (60, 90, 150)); c.l(12, 33, 12, 24, GREEN_D); c.oval(10, 22, 15, 26, PINK); c.l(14, 34, 18, 27, GREEN_D)
    c.box(34, 38, 41, 42, STEEL_D)
    c.r(1, 45, 46, 45, SH)
    return c.done()


def torii_gate():
    """Torii gate (3x2): two round vermilion pillars on stone footings, a black upswept kasagi top beam and a lower tie beam, seen from the south."""
    c = C(48, 48)
    c.box(2, 18, 45, 24, BLACK); c.r(3, 19, 44, 22, (30, 30, 40)); c.r(0, 16, 4, 18, BLACK); c.r(43, 16, 47, 18, BLACK)
    c.r(5, 25, 42, 30, RED); c.r(5, 25, 42, 25, RED_L)
    for x in (7, 36):
        c.r(x, 25, x + 4, 42, RED); c.r(x, 25, x, 42, RED_L); c.r(x + 4, 25, x + 4, 42, RED_D)
        c.box(x - 1, 40, x + 5, 45, (150, 144, 134)); c.r(x - 1, 40, x + 5, 41, (190, 184, 172))
    c.r(1, 46, 46, 46, SH)
    return c.done()


# ------------------------------------------------------------------ offices / industry / arts / personal services
def washer_row():
    """Coin-laundry washers (3x1, wall): three front-load drums in a steel row with blue-lit panels and coin slots, a soap vending shelf above."""
    c = C(48, 48)
    c.block(0, 8, 47, 46, 2, WHITE, (214, 222, 232), shadow=False)
    c.r(2, 0, 45, 6, (60, 130, 200)); c.r(6, 2, 20, 4, WHITE)
    for i, x in enumerate((2, 18, 34)):
        c.box(x, 12, x + 12, 42, (236, 240, 246)); c.r(x + 1, 13, x + 11, 18, (90, 150, 220)); c.r(x + 3, 14, x + 9, 16, BLACK); c.p(x + 10, 15, YELLOW)
        c.oval(x + 1, 21, x + 11, 35, STEEL_D); c.oval(x + 3, 23, x + 9, 33, GLASS); c.oval(x + 4, 25, x + 8, 30, GLASS_L)
        c.r(x + 5, 38, x + 7, 39, STEEL_D)
    c.r(1, 45, 46, 45, SH)
    return c.done()


def dryer_stack():
    """Stacked dryers (2x1, wall): two round-window dryers one above the other with lint trap and heat dial."""
    c = C(32, 48)
    c.block(0, 2, 31, 46, 2, WHITE, (214, 222, 232), shadow=False)
    for y in (4, 25):
        c.box(2, y, 29, y + 18, (232, 236, 244)); c.r(3, y + 1, 28, y + 3, STEEL_L); c.oval(7, y + 5, 24, y + 17, STEEL_D); c.oval(9, y + 7, 22, y + 15, (200, 150, 110)); c.oval(11, y + 8, 18, y + 12, (230, 190, 150))
    c.r(1, 45, 30, 45, SH)
    return c.done()


def conveyor_line():
    """Factory conveyor line (4x1): steel roller belt running west-east with cardboard boxes and a yellow guard rail, motor housing on the end."""
    c = C(64, 32)
    c.block(0, 8, 63, 27, 6, DARK_M, STEEL_D)
    for x in range(4, 52, 4): c.r(x, 10, x + 1, 17, STEEL); c.r(x + 2, 10, x + 2, 17, STEEL_D)
    for x, w in ((6, 10), (22, 8), (36, 10)): c.box(x, 3, x + w, 12, (200, 150, 96)); c.r(x + 1, 4, x + w - 1, 4, (230, 190, 130)); c.r(x + w // 2, 4, x + w // 2, 12, WOOD_D)
    c.r(0, 19, 63, 20, YELLOW); c.r(8, 19, 10, 20, BLACK); c.r(24, 19, 26, 20, BLACK); c.r(40, 19, 42, 20, BLACK)
    c.box(52, 4, 62, 18, (70, 130, 200)); c.r(54, 6, 60, 10, BLACK)
    c.r(1, 29, 62, 29, SH)
    return c.done()


def lathe_machine():
    """CNC lathe (2x1): light-grey housing with a big window onto the spindle, orange panel with a green screen and coolant sump."""
    c = C(32, 32)
    c.block(1, 4, 30, 27, 7, (226, 230, 236), (174, 182, 196))
    c.box(4, 7, 20, 17, DARK); c.r(5, 8, 19, 16, (150, 196, 220)); c.oval(7, 10, 13, 15, STEEL_D); c.l(14, 12, 18, 12, STEEL_L)
    c.box(22, 6, 29, 14, ORANGE_D); c.r(23, 7, 28, 10, (90, 230, 120)); c.r(23, 12, 28, 12, WHITE)
    c.r(4, 20, 27, 22, STEEL_D)
    c.r(2, 29, 29, 29, SH)
    return c.done()


def pallet_jack_forklift():
    """Forklift (2x2): yellow counterbalance truck, black seat, overhead guard, fork mast with loaded wooden pallet."""
    c = C(32, 48)
    c.block(2, 4, 29, 14, 3, STEEL_L, (150, 154, 166))
    c.r(6, 5, 7, 12, STEEL_D); c.r(24, 5, 25, 12, STEEL_D)
    c.block(2, 20, 29, 42, 8, YELLOW, YELLOW_D)
    c.box(8, 22, 23, 28, BLACK); c.r(10, 24, 21, 26, (60, 64, 76))
    c.r(12, 31, 19, 38, DARK); c.oval(13, 33, 18, 37, STEEL_D)
    c.box(1, 14, 30, 19, STEEL_D)
    c.box(4, 0, 27, 4, (190, 150, 90)); c.r(5, 1, 26, 2, (220, 184, 124))
    for x in (3, 25): c.oval(x, 40, x + 4, 46, BLACK)
    c.r(2, 46, 29, 46, SH)
    return c.done()


def barber_chair():
    """Barber chair (1x2): red leather seat with chrome base and hydraulic post, wide footrest, chrome armrests, facing south to the mirror."""
    c = C(16, 32)
    c.box(2, 4, 13, 15, RED_D); c.r(3, 5, 12, 9, RED); c.r(3, 5, 12, 5, RED_L)
    c.box(1, 14, 14, 24, RED); c.r(2, 15, 13, 17, RED_L); c.r(2, 23, 13, 23, RED_D)
    c.r(0, 12, 1, 22, STEEL_L); c.r(14, 12, 15, 22, STEEL_L)
    c.r(6, 25, 9, 27, STEEL_D); c.box(2, 27, 13, 29, STEEL_L)
    c.r(3, 30, 13, 30, SH)
    return c.done()


def salon_basin():
    """Shampoo station (2x1): reclining wash chair back-first to a ceramic basin, mixer tap and a towel rack."""
    c = C(32, 32)
    c.block(1, 4, 30, 27, 9, (240, 244, 250), (200, 210, 224))
    c.box(18, 6, 29, 16, WHITE); c.oval(19, 7, 28, 15, ICE_D); c.oval(21, 9, 26, 13, ICE); c.r(23, 5, 24, 8, STEEL_L)
    c.box(2, 10, 15, 22, (96, 100, 120)); c.r(3, 11, 14, 14, (150, 154, 176)); c.r(3, 20, 14, 21, (60, 64, 80))
    c.r(2, 29, 29, 29, SH)
    return c.done()


def salon_mirror():
    """Salon mirror station (2x1, wall): bright rimmed mirror, counter with scissors, comb jar and a hair dryer in a holster."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 2, (240, 236, 232), (210, 204, 198), shadow=False)
    c.box(3, 1, 28, 24, STEEL_L); c.r(5, 3, 26, 22, (204, 232, 244)); c.l(8, 20, 14, 12, WHITE); c.l(14, 20, 22, 8, WHITE)
    c.r(2, 28, 29, 29, (120, 96, 72)); c.r(2, 28, 29, 28, WOOD_L)
    c.l(6, 31, 6, 36, STEEL_L); c.l(9, 31, 9, 36, STEEL_L); c.box(15, 30, 19, 38, ICE_D); c.r(16, 28, 18, 31, DARK)
    c.box(22, 31, 27, 36, BLACK); c.r(26, 33, 29, 34, STEEL_D)
    c.r(1, 45, 30, 45, SH)
    return c.done()


def listing_board():
    """Real-estate listing window (hang, 3 wide): glass front board covered with floor-plan sheets, photos and orange price tags."""
    c = C(48, 32)
    c.box(1, 3, 46, 26, STEEL_L); c.r(3, 5, 44, 24, (240, 244, 250))
    for i, x in enumerate(range(5, 42, 9)):
        c.box(x, 7, x + 7, 14, WHITE); c.l(x + 1, 9, x + 6, 9, BLUE); c.l(x + 1, 11, x + 4, 11, BLUE); c.r(x + 4, 11, x + 6, 13, BLUE_L)
        c.r(x, 17, x + 7, 22, [ORANGE, YELLOW, PINK, GREEN_L][i % 4]); c.r(x + 1, 19, x + 6, 19, WHITE)
    return c.done()


def shop_arcade_front():
    """Underground-mall shopfront (3x1, wall): glass window display with a mannequin silhouette, striped awning strip and a name board."""
    c = C(48, 48)
    c.block(0, 10, 47, 46, 2, (214, 218, 226), (170, 176, 190), shadow=False)
    c.r(1, 0, 46, 8, (200, 60, 70))
    for x in range(1, 46, 6): c.r(x, 1, x + 2, 8, WHITE)
    c.r(3, 12, 44, 40, (210, 230, 240)); c.r(3, 12, 44, 12, WHITE)
    c.oval(10, 16, 15, 21, SKIN_D); c.r(8, 21, 17, 34, (60, 90, 170)); c.r(10, 34, 15, 40, DARK)
    c.r(24, 18, 38, 22, (240, 190, 70)); c.r(24, 26, 40, 30, PINK); c.r(24, 33, 36, 37, GREEN_L)
    c.r(1, 45, 46, 45, SH)
    return c.done()


def gallery_plinth():
    """Gallery plinth with glass cube (1x1): white column topped by a lit glass case holding a small abstract sculpture."""
    c = C(16, 32)
    c.block(2, 14, 13, 28, 3, WHITE, (220, 224, 232))
    c.box(2, 3, 13, 14, (220, 240, 250)); c.r(3, 4, 12, 4, WHITE)
    c.oval(5, 6, 10, 12, GOLD_D); c.oval(6, 5, 9, 9, GOLD)
    c.r(3, 30, 13, 30, SH)
    return c.done()


def installation_art():
    """Contemporary art installation (2x2): ring of coloured acrylic panels standing on a white floor disc with a hovering sphere."""
    c = C(32, 48)
    c.oval(1, 28, 30, 44, (232, 234, 240)); c.oval(3, 30, 28, 42, WHITE)
    for i, x in enumerate((3, 9, 15, 21)):
        col = [RED, YELLOW, BLUE_L, GREEN_L][i]
        c.box(x, 12 + (i % 2) * 3, x + 5, 36 + (i % 2) * 2, col, dk(col, 0.6)); c.r(x + 1, 13 + (i % 2) * 3, x + 1, 33, lt(col, 1.4))
    c.oval(11, 3, 20, 12, (240, 240, 250)); c.oval(13, 4, 16, 7, WHITE)
    c.r(2, 45, 29, 45, SH)
    return c.done()
