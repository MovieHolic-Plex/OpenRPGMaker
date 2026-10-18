# R10b general-hospital (50x50, 3 floors) and elevator-cabin props (3/4 top view).
# 2026-10-18 user: 「침대가 세로형만 있네. 가로형은 왜 없는거지」「수술실도 엉망」「엘리베이터 내부 이런 것도」.
# Same harness as lib.py: lighter top band over a darker front face, 1px ink outline, 1px floor shadow.
from lib import *

MINT, MINT_D, MINT_L = (150, 214, 190), (100, 170, 148), (196, 236, 220)
SURG, SURG_D = (70, 150, 150), (44, 108, 110)
ECG = (90, 230, 120)
LED = (255, 80, 60)


# ------------------------------------------------------------------ beds
def hosp_bed_e():
    """Horizontal ward bed, head against the west, feet to the east: tall rounded headboard with a chrome top rail,
    plump pillow, white sheet folded back over a quilted mint blanket, half-length side rail, footboard with a
    chart clip, IV pole at the head and locking castors."""
    c = C(32, 32)
    c.r(1, 0, 1, 10, STEEL); c.r(0, 0, 3, 0, STEEL_D); c.box(2, 1, 5, 4, (210, 236, 246)); c.p(3, 2, WHITE)  # IV pole + bag
    c.rbox(0, 7, 5, 28, (176, 184, 196)); c.r(1, 8, 4, 8, STEEL_L); c.r(4, 9, 4, 27, STEEL_D)               # headboard
    c.r(1, 12, 3, 12, (140, 148, 162)); c.r(1, 20, 3, 20, (140, 148, 162))
    c.rbox(4, 11, 29, 25, WHITE)                                                                           # mattress top
    c.cushion(6, 12, 12, 19, WHITE, (236, 240, 244), WHITE_D)                                                # pillow
    c.p(9, 15, WHITE_D)
    c.r(13, 12, 28, 21, MINT); c.r(13, 12, 28, 12, MINT_L); c.r(28, 13, 28, 21, MINT_D)                   # blanket
    for x in range(16, 28, 4): c.r(x, 14, x, 20, MINT_D); c.p(x - 1, 13, MINT_L)                            # quilting
    c.r(13, 12, 16, 21, WHITE); c.r(17, 12, 17, 21, WHITE_D); c.r(13, 21, 17, 21, WHITE_D)                # folded sheet
    c.r(5, 21, 28, 22, MINT_D); c.r(5, 23, 28, 24, STEEL_D)                                                # blanket drop + frame
    c.rbox(7, 20, 21, 24, (210, 216, 226)); c.r(8, 21, 20, 21, STEEL_L); c.r(8, 23, 20, 23, STEEL)          # side rail
    for x in (10, 14, 18): c.p(x, 22, STEEL_D)
    c.rbox(28, 10, 31, 26, (176, 184, 196)); c.r(29, 11, 30, 11, STEEL_L); c.box(28, 14, 31, 18, WHITE)    # footboard + chart
    c.r(6, 25, 28, 26, (82, 88, 100))
    for x in (6, 25): c.box(x, 26, x + 3, 29, BLACK); c.p(x + 1, 27, STEEL_D)
    c.r(4, 30, 30, 30, SH)
    return c.done()
def hosp_bed_w(): return mirror(hosp_bed_e())
def hosp_stretcher():
    """Emergency gurney (horizontal): thin pad with white sheet and folded blanket, chrome rails, tall legs on castors."""
    c = C(32, 32)
    c.block(1, 12, 30, 20, 5, WHITE, STEEL_L)
    c.r(2, 13, 7, 16, WHITE_D); c.r(20, 13, 28, 16, (150, 190, 230)); c.r(20, 13, 28, 13, BLUE_L)
    c.r(1, 19, 30, 19, STEEL_D)
    for x in (4, 26): c.r(x, 21, x, 27, STEEL_D)
    c.l(4, 24, 26, 24, STEEL)
    for x in (3, 25): c.r(x, 27, x + 2, 28, BLACK)
    c.r(2, 29, 29, 29, SH)
    return c.done()
