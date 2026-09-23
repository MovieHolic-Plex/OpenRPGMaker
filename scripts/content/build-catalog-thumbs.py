"""Rebuild list thumbnails for reviewed places and region references.

Long edge 256px. The database list uses these files; the detail view keeps
the original preview.
"""

from pathlib import Path

from PIL import Image

ROOTS = {
    Path("public/assets/reviewed-places"): Path("public/assets/catalog-thumbs/reviewed-places"),
    Path("public/assets/region-references"): Path("public/assets/catalog-thumbs/region-references"),
}
SHEET_DEST = Path("public/assets/catalog-thumbs/sheets")


def main() -> None:
    count = 0
    for source_dir, dest_dir in ROOTS.items():
        dest_dir.mkdir(parents=True, exist_ok=True)
        for source in sorted(source_dir.glob("*.png")):
            with Image.open(source) as image:
                framed = image.convert("RGBA")
                framed.thumbnail((256, 256), Image.Resampling.BOX)
                framed.save(dest_dir / source.name, "PNG", optimize=True)
            count += 1
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
