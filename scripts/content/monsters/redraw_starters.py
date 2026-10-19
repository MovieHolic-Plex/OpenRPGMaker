#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# uv run scripts/content/monsters/redraw_starters.py
# python3 scripts/content/monsters/redraw_starters.py
"""Restore the 3 first-region starters (`sparkit`, `aqualing`, `leafling`) from their authentic
Pokemon Black & White pixel-art grids (`57eef00592`) and provide shared BW eye/outline helpers.
"""
from __future__ import annotations

import io
import subprocess
import sys
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image

ROOT: Final[Path] = Path(__file__).resolve().parents[3]
OUT: Final[Path] = ROOT / "harness-data/monster-collect-species/authored"
BASELINE_REF: Final[str] = "57eef00592"

Rgb = tuple[int, int, int]
NearEyeSpec = tuple[int, int, int, int, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb | None]
FarEyeSpec = tuple[int, int, int, Rgb, Rgb, Rgb, Rgb, int | None, Rgb | None]


def srgb_to_linear(v: float) -> float:
    """Convert sRGB channel (0..255) to linear light."""
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklab_l(rgb: Rgb) -> float:
    """Compute OKLab lightness L for an RGB tuple."""
    r, g, b = srgb_to_linear(rgb[0]), srgb_to_linear(rgb[1]), srgb_to_linear(rgb[2])
    l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    return 0.2104542553 * (l_ ** (1 / 3)) + 0.7936177850 * (m_ ** (1 / 3)) - 0.0040720468 * (s_ ** (1 / 3))


def load_bw_starter(sid: str, side: str) -> Image.Image:
    """Load the authentic 64x64 BW pixel-art starter sprite from commit 57eef00592."""
    raw = subprocess.check_output(
        ["git", "show", f"{BASELINE_REF}:public/assets/harnesses/monster-collect-species/{sid}/{side}.png"],
        cwd=ROOT,
    )
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def ensure_dark_outline(arr: np.ndarray, default_dark: Rgb, max_l: float = 0.345) -> None:
    """Ensure every silhouette edge pixel (4-neighbor of transparent) has L < 0.35."""
    alpha = arr[:, :, 3] > 0
    orig = arr.copy()
    for y in range(64):
        for x in range(64):
            if not alpha[y, x]:
                continue
            is_edge = any(
                x + dx < 0 or x + dx >= 64 or y + dy < 0 or y + dy >= 64 or not alpha[y + dy, x + dx]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if not is_edge:
                continue
            c: Rgb = (int(orig[y, x, 0]), int(orig[y, x, 1]), int(orig[y, x, 2]))
            if oklab_l(c) < max_l:
                continue
            found: Rgb | None = None
            found_l = 1.0
            for yy in range(max(0, y - 3), min(64, y + 4)):
                for xx in range(max(0, x - 3), min(64, x + 4)):
                    if not alpha[yy, xx]:
                        continue
                    nc: Rgb = (int(orig[yy, xx, 0]), int(orig[yy, xx, 1]), int(orig[yy, xx, 2]))
                    nl = oklab_l(nc)
                    if nl < max_l and nl < found_l:
                        found = nc
                        found_l = nl
            arr[y, x, :3] = found if found is not None else default_dark


def draw_bw_eye(arr: np.ndarray, spec: NearEyeSpec) -> None:
    """Stamp a #6/#7/#8/#10-style 3/4 near eye with 2x2 catchlight and 2-tone iris."""
    x0, y0, w, h, dark, pupil, iris_dark, iris_hi, white, skin = spec
    if skin is not None:
        for xx in range(x0 - 1, x0 + w + 1):
            if 0 <= xx < 64:
                if 0 <= y0 - 1 < 64 and arr[y0 - 1, xx, 3] > 0 and oklab_l((int(arr[y0 - 1, xx, 0]), int(arr[y0 - 1, xx, 1]), int(arr[y0 - 1, xx, 2]))) < 0.4:
                    arr[y0 - 1, xx, :3] = skin
                if 0 <= y0 + h < 64 and arr[y0 + h, xx, 3] > 0 and oklab_l((int(arr[y0 + h, xx, 0]), int(arr[y0 + h, xx, 1]), int(arr[y0 + h, xx, 2]))) < 0.4:
                    arr[y0 + h, xx, :3] = skin
        for yy in range(y0 - 1, y0 + h + 1):
            if 0 <= yy < 64:
                if 0 <= x0 - 1 < 64 and arr[yy, x0 - 1, 3] > 0 and oklab_l((int(arr[yy, x0 - 1, 0]), int(arr[yy, x0 - 1, 1]), int(arr[yy, x0 - 1, 2]))) < 0.4:
                    arr[yy, x0 - 1, :3] = skin
                if 0 <= x0 + w < 64 and arr[yy, x0 + w, 3] > 0 and oklab_l((int(arr[yy, x0 + w, 0]), int(arr[yy, x0 + w, 1]), int(arr[yy, x0 + w, 2]))) < 0.4:
                    arr[yy, x0 + w, :3] = skin
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w):
            arr[yy, xx] = (*pupil, 255)
    for xx in range(x0, x0 + w):
        arr[y0, xx] = (*dark, 255)
        arr[y0 + h - 1, xx] = (*dark, 255)
    for yy in range(y0, y0 + h):
        arr[yy, x0] = (*dark, 255)
    if skin is not None and w >= 5 and h >= 6:
        arr[y0, x0] = (*skin, 255)
        arr[y0 + h - 1, x0] = (*skin, 255)
        arr[y0 + h - 1, x0 + w - 1] = (*skin, 255)
    for dy in (1, 2):
        for dx in (1, 2):
            arr[y0 + dy, x0 + dx] = (*white, 255)
    if h >= 6:
        for xx in range(x0 + 2, x0 + w - 1):
            arr[y0 + h - 3, xx] = (*iris_dark, 255)
        for xx in range(x0 + 1, x0 + w - 1):
            arr[y0 + h - 2, xx] = (*iris_dark, 255)
        arr[y0 + h - 2, x0 + w - 2] = (*iris_hi, 255)
    else:
        for xx in range(x0 + 2, x0 + w - 1):
            arr[y0 + 3, xx] = (*iris_dark, 255)
        arr[y0 + 3, x0 + w - 2] = (*iris_hi, 255)
        for xx in range(x0 + 1, x0 + w - 1):
            arr[y0 + 4, xx] = (*iris_dark, 255)


