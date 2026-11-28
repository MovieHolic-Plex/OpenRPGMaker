"""Master build script for modern_pcbang tileset, objects, preview, and demo map."""
from __future__ import annotations

from tiles import build_tiles
from objects import build_objects
from render_map import render_preview_contact_sheet, render_demo_map


def main() -> None:
    tiles = build_tiles()
    objs = build_objects()
    render_preview_contact_sheet(objs)
    render_demo_map(tiles, objs)
    print(f"Build complete: {len(tiles)} tiles, {len(objs)} objects, preview_2x_on_gray.png, demo_modern_pcbang.png (1x & 2x).")


if __name__ == "__main__":
    main()
