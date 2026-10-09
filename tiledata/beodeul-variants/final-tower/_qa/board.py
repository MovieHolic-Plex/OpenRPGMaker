import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ft_base import *
def show(items, path, scale=3, cols=6, bg=(64, 66, 92, 255)):
    cw = max(i.width for _, i in items) * scale + 12; ch = max(i.height for _, i in items) * scale + 22
    rows = (len(items) + cols - 1) // cols
    bd = Image.new('RGBA', (min(cols, len(items)) * cw, rows * ch), (28, 30, 34, 255)); d = ImageDraw.Draw(bd)
    for k, (n, im) in enumerate(items):
        x = k % cols * cw + 6; y = k // cols * ch + 4
        d.rectangle((x, y, x + im.width * scale - 1, y + im.height * scale - 1), fill=bg)
        bd.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y))
        d.text((x, y + im.height * scale + 2), '%d %s' % (k + 1, n), fill=(220, 220, 230, 255))
    bd.save(path); print(path, bd.size)
