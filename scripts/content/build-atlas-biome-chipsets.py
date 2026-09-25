# Bake the atlas biome sheets (tiledata/atlas-biomes): eleven new tilesets, each the diverse forest-village sheet
# (forest_harmony + every graft, 2730 cells) repainted for one biome plus drawn blocks of its own:
#     0..2729   the forest-village cells, repainted (same numbers, same passage and layers as forest_harmony)
#  2730..2867   frozen copies of the water cells (taiga, tundra; same order as the snow climate sheet)
#  2880..3029   leafless trees (badlands, tundra, blight; bare-trees.py slots, the biome's own wood colours)
#  3030..       the biome's drawn pieces (lib/atlas_pieces.py), then its blob grounds (47 + 2 cells each), then the
#               border block: the neighbour biome's lawn as a blob ground, neighbour twin pieces and re-grounded copies
#               of the road / shore / cliff / stair / trunk cells whose lawn pixels show the neighbour's lawn.
# Usage: python3 scripts/content/build-atlas-biome-chipsets.py [biome,biome]
#   → public/assets/atlas-biomes/<biome>-chipset.png + tiledata/atlas-biomes/sheets.json
import json, pathlib, sys, importlib.util
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/content/lib"))
import atlas_recolor as R
from atlas_biome_specs import BIOMES, NEIGHBOUR
from atlas_pieces import PIECES, neighbour_pieces
import atlas_ground as G
import atlas_art as A

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
tall_grass = load("tall_grass_redraw", "scripts/content/tiles/tall-grass-redraw.py")
bare_trees = load("bare_trees", "scripts/content/bare-trees.py")

N = R.N; COLS = 30; ICE0 = N; BARE0 = bare_trees.FIRST; ART0 = 3030
CLIMATE = json.loads((ROOT / "tiledata/climate-villages/sheets.json").read_text())
assert [s for s, _ in CLIMATE["snow"]["ice"]] == R.WATER, "water cell order differs from the snow climate sheet"
BARE_LAYOUT = CLIMATE["bareTrees"]["stamps"]

only = sys.argv[1].split(",") if len(sys.argv) > 1 else list(BIOMES)
base = R.bake()
BASE_A = np.array(base)
GRASS = R.grass_mask(BASE_A.astype(np.float32))

_sheets = {}
def biome_sheet(k):
    """Repainted 2730-cell sheet of a biome ('forest' = the pristine forest village), leaf-filled, tall grass redrawn."""
    if k in _sheets: return _sheets[k]
    if k == "forest":
        im = R.leaves(base.copy())
    else:
        spec = BIOMES[k]
        tall_grass.CLIMATE_RAMPS[k] = spec["grass"]
        im = R.leaves(tall_grass.paint_sheet(R.repaint(base, spec), k))
    _sheets[k] = im
    return im

def cell(img, t):
    x, y = R.box(t); return np.array(img.crop((x, y, x + 16, y + 16))).astype(np.float32)

def paste(sheet, t, arr):
    a = arr.copy(); a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    x, y = R.box(t); sheet.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), (x, y))

# Base cells that carry lawn pixels and may stand in a border zone: road, lake/river shore, cliff, stairs, falls and
# bridges, the lower (trunk / bush) cells of the tree stamps, the lawn textures.
KIT_TREE_LOWER = set()
for x, w, h, cells in [(14, 4, 5, ["CCCC", "CCCC", "CCCC", "eTTe", ".TT."]), (18, 3, 4, ["CCC", "CCC", "eTe", "eTe"]), (21, 2, 4, ["CC", "CC", "TT", "TT"]),
                       (23, 3, 3, ["TTT", "TTT", "TTT"]), (23, 2, 2, ["TT", "TT"])]:
    small = (w, h) == (2, 2)
    for dy, row in enumerate(cells):
        for dx, c in enumerate(row):
            if c in "eT": KIT_TREE_LOWER.add(960 + ((dy + 3) if small else dy) * 30 + x + dx)
