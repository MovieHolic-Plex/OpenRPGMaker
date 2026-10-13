#!/usr/bin/env python3
"""빠른 확대 보기: python3 view.py <모듈> [id ...] [-z 5] [-o /tmp/ph_v.png] — 흙 바탕 위에 나란히."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
args = sys.argv[1:]; z = 5; out = '/tmp/ph_v.png'; bg = 'dirt'
if '-z' in args: i = args.index('-z'); z = int(args[i + 1]); del args[i:i + 2]
if '-o' in args: i = args.index('-o'); out = args[i + 1]; del args[i:i + 2]
if '-g' in args: i = args.index('-g'); bg = args[i + 1]; del args[i:i + 2]
mod = importlib.import_module(args[0]); R = mod.R
ids = args[1:] or [it['id'] for it in R.items]
import terrain as T
g = T.R.render(T.R.by[bg]).img()
ims = [R.render(R.by[i]).img() for i in ids]
W = sum(i.width for i in ims) + 8 * (len(ims) + 1); H = max(i.height for i in ims) + 16
o = Image.new('RGBA', (W, H))
for y in range(0, H, 16):
    for x in range(0, W, 16): o.paste(g, (x, y))
x = 8
for im in ims: o.alpha_composite(im, (x, H - 8 - im.height)); x += im.width + 8
o.resize((W * z, H * z), Image.NEAREST).save(out); print(out, W * z, H * z)
