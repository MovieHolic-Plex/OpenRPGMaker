import sys,os; sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..'))
from ck_base import *
from PIL import Image
tiles=[SAMPLES[t] for t in ('ck_deck','ck_deck_worn','ck_plank','ck_brick','ck_grate')]
faces=[face_sample(s,3,3) for s in ('ck_brick','ck_pipe','ck_mech')]
ims=tiles+faces+[ceiling_sample(), pit_sheet()]
W=sum(i.width+6 for i in ims); s=Image.new('RGBA',(W,64),(40,36,48,255)); x=0
for i in ims: s.alpha_composite(i,(x,0)); x+=i.width+6
s.resize((W*3,192),Image.NEAREST).save(os.path.join(os.path.dirname(__file__),'base.png'))
