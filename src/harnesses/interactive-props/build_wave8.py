#!/usr/bin/env python3
"""Wave 8: 20 Real-Source Horror, Haunted Mansion, Crypt & Abandoned Clinic Interactive Props."""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit


def animate_haunted_portrait(src_path: str) -> list[Image.Image]:
    """Mansion portrait: shadow creeps in & eyes shift -> crimson eyes -> crooked jolt + blood tears -> deeper tear drip."""
    src = A.load_rgba(src_path)
    w, h = src.size
    frames: list[Image.Image] = [src.copy()]
    # F1: eerie shadow creeps across upper canvas & eyes shift right
    f1 = src.copy()
    for y in range(4, 10):
        for x in range(5, 12):
            c = f1.getpixel((x, y))
            if c[3] >= 128:
                f1.putpixel((x, y), A.scale_rgb(c, 0.85))
    f1.putpixel((7, 7), (32, 22, 24, 255))
    f1.putpixel((9, 7), (32, 22, 24, 255))
    frames.append(f1)
    # F2: portrait darkens & crimson eyes awaken
    f2 = src.copy()
    for y in range(4, 17):
        for x in range(5, 12):
            c = f2.getpixel((x, y))
            if c[3] >= 128:
                f2.putpixel((x, y), A.scale_rgb(c, 0.68))
    f2.putpixel((7, 7), (242, 42, 52, 255))
    f2.putpixel((9, 7), (242, 42, 52, 255))
    frames.append(f2)
    # F3: frame jolts crooked + bright blood-red eyes + crimson tear pixels
    f3 = A.make_canvas(w, h)
    for y in range(h):
        dx = -1 if y < 10 else 0
        for x in range(w):
            c = f2.getpixel((x, y))
            if c[3] > 0 and 0 <= x + dx < w:
                f3.putpixel((x + dx, y), c)
    f3.putpixel((6, 7), (255, 78, 86, 255))
    f3.putpixel((8, 7), (255, 78, 86, 255))
    f3.putpixel((6, 8), (168, 22, 32, 255))
    f3.putpixel((8, 8), (168, 22, 32, 255))
    frames.append(f3)
    # F4: stays crooked, tears trickle 1px lower + subtle crimson rim aura
    f4 = f3.copy()
    f4.putpixel((6, 7), (222, 36, 46, 255))
    f4.putpixel((8, 7), (222, 36, 46, 255))
    f4.putpixel((6, 9), (146, 18, 28, 255))
    f4.putpixel((8, 9), (146, 18, 28, 255))
    for y in range(10, 16):
        c = f4.getpixel((7, y))
        if c[3] >= 128:
            f4.putpixel((7, y), A.scale_rgb(c, 0.82))
    frames.append(f4)
    return frames


