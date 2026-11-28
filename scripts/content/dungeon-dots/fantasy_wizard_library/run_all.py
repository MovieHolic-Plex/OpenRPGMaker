#!/usr/bin/env python3
"""Run the full fantasy_wizard_library build + machine check pipeline."""

from __future__ import annotations

import sys

from palette import export_palette_json
from build_tiles import build_all_tiles
from build_objects import build_all_objects
from build_scene import build_contact_sheet, build_demo_map, write_manifest_and_notes
import check


def main() -> int:
    pal_path = export_palette_json()
    print(f"[1/5] Palette  -> {pal_path}")

    tiles = build_all_tiles()
    print(f"[2/5] Tiles    -> {len(tiles)} PNGs built")

    obj_meta = build_all_objects()
    print(f"[3/5] Objects  -> {len(obj_meta)} PNGs built")

    cs = build_contact_sheet(obj_meta)
    d1, d2 = build_demo_map()
    mf, nt = write_manifest_and_notes(obj_meta, len(tiles))
    print(f"[4/5] Scene    -> {cs.name}, {d1.name}, {d2.name}, {mf.name}, {nt.name}")

    print("[5/5] Check    -> running check.py")
    return check.main()


if __name__ == "__main__":
    sys.exit(main())
