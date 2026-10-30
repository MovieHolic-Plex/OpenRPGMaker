#!/usr/bin/env python3
"""bbox-walls-2: per-task piece list -> labelled palette (16px grid x2, every piece drawn with its footprint box, anchor cell and entry side)
+ English catalog (exact footprint, anchor, rise, entry side; floor types; object-pool items).
  python3 pieces.py <task> <out dir>   (run from the worktree root; reads <out dir>/pool.json if present)"""
import json, math, os, re, sys
from PIL import Image, ImageDraw, ImageFont
task, OUT = sys.argv[1], sys.argv[2]
S = json.load(open("src/assets/handInteriorSpec.json"))
chip = Image.open("public/assets/atlas-interior/interior-chipset.png").convert("RGBA"); C = chip.width // 16
POOL = json.load(open(f"{OUT}/pool.json")) if os.path.exists(f"{OUT}/pool.json") else []
STAIR_KIT = json.load(open("src/assets/stairContracts.json"))
KIT = {k: (STAIR_KIT["kits"]["atlas_biome_interior"][v["kit"]], v["lift"]) for k, v in STAIR_KIT["objects"]["atlas_biome_interior"].items()}
COMMON = ["window", "curtained window", "wall sconce", "wall torch", "hanging lantern", "picture", "candle", "plant", "potted fern", "pot", "barrel", "crate",
          "chest", "chair S", "chair N", "chair E", "chair W", "stool", "clock", "cupboard", "stairs up wood", "stairs down", "doormat"]
# floors: more types than bbox-walls (it showed 4-5; agents used rugs to vary the floor)
FLOOR_EN = {"boards": "worn wooden boards", "check": "marble checkerboard", "cobble": "cobblestone", "dplank": "dark polished wood",
            "dungeon": "dark dungeon stone", "earth": "packed earth", "elfstone": "pale jade stone slabs", "flag": "grey stone flagstones",
            "grey": "smooth grey slabs", "hobbit": "warm honey wood", "ktile": "white kitchen tiles", "marble": "polished marble",
            "parquet": "herringbone parquet", "plank": "light wood planks", "rush": "rush matting", "slum": "wet worn stone",
            "soot": "sooty earth", "straw": "straw-strewn floor", "terra": "red terracotta tiles", "wetstone": "wet mossy stone"}