def animate_haunted_organ(src_path: str) -> list[Image.Image]:
    """Ghostly self-playing pipe organ: keys depress on their own + eerie cyan/violet spectral mist from pipes."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Keyboard area: x=12..36, y=27..31; pipe tops: x=8..40, y=5..24
    frames: list[Image.Image] = [src.copy()]
    key_patterns = [
        [14, 19, 25, 31],
        [16, 21, 27, 33],
        [13, 22, 28, 34],
        [15, 20, 26, 30],
    ]
    for fi, keys in enumerate(key_patterns, start=1):
        fr = src.copy()
        # Depressed keys glow ghostly teal-violet
        for kx in keys:
            for ky in (28, 29):
                if 0 <= kx < w and 0 <= ky < h:
                    fr.putpixel((kx, ky), (124, 212, 238, 255) if fi % 2 else (178, 132, 246, 255))
        # Subtle ghostly sheen oscillating along organ pipes
        for px in range(10, 38, 3):
            py = 8 + ((px + fi * 3) % 14)
            c = fr.getpixel((px, py))
            if c[3] >= 128:
                fr.putpixel((px, py), A.tint_rgb(c, (152, 228, 255), 0.45))
        # Floating spectral wisps rising above pipe tops
        wisps = [(14 + fi * 2, 4 - (fi % 2)), (24, 2 + (fi % 2)), (34 - fi * 2, 4 - ((fi + 1) % 2))]
        for wx, wy in wisps:
            if 0 <= wx < w and 0 <= wy < h:
                fr.putpixel((wx, wy), (168, 238, 255, 220))
                if wy + 1 < h and fr.getpixel((wx, wy + 1))[3] < 64:
                    fr.putpixel((wx, wy + 1), (126, 178, 236, 160))
        frames.append(fr)
    return frames


def animate_horror_flicker_lamp(
    src_path: str,
    light_box: tuple[int, int, int, int],
    ghost_rgb: tuple[int, int, int] = (128, 236, 255),
    sway: bool = False,
) -> list[Image.Image]:
    """
    Horror flickering light/chandelier/worklamp:
    F0 = exact original PNG; F1 = sudden dim/blackout; F2 = harsh bright spark flare;
    F3 = eerie ghost-tinted flicker; F4 = dim stutter (loopFromFrame=1).
    """
    src = A.load_rgba(src_path)
    w, h = src.size
    x0, y0, x1, y1 = light_box
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2

    def shift_img(img: Image.Image, dx: int) -> Image.Image:
        if dx == 0:
            return img
        out = A.make_canvas(w, h)
        A.paste_over(out, img, dx, 0)
        return out

    frames: list[Image.Image] = [src.copy()]
    # F1: sudden blackout (dim light_box heavily)
    f1 = src.copy()
    for y in range(max(0, y0), min(h, y1 + 1)):
        for x in range(max(0, x0), min(w, x1 + 1)):
            c = f1.getpixel((x, y))
            if c[3] >= 128 and (c[0] + c[1] + c[2]) > 260:
                f1.putpixel((x, y), A.scale_rgb(c, 0.36))
    frames.append(shift_img(f1, -1 if sway else 0))

    # F2: harsh bright flash + electric spark pixels
    f2 = src.copy()
    for y in range(max(0, y0), min(h, y1 + 1)):
        for x in range(max(0, x0), min(w, x1 + 1)):
            c = f2.getpixel((x, y))
            if c[3] >= 128 and (c[0] + c[1] + c[2]) > 220:
                f2.putpixel((x, y), A.tint_rgb(c, (255, 255, 245), 0.65))
    for sx, sy in [(cx - 3, cy - 2), (cx + 3, cy - 1), (cx + 2, cy + 2), (cx - 2, cy + 2)]:
        if 0 <= sx < w and 0 <= sy < h:
            f2.putpixel((sx, sy), (255, 248, 198, 240))
    frames.append(shift_img(f2, 1 if sway else 0))

    # F3: eerie spectral tint (ghost blue/green or crimson)
    f3 = src.copy()
    for y in range(max(0, y0), min(h, y1 + 1)):
        for x in range(max(0, x0), min(w, x1 + 1)):
            c = f3.getpixel((x, y))
            if c[3] >= 128 and (c[0] + c[1] + c[2]) > 220:
                f3.putpixel((x, y), A.tint_rgb(c, ghost_rgb, 0.72))
    for sx, sy in [(cx - 2, cy - 3), (cx + 2, cy - 2)]:
        if 0 <= sx < w and 0 <= sy < h and f3.getpixel((sx, sy))[3] < 80:
            f3.putpixel((sx, sy), (*ghost_rgb, 195))
    frames.append(shift_img(f3, 0))

    # F4: clean dim stutter (soft dimmed ghost glow, no noisy checkerboard)
    f4 = src.copy()
    for y in range(max(0, y0), min(h, y1 + 1)):
        for x in range(max(0, x0), min(w, x1 + 1)):
            c = src.getpixel((x, y))
            if c[3] >= 128 and (c[0] + c[1] + c[2]) > 220:
                f4.putpixel((x, y), A.tint_rgb(A.scale_rgb(c, 0.58), ghost_rgb, 0.35))
    frames.append(shift_img(f4, -1 if sway else 0))
    return frames


def animate_cursed_mirror(src_path: str) -> list[Image.Image]:
    """Standing full-length mirror: glass darkens -> dark apparition silhouette + glowing red eyes -> hairline crack."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Glass interior in 32x48 mirror_standing.png: x=10..21, y=10..33
    gx0, gy0, gx1, gy1 = 10, 10, 21, 33
    rng = random.Random(666)
    frames: list[Image.Image] = [src.copy()]

    # F1: static ripple shimmer across mirror glass
    f1 = src.copy()
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            c = f1.getpixel((x, y))
            if c[3] >= 128:
                f1.putpixel((x, y), A.scale_rgb(c, 0.80 if (y % 2 == 0) else 0.96))
    frames.append(f1)

    # F2: dark shadowy apparition emerges inside the glass
    f2 = src.copy()
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            c = f2.getpixel((x, y))
            if c[3] >= 128:
                # Head + shoulders silhouette in center of glass
                in_head = ((x - 15.5) ** 2 + (y - 17.5) ** 2) <= 10.5
                in_body = (y >= 21 and 12 <= x <= 19)
                if in_head or in_body:
                    f2.putpixel((x, y), (24, 22, 34, 255))
                else:
                    f2.putpixel((x, y), A.tint_rgb(A.scale_rgb(c, 0.55), (42, 58, 72), 0.45))
    frames.append(f2)

    # F3: apparition flashes bright crimson eyes + diagonal glass crack!
    f3 = f2.copy()
    f3.putpixel((14, 17), (255, 54, 64, 255))
    f3.putpixel((17, 17), (255, 54, 64, 255))
    f3.putpixel((14, 18), (186, 24, 34, 255))
    f3.putpixel((17, 18), (186, 24, 34, 255))
    for k in range(8):
        cx = 12 + k
        cy = 12 + k * 2
        if gx0 <= cx <= gx1 and gy0 <= cy <= gy1:
            f3.putpixel((cx, cy), (226, 238, 248, 255))
            if cx + 1 <= gx1:
                f3.putpixel((cx + 1, cy), (34, 38, 48, 255))
    frames.append(f3)

    # F4: apparition vanishes, leaving eerie darkened cracked mirror
    f4 = src.copy()
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            c = f4.getpixel((x, y))
            if c[3] >= 128:
                f4.putpixel((x, y), A.scale_rgb(c, 0.72))
    for k in range(8):
        cx = 12 + k
        cy = 12 + k * 2
        if gx0 <= cx <= gx1 and gy0 <= cy <= gy1:
            f4.putpixel((cx, cy), (220, 234, 244, 255))
            if cx + 1 <= gx1:
                f4.putpixel((cx + 1, cy), (32, 36, 46, 255))
    frames.append(f4)
    return frames


