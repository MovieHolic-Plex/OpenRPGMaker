"""python3 preview.py <out.png> [ids…] — 등록된 줄 A 그림을 하늘색 바탕 4배로 한 장에."""
import sys, importlib, glob, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sky_a_*.py'))):
    n = os.path.basename(f)[:-3]
    if n not in ('sky_a_lib','sky_a_all'): importlib.import_module(n)
import registry as R
from PIL import Image
ps = R.pieces_of('A', set(sys.argv[2:]) or None)
Z = 3; pad = 8; x = pad; y = pad; rowh = 0; W = 1300
ims = [(p, R.render(p, 0)) for p in ps]
canvas = Image.new('RGBA', (W, 1800), (110, 170, 225, 255))
for p, im in ims:
    w, h = im.size[0] * Z, im.size[1] * Z
    if x + w > W: x = pad; y += rowh + pad; rowh = 0
    canvas.paste(im.resize((w, h), 0), (x, y), im.resize((w, h), 0)); x += w + pad; rowh = max(rowh, h)
canvas.crop((0, 0, W, y + rowh + pad)).save(sys.argv[1])
