import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pv_base import *
import pv_ground as G
out=blank(4*104, 104+ 3*120)
for i,n in enumerate(('darkearth','yard','fernlitter','ashgrit')):
    t=G.ground_sample(n)
    for yy in (0,48):
        for xx in (0,48): out.alpha_composite(t,(i*104+xx,yy))
bg=wl.grass_bg()
for k,(n,sh) in enumerate((('dirtpath',G.autotile_dirtpath()),('yard',G.autotile_yardedge()),('stake',G.autotile_stakefence()))):
    p=wl.auto_preview(sh,bg,scale=1)
    out.alpha_composite(p,(0,104+k*120))
    out.alpha_composite(sh,(180,104+k*120))
out.resize((out.width*3,out.height*3),Image.NEAREST).save(os.path.join(os.path.dirname(os.path.abspath(__file__)),'ground.png'))
