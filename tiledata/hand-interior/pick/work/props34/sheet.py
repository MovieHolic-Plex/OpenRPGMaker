import json, sys
from PIL import Image, ImageDraw
import render as r
FLOOR=None
def floor_bg(W,H):
    # wooden floor from spec floors 'boards' first variant
    f=r.SPEC['floors']
    k='boards' if 'boards' in f else list(f)[0]
    fl=f[k]
    t=fl['tiles'][0] if 'tiles' in fl else None
    im=Image.new('RGBA',(W,H),(120,96,70,255))
    return im
def card(oid, scale=4, label=None, img=None):
    im=img if img is not None else r.obj(oid)
    big=im.resize((im.width*scale,im.height*scale),Image.NEAREST)
    W=max(big.width+8,140); H=big.height+22
    c=Image.new('RGBA',(W,H),(58,52,48,255))
    bg=Image.new('RGBA',big.size,(150,122,90,255))
    # checker of 16*scale cells to show tile grid
    d=ImageDraw.Draw(bg)
    for y in range(0,big.height,16*scale):
        for x in range(0,big.width,16*scale):
            if ((x+y)//(16*scale))%2: d.rectangle([x,y,x+16*scale-1,y+16*scale-1],fill=(140,113,83,255))
    bg.alpha_composite(big)
    c.alpha_composite(bg,(4,18))
    ImageDraw.Draw(c).text((4,3),(label or oid)[:22],fill=(255,240,200,255))
    return c
def grid(cards, cols=6, out='out.png'):
    rows=[cards[i:i+cols] for i in range(0,len(cards),cols)]
    W=max(sum(c.width+6 for c in row) for row in rows); H=sum(max(c.height for c in row)+6 for row in rows)
    o=Image.new('RGBA',(W,H),(30,28,26,255)); y=0
    for row in rows:
        x=0
        for c in row: o.alpha_composite(c,(x,y)); x+=c.width+6
        y+=max(c.height for c in row)+6
    o.save(out); return out
if __name__=='__main__':
    ids=sys.argv[2:]; grid([card(i) for i in ids],out=sys.argv[1])
