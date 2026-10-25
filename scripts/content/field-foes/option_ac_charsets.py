"""Field-foe look prototypes — Option A (derived from the battle battler) and Option C (encounter symbol).

Writes RM2000 CharSets (288x256, 24x32 frames, rows up/right/down/left, cols 0-1-2 with col 1 standing).
Slots 0..3 = wolf-grey, spider-cave, wisp-blue, boar-tusk (Option A) / four area tints (Option C).
Prototype only; nothing here is wired into the editor. Neither sheet has an object-gate receipt.
"""
from __future__ import annotations
import math, sys
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "out"
BATTLERS = ROOT / "public/assets/generated/pixel-enemies"
SPECIES = ["wolf-grey", "spider-cave", "wisp-blue", "boar-tusk"]
FW, FH = 24, 32
ROWS = ["up", "right", "down", "left"]
FLOATERS = {"wisp-blue"}


def sheet() -> Image.Image:
    return Image.new("RGBA", (288, 256), (0, 0, 0, 0))


def put(dst: Image.Image, slot: int, row: int, col: int, frame: Image.Image) -> None:
    dst.alpha_composite(frame, ((slot % 4) * 72 + col * FW, (slot // 4) * 128 + row * FH))


def shadow(frame: Image.Image, cx: float, width: int, y: int, alpha: int = 96) -> None:
    """Soft ground ellipse, two alpha steps (pixel-art friendly)."""
    px = frame.load()
    rx, ry = width / 2, 2.2
    for yy in range(y - 3, y + 3):
        for xx in range(FW):
            d = ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - y) / ry) ** 2
            if d <= 1 and 0 <= yy < FH:
                a = alpha if d < 0.55 else alpha // 2
                r, g, b, oa = px[xx, yy]
                if oa == 0:
                    px[xx, yy] = (12, 18, 10, a)


# ---------------------------------------------------------------- Option A
def pool(cell: Image.Image, box: tuple[int, int, int, int], tw: int, th: int) -> Image.Image:
    """Pixel-art aware downscale: each target pixel = most common opaque colour of its source block."""
    x0, y0, x1, y1 = box
    sx, sy = (x1 - x0) / tw, (y1 - y0) / th
    src = cell.load()
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    dst = out.load()
    for ty in range(th):
        for tx in range(tw):
            a0, a1 = x0 + tx * sx, x0 + (tx + 1) * sx
            b0, b1 = y0 + ty * sy, y0 + (ty + 1) * sy
            seen: Counter = Counter()
            total = 0
            for yy in range(int(b0), max(int(b0) + 1, math.ceil(b1))):
                for xx in range(int(a0), max(int(a0) + 1, math.ceil(a1))):
                    total += 1
                    p = src[xx, yy]
                    if p[3] > 128:
                        seen[p[:3]] += 1
            if seen and sum(seen.values()) / total >= 0.38:
                # Prefer lighter colours on ties: at 1/3 scale the battler's own dark line work otherwise
                # swallows the body (first pass read as dark blobs on the forest floor).
                colour = max(seen.items(), key=lambda kv: (kv[1], sum(kv[0])))[0]
                dst[tx, ty] = (*colour, 255)
    return out


def outline(img: Image.Image, colour: tuple[int, int, int], alpha: int = 230) -> Image.Image:
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(img, (1, 1))
    src, dst = out.copy().load(), out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            if any(0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                dst[x, y] = (*colour, alpha)
    return out


def derive(species: str, fit: tuple[int, int] = (21, 22)) -> list[Image.Image]:
    """Three field frames (facing right) from the battler's idle row."""
    grid = Image.open(BATTLERS / f"{species}.png").convert("RGBA")
    cells = [grid.crop((i * 64, 0, i * 64 + 64, 64)) for i in range(3)]
    boxes = [c.getbbox() for c in cells]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    bw, bh = box[2] - box[0], box[3] - box[1]
    k = max(bw / fit[0], bh / fit[1])
    tw, th = max(1, round(bw / k)), max(1, round(bh / k))
    opaque = [p[:3] for c in cells for p in c.get_flattened_data() if p[3] > 128]
    dark = min(opaque, key=lambda c: sum(c))
    line = tuple(max(0, int(v * 0.8)) for v in dark)
    return [outline(pool(c, box, tw, th), line) for c in cells]


def option_a() -> Image.Image:
    out = sheet()
    for slot, species in enumerate(SPECIES):
        frames = derive(species)
        floats = species in FLOATERS
        for row, direction in enumerate(ROWS):
            for col in range(3):
                base = frames[[0, 1, 2][col]]
                # Walk = idle frames + squash/stretch: step frames drop one middle row (squash) or rise 1px (stretch).
                if col == 0:
                    w, h = base.size
                    body = base.resize((w, max(1, h - 1)), Image.NEAREST)
                    lift = 0
                elif col == 2:
                    body, lift = base, 1
                else:
                    body, lift = base, 0
                if floats:
                    lift += [1, 2, 3][col]
                face_left = direction in ("left", "down")
                if face_left:
                    body = body.transpose(Image.FLIP_LEFT_RIGHT)
                frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
                x = (FW - body.size[0]) // 2
                y = FH - 1 - body.size[1] - lift
                shadow(frame, FW / 2, max(8, int(body.size[0] * (0.55 if floats else 0.8))), FH - 2, 70 if floats else 96)
                frame.alpha_composite(body, (x, max(0, y)))
                put(out, slot, row, col, frame)
    return out


# ---------------------------------------------------------------- Option C
AREA_TINTS = [  # (body, rim, eye, eye glow)  edge / thicket / stream / deep
    ((22, 26, 20), (70, 96, 52), (255, 214, 92), (255, 160, 40)),
    ((28, 18, 34), (96, 58, 120), (255, 92, 92), (220, 40, 60)),
    ((14, 26, 30), (46, 104, 112), (150, 255, 240), (60, 200, 210)),
    ((16, 18, 36), (60, 72, 140), (235, 240, 255), (130, 150, 255)),
]


def blob(tint, direction: str, phase: int) -> Image.Image:
    body, rim, eye, glow = tint
    f = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    shadow(f, FW / 2, 16, FH - 2, 110)
    px = f.load()
    cx, base_y = FW / 2, FH - 3
    for x in range(3, FW - 3):
        dx = (x + 0.5 - cx) / 9.0
        if abs(dx) > 1:
            continue
        top = 15 * math.sqrt(1 - dx * dx) + 1.6 * math.sin(x * 1.3 + phase * 2.1) + (1 if phase == 1 else 0)
        y0 = int(base_y - top)
        for y in range(max(0, y0), base_y + 1):
            edge = y == y0 or x in (3, FW - 4) or y == base_y
            px[x, y] = (*(rim if (y <= y0 + 1 and (x + phase) % 3) else body), 255 if not edge else 235)
        # wisps of mist above the head
        if (x + phase) % 4 == 0 and y0 - 2 >= 0:
            px[x, y0 - 1] = (*rim, 150)
            px[x, y0 - 2] = (*rim, 70)
    # tattered bottom fringe moving with phase
    for x in range(4, FW - 4):
        if (x + phase) % 3 == 0:
            px[x, base_y] = (0, 0, 0, 0)
    if direction != "up":
        ey = base_y - 9 + (1 if phase == 1 else 0)
        xs = {"down": (8, 14), "right": (12, 17), "left": (5, 10)}[direction]
        for ex in xs:
            for gx, gy in ((-1, 0), (2, 0), (0, -1), (1, -1), (0, 1), (1, 1)):
                if 0 <= ex + gx < FW:
                    px[ex + gx, ey + gy] = (*glow, 200)
            px[ex, ey] = (*eye, 255)
            px[ex + 1, ey] = (*eye, 255)
    return f


def option_c() -> Image.Image:
    out = sheet()
    for slot, tint in enumerate(AREA_TINTS):
        for row, direction in enumerate(ROWS):
            for col in range(3):
                put(out, slot, row, col, blob(tint, direction, col))
    return out


# ---------------------------------------------------------------- Option D (hybrid)
def aura(img: Image.Image, colour: tuple[int, int, int], alpha: int) -> Image.Image:
    """One soft ring outside the dark outline — the area's danger tint, pulsing with the walk frame."""
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(img, (1, 1))
    src, dst = out.copy().load(), out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and src[x + dx, y + dy][3] > 200)
            if n:
                dst[x, y] = (*colour, alpha)
    return out


def option_d() -> Image.Image:
    """A's battler-derived frames + C's area danger tint as a thin pulsing aura (forest edge = amber)."""
    out = sheet()
    tint = AREA_TINTS[0][3]
    for slot, species in enumerate(SPECIES):
        frames = derive(species, (19, 20))
        floats = species in FLOATERS
        for row, direction in enumerate(ROWS):
            for col in range(3):
                base = frames[col]
                if col == 0:
                    body = base.resize((base.size[0], max(1, base.size[1] - 1)), Image.NEAREST)
                else:
                    body = base
                body = aura(body, tint, [70, 120, 70][col])
                lift = (1 if col == 2 else 0) + ([1, 2, 3][col] if floats else 0)
                if direction in ("left", "down"):
                    body = body.transpose(Image.FLIP_LEFT_RIGHT)
                frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
                shadow(frame, FW / 2, max(8, int(body.size[0] * (0.55 if floats else 0.8))), FH - 2, 70 if floats else 96)
                frame.alpha_composite(body, ((FW - body.size[0]) // 2, max(0, FH - 1 - body.size[1] - lift)))
                put(out, slot, row, col, frame)
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    option_a().save(OUT / "option-a.png")
    option_c().save(OUT / "option-c.png")
    option_d().save(OUT / "option-d.png")
    print("wrote", OUT / "option-a.png", OUT / "option-c.png", file=sys.stderr)