def icu_pod():
    """ICU bed pod (2x2): vertical bed with raised head, ventilator tower and a monitor on a ceiling boom."""
    c = C(32, 48)
    c.box(17, 0, 30, 10, DARK); c.r(18, 1, 29, 9, (20, 30, 40)); c.l(18, 6, 21, 6, ECG); c.l(21, 6, 22, 2, ECG); c.l(22, 2, 23, 8, ECG); c.l(23, 8, 29, 6, ECG)
    c.r(23, 10, 24, 14, STEEL_D)
    c.box(1, 10, 15, 13, STEEL_D)
    c.block(1, 13, 15, 43, 22, WHITE, STEEL)
    c.box(3, 14, 13, 19, WHITE); c.oval(5, 15, 10, 19, SKIN)
    c.r(3, 20, 13, 34, (150, 190, 230)); c.r(3, 20, 13, 20, BLUE_L); c.r(3, 27, 13, 27, BLUE_L)
    c.r(0, 22, 0, 34, STEEL_L)
    c.block(18, 18, 30, 43, 4, WHITE, (200, 210, 220))
    c.box(20, 24, 28, 30, (30, 40, 50)); c.r(21, 26, 27, 26, SCREEN); c.p(22, 28, YELLOW)
    c.r(20, 33, 28, 34, STEEL_D); c.oval(21, 36, 27, 41, (170, 200, 220))
    c.l(14, 22, 20, 33, (150, 190, 220))
    c.r(1, 44, 30, 44, SH)
    return c.done()


# ------------------------------------------------------------------ ward / ICU kit
def iv_pump():
    """IV pole with a saline bag, infusion pump box with green readout, five-castor base."""
    c = C(16, 32)
    c.r(7, 1, 8, 27, STEEL); c.r(4, 1, 11, 1, STEEL_D)
    c.box(2, 2, 7, 10, (226, 240, 248)); c.r(3, 6, 6, 9, (190, 220, 240)); c.l(5, 11, 6, 17, (190, 220, 240))
    c.block(5, 14, 12, 21, 2, WHITE, WHITE_D); c.r(7, 17, 10, 18, (30, 60, 50)); c.p(8, 17, ECG); c.p(9, 18, ECG)
    c.l(3, 28, 12, 28, STEEL_D); c.p(2, 29, BLACK); c.p(13, 29, BLACK); c.p(7, 29, BLACK)
    c.r(3, 30, 12, 30, SH)
    return c.done()
def curtain_track():
    """Privacy curtain on a ceiling track (3 wide): pleated mint curtain hanging from a chrome rail, gap at the floor."""
    c = C(48, 32)
    c.r(0, 1, 47, 2, STEEL_L); c.r(0, 3, 47, 3, STEEL_D)
    c.box(1, 3, 46, 27, MINT)
    for x in range(4, 46, 4): c.l(x, 4, x, 26, MINT_D); c.l(x + 1, 4, x + 1, 26, MINT_L)
    c.r(2, 24, 45, 26, MINT_D)
    for x in (2, 45): c.r(x, 28, x, 29, STEEL_D)
    c.r(1, 30, 47, 30, SH)
    return c.done()
def crash_cart():
    """Red crash cart: drawer stack, defibrillator on top with paddles, handle bar."""
    c = C(16, 32)
    c.box(3, 4, 13, 11, (60, 64, 76)); c.r(4, 5, 9, 8, (30, 60, 50)); c.l(4, 7, 9, 6, ECG); c.box(10, 6, 12, 10, YELLOW)
    c.block(1, 11, 14, 29, 3, RED_L, RED)
    for y in (17, 21, 25): c.r(2, y, 13, y, RED_D); c.r(6, y - 2, 9, y - 2, STEEL_L)
    c.r(0, 13, 0, 18, STEEL_D)
    c.r(2, 30, 14, 30, SH)
    return c.done()


