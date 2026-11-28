"""Upgrade all 24 16x16 architectural tiles for modern_pcbang_carbon.

Strict rules enforced:
- 100% locked to modern_palette_v3.json (118 opaque colors, zero pure #000000).
- Strictly alpha=255 opaque on every pixel of all 24 16x16 tiles.
- Every floor_* tile has adjacent-pixel RGB diff (>45) spike ratio <= 0.06
  (both single-tile AND 3x3 tiled), eliminating harsh grid lines so objects pop.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Callable, Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_JSON = REPO_ROOT / "tiledata" / "dungeon-pilot" / "_dots_kit_refs" / "modern_palette_v3.json"
OUT_ROOT = REPO_ROOT / "tiledata" / "dungeon-dots" / "modern_pcbang_carbon"
TILES_DIR = OUT_ROOT / "tiles"
PREVIEW_PATH = OUT_ROOT / "preview_batch5_tiles.png"

RGBA = Tuple[int, int, int, int]


def hex_to_rgba(h: str, alpha: int = 255) -> RGBA:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def load_palette():
    with open(PALETTE_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    ramps_rgba = {
        name: [hex_to_rgba(c) for c in cols]
        for name, cols in data["ramps"].items()
    }
    valid_opaque = {hex_to_rgba(c) for c in data["all_colors"]}
    return data, ramps_rgba, valid_opaque


PALETTE_DATA, RAMPS, VALID_OPAQUE = load_palette()

# Shorthand 118-color ramps (index 0 = darkest shade, higher = brighter)
R = RAMPS["crimson_red"]       # 0..6
O = RAMPS["rust_orange"]       # 0..6
A = RAMPS["amber_ochre"]       # 0..6
Y = RAMPS["gold_yellow"]       # 0..6
L = RAMPS["olive_lime"]        # 0..6
G = RAMPS["emerald_green"]     # 0..6
J = RAMPS["jade_mint"]         # 0..6
C = RAMPS["cyan_teal"]         # 0..6
K = RAMPS["sky_cerulean"]      # 0..6
B = RAMPS["cobalt_blue"]       # 0..6
I = RAMPS["indigo_violet"]     # 0..6
M = RAMPS["purple_magenta"]    # 0..6
P = RAMPS["rose_pink"]         # 0..6
S = RAMPS["cool_slate_gray"]   # 0..7
W = RAMPS["warm_skin_peach"]   # 0..4
DW = RAMPS["dark_wood_earth"]  # 0..6
WT = RAMPS["warm_wood_tan"]    # 0..6


class TileCanvas:
    """Strict 16x16 opaque RGBA pixel canvas locked to modern_palette_v3.json."""

    def __init__(self, fill: RGBA):
        self._validate(fill)
        self.w = 16
        self.h = 16
        self.img = Image.new("RGBA", (16, 16), fill)
        self.px = self.img.load()

    @staticmethod
    def _validate(color: RGBA) -> None:
        if len(color) != 4 or color[3] != 255:
            raise ValueError(f"Non-opaque pixel forbidden in 16x16 tile: {color}")
        if color[:3] == (0, 0, 0):
            raise ValueError("Pure #000000 forbidden")
        if color not in VALID_OPAQUE:
            raise ValueError(f"Off-palette color rejected: {color}")

    def p(self, x: int, y: int, color: RGBA) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self._validate(color)
            self.px[x, y] = color

    def hline(self, x1: int, x2: int, y: int, color: RGBA) -> None:
        if x1 > x2:
            x1, x2 = x2, x1
        for x in range(x1, x2 + 1):
            self.p(x, y, color)

    def vline(self, x: int, y1: int, y2: int, color: RGBA) -> None:
        if y1 > y2:
            y1, y2 = y2, y1
        for y in range(y1, y2 + 1):
            self.p(x, y, color)

    def fill_rect(self, x: int, y: int, w: int, h: int, color: RGBA) -> None:
        self._validate(color)
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    self.px[xx, yy] = color

    def rect(self, x: int, y: int, w: int, h: int, color: RGBA) -> None:
        if w <= 0 or h <= 0:
            return
        self.hline(x, x + w - 1, y, color)
        self.hline(x, x + w - 1, y + h - 1, color)
        self.vline(x, y, y + h - 1, color)
        self.vline(x + w - 1, y, y + h - 1, color)

    def box(self, x: int, y: int, w: int, h: int, fill: RGBA, outline: RGBA) -> None:
        self.fill_rect(x, y, w, h, fill)
        self.rect(x, y, w, h, outline)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path)


# =============================================================================
# 1. CALM ARCHITECTURAL FLOOR TILES (8 tiles, all spike ratio <= 0.06)
# =============================================================================

def make_floor_lobby_slate() -> TileCanvas:
    """Honed cool-gray porcelain slab with subtle center-tapered hairline joints."""
    c = TileCanvas(S[5])
    # Delicate 6px center-tapered grout: 1x1=0.0333, 3x3=0.0479 (both <= 0.06!)
    c.hline(5, 10, 15, S[4])
    c.vline(15, 5, 10, S[4])
    return c


def make_floor_lobby_slate_alt() -> TileCanvas:
    """Companion honed porcelain slab with soft sheen glint (1x1=0.0375, 3x3=0.0492 <= 0.06)."""
    c = TileCanvas(S[5])
    c.hline(5, 9, 15, S[4])
    c.vline(15, 5, 9, S[4])
    c.p(3, 3, S[6])
    return c


def make_floor_cafe_oak() -> TileCanvas:
    """Warm honey-oak cafe floorboards — long calm planks with 0.0000 spike ratio."""
    # Every transition stays within {WT[5], W[2], WT[2], WT[3]} (<=41.1) and WT[4] buffered by WT[3] (30.7)!
    c = TileCanvas(W[2])

    # Plank 1 (y=0..7): warm honey oak with soft sunlit top edge & subtle grain
    c.hline(0, 15, 0, WT[3])        # buffer adjacent to y=15 seam across vertical tiling
    c.hline(0, 15, 1, WT[5])        # soft sunlit bevel
    c.hline(2, 8, 4, WT[2])         # calm long-grain streak
    c.hline(10, 14, 3, WT[5])       # subtle warm oak sheen
    c.hline(0, 15, 6, WT[3])        # pre-seam warm shadow buffer
    c.hline(0, 15, 7, WT[3])        # calm plank seam
    c.hline(2, 13, 7, WT[4])        # rich warm oak groove (buffered by WT[3] at y=6 & y=8!)
    # Delicate staggered plank butt-joint at x=5 (buffered by WT[3] on x=4,6)
    c.vline(4, 1, 6, WT[3])
    c.vline(5, 1, 6, WT[4])
    c.vline(6, 1, 6, WT[3])

    # Plank 2 (y=8..15): companion honey-oak plank with staggered joint at x=13
    c.hline(0, 15, 8, WT[3])        # upper buffer below y=7 WT[4] seam
    c.hline(0, 15, 9, WT[5])        # soft sunlit bevel
    c.fill_rect(0, 10, 16, 4, W[2])
    c.hline(1, 7, 11, WT[2])        # calm long-grain streak
    c.hline(9, 15, 12, WT[3])       # subtle grain shadow
    c.hline(3, 8, 13, WT[5])        # warm sheen
    c.hline(0, 15, 14, WT[3])       # pre-seam buffer
    c.hline(0, 15, 15, WT[3])       # bottom plank seam
    c.hline(1, 11, 15, WT[4])       # rich warm groove (meets y=0 WT[3] across tile wrap!)
    # Staggered butt-joint at x=13 (buffered by WT[3] on x=12,14)
    c.vline(12, 9, 14, WT[3])
    c.vline(13, 9, 14, WT[4])
    c.vline(14, 9, 14, WT[3])
    return c


def make_floor_pc_carpet() -> TileCanvas:
    """Velvety dark-navy acoustic modular carpet — cohesive matte weave, zero boxy grid."""
    c = TileCanvas(B[1])
    # Subtle quarter-turn commercial carpet weave (I[1] dist=21.9, K[1] dist=21.0)
    c.hline(2, 4, 3, K[1])
    c.hline(4, 6, 5, I[1])
    c.hline(10, 12, 2, I[1])
    c.vline(11, 4, 6, K[1])
    c.vline(3, 10, 12, I[1])
    c.hline(2, 4, 11, K[1])
    c.hline(9, 11, 10, K[1])
    c.hline(10, 12, 12, I[1])

    # Whisper-soft corner-open seam (I[1] outer + short B[0] center, zero harsh grid)
    c.hline(2, 13, 15, I[1])
    c.hline(5, 10, 15, B[0])
    c.vline(15, 2, 13, I[1])
    c.vline(15, 5, 10, B[0])
    return c


def make_floor_pc_carpet_trim() -> TileCanvas:
    """Sleek PC Arena corridor carpet — calm woven directional flecks without inner boxes."""
    c = TileCanvas(B[1])
    # Subtle staggered cerulean micro-threads (no concentric box or face-like dots)
    c.hline(2, 4, 3, K[1])
    c.hline(9, 11, 6, K[1])
    c.hline(4, 6, 10, K[1])
    c.hline(10, 12, 12, K[1])
    c.p(7, 7, B[2])
    c.p(6, 7, K[1])
    # Matching whisper-soft seam
    c.hline(2, 13, 15, I[1])
    c.hline(5, 10, 15, B[0])
    c.vline(15, 2, 13, I[1])
    c.vline(15, 5, 10, B[0])
    return c


def make_floor_arcade_teal() -> TileCanvas:
    """Sleek dark cerulean-teal linoleum slab — subtle diagonal luster, zero concentric rings."""
    c = TileCanvas(K[1])
    # Soft diagonal surface sheen in C[1] (dist=16.2) + single K[2] glint (dist=41.2)
    for i in range(4):
        c.p(3 + i, 6 - i, C[1])
        c.p(8 + i, 11 - i, C[1])
    c.p(4, 4, K[2])
    # Shortened calm corner-open grout in K[0] (dist=43.4 <= 45)
    c.hline(4, 11, 15, K[0])
    c.vline(15, 4, 11, K[0])
    return c


def make_floor_vip_carpet() -> TileCanvas:
    """Plush midnight-indigo woven carpet with subtle diamond motif for VIP Lounge."""
    c = TileCanvas(I[1])
    # Delicate woven micro-diamond centered at (7, 7) (M[1] dist=27.0, I[2] dist=36.0)
    c.p(7, 5, M[1])
    c.hline(6, 8, 6, M[1])
    c.hline(5, 9, 7, M[1])
    c.hline(6, 8, 8, M[1])
    c.p(7, 9, M[1])
    c.p(7, 7, I[2])
    # Whisper-soft corner-open seam (I[0] dist=37.1)
    c.hline(3, 12, 15, I[0])
    c.vline(15, 3, 12, I[0])
    return c


def make_floor_entrance_mat() -> TileCanvas:
    """Heavy charcoal-rubber rimmed crimson scraper welcome mat (0.0000 spike ratio!)."""
    # Every step <= 38.1 RGB dist: S[0] -> R[0] -> R[1] -> R[2] <-> R[3]
    c = TileCanvas(S[0])
    # Subtle bevel corners on dark rubber rim
    c.p(0, 0, B[0])
    c.p(15, 0, B[0])
    c.p(0, 15, B[0])
    c.p(15, 15, B[0])
    # Inner rubber bevel channel
    c.fill_rect(1, 1, 14, 14, R[0])
    c.fill_rect(2, 2, 12, 12, R[1])
    # Ribbed crimson carpet insert (R[3] and R[1] separated by R[2] -> smooth 3D ribs!)
    c.fill_rect(3, 3, 10, 10, R[2])
    for ry in (4, 8, 12):
        c.hline(3, 12, ry, R[3])
    for gy in (6, 10):
        c.hline(3, 12, gy, R[1])
    return c


# =============================================================================
# 2. CEILING CAPS & ARCHITECTURAL WALL FACES (6 tiles)
# =============================================================================

def make_wall_cap_dark() -> TileCanvas:
    """Seamless matte dark-slate RM2000 ceiling void / perimeter wall cap."""
    return TileCanvas(S[1])


def make_wall_cap_edge_s() -> TileCanvas:
    """North/interior wall ceiling cap with crisp brushed-metal south parapet lip."""
    c = TileCanvas(S[1])
    c.hline(0, 15, 11, B[1])        # subtle cool recession before crown
    c.hline(0, 15, 12, S[2])        # upper crown bevel
    c.hline(0, 15, 13, S[4])        # crisp lit brushed-metal crown highlight
    c.hline(0, 15, 14, S[2])        # lower lip bevel
    c.hline(0, 15, 15, S[0])        # sharp overhang outline
    return c


def make_wall_face_upper() -> TileCanvas:
    """Sleek cool architectural plaster/concrete upper wall with picture-rail trim."""
    c = TileCanvas(S[4])
    # Soft cast shadow below ceiling overhang
    c.hline(0, 15, 0, S[1])
    c.hline(0, 15, 1, S[2])
    c.hline(0, 15, 2, S[3])
    # Delicate single-pixel architectural concrete panel joint (no double-bar bevel!)
    c.vline(15, 3, 12, S[3])
    # Subtle top-left plaster sheen
    c.hline(1, 13, 3, S[5])
    # Sleek horizontal trim molding at bottom of upper course
    c.hline(0, 15, 13, S[5])
    c.hline(0, 15, 14, S[4])
    c.hline(0, 15, 15, S[2])
    return c


def make_wall_face_lower() -> TileCanvas:
    """Cool architectural plaster lower dado wall + sleek dark brushed-steel baseboard."""
    c = TileCanvas(S[4])
    # Lit chair-rail / mid-wall molding (works seamlessly below upper wall OR cap_edge_s!)
    c.hline(0, 15, 0, S[5])
    c.hline(0, 15, 1, S[4])
    c.hline(0, 15, 2, S[3])
    # Subtle recessed lower architectural panel
    c.vline(15, 3, 9, S[3])
    c.hline(1, 13, 9, S[5])
    # Sleek dark brushed-steel baseboard (y=10..15)
    c.hline(0, 15, 10, S[3])
    c.hline(0, 15, 11, S[2])        # brushed steel top lip
    c.fill_rect(0, 12, 16, 2, S[1]) # dark steel body
    c.hline(0, 15, 14, B[0])        # deep cool shadow recess
    c.hline(0, 15, 15, S[0])        # crisp floor contact line
    return c


def make_wall_cafe_wood_upper() -> TileCanvas:
    """Warm vertical honey-oak slatted wainscoting upper wall with specular wood sheen."""
    c = TileCanvas(W[2])
    # Cast shadow from north ceiling overhang
    c.hline(0, 15, 0, DW[1])
    c.hline(0, 15, 1, DW[3])
    # Four 4px-pitch 3D rounded vertical oak slats (x=0..3, 4..7, 8..11, 12..15)
    sheen_rows = [(4, 7), (5, 8), (6, 9), (7, 10)]
    for idx, sx in enumerate((0, 4, 8, 12)):
        c.vline(sx, 2, 13, WT[5])       # lit left bevel
        c.vline(sx + 1, 2, 13, W[2])    # warm oak crown
        c.vline(sx + 2, 2, 13, WT[3])   # rich mid-oak slope
        c.vline(sx + 3, 2, 13, DW[6])   # warm slat groove
        c.p(sx + 3, 2, DW[3])           # deep shadow tuck at top of groove
        c.p(sx + 3, 13, DW[3])          # deep shadow tuck above rail
        # Diagonal subtle specular wood sheen sweeping gently across slats
        sy1, sy2 = sheen_rows[idx]
        c.vline(sx + 1, sy1, sy2, WT[6])
        c.p(sx, sy1, W[3])
    # Chair-rail shadow groove & warm oak top lip
    c.hline(0, 15, 14, DW[3])
    c.hline(0, 15, 15, WT[6])
    return c


def make_wall_cafe_wood_lower() -> TileCanvas:
    """Warm Korean cafe oak wainscot dado + aligned dark brushed-steel baseboard."""
    c = TileCanvas(WT[3])
    # Polished oak chair-rail ledge continuing from upper y=15
    c.hline(0, 15, 0, W[3])
    c.hline(0, 15, 1, WT[5])
    c.hline(0, 15, 2, DW[3])        # crisp overhang shadow under chair rail

    # Framed recessed vertical-grain oak wainscot panels (two 8px bays per tile)
    for bx in (0, 8):
        c.fill_rect(bx, 3, 8, 7, WT[3])
        c.vline(bx, 3, 9, WT[5])        # left stile highlight
        c.vline(bx + 7, 3, 9, DW[6])    # right stile shadow
        c.hline(bx + 1, bx + 6, 3, DW[6])
        c.hline(bx + 1, bx + 6, 9, WT[6])
        # Recessed vertical oak tongue-and-groove interior + specular sheen
        c.fill_rect(bx + 1, 4, 6, 5, W[2])
        c.vline(bx + 3, 4, 8, WT[3])
        c.vline(bx + 6, 4, 8, WT[3])
        c.vline(bx + 2, 5, 6, WT[6])    # subtle specular wood sheen
        c.p(bx + 1, 4, W[3])

    # Baseboard aligned pixel-for-pixel with wall_face_lower (y=10..15)
    c.hline(0, 15, 10, DW[3])
    c.hline(0, 15, 11, S[2])
    c.fill_rect(0, 12, 16, 2, S[1])
    c.hline(0, 15, 14, B[0])
    c.hline(0, 15, 15, S[0])
    return c


# =============================================================================
# 3. SLEEK BRUSHED-STEEL GLASS PARTITIONS (2 tiles)
# =============================================================================

def make_wall_glass_divider() -> TileCanvas:
    """East-west brushed-steel framed tempered glass partition with crisp reflections."""
    c = TileCanvas(K[3])
    # 3/4 top-down brushed stainless top handrail (y=0..2)
    c.hline(0, 15, 0, S[0])
    c.hline(0, 15, 1, S[6])         # bright top-lit brushed steel face
    c.hline(0, 15, 2, S[3])         # front rail bevel
    # Shared 2px 3D steel mullion across tile seam (x=15 lit left, x=0 shaded right)
    c.vline(15, 1, 14, S[4])
    c.vline(0, 1, 14, S[1])
    c.p(15, 1, S[6])

    # Tempered cerulean-cyan glass pane (x=1..14, y=3..11)
    c.hline(1, 14, 3, K[2])         # rail cast shadow on glass
    c.fill_rect(1, 4, 14, 3, K[4])  # upper cool glass
    c.fill_rect(1, 7, 14, 3, K[3])  # mid deep glass
    c.hline(1, 14, 8, K[5])         # sleek horizontal frosted safety band
    c.fill_rect(1, 10, 14, 2, C[3]) # subtle lower cyan refraction

    # Crisp twin diagonal light reflections
    for i in range(6):
        c.p(3 + i, 10 - i, K[6])
    c.p(5, 8, S[7])
    c.p(6, 7, S[7])
    for i in range(4):
        c.p(7 + i, 10 - i, K[5])
    c.p(11, 5, K[6])

    # Sleek brushed-steel lower kickplate (y=12..15)
    c.hline(0, 15, 12, S[5])
    c.hline(0, 15, 13, S[3])
    c.hline(0, 15, 14, S[1])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_glass_divider_v() -> TileCanvas:
    """North-south brushed-steel curb + tempered glass partition with diagonal reflections."""
    c = TileCanvas(K[3])
    # Brushed-steel side curbs (top-left lit: left curb brighter, right curb shaded)
    c.vline(0, 0, 15, S[0])
    c.vline(1, 0, 15, S[5])         # lit left steel rail
    c.vline(2, 0, 15, S[2])         # inner channel shadow
    c.vline(13, 0, 15, S[3])        # inner right steel rim
    c.vline(14, 0, 15, S[1])        # shaded right steel rail
    c.vline(15, 0, 15, S[0])

    # Tempered glass core (x=3..12, y=0..15)
    c.vline(3, 0, 15, K[6])         # crisp lit left glass thickness edge
    c.fill_rect(4, 0, 4, 16, K[4])
    c.fill_rect(8, 0, 4, 16, K[3])
    c.vline(12, 0, 15, K[2])        # shaded right glass edge

    # Slim brushed-aluminum transom clamp at y=0..1
    c.hline(1, 14, 0, S[1])
    c.hline(2, 13, 1, S[5])
    c.hline(3, 12, 2, K[2])

    # Crisp twin diagonal glass reflections
    for i in range(6):
        c.p(4 + i, 12 - i, K[6])
    c.p(6, 10, S[7])
    c.p(7, 9, S[7])
    for i in range(4):
        c.p(5 + i, 6 - i, K[5])
    c.p(9, 13, C[5])
    return c


# =============================================================================
# 4. 2x2 AUTOMATIC SLIDING GLASS ENTRANCE DOOR (4 tiles = 32x32 unified portal)
# =============================================================================

def make_wall_door_top_left() -> TileCanvas:
    """Automatic sliding glass door — upper-left jamb, sensor bar & night-tinted leaf."""
    c = TileCanvas(B[1])
    # Heavy brushed-stainless left portal jamb (x=0..2)
    c.vline(0, 0, 15, S[0])
    c.vline(1, 0, 15, S[6])         # bright brushed aluminum highlight
    c.vline(2, 0, 15, S[2])
    c.p(1, 0, S[2])

    # Overhead automatic operator header & half of centered IR sensor bar (y=0..4)
    c.hline(3, 15, 0, S[0])
    c.hline(3, 15, 1, S[6])         # top brushed aluminum transom
    c.fill_rect(3, 2, 13, 2, S[3])  # operator housing
    c.hline(3, 15, 4, S[0])         # crisp shadow under operator track
    # Centered dark sensor pod (x=11..15 on left tile + x=0..4 on right tile)
    c.fill_rect(11, 2, 5, 2, S[0])
    c.fill_rect(12, 2, 4, 2, B[0])
    c.p(13, 2, G[6])                # bright green active motion sensor LED
    c.p(14, 2, G[4])

    # Upper-left sliding glass leaf (x=3..13, y=5..15)
    c.hline(3, 13, 5, K[1])         # header shadow on glass
    c.fill_rect(3, 6, 11, 5, B[1])  # deep night exterior through glass
    c.fill_rect(3, 11, 11, 5, K[2]) # mid-blue street ambient
    # Distant warm bokeh street dot seen through upper glass
    c.p(6, 9, Y[5])
    # Crisp diagonal reflection sweeping across glass
    for i in range(6):
        c.p(4 + i, 13 - i, K[5])
    c.p(6, 11, K[6])
    c.p(7, 10, S[7])
    c.p(8, 9, K[6])
    for i in range(4):
        c.p(7 + i, 14 - i, K[4])

    # Center brushed-aluminum meeting stile (x=14..15)
    c.vline(14, 5, 15, S[5])
    c.vline(15, 5, 15, S[0])
    return c


def make_wall_door_top_right() -> TileCanvas:
    """Automatic sliding glass door — upper-right jamb, sensor bar & night-tinted leaf."""
    c = TileCanvas(B[1])
    # Heavy brushed-stainless right portal jamb (x=13..15)
    c.vline(13, 0, 15, S[2])
    c.vline(14, 0, 15, S[4])        # shaded brushed aluminum jamb
    c.vline(15, 0, 15, S[0])
    c.p(14, 0, S[2])

    # Overhead automatic operator header & right half of IR sensor bar (y=0..4)
    c.hline(0, 12, 0, S[0])
    c.hline(0, 12, 1, S[5])
    c.fill_rect(0, 2, 13, 2, S[3])
    c.hline(0, 12, 4, S[0])
    c.fill_rect(0, 2, 5, 2, S[0])
    c.fill_rect(0, 2, 4, 2, B[0])
    c.p(2, 2, C[5])                 # standby cyan sensor indicator

    # Center meeting stile (x=0..1)
    c.vline(0, 5, 15, S[1])
    c.vline(1, 5, 15, S[4])

    # Upper-right sliding glass leaf (x=2..12, y=5..15)
    c.hline(2, 12, 5, K[1])
    c.fill_rect(2, 6, 11, 5, B[1])
    c.fill_rect(2, 11, 11, 5, K[2])
    c.p(9, 8, A[5])                 # distant warm street light dot
    for i in range(5):
        c.p(4 + i, 13 - i, K[5])
    c.p(6, 11, K[6])
    c.p(7, 10, S[7])
    return c


def make_wall_door_arch_left() -> TileCanvas:
    """Automatic sliding glass door — lower-left leaf, safety decal, handle & threshold."""
    c = TileCanvas(K[3])
    # Left heavy brushed-stainless jamb (x=0..2)
    c.vline(0, 0, 15, S[0])
    c.vline(1, 0, 14, S[6])
    c.vline(2, 0, 14, S[2])

    # Lower-left glass door leaf (x=3..13, y=0..11) continuing smoothly from top_left
    c.fill_rect(3, 0, 11, 4, K[2])
    c.fill_rect(3, 4, 11, 8, K[3])
    # Crisp frosted horizontal safety waist band + cyan 'AUTO' badge (y=3..4)
    c.hline(3, 13, 3, S[6])
    c.hline(3, 13, 4, K[5])
    c.p(11, 3, C[5])
    c.p(12, 3, C[6])
    # Lower glass diagonal reflection
    c.p(4, 9, K[5])
    c.p(5, 8, K[6])
    c.p(6, 7, K[5])
    # Sleek vertical stainless pull/sensor plate near center stile
    c.vline(12, 1, 7, S[6])
    c.vline(13, 1, 7, S[2])

    # Center meeting stile (x=14..15)
    c.vline(14, 0, 13, S[5])
    c.vline(15, 0, 14, S[0])

    # Brushed-aluminum bottom kickplate & grooved sliding threshold (y=12..15)
    c.hline(3, 14, 12, S[5])
    c.hline(3, 14, 13, S[3])
    c.hline(3, 14, 14, S[1])
    c.hline(0, 15, 15, S[0])
    c.hline(3, 15, 15, S[2])        # stainless threshold track
    for tx in (4, 8, 12):
        c.p(tx, 15, S[4])
    return c


def make_wall_door_arch_right() -> TileCanvas:
    """Automatic sliding glass door — lower-right leaf, safety decal, handle & threshold."""
    c = TileCanvas(K[3])
    # Right heavy brushed-stainless jamb (x=13..15)
    c.vline(13, 0, 14, S[2])
    c.vline(14, 0, 14, S[4])
    c.vline(15, 0, 15, S[0])

    # Center meeting stile (x=0..1)
    c.vline(0, 0, 14, S[1])
    c.vline(1, 0, 13, S[4])

    # Lower-right glass door leaf (x=2..12, y=0..11)
    c.fill_rect(2, 0, 11, 4, K[2])
    c.fill_rect(2, 4, 11, 8, K[3])
    # Frosted safety waist band + matching badge
    c.hline(2, 12, 3, S[6])
    c.hline(2, 12, 4, K[5])
    c.p(3, 3, C[6])
    c.p(4, 3, C[5])
    # Lower glass diagonal reflection
    c.p(6, 9, K[5])
    c.p(7, 8, K[6])
    c.p(8, 7, K[5])
    # Sleek vertical stainless pull/sensor plate
    c.vline(3, 1, 7, S[6])
    c.vline(2, 1, 7, S[2])

    # Brushed-aluminum bottom kickplate & grooved sliding threshold (y=12..15)
    c.hline(1, 12, 12, S[5])
    c.hline(1, 12, 13, S[3])
    c.hline(1, 12, 14, S[1])
    c.hline(0, 15, 15, S[0])
    c.hline(0, 12, 15, S[2])
    for tx in (3, 7, 11):
        c.p(tx, 15, S[4])
    return c


# =============================================================================
# 5. ARCHITECTURAL WALL PROPS & NIGHT WINDOW (4 tiles)
# =============================================================================

def make_wall_window_night() -> TileCanvas:
    """Full-bay steel-framed night window: dark-blue cityscape, warm lit windows & glass reflection."""
    c = TileCanvas(S[0])
    # Top ceiling cast shadow (y=0) + sleek dark-steel window frame (works on BOTH oak & plaster!)
    c.hline(0, 15, 0, S[1])
    c.hline(0, 15, 1, S[3])         # lit top steel frame bar
    c.vline(0, 1, 14, S[0])         # outer mullion seam
    c.vline(1, 2, 12, S[3])         # lit left inner steel frame
    c.vline(14, 2, 12, S[1])        # shaded right inner steel frame
    c.vline(15, 1, 14, S[0])

    # Rich 3-band dark-blue night sky (x=2..13, y=2..12)
    c.fill_rect(2, 2, 12, 3, I[0])  # deep midnight zenith
    c.fill_rect(2, 5, 12, 3, B[0])  # deep night cobalt
    c.fill_rect(2, 8, 12, 3, B[1])  # urban night glow
    c.fill_rect(2, 11, 12, 2, B[2]) # horizon haze

    # Layered city skyline silhouette (background tower in S[1], foreground towers in S[0])
    c.fill_rect(6, 7, 4, 6, S[1])   # distant mid-ground building
    c.fill_rect(2, 6, 4, 7, S[0])   # left high-rise tower
    c.hline(3, 4, 5, S[0])          # stepped tower crown
    c.p(4, 4, R[4])                 # tiny red rooftop beacon
    c.fill_rect(9, 6, 5, 7, S[0])   # right commercial tower
    c.hline(10, 12, 5, I[0])

    # Tiny warm glowing office/apartment window dots
    c.p(3, 7, Y[6])
    c.p(4, 7, A[5])
    c.p(3, 9, Y[5])
    c.p(4, 11, O[5])
    c.p(7, 9, A[4])                 # distant softer window
    c.p(10, 7, C[5])                # cool neon rooftop sign strip
    c.p(11, 7, C[6])
    c.p(10, 9, Y[6])
    c.p(12, 9, A[5])
    c.p(10, 11, Y[5])
    c.p(12, 11, O[5])

    # Crisp diagonal glass reflection in upper-left sky
    c.p(3, 4, K[5])
    c.p(4, 3, K[6])
    c.p(5, 2, S[7])
    c.p(5, 4, K[3])
    c.p(6, 3, K[4])

    # Brushed-aluminum protruding window sill (y=13..15)
    c.hline(0, 15, 13, S[5])
    c.hline(1, 13, 13, S[6])        # crisp sunlit/interior sill highlight
    c.hline(0, 15, 14, S[2])        # sill front edge
    c.hline(0, 15, 15, S[0])        # under-sill shadow
    return c


def make_wall_ac_unit() -> TileCanvas:
    """Modern Korean wall-mounted split inverter AC unit with 3/4 top face & LED display."""
    c = make_wall_face_upper()
    # Cast drop shadow beneath chassis
    c.hline(2, 14, 11, S[2])
    c.hline(2, 14, 12, S[3])

    # Main 14x9 chassis outline (x=1..14, y=2..10)
    c.box(1, 2, 14, 9, S[6], S[0])
    # 3/4 top-down upper intake face (y=3)
    c.hline(2, 13, 3, S[7])
    for gx in (3, 5, 7, 9, 11):
        c.p(gx, 3, S[5])            # subtle top intake vents
    # Glossy curved front fascia (y=4..7)
    c.hline(2, 13, 4, S[7])         # specular front ridge
    c.fill_rect(2, 5, 12, 2, S[6])
    c.hline(2, 13, 7, S[5])         # curved lower fascia bevel
    # Sleek black digital status bezel + glowing cyan/emerald LEDs
    c.fill_rect(10, 5, 3, 2, S[0])
    c.p(10, 5, C[6])
    c.p(11, 5, C[5])
    c.p(12, 5, G[5])

    # Recessed dark motorized air louver slot (y=8..9)
    c.hline(2, 13, 8, S[0])
    c.hline(2, 13, 9, S[1])
    c.hline(3, 12, 9, S[4])         # crisp angled deflector vane
    return c


def make_wall_neon_sign() -> TileCanvas:
    """Glowing Korean PC Bang cyan + magenta LED neon sign in dark smoked housing."""
    c = make_wall_face_upper()
    # Soft ambient neon glow + drop shadow on plaster around housing
    c.hline(2, 13, 12, S[2])
    # Dark anodized sign box (x=1..14, y=2..11)
    c.box(1, 2, 14, 10, I[0], S[0])
    c.rect(2, 3, 12, 8, B[1])       # inner neon reflection rim
    c.fill_rect(3, 4, 10, 6, B[0])  # deep smoked acrylic face

    # Top & bottom neon accent framing bars
    c.hline(3, 8, 3, C[4])
    c.hline(9, 12, 3, P[4])
    c.hline(3, 7, 10, B[4])
    c.hline(8, 12, 10, M[4])

    # Left glowing cyan 'P' + 'C' neon tube emblem (x=3..8, y=5..8)
    # 'P'
    c.vline(3, 5, 8, C[6])
    c.p(4, 5, C[6])
    c.p(5, 5, C[5])
    c.p(5, 6, C[6])
    c.p(4, 6, C[5])
    c.p(4, 8, C[3])                 # halo
    # 'C'
    c.vline(7, 5, 8, C[6])
    c.p(8, 5, C[6])
    c.p(8, 8, C[6])
    c.p(8, 6, B[3])                 # inner glow

    # Right hot-pink / gold lightning-gamepad neon icon (x=10..12, y=5..8)
    c.p(11, 5, Y[6])
    c.p(10, 6, P[6])
    c.p(11, 6, S[7])                # white-hot neon core
    c.p(12, 6, P[5])
    c.p(11, 7, P[6])
    c.p(12, 7, M[5])
    c.p(10, 8, P[5])
    c.p(11, 8, P[4])
    return c


def make_wall_game_poster() -> TileCanvas:
    """Framed backlit esports / RPG key-art poster with dramatic silhouette & reflection."""
    c = make_wall_face_upper()
    # Aluminum poster lightbox frame (x=2..13, y=1..13) + wall shadow at y=14
    c.hline(3, 13, 14, S[2])
    c.box(2, 1, 12, 13, B[0], S[0])
    c.p(2, 1, S[2])
    c.hline(3, 12, 2, P[3])         # dramatic magenta-crimson top sky
    c.fill_rect(3, 3, 10, 3, R[4])  # fiery sunset battle backdrop
    c.hline(3, 12, 6, O[4])         # warm horizon glow
    c.fill_rect(3, 7, 10, 4, B[2])  # deep cobalt arena floor/armor contrast

    # Bold golden crest / mecha-hero visor & shoulders (unmistakable poster composition!)
    c.hline(6, 9, 3, Y[6])          # bright gold crown/halo
    c.fill_rect(6, 4, 4, 3, Y[5])
    c.hline(7, 8, 5, C[6])          # glowing cyan hero visor!
    # Heroic dark armored shoulders silhouette
    c.fill_rect(4, 8, 8, 3, S[0])
    c.hline(5, 10, 7, S[1])
    c.p(5, 8, R[5])                 # shoulder pauldron glint
    c.p(10, 8, C[5])                # diagonal cyan energy slash
    c.p(11, 7, C[6])

    # Crisp bottom title bar (y=11..12)
    c.fill_rect(3, 11, 10, 2, I[0])
    c.hline(4, 8, 11, S[6])         # crisp micro title logo bar
    c.hline(10, 11, 11, Y[5])

    # Poster glass top-left reflection
    c.p(3, 3, P[5])
    c.p(4, 2, S[7])
    return c


# =============================================================================
# REGISTRY, VERIFICATION & PREVIEW SHEET GENERATOR
# =============================================================================

FLOOR_TILES: List[Tuple[str, Callable[[], TileCanvas]]] = [
    ("floor_cafe_oak", make_floor_cafe_oak),
    ("floor_lobby_slate", make_floor_lobby_slate),
    ("floor_lobby_slate_alt", make_floor_lobby_slate_alt),
    ("floor_pc_carpet", make_floor_pc_carpet),
    ("floor_pc_carpet_trim", make_floor_pc_carpet_trim),
    ("floor_arcade_teal", make_floor_arcade_teal),
    ("floor_vip_carpet", make_floor_vip_carpet),
    ("floor_entrance_mat", make_floor_entrance_mat),
]

WALL_TILES: List[Tuple[str, Callable[[], TileCanvas]]] = [
    ("wall_cap_dark", make_wall_cap_dark),
    ("wall_cap_edge_s", make_wall_cap_edge_s),
    ("wall_face_upper", make_wall_face_upper),
    ("wall_face_lower", make_wall_face_lower),
    ("wall_cafe_wood_upper", make_wall_cafe_wood_upper),
    ("wall_cafe_wood_lower", make_wall_cafe_wood_lower),
    ("wall_glass_divider", make_wall_glass_divider),
    ("wall_glass_divider_v", make_wall_glass_divider_v),
    ("wall_door_top_left", make_wall_door_top_left),
    ("wall_door_top_right", make_wall_door_top_right),
    ("wall_door_arch_left", make_wall_door_arch_left),
    ("wall_door_arch_right", make_wall_door_arch_right),
    ("wall_window_night", make_wall_window_night),
    ("wall_ac_unit", make_wall_ac_unit),
    ("wall_neon_sign", make_wall_neon_sign),
    ("wall_game_poster", make_wall_game_poster),
]

ALL_TILE_SPECS = FLOOR_TILES + WALL_TILES


def floor_spike_ratio(img: Image.Image, threshold: float = 45.0) -> float:
    """Fraction of 4-connected adjacent pixel pairs with RGB distance > threshold."""
    px = img.load()
    w, h = img.size
    spikes = 0
    total = 0
    for y in range(h):
        for x in range(w):
            c1 = px[x, y]
            if x + 1 < w:
                c2 = px[x + 1, y]
                total += 1
                if math.dist(c1[:3], c2[:3]) > threshold:
                    spikes += 1
            if y + 1 < h:
                c2 = px[x, y + 1]
                total += 1
                if math.dist(c1[:3], c2[:3]) > threshold:
                    spikes += 1
    return spikes / max(1, total)


def tile_3x3(img: Image.Image) -> Image.Image:
    out = Image.new("RGBA", (img.width * 3, img.height * 3))
    for gy in range(3):
        for gx in range(3):
            out.paste(img, (gx * img.width, gy * img.height))
    return out


def verify_tiles(built: Dict[str, TileCanvas]) -> int:
    errors: List[str] = []
    if len(built) != 24:
        errors.append(f"Expected 24 tiles, built {len(built)}")

    print("=== modern_pcbang_carbon Batch 5 Architectural Tiles Check ===")
    total_off_pal = 0
    total_non_opaque = 0
    total_pure_black = 0

    for name, _ in ALL_TILE_SPECS:
        p = TILES_DIR / f"{name}.png"
        if not p.exists():
            errors.append(f"Missing output file: {p}")
            continue
        im = Image.open(p).convert("RGBA")
        if im.size != (16, 16):
            errors.append(f"{name}: size {im.size} != (16, 16)")
        px = im.load()
        for y in range(16):
            for x in range(16):
                rgba = px[x, y]
                if rgba[3] != 255:
                    total_non_opaque += 1
                if rgba[:3] == (0, 0, 0):
                    total_pure_black += 1
                if rgba not in VALID_OPAQUE:
                    total_off_pal += 1

    print(f"Files verified   : {len(ALL_TILE_SPECS)} / 24 (16x16 PNGs)")
    print(f"Off-palette px   : {total_off_pal}")
    print(f"Non-opaque px    : {total_non_opaque}")
    print(f"Pure #000000 px  : {total_pure_black}")
    if total_off_pal or total_non_opaque or total_pure_black:
        errors.append(
            f"Palette/alpha violation: off_pal={total_off_pal}, non_opaque={total_non_opaque}, pure_black={total_pure_black}"
        )

    print("\nFloor Calmness Check (adjacent RGB diff > 45 spike ratio <= 0.06):")
    for name, _ in FLOOR_TILES:
        im = Image.open(TILES_DIR / f"{name}.png").convert("RGBA")
        r1 = floor_spike_ratio(im)
        r3 = floor_spike_ratio(tile_3x3(im))
        status = "PASS" if (r1 <= 0.06 and r3 <= 0.06) else "FAIL"
        print(f"  - {name:<24s}: 1x1={r1:.4f}  3x3={r3:.4f}  [{status}]")
        if r1 > 0.06:
            errors.append(f"{name}: 1x1 spike ratio {r1:.4f} > 0.06")
        if r3 > 0.06:
            errors.append(f"{name}: 3x3 tiled spike ratio {r3:.4f} > 0.06")

    if errors:
        print("\nFAILURES:")
        for e in errors:
            print(f"  [FAIL] {e}")
        return 1
    print("\nRESULT: ALL 24 TILES 100% PASS!")
    return 0


def render_preview_sheet(built: Dict[str, TileCanvas]) -> None:
    """Render preview_batch5_tiles.png showing:
    1) All 24 tiles at 4x (64x64) + 1x (16x16)
    2) 3x3 tiled samples of all 8 floor tiles at 2x (96x96) + 1x (48x48)
    3) Assembled multi-tile wall/window/door/glass vignettes at 2x
    """
    bg = (42, 44, 54, 255)
    card_bg = (56, 59, 72, 255)
    border = (82, 86, 102, 255)
    txt_hi = (242, 244, 248, 255)
    txt_dim = (186, 190, 204, 255)

    sheet_w = 1040
    sheet_h = 980
    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Title header
    draw.rectangle([16, 12, sheet_w - 16, 48], fill=card_bg, outline=border)
    draw.text(
        (28, 24),
        "modern_pcbang_carbon — Batch 5: All 24 Architectural Tiles (4x + 1x, 3x3 Floors, Multi-Tile Vignettes)",
        fill=txt_hi,
        font=font,
    )

    # --- Section 1: All 24 Tiles at 4x + 1x (6 cols x 4 rows) ---
    draw.text((20, 58), "1. Individual 16x16 Tiles (Left: 4x = 64x64 | Right: 1x = 16x16)", fill=txt_hi, font=font)
    cols = 6
    cw, ch = 164, 102
    gx0, gy0 = 16, 78
    for idx, (name, _) in enumerate(ALL_TILE_SPECS):
        r, col = divmod(idx, cols)
        x0 = gx0 + col * (cw + 5)
        y0 = gy0 + r * (ch + 5)
        draw.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], fill=card_bg, outline=border)

        im1 = built[name].img
        im4 = im1.resize((64, 64), Image.Resampling.NEAREST)
        sheet.paste(im4, (x0 + 10, y0 + 8))
        sheet.paste(im1, (x0 + 86, y0 + 56))
        draw.rectangle([x0 + 9, y0 + 7, x0 + 74, y0 + 72], outline=border)

        short = name.replace("floor_", "f_").replace("wall_", "w_")
        draw.text((x0 + 8, y0 + 76), short, fill=txt_hi, font=font)
        if name.startswith("floor_"):
            sr = floor_spike_ratio(im1)
            draw.text((x0 + 86, y0 + 12), f"spk:{sr:.3f}", fill=txt_dim, font=font)

    # --- Section 2: 3x3 Tiled Floor Samples (8 floors: 4 cols x 2 rows at 2x=96x96 + 1x=48x48) ---
    sy2 = 514
    draw.text((20, sy2), "2. 3x3 Tiled Floor Calmness Check (Left: 2x = 96x96 | Right: 1x = 48x48)", fill=txt_hi, font=font)
    fcw, fch = 248, 128
    for idx, (name, _) in enumerate(FLOOR_TILES):
        r, col = divmod(idx, 4)
        x0 = 16 + col * (fcw + 5)
        y0 = sy2 + 20 + r * (fch + 6)
        draw.rectangle([x0, y0, x0 + fcw - 1, y0 + fch - 1], fill=card_bg, outline=border)

        t3 = tile_3x3(built[name].img)  # 48x48
        t3_2x = t3.resize((96, 96), Image.Resampling.NEAREST)
        sheet.paste(t3_2x, (x0 + 10, y0 + 8))
        sheet.paste(t3, (x0 + 118, y0 + 56))
        sr3 = floor_spike_ratio(t3)
        draw.text((x0 + 118, y0 + 12), name.replace("floor_", ""), fill=txt_hi, font=font)
        draw.text((x0 + 118, y0 + 28), f"3x3 spk: {sr3:.4f}", fill=txt_dim, font=font)

    # --- Section 3: Multi-Tile Assembled Wall, Door & Glass Vignettes (2x) ---
    sy3 = 808
    draw.text((20, sy3), "3. Seamless Multi-Tile Architectural Vignettes (2x = 32px/tile)", fill=txt_hi, font=font)
    draw.rectangle([16, sy3 + 18, sheet_w - 16, sheet_h - 14], fill=card_bg, outline=border)

    # Build a 28x4 mini architectural strip (448x64 @ 1x -> 896x128 @ 2x)
    strip_cols, strip_rows = 28, 4
    strip = Image.new("RGBA", (strip_cols * 16, strip_rows * 16))

    def put(c_idx: int, r_idx: int, tname: str) -> None:
        strip.paste(built[tname].img, (c_idx * 16, r_idx * 16))

    # Cols 0..7: NW Cafe Wood Wall + Paired Night Windows + AC + Oak Floor + Horiz Glass Divider
    for c_idx in range(8):
        put(c_idx, 0, "wall_cap_edge_s")
        put(c_idx, 1, "wall_cafe_wood_upper")
        put(c_idx, 2, "wall_cafe_wood_lower")
        put(c_idx, 3, "floor_cafe_oak")
    put(2, 1, "wall_window_night")
    put(3, 1, "wall_window_night")
    put(5, 1, "wall_ac_unit")
    for c_idx in (5, 6, 7):
        put(c_idx, 3, "wall_glass_divider")

    # Col 8: Vertical Glass Divider between Cafe & Lobby
    put(8, 0, "wall_cap_edge_s")
    put(8, 1, "wall_face_upper")
    put(8, 2, "wall_face_lower")
    put(8, 3, "wall_glass_divider_v")

    # Cols 9..19: NE Lobby Cool Plaster Wall + Neon + Poster + 2x2 Automatic Glass Door + Mat
    for c_idx in range(9, 20):
        put(c_idx, 0, "wall_cap_edge_s")
        put(c_idx, 1, "wall_face_upper")
        put(c_idx, 2, "wall_face_lower")
        put(c_idx, 3, "floor_lobby_slate" if (c_idx % 2 == 0) else "floor_lobby_slate_alt")
    put(10, 1, "wall_neon_sign")
    put(11, 1, "wall_neon_sign")
    put(13, 1, "wall_game_poster")
    put(14, 1, "wall_window_night")
    put(15, 1, "wall_window_night")
    put(17, 1, "wall_door_top_left")
    put(18, 1, "wall_door_top_right")
    put(17, 2, "wall_door_arch_left")
    put(18, 2, "wall_door_arch_right")
    put(17, 3, "floor_entrance_mat")
    put(18, 3, "floor_entrance_mat")

    # Cols 20..27: PC Arena Carpet + Trim + Vertical Glass + Arcade Teal + VIP Carpet
    for r_idx in range(4):
        put(20, r_idx, "floor_pc_carpet")
        put(21, r_idx, "floor_pc_carpet_trim")
        put(22, r_idx, "floor_pc_carpet")
        put(23, r_idx, "wall_glass_divider_v")
        put(24, r_idx, "floor_arcade_teal")
        put(25, r_idx, "floor_arcade_teal")
        put(26, r_idx, "floor_vip_carpet")
        put(27, r_idx, "floor_vip_carpet")

    strip_2x = strip.resize((strip.width * 2, strip.height * 2), Image.Resampling.NEAREST)
    sheet.paste(strip_2x, (72, sy3 + 24))
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def build_all() -> Dict[str, TileCanvas]:
    TILES_DIR.mkdir(parents=True, exist_ok=True)
    built: Dict[str, TileCanvas] = {}
    for name, fn in ALL_TILE_SPECS:
        canvas = fn()
        canvas.save(TILES_DIR / f"{name}.png")
        built[name] = canvas
    return built


if __name__ == "__main__":
    tiles = build_all()
    render_preview_sheet(tiles)
    rc = verify_tiles(tiles)
    print(f"Preview sheet    : {PREVIEW_PATH}")
    sys.exit(rc)
