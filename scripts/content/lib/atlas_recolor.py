# Biome repaints of the baked forest-village sheet (forest_harmony + every graft, 2730 cells) for tiledata/atlas-biomes.
# Same idea as build-climate-chipsets.py: tile numbers stay, only pixels change. Tile classes (ground, foliage, water,
# cliff earth, roofs) come from the authored villages and the tileset's own groups, never from colour guesses alone.
# Used by scripts/content/build-atlas-biome-chipsets.py.
import json, re, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/content/lib"))
import canopy_leaves

cat = json.load(open(ROOT / "tiledata/forest-villages/diverse/catalog.json"))
TS = cat["tileset"]; N = TS["count"]
TEX = dict(re.findall(r'textureKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"', (ROOT / "src/assets/bundled.ts").read_text()))
GRAFT = {g["targetTile"]: g for g in TS["tileGrafts"]}
_sheets = {}

def sheet(key):
    if key not in _sheets: _sheets[key] = Image.open(ROOT / "public" / TEX[key]).convert("RGBA")
    return _sheets[key]

FLAT_CANOPY = dict(zip(range(2550, 2597), canopy_leaves.flat_tiles()))

def tile_img(t):
    if t in FLAT_CANOPY: return FLAT_CANOPY[t]
    g = GRAFT.get(t)
    key, src = (g["sourceChipset"], g["sourceTile"]) if g else (TS["image"]["id"], t)
    sh = sheet(key); per = sh.width // 16
    return sh.crop(((src % per) * 16, (src // per) * 16, (src % per) * 16 + 16, (src // per) * 16 + 16))

def box(t): return (t % 30) * 16, (t // 30) * 16

def bake(count=N):
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
        x, y = box(t)
        if y < shape[0]: m[y:y + 16, x:x + 16] = True
    return m

L = set(); U = set()
for m in cat["maps"].values():
    L |= {t for t in m["lowerTiles"] if t >= 0}; U |= {t for t in m["upperTiles"] if t >= 0}
TREE = set(range(960, 1110)) | {t for t, g in GRAFT.items() if g["sourceChipset"] == "tex_forest_harmony" and 960 <= g["sourceTile"] < 1110}
WATER = set()
for g in TS["autotileGroups"]:
    if "lake" in g["id"] or "water" in g["id"]: WATER |= set(g["variantMap"].values()) | set(g["memberTileIds"])
WATER |= {t for t, mt in enumerate(TS["tileMeta"]) if (mt or {}).get("role") == "water"}
WATER |= {t for t, g in GRAFT.items() if g["sourceChipset"] == "tex_easyrpg_chipset_world"}
WATER = sorted(t for t in WATER if t < N)
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
GROVE = set(range(2550, 2597))
TRUNKS = {1350} | set(range(1422, 1434)) | set(range(1453, 1464))
FOLIAGE = TREE | GROVE | TRUNKS | {768, 289}
BACKING = {int(m["layerBacking"]) for m in TS["tileMeta"] if str((m or {}).get("layerBacking", "")).isdigit()}
STONES = {2649, 2650}
CLIFF = {2670 + k for k in range(22)} | {18, 19, 48, 49, 78, 79, 80, 108, 110, 138, 139, 140, 171, 172, 173, 201, 202, 203, 231, 232}
# Cliff faces actually used by the village cliff grammar (the bindings), for the badlands strata.
CLIFF_FACE = CLIFF | {int(v) for v in cat.get("cliffBindings", {}).values() if isinstance(v, int)}

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
    backed = (tile_mask(A.shape, BACKING - TREE) | tile_mask(A.shape, CLIFF | set(WATER) | STONES)) & greenish
    bright = bright | (backed & (V > 0.5)); shadow = shadow | (backed & (V <= 0.5) & (V > 0.2))
    return dict(H=H, S=S, V=V, A=A, strict=strict, greenish=greenish, tree=tree, bright=bright, shadow=shadow)

def ramp(stops, t):
    """stops [(t, (r,g,b))...] → colours for an array t in [0,1]."""
    t = np.clip(t, 0, 1); out = np.zeros(t.shape + (3,), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1)
        f = ((t - t0) / max(1e-6, t1 - t0))[..., None]
        out[m] = (np.array(c0, np.float32) + (np.array(c1, np.float32) - np.array(c0, np.float32)) * f)[m]
    return out

def grass_mask(a):
    """Pixels that are lawn in the pristine green bake (for the neighbour re-grounded copies)."""
    c = classes(a); foliage = tile_mask(c["A"].shape, FOLIAGE) & c["A"]
    return (c["bright"] & (~foliage | c["strict"])) | c["shadow"]

def repaint(baked, spec):
    """Biome repaint: ground (lawn + shadow), foliage (trees, canopy, trunks' shade, bushes), water, cliff earth, roofs."""
    a = np.array(baked).astype(np.float32); out = a.copy()
    c = classes(a); H, S, V, A = c["H"], c["S"], c["V"], c["A"]
    foliage = tile_mask(A.shape, FOLIAGE) & A
    g = spec["ground"]
    v = np.clip((V - 0.5) / 0.35, 0, 1)
    lawn = c["bright"] & (~foliage | c["strict"])
    out[..., :3][lawn] = ramp(g["bright"], v)[lawn]
    vs = np.clip((V - 0.2) / 0.3, 0, 1)
    out[..., :3][c["shadow"]] = ramp(g["shadow"], vs)[c["shadow"]]
    # Foliage: every green leaf pixel of the trees, canopy, trunks' shade and bushes by brightness.
    leaf = foliage & A & (H >= 60) & (H <= 175) & (S > 0.2) & ~lawn
    lv = np.clip(V / 0.62, 0, 1)
    out[..., :3][leaf] = ramp(spec["foliage"], lv)[leaf]
    # Loose leafy pieces outside the tree block (vines, potted plants) follow the foliage too when asked.
    if spec.get("allGreen"):
        other_leaf = A & c["greenish"] & ~lawn & ~leaf & ~c["shadow"] & ~tile_mask(A.shape, set(WATER))
        out[..., :3][other_leaf] = ramp(spec["foliage"], lv)[other_leaf]
    w = spec.get("water")
    if w:
        water = tile_mask(A.shape, WATER) & A & (H >= 175) & (H <= 250) & (S > 0.3)
        wv = np.clip((V - 0.3) / 0.55, 0, 1)
        out[..., :3][water] = ramp(w, wv)[water]
        if spec.get("waterFoam"):
            # foam / highlight pixels (near white, bluish) keep their lightness in the new hue
            foam = tile_mask(A.shape, WATER) & A & (S <= 0.3) & (V > 0.7) & (H >= 150) & (H <= 260)
            out[..., :3][foam] = ramp(spec["waterFoam"], np.clip((V - 0.7) / 0.3, 0, 1))[foam]
    e = spec.get("earth")
    if e:
        earth = tile_mask(A.shape, CLIFF) & A & (H >= 5) & (H <= 50) & (S > 0.18)
        col = ramp(e, np.clip(V / 0.8, 0, 1))
        if spec.get("strata"):
            # horizontal strata: bands every 5-6 px alternate lighter / darker (red rock layers)
            yy = np.arange(A.shape[0])[:, None] + np.zeros(A.shape[1])[None, :]
            band = ((yy // 3) % 4 == 1)[..., None]
            col = np.where(band, col * 0.82, col * 1.04)
        out[..., :3][earth] = col[earth]
    r = spec.get("roof")
    if r:
        roof = tile_mask(A.shape, ROOF) & A & ~c["greenish"]
        clay = ramp(r, V)
        out[..., :3][roof] = (out[..., :3] * 0.35 + clay * 0.65)[roof]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def freeze(img, sources, base, ice=((0, (150, 186, 214)), (1, (232, 244, 252)))):
    """Frozen copies of the water tiles (same order as the snow climate sheet): open water → pale cracked ice."""
    a = np.array(img).astype(np.float32)
    H, S, V = hsv(a); A = a[..., 3] > 0
    water = A & (H >= 150) & (H <= 290) & (S > 0.15)
    for k, t in enumerate(sources):
        sx, sy = box(t); tx, ty = box(base + k)
        tile = a[sy:sy + 16, sx:sx + 16].copy(); wm = water[sy:sy + 16, sx:sx + 16]; v = V[sy:sy + 16, sx:sx + 16]
        iv = np.clip((v - 0.2) / 0.6, 0, 1)
        col = ramp(ice, iv)
        yy, xx = np.mgrid[0:16, 0:16]
        crack = ((xx + 2 * yy + 3 * (t % 5)) % 23 == 0) & (iv < 0.7)
        col[crack] = (120, 156, 190)
        tile[..., :3][wm] = col[wm]
        a[ty:ty + 16, tx:tx + 16] = tile
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

_grove = next(g for g in TS["autotileGroups"] if g["id"] == "forest_harmony_grove_47")
_tiers = canopy_leaves.CANOPY["interior"]["tiers"]
_slot = dict(zip(_tiers[0] + _tiers[1], _grove["interiorVariants"][0] + _grove["interiorVariants"][1]))
INTERIOR = [_slot[47 + k] for k in range(len(canopy_leaves.INTERIOR))]
MASKS = canopy_leaves.flat_masks()
def leaves(img): return canopy_leaves.bake(img, list(range(2550, 2597)), INTERIOR, masks=MASKS)