# ------------------------------------------------------------------ operating theatre
def op_table():
    """Horizontal operating table (3 wide): padded black table top under a teal surgical drape with fold creases,
    patient head under a blue cap behind the anaesthesia screen frame on the west, arm boards out to both sides,
    a lit instrument field on the drape, chrome rails and a hydraulic column on a wide base."""
    c = C(48, 32)
    c.rbox(2, 10, 45, 21, (40, 44, 54))                                                     # table top edge
    c.rbox(3, 10, 44, 19, SURG); c.r(4, 10, 43, 10, lt(SURG, 1.3))
    for x in range(14, 43, 6): c.l(x, 12, x + 3, 17, SURG_D)                                 # drape creases
    c.r(4, 18, 43, 19, SURG_D)
    c.r(4, 11, 10, 17, (110, 170, 220)); c.oval(4, 11, 10, 17, SKIN); c.r(4, 11, 10, 13, (90, 150, 220))   # head + cap
    c.p(6, 15, SKIN_D); c.r(11, 9, 11, 18, STEEL_L); c.r(11, 8, 12, 8, STEEL)               # ether screen frame
    c.rbox(17, 4, 23, 11, SURG); c.r(18, 5, 22, 5, lt(SURG, 1.3))                           # arm boards
    c.rbox(17, 18, 23, 24, SURG); c.r(18, 23, 22, 23, SURG_D)
    c.r(27, 12, 35, 15, (232, 244, 244)); c.r(27, 12, 35, 12, WHITE)                        # instrument field
    c.r(29, 13, 33, 13, STEEL_D); c.p(31, 14, RED_D)
    c.r(3, 20, 44, 20, STEEL_L); c.r(3, 21, 44, 21, STEEL_D)                                 # side rail
    c.rbox(21, 21, 27, 27, DARK_M); c.r(22, 22, 26, 22, STEEL); c.r(26, 22, 26, 26, DARK)   # column
    c.rbox(13, 26, 35, 30, STEEL); c.r(14, 27, 34, 27, STEEL_L); c.r(14, 29, 34, 29, STEEL_D)
    c.p(16, 28, ECG); c.p(18, 28, ORANGE)
    c.r(13, 31, 36, 31, SH)
    return c.done()
def surgical_lamp():
    """Overhead twin-dome surgical light seen from below the ceiling mount - drawn in the row above its footprint,
    walk-under: ceiling hub, two articulated spring arms with knuckle joints, and two deep LED domes with a ring
    of lit cells, a sterile centre handle and a soft light pool."""
    c = C(32, 32)
    c.oval(13, 0, 18, 3, STEEL_D); c.p(15, 1, STEEL_L)
    for (ax, ay), (bx, by) in (((14, 2), (8, 4)), ((17, 2), (23, 4))):
        c.l(ax, ay, bx, by, STEEL_L); c.l(ax, ay + 1, bx, by + 1, STEEL_D); c.oval(bx - 1, by - 1, bx + 1, by + 1, DARK_M)
    for cx in (7, 24):
        c.oval(cx - 7, 5, cx + 7, 15, (200, 206, 216)); c.r(cx - 5, 6, cx + 5, 6, WHITE)
        c.oval(cx - 5, 7, cx + 5, 13, (232, 234, 214))
        for dx, dy in ((-3, 9), (0, 8), (3, 9), (-3, 11), (3, 11), (0, 12)): c.p(cx + dx, dy, (255, 250, 190))
        c.oval(cx - 1, 9, cx + 1, 11, STEEL_D); c.p(cx, 10, (120, 200, 210))
        c.r(cx - 6, 14, cx + 6, 14, (150, 156, 168))
    return c.done()
