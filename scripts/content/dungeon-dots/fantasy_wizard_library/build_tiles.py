#!/usr/bin/env python3
"""Build 26 clean 16x16 RM2000 Beodeul Wizard Library interior tiles."""

from __future__ import annotations

from pathlib import Path
from palette import (
    OUT_DIR,
    PixelCanvas,
    ST_O, ST0, ST1, ST2, ST3, ST4, ST5, ST6,
    SL_O, SL0, SL1, SL2, SL3, SL4,
    DO_O, DO0, DO1, DO2, DO3, DO4,
    OK_O, OK0, OK1, OK2, OK3, OK4, OK5,
    IR_O, IR0, IR1, IR2, IR3,
    GD_O, GD0, GD1, GD2, GD3, GD4,
    PA_O, PA0, PA1, PA2, PA3,
    RD_O, RD0, RD1, RD2, RD3,
    TL_O, TL0, TL1, TL2, TL3, TL4,
    BL_O, BL0, BL1, BL2,
)

TILES_DIR = OUT_DIR / "tiles"


def tile_floor_stone_a() -> PixelCanvas:
    """Calm cool grey dressed flagstones (low contrast, spike ratio <= 0.08)."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, ST2)
    # Subtle flagstone blocks: 2 horizontal courses
    # Subtle mortar joints using adjacent ramp step (ST1) — low luma delta so floor stays calm
    c.hline(0, 15, 7, ST1)
    c.hline(0, 15, 15, ST1)
    c.vline(7, 0, 6, ST1)
    c.vline(15, 0, 6, ST1)
    c.vline(3, 8, 14, ST1)
    c.vline(11, 8, 14, ST1)
    # Soft top-left highlight (ST3) — one ramp step brighter than ST2
    c.hline(1, 5, 1, ST3)
    c.hline(9, 13, 1, ST3)
    c.hline(5, 9, 9, ST3)
    c.hline(13, 15, 9, ST3)
    # Soft face variation
    c.rect(1, 2, 5, 5, ST2)
    c.rect(9, 2, 13, 5, ST3)
    c.rect(5, 10, 9, 13, ST2)
    c.rect(13, 10, 14, 13, ST3)
    return c


def tile_floor_stone_b() -> PixelCanvas:
    """Variant cool grey flagstone for organic tiling."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, ST2)
    c.hline(0, 15, 7, ST1)
    c.hline(0, 15, 15, ST1)
    c.vline(5, 0, 6, ST1)
    c.vline(13, 0, 6, ST1)
    c.vline(1, 8, 14, ST1)
    c.vline(9, 8, 14, ST1)
    c.hline(1, 4, 1, ST3)
    c.hline(7, 11, 1, ST3)
    c.hline(3, 7, 9, ST3)
    c.hline(11, 14, 9, ST3)
    c.rect(7, 2, 11, 5, ST2)
    c.rect(3, 10, 7, 13, ST3)
    return c


def tile_floor_stone_border() -> PixelCanvas:
    """Dressed grey stone trim strip for zone transitions and archways."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, ST3)
    c.hline(0, 15, 0, ST1)
    c.hline(0, 15, 15, ST1)
    c.hline(0, 15, 1, ST4)
    c.vline(7, 1, 14, ST2)
    c.vline(15, 1, 14, ST2)
    c.rect(1, 3, 6, 13, ST2)
    c.rect(8, 3, 14, 13, ST2)
    c.hline(1, 6, 2, ST3)
    c.hline(8, 14, 2, ST3)
    return c


def tile_floor_oak_plank_a() -> PixelCanvas:
    """Calm warm weathered oak library floorboards."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, OK1)
    # 4 horizontal planks (each 4px tall), gentle 1-step contrast
    for y in (0, 4, 8, 12):
        c.hline(0, 15, y, OK2)
        c.rect(0, y + 1, 15, y + 2, OK1)
        c.hline(0, 15, y + 3, OK0)
    # Staggered vertical plank end joints
    c.vline(5, 0, 3, OK0)
    c.vline(12, 4, 7, OK0)
    c.vline(3, 8, 11, OK0)
    c.vline(10, 12, 15, OK0)
    # Very gentle wood grain streaks (1-step OK2)
    c.hline(7, 10, 1, OK2)
    c.hline(2, 5, 5, OK2)
    c.hline(8, 12, 9, OK2)
    c.hline(1, 4, 13, OK2)
    return c


