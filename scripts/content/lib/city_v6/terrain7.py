# v7 autotile art for the editor sheet: 16-variant (N=1 E=2 S=4 W=8) tile sets drawn with the SAME functions that drew the
# city, so a road/canal/path painted by the assistant looks like the city's own (curbs, quay rims, animated water):
#   road_variants()  paved street with a 2 px curb on every side that has no paved neighbour (terrain.paving)
#   water_variants() canal / river water, 8 animation frames, stone quay rim + quay shadow on every side without water
#                    (v6pieces.canal6 + water6.Water — the very pipeline of the city render)
#   sand_variants()  sandy outskirts path with a ragged grass fringe on every side without path
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import palette; palette.apply()
import terrain, v6pieces, water6
from px2 import _hash
T = 16

def road_variants(tx=160, ty=96):
    out = {}
    for m in range(16):
        mask = [[False] * 3 for _ in range(3)]
        mask[1][1] = True; mask[0][1] = bool(m & 1); mask[1][2] = bool(m & 2); mask[2][1] = bool(m & 4); mask[1][0] = bool(m & 8)
        out[m] = terrain.paving(mask, tx, ty, joins=None, curb=True).crop((T, T, 2 * T, 2 * T))
    return out

def _block(m, B=9):
    """B x B water mask whose centre cell has exactly the neighbour bits m (N=1,E=2,S=4,W=8)."""
    c = B // 2; g = [[True] * B for _ in range(B)]
    for y in range(B):
        for x in range(B):
            if x in (0, B - 1) or y in (0, B - 1): g[y][x] = False
            if not (m & 1) and y < c: g[y][x] = False
            if not (m & 4) and y > c: g[y][x] = False
            if not (m & 8) and x < c: g[y][x] = False
            if not (m & 2) and x > c: g[y][x] = False
    g[c][c] = True
    return g

def water_variants(frames=8, B=9):
    """{mask: [frame RGBA 16x16 ...]} (the water surface animates; the quay rim is static)."""
    G = 4; W = H = G * B
    mask = [[False] * W for _ in range(H)]
    for m in range(16):
        bx, by = (m % G) * B, (m // G) * B; blk = _block(m, B)
        for y in range(B):
            for x in range(B): mask[by + y][bx + x] = blk[y][x]
    skip = [[False] * W for _ in range(H)]
    rim = v6pieces.canal6(mask, skip)
    flow = [["S"] * W for _ in range(H)]
    wa = water6.Water(mask, flow)
    out = {m: [] for m in range(16)}
    for f in range(frames):
        img = rim.copy(); img.alpha_composite(Image.fromarray(wa.frame(f), "RGBA"))
        for m in range(16):
            cx, cy = (m % G) * B + B // 2, (m // G) * B + B // 2
            out[m].append(img.crop((cx * T, cy * T, cx * T + T, cy * T + T)))
    return out

def sand_variants(sand_tile=None, lawn_xy=(0, 128), sand_xy=(64, 224)):
    """Sandy path: the chipset's sand tile, a grass fringe 1..5 px deep (ragged, per-pixel hash) on each side with no path."""
    sand = sand_tile if sand_tile is not None else terrain.CH.crop((sand_xy[0], sand_xy[1], sand_xy[0] + T, sand_xy[1] + T)).convert("RGBA")
    lawn = terrain.CH.crop((lawn_xy[0], lawn_xy[1], lawn_xy[0] + T, lawn_xy[1] + T)).convert("RGBA")
    sp, lp = sand.load(), lawn.load(); out = {}
    for m in range(16):
        im = Image.new("RGBA", (T, T)); px = im.load()
        for y in range(T):
            for x in range(T):
                c = sp[x, y]
                depth = 99.0
                for bit, d in ((1, y), (4, T - 1 - y), (8, x), (2, T - 1 - x)):
                    if not (m & bit): depth = min(depth, d)
                if depth < 99:
                    # per-pixel ragged edge: thresholds hashed on the position ALONG the side, so neighbouring cells match
                    along = x if (not (m & 1) and y == depth) or (not (m & 4) and (T - 1 - y) == depth) else y
                    thr = 1.5 + 3.5 * _hash(along, 5 + (0 if depth == y or depth == T - 1 - y else 1), 731)
                    if depth < thr: c = lp[x, y]
                    elif depth < thr + 1.2: c = tuple(int(v * 0.86) for v in sp[x, y][:3]) + (255,)     # damp sand at the fringe
                px[x, y] = tuple(c[:3]) + (255,)
        out[m] = im
    return out

if __name__ == "__main__":
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    outd = os.path.join(root, "scripts/.scratch/r2"); os.makedirs(outd, exist_ok=True)
    R = road_variants(); S = sand_variants(); Wv = water_variants()
    sheet = Image.new("RGBA", (16 * T * 3 // 1, 3 * T * 3), (60, 110, 60, 255))
    for m in range(16):
        sheet.alpha_composite(R[m], (m * 3 * T, 0)); sheet.alpha_composite(S[m], (m * 3 * T, 3 * T)); sheet.alpha_composite(Wv[m][0], (m * 3 * T, 6 * T))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST); sheet.save(os.path.join(outd, "autotile-variants.png")); print(sheet.size)