def anesthesia_machine():
    """Anesthesia workstation: monitor on top, flow-meter tubes, black bellows, blue O2 / green N2O cylinders at the base."""
    c = C(16, 32)
    c.box(1, 0, 14, 8, DARK); c.r(2, 1, 13, 7, (20, 30, 40)); c.l(2, 4, 6, 4, ECG); c.l(6, 4, 7, 1, ECG); c.l(7, 1, 8, 6, ECG); c.l(8, 6, 13, 4, ECG)
    c.block(1, 9, 14, 29, 3, (220, 226, 232), (180, 188, 200))
    for x in (3, 5, 7): c.r(x, 13, x, 17, (150, 220, 240)); c.p(x, 15, WHITE)
    c.oval(9, 13, 13, 19, BLACK); c.r(10, 15, 12, 16, DARK_M)
    c.box(2, 21, 5, 28, BLUE); c.r(3, 22, 4, 22, BLUE_L); c.box(10, 21, 13, 28, GREEN); c.r(11, 22, 12, 22, GREEN_L)
    c.r(2, 30, 14, 30, SH)
    return c.done()
def vitals_bank():
    """Wall-mounted monitor bank above a steel shelf: two vitals screens (ECG, SpO2) and a gas-outlet strip."""
    c = C(32, 32)
    for x0 in (1, 17):
        c.box(x0, 1, x0 + 13, 12, DARK); c.r(x0 + 1, 2, x0 + 12, 11, (20, 30, 40))
        c.l(x0 + 1, 5, x0 + 4, 5, ECG); c.l(x0 + 4, 5, x0 + 5, 2, ECG); c.l(x0 + 5, 2, x0 + 6, 8, ECG); c.l(x0 + 6, 8, x0 + 12, 5, ECG)
        c.l(x0 + 1, 9, x0 + 12, 9, SCREEN); c.p(x0 + 11, 3, YELLOW)
    c.block(0, 15, 31, 29, 3, STEEL_L, STEEL)
    for x in (4, 10, 16, 22, 28): c.oval(x - 1, 21, x + 1, 23, GREEN if x % 3 == 1 else BLUE)
    c.r(1, 26, 30, 27, STEEL_D)
    return c.done()
def mayo_stand():
    """Mayo stand: tray on a single post draped in blue cloth with scalpels, forceps and gauze."""
    c = C(16, 32)
    c.block(0, 6, 15, 14, 5, (120, 170, 220), (80, 130, 190))
    c.l(2, 8, 6, 8, STEEL_L); c.l(2, 10, 7, 10, STEEL_L); c.l(9, 8, 13, 10, STEEL_L); c.box(9, 10, 12, 12, WHITE)
    c.r(7, 15, 8, 27, STEEL_D); c.r(3, 27, 12, 28, STEEL); c.p(3, 29, BLACK); c.p(12, 29, BLACK)
    c.r(3, 30, 13, 30, SH)
    return c.done()
def scrub_sink():
    """Surgical scrub trough (2 wide): long stainless basin, two knee-operated goose-neck taps, brush dispenser and timer."""
    c = C(32, 32)
    c.box(3, 1, 12, 8, WHITE)
    c.r(4, 2, 11, 3, (196, 226, 240)); c.r(4, 5, 11, 7, (196, 226, 240))
    c.box(20, 2, 28, 8, DARK); c.r(21, 3, 27, 7, (30, 20, 20)); c.p(22, 5, LED); c.p(24, 5, LED); c.p(26, 5, LED)
    c.block(0, 11, 31, 28, 7, STEEL_L, STEEL)
    c.r(3, 13, 28, 17, STEEL_D); c.r(4, 14, 27, 16, (150, 160, 175))
    for x in (9, 22): c.r(x, 9, x, 13, STEEL_D); c.l(x, 9, x + 2, 9, STEEL_D); c.box(x - 1, 22, x + 2, 26, STEEL_D)
    return c.done()


