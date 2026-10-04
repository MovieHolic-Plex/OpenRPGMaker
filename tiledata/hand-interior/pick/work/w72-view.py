#!/usr/bin/env python3
"""w72 보조: python3 w72-view.py out.png scale file1.png file2.png ...  (회색 바탕에 나란히)"""
import sys
from PIL import Image
out, sc = sys.argv[1], int(sys.argv[2]); ims = [Image.open(f).convert('RGBA') for f in sys.argv[3:]]
W = sum(i.width * sc + 12 for i in ims) + 12; H = max(i.height * sc for i in ims) + 24
bg = Image.new('RGBA', (W, H), (92, 84, 76, 255)); x = 12
for i in ims:
    b = i.resize((i.width * sc, i.height * sc), Image.NEAREST); bg.alpha_composite(b, (x, 12)); x += b.width + 12
bg.save(out)
