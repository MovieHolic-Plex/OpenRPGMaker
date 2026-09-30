"""candidates-jp/<slug>/j2-*.png 를 나란히 6배 확대해 work/view-<slug>.png 로 (바닥색 위)."""
import sys, glob, os
from PIL import Image
k = int(os.environ.get('K', '6'))
for slug in sys.argv[1:]:
    fs = sorted(f for f in glob.glob(f'candidates-jp/{slug}/j2-?.png'))
    ims = [Image.open(f).convert('RGBA') for f in fs]
    if not ims: continue
    W = sum(i.width * k + 12 for i in ims) + 12; H = max(i.height for i in ims) * k + 24
    bg = Image.new('RGBA', (W, H), (150, 154, 150, 255))
    x = 12
    for im in ims:
        big = im.resize((im.width * k, im.height * k), Image.NEAREST)
        bg.alpha_composite(big, (x, 12)); x += big.width + 12
    bg.save(f'work/view-{slug}.png')
    print(f'work/view-{slug}.png', [os.path.basename(f) for f in fs])