# ------------------------------------------------------------------ imaging
def ct_scanner():
    """CT scanner (3x2): white donut gantry on the west with a deep shaded bore (inner rim lit, far rim dark), blue
    ring light, status screen and side cowl; padded patient couch with a headrest slides out east on a pedestal."""
    c = C(48, 48)
    c.rbox(0, 3, 21, 45, (226, 230, 236)); c.r(1, 4, 20, 9, WHITE); c.r(20, 5, 20, 44, (180, 188, 200))   # gantry body
    c.r(1, 10, 20, 10, (196, 202, 212)); c.r(1, 40, 20, 44, (190, 196, 206))
    c.r(3, 5, 18, 6, BLUE_L); c.r(3, 6, 18, 6, BLUE)                                        # top light bar
    c.oval(2, 12, 19, 39, (176, 184, 198)); c.oval(3, 13, 18, 38, (110, 190, 240))           # bore ring
    c.oval(5, 15, 16, 36, (200, 210, 222)); c.oval(7, 17, 15, 34, (60, 66, 84))              # bore depth
    c.oval(9, 20, 15, 31, (30, 34, 48)); c.r(6, 24, 6, 28, WHITE); c.p(5, 22, GLASS_L)      # lit near rim
    c.box(14, 41, 19, 44, (30, 40, 50)); c.r(15, 42, 18, 42, ECG)
    c.rbox(9, 22, 46, 29, (196, 206, 220)); c.r(10, 22, 45, 22, WHITE)                       # couch
    c.cushion(12, 22, 44, 27, WHITE, (226, 232, 240), (176, 186, 200))
    c.r(20, 23, 31, 25, (150, 190, 230)); c.r(20, 23, 31, 23, BLUE_L)                        # cushion pad
    c.cushion(38, 22, 44, 27, (240, 244, 248), (214, 220, 230), (170, 180, 196))             # head rest
    c.rbox(27, 29, 40, 43, (176, 186, 200)); c.r(28, 30, 39, 31, (210, 216, 226)); c.r(39, 31, 39, 42, (140, 148, 164))
    c.r(28, 41, 39, 42, (140, 148, 164)); c.p(30, 35, ECG)
    c.r(1, 46, 46, 46, SH)
    return c.done()
def xray_table():
    """Radiography table (3 wide) with the X-ray tube on a ceiling column over it and a bucky tray under the top."""
    c = C(48, 32)
    c.r(36, 0, 39, 9, STEEL); c.box(26, 5, 40, 11, (220, 226, 232)); c.r(27, 6, 39, 7, WHITE); c.box(30, 11, 36, 14, DARK_M)
    c.block(2, 13, 45, 27, 6, (210, 222, 232), (150, 160, 178))
    c.r(5, 15, 42, 17, (240, 244, 248)); c.r(14, 22, 34, 24, DARK_M)
    c.r(3, 29, 45, 29, SH)
    return c.done()
def xray_console():
    """Radiography control console behind a lead-glass window: exposure panel with dials and a hand switch."""
    c = C(32, 32)
    c.box(0, 0, 31, 12, STEEL_D); c.glass(1, 1, 30, 11, (150, 196, 200))
    c.block(0, 13, 31, 29, 5, (220, 226, 232), (170, 178, 192))
    c.box(3, 14, 13, 18, (30, 40, 50)); c.r(4, 15, 12, 15, SCREEN); c.p(5, 17, YELLOW)
    for x in (17, 21, 25): c.oval(x, 14, x + 2, 16, DARK)
    c.r(28, 15, 29, 17, YELLOW); c.l(28, 18, 26, 23, BLACK)
    return c.done()
