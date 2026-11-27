"""OT2 HD-2D style pixel-art remake for core 17 + mage 13 battle skill FX sheets.

Preserves exact sheet dimensions, frame sizes, frame counts, and contactFrame timing
used by src/player/retroSkillChoreography.ts and src/assets/retroClassSkills.ts.

Usage:
  python3 scripts/asset-gen/ot2_remake_pixel_fx.py
"""
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
FX_DIR = ROOT / "public/assets/generated/pixel-fx"


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def px(im, x, y, col):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), col)


def disc(im, cx, cy, r, col, dither=False):
    r2 = r * r
    x0, x1 = max(0, int(cx - r - 1)), min(im.width - 1, int(cx + r + 1))
    y0, y1 = max(0, int(cy - r - 1)), min(im.height - 1, int(cy + r + 1))
    p = im.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                if not dither or ((x + y) & 1) == 0:
                    p[x, y] = col


def ring(im, cx, cy, rx, ry, col, thick=1.2, dash=0):
    steps = max(24, int(max(rx, ry) * 7))
    for i in range(steps):
        if dash and (i // dash) % 2 == 1:
            continue
        a = 2 * math.pi * i / steps
        for dt in (-0.4, 0.0, 0.4) if thick >= 1.5 else (0.0,):
            x = cx + math.cos(a) * (rx + dt)
            y = cy + math.sin(a) * (ry + dt * 0.5)
            px(im, x, y, col)


def line_px(im, x0, y0, x1, y1, col, width=1):
    dist = max(1, int(math.hypot(x1 - x0, y1 - y0) * 1.6))
    for i in range(dist + 1):
        t = i / dist
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        if width <= 1:
            px(im, x, y, col)
        else:
            r = width / 2.0
            disc(im, x, y, r, col)


def starburst(im, cx, cy, arm, col_core, col_mid, col_tip=None, diag=True):
    px(im, cx, cy, col_core)
    for d in range(1, arm + 1):
        c = col_core if d <= max(1, arm // 3) else (col_mid if d <= (arm * 2) // 3 else (col_tip or col_mid))
        px(im, cx - d, cy, c)
        px(im, cx + d, cy, c)
        px(im, cx, cy - d, c)
        px(im, cx, cy + d, c)
    if diag and arm >= 3:
        da = max(1, arm // 2)
        for d in range(1, da + 1):
            c = col_mid if d == 1 else (col_tip or col_mid)
            px(im, cx - d, cy - d, c)
            px(im, cx + d, cy - d, c)
            px(im, cx - d, cy + d, c)
            px(im, cx + d, cy + d, c)


def add_outline_rgba(im, out_col):
    w, h = im.size
    src = im.load()
    res = im.copy()
    dst = res.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if src[x, y][3] == 0:
                if (src[x-1, y][3] > 0 or src[x+1, y][3] > 0 or
                    src[x, y-1][3] > 0 or src[x, y+1][3] > 0):
                    dst[x, y] = out_col
    return res


def draw_crystal_spire(im, bx, by, height, half_w, tilt, pal, crack=False):
    """Faceted 3D pixel-art crystal spire (left bright facet, right mid/deep facet, dark outline)."""
    C_W, C_L, C_M, C_D, C_O = pal
    if height < 3 or half_w < 1:
        return
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    lp = layer.load()
    for dy in range(int(height)):
        t = dy / max(1, height - 1)  # 0 at base, 1 at tip
        y = int(round(by - dy))
        if y < 1 or y >= im.height - 1:
            continue
        cx = bx + tilt * t
        # Faceted width profile: widens slightly above base, tapers sharply to razor tip
        if t < 0.22:
            w = half_w * (0.72 + 0.28 * (t / 0.22))
        else:
            w = half_w * ((1.0 - t) / 0.78) ** 0.85
        iw = max(0, int(round(w)))
        ridge = cx - w * 0.12  # vertical crystal facet ridge
        for x in range(max(1, int(cx - iw)), min(im.width - 1, int(cx + iw) + 1)):
            if t > 0.84:
                col = C_W
            elif x < ridge - w * 0.25:
                col = C_W if (dy % 5 < 3) else C_L
            elif x <= ridge:
                col = C_L
            elif x <= ridge + w * 0.45:
                col = C_M
            else:
                col = C_D
            # Specular diagonal crystal gleam band
            if abs((x - cx) + (dy - height * 0.55) * 0.45) < 1.1:
                col = C_W
            if crack and abs((x - cx) - (dy - height * 0.4) * 0.7) < 0.75:
                col = C_W
            lp[x, y] = col
    outlined = add_outline_rgba(layer, C_O)
    im.alpha_composite(outlined)


def build_strip(frames, size, draw_fn):
    sheet = Image.new("RGBA", (frames * size, size), (0, 0, 0, 0))
    for f in range(frames):
        cell = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw_fn(cell, f, frames)
        sheet.alpha_composite(cell, (f * size, 0))
    return sheet


# ── Palettes ──────────────────────────────────────────────────────────────────
P_ICE     = ((255,255,255,255), (198,246,255,255), (84,198,255,255),  (30,96,196,255),  (12,30,68,255))
P_FIRE    = ((255,254,230,255), (255,222,86,255),  (255,108,28,255),  (186,32,20,255),  (62,12,14,255))
P_THUNDER = ((255,255,255,255), (255,248,136,255), (255,196,36,255),  (118,128,248,255),(26,22,64,255))
P_HEAL    = ((255,255,246,255), (200,255,216,255), (76,228,142,255),  (24,138,82,255),  (12,48,34,255))
P_HOLY    = ((255,255,252,255), (255,244,174,255), (255,198,74,255),  (196,118,26,255), (68,38,14,255))
P_ARCANE  = ((255,255,255,255), (206,232,255,255), (112,164,255,255), (64,74,210,255),  (22,20,66,255))
P_DARK    = ((252,226,255,255), (208,120,255,255), (126,40,214,255),  (48,14,92,255),   (14,4,26,255))
P_WATER   = ((255,255,255,255), (176,238,255,255), (56,164,242,255),  (24,78,176,255),  (10,28,66,255))
P_WIND    = ((255,255,255,255), (212,255,232,255), (104,228,172,255), (42,146,114,255), (14,52,44,255))
P_EARTH   = ((255,242,202,255), (222,174,108,255), (156,104,58,255),  (92,56,34,255),   (34,20,14,255))
P_LEAF    = ((246,255,214,255), (168,242,102,255), (68,186,72,255),   (28,112,46,255),  (14,44,22,255))
P_POISON  = ((246,255,210,255), (192,248,108,255), (156,72,226,255),  (78,24,132,255),  (26,10,44,255))
P_SLEEP   = ((255,246,255,255), (222,196,255,255), (152,120,236,255), (76,54,158,255),  (26,18,58,255))
P_WEAKEN  = ((255,224,234,255), (255,126,154,255), (198,42,92,255),   (104,20,56,255),  (38,8,24,255))
P_SLASH   = ((255,255,255,255), (214,244,255,255), (110,192,255,255), (46,106,220,255), (16,28,68,255))


# ── 1) ICE & MAGE_BLIZZARD (OT2 faceted crystal spire eruption + shatter!) ────
def draw_ice_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_ICE
    rng = random.Random(101 + f)
    # Ground frost seal ring
    if f <= 5:
        rx = 10 + min(f, 3) * 5.5
        ry = rx * 0.34
        ring(im, 32, 54, rx, ry, C_L if f in (2, 3) else C_M, thick=1.5 if f in (2, 3) else 1.0, dash=0 if f <= 3 else 2)
        if f in (1, 2, 3):
            ring(im, 32, 54, rx * 0.65, ry * 0.65, C_W, dash=2)
    # 5 angled faceted crystal spires erupting dynamically!
    # (base_x, base_y, max_h, half_w, tilt)
    spires = [
        (32, 55, 44, 7.5, -2.0),
        (21, 54, 33, 5.5, -6.5),
        (43, 54, 31, 5.5,  6.5),
        (14, 52, 20, 4.0, -9.0),
        (50, 52, 19, 4.0,  9.0),
    ]
    growth = [0.22, 0.58, 1.0, 0.98, 0.86, 0.52, 0.0, 0.0][f]
    if growth > 0:
        # Draw outer spires first, center hero crystal last
        for bx, by, mh, hw, tl in reversed(spires):
            h = mh * growth
            draw_crystal_spire(im, bx, by, h, hw * (0.75 + 0.25 * growth), tl * growth, P_ICE, crack=(f in (3, 4)))
    # Peak flash & crystal shatter burst (frames 3..7)
    if f == 2:
        starburst(im, 32, 26, 9, C_W, C_L, C_M)
    elif f == 3:
        starburst(im, 32, 28, 12, C_W, C_L, C_M)
        starburst(im, 20, 36, 5, C_W, C_L)
        starburst(im, 44, 34, 5, C_W, C_L)
    if f >= 4:
        # Shattered sharp crystal shards exploding outward!
        t = (f - 3) / 4.0
        for i in range(20 if f <= 5 else 14):
            ang = -math.pi * 0.95 + (i / 19.0) * math.pi * 1.15 + (rng.random() - 0.5) * 0.25
            spd = 12 + (i % 4) * 5.5
            sx = 32 + math.cos(ang) * spd * t * 1.45
            sy = 34 + math.sin(ang) * spd * t * 1.35 + (t * t) * 10
            if f <= 5:
                px(im, sx, sy, C_W)
                px(im, sx + 1, sy, C_L)
                px(im, sx, sy + 1, C_M)
                px(im, sx + 1, sy + 1, C_D)
            else:
                px(im, sx, sy, C_W if i % 2 == 0 else C_L)
                if f == 6:
                    px(im, sx + 1, sy, C_M)
    # Swirling frost snow motes
    for i in range(10):
        ang = f * 0.55 + i * 0.9
        sx = 32 + math.cos(ang) * (10 + i * 1.9)
        sy = 50 - f * 4.5 - (i * 4.1) % 34
        px(im, sx, sy, C_W if i % 2 == 0 else C_L)


def draw_mage_blizzard(im, f, n):
    """OT2 Blizzard: swirling frost vortex + massive faceted ice monolith eruption + blizzard storm shatter!"""
    C_W, C_L, C_M, C_D, C_O = P_ICE
    # Diagonal howling blizzard wind streaks across frame!
    for w_i in range(5):
        y0 = 8 + w_i * 11 + ((f * 5) % 10)
        x0 = 62 - ((f * 13 + w_i * 19) % 58)
        ln = 10 + (w_i % 3) * 5
        line_px(im, x0, y0, x0 - ln, y0 + ln * 0.35, C_W if w_i % 2 == 0 else C_L, 1)
    # Frost vortex rings
    if f <= 6:
        for k in range(2):
            ry_off = 52 - k * 14 - f * 1.8
            rx = 16 + math.sin(f * 0.7 + k) * 6 + f * 1.4
            ring(im, 32, ry_off, rx, rx * 0.28, C_W if k == 0 and f == 3 else C_L, dash=2 if f > 4 else 0)
    # Hero crystal prison eruption (contactFrame = 3!)
    spires = [
        (32, 56, 48, 8.5, 0.0),
        (18, 54, 36, 6.0, -7.5),
        (46, 54, 36, 6.0,  7.5),
        (25, 56, 28, 4.5, -3.0),
        (39, 56, 28, 4.5,  3.0),
    ]
    g = [0.18, 0.55, 0.92, 1.0, 0.94, 0.55, 0.0, 0.0][f]
    if g > 0:
        for bx, by, mh, hw, tl in reversed(spires):
            draw_crystal_spire(im, bx, by, mh * g, hw * (0.7 + 0.3 * g), tl * g, P_ICE, crack=(f in (3, 4)))
    if f == 3:
        starburst(im, 32, 26, 15, C_W, C_L, C_M)
        ring(im, 32, 32, 22, 18, C_W, dash=2)
    elif f == 4:
        starburst(im, 32, 28, 10, C_W, C_L)
    if f >= 4:
        t = (f - 3) / 4.0
        rng = random.Random(202 + f)
        for i in range(26 if f <= 6 else 16):
            a = (i / 26.0) * math.pi * 2 + rng.random() * 0.3
            r = 8 + t * (18 + (i % 5) * 4.5)
            sx = 32 + math.cos(a) * r
            sy = 30 + math.sin(a) * r * 0.85
            if f <= 5:
                px(im, sx, sy, C_W); px(im, sx+1, sy, C_L); px(im, sx, sy+1, C_M); px(im, sx-1, sy, C_O)
            else:
                px(im, sx, sy, C_W if i % 2 == 0 else C_L)


def draw_mage_snow(im, f, n):
    """128x128 full-screen howling blizzard snowstorm overlay."""
    C_W, C_L, C_M, C_D, _ = P_ICE
    rng = random.Random(777)
    # 18 sweeping wind ice ribbons
    for i in range(18):
        bx = (rng.randint(0, 127) - f * 18) % 128
        by = (rng.randint(0, 127) + f * 7) % 128
        ln = rng.randint(10, 24)
        col = C_W if i % 3 == 0 else (C_L if i % 3 == 1 else C_M)
        line_px(im, bx, by, bx - ln, by + int(ln * 0.38), col, 1)
    # 36 crisp crystalline snowflakes + diamond ice motes
    for i in range(36):
        sx = (rng.randint(0, 127) - f * (10 + (i % 4) * 4)) % 128
        sy = (rng.randint(0, 127) + f * (5 + (i % 3) * 3)) % 128
        if i % 6 == 0:
            starburst(im, sx, sy, 3, C_W, C_L, diag=False)
        elif i % 3 == 0:
            px(im, sx, sy, C_W); px(im, sx+1, sy, C_L); px(im, sx, sy+1, C_L)
        else:
            px(im, sx, sy, C_W if i % 2 == 0 else C_L)


# ── 2) FIRE, MAGE_FIRE_BURST & MAGE_FIREBALL_ORB ──────────────────────────────
def _flame_pillar(im, f, n, hero=False):
    C_W, C_L, C_M, C_D, C_O = P_FIRE
    rng = random.Random((400 if hero else 300) + f)
    # Ground scorch ring
    if f <= 6:
        rx = 12 + min(f, 3) * (6.0 if hero else 5.0)
        ring(im, 32, 54, rx, rx * 0.32, C_L if f in (2, 3) else C_M, thick=1.5 if f == 2 else 1.0, dash=0 if f <= 3 else 2)
    # Layered roaring flame vortex tongues
    intensity = [0.30, 0.72, 1.0, 0.96, 0.78, 0.52, 0.28, 0.12][min(f, 7)]
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    # Outer crimson/orange roaring fire plumes
    plumes = [
        (32, 54, 46 if hero else 40, 12 if hero else 10, 0.0),
        (23, 54, 34 if hero else 28, 8, -4.5),
        (41, 54, 34 if hero else 28, 8,  4.5),
        (16, 53, 22, 5, -7.0),
        (48, 53, 22, 5,  7.0),
    ]
    # 4 strict passes (crimson -> orange -> gold -> incandescent white core) so bright core is NEVER covered!
    samples = []
    for bx, by, mh, mw, sway in plumes:
        h = mh * intensity
        if h < 4:
            continue
        steps = int(h)
        for dy in range(steps):
            t = dy / max(1, steps - 1)
            y = by - dy
            wiggle = math.sin(t * 5.2 + f * 1.4 + bx * 0.2) * (2.5 + 2.5 * t) + sway * t
            cx = bx + wiggle
            r = mw * ((1.0 - t) ** 0.72) * (0.75 + 0.25 * intensity)
            if r >= 0.7:
                samples.append((cx, y, r, t))
    for cx, y, r, _ in samples:
        disc(layer, cx, y, r, C_D)
    for cx, y, r, t in samples:
        if r > 1.3 and t < 0.92:
            disc(layer, cx, y, r * 0.80, C_M)
    for cx, y, r, t in samples:
        if r > 2.2 and t < 0.78:
            disc(layer, cx, y, r * 0.56, C_L)
    for cx, y, r, t in samples:
        if r > 3.2 and t < 0.56 and f <= 5:
            disc(layer, cx, y, r * 0.34, C_W)
    im.alpha_composite(add_outline_rgba(layer, C_O))
    # Peak flash & rising hot embers
    if f in (2, 3):
        starburst(im, 32, 34, 10 if hero else 8, C_W, C_L, C_M)
    for i in range(18):
        ang = (i / 18.0) * math.pi * 2 + f * 0.4
        ex = 32 + math.cos(ang) * (8 + f * 2.8 + (i % 4) * 2.5)
        ey = 50 - f * 5.8 - (i * 5.3) % 34
        if 2 <= ey <= 58:
            c = C_W if (i + f) % 3 == 0 else (C_L if (i + f) % 3 == 1 else C_M)
            px(im, ex, ey, c)
            if f <= 4 and i % 3 == 0:
                px(im, ex, ey + 1, C_D)


def draw_fire_core(im, f, n):
    _flame_pillar(im, f, n, hero=False)


def draw_mage_fire_burst(im, f, n):
    _flame_pillar(im, f, n, hero=True)


def draw_mage_fireball_orb(im, f, n):
    """32x32 4-frame blazing comet fireball moving left."""
    C_W, C_L, C_M, C_D, C_O = P_FIRE
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    # Trailing flame tail to the right
    for i in range(10):
        t = i / 9.0
        tx = 11 + i * 2.0
        ty = 16 + math.sin(f * 1.6 + i * 0.8) * (2.5 * t)
        r = 6.5 * (1.0 - t * 0.78)
        disc(layer, tx, ty, r, C_D if t > 0.55 else C_M)
        if r > 2.2:
            disc(layer, tx - 0.5, ty, r * 0.62, C_L)
    disc(layer, 10, 16, 6.2, C_M)
    disc(layer, 9.5, 16, 4.4, C_L)
    disc(layer, 9, 16, 2.5, C_W)
    im.alpha_composite(add_outline_rgba(layer, C_O))
    for i in range(6):
        px(im, 16 + (i * 3 + f * 2) % 14, 10 + ((i * 7 + f * 3) % 13), C_W if i % 2 == 0 else C_L)


# ── 3) THUNDER & MAGE_CHAIN_BOLT ──────────────────────────────────────────────
def _lightning_bolt(im, f, n, chain=False):
    C_W, C_L, C_M, C_D, C_O = P_THUNDER
    rng = random.Random((600 if chain else 500) + f * 17)
    # Peak strike frames
    peak = (f in (1, 3)) if chain else (f in (2, 3, 4))
    after = (f in (2, 4, 5)) if chain else (f in (1, 5, 6))
    # Ground electric shock ring
    if f >= 1:
        rx = 10 + min(f, 4) * 5.2
        ring(im, 32, 54, rx, rx * 0.30, C_W if peak else C_L, thick=1.5 if peak else 1.0, dash=0 if peak else 2)
    if peak or after:
        # Build jagged sky-to-ground bolt spine
        pts = [(32 + rng.randint(-6, 6), 0)]
        segs = 7
        for s in range(1, segs + 1):
            y = int(54 * s / segs)
            x = 32 + (0 if s == segs else rng.randint(-12, 12))
            pts.append((x, y))
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        if peak:
            for a, b in zip(pts, pts[1:]):
                line_px(layer, a[0], a[1], b[0], b[1], C_D, width=5)
            for a, b in zip(pts, pts[1:]):
                line_px(layer, a[0], a[1], b[0], b[1], C_M, width=3)
            for a, b in zip(pts, pts[1:]):
                line_px(layer, a[0], a[1], b[0], b[1], C_W, width=1.6)
            # Jagged secondary side branches!
            for idx in (2, 4):
                bx, by = pts[idx]
                sgn = -1 if idx == 2 else 1
                mx, my = bx + sgn * rng.randint(8, 14), by + rng.randint(5, 9)
                ex, ey = mx + sgn * rng.randint(6, 11), my + rng.randint(5, 10)
                line_px(layer, bx, by, mx, my, C_L, width=1.6)
                line_px(layer, mx, my, ex, ey, C_M, width=1)
            im.alpha_composite(add_outline_rgba(layer, C_O))
            starburst(im, 32, 53, 13, C_W, C_L, C_M)
            starburst(im, pts[3][0], pts[3][1], 7, C_W, C_L)
        else:
            # Crackling residual arcs
            for a, b in zip(pts, pts[1:]):
                if rng.random() < 0.72:
                    line_px(layer, a[0], a[1], b[0], b[1], C_D, width=1.4)
                    line_px(layer, a[0], a[1], b[0], b[1], C_L, width=1)
            im.alpha_composite(layer)
            starburst(im, 32, 53, 6, C_W, C_L)
    # Flying electric sparks
    for i in range(14):
        a = (i / 14.0) * math.pi * 2 + f * 0.6
        r = 6 + f * 3.8 + (i % 3) * 3
        px(im, 32 + math.cos(a) * r, 46 + math.sin(a) * r * 0.75, C_W if i % 2 == 0 else C_L)


def draw_thunder_core(im, f, n):
    _lightning_bolt(im, f, n, chain=False)


def draw_mage_chain_bolt(im, f, n):
    _lightning_bolt(im, f, n, chain=True)


# ── 4) HEAL & HOLY ────────────────────────────────────────────────────────────
def draw_heal_core(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_HEAL
    # Glowing emerald-gold perspective ring
    rx = 12 + math.sin(f / (n - 1) * math.pi) * 14
    ring(im, 32, 54, rx, rx * 0.32, C_W if f in (2, 3) else C_L, thick=1.5 if f <= 4 else 1.0, dash=0 if f <= 4 else 2)
    ring(im, 32, 54, rx * 0.65, rx * 0.20, C_M, dash=2)
    # Twin ascending helix ribbons of healing light
    top_y = max(6, 52 - f * 7.5)
    bot_y = min(54, 56 - max(0, f - 3) * 8.5)
    for y in range(int(top_y), int(bot_y)):
        t = (54 - y) / 48.0
        for phase in (0.0, math.pi):
            a = t * 5.5 + f * 0.75 + phase
            x = 32 + math.cos(a) * (13 - t * 3)
            if math.sin(a) >= -0.25:
                px(im, x, y, C_W if math.sin(a) > 0.55 else C_L)
                px(im, x + 1, y, C_M)
    # Rising radiant '+' healing sparkles
    for i in range(10):
        sx = 14 + (i * 19 + f * 3) % 36
        sy = 52 - ((f * 7 + i * 9) % 44)
        if i % 3 == 0:
            starburst(im, sx, sy, 3 if f in (2, 3, 4) else 2, C_W, C_L, diag=False)
        else:
            px(im, sx, sy, C_W if i % 2 == 0 else C_L)
            px(im, sx, sy + 1, C_M)


def draw_holy_core(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_HOLY
    # Celestial pillar of descending golden light
    bw = [3, 8, 13, 15, 11, 6, 3, 0][f]
    if bw > 0:
        p = im.load()
        for y in range(0, 56):
            for dx in range(-bw, bw + 1):
                x = 32 + dx
                ad = abs(dx)
                if ad <= bw * 0.30:
                    col = C_W
                elif ad <= bw * 0.62:
                    col = C_L
                elif ad <= bw * 0.86:
                    if (x + y) & 1:
                        continue
                    col = C_M
                else:
                    if (x + y) % 3 != 0:
                        continue
                    col = C_D
                p[x, y] = col
    # Radiant ground halo & cross star flare
    rx = 10 + min(f, 4) * 5.2
    ring(im, 32, 54, rx, rx * 0.30, C_W if f in (2, 3) else C_L, thick=1.5 if f in (2, 3) else 1.0, dash=0 if f <= 4 else 2)
    if f in (2, 3, 4):
        starburst(im, 32, 30, 14 if f == 3 else 10, C_W, C_L, C_M)
    for i in range(14):
        sx = 12 + (i * 17 + f * 5) % 40
        sy = 52 - ((f * 6 + i * 11) % 48)
        px(im, sx, sy, C_W if i % 2 == 0 else C_L)


# ── 5) ARCANE, MAGE_MISSILE_ORB & MAGE_MISSILE_HIT ───────────────────────────
def draw_arcane_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_ARCANE
    if f <= 2:
        r = 18 - f * 4
        ring(im, 32, 32, r, r, C_L, dash=2)
        for i in range(8):
            a = i * math.pi / 4 + f * 0.4
            px(im, 32 + math.cos(a) * r, 32 + math.sin(a) * r, C_W)
        disc(im, 32, 32, 3 + f * 2.5, C_M)
        disc(im, 32, 32, 1.5 + f * 1.4, C_W)
    elif f <= 4:
        r = 12 + (f - 2) * 8
        ring(im, 32, 32, r, r, C_W if f == 3 else C_L, thick=1.6)
        ring(im, 32, 32, r * 0.65, r * 0.65, C_M, dash=2)
        starburst(im, 32, 32, 18 if f == 3 else 13, C_W, C_L, C_M)
        # Geometric 4-point diamond rune
        d = 10 + (f - 2) * 4
        for a, b in [((32,32-d),(32+d,32)), ((32+d,32),(32,32+d)), ((32,32+d),(32-d,32)), ((32-d,32),(32,32-d))]:
            line_px(im, a[0], a[1], b[0], b[1], C_L, 1)
    else:
        t = (f - 4) / 3.0
        ring(im, 32, 32, 22 + t * 8, 22 + t * 8, C_D, dash=3)
        for i in range(16):
            a = i * math.pi / 8 + 0.2
            r = 10 + t * 19
            sx, sy = 32 + math.cos(a) * r, 32 + math.sin(a) * r
            if i % 4 == 0 and f == 5:
                starburst(im, sx, sy, 3, C_W, C_L, diag=False)
            else:
                px(im, sx, sy, C_W if i % 2 == 0 else C_L)


def draw_mage_missile_orb(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_ARCANE
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for i in range(8):
        tx = 10 + i * 2.3
        ty = 16 + math.sin(f * 1.8 + i * 0.9) * 1.8
        r = 4.2 * (1.0 - i / 9.0)
        disc(layer, tx, ty, r, C_M if i > 2 else C_L)
    disc(layer, 9, 16, 4.8, C_L)
    disc(layer, 8.5, 16, 2.8, C_W)
    im.alpha_composite(add_outline_rgba(layer, C_O))
    starburst(im, 9, 16, 5, C_W, C_L, diag=False)


# ── 6) DARK & MAGE_GRAVITY (NO MS-Paint arrows!) ──────────────────────────────
def draw_dark_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_DARK
    # Swirling abyssal void core + jagged violet rift
    r = [5, 11, 17, 19, 16, 11, 6, 0][f]
    if r > 0:
        disc(im, 32, 32, r, C_O)
        ring(im, 32, 32, r, r, C_M, thick=1.8)
        ring(im, 32, 32, r - 1.5, r - 1.5, C_L if f in (2, 3) else C_D, dash=2)
    # Slashing void crescents cutting across the rift
    if f in (2, 3, 4):
        for sgn in (-1, 1):
            for i in range(-14, 15):
                x = 32 + i
                y = 32 + sgn * i * 0.72 + math.sin(i * 0.25) * 2
                px(im, x, y, C_W if abs(i) < 6 else C_L)
                px(im, x, y + 1, C_M)
    # Orbiting dark shadow wisps
    for i in range(16):
        a = i * math.pi / 8 - f * 0.55
        dist = (24 - f * 1.8) if f <= 3 else (14 + (f - 3) * 4.5)
        sx, sy = 32 + math.cos(a) * dist, 32 + math.sin(a) * dist * 0.85
        px(im, sx, sy, C_W if i % 4 == 0 else (C_L if i % 2 == 0 else C_M))
        if f <= 5:
            px(im, sx + 1, sy, C_D)


def draw_mage_gravity(im, f, n):
    """12-frame OT2 black-hole singularity: tilted accretion disk, inward spacetime streaks, implosion flash!"""
    C_W, C_L, C_M, C_D, C_O = P_DARK
    if f <= 7:
        t = f / 7.0
        core_r = 4 + t * 11
        # Tilted perspective accretion disk behind & around event horizon
        for k in range(3):
            rx = core_r + 5 + k * 4.5
            ry = rx * 0.34
            ring(im, 32, 32, rx, ry, C_L if k == 0 else (C_M if k == 1 else C_D), dash=0 if k == 0 else 2)
        # Inward pulling warped spacetime streaks (replacing old MS-Paint arrows!)
        for i in range(12):
            a = i * math.pi / 6 + f * 0.35
            r_out = 28 - ((f * 3 + i * 5) % 14)
            r_in = max(core_r + 1, r_out - 7)
            line_px(im, 32 + math.cos(a) * r_out, 32 + math.sin(a) * r_out,
                    32 + math.cos(a) * r_in, 32 + math.sin(a) * r_in, C_L if i % 2 == 0 else C_M, 1)
        disc(im, 32, 32, core_r, C_O)
        ring(im, 32, 32, core_r, core_r, C_W if f >= 5 else C_L, thick=1.5)
    elif f in (8, 9):
        # Sudden singularity implosion & white-violet flash!
        cr = 6 if f == 8 else 2
        disc(im, 32, 32, cr + 5, C_M)
        disc(im, 32, 32, cr + 2, C_W)
        starburst(im, 32, 32, 20 if f == 8 else 15, C_W, C_L, C_M)
        ring(im, 32, 32, 16 if f == 8 else 24, 16 if f == 8 else 24, C_L, thick=1.6)
    else:
        # Dissipating gravity shockwave ring & void dust
        r = 24 + (f - 9) * 4
        ring(im, 32, 32, r, r * 0.85, C_M if f == 10 else C_D, dash=2)
        for i in range(14):
            a = i * math.pi / 7 + f * 0.3
            px(im, 32 + math.cos(a) * r, 32 + math.sin(a) * r * 0.85, C_L if i % 2 == 0 else C_D)


# ── 7) MAGE_MANA_SHIELD (10 frames: luminous hexagonal crystal barrier dome) ──
def draw_mage_mana_shield(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_ICE
    # Spinning ground rune circle
    ring(im, 32, 55, 22, 7, C_L if f < 8 else C_D, thick=1.2, dash=0 if f < 7 else 2)
    ring(im, 32, 55, 14, 4.5, C_W if f in (2, 3, 4) else C_M, dash=2)
    # Rising luminous hexagonal barrier dome
    h_frac = min(1.0, (f + 1) / 4.0) if f < 8 else (1.0 - (f - 7) * 0.35)
    top_y = int(54 - 44 * h_frac)
    if h_frac > 0.1:
        # Outer dome contour
        for y in range(max(8, top_y), 55):
            dy = (y - 32) / 24.0
            hw = int(20 * math.sqrt(max(0.0, 1.0 - dy * dy * 0.72)))
            px(im, 32 - hw, y, C_L if (y + f) % 3 else C_W)
            px(im, 32 + hw, y, C_L if (y + f) % 3 else C_W)
            # Subtle dithered translucent crystal fill + hex lattice lines
            for x in range(32 - hw + 1, 32 + hw):
                hex_edge = ((x + y) % 9 == 0) or ((x - y) % 9 == 0) or (y % 9 == 0 and ((x // 4) % 2 == 0))
                shimmer = abs(y - (54 - (f * 6) % 46)) <= 2
                if hex_edge:
                    px(im, x, y, C_W if shimmer else C_M)
                elif shimmer and ((x + y) & 1) == 0:
                    px(im, x, y, C_L)
                elif ((x + y) % 4 == 0) and (y % 2 == 0):
                    px(im, x, y, C_D)
    if f in (3, 4, 5):
        starburst(im, 32, 12, 5, C_W, C_L, diag=False)
        starburst(im, 14, 28, 3, C_W, C_L, diag=False)
        starburst(im, 50, 28, 3, C_W, C_L, diag=False)


# ── 8) MAGE_METEOR_ROCK (32x32, 4f) & MAGE_METEOR_BLAST (64x64, 10f) ─────────
def draw_mage_meteor_rock(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_FIRE
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    # Blazing meteor tail upper-right
    for i in range(9):
        tx = 13 + i * 1.9
        ty = 19 - i * 1.9
        r = 6.5 * (1.0 - i / 10.0)
        disc(layer, tx, ty, r, C_D if i > 4 else C_M)
        if r > 2.2:
            disc(layer, tx - 0.5, ty + 0.5, r * 0.55, C_L)
    # Craggy magma-veined boulder
    disc(layer, 11, 20, 6.2, (74, 46, 38, 255))
    disc(layer, 10, 19, 4.5, (112, 72, 54, 255))
    # Glowing lava cracks on boulder
    line_px(layer, 7, 19, 13, 21, C_L, 1)
    line_px(layer, 10, 16, 12, 23, C_W if f % 2 == 0 else C_M, 1)
    im.alpha_composite(add_outline_rgba(layer, C_O))


def draw_mage_meteor_blast(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_FIRE
    rng = random.Random(909 + f)
    if f <= 1:
        # Incoming meteor plunging down into target!
        mx, my = (46, 12) if f == 0 else (36, 36)
        line_px(im, mx + 14, max(0, my - 18), mx, my, C_M, width=5)
        line_px(im, mx + 12, max(0, my - 16), mx, my, C_L, width=2.5)
        disc(im, mx, my, 6, C_D)
        disc(im, mx - 1, my + 1, 3.5, C_W)
        ring(im, 32, 54, 10 + f * 6, 4 + f * 2, C_M, dash=2)
    elif f in (2, 3):
        # Blinding white-gold shockwave explosion!
        r = 22 if f == 2 else 26
        disc(im, 32, 40, r * 0.85, C_M)
        disc(im, 32, 40, r * 0.62, C_L)
        disc(im, 32, 40, r * 0.38, C_W)
        ring(im, 32, 52, r, r * 0.34, C_W, thick=2.0)
        starburst(im, 32, 40, 22 if f == 2 else 16, C_W, C_L, C_M)
    else:
        # Roaring fiery shockwave plume + flying magma chunks + scorched crater!
        t = (f - 3) / 6.0
        ring(im, 32, 54, 24 + t * 6, 8 + t * 2, C_M if f <= 6 else C_D, dash=2)
        if f <= 7:
            _flame_pillar(im, min(7, f - 1), 8, hero=True)
        for i in range(16):
            a = -math.pi * 0.92 + (i / 15.0) * math.pi * 0.84
            dist = 10 + t * (22 + (i % 4) * 5)
            rx = 32 + math.cos(a) * dist
            ry = 44 + math.sin(a) * dist + t * t * 14
            if 2 <= rx < 62 and 2 <= ry < 60:
                px(im, rx, ry, C_W if f <= 5 and i % 3 == 0 else (C_L if i % 2 == 0 else C_M))
                if f <= 7:
                    px(im, rx + 1, ry + 1, (86, 52, 42, 255))


# ── 9) MAGE_STARFALL_SKY (128x128, 12f) & MAGE_STAR_HIT (64x64, 8f) ──────────
def draw_mage_starfall_sky(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_ARCANE
    G_W, G_L, G_M, _, _ = P_HOLY
    rng = random.Random(1212)
    # 9 diagonal falling starlight comets streaking across the screen
    for i in range(9):
        start_f = i % 5
        local = f - start_f
        if local < 0 or local > 6:
            continue
        sx0 = 28 + (i * 23) % 96
        sy0 = -10 + (i * 11) % 28
        hx = sx0 - local * 15
        hy = sy0 + local * 18
        is_gold = (i % 2 == 0)
        cw, cl, cm = (G_W, G_L, G_M) if is_gold else (C_W, C_L, C_M)
        line_px(im, hx + 22, hy - 26, hx, hy, cm, width=3)
        line_px(im, hx + 16, hy - 19, hx, hy, cl, width=1.6)
        line_px(im, hx + 8, hy - 9, hx, hy, cw, width=1)
        starburst(im, hx, hy, 7 if local in (2, 3, 4) else 4, cw, cl, cm)
    # Shimmering background stardust
    for i in range(28):
        px(im, (rng.randint(0, 127) - f * 4) % 128, (rng.randint(0, 127) + f * 5) % 128, G_L if i % 2 == 0 else C_L)


def draw_mage_star_hit(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_HOLY
    A_L = P_ARCANE[1]
    if f <= 1:
        # Incoming shooting star head
        hx, hy = (44, 12) if f == 0 else (34, 30)
        line_px(im, hx + 14, max(0, hy - 16), hx, hy, C_M, width=3)
        line_px(im, hx + 10, max(0, hy - 12), hx, hy, C_W, width=1.5)
        starburst(im, hx, hy, 8, C_W, C_L, C_M)
    elif f <= 4:
        r = 12 + (f - 1) * 6
        ring(im, 32, 34, r, r * 0.72, C_W if f == 2 else A_L, thick=1.6)
        starburst(im, 32, 34, 20 if f == 2 else 14, C_W, C_L, C_M)
    else:
        t = (f - 4) / 3.0
        for i in range(18):
            a = i * math.pi / 9 + 0.15
            r = 10 + t * 19
            sx, sy = 32 + math.cos(a) * r, 34 + math.sin(a) * r * 0.85
            if i % 5 == 0 and f == 5:
                starburst(im, sx, sy, 3, C_W, C_L, diag=False)
            else:
                px(im, sx, sy, C_W if i % 2 == 0 else A_L)


# ── 10) REMAINING CORE FX: SLASH, KNIFE, WATER, WIND, EARTH, LEAF, POISON, SLEEP, WEAKEN, FOCUS ──
def draw_slash_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_SLASH
    # Cells 0-3: approach combo cuts; cell 4: coil flash; cell 5: biggest finishing impact cleave;
    # cells 6-7: fading finishing cleave recovery (matches animateRetroSkillFx cell 5 impact contract!).
    lens = [10.0, 17.5, 24.0, 19.0, 12.0, 26.5, 23.0, 18.0]
    thicks = [2, 5, 6, 4, 2, 7, 5, 3]
    ln = lens[f]
    thick = thicks[f]
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    # Alternate slash direction on finishing cleave (cells 5-7: opposite diagonal + X cross!)
    sgn = 1 if f <= 4 else -1
    x0, y0 = 32 - ln * 0.85, 32 - sgn * ln * 0.72
    x1, y1 = 32 + ln * 0.85, 32 + sgn * ln * 0.72
    line_px(layer, x0, y0, x1, y1, C_D, width=thick + 2)
    line_px(layer, x0 + 2, y0 + sgn * 2, x1 - 2, y1 - sgn * 2, C_M, width=thick)
    if f <= 6:
        line_px(layer, x0 + 4, y0 + sgn * 3, x1 - 4, y1 - sgn * 3, C_W if f in (2, 3, 5) else C_L, width=max(1, thick - 2))
    if f in (2, 3):
        line_px(layer, 32 + 12, 32 - 10, 32 - 12, 32 + 10, C_L, width=2)
    elif f in (5, 6):
        # Strong X-cleave counter-slash on final impact & recovery
        cln = 18 if f == 5 else 14
        line_px(layer, 32 - cln, 32 - cln * 0.75, 32 + cln, 32 + cln * 0.75, C_M, width=4 if f == 5 else 2)
        line_px(layer, 32 - cln + 3, 32 - (cln - 3) * 0.75, 32 + cln - 3, 32 + (cln - 3) * 0.75, C_W if f == 5 else C_L, width=2 if f == 5 else 1)
    im.alpha_composite(add_outline_rgba(layer, C_O))
    if f in (2, 3, 5, 6):
        arm = {2: 11, 3: 7, 5: 14, 6: 9}[f]
        starburst(im, 32, 32, arm, C_W, C_L, C_M)
    if f >= 2:
        t = (f - 1) / 6.0
        for i in range(14 if f >= 5 else 12):
            a = -0.6 + (i / 13.0) * math.pi * 2
            r = 6 + t * 22
            px(im, 32 + math.cos(a) * r, 32 + math.sin(a) * r * 0.8, C_W if i % 2 == 0 else C_L)


def draw_knife_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_SLASH
    if f <= 2:
        # Fast steel kunai/dagger streak flying into target
        hx = 56 - f * 12
        hy = 32
        line_px(im, min(63, hx + 20), hy, hx, hy, C_M, width=2.2)
        line_px(im, min(63, hx + 12), hy, hx, hy, C_W, width=1.4)
        starburst(im, hx, hy, 4, C_W, C_L, diag=False)
    else:
        # Sharp puncture starburst + spark spray
        t = (f - 2) / 5.0
        if f <= 5:
            starburst(im, 30, 32, 14 if f == 3 else (9 if f == 4 else 5), C_W, C_L, C_M)
        for i in range(12):
            a = -1.2 + (i / 11.0) * 2.4 + (math.pi if i % 2 else 0)
            r = 5 + t * 20
            px(im, 30 + math.cos(a) * r, 32 + math.sin(a) * r, C_W if i % 2 == 0 else C_L)


def draw_water_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_WATER
    rx = 12 + min(f, 4) * 5.2
    ring(im, 32, 54, rx, rx * 0.30, C_W if f in (2, 3) else C_L, thick=1.5 if f <= 3 else 1.0, dash=0 if f <= 4 else 2)
    # Erupting curved geyser splash plumes
    g = [0.25, 0.70, 1.0, 0.94, 0.68, 0.38, 0.0, 0.0][f]
    if g > 0:
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        for sgn in (-1, 0, 1):
            for step in range(22):
                t = step / 21.0
                x = 32 + sgn * (4 + t * 18 * g)
                y = 54 - math.sin(t * math.pi * 0.82) * (38 if sgn == 0 else 28) * g
                r = (5.0 if sgn == 0 else 3.6) * (1.0 - t * 0.65)
                disc(layer, x, y, r, C_D)
                if r > 1.6: disc(layer, x, y - 0.5, r * 0.68, C_M)
                if r > 2.6: disc(layer, x, y - 1, r * 0.38, C_W)
        im.alpha_composite(add_outline_rgba(layer, C_O))
    # Flying foam droplets
    for i in range(18):
        a = -math.pi * 0.95 + (i / 17.0) * math.pi * 0.9
        t = f / 7.0
        dx = 32 + math.cos(a) * (10 + t * 24)
        dy = 42 + math.sin(a) * (14 + t * 20) + t * t * 14
        px(im, dx, dy, C_W if i % 2 == 0 else C_L)
        if f <= 5: px(im, dx, dy + 1, C_M)


def draw_wind_core(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_WIND
    # 3 sweeping razor gale crescents spiraling around target
    for k in range(3):
        cy = 50 - k * 14 - f * 2.2
        rx = 16 + k * 3 + math.sin(f * 0.8 + k) * 4
        start_a = f * 0.9 + k * 2.1
        for i in range(28):
            t = i / 27.0
            a = start_a + t * 2.4
            x = 32 + math.cos(a) * rx
            y = cy + math.sin(a) * (rx * 0.34)
            col = C_W if 0.35 < t < 0.72 else (C_L if 0.15 < t < 0.88 else C_M)
            px(im, x, y, col)
            if 0.25 < t < 0.8:
                px(im, x, y + 1, C_M if t < 0.65 else C_D)
    for i in range(12):
        sx = (60 - f * 9 + i * 11) % 62
        sy = 10 + (i * 13 + f * 3) % 44
        line_px(im, sx, sy, max(0, sx - 5), sy + 1, C_W if i % 2 == 0 else C_L, 1)


def draw_earth_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_EARTH
    # Ground seismic crack ring
    ring(im, 32, 55, 14 + min(f, 4) * 4.5, 5 + min(f, 4) * 1.2, C_D, thick=1.5, dash=2 if f > 4 else 0)
    # Jagged erupting rocky spires
    g = [0.22, 0.70, 1.0, 0.95, 0.75, 0.42, 0.0, 0.0][f]
    if g > 0:
        for bx, by, mh, hw, tl in [(18,55,26,6,-5), (46,55,26,6,5), (32,56,40,9,0)]:
            draw_crystal_spire(im, bx, by, mh * g, hw * (0.8 + 0.2 * g), tl * g, P_EARTH, crack=(f in (2, 3)))
    # Flying rock chunks & dust clouds
    t = f / 7.0
    for i in range(16):
        a = -math.pi * 0.92 + (i / 15.0) * math.pi * 0.84
        dist = 8 + t * (18 + (i % 4) * 4)
        rx = 32 + math.cos(a) * dist
        ry = 48 + math.sin(a) * dist + t * t * 14
        if f <= 6:
            px(im, rx, ry, C_L); px(im, rx+1, ry, C_M); px(im, rx, ry+1, C_D); px(im, rx+1, ry+1, C_O)
        else:
            px(im, rx, ry, C_M)


def draw_leaf_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_LEAF
    # Swirling razor emerald leaf storm
    for k in range(2):
        ring(im, 32, 36 - k * 8, 16 + f * 1.8, 7 + f * 0.5, C_L if k == 0 else C_M, dash=3)
    for i in range(14):
        a = i * math.pi / 7 + f * 0.65
        r = 8 + (f * 2.6) + (i % 3) * 4
        lx = 32 + math.cos(a) * r
        ly = 42 - f * 2.5 + math.sin(a) * (r * 0.55)
        if 3 <= lx < 60 and 3 <= ly < 60:
            # Crisp 4px diamond leaf
            px(im, lx, ly, C_W)
            px(im, lx + 1, ly, C_L)
            px(im, lx - 1, ly + 1, C_M)
            px(im, lx, ly + 1, C_M)
            px(im, lx + 1, ly + 1, C_D)


def draw_poison_core(im, f, n):
    C_W, C_L, C_M, C_D, C_O = P_POISON
    ring(im, 32, 54, 14 + f * 2, 5 + f * 0.6, C_M if f <= 4 else C_D, dash=2)
    # Rising bubbling toxic orbs & acid splash
    rng = random.Random(333)
    for i in range(12):
        bx = 16 + rng.randint(0, 32) + math.sin(f * 0.9 + i) * 3
        by = 52 - ((f * 7 + i * 7) % 44)
        r = 3.6 if (i + f) % 4 == 0 else 2.4
        if f >= 6: r *= 0.65
        if r >= 1.5:
            disc(im, bx, by, r + 0.7, C_O)
            disc(im, bx, by, r, C_M if i % 2 == 0 else C_D)
            px(im, bx - 1, by - 1, C_L if i % 2 == 0 else C_W)


def draw_sleep_core(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_SLEEP
    # Floating hypnotic dreamy concentric rings & glowing sleep motes
    for k in range(3):
        cy = 48 - k * 12 - f * 2.0
        rx = 10 + (f * 2.2 + k * 4) % 18
        ring(im, 32, cy, rx, rx * 0.32, C_W if k == 0 else (C_L if k == 1 else C_M), dash=2)
    # Floating pixel 'Z' drift
    zx, zy = 38 + int(math.sin(f * 0.7) * 3), 36 - f * 3
    if zy >= 6:
        for dx in range(5): px(im, zx + dx, zy, C_W); px(im, zx + dx, zy + 4, C_L)
        for d in range(1, 4): px(im, zx + 4 - d, zy + d, C_W)
    for i in range(10):
        px(im, 14 + (i * 13 + f * 3) % 36, 48 - ((f * 5 + i * 8) % 38), C_W if i % 2 == 0 else C_L)


def draw_weaken_core(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_WEAKEN
    # Descending crimson-violet binding rings crushing downward
    for k in range(3):
        cy = 10 + k * 14 + f * 3.5
        if cy <= 56:
            rx = 18 - k * 2
            ring(im, 32, cy, rx, rx * 0.30, C_W if k == 0 and f <= 3 else (C_L if k == 1 else C_M), thick=1.4)
    # Shattering crimson shards drifting down
    for i in range(12):
        sx = 16 + (i * 11) % 32
        sy = 14 + ((f * 6 + i * 9) % 42)
        px(im, sx, sy, C_W if i % 3 == 0 else C_L)
        px(im, sx, sy + 1, C_M)
        px(im, sx, sy + 2, C_D)


def draw_focus_core(im, f, n):
    C_W, C_L, C_M, C_D, _ = P_HOLY
    # Golden OT2 Boost/Focus warrior aura pillar + rising flame motes
    rx = 16 + math.sin(f / 7.0 * math.pi) * 8
    ring(im, 32, 55, rx, rx * 0.30, C_W if f in (2, 3, 4) else C_L, thick=1.6)
    for x_off in (-14, -7, 0, 7, 14):
        h = (22 + (14 if x_off == 0 else (8 if abs(x_off) == 7 else 0))) * (0.4 + 0.6 * math.sin(f / 7.0 * math.pi))
        for dy in range(int(h)):
            y = 54 - dy
            if (dy + f) % 2 == 0 or abs(x_off) <= 7:
                px(im, 32 + x_off, y, C_W if dy < h * 0.35 else (C_L if dy < h * 0.72 else C_M))
    if f in (2, 3, 4):
        starburst(im, 32, 22, 9 if f == 3 else 6, C_W, C_L, C_M)
    for i in range(14):
        sx = 14 + (i * 13) % 36
        sy = 54 - ((f * 7 + i * 9) % 46)
        px(im, sx, sy, C_W if i % 2 == 0 else C_L)


TARGETS = [
    # Core 17 (512x64 = 8 frames @ 64)
    ("ice",               8,  64, draw_ice_core),
    ("fire",              8,  64, draw_fire_core),
    ("thunder",           8,  64, draw_thunder_core),
    ("heal",              8,  64, draw_heal_core),
    ("holy",              8,  64, draw_holy_core),
    ("arcane",            8,  64, draw_arcane_core),
    ("dark",              8,  64, draw_dark_core),
    ("slash",             8,  64, draw_slash_core),
    ("knife",             8,  64, draw_knife_core),
    ("water",             8,  64, draw_water_core),
    ("wind",              8,  64, draw_wind_core),
    ("earth",             8,  64, draw_earth_core),
    ("leaf",              8,  64, draw_leaf_core),
    ("poison",            8,  64, draw_poison_core),
    ("sleep",             8,  64, draw_sleep_core),
    ("weaken",            8,  64, draw_weaken_core),
    ("focus",             8,  64, draw_focus_core),
    # Mage 13 (exact dimensions & frame counts preserved!)
    ("mage_blizzard",     8,  64, draw_mage_blizzard),
    ("mage_snow",         8, 128, draw_mage_snow),
    ("mage_fire_burst",   8,  64, draw_mage_fire_burst),
    ("mage_fireball_orb", 4,  32, draw_mage_fireball_orb),
    ("mage_chain_bolt",   7,  64, draw_mage_chain_bolt),
    ("mage_gravity",     12,  64, draw_mage_gravity),
    ("mage_mana_shield", 10,  64, draw_mage_mana_shield),
    ("mage_meteor_rock",  4,  32, draw_mage_meteor_rock),
    ("mage_meteor_blast",10,  64, draw_mage_meteor_blast),
    ("mage_missile_orb",  4,  32, draw_mage_missile_orb),
    ("mage_missile_hit",  8,  64, draw_arcane_core),
    ("mage_starfall_sky",12, 128, draw_mage_starfall_sky),
    ("mage_star_hit",     8,  64, draw_mage_star_hit),
]


def main():
    for name, frames, size, fn in TARGETS:
        path = FX_DIR / f"{name}.png"
        if path.exists():
            orig = Image.open(path)
            assert orig.size == (frames * size, size), f"{name}: expected {orig.size}, got {(frames * size, size)}"
        im = build_strip(frames, size, fn)
        im.save(path, optimize=True)
        print(f"  remade {name:20s} ({im.width}x{im.height}, {frames}f)")
    print(f"Done! Remade {len(TARGETS)} pixel-fx sheets.")


if __name__ == "__main__":
    main()
