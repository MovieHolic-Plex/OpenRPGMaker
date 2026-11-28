#!/usr/bin/env python3
"""
T3 Dungeon Theme Objects Batch 4/4 — `mine_volcano` (광산 · 화산 용암 6종)
Model: gemini-4-carbon (medium)

Sprites produced in `tiledata/dungeon-themes-carbon/mine_volcano/objects/`:
  1. minecart.png        (32x32, vehicle,  op ~28x24)
  2. obsidian-altar.png  (32x32, standing, op ~28x29)
  3. ore-crystal-vein.png(32x32, standing, op ~28x27)
  4. lava-brazier.png    (16x32, standing, op ~14x29)
  5. pickaxe-rack.png    (32x32, standing, op ~28x28)
  6. rails-kit.png       (48x16, topdown,  3 modular 16x16 tiles: E-W, N-S, S-to-E turn)

Hard Rules Enforced:
  - 100% locked to `tiledata/jp-city/fable-city/palette.json` (0 off-palette, 0 #000000)
  - Optional ground shadow ONLY `#4c557f` at alpha 85/255; all other pixels alpha 0 or 255
  - 1px dark material outer outline on every opaque pixel touching non-opaque
  - Strict camera compliance: `vehicle` (3/4 side facing RIGHT + top ore-bed rim + 2 wheels on
    ground line), `standing` (orthographic front + 3/4 top band, zero side walls), `topdown`
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = ROOT / "tiledata/jp-city/fable-city/palette.json"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"

OUT_DIR = ROOT / "tiledata/dungeon-themes-carbon/mine_volcano"
OBJ_DIR = OUT_DIR / "objects"
PREVIEW_PNG = OUT_DIR / "preview_mine_volcano.png"

SHADOW_RGB = (0x4C, 0x55, 0x7F)
SHADOW_ALPHA = 85
SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)

# ===========================================================================
# 100% Locked Palette Tokens from `tiledata/jp-city/fable-city/palette.json`
# ===========================================================================
P: dict[str, str] = {
    # Obsidian / Volcanic Basalt (`kuro` + `ink`)
    "K0": "#14121f",  # kuro[0] darkest obsidian outline (luma 19.3)
    "K1": "#201e30",  # kuro[1] deep obsidian shadow
    "K2": "#2f2e42",  # kuro[2] dark basalt shadow
    "K3": "#414257",  # kuro[3] basalt mid
    "K4": "#575a6c",  # kuro[4] lit basalt
    "K5": "#727685",  # kuro[5] obsidian bevel highlight
    "K6": "#949aa2",  # kuro[6] glassy obsidian glint
    "N0": "#1a1226",  # ink[0] warm-violet volcanic outline (luma 22.1)
    "N1": "#2b203f",  # ink[1] deep volcanic plum-shadow
    "N2": "#3d2f52",  # ink[2] volcanic sheen
    # Forged Steel & Soot-Iron (`steel` + `ibushi`)
    "S0": "#1c1c2c",  # steel[0] darkest steel outline (luma 29.8)
    "S1": "#30303f",  # steel[1] deep forged iron (luma 48.9)
    "S2": "#484a58",  # steel[2] dark iron plate
    "S3": "#646874",  # steel[3] steel mid
    "S4": "#848a92",  # steel[4] lit steel edge / rivet
    "S5": "#a8aeb0",  # steel[5] bright steel highlight
    "S6": "#cdd2d0",  # steel[6] gleaming blade/rail specular
    "B0": "#1f1c2e",  # ibushi[0] soot-iron outline (luma 29.8)
    "B1": "#302e42",  # ibushi[1] soot-iron deep
    "B2": "#464558",  # ibushi[2] soot-iron mid
    "B3": "#5f5f70",  # ibushi[3] soot-iron lit
    "B4": "#7c7d88",  # ibushi[4] soot-iron rim
    # Craggy Mine Rock (`asphalt` + `stone`)
    "R0": "#1c1a2c",  # asphalt[0] dark crag outline (luma 28.0)
    "R1": "#2a2838",  # asphalt[1] deep crag shadow
    "R2": "#3a3848",  # asphalt[2] dark mine rock
    "R3": "#4c4a5a",  # asphalt[3] mine rock mid
    "R4": "#615f6e",  # asphalt[4] lit rock ledge
    "R5": "#787684",  # asphalt[5] bright rock highlight
    "R6": "#928484",  # stone[3] warm mineral rock ridge
    # Timber / Oak / Cedar (`darkwood` + `wood` + `cedar`)
    "W0": "#140c14",  # darkwood[0] tarred wood outline (luma 15.3)
    "W1": "#1e1420",  # wood[0] dark oak outline (luma 22.4)
    "W2": "#33202a",  # wood[1] deep oak shadow
    "W3": "#4a2e2c",  # wood[2] dark oak
    "W4": "#633f2e",  # wood[3] oak mid
    "W5": "#7e5536",  # wood[4] lit oak plank
    "W6": "#9b6f44",  # wood[5] warm oak highlight
    "W7": "#b88c5c",  # wood[6] bright oak top edge
    "C5": "#d2ac78",  # cedar[5] pale hickory shaft highlight
    "C6": "#e6c898",  # cedar[6] pale wood specular
    # Hemp Rope (`straw`)
    "H0": "#3c3020",  # straw[0] rope dark outline (luma 49.8)
    "H1": "#5f5230",  # straw[1] rope shadow
    "H2": "#857644",  # straw[2] rope mid
    "H3": "#aa9c5c",  # straw[3] rope tan strand
    "H4": "#cabe7c",  # straw[4] rope light twist
    "H5": "#e4dca4",  # straw[5] rope bright twist dot
    # Incandescent Magma, Ruby, Orange, Gold (`maple` + `red` + `orange` + `yellow` + `white`)
    "M0": "#2c1024",  # maple[0] darkest crimson-ember outline (luma 26.7)
    "M1": "#3a1030",  # red[0] deep ruby/magma outline (luma 32.2)
    "M2": "#641a30",  # red[1] dark cooling magma / deep ruby shadow
    "M3": "#8e2a30",  # red[2] glowing crimson magma / ruby mid
    "M4": "#b84434",  # red[3] bright red-orange lava / ruby lit facet
    "M5": "#d86a44",  # red[4] hot coral-red / ruby highlight
    "M6": "#ee9a6a",  # red[5] pale ruby specular glint
    "O0": "#4a2028",  # orange[0] dark burnt-orange outline (luma 45.4)
    "O1": "#783420",  # orange[1] deep amber/lava shadow
    "O2": "#a85420",  # orange[2] molten orange mid
    "O3": "#d07a2c",  # orange[3] bright molten orange / amber facet
    "O4": "#e8a448",  # orange[4] golden-orange lava / brass highlight
    "O5": "#f6cc7c",  # orange[5] incandescent pale orange
    "Y0": "#4a3020",  # yellow[0] dark bronze/gold outline (luma 54.0)
    "Y1": "#7a5420",  # yellow[1] gold/brass shadow
    "Y2": "#aa8024",  # yellow[2] rich gold mid
    "Y3": "#d4ac38",  # yellow[3] bright gold nugget/vein
    "Y4": "#ecd060",  # yellow[4] gleaming gold / yellow-hot lava
    "Y5": "#f8eca0",  # yellow[5] white-hot yellow lava / gold specular
    "WH": "#fcfaf4",  # white[6] incandescent white-hot pinpoint
    # Emerald & Tourmaline Ore Crystals (`green` + `teal`)
    "E0": "#0e2a2c",  # green[0] darkest emerald outline (luma 33.9)
    "E1": "#164838",  # green[1] deep emerald shadow
    "E2": "#247048",  # green[2] emerald mid
    "E3": "#3c9858",  # green[3] bright emerald facet
    "E4": "#68bc74",  # green[4] luminous emerald edge
    "E5": "#a0dca0",  # green[5] emerald glint
    "T3": "#3c9888",  # teal[3] cool blue-green crystal facet
    "T5": "#a4dcc0",  # teal[5] icy emerald specular
}

# Material-matched darkest 1px outer outline hexes (all luma <= 54.0)
DARK_OUTLINE_HEXES = {
    P["K0"], P["K1"], P["N0"], P["N1"],
    P["S0"], P["S1"], P["B0"], P["B1"],
    P["R0"], P["R1"],
    P["W0"], P["W1"], P["W2"],
    P["H0"],
    P["M0"], P["M1"], P["O0"], P["Y0"],
    P["E0"],
}


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    h = hx.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.im.load()
        self.mat: dict[tuple[int, int], str] = {}

    def set(self, x: int, y: int, tok: str, mat: str = "steel") -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if tok == ".":
                self.px[x, y] = TRANSPARENT
                self.mat.pop((x, y), None)
            elif tok == "SH":
                self.px[x, y] = SHADOW_RGBA
                self.mat.pop((x, y), None)
            else:
                hx = P[tok] if tok in P else tok
                self.px[x, y] = hex_to_rgba(hx)
                self.mat[(x, y)] = mat

    def hline(self, x1: int, x2: int, y: int, tok: str, mat: str = "steel") -> None:
        for x in range(min(x1, x2), max(x1, x2) + 1):
            self.set(x, y, tok, mat)

    def vline(self, x: int, y1: int, y2: int, tok: str, mat: str = "steel") -> None:
        for y in range(min(y1, y2), max(y1, y2) + 1):
            self.set(x, y, tok, mat)

    def rect(self, x1: int, y1: int, x2: int, y2: int, tok: str, mat: str = "steel") -> None:
        for y in range(min(y1, y2), max(y1, y2) + 1):
            for x in range(min(x1, x2), max(x1, x2) + 1):
                self.set(x, y, tok, mat)

    def shadow_ellipse_if_empty(self, cx: float, cy: float, rx: float, ry: float) -> None:
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 0:
                    dx = (x - cx) / rx
                    dy = (y - cy) / ry
                    if dx * dx + dy * dy <= 1.0:
                        self.px[x, y] = SHADOW_RGBA

    def shadow_band_if_empty(self, x1: int, x2: int, y1: int, y2: int) -> None:
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3] == 0:
                    self.px[x, y] = SHADOW_RGBA

    def enforce_dark_outline(self, check_canvas_edges: bool = True) -> None:
        """Guarantee every opaque pixel touching transparency (or canvas border) uses its material's darkest outline."""
        mat_outline = {
            "obsidian": "K0",
            "basalt": "N0",
            "rock": "R0",
            "steel": "S0",
            "iron": "B0",
            "wood": "W1",
            "darkwood": "W0",
            "rope": "H0",
            "magma": "M0",
            "ruby": "M1",
            "amber": "O0",
            "gold": "Y0",
            "emerald": "E0",
        }
        to_fix: list[tuple[int, int, str]] = []
        for y in range(self.h):
            for x in range(self.w):
                r, g, b, a = self.px[x, y]
                if a != 255:
                    continue
                hx = f"#{r:02x}{g:02x}{b:02x}"
                touches_empty = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= self.w or ny < 0 or ny >= self.h:
                        if check_canvas_edges:
                            touches_empty = True
                            break
                    elif self.px[nx, ny][3] != 255:
                        touches_empty = True
                        break
                if touches_empty and hx not in DARK_OUTLINE_HEXES:
                    m = self.mat.get((x, y), "steel")
                    to_fix.append((x, y, mat_outline.get(m, "S0")))
        for x, y, tok in to_fix:
            self.set(x, y, tok, self.mat.get((x, y), "steel"))