def film_viewer():
    """Wall X-ray film viewer: two backlit panels showing chest films."""
    c = C(32, 32)
    c.box(0, 4, 31, 22, STEEL_D)
    for x0 in (2, 17):
        c.r(x0, 6, x0 + 12, 20, (230, 240, 250)); c.r(x0 + 1, 7, x0 + 11, 19, (40, 46, 60))
        c.oval(x0 + 2, 9, x0 + 5, 17, (150, 160, 180)); c.oval(x0 + 7, 9, x0 + 10, 17, (150, 160, 180)); c.l(x0 + 6, 8, x0 + 6, 19, (200, 206, 220))
    c.r(1, 23, 30, 23, STEEL)
    return c.done()


# ------------------------------------------------------------------ lobby / triage
def ticket_dispenser():
    """Number-ticket dispenser kiosk: red head with LED number, ticket slot, white pedestal."""
    c = C(16, 32)
    c.block(2, 2, 13, 13, 2, RED_L, RED)
    c.r(4, 6, 11, 9, (30, 10, 10)); c.p(5, 7, LED); c.p(7, 7, LED); c.p(9, 8, LED); c.r(5, 11, 10, 11, WHITE)
    c.block(4, 14, 11, 29, 2, WHITE, WHITE_D); c.r(5, 18, 10, 19, STEEL_L)
    c.r(4, 30, 12, 30, SH)
    return c.done()
def number_display():
    """Wall call-number board: black LED panel with red numbers and a 'counter 2' arrow."""
    c = C(32, 32)
    c.box(0, 2, 31, 18, DARK); c.r(1, 3, 30, 17, (20, 18, 24))
    # 3x5 LED digits "102", each pixel 1 wide x 2 tall.
    font = {'1': ('010', '110', '010', '010', '111'), '0': ('111', '101', '101', '101', '111'), '2': ('111', '001', '111', '100', '111')}
    for k, ch in enumerate('102'):
        for gy, line in enumerate(font[ch]):
            for gx, bit in enumerate(line):
                if bit == '1': c.r(4 + k * 5 + gx, 5 + gy * 2, 4 + k * 5 + gx, 6 + gy * 2, LED)
    c.r(22, 6, 28, 13, GREEN); c.l(23, 9, 27, 9, WHITE); c.l(26, 7, 27, 9, WHITE); c.l(26, 11, 27, 9, WHITE)
    c.r(14, 19, 17, 21, STEEL_D)
    return c.done()
def _seat_row(back):
    c = C(48, 32)
    c.r(2, 26, 45, 27, STEEL_D); c.r(4, 28, 5, 29, STEEL_D); c.r(42, 28, 43, 29, STEEL_D)
    for x0 in (1, 17, 33):
        if back:
            c.block(x0, 14, x0 + 13, 25, 3, BLUE_L, BLUE)
            c.block(x0 + 1, 6, x0 + 12, 21, 2, (90, 140, 210), BLUE_D)
        else:
            c.block(x0 + 1, 4, x0 + 12, 15, 2, (90, 140, 210), BLUE_D)
            c.block(x0, 14, x0 + 13, 25, 6, BLUE_L, BLUE)
    c.r(1, 30, 46, 30, SH)
    return c.done()
def wait_row_s(): return _seat_row(False)
def wait_row_n(): return _seat_row(True)
def wheelchair_bay():
    """Wheelchair bay (2 wide): two folded wheelchairs with grey wheels in a marked bay, blue access sign above."""
    c = C(32, 32)
    c.box(11, 0, 20, 8, BLUE); c.oval(14, 1, 16, 3, WHITE); c.l(15, 3, 15, 6, WHITE); c.l(15, 5, 18, 6, WHITE)
    for x0 in (1, 16):
        c.oval(x0, 14, x0 + 12, 27, DARK_M); c.oval(x0 + 2, 16, x0 + 10, 25, (130, 136, 150))
        c.block(x0 + 3, 10, x0 + 9, 22, 3, (70, 120, 200), BLUE_D)
        c.r(x0 + 2, 9, x0 + 2, 15, STEEL_L); c.r(x0 + 10, 9, x0 + 10, 15, STEEL_L)
    c.r(1, 29, 30, 29, SH)
    return c.done()
