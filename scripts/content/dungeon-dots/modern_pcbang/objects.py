"""Generate all 20 distinct RM2000 objects for modern_pcbang + manifest.json + notes.txt."""
from __future__ import annotations

import json
from typing import Callable, Dict, List, Tuple
from palette import (
    Canvas, OBJECTS_DIR, OUT_ROOT,
    R, O, A, Y, G, J, C, K, B, I, M, P, S, DW, WT,
)


# ---------------------------------------------------------------------------
# 1. PC STATION BLUE (32x32, standing)
# Wide desk + glowing cyan/blue monitor (left-center) + keyboard + glass PC tower (right)
# ---------------------------------------------------------------------------
def draw_pc_station_blue() -> Canvas:
    c = Canvas(32, 32)
    # --- Monitor (left-center: x=3..20, y=2..14) ---
    c.box(3, 2, 18, 12, S[1], S[0])
    c.hline(4, 19, 3, S[3])  # narrow top bezel highlight
    # Glowing cyan/blue screen (x=4..19, y=4..12)
    c.fill_rect(4, 4, 16, 9, K[3])
    c.fill_rect(4, 4, 16, 3, K[4])
    # Crisp clean game HUD / bright screen cluster
    c.fill_rect(5, 5, 7, 4, K[5])
    c.fill_rect(6, 5, 4, 2, K[6])
    c.p(6, 5, S[7])
    c.p(7, 5, S[7])
    c.fill_rect(14, 6, 4, 5, C[5])
    c.hline(14, 17, 6, C[6])
    c.hline(5, 12, 11, C[6])  # bright UI bar at bottom
    c.p(18, 12, C[5])         # power LED inside lower bezel
    # Monitor neck stand
    c.fill_rect(10, 14, 4, 2, S[2])
    c.vline(10, 14, 15, S[0])
    c.vline(13, 14, 15, S[0])

    # --- PC Gaming Tower on right (x=22..29, y=4..18) ---
    c.box(22, 4, 8, 15, S[1], S[0])
    c.hline(23, 28, 5, S[4])  # narrow lit top of tower
    c.hline(23, 28, 6, S[2])
    # Front tempered panel with glowing cyan RGB fans
    c.fill_rect(23, 7, 6, 11, B[0])
    c.fill_rect(24, 8, 4, 3, C[4])
    c.fill_rect(25, 9, 2, 1, C[6])
    c.fill_rect(24, 12, 4, 3, C[4])
    c.fill_rect(25, 13, 2, 1, C[6])
    c.hline(24, 27, 16, K[5])  # bottom RGB strip

    # --- Wide Desk Top (y=15..20, x=1..30) ---
    # Strictly front + top band, NO side walls
    c.box(1, 15, 30, 6, S[3], S[0])
    c.hline(2, 29, 16, S[4])  # top-left lit desktop
    c.fill_rect(2, 17, 28, 3, S[3])
    # Re-stamp monitor stand base & tower base sitting ON the desk
    c.fill_rect(9, 16, 6, 1, S[2])
    c.hline(9, 14, 15, S[0])
    c.hline(11, 12, 15, S[2])  # interior neck connection under monitor
    c.box(22, 4, 8, 15, S[1], S[0])
    c.hline(23, 28, 5, S[4])
    c.hline(23, 28, 6, S[2])
    c.fill_rect(23, 7, 6, 11, B[0])
    c.fill_rect(24, 8, 4, 3, C[4])
    c.fill_rect(25, 9, 2, 1, C[6])
    c.fill_rect(24, 12, 4, 3, C[4])
    c.fill_rect(25, 13, 2, 1, C[6])
    c.hline(24, 27, 16, K[5])
    # Glowing RGB keyboard (x=4..15, y=17..19) + mouse (x=17..19, y=18..19)
    c.fill_rect(4, 17, 12, 3, S[1])
    c.hline(5, 14, 18, C[5])
    c.p(6, 18, S[7])
    c.p(10, 18, K[6])
    c.p(13, 18, C[6])
    c.fill_rect(17, 18, 3, 2, S[1])
    c.p(18, 18, C[5])

    # --- Desk Front Apron & Legs (y=21..30, x=1..30) ---
    c.box(1, 20, 30, 4, S[2], S[0])
    c.hline(2, 29, 21, C[4])  # subtle cyan under-desk LED strip
    c.hline(2, 29, 22, S[2])
    # Sturdy left & right desk legs + recessed dark modesty panel
    c.box(1, 23, 4, 8, S[2], S[0])
    c.vline(2, 24, 29, S[3])
    c.box(27, 23, 4, 8, S[2], S[0])
    c.vline(28, 24, 29, S[3])
    # Modesty panel & open leg space
    c.fill_rect(5, 24, 22, 4, S[1])
    c.hline(5, 26, 27, S[0])
    c.add_ground_shadow(1, 30, 31)
    c.add_ground_shadow(5, 26, 30)
    return c


# ---------------------------------------------------------------------------
# 2. PC STATION RED (32x32, standing)
# Dual-monitor red esports rig + backlit red keyboard + under-desk red tower
# ---------------------------------------------------------------------------
def draw_pc_station_red() -> Canvas:
    c = Canvas(32, 32)
    # --- Dual Monitors (left: x=2..15, right: x=16..29, y=2..14) ---
    c.box(2, 2, 14, 12, S[1], S[0])
    c.box(16, 2, 14, 12, S[1], S[0])
    c.hline(3, 14, 3, S[3])
    c.hline(17, 28, 3, S[3])
    # Left screen: bright crimson/orange esports game display
    c.fill_rect(3, 4, 12, 9, R[2])
    c.fill_rect(3, 4, 12, 4, R[4])
    c.fill_rect(4, 5, 6, 3, R[5])
    c.fill_rect(5, 5, 3, 2, O[6])
    c.p(5, 5, S[7])
    c.hline(4, 13, 11, Y[5])
    # Right screen: glowing amber/red radar & stats
    c.fill_rect(17, 4, 12, 9, R[2])
    c.fill_rect(18, 5, 10, 4, O[4])
    c.fill_rect(19, 6, 4, 2, Y[5])
    c.p(19, 6, Y[6])
    c.hline(18, 27, 11, R[5])
    c.hline(18, 24, 10, O[5])
    # Twin monitor stands (strict 1px S[0] dark outline on outer edges)
    c.fill_rect(7, 14, 4, 2, S[2])
    c.vline(7, 14, 15, S[0])
    c.vline(10, 14, 15, S[0])
    c.fill_rect(21, 14, 4, 2, S[2])
    c.vline(21, 14, 15, S[0])
    c.vline(24, 14, 15, S[0])

    # --- Desk Top (x=1..30, y=15..20) ---
    c.box(1, 15, 30, 6, S[2], S[0])
    c.hline(2, 29, 16, S[4])
    c.fill_rect(2, 17, 28, 3, S[3])
    # Red backlit gaming keyboard + wide mouse pad
    c.fill_rect(5, 17, 14, 3, S[1])
    c.hline(6, 17, 18, R[5])
    c.p(8, 18, Y[6])
    c.p(12, 18, R[6])
    c.p(16, 18, R[6])
    c.fill_rect(21, 17, 5, 3, R[1])
    c.fill_rect(22, 18, 3, 2, S[1])
    c.p(23, 18, R[5])

    # --- Desk Front Apron & Red LED Accent (y=20..30) ---
    c.box(1, 20, 30, 4, S[2], S[0])
    c.hline(2, 29, 21, R[4])  # red RGB desk trim
    c.hline(2, 29, 22, S[1])
    # Left leg + dark under-desk panel + right under-desk red PC tower
    c.box(1, 23, 4, 8, S[2], S[0])
    c.vline(2, 24, 29, R[4])  # red gaming leg accent
    c.fill_rect(5, 24, 16, 4, S[1])
    c.hline(5, 20, 27, S[0])
    # Under-desk PC tower on right (x=21..29, y=23..30)
    c.box(21, 23, 9, 8, S[1], S[0])
    c.fill_rect(22, 24, 7, 6, R[0])
    c.fill_rect(23, 25, 5, 2, R[4])
    c.hline(24, 26, 25, R[6])
    c.fill_rect(23, 28, 5, 1, O[5])
    c.add_ground_shadow(1, 30, 31)
    c.add_ground_shadow(5, 20, 30)
    return c


