import sys
from PIL import Image
tags=sys.argv[1:]
W=Image.new('RGBA',(3*(192+10)+3*(64+6)+3*(128+6)+40, 200*len(tags)),(168,208,144,255))
for r,t in enumerate(tags):
  x=0
  for el in ['grass','fire','water']:
    a=Image.open(f'out/{t}-{el}-a64.png'); W.alpha_composite(a.resize((192,192),Image.NEAREST),(x,r*200)); x+=202
  for el in ['grass','fire','water']:
    a=Image.open(f'out/{t}-{el}-a64.png'); W.alpha_composite(a,(x,r*200+128)); x+=70
  for el in ['grass','fire','water']:
    b=Image.open(f'out/{t}-{el}-b128.png'); W.alpha_composite(b,(x,r*200+64)); x+=134
W.save('chk.png')
