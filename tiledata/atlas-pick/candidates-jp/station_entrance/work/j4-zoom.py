import sys
from PIL import Image
# usage: j4-zoom.py out.png scale in1.png in2.png ...  (checker background, side by side)
out, sc, *ins = sys.argv[1:]; sc = int(sc)
ims = [Image.open(p).convert('RGBA') for p in ins]
W = sum(i.width*sc + 8 for i in ims); H = max(i.height for i in ims)*sc
bg = Image.new('RGBA', (W, H), (150,150,150,255)); x = 0
for im in ims:
    big = im.resize((im.width*sc, im.height*sc), Image.NEAREST)
    bg.alpha_composite(big, (x, 0)); x += big.width + 8
bg.convert('RGB').save(out)
