"""4x QA contact sheet PNGs and Before/After inline HTML gallery builder."""
from __future__ import annotations

import base64
import html as html_mod
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageDraw


def build_contact_sheets(
    sprites: Sequence[Path],
    out_dir: str | Path,
    *,
    per_sheet: int = 20,
    cols: int = 5,
    scale: int = 4,
    cell_size: int = 220,
) -> list[Path]:
    """Render 4x nearest-neighbor labeled QA contact sheets."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for page_idx in range(0, len(sprites), per_sheet):
        chunk = sprites[page_idx : page_idx + per_sheet]
        rows = (len(chunk) + cols - 1) // cols
        canvas = Image.new("RGBA", (cols * cell_size, rows * cell_size), (28, 32, 42, 255))
        draw = ImageDraw.Draw(canvas)
        for i, sp in enumerate(chunk):
            c, r = i % cols, i // cols
            x0, y0 = c * cell_size, r * cell_size
            draw.rectangle(
                [x0 + 6, y0 + 22, x0 + cell_size - 6, y0 + cell_size - 6],
                fill=(42, 47, 60, 255),
                outline=(70, 78, 96, 255),
            )
            im = Image.open(sp).convert("RGBA")
            w, h = im.size
            label = f"{page_idx + i + 1}. {sp.stem} ({w}x{h})"
            draw.text((x0 + 8, y0 + 5), label[:30], fill=(230, 235, 245, 255))
            im_scaled = im.resize((w * scale, h * scale), Image.NEAREST)
            max_w, max_h = cell_size - 20, cell_size - 36
            if im_scaled.width > max_w or im_scaled.height > max_h:
                ratio = min(max_w / im_scaled.width, max_h / im_scaled.height)
                im_scaled = im_scaled.resize(
                    (max(1, int(im_scaled.width * ratio)), max(1, int(im_scaled.height * ratio))),
                    Image.NEAREST,
                )
            px = x0 + (cell_size - im_scaled.width) // 2
            py = y0 + 22 + ((cell_size - 28) - im_scaled.height) // 2
            canvas.alpha_composite(im_scaled, (px, py))
        sheet_path = out / f"qa-sheet-{(page_idx // per_sheet) + 1}.png"
        canvas.save(sheet_path)
        written.append(sheet_path)
    return written


def _b64_png(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build_gallery_html(
    sprites: Sequence[Path],
    out_html: str | Path,
    *,
    title: str = "object-gen-v2 QA Gallery",
    before_map: dict[str, Path] | None = None,
) -> Path:
    """Write a self-contained base64-inlined HTML gallery with crisp pixelated rendering."""
    cards: list[str] = []
    for idx, sp in enumerate(sprites, 1):
        im = Image.open(sp).convert("RGBA")
        w, h = im.size
        stem = html_mod.escape(sp.stem)
        before_path = (before_map or {}).get(sp.stem)
        if before_path and before_path.exists():
            stage = (
                f'<div class="pair">'
                f'<div class="st old"><img src="{_b64_png(before_path)}" alt="before {stem}" /></div>'
                f'<div class="st new"><img src="{_b64_png(sp)}" alt="after {stem}" /></div>'
                f"</div>"
            )
        else:
            stage = f'<div class="st new single"><img src="{_b64_png(sp)}" alt="{stem}" /></div>'
        cards.append(
            f'<div class="item"><div class="ih"><span class="in">{idx}. {stem}</span>'
            f'<span class="is">{w}×{h}</span></div>{stage}</div>'
        )

    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{html_mod.escape(title)}</title><style>
*{{box-sizing:border-box}}
body{{margin:0;padding:12px;font-family:var(--font-sans,system-ui,sans-serif);color:var(--foreground,#e5e7eb);background:var(--background,#111827);font-size:11px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}}
.item{{background:var(--card,#1f2937);border:1px solid var(--border,#374151);border-radius:6px;padding:7px}}
.ih{{display:flex;justify-content:space-between;gap:4px;margin-bottom:5px}}
.in{{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.is{{color:var(--muted-foreground,#9ca3af);font-family:var(--font-mono,monospace);font-size:10px}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:4px}}
.st{{height:80px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:repeating-conic-gradient(rgba(128,128,128,.14) 0% 25%,transparent 0% 50%) 50%/10px 10px;border:1px solid var(--border,#374151);padding:4px}}
.st.new{{border-color:var(--primary,#60a5fa)}}
.st img{{image-rendering:pixelated;max-width:100%;max-height:72px;min-height:44px;object-fit:contain}}
</style></head><body>
<div class="grid">{''.join(cards)}</div>
</body></html>"""
    out = Path(out_html)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    return out
