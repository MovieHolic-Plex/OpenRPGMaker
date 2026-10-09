import sys; sys.path.insert(0,'.')
from PIL import Image, ImageDraw
def board(items, path, scale=3, cols=6, bg=(96,104,84,255)):
    cw=max(i.width for _,i in items)*scale+10; ch=max(i.height for _,i in items)*scale+22
    rows=(len(items)+cols-1)//cols
    o=Image.new('RGBA',(cols*cw,rows*ch),(28,30,34,255)); d=ImageDraw.Draw(o)
    for k,(n,im) in enumerate(items):
        x=k%cols*cw+5; y=k//cols*ch+5
        d.rectangle((x,y,x+im.width*scale-1,y+im.height*scale-1),fill=bg)
        o.alpha_composite(im.resize((im.width*scale,im.height*scale),Image.NEAREST),(x,y))
        d.text((x,y+im.height*scale+2),'%d %s'%(k+1,n),fill=(230,230,230,255))
    o.save(path)
