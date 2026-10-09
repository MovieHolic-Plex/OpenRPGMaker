import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import eq_props as P, eq_ground as G
from eq_base import *
names=[n for n in dir(P) if callable(getattr(P,n)) and getattr(P,n).__module__=='eq_props' and not n.startswith('_') and n not in ('done',)]
ims=[]
for n in names:
    try: ims.append((n,pad16(getattr(P,n)())))
    except Exception as e: print('ERR',n,e)
bg=G.ground_sample('ground-setts')
W=16*40; rows=[]; x=0; y=0; rowh=0; pos=[]
for n,im in ims:
    if x+im.width>W: x=0; y+=rowh+16; rowh=0
    pos.append((n,im,x,y)); x+=im.width+16; rowh=max(rowh,im.height)
Hh=y+rowh+16
o=Image.new('RGBA',(W,Hh))
for yy in range(0,Hh,48):
    for xx in range(0,W,48): o.alpha_composite(bg,(xx,yy))
for n,im,x,y in pos: o.alpha_composite(im,(x+8,y+8))
o.resize((W*2,Hh*2),Image.NEAREST).save('/tmp/euq/t_props.png'); print(len(ims),[n for n,_ in ims])
