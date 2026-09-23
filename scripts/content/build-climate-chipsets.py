# Bake the diverse forest-village tileset (sheet + every graft) into one 30-column sheet and repaint it per climate.
# Tile numbers stay identical to forest_harmony; only pixels change. Snow appends frozen copies of the water tiles.
# Usage: python3 scripts/content/build-climate-chipsets.py   (writes public/assets/climate-villages/*.png + tiledata/climate-villages/sheets.json)
# Climates: snow, volcano, desert (sand, sandstone cliffs, dry scrub, oasis water), autumn (gold grass, autumn leaves).
import json, re, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path.cwd()
cat = json.load(open(ROOT / "tiledata/forest-villages/diverse/catalog.json"))
TS = cat["tileset"]; N = TS["count"]
TEX = dict(re.findall(r'textureKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"', (ROOT / "src/assets/bundled.ts").read_text()))
GRAFT = {g["targetTile"]: g for g in TS["tileGrafts"]}
_sheets = {}

def sheet(key):
    if key not in _sheets: _sheets[key] = Image.open(ROOT / "public" / TEX[key]).convert("RGBA")
    return _sheets[key]

def tile_img(t):
    g = GRAFT.get(t)
    key, src = (g["sourceChipset"], g["sourceTile"]) if g else (TS["image"]["id"], t)
    sh = sheet(key); per = sh.width // 16
    return sh.crop(((src % per) * 16, (src // per) * 16, (src % per) * 16 + 16, (src // per) * 16 + 16))

def box(t): return (t % 30) * 16, (t // 30) * 16

def bake(count):
    sh = Image.new("RGBA", (480, (count + 29) // 30 * 16), (0, 0, 0, 0))
    for t in range(N): sh.paste(tile_img(t), box(t))
    return sh

def hsv(a):
    f = a[..., :3] / 255; mx = f.max(-1); mn = f.min(-1); d = mx - mn + 1e-6
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, np.where(mx > 0, d / (mx + 1e-6), 0), mx

def tile_mask(shape, tiles):
    m = np.zeros(shape, bool)
    for t in tiles:
        x, y = box(t); m[y:y + 16, x:x + 16] = True
    return m

# Tile classes come from the authored villages, not from colour guesses.
L = set(); U = set()
for m in cat["maps"].values():
    L |= {t for t in m["lowerTiles"] if t >= 0}; U |= {t for t in m["upperTiles"] if t >= 0}
TREE = set(range(960, 1110)) | {t for t, g in GRAFT.items() if g["sourceChipset"] == "tex_forest_harmony" and 960 <= g["sourceTile"] < 1110}
# Colour cannot tell water from blue roofs or castle slate, so water is the authored water tile set.
WATER = set()
for g in TS["autotileGroups"]:
    if "lake" in g["id"] or "water" in g["id"]: WATER |= set(g["variantMap"].values()) | set(g["memberTileIds"])
WATER |= {t for t, mt in enumerate(TS["tileMeta"]) if (mt or {}).get("role") == "water"}
WATER |= {t for t, g in GRAFT.items() if g["sourceChipset"] == "tex_easyrpg_chipset_world"}
WATER = sorted(t for t in WATER if t < N)
# Roofs: whatever sits in the upper 45% rows of every authored house footprint.
ROOF = set()
for p in cat["plans"]:
    mm = cat["maps"][p["id"]]
    for h in p["houses"]:
        for dy in range(max(1, int(h["h"] * 0.45))):
            for dx in range(h["w"]):
                i = (h["y"] + dy) * mm["width"] + h["x"] + dx
                for lay in ("lowerTiles", "upperTiles"):
                    v = mm[lay][i]
                    if v >= 0 and v != 240: ROOF.add(v)
BRIDGES = [t for t, mt in enumerate(TS["tileMeta"]) if "나무다리" in ((mt or {}).get("label") or "")]

def classes(a):
    H, S, V = hsv(a); A = a[..., 3] > 0
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    strict = (R >= 76) & (R <= 128) & (G >= 148) & (G <= 188) & (B >= 62) & (B <= 90) & (G - R > 45)
    greenish = A & (H >= 65) & (H <= 150) & (S > 0.25)
    tree = tile_mask(A.shape, TREE)
    ground = tile_mask(A.shape, L - TREE) & ~tree
    other = ~tree & ~ground
    light = greenish & (V > 0.55)
    bright = strict | (greenish & ground & (V > 0.5)) | (light & other)
    shadow = greenish & ground & (V <= 0.5) & (V > 0.2) & ~strict
    return H, S, V, A, strict, greenish, tree, other, bright, shadow

def snow(sheet):
    a = np.array(sheet).astype(np.float32); out = a.copy()
    H, S, V, A, strict, greenish, tree, other, bright, shadow = classes(a)
    v = np.clip((V - 0.5) / 0.35, 0, 1)
    out[..., :3][bright] = np.stack([222 + 26 * v, 231 + 19 * v, 240 + 12 * v], -1)[bright]
    vs = np.clip((V - 0.2) / 0.3, 0, 1)
    out[..., :3][shadow] = np.stack([118 + 84 * vs, 132 + 80 * vs, 158 + 68 * vs], -1)[shadow]
    # Snow caps: in each tree column that starts transparent, the first leaves under the outline turn white.
    for t in TREE:
        if t >= N: continue
        x, y = box(t)
        for dx in range(16):
            col = A[y:y + 16, x + dx]
            if col[0] or not col.any(): continue
            n = 0
            for yy in range(int(np.argmax(col)), 16):
                if n >= 4 or not A[y + yy, x + dx]: break
                if greenish[y + yy, x + dx] and not strict[y + yy, x + dx]:
                    out[y + yy, x + dx, :3] = (244, 248, 252) if n < 3 else (206, 220, 236); n += 1
                elif n: break
    roof = tile_mask(A.shape, ROOF) & A & ~greenish
    rs = roof & (V > 0.5); out[..., :3][rs] = out[..., :3][rs] * 0.18 + np.array([236, 242, 250]) * 0.82
    rd = roof & (V > 0.3) & (V <= 0.5); out[..., :3][rd] = out[..., :3][rd] * 0.55 + np.array([150, 165, 190]) * 0.45
    # Snow settles on the lit side of every leaf clump and on any leaf edge that faces open sky.
    frost = tree & greenish & (V > 0.42) & ~strict
    out[..., :3][frost] = out[..., :3][frost] * 0.25 + np.array([228, 238, 248]) * 0.75
    sky = np.zeros_like(A); sky[1:] = ~A[:-1]; sky[::16] = False
    ledge = tree & greenish & ~strict & sky
    out[..., :3][ledge] = (240, 246, 252)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def freeze(sheet, sources, base):
    """Frozen copies of the water tiles: open water becomes pale cracked ice, shores keep their snow."""
    a = np.array(sheet).astype(np.float32)
    H, S, V = hsv(a); A = a[..., 3] > 0
    water = A & (H >= 175) & (H <= 250) & (S > 0.3)
    for k, t in enumerate(sources):
        sx, sy = box(t); tx, ty = box(base + k)
        tile = a[sy:sy + 16, sx:sx + 16].copy(); w = water[sy:sy + 16, sx:sx + 16]; v = V[sy:sy + 16, sx:sx + 16]
        iv = np.clip((v - 0.25) / 0.6, 0, 1)
        ice = np.stack([168 + 70 * iv, 198 + 48 * iv, 222 + 30 * iv], -1)
        # thin diagonal cracks keep the surface readable as ice rather than snow
        yy, xx = np.mgrid[0:16, 0:16]
        crack = ((xx + 2 * yy + 3 * (t % 5)) % 23 == 0) & (iv < 0.7)
        ice[crack] = (132, 168, 200)
        tile[..., :3][w] = ice[w]
        a[ty:ty + 16, tx:tx + 16] = tile
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def volcano(sheet):
    a = np.array(sheet).astype(np.float32); out = a.copy()
    H, S, V, A, strict, greenish, tree, other, bright, shadow = classes(a)
    v = np.clip((V - 0.5) / 0.35, 0, 1)
    out[..., :3][bright] = np.stack([86 + 34 * v, 78 + 30 * v, 74 + 26 * v], -1)[bright]
    vs = np.clip((V - 0.2) / 0.3, 0, 1)
    out[..., :3][shadow] = np.stack([44 + 36 * vs, 38 + 32 * vs, 36 + 30 * vs], -1)[shadow]
    # Charred canopy: leaves lose their green.
    leaf = (tree | other) & greenish & ~bright
    lv = np.clip(V / 0.6, 0, 1)
    out[..., :3][leaf] = np.stack([34 + 46 * lv, 30 + 36 * lv, 30 + 30 * lv], -1)[leaf]
    # Water tiles become lava: brightness drives yellow → orange → deep red.
    water = tile_mask(A.shape, WATER) & A & (H >= 175) & (H <= 250) & (S > 0.3)
    wv = np.clip((V - 0.3) / 0.55, 0, 1)
    out[..., :3][water] = np.stack([90 + 165 * wv ** 0.7, 18 + 200 * wv ** 2.2, 8 + 80 * wv ** 4], -1)[water]
    soot = A & (V < 0.22) & (H >= 90) & (H <= 180) & ~water
    out[..., :3][soot] = np.stack([22 + 40 * V, 19 + 36 * V, 19 + 36 * V], -1)[soot]
    # Wooden bridges would burn over lava: repaint their planks as basalt.
    wood = tile_mask(A.shape, BRIDGES) & A & (H >= 5) & (H <= 55) & (S > 0.2)
    out[..., :3][wood] = np.stack([48 + 96 * V, 46 + 92 * V, 50 + 96 * V], -1)[wood]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

# Desert and autumn repaint the forest itself as well as the ground, so they also need the canopy (grove grafts),
# the forest trunk assemblies and the grass drawn underneath through layerBacking.
GROVE = set(range(2550, 2597))
# Forest trunk assemblies (forestTrunkTiles.ts): their shade is the forest's dark green.
TRUNKS = {1350} | set(range(1422, 1434)) | set(range(1453, 1464))
# 768 (flowering bush) and 289 (bush) are foliage too; the cactus 769 and palm 770 stay green on purpose.
FOLIAGE = TREE | GROVE | TRUNKS | {768, 289}
# Grass drawn under trunks and roads through layerBacking (1141, 1145, 240 …) is ground as well.
BACKING = {int(m["layerBacking"]) for m in TS["tileMeta"] if str((m or {}).get("layerBacking", "")).isdigit()}
STONES = {2649, 2650}  # stepping stones 징검돌 sit in grass
CLIFF = {2670 + k for k in range(22)} | {18, 19, 48, 49, 78, 79, 80, 108, 110, 138, 139, 140, 171, 172, 173, 201, 202, 203, 231, 232}

def ground_classes(a):
    H, S, V, A, strict, greenish, tree, other, bright, shadow = classes(a)
    # Grass under trunks/roads (layerBacking) and the grass tufts on cliff rims, lake shores and stepping stones are ground too.
    backed = (tile_mask(A.shape, BACKING - TREE) | tile_mask(A.shape, CLIFF | set(WATER) | STONES)) & greenish
    return H, S, V, A, strict, greenish, bright | (backed & (V > 0.5)), shadow | (backed & (V <= 0.5) & (V > 0.2))

def desert(sheet):
    a = np.array(sheet).astype(np.float32); out = a.copy()
    H, S, V, A, strict, greenish, bright, shadow = ground_classes(a)
    foliage = tile_mask(A.shape, FOLIAGE) & A
    v = np.clip((V - 0.5) / 0.35, 0, 1)
    sand = bright & (~foliage | strict)
    out[..., :3][sand] = np.stack([214 + 32 * v, 186 + 32 * v, 124 + 34 * v], -1)[sand]
    vs = np.clip((V - 0.2) / 0.3, 0, 1)
    out[..., :3][shadow] = np.stack([150 + 58 * vs, 118 + 60 * vs, 74 + 48 * vs], -1)[shadow]
    # Dry scrub: leaves turn khaki above and dark umber in the shade.
    leaf = foliage & A & (H >= 60) & (H <= 175) & (S > 0.2) & ~sand
    lv = np.clip(V / 0.62, 0, 1)
    out[..., :3][leaf] = np.stack([52 + 118 * lv ** 1.2, 42 + 100 * lv ** 1.2, 24 + 42 * lv ** 1.4], -1)[leaf]
    # Sandstone: brown earth of the cliffs warms to ochre.
    earth = tile_mask(A.shape, CLIFF) & A & (H >= 5) & (H <= 50) & (S > 0.18)
    out[..., :3][earth] = np.stack([20 + 400 * V, 10 + 290 * V, 8 + 150 * V], -1)[earth]
    # Roofs: sun-baked clay.
    roof = tile_mask(A.shape, ROOF) & A & ~greenish
    clay = np.stack([70 + 180 * V, 40 + 120 * V, 26 + 70 * V], -1)
    out[..., :3][roof] = (out[..., :3] * 0.35 + clay * 0.65)[roof]
    # Oasis water: a shade greener.
    water = tile_mask(A.shape, WATER) & A & (H >= 175) & (H <= 250) & (S > 0.3)
    out[..., 1][water] = np.clip(out[..., 1] * 1.18 + 12, 0, 255)[water]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def autumn(sheet):
    a = np.array(sheet).astype(np.float32); out = a.copy()
    H, S, V, A, strict, greenish, bright, shadow = ground_classes(a)
    foliage = tile_mask(A.shape, FOLIAGE) & A
    v = np.clip((V - 0.5) / 0.35, 0, 1)
    ground = bright & (~foliage | strict)
    out[..., :3][ground] = np.stack([150 + 50 * v, 150 + 40 * v, 66 + 24 * v], -1)[ground]
    vs = np.clip((V - 0.2) / 0.3, 0, 1)
    out[..., :3][shadow] = np.stack([88 + 60 * vs, 84 + 58 * vs, 38 + 30 * vs], -1)[shadow]
    # Foliage: shade → maroon, mid → orange, light → gold. Free-standing broadleaf trees go gold, bushes crimson.
    leaf = foliage & A & (H >= 60) & (H <= 175) & (S > 0.2) & ~ground
    lv = np.clip(V / 0.62, 0, 1)
    fall = np.stack([34 + 216 * lv ** 1.4, 18 + 150 * lv ** 1.9, 14 + 36 * lv ** 2.5], -1)
    gold = np.stack([90 + 160 * lv ** 0.8, 50 + 170 * lv ** 1.3, 10 + 50 * lv ** 2], -1)
    red = np.stack([70 + 150 * lv ** 1.1, 24 + 66 * lv ** 1.6, 18 + 26 * lv ** 2], -1)
    out[..., :3][leaf] = fall[leaf]
    g = tile_mask(A.shape, {978, 979, 980, 1008, 1009, 1010}) & leaf
    out[..., :3][g] = gold[g]
    r = tile_mask(A.shape, {983, 984, 985, 1013, 1014, 1015, 1043, 1044, 1045, 1073, 1074, 1103, 1104}) & leaf
    out[..., :3][r] = red[r]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

baked = bake(N + len(WATER))
out_dir = ROOT / "public/assets/climate-villages"; out_dir.mkdir(parents=True, exist_ok=True)
snowy = freeze(snow(baked), WATER, N)
snowy.save(out_dir / "snow-chipset.png", optimize=True)
volcano(baked).crop((0, 0, 480, (N + 29) // 30 * 16)).save(out_dir / "volcano-chipset.png", optimize=True)
desert(baked).crop((0, 0, 480, (N + 29) // 30 * 16)).save(out_dir / "desert-chipset.png", optimize=True)
autumn(baked).crop((0, 0, 480, (N + 29) // 30 * 16)).save(out_dir / "autumn-chipset.png", optimize=True)
manifest = {
    "source": "tiledata/forest-villages/diverse/catalog.json",
    "baseCount": N,
    "snow": {"count": N + len(WATER), "ice": [[t, N + k] for k, t in enumerate(WATER)]},
    "volcano": {"count": N, "lava": WATER, "stoneBridges": BRIDGES},
    "desert": {"count": N, "sandstone": sorted(CLIFF)},
    "autumn": {"count": N},
    "roofTiles": sorted(ROOF),
}
pathlib.Path(ROOT / "tiledata/climate-villages").mkdir(parents=True, exist_ok=True)
(ROOT / "tiledata/climate-villages/sheets.json").write_text(json.dumps(manifest, ensure_ascii=False) + "\n")
print({"snow": manifest["snow"]["count"], "volcano": N, "desert": N, "autumn": N, "water": len(WATER), "bridges": BRIDGES, "roofs": len(ROOF)})
