# 버들항 v6 (100x100, 16px) as an editor tileset + map: cut the Python render (scripts/content/lib/city_v6/city6.py)
# into 16px cells and make every piece a tile of one bundled sheet.
#
#   python3 scripts/content/build-beodeul-city.py            (renders city6 into tiledata/beodeul-city/render/ first)
#   python3 scripts/content/build-beodeul-city.py --no-render (reuse the render there)
#
# Per cell: lower = the ground render (paving, water surface, terrain, bridge decks, ground kits) and upper = what the
# sorted objects (houses, castle, trees, props, overhangs, smoke, sails, boats) put on top of it, alpha 255 wherever the
# final frame differs from the ground. Both layers are computed for the 24-frame loop (city6_anim.frame); a cell whose
# sequence repeats with period p becomes p consecutive sheet cells + one animationStrip {baseTile, frames:p, fps:8}.
# Identical cells (and identical frame sequences) share one tile. Passability comes from the Python occupancy grid
# (city6_grid.json): road/plaza/walk/gate/bridge/stair/pier deck/grass are walkable, water/cliff/walls/houses/props/trees
# are blocked. The upper cells carry "star" (drawn over the player) only where the cell itself is walkable (an overhang).
#
# Outputs:
#   public/assets/beodeul-city/beodeul-city-chipset.png   the sheet (30 columns, bundled texture tex_beodeul_city)
#   src/assets/beodeulCitySheet.json                      {count, tilesPerRow} for bundled.ts frame registration
#   src/assets/beodeulCityTileset.json                    tileset parts (count, passability, priority, tileMeta, groups,
#                                                          autotiles, strips, structureKits) + the map (lower/upper)
#   tiledata/beodeul-city/map.json                         the map arrays, npc list, doors (for the save script)
#   tiledata/beodeul-city/kits.json                        district / building kits cut from the map (answer arrays)
import json, os, subprocess, sys, hashlib, pathlib, shutil
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "scripts/content/lib/city_v6"
DATA = ROOT / "tiledata/beodeul-city"
REND = DATA / "render"
SHEET_PNG = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_JSON = ROOT / "src/assets/beodeulCityTileset.json"
COLS = 128; T = 16; LOOP = 24; FPS = 8   # 128 columns keep the sheet under 4096 px (GPU texture limit)
TILESET_ID = "beodeul_city"

def run_render():
    REND.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, CITY6_OUT=str(REND), CITY6_NO_PEOPLE="1")
    subprocess.run([sys.executable, str(LIB / "city6.py")], cwd=LIB, env=env, check=True, stdout=subprocess.DEVNULL)
    # the reference picture (with the townsfolk drawn in) for the pixel diff
    env = dict(os.environ, CITY6_OUT="/tmp/beodeul-render-full")
    subprocess.run([sys.executable, str(LIB / "city6.py")], cwd=LIB, env=env, check=True, stdout=subprocess.DEVNULL)
    (DATA / "render-full").mkdir(exist_ok=True)
    shutil.copy("/tmp/beodeul-render-full/city6.png", DATA / "render-full/city6.png")      # only the picture is kept

if "--no-render" not in sys.argv: run_render()
sys.path.insert(0, str(LIB)); os.environ["CITY6_OUT"] = str(REND)
import palette; palette.apply()          # noqa: E402
import city6_anim                        # noqa: E402

grid = json.loads((REND / "city6_grid.json").read_text())
W, H = grid["W"], grid["H"]
occ, E, water = grid["occ"], grid["E"], grid["water"]
base = Image.open(REND / "city6_base.png").convert("RGBA")
ground = np.array(Image.open(REND / "city6_ground.png").convert("RGBA"))
meta = json.loads((REND / "city6_anim.json").read_text())

# ---- per-frame ground (the water surface moves) and upper (everything the objects add) ----
W0 = np.array(Image.open(REND / "anim/water_0.png")).astype(np.int32); surf = W0[..., 3] > 0
G = ground.astype(np.int32); K = np.array((0.52, 0.58, 0.74))
plain = surf & np.all(G[..., :3] == W0[..., :3], axis=2)
shd = surf & np.all(G[..., :3] == np.floor(W0[..., :3] * K).astype(np.int32), axis=2)
LOW = np.zeros((LOOP, H * T, W * T, 4), np.uint8); UP = np.zeros_like(LOW); FIN = np.zeros_like(LOW)
for f in range(LOOP):
    fin = np.array(city6_anim.frame(base, f, meta).convert("RGBA"))
    Wf = np.array(Image.open(REND / f"anim/water_{f % 8}.png"))
    g = ground.copy(); g[plain, :3] = Wf[plain, :3]; g[shd, :3] = np.floor(Wf[shd, :3] * K).astype(np.uint8)
    d = np.any(fin != g, axis=2)
    u = np.zeros_like(fin); u[d] = fin[d]; u[d, 3] = 255
    LOW[f], UP[f], FIN[f] = g, u, fin

def cellseq(A, x, y):
    return A[:, y * T:(y + 1) * T, x * T:(x + 1) * T]
def period(s):
    for p in (1, 2, 3, 4, 6, 8, 12, 24):
        if all((s[i] == s[i % p]).all() for i in range(LOOP)): return p
    return LOOP

# ---- occupancy → passability + labels ----
WALK = set(grid["walk"])
pier = set()
for px, py, pw, ph in grid["piers"]:
    for j in range(ph):
        for i in range(pw): pier.add((px + i, py + j))