# ===========================================================================
# 1. `minecart.png` (32x32, `vehicle`, op 28x24: x=2..29, y=6..29)
#    Heavy riveted dark-steel dwarven ore cart (3/4 side view facing RIGHT!)
#    with visible open top rim (~30% of tub height) heaped with glittering
#    gold nuggets & emerald/ruby crystals, reinforced iron ribs, couplers &
#    two spoked flanged iron rail wheels on one ground line (y=29).
# ===========================================================================
def build_minecart() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Heaped Ore Mound Crest Rising Above Open Rim (y=6..12, x=6..25) ---
    # Back-to-front layered crystal shards & chunky gold nuggets inside the open cart bed
    ore_pixels = [
        # Crown peaks (y=6..7): emerald crystal left-center, big gold nugget center, ruby crystal right
        (11, 6, "E0", "emerald"), (12, 6, "E0", "emerald"),
        (16, 6, "Y0", "gold"), (17, 6, "Y0", "gold"), (18, 6, "Y0", "gold"),
        (10, 7, "E0", "emerald"), (11, 7, "E5", "emerald"), (12, 7, "E3", "emerald"), (13, 7, "E0", "emerald"),
        (15, 7, "Y0", "gold"), (16, 7, "Y5", "gold"), (17, 7, "Y4", "gold"), (18, 7, "Y3", "gold"), (19, 7, "Y0", "gold"),
        (21, 7, "M1", "ruby"), (22, 7, "M1", "ruby"),
        # Upper heap row y=8
        (8, 8, "Y0", "gold"), (9, 8, "Y0", "gold"),
        (10, 8, "E4", "emerald"), (11, 8, "E3", "emerald"), (12, 8, "E2", "emerald"), (13, 8, "T3", "emerald"),
        (14, 8, "Y4", "gold"), (15, 8, "Y5", "gold"), (16, 8, "Y4", "gold"), (17, 8, "Y3", "gold"),
        (18, 8, "Y2", "gold"), (19, 8, "K1", "obsidian"),
        (20, 8, "M1", "ruby"), (21, 8, "M6", "ruby"), (22, 8, "M4", "ruby"), (23, 8, "M1", "ruby"),
        # Mid heap row y=9 (sits inside/above back rim y=9)
        (7, 9, "Y0", "gold"), (8, 9, "Y5", "gold"), (9, 9, "Y3", "gold"),
        (10, 9, "E3", "emerald"), (11, 9, "E2", "emerald"), (12, 9, "E1", "emerald"),
        (13, 9, "Y4", "gold"), (14, 9, "Y3", "gold"), (15, 9, "Y2", "gold"),
        (16, 9, "M5", "ruby"), (17, 9, "M4", "ruby"), (18, 9, "Y4", "gold"), (19, 9, "Y3", "gold"),
        (20, 9, "M5", "ruby"), (21, 9, "M4", "ruby"), (22, 9, "M3", "ruby"), (23, 9, "Y4", "gold"), (24, 9, "Y0", "gold"),
    ]

    # --- B. 3/4 Top Open Rim Band of Hopper (y=9..13, x=3..28) ---
    # Far (north) rim bar at y=9..10, open dark interior bed + ore at y=10..12, near (south) rim bar at y=12..13!
    # This gives an unmistakable 30% visible 3/4 top band per `vehicle` camera rule!
    c.hline(4, 27, 9, "S0", "steel")
    c.hline(5, 26, 10, "S4", "steel")  # lit inner-top edge of far steel rim
    # Left & right angled 3/4 rim walls connecting far rim (y=9) to near rim (y=13)
    for y, lx, rx in ((10, 4, 27), (11, 3, 28), (12, 3, 28)):
        c.set(lx, y, "S0", "steel")
        c.set(lx + 1, y, "S5" if y < 12 else "S4", "steel")
        c.set(rx - 1, y, "S3" if y == 10 else "S2", "steel")
        c.set(rx, y, "S0", "steel")
        # Dark coal/basalt rubble bed inside rim before placing gems/gold
        c.hline(lx + 2, rx - 2, y, "K1", "obsidian")

    # Fill rich ore bed inside open rim (y=10..12, x=5..26) + heap above
    for x, y, tok, mat in ore_pixels:
        c.set(x, y, tok, mat)
    bed_gems = [
        # Row y=10
        (6, 10, "K2", "obsidian"), (7, 10, "Y4", "gold"), (8, 10, "Y3", "gold"), (9, 10, "Y2", "gold"),
        (10, 10, "E2", "emerald"), (11, 10, "E1", "emerald"), (12, 10, "Y5", "gold"), (13, 10, "Y3", "gold"),
        (14, 10, "Y2", "gold"), (15, 10, "M6", "ruby"), (16, 10, "M4", "ruby"), (17, 10, "M3", "ruby"),
        (18, 10, "Y5", "gold"), (19, 10, "Y4", "gold"), (20, 10, "M4", "ruby"), (21, 10, "M3", "ruby"),
        (22, 10, "M2", "ruby"), (23, 10, "Y5", "gold"), (24, 10, "Y3", "gold"), (25, 10, "K2", "obsidian"),
        # Row y=11 (front half of open ore bed!)
        (5, 11, "Y3", "gold"), (6, 11, "Y5", "gold"), (7, 11, "Y4", "gold"), (8, 11, "Y2", "gold"),
        (9, 11, "E5", "emerald"), (10, 11, "E3", "emerald"), (11, 11, "Y4", "gold"), (12, 11, "Y3", "gold"),
        (13, 11, "Y1", "gold"), (14, 11, "K2", "obsidian"), (15, 11, "M4", "ruby"), (16, 11, "M3", "ruby"),
        (17, 11, "Y5", "gold"), (18, 11, "Y4", "gold"), (19, 11, "Y2", "gold"), (20, 11, "E4", "emerald"),
        (21, 11, "E3", "emerald"), (22, 11, "Y4", "gold"), (23, 11, "Y3", "gold"), (24, 11, "M5", "ruby"),
        (25, 11, "M3", "ruby"), (26, 11, "K2", "obsidian"),
        # Row y=12 (tucked right behind near steel rim!)
        (5, 12, "Y2", "gold"), (6, 12, "Y3", "gold"), (7, 12, "K2", "obsidian"), (8, 12, "E3", "emerald"),
        (9, 12, "E2", "emerald"), (10, 12, "Y3", "gold"), (11, 12, "Y2", "gold"), (12, 12, "K1", "obsidian"),
        (13, 12, "Y4", "gold"), (14, 12, "Y3", "gold"), (15, 12, "M3", "ruby"), (16, 12, "Y3", "gold"),
        (17, 12, "Y2", "gold"), (18, 12, "K2", "obsidian"), (19, 12, "E2", "emerald"), (20, 12, "E1", "emerald"),
        (21, 12, "Y3", "gold"), (22, 12, "Y2", "gold"), (23, 12, "M4", "ruby"), (24, 12, "M2", "ruby"),
        (25, 12, "Y2", "gold"), (26, 12, "K1", "obsidian"),
    ]
    for x, y, tok, mat in bed_gems:
        c.set(x, y, tok, mat)

    # Near (front) heavy rolled steel rim collar (y=13..14, x=3..28)
    c.hline(3, 28, 13, "S5", "steel")
    c.set(3, 13, "S0", "steel")
    c.set(28, 13, "S0", "steel")
    c.set(27, 13, "S4", "steel")
    # Gleaming specular glint on top-left of front steel lip
    c.hline(5, 14, 13, "S6", "steel")
    c.hline(3, 28, 14, "S1", "steel")  # crisp dark overhang shadow directly under rolled lip
    c.set(3, 14, "S0", "steel")
    c.set(28, 14, "S0", "steel")

    # --- C. Tapered Riveted Dark-Steel Hopper Side Profile Facing RIGHT (y=15..22) ---
    # Left (rear) slopes steeper (x=4->6), Right (front prow facing right!) projects further right (x=28->26)
    row_spans = [
        (15, 4, 28),
        (16, 4, 28),
        (17, 5, 27),
        (18, 5, 27),
        (19, 5, 27),
        (20, 6, 26),
        (21, 6, 26),
        (22, 6, 26),
    ]
    for y, lx, rx in row_spans:
        c.set(lx, y, "S0", "steel")
        c.set(rx, y, "S0", "steel")
        for x in range(lx + 1, rx):
            # Top-left to bottom-right cylindrical/plate steel shading
            if y <= 16:
                tone = "S3" if x < 18 else "S2"
            elif y <= 19:
                tone = "S2" if x < 16 else "B2"
            else:
                tone = "B1" if x > 14 else "S1"
            c.set(x, y, tone, "steel")
        # Crisp left-edge highlight bevel inside outline + dark right-prow shadow bevel
        c.set(lx + 1, y, "S4" if y <= 18 else "S3", "steel")
        c.set(rx - 1, y, "S1" if y >= 18 else "S2", "steel")
        # Forward-facing prow nose plate (right side x=rx-2..rx-1) angled highlight at top-right!
        if y in (15, 16):
            c.set(rx - 2, y, "S4", "steel")

    # Horizontal seam + 3 vertical forged-iron reinforcing ribs (x=10, 16, 22) with rivets!
    c.hline(6, 26, 18, "S1", "steel")
    for rib_x in (10, 16, 22):
        for y in range(14, 23):
            c.set(rib_x, y, "S4" if y <= 18 else "S3", "steel")
            c.set(rib_x + 1, y, "S1" if y <= 19 else "K1", "steel")
        # Bright steel rivets on ribs & top/bottom corners
        c.set(rib_x, 15, "S6", "steel")
        c.set(rib_x, 21, "S5", "steel")
    # Corner plate rivets
    for rx_pt, ry_pt in ((6, 15), (7, 21), (25, 15), (25, 21)):
        c.set(rx_pt, ry_pt, "S5", "steel")
    # Small brass dwarven mine-guild badge plate on front-right hopper panel (x=23..24, y=16..17)
    c.set(23, 16, "Y4", "gold")
    c.set(24, 16, "Y3", "gold")
    c.set(23, 17, "Y2", "gold")
    c.set(24, 17, "Y1", "gold")

    # --- D. Heavy Undercarriage Chassis Beam & Front/Rear Couplers (y=22..25, x=2..29) ---
    # Chassis beam (x=5..27, y=23..24)
    c.hline(5, 27, 23, "S0", "steel")
    c.hline(6, 26, 23, "S3", "steel")
    c.hline(6, 14, 23, "S4", "steel")
    c.hline(5, 27, 24, "S0", "steel")
    c.hline(6, 26, 24, "K1", "obsidian")

    # Rear left hitch link/pin (x=2..4, y=22..24)
    c.rect(2, 22, 4, 24, "S0", "steel")
    c.set(3, 23, "S4", "steel")
    c.set(4, 23, "S2", "steel")

    # Front right heavy bumper bufferFacing RIGHT (x=27..29, y=21..24) — clear right-facing nose!
    c.rect(27, 21, 29, 24, "S0", "steel")
    c.set(27, 22, "S3", "steel")
    c.set(28, 22, "S5", "steel")  # gleaming steel bumper face pointing right
    c.set(27, 23, "S2", "steel")
    c.set(28, 23, "S4", "steel")

    # --- E. Two Flanged Spoked Iron Rail Wheels on ONE Ground Line (y=22..29) ---
    # Left wheel x=7..13 (7px wide, y=23..29, 7px tall); Right wheel x=19..25 (7px wide, y=23..29, 7px tall)
    for wx in (7, 19):
        # Rounded 7x7 wheel silhouette (corners trimmed by 1px -> crisp round wheel!)
        for dy in range(7):
            y = 23 + dy
            x0 = wx + (1 if dy in (0, 6) else 0)
            x1 = wx + 6 - (1 if dy in (0, 6) else 0)
            for x in range(x0, x1 + 1):
                c.set(x, y, "S0", "steel")
        # Bright flanged steel tire rim inside 1px dark outline
        # Top-left lit rim (S6/S5) -> bottom-right shadowed rim (S3/S2)
        c.set(wx + 2, 24, "S6", "steel")
        c.set(wx + 3, 24, "S5", "steel")
        c.set(wx + 4, 24, "S4", "steel")
        c.set(wx + 1, 25, "S5", "steel")
        c.set(wx + 1, 26, "S4", "steel")
        c.set(wx + 1, 27, "S3", "steel")
        c.set(wx + 5, 25, "S3", "steel")
        c.set(wx + 5, 26, "S2", "steel")
        c.set(wx + 5, 27, "S2", "steel")
        c.set(wx + 2, 28, "S3", "steel")
        c.set(wx + 3, 28, "S2", "steel")
        c.set(wx + 4, 28, "S2", "steel")
        # Dark recessed wheel interior + central brass/steel axle hub (wx+3, y=26)
        for ix in (wx + 2, wx + 3, wx + 4):
            for iy in (25, 26, 27):
                c.set(ix, iy, "K0", "obsidian")
        # Cross spokes + gleaming center axle pin
        c.set(wx + 3, 25, "S3", "steel")
        c.set(wx + 2, 26, "S3", "steel")
        c.set(wx + 4, 26, "S2", "steel")
        c.set(wx + 3, 27, "S2", "steel")
        c.set(wx + 3, 26, "Y4", "gold")  # unmistakable bright brass/gold axle pin!

    c.enforce_dark_outline()
    # Ground shadow under wheels & chassis (y=28..30)
    c.shadow_ellipse_if_empty(16.0, 29.2, 13.2, 2.2)
    return c.im


