#!/usr/bin/env python3
"""Exact surgical eye fixes for the 3 starters and 8 specific non-starter species.

- Starters (`sparkit`, `aqualing`, `leafling`): generated via `redraw_starters.py` with
  balanced 3/4 foreshortened far eyes (`3x4`) and oval near eyes (`4x5`) seated cleanly
  in their orbital sockets.
- 8 specific non-starter species (`rootpig`, `kilnclaw`, `furnscale`, `curlfin`,
  `brinewyrm`, `solmane`, `coralpin`, `reefguard`): surgical pixel-exact pupil/catchlight
  alignment on the clean `5b8d884cbb` baseline sprites without touching any other body part.
- The remaining 49 species use their clean `5b8d884cbb` sprites directly (no blind center
  eye-stamping loop).
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
SEED_PATH = DATA_DIR / "seed.json"
LEDGER_PATH = DATA_DIR / "ledger.json"

# Visually verified head centers (x, y) in 64x64 sprite coordinates for all 60 species
HEAD_CENTERS: dict[str, tuple[int, int]] = {
    "sparkit": (18, 37),
    "aqualing": (19, 38),
    "leafling": (19, 38),
    "gustchick": (20, 40),
    "pipbug": (18, 51),
    "wickworm": (16, 46),
    "rootpig": (25, 42),
    "frondhare": (25, 38),
    "kilnclaw": (15, 31),
    "brookraft": (25, 42),
    "coralpin": (37, 37),
    "curlfin": (15, 36),
    "zaptoe": (17, 39),
    "pebblekid": (23, 40),
    "gritnose": (25, 33),
    "podback": (18, 51),
    "ribbonwing": (18, 31),
    "coilcrest": (15, 27),
    "craghoof": (15, 28),
    "lanternwing": (19, 39),
    "brambleboar": (24, 41),
    "tunnelpaw": (26, 30),
    "reefguard": (36, 36),
    "brinewyrm": (24, 28),
    "grovewarden": (24, 36),
    "furnscale": (18, 30),
    "tidekeeper": (18, 33),
    "orchardant": (21, 47),
    "galecrest": (18, 31),
    "stormskink": (14, 29),
    "ridgehorn": (16, 27),
    "beaconmoth": (21, 36),
    "briartusk": (22, 42),
    "faultdigger": (26, 29),
    "atollclamp": (26, 36),
    "abyssail": (22, 26),
    "sandnip": (21, 42),
    "dunestalk": (23, 42),
    "miragespike": (25, 42),
    "flurrykit": (20, 42),
    "rimepelt": (17, 29),
    "glaciermane": (17, 30),
    "miretail": (16, 40),
    "venomfrill": (19, 36),
    "marshcrown": (19, 29),
    "dozemite": (25, 41),
    "trancescythe": (26, 34),
    "oraclemantis": (21, 29),
    "threadimp": (23, 40),
    "hushdoll": (22, 18),
    "veilmaster": (21, 21),
    "reedpeep": (33, 35),
    "fenstrider": (27, 19),
    "mistralheron": (20, 22),
    "thundercairn": (15, 30),
    "winterquill": (23, 40),
    "solmane": (20, 28),
    "lunavane": (21, 49),
    "relicarab": (17, 35),
    "astralhart": (24, 36),
}


def set_px(arr: np.ndarray, x: int, y: int, rgb: tuple[int, int, int]) -> None:
    if 0 <= x < 64 and 0 <= y < 64 and arr[y, x, 3] > 0:
        arr[y, x, :3] = rgb


def load_clean_5b_front(sid: str) -> Image.Image:
    raw = subprocess.check_output(
        ["git", "show", f"5b8d884cbb:public/assets/harnesses/monster-collect-species/{sid}/front.png"],
        cwd=ROOT,
    )
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def fix_rootpig(arr: np.ndarray) -> None:
    dark = (63, 26, 9)
    iris_dark = (106, 45, 24)
    white = (254, 254, 254)
    set_px(arr, 19, 40, white)
    set_px(arr, 19, 41, white)
    set_px(arr, 20, 40, dark)
    set_px(arr, 20, 41, dark)
    set_px(arr, 31, 44, iris_dark)


def fix_kilnclaw(arr: np.ndarray) -> None:
    dark = (56, 13, 4)
    iris_dark = (93, 1, 27)
    white = (254, 254, 254)
    set_px(arr, 13, 30, dark)
    set_px(arr, 14, 30, white)
    set_px(arr, 14, 31, white)
    set_px(arr, 15, 30, dark)
    set_px(arr, 15, 31, dark)
    set_px(arr, 16, 31, iris_dark)
    set_px(arr, 16, 32, iris_dark)
    set_px(arr, 9, 30, white)


def fix_furnscale(arr: np.ndarray) -> None:
    dark = (63, 13, 3)
    iris_dark = (73, 58, 49)
    set_px(arr, 13, 29, dark)
    set_px(arr, 19, 31, iris_dark)


def fix_curlfin(arr: np.ndarray) -> None:
    dark = (3, 68, 93)
    cyan = (64, 193, 194)
    light_cyan = (117, 213, 211)
    white = (254, 254, 254)
    set_px(arr, 8, 35, dark)
    set_px(arr, 8, 36, dark)
    set_px(arr, 9, 35, light_cyan)
    set_px(arr, 9, 36, cyan)
    for y in range(35, 38):
        set_px(arr, 10, y, dark)
        set_px(arr, 11, y, dark)
    set_px(arr, 10, 35, white)
    set_px(arr, 17, 37, dark)


def fix_brinewyrm(arr: np.ndarray) -> None:
    dark = (4, 62, 87)
    white = (254, 254, 254)
    set_px(arr, 19, 28, dark)
    set_px(arr, 24, 29, white)


def fix_solmane(arr: np.ndarray) -> None:
    dark = (34, 31, 34)
    iris_dark = (75, 32, 7)
    white = (254, 254, 254)
    set_px(arr, 15, 28, dark)
    set_px(arr, 20, 28, white)
    set_px(arr, 20, 29, white)
    set_px(arr, 22, 29, iris_dark)
    set_px(arr, 22, 30, dark)


def fix_coralpin(arr: np.ndarray) -> None:
    dark = (34, 8, 4)
    set_px(arr, 40, 40, dark)
    set_px(arr, 41, 38, dark)


def fix_reefguard(arr: np.ndarray) -> None:
    dark = (38, 10, 3)
    set_px(arr, 32, 35, dark)
    set_px(arr, 40, 40, dark)
    set_px(arr, 41, 38, dark)


SURGICAL_FIXES = {
    "rootpig": fix_rootpig,
    "kilnclaw": fix_kilnclaw,
    "furnscale": fix_furnscale,
    "curlfin": fix_curlfin,
    "brinewyrm": fix_brinewyrm,
    "solmane": fix_solmane,
    "coralpin": fix_coralpin,
    "reefguard": fix_reefguard,
}


def main() -> None:
    redraw_starters.main([])

    raw_ledger = subprocess.check_output(
        ["git", "show", "5b8d884cbb:harness-data/monster-collect-species/ledger.json"],
        cwd=ROOT,
    ).decode("utf-8")
    ledger = json.loads(raw_ledger)

    AUTHORED_DIR.mkdir(parents=True, exist_ok=True)
    for sid, fn in SURGICAL_FIXES.items():
        im = load_clean_5b_front(sid)
        arr = np.array(im)
        fn(arr)
        out_im = Image.fromarray(arr, "RGBA")
        flat_path = AUTHORED_DIR / f"{sid}-front.png"
        out_im.save(flat_path, optimize=True)
        if sid in ledger["picks"] and "front" in ledger["picks"][sid]:
            ledger["picks"][sid]["front"]["authored"] = f"authored/{sid}-front.png"

    LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated 3 starters + {len(SURGICAL_FIXES)} surgical non-starter species in {AUTHORED_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
