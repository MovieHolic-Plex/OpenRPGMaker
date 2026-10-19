#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# uv run scripts/content/monsters/upgrade_all_60_eyes.py
# python3 scripts/content/monsters/upgrade_all_60_eyes.py
"""Upgrade all 60 monster species to the #6/#7/#8/#10 Pokemon Black & White pixel-art standard."""
from __future__ import annotations

import io
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import redraw_starters  # noqa: E402
from redraw_starters import (  # noqa: E402
    FarEyeSpec,
    NearEyeSpec,
    Rgb,
    draw_bw_eye,
    draw_far_eye,
    ensure_dark_outline,
)

ROOT: Final[Path] = Path(__file__).resolve().parents[3]
DATA_DIR: Final[Path] = ROOT / "harness-data/monster-collect-species"
AUTHORED_DIR: Final[Path] = DATA_DIR / "authored"
SEED_PATH: Final[Path] = DATA_DIR / "seed.json"
LEDGER_PATH: Final[Path] = DATA_DIR / "ledger.json"

HEAD_CENTERS: Final[dict[str, tuple[int, int]]] = {
    "sparkit": (14, 42), "aqualing": (24, 44), "leafling": (24, 44), "gustchick": (20, 40),
    "pipbug": (18, 51), "wickworm": (16, 46), "rootpig": (25, 42), "frondhare": (25, 38),
    "kilnclaw": (15, 31), "brookraft": (25, 42), "coralpin": (37, 37), "curlfin": (15, 36),
    "zaptoe": (17, 39), "pebblekid": (23, 40), "gritnose": (25, 33), "podback": (18, 51),
    "ribbonwing": (18, 31), "coilcrest": (15, 27), "craghoof": (15, 28), "lanternwing": (19, 39),
    "brambleboar": (24, 41), "tunnelpaw": (26, 30), "reefguard": (36, 36), "brinewyrm": (24, 28),
    "grovewarden": (24, 36), "furnscale": (18, 30), "tidekeeper": (18, 33), "orchardant": (21, 47),
    "galecrest": (18, 31), "stormskink": (14, 29), "ridgehorn": (16, 27), "beaconmoth": (21, 36),
    "briartusk": (22, 42), "faultdigger": (26, 29), "atollclamp": (26, 36), "abyssail": (22, 26),
    "sandnip": (21, 42), "dunestalk": (23, 42), "miragespike": (25, 42), "flurrykit": (20, 42),
    "rimepelt": (17, 29), "glaciermane": (17, 30), "miretail": (16, 40), "venomfrill": (19, 36),
    "marshcrown": (19, 29), "dozemite": (25, 41), "trancescythe": (26, 34), "oraclemantis": (21, 29),
    "threadimp": (23, 40), "hushdoll": (22, 18), "veilmaster": (21, 21), "reedpeep": (33, 35),
    "fenstrider": (27, 19), "mistralheron": (20, 22), "thundercairn": (15, 30), "winterquill": (23, 40),
    "solmane": (20, 28), "lunavane": (21, 49), "relicarab": (17, 35), "astralhart": (24, 36),
}


@dataclass(frozen=True, slots=True)
class SpeciesUpgradeSpec:
    """Typed specification for a species front/back eye and outline upgrade."""

    near: NearEyeSpec | None = None
    near2: NearEyeSpec | None = None
    far: FarEyeSpec | None = None
    outline: Rgb | None = None
    replace_color: tuple[Rgb, Rgb] | None = None
    back_outline: Rgb | None = None
    back_replace_color: tuple[Rgb, Rgb] | None = None


def load_clean_5b(sid: str, side: str) -> Image.Image:
    """Load clean 5b8d884cbb baseline sprite for a species and side."""
    raw = subprocess.check_output(
        ["git", "show", f"5b8d884cbb:public/assets/harnesses/monster-collect-species/{sid}/{side}.png"],
        cwd=ROOT,
    )
    return Image.open(io.BytesIO(raw)).convert("RGBA")


