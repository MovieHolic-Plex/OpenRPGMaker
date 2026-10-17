"""python3 zoom.py <모듈> <id> [배율] [x0,y0,x1,y1] → ~/gothic-scratch/z-<id>.png (어두운 풀 바탕)"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
import loader, gmlib
from PIL import Image
reg = loader.load(sys.argv[1]); p = reg.pieces[sys.argv[2]]; z = int(sys.argv[3]) if len(sys.argv) > 3 else 6
im = gmlib.render_piece(p, 0).img()
if len(sys.argv) > 4: im = im.crop(tuple(int(v) for v in sys.argv[4].split(',')))
bg = Image.new('RGBA', im.size, gmlib.RAMPS['grass'][3]); bg.alpha_composite(im)
out = os.path.expanduser(f'~/gothic-scratch/z-{sys.argv[2]}.png'); bg.resize((im.width * z, im.height * z), Image.NEAREST).save(out); print(out)
