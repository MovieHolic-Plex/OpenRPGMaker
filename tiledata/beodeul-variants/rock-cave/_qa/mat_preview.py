import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from rc_base import *
from rc_base import _hash
from gc_ext import compose_
sh = sheets()
row = [SAMPLES[k] for k in ('rc_rock', 'rc_rock2', 'rc_wet', 'rc_gravel')]
im = new(56 * 5 + 120, 48 * 2 + 80)
for i, s in enumerate(row):
    t = new(96, 48)
    t.alpha_composite(s, (0, 0)); t.alpha_composite(s, (48, 0))
    im.alpha_composite(t.crop((0, 0, 48, 48)), (i * 56, 0))
face = compose_(4, 3, lambda i, j: dlib.face_tile(FACE, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == 3, 48))
fl = new(64, 64 + 32)
fl.alpha_composite(compose_(4, 2, lambda i, j: SAMPLES['rc_rock'].crop((i % 3 * 16, j % 3 * 16, i % 3 * 16 + 16, j % 3 * 16 + 16))), (0, 48))
fl.alpha_composite(face, (0, 0))
im.alpha_composite(fl, (0, 56))
def cf(i, j):
    o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
    return ceil_rc((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
im.alpha_composite(compose_(3, 3, cf), (72, 56))
for n, (k, s) in enumerate(sh.items()):
    bg = new(64, 64)
    for y in range(4):
        for x in range(4): bg.alpha_composite(SAMPLES['rc_rock'].crop((x % 3 * 16, y % 3 * 16, x % 3 * 16 + 16, y % 3 * 16 + 16)), (x * 16, y * 16))
    bg.alpha_composite(s); im.alpha_composite(bg, (130 + n * 70, 56))
bgc = Image.new('RGBA', im.size, (0, 0, 0, 255)); bgc.alpha_composite(im)
bgc.resize((bgc.width * 3, bgc.height * 3), Image.NEAREST).save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mat1.png'))
