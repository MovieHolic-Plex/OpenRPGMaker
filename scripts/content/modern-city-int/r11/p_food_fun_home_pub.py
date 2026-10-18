# R11 signature props (2/3): restaurants, amusement, housing, public services. Same 3/4 top-view kit as r10/lib.py.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'r10'))
from lib import *


# ------------------------------------------------------------------ food
def sushi_case():
    """Sushi counter case (3x1): hinoki frame, glass showcase with rows of nigiri on leaf plates, a knife block and soy dish on top."""
    c = C(48, 32)
    c.block(0, 6, 47, 27, 5, (230, 196, 140), (190, 148, 92))
    c.r(3, 12, 44, 19, (224, 244, 250)); c.r(3, 12, 44, 12, WHITE)
    for i, x in enumerate(range(5, 43, 5)):
        c.r(x, 15, x + 3, 17, WHITE); c.r(x - 1, 14, x + 4, 15, [(250, 120, 100), (250, 170, 120), (230, 90, 90), (250, 220, 150)][i % 4])
    c.box(4, 2, 9, 5, DARK); c.r(5, 3, 8, 3, STEEL_L); c.box(36, 2, 41, 5, WHITE); c.r(37, 3, 40, 4, (60, 40, 30))
    c.r(2, 29, 45, 29, SH)
    return c.done()


def grill_table():
    """Yakiniku table (2x2): dark wood top with a round charcoal grill, meat plates, tongs and a steel smoke duct dropping from above."""
    c = C(32, 48)
    c.box(14, 0, 17, 14, STEEL_D); c.r(15, 1, 16, 12, STEEL_L)
    c.oval(6, 12, 25, 22, STEEL_D); c.oval(8, 13, 23, 20, STEEL_L)
    c.block(1, 14, 30, 44, 20, WOOD_DD, (86, 56, 30))
    c.oval(8, 19, 23, 30, DARK); c.oval(10, 21, 21, 28, (230, 110, 50)); c.oval(12, 23, 19, 26, YELLOW)
    for x in range(10, 22, 3): c.l(x, 21, x, 28, STEEL)
    c.box(3, 33, 11, 38, WHITE); c.r(4, 34, 10, 36, (230, 90, 100)); c.box(20, 33, 28, 38, WHITE); c.r(21, 34, 27, 36, (240, 150, 150))
    c.l(14, 36, 17, 31, STEEL_L); c.l(17, 36, 14, 31, STEEL_L)
    c.r(2, 45, 29, 45, SH)
    return c.done()


def bento_counter():
    """Bento shop counter (3x1): warm glass case of boxed lunches (rice, karaage, pickles), cash tray and a hand-lettered menu board."""
    c = C(48, 32)
    c.block(0, 6, 47, 27, 4, (252, 240, 214), (214, 190, 150))
    c.r(3, 11, 44, 20, (250, 232, 190)); c.r(3, 11, 44, 11, WHITE)
    for i, x in enumerate(range(4, 43, 8)):
        c.box(x, 13, x + 6, 18, (150, 100, 60)); c.r(x + 1, 14, x + 3, 17, WHITE); c.r(x + 4, 14, x + 5, 17, [ORANGE, GREEN_L, RED][i % 3])
    c.box(2, 1, 12, 5, BLACK); c.r(3, 2, 11, 4, (250, 246, 230))
    c.box(36, 2, 44, 5, STEEL_L); c.r(37, 3, 43, 4, STEEL)
    c.r(2, 29, 45, 29, SH)
    return c.done()


def fastfood_counter():
    """Fast-food order counter (3x1): red-and-yellow front, lit menu panel, tray stack, fryer basket and soda cups."""
    c = C(48, 48)
    c.box(0, 0, 47, 14, RED); c.r(2, 2, 45, 12, (250, 240, 200))
    for i, x in enumerate(range(3, 44, 10)): c.r(x, 4, x + 7, 6, (230, 90, 60)); c.r(x, 8, x + 5, 9, BLACK); c.r(x + 6, 8, x + 7, 9, YELLOW)
    c.block(0, 20, 47, 43, 8, YELLOW, RED)
    c.box(3, 21, 12, 27, WHITE_D); c.r(4, 22, 11, 22, WHITE); c.box(15, 21, 22, 27, STEEL_L); c.r(16, 23, 21, 25, DARK)
    for x in (28, 33, 38): c.box(x, 20, x + 3, 26, WHITE); c.r(x, 20, x + 3, 21, RED)
    c.r(2, 44, 45, 44, SH)
    return c.done()


