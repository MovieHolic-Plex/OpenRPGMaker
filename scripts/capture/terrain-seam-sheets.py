"""Contact IDs match contacts.json. Each crop shows the upper edge and the lower foot.
python3 scripts/capture/terrain-seam-sheets.py <capture folder>
Requires Pillow; used for QA evidence only.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
for source in root.rglob("contacts.json"):
    info = json.loads(source.read_text())
    contacts = info["contacts"]
    picture = Image.open(source.parent / "full-map.png").convert("RGB")
    pad = info.get("pad", 144)
    for start in range(0, len(contacts), 30):
        sheet = Image.new("RGB", (672, 930), "#242932")
        labels = ImageDraw.Draw(sheet)
        for index, contact in enumerate(contacts[start:start + 30]):
            x0, y0 = (index % 6) * 112, (index // 6) * 186
            labels.text((x0 + 2, y0 + 2), f'{start+index+1} {contact["x"]},{contact["y"]}{contact["dir"]}', fill="white")
            for band, height in enumerate([max(contact["a"], contact["b"]), min(contact["a"], contact["b"])]):
                x = int(contact["x"] * 16 - 16)
                y = int((contact["y"] - height) * 16 + pad - 12)
                crop = picture.crop((x, y, x + 56, y + 40)).resize((112, 80), Image.Resampling.NEAREST)
                sheet.paste(crop, (x0, y0 + 20 + band * 82))
        sheet.save(source.parent / f"contacts-top-foot-{start//30+1:02}.png")
    print(f"{source.parent}: {len(contacts)} contacts, {(len(contacts)+29)//30} sheets")
