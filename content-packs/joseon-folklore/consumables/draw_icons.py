#!/usr/bin/env python3
"""Original native 32px art. No sampled/recoloured assets or image API.

Run from any directory: python3 content-packs/joseon-folklore/consumables/draw_icons.py
Only writes assets/ and review/ under this role directory. Does not publish.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
REVIEW = ROOT / "review"
AUTHOR = "GPT 6.1 sol high / consumables worker, original integer-coordinate pixel art, 2026-10-04"
# Warm outlines, separate green herb / celadon bowl / paper / red seal / ivory / straw ramps.
PALETTE = {
    "ink": "#34272a", "brown": "#684335", "clay": "#a36846", "sand": "#d5a05f",
    "cream": "#f4d48a", "light": "#fff1c1", "g0": "#324736", "g1": "#486643",
    "g2": "#6c924e", "g3": "#a7bd65", "jade0": "#405c59", "jade1": "#66877c",
    "jade2": "#a5c0a4", "jade3": "#dce0ba", "tea0": "#70422b", "tea1": "#a86a32",
    "tea2": "#d7a24f", "red0": "#752e36", "red1": "#b94a40", "red2": "#e87951",
    "gold0": "#9d6532", "gold1": "#d8a343", "ivory0": "#9b876c", "ivory1": "#c8b79a",
    "ivory2": "#e8dcc0", "ivory3": "#fff4dc", "straw0": "#785b32", "straw1": "#aa7d3c",
    "straw2": "#d4a959", "straw3": "#f3cd7b",
}

def canvas():
    return Image.new("RGBA", (32, 32), (0, 0, 0, 0))

def poly(im, pts, col):
    ImageDraw.Draw(im).polygon(pts, fill=PALETTE[col])

def line(im, pts, col, width=1):
    ImageDraw.Draw(im).line(pts, fill=PALETTE[col], width=width)

def rect(im, box, col):
    ImageDraw.Draw(im).rectangle(box, fill=PALETTE[col])

def mugwort():
    im = canvas()
    # Open folded mulberry-paper packet, offset pills and serrated herb sprig.
    poly(im, [(4,18),(8,13),(22,13),(28,19),(25,27),(8,28),(4,24)], "ink")
    poly(im, [(5,19),(9,15),(21,15),(27,19),(24,26),(9,27),(5,23)], "sand")
    poly(im, [(5,19),(11,21),(14,27),(9,27),(5,23)], "cream")
    poly(im, [(18,21),(27,19),(24,26),(15,27)], "clay")
    poly(im, [(10,10),(16,9),(20,12),(20,17),(17,20),(11,19),(8,15),(8,12)], "ink")
    poly(im, [(11,11),(16,10),(19,13),(19,16),(16,19),(12,18),(9,15),(9,12)], "g1")
    poly(im, [(11,11),(15,11),(17,12),(16,15),(11,15),(10,13)], "g3")
    poly(im, [(16,15),(19,14),(19,16),(16,19),(12,18)], "g0")
    rect(im, (10,12,11,13), "light")
    poly(im, [(19,17),(23,16),(26,19),(26,22),(23,24),(19,23),(17,20)], "ink")
    poly(im, [(19,18),(23,17),(25,19),(25,21),(23,23),(19,22),(18,20)], "g1")
    line(im, [(19,19),(21,18),(23,18)], "g3")
    rect(im, (21,21,24,21), "g0")
    line(im, [(18,11),(22,7),(26,4)], "g0")
    poly(im, [(20,9),(19,6),(21,6),(22,3),(23,7)], "g2")
    poly(im, [(22,9),(26,9),(27,6),(24,7),(24,6)], "g2")
    line(im, [(21,7),(22,6)], "g3")
    return im

def ginseng():
    im = canvas()
    # Celadon footed bowl: amber surface and recognizable branching ginseng root.
    line(im, [(10,9),(9,7),(11,5),(11,3)], "jade2")
    line(im, [(16,8),(15,6),(17,4)], "jade3")
    poly(im, [(4,14),(7,11),(24,11),(28,14),(28,19),(24,24),(21,26),(11,26),(8,24),(4,19)], "ink")
    poly(im, [(5,16),(27,16),(27,19),(23,24),(20,25),(12,25),(9,23),(5,19)], "jade1")
    poly(im, [(6,17),(10,20),(12,23),(19,24),(12,24),(9,22),(6,19)], "jade2")
    poly(im, [(21,19),(27,16),(27,19),(23,24),(20,25),(18,25)], "jade0")
    poly(im, [(5,14),(8,12),(23,12),(27,14),(26,17),(23,19),(9,19),(5,17)], "jade3")
    poly(im, [(7,14),(10,13),(22,13),(25,14),(25,16),(22,18),(10,18),(7,16)], "tea0")
    poly(im, [(8,14),(11,14),(22,14),(24,15),(21,17),(10,17),(8,16)], "tea1")
    line(im, [(10,14),(13,14)], "tea2")
    line(im, [(18,8),(17,10),(18,12),(17,14),(17,17)], "brown", 3)
    line(im, [(18,8),(17,10),(18,12),(17,14),(17,16)], "cream")
    line(im, [(17,13),(14,15),(12,15)], "cream")
    line(im, [(18,12),(21,13),(22,13)], "sand")
    line(im, [(17,16),(19,17),(21,16)], "sand")
    line(im, [(17,16),(15,17),(14,17)], "light")
    rect(im, (11,26,21,27), "ink")
    rect(im, (12,26,20,26), "jade0")
    return im

def purification():
    im = canvas()
    # Tall flat yellow talisman, folded corner and vermilion water glyph.
    poly(im, [(9,3),(21,3),(25,7),(25,26),(22,29),(7,26),(7,5)], "ink")
    poly(im, [(10,4),(20,4),(24,8),(24,25),(21,28),(8,25),(8,6)], "sand")
    poly(im, [(10,4),(20,4),(21,9),(23,9),(22,26),(9,24),(9,6)], "cream")
    line(im, [(10,5),(19,5)], "light")
    poly(im, [(20,4),(24,8),(20,8)], "light")
    line(im, [(20,4),(20,8),(24,8)], "gold0")
    rect(im, (11,8,16,9), "red0")
    line(im, [(14,8),(14,12),(12,12),(12,14),(19,14)], "red1")
    line(im, [(11,16),(13,15),(16,17),(19,16),(21,17)], "red0")
    line(im, [(11,20),(13,19),(16,21),(19,20),(21,21)], "red1")
    line(im, [(16,12),(16,15)], "red1")
    line(im, [(16,21),(16,24)], "red0")
    rect(im, (11,24,13,25), "red0")
    rect(im, (12,24,12,24), "red2")
    return im

def revival():
    im = canvas()
    # Wide folded paper charm with red cord, gold knot and ascending spirit flame.
    poly(im, [(5,13),(10,10),(23,11),(27,15),(25,25),(18,28),(6,25),(4,19)], "ink")
    poly(im, [(6,14),(10,11),(22,12),(26,15),(24,24),(18,27),(7,24),(5,19)], "sand")
    poly(im, [(6,14),(10,11),(19,12),(22,17),(18,25),(7,24),(5,19)], "cream")
    line(im, [(6,14),(18,17),(25,15)], "gold0")
    poly(im, [(22,17),(25,16),(23,23),(18,26)], "clay")
    line(im, [(10,12),(12,17),(11,24)], "red0", 3)
    line(im, [(10,12),(12,17),(11,24)], "red1")
    line(im, [(6,20),(13,18),(24,21)], "red0", 3)
    line(im, [(6,19),(13,17),(24,20)], "red1")
    poly(im, [(13,14),(16,13),(19,16),(18,20),(15,21),(12,18)], "gold0")
    poly(im, [(14,15),(16,14),(18,16),(17,19),(15,20),(13,18)], "gold1")
    rect(im, (14,15,15,16), "light")
    # Flame is asymmetric, separate from paper: no cross or borrowed religious text.
    poly(im, [(19,3),(20,7),(23,6),(25,10),(23,13),(19,13),(17,10),(18,7)], "red0")
    poly(im, [(19,5),(20,8),(23,7),(24,10),(22,12),(19,12),(18,10)], "gold1")
    poly(im, [(20,8),(21,10),(22,9),(22,11),(20,12),(19,10)], "light")
    line(im, [(11,25),(9,28)], "red0")
    line(im, [(12,25),(14,28)], "red1")
    return im

def tusk():
    im = canvas()
    poly(im, [(6,23),(8,19),(13,18),(17,15),(20,11),(22,5),(25,3),(26,8),(26,14),(23,20),(19,24),(13,27),(8,28),(5,26)], "ink")
    poly(im, [(8,23),(9,20),(14,19),(18,16),(21,12),(23,6),(25,5),(25,13),(22,19),(18,23),(12,26),(8,27),(6,25)], "ivory1")
    poly(im, [(10,20),(14,19),(18,16),(21,12),(23,6),(24,5),(23,13),(20,18),(16,21),(11,24),(8,24)], "ivory2")
    line(im, [(11,21),(16,19),(20,15),(23,9),(24,6)], "ivory3")
    poly(im, [(7,23),(9,22),(12,25),(11,27),(8,27),(6,25)], "brown")
    line(im, [(8,23),(10,25)], "clay")
    line(im, [(11,25),(16,23),(19,21)], "ivory0")
    line(im, [(17,19),(18,20)], "ivory0")
    line(im, [(20,16),(22,17)], "ivory0")
    return im

def straw():
    im = canvas()
    # Two interlinked rope loops: transparent holes, diagonal braid, loose fibres.
    poly(im, [(9,4),(16,4),(21,8),(21,14),(17,19),(10,19),(5,15),(5,9)], "ink")
    poly(im, [(10,5),(15,5),(20,9),(20,13),(16,18),(11,18),(6,14),(6,10)], "straw1")
    poly(im, [(10,6),(15,6),(18,9),(18,13),(15,16),(11,16),(8,13),(8,10)], "straw2")
    poly(im, [(11,9),(14,8),(16,10),(16,12),(14,14),(11,13),(10,11)], "ink")
    ImageDraw.Draw(im).polygon([(11,10),(14,9),(15,10),(15,12),(14,13),(12,12)], fill=(0,0,0,0))
    poly(im, [(16,12),(23,12),(27,17),(27,23),(23,27),(16,27),(12,23),(12,18)], "ink")
    poly(im, [(17,13),(22,13),(26,18),(26,22),(22,26),(17,26),(13,22),(13,19)], "straw1")
    poly(im, [(17,14),(22,14),(24,18),(24,22),(21,24),(18,24),(15,21),(15,18)], "straw2")
    poly(im, [(18,16),(21,16),(23,19),(22,22),(19,22),(17,20),(17,18)], "ink")
    ImageDraw.Draw(im).polygon([(19,17),(21,17),(22,19),(21,21),(19,21),(18,19)], fill=(0,0,0,0))
    line(im, [(7,10),(9,8),(10,6),(13,6)], "straw3")
    line(im, [(14,18),(16,15),(19,14),(22,15)], "straw3")
    for pts in [[(8,7),(10,8)],[(15,5),(15,7)],[(18,8),(16,9)],[(7,13),(9,12)],[(15,22),(17,21)],[(19,24),(20,26)],[(24,18),(26,17)],[(23,23),(24,24)]]:
        line(im, pts, "straw0")
    line(im, [(13,17),(10,21),(7,24)], "ink", 3)
    line(im, [(13,17),(10,21),(7,24)], "straw2")
    line(im, [(11,20),(12,25),(10,28)], "straw1")
    line(im, [(8,23),(4,25)], "straw3")
    return im

DRAWINGS = {"mugwort-pill": mugwort, "ginseng-tea": ginseng, "purification-charm": purification,
            "revival-charm": revival, "boar-tusk": tusk, "straw-knot": straw}

def main():
    ASSETS.mkdir(exist_ok=True)
    REVIEW.mkdir(exist_ok=True)
    manifest = []
    # Review shows exact originals at native and 6x nearest on cream AND dark backgrounds.
    sheet = Image.new("RGB", (6 * 216, 302), "#efe6d5")
    draw = ImageDraw.Draw(sheet)
    for index, (slug, render) in enumerate(DRAWINGS.items()):
        im = render()
        path = ASSETS / f"{slug}.png"
        im.save(path, optimize=False)
        # Inspect decoded originals, not only in-memory render.
        im = Image.open(path).convert("RGBA")
        box = im.getbbox()
        alphas = sorted(set(im.getchannel("A").getdata()))
        colours = len({p[:3] for p in im.getdata() if p[3]})
        assert im.size == (32, 32) and alphas == [0, 255] and colours <= 32
        assert box and min(box) >= 3 and box[2] <= 29 and box[3] <= 30
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest.append({"slug": slug, "resourceId": f"jf-icon-{slug}", "sourceFile": f"assets/{slug}.png",
                         "path": f"assets/joseon-folklore/consumables/{slug}.png", "sha256": sha,
                         "width": 32, "height": 32, "alphaValues": alphas, "opaqueColours": colours,
                         "visibleBoundsExclusive": box, "author": AUTHOR,
                         "source": "draw_icons.py", "method": "original code pixel art; no sampled raster",
                         "publication": "pending supervisor integration"})
        x = index * 216
        draw.text((x+8, 8), slug, fill="#34272a")
        sheet.paste(im, (x+10, 28), im)
        sheet.paste(im.resize((192,192), Image.Resampling.NEAREST), (x+12, 72), im.resize((192,192), Image.Resampling.NEAREST))
        draw.rectangle((x+58,25,x+96,63), fill="#292b34")
        sheet.paste(im, (x+61,28), im)
        draw.text((x+8,282), f"32px / 6x nearest / {colours} colours", fill="#34272a")
    sheet.save(REVIEW / "pilot-sheet.png")
    (ROOT / "art-manifest.json").write_text(json.dumps({"schemaVersion":1, "author":AUTHOR,
        "sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "icons":manifest}, ensure_ascii=False, indent=2)+"\n")
    print(json.dumps({"icons":len(manifest), "sheet":"review/pilot-sheet.png", "manifest":"art-manifest.json"}))

if __name__ == "__main__":
    main()