doors = {(d[0], d[1]): d[2] for d in grid["doors"]}
def walkable(x, y):
    o = occ[y][x]
    if (x, y) in pier: return True
    if o in ("stair", "bridge", "gate", "walk"): return True       # stairs cut through a cliff face, bridges over water
    if o in WALK or o in ("rim", "ovh", None): return not water[y][x] and not grid["F"][y][x]
    return False
LEVEL_KO = {0: "항구 아랫마을", 1: "가운데 마을", 2: "언덕(저택·성당)", 3: "성 바위"}
def label_of(x, y):
    o = occ[y][x]
    if (x, y) in pier: return "잔교 널판", "pier"
    if (x, y) in doors: return "집 문", "door"
    m = {"road": ("길 포석", "road"), "plaza": ("광장·마당 판석", "plaza"), "walk": ("성벽길", "walk"), "gate": ("성문 통로", "gate"),
         "bridge": ("아치 다리 상판", "bridge"), "stair": ("돌계단", "stair"), "water": ("물", "water"), "cliff": ("절벽면·옹벽", "cliff"),
         "rim": ("절벽 가장자리 풀", "grass"), "wall": ("성벽", "wall"), "ewall": ("저택 담", "wall"), "fence": ("울타리·돌담", "fence"),
         "tree": ("나무·덤불", "tree"), "prop": ("소품", "prop"), "ovh": ("키 큰 물체 윗부분 밑 풀", "grass"), "obj": ("건물", "building"), None: ("풀밭", "grass")}
    return m.get(o, ("건물", "building"))

# ---- tiles ----
tiles = []          # list of (frames ndarray[p,16,16,4])
index = {}          # hash of frame sequence -> first tile id
strips = []
tmeta = []          # per sheet cell: dict
def add(seq, meta_):
    p = period(seq); s = seq[:p]
    # same pixels with a different layer or passability stay separate tiles (passability is per tile)
    key = hashlib.sha1(s.tobytes() + bytes([p]) + f"{meta_['layer']}{int(meta_['walk'])}".encode()).hexdigest()
    hit = index.get(key)
    if hit is not None: return hit
    tid = len(tiles)
    # an animation strip must stay on one sheet row (the strip frames are consecutive cells)
    if p > 1 and (tid % COLS) + p > COLS:
        while len(tiles) % COLS: tiles.append(np.zeros((T, T, 4), np.uint8)); tmeta.append(None)
        tid = len(tiles)
    for k in range(p): tiles.append(s[k]); tmeta.append(dict(meta_, frame=k, frames=p))
    if p > 1: strips.append(dict(baseTile=tid, frames=p, fps=FPS))
    index[key] = tid
    return tid

lower = [0] * (W * H); upper = [-1] * (W * H)
# tile 0 = a transparent cell (never used by the map): keeps the sheet's first cell empty like the other atlases
tiles.append(np.zeros((T, T, 4), np.uint8)); tmeta.append(None)
for y in range(H):
    for x in range(W):
        lab, kind = label_of(x, y)
        wk = walkable(x, y)
        lower[y * W + x] = add(cellseq(LOW, x, y), dict(layer="lower", label=lab, kind=kind, walk=wk, level=E[y][x], x=x, y=y))
        u = cellseq(UP, x, y)
        if u[..., 3].any():
            upper[y * W + x] = add(u, dict(layer="upper", label=lab, kind=kind, walk=wk, level=E[y][x], x=x, y=y))