# ===========================================================================
# 2. `obsidian-altar.png` (32x32, `standing`, op 28x29: x=2..29, y=1..29)
#    Jagged black-obsidian volcanic altar split by glowing incandescent
#    yellow-orange-red magma fissures, crowned with a burning fire-ruby bowl!
# ===========================================================================
def build_obsidian_altar() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Stepped Jagged Volcanic Obsidian Plinth (y=25..29, x=2..29) ---
    # Bottom broad step (y=27..29, x=2..29)
    c.rect(2, 27, 29, 29, "K0", "obsidian")
    c.hline(3, 28, 27, "K4", "obsidian")  # lit top edge of bottom step
    c.hline(4, 15, 27, "K5", "obsidian")  # top-left glassy obsidian highlight
    c.hline(3, 28, 28, "K2", "obsidian")
    for x in (9, 16, 22):
        c.set(x, 28, "K1", "obsidian")
    # Upper plinth step (y=25..26, x=4..27)
    c.rect(4, 25, 27, 26, "K0", "obsidian")
    c.hline(5, 26, 25, "K4", "obsidian")
    c.hline(5, 13, 25, "K5", "obsidian")
    c.hline(5, 26, 26, "K2", "obsidian")

    # --- B. Monolithic Obsidian Altar Block (y=13..24, x=6..25) ---
    c.rect(6, 13, 25, 24, "K0", "obsidian")
    for y in range(14, 25):
        for x in range(7, 25):
            # Deep glassy volcanic obsidian shading (lit top-left, plum-black bottom-right)
            if x < 12 and y < 19:
                tok = "K3"
            elif x < 18 and y < 22:
                tok = "K2"
            else:
                tok = "K1" if (x + y) % 5 != 0 else "N1"
            c.set(x, y, tok, "obsidian")
    # Vertical carved obsidian pilaster ribs (left x=8..9, right x=22..23)
    for y in range(14, 25):
        c.set(8, y, "K4" if y < 20 else "K3", "obsidian")
        c.set(9, y, "K2", "obsidian")
        c.set(22, y, "K3" if y < 19 else "K2", "obsidian")
        c.set(23, y, "K1", "obsidian")

    # --- C. 3/4 Orthographic Obsidian Top Mensa Slab (y=9..14, x=5..26) ---
    # Clear 5px-tall top surface band (~1/3 of altar body!)
    for y, lx, rx in ((9, 7, 24), (10, 6, 25), (11, 5, 26), (12, 5, 26), (13, 5, 26)):
        c.hline(lx, rx, y, "K0", "obsidian")
        if y == 9:
            continue
        for x in range(lx + 1, rx):
            if y == 10:
                c.set(x, y, "K4" if x < 17 else "K3", "obsidian")
            elif y in (11, 12):
                c.set(x, y, "K3" if x < 16 else "K2", "obsidian")
            elif y == 13:
                # Crisp bright front bevel lip of glassy obsidian mensa!
                c.set(x, y, "K6" if x < 13 else ("K5" if x < 21 else "K4"), "obsidian")
    # Overhang shadow directly beneath altar top slab (y=14)
    c.hline(7, 24, 14, "K0", "obsidian")

    # --- D. Flanking Jagged Volcanic Obsidian Horns / Spires (left x=3..7, right x=24..28, y=6..18) ---
    left_horn = [
        (4, 6, "K0"),
        (4, 7, "K0"), (5, 7, "K0"),
        (3, 8, "K0"), (4, 8, "K6"), (5, 8, "K3"), (6, 8, "K0"),
        (3, 9, "K0"), (4, 9, "K5"), (5, 9, "K3"), (6, 9, "K1"),
        (3, 10, "K0"), (4, 10, "K5"), (5, 10, "K4"), (6, 10, "K2"),
        (3, 11, "K0"), (4, 11, "K4"), (5, 11, "K3"), (6, 11, "K1"),
        (4, 12, "K0"), (5, 12, "K4"), (6, 12, "K2"),
        (4, 13, "K0"), (5, 13, "K5"), (6, 13, "K2"),
        (4, 14, "K0"), (5, 14, "K3"), (6, 14, "K1"),
        (5, 15, "K0"), (6, 15, "K3"),
        (5, 16, "K0"), (6, 16, "K2"),
    ]
    right_horn = [
        (27, 6, "K0"),
        (26, 7, "K0"), (27, 7, "K0"),
        (25, 8, "K0"), (26, 8, "K5"), (27, 8, "K2"), (28, 8, "K0"),
        (25, 9, "K1"), (26, 9, "K4"), (27, 9, "K2"), (28, 9, "K0"),
        (25, 10, "K2"), (26, 10, "K4"), (27, 10, "K1"), (28, 10, "K0"),
        (25, 11, "K1"), (26, 11, "K3"), (27, 11, "K1"), (28, 11, "K0"),
        (25, 12, "K2"), (26, 12, "K3"), (27, 12, "K0"),
        (25, 13, "K2"), (26, 13, "K4"), (27, 13, "K0"),
        (25, 14, "K1"), (26, 14, "K2"), (27, 14, "K0"),
        (25, 15, "K2"), (26, 15, "K0"),
        (25, 16, "K1"), (26, 16, "K0"),
    ]
    for x, y, tok in left_horn + right_horn:
        c.set(x, y, tok, "obsidian")

    # --- E. Incandescent Yellow-Orange-Red Magma Fissures Splitting Altar & Plinth ---
    # Deep glowing magma cracks across top slab (y=11..13), front monolith (y=14..24), and plinth (y=25..28)
    fissure_glow = [
        # Top slab glowing cracks radiating from ritual bowl
        (9, 11, "M3"), (10, 11, "O3"), (21, 11, "O3"), (22, 11, "M3"),
        (11, 12, "O4"), (12, 12, "Y4"), (19, 12, "Y4"), (20, 12, "O3"),
        (12, 13, "Y5"), (13, 13, "O4"), (18, 13, "O4"), (19, 13, "M4"),
        # Main central V-split & branching magma veins on front obsidian face
        (12, 14, "O3"), (13, 14, "Y4"), (18, 14, "O3"), (19, 14, "M3"),
        (12, 15, "M4"), (13, 15, "Y5"), (14, 15, "O4"), (17, 15, "O4"), (18, 15, "Y4"), (19, 15, "M3"),
        (13, 16, "M3"), (14, 16, "Y5"), (15, 16, "Y4"), (16, 16, "O4"), (17, 16, "Y5"), (18, 16, "M4"),
        # Central molten heart fissure (y=17..21)
        (14, 17, "O3"), (15, 17, "WH"), (16, 17, "Y5"), (17, 17, "O3"),
        (11, 18, "M3"), (12, 18, "O3"), (14, 18, "M4"), (15, 18, "Y5"), (16, 18, "Y4"), (17, 18, "M4"), (20, 18, "M3"),
        (10, 19, "M3"), (11, 19, "O4"), (12, 19, "M4"), (15, 19, "Y4"), (16, 19, "O4"), (19, 19, "O3"), (20, 19, "M4"),
        (10, 20, "M4"), (11, 20, "M2"), (15, 20, "O4"), (16, 20, "Y5"), (17, 20, "O3"), (20, 20, "O4"), (21, 20, "M3"),
        (14, 21, "O3"), (15, 21, "Y4"), (16, 21, "O3"), (17, 21, "M3"), (21, 21, "M3"),
        (13, 22, "O4"), (14, 22, "Y5"), (15, 22, "M4"), (17, 22, "O3"), (18, 22, "M4"),
        (12, 23, "M4"), (13, 23, "O4"), (14, 23, "M3"), (18, 23, "O4"), (19, 23, "M3"),
        (12, 24, "O3"), (13, 24, "M3"), (18, 24, "M4"), (19, 24, "O3"),
        # Seeping onto stepped plinth (y=25..28)
        (11, 25, "M4"), (12, 25, "Y4"), (13, 25, "O3"), (18, 25, "O4"), (19, 25, "M3"),
        (11, 26, "O3"), (12, 26, "M3"), (19, 26, "O3"),
        (10, 27, "M4"), (11, 27, "O4"), (19, 27, "O4"), (20, 27, "M3"),
        (10, 28, "M3"), (20, 28, "M2"),
    ]
    for x, y, tok in fissure_glow:
        c.set(x, y, tok, "magma")

    # --- F. Crowned with Burning Fire-Ruby Ritual Bowl (x=10..21, y=1..11) ---
    # 1. Forged dark-gold & black-iron ritual chalice bowl seated at y=7..11, x=10..21
    bowl_px = [
        # Bowl rim (y=7..8)
        (10, 8, "S0", "steel"), (11, 8, "Y4", "gold"), (12, 8, "Y3", "gold"),
        (19, 8, "Y2", "gold"), (20, 8, "Y1", "gold"), (21, 8, "S0", "steel"),
        # Curved gadrooned bowl belly (y=9..10)
        (10, 9, "S0", "steel"), (11, 9, "S4", "steel"), (12, 9, "Y3", "gold"), (13, 9, "S3", "steel"),
        (14, 9, "Y4", "gold"), (15, 9, "M5", "ruby"), (16, 9, "M4", "ruby"), (17, 9, "Y2", "gold"),
        (18, 9, "S2", "steel"), (19, 9, "Y1", "gold"), (20, 9, "S1", "steel"), (21, 9, "S0", "steel"),
        (11, 10, "S0", "steel"), (12, 10, "S3", "steel"), (13, 10, "Y2", "gold"), (14, 10, "S2", "steel"),
        (15, 10, "Y3", "gold"), (16, 10, "Y2", "gold"), (17, 10, "S1", "steel"), (18, 10, "Y1", "gold"),
        (19, 10, "S1", "steel"), (20, 10, "S0", "steel"),
        # Bowl pedestal foot on slab (y=11)
        (13, 11, "S0", "steel"), (14, 11, "Y3", "gold"), (15, 11, "Y2", "gold"),
        (16, 11, "Y1", "gold"), (17, 11, "S1", "steel"), (18, 11, "S0", "steel"),
    ]
    for x, y, tok, mat in bowl_px:
        c.set(x, y, tok, mat)

    # 2. Faceted Burning Fire-Ruby Heart & Roaring Flame Crest (y=1..8, x=11..20)
    # Outer dark ember/ruby outline wraps flame cleanly up to y=1!
    flame_ruby = [
        # Flame tip y=1..2
        (15, 1, "M0", "magma"), (16, 1, "M0", "magma"),
        (14, 2, "M0", "magma"), (15, 2, "O4", "magma"), (16, 2, "M4", "magma"), (17, 2, "M0", "magma"),
        # Upper tongues y=3..4
        (13, 3, "M0", "magma"), (14, 3, "Y4", "magma"), (15, 3, "Y5", "magma"),
        (16, 3, "O4", "magma"), (17, 3, "M4", "magma"), (18, 3, "M0", "magma"),
        (12, 4, "M1", "ruby"), (13, 4, "O4", "magma"), (14, 4, "Y5", "magma"), (15, 4, "WH", "magma"),
        (16, 4, "Y5", "magma"), (17, 4, "O3", "magma"), (18, 4, "M3", "ruby"), (19, 4, "M1", "ruby"),
        # Faceted crimson-white fire-ruby core + side flame licks (y=5..8)
        (11, 5, "M1", "ruby"), (12, 5, "M5", "ruby"), (13, 5, "Y4", "magma"),
        (14, 5, "M6", "ruby"), (15, 5, "WH", "magma"), (16, 5, "M5", "ruby"), (17, 5, "M4", "ruby"),
        (18, 5, "O3", "magma"), (19, 5, "M3", "ruby"), (20, 5, "M1", "ruby"),
        (11, 6, "M1", "ruby"), (12, 6, "O4", "magma"), (13, 6, "M6", "ruby"), (14, 6, "M5", "ruby"),
        (15, 6, "Y5", "magma"), (16, 6, "M4", "ruby"), (17, 6, "M3", "ruby"), (18, 6, "M4", "ruby"),
        (19, 6, "O2", "magma"), (20, 6, "M1", "ruby"),
        (11, 7, "M1", "ruby"), (12, 7, "Y4", "magma"), (13, 7, "M5", "ruby"), (14, 7, "M4", "ruby"),
        (15, 7, "M4", "ruby"), (16, 7, "M3", "ruby"), (17, 7, "M2", "ruby"), (18, 7, "O4", "magma"),
        (19, 7, "M3", "ruby"), (20, 7, "M1", "ruby"),
        # Glowing molten bed inside bowl rim (y=8, x=13..18)
        (13, 8, "Y5", "magma"), (14, 8, "M5", "ruby"), (15, 8, "M4", "ruby"),
        (16, 8, "M3", "ruby"), (17, 8, "O4", "magma"), (18, 8, "Y4", "magma"),
    ]
    for x, y, tok, mat in flame_ruby:
        c.set(x, y, tok, mat)

    c.enforce_dark_outline()
    c.shadow_ellipse_if_empty(15.5, 29.0, 14.2, 2.5)
    return c.im


