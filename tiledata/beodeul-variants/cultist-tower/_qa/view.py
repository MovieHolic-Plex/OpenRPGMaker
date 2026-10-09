import sys; sys.path.insert(0, '..')
from PIL import Image
def sheet(items, out, scale=3, bg=(70, 66, 60, 255)):
    W = sum(i.width for i in items) + 6 * len(items) + 6; H = max(i.height for i in items) + 12
    o = Image.new('RGBA', (W, H), bg); x = 6
    for i in items: o.alpha_composite(i, (x, H - 6 - i.height)); x += i.width + 6
    o.resize((W * scale, H * scale), Image.NEAREST).save(out)
