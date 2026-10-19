#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/monsters/upgrade_all_60_eyes.py            # apply every pending `repair` in eyes.json
# python3 scripts/content/monsters/upgrade_all_60_eyes.py --out-dir /tmp/x [--species a,b]   # preview, repo untouched
"""Table-driven monster eye repair (눈 규칙 판본 5, 2026-10-20).

Before this, every round re-stamped all 60 species from hand-typed absolute coordinates on top of an
old sprite (eyes landed in transparent air, old eyes stayed as ghosts). Now
`harness-data/monster-collect-species/eyes.json` is the single source of eye positions and this script
only touches species with a `repair` entry:

1. guard: the authored front PNG must hash to `repair.from` (no silent overwrite of hand edits);
   if it already hashes to `repair.to` the species is skipped (idempotent).
2. erase: `repair.clear` pixels become transparent (eyes once stamped into air), every pixel of the
   old eye boxes `repair.erase` plus old-eye ghost pixels connected to them is re-filled from the
   surrounding non-eye pixels (outline from outline, skin from skin).
3. draw the round BW eye template (`redraw_starters.draw_bw_eye` / `draw_far_eye`) at the table's
   `near`/`second`/`far` boxes with `repair.paint` colours, clipped to the body: never into
   transparent pixels, never turning a silhouette-edge pixel light (no outline gaps).
4. write `authored/<id>-front.png`, record `authoredSha256` and `previousAuthoredSha256` in the ledger.

Then `npm run harness -- monster-collect-species build` re-bakes the bundle and idle strips.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Final, TypedDict

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from redraw_starters import Rgb, draw_bw_eye, draw_far_eye, oklab_l  # noqa: E402

ROOT: Final[Path] = Path(__file__).resolve().parents[3]
DATA_DIR: Final[Path] = ROOT / "harness-data/monster-collect-species"
AUTHORED_DIR: Final[Path] = DATA_DIR / "authored"
TABLE_PATH: Final[Path] = DATA_DIR / "eyes.json"
LEDGER_PATH: Final[Path] = DATA_DIR / "ledger.json"
N4: Final = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8: Final = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))

Box = list[int]


class Paint(TypedDict):
    dark: str
    pupil: str
    irisDark: str
    irisHi: str
    white: str
    skin: str


# "from" is a Python keyword, so the functional TypedDict form is required
Repair = TypedDict("Repair", {"erase": list[Box], "clear": list[list[int]], "paint": Paint, "from": str, "to": str}, total=False)


def hex_rgb(value: str) -> Rgb:
    return (int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16))


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def edge_mask(alpha: np.ndarray) -> np.ndarray:
    """Opaque pixels with a transparent (or off-canvas) 4-neighbour: the silhouette outline row."""
    padded = np.pad(alpha, 1, constant_values=False)
    outside = ~padded[:-2, 1:-1] | ~padded[2:, 1:-1] | ~padded[1:-1, :-2] | ~padded[1:-1, 2:]
    return alpha & outside


def eye_like(rgb: np.ndarray) -> bool:
    """Dark pupil/frame or near-white catchlight — the colours an old eye leaves behind."""
    l = oklab_l((int(rgb[0]), int(rgb[1]), int(rgb[2])))
    spread = int(rgb.max()) - int(rgb.min())
    return l < 0.4 or (l > 0.92 and spread < 24)


def erase_old_eyes(arr: np.ndarray, repair: Repair) -> None:
    """Clear air-stamped pixels, then re-fill old eye boxes and their connected ghost pixels from neighbours."""
    for x, y in repair.get("clear", []):
        arr[y, x] = (0, 0, 0, 0)
    alpha = arr[:, :, 3] > 0
    edge = edge_mask(alpha)
    hole = np.zeros(alpha.shape, dtype=bool)
    for x0, y0, w, h in repair.get("erase", []):
        hole[y0:y0 + h, x0:x0 + w] = True
    hole &= alpha
    # ghosts: eye-coloured interior pixels 4-connected to an old box, at most 2 px outside it
    zone = np.zeros(alpha.shape, dtype=bool)
    for x0, y0, w, h in repair.get("erase", []):
        zone[max(0, y0 - 2):y0 + h + 2, max(0, x0 - 2):x0 + w + 2] = True
    stack = [tuple(p) for p in np.argwhere(hole)]
    while stack:
        y, x = stack.pop()
        for dx, dy in N4:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < 64 and 0 <= ny < 64) or hole[ny, nx] or not zone[ny, nx]:
                continue
            if alpha[ny, nx] and not edge[ny, nx] and eye_like(arr[ny, nx]):
                hole[ny, nx] = True
                stack.append((ny, nx))
    # in-fill: each pass fills hole pixels that touch known pixels of the same kind (edge from edge, interior from interior)
    while hole.any():
        filled: list[tuple[int, int, np.ndarray]] = []
        for y, x in np.argwhere(hole):
            counts: dict[tuple[int, ...], int] = {}
            for dx, dy in N8:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < 64 and 0 <= ny < 64) or hole[ny, nx] or not alpha[ny, nx] or edge[ny, nx] != edge[y, x]:
                    continue
                if not edge[y, x] and eye_like(arr[ny, nx]):
                    continue
                key = tuple(int(v) for v in arr[ny, nx])
                counts[key] = counts.get(key, 0) + 1
            if counts:
                best = min(counts, key=lambda c: (-counts[c], c))
                filled.append((y, x, np.array(best, dtype=np.uint8)))
        if not filled:
            for y, x in np.argwhere(hole):
                hole[y, x] = False  # isolated: leave as is
            break
        for y, x, colour in filled:
            arr[y, x] = colour
            hole[y, x] = False


def draw_eyes(arr: np.ndarray, entry: dict, repair: Repair) -> None:
    """Round BW template at the table boxes, clipped to the body."""
    before = arr.copy()
    alpha = before[:, :, 3] > 0
    edge = edge_mask(alpha)
    p = repair["paint"]
    dark, pupil, iris_dark, iris_hi, white, skin = (hex_rgb(p[k]) for k in ("dark", "pupil", "irisDark", "irisHi", "white", "skin"))
    for key in ("near", "second"):
        box = entry.get(key)
        if box:
            x0, y0, w, h = box
            draw_bw_eye(arr, (x0, y0, w, h, dark, pupil, iris_dark, iris_hi, white, skin))
    far = entry.get("far")
    if far:
        x0, y0, _, h = far
        sep = x0 - 1 if alpha[y0:y0 + h, x0 - 1].all() and not edge[y0:y0 + h, x0 - 1].any() else None
        draw_far_eye(arr, (x0, y0, h, dark, iris_dark, iris_hi, white, sep, skin if sep is not None else None))
    for y, x in np.argwhere(~alpha):
        arr[y, x] = before[y, x]
    for y, x in np.argwhere(edge):
        if oklab_l(tuple(int(v) for v in arr[y, x, :3])) >= 0.4:
            arr[y, x] = before[y, x]


def repair_front(src: Image.Image, entry: dict) -> Image.Image:
    arr = np.array(src.convert("RGBA"))
    erase_old_eyes(arr, entry["repair"])
    draw_eyes(arr, entry, entry["repair"])
    return Image.fromarray(arr, "RGBA")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out-dir", type=Path, help="write <id>/front.png previews here instead of authored/ (no ledger change)")
    ap.add_argument("--species", help="comma-separated subset")
    args = ap.parse_args(argv)
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    only = set(args.species.split(",")) if args.species else None
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    changed = 0
    errors = 0
    for sid, entry in table["species"].items():
        repair = entry.get("repair")
        if not repair or (only and sid not in only):
            continue
        if entry.get("frozen") or entry.get("pending"):
            print(f"{sid}: frozen/pending species must not carry a repair", file=sys.stderr)
            errors += 1
            continue
        src_path = AUTHORED_DIR / f"{sid}-front.png"
        current = file_sha(src_path)
        if args.out_dir is None and current == repair.get("to"):
            print(f"{sid}: already repaired ({current[:12]})")
            continue
        if current != repair["from"]:
            print(f"{sid}: authored front is {current[:12]}, repair expects {repair['from'][:12]} — refusing to overwrite", file=sys.stderr)
            errors += 1
            continue
        out = repair_front(Image.open(src_path), entry)
        if args.out_dir is not None:
            (args.out_dir / sid).mkdir(parents=True, exist_ok=True)
            out.save(args.out_dir / sid / "front.png", optimize=True)
            changed += 1
            continue
        out.save(src_path, optimize=True)
        after = file_sha(src_path)
        pick = ledger["picks"][sid]["front"]
        pick["authored"] = f"authored/{sid}-front.png"
        pick["previousAuthoredSha256"] = current
        pick["authoredSha256"] = after
        repair["to"] = after
        print(f"{sid}: {current[:12]} -> {after[:12]}")
        changed += 1
    if args.out_dir is None and changed:
        LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        TABLE_PATH.write_text(dump_table(table), encoding="utf-8")
    print(f"repaired {changed}, errors {errors}")
    return 1 if errors else 0


def dump_table(table: dict) -> str:
    """One species per line so diffs stay reviewable."""
    rows = ",\n".join(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in table["species"].items())
    return '{\n  "version": 1,\n  "species": {\n' + rows + "\n  }\n}\n"


if __name__ == "__main__":
    raise SystemExit(main())
