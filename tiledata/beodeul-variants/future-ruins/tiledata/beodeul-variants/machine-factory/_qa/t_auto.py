import sys; sys.path.insert(0,'.')
from mf_kit import *
import mf_auto as AU
from gc_ext import autotile_mask, atile_img
CS=AU.conveyor_sheet(); RS=AU.rail_sheet(); HS=AU.hazard_sheet()
fl=SAMPLES['mf_plate']
def demo(cells, sheet, w, h):
    im=new(w*16,h*16)
    for j in range(h):
        for i in range(w): im.alpha_composite(fl.crop((i%3*16,j%3*16,i%3*16+16,j%3*16+16)),(i*16,j*16))
    for (x,y) in sorted(cells,key=lambda c:(c[1],c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells,x,y)),(x*16,y*16))
    return im
conv={(x,2) for x in range(1,9)}|{(8,y) for y in range(2,6)}|{(x,5) for x in range(8,12)}|{(3,y) for y in range(3,5)}|{(11,1)}
rail={(x,1) for x in range(1,8)}|{(1,y) for y in range(1,5)}|{(7,y) for y in range(1,4)}|{(10,3),(10,4)}
haz={(x,y) for x in range(1,6) for y in range(1,4)}|{(8,2),(9,2),(9,3)}
ims=[CS,RS,HS,demo(conv,CS,13,7),demo(rail,RS,12,6),demo(haz,HS,11,5)]
W=sum(i.width+8 for i in ims); H=max(i.height for i in ims)+8
o=Image.new('RGBA',(W,H),(30,30,40,255)); x=4
for i in ims: o.alpha_composite(i,(x,4)); x+=i.width+8
o.resize((o.width*3,o.height*3),Image.NEAREST).save('_qa/auto.png')