SPECIES_SPECS: Final[dict[str, SpeciesUpgradeSpec]] = {
    "gustchick": SpeciesUpgradeSpec(near=(21, 38, 5, 6, (3, 32, 81), (57, 27, 37), (50, 58, 81), (70, 139, 226), (254, 254, 254), (252, 243, 211)), far=(14, 39, 4, (3, 32, 81), (50, 58, 81), (70, 139, 226), (254, 254, 254), 13, (252, 243, 211))),
    "pipbug": SpeciesUpgradeSpec(outline=(22, 69, 10), near=(18, 50, 5, 6, (14, 33, 9), (63, 32, 13), (93, 52, 24), (127, 70, 32), (250, 249, 248), (251, 232, 175)), far=(13, 50, 4, (14, 33, 9), (93, 52, 24), (127, 70, 32), (250, 249, 248), 12, (251, 232, 175))),
    "wickworm": SpeciesUpgradeSpec(near=(23, 45, 5, 6, (50, 10, 10), (64, 27, 3), (93, 34, 10), (159, 80, 16), (244, 243, 243), (253, 224, 44)), far=(15, 44, 5, (50, 10, 10), (93, 34, 10), (159, 80, 16), (244, 243, 243), None, None)),
    "rootpig": SpeciesUpgradeSpec(near=(28, 40, 5, 6, (16, 34, 3), (63, 26, 9), (106, 45, 24), (151, 79, 38), (254, 254, 254), (252, 224, 182)), far=(19, 40, 4, (63, 26, 9), (106, 45, 24), (151, 79, 38), (254, 254, 254), 18, (252, 224, 182))),
    "frondhare": SpeciesUpgradeSpec(outline=(15, 69, 15), back_outline=(10, 51, 10), near=(27, 36, 4, 5, (55, 28, 10), (55, 28, 10), (97, 49, 16), (154, 85, 33), (253, 253, 253), (253, 241, 183)), far=(21, 36, 4, (55, 28, 10), (97, 49, 16), (154, 85, 33), (253, 253, 253), 20, (253, 241, 183))),
    "kilnclaw": SpeciesUpgradeSpec(near=(13, 29, 5, 5, (31, 1, 0), (56, 13, 4), (93, 1, 27), (190, 31, 7), (254, 254, 254), None), far=(9, 29, 4, (31, 1, 0), (93, 1, 27), (190, 31, 7), (254, 254, 254), None, None)),
    "brookraft": SpeciesUpgradeSpec(near=(27, 41, 5, 6, (4, 22, 74), (4, 22, 74), (22, 55, 125), (69, 130, 223), (254, 254, 254), (254, 244, 213)), far=(16, 40, 4, (4, 22, 74), (22, 55, 125), (69, 130, 223), (254, 254, 254), None, None)),
    "coralpin": SpeciesUpgradeSpec(outline=(34, 8, 4), back_outline=(68, 12, 24), near=(39, 35, 5, 5, (34, 8, 4), (34, 8, 4), (34, 8, 4), (3, 115, 118), (254, 254, 254), (254, 243, 212)), near2=(30, 34, 5, 5, (34, 8, 4), (34, 8, 4), (34, 8, 4), (3, 115, 118), (254, 254, 254), (254, 243, 212))),
    "curlfin": SpeciesUpgradeSpec(replace_color=((3, 68, 93), (3, 52, 78)), outline=(3, 52, 78), back_replace_color=((5, 67, 87), (4, 50, 68)), back_outline=(4, 50, 68), near=(15, 34, 5, 6, (25, 40, 122), (3, 52, 78), (25, 40, 122), (33, 146, 159), (254, 254, 254), (64, 193, 194)), far=(9, 34, 4, (25, 40, 122), (3, 52, 78), (33, 146, 159), (254, 254, 254), 8, (117, 213, 211))),
    "zaptoe": SpeciesUpgradeSpec(near=(16, 38, 5, 6, (62, 22, 8), (64, 46, 37), (98, 44, 16), (182, 81, 23), (254, 254, 254), (253, 208, 48)), far=(10, 39, 4, (62, 22, 8), (98, 44, 16), (182, 81, 23), (254, 254, 254), 9, (253, 208, 48))),
    "pebblekid": SpeciesUpgradeSpec(near=(25, 39, 5, 6, (33, 26, 25), (58, 34, 33), (81, 40, 51), (123, 77, 70), (253, 253, 253), (250, 236, 206)), far=(18, 40, 4, (33, 26, 25), (81, 40, 51), (123, 77, 70), (253, 253, 253), 17, (250, 236, 206))),
    "gritnose": SpeciesUpgradeSpec(near=(28, 32, 5, 6, (16, 4, 0), (48, 13, 2), (80, 56, 38), (122, 46, 44), (249, 248, 248), (251, 231, 190)), far=(21, 30, 4, (16, 4, 0), (80, 56, 38), (122, 46, 44), (249, 248, 248), 20, (251, 231, 190))),
    "podback": SpeciesUpgradeSpec(outline=(19, 45, 8), back_outline=(39, 49, 3), near=(19, 50, 5, 6, (27, 9, 1), (55, 26, 8), (104, 51, 22), (152, 82, 36), (249, 248, 248), (250, 229, 160)), far=(13, 50, 4, (27, 9, 1), (104, 51, 22), (152, 82, 36), (249, 248, 248), 12, (250, 229, 160))),
    "ribbonwing": SpeciesUpgradeSpec(near=(16, 30, 5, 5, (3, 31, 80), (58, 28, 34), (56, 62, 86), (51, 104, 199), (254, 254, 254), (252, 241, 206)), far=(13, 31, 3, (3, 31, 80), (56, 62, 86), (51, 104, 199), (254, 254, 254), 12, (252, 241, 206))),
    "coilcrest": SpeciesUpgradeSpec(near=(13, 26, 5, 6, (28, 2, 0), (69, 19, 3), (109, 46, 13), (188, 80, 20), (254, 254, 254), (253, 206, 43)), far=(8, 27, 4, (28, 2, 0), (109, 46, 13), (188, 80, 20), (254, 254, 254), 7, (253, 206, 43))),
    "craghoof": SpeciesUpgradeSpec(near=(14, 27, 5, 5, (44, 1, 32), (56, 27, 28), (49, 62, 87), (128, 69, 64), (254, 254, 254), (251, 236, 201)), far=(10, 28, 3, (44, 1, 32), (49, 62, 87), (128, 69, 64), (254, 254, 254), None, None)),
    "lanternwing": SpeciesUpgradeSpec(near=(23, 38, 5, 6, (27, 0, 0), (56, 9, 8), (116, 44, 10), (182, 97, 21), (254, 254, 254), (253, 229, 86)), near2=(17, 37, 4, 5, (27, 0, 0), (56, 9, 8), (116, 44, 10), (182, 97, 21), (254, 254, 254), (253, 246, 195))),
    "brambleboar": SpeciesUpgradeSpec(near=(26, 39, 5, 6, (21, 44, 11), (62, 25, 8), (95, 42, 18), (152, 76, 34), (250, 248, 247), (252, 222, 178)), far=(18, 39, 4, (62, 25, 8), (95, 42, 18), (152, 76, 34), (250, 248, 247), 17, (252, 222, 178))),
    "tunnelpaw": SpeciesUpgradeSpec(near=(29, 29, 5, 6, (8, 1, 0), (50, 31, 17), (81, 57, 39), (110, 83, 63), (253, 253, 253), (252, 236, 199)), far=(22, 27, 4, (8, 1, 0), (81, 57, 39), (110, 83, 63), (253, 253, 253), 21, (252, 236, 199))),
    "reefguard": SpeciesUpgradeSpec(outline=(38, 10, 3), back_replace_color=((34, 67, 62), (24, 48, 44)), back_outline=(24, 48, 44), near=(39, 35, 5, 5, (38, 10, 3), (38, 10, 3), (85, 18, 35), (4, 118, 121), (254, 254, 254), (254, 242, 207)), near2=(30, 33, 5, 5, (38, 10, 3), (38, 10, 3), (85, 18, 35), (4, 118, 121), (254, 254, 254), (254, 242, 207))),
    "brinewyrm": SpeciesUpgradeSpec(outline=(4, 52, 76), back_replace_color=((8, 69, 93), (4, 50, 72)), back_outline=(4, 50, 72), near=(23, 26, 5, 6, (2, 34, 56), (4, 52, 76), (6, 78, 98), (29, 154, 169), (254, 254, 254), (219, 243, 188))),
    "grovewarden": SpeciesUpgradeSpec(outline=(10, 38, 14), back_outline=(21, 55, 26), near=(24, 34, 5, 5, (27, 22, 52), (69, 31, 9), (92, 44, 14), (154, 81, 28), (255, 255, 255), (253, 239, 176)), far=(18, 34, 4, (69, 31, 9), (92, 44, 14), (154, 81, 28), (255, 255, 255), 17, (253, 239, 176))),
    "furnscale": SpeciesUpgradeSpec(near=(16, 28, 5, 5, (40, 0, 0), (63, 13, 3), (73, 58, 49), (199, 34, 5), (254, 254, 254), (253, 230, 148)), far=(11, 28, 4, (40, 0, 0), (73, 58, 49), (199, 34, 5), (254, 254, 254), 10, (250, 130, 10))),
    "tidekeeper": SpeciesUpgradeSpec(near=(16, 32, 5, 5, (0, 1, 56), (8, 26, 87), (15, 50, 134), (69, 134, 224), (254, 254, 254), (253, 241, 208)), far=(11, 32, 4, (0, 1, 56), (15, 50, 134), (69, 134, 224), (254, 254, 254), 10, (253, 241, 208))),
    "orchardant": SpeciesUpgradeSpec(near=(20, 46, 5, 5, (25, 57, 10), (69, 27, 7), (95, 45, 16), (189, 35, 14), (249, 248, 248), (251, 224, 158)), far=(15, 46, 4, (69, 27, 7), (95, 45, 16), (189, 35, 14), (249, 248, 248), 14, (251, 224, 158))),
    "galecrest": SpeciesUpgradeSpec(near=(16, 30, 5, 5, (3, 32, 93), (64, 31, 27), (63, 26, 139), (63, 141, 235), (254, 254, 254), (253, 244, 206)), far=(12, 31, 3, (3, 32, 93), (63, 26, 139), (63, 141, 235), (254, 254, 254), 11, (253, 244, 206))),
    "stormskink": SpeciesUpgradeSpec(near=(11, 27, 5, 5, (37, 1, 9), (68, 10, 2), (98, 34, 8), (183, 73, 24), (254, 254, 254), (253, 207, 36))),
    "ridgehorn": SpeciesUpgradeSpec(near=(14, 26, 5, 5, (20, 20, 21), (63, 16, 33), (81, 37, 44), (100, 64, 62), (254, 254, 254), (253, 239, 202)), far=(9, 26, 3, (20, 20, 21), (81, 37, 44), (100, 64, 62), (254, 254, 254), 8, (253, 239, 202))),
    "beaconmoth": SpeciesUpgradeSpec(near=(19, 34, 5, 5, (37, 0, 1), (56, 8, 5), (99, 38, 7), (184, 95, 20), (249, 248, 249), (252, 228, 82)), far=(15, 33, 4, (37, 0, 1), (99, 38, 7), (184, 95, 20), (249, 248, 249), 14, (253, 244, 189))),
    "briartusk": SpeciesUpgradeSpec(near=(22, 40, 5, 5, (34, 34, 1), (76, 32, 11), (39, 62, 13), (151, 70, 29), (250, 249, 249), (252, 219, 175)), far=(15, 40, 4, (76, 32, 11), (39, 62, 13), (151, 70, 29), (250, 249, 249), 14, (252, 219, 175))),
    "faultdigger": SpeciesUpgradeSpec(near=(29, 28, 5, 5, (14, 3, 1), (56, 34, 19), (86, 58, 39), (116, 85, 62), (250, 249, 249), (252, 234, 193)), far=(21, 26, 4, (14, 3, 1), (86, 58, 39), (116, 85, 62), (250, 249, 249), 20, (252, 234, 193))),
    "atollclamp": SpeciesUpgradeSpec(outline=(39, 11, 1), back_outline=(68, 16, 28), near=(27, 35, 5, 5, (39, 11, 1), (39, 11, 1), (87, 33, 61), (3, 141, 147), (249, 248, 242), (253, 226, 166)), near2=(20, 33, 5, 5, (39, 11, 1), (39, 11, 1), (87, 33, 61), (3, 141, 147), (249, 248, 242), (253, 226, 166))),
    "abyssail": SpeciesUpgradeSpec(near=(21, 24, 5, 5, (4, 50, 69), (4, 50, 69), (8, 75, 93), (28, 130, 145), (245, 247, 247), (202, 238, 181))),
    "sandnip": SpeciesUpgradeSpec(near=(23, 40, 5, 6, (52, 19, 0), (80, 26, 14), (110, 38, 22), (184, 75, 37), (254, 253, 253), (253, 229, 186)), far=(14, 40, 5, (52, 19, 0), (110, 38, 22), (184, 75, 37), (254, 253, 253), 13, (253, 229, 186))),
    "dunestalk": SpeciesUpgradeSpec(near=(22, 40, 5, 5, (80, 19, 7), (80, 19, 7), (116, 33, 19), (200, 88, 40), (254, 253, 252), (253, 228, 184)), far=(17, 40, 4, (80, 19, 7), (116, 33, 19), (200, 88, 40), (254, 253, 252), 16, (253, 228, 184))),
    "miragespike": SpeciesUpgradeSpec(near=(24, 40, 5, 5, (52, 15, 4), (91, 21, 6), (112, 30, 12), (194, 44, 73), (254, 253, 253), (253, 207, 121)), far=(19, 40, 4, (52, 15, 4), (112, 30, 12), (194, 44, 73), (254, 253, 253), 18, (253, 207, 121))),
    "flurrykit": SpeciesUpgradeSpec(near=(22, 40, 5, 5, (0, 0, 56), (8, 26, 81), (22, 50, 110), (80, 163, 220), (252, 252, 251), (215, 233, 251)), far=(15, 40, 4, (8, 26, 81), (22, 50, 110), (80, 163, 220), (252, 252, 251), 14, (252, 252, 251))),
    "rimepelt": SpeciesUpgradeSpec(near=(15, 28, 5, 5, (0, 2, 62), (9, 26, 86), (22, 43, 109), (93, 171, 229), (253, 253, 252), (213, 232, 251)), far=(10, 28, 3, (9, 26, 86), (22, 43, 109), (93, 171, 229), (253, 253, 252), 9, (253, 253, 252))),
    "glaciermane": SpeciesUpgradeSpec(near=(16, 28, 5, 5, (10, 26, 87), (10, 26, 87), (39, 49, 122), (97, 125, 183), (253, 253, 252), (213, 230, 250)), far=(11, 28, 3, (10, 26, 87), (39, 49, 122), (97, 125, 183), (253, 253, 252), 10, (253, 253, 252))),
    "miretail": SpeciesUpgradeSpec(near=(15, 39, 5, 6, (2, 2, 1), (19, 14, 21), (63, 52, 116), (147, 110, 183), (253, 253, 253), (230, 196, 240)), far=(8, 39, 4, (19, 14, 21), (63, 52, 116), (147, 110, 183), (253, 253, 253), 7, (230, 196, 240))),
    "venomfrill": SpeciesUpgradeSpec(near=(18, 34, 5, 5, (2, 1, 1), (20, 15, 20), (61, 49, 112), (146, 98, 182), (254, 254, 254), (229, 195, 234)), far=(12, 33, 4, (20, 15, 20), (61, 49, 112), (146, 98, 182), (254, 254, 254), None, None)),
    "marshcrown": SpeciesUpgradeSpec(near=(18, 28, 5, 5, (2, 1, 1), (19, 14, 69), (67, 41, 105), (110, 99, 158), (254, 254, 254), (229, 194, 229)), far=(12, 28, 4, (19, 14, 69), (67, 41, 105), (110, 99, 158), (254, 254, 254), None, None)),
    "dozemite": SpeciesUpgradeSpec(near=(26, 40, 5, 6, (24, 18, 82), (63, 4, 105), (38, 42, 118), (168, 243, 172), (254, 254, 254), (232, 179, 248)), far=(19, 39, 4, (24, 18, 82), (38, 42, 118), (168, 243, 172), (254, 254, 254), 18, (232, 179, 248))),
    "trancescythe": SpeciesUpgradeSpec(near=(27, 33, 5, 5, (24, 18, 82), (68, 7, 110), (38, 42, 118), (173, 243, 173), (255, 255, 248), (231, 178, 240)), far=(22, 31, 4, (24, 18, 82), (38, 42, 118), (173, 243, 173), (255, 255, 248), 21, (231, 178, 240))),
    "oraclemantis": SpeciesUpgradeSpec(near=(22, 27, 5, 5, (24, 18, 82), (69, 10, 111), (38, 42, 118), (124, 215, 140), (254, 254, 254), (243, 226, 224)), far=(17, 27, 4, (24, 18, 82), (38, 42, 118), (124, 215, 140), (254, 254, 254), 16, (243, 226, 224))),
    "threadimp": SpeciesUpgradeSpec(near=(24, 39, 5, 5, (21, 13, 13), (21, 31, 63), (44, 57, 93), (105, 121, 166), (254, 254, 254), (250, 230, 190)), far=(18, 39, 4, (21, 13, 13), (44, 57, 93), (105, 121, 166), (254, 254, 254), 17, (250, 230, 190))),
    "hushdoll": SpeciesUpgradeSpec(near=(21, 17, 5, 5, (13, 8, 9), (21, 27, 50), (38, 52, 86), (100, 118, 159), (253, 253, 253), (252, 232, 189)), far=(17, 18, 3, (13, 8, 9), (38, 52, 86), (100, 118, 159), (253, 253, 253), 16, (252, 232, 189))),
    "veilmaster": SpeciesUpgradeSpec(near=(20, 20, 5, 5, (3, 1, 56), (20, 28, 50), (43, 57, 92), (99, 118, 158), (255, 255, 255), (253, 232, 184)), far=(16, 21, 3, (3, 1, 56), (43, 57, 92), (99, 118, 158), (255, 255, 255), 15, (253, 232, 184))),
    "reedpeep": SpeciesUpgradeSpec(near=(33, 33, 5, 6, (2, 38, 86), (2, 38, 86), (12, 68, 92), (50, 154, 141), (254, 254, 253), (247, 244, 199)), far=(27, 33, 4, (2, 38, 86), (12, 68, 92), (50, 154, 141), (254, 254, 253), 26, (247, 244, 199))),
    "fenstrider": SpeciesUpgradeSpec(near=(28, 18, 5, 5, (3, 45, 93), (38, 20, 134), (12, 68, 92), (62, 160, 141), (254, 254, 254), (248, 242, 190))),
    "mistralheron": SpeciesUpgradeSpec(near=(15, 22, 5, 5, (4, 28, 72), (8, 45, 99), (12, 68, 92), (55, 148, 133), (254, 254, 254), (246, 252, 217))),
    "thundercairn": SpeciesUpgradeSpec(near=(13, 29, 5, 5, (0, 0, 0), (1, 9, 87), (2, 40, 135), (10, 106, 213), (254, 254, 254), (253, 246, 206)), far=(9, 30, 3, (0, 0, 0), (2, 40, 135), (10, 106, 213), (254, 254, 254), 8, (253, 246, 206))),
    "winterquill": SpeciesUpgradeSpec(near=(23, 39, 5, 6, (13, 11, 93), (22, 22, 129), (42, 38, 148), (140, 116, 226), (254, 254, 254), (254, 254, 254)), near2=(15, 38, 4, 5, (13, 11, 93), (22, 22, 129), (42, 38, 148), (140, 116, 226), (254, 254, 254), (254, 254, 254))),
    "solmane": SpeciesUpgradeSpec(near=(19, 27, 5, 5, (51, 10, 0), (34, 31, 34), (75, 32, 7), (178, 80, 41), (254, 254, 254), (253, 234, 184)), far=(14, 27, 4, (51, 10, 0), (75, 32, 7), (178, 80, 41), (254, 254, 254), 13, (253, 212, 36))),
    "lunavane": SpeciesUpgradeSpec(near=(20, 49, 5, 5, (26, 8, 105), (26, 8, 105), (45, 35, 145), (116, 116, 249), (254, 254, 254), (254, 248, 212)), near2=(27, 49, 5, 5, (26, 8, 105), (26, 8, 105), (45, 35, 145), (116, 116, 249), (254, 254, 254), (254, 248, 212))),
    "relicarab": SpeciesUpgradeSpec(near=(15, 34, 5, 5, (9, 0, 0), (32, 8, 14), (86, 39, 13), (33, 116, 104), (253, 253, 253), (254, 241, 177)), far=(9, 34, 4, (9, 0, 0), (86, 39, 13), (33, 116, 104), (253, 253, 253), 8, (254, 241, 177))),
    "astralhart": SpeciesUpgradeSpec(near=(23, 35, 5, 5, (4, 26, 19), (44, 22, 8), (9, 72, 37), (68, 147, 69), (254, 254, 254), (254, 243, 213)), far=(18, 35, 4, (44, 22, 8), (9, 72, 37), (68, 147, 69), (254, 254, 254), 17, (254, 243, 213))),
}


