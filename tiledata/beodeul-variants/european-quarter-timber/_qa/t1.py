import sys; sys.path.insert(0,'.')
from eq_house import *
A=gable_house(4,[('brick','pdwp'),('timber','WxWx'[:4]),('timber','SkSk')],run=30,seed=3,chimneys=[(44,6,14)])[0]
B=gable_house(5,[('brick','wpdsw'),('timber','WxWxW'),('timber','xSkSx')],run=34,seed=5,oriel=('R',1,2),signs=[(60,0,'bread','R')],awnings=[(52,76,0,'red')])[0]
C=eave_house(6,[('brick','wpdpsw'),('timber','WkWkWk'[:6])],seed=7,dormers=[(14,10),(62,10)],chimneys=[(70,0,16)],gables=[(2,3)])[0]
D=eave_house(7,[('stone','gpgpgpg'),('timber','WxWxWxW'),('timber','SkSkSkS')],seed=9,ends='LR',dormers=[(10,12),(86,12)],gables=[(2,3)])[0]
ims=[A,B,C,D]
W=sum(i.width for i in ims)+60;Hh=max(i.height for i in ims)+8
c=Image.new('RGBA',(W,Hh),(150,70,55,255));x=4
for i in ims: c.alpha_composite(i,(x,Hh-4-i.height)); x+=i.width+14
c.resize((W*3,Hh*3),Image.NEAREST).save('_qa/t1.png'); print(c.size)