# ===========================================================================
# 3. `ore-crystal-vein.png` (32x32, `standing`, op 28x27: x=2..29, y=3..29)
#    Craggy dark mine rock outcrop bursting with thick gleaming gold veins &
#    faceted glowing amber/crimson crystals!
# ===========================================================================
def build_ore_crystal_vein() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Jagged Asymmetric Chiseled Mine Crag Silhouette (NOT a smooth dome!) ---
    # Three distinct angular rock masses: left jagged crag (peak x=7..12), tall central-right
    # monolith shoulder (peak x=15..21), and lower-right broken ore ledge (x=22..29).
    crag_rows = [
        (8, 15, 19),
        (9, 14, 21),
        (10, 13, 22),
        (11, 6, 10), (11, 12, 23),
        (12, 5, 24),
        (13, 5, 25),
        (14, 4, 26),
        (15, 4, 26),
        (16, 4, 27),
        (17, 3, 28),
        (18, 3, 28),
        (19, 3, 29),
        (20, 3, 29),
        (21, 2, 29),
        (22, 2, 29),
        (23, 2, 29),
        (24, 2, 29),
        (25, 2, 29),
        (26, 2, 29),
        (27, 3, 28),
        (28, 4, 27),
        (29, 6, 25),
    ]
    for y, lx, rx in crag_rows:
        for x in range(lx, rx + 1):
            c.set(x, y, "R2", "rock")

    # Blocky angular 3/4 rock facets (sunlit top-left planes R5/R4, mid R3, deep shadow crevices R1/K0)
    rock_facets = [
        # Upper-central rock peak sunlit left plane (x=14..18, y=9..13) & shadowed right slope (x=19..23)
        (15, 9, "R5"), (16, 9, "R5"), (17, 9, "R4"), (18, 9, "R3"), (19, 9, "R1"),
        (14, 10, "R5"), (15, 10, "R5"), (16, 10, "R4"), (17, 10, "R3"), (18, 10, "R2"), (19, 10, "R1"),
        (13, 11, "R4"), (14, 11, "R4"), (15, 11, "R3"), (16, 11, "R3"), (17, 11, "R2"), (18, 11, "R1"),
        # Left crag shoulder sunlit 3/4 top ledge (x=5..11, y=12..16)
        (6, 12, "R5"), (7, 12, "R5"), (8, 12, "R4"), (9, 12, "R3"),
        (5, 13, "R5"), (6, 13, "R4"), (7, 13, "R4"), (8, 13, "R3"), (11, 13, "R0"),
        (5, 14, "R4"), (6, 14, "R4"), (7, 14, "R3"), (11, 14, "R1"), (12, 14, "R0"),
        # Stepped mid-left boulder face (x=3..10, y=17..24)
        (4, 17, "R5"), (5, 17, "R5"), (6, 17, "R4"), (7, 17, "R3"),
        (4, 18, "R5"), (5, 18, "R4"), (6, 18, "R3"), (7, 18, "R2"), (8, 18, "R1"),
        (3, 21, "R5"), (4, 21, "R5"), (5, 21, "R4"), (6, 21, "R3"),
        (3, 22, "R4"), (4, 22, "R4"), (5, 22, "R3"), (6, 22, "R2"), (7, 22, "R0"),
        (3, 23, "R4"), (4, 23, "R3"), (5, 23, "R2"), (6, 23, "R1"),
        # Deep shadow fracture lines carving crag into distinct angular boulders
        (12, 15, "R0"), (13, 16, "R0"), (14, 17, "K0"), (15, 18, "R1"),
        (19, 15, "R0"), (20, 16, "K0"), (21, 17, "R1"),
        (8, 23, "K0"), (9, 24, "R0"), (10, 25, "R1"),
        # Lower-right shadowed basalt-rock cliff & rubble shelf (x=19..28, y=19..28)
        (21, 19, "R4"), (22, 19, "R3"), (23, 19, "R2"),
        (20, 20, "R3"), (21, 20, "R3"), (22, 20, "R2"), (23, 20, "R1"), (24, 20, "R1"),
        (22, 23, "R4"), (23, 23, "R4"), (24, 23, "R3"), (25, 23, "R2"), (26, 23, "R1"),
        (21, 24, "R0"), (22, 24, "R3"), (23, 24, "R2"), (24, 24, "R1"), (25, 24, "R1"), (26, 24, "K1"), (27, 24, "K1"),
        (22, 25, "R2"), (23, 25, "R1"), (24, 25, "K1"), (25, 25, "K1"), (26, 25, "K1"), (27, 25, "K1"),
        (21, 26, "R1"), (22, 26, "K1"), (23, 26, "K1"), (24, 26, "K1"), (25, 26, "K1"), (26, 26, "K1"),
        # Foreground angular rubble chunks at foot (y=25..28)
        (4, 25, "R5"), (5, 25, "R4"), (6, 25, "R3"), (7, 25, "R1"),
        (4, 26, "R4"), (5, 26, "R3"), (6, 26, "R2"), (7, 26, "K1"),
        (5, 27, "R3"), (6, 27, "R2"), (7, 27, "R1"), (8, 27, "K1"),
        (18, 27, "R2"), (19, 27, "R1"), (20, 27, "K1"), (21, 27, "K1"), (22, 27, "K1"),
        (7, 28, "R2"), (8, 28, "R1"), (9, 28, "K1"), (18, 28, "K1"), (19, 28, "K1"), (20, 28, "K1"),
    ]
    for x, y, tok in rock_facets:
        c.set(x, y, tok, "rock")

    # --- B. Bold Faceted Glowing Amber & Crimson Crystal Clusters Erupting from Crag! ---
    # 1. Tall Hero Glowing AMBER-TOPAZ Hexagonal Crystal Spire (upper-left x=7..14, y=3..14)
    amber_spire = [
        (9, 3, "O0"), (10, 3, "O0"),
        (8, 4, "O0"), (9, 4, "WH"), (10, 4, "Y5"), (11, 4, "O0"),
        (7, 5, "O0"), (8, 5, "WH"), (9, 5, "Y5"), (10, 5, "O4"), (11, 5, "O2"), (12, 5, "O0"),
        (7, 6, "O0"), (8, 6, "Y5"), (9, 6, "O5"), (10, 6, "O4"), (11, 6, "O2"), (12, 6, "O0"),
        (7, 7, "O0"), (8, 7, "Y5"), (9, 7, "O5"), (10, 7, "O4"), (11, 7, "O3"), (12, 7, "O1"), (13, 7, "O0"),
        (8, 8, "O0"), (9, 8, "Y5"), (10, 8, "O5"), (11, 8, "O3"), (12, 8, "O2"), (13, 8, "O0"),
        (8, 9, "O0"), (9, 9, "O5"), (10, 9, "O4"), (11, 9, "O3"), (12, 9, "O1"), (13, 9, "O0"),
        (9, 10, "O0"), (10, 10, "O5"), (11, 10, "O4"), (12, 10, "O2"), (13, 10, "O1"),
        (9, 11, "O0"), (10, 11, "O4"), (11, 11, "O3"), (12, 11, "O2"), (13, 11, "O0"),
        (10, 12, "O0"), (11, 12, "O3"), (12, 12, "O1"),
    ]
    for x, y, tok in amber_spire:
        c.set(x, y, tok, "amber")

    # 2. Twin Faceted CRIMSON-RUBY Crystal Prisms (upper-right x=19..27, y=5..16)
    crimson_cluster = [
        # Main tall ruby prism (x=19..25, y=5..14)
        (22, 5, "M1"), (23, 5, "M1"),
        (21, 6, "M1"), (22, 6, "M6"), (23, 6, "M4"), (24, 6, "M1"),
        (20, 7, "M1"), (21, 7, "M6"), (22, 7, "M5"), (23, 7, "M4"), (24, 7, "M2"), (25, 7, "M1"),
        (20, 8, "M1"), (21, 8, "M6"), (22, 8, "M5"), (23, 8, "M3"), (24, 8, "M2"), (25, 8, "M1"),
        (19, 9, "M1"), (20, 9, "M6"), (21, 9, "M5"), (22, 9, "M4"), (23, 9, "M3"), (24, 9, "M2"), (25, 9, "M1"),
        (19, 10, "M1"), (20, 10, "M5"), (21, 10, "M4"), (22, 10, "M3"), (23, 10, "M2"), (24, 10, "M1"),
        (19, 11, "M1"), (20, 11, "M5"), (21, 11, "M4"), (22, 11, "M3"), (23, 11, "M2"),
        (19, 12, "M1"), (20, 12, "M4"), (21, 12, "M3"), (22, 12, "M2"),
        (19, 13, "M1"), (20, 13, "M3"), (21, 13, "M2"),
        # Secondary angled ruby shard jutting right (x=23..28, y=11..16)
        (26, 11, "M1"), (27, 11, "M1"),
        (25, 12, "M1"), (26, 12, "M6"), (27, 12, "M4"), (28, 12, "M1"),
        (24, 13, "M1"), (25, 13, "M6"), (26, 13, "M5"), (27, 13, "M3"), (28, 13, "M1"),
        (23, 14, "M1"), (24, 14, "M5"), (25, 14, "M4"), (26, 14, "M3"), (27, 14, "M1"),
        (23, 15, "M2"), (24, 15, "M4"), (25, 15, "M2"),
    ]
    for x, y, tok in crimson_cluster:
        c.set(x, y, tok, "ruby")

    # 3. Lower-left jutting crimson crystal & lower-right glowing amber pocket (y=15..22)
    lower_gems = [
        # Left ruby crystal point (x=2..7, y=15..19)
        (3, 15, "M1", "ruby"), (4, 15, "M1", "ruby"),
        (2, 16, "M1", "ruby"), (3, 16, "M6", "ruby"), (4, 16, "M5", "ruby"), (5, 16, "M1", "ruby"),
        (3, 17, "M1", "ruby"), (4, 17, "M5", "ruby"), (5, 17, "M4", "ruby"), (6, 17, "M2", "ruby"),
        (4, 18, "M1", "ruby"), (5, 18, "M4", "ruby"), (6, 18, "M3", "ruby"), (7, 18, "M1", "ruby"),
        # Lower-right glowing amber prism (x=23..28, y=18..22)
        (26, 18, "O0", "amber"), (27, 18, "O0", "amber"),
        (25, 19, "O0", "amber"), (26, 19, "Y5", "amber"), (27, 19, "O4", "amber"), (28, 19, "O0", "amber"),
        (24, 20, "O0", "amber"), (25, 20, "Y5", "amber"), (26, 20, "O4", "amber"), (27, 20, "O2", "amber"), (28, 20, "O0", "amber"),
        (24, 21, "O1", "amber"), (25, 21, "O4", "amber"), (26, 21, "O3", "amber"), (27, 21, "O1", "amber"),
    ]
    for x, y, tok, mat in lower_gems:
        c.set(x, y, tok, mat)

    # --- C. Chunky Metallic Gold Ore Seams & Embedded Faceted Gold Nuggets! ---
    # Instead of uniform squiggly lines, render natural stepped angular gold pockets + fat nuggets!
    gold_pockets = [
        # Upper gold seam wedged in rock cleft (x=14..17, y=12..15)
        (15, 12, "Y5"), (16, 12, "Y3"),
        (14, 13, "Y5"), (15, 13, "Y4"), (16, 13, "Y2"),
        (14, 14, "Y3"), (15, 14, "Y2"),
        # Big faceted central motherlode gold cluster (x=10..16, y=15..20)
        (11, 15, "Y0"), (12, 15, "Y0"),
        (10, 16, "Y0"), (11, 16, "WH"), (12, 16, "Y5"), (13, 16, "Y3"),
        (9, 17, "Y4"), (10, 17, "Y5"), (11, 17, "Y4"), (12, 17, "Y3"), (13, 17, "Y2"),
        (10, 18, "Y3"), (11, 18, "Y4"), (12, 18, "Y2"), (13, 18, "Y1"),
        (13, 19, "Y5"), (14, 19, "Y4"), (15, 19, "Y3"), (16, 19, "Y1"),
        (14, 20, "Y4"), (15, 20, "Y3"), (16, 20, "Y2"),
        # Secondary stepped gold vein to right crag (x=17..20, y=16..18)
        (17, 16, "Y5"), (18, 16, "Y3"),
        (17, 17, "Y4"), (18, 17, "Y4"), (19, 17, "Y2"),
        (18, 18, "Y3"), (19, 18, "Y1"),
        # Lower-left gold nugget pocket (x=7..11, y=20..23)
        (8, 20, "Y5"), (9, 20, "Y4"), (10, 20, "Y2"),
        (7, 21, "Y4"), (8, 21, "Y5"), (9, 21, "Y3"), (10, 21, "Y1"),
        (8, 22, "Y3"), (9, 22, "Y2"),
        # Rich exposed gold nugget boulder at foreground foot (x=11..18, y=23..28)
        (12, 23, "Y0"), (13, 23, "Y5"), (14, 23, "Y4"), (15, 23, "Y0"),
        (11, 24, "Y0"), (12, 24, "WH"), (13, 24, "Y5"), (14, 24, "Y3"), (15, 24, "Y4"), (16, 24, "Y2"),
        (11, 25, "Y4"), (12, 25, "Y5"), (13, 25, "Y4"), (14, 25, "Y2"), (15, 25, "Y3"), (16, 25, "Y4"), (17, 25, "Y2"),
        (12, 26, "Y3"), (13, 26, "Y3"), (14, 26, "Y1"), (15, 26, "Y2"), (16, 26, "Y3"), (17, 26, "Y1"),
        (13, 27, "Y2"), (14, 27, "Y1"), (15, 27, "Y2"), (16, 27, "Y1"),
    ]
    for x, y, tok in gold_pockets:
        c.set(x, y, tok, "gold")

    c.enforce_dark_outline()
    c.shadow_ellipse_if_empty(15.5, 28.8, 14.2, 2.4)
    return c.im


