# compose rooms with (1) goods placed ON furniture surfaces and (2) animation frames
import sys; sys.path.insert(0,'/tmp/j8v4')
from PIL import Image
import room2
from mat import G, Pix
def good_img(name):
    f,a,b=G[name]; p=Pix(a,b); f(p,0,0); return p.im
def compose(plan,floor,wall,items,zones=(),lights=(),t=0):
    base=room2.render(plan,floor,wall,zones); px=base.load()
    for (wx,wy) in lights:
        for Y in range((wy+2)*16,(wy+4)*16):
            sh=(Y-(wy+2)*16)//3
            for X in range(wx*16+2+sh,wx*16+14+sh):
                if X<base.width:
                    r,g,b,a=px[X,Y]; px[X,Y]=(min(255,int(r*1.22+10)),min(255,int(g*1.2+10)),min(255,int(b*1.12+8)),a)
    draw=[]
    for it in items:
        f,x,y=it[:3]; on=it[3] if len(it)>3 else ()
        im=f.frames[t%len(f.frames)] if getattr(f,'frames',None) else f.im
        if f.kind=='hang': X,Y,key=x*16,y*16+2,y*16
        elif f.kind=='flat': X,Y,key=x*16,y*16,-1
        else: X,Y,key=x*16,y*16-f.up,(y+f.fh)*16
        layer=Image.new('RGBA',im.size); layer.alpha_composite(im)
        if on:
            x0,y0,x1,y1=f.surf
            for g,fx,fy in on:
                gi=good_img(g); gx=int(x0+fx*(x1-x0)-gi.width/2); gy=int(y0+fy*(y1-y0)-gi.height+1)
                layer.alpha_composite(gi,(max(0,gx),max(0,gy)))
        draw.append((key,layer,X,Y))
    for _,im,X,Y in sorted(draw,key=lambda d:d[0]): base.alpha_composite(im,(X,Y))
    return base
def animate(r,out,scale=2,n=4,ms=180):
    fr=[compose(r['plan'],r['floor'],r['wall'],r['items'],r.get('zones',()),r.get('lights',()),t) for t in range(n)]
    fr=[f.resize((f.width*scale,f.height*scale),Image.NEAREST).convert('RGB') for f in fr]
    fr[0].save(out,save_all=True,append_images=fr[1:],duration=ms,loop=0,lossless=True)
    return fr[0]
