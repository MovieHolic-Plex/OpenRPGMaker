#!/usr/bin/env python3
"""
Source-preserving pixel-art animator for `interactive-props`.

Core invariant:
- Frame 0 (or Frame 3/4 for ignited lamps/braziers) preserves the EXACT original
  high-quality repository PNG pixel-for-pixel.
- Every animated frame transforms real pixel regions extracted from the original
  sprite (perspective-projected real door panels, extruded real drawer fronts,
  interpolated real closed/open pairs, Voronoi-fractured real textured shards,
  real chassis with animated flame/screen/dispenser details) and derives any
  newly exposed interior/cavity colors directly from the original sprite's palette.
"""
from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Callable, Iterable, Sequence

from PIL import Image, ImageDraw

RGBA = tuple[int, int, int, int]


def load_rgba(path: str | Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def clamp(v: int, lo: int = 0, hi: int = 255) -> int:
    return lo if v < lo else hi if v > hi else v


def scale_rgb(c: RGBA, factor: float, alpha: int | None = None) -> RGBA:
    r, g, b, a = c
    return (
        clamp(int(round(r * factor))),
        clamp(int(round(g * factor))),
        clamp(int(round(b * factor))),
        a if alpha is None else alpha,
    )


def tint_rgb(c: RGBA, target: tuple[int, int, int], t: float) -> RGBA:
    r, g, b, a = c
    tr, tg, tb = target
    return (
        clamp(int(round(r + (tr - r) * t))),
        clamp(int(round(g + (tg - g) * t))),
        clamp(int(round(b + (tb - b) * t))),
        a,
    )


def sample_palette_tones(im: Image.Image, box: tuple[int, int, int, int] | None = None) -> list[RGBA]:
    """Return sorted opaque colors (darkest -> brightest) from an image or sub-box."""
    sub = im.crop(box) if box else im
    cols = []
    for p in getattr(sub, "get_flattened_data", sub.getdata)():
        if p[3] >= 200:
            cols.append(p)
    if not cols:
        return [(40, 32, 28, 255), (100, 82, 68, 255), (170, 145, 118, 255)]
    # deduplicate keeping brightness order
    uniq = sorted(set(cols), key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    return uniq


def pick_tone(tones: list[RGBA], frac: float) -> RGBA:
    idx = min(len(tones) - 1, max(0, int(round(frac * (len(tones) - 1)))))
    return tones[idx]


def make_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def paste_over(dst: Image.Image, src: Image.Image, x: int, y: int) -> None:
    """Alpha-composite src onto dst at (x, y), safely clipping out-of-bounds."""
    sw, sh = src.size
    dw, dh = dst.size
    sx0 = max(0, -x)
    sy0 = max(0, -y)
    dx0 = max(0, x)
    dy0 = max(0, y)
    cw = min(sw - sx0, dw - dx0)
    ch = min(sh - sy0, dh - dy0)
    if cw <= 0 or ch <= 0:
        return
    crop = src.crop((sx0, sy0, sx0 + cw, sy0 + ch))
    dst.alpha_composite(crop, (dx0, dy0))


def pack_strip(frames: Sequence[Image.Image]) -> Image.Image:
    fw, fh = frames[0].size
    strip = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.paste(fr, (i * fw, 0))
    return strip


def draw_shaded_cavity(
    im: Image.Image,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    tones: list[RGBA],
    shelves: Sequence[int] = (),
    contents: str = "clothes",
) -> None:
    """Paint a richly shaded cabinet interior using colors derived from the original sprite."""
    if contents == "transparent":
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                im.putpixel((x, y), (0, 0, 0, 0))
        return
    dark0 = scale_rgb(pick_tone(tones, 0.05), 0.42)
    dark1 = scale_rgb(pick_tone(tones, 0.10), 0.58)
    wall_l = scale_rgb(pick_tone(tones, 0.22), 0.72)
    shelf_top = scale_rgb(pick_tone(tones, 0.45), 0.85)
    shelf_bot = scale_rgb(pick_tone(tones, 0.18), 0.65)

    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            # Subtle vignette depth: darker at top & back corners
            if y <= y0 + 1 or x == x0 or x == x1:
                c = dark0
            elif y <= y0 + 3:
                c = dark1
            else:
                # subtle vertical wood plank grain inside
                c = dark1 if ((x - x0) % 4 == 0) else wall_l
                if (x + y) % 7 == 0:
                    c = scale_rgb(c, 0.90)
            im.putpixel((x, y), c)

    # Interior contents (textured, warm/harmonious pixel art, never flat neon)
    w = x1 - x0 + 1
    h = y1 - y0 + 1
    if contents == "clothes" and w >= 12 and h >= 14:
        # Hanging rod near top
        rod_y = y0 + 3
        for x in range(x0 + 1, x1):
            im.putpixel((x, rod_y), (186, 168, 134, 255) if (x % 3 != 0) else (138, 120, 92, 255))
        # Hanging garments in muted RPG tones (burgundy coat, cream shirt, slate tunic, sage cloak)
        garments = [
            ((128, 54, 52, 255), (156, 72, 68, 255), (84, 34, 34, 255)),
            ((186, 174, 148, 255), (212, 200, 176, 255), (126, 114, 94, 255)),
            ((66, 92, 118, 255), (88, 118, 148, 255), (42, 60, 80, 255)),
            ((82, 108, 76, 255), (108, 136, 98, 255), (52, 70, 48, 255)),
        ]
        g_w = max(3, (w - 4) // 4)
        for gi, (mid, hi, sh) in enumerate(garments):
            gx0 = x0 + 2 + gi * g_w
            gx1 = min(x1 - 1, gx0 + g_w - 1)
            gy1 = min(y1 - 4, rod_y + 11 + (gi % 2) * 2)
            for y in range(rod_y + 1, gy1 + 1):
                for x in range(gx0, gx1 + 1):
                    if y == rod_y + 1:
                        c = hi if x == gx0 + 1 else mid
                    elif x == gx0:
                        c = hi if (y % 3 != 0) else mid
                    elif x == gx1:
                        c = sh
                    else:
                        c = mid if ((x + y) % 3 != 0) else sh
                    im.putpixel((x, y), c)
        # Folded cloth stack at bottom
        if y1 - 3 > rod_y + 10:
            for x in range(x0 + 2, x1 - 1):
                im.putpixel((x, y1 - 2), (176, 152, 118, 255) if x % 2 == 0 else (154, 130, 98, 255))
                im.putpixel((x, y1 - 1), (126, 102, 74, 255))
    elif contents == "locker" and w >= 5 and h >= 6:
        # Shelf + notebook / bottle inside school locker
        sy = y0 + h // 2
        for x in range(x0 + 1, x1):
            im.putpixel((x, sy), scale_rgb(pick_tone(tones, 0.5), 0.78))
        # Books on top shelf
        if sy - 2 >= y0 + 1:
            im.putpixel((x0 + 1, sy - 1), (168, 72, 68, 255))
            im.putpixel((x0 + 1, sy - 2), (188, 92, 86, 255))
            if x0 + 2 < x1:
                im.putpixel((x0 + 2, sy - 1), (78, 128, 174, 255))
                im.putpixel((x0 + 2, sy - 2), (98, 150, 198, 255))
            if x0 + 3 < x1:
                im.putpixel((x0 + 3, sy - 1), (206, 188, 132, 255))
        # Bag on bottom
        for x in range(x0 + 1, min(x1, x0 + 4)):
            im.putpixel((x, y1 - 1), (74, 88, 110, 255))

    for sy in shelves:
        if y0 < sy < y1:
            for x in range(x0 + 1, x1):
                im.putpixel((x, sy), shelf_top)
                if sy + 1 <= y1:
                    im.putpixel((x, sy + 1), shelf_bot)


def project_real_door(
    dst: Image.Image,
    door_img: Image.Image,
    hinge_x: int,
    door_y: int,
    side: str,  # "left" or "right"
    angle_deg: float,
    back_tones: list[RGBA],
) -> None:
    """
    Perspective-project an ACTUAL cut-out door pixel texture along a true 3/4
    top-down circular swing arc (0° closed -> 90° straight toward camera -> 145° wide open).
    """
    dw, dh = door_img.size
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)

    # Projected horizontal span and vertical 3/4 foreshortening drop
    horiz_span = dw * cos_a  # positive when < 90°, negative when > 90° (swung past hinge)
    y_drop_tip = sin_a * max(2.2, dw * 0.34)

    # Number of screen columns to rasterize across the projected door
    steps = max(2, int(round(abs(horiz_span))))
    showing_back = angle_deg > 92.0

    # Rim/thickness color from the original door palette
    rim_hi = scale_rgb(pick_tone(back_tones, 0.55), 0.92)
    rim_mid = scale_rgb(pick_tone(back_tones, 0.30), 0.80)
    rim_dark = scale_rgb(pick_tone(back_tones, 0.08), 0.65)
    back_panel = scale_rgb(pick_tone(back_tones, 0.25), 0.76)
    back_frame = scale_rgb(pick_tone(back_tones, 0.42), 0.84)

    # Draw subtle ground/cabinet cast shadow under the swinging door
    for s in range(steps + 1):
        u = s / max(1, steps)
        if side == "left":
            px = int(round(hinge_x + u * horiz_span))
        else:
            px = int(round(hinge_x - u * horiz_span))
        py_bot = int(round(door_y + dh + u * y_drop_tip))
        for sy in range(py_bot, min(dst.height, py_bot + 2)):
            if 0 <= px < dst.width:
                cur = dst.getpixel((px, sy))
                if cur[3] == 0:
                    dst.putpixel((px, sy), (18, 16, 24, 65))
                else:
                    dst.putpixel((px, sy), scale_rgb(cur, 0.72))

    # Special crisp side-edge thickness around 80°..100° (door facing straight toward viewer)
    if 75.0 <= angle_deg <= 105.0:
        edge_len = max(3, int(round(sin_a * dw * 0.42)))
        thick = 2
        for dy_step in range(edge_len + 1):
            # Door swings slightly forward & down
            py0 = door_y + dy_step
            for tx in range(thick):
                px = (hinge_x + tx) if side == "left" else (hinge_x - tx)
                if not (0 <= px < dst.width):
                    continue
                for y in range(dh):
                    yy = py0 + y
                    if 0 <= yy < dst.height:
                        if tx == 0:
                            c = rim_hi if (y % 4 != 0) else rim_mid
                        else:
                            c = rim_dark
                        dst.putpixel((px, yy), c)
        # Top edge cap (3/4 thickness visible from above!)
        for dy_step in range(edge_len + 1):
            py = door_y + dy_step
            for tx in range(thick):
                px = (hinge_x + tx) if side == "left" else (hinge_x - tx)
                if 0 <= px < dst.width and 0 <= py < dst.height:
                    dst.putpixel((px, py), rim_hi if tx == 0 else rim_mid)
        return

    # Rasterize EVERY integer pixel column from hinge_x to tip_x (zero 1px rounding gaps!)
    shade = 0.88 + 0.14 * abs(cos_a) if not showing_back else 0.80 + 0.12 * abs(cos_a)
    tip_x = int(round(hinge_x + horiz_span)) if side == "left" else int(round(hinge_x - horiz_span))
    col_step = 1 if tip_x >= hinge_x else -1
    col_xs = list(range(hinge_x, tip_x + col_step, col_step))
    total_cols = max(1, len(col_xs) - 1)

    for s, px in enumerate(col_xs):
        u = s / total_cols
        if side == "left":
            src_x = min(dw - 1, max(0, int(round(u * (dw - 1)))))
        else:
            src_x = min(dw - 1, max(0, int(round((1.0 - u) * (dw - 1)))))
        if not (0 <= px < dst.width):
            continue
        dy = int(round(u * y_drop_tip))
        for y in range(dh):
            yy = door_y + y + dy
            if not (0 <= yy < dst.height):
                continue
            orig_c = door_img.getpixel((src_x, y))
            if orig_c[3] < 128:
                continue
            if not showing_back:
                c = scale_rgb(orig_c, shade)
            else:
                # Backside of the door: subtle recessed wood frame derived from original door tones
                is_border = (y <= 1 or y >= dh - 2 or s == 0 or s == len(col_xs) - 1)
                if is_border:
                    c = rim_dark if (s == len(col_xs) - 1 or y == dh - 1) else back_frame
                else:
                    # Preserve subtle horizontal/vertical grain from original door brightness
                    lum_var = 0.90 + 0.20 * ((orig_c[0] + orig_c[1] + orig_c[2]) / 765.0)
                    c = scale_rgb(back_panel, lum_var)
            dst.putpixel((px, yy), c)
        # Crisp 1px top edge highlight (3/4 thickness)
        top_y = door_y + dy - 1
        if 0 <= top_y < dst.height and angle_deg >= 25.0:
            dst.putpixel((px, top_y), rim_hi if not showing_back else rim_mid)


def animate_real_pair_chest(closed_path: str, open_path: str) -> list[Image.Image]:
    """
    Build a 5-frame animation between a REAL closed PNG and REAL open PNG pair
    (e.g., treasure_chest_closed.png -> treasure_chest_open.png).
    Frame 0 = exact closed PNG.
    Frame 4 = exact open PNG.
    Frames 1-3 = real-pixel lid lifting & golden gleam.
    """
    f0 = load_rgba(closed_path)
    f4 = load_rgba(open_path)
    w, h = f0.size

    # Find horizontal seam on closed chest (rows 12..20 are lid, 21..30 are base)
    seam_y = 20
    lid_closed = f0.crop((0, 0, w, seam_y))
    base_closed = f0.crop((0, seam_y, w, h))
    # Open chest top half (opened lid + gold interior)
    open_upper = f4.crop((0, 0, w, seam_y + 2))

    # Frame 1: lid unlatched, lifted 2px with narrow golden slit
    f1 = make_canvas(w, h)
    paste_over(f1, base_closed, 0, seam_y)
    # Dark+gold slit at seam_y-1..seam_y
    for x in range(5, w - 5):
        f1.putpixel((x, seam_y - 1), (42, 28, 18, 255))
        if 9 <= x <= w - 10:
            f1.putpixel((x, seam_y - 1), (222, 184, 78, 255) if x % 2 == 0 else (164, 122, 46, 255))
    paste_over(f1, lid_closed, 0, -2)

    # Frame 2: lid halfway hinged up (real open interior peeking + foreshortened real lid)
    f2 = f4.copy()
    # Cover upper open lid area with mid-angle lid derived from real closed lid + open underside
    lid_crop = f0.crop((3, 12, 29, 20))  # 26x8 real lid
    lid_mid = lid_crop.resize((26, 6), Image.NEAREST)
    # Shift open interior slightly lower / darker before full reveal
    f2_img = make_canvas(w, h)
    paste_over(f2_img, f4.crop((0, 16, w, h)), 0, 16)
    paste_over(f2_img, lid_mid, 3, 9)
    # Subtle warm highlight along lid front lip
    for x in range(5, 27):
        c = f2_img.getpixel((x, 14))
        if c[3] > 0:
            f2_img.putpixel((x, 14), scale_rgb(c, 1.18))
    f2 = f2_img

    # Frame 3: exact open chest + bright golden treasure sparkle rising
    f3 = f4.copy()
    spark_pts = [
        (15, 16, (255, 248, 198, 255)),
        (15, 15, (255, 232, 134, 220)),
        (15, 17, (255, 232, 134, 220)),
        (14, 16, (255, 232, 134, 220)),
        (16, 16, (255, 232, 134, 220)),
        (10, 18, (255, 242, 178, 230)),
        (21, 17, (255, 242, 178, 230)),
        (15, 12, (255, 246, 194, 180)),
    ]
    for sx, sy, sc in spark_pts:
        if 0 <= sx < w and 0 <= sy < h:
            f3.putpixel((sx, sy), sc)

    return [f0, f1, f2, f3, f4]


def animate_double_door_from_source(
    src_path: str,
    left_box: tuple[int, int, int, int],
    right_box: tuple[int, int, int, int],
    cavity_box: tuple[int, int, int, int],
    pad_x: int = 8,
    pad_y_top: int = 0,
    pad_y_bot: int = 4,
    contents: str = "clothes",
    shelves: Sequence[int] = (),
) -> list[Image.Image]:
    """
    Animate a real double-door cabinet/wardrobe with Frame 0 = exact original PNG.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    fw = sw + pad_x * 2
    fh = sh + pad_y_top + pad_y_bot
    ox, oy = pad_x, pad_y_top

    tones = sample_palette_tones(src, cavity_box)
    door_l = src.crop((left_box[0], left_box[1], left_box[2] + 1, left_box[3] + 1))
    door_r = src.crop((right_box[0], right_box[1], right_box[2] + 1, right_box[3] + 1))

    angles = [0.0, 38.0, 86.0, 124.0, 146.0]
    frames: list[Image.Image] = []
    for i, ang in enumerate(angles):
        fr = make_canvas(fw, fh)
        paste_over(fr, src, ox, oy)
        if i == 0:
            frames.append(fr)
            continue
        # Paint richly shaded interior cavity inside the cabinet opening
        draw_shaded_cavity(
            fr,
            ox + cavity_box[0],
            oy + cavity_box[1],
            ox + cavity_box[2],
            oy + cavity_box[3],
            tones,
            shelves=[oy + s for s in shelves],
            contents=contents,
        )
        # Perspective-project BOTH actual wood-textured doors along their 3/4 swing arcs
        project_real_door(fr, door_l, ox + left_box[0], oy + left_box[1], "left", ang, tones)
        project_real_door(fr, door_r, ox + right_box[2], oy + right_box[1], "right", ang, tones)
        frames.append(fr)
    return frames


def animate_single_door_from_source(
    src_path: str,
    door_box: tuple[int, int, int, int],
    side: str = "left",
    pad_x: int = 4,
    pad_y_bot: int = 2,
    contents: str = "locker",
) -> list[Image.Image]:
    """Animate a single swinging door on a real multi-compartment prop (locker, fridge, etc.)."""
    src = load_rgba(src_path)
    sw, sh = src.size
    fw, fh = sw + pad_x * 2, sh + pad_y_bot
    ox, oy = pad_x, 0
    tones = sample_palette_tones(src, door_box)
    door_img = src.crop((door_box[0], door_box[1], door_box[2] + 1, door_box[3] + 1))

    angles = [0.0, 38.0, 86.0, 122.0, 142.0]
    frames: list[Image.Image] = []
    for i, ang in enumerate(angles):
        fr = make_canvas(fw, fh)
        paste_over(fr, src, ox, oy)
        if i == 0:
            frames.append(fr)
            continue
        draw_shaded_cavity(
            fr,
            ox + door_box[0],
            oy + door_box[1],
            ox + door_box[2],
            oy + door_box[3],
            tones,
            contents=contents,
        )
        hinge = (ox + door_box[0]) if side == "left" else (ox + door_box[2])
        project_real_door(fr, door_img, hinge, oy + door_box[1], side, ang, tones)
        frames.append(fr)
    return frames


def animate_drawers_from_source(
    src_path: str,
    drawer_boxes: Sequence[tuple[int, int, int, int]],
    pulls_per_frame: Sequence[Sequence[int]],
    pad_y_bot: int = 4,
) -> list[Image.Image]:
    """
    Pull ACTUAL textured drawer fronts forward along the 3/4 view axis,
    revealing wooden side walls, dark cavity, and subtle RPG contents.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    fw, fh = sw, sh + pad_y_bot
    tones = sample_palette_tones(src)
    cav_dark = scale_rgb(pick_tone(tones, 0.05), 0.40)
    side_wood = scale_rgb(pick_tone(tones, 0.45), 0.90)
    side_dark = scale_rgb(pick_tone(tones, 0.18), 0.72)

    drawer_imgs = [src.crop((b[0], b[1], b[2] + 1, b[3] + 1)) for b in drawer_boxes]
    frames: list[Image.Image] = []

    for fi, pulls in enumerate(pulls_per_frame):
        fr = make_canvas(fw, fh)
        paste_over(fr, src, 0, 0)
        if fi == 0:
            frames.append(fr)
            continue
        # Draw from top drawer to bottom so lower pulled drawers naturally overlap correctly
        for idx, (box, pull) in enumerate(zip(drawer_boxes, pulls)):
            if pull <= 0:
                continue
            x0, y0, x1, y1 = box
            # Carve cavity behind pulled drawer
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    fr.putpixel((x, y), cav_dark)
            # Inside drawer tray visible between y0 and y0 + pull
            for y in range(y0, y0 + pull):
                for x in range(x0, x1 + 1):
                    if x == x0 or x == x1:
                        fr.putpixel((x, y), side_wood)
                    elif y == y0:
                        fr.putpixel((x, y), side_dark)
                    else:
                        # Subtle parchment/cloth contents inside open drawer
                        if idx == 0 and x0 + 2 <= x <= x0 + 6:
                            fr.putpixel((x, y), (220, 206, 174, 255) if x % 2 == 0 else (196, 180, 148, 255))
                        elif idx == 0 and x1 - 4 <= x <= x1 - 2:
                            fr.putpixel((x, y), (218, 178, 76, 255))
                        else:
                            fr.putpixel((x, y), scale_rgb(side_dark, 0.72))
            # Cast shadow directly below the pulled-out drawer front
            sh_y = y1 + pull + 1
            if 0 <= sh_y < fh:
                for x in range(x0, x1 + 1):
                    cur = fr.getpixel((x, sh_y))
                    if cur[3] > 0:
                        fr.putpixel((x, sh_y), scale_rgb(cur, 0.55))
            # Paste the REAL original drawer front shifted downward by `pull`
            paste_over(fr, drawer_imgs[idx], x0, y0 + pull)
            # Highlight top lip of pulled drawer
            for x in range(x0, x1 + 1):
                c = fr.getpixel((x, y0 + pull))
                if c[3] > 0:
                    fr.putpixel((x, y0 + pull), scale_rgb(c, 1.15))
        frames.append(fr)
    return frames


def animate_hinged_lid_from_source(
    src_path: str,
    lid_box: tuple[int, int, int, int],
    seam_y: int,
    loot_style: str = "gold",
) -> list[Image.Image]:
    """
    Hinge-open the REAL lid pixels of a chest/strongbox/toolbox/cooler upward.
    Frame 0 = exact original PNG.
    """
    src = load_rgba(src_path)
    w, h = src.size
    x0, y0, x1, y1 = lid_box
    lw = x1 - x0 + 1
    lh = y1 - y0 + 1
    tones = sample_palette_tones(src, lid_box)
    lid_img = src.crop((x0, y0, x1 + 1, y1 + 1))

    cav_dark = scale_rgb(pick_tone(tones, 0.04), 0.35)
    under_mid = scale_rgb(pick_tone(tones, 0.22), 0.72)
    under_rim = scale_rgb(pick_tone(tones, 0.55), 0.90)

    # Progress states: (lid_scale_y, cavity_h, show_underside, sparkle)
    # Lid bottom is ALWAYS physically hinged to cavity top (zero floating gap!)
    states = [
        (1.0, 0, False, False),
        (0.95, 2, False, False),
        (0.82, 5, True, False),
        (0.88, 6, True, True),
        (0.88, 6, True, False),
    ]
    frames: list[Image.Image] = []
    for fi, (sy, cav_h, underside, sparkle) in enumerate(states):
        if fi == 0:
            frames.append(src.copy())
            continue
        fr = make_canvas(w, h)
        # Paste lower body from seam_y down (100% original!)
        paste_over(fr, src.crop((0, seam_y, w, h)), 0, seam_y)
        # Paint interior cavity just above seam_y
        cy0 = max(0, seam_y - cav_h)
        for y in range(cy0, seam_y):
            for x in range(x0, x1 + 1):
                if x == x0 or x == x1 or y == cy0:
                    fr.putpixel((x, y), scale_rgb(pick_tone(tones, 0.35), 0.78))
                else:
                    fr.putpixel((x, y), cav_dark)
        # Loot inside cavity
        if cav_h >= 4 and loot_style == "gold":
            for gx in range(x0 + 4, x1 - 3):
                for gy in range(seam_y - 3, seam_y):
                    if (gx + gy) % 3 == 0:
                        fr.putpixel((gx, gy), (242, 204, 88, 255))
                    elif (gx * 3 + gy) % 5 == 0:
                        fr.putpixel((gx, gy), (192, 144, 46, 255))
                    elif gx == (x0 + x1) // 2 and gy == seam_y - 2:
                        fr.putpixel((gx, gy), (218, 66, 76, 255))
        # Foreshortened real lid physically hinged to the back rim of the cavity (ly + new_lh == cy0 + 1)
        new_lh = max(4, int(round(lh * sy)))
        lid_scaled = lid_img.resize((lw, new_lh), Image.NEAREST)
        ly = max(0, cy0 - new_lh + 1)
        if underside:
            # Flip lid vertically for opened underside feel while preserving real rivet/edge texture
            lid_open = lid_scaled.transpose(Image.FLIP_TOP_BOTTOM)
            for yy in range(new_lh):
                for xx in range(lw):
                    c = lid_open.getpixel((xx, yy))
                    if c[3] < 128:
                        continue
                    if yy == 0 or yy == new_lh - 1 or xx <= 1 or xx >= lw - 2:
                        lid_open.putpixel((xx, yy), scale_rgb(c, 1.05))
                    else:
                        lid_open.putpixel((xx, yy), scale_rgb(c, 0.72))
            paste_over(fr, lid_open, x0, ly)
        else:
            paste_over(fr, lid_scaled, x0, ly)

        if sparkle:
            cx = (x0 + x1) // 2
            sy_p = max(1, seam_y - 3)
            for dx, dy, col in [
                (0, 0, (255, 250, 210, 255)),
                (-1, 0, (255, 226, 128, 220)),
                (1, 0, (255, 226, 128, 220)),
                (0, -1, (255, 226, 128, 220)),
                (0, 1, (255, 226, 128, 220)),
                (-4, 1, (255, 240, 175, 210)),
                (4, 0, (255, 240, 175, 210)),
            ]:
                if 0 <= cx + dx < w and 0 <= sy_p + dy < h:
                    fr.putpixel((cx + dx, sy_p + dy), col)
        frames.append(fr)
    return frames


def animate_slide_secret_from_source(
    src_path: str,
    slide_px: int = 16,
    pad_right: int = 16,
) -> list[Image.Image]:
    """
    Slide a real bookshelf/cabinet sideways to reveal a richly shaded secret stone doorway behind it.
    Frame 0 = exact original PNG on the left.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    fw, fh = sw + pad_right, sh
    bbox = src.getbbox() or (0, 0, sw, sh)
    bx0, by0, bx1, by1 = bbox
    tones = sample_palette_tones(src)

    offsets = [0, 2, 7, 13, slide_px]
    frames: list[Image.Image] = []
    for fi, dx in enumerate(offsets):
        fr = make_canvas(fw, fh)
        if dx > 0:
            # Reveal dark stone secret passage arch where the bookshelf used to sit
            ax0 = bx0 + 1
            ax1 = min(bx0 + dx + 3, bx1 - 2)
            ay0 = by0 + 4
            ay1 = by1 - 2
            for y in range(ay0, ay1):
                for x in range(ax0, ax1):
                    # Arch top corners rounded
                    if y == ay0 and (x == ax0 or x == ax0 + 1):
                        continue
                    is_stone_frame = (x <= ax0 + 1 or y <= ay0 + 2)
                    if is_stone_frame:
                        # Weathered masonry stone arch
                        brick = ((x // 3) + (y // 3)) % 2 == 0
                        c = (94, 92, 98, 255) if brick else (76, 74, 82, 255)
                        if y == ay0 + 2 or x == ax0 + 1:
                            c = (54, 52, 60, 255)
                    else:
                        # Deep dark stone recess + faint descending step hint
                        depth = (y - ay0) / max(1, ay1 - ay0)
                        if y > ay1 - 7 and (y - (ay1 - 7)) % 2 == 0:
                            c = (38, 36, 44, 255)
                        else:
                            c = (20, 18, 26, 255) if depth < 0.7 else (28, 26, 36, 255)
                    fr.putpixel((x, y), c)
        # Paste exact original bookshelf shifted right by dx
        paste_over(fr, src, dx, 0)
        # Subtle floor dust puffs while sliding (frames 1..3)
        if 1 <= fi <= 3:
            dust_col = (196, 188, 174, 175 if fi < 3 else 110)
            for px, py in [
                (bx0 + dx - 1, by1 - 2),
                (bx0 + dx - 2, by1 - 1),
                (bx0 + dx + 1, by1 - 1),
                (bx0 + dx - 3, by1 - 2),
            ]:
                if 0 <= px < fw and 0 <= py < fh:
                    fr.putpixel((px, py), dust_col)
        frames.append(fr)
    return frames


def animate_voronoi_smash_from_source(
    src_path: str,
    fw: int = 28,
    fh: int = 24,
    seed: int = 42,
    num_shards: int = 8,
    dust_rgb: tuple[int, int, int] = (206, 192, 168),
) -> list[Image.Image]:
    """
    Shatter a REAL original PNG (crate, barrel, amphora, pot, crystal) into
    Voronoi pixel chunks so EVERY flying splinter preserves the exact original
    pixel-art shading, woodgrain, rivets, and ceramic glaze!
    Frame 0 = exact original PNG centered cleanly.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    ox = (fw - sw) // 2
    oy = fh - sh - 2  # keep feet grounded near bottom of frame

    rng = random.Random(seed)
    # Collect opaque pixels (exclude very faint drop shadow at bottom so debris stays crisp)
    opaque: list[tuple[int, int, RGBA]] = []
    shadow_px: list[tuple[int, int, RGBA]] = []
    for y in range(sh):
        for x in range(sw):
            c = src.getpixel((x, y))
            if c[3] >= 180:
                opaque.append((x, y, c))
            elif c[3] >= 25:
                shadow_px.append((x, y, c))

    cx = sum(p[0] for p in opaque) / max(1, len(opaque))
    cy = sum(p[1] for p in opaque) / max(1, len(opaque))

    # Create Voronoi shard centers around the object
    centers: list[tuple[float, float]] = []
    for k in range(num_shards):
        ang = (2 * math.pi * k / num_shards) + rng.uniform(-0.25, 0.25)
        rad = rng.uniform(2.2, max(3.5, min(sw, sh) * 0.36))
        centers.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))

    shards: list[list[tuple[int, int, RGBA]]] = [[] for _ in range(num_shards)]
    for x, y, c in opaque:
        best_k = min(range(num_shards), key=lambda k: (x - centers[k][0]) ** 2 + (y - centers[k][1]) ** 2)
        shards[best_k].append((x, y, c))

    # Ballistic velocities for each shard
    velocities: list[tuple[float, float, float]] = []
    for k, (sx, sy) in enumerate(centers):
        vx = (sx - cx) * 0.82 + rng.uniform(-1.2, 1.2)
        vy = -abs(rng.uniform(2.2, 4.6)) + (sy - cy) * 0.25
        # Keep bottom-most 2 shards closer to center as broken base debris
        if sy > cy + sh * 0.20:
            vx *= 0.45
            vy *= 0.35
        rot_dir = 1.0 if vx >= 0 else -1.0
        velocities.append((vx, vy, rot_dir))

    # Frame 0: Exact original intact PNG
    f0 = make_canvas(fw, fh)
    paste_over(f0, src, ox, oy)

    # Frame 1: Impact! 1px squash/jolt + dark crack lines + impact flash
    f1 = make_canvas(fw, fh)
    paste_over(f1, src, ox + 1, oy)
    # Carve diagonal crack across real pixels
    for t in range(-4, 5):
        px = int(round(ox + cx + t))
        py = int(round(oy + cy + t * 0.7))
        if 0 <= px < fw and 0 <= py < fh and f1.getpixel((px, py))[3] > 180:
            f1.putpixel((px, py), (28, 18, 14, 255))
        px2 = int(round(ox + cx + t * 0.5))
        py2 = int(round(oy + cy - t * 0.8))
        if 0 <= px2 < fw and 0 <= py2 < fh and f1.getpixel((px2, py2))[3] > 180:
            f1.putpixel((px2, py2), (28, 18, 14, 255))
    # Bright impact star at center
    icx, icy = int(round(ox + cx)), int(round(oy + cy))
    for dx, dy, col in [
        (0, 0, (255, 252, 224, 255)),
        (-1, 0, (255, 234, 162, 235)),
        (1, 0, (255, 234, 162, 235)),
        (0, -1, (255, 234, 162, 235)),
        (0, 1, (255, 234, 162, 235)),
    ]:
        if 0 <= icx + dx < fw and 0 <= icy + dy < fh:
            f1.putpixel((icx + dx, icy + dy), col)

    def render_burst(t: float, settle: bool = False) -> Image.Image:
        fr = make_canvas(fw, fh)
        ground_y = oy + sh - 1
        # Soft ground shadow ellipse
        for gx in range(max(1, ox - 3), min(fw - 1, ox + sw + 3)):
            for gy in range(max(0, ground_y - 2), min(fh, ground_y + 2)):
                dist = ((gx - (ox + cx)) / (sw * 0.65)) ** 2 + ((gy - ground_y) / 2.2) ** 2
                if dist <= 1.0:
                    fr.putpixel((gx, gy), (20, 16, 24, 72))

        gravity = 6.2
        for k, pix_list in enumerate(shards):
            if not pix_list:
                continue
            vx, vy, rot_dir = velocities[k]
            scx, scy = centers[k]
            dx = vx * t
            dy = vy * t + 0.5 * gravity * (t ** 2)
            # Clamp shard to floor when settling
            max_y = max(p[1] for p in pix_list)
            if oy + max_y + dy > ground_y:
                dy = ground_y - (oy + max_y)
            ang = rot_dir * t * (0.45 if not settle else 0.75)
            ca, sa = math.cos(ang), math.sin(ang)
            darken = 0.86 if settle else 1.0
            for x, y, c in pix_list:
                rx = (x - scx) * ca - (y - scy) * sa + scx + ox + dx
                ry = (x - scx) * sa + (y - scy) * ca + scy + oy + dy
                # Squash vertical height slightly on final floor debris so it lies flat in 3/4 view
                if settle:
                    ry = ground_y - (ground_y - ry) * 0.55
                ix, iy = int(round(rx)), int(round(ry))
                if 0 <= ix < fw and 0 <= iy < fh:
                    fr.putpixel((ix, iy), scale_rgb(c, darken))

        # Dust puffs during active burst (frames 2 & 3)
        if not settle:
            puff_alpha = 150 if t < 1.1 else 95
            for p_ang in (0.4, 1.8, 2.9, 4.1, 5.4):
                pr = 3.2 + t * 3.8
                px = int(round(ox + cx + math.cos(p_ang) * pr))
                py = int(round(oy + cy + math.sin(p_ang) * pr * 0.65))
                for ddx, ddy in ((0, 0), (1, 0), (0, 1)):
                    if 0 <= px + ddx < fw and 0 <= py + ddy < fh:
                        cur = fr.getpixel((px + ddx, py + ddy))
                        if cur[3] == 0:
                            fr.putpixel((px + ddx, py + ddy), (*dust_rgb, puff_alpha))
        return fr

    f2 = render_burst(0.85, settle=False)
    f3 = render_burst(1.45, settle=False)
    f4 = render_burst(1.95, settle=True)
    return [f0, f1, f2, f3, f4]


