import sys
from PIL import Image
# usage: s2view.py out.png scale slug1 slug2 ...   (A B C 를 가로로, 기물을 세로로)
out, sc = sys.argv[1], int(sys.argv[2]); slugs = sys.argv[3:]
base = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/'
rows = []
for s in slugs:
    ims = [Image.open(f'{base}{s}/s2-{t}.png').convert('RGBA') for t in 'ABC']
    rows.append(ims)
pad = 6
Wm = max(sum(i.width * sc + pad for i in r) for r in rows); Hm = sum(max(i.height for i in r) * sc + pad for r in rows)
bg = Image.new('RGBA', (Wm, Hm), (150, 150, 160, 255))
y = 0
for r in rows:
    x = 0
    for im in r:
        big = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
        # 체크무늬 대신 옅은 바탕
        bg.alpha_composite(big, (x, y)); x += big.width + pad
    y += max(i.height for i in r) * sc + pad
bg.save(out)