# ---------------------------------------------------------------------------
# 3. GAMING CHAIR RED (16x16, chair - near top-down facing DOWN)
# ---------------------------------------------------------------------------
def draw_gaming_chair_red() -> Canvas:
    c = Canvas(16, 16)
    # High racing backrest along TOP (y=1..6, x=2..13)
    c.box(2, 1, 12, 6, R[3], R[0])
    c.hline(3, 12, 2, R[5])       # top headrest highlight
    c.fill_rect(5, 2, 6, 4, S[2]) # dark center racing cushion
    c.hline(6, 9, 2, S[4])        # headrest pillow sheen
    c.vline(3, 2, 5, R[4])        # left red bolster
    c.vline(12, 2, 5, R[4])       # right red bolster
    c.hline(3, 12, 6, R[1])       # crease between backrest & seat

    # Seat cushion seen from above (y=7..12, x=2..13)
    c.box(2, 7, 12, 6, S[2], S[0])
    c.fill_rect(4, 8, 8, 4, S[3])
    c.hline(5, 10, 8, S[4])       # top-left seat highlight
    c.vline(3, 8, 11, R[4])       # crimson seat side bolsters
    c.vline(12, 8, 11, R[4])
    c.hline(3, 12, 11, S[2])      # front lip shade

    # Slim dark armrests (x=1..2, x=13..14, y=6..11) — outer edges strictly S[0]
    c.box(1, 6, 3, 6, S[2], S[0])
    c.p(2, 7, S[4])
    c.box(12, 6, 3, 6, S[2], S[0])
    c.p(13, 7, S[4])

    # Caster wheel stubs at bottom (y=13..14)
    c.fill_rect(3, 13, 3, 2, S[1])
    c.hline(3, 5, 14, S[0])
    c.fill_rect(10, 13, 3, 2, S[1])
    c.hline(10, 12, 14, S[0])
    c.fill_rect(7, 13, 2, 2, S[0])
    c.add_ground_shadow(2, 13, 15)
    return c


# ---------------------------------------------------------------------------
# 4. GAMING CHAIR BLUE (16x16, chair - near top-down facing DOWN)
# ---------------------------------------------------------------------------
def draw_gaming_chair_blue() -> Canvas:
    c = Canvas(16, 16)
    # Racing backrest along TOP (y=1..6, x=2..13)
    c.box(2, 1, 12, 6, B[3], B[0])
    c.hline(3, 12, 2, B[5])       # bright cobalt crest
    c.fill_rect(5, 2, 6, 4, S[2]) # center spine
    c.hline(6, 9, 3, C[5])        # cyan neck pillow accent
    c.vline(3, 2, 5, B[4])
    c.vline(12, 2, 5, B[4])
    c.hline(3, 12, 6, B[1])

    # Seat cushion seen from above (y=7..12, x=2..13)
    c.box(2, 7, 12, 6, S[2], S[0])
    c.fill_rect(4, 8, 8, 4, S[3])
    c.hline(5, 10, 8, S[4])
    c.vline(3, 8, 11, K[4])       # cerulean seat bolsters
    c.vline(12, 8, 11, K[4])
    c.hline(3, 12, 11, S[2])

    # Slim dark armrests — outer edges strictly S[0]
    c.box(1, 6, 3, 6, S[2], S[0])
    c.p(2, 7, S[4])
    c.box(12, 6, 3, 6, S[2], S[0])
    c.p(13, 7, S[4])

    # Caster wheel stubs
    c.fill_rect(3, 13, 3, 2, S[1])
    c.hline(3, 5, 14, S[0])
    c.fill_rect(10, 13, 3, 2, S[1])
    c.hline(10, 12, 14, S[0])
    c.fill_rect(7, 13, 2, 2, S[0])
    c.add_ground_shadow(2, 13, 15)
    return c


# ---------------------------------------------------------------------------
# 5. ARCADE CABINET BLUE (16x32, standing)
# Marquee + glowing CRT screen + joystick control deck + coin door
# ---------------------------------------------------------------------------
def draw_arcade_cabinet_blue() -> Canvas:
    c = Canvas(16, 32)
    # Main cabinet front silhouette (x=1..14, y=2..30) — NO side walls
    c.box(1, 2, 14, 29, B[3], B[0])
    # Narrow lit top roof cap (y=2..4)
    c.fill_rect(2, 3, 12, 2, B[5])
    c.hline(2, 13, 3, B[6])
    c.hline(2, 13, 4, B[4])
    c.hline(1, 14, 5, B[0])

    # Glowing arcade marquee header (y=6..8)
    c.fill_rect(2, 6, 12, 3, Y[5])
    c.hline(2, 13, 6, Y[6])
    c.fill_rect(4, 7, 3, 1, R[4])
    c.fill_rect(8, 7, 4, 1, C[4])
    c.hline(2, 13, 9, B[0])

    # Recessed CRT monitor bezel & glowing screen (y=10..17)
    c.fill_rect(2, 10, 12, 8, S[1])
    c.fill_rect(3, 11, 10, 6, K[3])
    c.fill_rect(3, 11, 10, 2, K[5])
    c.fill_rect(4, 12, 4, 2, K[6])
    c.p(4, 12, S[7])
    c.p(10, 14, Y[6])  # bright game sprite on CRT
    c.p(11, 14, R[5])
    c.hline(3, 12, 16, C[4])

    # Control deck ledge (y=18..21) — flat projected top of deck
    c.box(1, 18, 14, 4, S[3], S[0])
    c.hline(2, 13, 19, S[5])
    c.hline(2, 13, 20, S[4])
    # Bright red joystick ball + colorful buttons
    c.fill_rect(3, 18, 2, 2, R[5])
    c.p(3, 18, R[6])
    c.p(7, 19, Y[5])
    c.p(9, 19, C[5])
    c.p(11, 19, G[5])

    # Lower cabinet front & coin door (y=22..30)
    c.fill_rect(2, 22, 12, 8, B[2])
    c.vline(2, 22, 29, B[4])
    c.box(4, 23, 8, 6, S[1], S[0])
    c.p(6, 25, O[5])  # glowing orange coin slot 1
    c.p(9, 25, O[5])  # glowing orange coin slot 2
    c.hline(5, 10, 27, S[3])
    c.hline(1, 14, 30, B[0])
    c.add_ground_shadow(1, 14, 31)
    return c