# ===========================================================================
# 4. `lava-brazier.png` (16x32, `standing`, op 14x29: x=1..14, y=2..30)
#    Squat riveted dwarven iron-and-basalt cauldron brazier brimming with
#    bubbling white-hot yellow-orange molten lava!
# ===========================================================================
def build_lava_brazier() -> Image.Image:
    c = Canvas(16, 32)

    # --- A. Rising Molten Flame Tongue & Heat Plume Above Lava Pool (y=2..9, x=4..11) ---
    plume = [
        (7, 2, "M0"), (8, 2, "M0"),
        (6, 3, "M0"), (7, 3, "O4"), (8, 3, "M4"), (9, 3, "M0"),
        (5, 4, "M0"), (6, 4, "Y4"), (7, 4, "Y5"), (8, 4, "O3"), (9, 4, "M0"),
        (5, 5, "M0"), (6, 5, "O4"), (7, 5, "WH"), (8, 5, "Y4"), (9, 5, "M4"), (10, 5, "M0"),
        (4, 6, "M0"), (5, 6, "M4"), (6, 6, "Y5"), (7, 6, "WH"), (8, 6, "Y5"), (9, 6, "O4"), (10, 6, "M3"), (11, 6, "M0"),
        (4, 7, "M0"), (5, 7, "O4"), (6, 7, "Y5"), (7, 7, "Y5"), (8, 7, "Y4"), (9, 7, "O4"), (10, 7, "O3"), (11, 7, "M0"),
    ]
    for x, y, tok in plume:
        c.set(x, y, tok, "magma")

    # --- B. 3/4 Elliptical Forged-Iron Cauldron Rim & Brimming Bubbling Lava (y=8..15, x=1..14) ---
    c.hline(3, 12, 8, "S0", "steel")
    c.set(2, 9, "S0", "steel")
    c.set(3, 9, "S4", "steel")
    c.set(12, 9, "S2", "steel")
    c.set(13, 9, "S0", "steel")

    # Wide elliptical molten lava pool (y=9..13, x=3..12) with 2 white-hot lava bubbles!
    lava_pool = [
        (4, 9, "M4"), (5, 9, "O4"), (6, 9, "Y5"), (7, 9, "Y4"),
        (8, 9, "O4"), (9, 9, "O3"), (10, 9, "M4"), (11, 9, "M3"),
        (3, 10, "M3"), (4, 10, "O4"), (5, 10, "WH"), (6, 10, "Y5"),
        (7, 10, "O4"), (8, 10, "Y4"), (9, 10, "O4"), (10, 10, "O3"), (11, 10, "M4"), (12, 10, "M2"),
        (3, 11, "O3"), (4, 11, "Y4"), (5, 11, "Y5"), (6, 11, "O4"),
        (7, 11, "O3"), (8, 11, "Y5"), (9, 11, "WH"), (10, 11, "Y4"), (11, 11, "O3"), (12, 11, "M3"),
        (3, 12, "M4"), (4, 12, "O3"), (5, 12, "O4"), (6, 12, "Y5"),
        (7, 12, "Y5"), (8, 12, "Y4"), (9, 12, "O4"), (10, 12, "O3"), (11, 12, "M4"), (12, 12, "M3"),
        (4, 13, "M4"), (5, 13, "O4"), (6, 13, "Y4"), (7, 13, "Y5"),
        (8, 13, "O4"), (9, 13, "O3"), (10, 13, "M4"), (11, 13, "M3"),
    ]
    for x, y, tok in lava_pool:
        c.set(x, y, tok, "magma")

    # Outer left/right iron cauldron rim walls (y=10..13)
    for y in range(10, 14):
        c.set(1, y, "S0", "steel")
        c.set(2, y, "S5" if y <= 11 else "S4", "steel")
        c.set(13, y, "S3" if y <= 11 else "S2", "steel")
        c.set(14, y, "S0", "steel")

    # Near (front) thick rolled dwarven iron lip (y=14..15, x=2..13)
    c.hline(2, 13, 14, "S4", "steel")
    c.hline(3, 8, 14, "S6", "steel")
    c.set(2, 14, "S0", "steel")
    c.set(13, 14, "S0", "steel")
    c.hline(2, 13, 15, "S1", "steel")
    c.set(2, 15, "S0", "steel")
    c.set(13, 15, "S0", "steel")

    # Viscous glowing lava drip oozing over the front lip at x=7..8, y=14..17!
    c.set(7, 14, "Y5", "magma")
    c.set(8, 14, "O4", "magma")
    c.set(7, 15, "Y4", "magma")
    c.set(8, 15, "M4", "magma")

    # --- C. Squat Riveted Iron-and-Basalt Cauldron Belly + Side Ring Handles (y=16..24) ---
    for y in range(16, 20):
        c.set(1, y, "S0", "steel")
        c.set(14, y, "S0", "steel")
    c.set(2, 16, "S5", "steel")
    c.set(2, 17, "S4", "steel")
    c.set(2, 18, "S3", "steel")
    c.set(2, 19, "S0", "steel")
    c.set(13, 16, "S3", "steel")
    c.set(13, 17, "S2", "steel")
    c.set(13, 18, "S1", "steel")
    c.set(13, 19, "S0", "steel")

    belly_spans = [
        (16, 3, 12),
        (17, 2, 13),
        (18, 2, 13),
        (19, 2, 13),
        (20, 2, 13),
        (21, 3, 12),
        (22, 3, 12),
        (23, 4, 11),
    ]
    for y, lx, rx in belly_spans:
        c.set(lx, y, "S0", "steel")
        c.set(rx, y, "S0", "steel")
        for x in range(lx + 1, rx):
            if x <= 5:
                tok = "S4" if y <= 19 else "S3"
            elif x <= 8:
                tok = "S3" if y <= 18 else "S2"
            else:
                tok = "B2" if y <= 18 else "B1"
            c.set(x, y, tok, "steel")

    # Riveted middle iron belly band (y=20)
    c.hline(3, 12, 20, "S2", "steel")
    for rx_pt, tok in ((4, "S6"), (7, "S5"), (10, "S4"), (12, "S1")):
        c.set(rx_pt, 20, tok, "steel")
    c.set(7, 16, "O4", "magma")
    c.set(7, 17, "M3", "magma")

    # Three glowing dwarven vertical fire-slits in upper belly (x=5, 8, 10 at y=17..19)
    for sx, hi_tok, lo_tok in ((5, "Y5", "O4"), (8, "Y4", "O3"), (10, "O4", "M4")):
        c.set(sx, 17, hi_tok, "magma")
        c.set(sx, 18, lo_tok, "magma")
        c.set(sx, 19, "M3", "magma")

    # --- D. Carved Basalt Collar & Clawed Dwarven Iron Tripod Feet (y=24..30, x=2..13) ---
    c.rect(4, 24, 11, 25, "K0", "obsidian")
    c.hline(5, 10, 24, "K4", "obsidian")
    c.set(5, 24, "K5", "obsidian")
    c.hline(5, 10, 25, "K2", "obsidian")

    c.rect(3, 26, 12, 27, "K0", "obsidian")
    c.hline(4, 11, 26, "K4", "obsidian")
    c.hline(4, 7, 26, "K5", "obsidian")
    c.hline(4, 11, 27, "K2", "obsidian")
    c.set(7, 27, "M3", "magma")
    c.set(8, 27, "M2", "magma")

    for y in (28, 29, 30):
        c.rect(2, y, 5, y, "S0", "steel")
        c.rect(10, y, 13, y, "S0", "steel")
    c.set(3, 28, "S5", "steel")
    c.set(4, 28, "S3", "steel")
    c.set(3, 29, "S4", "steel")
    c.set(4, 29, "S2", "steel")
    c.set(11, 28, "S3", "steel")
    c.set(12, 28, "S2", "steel")
    c.set(11, 29, "S2", "steel")
    c.set(12, 29, "S1", "steel")

    c.enforce_dark_outline()
    c.shadow_ellipse_if_empty(7.5, 30.0, 6.8, 1.8)
    return c.im


