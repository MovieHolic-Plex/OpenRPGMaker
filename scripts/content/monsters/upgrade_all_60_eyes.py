#!/usr/bin/env python3
"""Exact surgical eye fixes for the 3 starters and 12 specific non-starter species.

- Starters (`sparkit`, `aqualing`, `leafling`): generated via `redraw_starters.py` with
  3/4 anime eyes (`draw_eye`): 5x6 near eye and foreshortened 3x5 far eye, each with an ink
  upper lash, 2x2 white catchlight, dark pupil core, 2-tone jewel iris and white outer sclera.
- 12 specific non-starter species (`rootpig`, `kilnclaw`, `furnscale`, `curlfin`,
  `brinewyrm`, `solmane`, `coralpin`, `reefguard`, `frondhare`, `brookraft`, `pebblekid`,
  `flurrykit`): surgical pixel-exact lash/pupil/catchlight/iris tuning on the clean `5b8d884cbb`
  baseline sprites without touching any other body part (colors stay <= 20).
- The remaining 45 species use their clean `5b8d884cbb` sprites directly (no blind center
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


def fix_frondhare(arr: np.ndarray) -> None:
    dark = (55, 28, 10)
    iris = (97, 49, 16)
    white = (253, 253, 253)
    # 가까운 눈: 위 속눈썹 한 줄 + 왼쪽 위 1×2 반짝임 하나만(가운데 떠 있던 둘째 점은 홍채로)
    for x in range(27, 31):
        set_px(arr, x, 36, dark)
    set_px(arr, 27, 37, white)
    set_px(arr, 27, 38, white)
    set_px(arr, 29, 39, iris)
    # 먼 눈: 뭉친 점을 2칸 폭 세로 눈(속눈썹·반짝임·홍채)으로
    set_px(arr, 22, 36, dark)
    set_px(arr, 21, 37, white)
    set_px(arr, 22, 37, dark)
    set_px(arr, 21, 38, dark)
    set_px(arr, 21, 39, iris)
    set_px(arr, 22, 39, iris)


def fix_brookraft(arr: np.ndarray) -> None:
    dark = (4, 22, 74)
    white = (254, 254, 254)
    iris = (69, 130, 223)
    iris_dark = (32, 80, 170)
    # 가까운 눈: 가운데 가로 띠였던 반짝임을 왼쪽 위 2×2 로 올리고 아래에 보석 홍채
    set_px(arr, 31, 41, dark)
    set_px(arr, 27, 42, dark)
    set_px(arr, 28, 42, white)
    set_px(arr, 29, 42, white)
    set_px(arr, 28, 43, white)
    set_px(arr, 29, 43, white)
    set_px(arr, 29, 45, iris_dark)
    set_px(arr, 30, 45, iris)
    # 먼 눈: 윤곽에 붙은 눈에 반짝임 한 점
    set_px(arr, 16, 42, white)


def fix_pebblekid(arr: np.ndarray) -> None:
    white = (253, 253, 253)
    iris = (123, 77, 70)
    # 가까운 눈: 반짝임 2×2 로 넓히고 아래 홍채 초승달
    set_px(arr, 26, 40, white)
    set_px(arr, 26, 41, white)
    set_px(arr, 26, 43, iris)
    set_px(arr, 27, 43, iris)


def fix_flurrykit(arr: np.ndarray) -> None:
    dark = (8, 26, 81)
    white = (252, 252, 251)
    iris_dark = (22, 50, 110)
    iris = (80, 163, 220)
    # 가까운 눈: 반짝임 없는 어두운 덩어리 → 위 속눈썹 + 2×2 반짝임 + 보석 홍채 + 바깥 흰자
    set_px(arr, 22, 40, dark)
    set_px(arr, 22, 41, dark)
    set_px(arr, 21, 42, dark)
    set_px(arr, 23, 41, white)
    set_px(arr, 24, 41, white)
    set_px(arr, 23, 42, white)
    set_px(arr, 24, 42, white)
    set_px(arr, 26, 42, white)
    set_px(arr, 24, 43, iris_dark)
    set_px(arr, 25, 43, iris)
    # 먼 눈: 윤곽에 묻힌 눈에 반짝임 한 점
    set_px(arr, 15, 41, white)


SURGICAL_FIXES = {
    "rootpig": fix_rootpig,
    "kilnclaw": fix_kilnclaw,
    "furnscale": fix_furnscale,
    "curlfin": fix_curlfin,
    "brinewyrm": fix_brinewyrm,
    "solmane": fix_solmane,
    "coralpin": fix_coralpin,
    "reefguard": fix_reefguard,
    "frondhare": fix_frondhare,
    "brookraft": fix_brookraft,
    "pebblekid": fix_pebblekid,
    "flurrykit": fix_flurrykit,
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