def build_non_starter_front(sid: str) -> Image.Image:
    """Apply surgical 3/4 BW eye and outline fixes to a non-starter front sprite."""
    arr = np.array(load_clean_5b(sid, "front"))
    spec = SPECIES_SPECS[sid]
    if spec.replace_color is not None:
        old_c, new_c = spec.replace_color
        mask = (arr[:, :, 3] > 0) & (arr[:, :, 0] == old_c[0]) & (arr[:, :, 1] == old_c[1]) & (arr[:, :, 2] == old_c[2])
        arr[mask, :3] = new_c
    if spec.outline is not None:
        ensure_dark_outline(arr, spec.outline)
    if sid == "coralpin":
        c0: Rgb = (34, 8, 4)
        c_cream: Rgb = (254, 243, 212)
        for yy in range(33, 41):
            for xx in range(29, 36):
                if arr[yy, xx, 3] == 0:
                    arr[yy, xx] = (*c0, 255)
        for yy in range(34, 42):
            for xx in range(38, 45):
                if arr[yy, xx, 3] == 0:
                    arr[yy, xx] = (*c0, 255)
        for yy in range(34, 40):
            for xx in range(30, 35):
                arr[yy, xx] = (*c_cream, 255)
        for yy in range(35, 41):
            for xx in range(39, 44):
                arr[yy, xx] = (*c_cream, 255)
    if spec.near is not None:
        draw_bw_eye(arr, spec.near)
    if spec.near2 is not None:
        draw_bw_eye(arr, spec.near2)
    if spec.far is not None:
        draw_far_eye(arr, spec.far)
    return Image.fromarray(arr, "RGBA")


