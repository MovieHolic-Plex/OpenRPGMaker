# Harbor kit sheet for forest-village harbors: rowboats, mooring posts, rope, anchor, barrels, crates (and the parts of
# a moored sailing ship). Exact pixels from two sources, packed on a 16px grid — no scaling, no repainting; the only
# change is the EasyRPG ship chipset's colour key (#ff678b) turned into real transparency so the pieces can be grafted
# onto forest_harmony (grafts do not carry the source tileset's key).
#   - rowboat: LPC farming/fishing by Daniel Eddeland (CC-BY-SA 3.0), public/assets/castle-surroundings/sources/farming_fishing.png
#   - posts, rope, anchor, barrels, crates, ship: EasyRPG ship chipset (CC0), public/assets/easyrpg-chipset-ship-transparent.png
# Usage: python3 scripts/content/build-harbor-kit.py   (writes public/assets/harbor-kit/harbor-kit.png + parts.json)
import hashlib, json, pathlib
from PIL import Image

ROOT = pathlib.Path.cwd()
OUT = ROOT / "public/assets/harbor-kit"
LPC = ROOT / "public/assets/castle-surroundings/sources/farming_fishing.png"
SHIP = ROOT / "public/assets/easyrpg-chipset-ship-transparent.png"
KEY = (255, 103, 139)
COLS = 16

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
lpc = Image.open(LPC).convert("RGBA")
ship = Image.open(SHIP).convert("RGBA")

def keyed(img):
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if (r, g, b) == KEY: px[x, y] = (0, 0, 0, 0)
    return img

parts, cells = {}, []  # cells: (kit tile index, image)
def put(name, label, source, tiles, w, h, license, sourceRect):
    start = len(cells)
    for k, im in enumerate(tiles): cells.append(im)
    # Fully transparent cells (outside a hull) are listed so a map leaves them empty.
    empty = [k for k, im in enumerate(tiles) if im.getchannel("A").getextrema()[1] == 0]
    parts[name] = {"label": label, "w": w, "h": h, "tiles": list(range(start, start + len(tiles))), "empty": empty,
                   "source": source, "sourceRect": sourceRect, "license": license}

# Rowboat, bow to the left: 8×4 cells of the LPC sheet at (224,448).
boat = lpc.crop((224, 448, 224 + 128, 448 + 64))
put("rowboat", "나룻배", "farming_fishing.png (LPC, Daniel Eddeland)",
    [boat.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)) for y in range(4) for x in range(8)], 8, 4, "CC-BY-SA 3.0", [224, 448, 128, 64])
def ship_tile(t): return keyed(ship.crop(((t % 30) * 16, (t // 30) * 16, (t % 30) * 16 + 16, (t // 30) * 16 + 16)).copy())
for name, label, t in [("post", "계류 말뚝", 329), ("rope", "감긴 밧줄", 263), ("anchor", "닻", 259),
                       ("barrel", "오크통", 385), ("crate", "나무 상자", 379), ("openBarrel", "열린 통", 415)]:
    put(name, label, "easyrpg-chipset-ship (EasyRPG, CC0) tile %d" % t, [ship_tile(t)], 1, 1, "CC0", [(t % 30) * 16, (t // 30) * 16, 16, 16])

rows = (len(cells) + COLS - 1) // COLS
sheet = Image.new("RGBA", (COLS * 16, rows * 16), (0, 0, 0, 0))
for k, im in enumerate(cells): sheet.paste(im, ((k % COLS) * 16, (k // COLS) * 16))
OUT.mkdir(parents=True, exist_ok=True)
sheet.save(OUT / "harbor-kit.png", optimize=True)
json.dump({"tileSize": 16, "columns": COLS, "count": len(cells), "parts": parts,
           "sources": {"farming_fishing.png": sha(LPC), "easyrpg-chipset-ship-transparent.png": sha(SHIP)}},
          open(OUT / "parts.json", "w"), ensure_ascii=False, indent=1)
print({"tiles": len(cells), "parts": list(parts)})