def draw_far_eye(arr: np.ndarray, spec: FarEyeSpec) -> None:
    """Stamp a foreshortened 2xH far eye with white catchlight and iris."""
    x0, y0, h, dark, iris_dark, iris_hi, white, sep_x, skin = spec
    if sep_x is not None and skin is not None:
        for yy in range(y0, y0 + h):
            if 0 <= sep_x < 64 and arr[yy, sep_x, 3] > 0:
                arr[yy, sep_x] = (*skin, 255)
    arr[y0, x0] = (*dark, 255)
    arr[y0, x0 + 1] = (*dark, 255)
    arr[y0 + 1, x0] = (*white, 255)
    arr[y0 + 1, x0 + 1] = (*dark, 255)
    if h >= 4:
        arr[y0 + 2, x0] = (*white, 255)
        arr[y0 + 2, x0 + 1] = (*iris_dark, 255)
        arr[y0 + 3, x0] = (*iris_dark, 255)
        arr[y0 + 3, x0 + 1] = (*iris_hi, 255)
        if h >= 5:
            arr[y0 + 4, x0] = (*dark, 255)
            arr[y0 + 4, x0 + 1] = (*dark, 255)
    else:
        arr[y0 + 2, x0] = (*iris_dark, 255)
        arr[y0 + 2, x0 + 1] = (*iris_hi, 255)


