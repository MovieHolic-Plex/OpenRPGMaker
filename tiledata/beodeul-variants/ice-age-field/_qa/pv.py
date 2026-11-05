import sys, os; HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw
import iaf_pieces as A, iaf_props as B, iaf_ground as G
names = sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] else None
fns = []
for mod in (A, B):
    for n in dir(mod):
        f = getattr(mod, n)
        if callable(f) and not n.startswith('_') and getattr(f, '__module__', '') == mod.__name__ and n not in ('lump','slab','snowcap'):
            fns.append((n, f))
if names: fns = [(n, f) for n, f in fns if n in names]
ims = []
for n, f in fns:
    try: ims.append((n, f()))
    except Exception as e: print('ERR', n, e)
S = int(sys.argv[2]) if len(sys.argv) > 2 else 3
bg = Image.fromarray(G.snow_rgb(256, 256, 3)).convert('RGBA')
cols = 6; cw = max(i.width for _, i in ims) * S + 12; ch = max(i.height for _, i in ims) * S + 20
rows = (len(ims) + cols - 1) // cols
o = Image.new('RGBA', (cols * cw, rows * ch), (40, 44, 52, 255)); d = ImageDraw.Draw(o)
for k, (n, im) in enumerate(ims):
    x = (k % cols) * cw + 6; y = (k // cols) * ch + 14
    b = bg.crop((0, 0, im.width, im.height)).copy(); b.alpha_composite(im)
    o.alpha_composite(b.resize((im.width * S, im.height * S), Image.NEAREST), (x, y))
    d.text((x, y - 12), '%s %dx%d' % (n, im.width // 16, im.height // 16), fill=(230, 230, 230, 255))
o.save(os.path.join(HERE, '_qa', 'pv.png')); print(o.size, len(ims))
