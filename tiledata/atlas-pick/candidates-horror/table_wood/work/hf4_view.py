"""보기용: python3 hf4_view.py <slug> [slug...] → work/hf4_view.png (A B C 를 마룻바닥·벽지 위에 8배, 위 = 밝은 방, 아래 = 어두운 방)"""
import sys, os
from PIL import Image
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
S = 8
FLOOR = (0x5f, 0x3d, 0x21); FLOOR2 = (0x4a, 0x2c, 0x16); WALL = (0xa6, 0x9e, 0x80)
def strip(slug, dark):
    ims = [Image.open(os.path.join(H, slug, f'hf4-{k}.png')).convert('RGBA') for k in 'ABC']
    w, h = ims[0].size; pad = 6
    W = (w + pad) * 3 + pad; Hh = h + 2 * pad + 8
    bg = Image.new('RGBA', (W, Hh), FLOOR + (255,))
    px = bg.load()
    for y in range(Hh):
        for x in range(W):
            if y < 8: px[x, y] = WALL + (255,)
            elif (x // 16 + y // 16) % 2: px[x, y] = FLOOR2 + (255,)
    for i, im in enumerate(ims):
        bg.alpha_composite(im, (pad + i * (w + pad), 8 + pad))
    if dark:
        d = bg.convert('RGB').point(lambda v: int(v * 0.24)); bg = d.convert('RGBA')
    return bg.resize((W * S, Hh * S), Image.NEAREST)
out = []
for s in sys.argv[1:]:
    out += [strip(s, False), strip(s, True)]
W = max(i.width for i in out); Hh = sum(i.height for i in out) + 8 * len(out)
sheet = Image.new('RGBA', (W, Hh), (20, 20, 20, 255)); y = 0
for i in out: sheet.paste(i, (0, y)); y += i.height + 8
sheet.save(os.path.join(os.path.dirname(__file__), 'hf4_view.png')); print(sheet.size)
