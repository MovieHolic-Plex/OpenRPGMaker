import sys,os; sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mc_build import *
import mc_build as B
items=[('mansion',I(B.mansion())),('gallery',I(B.gallery())),('th_house',I(B.townhouse(5,2,2,1,'house'))),('th_atelier',I(B.townhouse(4,3,1,2,'atelier'))),
 ('th_shop',I(B.townhouse(5,2,2,3,'shop'))),('th_cafe',I(B.townhouse(6,2,2,4,'cafe'))),('pier',B.gate_pier())]
x=0;H=max(i.height for n,i in items)
sheet=Image.new('RGBA',(sum(i.width+8 for n,i in items),H),(70,120,60,255))
for n,i in items: sheet.alpha_composite(i,(x,H-i.height)); x+=i.width+8
s=int(sys.argv[1]) if len(sys.argv)>1 else 2
sheet.resize((sheet.width*s,sheet.height*s),Image.NEAREST).save('_qa/pv.png'); print(sheet.size)
