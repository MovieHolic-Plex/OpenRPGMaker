import sys; sys.path.insert(0,'/tmp/j8v5')
from PIL import Image, ImageDraw, ImageFont
import tiles
def bg(w,h,kind):
    im=Image.new('RGBA',(w,h))
    for y in range(h):
        for x in range(w):
            if kind=='hang': im.putpixel((x,y),tiles.plaster_face(x,(y+4)%32 if (y+4)%32<14 else 6+(y%8)))
            else: im.putpixel((x,y),tiles.plank(x,y))
    return im
def sheet(items,out,S=3,cols=14):
    try: font=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf',11)
    except Exception: font=None
    cw=max(i[1].im.width for i in items)*S+8; chh=max(i[1].im.height for i in items)*S+20
    rows=(len(items)+cols-1)//cols
    out_im=Image.new('RGBA',(cols*cw,rows*chh),(26,26,32,255)); d=ImageDraw.Draw(out_im)
    for n,(name,f) in enumerate(items):
        im=f.im; b=bg(im.width,im.height,f.kind); b.alpha_composite(im)
        x=(n%cols)*cw+4; y=(n//cols)*chh+4
        out_im.paste(b.resize((im.width*S,im.height*S),Image.NEAREST),(x,y))
        d.text((x,y+im.height*S+2),name[:22],fill=(210,210,210),font=font)
    out_im.save(out)
if __name__=='__main__':
    import objs
    it=[(k,v[1]()) for k,v in objs.OBJ.items()]
    sel=sys.argv[1] if len(sys.argv)>1 else ''
    it=[i for i in it if sel in i[0]]
    sheet(it,'/tmp/j8v5/cat.png',int(sys.argv[2]) if len(sys.argv)>2 else 3)