# ===========================================================================
# 5. `pickaxe-rack.png` (32x32, `standing`, op 28x28: x=2..29, y=2..29)
#    Sturdy timber mine frame rack holding 2 steel-headed pickaxes (curved
#    twin-pointed steel blades elevated clearly above crossbar!), iron shovel,
#    glowing brass miner's lantern & coiled rope!
# ===========================================================================
def build_pickaxe_rack() -> Image.Image:
    c = Canvas(32, 32)

    # --- A. Sturdy Timber Mine Frame Rack (x=2..29, y=8..29; exact symmetric 28px width!) ---
    # 1. Left & right flared timber foot-skids on ground line (y=26..29, left x=3..9, right x=23..29)
    for fx0, fx1 in ((3, 9), (23, 29)):
        c.rect(fx0, 26, fx1, 29, "W1", "wood")
        c.hline(fx0 + 1, fx1 - 1, 26, "W7", "wood")
        c.hline(fx0 + 1, fx1 - 1, 27, "W5", "wood")
        c.hline(fx0 + 1, fx1 - 1, 28, "W3", "wood")
        c.set(fx0 + 1, 27, "S4", "steel")
        c.set(fx1 - 1, 27, "S2", "steel")

    # 2. Upright heavy oak posts (left x=5..7, right x=25..27, y=8..27)
    for px0 in (5, 25):
        c.rect(px0, 8, px0 + 2, 27, "W1", "wood")
        c.vline(px0 + 1, 9, 26, "W6" if px0 == 5 else "W5", "wood")
        for ky in (14, 19, 24):
            c.set(px0 + 1, ky, "W4", "wood")

    # 3. Lower horizontal brace rail (x=5..27, y=21..23)
    c.hline(5, 27, 21, "W1", "wood")
    c.hline(6, 26, 21, "W6", "wood")
    c.hline(6, 26, 22, "W4", "wood")
    c.hline(5, 27, 23, "W1", "wood")
    for bx in (6, 26):
        c.set(bx, 22, "S4", "steel")

    # 4. Heavy 3/4 Top Notched Timber Crossbar at y=8..12 (x=4..29) — lowered so pickaxe blades soar above!
    c.rect(4, 8, 29, 12, "W1", "wood")
    c.hline(5, 28, 9, "W7", "wood")
    c.hline(5, 17, 9, "C5", "wood")
    c.hline(5, 28, 10, "W5", "wood")
    c.hline(5, 28, 11, "W3", "wood")
    for sx in (5, 28):
        c.set(sx, 9, "S5", "steel")
        c.set(sx, 10, "S3", "steel")
        c.set(sx, 11, "S2", "steel")

    # --- B. Two Bold Curved Steel-Headed Dwarven Pickaxes (y=2..27) ---
    # Positioned so their wide arched steel crescent heads (y=3..7) stand proudly ABOVE the y=8..12 crossbar!
    for shaft_x, top_y in ((10, 2), (17, 3)):
        # Hickory handle shaft running down through rack notches to y=26
        for y in range(top_y + 1, 27):
            c.set(shaft_x - 1, y, "W1", "wood")
            c.set(shaft_x, y, "C5" if y < 19 else "W6", "wood")
            c.set(shaft_x + 1, y, "W4", "wood")
            c.set(shaft_x + 2, y, "W1", "wood")
        c.hline(shaft_x - 1, shaft_x + 2, 27, "W1", "wood")
        # Wooden handle finial cap at very top (top_y)
        c.set(shaft_x, top_y, "W1", "wood")
        c.set(shaft_x + 1, top_y, "W1", "wood")
        c.set(shaft_x, top_y + 1, "C6", "wood")
        c.set(shaft_x + 1, top_y + 1, "W5", "wood")

        # Wide 10px arched steel pickaxe head (`shaft_x-4 .. shaft_x+5`, `hy .. hy+4`)!
        hy = top_y + 1
        c.hline(shaft_x - 2, shaft_x + 3, hy, "S0", "steel")
        # Thick gleaming steel crescent arch (hy+1)
        c.set(shaft_x - 3, hy + 1, "S0", "steel")
        c.set(shaft_x - 2, hy + 1, "S6", "steel")
        c.set(shaft_x - 1, hy + 1, "S6", "steel")
        c.set(shaft_x, hy + 1, "Y4", "gold")       # brass/iron socket collar!
        c.set(shaft_x + 1, hy + 1, "Y2", "gold")
        c.set(shaft_x + 2, hy + 1, "S5", "steel")
        c.set(shaft_x + 3, hy + 1, "S4", "steel")
        c.set(shaft_x + 4, hy + 1, "S0", "steel")
        # Sweeping left & right curved steel pick prongs (hy+2)
        c.set(shaft_x - 4, hy + 2, "S0", "steel")
        c.set(shaft_x - 3, hy + 2, "S6", "steel")
        c.set(shaft_x - 2, hy + 2, "S4", "steel")
        c.set(shaft_x - 1, hy + 2, "S0", "steel")
        c.set(shaft_x, hy + 2, "S3", "steel")
        c.set(shaft_x + 1, hy + 2, "S2", "steel")
        c.set(shaft_x + 2, hy + 2, "S0", "steel")
        c.set(shaft_x + 3, hy + 2, "S4", "steel")
        c.set(shaft_x + 4, hy + 2, "S5", "steel")
        c.set(shaft_x + 5, hy + 2, "S0", "steel")
        # Drooping sharp pick tips (hy+3 .. hy+4) with bright steel glint inside dark 1px outline!
        c.set(shaft_x - 4, hy + 3, "S0", "steel")
        c.set(shaft_x - 3, hy + 3, "S5", "steel")
        c.set(shaft_x - 2, hy + 3, "S0", "steel")
        c.set(shaft_x + 3, hy + 3, "S0", "steel")
        c.set(shaft_x + 4, hy + 3, "S4", "steel")
        c.set(shaft_x + 5, hy + 3, "S0", "steel")
        c.set(shaft_x - 4, hy + 4, "S0", "steel")
        c.set(shaft_x - 3, hy + 4, "S0", "steel")
        c.set(shaft_x + 4, hy + 4, "S0", "steel")
        c.set(shaft_x + 5, hy + 4, "S0", "steel")

    # --- C. Iron Miner's Shovel on Right Slot (x=21..26, y=5..29) ---
    # Wooden D/T-grip handle at top (x=21..25, y=5..7)
    c.hline(21, 25, 5, "W1", "wood")
    c.set(21, 6, "W1", "wood")
    c.set(22, 6, "C5", "wood")
    c.set(23, 6, "W6", "wood")
    c.set(24, 6, "W5", "wood")
    c.set(25, 6, "W1", "wood")
    c.hline(21, 25, 7, "W1", "wood")
    # Shovel shaft (x=22..24, y=7..20)
    for y in range(7, 21):
        c.set(22, y, "W1", "wood")
        c.set(23, y, "W6", "wood")
        c.set(24, y, "W1", "wood")
    # Broad pointed steel spade blade at bottom (x=20..26, y=20..29)
    spade_rows = [
        (20, 21, 25),
        (21, 20, 26),
        (22, 20, 26),
        (23, 20, 26),
        (24, 20, 26),
        (25, 20, 26),
        (26, 21, 25),
        (27, 21, 25),
        (28, 22, 24),
        (29, 23, 23),
    ]
    for y, lx, rx in spade_rows:
        for x in range(lx, rx + 1):
            if x == lx or x == rx or y == 20 or y == 29 or (y == 28 and x in (22, 24)):
                c.set(x, y, "S0", "steel")
            elif x < 23:
                c.set(x, y, "S6" if y <= 24 else "S5", "steel")
            elif x == 23:
                c.set(x, y, "S4" if y <= 25 else "S3", "steel")
            else:
                c.set(x, y, "S3" if y <= 24 else "S2", "steel")
    c.set(21, 21, "S5", "steel")

    # --- D. Glowing Brass Miner's Lantern Hanging on Left Iron Hook (x=2..6, y=11..19) ---
    c.hline(3, 5, 11, "S0", "steel")
    c.set(3, 12, "S4", "steel")
    c.set(4, 12, "S0", "steel")
    c.hline(3, 5, 13, "Y0", "gold")
    c.set(2, 14, "Y0", "gold")
    c.set(3, 14, "Y4", "gold")
    c.set(4, 14, "Y3", "gold")
    c.set(5, 14, "Y2", "gold")
    c.set(6, 14, "Y0", "gold")
    for y, l_tok, c_tok, r_tok in (
        (15, "Y5", "WH", "Y4"),
        (16, "Y5", "WH", "O4"),
        (17, "Y4", "Y5", "O3"),
    ):
        c.set(2, y, "Y0", "gold")
        c.set(3, y, l_tok, "gold")
        c.set(4, y, c_tok, "gold")
        c.set(5, y, r_tok, "gold")
        c.set(6, y, "Y0", "gold")
    c.set(2, 18, "Y0", "gold")
    c.set(3, 18, "Y3", "gold")
    c.set(4, 18, "Y2", "gold")
    c.set(5, 18, "Y1", "gold")
    c.set(6, 18, "Y0", "gold")
    c.hline(3, 5, 19, "Y0", "gold")

    # --- E. Thick Coiled Hemp Rope at Left-Center Base (x=8..16, y=22..29) ---
    rope_px = [
        (10, 22, "H0"), (11, 22, "H0"), (12, 22, "H0"), (13, 22, "H0"), (14, 22, "H0"),
        (9, 23, "H0"), (10, 23, "H4"), (11, 23, "H5"), (12, 23, "H3"), (13, 23, "H4"), (14, 23, "H2"), (15, 23, "H0"),
        (8, 24, "H0"), (9, 24, "H5"), (10, 24, "H3"), (11, 24, "H1"), (12, 24, "H1"), (13, 24, "H3"), (14, 24, "H5"), (15, 24, "H2"), (16, 24, "H0"),
        (8, 25, "H0"), (9, 25, "H4"), (10, 25, "H2"), (11, 25, "H0"), (12, 25, "H0"), (13, 25, "H1"), (14, 25, "H3"), (15, 25, "H2"), (16, 25, "H0"),
        (8, 26, "H0"), (9, 26, "H5"), (10, 26, "H3"), (11, 26, "H1"), (12, 26, "H2"), (13, 26, "H4"), (14, 26, "H3"), (15, 26, "H1"), (16, 26, "H0"),
        (8, 27, "H0"), (9, 27, "H3"), (10, 27, "H4"), (11, 27, "H5"), (12, 27, "H3"), (13, 27, "H2"), (14, 27, "H4"), (15, 27, "H2"), (16, 27, "H0"),
        (9, 28, "H0"), (10, 28, "H2"), (11, 28, "H3"), (12, 28, "H4"), (13, 28, "H3"), (14, 28, "H2"), (15, 28, "H0"),
        (10, 29, "H0"), (11, 29, "H0"), (12, 29, "H0"), (13, 29, "H0"), (14, 29, "H0"),
    ]
    for x, y, tok in rope_px:
        c.set(x, y, tok, "rope")

    c.enforce_dark_outline()
    c.shadow_band_if_empty(3, 29, 28, 30)
    return c.im


