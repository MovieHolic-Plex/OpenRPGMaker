import sys
from PIL import Image
slug = sys.argv[1]; sc = int(sys.argv[2]) if len(sys.argv) > 2 else 4
base = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/' + slug
ims = []
for X in 'ABC':
    try: ims.append(Image.open('%s/s3-%s.ctx.png' % (base, X)).convert('RGB'))
    except Exception as e: pass
x4 = []
for X in 'ABC':
    try: x4.append(Image.open('%s/s3-%s-x4.png' % (base, X)).convert('RGBA'))
    except Exception: pass
W = sum(i.width for i in ims) + 8 * len(ims)
H = max(i.height for i in ims) + max([i.height for i in x4] + [0]) + 8
sheet = Image.new('RGB', (W, H), (40, 40, 40))
x = 0
for i in ims: sheet.paste(i, (x, 0)); x += i.width + 8
x = 0; y = max(i.height for i in ims) + 8
for i in x4:
    bg = Image.new('RGB', i.size, (90, 90, 90)); bg.paste(i, (0, 0), i); sheet.paste(bg, (x, y)); x += i.width + 8
sheet.save('/tmp/s3-sheet-%s.png' % slug)
