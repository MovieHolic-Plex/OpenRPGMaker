import sys, math; sys.path.insert(0, '..')
sys.path.insert(0, '.')
from ft_debris import *
import numpy as np
cs=[ch_plate(1,12,8),ch_plate(2,10,7,'rust'),ch_stone(3,12,9),ch_bone(4,16,.3),ch_bone(5,14,2.6),ch_rib(6,9,3.6,5.6),ch_glass(7,7),ch_gear(8,6),ch_pipe(9,12),ch_vert(10),ch_flesh(11,7,5),ch_girder(12,20,.3)]
W=sum(c.w+4 for c in cs); H=max(c.h for c in cs)+4
tc=TC(W,H); x=2
for c in cs: paste_ol(tc,c,x,2,0,False); x+=c.w+4
im=pz.fin(tc.img(),.6)
bg=Image.new('RGBA',im.size,(30,30,44,255)); bg.alpha_composite(im); bg.resize((W*5,H*5),Image.NEAREST).save('_qa/chunks.png')
# test pile
Wp,Hp=64,40
ins=lambda x,y: ((x-32)/31)**2+((y-28)/18)**2<=1 and y<38
hgt=lambda x,y: max(0,min(1,(38-y)/30))
tc,_=pile(Wp,Hp,ins,hgt,5)
im=pz.fin(tc.img(),.6); bg=Image.new('RGBA',im.size,(70,74,100,255)); bg.alpha_composite(im); bg.resize((Wp*6,Hp*6),Image.NEAREST).save('_qa/pile.png')
