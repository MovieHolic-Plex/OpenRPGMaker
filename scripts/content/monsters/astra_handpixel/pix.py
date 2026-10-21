"""Tiny row-string pixel engine. Every pixel is authored explicitly:
a layer is {y: "x:chars x:chars ..."}; '.' inside chars = leave as is, '_' = erase."""
from PIL import Image

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

class Canvas:
    def __init__(self, w=64, h=64):
        self.w, self.h = w, h
        self.g = [[None] * w for _ in range(h)]
    def layer(self, rows, dx=0, dy=0, mirror_w=None):
        for y, spec in rows.items():
            for seg in spec.split():
                x0, s = seg.split(':', 1)
                x0 = int(x0)
                for i, ch in enumerate(s):
                    if ch == '.':
                        continue
                    x, yy = x0 + i + dx, y + dy
                    if mirror_w is not None:
                        x = mirror_w - 1 - x
                    if 0 <= x < self.w and 0 <= yy < self.h:
                        self.g[yy][x] = None if ch == '_' else ch
        return self
    def copy(self):
        c = Canvas(self.w, self.h); c.g = [r[:] for r in self.g]; return c
    def image(self, pal):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch is not None:
                    if ch not in pal:
                        raise KeyError(f'colour {ch!r} at {x},{y} not in palette')
                    px[x, y] = hexrgb(pal[ch])
        return im
    def used(self):
        return sorted({c for r in self.g for c in r if c is not None})
