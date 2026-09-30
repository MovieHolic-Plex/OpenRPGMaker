import sys
from PIL import Image
slug=sys.argv[1]; sc=int(sys.argv[2]) if len(sys.argv)>2 else 8
d=f'../../candidates-horror/{slug}/'
ims=[Image.open(d+f'h2-{k}.png').convert('RGBA') for k in 'ABC']
ims=[i.resize((i.width*sc,i.height*sc),Image.NEAREST) for i in ims]
W=sum(i.width for i in ims)+20*4; H=max(i.height for i in ims)+40
s=Image.new('RGBA',(W,H),(70,70,80,255)); x=20
for i in ims: s.paste(i,(x,20),i); x+=i.width+20
s.save(f'sheet_{slug}.png')
cs=[Image.open(d+f'h2-{k}.ctx.png').convert('RGBA') for k in 'ABC']
W=max(c.width for c in cs); H=sum(c.height for c in cs)+20
t=Image.new('RGBA',(W,H),(30,30,30,255)); y=0
for c in cs: t.paste(c,(0,y)); y+=c.height+10
t.save(f'ctx_{slug}.png')
