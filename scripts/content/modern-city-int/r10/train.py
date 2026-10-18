# R10 commuter-train car and station interior (3/4 top view), modelled on Tokyo/Seoul commuter EMUs:
# 7-seat moquette long seats with seat dividers, priority seats, window + roll blind band, route strips and ad
# frames on the wall, dual LCD above the doors, ceiling hanging ads / AC louvers, end-of-car extinguisher,
# emergency cock box and wheelchair space, stainless door sills with yellow edge strips, cab windshield + desk.
from lib import *

MOQ_G = ((92, 170, 110), (60, 140, 84), (40, 104, 62))
MOQ_B = ((110, 150, 220), (64, 104, 180), (40, 70, 130))
MOQ_P = ((246, 160, 190), (220, 110, 150), (170, 70, 110))
MOQ_O = ((250, 180, 90), (230, 130, 50), (180, 90, 30))
SEAT_LO = (36, 40, 52)


def _sode(c, x0, y0, y1, flip=False):
    """Sode-shikiri end partition: rounded stainless panel with a frosted inset and a grab-pole curl on top."""
    c.rbox(x0, y0, x0 + 4, y1, STEEL)
    c.r(x0 + 1, y0 + 2, x0 + 3, y1 - 2, (196, 212, 222)); c.r(x0 + 1, y0 + 1, x0 + 3, y0 + 1, STEEL_L)
    c.r(x0 + 3 if not flip else x0 + 1, y0 + 2, x0 + 3 if not flip else x0 + 1, y1 - 2, STEEL_D)
    c.p(x0 + 2, y0 + 4, WHITE); c.p(x0 + 2, y0 + 5, GLASS_L)


def _seat_bounds(W, seats):
    step = (W - 10) / seats
    return [(int(5 + k * step), int(5 + (k + 1) * step) - 1) for k in range(seats)]


