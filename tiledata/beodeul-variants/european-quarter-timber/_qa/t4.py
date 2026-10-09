import sys; sys.path.insert(0,'.')
from eq_build import *
from PIL import ImageDraw
ims=[]
for n,(f,ko,d) in BUILDINGS.items():
    try: im,info=f(); ims.append((n,im)); print(n, im.size, info.get('brows'))
    except Exception as e:
        import traceback; traceback.print_exc(); print('ERR',n)
rows=[ims[:7],ims[7:]]
W=max(sum(i.width+12 for _,i in r) for r in rows)+10; RH=[max(i.height for _,i in r)+14 for r in rows]
c=Image.new('RGBA',(W,sum(RH)),(122,58,46,255)); d=ImageDraw.Draw(c); y=0
for r,h in zip(rows,RH):
    x=6
    for n,im in r: c.alpha_composite(im,(x,y+h-im.height)); d.text((x,y),n,fill=(255,255,255,255)); x+=im.width+12
    y+=h
c.resize((c.width*2,c.height*2),Image.NEAREST).save('_qa/t4.png'); print(c.size)