P = {
 "inn": dict(floors=["plank", "boards", "dplank", "hobbit", "flag", "ktile", "terra", "rush", "straw"], walls=["plaster", "log", "stone"], rugs=["rug red", "rug green", "rug brown"],
   objs=["inn reception", "inn sign", "room key board", "menu board", "luggage trunk", "counter 3x1", "dining 2x1", "dining 3x2", "bench 2", "bench 3", "bar stool",
         "keg rack", "fireplace", "deer trophy", "notice board", "shelf pots", "bottles", "coat rack", "sack", "table:plate+cup", "table:mug+bottle",
         "kitchen sink", "kitchen range", "stove", "kcounter 3x1", "dish rack", "hanging pans", "water jar", "firewood rack", "firewood bundle",
         "bed red", "bed blue", "double bed red", "nightstand", "wardrobe", "washbasin", "dresser", "armchair", "round rug", "runner"], tables=["dining", "counter", "kcounter"]),
 "library": dict(floors=["parquet", "plank", "boards", "dplank", "marble", "check", "grey"], walls=["goldwood", "stone", "plaster", "marblewall"], rugs=["rug royal", "rug blue", "rug green"],
   objs=["bookshelf 1w", "bookshelf 2w", "bookshelf 3w", "cabinet:book+bookb+bookg", "shelf:book+bookb+bookg", "shelf:scroll", "scroll rack", "chained bookcase",
         "library ladder", "catalog drawers", "book pile", "scroll pile", "globe", "desk 2x1", "desk 3x2", "school desk", "armchair", "sofa", "tea 2x1", "lectern",
         "tall stained window", "portrait large", "wall map", "spellbook stand", "floating book", "hourglass", "fireplace", "column marble", "marble bust",
         "star chart", "table:book+scroll", "banner blue", "round rug", "runner"], tables=["desk", "tea"]),
 "jail": dict(floors=["flag", "dungeon", "cobble", "grey", "wetstone", "straw", "slum", "earth", "boards"], walls=["dungeonw", "stone", "rubble", "grey"], rugs=["rug brown"],
   objs=["prison cot", "straw pile", "slop bucket", "shackles", "key ring hook", "drip puddle", "iron gate", "iron gate open", "locked door", "brazier",
         "work 2x1", "desk 2x1", "weapon rack", "sword rack", "spear rack", "wanted poster", "wall lever", "hanging cage", "skull pile", "cobweb",
         "stairs up stone", "table:mug+bottle", "bench 2", "sack", "water bucket", "boarded window"], tables=["work", "desk"], lines=["bars", "fence"]),
 "manor": dict(floors=["parquet", "marble", "check", "dplank", "plank", "elfstone", "ktile", "terra"], walls=["velvet", "goldwood", "marblewall", "plaster"], rugs=["rug royal", "rug red", "rug blue"],
   objs=["fireplace", "piano", "sofa", "armchair", "tea 2x1", "dining 4x2", "sideboard 2x1", "gilded wardrobe", "portrait large", "painting landscape", "painting sea",
         "tapestry", "royal banner", "heraldic shield", "crossed swords", "knight armor", "marble bust", "indoor fountain", "column marble", "tall vase red",
         "tall vase blue", "potted flowering", "candelabra", "kitchen range", "kcounter 3x1", "kitchen sink", "hanging pans", "bookshelf 2w", "desk 2x1", "globe",
         "deer trophy", "wall map", "stairs up stone", "coat rack", "double bed blue", "round rug", "runner"], tables=["dining", "tea", "sideboard", "desk", "kcounter"], lines=["fence"]),
}[task]
P.setdefault("lines", [])
P["lines"] = list(dict.fromkeys(P["lines"] + ["fence", "altar rail"]))
P["objs"] += ["column marble", "column stone", "column wood", "folding screen", "marble bust"]
miss = [o for o in P["objs"] + COMMON if o not in S["objects"]]
objs = [o for o in dict.fromkeys(P["objs"] + COMMON) if o in S["objects"]]
if miss: print("missing:", miss, file=sys.stderr)
CATS = [("stairs & doors", r"stair|door|gate|trapdoor"), ("column, screen & platform", r"column|pillar|screen|statue|bust|armor|dais"),
        ("sofa & armchair", r"sofa|armchair|couch|settee|loveseat|chaise|wingback|throne"), ("chair & bench", r"chair|stool|bench|pew|settle|seat"),
        ("bed", r"\bbed|cot\b|hammock|bunk|cradle|crib|straw pile"), ("shelf & bookcase", r"shelf|bookcase|bookshelf|rack|scroll|catalog|ladder|book"),
        ("cabinet & storage", r"cabinet|wardrobe|dresser|cupboard|drawers|sideboard|chest|locker|trunk|nightstand|barrel|crate|sack|basket|jar|keg|bucket"),
        ("kitchen", r"stove|range|sink|oven|kcounter|kitchen|hearth|pan|dish|plate|firewood|prep|pump|cauldron"), ("bath & wash", r"bath|toilet|wash|tub|basin|mirror|vanity"),
        ("table & desk", r"desk|table|dining|tea|work|lectern|counter|reception|bar\b"), ("light & fire", r"lamp|lantern|candle|sconce|torch|chandelier|brazier|candelabr|fireplace"),
        ("plant & vase", r"plant|fern|flower|vase|pot\b|tree|bonsai"), ("wall decor & window", r"window|painting|portrait|picture|poster|tapestry|banner|clock|map|trophy|shield|swords|sign|board|notice|frame|chart"),
        ("rug & decal", r"rug|runner|mat\b|puddle|cobweb"), ("other", r".")]
