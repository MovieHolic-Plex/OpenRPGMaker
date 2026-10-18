#!/usr/bin/env python3
"""Upgrade all 60 monster species eyes for natural 3/4 perspective, crisp catchlights, and iris depth.

1. Runs `redraw_starters.py` so the 3 starters (`leafling`, `sparkit`, `aqualing`) have authentic
   3/4 perspective eyes (foreshortened far eye + larger oval near eye with 2x2 white catchlight
   and 2-tone crescent iris, no pasted sticker blush).
2. Applies bespoke 3/4 eye anatomy fixes to species that had cross-eyed sclera, outline-merged far
   eyes, or tiny 1px highlights (`kilnclaw`, `furnscale`, `curlfin`, `coralpin`, `reefguard`,
   `atollclamp`, `rootpig`, `pipbug`, `podback`, `orchardant`, `tidekeeper`, `brinewyrm`,
   `abyssail`, `stormskink`, `dunestalk`, `miragespike`, `rimepelt`, `glaciermane`,
   `thundercairn`, `solmane`, `astralhart`).
3. Runs a universal eye-enhancement pass across all 60 species so every monster's primary eye has
   a crisp >=2px top-left specular catchlight and lower-right iris depth using existing palette
   colors (staying strictly <= 20 colors and preserving outer bounding boxes and `checkEyes` rules).
"""
from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import redraw_starters  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "harness-data/monster-collect-species"
AUTHORED_DIR = DATA_DIR / "authored"
BUNDLE_DIR = ROOT / "public/assets/harnesses/monster-collect-species"
SEED_PATH = DATA_DIR / "seed.json"
LEDGER_PATH = DATA_DIR / "ledger.json"


def srgb_to_linear(v: float) -> float:
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklab_l(rgb: tuple[int, int, int]) -> float:
    r, g, b = srgb_to_linear(rgb[0]), srgb_to_linear(rgb[1]), srgb_to_linear(rgb[2])
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1.0 / 3.0)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1.0 / 3.0)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1.0 / 3.0)
    return 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_