def meal_ticket_machine():
    """Ramen ticket vending machine (1x1): red cabinet, rows of photo buttons, coin slot and the ticket tray."""
    c = C(16, 32)
    c.block(1, 2, 14, 29, 3, (240, 120, 100), RED)
    for y in (8, 13, 18):
        for x in (3, 8): c.box(x, y, x + 3, y + 3, (250, 230, 190))
    c.r(3, 23, 12, 24, BLACK); c.r(4, 26, 11, 27, (40, 30, 30))
    return c.done()


def drink_dispenser():
    """Drink bar (1x1): wall soda fountain with four coloured nozzles, a cup rack and a drip tray."""
    c = C(16, 32)
    c.block(1, 2, 14, 29, 4, WHITE, STEEL_L)
    for i, x in enumerate((3, 6, 9, 12)): c.r(x, 11, x + 1, 17, [RED, ORANGE, GREEN, BLUE][i]); c.r(x, 18, x + 1, 19, STEEL_D)
    c.r(3, 22, 12, 23, STEEL_D); c.r(3, 26, 12, 26, STEEL)
    return c.done()


# ------------------------------------------------------------------ amusement
def pachinko_island():
    """Pachinko island (4x1): four glowing machines in a row - pink/blue/yellow flashing tops, silver ball trays and cushioned stools in front."""
    c = C(64, 32)
    c.block(0, 0, 63, 22, 10, (40, 40, 60), (30, 30, 44))
    for i, x in enumerate((2, 18, 34, 50)):
        top = [(250, 90, 170), (90, 160, 250), (250, 220, 80), (110, 230, 150)][i]
        c.box(x, 1, x + 11, 15, top); c.r(x + 2, 3, x + 9, 12, (20, 20, 40)); c.oval(x + 3, 4, x + 8, 9, top); c.p(x + 5, 6, WHITE)
        c.r(x + 1, 15, x + 10, 17, STEEL_L); c.r(x + 2, 16, x + 9, 16, STEEL_D)
        c.oval(x + 3, 24, x + 8, 29, RED_D); c.r(x + 4, 25, x + 7, 26, RED_L)
    return c.done()


def bowling_lane():
    """Bowling lane (6x2, west-east): polished maple boards with arrows and dots, dark gutters either side, foul line and approach on the west."""
    c = C(96, 32)
    c.box(0, 0, 95, 31, (60, 60, 70))
    c.r(1, 5, 94, 26, (226, 186, 120))
    for y in range(7, 26, 3): c.r(1, y, 94, y, (210, 168, 100))
    c.r(1, 5, 94, 6, (238, 204, 140)); c.r(1, 25, 94, 26, (190, 148, 84))
    c.r(18, 5, 18, 26, RED); c.r(1, 5, 17, 26, (240, 210, 150))
    for i in range(7):
        x = 36 + i * 6; y = 15 + (3 - abs(3 - i)) * 2 - 4 + 4 * (1 if i % 2 else 0)
        c.l(x, 15 - abs(3 - i), x + 2, 15 - abs(3 - i) + 0, (60, 40, 30)); c.p(x, 11 + (i % 2) * 2 + abs(3 - i), (60, 40, 30))
    for x in (28, 44, 60): c.r(x, 11, x, 11, (60, 40, 30)); c.r(x, 20, x, 20, (60, 40, 30))
    return c.done()


def bowling_pins():
    """Pin deck + pinsetter (1x2): ten white red-striped pins in a triangle, black pinsetter hood and gutter pit."""
    c = C(16, 48)
    c.box(0, 0, 15, 10, DARK); c.r(2, 2, 13, 8, (40, 44, 56)); c.r(3, 4, 12, 4, RED)
    c.r(1, 11, 14, 44, (226, 186, 120)); c.r(0, 11, 0, 44, (60, 60, 70)); c.r(15, 11, 15, 44, (60, 60, 70))
    for i, (px, py) in enumerate(((8, 38), (5, 32), (11, 32), (3, 26), (8, 26), (13, 26), (2, 20), (6, 20), (10, 20), (14, 20))):
        c.oval(px - 1, py - 2, px + 1, py + 2, WHITE); c.r(px - 1, py - 1, px + 1, py - 1, RED)
    c.r(1, 45, 14, 45, SH)
    return c.done()