def tile_floor_oak_plank_b() -> PixelCanvas:
    """Staggered weathered oak floorboard variant."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, OK1)
    for y in (0, 4, 8, 12):
        c.hline(0, 15, y, OK2)
        c.rect(0, y + 1, 15, y + 2, OK1)
        c.hline(0, 15, y + 3, OK0)
    c.vline(11, 0, 3, OK0)
    c.vline(4, 4, 7, OK0)
    c.vline(13, 8, 11, OK0)
    c.vline(6, 12, 15, OK0)
    c.hline(2, 6, 1, OK2)
    c.hline(9, 13, 5, OK2)
    c.hline(4, 8, 9, OK2)
    c.hline(11, 14, 13, OK2)
    return c


def tile_floor_vault_slate_a() -> PixelCanvas:
    """Checkered dark slate alchemy vault floor (cool, calm contrast)."""
    c = PixelCanvas(16, 16)
    # 8x8 quiet slate checkerboard (SL1 vs SL2, seams SL0)
    c.rect(0, 0, 7, 7, SL2)
    c.rect(8, 8, 15, 15, SL2)
    c.rect(8, 0, 15, 7, SL1)
    c.rect(0, 8, 7, 15, SL1)
    # Subtle seams
    c.hline(0, 15, 7, SL0)
    c.hline(0, 15, 15, SL0)
    c.vline(7, 0, 15, SL0)
    c.vline(15, 0, 15, SL0)
    # Soft bevel highlights on lighter checks
    c.hline(1, 5, 1, SL3)
    c.hline(9, 13, 9, SL3)
    return c


def tile_floor_vault_slate_b() -> PixelCanvas:
    """Slightly weathered variant of dark slate alchemy vault floor."""
    c = tile_floor_vault_slate_a()
    c.hline(10, 13, 2, SL2)
    c.hline(2, 5, 10, SL2)
    return c


def tile_carpet_center() -> PixelCanvas:
    """Calm woven deep crimson carpet interior."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, RD1)
    # Quiet tone-on-tone diamond motif (RD0 / RD2 — low contrast so it stays calm)
    for d in range(4):
        c.set(8 - d, 4 + d, RD0)
        c.set(8 + d, 4 + d, RD0)
        c.set(8 - d, 11 - d, RD0)
        c.set(8 + d, 11 - d, RD0)
    c.rect(7, 7, 9, 8, RD2)
    return c


def _carpet_base_with_edges(n: bool = False, s: bool = False, w: bool = False, e: bool = False) -> PixelCanvas:
    """Build crimson carpet tile with antique gold border on requested sides (seamless on any floor)."""
    c = tile_carpet_center()
    if n:
        c.hline(0, 15, 0, RD_O)
        c.hline(0, 15, 1, GD1)
        c.hline(0, 15, 2, GD2)
        c.hline(0, 15, 3, RD0)
    if s:
        c.hline(0, 15, 15, RD_O)
        c.hline(0, 15, 14, GD1)
        c.hline(0, 15, 13, GD2)
        c.hline(0, 15, 12, RD0)
    if w:
        c.vline(0, 0, 15, RD_O)
        c.vline(1, 0, 15, GD1)
        c.vline(2, 0, 15, GD2)
        c.vline(3, 0, 15, RD0)
    if e:
        c.vline(15, 0, 15, RD_O)
        c.vline(14, 0, 15, GD1)
        c.vline(13, 0, 15, GD2)
        c.vline(12, 0, 15, RD0)
    # Clean corner miter & gold corner medallion
    if n and w:
        c.set(0, 0, RD_O); c.rect(1, 1, 2, 2, GD3); c.set(3, 3, GD1)
    if n and e:
        c.set(15, 0, RD_O); c.rect(13, 1, 14, 2, GD3); c.set(12, 3, GD1)
    if s and w:
        c.set(0, 15, RD_O); c.rect(1, 13, 2, 14, GD3); c.set(3, 12, GD1)
    if s and e:
        c.set(15, 15, RD_O); c.rect(13, 13, 14, 14, GD3); c.set(12, 12, GD1)
    return c


