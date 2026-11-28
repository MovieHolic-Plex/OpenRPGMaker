"""Locked palette loading and strict pixel/alpha validation."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

TILE_SIZE = 16


def _parse_hex(value: str) -> tuple[int, int, int] | None:
    s = value.strip()
    if len(s) == 7 and s.startswith("#"):
        try:
            return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16))
        except ValueError:
            return None
    return None


def load_palette(path: str | Path) -> set[tuple[int, int, int]]:
    """Load allowed RGB triples from a JSON ramp palette or a .pal hex file."""
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    colors: set[tuple[int, int, int]] = set()
    if p.suffix.lower() == ".json":
        data = json.loads(text)

        def walk(obj: Any) -> None:
            if isinstance(obj, str):
                rgb = _parse_hex(obj)
                if rgb is not None:
                    colors.add(rgb)
            elif isinstance(obj, dict):
                for v in obj.values():
                    walk(v)
            elif isinstance(obj, list):
                for v in obj:
                    walk(v)

        walk(data)
    else:
        for line in text.splitlines():
            for token in line.split():
                rgb = _parse_hex(token)
                if rgb is not None:
                    colors.add(rgb)
    if not colors:
        raise ValueError(f"No RGB hex colors found in palette: {p}")
    return colors


def pixel_sha256(path: str | Path) -> str:
    """Compute canonical WxH + RGBA bytes SHA-256 matching OpenRPGMaker object-gate."""
    im = Image.open(path).convert("RGBA")
    h = hashlib.sha256()
    h.update(f"{im.width}x{im.height}\n".encode("ascii"))
    h.update(im.tobytes())
    return h.hexdigest()


@dataclass(frozen=True)
class SpriteReport:
    path: Path
    width: int
    height: int
    opaque_pixels: int
    unique_colors: int
    palette_violations: int
    alpha_violations: int
    pure_black_pixels: int
    pixel_sha256: str
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


def verify_sprite(
    path: str | Path,
    allowed_rgb: set[tuple[int, int, int]] | None = None,
    *,
    tile_size: int = TILE_SIZE,
    forbid_pure_black: bool = False,
) -> SpriteReport:
    p = Path(path)
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    data = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
    opaque = 0
    alpha_viol = 0
    pal_viol = 0
    pure_black = 0
    colors: set[tuple[int, int, int]] = set()

    for r, g, b, a in data:
        if a not in (0, 255):
            alpha_viol += 1
        elif a == 255:
            opaque += 1
            rgb = (r, g, b)
            colors.add(rgb)
            if rgb == (0, 0, 0):
                pure_black += 1
            if allowed_rgb is not None and rgb not in allowed_rgb:
                pal_viol += 1

    errors: list[str] = []
    if w <= 0 or h <= 0 or w % tile_size != 0 or h % tile_size != 0:
        errors.append(f"dimensions {w}x{h} not multiples of {tile_size}")
    if opaque == 0:
        errors.append("empty sprite (0 opaque pixels)")
    if alpha_viol > 0:
        errors.append(f"alpha_violations={alpha_viol} (must be strictly 0 or 255)")
    if pal_viol > 0:
        errors.append(f"palette_violations={pal_viol}")
    if forbid_pure_black and pure_black > 0:
        errors.append(f"pure_black_pixels={pure_black}")

    return SpriteReport(
        path=p,
        width=w,
        height=h,
        opaque_pixels=opaque,
        unique_colors=len(colors),
        palette_violations=pal_viol,
        alpha_violations=alpha_viol,
        pure_black_pixels=pure_black,
        pixel_sha256=pixel_sha256(p),
        errors=tuple(errors),
    )
