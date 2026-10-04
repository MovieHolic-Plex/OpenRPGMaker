# Render atlas_biome_interior maps from their four layers with the bundled sheet (frame 0 of animated strips).
# stdin: JSON [{out, width, height, lowerTiles, lowerOverlayTiles, upperTiles, upperOverlayTiles, marks?:[{x,y}], scale?}]
# Marks draw a red 1px box round a cell (error pictures). Nearest-neighbour scaling only.
import sys, json
from PIL import Image, ImageDraw
SHEET = Image.open('public/assets/atlas-interior/interior-chipset.png').convert('RGBA')
TPR = SHEET.width // 16
def tile(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))
cache = {}
for job in json.load(sys.stdin):
    W, H = job['width'], job['height']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for key in ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles'):
        for i, t in enumerate(job.get(key) or []):
            if t is None or t < 0: continue
            if t not in cache: cache[t] = tile(t)
            im.alpha_composite(cache[t], ((i % W) * 16, (i // W) * 16))
    s = job.get('scale', 1)
    if s != 1: im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for m in job.get('marks', []):
        x, y = m['x'] * 16 * s, m['y'] * 16 * s
        d.rectangle((x, y, x + 16 * s - 1, y + 16 * s - 1), outline=(255, 40, 40, 255), width=max(1, s))
    im.convert('RGB').save(job['out'])
    print(job['out'])