def bowling_return():
    """Ball return + scoring seats (2x1): glossy balls in blue, red and green on the return arch, a curved bench and a score monitor."""
    c = C(32, 32)
    c.block(1, 10, 30, 25, 6, (70, 76, 96), (46, 52, 70))
    for i, x in enumerate((5, 14, 23)): c.oval(x, 4, x + 6, 10, [BLUE, RED, GREEN][i]); c.p(x + 2, 5, WHITE)
    c.r(2, 17, 29, 17, ORANGE); c.r(2, 21, 29, 21, ORANGE_D)
    c.box(12, 0, 19, 3, BLACK); c.r(13, 1, 18, 2, (90, 230, 120))
    c.r(2, 28, 29, 28, SH)
    return c.done()


def speaker_stack():
    """PA speaker stack (1x1): black cabinet with a big cone and a horn tweeter, rubber corners."""
    c = C(16, 32)
    c.block(1, 1, 14, 29, 3, (70, 72, 82), (40, 42, 50))
    c.oval(3, 9, 12, 18, BLACK); c.oval(5, 11, 10, 16, DARK_M); c.p(7, 13, SILV if False else STEEL_L)
    c.r(4, 4, 11, 6, BLACK); c.oval(4, 21, 11, 27, BLACK); c.oval(6, 23, 9, 25, DARK_M)
    return c.done()


def mixing_desk():
    """Sound mixing desk (2x1): sloped black console with fader rows, knob strips and a glowing meter bridge."""
    c = C(32, 32)
    c.block(1, 8, 30, 25, 12, (60, 62, 76), (42, 44, 56))
    for x in range(4, 28, 3): c.r(x, 15, x, 21, STEEL_L); c.r(x - 1, 17 + (x % 4), x + 1, 18 + (x % 4), RED if x % 9 == 0 else WHITE)
    for x in range(4, 28, 3): c.p(x, 11, [RED, YELLOW, GREEN_L][x % 3]); c.p(x, 13, STEEL_L)
    c.box(3, 2, 28, 7, BLACK)
    for x in range(5, 27, 2): c.r(x, 4, x, 5 - (x % 3 == 0), (90, 230, 120))
    c.r(2, 27, 29, 27, SH)
    return c.done()


def pool_table():
    """Billiard table (3x2): green felt with rack triangle of coloured balls, white cue ball, dark wood rails and a cue leaning on one side."""
    c = C(48, 48)
    c.block(1, 6, 46, 44, 30, (46, 130, 92), WOOD_DD)
    c.box(1, 6, 46, 40, WOOD_D); c.r(4, 9, 43, 36, (46, 150, 100)); c.r(4, 9, 43, 9, (70, 176, 122))
    for x, y in ((2, 7), (45, 7), (2, 39), (45, 39), (23, 7), (23, 39)): c.oval(x - 1, y - 1, x + 2, y + 2, BLACK)
    for i, (bx, by, col) in enumerate(((30, 20, RED), (32, 18, YELLOW), (32, 23, BLUE), (34, 16, GREEN), (34, 21, ORANGE), (34, 26, PURPLE))):
        c.oval(bx, by, bx + 2, by + 2, col)
    c.oval(10, 21, 12, 23, WHITE); c.l(6, 24, 1, 27, WOOD_L)
    c.r(3, 41, 44, 43, (86, 56, 30)); c.r(2, 45, 45, 45, SH)
    return c.done()


# ------------------------------------------------------------------ housing
def futon_set():
    """Futon (flat, 2x2): laid-out Japanese bedding - blue shikibuton, white duvet folded back, buckwheat pillow, seen from above."""
    c = C(32, 32)
    c.box(1, 1, 30, 30, (96, 130, 196)); c.r(2, 2, 29, 29, (120, 156, 214))
    c.box(4, 3, 14, 9, (240, 224, 190)); c.r(5, 4, 13, 5, WHITE)
    c.r(4, 11, 27, 28, WHITE); c.r(4, 11, 27, 13, (190, 220, 240)); c.r(4, 28, 27, 28, WHITE_D)
    for x in (10, 18, 26): c.l(x, 14, x, 27, WHITE_D)
    return c.done()


