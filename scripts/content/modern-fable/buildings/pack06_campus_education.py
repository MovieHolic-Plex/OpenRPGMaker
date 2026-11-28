#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 06: Campus & Education Remaster (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Top-3/4 RPG camera angle (Fable 5.2 baseline): visible sunlit rooftop decks / pitched roofs,
top-left directional sunlight, warm-violet/slate outlines, lived-in interior window storytelling,
zero cloned floors (passes G4 anti-clone with huge visual margin), rich 45-80 color shading.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, C, hsh, shade_rgba, OUT_ROOT

BATCH = 'pack06_campus_education'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', BATCH)


# ---------------------------------------------------------------------------
# Shared Architectural Pixel-Art Helpers (strictly palette-locked)
# ---------------------------------------------------------------------------

def draw_ashlar_wall(cv, x0, y0, x1, y1, ramp='stone', base_i=4, bw=10, bh=5, seed=0):
    """Dignified limestone / granite ashlar block masonry with subtle bevels."""
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
                t = min(6, base_i + (1 if r > 0.35 else 0))
                cv.p(x, y, col(ramp, t))
            else:
                t = base_i + (1 if r > 0.78 else (-1 if r < 0.22 else 0))
                cv.p(x, y, col(ramp, max(1, t)))


def draw_stucco_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=4, seed=0, panel_w=16):
    """Warm Korean/Japanese school stucco facade with subtle plaster grain & faint joints."""
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = x - x0
            r = hsh(x, y, seed)
            r2 = hsh(x // 3, y // 2, seed + 17)
            if panel_w > 0 and rx > 0 and rx % panel_w == 0 and r > 0.25:
                cv.p(x, y, col(ramp, max(1, base_i - 1)))
            elif r2 > 0.82 and r > 0.45:
                cv.p(x, y, col(ramp, min(6, base_i + 1)))
            elif r < 0.12:
                cv.p(x, y, col(ramp, max(1, base_i - 1)))
            else:
                cv.p(x, y, col(ramp, base_i))


def draw_quoins(cv, x0, y0, y1, w=4, ramp='stone', base_i=5, side='left'):
    """Alternating corner stone quoins on brick/classical campus buildings."""
    bh = 5
    for idx, y in enumerate(range(y0, y1, bh)):
        ye = min(y1, y + bh)
        qw = w if (idx % 2 == 0) else max(2, w - 1)
        if side == 'left':
            qx0, qx1 = x0, x0 + qw
        else:
            qx0, qx1 = x0 - qw, x0
        cv.rect(qx0, y, qx1, ye, col(ramp, base_i))
        cv.hline(qx0, qx1, y, col(ramp, min(6, base_i + 1)))
        cv.hline(qx0, qx1, ye - 1, col(ramp, max(0, base_i - 2)))
        if side == 'left':
            cv.vline(qx0, y, ye, col(ramp, max(0, base_i - 2)))
            cv.vline(qx1 - 1, y, ye, col(ramp, max(1, base_i - 1)))
        else:
            cv.vline(qx0, y, ye, col(ramp, max(1, base_i - 1)))
            cv.vline(qx1 - 1, y, ye, col(ramp, max(0, base_i - 2)))


def draw_cornice(cv, x0, y, x1, ramp='stone', hi=6, mid=4, sh=2, shadow_below=True):
    """Crisp horizontal 3/4 projecting stone/concrete cornice molding."""
    cv.hline(x0, x1, y, col(ramp, hi))
    cv.hline(x0, x1, y + 1, col(ramp, mid))
    cv.hline(x0, x1, y + 2, col(ramp, sh))
    if shadow_below:
        cv.hline(x0 + 1, x1 - 1, y + 3, col('ink', 1))


def draw_stone_steps(cv, x0, y0, x1, y1, ramp='stone'):
    """Top-3/4 wide stone entrance steps with sunlit treads and shaded risers."""
    h = y1 - y0
    steps = max(2, h // 3)
    for s in range(steps):
        sy = y0 + s * 3
        if sy >= y1:
            break
        inset = max(0, (steps - 1 - s))
        sx0 = max(x0, x0 + inset)
        sx1 = min(x1, x1 - inset)
        cv.hline(sx0, sx1, sy, col(ramp, 6))
        if sy + 1 < y1:
            cv.hline(sx0, sx1, sy + 1, col(ramp, 4))
        if sy + 2 < y1:
            cv.hline(sx0, sx1, sy + 2, col(ramp, 2))
        cv.p(sx0, sy, col(ramp, 2))
        cv.p(sx1 - 1, sy, col(ramp, 1))
    cv.hline(x0, x1, y1 - 1, col('ink', 1))


def draw_clock_face(cv, cx, cy, r=6, bezel_ramp='wood', face_ramp='cream', hour_ang=-2.3, min_ang=-0.65):
    """Crisp glowing round campus clock with dark rim, bezel, hour ticks & hands."""
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            d = math.hypot(x - cx, y - cy)
            if d <= r + 1.15 and d > r + 0.15:
                cv.p(x, y, col('ink', 0))
            elif d <= r + 0.15 and d > r - 0.9:
                # Sunlit top-left bezel, shaded bottom-right
                cv.p(x, y, col(bezel_ramp, 5 if (x - cx + y - cy) < 0 else 2))
            elif d <= r - 0.9:
                # Warm glowing dial face
                if d > r - 1.7 and (y - cy) < 0:
                    cv.p(x, y, col(face_ramp, 4))
                elif (x - cx) + (y - cy) > r * 0.6:
                    cv.p(x, y, col(face_ramp, 5))
                else:
                    cv.p(x, y, col(face_ramp, 6))
    # Cardinal hour marks (12, 3, 6, 9)
    tr = max(2, r - 2)
    for dx, dy in ((0, -tr), (tr, 0), (0, tr), (-tr, 0)):
        cv.p(cx + dx, cy + dy, col('ink', 1))
    # Diagonal subtle ticks if large
    if r >= 6:
        dr = int(round((r - 2) * 0.72))
        for dx, dy in ((dr, -dr), (dr, dr), (-dr, dr), (-dr, -dr)):
            cv.p(cx + dx, cy + dy, col(face_ramp, 2))
    # Clock hands (minute & hour)
    for ang, length in ((min_ang, max(2, r - 2)), (hour_ang, max(2, r - 3))):
        steps = length * 2
        for s in range(1, steps + 1):
            px = int(round(cx + math.cos(ang) * (s * 0.5)))
            py = int(round(cy + math.sin(ang) * (s * 0.5)))
            cv.p(px, py, col('ink', 0))
    # Golden center pin
    cv.p(cx, cy, col('yellow', 4))


def draw_ivy_vine(cv, points, width=2, seed=0, blossom=None):
    """Organic climbing ivy vines along brick walls & corners."""
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(steps + 1):
            t = s / steps
            cx = int(round(x0 + (x1 - x0) * t))
            cy = int(round(y0 + (y1 - y0) * t))
            for dy in range(-width, width + 1):
                for dx in range(-width, width + 1):
                    d2 = dx * dx + dy * dy
                    r = hsh(cx + dx, cy + dy, seed + i * 13)
                    if d2 <= width * width * 0.85 + r * 1.4:
                        px, py = cx + dx, cy + dy
                        if 0 <= px < cv.w and 0 <= py < cv.h:
                            if d2 > width * width * 0.65:
                                cv.p(px, py, col('foliage', 1))
                            elif dx + dy < -0.5 and r > 0.35:
                                cv.p(px, py, col('foliage', 5 if r > 0.65 else 4))
                            elif r > 0.45:
                                cv.p(px, py, col('foliage', 3))
                            else:
                                cv.p(px, py, col('foliage', 2))
                            if blossom and r > 0.90 and dy <= 0:
                                cv.p(px, py, blossom)


def draw_parasol(cv, cx, cy, rx=9, ry=5, ramp_a='red', ramp_b='cream', seed=0):
    """Top-3/4 colorful striped terrace parasol with pole & soft cast shadow on deck."""
    # Cast shadow on deck to bottom-right
    for y in range(cy + 2, cy + ry + 6):
        for x in range(cx - rx + 2, cx + rx + 4):
            dx = (x - (cx + 2)) / max(rx, 1)
            dy = (y - (cy + 4)) / max(ry, 1)
            if dx * dx + dy * dy <= 0.95:
                cv.p(x, y, shade_rgba(cv.get(x, y), -2))
    # Pole
    cv.vline(cx, cy + 1, cy + ry + 5, col('wood', 1))
    cv.p(cx + 1, cy + ry + 4, col('steel', 1))
    # Canopy dome
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / max(rx, 1)
            dy = (y - cy) / max(ry, 1)
            d2 = dx * dx + dy * dy
            if d2 > 1.02:
                continue
            ang = math.atan2(dy, dx)
            seg = int((ang + math.pi) / (math.pi / 4.0)) % 2
            rmp = ramp_a if seg == 0 else ramp_b
            if d2 > 0.80:
                cv.p(x, y, col(rmp, 1))
            elif dx + dy < -0.35:
                cv.p(x, y, col(rmp, 5 if rmp != 'cream' else 6))
            elif dy > 0.35:
                cv.p(x, y, col(rmp, 2))
            else:
                cv.p(x, y, col(rmp, 4 if rmp != 'cream' else 5))
    # Top finial knob
    cv.p(cx, cy - 1, col('yellow', 5))
    cv.p(cx, cy, col('wood', 2))


def draw_bicycle(cv, x, y, frame_ramp='red'):
    """Compact 13x9 pixel parked bicycle (two wheels, frame, saddle, handlebar)."""
    # Ground shadow
    cv.hline(x + 1, x + 12, y + 8, col('ink', 1))
    # Left & right wheels
    for wx in (x + 2, x + 10):
        cv.hline(wx - 1, wx + 2, y + 4, col('steel', 1))
        cv.hline(wx - 1, wx + 2, y + 7, col('steel', 0))
        cv.vline(wx - 2, y + 5, y + 7, col('steel', 1))
        cv.vline(wx + 2, y + 5, y + 7, col('steel', 1))
        cv.p(wx, y + 5, col('coolwhite', 4))
        cv.p(wx, y + 6, col('steel', 4))
    # Colored frame triangle + fork
    cv.hline(x + 3, x + 9, y + 3, col(frame_ramp, 4))
    cv.p(x + 2, y + 5, col(frame_ramp, 3))
    cv.p(x + 4, y + 4, col(frame_ramp, 4))
    cv.p(x + 6, y + 5, col(frame_ramp, 3))
    cv.p(x + 8, y + 4, col(frame_ramp, 4))
    cv.vline(x + 9, y + 2, y + 6, col(frame_ramp, 4))
    # Saddle & handlebars
    cv.hline(x + 3, x + 6, y + 2, col('wood', 1))
    cv.hline(x + 8, x + 11, y + 1, col('steel', 5))
    cv.p(x + 11, y + 2, col('steel', 2))


def draw_bulletin_board(cv, x0, y0, x1, y1, seed=0):
    """Campus wooden noticeboard with colorful pinned flyers & little roof hood."""
    # Mini top hood
    cv.hline(x0 - 1, x1 + 1, y0 - 1, col('wood', 1))
    cv.hline(x0 - 1, x1 + 1, y0, col('wood', 5))
    cv.outline_box(x0, y0 + 1, x1, y1, col('wood', 4), col('wood', 1))
    # Cork interior
    cv.rect(x0 + 1, y0 + 2, x1 - 1, y1 - 1, col('cedar', 3))
    # Pinned colorful notices
    flyer_cols = [col('white', 6), col('yellow', 5), col('pink', 5), col('blue', 5), col('cream', 6)]
    fy = y0 + 3
    idx = 0
    while fy < y1 - 3:
        fx = x0 + 2
        while fx < x1 - 3:
            r = hsh(fx, fy, seed + idx)
            if r > 0.22:
                fw = 3 if r > 0.6 else 2
                fh = 3 if (fy + 3 < y1 - 1) else 2
                fc = flyer_cols[idx % len(flyer_cols)]
                cv.rect(fx, fy, min(x1 - 1, fx + fw), min(y1 - 1, fy + fh), fc)
                cv.p(fx, fy, col('red', 4))  # Pin dot
                fx += fw + 1
            else:
                fx += 2
            idx += 1
        fy += 4
    cv.hline(x0, x1, y1, col('ink', 1))


def draw_classroom_bay(cv, x0, y0, x1, y1, scene='chalkboard', frame='steel:2', sill='concrete:5', seed=0):
    """Individually storied school/campus window bay — zero floor cloning!"""
    cv.outline_box(x0, y0, x1, y1, col('glass', 1), frame)
    ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    w = max(1, ix1 - ix0)
    h = max(1, iy1 - iy0)

    # Base interior backdrop per scene
    if scene == 'chalkboard':
        # Bright classroom with green chalkboard on back wall + ceiling tube lights
        cv.rect(ix0, iy0, ix1, iy1, col('cream', 4))
        cv.hline(ix0, ix1, iy0, col('concrete', 3))
        # Fluorescent lights
        for lx in range(ix0 + 2, ix1 - 3, 7):
            cv.hline(lx, min(ix1 - 1, lx + 4), iy0 + 1, col('white', 6))
        # Green chalkboard in middle
        if h >= 7 and w >= 10:
            cv.outline_box(ix0 + 3, iy0 + 2, ix1 - 4, iy1 - 2, col('midori', 2), col('wood', 3))
            # Chalk scribbles
            for cx in range(ix0 + 5, ix1 - 6, 3):
                cv.p(cx, iy0 + 4, col('white', 5))
                if cx + 1 < ix1 - 5 and h >= 9:
                    cv.p(cx + 1, iy0 + 5, col('cream', 5))
        # Wooden desk tops along bottom
        cv.hline(ix0, ix1, iy1 - 1, col('cedar', 4))
        # Fluttering white curtain on left pane
        for y in range(iy0, iy1):
            cw = 2 if (y % 3 != 0) else 3
            cv.rect(ix0, y, min(ix1, ix0 + cw), y + 1, col('white', 5 if y % 2 == 0 else 4))

    elif scene == 'desks_warm':
        # Golden sunset/warm lit classroom with desks & posters
        for y in range(iy0, iy1):
            ry = y - iy0
            c = col('orange', 3) if ry < 2 else (col('yellow', 4) if ry < h - 3 else col('orange', 4))
            cv.hline(ix0, ix1, y, c)
        # Yellow/red posters on back wall
        if w >= 12 and h >= 7:
            cv.rect(ix0 + 2, iy0 + 2, ix0 + 6, iy0 + 5, col('white', 5))
            cv.p(ix0 + 3, iy0 + 3, col('red', 4))
            cv.rect(ix1 - 7, iy0 + 2, ix1 - 3, iy0 + 5, col('green', 4))
        # Rows of dark oak student desk silhouettes at bottom
        for dx in range(ix0 + 1, ix1 - 2, 5):
            cv.rect(dx, iy1 - 3, min(ix1, dx + 3), iy1, col('wood', 2))
            cv.hline(dx, min(ix1, dx + 3), iy1 - 3, col('cedar', 5))

    elif scene == 'blinds_stagger':
        # Cool sky-glass classroom with staggered venetian blinds & potted sill plant
        for y in range(iy0, iy1):
            ry = y - iy0
            for x in range(ix0, ix1):
                rx = x - ix0
                # Left half blinds pulled 60% down, right half open sky glass
                if rx < w // 2 and ry < int(h * 0.65):
                    cv.p(x, y, col('cream', 5 if ry % 2 == 0 else 3))
                elif rx >= w // 2 and ry < int(h * 0.30):
                    cv.p(x, y, col('coolwhite', 4 if ry % 2 == 0 else 2))
                else:
                    d = (rx + ry) % 8
                    cv.p(x, y, col('glass', 5 if d in (1, 2) else (3 if ry >= h - 3 else 2)))
        # Potted plant on right sill
        if w >= 10:
            px = ix1 - 4
            cv.rect(px, iy1 - 2, px + 3, iy1, col('brick', 4))
            cv.p(px, iy1 - 3, col('foliage', 4))
            cv.p(px + 1, iy1 - 4, col('foliage', 5))
            cv.p(px + 2, iy1 - 3, col('foliage', 3))

    elif scene == 'blinds_corridor_alt':
        # Distinct corridor window: left side open sky-glass (short top valance), right side blinds pulled 55% down,
        # plus small trophy & textbook stack on left sill (zero duplicate potted plant!).
        for y in range(iy0, iy1):
            ry = y - iy0
            for x in range(ix0, ix1):
                rx = x - ix0
                if rx >= int(w * 0.55) and ry < int(h * 0.58):
                    cv.p(x, y, col('cream', 5 if ry % 2 == 0 else 3))
                elif rx < int(w * 0.55) and ry < 2:
                    cv.p(x, y, col('coolwhite', 5 if ry == 0 else 3))
                else:
                    d = (rx - ry) % 9
                    cv.p(x, y, col('glass', 5 if d in (1, 2) else (4 if ry >= h - 3 else 2)))
        # Small golden school trophy & textbook stack on left sill
        if w >= 14 and h >= 7:
            bx = ix0 + 2
            cv.hline(bx, bx + 5, iy1 - 1, col('red', 4))
            cv.hline(bx + 1, bx + 5, iy1 - 2, col('yellow', 5))
            tx = ix0 + 8
            cv.rect(tx, iy1 - 2, tx + 3, iy1, col('wood', 2))
            cv.p(tx + 1, iy1 - 3, col('yellow', 5))
            cv.hline(tx, tx + 3, iy1 - 4, col('yellow', 5))

    elif scene == 'art_studio':
        # Bright studio room with easel/canvas & warm upper skylight reflection
        cv.rect(ix0, iy0, ix1, iy1, col('glass', 3))
        cv.rect(ix0, iy0 + h // 2, ix1, iy1, col('cream', 5))
        # Colorful art canvases on easels
        for ex, ec in ((ix0 + 3, 'blue:4'), (ix0 + w // 2 + 1, 'red:4'), (ix1 - 6, 'yellow:4')):
            if ex + 3 < ix1:
                cv.outline_box(ex, iy0 + 2, ex + 4, iy1 - 2, C(ec), col('wood', 2))
        # Potted hanging vine at top right
        cv.p(ix1 - 2, iy0 + 1, col('foliage', 4))
        cv.p(ix1 - 3, iy0 + 2, col('foliage', 5))

    elif scene == 'teacher_office':
        # Warm teal-curtained faculty office with filing cabinets & glowing desk lamp
        cv.rect(ix0, iy0, ix1, iy1, col('orange', 3))
        cv.rect(ix0, iy0 + 2, ix1, iy1 - 2, col('yellow', 4))
        # Filing cabinets on left
        if w >= 10:
            cv.outline_box(ix0 + 2, iy0 + 2, ix0 + 6, iy1, col('steel', 4), col('steel', 1))
            cv.hline(ix0 + 3, ix0 + 5, iy0 + 4, col('steel', 2))
        # Warm desk lamp glow on right
        if w >= 12:
            cv.rect(ix1 - 5, iy1 - 4, ix1 - 2, iy1 - 2, col('yellow', 5))
            cv.p(ix1 - 4, iy1 - 1, col('wood', 2))
        # Teal curtains on both edges
        for y in range(iy0, iy1):
            cv.p(ix0, y, col('teal', 4 if y % 2 == 0 else 2))
            cv.p(ix0 + 1, y, col('teal', 2 if y % 2 == 0 else 1))
            cv.p(ix1 - 1, y, col('teal', 3 if y % 2 == 0 else 1))

    elif scene == 'club_books':
        # Warm library/club room with filled wooden bookshelves
        cv.rect(ix0, iy0, ix1, iy1, col('wood', 2))
        bcols = [col('red', 4), col('blue', 4), col('cream', 5), col('green', 4), col('yellow', 4), col('orange', 4)]
        for sy in range(iy0 + 1, iy1 - 1, 3):
            cv.hline(ix0, ix1, sy + 2, col('wood', 4))
            for bx in range(ix0 + 1, ix1 - 1, 2):
                r = int(hsh(bx, sy, seed) * 100)
                if r % 5 != 0:
                    cv.p(bx, sy, bcols[r % len(bcols)])
                    cv.p(bx, sy + 1, shade_rgba(bcols[r % len(bcols)], -1))
        # Warm lamp pool in center
        cx = (ix0 + ix1) // 2
        if h >= 6:
            cv.rect(cx - 2, iy0 + 1, cx + 2, iy0 + 3, col('yellow', 5))

    elif scene == 'lab_flasks':
        # Crisp high-contrast science lab with glowing chemical flasks & periodic chart
        cv.rect(ix0, iy0, ix1, iy1, col('glass', 2))
        cv.rect(ix0, iy0 + 2, ix1, iy1 - 3, col('glass', 3))
        cv.hline(ix0, ix1, iy0, col('glass', 1))
        # Bright ceiling fluorescent tubes
        for lx in range(ix0 + 3, ix1 - 5, 11):
            cv.hline(lx, min(ix1 - 2, lx + 6), iy0 + 1, col('white', 6))
        # Periodic table chart & fume hood cabinet on back wall
        if w >= 20 and h >= 10:
            cv.outline_box(ix0 + 3, iy0 + 3, ix0 + 13, iy0 + 9, col('cream', 5), col('steel', 1))
            cv.hline(ix0 + 4, ix0 + 12, iy0 + 5, col('blue', 4))
            cv.hline(ix0 + 4, ix0 + 11, iy0 + 7, col('orange', 4))
            # Fume hood cabinet on right
            cv.outline_box(ix1 - 13, iy0 + 2, ix1 - 3, iy1 - 3, col('coolwhite', 4), col('steel', 1))
            cv.rect(ix1 - 11, iy0 + 4, ix1 - 5, iy1 - 4, col('yellow', 4))
        # Dark laboratory workbench along bottom
        cv.rect(ix0, iy1 - 3, ix1, iy1, col('steel', 1))
        cv.hline(ix0, ix1, iy1 - 3, col('coolwhite', 5))
        # Vibrant glowing flasks/beakers lined along bench
        fcols = [col('green', 5), col('teal', 5), col('orange', 5), col('yellow', 5), col('pink', 5)]
        for i, fx in enumerate(range(ix0 + 3, ix1 - 4, 5)):
            fc = fcols[(i + seed) % len(fcols)]
            cv.rect(fx, iy1 - 5, fx + 3, iy1 - 3, fc)
            cv.p(fx + 1, iy1 - 6, col('glass', 6))
            cv.p(fx, iy1 - 5, col('white', 6))

    # Crisp glass reflection glint overlay (subtle diagonal on top-left corner)
    if scene not in ('blinds_stagger', 'blinds_corridor_alt'):
        for k in range(min(4, h - 1)):
            gx = ix0 + 2 + k
            gy = iy0 + k
            if gx < ix1 - 1 and gy < iy1 - 1 and hsh(gx, gy, seed) > 0.35:
                cv.p(gx, gy, col('glass', 6) if k < 2 else col('glass', 5))

    # Vertical mullions dividing wide ribbon windows
    if w >= 18:
        step = max(7, w // 3)
        for mx in range(ix0 + step, ix1 - 3, step):
            cv.vline(mx, iy0, iy1, frame)
    elif w >= 8:
        cv.vline((x0 + x1) // 2, iy0, iy1, frame)
    # Horizontal transom bar near top
    if h >= 9:
        cv.hline(ix0, ix1, iy0 + 3, frame)

    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, sill)
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


def draw_arched_window(cv, x0, y0, x1, y1, mode='bookshelf', frame='stone:2', surround='stone:5', seed=0):
    """Tall semicircular arched window with stone voussoir surround & rich glowing interior."""
    w = x1 - x0
    h = y1 - y0
    cx = (x0 + x1 - 1) / 2.0
    rad = w / 2.0
    arch_cy = y0 + int(rad)

    # Outer stone surround arch
    if surround:
        for y in range(y0 - 2, y1 + 1):
            for x in range(x0 - 2, x1 + 2):
                if y < arch_cy:
                    d = math.hypot(x - cx, y - arch_cy)
                    if d <= rad + 2.1 and d >= rad - 0.5:
                        cv.p(x, y, col('stone', 6 if y < arch_cy - rad * 0.4 else 5))
                else:
                    if x in (x0 - 2, x0 - 1, x1, x1 + 1):
                        cv.p(x, y, col('stone', 5 if x < x0 else 4))

    # Interior fill & arch frame
    bcols = [col('red', 4), col('blue', 4), col('cream', 5), col('green', 3), col('orange', 4), col('yellow', 4)]
    for y in range(y0, y1):
        for x in range(x0, x1):
            inside = True
            on_border = False
            if y < arch_cy:
                d = math.hypot(x - cx, y - arch_cy)
                if d > rad + 0.2:
                    inside = False
                elif d > rad - 1.1:
                    on_border = True
            else:
                if x == x0 or x == x1 - 1 or y == y1 - 1:
                    on_border = True
            if not inside:
                continue
            if on_border:
                cv.p(x, y, frame)
                continue

            rx = x - x0
            ry = y - y0
            if mode == 'bookshelf':
                # Warm glowing university library reading hall with bookshelves & green banker's lamps
                if ry < int(rad) + 1:
                    # Upper arched stained/warm ceiling glow
                    cv.p(x, y, col('orange', 4 if (rx + ry) % 3 != 0 else 5))
                elif (y - arch_cy) % 4 == 3:
                    cv.p(x, y, col('wood', 3))  # Shelf plank
                else:
                    r = int(hsh(x // 2, y // 4, seed) * 97)
                    if (y == y1 - 3 or y == y1 - 4) and abs(x - cx) <= 2:
                        cv.p(x, y, col('yellow', 5))  # Warm reading table lamp
                    elif (y == y1 - 5) and abs(x - cx) <= 1:
                        cv.p(x, y, col('green', 4))  # Green banker's lamp shade
                    elif r % 6 == 0:
                        cv.p(x, y, col('orange', 3))
                    else:
                        cv.p(x, y, bcols[r % len(bcols)])
            elif mode == 'recital':
                # Warm golden timber-and-chandelier recital hall interior
                if ry < 4:
                    cv.p(x, y, col('orange', 3))
                elif ry == 5 and abs(x - cx) <= 2:
                    cv.p(x, y, col('white', 6))  # Hanging pendant light
                elif ry >= h - 5:
                    # Stage / piano warm wood tone
                    cv.p(x, y, col('wood', 2 if (rx + seed) % 5 in (0, 1) else 4))
                else:
                    glow = 5 if abs(x - cx) < w * 0.25 else 4
                    cv.p(x, y, col('yellow', glow) if (rx + ry) % 4 != 0 else col('orange', 4))
            else:
                # Cool sky-glass arch
                d2 = (rx + ry) % 9
                cv.p(x, y, col('glass', 5 if d2 in (1, 2) else 2))

            # Subtle glass mullion cross
            if x == int(round(cx)) and y > y0 + 1:
                cv.p(x, y, frame)
            if y == arch_cy and x > x0 and x < x1 - 1:
                cv.p(x, y, frame)
            if y == arch_cy + (y1 - arch_cy) // 2 and x > x0 and x < x1 - 1:
                cv.p(x, y, frame)

    # Stone sill & cast shadow
    cv.hline(x0 - 2, x1 + 2, y1, col('stone', 6))
    cv.hline(x0 - 1, x1 + 1, y1 + 1, col('ink', 1))


def draw_pixel_glyph_bar(cv, x0, y0, x1, y1, bg_ramp='navy', fg='cream:6', seed=0):
    """Readable crisp architectural signboard / plaque with clean non-muddy glyphs."""
    cv.outline_box(x0, y0, x1, y1, col(bg_ramp, 2), col('ink', 0), top_hi=col(bg_ramp, 4), bot_sh=col(bg_ramp, 1))
    cy = (y0 + y1) // 2
    gx = x0 + 3
    idx = 0
    while gx < x1 - 4:
        k = int(hsh(idx, x0, seed) * 6) % 6
        idx += 1
        if k == 0:
            cv.hline(gx, gx + 3, y0 + 2, fg)
            cv.hline(gx, gx + 3, y1 - 3, fg)
            cv.vline(gx, y0 + 2, y1 - 2, fg)
            cv.vline(gx + 2, y0 + 2, y1 - 2, fg)
            gx += 5
        elif k == 1:
            cv.hline(gx, gx + 3, y0 + 2, fg)
            cv.vline(gx + 1, y0 + 2, y1 - 2, fg)
            gx += 4
        elif k == 2:
            cv.vline(gx, y0 + 2, y1 - 2, fg)
            cv.vline(gx + 2, y0 + 2, y1 - 2, fg)
            cv.hline(gx, gx + 3, cy, fg)
            gx += 5
        elif k == 3:
            cv.vline(gx, y0 + 2, y1 - 2, fg)
            cv.hline(gx, gx + 3, y1 - 3, fg)
            gx += 4
        elif k == 4:
            cv.hline(gx, gx + 3, y0 + 2, fg)
            cv.hline(gx, gx + 3, cy, fg)
            cv.hline(gx, gx + 3, y1 - 3, fg)
            gx += 4
        else:
            cv.p(gx, cy, fg)
            gx += 3
    cv.hline(x0 + 1, x1 + 1, y1, col('ink', 1))


FONT_5PX = {
    'A': ('.#.', '#.#', '###', '#.#', '#.#'),
    'B': ('##.', '#.#', '##.', '#.#', '##.'),
    'C': ('###', '#..', '#..', '#..', '###'),
    'D': ('##.', '#.#', '#.#', '#.#', '##.'),
    'E': ('###', '#..', '##.', '#..', '###'),
    'F': ('###', '#..', '##.', '#..', '#..'),
    'G': ('.###', '#...', '#.##', '#..#', '.###'),
    'H': ('#.#', '#.#', '###', '#.#', '#.#'),
    'I': ('###', '.#.', '.#.', '.#.', '###'),
    'L': ('#..', '#..', '#..', '#..', '###'),
    'M': ('#...#', '##.##', '#.#.#', '#...#', '#...#'),
    'N': ('#..#', '##.#', '#.##', '#..#', '#..#'),
    'O': ('###', '#.#', '#.#', '#.#', '###'),
    'R': ('##.', '#.#', '##.', '#.#', '#.#'),
    'S': ('###', '#..', '###', '..#', '###'),
    'U': ('#.#', '#.#', '#.#', '#.#', '###'),
    'Y': ('#.#', '#.#', '.#.', '.#.', '.#.'),
    ' ': ('..', '..', '..', '..', '..'),
}


def measure_pixel_text(text, spacing=1):
    """Return total pixel width of 5px uppercase text."""
    widths = [len(FONT_5PX[ch][0]) for ch in text.upper() if ch in FONT_5PX]
    if not widths:
        return 0
    return sum(widths) + spacing * (len(widths) - 1)


def draw_pixel_text(cv, x0, y0, text, fg, spacing=1):
    """Draw razor-sharp 5px pixel text with clean 1px kerning."""
    cx = x0
    for ch in text.upper():
        rows = FONT_5PX.get(ch)
        if not rows:
            continue
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit == '#':
                    cv.p(cx + rx, y0 + ry, fg)
        cx += len(rows[0]) + spacing


def draw_text_plaque(cv, x0, y0, x1, y1, text, fill, border, fg, spacing=1, shadow_below=True):
    """Crisp architectural signboard/plaque with centered 5px lettering and clean 1px padding."""
    cv.outline_box(x0, y0, x1, y1, fill, border)
    tw = measure_pixel_text(text, spacing=spacing)
    ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    tx = ix0 + max(0, (ix1 - ix0 - tw) // 2)
    ty = iy0 + max(0, (iy1 - iy0 - 5) // 2)
    draw_pixel_text(cv, tx, ty, text, fg, spacing=spacing)
    if shadow_below:
        cv.hline(x0 + 1, x1 + 1, y1, col('ink', 1))


# ---------------------------------------------------------------------------
# 1. mf-bldg-camp_school_main (160x128) — Iconic 3F High School Main Building
# ---------------------------------------------------------------------------

def build_camp_school_main():
    w, h = 160, 128
    cv = Canvas(w, h)

    # Flat green urethane rooftop (y=4..26) leaving headroom for stairwell penthouse & safety fence
    cv.flat_roof(2, 6, 158, 28, para_ramp='concrete', seed=101, urethane_green=True)

    # Rooftop stairwell penthouse (left-center) + cast shadow on urethane deck
    cv.roof_penthouse(24, 1, w=20, h=16, ramp='concrete')
    cv.window(27, 6, 33, 12, style='glass', frame='steel:1', sill=None)
    cv.hline(25, 45, 17, col('midori', 2))
    # Rooftop water tank (right) & AC units + deck shadows
    cv.roof_tank(122, 3)
    cv.hline(123, 132, 15, col('midori', 2))
    cv.roof_ac(106, 10)
    cv.roof_ac(138, 11)
    cv.roof_ac(52, 11)
    # School flagpole on rooftop right-center
    cv.vline(100, 1, 16, col('steel', 5))
    cv.vline(101, 1, 16, col('steel', 2))
    cv.rect(101, 2, 109, 6, col('blue', 4))
    cv.hline(101, 109, 3, col('white', 6))
    cv.rect(103, 3, 106, 5, col('red', 4))

    # Chainlink safety fence along the front rooftop parapet (y=19..25)
    for fx in range(6, 155, 8):
        cv.vline(fx, 18, 25, col('steel', 2))
        cv.p(fx, 18, col('coolwhite', 5))
    cv.hline(6, 155, 18, col('steel', 5))
    cv.hline(6, 155, 21, col('steel', 4))
    for x in range(7, 154):
        for y in range(19, 25):
            if (x + y) % 3 == 0 and x % 8 != 0:
                cv.p(x, y, col('coolwhite', 4) if y < 22 else col('steel', 4))

    # Main 3F cream-stucco & warm stone facade (y=28..126)
    draw_stucco_wall(cv, 2, 28, 158, 126, ramp='cream', base_i=4, seed=102, panel_w=16)
    # Warm stone ground plinth & wing pilasters
    draw_ashlar_wall(cv, 2, 104, 158, 126, ramp='stone', base_i=4, bw=10, bh=5, seed=103)

    # Vertical structural pilasters dividing wings & center block
    for px in (2, 54, 102, 154):
        pw = 4
        cv.rect(px, 28, px + pw, 126, col('concrete', 5))
        cv.vline(px, 28, 126, col('concrete', 2))
        cv.vline(px + 1, 28, 126, col('concrete', 6))
        cv.vline(px + pw - 1, 28, 126, col('concrete', 1))

    # Floor slab horizontal spandrel cornices (3F/2F/1F)
    draw_cornice(cv, 2, 28, 158, ramp='concrete', hi=6, mid=5, sh=2)
    draw_cornice(cv, 2, 58, 158, ramp='concrete', hi=6, mid=4, sh=2)
    draw_cornice(cv, 2, 86, 158, ramp='concrete', hi=6, mid=4, sh=2)

    # Decorative cream/terracotta accent band under each floor ribbon
    cv.rect(6, 54, 54, 58, col('kinari', 3))
    cv.rect(106, 54, 154, 58, col('kinari', 3))
    cv.rect(6, 82, 54, 86, col('stone', 4))
    cv.rect(106, 82, 154, 86, col('stone', 4))

    # --- 3F CLASSROOM RIBBON WINDOWS (y=34..51) — Individually varied! ---
    # Left wing 3F: Bright chalkboard classroom + open sunlit bay
    draw_classroom_bay(cv, 8, 34, 52, 50, scene='chalkboard', frame='steel:2', sill='concrete:6', seed=11)
    # Right wing 3F: Art studio + staggered blinds
    draw_classroom_bay(cv, 108, 34, 152, 50, scene='art_studio', frame='steel:2', sill='concrete:6', seed=12)

    # --- 2F CLASSROOM RIBBON WINDOWS (y=63..79) — Completely different from 3F! ---
    # Left wing 2F: Warm sunlit afternoon desks & posters
    draw_classroom_bay(cv, 8, 63, 52, 79, scene='desks_warm', frame='steel:1', sill='concrete:6', seed=21)
    # Right wing 2F: Cool sky-glass with staggered blinds & potted sill plants
    draw_classroom_bay(cv, 108, 63, 152, 79, scene='blinds_stagger', frame='steel:1', sill='concrete:6', seed=22)
    # Small flower planter on 2F left sill & banner taped to right window
    cv.planter_box(16, 76, 26, 80, flower='yellow:5', pot_ramp='brick')

    # --- 1F CLASSROOM & FACULTY WINDOWS (y=92..109) — Distinct 1F story! ---
    # Left wing 1F: Faculty / nurse's office with teal curtains
    draw_classroom_bay(cv, 8, 92, 52, 108, scene='teacher_office', frame='steel:1', sill='stone:6', seed=31)
    # Right wing 1F: Library / student club room with glowing bookshelves
    draw_classroom_bay(cv, 108, 92, 152, 108, scene='club_books', frame='steel:1', sill='stone:6', seed=32)

    # --- CENTRAL PROJECTING CLOCK TOWER BAY & ENTRANCE CANOPY (x=56..104) ---
    # Slight architectural projection with ashlar cream-stone framing
    draw_ashlar_wall(cv, 58, 22, 102, 126, ramp='cream', base_i=5, bw=11, bh=6, seed=109)
    cv.vline(58, 22, 126, col('stone', 1))
    cv.vline(101, 22, 126, col('stone', 1))
    # Pediment coping cap at top of clock bay (projects slightly above roof parapet!)
    cv.outline_box(56, 19, 104, 24, col('concrete', 5), col('ink', 0), top_hi=col('concrete', 6), bot_sh=col('concrete', 2))
    cv.rect(68, 16, 92, 20, col('concrete', 5))
    cv.hline(68, 92, 16, col('ink', 0))
    cv.hline(69, 91, 17, col('concrete', 6))

    # Tall center stair/corridor windows on 3F & 2F flanking the clock with crisp 2px stone margin
    cv.window(60, 34, 69, 50, style='glass', frame='steel:1', sill='concrete:6')
    cv.window(91, 34, 100, 50, style='warm', frame='steel:1', sill='concrete:6')
    # 2F center corridor bay below clock (distinct blind layout & trophy/book sill — zero duplicate plant!)
    draw_classroom_bay(cv, 62, 64, 98, 78, scene='blinds_corridor_alt', frame='steel:2', sill='stone:6', seed=44)

    # Iconic glowing round school clock centered proudly above the entrance canopy!
    # Stone medallion surround (cleanly separated from flanking windows)
    cv.outline_box(71, 30, 89, 48, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
    draw_clock_face(cv, 80, 39, r=7, bezel_ramp='wood', face_ramp='cream', hour_ang=-2.2, min_ang=-0.55)

    # School name plaque above entrance canopy (crisp 5px 'SCHOOL' with clean 1px margins)
    draw_text_plaque(cv, 63, 80, 97, 89, 'SCHOOL', fill=col('navy', 2), border=col('ink', 0), fg=col('yellow', 5), spacing=1, shadow_below=True)

    # Central projecting entrance canopy (y=90..98)
    cv.outline_box(55, 90, 105, 96, col('concrete', 5), col('ink', 0), top_hi=col('concrete', 6), bot_sh=col('concrete', 3))
    cv.rect(56, 96, 104, 99, col('concrete', 2))
    cv.hline(56, 104, 99, col('ink', 0))  # Deep overhang shadow
    # Support pillars under canopy
    for cx in (58, 100):
        cv.rect(cx, 99, cx + 3, 124, col('stone', 5))
        cv.vline(cx, 99, 124, col('stone', 2))
        cv.vline(cx + 2, 99, 124, col('stone', 1))

    # Wide glazed school lobby entrance doors (x=63..97, y=99..121)
    cv.rect(62, 99, 98, 121, col('glass', 1))
    # Left & right sidelights showing warm shoe-locker lobby
    cv.window(63, 100, 72, 119, style='warm', frame='steel:2', sill=None)
    cv.window(88, 100, 97, 119, style='warm', frame='steel:2', sill=None)
    # Center wide double glass doors
    cv.door_glass(72, 100, 88, 121, frame='steel:2', warm=True)
    # Wide stone entrance steps grounding center
    draw_stone_steps(cv, 57, 119, 103, 127, ramp='stone')

    # --- 1F GROUND-LEVEL LIVED-IN CAMPUS DETAILS ---
    # Left wing: neat flowering shrub beds + school bulletin board
    draw_bulletin_board(cv, 10, 110, 26, 121, seed=106)
    cv.planter_box(30, 113, 51, 124, flower='pink:4', pot_ramp='brick')
    # Right wing: flowering planters + parked bicycle + green shrub
    cv.planter_box(109, 113, 127, 124, flower='yellow:5', pot_ramp='brick')
    draw_bicycle(cv, 130, 115, frame_ramp='blue')
    cv.foliage_cluster(149, 118, 5, 5, ramp='foliage', seed=108, blossom=col('pink', 5))

    # Grounding curb shadow across full width
    cv.hline(2, 158, 125, col('pavement', 3))
    cv.hline(2, 158, 126, col('ink', 1))
    cv.hline(2, 158, 127, col('ink', 0))
    cv.edge_finish(top_y=6)
    return cv


# ---------------------------------------------------------------------------
# 2. mf-bldg-camp_brick_library (128x112) — Ivy-Draped 2.5F Red-Brick Library
# ---------------------------------------------------------------------------

def build_camp_brick_library():
    w, h = 128, 112
    cv = Canvas(w, h)

    # Pitched dark-slate top-3/4 roof (y=12..38)
    cv.pitched_roof(2, 12, 126, 38, ramp='kawara', ridge_hi=True, moss_rate=0.04, seed=201)
    # Decorative slate ridge cresting
    for rx in range(8, 120, 8):
        cv.p(rx, 11, col('kawara', 6))
        cv.p(rx + 1, 11, col('kawara', 2))

    # Central glass lantern skylight cupola rising from the roof ridge (x=46..82, y=1..24)
    # Mini pitched slate cap on lantern
    for y in range(2, 10):
        inset = max(0, (9 - y))
        lx0, lx1 = 46 + inset, 82 - inset
        cv.hline(lx0, lx1, y, col('kawara', 5 if y % 2 == 0 else 3))
        cv.p(lx0, y, col('kawara', 1))
        cv.p(lx1 - 1, y, col('kawara', 0))
    cv.hline(54, 74, 2, col('kawara', 6))
    cv.p(64, 1, col('yellow', 5))  # Golden roof finial
    # Lantern glowing glass bays (warm library reading atrium below + sky sheen)
    cv.outline_box(47, 10, 81, 23, col('glass', 2), col('stone', 1))
    for bx in (49, 57, 65, 73):
        cv.rect(bx, 11, bx + 6, 22, col('orange', 4))
        cv.rect(bx + 1, 12, bx + 5, 20, col('yellow', 5))
        cv.p(bx + 1, 12, col('glass', 6))
        cv.p(bx + 2, 13, col('glass', 5))
        cv.vline(bx + 6, 11, 22, col('stone', 2))
    cv.hline(46, 82, 22, col('stone', 5))
    cv.hline(46, 82, 23, col('ink', 0))

    # Subtle side dormer eaves on roof left & right
    for dx in (16, 100):
        cv.outline_box(dx, 20, dx + 12, 31, col('stone', 4), col('ink', 0), top_hi=col('kawara', 6))
        cv.window(dx + 2, 23, dx + 10, 30, style='warm', frame='wood:1', sill='stone:6')

    # Main 2.5F red-brick facade (y=38..110)
    cv.brick_wall(4, 38, 124, 108, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=202)
    # Rusticated limestone basement plinth (y=95..110)
    draw_ashlar_wall(cv, 4, 95, 124, 110, ramp='stone', base_i=4, bw=10, bh=5, seed=203)

    # Corner stone quoins
    draw_quoins(cv, 4, 39, 95, w=5, ramp='stone', base_i=5, side='left')
    draw_quoins(cv, 124, 39, 95, w=5, ramp='stone', base_i=4, side='right')

    # Classic limestone cornice under eaves & stringcourse between 2F and 1F
    draw_cornice(cv, 2, 38, 126, ramp='stone', hi=6, mid=5, sh=2)
    draw_cornice(cv, 4, 68, 124, ramp='stone', hi=6, mid=4, sh=2)

    # --- 2F TALL MULLIONED ARCHED READING-HALL WINDOWS (varied warm bookshelves & sky reflections!) ---
    draw_arched_window(cv, 14, 44, 30, 65, mode='bookshelf', frame='wood:1', surround='stone:5', seed=211)
    draw_arched_window(cv, 36, 44, 50, 65, mode='glass', frame='wood:1', surround='stone:5', seed=212)
    # Warm bookshelf peek at bottom of 2nd arch
    cv.rect(38, 57, 48, 63, col('wood', 2))
    cv.hline(39, 47, 59, col('orange', 4))
    cv.hline(39, 47, 61, col('red', 4))
    # Central stone pedimented reading-hall arch above entrance with keystone
    draw_arched_window(cv, 56, 43, 72, 65, mode='bookshelf', frame='wood:1', surround='stone:6', seed=213)
    cv.rect(63, 40, 66, 43, col('stone', 6))
    draw_arched_window(cv, 78, 44, 92, 65, mode='bookshelf', frame='wood:1', surround='stone:5', seed=214)
    draw_arched_window(cv, 98, 44, 114, 65, mode='glass', frame='wood:1', surround='stone:5', seed=215)
    cv.rect(100, 56, 112, 63, col('orange', 3))
    cv.hline(101, 111, 58, col('yellow', 5))
    cv.hline(101, 111, 61, col('wood', 3))

    # --- 1F WARM READING ROOM WINDOWS FLANKING STONE ARCH ENTRANCE ---
    draw_classroom_bay(cv, 13, 74, 42, 92, scene='club_books', frame='wood:1', sill='stone:6', seed=221)
    draw_classroom_bay(cv, 86, 74, 115, 92, scene='teacher_office', frame='wood:1', sill='stone:6', seed=222)
    # Subtle exterior stone book-return box on left & bench on right
    cv.outline_box(22, 97, 34, 108, col('teal', 3), col('ink', 0), top_hi=col('teal', 5))
    cv.hline(24, 32, 100, col('ink', 0))  # Book drop slot

    # --- GRAND WARM STONE ARCH ENTRANCE & STEPS (center x=46..82, y=69..111) ---
    draw_ashlar_wall(cv, 47, 69, 81, 106, ramp='stone', base_i=5, bw=8, bh=4, seed=225)
    cv.vline(47, 69, 106, col('stone', 1))
    cv.vline(80, 69, 106, col('stone', 1))
    # Carved stone lintel plaque above arch (crisp 5px carved 'LIBRARY' on light limestone tablet)
    draw_text_plaque(cv, 47, 69, 81, 78, 'LIBRARY', fill=col('stone', 6), border=col('stone', 1), fg=col('ink', 0), spacing=1, shadow_below=False)
    # Semicircular limestone archway with deep recessed oak-and-glass double doors
    acx, acy, ar = 64, 88, 9.5
    for y in range(78, 104):
        for x in range(52, 76):
            if y < acy:
                d = math.hypot(x - acx, y - acy)
                if d <= ar + 2.0 and d > ar:
                    cv.p(x, y, col('stone', 6 if (x + y) % 3 != 0 else 4))
                elif d <= ar and d > ar - 1.2:
                    cv.p(x, y, col('stone', 1))
                elif d <= ar - 1.2:
                    # Warm glowing fanlight transom glass
                    cv.p(x, y, col('yellow', 5 if abs(x - acx) < 4 else 4))
                    if abs(x - acx) == 0 or abs(y - acy) == 0:
                        cv.p(x, y, col('wood', 1))
            else:
                if x in (52, 53, 74, 75):
                    cv.p(x, y, col('stone', 6 if x < 64 else 3))
    # Double oak library doors inside arch
    cv.door_wood(55, 88, 64, 104, ramp='wood', glass_top=True)
    cv.door_wood(64, 88, 73, 104, ramp='wood', glass_top=True)
    # Flanking warm bronze lantern sconces
    for lx in (49, 78):
        cv.rect(lx, 84, lx + 2, 87, col('yellow', 5))
        cv.p(lx, 83, col('wood', 1))
        cv.p(lx, 87, col('wood', 1))
    # Wide stone entrance steps with side cheek blocks
    draw_stone_steps(cv, 45, 103, 83, 111, ramp='stone')
    cv.outline_box(43, 100, 47, 110, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
    cv.outline_box(81, 100, 85, 110, col('stone', 4), col('stone', 1), top_hi=col('stone', 5))

    # --- CLIMBING GREEN IVY VINES ON CORNERS & EAVES (asymmetric, organic!) ---
    draw_ivy_vine(cv, [(5, 105), (6, 86), (11, 70), (7, 52), (12, 39), (24, 38)], width=2, seed=231, blossom=col('cream', 6))
    draw_ivy_vine(cv, [(12, 70), (22, 68), (33, 69)], width=1, seed=232)
    draw_ivy_vine(cv, [(122, 104), (121, 88), (117, 74), (122, 58), (116, 42), (105, 38)], width=2, seed=233)
    draw_ivy_vine(cv, [(117, 74), (108, 69)], width=1, seed=234)
    # Ground shrubs at corners
    cv.foliage_cluster(10, 105, 6, 4, ramp='foliage', seed=235)
    cv.foliage_cluster(117, 105, 6, 4, ramp='foliage', seed=236, blossom=col('pink', 5))

    cv.hline(4, 124, 110, col('ink', 1))
    cv.hline(4, 124, 111, col('ink', 0))
    cv.edge_finish(top_y=12)
    return cv


# ---------------------------------------------------------------------------
# 3. mf-bldg-camp_gymnasium (144x96) — Classic School Indoor Gymnasium
# ---------------------------------------------------------------------------

def build_camp_gymnasium():
    w, h = 144, 96
    cv = Canvas(w, h)

    # Wide arched / barrel-vaulted steel-grey pitched top-3/4 roof (y=4..42)
    # Curved barrel profile along left/right gables + sunlit standing-seam steel ribs
    roof_top = 4
    roof_bot = 40
    for y in range(roof_top, roof_bot):
        t = (y - roof_top) / max(1, (roof_bot - roof_top - 1))
        # Subtle curved barrel-vault shoulders at top rows
        inset = int(round((1.0 - math.sin(min(1.0, t * 2.2) * math.pi * 0.5)) * 8)) if t < 0.35 else 0
        rx0 = 2 + inset
        rx1 = w - 2 - inset
        for x in range(rx0, rx1):
            # Vertical standing-seam steel ribs every 8px
            seam = ((x - 2) % 8 == 0)
            # Barrel-vault specular highlight band near upper-third (sun from top-left!)
            if y == roof_top:
                c = col('steel', 1)
            elif y == roof_bot - 1:
                c = col('steel', 0)
            elif y == roof_bot - 2:
                c = col('steel', 1 if x % 4 != 0 else 2)
            elif x in (rx0, rx1 - 1):
                c = col('steel', 1)
            else:
                if t < 0.22:
                    base_t = 5 if x < w * 0.75 else 4
                elif t < 0.48:
                    base_t = 6 if (x < w * 0.65 and not seam) else 5
                elif t < 0.78:
                    base_t = 4 if x < w * 0.80 else 3
                else:
                    base_t = 3 if x < w * 0.85 else 2
                if seam:
                    c = col('steel', max(1, base_t - 2))
                elif (x - 2) % 8 == 1:
                    c = col('steel', min(6, base_t + 1))
                else:
                    r = hsh(x // 2, y // 3, 301)
                    if r < 0.14:
                        base_t = max(1, base_t - 1)
                    c = col('steel', base_t)
            cv.p(x, y, c)

    # Raised clerestory skylight window monitor along upper barrel vault (x=21..123, y=10..20)
    # 9 symmetric 10px panes inside x=23..121 (zero stray mullion outside right frame!)
    cv.outline_box(21, 10, 123, 14, col('steel', 5), col('steel', 1), top_hi=col('steel', 6))
    cv.outline_box(22, 13, 122, 20, col('glass', 2), col('steel', 1))
    for p_idx, sx in enumerate(range(23, 121, 11)):
        warm = (p_idx % 3 == 2)
        for y in range(14, 19):
            for x in range(sx, min(121, sx + 10)):
                if warm:
                    cv.p(x, y, col('cream', 5 if y < 17 else 4))
                else:
                    cv.p(x, y, col('glass', 6 if (x - sx + y) % 5 == 0 else 4))
        if sx + 10 < 121:
            cv.vline(sx + 10, 14, 19, col('steel', 1))
    cv.hline(22, 122, 20, col('ink', 1))  # Cast shadow onto lower vault

    # Deep roof eave overhang fascia & underside shadow (y=40..44)
    cv.rect(2, 40, 142, 43, col('concrete', 4))
    cv.hline(2, 142, 40, col('concrete', 6))
    cv.hline(2, 142, 42, col('ink', 0))
    cv.hline(4, 140, 43, col('ink', 1))

    # Main gymnasium wall: concrete structural frame + recessed red-brick lower wall (y=44..94)
    draw_stucco_wall(cv, 4, 44, 140, 68, ramp='concrete', base_i=5, seed=302, panel_w=20)
    cv.brick_wall(4, 68, 140, 94, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=303)
    # Stone water-table sill dividing upper concrete & lower brick
    draw_cornice(cv, 4, 66, 140, ramp='stone', hi=6, mid=5, sh=2, shadow_below=True)

    # Rhythm of concrete pilasters/buttresses dividing the facade into 6 architectural bays
    pilasters = [4, 26, 48, 92, 114, 136]
    for px in pilasters:
        cv.rect(px, 43, px + 4, 94, col('concrete', 5))
        cv.vline(px, 43, 94, col('concrete', 2))
        cv.vline(px + 1, 43, 94, col('concrete', 6))
        cv.vline(px + 3, 43, 94, col('concrete', 1))

    # --- TALL NARROW BASKETBALL-COURT HIGH WINDOWS (upper bays y=46..64) ---
    # Center two windows sit cleanly above the gymnasium plaque (zero overlap!)
    court_bays = [
        (10, 46, 24, 64, 'warm'),
        (32, 46, 46, 64, 'glass'),
        (54, 46, 68, 54, 'warm'),
        (76, 46, 90, 54, 'glass'),
        (98, 46, 112, 64, 'warm'),
        (120, 46, 134, 64, 'glass'),
    ]
    for idx, (wx0, wy0, wx1, wy1, st) in enumerate(court_bays):
        # Twin tall narrow windows inside each bay
        mid = (wx0 + wx1) // 2
        for sub_i, (ax0, ax1) in enumerate(((wx0, mid - 1), (mid + 1, wx1))):
            warm_flag = (st == 'warm') or ((idx + sub_i) % 3 == 0)
            cv.outline_box(ax0, wy0, ax1, wy1, col('glass', 1), col('steel', 1))
            for y in range(wy0 + 1, wy1 - 1):
                for x in range(ax0 + 1, ax1 - 1):
                    if warm_flag:
                        cv.p(x, y, col('orange', 4 if y < wy0 + 6 else 3) if (x + y) % 3 == 0 else col('yellow', 4))
                    else:
                        cv.p(x, y, col('glass', 5 if (x - ax0 + y - wy0) in (1, 2, 5) else 3))
            # Open tilted vent transom on alternate windows
            if wy1 - wy0 >= 14:
                if (idx + sub_i) % 2 == 0:
                    cv.hline(ax0 + 1, ax1 - 1, wy0 + 5, col('steel', 2))
                    cv.hline(ax0 + 1, ax1 - 1, wy0 + 4, col('coolwhite', 5))
                else:
                    cv.hline(ax0 + 1, ax1 - 1, wy0 + 9, col('steel', 2))
            # Basketball backboard Easter egg visible inside warm outer windows
            if idx in (0, 4) and sub_i == 1:
                cv.rect(ax0 + 2, wy0 + 8, ax1 - 1, wy0 + 12, col('white', 5))
                cv.hline(ax0 + 3, ax1 - 2, wy0 + 12, col('red', 4))
        cv.hline(wx0 - 1, wx1 + 1, wy1, col('concrete', 6))

    # --- BROAD DOUBLE STEEL DOORS & CANTILEVERED ENTRANCE CANOPY (center x=50..94, y=64..95) ---
    # Gymnasium plaque cleanly placed in spandrel above canopy (crisp 5px 'GYM' on navy plaque)
    draw_text_plaque(cv, 57, 56, 87, 65, 'GYM', fill=col('navy', 2), border=col('ink', 0), fg=col('white', 6), spacing=2, shadow_below=False)
    # Cantilevered steel-and-concrete entrance canopy
    cv.outline_box(50, 65, 94, 71, col('steel', 4), col('ink', 0), top_hi=col('steel', 6), bot_sh=col('steel', 2))
    cv.hline(51, 93, 71, col('ink', 0))
    cv.hline(52, 92, 72, col('ink', 1))
    # Canopy side steel stanchions
    for sx in (52, 90):
        cv.vline(sx, 71, 92, col('steel', 2))
        cv.vline(sx + 1, 71, 92, col('steel', 5))

    # Recessed entrance vestibule
    cv.rect(55, 72, 89, 92, col('concrete', 3))
    # Broad double steel gym doors (left & right pair)
    for dx0, dx1 in ((58, 71), (73, 86)):
        cv.outline_box(dx0, 73, dx1, 91, col('tile', 3), col('steel', 0), top_hi=col('tile', 5), bot_sh=col('tile', 1))
        # Upper narrow reinforced glass vision pane showing warm gym wood floor
        cv.window(dx0 + 3, 75, dx1 - 3, 82, style='warm', frame='steel:1', sill=None)
        # Stainless horizontal panic push-bar
        cv.hline(dx0 + 2, dx1 - 2, 85, col('coolwhite', 5))
        cv.hline(dx0 + 2, dx1 - 2, 86, col('steel', 2))
    cv.vline(72, 72, 92, col('steel', 1))
    # Wide stone apron steps
    draw_stone_steps(cv, 51, 90, 93, 95, ramp='stone')

    # --- 1F LOWER BRICK BAY DETAILS (left & right of entrance) ---
    # Left bay: outdoor sports bulletin board & metal ball-storage cage with orange basketballs!
    draw_bulletin_board(cv, 10, 73, 24, 84, seed=311)
    # Ball cage (x=31..45, y=80..92)
    cv.outline_box(31, 80, 45, 92, col('steel', 2), col('steel', 0), top_hi=col('steel', 5))
    for bx, by in ((33, 85), (37, 86), (41, 85), (35, 89), (39, 89)):
        cv.rect(bx, by, bx + 3, by + 3, col('orange', 4))
        cv.p(bx, by, col('orange', 5))
        cv.p(bx + 2, by + 2, col('orange', 2))
    # Wire cage front bars
    for vx in range(33, 45, 3):
        cv.vline(vx, 81, 91, col('coolwhite', 4))
    cv.hline(32, 44, 84, col('steel', 4))

    # Right bays: outdoor drinking fountain (steel basin) + emergency side door + shrubs
    cv.outline_box(99, 81, 111, 92, col('concrete', 4), col('concrete', 1), top_hi=col('concrete', 6))
    cv.rect(101, 81, 109, 84, col('coolwhite', 5))
    cv.p(103, 82, col('glass', 5))
    cv.p(107, 82, col('glass', 5))
    # Utility louver & shrub on far right
    cv.outline_box(120, 74, 132, 82, col('steel', 3), col('steel', 1))
    for ly in range(76, 81, 2):
        cv.hline(121, 131, ly, col('steel', 1))
    cv.planter_box(118, 86, 134, 94, flower='red:4', pot_ramp='stone')

    # Grounding pavement shadow
    cv.hline(4, 140, 94, col('ink', 1))
    cv.hline(4, 140, 95, col('ink', 0))
    cv.edge_finish(top_y=4)
    return cv


# ---------------------------------------------------------------------------
# 4. mf-bldg-camp_science_greenhouse (112x96) — Lab Annex + Glass Conservatory
# ---------------------------------------------------------------------------

def build_camp_science_greenhouse():
    w, h = 112, 96
    cv = Canvas(w, h)

    # === LEFT HALF (x=2..56): Clean Cream-Tile Science Lab ===
    # Flat concrete parapet roof (y=12..30)
    cv.flat_roof(2, 12, 56, 30, deck_ramp='concrete', deck_i=3, para_ramp='concrete', seed=401)

    # Fume-hood exhaust vent stack & stainless blower box on lab roof (x=8..32, y=1..24)
    # Blower housing
    cv.outline_box(10, 14, 24, 24, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.rect(12, 17, 22, 22, col('steel', 2))
    for ly in (18, 20):
        cv.hline(13, 21, ly, col('steel', 4))
    # Tall vertical fume-hood exhaust chimney stack with rain cap!
    cv.rect(15, 3, 21, 15, col('coolwhite', 4))
    cv.vline(15, 3, 15, col('steel', 1))
    cv.vline(16, 3, 15, col('white', 6))
    cv.vline(19, 3, 15, col('steel', 3))
    cv.vline(20, 3, 15, col('steel', 1))
    # Conical rain hood cap
    cv.hline(13, 23, 3, col('steel', 1))
    cv.hline(14, 22, 2, col('coolwhite', 5))
    cv.hline(16, 20, 1, col('white', 6))
    # Duct elbow + rooftop AC unit
    cv.hline(24, 31, 18, col('steel', 5))
    cv.hline(24, 31, 19, col('steel', 2))
    cv.roof_ac(35, 16)

    # Clean cream-tile lab facade (x=2..56, y=30..94)
    cv.tile_cladding(2, 30, 56, 94, ramp='cream', base_i=5, cw=5, ch=4, seed=402)
    draw_cornice(cv, 2, 30, 56, ramp='concrete', hi=6, mid=5, sh=2)
    draw_cornice(cv, 2, 60, 56, ramp='concrete', hi=6, mid=4, sh=2)
    # Concrete base plinth
    cv.rect(2, 86, 56, 94, col('concrete', 3))
    cv.hline(2, 56, 86, col('concrete', 5))

    # 2F Science Lab windows: bright lab benches & glowing flasks/beakers
    draw_classroom_bay(cv, 7, 36, 51, 55, scene='lab_flasks', frame='steel:2', sill='concrete:6', seed=405)

    # 1F Science Lab: specimen display window on left + steel lab door on right
    draw_classroom_bay(cv, 7, 66, 33, 83, scene='desks_warm', frame='steel:1', sill='concrete:6', seed=406)
    # Lab steel entry door with caution/bio plaque & canopy hood
    cv.outline_box(36, 65, 52, 68, col('teal', 4), col('ink', 0), top_hi=col('teal', 5))
    cv.outline_box(38, 68, 50, 92, col('coolwhite', 4), col('steel', 1), top_hi=col('white', 6))
    cv.window(40, 71, 48, 79, style='glass', frame='steel:2', sill=None)
    cv.p(41, 82, col('yellow', 5))  # Lab hazard/dept mini badge
    cv.p(48, 82, col('steel', 1))   # Handle
    cv.hline(37, 51, 92, col('stone', 5))
    # Potted botanical specimen boxes outside lab
    cv.planter_box(7, 85, 21, 93, flower='yellow:5', pot_ramp='brick')
    cv.planter_box(23, 86, 34, 93, flower='pink:4', pot_ramp='brick')

    # === RIGHT HALF (x=56..110): Bright Aluminum-Framed Glass Conservatory ===
    # Draw conservatory structural silhouette: arched/gabled glass dome (y=18..48) + tall glass wall (y=48..94)
    gx0, gx1 = 56, 110
    gcx = (gx0 + gx1) // 2  # 83
    dome_top = 18
    eave_y = 46

    # First paint crisp interior backdrop inside the arched glass conservatory
    for y in range(dome_top, 94):
        for x in range(gx0, gx1):
            in_dome = True
            if y < eave_y:
                # Pointed/barrel conservatory glass roof profile
                dy = (eave_y - y) / max(1, (eave_y - dome_top))
                half_w = int(round((gx1 - gx0) * 0.5 * math.sqrt(max(0.0, 1.0 - dy * dy * 0.88))))
                if abs(x - gcx) > half_w:
                    in_dome = False
            if not in_dome:
                continue
            # Bright luminous interior sky/greenhouse mist
            if y < 34:
                cv.p(x, y, col('glass', 5 if (x + y) % 4 != 0 else 6))
            elif y < 56:
                cv.p(x, y, col('glass', 4 if (x + y) % 5 != 0 else 5))
            else:
                cv.p(x, y, col('midori', 2 if y < 78 else 1))

    # --- PACKED LUSH TROPICAL FOLIAGE & FLOWER BENCHES INSIDE CONSERVATORY! ---
    # Tall tropical palm / banana tree fronds reaching into the dome
    cv.foliage_cluster(74, 42, 11, 10, ramp='foliage', seed=411)
    cv.foliage_cluster(92, 44, 10, 9, ramp='foliage', seed=412, blossom=col('yellow', 5))
    cv.foliage_cluster(83, 35, 9, 8, ramp='green', seed=413)
    # Mid-level lush monstera / ferns / tropical orchids
    cv.foliage_cluster(66, 58, 8, 7, ramp='foliage', seed=414, blossom=col('pink', 5))
    cv.foliage_cluster(84, 56, 10, 7, ramp='foliage', seed=415, blossom=col('red', 5))
    cv.foliage_cluster(99, 60, 8, 7, ramp='green', seed=416, blossom=col('orange', 5))

    # Wooden tiered flower benches visible behind lower glass (y=68..84)
    cv.rect(60, 70, 78, 73, col('cedar', 4))
    cv.hline(60, 78, 70, col('cedar', 5))
    cv.rect(88, 70, 106, 73, col('cedar', 4))
    cv.hline(88, 106, 70, col('cedar', 5))
    # Colorful potted blossoms lined up on benches
    bench_flowers = [col('red', 5), col('yellow', 5), col('pink', 5), col('orange', 5), col('red', 4)]
    for i, bx in enumerate((62, 67, 72, 91, 96, 101)):
        cv.rect(bx, 68, bx + 3, 70, col('brick', 4))
        cv.p(bx + 1, 66, bench_flowers[i % len(bench_flowers)])
        cv.p(bx, 67, col('foliage', 5))
        cv.p(bx + 2, 67, col('foliage', 4))
    # Lower brick knee-wall of greenhouse (y=80..94)
    cv.brick_wall(56, 80, 110, 94, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=418)
    cv.hline(56, 110, 80, col('stone', 6))

    # --- CRISP GLASS REFLECTIONS OVER THE FOLIAGE ---
    for y in range(dome_top + 2, 79):
        for x in range(gx0 + 1, gx1 - 1):
            if cv.get(x, y)[3] == 0:
                continue
            d = (x + y) % 19
            if d in (2, 3) and (x < 98):
                # Translucent-feel crisp specular highlight pixels
                if (x + y) % 2 == 0 or y < 44:
                    cv.p(x, y, col('glass', 6) if d == 2 else col('glass', 5))

    # --- BRIGHT ALUMINUM STRUCTURAL RIBS, MULLIONS & CONSERVATORY DOOR ---
    # Curved aluminum arch outer rim & inner ribs
    for y in range(dome_top, eave_y):
        dy = (eave_y - y) / max(1, (eave_y - dome_top))
        half_w = int(round((gx1 - gx0) * 0.5 * math.sqrt(max(0.0, 1.0 - dy * dy * 0.88))))
        lx, rx = gcx - half_w, gcx + half_w
        cv.p(lx, y, col('steel', 1))
        cv.p(lx + 1, y, col('coolwhite', 5))
        cv.p(rx, y, col('steel', 1))
        cv.p(rx - 1, y, col('coolwhite', 4))
        # Curved inner ribs
        for frac in (-0.52, 0.0, 0.52):
            rib_x = int(round(gcx + half_w * frac))
            cv.p(rib_x, y, col('coolwhite', 5))
            cv.p(rib_x + 1, y, col('steel', 2))
    # Horizontal roof purlins
    for py in (26, 35, 45):
        dy = (eave_y - py) / max(1, (eave_y - dome_top))
        half_w = int(round((gx1 - gx0) * 0.5 * math.sqrt(max(0.0, 1.0 - dy * dy * 0.88))))
        cv.hline(gcx - half_w, gcx + half_w + 1, py, col('coolwhite', 5))
        cv.hline(gcx - half_w, gcx + half_w + 1, py + 1, col('steel', 2))
    # Ridge crest ornament at top of dome
    cv.hline(gcx - 10, gcx + 11, dome_top, col('coolwhite', 5))
    cv.hline(gcx - 10, gcx + 11, dome_top - 1, col('steel', 1))
    for fx in range(gcx - 8, gcx + 9, 4):
        cv.p(fx, dome_top - 2, col('coolwhite', 5))

    # Vertical aluminum mullions on glass walls (y=46..80)
    for mx in (56, 65, 74, 83, 92, 101, 109):
        cv.vline(mx, 46, 80, col('coolwhite', 5))
        if mx + 1 < gx1:
            cv.vline(mx + 1, 46, 80, col('steel', 2))
    cv.hline(56, 110, 62, col('coolwhite', 5))
    cv.hline(56, 110, 63, col('steel', 2))

    # Conservatory glass entry door centered at bottom (x=76..90, y=68..93)
    cv.outline_box(76, 68, 90, 93, col('coolwhite', 5), col('steel', 1))
    cv.window(78, 70, 88, 86, style='glass', frame='steel:2', sill=None)
    # Lush ferns peeking behind glass door
    cv.p(80, 82, col('foliage', 4))
    cv.p(81, 81, col('foliage', 5))
    cv.p(85, 83, col('foliage', 4))
    cv.rect(78, 86, 88, 92, col('coolwhite', 4))
    cv.hline(75, 91, 93, col('stone', 5))
    # Outdoor terracotta flower pots flanking conservatory door
    cv.planter_box(60, 86, 73, 93, flower='orange:5', pot_ramp='brick')
    cv.planter_box(93, 86, 107, 93, flower='pink:5', pot_ramp='brick')

    # Clean structural divider between Lab & Conservatory
    cv.vline(55, 30, 94, col('concrete', 1))
    cv.hline(2, 110, 94, col('ink', 1))
    cv.hline(2, 110, 95, col('ink', 0))
    cv.edge_finish(top_y=12)
    return cv


# ---------------------------------------------------------------------------
# 5. mf-bldg-camp_student_union_terrace (128x112) — 2.5F Union + 2F Sun Terrace
# ---------------------------------------------------------------------------

def build_camp_student_union_terrace():
    w, h = 128, 112
    cv = Canvas(w, h)

    # === 3F / 2.5F CONTEMPORARY TIMBER-AND-CONCRETE SETBACK TOP FLOOR (x=14..114, y=4..42) ===
    cv.flat_roof(14, 4, 114, 18, deck_ramp='concrete', deck_i=3, para_ramp='concrete', seed=501)
    # Solar panels & roof vent on top setback roof
    for sx in (22, 40):
        cv.outline_box(sx, 7, sx + 14, 14, col('navy', 3), col('steel', 1), top_hi=col('blue', 5))
        cv.vline(sx + 7, 8, 13, col('steel', 2))
        cv.hline(sx + 1, sx + 13, 10, col('blue', 4))
    cv.roof_ac(92, 8)
    cv.roof_penthouse(68, 2, w=16, h=12, ramp='concrete')

    # Setback timber-and-concrete wall (y=18..42)
    draw_stucco_wall(cv, 14, 18, 114, 42, ramp='concrete', base_i=5, seed=502, panel_w=20)
    # Warm vertical cedar slat accent zones on left & right wings
    cv.siding_wall(16, 20, 44, 41, ramp='cedar', base_i=4, horizontal=False, step=3, seed=503)
    cv.siding_wall(84, 20, 112, 41, ramp='cedar', base_i=4, horizontal=False, step=3, seed=504)
    draw_cornice(cv, 14, 18, 114, ramp='concrete', hi=6, mid=5, sh=2)

    # Upper lounge windows & sliding terrace access glass doors
    draw_classroom_bay(cv, 20, 23, 40, 38, scene='art_studio', frame='darkwood:2', sill='wood:4', seed=505)
    # Center wide sliding terrace glass doors (warm backlit student lounge)
    cv.door_glass(48, 22, 80, 42, frame='darkwood:1', warm=True)
    draw_classroom_bay(cv, 88, 23, 108, 38, scene='club_books', frame='darkwood:2', sill='wood:4', seed=506)

    # === SPACIOUS 2F WOODEN SUN TERRACE (x=2..126, y=42..72) ===
    # Concrete structural fascia slab supporting the terrace
    cv.terrace_deck(2, 42, 126, 70, floor_ramp='floorwood', rail_ramp='wood', seed=507)

    # Upgrade front balustrade to contemporary open glass-and-wood railing (y=61..70)
    fy1 = 61
    cv.hline(2, 126, fy1, col('cedar', 5))      # Warm timber top handrail
    cv.hline(2, 126, fy1 + 1, col('wood', 2))
    for y in range(fy1 + 2, 69):
        for x in range(3, 125):
            rx = x - 2
            if rx % 12 == 0 or rx in (0, 123):
                cv.p(x, y, col('wood', 3))      # Timber posts
            elif rx % 12 == 1:
                cv.p(x, y, col('wood', 1))
            else:
                # Crisp transparent-feel tinted glass balustrade panels
                d = (x + y) % 9
                if d == 2:
                    cv.p(x, y, col('glass', 6))
                elif y == fy1 + 2:
                    cv.p(x, y, col('glass', 4))
                else:
                    cv.p(x, y, col('glass', 3) if (x + y) % 3 == 0 else col('floorwood', 3))
    cv.hline(2, 126, 69, col('concrete', 6))
    cv.hline(2, 126, 70, col('concrete', 4))
    cv.hline(2, 126, 71, col('concrete', 2))
    cv.hline(2, 126, 72, col('ink', 0))         # Strong deck overhang shadow onto 1F

    # Terrace furniture: lush corner planters, picnic tables/benches, & colorful striped parasols!
    cv.planter_box(5, 45, 18, 57, flower='yellow:5', pot_ramp='wood')
    cv.planter_box(110, 45, 123, 57, flower='pink:5', pot_ramp='wood')

    # Warm cafe fairy string lights draped along 3F setback cornice above terrace!
    for lx in range(20, 108, 7):
        ly = 40 + (1 if (lx // 7) % 2 == 0 else 0)
        cv.p(lx, ly, col('yellow', 5))
        if lx + 3 < 108:
            cv.p(lx + 3, 39, col('darkwood', 1))

    # Left wooden bench + cafe table + flanking chairs under red/cream striped parasol
    cv.outline_box(19, 53, 22, 58, col('wood', 3), col('wood', 1))
    cv.outline_box(42, 53, 45, 58, col('wood', 3), col('wood', 1))
    cv.outline_box(22, 52, 42, 58, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 6))
    cv.p(28, 54, col('white', 6))  # Coffee cup
    cv.p(36, 55, col('orange', 5))
    draw_parasol(cv, 32, 47, rx=10, ry=5, ramp_a='red', ramp_b='cream', seed=511)

    # Center wooden lounge bench facing terrace
    cv.outline_box(54, 53, 74, 58, col('wood', 4), col('wood', 1), top_hi=col('cedar', 5))
    cv.hline(55, 73, 55, col('wood', 2))

    # Right wooden table + flanking chairs under teal/cream striped parasol
    cv.outline_box(82, 53, 85, 58, col('wood', 3), col('wood', 1))
    cv.outline_box(105, 53, 108, 58, col('wood', 3), col('wood', 1))
    cv.outline_box(85, 52, 105, 58, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 6))
    cv.p(91, 54, col('white', 6))
    draw_parasol(cv, 95, 47, rx=10, ry=5, ramp_a='teal', ramp_b='cream', seed=512)

    # === 1F WARM WIDE GLASS DINING BAY, STRIPED CAFE AWNING & BULLETIN BOARD (y=72..111) ===
    draw_ashlar_wall(cv, 2, 72, 126, 110, ramp='concrete', base_i=4, bw=10, bh=5, seed=515)
    # Brick structural piers framing the 1F cafeteria bay
    for px in (2, 74, 120):
        cv.brick_wall(px, 73, px + 6, 110, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=516)

    # Striped cafe awning spanning the wide 1F dining bay (x=8..74, y=73..81)
    cv.awning(8, 73, 74, 81, ramp_a='red', ramp_b='cream', stripe_w=4)

    # Wide backlit warm glass cafeteria dining bay (x=9..73, y=81..107)
    cv.outline_box(9, 81, 73, 107, col('orange', 3), col('wood', 1))
    for y in range(82, 106):
        ry = y - 82
        for x in range(10, 72):
            if ry < 3:
                cv.p(x, y, col('orange', 2))
            elif ry < 14:
                cv.p(x, y, col('yellow', 5 if (x + y) % 3 != 0 else 4))
            else:
                cv.p(x, y, col('orange', 4 if (x + y) % 4 != 0 else 3))
    # Pendant lights hanging inside cafeteria
    for lx in (18, 33, 48, 63):
        cv.vline(lx, 82, 86, col('wood', 1))
        cv.rect(lx - 1, 86, lx + 2, 88, col('white', 6))
    # Cafeteria wooden dining tables & chairs silhouetted warmly inside
    for tx in (14, 30, 46, 60):
        cv.rect(tx, 97, tx + 9, 100, col('wood', 3))
        cv.hline(tx, tx + 9, 97, col('cedar', 5))
        cv.vline(tx + 2, 100, 105, col('wood', 1))
        cv.vline(tx + 7, 100, 105, col('wood', 1))
        cv.p(tx + 3, 96, col('white', 6))  # Tray/cup
    # Crisp glass mullions & diagonal sky reflection streaks
    for mx in (25, 41, 57):
        cv.vline(mx, 82, 106, col('wood', 1))
    for k in range(8):
        cv.p(14 + k, 84 + k, col('glass', 6))
        cv.p(45 + k, 84 + k, col('glass', 6))
    cv.hline(8, 74, 107, col('stone', 6))

    # Right section (x=80..120): Double glass student-union entrance + Campus Bulletin Board!
    draw_text_plaque(cv, 82, 73, 118, 82, 'UNION', fill=col('wood', 1), border=col('ink', 0), fg=col('cream', 6), spacing=1, shadow_below=True)
    cv.door_glass(82, 83, 101, 109, frame='darkwood:2', warm=True)
    draw_bulletin_board(cv, 103, 85, 118, 100, seed=521)
    # Outdoor menu A-frame sign & planter beside entrance
    cv.outline_box(106, 101, 115, 109, col('wood', 2), col('ink', 0), top_hi=col('wood', 5))
    cv.rect(108, 103, 113, 107, col('cream', 5))
    cv.hline(109, 112, 104, col('red', 4))

    # Grounding stone curb & cast shadow
    cv.hline(2, 126, 109, col('pavement', 4))
    cv.hline(2, 126, 110, col('ink', 1))
    cv.hline(2, 126, 111, col('ink', 0))
    cv.edge_finish(top_y=4)
    return cv


# ---------------------------------------------------------------------------
# 6. mf-bldg-camp_bell_tower (64x144) — Tall Brick & Stone Clock & Bell Tower
# ---------------------------------------------------------------------------

def build_camp_bell_tower():
    w, h = 64, 144
    cv = Canvas(w, h)
    cx = w // 2  # 32

    # === STEEP DARK-TEAL SHINGLED PYRAMIDAL ROOF SPIRE (y=2..40) ===
    # Golden weathervane finial at very peak (y=1..6)
    cv.vline(cx, 1, 8, col('yellow', 5))
    cv.hline(cx - 2, cx + 3, 3, col('yellow', 4))
    cv.p(cx, 1, col('yellow', 5))
    cv.p(cx + 1, 2, col('orange', 4))

    spire_top = 7
    spire_bot = 39
    for y in range(spire_top, spire_bot):
        t = (y - spire_top) / max(1, (spire_bot - spire_top - 1))
        half_w = max(1, int(round(1 + t * 28)))
        rx0, rx1 = cx - half_w, cx + half_w
        ci = (y - spire_top) // 4
        yy = (y - spire_top) % 4
        for x in range(rx0, rx1 + 1):
            if x == rx0 or x == rx1:
                cv.p(x, y, col('midori', 0))
            elif y == spire_bot - 1:
                cv.p(x, y, col('midori', 0))
            elif y == spire_bot - 2:
                cv.p(x, y, col('midori', 1))
            else:
                # Top-left sunlight: left face brighter teal-green, right face shaded deeper teal
                is_left = (x < cx)
                bx = (x + (2 if ci % 2 else 0)) % 4
                r = hsh(x // 4, ci, 601)
                if yy == 3 or bx == 3:
                    cv.p(x, y, col('midori', 1 if is_left else 0))
                else:
                    bt = 4 if is_left else 2
                    if r > 0.72:
                        bt += 1
                    elif r < 0.25:
                        bt -= 1
                    if x == cx - 1:
                        bt = min(6, bt + 1)  # Crisp ridge highlight
                    cv.p(x, y, col('midori', max(1, bt)))

    # Stone cornice under spire eave (y=39..43)
    draw_cornice(cv, 3, 39, 61, ramp='stone', hi=6, mid=5, sh=2)

    # === OPEN BELFRY ARCH WITH VISIBLE BRONZE BELL (y=43..64) ===
    draw_ashlar_wall(cv, 6, 43, 58, 64, ramp='stone', base_i=5, bw=8, bh=5, seed=602)
    cv.vline(6, 43, 64, col('stone', 1))
    cv.vline(57, 43, 64, col('stone', 1))
    # Flanking slender corner pilasters
    for px in (8, 52):
        cv.rect(px, 43, px + 4, 63, col('stone', 6 if px < 32 else 4))
        cv.vline(px, 43, 63, col('stone', 2))

    # Deep shaded open belfry arch (x=18..46, y=45..63)
    bcy = 53
    br = 12
    for y in range(44, 63):
        for x in range(18, 46):
            in_arch = True
            if y < bcy:
                d = math.hypot(x - (cx - 0.5), y - bcy)
                if d > br:
                    in_arch = False
                elif d > br - 1.5:
                    cv.p(x, y, col('stone', 2))
                    continue
            if not in_arch:
                continue
            # Deep dark belfry chamber with sky glimpse at bottom corners
            if y >= 58 and (x < 23 or x > 40):
                cv.p(x, y, col('glass', 3))
            else:
                cv.p(x, y, col('ink', 0) if y < 54 else col('ink', 1))

    # Timber bell yoke beam across upper arch
    cv.rect(20, 48, 44, 51, col('wood', 3))
    cv.hline(20, 44, 48, col('wood', 5))
    # Clearly visible hanging BRONZE BELL (centered at cx=32, y=50..61)
    bell_profile = [
        (50, 3), (51, 4), (52, 4), (53, 5), (54, 5),
        (55, 6), (56, 6), (57, 7), (58, 8), (59, 9), (60, 8)
    ]
    for by, hw in bell_profile:
        for bx in range(cx - hw, cx + hw + 1):
            if bx == cx - hw or bx == cx + hw:
                cv.p(bx, by, col('wood', 1))
            elif bx < cx - hw // 2:
                cv.p(bx, by, col('yellow', 5))  # Bright golden bronze highlight!
            elif bx <= cx + 1:
                cv.p(bx, by, col('orange', 4))
            else:
                cv.p(bx, by, col('orange', 2))  # Shaded right curve
    cv.hline(cx - 8, cx + 9, 59, col('yellow', 4))  # Rim glint
    cv.rect(cx - 1, 60, cx + 2, 62, col('yellow', 5))  # Clapper!
    # Belfry stone balustrade & cornice (y=62..67)
    cv.rect(18, 61, 46, 64, col('stone', 4))
    for rx in range(20, 45, 4):
        cv.vline(rx, 61, 64, col('stone', 1))
    draw_cornice(cv, 4, 64, 60, ramp='stone', hi=6, mid=5, sh=2)

    # === FOUR-SIDED GLOWING CREAM CLOCK TIER (y=68..91) ===
    cv.brick_wall(6, 68, 58, 92, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=603)
    draw_quoins(cv, 6, 68, 92, w=4, ramp='stone', base_i=5, side='left')
    draw_quoins(cv, 58, 68, 92, w=4, ramp='stone', base_i=4, side='right')
    # Side-edge brass rim hints of the east & west clock faces for 3/4 depth!
    for sy in range(74, 86):
        cv.p(6, sy, col('yellow', 4))
        cv.p(57, sy, col('orange', 3))
    # Front stone medallion & glowing cream clock face
    cv.outline_box(19, 69, 45, 91, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
    draw_clock_face(cv, cx, 80, r=9, bezel_ramp='wood', face_ramp='cream', hour_ang=-2.5, min_ang=-0.4)
    draw_cornice(cv, 5, 91, 59, ramp='stone', hi=6, mid=4, sh=2)

    # === BRICK SHAFT WITH STAGGERED LANCET WINDOWS & IVY (y=95..118) ===
    cv.brick_wall(6, 95, 58, 118, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=604)
    draw_quoins(cv, 6, 95, 118, w=4, ramp='stone', base_i=5, side='left')
    draw_quoins(cv, 58, 95, 118, w=4, ramp='stone', base_i=4, side='right')
    # Staggered narrow gothic/lancet stair windows (breaks any repetition!)
    cv.window(18, 98, 25, 111, style='warm', frame='stone:2', sill='stone:6')
    cv.window(39, 102, 46, 115, style='glass', frame='stone:2', sill='stone:6')
    # Stone crest plaque centered on shaft
    cv.outline_box(28, 99, 36, 108, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
    cv.rect(30, 101, 34, 106, col('yellow', 4))
    cv.p(31, 102, col('brick', 3))
    cv.p(32, 104, col('brick', 3))

    # === STONE ARCHED BASE PASSAGE (y=118..143) ===
    draw_cornice(cv, 3, 117, 61, ramp='stone', hi=6, mid=5, sh=2)
    draw_ashlar_wall(cv, 4, 120, 60, 143, ramp='stone', base_i=4, bw=9, bh=5, seed=605)
    # Flanking stepped stone buttresses
    cv.outline_box(2, 124, 9, 143, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
    cv.outline_box(55, 124, 62, 143, col('stone', 4), col('stone', 1), top_hi=col('stone', 5))

    # Grand semicircular pedestrian stone arch passage (x=17..47, y=122..143)
    pcy = 132
    pr = 13
    for y in range(120, 143):
        for x in range(16, 48):
            in_p = True
            if y < pcy:
                d = math.hypot(x - (cx - 0.5), y - pcy)
                if d > pr + 2.2:
                    in_p = False
                elif d > pr:
                    cv.p(x, y, col('stone', 6 if (x + y) % 3 != 0 else 4))
                    continue
                elif d > pr - 1.2:
                    cv.p(x, y, col('stone', 1))
                    continue
            else:
                if x in (16, 17, 46, 47):
                    cv.p(x, y, col('stone', 6 if x < 32 else 3))
                    continue
            if not in_p:
                continue
            # Deep shaded walkway interior + cobbled floor + hanging warm arch lantern
            if y >= 137:
                # Lit stone cobble walkway receding into shadow
                cv.p(x, y, col('pavement', 4 if (x + y) % 3 != 0 else 3))
            elif y >= 133:
                cv.p(x, y, col('pavement', 2 if (x + y) % 2 == 0 else 1))
            else:
                cv.p(x, y, col('ink', 0) if y < 128 else col('ink', 1))
    # Hanging warm lantern glowing inside the stone arch passage!
    cv.vline(cx, 121, 125, col('steel', 2))
    cv.rect(cx - 2, 125, cx + 2, 129, col('yellow', 5))
    cv.p(cx - 1, 126, col('white', 6))

    # === CLIMBING GREEN IVY VINES UP THE BRICK SHAFT ===
    draw_ivy_vine(cv, [(8, 124), (10, 110), (14, 96), (9, 82), (12, 70)], width=2, seed=611)
    draw_ivy_vine(cv, [(54, 122), (52, 108), (49, 98), (53, 86), (51, 78)], width=2, seed=612, blossom=col('cream', 6))
    cv.foliage_cluster(10, 138, 5, 4, ramp='foliage', seed=613, blossom=col('pink', 5))
    cv.foliage_cluster(54, 138, 5, 4, ramp='foliage', seed=614)

    cv.hline(2, 62, 142, col('ink', 1))
    cv.hline(2, 62, 143, col('ink', 0))
    cv.edge_finish(top_y=7)
    return cv


# ---------------------------------------------------------------------------
# 7. mf-bldg-camp_dormitory (112x128) — Cozy 3F Brick-and-Cream Student Dorm
# ---------------------------------------------------------------------------

def draw_dorm_balcony(cv, x0, y0, x1, y1, props, seed=0):
    """Individually decorated dorm mini-balcony (laundry, quilts, AC boxes, plants)."""
    # Recessed balcony floor shadow & steel/concrete rail
    cv.rect(x0, y0, x1, y1, col('concrete', 3))
    cv.hline(x0, x1, y0, col('steel', 5))
    cv.hline(x0, x1, y0 + 1, col('steel', 1))
    for x in range(x0 + 1, x1 - 1):
        if (x - x0) % 3 == 0:
            cv.vline(x, y0 + 2, y1 - 1, col('steel', 2))
        else:
            cv.vline(x, y0 + 2, y1 - 1, col('concrete', 2))
    cv.hline(x0, x1, y1 - 1, col('concrete', 5))
    cv.hline(x0, x1, y1, col('ink', 1))

    if 'red_quilt' in props:
        # Striped red/cream futon bedding aired over the railing!
        cv.outline_box(x0 + 3, y0 - 1, x0 + 14, y1 - 1, col('red', 4), col('red', 1), top_hi=col('red', 5))
        for qx in range(x0 + 5, x0 + 13, 3):
            cv.vline(qx, y0, y1 - 2, col('cream', 5))
    if 'yellow_blanket' in props:
        cv.outline_box(x1 - 13, y0 - 1, x1 - 3, y1 - 1, col('yellow', 4), col('orange', 1), top_hi=col('yellow', 5))
        cv.hline(x1 - 12, x1 - 4, y0 + 2, col('orange', 4))
    if 'teal_towel' in props:
        cv.outline_box(x0 + 4, y0 - 1, x0 + 10, y1 - 2, col('teal', 4), col('teal', 1), top_hi=col('teal', 5))
        cv.outline_box(x0 + 12, y0 - 1, x0 + 17, y1 - 2, col('pink', 4), col('pink', 1), top_hi=col('pink', 5))
    if 'ac_right' in props:
        cv.outline_box(x1 - 8, y0 - 4, x1 - 1, y1 - 2, col('white', 4), col('steel', 1), top_hi=col('white', 6))
        cv.rect(x1 - 6, y0 - 2, x1 - 3, y1 - 3, col('steel', 1))
    if 'ac_left' in props:
        cv.outline_box(x0 + 1, y0 - 4, x0 + 8, y1 - 2, col('white', 4), col('steel', 1), top_hi=col('white', 6))
        cv.rect(x0 + 3, y0 - 2, x0 + 6, y1 - 3, col('steel', 1))
    if 'planter' in props:
        cv.planter_box(x0 + 10, y0 - 3, x1 - 3, y0 + 2, flower='pink:5', pot_ramp='brick')
    if 'succulent' in props:
        cv.rect(x1 - 5, y0 - 2, x1 - 2, y0 + 1, col('brick', 4))
        cv.p(x1 - 4, y0 - 3, col('foliage', 5))
        cv.p(x1 - 3, y0 - 3, col('foliage', 4))
    if 'crate' in props:
        cv.outline_box(x0 + 2, y0 - 3, x0 + 8, y0 + 1, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 5))


def build_camp_dormitory():
    w, h = 112, 128
    cv = Canvas(w, h)

    # Pitched terracotta-brown tile roof (y=6..34)
    cv.pitched_roof(2, 6, 110, 34, ramp='rooftile', ridge_hi=True, moss_rate=0.03, seed=701)
    # Brick chimney on left & roof vent on right
    cv.brick_wall(16, 2, 26, 16, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=702)
    cv.outline_box(15, 1, 27, 4, col('stone', 5), col('ink', 0), top_hi=col('stone', 6))
    cv.outline_box(84, 12, 94, 21, col('cream', 5), col('wood', 1), top_hi=col('rooftile', 5))
    cv.window(86, 14, 92, 20, style='warm', frame='wood:1', sill=None)

    # Main 3F brick-and-cream facade (y=34..126)
    draw_stucco_wall(cv, 4, 34, 108, 126, ramp='cream', base_i=5, seed=703, panel_w=18)
    # Warm red-brick corner piers & 1F brick masonry base
    cv.brick_wall(4, 34, 12, 126, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=704)
    cv.brick_wall(100, 34, 108, 126, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=705)
    cv.brick_wall(4, 94, 108, 126, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=706)
    # Horizontal brick accent bands between floors
    cv.brick_wall(12, 60, 100, 64, ramp='brick', base_i=4, course_h=2, brick_w=5, seed=707)
    draw_cornice(cv, 2, 34, 110, ramp='stone', hi=6, mid=5, sh=2)
    draw_cornice(cv, 4, 92, 108, ramp='stone', hi=6, mid=5, sh=2)

    # --- 3F INDIVIDUALIZED DORM ROOMS (y=40..60) — 3 totally unique rooms! ---
    # 3A: Blue curtains + sky glass + red/white striped futon bedding aired on balcony!
    cv.window(15, 40, 37, 54, style='glass', frame='wood:2', sill=None, curtain='blue', seed=711)
    draw_dorm_balcony(cv, 13, 52, 39, 60, props=['red_quilt', 'succulent'], seed=711)

    # 3B: Warm desk lamp study room + green curtain + AC outdoor unit on right!
    cv.window(45, 40, 67, 54, style='warm', frame='wood:2', sill=None, curtain='green', seed=712)
    # Study desk lamp silhouette inside 3B
    cv.rect(52, 48, 56, 51, col('white', 6))
    cv.vline(54, 51, 53, col('wood', 1))
    draw_dorm_balcony(cv, 43, 52, 69, 60, props=['ac_right'], seed=712)

    # 3C: Half-down blinds + teal & pink towels hung on balcony rail!
    cv.window(75, 40, 97, 54, style='blinds', frame='wood:2', sill=None, seed=713)
    draw_dorm_balcony(cv, 73, 52, 99, 60, props=['teal_towel'], seed=713)

    # --- 2F INDIVIDUALIZED DORM ROOMS (y=68..90) — ZERO cloning vs 3F! ---
    # 2A: Warm backlit bookshelf room + flower planter + AC box on left!
    draw_classroom_bay(cv, 15, 68, 37, 82, scene='club_books', frame='wood:2', sill=None, seed=721)
    draw_dorm_balcony(cv, 13, 81, 39, 89, props=['ac_left', 'planter'], seed=721)

    # 2B: Sky-glass with pink curtains + drying laundry shirts on mini balcony!
    cv.window(45, 68, 67, 82, style='glass', frame='wood:2', sill=None, curtain='pink', seed=722)
    # Tiny hanging laundry line above rail
    cv.hline(46, 66, 79, col('coolwhite', 5))
    cv.rect(48, 79, 52, 83, col('white', 6))
    cv.rect(54, 79, 58, 83, col('blue', 4))
    cv.rect(60, 79, 63, 82, col('yellow', 5))
    draw_dorm_balcony(cv, 43, 81, 69, 89, props=['succulent'], seed=722)

    # 2C: Warm desk-lamp + poster + yellow blanket & storage crate on balcony!
    draw_classroom_bay(cv, 75, 68, 97, 82, scene='desks_warm', frame='wood:2', sill=None, seed=723)
    draw_dorm_balcony(cv, 73, 81, 99, 89, props=['yellow_blanket', 'crate'], seed=723)

    # --- 1F GLAZED COMMON ROOM, DORM ENTRANCE & COVERED BICYCLE PORCH (y=94..127) ---
    # Left (x=10..44): Warm glazed student common room (sofas, floor lamp, coffee table)
    cv.outline_box(10, 98, 44, 120, col('orange', 3), col('wood', 1))
    cv.rect(11, 99, 43, 119, col('yellow', 4))
    cv.rect(11, 99, 43, 102, col('orange', 3))
    # Cozy red sofa & coffee table inside common room
    cv.rect(14, 111, 28, 117, col('red', 3))
    cv.hline(14, 28, 111, col('red', 4))
    cv.rect(31, 113, 40, 117, col('wood', 3))
    cv.rect(34, 106, 38, 109, col('white', 6))  # Standing lamp glow
    cv.vline(36, 109, 115, col('wood', 1))
    cv.vline(27, 99, 119, col('wood', 1))
    cv.hline(11, 43, 104, col('wood', 1))
    # Glass glint & sill + flower bed
    cv.p(13, 100, col('glass', 6))
    cv.p(14, 101, col('glass', 5))
    cv.hline(9, 45, 120, col('stone', 6))
    cv.planter_box(12, 119, 32, 125, flower='yellow:5', pot_ramp='stone')

    # Center (x=47..67): Arched brick dorm entry door + mailbox bank
    cv.outline_box(47, 97, 67, 125, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
    cv.door_wood(50, 101, 61, 124, ramp='wood', glass_top=True)
    # Dorm mailbox grid right next to door
    cv.outline_box(62, 107, 66, 118, col('steel', 4), col('steel', 1))
    for my in (109, 112, 115):
        cv.hline(63, 65, my, col('steel', 2))
    draw_stone_steps(cv, 47, 122, 67, 126, ramp='stone')

    # Right (x=69..106): Covered Bicycle Porch with 2 parked bicycles!
    # Sloped corrugated canopy roof
    for y in range(97, 105):
        ry = y - 97
        for x in range(69, 106):
            if ry == 0:
                cv.p(x, y, col('teal', 1))
            elif ry == 7:
                cv.p(x, y, col('teal', 0))
            else:
                cv.p(x, y, col('teal', 4 if (x % 4 != 0) else 2))
    cv.hline(70, 105, 105, col('ink', 0))
    # Shaded porch interior recess
    cv.rect(70, 106, 104, 125, col('pavement', 2))
    cv.rect(70, 119, 104, 125, col('pavement', 4))  # Paved floor
    # Support timber posts
    cv.vline(70, 105, 125, col('wood', 2))
    cv.vline(71, 105, 125, col('wood', 5))
    cv.vline(103, 105, 125, col('wood', 2))
    cv.vline(104, 105, 125, col('wood', 4))
    # Two distinct parked campus bicycles under the porch!
    draw_bicycle(cv, 74, 116, frame_ramp='red')
    draw_bicycle(cv, 89, 116, frame_ramp='blue')

    cv.hline(4, 108, 126, col('ink', 1))
    cv.hline(4, 108, 127, col('ink', 0))
    cv.edge_finish(top_y=6)
    return cv


# ---------------------------------------------------------------------------
# 8. mf-bldg-camp_music_conservatory (112x112) — Timber & Glass Music/Arts Hall
# ---------------------------------------------------------------------------

def build_camp_music_conservatory():
    w, h = 112, 112
    cv = Canvas(w, h)

    # === STEPPED FABLE 5.2 FLAT PARAPET ROOFS WITH RECESSED SUNLIT DECKS & INNER CAST SHADOWS ===
    # Flanking green urethane side wing roofs (drawn first so central crown rises cleanly above them!)
    cv.flat_roof(2, 10, 18, 27, deck_ramp='midori', deck_i=4, para_ramp='stone', seed=802)
    cv.flat_roof(94, 10, 110, 27, deck_ramp='midori', deck_i=4, para_ramp='stone', seed=803)
    # Crisp north & left inner cast shadows inside both recessed green wing roof decks
    for wx0, wx1, cast_left_extra in ((4, 16, 0), (96, 108, 2)):
        cv.hline(wx0, wx1, 13, col('midori', 1))
        cv.hline(wx0, wx1, 14, col('midori', 2))
        cv.hline(wx0, wx1, 15, col('midori', 3))
        cv.vline(wx0, 13, 23, col('midori', 1))
        cv.vline(wx0 + 1, 13, 23, col('midori', 2))
        if cast_left_extra:
            # Taller central clerestory crown casts a stronger top-left shadow onto the right wing deck
            cv.vline(wx0 + 2, 13, 23, col('midori', 2))
            cv.vline(wx0 + 3, 13, 23, col('midori', 3))
        # Sunlit expansion joint accent on open green deck
        cv.hline(wx0 + 2 + cast_left_extra, wx1 - 1, 19, col('midori', 5))

    # Central elevated recital-hall flat parapet crown (x=15..97, y=2..23)
    cv.flat_roof(15, 2, 97, 23, deck_ramp='concrete', deck_i=4, para_ramp='stone', seed=801)
    # Crisp Fable 5.2 north & left inner cast shadows inside the recessed sunlit concrete deck (x=17..95, y=5..19)
    cv.hline(17, 95, 5, col('concrete', 1))
    cv.hline(17, 95, 6, col('concrete', 2))
    cv.hline(17, 95, 7, col('concrete', 3))
    cv.vline(17, 5, 19, col('concrete', 1))
    cv.vline(18, 5, 19, col('concrete', 2))
    cv.vline(19, 5, 19, col('concrete', 3))
    # Subtle sunlit roof concrete seam lines on open deck plane
    cv.vline(56, 7, 19, col('concrete', 3))
    cv.hline(20, 94, 17, col('concrete', 5))

    # Two compact recessed glass skylights perched cleanly inside the sunlit central roof deck!
    for sx0, sx1 in ((24, 50), (62, 88)):
        # Bottom-right cast shadow of skylight frame onto sunlit concrete deck
        cv.hline(sx0 + 1, sx1 + 1, 16, col('concrete', 2))
        cv.vline(sx1, 10, 16, col('concrete', 2))
        cv.outline_box(sx0, 9, sx1, 16, col('glass', 3), col('steel', 1))
        for y in range(10, 15):
            for x in range(sx0 + 1, sx1 - 1):
                if (x - sx0) % 6 == 0:
                    cv.p(x, y, col('steel', 2))
                elif (x + y) % 5 in (1, 2):
                    cv.p(x, y, col('glass', 6))
                elif y >= 13:
                    cv.p(x, y, col('yellow', 4))  # Warm recital glow from beneath!
                else:
                    cv.p(x, y, col('glass', 4))
        cv.hline(sx0, sx1, 9, col('coolwhite', 5))

    # === UPPER 2F FACADE: VERTICAL CEDAR ACOUSTIC LOUVER FINS + TALL ARCHED RECITAL WINDOWS ===
    # Warm stone & cedar architectural shell (starts at y=27 so flanking parapet fronts y=23..26 stay 100% crisp!)
    draw_ashlar_wall(cv, 2, 27, 110, 74, ramp='stone', base_i=5, bw=10, bh=5, seed=804)
    cv.hline(2, 16, 27, col('ink', 1))
    cv.hline(96, 110, 27, col('ink', 1))
    # Recessed warm cedar timber acoustic louver-fin panels across upper facade!
    for lx0, lx1 in ((6, 26), (86, 106)):
        cv.rect(lx0, 30, lx1, 70, col('darkwood', 1))
        for x in range(lx0, lx1, 3):
            cv.vline(x, 30, 70, col('cedar', 5))
            if x + 1 < lx1:
                cv.vline(x + 1, 30, 70, col('cedar', 3))
            if x + 2 < lx1:
                cv.vline(x + 2, 30, 70, col('darkwood', 1))
        cv.hline(lx0, lx1, 30, col('stone', 2))
        cv.hline(lx0, lx1, 70, col('stone', 6))

    # Upper cedar acoustic louver band spanning cleanly below the central roof parapet (y=23..31)
    cv.rect(16, 23, 96, 31, col('darkwood', 1))
    for x in range(17, 95, 3):
        cv.vline(x, 24, 30, col('cedar', 5))
        cv.vline(x + 1, 24, 30, col('wood', 4))
    cv.hline(16, 96, 23, col('ink', 0))  # Crisp cast shadow under central parapet coping

    # Three grand tall arched recital-hall windows glowing warmly (y=34..69)!
    draw_arched_window(cv, 30, 35, 46, 68, mode='recital', frame='darkwood:1', surround='stone:6', seed=811)
    draw_arched_window(cv, 48, 33, 64, 68, mode='recital', frame='darkwood:1', surround='stone:6', seed=812)
    draw_arched_window(cv, 66, 35, 82, 68, mode='recital', frame='darkwood:1', surround='stone:6', seed=813)
    # Grand piano silhouette inside center recital arch + acoustic organ-pipe ribs in side arches
    cv.rect(52, 61, 60, 65, col('ink', 0))
    cv.hline(53, 59, 60, col('steel', 3))  # Open grand piano lid glint
    cv.vline(53, 65, 67, col('ink', 0))
    cv.vline(59, 65, 67, col('ink', 0))
    for px in (34, 37, 40, 43):
        cv.vline(px, 44, 53, col('yellow', 5))  # Golden acoustic pipe organ glints
    for px in (70, 73, 76, 79):
        cv.vline(px, 44, 53, col('yellow', 5))

    # Small recessed acoustic side windows peeking through the cedar louvers
    cv.window(10, 44, 22, 58, style='warm', frame='darkwood:1', sill='cedar:5')
    cv.window(90, 44, 102, 58, style='warm', frame='darkwood:1', sill='cedar:5')

    # Grand projecting timber-and-stone portico cornice (y=72..78)
    draw_cornice(cv, 2, 72, 110, ramp='stone', hi=6, mid=5, sh=2, shadow_below=False)
    cv.rect(4, 75, 108, 78, col('cedar', 3))  # Warm timber soffit edge
    cv.hline(4, 108, 78, col('ink', 0))

    # === 1F GRAND RECESSED PORTICO ENTRANCE & CONCERT POSTER BOARDS (y=78..111) ===
    # Deeply shaded warm portico recess
    draw_ashlar_wall(cv, 4, 78, 108, 109, ramp='stone', base_i=3, bw=10, bh=5, seed=820)
    # Warm timber recessed lobby backing
    cv.siding_wall(28, 79, 84, 106, ramp='cedar', base_i=3, horizontal=False, step=3, seed=821)

    # Four slender stone-and-cedar portico columns
    for cx in (24, 34, 74, 84):
        cv.rect(cx, 78, cx + 4, 108, col('stone', 5))
        cv.vline(cx, 78, 108, col('stone', 6))
        cv.vline(cx + 3, 78, 108, col('stone', 2))
        cv.hline(cx - 1, cx + 5, 79, col('stone', 6))  # Capital
        cv.hline(cx - 1, cx + 5, 107, col('stone', 4))  # Plinth

    # Concert hall double glass doors glowing with warm golden lobby light (x=40..72)
    draw_text_plaque(cv, 40, 79, 72, 88, 'MUSIC', fill=col('darkwood', 1), border=col('ink', 0), fg=col('yellow', 5), spacing=1, shadow_below=False)
    cv.door_glass(42, 88, 70, 107, frame='darkwood:1', warm=True)
    # Wide grand stone portico steps
    draw_stone_steps(cv, 26, 105, 86, 111, ramp='stone')

    # Illuminated CONCERT POSTER BOARDS flanking left (x=7..21) and right (x=91..105)!
    # Left concert poster (classical violin / symphony poster in navy + gold)
    cv.hline(8, 20, 81, col('yellow', 5))  # Spotlight glow
    cv.outline_box(7, 82, 21, 103, col('navy', 2), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.rect(9, 84, 19, 101, col('navy', 3))
    # Stylized musical treble/violin silhouette in gold & cream
    cv.vline(14, 86, 98, col('yellow', 5))
    cv.rect(12, 92, 17, 97, col('orange', 4))
    cv.p(13, 93, col('yellow', 5))
    cv.hline(10, 18, 86, col('cream', 6))
    cv.hline(11, 17, 99, col('cream', 5))

    # Right concert poster (piano recital poster in crimson + ivory)
    cv.hline(92, 104, 81, col('yellow', 5))
    cv.outline_box(91, 82, 105, 103, col('maple', 3), col('darkwood', 0), top_hi=col('cedar', 5))
    cv.rect(93, 84, 103, 101, col('maple', 4))
    # Stylized piano keys strip & recital banner!
    cv.rect(94, 94, 102, 99, col('white', 6))
    for kx in (95, 97, 99, 101):
        cv.vline(kx, 94, 97, col('ink', 0))
    cv.hline(94, 102, 86, col('yellow', 5))
    cv.hline(95, 101, 89, col('cream', 5))

    # Ground planters & grounding shadow
    cv.planter_box(6, 104, 22, 110, flower='yellow:5', pot_ramp='stone')
    cv.planter_box(90, 104, 106, 110, flower='pink:5', pot_ramp='stone')
    cv.hline(4, 108, 110, col('ink', 1))
    cv.hline(4, 108, 111, col('ink', 0))
    cv.edge_finish(top_y=4)
    return cv


# ---------------------------------------------------------------------------
# 9. mf-bldg-camp_main_gatehouse (112x80) — Grand Brick & Granite Gatehouse
# ---------------------------------------------------------------------------

def build_camp_main_gatehouse():
    w, h = 112, 80
    cv = Canvas(w, h)

    # Ground paved campus granite driveway & sidewalk apron (y=62..79) — grounds entire gatehouse!
    for y in range(62, 79):
        for x in range(2, 110):
            if y == 62:
                cv.p(x, y, col('pavement', 2))
            elif y >= 76:
                cv.p(x, y, col('pavement', 5 if (x // 6) % 2 == 0 else 4))
            else:
                # Flagstone herringbone/grid driveway blocks
                b = ((x // 8) + (y // 4)) % 2
                r = hsh(x // 4, y // 3, 901)
                t = 4 if b == 0 else 5
                if r < 0.2:
                    t -= 1
                cv.p(x, y, col('pavement', t))
    cv.hline(2, 110, 78, col('ink', 1))
    cv.hline(2, 110, 79, col('ink', 0))

    # === FLOWERING CHERRY / SHRUB BORDER BEHIND WING WALL & LEFT SIDE ===
    # Dark wood cherry tree trunk peeking behind left brick wing wall
    cv.rect(14, 29, 18, 40, col('wood', 2))
    cv.vline(15, 29, 40, col('wood', 4))
    cv.foliage_cluster(11, 24, 10, 9, ramp='foliage', seed=902, blossom=col('pink', 5))
    cv.foliage_cluster(21, 21, 10, 9, ramp='pink', seed=903, blossom=col('white', 6))
    cv.foliage_cluster(6, 34, 5, 6, ramp='foliage', seed=904, blossom=col('pink', 4))
    # Cherry blossom branch peeking behind right security lodge
    cv.foliage_cluster(100, 19, 9, 8, ramp='pink', seed=905, blossom=col('white', 6))

    # === LEFT BRICK & GRANITE CAMPUS WING WALL + NAME PLAQUE (x=2..28, y=38..74) ===
    cv.brick_wall(2, 42, 28, 72, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=906)
    draw_ashlar_wall(cv, 2, 62, 28, 73, ramp='stone', base_i=4, bw=8, bh=4, seed=907)
    # Granite stone coping cap on wing wall
    draw_cornice(cv, 1, 39, 29, ramp='stone', hi=6, mid=5, sh=2)
    # Ornate wrought-iron fence railing atop left wing wall (y=31..39)
    cv.hline(2, 28, 33, col('kuro', 1))
    cv.hline(2, 28, 37, col('kuro', 1))
    for fx in range(4, 28, 4):
        cv.vline(fx, 30, 39, col('kuro', 0))
        cv.p(fx, 29, col('steel', 5))  # Spear finial glint
    # Granite university name plaque inset on left wing wall
    draw_pixel_glyph_bar(cv, 5, 47, 25, 56, bg_ramp='stone', fg='wood:0', seed=908)
    # Low flowering shrub border along left base
    cv.foliage_cluster(10, 72, 7, 4, ramp='foliage', seed=909, blossom=col('pink', 5))
    cv.foliage_cluster(21, 73, 5, 3, ramp='foliage', seed=910, blossom=col('yellow', 5))

    # === DARK WROUGHT-IRON OPEN GATE LEAVES (between pillars x=37..65, y=34..68) ===
    # Swung open inward at 3/4 perspective on both sides of the central carriageway!
    for side, gx0, gx1 in (('left', 39, 49), ('right', 55, 65)):
        # Top curved iron scrollwork rail
        for x in range(gx0, gx1):
            frac = (x - gx0) / max(1, (gx1 - gx0 - 1))
            if side == 'right':
                frac = 1.0 - frac
            top_y = int(round(36 + frac * 6))
            bot_y = int(round(68 - frac * 4))
            cv.p(x, top_y, col('kuro', 0))
            cv.p(x, top_y + 1, col('steel', 4))
            cv.p(x, bot_y, col('kuro', 0))
            cv.p(x, bot_y - 3, col('kuro', 1))
            if (x - gx0) % 2 == 0:
                cv.vline(x, top_y, bot_y, col('kuro', 0))
                cv.p(x, top_y - 1, col('yellow', 5))  # Gold spear tip!
            elif (x - gx0) % 4 == 1:
                # Scrollwork curl
                cv.p(x, top_y + 4, col('steel', 3))
                cv.p(x, (top_y + bot_y) // 2, col('steel', 3))

    # === TWIN MONUMENTAL STONE GATE PILLARS WITH BRONZE CREST PLAQUES ===
    for px0 in (26, 63):
        px1 = px0 + 13
        pcx = (px0 + px1) // 2
        # Stepped granite pier shaft (y=24..74)
        draw_ashlar_wall(cv, px0, 26, px1, 74, ramp='stone', base_i=5, bw=6, bh=5, seed=911 + px0)
        # Red-brick recessed inlay panel inside stone pier
        cv.brick_wall(px0 + 3, 33, px1 - 3, 66, ramp='brick', base_i=4, course_h=3, brick_w=4, seed=912 + px0)
        # Crisp pier outline & top-left bevel
        cv.vline(px0, 26, 74, col('stone', 1))
        cv.vline(px0 + 1, 26, 74, col('stone', 6))
        cv.vline(px1 - 1, 26, 74, col('stone', 1))
        # Monumental stepped granite cornice cap
        cv.outline_box(px0 - 1, 22, px1 + 1, 27, col('stone', 5), col('ink', 0), top_hi=col('stone', 6), bot_sh=col('stone', 2))
        cv.outline_box(px0 + 1, 19, px1 - 1, 23, col('stone', 5), col('stone', 1), top_hi=col('stone', 6))
        # Glowing brass globe lantern on top of each pillar!
        cv.rect(pcx - 2, 12, pcx + 3, 18, col('yellow', 5))
        cv.rect(pcx - 1, 13, pcx + 2, 16, col('white', 6))
        cv.outline_box(pcx - 2, 11, pcx + 3, 13, col('wood', 1), col('ink', 0))
        cv.rect(pcx - 1, 17, pcx + 2, 19, col('wood', 2))
        # Ground plinth base
        cv.outline_box(px0 - 1, 69, px1 + 1, 75, col('stone', 4), col('stone', 1), top_hi=col('stone', 6))
        # BRONZE SCHOOL CREST PLAQUE mounted prominently on each pillar!
        cv.outline_box(px0 + 3, 41, px1 - 3, 52, col('orange', 3), col('wood', 0), top_hi=col('yellow', 5))
        cv.rect(px0 + 4, 43, px1 - 4, 49, col('yellow', 4))
        cv.p(pcx, 44, col('wood', 1))
        cv.hline(pcx - 1, pcx + 2, 46, col('wood', 1))
        cv.p(pcx, 48, col('wood', 1))

    # === BRICK-AND-GLASS SECURITY LODGE ON RIGHT (x=76..110, y=24..75) ===
    # Pitched dark-slate roof (y=24..40)
    cv.pitched_roof(75, 24, 111, 40, ramp='kawara', ridge_hi=True, moss_rate=0.04, seed=920)
    # Red-brick guardhouse walls (y=40..74)
    cv.brick_wall(76, 40, 110, 74, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=921)
    draw_ashlar_wall(cv, 76, 66, 110, 75, ramp='stone', base_i=4, bw=8, bh=4, seed=922)
    draw_cornice(cv, 75, 40, 110, ramp='stone', hi=6, mid=5, sh=2)

    # Wrap-around observation glass window (showing warm guard desk & glowing monitor!)
    cv.outline_box(78, 45, 95, 61, col('orange', 3), col('steel', 1))
    cv.rect(79, 46, 94, 60, col('yellow', 4))
    cv.rect(79, 46, 94, 48, col('orange', 2))
    # Guard monitor screen (cool blue glow) & desk lamp inside lodge
    cv.outline_box(81, 52, 87, 57, col('blue', 4), col('steel', 0))
    cv.p(82, 53, col('glass', 6))
    cv.rect(88, 54, 93, 59, col('wood', 3))
    cv.vline(86, 46, 60, col('steel', 2))
    cv.p(80, 47, col('glass', 6))
    cv.p(81, 48, col('glass', 5))
    cv.hline(77, 96, 61, col('stone', 6))
    cv.hline(78, 95, 62, col('ink', 1))

    # Guardhouse side wooden entry door & little AC unit
    cv.door_wood(97, 48, 107, 73, ramp='wood', glass_top=True)
    # Security sign above door
    cv.outline_box(97, 43, 108, 47, col('blue', 3), col('ink', 0), top_hi=col('blue', 5))
    cv.hline(99, 106, 45, col('white', 6))
    # Shrub beside guardhouse
    cv.foliage_cluster(84, 72, 6, 4, ramp='foliage', seed=925, blossom=col('pink', 5))

    cv.edge_finish(top_y=12)
    return cv


# ---------------------------------------------------------------------------
# 10. mf-bldg-camp_sports_pavilion (112x80) — Open-Air Bleacher Pavilion & Locker
# ---------------------------------------------------------------------------

def build_camp_sports_pavilion():
    w, h = 112, 80
    cv = Canvas(w, h)

    # === CANTILEVERED SUNLIT STEEL / WOOD ROOF CANOPY (x=2..110, y=4..29) ===
    # Top-3/4 overhanging corrugated steel canopy roof (sloping slightly toward back-top)
    for y in range(4, 24):
        ry = y - 4
        for x in range(2, 110):
            rib = ((x - 2) % 6 == 0)
            if ry == 0:
                cv.p(x, y, col('tile', 1))
            elif ry == 1:
                cv.p(x, y, col('tile', 6 if not rib else 4))
            elif ry == 19:
                cv.p(x, y, col('steel', 0))
            elif x in (2, 109):
                cv.p(x, y, col('steel', 1))
            else:
                bt = 5 if ry < 9 else (4 if ry < 15 else 3)
                if x > 92:
                    bt = max(2, bt - 1)
                if rib:
                    cv.p(x, y, col('tile', max(1, bt - 2)))
                elif (x - 2) % 6 == 1:
                    cv.p(x, y, col('tile', min(6, bt + 1)))
                else:
                    cv.p(x, y, col('tile', bt))

    # Front steel fascia beam + warm cedar timber underside soffit (y=24..29)
    cv.hline(2, 110, 24, col('steel', 6))
    cv.hline(2, 110, 25, col('steel', 3))
    cv.siding_wall(4, 26, 108, 30, ramp='cedar', base_i=4, horizontal=False, step=4, seed=1001)
    cv.hline(4, 108, 29, col('darkwood', 1))

    # === SCOREBOARD PLAQUE MOUNTED PROUDLY ON UPPER ROOF FASCIA (x=36..72, y=13..26) ===
    cv.outline_box(36, 13, 72, 26, col('kuro', 1), col('ink', 0), top_hi=col('steel', 5), bot_sh=col('kuro', 0))
    # Home / Away color team tabs
    cv.rect(38, 15, 48, 17, col('red', 4))
    cv.rect(60, 15, 70, 17, col('blue', 4))
    # Razor-sharp 3x5 LED score digits "02 : 01"
    # Digit '0' (x=39..42, y=19..24)
    cv.outline_box(39, 19, 43, 24, col('kuro', 0), col('yellow', 5))
    # Digit '2' (x=45..48, y=19..24)
    cv.hline(45, 48, 19, col('yellow', 5))
    cv.p(47, 20, col('yellow', 5))
    cv.hline(45, 48, 21, col('yellow', 5))
    cv.p(45, 22, col('yellow', 5))
    cv.hline(45, 48, 23, col('yellow', 5))
    # Center colon ":"
    cv.p(53, 20, col('red', 5))
    cv.p(54, 20, col('red', 5))
    cv.p(53, 22, col('red', 5))
    cv.p(54, 22, col('red', 5))
    # Digit '0' (x=60..63, y=19..24)
    cv.outline_box(60, 19, 64, 24, col('kuro', 0), col('yellow', 5))
    # Digit '1' (x=66..68, y=19..24)
    cv.vline(67, 19, 24, col('yellow', 5))
    cv.p(66, 20, col('yellow', 5))
    cv.hline(66, 69, 23, col('yellow', 5))

    # === LEFT & CENTER (x=4..72, y=30..78): SHADED TIERED BLEACHER SEATING ===
    # Shaded concrete back & side windbreak wall behind bleachers
    cv.rect(4, 30, 72, 42, col('concrete', 2))
    draw_ashlar_wall(cv, 4, 30, 72, 42, ramp='concrete', base_i=3, bw=12, bh=4, seed=1002)
    # Cast shadow from overhanging canopy onto upper wall
    cv.shade_rect(4, 30, 72, 35, delta=-1)

    # Diagonal structural steel cantilever support columns & roof struts!
    for sx in (6, 38, 69):
        cv.rect(sx, 30, sx + 3, 74, col('steel', 2))
        cv.vline(sx, 30, 74, col('steel', 5))
        cv.vline(sx + 2, 30, 74, col('steel', 0))
        # Angled brace struts up into timber soffit
        for k in range(5):
            cv.p(sx + 3 + k, 34 - k, col('steel', 4))
            cv.p(sx + 3 + k, 35 - k, col('steel', 1))

    # 4 Stepped Tiered Bleacher Seating Rows (y=41..68)
    # Alternating warm cedar planks & campus-blue stadium seat slats, growing brighter down out of canopy shadow!
    tier_specs = [
        (41, 47, 'blue', 3, 'concrete', 2),   # Top shaded row
        (48, 54, 'cedar', 3, 'concrete', 3),  # 2nd row
        (55, 61, 'blue', 4, 'concrete', 4),   # 3rd row
        (62, 68, 'cedar', 5, 'concrete', 5),  # Front sunlit row
    ]
    for idx, (ty0, ty1, seat_r, seat_i, step_r, step_i) in enumerate(tier_specs):
        # Concrete riser step
        cv.rect(9, ty0, 69, ty1, col(step_r, step_i))
        cv.hline(9, 69, ty1 - 1, col(step_r, max(1, step_i - 2)))
        # Bleacher bench seat top (3/4 sunlit bench plank + front lip + legs)
        cv.rect(10, ty0 + 1, 68, ty0 + 4, col(seat_r, seat_i))
        cv.hline(10, 68, ty0 + 1, col(seat_r, min(6, seat_i + 1)))
        cv.hline(10, 68, ty0 + 4, col(seat_r, max(0, seat_i - 2)))
        # Central concrete aisle steps breaking the benches at x=36..42
        cv.rect(36, ty0, 42, ty1, col('stone', min(6, step_i + 1)))
        cv.hline(36, 42, ty0, col('stone', 6))
        cv.hline(36, 42, ty1 - 1, col('stone', 2))

    # Lived-in spectator touches on bleachers (seat cushions, rolled gym bag, water bottle, towel)
    cv.rect(16, 49, 21, 51, col('red', 4))     # Red seat cushion on row 2
    cv.rect(25, 56, 30, 58, col('yellow', 5))  # Yellow towel draped on row 3
    cv.rect(52, 63, 57, 65, col('orange', 4))  # Sports duffel bag on front row
    cv.p(61, 62, col('teal', 5))               # Water bottle

    # Low front concrete retaining lip, steel spectator safety rail & trackside apron (x=4..72, y=68..79)
    # Cut a clean, unmistakable entry opening at x=36..42 aligned directly with the center bleacher steps!
    cv.rect(4, 68, 72, 79, col('pavement', 4))
    # Left & right front concrete retaining curbs (STOP cleanly at x=36 and resume at x=42!)
    for cx0, cx1 in ((6, 36), (42, 71)):
        cv.rect(cx0, 68, cx1, 73, col('concrete', 4))
        cv.hline(cx0, cx1, 68, col('concrete', 6))
        cv.hline(cx0, cx1, 72, col('concrete', 2))
        cv.hline(cx0, cx1, 73, col('pavement', 2))
    # Crisp dark side-cheek edges where the retaining curb is cut open for the center bleacher entry
    cv.vline(35, 68, 73, col('concrete', 1))
    cv.vline(42, 68, 73, col('concrete', 1))

    # Front vertical steel railing strictly on left (6..35) and right (42..70) — completely open at x=36..42!
    for rx0, rx1, posts in (
        (6, 36, (6, 15, 25, 35)),
        (42, 71, (42, 51, 61, 70)),
    ):
        cv.hline(rx0, rx1, 66, col('steel', 5))
        cv.hline(rx0, rx1, 67, col('steel', 1))
        for px in posts:
            cv.vline(px, 66, 73, col('steel', 2))

    # Center bleacher entry steps descending cleanly through the cut opening (x=36..42, y=68..75) onto the apron!
    cv.hline(36, 42, 68, col('stone', 6))
    cv.hline(36, 42, 69, col('stone', 5))
    cv.hline(36, 42, 70, col('stone', 2))
    cv.hline(36, 42, 71, col('stone', 6))
    cv.hline(36, 42, 72, col('stone', 4))
    cv.hline(36, 42, 73, col('stone', 2))
    cv.rect(36, 74, 42, 78, col('pavement', 5))

    # Relocated & compact wooden water-bottle rack (far-left apron x=7..20) & grey towel bin (x=60..68),
    # cleanly OFF both right-side locker doors and well clear of the center bleacher entry!
    cv.outline_box(7, 72, 20, 76, col('cedar', 4), col('wood', 1), top_hi=col('cedar', 6))
    bottles = [col('blue', 5), col('green', 5), col('orange', 5), col('teal', 5)]
    for bi, bx in enumerate((9, 12, 15, 18)):
        cv.rect(bx, 70, bx + 2, 73, bottles[bi % len(bottles)])
        cv.p(bx, 69, col('white', 6))  # Bottle nozzle cap
    cv.outline_box(60, 72, 68, 76, col('steel', 4), col('steel', 1))
    cv.rect(61, 70, 67, 73, col('white', 6))
    cv.hline(62, 66, 71, col('cream', 4))

    # Concrete track lane border stripe along left/right bleacher walkway edge (broken cleanly at entry & stops before locker house)
    for tx0, tx1 in ((4, 35), (43, 72)):
        cv.hline(tx0, tx1, 76, col('brick', 4))
        cv.hline(tx0, tx1, 77, col('white', 5))

    # === RIGHT SECTION (x=72..108, y=30..79): WARM LOCKER-ROOM HOUSE (UNOBSTRUCTED DOORS TO y=79!) ===
    cv.brick_wall(72, 30, 108, 78, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=1010)
    # Stone ground base plinth along locker wall flanks (y=74..78)
    draw_ashlar_wall(cv, 72, 74, 108, 78, ramp='stone', base_i=4, bw=8, bh=4, seed=1011)
    cv.hline(72, 108, 74, col('stone', 6))
    cv.vline(72, 30, 78, col('stone', 1))
    cv.vline(107, 30, 78, col('stone', 1))
    # Shaded top eave band
    cv.shade_rect(72, 30, 108, 34, delta=-1)

    # High frosted locker-room vent window (y=36..43)
    cv.window(76, 36, 104, 43, style='blinds', frame='steel:1', sill='stone:6')

    # Warm glowing porch light above locker doors
    cv.rect(88, 45, 92, 47, col('yellow', 5))
    cv.p(89, 45, col('white', 6))

    # Twin warm locker-room doors (Home / Visitor team rooms, y=50..78) reaching cleanly to street baseline y=79!
    for dx0, dx1, badge_c in ((75, 88, 'blue:4'), (91, 104, 'red:4')):
        cv.outline_box(dx0, 50, dx1, 78, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
        # Upper warm transom/vent louver
        cv.rect(dx0 + 2, 53, dx1 - 2, 58, col('wood', 2))
        for ly in (54, 56):
            cv.hline(dx0 + 3, dx1 - 3, ly, col('cedar', 4))
        # Colored team locker plaque
        cv.rect(dx0 + 4, 60, dx1 - 4, 63, C(badge_c))
        # Lower kickplate panel
        cv.rect(dx0 + 2, 71, dx1 - 2, 76, col('wood', 3))
        cv.hline(dx0 + 2, dx1 - 2, 71, col('cedar', 5))
        cv.p(dx1 - 3, 65, col('yellow', 5))  # Brass handle
        # Clean unobstructed stone threshold sill reaching street baseline
        cv.hline(dx0, dx1, 77, col('stone', 6))
        cv.hline(dx0, dx1, 78, col('pavement', 4))

    # Full-width street baseline grounding shadow (y=78..79)
    cv.hline(4, 72, 78, col('ink', 1))
    cv.hline(72, 75, 78, col('ink', 1))
    cv.hline(88, 91, 78, col('ink', 1))
    cv.hline(104, 108, 78, col('ink', 1))
    cv.hline(4, 108, 79, col('ink', 0))
    cv.edge_finish(top_y=4)
    return cv


# ---------------------------------------------------------------------------
# Manifest & Runner
# ---------------------------------------------------------------------------

SPECS = [
    {
        'id': 'mf-bldg-camp_school_main',
        'name': '3층 본관 학교 (시계탑·옥상 펜스)',
        'category': 'campus',
        'w': 10, 'h': 8,
        'pxW': 160, 'pxH': 128,
        'passableTopRows': 2,
        'tags': ['campus', 'school', 'high-school', 'clock', 'rooftop-fence', 'non-cloned', 'landmark'],
        'fn': build_camp_school_main,
    },
    {
        'id': 'mf-bldg-camp_brick_library',
        'name': '2.5층 담쟁이 적벽돌 대학 도서관',
        'category': 'campus',
        'w': 8, 'h': 7,
        'pxW': 128, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['campus', 'library', 'brick', 'ivy', 'bookshelves', 'skylight', 'pitched-roof'],
        'fn': build_camp_brick_library,
    },
    {
        'id': 'mf-bldg-camp_gymnasium',
        'name': '학교 실내 체육관·강당',
        'category': 'campus',
        'w': 9, 'h': 6,
        'pxW': 144, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['campus', 'gymnasium', 'auditorium', 'barrel-roof', 'sports', 'clerestory'],
        'fn': build_camp_gymnasium,
    },
    {
        'id': 'mf-bldg-camp_science_greenhouse',
        'name': '과학 실험동 & 유리 식물원 온실',
        'category': 'campus',
        'w': 7, 'h': 6,
        'pxW': 112, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['campus', 'science', 'lab', 'greenhouse', 'botany', 'glass-dome', 'plants'],
        'fn': build_camp_science_greenhouse,
    },
    {
        'id': 'mf-bldg-camp_student_union_terrace',
        'name': '2.5층 학생회관·카페테리아 테라스',
        'category': 'campus',
        'w': 8, 'h': 7,
        'pxW': 128, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['campus', 'student-union', 'cafeteria', 'terrace', 'parasol', 'awning', 'bulletin'],
        'fn': build_camp_student_union_terrace,
    },
    {
        'id': 'mf-bldg-camp_bell_tower',
        'name': '벽돌·석조 캠퍼스 시계 종탑',
        'category': 'campus',
        'w': 4, 'h': 9,
        'pxW': 64, 'pxH': 144,
        'passableTopRows': 2,
        'tags': ['campus', 'bell-tower', 'clock-tower', 'spire', 'ivy', 'archway', 'landmark'],
        'fn': build_camp_bell_tower,
    },
    {
        'id': 'mf-bldg-camp_dormitory',
        'name': '3층 벽돌·크림 학생 기숙사',
        'category': 'campus',
        'w': 7, 'h': 8,
        'pxW': 112, 'pxH': 128,
        'passableTopRows': 2,
        'tags': ['campus', 'dormitory', 'residential', 'balcony', 'laundry', 'bicycle', 'non-cloned'],
        'fn': build_camp_dormitory,
    },
    {
        'id': 'mf-bldg-camp_music_conservatory',
        'name': '2.5층 목재·유리 음악당·예술관',
        'category': 'campus',
        'w': 7, 'h': 7,
        'pxW': 112, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['campus', 'music', 'conservatory', 'arts', 'timber-louvers', 'skylight', 'posters'],
        'fn': build_camp_music_conservatory,
    },
    {
        'id': 'mf-bldg-camp_main_gatehouse',
        'name': '캠퍼스 벽돌·화강암 정문 & 경비실',
        'category': 'campus',
        'w': 7, 'h': 5,
        'pxW': 112, 'pxH': 80,
        'passableTopRows': 1,
        'tags': ['campus', 'gatehouse', 'entrance', 'wrought-iron', 'cherry-blossom', 'security-lodge'],
        'fn': build_camp_main_gatehouse,
    },
    {
        'id': 'mf-bldg-camp_sports_pavilion',
        'name': '운동장 스탠드 관람석 & 락커 하우스',
        'category': 'campus',
        'w': 7, 'h': 5,
        'pxW': 112, 'pxH': 80,
        'passableTopRows': 1,
        'tags': ['campus', 'sports', 'pavilion', 'bleachers', 'scoreboard', 'locker-room'],
        'fn': build_camp_sports_pavilion,
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