def animate_sarcophagus_pair(closed_path: str, open_path: str) -> list[Image.Image]:
    """
    Animate between real `cr-sarcophagus-ns.png` (closed) and `cr-sarcophagus-open.png` (open).
    """
    closed = load_rgba(closed_path)
    opened = load_rgba(open_path)
    sw, sh = closed.size
    fw, fh = sw + 8, sh
    ox = 2

    # Stone slab top from closed sarcophagus (rows 1..25)
    slab = closed.crop((1, 1, sw - 1, 25))

    f0 = make_canvas(fw, fh)
    paste_over(f0, closed, ox, 0)

    # Frame 1: Slight crack & grind shift (+1px x, +2px y) + dust
    f1 = make_canvas(fw, fh)
    paste_over(f1, opened, ox, 0)
    paste_over(f1, slab, ox + 2, 3)
    for px, py in ((ox + 1, 8), (ox + 1, 14), (ox + 15, 24)):
        f1.putpixel((px, py), (182, 178, 172, 175))

    # Frame 2: Slab slid partway off diagonally (+4px x, +7px y), skull peeking!
    f2 = make_canvas(fw, fh)
    paste_over(f2, opened, ox, 0)
    paste_over(f2, slab.crop((0, 0, slab.width, 20)), ox + 4, 8)
    for px, py in ((ox + 2, 12), (ox + 16, 18), (ox + 17, 22)):
        if 0 <= px < fw and 0 <= py < fh:
            f2.putpixel((px, py), (178, 174, 168, 145))

    # Frame 3: Slab nearly settled aside (+5px x, +12px y), ribs & skull revealed!
    f3 = make_canvas(fw, fh)
    paste_over(f3, opened, ox, 0)
    paste_over(f3, slab.crop((0, 0, slab.width - 1, 15)), ox + 5, 13)

    # Frame 4: Exact real `cr-sarcophagus-open.png`!
    f4 = make_canvas(fw, fh)
    paste_over(f4, opened, ox, 0)
    return [f0, f1, f2, f3, f4]


