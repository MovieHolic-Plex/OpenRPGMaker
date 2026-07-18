#!/usr/bin/env python3
"""Generate matching monster battlers + item/equipment icons for default DB records."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MONSTER_OUT = ROOT / "public" / "assets" / "generated" / "rm2k3"
ICON_OUT = ROOT / "public" / "assets" / "cc0" / "jetrel" / "icons"
MONSTER_OUT.mkdir(parents=True, exist_ok=True)
ICON_OUT.mkdir(parents=True, exist_ok=True)


def save_rgba(im: Image.Image, path: Path) -> None:
    im.convert("RGBA").save(path)
    print(f"wrote {path.relative_to(ROOT)} {im.size}")


def blank(w: int = 96, h: int = 96) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def oval(draw: ImageDraw.ImageDraw, box, fill, outline=None, width: int = 1) -> None:
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def rect(draw: ImageDraw.ImageDraw, box, fill, outline=None, width: int = 1) -> None:
    draw.rectangle(box, fill=fill, outline=outline, width=width)


def poly(draw: ImageDraw.ImageDraw, pts, fill, outline=None) -> None:
    draw.polygon(pts, fill=fill, outline=outline)


def darken(c, f: float = 0.7):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + ((c[3],) if len(c) > 3 else (255,))


def lighten(c, f: float = 1.25):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + ((c[3],) if len(c) > 3 else (255,))


def monster_zombie():
    im = blank()
    d = ImageDraw.Draw(im)
    oval(d, (28, 36, 68, 88), (90, 140, 90, 255), (40, 80, 40, 255), 2)
    oval(d, (32, 14, 64, 48), (150, 180, 120, 255), (70, 100, 50, 255), 2)
    oval(d, (38, 26, 44, 34), (200, 40, 40, 255))
    oval(d, (52, 26, 58, 34), (200, 40, 40, 255))
    rect(d, (40, 38, 56, 42), (40, 40, 40, 255))
    rect(d, (18, 48, 30, 70), (90, 140, 90, 255), (40, 80, 40, 255), 1)
    rect(d, (66, 48, 78, 70), (90, 140, 90, 255), (40, 80, 40, 255), 1)
    return im


def monster_skeleton():
    im = blank()
    d = ImageDraw.Draw(im)
    bone = (235, 230, 210, 255)
    line = (120, 110, 90, 255)
    oval(d, (30, 10, 66, 46), bone, line, 2)
    oval(d, (36, 22, 44, 32), (30, 30, 30, 255))
    oval(d, (52, 22, 60, 32), (30, 30, 30, 255))
    rect(d, (42, 34, 54, 38), (30, 30, 30, 255))
    rect(d, (40, 46, 56, 74), bone, line, 1)
    for y in range(50, 72, 6):
        d.line([(40, y), (56, y)], fill=line, width=1)
    d.line([(28, 50), (40, 58)], fill=bone, width=3)
    d.line([(56, 58), (68, 50)], fill=bone, width=3)
    d.line([(68, 18), (72, 86)], fill=(160, 140, 100, 255), width=3)
    poly(d, [(66, 14), (74, 18), (66, 22)], fill=(180, 180, 190, 255))
    d.line([(44, 74), (40, 90)], fill=bone, width=3)
    d.line([(52, 74), (56, 90)], fill=bone, width=3)
    return im


def monster_orc():
    im = blank()
    d = ImageDraw.Draw(im)
    skin = (70, 130, 70, 255)
    dark = (40, 80, 40, 255)
    oval(d, (24, 34, 72, 86), skin, dark, 2)
    oval(d, (28, 10, 68, 50), skin, dark, 2)
    poly(d, [(34, 40), (30, 50), (38, 44)], fill=(240, 240, 220, 255))
    poly(d, [(62, 40), (66, 50), (58, 44)], fill=(240, 240, 220, 255))
    oval(d, (36, 24, 44, 32), (240, 220, 40, 255))
    oval(d, (52, 24, 60, 32), (240, 220, 40, 255))
    rect(d, (70, 40, 80, 78), (120, 80, 40, 255))
    oval(d, (66, 28, 84, 46), (100, 70, 30, 255))
    return im


def monster_ghost():
    im = blank()
    d = ImageDraw.Draw(im)
    body = (200, 220, 255, 220)
    line = (120, 150, 200, 255)
    oval(d, (24, 12, 72, 70), body, line, 2)
    poly(
        d,
        [(24, 60), (32, 80), (40, 62), (48, 82), (56, 62), (64, 80), (72, 60), (72, 50), (24, 50)],
        fill=body,
        outline=line,
    )
    oval(d, (36, 28, 44, 40), (40, 40, 80, 255))
    oval(d, (52, 28, 60, 40), (40, 40, 80, 255))
    rect(d, (40, 46, 56, 50), (80, 80, 120, 255))
    return im


def monster_crab():
    im = blank()
    d = ImageDraw.Draw(im)
    shell = (200, 70, 50, 255)
    dark = (120, 30, 20, 255)
    oval(d, (22, 30, 74, 70), shell, dark, 2)
    oval(d, (6, 28, 28, 52), shell, dark, 2)
    oval(d, (68, 28, 90, 52), shell, dark, 2)
    rect(d, (36, 18, 42, 32), (240, 240, 240, 255))
    rect(d, (54, 18, 60, 32), (240, 240, 240, 255))
    oval(d, (36, 14, 42, 22), (20, 20, 20, 255))
    oval(d, (54, 14, 60, 22), (20, 20, 20, 255))
    for x in [28, 38, 50, 60]:
        d.line([(x, 66), (x - 4, 84)], fill=dark, width=2)
        d.line([(x + 6, 66), (x + 10, 84)], fill=dark, width=2)
    return im


def monster_spider():
    im = blank()
    d = ImageDraw.Draw(im)
    body = (60, 40, 40, 255)
    dark = (30, 20, 20, 255)
    oval(d, (34, 34, 62, 62), body, dark, 2)
    oval(d, (40, 22, 56, 40), body, dark, 2)
    for dx in range(4):
        oval(d, (42 + dx * 3, 28, 45 + dx * 3, 31), (220, 40, 40, 255))
    for i, y in enumerate([30, 40, 50, 58]):
        d.line([(34, y), (10, y - 8 + i * 2)], fill=body, width=2)
        d.line([(62, y), (86, y - 8 + i * 2)], fill=body, width=2)
    return im


def monster_snake():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (70, 160, 70, 255)
    dark = (30, 90, 30, 255)
    oval(d, (20, 40, 76, 80), c, dark, 2)
    oval(d, (30, 48, 66, 74), (50, 130, 50, 255), dark, 1)
    oval(d, (54, 18, 82, 46), c, dark, 2)
    oval(d, (68, 26, 74, 32), (240, 220, 40, 255))
    d.line([(82, 32), (92, 28)], fill=(200, 40, 40, 255), width=2)
    d.line([(82, 32), (92, 36)], fill=(200, 40, 40, 255), width=2)
    return im


def monster_scorpion():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (160, 100, 40, 255)
    dark = (90, 50, 20, 255)
    oval(d, (26, 40, 70, 72), c, dark, 2)
    oval(d, (8, 36, 28, 56), c, dark, 2)
    oval(d, (68, 36, 88, 56), c, dark, 2)
    d.arc((48, 8, 88, 56), 200, 360, fill=c, width=5)
    poly(d, [(76, 12), (88, 8), (82, 22)], fill=(200, 40, 40, 255))
    oval(d, (38, 48, 44, 54), (20, 20, 20, 255))
    oval(d, (52, 48, 58, 54), (20, 20, 20, 255))
    return im


def monster_wolf():
    im = blank()
    d = ImageDraw.Draw(im)
    fur = (140, 140, 150, 255)
    dark = (70, 70, 80, 255)
    oval(d, (22, 40, 74, 78), fur, dark, 2)
    oval(d, (48, 18, 84, 54), fur, dark, 2)
    poly(d, [(54, 20), (50, 6), (62, 16)], fill=fur, outline=dark)
    poly(d, [(70, 16), (78, 4), (82, 20)], fill=fur, outline=dark)
    oval(d, (62, 30, 68, 36), (240, 200, 40, 255))
    for x in [30, 42, 54, 64]:
        rect(d, (x, 72, x + 6, 90), fur, dark, 1)
    return im


def monster_harpy():
    im = blank()
    d = ImageDraw.Draw(im)
    body = (200, 160, 120, 255)
    wing = (180, 100, 160, 255)
    dark = (100, 60, 80, 255)
    poly(d, [(8, 40), (34, 28), (34, 60), (12, 70)], fill=wing, outline=dark)
    poly(d, [(88, 40), (62, 28), (62, 60), (84, 70)], fill=wing, outline=dark)
    oval(d, (34, 30, 62, 72), body, dark, 2)
    oval(d, (36, 12, 60, 38), body, dark, 2)
    poly(d, [(48, 28), (58, 32), (48, 36)], fill=(220, 160, 40, 255))
    oval(d, (42, 20, 48, 26), (30, 30, 30, 255))
    return im


def monster_centipede():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (180, 80, 60, 255)
    dark = (100, 40, 30, 255)
    segs = [(18, 50), (30, 44), (42, 40), (54, 38), (66, 42), (76, 50)]
    for i, (x, y) in enumerate(segs):
        r = 10 if i else 12
        oval(d, (x - r, y - r, x + r, y + r), c if i % 2 == 0 else darken(c, 0.85), dark, 1)
        if i:
            d.line([(x - 2, y + r - 2), (x - 6, y + r + 10)], fill=dark, width=2)
            d.line([(x + 2, y + r - 2), (x + 6, y + r + 10)], fill=dark, width=2)
    oval(d, (10, 44, 16, 50), (240, 40, 40, 255))
    oval(d, (10, 52, 16, 58), (240, 40, 40, 255))
    return im


def monster_plant():
    im = blank()
    d = ImageDraw.Draw(im)
    pot = (140, 90, 50, 255)
    leaf = (50, 160, 60, 255)
    dark = (30, 90, 30, 255)
    poly(d, [(30, 58), (66, 58), (60, 88), (36, 88)], fill=pot, outline=(80, 50, 20, 255))
    rect(d, (44, 36, 52, 60), leaf, dark, 1)
    oval(d, (28, 12, 68, 48), (200, 60, 80, 255), (120, 30, 40, 255), 2)
    for x in range(34, 62, 6):
        poly(d, [(x, 30), (x + 3, 38), (x + 6, 30)], fill=(240, 240, 220, 255))
    oval(d, (38, 20, 44, 26), (240, 240, 40, 255))
    oval(d, (52, 20, 58, 26), (240, 240, 40, 255))
    return im


def monster_horse():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (160, 110, 60, 255)
    dark = (90, 60, 30, 255)
    oval(d, (18, 40, 70, 72), c, dark, 2)
    poly(d, [(60, 44), (72, 20), (86, 24), (78, 48)], fill=c, outline=dark)
    oval(d, (74, 14, 92, 32), c, dark, 2)
    for y in range(18, 44, 4):
        d.line([(68, y), (62, y + 4)], fill=(80, 50, 20, 255), width=2)
    for x in [26, 38, 50, 60]:
        rect(d, (x, 70, x + 5, 90), c, dark, 1)
    oval(d, (80, 20, 85, 25), (20, 20, 20, 255))
    return im


def monster_unicorn():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (240, 240, 245, 255)
    dark = (150, 150, 170, 255)
    oval(d, (18, 42, 70, 74), c, dark, 2)
    poly(d, [(60, 46), (72, 22), (86, 26), (78, 50)], fill=c, outline=dark)
    oval(d, (74, 16, 92, 34), c, dark, 2)
    poly(d, [(82, 16), (88, 2), (90, 18)], fill=(220, 200, 80, 255), outline=(160, 140, 40, 255))
    for x in [26, 38, 50, 60]:
        rect(d, (x, 72, x + 5, 90), c, dark, 1)
    oval(d, (80, 22, 85, 27), (80, 120, 200, 255))
    return im


def monster_salamander():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (220, 80, 40, 255)
    dark = (140, 40, 20, 255)
    oval(d, (16, 40, 72, 72), c, dark, 2)
    oval(d, (60, 28, 88, 56), c, dark, 2)
    poly(d, [(16, 52), (4, 40), (8, 60)], fill=c, outline=dark)
    for x, h in [(28, 18), (40, 12), (52, 18)]:
        poly(d, [(x, 40), (x + 4, h), (x + 8, 40)], fill=(255, 200, 40, 255))
    oval(d, (70, 36, 76, 42), (240, 240, 40, 255))
    for x in [24, 40, 54]:
        rect(d, (x, 68, x + 6, 86), c, dark, 1)
    return im


def monster_carbuncle():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (180, 120, 200, 255)
    dark = (100, 60, 120, 255)
    oval(d, (24, 36, 72, 78), c, dark, 2)
    oval(d, (30, 18, 66, 52), c, dark, 2)
    poly(d, [(48, 14), (56, 26), (48, 34), (40, 26)], fill=(80, 220, 255, 255), outline=(40, 120, 180, 255))
    poly(d, [(30, 24), (22, 8), (40, 20)], fill=c, outline=dark)
    poly(d, [(66, 24), (74, 8), (56, 20)], fill=c, outline=dark)
    oval(d, (38, 30, 44, 36), (30, 30, 30, 255))
    oval(d, (52, 30, 58, 36), (30, 30, 30, 255))
    return im


def monster_cat():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (40, 40, 50, 255)
    accent = (200, 160, 40, 255)
    oval(d, (24, 40, 72, 78), c, (20, 20, 25, 255), 2)
    oval(d, (30, 16, 66, 52), c, (20, 20, 25, 255), 2)
    poly(d, [(32, 22), (28, 6), (42, 18)], fill=c)
    poly(d, [(64, 22), (68, 6), (54, 18)], fill=c)
    oval(d, (38, 28, 46, 36), accent)
    oval(d, (50, 28, 58, 36), accent)
    d.arc((60, 50, 90, 86), 270, 90, fill=accent, width=4)
    return im


def monster_kappa():
    im = blank()
    d = ImageDraw.Draw(im)
    skin = (70, 150, 90, 255)
    shell = (90, 120, 60, 255)
    dark = (30, 80, 40, 255)
    oval(d, (24, 36, 72, 82), skin, dark, 2)
    oval(d, (28, 42, 68, 78), shell, dark, 2)
    oval(d, (32, 12, 64, 40), skin, dark, 2)
    oval(d, (38, 14, 58, 26), (80, 160, 200, 255), (40, 90, 120, 255), 1)
    poly(d, [(44, 30), (52, 38), (44, 36)], fill=(220, 180, 40, 255))
    oval(d, (38, 24, 44, 30), (20, 20, 20, 255))
    oval(d, (52, 24, 58, 30), (20, 20, 20, 255))
    return im


def monster_cockatrice():
    im = blank()
    d = ImageDraw.Draw(im)
    body = (120, 180, 80, 255)
    dark = (60, 100, 40, 255)
    oval(d, (24, 40, 70, 76), body, dark, 2)
    oval(d, (56, 16, 84, 46), body, dark, 2)
    for x in [62, 70, 78]:
        poly(d, [(x, 18), (x + 3, 6), (x + 6, 18)], fill=(220, 40, 40, 255))
    poly(d, [(80, 28), (94, 32), (80, 36)], fill=(220, 160, 40, 255))
    poly(d, [(28, 48), (16, 36), (20, 60)], fill=(100, 160, 60, 255), outline=dark)
    d.line([(40, 74), (36, 90)], fill=(220, 160, 40, 255), width=2)
    d.line([(54, 74), (58, 90)], fill=(220, 160, 40, 255), width=2)
    oval(d, (64, 24, 70, 30), (240, 40, 40, 255))
    return im


def monster_parasite():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (180, 60, 160, 255)
    dark = (100, 30, 90, 255)
    oval(d, (28, 28, 68, 68), c, dark, 2)
    for ang in range(0, 360, 45):
        x = 48 + int(28 * math.cos(math.radians(ang)))
        y = 48 + int(28 * math.sin(math.radians(ang)))
        d.line([(48, 48), (x, y)], fill=c, width=3)
        oval(d, (x - 4, y - 4, x + 4, y + 4), lighten(c, 1.2), dark, 1)
    oval(d, (42, 42, 54, 54), (240, 240, 40, 255), dark, 1)
    return im


def monster_mantis():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (90, 180, 50, 255)
    dark = (40, 100, 20, 255)
    oval(d, (36, 48, 60, 84), c, dark, 2)
    oval(d, (38, 34, 58, 54), c, dark, 2)
    oval(d, (40, 16, 56, 36), c, dark, 2)
    oval(d, (42, 20, 48, 28), (240, 40, 40, 255))
    oval(d, (50, 20, 56, 28), (240, 40, 40, 255))
    poly(d, [(38, 40), (12, 24), (18, 20), (40, 36)], fill=c, outline=dark)
    poly(d, [(58, 40), (84, 24), (78, 20), (56, 36)], fill=c, outline=dark)
    d.line([(40, 70), (28, 90)], fill=dark, width=2)
    d.line([(56, 70), (68, 90)], fill=dark, width=2)
    return im


def monster_jackolantern():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (220, 120, 30, 255)
    dark = (140, 60, 10, 255)
    oval(d, (18, 24, 78, 80), c, dark, 2)
    rect(d, (44, 10, 52, 26), (60, 120, 40, 255))
    poly(d, [(30, 40), (40, 36), (42, 48)], fill=(20, 20, 20, 255))
    poly(d, [(66, 40), (56, 36), (54, 48)], fill=(20, 20, 20, 255))
    poly(d, [(34, 58), (48, 70), (62, 58), (48, 62)], fill=(20, 20, 20, 255))
    oval(d, (42, 50, 54, 58), (255, 220, 80, 180))
    return im


def monster_fish():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (60, 140, 200, 255)
    dark = (20, 70, 120, 255)
    oval(d, (16, 30, 72, 70), c, dark, 2)
    poly(d, [(72, 40), (90, 28), (90, 68), (72, 56)], fill=c, outline=dark)
    oval(d, (28, 42, 38, 52), (240, 240, 240, 255))
    oval(d, (30, 44, 36, 50), (20, 20, 20, 255))
    poly(d, [(40, 30), (50, 16), (56, 32)], fill=lighten(c, 1.1), outline=dark)
    return im


def monster_spirit():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (180, 220, 255, 200)
    dark = (100, 160, 220, 255)
    oval(d, (28, 16, 68, 64), c, dark, 2)
    poly(d, [(28, 50), (36, 84), (48, 60), (60, 86), (68, 50)], fill=c, outline=dark)
    oval(d, (38, 30, 46, 42), (40, 60, 120, 255))
    oval(d, (50, 30, 58, 42), (40, 60, 120, 255))
    for x, y in [(20, 20), (74, 18), (16, 50), (80, 48)]:
        oval(d, (x, y, x + 4, y + 4), (255, 255, 200, 220))
    return im


def monster_ghoul():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (140, 160, 120, 255)
    dark = (60, 80, 50, 255)
    oval(d, (26, 34, 70, 86), c, dark, 2)
    oval(d, (30, 12, 66, 50), c, dark, 2)
    oval(d, (36, 24, 46, 36), (20, 20, 20, 255))
    oval(d, (50, 24, 60, 36), (20, 20, 20, 255))
    for dx in [0, 6, 12]:
        d.line([(22, 56), (10, 48 + dx)], fill=c, width=2)
        d.line([(74, 56), (86, 48 + dx)], fill=c, width=2)
    return im


def monster_specter():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (100, 80, 140, 210)
    dark = (50, 30, 80, 255)
    oval(d, (24, 14, 72, 66), c, dark, 2)
    poly(d, [(24, 54), (32, 88), (48, 64), (64, 90), (72, 54)], fill=c, outline=dark)
    oval(d, (34, 24, 62, 50), (30, 20, 50, 255))
    oval(d, (40, 32, 46, 40), (220, 80, 80, 255))
    oval(d, (50, 32, 56, 40), (220, 80, 80, 255))
    return im


def monster_lemora():
    im = blank()
    d = ImageDraw.Draw(im)
    c = (90, 110, 140, 255)
    dark = (40, 50, 70, 255)
    oval(d, (14, 36, 78, 68), c, dark, 2)
    oval(d, (18, 40, 36, 64), (60, 80, 100, 255), dark, 1)
    for y in range(44, 62, 4):
        d.line([(20, y), (34, y)], fill=dark, width=1)
    oval(d, (60, 46, 68, 54), (240, 240, 240, 255))
    oval(d, (62, 48, 66, 52), (20, 20, 20, 255))
    poly(d, [(78, 44), (92, 36), (92, 68), (78, 60)], fill=c, outline=dark)
    return im


def monster_sylph():
    im = blank()
    d = ImageDraw.Draw(im)
    body = (220, 240, 255, 230)
    wing = (160, 220, 255, 180)
    dark = (80, 140, 180, 255)
    oval(d, (8, 20, 40, 56), wing, dark, 1)
    oval(d, (56, 20, 88, 56), wing, dark, 1)
    oval(d, (36, 28, 60, 72), body, dark, 2)
    oval(d, (38, 12, 58, 36), body, dark, 2)
    poly(d, [(40, 16), (36, 4), (48, 12)], fill=(180, 230, 255, 255))
    poly(d, [(56, 16), (60, 4), (48, 12)], fill=(180, 230, 255, 255))
    oval(d, (42, 20, 46, 24), (40, 80, 120, 255))
    oval(d, (50, 20, 54, 24), (40, 80, 120, 255))
    return im


MONSTERS = {
    "zombie": monster_zombie,
    "skeleton": monster_skeleton,
    "orc": monster_orc,
    "ghost": monster_ghost,
    "crab": monster_crab,
    "spider": monster_spider,
    "snake": monster_snake,
    "scorpion": monster_scorpion,
    "wolf": monster_wolf,
    "harpy": monster_harpy,
    "centipede": monster_centipede,
    "plant": monster_plant,
    "horse": monster_horse,
    "unicorn": monster_unicorn,
    "salamander": monster_salamander,
    "carbuncle": monster_carbuncle,
    "cat": monster_cat,
    "kappa": monster_kappa,
    "cockatrice": monster_cockatrice,
    "parasite": monster_parasite,
    "mantis": monster_mantis,
    "jackolantern": monster_jackolantern,
    "fish": monster_fish,
    "spirit": monster_spirit,
    "ghoul": monster_ghoul,
    "specter": monster_specter,
    "lemora": monster_lemora,
    "sylph": monster_sylph,
    "leafling": monster_mantis,
    "sparkit": monster_salamander,
    "aqualing": monster_fish,
    "king-slime": monster_ghost,  # replaced below
}


def monster_king_slime():
    im = blank()
    d = ImageDraw.Draw(im)
    body = (70, 180, 120, 255)
    dark = (20, 100, 60, 255)
    oval(d, (12, 28, 84, 88), body, dark, 2)
    oval(d, (22, 40, 74, 82), lighten(body, 1.1), dark, 1)
    # crown
    poly(d, [(30, 28), (34, 12), (42, 24), (48, 8), (54, 24), (62, 12), (66, 28)], fill=(220, 180, 40, 255), outline=(140, 100, 20, 255))
    oval(d, (34, 44, 44, 56), (20, 40, 30, 255))
    oval(d, (52, 44, 62, 56), (20, 40, 30, 255))
    rect(d, (40, 62, 56, 68), (20, 40, 30, 255))
    return im


MONSTERS["king-slime"] = monster_king_slime


def write_icon(name: str, draw_fn) -> None:
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im))
    path = ICON_OUT / f"{name}.png"
    im.save(path)
    print(f"icon {path.relative_to(ROOT)}")


def iron_sword(d):
    d.rectangle([7, 1, 9, 11], fill=(160, 170, 190, 255))
    d.rectangle([5, 11, 11, 12], fill=(120, 90, 40, 255))
    d.rectangle([7, 12, 9, 15], fill=(100, 70, 30, 255))
    d.point((8, 1), fill=(220, 230, 240, 255))


def steel_sword(d):
    d.rectangle([7, 1, 9, 11], fill=(200, 210, 230, 255))
    d.rectangle([4, 11, 12, 12], fill=(90, 90, 100, 255))
    d.rectangle([7, 12, 9, 15], fill=(70, 70, 80, 255))
    d.line([(7, 3), (9, 3)], fill=(255, 255, 255, 255))


def hi_potion(d):
    d.rectangle([5, 5, 11, 14], fill=(200, 40, 40, 255))
    d.rectangle([6, 3, 10, 5], fill=(180, 180, 180, 255))
    d.rectangle([7, 1, 9, 3], fill=(160, 160, 160, 255))
    d.rectangle([6, 7, 10, 9], fill=(255, 180, 180, 255))


def elixir(d):
    d.rectangle([5, 5, 11, 14], fill=(180, 80, 220, 255))
    d.rectangle([6, 3, 10, 5], fill=(220, 200, 80, 255))
    d.rectangle([7, 1, 9, 3], fill=(200, 180, 60, 255))
    d.point((8, 9), fill=(255, 255, 200, 255))


def panacea(d):
    d.rectangle([5, 5, 11, 14], fill=(40, 180, 100, 255))
    d.rectangle([6, 3, 10, 5], fill=(220, 220, 220, 255))
    d.ellipse([6, 7, 10, 12], fill=(255, 255, 180, 255))


def capture_orb(d):
    d.ellipse([2, 2, 13, 13], fill=(200, 50, 50, 255), outline=(40, 40, 40, 255))
    d.rectangle([2, 7, 13, 9], fill=(240, 240, 240, 255))
    d.ellipse([6, 6, 10, 10], fill=(240, 240, 240, 255), outline=(40, 40, 40, 255))


def iron_shield(d):
    d.polygon([(8, 1), (14, 4), (13, 12), (8, 15), (3, 12), (2, 4)], fill=(140, 150, 170, 255), outline=(70, 80, 100, 255))
    d.rectangle([7, 5, 9, 11], fill=(200, 200, 210, 255))


def steel_armor(d):
    d.rectangle([4, 4, 12, 14], fill=(150, 160, 180, 255), outline=(70, 80, 100, 255))
    d.rectangle([6, 2, 10, 5], fill=(130, 140, 160, 255))
    d.line([(8, 5), (8, 13)], fill=(220, 220, 230, 255))


def mage_hat(d):
    d.polygon([(8, 1), (14, 10), (2, 10)], fill=(80, 50, 160, 255), outline=(40, 20, 90, 255))
    d.ellipse([3, 9, 13, 13], fill=(80, 50, 160, 255), outline=(40, 20, 90, 255))
    d.ellipse([6, 3, 10, 7], fill=(220, 200, 60, 255))


def ring(d):
    d.ellipse([3, 4, 12, 13], outline=(220, 180, 40, 255), width=2)
    d.ellipse([6, 2, 10, 6], fill=(80, 180, 255, 255))


def book(d):
    d.rectangle([3, 2, 13, 14], fill=(120, 60, 40, 255), outline=(70, 30, 20, 255))
    d.line([(8, 2), (8, 14)], fill=(220, 200, 160, 255))
    d.rectangle([4, 4, 7, 6], fill=(220, 200, 160, 255))


def scroll(d):
    d.rectangle([4, 2, 12, 14], fill=(230, 210, 160, 255), outline=(160, 130, 80, 255))
    d.line([(6, 5), (10, 5)], fill=(100, 80, 40, 255))
    d.line([(6, 8), (10, 8)], fill=(100, 80, 40, 255))
    d.line([(6, 11), (9, 11)], fill=(100, 80, 40, 255))


def knife(d):
    d.polygon([(8, 1), (11, 10), (8, 12), (5, 10)], fill=(190, 200, 220, 255), outline=(90, 100, 120, 255))
    d.rectangle([7, 12, 9, 15], fill=(120, 80, 40, 255))


def poison_vial(d):
    d.rectangle([6, 5, 10, 14], fill=(80, 180, 40, 255), outline=(40, 100, 20, 255))
    d.rectangle([7, 2, 9, 5], fill=(180, 180, 180, 255))
    d.point((8, 9), fill=(200, 255, 120, 255))


def salts(d):
    d.ellipse([3, 5, 13, 14], fill=(220, 220, 230, 255), outline=(140, 140, 150, 255))
    d.rectangle([6, 2, 10, 6], fill=(180, 180, 190, 255))
    for x, y in [(6, 8), (9, 9), (7, 11)]:
        d.point((x, y), fill=(160, 160, 170, 255))


def badge(d):
    d.ellipse([2, 2, 13, 13], fill=(220, 180, 40, 255), outline=(140, 100, 20, 255))
    d.ellipse([5, 5, 10, 10], fill=(80, 140, 220, 255))


def lucky(d):
    d.ellipse([3, 3, 12, 12], fill=(80, 180, 100, 255), outline=(40, 100, 50, 255))
    d.polygon([(8, 4), (9, 7), (12, 7), (10, 9), (11, 12), (8, 10), (5, 12), (6, 9), (4, 7), (7, 7)], fill=(240, 220, 60, 255))


def leather_patch(d):
    d.rectangle([3, 3, 13, 13], fill=(150, 100, 50, 255), outline=(90, 60, 30, 255))
    d.line([(5, 5), (11, 11)], fill=(100, 70, 30, 255))
    d.line([(11, 5), (5, 11)], fill=(100, 70, 30, 255))


def mystic_cloth(d):
    d.polygon([(3, 4), (13, 4), (12, 13), (4, 13)], fill=(100, 80, 180, 255), outline=(50, 40, 100, 255))
    d.point((8, 8), fill=(220, 200, 255, 255))
    d.point((6, 6), fill=(220, 200, 255, 255))


ICONS = {
    "iron-sword": iron_sword,
    "steel-sword": steel_sword,
    "hi-potion": hi_potion,
    "elixir": elixir,
    "panacea": panacea,
    "capture-orb": capture_orb,
    "iron-shield": iron_shield,
    "steel-armor": steel_armor,
    "mage-hat": mage_hat,
    "focus-ring": ring,
    "skill-book": book,
    "warp-scroll": scroll,
    "throwing-knife": knife,
    "poison-vial": poison_vial,
    "smelling-salts": salts,
    "traveler-badge": badge,
    "lucky-charm": lucky,
    "leather-patch": leather_patch,
    "mystic-cloth": mystic_cloth,
}


def main() -> None:
    for key, fn in MONSTERS.items():
        save_rgba(fn(), MONSTER_OUT / f"monster-{key}-01.png")
    for name, fn in ICONS.items():
        write_icon(name, fn)
    print(f"done {len(MONSTERS)} monsters {len(ICONS)} icons")


if __name__ == "__main__":
    main()
