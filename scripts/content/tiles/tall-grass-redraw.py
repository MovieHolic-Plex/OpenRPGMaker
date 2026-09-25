# Tall grass redraw (E/F/G) for the forest_harmony sheet and its climate repaints.
#
# Style: fan-shaped grass blades (3-4 strands per clump) with a dark outline, 16 px period, RM2K 3x4 edges.
#   E (dark)  — dark ground under the clumps, the patch that touches the forest canopy. In place at 243..335.
#   F (light) — the same clumps straight on the lawn, no ground. Open meadow patches.
#   G (short) — denser, smaller clumps on a lighter ground. Patches next to houses and roads.
# Tile numbers (all sheets — forest_harmony, the forest preview atlas, the four climate sheets):
#   role     E    F     G
#   isolated 243  1127  1131
#   inner    245  1157  1161
#   NW/N/NE  273/274/275  1124/1125/1126  1128/1129/1130
#   W/body/E 303/304/305  1154/1155/1156  1158/1159/1160
#   SW/S/SE  333/334/335  1184/1185/1186  1188/1189/1190
# F and G sit in blank cells of the base sheet (rows 37..39, cols 14..20), below 2550 so grafts (2550..2759),
# snow ice (2730..) and climate copy-by-number never collide. tiledata/tilesets/forest_harmony/tall-grass/README.md.
#
# Usage: python3 scripts/content/tiles/tall-grass-redraw.py      (repaints the forest sheets + writes src/assets/forestTallGrass.json)
#        import: paint_sheet(image, climate=None) paints all 33 cells on an RGBA sheet using its own lawn tile 240.
import json, pathlib, sys
from PIL import Image

T = 16; W = 30
ROLES = ("isolated", "inner", "NW", "N", "NE", "W", "body", "E", "SW", "S", "SE")
TILES = {
    "E": dict(isolated=243, inner=245, NW=273, N=274, NE=275, W=303, body=304, E=305, SW=333, S=334, SE=335),
    "F": dict(isolated=1127, inner=1157, NW=1124, N=1125, NE=1126, W=1154, body=1155, E=1156, SW=1184, S=1185, SE=1186),
    "G": dict(isolated=1131, inner=1161, NW=1128, N=1129, NE=1130, W=1158, body=1159, E=1160, SW=1188, S=1189, SE=1190),
}
LAWN = 240

def cov(role):
    if role == "isolated": return [[0] * 3, [0, 1, 0], [0] * 3]
    c = [[1] * 3 for _ in range(3)]
    m = {"N": [(0, 0), (0, 1), (0, 2)], "S": [(2, 0), (2, 1), (2, 2)], "W": [(0, 0), (1, 0), (2, 0)], "E": [(0, 2), (1, 2), (2, 2)]}
    if role not in ("body", "inner"):
        for ch in role:
            for r, cc in m[ch]: c[r][cc] = 0
    return c

def h(x, y, s=0):
    x %= T; y %= T
    v = (x * 73856093 ^ y * 19349663 ^ s * 83492791) & 0xffffffff
    v = (v ^ (v >> 13)) * 1274126177 & 0xffffffff
    return (v >> 8) & 0xff

def hexc(s): return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

STYLES = {
    "E": dict(pal=dict(k="174f2c", g="1f6334", gs="1a5a30", b="2c7f3a", m="3f9a3e", l="63b545", hl="a3d35a", sp="d4ec86"),
              ground=True, clumps=[(4, 7, 5, 3), (12, 6, 4, 3), (8, 14, 5, 4), (0, 15, 4, 3), (15, 15, 4, 2)]),
    "F": dict(pal=dict(k="2a6f33", g=None, gs=None, b="3a8f3c", m="4aa343", l="70bb4a", hl="a6d65c", sp="d0ea84"),
              ground=False, clumps=[(4, 7, 5, 3), (12, 6, 4, 3), (8, 14, 5, 4), (0, 15, 4, 3), (15, 15, 4, 2)]),
    "G": dict(pal=dict(k="1c5a30", g="2a7536", gs="256d34", b="338a3b", m="46a041", l="69b746", hl="a3d35a", sp="d4ec86"),
              ground=True, clumps=[(3, 6, 4, 3), (9, 5, 5, 3), (14, 8, 4, 2), (6, 11, 4, 3), (12, 13, 5, 3), (1, 15, 4, 2), (8, 16, 3, 2)]),
}