def tatami_h():
    """Two tatami mats (flat, 4x2 tiles): woven rush surface, dark green cloth edging, the mats side by side."""
    c = C(64, 32)
    for x0 in (0, 32):
        c.r(x0, 0, x0 + 31, 31, (190, 196, 130))
        for y in range(2, 30, 2): c.r(x0 + 1, y, x0 + 30, y, (176, 184, 112))
        c.r(x0, 0, x0 + 31, 1, (60, 90, 60)); c.r(x0, 30, x0 + 31, 31, (60, 90, 60)); c.r(x0, 0, x0, 31, (60, 90, 60)); c.r(x0 + 31, 0, x0 + 31, 31, (60, 90, 60))
    return c.done()


def tatami_v():
    """Two tatami mats (flat, 2x4 tiles): mats stacked front to back."""
    c = C(32, 64)
    for y0 in (0, 32):
        c.r(0, y0, 31, y0 + 31, (190, 196, 130))
        for x in range(2, 30, 2): c.r(x, y0 + 1, x, y0 + 30, (176, 184, 112))
        c.r(0, y0, 31, y0, (60, 90, 60)); c.r(0, y0 + 31, 31, y0 + 31, (60, 90, 60)); c.r(0, y0, 1, y0 + 31, (60, 90, 60)); c.r(30, y0, 31, y0 + 31, (60, 90, 60))
    return c.done()


def chabudai():
    """Chabudai low round dining table (2x2, floor): lacquered top with a teapot, cups and rice-cracker tray."""
    c = C(32, 32)
    c.oval(2, 4, 29, 27, WOOD_DD); c.oval(4, 5, 27, 24, (190, 80, 70)); c.oval(6, 7, 25, 21, (206, 98, 84))
    c.box(12, 11, 18, 17, STEEL_D); c.r(13, 12, 17, 13, STEEL_L); c.r(18, 13, 20, 15, STEEL_D)
    for x, y in ((7, 10), (22, 10), (8, 17), (21, 18)): c.oval(x, y, x + 3, y + 2, WHITE)
    c.r(3, 28, 28, 28, SH)
    return c.done()


# ------------------------------------------------------------------ public services
def service_window():
    """City-hall service counter (4x1): long counter with glass partitions, numbered window plates and a ticket light bar above each clerk."""
    c = C(64, 48)
    c.block(0, 18, 63, 43, 4, (210, 214, 224), (150, 160, 180))
    for i, x in enumerate((1, 17, 33, 49)):
        c.box(x, 0, x + 12, 15, (200, 232, 244)); c.r(x + 2, 2, x + 10, 12, (226, 244, 250)); c.l(x + 3, 11, x + 9, 4, WHITE)
        c.box(x + 4, 19, x + 8, 23, (40, 90, 170)); c.r(x + 5, 20, x + 7, 22, WHITE)
        c.r(x + 1, 26, x + 11, 27, STEEL_L); c.box(x + 2, 29, x + 7, 33, DARK); c.r(x + 3, 30, x + 6, 32, SCREEN)
    c.r(1, 44, 62, 44, SH)
    return c.done()


def ticket_dispenser():
    """Queue ticket dispenser (1x1): kiosk with a tear-off number slip, big button and a red 'now serving' display."""
    c = C(16, 32)
    c.block(2, 2, 13, 29, 3, (240, 244, 250), (150, 170, 200))
    c.box(4, 6, 11, 11, BLACK); c.r(5, 7, 10, 10, RED_D); c.r(6, 8, 9, 9, RED_L)
    c.oval(5, 15, 10, 20, GREEN); c.r(4, 23, 11, 24, BLACK); c.r(6, 25, 9, 27, WHITE)
    return c.done()


def atm_unit():
    """ATM (1x1): blue-and-white wall unit with card slot, number pad, screen and cash dispenser slot."""
    c = C(16, 32)
    c.block(1, 2, 14, 29, 3, (90, 150, 220), (50, 100, 170))
    c.box(3, 6, 12, 14, BLACK); c.r(4, 7, 11, 13, SCREEN); c.r(5, 8, 10, 8, WHITE)
    for y in (17, 19): c.r(4, y, 11, y, WHITE_D)
    c.r(4, 22, 11, 23, BLACK); c.r(5, 26, 10, 27, YELLOW_D)
    return c.done()