def animate_statue_awaken(
    src_path: str,
    eye_pts: list[tuple[int, int]],
    rune_box: tuple[int, int, int, int] | None = None,
    glow_rgb: tuple[int, int, int] = (255, 52, 62),
    tears: bool = False,
) -> list[Image.Image]:
    """Knight statue / weeping angel / skull niche: subtle eerie jolt + crimson eye glow + optional blood tears."""
    src = A.load_rgba(src_path)
    w, h = src.size
    frames: list[Image.Image] = [src.copy()]
    shifts = [0, 1, 0, -1, 0]
    for fi in range(1, 5):
        fr = A.make_canvas(w, h)
        dx = shifts[fi] if fi in (1, 3) else 0
        A.paste_over(fr, src, dx, 0)
        if rune_box:
            rx0, ry0, rx1, ry1 = rune_box
            strength = [0.0, 0.18, 0.38, 0.52, 0.32][fi]
            for y in range(max(0, ry0), min(h, ry1 + 1)):
                for x in range(max(0, rx0), min(w, rx1 + 1)):
                    c = fr.getpixel((x, y))
                    if c[3] >= 128:
                        fr.putpixel((x, y), A.tint_rgb(c, glow_rgb, strength))
        for ex, ey in eye_pts:
            px = A.clamp(ex + dx, 0, w - 1)
            if 0 <= ey < h:
                col = (*glow_rgb, 255) if fi >= 2 else (glow_rgb[0] // 2, glow_rgb[1] // 2, glow_rgb[2] // 2, 255)
                fr.putpixel((px, ey), col)
                if tears and fi >= 2:
                    for ty in range(1, fi + 1):
                        if ey + ty < h:
                            fr.putpixel((px, ey + ty), (178, 22, 34, 245))
        frames.append(fr)
    return frames


def animate_ghost_candelabra(src_path: str) -> list[Image.Image]:
    """Crypt candelabra: erase warm flames in F0 -> ghostly cyan-blue will-o'-wisp ignition loop."""
    lit = A.load_rgba(src_path)
    w, h = lit.size
    unlit = lit.copy()
    flame_px: list[tuple[int, int, A.RGBA]] = []
    # Flames sit in upper rows y=2..11 where pixels are warm orange/yellow
    for y in range(0, 13):
        for x in range(w):
            r, g, b, a = lit.getpixel((x, y))
            if a >= 128 and r > 180 and (r - b) > 50:
                flame_px.append((x, y, (r, g, b, a)))
                unlit.putpixel((x, y), (0, 0, 0, 0))
    frames: list[Image.Image] = [unlit.copy()]
    # F1: faint blue spark
    f1 = unlit.copy()
    for x, y, _ in flame_px[::3]:
        f1.putpixel((x, y), (112, 214, 255, 220))
    frames.append(f1)
    # F2..F4: flickering ghostly blue-cyan flames + rising soul wisps
    for fi in range(2, 5):
        fr = unlit.copy()
        dy = -1 if fi == 3 else 0
        dx = -1 if fi == 4 else 0
        for x, y, (r, g, b, a) in flame_px:
            nx, ny = A.clamp(x + dx, 0, w - 1), A.clamp(y + dy, 0, h - 1)
            lum = (r + g + b) / 765.0
            col = (214, 248, 255, 255) if lum > 0.78 else ((92, 212, 255, 255) if lum > 0.55 else (56, 136, 224, 255))
            fr.putpixel((nx, ny), col)
        # Tiny rising wisp above center candle
        wy = max(0, 3 - (fi - 2))
        fr.putpixel((w // 2 + (fi % 2), wy), (156, 236, 255, 190))
        frames.append(fr)
    return frames


def animate_crypt_altar_curse(src_path: str) -> list[Image.Image]:
    """Crypt skull altar: skull eyes ignite blood-red + twin candles turn spectral blue + rising cursed mist."""
    src = A.load_rgba(src_path)
    w, h = src.size
    frames: list[Image.Image] = [src.copy()]
    for fi in range(1, 5):
        fr = src.copy()
        # Turn warm flame pixels (y=2..11) to spectral cyan-violet
        for y in range(2, 12):
            for x in range(4, 28):
                r, g, b, a = fr.getpixel((x, y))
                if a >= 128 and r > 180 and (r - b) > 55:
                    target = (118, 226, 255) if fi % 2 else (178, 126, 255)
                    fr.putpixel((x, y), A.tint_rgb((r, g, b, a), target, 0.78))
        # Skull eye sockets near center (14, 11) and (17, 11) glow crimson
        if fi >= 2:
            for ex in (14, 15, 17):
                fr.putpixel((ex, 11), (255, 52, 62, 255))
        # Rising crimson/violet cursed motes
        for mx, my in [(10, 6 - fi), (16, 4 - (fi % 3)), (22, 6 - (fi % 2))]:
            if 0 <= mx < w and 0 <= my < h and fr.getpixel((mx, my))[3] < 80:
                fr.putpixel((mx, my), (222, 74, 118, 215))
        frames.append(fr)
    return frames


def animate_ossuary_rattle(src_path: str) -> list[Image.Image]:
    """Ossuary skull wall: multiple skulls awaken with eerie red/cyan eye glints and rattle."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Locate bright skull centers across the 48x32 grid
    skull_eyes = [(9, 10), (16, 12), (26, 11), (35, 10), (13, 19), (24, 20), (34, 19), (41, 14)]
    frames: list[Image.Image] = [src.copy()]
    for fi in range(1, 5):
        fr = A.make_canvas(w, h)
        A.paste_over(fr, src, 1 if fi == 2 else (-1 if fi == 3 else 0), 0)
        for idx, (ex, ey) in enumerate(skull_eyes):
            if (idx + fi) % 2 == 0 or fi >= 3:
                col = (255, 56, 68, 255) if (idx % 3 != 0) else (104, 238, 255, 255)
                if 0 <= ex < w and 0 <= ey < h:
                    fr.putpixel((ex, ey), col)
                    if ex + 2 < w:
                        fr.putpixel((ex + 2, ey), col)
        frames.append(fr)
    return frames


def animate_torture_cage_horror(src_path: str) -> list[Image.Image]:
    """Dungeon cage rattles violently while glowing crimson eyes peer out from the dark interior."""
    src = A.load_rgba(src_path)
    w, h = src.size
    frames: list[Image.Image] = [src.copy()]
    shifts = [0, -1, 1, -1, 0]
    for fi in range(1, 5):
        fr = A.make_canvas(w, h)
        dx = shifts[fi]
        A.paste_over(fr, src, dx, 0)
        # Glowing eerie eyes inside the dark bars (x=13, 17, y=14)
        if fi >= 2:
            for ex in (13 + dx, 17 + dx):
                if 0 <= ex < w:
                    fr.putpixel((ex, 14), (255, 62, 68, 255))
                    fr.putpixel((ex, 15), (178, 28, 36, 220))
        frames.append(fr)
    return frames


def animate_cemetery_mist_arch(src_path: str) -> list[Image.Image]:
    """Cemetery stone arch: eerie spectral mist & floating blue will-o'-wisps drift through the gateway."""
    src = A.load_rgba(src_path)
    w, h = src.size
    frames: list[Image.Image] = [src.copy()]
    for fi in range(1, 5):
        fr = src.copy()
        # Ground-level ghostly mist rolling across the open arch (x=15..33, y=22..29)
        for y in range(21, 30):
            for x in range(15, 34):
                if fr.getpixel((x, y))[3] < 64:
                    wave = math.sin((x + fi * 3) * 0.45) + math.cos((y + fi) * 0.6)
                    if wave > 0.35:
                        alpha = 110 if y > 24 else 75
                        fr.putpixel((x, y), (146, 178, 226, alpha))
        # Two floating will-o'-wisps drifting up inside the arch
        wisps = [
            (20 + (fi % 3), 20 - fi * 2),
            (28 - (fi % 2), 23 - fi * 2),
        ]
        for wx, wy in wisps:
            if 0 <= wx < w and 0 <= wy < h:
                fr.putpixel((wx, wy), (224, 248, 255, 255))
                for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    if 0 <= wx + ox < w and 0 <= wy + oy < h and fr.getpixel((wx + ox, wy + oy))[3] < 80:
                        fr.putpixel((wx + ox, wy + oy), (96, 206, 255, 185))
        frames.append(fr)
    return frames


def animate_scarecrow_twitch(src_path: str) -> list[Image.Image]:
    """Scarecrow head & arms twitch eerily with glowing crimson eyes under the straw hat."""
    src = A.load_rgba(src_path)
    w, h = src.size
    upper = src.crop((0, 0, w, 19))
    lower = src.crop((0, 19, w, h))
    frames: list[Image.Image] = [src.copy()]
    tilts = [0, -6, 9, -4, 5]
    for fi in range(1, 5):
        fr = A.make_canvas(w, h)
        A.paste_over(fr, lower, 0, 19)
        rot = upper.rotate(tilts[fi], resample=Image.NEAREST, center=(16, 18))
        A.paste_over(fr, rot, 0, 0)
        # Crimson eyes glowing under hat brim (approx x=14,17 y=12)
        if fi >= 2:
            fr.putpixel((14, 12), (255, 58, 62, 255))
            fr.putpixel((17, 12), (255, 58, 62, 255))
        frames.append(fr)
    return frames


def animate_wheelchair_roll(src_path: str) -> list[Image.Image]:
    """Abandoned clinic wheelchairs: right wheelchair eerily rolls forward/back on its own!"""
    src = A.load_rgba(src_path)
    w, h = src.size
    left_wc = src.crop((0, 0, 16, h))
    right_wc = src.crop((16, 0, w, h))
    frames: list[Image.Image] = [src.copy()]
    offsets = [(0, 0), (1, 1), (2, 2), (1, 1), (0, 2)]
    for fi in range(1, 5):
        fr = A.make_canvas(w, h)
        A.paste_over(fr, left_wc, 0, 0)
        dx, dy = offsets[fi]
        A.paste_over(fr, right_wc, 16 + dx, dy)
        frames.append(fr)
    return frames


def animate_stretcher_rattle(src_path: str) -> list[Image.Image]:
    """Clinic stretcher jolts/rattles back and forth with eerie pale shadow pulse."""
    src = A.load_rgba(src_path)
    w, h = src.size
    frames: list[Image.Image] = [src.copy()]
    shifts = [(0, 0), (-1, 0), (2, -1), (-2, 0), (1, 0)]
    for fi in range(1, 5):
        fr = A.make_canvas(w, h)
        dx, dy = shifts[fi]
        A.paste_over(fr, src, dx, dy)
        if fi in (2, 3):
            # Subtle cold clinical flicker highlight on top rail
            for x in range(12, 36, 3):
                c = fr.getpixel((x, 12))
                if c[3] >= 128:
                    fr.putpixel((x, 12), A.tint_rgb(c, (172, 242, 232), 0.55))
        frames.append(fr)
    return frames


def animate_mannequin_turn(src_path: str) -> list[Image.Image]:
    """Creepy tailor mannequin slowly turns its torso/shoulders to face the player (horizontal 3/4 foreshorten + flip)."""
    src = A.load_rgba(src_path)
    w, h = src.size
    torso = src.crop((3, 5, 13, 21))
    stand = src.copy()
    for y in range(5, 21):
        for x in range(3, 13):
            stand.putpixel((x, y), (0, 0, 0, 0))
    steps = [(1.0, False), (0.72, False), (0.44, False), (0.72, True), (1.0, True)]
    frames: list[Image.Image] = [src.copy()]
    for fi, (sx, flip) in enumerate(steps[1:], start=1):
        fr = stand.copy()
        t = torso.transpose(Image.FLIP_LEFT_RIGHT) if flip else torso
        nw = max(3, int(round(t.width * sx)))
        ts = t.resize((nw, t.height), Image.NEAREST)
        A.paste_over(fr, ts, 8 - nw // 2, 5)
        frames.append(fr)
    return frames


def build_wave8() -> list[dict]:
    items = [
        dict(
            id="horror-mansion-portrait", name="저택의 저주받은 초상화", era="fantasy", world="fantasy",
            category="gimmick", zone="indoor", mount="wall",
            genres=["horror", "puzzle-escape", "adventure"], roles=["puzzle-clue", "hazard-trap"],
            motion="toggle-switch", playback="toggle", footprint=[1, 2], anchorX=0.5, anchorY=0.90, frameMs=120, se="wood_creak",
            tags=["공포", "초상화", "액자", "저택", "귀신", "눈동자"],
            sourcePng="tiledata/beodeul-interiors/pieces/portrait.png",
            frames_img=animate_haunted_portrait(str(ROOT / "tiledata/beodeul-interiors/pieces/portrait.png")),
        ),
        dict(
            id="horror-pipe-organ", name="유령이 연주하는 파이프 오르간", era="fantasy", world="fantasy",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape", "adventure"], roles=["puzzle-clue", "ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[3, 3], anchorX=0.5, anchorY=0.94, frameMs=130, se="bell_gong",
            tags=["공포", "오르간", "성당", "저택", "유령", "연주"],
            sourcePng="tiledata/beodeul-interiors/pieces/organ.png",
            frames_img=animate_haunted_organ(str(ROOT / "tiledata/beodeul-interiors/pieces/organ.png")),
        ),
        dict(
            id="horror-gothic-chandelier", name="깜빡이는 고딕 샹들리에", era="fantasy", world="fantasy",
            category="light-fire", zone="indoor", mount="wall",
            genres=["horror", "adventure"], roles=["ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[2, 2], anchorX=0.5, anchorY=0.85, frameMs=115, se="fire_ignite",
            tags=["공포", "샹들리에", "촛불", "깜빡임", "저택"],
            sourcePng="tiledata/beodeul-interiors/pieces/chandelier.png",
            frames_img=animate_horror_flicker_lamp(
                str(ROOT / "tiledata/beodeul-interiors/pieces/chandelier.png"),
                light_box=(5, 7, 27, 22), ghost_rgb=(118, 228, 255), sway=True,
            ),
        ),
        dict(
            id="horror-knight-statue", name="움직이는 갑옷 기사 석상", era="fantasy", world="fantasy",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape", "adventure"], roles=["puzzle-clue", "hazard-trap"],
            motion="toggle-switch", playback="toggle", footprint=[1, 3], anchorX=0.5, anchorY=0.95, frameMs=120, se="stone_scrape",
            tags=["공포", "석상", "기사", "저택", "안광", "기믹"],
            sourcePng="tiledata/beodeul-interiors/pieces/knight-statue.png",
            frames_img=animate_statue_awaken(
                str(ROOT / "tiledata/beodeul-interiors/pieces/knight-statue.png"),
                eye_pts=[(7, 10), (9, 10)], rune_box=(6, 35, 10, 37), glow_rgb=(255, 52, 62),
            ),
        ),
        dict(
            id="horror-standing-mirror", name="귀신 스치는 전신 거울", era="fantasy", world="fantasy",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape"], roles=["puzzle-clue", "hazard-trap"],
            motion="toggle-switch", playback="oneshot", footprint=[2, 3], anchorX=0.5, anchorY=0.94, frameMs=135, se="glass_break",
            tags=["공포", "거울", "전신거울", "귀신", "유령", "균열"],
            sourcePng="public/assets/beodeul-objects/mirror_standing.png",
            frames_img=animate_cursed_mirror(str(ROOT / "public/assets/beodeul-objects/mirror_standing.png")),
        ),
        dict(
            id="horror-weeping-angel", name="피눈물 흘리는 천사 석상", era="dungeon", world="dungeon",
            category="gimmick", zone="both", mount="floor",
            genres=["horror", "puzzle-escape", "adventure"], roles=["puzzle-clue", "hazard-trap"],
            motion="toggle-switch", playback="toggle", footprint=[2, 3], anchorX=0.5, anchorY=0.94, frameMs=125, se="stone_scrape",
            tags=["공포", "천사석상", "납골당", "피눈물", "던전", "기믹"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-angel.png",
            frames_img=animate_statue_awaken(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-angel.png"),
                eye_pts=[(14, 15), (17, 15)], rune_box=(12, 37, 20, 41), glow_rgb=(242, 42, 54), tears=True,
            ),
        ),
        dict(
            id="horror-crypt-candelabra", name="납골당 푸른 도깨비불 촛대", era="dungeon", world="dungeon",
            category="light-fire", zone="indoor", mount="floor",
            genres=["horror", "adventure"], roles=["ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=2,
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=115, se="magic_chime",
            tags=["공포", "촛대", "도깨비불", "유령불", "납골당"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-candelabra.png",
            frames_img=animate_ghost_candelabra(str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-candelabra.png")),
        ),
        dict(
            id="horror-crypt-altar", name="지하 납골당 저주 제단", era="dungeon", world="dungeon",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape", "adventure"], roles=["puzzle-clue", "ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=2,
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=120, se="magic_chime",
            tags=["공포", "제단", "해골", "납골당", "저주", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-altar.png",
            frames_img=animate_crypt_altar_curse(str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-altar.png")),
        ),
        dict(
            id="horror-skull-niche", name="벽면 해골 감실 안광", era="dungeon", world="dungeon",
            category="gimmick", zone="indoor", mount="wall",
            genres=["horror", "puzzle-escape"], roles=["puzzle-clue", "ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=125, se="bone_rattle",
            tags=["공포", "해골", "벽감실", "안광", "납골당", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-niche-skull.png",
            frames_img=animate_statue_awaken(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-niche-skull.png"),
                eye_pts=[(6, 20), (8, 20)], rune_box=(9, 13, 12, 18), glow_rgb=(112, 238, 255),
            ),
        ),
        dict(
            id="horror-tomb-slab", name="밀려 열리는 지하 묘비 석판", era="dungeon", world="dungeon",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape", "adventure"], roles=["passage", "puzzle-clue"],
            motion="slide-door", playback="toggle", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=125, se="stone_scrape",
            tags=["공포", "묘비", "석판", "비밀통로", "납골당", "탈출"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-tomb-slab.png",
            frames_img=A.animate_slide_secret_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-tomb-slab.png"),
                slide_px=14, pad_right=14,
            ),
        ),
        dict(
            id="horror-ossuary-wall", name="덜컹거리는 납골당 해골 벽", era="dungeon", world="dungeon",
            category="gimmick", zone="indoor", mount="wall",
            genres=["horror", "puzzle-escape"], roles=["puzzle-clue", "hazard-trap"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[3, 2], anchorX=0.5, anchorY=0.92, frameMs=120, se="bone_rattle",
            tags=["공포", "납골당", "해골벽", "안광", "덜컹", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-ossuary.png",
            frames_img=animate_ossuary_rattle(str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-ossuary.png")),
        ),
        dict(
            id="horror-torture-cage", name="흔들리는 지하 철창 우리", era="dungeon", world="dungeon",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape"], roles=["hide", "hazard-trap"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="metal_grate",
            tags=["공포", "철창", "감옥", "우리", "던전", "눈빛"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/hd-cage.png",
            frames_img=animate_torture_cage_horror(str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/hd-cage.png")),
        ),
        dict(
            id="horror-cemetery-arch", name="공동묘지 안개 유령 아치문", era="fantasy", world="fantasy",
            category="door-pass", zone="outdoor", mount="doorway",
            genres=["horror", "adventure"], roles=["passage", "ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[3, 2], anchorX=0.5, anchorY=0.94, frameMs=130, se="magic_chime",
            tags=["공포", "공동묘지", "묘지문", "안개", "도깨비불", "아치"],
            sourcePng="tiledata/beodeul-objects/pieces/bd-cemetery-gate.png",
            frames_img=animate_cemetery_mist_arch(str(ROOT / "tiledata/beodeul-objects/pieces/bd-cemetery-gate.png")),
        ),
        dict(
            id="horror-scarecrow-twitch", name="움찔하는 저주 허수아비", era="fantasy", world="fantasy",
            category="gimmick", zone="outdoor", mount="floor",
            genres=["horror", "life-survival"], roles=["hazard-trap"],
            motion="toggle-switch", playback="oneshot", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="wood_creak",
            tags=["공포", "허수아비", "밭", "깜짝", "안광"],
            sourcePng="public/assets/beodeul-objects/scarecrow.png",
            frames_img=animate_scarecrow_twitch(str(ROOT / "public/assets/beodeul-objects/scarecrow.png")),
        ),
        dict(
            id="horror-gothic-lamp", name="깜빡이는 고딕 철제 가로등", era="fantasy", world="fantasy",
            category="light-fire", zone="outdoor", mount="floor",
            genres=["horror", "adventure"], roles=["ambient-light"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[1, 3], anchorX=0.5, anchorY=0.95, frameMs=115, se="steam_click",
            tags=["공포", "가로등", "깜빡임", "밤거리", "고딕"],
            sourcePng="public/assets/beodeul-objects/street_lamp_iron.png",
            frames_img=animate_horror_flicker_lamp(
                str(ROOT / "public/assets/beodeul-objects/street_lamp_iron.png"),
                light_box=(4, 5, 12, 16), ghost_rgb=(146, 224, 255), sway=False,
            ),
        ),
        dict(
            id="horror-clinic-wheelchair", name="저절로 굴러가는 폐병원 휠체어", era="modern", world="modern",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape"], roles=["hazard-trap"],
            motion="toggle-switch", playback="oneshot", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=120, se="metal_latch",
            tags=["공포", "폐병원", "병원", "휠체어", "현대", "귀신"],
            sourcePng="public/assets/beodeul-objects/city_clinic_wheelchairs.png",
            frames_img=animate_wheelchair_roll(str(ROOT / "public/assets/beodeul-objects/city_clinic_wheelchairs.png")),
        ),
        dict(
            id="horror-clinic-stretcher", name="덜컹거리는 폐병원 이동 들것", era="modern", world="modern",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape"], roles=["hazard-trap"],
            motion="toggle-switch", playback="oneshot", footprint=[3, 2], anchorX=0.5, anchorY=0.92, frameMs=110, se="metal_grate",
            tags=["공포", "폐병원", "병원", "들것", "현대"],
            sourcePng="public/assets/beodeul-objects/city_clinic_folded_stretcher.png",
            frames_img=animate_stretcher_rattle(str(ROOT / "public/assets/beodeul-objects/city_clinic_folded_stretcher.png")),
        ),
        dict(
            id="horror-clinic-medbin", name="폐병원 의료 폐기물함 열기", era="modern", world="modern",
            category="container", zone="indoor", mount="counter",
            genres=["horror", "puzzle-escape"], roles=["loot", "puzzle-clue"],
            motion="hinge-lid", playback="toggle", footprint=[1, 1], anchorX=0.5, anchorY=0.92, frameMs=105, se="plastic_lid",
            tags=["공포", "폐병원", "병원", "폐기물함", "단서", "현대"],
            sourcePng="public/assets/beodeul-objects/city_clinic_medical_waste_bin.png",
            frames_img=A.animate_hinged_lid_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_clinic_medical_waste_bin.png"),
                lid_box=(2, 2, 13, 6), seam_y=7, loot_style="gold",
            ),
        ),
        dict(
            id="horror-tailor-mannequin", name="고개 돌리는 폐건물 마네킹", era="modern", world="modern",
            category="gimmick", zone="indoor", mount="floor",
            genres=["horror", "puzzle-escape"], roles=["hazard-trap", "puzzle-clue"],
            motion="toggle-switch", playback="toggle", footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=130, se="wood_creak",
            tags=["공포", "마네킹", "폐건물", "폐교", "깜짝", "현대"],
            sourcePng="public/assets/beodeul-objects/city_tailo_mannequin_torso_stand.png",
            frames_img=animate_mannequin_turn(str(ROOT / "public/assets/beodeul-objects/city_tailo_mannequin_torso_stand.png")),
        ),
        dict(
            id="horror-worklamp-flicker", name="폐가 작업등 치직 점멸", era="modern", world="modern",
            category="light-fire", zone="both", mount="floor",
            genres=["horror", "puzzle-escape"], roles=["ambient-light", "hazard-trap"],
            motion="activate-loop", playback="loopAfterOpen", loopFromFrame=1,
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="sci_beep",
            tags=["공포", "폐가", "작업등", "깜빡임", "정전", "현대"],
            sourcePng="public/assets/beodeul-objects/city_auto_portable_worklamp.png",
            frames_img=animate_horror_flicker_lamp(
                str(ROOT / "public/assets/beodeul-objects/city_auto_portable_worklamp.png"),
                light_box=(3, 7, 12, 16), ghost_rgb=(255, 112, 118), sway=False,
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave8-horror"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave8(), "wave8-horror")
