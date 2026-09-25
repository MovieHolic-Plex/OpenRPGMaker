"""Hand-painted scene pieces (3/4 top-down, EasyRPG palette): carriage, wagon, cart, raft, ferry, gallows, stocks,
tournament fence / pavilion / stand, wedding arch, red carpet, garlands, maypole, harvest goods, brazier, rune circle,
throne dais, checkpoint barrier, guard booth, lighthouse, airship envelope, sky and clouds, floating-rock underside."""
from __future__ import annotations

import math

from PIL import Image

from vehicle_art import Canvas, R_DEEP, R_HI, R_MID, R_DARK, R_WARM, BLACK

T = 16
TIBO = "public/assets/tibo-interior/interior-expanded.png"

IRON = ((60, 66, 70), (120, 130, 136), (170, 182, 188))
GOLD = ((250, 214, 110), (238, 196, 72), (200, 140, 36), (140, 92, 20))
RED = ((226, 70, 58), (196, 40, 36), (150, 24, 24), (90, 14, 14))
BLUE = ((110, 150, 220), (70, 110, 184), (52, 86, 150), (30, 50, 96))
GREEN = ((110, 190, 100), (72, 160, 80), (40, 110, 52), (22, 64, 30))
WHITE = ((250, 248, 240), (232, 226, 210), (200, 192, 172), (120, 110, 96))
CLOTH = ((244, 238, 216), (226, 214, 184), (196, 178, 146), (104, 84, 62))
STONE = ((196, 196, 204), (160, 160, 172), (120, 120, 134), (80, 80, 94), (48, 48, 60))
FIRE = ((255, 246, 190), (255, 214, 96), (244, 150, 40), (204, 76, 20))
PURPLE = ((170, 110, 220), (130, 76, 190), (96, 50, 150), (56, 26, 90))
ROSE = ((255, 150, 170), (230, 90, 120), (170, 50, 80))
LEAF = ((96, 170, 72), (60, 130, 50), (36, 86, 34))

_tibo = None


