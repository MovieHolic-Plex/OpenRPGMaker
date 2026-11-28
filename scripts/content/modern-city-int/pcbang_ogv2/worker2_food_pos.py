#!/usr/bin/env python3
"""Worker 2 — Korean PC Bang Food Bar & Alba Counter sprites (object-gen-v2 pure 1-pass).

Generates 4 crisp 3/4 top-down pixel-art pieces locked 100% to fable-city.json:
  1. pcb3-counter-pos.png  (48x32) — Alba POS, order-pickup tray & amber hot-snack showcase
  2. pcb3-drink-triple.png (48x32) — 3-door commercial chilled glass drink showcase fridge
  3. pcb3-snack-rack.png   (32x32) — 4-tier cup-ramen & puffed snack gondola display rack
  4. pcb3-ramen-bar.png    (48x32) — Self-serve Hangang instant-ramen bar & ice-water purifier
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, "/home/main/object-gen-v2")
from objectgen_v2.palette import load_palette, verify_sprite  # noqa: E402

PALETTE_PATH = Path("/home/main/object-gen-v2/palettes/fable-city.json")
OUT_DIR = Path(
    "/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a"
    "/tiledata/modern-city/pcbang-ogv2/pieces"
)


def load_ramps(path: Path) -> dict[str, list[tuple[int, int, int, int]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))["ramps"]
    ramps: dict[str, list[tuple[int, int, int, int]]] = {}
    for name, hexes in raw.items():
        ramps[name] = [
            (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255) for h in hexes
        ]
    return ramps


class Canvas:
    def __init__(self, w: int, h: int, ramps: dict[str, list[tuple[int, int, int, int]]]):
        self.w = w
        self.h = h
        self.R = ramps
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def c(self, ramp: str, idx: int) -> tuple[int, int, int, int]:
        arr = self.R[ramp]
        return arr[max(0, min(len(arr) - 1, idx))]

    def p(self, x: int, y: int, col: tuple[int, int, int, int] | tuple[str, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if isinstance(col[0], str):
                col = self.c(col[0], col[1])  # type: ignore[arg-type]
            self.px[x, y] = col  # type: ignore[assignment]

    def clear(self, x: int, y: int) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = (0, 0, 0, 0)

    def hline(self, x0: int, x1: int, y: int, col: tuple[str, int]) -> None:
        rgba = self.c(*col)
        for x in range(x0, x1 + 1):
            self.p(x, y, rgba)

    def vline(self, x: int, y0: int, y1: int, col: tuple[str, int]) -> None:
        rgba = self.c(*col)
        for y in range(y0, y1 + 1):
            self.p(x, y, rgba)

    def rect(self, x0: int, y0: int, x1: int, y1: int, col: tuple[str, int]) -> None:
        rgba = self.c(*col)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, rgba)


def build_counter_pos(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    """1. pcb3-counter-pos.png (48x32): Korean PC Bang Alba POS & Food Pickup Counter."""
    cv = Canvas(48, 32, ramps)

    # --- Base Countertop & Architectural Front Fascia (y=13..31) ---
    # Back counter lip (y=13, x=3..44)
    cv.hline(3, 44, 13, ("kawara", 1))

    # 2px architectural side cheeks (x=1..2 and x=45..46, y=14..29)
    # Left cheek (top-left lit)
    cv.vline(1, 15, 29, ("kuro", 0))
    cv.p(1, 14, ("kawara", 2))
    cv.vline(2, 14, 17, ("kawara", 5))
    cv.p(2, 18, ("steel", 5))
    cv.vline(2, 19, 28, ("kuro", 2))
    cv.p(2, 29, ("kuro", 1))

    # Right cheek (shaded side)
    cv.vline(46, 15, 29, ("kuro", 0))
    cv.p(46, 14, ("kawara", 1))
    cv.vline(45, 14, 17, ("kawara", 3))
    cv.p(45, 18, ("steel", 3))
    cv.vline(45, 19, 28, ("kuro", 1))
    cv.p(45, 29, ("kuro", 0))

    # Wide 3/4 dark-slate countertop surface (x=3..44, y=14..18)
    for x in range(3, 45):
        top_sh = 5 if x < 18 else (4 if x < 34 else 3)
        mid_sh = 4 if x < 16 else (3 if x < 35 else 2)
        cv.p(x, 14, ("kawara", top_sh))
        cv.p(x, 15, ("kawara", mid_sh))
        cv.p(x, 16, ("kawara", mid_sh))
        cv.p(x, 17, ("kawara", min(5, mid_sh + 1)))
        # Crisp brushed-steel bullnose front bevel at y=18
        st_sh = 5 if 5 <= x <= 26 else (4 if x < 39 else 3)
        cv.p(x, 18, ("steel", st_sh))

    # Subtle stone sheen specks on open counter surface
    for sx, sy, sh in [(3, 15, 5), (19, 15, 4), (20, 16, 4), (30, 15, 4)]:
        cv.p(sx, sy, ("kawara", sh))

    # Deep overhang shadow under countertop bullnose (y=19)
    cv.hline(3, 44, 19, ("kuro", 0))

    # Front architectural fascia (y=20..28) divided into 3 recessed slatted bays
    # Bay 1: x=3..15 | Stile: x=16 | Bay 2: x=17..30 | Stile: x=31 | Bay 3: x=32..44
    bays = [(3, 15), (17, 30), (32, 44)]
    for bx0, bx1 in bays:
        # Glowing cyan LED under-counter strip at y=20
        mid = (bx0 + bx1) // 2
        for x in range(bx0, bx1 + 1):
            if x in (bx0, bx1):
                cv.p(x, 20, ("teal", 3))
            elif abs(x - mid) <= 2:
                cv.p(x, 20, ("glass", 6))
            else:
                cv.p(x, 20, ("glass", 5))
        # Vertical dark-charcoal & slate slats (y=21..27) with top cyan LED light wash
        for x in range(bx0, bx1 + 1):
            is_ridge = ((x - bx0) % 2 == 0)
            if is_ridge:
                cv.p(x, 21, ("glass", 3))      # subtle cyan bounce light at top of slat
                cv.p(x, 22, ("kawara", 2))
                cv.vline(x, 23, 26, ("kuro", 2))
                cv.p(x, 27, ("kuro", 1))
            else:
                cv.p(x, 21, ("teal", 1))
                cv.vline(x, 22, 27, ("kuro", 0))
        # Recessed bay bottom trim rail (y=28)
        cv.hline(bx0, bx1, 28, ("kawara", 1))

    # Structural stiles between bays (x=16, x=31)
    for sx in (16, 31):
        cv.p(sx, 20, ("kuro", 2))
        cv.vline(sx, 21, 27, ("kawara", 2))
        cv.p(sx, 28, ("kuro", 2))

    # Recessed dark kickplate (y=29..30, x=2..45) & grounded shadow (y=31, x=3..44)
    cv.hline(2, 45, 29, ("kuro", 0))
    cv.hline(2, 45, 30, ("ink", 0))
    for x in (6, 19, 28, 39):
        cv.p(x, 29, ("kuro", 1))
    cv.hline(3, 44, 31, ("ink", 0))
    cv.clear(1, 30)
    cv.clear(46, 30)

    # --- Countertop Equipment (Organic Stepped Silhouette y=3..17) ---

    # 1) LEFT (x=4..19): Dual POS Monitors + Barcode Scanner + IC Card Pad
    # Cast shadow under POS cluster
    cv.rect(5, 15, 19, 16, ("kawara", 2))

    # Main Seat-Timer Dashboard Monitor (x=4..12, y=3..12)
    cv.hline(5, 11, 3, ("kawara", 3))          # 3/4 visible top bezel plane
    cv.p(4, 4, ("kuro", 2))
    cv.hline(5, 11, 4, ("kuro", 1))
    cv.p(12, 4, ("kuro", 0))
    for y in range(5, 12):
        cv.p(4, y, ("kuro", 2))                # left lit bezel
        cv.p(12, y, ("kuro", 0))               # right dark bezel
    cv.hline(4, 12, 11, ("kuro", 0))           # bottom bezel + power LED
    cv.p(11, 11, ("teal", 5))
    # Monitor stand & foot
    cv.vline(8, 12, 14, ("steel", 2))
    cv.vline(9, 12, 14, ("kuro", 0))
    cv.hline(6, 10, 15, ("kuro", 2))
    cv.p(6, 15, ("steel", 3))
    # Dashboard screen (x=5..11, y=5..10): PC-bang seat grid UI
    cv.rect(5, 5, 11, 10, ("glass", 0))
    cv.hline(5, 11, 5, ("navy", 3))            # top title bar
    cv.p(5, 5, ("glass", 6))
    cv.p(6, 5, ("glass", 5))
    # Seat blocks: active cyan/teal seats, one yellow warning seat, empty dark-blue seats
    seat_map = [
        (5, 7, ("teal", 5)), (6, 7, ("glass", 5)), (8, 7, ("teal", 4)), (10, 7, ("yellow", 4)),
        (5, 9, ("teal", 4)), (6, 9, ("teal", 5)), (8, 9, ("navy", 2)), (10, 9, ("glass", 5)),
        (11, 8, ("coolwhite", 4)), (11, 9, ("green", 4)),
    ]
    for sx, sy, scol in seat_map:
        cv.p(sx, sy, scol)

    # Secondary Order/Receipt Monitor (x=13..18, y=6..13 — stepped lower!)
    cv.hline(14, 17, 6, ("kawara", 3))         # 3/4 top edge
    cv.rect(13, 7, 18, 12, ("kuro", 0))
    cv.vline(13, 7, 11, ("kuro", 2))
    cv.rect(14, 8, 17, 11, ("navy", 1))
    # Order receipt UI lines
    cv.hline(14, 16, 8, ("glass", 5))
    cv.hline(14, 17, 9, ("coolwhite", 4))
    cv.hline(14, 15, 10, ("yellow", 4))
    cv.hline(16, 17, 11, ("green", 4))
    # Stand
    cv.p(15, 13, ("steel", 2))
    cv.p(16, 13, ("kuro", 0))
    cv.hline(14, 17, 14, ("kuro", 1))

    # Handheld Barcode Scanner on Stand (x=11..13, y=11..16)
    cv.p(11, 11, ("steel", 4))                 # arched scanner head
    cv.p(12, 11, ("kuro", 2))
    cv.p(10, 12, ("red", 4))                   # red laser window glint
    cv.p(11, 12, ("kuro", 1))
    cv.p(12, 13, ("kuro", 1))                  # gooseneck
    cv.p(12, 14, ("kuro", 0))
    cv.hline(11, 13, 15, ("kuro", 2))          # weighted scanner base
    cv.p(12, 16, ("kuro", 0))

    # IC Card / Pay Reader Pad at front-right of POS (x=16..19, y=14..17)
    cv.rect(16, 14, 19, 17, ("kuro", 0))
    cv.hline(16, 18, 14, ("kuro", 3))
    cv.p(17, 15, ("glass", 6))                 # backlit mini LCD
    cv.p(18, 15, ("glass", 5))
    cv.p(17, 16, ("yellow", 4))                # Kakao/IC tap pad
    cv.p(18, 16, ("teal", 4))

    # 2) CENTER (x=21..29): Order-Pickup Mat + Freshly Cooked Tray (Bowl + Iced Ade)
    # Dark-navy non-slip silicone pickup mat (x=21..29, y=14..17)
    cv.rect(21, 14, 29, 17, ("navy", 1))
    cv.hline(21, 29, 14, ("navy", 2))
    cv.vline(21, 14, 16, ("navy", 2))
    cv.hline(21, 29, 17, ("navy", 0))
    cv.vline(29, 14, 17, ("navy", 0))

    # Serving tray on mat (x=22..28, y=13..16)
    cv.rect(22, 13, 28, 16, ("cedar", 2))
    cv.hline(22, 28, 13, ("cedar", 4))
    cv.hline(22, 28, 16, ("wood", 1))

    # Hot golden noodle/rice bowl on left of tray (x=22..25, y=10..15)
    cv.hline(23, 25, 10, ("white", 6))         # back bowl rim
    cv.p(22, 11, ("white", 6))
    cv.p(23, 11, ("orange", 4))                # spicy golden broth
    cv.p(24, 11, ("yellow", 5))                # egg/cheese topping
    cv.p(25, 11, ("red", 4))
    cv.p(22, 12, ("coolwhite", 5))
    cv.p(23, 12, ("yellow", 4))
    cv.p(24, 12, ("orange", 5))
    cv.p(25, 12, ("coolwhite", 4))
    cv.hline(22, 25, 13, ("coolwhite", 4))     # ceramic bowl front
    cv.hline(23, 24, 14, ("coolwhite", 2))     # rounded bowl foot
    # Delicate steam wisps above hot bowl in transparent space!
    cv.p(23, 8, ("coolwhite", 5))
    cv.p(24, 6, ("coolwhite", 3))

    # Tall Iced Ade Cup with Dome Lid & Straw on right of tray (x=26..28, y=7..15)
    cv.p(28, 7, ("green", 4))                  # bent green straw tip
    cv.p(27, 8, ("green", 4))
    cv.p(27, 9, ("green", 3))
    cv.hline(26, 28, 10, ("white", 6))         # clear dome lid highlight
    cv.p(26, 11, ("glass", 6))                 # ice + sparkling grapefruit/orange ade
    cv.p(27, 11, ("yellow", 5))
    cv.p(28, 11, ("orange", 4))
    cv.p(26, 12, ("orange", 5))
    cv.p(27, 12, ("orange", 4))
    cv.p(28, 12, ("red", 4))
    cv.p(26, 13, ("orange", 4))
    cv.p(27, 13, ("red", 4))
    cv.p(28, 13, ("orange", 3))
    cv.hline(26, 28, 14, ("glass", 5))         # clear cup base

    # 3) RIGHT (x=31..44): Warm Amber-Illuminated Glass Hot-Snack Showcase
    # Cast shadow on counter
    cv.hline(31, 44, 17, ("kawara", 1))
    # Stepped 3/4 canopy roof (y=4..6)
    cv.hline(32, 43, 4, ("steel", 3))          # beveled top roof back
    cv.hline(32, 37, 4, ("steel", 4))          # top-left highlight
    cv.p(31, 5, ("kuro", 2))
    cv.hline(32, 43, 5, ("kawara", 3))         # 3/4 top roof plane
    cv.p(44, 5, ("kuro", 0))
    # Warm red-amber illuminated header strip (y=6)
    cv.p(31, 6, ("kuro", 1))
    cv.hline(32, 43, 6, ("red", 3))
    for hx, hcol in [(35, ("orange", 4)), (36, ("yellow", 5)), (37, ("orange", 5)),
                     (38, ("yellow", 5)), (39, ("orange", 4))]:
        cv.p(hx, 6, hcol)                      # glowing "HOT" badge
    cv.p(44, 6, ("kuro", 0))

    # Glass cabinet body (x=31..44, y=7..14)
    for y in range(7, 15):
        cv.p(31, y, ("kuro", 1))               # left anodized frame
        cv.p(44, y, ("kuro", 0))               # right dark frame

    # Warm amber interior backdrop
    cv.rect(32, 7, 43, 14, ("orange", 1))
    cv.hline(32, 43, 7, ("yellow", 5))         # warm overhead heat-lamp tube glow!
    cv.hline(33, 42, 8, ("orange", 3))

    # Upper slanted rack (y=8..10): Sotteok-sotteok skewers & golden fried rolls
    # Sotteok skewers (x=33..37, y=8..9): alternating pink/red sausage & cream rice cake
    cv.p(33, 8, ("red", 4))
    cv.p(34, 8, ("cream", 6))
    cv.p(35, 8, ("red", 4))
    cv.p(36, 8, ("cream", 5))
    cv.p(37, 8, ("pink", 4))
    cv.p(33, 9, ("cream", 5))
    cv.p(34, 9, ("red", 4))
    cv.p(35, 9, ("cream", 6))
    cv.p(36, 9, ("red", 3))
    cv.p(37, 9, ("cedar", 5))                  # wooden skewer stick end
    # Golden fried mandu / cheese sticks (x=39..42, y=8..9)
    cv.hline(39, 42, 8, ("yellow", 5))
    cv.hline(39, 42, 9, ("orange", 4))
    cv.p(41, 9, ("orange", 3))
    # Wire rack 1 (y=10)
    cv.hline(32, 43, 10, ("steel", 4))
    cv.p(38, 10, ("steel", 2))

    # Lower slanted rack (y=11..13): Plump PC-bang hotdogs with mustard/ketchup
    for hx in (33, 36, 39, 41):
        cv.p(hx, 11, ("cedar", 5))             # toasted hotdog bun left
        cv.p(hx + 1, 11, ("yellow", 5))        # mustard drizzle
        cv.p(hx, 12, ("red", 4))               # sausage + ketchup
        cv.p(hx + 1, 12, ("orange", 4))
    cv.hline(32, 43, 13, ("steel", 4))         # wire rack 2
    cv.hline(32, 43, 14, ("orange", 2))        # warm crumb tray glow

    # Crisp diagonal glass specular highlight across hot-snack front glass
    cv.p(32, 8, ("glass", 6))
    cv.p(33, 9, ("glass", 5))
    cv.p(32, 10, ("glass", 5))
    cv.p(42, 11, ("glass", 5))
    cv.p(43, 12, ("glass", 4))

    # Base warmer plinth (x=31..44, y=15..16)
    cv.rect(31, 15, 44, 16, ("kuro", 1))
    cv.hline(31, 44, 16, ("kuro", 0))
    cv.p(33, 15, ("orange", 5))                # lit rocker switch
    cv.p(35, 15, ("steel", 4))
    cv.p(42, 15, ("yellow", 4))                # thermostat dial

    return cv.im


def build_drink_triple(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    """2. pcb3-drink-triple.png (48x32): 3-Door Commercial Glass Drink Showcase Fridge."""
    cv = Canvas(48, 32, ramps)

    # --- 3/4 Top Roof Plane & Compressor Louver Header (y=1..6, beveled corners!) ---
    # y=1..3: Stepped 3/4 top roof plane (not a harsh rectangle across y=0!)
    cv.hline(4, 43, 1, ("kawara", 1))          # rear roof contour
    cv.p(3, 2, ("kawara", 2))
    for x in range(4, 44):
        cv.p(x, 2, ("kawara", 4 if x < 26 else 3))
    cv.p(44, 2, ("kawara", 1))

    cv.p(2, 3, ("kawara", 2))
    for x in range(3, 45):
        cv.p(x, 3, ("kawara", 5 if x < 22 else (4 if x < 36 else 3)))
    cv.p(45, 3, ("kawara", 1))
    # Subtle top cooling-unit seam on roof
    cv.hline(16, 31, 2, ("steel", 3))
    cv.p(16, 2, ("kawara", 2))
    cv.p(31, 2, ("kawara", 2))

    # y=4..6: Top compressor louver header (x=1..46) + glowing cyan "ICE DRINK" badge
    cv.rect(1, 4, 46, 6, ("kuro", 1))
    cv.hline(2, 45, 4, ("kuro", 2))
    cv.vline(1, 5, 6, ("kuro", 2))
    cv.vline(46, 5, 6, ("kuro", 0))

    # Left & right horizontal louver vents (x=3..12 and x=35..44)
    for lx in range(3, 13):
        cv.p(lx, 4, ("steel", 2) if lx % 2 == 0 else ("kuro", 1))
        cv.p(lx, 5, ("kuro", 0))
        cv.p(lx, 6, ("kuro", 2))
    for lx in range(35, 45):
        cv.p(lx, 4, ("steel", 2) if lx % 2 == 0 else ("kuro", 1))
        cv.p(lx, 5, ("kuro", 0))
        cv.p(lx, 6, ("kuro", 2))

    # Center glowing cyan "ICE DRINK" marquee sign (x=14..33, y=4..6)
    cv.rect(14, 4, 33, 6, ("glass", 1))
    cv.hline(14, 33, 4, ("teal", 3))
    cv.hline(14, 33, 6, ("glass", 2))
    # Crisp pixel glyph pattern reading "ICE · DRINK" in glass[6]/glass[5]
    ice_px = [16, 18, 19, 21, 22, 25, 26, 28, 30, 31]
    for gx in range(15, 33):
        if gx in ice_px:
            cv.p(gx, 5, ("glass", 6))
        elif gx == 24:
            cv.p(gx, 5, ("teal", 4))
        else:
            cv.p(gx, 5, ("glass", 4))

    # --- 3 Glass Doors & Chilled Interior (y=7..27, x=1..46) ---
    # Outer insulated cabinet stiles
    cv.vline(1, 7, 29, ("kuro", 2))
    cv.vline(46, 7, 29, ("kuro", 0))
    cv.hline(1, 46, 7, ("kuro", 0))

    doors = [
        (2, 15, 13),   # Door 1: x=2..15, handle at x=13
        (16, 31, 29),  # Door 2: x=16..31, handle at x=29
        (32, 45, 43),  # Door 3: x=32..45, handle at x=43
    ]

    for d_idx, (dx0, dx1, hx) in enumerate(doors):
        # Anodized dark-metal door frame
        cv.hline(dx0, dx1, 7, ("kuro", 2))
        cv.hline(dx0, dx1, 27, ("kuro", 1))
        cv.vline(dx0, 7, 27, ("kuro", 2))
        cv.vline(dx1, 7, 27, ("kuro", 0))

        wx0, wx1 = dx0 + 1, dx1 - 1
        # Chilled dark-blue glass interior backdrop + top LED tube (y=8)
        cv.rect(wx0, 8, wx1, 26, ("glass", 0))
        cv.hline(wx0, wx1, 8, ("glass", 5))
        cv.hline(wx0 + 1, wx1 - 1, 8, ("glass", 6))
        cv.hline(wx0, wx1, 9, ("glass", 1))

        # 4 horizontal wire shelves (y=12, 17, 22, 26)
        for sy in (12, 17, 22, 26):
            cv.hline(wx0, wx1, sy, ("steel", 4))
            for tx in range(wx0 + 1, wx1, 3):
                cv.p(tx, sy, ("coolwhite", 5))  # shelf price-label ticks

        # Populate drinks per door!
        # Can column x-starts (2px wide cans with 1px gap so each can reads individually!)
        cols = [c for c in range(wx0 + 1, wx1 - 2, 3)]

        if d_idx == 0:
            # Door 1: Monster green & RedBull blue/silver energy cans
            # Row 1 (y=9..11): Monster Black + Neon Green claw
            for cx in cols:
                cv.p(cx, 9, ("steel", 5))
                cv.p(cx + 1, 9, ("steel", 3))
                cv.p(cx, 10, ("kuro", 1))
                cv.p(cx + 1, 10, ("foliage", 6))
                cv.p(cx, 11, ("foliage", 5))
                cv.p(cx + 1, 11, ("kuro", 0))
            # Row 2 (y=13..16): RedBull Blue & Silver quartered slim cans
            for cx in cols:
                cv.p(cx, 13, ("steel", 6))
                cv.p(cx + 1, 13, ("blue", 4))
                cv.p(cx, 14, ("blue", 5))
                cv.p(cx + 1, 14, ("steel", 5))
                cv.p(cx, 15, ("red", 4))
                cv.p(cx + 1, 15, ("blue", 3))
                cv.p(cx, 16, ("blue", 4))
                cv.p(cx + 1, 16, ("steel", 4))
            # Row 3 (y=18..21): Monster Ultra White/Green & Hot6 Blue/Orange
            for i, cx in enumerate(cols):
                if i % 2 == 0:
                    cv.p(cx, 18, ("coolwhite", 5))
                    cv.p(cx + 1, 18, ("coolwhite", 4))
                    cv.p(cx, 19, ("foliage", 5))
                    cv.p(cx + 1, 19, ("coolwhite", 4))
                    cv.p(cx, 20, ("coolwhite", 5))
                    cv.p(cx + 1, 20, ("foliage", 4))
                    cv.p(cx, 21, ("coolwhite", 3))
                    cv.p(cx + 1, 21, ("coolwhite", 2))
                else:
                    cv.p(cx, 18, ("blue", 4))
                    cv.p(cx + 1, 18, ("blue", 3))
                    cv.p(cx, 19, ("orange", 5))
                    cv.p(cx + 1, 19, ("red", 4))
                    cv.p(cx, 20, ("blue", 4))
                    cv.p(cx + 1, 20, ("blue", 2))
                    cv.p(cx, 21, ("blue", 3))
                    cv.p(cx + 1, 21, ("blue", 1))
            # Row 4 (y=23..25): Lime/Green & Cobalt sports cans
            for i, cx in enumerate(cols):
                ramp = "foliage" if i < 2 else "blue"
                cv.p(cx, 23, ("steel", 5))
                cv.p(cx + 1, 23, (ramp, 5))
                cv.p(cx, 24, (ramp, 5))
                cv.p(cx + 1, 24, (ramp, 4))
                cv.p(cx, 25, (ramp, 4))
                cv.p(cx + 1, 25, (ramp, 3))

        elif d_idx == 1:
            # Door 2: Coke red, Fanta orange & Pocari cyan
            # Row 1 (y=9..11): Coca-Cola Red cans with white ribbon
            for cx in cols:
                cv.p(cx, 9, ("steel", 5))
                cv.p(cx + 1, 9, ("red", 4))
                cv.p(cx, 10, ("red", 5))
                cv.p(cx + 1, 10, ("white", 6))
                cv.p(cx, 11, ("red", 4))
                cv.p(cx + 1, 11, ("red", 3))
            # Row 2 (y=13..16): Fanta Orange & Chilsung Cider Green
            for i, cx in enumerate(cols):
                if i < 2:
                    cv.p(cx, 13, ("orange", 5))
                    cv.p(cx + 1, 13, ("steel", 4))
                    cv.p(cx, 14, ("orange", 5))
                    cv.p(cx + 1, 14, ("foliage", 4))
                    cv.p(cx, 15, ("orange", 4))
                    cv.p(cx + 1, 15, ("orange", 3))
                    cv.p(cx, 16, ("orange", 4))
                    cv.p(cx + 1, 16, ("orange", 2))
                else:
                    cv.p(cx, 13, ("green", 5))
                    cv.p(cx + 1, 13, ("green", 4))
                    cv.p(cx, 14, ("white", 6))
                    cv.p(cx + 1, 14, ("green", 4))
                    cv.p(cx, 15, ("green", 4))
                    cv.p(cx + 1, 15, ("green", 3))
                    cv.p(cx, 16, ("green", 3))
                    cv.p(cx + 1, 16, ("green", 2))
            # Row 3 (y=18..21): Pocari Sweat Cyan/Blue PET bottles with white caps
            for cx in cols:
                cv.p(cx, 18, ("white", 6))
                cv.p(cx + 1, 18, ("glass", 5))
                cv.p(cx, 19, ("blue", 4))
                cv.p(cx + 1, 19, ("white", 6))
                cv.p(cx, 20, ("glass", 5))
                cv.p(cx + 1, 20, ("blue", 4))
                cv.p(cx, 21, ("blue", 4))
                cv.p(cx + 1, 21, ("blue", 3))
            # Row 4 (y=23..25): Zero Cola & Berry sodas
            for i, cx in enumerate(cols):
                cv.p(cx, 23, ("steel", 5))
                cv.p(cx + 1, 23, ("kuro", 2))
                cv.p(cx, 24, ("red", 4) if i % 2 == 0 else ("orange", 4))
                cv.p(cx + 1, 24, ("kuro", 1))
                cv.p(cx, 25, ("red", 3) if i % 2 == 0 else ("orange", 3))
                cv.p(cx + 1, 25, ("kuro", 0))

        else:
            # Door 3: Canned coffees, Milkis & bottled water
            # Row 1 (y=9..11): Canned coffees (cedar/gold)
            for cx in cols:
                cv.p(cx, 9, ("yellow", 5))
                cv.p(cx + 1, 9, ("cedar", 4))
                cv.p(cx, 10, ("cedar", 5))
                cv.p(cx + 1, 10, ("cream", 5))
                cv.p(cx, 11, ("cedar", 4))
                cv.p(cx + 1, 11, ("cedar", 3))
            # Row 2 (y=13..16): Milkis creamy white/pastel bottles
            for i, cx in enumerate(cols):
                lbl = ("blue", 4) if i % 2 == 0 else ("pink", 4)
                cv.p(cx, 13, lbl)
                cv.p(cx + 1, 13, ("cream", 6))
                cv.p(cx, 14, ("cream", 6))
                cv.p(cx + 1, 14, ("cream", 5))
                cv.p(cx, 15, lbl)
                cv.p(cx + 1, 15, ("cream", 5))
                cv.p(cx, 16, ("cream", 5))
                cv.p(cx + 1, 16, ("cream", 4))
            # Row 3 (y=18..21): Corn-silk / Barley tea amber bottles
            for cx in cols:
                cv.p(cx, 18, ("cedar", 6))
                cv.p(cx + 1, 18, ("straw", 4))
                cv.p(cx, 19, ("cedar", 5))
                cv.p(cx + 1, 19, ("cream", 5))
                cv.p(cx, 20, ("cedar", 4))
                cv.p(cx + 1, 20, ("cedar", 3))
                cv.p(cx, 21, ("cedar", 3))
                cv.p(cx + 1, 21, ("cedar", 2))
            # Row 4 (y=23..25): Bottled mineral water (teal/glass clear)
            for cx in cols:
                cv.p(cx, 23, ("teal", 5))
                cv.p(cx + 1, 23, ("glass", 6))
                cv.p(cx, 24, ("glass", 5))
                cv.p(cx + 1, 24, ("teal", 4))
                cv.p(cx, 25, ("teal", 4))
                cv.p(cx + 1, 25, ("glass", 4))

        # Diagonal glass[4..6] specular reflections across each door pane!
        rx, ry = wx0 + 1, 9
        for step, sh in [(0, 6), (1, 6), (2, 5), (3, 4)]:
            cv.p(rx + step, ry + step, ("glass", sh))
        for step, sh in [(0, 5), (1, 4), (2, 4)]:
            cv.p(rx + step, ry + 5 + step, ("glass", sh))

        # Vertical chrome pull handle (y=13..20 at x=hx)
        cv.p(hx, 13, ("steel", 6))
        cv.vline(hx, 14, 19, ("steel", 5))
        cv.p(hx, 20, ("steel", 3))
        cv.p(hx + 1, 13, ("kuro", 0))
        cv.p(hx + 1, 20, ("kuro", 0))

    # --- Bottom Dark Ventilation Grille & 4 Sturdy Leveling Feet (y=28..31) ---
    cv.rect(1, 28, 46, 29, ("kuro", 1))
    cv.vline(46, 28, 29, ("kuro", 0))
    for gx in range(3, 40):
        if gx % 2 == 0:
            cv.p(gx, 28, ("kuro", 0))
            cv.p(gx, 29, ("steel", 1))
    # Digital thermostat green/cyan status LED on bottom right
    cv.p(42, 28, ("teal", 5))
    cv.p(43, 28, ("glass", 6))

    # Under-cabinet floor shadow + 4 sturdy leveling feet (stepped bottom!)
    cv.hline(4, 43, 30, ("ink", 0))
    cv.hline(5, 42, 31, ("ink", 0))
    feet = [(3, 6), (15, 17), (30, 32), (41, 44)]
    for fx0, fx1 in feet:
        cv.hline(fx0, fx1, 30, ("steel", 2))
        cv.p(fx0, 30, ("steel", 3))
        cv.hline(fx0, fx1, 31, ("kuro", 0))

    return cv.im


def build_snack_rack(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    """3. pcb3-snack-rack.png (32x32): 4-Tier Cup-Ramen & Snack Gondola Display Rack."""
    cv = Canvas(32, 32, ramps)

    # --- Rounded Top Promotional Sign Header (y=2..6, x=3..28) ---
    cv.hline(5, 26, 2, ("kuro", 1))            # rounded/stepped top edge
    cv.p(4, 3, ("kuro", 1))
    cv.hline(5, 26, 3, ("orange", 5))          # top-lit orange rim
    cv.p(27, 3, ("kuro", 0))

    cv.rect(3, 4, 28, 5, ("red", 3))           # warm red/orange "RAMEN" header board
    cv.vline(3, 4, 5, ("kuro", 1))
    cv.vline(28, 4, 5, ("kuro", 0))
    cv.hline(4, 27, 4, ("orange", 4))
    # Cute mini noodle-cup icon (x=5..7, y=4..5) + crisp "RAMEN" pixel letters (x=10..24)
    cv.hline(5, 7, 4, ("yellow", 5))
    cv.hline(5, 7, 5, ("white", 6))
    for lx in (10, 11, 13, 14, 16, 17, 18, 20, 21, 23, 24):
        cv.p(lx, 4, ("yellow", 5))
        cv.p(lx, 5, ("white", 6) if lx % 2 == 0 else ("orange", 5))

    # --- 3/4 Visible Top Shelf Canopy & Side Uprights (y=6..26, x=2..29) ---
    # 3/4 top steel canopy plane (y=6..7)
    cv.p(2, 6, ("steel", 2))
    cv.hline(3, 28, 6, ("kawara", 4))
    cv.p(29, 6, ("steel", 0))
    cv.hline(3, 28, 7, ("kawara", 2))

    # Left & right dark-steel gondola uprights (x=2..3 and x=28..29, y=7..27)
    for y in range(7, 28):
        cv.p(2, y, ("steel", 1))
        cv.p(3, y, ("steel", 3) if y % 5 != 0 else ("steel", 4))
        cv.p(28, y, ("steel", 2) if y % 5 != 0 else ("steel", 3))
        cv.p(29, y, ("steel", 0))

    # Interior back panel shadow (x=4..27, y=8..26)
    cv.rect(4, 8, 27, 26, ("kuro", 1))
    for y in (8, 12, 17, 22):
        cv.hline(4, 27, y, ("kuro", 0))        # under-shelf shadow band

    def draw_shelf_rail(sy: int, tag_xs: list[int]) -> None:
        cv.hline(3, 28, sy, ("steel", 4))
        cv.p(3, sy, ("steel", 5))
        cv.p(28, sy, ("steel", 2))
        for tx in tag_xs:
            cv.p(tx, sy, ("coolwhite", 5))
            cv.p(tx + 1, sy, ("yellow", 4))

    # --- TIER 1 (y=7..11): Tapered Small Cup Ramens (Shin, Cheese, Jin, Jjapaghetti, Sesame) ---
    cups_t1 = [
        (4, ("red", 5), ("red", 4), ("kuro", 1)),           # Shin Ramyun
        (9, ("yellow", 5), ("yellow", 4), ("orange", 4)),   # Cheese Ramen
        (14, ("blue", 5), ("blue", 4), ("yellow", 5)),      # Jin Ramen
        (19, ("foliage", 5), ("foliage", 4), ("cedar", 3)), # Jjapaghetti
        (24, ("orange", 5), ("red", 4), ("yellow", 4)),     # Sesame Ramen
    ]
    for cx, lid_c, band_c, acc_c in cups_t1:
        # 4px wide foil lid at y=7..8, tapered 2..3px white cup base at y=9..10!
        cv.hline(cx, cx + 3, 7, ("white", 6))
        cv.p(cx + 1, 7, lid_c)
        cv.p(cx + 2, 7, lid_c)
        cv.p(cx, 8, band_c)
        cv.p(cx + 1, 8, acc_c)
        cv.p(cx + 2, 8, band_c)
        cv.p(cx + 3, 8, ("coolwhite", 4))
        # Tapered cup body (cx+0..cx+3 with dark-back corners at y=10 for cup taper!)
        cv.p(cx, 9, ("coolwhite", 5))
        cv.p(cx + 1, 9, band_c)
        cv.p(cx + 2, 9, ("coolwhite", 5))
        cv.p(cx + 3, 9, ("coolwhite", 3))
        cv.p(cx + 1, 10, ("coolwhite", 5))
        cv.p(cx + 2, 10, ("coolwhite", 4))

    draw_shelf_rail(11, [5, 10, 15, 20, 25])

    # --- TIER 2 (y=12..16): Wide Big-Bowl Ramens (Buldak, Yukgaejang, Udon, Rose Buldak) ---
    bowls_t2 = [
        (4, 8, ("kuro", 2), ("red", 4), ("white", 6)),      # Buldak Black
        (10, 14, ("red", 4), ("orange", 4), ("cream", 6)),  # Yukgaejang Sabalmyeon
        (16, 20, ("navy", 3), ("yellow", 5), ("white", 6)), # Tempura Udon
        (22, 27, ("pink", 4), ("pink", 5), ("white", 6)),   # Rose / Carbonara Buldak
    ]
    for bx0, bx1, body_c, acc_c, lid_c in bowls_t2:
        cv.hline(bx0, bx1, 13, lid_c)                       # wide bowl lid
        cv.p(bx0 + 1, 13, acc_c)
        cv.p(bx1 - 1, 13, acc_c)
        cv.hline(bx0, bx1, 14, body_c)
        cv.p((bx0 + bx1) // 2, 14, acc_c)
        cv.p(bx0, 14, ("coolwhite", 5))
        # Tapered bottom at y=15
        cv.hline(bx0 + 1, bx1 - 1, 15, ("coolwhite", 4))
        cv.p(bx0 + 1, 15, body_c)

    draw_shelf_rail(16, [5, 11, 17, 24])

    # --- TIER 3 (y=17..21): Puffed Snack Bags (Honey Butter, Shrimp, Onion, Nacho) ---
    bags_t3 = [
        (4, 8, ("yellow", 5), ("yellow", 4), ("cedar", 4)),   # Honey Butter Chip
        (10, 14, ("pink", 4), ("pink", 3), ("white", 6)),     # Saewookkang Shrimp
        (16, 20, ("teal", 5), ("teal", 3), ("yellow", 5)),    # Onion Rings
        (22, 27, ("orange", 5), ("orange", 3), ("red", 3)),   # Nacho Cheese
    ]
    for bx0, bx1, hi_c, mid_c, logo_c in bags_t3:
        # Crimped top seal + puffed middle + crimped bottom!
        cv.hline(bx0, bx1, 17, hi_c)
        cv.p(bx0, 18, hi_c)
        cv.hline(bx0 + 1, bx1 - 1, 18, mid_c)
        cv.p((bx0 + bx1) // 2, 18, logo_c)
        cv.p(bx1, 18, mid_c)
        # Indented waist/corners so bags look puffy, not brick-flat
        cv.hline(bx0, bx1, 19, mid_c)
        cv.p(bx0 + 1, 19, hi_c)
        cv.p((bx0 + bx1) // 2, 19, ("white", 6))
        cv.hline(bx0, bx1, 20, mid_c)
        cv.p(bx1, 20, ("kuro", 1))

    draw_shelf_rail(21, [5, 11, 17, 24])

    # --- TIER 4 (y=22..26): Potato Chips & Choco Snack Packs ---
    bags_t4 = [
        (4, 8, ("red", 5), ("red", 3), ("yellow", 5)),        # Swing Chip
        (10, 14, ("blue", 5), ("blue", 3), ("white", 6)),     # PocaChip Blue
        (16, 20, ("cedar", 5), ("cedar", 3), ("yellow", 4)),  # Homerun Ball Choco
        (22, 27, ("cream", 6), ("cream", 4), ("orange", 4)),  # Caramel Corn
    ]
    for bx0, bx1, hi_c, mid_c, logo_c in bags_t4:
        cv.hline(bx0, bx1, 22, hi_c)
        cv.hline(bx0, bx1, 23, mid_c)
        cv.p(bx0 + 1, 23, hi_c)
        cv.p((bx0 + bx1) // 2, 23, logo_c)
        cv.hline(bx0, bx1, 24, mid_c)
        cv.p((bx0 + bx1) // 2, 24, ("white", 5))
        cv.hline(bx0 + 1, bx1 - 1, 25, mid_c)

    draw_shelf_rail(26, [5, 11, 17, 24])

    # --- Deep Dark Base Storage Drawer & Caster Feet (y=27..31) ---
    cv.rect(2, 27, 29, 29, ("kuro", 1))
    cv.hline(2, 29, 27, ("kuro", 2))
    cv.vline(2, 27, 29, ("kuro", 2))
    cv.vline(29, 27, 29, ("kuro", 0))
    cv.vline(15, 27, 29, ("kuro", 0))          # center drawer split
    cv.vline(16, 27, 29, ("kuro", 2))
    # Chrome drawer handles
    cv.hline(7, 10, 28, ("steel", 4))
    cv.hline(21, 24, 28, ("steel", 4))
    cv.hline(3, 28, 29, ("kuro", 0))

    # Caster feet + under-rack floor shadow (y=30..31)
    cv.hline(5, 26, 30, ("ink", 0))
    cv.hline(6, 25, 31, ("ink", 0))
    for wx0, wx1 in [(4, 6), (25, 27)]:
        cv.hline(wx0, wx1, 30, ("steel", 2))
        cv.p(wx0, 30, ("steel", 4))
        cv.hline(wx0, wx1, 31, ("kuro", 0))

    return cv.im


def build_ramen_bar(ramps: dict[str, list[tuple[int, int, int, int]]]) -> Image.Image:
    """4. pcb3-ramen-bar.png (48x32): Self-Serve Hangang Ramen Bar & Ice-Water Purifier."""
    cv = Canvas(48, 32, ramps)

    # =========================================================================
    # LEFT 2 TILES (x=1..31): Self-Serve Hangang Ramen Induction Counter
    # Organic stepped profile: steam at y=3..6, backsplash y=5..9, counter y=10..30
    # =========================================================================

    # 1) Back splash rail (x=1..31, y=5..9)
    cv.hline(2, 30, 5, ("kawara", 4))          # 3/4 top bevel of backsplash
    cv.hline(2, 16, 5, ("steel", 4))           # top-left bright metallic highlight
    cv.rect(1, 6, 31, 9, ("kawara", 2))
    cv.vline(1, 6, 9, ("kawara", 3))
    cv.vline(31, 6, 9, ("kuro", 0))
    cv.hline(2, 30, 9, ("kuro", 1))

    # Step-by-step "1 · 2 · 3" LED instruction icons on backsplash (x=3..20, y=6..8)
    steps = [
        (3, 6, ("glass", 6), ("teal", 4)),     # Step 1: Scan barcode
        (9, 12, ("yellow", 5), ("orange", 4)), # Step 2: Add water & boil
        (15, 18, ("coolwhite", 5), ("green", 4)),  # Step 3: Enjoy
    ]
    for sx0, sx1, top_c, bot_c in steps:
        cv.rect(sx0, 6, sx1, 8, ("kuro", 0))
        cv.p(sx0 + 1, 6, top_c)
        cv.p(sx0 + 2, 6, ("white", 6))
        cv.p(sx0 + 1, 7, bot_c)
        cv.p(sx0 + 2, 7, bot_c)
    # Arrow dots between steps
    cv.p(7, 7, ("coolwhite", 4))
    cv.p(13, 7, ("coolwhite", 4))

    # Wooden chopstick & napkin caddy on right of backsplash (x=22..29, y=4..10)
    # Chopsticks sticking up at x=23..25, y=4..6 + white napkins at x=27..28, y=5..6
    cv.vline(23, 4, 6, ("cedar", 6))
    cv.vline(24, 4, 6, ("cedar", 5))
    cv.vline(25, 5, 6, ("cedar", 4))
    cv.rect(27, 5, 28, 6, ("white", 6))
    cv.p(28, 6, ("coolwhite", 4))
    # Warm cedar caddy box (x=22..29, y=7..10)
    cv.rect(22, 7, 29, 10, ("cedar", 3))
    cv.hline(22, 29, 7, ("cedar", 5))
    cv.vline(22, 7, 10, ("cedar", 4))
    cv.vline(29, 7, 10, ("wood", 1))
    cv.vline(26, 7, 10, ("wood", 2))           # divider between chopsticks & napkins
    cv.hline(22, 29, 10, ("wood", 1))

    # 2) 3/4 Stainless-and-Slate Countertop (x=1..31, y=10..17)
    for y in range(10, 16):
        sh = 5 if y in (10, 15) else 4
        cv.hline(2, 30, y, ("steel", sh))
        cv.p(1, y, ("kawara", 3))
        cv.p(31, y, ("kuro", 1))
    # Slate rear band & subtle stainless sheen
    cv.hline(2, 21, 10, ("kawara", 3))
    cv.hline(2, 30, 16, ("steel", 6))          # crisp bright stainless bullnose front!
    cv.p(1, 16, ("steel", 4))
    cv.p(31, 16, ("steel", 2))
    cv.hline(1, 31, 17, ("kuro", 0))           # under-counter overhang shadow

    # Water dispense spouts behind both cookers (x=8, x=19 at y=9..10)
    for spx in (8, 19):
        cv.p(spx, 9, ("steel", 6))
        cv.p(spx + 1, 9, ("steel", 3))
        cv.p(spx, 10, ("steel", 4))

    # COOKER 1 (x=3..13, y=8..15): Simmering Hangang White Foil/Paper Ramen Bowl!
    # Induction base housing (x=3..13, y=12..15)
    cv.rect(3, 12, 13, 15, ("kuro", 0))
    cv.hline(4, 12, 15, ("kuro", 2))
    cv.p(5, 15, ("red", 5))                    # active heating LED
    cv.p(6, 15, ("orange", 5))
    cv.p(11, 15, ("yellow", 5))

    # White square/tapered Hangang foil bowl (x=4..12, y=8..14)
    cv.hline(5, 11, 8, ("white", 6))           # back white rim
    cv.p(4, 9, ("white", 6))
    cv.p(12, 9, ("coolwhite", 4))
    cv.vline(4, 10, 12, ("white", 6))          # left lit rim
    cv.vline(12, 10, 12, ("coolwhite", 4))     # right shaded rim
    cv.hline(4, 12, 13, ("white", 6))          # front top rim
    cv.hline(5, 11, 14, ("coolwhite", 3))      # tapered paper bowl front wall

    # Rich golden-red simmering ramen inside bowl (x=5..11, y=9..12)
    cv.rect(5, 9, 11, 12, ("red", 4))
    # Wavy golden noodles, bubbling orange broth, green scallion & soft-boiled egg!
    ramen_pixels = [
        (5, 9, ("orange", 4)), (6, 9, ("yellow", 5)), (7, 9, ("orange", 5)),
        (9, 9, ("white", 6)), (10, 9, ("orange", 5)),   # soft-boiled egg half!
        (6, 10, ("yellow", 4)), (7, 10, ("yellow", 5)), (8, 10, ("foliage", 5)),
        (9, 10, ("white", 5)), (10, 10, ("red", 4)),
        (5, 11, ("yellow", 5)), (6, 11, ("orange", 4)), (8, 11, ("yellow", 5)),
        (9, 11, ("foliage", 6)), (10, 11, ("yellow", 4)),
        (6, 12, ("orange", 5)), (7, 12, ("red", 4)), (9, 12, ("orange", 4)),
    ]
    for rx, ry, rcol in ramen_pixels:
        cv.p(rx, ry, rcol)

    # 3 crisp coolwhite[4] steam pixels rising in open air at y=3..6!
    cv.p(6, 6, ("coolwhite", 4))
    cv.p(9, 5, ("coolwhite", 4))
    cv.p(7, 3, ("coolwhite", 4))

    # COOKER 2 (x=15..25, y=11..15): Glossy Black Induction Plate + Glowing Red "03:00" Timer!
    cv.rect(15, 11, 25, 15, ("kuro", 0))
    cv.vline(15, 11, 14, ("kuro", 2))
    # Glossy induction glass plate (x=16..24, y=11..13) with circular induction coil ring
    cv.rect(16, 11, 24, 13, ("kuro", 1))
    for cx, cy in [(18, 11), (19, 11), (20, 11), (21, 11),
                   (18, 13), (19, 13), (20, 13), (21, 13),
                   (17, 12), (22, 12)]:
        cv.p(cx, cy, ("kawara", 2))
    cv.p(16, 11, ("glass", 4))                 # specular glass glint
    cv.p(17, 12, ("glass", 3))
    # Glowing red "03:00" LED timer strip (y=14) + green start button
    cv.p(17, 14, ("red", 5))
    cv.p(18, 14, ("orange", 5))
    cv.p(19, 14, ("red", 3))                   # colon separator
    cv.p(20, 14, ("red", 5))
    cv.p(21, 14, ("red", 4))
    cv.p(23, 14, ("foliage", 5))               # green start button

    # 3) Lower Cabinet (x=1..31, y=18..30): Trash Chute & Bowl/Tray Storage Cubby
    cv.rect(1, 18, 31, 28, ("kuro", 1))
    cv.hline(2, 30, 18, ("kawara", 2))
    cv.vline(1, 18, 29, ("kuro", 2))
    cv.vline(15, 18, 28, ("kawara", 1))        # center cabinet stile
    cv.vline(31, 18, 29, ("kuro", 0))

    # Left bay (x=3..13, y=19..27): Stainless swing trash chute + waste cabinet door
    cv.rect(4, 19, 12, 22, ("steel", 3))
    cv.hline(4, 12, 19, ("steel", 5))
    cv.hline(5, 11, 21, ("ink", 0))            # swing-flap push seam
    cv.p(8, 20, ("foliage", 5))                # green recycling emblem
    cv.rect(4, 23, 12, 27, ("kuro", 2))
    cv.vline(11, 24, 26, ("steel", 4))         # door pull

    # Right bay (x=17..29, y=19..27): Open storage cubby with white bowls & serving trays
    cv.rect(17, 19, 29, 27, ("ink", 0))
    cv.hline(17, 29, 19, ("kuro", 0))
    # Neat stack of white Hangang paper bowls (x=18..22, y=21..27)
    for by in range(21, 28):
        cv.hline(18, 22, by, ("white", 6) if by % 2 == 1 else ("coolwhite", 4))
    # Neat stack of dark-wood serving trays (x=24..28, y=23..27)
    for ty in range(23, 28):
        cv.hline(24, 28, ty, ("cedar", 4) if ty % 2 == 1 else ("wood", 2))

    # Recessed kickplate (y=29..30, x=2..30) + grounded floor shadow (y=31)
    cv.hline(2, 30, 29, ("kuro", 0))
    cv.hline(2, 30, 30, ("ink", 0))
    cv.hline(3, 30, 31, ("ink", 0))

    # =========================================================================
    # RIGHT 1 TILE (x=32..46): Taller Commercial Ice & Water Purifier (y=2..30)
    # =========================================================================

    # 1) Beveled 3/4 Top Roof (x=32..44, y=2..6)
    cv.hline(33, 43, 2, ("steel", 3))          # beveled top rear edge
    cv.p(32, 3, ("steel", 4))
    cv.hline(33, 43, 3, ("steel", 5))          # bright brushed-chrome top highlight
    cv.p(44, 3, ("steel", 2))
    for y in range(4, 6):
        cv.p(32, y, ("steel", 4))
        cv.hline(33, 40, y, ("kawara", 4))
        cv.hline(41, 43, y, ("kawara", 3))
        cv.p(44, y, ("kuro", 1))
    cv.hline(32, 44, 6, ("steel", 5))          # crisp front top bevel!
    cv.p(44, 6, ("steel", 2))

    # 2) Purifier Tower Body (x=32..44, y=7..30)
    cv.rect(32, 7, 44, 28, ("kuro", 2))
    cv.vline(32, 7, 29, ("steel", 3))          # brushed-chrome left pillar edge
    cv.vline(33, 7, 28, ("steel", 4))
    cv.vline(43, 7, 28, ("kuro", 1))
    cv.vline(44, 7, 29, ("kuro", 0))

    # Upper Control Fascia (y=7..10): Ice / Cold / Hot glowing indicator dots!
    cv.rect(34, 7, 42, 10, ("kuro", 1))
    cv.p(35, 8, ("glass", 6))                  # ICE cyan-white dot
    cv.p(36, 8, ("glass", 5))
    cv.p(38, 8, ("blue", 5))                   # COLD water blue dot
    cv.p(39, 8, ("blue", 4))
    cv.p(41, 8, ("red", 5))                    # HOT water red-amber dot
    cv.p(35, 9, ("steel", 4))                  # dispense touch levers
    cv.p(38, 9, ("steel", 4))
    cv.p(41, 9, ("steel", 3))

    # 3) Recessed Dispensing Alcove (x=34..42, y=11..20)
    cv.rect(34, 11, 42, 19, ("ink", 0))
    cv.rect(35, 13, 41, 19, ("glass", 1))      # cool blue-lit dispensing chamber
    cv.hline(34, 42, 11, ("kuro", 0))

    # Stainless dispense nozzle (x=37..39, y=11..12) + shimmering ice-water stream!
    cv.hline(37, 39, 11, ("steel", 5))
    cv.p(38, 12, ("steel", 6))
    cv.p(38, 13, ("glass", 6))                 # falling water stream
    cv.p(38, 14, ("glass", 5))

    # Clear cup filling with ice water on drip grate (x=36..40, y=15..19)
    cv.hline(36, 40, 15, ("white", 6))         # clear cup top rim
    cv.p(36, 16, ("glass", 6))
    cv.p(37, 16, ("white", 6))                 # floating ice cube!
    cv.p(38, 16, ("glass", 5))
    cv.p(39, 16, ("white", 6))                 # floating ice cube!
    cv.p(40, 16, ("glass", 4))
    for cy in range(17, 20):
        cv.p(36, cy, ("glass", 5))
        cv.p(37, cy, ("glass", 6) if cy == 17 else ("blue", 4))
        cv.p(38, cy, ("glass", 5))
        cv.p(39, cy, ("blue", 4))
        cv.p(40, cy, ("glass", 3))

    # Perforated stainless drip tray grate (x=34..42, y=20)
    for gx in range(34, 43):
        cv.p(gx, 20, ("steel", 5) if gx % 2 == 0 else ("kuro", 0))

    # Lower Purifier Service Panel (y=21..28) & Plinth (y=29..31)
    cv.hline(34, 42, 21, ("steel", 3))
    cv.rect(34, 22, 42, 27, ("kuro", 2))
    cv.vline(34, 22, 27, ("kuro", 3))
    cv.vline(42, 22, 27, ("kuro", 1))
    cv.hline(35, 41, 28, ("kuro", 1))
    # Purifier base plinth + leveling feet
    cv.hline(32, 44, 29, ("kuro", 0))
    cv.hline(33, 43, 30, ("ink", 0))
    cv.hline(33, 35, 30, ("steel", 2))
    cv.hline(41, 43, 30, ("steel", 2))
    cv.hline(33, 43, 31, ("ink", 0))

    # 4) Side Paper-Cup Dispenser Tube mounted on right wall (x=45..46, y=7..20)
    cv.hline(45, 46, 7, ("steel", 4))          # chrome top cap
    for ty in range(8, 19):
        # Clear acrylic tube showing stacked white paper cups inside!
        cv.p(45, ty, ("white", 6) if ty % 2 == 0 else ("glass", 5))
        cv.p(46, ty, ("coolwhite", 3) if ty % 2 == 0 else ("glass", 3))
    cv.hline(45, 46, 19, ("steel", 3))         # chrome bottom dispenser throat
    cv.p(45, 20, ("white", 5))                 # ready cup rim peeking out bottom!

    return cv.im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ramps = load_ramps(PALETTE_PATH)
    allowed_rgb = load_palette(PALETTE_PATH)

    builders = [
        ("pcb3-counter-pos", build_counter_pos),
        ("pcb3-drink-triple", build_drink_triple),
        ("pcb3-snack-rack", build_snack_rack),
        ("pcb3-ramen-bar", build_ramen_bar),
    ]

    all_ok = True
    for name, fn in builders:
        im = fn(ramps)
        out_1x = OUT_DIR / f"{name}.png"
        out_4x = OUT_DIR / f"{name}-x4.png"
        im.save(out_1x)
        im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST).save(out_4x)

        rep = verify_sprite(out_1x, allowed_rgb=allowed_rgb, forbid_pure_black=True)
        print(
            f"{name}.png: {rep.width}x{rep.height} | opaque={rep.opaque_pixels} | "
            f"unique_colors={rep.unique_colors} | pv={rep.palette_violations} | "
            f"av={rep.alpha_violations} | pure_black={rep.pure_black_pixels} | "
            f"ok={rep.ok} | errors={list(rep.errors)}"
        )
        if not rep.ok:
            all_ok = False

    if not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