# ---- clean pieces: every house / landmark / prop / tree as its own isolated sprite (transparent, no neighbours, no
#      baked shadow) cut into cells at its original sub-cell offset; bottom `foot` rows blocked, the rows above ★ ----
objects = json.loads((REND / "city6_objects.json").read_text())
props_meta = {p["id"]: p for p in json.loads((LIB / "meta.json").read_text())["props"]}
houses = json.loads((REND / "city6_houses.json").read_text())
house_by_name = {h["name"]: h for h in houses}
def piece(o, blocked, label, kind):
    # blocked: set of map cells the object claims in the original (its footprint); every other cell of the sprite is ★
    im = np.array(Image.open(REND / "objects" / f"{o['hash']}.png").convert("RGBA"))
    ox, oy = o["px"] % T, o["py"] % T
    cw, ch = -(-(ox + o["w"]) // T), -(-(oy + o["h"]) // T)
    can = np.zeros((ch * T, cw * T, 4), np.uint8); can[oy:oy + o["h"], ox:ox + o["w"]] = im
    X0, Y0 = o["px"] // T, o["py"] // T
    grid_ = []
    for j in range(ch):
        row = []
        for i in range(cw):
            c = can[j * T:(j + 1) * T, i * T:(i + 1) * T]
            if not c[..., 3].any(): row.append(-1); continue
            row.append(add(np.repeat(c[None], LOOP, 0), dict(layer="upper", label=label, kind=kind, walk=(X0 + i, Y0 + j) not in blocked, level=0, x=X0 + i, y=Y0 + j)))
        grid_.append(row)
    return grid_, X0, Y0
placed = json.loads((REND / "city6_placements.json").read_text())
def placed_cells(pid, o):
    # the PLACED footprint whose picture is this object (same px/py)
    for d in placed:
        if d["id"] == pid and d.get("px") == o["px"] and d.get("py") == o["py"]:
            return {(d["x"] + i, d["y"] + j) for j in range(d["h"]) for i in range(d["w"])}
    return {(o["px"] // T + i, (o["py"] + o["h"] - 1) // T) for i in range(-(-o["w"] // T))}
PIECES = []
seen_prop = {}
for o in objects:
    nm = o["name"]
    if nm in house_by_name:
        h = house_by_name[nm]
        g, x0, y0 = piece(o, {tuple(c) for c in h["cells"]}, "건물", "building")
        PIECES.append(("house", nm, g, x0, y0, h))
    elif nm in props_meta and nm not in seen_prop:
        pm = props_meta[nm]
        g, x0, y0 = piece(o, placed_cells(nm, o), "소품", "prop"); seen_prop[nm] = True
        PIECES.append(("prop", nm, g, x0, y0, pm))
    elif nm == "tree" and o["h"] >= 32 and ("tree", o["hash"]) not in seen_prop:
        seen_prop[("tree", o["hash"])] = True
        g, x0, y0 = piece(o, {(o["px"] // T + i, o["py"] // T + j) for j in range(o["h"] // T) for i in range(o["w"] // T)}, "나무", "tree")
        PIECES.append(("tree", o["hash"][:6], g, x0, y0, o))

# ---- v7 autotiles: 16 variants (N=1 E=2 S=4 W=8) for the street, the canal water and the sandy path, drawn by terrain7.py with the
#      functions that drew the city; identical pictures share the map's own tiles (add() de-duplicates on pixels+layer+walk) ----
import terrain7
SIDE_KO = {1: "북", 2: "동", 4: "남", 8: "서"}
def variant_name(m):
    con = "".join(SIDE_KO[b] for b in (1, 2, 4, 8) if m & b)
    return "사방 이어짐(몸통)" if m == 15 else ("외딴 한 칸" if m == 0 else f"{con}쪽으로 이어짐")
road_var = terrain7.road_variants(); water_var = terrain7.water_variants(); sand_var = terrain7.sand_variants()
def one(im): return np.repeat(np.array(im.convert("RGBA"))[None], LOOP, 0)
ROAD_IDS = {}; WATER_IDS = {}; SAND_IDS = {}
for m in range(16):
    ROAD_IDS[m] = add(one(road_var[m]), dict(layer="lower", label=f"길 포석 오토타일 · {variant_name(m)}", kind="road", walk=True, level=1, x=-1, y=-1))
for m in range(16):
    seq = np.stack([np.array(water_var[m][f % 8].convert("RGBA")) for f in range(LOOP)])
    WATER_IDS[m] = add(seq, dict(layer="lower", label=f"강·운하 물 오토타일 · {variant_name(m)}", kind="water", walk=False, level=1, x=-1, y=-1))
for m in range(16):
    SAND_IDS[m] = add(one(sand_var[m]), dict(layer="lower", label=f"모랫길 오토타일 · {variant_name(m)}", kind="sand", walk=True, level=1, x=-1, y=-1))

# ---- v7 kits drawn as parts (tiledata/beodeul-city/kits7): cut into cells, per-cell collision from the kit's walk grid ----
import kits7_common as K7
KITS7 = []
def cut_kit7(kid):
    spec, up, lo = K7.load_kit(kid); Wc, Hc = spec["w"], spec["h"]
    A = np.array(up); L = np.array(lo) if lo is not None else None
    rows_ = []; role_txt = {"X": "막힘", "C": "걸음(윗부분)", "F": "걸음(바닥)", ".": "비움"}
    for j in range(Hc):
        lo_row, up_row = [], []
        for i in range(Wc):
            ch = spec["walk"][j][i]
            cu = A[j * T:(j + 1) * T, i * T:(i + 1) * T]
            lo_id, up_id = -1, -1
            if L is not None:
                cl = L[j * T:(j + 1) * T, i * T:(i + 1) * T]
                if (cl[..., 3] == 255).all():
                    lo_kind = ("sand" if "sand" in kid else "plaza") if ch == "F" else "kit7"      # a walkable floor of a kit is paved ground (path, plaza, steps)
                    lo_id = add(np.repeat(cl[None], LOOP, 0), dict(layer="lower", label=spec["name"], kind=lo_kind, walk=(ch != "X"), level=1, x=-1, y=-1))
            if cu[..., 3].any():
                up_id = add(np.repeat(cu[None], LOOP, 0), dict(layer="upper", label=spec["name"], kind="kit7", walk=(ch in "CF"), level=1, x=-1, y=-1))
            lo_row.append(lo_id); up_row.append(up_id)
        rows_.append(dict(tiles=lo_row, upperTiles=up_row))
    return spec, rows_
for kid in K7.all_kits():
    try: KITS7.append((kid,) + cut_kit7(kid))
    except Exception as e: print("kits7", kid, "skipped:", e)

count = len(tiles)
rows = -(-count // COLS)
sheet = np.zeros((rows * T, COLS * T, 4), np.uint8)
for i, t in enumerate(tiles): sheet[(i // COLS) * T:(i // COLS + 1) * T, (i % COLS) * T:(i % COLS + 1) * T] = t
SHEET_PNG.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(sheet, "RGBA").save(SHEET_PNG, optimize=True)
count = rows * COLS
while len(tmeta) < count: tmeta.append(None)

# ---- per tile passability / priority / meta (a shared tile takes the most restrictive reading of its uses) ----
uses = {}
for y in range(H):
    for x in range(W):
        for layer, arr in (("lower", lower), ("upper", upper)):
            t = arr[y * W + x]
            if t < 0: continue
            uses.setdefault(t, []).append((x, y, layer))
OPEN = dict(up=True, down=True, left=True, right=True); SHUT = dict(up=False, down=False, left=False, right=False)
passability = []; priority = []; terrain = []; tileMeta = []
for t in range(count):
    m = tmeta[t]
    base_t = t
    if m and m["frame"]: base_t = t - m["frame"]
    us = uses.get(base_t, [])
    if not m:
        passability.append(dict(OPEN)); priority.append("lower"); terrain.append(0)
        tileMeta.append(dict(label="", description="", source="bundled-default")); continue
    wk = m["walk"]; layer = m["layer"]
    passability.append(dict(OPEN) if wk else dict(SHUT))
    # upper cells: walkable → ★ (drawn above the player, e.g. roof eaves over a street); blocked → solid, y-sorted
    priority.append("upper" if layer == "upper" else "lower")
    terrain.append(0)
    lvl = LEVEL_KO.get(m["level"], "")
    # compact per-cell meta (22k cells travel inside every project): the shared label/description of the cell's kind
    desc = f"버들항 v6 {lvl} {m['label']} ({'땅' if layer == 'lower' else '윗부분'})" + (f", 움직임 {m['frames']}프레임" if m["frames"] > 1 else "") + (", 걸음" if wk else ", 막힘")
    tileMeta.append(dict(label=f"버들항 · {m['label']}", description=desc, tags=["버들항", m["kind"]], defaultLayer=layer,
                         passage=("star" if (layer == "upper" and wk) else ("passable" if wk else "solid")), source="bundled-default"))

# ---- ground materials (flat fill groups) for fill_region / paint_tiles ----
def most_common(cells):
    from collections import Counter
    c = Counter(lower[y * W + x] for x, y in cells)
    return [t for t, _ in c.most_common(12)]
cells_of = {}
for y in range(H):
    for x in range(W):
        cells_of.setdefault(label_of(x, y)[1], []).append((x, y))
def group(gid, name, role, kind, desc, rule, layer="lower"):
    ids = most_common(cells_of.get(kind, []))
    return dict(id=f"beodeul:{gid}", name=name, role=role, source="bundled-default", tileIds=ids, defaultLayer=layer,
                confidence="high", description=desc, placementRules=rule)
def auto_group(gid, name, role, ids, desc, rule):
    order = [ids[15]] + [ids[m] for m in range(15)]
    return dict(id=f"beodeul:{gid}", name=name, role=role, source="bundled-default", tileIds=order, defaultLayer="lower",
                confidence="high", description=f"{desc} 대표 바디 {ids[15]}.", placementRules=rule)
tileGroups = [
    auto_group("paving", "버들항 길 포석", "path", ROAD_IDS, "버들항 거리의 회색 포석 **오토타일**(16변형: 이웃 길이 없는 쪽마다 연석 2px). 칠하면 가장자리·모서리가 저절로 맞는다.",
               "길 폭 1~2칸. fill_region·lay_path 로 깔면 연석이 자동으로 붙는다. 광장·다리·계단·성문과 닿는 쪽은 연석이 안 생긴다. 집 문 앞 칸과 이어 준다."),
    group("plaza", "버들항 광장 판석", "path", "plaza", "광장·성 마당·항구 광장의 판석.", "광장 면 전체에 깐다."),
    group("grass", "버들항 풀밭", "ground", "grass", "버들항 풀밭(잔디·밝은 풀·그늘 풀이 섞임).", "빈 땅."),
    auto_group("water", "버들항 물", "water", WATER_IDS, "버들항 강·운하 물 **오토타일**(16변형, 8프레임 움직임). 물 이웃이 없는 쪽마다 돌 둑 테두리와 그림자가 붙는다.",
               "지나갈 수 없다. 강·운하·호수 면. fill_region 으로 채우면 둑이 자동으로 맞는다. 다리·폭포와 닿는 쪽은 둑이 안 생긴다."),
    auto_group("sand", "버들항 모랫길", "path", SAND_IDS, "성 밖 외곽의 모랫길 **오토타일**(16변형: 길이 아닌 쪽마다 잔디 가장자리).",
               "성벽 밖 마을·우물 광장 사이. 폭 2칸 안팎. fill_region 또는 lay_path 로 깐다."),
]
# ---- autotile definitions (8-neighbourhood so lay_path accepts them; the picture depends on the 4 sides only) ----
def variant_map8():
    return {str(mask): (mask & 15) for mask in range(256)}
def vmap(ids): return {k: ids[v] for k, v in variant_map8().items()}
def tile_ids_of(kinds):
    return sorted({lower[y * W + x] for y in range(H) for x in range(W) if label_of(x, y)[1] in kinds})
ROAD_CONNECT = sorted(set(ROAD_IDS.values()) | set(tile_ids_of(("plaza", "bridge", "stair", "gate", "pier"))))
WATER_CONNECT = sorted(set(WATER_IDS.values()) | set(tile_ids_of(("water", "bridge"))))
SAND_CONNECT = sorted(set(SAND_IDS.values()) | set(ROAD_IDS.values()))
autotileGroups = [
    dict(id="beodeul_road_autotile", name="버들항 길 포석", neighborhood=8, memberTileIds=sorted(set(ROAD_IDS.values())), connectTileIds=ROAD_CONNECT,
         variantMap=vmap(ROAD_IDS), edgeConnects=True, outsideConnects=True),
    dict(id="beodeul_canal_lake_47", name="버들항 강·운하 물", neighborhood=8, memberTileIds=sorted(set(WATER_IDS.values())), connectTileIds=WATER_CONNECT,
         variantMap=vmap(WATER_IDS), edgeConnects=True, outsideConnects=True),
    dict(id="beodeul_sand_autotile", name="버들항 모랫길", neighborhood=8, memberTileIds=sorted(set(SAND_IDS.values())), connectTileIds=SAND_CONNECT,
         variantMap=vmap(SAND_IDS), edgeConnects=True, outsideConnects=True),
]
# ---- kits: every house / landmark footprint as a stampable structure kit (both layers, walkable fringe kept) ----
kits_src = json.loads((REND / "city6_kits.json").read_text())
def object_cells(o):
    return {(cx, cy) for cy in range(o["py"] // T, (o["py"] + o["h"] - 1) // T + 1) for cx in range(o["px"] // T, (o["px"] + o["w"] - 1) // T + 1)}
OBJ_CELLS = [object_cells(o) for o in objects if o["src"] != "ground"]
def cut_off(x0, y0, x1, y1):
    """cells inside the rect whose object (house, tree, prop, sign) reaches out of it: a kit must not carry half a building"""
    inside = {(x, y) for y in range(y0, y1) for x in range(x0, x1)}; drop = set()
    for cs in OBJ_CELLS:
        if cs & inside and not cs <= inside: drop |= cs & inside
    return drop
def kit_rect(name, x0, y0, x1, y1, desc, rule, tags, entrance=None, clip=False):
    drop = cut_off(x0, y0, x1, y1) if clip else set()
    gb = next(g for g in tileGroups if g["id"] == "beodeul:grass")["tileIds"][0]
    under_obj = set().union(*OBJ_CELLS) if drop else set()
    def lo_at(xx, yy):
        # a removed neighbour leaves its shadow on the ground render: lawn → the plain lawn tile; paving/plaza → the tile of the
        # nearest cell of the same kind that no object stands on (no shadow), inside the kit
        if (xx, yy) not in drop: return lower[yy * W + xx]
        kind_ = label_of(xx, yy)[1]
        if kind_ == "grass": return gb
        for r_ in range(1, 8):
            for dy_ in range(-r_, r_ + 1):
                for dx_ in (-r_, r_) if abs(dy_) != r_ else range(-r_, r_ + 1):
                    nx_, ny_ = xx + dx_, yy + dy_
                    if x0 <= nx_ < x1 and y0 <= ny_ < y1 and (nx_, ny_) not in drop and (nx_, ny_) not in under_obj and label_of(nx_, ny_)[1] == kind_:
                        return lower[ny_ * W + nx_]
        return lower[yy * W + xx]
    rows = [dict(tiles=[lo_at(xx, yy) for xx in range(x0, x1)], upperTiles=[(-1 if (xx, yy) in drop else upper[yy * W + xx]) for xx in range(x0, x1)]) for yy in range(y0, y1)]
    k = dict(id=name, kind="section", name=desc.split(" — ")[0], width=x1 - x0, height=y1 - y0, tileSize=16, rows=rows, learnedFrom="db-authored",
             ai=dict(description=desc, placementRules=rule, tags=["버들항"] + tags, role="building"))
    if entrance: k["parts"] = [dict(id="door", kind="entrance", dx=entrance[0] - x0, dy=entrance[1] - y0, w=1, h=1, note="문 칸 — 그 아래 칸이 문 앞 길")]
    return k
def kit_piece(kid, name, g, desc, rule, tags, role, entrance=None):
    k = dict(id=kid, kind="section", name=name, width=len(g[0]), height=len(g), tileSize=16,
             rows=[dict(tiles=[-1] * len(r), upperTiles=r) for r in g], learnedFrom="db-authored",
             ai=dict(description=desc, placementRules=rule, tags=["버들항"] + tags, role=role))
    if entrance: k["parts"] = [dict(id="door", kind="entrance", dx=entrance[0], dy=entrance[1], w=1, h=1, note="문 칸(윗부분 그림) — 문 칸 자체는 막힘, 그 아래 칸이 문 앞 길")]
    return k
KITS = []
TRADE_KO = {"fish": "생선 가게", "grocer": "청과상", "butcher": "푸줏간", "inn": "여관", "tailor": "재단사", "bakery": "빵집", "pharm": "약방",
            "jewel": "보석상", "books": "서점", "smith": "대장간"}
NAMED = {"cstable": "왕성 마구간", "smithy": "왕성 대장간", "barracks": "왕성 병영", "manor": "귀족 저택 본채", "estable": "저택 마차고",
         "lodge": "저택 문지기 집", "cafe": "포룸 카페", "mill1": "탑풍차 몸체(날개는 따로 움직임)", "cathedral": "첨탑 성당", "ware0": "항구 창고",
         "inn": "광장 여관", "smithy_town": "마을 대장간"}
for kind, nm, g, x0, y0, extra in PIECES:
    w, h = len(g[0]), len(g)
    if kind == "house":
        hs = extra; trade = hs.get("shop"); lvl = LEVEL_KO.get(hs["level"], "")
        title = NAMED.get(nm) or (f"{TRADE_KO.get(trade, trade)} 가게집" if trade else "살림집")
        door = (hs["door"][0] - x0, hs["door"][1] - y0)
        KITS.append(kit_piece(f"bd-house-{nm}", f"버들항 {title} {w}×{h}", g,
            f"버들항 {title} ({lvl}, 원본 {x0},{y0}). 투명 배경 윗부분 그림만 — 찍는 자리의 땅(아래층)은 그대로 둔다. 벽·문 줄은 막힘, 그 위 지붕 줄은 ★(사람 위에 그려짐).",
            "땅(풀·포석) 위에. 문 칸(parts.door) 바로 아래 칸이 길이어야 한다. 이웃 건물과 1칸 이상 띄우거나 벽을 맞댄다(지붕이 겹치지 않게).",
            ["house", trade or "home", lvl], "building", entrance=door))
    elif kind == "prop":
        pm = extra
        KITS.append(kit_piece(f"bd-prop-{nm}", f"버들항 소품 {pm['name_ko']} {w}×{h}", g,
            f"{pm['description_ko']} 윗부분 그림만(아래층 -1).", " · ".join(pm.get("placement_rules") or []),
            ["prop", pm.get("category", "")] + list(pm.get("tags") or []), "prop"))
    else:
        KITS.append(kit_piece(f"bd-tree-{nm}", f"버들항 나무 {w}×{h}", g, "버들항 활엽수·덤불·사이프러스(윗부분 그림만, 전 칸 막힘).",
            "풀밭 위. 길·문 앞 2칸에 두지 않는다. 같은 나무를 한 줄로 늘어세우지 않는다(v6 QA 결함).", ["tree"], "prop"))
DISTRICTS = [
    ("bd-castle", 0, 0, 33, 33, "버들항 왕성 — 성 바위 위 궁전·원탑 넷·성문루·도개교·해자·말굽 계단(3단 지형)", "맵 북서 구석처럼 뒤가 막힌 높은 땅. 도개교 아래로 길을 잇는다.", ["castle"]),
    ("bd-estate", 36, 2, 57, 24, "버들항 귀족 저택 — 회벽 저택·마구간·문지기 집·정원·담·쇠살문", "언덕(2단) 위. 문(44~45,22)에서 남쪽 길로 잇는다.", ["estate", "manor"]),
    ("bd-forum", 54, 34, 76, 48, "버들항 포룸 — 신전·주랑·분수·석상·노점·카페·아치 문", "가운데 마을 큰 광장. 사방 길이 광장에 닿는다.", ["forum", "plaza", "temple"]),
    ("bd-cathedral", 82, 3, 99, 25, "버들항 성당 언덕 — 첨탑 성당과 성당 앞 광장", "언덕 위. 계단(88,25)으로 아래 길과 잇는다.", ["cathedral", "church"]),
    ("bd-windmill", 1, 34, 13, 56, "버들항 풍차 들 — 큰 탑풍차(날개 움직임 8장)·밀밭·양배추밭", "마을 서쪽 가장자리 풀밭.", ["windmill", "farm"]),
    ("bd-harbour", 36, 62, 99, 100, "버들항 항구 — 항구 광장·창고·잔교 넷·계선주·기중기·배(움직임)·아치 다리 둘·호수", "맵 남쪽 물가. 잔교는 호숫가 산책길에 닿는다.", ["harbour", "pier", "port"]),
    ("bd-harbour-west", 0, 62, 36, 100, "버들항 서쪽 항구 마을 — 목조 가게 거리·잔교·물가", "맵 남서 물가.", ["harbour", "town"]),
    ("bd-river-bridge", 26, 24, 42, 44, "버들항 강·폭포·아치 다리 — 가운데 마을과 성 사이 강(33~36열), 폭포(33,27), 다리(33,33)", "강을 길이 건너는 곳에 다리 폭 4칸.", ["river", "bridge", "waterfall"]),
]
for kid, x0, y0, x1, y1, desc, rule, tags in DISTRICTS:
    KITS.append(kit_rect(kid, x0, y0, min(W, x1), min(H, y1), desc + f" {min(W, x1) - x0}×{min(H, y1) - y0}. 원본 ({x0},{y0}).", rule, tags,
                         clip=kid in ("bd-castle", "bd-estate", "bd-forum", "bd-cathedral", "bd-windmill")))
# v7: the river in pieces (the upper river 33..36 x 0..23 was in no kit at all): whole upper river, straight pieces, bends, waterfalls
RIVER_KITS = [
    ("bd-river-upper", 33, 0, 37, 24, "버들항 윗 강줄기 — 성벽 북문 틈에서 시작해 성 해자 옆을 지나 폭포 위까지 4칸 폭 물(둑·그림자 포함)", "물 4칸 폭. 위는 맵 가장자리, 아래는 bd-waterfall-drop 로 이어진다. 양쪽은 성 둑길과 저택 담이다.", ["river", "water", "source"]),
    ("bd-river-straight-ns", 33, 6, 37, 10, "버들항 곧은 강 조각(남북) 4×4 — 세로로 이어 찍는 재료", "물 4칸 폭. 세로로 몇 번이든 이어 찍는다(양옆에 강둑 땅·담이 필요하다). 끝은 폭포·굽이·다리로 마무리.", ["river", "water", "straight"]),
    ("bd-canal-straight-ew", 38, 38, 46, 42, "버들항 곧은 운하 조각(동서) 8×4 — 가로로 이어 찍는 재료", "물 4칸 폭. 가로로 이어 찍는다. 위쪽 둑은 돌 벽면(6px)이 붙는다.", ["river", "water", "straight", "canal"]),
    ("bd-river-bend-ns-ew", 33, 38, 37, 42, "버들항 강 굽이 — 남북 강이 동쪽 운하로 꺾이는 4×4", "북쪽에서 내려온 강이 동쪽으로 꺾인다.", ["river", "water", "bend"]),
    ("bd-canal-bend-ew-ns", 47, 38, 51, 42, "버들항 강 굽이 — 동서 운하가 남쪽 강으로 꺾이는 4×4", "서쪽에서 온 운하가 남쪽으로 꺾인다.", ["river", "water", "bend"]),
    ("bd-bridge-arch", 33, 32, 37, 37, "버들항 강 위 아치 다리 — 폭 4칸 갑판(2줄)에 양쪽 난간, 남쪽 면에 아치 둘과 물깎이 4×5", "남북으로 흐르는 4칸 폭 강을 동서 큰길이 건널 때. 갑판 2줄(위에서 둘째·셋째 줄)이 길 두 줄과 맞아야 한다. 강 위·아래는 강 조각(bd-river-straight-ns)으로 이어 준다.", ["bridge", "river", "arch"]),
    ("bd-harbour-lake", 9, 85, 92, 100, "버들항 호수 항구 — 남쪽 호수(자연 둑·갈대), 물가 산책길(포석 두 줄), 잔교 넷, 계선주, 배(움직임), 강 하구의 아치 다리 83×15", "맵 남쪽 가장자리. 위 줄(산책길)에 큰길이 닿고, 강은 키트 위 줄의 물 칸(원점에서 38~41칸째)으로 들어온다. 집·도로는 이 위에 새로 깐다.", ["harbour", "lake", "pier", "port"]),
    ("bd-harbour-square", 59, 66, 71, 77, "버들항 항구 광장 — 생선 노점·닻 전시대·그물 건조대·분수(물고기 연못)가 있는 포석 광장 12×11", "부두에서 가까운 큰길 옆. 광장 가장자리에 길이 닿는다.", ["harbour", "plaza", "market"]),
    ("bd-waterfall-drop", 29, 26, 41, 33, "버들항 폭포(위 단 → 가운데 단) — 강이 3칸 절벽 아래로 떨어지고 물웅덩이로 이어짐 12×7", "위 강(4칸 폭)을 이 폭포 위에서 받고, 아래는 웅덩이 강으로 이어진다. 양옆은 바위 절벽면·풀 가장자리 칸이 구워져 있다. 폭포 위 강의 물 칸은 키트 맨 위에서 원점 기준 4~7칸째다.", ["waterfall", "river", "cliff"]),
    ("bd-waterfall-wall", 43, 59, 55, 68, "버들항 폭포(가운데 단 → 항구 단) — 석축 옹벽을 넘는 폭포 12×9", "가운데 마을과 항구 사이 석축 옹벽 위에 폭포. 아래 물은 항구 대로 옆 강으로 이어진다.", ["waterfall", "river", "wall"]),
]
for kid, x0, y0, x1, y1, desc, rule, tags in RIVER_KITS:
    k = kit_rect(kid, x0, y0, x1, y1, desc + f" {x1 - x0}×{y1 - y0}. 원본 ({x0},{y0}).", rule, tags, clip=True)
    k["ai"]["role"] = "water" if kid.startswith(("bd-river", "bd-canal", "bd-water", "bd-bridge")) else "terrain"; KITS.append(k)
def kit7_struct(kid, spec, rows_):
    role = {"building": "building", "part": "building", "prop": "prop", "garden": "terrain", "district": "building"}[spec["role"]]
    asm = ""
    if spec.get("assembly"): asm = " 조립: " + ", ".join(f"{a['kit']} @({a['x']},{a['y']})" for a in spec["assembly"]) + "."
    door = spec["doors"][0] if spec["doors"] else None
    k = dict(id=kid, kind="section", name=spec["name"], width=spec["w"], height=spec["h"], tileSize=16, rows=rows_, learnedFrom="db-authored",
             ai=dict(description=spec["description"] + asm, placementRules=spec["rules"], tags=["버들항", "v7"] + list(spec["tags"]), role=role))
    if spec["doors"]:
        k["parts"] = [dict(id="door" if i == 0 else f"door{i + 1}", kind="entrance", dx=d["dx"], dy=d["dy"], w=1, h=1, note=d["note"] + " — 그 아래 칸이 문 앞") for i, d in enumerate(spec["doors"])]
    return k
for kid, spec, rows_ in KITS7: KITS.append(kit7_struct(kid, spec, rows_))
# v7 QA: a district kit stamped on open lawn must not carry its neighbour's ground. The castle's rim columns (x=0, x=32) are the town
# wall walk that continues to the next district → lawn; its moat ends in the river at both sides → close the moat ends with the
# water autotile's end variants (bank on the open side). The estate's west column (x=36) is the upper river → lawn.
def trim_kit(kid, fn):
    k = next(k for k in KITS if k["id"] == kid)
    for j, r in enumerate(k["rows"]):
        for i in range(k["width"]):
            v = fn(i, j, r["tiles"][i], r["upperTiles"][i])
            if v is not None: r["tiles"][i], r["upperTiles"][i] = v
_gbk = next(g for g in tileGroups if g["id"] == "beodeul:grass")["tileIds"][0]
def _is_water_kit(k, i, j): return 0 <= i < k["width"] and 0 <= j < k["height"] and water[j][i]
def castle_fix(i, j, lo, up):
    if i == 32 and j <= 22: return (_gbk, -1)                    # east rim: the town wall walk
    if i == 0 and occ[j][0] == "wall": return (_gbk, -1)          # west rim: the map-edge town wall
    end = 1 if i == 1 else 32 if i == 32 else None                # the moat's two open ends → closed water ends
    if end is not None and water[j][i]:
        m = (1 if j > 0 and water[j - 1][i] else 0) | (4 if j + 1 < 33 and water[j + 1][i] else 0) | (8 if i == 32 else 2)
        return (WATER_IDS[m], -1)
    return None
trim_kit("bd-castle", castle_fix)
trim_kit("bd-estate", lambda i, j, lo, up: (_gbk, -1) if i == 0 and water[2 + j][36] else None)
# v7: ground variety. The flat material fill (one grass tile) looks dead; the city's own lawn is a noise mix of lawn / meadow /
# flower cells. The city has no 6x6 window of open lawn (738 open cells, all in slivers), so the patches are composed: the lower
# tiles of open lawn cells with no tree / object / water within one cell (no shade grass) are dealt out by a fixed PRNG into six
# 6x6 patches with cut corners (-1 = keep what is under it, so the outline is not a square).
def lawn_pool():
    # open lawn and tree-ground cells whose own picture is as bright as the flat lawn (no shade grass: mean green within 10 of it)
    gb_ = next(g for g in tileGroups if g["id"] == "beodeul:grass")["tileIds"][0]
    ref = tiles[gb_][..., :3].reshape(-1, 3).mean(0)
    pool = []
    for y in range(H):
        for x in range(W):
            if occ[y][x] not in (None, "tree") or upper[y * W + x] >= 0 or water[y][x] or grid["F"][y][x]: continue
            t_ = lower[y * W + x]; px = tiles[t_]
            if px.ndim != 3 or px[..., 3].min() < 255: continue
            q = px[..., :3].reshape(-1, 3).astype(int); m_ = q.mean(0)
            # no brown / dark specks (fence feet, path crumbs, shadow edges): every pixel stays green and not much darker than the lawn
            if (q[:, 1] - q[:, 0] < 40).any() or (q[:, 1] < ref[1] - 45).any(): continue
            # a few specks only: a dense tuft cell reads as a square block when dealt out cell by cell
            off = (np.abs(q - tiles[gb_][..., :3].reshape(-1, 3).astype(int)).sum(1) > 30).sum()
            offm = (np.abs(px[..., :3].astype(int) - tiles[gb_][..., :3].astype(int)).sum(2) > 30)
            dash = any(offm[r_, c_:c_ + 4].all() for r_ in range(16) for c_ in range(13))   # a straight dark dash is a fence foot, not grass
            if abs(m_[1] - ref[1]) <= 8 and abs(m_[0] - ref[0]) <= 8 and 4 <= off <= 40 and not dash: pool.append(t_)
    return pool
_pool = lawn_pool(); _rs = np.random.default_rng(71)
_gb = next(g for g in tileGroups if g["id"] == "beodeul:grass")["tileIds"][0]
_CUT = {(0, 0), (5, 0), (0, 5), (5, 5), (1, 0), (0, 1)}
for k_ in range(1, 7):
    rows_ = []
    for j in range(6):
        row = []
        for i in range(6):
            if (i, j) in _CUT or (5 - i, j) in _CUT and k_ % 2 or (i, 5 - j) in _CUT and k_ % 3 == 0: row.append(-1)
            else: row.append(int(_pool[int(_rs.integers(len(_pool)))]) if _pool and _rs.random() < 0.45 else _gb)
        rows_.append(dict(tiles=row, upperTiles=[-1] * 6))
    KITS.append(dict(id=f"bd-ground-lawn-{k_}", kind="section", name=f"버들항 잔디 무늬 조각 {k_} 6×6", width=6, height=6, tileSize=16, learnedFrom="db-authored",
        rows=rows_,
        ai=dict(description=f"버들항 잔디 무늬(원본 풀밭의 밝은 풀·들풀·꽃잎 칸을 섞은 6×6 땅, 모서리는 비어 윤곽이 네모가 아니다). 아래층만 — 빈 땅이 납작한 한 가지 잔디로 죽어 보이지 않게 흩어 찍는다.",
                placementRules="빈 풀밭 위에 겹쳐 찍는다(길·물·건물 자리는 피한다). 빈 칸(-1)은 밑 땅을 그대로 둔다. 한 곳에 뭉치지 말고 10칸 안팎으로 띄워 흩는다.", tags=["버들항", "ground", "lawn"], role="terrain")))
print("lawn pool", len(_pool), "distinct", len(set(_pool)))
# no whole-city kit: the assistant composes a town from the district and house kits (the full map is the saved canon)
# ---- NPCs ----
people = json.loads((REND / "city6_people.json").read_text())
out = dict(
    id=TILESET_ID, name="버들항 v6 · 로마풍 항구 도시 (손 도트)", textureKey="tex_beodeul_city",
    image="assets/beodeul-city/beodeul-city-chipset.png", tileSize=T, tilesPerRow=COLS, count=count,
    passability=passability, priority=priority, terrain=terrain, tileMeta=tileMeta, tileGroups=tileGroups,
    animationStrips=strips, structureKits=KITS, autotileGroups=autotileGroups, family="easyrpg",
)
TS_JSON.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
# sheet geometry for bundled.ts (kept apart so the frame registry does not import the 6 MB definition)
(ROOT / "src/assets/beodeulCitySheet.json").write_text(json.dumps(dict(count=count, tilesPerRow=COLS)) + "\n")
DATA.mkdir(parents=True, exist_ok=True)
(DATA / "map.json").write_text(json.dumps(dict(width=W, height=H, lowerTiles=lower, upperTiles=upper, people=people, doors=grid["doors"],
    stairs=grid["stairs"], bridges=grid["bridges"], piers=grid["piers"], walkable=[[walkable(x, y) for x in range(W)] for y in range(H)]), separators=(",", ":")))
stats = dict(tiles=count, used=len(tiles), strips=len(strips), sheet=[COLS * T, rows * T], kits=len(KITS),
             upperCells=sum(1 for t in upper if t >= 0), walkableCells=sum(1 for y in range(H) for x in range(W) if walkable(x, y)))
(DATA / "build-stats.json").write_text(json.dumps(stats, indent=1) + "\n")
print(json.dumps(stats))
