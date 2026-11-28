#!/usr/bin/env python3
"""
T4 Fantasy Town Fable-Grade Buildings — Batch 2/5
Procedural hand-crafted pixel-art generator for:
  1. ft-smithy.png (64x112 RGBA, 4x7 tiles) — Dwarven/Town Blacksmith & Open Forge (대장간)
  2. ft-armory.png (64x112 RGBA, 4x7 tiles) — Royal Arms & Armor Outfitter (무기·방어구 상점)

100% locked to tiledata/jp-city/fable-city/palette.json:
  - 0 off-palette pixels
  - 0 pure #000000 pixels
  - strict binary alpha {0, 255}
  - 60–95 colors per building with Fable-5.2-grade pixel density, staggered roofs,
    directional cast shadows, pictorial fantasy signboards, and rich 1F storytelling.
"""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
OUT_DIR = ROOT / "tiledata/fantasy-town-carbon/buildings"
PREVIEW_PATH = ROOT / "tiledata/fantasy-town-carbon/preview_batch2.png"


def hex_to_rgba(h: str) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def load_palette():
    with open(PALETTE_PATH, "r", encoding="utf-8") as f:
        pdata = json.load(f)
    ramps: dict[str, list[tuple[int, int, int, int]]] = {}
    allowed_rgb: set[tuple[int, int, int]] = set()
    color_to_ramp: dict[tuple[int, int, int, int], tuple[str, int]] = {}
    for name, hex_list in pdata["ramps"].items():
        rgba_list = [hex_to_rgba(h) for h in hex_list]
        ramps[name] = rgba_list
        for idx, rgba in enumerate(rgba_list):
            allowed_rgb.add(rgba[:3])
            if rgba not in color_to_ramp:
                color_to_ramp[rgba] = (name, idx)
    return ramps, allowed_rgb, color_to_ramp


class Canvas:
    def __init__(
        self,
        w: int,
        h: int,
        ramps: dict[str, list[tuple[int, int, int, int]]],
        color_to_ramp: dict[tuple[int, int, int, int], tuple[str, int]],
    ):
        self.w = w
        self.h = h
        self.ramps = ramps
        self.color_to_ramp = color_to_ramp
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def c(self, ramp: str, idx: int) -> tuple[int, int, int, int]:
        r = self.ramps[ramp]
        idx = max(0, min(len(r) - 1, idx))
        return r[idx]

    def set(self, x: int, y: int, color: tuple[int, int, int, int] | None):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = (0, 0, 0, 0) if color is None else color

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int, int] | None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, color)

    def hline(self, x0: int, x1: int, y: int, color: tuple[int, int, int, int] | None):
        for x in range(x0, x1 + 1):
            self.set(x, y, color)

    def vline(self, x: int, y0: int, y1: int, color: tuple[int, int, int, int] | None):
        for y in range(y0, y1 + 1):
            self.set(x, y, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int, int]):
        dx = abs(x1 - x0)
        sx = 1 if x0 < x1 else -1
        dy = -abs(y1 - y0)
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def shade_px(self, x: int, y: int, delta: int):
        """Shift existing opaque pixel along its own locked ramp (negative = darker)."""
        cur = self.get(x, y)
        if cur[3] == 0:
            return
        info = self.color_to_ramp.get(cur)
        if info is not None:
            rname, idx = info
            self.set(x, y, self.c(rname, idx + delta))

    def shade_rect(self, x0: int, y0: int, x1: int, y1: int, delta: int):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.shade_px(x, y, delta)

    def sprite(self, x0: int, y0: int, rows: list[str], cmap: dict[str, tuple[int, int, int, int]]):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != "." and ch in cmap:
                    self.set(x0 + dx, y0 + dy, cmap[ch])


def hash2d(x: int, y: int, seed: int = 0) -> int:
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFFFFFF


# ==============================================================================
# BUILDING 1: ft-smithy.png (64x112) — Dwarven/Town Blacksmith & Open Forge
# ==============================================================================
def build_smithy(ramps, color_to_ramp) -> Image.Image:
    cv = Canvas(64, 112, ramps, color_to_ramp)
    c = cv.c

    # --------------------------------------------------------------------------
    # 1. ROOF (y=0..42): Heavy dark-slate ibushi/kuro staggered tile roof
    #    + massive rugged brick-and-stone forge chimney + glowing smoke & shadow
    # --------------------------------------------------------------------------
    # Main ridge crest (y=7..9, x=2..61) with sky transparency above y=0..6
    for x in range(2, 62):
        seg = (x - 2) % 5
        cv.set(x, 7, c("ibushi", 6 if seg in (1, 2) else 4))
        cv.set(x, 8, c("ibushi", 5 if seg == 1 else (3 if seg < 4 else 2)))
        cv.set(x, 9, c("kuro", 2 if seg < 4 else 1))

    # Wrought-iron & carved slate ridge finials at ends (x=0..3, x=60..63, y=5..10)
    for side_x, flip in ((0, False), (60, True)):
        xs = [side_x + (3 - i if flip else i) for i in range(4)]
        cv.set(xs[1], 5, c("steel", 5))
        cv.set(xs[2], 5, c("steel", 3))
        cv.set(xs[0], 6, c("kuro", 2))
        cv.set(xs[1], 6, c("ibushi", 6))
        cv.set(xs[2], 6, c("ibushi", 4))
        cv.set(xs[3], 6, c("kuro", 1))
        for ry in range(7, 11):
            cv.set(xs[0], ry, c("kuro", 1))
            cv.set(xs[1], ry, c("ibushi", 5 if ry < 9 else 3))
            cv.set(xs[2], ry, c("kuro", 3 if ry < 9 else 2))
            cv.set(xs[3], ry, c("ink", 0))
        cv.set(xs[1], 8, c("yellow", 3))

    # Staggered heavy slate courses (y=10..38, 6 courses)
    course_starts = [10, 15, 20, 25, 30, 35]
    for ci, cy in enumerate(course_starts):
        ch_h = 4 if ci == 5 else 5
        offset = (ci % 2) * 3
        lit_shift = 1 if ci < 2 else (0 if ci < 4 else -1)
        for dy in range(ch_h):
            y = cy + dy
            for x in range(0, 64):
                if x <= 1:
                    cv.set(x, y, c("kuro", 1 if x == 0 else (4 if dy < 2 else 2)))
                    continue
                if x >= 62:
                    cv.set(x, y, c("ibushi", 3 if (x == 62 and dy < 2) else 1) if x == 62 else c("ink", 0))
                    continue

                tx = (x + offset) % 6
                tile_id = (x + offset) // 6 + ci * 13
                jitter = (hash2d(tile_id, ci, 11) % 3) - 1
                use_ibushi = (hash2d(tile_id, ci, 29) % 3) != 0
                rname = "ibushi" if use_ibushi else "kuro"

                if tx == 0:
                    col = c("kuro", 0 if dy >= ch_h - 2 else 1)
                elif dy == ch_h - 1:
                    col = c("ink", 0) if tx in (0, 5) else c("kuro", 1)
                elif dy == 0:
                    col = c(rname, max(1, 2 + lit_shift))
                elif dy == 1:
                    idx = 5 + lit_shift + (1 if tx in (1, 2) else 0) + min(0, jitter)
                    col = c(rname, idx)
                else:
                    idx = 3 + lit_shift + jitter + (1 if tx == 1 else (0 if tx < 4 else -1))
                    col = c(rname, max(1, idx))

                if ci >= 4 and dy in (1, 2) and tx in (2, 3) and hash2d(x, y, 73) % 19 == 0:
                    col = c("moss", 2 if dy == 2 else 3)

                cv.set(x, y, col)

    # Roof eave fascia, iron gutter & brackets (y=39..42)
    for x in range(64):
        cv.set(x, 39, c("ibushi", 5 if x % 6 in (1, 2) else 3))
        cv.set(x, 40, c("kuro", 1))
        cv.set(x, 41, c("darkwood", 3 if x % 8 not in (0, 7) else 1))
        cv.set(x, 42, c("ink", 0))
        if x % 8 == 3:
            cv.set(x, 40, c("steel", 4))
            cv.set(x, 41, c("steel", 2))

    # Bold diagonal cast shadow from massive chimney onto dark-slate roof (down-right)
    for y in range(10, 39):
        sx0 = 19
        sx1 = min(36, 21 + (y - 9) // 2)
        for x in range(sx0, sx1 + 1):
            if x <= sx0 + 5:
                cv.shade_px(x, y, -3)
            elif x < sx1 - 1:
                cv.shade_px(x, y, -2)
            else:
                cv.shade_px(x, y, -1)

    # Massive rugged brick-and-stone Forge Chimney on left roof (x=5..19, y=4..35)
    for x in range(5, 20):
        cv.set(x, 34, c("steel", 3 if x < 12 else 2))
        cv.set(x, 35, c("ink", 0))
    cv.set(5, 33, c("stone", 4))
    cv.set(19, 33, c("stone", 1))

    # Chimney shaft (x=6..18, y=10..33): dressed stone quoins + fired brick core
    for y in range(10, 34):
        row = (y - 10) // 3
        is_mortar = ((y - 10) % 3) == 2
        soot = 1 if y < 15 else 0
        for x in range(6, 19):
            if x == 6 or x == 18:
                cv.set(x, y, c("ink", 0) if x == 18 else c("stone", 1))
            elif (x in (7, 8) and row % 2 == 0) or (x == 7 and row % 2 == 1):
                cv.set(x, y, c("stone", 2 if is_mortar else (5 - soot if x == 7 else 4 - soot)))
            elif (x in (16, 17) and row % 2 == 1) or (x == 17 and row % 2 == 0):
                cv.set(x, y, c("stone", 1 if is_mortar else 2))
            else:
                b_off = (row % 2) * 2
                is_vjoint = ((x + b_off) % 4) == 0
                if is_mortar or is_vjoint:
                    cv.set(x, y, c("brick", 1) if x < 14 else c("ink", 1))
                else:
                    light = 5 if x < 11 else (4 if x < 14 else 2)
                    jitter = (hash2d(x, row, 55) % 2)
                    cv.set(x, y, c("brick", max(1, light - soot - jitter)))

        if y == 20:
            for x in range(6, 19):
                cv.set(x, y, c("steel", 5 if x < 10 else (3 if x < 16 else 1)))
            cv.set(9, y, c("coolwhite", 4))
            cv.set(15, y, c("steel", 4))
        elif y == 21:
            cv.hline(6, 18, y, c("ink", 0))

    # Stepped corbelled stone chimney crown (x=4..20, y=6..9)
    cv.hline(5, 19, 9, c("ink", 0))
    for x in range(5, 20):
        cv.set(x, 8, c("stone", 5 if x < 11 else (3 if x < 16 else 1)))
    for x in range(4, 21):
        if x in (4, 20):
            cv.set(x, 6, c("stone", 2))
            cv.set(x, 7, c("ink", 0))
        else:
            cv.set(x, 6, c("stone", 6 if x < 11 else (4 if x < 17 else 2)))
            cv.set(x, 7, c("flagstone", 4 if x < 11 else (2 if x < 17 else 1)))

    # Twin soot-blackened flue pots (x=6..10 and x=13..17, y=4..5) with glowing throats
    for fx in (6, 13):
        cv.rect(fx, 4, fx + 4, 5, c("asphalt", 2))
        cv.vline(fx, 4, 5, c("asphalt", 4))
        cv.vline(fx + 4, 4, 5, c("ink", 0))
        cv.set(fx, 3, c("asphalt", 3))
        cv.set(fx + 1, 3, c("orange", 4))
        cv.set(fx + 2, 3, c("yellow", 4))
        cv.set(fx + 3, 3, c("red", 3))
        cv.set(fx + 4, 3, c("ink", 0))

    # Organic billowing ember-tinted smoke wisps & glowing sparks (y=0..6, x=8..37)
    smoke_rows = [
        "......ccCCc...ccC...........",  # y=0: rounded billow tops
        "...ccCCCCCCccCCCCc..*..cc...",  # y=1: sunlit upper smoke + spark
        "..cCCaaCCaaCCaaaCCc...cCCa..",  # y=2: smoke volume + mid-soot
        "..aoYYoaaoYYooaaaCCc.*aCCa..",  # y=3: forge-ember underlighting!
        "........*..ooaa...aa....aa..",  # y=4: trailing wisp & spark
        "................*.......*...",  # y=5: drifting embers
    ]
    cv.sprite(
        8,
        0,
        smoke_rows,
        {
            "C": c("concrete", 5),
            "c": c("concrete", 3),
            "a": c("asphalt", 2),
            "o": c("orange", 4),
            "Y": c("yellow", 4),
            "*": c("yellow", 5),
        },
    )
    cv.set(27, 4, c("orange", 4))
    cv.set(34, 5, c("red", 4))

    # --------------------------------------------------------------------------
    # 2. 2F FACADE (y=42..74): Rugged stone & dark-timber loft, shuttered window,
    #    cathead pulley hook, and wrought-iron silver anvil & crossed hammer sign
    # --------------------------------------------------------------------------
    for x in range(64):
        cv.set(x, 43, c("ink", 0))
        cv.set(x, 44, c("darkwood", 2 if x % 9 != 0 else 1))
        cv.set(x, 45, c("darkwood", 4 if x % 7 not in (0, 6) else 2))

        cv.set(x, 70, c("wood", 5 if x % 8 not in (0, 7) else 3))
        cv.set(x, 71, c("darkwood", 4))
        cv.set(x, 72, c("darkwood", 2))
        cv.set(x, 73, c("ink", 0))
        if x in (3, 19, 37, 59):
            cv.rect(x, 70, x + 1, 71, c("steel", 4))
            cv.set(x, 70, c("coolwhite", 4))

    # Rugged stone wall courses (y=46..69, x=0..63)
    for y in range(46, 70):
        brow = (y - 46) // 4
        bmortar = ((y - 46) % 4) == 3
        boff = (brow % 2) * 4
        for x in range(64):
            if bmortar or ((x + boff) % 8) == 0:
                cv.set(x, y, c("stone", 1 if y > 47 else 0))
                continue
            bid = ((x + boff) // 8) + brow * 11
            tone = 3 + (hash2d(bid, brow, 41) % 3) - (1 if y < 48 else 0)
            rname = "flagstone" if (bid % 3 == 0) else "stone"
            if (y - 46) % 4 == 0 and tone < 5:
                tone += 1
            cv.set(x, y, c(rname, tone))

    # Vertical heavy dark-timber posts on 2F (x=0..3, x=36..38, x=60..63)
    for px0, pw in ((0, 4), (36, 3), (60, 4)):
        for y in range(44, 73):
            for dx in range(pw):
                x = px0 + dx
                if dx == 0 or dx == pw - 1:
                    cv.set(x, y, c("ink", 0) if dx == pw - 1 else c("darkwood", 1))
                else:
                    grain = (hash2d(x, y // 3, 19) % 2)
                    cv.set(x, y, c("darkwood", 4 - grain if dx == 1 else 3 - grain))

    # Diagonal timber knee-braces at top corners of 2F bays
    for bx, bdir in ((4, 1), (35, -1), (39, 1), (59, -1)):
        for i in range(5):
            cv.set(bx + bdir * i, 46 + (4 - i), c("darkwood", 3))
            cv.set(bx + bdir * i, 47 + (4 - i), c("darkwood", 1))

    # Shuttered Loft Window (x=6..26, y=48..65)
    for x in range(10, 23):
        cv.set(x, 48, c("stone", 5 if x < 18 else 4))
        cv.set(x, 49, c("darkwood", 1))
        cv.set(x, 64, c("stone", 6 if x < 18 else 4))
        cv.set(x, 65, c("stone", 2))
    cv.hline(11, 23, 66, c("stone", 1))

    cv.rect(11, 50, 21, 63, c("darkwood", 2))
    cv.rect(12, 51, 20, 62, c("glass", 1))
    for y in range(51, 63):
        for x in range(12, 21):
            if x == 16 or y == 56:
                cv.set(x, y, c("darkwood", 3))
            elif y >= 58 and x in (13, 14, 15, 17, 18, 19):
                cv.set(x, y, c("orange", 4 if y >= 60 else 3))
            elif (x + y) % 5 == 0 and y < 56:
                cv.set(x, y, c("glass", 4))
            else:
                cv.set(x, y, c("glass", 2 if y < 56 else 1))
    cv.set(14, 61, c("yellow", 4))
    cv.set(18, 61, c("yellow", 3))

    # Open planked & iron-strapped wooden shutters (left x=6..10, right x=22..26, y=50..63)
    for sx0 in (6, 22):
        cv.rect(sx0, 50, sx0 + 4, 63, c("darkwood", 1))
        for y in range(51, 63):
            for dx in range(1, 4):
                cv.set(sx0 + dx, y, c("cedar", 4 if dx == 1 else (3 if dx == 2 else 2)))
        for hy in (52, 60):
            for dx in range(0, 5):
                cv.set(sx0 + dx, hy, c("steel", 4 if dx in (1, 2) else 2))
        cv.vline(sx0 + 5, 51, 64, c("stone", 1))

    # Hoist Cathead Beam & Wrought-Iron Pulley Hook (x=28..35, y=47..66)
    # Crisp dark silhouette backing so pulley, rope, and iron hook pop at 1x!
    cv.rect(28, 47, 35, 49, c("wood", 4))
    cv.hline(28, 35, 47, c("cedar", 5))
    cv.hline(28, 35, 49, c("ink", 0))
    cv.set(28, 48, c("steel", 5))
    pulley_rows = [
        ".iSSi.",  # y=50: pulley wheel mount
        "iSWMSi",  # y=51: iron wheel top
        "iSMMSi",  # y=52: iron wheel bottom
        ".iRRi.",  # y=53: rope exit
        "..Ri..",  # y=54: taut golden hemp rope + dark shadow
        "..ri..",  # y=55
        "..Ri..",  # y=56
        "..ri..",  # y=57
        "..Ri..",  # y=58
        "..Si..",  # y=59: iron swivel collar
        ".iWSi.",  # y=60: hook shank
        "iSWi..",  # y=61: curved forged iron hook
        "iSi.i.",  # y=62
        "iSWWSi",  # y=63: hook bend + sharp point!
        ".iiii.",  # y=64: drop shadow
    ]
    cv.sprite(
        28,
        50,
        pulley_rows,
        {
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "M": c("steel", 3),
            "R": c("straw", 5),
            "r": c("yellow", 3),
            "i": c("ink", 0),
        },
    )

    # Wrought-Iron Hanging Signboard (x=40..59, y=46..68):
    # Crisp SILVER ANVIL & CROSSED HAMMER emblem!
    cv.hline(39, 58, 47, c("ink", 0))
    cv.hline(40, 57, 46, c("steel", 4))
    cv.set(58, 46, c("steel", 5))
    cv.set(59, 47, c("steel", 4))
    cv.set(58, 48, c("steel", 2))
    cv.line(39, 50, 43, 47, c("steel", 2))
    cv.set(45, 48, c("steel", 4))
    cv.set(45, 49, c("ink", 0))
    cv.set(54, 48, c("steel", 4))
    cv.set(54, 49, c("ink", 0))

    cv.shade_rect(43, 52, 59, 69, -2)
    cv.rect(41, 50, 58, 67, c("ink", 0))
    cv.hline(42, 57, 50, c("yellow", 3))
    cv.vline(41, 51, 66, c("yellow", 3))
    cv.hline(42, 57, 67, c("yellow", 1))
    cv.vline(58, 51, 66, c("yellow", 1))
    for y in range(51, 67):
        for x in range(42, 58):
            cv.set(x, y, c("navy", 1 if (x + y) < 108 else 0))
    for rx, ry in ((42, 51), (57, 51), (42, 66), (57, 66)):
        cv.set(rx, ry, c("yellow", 4))

    # Full CROSSED BLACKSMITH HAMMER + GLEAMING SILVER HORNY ANVIL (16x14 inside 42..57, 52..65)
    # Hammer crosses diagonally (top-left steel cross-peen head -> bottom-right oak grip poking out!),
    # paired with a crisp silver anvil + golden strike sparks!
    anvil_sign_rows = [
        "....sWWs........",  # y=52: gleaming silver hammerhead top
        "...sWWWWsh..*...",  # y=53: heavy cross-peen hammerhead + spark
        "....shWwsh.Y*...",  # y=54: hammer face + golden spark burst
        "......iwW.o.....",  # y=55: diagonal oak shaft + orange spark
        ".......iwW......",  # y=56: diagonal oak shaft behind anvil
        "..sWWWWWWWWWWs..",  # y=57: gleaming flat silver anvil face!
        "sWWWWSSSSSSSSSs.",  # y=58: sharp left horn + sculpted upper anvil
        "..ssMMMMMMMMs...",  # y=59: anvil shoulder
        "....dSSSSSSd....",  # y=60: narrow anvil waist
        "....dMMMMMMwi...",  # y=61: waist + crossed hammer handle emerging!
        "..sSSSSSSSSSwW..",  # y=62: flared anvil foot + oak hammer grip
        ".dMMMMMMMMMMdwy.",  # y=63: heavy anvil base + brass handle pommel!
    ]
    cv.sprite(
        42,
        52,
        anvil_sign_rows,
        {
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "M": c("steel", 4),
            "s": c("steel", 3),
            "d": c("steel", 2),
            "h": c("steel", 4),
            "w": c("cedar", 5),
            "y": c("yellow", 4),
            "*": c("yellow", 5),
            "Y": c("yellow", 4),
            "o": c("orange", 4),
            "i": c("ink", 0),
        },
    )

    # --------------------------------------------------------------------------
    # 3. 1F OPEN FORGE BAY & WORKSHOP (y=74..112)
    # --------------------------------------------------------------------------
    # Heavy cobble & flagstone apron across y=106..111 with smooth warm forge rim-lighting
    for y in range(106, 112):
        for x in range(64):
            if y == 111:
                cv.set(x, y, c("ink", 0))
                continue
            cid = (x + (y % 2) * 3) // 5 + y * 7
            joint = ((x + (y % 2) * 3) % 5) == 0 or (y == 109 and x % 4 == 0)
            if joint:
                cv.set(x, y, c("pavement", 0) if x > 22 else c("brick", 1))
            else:
                base = 2 + (hash2d(cid, y, 67) % 3)
                dist = abs(x - 14) + (y - 106) * 3
                if 7 <= x <= 26 and dist <= 9:
                    cv.set(x, y, c("orange", 3 if y == 106 and 10 <= x <= 18 else 2))
                elif 5 <= x <= 32 and dist <= 16:
                    cv.set(x, y, c("soil", 3 if base >= 3 else 2))
                else:
                    cv.set(x, y, c("pavement", base))

    # Main 1F oak lintel beam (y=74..76)
    for x in range(64):
        cv.set(x, 74, c("wood", 4 if x % 10 != 0 else 2))
        cv.set(x, 75, c("darkwood", 3))
        cv.set(x, 76, c("ink", 0))

    # Right Bay Stone Wall (x=40..63, y=77..106)
    for y in range(77, 107):
        srow = (y - 77) // 4
        smortar = ((y - 77) % 4) == 3
        soff = (srow % 2) * 4
        for x in range(40, 64):
            if smortar or ((x + soff) % 7 == 0):
                cv.set(x, y, c("stone", 1))
            else:
                tone = 3 + (hash2d(x // 7, srow, 83) % 3) - (1 if y < 79 else 0)
                cv.set(x, y, c("stone", tone))

    # Sturdy 1F Timber & Stone Piers: Left (x=0..4), Center Post (x=37..40), Right (x=60..63)
    for y in range(74, 108):
        cv.set(0, y, c("ink", 0))
        cv.set(1, y, c("stone", 4 if (y % 5) < 4 else 2))
        cv.set(2, y, c("stone", 3 if (y % 5) < 4 else 1))
        cv.set(3, y, c("darkwood", 3))
        cv.set(4, y, c("ink", 0))
        if y >= 103:
            cv.set(37, y, c("stone", 4))
            cv.set(38, y, c("stone", 5))
            cv.set(39, y, c("stone", 3))
            cv.set(40, y, c("ink", 0))
        else:
            cv.set(37, y, c("darkwood", 2))
            cv.set(38, y, c("wood", 4 if y % 6 != 0 else 3))
            cv.set(39, y, c("darkwood", 3))
            cv.set(40, y, c("ink", 0))
        cv.set(60, y, c("darkwood", 2))
        cv.set(61, y, c("stone", 4 if (y % 5) < 4 else 2))
        cv.set(62, y, c("stone", 2))
        cv.set(63, y, c("ink", 0))

    # Open Forge Workshop Interior Coursed Soot-Stone Back Wall (x=5..36, y=77..105)
    for y in range(77, 106):
        wrow = (y - 77) // 3
        wmortar = ((y - 77) % 3) == 2
        woff = (wrow % 2) * 3
        for x in range(5, 37):
            if y >= 101:
                cv.set(x, y, c("asphalt", 1 if (x + y) % 3 != 0 else 2))
            elif wmortar or ((x + woff) % 6 == 0):
                cv.set(x, y, c("ink", 0))
            elif x <= 24:
                cv.set(x, y, c("darkwood", 2 if (wrow + x) % 2 == 0 else 1))
            else:
                cv.set(x, y, c("asphalt", 1) if wrow % 2 == 0 else c("ink", 1))

    # Timber knee-braces framing the open forge bay
    for i in range(5):
        cv.set(5 + i, 81 - i, c("wood", 3))
        cv.set(5 + i, 82 - i, c("darkwood", 1))
        cv.set(36 - i, 81 - i, c("wood", 3))
        cv.set(36 - i, 82 - i, c("darkwood", 1))

    # Stone & Brick Forge Hood & Roaring Furnace (x=6..21, y=77..105)
    for y in range(77, 86):
        inset = (85 - y) // 3
        lx = 6 + inset
        rx = 21 - inset
        for x in range(lx, rx + 1):
            if x == lx:
                cv.set(x, y, c("stone", 4))
            elif x == rx:
                cv.set(x, y, c("ink", 0))
            elif y % 3 == 0 or (x + (y // 3) * 2) % 4 == 0:
                cv.set(x, y, c("brick", 1))
            else:
                cv.set(x, y, c("brick", 4 if x < 14 else 3))

    for x in range(6, 22):
        cv.set(x, 86, c("steel", 4 if x < 15 else 2))
        cv.set(x, 87, c("ink", 0))
    for rx in (7, 11, 16, 20):
        cv.set(rx, 86, c("coolwhite", 4))

    for y in range(88, 106):
        for x in range(6, 22):
            if x in (6, 7):
                cv.set(x, y, c("stone", 4 if y % 4 != 0 else 2))
            elif x in (20, 21):
                cv.set(x, y, c("stone", 2) if x == 20 else c("ink", 0))
            elif y >= 97:
                if y == 97:
                    cv.set(x, y, c("orange", 3 if 9 <= x <= 17 else 2))
                elif y % 3 == 0 or (x + y) % 5 == 0:
                    cv.set(x, y, c("stone", 1))
                else:
                    cv.set(x, y, c("stone", 3 if x < 15 else 2))

    # Roaring Fiery Orange-Yellow-White Forge Fire inside mouth (x=8..19, y=88..96)
    fire_rows = [
        "ddrrroooordd",
        "drrooYYooorr",
        "rooYYYYYYoor",
        "roYYWWWWYYor",
        "ooYWWWWWWYoo",
        "oYYWWWWWYYoo",
        "roYYYYYYYYor",
        "rrooooooooor",
        "drrrrooorrrd",
    ]
    cv.sprite(
        8,
        88,
        fire_rows,
        {
            "d": c("brick", 1),
            "r": c("red", 3),
            "o": c("orange", 4),
            "Y": c("yellow", 4),
            "W": c("white", 6),
        },
    )
    cv.set(11, 95, c("yellow", 5))
    cv.set(15, 95, c("yellow", 5))
    cv.set(13, 91, c("yellow", 5))

    # Hanging smithy tool rack on interior back wall (x=23..35, y=79..88)
    cv.hline(23, 35, 80, c("wood", 3))
    cv.hline(23, 35, 81, c("ink", 0))
    # Iron tongs, horseshoe, hand hammer
    cv.vline(24, 81, 87, c("steel", 4))
    cv.vline(25, 84, 88, c("steel", 3))
    cv.set(28, 82, c("steel", 4))
    cv.set(30, 82, c("steel", 4))
    cv.vline(28, 83, 85, c("steel", 5))
    cv.vline(30, 83, 85, c("steel", 3))
    cv.set(29, 86, c("steel", 4))
    cv.rect(32, 82, 34, 83, c("steel", 5))
    cv.vline(33, 84, 88, c("cedar", 4))

    # Leather-and-oak Forge Bellows feeding furnace side (x=21..28, y=89..93)
    cv.hline(21, 23, 91, c("steel", 4))  # iron nozzle into furnace
    cv.rect(23, 89, 27, 92, c("cedar", 3))
    cv.hline(23, 27, 89, c("wood", 5))
    cv.hline(24, 28, 90, c("soil", 3))  # pleated leather
    cv.set(28, 89, c("wood", 4))  # bellows handle

    # Heavy Steel ANVIL ON OAK STUMP in foreground (x=19..30, y=94..107)
    anvil_1f_rows = [
        ".....oYYYo..",  # y=94: glowing hot blade blank on anvil face!
        "..sWWWWWWWs.",  # y=95: gleaming flat silver top + horn
        "osSSSSSSSSSi",  # y=96: tapered sharp horn left + steel body
        "..ioMMMMMMdi",  # y=97: forge-lit shoulder + crisp shadow
        "...ioSSSSdi.",  # y=98: narrow anvil waist
        "..isSSSSSSdi",  # y=99: flared steel foot
        "..iiIIIIIIii",  # y=100: bolted base plate
        "...wCCCCCCi.",  # y=101: chunky oak tree-stump top
        "...sSSSSSSi.",  # y=102: iron hoop around stump
        "...oWcCCCdi.",  # y=103: forge-lit oak bark & grain
        "...oWcCCCdi.",  # y=104
        "...wWcCCCdi.",  # y=105
        "...dCCCCCCi.",  # y=106: stump root flare
    ]
    cv.sprite(
        19,
        94,
        anvil_1f_rows,
        {
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "M": c("steel", 4),
            "s": c("steel", 3),
            "d": c("steel", 2),
            "I": c("steel", 2),
            "i": c("ink", 0),
            "Y": c("yellow", 5),
            "o": c("orange", 4),
            "C": c("wood", 3),
            "c": c("wood", 2),
            "w": c("cedar", 4),
        },
    )
    for sy in (103, 104, 105):
        cv.set(23, sy, c("cedar", 4))

    # Water Quench Barrel (x=31..36, y=97..107)
    barrel_rows = [
        ".sBBBs",  # y=97: rim + cool quench water
        "sTWWWT",  # y=98: bright teal/blue water surface
        "iwwwww",  # y=99: upper oak staves
        "sSSSSd",  # y=100: upper iron hoop
        "wCCCCd",  # y=101: barrel belly
        "wCcCCd",  # y=102
        "wCCCCd",  # y=103
        "sSSSSd",  # y=104: lower iron hoop
        "wCcCCd",  # y=105
        "dcccci",  # y=106: barrel base
    ]
    cv.sprite(
        31,
        97,
        barrel_rows,
        {
            "s": c("steel", 4),
            "S": c("steel", 3),
            "B": c("glass", 4),
            "T": c("teal", 4),
            "W": c("glass", 6),
            "w": c("cedar", 4),
            "C": c("wood", 3),
            "c": c("wood", 2),
            "d": c("darkwood", 1),
            "i": c("ink", 0),
        },
    )
    cv.set(33, 95, c("coolwhite", 4))
    cv.set(34, 94, c("coolwhite", 3))

    # Right Bay: Heavy Iron-Studded Oak Door (x=42..51, y=79..107)
    for y in range(79, 108):
        cv.set(41, y, c("stone", 5 if y % 4 != 0 else 3))
        cv.set(52, y, c("stone", 2 if y % 4 != 0 else 1))
    for x in range(42, 52):
        cv.set(x, 78, c("stone", 5 if x < 48 else 4))
        cv.set(x, 79, c("ink", 0))
    for y in range(80, 108):
        for x in range(42, 52):
            if x in (42, 51):
                cv.set(x, y, c("ink", 0) if x == 51 else c("darkwood", 1))
            elif x in (45, 48):
                cv.set(x, y, c("darkwood", 2))
            else:
                cv.set(x, y, c("wood", 4 if x < 47 else 3))
    for sy in (83, 92, 102):
        for x in range(42, 51):
            cv.set(x, sy, c("steel", 3 if x % 2 == 0 else 2))
        for rx in (43, 46, 49):
            cv.set(rx, sy, c("steel", 5))
    cv.rect(45, 85, 48, 89, c("ink", 0))
    for gy in range(86, 89):
        cv.set(46, gy, c("orange", 3))
        cv.set(47, gy, c("steel", 4))
        cv.set(48, gy, c("orange", 2))
    cv.set(49, 95, c("yellow", 4))
    cv.set(49, 96, c("yellow", 3))
    cv.set(48, 96, c("yellow", 4))
    for x in range(41, 53):
        cv.set(x, 107, c("stone", 5 if x < 49 else 3))
        cv.set(x, 108, c("stone", 2))

    # Outdoor Weapon Display Rack & Stacked Iron/Bronze Ingots (x=53..61, y=83..109)
    cv.vline(53, 90, 103, c("darkwood", 2))
    cv.vline(60, 90, 103, c("ink", 0))
    cv.hline(53, 60, 92, c("wood", 4))
    cv.hline(53, 60, 99, c("wood", 3))

    # Gleaming upright Steel Broadsword (x=55) with crisp dark outline
    cv.set(55, 83, c("ink", 0))
    cv.set(55, 84, c("yellow", 4))
    cv.vline(55, 85, 86, c("wood", 3))
    cv.hline(54, 56, 87, c("yellow", 4))
    for by in range(88, 101):
        cv.set(54, by, c("ink", 0))
        cv.set(55, by, c("coolwhite", 5 if by < 95 else 4))
        cv.set(56, by, c("steel", 3))
    # Dwarven Battle-Axe (x=58)
    cv.vline(58, 85, 101, c("cedar", 4))
    cv.rect(57, 86, 59, 89, c("steel", 5))
    cv.vline(57, 86, 89, c("coolwhite", 5))
    cv.vline(60, 86, 89, c("ink", 0))
    cv.set(59, 87, c("steel", 3))

    # Stacked Iron & Bronze Ingots in foreground (x=52..62, y=102..109)
    cv.hline(52, 62, 108, c("wood", 3))
    cv.hline(52, 62, 109, c("ink", 0))
    ingots = [
        (52, 106, "steel"),
        (56, 106, "steel"),
        (59, 106, "steel"),
        (54, 104, "steel"),
        (58, 104, "steel"),
        (56, 102, "orange"),
    ]
    for ix, iy, iramp in ingots:
        if iramp == "steel":
            cv.hline(ix + 1, ix + 2, iy, c("coolwhite", 4))
            cv.set(ix, iy + 1, c("steel", 5))
            cv.set(ix + 1, iy + 1, c("steel", 4))
            cv.set(ix + 2, iy + 1, c("steel", 3))
            cv.set(ix + 3, iy + 1, c("ink", 0))
        else:
            cv.hline(ix + 1, ix + 2, iy, c("yellow", 4))
            cv.set(ix, iy + 1, c("orange", 4))
            cv.set(ix + 1, iy + 1, c("orange", 3))
            cv.set(ix + 2, iy + 1, c("orange", 2))
            cv.set(ix + 3, iy + 1, c("ink", 0))

    return cv.img


# ==============================================================================
# BUILDING 2: ft-armory.png (64x112) — Royal Arms & Armor Outfitter
# ==============================================================================
def build_armory(ramps, color_to_ramp) -> Image.Image:
    cv = Canvas(64, 112, ramps, color_to_ramp)
    c = cv.c

    # --------------------------------------------------------------------------
    # 1. ROOF (y=0..42): Crisp steep ㅅ-gable brown `cha` tiled roof with
    #    half-timber plaster gable wall, attic louver & wrought-iron finial!
    # --------------------------------------------------------------------------
    # Receding rear roof shoulders (y=21..34, x=0..14 and x=49..63)
    for y in range(21, 35):
        course = (y - 21) // 4
        dy = (y - 21) % 4
        off = (course % 2) * 2
        for x in range(64):
            if 12 < x < 51:
                continue
            if (x == 0 or x == 63) and y < 23:
                continue
            lit = 1 if x < 32 else 0
            if dy == 3:
                cv.set(x, y, c("cha", 1))
            elif (x + off) % 4 == 0:
                cv.set(x, y, c("cha", 1 + lit))
            else:
                cv.set(x, y, c("cha", (4 if dy == 1 else 3) + lit))

    # Half-Timber Cream Plaster Gable Wall inside the ㅅ-triangle (y=11..35)
    for x in range(4, 60):
        d = min(abs(x - 31), abs(x - 32))
        y_barge = 5 + (d * 27) // 31 + 8
        if y_barge >= 35:
            continue
        for y in range(y_barge, 35):
            n = hash2d(x, y, 31) % 7
            if y == y_barge:
                col = c("cream", 1)
            elif y == y_barge + 1:
                col = c("cream", 3)
            elif n == 0:
                col = c("kinari", 4)
            elif n == 1:
                col = c("cream", 4)
            else:
                col = c("cream", 5 if x < 34 else 4)
            cv.set(x, y, col)

    # Half-Timber Dark-Oak Framing inside Gable Wall
    for x in range(11, 53):
        d = min(abs(x - 31), abs(x - 32))
        yb = 5 + (d * 27) // 31 + 8
        if 27 >= yb:
            cv.set(x, 27, c("wood", 3))
            cv.set(x, 28, c("darkwood", 1))
            cv.shade_px(x, 29, -1)
    for y in range(11, 35):
        cv.set(31, y, c("wood", 3))
        cv.set(32, y, c("darkwood", 2))
    for sx in (20, 42):
        for y in range(22, 35):
            cv.set(sx, y, c("wood", 3))
            cv.set(sx + 1, y, c("darkwood", 1))
    for i in range(6):
        cv.set(14 + i, 34 - i, c("darkwood", 3))
        cv.set(15 + i, 34 - i, c("darkwood", 1))
        cv.set(22 + i, 29 + i, c("darkwood", 3))
        cv.set(41 - i, 29 + i, c("darkwood", 3))
        cv.set(49 - i, 34 - i, c("darkwood", 3))
        cv.set(48 - i, 34 - i, c("darkwood", 1))

    # Attic Louver Window in Gable Peak (x=27..36, y=15..25)
    cv.hline(28, 35, 15, c("wood", 4))
    cv.rect(27, 16, 36, 25, c("darkwood", 2))
    cv.vline(27, 16, 25, c("wood", 3))
    cv.vline(36, 16, 25, c("ink", 0))
    cv.hline(26, 37, 25, c("stone", 5))
    cv.hline(27, 36, 26, c("cream", 2))
    for ly in range(17, 25):
        if ly % 2 == 1:
            cv.hline(28, 35, ly, c("cedar", 4 if ly < 21 else 3))
        else:
            cv.hline(28, 35, ly, c("ink", 0))

    # Steep ㅅ-Gable Staggered Brown `cha` Tile Roof Wings (x=0..63)
    for x in range(64):
        is_left = x <= 31
        d = (31 - x) if is_left else (x - 32)
        y_top = 5 + (d * 27) // 31
        # Shadow cast on rear roof shoulder immediately above gable verge
        if y_top >= 22 and cv.get(x, y_top - 1)[3] == 255:
            cv.shade_px(x, y_top - 1, -2)
        for dy in range(9):
            y = y_top + dy
            if y > 35:
                continue
            if dy == 0:
                col = c("cha", 6 if is_left else 4) if d > 0 else c("cha", 7)
                if x in (0, 63):
                    col = c("cha", 2)
            elif dy == 7:
                col = c("wood", 4 if is_left else 3)
                if d % 5 == 2:
                    col = c("yellow", 4 if is_left else 3)
            elif dy == 8:
                col = c("ink", 0)
            else:
                row_id = y // 3
                off = (row_id % 2) * 2
                seam = ((x + off) % 4 == 0) or (y % 3 == 2)
                base_lit = 5 if is_left else 3
                if dy == 1:
                    col = c("cha", base_lit + 1)
                elif seam:
                    col = c("cha", max(1, base_lit - 3))
                else:
                    jit = (hash2d(x // 4, row_id, 77) % 2)
                    r_choice = "cha" if (row_id + x) % 5 != 0 else "rooftile"
                    col = c(r_choice, max(1, base_lit - jit))
            cv.set(x, y, col)

    # Ornate Wrought-Iron Spear Finial at Apex (x=29..34, y=0..7)
    finial_rows = [
        "..WS..",  # y=0: gleaming iron spearhead
        ".iWMi.",  # y=1: dark-outlined blade
        "isWWdi",  # y=2: cross-guard scrolls
        ".iYYi.",  # y=3: gilt brass orb collar
        ".iMMi.",  # y=4: forged iron socket
        ".cCCd.",  # y=5: ridge saddle cap
        ".cCCd.",  # y=6
        "..ii..",  # y=7: dark ornament drop
    ]
    cv.sprite(
        29,
        0,
        finial_rows,
        {
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "M": c("steel", 4),
            "s": c("steel", 3),
            "d": c("cha", 2),
            "C": c("cha", 6),
            "c": c("cha", 7),
            "Y": c("yellow", 4),
            "i": c("ink", 0),
        },
    )

    # Full-Width Staggered `cha` Tiled Pent-Eave Skirt across y=35..42
    for y in range(35, 43):
        if y == 41:
            for x in range(64):
                cv.set(x, y, c("darkwood", 3 if x % 6 != 0 else 1))
            continue
        if y == 42:
            cv.hline(0, 63, y, c("ink", 0))
            continue
        prow = (y - 35) // 3
        pdy = (y - 35) % 3
        poff = (prow % 2) * 2
        for x in range(64):
            if x in (0, 63):
                cv.set(x, y, c("cha", 2 if x == 0 else 0))
            elif pdy == 2:
                cv.set(x, y, c("cha", 1) if (x + poff) % 4 != 0 else c("ink", 0))
            elif (x + poff) % 4 == 0:
                cv.set(x, y, c("cha", 2))
            else:
                lit = 6 if (pdy == 0 and x < 48) else (5 if pdy == 0 else 4)
                if x > 50:
                    lit -= 1
                cv.set(x, y, c("cha", lit))

    # --------------------------------------------------------------------------
    # 2. 2F FACADE (y=42..74): Dressed limestone & dark-oak timber facade,
    #    mullioned windows, and royal Blue-and-Gold Kite Shield + Helm + Swords crest!
    # --------------------------------------------------------------------------
    def draw_limestone_wall(x0: int, x1: int, y0: int, y1: int, top_shadow_rows: int = 2):
        for y in range(y0, y1 + 1):
            lrow = (y - y0) // 4
            lmortar = ((y - y0) % 4) == 3
            loff = (lrow % 2) * 5
            for x in range(x0, x1 + 1):
                if y - y0 == 0 and top_shadow_rows >= 1:
                    cv.set(x, y, c("stone", 2))
                elif y - y0 == 1 and top_shadow_rows >= 2:
                    cv.set(x, y, c("cream", 2))
                elif lmortar or ((x + loff) % 10 == 0):
                    cv.set(x, y, c("stone", 4))
                else:
                    bid = ((x + loff) // 10) + lrow * 9
                    v = hash2d(bid, lrow, 101) % 3
                    if (y - y0) % 4 == 0:
                        col = c("cream", 6 if v == 0 else 5)
                    elif v == 0:
                        col = c("cream", 5)
                    elif v == 1:
                        col = c("stone", 6)
                    else:
                        col = c("kinari", 5)
                    cv.set(x, y, col)

    draw_limestone_wall(0, 63, 43, 73, top_shadow_rows=2)

    # Dark-Oak Timber Framing on 2F
    for x in range(64):
        cv.set(x, 45, c("darkwood", 3))
        cv.set(x, 46, c("darkwood", 1))
        cv.set(x, 71, c("wood", 4 if x % 8 != 0 else 2))
        cv.set(x, 72, c("darkwood", 2))
        cv.set(x, 73, c("ink", 0))
    for px0, pw in ((0, 3), (20, 2), (42, 2), (61, 3)):
        for y in range(43, 73):
            for dx in range(pw):
                x = px0 + dx
                if dx == pw - 1:
                    cv.set(x, y, c("darkwood", 1) if pw == 2 else c("ink", 0))
                else:
                    cv.set(x, y, c("wood", 3) if dx == 0 else c("darkwood", 3))

    # Left & Right Mullioned Leaded-Glass Windows (x=5..17, y=49..66 and x=46..58, y=49..66)
    for wx0 in (5, 46):
        for x in range(wx0 - 1, wx0 + 14):
            cv.set(x, 48, c("white", 6 if x < wx0 + 9 else 4))
            cv.set(x, 66, c("white", 6 if x < wx0 + 9 else 4))
            cv.set(x, 67, c("stone", 3))
        cv.hline(wx0, wx0 + 13, 68, c("stone", 2))

        cv.rect(wx0, 49, wx0 + 12, 65, c("darkwood", 2))
        cv.hline(wx0, wx0 + 12, 49, c("ink", 0))
        for cx0 in (wx0 + 1, wx0 + 7):
            for y in range(50, 65):
                for x in range(cx0, cx0 + 5):
                    if y == 55:
                        cv.set(x, y, c("darkwood", 3))
                    elif (x + y) % 4 == 0:
                        cv.set(x, y, c("glass", 4 if y < 59 else 3))
                    elif (x - cx0 + y - 50) in (2, 3) and y < 55:
                        cv.set(x, y, c("glass", 6))
                    elif y >= 61 and x in (cx0 + 1, cx0 + 2, cx0 + 3):
                        cv.set(x, y, c("yellow", 4 if y >= 63 else 3))
                    else:
                        cv.set(x, y, c("glass", 2 if y < 58 else 1))
        for y in range(50, 65):
            cv.set(wx0 + 6, y, c("stone", 5 if y % 5 != 0 else 3))

    # CENTRAL ORNATE SIGNBOARD (x=22..41, y=46..70):
    # Painted Knight-Helm + Royal Blue-and-Gold Kite Shield + Crossed Broadswords
    # with crisp 1px dark outlines around blades & hilts so they pop against light limestone!
    cv.shade_rect(25, 49, 40, 70, -2)

    crest_rows = [
        "........rRRr........",  # y=46: crimson knight-helm plume crest
        ".iYi...rRRRRr...iYi.",  # y=47: golden pommels + flowing red plume
        "iYwYi..isWWdi..iYwYi",  # y=48: sword grips + silver knight great-helm
        ".iYYi.isSWWSdi.iYYi.",  # y=49: golden crossguards + helm brow
        "..iWSi.siiiiS.iSWi..",  # y=50: outlined gleaming blades + visor slit
        "...iWSi.sSSd.iSWi...",  # y=51: helm gorget + crossed blades
        "....iYYYYYYYYYYi....",  # y=52: gold top rim of royal kite shield
        "...iYBBBBnnBBBBYi...",  # y=53: quartered royal azure & navy field
        "...iYBBYyyyyYnnYi...",  # y=54: golden heraldic crown/lion top
        "...iYBBYYYYYYnnYi...",  # y=55: golden heraldic emblem
        "...iYBBBYYYYnnnYi...",  # y=56: golden chevron heart
        "....iYnnYYYYBBBii...",  # y=57: lower quartered field
        "....iYnnnYYBBBBi....",  # y=58
        ".....iYnnYYBBBi.....",  # y=59
        ".....iYnnnBBBBi.....",  # y=60
        "......iYnnBBYi......",  # y=61
        "......iYnnnnYi......",  # y=62: deep royal navy shadow toward tip
        "....iS.iYnnYi.Si....",  # y=63: crossed broadsword blades emerging!
        "...iWSi.iYYi.iSWi...",  # y=64: dark-outlined gleaming steel blades
        "..iWSi...ii...iSWi..",  # y=65: sharp steel tips + shield point
        "..iWi..........iWi..",  # y=66: razor-sharp points
        "...i............i...",  # y=67
    ]
    cv.sprite(
        22,
        46,
        crest_rows,
        {
            "r": c("red", 2),
            "R": c("red", 4),
            "y": c("yellow", 3),
            "Y": c("yellow", 4),
            "w": c("wood", 3),
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "s": c("steel", 3),
            "d": c("steel", 2),
            "B": c("blue", 4),
            "n": c("navy", 3),
            "i": c("ink", 0),
        },
    )
    cv.set(27, 52, c("yellow", 5))
    cv.set(28, 52, c("yellow", 5))
    cv.set(31, 54, c("yellow", 5))
    cv.set(32, 54, c("yellow", 5))

    # --------------------------------------------------------------------------
    # 3. 1F SHOWCASE, STRIPED AWNING, OAK DOOR & SPEAR/SHIELD RACK (y=74..112)
    # --------------------------------------------------------------------------
    # Ground dressed town flagstones (y=108..111, x=0..63)
    for y in range(108, 112):
        for x in range(64):
            if y == 111:
                cv.set(x, y, c("ink", 0))
            elif (x + (y % 2) * 4) % 7 == 0:
                cv.set(x, y, c("pavement", 1))
            else:
                v = hash2d(x // 7, y, 131) % 3
                cv.set(x, y, c("pavement", 3 + v if y < 110 else 2 + v))

    # Consistent horizontal dressed limestone ashlar blocks on 1F wall & piers!
    draw_limestone_wall(0, 2, 74, 107, top_shadow_rows=1)
    draw_limestone_wall(37, 63, 74, 107, top_shadow_rows=1)
    cv.vline(0, 74, 107, c("stone", 2))
    cv.vline(63, 74, 107, c("ink", 0))

    # Striped Crimson-and-Cream Canvas Awning over 1F Showcase (x=2..37, y=74..85)
    cv.hline(2, 37, 74, c("darkwood", 2))
    for y in range(75, 83):
        slope_shift = (y - 75) // 3
        for x in range(2, 38):
            stripe = ((x - 2 + slope_shift) // 4) % 2
            in_stripe = (x - 2 + slope_shift) % 4
            if x in (2, 37):
                cv.set(x, y, c("ink", 0) if x == 37 else c("red", 1))
                continue
            if stripe == 0:
                lit = 4 if y >= 80 else (3 if y >= 77 else 2)
                if in_stripe == 0:
                    lit = max(1, lit - 1)
                elif in_stripe == 1 and y >= 79:
                    lit = min(5, lit + 1)
                cv.set(x, y, c("red", lit))
            else:
                lit = 6 if y >= 80 else (5 if y >= 77 else 3)
                if in_stripe == 0:
                    lit -= 1
                cv.set(x, y, c("cream", lit))

    # Bright Leaded-Glass Showcase Window & Wainscoted Base (x=3..36, y=83..107)
    cv.rect(3, 83, 36, 107, c("darkwood", 2))
    for x in range(2, 38):
        stripe = ((x - 2 + 2) // 4) % 2
        in_s = (x - 2 + 2) % 4
        cv.set(x, 83, c("red", 2) if stripe == 0 else c("cream", 3))
        cv.set(x, 84, c("red", 3) if stripe == 0 else c("cream", 5))
        if in_s in (1, 2):
            cv.set(x, 85, c("yellow", 4) if stripe == 0 else c("cream", 4))
        elif 3 <= x <= 36:
            cv.set(x, 85, c("ink", 0))
    cv.hline(3, 36, 86, c("ink", 0))

    # Oak & Limestone Wainscoted Bulkhead below showcase (y=104..107, x=3..36)
    cv.hline(3, 36, 104, c("stone", 6))
    for y in range(105, 108):
        for x in range(3, 37):
            if x in (3, 14, 25, 36) or y == 107:
                cv.set(x, y, c("darkwood", 1) if y < 107 else c("ink", 0))
            else:
                cv.set(x, y, c("wood", 3 if y == 105 else 2))

    # Illuminated Showcase Interior (x=5..34, y=87..103)
    for y in range(87, 104):
        for x in range(5, 35):
            if x == 20:
                cv.set(x, y, c("yellow", 3 if y % 4 != 0 else 2))
            elif y == 87:
                cv.set(x, y, c("floorwood", 2))
            elif y >= 101:
                cv.set(x, y, c("maple", 4 if y == 101 else 2))
            else:
                cv.set(x, y, c("floorwood", 3 if (x + y) % 5 != 0 else 2))
    for lx in (12, 27):
        cv.hline(lx - 1, lx + 1, 87, c("yellow", 5))
        cv.hline(lx - 2, lx + 2, 88, c("orange", 4))

    # LEFT SHOWCASE PANE (x=6..18, y=89..102): Gleaming SILVER PLATE-ARMOR STAND!
    armor_stand_rows = [
        "....iWWi....",  # y=89: knight sallet helm crown
        "...iSWWSi...",  # y=90: gleaming steel helm
        "...siiiiS...",  # y=91: dark visor slit
        "....dSSd....",  # y=92: steel gorget
        ".iWWYSSYWWS.",  # y=93: broad gleaming pauldrons + gold trim!
        "iSWWSSSSWWsd",  # y=94: sculpted steel breastplate & shoulder guards
        "dMsSWWWWSMsd",  # y=95: bright specular chest cuirass
        "dM.sSSSSd.sd",  # y=96: gauntlets & waist fauld
        ".i.YSSSSY.i.",  # y=97: gilded knight belt
        "...sSMMSd...",  # y=98: steel tassets
        "...rRRRRr...",  # y=99: royal crimson tabard skirt
        "...rRYYRr...",  # y=100: gold-trimmed tabard
    ]
    cv.sprite(
        6,
        89,
        armor_stand_rows,
        {
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "M": c("steel", 4),
            "s": c("steel", 3),
            "d": c("steel", 2),
            "Y": c("yellow", 4),
            "R": c("red", 4),
            "r": c("red", 2),
            "i": c("ink", 0),
        },
    )
    cv.hline(10, 13, 101, c("wood", 4))
    cv.hline(9, 14, 102, c("darkwood", 2))

    # RIGHT SHOWCASE PANE (x=21..34, y=89..102): Colorful Heraldic Shields & Gilt Sword!
    buckler_rows = [
        ".yYYy.",
        "yGGGGy",
        "YGYYGY",
        "YGYYGY",
        "yggggY",
        ".yyyy.",
    ]
    cv.sprite(
        22,
        92,
        buckler_rows,
        {
            "Y": c("yellow", 5),
            "y": c("yellow", 3),
            "G": c("green", 4),
            "g": c("green", 2),
        },
    )
    heater_rows = [
        "iYYYYi",
        "YRRWRY",
        "YWWWWY",
        "YRRWRY",
        "YrrWrY",
        ".YrWY.",
        "..YY..",
    ]
    cv.sprite(
        28,
        91,
        heater_rows,
        {
            "i": c("ink", 0),
            "Y": c("yellow", 4),
            "R": c("red", 4),
            "r": c("red", 3),
            "W": c("white", 6),
        },
    )
    cv.set(22, 100, c("yellow", 5))
    cv.set(23, 100, c("wood", 4))
    cv.vline(24, 99, 101, c("yellow", 4))
    cv.hline(25, 32, 100, c("coolwhite", 5))
    cv.hline(25, 31, 101, c("steel", 3))

    # Subtle corner leaded-glass reflections (clear of knight helm!)
    for d in range(3):
        cv.set(5 + d, 90 - d, c("glass", 6))
        cv.set(21 + d, 90 - d, c("glass", 6))
        cv.set(17 + d, 102 - d, c("glass", 5))

    # HEAVY IRON-STRAPPED OAK ENTRANCE DOOR (x=39..49, y=77..107)
    for y in range(77, 108):
        cv.set(38, y, c("white", 5 if y % 4 != 0 else 3))
        cv.set(50, y, c("stone", 3 if y % 4 != 0 else 2))
    cv.hline(39, 49, 75, c("white", 5))
    cv.hline(38, 50, 76, c("stone", 5))
    cv.set(44, 75, c("yellow", 3))
    cv.hline(39, 49, 77, c("ink", 0))

    for y in range(78, 108):
        for x in range(39, 50):
            if x in (39, 49):
                cv.set(x, y, c("ink", 0) if x == 49 else c("darkwood", 2))
            elif x in (42, 46):
                cv.set(x, y, c("darkwood", 2))
            else:
                cv.set(x, y, c("cedar", 4 if x < 45 else 3))

    for hy in (81, 93, 103):
        for x in range(39, 48):
            cv.set(x, hy, c("steel", 3 if x % 2 == 0 else 2))
        cv.set(47, hy - 1, c("steel", 4))
        cv.set(47, hy + 1, c("steel", 2))
        cv.set(40, hy, c("coolwhite", 4))
        cv.set(44, hy, c("steel", 5))

    cv.rect(42, 84, 46, 88, c("darkwood", 1))
    cv.rect(43, 85, 45, 87, c("yellow", 4))
    cv.set(44, 86, c("white", 6))
    cv.rect(47, 96, 48, 98, c("yellow", 4))
    cv.set(47, 97, c("yellow", 5))
    cv.hline(38, 50, 107, c("white", 5))
    cv.hline(38, 50, 108, c("stone", 3))

    # Warm brass shop lantern beside door arch (x=50..52, y=76..81)
    cv.set(51, 76, c("ink", 0))
    cv.hline(50, 52, 77, c("steel", 3))
    cv.rect(50, 78, 52, 80, c("yellow", 4))
    cv.set(51, 79, c("white", 6))
    cv.hline(50, 52, 81, c("ink", 0))

    # OUTDOOR SPEAR, HALBERD & SHIELD RACK (x=51..62, y=75..109)
    cv.shade_rect(53, 84, 62, 109, -1)

    cv.vline(52, 91, 108, c("wood", 4))
    cv.vline(61, 91, 108, c("darkwood", 2))
    cv.hline(52, 61, 93, c("wood", 4))
    cv.hline(52, 61, 94, c("darkwood", 1))
    cv.hline(51, 62, 107, c("wood", 3))
    cv.hline(51, 62, 108, c("ink", 0))

    # 2 Tall Upright Polearms (Royal Halberd x=55, Leaf Spear x=59) — clean & crisp at 1x!
    for sx in (55, 59):
        cv.vline(sx, 83, 106, c("cedar", 4))
        cv.vline(sx + 1, 84, 106, c("darkwood", 2))
        cv.set(sx - 1, 84, c("red", 4))
        cv.set(sx, 83, c("yellow", 4))

    polearm_heads = [
        # y=75..82 across x=53..61 (9px wide)
        "..W......",  # y=75: halberd spike tip
        "..Sd.....",  # y=76: halberd upper spike
        "..Sd..W..",  # y=77: spike + spear tip
        ".dWWdWSd.",  # y=78: halberd fluke + leaf spearhead
        "..SWdWSd.",  # y=79: curved halberd axe-blade + spear body
        "..SWd.Sd.",  # y=80: lower axe edge + spear socket
        "..Sd..sd.",  # y=81: steel collar
        "..sd.....",  # y=82: halberd socket
    ]
    cv.sprite(
        53,
        75,
        polearm_heads,
        {
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "s": c("steel", 4),
            "d": c("steel", 1),
        },
    )

    # Two Leaning Heraldic Shields in front of rack (y=99..106)
    rack_shield_1 = [
        ".iYYi.",
        "iBBBBi",
        "YBYYBY",
        "YBYYBY",
        "ybbbbY",
        ".ibbi.",
    ]
    cv.sprite(
        52,
        100,
        rack_shield_1,
        {
            "i": c("ink", 0),
            "Y": c("yellow", 4),
            "y": c("yellow", 3),
            "B": c("blue", 4),
            "b": c("blue", 2),
        },
    )
    rack_shield_2 = [
        ".iSSi.",
        "sRRRRs",
        "SRWWRS",
        "SRWWRS",
        "drrrrS",
        ".issi.",
    ]
    cv.sprite(
        57,
        101,
        rack_shield_2,
        {
            "i": c("ink", 0),
            "W": c("coolwhite", 5),
            "S": c("steel", 5),
            "s": c("steel", 4),
            "d": c("steel", 2),
            "R": c("red", 4),
            "r": c("red", 2),
        },
    )

    return cv.img


# ==============================================================================
# STRICT VERIFICATION & 3X CHECKERBOARD PREVIEW SHEET
# ==============================================================================
def verify_image(name: str, img: Image.Image, allowed_rgb: set[tuple[int, int, int]]) -> dict:
    assert img.mode == "RGBA", f"{name}: mode must be RGBA, got {img.mode}"
    assert img.size == (64, 112), f"{name}: size must be (64, 112), got {img.size}"

    off_palette = 0
    bad_alpha = 0
    pure_black = 0
    used_colors: set[tuple[int, int, int]] = set()
    transparent_px = 0
    opaque_px = 0

    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                transparent_px += 1
                continue
            if a != 255:
                bad_alpha += 1
            opaque_px += 1
            if (r, g, b) == (0, 0, 0):
                pure_black += 1
            if (r, g, b) not in allowed_rgb:
                off_palette += 1
            used_colors.add((r, g, b))

    assert off_palette == 0, f"{name}: {off_palette} off-palette pixels!"
    assert bad_alpha == 0, f"{name}: {bad_alpha} non-binary alpha pixels!"
    assert pure_black == 0, f"{name}: {pure_black} pure #000000 pixels!"
    assert 60 <= len(used_colors) <= 95, (
        f"{name}: unique color count {len(used_colors)} outside target [60, 95]!"
    )

    return {
        "name": name,
        "size": list(img.size),
        "unique_colors": len(used_colors),
        "opaque_px": opaque_px,
        "transparent_px": transparent_px,
        "off_palette": off_palette,
        "bad_alpha": bad_alpha,
        "pure_black": pure_black,
        "status": "PASS",
    }


def make_preview_sheet(smithy: Image.Image, armory: Image.Image) -> Image.Image:
    scale = 3
    w3, h3 = 64 * scale, 112 * scale  # 192 x 336
    pad = 28
    gap = 36
    top_bar = 38
    sheet_w = pad * 2 + w3 * 2 + gap + 104
    sheet_h = top_bar + h3 + pad

    # Dark slate #23262e base with subtle #2b2f39 12px checkerboard
    c_dark = (0x23, 0x26, 0x2E, 255)
    c_lite = (0x2B, 0x2F, 0x39, 255)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), c_dark)
    spx = sheet.load()
    cell = 12
    for y in range(sheet_h):
        for x in range(sheet_w):
            if ((x // cell) + (y // cell)) % 2 == 1:
                spx[x, y] = c_lite

    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, 0, sheet_w, top_bar - 6], fill=(0x1B, 0x1E, 0x25, 255))
    draw.text((pad, 10), "ft-smithy.png (3x) - Blacksmith", fill=(235, 238, 245, 255))
    draw.text((pad + w3 + gap, 10), "ft-armory.png (3x) - Armory", fill=(235, 238, 245, 255))
    draw.text((pad + w3 * 2 + gap + 22, 10), "1x (64x112)", fill=(180, 188, 204, 255))

    s3 = smithy.resize((w3, h3), Image.Resampling.NEAREST)
    a3 = armory.resize((w3, h3), Image.Resampling.NEAREST)

    sheet.alpha_composite(s3, (pad, top_bar))
    sheet.alpha_composite(a3, (pad + w3 + gap, top_bar))

    x_1x = pad + w3 * 2 + gap + 20
    sheet.alpha_composite(smithy, (x_1x, top_bar + 12))
    sheet.alpha_composite(armory, (x_1x, top_bar + 12 + 112 + 24))

    return sheet.convert("RGB")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    ramps, allowed_rgb, color_to_ramp = load_palette()

    smithy = build_smithy(ramps, color_to_ramp)
    armory = build_armory(ramps, color_to_ramp)

    stats_s = verify_image("ft-smithy.png", smithy, allowed_rgb)
    stats_a = verify_image("ft-armory.png", armory, allowed_rgb)

    smithy.save(OUT_DIR / "ft-smithy.png")
    armory.save(OUT_DIR / "ft-armory.png")

    preview = make_preview_sheet(smithy, armory)
    preview.save(PREVIEW_PATH)

    print("PASS Verification Summary:")
    print(json.dumps([stats_s, stats_a], indent=2))


if __name__ == "__main__":
    main()