# ---------------------------------------------------------------------------
# 6. ARCADE CABINET RED (16x32, standing)
# Distinct crimson candy/fighting cabinet + twin joysticks + emerald/gold CRT
# ---------------------------------------------------------------------------
def draw_arcade_cabinet_red() -> Canvas:
    c = Canvas(16, 32)
    c.box(1, 2, 14, 29, R[3], R[0])
    # Narrow lit top roof cap (y=2..4)
    c.fill_rect(2, 3, 12, 2, R[5])
    c.hline(2, 13, 3, R[6])
    c.hline(1, 14, 5, R[0])

    # Glowing cyan/pink marquee header (y=6..8)
    c.fill_rect(2, 6, 12, 3, C[5])
    c.hline(2, 13, 6, C[6])
    c.hline(4, 11, 7, M[4])
    c.p(6, 7, S[7])
    c.hline(2, 13, 9, R[0])

    # Recessed CRT monitor (y=10..17) — bright fighting stage colors
    c.fill_rect(2, 10, 12, 8, S[1])
    c.fill_rect(3, 11, 10, 6, G[2])
    c.fill_rect(3, 11, 10, 2, Y[5])  # health bars at top
    c.p(7, 11, R[4])
    c.p(8, 11, R[4])
    c.fill_rect(4, 13, 3, 3, G[5])
    c.p(5, 13, S[7])
    c.fill_rect(9, 13, 3, 3, O[5])

    # White/silver candy-cab control deck (y=18..21)
    c.box(1, 18, 14, 4, S[5], S[0])
    c.hline(2, 13, 19, S[6])
    c.p(3, 18, K[5])  # P1 blue joystick
    c.p(4, 19, K[4])
    c.p(6, 19, R[5])
    c.p(9, 18, Y[5])  # P2 yellow joystick
    c.p(10, 19, O[5])
    c.p(12, 19, G[5])

    # Lower cabinet front & coin box (y=22..30)
    c.fill_rect(2, 22, 12, 8, R[2])
    c.vline(2, 22, 29, R[4])
    c.box(4, 23, 8, 6, S[2], S[0])
    c.fill_rect(5, 24, 6, 4, S[1])
    c.p(6, 25, Y[5])
    c.p(9, 25, Y[5])
    c.hline(5, 10, 27, S[4])
    c.hline(1, 14, 30, R[0])
    c.add_ground_shadow(1, 14, 31)
    return c


# ---------------------------------------------------------------------------
# 7. CLAW CRANE MACHINE (32x32, standing)
# Pink marquee + big glass box + hanging silver claw + 3 colorful plushies + prize chute
# ---------------------------------------------------------------------------
def draw_claw_crane_machine() -> Canvas:
    c = Canvas(32, 32)
    # Main silhouette (x=2..29, y=1..30) — NO side walls
    c.box(2, 1, 28, 30, P[4], P[0])
    # Narrow lit top lid (y=1..3)
    c.fill_rect(3, 2, 26, 2, P[6])
    c.hline(3, 28, 3, P[5])
    c.hline(2, 29, 4, P[0])

    # Glowing pink & gold UFO-catcher marquee (y=5..7)
    c.fill_rect(3, 5, 26, 3, P[5])
    c.hline(3, 28, 5, S[7])
    c.fill_rect(8, 6, 16, 1, Y[6])
    c.p(5, 6, C[6])
    c.p(26, 6, C[6])
    c.hline(2, 29, 8, P[0])

    # Large crystal glass showcase box (x=3..28, y=9..20)
    c.fill_rect(3, 9, 26, 12, K[4])
    c.fill_rect(3, 9, 26, 3, K[5])
    c.fill_rect(4, 12, 24, 9, K[3])
    # Overhead gantry rail + hanging silver metal claw
    c.hline(3, 28, 9, S[3])
    c.fill_rect(14, 9, 4, 2, S[5])
    c.vline(15, 11, 13, S[6])
    c.vline(16, 11, 13, S[4])
    # Open 3-prong claw (y=13..15)
    c.hline(13, 18, 13, S[7])
    c.p(13, 14, S[5])
    c.p(13, 15, S[6])
    c.p(18, 14, S[5])
    c.p(18, 15, S[6])
    c.p(15, 14, S[6])

    # 3 chunky recognizable plushies inside bottom of glass (y=16..20)
    # Left: yellow duck/chick plushie
    c.box(5, 16, 6, 5, Y[5], A[0])
    c.hline(6, 9, 17, Y[6])
    c.p(7, 18, O[4])
    # Center: pink bear plushie
    c.box(13, 16, 6, 5, P[5], P[0])
    c.hline(14, 17, 17, P[6])
    c.p(15, 18, S[7])
    # Right: mint/jade bunny plushie
    c.box(21, 16, 6, 5, J[5], J[0])
    c.hline(22, 25, 17, J[6])
    c.p(23, 18, S[7])

    # Crisp glass reflection streaks
    c.p(5, 11, S[7])
    c.p(6, 10, S[7])
    c.p(25, 12, K[6])
    c.p(26, 11, S[7])

    # Control deck ledge (y=21..23)
    c.box(2, 21, 28, 3, S[5], S[0])
    c.hline(3, 28, 22, S[6])
    c.fill_rect(14, 21, 2, 2, R[5])  # joystick
    c.p(18, 22, C[5])                # drop button
    c.p(20, 22, Y[5])

    # Lower pink cabinet with prize pickup chute & coin box (y=24..30)
    c.fill_rect(3, 24, 26, 6, P[3])
    c.vline(3, 24, 29, P[5])
    # Left dark prize drop chute (x=5..13, y=25..29)
    c.box(5, 25, 9, 5, S[1], S[0])
    c.hline(6, 12, 26, S[3])
    # Right coin slot panel (x=19..26, y=25..29)
    c.box(19, 25, 8, 5, S[5], S[0])
    c.p(21, 27, O[5])
    c.p(24, 27, G[5])
    c.hline(2, 29, 30, P[0])
    c.add_ground_shadow(2, 29, 31)
    return c


# ---------------------------------------------------------------------------
# 8. COIN CHANGER (16x32, standing)
# Gold/amber header + silver faceplate + bill acceptor + recessed coin tray
# ---------------------------------------------------------------------------
def draw_coin_changer() -> Canvas:
    c = Canvas(16, 32)
    # Full bold 14x27 silhouette (x=1..14, y=3..30) — NO side walls
    c.box(1, 3, 14, 28, S[3], S[0])
    # Narrow lit amber/gold top hood (y=3..6)
    c.box(1, 3, 14, 4, A[5], A[0])
    c.hline(2, 13, 4, A[6])
    c.hline(2, 13, 5, A[4])

    # Bright gold "COIN" sign band (y=7..11)
    c.box(1, 7, 14, 5, Y[4], A[0])
    c.fill_rect(2, 8, 12, 3, Y[5])
    c.hline(3, 12, 8, Y[6])
    # Bold coin icon cluster in center of banner
    c.fill_rect(6, 9, 4, 2, A[3])
    c.hline(7, 8, 9, Y[6])

    # Brushed steel faceplate (y=12..24)
    c.fill_rect(2, 12, 12, 13, S[5])
    c.vline(2, 12, 24, S[6])
    c.vline(13, 12, 24, S[3])
    # Bill acceptor on left (x=3..7, y=13..18)
    c.box(3, 13, 5, 6, S[1], S[0])
    c.hline(4, 6, 15, G[5])  # glowing green bill slot LED
    c.hline(4, 6, 16, S[0])
    # Digital red LED readout on right (x=9..12, y=13..16)
    c.box(9, 13, 4, 4, R[0], S[0])
    c.hline(10, 11, 14, R[5])
    # Recessed dark coin dispenser cup (x=4..11, y=20..24)
    c.box(4, 20, 8, 5, S[1], S[0])
    c.hline(5, 10, 21, S[2])
    c.p(7, 23, Y[5])  # shiny coin glint inside tray
    c.p(8, 23, Y[6])

    # Heavy dark steel pedestal base (y=25..30)
    c.box(1, 25, 14, 6, S[2], S[0])
    c.hline(2, 13, 26, S[3])
    c.fill_rect(3, 27, 10, 2, S[1])
    c.add_ground_shadow(1, 14, 31)
    return c