def triage_desk():
    """Triage desk (2 wide): white counter with an automatic blood-pressure cuff machine, thermometer and hand sanitiser."""
    c = C(32, 32)
    c.block(4, 4, 13, 14, 3, (220, 226, 232), (180, 188, 200)); c.r(6, 8, 11, 10, (30, 40, 50)); c.p(7, 9, ECG); c.p(9, 9, LED)
    c.oval(14, 6, 21, 13, (60, 64, 76)); c.oval(16, 8, 19, 11, (110, 116, 130))
    c.r(24, 4, 26, 12, (150, 220, 240)); c.r(24, 3, 26, 3, WHITE); c.r(28, 9, 29, 13, BLUE_L)
    c.block(0, 13, 31, 29, 4, WHITE, MINT_D)
    c.r(1, 21, 30, 21, MINT); c.p(15, 24, RED); c.r(14, 25, 16, 25, RED); c.p(15, 26, RED)
    return c.done()


# ------------------------------------------------------------------ elevator cabin / hall
def elev_car_door():
    """Elevator car doors seen from inside (door object, 1 wide): dark jamb frame, two hairline-brushed steel leaves
    with bevelled meeting edges, safety light-curtain strips on the jambs, and an aluminium threshold with a groove."""
    c = C(16, 48)
    c.box(0, 0, 15, 32, (70, 76, 90))
    c.r(1, 1, 1, 31, (120, 220, 255)); c.r(14, 1, 14, 31, (120, 220, 255))           # light-curtain strips
    for x0, x1 in ((2, 7), (8, 13)):
        c.r(x0, 1, x1, 31, (184, 190, 202))
        for x in range(x0, x1 + 1, 2): c.r(x, 2, x, 30, (198, 204, 214))           # brushed hairline
        c.r(x0, 1, x1, 1, (226, 230, 236))
    c.r(7, 1, 7, 31, STEEL_D); c.r(8, 1, 8, 31, STEEL_L)                             # meeting edges
    c.glare(3, 8, 6, 11, WHITE); c.glare(9, 18, 12, 21, WHITE)
    c.r(2, 28, 13, 31, (150, 156, 168))                                             # kick plate
    c.r(0, 33, 15, 36, (196, 200, 208)); c.r(0, 33, 15, 33, WHITE); c.r(0, 35, 15, 35, STEEL_D)
    return c.done()
def elev_mirror_wall():
    """Cabin back wall (3 wide): bevelled half-height mirror reflecting the ceiling light panel and the doors behind
    you, brushed-steel panels below with a chrome tube handrail on standoff brackets."""
    c = C(48, 32)
    c.box(0, 0, 47, 31, (150, 156, 168))
    c.box(2, 1, 45, 20, STEEL_L)
    c.r(3, 2, 44, 19, (176, 198, 212)); c.r(3, 2, 44, 5, (214, 226, 234))                    # reflected ceiling
    for x in range(6, 42, 8): c.r(x, 3, x + 4, 4, (250, 252, 255))                          # light panel cells
    c.r(18, 8, 29, 19, (128, 136, 150)); c.r(23, 8, 24, 19, (90, 96, 110)); c.r(18, 8, 29, 8, (160, 168, 180))  # reflected doors
    c.r(3, 17, 44, 19, (156, 176, 190))
    c.glare(6, 8, 14, 16, (236, 246, 252)); c.glare(9, 10, 15, 16, (214, 230, 240)); c.glare(34, 6, 43, 15, (236, 246, 252))
    for x in range(2, 46, 2): c.r(x, 22, x, 30, (164, 170, 182))
    c.r(1, 21, 46, 21, STEEL_D)
    c.rbox(1, 24, 46, 27, (220, 224, 232)); c.r(2, 25, 45, 25, WHITE); c.r(2, 26, 45, 26, STEEL)   # tube rail
    for x in (4, 23, 43): c.r(x, 27, x + 1, 29, STEEL_D)
    return c.done()