def paint_rows(arr: np.ndarray, x0: int, y0: int, rows: list[str], cmap: dict[str, Rgb]) -> None:
    """Paint a character-mapped pixel patch onto `arr` at `(x0, y0)`."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in cmap:
                arr[y0 + dy, x0 + dx] = (*cmap[ch], 255)


def build_sparkit_front() -> Image.Image:
    """Refine sparkit front sprite with unbroken outline and 3/4 crimson-amber jewel eyes."""
    arr = np.array(load_bw_starter("sparkit", "front"))
    cmap: dict[str, Rgb] = {
        "0": (26, 4, 4), "1": (69, 13, 3), "2": (99, 20, 4), "6": (189, 28, 5),
        "B": (253, 135, 14), "E": (254, 238, 166), "W": (254, 254, 254),
    }
    ensure_dark_outline(arr, cmap["1"])
    paint_rows(arr, 5, 39, ["1B00", "1BW0", "1BW2", "1B16"], cmap)
    paint_rows(arr, 14, 39, [".0000.", "0WW001", "0WW001", "000221", "122661", ".1121E", "B....E"], cmap)
    return Image.fromarray(arr, "RGBA")


def build_aqualing_front() -> Image.Image:
    """Refine aqualing front sprite with unbroken gill outline and 3/4 ocean-blue jewel eyes."""
    arr = np.array(load_bw_starter("aqualing", "front"))
    cmap: dict[str, Rgb] = {
        "0": (2, 33, 93), "1": (24, 60, 128), "3": (40, 104, 189), "6": (73, 151, 232),
        "8": (252, 145, 142), "9": (126, 199, 252), "C": (254, 247, 218), "W": (254, 254, 254),
    }
    ensure_dark_outline(arr, cmap["0"])
    for gx, gy in ((18, 33), (18, 34), (38, 33)):
        arr[gy, gx] = (*cmap["8"], 255)
    paint_rows(arr, 15, 42, ["9000", "90W0", "90W1", "9013", "9001", ".CCC"], cmap)
    paint_rows(arr, 26, 42, ["C0000C", "0WW000", "0WW000", "000110", "011360", "C0000C", "CCCCC."], cmap)
    return Image.fromarray(arr, "RGBA")


def build_leafling_front() -> Image.Image:
    """Refine leafling front sprite with continuous leaf outlines/veins and 3/4 amber-brown eyes."""
    arr = np.array(load_bw_starter("leafling", "front"))
    cmap: dict[str, Rgb] = {
        "0": (52, 26, 10), "1": (21, 69, 20), "2": (88, 46, 16), "4": (151, 83, 33),
        "6": (199, 122, 57), "L": (178, 251, 19), "D": (253, 237, 188), "W": (254, 254, 253),
    }
    ensure_dark_outline(arr, cmap["1"], max_l=0.348)
    arr[27, 11] = (*cmap["L"], 255)
    arr[29, 16] = (*cmap["L"], 255)
    paint_rows(arr, 17, 41, ["1D..", "1D00", "1DW0", "1DW2", "1D24", "1D00"], cmap)
    paint_rows(arr, 23, 42, ["D0000D", "0WW000", "0WW000", "000220", "022460", "D0000D"], cmap)
    return Image.fromarray(arr, "RGBA")


def build_starter_back(sid: str, default_dark: Rgb) -> Image.Image:
    """Refine starter back sprite outline continuity."""
    arr = np.array(load_bw_starter(sid, "back"))
    ensure_dark_outline(arr, default_dark)
    return Image.fromarray(arr, "RGBA")


def main(argv: list[str] | None = None) -> None:
    """Write all 6 starter authored PNGs (`sparkit`, `aqualing`, `leafling` front & back)."""
    _ = argv
    OUT.mkdir(parents=True, exist_ok=True)
    sprites = {
        "sparkit-front": build_sparkit_front(),
        "sparkit-back": build_starter_back("sparkit", (63, 12, 3)),
        "aqualing-front": build_aqualing_front(),
        "aqualing-back": build_starter_back("aqualing", (3, 33, 92)),
        "leafling-front": build_leafling_front(),
        "leafling-back": build_starter_back("leafling", (18, 50, 11)),
    }
    for name, img in sprites.items():
        img.save(OUT / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1:])