# ===========================================================================
# 6. `rails-kit.png` (48x16, `topdown`: 3 modular 16x16 minecart rail tiles)
#    - Tile 0 (x=0..15):  Straight E-W track on wooden sleepers
#    - Tile 1 (x=16..31): Straight N-S track on wooden sleepers
#    - Tile 2 (x=32..47): 90 deg S-to-E curved rail turn on radial sleepers
# ===========================================================================
def build_rails_kit() -> Image.Image:
    c = Canvas(48, 16)

    # -----------------------------------------------------------------------
    # Tile 0 (x=0..15): Straight E-W Track
    # -----------------------------------------------------------------------
    for sx0 in (1, 6, 11):
        for y in range(1, 15):
            if y in (1, 14):
                c.hline(sx0, sx0 + 3, y, "W1", "wood")
            else:
                c.set(sx0, y, "W1", "wood")
                c.set(sx0 + 1, y, "W7" if y < 8 else "W6", "wood")
                c.set(sx0 + 2, y, "W5" if y < 9 else "W4", "wood")
                c.set(sx0 + 3, y, "W1", "wood")
                if y in (7, 8):
                    c.set(sx0 + 2, y, "W3", "wood")

    for ry in (3, 10):
        for x in range(0, 16):
            c.set(x, ry, "S0", "steel")
            c.set(x, ry + 2, "S0", "steel")
            if x in (0, 15):
                c.set(x, ry + 1, "S1", "steel")
            else:
                c.set(x, ry + 1, "S6" if (ry == 3 or x < 10) else "S5", "steel")
        for sx0 in (1, 6, 11):
            c.set(sx0 + 1, ry, "S2", "steel")
            c.set(sx0 + 2, ry + 2, "S1", "steel")
            c.set(sx0 + 3, ry + 1, "S4", "steel")

    # -----------------------------------------------------------------------
    # Tile 1 (x=16..31): Straight N-S Track
    # -----------------------------------------------------------------------
    ox1 = 16
    for sy0 in (1, 6, 11):
        for lx in range(1, 15):
            x = ox1 + lx
            if lx in (1, 14):
                c.vline(x, sy0, sy0 + 3, "W1", "wood")
            else:
                c.set(x, sy0, "W1", "wood")
                c.set(x, sy0 + 1, "W7" if lx < 8 else "W6", "wood")
                c.set(x, sy0 + 2, "W5" if lx < 9 else "W4", "wood")
                c.set(x, sy0 + 3, "W1", "wood")
                if lx in (7, 8):
                    c.set(x, sy0 + 2, "W3", "wood")

    for rlx in (3, 10):
        rx = ox1 + rlx
        for y in range(0, 16):
            c.set(rx, y, "S0", "steel")
            c.set(rx + 2, y, "S0", "steel")
            if y in (0, 15):
                c.set(rx + 1, y, "S1", "steel")
            else:
                c.set(rx + 1, y, "S6" if (rlx == 3 or y < 10) else "S5", "steel")
        for sy0 in (1, 6, 11):
            c.set(rx, sy0 + 1, "S2", "steel")
            c.set(rx + 2, sy0 + 2, "S1", "steel")
            c.set(rx + 1, sy0 + 3, "S4", "steel")

    # -----------------------------------------------------------------------
    # Tile 2 (x=32..47): 90 deg S-to-E Curved Rail Turn
    # Radial wooden sleepers protrude 2px PAST both outer rail (R=11.5) and
    # inner rail (R=4.5), matching straight E-W and N-S sleepers!
    # -----------------------------------------------------------------------
    ox2 = 32
    px_piv, py_piv = 15.5, 15.5

    # 1. Draw 3 fanned radial wooden sleepers (angles 20, 45, 70 deg) spanning R = 1.6 .. 14.8!
    for deg in (20.0, 45.0, 70.0):
        rad = math.radians(deg)
        ux, uy = -math.cos(rad), -math.sin(rad)
        tx, ty = -uy, ux
        for ly in range(1, 15):
            for lx in range(1, 15):
                vx, vy = lx - px_piv, ly - py_piv
                r_proj = vx * ux + vy * uy
                t_proj = vx * tx + vy * ty
                if 1.6 <= r_proj <= 14.8 and abs(t_proj) <= 1.85:
                    if r_proj < 2.5 or r_proj > 13.9 or abs(t_proj) > 1.05:
                        c.set(ox2 + lx, ly, "W1", "wood")
                    else:
                        c.set(ox2 + lx, ly, "W7" if t_proj < 0 else "W5", "wood")

    # 2. Overlay smooth curved outer steel rail (R=11.5) & inner steel rail (R=4.5)
    for ly in range(0, 16):
        for lx in range(0, 16):
            dist = math.hypot(lx - px_piv, ly - py_piv)
            # Outer rail arc (R = 11.5, crisp 3px band 10.15 .. 12.85)
            if 10.15 <= dist <= 12.85:
                if abs(dist - 11.5) <= 0.72:
                    if lx == 15 or ly == 15:
                        c.set(ox2 + lx, ly, "S1", "steel")
                    else:
                        c.set(ox2 + lx, ly, "S6" if (lx + ly) < 23 else "S5", "steel")
                else:
                    c.set(ox2 + lx, ly, "S0", "steel")
            # Inner rail arc (R = 4.5, crisp 3px band 3.15 .. 5.85)
            elif 3.15 <= dist <= 5.85:
                if abs(dist - 4.5) <= 0.72:
                    if lx == 15 or ly == 15:
                        c.set(ox2 + lx, ly, "S1", "steel")
                    else:
                        c.set(ox2 + lx, ly, "S5", "steel")
                else:
                    c.set(ox2 + lx, ly, "S0", "steel")

    # Guarantee exact 3px terminal collars at South edge (y=15, lx=3..5 & 10..12) and East edge (lx=15, y=3..5 & 10..12)
    for k in range(16):
        c.set(ox2 + k, 15, ".")
        c.set(ox2 + 15, k, ".")
    for base in (3, 10):
        c.set(ox2 + base, 15, "S0", "steel")
        c.set(ox2 + base + 1, 15, "S1", "steel")
        c.set(ox2 + base + 2, 15, "S0", "steel")
        c.set(ox2 + 15, base, "S0", "steel")
        c.set(ox2 + 15, base + 1, "S1", "steel")
        c.set(ox2 + 15, base + 2, "S0", "steel")

    c.enforce_dark_outline(check_canvas_edges=True)
    return c.im


# ===========================================================================
# Machine Verification & Preview Sheet Builder
# ===========================================================================
def load_valid_palette_hexes() -> set[str]:
    data = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    out: set[str] = set()
    for ramp in data["ramps"].values():
        for hx in ramp:
            out.add(hx.lower())
    return out


