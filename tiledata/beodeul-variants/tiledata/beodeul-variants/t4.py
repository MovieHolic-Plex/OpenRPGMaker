import sys; sys.path.insert(0,'..')
from tr_auto import *
from tr_void import void_image
sh=[riftstone_sheet(),starbridge_sheet(),lightspill_sheet()]
S=5
bg=void_image(64*3*S+40, 64*S+150, seed=8)
for i,s in enumerate(sh):
    if i==2:
        base=Image.new('RGBA',(64,64)); g=ground_riftstone()
        base.alpha_composite(g,(0,0)); base.alpha_composite(g.crop((0,0,16,48)),(48,0)); base.alpha_composite(g.crop((0,0,48,16)),(0,48)); base.alpha_composite(g.crop((0,0,16,16)),(48,48))
        base.alpha_composite(s); s=base
    bg.alpha_composite(s.resize((64*S,64*S),Image.NEAREST),(i*(64*S+20),0))
g=ground_riftstone(); t=Image.new('RGBA',(144,144))
for a in range(3):
  for b in range(3): t.alpha_composite(g,(a*48,b*48))
f=face_rift_sample()
bg.alpha_composite(t,(0,64*S+4)); bg.alpha_composite(f.resize((144,144),Image.NEAREST),(160,64*S+4))
bg.save('auto.png')
