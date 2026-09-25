"""Rebuild list thumbnails for reviewed places and region references.

Long edge 256px. The database list uses these files; the detail view keeps
the original preview.

Place files under public/assets/reviewed-places are the first source. Host
shared-content previews that were never written as those files (새솔마을 and
the other sqlite-only maps) are shrunk from their data URLs into the same
catalog-thumbs directory.
"""

import base64
import json
import os
import sqlite3
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOTS = {
    Path("public/assets/reviewed-places"): Path("public/assets/catalog-thumbs/reviewed-places"),
    Path("public/assets/region-references"): Path("public/assets/catalog-thumbs/region-references"),
}
PLACE_DEST = Path("public/assets/catalog-thumbs/reviewed-places")
SHEET_DEST = Path("public/assets/catalog-thumbs/sheets")


def write_long_edge(image: Image.Image, dest: Path) -> None:
    framed = image.convert("RGBA")
    framed.thumbnail((256, 256), Image.Resampling.BOX)
    dest.parent.mkdir(parents=True, exist_ok=True)
    framed.save(dest, "PNG", optimize=True)


def shared_sqlite_path() -> Path | None:
    raw = os.environ.get("OPRN_SHARED_CONTENT_SQLITE")
    path = Path(raw) if raw else Path.home() / ".local/share/oprn/shared-content.sqlite"
    return path if path.is_file() else None


def thumb_shared_previews(already: set[str]) -> int:
    path = shared_sqlite_path()
    if path is None:
        print("shared sqlite skipped")
        return 0
    count = 0
    with sqlite3.connect(path) as connection:
        rows = connection.execute("select payload from content_libraries")
        for (payload,) in rows:
            previews = json.loads(payload).get("previews") or {}
            for place_id, src in previews.items():
                if not isinstance(place_id, str) or "/" in place_id or "\\" in place_id or place_id.startswith("."):
                    continue
                name = f"{place_id}.png"
                if name in already or not isinstance(src, str) or not src.startswith("data:image") or "," not in src:
                    continue
                encoded = src.split(",", 1)[1]
                with Image.open(BytesIO(base64.b64decode(encoded))) as image:
                    write_long_edge(image, PLACE_DEST / name)
                already.add(name)
                count += 1
    return count


def main() -> None:
    count = 0
    place_names: set[str] = set()
    for source_dir, dest_dir in ROOTS.items():
        dest_dir.mkdir(parents=True, exist_ok=True)
        for source in sorted(source_dir.glob("*.png")):
            with Image.open(source) as image:
                write_long_edge(image, dest_dir / source.name)
            if dest_dir == PLACE_DEST:
                place_names.add(source.name)
            count += 1
    count += thumb_shared_previews(place_names)
    for source in sorted(Path("public/assets").rglob("*chipset*.png")):
        if "catalog-thumbs" in source.parts:
            continue
        relative = source.relative_to("public/assets")
        dest = SHEET_DEST / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            framed = image.convert("RGBA")
            crop = framed.crop((0, 0, min(48, framed.width), min(64, framed.height)))
            crop.thumbnail((32, 40), Image.Resampling.BOX)
            crop.save(dest, "PNG", optimize=True)
        count += 1
    print(f"catalog thumbs {count}")


if __name__ == "__main__":
    main()
