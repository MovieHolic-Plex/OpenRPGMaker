import sys, os, glob
from PIL import Image, ImageDraw
d = sys.argv[1]; out = sys.argv[2]; pat = sys.argv[3] if len(sys.argv) > 3 else '*'
fs = sorted(glob.glob(os.path.join(d, pat + '.png')))
ims = [(os.path.basename(f)[:-4], Image.open(f).convert('RGBA')) for f in fs]
k = 2; cols = 10; cw = max(i.width for _, i in ims) * k + 8; ch = max(i.height for _, i in ims) * k + 16
cw = min(cw, 140); 
rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGB', (cols * cw, rows * ch), (60, 70, 60)); dr = ImageDraw.Draw(sh)
for i, (n, im) in enumerate(ims):
    x, y = (i % cols) * cw, (i // cols) * ch
    im2 = im.resize((im.width * k, im.height * k), Image.NEAREST)
    sh.paste(im2, (x + 4, y + 12), im2); dr.text((x + 2, y), n[:20], fill=(255, 255, 255))
sh.save(out); print(sh.size)