def tile_wall_cap_top() -> PixelCanvas:
    """Dark RM2000 dungeon wall roof cap with subtle cool stone coping."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, SL_O)
    c.rect(1, 1, 14, 14, SL0)
    c.hline(1, 14, 1, SL1)
    c.hline(1, 14, 14, SL_O)
    return c


def tile_wall_stone_upper() -> PixelCanvas:
    """Clean dressed cool grey stone masonry blocks (inspired by ref_bd9_row_2x.png)."""
    c = PixelCanvas(16, 16)
    # Dark top coping shadow + crisp ashlar stone courses
    c.rect(0, 0, 15, 15, ST0)
    # Top cornice band
    c.hline(0, 15, 0, ST5)
    c.hline(0, 15, 1, ST4)
    c.hline(0, 15, 2, ST1)
    # Course 1 (y=3..8): two blocks
    for bx0, bx1, col in ((0, 7, ST4), (9, 15, ST3)):
        c.rect(bx0, 3, bx1, 7, col)
        c.hline(bx0, bx1, 3, ST5)
        c.hline(bx0, bx1, 7, ST2)
        c.vline(bx0, 3, 7, ST5 if col == ST4 else ST4)
    # Course 2 (y=9..14): staggered blocks
    for bx0, bx1, col in ((0, 3, ST3), (5, 12, ST4), (14, 15, ST3)):
        c.rect(bx0, 9, bx1, 14, col)
        c.hline(bx0, bx1, 9, ST5 if col == ST4 else ST4)
        c.hline(bx0, bx1, 14, ST2)
        if bx0 > 0:
            c.vline(bx0, 9, 14, ST5 if col == ST4 else ST4)
    c.hline(0, 15, 15, ST0)
    return c


def tile_wall_stone_lower() -> PixelCanvas:
    """Lower stone masonry course with darker base molding meeting the floor."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, ST0)
    # Course 3 (y=0..5)
    for bx0, bx1, col in ((0, 6, ST3), (8, 15, ST4)):
        c.rect(bx0, 0, bx1, 5, col)
        c.hline(bx0, bx1, 0, ST4 if col == ST3 else ST5)
        c.hline(bx0, bx1, 5, ST2)
    # Mid dado molding line
    c.hline(0, 15, 6, ST0)
    c.hline(0, 15, 7, ST4)
    # Lower heavier stone plinth (y=8..13)
    for bx0, bx1, col in ((0, 4, ST2), (6, 13, ST3), (15, 15, ST2)):
        c.rect(bx0, 8, bx1, 13, col)
        c.hline(bx0, bx1, 8, ST4 if col == ST3 else ST3)
        c.hline(bx0, bx1, 13, ST1)
    # Floor contact shadow line
    c.hline(0, 15, 14, ST1)
    c.hline(0, 15, 15, ST_O)
    return c


def tile_wall_timber_upper() -> PixelCanvas:
    """Half-timber & muted stone-plaster library wall upper (calm Beodeul timber framing)."""
    c = PixelCanvas(16, 16)
    # Muted cool-warm stone plaster framed cleanly by dark oak posts & cross-rails (no busy diagonals)
    c.rect(0, 0, 15, 15, ST4)
    # Top cornice timber beam
    c.hline(0, 15, 0, DO3)
    c.hline(0, 15, 1, DO1)
    c.hline(0, 15, 2, DO_O)
    # Vertical oak posts at left/right edges
    c.rect(0, 3, 1, 13, DO1)
    c.vline(0, 3, 13, DO2)
    c.vline(2, 3, 13, DO_O)
    c.rect(14, 3, 15, 13, DO1)
    c.vline(14, 3, 13, DO2)
    c.vline(13, 3, 13, DO_O)
    # Calm recessed plaster panels separated by horizontal mid-beam
    c.rect(3, 3, 12, 7, PA1)
    c.hline(3, 12, 3, PA0)
    c.hline(3, 12, 4, PA2)
    # Subtle oak mid-rail
    c.hline(2, 13, 8, DO2)
    c.hline(2, 13, 9, DO0)
    # Lower recessed wainscoting panel
    c.rect(3, 10, 12, 12, ST3)
    c.hline(3, 12, 10, ST4)
    c.hline(3, 12, 12, ST2)
    # Bottom timber rail
    c.hline(0, 15, 13, DO2)
    c.hline(0, 15, 14, DO1)
    c.hline(0, 15, 15, DO_O)
    return c


