from __future__ import annotations
from pathlib import Path
import re

out_dir = Path(r"C:\Users\hyeon\Downloads\rpg-zzu\tmp\pdfs\m2")
text_path = out_dir / "extracted.txt"
md_path = out_dir / "m2.md"
asset_dir = out_dir / "embedded-images"
raw = text_path.read_text(encoding="utf-8")
chunks = re.split(r"\n?--- PAGE (\d+) ---\n", raw)
page_pairs = []
for i in range(1, len(chunks), 2):
    page_pairs.append((int(chunks[i]), chunks[i + 1]))

section_names = {
    "Function",
    "Functions",
    "Settings",
    "Notes",
    "Targets",
    "Location Information",
    "Others",
    "Processing",
    "Only usable in Battle Events:",
    "Battle Events",
}

def normalize_line(line: str) -> str:
    value = line.strip()
    if not value:
        return ""
    if value.startswith("file:///"):
        return ""
    if re.fullmatch(r"Event Command List Page \d+ of \d+", value):
        return ""
    value = value.replace("쨌", "-").replace("•", "-")
    value = re.sub(r"^[-]\s*", "- ", value)
    return value

def markdownize_line(line: str) -> str:
    value = normalize_line(line)
    if not value:
        return ""
    command_match = re.fullmatch(r"\[([^\]]+)\]", value)
    if command_match:
        return f"### {command_match.group(1)}"
    if value in section_names:
        return f"#### {value.rstrip(':')}"
    if value.startswith("- "):
        return value
    return value

embedded_by_page: dict[int, list[Path]] = {}
if asset_dir.exists():
    for image in sorted(asset_dir.glob("page-*-image-*.*")):
        match = re.match(r"page-(\d+)-image-", image.name)
        if not match:
            continue
        embedded_by_page.setdefault(int(match.group(1)), []).append(image)

lines: list[str] = []
lines.append("# m2.pdf - Markdown Extraction")
lines.append("")
lines.append(f"- Source: `C:/Users/hyeon/Downloads/m2.pdf`")
lines.append(f"- Pages: {len(page_pairs)}")
lines.append(f"- Rendered page images: {len(list(out_dir.glob('page-*.png')))}`")
lines[-1] = lines[-1].replace("`", "")
lines.append(f"- Embedded images: {sum(len(v) for v in embedded_by_page.values())}")
lines.append("")
lines.append("> Text is extracted from the PDF and lightly structured into Markdown. Page renders and embedded image assets are linked for visual reference.")
lines.append("")

for page_no, body in page_pairs:
    lines.append(f"## Page {page_no}")
    lines.append("")
    page_img = out_dir / f"page-{page_no:02d}.png"
    if page_img.exists():
        lines.append("<details>")
        lines.append("<summary>Rendered page image</summary>")
        lines.append("")
        lines.append(f"![Page {page_no:02d} render](page-{page_no:02d}.png)")
        lines.append("")
        lines.append("</details>")
        lines.append("")
    page_images = embedded_by_page.get(page_no, [])
    if page_images:
        lines.append("#### Embedded Images")
        lines.append("")
        for image in page_images:
            rel = image.relative_to(out_dir).as_posix()
            lines.append(f"![Page {page_no:02d} embedded image]({rel})")
            lines.append("")
    previous_blank = False
    for original_line in body.splitlines():
        md_line = markdownize_line(original_line)
        if not md_line:
            if not previous_blank:
                lines.append("")
            previous_blank = True
            continue
        lines.append(md_line)
        previous_blank = False
    lines.append("")

md_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
print(md_path)
print(f"pages={len(page_pairs)} embedded_images={sum(len(v) for v in embedded_by_page.values())}")
print(f"size={md_path.stat().st_size}")
