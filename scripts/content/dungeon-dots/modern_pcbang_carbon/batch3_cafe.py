#!/usr/bin/env python3
"""
Batch 3/4: Museum-Grade Modern Korean PC Bang Cafe & Counter Objects
Sprites:
  1. pos_counter_desk.png     (48x32, standing)
  2. ramen_cooker_counter.png (32x32, standing)
  3. drink_fridge_glass.png   (16x32, standing)
  4. snack_shelf_rack.png     (32x32, standing)
  5. trash_recycle_bin.png    (16x16, standing)

100% locked to modern_palette_v3.json (118 colors) + #4c557f alpha=85 shadow.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
PALETTE_PATH = REFS_DIR / "modern_palette_v3.json"
CHAR_REF_PATH = REFS_DIR / "ref_mod1_char.png"

OUT_DIR = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PATH = OUT_DIR / "preview_batch3.png"

with open(PALETTE_PATH, "r", encoding="utf-8") as f:
    PAL_DATA = json.load(f)

ALL_HEX = {c.lower() for c in PAL_DATA["all_colors"]}
SHADOW_RGBA = tuple(PAL_DATA["shadow_rgba"])  # (76, 85, 127, 85)
TRANSPARENT = (0, 0, 0, 0)

# Darkest shade [0] of the material ramps allowed on outer 1px outline
DARK_OUTLINE_HEX = {
    "#141622",  # cool_slate_gray[0] - dark steel / slate / bezel
    "#111c2e",  # cobalt_blue[0] - dark navy cabinet / cobalt lid
    "#11272e",  # sky_cerulean[0] - sky-blue glowing sign
    "#112e2a",  # cyan_teal[0] - cyan accent
    "#172e11",  # emerald_green[0] - emerald recycle lid
    "#2e1119",  # crimson_red[0] - crimson header
    "#2e1111",  # rust_orange[0] - rust/terracotta
    "#2e1a11",  # amber_ochre[0] - warm brass/oak
    "#2e2111",  # gold_yellow[0] - dark gold
    "#0d0805",  # dark_wood_earth[0] - deep oak wood
}


def hx(c: str) -> tuple[int, int, int, int]:
    c = c.lower()
    assert c in ALL_HEX, f"Off-palette color used: {c}"
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)


def rgb_to_hex(rgba: tuple[int, int, int, int]) -> str:
    return f"#{rgba[0]:02x}{rgba[1]:02x}{rgba[2]:02x}"


class Canvas:
    def __init__(self, w: int, h: int):
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()

    def set(self, x: int, y: int, c: str | tuple[int, int, int, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = hx(c) if isinstance(c, str) else c

    def shadow(self, x: int, y: int) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if self.px[x, y][3] == 0:
                self.px[x, y] = SHADOW_RGBA

    def hline(self, x0: int, x1: int, y: int, c: str) -> None:
        rgba = hx(c)
        for x in range(x0, x1 + 1):
            if 0 <= x < self.w and 0 <= y < self.h:
                self.px[x, y] = rgba

    def vline(self, x: int, y0: int, y1: int, c: str) -> None:
        rgba = hx(c)
        for y in range(y0, y1 + 1):
            if 0 <= x < self.w and 0 <= y < self.h:
                self.px[x, y] = rgba

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: str) -> None:
        rgba = hx(c)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < self.w and 0 <= y < self.h:
                    self.px[x, y] = rgba


# ---------------------------------------------------------------------------
# 1. pos_counter_desk.png (48x32, standing, target opaque ~44-46 x 28-30)
# ---------------------------------------------------------------------------
def draw_pos_counter_desk() -> Image.Image:
    c = Canvas(48, 32)

    # --- A. Polished Light-Slate / Marble Overhang Countertop (y=9..15, x=1..46) ---
    # Generous 3/4 top band (~1/4 of desk height) with 1px wider overhang than navy fascia!
    c.hline(2, 45, 9, "#141622")   # chamfered back outline
    c.vline(1, 10, 15, "#141622")  # left overhang outline
    c.vline(46, 10, 15, "#141622") # right overhang outline

    # Polished light-slate marble top plane (y=10..13) + crisp bullnose front lip (y=14)
    c.hline(2, 45, 10, "#fafaf8")  # brilliant top-edge bevel highlight
    c.hline(32, 45, 10, "#e2e4e8")
    c.hline(2, 45, 11, "#e2e4e8")
    c.hline(2, 14, 11, "#fafaf8")  # top-left specular gleam
    c.hline(2, 45, 12, "#e2e4e8")
    c.hline(24, 45, 12, "#bec0c8")
    c.hline(2, 45, 13, "#bec0c8")
    c.hline(2, 12, 13, "#e2e4e8")
    # Subtle natural diagonal marble veining across the polished stone top
    for vx, vy in [(17, 10), (18, 11), (19, 12), (27, 11), (28, 12), (35, 11), (36, 12), (43, 12)]:
        c.set(vx, vy, "#9698a4")
    for vx, vy in [(19, 10), (20, 11), (36, 10), (37, 11)]:
        c.set(vx, vy, "#fafaf8")

    # Sculpted marble front bullnose lip (y=14) + dark overhang recess bevel (y=15)
    c.hline(2, 45, 14, "#9698a4")
    c.hline(2, 16, 14, "#bec0c8")
    c.set(2, 14, "#fafaf8")
    c.hline(37, 45, 14, "#707282")
    c.hline(2, 45, 15, "#2e3040")

    # --- B. Countertop Gadgets (sculpted upper silhouette y=2..13!) ---
    # 1) Tilted Sleek POS Touchscreen Terminal (x=6..18, y=2..12)
    c.hline(7, 17, 2, "#141622")  # rounded top corners
    c.vline(6, 3, 9, "#141622")
    c.vline(18, 3, 9, "#141622")
    c.hline(7, 17, 10, "#141622")
    # Inner metallic bezel (x=7..17, y=3..9)
    c.hline(7, 17, 3, "#707282")
    c.set(7, 3, "#bec0c8")
    c.vline(7, 4, 9, "#4e5062")
    c.vline(17, 4, 9, "#2e3040")
    c.hline(8, 16, 9, "#2e3040")
    c.set(12, 9, "#61d85b")  # green status LED

    # Glowing Cyan POS Screen (x=8..16, y=4..8) + soft diagonal glass reflection
    c.rect(8, 4, 16, 8, "#1b9490")
    c.hline(8, 16, 4, "#18504a")
    c.set(8, 4, "#5bd4d8")
    c.vline(8, 5, 8, "#29b6b6")
    c.rect(10, 5, 13, 7, "#5bd4d8")
    # Crisp 2-tone diagonal glass reflection
    for gx, gy in [(9, 4), (10, 5), (11, 6)]:
        c.set(gx, gy, "#fafaf8")
    for gx, gy in [(12, 7), (13, 8), (10, 4), (11, 5), (12, 6)]:
        c.set(gx, gy, "#9af4fa")
    # Checkout UI buttons
    c.set(15, 5, "#fae79a")
    c.set(16, 5, "#d8b55b")
    c.set(15, 7, "#61d85b")
    c.set(16, 7, "#35b629")
    c.set(15, 8, "#1c726c")
    c.set(16, 8, "#18504a")

    # POS Stand Neck & Base resting on the marble plane (y=11..12)
    c.rect(11, 11, 13, 11, "#4e5062")
    c.set(11, 11, "#9698a4")
    c.set(13, 11, "#2e3040")
    c.hline(9, 15, 12, "#4e5062")
    c.hline(9, 11, 12, "#9698a4")
    c.set(15, 12, "#2e3040")
    c.hline(9, 15, 13, "#707282")  # subtle contact shadow on marble

    # 2) Compact Thermal Receipt Printer with White Paper Slip (x=21..27, y=5..12)
    c.hline(22, 26, 5, "#141622")
    c.vline(21, 6, 11, "#141622")
    c.vline(27, 6, 11, "#141622")
    # Crisp white paper receipt emerging from top slot (y=6..7)
    c.hline(22, 25, 6, "#fafaf8")
    c.set(26, 6, "#bec0c8")
    c.hline(22, 25, 7, "#e2e4e8")
    c.set(23, 7, "#9698a4")
    c.set(25, 7, "#9698a4")
    c.set(26, 7, "#707282")
    # Sleek charcoal-silver printer body (y=8..11)
    c.hline(22, 26, 8, "#9698a4")
    c.set(22, 8, "#e2e4e8")
    c.hline(22, 26, 9, "#707282")
    c.hline(22, 26, 10, "#4e5062")
    c.set(25, 10, "#61d85b")  # green ready LED
    c.set(26, 10, "#2e3040")
    c.hline(22, 26, 11, "#2e3040")
    c.hline(21, 27, 12, "#707282")

    # 3) Angled IC Card Reader / NFC Pad (x=29..34, y=7..12)
    c.hline(30, 33, 7, "#141622")
    c.vline(29, 8, 11, "#141622")
    c.vline(34, 8, 11, "#141622")
    c.set(30, 8, "#9698a4")
    c.set(31, 8, "#9af4fa")  # lit NFC screen
    c.set(32, 8, "#5bd4d8")
    c.set(33, 8, "#4e5062")
    c.set(30, 9, "#707282")
    c.set(31, 9, "#fae79a")  # keypad / IC slot
    c.set(32, 9, "#d8b55b")
    c.set(33, 9, "#2e3040")
    c.hline(30, 33, 10, "#4e5062")
    c.set(33, 10, "#2e3040")
    c.hline(30, 33, 11, "#2e3040")
    c.hline(29, 34, 12, "#707282")

    # 4) Takeout Iced Coffee Cup with Clear Dome Lid, Kraft Sleeve & Angled Straw (x=38..43, y=4..12)
    c.hline(40, 41, 4, "#141622")
    c.set(39, 5, "#141622")
    c.set(40, 5, "#61d85b")  # bright mint-green cafe straw!
    c.set(41, 5, "#141622")
    # Clear dome lid (y=6..7)
    c.set(38, 6, "#141622")
    c.set(39, 6, "#fafaf8")
    c.set(40, 6, "#9af4fa")
    c.set(41, 6, "#e2e4e8")
    c.set(42, 6, "#141622")
    c.vline(38, 7, 10, "#141622")
    c.vline(42, 7, 10, "#141622")
    c.hline(39, 41, 7, "#fafaf8")  # white cup lip
    # White takeout cup + warm kraft sleeve + tapered bottom
    c.set(39, 8, "#fafaf8")
    c.set(40, 8, "#e6aa82")  # kraft sleeve
    c.set(41, 8, "#b77246")
    c.set(39, 9, "#fad6b4")
    c.set(40, 9, "#d99350")
    c.set(41, 9, "#86472c")
    c.set(39, 10, "#fafaf8")  # white cup base below sleeve
    c.set(40, 10, "#e2e4e8")
    c.set(41, 10, "#9698a4")
    c.hline(39, 41, 11, "#141622")  # tapered 3px cup base!
    c.hline(39, 41, 12, "#707282")

    # --- C. Deep Sculpted Navy/Slate Paneled Front Face (y=16..28, x=2..45) ---
    c.vline(2, 16, 29, "#111c2e")
    c.vline(45, 16, 29, "#111c2e")

    # Glowing Cyan LED Accent Strip beneath the countertop overhang (y=16..17)
    c.hline(3, 44, 16, "#5bd4d8")
    for lx in [6, 7, 8, 9, 17, 18, 19, 28, 29, 30, 38, 39, 40, 41]:
        c.set(lx, 16, "#9af4fa")
    for sx in [3, 13, 23, 24, 34, 44]:
        c.set(sx, 16, "#1b9490")
    c.hline(3, 44, 17, "#1b6c94")
    for lx in range(5, 43):
        if lx not in (13, 14, 23, 24, 33, 34):
            c.set(lx, 17, "#2982b6")

    # Main Navy/Cobalt Architectural Fascia (y=18..28, x=3..44)
    c.rect(3, 18, 44, 28, "#1c3772")
    c.hline(3, 44, 18, "#294db6")
    c.vline(3, 18, 27, "#294db6")
    c.vline(44, 19, 28, "#182c50")
    c.hline(3, 44, 28, "#182c50")

    # 4 Cohesive Sculpted Coffered Architectural Panels: (5..12), (15..22), (25..32), (35..42)
    panel_ranges = [(5, 12), (15, 22), (25, 32), (35, 42)]
    for s0, s1 in [(13, 14), (23, 24), (33, 34)]:
        c.vline(s0, 18, 27, "#294db6")
        c.vline(s1, 18, 27, "#182c50")
        c.set(s0, 18, "#5b76d8")

    for px0, px1 in panel_ranges:
        # Outer recess groove: top & left dark (#111c2e), bottom & right lit (#5b76d8 / #294db6)
        c.hline(px0, px1, 19, "#111c2e")
        c.vline(px0, 19, 26, "#111c2e")
        c.hline(px0 + 1, px1, 26, "#5b76d8")
        c.vline(px1, 20, 26, "#294db6")
        c.set(px1, 26, "#9aacfa")

        # Inner raised beveled coffer field (px0+1..px1-1, y=20..25)
        c.rect(px0 + 1, 20, px1 - 1, 25, "#1b3e94")
        c.hline(px0 + 1, px1 - 2, 20, "#294db6")
        c.vline(px0 + 1, 20, 24, "#294db6")
        c.set(px0 + 1, 20, "#5b76d8")
        c.set(px0 + 2, 21, "#294db6")  # subtle diagonal inner bevel sheen
        c.hline(px0 + 2, px1 - 1, 25, "#182c50")
        c.vline(px1 - 1, 21, 25, "#182c50")

    # --- D. Stepped Stainless Kickplate Plinth & Ground Shadow (y=29..31) ---
    c.set(1, 29, "#141622")
    c.set(46, 29, "#141622")
    c.hline(2, 45, 29, "#4e5062")
    c.hline(2, 14, 29, "#707282")
    c.set(2, 29, "#9698a4")
    c.hline(36, 45, 29, "#2e3040")
    c.hline(2, 45, 30, "#141622")

    c.shadow(1, 30)
    c.shadow(46, 30)
    for sx in range(2, 46):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# 2. ramen_cooker_counter.png (32x32, standing, target opaque ~28-30 x 28-30)
# ---------------------------------------------------------------------------
def draw_ramen_cooker_counter() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Crimson & Amber Ramen Cooker Backsplash + Hot-Water Boiler Unit (y=2..11, x=2..29) ---
    c.hline(4, 27, 2, "#2e1119")  # crimson_red[0] outline
    c.set(3, 3, "#2e1119")
    c.set(28, 3, "#2e1119")
    c.vline(2, 4, 5, "#2e1119")
    c.vline(29, 4, 5, "#2e1119")

    # Glossy crimson header interior with top-left specular gleam & glowing amber "RAMEN" badge
    c.hline(4, 27, 3, "#d8665b")
    c.hline(4, 9, 3, "#faaa9a")
    c.set(4, 3, "#fafaf8")
    c.hline(3, 28, 4, "#b62b29")
    c.set(3, 4, "#faaa9a")
    c.set(28, 4, "#721c28")
    c.hline(3, 28, 5, "#721c28")
    c.set(3, 5, "#b62b29")

    # Glowing golden-amber Korean ramen sign blocks in center of crimson header (x=10..21, y=3..4)
    c.rect(10, 3, 21, 4, "#941b23")
    for bx in [11, 12, 14, 15, 17, 18, 20]:
        c.set(bx, 3, "#fae79a")
        c.set(bx, 4, "#d8b55b")
    c.set(11, 3, "#fafaf8")

    # Brushed-steel side pillars & dark recessed boiler/nozzle bay (y=6..10, x=2..29)
    c.vline(2, 6, 10, "#141622")
    c.vline(29, 6, 10, "#141622")
    c.vline(3, 6, 10, "#e2e4e8")
    c.vline(4, 6, 10, "#9698a4")
    c.vline(27, 6, 10, "#9698a4")
    c.vline(28, 6, 10, "#4e5062")

    # Deep recessed dark slate dispenser & steam backdrop (x=5..26, y=6..10)
    c.rect(5, 6, 26, 10, "#141622")
    c.rect(6, 7, 25, 9, "#2e3040")

    # Two silver hot-water dispenser nozzles + digital timer + amber condiment jars
    c.set(6, 7, "#61d85b")  # green ready LED
    c.set(7, 7, "#5bd4d8")  # digital timer readout
    c.set(13, 6, "#bec0c8") # left water spout
    c.set(13, 7, "#fafaf8")
    c.set(17, 6, "#bec0c8") # right water spout
    c.set(17, 7, "#fafaf8")
    c.set(24, 7, "#fac79a") # amber condiment jar
    c.set(25, 7, "#d88c5b")
    c.set(24, 8, "#b65529")
    c.set(25, 8, "#94381b")

    # Crisp White Steam Wisps curling upward against dark recessed bay!
    c.set(9, 8, "#fafaf8")
    c.set(10, 7, "#fafaf8")
    c.set(9, 6, "#e2e4e8")
    c.set(11, 8, "#bec0c8")

    c.set(20, 8, "#fafaf8")
    c.set(21, 7, "#fafaf8")
    c.set(20, 6, "#e2e4e8")
    c.set(22, 8, "#bec0c8")

    # --- B. Gleaming Brushed-Steel Countertop Overhang + Induction Rings + 2 Ramen Pots (y=9..16, x=1..30) ---
    c.vline(1, 11, 16, "#141622")
    c.vline(30, 11, 16, "#141622")

    # Brushed steel top surface (y=11..14) + front bullnose bevel (y=15..16)
    c.hline(2, 29, 11, "#e2e4e8")
    c.hline(2, 7, 11, "#fafaf8")
    c.hline(2, 29, 12, "#bec0c8")
    c.hline(2, 29, 13, "#bec0c8")
    c.hline(2, 29, 14, "#9698a4")
    c.hline(2, 29, 15, "#e2e4e8")
    c.hline(24, 29, 15, "#9698a4")
    c.set(2, 15, "#fafaf8")
    c.hline(2, 29, 16, "#4e5062")

    # Left Induction Glass Pad + Glowing Red-Orange Ring + Golden Korean Yangpun Pot (x=4..14, y=9..14)
    c.rect(4, 12, 14, 14, "#141622")
    # Glowing red-orange-gold induction ring visibly hugging the pot base!
    c.set(4, 13, "#d8665b")
    c.set(14, 13, "#d8665b")
    c.hline(5, 13, 14, "#b62b29")
    c.hline(6, 12, 14, "#d8665b")
    c.hline(8, 10, 14, "#fae79a")  # white-hot glowing center arc!

    # Pot 1: Sculpted Golden-Brass Yangpun Pot (양은냄비) with dark separating rim!
    c.hline(6, 12, 9, "#2e2111")   # crisp dark separation rim against backsplash
    c.set(5, 10, "#2e2111")
    c.set(13, 10, "#2e2111")
    c.set(4, 11, "#d8d25b")        # left golden loop handle
    c.set(14, 11, "#947c1b")       # right golden loop handle
    c.hline(6, 12, 10, "#f7fa9a")  # bright golden top rim
    # Boiling spicy crimson Shin-ramyun broth + noodles + green onion inside!
    c.set(5, 11, "#f7fa9a")
    c.set(6, 11, "#d8665b")
    c.set(7, 11, "#b62b29")
    c.set(8, 11, "#fae79a")
    c.set(9, 11, "#61d85b")
    c.set(10, 11, "#fac79a")
    c.set(11, 11, "#b62b29")
    c.set(12, 11, "#941b23")
    c.set(13, 11, "#725a1c")
    # Curved 5-tone golden pot belly (y=12..13)
    c.set(5, 12, "#f7fa9a")
    c.set(6, 12, "#fae79a")
    c.set(7, 12, "#d8d25b")
    c.set(8, 12, "#d8b55b")
    c.set(9, 12, "#b6a529")
    c.set(10, 12, "#b68429")
    c.set(11, 12, "#947c1b")
    c.set(12, 12, "#725a1c")
    c.set(13, 12, "#503c18")
    c.set(6, 13, "#d8d25b")
    c.set(7, 13, "#b6a529")
    c.set(8, 13, "#947c1b")
    c.set(9, 13, "#947c1b")
    c.set(10, 13, "#725a1c")
    c.set(11, 13, "#503c18")
    c.set(12, 13, "#2e2111")

    # Right Induction Glass Pad + Glowing Red-Orange Ring + Crimson/White Foil Bowl (x=17..26, y=9..14)
    c.rect(17, 12, 26, 14, "#141622")
    c.set(17, 13, "#d8665b")
    c.set(26, 13, "#d8665b")
    c.hline(18, 25, 14, "#b62b29")
    c.hline(19, 24, 14, "#d8665b")
    c.hline(21, 22, 14, "#fae79a")

    # Pot 2: Iconic White & Crimson Paper-Foil Self-Cooker Ramen Bowl
    c.hline(19, 24, 9, "#2e1119")  # crisp dark separation rim
    c.set(18, 10, "#2e3040")
    c.set(25, 10, "#2e3040")
    c.hline(19, 24, 10, "#fafaf8") # crisp white foil rim
    c.set(18, 11, "#fafaf8")
    c.set(19, 11, "#b62b29")
    c.set(20, 11, "#d8665b")
    c.set(21, 11, "#fafaf8")       # poached egg white
    c.set(22, 11, "#fae79a")       # golden yolk
    c.set(23, 11, "#b62b29")
    c.set(24, 11, "#941b23")
    c.set(25, 11, "#bec0c8")
    # Crimson-banded bowl belly (y=12..13)
    c.set(18, 12, "#fafaf8")
    c.set(19, 12, "#faaa9a")
    c.set(20, 12, "#d8665b")
    c.set(21, 12, "#b62b29")
    c.set(22, 12, "#b62b29")
    c.set(23, 12, "#941b23")
    c.set(24, 12, "#721c28")
    c.set(25, 12, "#501825")
    c.set(19, 13, "#fafaf8")
    c.set(20, 13, "#e2e4e8")
    c.set(21, 13, "#bec0c8")
    c.set(22, 13, "#bec0c8")
    c.set(23, 13, "#9698a4")
    c.set(24, 13, "#707282")

    # Tiny yellow pickled-radish (단무지) dish on right steel counter (x=27..28, y=12..13)
    c.set(27, 12, "#f7fa9a")
    c.set(28, 12, "#d8b55b")
    c.set(27, 13, "#fafaf8")
    c.set(28, 13, "#707282")

    # --- C. Warm Sculpted Oak Wood Lower Cabinet (y=17..30, x=2..29) ---
    c.vline(2, 17, 30, "#0d0805")
    c.vline(29, 17, 30, "#0d0805")
    c.hline(3, 28, 17, "#411e06")

    c.rect(3, 18, 28, 28, "#b77246")
    c.hline(3, 28, 18, "#d99350")
    c.set(3, 18, "#fad6b4")
    c.vline(3, 19, 27, "#d99350")
    c.vline(28, 19, 28, "#69311a")
    c.hline(3, 28, 28, "#69311a")

    c.vline(15, 18, 27, "#69311a")
    c.vline(16, 18, 27, "#d99350")
    c.set(16, 18, "#e6aa82")

    for dx0, dx1 in [(5, 14), (17, 26)]:
        c.hline(dx0, dx1, 19, "#411e06")
        c.vline(dx0, 19, 27, "#411e06")
        c.hline(dx0 + 1, dx1, 27, "#e6aa82")
        c.vline(dx1, 20, 27, "#d99350")
        c.set(dx1, 27, "#fad6b4")

        c.rect(dx0 + 1, 20, dx1 - 1, 26, "#bd672a")
        c.hline(dx0 + 1, dx1 - 2, 20, "#d99350")
        c.vline(dx0 + 1, 20, 25, "#d99350")
        c.set(dx0 + 1, 20, "#e6aa82")
        c.hline(dx0 + 2, dx1 - 2, 22, "#a77950")
        c.hline(dx0 + 2, dx1 - 2, 24, "#94461b")
        c.hline(dx0 + 2, dx1 - 1, 26, "#86472c")

    for hx_pos in (13, 18):
        c.set(hx_pos, 21, "#f7fa9a")
        c.set(hx_pos, 22, "#fae79a")
        c.set(hx_pos, 23, "#d8b55b")
        c.set(hx_pos, 24, "#72461c")
        c.set(hx_pos, 25, "#411e06")

    c.hline(3, 28, 29, "#411e06")
    c.hline(3, 7, 29, "#86472c")
    c.hline(24, 28, 29, "#69311a")
    c.hline(8, 23, 29, "#0d0805")
    c.hline(2, 7, 30, "#0d0805")
    c.hline(24, 29, 30, "#0d0805")

    c.shadow(1, 30)
    c.shadow(30, 30)
    for sx in range(8, 24):
        c.shadow(sx, 30)
    for sx in range(2, 30):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# 3. drink_fridge_glass.png (16x32, standing, target opaque ~14 x 28-30)
# ---------------------------------------------------------------------------
def draw_drink_fridge_glass() -> Image.Image:
    c = Canvas(16, 32)

    # --- A. Glowing Sky-Blue Rounded Top Header Sign (y=2..6, x=1..14) ---
    c.hline(3, 12, 2, "#11272e")
    c.set(2, 3, "#11272e")
    c.set(13, 3, "#11272e")
    c.vline(1, 4, 6, "#11272e")
    c.vline(14, 4, 6, "#11272e")

    c.hline(3, 12, 3, "#9ad0fa")
    c.set(3, 3, "#fafaf8")
    c.set(4, 3, "#fafaf8")
    c.set(12, 3, "#5ba6d8")

    c.hline(2, 13, 4, "#5ba6d8")
    c.set(2, 4, "#9ad0fa")
    c.set(6, 4, "#fafaf8")
    c.set(7, 4, "#9af4fa")
    c.set(8, 4, "#fafaf8")
    c.set(9, 4, "#9ad0fa")
    c.set(13, 4, "#2982b6")

    c.hline(2, 13, 5, "#2982b6")
    c.set(2, 5, "#5ba6d8")
    c.hline(5, 10, 5, "#5ba6d8")
    c.set(13, 5, "#1b6c94")

    c.hline(2, 13, 6, "#184150")

    # --- B. Full-Height Dark-Framed Glass Door (y=7..25, x=1..14) ---
    c.vline(1, 7, 29, "#141622")
    c.vline(14, 7, 29, "#141622")

    c.hline(2, 13, 7, "#4e5062")
    c.set(2, 7, "#9698a4")
    c.vline(2, 8, 24, "#4e5062")
    c.vline(2, 8, 15, "#707282")
    c.vline(13, 8, 24, "#2e3040")
    c.hline(2, 13, 25, "#2e3040")

    c.rect(3, 8, 12, 24, "#182c50")
    c.hline(3, 11, 8, "#2982b6")

    for sy in (11, 15, 19, 23):
        c.hline(3, 11, sy, "#bec0c8")
        c.set(3, sy, "#e2e4e8")
        c.set(11, sy, "#707282")

    # Row 1 (y=9..10): Emerald, Cyan & Lime Cans
    c.set(3, 9, "#9cfa9a")
    c.set(4, 9, "#35b629")
    c.set(3, 10, "#61d85b")
    c.set(4, 10, "#29721c")

    c.set(6, 9, "#fafaf8")
    c.set(7, 9, "#29b6b6")
    c.set(6, 10, "#5bd4d8")
    c.set(7, 10, "#1c726c")

    c.set(9, 9, "#9cfa9a")
    c.set(10, 9, "#35b629")
    c.set(9, 10, "#61d85b")
    c.set(10, 10, "#225018")

    # Row 2 (y=12..14): Crimson Cola & Purple Grape Bottles
    c.set(3, 12, "#fafaf8")
    c.set(4, 12, "#b62b29")
    c.set(3, 13, "#faaa9a")
    c.set(4, 13, "#941b23")
    c.set(3, 14, "#d8665b")
    c.set(4, 14, "#721c28")

    c.set(6, 12, "#faaa9a")
    c.set(7, 12, "#941b23")
    c.set(6, 13, "#d8665b")
    c.set(7, 13, "#b62b29")
    c.set(6, 14, "#b62b29")
    c.set(7, 14, "#721c28")

    c.set(9, 12, "#fafaf8")
    c.set(10, 12, "#721b94")
    c.set(9, 13, "#bd5bd8")
    c.set(10, 13, "#571c72")
    c.set(9, 14, "#9329b6")
    c.set(10, 14, "#3c1850")

    # Row 3 (y=16..18): Gold Energy & Amber Orange Cans
    c.set(3, 16, "#fafaf8")
    c.set(4, 16, "#b6a529")
    c.set(3, 17, "#f7fa9a")
    c.set(4, 17, "#947c1b")
    c.set(3, 18, "#d8d25b")
    c.set(4, 18, "#725a1c")

    c.set(6, 16, "#fafaf8")
    c.set(7, 16, "#b65529")
    c.set(6, 17, "#d88c5b")
    c.set(7, 17, "#94381b")
    c.set(6, 18, "#b65529")
    c.set(7, 18, "#72291c")

    c.set(9, 16, "#f7fa9a")
    c.set(10, 16, "#d8b55b")
    c.set(9, 17, "#fae79a")
    c.set(10, 17, "#94601b")
    c.set(9, 18, "#d8b55b")
    c.set(10, 18, "#72461c")

    # Row 4 (y=20..22): Cyan Ion-Water, Cobalt Sports & Jade Tea Bottles
    c.set(3, 20, "#fafaf8")
    c.set(4, 20, "#29b6b6")
    c.set(3, 21, "#9af4fa")
    c.set(4, 21, "#1b9490")
    c.set(3, 22, "#5bd4d8")
    c.set(4, 22, "#1c726c")

    c.set(6, 20, "#9ad0fa")
    c.set(7, 20, "#2982b6")
    c.set(6, 21, "#fafaf8")
    c.set(7, 21, "#bec0c8")
    c.set(6, 22, "#5ba6d8")
    c.set(7, 22, "#1c5872")

    c.set(9, 20, "#fafaf8")
    c.set(10, 20, "#1b9454")
    c.set(9, 21, "#5bd89e")
    c.set(10, 21, "#1c7241")
    c.set(9, 22, "#29b670")
    c.set(10, 22, "#18502f")

    c.hline(3, 11, 24, "#111c2e")

    # Refined 2-Tone Translucent Diagonal Glass Glare Sweep (preserves jewel drink readability!)
    for gx, gy in [(3, 8), (4, 9), (5, 10), (6, 11)]:
        c.set(gx, gy, "#fafaf8")
    for gx, gy in [(5, 9), (7, 12), (8, 13), (9, 14), (3, 14), (4, 15), (5, 16)]:
        c.set(gx, gy, "#9af4fa")

    # Bright Chrome Vertical Door Handle on Right Frame (x=12..13, y=12..19)
    c.vline(11, 12, 19, "#141622")
    c.set(12, 12, "#fafaf8")
    c.set(13, 12, "#bec0c8")
    for hy in range(13, 19):
        c.set(12, hy, "#e2e4e8" if hy < 16 else "#bec0c8")
        c.set(13, hy, "#707282")
    c.set(12, 19, "#9698a4")
    c.set(13, 19, "#4e5062")

    # --- C. Dark Louvered Compressor Vent at Base & Leveling Feet (y=26..30) ---
    c.hline(2, 13, 26, "#4e5062")
    c.set(2, 26, "#707282")
    c.rect(2, 27, 13, 29, "#2e3040")
    c.hline(3, 10, 27, "#141622")
    c.hline(3, 10, 28, "#707282")
    c.hline(3, 10, 29, "#141622")
    c.set(12, 27, "#61d85b")
    c.set(12, 28, "#18502f")

    c.hline(5, 10, 29, "#141622")
    c.hline(2, 4, 30, "#141622")
    c.hline(11, 13, 30, "#141622")

    c.shadow(1, 30)
    c.shadow(14, 30)
    for sx in range(5, 11):
        c.shadow(sx, 30)
    for sx in range(2, 14):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# 4. snack_shelf_rack.png (32x32, standing, target opaque ~28-30 x 28-30)
# ---------------------------------------------------------------------------
def draw_snack_shelf_rack() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Rounded Bright White Retail Header Sign & Beveled Steel Uprights ---
    c.hline(3, 28, 2, "#141622")
    c.vline(2, 3, 4, "#141622")
    c.vline(29, 3, 4, "#141622")
    c.vline(1, 5, 30, "#141622")
    c.vline(30, 5, 30, "#141622")

    c.hline(3, 28, 3, "#fafaf8")
    c.hline(3, 28, 4, "#e2e4e8")
    c.set(28, 4, "#bec0c8")
    c.hline(11, 20, 3, "#d8665b")
    c.hline(11, 20, 4, "#b62b29")
    for tx in (12, 14, 16, 18, 19):
        c.set(tx, 3, "#fafaf8")
    c.set(12, 4, "#fae79a")
    c.set(16, 4, "#fae79a")
    c.hline(2, 29, 5, "#9698a4")

    # Left & Right Beveled Brushed-Steel Upright Posts
    c.vline(2, 5, 29, "#e2e4e8")
    c.vline(2, 5, 14, "#fafaf8")
    c.vline(3, 5, 29, "#707282")
    c.vline(28, 5, 29, "#bec0c8")
    c.vline(29, 5, 29, "#4e5062")

    c.rect(4, 6, 27, 28, "#141622")

    def draw_chip_bag(
        x0: int, y_top: int, y_bot: int,
        hi: str, mid: str, sh: str, deep: str, badge: str
    ) -> None:
        """Draws a plump, crinkled foil chip bag: flared crimp ears + pinched shadow waist + specular glint!"""
        # Flared foil top crimp with center V-notch/glint so it NEVER reads as a flat rectangle!
        c.set(x0, y_top, hi)
        c.set(x0 + 1, y_top, "#fafaf8")
        c.set(x0 + 2, y_top, sh)      # crinkle dip in top seal
        c.set(x0 + 3, y_top, mid)
        c.set(x0 + 4, y_top, deep)

        for row_idx, y in enumerate(range(y_top + 1, y_bot + 1)):
            if y == y_bot:
                # Rounded/tucked bottom corners -> plump pillow base
                c.set(x0, y, "#141622")
                c.set(x0 + 1, y, mid)
                c.set(x0 + 2, y, sh)
                c.set(x0 + 3, y, deep)
                c.set(x0 + 4, y, "#141622")
            elif row_idx == 1:
                # Plumpest middle belly with bright foil specular dot & snack badge
                c.set(x0, y, hi)
                c.set(x0 + 1, y, "#fafaf8")
                c.set(x0 + 2, y, badge)
                c.set(x0 + 3, y, mid)
                c.set(x0 + 4, y, sh)
            else:
                # Slightly pinched foil waist
                c.set(x0, y, hi if row_idx == 0 else mid)
                c.set(x0 + 1, y, mid)
                c.set(x0 + 2, y, badge if row_idx == 2 else mid)
                c.set(x0 + 3, y, sh)
                c.set(x0 + 4, y, deep)

    # --- B. Tier 1 (y=6..10, Shelf Lip at y=11): 4 Plump Crinkled Foil Chip Bags ---
    draw_chip_bag(4, 6, 10, "#faaa9a", "#d8665b", "#b62b29", "#721c28", "#fae79a")
    draw_chip_bag(10, 7, 10, "#f7fa9a", "#d8d25b", "#b6a529", "#725a1c", "#d8665b")
    draw_chip_bag(16, 6, 10, "#9cfa9a", "#61d85b", "#29941b", "#225018", "#f7fa9a")
    draw_chip_bag(22, 6, 10, "#e89afa", "#bd5bd8", "#721b94", "#3c1850", "#fae79a")

    c.hline(4, 27, 11, "#bec0c8")
    c.hline(4, 10, 11, "#e2e4e8")
    for px in (6, 12, 18, 24):
        c.set(px, 11, "#fafaf8")

    # --- C. Tier 2 (y=12..16, Shelf Lip at y=17): Cobalt, Rust-Orange, Cyan, Rose Foil Bags ---
    draw_chip_bag(4, 12, 16, "#9aacfa", "#5b76d8", "#294db6", "#1c3772", "#fac79a")
    draw_chip_bag(10, 12, 16, "#fac79a", "#d88c5b", "#b65529", "#72291c", "#f7fa9a")
    draw_chip_bag(16, 13, 16, "#9af4fa", "#5bd4d8", "#1b9490", "#18504a", "#fafaf8")
    draw_chip_bag(22, 12, 16, "#fa9aba", "#d85b8f", "#941b60", "#501840", "#fafaf8")

    c.hline(4, 27, 17, "#bec0c8")
    c.hline(4, 10, 17, "#e2e4e8")
    for px in (6, 12, 18, 24):
        c.set(px, 17, "#fae79a")

    # --- D. Tier 3 (y=18..22, Shelf Lip at y=23): 4 Symmetric Tapered Cup-Ramen Tubs (5px lid -> 3px foot!) ---
    def draw_sym_cup_ramen(x0: int, top_stripe: str, mid_stripe: str, sh: str) -> None:
        """5px overhanging white foil lid (y=19) tapering symmetrically to 3px base (y=21..22)."""
        c.hline(x0, x0 + 4, 19, "#fafaf8")
        c.set(x0 + 4, 19, "#bec0c8")
        # Upper cup band (5px wide)
        c.hline(x0, x0 + 4, 20, top_stripe)
        c.set(x0, 20, "#fafaf8")
        c.set(x0 + 4, 20, sh)
        # Tapered 3px lower body & foot (x0+1..x0+3 at y=21..22; outer x0, x0+4 stay #141622!)
        c.set(x0 + 1, 21, "#fafaf8")
        c.set(x0 + 2, 21, mid_stripe)
        c.set(x0 + 3, 21, sh)
        c.set(x0 + 1, 22, "#fafaf8")
        c.set(x0 + 2, 22, "#e2e4e8")
        c.set(x0 + 3, 22, "#9698a4")

    draw_sym_cup_ramen(4, "#b62b29", "#d8665b", "#721c28")   # Shin Cup
    draw_sym_cup_ramen(10, "#d8d25b", "#294db6", "#1c3772")  # Jin Mild Cup
    draw_sym_cup_ramen(16, "#b62b29", "#35b629", "#18502f")  # Yukgaejang Cup
    draw_sym_cup_ramen(22, "#2e3040", "#d8665b", "#501825")  # Buldak Hot Cup

    c.hline(4, 27, 23, "#bec0c8")
    c.hline(4, 10, 23, "#e2e4e8")
    for px in (6, 12, 18, 24):
        c.set(px, 23, "#fafaf8")

    # --- E. Tier 4 (y=24..27): Wide Tapered Bowl-Ramen & Upright Pepero/Choco Boxes ---
    # Tapered wide Sabalmyeon bowl (x=4..9 -> x=5..8)
    c.hline(4, 9, 25, "#fafaf8")
    c.set(9, 25, "#bec0c8")
    c.hline(4, 9, 26, "#d8665b")
    c.set(4, 26, "#faaa9a")
    c.set(9, 26, "#721c28")
    c.hline(5, 8, 27, "#e2e4e8")
    c.set(5, 27, "#fafaf8")

    # Red & Green Pepero Biscuit Boxes (x=11..13, x=15..17)
    c.rect(11, 24, 13, 27, "#b62b29")
    c.set(11, 24, "#fafaf8")
    c.set(12, 24, "#faaa9a")
    c.set(12, 26, "#d99350")
    c.set(12, 27, "#fad6b4")

    c.rect(15, 24, 17, 27, "#29941b")
    c.set(15, 24, "#fafaf8")
    c.set(16, 24, "#9cfa9a")
    c.set(16, 26, "#d99350")
    c.set(16, 27, "#fad6b4")

    # Gold & Cobalt Snack Boxes (x=19..22, x=24..27)
    c.rect(19, 25, 22, 27, "#d8b55b")
    c.hline(19, 21, 25, "#fae79a")
    c.set(19, 25, "#fafaf8")
    c.vline(22, 25, 27, "#94601b")

    c.rect(24, 25, 27, 27, "#294db6")
    c.hline(24, 26, 25, "#9aacfa")
    c.set(24, 25, "#fafaf8")
    c.vline(27, 25, 27, "#182c50")

    # Bottom Steel Shelf Apron & Sturdy Rack Feet (y=28..30)
    c.hline(4, 27, 28, "#9698a4")
    c.hline(4, 11, 28, "#bec0c8")
    c.hline(2, 29, 29, "#4e5062")
    c.hline(6, 25, 29, "#141622")
    c.hline(1, 5, 30, "#141622")
    c.hline(26, 30, 30, "#141622")

    for sx in range(6, 26):
        c.shadow(sx, 30)
    for sx in range(2, 30):
        c.shadow(sx, 31)

    return c.im


# ---------------------------------------------------------------------------
# 5. trash_recycle_bin.png (16x16, standing, target opaque ~14 x 13-14)
#    Directly inspired by the twin/triple glossy dome polish of img_59_.png!
# ---------------------------------------------------------------------------
def draw_trash_recycle_bin() -> Image.Image:
    c = Canvas(16, 16)

    # --- A. Scalloped Twin Glossy Domed Lids (y=1..6) ---
    # Left Bin (x=1..7): Shiny Cobalt-Blue Dome Lid
    # Right Bin (x=8..14): Shiny Emerald-Green Dome Lid
    # y=1: Twin rounded crowns with center valley notch at x=7..8 and outer corners x=1,14!
    c.hline(2, 6, 1, "#111c2e")   # cobalt_blue[0] crown outline
    c.hline(9, 13, 1, "#172e11")  # emerald_green[0] crown outline

    # y=2: Top specular white gleams (#fafaf8) + bright glossy dome curves!
    # Note: (7,2) touches transparent (7,1) above -> #111c2e; (8,2) touches (8,1) above -> #172e11!
    c.set(1, 2, "#111c2e")
    c.set(2, 2, "#fafaf8")  # brilliant white top-left gleam!
    c.set(3, 2, "#9aacfa")
    c.set(4, 2, "#9aacfa")
    c.set(5, 2, "#5b76d8")
    c.set(6, 2, "#294db6")
    c.set(7, 2, "#111c2e")

    c.set(8, 2, "#172e11")
    c.set(9, 2, "#fafaf8")  # brilliant white top-left gleam!
    c.set(10, 2, "#9cfa9a")
    c.set(11, 2, "#9cfa9a")
    c.set(12, 2, "#61d85b")
    c.set(13, 2, "#35b629")
    c.set(14, 2, "#172e11")

    # y=3..4: Dark Recessed Throw-In Slots inside Sculpted Glossy Domes
    # Left Cobalt Dome
    c.set(1, 3, "#111c2e")
    c.set(2, 3, "#9aacfa")
    c.set(3, 3, "#141622")  # dark recessed throw-in opening
    c.set(4, 3, "#141622")
    c.set(5, 3, "#111c2e")
    c.set(6, 3, "#294db6")
    c.set(7, 3, "#111c2e")

    c.set(1, 4, "#111c2e")
    c.set(2, 4, "#5b76d8")
    c.set(3, 4, "#111c2e")
    c.set(4, 4, "#141622")  # deeper oval slot center
    c.set(5, 4, "#294db6")
    c.set(6, 4, "#1b3e94")
    c.set(7, 4, "#111c2e")

    # Right Emerald Dome
    c.set(8, 3, "#172e11")
    c.set(9, 3, "#9cfa9a")
    c.set(10, 3, "#141622")  # dark recessed throw-in opening
    c.set(11, 3, "#141622")
    c.set(12, 3, "#172e11")
    c.set(13, 3, "#35b629")
    c.set(14, 3, "#172e11")

    c.set(8, 4, "#172e11")
    c.set(9, 4, "#61d85b")
    c.set(10, 4, "#172e11")
    c.set(11, 4, "#141622")  # deeper oval slot center
    c.set(12, 4, "#35b629")
    c.set(13, 4, "#29941b")
    c.set(14, 4, "#172e11")

    # y=5: Signature img_59_ bottom-lip catchlight under each throw-in slot!
    c.set(1, 5, "#111c2e")
    c.set(2, 5, "#5b76d8")
    c.set(3, 5, "#294db6")
    c.set(4, 5, "#9aacfa")  # crisp upward slot-lip catchlight!
    c.set(5, 5, "#1b3e94")
    c.set(6, 5, "#1c3772")
    c.set(7, 5, "#111c2e")

    c.set(8, 5, "#172e11")
    c.set(9, 5, "#61d85b")
    c.set(10, 5, "#35b629")
    c.set(11, 5, "#9cfa9a")  # crisp upward slot-lip catchlight!
    c.set(12, 5, "#29941b")
    c.set(13, 5, "#29721c")
    c.set(14, 5, "#172e11")

    # y=6: Dark recessed lid collar seam separating domes from silver steel body
    c.set(1, 6, "#111c2e")
    c.hline(2, 6, 6, "#182c50")
    c.set(7, 6, "#141622")
    c.set(8, 6, "#141622")
    c.hline(9, 13, 6, "#225018")
    c.set(14, 6, "#172e11")

    # --- B. Beveled Cool-Silver Brushed Metal Twin Body (y=7..13, x=1..14) ---
    c.vline(1, 7, 14, "#141622")
    c.vline(14, 7, 14, "#141622")
    # Center vertical shadow seam dividing the twin compartments (x=7..8)
    c.vline(7, 7, 13, "#2e3040")
    c.vline(8, 7, 13, "#141622")

    # Left Compartment Silver Front (x=2..6, y=7..13)
    # Signature img_59_ bright vertical left-edge specular bar at x=2!
    c.set(2, 7, "#fafaf8")
    c.hline(3, 5, 7, "#e2e4e8")
    c.set(6, 7, "#9698a4")

    c.vline(2, 8, 11, "#fafaf8")
    c.set(2, 12, "#e2e4e8")
    # Color-coded cobalt badge bar + recessed silver panel + white label strip
    c.set(3, 8, "#5b76d8")
    c.set(4, 8, "#294db6")
    c.set(5, 8, "#1b3e94")
    c.set(6, 8, "#9698a4")

    c.set(3, 9, "#bec0c8")
    c.set(4, 9, "#9698a4")
    c.set(5, 9, "#9698a4")
    c.set(6, 9, "#707282")

    c.set(3, 10, "#9698a4")
    c.set(4, 10, "#5b76d8")  # mini blue recycle emblem dot!
    c.set(5, 10, "#707282")
    c.set(6, 10, "#707282")

    c.set(3, 11, "#fafaf8")  # crisp white label strip (like img_59_)
    c.set(4, 11, "#e2e4e8")
    c.set(5, 11, "#bec0c8")
    c.set(6, 11, "#707282")

    c.hline(3, 5, 12, "#707282")
    c.set(6, 12, "#4e5062")
    c.hline(2, 6, 13, "#4e5062")
    c.set(2, 13, "#707282")

    # Right Compartment Silver Front (x=9..13, y=7..13)
    c.set(9, 7, "#fafaf8")
    c.hline(10, 12, 7, "#e2e4e8")
    c.set(13, 7, "#9698a4")

    c.vline(9, 8, 11, "#fafaf8")
    c.set(9, 12, "#e2e4e8")

    c.set(10, 8, "#61d85b")
    c.set(11, 8, "#29941b")
    c.set(12, 8, "#29721c")
    c.set(13, 8, "#9698a4")

    c.set(10, 9, "#bec0c8")
    c.set(11, 9, "#9698a4")
    c.set(12, 9, "#9698a4")
    c.set(13, 9, "#707282")

    c.set(10, 10, "#9698a4")
    c.set(11, 10, "#35b629")  # mini green recycle emblem dot!
    c.set(12, 10, "#707282")
    c.set(13, 10, "#707282")

    c.set(10, 11, "#fafaf8")  # crisp white label strip
    c.set(11, 11, "#e2e4e8")
    c.set(12, 11, "#bec0c8")
    c.set(13, 11, "#707282")

    c.hline(10, 12, 12, "#707282")
    c.set(13, 12, "#4e5062")
    c.hline(9, 13, 13, "#4e5062")
    c.set(9, 13, "#707282")

    # --- C. Scalloped Pedestal Base Feet (y=14) & Ground Shadow (y=15) ---
    # Three crisp feet at x=1..4, x=6..9, x=11..14; shadow notches at x=5 and x=10!
    # Ensure pixels directly above notches (5,13) and (10,13) are dark outline #141622!
    c.set(5, 13, "#141622")
    c.set(10, 13, "#141622")
    c.hline(1, 4, 14, "#141622")
    c.hline(6, 9, 14, "#141622")
    c.hline(11, 14, 14, "#141622")

    c.shadow(5, 14)
    c.shadow(10, 14)
    for sx in range(2, 14):
        c.shadow(sx, 15)

    return c.im


# ---------------------------------------------------------------------------
# Strict Technical Rule Validator
# ---------------------------------------------------------------------------
def validate_sprite(name: str, im: Image.Image, expected_size: tuple[int, int]) -> dict:
    assert im.size == expected_size, f"{name}: size {im.size} != {expected_size}"
    w, h = im.size
    px = im.load()

    off_palette = []
    bad_alpha = []
    bad_shadow = []
    bad_outline = []
    pure_black = []

    min_x, min_y, max_x, max_y = w, h, -1, -1
    opaque_colors = set()
    shadow_count = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            elif a == 85:
                shadow_count += 1
                if (r, g, b, a) != SHADOW_RGBA:
                    bad_shadow.append((x, y, (r, g, b, a)))
            elif a == 255:
                hex_c = f"#{r:02x}{g:02x}{b:02x}"
                opaque_colors.add(hex_c)
                if hex_c == "#000000":
                    pure_black.append((x, y))
                if hex_c not in ALL_HEX:
                    off_palette.append((x, y, hex_c))
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

                # Check 4-connected outer boundary (touching out-of-bounds or alpha < 255)
                touches_outside = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] < 255:
                        touches_outside = True
                        break
                if touches_outside and hex_c not in DARK_OUTLINE_HEX:
                    bad_outline.append((x, y, hex_c))
            else:
                bad_alpha.append((x, y, a))

    assert not pure_black, f"{name}: pure #000000 pixels: {pure_black}"
    assert not off_palette, f"{name}: off-palette pixels: {off_palette}"
    assert not bad_alpha, f"{name}: invalid alpha pixels: {bad_alpha}"
    assert not bad_shadow, f"{name}: invalid shadow pixels: {bad_shadow}"
    assert not bad_outline, f"{name}: non-dark outer outline pixels: {bad_outline}"

    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    left_margin = min_x
    right_margin = w - 1 - max_x
    bottom_margin = h - 1 - max_y

    return {
        "name": name,
        "canvas": f"{w}x{h}",
        "opaque_bbox": f"{op_w}x{op_h} (x={min_x}..{max_x}, y={min_y}..{max_y})",
        "margins": f"L={left_margin}, R={right_margin}, B={bottom_margin}",
        "colors": len(opaque_colors),
        "shadow_px": shadow_count,
    }


# ---------------------------------------------------------------------------
# Contact Sheet Generator (2x + 1x on #767670 gray next to 1x/2x ref_mod1_char)
# ---------------------------------------------------------------------------
def build_preview_sheet(sprites: list[tuple[str, Image.Image, dict]]) -> None:
    bg_gray = (0x76, 0x76, 0x70, 255)
    card_border = (0x5c, 0x5c, 0x57, 255)
    header_bg = (0x66, 0x66, 0x60, 255)
    text_light = (0xf5, 0xf5, 0xf0, 255)
    text_dim = (0xd8, 0xd8, 0xd0, 255)

    # Load ref_mod1_char.png (72x96 = 3x of 24x32) -> downsample cleanly to 1x (24x32)
    char_raw = Image.open(CHAR_REF_PATH).convert("RGBA")
    if char_raw.size == (72, 96):
        char_1x = char_raw.resize((24, 32), Image.Resampling.NEAREST)
    else:
        char_1x = char_raw
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w = 780
    sheet_h = 430
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header box
    draw.rectangle([12, 12, sheet_w - 13, 82], fill=header_bg, outline=card_border)
    draw.text(
        (24, 22),
        "modern_pcbang_carbon - Batch 3/4: Cafe & Counter (2x + 1x on #767670)",
        fill=text_light,
        font=font,
    )
    draw.text(
        (24, 40),
        "Palette: modern_palette_v3 (118 colors) | Shadow: #4c557f @ a=85 | Strict 1px Dark Material Outlines",
        fill=text_dim,
        font=font,
    )
    draw.text(
        (24, 58),
        "Scale Ref: ref_mod1_char (22px tall @ 1x) shown inside header & beside Batch 3 sprites",
        fill=text_dim,
        font=font,
    )

    # Paste 2x + 1x character in header right
    sheet.alpha_composite(char_2x, (sheet_w - 150, 14))
    draw.text((sheet_w - 132, 70), "2x", fill=text_dim, font=font)
    sheet.alpha_composite(char_1x, (sheet_w - 80, 46))
    draw.text((sheet_w - 74, 70), "1x", fill=text_dim, font=font)

    # 3x2 grid of cards (5 sprites + 1 side-by-side lineup card at 1x with character!)
    cols = 3
    card_w = 244
    card_h = 156
    start_x = 12
    start_y = 96
    gap_x = 12
    gap_y = 12

    for idx, (fname, im, stats) in enumerate(sprites):
        col = idx % cols
        row = idx // cols
        cx = start_x + col * (card_w + gap_x)
        cy = start_y + row * (card_h + gap_y)

        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=bg_gray, outline=card_border)
        draw.line([(cx + 8, cy + 108), (cx + card_w - 8, cy + 108)], fill=card_border)

        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        baseline_y = cy + 98

        # 2x char reference lightly at left, 2x object center, 1x object + 1x char right
        sheet.alpha_composite(char_2x, (cx + 10, baseline_y - char_2x.height))
        obj2_x = cx + 66 + (96 - im_2x.width) // 2
        sheet.alpha_composite(im_2x, (obj2_x, baseline_y - im_2x.height))

        obj1_x = cx + 178 + (48 - im.width) // 2
        sheet.alpha_composite(im, (obj1_x, baseline_y - im.height))

        label = fname.replace(".png", "")
        draw.text((cx + 10, cy + 114), f"{idx + 1}. {label}", fill=text_light, font=font)
        draw.text(
            (cx + 10, cy + 130),
            f"[standing] {stats['canvas']} | opq {stats['opaque_bbox'].split(' ')[0]} | {stats['colors']}c",
            fill=text_dim,
            font=font,
        )

    # 6th card: 1x True-Scale Cafe Counter Lineup next to ref_mod1_char!
    cx = start_x + 2 * (card_w + gap_x)
    cy = start_y + 1 * (card_h + gap_y)
    draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=bg_gray, outline=card_border)
    draw.line([(cx + 8, cy + 108), (cx + card_w - 8, cy + 108)], fill=card_border)

    base_y = cy + 90
    cur_x = cx + 10
    sheet.alpha_composite(char_1x, (cur_x, base_y - char_1x.height))
    cur_x += char_1x.width + 6
    for _, im, _ in sprites:
        sheet.alpha_composite(im, (cur_x, base_y - im.height))
        cur_x += im.width + 6

    draw.text((cx + 10, cy + 114), "Native 1x Lineup + 22px Char", fill=text_light, font=font)
    draw.text((cx + 10, cy + 130), "True RM2000 16px tile scale check", fill=text_dim, font=font)

    sheet.save(PREVIEW_PATH)


def main() -> None:
    os.makedirs(OBJ_DIR, exist_ok=True)

    specs = [
        ("pos_counter_desk.png", draw_pos_counter_desk, (48, 32)),
        ("ramen_cooker_counter.png", draw_ramen_cooker_counter, (32, 32)),
        ("drink_fridge_glass.png", draw_drink_fridge_glass, (16, 32)),
        ("snack_shelf_rack.png", draw_snack_shelf_rack, (32, 32)),
        ("trash_recycle_bin.png", draw_trash_recycle_bin, (16, 16)),
    ]

    rendered = []
    for fname, fn, expected_size in specs:
        im = fn()
        stats = validate_sprite(fname, im, expected_size)
        out_path = OBJ_DIR / fname
        im.save(out_path)
        rendered.append((fname, im, stats))
        print(
            f"OK  {fname:26s} | canvas={stats['canvas']:6s} | "
            f"opaque={stats['opaque_bbox']:28s} | {stats['margins']:14s} | "
            f"colors={stats['colors']:2d} | shadow_px={stats['shadow_px']}"
        )

    build_preview_sheet(rendered)
    print(f"\nSaved preview sheet -> {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
