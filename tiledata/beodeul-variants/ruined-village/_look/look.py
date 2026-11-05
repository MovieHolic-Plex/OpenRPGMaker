import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rv_base import *
def sheet(ims, out, scale=3, bg=(88,150,60,255), gap=8):
    W = sum(i.width + gap for i in ims); Hh = max(i.height for i in ims)
    o = Image.new('RGBA', (W, Hh), bg); x = 0
    for i in ims: o.alpha_composite(i, (x, Hh - i.height)); x += i.width + gap
    o.resize((o.width * scale, o.height * scale), Image.NEAREST).save(out)