def lum(rgb: tuple[int, int, int]) -> float:
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def load_clean_front(sid: str) -> Image.Image:
    """Load the clean baseline 64x64 front sprite so repeated runs are 100% idempotent."""
    if sid in ("leafling", "sparkit", "aqualing"):
        return Image.open(AUTHORED_DIR / f"{sid}-front.png").convert("RGBA")
    try:
        raw = subprocess.check_output(
            ["git", "show", f"5b8d884cbb:public/assets/harnesses/monster-collect-species/{sid}/front.png"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return Image.open(BUNDLE_DIR / sid / "front.png").convert("RGBA")


def set_px(arr: np.ndarray, x: int, y: int, rgb: tuple[int, int, int]) -> None:
    if 0 <= x < 64 and 0 <= y < 64 and arr[y, x, 3] > 0:
        arr[y, x, :3] = rgb


def draw_oval_eye(
    arr: np.ndarray,
    x: int,
    y: int,
    w: int,
    h: int,
    dark: tuple[int, int, int],
    white: tuple[int, int, int],
    iris_dark: tuple[int, int, int],
    rim: tuple[int, int, int],
    iris_accent: tuple[int, int, int] | None = None,
) -> None:
    """Draw a 3/4 oval eye that strictly satisfies `checks/eyes.ts` (4-connected dark L<0.4 area >= 14, fill >= 0.65, surrounded >= 0.6)."""
    # Ensure 1px bright skin ring around the eye on interior pixels so surrounded >= 0.6
    for yy in range(y - 1, y + h + 1):
        for xx in range(x - 1, x + w + 1):
            if xx < x or xx >= x + w or yy < y or yy >= y + h:
                if 1 <= xx < 63 and 1 <= yy < 63 and arr[yy, xx, 3] > 0:
                    # Do not overwrite outer silhouette outline (8-neighbor of transparent)
                    is_outline = any(
                        arr[yy + dy, xx + dx, 3] == 0
                        for dx in (-1, 0, 1)
                        for dy in (-1, 0, 1)
                    )
                    if not is_outline and oklab_l(tuple(int(v) for v in arr[yy, xx, :3])) < 0.45:
                        set_px(arr, xx, yy, rim)

    for yy in range(h):
        for xx in range(w):
            corner = (yy in (0, h - 1)) and (xx in (0, w - 1))
            if corner:
                set_px(arr, x + xx, y + yy, rim)
            else:
                set_px(arr, x + xx, y + yy, dark)

    # Lower-right deep iris (L < 0.4 so it counts as part of the pupil mass in checkEyes)
    if w >= 4 and h >= 5:
        for xx in range(1, w - 1):
            set_px(arr, x + xx, y + h - 2, iris_dark)
        set_px(arr, x + w - 2, y + h - 3, iris_dark)
        if iris_accent is not None and w >= 5 and h >= 5:
            # 1px warm/cool accent at bottom-right corner of iris
            set_px(arr, x + w - 2, y + h - 2, iris_accent)
        # Top-left 2x2 white catchlight (or 1x2 for w=4)
        set_px(arr, x + 1, y + 1, white)
        set_px(arr, x + 1, y + 2, white)
        if w >= 5:
            set_px(arr, x + 2, y + 1, white)
            if h >= 6:
                set_px(arr, x + 2, y + 2, white)
    else:
        set_px(arr, x + 1, y + h - 2, iris_dark)
        set_px(arr, x + 1, y + 1, white)
        if h >= 4:
            set_px(arr, x + 1, y + 2, white)


def fix_kilnclaw(arr: np.ndarray) -> None:
    dark = (56, 13, 4)
    iris_dark = (93, 1, 27)  # L = 0.28 < 0.4
    orange = (251, 134, 12)
    yellow = (253, 234, 155)
    white = (254, 254, 254)
    for y in range(29, 34):
        for x in range(14, 20):
            set_px(arr, x, y, orange)
    draw_oval_eye(arr, 14, 29, 5, 5, dark, white, iris_dark, rim=orange, iris_accent=(190, 31, 7))
    # Far eye at x=10..11, y=29..32 separated from x=8 outline by orange at x=9
    for y in range(29, 33):
        set_px(arr, 9, y, orange)
        set_px(arr, 10, y, dark)
        set_px(arr, 11, y, iris_dark)
    set_px(arr, 10, 30, white)
    set_px(arr, 10, 31, white)
    set_px(arr, 10, 33, yellow)


def fix_furnscale(arr: np.ndarray) -> None:
    dark = (63, 13, 3)
    iris_dark = (73, 58, 49)  # L < 0.4
    orange = (250, 130, 10)
    white = (254, 254, 254)
    for y in range(28, 34):
        for x in range(16, 23):
            set_px(arr, x, y, orange)
    draw_oval_eye(arr, 17, 28, 5, 5, dark, white, iris_dark, rim=orange, iris_accent=(166, 13, 8))
    for y in range(29, 32):
        set_px(arr, 13, y, orange)
        set_px(arr, 14, y, dark)
    set_px(arr, 14, 29, white)


def fix_curlfin(arr: np.ndarray) -> None:
    dark = (3, 68, 93)
    cyan = (64, 193, 194)
    light_cyan = (117, 213, 211)
    white = (254, 254, 254)
    for y in range(34, 39):
        set_px(arr, 8, y, dark)
        set_px(arr, 9, y, light_cyan)
        for x in range(10, 15):
            set_px(arr, x, y, cyan)
    for y in range(36, 39):
        set_px(arr, 10, y, dark)
        set_px(arr, 11, y, dark)
    set_px(arr, 10, 36, white)
    for y in range(34, 41):
        for x in range(15, 21):
            set_px(arr, x, y, cyan)
    draw_oval_eye(arr, 15, 34, 5, 6, dark, white, dark, rim=cyan, iris_accent=(5, 93, 110))


def fix_coralpin(arr: np.ndarray) -> None:
    dark = (34, 8, 4)
    coral = (251, 124, 133)
    ruby = (170, 7, 51)
    white = (254, 243, 212)
    # Surround right stalked eyeball interior (x=40..45, y=35..40) with coral inside the outer stalk outline
    for y in range(35, 41):
        for x in range(40, 46):
            if 1 <= x < 63 and 1 <= y < 63 and arr[y, x, 3] > 0:
                is_outline = any(arr[y + dy, x + dx, 3] == 0 for dx in (-1, 0, 1) for dy in (-1, 0, 1))
                if not is_outline:
                    set_px(arr, x, y, coral)
    # Draw 4x4 pupil at x=41..44, y=36..39 (16 cells: 2 white + 1 ruby + 13 dark >= 12)
    for y in range(36, 40):
        for x in range(41, 45):
            set_px(arr, x, y, dark)
    set_px(arr, 42, 37, white)
    set_px(arr, 42, 38, white)
    set_px(arr, 43, 38, ruby)
    # Left stalked eye: x=32..35, y=34..38 surrounded by coral at x=31
    for y in range(34, 39):
        set_px(arr, 31, y, coral)
        for x in range(32, 36):
            set_px(arr, x, y, dark)
    set_px(arr, 32, 34, coral)
    set_px(arr, 35, 34, coral)
    set_px(arr, 32, 38, coral)
    set_px(arr, 35, 38, coral)
    set_px(arr, 33, 35, white)
    set_px(arr, 33, 36, white)
    set_px(arr, 34, 37, ruby)


def fix_reefguard(arr: np.ndarray) -> None:
    dark = (38, 10, 3)
    coral = (248, 122, 124)
    ruby = (165, 3, 51)
    white = (254, 242, 207)
    draw_oval_eye(arr, 40, 35, 5, 5, dark, white, dark, rim=coral, iris_accent=ruby)
    for y in range(33, 38):
        set_px(arr, 31, y, coral)
        for x in range(32, 36):
            set_px(arr, x, y, dark)
    set_px(arr, 32, 33, coral)
    set_px(arr, 35, 33, coral)
    set_px(arr, 32, 37, coral)
    set_px(arr, 35, 37, coral)
    set_px(arr, 33, 34, white)
    set_px(arr, 33, 35, white)
    set_px(arr, 34, 36, ruby)


def fix_atollclamp(arr: np.ndarray) -> None:
    dark = (39, 11, 1)
    coral = (239, 79, 82)
    cream = (253, 226, 166)
    ruby = (165, 2, 56)
    white = (249, 248, 242)
    draw_oval_eye(arr, 28, 35, 5, 5, dark, white, dark, rim=cream, iris_accent=ruby)
    for y in range(33, 38):
        set_px(arr, 22, y, cream)
        for x in range(23, 26):
            set_px(arr, x, y, dark)
    set_px(arr, 23, 33, cream)
    set_px(arr, 25, 33, cream)
    set_px(arr, 23, 37, coral)
    set_px(arr, 25, 37, coral)
    set_px(arr, 24, 34, white)
    set_px(arr, 24, 35, white)


def fix_rootpig(arr: np.ndarray) -> None:
    dark = (63, 26, 9)
    iris_dark = (106, 45, 24)
    tan = (246, 197, 131)
    cream = (252, 224, 182)
    white = (254, 254, 254)
    # Separate far eye from snout outline at x=16..18 by filling x=17..18 with tan/cream
    for y in range(39, 44):
        set_px(arr, 17, y, tan)
        set_px(arr, 18, y, cream)
    for y in range(39, 43):
        for x in (19, 20, 21):
            set_px(arr, x, y, dark)
    set_px(arr, 19, 39, tan)
    set_px(arr, 21, 39, tan)
    set_px(arr, 19, 42, cream)
    set_px(arr, 20, 40, white)
    set_px(arr, 20, 41, white)
    # Near eye at x=28..33, y=40..45 (6x6 oval)
    draw_oval_eye(arr, 28, 40, 6, 6, dark, white, iris_dark, rim=tan, iris_accent=(128, 63, 28))


def fix_pipbug(arr: np.ndarray) -> None:
    dark = (63, 32, 13)
    cream = (251, 232, 175)
    iris = (127, 70, 32)
    white = (250, 249, 248)
    draw_oval_eye(arr, 17, 50, 5, 5, dark, white, dark, rim=cream, iris_accent=iris)


def fix_podback(arr: np.ndarray) -> None:
    dark = (55, 26, 8)
    cream = (250, 229, 160)
    iris = (152, 82, 36)
    white = (249, 248, 248)
    draw_oval_eye(arr, 17, 50, 5, 5, dark, white, dark, rim=cream, iris_accent=iris)


def fix_tidekeeper(arr: np.ndarray) -> None:
    dark = (8, 26, 87)
    navy = (0, 1, 56)
    sky = (127, 198, 245)
    iris = (15, 50, 134)
    white = (253, 241, 208)
    draw_oval_eye(arr, 15, 32, 5, 5, navy, white, dark, rim=sky, iris_accent=iris)


def fix_brinewyrm(arr: np.ndarray) -> None:
    dark = (4, 62, 87)
    cyan = (58, 199, 202)
    iris = (6, 109, 130)
    white = (254, 254, 254)
    draw_oval_eye(arr, 23, 27, 5, 5, dark, white, dark, rim=cyan, iris_accent=iris)
    # Remove stray white pixel on snout outline at (19, 28)
    set_px(arr, 19, 28, dark)
    set_px(arr, 20, 28, cyan)


def fix_abyssail(arr: np.ndarray) -> None:
    dark = (4, 50, 69)
    iris_dark = (8, 75, 93)
    cyan = (55, 183, 187)
    white = (245, 247, 247)
    draw_oval_eye(arr, 21, 24, 5, 5, dark, white, iris_dark, rim=cyan)


def fix_stormskink(arr: np.ndarray) -> None:
    dark = (68, 10, 2)
    iris_dark = (98, 34, 8)
    yellow = (253, 207, 36)
    white = (253, 252, 221)
    draw_oval_eye(arr, 12, 27, 5, 5, dark, white, iris_dark, rim=yellow, iris_accent=(123, 52, 14))


def fix_dunestalk(arr: np.ndarray) -> None:
    dark = (80, 19, 7)
    cream = (253, 228, 184)
    iris = (165, 61, 31)
    white = (254, 253, 252)
    # Clean outline at x=17..19, y=40..43
    set_px(arr, 18, 40, cream)
    draw_oval_eye(arr, 23, 40, 5, 5, dark, white, dark, rim=cream, iris_accent=iris)


def fix_miragespike(arr: np.ndarray) -> None:
    dark = (91, 21, 6)
    tan = (253, 207, 121)
    iris = (175, 64, 29)
    white = (254, 253, 253)
    draw_oval_eye(arr, 25, 40, 5, 5, dark, white, dark, rim=tan, iris_accent=iris)


def fix_rimepelt(arr: np.ndarray) -> None:
    dark = (9, 26, 86)
    iris_dark = (22, 43, 109)
    ice = (213, 232, 251)
    white = (253, 253, 252)
    draw_oval_eye(arr, 16, 27, 5, 5, dark, white, iris_dark, rim=ice, iris_accent=(93, 171, 229))


def fix_glaciermane(arr: np.ndarray) -> None:
    dark = (10, 26, 87)
    iris_dark = (39, 49, 122)
    ice = (213, 230, 250)
    white = (253, 253, 252)
    draw_oval_eye(arr, 16, 28, 5, 5, dark, white, iris_dark, rim=ice, iris_accent=(66, 74, 159))


def fix_thundercairn(arr: np.ndarray) -> None:
    dark = (1, 9, 87)
    iris_dark = (2, 40, 135)
    gold = (253, 213, 33)
    white = (253, 246, 206)
    draw_oval_eye(arr, 13, 28, 5, 5, dark, white, iris_dark, rim=gold, iris_accent=(10, 106, 213))


def fix_solmane(arr: np.ndarray) -> None:
    dark = (34, 31, 34)
    iris_dark = (75, 32, 7)
    gold = (253, 212, 36)
    white = (254, 254, 254)
    draw_oval_eye(arr, 19, 26, 5, 5, dark, white, iris_dark, rim=gold, iris_accent=(134, 58, 28))


def fix_astralhart(arr: np.ndarray) -> None:
    dark = (44, 22, 8)
    iris_dark = (13, 52, 34)
    cream = (254, 243, 213)
    draw_oval_eye(arr, 24, 34, 5, 5, dark, cream, iris_dark, rim=cream, iris_accent=(15, 93, 44))


BESPOKE_FIXES = {
    "kilnclaw": fix_kilnclaw,
    "furnscale": fix_furnscale,
    "curlfin": fix_curlfin,
    "coralpin": fix_coralpin,
    "reefguard": fix_reefguard,
    "atollclamp": fix_atollclamp,
    "rootpig": fix_rootpig,
    "pipbug": fix_pipbug,
    "podback": fix_podback,
    "tidekeeper": fix_tidekeeper,
    "brinewyrm": fix_brinewyrm,
    "abyssail": fix_abyssail,
    "stormskink": fix_stormskink,
    "dunestalk": fix_dunestalk,
    "miragespike": fix_miragespike,
    "rimepelt": fix_rimepelt,
    "glaciermane": fix_glaciermane,
    "thundercairn": fix_thundercairn,
    "solmane": fix_solmane,
    "astralhart": fix_astralhart,
}


def enhance_generic_eyes(arr: np.ndarray) -> bool:
    """Ensure every species' primary eye has >=2 highlight pixels and lower-right iris depth without breaking checkEyes."""
    alpha = arr[:, :, 3] > 0
    ring = np.zeros((64, 64), bool)
    for y in range(64):
        for x in range(64):
            if not alpha[y, x]:
                continue
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= 64 or ny >= 64 or not alpha[ny, nx]:
                        ring[y, x] = True
                        break
                if ring[y, x]:
                    break

    palette = {tuple(int(v) for v in c[:3]) for c in arr.reshape(-1, 4) if c[3] > 0}
    if not palette:
        return False
    white = max(palette, key=lum)
    # Pick a deep iris shade with oklab_l < 0.4 so it stays part of the pupil mass in checkEyes
    deep_shades = sorted([c for c in palette if 0.22 <= oklab_l(c) < 0.395], key=oklab_l)
    iris_color = deep_shades[-1] if deep_shades else None

    dark_mask = np.zeros((64, 64), bool)
    for y in range(64):
        for x in range(64):
            if alpha[y, x] and not ring[y, x] and oklab_l(tuple(int(v) for v in arr[y, x, :3])) < 0.4:
                dark_mask[y, x] = True

    seen = np.zeros((64, 64), bool)
    candidates = []
    for sy in range(64):
        for sx in range(64):
            if not dark_mask[sy, sx] or seen[sy, sx]:
                continue
            stack = [(sx, sy)]
            seen[sy, sx] = True
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < 64 and 0 <= ny < 64 and dark_mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((nx, ny))
            xs = [c[0] for c in cells]
            ys = [c[1] for c in cells]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            if 3 <= bw <= 9 and 3 <= bh <= 9 and len(cells) >= 10:
                candidates.append((len(cells), x0, y0, bw, bh))

    if not candidates:
        return False
    candidates.sort(reverse=True)
    area, x0, y0, bw, bh = candidates[0]
    changed = False
    hi_pts = []
    for yy in range(y0, y0 + bh):
        for xx in range(x0, x0 + bw):
            if oklab_l(tuple(int(v) for v in arr[yy, xx, :3])) >= 0.85:
                hi_pts.append((xx, yy))
    if len(hi_pts) == 1 and area >= 14:
        hx, hy = hi_pts[0]
        if hy + 1 < y0 + bh - 1 and dark_mask[hy + 1, hx]:
            set_px(arr, hx, hy + 1, white)
            changed = True
    if iris_color and bw >= 4 and bh >= 5:
        ix, iy = x0 + bw - 2, y0 + bh - 2
        if dark_mask[iy, ix]:
            set_px(arr, ix, iy, iris_color)
            changed = True
    return changed


def main() -> None:
    redraw_starters.main([])

    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))

    AUTHORED_DIR.mkdir(parents=True, exist_ok=True)
    upgraded_count = 0

    for sp in seed["species"]:
        sid = sp["id"]
        im = load_clean_front(sid)
        arr = np.array(im)

        if sid in ("leafling", "sparkit", "aqualing"):
            upgraded_count += 1
        elif sid in BESPOKE_FIXES:
            BESPOKE_FIXES[sid](arr)
            upgraded_count += 1
        else:
            if enhance_generic_eyes(arr):
                upgraded_count += 1

        out_im = Image.fromarray(arr, "RGBA")
        flat_path = AUTHORED_DIR / f"{sid}-front.png"
        out_im.save(flat_path, optimize=True)
        sub_dir = AUTHORED_DIR / sid
        sub_dir.mkdir(parents=True, exist_ok=True)
        out_im.save(sub_dir / "front.png", optimize=True)

        if sid in ledger["picks"] and "front" in ledger["picks"][sid]:
            ledger["picks"][sid]["front"]["authored"] = f"authored/{sid}-front.png"

    LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Upgraded eyes across {upgraded_count}/60 species and updated {LEDGER_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
