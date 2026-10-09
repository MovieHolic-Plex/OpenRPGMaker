import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from eq_build import *
fns=[grand_hotel,hotel_wing,inn,cafe,bakery,apothecary,cobbler,townhouse_narrow,townhouse_wide,townhouse_corner,low_shop,warehouse,passage_arch,court_gate,fountain_wall]
ims=[pad16(fn()) for fn in fns]
W=sum(i.width for i in ims)+8*len(ims); Hh=max(i.height for i in ims)+16
bg=Image.new('RGBA',(W,Hh),(70,70,74,255)); x=4
for i in ims: bg.alpha_composite(i,(x,Hh-8-i.height)); x+=i.width+8
bg.save('/tmp/euq/t_build1.png'); bg.resize((bg.width*2,bg.height*2),Image.NEAREST).save('/tmp/euq/t_build2.png'); print(bg.size)