def fire_truck():
    """Fire engine, top 3/4 view (4x3, parked facing south): red cab with a light bar, white-striped body, extended ladder on the roof, hose reels and side lockers."""
    c = C(64, 64)
    c.box(2, 22, 61, 58, RED); c.r(3, 23, 60, 36, lt(RED, 1.1)); c.r(3, 36, 60, 38, WHITE); c.r(3, 52, 60, 57, RED_D)
    c.box(4, 40, 59, 53, RED_D); c.r(8, 42, 55, 50, (220, 70, 70))
    c.box(4, 4, 59, 24, (90, 96, 108)); c.r(6, 6, 57, 12, (180, 220, 240)); c.r(6, 14, 57, 22, RED)
    c.r(8, 3, 55, 5, YELLOW); c.r(14, 3, 16, 5, RED); c.r(46, 3, 48, 5, BLUE_L)
    c.box(8, 26, 24, 34, STEEL_L); c.box(40, 26, 56, 34, STEEL_L)
    for x in range(10, 24, 3): c.r(x, 27, x, 33, STEEL_D)
    for x in range(42, 56, 3): c.r(x, 27, x, 33, STEEL_D)
    c.l(9, 30, 55, 30, STEEL); c.l(9, 36, 55, 36, STEEL_D)
    c.oval(26, 28, 38, 34, ORANGE_D); c.oval(29, 29, 35, 33, ORANGE)
    for x in (6, 52): c.oval(x, 54, x + 7, 61, BLACK); c.oval(x + 2, 56, x + 5, 59, STEEL_D)
    c.r(3, 62, 60, 62, SH)
    return c.done()


def fire_locker():
    """Turnout-gear lockers (2x1): tall grey cabinets with hanging orange-yellow coats, helmets and boots in view."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 2, (170, 176, 188), (130, 138, 154), shadow=False)
    c.r(2, 10, 14, 44, (60, 64, 76)); c.r(17, 10, 29, 44, (60, 64, 76))
    for x in (2, 17):
        c.r(x + 1, 14, x + 12, 34, (240, 170, 50)); c.r(x + 1, 22, x + 12, 23, (220, 230, 120)); c.r(x + 1, 28, x + 12, 29, (220, 230, 120))
        c.oval(x + 3, 10, x + 10, 15, YELLOW_D); c.r(x + 4, 36, x + 11, 43, BLACK)
    c.r(15, 10, 16, 44, STEEL_D)
    c.r(1, 45, 30, 45, SH)
    return c.done()


def vault_door():
    """Bank vault door (2x1, wall): round steel door with spoked wheel, bolts and a time-lock dial inside a thick frame."""
    c = C(32, 48)
    c.block(0, 8, 31, 46, 2, STEEL_D, STEEL, shadow=False)
    c.oval(3, 12, 28, 40, STEEL_D); c.oval(5, 14, 26, 38, STEEL); c.oval(8, 17, 23, 35, STEEL_L)
    c.oval(12, 21, 19, 30, STEEL_D); c.oval(14, 23, 17, 28, GOLD)
    for a in range(8):
        import math
        c.l(15 + int(6 * math.cos(a * 0.785)), 25 + int(6 * math.sin(a * 0.785)), 15 + int(12 * math.cos(a * 0.785)), 25 + int(12 * math.sin(a * 0.785)), STEEL_D)
    for y in (16, 33): c.r(3, y, 5, y + 2, GOLD_D); c.r(26, y, 28, y + 2, GOLD_D)
    c.r(1, 45, 30, 45, SH)
    return c.done()


def mail_sort_table():
    """Post-office sorting table (3x1): grey table with stacks of letters, a parcel scale, labelled pigeonhole rack and a red mailbag."""
    c = C(48, 32)
    c.block(0, 10, 47, 27, 5, (214, 218, 224), (150, 158, 172))
    c.box(2, 1, 22, 9, WOOD)
    for i in range(3):
        for j in range(2): c.r(4 + i * 6, 3 + j * 3, 8 + i * 6, 4 + j * 3, WHITE)
    c.box(28, 4, 38, 10, STEEL_L); c.r(30, 5, 36, 7, (200, 230, 200))
    c.box(40, 2, 46, 9, RED); c.r(41, 3, 45, 4, RED_L)
    for x in (6, 14, 26): c.r(x, 13, x + 6, 16, [WHITE, CREAM, BLUE_L][x % 3]); c.r(x, 13, x + 6, 13, WHITE_D)
    c.r(2, 29, 45, 29, SH)
    return c.done()