def seat_s(moq, w_tiles, seats):
    """Long seat against the NORTH wall facing south (toward the camera): stainless backrest frame on the wall,
    one plump moquette back + cushion per seat (each its own rounded pillow, so the 7-seat division reads), sode-
    shikiri partitions at both ends, a mid stanchion pole, dark kick plate with heater grille."""
    L, M, D = moq
    W = w_tiles * 16
    c = C(W, 32)
    c.box(2, 2, W - 3, 6, STEEL_D); c.r(3, 3, W - 4, 3, STEEL_L)                     # backrest frame on the wall
    for x0, x1 in _seat_bounds(W, seats):
        c.cushion(x0, 5, x1, 13, L, M, D)                                             # padded back
        c.r(x0 + 2, 8, x1 - 2, 8, dk(M, 0.9))                                         # stitch line
        c.cushion(x0, 13, x1, 22, lt(L, 1.05), L, D)                                  # seat cushion (lit top)
        c.r(x0 + 1, 14, x1 - 1, 14, dk(D, 0.85)); c.r(x0 + 2, 15, x1 - 2, 15, lt(L, 1.15))
    c.box(2, 22, W - 3, 28, SEAT_LO); c.r(3, 23, W - 4, 23, STEEL_D)                  # kick plate
    for x in range(6, W - 6, 3): c.p(x, 25, (70, 76, 90)); c.p(x, 26, (70, 76, 90))   # heater grille
    if seats >= 7: c.r(W // 2 - 1, 0, W // 2, 22, STEEL_L); c.p(W // 2 - 1, 0, WHITE); c.r(W // 2, 1, W // 2, 22, STEEL_D)
    _sode(c, 0, 1, 28); _sode(c, W - 5, 1, 28, True)
    c.r(1, 29, W - 1, 29, SH)
    return c.done()


def seat_n(moq, w_tiles, seats):
    """Long seat on the SOUTH side facing north: the cushions are on the far side, each seat back faces the camera
    as its own rounded pillow, window-sill rail and stainless backrest frame at the bottom edge."""
    L, M, D = moq
    W = w_tiles * 16
    c = C(W, 32)
    for x0, x1 in _seat_bounds(W, seats):
        c.cushion(x0, 7, x1, 16, lt(L, 1.05), L, D)                                   # seat cushion (far side)
        c.r(x0 + 2, 8, x1 - 2, 8, lt(L, 1.2))
        c.cushion(x0, 15, x1, 26, L, M, D)                                            # back seen from the aisle
        c.r(x0 + 1, 16, x1 - 1, 16, dk(D, 0.85)); c.r(x0 + 2, 20, x1 - 2, 20, dk(M, 0.9))
    c.box(2, 25, W - 3, 28, STEEL_D); c.r(3, 26, W - 4, 26, STEEL_L)                  # backrest frame / sill rail
    if seats >= 7: c.r(W // 2 - 1, 4, W // 2, 26, STEEL_L); c.p(W // 2 - 1, 4, WHITE); c.r(W // 2, 5, W // 2, 26, STEEL_D)
    _sode(c, 0, 3, 29); _sode(c, W - 5, 3, 29, True)
    c.r(1, 30, W - 1, 30, SH)
    return c.done()


def seat7_green_s(): return seat_s(MOQ_G, 4, 7)
def seat7_green_n(): return seat_n(MOQ_G, 4, 7)
def seat7_blue_s(): return seat_s(MOQ_B, 4, 7)
def seat7_blue_n(): return seat_n(MOQ_B, 4, 7)
def priority_pink_s():
    im = seat_s(MOQ_P, 2, 3); c = C(32, 32); c.im.alpha_composite(im); c.box(12, 0, 19, 5, WHITE); c.r(14, 1, 17, 3, (230, 120, 40)); return c.done()
def priority_orange_n():
    im = seat_n(MOQ_O, 2, 3); c = C(32, 32); c.im.alpha_composite(im); c.box(12, 0, 19, 5, WHITE); c.r(14, 1, 17, 3, (220, 90, 140)); return c.done()


# ------------------------------------------------------------------ wall band
def window_blind():
    """Car side window: silver frame, roll blind pulled half down, city and sky in the lower pane, ad frame above."""
    c = C(32, 32)
    c.box(1, 0, 30, 6, (236, 232, 224)); c.r(3, 1, 13, 5, (240, 140, 70)); c.r(16, 1, 28, 5, (90, 160, 220)); c.r(4, 2, 12, 2, WHITE)
    c.box(0, 8, 31, 29, STEEL)
    c.r(2, 10, 29, 27, (150, 200, 236))
    c.r(2, 20, 29, 27, (120, 150, 180))
    for x, h in ((3, 4), (8, 6), (13, 3), (18, 5), (24, 7)): c.r(x, 27 - h, x + 4, 27, (90, 110, 140)); c.p(x + 1, 25 - h + 2, YELLOW)
    c.r(2, 10, 29, 16, (232, 226, 206)); c.r(2, 16, 29, 17, (196, 186, 160)); c.r(14, 17, 17, 18, (180, 170, 150))   # blind
    c.r(15, 9, 16, 28, STEEL_D)
    c.r(1, 30, 30, 31, STEEL_D)
    return c.done()
def window_tunnel():
    """Car side window in a tunnel: dark glass with reflected ceiling lights, blind up, small sticker."""
    c = C(32, 32)
    c.box(1, 0, 30, 6, (236, 232, 224)); c.r(3, 1, 28, 5, (240, 220, 120)); c.r(5, 3, 26, 3, RED)
    c.box(0, 8, 31, 29, STEEL)
    c.r(2, 10, 29, 27, (36, 42, 56))
    for x in range(4, 29, 8): c.r(x, 13, x + 4, 13, (120, 130, 150))
    c.l(3, 26, 12, 17, (70, 80, 100)); c.l(18, 26, 27, 17, (70, 80, 100))
    c.r(2, 10, 29, 11, (232, 226, 206))
    c.r(15, 9, 16, 28, STEEL_D); c.box(4, 22, 7, 25, (240, 140, 60))
    c.r(1, 30, 30, 31, STEEL_D)
    return c.done()
def route_strip():
    """Line route strip above the door/window band: white board with a coloured line and station dots, current
    stop marked red."""
    c = C(32, 32)
    c.box(0, 6, 31, 18, WHITE); c.r(1, 7, 30, 8, (60, 160, 90))
    c.r(2, 12, 29, 13, (60, 160, 90))
    for x in range(3, 30, 4): c.box(x - 1, 11, x + 1, 14, WHITE)
    c.box(14, 10, 17, 15, RED)
    c.r(2, 16, 29, 16, WHITE_D)
    c.box(2, 20, 13, 30, (60, 130, 200)); c.r(3, 21, 12, 22, WHITE)                  # door-side line diagram sticker
    c.box(18, 20, 29, 30, (250, 220, 90)); c.r(19, 21, 28, 22, RED)                   # ad card
    return c.done()
def lcd_dual():
    """Dual LCD passenger display above a door: next-stop panel (left) and ad panel (right) in a black bezel."""
    c = C(32, 32)
    c.box(0, 4, 31, 16, BLACK)
    c.r(2, 6, 14, 14, (20, 40, 80)); c.r(3, 7, 13, 8, (250, 160, 40)); c.r(3, 10, 11, 11, WHITE); c.r(3, 13, 7, 13, (90, 200, 120))
    c.r(17, 6, 29, 14, (60, 140, 200)); c.r(18, 7, 24, 9, (250, 230, 120)); c.r(22, 11, 28, 13, PINK)
    c.r(15, 6, 16, 14, (60, 64, 76))
    c.box(1, 18, 30, 30, STEEL); c.r(2, 19, 29, 19, STEEL_L)                          # door header
    c.r(4, 22, 27, 27, (150, 200, 236)); c.r(15, 20, 16, 30, OL)                     # door glass tops
    c.r(1, 31, 30, 31, (240, 200, 60))
    return c.done()
def door_steel():
    """Double sliding car door (north wall): stainless leaves with tall windows, black rubber seal, yellow edge
    stickers on the leading edges."""
    c = C(32, 32)
    c.box(0, 0, 31, 31, STEEL_D)
    c.r(1, 1, 14, 31, STEEL); c.r(17, 1, 30, 31, STEEL); c.r(15, 1, 16, 31, OL)
    c.r(1, 1, 30, 1, STEEL_L)
    c.glass(3, 4, 12, 22, (150, 200, 236)); c.glass(19, 4, 28, 22, (150, 200, 236))
    c.r(13, 4, 14, 30, (240, 200, 60)); c.r(17, 4, 18, 30, (240, 200, 60))
    c.r(5, 25, 10, 26, (240, 140, 60)); c.r(21, 25, 26, 26, (240, 140, 60))           # "watch fingers" stickers
    return c.done()
def luggage_rack():
    """Overhead luggage rack above seats: chrome rack band with a bag and paper on it, ad frames beneath."""
    c = C(32, 32)
    c.box(0, 2, 31, 9, STEEL_D); c.r(1, 3, 30, 4, STEEL_L)
    for x in range(2, 30, 3): c.p(x, 6, STEEL_L); c.p(x + 1, 7, STEEL)
    c.box(5, 0, 12, 5, (60, 90, 140)); c.box(20, 1, 27, 4, WHITE)
    for x, col in ((1, (240, 200, 60)), (11, (220, 80, 110)), (21, (90, 170, 120))):
        c.box(x, 12, x + 9, 26, WHITE); c.r(x + 1, 13, x + 8, 18, col); c.r(x + 2, 21, x + 7, 21, OL); c.r(x + 2, 23, x + 5, 23, OL)
    return c.done()
def extinguisher():
    """End-of-car fire extinguisher in a recessed red-lettered box."""
    c = C(16, 32)
    c.block(1, 2, 14, 29, 2, STEEL_L, (230, 230, 226))
    c.box(3, 6, 12, 26, (240, 240, 236)); c.r(4, 7, 11, 9, RED)
    c.box(5, 11, 10, 24, RED); c.r(6, 12, 7, 23, RED_L); c.box(6, 9, 9, 11, BLACK); c.l(9, 10, 12, 13, BLACK)
    return c.done()
def emergency_cock():
    """Emergency door-cock box (hang): small steel box with a red handle and yellow-black warning stripe."""
    c = C(16, 32)
    c.box(2, 10, 13, 26, STEEL); c.r(3, 11, 12, 11, STEEL_L)
    for x in range(3, 13, 2): c.p(x, 13, YELLOW); c.p(x + 1, 13, BLACK)
    c.box(5, 16, 10, 22, RED); c.r(6, 17, 9, 17, RED_L)
    c.box(3, 2, 12, 7, (220, 50, 50)); c.r(5, 4, 10, 4, WHITE)
    return c.done()
def sos_intercom():
    """Passenger SOS intercom (hang): steel plate with speaker grille and red call button."""
    c = C(16, 32)
    c.box(3, 8, 12, 26, STEEL); c.r(4, 9, 11, 9, STEEL_L)
    for y in range(11, 16, 2): c.r(5, y, 10, y, STEEL_D)
    c.oval(5, 18, 10, 23, RED); c.p(6, 19, RED_L)
    c.box(2, 2, 13, 6, (250, 220, 60)); c.r(4, 4, 11, 4, RED)
    return c.done()
def wheelchair_space():
    """Wheelchair space at the car end: fold-up flip seats against the wall, horizontal grab bar, blue wheelchair
    pictogram and a seat-belt hook."""
    c = C(32, 32)
    c.box(0, 4, 31, 22, (230, 230, 224)); c.r(1, 5, 30, 6, WHITE)
    c.box(2, 8, 13, 18, MOQ_B[1]); c.r(3, 9, 12, 9, MOQ_B[0]); c.r(3, 17, 12, 17, MOQ_B[2])   # folded seat
    c.box(18, 7, 29, 18, (60, 110, 200)); c.oval(21, 9, 25, 13, WHITE); c.r(22, 13, 27, 16, WHITE); c.oval(20, 13, 25, 18, (60, 110, 200))
    c.eo(20, 12, 25, 17, WHITE)
    c.r(0, 20, 31, 21, STEEL_L); c.r(0, 22, 31, 22, STEEL_D)                                  # grab bar
    c.r(1, 23, 30, 28, (196, 196, 190)); c.r(1, 29, 31, 29, SH)
    return c.done()


# ------------------------------------------------------------------ ceiling / floor overlays
def hanging_ad():
    """Ceiling-hung poster (중조 광고): two-sided card clipped to the ceiling rail, drawn above riders (passable)."""
    c = C(32, 32)
    c.r(0, 1, 31, 1, STEEL_D)
    c.l(4, 2, 4, 5, STEEL); c.l(27, 2, 27, 5, STEEL)
    c.box(1, 5, 30, 16, WHITE); c.r(2, 6, 29, 9, (240, 120, 40)); c.r(3, 11, 20, 12, OL); c.r(3, 14, 14, 14, (60, 120, 200)); c.box(22, 10, 28, 15, (250, 220, 60))
    c.r(2, 16, 29, 16, WHITE_D)
    return c.done()
def ceiling_ac():
    """Ceiling AC louver strip with a line-flow diffuser and fluorescent light either side (passable)."""
    c = C(32, 32)
    c.r(0, 1, 31, 2, (250, 250, 240)); c.r(0, 3, 31, 3, (220, 220, 210))
    c.box(2, 5, 29, 11, (210, 214, 220))
    for x in range(4, 28, 2): c.l(x, 6, x, 10, (150, 156, 168))
    c.r(0, 13, 31, 14, (250, 250, 240))
    return c.done()
def door_sill():
    """Door threshold seen from above: stainless sill grooves and a dotted yellow warning strip inside (flat, 2 wide)."""
    c = C(32, 16)
    c.r(0, 0, 31, 4, STEEL); c.r(0, 0, 31, 0, STEEL_L)
    for x in range(1, 31, 3): c.p(x, 2, STEEL_D)
    c.r(0, 5, 31, 5, STEEL_D)
    c.r(0, 6, 31, 11, YELLOW_D); c.r(1, 7, 30, 10, YELLOW)
    for x in range(3, 30, 4): c.p(x, 8, YELLOW_D); c.p(x + 2, 9, YELLOW_D)
    return c.done()
def stanchion():
    """Stainless floor-to-ceiling stanchion with a round base plate and a grab knot at hand height."""
    c = C(16, 32)
    c.r(7, 0, 8, 26, STEEL_D); c.r(7, 0, 7, 26, STEEL_L)
    c.r(6, 13, 9, 14, (60, 120, 200))
    c.oval(3, 25, 12, 30, STEEL_D); c.r(5, 26, 10, 27, STEEL_L)
    return c.done()


# ------------------------------------------------------------------ cab
def cab_window():
    """Cab front windshield on the north wall: wiper-swept glass showing the rails converging into a tunnel mouth,
    signal lamp, destination roll sign above."""
    c = C(48, 32)
    c.box(0, 0, 47, 31, DARK)
    c.r(2, 1, 45, 4, BLACK); c.r(16, 2, 31, 3, (250, 160, 40))
    c.r(2, 6, 45, 29, (120, 160, 200))
    c.r(2, 6, 45, 14, (170, 210, 240)); c.r(2, 15, 45, 29, (90, 100, 110))
    c.oval(16, 9, 31, 22, (30, 30, 36))
    c.l(5, 29, 22, 16, STEEL_L); c.l(42, 29, 25, 16, STEEL_L)                        # rails converge
    for y in range(18, 29, 3): c.l(24 - (y - 16), y, 23 + (y - 16), y, (120, 96, 70))
    c.oval(36, 9, 39, 12, (60, 220, 120))
    c.l(8, 28, 20, 10, (60, 64, 76))                                                  # wiper
    c.r(23, 5, 24, 30, DARK)
    return c.done()
def cab_desk():
    """Driver's desk facing north to the windshield: slanted black console with speed / pressure gauges, master
    controller T-handle, ATS monitor and a timetable holder."""
    c = C(48, 32)
    c.box(0, 2, 47, 16, DARK); c.r(1, 3, 46, 15, DARK_M)
    for x in (4, 13):
        c.oval(x, 4, x + 7, 11, WHITE); c.oval(x + 2, 6, x + 5, 9, (40, 44, 52)); c.l(x + 3, 8, x + 6, 6, RED)
    c.box(23, 4, 33, 12, BLACK); c.r(24, 5, 32, 11, (40, 160, 200)); c.r(25, 6, 29, 7, (250, 230, 120))
    c.box(36, 4, 45, 12, (230, 226, 210)); c.r(37, 6, 44, 6, OL); c.r(37, 8, 42, 8, OL)
    c.block(0, 14, 47, 29, 3, (70, 74, 86), (52, 56, 66))
    c.box(6, 15, 16, 19, OL); c.r(7, 16, 15, 18, STEEL); c.r(10, 12, 12, 16, STEEL_D)
    for i, x in enumerate((22, 26, 30)): c.oval(x, 17, x + 2, 19, [RED, (80, 200, 100), YELLOW][i])
    c.r(2, 23, 45, 23, BLACK)
    return c.done()


# ------------------------------------------------------------------ station
def station_sign():
    """Hanging platform station-name board (hang): white sign with this-stop name bar, prev/next arrows and line
    colour band."""
    c = C(32, 32)
    c.l(6, 0, 6, 6, STEEL_D); c.l(25, 0, 25, 6, STEEL_D)
    c.box(0, 6, 31, 24, WHITE)
    c.r(1, 7, 30, 9, (60, 160, 90))
    c.r(9, 12, 22, 15, OL); c.r(11, 17, 20, 17, STEEL_D)
    for i in range(3): c.p(3 + i, 18 - i, OL); c.p(3 + i, 18 + i, OL)
    for i in range(3): c.p(28 - i, 18 - i, OL); c.p(28 - i, 18 + i, OL)
    c.r(1, 22, 30, 23, (60, 160, 90))
    return c.done()
def timetable():
    """Station timetable board (hang): framed grid of departure minutes, weekday/holiday colour heads."""
    c = C(16, 32)
    c.box(1, 4, 14, 28, WHITE); c.r(2, 5, 7, 7, BLUE); c.r(8, 5, 13, 7, RED)
    for y in range(9, 27, 3):
        c.r(2, y, 3, y, OL)
        for x in range(5, 13, 3): c.p(x, y, STEEL_D); c.p(x + 1, y, STEEL_D)
    return c.done()
def ic_charger():
    """IC card charge machine: green-faced kiosk with touch screen, card slot and coin/note slots."""
    c = C(16, 32)
    c.block(1, 2, 14, 29, 3, (150, 220, 160), (60, 160, 100))
    c.box(3, 7, 12, 15, DARK); c.r(4, 8, 11, 13, SCREEN); c.r(5, 9, 9, 9, WHITE)
    c.r(4, 18, 8, 18, OL); c.r(10, 18, 11, 20, OL); c.r(4, 22, 11, 23, (40, 60, 50))
    return c.done()
def coin_lockers():
    """Coin lockers: 2-wide bank of numbered steel lockers with key slots, one taller suitcase bay."""
    c = C(32, 32)
    c.block(0, 0, 31, 30, 2, STEEL_L, (120, 140, 200))
    for x in range(1, 30, 6):
        for y in (4, 11):
            c.box(x, y, x + 5, y + 6, (150, 170, 220)); c.p(x + 4, y + 3, GOLD); c.r(x + 1, y + 1, x + 2, y + 1, WHITE)
    for x in (1, 16): c.box(x, 18, x + 14, 27, (150, 170, 220)); c.p(x + 12, 22, GOLD)
    return c.done()
def platform_edge():
    """Platform edge strip (flat, 2 wide): yellow tactile dot line with the white edge band beyond."""
    c = C(32, 16)
    c.r(0, 0, 31, 5, (232, 232, 226)); c.r(0, 5, 31, 5, STEEL_D)
    c.r(0, 6, 31, 15, YELLOW)
    for x in range(2, 32, 4):
        for y in (8, 12): c.p(x, y, YELLOW_D); c.p(x + 1, y, YELLOW_D)
    return c.done()
