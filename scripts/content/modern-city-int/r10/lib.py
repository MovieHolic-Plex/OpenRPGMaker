# R10 daily-routine props: shared 3/4 top-view drawing kit.
# Harness rule: every prop shows a lighter TOP surface above a darker FRONT face, wrapped in a 1px ink outline (OL),
# with a 1px floor shadow under the front. Palettes are sampled from the existing mci-* sprites so new pieces sit
# beside mci-gondola / mart-cold-case / mci-kitchen without a style seam.
from PIL import Image, ImageDraw

OL = (11, 18, 36)
SH = (9, 17, 37)
WHITE, WHITE_D = (244, 246, 248), (208, 214, 222)
STEEL, STEEL_D, STEEL_L = (160, 166, 178), (118, 124, 136), (204, 208, 216)
DARK, DARK_M = (58, 60, 70), (82, 86, 98)
GLASS, GLASS_D, GLASS_L = (176, 220, 236), (120, 176, 200), (226, 244, 250)
WOOD_L, WOOD, WOOD_D, WOOD_DD = (221, 191, 145), (188, 146, 80), (150, 108, 52), (112, 78, 38)
CREAM, CREAM_D = (242, 232, 210), (214, 198, 166)
RED, RED_D, RED_L = (204, 52, 60), (150, 34, 44), (238, 108, 108)
ORANGE, ORANGE_D = (240, 150, 50), (200, 100, 30)
YELLOW, YELLOW_D = (240, 200, 56), (196, 150, 30)
GREEN_L, GREEN, GREEN_D = (92, 170, 110), (60, 140, 84), (40, 104, 62)
LEAF, LEAF_D = (96, 168, 72), (58, 116, 48)
BLUE_L, BLUE, BLUE_D = (110, 160, 224), (62, 110, 190), (40, 70, 130)
PURPLE, PURPLE_D = (150, 92, 190), (104, 60, 140)
PINK, PINK_D = (240, 150, 180), (196, 96, 132)
BROWN, BROWN_D = (128, 84, 52), (92, 58, 36)
SKIN, SKIN_D = (236, 196, 160), (200, 156, 120)
NAVY, NAVY_D = (44, 58, 104), (28, 38, 72)
BLACK = (34, 36, 44)
GOLD, GOLD_D = (232, 196, 92), (176, 136, 48)
ICE, ICE_D = (226, 240, 248), (184, 214, 232)
SCREEN, SCREEN_D = (84, 176, 220), (44, 104, 150)


def lt(c, f=1.2): return tuple(min(255, int(v * f)) for v in c)
def dk(c, f=0.75): return tuple(int(v * f) for v in c)


class C:
    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)
        self.W, self.H = w, h
    def r(self, x0, y0, x1, y1, c): self.d.rectangle((x0, y0, x1, y1), fill=(*c, 255)); return self
    def l(self, x0, y0, x1, y1, c): self.d.line((x0, y0, x1, y1), fill=(*c, 255)); return self
    def p(self, x, y, c): self.d.point((x, y), fill=(*c, 255)); return self
    def e(self, x0, y0, x1, y1, c): self.d.ellipse((x0, y0, x1, y1), fill=(*c, 255)); return self
    def eo(self, x0, y0, x1, y1, c): self.d.ellipse((x0, y0, x1, y1), outline=(*c, 255)); return self
    def box(self, x0, y0, x1, y1, fill, ol=OL):
        """Filled rect with a 1px ink outline."""
        self.r(x0, y0, x1, y1, ol); self.r(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill); return self
    def oval(self, x0, y0, x1, y1, fill, ol=OL):
        self.e(x0, y0, x1, y1, ol); self.e(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill); return self

    def block(self, x0, y0, x1, y1, top_h, top, face, shadow=True):
        """3/4 box: outline, lighter top band (top_h px incl. highlight row), front face, darker toe row, floor shadow."""
        self.box(x0, y0, x1, y1, face)
        self.r(x0 + 1, y0 + 1, x1 - 1, y0 + top_h, top)
        self.r(x0 + 1, y0 + 1, x1 - 1, y0 + 1, lt(top, 1.12))
        self.r(x0 + 1, y0 + top_h + 1, x1 - 1, y0 + top_h + 1, dk(face, 0.85))
        self.r(x0 + 1, y1 - 1, x1 - 1, y1 - 1, dk(face, 0.8))
        if shadow and y1 + 1 < self.H: self.r(x0 + 1, y1 + 1, x1, y1 + 1, SH)
        return self

    def glass(self, x0, y0, x1, y1, tint=GLASS):
        self.r(x0, y0, x1, y1, tint)
        for i in range(0, min(x1 - x0, y1 - y0) // 2):
            self.p(x0 + 2 + i, y1 - 2 - i, GLASS_L)
        return self

    # merchandise ------------------------------------------------------
    def pack(self, x, y, w, h, c):
        """Retail package: colour body, light top row, dark bottom row (reads as a box on a shelf)."""
        self.r(x, y, x + w - 1, y + h - 1, c)
        self.r(x, y, x + w - 1, y, lt(c, 1.3))
        if h > 2: self.r(x, y + h - 1, x + w - 1, y + h - 1, dk(c, 0.7))
        if w > 2 and h > 3: self.p(x + w // 2, y + h // 2, WHITE)
        return self
    def bottle(self, x, y, c, h=6):
        self.r(x, y + 2, x + 1, y + h - 1, c); self.p(x, y + 2, lt(c, 1.4))
        self.r(x, y, x + 1, y + 1, dk(c, 0.6)); return self
    def can(self, x, y, c):
        self.r(x, y, x + 2, y + 3, c); self.r(x, y, x + 2, y, STEEL_L); self.r(x, y + 3, x + 2, y + 3, STEEL_D); return self
    def ball(self, x, y, r, c):
        self.e(x - r, y - r, x + r, y + r, dk(c, 0.7)); self.e(x - r, y - r, x + r - 1, y + r - 1, c)
        self.p(x - r + 1, y - r + 1, lt(c, 1.45)); return self
    def shelf_rows(self, x0, x1, ys, colors, w=3, h=4, gap=1):
        """Fill shelf rows with packages cycling through colors."""
        k = 0
        for y in ys:
            x = x0
            while x + w - 1 <= x1:
                self.pack(x, y, w, h, colors[k % len(colors)]); k += 1; x += w + gap
        return self

    def done(self): return self.im


def mirror(im): return im.transpose(Image.FLIP_LEFT_RIGHT)


def recolor(im, mapping):
    """Swap exact RGB colours (for colour-variant merchandise)."""
    px = im.load(); out = im.copy(); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in mapping: po[x, y] = (*mapping[(r, g, b)], a)
    return out
