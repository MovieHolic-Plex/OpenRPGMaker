#!/usr/bin/env python3
"""bbox-walls: per-task piece list -> labelled piece sheet (16px grid, x2) + English catalog.
  python3 pieces.py <task> <out dir>   (run from the worktree root)"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
task, OUT = sys.argv[1], sys.argv[2]
S = json.load(open("src/assets/handInteriorSpec.json"))
chip = Image.open("public/assets/atlas-interior/interior-chipset.png").convert("RGBA"); C = chip.width // 16
COMMON = ["window", "curtained window", "wall sconce", "wall torch", "hanging lantern", "picture", "candle", "plant", "potted fern", "pot", "barrel", "crate",
          "chest", "chair S", "chair N", "chair E", "chair W", "stool", "clock", "cupboard", "stairs up wood", "stairs down", "doormat", "round rug", "runner"]
P = {
 "inn": dict(floors=["plank", "boards", "dplank", "flag", "ktile"], walls=["plaster", "log", "stone"], rugs=["rug red", "rug green", "rug brown"],
   objs=["inn reception", "inn sign", "room key board", "menu board", "luggage trunk", "counter 3x1", "dining 2x1", "dining 3x2", "bench 2", "bench 3", "bar stool",
         "keg rack", "fireplace", "deer trophy", "notice board", "shelf pots", "bottles", "coat rack", "sack", "table:plate+cup", "table:mug+bottle",
         "kitchen sink", "kitchen range", "stove", "kcounter 3x1", "dish rack", "hanging pans", "water jar", "firewood rack", "firewood bundle",
         "bed red", "bed blue", "double bed red", "nightstand", "wardrobe", "washbasin", "dresser", "armchair"], tables=["dining", "counter", "kcounter"]),
 "library": dict(floors=["parquet", "plank", "marble", "grey"], walls=["goldwood", "stone", "plaster", "marblewall"], rugs=["rug royal", "rug blue", "rug green"],
   objs=["bookshelf 1w", "bookshelf 2w", "bookshelf 3w", "cabinet:book+bookb+bookg", "shelf:book+bookb+bookg", "shelf:scroll", "scroll rack", "chained bookcase",
         "library ladder", "catalog drawers", "book pile", "scroll pile", "globe", "desk 2x1", "desk 3x2", "school desk", "armchair", "sofa", "tea 2x1", "lectern",
         "tall stained window", "portrait large", "wall map", "spellbook stand", "floating book", "hourglass", "fireplace", "column marble", "marble bust",
         "star chart", "table:book+scroll", "banner blue"], tables=["desk", "tea"]),
 "jail": dict(floors=["flag", "dungeon", "cobble", "grey", "wetstone"], walls=["dungeonw", "stone", "rubble", "grey"], rugs=["rug brown"],
   objs=["prison cot", "straw pile", "slop bucket", "shackles", "key ring hook", "drip puddle", "iron gate", "iron gate open", "locked door", "brazier",
         "work 2x1", "desk 2x1", "weapon rack", "sword rack", "spear rack", "wanted poster", "wall lever", "hanging cage", "skull pile", "cobweb",
         "stairs up stone", "table:mug+bottle", "bench 2", "sack", "water bucket", "boarded window"], tables=["work", "desk"], lines=["bars"]),
 "manor": dict(floors=["parquet", "marble", "check", "plank", "ktile"], walls=["velvet", "goldwood", "marblewall", "plaster"], rugs=["rug royal", "rug red", "rug blue"],
   objs=["fireplace", "piano", "sofa", "armchair", "tea 2x1", "dining 4x2", "sideboard 2x1", "gilded wardrobe", "portrait large", "painting landscape", "painting sea",
         "tapestry", "royal banner", "heraldic shield", "crossed swords", "knight armor", "marble bust", "indoor fountain", "column marble", "tall vase red",
         "tall vase blue", "potted flowering", "candelabra", "kitchen range", "kcounter 3x1", "kitchen sink", "hanging pans", "bookshelf 2w", "desk 2x1", "globe",
         "deer trophy", "wall map", "stairs up stone", "coat rack", "double bed blue"], tables=["dining", "tea", "sideboard", "desk", "kcounter"]),
}[task]
ids = ["floor:" + f for f in P["floors"]] + ["wall:" + w for w in P["walls"]]
miss = [o for o in P["objs"] + COMMON if o not in S["objects"]]
objs = [o for o in dict.fromkeys(P["objs"] + COMMON) if o in S["objects"]]
if miss: print("missing:", miss, file=sys.stderr)
T = 16
def tile(i): return chip.crop(((i % C) * T, (i // C) * T, (i % C) * T + T, (i // C) * T + T))
def obj_img(o):
    xs = [c[0] for c in o["cells"]]; ys = [c[1] for c in o["cells"]]; x0, y0 = min(xs), min(ys)
    im = Image.new("RGBA", ((max(xs) - x0 + 1) * T, (max(ys) - y0 + 1) * T))
    for dx, dy, idx, _ in sorted(o["cells"], key=lambda c: c[3]): im.alpha_composite(tile(idx), ((dx - x0) * T, (dy - y0) * T))
    return im
cards = []
for f in P["floors"]:
    fd = S["floors"][f]; im = Image.new("RGBA", (4 * T, 2 * T))
    for y in range(2):
        for x in range(4): im.alpha_composite(tile(fd["tiles"][((y % fd["rows"]) * fd["cols"] + x % fd["cols"]) * 4]), (x * T, y * T))
    cards.append(("floor:" + f, im))
for w in P["walls"]:
    wd = S["walls"][w]; im = Image.new("RGBA", (4 * T, 2 * T))
    for r in range(2):
        for x in range(4): im.alpha_composite(tile(wd["tiles"][(r * wd["cols"] + x % wd["cols"]) * 2]), (x * T, r * T))
    cards.append(("wall:" + w + " (2-row face)", im))
for o in objs: cards.append((o, obj_img(S["objects"][o])))
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except Exception: F = ImageFont.load_default()
W, pad, x, y, rowh, placed = 1500, 10, 10, 10, 0, []
for lab, im in cards:
    im2 = im.resize((im.width * 2, im.height * 2), Image.NEAREST); cw = max(im2.width, int(F.getlength(lab)) + 4)
    if x + cw > W - pad: x, y, rowh = pad, y + rowh + pad, 0
    placed.append((x, y, im2, lab)); x += cw + pad; rowh = max(rowh, im2.height + 16)
out = Image.new("RGB", (W, y + rowh + pad), (24, 24, 30)); d = ImageDraw.Draw(out, "RGBA")
for x, y, im2, lab in placed:
    out.paste(im2, (x, y), im2)
    for gx in range(0, im2.width + 1, 32): d.line([(x + gx, y), (x + gx, y + im2.height)], fill=(120, 140, 200, 70))
    for gy in range(0, im2.height + 1, 32): d.line([(x, y + gy), (x + im2.width, y + gy)], fill=(120, 140, 200, 70))
    d.text((x, y + im2.height + 1), lab, fill=(235, 235, 210), font=F)
out.save(f"{OUT}/pieces-{task}.png")
RULE = {"floor": "floor piece (stands on floor, blocks walking) -> 'objects'",
        "wall": "AGAINST-WALL -> 'wall_items': stands on the first floor row directly below a wall's face (back touches the face)",
        "hang": "WALL-MOUNTED -> 'wall_items': hangs on the UPPER face row directly below a wall cap",
        "flat": "floor decal (walkable, may lie under furniture) -> 'objects'"}
L = [f"# Tileset catalog — {task} (chipset atlas_biome_interior v5, 16px cells). The attached sheet shows every piece with its exact id, on a 16px grid (x2).",
     "id | footprint w x h cells | placement"]
for f in P["floors"]: L.append(f"floor:{f} | - | room floor material (use '{f}')")
for w in P["walls"]: L.append(f"wall:{w} | - | wall material (use '{w}'); it is the material of that wall's 2-row face")
for o in objs:
    d = S["objects"][o]; tall = f" (art {d['up']//16} row(s) taller, drawn upward)" if d.get("up") else ""
    fp = f"{d['w']} wide, on the face" if d["h"] == 0 else f"{d['w']}x{d['h']}{tall}"
    rule = RULE[d["kind"]]
    if d.get("stairs") == "up": rule = "STAIRS UP -> 'wall_items': against-wall at a north wall (first floor row under its face); climbs into the wall"
    if o in ("iron gate", "iron gate open", "locked door"): rule = "door leaf -> put it as \"piece\" on a door (not in objects)"
    L.append(f"{o} | {fp} | {rule}")
L.append("")
L.append("# Sized pieces (any size, id with the size, in 'objects')")
for t in P["tables"]:
    one = S["tables"][t]["oneRow"]
    L.append(f"{t} WxH | W x H{' (H must be 1)' if one else ''} | floor table/counter, e.g. '{t} {'3x1' if one else '3x2'}'")
L.append(" / ".join(P["rugs"]) + " | any W x H rect | walkable carpet in 'carpets'")
for l in P.get("lines", []): L.append(f"{l} | a path of cells | blocking iron-bar line in 'rails' (path of floor cells); leave a 1-cell gap and put 'iron gate' there as an object to make a barred cell door")
open(f"{OUT}/catalog-{task}.txt", "w").write("\n".join(L) + "\n")
print(task, len(cards), "cards")