def elev_wood_panel():
    """Cabin side wall panel (2 wide): walnut veneer with a brushed-steel handrail and the capacity plate."""
    c = C(32, 32)
    c.box(0, 0, 31, 31, WOOD_D); c.r(1, 1, 30, 30, BROWN)
    for x in (10, 21): c.r(x, 1, x, 30, BROWN_D)
    c.box(11, 6, 20, 11, GOLD); c.r(12, 8, 19, 8, GOLD_D)
    c.r(1, 23, 30, 24, STEEL_L); c.r(1, 25, 30, 25, STEEL_D)
    for x in (3, 28): c.r(x, 21, x, 26, STEEL_D)
    return c.done()
def elev_button_panel():
    """Car operating panel: steel strip with a two-column grid of floor buttons (lit 3), door open/close, alarm and intercom grille."""
    c = C(16, 32)
    c.box(2, 1, 13, 30, STEEL_L)
    c.box(4, 3, 11, 7, BLACK); c.r(6, 4, 7, 6, LED); c.p(9, 4, ECG); c.p(9, 6, ECG)
    k = 0
    for y in (9, 12, 15, 18):
        for x in (5, 9):
            c.oval(x - 1, y - 1, x + 1, y + 1, ORANGE if k == 4 else STEEL_D); k += 1
    c.oval(4, 21, 6, 23, GREEN); c.oval(9, 21, 11, 23, DARK_M); c.oval(4, 25, 6, 27, YELLOW)
    for y in (25, 27): c.r(9, y, 11, y, STEEL_D)
    return c.done()
def elev_floor_led():
    """Floor-indicator LED above the car door: black panel, red '3' and an up arrow."""
    c = C(16, 32)
    c.box(1, 3, 14, 15, DARK); c.r(2, 4, 13, 14, (20, 18, 24))
    c.r(3, 6, 6, 6, LED); c.r(6, 6, 6, 12, LED); c.r(4, 9, 6, 9, LED); c.r(3, 12, 6, 12, LED)
    c.l(10, 6, 10, 12, ECG); c.l(8, 8, 10, 6, ECG); c.l(12, 8, 10, 6, ECG)
    c.r(3, 17, 12, 18, STEEL_L)
    return c.done()
def elev_hall_lantern():
    """Hall call station: up/down hall lanterns over a steel plate with up and down call buttons."""
    c = C(16, 32)
    c.box(2, 2, 13, 11, STEEL_D); c.r(3, 3, 12, 10, (30, 30, 36))
    c.l(5, 6, 7, 4, ECG); c.l(7, 4, 9, 6, ECG); c.r(5, 6, 9, 6, ECG); c.l(5, 8, 7, 10, LED); c.l(7, 10, 9, 8, LED)
    c.box(4, 14, 11, 26, STEEL_L); c.oval(6, 16, 9, 19, ORANGE); c.oval(6, 21, 9, 24, STEEL_D)
    return c.done()
def floor_directory():
    """Hospital floor directory (2 wide): navy board listing 3F surgery, 2F wards, 1F reception/pharmacy with colour bars."""
    c = C(32, 32)
    c.box(0, 1, 31, 26, NAVY)
    for k, (y, col) in enumerate(((4, RED), (11, MINT), (18, YELLOW))):
        c.box(2, y, 7, y + 5, col); c.r(3, y + 2, 6, y + 2, WHITE)
        c.r(10, y + 1, 27 - k * 3, y + 1, WHITE); c.r(10, y + 3, 22 + k * 2, y + 3, (160, 170, 200))
    c.r(1, 27, 30, 27, STEEL_D)
    return c.done()
