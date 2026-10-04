import sys; sys.path.insert(0,'/tmp/j8city')
from PIL import Image, ImageDraw, ImageFont
import palette; palette.apply()
import pz, pe, pl, ground
F=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf',13); F2=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf',11)
cob=pz.chip(160,96,16,16); lawn=pz.chip(0,128,16,16)
def onground(im,pad=8,g=None):
    W=((im.width+2*pad+15)//16)*16; H=((im.height+2*pad+15)//16)*16
    bg=Image.new('RGBA',(W,H))
    for x in range(0,W,16):
        for y in range(0,H,16): bg.paste(g or lawn,(x,y))
    bg.alpha_composite(im,((W-im.width)//2,H-pad-im.height)); return bg
def render(n):
    o=pz.P[n][0](); return o if isinstance(o,Image.Image) else pz.fin(o)
def cards():
    out=[('(비교) 칩셋 원본 소품',onground(pz.chip(396,396,84,52),4),'')]
    for n,(f,cells,where) in pz.P.items(): out.append((n,onground(render(n)),f'{cells} · {where}'))
    w=pe.P['돌 우물'](); out.append(('돌 우물 (지붕) — 정자 대신',onground(pz.fin(w) if hasattr(w,'img') else w),'2×2 · 우물 쉼터'))
    # bridge over water, in context
    wt=Image.open('/home/main/.claude/skills/pixel-object-authoring/assets/water16.png').convert('RGBA')
    ctx=Image.new('RGBA',(112,80))
    for x in range(0,112,16):
        for y in range(0,80,16): ctx.paste(wt if 24<=x<88 else lawn,(x,y))
    for y in (16,32): 
        for x in list(range(0,24,16))+[96]: ctx.paste(cob,(x,y))
    ctx.alpha_composite(pz.bridge_ew(4),(20,11)); out.append(('동서 돌다리 (v4, 가로)',ctx,'4×2 + 앞면 · 물 위'))
    return out
def sheet(out,items,S=3,cols=1300):
    x=y=0; rowh=0; pos=[]
    for n,im,note in items:
        w=max(im.width*S,150); h=im.height*S+34
        if x+w>cols: x=0; y+=rowh+10; rowh=0
        pos.append((x,y,n,im,note)); x+=w+10; rowh=max(rowh,h)
    o=Image.new('RGBA',(cols,y+rowh+10),(27,28,31,255)); d=ImageDraw.Draw(o)
    for x,y,n,im,note in pos:
        o.paste(im.resize((im.width*S,im.height*S),Image.NEAREST),(x,y+32)); d.text((x,y),n,font=F,fill=(235,235,235)); d.text((x,y+16),note,font=F2,fill=(150,160,170))
    o.save(out); return o
def ground_sheet(out):
    # the five ground textures, and a 20x12-cell sample of the mixed ground with a tree box and a street strip
    items=[]
    for k,(x,y) in list(ground.TEX.items())+[('worn',(16,1776))]:
        t=pz.chip(x,y,16,16) if k!='worn' else pz.chip(20,1780,8,8).resize((16,16),Image.NEAREST)
        s=Image.new('RGBA',(48,48))
        for a in range(3):
            for b in range(3): s.paste(t,(a*16,b*16))
        items.append(({'lawn':'기본 잔디','meadow':'밝은 풀밭','shade':'나무 밑 짙은 풀','flower':'들꽃 풀','worn':'길가 닳은 풀'}[k],s,f'칩셋 {x},{y}'))
    import numpy as np
    W,H=320,192; rm=np.zeros((H,W),bool); rm[128:160,:]=True
    g,_=ground.render(W,H,[(40,10,80,90),(200,20,64,70)],rm,seed=7)
    d=ImageDraw.Draw(g); d.rectangle((0,128,W,159),fill=(120,120,124,255))
    items.append(('섞인 땅 견본 (나무 자리 2곳 + 길 1줄)',g,'덩어리 노이즈 · 점찍기 아님'))
    return sheet(out,items,S=2)
if __name__=='__main__':
    sheet('/tmp/j8city/z4_catalogue.png',cards()); ground_sheet('/tmp/j8city/z4_ground.png'); print('ok')
