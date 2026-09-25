# World sheet of tiledata/atlas-biomes: the bundled EasyRPG world sheet (easyrpg-chipset-world-transparent.png, tiles
# 0..479 unchanged) plus the new biomes as world terrain and icons, so continent / archipelago / regional maps can show
# jungle, mushroom forest, blighted forest, taiga, crystal hills, red canyon hills, savanna, tundra, swamp and crystal
# plain next to the stock grass, sea, forest, mountains, snow and desert.
#   rows 16..19 (480..599): ten 3×4 terrain blocks, each a repaint of a stock block (same layout: isolated, inner, 3×3
#                           frame — the world terrain autotile grammar of worldTerrainAutotiles.ts). Only the terrain
#                           pixels are repainted; the grass around the blob (flood-filled from the outer sides) stays
#                           the stock grass, so a block meets plain grass like the stock blocks do.
#   rows 20..21 (600..659): 2×2 icons drawn for the new biomes (lib/atlas_art.py, the same pieces as the field sheets).
#   rows 22..25 (660..779): the red-earth block (badlands ground, a repaint of the stock sand block).
# Writes public/assets/atlas-biomes/world-chipset.png and src/assets/atlasBiomeWorldSheet.json (blocks, icons).
# Usage: python3 scripts/content/build-atlas-biome-world.py
import json, pathlib, sys
import numpy as np
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/content/lib"))
import atlas_art as A
from atlas_pixel import C

COLS = 30
src = np.array(Image.open(ROOT / "public/assets/easyrpg-chipset-world-transparent.png").convert("RGBA"))
assert src.shape[:2] == (256, 480)
ROWS = 26
out = np.zeros((ROWS * 16, 480, 4), np.uint8); out[:256] = src
def box(t): r, c = divmod(t, COLS); return r * 16, c * 16
def cell(a, t): y, x = box(t); return a[y:y + 16, x:x + 16]
GRASS = {tuple(p[:3]) for t in (240, 241, 242, 270, 271, 272, 300, 301, 302) for p in cell(src, t).reshape(-1, 4) if p[3] > 0}

# role offsets of a block (anchor-relative) and the tile sides that face outside the blob
SIDES = {0: "NESW", 2: "corners", 30: "NW", 31: "N", 32: "NE", 60: "W", 61: "", 62: "E", 90: "SW", 91: "S", 92: "SE"}
def background(tile, off):
    """Mask of stock-grass pixels flood-filled from the tile's outer sides (the grass around the terrain blob)."""
    g = np.array([[tuple(p[:3]) in GRASS and p[3] > 0 for p in row] for row in tile])
    side = SIDES[off]
    seeds = []
    if side == "corners": seeds = [(0, 0), (0, 15), (15, 0), (15, 15)]
    for s in side if side != "corners" else "":
        if s == "N": seeds += [(0, x) for x in range(16)]
        if s == "S": seeds += [(15, x) for x in range(16)]
        if s == "W": seeds += [(y, 0) for y in range(16)]
        if s == "E": seeds += [(y, 15) for y in range(16)]
    m = np.zeros((16, 16), bool); st = [p for p in seeds if g[p]]
    for p in st: m[p] = True
    while st:
        y, x = st.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            Y, X = y + dy, x + dx
            if 0 <= Y < 16 and 0 <= X < 16 and g[Y, X] and not m[Y, X]: m[Y, X] = True; st.append((Y, X))
    return m

def ramp(stops):
    cs = [C(s) for s in stops]
    def f(t):
        t = min(0.999, max(0.0, t)) * (len(cs) - 1); k = int(t); u = t - k
        return cs[k] * (1 - u) + cs[min(k + 1, len(cs) - 1)] * u
    return f

