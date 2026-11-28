#!/usr/bin/env python3
"""Modern-Fable Buildings — Pack 07: Transit, Station & Harbor District (10 buildings).

Strictly locked to tiledata/jp-city/fable-city/palette.json via fable_lib.
Top-3/4 RPG camera angle (Fable 5.2 baseline): visible sunlit roof planes & decks,
top-left directional sunlight, warm-violet/slate outlines, lived-in interior window storytelling,
zero cloned floors (passes G4 anti-clone cleanly), rich 45-80 color shading.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from fable_lib import Canvas, col, C, hsh, shade_rgba, OUT_ROOT

BATCH = 'pack07_transit_harbor'
OUT_DIR = os.path.join(OUT_ROOT, 'buildings', BATCH)


# ---------------------------------------------------------------------------
# Crisp 3x5 & 4x5 Pixel Font (for readable transit/harbor signage)
# ---------------------------------------------------------------------------

FONT_3X5 = {
    'A': ['010', '101', '111', '101', '101'],
    'B': ['110', '101', '110', '101', '110'],
    'C': ['011', '100', '100', '100', '011'],
    'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'],
    'F': ['111', '100', '110', '100', '100'],
    'G': ['011', '100', '101', '101', '011'],
    'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'],
    'K': ['101', '101', '110', '101', '101'],
    'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'],
    'N': ['110', '101', '101', '101', '101'],
    'O': ['010', '101', '101', '101', '010'],
    'P': ['110', '101', '110', '100', '100'],
    'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'],
    'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'],
    'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'],
    'Y': ['101', '101', '010', '010', '010'],
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['110', '001', '010', '100', '111'],
    '3': ['110', '001', '010', '001', '110'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '110', '001', '110'],
    '6': ['011', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '110'],
    ' ': ['000', '000', '000', '000', '000'],
    '-': ['000', '000', '111', '000', '000'],
}


def draw_text(cv, x, y, text, color, spacing=1, shadow=None):
    """Draw crisp 3x5 pixel uppercase text."""
    cx = x
    for ch in text.upper():
        pat = FONT_3X5.get(ch)
        if pat is None:
            cx += 3 + spacing
            continue
        for ry, row in enumerate(pat):
            for rx, bit in enumerate(row):
                if bit == '1':
                    if shadow is not None:
                        cv.p(cx + rx, y + ry + 1, shadow)
                    cv.p(cx + rx, y + ry, color)
        cx += (2 if ch == ' ' else 3) + spacing


def text_width(text, spacing=1):
    w = 0
    for i, ch in enumerate(text.upper()):
        w += (2 if ch == ' ' else 3)
        if i < len(text) - 1:
            w += spacing
    return w


# ---------------------------------------------------------------------------
# Shared Architectural Pixel-Art Helpers (100% Fable palette locked)
# ---------------------------------------------------------------------------

def draw_ashlar_wall(cv, x0, y0, x1, y1, ramp='cream', base_i=4, bw=10, bh=5, seed=0):
    """Dignified limestone/stone ashlar masonry with subtle per-block shading."""
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
                cv.p(x, y, col(ramp, min(6, base_i + (1 if r > 0.35 else 0))))
            else:
                t = base_i + (1 if r > 0.78 else (-1 if r < 0.22 else 0))
                cv.p(x, y, col(ramp, max(1, t)))


def draw_corrugated_roof(cv, x0, y0, x1, y1, ramp='tile', rib_w=4, ridge_ramp=None, seed=0, slope_highlight=True):
    """Top-3/4 corrugated metal / standing-seam harbor warehouse roof."""
    if ridge_ramp is None:
        ridge_ramp = ramp
    w = x1 - x0
    h = y1 - y0
    for y in range(max(0, y0), min(cv.h, y1)):
        ry = y - y0
        for x in range(max(0, x0), min(cv.w, x1)):
            rx = x - x0
            if ry == 0:
                cv.p(x, y, col(ridge_ramp, 1) if rx in (0, w - 1) else col(ridge_ramp, 6))
            elif ry == 1:
                cv.p(x, y, col(ridge_ramp, 5 if rx % 3 != 2 else 4))
            elif ry == 2:
                cv.p(x, y, col(ridge_ramp, 2))
            elif ry == h - 1:
                cv.p(x, y, col(ramp, 0))
            elif ry == h - 2:
                cv.p(x, y, col(ramp, 1 if rx % rib_w != 0 else 2))
            else:
                bx = rx % rib_w
                bi = rx // rib_w
                r = hsh(bi, ry // 5, seed)
                right_sh = 1 if rx >= w - 4 else 0
                upper_hi = 1 if (slope_highlight and ry < h // 2) else 0
                if bx == 0:
                    t = 4 + upper_hi + (1 if r > 0.72 else 0)
                    cv.p(x, y, col(ramp, max(1, min(6, t - right_sh))))
                elif bx == rib_w - 1:
                    cv.p(x, y, col(ramp, max(0, 1 - right_sh)))
                else:
                    # Horizontal sheet overlap seam mid-slope
                    if ry == h // 2:
                        cv.p(x, y, col(ramp, 1))
                    else:
                        t = 3 + upper_hi + (1 if r > 0.80 else (-1 if r < 0.20 else 0))
                        cv.p(x, y, col(ramp, max(1, min(5, t - right_sh))))


def draw_arched_window(cv, x0, y0, x1, y1, warm=True, frame='steel:1', arch_ramp='cream', sill='stone:5', seed=0):
    """Multi-pane arched window (classic brick station / canal loft style)."""
    w = x1 - x0
    h = y1 - y0
    cx = (x0 + x1 - 1) / 2.0
    rx_rad = max(2.0, (w - 1) / 2.0)
    arch_h = max(3, min(w // 2, 7))
    cy = y0 + arch_h

    # Optional stone/brick arch hood along upper curve
    for y in range(y0 - 1, cy + 1):
        for x in range(x0 - 1, x1 + 1):
            dx = (x - cx) / (rx_rad + 1.1)
            dy = (y - cy) / (arch_h + 1.1)
            d = dx * dx + dy * dy
            if y <= cy and 0.68 <= d <= 1.08:
                tone = 5 if x < cx else 3
                if abs(x - cx) < 1.3 and y <= y0:
                    tone = 6  # keystone highlight
                cv.p(x, y, col(arch_ramp, tone))

    # Draw arch interior & frame
    for y in range(y0, y1):
        for x in range(x0, x1):
            inside = True
            on_edge = False
            if y < cy:
                dx = (x - cx) / rx_rad
                dy = (y - cy) / max(1.0, float(arch_h))
                d = dx * dx + dy * dy
                if d > 1.05:
                    inside = False
                elif d > 0.68:
                    on_edge = True
            else:
                if x in (x0, x1 - 1) or y == y1 - 1:
                    on_edge = True
            if not inside:
                continue
            if on_edge:
                cv.p(x, y, frame)
            else:
                rx, ry = x - x0 - 1, y - y0 - 1
                if warm:
                    if ry <= 1:
                        cv.p(x, y, col('orange', 2))
                    elif ry > (h * 0.55):
                        cv.p(x, y, col('yellow', 5 if (rx + ry) % 3 == 0 else 4))
                    else:
                        cv.p(x, y, col('orange', 4 if hsh(x, y, seed) > 0.28 else 3))
                else:
                    if ry <= 1:
                        cv.p(x, y, col('glass', 1))
                    elif (rx + ry) in (2, 3, 6):
                        cv.p(x, y, col('glass', 5))
                    else:
                        cv.p(x, y, col('glass', 2 if (rx + ry) % 4 else 3))

    # Mullions
    mx = (x0 + x1) // 2
    cv.vline(mx, y0 + 2, y1 - 1, frame)
    if w >= 12:
        cv.vline(x0 + w // 3, y0 + 3, y1 - 1, frame)
        cv.vline(x0 + (2 * w) // 3, y0 + 3, y1 - 1, frame)
    cv.hline(x0 + 1, x1 - 1, cy, frame)
    if h >= 14:
        cv.hline(x0 + 1, x1 - 1, y0 + (2 * h) // 3, frame)

    # Sill
    if sill:
        cv.hline(x0 - 1, x1 + 1, y1, sill)
        cv.hline(x0, x1, y1 + 1, col('ink', 1))


def draw_porthole(cv, cx, cy, r=4, rim_ramp='steel', warm=False):
    """Crisp circular nautical porthole window with dark outline & metallic bezel."""
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d <= r + 1.35:
                if d >= r + 0.45:
                    cv.p(x, y, col('ink', 0))
                elif d >= r - 0.85:
                    t = 5 if (dx + dy < 0) else (2 if dx + dy > 1 else 3)
                    cv.p(x, y, col(rim_ramp, t))
                elif warm:
                    if dy < -r * 0.35:
                        cv.p(x, y, col('orange', 3))
                    else:
                        cv.p(x, y, col('yellow', 5 if (dx + dy) <= 0 else 4))
                else:
                    if dx + dy <= -1:
                        cv.p(x, y, col('glass', 5))
                    elif dy > 1:
                        cv.p(x, y, col('glass', 3))
                    else:
                        cv.p(x, y, col('glass', 1))


def draw_clock_face(cv, cx, cy, r=10, rim_ramp='wood', hand_color='ink:0'):
    """Glowing round station clock face with dark Roman tick marks and crisp hands."""
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d <= r + 1.7:
                if d >= r + 0.6:
                    cv.p(x, y, col('ink', 0))
                elif d >= r - 0.7:
                    t = 5 if (dx + dy < 0) else 2
                    cv.p(x, y, col(rim_ramp, t))
                elif d >= r - 1.6:
                    cv.p(x, y, col('cream', 2 if dy < 0 else 4))
                else:
                    # Bright warm clock dial
                    cv.p(x, y, col('cream', 6 if dy < r * 0.4 else 5))
    # 12 / 3 / 6 / 9 ticks
    cv.vline(cx, cy - r + 2, cy - r + 4, col('ink', 1))
    cv.vline(cx, cy + r - 3, cy + r - 1, col('ink', 1))
    cv.hline(cx - r + 2, cx - r + 4, cy, col('ink', 1))
    cv.hline(cx + r - 3, cx + r - 1, cy, col('ink', 1))
    # Corner hour dots
    off = int(r * 0.56)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cv.p(cx + sx * off, cy + sy * off, col('stone', 2))
    # Hour hand (~10 o'clock) & minute hand (~2 o'clock)
    for i in range(1, max(3, r - 4)):
        cv.p(cx - i, cy - (i * 2) // 3, hand_color)
    for i in range(1, max(4, r - 2)):
        cv.p(cx + i, cy - (i * 3) // 4, hand_color)
    cv.p(cx, cy, col('red', 3))


def draw_car_top34(cv, x, y, w=20, h=12, ramp='red', facing_front=True, headlights=False):
    """Crisp top-3/4 parked car (rooftop deck or garage deck view)."""
    # Ground cast shadow
    cv.rect(x + 1, y + h - 2, x + w + 1, y + h + 1, col('ink', 1))
    # Wheels peeking on left/right bottom
    cv.rect(x + 1, y + h - 3, x + 4, y + h, col('kuro', 0))
    cv.rect(x + w - 4, y + h - 3, x + w - 1, y + h, col('kuro', 0))
    # Lower body
    cv.outline_box(x, y + 4, x + w, y + h - 1, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 5), bot_sh=col(ramp, 1))
    # Upper cabin roof (top-3/4 visible sunlit car roof!)
    cv.outline_box(x + 2, y, x + w - 2, y + 6, col(ramp, 4), col(ramp, 0), top_hi=col(ramp, 5))
    # Windshield
    if facing_front:
        cv.rect(x + 3, y + 3, x + w - 3, y + 6, col('glass', 2))
        cv.hline(x + 4, x + w - 5, y + 4, col('glass', 5))
        # Grille & headlights
        cv.rect(x + 6, y + h - 4, x + w - 6, y + h - 2, col('steel', 1))
        hl_col = col('yellow', 5) if headlights else col('cream', 5)
        cv.rect(x + 2, y + h - 4, x + 5, y + h - 2, hl_col)
        cv.rect(x + w - 5, y + h - 4, x + w - 2, y + h - 2, hl_col)
        if headlights:
            cv.p(x + 3, y + h - 2, col('yellow', 4))
            cv.p(x + w - 4, y + h - 2, col('yellow', 4))
    else:
        # Rear view with taillights
        cv.rect(x + 3, y + 3, x + w - 3, y + 6, col('glass', 1))
        cv.hline(x + 4, x + w - 6, y + 4, col('glass', 4))
        cv.rect(x + 2, y + h - 4, x + 5, y + h - 2, col('red', 4))
        cv.rect(x + w - 5, y + h - 4, x + w - 2, y + h - 2, col('red', 4))
        cv.rect(x + w // 2 - 2, y + h - 4, x + w // 2 + 2, y + h - 2, col('white', 5))


def draw_car_side_deck(cv, x, y, w=22, h=13, ramp='blue'):
    """Side-3/4 rooftop parked car (shows roof, side windows, hood, wheels)."""
    cv.rect(x + 1, y + h - 2, x + w + 1, y + h, col('ink', 1))
    # Lower body
    cv.outline_box(x, y + 5, x + w, y + h - 2, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 5), bot_sh=col(ramp, 1))
    # Cabin roof + windows
    cv.outline_box(x + 4, y + 1, x + w - 5, y + 6, col(ramp, 5), col(ramp, 0), top_hi=col(ramp, 6))
    cv.rect(x + 5, y + 3, x + w // 2 - 1, y + 6, col('glass', 4))
    cv.rect(x + w // 2 + 1, y + 3, x + w - 6, y + 6, col('glass', 3))
    cv.p(x + 6, y + 4, col('glass', 6))
    # Headlight & taillight
    cv.rect(x + 1, y + 6, x + 3, y + 8, col('yellow', 5))
    cv.rect(x + w - 3, y + 6, x + w - 1, y + 8, col('red', 4))
    # Wheels
    for wx in (x + 3, x + w - 7):
        cv.rect(wx, y + h - 4, wx + 4, y + h, col('kuro', 0))
        cv.rect(wx + 1, y + h - 3, wx + 3, y + h - 1, col('steel', 5))


def draw_life_ring(cv, cx, cy, r=4):
    """Red-and-white maritime life-ring buoy."""
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = math.hypot(x - cx, y - cy)
            if r - 1.6 <= d <= r + 0.35:
                band = (abs(x - cx) <= 1) or (abs(y - cy) <= 1)
                if band:
                    cv.p(x, y, col('red', 4 if y <= cy else 2))
                else:
                    cv.p(x, y, col('white', 6 if y <= cy else 4))
            elif r + 0.35 < d <= r + 0.9:
                cv.p(x, y, col('ink', 1))


def draw_bollard(cv, x, y, rope=True):
    """Timber harbor mooring bollard wrapped in coiled hemp rope."""
    cv.outline_box(x, y, x + 5, y + 9, col('wood', 3), col('wood', 0), top_hi=col('wood', 5))
    cv.hline(x + 1, x + 4, y + 1, col('wood', 6))
    if rope:
        cv.hline(x, x + 5, y + 3, col('straw', 4))
        cv.hline(x, x + 5, y + 4, col('straw', 2))
        cv.hline(x, x + 5, y + 5, col('straw', 5))
    cv.hline(x, x + 6, y + 9, col('ink', 1))


def draw_parasol(cv, cx, cy, rx=11, ramp_a='blue', ramp_b='white'):
    """Top-3/4 coastal patio/terrace umbrella parasol with shadow and pole."""
    # Pole shadow & pole
    cv.vline(cx, cy + 4, cy + 12, col('wood', 2))
    cv.vline(cx + 1, cy + 4, cy + 12, col('ink', 1))
    # Scalloped conical umbrella top
    for dy in range(-5, 5):
        span = int(rx * (1.0 - max(0, (-dy - 1)) * 0.16))
        if dy == -5:
            span = max(2, rx // 4)
        for dx in range(-span, span + 1):
            x, y = cx + dx, cy + dy
            seg = int((dx + span) / max(1, (2 * span) / 5.0))
            use_a = (seg % 2 == 0)
            rmp = ramp_a if use_a else ramp_b
            if dy == 4:
                cv.p(x, y, col(rmp, 1 if dx % 3 != 0 else 0))
            elif abs(dx) == span or dy == -5:
                cv.p(x, y, col(rmp, 1))
            elif dy < -1:
                cv.p(x, y, col(rmp, 5 if use_a else 6))
            else:
                sh = 1 if dx > span // 2 else 0
                cv.p(x, y, col(rmp, max(1, (4 if use_a else 5) - sh)))
    cv.p(cx, cy - 5, col('yellow', 5))  # wooden finial tip


def draw_string_lights(cv, x0, x1, y_top, sag=5):
    """Festoon catenary string lights with warm glowing amber bulbs."""
    span = max(1, x1 - x0)
    for x in range(x0, x1 + 1):
        t = (x - x0) / span
        dy = int(round(4.0 * sag * t * (1.0 - t)))
        y = y_top + dy
        cv.p(x, y, col('ink', 1))
        if (x - x0) % 6 == 3 and x0 + 2 < x < x1 - 2:
            cv.p(x, y + 1, col('yellow', 5))
            cv.p(x, y + 2, col('orange', 4))
            cv.p(x - 1, y + 1, col('yellow', 4))


def draw_smoke_wisp(cv, x, y):
    """Delicate soft pixel chimney smoke plume."""
    pts = [
        (0, 0, 'white:4'), (1, 0, 'white:5'),
        (1, -1, 'white:5'), (2, -1, 'white:6'), (3, -1, 'white:4'),
        (3, -2, 'white:5'), (4, -2, 'white:6'), (5, -2, 'white:4'),
        (5, -3, 'coolwhite:4'), (6, -3, 'white:5'),
    ]
    for dx, dy, c in pts:
        cv.p(x + dx, y + dy, c)


def draw_wooden_crate(cv, x, y, w=10, h=8, ramp='cedar'):
    cv.outline_box(x, y, x + w, y + h, col(ramp, 4), col(ramp, 0), top_hi=col(ramp, 5), bot_sh=col(ramp, 2))
    cv.hline(x + 1, x + w - 1, y + h // 2, col(ramp, 2))
    cv.vline(x + w // 2, y + 1, y + h - 1, col(ramp, 2))


def draw_noren(cv, x0, y0, x1, y1, ramp='red', panels=4, accent='cream:5'):
    """Split fabric noren curtain with crisp gaps & emblem dots."""
    w = x1 - x0
    pw = max(4, w // panels)
    for i in range(panels):
        px0 = x0 + i * pw
        px1 = min(x1, px0 + pw - 1)
        if px1 <= px0 + 1:
            continue
        cv.rect(px0, y0, px1, y1, col(ramp, 3))
        cv.hline(px0, px1, y0, col(ramp, 1))
        cv.hline(px0, px1, y0 + 1, col(ramp, 4))
        cv.hline(px0, px1, y1 - 1, col(ramp, 1))
        cv.vline(px0, y0, y1, col(ramp, 2))
        mx = (px0 + px1) // 2
        my = (y0 + y1) // 2
        if px1 - px0 >= 5 and y1 - y0 >= 5:
            cv.p(mx, my, accent)
            cv.p(mx - 1, my, accent)
            cv.p(mx, my - 1, accent)


# ===========================================================================
# 1. mf-bldg-tr_train_station_clock (160x112)
# ===========================================================================

def build_tr_train_station_clock():
    cv = Canvas(160, 112)
    W, H = cv.w, cv.h

    # --- Sweeping pitched dark-slate/teal side roofs (y=18..48) ---
    cv.pitched_roof(2, 18, 158, 48, ramp='kawara', ridge_hi=True, moss_rate=0.03, seed=701)
    # Decorative teal-copper fascia eaves & snow-guard rail along roof
    cv.hline(2, 158, 18, col('teal', 4))
    cv.hline(3, 157, 19, col('teal', 5))
    cv.hline(2, 158, 46, col('teal', 2))
    cv.hline(2, 158, 47, col('teal', 1))
    cv.hline(2, 158, 48, col('ink', 0))
    # Cute rooftop ridge vents / finials on left & right wings
    for vx in (24, 130):
        cv.outline_box(vx, 12, vx + 8, 20, col('teal', 3), col('teal', 0), top_hi=col('teal', 5))
        cv.hline(vx + 1, vx + 7, 15, col('teal', 1))
        cv.vline(vx + 3, 9, 12, col('steel', 4))
        cv.p(vx + 3, 8, col('yellow', 5))

    # --- Central Gabled Clock Tower (x=54..106, y=2..48) ---
    # Thick shaded dark-teal/slate pitched gable bargeboards framing cream stone pediment
    cx = 80
    for row in range(21):
        y = 3 + row
        half = 2 + int(row * 1.38)
        x0, x1 = max(51, cx - half), min(109, cx + half + 1)
        for x in range(x0, x1):
            dist_edge = min(x - x0, (x1 - 1) - x)
            if dist_edge == 0:
                cv.p(x, y, col('ink', 0))
            elif dist_edge <= 3:
                # Thick teal-copper/slate pitched gable roof slope!
                if x < cx:
                    cv.p(x, y, col('teal', 5 if dist_edge == 1 else (4 if dist_edge == 2 else 2)))
                else:
                    cv.p(x, y, col('teal', 2 if dist_edge == 1 else (3 if dist_edge == 2 else 1)))
            elif dist_edge == 4:
                cv.p(x, y, col('stone', 2))  # gable soffit shadow onto cream pediment
            elif y < 9:
                cv.p(x, y, col('teal', 3 if x < cx else 2))
            else:
                # Cream-stone gabled pediment face inside the clock gable
                cv.p(x, y, col('cream', 4 if (x + y) % 5 else 5))
    # Finial spire atop gable
    cv.vline(cx, 0, 4, col('steel', 5))
    cv.p(cx, 1, col('yellow', 5))
    cv.p(cx - 1, 3, col('teal', 5))
    cv.p(cx + 1, 3, col('teal', 2))

    # Clock tower brick-and-stone body (x=56..104, y=22..52)
    draw_ashlar_wall(cv, 56, 22, 104, 52, ramp='cream', base_i=4, bw=8, bh=5, seed=702)
    cv.vline(56, 22, 52, col('ink', 1))
    cv.vline(103, 22, 52, col('ink', 0))
    cv.hline(54, 106, 22, col('cream', 6))
    cv.hline(54, 106, 23, col('stone', 2))
    # Decorative corner pilasters on clock tower
    cv.rect(57, 23, 61, 51, col('cream', 5))
    cv.vline(61, 23, 51, col('stone', 2))
    cv.rect(99, 23, 103, 51, col('cream', 3))
    cv.vline(98, 23, 51, col('stone', 2))
    # Glowing Round Station Clock
    draw_clock_face(cv, 80, 35, r=10, rim_ramp='wood')

    # --- Main Concourse 2F Red-Brick & Cream-Stone Wall (x=4..156, y=49..74) ---
    cv.brick_wall(4, 49, 156, 75, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=703)
    # Cast shadow from roof eaves
    cv.hline(4, 156, 49, col('ink', 1))
    cv.hline(4, 156, 50, col('brick', 1))
    # Cream-stone corner quoins & central pilasters
    for qy in range(50, 74, 4):
        qw = 5 if ((qy // 4) % 2 == 0) else 3
        cv.rect(4, qy, 4 + qw, qy + 3, col('cream', 5))
        cv.hline(4, 4 + qw, qy + 3, col('stone', 2))
        cv.rect(156 - qw, qy, 156, qy + 3, col('cream', 3))
        cv.hline(156 - qw, 156, qy + 3, col('stone', 1))
    # Stone stringcourse cornice between 2F and 1F
    cv.rect(3, 73, 157, 77, col('cream', 5))
    cv.hline(3, 157, 73, col('cream', 6))
    cv.hline(3, 157, 75, col('stone', 3))
    cv.hline(3, 157, 76, col('ink', 1))

    # 2F Arched Windows (left wing x=14..52, right wing x=108..146)
    draw_arched_window(cv, 14, 53, 28, 70, warm=True, frame='wood:0', arch_ramp='cream', sill='cream:5', seed=11)
    draw_arched_window(cv, 34, 53, 48, 70, warm=False, frame='wood:0', arch_ramp='cream', sill='cream:5', seed=12)
    draw_arched_window(cv, 112, 53, 126, 70, warm=True, frame='wood:0', arch_ramp='cream', sill='cream:5', seed=13)
    draw_arched_window(cv, 132, 53, 146, 70, warm=True, frame='wood:0', arch_ramp='cream', sill='cream:5', seed=14)
    # Central 2F cream bay + glowing STATION name fascia signboard
    draw_ashlar_wall(cv, 54, 49, 106, 73, ramp='cream', base_i=4, bw=8, bh=4, seed=704)
    cv.outline_box(57, 53, 103, 68, col('navy', 2), col('ink', 0), top_hi=col('navy', 4), bot_sh=col('navy', 1))
    cv.outline_box(59, 55, 101, 66, col('navy', 1), col('yellow', 4))
    tw = text_width('STATION', spacing=1)
    draw_text(cv, 80 - tw // 2, 58, 'STATION', col('cream', 6), spacing=1, shadow=col('navy', 0))
    # Small flanking bronze wall sconces
    for sx in (51, 108):
        cv.rect(sx, 57, sx + 2, 62, col('steel', 1))
        cv.p(sx, 58, col('yellow', 5))
        cv.p(sx + 1, 59, col('orange', 4))

    # --- 1F Concourse, Wide Arched Glass Portico & Ticket Gates (y=77..111) ---
    draw_ashlar_wall(cv, 4, 77, 156, 109, ramp='cream', base_i=3, bw=9, bh=5, seed=705)
    # Lower brick dado plinth on wings
    cv.brick_wall(4, 96, 52, 109, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=706)
    cv.brick_wall(108, 96, 156, 109, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=707)

    # Wide Sweeping Teal-Copper Canopy over 1F wings & portico
    cv.rect(2, 75, 158, 83, col('teal', 3))
    for rx in range(2, 158):
        cv.p(rx, 75, col('teal', 5))
        cv.p(rx, 76, col('teal', 4 if rx % 4 != 0 else 5))
        cv.p(rx, 77, col('teal', 3 if rx % 4 != 0 else 2))
        cv.p(rx, 78, col('teal', 3 if rx % 4 != 0 else 1))
        cv.p(rx, 79, col('teal', 2))
        cv.p(rx, 80, col('teal', 1))
        cv.p(rx, 81, col('ink', 0))
        cv.p(rx, 82, col('ink', 1))

    # Central Wide Arched Glass Entry Portico (x=52..108, y=75..110)
    # Raised stone portico frame
    cv.rect(50, 74, 55, 110, col('cream', 5))
    cv.vline(50, 74, 110, col('ink', 1))
    cv.vline(54, 74, 110, col('stone', 2))
    cv.rect(105, 74, 110, 110, col('cream', 3))
    cv.vline(105, 74, 110, col('stone', 2))
    cv.vline(109, 74, 110, col('ink', 0))
    # Portico arched glass transom + glowing ticket hall interior
    cv.rect(55, 76, 105, 108, col('yellow', 4))
    for y in range(76, 108):
        for x in range(55, 105):
            if y < 84:
                # Curved glass fanlight transom
                dx = (x - 80) / 25.0
                dy = (y - 84) / 8.0
                if dx * dx + dy * dy > 1.0:
                    cv.p(x, y, col('teal', 3 if y < 80 else 2))
                elif dx * dx + dy * dy > 0.82:
                    cv.p(x, y, col('steel', 1))
                else:
                    cv.p(x, y, col('glass', 5 if (x + y) % 4 == 0 else 4))
            elif y < 94:
                # Warm lit ticket concourse upper glow + LED departure board
                cv.p(x, y, col('orange', 4 if y < 88 else 5))
            else:
                # Bright floor glow inside concourse
                cv.p(x, y, col('cream', 5 if (x // 4 + y // 3) % 2 == 0 else 4))
    # Fanlight radial muntins
    cv.hline(55, 105, 84, col('steel', 1))
    cv.vline(68, 78, 84, col('steel', 1))
    cv.vline(80, 76, 84, col('steel', 1))
    cv.vline(92, 78, 84, col('steel', 1))
    # Hanging LED departure display inside concourse
    cv.outline_box(66, 86, 94, 92, col('kuro', 0), col('steel', 2))
    cv.hline(68, 76, 88, col('yellow', 5))
    cv.hline(78, 91, 88, col('green', 4))
    cv.hline(68, 84, 90, col('orange', 4))
    # 3 Automatic IC Ticket Gates glowing inside!
    for gx in (61, 74, 87):
        cv.outline_box(gx, 96, gx + 7, 107, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5))
        cv.rect(gx + 1, 97, gx + 6, 100, col('blue', 3))
        cv.p(gx + 3, 98, col('green', 5))  # glowing green entry arrow
        cv.p(gx + 2, 102, col('red', 4))   # red flapper gate edge
        cv.p(gx + 5, 102, col('red', 4))
    # Side sliding glass door panels framing portico
    cv.vline(55, 84, 108, col('steel', 1))
    cv.vline(104, 84, 108, col('steel', 1))
    cv.rect(56, 85, 60, 107, col('glass', 3))
    cv.vline(57, 86, 106, col('glass', 5))
    cv.rect(100, 85, 104, 107, col('glass', 3))
    cv.vline(101, 86, 106, col('glass', 5))

    # Left Wing (x=8..48): Ticket Booth Window + Red Postbox + Timetable Bench
    cv.outline_box(10, 84, 34, 98, col('orange', 3), col('wood', 0))
    cv.window(11, 85, 33, 97, style='warm', frame='wood:1', sill='stone:5', seed=21)
    # Counter silhouette inside ticket window
    cv.hline(12, 32, 95, col('wood', 3))
    cv.rect(17, 92, 23, 95, col('cream', 5))  # ticket counter screen
    # Wooden waiting bench below
    cv.outline_box(11, 101, 33, 107, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.vline(13, 106, 109, col('steel', 1))
    cv.vline(30, 106, 109, col('steel', 1))
    # Classic Red Postbox (x=38..45)
    cv.outline_box(38, 93, 45, 108, col('red', 3), col('red', 0), top_hi=col('red', 5))
    cv.hline(39, 44, 96, col('ink', 0))
    cv.rect(39, 98, 44, 100, col('cream', 5))

    # Right Wing (x=112..152): Station Kiosk + Magazine Rack + Vending Machine
    cv.outline_box(113, 84, 138, 108, col('cream', 4), col('wood', 0))
    cv.window(114, 85, 137, 97, style='warm', frame='wood:1', sill=None, seed=22)
    # Colorful goods & bottles on kiosk shelf
    for i, rc in enumerate(['red:4', 'blue:4', 'green:4', 'yellow:5', 'orange:4', 'pink:4']):
        cv.rect(116 + i * 3, 93, 118 + i * 3, 96, rc)
    cv.rect(114, 98, 137, 107, col('wood', 4))
    cv.hline(114, 137, 98, col('cedar', 5))
    # Mini magazine rack on front of kiosk
    for i, mc in enumerate(['yellow:4', 'red:4', 'blue:4', 'green:4']):
        cv.rect(116 + i * 5, 100, 120 + i * 5, 105, mc)
    # Station drink vending machine on far right (x=141..152)
    cv.outline_box(141, 86, 152, 108, col('coolwhite', 4), col('steel', 0), top_hi=col('white', 6))
    cv.rect(143, 88, 150, 96, col('glass', 5))
    for rx in range(144, 150, 2):
        cv.p(rx, 90, col('red', 4))
        cv.p(rx, 93, col('blue', 4))
    cv.rect(143, 99, 150, 105, col('steel', 2))

    # Stone station entry steps & grounding base (y=108..112)
    cv.rect(3, 108, 157, 112, col('pavement', 4))
    cv.hline(3, 157, 108, col('concrete', 5))
    cv.hline(50, 110, 108, col('cream', 6))
    cv.hline(50, 110, 110, col('stone', 4))
    cv.hline(3, 157, 111, col('ink', 0))
    cv.edge_finish(top_y=48)
    return cv


# ===========================================================================
# 2. mf-bldg-tr_subway_plaza (96x80)
# ===========================================================================

def build_tr_subway_plaza():
    cv = Canvas(96, 80)
    W, H = cv.w, cv.h

    # --- Sculptural Sloped Translucent Glass Roof Canopy (x=18..94, y=3..35) ---
    # Dramatic swept glass-and-steel pavilion canopy (angled aerodynamic wing top-3/4!)
    for y in range(3, 34):
        # Swept sculptural silhouette: cantilevers wider toward the front fascia!
        x0 = 20 + max(0, (14 - y) // 2)
        x1 = 94 - max(0, (10 - y) // 2)
        for x in range(x0, x1):
            if y == 3 or x == x0 or x == x1 - 1:
                cv.p(x, y, col('steel', 1))
            elif y == 4:
                cv.p(x, y, col('coolwhite', 5))
            elif y >= 30:
                # Sleek dark steel fascia front beam
                cv.p(x, y, col('steel', 2 if y == 30 else (1 if y < 33 else 0)))
            else:
                # Angled structural dark steel ribs radiating cleanly across the sloped glass
                rel = (x - 21 - (30 - y) // 6) % 14
                if rel in (0, 1):
                    cv.p(x, y, col('steel', 1 if rel == 0 else 4))
                elif y in (11, 20):
                    cv.p(x, y, col('steel', 2))
                else:
                    # Translucent sky-reflecting glass with diagonal specular streaks + warm interior hint near bottom
                    diag = (x + y * 2) % 17
                    if diag in (0, 1, 2):
                        cv.p(x, y, col('glass', 6))
                    elif diag in (3, 4, 8):
                        cv.p(x, y, col('glass', 5))
                    elif y < 12:
                        cv.p(x, y, col('glass', 4))
                    elif y < 21:
                        cv.p(x, y, col('glass', 3))
                    else:
                        cv.p(x, y, col('teal', 3) if (x % 7 == 0) else col('glass', 2))
    # Bright cyan-blue accent trim stripe along canopy fascia + warm soffit under-glow
    cv.hline(20, 94, 31, col('blue', 4))
    cv.hline(20, 94, 32, col('blue', 3))
    cv.hline(25, 88, 33, col('yellow', 4))

    # --- Illuminated Metro Line Badge Pylon (left side x=4..18, y=10..76) ---
    cv.outline_box(4, 10, 18, 76, col('steel', 2), col('ink', 0), top_hi=col('steel', 5), bot_sh=col('steel', 1))
    # Vertical brushed-steel highlight
    cv.vline(5, 11, 75, col('steel', 4))
    cv.vline(16, 11, 75, col('steel', 1))
    # Glowing circular Metro 'M' emblem at top of pylon (cx=11, cy=21, r=5)
    for y in range(15, 28):
        for x in range(5, 17):
            d = math.hypot(x - 11, y - 21)
            if d <= 5.2:
                if d >= 4.2:
                    cv.p(x, y, col('white', 6))
                else:
                    cv.p(x, y, col('blue', 3 if y > 21 else 4))
    # Crisp white 'M' inside circle
    draw_text(cv, 10, 19, 'M', col('white', 6))
    # Colored transit line indicator bars (Line 1 Blue, Line 2 Orange, Line 3 Green)
    cv.rect(6, 29, 16, 32, col('orange', 4))
    cv.rect(6, 33, 16, 36, col('green', 4))
    # Glowing backlit transit route map panel
    cv.outline_box(6, 39, 16, 62, col('cream', 5), col('steel', 0), top_hi=col('white', 6))
    cv.hline(8, 14, 43, col('blue', 3))
    cv.hline(8, 14, 48, col('orange', 4))
    cv.hline(8, 14, 53, col('green', 3))
    for sy in (43, 48, 53):
        cv.p(9, sy, col('white', 6))
        cv.p(13, sy, col('white', 6))
    cv.hline(7, 15, 58, col('steel', 3))
    # Pylon granite plinth
    cv.outline_box(3, 72, 19, 77, col('concrete', 4), col('ink', 0), top_hi=col('concrete', 6))

    # --- Plaza Concrete & Glass Side Enclosures (x=20..92, y=34..76) ---
    # Left & right structural steel columns holding canopy
    for colx in (20, 88):
        cv.outline_box(colx, 34, colx + 5, 76, col('steel', 3), col('ink', 0), top_hi=col('steel', 5))
        cv.vline(colx + 1, 35, 75, col('coolwhite', 4))
    # Overhead illuminated 'METRO' entrance lintel sign
    cv.outline_box(25, 34, 88, 44, col('navy', 2), col('ink', 0), top_hi=col('blue', 4), bot_sh=col('navy', 0))
    # Left glowing orange M badge on lintel
    cv.rect(28, 36, 35, 42, col('orange', 4))
    draw_text(cv, 30, 37, 'M', col('white', 6))
    # 'METRO' crisp LED text
    draw_text(cv, 41, 37, 'METRO', col('white', 6), spacing=1, shadow=col('navy', 0))
    # Crisp downward chevron arrow pointing down into subway portal
    cv.p(75, 37, col('yellow', 5))
    cv.p(79, 37, col('yellow', 5))
    cv.p(76, 38, col('yellow', 5))
    cv.p(78, 38, col('yellow', 5))
    cv.p(77, 39, col('yellow', 5))
    cv.p(77, 40, col('orange', 4))
    # Line badge '1'
    cv.rect(81, 36, 86, 42, col('blue', 4))
    draw_text(cv, 82, 37, '1', col('white', 6))

    # --- Wide Descending Escalator & Stair Portal (x=25..88, y=44..75) ---
    # Deep shadowed interior ceiling & side walls transitioning down into underground
    for y in range(44, 75):
        depth = (y - 44) / 31.0  # 0 at top (deeper underground visible), 1 at bottom (sunlit ground)
        for x in range(25, 88):
            if y < 48:
                # Underside ceiling shadow + warm recessed ceiling fluorescent strips
                if (x in range(32, 44) or x in range(52, 62) or x in range(70, 82)) and y in (45, 46):
                    cv.p(x, y, col('yellow', 5 if y == 45 else 4))
                else:
                    cv.p(x, y, col('ink', 0 if y < 46 else 1))
            elif x < 29 or x >= 84:
                # Side tiled underground tunnel walls (perspective shading: darker deeper in)
                t = 5 if y > 64 else (4 if y > 55 else 2)
                cv.p(x, y, col('coolwhite', t if (y % 4 != 0) else max(0, t - 1)))
                # Warm handrail LED strip along inner wall
                if (x == 28 or x == 84) and y > 50 and y % 2 == 0:
                    cv.p(x, y, col('yellow', 4 if y > 58 else 3))
            elif 29 <= x < 58:
                # Left half: Descending Wide Stairs (sunlit bottom steps -> deep shadow top steps!)
                step_idx = (y - 48) // 3
                sy = (y - 48) % 3
                if y < 53:
                    # Deep underground shadow at bottom of staircase
                    cv.p(x, y, col('steel', 0 if sy == 0 else 1))
                elif y < 60:
                    cv.p(x, y, col('pavement', 1 if sy == 0 else 2))
                elif y < 67:
                    cv.p(x, y, col('concrete', 2 if sy == 0 else (4 if sy == 1 else 3)))
                else:
                    # Sunlit upper plaza stairs!
                    cv.p(x, y, col('concrete', 3 if sy == 0 else (6 if sy == 1 else 5)))
                # Center stainless handrail dividing stairs
                if x == 43 and y >= 50:
                    cv.p(x, y, col('coolwhite', 5 if y > 62 else 3))
                elif x == 44 and y >= 51:
                    cv.p(x, y, col('steel', 1))
            elif 58 <= x < 63:
                # Central escalator balustrade divider
                if x == 58 or x == 62:
                    cv.p(x, y, col('kuro', 0))  # black moving rubber handrail
                else:
                    cv.p(x, y, col('steel', 5 if y > 62 else (4 if y > 54 else 2)))
            else:
                # Right half (x=63..84): Twin Metallic Escalator Steps!
                sy = (y - 48) % 3
                if y < 53:
                    cv.p(x, y, col('steel', 0))
                elif sy == 0:
                    cv.p(x, y, col('steel', 1))
                elif sy == 1:
                    cv.p(x, y, col('steel', 5 if y > 64 else (4 if y > 56 else 2)))
                else:
                    # Yellow safety comb edge on escalator treads
                    if x in (64, 65, 81, 82):
                        cv.p(x, y, col('yellow', 4 if y > 58 else 2))
                    else:
                        cv.p(x, y, col('steel', 3 if (x % 2 == 0) else 2))
    # Escalator outer right balustrade
    cv.vline(82, 50, 75, col('kuro', 0))
    cv.vline(83, 50, 75, col('steel', 4))

    # --- Plaza Granite Apron, Tactile Yellow Paving & Planter (y=75..80) ---
    cv.rect(2, 75, 94, 80, col('pavement', 5))
    cv.hline(2, 94, 75, col('concrete', 6))
    # Tactile yellow braille warning strip across entrance threshold
    for x in range(25, 88):
        cv.p(x, 76, col('yellow', 5 if x % 2 == 0 else 4))
        cv.p(x, 77, col('yellow', 3 if x % 2 == 0 else 4))
    cv.hline(2, 94, 78, col('pavement', 3))
    cv.hline(2, 94, 79, col('ink', 0))
    # Small modern plaza planter tucked on right edge beside column
    cv.planter_box(88, 66, 95, 76, flower='yellow:5', pot_ramp='concrete')

    cv.edge_finish(top_y=34)
    return cv


# ===========================================================================
# 3. mf-bldg-tr_viaduct_shops (144x96)
# ===========================================================================

def build_tr_viaduct_shops():
    cv = Canvas(144, 96)
    W, H = cv.w, cv.h

    # --- Top-3/4 Railway Viaduct Track Bed (y=12..26) ---
    # Back concrete parapet rail
    cv.rect(2, 11, 142, 15, col('concrete', 4))
    cv.hline(2, 142, 11, col('concrete', 1))
    cv.hline(2, 142, 12, col('concrete', 6))
    cv.hline(2, 142, 14, col('concrete', 2))
    # Gravel ballast bed (y=15..25)
    cv.stipple_rect(2, 15, 142, 25, 'stone', 3, 2, 5, seed=710, rate=0.35)
    # Dark timber/concrete sleepers every 6px
    for sx in range(4, 140, 6):
        cv.rect(sx, 16, sx + 3, 24, col('wood', 2))
        cv.vline(sx, 16, 24, col('wood', 1))
    # Twin gleaming steel rails running across viaduct!
    for ry in (17, 22):
        cv.hline(2, 142, ry, col('coolwhite', 5))
        cv.hline(2, 142, ry + 1, col('steel', 1))

    # --- Overhead Steel Catenary Poles & Wires (y=1..26) ---
    for px in (26, 114):
        # H-beam steel mast
        cv.rect(px, 2, px + 4, 27, col('steel', 3))
        cv.vline(px, 2, 27, col('steel', 1))
        cv.vline(px + 1, 2, 27, col('steel', 5))
        cv.vline(px + 3, 2, 27, col('steel', 1))
        # Cross truss arm
        cv.hline(px - 6, px + 10, 5, col('steel', 2))
        cv.hline(px - 6, px + 10, 6, col('steel', 4))
        cv.p(px - 4, 7, col('white', 6))  # ceramic insulator
        cv.p(px + 8, 7, col('white', 6))
        # Diagonal brace
        for i in range(4):
            cv.p(px + 4 + i, 10 - i, col('steel', 2))
            cv.p(px - 1 - i, 10 - i, col('steel', 2))
    # Railway green/red signal box mounted on right catenary mast
    cv.outline_box(120, 7, 125, 16, col('kuro', 0), col('steel', 2))
    cv.p(122, 9, col('red', 2))
    cv.p(122, 13, col('green', 5))
    cv.p(123, 13, col('green', 4))
    # Upper messenger wire & lower contact wire across viaduct
    for x in range(2, 142):
        # Gentle sag between poles x=26 and x=114
        sag = 0
        if 26 <= x <= 114:
            t = (x - 26) / 88.0
            sag = int(round(3.0 * 4.0 * t * (1.0 - t)))
        cv.p(x, 6 + sag // 2, col('steel', 1))
        cv.p(x, 9, col('ink', 1))
        if x % 14 == 0:
            cv.vline(x, 6 + sag // 2, 9, col('steel', 2))

    # --- Heavy Concrete & Steel Rail Bridge Girder Parapet (y=25..39) ---
    cv.rect(1, 25, 143, 39, col('concrete', 4))
    cv.hline(1, 143, 25, col('concrete', 6))
    cv.hline(1, 143, 26, col('concrete', 5))
    cv.hline(1, 143, 28, col('concrete', 2))
    # Riveted steel bridge fascia girder (y=29..36)
    cv.rect(1, 29, 143, 36, col('steel', 3))
    cv.hline(1, 143, 29, col('steel', 5))
    cv.hline(1, 143, 35, col('steel', 1))
    for rx in range(5, 140, 8):
        cv.vline(rx, 30, 35, col('steel', 2))
        cv.p(rx + 2, 31, col('steel', 5))  # rivets
        cv.p(rx + 2, 33, col('steel', 5))
    # Deep soffit overhang shadow onto brick arches
    cv.rect(1, 36, 143, 39, col('concrete', 2))
    cv.hline(1, 143, 38, col('ink', 0))

    # --- Weathered Red-Brick Viaduct Piers & 3 Cozy Shop Arches (y=39..95) ---
    cv.brick_wall(2, 39, 142, 95, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=711)
    cv.hline(2, 142, 39, col('ink', 1))
    cv.hline(2, 142, 40, col('brick', 1))

    # Stone pier bases & subtle weathering moss/conduit pipes between arches
    pier_xs = [(2, 12), (46, 56), (90, 100), (134, 142)]
    for px0, px1 in pier_xs:
        draw_ashlar_wall(cv, px0, 84, px1, 95, ramp='stone', base_i=3, bw=5, bh=4, seed=px0 + 712)
        cv.hline(px0, px1, 84, col('stone', 5))
    # Steel drain conduit & utility meter on middle piers
    cv.vline(49, 40, 92, col('steel', 2))
    cv.vline(50, 40, 92, col('steel', 4))
    cv.outline_box(92, 68, 98, 76, col('coolwhite', 4), col('steel', 0))
    cv.p(94, 71, col('glass', 4))
    cv.p(96, 71, col('red', 4))
    # Moss tufts near pier feet
    for mx in (5, 48, 93, 136):
        cv.p(mx, 92, col('moss', 3))
        cv.p(mx + 1, 93, col('moss', 4))
        cv.p(mx + 2, 93, col('moss', 2))

    # Helper to carve a semicircular stone-rimmed brick viaduct arch
    arches = [
        (12, 46, 'ramen'),
        (56, 90, 'books'),
        (100, 134, 'bar'),
    ]
    for ax0, ax1, kind in arches:
        acx = (ax0 + ax1 - 1) / 2.0
        arad = (ax1 - ax0) / 2.0
        ay_spring = 56
        # Cream/stone voussoir arch ring
        for y in range(41, ay_spring + 1):
            for x in range(ax0 - 3, ax1 + 3):
                dx = (x - acx) / (arad + 2.5)
                dy = (y - ay_spring) / 14.5
                d = dx * dx + dy * dy
                if 0.72 <= d <= 1.06:
                    ang = int((math.atan2(dy, dx) + math.pi) * 6)
                    t = 5 if (ang % 2 == 0 and x < acx) else (4 if ang % 2 == 0 else 3)
                    cv.p(x, y, col('stone', t))
        # Dark arch recess
        for y in range(43, 94):
            for x in range(ax0, ax1):
                if y < ay_spring:
                    dx = (x - acx) / arad
                    dy = (y - ay_spring) / 12.5
                    if dx * dx + dy * dy > 1.0:
                        continue
                    if dx * dx + dy * dy > 0.85:
                        cv.p(x, y, col('ink', 0))
                        continue
                if kind == 'ramen':
                    # Warm glowing amber ramen shop interior
                    cv.p(x, y, col('wood', 1) if y < 52 else col('orange', 4 if y < 74 else 3))
                elif kind == 'books':
                    # Cozy wood-lined book kiosk interior
                    cv.p(x, y, col('darkwood', 1) if y < 52 else col('cedar', 3 if y < 76 else 2))
                else:
                    # Moody intimate evening bar interior
                    cv.p(x, y, col('ink', 0) if y < 53 else col('darkwood', 2))

        # --- ARCH 1: Warm Ramen Stall ---
        if kind == 'ramen':
            # Glowing backlit ramen wooden fascia inside arch
            cv.outline_box(ax0 + 3, 53, ax1 - 3, 62, col('wood', 2), col('ink', 0), top_hi=col('wood', 4))
            draw_text(cv, ax0 + 7, 55, 'RAMEN', col('yellow', 5), spacing=1, shadow=col('red', 1))
            # Red noren curtains fluttering under fascia
            draw_noren(cv, ax0 + 3, 62, ax1 - 3, 72, ramp='red', panels=4, accent='cream:6')
            # Glowing warm counter window behind noren
            cv.rect(ax0 + 3, 72, ax1 - 3, 82, col('yellow', 5))
            cv.hline(ax0 + 3, ax1 - 3, 72, col('orange', 3))
            # Steaming ramen bowls on counter!
            for bx in (ax0 + 7, ax0 + 16, ax0 + 25):
                cv.rect(bx, 78, bx + 5, 81, col('red', 3))
                cv.hline(bx + 1, bx + 4, 78, col('cream', 6))
                cv.p(bx + 2, 76, col('white', 5))
                cv.p(bx + 3, 75, col('white', 4))
            # Wooden counter & 3 round stools
            cv.outline_box(ax0 + 2, 81, ax1 - 2, 92, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 6))
            for stx in (ax0 + 6, ax0 + 15, ax0 + 24):
                cv.outline_box(stx, 86, stx + 5, 89, col('red', 4), col('wood', 0))
                cv.vline(stx + 2, 89, 94, col('steel', 2))
                cv.hline(stx + 1, stx + 4, 93, col('steel', 1))
            # Glowing red chochin paper lantern hanging on left
            cv.outline_box(ax0 + 1, 56, ax0 + 6, 65, col('red', 4), col('ink', 0))
            cv.rect(ax0 + 2, 58, ax0 + 5, 63, col('orange', 5))
            cv.p(ax0 + 3, 60, col('yellow', 5))

        # --- ARCH 2: Cozy Book Kiosk ---
        elif kind == 'books':
            # Tiny warm wooden 'BOOKS' sign tucked under arch crown above awning
            cv.outline_box(ax0 + 5, 48, ax1 - 5, 55, col('green', 1), col('ink', 0), top_hi=col('green', 3))
            draw_text(cv, ax0 + 8, 49, 'BOOKS', col('cream', 6), spacing=1, shadow=col('green', 0))
            # Striped green-and-cream mini awning tucked inside arch
            cv.awning(ax0 + 2, 56, ax1 - 2, 63, ramp_a='green', ramp_b='cream', stripe_w=3)
            # Warm hanging pendant lamp under awning
            cv.vline(ax0 + 17, 62, 66, col('ink', 0))
            cv.rect(ax0 + 15, 66, ax0 + 20, 68, col('yellow', 5))
            # Tall colorful bookshelves lining the kiosk
            cv.rect(ax0 + 3, 64, ax1 - 3, 83, col('wood', 2))
            book_cols = ['red:4', 'blue:4', 'yellow:4', 'green:4', 'cream:5', 'orange:4', 'teal:4', 'pink:4']
            for shelf_y in (66, 72, 78):
                cv.hline(ax0 + 3, ax1 - 3, shelf_y + 4, col('cedar', 4))
                bx = ax0 + 4
                idx = shelf_y
                while bx < ax1 - 5:
                    bw = 2 if (idx % 3 != 0) else 3
                    bh = 4 if (idx % 2 == 0) else 3
                    cv.rect(bx, shelf_y + (4 - bh), bx + bw, shelf_y + 4, book_cols[idx % len(book_cols)])
                    bx += bw + 1
                    idx += 1
            # Wooden bargain book bin & center warm glass entry door
            cv.door_wood(ax0 + 12, 74, ax0 + 22, 93, ramp='wood', glass_top=True)
            draw_wooden_crate(cv, ax0 + 3, 84, w=8, h=9, ramp='cedar')
            cv.rect(ax0 + 4, 83, ax0 + 10, 85, col('cream', 5))  # stacked paperbacks
            draw_wooden_crate(cv, ax0 + 23, 84, w=8, h=9, ramp='cedar')
            cv.rect(ax0 + 24, 83, ax0 + 30, 85, col('blue', 4))

        # --- ARCH 3: Glowing Evening Bar Doorway ---
        else:
            # Cobalt/navy neon 'BAR' sign glowing under dark arch
            cv.outline_box(ax0 + 6, 52, ax1 - 6, 61, col('navy', 1), col('ink', 0), top_hi=col('blue', 4))
            draw_text(cv, ax0 + 11, 54, 'BAR', col('yellow', 5), spacing=1, shadow=col('orange', 2))
            # Dark timber bar paneling
            cv.siding_wall(ax0 + 2, 62, ax1 - 2, 93, ramp='darkwood', base_i=3, horizontal=False, step=3, seed=715)
            # Heavy timber & warm frosted-amber glass bar door on left
            cv.door_wood(ax0 + 4, 65, ax0 + 16, 93, ramp='wood', glass_top=True)
            # Small warm bar window on right showing amber bottles!
            cv.window(ax0 + 19, 66, ax1 - 4, 80, style='warm', frame='darkwood:0', sill='cedar:4', seed=716)
            for i, bc in enumerate(['green:4', 'orange:4', 'red:4', 'yellow:5']):
                cv.vline(ax0 + 21 + i * 2, 74, 78, bc)
            # Brass wall sconce lamp
            cv.rect(ax0 + 16, 67, ax0 + 19, 71, col('yellow', 5))
            cv.p(ax0 + 17, 68, col('white', 6))
            # Tiny chalkboard A-frame menu outside on right
            cv.outline_box(ax0 + 21, 84, ax0 + 29, 93, col('ink', 1), col('cedar', 4))
            cv.hline(ax0 + 23, ax0 + 27, 86, col('cream', 5))
            cv.hline(ax0 + 23, ax0 + 26, 88, col('yellow', 4))
            cv.hline(ax0 + 23, ax0 + 28, 90, col('cream', 4))

    # Grounding cobblestone/pavement sidewalk strip
    cv.rect(2, 93, 142, 96, col('pavement', 4))
    cv.hline(2, 142, 93, col('pavement', 5))
    cv.hline(2, 142, 95, col('ink', 0))
    cv.edge_finish(top_y=25)
    return cv


# ===========================================================================
# 4. mf-bldg-tr_bus_terminal (144x96)
# ===========================================================================

def build_tr_bus_terminal():
    cv = Canvas(144, 96)
    W, H = cv.w, cv.h

    # --- 2F Flat Roof with AC Array & Penthouse (y=4..25) ---
    cv.flat_roof(4, 4, 140, 25, deck_ramp='pavement', deck_i=3, para_ramp='coolwhite', seed=720)
    # 4 neat rooftop AC units in an array on left-center
    for ax in (12, 26, 40, 54):
        cv.roof_ac(ax, 10)
    # Roof skylight strip in center
    cv.outline_box(70, 9, 102, 18, col('glass', 4), col('steel', 1), top_hi=col('glass', 6))
    for sx in range(78, 100, 8):
        cv.vline(sx, 10, 17, col('steel', 2))
    # Stairwell penthouse + radio antenna on right
    cv.roof_penthouse(112, 7, w=18, h=12, ramp='concrete')
    cv.vline(132, 1, 14, col('steel', 4))
    cv.hline(129, 136, 4, col('steel', 5))
    cv.p(132, 1, col('red', 4))

    # --- 2F Upper Facade: Bold Blue/White Fascia & Ribbon Departure Windows (y=25..53) ---
    cv.tile_cladding(4, 25, 140, 53, ramp='coolwhite', base_i=4, cw=6, ch=5, seed=721)
    # Bold deep-navy & blue upper transit fascia band (y=25..34) for razor-sharp white lettering contrast
    cv.rect(4, 25, 140, 34, col('navy', 2))
    cv.hline(4, 140, 25, col('blue', 4))
    cv.hline(4, 140, 26, col('blue', 3))
    cv.hline(4, 140, 33, col('navy', 0))
    # Crisp white fascia lettering 'BUS TERMINAL'
    tw = text_width('BUS TERMINAL', spacing=1)
    draw_text(cv, 72 - tw // 2, 27, 'BUS TERMINAL', col('white', 6), spacing=1, shadow=col('navy', 0))
    # Speed chevron accents on fascia ends
    for off in (0, 4):
        cv.vline(10 + off, 27, 32, col('yellow', 5))
        cv.vline(133 - off, 27, 32, col('yellow', 5))

    # 2F Continuous Ribbon Windows with Glowing Departure Boards inside (y=36..50)
    cv.outline_box(8, 36, 136, 50, col('glass', 1), col('steel', 0))
    for bx in range(9, 135):
        for by in range(37, 49):
            # Mullion dividers every 18px
            if (bx - 9) % 18 == 0:
                cv.p(bx, by, col('steel', 2))
            elif bx in range(18, 42) or bx in range(60, 88) or bx in range(104, 128):
                # Warm backlit interior lounge + LED departure board strip
                if by in (39, 40, 41, 42) and (bx in range(21, 39) or bx in range(63, 85)):
                    # Glowing departure schedule board!
                    cv.p(bx, by, col('kuro', 0) if by == 39 else (col('yellow', 5) if (bx % 3 != 0 and by == 40) else (col('orange', 4) if (bx % 4 != 0 and by == 41) else col('kuro', 1))))
                elif by >= 44:
                    cv.p(bx, by, col('yellow', 4 if (bx + by) % 3 == 0 else 3))
                else:
                    cv.p(bx, by, col('orange', 3 if by < 40 else 4))
            else:
                # Cool sky-reflective office glass bays
                if (bx + by) % 6 in (0, 1):
                    cv.p(bx, by, col('glass', 5))
                else:
                    cv.p(bx, by, col('glass', 2 if by < 44 else 3))
    cv.hline(8, 136, 50, col('concrete', 5))

    # --- 1F Wide Cantilevered Steel Boarding Canopy (x=1..143, y=52..63) ---
    cv.rect(1, 52, 143, 62, col('steel', 4))
    cv.hline(1, 143, 52, col('coolwhite', 5))
    cv.hline(1, 143, 53, col('steel', 5))
    # Bold blue/white transit stripe on cantilevered canopy edge
    cv.rect(1, 55, 143, 59, col('blue', 3))
    cv.hline(1, 143, 56, col('white', 6))
    cv.hline(1, 143, 59, col('navy', 1))
    cv.hline(1, 143, 60, col('steel', 1))
    cv.hline(2, 142, 61, col('ink', 0))
    cv.hline(3, 141, 62, col('ink', 1))  # canopy drop shadow

    # --- 1F Waiting Hall, Glass Facade & Numbered Boarding Bays (y=62..95) ---
    # Recessed concrete & glass ground floor wall
    cv.tile_cladding(6, 62, 138, 92, ramp='concrete', base_i=4, cw=6, ch=5, seed=722)
    cv.hline(6, 138, 62, col('ink', 1))
    cv.hline(6, 138, 63, col('concrete', 2))

    # Left & Right Boarding Bay Columns supporting canopy
    for px in (6, 48, 94, 134):
        cv.outline_box(px, 61, px + 5, 92, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5))
        cv.vline(px + 1, 62, 91, col('white', 5))

    # 3 Hanging Numbered Bus Bay Signs under Canopy ('1', '2', '3')
    bay_centers = [(27, '1'), (71, '2'), (114, '3')]
    for bcx, num in bay_centers:
        cv.vline(bcx - 5, 61, 64, col('steel', 1))
        cv.vline(bcx + 5, 61, 64, col('steel', 1))
        cv.outline_box(bcx - 8, 63, bcx + 9, 71, col('navy', 2), col('ink', 0), top_hi=col('blue', 4))
        cv.rect(bcx - 6, 64, bcx + 1, 70, col('yellow', 5))
        draw_text(cv, bcx - 4, 65, num, col('navy', 0))
        cv.hline(bcx + 3, bcx + 7, 66, col('white', 6))
        cv.hline(bcx + 3, bcx + 6, 68, col('coolwhite', 4))

    # Bay 1 (Left, x=12..46): Glass Waiting Hall with Warm Bench Lights
    cv.window(12, 72, 46, 90, style='warm', frame='steel:1', sill=None, seed=723)
    # Visible bench & warm passengers silhouette inside glass waiting lounge
    cv.rect(15, 84, 43, 88, col('wood', 4))
    cv.hline(15, 43, 84, col('cedar', 5))
    cv.hline(14, 44, 74, col('yellow', 5))  # bright overhead ceiling light tube

    # Bay 2 (Center, x=54..92): Automatic Glass Terminal Entrance + Ticket Kiosk
    cv.door_glass(56, 72, 78, 92, frame='steel:1', warm=True)
    # Ticket vending machine & timetable board beside doors
    cv.outline_box(80, 74, 91, 91, col('blue', 3), col('steel', 0), top_hi=col('blue', 5))
    cv.rect(82, 76, 89, 82, col('glass', 6))
    cv.hline(83, 88, 78, col('navy', 2))
    cv.hline(83, 87, 80, col('orange', 4))
    cv.rect(82, 84, 89, 89, col('steel', 2))

    # Bay 3 (Right, x=100..133): Wide Glass Departure Lounge + Bench Outside
    cv.window(100, 72, 132, 90, style='warm', frame='steel:1', sill=None, seed=724)
    cv.hline(102, 130, 74, col('yellow', 5))
    # Outdoor transit bench, info stand & potted station planters on flanks
    cv.outline_box(103, 85, 121, 91, col('blue', 4), col('steel', 0), top_hi=col('blue', 5))
    cv.vline(105, 90, 93, col('steel', 1))
    cv.vline(118, 90, 93, col('steel', 1))
    cv.outline_box(124, 79, 131, 91, col('cream', 5), col('steel', 1))
    cv.hline(125, 130, 81, col('blue', 3))
    cv.planter_box(1, 82, 9, 92, flower='red:4', pot_ramp='concrete')
    cv.planter_box(135, 82, 143, 92, flower='yellow:5', pot_ramp='concrete')

    # Grounding boarding platform curb + tactile yellow safety edge + asphalt lane hint
    cv.rect(3, 91, 141, 96, col('pavement', 5))
    for x in range(8, 136):
        if x % 8 < 5:
            cv.p(x, 92, col('yellow', 4))
            cv.p(x, 93, col('yellow', 3))
    cv.hline(3, 141, 94, col('asphalt', 2))
    cv.hline(3, 141, 95, col('ink', 0))
    cv.edge_finish(top_y=25)
    return cv


# ===========================================================================
# 5. mf-bldg-tr_parking_garage (112x128)
# ===========================================================================

def draw_rooftop_car_top34(cv, x, y, w=14, h=16, ramp='red', facing_south=True, roof_rack=False):
    """True top-3/4 vertical parked car aligned front-to-back inside parking stall lines."""
    # Ground cast shadow down-right on asphalt tarmac
    cv.rect(x + 2, y + 3, x + w + 1, y + h + 1, col('asphalt', 1))
    cv.hline(x + 1, x + w + 1, y + h, col('ink', 1))
    # Subtle dark tire edges peeking at wheel wells
    cv.rect(x, y + 2, x + 2, y + 5, col('kuro', 0))
    cv.rect(x + w - 2, y + 2, x + w, y + 5, col('kuro', 0))
    cv.rect(x, y + h - 4, x + 2, y + h - 1, col('kuro', 0))
    cv.rect(x + w - 2, y + h - 4, x + w, y + h - 1, col('kuro', 0))
    # Main car hull body (top-left sunlit, right side shaded)
    cv.outline_box(x, y + 1, x + w, y + h, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 4), bot_sh=col(ramp, 1))
    cv.vline(x + 1, y + 2, y + h - 1, col(ramp, 4))
    cv.vline(x + w - 2, y + 2, y + h - 1, col(ramp, 1))

    if facing_south:
        # Rear trunk lip at top (north)
        cv.hline(x + 2, x + w - 2, y + 2, col(ramp, 4))
        cv.p(x + 2, y + 1, col('red', 4))
        cv.p(x + w - 3, y + 1, col('red', 4))
        # Narrow foreshortened rear glass
        cv.rect(x + 2, y + 3, x + w - 2, y + 5, col('glass', 1))
        cv.hline(x + 3, x + w - 4, y + 3, col('glass', 3))
        # Broad sunlit car roof panel!
        cv.outline_box(x + 2, y + 4, x + w - 2, y + 10, col(ramp, 5), col(ramp, 1), top_hi=col(ramp, 6))
        cv.hline(x + 3, x + w - 4, y + 6, col(ramp, 5))
        # Tiny side mirrors
        cv.p(x - 1, y + 10, col(ramp, 2))
        cv.p(x + w, y + 10, col(ramp, 1))
        # Foreshortened sloped front windshield with bright sky glint
        cv.rect(x + 2, y + 10, x + w - 2, y + 13, col('glass', 2))
        cv.hline(x + 3, x + w - 5, y + 10, col('glass', 5))
        cv.p(x + 3, y + 11, col('glass', 6))
        cv.p(x + 4, y + 11, col('glass', 5))
        cv.p(x + 5, y + 12, col('glass', 4))
        # Sloped front hood
        cv.rect(x + 1, y + 13, x + w - 1, y + 15, col(ramp, 4))
        cv.hline(x + 3, x + w - 3, y + 13, col(ramp, 5))
        # Front grille & headlights along bumper
        cv.hline(x + 4, x + w - 4, y + 14, col('steel', 1))
        cv.rect(x + 1, y + 14, x + 4, y + 15, col('cream', 6))
        cv.rect(x + w - 4, y + 14, x + w - 1, y + 15, col('cream', 6))
    else:
        # Parked nose-in (facing north): hood near back, rear tailgate & taillights facing south!
        cv.rect(x + 1, y + 2, x + w - 1, y + 5, col(ramp, 4))
        cv.hline(x + 3, x + w - 3, y + 2, col(ramp, 5))
        # Foreshortened front windshield (away from camera)
        cv.rect(x + 2, y + 4, x + w - 2, y + 6, col('glass', 2))
        cv.hline(x + 3, x + w - 5, y + 4, col('glass', 5))
        # Broad sunlit SUV/hatchback roof panel!
        cv.outline_box(x + 2, y + 6, x + w - 2, y + 12, col(ramp, 5), col(ramp, 1), top_hi=col(ramp, 6))
        if roof_rack:
            cv.vline(x + 3, y + 7, y + 11, col('steel', 2))
            cv.vline(x + w - 4, y + 7, y + 11, col('steel', 2))
            cv.hline(x + 3, x + w - 3, y + 8, col('steel', 4))
            cv.hline(x + 3, x + w - 3, y + 10, col('steel', 4))
        # Foreshortened rear window
        cv.rect(x + 2, y + 12, x + w - 2, y + 14, col('glass', 1))
        cv.hline(x + 3, x + w - 5, y + 12, col('glass', 4))
        # Rear bumper, red taillights & white license plate
        cv.rect(x + 1, y + 14, x + w - 1, y + 15, col(ramp, 3))
        cv.rect(x + 1, y + 14, x + 4, y + 15, col('red', 4))
        cv.rect(x + w - 4, y + 14, x + w - 1, y + 15, col('red', 4))
        cv.rect(x + w // 2 - 2, y + 14, x + w // 2 + 2, y + 15, col('white', 6))


def draw_garage_van(cv, x, y, w=19, h=13, ramp='coolwhite'):
    """Tall boxy delivery van / minivan silhouette inside a garage bay."""
    cv.rect(x + 1, y + h - 2, x + w + 1, y + h + 1, col('ink', 1))
    cv.rect(x + 1, y + h - 3, x + 4, y + h, col('kuro', 0))
    cv.rect(x + w - 4, y + h - 3, x + w - 1, y + h, col('kuro', 0))
    # Tall vertical boxy cabin
    cv.outline_box(x, y, x + w, y + h - 1, col(ramp, 4), col('steel', 0), top_hi=col('white', 6), bot_sh=col('steel', 2))
    # Roof rack bar on top
    cv.hline(x + 3, x + w - 3, y - 1, col('steel', 2))
    cv.p(x + 4, y, col('steel', 1))
    cv.p(x + w - 5, y, col('steel', 1))
    # Wide high windshield with specular reflection
    cv.rect(x + 2, y + 2, x + w - 2, y + 7, col('glass', 2))
    cv.hline(x + 3, x + w - 5, y + 3, col('glass', 5))
    cv.p(x + 4, y + 4, col('glass', 6))
    # Side mirrors
    cv.p(x - 1, y + 5, col('steel', 1))
    cv.p(x + w, y + 5, col('steel', 1))
    # Commercial blue accent stripe + grille + headlights
    cv.hline(x + 1, x + w - 1, y + 8, col('blue', 3))
    cv.rect(x + 6, y + h - 4, x + w - 6, y + h - 2, col('steel', 1))
    cv.rect(x + 2, y + h - 4, x + 5, y + h - 2, col('cream', 6))
    cv.rect(x + w - 5, y + h - 4, x + w - 2, y + h - 2, col('cream', 6))


def draw_garage_turning_car(cv, x, y, ramp='red'):
    """Angled turning car silhouette pulling out of a garage bay toward the left ramp."""
    # Angled ground shadow
    cv.rect(x + 1, y + 9, x + 18, y + 12, col('ink', 1))
    # Rear body angled slightly right-back
    cv.outline_box(x + 4, y + 1, x + 18, y + 7, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 5))
    # Slanted cabin roof
    cv.outline_box(x + 3, y, x + 15, y + 5, col(ramp, 4), col(ramp, 0), top_hi=col(ramp, 6))
    # Skewed lower nose turning left-down
    cv.outline_box(x, y + 4, x + 16, y + 10, col(ramp, 3), col(ramp, 0), top_hi=col(ramp, 5), bot_sh=col(ramp, 1))
    # Angled front windshield + side window
    cv.rect(x + 2, y + 3, x + 11, y + 6, col('glass', 2))
    cv.hline(x + 3, x + 9, y + 4, col('glass', 5))
    cv.rect(x + 12, y + 3, x + 16, y + 6, col('glass', 1))
    # Wheels turned left
    cv.rect(x + 1, y + 8, x + 4, y + 11, col('kuro', 0))
    cv.rect(x + 11, y + 8, x + 14, y + 11, col('kuro', 0))
    cv.rect(x + 15, y + 7, x + 18, y + 10, col('kuro', 0))
    # Headlights & glowing amber left turn blinker!
    cv.rect(x + 1, y + 7, x + 3, y + 9, col('orange', 4))
    cv.p(x, y + 8, col('yellow', 5))
    cv.rect(x + 5, y + 7, x + 9, y + 9, col('steel', 1))
    cv.rect(x + 10, y + 7, x + 13, y + 9, col('yellow', 5))


def draw_garage_suv_rear(cv, x, y, w=17, h=12, ramp='cream'):
    """Boxy rear-facing SUV silhouette with rear-mounted spare tire & taillights."""
    cv.rect(x + 1, y + h - 2, x + w + 1, y + h + 1, col('ink', 1))
    cv.rect(x + 1, y + h - 3, x + 4, y + h, col('kuro', 0))
    cv.rect(x + w - 4, y + h - 3, x + w - 1, y + h, col('kuro', 0))
    cv.outline_box(x, y + 1, x + w, y + h - 1, col(ramp, 4), col('wood', 0), top_hi=col(ramp, 6), bot_sh=col(ramp, 2))
    # Rear glass
    cv.rect(x + 2, y + 2, x + w - 2, y + 6, col('glass', 1))
    cv.hline(x + 3, x + w - 5, y + 3, col('glass', 4))
    # Mounted dark spare tire centered on tailgate
    mx = x + w // 2
    cv.outline_box(mx - 3, y + 5, mx + 3, y + 10, col('kuro', 1), col('kuro', 0), top_hi=col('steel', 3))
    cv.rect(mx - 1, y + 7, mx + 1, y + 8, col('steel', 5))
    # Red vertical SUV taillights
    cv.rect(x + 1, y + 6, x + 3, y + 10, col('red', 4))
    cv.rect(x + w - 3, y + 6, x + w - 1, y + 10, col('red', 4))


def build_tr_parking_garage():
    cv = Canvas(112, 128)
    W, H = cv.w, cv.h

    # --- Rooftop Open-Air Parking Deck (y=4..32) with Vertical Yellow Stalls & 2 Top-3/4 Cars ---
    cv.flat_roof(4, 4, 108, 32, deck_ramp='asphalt', deck_i=4, para_ramp='concrete', seed=730)
    # Crisp vertical yellow parking stall stripes (4 stalls: 10..28, 28..46, 46..64, 64..82)
    for sx in (10, 28, 46, 64, 82):
        cv.vline(sx, 9, 27, col('yellow', 4))
    cv.hline(10, 83, 9, col('yellow', 4))
    # Concrete wheel-stop bars in empty stalls 3 & 4
    for wsx in (50, 68):
        cv.outline_box(wsx, 10, wsx + 10, 12, col('concrete', 5), col('asphalt', 1))
    # Rooftop stair/elevator penthouse on right
    cv.roof_penthouse(86, 7, w=18, h=17, ramp='concrete')
    # Rooftop safety light poles along back parapet
    for lx in (22, 68):
        cv.vline(lx, 2, 10, col('steel', 3))
        cv.hline(lx - 1, lx + 2, 2, col('yellow', 5))
    # 2 Parked Cars in TRUE Top-3/4 Perspective aligned front-to-back inside yellow stall lines!
    draw_rooftop_car_top34(cv, 12, 10, w=14, h=16, ramp='red', facing_south=True)
    draw_rooftop_car_top34(cv, 30, 10, w=14, h=16, ramp='teal', facing_south=False, roof_rack=True)
    # Painted yellow 'P' symbol in empty 3rd rooftop stall & small safety cone in 4th stall
    draw_text(cv, 54, 16, 'P', col('yellow', 4))
    cv.rect(72, 20, 76, 22, col('orange', 3))
    cv.rect(73, 18, 75, 20, col('white', 6))
    cv.p(73, 17, col('orange', 4))
    cv.p(74, 17, col('orange', 4))

    # --- Main Concrete Structure Body (x=4..108, y=32..126) ---
    cv.tile_cladding(4, 32, 108, 126, ramp='concrete', base_i=4, cw=8, ch=5, seed=731)

    # Left Structural Concrete Pier (x=4..15, y=32..96) for crisp 4F/3F/2F Floor Markers!
    cv.rect(4, 32, 15, 96, col('concrete', 4))
    cv.vline(5, 32, 96, col('concrete', 5))
    cv.vline(14, 32, 96, col('concrete', 2))

    # Right Stairwell & Elevator Core Tower (x=86..106, y=32..124) — varied per floor!
    cv.rect(86, 32, 106, 124, col('concrete', 3))
    cv.vline(86, 32, 124, col('concrete', 1))
    # Glass-block stairwell windows with staggered glowing interior stair flights
    stair_floors = [
        (36, 51, True, 'left'),
        (57, 72, False, 'right'),
        (78, 93, True, 'left'),
    ]
    for sy0, sy1, warm, diag_dir in stair_floors:
        cv.window(89, sy0, 103, sy1, style='warm' if warm else 'glass', frame='steel:1', sill='concrete:5', seed=sy0)
        # Diagonal stair flight silhouette inside window
        for i in range(9):
            sx = (91 + i) if diag_dir == 'left' else (101 - i)
            sy = sy0 + 3 + i
            if sy < sy1 - 1:
                cv.p(sx, sy, col('steel', 1))
                cv.p(sx, sy + 1, col('steel', 2))

    # --- Glowing Vertical Blue 'P' Neon Blade Sign on Right Edge (x=99..110, y=34..66) ---
    cv.outline_box(99, 34, 111, 65, col('blue', 3), col('navy', 0), top_hi=col('blue', 5), bot_sh=col('blue', 1))
    cv.outline_box(101, 36, 109, 47, col('white', 6), col('navy', 1))
    draw_text(cv, 104, 39, 'P', col('blue', 2))
    # Glowing indicator bars below 'P'
    cv.rect(101, 49, 109, 54, col('green', 4))
    cv.hline(102, 108, 51, col('white', 6))
    cv.rect(101, 56, 109, 62, col('navy', 2))
    cv.hline(102, 108, 58, col('yellow', 5))
    cv.hline(102, 108, 60, col('yellow', 4))

    # --- 4F, 3F, 2F Varied Parking Decks (Broken-up grid, empty bays, distinct vehicles, pier markers!) ---
    decks = [
        # (y0, floor_label, badge_ramp, bay_specs)
        (34, '4F', 'blue', [
            ('van', 17, 'coolwhite', None, None),          # Tall boxy delivery van
            ('empty_shadow', 42, 'green:5', 'sign', None), # Empty shadowed mid bay!
            ('compact', 67, 'yellow', False, False),       # Narrow compact rear-facing hatchback
        ]),
        (55, '3F', 'teal', [
            ('car', 17, 'navy', True, True),               # Sedan with bright headlights ON!
            ('turning', 42, 'red', None, None),            # Angled car turning out of bay!
            ('empty_shadow', 66, 'green:5', 'arrow', None),# Empty shadowed right bay!
        ]),
        (76, '2F', 'orange', [
            ('ramp', 16, None, None, None),                # Visible concrete internal ramp!
            ('compact', 43, 'teal', True, True),           # Compact car w/ headlights ON
            ('suv', 66, 'cream', None, None),              # Boxy rear-facing SUV w/ spare tire
        ]),
    ]

    for dy0, flbl, badge_ramp, specs in decks:
        dy1 = dy0 + 18
        # Concrete floor slab & shadow spanning bays
        cv.rect(15, dy0, 86, dy0 + 3, col('concrete', 5))
        cv.hline(15, 86, dy0, col('concrete', 6))
        cv.hline(15, 86, dy0 + 2, col('concrete', 2))
        # Crisp floor marker badge (4F / 3F / 2F) on the left concrete pier!
        cv.outline_box(5, dy0 + 5, 14, dy0 + 14, col(badge_ramp, 2), col('ink', 0), top_hi=col(badge_ramp, 4))
        draw_text(cv, 6, dy0 + 7, flbl, col('white', 6), spacing=1)
        # Dark recessed parking deck interior
        cv.rect(15, dy0 + 3, 85, dy1, col('asphalt', 1))
        cv.hline(15, 85, dy0 + 3, col('ink', 0))
        # Ceiling fluorescent strip lights (varied x per floor)
        for lx in (21, 46, 70):
            shift = 2 if flbl == '3F' else (-2 if flbl == '2F' else 0)
            cv.hline(lx + shift, lx + shift + 8, dy0 + 4, col('yellow', 5))
            cv.hline(lx + shift + 1, lx + shift + 7, dy0 + 5, col('cream', 4))
        # Deck concrete columns separating bays (Bay1: 15..38, Bay2: 41..62, Bay3: 65..85)
        for cx in (38, 62):
            cv.rect(cx, dy0 + 3, cx + 3, dy1, col('concrete', 4))
            cv.vline(cx, dy0 + 3, dy1, col('concrete', 2))
            if flbl == '3F' and cx == 62:
                cv.rect(cx, dy0 + 8, cx + 3, dy0 + 12, col('red', 4))  # fire extinguisher box
            elif flbl == '4F' and cx == 38:
                cv.rect(cx, dy0 + 7, cx + 3, dy0 + 10, col('yellow', 4))  # safety stripe
        # Draw varied deck contents per floor
        for item in specs:
            kind = item[0]
            ix = item[1]
            if kind == 'car':
                _, ix, ramp, facing, hl = item
                draw_car_top34(cv, ix, dy0 + 6, w=19, h=11, ramp=ramp, facing_front=facing, headlights=hl)
                if hl:
                    # Subtle headlight glow beams on bay floor
                    cv.hline(ix + 1, ix + 6, dy1 - 2, col('yellow', 4))
                    cv.hline(ix + 13, ix + 18, dy1 - 2, col('yellow', 4))
            elif kind == 'compact':
                _, ix, ramp, facing, hl = item
                draw_car_top34(cv, ix, dy0 + 7, w=15, h=10, ramp=ramp, facing_front=facing, headlights=hl)
            elif kind == 'van':
                _, ix, ramp, _, _ = item
                draw_garage_van(cv, ix, dy0 + 5, w=19, h=12, ramp=ramp)
            elif kind == 'turning':
                _, ix, ramp, _, _ = item
                draw_garage_turning_car(cv, ix, dy0 + 6, ramp=ramp)
            elif kind == 'suv':
                _, ix, ramp, _, _ = item
                draw_garage_suv_rear(cv, ix, dy0 + 5, w=17, h=12, ramp=ramp)
            elif kind == 'empty_shadow':
                # Deep empty shadowed parking bay with back wall depth & vacancy LED!
                cv.rect(ix, dy0 + 6, ix + 18, dy1 - 2, col('asphalt', 0))
                cv.hline(ix, ix + 18, dy0 + 11, col('asphalt', 2))  # recessed back-wall dado
                cv.hline(ix + 2, ix + 16, dy1 - 3, col('concrete', 3))  # concrete wheel bumper
                cv.vline(ix + 9, dy0 + 12, dy1 - 1, col('yellow', 3))   # floor bay stripe
                # Overhead green occupancy LED
                cv.p(ix + 8, dy0 + 5, item[2])
                cv.p(ix + 9, dy0 + 5, col('white', 6))
                if item[3] == 'sign':
                    cv.rect(ix + 3, dy0 + 8, ix + 8, dy0 + 10, col('blue', 3))
                    cv.p(ix + 5, dy0 + 9, col('white', 6))
                else:
                    cv.hline(ix + 5, ix + 13, dy0 + 9, col('yellow', 4))
                    cv.p(ix + 6, dy0 + 8, col('yellow', 4))
            elif kind == 'ramp':
                # Angled concrete up-ramp inside 2F left bay
                for ry in range(dy0 + 5, dy1):
                    rx_end = ix + 4 + (ry - (dy0 + 5)) * 2
                    cv.hline(ix, min(38, rx_end), ry, col('concrete', 3 if ry % 2 == 0 else 4))
                # Yellow-and-black height clearance beam
                cv.outline_box(ix + 1, dy0 + 5, ix + 20, dy0 + 9, col('yellow', 4), col('ink', 0))
                for sx in range(ix + 3, ix + 19, 4):
                    cv.vline(sx, dy0 + 6, dy0 + 8, col('ink', 0))
        # Horizontal slatted steel guard rail & concrete slab parapet across lower opening
        cv.hline(15, 85, dy1 - 3, col('steel', 4))
        cv.hline(15, 85, dy1 - 2, col('steel', 1))
        cv.rect(15, dy1 - 1, 86, dy1 + 2, col('concrete', 4))
        cv.hline(15, 86, dy1 - 1, col('concrete', 6))
        cv.hline(15, 86, dy1 + 1, col('concrete', 2))

    # --- 1F Open Entry/Exit Ramp, Boom Barrier, 'P' Sign & Toll Booth (y=96..127) ---
    # Bold Blue Transit Header Fascia over 1F Entry
    cv.rect(4, 96, 108, 104, col('blue', 2))
    cv.hline(4, 108, 96, col('blue', 4))
    cv.hline(4, 108, 103, col('navy', 0))
    # Glowing 'P' box + 'PARKING' text
    cv.outline_box(8, 97, 17, 103, col('white', 6), col('navy', 0))
    draw_text(cv, 11, 98, 'P', col('blue', 2))
    draw_text(cv, 22, 98, 'PARKING', col('white', 6), spacing=1, shadow=col('navy', 0))
    # Glowing green 'OPEN' indicator LED box
    cv.outline_box(76, 97, 103, 103, col('kuro', 0), col('steel', 3))
    draw_text(cv, 81, 98, 'OPEN', col('green', 5), spacing=1)

    # Open 1F Entry (left x=8..46) & Exit (right x=66..102) Ramp Portals
    cv.rect(8, 104, 46, 125, col('asphalt', 1))
    cv.rect(66, 104, 102, 125, col('asphalt', 1))
    # Recessed garage shadows & bright floor ramps
    for y in range(104, 125):
        t = 1 if y < 110 else (2 if y < 116 else 3)
        cv.hline(8, 46, y, col('asphalt', t))
        cv.hline(66, 102, y, col('asphalt', t))
    # Glowing ceiling lights inside 1F tunnels
    cv.hline(16, 36, 105, col('yellow', 5))
    cv.hline(74, 94, 105, col('yellow', 5))
    # Painted directional lane arrows on asphalt floor
    cv.vline(26, 118, 124, col('white', 5))
    cv.hline(24, 29, 120, col('white', 5))
    cv.vline(84, 118, 124, col('yellow', 4))
    cv.hline(82, 87, 122, col('yellow', 4))

    # Red-and-White Boom Barrier Gate across Left Entry Lane!
    cv.outline_box(40, 113, 46, 125, col('yellow', 4), col('ink', 0), top_hi=col('yellow', 5))
    cv.rect(42, 115, 44, 117, col('red', 4))  # indicator light
    for bx in range(10, 41):
        stripe = ((bx - 10) // 4) % 2 == 0
        cv.p(bx, 116, col('red', 4) if stripe else col('white', 6))
        cv.p(bx, 117, col('red', 2) if stripe else col('coolwhite', 4))
        cv.p(bx, 118, col('ink', 1))

    # Central Glazed Attendant Booth (x=47..65, y=104..125)
    cv.outline_box(47, 104, 65, 125, col('concrete', 4), col('steel', 0), top_hi=col('concrete', 5))
    cv.window(49, 107, 63, 117, style='warm', frame='steel:1', sill='steel:4', seed=735)
    cv.rect(49, 118, 63, 124, col('blue', 3))
    cv.hline(49, 63, 119, col('blue', 5))

    # Yellow/Black Striped Safety Bollards & Street Apron (y=124..128)
    for bx in (5, 47, 64, 103):
        cv.rect(bx, 118, bx + 3, 125, col('yellow', 4))
        cv.hline(bx, bx + 3, 120, col('ink', 0))
        cv.hline(bx, bx + 3, 122, col('ink', 0))
    cv.rect(3, 125, 109, 128, col('pavement', 4))
    cv.hline(3, 109, 125, col('concrete', 5))
    cv.hline(3, 109, 127, col('ink', 0))
    cv.edge_finish(top_y=32)
    return cv


# ===========================================================================
# 6. mf-bldg-hb_ferry_terminal (144x112)
# ===========================================================================

def build_hb_ferry_terminal():
    cv = Canvas(144, 112)
    W, H = cv.w, cv.h

    # --- Marine Radar Mast & Signal Flags atop Central Cupola (y=1..22) ---
    cx = 72
    cv.vline(cx, 2, 22, col('white', 5))
    cv.vline(cx + 1, 2, 22, col('steel', 2))
    # Rotating marine radar scanner bar
    cv.hline(cx - 7, cx + 9, 6, col('white', 6))
    cv.hline(cx - 7, cx + 9, 7, col('steel', 3))
    cv.rect(cx - 1, 5, cx + 3, 9, col('navy', 3))
    # Cross yardarm with colorful nautical signal pennants
    cv.hline(cx - 12, cx + 14, 12, col('steel', 4))
    cv.rect(cx - 10, 13, cx - 6, 16, col('red', 4))
    cv.p(cx - 8, 14, col('white', 6))
    cv.rect(cx + 7, 13, cx + 11, 16, col('yellow', 5))
    cv.p(cx + 9, 14, col('navy', 2))

    # --- Curved Wave-Inspired Blue-Slate Pitched Roof (x=4..140, y=18..46) ---
    for x in range(4, 140):
        # Smooth sweeping wave curve: highest in center (y=18), sweeping down gracefully to y=28 at ends
        nx = (x - 72) / 68.0
        wave_top = int(round(18 + 10 * (nx * nx) - 2 * math.cos(nx * math.pi * 2.0)))
        wave_bot = 44 + int(round(2 * (nx * nx)))
        for y in range(wave_top, wave_bot + 1):
            ry = y - wave_top
            h_col = max(1, wave_bot - wave_top)
            if ry == 0:
                cv.p(x, y, col('coolwhite', 5))  # bright curved ridge cap
            elif ry == 1:
                cv.p(x, y, col('tile', 6))
            elif y == wave_bot:
                cv.p(x, y, col('ink', 0))
            elif y == wave_bot - 1:
                cv.p(x, y, col('navy', 1))
            else:
                # Standing-seam nautical blue-slate ribs every 5px
                rib = (x % 5 == 0)
                upper = (ry < h_col // 2)
                right_sh = 1 if x > 120 else 0
                if rib:
                    cv.p(x, y, col('tile', max(1, (5 if upper else 4) - right_sh)))
                elif x % 5 == 4:
                    cv.p(x, y, col('tile', max(0, 1 - right_sh)))
                else:
                    r = hsh(x // 5, y // 4, 740)
                    t = (4 if upper else 3) + (1 if r > 0.78 else (-1 if r < 0.22 else 0))
                    cv.p(x, y, col('tile', max(1, t - right_sh)))

    # Central Nautical Bridge Clerestory Window embedded in the Wave Roof (x=52..93, y=24..34)
    # Centered symmetrically around cx=72 with 2px white frame margin on both sides (zero overflow!)
    cv.outline_box(52, 24, 93, 34, col('white', 5), col('navy', 0), top_hi=col('white', 6))
    for gx in range(55, 90, 6):
        cv.window(gx, 26, gx + 5, 32, style='glass', frame='navy:1', sill=None, seed=gx)

    # --- 2F Crisp White-and-Navy Nautical Facade & Harbor Lounge (x=6..138, y=45..76) ---
    cv.rect(6, 45, 138, 76, col('white', 5))
    cv.hline(6, 138, 45, col('ink', 1))
    cv.hline(6, 138, 46, col('coolwhite', 3))
    # Subtle horizontal nautical paneling lines
    for y in range(49, 75, 4):
        cv.hline(7, 137, y, col('coolwhite', 4))
    # Bold Navy Maritime Belt Course & 'FERRY' Fascia Band (y=47..55)
    cv.rect(6, 47, 138, 55, col('navy', 2))
    cv.hline(6, 138, 47, col('navy', 4))
    cv.hline(6, 138, 54, col('navy', 0))
    # Gold/yellow maritime stripe
    cv.hline(8, 136, 53, col('yellow', 4))
    tw = text_width('FERRY TERMINAL', spacing=1)
    draw_text(cv, 72 - tw // 2, 48, 'FERRY TERMINAL', col('white', 6), spacing=1, shadow=col('navy', 0))

    # Left & Right Crisp Navy-Rimmed Round Porthole Accent Windows!
    draw_porthole(cv, 20, 65, r=5, rim_ramp='steel', warm=False)
    draw_porthole(cv, 124, 65, r=5, rim_ramp='steel', warm=False)

    # Wide Panoramic Harbor Lounge Glazing (x=32..112, y=57..74) with subtle per-pane variation!
    cv.outline_box(32, 57, 112, 74, col('glass', 1), col('navy', 0))
    for bx in range(33, 111):
        pane = (bx - 33) // 13
        px = (bx - 33) % 13
        for by in range(58, 73):
            if px == 0:
                cv.p(bx, by, col('white', 5))  # crisp white nautical mullions
            elif px == 1:
                cv.p(bx, by, col('navy', 2))
            elif by == 58:
                cv.p(bx, by, col('glass', 1))
            elif pane == 5 and by <= 64:
                # Subtle half-drawn cream slatted shade on rightmost lounge bay
                cv.p(bx, by, col('cream', 5) if by % 2 == 1 else col('coolwhite', 3))
            elif pane == 0 and px in (2, 3):
                # Drawn navy coastal drape along far-left bay edge
                cv.p(bx, by, col('navy', 3 if by % 2 == 0 else 2))
            elif pane == 3 and by <= 66:
                # Taller crisp sky-reflection pane (cool coastal daylight glint)
                diag = (bx + by) % 6
                cv.p(bx, by, col('glass', 6 if diag == 0 else (5 if diag == 1 else 3)))
            elif by >= 64:
                # Warm golden harbor lounge interior glow!
                cv.p(bx, by, col('yellow', 5 if (bx + by) % 4 == 0 else 4) if by > 67 else col('orange', 4))
            else:
                # Sky reflection upper band
                cv.p(bx, by, col('glass', 5 if (bx + by + pane) % 5 in (0, 1) else 3))
    # Subtle lived-in lounge details across varied panes
    # Pane 0: small potted palm silhouette near sill
    cv.rect(39, 70, 43, 73, col('wood', 2))
    cv.rect(38, 67, 44, 70, col('foliage', 2))
    cv.p(40, 66, col('foliage', 4))
    cv.p(42, 67, col('foliage', 3))
    # Pane 2: backlit ferry timetable monitor mounted on lounge wall
    cv.outline_box(62, 63, 70, 69, col('navy', 1), col('steel', 2))
    cv.hline(63, 69, 65, col('yellow', 5))
    cv.hline(63, 68, 67, col('glass', 5))
    # Pane 4: waiting bench & passenger silhouette against warm lounge glow
    cv.hline(88, 97, 71, col('wood', 2))
    cv.rect(90, 68, 94, 71, col('navy', 2))
    cv.rect(91, 66, 93, 68, col('navy', 1))
    # Hanging globe lamps (varied rhythm; omitted behind pane 5 shade)
    for lx, ly in ((40, 61), (53, 62), (66, 60), (79, 61), (92, 62)):
        cv.p(lx, ly, col('white', 6))
        cv.p(lx, ly + 1, col('yellow', 5))
    cv.hline(31, 113, 74, col('coolwhite', 5))

    # --- 1F Warm Boarding Gate Canopy & Maritime Concourse (y=75..111) ---
    # Projecting Crisp White-and-Navy Boarding Canopy
    cv.rect(2, 75, 142, 83, col('white', 5))
    cv.hline(2, 142, 75, col('white', 6))
    cv.rect(2, 77, 142, 80, col('navy', 2))
    cv.hline(2, 142, 78, col('blue', 4))
    cv.hline(2, 142, 81, col('steel', 2))
    cv.hline(2, 142, 82, col('ink', 0))
    # Warm downlights tucked under canopy (flanking center PIER 1 badge cleanly)
    for dlx in (14, 28, 44, 96, 112, 126):
        cv.rect(dlx, 82, dlx + 3, 84, col('yellow', 5))

    # 1F Facade masonry & navy pilasters
    cv.rect(6, 83, 138, 108, col('white', 4))
    for px in (6, 34, 106, 133):
        cv.outline_box(px, 83, px + 5, 108, col('navy', 2), col('navy', 0), top_hi=col('navy', 4))

    # Center Wide Glazed Boarding Gate Entry (x=42..102, y=84..108)
    cv.door_glass(56, 89, 88, 108, frame='navy:1', warm=True)
    # Flanking backlit glass lounge panels
    cv.window(40, 86, 55, 105, style='warm', frame='navy:1', sill='stone:5', seed=741)
    cv.window(89, 86, 104, 105, style='warm', frame='navy:1', sill='stone:5', seed=742)
    cv.outline_box(57, 83, 87, 90, col('navy', 1), col('ink', 0), top_hi=col('blue', 4))
    draw_text(cv, 62, 84, 'PIER 1', col('yellow', 5), spacing=1, shadow=col('navy', 0))

    # Left Quay Wing (x=12..33): Ticket Counter Window + Life Ring Buoy!
    cv.window(13, 87, 32, 99, style='warm', frame='navy:1', sill='white:5', seed=743)
    draw_life_ring(cv, 36, 95, r=4)
    cv.rect(13, 100, 32, 107, col('navy', 3))
    cv.hline(13, 32, 101, col('blue', 4))

    # Right Quay Wing (x=112..132): Harbor Timetable + Luggage Lockers + Bollard
    cv.outline_box(113, 87, 131, 106, col('blue', 3), col('navy', 0), top_hi=col('blue', 5))
    for lx in (115, 121, 127):
        for ly in (89, 95, 101):
            cv.outline_box(lx, ly, lx + 4, ly + 5, col('coolwhite', 4), col('navy', 1))
            cv.p(lx + 2, ly + 2, col('steel', 2))

    # Stone Harbor Quay Promenade & Timber Mooring Bollards (y=107..112)
    cv.rect(2, 107, 142, 112, col('flagstone', 4))
    cv.hline(2, 142, 107, col('concrete', 6))
    cv.hline(2, 142, 111, col('ink', 0))
    draw_bollard(cv, 5, 101, rope=True)
    draw_bollard(cv, 134, 101, rope=True)
    cv.edge_finish(top_y=45)
    return cv


# ===========================================================================
# 7. mf-bldg-hb_coastal_lighthouse (64x144)
# ===========================================================================

def build_hb_coastal_lighthouse():
    cv = Canvas(64, 144)
    W, H = cv.w, cv.h
    cx = 32

    # --- Top Finial & Conical Red Lantern Dome (y=2..17) ---
    cv.vline(cx, 2, 7, col('yellow', 5))
    cv.p(cx, 2, col('white', 6))
    cv.rect(cx - 1, 5, cx + 2, 7, col('yellow', 4))
    for ry in range(11):
        y = 7 + ry
        half = 2 + int(ry * 1.15)
        for x in range(cx - half, cx + half + 1):
            if x in (cx - half, cx + half):
                cv.p(x, y, col('red', 0))
            elif ry == 10:
                cv.p(x, y, col('red', 1))
            else:
                # 3D cylindrical dome shading (lit top-left, deep shadow right)
                nx = (x - cx) / max(1.0, float(half))
                if nx < -0.35:
                    cv.p(x, y, col('red', 5))
                elif nx < 0.25:
                    cv.p(x, y, col('red', 4 if ry % 3 != 0 else 3))
                elif nx < 0.70:
                    cv.p(x, y, col('red', 2))
                else:
                    cv.p(x, y, col('red', 1))

    # --- Bright Glowing Glass Lantern Room (y=18..33) ---
    for y in range(18, 33):
        for x in range(cx - 11, cx + 12):
            if x in (cx - 11, cx + 11):
                cv.p(x, y, col('steel', 0))
            elif y in (18, 32):
                cv.p(x, y, col('steel', 1))
            elif (x - cx) in (-6, 0, 6) or abs(x - cx) == 10:
                cv.p(x, y, col('steel', 2))
            else:
                # Glowing Fresnel lens core in center!
                d = math.hypot((x - cx) * 0.7, y - 25)
                if d < 3.2:
                    cv.p(x, y, col('white', 6))
                elif d < 6.0:
                    cv.p(x, y, col('yellow', 5))
                elif d < 8.5:
                    cv.p(x, y, col('yellow', 4))
                else:
                    cv.p(x, y, col('orange', 4 if (x + y) % 2 == 0 else 3))

    # --- Black Iron Gallery Catwalk & Corbels (y=33..41) ---
    # Railing top bar
    cv.hline(cx - 18, cx + 19, 31, col('steel', 4))
    cv.hline(cx - 18, cx + 19, 32, col('steel', 1))
    # Vertical balusters
    for bx in range(cx - 18, cx + 19, 3):
        cv.vline(bx, 31, 36, col('steel', 1 if bx > cx + 6 else 3))
    # Gallery platform deck
    cv.rect(cx - 19, 36, cx + 20, 39, col('steel', 2))
    cv.hline(cx - 19, cx + 20, 36, col('steel', 5))
    cv.hline(cx - 19, cx + 20, 38, col('ink', 0))
    # Stone corbel brackets under gallery
    for bx in range(cx - 15, cx + 16, 4):
        cv.rect(bx, 39, bx + 2, 41, col('stone', 4 if bx < cx else 2))

    # --- Tapered Red-and-White Banded Masonry Tower (y=41..98) ---
    # 5 distinct crisp alternating maritime bands (red/white/red/white/red) with 3D cylindrical shading
    for y in range(41, 98):
        t_h = (y - 41) / 57.0
        half = int(round(14 + 6.5 * t_h))  # tapers cleanly from 28px to 41px wide!
        band_idx = (y - 41) // 12  # 0:white, 1:red, 2:white, 3:red, 4:white
        is_red = (band_idx % 2 == 1)
        ramp = 'red' if is_red else 'white'
        for x in range(cx - half, cx + half + 1):
            nx = (x - cx) / max(1.0, float(half))
            if x == cx - half or x == cx + half:
                cv.p(x, y, col('ink', 0))
            elif y == 41:
                cv.p(x, y, col(ramp, 1))  # shadow directly under gallery
            else:
                # Subtle masonry brick-course variation + cylindrical wrap shading
                course_line = ((y - 41) % 4 == 3)
                r = hsh(x // 5, y // 4, 750)
                if nx < -0.50:
                    ti = 4 if is_red else 5
                elif nx < 0.05:
                    ti = 5 if not is_red else 4
                    if nx > -0.35 and nx < -0.08:
                        ti = 6 if not is_red else 5  # bright cylindrical specular!
                elif nx < 0.55:
                    ti = 3 if is_red else 4
                elif nx < 0.82:
                    ti = 2
                else:
                    ti = 1
                if course_line and r > 0.35:
                    ti = max(1, ti - 1)
                cv.p(x, y, col(ramp, ti))

    # Staggered Compact Porthole Windows along the Tower (breaks vertical repetition cleanly!)
    draw_porthole(cv, cx - 2, 47, r=2, rim_ramp='steel', warm=False)
    draw_porthole(cv, cx + 5, 60, r=2, rim_ramp='steel', warm=True)
    draw_porthole(cv, cx - 6, 73, r=2, rim_ramp='steel', warm=True)
    draw_porthole(cv, cx + 2, 85, r=2, rim_ramp='steel', warm=False)

    # --- Stone Keeper's Cottage Base (x=2..62, y=92..143) ---
    # Pitched blue-slate cottage roof wrapping around tower base (y=92..106)
    cv.pitched_roof(2, 93, 62, 108, ramp='kawara', ridge_hi=True, moss_rate=0.05, seed=751)
    # Re-stamp tower lower section slightly overlapping center-back of cottage roof for 3/4 depth!
    for y in range(90, 99):
        half = 19
        for x in range(cx - half, cx + half + 1):
            nx = (x - cx) / float(half)
            if x in (cx - half, cx + half):
                cv.p(x, y, col('ink', 0))
            else:
                ti = 5 if nx < -0.1 else (4 if nx < 0.4 else (2 if nx < 0.8 else 1))
                cv.p(x, y, col('white', ti))
    cv.hline(cx - 19, cx + 20, 98, col('ink', 0))
    # Tiny stone chimney on right roof slope with gentle smoke wisp
    cv.outline_box(50, 84, 57, 98, col('stone', 4), col('stone', 0), top_hi=col('stone', 6))
    cv.hline(49, 58, 84, col('stone', 6))
    draw_smoke_wisp(cv, 53, 83)

    # Cottage ashlar stone walls (x=3..61, y=108..141)
    draw_ashlar_wall(cv, 3, 108, 61, 141, ramp='stone', base_i=4, bw=8, bh=5, seed=752)
    cv.hline(3, 61, 108, col('ink', 1))
    cv.hline(3, 61, 109, col('stone', 2))

    # Keeper's Entry Porch with Bright Nautical Blue Door (left-center x=9..29)
    cv.outline_box(8, 111, 30, 117, col('kawara', 3), col('ink', 0), top_hi=col('kawara', 5))
    cv.hline(8, 30, 117, col('ink', 1))
    # Blue wooden maritime door
    cv.outline_box(12, 118, 26, 139, col('blue', 3), col('navy', 0), top_hi=col('blue', 5), bot_sh=col('blue', 1))
    cv.window(14, 120, 24, 127, style='warm', frame='blue:1', sill=None, seed=753)
    cv.p(23, 131, col('yellow', 5))  # brass handle
    # Warm brass porch lantern beside blue door
    cv.rect(27, 119, 30, 123, col('steel', 1))
    cv.p(28, 120, col('yellow', 5))
    cv.p(28, 121, col('orange', 4))
    # Stone entry steps
    cv.outline_box(10, 139, 28, 143, col('concrete', 5), col('ink', 0), top_hi=col('concrete', 6))

    # Cozy Shuttered Warm Keeper's Window (right x=36..55)
    cv.window(38, 116, 53, 130, style='warm', frame='white:5', sill='stone:6', curtain='blue', seed=754)
    # Blue wooden shutters flanking window
    cv.outline_box(34, 116, 38, 130, col('blue', 3), col('navy', 0), top_hi=col('blue', 4))
    cv.outline_box(53, 116, 57, 130, col('blue', 3), col('navy', 0), top_hi=col('blue', 4))
    # Wooden supply barrel & coastal wildflowers at base
    cv.outline_box(33, 132, 41, 141, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.hline(33, 41, 135, col('steel', 2))
    cv.hline(33, 41, 138, col('steel', 2))
    cv.planter_box(43, 134, 58, 141, flower='yellow:5', pot_ramp='stone')
    # Coiled mooring rope on left corner
    cv.rect(4, 136, 9, 141, col('straw', 4))
    cv.hline(5, 8, 137, col('straw', 5))
    cv.hline(4, 9, 139, col('straw', 2))

    # Rocky coastal flagstone plinth grounding
    cv.rect(2, 141, 62, 144, col('flagstone', 3))
    cv.hline(2, 62, 141, col('flagstone', 5))
    cv.hline(2, 62, 143, col('ink', 0))
    cv.edge_finish(top_y=108)
    return cv


# ===========================================================================
# 8. mf-bldg-hb_seafood_market (128x96)
# ===========================================================================

def build_hb_seafood_market():
    cv = Canvas(128, 96)
    W, H = cv.w, cv.h

    # --- Raised Clerestory Vent Cupola atop Roof (x=36..92, y=3..16) ---
    cv.outline_box(38, 3, 90, 9, col('tile', 4), col('ink', 0), top_hi=col('tile', 6))
    cv.outline_box(40, 8, 88, 16, col('coolwhite', 4), col('steel', 0))
    # Slatted louvers + warm market light peeking through vent windows
    for lx in range(43, 86, 6):
        cv.rect(lx, 10, lx + 4, 14, col('yellow', 4 if lx % 12 != 7 else 3))
        cv.hline(lx, lx + 4, 11, col('steel', 2))
        cv.hline(lx, lx + 4, 13, col('steel', 2))

    # --- Broad Corrugated Blue-Slate Warehouse Roof (x=2..126, y=12..37) ---
    draw_corrugated_roof(cv, 2, 12, 126, 37, ramp='tile', rib_w=4, ridge_ramp='coolwhite', seed=760)
    # Subtle gable triangle peak accent in center front of roof
    for gy in range(7):
        hw = 6 + gy * 3
        cv.hline(64 - hw, 64 + hw, 13 + gy, col('tile', 5 if gy < 2 else (4 if gy % 2 == 0 else 3)))
    cv.hline(2, 126, 36, col('steel', 1))
    cv.hline(2, 126, 37, col('ink', 0))

    # --- Market Fascia Sign & Bold Hanging Blue/White Market Banners (y=37..56) ---
    cv.siding_wall(4, 37, 124, 56, ramp='coolwhite', base_i=4, horizontal=True, step=3, seed=761)
    cv.hline(4, 124, 37, col('ink', 1))
    # Bold navy/white central market signboard
    cv.outline_box(27, 40, 101, 51, col('navy', 2), col('ink', 0), top_hi=col('blue', 4), bot_sh=col('navy', 0))
    tw = text_width('FISH MARKET', spacing=1)
    draw_text(cv, 64 - tw // 2, 43, 'FISH MARKET', col('white', 6), spacing=1, shadow=col('navy', 0))
    # Cute pixel fish emblem on left & right of signboard
    for fx in (30, 93):
        cv.rect(fx, 44, fx + 4, 47, col('yellow', 5))
        cv.p(fx + 5, 45, col('yellow', 4))
        cv.p(fx + 1, 45, col('navy', 1))

    # Bold Hanging Blue/White Market Banners (cleanly above stall awnings, zero collision!)
    banner_xs = [6, 17, 102, 113]
    for bi, bx in enumerate(banner_xs):
        b_ramp = 'blue' if bi % 2 == 0 else 'navy'
        cv.rect(bx, 39, bx + 9, 54, col(b_ramp, 3))
        cv.hline(bx - 1, bx + 10, 39, col('wood', 3))  # banner pole
        cv.hline(bx, bx + 9, 40, col(b_ramp, 5))
        cv.vline(bx, 40, 54, col(b_ramp, 1))
        cv.vline(bx + 8, 40, 54, col(b_ramp, 1))
        # White wave/fish crest in middle of banner
        cv.rect(bx + 2, 43, bx + 7, 49, col('white', 6))
        cv.hline(bx + 3, bx + 6, 45, col(b_ramp, 3))
        cv.hline(bx + 3, bx + 6, 47, col('red', 4))
        # V-cut swallowtail bottom
        cv.p(bx + 4, 53, col('coolwhite', 3))

    # --- 1F Wide Open Waterfront Seafood Stall Bays (x=4..124, y=54..93) ---
    # Structural warehouse columns
    for colx in (4, 43, 81, 120):
        cv.outline_box(colx, 54, colx + 4, 93, col('steel', 3), col('ink', 0), top_hi=col('coolwhite', 4))
    # Deep shadowed interior market hall behind stalls
    cv.rect(8, 54, 120, 92, col('ink', 1))
    for y in range(55, 92):
        bg_c = col('steel', 1) if y < 65 else (col('steel', 2) if y < 78 else col('pavement', 3))
        for x in range(8, 120):
            if x in range(43, 47) or x in range(81, 85):
                continue
            cv.p(x, y, bg_c)

    # Striped Tarps overhanging each of the 3 open stall bays!
    cv.awning(8, 54, 43, 61, ramp_a='blue', ramp_b='white', stripe_w=3)
    cv.awning(47, 54, 81, 61, ramp_a='red', ramp_b='cream', stripe_w=3)
    cv.awning(85, 54, 120, 61, ramp_a='teal', ramp_b='white', stripe_w=3)

    # Hanging Bare Glowing Market Bulbs on dark cords inside the bays!
    for lx in (17, 34, 56, 72, 94, 111):
        cv.vline(lx, 61, 66, col('ink', 0))
        cv.p(lx, 66, col('white', 6))
        cv.p(lx, 67, col('yellow', 5))
        cv.p(lx - 1, 66, col('yellow', 4))
        cv.p(lx + 1, 66, col('yellow', 4))

    # BAY 1 (Left, x=9..42): Iced Silver Fish Crates + Hanging Scale
    cv.outline_box(10, 74, 41, 89, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    # Crushed ice bed on slanted counter top
    cv.rect(11, 72, 40, 78, col('glass', 6))
    cv.hline(11, 40, 72, col('white', 6))
    # Gleaming silver/blue fish lined up on the ice!
    for fx in (13, 20, 27, 34):
        cv.rect(fx, 73, fx + 5, 76, col('tile', 5))
        cv.hline(fx + 1, fx + 4, 73, col('coolwhite', 5))
        cv.p(fx, 74, col('navy', 2))
        cv.p(fx + 5, 74, col('tile', 3))
    # Hanging price tags
    for tx in (15, 29):
        cv.rect(tx, 69, tx + 4, 72, col('yellow', 5))
        cv.p(tx + 1, 70, col('red', 3))
    # Stacked blue plastic seafood tub beside stall
    cv.outline_box(12, 83, 23, 91, col('blue', 4), col('navy', 0), top_hi=col('blue', 5))
    cv.outline_box(25, 84, 38, 91, col('blue', 3), col('navy', 0), top_hi=col('blue', 5))

    # BAY 2 (Center, x=48..80): Red Crabs/Shellfish Ice Table & Stacked Blue Plastic Tubs!
    cv.outline_box(49, 75, 79, 88, col('cedar', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.rect(50, 72, 78, 78, col('white', 6))
    # Bright red crabs & orange prawns on ice
    for cx_p in (52, 60, 68):
        cv.rect(cx_p, 73, cx_p + 5, 76, col('red', 4))
        cv.p(cx_p + 1, 73, col('orange', 5))
        cv.p(cx_p + 4, 74, col('red', 2))
    # Iconic stacked bright blue plastic tubs in front center!
    cv.outline_box(50, 82, 61, 91, col('blue', 4), col('navy', 0), top_hi=col('coolwhite', 5))
    cv.outline_box(51, 78, 60, 83, col('blue', 5), col('navy', 0), top_hi=col('white', 6))
    cv.outline_box(64, 84, 77, 91, col('teal', 4), col('teal', 0), top_hi=col('teal', 5))

    # BAY 3 (Right, x=86..119): Dried Fish Rack, Wooden Crates & Ice Cooler
    # Hanging dried fish line
    cv.hline(87, 118, 68, col('straw', 4))
    for dfx in (90, 96, 102, 108, 114):
        cv.rect(dfx, 69, dfx + 3, 74, col('cedar', 5))
        cv.vline(dfx + 1, 70, 74, col('orange', 3))
    # Counter with orange fillets & cooler box
    cv.outline_box(87, 76, 118, 90, col('wood', 3), col('wood', 0), top_hi=col('cedar', 5))
    cv.rect(88, 75, 104, 79, col('glass', 6))
    cv.rect(90, 76, 96, 78, col('orange', 4))
    cv.rect(98, 76, 103, 78, col('pink', 4))
    # White styrofoam harbor fish boxes stacked on right
    cv.outline_box(106, 75, 117, 83, col('white', 5), col('steel', 2), top_hi=col('white', 6))
    cv.outline_box(106, 83, 117, 91, col('white', 4), col('steel', 1), top_hi=col('white', 5))

    # Wet Harbor Concrete Apron with Subtle Water Puddle Reflections (y=91..96)
    cv.rect(2, 91, 126, 96, col('pavement', 4))
    cv.hline(2, 126, 91, col('concrete', 5))
    # Wet market washdown puddles
    cv.hline(24, 39, 93, col('glass', 4))
    cv.hline(26, 35, 94, col('glass', 5))
    cv.hline(74, 91, 93, col('glass', 4))
    cv.hline(78, 86, 94, col('glass', 5))
    cv.hline(2, 126, 95, col('ink', 0))
    cv.edge_finish(top_y=42)
    return cv


# ===========================================================================
# 9. mf-bldg-hb_pier_terrace_pub (112x112)
# ===========================================================================

def build_hb_pier_terrace_pub():
    cv = Canvas(112, 112)
    W, H = cv.w, cv.h

    # --- Red-Brick Grill Chimney on Left with Warm Smoke Wisp (y=2..22) ---
    cv.brick_wall(12, 5, 22, 24, ramp='brick', base_i=4, course_h=3, brick_w=5, seed=770)
    cv.outline_box(11, 5, 23, 8, col('stone', 5), col('ink', 0), top_hi=col('stone', 6))
    cv.vline(12, 8, 22, col('ink', 1))
    cv.vline(21, 8, 22, col('ink', 0))
    draw_smoke_wisp(cv, 16, 4)

    # --- Weathered Green-Copper / Slate Pitched Roof (x=4..108, y=10..34) ---
    cv.pitched_roof(4, 10, 108, 34, ramp='midori', ridge_hi=True, moss_rate=0.05, seed=771)
    # Oxidized teal-copper patina accents along shingles & copper ridge
    cv.hline(5, 107, 10, col('teal', 5))
    cv.hline(5, 107, 11, col('teal', 4))
    for y in range(15, 31, 4):
        for x in range(10, 102, 11):
            if hsh(x, y, 772) > 0.52:
                cv.rect(x, y, x + 3, y + 2, col('teal', 4))
    cv.hline(4, 108, 33, col('midori', 0))

    # --- 2F WIDE Sea-View Wooden Open Terrace (x=4..108, y=34..69) ---
    # Back weathered timber wall opening onto the terrace (y=34..49)
    cv.siding_wall(6, 34, 106, 50, ramp='cedar', base_i=3, horizontal=True, step=3, seed=773)
    cv.hline(6, 106, 34, col('ink', 1))
    cv.hline(6, 106, 35, col('wood', 1))
    # Glowing upper terrace pub French doors & window
    cv.window(12, 37, 29, 48, style='warm', frame='wood:0', sill='cedar:5', seed=774)
    cv.door_glass(46, 36, 66, 49, frame='wood:0', warm=True)
    cv.window(82, 37, 99, 48, style='warm', frame='wood:0', sill='cedar:5', seed=775)
    # Timber roof-support posts framing the wide open terrace
    for px in (6, 103):
        cv.outline_box(px, 34, px + 3, 61, col('wood', 3), col('wood', 0), top_hi=col('cedar', 5))

    # --- Rebuilt Recessed Walkable Top-3/4 Wooden Sea-View Terrace Deck (x=4..108, y=49..69) ---
    # 1) Recessed walkable sunlit plank floor deck (y=49..62) with strong 2F back-wall cast shadow!
    for y in range(49, 62):
        ry = y - 49
        for x in range(4, 108):
            rx = x - 4
            if rx in (0, 1):
                # Left timber side-rail edge
                cv.p(x, y, col('wood', 0 if rx == 0 else 4))
            elif rx in (102, 103):
                # Right timber side-rail edge
                cv.p(x, y, col('wood', 3 if rx == 102 else 0))
            elif ry == 0:
                # Deep cast shadow from 2F back wall (warm threshold spill right outside French door!)
                if 47 <= x < 65:
                    cv.p(x, y, col('orange', 2 if x % 2 == 0 else 3))
                else:
                    cv.p(x, y, col('ink', 1))
            elif ry == 1:
                if 48 <= x < 64:
                    cv.p(x, y, col('floorwood', 4))
                else:
                    cv.p(x, y, col('wood', 1))
            elif rx in (2, 3):
                # Left side-rail cast shadow across deck edge
                cv.p(x, y, col('floorwood', 2))
            else:
                # Bright sunlit horizontal walkable deck planks (contrasting sharply vs back wall & rail!)
                plank_row = (ry - 2) % 3
                plank_idx = (ry - 2) // 3
                butt_joint = ((rx + plank_idx * 9) % 19 == 0)
                if plank_row == 2 or butt_joint:
                    cv.p(x, y, col('floorwood', 2))
                else:
                    r = hsh(rx // 6, plank_idx, 776)
                    if plank_row == 0:
                        cv.p(x, y, col('floorwood', 6 if r > 0.45 else 5))
                    else:
                        cv.p(x, y, col('cedar', 5 if r > 0.30 else 4))

    # 2) Two Coastal Bistro Tables, Grounded Bases, Flanking Stools & Parasols on the Deck Floor!
    bistro_sets = [
        (25, 'navy', 'white', 'yellow:5', 'orange:4'),
        (85, 'red', 'cream', 'yellow:5', 'red:4'),
    ]
    for cx, pa, pb, drink_c, plate_c in bistro_sets:
        # Ground cast shadow on sunlit plank deck
        cv.rect(cx - 8, 58, cx + 9, 61, col('floorwood', 1))
        cv.hline(cx - 6, cx + 7, 57, col('floorwood', 2))
        # Flanking wooden bistro chairs/stools grounded on deck planks
        for chx in (cx - 11, cx + 7):
            cv.vline(chx, 56, 61, col('wood', 0))
            cv.vline(chx + 3, 56, 61, col('wood', 0))
            cv.outline_box(chx, 54, chx + 4, 58, col('cedar', 5), col('wood', 0), top_hi=col('cream', 5))
        # Heavy dark-iron/wood table pedestal foot & base cleanly grounded on deck floor!
        cv.hline(cx - 3, cx + 4, 60, col('steel', 0))
        cv.hline(cx - 2, cx + 3, 59, col('steel', 2))
        cv.rect(cx - 1, 56, cx + 2, 60, col('steel', 1))
        cv.vline(cx, 56, 60, col('steel', 3))
        # Sunlit coastal bistro tabletop with rim & drinks
        cv.outline_box(cx - 6, 52, cx + 7, 57, col('cedar', 5), col('wood', 0), top_hi=col('cream', 5), bot_sh=col('wood', 2))
        cv.p(cx - 3, 53, drink_c)   # beer mug
        cv.p(cx - 3, 54, col('white', 6))
        cv.p(cx + 2, 54, plate_c)   # seafood plate
        cv.p(cx + 3, 54, col('cream', 6))
        # Parasol pole rising cleanly from center of tabletop into scalloped canopy!
        cv.vline(cx, 48, 55, col('wood', 2))
        cv.vline(cx + 1, 48, 54, col('ink', 1))
        draw_parasol(cv, cx, 44, rx=11, ramp_a=pa, ramp_b=pb)

    # 3) Clear Open Wooden Front Railing along the Terrace Edge (x=4..108, y=60..69)
    # Sunlit top handrail cap
    cv.hline(4, 108, 60, col('cream', 5))
    cv.hline(5, 107, 61, col('cedar', 5))
    cv.hline(4, 108, 62, col('wood', 1))
    cv.p(4, 60, col('wood', 0))
    cv.p(107, 60, col('wood', 0))
    # Open baluster zone (y=63..67) with crisp vertical balusters & wide 3px visible recessed gaps!
    for y in range(63, 67):
        for x in range(4, 108):
            rx = x - 4
            if rx % 5 == 0:
                cv.p(x, y, col('cedar', 5))   # sunlit baluster edge
            elif rx % 5 == 1:
                cv.p(x, y, col('wood', 1))    # shaded baluster edge
            else:
                # Clearly visible dark recessed gap behind open railing (top shadow -> lower deck hint)
                if y == 63:
                    cv.p(x, y, col('ink', 0))
                elif y == 64:
                    cv.p(x, y, col('ink', 1))
                elif y == 65:
                    cv.p(x, y, col('wood', 0))
                else:
                    cv.p(x, y, col('floorwood', 2 if (x % 3 != 0) else 1))
    # Sturdy corner & intermediate square wooden newel posts (rise 1px above handrail with bright caps!)
    for npx in (4, 38, 70, 104):
        cv.outline_box(npx, 59, npx + 4, 68, col('wood', 3), col('wood', 0), top_hi=col('cream', 5))
        cv.vline(npx + 1, 60, 67, col('cedar', 5))
        cv.vline(npx + 2, 60, 67, col('wood', 2))
    # Heavy lower timber fascia beam supporting the 2F terrace deck
    cv.hline(4, 108, 67, col('cedar', 4))
    cv.hline(4, 108, 68, col('wood', 2))

    # Festoon of Warm Glowing String Lights Draped cleanly above the Parasols!
    draw_string_lights(cv, 9, 56, 34, sag=3)
    draw_string_lights(cv, 56, 103, 34, sag=3)

    # Hanging Rope Trim & Shadow beneath 2F Terrace Deck
    cv.hline(4, 108, 69, col('ink', 0))
    cv.hline(6, 106, 70, col('ink', 1))

    # --- 1F Weathered Timber-and-Brick Waterfront Pub Facade (x=6..106, y=70..101) ---
    cv.brick_wall(6, 70, 106, 101, ramp='brick', base_i=3, course_h=3, brick_w=6, seed=777)
    cv.hline(6, 106, 70, col('ink', 1))
    # Dark weathered timber wainscoting along lower 1F wall
    cv.siding_wall(6, 89, 106, 101, ramp='darkwood', base_i=3, horizontal=False, step=3, seed=778)
    cv.hline(6, 106, 89, col('wood', 5))

    # Rustic Carved Wooden 'PIER PUB' Fascia Sign (x=34..78, y=71..80)
    cv.outline_box(34, 71, 78, 80, col('wood', 2), col('ink', 0), top_hi=col('cedar', 5), bot_sh=col('wood', 0))
    tw = text_width('PIER PUB', spacing=1)
    draw_text(cv, 56 - tw // 2, 73, 'PIER PUB', col('yellow', 5), spacing=1, shadow=col('wood', 0))

    # Left & Right Glowing Multi-Pane Pub Windows
    cv.window(11, 76, 31, 93, style='warm', frame='wood:0', sill='cedar:4', curtain='red', seed=779)
    cv.window(81, 76, 101, 93, style='warm', frame='wood:0', sill='cedar:4', curtain='green', seed=780)
    # Center Heavy Timber Pub Door with Backlit Pane & Brass Ship Lanterns
    cv.door_wood(46, 81, 66, 101, ramp='wood', glass_top=True)
    for lx in (41, 68):
        cv.rect(lx, 83, lx + 3, 88, col('steel', 1))
        cv.p(lx + 1, 85, col('yellow', 5))
        cv.p(lx + 1, 86, col('orange', 4))
    # Mounted Red-and-White Life-Ring Buoy on Front Pub Wall!
    draw_life_ring(cv, 36, 89, r=4)
    # Small Seafood Grill Menu Chalkboard on right of door
    cv.outline_box(71, 85, 78, 96, col('ink', 1), col('cedar', 4))
    cv.hline(73, 77, 88, col('cream', 5))
    cv.hline(73, 76, 90, col('orange', 4))
    cv.hline(73, 77, 92, col('yellow', 4))

    # --- 1F Warm Weathered Wood Deck Porch with Rope Bollards & Steps (y=100..112) ---
    cv.rect(2, 100, 110, 111, col('floorwood', 4))
    for y in range(100, 111):
        for x in range(2, 110):
            if y == 100:
                cv.p(x, y, col('wood', 1))
            elif y == 109:
                cv.p(x, y, col('wood', 2))
            elif y == 110:
                cv.p(x, y, col('ink', 0))
            elif y % 3 == 0:
                cv.p(x, y, col('floorwood', 2))
            else:
                r = hsh(x // 6, y, 781)
                cv.p(x, y, col('floorwood', 5 if r > 0.65 else (4 if r > 0.2 else 3)))
    # Heavy pier support pilings under front edge
    for px in (4, 32, 76, 104):
        cv.rect(px, 108, px + 4, 112, col('wood', 1))
    # Center timber steps down from porch
    cv.outline_box(46, 106, 66, 112, col('cedar', 5), col('wood', 0), top_hi=col('cedar', 6))
    cv.hline(47, 65, 109, col('wood', 2))
    # Heavy Rope Bollards & Oak Keg Barrel on the Pier Porch!
    draw_bollard(cv, 5, 97, rope=True)
    draw_bollard(cv, 102, 97, rope=True)
    # Draped mooring rope connecting left bollard to porch edge
    for rx in range(10, 26):
        ry = 102 + int(round(2.5 * math.sin((rx - 10) / 16.0 * math.pi)))
        cv.p(rx, ry, col('straw', 4))
        cv.p(rx, ry + 1, col('straw', 2))
    # Oak beer keg barrel on right corner of porch
    cv.outline_box(92, 94, 100, 104, col('wood', 4), col('wood', 0), top_hi=col('cedar', 5))
    cv.hline(92, 100, 97, col('steel', 2))
    cv.hline(92, 100, 101, col('steel', 2))

    cv.edge_finish(top_y=34)
    return cv


# ===========================================================================
# 10. mf-bldg-hb_canal_crane_loft (112x128)
# ===========================================================================

def build_hb_canal_crane_loft():
    cv = Canvas(112, 128)
    W, H = cv.w, cv.h
    cx = 56

    # --- Flanking Dark-Slate Pitched Warehouse Roofs (y=18..38) ---
    cv.pitched_roof(4, 18, 108, 38, ramp='kuro', ridge_hi=True, moss_rate=0.04, seed=790)
    # Industrial skylight on left roof wing & metal roof vent on right
    cv.outline_box(12, 24, 26, 32, col('glass', 4), col('steel', 1), top_hi=col('glass', 6))
    cv.vline(19, 25, 31, col('steel', 2))
    cv.outline_box(86, 22, 94, 30, col('steel', 4), col('steel', 0), top_hi=col('coolwhite', 5))

    # --- Stepped Historic Canal Warehouse Brick Gable (x=28..84, y=10..38) ---
    # Stepped Dutch/industrial gable profile with cream-stone coping
    steps = [
        (44, 68, 10, 16),
        (36, 76, 16, 23),
        (28, 84, 23, 38),
    ]
    for sx0, sx1, sy0, sy1 in steps:
        cv.brick_wall(sx0, sy0, sx1, sy1, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=791 + sy0)
        cv.hline(sx0 - 1, sx1 + 1, sy0, col('stone', 6))
        cv.hline(sx0 - 1, sx1 + 1, sy0 + 1, col('stone', 4))
        cv.vline(sx0, sy0, sy1, col('ink', 1))
        cv.vline(sx1 - 1, sy0, sy1, col('ink', 0))
    # Stone medallion & date plaque inside upper gable
    cv.outline_box(46, 22, 66, 29, col('stone', 5), col('brick', 1), top_hi=col('stone', 6))
    draw_text(cv, 49, 23, '1892', col('brick', 1), spacing=1)

    # --- Main Industrial Red-Brick Warehouse Wall (x=6..106, y=38..126) ---
    cv.brick_wall(6, 38, 106, 126, ramp='brick', base_i=4, course_h=3, brick_w=6, seed=792)
    cv.hline(6, 106, 38, col('ink', 1))
    cv.hline(6, 106, 39, col('brick', 1))
    # Heavy stone floor belt courses dividing 3F, 2F, 1F
    for by in (64, 92):
        cv.rect(5, by, 107, by + 3, col('stone', 4))
        cv.hline(5, 107, by, col('stone', 6))
        cv.hline(5, 107, by + 2, col('ink', 1))
    # Historic dark iron star tie-rod anchors on brick piers
    for ax, ay in [(10, 46), (101, 46), (10, 74), (101, 74), (37, 74), (74, 74)]:
        cv.p(ax, ay, col('steel', 0))
        cv.p(ax - 1, ay, col('steel', 2))
        cv.p(ax + 1, ay, col('steel', 2))
        cv.p(ax, ay - 1, col('steel', 2))
        cv.p(ax, ay + 1, col('steel', 2))

    # --- 3F Loft Floor (y=40..64): Arched Factory Windows + Central Timber Loading Doors ---
    # Left arched studio window (warm glowing loft)
    draw_arched_window(cv, 14, 43, 32, 62, warm=True, frame='steel:0', arch_ramp='brick', sill='stone:5', seed=793)
    # Studio pendant lamp & easel hint inside left 3F window
    cv.p(20, 49, col('white', 6))
    cv.vline(25, 55, 61, col('wood', 2))
    # Right arched studio window (cool sky-reflecting + indoor hanging plant!)
    draw_arched_window(cv, 80, 43, 98, 62, warm=False, frame='steel:0', arch_ramp='brick', sill='stone:5', seed=794)
    cv.rect(84, 54, 89, 60, col('foliage', 4))
    cv.p(86, 55, col('foliage', 5))
    # Center Historic Double Timber Loading Doors under the Hoist (x=42..70, y=41..64)
    cv.outline_box(42, 41, 70, 64, col('wood', 3), col('wood', 0), top_hi=col('cedar', 5))
    cv.siding_wall(43, 42, 69, 63, ramp='wood', base_i=4, horizontal=False, step=3, seed=795)
    cv.vline(56, 42, 63, col('wood', 0))  # center seam
    # Iron strap hinges & diagonal cross-braces on timber loading doors
    for hy in (46, 58):
        cv.hline(43, 51, hy, col('steel', 1))
        cv.hline(61, 69, hy, col('steel', 1))
    # Small warm transom window above loading doors
    cv.window(45, 43, 67, 49, style='warm', frame='steel:0', sill=None, seed=796)
    # Stone loading sill
    cv.hline(40, 72, 63, col('stone', 6))

    # --- 2F Renovated Loft Studios (y=67..92) — Distinct from 3F (ZERO cloning!) ---
    # Left 2F arched studio window (warm amber art loft with warm easel/canvas glow)
    draw_arched_window(cv, 14, 70, 32, 89, warm=True, frame='steel:0', arch_ramp='stone', sill='stone:5', seed=797)
    cv.rect(18, 79, 25, 86, col('cream', 5))  # bright art canvas inside loft!
    cv.p(21, 82, col('blue', 4))
    # Center 2F Renovated Steel-Framed Loft Balcony Doors + Wrought-Iron Juliet Rail
    draw_arched_window(cv, 44, 69, 68, 90, warm=True, frame='steel:0', arch_ramp='stone', sill='stone:5', seed=798)
    # Wrought-iron Juliet balcony railing & lush terracotta window planter
    cv.hline(42, 70, 83, col('steel', 1))
    for rx in range(43, 70, 3):
        cv.vline(rx, 83, 91, col('steel', 0))
    cv.planter_box(46, 85, 66, 91, flower='red:4', pot_ramp='brick')
    # Right 2F arched studio window (warm backlit architectural loft)
    draw_arched_window(cv, 80, 70, 98, 89, warm=True, frame='steel:0', arch_ramp='stone', sill='stone:5', seed=799)
    cv.hline(83, 95, 76, col('yellow', 5))  # studio track lighting

    # Climbing green ivy along weathered left brick corner (adds organic richness & breaks symmetry!)
    for iy in range(48, 94):
        if hsh(iy, 7, 801) > 0.35:
            cv.p(7 + (iy % 3), iy, col('foliage', 4 if iy % 2 == 0 else 3))
            cv.p(8 + ((iy + 1) % 3), iy, col('foliage', 2))
            if iy % 5 == 0:
                cv.p(10, iy, col('foliage', 5))

    # Exterior dark-steel industrial drainpipe running down right facade
    cv.vline(103, 39, 123, col('steel', 1))
    cv.vline(104, 39, 123, col('steel', 3))

    # --- 1F Canal-Side Warehouse Plinth, Timber Loading Bay & Renovated Loft Entry (y=95..127) ---
    draw_ashlar_wall(cv, 6, 95, 106, 125, ramp='stone', base_i=3, bw=9, bh=5, seed=802)
    # Left Arched Heavy Timber & Iron Loading Bay Door (x=12..42)
    cv.outline_box(12, 98, 42, 124, col('wood', 3), col('wood', 0), top_hi=col('wood', 5))
    cv.siding_wall(13, 99, 41, 123, ramp='wood', base_i=3, horizontal=False, step=3, seed=803)
    cv.vline(27, 99, 123, col('wood', 0))
    # Iron crossbars & vintage gooseneck industrial lamp above loading bay
    cv.hline(13, 41, 106, col('steel', 1))
    cv.hline(13, 41, 117, col('steel', 1))
    cv.rect(25, 95, 29, 98, col('steel', 1))
    cv.p(27, 98, col('yellow', 5))
    # Stacked timber shipping crate beside loading bay
    draw_wooden_crate(cv, 10, 116, w=11, h=9, ramp='cedar')

    # Right-Center Renovated Loft Entry & Studio Gallery Glazing (x=48..100)
    # Sleek dark steel canopy awning with glowing 'LOFT' signage
    cv.outline_box(47, 96, 101, 103, col('steel', 1), col('ink', 0), top_hi=col('steel', 4))
    draw_text(cv, 66, 97, 'LOFT', col('yellow', 5), spacing=1, shadow=col('ink', 0))
    cv.hline(47, 101, 103, col('ink', 1))
    # Glazed double loft entry doors & wide gallery display window
    cv.door_glass(50, 104, 68, 124, frame='steel:0', warm=True)
    cv.window(72, 105, 98, 121, style='warm', frame='steel:0', sill='stone:5', seed=804)
    # Framed studio gallery display pieces visible inside 1F window
    cv.outline_box(76, 109, 83, 116, col('cream', 5), col('wood', 1))
    cv.p(79, 112, col('red', 4))
    cv.outline_box(86, 109, 94, 116, col('coolwhite', 5), col('wood', 1))
    cv.p(90, 112, col('teal', 4))
    # Lush brick planter flanking loft entrance
    cv.planter_box(73, 120, 97, 125, flower='yellow:5', pot_ramp='brick')

    # Canal-side stone quay curb grounding (y=124..128)
    cv.rect(4, 124, 108, 128, col('flagstone', 4))
    cv.hline(4, 108, 124, col('stone', 5))
    cv.hline(4, 108, 127, col('ink', 0))

    # --- Iconic Projecting Steel Roof-Gable Crane Hoist Boom Arm (drawn in foreground!) ---
    # Heavy riveted steel bracket bolted into top gable (x=51..61, y=11..19)
    cv.outline_box(51, 11, 61, 19, col('steel', 2), col('ink', 0), top_hi=col('coolwhite', 5))
    # Bold projecting angled iron truss hoist boom rising out & right to pulley head!
    for i in range(21):
        ax = 55 + i
        ay = 13 - (i * 8) // 20
        cv.rect(ax, ay, ax + 2, ay + 4, col('steel', 1))
        cv.p(ax, ay, col('ink', 0))
        cv.p(ax, ay + 1, col('coolwhite', 5))  # crisp metallic top highlight
        cv.p(ax, ay + 2, col('steel', 3))
        cv.p(ax, ay + 3, col('ink', 0))
    # Lower tension strut bracing the boom
    for i in range(18):
        bx = 56 + i
        by = 19 - (i * 10) // 18
        cv.p(bx, by, col('ink', 0))
        cv.p(bx, by + 1, col('steel', 4))
    # Pulley wheel at tip of hoist arm (x=75, y=6)
    cv.outline_box(73, 4, 79, 10, col('steel', 3), col('ink', 0), top_hi=col('coolwhite', 5))
    cv.p(76, 7, col('yellow', 5))
    # Taut steel hoist cable descending with bright pulley block & suspended wooden crate!
    cv.vline(75, 10, 32, col('ink', 0))
    cv.vline(76, 10, 32, col('coolwhite', 4))
    # Yellow/iron pulley hook block + small hanging timber cargo crate!
    cv.outline_box(73, 29, 79, 34, col('yellow', 4), col('ink', 0), top_hi=col('yellow', 5))
    draw_wooden_crate(cv, 71, 34, w=10, h=8, ramp='cedar')
    cv.hline(72, 82, 42, col('ink', 1))  # subtle cast shadow under suspended crate

    cv.edge_finish(top_y=38)
    return cv


# ===========================================================================
# Manifest & Batch Runner
# ===========================================================================

SPECS = [
    {
        'id': 'mf-bldg-tr_train_station_clock',
        'name': '시계탑 근교 철도역사',
        'category': 'transit',
        'w': 10, 'h': 7,
        'pxW': 160, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['transit', 'station', 'train', 'clock-tower', 'brick', 'landmark'],
        'fn': build_tr_train_station_clock,
    },
    {
        'id': 'mf-bldg-tr_subway_plaza',
        'name': '지하철 유리 캐노피 출입구 광장',
        'category': 'transit',
        'w': 6, 'h': 5,
        'pxW': 96, 'pxH': 80,
        'passableTopRows': 2,
        'tags': ['transit', 'subway', 'metro', 'glass-canopy', 'escalator', 'plaza'],
        'fn': build_tr_subway_plaza,
    },
    {
        'id': 'mf-bldg-tr_viaduct_shops',
        'name': '철도 고가 아치 상가 (라멘·서점·바)',
        'category': 'transit',
        'w': 9, 'h': 6,
        'pxW': 144, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['transit', 'viaduct', 'railway', 'arches', 'shops', 'brick'],
        'fn': build_tr_viaduct_shops,
    },
    {
        'id': 'mf-bldg-tr_bus_terminal',
        'name': '2층 광역 시외버스 터미널',
        'category': 'transit',
        'w': 9, 'h': 6,
        'pxW': 144, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['transit', 'bus-terminal', 'canopy', 'boarding-bays', 'departure-board'],
        'fn': build_tr_bus_terminal,
    },
    {
        'id': 'mf-bldg-tr_parking_garage',
        'name': '4층 도심 주차타워 (옥상 주차장)',
        'category': 'transit',
        'w': 7, 'h': 8,
        'pxW': 112, 'pxH': 128,
        'passableTopRows': 2,
        'tags': ['transit', 'parking-garage', 'cars', 'ramp', 'neon-sign', 'non-cloned'],
        'fn': build_tr_parking_garage,
    },
    {
        'id': 'mf-bldg-hb_ferry_terminal',
        'name': '해안 여객선 페리 터미널',
        'category': 'harbor',
        'w': 9, 'h': 7,
        'pxW': 144, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['harbor', 'ferry', 'terminal', 'nautical', 'wave-roof', 'landmark'],
        'fn': build_hb_ferry_terminal,
    },
    {
        'id': 'mf-bldg-hb_coastal_lighthouse',
        'name': '적백 줄무늬 항구 등대·등대지기 오두막',
        'category': 'harbor',
        'w': 4, 'h': 9,
        'pxW': 64, 'pxH': 144,
        'passableTopRows': 2,
        'tags': ['harbor', 'lighthouse', 'coastal', 'cottage', 'lantern', 'landmark'],
        'fn': build_hb_coastal_lighthouse,
    },
    {
        'id': 'mf-bldg-hb_seafood_market',
        'name': '항구 수산시장 어시장 창고',
        'category': 'harbor',
        'w': 8, 'h': 6,
        'pxW': 128, 'pxH': 96,
        'passableTopRows': 2,
        'tags': ['harbor', 'seafood', 'fish-market', 'stalls', 'warehouse', 'banners'],
        'fn': build_hb_seafood_market,
    },
    {
        'id': 'mf-bldg-hb_pier_terrace_pub',
        'name': '부두 2층 바다 테라스 펍·해산물 그릴',
        'category': 'harbor',
        'w': 7, 'h': 7,
        'pxW': 112, 'pxH': 112,
        'passableTopRows': 2,
        'tags': ['harbor', 'pier', 'pub', 'terrace', 'string-lights', 'waterfront'],
        'fn': build_hb_pier_terrace_pub,
    },
    {
        'id': 'mf-bldg-hb_canal_crane_loft',
        'name': '운하 적벽돌 크레인 호이스트 창고 로프트',
        'category': 'harbor',
        'w': 7, 'h': 8,
        'pxW': 112, 'pxH': 128,
        'passableTopRows': 2,
        'tags': ['harbor', 'canal', 'warehouse', 'loft', 'crane-hoist', 'brick', 'non-cloned'],
        'fn': build_hb_canal_crane_loft,
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
