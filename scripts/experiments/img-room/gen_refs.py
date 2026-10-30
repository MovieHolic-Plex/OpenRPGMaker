#!/usr/bin/env python3
"""img-room-test: chipset reference sheets for the image model (labelled pieces, 2x).
  python3 gen_refs.py <outdir>   (run from the repo root)
Writes inn-parts.png, inn-parts.txt, boss-parts.png, boss-parts.txt, boss-style.png."""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
T = 16
try: FONT = ImageFont.truetype("/usr/share/fonts/truetype/nanum/NanumGothic.ttf", 12)
except Exception: FONT = ImageFont.load_default()

def tile(sheet, idx, cols):
    x, y = (idx % cols) * T, (idx // cols) * T
    return sheet.crop((x, y, x + T, y + T))

def pack(cards, width=1200, scale=2, bg=(28, 28, 34), labels=True):
    """cards: [(label, RGBA image 1x)] -> one labelled sheet (scaled x2)."""
    pad, lab = 8, (14 if labels else 0)
    rows, x, y, rowh = [], pad, pad, 0
    placed = []
    for label, im in cards:
        im2 = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        tw = int(FONT.getlength(label)) + 4 if labels else 0
        cw = max(im2.width, tw)
        if x + cw > width - pad: x, y, rowh = pad, y + rowh + pad, 0
        placed.append((x, y, im2, label, cw))
        x += cw + pad; rowh = max(rowh, im2.height + lab)
    H = y + rowh + pad
    out = Image.new("RGB", (width, H), bg); d = ImageDraw.Draw(out)
    for x, y, im2, label, cw in placed:
        out.paste(im2, (x, y), im2)
        if labels: d.text((x, y + im2.height + 1), label, fill=(235, 235, 210), font=FONT)
    return out

# ---- interior (atlas_biome_interior v5) -------------------------------------------------
S = json.load(open("src/assets/handInteriorSpec.json"))
chip = Image.open("public/assets/atlas-interior/interior-chipset.png").convert("RGBA")
C = chip.width // T
def obj_img(o):
    xs = [c[0] for c in o["cells"]] or [0]; ys = [c[1] for c in o["cells"]] or [0]
    x0, y0 = min(xs), min(ys)
    im = Image.new("RGBA", ((max(xs) - x0 + 1) * T, (max(ys) - y0 + 1) * T), (0, 0, 0, 0))
    for dx, dy, idx, _ in sorted(o["cells"], key=lambda c: c[3]): im.alpha_composite(tile(chip, idx, C), ((dx - x0) * T, (dy - y0) * T))
    return im
INN_CATS = {"inn", "tavern", "kitchen", "hall"}
INN_HOME = ["table:plate+cup", "table:mug+bottle", "armchair", "coat rack", "chair S", "chair N", "chair E", "chair W", "stool", "cupboard", "clock", "chest",
            "barrel", "crate", "sack", "plant", "pot", "candle", "fireplace", "window", "picture", "shelf pots", "bottles", "stove", "stairs down", "doormat",
            "roundtable", "bench 2", "bench 3", "dining 1x1", "dining 2x1", "dining 3x1", "dining 2x2", "dining 3x2", "stairs up wood"]
INN_DECOR = ["potted fern", "round rug", "runner", "green rug", "banner red", "wall clock", "deer trophy", "wall map", "notice board", "curtained window",
             "wall sconce", "rug red", "column wood", "wall torch", "hanging lantern", "portrait large"]
cards = []
for fid in ["plank", "boards", "dplank", "cobble", "flag", "grey"]:
    f = S["floors"].get(fid)
    if not f: continue
    im = Image.new("RGBA", (4 * T, 3 * T))
    for y in range(3):
        for x in range(4): im.alpha_composite(tile(chip, f["tiles"][((y % f["rows"]) * f["cols"] + x % f["cols"]) * 4], C), (x * T, y * T))
    cards.append((f"floor {fid}", im))
for wid in ["plaster", "log", "stone", "goldwood"]:
    w = S["walls"].get(wid)
    if not w: continue
    im = Image.new("RGBA", (4 * T, 2 * T))
    for r in range(2):
        for x in range(4): im.alpha_composite(tile(chip, w["tiles"][(r * w["cols"] + x % w["cols"]) * 2], C), (x * T, r * T))
    cards.append((f"wall {wid}", im))
names = [k for k, v in S["objects"].items() if v["category"] in INN_CATS] + INN_HOME + INN_DECOR
seen = set()
for k in names:
    o = S["objects"].get(k)
    if not o or k in seen: continue
    seen.add(k); cards.append((k, obj_img(o)))
pack(cards).save(f"{OUT}/inn-parts.png"); pack(cards, labels=False).save(f"{OUT}/inn-palette.png")
open(f"{OUT}/inn-parts.txt", "w").write("\n".join(f"{lab}" for lab, _ in cards))

# ---- dungeon (Beodeul dungeon kit, the v2 dungeon verb's sheet) ------------------------
cards, labels = [], []
for sub in ["theme", "cave", "theme2"]:
    J = json.load(open(f"tiledata/beodeul-dungeon/{sub}/cells.json")); im = Image.open(f"tiledata/beodeul-dungeon/{sub}/cells.png").convert("RGBA")
    cols = im.width // T
    groups = {}
    for i, c in enumerate(J["cells"]):
        if not c: continue
        tags = set(c.get("tags", []))
        if tags & {"lava", "water"} or not tags & {"castle", "catacomb", "otherworld", "마계", "throne", "demon-throne", "portcullis", "carpet-runner", "candelabra", "iron-candelabra", "void-brazier", "ossuary"}: continue
        import re
        base = re.sub(r" \(\d+,\d+\)$", "", re.split(r" \d+×\d+", c.get("label", "").replace("버들항 던전 · ", ""))[0])
        base = re.sub(r" \d+칸 [A-Z]+$| 벽 밑 그늘 \d+$| 밭$", "", base)
        groups.setdefault(c.get("origin", base).split("/")[0] + "|" + base, []).append(i)
    for key, idxs in groups.items():
        base = key.split("|", 1)[1]
        n = len(idxs); w = min(n, 8); h = (n + w - 1) // w
        if n > 48: idxs = idxs[:16]; n = 16; w = 8; h = 2
        g = Image.new("RGBA", (w * T, h * T))
        for j, i in enumerate(idxs): g.alpha_composite(tile(im, i, cols), ((j % w) * T, (j // w) * T))
        cards.append((base[:30], g)); labels.append(base)
pack(cards, width=1400).save(f"{OUT}/boss-parts.png"); pack(cards, width=1400, labels=False).save(f"{OUT}/boss-palette.png")
open(f"{OUT}/boss-parts.txt", "w").write("\n".join(sorted(set(labels))))
# style crop: castle catacombs reference render (what the builder's floors/walls look like)
ref = Image.open("tiledata/beodeul-variants/castle-catacombs/render-1x.png").convert("RGB")
ref.crop((0, 0, min(ref.width, 640), min(ref.height, 480))).resize((min(ref.width, 640) * 2, min(ref.height, 480) * 2), Image.NEAREST).save(f"{OUT}/boss-style.png")
print("ok", OUT)