# Climate recolour: forest palette luminance (E outline .. E speck) -> the climate's own ramp, so F stays lighter than E.
CLIMATE_RAMPS = {
    "snow":    [(0, (46, 78, 84)), (.25, (66, 106, 104)), (.5, (98, 140, 130)), (.7, (146, 182, 172)), (.85, (206, 228, 232)), (1, (248, 251, 253))],
    "desert":  [(0, (74, 58, 30)), (.25, (104, 84, 44)), (.5, (140, 116, 60)), (.7, (176, 150, 82)), (.85, (208, 186, 116)), (1, (236, 220, 160))],
    "volcano": [(0, (38, 30, 28)), (.25, (64, 52, 42)), (.5, (106, 88, 64)), (.7, (148, 124, 86)), (.85, (190, 162, 110)), (1, (228, 200, 140))],
    "autumn":  [(0, (60, 26, 14)), (.25, (98, 44, 20)), (.5, (150, 76, 28)), (.7, (196, 118, 40)), (.85, (228, 170, 70)), (1, (246, 214, 130))],
}
def _lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
_LO, _HI = _lum(hexc(STYLES["E"]["pal"]["k"])), _lum(hexc(STYLES["E"]["pal"]["sp"]))
def recolour(c, climate):
    if not climate: return c
    t = min(1, max(0, (_lum(c) - _LO) / (_HI - _LO))); ramp = CLIMATE_RAMPS[climate]
    for (t0, c0), (t1, c1) in zip(ramp, ramp[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            return tuple(round(a + (b - a) * f) for a, b in zip(c0, c1))
    return ramp[-1][1]

def clump_pixels(ax, ay, L, nb, seed):
    """Fan of nb blades about L tall rooted at ay. Returns {(x, y): colour key}."""
    px = {}
    leans = [-1, 0, 1] if nb == 3 else [-1, 1] if nb == 2 else [-2, -1, 0, 1] if nb == 4 else [0]
    order = ["b", "m", "l", "hl", "sp"]
    for i, ln in enumerate(leans):
        bx = ax + (i - (len(leans) - 1) / 2)
        LL = L - (abs(ln) > 1) + (h(ax + i, ay, seed) % 2)
        for t in range(LL):
            x = int(round(bx + ln * t * 0.45)); y = ay - t
            key = "b" if t < 1 else "m" if t < LL * 0.5 else "l" if t < LL - 1 else "hl"
            if key == "hl" and h(x, y, seed + 5) % 9 == 0: key = "sp"
            if (x, y) not in px or order.index(key) > order.index(px[(x, y)]): px[(x, y)] = key
    for dx in range(-2, 3): px.setdefault((int(round(ax)) + dx, ay + 1), "b")  # shade at the root
    return px

def render(style, lawn, climate=None):
    """{tile: 16x16 RGBA} for the 11 roles of one style, drawn over `lawn` (the sheet's own tile 240)."""
    S = STYLES[style]
    P = {k: ((*recolour(hexc(v), climate), 255) if v else None) for k, v in S["pal"].items()}
    out = {}
    for role, tid in TILES[style].items():
        c = cov(role)
        big = Image.new("RGBA", (3 * T, 3 * T)); px = big.load()
        cov_ = lambda X, Y: 0 <= X < 3 * T and 0 <= Y < 3 * T and c[Y // T][X // T] == 1
        def dist(X, Y, dx, dy, lim=12):
            for k in range(lim + 1):
                if not cov_(X + dx * k, Y + dy * k): return k
            return lim + 1
        for Y in range(3 * T):
            for X in range(3 * T):
                ok = S["ground"] and cov_(X, Y) and dist(X, Y, 0, -1) > 5 + h(X, Y, 7) % 2 and dist(X, Y, 0, 1) > 2 + h(X, Y, 8) % 2 \
                    and min(dist(X, Y, -1, 0), dist(X, Y, 1, 0)) > 3 + h(X, Y, 6) % 2
                px[X, Y] = (P["g"] if h(X, Y, 3) % 6 else P["gs"]) if ok else lawn.getpixel((X % T, Y % T))
        allp = {}; anc = []
        for cy in range(-1, 4):
            for cx in range(-1, 4):
                for (ax, ay, L, nb) in S["clumps"]:
                    X = cx * T + ax; Y = cy * T + ay
                    if not cov_(X, Y - 1): continue
                    if dist(X, Y - 1, 0, 1) < 2 or dist(X, Y - 1, 0, -1) < L - 1 or min(dist(X, Y - 1, -1, 0), dist(X, Y - 1, 1, 0)) < 3: continue
                    anc.append((Y, X, ax, ay, L, nb))
        anc.sort()
        for Y, X, ax, ay, L, nb in anc:
            cp = clump_pixels(X, Y, L, nb, ax * 7 + ay)
            for (x, y) in list(cp):  # outline: empty cells around the clump
                for dx, dy in ((1, 0), (-1, 0), (0, -1), (0, 1)):
                    q = (x + dx, y + dy)
                    if q not in cp and q not in allp: allp[q] = "k"
            for q, k in cp.items(): allp[q] = k
        for (x, y), k in allp.items():
            if 0 <= x < 3 * T and 0 <= y < 3 * T: px[x, y] = P[k]
        out[tid] = big.crop((T, T, 2 * T, 2 * T))
    return out

def cell(im, t): return ((t % W) * T, (t // W) * T)

def paint_sheet(sheet, climate=None):
    """Paint E, F and G (33 cells) onto an RGBA sheet in place; the lawn is the sheet's own tile 240."""
    x, y = cell(sheet, LAWN); lawn = sheet.crop((x, y, x + T, y + T))
    for style in "EFG":
        for tid, im in render(style, lawn, climate).items(): sheet.paste(im, cell(sheet, tid))
    return sheet

def all_tiles(): return sorted(t for s in TILES.values() for t in s.values())

# Sheets drawn with the forest_harmony tall grass (same pixels at 243..335 before the redraw). The retro EasyRPG
# atlases (forest-cliff-village-atlas.png and the older place atlases) carry a different speckled grass there; left alone.
FOREST_SHEETS = ["public/assets/forest-harmony/chipset.png", "public/assets/region-references/river-forest-village-atlas.png"]

if __name__ == "__main__":
    root = pathlib.Path.cwd()
    for rel in FOREST_SHEETS:
        p = root / rel; im = Image.open(p).convert("RGBA")
        paint_sheet(im).save(p, optimize=True); print("painted", rel)
    spec = {"source": "scripts/content/tiles/tall-grass-redraw.py", "roles": list(ROLES), "tiles": TILES}
    (root / "src/assets/forestTallGrass.json").write_text(json.dumps(spec, ensure_ascii=False) + "\n")
    print("wrote src/assets/forestTallGrass.json")
