"""Python port of src/player/bustPixelate.ts (the illustration branch) so the blind review sees what the player sees.

Keep in step with the TS: BUST_ART 44x46, smoothing resize to fit, bottom-centre, alpha cut 128, 16-colour median cut
(range x sqrt(count) box choice, split at the median), nearest colour, 1px outline #203028 on transparent 4-neighbours.
Pictures that are already 64x64 or 44x46 grids are returned unchanged, as on screen (apart from the 2x display scale).
"""
import math
from PIL import Image

W, H, PALETTE, ALPHA_CUT, OUTLINE = 44, 46, 16, 128, (0x20, 0x30, 0x28)


def median_cut(pixels, colors):
    boxes = [list(pixels)]
    while len(boxes) < colors:
        pick, pick_range, pick_ch = -1, 0, 0
        for i, box in enumerate(boxes):
            if len(box) < 2: continue
            for ch in range(3):
                vals = [p[ch] for p in box]
                rng = (max(vals) - min(vals)) * math.sqrt(len(box))
                if rng > pick_range: pick, pick_range, pick_ch = i, rng, ch
        if pick < 0: break
        box = sorted(boxes[pick], key=lambda p: p[pick_ch]); half = len(box) >> 1
        boxes[pick:pick + 1] = [box[:half], box[half:]]
    out = []
    for box in boxes:
        n = max(1, len(box))
        out.append(tuple(round(sum(p[c] for p in box) / n) for c in range(3)))
    return out


def bust_pixelate(im):
    im = im.convert('RGBA')
    if im.size in ((64, 64), (W, H)): return im
    w, h = im.size; fit = min(W / w, H / h)
    dw, dh = max(1, round(w * fit)), max(1, round(h * fit))
    art = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    art.alpha_composite(im.resize((dw, dh), Image.LANCZOS), ((W - dw) // 2, H - dh))
    px = art.load()
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] >= ALPHA_CUT
    opaque = [px[x, y][:3] for y in range(H) for x in range(W) if solid(x, y)]
    if not opaque: return art
    pal = median_cut(opaque, PALETTE)
    near = lambda c: min(pal, key=lambda q: (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o = out.load()
    for y in range(H):
        for x in range(W):
            if solid(x, y): o[x, y] = near(px[x, y][:3]) + (255,)
            elif solid(x - 1, y) or solid(x + 1, y) or solid(x, y - 1) or solid(x, y + 1): o[x, y] = OUTLINE + (255,)
    return out