def verify_sprite(
    name: str,
    im: Image.Image,
    expected_canvas: tuple[int, int],
    camera: str,
    valid_hexes: set[str],
) -> dict:
    assert im.size == expected_canvas, f"{name}: size {im.size} != {expected_canvas}"
    w, h = im.size
    px = im.load()

    opaque_pts: list[tuple[int, int]] = []
    shadow_cnt = 0
    off_palette: list[tuple[int, int, str]] = []
    bad_alpha: list[tuple[int, int, int]] = []
    pure_black = 0
    bright_edge: list[tuple[int, int, str, float]] = []

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a == SHADOW_ALPHA:
                if (r, g, b) != SHADOW_RGB:
                    bad_alpha.append((x, y, a))
                else:
                    shadow_cnt += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, a))
                continue

            opaque_pts.append((x, y))
            hx = f"#{r:02x}{g:02x}{b:02x}"
            if (r, g, b) == (0, 0, 0):
                pure_black += 1
            if hx not in valid_hexes:
                off_palette.append((x, y, hx))

            touches_non_opaque = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] != 255:
                    touches_non_opaque = True
                    break
            if touches_non_opaque:
                lm = luma(r, g, b)
                if lm > 60.0 or hx not in DARK_OUTLINE_HEXES:
                    bright_edge.append((x, y, hx, round(lm, 1)))

    assert not off_palette, f"{name}: off-palette pixels: {off_palette[:5]}"
    assert pure_black == 0, f"{name}: pure #000000 pixels found!"
    assert not bad_alpha, f"{name}: illegal semi-transparent pixels: {bad_alpha[:5]}"
    assert not bright_edge, f"{name}: non-dark outer outline pixels: {bright_edge[:5]}"
    assert opaque_pts, f"{name}: empty sprite!"

    xs = [p[0] for p in opaque_pts]
    ys = [p[1] for p in opaque_pts]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    ow = x1 - x0 + 1
    oh = y1 - y0 + 1
    left_gap = x0
    right_gap = (w - 1) - x1
    bottom_gap = (h - 1) - y1

    if camera != "topdown":
        assert abs(left_gap - right_gap) <= 1, f"{name}: off-center left={left_gap}, right={right_gap}"
        assert 1 <= bottom_gap <= 2, f"{name}: bottom_gap={bottom_gap} outside 1..2"

    used_colors = len({f"#{px[x, y][0]:02x}{px[x, y][1]:02x}{px[x, y][2]:02x}" for x, y in opaque_pts})
    return {
        "name": name,
        "camera": camera,
        "canvas": f"{w}x{h}",
        "opaque": f"{ow}x{oh}",
        "bbox": (x0, y0, x1, y1),
        "bottom_gap": bottom_gap,
        "shadow_px": shadow_cnt,
        "colors": used_colors,
    }


def load_beodeul_char_1x() -> Image.Image:
    src = Image.open(CHAR_REF_4X).convert("RGBA")
    return src.resize((src.width // 4, src.height // 4), Image.Resampling.NEAREST)


def build_preview_sheet(rendered: list[tuple[str, str, Image.Image, dict]]) -> None:
    """Save `preview_mine_volcano.png` on #767670 showing 3x loupe + (2x + 1x + 22px Beodeul char)
    for all 6 sprites, plus an assembled live railway + minecart track-connectivity proof!
    """
    bg_gray = (0x76, 0x76, 0x70, 255)  # exact required #767670 neutral gray
    header_bg = (0x58, 0x56, 0x52, 255)
    card_bg = (0x68, 0x67, 0x62, 255)
    border = (0x8E, 0x8D, 0x86, 255)
    text_hi = (246, 244, 236, 255)
    text_lo = (214, 212, 202, 255)

    char_1x = load_beodeul_char_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    sheet_w, sheet_h = 1248, 540
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar
    draw.rectangle([0, 0, sheet_w - 1, 82], fill=header_bg)
    draw.line([(0, 82), (sheet_w - 1, 82)], fill=border)
    sheet.alpha_composite(char_2x, (18, 82 - 10 - char_2x.height))
    sheet.alpha_composite(char_1x, (18 + char_2x.width + 10, 82 - 10 - char_1x.height))

    draw.text(
        (110, 14),
        "T3 DUNGEON THEME OBJECTS BATCH 4/4 - mine_volcano (6 Dwarven Mine & Volcanic Magma Objects) | gemini-4-carbon (medium)",
        fill=text_hi,
        font=font,
    )
    draw.text(
        (110, 34),
        f"100% Locked to fable-city/palette.json | 0 off-palette | 0 #000000 | #4c557f@85 shadow | 1px dark outlines | Beodeul Hero 1x ({char_1x.width}x{char_1x.height})",
        fill=text_lo,
        font=font,
    )
    draw.text(
        (110, 54),
        "Each card on #767670: Upper [3x Loupe]  |  Middle [2x + 1x + Beodeul Hero 1x]  |  Bottom [Specs & Modular Track Join Check]",
        fill=text_lo,
        font=font,
    )

    card_w = 194
    gap = 11
    start_x = 14
    top_y = 96
    card_h = 428

    rails_im: Image.Image | None = None
    cart_im: Image.Image | None = None

    for idx, (fname, camera, im, stats) in enumerate(rendered):
        if fname == "rails-kit.png":
            rails_im = im
        elif fname == "minecart.png":
            cart_im = im

        cx = start_x + idx * (card_w + gap)
        draw.rectangle([cx, top_y, cx + card_w, top_y + card_h], fill=bg_gray, outline=border)
        draw.rectangle([cx + 1, top_y + 1, cx + card_w - 1, top_y + 22], fill=card_bg)
        short = fname.replace(".png", "")
        draw.text((cx + 6, top_y + 6), f"0{idx + 1} {short}", fill=text_hi, font=font)

        # Compartment 1: 3x Loupe (for 48x16 rails-kit -> 144x48, fits 194px cleanly!)
        im_3x = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
        lx = cx + (card_w - im_3x.width) // 2
        ly = top_y + 30 + (128 - im_3x.height) // 2
        sheet.alpha_composite(im_3x, (lx, ly))
        draw.line([(cx + 8, top_y + 168), (cx + card_w - 8, top_y + 168)], fill=border)

        # Compartment 2: 2x + 1x + Beodeul Hero 1x on exact #767670!
        floor_y = top_y + 266
        draw.line([(cx + 8, floor_y + 2), (cx + card_w - 8, floor_y + 2)], fill=card_bg)
        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        total_row_w = im_2x.width + 6 + im.width + 6 + char_1x.width
        if total_row_w <= card_w - 8:
            rx0 = cx + (card_w - total_row_w) // 2
            sheet.alpha_composite(im_2x, (rx0, floor_y - im_2x.height))
            sheet.alpha_composite(im, (rx0 + im_2x.width + 6, floor_y - im.height))
            sheet.alpha_composite(char_1x, (rx0 + im_2x.width + 6 + im.width + 6, floor_y - char_1x.height))
        else:
            # For 48x16 rails-kit (2x=96px + 48px + 22px = 178px <= 186px, actually fits too!)
            rx0 = cx + max(4, (card_w - total_row_w) // 2)
            sheet.alpha_composite(im_2x, (rx0, floor_y - im_2x.height))
            sheet.alpha_composite(im, (rx0 + im_2x.width + 5, floor_y - im.height))
            sheet.alpha_composite(char_1x, (rx0 + im_2x.width + 5 + im.width + 5, floor_y - char_1x.height))

        # Compartment 3: Stats & notes
        draw.line([(cx + 8, top_y + 278), (cx + card_w - 8, top_y + 278)], fill=border)
        draw.text(
            (cx + 6, top_y + 284),
            f"{stats['canvas']} {camera} | op {stats['opaque']}",
            fill=text_hi,
            font=font,
        )
        draw.text(
            (cx + 6, top_y + 300),
            f"{stats['colors']} colors | sh {stats['shadow_px']}px",
            fill=text_lo,
            font=font,
        )

    # Bonus in Card 6 & Card 1 bottom space: Live L-corner Track Assembly (2x) proving seamless E-W + N-S + S-to-E join!
    if rails_im is not None and cart_im is not None:
        ew = rails_im.crop((0, 0, 16, 16))
        ns = rails_im.crop((16, 0, 32, 16))
        se = rails_im.crop((32, 0, 48, 16))
        # Assemble a 4x2 tile L-bend (64x32 at 1x -> 128x64 at 2x) inside Card 6 bottom!
        asm = Image.new("RGBA", (64, 32), TRANSPARENT)
        asm.alpha_composite(se, (0, 0))   # (0,0): S-to-E turn connects South -> East!
        asm.alpha_composite(ew, (16, 0))  # (1,0): E-W straight
        asm.alpha_composite(ew, (32, 0))  # (2,0): E-W straight
        asm.alpha_composite(ew, (48, 0))  # (3,0): E-W straight
        asm.alpha_composite(ns, (0, 16))  # (0,1): N-S straight connecting cleanly to S-to-E turn!
        asm_2x = asm.resize((128, 64), Image.Resampling.NEAREST)
        c6x = start_x + 5 * (card_w + gap)
        draw.text((c6x + 6, top_y + 322), "Live 2x L-join (SE+EW+NS):", fill=text_lo, font=font)
        sheet.alpha_composite(asm_2x, (c6x + (card_w - 128) // 2, top_y + 342))

        # And in Card 1 bottom: Minecart sitting right on 2 E-W rail tiles (2x)!
        cart_track = Image.new("RGBA", (48, 36), TRANSPARENT)
        cart_track.alpha_composite(ew, (0, 20))
        cart_track.alpha_composite(ew, (16, 20))
        cart_track.alpha_composite(ew, (32, 20))
        cart_track.alpha_composite(cart_im, (8, 3))
        ct_2x = cart_track.resize((96, 72), Image.Resampling.NEAREST)
        c1x = start_x
        draw.text((c1x + 6, top_y + 322), "Cart on rails (2x):", fill=text_lo, font=font)
        sheet.alpha_composite(ct_2x, (c1x + (card_w - 96) // 2, top_y + 340))

    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PNG)


def main() -> None:
    OBJ_DIR.mkdir(parents=True, exist_ok=True)
    valid_hexes = load_valid_palette_hexes()

    # Verify every token in P belongs to `tiledata/jp-city/fable-city/palette.json`
    for tok, hx in P.items():
        assert hx.lower() in valid_hexes, f"Token {tok}={hx} is NOT in fable-city/palette.json!"

    specs = [
        ("minecart.png", "vehicle", (32, 32), build_minecart()),
        ("obsidian-altar.png", "standing", (32, 32), build_obsidian_altar()),
        ("ore-crystal-vein.png", "standing", (32, 32), build_ore_crystal_vein()),
        ("lava-brazier.png", "standing", (16, 32), build_lava_brazier()),
        ("pickaxe-rack.png", "standing", (32, 32), build_pickaxe_rack()),
        ("rails-kit.png", "topdown", (48, 16), build_rails_kit()),
    ]

    print("=== T3 DUNGEON THEME OBJECTS BATCH 4/4: mine_volcano VERIFICATION ===")
    rendered = []
    for fname, camera, expected_sz, im in specs:
        out_path = OBJ_DIR / fname
        im.save(out_path)
        stats = verify_sprite(fname, im, expected_sz, camera, valid_hexes)
        rendered.append((fname, camera, im, stats))
        print(
            f"PASS  {fname:22s} | canvas={stats['canvas']:5s} | opaque={stats['opaque']:5s} "
            f"| camera={camera:8s} | colors={stats['colors']:2d} | shadow={stats['shadow_px']:3d}px"
        )

    build_preview_sheet(rendered)
    print(f"\nSaved preview sheet -> {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
