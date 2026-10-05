"""Four explicitly chosen pixels only; decode grids to native PNGs for inspection.

Do not run author.py to apply this repair: that file is preserved draft history.
No source image is read, and no pose, shading or effect is synthesized here.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
CHANGES = {
    "actions/skill_a.pxgrid": [(33, 42, "m"), (34, 42, "g")],
    "poses/dead.pxgrid": [(27, 51, "s"), (28, 51, "t")],
}
files = [ROOT / "palette.json", ROOT / "author.py"]
files += sorted((ROOT / "poses").glob("*.pxgrid"))
files += sorted((ROOT / "actions").glob("*.pxgrid"))
before = {p: p.read_bytes() for p in files}
pending = {}
for relative, entries in CHANGES.items():
    path = ROOT / relative
    rows = before[path].splitlines(keepends=True)
    for x, y, symbol in entries:
        row = rows[y]
        if row[x:x + 1] not in (b".", symbol.encode("ascii")):
            raise ValueError(f"Unexpected source pixel: {relative} ({x},{y})")
        rows[y] = row[:x] + symbol.encode("ascii") + row[x + 1:]
    pending[path] = b"".join(rows)
for path, contents in pending.items():
    if contents != before[path]:
        path.write_bytes(contents)

out = ROOT / "progress" / "quality-repair"
out.mkdir(exist_ok=True)
report = ["Four-coordinate repair receipt (zero-based native coordinates)."]
for path in files:
    after = path.read_bytes()
    relative = path.relative_to(ROOT).as_posix()
    report.append(f"{relative}: {'unchanged bytes' if after == before[path] else 'changed'}")
    report.append(f"  before sha256: {hashlib.sha256(before[path]).hexdigest()}")
    report.append(f"  after  sha256: {hashlib.sha256(after).hexdigest()}")
    if after != before[path]:
        old_rows, new_rows = before[path].splitlines(), after.splitlines()
        for y, (old, new) in enumerate(zip(old_rows, new_rows)):
            for x, (a, b) in enumerate(zip(old, new)):
                if a != b:
                    report.append(f"  ({x},{y}) {chr(a)} -> {chr(b)}")
receipt = out / "repair-receipt.txt"
if not receipt.exists():
    receipt.write_text("\n".join(report) + "\n")
print("\n".join(report))

palette = json.loads((ROOT / "palette.json").read_text())
rgba = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in palette.items()}
order = [
    ("poses", "idle_a"), ("poses", "idle_b"), ("poses", "idle_c"),
    ("poses", "windup"), ("poses", "move"), ("poses", "attack"),
    ("poses", "recover"), ("poses", "hit"), ("poses", "dead"),
    ("actions", "skill_a"), ("actions", "skill_b"), ("actions", "skill_c"),
    ("actions", "poison_a"), ("actions", "poison_b"), ("actions", "stun_a"),
    ("actions", "stun_b"), ("actions", "sleep_a"), ("actions", "sleep_b"),
]
# Native 1:1 contact sheet; labels and checkerboard are outside the source art.
sheet = Image.new("RGB", (264, 528), "#e8e5dc")
draw = ImageDraw.Draw(sheet)
for index, (directory, name) in enumerate(order):
    rows = (ROOT / directory / (name + ".pxgrid")).read_text().splitlines()
    sprite = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            if symbol != ".":
                sprite.putpixel((x, y), rgba[symbol])
    sprite.save(out / (name + ".png"))
    sx, sy = (index % 3) * 88 + 12, (index // 3) * 88 + 20
    draw.text((sx, sy - 14), name, fill="#20242a")
    for y in range(64):
        for x in range(64):
            sheet.putpixel((sx + x, sy + y),
                           (173, 173, 173) if (x // 8 + y // 8) % 2 else (206, 206, 206))
    sheet.paste(sprite, (sx, sy), sprite)
sheet.save(out / "suite-native.png")
print("Rendered 18 native 64x64 PNGs and a native contact sheet; no image resampling.")