def build_non_starter_back(sid: str) -> Image.Image | None:
    """Apply outline continuity fix to a non-starter back sprite when needed."""
    spec = SPECIES_SPECS[sid]
    if spec.back_outline is None and spec.back_replace_color is None:
        return None
    arr = np.array(load_clean_5b(sid, "back"))
    if spec.back_replace_color is not None:
        old_c, new_c = spec.back_replace_color
        mask = (arr[:, :, 3] > 0) & (arr[:, :, 0] == old_c[0]) & (arr[:, :, 1] == old_c[1]) & (arr[:, :, 2] == old_c[2])
        arr[mask, :3] = new_c
    if spec.back_outline is not None:
        ensure_dark_outline(arr, spec.back_outline)
    return Image.fromarray(arr, "RGBA")


def main() -> None:
    """Generate authored sprites for all 60 species and update ledger.json."""
    redraw_starters.main([])
    raw_ledger = subprocess.check_output(
        ["git", "show", "5b8d884cbb:harness-data/monster-collect-species/ledger.json"],
        cwd=ROOT,
    ).decode("utf-8")
    ledger = json.loads(raw_ledger)
    AUTHORED_DIR.mkdir(parents=True, exist_ok=True)
    for sid in ("sparkit", "aqualing", "leafling"):
        ledger["picks"][sid]["front"]["authored"] = f"authored/{sid}-front.png"
        ledger["picks"][sid]["back"]["authored"] = f"authored/{sid}-back.png"
    for sid in SPECIES_SPECS:
        front_im = build_non_starter_front(sid)
        front_im.save(AUTHORED_DIR / f"{sid}-front.png", optimize=True)
        ledger["picks"][sid]["front"]["authored"] = f"authored/{sid}-front.png"
        back_im = build_non_starter_back(sid)
        if back_im is not None:
            back_im.save(AUTHORED_DIR / f"{sid}-back.png", optimize=True)
            ledger["picks"][sid]["back"]["authored"] = f"authored/{sid}-back.png"
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Upgraded all 60 species in {AUTHORED_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
