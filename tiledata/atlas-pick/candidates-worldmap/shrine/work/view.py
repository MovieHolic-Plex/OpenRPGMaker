import sys, glob, os
from PIL import Image
# usage: view.py slug out.png [scale]  → wv8-*.png 모아서 초록 바탕 위에 확대
slug, out = sys.argv[1], sys.argv[2]
sc = int(sys.argv[3]) if len(sys.argv) > 3 else 8
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', slug)
fs = sorted(glob.glob(os.path.join(d, 'wv8-?.png')))
ims = [Image.open(f).convert('RGBA') for f in fs]
W = sum(i.width for i in ims) * sc + 8 * (len(ims) + 1); H = max(i.height for i in ims) * sc + 16
bg = Image.new('RGBA', (W, H), (110, 160, 80, 255))
x = 8
for i in ims:
    b = i.resize((i.width * sc, i.height * sc), Image.NEAREST)
    bg.alpha_composite(b, (x, 8)); x += b.width + 8
bg.convert('RGB').save(out)