# ---------------------------------------------------------------------------
# 9. VENDING MACHINE DRINKS (32x32, standing)
# Wide modern Korean drink vendor: cobalt frame + 3 shelves of bright cans + pickup chute
# ---------------------------------------------------------------------------
def draw_vending_machine_drinks() -> Canvas:
    c = Canvas(32, 32)
    # Main body (x=2..29, y=1..30) — NO side walls
    c.box(2, 1, 28, 30, B[3], B[0])
    # Narrow lit top cap (y=1..4)
    c.fill_rect(3, 2, 26, 2, B[5])
    c.hline(3, 28, 2, B[6])
    c.hline(2, 29, 4, B[0])

    # Illuminated drink showcase window (x=4..21, y=6..20)
    c.box(4, 6, 18, 15, S[6], S[0])
    c.fill_rect(5, 7, 16, 13, K[6])
    # 3 crisp shelves with distinct colorful cans (2px wide each, separated cleanly)
    shelf_ys = (7, 11, 15)
    can_rows = [
        [R[4], R[4], O[5], Y[5], G[4], C[5]],
        [K[4], B[4], P[5], R[5], Y[5], J[4]],
        [G[4], C[4], O[4], B[5], R[4], M[5]],
    ]
    for row_idx, sy in enumerate(shelf_ys):
        c.hline(5, 20, sy + 3, S[3])  # shelf rail
        for ci, col in enumerate(can_rows[row_idx]):
            cx = 6 + ci * 2 + (ci // 2)  # crisp grouping
            if cx + 1 <= 19:
                c.fill_rect(cx, sy, 2, 3, col)
                c.p(cx, sy, S[7])  # specular dot on can top-left

    # Right control panel (x=23..28, y=6..20)
    c.box(23, 6, 6, 15, S[5], S[0])
    c.fill_rect(24, 7, 4, 3, B[1])   # LCD display
    c.hline(25, 26, 8, C[6])
    c.fill_rect(24, 11, 4, 2, S[1])  # bill slot
    c.p(25, 11, G[5])
    c.fill_rect(24, 14, 4, 4, S[3])  # keypad buttons
    c.p(25, 15, R[5])
    c.p(27, 15, Y[5])
    c.p(25, 17, C[5])
    c.p(27, 17, G[5])

    # Lower body & wide dark pickup chute (y=22..29)
    c.box(4, 22, 18, 7, S[1], S[0])
    c.hline(5, 20, 23, S[3])
    c.fill_rect(6, 25, 14, 3, S[0])
    # Bottom cobalt accent strip + feet
    c.hline(23, 28, 23, C[5])
    c.hline(23, 28, 25, B[4])
    c.hline(2, 29, 30, B[0])
    c.add_ground_shadow(2, 29, 31)
    return c


# ---------------------------------------------------------------------------
# 10. DRINK FRIDGE GLASS (16x32, standing)
# Tall glass-door convenience beverage cooler with 4 shelves + bottom grille
# ---------------------------------------------------------------------------
def draw_drink_fridge_glass() -> Canvas:
    c = Canvas(16, 32)
    # Outer white/silver fridge body (x=1..14, y=1..30) — NO side walls
    c.box(1, 1, 14, 30, S[5], S[0])
    # Narrow lit top lid (y=1..4)
    c.fill_rect(2, 2, 12, 2, S[6])
    c.hline(2, 13, 2, S[7])
    c.hline(1, 14, 4, S[0])

    # Illuminated cyan/white header lightbox (y=5..6)
    c.fill_rect(2, 5, 12, 2, C[5])
    c.hline(3, 12, 5, S[7])
    c.hline(1, 14, 7, S[0])

    # Tall glass showcase door (x=2..13, y=8..24)
    c.box(2, 8, 12, 17, K[3], S[1])
    c.fill_rect(3, 9, 10, 15, K[2])
    # 4 shelves of bright beverages
    shelf_specs = [
        (9,  [R[5], R[5], O[5], Y[5]]),
        (13, [C[5], K[5], B[5], C[5]]),
        (17, [G[5], J[5], Y[5], O[5]]),
        (21, [R[4], S[6], K[5], P[5]]),
    ]
    for sy, cols in shelf_specs:
        c.hline(3, 12, sy + 2, S[5])  # crisp shelf bar
        for i, col in enumerate(cols):
            bx = 4 + i * 2
            c.fill_rect(bx, sy, 2, 2, col)
            c.p(bx, sy, S[7])
    # Chrome door handle on left frame
    c.vline(2, 13, 18, S[7])
    # Subtle glass sheen
    c.p(11, 10, K[6])
    c.p(10, 11, K[6])

    # Bottom compressor louver grille (y=25..30)
    c.box(1, 25, 14, 6, S[2], S[0])
    c.hline(3, 12, 26, S[1])
    c.hline(3, 12, 27, S[4])
    c.hline(3, 12, 28, S[1])
    c.hline(3, 12, 29, S[4])
    c.add_ground_shadow(1, 14, 31)
    return c


# ---------------------------------------------------------------------------
# 11. RAMEN COOKER COUNTER (32x32, standing)
# Korean Han-River self-serve ramen induction station: water dispensers + golden/red pot + paneled wood front
# ---------------------------------------------------------------------------
def draw_ramen_cooker_counter() -> Canvas:
    c = Canvas(32, 32)
    # --- Rear Stainless Hot-Water Dispenser Tower (x=2..29, y=2..10) ---
    c.box(2, 2, 28, 9, S[4], S[0])
    c.hline(3, 28, 3, S[6])       # narrow top lip of dispenser hood
    c.hline(3, 28, 4, S[5])
    # Red accent header strip
    c.fill_rect(3, 5, 26, 2, R[4])
    c.hline(4, 27, 5, R[5])
    # Twin induction controller boxes + silver water spouts
    c.fill_rect(4, 7, 10, 3, S[1])
    c.p(6, 8, R[5])               # hot water LED
    c.p(8, 8, Y[6])               # timer LED
    c.fill_rect(10, 8, 2, 2, S[6]) # spout 1
    c.fill_rect(18, 7, 10, 3, S[1])
    c.p(20, 8, R[5])
    c.p(22, 8, G[5])
    c.fill_rect(24, 8, 2, 2, S[6]) # spout 2

    # --- Stainless Counter Top with Induction Pads & Ramen Pot (x=1..30, y=10..17) ---
    c.box(1, 10, 30, 8, S[5], S[0])
    c.hline(2, 29, 11, S[6])      # top-left bright stainless counter
    c.fill_rect(2, 12, 28, 5, S[5])
    # Left induction burner pad + iconic golden Korean ramen pot with red broth!
    c.box(4, 12, 10, 5, S[1], S[0])
    c.box(5, 11, 8, 5, Y[5], A[0])  # golden aluminum ramen pot
    c.hline(6, 11, 11, Y[6])        # gleaming pot rim highlight
    c.fill_rect(6, 12, 6, 3, R[4])  # spicy crimson ramen broth
    c.hline(7, 10, 13, O[5])        # noodles/broth swirl
    c.p(8, 12, Y[6])                # egg/noodle highlight
    c.p(7, 10, S[7])                # clean steam wisp
    c.p(10, 9, S[7])
    # Right induction pad (glowing red coil ready for next bowl)
    c.box(17, 12, 9, 5, S[1], S[0])
    c.rect(19, 13, 5, 3, R[4])
    c.p(21, 14, R[6])
    # Stack of paper ramen bowls on far right (x=27..29)
    c.fill_rect(27, 11, 3, 5, S[6])
    c.hline(27, 29, 12, O[5])
    c.hline(27, 29, 14, O[5])

    # --- Paneled Warm-Oak & Slate Front (y=18..30 -> 45% height!) ---
    c.box(1, 17, 30, 14, DW[6], DW[1])
    c.hline(2, 29, 18, WT[6])     # overhang lip highlight
    c.hline(2, 29, 19, DW[3])     # shadow under lip
    # 3 crisp recessed oak cabinet panels
    for px in (3, 12, 21):
        c.box(px, 20, 8, 8, WT[2], DW[1])
        c.hline(px + 1, px + 6, 21, WT[5])  # top-left bevel
        c.vline(px + 1, 21, 26, WT[5])
        c.hline(px + 2, px + 5, 22, S[5])   # steel pull handle
    # Dark slate baseboard kickplate
    c.fill_rect(2, 28, 28, 2, S[1])
    c.hline(1, 30, 30, S[0])
    c.add_ground_shadow(1, 30, 31)
    return c


# ---------------------------------------------------------------------------
# 12. SNACK SHELF RACK (32x32, standing)
# 4 crisp shelves packed with colorful cup-ramen tubs & chip bags
# ---------------------------------------------------------------------------
def draw_snack_shelf_rack() -> Canvas:
    c = Canvas(32, 32)
    # Outer steel gondola frame (x=1..30, y=2..30) — NO side walls
    c.box(1, 2, 30, 29, S[2], S[0])
    # Narrow lit top cap (y=2..4)
    c.fill_rect(2, 3, 28, 2, S[5])
    c.hline(2, 29, 3, S[6])
    # Bright crimson/amber convenience snack header strip (y=5..6)
    c.fill_rect(2, 5, 28, 2, R[4])
    c.hline(3, 28, 5, O[5])
    c.hline(2, 29, 7, S[0])

    # Dark interior backing
    c.fill_rect(2, 8, 28, 19, S[1])

    # 4 crisp shelves of snacks (y=8, 13, 18, 23)
    shelves = [
        # (y_top, list of (x, w, main_col, hi_col))
        (8,  [(3, 4, R[4], R[6]), (8, 4, R[4], Y[6]), (13, 4, O[4], O[6]),
              (18, 4, Y[4], Y[6]), (23, 5, A[4], A[6])]),  # Cup ramen row!
        (13, [(3, 5, K[4], K[6]), (9, 4, G[4], G[6]), (14, 5, R[5], S[7]),
              (20, 4, Y[5], Y[6]), (25, 4, P[5], P[6])]),  # Chip bags row
        (18, [(3, 4, Y[4], Y[6]), (8, 5, C[4], C[6]), (14, 4, O[5], O[6]),
              (19, 5, B[4], B[6]), (25, 4, R[4], R[6])]),  # Candy & biscuits
        (23, [(3, 5, R[3], R[5]), (9, 5, A[4], Y[5]), (15, 6, G[3], G[5]),
              (22, 6, K[3], K[5])]),                       # Multipack boxes
    ]
    for sy, items in shelves:
        c.hline(2, 29, sy + 4, S[5])  # bright metallic shelf lip
        c.hline(2, 29, sy + 3, S[3])
        for ix, iw, mcol, hcol in items:
            c.fill_rect(ix, sy, iw, 3, mcol)
            c.hline(ix, ix + iw - 1, sy, hcol)
            c.p(ix + 1, sy + 1, S[7] if iw >= 5 else hcol)

    # Solid steel kickplate base (y=28..30)
    c.fill_rect(2, 28, 28, 2, S[2])
    c.hline(2, 29, 28, S[3])
    c.hline(1, 30, 30, S[0])
    c.add_ground_shadow(1, 30, 31)
    return c


# ---------------------------------------------------------------------------
# 13. POS COUNTER DESK (48x32, standing)
# Paneled front 45% height (4 recessed panels + cyan LED strip) + lit counter top + POS register
# ---------------------------------------------------------------------------
def draw_pos_counter_desk() -> Canvas:
    c = Canvas(48, 32)
    # --- Counter Top Surface (x=1..46, y=10..16) ---
    c.box(1, 10, 46, 7, S[5], S[0])
    c.hline(2, 45, 11, S[6])      # top-left polished stone counter highlight
    c.fill_rect(2, 12, 44, 4, S[5])
    c.hline(2, 45, 15, S[4])

    # --- POS Touchscreen Terminal on Left (x=5..17, y=2..14) ---
    c.box(5, 2, 13, 9, S[1], S[0])
    c.hline(6, 16, 3, S[3])       # monitor top rim
    c.fill_rect(6, 4, 11, 6, K[3])
    c.fill_rect(7, 5, 5, 4, K[5])
    c.p(7, 5, S[7])
    c.fill_rect(13, 5, 3, 2, G[5]) # price/order confirmed box
    c.hline(13, 15, 8, Y[5])
    # POS neck + cash drawer on counter
    c.fill_rect(10, 11, 3, 2, S[2])
    c.box(5, 12, 13, 3, S[2], S[0])
    c.hline(6, 16, 13, S[4])

    # --- Card Reader & Service Tray in Center (x=21..29, y=10..14) ---
    c.box(21, 10, 5, 4, S[2], S[0])
    c.fill_rect(22, 11, 3, 2, C[5])  # contactless tap glow
    c.box(27, 11, 5, 3, B[2], B[0])  # blue order tray

    # --- Food Pickup Menu Sign & Call Bell on Right (x=34..43, y=4..14) ---
    c.box(34, 4, 10, 8, A[4], A[0])
    c.fill_rect(35, 5, 8, 6, S[1])
    c.hline(36, 41, 6, Y[5])
    c.hline(36, 40, 8, R[5])
    c.hline(36, 41, 9, C[5])
    c.fill_rect(38, 12, 2, 2, S[3])  # menu stand base
    c.box(41, 12, 3, 2, Y[5], A[0])  # brass service bell

    # --- Paneled Front Facade (y=16..30 -> 15px / 30px = 50% of counter height!) ---
    c.box(1, 16, 46, 15, S[2], S[0])
    c.hline(2, 45, 17, C[5])      # signature PC Bang glowing cyan under-counter LED strip!
    c.hline(2, 45, 18, S[1])      # crisp shadow beneath overhang
    # 4 crisp recessed dark-navy architectural panels (x=3, 14, 25, 36)
    for px in (3, 14, 25, 36):
        c.box(px, 19, 9, 9, B[1], S[0])
        c.hline(px + 1, px + 7, 20, B[3])  # top-left panel highlight bevel
        c.vline(px + 1, 20, 26, B[3])
        c.fill_rect(px + 2, 21, 6, 6, B[2])
        c.hline(px + 2, px + 7, 26, B[0])  # bottom shadow bevel
    # Dark steel toe-kick baseboard
    c.fill_rect(2, 28, 44, 2, S[1])
    c.hline(1, 46, 30, S[0])
    c.add_ground_shadow(1, 46, 31)
    return c


# ---------------------------------------------------------------------------
# 14. CAFE TABLE OAK (32x16, topdown - flat top >= 75%, empty surface, stub legs)
# Matches ref_base_tables_row_4x.png & ref_ezt_table_long_h.png camera!
# ---------------------------------------------------------------------------
def draw_cafe_table_oak() -> Canvas:
    c = Canvas(32, 16)
    # Flat top-down tabletop (x=1..30, y=1..12 -> 12px out of 15px = 80%!)
    c.box(1, 1, 30, 11, WT[2], DW[1])
    # Top-left bright oak bevel
    c.hline(2, 29, 2, WT[6])
    c.vline(2, 2, 10, WT[6])
    # Clean warm oak tabletop surface (EMPTY!) with subtle long horizontal planks
    c.fill_rect(3, 3, 27, 8, WT[3])
    c.hline(3, 29, 5, WT[2])
    c.hline(3, 29, 8, WT[2])
    c.hline(2, 29, 10, WT[0])     # bottom bevel of tabletop

    # Narrow 2px front table apron (y=12..13)
    c.fill_rect(1, 12, 30, 2, DW[3])
    c.hline(1, 30, 12, DW[6])
    c.hline(1, 30, 13, DW[1])
    c.vline(1, 12, 13, DW[1])
    c.vline(30, 12, 13, DW[1])

    # Crisp 2px stub legs (y=14..15)
    c.box(2, 13, 4, 3, DW[3], DW[1])
    c.p(3, 14, DW[6])
    c.box(26, 13, 4, 3, DW[3], DW[1])
    c.p(27, 14, DW[6])
    c.add_ground_shadow(6, 25, 14)
    c.add_ground_shadow(2, 29, 15)
    return c


# ---------------------------------------------------------------------------
# 15. CAFE STOOL (16x16, chair - near top-down facing DOWN)
# Oak frame + slate-navy padded seat so it pops on oak cafe floor!
# ---------------------------------------------------------------------------
def draw_cafe_stool() -> Canvas:
    c = Canvas(16, 16)
    # Compact oak low backrest along TOP (y=1..4, x=2..13)
    c.box(2, 1, 12, 4, WT[3], DW[1])
    c.hline(3, 12, 2, WT[6])      # top highlight
    c.hline(3, 12, 3, WT[2])

    # Top-down padded seat cushion framed in oak (y=5..12, x=1..14)
    c.box(1, 5, 14, 8, WT[2], DW[1])
    c.hline(2, 13, 6, WT[6])
    # Cool navy/slate seat cushion inset for high readability on warm oak floor
    c.box(3, 6, 10, 5, B[3], B[0])
    c.hline(4, 11, 7, B[5])       # top-left cushion shine
    c.fill_rect(4, 8, 8, 2, B[4])
    # Front oak seat edge
    c.hline(2, 13, 11, DW[6])

    # Two slim dark steel legs at bottom (y=13..14)
    c.fill_rect(2, 13, 3, 2, S[1])
    c.p(3, 13, S[3])
    c.hline(2, 4, 14, S[0])
    c.fill_rect(11, 13, 3, 2, S[1])
    c.p(12, 13, S[3])
    c.hline(11, 13, 14, S[0])
    c.add_ground_shadow(2, 13, 15)
    return c


# ---------------------------------------------------------------------------
# 16. VIP SOFA NAVY (32x16, topdown - near top-down plush lounge sofa, empty surface)
# ---------------------------------------------------------------------------
def draw_vip_sofa_navy() -> Canvas:
    c = Canvas(32, 16)
    # Outer dark cobalt outline (x=1..30, y=1..14)
    c.box(1, 1, 30, 14, B[3], B[0])
    # Padded backrest top crest (y=1..5)
    c.fill_rect(2, 2, 28, 3, B[4])
    c.hline(2, 29, 2, B[5])       # top-left lit leather sheen
    c.vline(15, 2, 12, B[1])      # center double-seat seam
    c.vline(16, 2, 12, B[1])
    c.hline(4, 27, 5, B[1])       # backrest-to-seat crease

    # Wide flat top-down plush seat cushions (y=6..12 -> flat top + back >= 78%!)
    c.fill_rect(4, 6, 11, 6, B[3])
    c.hline(5, 13, 6, B[5])
    c.fill_rect(5, 7, 9, 4, B[4])
    c.fill_rect(17, 6, 11, 6, B[3])
    c.hline(18, 26, 6, B[5])
    c.fill_rect(18, 7, 9, 4, B[4])
    # Top-down padded armrests on left (x=1..4) & right (x=27..30)
    c.box(1, 3, 4, 10, B[4], B[0])
    c.vline(2, 4, 11, B[5])
    c.box(27, 3, 4, 10, B[4], B[0])
    c.vline(28, 4, 11, B[5])

    # Narrow 2px front sofa base skirt (y=13..14) + stub feet (y=15)
    c.hline(2, 29, 13, B[2])
    c.hline(1, 30, 14, B[0])
    c.fill_rect(2, 14, 3, 2, S[0])
    c.p(3, 14, S[2])
    c.fill_rect(27, 14, 3, 2, S[0])
    c.p(28, 14, S[2])
    c.add_ground_shadow(5, 26, 15)
    return c


# ---------------------------------------------------------------------------
# 17. STORAGE LOCKER (16x32, standing)
# Two stacked steel locker doors with louvers + digital keypad locks
# ---------------------------------------------------------------------------
def draw_storage_locker() -> Canvas:
    c = Canvas(16, 32)
    # Main steel cabinet (x=1..14, y=2..30) — NO side walls
    c.box(1, 2, 14, 29, S[4], S[0])
    # Narrow lit steel top (y=2..5)
    c.fill_rect(2, 3, 12, 2, S[6])
    c.hline(2, 13, 3, S[7])
    c.hline(1, 14, 5, S[0])

    # Upper & lower locker doors (y=6..16 and y=17..27)
    for dy in (6, 17):
        c.box(2, dy, 12, 11, S[4], S[1])
        c.hline(3, 12, dy + 1, S[5])  # top-left door bevel
        c.vline(3, dy + 1, dy + 9, S[5])
        # 3 crisp ventilation louvers
        for ly in (dy + 2, dy + 4):
            c.hline(4, 10, ly, S[1])
            c.hline(4, 10, ly + 1, S[6])
        # Digital keypad lock & handle on right
        c.box(10, dy + 6, 3, 4, S[2], S[0])
        c.p(11, dy + 7, C[5])  # keypad LED
        c.p(11, dy + 8, Y[5])  # key/handle glint

    # Dark steel kickplate base (y=28..30)
    c.fill_rect(2, 28, 12, 2, S[1])
    c.hline(1, 14, 30, S[0])
    c.add_ground_shadow(1, 14, 31)
    return c


# ---------------------------------------------------------------------------
# 18. SERVER RACK (16x32, standing)
# Dark network / no-HDD server tower with 5 glowing LED server blades
# ---------------------------------------------------------------------------
def draw_server_rack() -> Canvas:
    c = Canvas(16, 32)
    # Dark steel rack silhouette (x=1..14, y=2..30) — NO side walls
    c.box(1, 2, 14, 29, S[1], S[0])
    # Narrow lit dark-steel top cap (y=2..5)
    c.fill_rect(2, 3, 12, 2, S[3])
    c.hline(2, 13, 3, S[4])
    c.hline(1, 14, 5, S[0])

    # Vertical rack rails (x=2, x=13)
    c.vline(2, 6, 28, S[2])
    c.vline(13, 6, 28, S[2])

    # 5 crisp horizontal server blades (y=7, 11, 15, 19, 23)
    blade_leds = [
        (G[5], C[6], G[5]),
        (C[5], C[6], Y[5]),
        (G[5], G[6], C[5]),
        (C[5], Y[5], G[5]),
        (G[5], C[5], R[5]),
    ]
    for idx, (l1, l2, l3) in enumerate(blade_leds):
        by = 7 + idx * 4
        c.fill_rect(3, by, 10, 3, S[2])
        c.hline(3, 12, by, S[3])      # top highlight of blade
        c.hline(4, 11, by + 1, S[0])  # drive bay vent line
        c.p(4, by + 1, l1)            # glowing status LEDs
        c.p(6, by + 1, l2)
        c.p(11, by + 1, l3)
        c.p(3, by + 1, S[5])          # silver rack pull handle left
        c.p(12, by + 1, S[5])         # silver rack pull handle right

    # Lower intake vent & feet (y=27..30)
    c.fill_rect(3, 27, 10, 2, S[1])
    c.hline(4, 11, 28, S[2])
    c.hline(1, 14, 30, S[0])
    c.add_ground_shadow(1, 14, 31)
    return c


# ---------------------------------------------------------------------------
# 19. STANDING FLOOR LAMP (16x32, slender)
# Thin 4px steel post + warm glowing drum shade + circular base on ground line
# ---------------------------------------------------------------------------
def draw_standing_floor_lamp() -> Canvas:
    c = Canvas(16, 32)
    # Warm glowing drum lamp shade at top (x=2..13, y=2..11 -> 12px wide)
    c.box(2, 2, 12, 10, A[5], A[0])
    # Narrow lit top rim of shade (y=2..4)
    c.hline(3, 12, 3, A[6])
    c.hline(3, 12, 4, A[4])
    # Glowing cream/amber shade face (y=5..10)
    c.fill_rect(3, 5, 10, 6, A[5])
    c.fill_rect(4, 5, 7, 5, Y[6])
    c.fill_rect(5, 6, 4, 3, S[7])  # bright warm bulb core glow
    c.hline(3, 12, 10, A[6])       # bright bottom diffuser edge

    # Thin upright brushed-steel post (x=6..9 = 4px wide with 1px S[0] outlines!)
    c.vline(6, 12, 27, S[0])
    c.vline(7, 12, 27, S[5])       # bright top-left steel specular
    c.vline(8, 12, 27, S[3])       # mid steel
    c.vline(9, 12, 27, S[0])
    # Warm brass collar tucked cleanly inside the outline below shade
    c.p(7, 12, Y[5])
    c.p(8, 12, A[4])

    # Circular stepped steel base plate (x=3..12, y=27..30)
    c.box(4, 27, 8, 3, S[3], S[0])
    c.box(3, 28, 10, 3, S[2], S[0])
    c.hline(4, 11, 28, S[5])       # lit base rim
    c.hline(4, 11, 29, S[3])
    c.add_ground_shadow(2, 13, 31)
    return c


# ---------------------------------------------------------------------------
# 20. TRASH RECYCLE BIN (16x16, standing)
# Dual-compartment Korean PC Bang steel recycling + general trash bin
# ---------------------------------------------------------------------------
def draw_trash_recycle_bin() -> Canvas:
    c = Canvas(16, 16)
    # Main steel bin silhouette (x=1..14, y=2..14) — NO side walls
    c.box(1, 2, 14, 13, S[4], S[0])
    # Narrow lit top lid with dual color-coded drop slots (y=2..5)
    c.fill_rect(2, 3, 12, 3, S[5])
    c.hline(2, 13, 3, S[6])
    c.fill_rect(3, 4, 4, 2, S[0])  # left slot opening
    c.hline(3, 6, 3, K[5])         # blue recycle rim
    c.fill_rect(9, 4, 4, 2, S[0])  # right slot opening
    c.hline(9, 12, 3, G[5])        # green general/bottle rim
    c.hline(1, 14, 6, S[0])

    # Front brushed-steel body split into 2 clear bins (y=7..14)
    c.fill_rect(2, 7, 12, 7, S[4])
    c.vline(2, 7, 13, S[5])
    c.vline(7, 7, 13, S[1])        # center divider seam
    c.vline(8, 7, 13, S[5])
    # Bold color-coded recycle icon bands for instant 1x read
    c.fill_rect(3, 8, 4, 4, K[4])
    c.hline(4, 5, 9, K[6])
    c.fill_rect(9, 8, 4, 4, G[4])
    c.hline(10, 11, 9, G[6])
    c.hline(2, 13, 13, S[2])
    c.add_ground_shadow(1, 14, 15)
    return c


# ---------------------------------------------------------------------------
# Registry + Metadata for manifest.json and notes.txt
# ---------------------------------------------------------------------------
OBJECT_SPECS: List[Dict] = [
    {
        "id": "pc_station_blue",
        "name_en": "Blue Gaming PC Station",
        "name_ko": "블루 게이밍 PC 좌석",
        "camera": "standing",
        "tiles": [2, 2],
        "canvas": [32, 32],
        "facing": "down",
        "description": "Wide gaming desk with glowing cyan-blue widescreen monitor, RGB keyboard, mouse, and glass-panel PC tower.",
        "tags": ["pc", "desk", "monitor", "gaming", "arena"],
        "readable_note": "Glowing cyan widescreen + RGB keyboard + dual-fan glass PC tower on wide desk",
        "score": 9.0,
        "fn": draw_pc_station_blue,
    },
    {
        "id": "pc_station_red",
        "name_en": "Red Dual-Monitor PC Rig",
        "name_ko": "레드 듀얼모니터 PC 좌석",
        "camera": "standing",
        "tiles": [2, 2],
        "canvas": [32, 32],
        "facing": "down",
        "description": "Dual-monitor red esports gaming station with crimson backlit keyboard and under-desk glowing tower.",
        "tags": ["pc", "desk", "dual-monitor", "gaming", "arena"],
        "readable_note": "Side-by-side twin glowing red/amber monitors + red LED desk trim & under-desk tower",
        "score": 9.0,
        "fn": draw_pc_station_red,
    },
    {
        "id": "gaming_chair_red",
        "name_en": "Red Gaming Chair",
        "name_ko": "레드 게이밍 의자",
        "camera": "chair",
        "tiles": [1, 1],
        "canvas": [16, 16],
        "facing": "down",
        "description": "Near top-down crimson and slate racing gaming chair facing down with bolster backrest along top edge.",
        "tags": ["chair", "gaming", "red", "arena"],
        "readable_note": "High crimson-bolstered racing headrest at top + dark seat cushion & armrests",
        "score": 8.5,
        "fn": draw_gaming_chair_red,
    },
    {
        "id": "gaming_chair_blue",
        "name_en": "Blue Gaming Chair",
        "name_ko": "블루 게이밍 의자",
        "camera": "chair",
        "tiles": [1, 1],
        "canvas": [16, 16],
        "facing": "down",
        "description": "Near top-down cobalt and cyan racing gaming chair facing down with bolster backrest along top edge.",
        "tags": ["chair", "gaming", "blue", "arena"],
        "readable_note": "Cobalt racing backrest with cyan neck pillow at top + dark seat cushion",
        "score": 8.5,
        "fn": draw_gaming_chair_blue,
    },
    {
        "id": "arcade_cabinet_blue",
        "name_en": "Blue Retro Arcade Cabinet",
        "name_ko": "블루 레트로 오락기",
        "camera": "standing",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Classic cobalt upright arcade cabinet with glowing yellow marquee, blue CRT screen, red joystick deck, and coin door.",
        "tags": ["arcade", "retro", "cabinet", "blue"],
        "readable_note": "Glowing yellow marquee + bright CRT screen + red joystick deck + twin orange coin slots",
        "score": 9.0,
        "fn": draw_arcade_cabinet_blue,
    },
    {
        "id": "arcade_cabinet_red",
        "name_en": "Red Fighting Arcade Cabinet",
        "name_ko": "레드 대전 오락기",
        "camera": "standing",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Crimson retro fighting arcade cabinet with cyan marquee, health-bar CRT screen, and silver twin-stick control deck.",
        "tags": ["arcade", "retro", "cabinet", "red"],
        "readable_note": "Cyan marquee + fighting-game health-bar CRT + white twin-joystick deck on red body",
        "score": 9.0,
        "fn": draw_arcade_cabinet_red,
    },
    {
        "id": "claw_crane_machine",
        "name_en": "Claw Crane Machine",
        "name_ko": "인형뽑기 기계",
        "camera": "standing",
        "tiles": [2, 2],
        "canvas": [32, 32],
        "facing": "down",
        "description": "Wide pink-and-glass Korean UFO catcher claw crane with hanging silver claw, three colorful plushies, and prize chute.",
        "tags": ["arcade", "claw", "crane", "plushie"],
        "readable_note": "Pink marquee + large glass showcase with hanging metal claw over 3 bright plushies + chute",
        "score": 9.5,
        "fn": draw_claw_crane_machine,
    },
    {
        "id": "coin_changer",
        "name_en": "Arcade Coin Changer",
        "name_ko": "동전교환기",
        "camera": "standing",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Tall arcade bill-to-coin changer kiosk with amber-gold banner, brushed steel face, green bill slot, and coin tray.",
        "tags": ["arcade", "coin", "kiosk"],
        "readable_note": "Bold gold coin header + silver face with green bill slot & dark coin dispenser cup",
        "score": 8.5,
        "fn": draw_coin_changer,
    },
    {
        "id": "vending_machine_drinks",
        "name_en": "Drink Vending Machine",
        "name_ko": "음료 자판기",
        "camera": "standing",
        "tiles": [2, 2],
        "canvas": [32, 32],
        "facing": "down",
        "description": "Wide cobalt Korean beverage vending machine with illuminated 3-shelf can display, right control panel, and lower pickup chute.",
        "tags": ["vending", "drinks", "cafe", "lobby"],
        "readable_note": "Lit white display window with 3 rows of bright cans + side keypad + dark lower pickup chute",
        "score": 9.0,
        "fn": draw_vending_machine_drinks,
    },
    {
        "id": "drink_fridge_glass",
        "name_en": "Glass Drink Fridge",
        "name_ko": "유리문 음료 냉장고",
        "camera": "standing",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Tall glass-door convenience beverage refrigerator with cyan top lightbox, 4 stocked shelves, chrome handle, and bottom grille.",
        "tags": ["fridge", "drinks", "cafe", "convenience"],
        "readable_note": "Cyan lightbox header + tall glass door packed with 4 colorful drink shelves + bottom vents",
        "score": 9.0,
        "fn": draw_drink_fridge_glass,
    },
    {
        "id": "ramen_cooker_counter",
        "name_en": "Self-Serve Ramen Cooker Counter",
        "name_ko": "즉석 라면 조리기 카운터",
        "camera": "standing",
        "tiles": [2, 2],
        "canvas": [32, 32],
        "facing": "down",
        "description": "Korean self-serve induction ramen station with rear hot-water spouts, steaming golden pot on burner, and 3-panel oak front.",
        "tags": ["ramen", "cooker", "cafe", "korean"],
        "readable_note": "Red header water spouts + golden pot with red broth & steam on stainless top + paneled oak front",
        "score": 9.5,
        "fn": draw_ramen_cooker_counter,
    },
    {
        "id": "snack_shelf_rack",
        "name_en": "Snack & Cup-Ramen Shelf Rack",
        "name_ko": "과자·컵라면 진열대",
        "camera": "standing",
        "tiles": [2, 2],
        "canvas": [32, 32],
        "facing": "down",
        "description": "Wide steel convenience snack display gondola with red header and 4 shelves stocked with cup ramen tubs and bright snack bags.",
        "tags": ["snacks", "ramen", "shelf", "cafe"],
        "readable_note": "4 crisp silver shelves lined with colorful cup-ramen and chip packs in dark steel rack",
        "score": 9.0,
        "fn": draw_snack_shelf_rack,
    },
    {
        "id": "pos_counter_desk",
        "name_en": "POS Reception Counter Desk",
        "name_ko": "카운터 · 포스 데스크",
        "camera": "standing",
        "tiles": [3, 2],
        "canvas": [48, 32],
        "facing": "down",
        "description": "Three-tile PC Bang reception counter with 4 recessed navy front panels, cyan under-lip LED strip, POS touchscreen, and menu board.",
        "tags": ["counter", "pos", "lobby", "reception"],
        "readable_note": "45%-height 4-panel front + cyan LED strip + glowing POS register & menu sign on lit top",
        "score": 9.5,
        "fn": draw_pos_counter_desk,
    },
    {
        "id": "cafe_table_oak",
        "name_en": "Oak Ramen Cafe Table",
        "name_ko": "오크 라면카페 테이블",
        "camera": "topdown",
        "tiles": [2, 1],
        "canvas": [32, 16],
        "facing": "down",
        "description": "Top-down warm oak dining table with clean empty flat top (>=75% height), narrow front apron, and 2px stub legs.",
        "tags": ["table", "cafe", "oak", "topdown"],
        "readable_note": "Clean top-down beveled warm oak tabletop with narrow apron & twin dark stub legs",
        "score": 9.0,
        "fn": draw_cafe_table_oak,
    },
    {
        "id": "cafe_stool",
        "name_en": "Cafe Dining Stool",
        "name_ko": "카페 의자 스툴",
        "camera": "chair",
        "tiles": [1, 1],
        "canvas": [16, 16],
        "facing": "down",
        "description": "Near top-down low-back oak cafe chair facing down with contrasting navy padded seat cushion and dark steel legs.",
        "tags": ["chair", "stool", "cafe"],
        "readable_note": "Oak top backrest + contrasting cobalt seat cushion framed in oak + twin steel stubs",
        "score": 8.5,
        "fn": draw_cafe_stool,
    },
    {
        "id": "vip_sofa_navy",
        "name_en": "VIP Navy Lounge Sofa",
        "name_ko": "VIP 네이비 소파",
        "camera": "topdown",
        "tiles": [2, 1],
        "canvas": [32, 16],
        "facing": "down",
        "description": "Near top-down two-seat plush cobalt-navy VIP lounge sofa with lit backrest crest, twin empty seat cushions, and padded arms.",
        "tags": ["sofa", "vip", "lounge", "topdown"],
        "readable_note": "Two plush cobalt-blue cushions flanked by armrests & top backrest crest",
        "score": 9.0,
        "fn": draw_vip_sofa_navy,
    },
    {
        "id": "storage_locker",
        "name_en": "Steel Storage Locker",
        "name_ko": "철제 사물함",
        "camera": "standing",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Tall cool-steel two-tier PC Bang bag locker with ventilation louvers and glowing cyan digital keypad locks.",
        "tags": ["locker", "storage", "lobby"],
        "readable_note": "Two stacked steel locker doors with horizontal louvers & digital keypad locks",
        "score": 8.5,
        "fn": draw_storage_locker,
    },
    {
        "id": "server_rack",
        "name_en": "No-HDD Game Server Rack",
        "name_ko": "게임 서버 랙",
        "camera": "standing",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Dark steel PC Bang network server cabinet housing five horizontal server blades with glowing cyan, green, and amber LEDs.",
        "tags": ["server", "rack", "tech", "arena"],
        "readable_note": "Dark rack frame with 5 distinct horizontal server blades & bright cyan/green status LEDs",
        "score": 9.0,
        "fn": draw_server_rack,
    },
    {
        "id": "standing_floor_lamp",
        "name_en": "Standing Floor Lamp",
        "name_ko": "스탠딩 플로어 램프",
        "camera": "slender",
        "tiles": [1, 2],
        "canvas": [16, 32],
        "facing": "down",
        "description": "Slender brushed-steel floor lamp with warm glowing cream-amber drum shade, thin upright shaft, and stepped circular base.",
        "tags": ["lamp", "light", "slender", "decor"],
        "readable_note": "Glowing warm amber-cream drum shade atop thin 4px steel post & circular floor base",
        "score": 9.0,
        "fn": draw_standing_floor_lamp,
    },
    {
        "id": "trash_recycle_bin",
        "name_en": "Dual Trash & Recycle Bin",
        "name_ko": "분리수거 쓰레기통",
        "camera": "standing",
        "tiles": [1, 1],
        "canvas": [16, 16],
        "facing": "down",
        "description": "Compact brushed-steel dual recycling and waste bin with blue/green color-coded top slots and front compartment labels.",
        "tags": ["trash", "recycle", "bin", "utility"],
        "readable_note": "Compact steel twin-slot bin with bold blue & green recycling color bands",
        "score": 8.5,
        "fn": draw_trash_recycle_bin,
    },
]


def build_objects() -> Dict[str, Canvas]:
    OBJECTS_DIR.mkdir(parents=True, exist_ok=True)
    built: Dict[str, Canvas] = {}
    manifest: List[Dict] = []
    notes_lines: List[str] = ["gemini-4-neon high"]

    for spec in OBJECT_SPECS:
        obj_id = spec["id"]
        canvas = spec["fn"]()
        out_path = OBJECTS_DIR / f"{obj_id}.png"
        canvas.save(out_path)
        built[obj_id] = canvas

        bx, by, bw, bh = canvas.opaque_bbox()
        manifest.append({
            "file": f"objects/{obj_id}.png",
            "id": obj_id,
            "name_en": spec["name_en"],
            "name_ko": spec["name_ko"],
            "camera": spec["camera"],
            "tiles": spec["tiles"],
            "canvas": spec["canvas"],
            "opaque_size": [bw, bh],
            "facing": spec["facing"],
            "description": spec["description"],
            "tags": spec["tags"],
        })
        notes_lines.append(
            f"{obj_id} | opaque={bw}x{bh} | camera={spec['camera']} | {spec['readable_note']} | self_score={spec['score']:.1f}/10"
        )

    with open(OUT_ROOT / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with open(OUT_ROOT / "notes.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(notes_lines) + "\n")

    return built


if __name__ == "__main__":
    objs = build_objects()
    print(f"Built {len(objs)} objects in {OBJECTS_DIR}")
