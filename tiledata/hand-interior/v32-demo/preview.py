# 작업용 미리보기: python3 tiledata/hand-interior/v32-demo/preview.py OUT.png name...
import sys, os
sys.path.insert(0, 'tiledata/hand-interior/v32-demo')
import compare
from PIL import Image
names = sys.argv[2:]
tiles = [compare.card(n, 4) for n in names]
W = max(t.width for t in tiles); Hh = sum(t.height + 6 for t in tiles)
o = Image.new('RGBA', (W, Hh), (30, 28, 34, 255)); y = 0
for t in tiles: o.alpha_composite(t, (0, y)); y += t.height + 6
o.save(sys.argv[1])
