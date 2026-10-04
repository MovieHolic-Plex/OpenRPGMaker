"""North/east/west height contacts from the actual reloaded native map renders.
Usage: python3 scripts/capture/terrain-rim-sheets.py <inspect-terrain-seams output>
Labels retain the original contact IDs; h/r/t identify the three QA maps.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
out = root.parent / "north-side-sheets"
out.mkdir(exist_ok=True)
contacts = []
counts = {}
for source in sorted(root.glob("*/contacts.json")):
    info = json.loads(source.read_text())
    image = Image.open(source.parent / "full-map.png").convert("RGB")
    count = 0
    for contact in info["contacts"]:
        if contact["dir"] == "s" and contact["a"] >= contact["b"]:
            continue
        x = contact["x"] + (contact["dir"] == "e" and contact["b"] > contact["a"])
        y = contact["y"] + (contact["dir"] == "s" and contact["b"] > contact["a"])
        left = int(x * 16 - 16)
        top = int((y - max(contact["a"], contact["b"])) * 16 + info["pad"] - 16)
        crop = image.crop((left, top, left + 56, top + 32)).resize((112, 64), Image.Resampling.NEAREST)
        contacts.append((info["mapId"], contact, crop))
        count += 1
    counts[info["mapId"]] = count
for start in range(0, len(contacts), 100):
    sheet = Image.new("RGB", (1120, 780), (30, 34, 40))
    draw = ImageDraw.Draw(sheet)
    for n, (map_id, contact, image) in enumerate(contacts[start:start + 100]):
        x, y = n % 10 * 112, n // 10 * 78
        draw.text((x + 1, y + 1), f'{map_id[:1]} {contact["id"]}:{contact["x"]},{contact["y"]}', fill="white")
        sheet.paste(image, (x, y + 14))
    sheet.save(out / f"north-side-{start // 100 + 1:02}.png")
(out / "manifest.json").write_text(json.dumps({"contacts": len(contacts), "counts": counts, "images": (len(contacts) + 99) // 100, "selection": "north-facing and east/west height contacts, including hidden contacts"}, indent=2))
print(len(contacts))
