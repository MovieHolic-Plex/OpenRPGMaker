"""r16 검수 그림: 사양(objects)의 칸을 시트에서 읽어 기물 하나로 합성하고 4배 띠 그림을 만든다.
  python3 view.py sheet <ids.json> <out.png> [scale] [cols]   ids.json = [[label, tileset, propId], ...]
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SPEC = {'jp_city_interior': ('jpInteriorSpec', 'public/assets/jp-city/jp-city-chipset.png'),
        'modern_city_interior': ('modernCityRoomSpec', 'public/assets/modern-city/modern-city-chipset.png'),
        'atlas_biome_interior': ('handInteriorSpec', 'public/assets/atlas-interior/interior-chipset.png')}
_cache = {}
def load(ts):
    if ts not in _cache:
        a, b = SPEC[ts]
        _cache[ts] = (json.load(open(f'{ROOT}/src/assets/{a}.json')), Image.open(f'{ROOT}/{b}').convert('RGBA'))
    return _cache[ts]
def render(ts, pid, sheet=None):
    sp, im = load(ts)
    if sheet is not None: im = sheet
    tpr = im.width // 16
    cells = sp['objects'][pid]['cells']
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; mx, my = min(xs), min(ys)
    out = Image.new('RGBA', ((max(xs) - mx + 1) * 16, (max(ys) - my + 1) * 16))
    for dx, dy, tid, l in sorted(cells, key=lambda c: (c[3], c[1], c[0])):
        t = im.crop(((tid % tpr) * 16, (tid // tpr) * 16, (tid % tpr) * 16 + 16, (tid // tpr) * 16 + 16))
        out.alpha_composite(t, ((dx - mx) * 16, (dy - my) * 16))
    return out
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 12)
def bg(w, h, s):
    b = Image.new('RGBA', (w * s, h * s), (150, 128, 100, 255)); d = ImageDraw.Draw(b)
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            if (x // 4 + y // 4) % 2: d.rectangle([x * s, y * s, (x + 4) * s - 1, (y + 4) * s - 1], fill=(138, 118, 92, 255))
    return b
def panel(lab, img, s):
    w, h = img.size
    b = bg(w, h, s); b.alpha_composite(img.resize((w * s, h * s), Image.NEAREST))
    d = ImageDraw.Draw(b)
    for k in range(0, h + 1, 16): d.line([(0, k * s), (w * s, k * s)], fill=(0, 0, 0, 70))
    for k in range(0, w + 1, 16): d.line([(k * s, 0), (k * s, h * s)], fill=(0, 0, 0, 70))
    one = bg(w, h, 1); one.alpha_composite(img)
    P = Image.new('RGBA', (w * s + w + 14, h * s + 20), (30, 32, 38, 255))
    P.alpha_composite(b, (2, 18)); P.alpha_composite(one, (w * s + 10, 18))
    ImageDraw.Draw(P).text((2, 2), lab[:max(14, (w * s + w) // 7)], fill=(240, 240, 240), font=FONT)
    return P
def sheet(items, out, s=4, maxw=1800):
    ps = [panel(l, render(t, p) if isinstance(p, str) else p, s) for l, t, p in items]
    rows, cur, cw = [], [], 0
    for p in ps:
        if cur and cw + p.width > maxw: rows.append(cur); cur, cw = [], 0
        cur.append(p); cw += p.width + 6
    if cur: rows.append(cur)
    W = max(sum(p.width + 6 for p in r) for r in rows); H = sum(max(p.height for p in r) + 6 for r in rows)
    C = Image.new('RGBA', (W, H), (20, 22, 26, 255)); y = 0
    for r in rows:
        x = 0
        for p in r: C.alpha_composite(p, (x, y)); x += p.width + 6
        y += max(p.height for p in r) + 6
    C.save(out)
if __name__ == '__main__' and sys.argv[1] == 'sheet':
    sheet(json.load(open(sys.argv[2])), sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 4)
