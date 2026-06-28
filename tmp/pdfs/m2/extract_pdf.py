from pathlib import Path
import pdfplumber
pdf_path = Path(r"C:\Users\hyeon\Downloads\m2.pdf")
out_dir = Path(r"C:\Users\hyeon\Downloads\rpg-zzu\tmp\pdfs\m2")
parts: list[str] = []
with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages, start=1):
        text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
        parts.append(f"\n\n--- PAGE {i} ---\n{text}")
(out_dir / "extracted.txt").write_text("".join(parts), encoding="utf-8")
print(f"pages={len(parts)}")
print(out_dir / "extracted.txt")
