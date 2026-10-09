"""verify-map.json(1·3층 칸 번호)을 시트로 그린다. 물은 0프레임. 사용: render_map.py <bake 폴더> <out.png> [x0 y0 w h] [배율]"""
import json, sys
from pathlib import Path
from PIL import Image
T = 16
d = Path(sys.argv[1]); out = sys.argv[2]
import os
m = json.loads((d / os.environ.get("MAPFILE", "verify-map.json")).read_text())
ts = json.loads((d / "tileset.json").read_text())
sheet = Image.open(d / "sheet.png").convert("RGBA")
cols = ts["tilesPerRow"]
x0, y0, w, h = (int(v) for v in sys.argv[3:7]) if len(sys.argv) >= 7 else (0, 0, m["width"], m["height"])
sc = int(sys.argv[7]) if len(sys.argv) >= 8 else 3
im = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 255))
def put(i, x, y):
    if i < 0: return
    r, c = divmod(i, cols)
    im.alpha_composite(sheet.crop((c * T, r * T, c * T + T, r * T + T)), ((x - x0) * T, (y - y0) * T))
for y in range(y0, y0 + h):
    for x in range(x0, x0 + w):
        put(m["lower"][y * m["width"] + x], x, y)
for y in range(y0, y0 + h):
    for x in range(x0, x0 + w):
        put(m["upper"][y * m["width"] + x], x, y)
im.resize((im.width * sc, im.height * sc), 0).save(out)
