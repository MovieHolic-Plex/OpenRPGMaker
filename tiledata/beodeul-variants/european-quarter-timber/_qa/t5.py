import sys; sys.path.insert(0,'.')
from eq_kit import *
from PIL import ImageDraw
names=[n for n,(f,m) in K.items() if m['kind'] in ('object','tree') and m.get('role')!='building']
ims=[(n,pad16(img(n))) for n in names]; print(len(K),'kits', len(ims),'props')
cols=10; cw=56; ch=max(i.height for _,i in ims)+12
rows=-(-len(ims)//cols); c=Image.new('RGBA',(cols*cw,rows*ch),(95,88,80,255)); d=ImageDraw.Draw(c)
for kk,(n,im) in enumerate(ims):
    x=(kk%cols)*cw; y=(kk//cols)*ch; c.alpha_composite(im,(x+2,y+ch-im.height)); d.text((x+1,y),n[:11],fill=(255,255,255,255))
c.resize((c.width*2,c.height*2),Image.NEAREST).save('_qa/t5.png'); print(c.size)