def animate_brazier_from_source(lit_path: str, flame_bottom_y: int = 10) -> list[Image.Image]:
    """
    Animate a real lit brazier PNG (`ru-brazier.png`):
    Frame 0 = exact original bowl & tripod with flame removed & replaced by dark coals.
    Frame 1 = glowing embers + tiny spark.
    Frame 2 = rising medium flame.
    Frame 3 = EXACT original lit brazier PNG!
    Frame 4 = flickering alternate peak + rising ember + warm glow on bowl rim.
    """
    lit = load_rgba(lit_path)
    w, h = lit.size
    bowl_tones = sample_palette_tones(lit, (0, flame_bottom_y, w, h))

    # Create unlit base by clearing bright warm flame pixels above flame_bottom_y + inside bowl center
    def is_flame(c: RGBA) -> bool:
        r, g, b, a = c
        return a > 40 and r > 150 and (r - b) > 55

    unlit = lit.copy()
    for y in range(0, flame_bottom_y + 2):
        for x in range(w):
            c = unlit.getpixel((x, y))
            if y < flame_bottom_y and c[3] > 0:
                if is_flame(c) or y < flame_bottom_y - 1:
                    unlit.putpixel((x, y), (0, 0, 0, 0))
            elif y >= flame_bottom_y - 1 and is_flame(c):
                # Replace inner flame pixels with charred dark coals
                unlit.putpixel((x, y), (56, 46, 44, 255) if (x + y) % 2 == 0 else (42, 34, 34, 255))
    # Mound of dark charcoal inside bowl rim (y=9..10, x=4..11)
    for x in range(5, 11):
        unlit.putpixel((x, flame_bottom_y - 1), (68, 56, 54, 255) if x % 2 == 0 else (48, 38, 38, 255))
        unlit.putpixel((x, flame_bottom_y), (44, 36, 36, 255))

    # Extract original flame layer
    flame_layer = make_canvas(w, h)
    for y in range(0, flame_bottom_y + 2):
        for x in range(w):
            c = lit.getpixel((x, y))
            if c[3] > 0 and (y < flame_bottom_y or is_flame(c)):
                flame_layer.putpixel((x, y), c)

    # Frame 0: Unlit brazier
    f0 = unlit.copy()

    # Frame 1: Glowing ember coals + spark
    f1 = unlit.copy()
    for x, y, c in [
        (6, flame_bottom_y, (186, 62, 26, 255)),
        (7, flame_bottom_y, (238, 128, 36, 255)),
        (8, flame_bottom_y, (252, 186, 64, 255)),
        (9, flame_bottom_y, (196, 72, 28, 255)),
        (7, flame_bottom_y - 1, (246, 152, 44, 255)),
        (8, flame_bottom_y - 1, (255, 224, 112, 255)),
        (7, flame_bottom_y - 2, (232, 92, 28, 255)),
        (9, flame_bottom_y - 3, (255, 206, 92, 220)),
    ]:
        f1.putpixel((x, y), c)

    # Frame 2: Medium rising flame (scaled original flame!)
    f2 = unlit.copy()
    fl_box = flame_layer.getbbox() or (4, 1, 12, flame_bottom_y + 1)
    fl_crop = flame_layer.crop(fl_box)
    fl_med = fl_crop.resize((max(4, fl_crop.width - 2), max(4, int(fl_crop.height * 0.65))), Image.NEAREST)
    paste_over(f2, fl_med, (w - fl_med.width) // 2, flame_bottom_y + 1 - fl_med.height)

    # Frame 3: EXACT original lit brazier!
    f3 = lit.copy()

    # Frame 4: Flickering peak (horizontally mirrored upper flame + floating spark + warm bowl rim highlight)
    f4 = unlit.copy()
    fl_flip = fl_crop.transpose(Image.FLIP_LEFT_RIGHT)
    paste_over(f4, fl_flip, fl_box[0], max(0, fl_box[1] - 1))
    # Warm rim highlight on bowl edge
    for x in range(3, w - 3):
        c = f4.getpixel((x, flame_bottom_y + 1))
        if c[3] > 180:
            f4.putpixel((x, flame_bottom_y + 1), tint_rgb(c, (255, 196, 98), 0.25))
    # Floating ember
    if fl_box[1] >= 1:
        f4.putpixel((min(w - 2, fl_box[0] + 2), max(0, fl_box[1] - 1)), (255, 224, 118, 230))

    return [f0, f1, f2, f3, f4]


def animate_vending_from_source(src_path: str) -> list[Image.Image]:
    """
    Animate real `city_clinic_health_drink_vending.png` (32x48):
    Frame 0 = exact original PNG.
    Frame 1 = coin LED glows bright green-cyan + bottom-right golden bottle highlights.
    Frame 2 = bottom-right golden bottle drops down toward dispenser.
    Frame 3 = bottle lands inside open dispenser flap with warm highlight; shelf slot empty.
    Frame 4 = bottle resting cleanly in dispenser tray, LED back to ready.
    """
    src = load_rgba(src_path)
    w, h = src.size
    # Bottom-right golden bottle: x=19..23, y=18..27
    bottle = src.crop((19, 18, 24, 28))
    # Sample interior glass background from x=24, y=20..26
    glass_bg = src.getpixel((24, 21))
    glass_sh = scale_rgb(glass_bg, 0.78)

    def clear_bottle_slot(im: Image.Image) -> None:
        for y in range(19, 28):
            for x in range(19, 24):
                im.putpixel((x, y), glass_sh if y == 19 or x == 19 else glass_bg)

    f0 = src.copy()

    # Frame 1: LED flashes bright + bottle highlights
    f1 = src.copy()
    for dx, dy, col in [
        (0, 0, (130, 255, 170, 255)),
        (-1, 0, (80, 220, 140, 200)),
        (1, 0, (80, 220, 140, 200)),
        (0, -1, (80, 220, 140, 200)),
    ]:
        f1.putpixel((23 + dx, 35 + dy), col)
    # Highlight bottle
    for y in range(18, 28):
        for x in range(19, 24):
            f1.putpixel((x, y), scale_rgb(f1.getpixel((x, y)), 1.22))

    # Frame 2: Bottle falling inside glass (shifted down 4px, cropped inside glass y<=28)
    f2 = src.copy()
    clear_bottle_slot(f2)
    paste_over(f2, bottle.crop((0, 0, 5, 6)), 19, 23)
    f2.putpixel((23, 35), (130, 255, 170, 255))

    # Frame 3: Dispenser flap pushed open (`x=6..19, y=35..39`) showing sideways golden bottle + gleam!
    f3 = src.copy()
    clear_bottle_slot(f3)
    for y in range(35, 40):
        for x in range(6, 20):
            f3.putpixel((x, y), (28, 38, 46, 255) if y > 35 else (44, 58, 68, 255))
    # Sideways golden bottle resting inside open tray (sampled from real bottle colors!)
    bottle_rot = bottle.rotate(90, expand=True)
    paste_over(f3, bottle_rot.crop((0, 1, 9, 5)), 8, 36)
    # Little shine glint on bottle
    f3.putpixel((12, 36), (255, 252, 220, 255))
    f3.putpixel((13, 36), (255, 238, 160, 255))
    f3.putpixel((23, 35), (160, 255, 195, 255))

    # Frame 4: Tray settled with bottle ready to pick up
    f4 = f3.copy()
    f4.putpixel((23, 35), src.getpixel((23, 35)))

    return [f0, f1, f2, f3, f4]


def animate_cryo_pod_from_source(src_path: str) -> list[Image.Image]:
    """
    Animate real `tiledata/sf-station/redraw/pieces/cryo-pod.png` (16x32 -> 22x34):
    Frame 0 = exact original PNG centered.
    Frame 1 = status LED brightens cyan-white, glass frost shimmers.
    Frame 2 = glass visor retracts upward halfway + cold vapor wisps escape.
    Frame 3 = visor fully open + billowing cyan-white cryo mist.
    Frame 4 = open pod interior glowing softly with settling frost vapor.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    fw, fh = sw + 6, sh + 2
    ox, oy = 3, 1

    # Glass area inside cryo-pod: x=4..11, y=10..22
    glass = src.crop((4, 10, 12, 23))  # 8x13

    def draw_open_interior(im: Image.Image, reveal_h: int) -> None:
        # Reveal dark-cyan illuminated pod cavity from bottom of glass upward
        y_top = 23 - reveal_h
        for y in range(oy + y_top, oy + 23):
            for x in range(ox + 4, ox + 12):
                if x == ox + 4 or x == ox + 11:
                    im.putpixel((x, y), (36, 62, 82, 255))
                elif y == oy + 22:
                    im.putpixel((x, y), (48, 86, 112, 255))
                else:
                    # Cool glowing back wall with subtle ribs
                    c = (28, 52, 74, 255) if (y % 3 != 0) else (44, 82, 112, 255)
                    if ox + 6 <= x <= ox + 9 and oy + 12 <= y <= oy + 20:
                        c = (66, 126, 162, 255) if (y % 2 == 0) else (52, 102, 138, 255)
                    im.putpixel((x, y), c)

    f0 = make_canvas(fw, fh)
    paste_over(f0, src, ox, oy)

    # Frame 1: Awakening LED + frost shimmer on glass
    f1 = f0.copy()
    for x in range(ox + 5, ox + 10):
        f1.putpixel((x, oy + 29), (156, 250, 255, 255))
    for y in range(oy + 10, oy + 23):
        for x in range(ox + 4, ox + 12):
            if (x + y) % 5 == 0:
                f1.putpixel((x, y), tint_rgb(f1.getpixel((x, y)), (210, 248, 255), 0.38))

    # Frame 2: Glass slides up 5px, mist begins escaping
    f2 = f0.copy()
    draw_open_interior(f2, 7)
    paste_over(f2, glass.crop((0, 5, 8, 13)), ox + 4, oy + 10)
    # Bright visor edge bar
    for x in range(ox + 4, ox + 12):
        f2.putpixel((x, oy + 17), (182, 232, 248, 255))
    for x in range(ox + 5, ox + 10):
        f2.putpixel((x, oy + 29), (190, 255, 255, 255))
    for mx, my, ma in [(ox + 3, oy + 21, 165), (ox + 12, oy + 20, 165), (ox + 5, oy + 23, 190), (ox + 10, oy + 22, 190)]:
        f2.putpixel((mx, my), (214, 246, 255, ma))

    # Frame 3: Glass fully retracted, billowing cryo vapor puffs outward!
    f3 = f0.copy()
    draw_open_interior(f3, 13)
    for x in range(ox + 4, ox + 12):
        f3.putpixel((x, oy + 10), (168, 224, 244, 255))
    for x in range(ox + 5, ox + 10):
        f3.putpixel((x, oy + 29), (140, 244, 255, 255))
    mist_pts = [
        (ox + 2, oy + 20, 175), (ox + 1, oy + 22, 135), (ox + 3, oy + 22, 200),
        (ox + 13, oy + 19, 175), (ox + 14, oy + 21, 135), (ox + 12, oy + 22, 200),
        (ox + 4, oy + 24, 185), (ox + 6, oy + 23, 160), (ox + 10, oy + 24, 185),
        (ox + 8, oy + 18, 120), (ox + 7, oy + 16, 110),
    ]
    for mx, my, ma in mist_pts:
        if 0 <= mx < fw and 0 <= my < fh:
            f3.putpixel((mx, my), (218, 248, 255, ma))

    # Frame 4: Settled open pod + gentle mist wisps at base
    f4 = f0.copy()
    draw_open_interior(f4, 13)
    for x in range(ox + 4, ox + 12):
        f4.putpixel((x, oy + 10), (148, 206, 232, 255))
    for x in range(ox + 5, ox + 10):
        f4.putpixel((x, oy + 29), (112, 224, 245, 255))
    for mx, my, ma in [(ox + 2, oy + 25, 115), (ox + 13, oy + 25, 115), (ox + 5, oy + 24, 125), (ox + 11, oy + 23, 125)]:
        f4.putpixel((mx, my), (206, 242, 255, ma))

    return [f0, f1, f2, f3, f4]


# ---------------------------------------------------------------------------
# Additional source-preserving motion engines (Waves 1-5 across all 7 eras)
# ---------------------------------------------------------------------------


def animate_hinged_lid_padded(
    src_path: str,
    lid_box: tuple[int, int, int, int],
    seam_y: int,
    pad_top: int = 4,
    loot_style: str = "gold",
    flip_lid: bool = True,
) -> list[Image.Image]:
    """
    Like `animate_hinged_lid_from_source`, with optional top padding so lids
    sitting near y=0 (e.g. small 16x16 chests, toolboxes, coolers, parcel boxes)
    open cleanly upward without clipping at the canvas top.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    w, h = sw, sh + pad_top
    oy = pad_top
    x0, y0, x1, y1 = lid_box
    lw = x1 - x0 + 1
    lh = y1 - y0 + 1
    tones = sample_palette_tones(src, lid_box)
    lid_img = src.crop((x0, y0, x1 + 1, y1 + 1))
    cav_dark = scale_rgb(pick_tone(tones, 0.04), 0.35)

    max_cav = min(6, max(3, lh))
    states = [
        (1.0, 0, False, False),
        (0.95, max(2, max_cav // 3), False, False),
        (0.84, max(3, (max_cav * 2) // 3), flip_lid, False),
        (0.88, max_cav, flip_lid, True),
        (0.88, max_cav, flip_lid, False),
    ]
    frames: list[Image.Image] = []
    for fi, (sy, cav_h, underside, sparkle) in enumerate(states):
        fr = make_canvas(w, h)
        if fi == 0:
            paste_over(fr, src, 0, oy)
            frames.append(fr)
            continue
        paste_over(fr, src.crop((0, seam_y, sw, sh)), 0, oy + seam_y)
        # Preserve any neighboring pixels outside [x0..x1] above seam_y (e.g., paired bins!)
        if x0 > 0:
            paste_over(fr, src.crop((0, 0, x0, seam_y)), 0, oy)
        if x1 + 1 < sw:
            paste_over(fr, src.crop((x1 + 1, 0, sw, seam_y)), x1 + 1, oy)
        cy0 = max(0, oy + seam_y - cav_h)
        for y in range(cy0, oy + seam_y):
            for x in range(x0, x1 + 1):
                if x == x0 or x == x1 or y == cy0:
                    fr.putpixel((x, y), scale_rgb(pick_tone(tones, 0.35), 0.78))
                else:
                    fr.putpixel((x, y), cav_dark)
        if cav_h >= 3:
            if loot_style == "gold":
                for gx in range(x0 + 2, x1 - 1):
                    for gy in range(max(cy0 + 1, oy + seam_y - 3), oy + seam_y):
                        if (gx + gy) % 3 == 0:
                            fr.putpixel((gx, gy), (242, 204, 88, 255))
                        elif (gx * 3 + gy) % 5 == 0:
                            fr.putpixel((gx, gy), (192, 144, 46, 255))
            elif loot_style == "ice":
                for gx in range(x0 + 2, x1 - 1):
                    for gy in range(max(cy0 + 1, oy + seam_y - 3), oy + seam_y):
                        c = (196, 236, 252, 255) if (gx + gy) % 2 == 0 else (136, 198, 232, 255)
                        fr.putpixel((gx, gy), c)
            elif loot_style == "tools":
                for gx in range(x0 + 2, x1 - 1):
                    gy = oy + seam_y - 1
                    c = (188, 196, 208, 255) if gx % 3 == 0 else ((202, 74, 62, 255) if gx % 3 == 1 else (126, 134, 148, 255))
                    fr.putpixel((gx, gy), c)
            elif loot_style == "scroll":
                for gx in range(x0 + 2, x1 - 1):
                    gy = oy + seam_y - 1
                    fr.putpixel((gx, gy), (232, 218, 184, 255) if gx % 2 == 0 else (188, 166, 128, 255))
            elif loot_style == "grain":
                for gx in range(x0 + 2, x1 - 1):
                    for gy in range(max(cy0 + 1, oy + seam_y - 2), oy + seam_y):
                        fr.putpixel((gx, gy), (232, 216, 174, 255) if (gx + gy) % 2 == 0 else (206, 188, 144, 255))
            elif loot_style == "scifi":
                for gx in range(x0 + 2, x1 - 1):
                    for gy in range(max(cy0 + 1, oy + seam_y - 2), oy + seam_y):
                        fr.putpixel((gx, gy), (112, 226, 248, 255) if (gx + gy) % 2 == 0 else (64, 152, 188, 255))
            elif loot_style == "trash":
                for gx in range(x0 + 2, x1 - 1):
                    gy = oy + seam_y - 1
                    fr.putpixel((gx, gy), (156, 168, 146, 255) if gx % 2 == 0 else (112, 124, 108, 255))

        new_lh = max(3, int(round(lh * sy)))
        lid_scaled = lid_img.resize((lw, new_lh), Image.NEAREST)
        ly = max(0, cy0 - new_lh + 1)
        if underside:
            lid_open = lid_scaled.transpose(Image.FLIP_TOP_BOTTOM)
            for yy in range(new_lh):
                for xx in range(lw):
                    c = lid_open.getpixel((xx, yy))
                    if c[3] < 128:
                        continue
                    if yy == 0 or yy == new_lh - 1 or xx <= 1 or xx >= lw - 2:
                        lid_open.putpixel((xx, yy), scale_rgb(c, 1.05))
                    else:
                        lid_open.putpixel((xx, yy), scale_rgb(c, 0.72))
            paste_over(fr, lid_open, x0, ly)
        else:
            paste_over(fr, lid_scaled, x0, ly)

        if sparkle and loot_style in ("gold", "scroll", "scifi", "ice"):
            cx = (x0 + x1) // 2
            sy_p = max(1, oy + seam_y - 2)
            sc = (176, 248, 255, 255) if loot_style in ("scifi", "ice") else (255, 248, 206, 255)
            for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                if 0 <= cx + dx < w and 0 <= sy_p + dy < h:
                    fr.putpixel((cx + dx, sy_p + dy), sc)
        frames.append(fr)
    return frames


def animate_split_doors_from_source(
    src_path: str,
    door_box: tuple[int, int, int, int],
    mode: str = "split",  # "split" (left+right slide), "slide-up" (bars/shutter), "slide-right" (single gate)
    interior_tint: tuple[int, int, int] = (18, 20, 28),
) -> list[Image.Image]:
    """
    Animate sliding double doors (airlock, elevator, ruin door) or rising/sliding gates (cell door, grate, bars).
    Frame 0 = exact original PNG.
    """
    src = load_rgba(src_path)
    w, h = src.size
    x0, y0, x1, y1 = door_box
    dw = x1 - x0 + 1
    dh = y1 - y0 + 1
    mid_x = (x0 + x1) // 2
    left_panel = src.crop((x0, y0, mid_x + 1, y1 + 1))
    right_panel = src.crop((mid_x + 1, y0, x1 + 1, y1 + 1))
    full_panel = src.crop((x0, y0, x1 + 1, y1 + 1))

    fracs = [0.0, 0.22, 0.55, 0.85, 1.0]
    frames: list[Image.Image] = []
    for fi, frac in enumerate(fracs):
        if fi == 0:
            frames.append(src.copy())
            continue
        fr = src.copy()
        # Paint dark shaded corridor/interior behind the opening
        ir, ig, ib = interior_tint
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                depth = (y - y0) / max(1, dh - 1)
                f = 0.75 + 0.45 * depth
                c = (clamp(int(ir * f)), clamp(int(ig * f)), clamp(int(ib * f)), 255)
                if y <= y0 + 1 or x == x0 or x == x1:
                    c = scale_rgb(c, 0.65)
                fr.putpixel((x, y), c)

        if mode == "split":
            shift = int(round((dw // 2 - 1) * frac))
            # Clip left panel inside [x0 .. mid_x - shift]
            lw_vis = max(0, left_panel.width - shift)
            if lw_vis > 0:
                paste_over(fr, left_panel.crop((shift, 0, left_panel.width, dh)), x0, y0)
            rw_vis = max(0, right_panel.width - shift)
            if rw_vis > 0:
                paste_over(fr, right_panel.crop((0, 0, rw_vis, dh)), mid_x + 1 + shift, y0)
        elif mode == "slide-up":
            lift = int(round((dh - 2) * frac))
            vis_h = max(0, dh - lift)
            if vis_h > 0:
                paste_over(fr, full_panel.crop((0, lift, dw, dh)), x0, y0)
        elif mode == "slide-right":
            shift = int(round((dw - 2) * frac))
            vis_w = max(0, dw - shift)
            if vis_w > 0:
                paste_over(fr, full_panel.crop((0, 0, vis_w, dh)), x0 + shift, y0)
        frames.append(fr)
    return frames


def animate_flame_or_lamp_from_source(
    src_path: str,
    flame_box: tuple[int, int, int, int],
    mode: str = "ignite",  # "ignite" (F0 unlit -> F1..4 lit), "glow-pulse" (lamps/ovens/hearths)
    glow_rgb: tuple[int, int, int] = (255, 198, 96),
) -> list[Image.Image]:
    """
    Animate a real fireplace, oven, hearth, torch, candle, gas lamp, or lantern.
    Preserves 100% of the stone/iron/wood body pixels; removes or dims only the flame
    region for Frame 0, then animates ignition & natural flame flicker using the
    original flame pixels!
    """
    lit = load_rgba(src_path)
    w, h = lit.size
    fx0, fy0, fx1, fy1 = flame_box

    def is_bright_flame(c: RGBA) -> bool:
        r, g, b, a = c
        if a < 40:
            return False
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        return (r > 150 and (r - b) > 38) or lum > 195

    unlit = lit.copy()
    flame_layer = make_canvas(w, h)
    for y in range(max(0, fy0), min(h, fy1 + 1)):
        for x in range(max(0, fx0), min(w, fx1 + 1)):
            c = lit.getpixel((x, y))
            if is_bright_flame(c):
                flame_layer.putpixel((x, y), c)
                if mode == "ignite":
                    # If top area (open air flame like torch/candle), erase; if enclosed hearth/lamp, darken to coals/glass
                    if fy0 <= 3 and y < fy1 - 2:
                        unlit.putpixel((x, y), (0, 0, 0, 0))
                    else:
                        unlit.putpixel((x, y), (46, 38, 36, 255) if (x + y) % 2 == 0 else (34, 28, 28, 255))
                else:
                    unlit.putpixel((x, y), scale_rgb(c, 0.34))

    f0 = unlit.copy()

    # Frame 1: Small spark / dim warm glow
    f1 = unlit.copy()
    cx = (fx0 + fx1) // 2
    cy = min(fy1 - 1, (fy0 + fy1 * 2) // 3)
    for dx, dy, col in [
        (0, 0, (255, 224, 118, 255)),
        (-1, 0, (238, 134, 42, 235)),
        (1, 0, (238, 134, 42, 235)),
        (0, -1, (248, 174, 58, 235)),
        (0, 1, (192, 68, 28, 220)),
    ]:
        if 0 <= cx + dx < w and 0 <= cy + dy < h:
            f1.putpixel((cx + dx, cy + dy), col)

    # Frame 2: Half-strength / rising flame (blend unlit + flame_layer)
    f2 = unlit.copy()
    fl_box = flame_layer.getbbox()
    if fl_box:
        fl_crop = flame_layer.crop(fl_box)
        nw = max(2, int(round(fl_crop.width * 0.78)))
        nh = max(2, int(round(fl_crop.height * 0.72)))
        fl_med = fl_crop.resize((nw, nh), Image.NEAREST)
        paste_over(f2, fl_med, fl_box[0] + (fl_crop.width - nw) // 2, fl_box[3] - nh)
    else:
        f2 = lit.copy()

    # Frame 3: EXACT original lit PNG!
    f3 = lit.copy()

    # Frame 4: Flickering peak (horizontally mirrored flame + subtle warm rim bounce)
    f4 = unlit.copy()
    if fl_box:
        fl_crop = flame_layer.crop(fl_box)
        fl_flip = fl_crop.transpose(Image.FLIP_LEFT_RIGHT)
        paste_over(f4, fl_flip, fl_box[0], max(0, fl_box[1] - (1 if fy0 <= 4 else 0)))
    else:
        f4 = lit.copy()
    # Warm glow tint on immediate neighbors around flame_box
    for y in range(max(0, fy0 - 1), min(h, fy1 + 2)):
        for x in range(max(0, fx0 - 1), min(w, fx1 + 2)):
            if fx0 <= x <= fx1 and fy0 <= y <= fy1:
                continue
            c = f4.getpixel((x, y))
            if c[3] >= 180:
                f4.putpixel((x, y), tint_rgb(c, glow_rgb, 0.22))

    return [f0, f1, f2, f3, f4]


def animate_steam_pot_from_source(
    src_path: str,
    vent_xy: tuple[int, int],
    lid_box: tuple[int, int, int, int] | None = None,
    steam_rgb: tuple[int, int, int] = (234, 238, 242),
    pad_top: int = 4,
    ember_box: tuple[int, int, int, int] | None = None,
) -> list[Image.Image]:
    """
    Animate a real cooking pot, gamasot, incense burner, grill, or boiler:
    Frame 0 = exact original PNG.
    Frames 1..4 = subtle lid rattle/steam puff + rising layered translucent vapor/smoke + warm embers!
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    w, h = sw, sh + pad_top
    oy = pad_top
    vx, vy = vent_xy[0], vent_xy[1] + oy

    frames: list[Image.Image] = []
    for fi in range(5):
        fr = make_canvas(w, h)
        paste_over(fr, src, 0, oy)
        if fi == 0:
            frames.append(fr)
            continue
        # Optional subtle 1px lid rattle on frames 2 & 3
        if lid_box and fi in (2, 3):
            lx0, ly0, lx1, ly1 = lid_box
            lid_crop = src.crop((lx0, ly0, lx1 + 1, ly1 + 1))
            # Clear original lid top row and paste 1px higher
            for x in range(lx0, lx1 + 1):
                fr.putpixel((x, oy + ly1), (36, 28, 24, 255))
            paste_over(fr, lid_crop, lx0, oy + ly0 - 1)
        # Optional glowing embers underneath
        if ember_box:
            ex0, ey0, ex1, ey1 = ember_box
            for y in range(oy + ey0, min(h, oy + ey1 + 1)):
                for x in range(ex0, min(w, ex1 + 1)):
                    c = fr.getpixel((x, y))
                    if c[3] > 180 and (x + y + fi) % 2 == 0:
                        fr.putpixel((x, y), tint_rgb(c, (255, 142, 48), 0.38 if fi % 2 else 0.55))
        # Rising translucent steam/incense wisps
        puffs = [
            [(0, -1, 150), (1, -2, 110)],
            [(-1, -2, 165), (0, -3, 185), (1, -4, 130), (-1, -5, 90)],
            [(0, -2, 170), (1, -4, 190), (-1, -5, 165), (0, -7, 120), (2, -6, 95)],
            [(-1, -3, 155), (0, -5, 180), (1, -6, 150), (-1, -8, 110), (1, -9, 75)],
        ][fi - 1]
        for dx, dy, alpha in puffs:
            for ox_p, oy_p in ((0, 0), (1, 0)):
                px, py = vx + dx + ox_p, vy + dy + oy_p
                if 0 <= px < w and 0 <= py < h:
                    cur = fr.getpixel((px, py))
                    a = alpha if ox_p == 0 else int(alpha * 0.72)
                    if cur[3] == 0:
                        fr.putpixel((px, py), (*steam_rgb, a))
                    else:
                        fr.putpixel((px, py), tint_rgb(cur, steam_rgb, a / 320.0))
        frames.append(fr)
    return frames


def animate_screen_machine_from_source(
    src_path: str,
    screen_box: tuple[int, int, int, int],
    accent_rgb: tuple[int, int, int] = (108, 238, 255),
    slot_xy: tuple[int, int] | None = None,
    mode: str = "terminal",  # "terminal", "dispense", "holo", "reactor", "claw"
) -> list[Image.Image]:
    """
    Animate a real modern/SF/steampunk machine (terminal, server rack, arcade, ATM,
    kiosk, claw machine, ticket machine, holo-table, reactor, 3D printer) while
    keeping 100% of the real high-detail pixel-art chassis intact!
    """
    src = load_rgba(src_path)
    w, h = src.size
    sx0, sy0, sx1, sy1 = screen_box
    sw_s = max(1, sx1 - sx0 + 1)
    sh_s = max(1, sy1 - sy0 + 1)

    frames: list[Image.Image] = []
    for fi in range(5):
        fr = src.copy()
        if fi == 0:
            frames.append(fr)
            continue

        if mode == "terminal":
            # Scanline sweep + blinking data bars inside the real screen area
            scan_y = sy0 + ((fi - 1) * max(1, sh_s // 4)) % sh_s
            for y in range(sy0, sy1 + 1):
                for x in range(sx0, sx1 + 1):
                    c = fr.getpixel((x, y))
                    if c[3] < 128:
                        continue
                    if y == scan_y:
                        fr.putpixel((x, y), tint_rgb(c, (245, 255, 255), 0.58))
                    elif (x + y + fi) % 3 == 0:
                        fr.putpixel((x, y), tint_rgb(c, accent_rgb, 0.34))
        elif mode == "dispense":
            # Screen brightens + ticket/item/coin pops out of slot_xy!
            for y in range(sy0, sy1 + 1):
                for x in range(sx0, sx1 + 1):
                    c = fr.getpixel((x, y))
                    if c[3] >= 128:
                        t = 0.42 if fi in (1, 2) else 0.20
                        fr.putpixel((x, y), tint_rgb(c, accent_rgb, t))
            if slot_xy and fi >= 2:
                tx, ty = slot_xy
                drop = fi - 2  # 0, 1, 2
                for dx in range(-1, 2):
                    for dy in range(0, 2):
                        px, py = tx + dx, ty + dy + min(1, drop)
                        if 0 <= px < w and 0 <= py < h:
                            fr.putpixel((px, py), (248, 242, 214, 255) if dy == 0 else (220, 206, 168, 255))
                if fi == 3 and 0 <= tx < w and 0 <= ty - 1 < h:
                    fr.putpixel((tx, ty - 1), (255, 250, 210, 255))
        elif mode == "holo":
            # Project rising holographic cyan wireframe/orb above the real holo-table!
            cx = (sx0 + sx1) // 2
            top_y = max(1, sy0 - 4)
            glow_h = [0, 3, 6, 8, 7][fi]
            for y in range(max(0, sy0 + 2 - glow_h), sy0 + 3):
                half = max(1, min(sw_s // 2, 2 + (sy0 + 2 - y) // 2))
                for x in range(max(0, cx - half), min(w, cx + half + 1)):
                    is_ring = (y == sy0 + 2 - glow_h or y == sy0 + 2 - glow_h + 2)
                    if is_ring or (x + y + fi) % 2 == 0:
                        a = 215 if is_ring else 130
                        cur = fr.getpixel((x, y))
                        if cur[3] == 0:
                            fr.putpixel((x, y), (*accent_rgb, a))
                        else:
                            fr.putpixel((x, y), tint_rgb(cur, accent_rgb, 0.55))
        elif mode == "reactor":
            # Core energy surge + pulsing conduits
            pulse = [0.0, 0.25, 0.55, 0.72, 0.42][fi]
            for y in range(sy0, sy1 + 1):
                for x in range(sx0, sx1 + 1):
                    c = fr.getpixel((x, y))
                    if c[3] >= 128 and (c[2] > c[0] or (x + y) % 2 == 0):
                        fr.putpixel((x, y), tint_rgb(c, accent_rgb, pulse))
            # Spark motes rising
            cx = (sx0 + sx1) // 2
            for dx, dy in [(-2, -fi), (2, -fi + 1), (0, -fi - 1)]:
                px, py = cx + dx, sy0 + dy
                if 0 <= px < w and 0 <= py < h and fr.getpixel((px, py))[3] == 0:
                    fr.putpixel((px, py), (*accent_rgb, 210))
        elif mode == "claw":
            # Claw lowers inside the glass case and lifts a plushie pixel cluster!
            cx = (sx0 + sx1) // 2
            drop_y = [sy0, sy0 + 2, sy0 + 5, sy0 + 3, sy0 + 1][fi]
            # Vertical cable from sy0 to drop_y
            for y in range(sy0, min(sy1, drop_y)):
                fr.putpixel((cx, y), (220, 228, 238, 255))
            # Metal claw prongs
            for dx, dy in ((0, 0), (-1, 1), (1, 1), (-1, 2), (1, 2)):
                px, py = cx + dx, drop_y + dy
                if sx0 <= px <= sx1 and sy0 <= py <= sy1:
                    fr.putpixel((px, py), (242, 246, 252, 255))
            # Plushie caught on frames 3 & 4
            if fi >= 3:
                for dx in (-1, 0, 1):
                    py = drop_y + 2
                    if sx0 <= cx + dx <= sx1 and sy0 <= py <= sy1:
                        fr.putpixel((cx + dx, py), (242, 134, 152, 255) if dx == 0 else (216, 98, 120, 255))

        frames.append(fr)
    return frames


def animate_ring_or_wheel_from_source(
    src_path: str,
    center_xy: tuple[int, int],
    mode: str = "bell",  # "bell" (soundwave rings + 1px jolt), "valve" (wheel spin + steam puff), "crank" (rope/bucket pull)
    ring_rgb: tuple[int, int, int] = (255, 232, 138),
) -> list[Image.Image]:
    """
    Animate bells, drums, alarms, sewer/steam valves, or well cranks using the exact real PNG.
    """
    src = load_rgba(src_path)
    w, h = src.size
    cx, cy = center_xy

    frames: list[Image.Image] = []
    for fi in range(5):
        if fi == 0:
            frames.append(src.copy())
            continue
        fr = make_canvas(w, h)
        if mode == "bell":
            dx = [0, 1, -1, 1, 0][fi]
            paste_over(fr, src, dx, 0)
            # Expanding golden/silver acoustic wave arcs on both sides
            rad = 3 + fi * 2
            alpha = max(80, 235 - fi * 38)
            for ang_deg in range(-50, 55, 18):
                for side_sign in (-1, 1):
                    a = math.radians(ang_deg)
                    px = int(round(cx + side_sign * math.cos(a) * rad))
                    py = int(round(cy + math.sin(a) * rad))
                    if 0 <= px < w and 0 <= py < h and fr.getpixel((px, py))[3] < 64:
                        fr.putpixel((px, py), (*ring_rgb, alpha))
        elif mode == "valve":
            paste_over(fr, src, 0, 0)
            # Rotate a small 7x7 wheel patch around (cx, cy) by 90° increments!
            r = 3
            wx0, wy0 = max(0, cx - r), max(0, cy - r)
            wx1, wy1 = min(w, cx + r + 1), min(h, cy + r + 1)
            patch = src.crop((wx0, wy0, wx1, wy1))
            rot = patch.rotate(-45 * fi, resample=Image.NEAREST)
            paste_over(fr, rot, wx0, wy0)
            # Crisp steam hiss burst from valve nozzle
            if fi >= 2:
                for k in range(fi + 1):
                    px = cx + 2 + k + (fi - 2)
                    py = cy - 2 - k // 2
                    if 0 <= px < w and 0 <= py < h:
                        fr.putpixel((px, py), (232, 240, 248, max(90, 210 - k * 35)))
        elif mode == "crank":
            # Subtle rope/bucket rise + water splash droplets at well center
            paste_over(fr, src, 0, 0)
            # Shift handle on right slightly + draw rising water splash glints
            for k in range(fi):
                px = cx + ((k * 3) % 5) - 2
                py = cy - k - 1
                if 0 <= px < w and 0 <= py < h:
                    fr.putpixel((px, py), (186, 232, 252, 220))
            if fi >= 2:
                for dx in (-2, 0, 2):
                    px, py = cx + dx, cy + 1
                    if 0 <= px < w and 0 <= py < h:
                        fr.putpixel((px, py), (226, 248, 255, 195))
        frames.append(fr)
    return frames


def animate_magic_activate_from_source(
    src_path: str,
    gem_box: tuple[int, int, int, int],
    glow_rgb: tuple[int, int, int] = (128, 224, 255),
) -> list[Image.Image]:
    """
    Animate magic pedestals, seal altars, and arcane lecterns:
    Frame 0 = exact original PNG.
    Frames 1..4 = glowing runes/orb activation + floating arcane motes.
    """
    src = load_rgba(src_path)
    w, h = src.size
    gx0, gy0, gx1, gy1 = gem_box
    cx = (gx0 + gx1) // 2
    cy = (gy0 + gy1) // 2

    frames: list[Image.Image] = []
    for fi in range(5):
        fr = src.copy()
        if fi == 0:
            frames.append(fr)
            continue
        strength = [0.0, 0.28, 0.55, 0.72, 0.45][fi]
        for y in range(max(0, gy0), min(h, gy1 + 1)):
            for x in range(max(0, gx0), min(w, gx1 + 1)):
                c = fr.getpixel((x, y))
                if c[3] >= 128:
                    fr.putpixel((x, y), tint_rgb(c, glow_rgb, strength))
        # Soft halo & rising arcane motes
        motes = [
            (cx - 3, cy - fi, 220),
            (cx + 3, cy - fi - 1, 210),
            (cx, cy - fi - 2, 245),
            (cx - 1, cy - fi + 1, 175),
            (cx + 2, cy - fi + 2, 165),
        ]
        for mx, my, ma in motes[: fi + 1]:
            if 0 <= mx < w and 0 <= my < h:
                cur = fr.getpixel((mx, my))
                if cur[3] < 64:
                    fr.putpixel((mx, my), (*glow_rgb, ma))
                else:
                    fr.putpixel((mx, my), tint_rgb(cur, (255, 255, 255), 0.5))
        frames.append(fr)
    return frames


def animate_rummage_from_source(
    src_path: str,
    top_box: tuple[int, int, int, int],
    particle_rgb: tuple[int, int, int] = (232, 206, 134),
    pad_top: int = 3,
) -> list[Image.Image]:
    """
    Animate sacks, grain bags, haystacks, and loot piles being rummaged/searched:
    Frame 0 = exact original PNG.
    Frames 1..4 = real-pixel top ruffle/squash + flying straw/dust/coin sparkles + opened top seam.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    w, h = sw, sh + pad_top
    oy = pad_top
    tx0, ty0, tx1, ty1 = top_box
    cx = (tx0 + tx1) // 2
    cy = oy + (ty0 + ty1) // 2
    tones = sample_palette_tones(src, top_box)
    dark_open = scale_rgb(pick_tone(tones, 0.06), 0.42)

    frames: list[Image.Image] = []
    for fi in range(5):
        fr = make_canvas(w, h)
        if fi == 0:
            paste_over(fr, src, 0, oy)
            frames.append(fr)
            continue
        dx = [0, -1, 1, 0, 0][fi]
        paste_over(fr, src, dx, oy)
        # Open dark mouth/ruffle near top on frames 2..4
        if fi >= 2:
            mw = max(2, (tx1 - tx0) // 2)
            for x in range(max(0, cx - mw // 2), min(w, cx + mw // 2 + 1)):
                for y in range(max(0, cy - 1), min(h, cy + 1)):
                    fr.putpixel((x, y), dark_open)
            # Peek of contents
            if 0 <= cx < w and 0 <= cy < h:
                fr.putpixel((cx, cy), (*particle_rgb, 255))
        # Flying straw/dust/sparkle particles
        pts = [
            (-3, -2), (3, -2), (-2, -4), (2, -3), (0, -5), (-4, -1), (4, -1)
        ]
        for idx, (pdx, pdy) in enumerate(pts):
            if idx < fi + 2 and fi <= 3:
                px = cx + pdx + (fi - 1) * (1 if pdx > 0 else -1 if pdx < 0 else 0)
                py = cy + pdy - (fi - 1)
                if 0 <= px < w and 0 <= py < h and fr.getpixel((px, py))[3] < 64:
                    fr.putpixel((px, py), (*particle_rgb, 220 if fi < 3 else 150))
        frames.append(fr)
    return frames


def animate_clock_or_pendulum_from_source(
    src_path: str,
    face_xy: tuple[int, int],
    pendulum_box: tuple[int, int, int, int] | None = None,
) -> list[Image.Image]:
    """Animate wall clock hands + pendulum swing + chime gleam on exact original PNG."""
    src = load_rgba(src_path)
    w, h = src.size
    fx, fy = face_xy
    frames: list[Image.Image] = []
    for fi in range(5):
        fr = src.copy()
        if fi == 0:
            frames.append(fr)
            continue
        # Move clock hand around face center
        hand_dirs = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1)]
        hx, hy = hand_dirs[fi]
        if 0 <= fx + hx < w and 0 <= fy + hy < h:
            fr.putpixel((fx + hx, fy + hy), (42, 30, 24, 255))
        if pendulum_box:
            px0, py0, px1, py1 = pendulum_box
            pcx = (px0 + px1) // 2
            pcy = (py0 + py1) // 2
            # Darken interior & swing golden bob left/right
            for y in range(py0, py1 + 1):
                for x in range(px0, px1 + 1):
                    fr.putpixel((x, y), (38, 26, 20, 255))
            swing = [0, -1, 0, 1, 0][fi]
            bx = clamp(pcx + swing, px0, px1)
            for y in range(py0, pcy + 1):
                fr.putpixel((bx, y), (206, 172, 84, 255))
            fr.putpixel((bx, min(py1, pcy + 1)), (248, 222, 118, 255))
        # Chime note sparkle at top on frame 3
        if fi == 3:
            for dx, dy in ((-3, -3), (3, -3), (0, -4)):
                if 0 <= fx + dx < w and 0 <= fy + dy < h and fr.getpixel((fx + dx, fy + dy))[3] < 64:
                    fr.putpixel((fx + dx, fy + dy), (255, 242, 166, 225))
        frames.append(fr)
    return frames


def project_real_door_inward(
    dst: Image.Image,
    door_img: Image.Image,
    hinge_x: int,
    door_y: int,
    side: str,  # "left" or "right"
    angle_deg: float,
    tones: list[RGBA],
    top_clip_y: int | None = None,
    lift_scale: float = 0.24,
) -> None:
    """
    Perspective-project an ACTUAL cut-out door pixel texture swinging INWARD
    away from the viewer into a room/passage (0° closed -> 84° pushed open inward).
    Matches the 3/4 depth language of public/assets/beodeul-door/door-0..7.png:
    - Foreshortens horizontally by cos(θ)
    - Free edge lifts UPWARD/INWARD by -sin(θ) into the receding room
    - Progressively darkens into interior shadow along the receding leaf
    - Adds a crisp 1px outer latch-edge thickness highlight so the door slab reads clearly
    """
    dw, dh = door_img.size
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)

    horiz_span = max(2.0, dw * cos_a)
    # Inward swing lifts the free edge UPWARD (negative dy) as it recedes into the room
    y_lift_tip = sin_a * max(1.6, min(6.0, dw * lift_scale))

    tip_x = int(round(hinge_x + horiz_span)) if side == "left" else int(round(hinge_x - horiz_span))
    col_step = 1 if tip_x >= hinge_x else -1
    col_xs = list(range(hinge_x, tip_x + col_step, col_step))
    total_cols = max(1, len(col_xs) - 1)

    rim_edge = scale_rgb(pick_tone(tones, 0.42), 0.78)
    rim_top = scale_rgb(pick_tone(tones, 0.52), 0.85)

    for s, px in enumerate(col_xs):
        u = s / total_cols
        if side == "left":
            src_x = min(dw - 1, max(0, int(round(u * (dw - 1)))))
        else:
            src_x = min(dw - 1, max(0, int(round((1.0 - u) * (dw - 1)))))
        if not (0 <= px < dst.width):
            continue
        # Bottom edge lifts inward into the room; top edge also shifts slightly up (clipped by lintel if set)
        dy_top = -int(round(u * y_lift_tip * 0.65))
        dy_bot = -int(round(u * y_lift_tip))
        # Subtle progressive interior shadow as door recedes deeper into room
        shade = 1.0 - sin_a * (0.14 + 0.24 * u)
        is_free_edge = (s == len(col_xs) - 1) and angle_deg >= 20.0
        for y in range(dh):
            v = y / max(1, dh - 1)
            yy = int(round(door_y + y + dy_top * (1.0 - v) + dy_bot * v))
            if top_clip_y is not None and yy < top_clip_y:
                continue
            if not (0 <= yy < dst.height):
                continue
            orig_c = door_img.getpixel((src_x, y))
            if orig_c[3] < 128:
                continue
            c = scale_rgb(orig_c, shade)
            dst.putpixel((px, yy), c)
        # Crisp 1px slab thickness on the free latch edge when pushed inward
        if is_free_edge:
            edge_x = px + (1 if side == "left" else -1)
            if 0 <= edge_x < dst.width:
                for y in range(dh):
                    v = y / max(1, dh - 1)
                    yy = int(round(door_y + y + dy_top * (1.0 - v) + dy_bot * v))
                    if top_clip_y is not None and yy < top_clip_y:
                        continue
                    if 0 <= yy < dst.height:
                        if door_img.getpixel((src_x, y))[3] >= 128:
                            dst.putpixel((edge_x, yy), rim_top if y <= 1 else rim_edge)


def _draw_doorway_interior(
    im: Image.Image,
    box: tuple[int, int, int, int],
    mode: str = "dark_room",
) -> None:
    """Paint the doorway opening exposed when a push-in door swings inward."""
    x0, y0, x1, y1 = box
    if mode == "transparent":
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                im.putpixel((x, y), (0, 0, 0, 0))
        return
    h = max(1, y1 - y0 + 1)
    for y in range(y0, y1 + 1):
        v = (y - y0) / h
        for x in range(x0, x1 + 1):
            if mode == "warm_room":
                # Subtle warm shadowed interior floor peeking near threshold
                if v > 0.78:
                    c = (68, 52, 40, 255) if (x + y) % 2 == 0 else (58, 44, 34, 255)
                elif v > 0.55:
                    c = (44, 34, 28, 255)
                else:
                    c = (24, 18, 18, 255)
            elif mode == "water":
                # Foamy canal water rushing through sluice
                if v > 0.72:
                    c = (206, 238, 250, 255) if (x + y) % 2 == 0 else (124, 188, 224, 255)
                else:
                    c = (42, 92, 134, 255) if (x + y) % 3 != 0 else (68, 128, 168, 255)
            else:
                # Deep shadowed interior room with crisp dark lintel shadow & faint floor step
                if y <= y0 + 2 or x == x0 or x == x1:
                    c = (16, 14, 20, 255)
                elif v > 0.84:
                    c = (46, 40, 44, 255) if x % 2 == 0 else (38, 34, 38, 255)
                else:
                    c = (24, 20, 28, 255)
            im.putpixel((x, y), c)


def animate_push_in_door_from_source(
    src_path: str,
    door_box: tuple[int, int, int, int],
    side: str = "left",
    interior: str = "dark_room",
    pad_top: int = 0,
    top_clip_to_door: bool = True,
    angles: Sequence[float] = (0.0, 26.0, 52.0, 72.0, 82.0),
) -> list[Image.Image]:
    """
    Animate a real single door/gate pushing INWARD away from the viewer.
    Frame 0 = exact original PNG.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    fw, fh = sw, sh + pad_top
    oy = pad_top
    tones = sample_palette_tones(src, door_box)
    door_img = src.crop((door_box[0], door_box[1], door_box[2] + 1, door_box[3] + 1))

    frames: list[Image.Image] = []
    for fi, ang in enumerate(angles):
        fr = make_canvas(fw, fh)
        paste_over(fr, src, 0, oy)
        if fi == 0:
            frames.append(fr)
            continue
        cav = (door_box[0], oy + door_box[1], door_box[2], oy + door_box[3])
        _draw_doorway_interior(fr, cav, mode=interior)
        hinge = door_box[0] if side == "left" else door_box[2]
        clip_y = (oy + door_box[1]) if top_clip_to_door else None
        project_real_door_inward(fr, door_img, hinge, oy + door_box[1], side, ang, tones, top_clip_y=clip_y)
        frames.append(fr)
    return frames


def animate_push_in_double_door_from_source(
    src_path: str,
    left_box: tuple[int, int, int, int],
    right_box: tuple[int, int, int, int],
    cavity_box: tuple[int, int, int, int],
    interior: str = "transparent",
    pad_top: int = 3,
    top_clip_to_door: bool = False,
    angles: Sequence[float] = (0.0, 26.0, 52.0, 72.0, 82.0),
) -> list[Image.Image]:
    """
    Animate a real double gate/door pushing INWARD (both leaves swing inward away from viewer).
    Frame 0 = exact original PNG.
    """
    src = load_rgba(src_path)
    sw, sh = src.size
    fw, fh = sw, sh + pad_top
    oy = pad_top
    tones = sample_palette_tones(src, cavity_box)
    door_l = src.crop((left_box[0], left_box[1], left_box[2] + 1, left_box[3] + 1))
    door_r = src.crop((right_box[0], right_box[1], right_box[2] + 1, right_box[3] + 1))

    frames: list[Image.Image] = []
    for fi, ang in enumerate(angles):
        fr = make_canvas(fw, fh)
        paste_over(fr, src, 0, oy)
        if fi == 0:
            frames.append(fr)
            continue
        cav = (cavity_box[0], oy + cavity_box[1], cavity_box[2], oy + cavity_box[3])
        _draw_doorway_interior(fr, cav, mode=interior)
        clip_y = (oy + cavity_box[1]) if top_clip_to_door else None
        project_real_door_inward(fr, door_l, left_box[0], oy + left_box[1], "left", ang, tones, top_clip_y=clip_y)
        project_real_door_inward(fr, door_r, right_box[2], oy + right_box[1], "right", ang, tones, top_clip_y=clip_y)
        frames.append(fr)
    return frames


def animate_curtain_push_from_source(
    src_path: str,
    curtain_box: tuple[int, int, int, int],
    mode: str = "part",  # "part" (split left/right), "noren" (flip upward/inward), "slide_left"
    interior: str = "transparent",
) -> list[Image.Image]:
    """
    Animate push-through cloth curtains, noren, or tent flaps preserving exact Frame 0 pixels.
    """
    src = load_rgba(src_path)
    w, h = src.size
    x0, y0, x1, y1 = curtain_box
    cw = x1 - x0 + 1
    ch = y1 - y0 + 1
    mid_x = (x0 + x1) // 2

    frames: list[Image.Image] = [src.copy()]
    if mode == "part":
        left_cloth = src.crop((x0, y0, mid_x + 1, y1 + 1))
        right_cloth = src.crop((mid_x + 1, y0, x1 + 1, y1 + 1))
        lw, rw = left_cloth.width, right_cloth.width
        scales = [0.76, 0.56, 0.40, 0.34]
        for fi, sc in enumerate(scales, start=1):
            fr = src.copy()
            _draw_doorway_interior(fr, curtain_box, mode=interior)
            nlw = max(2, int(round(lw * sc)))
            nrw = max(2, int(round(rw * sc)))
            l_res = left_cloth.resize((nlw, ch), Image.NEAREST)
            r_res = right_cloth.resize((nrw, ch), Image.NEAREST)
            # Subtle inward billow & gathered fold darkening at the parted inner edge
            for yy in range(ch):
                dy = -1 if (yy > ch // 2 and fi in (2, 3)) else 0
                for xx in range(nlw):
                    c = l_res.getpixel((xx, yy))
                    if c[3] >= 128:
                        fold = 0.84 if xx == nlw - 1 else (1.06 if xx % 2 == 0 else 0.94)
                        ny = y0 + yy + dy
                        if 0 <= ny < h:
                            fr.putpixel((x0 + xx, ny), scale_rgb(c, fold))
                for xx in range(nrw):
                    c = r_res.getpixel((xx, yy))
                    if c[3] >= 128:
                        fold = 0.84 if xx == 0 else (1.06 if xx % 2 == 0 else 0.94)
                        ny = y0 + yy + dy
                        if 0 <= ny < h:
                            fr.putpixel((x1 - nrw + 1 + xx, ny), scale_rgb(c, fold))
            frames.append(fr)
    elif mode == "noren":
        cloth = src.crop((x0, y0, x1 + 1, y1 + 1))
        # Push through noren: panels billow upward/inward (foreshorten vertically + subtle sway)
        heights = [0.80, 0.54, 0.40, 0.48]
        for fi, hsc in enumerate(heights, start=1):
            fr = src.copy()
            _draw_doorway_interior(fr, curtain_box, mode="transparent")
            nh = max(3, int(round(ch * hsc)))
            c_res = cloth.resize((cw, nh), Image.NEAREST)
            for yy in range(nh):
                v = yy / max(1, nh - 1)
                # Bottom hem shades darker as it flips away/inward into the shop
                shade = 1.0 - 0.28 * v * (1.0 - hsc)
                sway = 1 if (fi == 2 and yy >= nh - 2) else 0
                for xx in range(cw):
                    c = c_res.getpixel((xx, yy))
                    if c[3] >= 128:
                        nx = clamp(x0 + xx + sway, 0, w - 1)
                        fr.putpixel((nx, y0 + yy), scale_rgb(c, shade))
            frames.append(fr)
    elif mode == "slide_left":
        cloth = src.crop((x0, y0, x1 + 1, y1 + 1))
        scales = [0.78, 0.54, 0.36, 0.30]
        for fi, sc in enumerate(scales, start=1):
            fr = src.copy()
            _draw_doorway_interior(fr, curtain_box, mode=interior)
            nw = max(3, int(round(cw * sc)))
            c_res = cloth.resize((nw, ch), Image.NEAREST)
            for yy in range(ch):
                for xx in range(nw):
                    c = c_res.getpixel((xx, yy))
                    if c[3] >= 128:
                        fold = 0.85 if xx == nw - 1 else (1.05 if xx % 2 == 0 else 0.93)
                        fr.putpixel((x0 + xx, y0 + yy), scale_rgb(c, fold))
            frames.append(fr)
    return frames


def animate_frame_sequence(paths: Sequence[str | Path]) -> list[Image.Image]:
    """Assemble an existing real multi-frame PNG sequence directly into a strip."""
    return [load_rgba(p) for p in paths]
