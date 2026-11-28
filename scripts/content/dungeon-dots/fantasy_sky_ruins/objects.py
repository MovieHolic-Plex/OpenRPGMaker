"""20 distinct finished Beodeul Ancient Ruins & Crystal Sanctuary objects.

All sprites obey:
- Exact 16px-multiple canvas, transparent background, bottom-aligned & horizontally centered
- Strict locked Beodeul outdoor ruins palette (palette.py)
- Optional ground shadow ONLY #4c557f@85; all other pixels alpha 0 or 255
- 1px dark outline in each material's darkest shade (never pure #000000)
- Strict RPG Maker 2000/2003 orthographic camera rules (standing / topdown / slender)
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Tuple
from PIL import Image

from palette import C, PixelCanvas


@dataclass(frozen=True)
class ObjectSpec:
    file: str
    id: str
    name_en: str
    name_ko: str
    canvas: Tuple[int, int]
    tiles: str
    camera: str
    facing: str
    description: str
    tags: List[str]
    note_summary: str
    draw_fn: Callable[[], PixelCanvas]


# ---------------------------------------------------------------------------
# 1. ruin_shrine_gate (48x48, standing / 3/4 structure)
# ---------------------------------------------------------------------------
def draw_ruin_shrine_gate() -> PixelCanvas:
    c = PixelCanvas(48, 48)
    # 3/4 stepped stone cornice + sloped cobalt-slate sanctum roof cap (top band y=2..16 = 33%)
    # Top stone ridge (y=2..4, x=8..39)
    c.rect(9, 2, 38, 4, "S6", "stone")
    c.hline(9, 38, 2, "S0", "stone")
    c.hline(10, 37, 3, "S8", "stone")
    c.hline(10, 37, 4, "S5", "stone")
    c.vline(8, 3, 4, "S0", "stone")
    c.vline(39, 3, 4, "S0", "stone")
    # Sloped cobalt-slate roof seen from above (y=5..13, widens from x=7..40 to x=4..43)
    for row_i, y in enumerate(range(5, 14)):
        inset = max(0, 3 - row_i // 2)
        x0 = 4 + inset
        x1 = 43 - inset
        c.hline(x0, x1, y, "B3" if row_i % 3 == 0 else ("B2" if row_i % 3 == 1 else "B1"), "roof")
        if row_i % 3 == 0:
            for sx in range(x0 + 2 + (row_i % 2), x1 - 1, 4):
                c.set(sx, y, "B5", "roof")
                if sx + 1 <= x1 - 1:
                    c.set(sx + 1, y, "B4", "roof")
        elif row_i % 3 == 2:
            c.hline(x0 + 1, x1 - 1, y, "B1", "roof")
        c.set(x0, y, "B0", "roof")
        c.set(x1, y, "B0", "roof")
    # Stone parapet cornice band beneath roof eave (y=14..17, x=3..44)
    c.rect(3, 14, 44, 17, "S6", "stone")
    c.hline(3, 44, 14, "S0", "stone")
    c.hline(4, 43, 15, "S8", "stone")
    c.hline(4, 43, 16, "S6", "stone")
    c.hline(3, 44, 17, "S2", "stone")
    c.vline(3, 14, 17, "S0", "stone")
    c.vline(44, 14, 17, "S0", "stone")
    for jx in (11, 19, 28, 36):
        c.vline(jx, 15, 17, "S3", "stone")

    # Main front stone shrine facade (y=18..46, x=4..43) — NO side walls
    c.rect(4, 18, 43, 46, "S5", "stone")
    c.vline(4, 18, 46, "S0", "stone")
    c.vline(43, 18, 46, "S0", "stone")
    c.hline(4, 43, 46, "S0", "stone")
    # Horizontal ashlar stone masonry courses on facade
    for ci, y in enumerate(range(18, 46, 4)):
        c.hline(5, 42, y, "S7" if ci % 2 == 0 else "S6", "stone")
        c.hline(5, 42, min(45, y + 3), "S3", "stone")
        off = 8 if ci % 2 == 0 else 12
        for jx in range(off, 42, 8):
            c.vline(jx, y, min(45, y + 3), "S3", "stone")

    # Flanking carved pilasters (x=5..12 left, x=35..42 right)
    for px0, px1 in ((5, 11), (36, 42)):
        c.rect(px0, 18, px1, 45, "S6", "stone")
        c.vline(px0, 18, 45, "S7", "stone")
        c.vline(px1, 18, 45, "S3", "stone")
        for py in (22, 28, 34, 40):
            c.hline(px0, px1, py, "S2", "stone")
            c.hline(px0, px1 - 1, py + 1, "S7", "stone")
        # Plinth base blocks
        c.rect(px0 - 1, 42, px1 + 1, 45, "S5", "stone")
        c.hline(px0 - 1, px1 + 1, 42, "S7", "stone")
        c.hline(px0 - 1, px1 + 1, 45, "S1", "stone")
        c.vline(px0 - 1, 42, 46, "S0", "stone")
        c.vline(px1 + 1, 42, 46, "S0", "stone")

    # Arched doorway opening (24px tall: y=22..45, 18px wide: x=15..32)
    # Stone voussoir arch surround
    for y in range(20, 46):
        if y < 26:
            dx = int(round(((26 - y) / 6.0) ** 1.7 * 5))
        else:
            dx = 0
        ax0 = 15 + dx
        ax1 = 32 - dx
        # Arch stone rim (2px around doorway)
        for rx in (ax0 - 2, ax0 - 1, ax1 + 1, ax1 + 2):
            if 12 <= rx <= 35:
                c.set(rx, y, "S7" if rx < 24 else "S4", "stone")
        c.set(ax0 - 1, y, "S2", "stone")
        c.set(ax1 + 1, y, "S1", "stone")
        # Deep dark arched interior void
        c.hline(ax0, ax1, y, "B0", "iron")
        if y >= 25:
            c.hline(ax0 + 1, ax1 - 1, y, "I0", "iron")
    # Arch top stone rim & glowing cyan rune keystone
    c.rect(18, 18, 29, 20, "S7", "stone")
    c.hline(17, 30, 18, "S2", "stone")
    c.rect(22, 18, 25, 21, "S6", "stone")
    c.rect(22, 18, 25, 18, "S8", "stone")
    c.set(23, 19, "C5", "crystal")
    c.set(24, 19, "C4", "crystal")
    c.set(23, 20, "C3", "crystal")
    c.set(24, 20, "C2", "crystal")

    # Worn stone threshold step at doorway bottom (y=44..46, x=14..33)
    c.hline(14, 33, 44, "S7", "stone")
    c.hline(14, 33, 45, "S5", "stone")
    c.hline(14, 33, 46, "S0", "stone")

    # Clinging Beodeul moss / ivy cascading over left eave & right base
    moss_px = [
        (5, 13, "F3"), (6, 13, "F4"), (7, 13, "F3"), (8, 13, "F2"),
        (5, 14, "F2"), (6, 14, "F3"), (7, 14, "F4"), (8, 14, "F3"), (9, 14, "F1"),
        (6, 15, "F2"), (7, 15, "F3"), (8, 15, "F2"), (9, 15, "F1"),
        (6, 16, "F1"), (7, 16, "F3"), (8, 16, "F2"),
        (7, 17, "F2"), (8, 17, "F1"), (7, 18, "F3"), (7, 19, "F2"), (8, 19, "F1"), (7, 20, "F1"),
        (37, 14, "F2"), (38, 14, "F3"), (39, 14, "F3"), (38, 15, "F2"), (39, 15, "F1"),
        (39, 41, "F3"), (40, 41, "F4"), (41, 41, "F2"), (38, 42, "F2"), (39, 42, "F3"), (40, 42, "F2"),
    ]
    for mx, my, mc in moss_px:
        c.set(mx, my, mc, "foliage")

    c.ensure_dark_outline("stone")
    c.add_ground_shadow(3, 44, 46, 2)
    return c


# ---------------------------------------------------------------------------
# 2. crystal_rune_altar (32x32, standing)
# ---------------------------------------------------------------------------
def draw_crystal_rune_altar() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Flared bottom step (y=26..30, x=3..28)
    c.rect(3, 26, 28, 30, "S5", "stone")
    c.hline(3, 28, 26, "S0", "stone")
    c.hline(4, 27, 27, "S7", "stone")
    c.hline(4, 27, 28, "S5", "stone")
    c.hline(4, 27, 29, "S3", "stone")
    c.hline(3, 28, 30, "S0", "stone")
    c.vline(3, 26, 30, "S0", "stone")
    c.vline(28, 26, 30, "S0", "stone")

    # Main altar block front face (y=20..26, x=5..26) + lit top altar slab (y=15..19, x=5..26)
    c.rect(5, 15, 26, 26, "S5", "stone")
    # Lit top surface band (y=15..19)
    c.hline(5, 26, 15, "S0", "stone")
    c.rect(6, 16, 25, 18, "S7", "stone")
    c.hline(6, 25, 16, "S8", "stone")
    c.hline(5, 26, 19, "S2", "stone")
    # Front face with recessed carved rune panel
    c.rect(6, 20, 25, 25, "S5", "stone")
    c.hline(6, 25, 20, "S6", "stone")
    c.rect(9, 21, 22, 24, "S3", "stone")
    c.hline(9, 22, 21, "S2", "stone")
    # Glowing cyan rune glyph carved on altar front
    for rx, ry, rc in [(14, 22, "C4"), (15, 22, "C5"), (16, 22, "C5"), (17, 22, "C4"), (15, 23, "C3"), (16, 23, "C3")]:
        c.set(rx, ry, rc, "crystal")
    c.vline(5, 15, 26, "S0", "stone")
    c.vline(26, 15, 26, "S0", "stone")
    c.hline(5, 26, 26, "S1", "stone")

    # Dark stone cradle socket on top slab (y=14..17, x=10..21)
    c.rect(10, 15, 21, 17, "D1", "slate")
    c.hline(11, 20, 15, "D3", "slate")
    c.hline(10, 21, 17, "D0", "slate")

    # Large faceted glowing cyan crystal rising cleanly (y=2..16, x=10..21)
    crystal_rows = [
        "....00....",
        "...0650...",
        "..065420..",
        "..065420..",
        ".06543210.",
        ".05543210.",
        ".05443210.",
        ".04433210.",
        "0643322100",
        "0533221120",
        "0432211210",
        ".03221110.",
        "..022110..",
        "...0000...",
    ]
    c_map = {
        "0": ("C0", "crystal"),
        "1": ("C1", "crystal"),
        "2": ("C2", "crystal"),
        "3": ("C3", "crystal"),
        "4": ("C4", "crystal"),
        "5": ("C5", "crystal"),
        "6": ("C6", "crystal"),
    }
    c.draw_grid(crystal_rows, c_map, ox=11, oy=2)
    # Small flanking side crystal shards
    for sx, sy in [(8, 12), (22, 11)]:
        c.set(sx, sy, "C0", "crystal")
        c.set(sx, sy + 1, "C5", "crystal")
        c.set(sx + 1, sy + 1, "C2", "crystal")
        c.set(sx, sy + 2, "C4", "crystal")
        c.set(sx + 1, sy + 2, "C1", "crystal")
        c.set(sx - 1, sy + 1, "C0", "crystal")
        c.set(sx - 1, sy + 2, "C0", "crystal")
        c.set(sx + 2, sy + 1, "C0", "crystal")
        c.set(sx + 2, sy + 2, "C0", "crystal")
        c.set(sx + 1, sy, "C0", "crystal")

    c.ensure_dark_outline("stone")
    c.add_ground_shadow(3, 28, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 3. stone_guardian_statue (16x32, standing — unmistakable horned knight sentinel!)
# ---------------------------------------------------------------------------
def draw_stone_guardian_statue() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    rows = [
        "...00......00...",
        "..076000000530..",
        "..077877654320..",
        "...0766554320...",
        "...0711541120...",
        "...0665544320...",
        "....01111110....",
        ".00077654322000.",
        "0877661761433220",
        "0766517876132210",
        "0655417765122110",
        "0544167765412110",
        ".00016676541000.",
        "..061567653120..",
        "..061556543120..",
        "..051456542110..",
        "..054145431210..",
        "..054315412210..",
        "..043221122110..",
        "..043221121110..",
        "..000000000000..",
        ".08777666554430.",
        ".07666555443320.",
        "0087776665544300",
        "0776665554433220",
        "0655544433322110",
        "0000000000000000",
    ]
    legend = {
        "0": ("S0", "stone"),
        "1": ("S1", "stone"),
        "2": ("S2", "stone"),
        "3": ("S3", "stone"),
        "4": ("S4", "stone"),
        "5": ("S5", "stone"),
        "6": ("S6", "stone"),
        "7": ("S7", "stone"),
        "8": ("S8", "stone"),
    }
    c.draw_grid(rows, legend, ox=0, oy=4)
    # Glowing cyan crest gem on kite shield & subtle moss on left pauldron
    c.set(7, 14, "C5", "crystal")
    c.set(8, 14, "C4", "crystal")
    c.set(7, 15, "C3", "crystal")
    c.set(8, 15, "C2", "crystal")
    c.set(1, 12, "F3", "foliage")
    c.set(2, 12, "F4", "foliage")
    c.set(2, 13, "F2", "foliage")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(1, 14, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 4. stone_pillar_intact (16x32, standing)
# ---------------------------------------------------------------------------
def draw_stone_pillar_intact() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Square capital top slab (lit top face y=2..5, x=2..13)
    c.rect(2, 2, 13, 5, "S7", "stone")
    c.hline(2, 13, 2, "S0", "stone")
    c.hline(3, 12, 3, "S8", "stone")
    c.hline(3, 12, 4, "S6", "stone")
    c.hline(2, 13, 5, "S2", "stone")
    c.vline(2, 2, 5, "S0", "stone")
    c.vline(13, 2, 5, "S0", "stone")
    # Capital echinus molding (y=6..7, x=3..12)
    c.rect(3, 6, 12, 7, "S5", "stone")
    c.hline(4, 11, 6, "S6", "stone")
    c.hline(3, 12, 7, "S2", "stone")
    c.vline(3, 6, 7, "S0", "stone")
    c.vline(12, 6, 7, "S0", "stone")
    # Fluted column shaft (y=8..25, x=4..11) — crisp vertical flutes lit from left
    flute_pattern = ["S0", "S7", "S5", "S3", "S6", "S4", "S2", "S0"]
    for y in range(8, 26):
        for i, col in enumerate(flute_pattern):
            c.set(4 + i, y, col, "stone")
        if y in (14, 20):
            # Subtle horizontal stone drum seam
            c.hline(5, 10, y, "S3", "stone")
            c.hline(5, 10, y + 1, "S7", "stone")
    # Small moss creep on upper-left drum seam
    c.set(5, 14, "F3", "foliage")
    c.set(6, 14, "F4", "foliage")
    c.set(5, 15, "F2", "foliage")
    # Stepped plinth base (y=26..30, x=2..13)
    c.rect(3, 26, 12, 27, "S6", "stone")
    c.hline(3, 12, 26, "S7", "stone")
    c.vline(3, 26, 27, "S0", "stone")
    c.vline(12, 26, 27, "S0", "stone")
    c.rect(2, 28, 13, 30, "S5", "stone")
    c.hline(2, 13, 28, "S7", "stone")
    c.hline(3, 12, 29, "S4", "stone")
    c.hline(2, 13, 30, "S0", "stone")
    c.vline(2, 28, 30, "S0", "stone")
    c.vline(13, 28, 30, "S0", "stone")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(2, 13, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 5. stone_pillar_broken (16x32, standing)
# ---------------------------------------------------------------------------
def draw_stone_pillar_broken() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Jagged diagonal broken top (higher on left y=10, lower on right y=15)
    top_profile = [10, 10, 11, 11, 12, 13, 14, 15]  # x=4..11
    flute_pattern = ["S0", "S7", "S5", "S3", "S6", "S4", "S2", "S0"]
    for i, ty in enumerate(top_profile):
        x = 4 + i
        c.set(x, ty, "S0", "stone")
        c.set(x, ty + 1, "S8", "stone")  # bright exposed fractured stone top edge
        c.set(x, ty + 2, "S7", "stone")
        c.set(x, ty + 3, "S5", "stone")
        for y in range(ty + 4, 26):
            c.set(x, y, flute_pattern[i], "stone")
    # Crisp vertical outer edges of shaft
    for y in range(top_profile[0], 26):
        c.set(4, y, "S0", "stone")
    for y in range(top_profile[-1], 26):
        c.set(11, y, "S0", "stone")
    # Moss creeping across broken stone lip
    for mx, my, mc in [(5, 11, "F4"), (6, 12, "F3"), (7, 12, "F4"), (7, 13, "F2"), (8, 13, "F3"), (8, 14, "F1")]:
        c.set(mx, my, mc, "foliage")
    # Stepped plinth base (y=26..30, x=2..13) + fallen chip integrated on right
    c.rect(3, 26, 12, 27, "S6", "stone")
    c.hline(3, 12, 26, "S7", "stone")
    c.vline(3, 26, 27, "S0", "stone")
    c.vline(12, 26, 27, "S0", "stone")
    c.rect(2, 28, 13, 30, "S5", "stone")
    c.hline(2, 13, 28, "S7", "stone")
    c.hline(3, 12, 29, "S4", "stone")
    c.hline(2, 13, 30, "S0", "stone")
    c.vline(2, 28, 30, "S0", "stone")
    c.vline(13, 28, 30, "S0", "stone")
    # Small fallen stone rubble chunk resting against right base
    c.rect(11, 24, 14, 27, "S5", "stone")
    c.hline(12, 13, 25, "S7", "stone")
    c.hline(11, 14, 24, "S0", "stone")
    c.vline(14, 24, 27, "S0", "stone")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(2, 14, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 6. carved_rune_stele (32x32, standing — ref_ezx_row_4x tablet style!)
# ---------------------------------------------------------------------------
def draw_carved_rune_stele() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Stepped stone plinth (y=25..30, x=3..28)
    c.rect(3, 27, 28, 30, "S5", "stone")
    c.hline(3, 28, 27, "S0", "stone")
    c.hline(4, 27, 28, "S7", "stone")
    c.hline(4, 27, 29, "S3", "stone")
    c.hline(3, 28, 30, "S0", "stone")
    c.vline(3, 27, 30, "S0", "stone")
    c.vline(28, 27, 30, "S0", "stone")

    # Flanking stepped side shoulders (y=10..27, x=5..26)
    c.rect(5, 10, 26, 27, "S5", "stone")
    c.hline(5, 26, 10, "S0", "stone")
    c.hline(6, 25, 11, "S7", "stone")
    c.vline(5, 10, 27, "S0", "stone")
    c.vline(26, 10, 27, "S0", "stone")

    # Rounded central stele monolith (y=2..26, x=8..23)
    for y in range(2, 27):
        inset = 3 if y == 2 else (2 if y == 3 else (1 if y == 4 else 0))
        x0 = 8 + inset
        x1 = 23 - inset
        c.hline(x0, x1, y, "S6", "stone")
        if y <= 5:
            # Lit top arch thickness band!
            c.hline(x0 + 1, x1 - 1, y, "S8" if y <= 4 else "S7", "stone")
        c.set(x0, y, "S0", "stone")
        c.set(x1, y, "S0", "stone")
    c.hline(11, 20, 2, "S0", "stone")
    # Carved recessed tablet face (x=10..21, y=7..24)
    c.rect(10, 7, 21, 24, "S4", "stone")
    c.hline(10, 21, 7, "S2", "stone")
    c.vline(10, 7, 24, "S2", "stone")
    c.hline(10, 21, 24, "S7", "stone")
    c.vline(21, 7, 24, "S7", "stone")
    # Top glowing cyan rune crest + 4 clean rows of ancient carved glyphs
    c.rect(14, 9, 17, 11, "C4", "crystal")
    c.set(15, 10, "C6", "crystal")
    c.set(16, 10, "C5", "crystal")
    for ry in (14, 17, 20, 22):
        for rx in (12, 14, 16, 18, 19):
            if (rx + ry) % 3 != 0:
                c.set(rx, ry, "C3" if ry == 14 else "S2", "stone")
    # Subtle moss draped along left plinth & shoulder
    for mx, my, mc in [(6, 25, "F3"), (7, 25, "F4"), (8, 25, "F2"), (6, 26, "F2"), (7, 26, "F3"), (8, 26, "F1")]:
        c.set(mx, my, mc, "foliage")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(3, 28, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 7. sanctuary_fountain_round (32x32, topdown — ref_s4_best_row fountain!)
# ---------------------------------------------------------------------------
def draw_sanctuary_fountain_round() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    cx, cy = 15.5, 14.5
    # Short 3px front stone rim wall visible beneath oval basin (topdown >= 80% top!)
    c.ellipse(cx, cy + 3.0, 14.2, 10.8, "S0", "stone")
    c.ellipse(cx, cy + 2.5, 13.4, 10.0, "S3", "stone")
    c.ellipse(cx, cy + 1.8, 13.2, 9.8, "S4", "stone")
    # Main top stone rim ring (flat top seen from above)
    c.ellipse(cx, cy, 14.2, 10.6, "S0", "stone")
    c.ellipse(cx, cy, 13.3, 9.7, "S6", "stone")
    # Top-left bright rim bevel highlight
    for y in range(4, 16):
        for x in range(2, 22):
            dx = (x - cx) / 13.0
            dy = (y - cy) / 9.5
            d = dx * dx + dy * dy
            if 0.68 <= d <= 0.96 and (x - cx) + (y - cy) < 2:
                c.set(x, y, "S7", "stone")
                if d >= 0.84 and (x - cx) + (y - cy) < -3:
                    c.set(x, y, "S8", "stone")
    # Radial stone coping joints on rim
    for jx, jy in [(15, 5), (16, 5), (15, 24), (16, 24), (3, 14), (4, 14), (27, 14), (28, 14)]:
        c.set(jx, jy, "S3", "stone")

    # Inner dark waterline border + deep sea teal sanctuary water (LESSONS.md #19)
    c.ellipse(cx, cy + 0.3, 10.8, 7.6, "W0", "water")
    c.ellipse(cx, cy + 0.6, 10.0, 6.9, "W1", "water")
    c.ellipse(cx, cy + 1.0, 8.8, 5.8, "W2", "water")
    c.ellipse(cx, cy + 1.2, 6.8, 4.4, "W3", "water")
    # Concentric crisp cyan/white foam ripples
    for x, y, col in [
        (9, 13, "W5"), (10, 12, "W5"), (11, 12, "C4"), (20, 12, "W5"), (21, 13, "W5"),
        (10, 18, "W4"), (11, 19, "W5"), (12, 19, "C4"), (19, 19, "W5"), (20, 18, "W4"),
        (13, 11, "C5"), (18, 11, "W5"),
    ]:
        c.set(x, y, col, "water")

    # Carved round center stone spout + sparkling water jet
    c.ellipse(cx, cy - 0.5, 3.6, 2.8, "S0", "stone")
    c.ellipse(cx, cy - 0.7, 2.7, 2.0, "S6", "stone")
    c.ellipse(cx, cy - 1.2, 1.8, 1.3, "S8", "stone")
    # Bright cyan-white spout splash in center
    c.set(15, 13, "C6", "crystal")
    c.set(16, 13, "C5", "crystal")
    c.set(15, 14, "C4", "crystal")
    c.set(16, 14, "C6", "crystal")
    c.set(14, 15, "C4", "crystal")
    c.set(17, 15, "C5", "crystal")

    c.ensure_dark_outline("stone")
    c.add_ground_shadow(3, 28, 26, 3)
    return c


# ---------------------------------------------------------------------------
# 8. mossy_stone_well (32x32, standing — ref_beodeul_props_best_4x style!)
# ---------------------------------------------------------------------------
def draw_mossy_stone_well() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    cx = 15.5
    # Lower circular stone well cylinder (y=17..30, x=4..27)
    for y in range(20, 31):
        # Slightly curved cylinder bottom
        hw = 11 if y < 28 else (10 if y == 28 else (9 if y == 29 else 7))
        x0 = int(round(cx - hw))
        x1 = int(round(cx + hw))
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1 or y == 30:
                c.set(x, y, "S0", "stone")
            else:
                # Curved cylinder shading (top-left light, right shadow)
                rel = (x - x0) / max(1, x1 - x0)
                col = "S7" if rel < 0.25 else ("S6" if rel < 0.5 else ("S4" if rel < 0.78 else "S3"))
                if (y - 20) % 3 == 2:
                    col = "S2"  # ashlar course line
                c.set(x, y, col, "stone")
        # Staggered vertical stone joints
        if (y - 20) % 3 != 2:
            off = 4 if ((y - 20) // 3) % 2 == 0 else 6
            for jx in range(x0 + off, x1, 5):
                c.set(jx, y, "S2", "stone")

    # Top stone rim & dark teal water opening (y=15..21)
    c.ellipse(cx, 18.5, 11.6, 4.3, "S0", "stone")
    c.ellipse(cx, 18.2, 10.6, 3.6, "S6", "stone")
    c.ellipse(cx, 17.8, 10.2, 3.2, "S7", "stone")
    c.ellipse(cx, 18.4, 8.6, 2.7, "W0", "water")
    c.ellipse(cx, 18.7, 7.8, 2.2, "W1", "water")
    c.ellipse(cx, 19.0, 6.2, 1.5, "W3", "water")
    # Crisp bright foam glints on dark water
    c.set(12, 19, "C5", "water")
    c.set(13, 19, "W5", "water")
    c.set(19, 19, "W5", "water")

    # Two upright weathered oak timber posts (x=6..9 and x=22..25, y=4..18)
    for px0 in (6, 22):
        c.rect(px0, 4, px0 + 3, 18, "O4", "wood")
        c.vline(px0, 4, 18, "O0", "wood")
        c.vline(px0 + 1, 5, 17, "O6", "wood")
        c.vline(px0 + 2, 5, 17, "O3", "wood")
        c.vline(px0 + 3, 4, 18, "O0", "wood")
        c.hline(px0, px0 + 3, 4, "O0", "wood")
        c.hline(px0, px0 + 3, 18, "O0", "wood")
    # Top oak crossbeam & windlass drum (y=5..8, x=5..26)
    c.rect(5, 5, 26, 8, "O4", "wood")
    c.hline(5, 26, 5, "O0", "wood")
    c.hline(6, 25, 6, "O7", "wood")
    c.hline(6, 25, 7, "O4", "wood")
    c.hline(5, 26, 8, "O0", "wood")
    c.vline(5, 5, 8, "O0", "wood")
    c.vline(26, 5, 8, "O0", "wood")
    # Iron crank handle on right post
    c.rect(26, 6, 29, 7, "I2", "iron")
    c.set(27, 6, "I4", "iron")
    c.rect(28, 7, 29, 11, "I1", "iron")
    c.set(28, 8, "I3", "iron")
    c.set(29, 11, "I0", "iron")

    # Thick 2px tan rope coiled around windlass & descending to bucket (LESSONS.md #16)
    c.rect(14, 5, 17, 8, "P3", "wood")
    c.hline(14, 17, 5, "O0", "wood")
    c.set(15, 6, "P5", "wood")
    c.set(16, 7, "P4", "wood")
    for ry in range(9, 15):
        c.set(15, ry, "P4" if ry % 2 == 0 else "P3", "wood")
        c.set(16, ry, "P2" if ry % 2 == 0 else "P4", "wood")
        c.set(14, ry, "O0", "wood")
        c.set(17, ry, "O0", "wood")
    # Hanging wooden bucket over water (x=13..18, y=14..19)
    c.rect(13, 14, 18, 19, "O4", "wood")
    c.hline(13, 18, 14, "O0", "wood")
    c.hline(14, 17, 15, "O6", "wood")
    c.hline(14, 17, 16, "I2", "iron")  # iron hoop
    c.hline(14, 17, 18, "I1", "iron")  # iron hoop
    c.hline(13, 18, 19, "O0", "wood")
    c.vline(13, 14, 19, "O0", "wood")
    c.vline(18, 14, 19, "O0", "wood")

    # Lush moss patch on lower-left well stone base
    for mx, my, mc in [(5, 25, "F3"), (6, 25, "F4"), (7, 25, "F3"), (6, 26, "F2"), (7, 26, "F3"), (8, 26, "F2"), (7, 27, "F1")]:
        c.set(mx, my, mc, "foliage")

    c.ensure_dark_outline("stone")
    c.add_ground_shadow(4, 27, 29, 2)
    return c


# ---------------------------------------------------------------------------
# 9. iron_brazier_lit (16x32, standing)
# ---------------------------------------------------------------------------
def draw_iron_brazier_lit() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Stylized blazing pixel flame (y=3..14, x=4..11) with dark crimson edge outline
    flame_rows = [
        "...00...",
        "..0340..",
        "..0470..",
        ".035840.",
        ".047870.",
        "03588730",
        "03588740",
        "03478730",
        "01357530",
        ".013430.",
    ]
    f_map = {
        "0": ("R0", "flame"),
        "1": ("R1", "flame"),
        "3": ("R3", "flame"),
        "4": ("E1", "flame"),
        "5": ("E2", "flame"),
        "7": ("Y2", "flame"),
        "8": ("Y3", "flame"),
    }
    c.draw_grid(flame_rows, f_map, ox=4, oy=3)

    # Wide iron fire bowl (y=12..19, x=2..13) with lit top rim & glowing coal bed
    c.rect(2, 13, 13, 15, "I2", "iron")
    c.hline(2, 13, 13, "I0", "iron")
    c.hline(3, 12, 14, "I4", "iron")  # bright iron top rim edge
    # Coals peeking inside bowl top
    c.hline(5, 10, 13, "E1", "flame")
    c.hline(6, 9, 13, "Y2", "flame")
    c.hline(2, 13, 15, "I1", "iron")
    c.vline(2, 13, 15, "I0", "iron")
    c.vline(13, 13, 15, "I0", "iron")
    # Curved bowl body (y=16..19)
    for dy, (x0, x1) in enumerate([(3, 12), (4, 11), (5, 10), (6, 9)]):
        y = 16 + dy
        c.hline(x0, x1, y, "I2", "iron")
        c.set(x0 + 1, y, "I3", "iron")
        c.set(x1 - 1, y, "I1", "iron")
        c.set(x0, y, "I0", "iron")
        c.set(x1, y, "I0", "iron")
    # Fluted iron pedestal & flared tripod legs (y=20..30)
    c.rect(6, 20, 9, 25, "I2", "iron")
    c.vline(6, 20, 25, "I0", "iron")
    c.vline(7, 20, 25, "I3", "iron")
    c.vline(8, 20, 25, "I1", "iron")
    c.vline(9, 20, 25, "I0", "iron")
    # Decorative mid-ring
    c.rect(5, 22, 10, 23, "I3", "iron")
    c.set(5, 22, "I0", "iron")
    c.set(10, 22, "I0", "iron")
    c.hline(5, 10, 23, "I1", "iron")
    # Flared tripod feet (y=26..30, x=3..12)
    c.rect(5, 26, 10, 27, "I2", "iron")
    c.rect(3, 28, 6, 30, "I2", "iron")
    c.rect(9, 28, 12, 30, "I2", "iron")
    c.rect(6, 28, 9, 29, "I1", "iron")
    c.set(4, 28, "I4", "iron")
    c.set(10, 28, "I3", "iron")
    c.hline(3, 6, 30, "I0", "iron")
    c.hline(9, 12, 30, "I0", "iron")
    c.vline(3, 28, 30, "I0", "iron")
    c.vline(12, 28, 30, "I0", "iron")
    c.ensure_dark_outline("iron")
    c.add_ground_shadow(3, 12, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 10. stone_garden_lantern (16x32, slender — ref_beodeul_props_best_4x!)
# ---------------------------------------------------------------------------
def draw_stone_garden_lantern() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Finial + pagoda stone roof cap (y=2..9, x=3..12)
    c.rect(7, 2, 8, 3, "S7", "stone")
    c.set(7, 2, "S0", "stone")
    c.set(8, 2, "S0", "stone")
    c.rect(5, 4, 10, 5, "S7", "stone")
    c.hline(5, 10, 4, "S0", "stone")
    c.hline(6, 9, 5, "S8", "stone")
    c.rect(3, 6, 12, 8, "S6", "stone")
    c.hline(3, 12, 6, "S0", "stone")
    c.hline(4, 11, 7, "S7", "stone")
    c.hline(3, 12, 8, "S2", "stone")
    c.vline(3, 6, 8, "S0", "stone")
    c.vline(12, 6, 8, "S0", "stone")
    # Firebox lantern chamber with warm glowing amber core (y=9..15, x=5..10)
    c.rect(5, 9, 10, 15, "S5", "stone")
    c.vline(5, 9, 15, "S0", "stone")
    c.vline(10, 9, 15, "S0", "stone")
    c.hline(5, 10, 9, "S2", "stone")
    # Glowing lantern glass window (x=6..9, y=10..13)
    c.rect(6, 10, 9, 13, "E2", "flame")
    c.rect(7, 10, 8, 12, "Y2", "flame")
    c.set(7, 11, "Y3", "flame")
    # Lantern sill shelf (y=14..16, x=4..11)
    c.rect(4, 14, 11, 16, "S6", "stone")
    c.hline(5, 10, 14, "S7", "stone")
    c.hline(4, 11, 16, "S2", "stone")
    c.vline(4, 14, 16, "S0", "stone")
    c.vline(11, 14, 16, "S0", "stone")
    # Slender 4px upright stone post (x=6..9, y=17..25)
    for y in range(17, 26):
        c.set(6, y, "S0", "stone")
        c.set(7, y, "S7", "stone")
        c.set(8, y, "S4", "stone")
        c.set(9, y, "S0", "stone")
    # Flared stepped base (y=26..30, x=4..11)
    c.rect(5, 26, 10, 27, "S6", "stone")
    c.hline(5, 10, 26, "S7", "stone")
    c.vline(5, 26, 27, "S0", "stone")
    c.vline(10, 26, 27, "S0", "stone")
    c.rect(4, 28, 11, 30, "S5", "stone")
    c.hline(4, 11, 28, "S7", "stone")
    c.hline(5, 10, 29, "S4", "stone")
    c.hline(4, 11, 30, "S0", "stone")
    c.vline(4, 28, 30, "S0", "stone")
    c.vline(11, 28, 30, "S0", "stone")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(4, 11, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 11. temple_banner_pole (16x32, slender)
# ---------------------------------------------------------------------------
def draw_temple_banner_pole() -> PixelCanvas:
    c = PixelCanvas(16, 32)
    # Brass spear finial at top (y=2..5, x=7..8)
    c.set(7, 2, "O0", "wood")
    c.set(8, 2, "O0", "wood")
    c.set(7, 3, "Y2", "wood")
    c.set(8, 3, "Y1", "wood")
    c.set(6, 3, "O0", "wood")
    c.set(9, 3, "O0", "wood")
    c.set(7, 4, "Y1", "wood")
    c.set(8, 4, "O2", "wood")
    # Slender dark oak pole (3-4px wide: x=6..9, y=5..26)
    for y in range(5, 27):
        c.set(6, y, "O0", "wood")
        c.set(7, y, "O5", "wood")
        c.set(8, y, "O2", "wood")
        c.set(9, y, "O0", "wood")
    # Horizontal timber crossbar with gold end caps (y=6..8, x=2..13)
    c.rect(2, 6, 13, 8, "O4", "wood")
    c.hline(2, 13, 6, "O0", "wood")
    c.hline(3, 12, 7, "O6", "wood")
    c.hline(2, 13, 8, "O0", "wood")
    c.set(3, 7, "Y2", "wood")
    c.set(12, 7, "Y1", "wood")
    c.vline(2, 6, 8, "O0", "wood")
    c.vline(13, 6, 8, "O0", "wood")
    # Faded crimson sanctuary cloth banner hanging from crossbar (x=4..11, y=9..23)
    for y in range(9, 23):
        c.hline(4, 11, y, "R2", "crimson")
        c.set(4, y, "R0", "crimson")
        c.set(11, y, "R0", "crimson")
        c.set(5, y, "R3", "crimson")  # top-left cloth highlight
        c.set(10, y, "R1", "crimson")  # right fold shadow
    # Gold bottom trim + swallowtail notch at y=21..23
    c.hline(5, 10, 20, "Y1", "crimson")
    c.set(5, 21, "Y2", "crimson")
    c.set(6, 21, "Y1", "crimson")
    c.set(9, 21, "Y1", "crimson")
    c.set(10, 21, "Y1", "crimson")
    c.set(5, 22, "R0", "crimson")
    c.set(6, 22, "R0", "crimson")
    c.set(9, 22, "R0", "crimson")
    c.set(10, 22, "R0", "crimson")
    # Clear center notch to reveal pole behind swallowtail
    c.set(7, 21, "O5", "wood")
    c.set(8, 21, "O2", "wood")
    c.set(7, 22, "O5", "wood")
    c.set(8, 22, "O2", "wood")
    # Crisp antique gold diamond crest on banner front
    for cx, cy, cc in [(7, 12, "Y3"), (8, 12, "Y2"), (6, 13, "Y2"), (7, 13, "Y3"), (8, 13, "Y2"), (9, 13, "Y1"), (6, 14, "Y1"), (7, 14, "Y2"), (8, 14, "Y1"), (9, 14, "Y1"), (7, 15, "Y1"), (8, 15, "Y1")]:
        c.set(cx, cy, cc, "crimson")
    # Carved stone socket base (y=27..30, x=5..10)
    c.rect(5, 27, 10, 30, "S5", "stone")
    c.hline(5, 10, 27, "S0", "stone")
    c.hline(6, 9, 28, "S7", "stone")
    c.hline(6, 9, 29, "S4", "stone")
    c.hline(5, 10, 30, "S0", "stone")
    c.vline(5, 27, 30, "S0", "stone")
    c.vline(10, 27, 30, "S0", "stone")
    c.ensure_dark_outline("wood")
    c.add_ground_shadow(5, 10, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 12. beodeul_oak_tree (32x48, standing — ref_bd6_row_3x iconic oak!)
# ---------------------------------------------------------------------------
def draw_beodeul_oak_tree() -> PixelCanvas:
    c = PixelCanvas(32, 48)
    # Sturdy oak trunk & flared roots (y=30..45, x=8..23)
    for y in range(30, 45):
        if y < 40:
            x0, x1 = 12, 19
        elif y < 42:
            x0, x1 = 11, 20
        elif y < 44:
            x0, x1 = 9, 22
        else:
            x0, x1 = 8, 23
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1:
                c.set(x, y, "O0", "wood")
            else:
                rel = (x - x0) / max(1, x1 - x0)
                col = "O6" if rel < 0.25 else ("O4" if rel < 0.55 else ("O3" if rel < 0.8 else "O1"))
                c.set(x, y, col, "wood")
    # Vertical bark grooves & root notch
    for y in range(33, 44):
        c.set(14, y, "O2", "wood")
        c.set(17, y, "O1", "wood")
    c.hline(8, 23, 45, "O0", "wood")
    # Root arch notch at bottom center
    c.set(15, 45, (0, 0, 0, 0))
    c.set(16, 45, (0, 0, 0, 0))
    c.set(15, 44, "O0", "wood")
    c.set(16, 44, "O0", "wood")
    # Tiny lush grass tuft clinging to trunk base
    for gx, gy, gc in [(9, 44, "F3"), (10, 44, "F4"), (21, 44, "F3"), (22, 44, "F2")]:
        c.set(gx, gy, gc, "foliage")

    # Multi-lobed organic scalloped Beodeul oak canopy (y=2..33, x=2..29)
    lobes = [
        (14.5, 9.5, 7.5, 6.4),    # top-left crown puff
        (19.5, 11.2, 6.2, 5.4),   # top-right crown puff
        (8.6, 17.0, 6.8, 6.2),    # mid-left lobe
        (22.8, 17.5, 6.6, 6.0),   # mid-right lobe
        (9.5, 25.0, 7.2, 6.2),    # lower-left lobe
        (21.8, 25.2, 7.0, 5.8),   # lower-right lobe
        (15.5, 21.5, 9.2, 8.2),   # central core mass
    ]
    for lx, ly, rx, ry in lobes:
        c.ellipse(lx, ly, rx, ry, "F0", "foliage")
    for lx, ly, rx, ry in lobes:
        c.ellipse(lx, ly, rx - 1.1, ry - 1.1, "F1", "foliage")
    for lx, ly, rx, ry in [
        (14.0, 8.8, 6.2, 5.0),
        (19.0, 10.6, 5.0, 4.2),
        (8.4, 16.0, 5.5, 4.8),
        (22.0, 16.4, 5.2, 4.6),
        (9.2, 23.6, 5.8, 4.6),
        (20.6, 23.8, 5.2, 4.2),
        (15.0, 19.2, 7.2, 6.0),
    ]:
        c.ellipse(lx, ly, rx, ry, "F2", "foliage")
    for lx, ly, rx, ry in [
        (13.4, 7.8, 5.0, 3.8),
        (18.4, 9.8, 3.8, 3.0),
        (8.0, 14.8, 4.4, 3.4),
        (21.2, 15.2, 4.0, 3.2),
        (9.0, 22.0, 4.6, 3.2),
        (19.6, 22.2, 3.8, 2.8),
        (14.8, 16.6, 5.4, 3.8),
    ]:
        c.ellipse(lx, ly, rx, ry, "F3", "foliage")
    for lx, ly, rx, ry in [
        (12.6, 6.6, 3.6, 2.4),
        (17.6, 8.8, 2.4, 1.6),
        (7.4, 13.6, 3.0, 2.0),
        (20.4, 14.0, 2.4, 1.6),
        (8.4, 20.6, 3.0, 1.8),
        (14.2, 15.0, 3.4, 2.0),
    ]:
        c.ellipse(lx, ly, rx, ry, "F4", "foliage")
    for lx, ly, rx, ry in [(11.8, 6.0, 1.8, 1.1), (7.0, 13.0, 1.5, 1.0), (13.6, 14.4, 1.5, 0.9)]:
        c.ellipse(lx, ly, rx, ry, "F5", "foliage")
    for cx0, cy0, cx1 in [(6, 19, 11), (18, 19, 24), (11, 29, 20), (11, 13, 17)]:
        c.hline(cx0, cx1, cy0, "F1", "foliage")

    c.ensure_dark_outline("foliage")
    c.add_ground_shadow(6, 25, 45, 2)
    return c


# ---------------------------------------------------------------------------
# 13. flowering_bush_moss (16x16, standing — plump 14x13 filling tile!)
# ---------------------------------------------------------------------------
def draw_flowering_bush_moss() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    # Plump 3-lobe mossy flowering bush filling 14x12-13 px (x=1..14, y=2..14)
    lobes = [(7.5, 7.2, 6.6, 5.8), (4.6, 9.6, 4.2, 4.0), (10.6, 9.6, 4.2, 4.0)]
    for lx, ly, rx, ry in lobes:
        c.ellipse(lx, ly, rx, ry, "F0", "foliage")
    for lx, ly, rx, ry in lobes:
        c.ellipse(lx, ly, rx - 1.0, ry - 1.0, "F1", "foliage")
    for lx, ly, rx, ry in [(7.2, 6.6, 5.4, 4.4), (4.5, 8.8, 3.2, 2.8), (10.3, 8.8, 3.2, 2.8)]:
        c.ellipse(lx, ly, rx, ry, "F2", "foliage")
    for lx, ly, rx, ry in [(6.8, 5.6, 4.4, 3.2), (4.2, 7.8, 2.4, 2.0), (9.8, 7.8, 2.2, 1.8)]:
        c.ellipse(lx, ly, rx, ry, "F3", "foliage")
    c.ellipse(6.2, 4.6, 2.8, 1.8, "F4", "foliage")
    c.set(5, 4, "F5", "foliage")
    c.set(6, 4, "F5", "foliage")
    # 4 crisp small rose-pink & pale cream blossoms
    for bx, by in [(4, 8), (8, 5), (11, 9), (6, 10)]:
        c.set(bx, by, "K2", "foliage")
        c.set(bx + 1, by, "K1", "foliage")
        c.set(bx, by + 1, "K1", "foliage")
    c.ensure_dark_outline("foliage")
    c.add_ground_shadow(2, 13, 14, 2)
    return c


# ---------------------------------------------------------------------------
# 14. explorer_camp_tent (32x32, standing — ref_bd9_row_2x & ref_ezx_row_4x!)
# ---------------------------------------------------------------------------
def draw_explorer_camp_tent() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Front-facing A-frame explorer canvas tent (NO side walls!)
    # Lit horizontal ridge beam top (y=4..6, x=11..20)
    c.rect(11, 4, 20, 6, "O4", "wood")
    c.hline(11, 20, 4, "O0", "wood")
    c.hline(12, 19, 5, "O6", "wood")
    c.vline(11, 4, 6, "O0", "wood")
    c.vline(20, 4, 6, "O0", "wood")

    # Sloped triangular canvas roof walls spreading from ridge (x=11..20) to base (x=3..28)
    for y in range(6, 30):
        t = (y - 6) / 23.0
        x0 = int(round(11 - t * 8))
        x1 = int(round(20 + t * 8))
        for x in range(x0, x1 + 1):
            if x == x0 or x == x1 or y == 29:
                c.set(x, y, "O1", "canvas")
            else:
                # Sunlit left roof panel, central lit ridge panel, shaded right panel
                if x < 12:
                    col = "P4" if y < 22 else "P3"
                elif x <= 19:
                    col = "P5" if y < 14 else ("P4" if y < 17 else "P3")
                else:
                    col = "P2" if y < 20 else "P1"
                c.set(x, y, col, "canvas")
        # Crisp structural seam ridges running from ridge ends to ground corners
        lx_seam = int(round(12 - t * 5))
        rx_seam = int(round(19 + t * 5))
        if x0 < lx_seam < x1:
            c.set(lx_seam, y, "P2", "canvas")
        if x0 < rx_seam < x1:
            c.set(rx_seam, y, "P0", "canvas")

    # Dark triangular front doorway opening (y=17..29, x=11..20) + folded canvas flaps
    for y in range(17, 30):
        dt = (y - 17) / 12.0
        dx0 = int(round(15 - dt * 4.5))
        dx1 = int(round(16 + dt * 4.5))
        c.hline(dx0, dx1, y, "O0", "wood")
        if y >= 20:
            c.hline(dx0 + 1, dx1 - 1, y, "I0", "iron")
        # Rolled open entrance canvas flaps flanking doorway
        c.set(dx0 - 1, y, "P3", "canvas")
        c.set(dx1 + 1, y, "P1", "canvas")
    # Horizontal doorway lintel valance (y=15..17, x=11..20)
    c.hline(11, 20, 15, "P5", "canvas")
    c.hline(11, 20, 16, "P2", "canvas")
    c.hline(11, 20, 17, "O1", "canvas")
    # Corner wooden stakes at left/right bottom corners
    for sx in (2, 29):
        c.vline(sx, 27, 29, "O0", "wood")
        c.set(sx, 28, "O5", "wood")
    c.ensure_dark_outline("canvas")
    c.add_ground_shadow(2, 29, 29, 2)
    return c


# ---------------------------------------------------------------------------
# 15. treasure_chest_ancient (16x16, standing)
# ---------------------------------------------------------------------------
def draw_treasure_chest_ancient() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    # Chunky RM2000 dungeon chest (x=1..14, y=2..14 -> 14x13 px!)
    # Curved/beveled lit oak lid top band (y=2..6)
    c.rect(2, 2, 13, 3, "O6", "wood")
    c.hline(2, 13, 2, "O0", "wood")
    c.hline(3, 12, 3, "O7", "wood")
    c.rect(1, 4, 14, 6, "O5", "wood")
    c.hline(2, 13, 4, "O6", "wood")
    c.hline(2, 13, 5, "O4", "wood")
    c.hline(1, 14, 6, "O1", "wood")  # crisp lid seam shadow
    # Front oak box face (y=7..14)
    c.rect(1, 7, 14, 14, "O4", "wood")
    c.hline(2, 13, 7, "O5", "wood")
    c.hline(2, 13, 10, "O3", "wood")  # plank seam
    c.hline(2, 13, 13, "O2", "wood")
    # Outer dark wood outline
    c.vline(1, 4, 14, "O0", "wood")
    c.vline(14, 4, 14, "O0", "wood")
    c.hline(1, 14, 14, "O0", "wood")
    # Heavy rusted iron vertical binding straps (x=3..4 and x=11..12) with 1px highlights
    for sx in (3, 11):
        c.rect(sx, 3, sx + 1, 13, "I1", "iron")
        c.vline(sx, 3, 13, "I2", "iron")
        c.set(sx, 3, "I4", "iron")
        c.set(sx, 7, "I3", "iron")
        c.set(sx, 11, "I3", "iron")
    # Antique gold/brass center lock clasp (x=6..9, y=5..9)
    c.rect(6, 5, 9, 9, "Y1", "wood")
    c.hline(6, 9, 5, "O0", "wood")
    c.hline(7, 8, 6, "Y3", "wood")
    c.set(7, 7, "Y2", "wood")
    c.set(8, 7, "Y2", "wood")
    c.set(7, 8, "O0", "wood")  # keyhole
    c.set(8, 8, "Y1", "wood")
    c.hline(6, 9, 9, "O0", "wood")
    c.ensure_dark_outline("wood")
    c.add_ground_shadow(1, 14, 14, 2)
    return c


# ---------------------------------------------------------------------------
# 16. wooden_crates_supply (32x32, standing — ref_bd6 & ref_beodeul_props_best!)
# ---------------------------------------------------------------------------
def _draw_single_crate(c: PixelCanvas, x0: int, y0: int, w: int, h: int) -> None:
    x1 = x0 + w - 1
    y1 = y0 + h - 1
    top_h = 4
    # Outer dark wood outline
    c.rect(x0, y0, x1, y1, "O4", "wood")
    # Lit TOP lid band (y0+1 .. y0+top_h-1) — front + top band only, NO side walls!
    c.rect(x0 + 1, y0 + 1, x1 - 1, y0 + top_h - 1, "O6", "wood")
    c.hline(x0 + 1, x1 - 1, y0 + 1, "O7", "wood")
    c.hline(x0 + 1, x1 - 1, y0 + top_h, "O1", "wood")
    # Top plank vertical seam
    c.vline(x0 + w // 2, y0 + 1, y0 + top_h - 1, "O3", "wood")
    # Front crate recessed planks
    fy0 = y0 + top_h + 1
    c.rect(x0 + 2, fy0 + 1, x1 - 2, y1 - 2, "O3", "wood")
    for py in range(fy0 + 2, y1 - 1, 3):
        c.hline(x0 + 2, x1 - 2, py, "O2", "wood")
    # Front frame rails (top, bottom, left, right)
    c.hline(x0 + 1, x1 - 1, fy0, "O5", "wood")
    c.hline(x0 + 1, x1 - 1, y1 - 1, "O2", "wood")
    c.vline(x0 + 1, fy0, y1 - 1, "O5", "wood")
    c.vline(x1 - 1, fy0, y1 - 1, "O2", "wood")
    # Diagonal wooden brace bar across front panel
    span = min(x1 - x0 - 4, y1 - fy0 - 2)
    for i in range(span):
        bx = x0 + 2 + i
        by = fy0 + 1 + i
        c.set(bx, by, "O6", "wood")
        if bx + 1 <= x1 - 2:
            c.set(bx + 1, by, "O4", "wood")
    # Iron corner nail studs
    for nx, ny in [(x0 + 1, fy0), (x1 - 1, fy0), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)]:
        c.set(nx, ny, "I1", "iron")
    # Outer 1px dark outline
    c.hline(x0, x1, y0, "O0", "wood")
    c.hline(x0, x1, y1, "O0", "wood")
    c.vline(x0, y0, y1, "O0", "wood")
    c.vline(x1, y0, y1, "O0", "wood")


def draw_wooden_crates_supply() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Pyramid of 3 Beodeul crates: 2 on bottom (y=16..30), 1 centered on top (y=4..17)
    _draw_single_crate(c, 2, 16, 14, 15)
    _draw_single_crate(c, 16, 16, 14, 15)
    _draw_single_crate(c, 9, 4, 14, 14)
    c.ensure_dark_outline("wood")
    c.add_ground_shadow(2, 29, 30, 2)
    return c


# ---------------------------------------------------------------------------
# 17. wooden_bench_garden (32x16, topdown — ref_base_tables_row_4x!)
# ---------------------------------------------------------------------------
def draw_wooden_bench_garden() -> PixelCanvas:
    c = PixelCanvas(32, 16)
    # Top-down long garden bench: flat plank seat top = 9px out of 12px (75%!), front rim = 2px, stub legs = 2px
    # Outer top outline (x=1..30, y=2..12)
    c.rect(1, 2, 30, 12, "O5", "wood")
    c.hline(1, 30, 2, "O0", "wood")
    c.vline(1, 2, 12, "O0", "wood")
    c.vline(30, 2, 12, "O0", "wood")
    # 3 crisp horizontal oak seat planks (y=3..10)
    # Plank 1 (y=3..4)
    c.hline(2, 29, 3, "O7", "wood")
    c.hline(2, 29, 4, "O6", "wood")
    c.hline(2, 29, 5, "O2", "wood")  # dark plank seam
    # Plank 2 (y=6..7)
    c.hline(2, 29, 6, "O6", "wood")
    c.hline(2, 29, 7, "O5", "wood")
    c.hline(2, 29, 8, "O2", "wood")  # dark plank seam
    # Plank 3 (y=9..10)
    c.hline(2, 29, 9, "O5", "wood")
    c.hline(2, 29, 10, "O4", "wood")
    # Iron bolt/strap end pins on seat planks
    for bx in (4, 27):
        for by in (4, 7, 9):
            c.set(bx, by, "I1", "iron")
    # Front 2px edge rim (y=11..12)
    c.hline(2, 29, 11, "O3", "wood")
    c.hline(1, 30, 12, "O0", "wood")
    # Two short 2px stub legs (x=3..6 and x=25..28, y=13..14)
    for lx0 in (3, 25):
        c.rect(lx0, 13, lx0 + 3, 14, "O2", "wood")
        c.vline(lx0, 13, 14, "O0", "wood")
        c.vline(lx0 + 3, 13, 14, "O0", "wood")
        c.set(lx0 + 1, 13, "O4", "wood")
        c.hline(lx0, lx0 + 3, 14, "O0", "wood")
    c.ensure_dark_outline("wood")
    c.add_ground_shadow(2, 29, 14, 2)
    return c


# ---------------------------------------------------------------------------
# 18. stone_offering_table (32x16, topdown — empty carved limestone slab!)
# ---------------------------------------------------------------------------
def draw_stone_offering_table() -> PixelCanvas:
    c = PixelCanvas(32, 16)
    # Top-down carved stone offering table: flat empty top = 9px of 12px (75%), front lip = 2px, stub pedestals = 2px
    c.rect(1, 2, 30, 12, "S5", "stone")
    c.hline(1, 30, 2, "S0", "stone")
    c.vline(1, 2, 12, "S0", "stone")
    c.vline(30, 2, 12, "S0", "stone")
    # Top sunlit limestone bevel & carved recessed offering panel (y=3..10)
    c.hline(2, 29, 3, "S7", "stone")
    c.vline(2, 3, 10, "S6", "stone")
    c.vline(29, 3, 10, "S4", "stone")
    c.rect(4, 4, 27, 9, "S4", "stone")
    c.hline(4, 27, 4, "S3", "stone")
    c.vline(4, 4, 9, "S3", "stone")
    c.rect(5, 5, 26, 8, "S6", "stone")
    c.hline(5, 26, 5, "S7", "stone")
    c.hline(4, 27, 9, "S7", "stone")
    # Subtle inlaid cyan-slate ancient rune seal flush in table center (empty top!)
    for rx, ry in [(13, 6), (18, 6), (14, 7), (15, 7), (16, 7), (17, 7), (13, 8), (18, 8)]:
        c.set(rx, ry, "W4", "stone")
    c.set(15, 6, "C3", "stone")
    c.set(16, 6, "C3", "stone")
    c.set(15, 8, "C3", "stone")
    c.set(16, 8, "C3", "stone")
    # Narrow 2px beveled front rim (y=11..12)
    c.hline(2, 29, 11, "S3", "stone")
    c.hline(1, 30, 12, "S0", "stone")
    # Short 2px stone pedestal stub legs (x=4..8 and x=23..27, y=13..14)
    for lx0 in (4, 23):
        c.rect(lx0, 13, lx0 + 4, 14, "S3", "stone")
        c.set(lx0 + 1, 13, "S5", "stone")
        c.vline(lx0, 13, 14, "S0", "stone")
        c.vline(lx0 + 4, 13, 14, "S0", "stone")
        c.hline(lx0, lx0 + 4, 14, "S0", "stone")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(2, 29, 14, 2)
    return c


# ---------------------------------------------------------------------------
# 19. mossy_boulder (16x16, standing)
# ---------------------------------------------------------------------------
def draw_mossy_boulder() -> PixelCanvas:
    c = PixelCanvas(16, 16)
    rows = [
        "....000000......",
        "..0077766500....",
        ".077766655430...",
        ".0766655544320..",
        "066655544432210.",
        "065554443332210.",
        "055444333322110.",
        "044433322221110.",
        "033332222111110.",
        ".0222211111110..",
        "..00000000000...",
    ]
    legend = {
        "0": ("S0", "stone"),
        "1": ("S1", "stone"),
        "2": ("S2", "stone"),
        "3": ("S3", "stone"),
        "4": ("S4", "stone"),
        "5": ("S5", "stone"),
        "6": ("S6", "stone"),
        "7": ("S7", "stone"),
    }
    c.draw_grid(rows, legend, ox=0, oy=3)
    # Sunlit specular stone facet + lush green moss draped across upper-left shoulder
    c.set(6, 5, "S8", "stone")
    c.set(7, 5, "S8", "stone")
    for mx, my, mc in [
        (3, 4, "F0"), (4, 4, "F4"), (5, 4, "F4"), (6, 4, "F3"),
        (2, 5, "F0"), (3, 5, "F3"), (4, 5, "F4"), (5, 5, "F3"), (6, 5, "F2"),
        (2, 6, "F2"), (3, 6, "F3"), (4, 6, "F2"), (5, 6, "F1"),
        (3, 7, "F1"), (4, 7, "F1"),
    ]:
        c.set(mx, my, mc, "foliage")
    c.ensure_dark_outline("stone")
    c.add_ground_shadow(2, 13, 13, 2)
    return c


# ---------------------------------------------------------------------------
# 20. wooden_notice_board (32x32, standing — ref_bd9_row_2x notice board!)
# ---------------------------------------------------------------------------
def draw_wooden_notice_board() -> PixelCanvas:
    c = PixelCanvas(32, 32)
    # Two vertical oak legs with base blocks (x=7..9 and x=22..24, y=21..30)
    for lx0 in (7, 22):
        c.rect(lx0, 21, lx0 + 2, 29, "O4", "wood")
        c.vline(lx0, 21, 29, "O0", "wood")
        c.vline(lx0 + 1, 21, 29, "O5", "wood")
        c.vline(lx0 + 2, 21, 29, "O0", "wood")
        # Foot block
        c.rect(lx0 - 1, 28, lx0 + 3, 30, "O3", "wood")
        c.hline(lx0 - 1, lx0 + 3, 28, "O5", "wood")
        c.hline(lx0 - 1, lx0 + 3, 30, "O0", "wood")
        c.vline(lx0 - 1, 28, 30, "O0", "wood")
        c.vline(lx0 + 3, 28, 30, "O0", "wood")

    # Main timber signboard frame (x=5..26, y=9..22)
    c.rect(5, 9, 26, 22, "O4", "wood")
    c.rect(7, 11, 24, 20, "O2", "wood")
    # Horizontal plank backing inside board
    for py in (14, 17):
        c.hline(7, 24, py, "O1", "wood")
    c.hline(6, 25, 10, "O6", "wood")
    c.hline(6, 25, 21, "O3", "wood")
    c.hline(5, 26, 22, "O0", "wood")
    c.vline(5, 9, 22, "O0", "wood")
    c.vline(26, 9, 22, "O0", "wood")

    # Three crisp pale parchment notices pinned with red/dark tacks!
    notices = [(8, 12, 12, 18), (14, 12, 18, 19), (20, 13, 23, 18)]
    for nx0, ny0, nx1, ny1 in notices:
        c.rect(nx0, ny0, nx1, ny1, "P5", "canvas")
        c.hline(nx0, nx1, ny1, "P2", "canvas")
        c.vline(nx1, ny0, ny1, "P3", "canvas")
        # Tiny ink lines
        c.hline(nx0 + 1, nx1 - 1, ny0 + 2, "P1", "canvas")
        if ny1 - ny0 >= 5:
            c.hline(nx0 + 1, nx1 - 2, ny0 + 4, "P1", "canvas")
        # Crimson wax pin at top center
        c.set((nx0 + nx1) // 2, ny0, "R3", "crimson")

    # Sloped wooden overhang roof cap (top band y=3..9, x=3..28)
    for dy, (x0, x1, col) in enumerate([
        (5, 26, "O0"),
        (4, 27, "O7"),
        (4, 27, "O6"),
        (3, 28, "O5"),
        (3, 28, "O4"),
        (3, 28, "O1"),
    ]):
        y = 3 + dy
        c.hline(x0, x1, y, col, "wood")
        c.set(x0, y, "O0", "wood")
        c.set(x1, y, "O0", "wood")
        if 1 <= dy <= 4:
            for sx in range(x0 + 3, x1 - 1, 4):
                c.set(sx, y, "O2", "wood")
    c.ensure_dark_outline("wood")
    c.add_ground_shadow(6, 25, 30, 2)
    return c


OBJECT_SPECS: List[ObjectSpec] = [
    ObjectSpec(
        file="ruin_shrine_gate.png",
        id="ruins-bd-shrine-gate",
        name_en="Ancient Ruin Shrine Gate",
        name_ko="고대 유적 신전 문",
        canvas=(48, 48),
        tiles="3x3",
        camera="standing",
        facing="down",
        description="Mossy Beodeul limestone sanctuary entrance with sloped cobalt-slate shingle roof terrace, flanking stone pilasters, glowing cyan rune keystone, and a 24px-tall dark arched doorway.",
        tags=["ruins", "shrine", "gate", "archway", "cobalt-roof", "moss", "beodeul", "sanctuary"],
        note_summary="48x48 structure; 3/4 cobalt-slate roof cap + 24px tall dark arch + cyan keystone + hanging moss.",
        draw_fn=draw_ruin_shrine_gate,
    ),
    ObjectSpec(
        file="crystal_rune_altar.png",
        id="ruins-bd-crystal-altar",
        name_en="Crystal Rune Altar",
        name_ko="수정 룬 제단",
        canvas=(32, 32),
        tiles="2x2",
        camera="standing",
        facing="down",
        description="Stepped cool limestone sanctuary altar with carved glowing front glyph and a large faceted bright cyan rune crystal perched atop a dark slate cradle.",
        tags=["altar", "crystal", "rune", "cyan", "stone", "sanctuary", "beodeul"],
        note_summary="32x32 standing; stepped stone base + lit top slab + faceted glowing cyan crystal + side shards.",
        draw_fn=draw_crystal_rune_altar,
    ),
    ObjectSpec(
        file="stone_guardian_statue.png",
        id="ruins-bd-guardian-statue",
        name_en="Stone Guardian Statue",
        name_ko="석조 수호자 석상",
        canvas=(16, 32),
        tiles="1x2",
        camera="standing",
        facing="down",
        description="Weathered limestone sentinel knight statue standing on a stepped plinth holding a carved shield with a small cyan crest and moss on its shoulder.",
        tags=["statue", "guardian", "knight", "stone", "ruins", "plinth", "beodeul"],
        note_summary="16x32 standing; helmeted stone knight holding shield on stepped plinth with shoulder moss.",
        draw_fn=draw_stone_guardian_statue,
    ),
    ObjectSpec(
        file="stone_pillar_intact.png",
        id="ruins-bd-pillar-intact",
        name_en="Intact Fluted Stone Pillar",
        name_ko="온전한 석조 기둥",
        canvas=(16, 32),
        tiles="1x2",
        camera="standing",
        facing="down",
        description="Tall intact fluted ancient limestone column with a sunlit square capital top band, horizontal drum joints, small moss accent, and stepped plinth base.",
        tags=["pillar", "column", "stone", "fluted", "ruins", "architecture", "beodeul"],
        note_summary="16x32 standing; lit square capital top band + vertical fluted limestone shaft + stepped plinth.",
        draw_fn=draw_stone_pillar_intact,
    ),
    ObjectSpec(
        file="stone_pillar_broken.png",
        id="ruins-bd-pillar-broken",
        name_en="Broken Stone Pillar",
        name_ko="부러진 석조 기둥",
        canvas=(16, 32),
        tiles="1x2",
        camera="standing",
        facing="down",
        description="Fractured fluted limestone ruin column snapped diagonally at mid-height with bright exposed stone break, creeping moss, and a fallen stone chunk beside its plinth.",
        tags=["pillar", "broken", "ruins", "stone", "moss", "rubble", "beodeul"],
        note_summary="16x32 standing; diagonal fractured column exposing bright stone top + moss + base rubble block.",
        draw_fn=draw_stone_pillar_broken,
    ),
    ObjectSpec(
        file="carved_rune_stele.png",
        id="ruins-bd-rune-stele",
        name_en="Carved Rune Stele",
        name_ko="고대 룬 비석",
        canvas=(32, 32),
        tiles="2x2",
        camera="standing",
        facing="down",
        description="Monumental rounded-arch weathered stone tablet on a stepped plinth displaying a lit top bevel, cyan rune crest, inscribed glyph rows, and mossy base.",
        tags=["stele", "tablet", "monument", "rune", "stone", "ruins", "beodeul"],
        note_summary="32x32 standing; arched limestone tablet with lit top rim, cyan crest, glyph rows, and moss plinth.",
        draw_fn=draw_carved_rune_stele,
    ),
    ObjectSpec(
        file="sanctuary_fountain_round.png",
        id="ruins-bd-fountain-round",
        name_en="Round Sanctuary Fountain",
        name_ko="성소 원형 분수",
        canvas=(32, 32),
        tiles="2x2",
        camera="topdown",
        facing="down",
        description="Top-down circular carved limestone fountain basin filled with deep sea-teal water, concentric bright cyan-white foam ripples, and a central stone spout.",
        tags=["fountain", "water", "basin", "topdown", "stone", "sanctuary", "beodeul"],
        note_summary="32x32 topdown; >=80% flat basin top, deep teal water + bright cyan foam rings + central spout.",
        draw_fn=draw_sanctuary_fountain_round,
    ),
    ObjectSpec(
        file="mossy_stone_well.png",
        id="ruins-bd-mossy-well",
        name_en="Mossy Stone Well",
        name_ko="이끼 낀 돌우물",
        canvas=(32, 32),
        tiles="2x2",
        camera="standing",
        facing="down",
        description="Beodeul circular ashlar stone well holding dark teal water with foam glints, flanked by oak windlass posts, iron crank, thick tan rope, hanging bucket, and base moss.",
        tags=["well", "stone", "water", "bucket", "wood", "moss", "beodeul"],
        note_summary="32x32 standing; curved stone well + dark teal water + oak crossbeam + crank + 2px rope & bucket.",
        draw_fn=draw_mossy_stone_well,
    ),
    ObjectSpec(
        file="iron_brazier_lit.png",
        id="ruins-bd-iron-brazier",
        name_en="Lit Iron Fire Brazier",
        name_ko="불타는 철제 화로",
        canvas=(16, 32),
        tiles="1x2",
        camera="standing",
        facing="down",
        description="Wrought-iron temple tripod brazier with a sunlit metal bowl rim holding glowing coals and a bright yellow-to-crimson stylized flame.",
        tags=["brazier", "fire", "iron", "light", "temple", "ruins", "beodeul"],
        note_summary="16x32 standing; dark iron tripod bowl with glowing coals and crisp yellow-orange-crimson flame.",
        draw_fn=draw_iron_brazier_lit,
    ),
    ObjectSpec(
        file="stone_garden_lantern.png",
        id="ruins-bd-garden-lantern",
        name_en="Stone Garden Lantern",
        name_ko="석조 정원 석등",
        canvas=(16, 32),
        tiles="1x2",
        camera="slender",
        facing="down",
        description="Slender carved Beodeul stone sanctuary lantern with stepped base, narrow 4px pillar shaft, warm amber glowing firebox window, and pagoda cap.",
        tags=["lantern", "stone", "slender", "light", "garden", "sanctuary", "beodeul"],
        note_summary="16x32 slender; 4px stone shaft + stepped base + warm amber firebox + pagoda cap finial.",
        draw_fn=draw_stone_garden_lantern,
    ),
    ObjectSpec(
        file="temple_banner_pole.png",
        id="ruins-bd-banner-pole",
        name_en="Temple Banner Pole",
        name_ko="신전 깃발 기둥",
        canvas=(16, 32),
        tiles="1x2",
        camera="slender",
        facing="down",
        description="Tall slender dark oak sanctuary standard pole anchored in a stone socket, flying a swallowtail faded crimson banner trimmed with an antique gold crest.",
        tags=["banner", "pole", "slender", "crimson", "gold", "temple", "beodeul"],
        note_summary="16x32 slender; 4px pole in stone socket + crossbar + crimson swallowtail banner with gold crest.",
        draw_fn=draw_temple_banner_pole,
    ),
    ObjectSpec(
        file="beodeul_oak_tree.png",
        id="ruins-bd-oak-tree",
        name_en="Weathered Beodeul Oak Tree",
        name_ko="버들항 참나무",
        canvas=(32, 48),
        tiles="2x3",
        camera="standing",
        facing="down",
        description="Lush Beodeul oak tree with five distinct rounded olive-and-leaf-green canopy clusters, dark forest outline, and a gnarled oak trunk with flared roots.",
        tags=["tree", "oak", "foliage", "nature", "canopy", "beodeul"],
        note_summary="32x48 standing; multi-lobed lush Beodeul oak canopy + gnarled brown trunk with flared roots.",
        draw_fn=draw_beodeul_oak_tree,
    ),
    ObjectSpec(
        file="flowering_bush_moss.png",
        id="ruins-bd-flowering-bush",
        name_en="Flowering Mossy Bush",
        name_ko="꽃 핀 이끼 덤불",
        canvas=(16, 16),
        tiles="1x1",
        camera="standing",
        facing="down",
        description="Plump rounded mossy shrub filling the tile with layered top-left lit green leaf lobes and three small pale rose-pink blossoms.",
        tags=["bush", "shrub", "flowers", "moss", "foliage", "nature", "beodeul"],
        note_summary="16x16 standing; plump 3-lobe mossy bush with 3 small rose-pink blossom clusters.",
        draw_fn=draw_flowering_bush_moss,
    ),
    ObjectSpec(
        file="explorer_camp_tent.png",
        id="ruins-bd-camp-tent",
        name_en="Explorer Camp Tent",
        name_ko="탐험가 야영 천막",
        canvas=(32, 32),
        tiles="2x2",
        camera="standing",
        facing="down",
        description="Weathered faded-canvas A-frame expedition tent facing forward with a wooden ridge beam, sunlit left slope, shaded right slope, corner pegs, and open dark flap doorway.",
        tags=["tent", "camp", "canvas", "explorer", "shelter", "beodeul"],
        note_summary="32x32 standing; front-facing A-frame canvas tent with ridge pole, open flap, and corner stakes.",
        draw_fn=draw_explorer_camp_tent,
    ),
    ObjectSpec(
        file="treasure_chest_ancient.png",
        id="ruins-bd-treasure-chest",
        name_en="Ancient Treasure Chest",
        name_ko="고대 보물상자",
        canvas=(16, 16),
        tiles="1x1",
        camera="standing",
        facing="down",
        description="Chunky ancient oak dungeon treasure chest with a sunlit curved top lid band, heavy dark iron straps with bright highlights, and an antique brass center lock.",
        tags=["chest", "treasure", "loot", "oak", "iron", "dungeon", "beodeul"],
        note_summary="16x16 standing; chunky oak chest with lit lid top band, twin iron straps, and brass keyhole clasp.",
        draw_fn=draw_treasure_chest_ancient,
    ),
    ObjectSpec(
        file="wooden_crates_supply.png",
        id="ruins-bd-wooden-crates",
        name_en="Wooden Supply Crates Stack",
        name_ko="나무 보급 상자 더미",
        canvas=(32, 32),
        tiles="2x2",
        camera="standing",
        facing="down",
        description="Pyramid stack of three Beodeul expedition oak crates showing lit top plank lids, front diagonal cross-braces, dark plank seams, and iron corner studs.",
        tags=["crates", "wood", "supply", "stack", "camp", "harbour", "beodeul"],
        note_summary="32x32 standing; 2+1 pyramid stack of oak crates with lit top bands, diagonal braces, and iron nails.",
        draw_fn=draw_wooden_crates_supply,
    ),
    ObjectSpec(
        file="wooden_bench_garden.png",
        id="ruins-bd-garden-bench",
        name_en="Wooden Garden Bench",
        name_ko="나무 정원 벤치",
        canvas=(32, 16),
        tiles="2x1",
        camera="topdown",
        facing="down",
        description="Top-down long weathered oak sanctuary bench displaying three sunlit horizontal seat planks with iron end bolts, a 2px front rim, and short stub legs.",
        tags=["bench", "seat", "wood", "topdown", "garden", "courtyard", "beodeul"],
        note_summary="32x16 topdown; 75%+ flat 3-plank oak top with end bolts, 2px front lip, and short stub legs.",
        draw_fn=draw_wooden_bench_garden,
    ),
    ObjectSpec(
        file="stone_offering_table.png",
        id="ruins-bd-offering-table",
        name_en="Stone Offering Table",
        name_ko="석조 봉헌 탁자",
        canvas=(32, 16),
        tiles="2x1",
        camera="topdown",
        facing="down",
        description="Top-down empty rectangular carved limestone offering slab with sunlit bevel rim, recessed border groove, subtle inlaid cyan rune seal, and short stone pedestal legs.",
        tags=["table", "offering", "stone", "topdown", "rune", "sanctuary", "beodeul"],
        note_summary="32x16 topdown; 75%+ flat empty carved limestone top with rune inlay, 2px rim, and stub pedestals.",
        draw_fn=draw_stone_offering_table,
    ),
    ObjectSpec(
        file="mossy_boulder.png",
        id="ruins-bd-mossy-boulder",
        name_en="Mossy Stone Boulder",
        name_ko="이끼 바위",
        canvas=(16, 16),
        tiles="1x1",
        camera="standing",
        facing="down",
        description="Chunky faceted weathered limestone boulder lit from top-left with cool stone underside shading and a lush green moss cap draped over its left shoulder.",
        tags=["boulder", "rock", "stone", "moss", "nature", "ruins", "beodeul"],
        note_summary="16x16 standing; faceted grey limestone boulder with lush moss cap draped over top-left shoulder.",
        draw_fn=draw_mossy_boulder,
    ),
    ObjectSpec(
        file="wooden_notice_board.png",
        id="ruins-bd-notice-board",
        name_en="Wooden Shrine Notice Board",
        name_ko="나무 성소 게시판",
        canvas=(32, 32),
        tiles="2x2",
        camera="standing",
        facing="down",
        description="Beodeul timber sanctuary notice board with a sloped wooden shingle roof cap, sturdy oak posts with foot blocks, and three pale parchment notices pinned with red wax tacks.",
        tags=["notice-board", "sign", "wood", "parchment", "shrine", "camp", "beodeul"],
        note_summary="32x32 standing; timber roof cap + oak frame holding 3 parchment notices with red pins + sturdy posts.",
        draw_fn=draw_wooden_notice_board,
    ),
]


def build_all_objects(out_dir: Path) -> Tuple[Dict[str, Image.Image], Dict[str, Tuple[int, int]]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    images: Dict[str, Image.Image] = {}
    bboxes: Dict[str, Tuple[int, int]] = {}
    for spec in OBJECT_SPECS:
        canvas = spec.draw_fn()
        assert (canvas.w, canvas.h) == spec.canvas, f"{spec.file}: expected {spec.canvas}, got {(canvas.w, canvas.h)}"
        canvas.align_bottom_center(bottom_pad=1 if canvas.h >= 32 else 1)
        bbox = canvas.opaque_bbox()
        assert bbox is not None, f"{spec.file} is empty"
        ow = bbox[2] - bbox[0] + 1
        oh = bbox[3] - bbox[1] + 1
        bboxes[spec.file] = (ow, oh)
        img = canvas.to_image()
        img.save(out_dir / spec.file)
        images[spec.file] = img
    return images, bboxes
