"""Blind calibration sheet: new props mixed with Beodeul originals under neutral codes (judge does not know which is which).
  python3 qa/blind.py <out_dir> [seed]   -> sheet-<n>.png pages (6x + 1x per piece) + key.json (code -> id, origin)
"""
import json, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import refs as R
spec = json.loads((HERE / "spec.json").read_text())["items"]
CONTROLS = ["bd-pick-snowfield-rock", "bd-pick-mining-valley-slagrock", "bd-pick-deep-forest-path-stones-a", "bd-pick-deep-forest-path-cairn",
            "bd-mpart-bush-c", "bd-mpart-bush-e", "bd-pick-deep-forest-path-fern-a", "bd-pick-deep-forest-path-heath-a",
            "bd-pick-deep-forest-path-wild-b", "bd-pick-deep-forest-path-log-fallen", "bd-pick-swamp-stilt-moss-log",
            "bd-pick-deep-forest-path-stump", "bd-pick-deep-forest-path-toadstools-a", "bd-pick-deep-forest-path-toadstools-c",
            "bd-pick-desert-oasis-rock", "bd-pick-deep-forest-path-wild-a"]

def card(im, code):
    big = R.over(im); h, w = big.shape[:2]
    z = Image.fromarray(big).resize((w * 6, h * 6), Image.NEAREST)
    W = max(z.width, 120); H = z.height + h + 34
    c = Image.new("RGB", (W + 16, H), (40, 40, 40))
    c.paste(z, (8, 22)); c.paste(Image.fromarray(big).convert("RGB"), (8, 26 + z.height))
    ImageDraw.Draw(c).text((8, 4), code, fill=(255, 255, 255))
    return c

if __name__ == "__main__":
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    pool = [("new", it["id"], np.array(Image.open(HERE / "out" / f"{it['id']}.png").convert("RGBA"))) for it in spec]
    pool += [("orig", k, R.kit_image(k)) for k in CONTROLS]
    rnd.shuffle(pool)
    key = {}
    cards = []
    for n, (origin, iid, im) in enumerate(pool, 1):
        code = f"P{n:02d}"; key[code] = {"id": iid, "origin": origin}; cards.append(card(im, code))
    page, pages, x, y, rowh, PW = None, [], 0, 0, 0, 1800
    def newpage():
        return Image.new("RGB", (PW, 1500), (40, 40, 40))
    page = newpage()
    for c in cards:
        if x + c.width > PW: x = 0; y += rowh + 6; rowh = 0
        if y + c.height > page.height: pages.append(page.crop((0, 0, PW, y))); page = newpage(); x = y = rowh = 0
        page.paste(c, (x, y)); x += c.width + 6; rowh = max(rowh, c.height)
    pages.append(page.crop((0, 0, PW, y + rowh)))
    for i, p in enumerate(pages, 1): p.save(out / f"sheet-{i}.png")
    (out / "key.json").write_text(json.dumps(key, indent=1))
    print(len(pages), "pages", len(pool), "pieces")