def tile_wall_pillar_stone() -> PixelCanvas:
    """Vertical dressed stone pilaster column framing room arches."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, ST0)
    # Recessed side masonry
    c.rect(0, 0, 2, 15, ST2)
    c.rect(13, 0, 15, 15, ST1)
    # Central raised stone pilaster (x=3..12)
    c.vline(3, 0, 15, ST_O)
    c.vline(12, 0, 15, ST_O)
    c.rect(4, 0, 11, 15, ST3)
    c.vline(4, 0, 15, ST5)
    c.vline(5, 0, 15, ST4)
    c.vline(10, 0, 15, ST2)
    c.vline(11, 0, 15, ST1)
    # Horizontal block rings
    for y in (1, 7, 13):
        c.hline(4, 11, y, ST1)
        c.hline(4, 11, y + 1, ST5)
    return c


def tile_wall_lancet_window() -> PixelCanvas:
    """Gothic arched leaded lancet window set into cool grey stone masonry."""
    c = tile_wall_stone_upper()
    # Carve lancet window opening (x=4..11, y=2..14)
    # Pointed arch surround in crisp stone
    arch_rows = {
        2: (6, 9),
        3: (5, 10),
        4: (4, 11),
    }
    for y in range(2, 14):
        x0, x1 = arch_rows.get(y, (4, 11))
        c.hline(x0 - 1, x1 + 1, y, ST_O)
        c.hline(x0, x1, y, BL0)
    # Highlighted arcane night-sky glass + leaded diamond mullions
    for y in range(4, 13):
        c.hline(5, 10, y, BL1)
    c.set(6, 5, BL2); c.set(7, 5, TL3); c.set(6, 6, BL2)
    c.set(6, 9, BL2); c.set(7, 9, TL3)
    # Cross mullions (dark iron)
    c.vline(7, 3, 13, IR_O)
    c.vline(8, 3, 13, IR0)
    c.hline(5, 10, 8, IR_O)
    # Stone sill at bottom
    c.hline(3, 12, 13, ST5)
    c.hline(3, 12, 14, ST4)
    c.hline(3, 12, 15, ST_O)
    return c


def tile_wall_arch_door_top() -> PixelCanvas:
    """Upper semicircular stone archway with keystone."""
    c = tile_wall_stone_upper()
    # Archway dark opening
    arch = {
        4: (5, 10),
        5: (4, 11),
        6: (3, 12),
        7: (3, 12),
    }
    for y in range(4, 16):
        x0, x1 = arch.get(y, (2, 13))
        c.hline(x0 - 1, x1 + 1, y, ST5 if y < 7 else ST4)
        c.hline(x0, x1, y, SL_O)
    # Keystone at apex
    c.rect(7, 2, 8, 4, ST5)
    c.vline(6, 2, 4, ST1)
    c.vline(9, 2, 4, ST1)
    # Inner archway shadow rim
    for y in range(6, 16):
        c.set(2 if y >= 8 else 3, y, SL0)
        c.set(13 if y >= 8 else 12, y, SL0)
    return c


def tile_wall_arch_door_bot() -> PixelCanvas:
    """Lower open stone archway showing floor passage & stone jambs."""
    c = tile_floor_stone_a()
    # Left & right stone door jambs
    c.rect(0, 0, 2, 15, ST3)
    c.vline(0, 0, 15, ST4)
    c.vline(2, 0, 15, ST_O)
    c.rect(13, 0, 15, 15, ST3)
    c.vline(13, 0, 15, ST_O)
    c.vline(15, 0, 15, ST1)
    # Threshold shadow line across floor
    c.hline(3, 12, 0, ST0)
    c.hline(3, 12, 1, ST1)
    return c


def tile_stairs_stone_down() -> PixelCanvas:
    """Stone stairs descending (crisp bright treads vs dark risers + side stone walls)."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, SL_O)
    # Sturdy stone side cheek walls (x=0..2 and x=13..15)
    c.rect(0, 0, 2, 15, ST3)
    c.vline(0, 0, 15, ST5)
    c.vline(2, 0, 15, ST_O)
    c.rect(13, 0, 15, 15, ST3)
    c.vline(13, 0, 15, ST_O)
    c.vline(15, 0, 15, ST1)
    # 5 descending stone steps getting progressively darker toward bottom/depth
    step_treads = [
        (0, ST5, ST4, ST1),
        (3, ST4, ST3, ST0),
        (6, ST3, ST2, SL0),
        (9, ST2, ST1, SL_O),
        (12, ST1, SL1, SL_O),
    ]
    for y, hi, mid, riser in step_treads:
        c.hline(3, 12, y, hi)
        c.hline(3, 12, y + 1, mid)
        c.hline(3, 12, y + 2, riser)
    c.hline(3, 12, 15, SL_O)
    return c