# (key, name, source anchor, ramp, solid)
BLOCKS = [
    ("jungle", "우림", 360, ["0a2016", "12402a", "1e6a3a", "3a9a4a", "86d870"], True),
    ("mushroom-forest", "버섯 숲", 360, ["1a1034", "3a2674", "6a46b0", "a878dc", "f0b8f4"], True),
    ("blight-forest", "오염된 숲", 360, ["0c0612", "261430", "4a2a58", "76488a", "a888bc"], True),
    ("taiga", "타이가 가문비 숲", 360, ["081818", "12302e", "1c4a42", "36705c", "7ea890"], True),
    ("crystal-hills", "수정 언덕", 363, ["26204a", "46468a", "7676c4", "a6b6ec", "eaf6ff"], True),
    ("red-canyon", "붉은 협곡 언덕", 363, ["34120a", "742a12", "b45026", "e08448", "f8c48c"], True),
    ("savanna", "사바나 초원", 243, ["54400e", "86661e", "b8983a", "dcc462", "f4e6a0"], False),
    ("tundra", "툰드라 이끼 들", 243, ["3a382a", "5a563e", "7c7858", "a4a080", "d0ccac"], False),
    ("swamp", "늪", 126, ["141c0c", "2a3618", "485828", "6e803e", "a4b674"], True),
    ("crystal-plain", "수정 벌판", 129, ["504a7a", "7a74a6", "a6a2cc", "cccaee", "f2f0ff"], False),
    ("red-earth", "붉은 흙벌", 9, ["6a2a12", "9a4422", "c06434", "d88850", "f0b07a"], False),
]
blocks = []
for k, (key, name, anchor, stops, solid) in enumerate(BLOCKS):
    na = 480 + 3 * k if k < 10 else 660 + 3 * (k - 10)   # rows 16..19, then rows 22..25
    f = ramp(stops)
    # luminance range of the terrain pixels of the whole source block
    tiles = {}
    for off in SIDES:
        t = cell(src, anchor + off).astype(np.float32)
        tiles[off] = (t, background(t.astype(np.uint8), off))
    Ls = np.concatenate([((t[..., :3] @ np.array([0.3, 0.59, 0.11]))[(~bg) & (t[..., 3] > 0)]) for t, bg in tiles.values()])
    lo, hi = np.percentile(Ls, 2), np.percentile(Ls, 98)
    for off, (t, bg) in tiles.items():
        o = t.copy()
        L = (t[..., :3] @ np.array([0.3, 0.59, 0.11]) - lo) / max(1, hi - lo)
        for y in range(16):
            for x in range(16):
                if t[y, x, 3] > 0 and not bg[y, x]: o[y, x, :3] = f(L[y, x])
        Y, X = box(na + off); out[Y:Y + 16, X:X + 16] = o.astype(np.uint8)
    blocks.append(dict(key=key, name=name, anchor=na, source=anchor, solid=solid))

# icons (2×2, transparent, upper layer)
ICONS = [
    ("giant-mushroom", "거대 버섯", lambda: A.giant_mushroom(2, 2, 1, "red")),
    ("crystal-spire", "수정 첨탑", lambda: A.crystals(2, 2, 5, "cyan", 3)),
    ("sky-island", "떠 있는 섬", lambda: A.float_rock(2, 2, 1)),
    ("acacia", "아카시아", lambda: A.acacia(2, 2, 1)),
    ("mangrove", "맹그로브", lambda: A.mangrove(2, 2, 1)),
    ("dead-tree", "붉은 땅 고목", lambda: A.dead_tree(2, 2, 1, "acacia")),
    ("blight-tree", "오염된 고목", lambda: A.dead_tree(2, 2, 2, "blight", C("c060ff"))),
    ("palm", "야자수", lambda: A.palm(2, 2, 1)),
    ("spruce", "가문비", lambda: A.spruce(2, 2, 1)),
    ("giant-tree", "우림 거목", lambda: A.giant_tree(2, 2, 1)),
    ("obelisk-mark", "흑요석 탑", lambda: A.obelisk(1)),
]
icons = []
col = 0
for key, name, paint in ICONS:
    a = np.clip(paint(), 0, 255).astype(np.uint8)
    h, w = a.shape[0] // 16, a.shape[1] // 16
    if key == "obelisk-mark": a = a[-32:]; h = 2      # the bottom two cells of the 1×3 obelisk (shaft + foot) as a 1×2 icon
    assert col + w <= COLS
    t0 = 600 + col
    out[320:320 + h * 16, col * 16:(col + w) * 16] = a[:h * 16, :w * 16]
    icons.append(dict(key=key, name=name, cells=[[600 + r * COLS + col + c for c in range(w)] for r in range(h)]))
    col += w
dst = ROOT / "public/assets/atlas-biomes/world-chipset.png"
Image.fromarray(out).save(dst, optimize=True)
json.dump(dict(texture="tex_atlas_biome_world", count=ROWS * COLS, blocks=blocks, icons=icons), open(ROOT / "src/assets/atlasBiomeWorldSheet.json", "w"), ensure_ascii=False, indent=1)
print(dst, out.shape, len(blocks), "blocks", len(icons), "icons")
