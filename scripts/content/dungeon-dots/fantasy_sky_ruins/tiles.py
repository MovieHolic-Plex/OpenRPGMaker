"""30 clean 16x16 RM2000 Beodeul Ancient Ruins & Crystal Sanctuary outdoor tiles.

All tiles strictly use the locked Beodeul ruins palette (palette.py), with calm
low-noise walkable floors (spike ratio <= 0.08), cool-neutral limestone castle
masonry (ref_bd9_row_2x style), deep teal sanctuary water, timber plank bridges,
and deep cobalt-slate sanctum roof tiles (ref_bd6_row_3x style).
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict
from PIL import Image

from palette import C, PixelCanvas


def _tile() -> PixelCanvas:
    return PixelCanvas(16, 16, C["G3"])


# ---------------------------------------------------------------------------
# 1. Calm Beodeul Meadow Grass & Moss (ref_bd9_row_2x lush natural green)
# ---------------------------------------------------------------------------
def tile_grass_meadow_a() -> PixelCanvas:
    c = PixelCanvas(16, 16, C["G3"])
    # Subtle calm horizontal meadow texture clusters (luma diff <= 13, 0 spikes)
    for x, y in [(2, 3), (3, 3), (10, 6), (11, 6), (5, 11), (6, 11), (13, 14), (14, 14)]:
        c.set(x, y, "G2")
    for x, y in [(2, 2), (10, 5), (5, 10), (13, 13)]:
        c.set(x, y, "G4")
    for x, y in [(7, 2), (8, 2), (1, 8), (14, 9), (9, 13)]:
        c.set(x, y, "G4")
    return c


def tile_grass_meadow_b() -> PixelCanvas:
    c = tile_grass_meadow_a()
    # Second calm variation with gentle curved tuft clusters
    for x, y in [(3, 6), (4, 6), (4, 7), (12, 3), (13, 3), (8, 12), (9, 12)]:
        c.set(x, y, "G2")
    for x, y in [(3, 5), (12, 2), (8, 11)]:
        c.set(x, y, "G4")
    return c


def tile_grass_moss_accent() -> PixelCanvas:
    c = tile_grass_meadow_a()
    # Soft mossy clover patches in muted grass tones
    for x, y in [(4, 4), (5, 4), (6, 4), (4, 5), (5, 5), (6, 5), (5, 6)]:
        c.set(x, y, "G2")
    for x, y in [(4, 4), (5, 4), (11, 10), (12, 10), (11, 11), (12, 11)]:
        c.set(x, y, "G4")
    c.set(11, 12, "G2")
    c.set(12, 12, "G2")
    return c


def tile_grass_wildflower() -> PixelCanvas:
    c = tile_grass_meadow_a()
    # Calm meadow with two tiny delicate wildflower clusters (kept small so spike <= 0.08)
    for fx, fy, petal in [(4, 5, "P5"), (11, 11, "K2")]:
        c.set(fx, fy + 1, "G2")
        c.set(fx - 1, fy + 1, "G2")
        c.set(fx, fy, petal)
        c.set(fx + 1, fy, "K1" if petal == "K2" else "G4")
    return c


# ---------------------------------------------------------------------------
# 2. Courtyard Flagstones & Cobblestone Paths (Cool-neutral limestone)
# ---------------------------------------------------------------------------
def tile_flagstone_courtyard_a() -> PixelCanvas:
    # Calm weathered limestone flagstones, soft low-contrast joints (spike <= 0.08)
    c = PixelCanvas(16, 16, C["S5"])
    # Subtle top-left lit slab interiors (S6 next to S5 keeps luma diff = 21 < 24!)
    c.rect(2, 2, 6, 6, "S6")
    c.rect(10, 2, 14, 6, "S6")
    c.rect(1, 10, 3, 14, "S6")
    c.rect(7, 10, 14, 14, "S6")
    # Clean muted joints (S4 surrounded by S5 edges -> gentle, calm readability!)
    c.hline(0, 15, 0, "S4")
    c.hline(0, 15, 8, "S4")
    c.vline(0, 0, 7, "S4")
    c.vline(8, 0, 7, "S4")
    c.vline(5, 8, 15, "S4")
    c.vline(15, 8, 15, "S4")
    return c


def tile_flagstone_courtyard_b() -> PixelCanvas:
    c = tile_flagstone_courtyard_a()
    # Gentle moss creeping along the middle mortar joint (low-spike muted cluster)
    for x, y in [(7, 7), (8, 7), (9, 7), (7, 8), (8, 8), (9, 8), (8, 9)]:
        c.set(x, y, "G3")
    c.set(8, 8, "G2")
    return c


def tile_flagstone_courtyard_cracked() -> PixelCanvas:
    c = tile_flagstone_courtyard_a()
    # Clean weathered hairline crack in lower-right slab (S4/S5 so floor stays calm)
    for x, y in [(9, 10), (10, 11), (11, 11), (11, 12), (12, 13)]:
        c.set(x, y, "S4")
    c.set(10, 10, "S5")
    c.set(12, 12, "S5")
    return c


def tile_flagstone_border_n() -> PixelCanvas:
    # North curb stone border meeting meadow grass on top
    c = tile_flagstone_courtyard_a()
    c.rect(0, 0, 15, 3, "G3")
    for x in (2, 7, 12):
        c.set(x, 2, "G2")
        c.set(x + 1, 1, "G4")
    c.hline(0, 15, 4, "S3")
    c.hline(0, 15, 5, "S7")
    c.hline(0, 15, 6, "S6")
    c.hline(0, 15, 7, "S5")
    for vx in (5, 11):
        c.vline(vx, 4, 7, "S4")
    return c


def tile_flagstone_border_s() -> PixelCanvas:
    # South stepped curb lip dropping onto meadow grass below
    c = tile_flagstone_courtyard_a()
    c.rect(0, 12, 15, 15, "G3")
    c.hline(0, 15, 12, "G1")  # soft drop shadow onto grass
    c.hline(0, 15, 11, "S2")  # dark underside edge
    c.hline(0, 15, 10, "S4")  # curb riser
    c.hline(0, 15, 9, "S7")   # bright step top lip
    for vx in (5, 11):
        c.vline(vx, 9, 11, "S3")
    return c


def tile_sanctum_floor_rune() -> PixelCanvas:
    # Calm carved ancient sanctum floor with soft cyan-teal rune border inlay (spike <= 0.08)
    c = PixelCanvas(16, 16, C["S6"])
    c.rect(1, 1, 14, 14, "S6")
    c.hline(0, 15, 0, "S5")
    c.vline(0, 0, 15, "S5")
    c.hline(1, 14, 1, "S7")
    c.vline(1, 1, 14, "S7")
    # Soft inlaid geometric rune border in S5 + pale cyan core
    c.rect(4, 4, 11, 11, "S5")
    c.rect(5, 5, 10, 10, "S6")
    c.rect(6, 6, 9, 9, "W6")
    c.rect(7, 7, 8, 8, "C3")
    return c


def tile_cobble_path_a() -> PixelCanvas:
    # Darker weathered slate-cobble path (low-noise calm contrast)
    c = PixelCanvas(16, 16, C["S3"])
    stones = [
        (1, 1, 5, 3), (7, 1, 11, 3), (13, 1, 15, 3),
        (0, 5, 3, 7), (5, 5, 9, 7), (11, 5, 14, 7),
        (1, 9, 6, 11), (8, 9, 12, 11), (14, 9, 15, 11),
        (0, 13, 4, 15), (6, 13, 10, 15), (12, 13, 15, 15),
    ]
    for i, (x0, y0, x1, y1) in enumerate(stones):
        body = "S4" if i % 2 == 0 else "D3"
        c.rect(x0, y0, x1, y1, body)
        c.hline(x0, x1 - 1, y0, "S5")
    return c


def tile_cobble_path_b() -> PixelCanvas:
    c = tile_cobble_path_a()
    # Gentle moss tufts tucked into cobble joints
    for x, y in [(4, 4), (5, 4), (10, 8), (11, 8), (5, 12), (6, 12)]:
        c.set(x, y, "G2")
    return c


# ---------------------------------------------------------------------------
# 3. Deep Sea Teal Sanctuary Water & Outlined Stone Canal Rims (LESSONS.md #19)
# ---------------------------------------------------------------------------
def tile_water_sanctuary_a() -> PixelCanvas:
    c = PixelCanvas(16, 16, C["W1"])
    # Deep sanctuary teal body with subtle horizontal water bands
    for y in (2, 3, 10, 11):
        c.hline(0, 15, y, "W2")
    # Crisp bright ripple streaks (restrained, calm)
    for x0, x1, y in [(2, 5, 4), (10, 13, 12)]:
        c.hline(x0, x1, y, "W4")
        c.hline(x0 + 1, x1 - 1, y, "W5")
    c.set(3, 4, "W6")
    c.set(11, 12, "W6")
    return c


def tile_water_sanctuary_b() -> PixelCanvas:
    c = PixelCanvas(16, 16, C["W1"])
    for y in (5, 6, 13, 14):
        c.hline(0, 15, y, "W2")
    for x0, x1, y in [(6, 10, 7), (1, 4, 14)]:
        c.hline(x0, x1, y, "W4")
        c.hline(x0 + 1, x1 - 1, y, "W5")
    c.set(8, 7, "W6")
    return c


def tile_water_rim_n() -> PixelCanvas:
    # North stone canal embankment (top curb + vertical stone wall + dark water shadow + foam)
    c = tile_water_sanctuary_a()
    # Stone top coping (0..3)
    c.rect(0, 0, 15, 3, "S6")
    c.hline(0, 15, 0, "S2")
    c.hline(0, 15, 1, "S7")
    c.hline(0, 15, 3, "S4")
    # Vertical wet stone wall face (4..8)
    c.rect(0, 4, 15, 8, "S4")
    c.hline(0, 15, 4, "S2")
    c.hline(0, 15, 6, "S3")
    c.hline(0, 15, 7, "D2")
    c.hline(0, 15, 8, "D1")
    for vx in (0, 8):
        c.vline(vx, 1, 3, "S3")
        c.vline(vx, 4, 8, "S2")
    # Dark waterline outline + bright cyan-white foam edge
    c.hline(0, 15, 9, "W0")
    c.hline(0, 15, 10, "W2")
    for x in (2, 3, 4, 9, 10, 11, 12):
        c.set(x, 10, "W5")
    c.set(3, 10, "C5")
    c.set(10, 10, "C5")
    return c


def tile_water_rim_s() -> PixelCanvas:
    # South stone canal rim edge
    c = tile_water_sanctuary_a()
    c.hline(0, 15, 10, "W0")
    for x in (1, 2, 6, 7, 8, 13, 14):
        c.set(x, 9, "W5")
    # Stone curb (11..15)
    c.rect(0, 11, 15, 15, "S6")
    c.hline(0, 15, 11, "S7")
    c.hline(0, 15, 12, "S6")
    c.hline(0, 15, 14, "S4")
    c.hline(0, 15, 15, "S2")
    for vx in (4, 12):
        c.vline(vx, 11, 15, "S3")
    return c


def tile_water_rim_w() -> PixelCanvas:
    # West stone canal edge (stone curb left 0..4, water right 5..15)
    c = tile_water_sanctuary_a()
    c.rect(0, 0, 3, 15, "S6")
    c.vline(0, 0, 15, "S2")
    c.vline(1, 0, 15, "S7")
    c.vline(3, 0, 15, "S4")
    c.vline(4, 0, 15, "S2")
    c.vline(5, 0, 15, "W0")
    for y in (2, 3, 4, 10, 11, 12):
        c.set(6, y, "W5")
    c.set(6, 3, "C5")
    for hy in (0, 8):
        c.hline(1, 3, hy, "S3")
    return c


def tile_water_rim_e() -> PixelCanvas:
    # East stone canal edge (water left 0..10, stone curb right 11..15)
    c = tile_water_sanctuary_a()
    c.vline(10, 0, 15, "W0")
    for y in (3, 4, 5, 11, 12):
        c.set(9, y, "W5")
    c.vline(11, 0, 15, "S2")
    c.rect(12, 0, 15, 15, "S6")
    c.vline(12, 0, 15, "S7")
    c.vline(14, 0, 15, "S4")
    c.vline(15, 0, 15, "S2")
    for hy in (4, 12):
        c.hline(12, 14, hy, "S3")
    return c


# ---------------------------------------------------------------------------
# 4. Ruined Castle Stone Walls, Battlements & Terrace (ref_bd9_row_2x style!)
# ---------------------------------------------------------------------------
def tile_castle_wall_face() -> PixelCanvas:
    # Crisp ashlar cool-neutral limestone courses (like ref_bd9_row_2x castle wall!)
    c = PixelCanvas(16, 16, C["S5"])
    courses = [
        (0, 3, [0, 8]),
        (4, 7, [4, 12]),
        (8, 11, [0, 8]),
        (12, 15, [4, 12]),
    ]
    for ci, (y0, y1, joints) in enumerate(courses):
        c.hline(0, 15, y0, "S7" if ci % 2 == 0 else "S6")
        c.rect(0, y0 + 1, 15, y1 - 1, "S6" if ci % 2 == 0 else "S5")
        c.hline(0, 15, y1, "S2")  # crisp dark course mortar
        for jx in joints:
            c.vline(jx, y0, y1, "S2")
            if jx + 1 < 16:
                c.vline(jx + 1, y0, y1 - 1, "S7")
            if jx - 1 >= 0:
                c.vline(jx - 1, y0 + 1, y1 - 1, "S4")
    return c


def tile_castle_wall_moss() -> PixelCanvas:
    c = tile_castle_wall_face()
    # Hanging Beodeul ivy/moss vine cascading down stone masonry (ref_bd9_row_2x!)
    vine_dark = [
        (3, 0), (4, 0), (5, 0), (3, 1), (5, 1), (4, 2), (5, 2), (6, 2),
        (4, 3), (6, 3), (5, 4), (6, 4), (5, 5), (4, 6), (5, 6), (5, 7),
        (4, 8), (5, 8), (5, 9), (6, 10), (5, 11),
        (11, 0), (12, 0), (11, 1), (12, 2), (11, 3),
    ]
    for x, y in vine_dark:
        c.set(x, y, "F1")
    vine_mid = [(4, 0), (4, 1), (5, 2), (5, 3), (5, 4), (4, 5), (5, 6), (4, 7), (5, 8), (11, 0), (12, 1)]
    for x, y in vine_mid:
        c.set(x, y, "F3")
    for x, y in [(4, 0), (5, 2), (4, 5), (11, 0)]:
        c.set(x, y, "F4")
    return c


def tile_castle_wall_base() -> PixelCanvas:
    # Bottom course of castle wall with plinth ledge & dark contact shadow
    c = tile_castle_wall_face()
    c.hline(0, 15, 10, "S7")
    c.hline(0, 15, 11, "S5")
    c.rect(0, 12, 15, 14, "S3")
    c.hline(0, 15, 12, "S4")
    c.hline(0, 15, 14, "S2")
    c.hline(0, 15, 15, "S1")
    for jx in (0, 8):
        c.vline(jx, 10, 15, "S1")
    return c


def tile_castle_battlement_top() -> PixelCanvas:
    # Crenellated stone parapet top (3/4 top band + merlon fronts, ref_bd9_row_2x!)
    c = PixelCanvas(16, 16, C["S5"])
    # Back walkway shadow band (0..3)
    c.rect(0, 0, 15, 3, "S5")
    c.hline(0, 15, 0, "S4")
    c.hline(0, 15, 3, "S3")
    # Crenellations: two wide merlons (0..5 and 8..13) with embrasure gaps (6..7, 14..15)
    for mx0, mx1 in [(0, 5), (8, 13)]:
        # Top sunlit stone cap
        c.rect(mx0, 2, mx1, 5, "S7")
        c.hline(mx0, mx1, 2, "S8")
        c.hline(mx0, mx1, 5, "S6")
        # Merlon front face
        c.rect(mx0, 6, mx1, 10, "S5")
        c.hline(mx0, mx1, 6, "S6")
        c.hline(mx0, mx1, 10, "S2")
        c.vline(mx0, 2, 10, "S2")
        c.vline(mx1, 2, 10, "S2")
    # Embrasure wall recessed floor
    for gx0, gx1 in [(6, 7), (14, 15)]:
        c.rect(gx0, 5, gx1, 7, "S4")
        c.rect(gx0, 8, gx1, 10, "S3")
        c.hline(gx0, gx1, 10, "S2")
    # Continuous cornice molding & upper wall course (11..15)
    c.hline(0, 15, 11, "S7")
    c.rect(0, 12, 15, 14, "S5")
    c.hline(0, 15, 15, "S2")
    for jx in (4, 12):
        c.vline(jx, 11, 15, "S2")
    return c


def tile_castle_terrace_top() -> PixelCanvas:
    # Raised stone terrace top surface (slightly lighter & cleaner than courtyard)
    c = PixelCanvas(16, 16, C["S6"])
    c.rect(1, 1, 7, 7, "S7")
    c.rect(9, 1, 14, 7, "S7")
    c.rect(1, 9, 14, 14, "S7")
    c.hline(0, 15, 0, "S5")
    c.hline(0, 15, 8, "S5")
    c.vline(0, 0, 15, "S5")
    c.vline(8, 0, 7, "S5")
    c.vline(4, 8, 15, "S5")
    c.vline(12, 8, 15, "S5")
    return c


def tile_cliff_ledge_moss() -> PixelCanvas:
    # Mossy stone retaining ledge with lush grass overhanging the top edge
    c = PixelCanvas(16, 16, C["S4"])
    # Grass overhang (0..4)
    c.rect(0, 0, 15, 3, "G3")
    c.hline(0, 15, 0, "G4")
    for x in range(16):
        drop = 4 if (x % 5 in (1, 2)) else 3
        c.set(x, drop, "F2")
        c.set(x, drop + 1, "F0")
    # Faceted cliff stone wall below (5..14)
    c.rect(0, 5, 15, 14, "S4")
    for x0, x1, y0, y1 in [(1, 6, 6, 10), (8, 14, 6, 9), (0, 4, 11, 14), (6, 11, 10, 14), (13, 15, 10, 14)]:
        c.rect(x0, y0, x1, y1, "S5")
        c.hline(x0, x1, y0, "S6")
        c.hline(x0, x1, y1, "S2")
        c.vline(x1, y0, y1, "S2")
    c.hline(0, 15, 15, "S1")
    return c


# ---------------------------------------------------------------------------
# 5. Stepped Stone Staircase (LESSONS.md #22: bright step edges vs dark risers)
# ---------------------------------------------------------------------------
def tile_stairs_stone_m() -> PixelCanvas:
    # Center stone steps: 4 crisp steps per 16px tile (bright tread edge + dark riser)
    c = PixelCanvas(16, 16, C["S5"])
    for step in range(4):
        y = step * 4
        c.hline(0, 15, y, "S7")      # bright crisp step edge
        c.hline(0, 15, y + 1, "S6")  # lit tread surface
        c.hline(0, 15, y + 2, "S4")  # tread back shadow
        c.hline(0, 15, y + 3, "S1")  # dark crisp riser shadow
        # Subtle stone block seam per step
        sx = 5 if step % 2 == 0 else 10
        c.vline(sx, y, y + 2, "S3")
    return c


def tile_stairs_stone_l() -> PixelCanvas:
    # Left cheek wall + flared bottom stone rail with stone steps
    c = tile_stairs_stone_m()
    # Left stone cheek wall (x 0..3)
    c.rect(0, 0, 3, 15, "S5")
    c.vline(0, 0, 15, "S1")
    c.vline(1, 0, 15, "S7")
    c.vline(2, 0, 15, "S6")
    c.vline(3, 0, 15, "S2")
    # Flared bottom newel block on bottom 4px
    c.rect(0, 11, 4, 15, "S6")
    c.hline(0, 4, 11, "S8")
    c.hline(0, 4, 15, "S1")
    c.vline(0, 11, 15, "S1")
    c.vline(4, 11, 15, "S1")
    return c


def tile_stairs_stone_r() -> PixelCanvas:
    # Right cheek wall + flared bottom stone rail with stone steps
    c = tile_stairs_stone_m()
    c.rect(12, 0, 15, 15, "S5")
    c.vline(12, 0, 15, "S2")
    c.vline(13, 0, 15, "S7")
    c.vline(14, 0, 15, "S5")
    c.vline(15, 0, 15, "S1")
    # Flared bottom newel block
    c.rect(11, 11, 15, 15, "S6")
    c.hline(11, 15, 11, "S8")
    c.hline(11, 15, 15, "S1")
    c.vline(11, 11, 15, "S1")
    c.vline(15, 11, 15, "S1")
    return c


# ---------------------------------------------------------------------------
# 6. Wooden Plank Bridges over Sanctuary Water (ref_bd9_row_2x pier style!)
# ---------------------------------------------------------------------------
def tile_bridge_plank_h() -> PixelCanvas:
    # East-West plank bridge spanning over deep teal water (top & bottom water visible)
    c = tile_water_sanctuary_a()
    # Top timber handrail / edge beam (y 1..3)
    c.hline(0, 15, 1, "O0")
    c.hline(0, 15, 2, "O6")
    c.hline(0, 15, 3, "O2")
    # Vertical planks across bridge deck (y 4..11)
    for x in range(16):
        if x % 4 == 0:
            c.vline(x, 4, 11, "O1")  # dark plank seam
        else:
            c.vline(x, 4, 11, "O4" if (x // 4) % 2 == 0 else "O5")
            c.set(x, 4, "O6")  # top-left lit plank edge
            c.set(x, 11, "O3")
    # Iron nail dots along top/bottom stringer
    for nx in (2, 6, 10, 14):
        c.set(nx, 5, "I1")
        c.set(nx, 10, "I1")
    # Bottom timber edge beam + dark shadow over water (y 12..14)
    c.hline(0, 15, 12, "O6")
    c.hline(0, 15, 13, "O2")
    c.hline(0, 15, 14, "O0")
    c.hline(0, 15, 15, "W0")  # bridge shadow on water
    # Corner railing posts
    for px in (1, 13):
        c.rect(px, 0, px + 1, 3, "O5")
        c.set(px, 0, "O7")
        c.rect(px, 11, px + 1, 13, "O4")
        c.set(px, 11, "O7")
    return c


def tile_bridge_plank_v() -> PixelCanvas:
    # North-South plank bridge spanning over deep teal water
    c = tile_water_sanctuary_a()
    # Left & right timber edge beams (x 1..2 and x 13..14)
    c.vline(0, 0, 15, "W0")
    c.vline(1, 0, 15, "O0")
    c.vline(2, 0, 15, "O6")
    c.vline(13, 0, 15, "O5")
    c.vline(14, 0, 15, "O0")
    c.vline(15, 0, 15, "W0")
    # Horizontal planks (y 0..15)
    for y in range(16):
        if y % 4 == 0:
            c.hline(3, 12, y, "O1")
        else:
            c.hline(3, 12, y, "O4" if (y // 4) % 2 == 0 else "O5")
            if y % 4 == 1:
                c.hline(3, 11, y, "O6")
    # Iron nails & side railing posts
    for ny in (2, 6, 10, 14):
        c.set(4, ny, "I1")
        c.set(11, ny, "I1")
    for py in (1, 9):
        c.rect(1, py, 2, py + 1, "O7")
        c.rect(13, py, 14, py + 1, "O6")
    return c


# ---------------------------------------------------------------------------
# 7. Deep Cobalt-Slate Sanctum Roof Tiles (ref_bd6_row_3x church roof!)
# ---------------------------------------------------------------------------
def tile_roof_cobalt_slate_a() -> PixelCanvas:
    # Crisp overlapping scalloped cobalt-slate shingles (ref_bd6 church roof!)
    c = PixelCanvas(16, 16, C["B2"])
    for row in range(4):
        y = row * 4
        offset = 0 if row % 2 == 0 else 2
        c.hline(0, 15, y, "B4")
        c.hline(0, 15, y + 1, "B3")
        c.hline(0, 15, y + 2, "B2")
        c.hline(0, 15, y + 3, "B0")
        for x in range(offset, 16, 4):
            c.vline(x, y, y + 3, "B0")
            if x + 1 < 16:
                c.set(x + 1, y, "B5")  # bright top-left shingle specular!
                c.set(x + 1, y + 1, "B4")
    return c


def tile_roof_cobalt_slate_ridge() -> PixelCanvas:
    # Stone-capped cobalt roof ridge & upper shingle slope
    c = tile_roof_cobalt_slate_a()
    # Carved limestone ridge cap along top (y 0..4)
    c.hline(0, 15, 0, "S1")
    c.hline(0, 15, 1, "S7")
    c.hline(0, 15, 2, "S6")
    c.hline(0, 15, 3, "S4")
    c.hline(0, 15, 4, "B0")
    for jx in (0, 8):
        c.vline(jx, 0, 3, "S2")
    return c


ALL_TILES = {
    "grass_meadow_a": tile_grass_meadow_a,
    "grass_meadow_b": tile_grass_meadow_b,
    "grass_moss_accent": tile_grass_moss_accent,
    "grass_wildflower": tile_grass_wildflower,
    "flagstone_courtyard_a": tile_flagstone_courtyard_a,
    "flagstone_courtyard_b": tile_flagstone_courtyard_b,
    "flagstone_courtyard_cracked": tile_flagstone_courtyard_cracked,
    "flagstone_border_n": tile_flagstone_border_n,
    "flagstone_border_s": tile_flagstone_border_s,
    "sanctum_floor_rune": tile_sanctum_floor_rune,
    "cobble_path_a": tile_cobble_path_a,
    "cobble_path_b": tile_cobble_path_b,
    "water_sanctuary_a": tile_water_sanctuary_a,
    "water_sanctuary_b": tile_water_sanctuary_b,
    "water_rim_n": tile_water_rim_n,
    "water_rim_s": tile_water_rim_s,
    "water_rim_w": tile_water_rim_w,
    "water_rim_e": tile_water_rim_e,
    "castle_wall_face": tile_castle_wall_face,
    "castle_wall_moss": tile_castle_wall_moss,
    "castle_wall_base": tile_castle_wall_base,
    "castle_battlement_top": tile_castle_battlement_top,
    "castle_terrace_top": tile_castle_terrace_top,
    "cliff_ledge_moss": tile_cliff_ledge_moss,
    "stairs_stone_l": tile_stairs_stone_l,
    "stairs_stone_m": tile_stairs_stone_m,
    "stairs_stone_r": tile_stairs_stone_r,
    "bridge_plank_h": tile_bridge_plank_h,
    "bridge_plank_v": tile_bridge_plank_v,
    "roof_cobalt_slate_a": tile_roof_cobalt_slate_a,
    "roof_cobalt_slate_ridge": tile_roof_cobalt_slate_ridge,
}


def build_all_tiles(out_dir: Path) -> Dict[str, Image.Image]:
    out_dir.mkdir(parents=True, exist_ok=True)
    built: Dict[str, Image.Image] = {}
    for name, fn in ALL_TILES.items():
        canvas = fn()
        img = canvas.to_image()
        img.save(out_dir / f"{name}.png")
        built[name] = img
    return built