def tile_stairs_stone_up() -> PixelCanvas:
    """Stone stairs ascending (bright crisp step edges vs dark riser shadows + flared bottom step)."""
    c = PixelCanvas(16, 16)
    c.rect(0, 0, 15, 15, ST1)
    # Side stone balustrade rails
    c.rect(0, 0, 2, 14, ST4)
    c.vline(0, 0, 14, ST5)
    c.vline(2, 0, 14, ST_O)
    c.rect(13, 0, 15, 14, ST4)
    c.vline(13, 0, 14, ST_O)
    c.vline(15, 0, 14, ST1)
    # Top landing & 4 bold ascending steps (bright edge at top of each tread, dark riser below!)
    for idx, y in enumerate((0, 3, 6, 9, 12)):
        hi = ST6 if idx <= 1 else ST5
        mid = ST4 if idx <= 2 else ST3
        x0, x1 = (3, 12) if idx < 4 else (1, 14)  # flared bottom step
        c.hline(x0, x1, y, hi)
        c.hline(x0, x1, y + 1, mid)
        c.hline(x0, x1, y + 2, ST0)
    c.hline(0, 15, 15, ST_O)
    return c


def build_all_tiles() -> dict[str, Path]:
    builders = {
        "floor_stone_a": tile_floor_stone_a,
        "floor_stone_b": tile_floor_stone_b,
        "floor_stone_border": tile_floor_stone_border,
        "floor_oak_plank_a": tile_floor_oak_plank_a,
        "floor_oak_plank_b": tile_floor_oak_plank_b,
        "floor_vault_slate_a": tile_floor_vault_slate_a,
        "floor_vault_slate_b": tile_floor_vault_slate_b,
        "carpet_crimson_center": tile_carpet_center,
        "carpet_crimson_edge_n": lambda: _carpet_base_with_edges(n=True),
        "carpet_crimson_edge_s": lambda: _carpet_base_with_edges(s=True),
        "carpet_crimson_edge_w": lambda: _carpet_base_with_edges(w=True),
        "carpet_crimson_edge_e": lambda: _carpet_base_with_edges(e=True),
        "carpet_crimson_corner_nw": lambda: _carpet_base_with_edges(n=True, w=True),
        "carpet_crimson_corner_ne": lambda: _carpet_base_with_edges(n=True, e=True),
        "carpet_crimson_corner_sw": lambda: _carpet_base_with_edges(s=True, w=True),
        "carpet_crimson_corner_se": lambda: _carpet_base_with_edges(s=True, e=True),
        "wall_cap_top": tile_wall_cap_top,
        "wall_stone_upper": tile_wall_stone_upper,
        "wall_stone_lower": tile_wall_stone_lower,
        "wall_timber_upper": tile_wall_timber_upper,
        "wall_pillar_stone": tile_wall_pillar_stone,
        "wall_lancet_window": tile_wall_lancet_window,
        "wall_arch_door_top": tile_wall_arch_door_top,
        "wall_arch_door_bot": tile_wall_arch_door_bot,
        "stairs_stone_down": tile_stairs_stone_down,
        "stairs_stone_up": tile_stairs_stone_up,
    }
    TILES_DIR.mkdir(parents=True, exist_ok=True)
    out: dict[str, Path] = {}
    for name, fn in builders.items():
        canvas = fn()
        p = TILES_DIR / f"{name}.png"
        canvas.save(p)
        out[name] = p
    return out


if __name__ == "__main__":
    built = build_all_tiles()
    print(f"Built {len(built)} tiles in {TILES_DIR}")