TWIN_CANDIDATES = sorted(set(range(1470, 1564)) | set(range(2670, 2692)) | {111, 112, 113, 2700, 2701, 2702} | KIT_TREE_LOWER
                         | set(range(1140, 1148)) | {241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332})

def bare_palette(k, spec):
    b = spec.get("bare")
    if not b: return None
    if isinstance(b, str): return b
    bare_trees.PAL[k] = b; bare_trees.PALETTE[k] = k
    return k

def pack(pieces, row0):
    """Shelf-pack pieces into 30 columns from row0 → {id: (col, row)} and the next free row."""
    col = 0; row = row0; shelf = 0; pos = {}
    for p in pieces:
        if col + p["w"] > COLS: row += shelf; col = 0; shelf = 0
        pos[p["id"]] = (col, row); col += p["w"]; shelf = max(shelf, p["h"])
    return pos, row + shelf

def build(k):
    spec = BIOMES[k]
    sheet0 = biome_sheet(k)
    lawn = cell(sheet0, 240)
    nb = NEIGHBOUR.get(k)
    pieces = [dict(p) for p in PIECES[k]]
    # the biome's own cave mouth: its cliff face texture (the front face body, cell 2683) around a dark arch
    face = cell(sheet0, 2683)
    pieces.append(dict(id="cave-mouth", name="절벽 동굴 입구", w=2, h=2, roles=["VV", "VV"], paint=lambda face=face: A.cave_mouth(face), cat="cliff",
                       rule="절벽 동굴 입구: 절벽 몸통 칸(윗단 가장자리 줄 밑, 높이 4 이상인 곳) 2×2 를 그대로 덮는다(위층, 지나갈 수 없다). 입구 앞 절벽 밑 칸이 접근 칸이다. 계단·폭포에서 5칸 밖."))
    npieces = neighbour_pieces(nb) if nb else []
    pos, next_row = pack(pieces + npieces, ART0 // COLS)
    ground_defs = G.grounds(k, lawn, cell(biome_sheet(nb), 240) if nb else None)
    blob_rows = {}
    row = next_row
    for gid in ground_defs:
        blob_rows[gid] = row; row += 2   # 49 cells in two rows (30 + 19)
    twin_row = row
    twins = []
    if nb:
        nbs = biome_sheet(nb)
        for t in TWIN_CANDIDATES:
            x, y = R.box(t)
            if GRASS[y:y + 16, x:x + 16].any(): twins.append(t)
        row += (len(twins) + COLS - 1) // COLS
    count = row * COLS
    out = Image.new("RGBA", (COLS * 16, row * 16), (0, 0, 0, 0))
    out.paste(sheet0.crop((0, 0, 480, (N + COLS - 1) // COLS * 16)), (0, 0))
    manifest = dict(biome=k, name=spec["name"], tag=spec["tag"], textureKey=f"tex_atlas_biome_{k}", count=count, neighbour=nb)
    # ice copies
    if spec.get("ice"):
        grown = Image.new("RGBA", (480, (ICE0 + len(R.WATER) + COLS - 1) // COLS * 16), (0, 0, 0, 0)); grown.paste(out.crop((0, 0, 480, grown.height)), (0, 0))
        grown = R.freeze(grown, R.WATER, ICE0)
        out.paste(grown, (0, 0))
        manifest["ice"] = [[s, ICE0 + n] for n, s in enumerate(R.WATER)]
    # leafless trees
    pal = bare_palette(k, spec)
    if pal:
        assert [dict(id=s["id"], tiles=s["tiles"]) for s in bare_trees.layout()] == [dict(id=s["id"], tiles=s["tiles"]) for s in BARE_LAYOUT], "bare tree layout drifted"
        bt = bare_trees.bake(out.crop((0, 0, 480, BARE0 // COLS * 16)), pal)
        block = bt.crop((0, BARE0 // COLS * 16, 480, ART0 // COLS * 16))
        if spec.get("bareGlow"):
            a = np.array(block).astype(np.float32); Am = a[..., 3] > 0
            rng = np.random.RandomState(7)
            glow = (rng.rand(*Am.shape) < 0.03) & Am & (a[..., :3].sum(-1) > 60)
            a[glow, :3] = (176, 74, 224)
            block = Image.fromarray(a.astype(np.uint8))
        out.paste(block, (0, BARE0 // COLS * 16))
        manifest["bare"] = pal
    # drawn pieces
    stamps = []
    for p in pieces + npieces:
        arr = p["paint"]()
        assert arr.shape[:2] == (p["h"] * 16, p["w"] * 16), p["id"]
        c0, r0 = pos[p["id"]]
        tiles, roles = [], []
        for dy in range(p["h"]):
            for dx in range(p["w"]):
                sub = arr[dy * 16:dy * 16 + 16, dx * 16:dx * 16 + 16].copy()
                role = p["roles"][dy][dx]
                n_px = int((sub[..., 3] > 127).sum())
                t = (r0 + dy) * COLS + c0 + dx
                if role == "." or n_px < 6: tiles.append(-1); roles.append("."); continue
                if role == "b":   # baked onto the neighbour lawn: opaque
                    nl = cell(biome_sheet(nb), 240).copy(); m = sub[..., 3] > 127; nl[m] = sub[m]; sub = nl
                paste(out, t, sub); tiles.append(t); roles.append(role)
        stamps.append(dict(id=p["id"], name=p["name"], w=p["w"], h=p["h"], cat=p["cat"], rule=p["rule"], tiles=tiles, roles=roles, col=c0, row=r0,
                           **({"neighbour": p["neighbour"]} if p.get("neighbour") else {})))
    manifest["pieces"] = stamps
    # blob grounds
    blobs = {}
    for gid, (kind, name, kw) in ground_defs.items():
        r0 = blob_rows[gid]; tiles = {}
        glawn = lawn
        for n, (m, arr) in enumerate(G.blob_set(glawn, **kw)):
            t = r0 * COLS + n; paste(out, t, arr); tiles[m] = t
        vm = {str(m): tiles[G.canon(m)] for m in range(256)}
        blobs[gid] = dict(name=name, kind=kind, variantMap=vm, body=tiles[255], interior=[tiles["b1"], tiles["b2"]],
                          members=sorted(set(vm.values()) | {tiles["b1"], tiles["b2"]}), row=r0)
    manifest["blobs"] = blobs
    # re-grounded twins of the base cells (border zone)
    if nb:
        nbs = np.array(biome_sheet(nb)).astype(np.float32); prim = np.array(sheet0).astype(np.float32)
        pairs = []
        for n, t in enumerate(twins):
            x, y = R.box(t); g = GRASS[y:y + 16, x:x + 16]
            arr = np.where(g[..., None], nbs[y:y + 16, x:x + 16], prim[y:y + 16, x:x + 16])
            dst = twin_row * COLS + n; paste(out, dst, arr); pairs.append([t, dst])
        manifest["twins"] = pairs
    assert out.height // 16 * COLS == count
    dst = ROOT / "public/assets/atlas-biomes"; dst.mkdir(parents=True, exist_ok=True)
    out.save(dst / f"{k}-chipset.png", optimize=True)
    return manifest

man_path = ROOT / "tiledata/atlas-biomes/sheets.json"
man = json.loads(man_path.read_text()) if man_path.exists() else {}
man.setdefault("biomes", {})
man["source"] = "tiledata/forest-villages/diverse/catalog.json"; man["baseCount"] = N; man["water"] = R.WATER
man["bareTrees"] = {"first": BARE0, "stamps": BARE_LAYOUT}
for k in only:
    m = build(k)
    man["biomes"][k] = m
    print(k, {"count": m["count"], "pieces": len(m["pieces"]), "blobs": list(m["blobs"]), "twins": len(m.get("twins", [])), "ice": bool(m.get("ice")), "bare": m.get("bare")})
man["biomes"] = {k: man["biomes"][k] for k in BIOMES if k in man["biomes"]}
man_path.parent.mkdir(parents=True, exist_ok=True)
man_path.write_text(json.dumps(man, ensure_ascii=False) + "\n")