def tibo_tile(n: int) -> Image.Image:
    global _tibo
    if _tibo is None:
        _tibo = Image.open(TIBO).convert("RGBA")
    return _tibo.crop(((n % 30) * T, (n // 30) * T, (n % 30) * T + T, (n // 30) * T + T))


def horse(facing_right=True) -> Image.Image:
    """EasyRPG CharSet/Animal.png horse (CC0), as baked into the Tibo sheet (2023~2030): 32×32."""
    base = 2023 if facing_right else 2027
    im = Image.new("RGBA", (32, 32))
    for i in range(4):
        im.alpha_composite(tibo_tile(base + i), ((i % 2) * T, (i // 2) * T))
    return im


def outline_rect(c: Canvas, x0, y0, x1, y1, fill, edge=R_DEEP):
    for y in range(y0, y1):
        for x in range(x0, x1):
            c.set(x, y, edge if x in (x0, x1 - 1) or y in (y0, y1 - 1) else fill)


def wheel(c: Canvas, cx, cy, r, rim=R_DEEP, hub=IRON[1]):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = math.hypot(x - cx, y - cy)
            if d <= r + 0.3:
                if d > r - 1.2:
                    c.set(x, y, rim)
                elif d > r - 2.4:
                    c.set(x, y, R_MID if y < cy else R_DARK)
                elif d < 1.6:
                    c.set(x, y, hub)
                else:
                    ang = math.atan2(y - cy, x - cx)
                    if min(abs(((ang * 4 / math.pi) % 1) - 0), abs(((ang * 4 / math.pi) % 1) - 1)) < 0.18:
                        c.set(x, y, R_DARK)


def planks_h(c: Canvas, x0, y0, x1, y1, base=R_MID, seam=R_DARK, light=R_HI, period=4):
    for y in range(y0, y1):
        for x in range(x0, x1):
            k = (y - y0) % period
            c.set(x, y, seam if k == period - 1 else (light if k == 0 else base))


# ── Vehicles on land ─────────────────────────────────────────────────────────────────────────────────────────────
def paint_coach(c: Canvas, ox, oy, body=RED, with_horses=True):
    """Coach facing right: roof, body with door + window, driver's box, two wheels; horses (2×2) in front.
    Occupies 7×3 tiles from (ox, oy): coach x 0..4 tiles, horses x 4.5..6.5."""
    hi, mid, deep, dark = body
    # roof surface (seen from above) and rim
    for y in range(oy + 4, oy + 10):
        for x in range(ox + 6, ox + 58):
            edge = x in (ox + 6, ox + 57) or y == oy + 4
            c.set(x, y, R_DEEP if edge else (GOLD[1] if y == oy + 5 else (mid if y < oy + 8 else deep)))
    for x in range(ox + 5, ox + 59):
        c.set(x, oy + 10, BLACK)
        c.set(x, oy + 11, GOLD[2])
    # luggage on the roof
    outline_rect(c, ox + 14, oy + 1, ox + 30, oy + 7, R_MID)
    outline_rect(c, ox + 32, oy + 2, ox + 42, oy + 7, CLOTH[1], CLOTH[3])
    # body front face
    for y in range(oy + 12, oy + 34):
        for x in range(ox + 8, ox + 56):
            dy = y - oy - 12
            edge = x in (ox + 8, ox + 55) or y == oy + 33
            col = dark if edge else (hi if dy < 2 else (mid if dy < 16 else deep))
            if not edge and (x in (ox + 11, ox + 52) or y == oy + 29):
                col = GOLD[2]
            c.set(x, y, col)
    # door with a window
    outline_rect(c, ox + 26, oy + 14, ox + 40, oy + 33, deep, dark)
    outline_rect(c, ox + 28, oy + 16, ox + 38, oy + 24, (170, 210, 236), IRON[0])
    for x in range(ox + 29, ox + 37):
        c.set(x, oy + 17, (230, 244, 252))
    c.set(ox + 37, oy + 27, GOLD[1])
    # side windows
    for wx in (ox + 12, ox + 44):
        outline_rect(c, wx, oy + 16, wx + 9, oy + 24, (170, 210, 236), IRON[0])
    # lantern at the front corner
    for y in range(oy + 13, oy + 19):
        c.set(ox + 57, y, IRON[0])
        c.set(ox + 58, y, FIRE[1] if 14 < y - oy < 18 else IRON[0])
    # undercarriage + driver's box
    for x in range(ox + 10, ox + 70):
        c.set(x, oy + 35, R_DEEP)
        c.set(x, oy + 36, R_DARK)
    outline_rect(c, ox + 56, oy + 20, ox + 68, oy + 26, R_MID)
    for y in range(oy + 26, oy + 35):
        c.set(ox + 66, y, R_DEEP)
        c.set(ox + 67, y, R_MID)
    wheel(c, ox + 20, oy + 38, 9)
    wheel(c, ox + 50, oy + 40, 7)
    if with_horses:
        # shafts
        for x in range(ox + 66, ox + 84):
            c.set(x, oy + 32, R_DEEP)
            c.set(x, oy + 33, R_MID)
        c.paste(horse(True), ox + 72, oy + 12)
        c.paste(horse(True), ox + 84, oy + 16)


def paint_wagon(c: Canvas, ox, oy, cover=CLOTH, load=None, with_horse=True):
    """Covered wagon facing right (6×3 tiles with its horse): canvas hoops over a plank bed, two wheels."""
    hi, mid, sh, edge = cover
    # canvas cover: arched hoops seen from the side
    for x in range(ox + 6, ox + 54):
        u = (x - ox - 6) / 48
        top = oy + 4 + int(3 * (1 - math.sin(math.pi * u)))
        for y in range(top, oy + 26):
            e = y == top or x in (ox + 6, ox + 53)
            col = edge if e else (hi if y < top + 5 else (mid if y < oy + 20 else sh))
            if not e and (x - ox - 6) % 12 == 0:
                col = sh
            c.set(x, y, col)
    # dark opening at the back
    for y in range(oy + 10, oy + 24):
        for x in range(ox + 7, ox + 11):
            c.set(x, y, (40, 26, 16))
    # bed
    planks_h(c, ox + 4, oy + 25, ox + 58, oy + 34)
    for x in range(ox + 4, ox + 58):
        c.set(x, oy + 34, R_DEEP)
    for y in range(oy + 25, oy + 35):
        c.set(ox + 4, y, R_DEEP)
        c.set(ox + 57, y, R_DEEP)
    if load:
        load(c)
    wheel(c, ox + 16, oy + 37, 8)
    wheel(c, ox + 46, oy + 37, 8)
    if with_horse:
        for x in range(ox + 56, ox + 74):
            c.set(x, oy + 30, R_DEEP)
            c.set(x, oy + 31, R_MID)
        c.paste(horse(True), ox + 66, oy + 13)
    else:
        for i in range(0, 16):
            c.set(ox + 58 + i, oy + 30 + i // 3, R_DEEP)
            c.set(ox + 58 + i, oy + 31 + i // 3, R_MID)


def paint_handcart(c: Canvas, ox, oy, load="crates"):
    """Two-handled hand cart (2×2 tiles) with a load."""
    planks_h(c, ox + 3, oy + 14, ox + 25, oy + 22)
    for x in range(ox + 3, ox + 25):
        c.set(x, oy + 22, R_DEEP)
    for y in range(oy + 14, oy + 23):
        c.set(ox + 3, y, R_DEEP)
        c.set(ox + 24, y, R_DEEP)
    for i in range(8):
        c.set(ox + 25 + i, oy + 16 + i // 2, R_DEEP)
        c.set(ox + 25 + i, oy + 17 + i // 2, R_MID)
    if load == "crates":
        outline_rect(c, ox + 5, oy + 5, ox + 14, oy + 14, R_MID)
        outline_rect(c, ox + 14, oy + 7, ox + 23, oy + 14, R_HI)
        for x in range(ox + 6, ox + 13):
            c.set(x, oy + 9, R_DARK)
    elif load == "hay":
        for y in range(oy + 4, oy + 15):
            for x in range(ox + 4, ox + 24):
                if (x - ox - 14) ** 2 / 110 + (y - oy - 14) ** 2 / 100 <= 1:
                    c.set(x, y, (232, 196, 96) if (x + y) % 5 else (196, 150, 60))
    elif load == "pumpkins":
        for (px, py) in ((8, 10), (16, 9), (12, 5), (20, 11)):
            pumpkin(c, ox + px, oy + py, 4)
    wheel(c, ox + 14, oy + 25, 6)


def pumpkin(c: Canvas, cx, cy, r):
    for y in range(cy - r, cy + r):
        for x in range(cx - r - 1, cx + r + 1):
            if ((x - cx) / (r + 1)) ** 2 + ((y - cy) / r) ** 2 <= 1:
                rib = abs(x - cx) in (r // 2 + 1,)
                c.set(x, y, (164, 70, 16) if rib else ((250, 150, 40) if y < cy - 1 else (220, 110, 24)))
    c.set(cx, cy - r - 1, GREEN[2])
    c.set(cx, cy - r, GREEN[1])


# ── On the water ─────────────────────────────────────────────────────────────────────────────────────────────────
def paint_raft(c: Canvas, ox, oy, w_tiles=3, h_tiles=2, pole=True):
    """Log raft seen from above (logs run left-right), rope bindings, an oar pole."""
    W, H = w_tiles * T, h_tiles * T
    logs = H // 6
    for k in range(logs):
        y0 = oy + 2 + k * 6
        for y in range(y0, y0 + 6):
            for x in range(ox + 1 + (k % 2), ox + W - 1 - ((k + 1) % 2)):
                dy = y - y0
                col = R_DEEP if dy in (0, 5) else (R_HI if dy == 1 else (R_MID if dy < 4 else R_DARK))
                if x in (ox + 1 + (k % 2), ox + W - 2 - ((k + 1) % 2)):
                    col = (184, 140, 90) if 0 < dy < 5 else R_DEEP
                c.set(x, y, col)
    for rx in (ox + 6, ox + W - 7):
        for y in range(oy + 2, oy + 2 + logs * 6):
            c.set(rx, y, (200, 170, 120) if y % 2 else (150, 118, 80))
    if pole:
        for i in range(W + 6):
            x = ox - 3 + i
            y = oy + H - 5 - i // 5
            c.set(x, y, R_DEEP)
            c.set(x, y + 1, R_HI)


def paint_plank(c: Canvas, ox, oy, horizontal=True):
    """Boarding plank laid across a gap or over a rail (one tile), rope hand lines on both sides."""
    for y in range(oy, oy + T):
        for x in range(ox, ox + T):
            a, b = (y - oy, x - ox) if horizontal else (x - ox, y - oy)
            if a in (2, 13):
                col = R_DEEP
            elif a in (3, 12):
                col = (190, 160, 110) if (b // 3) % 2 else (150, 118, 80)
            elif 4 <= a <= 11:
                col = R_DEEP if b % 5 == 4 else (R_HI if b % 5 == 0 else R_MID)
            else:
                continue
            c.set(x, y, col)


def paint_ferry(c: Canvas, ox, oy, w_tiles=6, h_tiles=3):
    """Flat ferry barge: plank deck, low side rails, a hull band, bollards at the corners."""
    W, H = w_tiles * T, h_tiles * T
    for y in range(oy + 2, oy + H - 10):
        for x in range(ox + 2, ox + W - 2):
            k = (y - oy - 2) % 5
            c.set(x, y, R_DARK if k == 4 else (R_HI if k == 0 else R_MID))
    for x in range(ox + 1, ox + W - 1):
        for y, col in ((oy + 1, R_DEEP), (oy + 2, R_HI), (oy + 3, R_DARK)):
            c.set(x, y, col)
        for y, col in ((oy + H - 10, R_HI), (oy + H - 9, R_MID), (oy + H - 8, R_DEEP)):
            c.set(x, y, col)
        for y in range(oy + H - 7, oy + H - 2):
            c.set(x, y, R_DARK if (y - oy) % 3 else R_DEEP)
        c.set(x, oy + H - 2, BLACK)
    for y in range(oy + 1, oy + H - 1):
        for x in (ox + 1, ox + W - 2):
            c.set(x, y, R_DEEP)
    for (bx, by) in ((ox + 5, oy + 5), (ox + W - 8, oy + 5), (ox + 5, oy + H - 14), (ox + W - 8, oy + H - 14)):
        outline_rect(c, bx, by, bx + 4, by + 5, IRON[1], IRON[0])


# ── Justice ──────────────────────────────────────────────────────────────────────────────────────────────────────
def paint_gallows(c: Canvas, ox, oy):
    """Gallows 4×5 tiles: plank platform (top + front), side stairs (left), two posts, cross beam, noose."""
    # platform top (y 40..52) and front face (52..76)
    planks_h(c, ox + 12, oy + 40, ox + 62, oy + 52, period=4)
    for x in range(ox + 12, ox + 62):
        c.set(x, oy + 40, R_DEEP)
        c.set(x, oy + 52, BLACK)
    for y in range(oy + 53, oy + 78):
        for x in range(ox + 12, ox + 62):
            col = R_DEEP if (x - ox - 12) % 10 == 0 or y == oy + 77 else (R_DARK if (y - oy) % 6 else R_WARM)
            c.set(x, y, col)
    # cross braces under the platform
    for i in range(20):
        c.set(ox + 16 + i, oy + 56 + i, R_DEEP)
        c.set(ox + 56 - i, oy + 56 + i, R_DEEP)
    # trapdoor
    outline_rect(c, ox + 32, oy + 42, ox + 46, oy + 51, R_DARK, R_DEEP)
    # stairs up the left side
    for k in range(5):
        y = oy + 52 + k * 5
        for x in range(ox + 2 + 0, ox + 12):
            c.set(x, y, R_HI)
            for yy in range(y + 1, y + 5):
                c.set(x, yy, R_DARK if yy < y + 4 else R_DEEP)
    # posts and beam
    for px in (ox + 20, ox + 54):
        for y in range(oy + 6, oy + 46):
            c.set(px, y, R_DEEP)
            c.set(px + 1, y, R_HI)
            c.set(px + 2, y, R_MID)
            c.set(px + 3, y, R_DEEP)
    for x in range(ox + 16, ox + 62):
        c.set(x, oy + 4, R_DEEP)
        c.set(x, oy + 5, R_HI)
        c.set(x, oy + 6, R_MID)
        c.set(x, oy + 7, R_DEEP)
    # noose
    for y in range(oy + 8, oy + 26):
        c.set(ox + 39, y, (190, 160, 110))
    for y in range(oy + 26, oy + 33):
        for x in range(ox + 36, ox + 43):
            if abs(math.hypot(x - ox - 39, y - oy - 29) - 3) < 0.9:
                c.set(x, y, (190, 160, 110))


def paint_stocks(c: Canvas, ox, oy):
    """Pillory stocks (2×2 tiles): two posts, a board with three holes."""
    for px in (ox + 4, ox + 26):
        for y in range(oy + 6, oy + 30):
            c.set(px, y, R_DEEP)
            c.set(px + 1, y, R_MID)
            c.set(px + 2, y, R_DEEP)
    outline_rect(c, ox + 2, oy + 10, ox + 30, oy + 20, R_MID)
    for x in range(ox + 3, ox + 29):
        c.set(x, oy + 11, R_HI)
    for hx, r in ((ox + 9, 2), (ox + 16, 3), (ox + 23, 2)):
        for y in range(oy + 13, oy + 19):
            for x in range(hx - r, hx + r + 1):
                if math.hypot(x - hx, y - oy - 15) <= r:
                    c.set(x, y, (30, 16, 6))


def paint_block(c: Canvas, ox, oy):
    """Headsman's block with an axe (1×1)."""
    outline_rect(c, ox + 2, oy + 7, ox + 14, oy + 15, R_MID)
    for x in range(ox + 3, ox + 13):
        c.set(x, oy + 8, R_HI)
    for i in range(9):
        c.set(ox + 5 + i, oy + 5 - i // 3, R_DEEP)
    for y in range(oy + 1, oy + 6):
        for x in range(ox + 11, ox + 15):
            c.set(x, y, IRON[2] if x < ox + 13 else IRON[0])


# ── Festivals ────────────────────────────────────────────────────────────────────────────────────────────────────
def paint_pavilion(c: Canvas, ox, oy, colors=RED, w_tiles=3, h_tiles=3):
    """Round-topped striped pavilion tent with a pennant (3×3 tiles), open front flap."""
    W, H = w_tiles * T, h_tiles * T
    cx = ox + W // 2
    hi, mid, deep, dark = colors
    # conical roof
    for y in range(oy + 6, oy + 24):
        half = int((y - oy - 6) * (W / 2 - 2) / 18)
        for x in range(cx - half, cx + half + 1):
            stripe = ((x - cx + 64) // 5) % 2
            col = (WHITE[1] if stripe else mid) if y < oy + 22 else (WHITE[2] if stripe else deep)
            if abs(x - cx) == half:
                col = dark
            c.set(x, y, col)
    # scalloped valance
    for x in range(ox + 2, ox + W - 2):
        c.set(x, oy + 24, dark)
        if ((x - ox) // 4) % 2 == 0:
            c.set(x, oy + 25, mid)
            c.set(x, oy + 26, dark)
    # walls
    for y in range(oy + 25, oy + H - 2):
        for x in range(ox + 4, ox + W - 4):
            stripe = ((x - ox) // 6) % 2
            col = WHITE[1] if stripe else hi
            if x in (ox + 4, ox + W - 5) or y == oy + H - 3:
                col = dark
            c.set(x, y, col)
    # dark opening with tied flaps
    for y in range(oy + 30, oy + H - 3):
        for x in range(cx - 5, cx + 5):
            c.set(x, y, (40, 26, 20))
    for y in range(oy + 28, oy + H - 3):
        c.set(cx - 6, y, deep)
        c.set(cx + 5, y, deep)
    # pole + pennant
    for y in range(oy, oy + 7):
        c.set(cx, y, R_DEEP)
    for dy in range(3):
        for dx in range(1, 7 - dy * 2):
            c.set(cx + dx, oy + dy, GOLD[1])


def paint_list_fence(c: Canvas, ox, oy, kind="mid", colors=RED):
    """Tilt barrier for a jousting list (1 tile): striped rail on posts. kind = left | mid | right."""
    hi, mid, deep, dark = colors
    for x in range(ox, ox + T):
        for y, col in ((oy + 5, dark), (oy + 6, WHITE[0] if ((x - ox) // 4) % 2 else hi), (oy + 7, WHITE[1] if ((x - ox) // 4) % 2 else mid),
                       (oy + 8, WHITE[2] if ((x - ox) // 4) % 2 else deep), (oy + 9, dark)):
            if (kind == "left" and x < ox + 3) or (kind == "right" and x > ox + 12):
                continue
            c.set(x, y, col)
    posts = [ox + 7] if kind == "mid" else ([ox + 3] if kind == "left" else [ox + 11])
    for px in posts:
        for y in range(oy + 4, oy + 15):
            c.set(px, y, R_DEEP)
            c.set(px + 1, y, R_HI)
            c.set(px + 2, y, R_DEEP)


def paint_stand(c: Canvas, ox, oy, w_tiles=6, colors=BLUE):
    """Tiered wooden grandstand with a striped awning (w×4 tiles), for tournaments and festivals."""
    W = w_tiles * T
    hi, mid, deep, dark = colors
    # awning
    for y in range(oy + 2, oy + 12):
        for x in range(ox + 1, ox + W - 1):
            stripe = ((x - ox) // 6) % 2
            col = (WHITE[1] if stripe else mid) if y < oy + 10 else (WHITE[2] if stripe else deep)
            if y == oy + 2 or x in (ox + 1, ox + W - 2):
                col = dark
            c.set(x, y, col)
    for x in range(ox + 1, ox + W - 1):
        if ((x - ox) // 3) % 2 == 0:
            c.set(x, oy + 12, dark)
    # back wall + three tiers of benches
    for y in range(oy + 13, oy + 20):
        for x in range(ox + 2, ox + W - 2):
            c.set(x, y, R_DEEP if y == oy + 13 else R_DARK)
    for k in range(3):
        y0 = oy + 20 + k * 11
        planks_h(c, ox + 2, y0, ox + W - 2, y0 + 5, period=5)
        for y in range(y0 + 5, y0 + 11):
            for x in range(ox + 2, ox + W - 2):
                c.set(x, y, R_DEEP if y == y0 + 5 or (x - ox) % 16 == 2 else R_WARM)
    for x in range(ox + 2, ox + W - 2):
        c.set(x, oy + 53, BLACK)
    # posts
    for px in (ox + 2, ox + W - 4):
        for y in range(oy + 2, oy + 54):
            c.set(px, y, R_DEEP)
            c.set(px + 1, y, R_MID)
    # banners hanging from the awning
    for bx in range(ox + 10, ox + W - 10, 20):
        for y in range(oy + 13, oy + 24):
            for x in range(bx, bx + 7):
                if y < oy + 21 or abs(x - bx - 3) < oy + 24 - y:
                    c.set(x, y, GOLD[1] if x in (bx, bx + 6) else hi)


def paint_arch(c: Canvas, ox, oy, flowers=ROSE):
    """White wedding arch wound with flowers (3×3 tiles)."""
    W = 3 * T
    cx, cy = ox + W // 2, oy + 22
    for y in range(oy + 2, oy + 46):
        for x in range(ox, ox + W):
            if y <= cy:
                d = math.hypot(x - cx, (y - cy) * 1.1)
                on = 17 <= d <= 22
            else:
                on = (ox + 2 <= x <= ox + 7) or (ox + W - 8 <= x <= ox + W - 3)
            if on:
                edge_l = y > cy and x in (ox + 2, ox + W - 8)
                c.set(x, y, WHITE[3] if edge_l else (WHITE[0] if (x + y) % 3 else WHITE[2]))
    import random
    rnd = random.Random(7)
    for _ in range(70):
        ang = rnd.uniform(math.pi, 2 * math.pi)
        r = rnd.uniform(17, 23)
        if rnd.random() < 0.55:
            x, y = int(cx + r * math.cos(ang)), int(cy + r * math.sin(ang) / 1.1)
        else:
            x = rnd.choice((rnd.randint(ox + 1, ox + 8), rnd.randint(ox + W - 9, ox + W - 2)))
            y = rnd.randint(cy, oy + 40)
        col = rnd.choice((flowers[0], flowers[1], LEAF[0], LEAF[1], flowers[1]))
        c.set(x, y, col)
        c.set(x + 1, y, col)
        if col in flowers:
            c.set(x, y + 1, flowers[2])
    # bases
    for bx in (ox + 1, ox + W - 9):
        outline_rect(c, bx, oy + 42, bx + 8, oy + 47, STONE[1], STONE[3])


def paint_carpet(c: Canvas, ox, oy, kind="v"):
    """Red carpet runner (1 tile, lower, walkable): v = runs north–south, h = east–west, end_n/end_s caps."""
    for y in range(oy, oy + T):
        for x in range(ox, ox + T):
            if kind in ("v", "end_n", "end_s"):
                inside = ox + 2 <= x <= ox + 13 and not (kind == "end_n" and y < oy + 2) and not (kind == "end_s" and y > oy + 13)
                gold = x in (ox + 2, ox + 13) or (kind == "end_n" and y == oy + 2) or (kind == "end_s" and y == oy + 13)
            else:
                inside = oy + 2 <= y <= oy + 13
                gold = y in (oy + 2, oy + 13)
            if inside:
                c.set(x, y, GOLD[1] if gold else (RED[1] if (x + y) % 7 else RED[2]))


def paint_garland(c: Canvas, ox, oy, kind="lantern"):
    """A string across one tile (★ above walkers): paper lanterns or bunting pennants."""
    for x in range(ox, ox + T):
        y = oy + 3 + int(2 * math.sin(math.pi * (x - ox) / T))
        c.set(x, y, (60, 44, 30))
    if kind == "lantern":
        for lx, col in ((ox + 4, RED), (ox + 12, GOLD)):
            ly = oy + 4 + int(2 * math.sin(math.pi * (lx - ox) / T))
            for y in range(ly, ly + 7):
                for x in range(lx - 2, lx + 3):
                    edge = y in (ly, ly + 6) or abs(x - lx) == 2
                    c.set(x, y, col[3] if edge else (FIRE[0] if y == ly + 3 and abs(x - lx) < 1 else col[1]))
    else:
        for k, col in enumerate((RED, BLUE, GOLD, GREEN)):
            px = ox + 1 + k * 4
            py = oy + 4 + int(2 * math.sin(math.pi * (px - ox + 1) / T))
            for dy in range(5):
                for dx in range(3 - dy // 2):
                    c.set(px + dx, py + dy, col[1] if dx else col[2])


def paint_maypole(c: Canvas, ox, oy):
    """Maypole (1×3 tiles) with ribbons and a flower crown."""
    cx = ox + 8
    for y in range(oy + 4, oy + 46):
        c.set(cx - 1, y, R_DEEP)
        c.set(cx, y, WHITE[0])
        c.set(cx + 1, y, WHITE[2])
        c.set(cx + 2, y, R_DEEP)
    for k, col in enumerate((RED, BLUE, GOLD, GREEN, PURPLE)):
        for i in range(30):
            y = oy + 8 + i
            x = cx + int((k - 2) * i * 0.23)
            c.set(x, y, col[1])
    for dx in range(-4, 5):
        c.set(cx + dx, oy + 5, ROSE[1] if dx % 2 else LEAF[1])
        c.set(cx + dx, oy + 6, LEAF[2])
    for y in range(oy + 44, oy + 47):
        for x in range(cx - 4, cx + 5):
            c.set(x, y, STONE[2] if y > oy + 44 else STONE[1])


def paint_haybale(c: Canvas, ox, oy):
    for y in range(oy + 4, oy + 15):
        for x in range(ox + 1, ox + 15):
            edge = y in (oy + 4, oy + 14) or x in (ox + 1, ox + 14)
            col = (150, 110, 40) if edge else ((236, 202, 110) if y < oy + 7 else ((214, 170, 70) if (x + y) % 4 else (190, 146, 56)))
            c.set(x, y, col)
    for x in range(ox + 1, ox + 15):
        c.set(x, oy + 9, (140, 96, 40))


def paint_pumpkins(c: Canvas, ox, oy):
    for (px, py, r) in ((5, 11, 4), (12, 12, 3), (19, 10, 5), (26, 12, 4), (15, 6, 3)):
        pumpkin(c, ox + px, oy + py, r)


# ── Arena / boss stage ───────────────────────────────────────────────────────────────────────────────────────────
def paint_brazier(c: Canvas, ox, oy):
    """Iron brazier on a stone foot, burning (1×2 tiles)."""
    cx = ox + 8
    for y in range(oy + 18, oy + 30):
        half = 2 if y < oy + 26 else 4
        for x in range(cx - half, cx + half):
            c.set(x, y, STONE[3] if x in (cx - half, cx + half - 1) else STONE[1])
    for y in range(oy + 12, oy + 18):
        half = 6 - (y - oy - 12) // 2
        for x in range(cx - half, cx + half):
            c.set(x, y, IRON[0] if y == oy + 17 or x in (cx - half, cx + half - 1) else IRON[1])
    for y in range(oy + 1, oy + 13):
        half = max(1, int(5 * (y - oy - 1) / 12))
        for x in range(cx - half, cx + half):
            t = abs(x - cx + 0.5) / max(half, 1)
            col = FIRE[0] if t < 0.3 and y > oy + 6 else (FIRE[1] if t < 0.6 else (FIRE[2] if t < 0.9 else FIRE[3]))
            if y < oy + 4 and (x + y) % 2:
                continue
            c.set(x, y, col)


def paint_rune_circle(c: Canvas, ox, oy, size=3, colors=PURPLE):
    """Glowing rune circle cut into the floor (size×size tiles, lower, walkable; drawn over the map's ground)."""
    W = size * T
    cx = cy = W / 2
    for y in range(W):
        for x in range(W):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            R = W / 2 - 1.5
            ring = abs(d - R) < 1.0 or abs(d - R * 0.8) < 0.7
            ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
            star = False
            for k in range(5):
                a1 = -math.pi / 2 + k * 4 * math.pi / 5
                a2 = a1 + 4 * math.pi / 5
                x1, y1 = cx + R * 0.8 * math.cos(a1), cy + R * 0.8 * math.sin(a1)
                x2, y2 = cx + R * 0.8 * math.cos(a2), cy + R * 0.8 * math.sin(a2)
                dx, dy = x2 - x1, y2 - y1
                tlen = max(0, min(1, ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / (dx * dx + dy * dy)))
                if math.hypot(x + 0.5 - (x1 + tlen * dx), y + 0.5 - (y1 + tlen * dy)) < 0.8:
                    star = True
            runes = R * 0.8 < d < R and int((ang + math.pi) * 18 / math.pi) % 3 == 0 and int(d) % 2 == 0
            if ring or star:
                c.set(ox + x, oy + y, colors[0] if ring else colors[1])
            elif runes:
                c.set(ox + x, oy + y, colors[2])


def paint_throne(c: Canvas, ox, oy, colors=RED):
    """Throne on a three-step dais (3×3 tiles)."""
    W = 3 * T
    for k in range(3):
        y0 = oy + 30 + k * 6
        for y in range(y0, y0 + 6):
            for x in range(ox + 1 + (2 - k) * 2 - 4 + 4, ox + W - 1 - (2 - k) * 2):
                c.set(x, y, STONE[0] if y == y0 else (STONE[2] if y < y0 + 5 else STONE[4]))
    # carpet on the steps
    for y in range(oy + 30, oy + 48):
        for x in range(ox + 18, ox + 30):
            c.set(x, y, GOLD[1] if x in (ox + 18, ox + 29) else colors[1])
    # throne back and seat
    hi, mid, deep, dark = colors
    for y in range(oy + 2, oy + 30):
        for x in range(ox + 14, ox + 34):
            top = y < oy + 8 and abs(x - ox - 24) > (y - oy) * 1.5 + 3
            if top:
                continue
            edge = x in (ox + 14, ox + 33) or y == oy + 29
            col = GOLD[3] if edge else (GOLD[1] if x in (ox + 15, ox + 32) or y < oy + 5 else (mid if y < oy + 22 else deep))
            c.set(x, y, col)
    for x in range(ox + 12, ox + 36):
        for y in range(oy + 22, oy + 26):
            c.set(x, y, GOLD[2] if y == oy + 22 else GOLD[3] if y == oy + 25 else GOLD[1])
    c.set(ox + 24, oy + 3, (120, 200, 255))
    c.set(ox + 23, oy + 3, (70, 140, 220))


# ── Gates / checkpoints ──────────────────────────────────────────────────────────────────────────────────────────
def paint_barrier(c: Canvas, ox, oy, w_tiles=3):
    """Checkpoint boom barrier: striped pole on two posts (w×1 tiles)."""
    W = w_tiles * T
    for x in range(ox + 3, ox + W - 3):
        stripe = ((x - ox) // 5) % 2
        for y, shade in ((oy + 5, 0), (oy + 6, 1), (oy + 7, 2)):
            c.set(x, y, (WHITE[shade] if stripe else RED[shade]))
        c.set(x, oy + 4, R_DEEP)
        c.set(x, oy + 8, R_DEEP)
    for px in (ox + 1, ox + W - 4):
        for y in range(oy + 2, oy + 15):
            c.set(px, y, R_DEEP)
            c.set(px + 1, y, R_HI)
            c.set(px + 2, y, R_DEEP)
    for y in range(oy + 3, oy + 10):
        for x in range(ox + W - 5, ox + W - 1):
            c.set(x, y, IRON[0] if y in (oy + 3, oy + 9) else IRON[1])


def paint_booth(c: Canvas, ox, oy, roof=RED):
    """Small guard booth (2×3 tiles): pitched roof, plank walls, a window hatch."""
    W = 2 * T
    hi, mid, deep, dark = roof
    for y in range(oy + 2, oy + 16):
        half = min(W // 2, 4 + (y - oy - 2) * 2)
        for x in range(ox + W // 2 - half, ox + W // 2 + half):
            edge = abs(x - ox - W // 2) >= half - 1 or y == oy + 15
            c.set(x, y, dark if edge else (hi if (y - oy) % 4 == 0 else mid))
    for y in range(oy + 16, oy + 46):
        for x in range(ox + 2, ox + W - 2):
            edge = x in (ox + 2, ox + W - 3) or y == oy + 45
            c.set(x, y, R_DEEP if edge else (R_DARK if (x - ox) % 5 == 0 else R_MID))
    outline_rect(c, ox + 8, oy + 20, ox + 24, oy + 29, (40, 26, 16), R_DEEP)
    for x in range(ox + 7, ox + 25):
        c.set(x, oy + 29, R_HI)
    outline_rect(c, ox + 11, oy + 32, ox + 21, oy + 46, R_WARM, R_DEEP)


def paint_lighthouse(c: Canvas, ox, oy):
    """Lighthouse 3×7 tiles: striped tapering tower, gallery rail, glowing lantern room, dome, door."""
    W = 3 * T
    cx = ox + W // 2
    # dome + lantern
    for y in range(oy + 2, oy + 10):
        half = int(3 + (y - oy - 2) * 1.2)
        for x in range(cx - half, cx + half):
            c.set(x, y, RED[3] if abs(x - cx + 0.5) >= half - 1 else (RED[0] if y < oy + 5 else RED[1]))
    c.set(cx, oy + 1, IRON[0])
    for y in range(oy + 10, oy + 22):
        for x in range(cx - 10, cx + 10):
            edge = x in (cx - 10, cx + 9) or (x - cx) % 5 == 0
            c.set(x, y, IRON[0] if edge else (FIRE[0] if y < oy + 16 else FIRE[1]))
    # gallery
    for y in range(oy + 22, oy + 27):
        for x in range(cx - 14, cx + 14):
            rail = y == oy + 22 or (x - cx) % 3 == 0 and y < oy + 25
            c.set(x, y, IRON[1] if rail else (IRON[0] if y == oy + 26 else IRON[2] if y == oy + 25 else (0, 0, 0, 0)[:3]) if rail or y >= oy + 25 else IRON[0])
    # tower
    for y in range(oy + 27, oy + 108):
        t = (y - oy - 27) / 81
        half = int(10 + 5 * t)
        band = ((y - oy - 27) // 14) % 2
        for x in range(cx - half, cx + half):
            u = (x - cx + half) / (2 * half)
            if x in (cx - half, cx + half - 1):
                col = STONE[4]
            else:
                base = RED if band else ((250, 248, 240), (232, 226, 210), (200, 192, 172), (150, 140, 120))
                col = base[0] if u < 0.3 else (base[1] if u < 0.7 else base[2])
            c.set(x, y, col)
    # door + window
    outline_rect(c, cx - 4, oy + 96, cx + 4, oy + 108, R_WARM, R_DEEP)
    outline_rect(c, cx - 2, oy + 60, cx + 2, oy + 67, (60, 90, 130), STONE[4])
    # foundation
    for y in range(oy + 104, oy + 110):
        for x in range(cx - 17, cx + 17):
            c.set(x, y, STONE[3] if y in (oy + 104,) else STONE[2])
    for x in range(cx - 17, cx + 17):
        c.set(x, oy + 110, STONE[4])
    outline_rect(c, cx - 4, oy + 97, cx + 4, oy + 110, R_WARM, R_DEEP)


# ── Sky ──────────────────────────────────────────────────────────────────────────────────────────────────────────
SKY = ((150, 196, 236), (132, 182, 228), (116, 168, 220))


def paint_sky(c: Canvas, ox, oy, variant=0):
    """Open sky (lower tile). Faint horizontal streaks so a large field does not look flat."""
    for y in range(oy, oy + T):
        for x in range(ox, ox + T):
            col = SKY[1]
            if variant == 1 and (y - oy) in (5,) and 2 <= (x - ox) <= 11:
                col = SKY[0]
            if variant == 2 and (y - oy) in (10,) and 5 <= (x - ox) <= 14:
                col = SKY[0]
            c.set(x, y, col)


def paint_cloud(c: Canvas, ox, oy, w_tiles=3, h_tiles=2, seed=1):
    """Puffy cloud (★), soft white with a blue-grey belly."""
    import random
    rnd = random.Random(seed)
    W, H = w_tiles * T, h_tiles * T
    blobs = [(rnd.uniform(W * 0.2, W * 0.8), rnd.uniform(H * 0.35, H * 0.6), rnd.uniform(H * 0.25, H * 0.42)) for _ in range(5)]
    blobs.append((W * 0.5, H * 0.55, H * 0.38))
    for y in range(H):
        for x in range(W):
            inside = [b for b in blobs if math.hypot(x - b[0], (y - b[1]) * 1.3) <= b[2]]
            if not inside or y > H - 3:
                continue
            under = y > H * 0.62
            edge = not all(math.hypot(x + dx - b[0], (y + dy - b[1]) * 1.3) <= b[2] for b in inside[:1] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            col = (255, 255, 255) if not under else (226, 236, 246)
            if edge:
                col = (206, 222, 238) if not under else (186, 204, 226)
            c.set(ox + x, oy + y, col)


def paint_envelope(c: Canvas, ox, oy, w_tiles=12, h_tiles=4, scheme="canvas"):
    """Airship gas envelope seen from the side-above: long ellipsoid with gores, belly band, fins at the tail (right)."""
    W, H = w_tiles * T, h_tiles * T
    cols = {"canvas": ((240, 232, 206), (222, 208, 176), (190, 170, 136), (120, 96, 66), (170, 60, 40)),
            "red": ((236, 110, 96), (214, 70, 58), (170, 44, 40), (90, 20, 20), (240, 200, 80))}[scheme]
    light, mid, shade, edge, band = cols
    cx, cy, rx, ry = ox + W * 0.47, oy + H * 0.5, W * 0.45, H * 0.46
    for y in range(oy, oy + H):
        for x in range(ox, ox + W):
            e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if e > 1:
                continue
            if e > 0.9:
                col = edge
            else:
                v = (y - oy) / H
                col = light if v < 0.35 else (mid if v < 0.7 else shade)
                if int((x - cx) / (rx / 6)) != int((x - cx - 1) / (rx / 6)):
                    col = shade if v < 0.7 else edge
                if abs(y - cy - ry * 0.35) < 1.5:
                    col = band
            c.set(x, y, col)
    # tail fins (right)
    fx = int(cx + rx) - 6
    for dy in range(-int(ry * 0.9), int(ry * 0.9)):
        span = int(12 * (1 - abs(dy) / (ry * 0.9)))
        for dx in range(span):
            c.set(fx + dx, int(cy) + dy, edge if dx == span - 1 else band)


def paint_rock_underside(c: Canvas, ox, oy, w_px, depth, seed=3):
    """Hanging rock under a floating island edge: a jagged mass that narrows downward (column-wise depth)."""
    import random
    rnd = random.Random(seed)
    for x in range(w_px):
        d = int(depth * (0.55 + 0.45 * math.sin(math.pi * (x + 1) / (w_px + 1))) + rnd.randint(-2, 2))
        for y in range(d):
            v = y / max(d, 1)
            col = STONE[2] if v < 0.25 else (STONE[3] if v < 0.7 else STONE[4])
            if (x * 3 + y * 5) % 17 == 0:
                col = STONE[1]
            if y == d - 1:
                col = (40, 40, 52)
            c.set(ox + x, oy + y, col)
