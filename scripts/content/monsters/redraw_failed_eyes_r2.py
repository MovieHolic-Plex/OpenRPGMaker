#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/monsters/redraw_failed_eyes_r2.py                     # apply every patch in eye-patches-r2.json
# python3 scripts/content/monsters/redraw_failed_eyes_r2.py --out-dir /tmp/x [--species a,b]   # preview only
"""Hand-pixel eye redraw, round 2 (2026-10-20, 사용자 눈 판정 1 에서 불합격 32종).

`upgrade_all_60_eyes.py` stamped one template at table boxes; the user failed 32 of those faces.
This round is hand pixel art: `harness-data/monster-collect-species/eye-patches-r2.json` holds, per
species, a literal block of pixel rows over the face (`origin` [x, y], `rows` of palette characters,
`.` = keep the pixel underneath, `_` = make transparent) and the new eye boxes for `eyes.json`.

1. guard: the authored front PNG must hash to `from` (no silent overwrite), or to `to` (skip).
2. paint the rows, write `authored/<id>-front.png`.
3. record `patch: {from, to, source}` + `near`/`far`/`anatomy`/`style` in `eyes.json` (the older
   `repair` entry is dropped — `patch` supersedes it), ledger `authoredSha256`/`previousAuthoredSha256`.
   A species that was frozen (`frozen`) loses the lock: the user's FAIL verdict overrides it.

Then: `npm run harness -- monster-collect-species build`, and for each changed species
`field_chip.py derive → pick → bake`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Final

from PIL import Image

ROOT: Final[Path] = Path(__file__).resolve().parents[3]
DATA_DIR: Final[Path] = ROOT / "harness-data/monster-collect-species"
AUTHORED_DIR: Final[Path] = DATA_DIR / "authored"
TABLE_PATH: Final[Path] = DATA_DIR / "eyes.json"
LEDGER_PATH: Final[Path] = DATA_DIR / "ledger.json"
PATCH_PATH: Final[Path] = DATA_DIR / "eye-patches-r2.json"
SOURCE: Final[str] = "eye-patches-r2.json"


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hex_rgba(value: str) -> tuple[int, int, int, int]:
    return (int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16), 255)


def paint(src: Image.Image, patch: dict) -> Image.Image:
    im = src.convert("RGBA").copy()
    px = im.load()
    pal = {k: hex_rgba(v) for k, v in patch["pal"].items()}
    ox, oy = patch["origin"]
    for dy, row in enumerate(patch["rows"]):
        for dx, ch in enumerate(row):
            if ch == ".":
                continue
            x, y = ox + dx, oy + dy
            if not (0 <= x < 64 and 0 <= y < 64):
                raise ValueError(f"pixel ({x},{y}) off canvas")
            px[x, y] = (0, 0, 0, 0) if ch == "_" else pal[ch]
    return im


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out-dir", type=Path, help="write <id>-front.png previews here (repo untouched)")
    ap.add_argument("--species", help="comma-separated subset")
    args = ap.parse_args(argv)
    patches = json.loads(PATCH_PATH.read_text(encoding="utf-8"))["species"]
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    only = set(args.species.split(",")) if args.species else None
    changed = errors = 0
    for sid, patch in patches.items():
        if only and sid not in only:
            continue
        src_path = AUTHORED_DIR / f"{sid}-front.png"
        current = file_sha(src_path)
        if args.out_dir is None and current == patch.get("to"):
            print(f"{sid}: already applied ({current[:12]})")
            continue
        if current != patch["from"]:
            print(f"{sid}: authored front is {current[:12]}, patch expects {patch['from'][:12]} — refusing", file=sys.stderr)
            errors += 1
            continue
        out = paint(Image.open(src_path), patch)
        if args.out_dir is not None:
            args.out_dir.mkdir(parents=True, exist_ok=True)
            out.save(args.out_dir / f"{sid}-front.png", optimize=True)
            changed += 1
            continue
        out.save(src_path, optimize=True)
        after = file_sha(src_path)
        pick = ledger["picks"][sid]["front"]
        pick["authored"] = f"authored/{sid}-front.png"
        pick["previousAuthoredSha256"] = current
        pick["authoredSha256"] = after
        entry = table["species"][sid]
        entry.pop("repair", None)
        entry.pop("frozen", None)
        entry["anatomy"] = patch["anatomy"]
        entry["style"] = patch["style"]
        entry["near"] = patch["near"]
        entry["far"] = patch["far"]
        if patch.get("second"):
            entry["second"] = patch["second"]
        else:
            entry.pop("second", None)
        if "accept" in patch:
            entry["accept"] = patch["accept"]
        else:
            entry.pop("accept", None)
        entry["patch"] = {"from": current, "to": after, "source": SOURCE}
        patch["to"] = after
        print(f"{sid}: {current[:12]} -> {after[:12]}")
        changed += 1
    if args.out_dir is None and changed:
        LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        TABLE_PATH.write_text(dump_table(table), encoding="utf-8")
        PATCH_PATH.write_text(dump_patches(patches), encoding="utf-8")
    print(f"patched {changed}, errors {errors}")
    return 1 if errors else 0


def dump_table(table: dict) -> str:
    """One species per line so diffs stay reviewable (same layout as upgrade_all_60_eyes.py)."""
    rows = ",\n".join(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in table["species"].items())
    return '{\n  "version": 1,\n  "species": {\n' + rows + "\n  }\n}\n"


def dump_patches(patches: dict) -> str:
    """Pixel rows one per line so the drawing is readable in a diff."""
    out = ['{\n  "version": 1,\n  "species": {']
    items = []
    for sid, p in patches.items():
        lines = [f'    {json.dumps(sid)}: {{']
        head = {k: v for k, v in p.items() if k not in ("rows", "pal")}
        for k, v in head.items():
            lines.append(f"      {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},")
        lines.append(f'      "pal": {json.dumps(p["pal"])},')
        lines.append('      "rows": [')
        lines.append(",\n".join(f"        {json.dumps(r)}" for r in p["rows"]))
        lines.append("      ]")
        lines.append("    }")
        items.append("\n".join(lines))
    out.append(",\n".join(items))
    out.append("  }\n}\n")
    return "\n".join(out)


if __name__ == "__main__":
    raise SystemExit(main())
