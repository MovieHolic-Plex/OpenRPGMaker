#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 09: Parks, Culture & Recreation Pavilions (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Top-3/4 RPG camera angle (Fable 5.2 baseline): visible sunlit pitched/domed/garden roofs,
top-left directional sunlight, warm-violet/slate ink outlines, luminous interiors,
lush organic park foliage, zero cloned floors (G4), rich 45-80 color shading.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, C, hsh, shade_rgba, OUT_ROOT

BATCH = 'pack09_park_recreation'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', BATCH)


# ---------------------------------------------------------------------------
# Shared Park & Cultural Pavilion Pixel-Art Helpers (100% palette-locked)
# ---------------------------------------------------------------------------

def draw_ashlar(cv, x0, y0, x1, y1, ramp='stone', base_i=4, bw=10, bh=5, seed=0):
    """Hand-varied limestone / stone ashlar masonry with sunlit bevels and mortar."""
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        ci = ry // bh
        yy = ry % bh
        off = (bw // 2) if (ci % 2 == 1) else 0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = (x - x0) + off
            bi = rx // bw
            bx = rx % bw
            r = hsh(bi, ci, seed)
            if yy == bh - 1 or bx == bw - 1:
                cv.p(x, y, col(ramp, max(0, base_i - 2)))
            elif yy == 0:
                cv.p(x, y, col(ramp, min(6, base_i + (1 if r > 0.3 else 0))))
            else:
                t = base_i + (1 if r > 0.78 else (-1 if r < 0.22 else 0))
                cv.p(x, y, col(ramp, max(1, t)))


def draw_steps(cv, x0, y0, x1, y1, count=4, ramp='stone', cheek_ramp=None):
    """Top-3/4 stone/wood staircase with sunlit treads, shaded risers, and optional cheek walls."""
    h = max(1, y1 - y0)
    sh = max(2, h // max(1, count))
    for i in range(count):
        sy0 = y0 + i * sh
        sy1 = y1 if i == count - 1 else min(y1, sy0 + sh)
        if sy0 >= y1:
            break
        inset = max(0, (count - 1 - i) // 2)
        sx0, sx1 = x0 + inset, x1 - inset
        # Top tread
        cv.hline(sx0, sx1, sy0, col(ramp, 6))
        if sy0 + 1 < sy1:
            cv.hline(sx0, sx1, sy0 + 1, col(ramp, 5))
        # Riser
        for ry in range(sy0 + 2, sy1):
            cv.hline(sx0, sx1, ry, col(ramp, 3 if ry < sy1 - 1 else 1))
        if sy1 - sy0 == 2:
            cv.hline(sx0, sx1, sy0 + 1, col(ramp, 2))
        cv.p(sx0, sy0, col(ramp, 2))
        cv.p(sx1 - 1, sy0, col(ramp, 1))
    if cheek_ramp:
        cv.outline_box(x0 - 3, y0, x0 + 1, y1, col(cheek_ramp, 4), col(cheek_ramp, 1), top_hi=col(cheek_ramp, 6))
        cv.outline_box(x1 - 1, y0, x1 + 3, y1, col(cheek_ramp, 3), col(cheek_ramp, 1), top_hi=col(cheek_ramp, 5))


def draw_hipped_roof(cv, x0, y0, x1, y1, ramp='kawara', top_inset=12, moss_rate=0.06, ridge_ramp=None, seed=0, upturned=False):
    """Top-3/4 hipped shingle/kawara roof with tapered hips, ridge cap, staggered tiles & eaves."""
    w = x1 - x0
    h = y1 - y0
    rramp = ridge_ramp or ramp
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        frac = ry / max(1, h - 1)
        if upturned:
            # Gentle traditional concave curve near eaves
            cur_in = int(round(top_inset * ((1.0 - frac) ** 1.25)))
        else:
            cur_in = int(round(top_inset * (1.0 - frac)))
        lx = x0 + cur_in
        rx = x1 - cur_in
        if rx <= lx + 2:
            continue
        for x in range(max(0, lx), min(cv.w, rx)):
            dx = x - lx
            rw = rx - lx
            if ry == 0:
                cv.p(x, y, col(rramp, 1) if dx in (0, rw - 1) else col(rramp, 6))
            elif ry == 1:
                cv.p(x, y, col(rramp, 5 if dx % 3 != 2 else 4))
            elif ry == 2:
                cv.p(x, y, col(ramp, 1))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                cv.p(x, y, col(ramp, 1 if (x % 4 != 0) else 2))
            elif dx == 0:
                cv.p(x, y, col(ramp, 1))
            elif dx == 1:
                cv.p(x, y, col(ramp, 5))
            elif dx == rw - 1:
                cv.p(x, y, col(ramp, 0))
            elif dx == rw - 2:
                cv.p(x, y, col(ramp, 1))
            else:
                ci = (ry - 3) // 4
                yy = (ry - 3) % 4
                tw = 4
                bx = (x + (2 if ci % 2 else 0)) % tw
                bi = (x + (2 if ci % 2 else 0)) // tw
                r = hsh(bi, ci, seed)
                right_sh = 1 if dx >= rw - 5 else 0
                if yy == 3 or bx == tw - 1:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                elif moss_rate > 0 and r > 1.0 - moss_rate and ry >= h // 2:
                    cv.p(x, y, col('moss', 3 if yy <= 1 else 2))
                else:
                    base_t = 4 if ry < h // 2 else 3
                    if r > 0.78:
                        base_t += 1
                    elif r < 0.22:
                        base_t -= 1
                    if yy == 0 and bx == 0:
                        base_t += 1
                    cv.p(x, y, col(ramp, max(1, base_t - right_sh)))


def draw_lantern(cv, cx, cy, warm=True, hanging=True):
    """Compact glowing paper/brass park lantern."""
    if hanging:
        cv.p(cx, cy - 3, col('steel', 1))
    cv.hline(cx - 1, cx + 2, cy - 2, col('darkwood', 1))
    for y in range(cy - 1, cy + 2):
        for x in range(cx - 1, cx + 2):
            if warm:
                cv.p(x, y, col('yellow', 5) if (x == cx and y == cy) else col('orange', 4 if y == cy - 1 else 5))
            else:
                cv.p(x, y, col('white', 6) if x == cx else col('cream', 5))
    cv.hline(cx - 1, cx + 2, cy + 2, col('darkwood', 1))


def draw_arched_glass_bay(cv, x0, y0, x1, y1, frame_ramp='white', frame_i=5, seed=0, plants=True, blossoms=True, warm_glow=False):
    """Tall arched glass conservatory bay with iron frame, sky sheen & optional interior foliage/blossoms."""
    w = x1 - x0
    h = y1 - y0
    cx = (x0 + x1 - 1) / 2.0
    arch_r = max(2, w // 2)
    arch_cy = y0 + arch_r
    c_frame = col(frame_ramp, frame_i)
    c_frame_hi = col(frame_ramp, min(6, frame_i + 1))
    c_frame_sh = col(frame_ramp, max(0, frame_i - 3))
    c_outline = col('steel', 1)

    for y in range(y0, y1):
        for x in range(x0, x1):
            in_arch = True
            on_edge = False
            if y < arch_cy:
                dx = (x - cx) / max(1.0, arch_r - 0.5)
                dy = (y - arch_cy) / max(1.0, arch_r - 0.5)
                d = math.hypot(dx, dy)
                if d > 1.05:
                    in_arch = False
                elif d > 0.80:
                    on_edge = True
            else:
                if x == x0 or x == x1 - 1 or y == y1 - 1:
                    on_edge = True
            if not in_arch:
                continue
            if on_edge:
                cv.p(x, y, c_frame_hi if (x < cx and y < arch_cy) else (c_frame if x == x0 else c_frame_sh))
                continue

            rx, ry = x - x0, y - y0
            # Background glass fill with subtle sky reflection diagonal
            if warm_glow and ry > h // 2:
                g = col('yellow', 4) if (rx + ry) % 3 == 0 else col('orange', 4)
            elif (rx + ry) % 11 in (2, 3) and ry < h - 5:
                g = col('glass', 6)
            elif (rx + ry) % 11 == 4 and ry < h - 4:
                g = col('glass', 5)
            elif ry < 4:
                g = col('glass', 3)
            else:
                g = col('glass', 4 if (rx + ry) % 5 == 0 else 2)
            cv.p(x, y, g)

            # Interior lush plants visible behind the glass!
            if plants and ry >= h // 3:
                p_wave = math.sin((rx * 0.7) + seed) * 2.5
                if ry > h * 0.45 + p_wave:
                    r = hsh(x, y, seed + 17)
                    if r > 0.25:
                        lt = 5 if (rx < w // 2 and r > 0.65) else (4 if r > 0.45 else 2)
                        # Blend slightly cooler/richer behind glass
                        cv.p(x, y, col('foliage', lt) if r > 0.38 else col('green', max(1, lt - 1)))
                        if blossoms and ry > h * 0.55 and r > 0.88:
                            cv.p(x, y, col('pink', 4 if (x + seed) % 2 == 0 else 5) if (y + seed) % 3 != 0 else col('yellow', 5))

    # Crisp thin iron mullions (crossbars)
    mx = (x0 + x1) // 2
    if w >= 10:
        cv.vline(mx, y0 + 2, y1 - 1, c_frame_sh)
    for my in range(y0 + arch_r + 4, y1 - 4, 8):
        cv.hline(x0 + 1, x1 - 1, my, c_frame_sh)
    # Bottom sill
    cv.hline(x0, x1, y1 - 1, c_outline)


def draw_water_pool(cv, x0, y0, x1, y1, ramp='teal', seed=0, shimmer=True):
    """Top-3/4 shimmering turquoise/lake water surface with depth shading and sunlit ripples."""
    h = max(1, y1 - y0)
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = x - x0
            r = hsh(rx // 3, ry, seed)
            if ry == 0:
                cv.p(x, y, col(ramp, 1))
            elif ry == 1:
                cv.p(x, y, col(ramp, 2))
            elif shimmer and ((rx + ry * 3) % 13 in (0, 1, 2)) and r > 0.55:
                cv.p(x, y, col('glass', 6) if r > 0.80 else col(ramp, 5))
            elif r > 0.72:
                cv.p(x, y, col(ramp, 4))
            elif r < 0.25:
                cv.p(x, y, col(ramp, 2))
            else:
                cv.p(x, y, col(ramp, 3))


def draw_bush_hedge(cv, x0, y0, x1, y1, ramp='foliage', blossom=None, seed=0):
    """Trimmed park shrubbery / hedge with top-left sunlight and textured leafy canopy."""
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        h = max(1, y1 - y0)
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = x - x0
            w = max(1, x1 - x0)
            # Soft rounded corners
            if ry == 0 and (rx in (0, w - 1)):
                continue
            r = hsh(x, y, seed)
            if ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2 or rx == w - 1:
                cv.p(x, y, col(ramp, 1))
            elif ry <= 2:
                cv.p(x, y, col(ramp, 6 if r > 0.55 else 5))
            elif ry < h // 2:
                cv.p(x, y, col(ramp, 5 if r > 0.65 else 4))
            else:
                cv.p(x, y, col(ramp, 3 if r > 0.45 else 2))
            if blossom and 1 <= ry <= h - 3 and r > 0.88:
                cv.p(x, y, blossom)


def draw_cypress(cv, cx, y0, y1, max_rx=5, seed=0):
    """Slender vertical park cypress / ornamental conifer tree."""
    h = max(1, y1 - y0)
    for y in range(max(0, y0), min(cv.h, y1 - 3)):
        f = (y - y0) / max(1, h - 4)
        rad = max(1, int(round(max_rx * math.sin(min(1.0, f * 1.15) * math.pi * 0.85))))
        for x in range(cx - rad, cx + rad + 1):
            dx = (x - cx) / max(1, rad)
            r = hsh(x, y, seed)
            if abs(dx) > 0.85 and r < 0.35:
                continue
            if dx < -0.25:
                cv.p(x, y, col('foliage', 5 if r > 0.5 else 4))
            elif dx < 0.35:
                cv.p(x, y, col('foliage', 3 if r > 0.4 else 2))
            else:
                cv.p(x, y, col('foliage', 1))
    # Trunk base
    cv.rect(cx - 1, y1 - 4, cx + 2, y1, col('wood', 2))
    cv.vline(cx - 1, y1 - 4, y1, col('wood', 3))
    cv.hline(cx - 2, cx + 3, y1 - 1, col('ink', 1))


# ---------------------------------------------------------------------------
# 1. Grand Botanical Glass Conservatory (128x112)
# ---------------------------------------------------------------------------

def build_pk_glass_conservatory():
    cv = Canvas(128, 112)
    seed = 901

    # --- Flanking Glass Wings Roofs (pitched glass bays left & right) ---
    for wx0, wx1, s_off in ((4, 38, 11), (90, 124, 29)):
        # Pitched sunlit glass roof
        for y in range(28, 48):
            ry = y - 28
            inset = max(0, (19 - ry) // 4)
            lx = wx0 + (inset if wx0 < 40 else 0)
            rx = wx1 - (0 if wx0 < 40 else inset)
            for x in range(lx, rx):
                rx_local = x - wx0
                if ry == 0:
                    cv.p(x, y, col('white', 6))
                elif ry == 1:
                    cv.p(x, y, col('coolwhite', 3))
                elif ry == 19:
                    cv.p(x, y, col('steel', 1))
                elif ry == 18:
                    cv.p(x, y, col('white', 5))
                elif rx_local % 8 == 0:
                    cv.p(x, y, col('white', 5 if ry < 10 else 4))
                elif rx_local % 8 == 1:
                    cv.p(x, y, col('steel', 2))
                elif ry in (7, 13):
                    cv.p(x, y, col('coolwhite', 2))
                else:
                    # Shimmering glass with lush green palm glow inside
                    diag = (rx_local + ry) % 9
                    if diag in (1, 2):
                        cv.p(x, y, col('glass', 6))
                    elif ry > 9 and hsh(x, y, seed + s_off) > 0.45:
                        cv.p(x, y, col('green', 3 if ry < 14 else 2))
                    else:
                        cv.p(x, y, col('glass', 4 if diag == 3 else 3))
        # Ornamental Victorian white-iron roof cresting
        for x in range(wx0 + 5, wx1 - 3, 4):
            cv.p(x, 27, col('white', 5))
            cv.p(x, 26, col('coolwhite', 3))

    # --- Center Stepped Shimmering Glass Dome + Cupola Lantern ---
    cx = 64
    # Finial spire at top
    cv.vline(cx, 1, 7, col('yellow', 5))
    cv.p(cx, 1, col('white', 6))
    cv.hline(cx - 1, cx + 2, 5, col('yellow', 4))
    # Upper cupola lantern (y=6..18)
    for y in range(6, 19):
        ry = y - 6
        rad = 6 + int(round(5 * math.sin((ry / 12.0) * math.pi * 0.5))) if ry < 6 else 11
        for x in range(cx - rad, cx + rad + 1):
            dx = x - cx
            if abs(dx) == rad or ry in (0, 6, 12):
                cv.p(x, y, col('white', 6 if dx <= 0 else 4))
            elif abs(dx) in (0, 5):
                cv.p(x, y, col('coolwhite', 3))
            elif ry > 6:
                cv.p(x, y, col('glass', 6 if (dx + ry) % 4 == 0 else (5 if dx < 0 else 3)))
            else:
                cv.p(x, y, col('glass', 5 if dx < 0 else 4))
    cv.hline(cx - 12, cx + 13, 18, col('steel', 1))
    cv.hline(cx - 13, cx + 14, 19, col('white', 6))

    # Main stepped grand dome (y=19..46)
    for y in range(19, 46):
        ry = y - 19
        frac = ry / 26.0
        # Stepped Victorian ogee-curved dome profile
        rad = int(round(12 + 21 * math.sin(frac * math.pi * 0.55)))
        for x in range(cx - rad, cx + rad + 1):
            dx = x - cx
            if abs(dx) == rad:
                cv.p(x, y, col('steel', 1))
            elif abs(dx) == rad - 1:
                cv.p(x, y, col('white', 6 if dx < 0 else 3))
            elif ry in (0, 9, 18, 25):
                cv.p(x, y, col('white', 6 if dx < 4 else 4))
            elif ry in (1, 10, 19):
                cv.p(x, y, col('steel', 2))
            else:
                # Curved iron ribs radiating down the dome
                rib_pos = [int(round(k * rad / 4.0)) for k in (-3, -2, -1, 0, 1, 2, 3)]
                if dx in rib_pos:
                    cv.p(x, y, col('white', 5 if dx <= 0 else 3))
                elif (dx - 1) in rib_pos and dx > 0:
                    cv.p(x, y, col('steel', 2))
                else:
                    # Shimmering glass dome panes + warm emerald canopy peeking through bottom half
                    r = hsh(x, y, seed + 5)
                    if dx < -rad // 4 and (dx + ry) % 5 in (0, 1):
                        cv.p(x, y, col('glass', 6))
                    elif ry > 12 and abs(dx) < rad - 4 and r > 0.35:
                        cv.p(x, y, col('foliage', 5 if dx < 0 else 3) if r > 0.55 else col('green', 3))
                        if ry > 17 and r > 0.87:
                            cv.p(x, y, col('pink', 5) if (x % 2 == 0) else col('yellow', 5))
                    else:
                        cv.p(x, y, col('glass', 5 if dx < 0 else (3 if dx < rad // 2 else 2)))

    # Grand dome cornice frieze
    cv.outline_box(30, 44, 98, 50, col('white', 5), col('steel', 1), top_hi=col('white', 6), bot_sh=col('coolwhite', 2))
    for x in range(33, 96, 4):
        cv.p(x, 47, col('steel', 3))
        cv.p(x + 1, 46, col('white', 6))

    # --- Wing Walls & Center Pavilion Structure ---
    # Outer white-iron & stone frame
    cv.rect(4, 48, 34, 108, col('white', 4))
    cv.rect(94, 48, 124, 108, col('white', 4))
    cv.rect(32, 50, 96, 108, col('white', 5))

    # Stone ashlar kneewalls along base of wings & center flanks
    draw_ashlar(cv, 4, 88, 34, 108, ramp='stone', base_i=5, bw=8, bh=5, seed=seed + 1)
    draw_ashlar(cv, 94, 88, 124, 108, ramp='stone', base_i=4, bw=8, bh=5, seed=seed + 2)
    draw_ashlar(cv, 32, 90, 50, 108, ramp='cream', base_i=4, bw=7, bh=5, seed=seed + 3)
    draw_ashlar(cv, 78, 90, 96, 108, ramp='cream', base_i=4, bw=7, bh=5, seed=seed + 4)

    # Stone cap mouldings
    for x0, x1, yy in ((4, 34, 87), (94, 124, 87), (32, 50, 89), (78, 96, 89)):
        cv.hline(x0, x1, yy, col('white', 6))
        cv.hline(x0, x1, yy + 1, col('stone', 2))

    # --- Tall Arched Glass Walls with Lush Palms & Blossoms Inside ---
    # Left wing: 2 arched bays
    draw_arched_glass_bay(cv, 6, 51, 19, 87, frame_ramp='white', frame_i=5, seed=101, plants=True, blossoms=True)
    draw_arched_glass_bay(cv, 20, 51, 33, 87, frame_ramp='white', frame_i=5, seed=102, plants=True, blossoms=True)
    # Right wing: 2 arched bays
    draw_arched_glass_bay(cv, 95, 51, 108, 87, frame_ramp='white', frame_i=4, seed=103, plants=True, blossoms=True)
    draw_arched_glass_bay(cv, 109, 51, 122, 87, frame_ramp='white', frame_i=4, seed=104, plants=True, blossoms=True)
    # Center flanks: tall arched glass bays showing tall palm fronds & glowing orchids
    draw_arched_glass_bay(cv, 34, 52, 49, 89, frame_ramp='white', frame_i=6, seed=105, plants=True, blossoms=True)
    draw_arched_glass_bay(cv, 79, 52, 94, 89, frame_ramp='white', frame_i=5, seed=106, plants=True, blossoms=True)

    # Extra crisp interior palm frond silhouettes & glowing blossoms behind center-flank glass
    for px in (41, 86):
        cv.vline(px, 66, 86, col('wood', 3))
        for dx, dy in ((-4, -3), (-3, -5), (4, -3), (3, -5), (0, -6)):
            cv.hline(px + min(0, dx), px + max(0, dx) + 1, 68 + dy, col('foliage', 5))
            cv.p(px + dx, 69 + dy, col('foliage', 4))
    for bx, by, bc in ((11, 74, 'pink:5'), (25, 79, 'yellow:5'), (38, 77, 'pink:5'), (44, 81, 'yellow:5'),
                       (83, 76, 'yellow:5'), (89, 80, 'pink:5'), (101, 75, 'pink:5'), (115, 78, 'yellow:5')):
        cv.p(bx, by, bc)
        cv.p(bx + 1, by, bc)
        cv.p(bx, by + 1, col('foliage', 3))

    # --- Grand Center Arched Entrance Portico (x=50..78, y=52..108) ---
    # Decorative arched portico pediment
    cv.outline_box(49, 51, 79, 56, col('white', 6), col('steel', 1), bot_sh=col('coolwhite', 3))
    # Arched transom window above entrance doors
    draw_arched_glass_bay(cv, 52, 56, 76, 76, frame_ramp='white', frame_i=6, seed=107, plants=False, warm_glow=True)
    # Sunburst iron spokes in transom
    for sx, sy in ((55, 65), (58, 60), (64, 58), (70, 60), (73, 65)):
        cv.p(sx, sy, col('white', 6))
        cv.p((sx + 64) // 2, (sy + 74) // 2, col('white', 5))

    # Tall double glass conservatory doors (recessed warm amber vestibule contrast)
    cv.outline_box(52, 75, 76, 102, col('wood', 1), col('steel', 0))
    cv.door_glass(53, 76, 75, 102, frame='steel:2', warm=True)
    # Ornate white-iron columns flanking portico with dark shadow crease
    for col_x in (49, 76):
        cv.rect(col_x, 55, col_x + 3, 104, col('white', 5))
        cv.vline(col_x, 55, 104, col('white', 6))
        cv.vline(col_x + 2, 55, 104, col('steel', 1))
        cv.hline(col_x - 1, col_x + 4, 55, col('white', 6))
        cv.hline(col_x - 1, col_x + 4, 103, col('stone', 4))

    # Entrance stone steps
    draw_steps(cv, 48, 102, 80, 111, count=3, ramp='stone', cheek_ramp='concrete')

    # --- Lush Botanical Flowerbeds & Urns Grounding the Base ---
    # Flanking decorative garden urns with blossoms beside steps
    for ux in (42, 82):
        cv.foliage_cluster(ux + 2, 97, 4, 3, ramp='foliage', seed=ux, blossom=col('pink', 5))
        cv.outline_box(ux, 100, ux + 5, 106, col('cream', 5), col('stone', 1), top_hi=col('white', 6))
        cv.hline(ux - 1, ux + 6, 106, col('stone', 3))

    # Left & right lush flowerbeds along front
    draw_bush_hedge(cv, 2, 98, 36, 110, ramp='foliage', blossom=col('pink', 5), seed=91)
    draw_bush_hedge(cv, 92, 98, 126, 110, ramp='foliage', blossom=col('yellow', 5), seed=92)
    # Stone walkway border along bottom
    cv.hline(2, 126, 110, col('stone', 4))
    cv.hline(2, 126, 111, col('ink', 1))

    # Crisp exterior vertical outlines & subtle right-edge shadow
    cv.vline(4, 48, 100, col('steel', 1))
    cv.vline(123, 48, 100, col('steel', 0))
    cv.vline(32, 48, 102, col('steel', 2))
    cv.vline(95, 48, 102, col('steel', 1))
    return cv


# ---------------------------------------------------------------------------
# 2. Park Open-Air Amphitheater / Acoustic Bandstand Shell (144x96)
# ---------------------------------------------------------------------------

def build_pk_amphitheater():
    cv = Canvas(144, 96)
    seed = 902
    cx = 72

    # --- Flanking Park Trees & Shrubbery Backdrop ---
    cv.foliage_cluster(12, 54, 12, 15, ramp='foliage', seed=201, blossom=col('yellow', 5))
    cv.foliage_cluster(132, 54, 12, 15, ramp='foliage', seed=202, blossom=col('pink', 5))
    cv.foliage_cluster(10, 74, 10, 12, ramp='green', seed=203)
    cv.foliage_cluster(134, 74, 10, 12, ramp='green', seed=204)

    # --- Sweeping Dark-Slate Pitched Acoustic Canopy Crown (y=4..34) ---
    # Curved vaulted roof silhouette (slightly arched crown)
    for y in range(4, 34):
        ry = y - 4
        frac = ry / 29.0
        half_w = int(round(36 + 26 * (frac ** 0.72)))
        lx, rx = cx - half_w, cx + half_w
        for x in range(lx, rx):
            dx = x - cx
            if ry == 0:
                cv.p(x, y, col('kawara', 6) if abs(dx) < half_w - 2 else col('kawara', 1))
            elif ry == 1:
                cv.p(x, y, col('kawara', 5 if x % 3 != 0 else 4))
            elif ry == 2:
                cv.p(x, y, col('kawara', 1))
            elif abs(dx) == half_w - 1 or abs(dx) == half_w:
                cv.p(x, y, col('kawara', 0))
            elif abs(dx) == half_w - 2:
                cv.p(x, y, col('kawara', 5 if dx < 0 else 1))
            elif ry >= 27:
                # Front curved timber fascia trim under the dark-slate canopy
                if ry == 27:
                    cv.p(x, y, col('kawara', 0))
                elif ry == 28:
                    cv.p(x, y, col('cream', 6 if dx < 12 else 5))
                elif ry == 29:
                    cv.p(x, y, col('cedar', 5 if dx < 12 else 4))
                elif ry == 30:
                    cv.p(x, y, col('cedar', 3))
                else:
                    cv.p(x, y, col('wood', 1))
            else:
                ci = (ry - 3) // 4
                yy = (ry - 3) % 4
                bx = (x + (2 if ci % 2 else 0)) % 4
                r = hsh(x // 4, ci, seed)
                rsh = 1 if dx > half_w - 10 else 0
                if yy == 3 or bx == 3:
                    cv.p(x, y, col('kawara', max(0, 1 - rsh)))
                else:
                    t = 4 if ry < 14 else 3
                    if r > 0.78:
                        t += 1
                    elif r < 0.22:
                        t -= 1
                    cv.p(x, y, col('kawara', max(1, t - rsh)))

    # --- Acoustic Shell Outer Stone/Concrete Proscenium Piers ---
    draw_ashlar(cv, 14, 34, 26, 76, ramp='cream', base_i=4, bw=6, bh=5, seed=seed + 10)
    draw_ashlar(cv, 118, 34, 130, 76, ramp='cream', base_i=3, bw=6, bh=5, seed=seed + 11)
    cv.vline(14, 34, 76, col('stone', 1))
    cv.vline(25, 34, 76, col('wood', 1))
    cv.vline(118, 34, 76, col('wood', 1))
    cv.vline(129, 34, 76, col('stone', 0))

    # --- Sweeping Curved Cream & Timber Acoustic Stage Shell Interior (x=25..119, y=33..70) ---
    # Concentric recessed acoustic reflector ribs creating 3D shell depth!
    for y in range(33, 70):
        for x in range(25, 119):
            dx = (x - cx) / 47.0
            dy = (y - 69) / 36.0  # -1 at top, 0 at floor
            ell = math.hypot(dx, dy)
            # Determine concentric acoustic ring depth
            if ell > 0.96:
                # Outer timber proscenium spandrel
                cv.p(x, y, col('wood', 2 if (x + y) % 3 != 0 else 1))
            elif ell > 0.84:
                # First grand curved cream-timber acoustic rib (brightest, lit by front spots)
                if 0.84 < ell < 0.88:
                    cv.p(x, y, col('cedar', 2))
                else:
                    cv.p(x, y, col('cream', 5 if dx < 0.3 else 4))
            elif ell > 0.68:
                # Second stepped acoustic timber-cream shell band
                if 0.68 < ell < 0.72:
                    cv.p(x, y, col('wood', 2))
                else:
                    is_slat = ((x % 4 == 0) and y > 44)
                    cv.p(x, y, col('cedar', 4 if not is_slat else 3))
            elif ell > 0.50:
                # Third inner curved cream reflector
                if 0.50 < ell < 0.54:
                    cv.p(x, y, col('cedar', 2))
                else:
                    cv.p(x, y, col('cream', 4 if y < 56 else 3))
            else:
                # Deepest central acoustic timber backwall bathed in warm spotlight glow
                if y < 52:
                    cv.p(x, y, col('yellow', 4 if abs(dx) < 0.25 else 3))
                elif y < 60:
                    cv.p(x, y, col('cedar', 5 if x % 3 != 0 else 4))
                else:
                    cv.p(x, y, col('cedar', 3 if x % 3 != 0 else 2))

    # --- Warm Overhead Stage Spotlights Along Proscenium Arch ---
    spot_xs = (38, 52, 65, 79, 92, 106)
    for sx in spot_xs:
        dx = (sx - cx) / 45.0
        sy = int(round(69 - 33.0 * math.sqrt(max(0.08, 1.0 - dx * dx))))
        sy = max(35, min(52, sy))
        # Spotlight fixture + warm glowing lens & atmospheric light halo
        cv.rect(sx - 1, sy - 1, sx + 2, sy + 1, col('steel', 1))
        cv.p(sx, sy + 1, col('white', 6))
        cv.hline(sx - 1, sx + 2, sy + 2, col('yellow', 5))
        cv.hline(sx - 2, sx + 3, sy + 3, col('yellow', 4))

    # --- Subtle Performance Props Inside Acoustic Shell ---
    # Grand concert piano silhouette on left-center stage (x=42..58, y=58..69)
    cv.outline_box(43, 60, 56, 65, col('kuro', 1), col('kuro', 0), top_hi=col('steel', 3))
    cv.hline(45, 55, 62, col('white', 6))  # ivory keyboard glint
    cv.vline(44, 65, 69, col('kuro', 0))
    cv.vline(54, 65, 69, col('kuro', 0))
    cv.p(50, 59, col('kuro', 2))  # propped piano lid
    cv.p(51, 58, col('steel', 3))
    # Central conductor podium & music stand
    cv.rect(cx - 5, 65, cx + 6, 70, col('wood', 3))
    cv.hline(cx - 5, cx + 6, 65, col('cedar', 5))
    cv.vline(cx, 57, 66, col('steel', 1))
    cv.rect(cx - 3, 54, cx + 4, 58, col('cream', 6))
    cv.hline(cx - 3, cx + 4, 54, col('wood', 1))
    cv.hline(cx - 2, cx + 3, 56, col('steel', 3))
    # Right ensemble music stands & upright brass microphone
    for mx in (86, 98, 108):
        cv.vline(mx, 60, 68, col('steel', 1))
        cv.rect(mx - 2, 58, mx + 3, 61, col('cream', 5))
        cv.p(mx, 59, col('steel', 3))
    # Stage side dark-navy acoustic wings
    cv.rect(25, 56, 31, 69, col('navy', 1))
    cv.rect(113, 56, 119, 69, col('navy', 1))

    # --- Wide Wooden Performance Stage Floor (top-3/4 apron, y=68..84) ---
    for y in range(68, 82):
        ry = y - 68
        # Gently flaring curved stage apron
        ex = int(round(ry * 0.45))
        lx, rx = 14 - ex, 130 + ex
        for x in range(lx, rx):
            # Warm spotlight pools on the timber stage floor
            in_pool = (abs(x - cx) < 16 or abs(x - 46) < 9 or abs(x - 98) < 9) and 2 <= ry <= 10
            if ry == 0:
                cv.p(x, y, col('wood', 1))
            elif ry % 3 == 2:
                cv.p(x, y, col('floorwood', 2 if not in_pool else 3))
            else:
                r = hsh(x // 6, ry, seed + 40)
                if in_pool:
                    cv.p(x, y, col('floorwood', 5 if r > 0.35 else 4))
                else:
                    cv.p(x, y, col('floorwood', 4 if r > 0.55 else 3))
        cv.p(lx, y, col('wood', 0))
        cv.p(rx - 1, y, col('wood', 0))

    # Stage front lip + footlights + stone apron base (y=81..92)
    cv.hline(8, 136, 81, col('cedar', 6))
    cv.hline(8, 136, 82, col('wood', 1))
    draw_ashlar(cv, 10, 83, 134, 92, ramp='stone', base_i=3, bw=8, bh=4, seed=seed + 50)
    # Warm glowing stage footlight hoods along the front edge
    for fx in range(28, 118, 12):
        cv.rect(fx, 80, fx + 4, 83, col('steel', 1))
        cv.hline(fx + 1, fx + 3, 81, col('yellow', 5))

    # Side stone stairs leading onto the stage
    draw_steps(cv, 8, 76, 22, 93, count=4, ramp='stone')
    draw_steps(cv, 122, 76, 136, 93, count=4, ramp='stone')

    # Foreground park flower hedges flanking stage & grounded stone plaza
    draw_bush_hedge(cv, 1, 78, 16, 94, ramp='foliage', blossom=col('yellow', 5), seed=210)
    draw_bush_hedge(cv, 128, 78, 143, 94, ramp='foliage', blossom=col('pink', 5), seed=211)
    # Grounded flagstone performance plaza apron at bottom
    for y in range(91, 96):
        for x in range(14, 130):
            r = hsh(x // 5, y, seed + 60)
            if y == 95:
                cv.p(x, y, col('ink', 1))
            elif y == 91:
                cv.p(x, y, col('stone', 1))
            else:
                cv.p(x, y, col('flagstone', 4 if r > 0.5 else 3))
    return cv


# ---------------------------------------------------------------------------
# 3. Lakeside Boathouse & Boat Rental (112x96)
# ---------------------------------------------------------------------------

def build_pk_lakeside_boathouse():
    cv = Canvas(112, 96)
    seed = 903

    # --- Steeply Pitched Teal/Slate Top-3/4 Roof (x=4..108, y=6..38) ---
    for y in range(6, 38):
        ry = y - 6
        inset = max(0, (31 - ry) // 6)
        lx, rx = 4 + inset, 108 - inset
        for x in range(lx, rx):
            dx = x - lx
            rw = rx - lx
            if ry == 0:
                cv.p(x, y, col('white', 6) if dx not in (0, rw - 1) else col('teal', 0))
            elif ry == 1:
                cv.p(x, y, col('teal', 5 if x % 3 != 0 else 4))
            elif ry == 2:
                cv.p(x, y, col('teal', 1))
            elif ry == 31:
                cv.p(x, y, col('teal', 0))
            elif ry == 30:
                cv.p(x, y, col('white', 5))
            elif dx == 0 or dx == rw - 1:
                cv.p(x, y, col('teal', 0))
            else:
                ci = (ry - 3) // 4
                yy = (ry - 3) % 4
                bx = (x + (2 if ci % 2 else 0)) % 4
                r = hsh(x // 4, ci, seed)
                rsh = 1 if dx > rw - 6 else 0
                if yy == 3 or bx == 3:
                    cv.p(x, y, col('teal', max(0, 1 - rsh)))
                else:
                    # Mix rich teal-slate shingle tones
                    use_slate = (r < 0.25)
                    rmp = 'tile' if use_slate else 'teal'
                    t = 4 if ry < 16 else 3
                    if r > 0.78:
                        t += 1
                    elif r < 0.20:
                        t -= 1
                    if yy == 0 and bx == 0:
                        t += 1
                    cv.p(x, y, col(rmp, max(1, min(5, t - rsh))))

    # Small brick chimney on left roof slope
    cv.brick_wall(16, 4, 25, 19, ramp='brick', base_i=4, course_h=3, brick_w=4, seed=seed + 2)
    cv.outline_box(15, 2, 26, 6, col('stone', 4), col('stone', 0), top_hi=col('white', 5))

    # --- Central Gabled Dormer on the Steep Roof (x=44..68, y=5..30) ---
    dcx = 56
    # Gable roof triangle
    for y in range(5, 17):
        ry = y - 5
        hw = ry + 1
        cv.hline(dcx - hw, dcx + hw + 1, y, col('teal', 3 if ry % 2 == 0 else 2))
        cv.p(dcx - hw, y, col('white', 6))
        cv.p(dcx - hw + 1, y, col('white', 5))
        cv.p(dcx + hw, y, col('teal', 0))
        cv.p(dcx + hw - 1, y, col('white', 4))
    # Dormer facade + warm arched attic tea-window
    cv.outline_box(46, 16, 66, 30, col('cream', 5), col('wood', 1), top_hi=col('white', 6))
    cv.window(50, 18, 62, 28, style='warm', frame='white:5', sill='wood:3')

    # --- 2F Warm Lakeside Tea-Room Facade (x=8..104, y=38..62) ---
    cv.siding_wall(8, 38, 104, 62, ramp='cedar', base_i=4, horizontal=True, step=3, seed=seed + 5)
    # Dark under-eave cast shadow
    cv.hline(8, 104, 38, col('wood', 0))
    cv.hline(8, 104, 39, col('wood', 1))
    # Crisp vertical white corner trim boards
    for tx in (8, 101):
        cv.rect(tx, 38, tx + 3, 62, col('white', 5))
        cv.vline(tx, 38, 62, col('white', 6))
        cv.vline(tx + 2, 38, 62, col('steel', 2))

    # 3 Warm backlit lakeside tea-room windows with white frames & shutters
    for wx0, wx1 in ((15, 34), (44, 68), (78, 97)):
        cv.window(wx0, 42, wx1, 56, style='warm', frame='white:5', sill='white:6', curtain='teal')
        # Decorative teal wooden shutters on left & right windows
        if wx0 != 44:
            cv.outline_box(wx0 - 3, 42, wx0, 56, col('teal', 3), col('teal', 0))
            cv.outline_box(wx1, 42, wx1 + 3, 56, col('teal', 3), col('teal', 0))
        else:
            # Center tea-room Juliet balcony railing + flower box
            cv.planter_box(48, 53, 64, 59, flower='pink:5', pot_ramp='brick')
    # Warm brass lantern between 2F windows
    draw_lantern(cv, 39, 49, warm=True)
    draw_lantern(cv, 73, 49, warm=True)

    # Timber floor beam / fascia dividing 2F and 1F dock porch
    cv.outline_box(4, 60, 108, 65, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))

    # --- 1F Left: Stone & Cedar Boat Rental Porch + Horizontal Wooden Pier Deck (x=4..55, y=65..95) ---
    draw_ashlar(cv, 8, 65, 52, 83, ramp='stone', base_i=4, bw=7, bh=5, seed=seed + 12)
    # Subtle wall pilaster between rental door & ticket window (flush with wall base, unobstructed deck!)
    cv.rect(27, 64, 29, 83, col('wood', 3))
    cv.vline(27, 64, 83, col('cedar', 4))
    cv.vline(28, 64, 83, col('wood', 1))

    # Ticket window & small blue-and-cream "BOAT" rental plaque
    cv.window(30, 68, 46, 78, style='warm', frame='wood:1', sill='cedar:5')
    cv.signboard(29, 65, 47, 70, ramp='blue', accent='white:6', seed=seed + 13)

    # Top-3/4 Horizontal Wooden Pier Deck projecting forward to waterline (x=4..54, y=82..94)
    for y in range(82, 95):
        ry = y - 82
        for x in range(4, 54):
            rx = x - 4
            if ry == 0:
                # Crisp dark wall-base shadow seam along stone wall
                cv.p(x, y, col('wood', 0))
            elif ry == 1:
                # Shaded back-edge horizontal plank under wall shadow
                r = hsh(rx // 10, 0, seed + 20)
                cv.p(x, y, col('floorwood', 2 if r > 0.35 else 1))
            elif ry in (3, 6):
                # Crisp foreshortened horizontal plank seams (2-3px plank pitch!)
                cv.p(x, y, col('wood', 1))
            elif ry in (2, 4, 5, 7, 8):
                # Sunlit horizontal pier deck planks with subtle staggered end-joints
                plank_row = 0 if ry == 2 else (1 if ry in (4, 5) else 2)
                joint_off = (plank_row * 7) % 16
                is_joint = ((rx + joint_off) % 16 == 0)
                if is_joint:
                    cv.p(x, y, col('wood', 2))
                else:
                    seg = (rx + joint_off) // 16
                    r = hsh(seg, plank_row, seed + 21)
                    if ry in (4, 7):
                        # Top sunlit edge of horizontal plank
                        cv.p(x, y, col('floorwood', 5 if r > 0.35 else 4))
                    else:
                        cv.p(x, y, col('floorwood', 4 if r > 0.45 else 3))
            elif ry == 9:
                # Crisp sunlit top bevel of front dock rim beam (y=91)
                cv.p(x, y, col('cedar', 6 if rx % 5 != 0 else 5))
            elif ry == 10:
                # Front dock rim timber fascia above waterline (y=92)
                cv.p(x, y, col('wood', 4 if rx % 4 != 3 else 3))
            elif ry == 11:
                # Shaded underside lip of front dock rim (y=93)
                cv.p(x, y, col('wood', 1))
            else:
                # Lake waterline lapping cleanly beneath dock rim (y=94)
                r = hsh(rx // 3, y, seed + 24)
                if (rx % 11) in (2, 3) and r > 0.45:
                    cv.p(x, y, col('teal', 4))
                elif (rx % 11) == 4 and r > 0.65:
                    cv.p(x, y, col('glass', 5))
                else:
                    cv.p(x, y, col('teal', 1 if r < 0.45 else 2))

    # Crisp timber dock side-edge beam bordering the boat slip water (x=53..55, y=82..95)
    cv.vline(53, 82, 95, col('cedar', 5))
    cv.vline(54, 82, 95, col('wood', 0))
    # Short timber pilings under front dock rim dipping into the waterline
    for plx in (6, 20, 36, 51):
        cv.rect(plx, 91, plx + 3, 95, col('wood', 2))
        cv.vline(plx, 91, 95, col('wood', 4))
        cv.vline(plx + 2, 91, 95, col('wood', 0))

    # Rental office timber door extending cleanly down to deck-level threshold step (ZERO planks blocking door!)
    cv.door_wood(14, 67, 26, 83, ramp='wood', glass_top=True)
    # Crisp sunlit stone/timber threshold step at deck level (x=13..27, y=82..85)
    cv.hline(13, 27, 82, col('stone', 6))
    cv.hline(13, 27, 83, col('stone', 5))
    cv.hline(13, 27, 84, col('stone', 2))
    cv.p(13, 82, col('stone', 2))
    cv.p(26, 82, col('stone', 2))
    cv.hline(14, 27, 85, col('wood', 1))  # soft cast shadow of step onto horizontal deck

    # Crossed wooden oars leaning cleanly against stone wall onto deck (x=9..14, y=68..83)
    for k in range(14):
        cv.p(10 + k // 4, 69 + k, col('cedar', 5))
        cv.p(11 + k // 4, 69 + k, col('wood', 2))
    cv.hline(12, 15, 83, col('wood', 0))

    # --- 1F Right: Boat Slip with Shimmering Water, Rowboat & Swan-Boat Noses (x=54..108, y=65..95) ---
    # Dark interior boat-bay cavern behind water (starts at x=54 so zero 1px seam beside post!)
    cv.rect(54, 65, 103, 78, col('darkwood', 1))
    for bx in range(58, 102, 10):
        cv.vline(bx, 65, 78, col('darkwood', 2))
    # Shimmering lake water inside & in front of boat slips
    draw_water_pool(cv, 54, 74, 108, 95, ramp='teal', seed=seed + 30, shimmer=True)
    # Re-stamp dock side edge & cast shadow onto boat-slip water (y=82..95)
    cv.vline(53, 82, 95, col('cedar', 5))
    cv.vline(54, 82, 95, col('wood', 0))
    cv.vline(55, 82, 95, col('teal', 1))

    # Sturdy outer timber dock porch columns (front corners & slip divider; middle stays open walkway!)
    for px in (6, 51, 103):
        cv.rect(px, 64, px + 3, 92, col('wood', 3))
        cv.vline(px, 64, 92, col('cedar', 4))
        cv.vline(px + 2, 64, 92, col('wood', 0))
        cv.hline(px, px + 3, 91, col('wood', 1))

    # Crisp Red-and-White Lifebuoy hanging on porch post (x=47..55, y=69..77)
    lcx, lcy = 51, 73
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d = math.hypot(dx, dy)
            if 1.7 <= d <= 3.8:
                if abs(dx) <= 1 or abs(dy) <= 1:
                    cv.p(lcx + dx, lcy + dy, col('red', 4 if dy < 1 else 3))
                else:
                    cv.p(lcx + dx, lcy + dy, col('white', 6 if dy < 1 else 4))
            elif 3.8 < d <= 4.5:
                cv.p(lcx + dx, lcy + dy, col('ink', 1))

    # Rowboat #1 bow peeking out (red & cream hull, x=58..77, y=73..90)
    for y in range(73, 90):
        ry = y - 73
        hw = max(2, min(8, int(round(8.5 * math.sin((1.0 - ry / 17.0) * math.pi * 0.55) + 1.5))))
        bx = 67
        if ry > 14:
            hw = max(1, 17 - ry)
        for x in range(bx - hw, bx + hw + 1):
            if abs(x - bx) == hw:
                cv.p(x, y, col('red', 1))
            elif abs(x - bx) == hw - 1:
                cv.p(x, y, col('red', 4 if x < bx else 3))
            elif ry in (5, 10):
                # Wooden rowing thwart bench
                cv.p(x, y, col('cedar', 5 if ry == 5 else 4))
            else:
                cv.p(x, y, col('cream', 5 if x < bx else 4))
    # White water ripple around rowboat nose
    cv.hline(64, 71, 90, col('glass', 6))
    cv.p(62, 89, col('white', 5))
    cv.p(72, 89, col('white', 5))

    # Swan-Boat #2 nose peeking out (white sculpted swan bow, x=80..100, y=69..90)
    sx = 90
    # Rounded boat hull
    for y in range(76, 90):
        ry = y - 76
        hw = max(2, min(8, 8 - max(0, ry - 9)))
        for x in range(sx - hw, sx + hw + 1):
            if abs(x - sx) == hw:
                cv.p(x, y, col('steel', 2))
            elif abs(x - sx) == hw - 1:
                cv.p(x, y, col('white', 5 if x < sx else 3))
            else:
                cv.p(x, y, col('white', 6 if x < sx else 4))
    # Graceful curved swan neck & head rising at prow
    for ny in range(70, 82):
        nx = sx + (1 if ny < 74 else 0)
        cv.rect(nx - 2, ny, nx + 2, ny + 1, col('white', 6))
        cv.p(nx - 2, ny, col('steel', 2))
        cv.p(nx + 2, ny, col('coolwhite', 2))
    # Swan head, orange beak & crisp eye
    cv.rect(sx - 1, 69, sx + 3, 72, col('white', 6))
    cv.p(sx + 1, 70, col('ink', 0))
    cv.hline(sx + 2, sx + 5, 71, col('orange', 4))
    cv.p(sx + 3, 72, col('orange', 3))
    # Water ripples around swan boat
    cv.hline(85, 96, 90, col('glass', 6))
    # Mooring rope tying boats to dock post
    for k in range(7):
        cv.p(53 + k, 80 + k // 2, col('straw', 4))

    # Grounded bottom edge line across full lakefront
    cv.hline(4, 108, 95, col('ink', 1))
    return cv


# ---------------------------------------------------------------------------
# 4. Neighborhood Cultural & Community Center (128x112)
# ---------------------------------------------------------------------------

def build_pk_community_center():
    cv = Canvas(128, 112)
    seed = 904

    # --- Lush Green Sloped Roof Garden (right) + Angled Glass Skylight (left-center) (y=6..36) ---
    # Concrete roof parapet perimeter
    cv.outline_box(6, 12, 122, 36, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))

    # Right sloped roof garden (x=54..120, y=14..33)
    for y in range(14, 34):
        ry = y - 14
        for x in range(54, 120):
            r = hsh(x, y, seed + 1)
            # Stepped grassy turf & wildflower garden beds
            if y in (14, 15):
                cv.p(x, y, col('foliage', 2))  # parapet shadow
            elif 76 <= x <= 84 and y >= 18:
                # Wooden boardwalk path across green roof
                cv.p(x, y, col('cedar', 4 if y % 3 != 0 else 2))
            else:
                if ry < 8:
                    cv.p(x, y, col('lawn', 5 if r > 0.55 else 4))
                else:
                    cv.p(x, y, col('foliage', 5 if r > 0.6 else (4 if r > 0.25 else 3)))
                if r > 0.90:
                    cv.p(x, y, col('yellow', 5) if (x % 2 == 0) else col('pink', 5))

    # Roof garden decorative shrubs & small park trees on the sloped roof
    cv.foliage_cluster(64, 21, 7, 5, ramp='foliage', seed=401, blossom=col('yellow', 5))
    cv.foliage_cluster(96, 19, 8, 6, ramp='foliage', seed=402, blossom=col('pink', 4))
    cv.foliage_cluster(112, 23, 6, 5, ramp='green', seed=403)

    # Left-center contemporary angled glass monitor skylight (x=10..52, y=7..33)
    # Angled top-3/4 trapezoidal glass skylight roof + warm recessed clerestory front strip
    for y in range(7, 34):
        ry = y - 7
        inset = max(0, (18 - ry) // 3) if ry < 18 else 0
        lx = 10 + inset
        rx = 52 - inset
        for x in range(lx, rx):
            dx = x - lx
            rw = rx - lx
            if ry == 0 or ry == 26 or dx == 0 or dx == rw - 1:
                cv.p(x, y, col('steel', 1))
            elif ry == 1:
                cv.p(x, y, col('coolwhite', 5))
            elif ry == 18:
                cv.p(x, y, col('steel', 1))  # skylight ridge/eave fold separating sloped roof from clerestory
            elif ry == 19:
                cv.p(x, y, col('coolwhite', 4))
            elif (x - 10) % 8 == 0:
                cv.p(x, y, col('steel', 2))
            elif ry == 9:
                cv.p(x, y, col('steel', 3))
            elif ry > 19:
                # Warm backlit clerestory window face under sloped glass roof
                cv.p(x, y, col('yellow', 4) if (x % 3 != 0) else col('orange', 4))
            else:
                diag = (x + ry) % 9
                if diag in (1, 2):
                    cv.p(x, y, col('glass', 6))
                else:
                    cv.p(x, y, col('glass', 5 if diag == 3 else 3))

    # Crisp glass/steel roof garden balustrade along front edge of green roof
    cv.hline(54, 120, 31, col('coolwhite', 5))
    cv.hline(54, 120, 32, col('glass', 4))
    for rx in range(56, 120, 6):
        cv.vline(rx, 31, 34, col('steel', 2))

    # Front concrete roof fascia slab
    cv.outline_box(4, 33, 124, 38, col('concrete', 5), col('concrete', 1), top_hi=col('white', 6), bot_sh=col('concrete', 2))

    # --- 2F Architectural Concrete + Bright Activity-Room Windows + Cedar Louvers (y=38..72) ---
    # Pale architectural concrete panels (left & center)
    cv.tile_cladding(6, 38, 86, 72, ramp='concrete', base_i=5, cw=10, ch=8, seed=seed + 10)
    # Under-eave shadow
    cv.hline(6, 122, 38, col('concrete', 1))
    cv.hline(6, 122, 39, col('concrete', 2))

    # Bright 2F activity-room panoramic windows (3 distinct lively interiors!)
    # Window 1 (left: art/craft room with warm pendant lights & easel)
    cv.window(12, 43, 38, 66, style='warm', frame='steel:1', sill='concrete:6')
    cv.rect(16, 56, 22, 65, col('wood', 3))  # craft table
    cv.rect(28, 52, 34, 61, col('blue', 4))  # pinboard/canvas
    cv.hline(14, 36, 46, col('yellow', 5))

    # Window 2 (center: bright library / community lounge with bookshelves & greenery)
    cv.window(44, 43, 80, 66, style='glass', frame='steel:1', sill='concrete:6')
    # Backlit warm reading room + colorful bookshelf inside
    cv.rect(46, 51, 78, 65, col('cream', 4))
    for bx in range(47, 77, 4):
        book_c = ('red', 'blue', 'yellow', 'green')[(bx // 4) % 4]
        cv.rect(bx, 53, bx + 3, 59, col(book_c, 4))
    cv.hline(46, 78, 59, col('wood', 3))
    cv.hline(46, 78, 52, col('wood', 3))
    # Glass sky glare streak over the room
    for k in range(14):
        cv.p(46 + k, 44 + k // 2, col('glass', 6))
        cv.p(60 + k, 44 + k // 2, col('glass', 5))

    # Right wing (x=86..122, y=38..72): Warm vertical cedar wood louvers over glowing gallery!
    cv.rect(86, 38, 122, 72, col('wood', 1))
    for x in range(86, 122):
        rx = x - 86
        if rx % 3 == 0:
            cv.vline(x, 40, 70, col('cedar', 5))
        elif rx % 3 == 1:
            cv.vline(x, 40, 70, col('cedar', 3))
        else:
            # Warm sunlit interior peeking between cedar louver slats
            for y in range(44, 66):
                cv.p(x, y, col('yellow', 4 if y > 52 else 3))
    cv.outline_box(86, 38, 122, 41, col('cedar', 4), col('wood', 0))
    cv.outline_box(86, 69, 122, 72, col('cedar', 3), col('wood', 0))

    # Mid-level concrete belt course & warm cedar soffit canopy over foyer
    cv.outline_box(4, 70, 124, 75, col('concrete', 5), col('concrete', 1), top_hi=col('white', 6))
    cv.hline(22, 88, 75, col('cedar', 4))
    cv.hline(22, 88, 76, col('wood', 1))

    # --- 1F Wide Inviting Glass Foyer, Notice Board & Planters (y=75..108) ---
    # Left concrete pier & corner planter bench
    cv.tile_cladding(6, 75, 24, 106, ramp='concrete', base_i=4, cw=6, ch=6, seed=seed + 21)
    # Right cedar-clad cultural wall with community notice board
    cv.siding_wall(88, 75, 122, 106, ramp='cedar', base_i=4, horizontal=False, step=3, seed=seed + 22)

    # Wide inviting 1F glass foyer (x=24..88, y=76..106)
    cv.outline_box(24, 76, 88, 106, col('glass', 1), col('steel', 1))
    # Left foyer sidelight with warm indoor plant & welcome desk
    cv.window(25, 77, 44, 105, style='warm', frame='steel:2', sill=None)
    cv.foliage_cluster(31, 95, 4, 5, ramp='foliage', seed=410)
    cv.rect(29, 100, 34, 105, col('brick', 4))
    # Center wide automatic glass double doors
    cv.door_glass(44, 77, 68, 106, frame='steel:2', warm=True)
    # Right foyer sidelight showing bright community lobby
    cv.window(68, 77, 87, 105, style='warm', frame='steel:2', sill=None)
    cv.rect(72, 96, 84, 104, col('cedar', 4))  # reception counter
    cv.hline(72, 84, 96, col('cream', 6))

    # Community Notice Board on right cedar wall (x=92..118, y=80..98)
    cv.outline_box(92, 80, 118, 98, col('cream', 5), col('wood', 1), top_hi=col('wood', 4))
    # Colorful community flyers pinned on board
    cv.rect(94, 83, 100, 89, col('red', 4))
    cv.rect(101, 83, 107, 90, col('blue', 4))
    cv.rect(109, 83, 115, 88, col('yellow', 5))
    cv.rect(95, 91, 103, 96, col('green', 4))
    cv.rect(105, 90, 115, 96, col('white', 6))
    cv.hline(106, 114, 92, col('steel', 3))
    cv.hline(106, 112, 94, col('steel', 3))
    # Small rooflet over notice board
    cv.hline(91, 119, 79, col('wood', 3))

    # Lush front planters & wooden bench
    cv.planter_box(6, 94, 23, 106, flower='yellow:5', pot_ramp='concrete')
    cv.planter_box(92, 100, 122, 108, flower='pink:5', pot_ramp='brick')

    # Wide entrance stone plaza & low inviting step along bottom
    draw_steps(cv, 22, 105, 90, 111, count=2, ramp='concrete')
    for x in range(4, 124):
        cv.p(x, 110, col('stone', 4))
        cv.p(x, 111, col('ink', 1))
    cv.vline(6, 38, 108, col('concrete', 1))
    cv.vline(121, 38, 108, col('concrete', 0))
    return cv


# ---------------------------------------------------------------------------
# 5. Urban Onsen Hot-Spring & Foot-Bath Steam Terrace (112x96)
# ---------------------------------------------------------------------------

def build_pk_onsen_steam_terrace():
    cv = Canvas(112, 96)
    seed = 905

    # --- Right Background: Bamboo Privacy Fence + Japanese Maple & Greenery ---
    # Lush garden trees rising behind bamboo fence
    cv.foliage_cluster(86, 20, 14, 11, ramp='foliage', seed=501)
    cv.foliage_cluster(101, 28, 10, 10, ramp='maple', seed=502)
    cv.foliage_cluster(74, 24, 9, 8, ramp='green', seed=503)

    # Tall woven bamboo privacy fence (x=66..108, y=28..64)
    for y in range(28, 64):
        for x in range(66, 108):
            rx = x - 66
            if y in (28, 29):
                cv.p(x, y, col('wood', 2 if y == 28 else 4))
            elif y in (39, 51):
                # Horizontal dark cord / bamboo rail
                cv.p(x, y, col('darkwood', 2 if rx % 6 != 0 else 0))
            elif rx % 3 == 2:
                cv.p(x, y, col('straw', 1))
            else:
                r = hsh(rx // 3, y // 6, seed + 5)
                cv.p(x, y, col('straw', 4 if (rx % 3 == 0 and r > 0.35) else 3))
    cv.vline(107, 28, 64, col('darkwood', 0))

    # --- Left Main Bathhouse Pavilion: Sweeping Dark Kawara Roof (x=2..72, y=4..38) ---
    draw_hipped_roof(cv, 2, 4, 72, 38, ramp='kawara', top_inset=10, moss_rate=0.05, seed=seed, upturned=True)
    # Ornamental ridge end caps
    cv.rect(11, 2, 15, 6, col('kawara', 6))
    cv.rect(59, 2, 63, 6, col('kawara', 5))

    # Attached small kawara shelter eave overhanging the outdoor foot-bath bench (x=66..104, y=38..50)
    cv.pitched_roof(66, 38, 104, 50, ramp='kawara', ridge_hi=False, moss_rate=0.04, seed=seed + 3)

    # --- Bathhouse Dark Cedar Timber & Stone Facade (x=6..66, y=38..93) ---
    cv.siding_wall(6, 38, 66, 78, ramp='darkwood', base_i=3, horizontal=False, step=3, seed=seed + 10)
    draw_ashlar(cv, 6, 76, 66, 93, ramp='stone', base_i=3, bw=8, bh=5, seed=seed + 11)
    # Dark roof eave shadow
    cv.hline(6, 66, 38, col('darkwood', 0))
    cv.hline(6, 66, 39, col('darkwood', 1))

    # Horizontal warm timber beam & transom lattice
    cv.outline_box(6, 46, 66, 50, col('cedar', 4), col('darkwood', 0), top_hi=col('cedar', 5))
    for lx in range(10, 62, 4):
        cv.vline(lx, 40, 46, col('cedar', 4))
        cv.vline(lx + 1, 40, 46, col('yellow', 3))

    # Warm Glowing Paper Shoji Sliding Entrance (x=18..54, y=50..88)
    cv.outline_box(18, 50, 54, 88, col('cream', 5), col('darkwood', 0))
    for y in range(52, 87):
        for x in range(20, 52):
            rx, ry = x - 20, y - 52
            if rx == 16:
                cv.p(x, y, col('wood', 1))  # center sliding door stile
            elif rx % 5 == 0 or ry % 6 == 0:
                cv.p(x, y, col('wood', 3))  # fine shoji kumiko lattice
            else:
                # Warm golden paper glow (brighter toward center-bottom)
                if ry > 16:
                    cv.p(x, y, col('yellow', 5 if (rx + ry) % 4 == 0 else 4))
                else:
                    cv.p(x, y, col('cream', 6 if ry > 8 else 5))
    # Lower timber kickplate on shoji doors
    cv.rect(19, 80, 53, 87, col('wood', 3))
    cv.hline(19, 53, 80, col('cedar', 5))

    # Classic Navy-Blue Onsen Noren Curtain across top of shoji entrance (y=50..62)
    for nx0 in (20, 31, 42):
        cv.outline_box(nx0, 50, nx0 + 10, 62, col('navy', 3), col('navy', 0), top_hi=col('navy', 4))
        # Crisp white hot-spring 'ゆ' / steam waves emblem on center noren
        if nx0 == 31:
            cv.hline(34, 38, 58, col('white', 6))
            cv.p(34, 55, col('white', 6))
            cv.p(36, 54, col('white', 6))
            cv.p(38, 55, col('white', 6))
            cv.p(34, 56, col('white', 5))
            cv.p(36, 56, col('white', 5))
            cv.p(38, 56, col('white', 5))
        else:
            cv.hline(nx0 + 3, nx0 + 7, 56, col('white', 5))

    # Glowing Traditional Wall Lanterns flanking shoji entrance
    draw_lantern(cv, 12, 58, warm=True)
    draw_lantern(cv, 60, 58, warm=True)

    # Stone entrance steps & wooden shoe bench
    draw_steps(cv, 18, 86, 54, 94, count=2, ramp='stone')

    # --- Attached Outdoor Stone-Rimmed Open-Air Onsen Pool Terrace (x=64..108, y=50..94) ---
    # Timber foot-bath sitting bench along back under eave
    cv.outline_box(66, 50, 104, 58, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 6))
    cv.vline(66, 50, 62, col('wood', 2))
    cv.vline(103, 50, 62, col('wood', 1))

    # Stacked natural stone wall base enclosing the turquoise pool (x=64..108, y=57..93)
    draw_ashlar(cv, 64, 57, 108, 93, ramp='stone', base_i=4, bw=7, bh=5, seed=seed + 25)

    # Light sunlit flat top stone coping rim framing the recessed pool (x=66..106, y=59..89)
    # Outer coping border & subtle shadow cast onto front stone masonry
    cv.hline(66, 106, 59, col('stone', 1))
    cv.vline(66, 59, 89, col('stone', 1))
    cv.vline(105, 59, 89, col('stone', 1))
    cv.hline(66, 106, 88, col('stone', 2))
    cv.hline(66, 106, 89, col('stone', 1))  # coping underside drop shadow onto front masonry
    # Flat sunlit top stone coping slabs (north y=60..62, south y=86..88, west x=67..69, east x=103..105)
    for y in range(60, 88):
        for x in range(67, 105):
            if 69 <= x < 103 and 62 <= y < 86:
                continue
            # Sunlit top-left coping brighter than right/south slabs, with dressed stone joints
            is_top_or_left = (y < 62 or x < 69)
            if (y < 62 or y >= 86) and (x - 67) % 8 == 0:
                cv.p(x, y, col('stone', 4))
            elif (62 <= y < 86) and (y - 62) % 6 == 0:
                cv.p(x, y, col('stone', 4))
            elif y == 60 or x == 67:
                cv.p(x, y, col('white', 5) if is_top_or_left else col('stone', 6))
            else:
                cv.p(x, y, col('stone', 6 if is_top_or_left else 5))
    # Crisp inner coping rim edge framing the sunken water basin
    cv.hline(68, 104, 61, col('stone', 2))
    cv.vline(68, 61, 87, col('stone', 2))
    cv.hline(68, 104, 86, col('stone', 4))
    cv.vline(103, 62, 87, col('stone', 3))

    # Recessed shimmering turquoise thermal water pool (x=69..103, y=62..86)
    draw_water_pool(cv, 69, 62, 103, 86, ramp='teal', seed=seed + 30, shimmer=True)
    # 2px dark inner cast shadow along north & left water edges so it unmistakably reads as recessed!
    cv.hline(69, 103, 62, col('teal', 0))
    cv.hline(69, 103, 63, col('teal', 1))
    cv.vline(69, 62, 86, col('teal', 0))
    cv.vline(70, 62, 86, col('teal', 1))
    # Gentle horizontal aqua-turquoise surface glints inside open water
    cv.hline(74, 99, 68, col('teal', 5))
    cv.hline(78, 95, 74, col('glass', 5))
    cv.hline(73, 89, 80, col('teal', 5))
    cv.hline(84, 100, 83, col('glass', 5))

    # Bamboo water spout (kakehi) pouring water into the top-left of pool
    cv.hline(66, 75, 59, col('straw', 5))
    cv.hline(66, 75, 60, col('straw', 2))
    cv.vline(74, 61, 67, col('glass', 6))
    cv.vline(75, 61, 66, col('white', 6))
    cv.hline(72, 78, 67, col('glass', 6))  # soft water splash ring
    cv.p(74, 67, col('white', 6))

    # Wooden bath bucket & folded white towel resting neatly on back stone coping/bench
    cv.outline_box(97, 54, 103, 59, col('cedar', 5), col('wood', 1))
    cv.rect(86, 53, 93, 57, col('white', 6))
    cv.hline(86, 93, 56, col('coolwhite', 3))

    # --- 3 Soft, Cohesive Curving Pale-Blue/White Steam Wisps Rising Cleanly Above Water Only ---
    # Strictly below the mini-kawara roof (y=50) — zero pixel confetti on the roof!
    wisp_specs = [
        (78, 79, 60, 1.8, 0.36, 0.0),   # left-center wisp
        (88, 82, 57, 2.2, 0.32, 1.3),   # center main wisp
        (96, 78, 61, 1.6, 0.38, 2.5),   # right-center wisp
    ]
    for base_x, y_bot, y_top, amp, freq, phase in wisp_specs:
        span = max(1, y_bot - y_top)
        for y in range(y_top, y_bot + 1):
            t = (y_bot - y) / span  # 0 at water, 1 at wisp tip
            sx = int(round(base_x + amp * math.sin(t * span * freq + phase)))
            if t < 0.16 or t > 0.84:
                # Tapered soft pale-blue tip/base dissolving into air & water
                cv.p(sx, y, col('glass', 6) if t < 0.5 else col('coolwhite', 4))
            else:
                # Continuous 2px curving pale-blue/white translucent steam ribbon
                cv.p(sx, y, col('white', 6) if (0.35 <= t <= 0.65) else col('coolwhite', 5))
                cv.p(sx + 1, y, col('glass', 6) if y > 63 else col('coolwhite', 4))

    # Warm glowing stone garden lantern tucked beside pool corner
    cv.rect(61, 79, 66, 81, col('stone', 5))
    cv.rect(62, 81, 65, 84, col('yellow', 5))
    cv.vline(62, 81, 84, col('stone', 2))
    cv.rect(62, 84, 65, 91, col('stone', 4))
    cv.rect(61, 90, 66, 93, col('stone', 3))

    # Grounding stone path & mossy garden edge along bottom
    for x in range(4, 108):
        cv.p(x, 93, col('stone', 4))
        cv.p(x, 94, col('stone', 2))
        cv.p(x, 95, col('ink', 1))
    cv.foliage_cluster(6, 88, 5, 4, ramp='foliage', seed=510)
    cv.foliage_cluster(106, 89, 4, 4, ramp='moss', seed=511)
    return cv


# ---------------------------------------------------------------------------
# 6. Cozy Community Garden Potting Shed & Timber Greenhouse (96x80)
# ---------------------------------------------------------------------------

def build_pk_urban_greenhouse():
    cv = Canvas(96, 80)
    seed = 906

    # --- Left Cozy Potting Shed (x=4..38, y=14..76) ---
    # Warm terracotta/wood pitched roof on potting shed
    cv.pitched_roof(3, 14, 39, 38, ramp='rooftile', ridge_hi=True, moss_rate=0.09, seed=seed)
    # Cedar vertical board siding
    cv.siding_wall(5, 38, 37, 75, ramp='cedar', base_i=4, horizontal=False, step=3, seed=seed + 2)
    cv.hline(5, 37, 38, col('wood', 0))
    cv.hline(5, 37, 39, col('wood', 1))

    # Wooden barn door with diagonal X-brace & iron hinges (x=10..28, y=43..75)
    cv.outline_box(10, 43, 28, 75, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    for vx in range(13, 27, 3):
        cv.vline(vx, 45, 73, col('wood', 2))
    # Horizontal crossbars
    cv.outline_box(11, 44, 27, 47, col('cedar', 4), col('wood', 1))
    cv.outline_box(11, 57, 27, 60, col('cedar', 4), col('wood', 1))
    cv.outline_box(11, 71, 27, 74, col('cedar', 4), col('wood', 1))
    # Diagonal X-bracing on lower & upper barn door panels
    for k in range(11):
        cv.p(12 + k, 47 + k * 10 // 11, col('cedar', 5))
        cv.p(25 - k, 47 + k * 10 // 11, col('cedar', 4))
        cv.p(12 + k, 60 + k * 10 // 11, col('cedar', 5))
        cv.p(25 - k, 60 + k * 10 // 11, col('cedar', 4))
    # Dark iron strap hinges & latch
    cv.hline(10, 15, 48, col('steel', 1))
    cv.hline(10, 15, 68, col('steel', 1))
    cv.p(24, 59, col('yellow', 5))

    # Small hanging tool/lantern above barn door
    draw_lantern(cv, 19, 40, warm=True, hanging=False)

    # --- Rainwater Barrel under Downspout (x=29..37, y=54..75) ---
    cv.vline(34, 38, 56, col('steel', 3))
    cv.vline(35, 38, 56, col('steel', 1))
    # Wooden barrel body
    cv.outline_box(29, 55, 37, 75, col('wood', 4), col('wood', 0), top_hi=col('glass', 5))
    cv.hline(30, 36, 56, col('glass', 4))  # rainwater glinting in barrel top
    cv.hline(29, 37, 61, col('steel', 1))  # iron hoop 1
    cv.hline(29, 37, 69, col('steel', 1))  # iron hoop 2
    cv.vline(31, 57, 74, col('cedar', 4))

    # --- Right Cedar-Framed Sunlit Timber Greenhouse (x=37..92, y=10..75) ---
    # Solid timber joining post & shadow seam sealing x=37, y=36..75 between shed and greenhouse
    cv.vline(37, 36, 75, col('wood', 0))
    cv.vline(36, 38, 75, col('wood', 2))

    # Hinged open roof vent on tapered greenhouse ridge
    cv.outline_box(58, 5, 72, 11, col('glass', 5), col('cedar', 1), top_hi=col('cedar', 5))
    cv.vline(65, 6, 10, col('cedar', 3))

    # Tapered top-3/4 sloped glass skylight trapezoid roof (x=37..93 at eave, inset 7px at ridge, y=10..37)
    for y in range(10, 37):
        ry = y - 10
        inset = int(round(7.0 * (1.0 - ry / 26.0)))
        lx = 37 + inset
        rx = 93 - inset
        rw = max(1, rx - lx)
        # 6 evenly-spaced angled glass roof rafters converging toward ridge
        ribs = {int(round(lx + k * (rw - 1) / 6.0)) for k in range(1, 6)}
        for x in range(lx, rx):
            dx = x - lx
            if ry == 0:
                cv.p(x, y, col('wood', 0) if dx in (0, rw - 1) else col('cedar', 6))
            elif ry == 1:
                cv.p(x, y, col('wood', 0) if dx in (0, rw - 1) else col('cedar', 4))
            elif ry == 2:
                cv.p(x, y, col('wood', 1))
            elif ry == 26:
                cv.p(x, y, col('wood', 0))
            elif ry == 25:
                cv.p(x, y, col('cedar', 6 if dx < rw - 2 else 4))
            elif dx == 0 or dx == rw - 1:
                cv.p(x, y, col('wood', 0))
            elif dx == 1:
                cv.p(x, y, col('cedar', 5))
            elif dx == rw - 2:
                cv.p(x, y, col('cedar', 3))
            elif x in ribs:
                cv.p(x, y, col('cedar', 4 if ry < 14 else 3))
            elif (x - 1) in ribs:
                cv.p(x, y, col('wood', 1))
            elif ry in (10, 18):
                cv.p(x, y, col('cedar', 3))
            else:
                diag = (dx + ry) % 9
                if diag in (1, 2):
                    cv.p(x, y, col('glass', 6))
                elif ry > 17 and hsh(x, y, seed + 15) > 0.52:
                    # Subtle lush canopy hints seen through lower sloped glass panes
                    cv.p(x, y, col('foliage', 4 if diag == 3 else 3))
                else:
                    cv.p(x, y, col('glass', 5 if (ry < 13 or diag == 3) else 4))

    # Greenhouse glass walls showing potted seedlings & flower beds inside (x=38..92, y=37..66)
    cv.rect(38, 37, 92, 66, col('glass', 2))
    # Interior warm sunlit back wall + two tiers of wooden seedling benches
    for y in range(37, 65):
        for x in range(39, 91):
            rx, ry = x - 39, y - 37
            if (rx + ry) % 12 in (2, 3):
                cv.p(x, y, col('glass', 6))
            elif ry < 8:
                cv.p(x, y, col('glass', 4 if (rx + ry) % 4 == 0 else 3))
            else:
                cv.p(x, y, col('glass', 3))

    # Upper wooden shelf inside greenhouse (y=49) with tiny potted seedlings
    cv.hline(40, 90, 49, col('cedar', 4))
    cv.hline(40, 90, 50, col('wood', 1))
    for px in range(42, 87, 7):
        cv.rect(px, 46, px + 4, 49, col('brick', 4))
        cv.p(px + 1, 45, col('foliage', 5))
        cv.p(px + 2, 44, col('foliage', 6))
        cv.p(px + 3, 45, col('foliage', 4))
        if (px // 7) % 2 == 0:
            cv.p(px + 2, 43, col('yellow', 5) if px % 3 == 0 else col('pink', 5))

    # Lower lush flower bed & tomato/herb seedlings inside greenhouse (y=54..64)
    for px in range(40, 89, 6):
        cv.rect(px, 60, px + 4, 65, col('brick', 4 if px % 4 == 0 else 3))
        cv.foliage_cluster(px + 2, 57, 3, 3, ramp='foliage', seed=px, blossom=col('pink', 5) if px % 12 == 0 else col('yellow', 5))

    # Crisp 3px dark eave cast shadow onto top of vertical glass wall (y=37..39)
    cv.hline(37, 93, 36, col('wood', 0))
    cv.hline(38, 92, 37, col('glass', 0))
    cv.hline(38, 92, 38, col('glass', 1))
    cv.hline(38, 92, 39, col('glass', 2))

    # Crisp cedar vertical mullions aligned flush with brick base (x=38..92, rightmost pixel x=91)
    for mx in (38, 47, 56, 65, 74, 83):
        cv.vline(mx, 37, 66, col('cedar', 4))
        cv.vline(mx + 1, 37, 66, col('wood', 1))
    # Rightmost glass corner frame aligned strictly flush with brick base (x=90..91)
    cv.vline(90, 37, 66, col('cedar', 3))
    cv.vline(91, 37, 66, col('wood', 0))
    # Re-apply top eave shadow across mullions at y=37..38
    for mx in (38, 47, 56, 65, 74, 83, 90):
        cv.p(mx, 37, col('wood', 0))
        cv.p(mx, 38, col('wood', 1))
    cv.hline(38, 92, 51, col('cedar', 3))
    cv.hline(38, 92, 65, col('cedar', 5))

    # Brick greenhouse kneewall base (x=38..92, y=66..75) flush with glass frame
    cv.brick_wall(38, 66, 92, 75, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=seed + 22)
    cv.hline(38, 92, 66, col('stone', 5))
    cv.vline(91, 66, 75, col('wood', 0))

    # --- Terracotta Pots, Seed Trays & Watering Can Outside Along Front ---
    # Terracotta pots cluster outside shed & greenhouse
    for tx, fl in ((4, 'red:4'), (9, 'yellow:5'), (44, 'pink:5'), (51, 'yellow:5'), (78, 'red:4'), (84, 'pink:4')):
        cv.rect(tx, 71, tx + 4, 76, col('brick', 4))
        cv.hline(tx - 1, tx + 5, 71, col('brick', 5))
        cv.hline(tx, tx + 4, 75, col('brick', 1))
        cv.p(tx + 1, 70, col('foliage', 5))
        cv.p(tx + 2, 69, col(fl.split(':')[0], int(fl.split(':')[1])))
        cv.p(tx + 3, 70, col('foliage', 4))

    # Teal metal watering can outside greenhouse (x=62..69, y=70..76)
    cv.outline_box(63, 71, 68, 76, col('teal', 4), col('teal', 1), top_hi=col('teal', 5))
    cv.p(62, 72, col('teal', 5))
    cv.p(61, 71, col('teal', 5))  # spout
    cv.p(68, 72, col('teal', 3))  # handle

    # Grounded flagstone & garden soil apron along bottom (y=75..80)
    for y in range(75, 80):
        for x in range(3, 93):
            r = hsh(x // 4, y, seed + 40)
            if y == 79:
                cv.p(x, y, col('ink', 1))
            elif 10 <= x <= 28:
                cv.p(x, y, col('flagstone', 4 if r > 0.5 else 3))
            else:
                cv.p(x, y, col('soil', 3 if r > 0.45 else 2) if y < 78 else col('lawn', 3 if r > 0.5 else 2))
    return cv


# ---------------------------------------------------------------------------
# 7. Urban Park Shrine Pavilion & Vermilion Torii Sanctuary Hall (112x96)
# ---------------------------------------------------------------------------

def build_pk_shrine_gate():
    cv = Canvas(112, 96)
    seed = 907
    cx = 56

    # --- Lush Green Park Trees Framing Left & Right ---
    cv.foliage_cluster(11, 34, 11, 14, ramp='foliage', seed=701)
    cv.foliage_cluster(101, 34, 11, 14, ramp='foliage', seed=702)
    cv.foliage_cluster(9, 58, 9, 13, ramp='green', seed=703)
    cv.foliage_cluster(103, 58, 9, 13, ramp='green', seed=704)
    # Tree trunks peeking below canopy
    cv.rect(6, 68, 11, 88, col('wood', 2))
    cv.vline(7, 68, 88, col('wood', 4))
    cv.rect(101, 68, 106, 88, col('wood', 2))
    cv.vline(102, 68, 88, col('wood', 4))

    # --- Sweeping Dark-Kawara Hipped Sanctuary Roof (x=12..100, y=4..40) ---
    draw_hipped_roof(cv, 12, 4, 100, 40, ramp='kawara', top_inset=14, moss_rate=0.05, seed=seed, upturned=True)
    # Gold-accented shrine ridge ornaments (katsuogi / finials)
    cv.hline(26, 86, 4, col('yellow', 4))
    for kx in range(32, 82, 10):
        cv.rect(kx, 2, kx + 4, 6, col('yellow', 5))
        cv.vline(kx, 2, 6, col('wood', 1))
        cv.vline(kx + 3, 2, 6, col('orange', 3))
    # Upturned eave tips
    cv.p(11, 38, col('kawara', 6))
    cv.p(100, 38, col('kawara', 4))

    # --- White Plaster Sanctuary Walls & Vermilion Lacquered Pillars (x=18..94, y=40..84) ---
    cv.rect(18, 40, 94, 84, col('white', 5))
    cv.stipple_rect(18, 40, 94, 84, 'white', 5, 4, 6, seed=seed + 10, rate=0.14)
    # Under-eave shadow & vermilion tie-beam
    cv.hline(18, 94, 40, col('ink', 0))
    cv.hline(18, 94, 41, col('red', 1))
    cv.outline_box(16, 42, 96, 47, col('red', 4), col('red', 0), top_hi=col('red', 5))

    # Central recessed sanctuary inner hall (x=38..74, y=47..82)
    cv.rect(38, 47, 74, 82, col('darkwood', 1))
    # Warm glowing golden sanctuary altar inside
    cv.rect(47, 56, 65, 74, col('orange', 3))
    cv.rect(50, 58, 62, 70, col('yellow', 4))
    cv.rect(54, 60, 58, 66, col('yellow', 5))
    # Sanctuary mirror & bell rope hanging center
    cv.rect(54, 53, 58, 57, col('white', 6))
    cv.vline(56, 47, 66, col('red', 4))
    cv.vline(55, 50, 62, col('white', 5))

    # Flanking traditional wooden lattice windows on white plaster walls
    for wx0, wx1 in ((22, 34), (78, 90)):
        cv.outline_box(wx0, 51, wx1, 66, col('wood', 2), col('darkwood', 0))
        for lx in range(wx0 + 2, wx1 - 1, 3):
            cv.vline(lx, 52, 65, col('cedar', 4))
            cv.vline(lx + 1, 52, 65, col('yellow', 3))
        cv.hline(wx0 + 1, wx1 - 1, 58, col('wood', 1))

    # Vermilion-red lacquered sanctuary hall pillars (placed wider so foreground torii separates cleanly!)
    for px in (18, 32, 76, 91):
        cv.rect(px, 42, px + 4, 84, col('red', 4))
        cv.vline(px, 42, 84, col('red', 5))
        cv.vline(px + 3, 42, 84, col('red', 1))
        cv.rect(px - 1, 82, px + 5, 85, col('stone', 4))  # stone pillar base

    # Braided straw Shimenawa rope + white zigzag Shide across sanctuary opening (y=48..53)
    for x in range(36, 76):
        sag = int(round(2.5 * math.sin(((x - 36) / 40.0) * math.pi)))
        cv.p(x, 48 + sag, col('straw', 5 if x % 2 == 0 else 4))
        cv.p(x, 49 + sag, col('straw', 3 if x % 2 == 0 else 2))
    for sx in (42, 51, 61, 70):
        cv.p(sx, 51, col('white', 6))
        cv.p(sx - 1, 52, col('white', 6))
        cv.p(sx, 53, col('white', 5))
        cv.p(sx + 1, 54, col('white', 5))

    # Glowing paper lanterns (chōchin) hanging left & right of sanctuary
    for lx in (28, 83):
        cv.vline(lx, 47, 51, col('darkwood', 0))
        cv.outline_box(lx - 2, 51, lx + 3, 59, col('yellow', 5), col('red', 2), top_hi=col('white', 6))
        cv.hline(lx - 1, lx + 2, 54, col('orange', 4))
        cv.hline(lx - 2, lx + 3, 51, col('darkwood', 1))
        cv.hline(lx - 2, lx + 3, 58, col('darkwood', 1))

    # Wooden offering box (saisen-bako) centered at sanctuary entrance (x=47..65, y=71..82)
    cv.outline_box(47, 71, 65, 82, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 6))
    for gx in range(49, 64, 2):
        cv.vline(gx, 72, 75, col('wood', 1))
    cv.hline(48, 64, 76, col('wood', 2))

    # Vermilion veranda railings flanking steps
    for rx0, rx1 in ((18, 39), (73, 94)):
        cv.hline(rx0, rx1, 74, col('red', 5))
        cv.hline(rx0, rx1, 75, col('red', 2))
        cv.hline(rx0, rx1, 79, col('red', 4))
        for bx in range(rx0 + 3, rx1, 5):
            cv.vline(bx, 75, 83, col('red', 3))
    # Stone platform under sanctuary
    draw_ashlar(cv, 16, 83, 96, 93, ramp='stone', base_i=4, bw=8, bh=5, seed=seed + 20)
    draw_steps(cv, 42, 81, 70, 94, count=4, ramp='stone', cheek_ramp='concrete')

    # --- Foreground Park Stone Lantern (Tōrō) & Stately Vermilion Torii Approach Arch ---
    # Classic stone lantern on left approach (x=14..22, y=69..92)
    cv.hline(15, 22, 70, col('stone', 6))
    cv.rect(14, 71, 23, 73, col('stone', 4))
    cv.rect(16, 73, 21, 78, col('yellow', 5))  # warm glowing firebox
    cv.vline(16, 73, 78, col('stone', 2))
    cv.vline(20, 73, 78, col('stone', 2))
    cv.rect(15, 78, 22, 80, col('stone', 5))
    cv.rect(17, 80, 20, 89, col('stone', 3))
    cv.rect(15, 89, 22, 92, col('stone', 4))

    # Crisp Foreground Vermilion Torii Gate framing center steps (distinct 3D depth separation!)
    # Cast shadow under kasagi & nuki beams onto sanctuary behind
    cv.hline(34, 78, 61, col('ink', 0))
    cv.hline(36, 76, 66, col('ink', 0))
    # Curved black-capped vermilion kasagi top lintel
    cv.hline(33, 79, 57, col('kuro', 1))
    cv.p(32, 56, col('kuro', 2))
    cv.p(79, 56, col('kuro', 2))
    cv.hline(34, 78, 58, col('red', 5))
    cv.hline(35, 77, 59, col('red', 4))
    cv.hline(36, 76, 60, col('red', 1))
    # Secondary nuki crossbeam + central gold plaque
    cv.hline(36, 76, 63, col('red', 5))
    cv.hline(36, 76, 64, col('red', 3))
    cv.hline(36, 76, 65, col('red', 1))
    cv.outline_box(53, 59, 59, 65, col('darkwood', 1), col('yellow', 4))
    cv.vline(56, 61, 64, col('yellow', 5))
    # Twin vermilion torii pillars cleanly separated inside the sanctuary pillars (x=39..43, x=69..73)
    for tx in (39, 69):
        cv.vline(tx - 1, 60, 93, col('ink', 0))  # crisp foreground depth outline!
        cv.rect(tx, 60, tx + 4, 90, col('red', 4))
        cv.vline(tx, 60, 90, col('red', 5))
        cv.vline(tx + 3, 60, 90, col('red', 1))
        cv.vline(tx + 4, 60, 93, col('ink', 0))
        cv.rect(tx - 1, 90, tx + 5, 94, col('kuro', 2))
        cv.hline(tx - 1, tx + 5, 94, col('stone', 5))

    # Flanking foreground greenery & gravel shrine approach
    draw_bush_hedge(cv, 1, 83, 15, 94, ramp='foliage', seed=710)
    draw_bush_hedge(cv, 96, 83, 111, 94, ramp='foliage', seed=711)
    cv.hline(2, 110, 94, col('stone', 4))
    cv.hline(2, 110, 95, col('ink', 1))
    return cv


# ---------------------------------------------------------------------------
# 8. Graceful Contemporary Stone & Glass Park Wedding Chapel (96x128)
# ---------------------------------------------------------------------------

def build_pk_modern_chapel():
    cv = Canvas(96, 128)
    seed = 908
    cx = 48

    # --- Slender Gleaming Gold Cross on Slate Finial Cap at Gable Peak (y=2..16) ---
    cv.vline(cx, 2, 14, col('yellow', 5))
    cv.vline(cx - 1, 3, 14, col('orange', 4))
    cv.hline(cx - 4, cx + 5, 6, col('yellow', 5))
    cv.hline(cx - 4, cx + 5, 7, col('orange', 3))
    cv.p(cx, 2, col('white', 6))

    # --- Top-3/4 Fable Gable Roof: Receding Side-Slope Slate Planes + Overhanging Bargeboards + Clean Pediment (y=13..51) ---
    # Matching machiya-gable / sake geometry: visible receding side-slope slate roof depth above & flanking
    # a recessed cream/stone triangular front pediment framed by thick dark overhanging bargeboards.
    for y in range(14, 51):
        ry = y - 14
        outer_hw = int(round(3 + 41 * (ry / 36.0)))  # y=14 -> hw=3, y=50 -> hw=44 (x=4..92)
        # Inner front gable pediment sits recessed ~10px below outer ridge peak in top-3/4 projection
        if y >= 25:
            inner_hw = int(round(1 + 32 * ((y - 25) / 25.0)))  # y=25 -> hw=1, y=50 -> hw=33 (x=15..81)
        else:
            inner_hw = -10
        lx, rx = cx - outer_hw, cx + outer_hw
        for x in range(lx, rx + 1):
            dx = x - cx
            adx = abs(dx)
            d_out = outer_hw - adx
            d_in = adx - inner_hw

            if y >= 25 and adx < inner_hw:
                # Clean recessed limestone/cream triangular front pediment (ZERO shingles on vertical wall!)
                if d_in in (-1, -2):
                    # Crisp 2px overhang shadow cast by thick dark bargeboard onto stone pediment
                    cv.p(x, y, col('stone', 2) if d_in == -1 else col('cream', 3))
                elif y == 49:
                    cv.p(x, y, col('cream', 3))
                elif y == 50:
                    cv.p(x, y, col('stone', 1))
                else:
                    # Subtle horizontal pale-limestone pediment courses
                    p_ry = y - 25
                    if p_ry % 5 == 4:
                        cv.p(x, y, col('cream', 4 if dx < 0 else 3))
                    else:
                        r = hsh(x // 7, p_ry // 5, seed + 4)
                        base_c = 5 if dx < 4 else 4
                        cv.p(x, y, col('cream', min(6, base_c + (1 if (p_ry % 5 == 0 and r > 0.4) else 0))))
            elif y >= 22 and 0 <= d_in <= 3:
                # Thick dark overhanging bargeboards framing the triangular front pediment
                if d_in == 0:
                    cv.p(x, y, col('kawara', 0))
                elif d_in == 1:
                    cv.p(x, y, col('kuro', 1))
                elif d_in == 2:
                    cv.p(x, y, col('kawara', 4 if dx < 0 else 2))
                else:
                    cv.p(x, y, col('kawara', 0))
            else:
                # Visible receding side-slope slate roof planes with crisp shingle courses!
                if d_out == 0 or y == 50:
                    cv.p(x, y, col('kawara', 0))
                elif d_out == 1:
                    # Sunlit outer ridge/verge coping bevel
                    cv.p(x, y, col('kawara', 6 if dx < 0 else 4))
                elif d_out == 2:
                    cv.p(x, y, col('kawara', 1))
                elif y == 49:
                    # Crisp dark eave drip edge along bottom of side-slope roof planes
                    cv.p(x, y, col('kawara', 1 if x % 4 != 0 else 2))
                else:
                    # Staggered slate shingle courses receding back along left/right roof slopes
                    ci = ry // 4
                    yy = ry % 4
                    # Step column phase along the slope so shingle courses read in 3/4 perspective
                    col_coord = int(round(adx - ry * 0.45)) + (2 if ci % 2 else 0)
                    bx = col_coord % 4
                    bi = col_coord // 4
                    r = hsh(bi, ci, seed)
                    rsh = 1 if dx > 0 else 0
                    if yy == 3 or bx == 3:
                        cv.p(x, y, col('kawara', max(0, 1 - rsh)))
                    else:
                        t = 5 if (yy == 0 and dx < 0) else (4 if dx < 0 else 3)
                        if r > 0.78:
                            t += 1
                        elif r < 0.22:
                            t -= 1
                        cv.p(x, y, col('kawara', max(1, min(6, t - rsh))))

    # Ornamental dark-slate ridge finial cap at apex (matching machiya-gable / sake ridge cap)
    cv.outline_box(cx - 3, 12, cx + 4, 17, col('kawara', 4), col('kawara', 0), top_hi=col('kawara', 6))
    cv.p(cx, 14, col('kawara', 1))

    # Circular rose stained glass set cleanly inside the cream/stone front pediment (cx=48, cy=39, r=6)
    rcy = 39
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            d = math.hypot(dx, dy)
            if d > 6.3:
                continue
            if d > 5.2:
                cv.p(cx + dx, rcy + dy, col('stone', 1))
            elif abs(dx) == 0 or abs(dy) == 0 or abs(abs(dx) - abs(dy)) <= 0.5:
                cv.p(cx + dx, rcy + dy, col('steel', 1))  # lead tracery
            elif d < 2.2:
                cv.p(cx + dx, rcy + dy, col('yellow', 5))
            elif (dx * dy) > 0:
                cv.p(cx + dx, rcy + dy, col('blue', 4 if d < 4.0 else 3))
            else:
                cv.p(cx + dx, rcy + dy, col('pink', 4 if d < 4.0 else 5))

    # --- Flanking Park Cypress Trees & Side Aisle Buttresses (tucked flush so ZERO gap seams!) ---
    # Deep shadow backing between cypress foliage & chapel side walls to prevent 1px interior holes
    cv.rect(6, 58, 10, 118, col('foliage', 1))
    cv.rect(86, 58, 90, 118, col('foliage', 1))
    draw_cypress(cv, 6, 56, 124, max_rx=5, seed=801)
    draw_cypress(cv, 90, 56, 124, max_rx=5, seed=802)

    # --- Main Chapel Body: Tall Pale-Limestone Piers + Stained-Glass Lancets (x=8..88, y=51..126) ---
    draw_ashlar(cv, 8, 51, 88, 126, ramp='cream', base_i=5, bw=8, bh=6, seed=seed + 10)
    # Crisp horizontal cornice with dark eave shadow cast onto its top & facade below (y=50..56)
    cv.outline_box(5, 50, 91, 55, col('white', 6), col('stone', 1), bot_sh=col('stone', 3))
    cv.hline(5, 91, 50, col('kawara', 0))  # dark eave shadow onto cornice top
    cv.hline(6, 90, 51, col('stone', 2))   # shadow gradient across upper cornice lip
    cv.hline(6, 90, 52, col('white', 6))   # sunlit cornice face
    for dx_dentil in range(8, 88, 4):
        cv.p(dx_dentil, 53, col('stone', 3))
    cv.hline(8, 88, 55, col('stone', 1))   # dark cornice cast shadow onto upper chapel wall
    cv.hline(8, 88, 56, col('cream', 3))

    # 5 Tall vertical pale-limestone piers framing the bays
    pier_xs = (8, 28, 34, 62, 83)
    for px in pier_xs:
        pw = 5 if px in (8, 83) else 4
        cv.rect(px, 55, px + pw, 118, col('white', 5))
        cv.vline(px, 55, 118, col('white', 6))
        cv.vline(px + pw - 1, 55, 118, col('stone', 2))
        cv.hline(px, px + pw, 55, col('stone', 1))
        # Subtle stone course bands on piers (non-repeating heights)
        for by in (64, 78, 93, 108):
            cv.hline(px, px + pw, by, col('cream', 3))

    # Helper for luminous stained-glass lancet windows
    def draw_stained_lancet(lx0, ly0, lx1, ly1, variant=0):
        w = lx1 - lx0
        lcx = (lx0 + lx1 - 1) / 2.0
        ar = max(3, w // 2 + 1)
        for y in range(ly0, ly1):
            for x in range(lx0, lx1):
                if y < ly0 + ar:
                    # Pointed gothic lancet arch
                    frac = (y - ly0) / max(1.0, ar)
                    hw = (w / 2.0) * math.sqrt(frac)
                    if abs(x - lcx) > hw + 0.3:
                        continue
                    if abs(x - lcx) > hw - 1.0:
                        cv.p(x, y, col('stone', 1))
                        continue
                elif x in (lx0, lx1 - 1) or y == ly1 - 1:
                    cv.p(x, y, col('stone', 1))
                    continue

                rx, ry = x - lx0, y - ly0
                h = ly1 - ly0
                # Lead came mullions
                if x == int(lcx) or (ry % 9 == 0 and ry > 4):
                    cv.p(x, y, col('steel', 1))
                else:
                    # Rich jewel-toned stained glass shifting top-to-bottom (guarantees non-cloned G4!)
                    band = (ry * 5) // max(1, h)
                    pat = (rx + ry + variant * 3) % 5
                    if band == 0:
                        cv.p(x, y, col('yellow', 5 if pat < 2 else 4))
                    elif band == 1:
                        cv.p(x, y, col('blue', 5 if pat < 2 else 4) if pat != 4 else col('glass', 6))
                    elif band == 2:
                        cv.p(x, y, col('pink', 5 if pat < 2 else 4) if pat != 3 else col('yellow', 5))
                    elif band == 3:
                        cv.p(x, y, col('teal', 5 if pat < 2 else 4) if pat != 4 else col('glass', 6))
                    else:
                        cv.p(x, y, col('orange', 4 if pat < 2 else 5) if pat != 3 else col('blue', 4))
        cv.hline(lx0 - 1, lx1 + 1, ly1, col('white', 6))
        cv.hline(lx0, lx1, ly1 + 1, col('stone', 2))

    # Tall side lancet stained-glass windows (left & right bays)
    draw_stained_lancet(15, 57, 26, 108, variant=0)
    draw_stained_lancet(70, 57, 81, 108, variant=2)
    # Center upper triptych stained-glass lancets above portal
    draw_stained_lancet(38, 56, 45, 83, variant=1)
    draw_stained_lancet(45, 54, 52, 83, variant=3)
    draw_stained_lancet(52, 56, 59, 83, variant=4)

    # --- Warm Wood Double Portal Doors under Stone Arch (x=37..59, y=88..117) ---
    # Limestone portal arch surround
    cv.outline_box(36, 86, 60, 117, col('stone', 3), col('stone', 1), top_hi=col('white', 6))
    # Warm timber double doors
    cv.outline_box(38, 89, 58, 117, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.vline(48, 89, 117, col('wood', 0))
    for vx in (41, 44, 51, 54):
        cv.vline(vx, 91, 116, col('wood', 2))
    # Arched decorative relief panels & gleaming gold door rings
    cv.outline_box(40, 92, 46, 104, col('cedar', 4), col('wood', 1))
    cv.outline_box(50, 92, 56, 104, col('cedar', 4), col('wood', 1))
    cv.p(46, 106, col('yellow', 5))
    cv.p(49, 106, col('yellow', 5))
    # Warm golden wall sconces flanking chapel doors
    draw_lantern(cv, 32, 96, warm=True, hanging=False)
    draw_lantern(cv, 64, 96, warm=True, hanging=False)

    # --- Ceremonial Stone Steps, Grounded Plinth & Wedding Flower Urns (y=115..128) ---
    # Solid stone courtyard apron beneath urns & steps so zero alpha holes appear at bottom
    for y in range(118, 127):
        for x in range(8, 88):
            r = hsh(x // 6, y // 3, seed + 30)
            cv.p(x, y, col('stone', 4 if r > 0.45 else 3) if y % 3 != 2 else col('stone', 2))
    draw_steps(cv, 28, 116, 68, 127, count=4, ramp='stone', cheek_ramp='white')
    # White bridal flower urns flanking steps with grounded cast shadow
    for ux in (20, 71):
        cv.foliage_cluster(ux + 2, 113, 4, 3, ramp='foliage', seed=ux, blossom=col('white', 6))
        cv.p(ux + 2, 112, col('pink', 5))
        cv.outline_box(ux, 116, ux + 5, 123, col('white', 5), col('stone', 1), top_hi=col('white', 6))
        cv.hline(ux, ux + 6, 123, col('stone', 1))

    # Lush front park hedges & grounded base
    draw_bush_hedge(cv, 2, 117, 20, 127, ramp='foliage', blossom=col('white', 6), seed=810)
    draw_bush_hedge(cv, 76, 117, 94, 127, ramp='foliage', blossom=col('white', 6), seed=811)
    cv.hline(2, 94, 127, col('ink', 1))
    return cv


# ---------------------------------------------------------------------------
# 9. Chic Parkside Glasshouse Garden Bistro (112x96)
# ---------------------------------------------------------------------------

def build_pk_rooftop_glass_bistro():
    cv = Canvas(112, 96)
    seed = 909

    # --- Main Glasshouse Bistro Roof: Tapered Top-3/4 Sloped Skylight Roof (x=3..73, y=8..38) ---
    for y in range(8, 37):
        ry = y - 8
        inset = int(round(9.0 * (1.0 - ry / 28.0)))
        lx = 3 + inset
        rx = 73 - inset
        rw = max(1, rx - lx)
        # 6 evenly-spaced angled bronze skylight ribs converging toward the ridge beam
        ribs = {int(round(lx + k * (rw - 1) / 6.0)) for k in range(1, 6)}
        for x in range(lx, rx):
            dx = x - lx
            if ry == 0:
                cv.p(x, y, col('darkwood', 0) if dx in (0, rw - 1) else col('cedar', 5))
            elif ry == 1:
                cv.p(x, y, col('darkwood', 0) if dx in (0, rw - 1) else col('cedar', 3))
            elif ry == 2:
                cv.p(x, y, col('darkwood', 1))
            elif ry == 28:
                cv.p(x, y, col('darkwood', 0))
            elif ry == 27:
                cv.p(x, y, col('cedar', 4 if dx < rw - 2 else 2))
            elif dx == 0 or dx == rw - 1:
                cv.p(x, y, col('darkwood', 0))
            elif dx == 1:
                cv.p(x, y, col('cedar', 4))
            elif dx == rw - 2:
                cv.p(x, y, col('darkwood', 2))
            elif x in ribs:
                cv.p(x, y, col('darkwood', 1))
            elif (x - 1) in ribs:
                cv.p(x, y, col('cedar', 3))
            elif ry in (11, 20):
                # Subtle horizontal bronze skylight purlins
                cv.p(x, y, col('darkwood', 2))
            else:
                # Lighter sky-reflecting sloped skylight glass with crisp diagonal sky sheen
                diag = (dx + ry) % 9
                if diag in (1, 2):
                    cv.p(x, y, col('glass', 6))
                elif diag == 3 and ry < 19:
                    cv.p(x, y, col('coolwhite', 5))
                elif ry < 14:
                    cv.p(x, y, col('glass', 5))
                elif ry < 22:
                    cv.p(x, y, col('glass', 4 if (dx + ry) % 3 != 0 else 5))
                else:
                    cv.p(x, y, col('glass', 3 if diag != 4 else 4))

    # Sleek dark-bronze roof cornice & fascia (y=36..40)
    cv.outline_box(3, 36, 73, 40, col('darkwood', 2), col('darkwood', 0), top_hi=col('cedar', 4))

    # --- Dark-Bronze Floor-to-Ceiling Café Glass Conservatory (x=5..71, y=40..89) ---
    cv.outline_box(5, 40, 71, 89, col('darkwood', 1), col('darkwood', 0))
    # Warm inviting interior backdrop visible through floor-to-ceiling glass
    for y in range(43, 87):
        for x in range(7, 69):
            ry = y - 43
            if ry < 10:
                cv.p(x, y, col('wood', 2))  # dark ceiling beams
            elif ry < 26:
                cv.p(x, y, col('orange', 3 if (x + y) % 4 != 0 else 4))  # warm amber cafe glow
            else:
                cv.p(x, y, col('cedar', 4 if ry < 35 else 3))

    # 3 Warm Glowing Pendant Lamps hanging inside the glass conservatory
    for px in (16, 34, 52):
        cv.vline(px, 43, 52, col('darkwood', 0))
        cv.hline(px - 2, px + 3, 52, col('cedar', 4))  # bronze shade
        cv.rect(px - 1, 53, px + 2, 56, col('yellow', 5))  # bright warm bulb glow
        cv.p(px, 54, col('white', 6))
        # Soft warm light pool below lamp
        for dy in range(3, 8):
            cv.hline(px - dy // 2, px + dy // 2 + 1, 53 + dy, col('yellow', 4))

    # Cozy Bistro Dining Tables with crisp cloth, chairs, candle & wine accents inside
    # Rich interior parquet floor strip behind glass
    for y in range(77, 87):
        for x in range(7, 46):
            cv.p(x, y, col('wood', 3 if (x // 3 + y) % 2 == 0 else 2))
    for tx in (10, 29):
        # Chairs left & right with distinct warm timber frames
        cv.outline_box(tx - 2, 68, tx + 1, 84, col('cedar', 4), col('wood', 0))
        cv.outline_box(tx + 10, 68, tx + 13, 84, col('cedar', 4), col('wood', 0))
        # Tabletop with crisp draped white bistro cloth & dark shadow fold
        cv.outline_box(tx, 71, tx + 11, 77, col('white', 6), col('steel', 2), bot_sh=col('coolwhite', 3))
        cv.rect(tx + 4, 77, tx + 7, 85, col('darkwood', 1))  # pedestal leg
        cv.hline(tx + 2, tx + 9, 85, col('darkwood', 0))
        # Tiny table candle flame, flower vase & wine bottle on table
        cv.p(tx + 5, 70, col('yellow', 5))
        cv.p(tx + 5, 69, col('white', 6))
        cv.p(tx + 8, 70, col('green', 3))
        cv.p(tx + 8, 69, col('pink', 5))
        cv.p(tx + 2, 70, col('red', 3))

    # Glazed double café entrance doors on right bay (x=47..66, y=56..88)
    cv.outline_box(47, 56, 66, 88, col('darkwood', 2), col('darkwood', 0))
    cv.door_glass(48, 57, 65, 88, frame='darkwood:3', warm=True)

    # Diagonal sky-blue glass sheen across conservatory windows
    for gx in (9, 27, 49):
        for k in range(14):
            if 44 + k < 66:
                cv.p(gx + k, 44 + k // 2, col('glass', 6))
                if k % 2 == 0:
                    cv.p(gx + k + 1, 44 + k // 2, col('glass', 5))

    # Crisp dark-bronze floor-to-ceiling mullions & transom bars
    for mx in (6, 23, 45, 68):
        cv.rect(mx, 40, mx + 2, 89, col('darkwood', 2))
        cv.vline(mx, 40, 89, col('cedar', 3))
    cv.hline(6, 70, 55, col('darkwood', 1))
    cv.hline(6, 70, 56, col('cedar', 3))
    # Dark eave cast shadow band directly under sloped skylight roof cornice (y=40..42)
    cv.hline(5, 71, 40, col('darkwood', 0))
    cv.hline(5, 71, 41, col('darkwood', 1))
    cv.hline(6, 70, 42, col('wood', 1))

    # Stone plinth along left bistro base (x=5..47, y=86..94)
    draw_ashlar(cv, 5, 86, 47, 94, ramp='stone', base_i=4, bw=7, bh=4, seed=seed + 11)

    # Solid sunlit stone threshold step sealing x=46..69, y=88..94 beneath 1F door (ZERO alpha holes!)
    cv.hline(46, 69, 88, col('stone', 1))
    cv.hline(46, 69, 89, col('stone', 6))
    cv.hline(46, 69, 90, col('stone', 5))
    cv.hline(46, 69, 91, col('stone', 3))
    cv.hline(46, 69, 92, col('flagstone', 5))
    cv.hline(46, 69, 93, col('flagstone', 4))
    for jx in (52, 58, 64):
        cv.p(jx, 89, col('stone', 4))
        cv.p(jx, 90, col('stone', 4))
        cv.p(jx, 92, col('flagstone', 3))
        cv.p(jx, 93, col('flagstone', 3))
    cv.vline(46, 88, 94, col('stone', 2))
    cv.vline(68, 88, 94, col('stone', 2))

    # --- Attached Sunlit Foreshortened Paved Terrace Patio with Grounded Olive Trees & Awning (x=68..109, y=38..95) ---
    # Warm cream stucco garden backdrop wall behind patio (y=38..62, smooth stucco not tall stone blocks)
    cv.stipple_rect(70, 38, 108, 62, 'cream', 4, 3, 5, seed=seed + 15, rate=0.14)
    cv.hline(70, 108, 38, col('stone', 5))
    cv.hline(70, 108, 39, col('stone', 2))
    cv.vline(107, 38, 62, col('stone', 1))
    # Lush olive tree canopy peeking above right garden wall
    cv.foliage_cluster(99, 32, 10, 9, ramp='midori', seed=901)
    cv.foliage_cluster(84, 34, 8, 7, ramp='moss', seed=902)

    # Chic Terracotta-Red & Cream Striped Café Awning over Patio (x=69..109, y=42..55)
    cv.awning(69, 42, 109, 55, ramp_a='brick', ramp_b='cream', stripe_w=4)
    # Warm glowing bistro string-lights tucked beneath the awning edge!
    for fx in range(73, 106, 6):
        cv.p(fx, 56, col('yellow', 5))
        cv.p(fx + 1, 56, col('orange', 4))
    # Bronze awning support post
    cv.vline(106, 55, 91, col('darkwood', 1))
    cv.vline(107, 55, 91, col('cedar', 3))

    # Foreshortened Horizontal Paved Patio Floor (x=68..108, y=62..91 — 3px row height, low-contrast joints!)
    for y in range(62, 91):
        ry = y - 62
        row_i = ry // 3
        row_y = ry % 3
        off = 4 if (row_i % 2 == 1) else 0
        for x in range(68, 107):
            rx = x - 68
            if ry == 0:
                # Crisp dark back-wall base shadow seam
                cv.p(x, y, col('flagstone', 1))
            elif ry == 1:
                # Soft 2nd row wall shadow
                cv.p(x, y, col('flagstone', 2))
            elif rx == 0:
                # Shadow cast by bistro side wall onto left patio edge
                cv.p(x, y, col('flagstone', 2))
            elif row_y == 2:
                # Low-contrast horizontal paving joint (3px foreshortened rows!)
                cv.p(x, y, col('flagstone', 3))
            elif (rx + off) % 8 == 0:
                # Subtle low-contrast vertical slab joint
                cv.p(x, y, col('flagstone', 3))
            else:
                r = hsh((rx + off) // 8, row_i, seed + 25)
                if row_y == 0 and r > 0.55:
                    cv.p(x, y, col('flagstone', 5))
                else:
                    cv.p(x, y, col('flagstone', 4 if r > 0.22 else 5))

    # Patio outdoor bistro round table & 2 cafe chairs grounded with cast shadows (x=78..95, y=69..84)
    # Cast floor shadows beneath outdoor table & chairs
    cv.hline(78, 95, 82, col('flagstone', 2))
    cv.hline(83, 90, 83, col('flagstone', 1))
    # Café chairs
    cv.rect(79, 70, 82, 82, col('cedar', 4))
    cv.vline(79, 70, 82, col('wood', 1))
    cv.rect(91, 70, 94, 82, col('cedar', 4))
    cv.vline(93, 70, 82, col('wood', 1))
    # Table cloth, pedestal & coffee/pastry
    cv.outline_box(82, 71, 91, 77, col('white', 6), col('steel', 2), bot_sh=col('coolwhite', 3))
    cv.vline(86, 77, 83, col('darkwood', 1))
    cv.hline(84, 89, 82, col('darkwood', 1))
    cv.p(85, 73, col('brick', 4))
    cv.p(88, 73, col('yellow', 5))

    # BOTH Potted Silvery-Green Olive Trees grounded firmly on lower patio floor plane with cast shadows!
    for ox, pot_y in ((73, 79), (100, 78)):
        # Ground cast shadow beneath & right of terracotta pot
        cv.hline(ox - 3, ox + 5, pot_y + 6, col('flagstone', 1))
        cv.hline(ox - 2, ox + 5, pot_y + 7, col('flagstone', 2))
        # Terracotta pot grounded on lower patio floor
        cv.outline_box(ox - 3, pot_y, ox + 4, pot_y + 6, col('brick', 4), col('brick', 1), top_hi=col('brick', 5))
        cv.hline(ox - 2, ox + 3, pot_y + 1, col('soil', 1))  # dark soil inside pot rim
        # Solid 2px trunk emerging cleanly from soil into canopy (no floating sticks!)
        cv.rect(ox - 1, pot_y - 4, ox + 1, pot_y + 2, col('wood', 3))
        cv.vline(ox, pot_y - 4, pot_y + 2, col('wood', 1))
        # Lush olive tree canopy crowning trunk
        cv.foliage_cluster(ox, pot_y - 7, 5, 5, ramp='midori', seed=ox + pot_y)
        cv.foliage_cluster(ox - 1, pot_y - 8, 3, 3, ramp='moss', seed=ox + 3)

    # Low dark-bronze patio railing across front-right (x=68..108, y=86..93)
    cv.hline(68, 108, 86, col('cedar', 4))
    cv.hline(68, 108, 87, col('darkwood', 1))
    for rx in range(70, 108, 4):
        cv.vline(rx, 87, 92, col('darkwood', 1))
    cv.outline_box(68, 91, 108, 95, col('stone', 4), col('stone', 1), top_hi=col('stone', 5))

    # Wooden Chalkboard Bistro Menu A-frame grounded solidly on sunlit stone threshold/apron with cast shadow (x=60..67, y=82..93)
    cv.hline(60, 69, 92, col('flagstone', 1))
    cv.hline(61, 68, 93, col('flagstone', 2))
    cv.outline_box(60, 82, 67, 91, col('kuro', 2), col('cedar', 3))
    cv.vline(60, 91, 93, col('wood', 1))  # left grounded A-frame leg
    cv.vline(66, 91, 93, col('wood', 1))  # right grounded A-frame leg
    cv.hline(62, 65, 84, col('cream', 6))
    cv.hline(62, 66, 86, col('yellow', 5))
    cv.hline(62, 64, 88, col('white', 5))

    # Grounded sidewalk curb across full width
    cv.hline(4, 108, 94, col('stone', 3))
    cv.hline(4, 108, 95, col('ink', 1))
    return cv


# ---------------------------------------------------------------------------
# 10. Crisp White-Wood & Brick Park Tennis / Sports Clubhouse (112x96)
# ---------------------------------------------------------------------------

def build_pk_tennis_clubhouse():
    cv = Canvas(112, 96)
    seed = 910
    cx = 56

    # --- Pitched Green-Shingle Roof (x=4..108, y=10..39) ---
    draw_hipped_roof(cv, 4, 10, 108, 39, ramp='midori', top_inset=10, moss_rate=0.0, seed=seed)
    # Crisp white-wood roof eave fascia
    cv.hline(4, 108, 38, col('white', 6))
    cv.hline(4, 108, 39, col('coolwhite', 3))
    cv.hline(4, 108, 40, col('steel', 1))

    # --- Central White-Wood Louvered Cupola & Gold Weathervane (x=46..66, y=1..26) ---
    # Slender gold & dark-iron weathervane
    cv.vline(cx, 2, 10, col('steel', 1))
    cv.hline(cx - 5, cx + 6, 4, col('yellow', 5))
    cv.p(cx - 5, 3, col('yellow', 4))
    cv.p(cx - 5, 5, col('yellow', 4))  # tail fin
    cv.p(cx + 5, 3, col('yellow', 5))  # arrow head
    cv.p(cx, 2, col('white', 6))
    # Small green cupola pyramidal cap roof (y=9..16)
    for y in range(9, 17):
        ry = y - 9
        hw = 2 + ry
        cv.hline(cx - hw, cx + hw + 1, y, col('midori', 4 if ry % 2 == 0 else 3))
        cv.p(cx - hw, y, col('white', 6))
        cv.p(cx + hw, y, col('midori', 0))
    # White louvered cupola box (x=48..64, y=16..26)
    cv.outline_box(48, 16, 64, 26, col('white', 5), col('steel', 1), top_hi=col('white', 6))
    for ly in range(18, 24, 2):
        cv.hline(51, 61, ly, col('midori', 2))
        cv.hline(51, 61, ly + 1, col('white', 4))

    # --- 2F Crisp White-Wood Clapboard Lounge Facade (x=8..104, y=40..64) ---
    cv.siding_wall(8, 40, 104, 64, ramp='white', base_i=5, horizontal=True, step=3, seed=seed + 5)
    cv.hline(8, 104, 40, col('coolwhite', 1))  # eave shadow
    # Forest-green vertical corner trim boards
    for tx in (8, 101):
        cv.rect(tx, 40, tx + 3, 64, col('green', 2))
        cv.vline(tx, 40, 64, col('green', 3))
        cv.vline(tx + 2, 40, 64, col('green', 0))

    # 3 Generous Warm Lounge / Locker-Room Windows with Green-and-White Striped Club Awnings!
    for wx0, wx1 in ((15, 34), (47, 65), (78, 97)):
        cv.window(wx0, 45, wx1, 60, style='warm', frame='steel:2', sill='white:6')
        # Crisp white interior muntin cross
        cv.vline((wx0 + wx1) // 2, 49, 59, col('white', 6))
        cv.hline(wx0 + 1, wx1 - 1, 54, col('white', 6))
        # Green-and-white striped club awning cleanly crowning top of each window
        cv.awning(wx0 - 2, 42, wx1 + 2, 48, ramp_a='green', ramp_b='white', stripe_w=3)
    # Club crest medallions between windows (crossed tennis rackets emblem)
    for mx in (40, 71):
        cv.outline_box(mx - 3, 49, mx + 4, 56, col('green', 2), col('white', 6))
        cv.p(mx - 1, 51, col('yellow', 5))
        cv.p(mx + 1, 51, col('yellow', 5))
        cv.p(mx, 52, col('yellow', 5))
        cv.p(mx - 1, 53, col('yellow', 4))
        cv.p(mx + 1, 53, col('yellow', 4))

    # --- Covered Wrap-Around Veranda Roof Band (x=2..110, y=61..68) ---
    cv.pitched_roof(2, 61, 110, 68, ramp='midori', ridge_hi=False, moss_rate=0.0, seed=seed + 8)
    cv.hline(2, 110, 67, col('white', 6))
    cv.hline(2, 110, 68, col('steel', 1))

    # --- 1F Brick Lower Wall Behind Wrap-Around Veranda Porch (x=6..106, y=69..88) ---
    cv.brick_wall(6, 69, 106, 88, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=seed + 12)
    cv.hline(6, 106, 69, col('brick', 1))  # porch ceiling shadow

    # Warm clubhouse lounge double door center + side locker windows
    cv.door_glass(47, 71, 65, 87, frame='white:5', warm=True)
    cv.window(15, 71, 33, 81, style='warm', frame='white:5', sill='white:6')
    cv.window(79, 71, 97, 81, style='warm', frame='white:5', sill='white:6')

    # --- Wrap-Around Wooden Veranda Deck Floor (x=4..108, y=82..91) ---
    for y in range(82, 91):
        ry = y - 82
        for x in range(4, 108):
            if ry == 0:
                cv.p(x, y, col('wood', 1))
            elif ry % 2 == 0:
                cv.p(x, y, col('floorwood', 4 if hsh(x // 5, ry, seed) > 0.35 else 3))
            else:
                cv.p(x, y, col('floorwood', 3))

    # --- Veranda Porch Props: Club Bench (left) & Tennis Rackets Display (right) ---
    # Left wooden club bench (x=14..36, y=77..85)
    cv.outline_box(14, 77, 36, 81, col('cedar', 5), col('wood', 1), top_hi=col('cedar', 6))
    cv.hline(14, 36, 81, col('cedar', 4))
    cv.vline(16, 81, 85, col('wood', 1))
    cv.vline(33, 81, 85, col('wood', 1))
    # Folded white tennis towel & blue sports bag on bench
    cv.rect(18, 76, 23, 79, col('white', 6))
    cv.outline_box(27, 75, 34, 80, col('blue', 4), col('navy', 1), top_hi=col('blue', 5))

    # Right tennis rackets display rack + basket of bright tennis balls (x=76..98, y=73..86)
    cv.outline_box(76, 73, 91, 84, col('wood', 3), col('wood', 0), top_hi=col('cedar', 5))
    # 3 crisp mini tennis rackets racked upright!
    for rx in (78, 82, 86):
        cv.rect(rx, 74, rx + 3, 78, col('cream', 6))  # strings head
        cv.p(rx, 74, col('red', 4 if rx == 78 else (3 if rx == 82 else 2)))
        cv.p(rx + 2, 74, col('green', 4))
        cv.vline(rx + 1, 78, 83, col('cedar', 5))  # handle
    # Basket of bright yellow-green tennis balls beside rack (x=92..99, y=78..85)
    cv.outline_box(92, 80, 99, 85, col('steel', 4), col('steel', 1))
    for bx, by in ((93, 79), (95, 78), (97, 79), (94, 80), (96, 80)):
        cv.p(bx, by, col('foliage', 6) if (bx % 2 == 0) else col('yellow', 5))

    # --- Crisp White-Wood Porch Columns & Wrap-Around Balustrade ---
    # White columns supporting porch overhang
    for px in (5, 42, 67, 104):
        cv.rect(px, 68, px + 3, 91, col('white', 5))
        cv.vline(px, 68, 91, col('white', 6))
        cv.vline(px + 2, 68, 91, col('coolwhite', 2))

    # Front white balustrade rails left & right of center steps
    for rx0, rx1 in ((6, 44), (68, 106)):
        cv.hline(rx0, rx1, 82, col('white', 6))
        cv.hline(rx0, rx1, 83, col('steel', 2))
        for bx in range(rx0 + 2, rx1, 3):
            cv.vline(bx, 83, 90, col('white', 5))
            cv.vline(bx + 1, 83, 90, col('coolwhite', 2))
        cv.hline(rx0, rx1, 89, col('white', 5))
        cv.hline(rx0, rx1, 90, col('steel', 1))

    # Brick porch foundation piers + wide central veranda steps
    cv.brick_wall(6, 90, 44, 95, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=seed + 20)
    cv.brick_wall(68, 90, 106, 95, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=seed + 21)
    draw_steps(cv, 44, 86, 68, 95, count=3, ramp='cedar', cheek_ramp='white')

    # Manicured park boxwood hedges flanking the clubhouse
    draw_bush_hedge(cv, 2, 86, 16, 95, ramp='foliage', blossom=col('white', 6), seed=950)
    draw_bush_hedge(cv, 96, 86, 110, 95, ramp='foliage', blossom=col('yellow', 5), seed=951)
    cv.hline(2, 110, 95, col('ink', 1))
    return cv


# ---------------------------------------------------------------------------
# Manifest Specifications & Runner
# ---------------------------------------------------------------------------

SPECS = [
    {
        'id': 'mf-bldg-pk_glass_conservatory',
        'name': '대형 식물원 유리 온실 (빅토리안 돔)',
        'category': 'park_recreation',
        'w': 8, 'h': 7,
        'pxW': 128, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['park', 'botanical', 'conservatory', 'greenhouse', 'glass-dome', 'landmark'],
        'fn': build_pk_glass_conservatory,
    },
    {
        'id': 'mf-bldg-pk_amphitheater',
        'name': '야외 음악당·음향 셸 파빌리온',
        'category': 'park_recreation',
        'w': 9, 'h': 6,
        'pxW': 144, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['park', 'amphitheater', 'bandstand', 'stage', 'culture', 'music'],
        'fn': build_pk_amphitheater,
    },
    {
        'id': 'mf-bldg-pk_lakeside_boathouse',
        'name': '호숫가 목조 보트하우스·보트 대여소',
        'category': 'park_recreation',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['park', 'boathouse', 'lake', 'dock', 'swan-boat', 'recreation'],
        'fn': build_pk_lakeside_boathouse,
    },
    {
        'id': 'mf-bldg-pk_community_center',
        'name': '2층 주민 문화·커뮤니티 센터 (옥상 정원)',
        'category': 'park_recreation',
        'w': 8, 'h': 7,
        'pxW': 128, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['park', 'community-center', 'culture', 'roof-garden', 'skylight', 'louvers'],
        'fn': build_pk_community_center,
    },
    {
        'id': 'mf-bldg-pk_onsen_steam_terrace',
        'name': '도심 온천·족욕 테라스 정자',
        'category': 'park_recreation',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['park', 'onsen', 'hot-spring', 'foot-bath', 'steam', 'shoji', 'recreation'],
        'fn': build_pk_onsen_steam_terrace,
    },
    {
        'id': 'mf-bldg-pk_urban_greenhouse',
        'name': '도심 텃밭 원예 창고·목조 온실',
        'category': 'park_recreation',
        'w': 6, 'h': 5,
        'pxW': 96, 'pxH': 80,
        'passableTopRows': 2,
        'tags': ['park', 'greenhouse', 'garden', 'potting-shed', 'seedlings', 'recreation'],
        'fn': build_pk_urban_greenhouse,
    },
    {
        'id': 'mf-bldg-pk_shrine_gate',
        'name': '도심 공원 신사 본전·주홍 도리이',
        'category': 'park_recreation',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['park', 'shrine', 'torii', 'sanctuary', 'kawara', 'culture'],
        'fn': build_pk_shrine_gate,
    },
    {
        'id': 'mf-bldg-pk_modern_chapel',
        'name': '공원 현대식 석조·스테인드글라스 채플',
        'category': 'park_recreation',
        'w': 6, 'h': 8,
        'pxW': 96, 'pxH': 128,
        'passableTopRows': 2,
        'tags': ['park', 'chapel', 'wedding', 'stained-glass', 'spire', 'culture'],
        'fn': build_pk_modern_chapel,
    },
    {
        'id': 'mf-bldg-pk_rooftop_glass_bistro',
        'name': '공원 유리온실 가든 비스트로·테라스',
        'category': 'park_recreation',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['park', 'bistro', 'cafe', 'glasshouse', 'patio', 'olive-tree', 'recreation'],
        'fn': build_pk_rooftop_glass_bistro,
    },
    {
        'id': 'mf-bldg-pk_tennis_clubhouse',
        'name': '화이트우드·벽돌 테니스 클럽하우스',
        'category': 'park_recreation',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['park', 'tennis', 'clubhouse', 'sports', 'veranda', 'cupola', 'recreation'],
        'fn': build_pk_tennis_clubhouse,
    },
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest_items = []
    for sp in SPECS:
        cv = sp['fn']()
        assert cv.w == sp['pxW'] and cv.h == sp['pxH'], f"{sp['id']} size mismatch {cv.w}x{cv.h}"
        out_png = os.path.join(OUT_DIR, f"{sp['id']}.png")
        cv.save(out_png)
        item = {k: v for k, v in sp.items() if k != 'fn'}
        manifest_items.append(item)
        print(f"  wrote {sp['id']} ({cv.w}x{cv.h}) -> {out_png}")

    mpath = os.path.join(OUT_DIR, 'manifest.json')
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump({'batch': BATCH, 'kind': 'buildings', 'items': manifest_items}, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(manifest_items)} buildings + manifest -> {OUT_DIR}")


if __name__ == '__main__':
    main()
