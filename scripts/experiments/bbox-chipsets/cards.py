"""bbox-chipsets: draw pieces as labelled cards (native pixels x2) and pack them into a sheet — used by the catalog palette and by find_pieces.
Tiles >= the pool's first id come from the pool sheet (pool.py), everything else from the chipset sheet."""
import json, os
from PIL import Image, ImageDraw, ImageFont
try:
    F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
except Exception:
    F = FB = ImageFont.load_default()
K = 2

class Sheet:
    def __init__(self, D):
        self.T = D["tileSize"]; self.im = Image.open(D["sheet"]).convert("RGBA"); self.tpr = self.im.width // self.T
        self.first = None; self.pool = None
        pd = os.environ.get("BBOX_POOL_DIR")
        if pd and os.path.exists(f"{pd}/spec.json"):
            ps = json.load(open(f"{pd}/spec.json")).get(D["tileset"])
            if ps: self.first = ps["first"]; self.pool = Image.open(ps["sheet"]).convert("RGBA")
    def tile(self, n):
        T = self.T
        if self.first is not None and n >= self.first:
            k = n - self.first; return self.pool.crop(((k % 16) * T, (k // 16) * T, (k % 16) * T + T, (k // 16) * T + T))
        return self.im.crop(((n % self.tpr) * T, (n // self.tpr) * T, (n % self.tpr) * T + T, (n // self.tpr) * T + T))
    def card(self, label, cells, k=None):   # cells: (dx, dy, tile, layer)
        T = self.T; K_ = k or K
        xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; x0, y0 = min(xs), min(ys)
        w, h = (max(xs) - x0 + 1) * T, (max(ys) - y0 + 1) * T
        im = Image.new("RGBA", (w, h), (60, 60, 70, 255))
        for c in sorted(cells, key=lambda c: c[3]):
            if c[2] >= 0: im.alpha_composite(self.tile(c[2]), ((c[0] - x0) * T, (c[1] - y0) * T))
        im = im.resize((w * K_, h * K_), Image.NEAREST)
        tw = int(F.getlength(label)) + 4
        cv = Image.new("RGBA", (max(im.width, tw), im.height + 14), (30, 30, 36, 255)); cv.alpha_composite(im, (0, 0))
        ImageDraw.Draw(cv).text((2, im.height + 1), label, fill=(255, 255, 255), font=F)
        return cv

def pack(bands, WMAX=1500):
    """bands: [(title or None, [card images])] → one sheet; each titled band starts on a new line."""
    x = y = rowh = 0; ops = []
    for title, cards in bands:
        if title is not None:
            if x: y += rowh + 8; x = rowh = 0
            ops.append(("t", title, (0, y))); y += 18
        for c in cards:
            if x + c.width > WMAX: x = 0; y += rowh + 8; rowh = 0
            ops.append(("c", c, (x, y))); x += c.width + 10; rowh = max(rowh, c.height)
    out = Image.new("RGBA", (WMAX, y + rowh + 4), (30, 30, 36, 255)); d = ImageDraw.Draw(out)
    for kind, v, p in ops:
        if kind == "t": d.text(p, v, fill=(255, 216, 102), font=FB)
        else: out.alpha_composite(v, p)
    return out
