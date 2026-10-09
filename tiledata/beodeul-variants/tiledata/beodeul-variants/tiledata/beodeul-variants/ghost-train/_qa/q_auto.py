import sys,os; sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from gt_auto import *
from PIL import Image
sh=[rail_sheet(), fog_sheet(), plat_sheet()]
bg=Image.new('RGBA',(64*3+40,64+8),(70,96,60,255))
for i,s in enumerate(sh): bg.alpha_composite(s,(4+i*(64+16),4))
# test map of rails
cells={(x,3) for x in range(0,12)}|{(5,y) for y in range(0,8)}|{(9,y) for y in range(3,7)}|{(x,6) for x in range(9,12)}|{(1,6)}
t=Image.new('RGBA',(12*16,8*16),(70,96,60,255))
for (x,y) in cells:
    m=(1 if (x,y-1) in cells else 0)|(2 if (x+1,y) in cells else 0)|(4 if (x,y+1) in cells else 0)|(8 if (x-1,y) in cells else 0)
    t.alpha_composite(FB.cell_of(sh[0],m),(x*16,y*16))
o=Image.new('RGBA',(max(bg.width,t.width),bg.height+t.height+4),(30,30,36,255)); o.alpha_composite(bg,(0,0)); o.alpha_composite(t,(0,bg.height+4))
o.resize((o.width*4,o.height*4),Image.NEAREST).save(os.path.join(os.path.dirname(os.path.abspath(__file__)),'auto.png'))
