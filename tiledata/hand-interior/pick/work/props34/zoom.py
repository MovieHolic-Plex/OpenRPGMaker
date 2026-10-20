import sys, render as r
from PIL import Image, ImageDraw
def zoom(imgs, out, S=10):
    tiles=[]
    for name,im in imgs:
        c=im.resize((im.width*S,im.height*S),Image.NEAREST)
        t=Image.new('RGBA',(c.width+30,c.height+16),(150,122,90,255))
        t.alpha_composite(c,(24,16)); d=ImageDraw.Draw(t); d.rectangle([0,0,t.width,15],fill=(30,30,30,255)); d.text((2,2),name,fill='white')
        for y in range(im.height): d.text((2,16+y*S),str(y),fill=(255,255,0,255))
        for x in range(0,im.width,4): d.text((24+x*S,t.height-12) if False else (24+x*S,4+0),'' ,fill='white')
        tiles.append(t)
    W=sum(t.width+6 for t in tiles); H=max(t.height for t in tiles)
    o=Image.new('RGBA',(W,H),(20,20,20,255)); x=0
    for t in tiles: o.alpha_composite(t,(x,0)); x+=t.width+6
    o.save(out)
if __name__=='__main__':
    zoom([(i,r.obj(i)) for i in sys.argv[2:]], sys.argv[1])
