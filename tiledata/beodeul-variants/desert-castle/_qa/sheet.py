import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dc_base import *
import importlib
from PIL import ImageDraw
def sheet(items, out, scale=3, cols=4):
    bgc = A.ground_sand()
    cw = max(i.width for _, i in items) * scale + 12; ch = max(i.height for _, i in items) * scale + 24
    rows = (len(items) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * cw, rows * ch), (40, 40, 48, 255)); d = ImageDraw.Draw(sh)
    for k, (n, im) in enumerate(items):
        x = (k % cols) * cw + 6; y = (k // cols) * ch + 6
        bg = Image.new('RGBA', im.size)
        for yy in range(0, im.height, 48):
            for xx in range(0, im.width, 48): bg.alpha_composite(bgc, (xx, yy))
        bg = bg.crop((0, 0, im.width, im.height)); bg.alpha_composite(im)
        sh.alpha_composite(bg.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y))
        d.text((x, y + im.height * scale + 2), '%d %s' % (k + 1, n), fill=(255, 255, 255, 255))
    sh.save(out)
if __name__ == '__main__':
    mod = importlib.import_module(sys.argv[1]); names = sys.argv[3].split(',')
    sheet([(n, getattr(mod, n)()) for n in names], sys.argv[2], scale=int(sys.argv[4]) if len(sys.argv) > 4 else 3, cols=int(sys.argv[5]) if len(sys.argv) > 5 else 4)