CAT_ORDER = ["floors", "walls"] + [c for c, _ in CATS]
POOL_CAT = {"sofa_armchair": "sofa & armchair", "chair_stool": "chair & bench", "bed": "bed", "shelf_bookcase": "shelf & bookcase", "cabinet_wardrobe": "cabinet & storage",
            "kitchen": "kitchen", "bath": "bath & wash", "desk_table": "table & desk", "table": "table & desk", "counter": "table & desk", "display_case": "cabinet & storage",
            "lamp_light": "light & fire", "plant": "plant & vase", "wall_decor": "wall decor & window", "rug": "rug & decal", "storage_misc": "cabinet & storage"}
def cat_of(name):
    for c, rx in CATS:
        if re.search(rx, name.lower()): return c
    return "other"
def pool_cat(p): return POOL_CAT.get(str(p.get("category", "")).lower()) or cat_of(p["id"] + " " + p["name"])
T = 16
rise = lambda up: math.ceil((up or 0) / 16)


def tile(i): return chip.crop(((i % C) * T, (i // C) * T, (i % C) * T + T, (i // C) * T + T))


def spec_img(cells):
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; x0, y0 = min(xs), min(ys)
    im = Image.new("RGBA", ((max(xs) - x0 + 1) * T, (max(ys) - y0 + 1) * T))
    for dx, dy, idx, _ in sorted(cells, key=lambda c: c[3]): im.alpha_composite(tile(idx), ((dx - x0) * T, (dy - y0) * T))
    return im, x0, y0


# ---- cards: (label, image, boxes) — boxes in cell units on the card: (kind, x0, y0, w, h) ----
cards = []
for f in P["floors"]:
    fd = S["floors"][f]; im = Image.new("RGBA", (4 * T, 2 * T))
    for y in range(2):
        for x in range(4): im.alpha_composite(tile(fd["tiles"][((y % fd["rows"]) * fd["cols"] + x % fd["cols"]) * 4]), (x * T, y * T))
    cards.append((f"floor:{f}", im, [], "floors"))
for w in P["walls"]:
    wd = S["walls"][w]; im = Image.new("RGBA", (4 * T, 2 * T))
    for r in range(2):
        for x in range(4): im.alpha_composite(tile(wd["tiles"][(r * wd["cols"] + x % wd["cols"]) * 2]), (x * T, r * T))
    cards.append((f"wall:{w}", im, [], "walls"))
for o in objs:
    d = S["objects"][o]; im, x0, y0 = spec_img(d["cells"])
    if o in KIT:   # stair kit: footprint = the whole kit, entry row below
        c, lift = KIT[o]; kx, ky = 0 - x0, -lift - y0
        big = Image.new("RGBA", (max(im.width, c["w"] * T), max(im.height, (ky + c["h"] + 1) * T))); big.alpha_composite(im, (0, 0))
        boxes = [("foot", kx, ky, c["w"], c["h"]), ("anchor", 0 - x0, 0 - y0, 1, 1)] + [("entry", kx + ax, ky + ay, 1, 1) for ax, ay in c["approach"] if ky + ay >= 0]
        cards.append((f"{o}  KIT {c['w']}x{c['h']}", big, boxes, "stairs & doors")); continue
    ax, ay = 0 - x0, 0 - y0
    if d["kind"] == "hang": boxes = [("hang", ax, ay, max(1, d["w"]), im.height // T - ay), ("anchor", ax, ay, 1, 1)]
    elif d["kind"] == "flat": boxes = [("flat", ax, ay, d["w"], max(1, d["h"])), ("anchor", ax, ay, 1, 1)]
    else: boxes = [("foot", ax, ay, d["w"], max(1, d["h"])), ("anchor", ax, ay, 1, 1)]
    fp = f"{d['w']}x{max(1, d['h'])}" if d["kind"] != "hang" else f"{d['w']} wide"
    cards.append((f"{o}  {fp}" + (f" +{rise(d.get('up'))}up" if rise(d.get("up")) and d["kind"] in ("floor", "wall") else ""), im, boxes, cat_of(o)))
for p in POOL:
    im = Image.open(p["png"]).convert("RGBA"); r = p["rows"]
    if p["kind"] == "hang": boxes = [("hang", 0, 0, p["w"], r), ("anchor", 0, 0, 1, 1)]
    elif p["kind"] == "flat": boxes = [("flat", 0, 0, p["w"], p["h"]), ("anchor", 0, 0, 1, 1)]
    else: boxes = [("foot", 0, r - p["h"], p["w"], p["h"]), ("anchor", 0, r - p["h"], 1, 1)]
    cards.append((f"{p['id']}  {p['w']}x{max(1, p['h'])}" + (f" +{p['up']}up" if p["up"] and p["kind"] in ("floor", "wall") else ""), im, boxes, pool_cat(p)))

for dz in ["dais wood", "dais marble", "dais stone"]:
    pcs = S["daises"][dz]["pieces"]; dw, dh = 4, 3; im = Image.new("RGBA", (dw * T, dh * T))
    for j in range(dh):
        for i in range(dw):
            rc = "T" if j == 0 else "B" if j == dh - 1 else "M"; cc = "L" if i == 0 else "R" if i == dw - 1 else "M"
            t = pcs.get(f"{cc}{rc}{(i + j) % 2}", pcs.get(f"{cc}{rc}0"))
            if t is not None: im.alpha_composite(tile(t), (i * T, j * T))
    cards.append((f"{dz.replace('dais ', 'dais 4x3 ')}  (any WxH)", im, [("flat", 0, 0, dw, dh), ("anchor", 0, 0, 1, 1)], "column, screen & platform"))
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12); FS = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
except Exception: F = FS = ImageFont.load_default()
COL = {"foot": (255, 220, 60), "hang": (90, 220, 255), "flat": (120, 230, 120), "entry": (60, 255, 90), "anchor": (255, 60, 60)}
cards.sort(key=lambda c: CAT_ORDER.index(c[3]))
W, pad, MAXH = 1600, 12, 2200
sheets, placed, x, y, rowh, cur = [], [], 12, 44, 0, None
def flush():
    global placed
    if placed: sheets.append(placed)
    placed = []
for lab, im, boxes, cat in cards:
    im2 = im.resize((im.width * 2, im.height * 2), Image.NEAREST); cw = max(im2.width, int(F.getlength(lab)) + 4)
    if cat != cur:
        if y + rowh + 60 > MAXH and placed: flush(); y, rowh = 44, 0
        else: y, rowh = y + rowh + (pad if placed else 0), 0
        placed.append(("H", 12, y, None, f"— {cat} —", None)); y += 20; x = pad; cur = cat
    if x + cw > W - pad: x, y, rowh = pad, y + rowh + pad, 0
    if y + im2.height + 18 > MAXH: flush(); x, y, rowh = pad, 44, 0; placed.append(("H", 12, y, None, f"— {cat} (cont.) —", None)); y += 20
    placed.append(("C", x, y, im2, lab, boxes)); x += cw + pad; rowh = max(rowh, im2.height + 18)
flush()
for n, sh in enumerate(sheets):
    hgt = max(y0 + (im2.height + 20 if im2 else 20) for _, _, y0, im2, _, _ in sh) + pad
    out = Image.new("RGB", (W, hgt), (24, 24, 30)); d = ImageDraw.Draw(out, "RGBA")
    d.text((12, 4), f"Palette {n + 1}/{len(sheets)}. Each 32px square = one map cell. Yellow box = footprint (blocks walking; art above it rises over the cells north of it). Cyan box = wall-mounted on the 2 face rows.", fill=(230, 230, 200), font=F)
    d.text((12, 20), "Green box = walkable decal. Red dot = anchor cell (the x,y you write). Green cells marked IN = entry side: they must stay free walkable floor.", fill=(230, 230, 200), font=F)
    for kind, x0, y0, im2, lab, boxes in sh:
        if kind == "H": d.text((x0, y0), lab, fill=(255, 200, 120), font=FS); continue
        out.paste(im2, (x0, y0), im2)
        for gx in range(0, im2.width + 1, 32): d.line([(x0 + gx, y0), (x0 + gx, y0 + im2.height)], fill=(140, 160, 220, 90))
        for gy in range(0, im2.height + 1, 32): d.line([(x0, y0 + gy), (x0 + im2.width, y0 + gy)], fill=(140, 160, 220, 90))
        for k, bx, by, bw, bh in boxes:
            r = [x0 + bx * 32, y0 + by * 32, x0 + (bx + bw) * 32 - 1, y0 + (by + bh) * 32 - 1]
            if k == "anchor": d.ellipse([r[0] + 3, r[1] + 3, r[0] + 11, r[1] + 11], fill=COL[k])
            elif k == "entry": d.rectangle(r, fill=(60, 255, 90, 70), outline=COL[k], width=2); d.text((r[0] + 9, r[1] + 9), "IN", fill=(220, 255, 220), font=FS)
            else: d.rectangle(r, outline=COL[k], width=2)
        d.text((x0, y0 + im2.height + 2), lab, fill=(235, 235, 210), font=F)
    out.save(f"{OUT}/pieces-{task}-{n + 1}.png")
json.dump(len(sheets), open(f"{OUT}/pieces-{task}.n", "w"))

# ---- catalog ----
L = [f"# Tileset catalog — {task} (chipset atlas_biome_interior v5, 16px cells). The attached palette shows every piece with its exact id on a 16px grid (x2):",
     "#   yellow box = its footprint cells, red dot = the anchor cell you write as x,y, green ENTRY cells = must stay free floor.",
     "# Coordinates of a piece: (x,y) = its anchor = the TOP-LEFT cell of its footprint. A WxH footprint covers columns x..x+W-1 and rows y..y+H-1.",
     "# '+N up' = the art also rises N rows above the footprint (rows y-N..y-1); it does not block those cells, but keep other tall art out of them.",
     "", "## Floors (room floor materials). Give each room the floor that fits its use and vary floors between rooms — that is how rooms read as different, not rugs.",
     "id | looks like"]
for f in P["floors"]: L.append(f"floor:{f} | {FLOOR_EN.get(f, f)} (use '{f}')")
L += ["", "## Wall materials (the material of a wall's 2-row face)"] + [f"wall:{w} | use '{w}'" for w in P["walls"]]
ENT = []   # (category, id, short line, full line)
SHORT = {"hang": "wall_items, hangs on the upper face row (y = wall row + 1)", "wall": "wall_items, stands under a north wall's face (y = wall row + 3)",
         "flat": "objects, walkable decal", "floor": "objects"}
for o in objs:
    d = S["objects"][o]; up = rise(d.get("up"))
    if o in KIT:
        c, lift = KIT[o]
        if c["leads"] == "up":
            full = (f"{o} | KIT {c['w']}x{c['h']}: covers columns x..x+{c['w'] - 1}, rows y-2..y (the 2 face rows of a NORTH wall + the first floor row under it). Write (x,y) = the LEFT cell of its floor row, y = wall row + 3 "
                    f"| climbs into the wall | STAIRS UP -> 'wall_items' with the north wall it climbs; all {c['w']} columns must be under that same straight wall's face "
                    f"| ENTRY SIDE SOUTH: the {c['w']} cells (x..x+{c['w'] - 1}, y+1) must stay free walkable floor (no furniture, no wall) and connect to the room")
        else:
            full = (f"{o} | KIT {c['w']}x{c['h']}: covers x..x+{c['w'] - 1}, y..y+{c['h'] - 1} (a hole in the floor) | - | STAIRS DOWN -> 'objects' "
                    f"| ENTRY SIDE SOUTH: the {c['w']} cells (x..x+{c['w'] - 1}, y+{c['h']}) must stay free walkable floor")
        ENT.append(("stairs & doors", o, full, full)); continue
    if o in ("iron gate", "iron gate open", "locked door"):
        full = f"{o} | 1x1 | - | door leaf -> put it as \"piece\" on a door (or in a gap of a 'bars' rail as an object) | -"; ENT.append(("stairs & doors", o, full, full)); continue
    if d["kind"] == "hang":
        full = f"{o} | {d['w']} wide, on the 2 face rows | - | WALL-MOUNTED -> 'wall_items': (x,y) = top-left on the UPPER face row, y = wall row + 1 | -"
    elif d["kind"] == "wall":
        full = f"{o} | {d['w']}x{max(1, d['h'])} | {f'+{up} up' if up else '-'} | AGAINST-WALL -> 'wall_items': footprint starts on the first floor row under a north wall's face, y = wall row + 3 | from the south / sides"
    elif d["kind"] == "flat":
        full = f"{o} | {d['w']}x{max(1, d['h'])} | - | walkable floor decal -> 'objects' (counts as a rug if it is a rug or runner) | walk over it"
    else:
        full = f"{o} | {d['w']}x{max(1, d['h'])} | {f'+{up} up' if up else '-'} | floor piece -> 'objects' | from any free side"
    fp = f"{d['w']} wide" if d["kind"] == "hang" else f"{d['w']}x{max(1, d['h'])}"
    ENT.append((cat_of(o), o, f"{o} | {fp} | {SHORT[d['kind']]}", full))
for p in POOL:
    rule = {"hang": "WALL-MOUNTED -> 'wall_items', y = wall row + 1", "wall": "AGAINST-WALL -> 'wall_items', y = wall row + 3",
            "flat": "walkable decal -> 'objects'", "floor": "floor piece -> 'objects'"}[p["kind"]]
    fp = f"{p['w']} wide x {p['rows']} face rows" if p["kind"] == "hang" else f"{p['w']}x{max(1, p['h'])}"
    rs = f"+{p['up']} up" if p["up"] and p["kind"] in ("floor", "wall") else "-"
    br = (" — " + p["brief"][:160]) if p.get("brief") else ""
    ENT.append((pool_cat(p), p["id"], f"{p['id']} | {fp} | {SHORT[p['kind']]} | {p['name']}", f"{p['id']} | {fp} | {rs} | {rule} | {p['name']}{br}"))
ENT.sort(key=lambda e: (CAT_ORDER.index(e[0]), e[1]))
GROUPS = {}
for c, i, sh, fu in ENT: GROUPS.setdefault(c, []).append((i, sh, fu))
json.dump({c: [fu for _, _, fu in v] for c, v in GROUPS.items()}, open(f"{OUT}/detail-{task}.json", "w"), indent=1)
json.dump({i: c for c, v in GROUPS.items() for i, _, _ in v}, open(f"{OUT}/cats-{task}.json", "w"), indent=1)
L += ["", f"## Pieces by category ({len(ENT)} pieces). Short form: id | footprint WxH (anchor = top-left) | where it goes. Call find_pieces(category) for full rules, rise and descriptions of a category.",
      "Categories: " + ", ".join(f"{c} ({len(v)})" for c, v in GROUPS.items())]
for c, v in GROUPS.items():
    L += ["", f"### {c}"] + [sh for _, sh, _ in v]
L += ["", "## Sized pieces (any size, id with the size, in 'objects'; anchor = top-left)"]
for t in P["tables"]:
    one = S["tables"][t]["oneRow"]
    L.append(f"{t} WxH | W x H{' (H must be 1)' if one else ''} | floor table/counter, e.g. '{t} {'3x1' if one else '3x2'}'")
L.append(" / ".join(P["rugs"]) + " | any W x H rect | walkable carpet in 'carpets' — AT MOST 1 rug per room (2 in a hall of 150+ floor cells); round rug / runner count as rugs")
for l in P["lines"]:
    if l == "bars": L.append("bars | a path of floor cells | blocking iron-bar line in 'rails'; leave a 1-cell gap and put 'iron gate' there as an object to make a barred cell door")
    if l == "fence": L.append("fence | a path of floor cells | low wooden partition line (a half-wall) in 'rails' — can bound a zone inside a room (leave a 1-2 cell gap to walk in)")
    if l == "altar rail": L.append("altar rail | a path of floor cells | low carved balustrade (a half-wall) in 'rails' — fronts a raised platform, a gallery or a niche; leave a gap to walk through")
L += ["dais WxH wood|marble|stone | W x H (W>=2, H>=2) | RAISED PLATFORM in 'objects', e.g. 'dais 5x3 wood' (anchor = top-left). Walkable; its south row shows the step edge. Furniture may stand on it (a high table, a throne, a reading desk, a lectern). 'dais-w WxH marble|stone' = platform with steps on its west side"]
open(f"{OUT}/catalog-{task}.txt", "w").write("\n".join(L) + "\n")
print(task, len(cards), "cards,", len(POOL), "pool")
