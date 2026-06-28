from __future__ import annotations
from pathlib import Path
from pypdf import PdfReader

pdf_path = Path(r"C:\Users\hyeon\Downloads\m2.pdf")
out_dir = Path(r"C:\Users\hyeon\Downloads\rpg-zzu\tmp\pdfs\m2")
asset_dir = out_dir / "embedded-images"
asset_dir.mkdir(parents=True, exist_ok=True)
reader = PdfReader(str(pdf_path))
count = 0
page_counts: list[tuple[int, int]] = []
for page_index, page in enumerate(reader.pages, start=1):
    images = list(getattr(page, "images", []))
    page_count = 0
    for image_index, image in enumerate(images, start=1):
        suffix = Path(image.name).suffix or ".bin"
        safe_name = f"page-{page_index:02d}-image-{image_index:02d}{suffix}"
        (asset_dir / safe_name).write_bytes(image.data)
        count += 1
        page_count += 1
    if page_count:
        page_counts.append((page_index, page_count))
print(f"embedded_images={count}")
print("pages=" + ", ".join(f"{page}:{n}" for page, n in page_counts[:30]))
print(asset_dir)
