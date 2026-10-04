# diagnosis experiments: the same street front, varying one thing at a time
import sys, random; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import pj, pk, pi, pl, pf
from pj_demo import roofrows as RR, storeyrows as SR
from PIL import Image
from sheet2 import lawn
L=pj.library()
CHIP=Image.open('/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/public/assets/atlas-biomes/jungle-chipset.png').convert('RGBA')
def tree(x,y,w,h): return CHIP.crop((x,y,x+w*16,y+h*16))
def scene(W,H,houses,street_y,street_kind,trees=(),props=()):
    img=Image.new('RGBA',(W*16,H*16))
    for x in range(W):
        for y in range(H): img.paste(lawn,(x*16,y*16))
    m=[[y in (street_y,street_y+1) for x in range(W)] for y in range(H)]
    img.alpha_composite((pk.plaza(m).img() if street_kind=='pave' else pk.road(m).img()))
    objs=[]
    for rows,x,yb in houses:
        im=pj.outlined(pj.assemble(rows,L)); objs.append((im,x-1/16,yb-im.height//16+1-1/16))
    for im,x,y in list(trees)+list(props): objs.append((im,x,y))
    mask=Image.new('L',img.size,0)
    for im,x,y in objs:
        a=im.split()[3].point(lambda v:255 if v>128 else 0); mask.paste(255,(round(x*16)+6,round(y*16)+3),a)
    px=img.load(); mp=mask.load()
    for yy in range(img.height):
        for xx in range(img.width):
            if mp[xx,yy]: r,g,b,a=px[xx,yy]; px[xx,yy]=(int(r*0.52),int(g*0.58),int(b*0.74),a)
    for im,x,y in sorted(objs,key=lambda o:o[2]*16+o[0].height): img.alpha_composite(im,(round(x*16),round(y*16)))
    return img
def H2(w,gab,roofn,up,low,st='tim',gs='sto'): return RR(st,w,gab,roofn)+SR(st,up,'eave','jetty')+SR(gs,low,'plain','base')
def H1(w,gab,roofn,low,st='tim'): return RR(st,w,gab,roofn)+SR(st,low,'eave','base')
oak=tree(224,512,4,5); bush=tree(336,512,2,2)
W,Hh=30,13
# A: as now — shallow roofs, gaps between houses, trees stuffed in the gaps, wide paved street, a prop at each corner
A=scene(W,Hh,[(H2(6,3,3,'lwnwmr','lwmdnr'),1,9),(H2(5,None,3,'lwpwr','lmdnr'),9,9),(H2(7,3,3,'lwnwnwr','lwmdnwr'),16,9)],10,'pave',
        trees=[(oak,24,3),(bush,7,7)],props=[(pl.P['호박']().img(),0,9),(pi.P['곡식 자루']().img(),8,9),(pl.P['빗물통']().img(),15,9)])
# B: only the roofs deeper (roof depth ≥ wall height, like the chipset's own houses)
B=scene(W,Hh,[(H2(6,3,5,'lwnwmr','lwmdnr'),1,9),(H2(5,None,5,'lwpwr','lmdnr'),9,9),(H2(7,3,5,'lwnwnwr','lwmdnwr'),16,9)],10,'pave',
        trees=[(oak,24,3),(bush,7,7)],props=[(pl.P['호박']().img(),0,9),(pi.P['곡식 자루']().img(),8,9),(pl.P['빗물통']().img(),15,9)])
# C: deeper roofs + houses joined wall to wall along the street, dirt street, no trees in the row, props only where people work
C=scene(W,Hh,[(H2(6,3,5,'lwnwmr','lwmdnr'),1,9),(H2(5,None,4,'lwpwr','lmdnr','sto','sto'),7,9),(H2(7,3,5,'lwnwnwr','lwmdnwr'),12,9),(H1(6,None,4,'lwmdnr','sto'),19,9)],10,'dirt',
        trees=[(oak,26,3)],props=[(pf.P['술통 더미']().img(),25,8)])
def lab(im,t):
    from PIL import ImageDraw
    o=Image.new('RGBA',(im.width,im.height+14),(27,28,31,255)); o.alpha_composite(im,(0,14)); ImageDraw.Draw(o).text((2,1),t,fill=(230,230,230)); return o
out=[lab(A,'A now'),lab(B,'B deeper roofs'),lab(C,'C deeper roofs + joined + dirt street')]
o=Image.new('RGBA',(W*16,sum(i.height for i in out)+20),(27,28,31,255)); y=0
for i in out: o.alpha_composite(i,(0,y)); y+=i.height+10
o.resize((o.width*2,o.height*2),Image.NEAREST).save('/tmp/j8city/diag.png')

# D: roofs with the chipset's own roof idiom (lit slope tiles + shaded slope tiles, ridge row, eave row)
def T(x,y): return CHIP.crop((x,y,x+16,y+16))
def roof_chip(w,rows,mode):
    im=Image.new('RGBA',(w*16,rows*16))
    for r in range(rows):
        for c in range(w):
            if mode=='front':          # ridge E-W: the whole visible slope lit, darker eave course at the bottom
                t=T(224,192) if r==0 else (T(240,208) if r==rows-1 else T(224,208))
            else:                      # ridge N-S: left slope lit, right slope in shade
                lit=c<w/2
                t=(T(224,192) if r==0 else T(224,208)) if lit else (T(240,192) if r<rows-1 else T(240,208))
            im.alpha_composite(t,(c*16,r*16))
    return im
def house_chiproof(w,rows,up,low,mode,st='tim',gs='sto'):
    walls=pj.assemble(SR(st,up,'eave','jetty')+SR(gs,low,'plain','base'),L)
    r=roof_chip(w,rows,mode); im=Image.new('RGBA',(w*16,r.height+walls.height)); im.alpha_composite(r); im.alpha_composite(walls,(0,r.height)); return im
def scene2(W,H,items,street_y):
    img=Image.new('RGBA',(W*16,H*16))
    for x in range(W):
        for y in range(H): img.paste(lawn,(x*16,y*16))
    m=[[y in (street_y,street_y+1) for x in range(W)] for y in range(H)]
    img.alpha_composite(pk.road(m).img())
    objs=[(pj.outlined(im),x-1/16,yb-im.height//16+1-1/16) for im,x,yb in items]
    mask=Image.new('L',img.size,0)
    for im,x,y in objs:
        a=im.split()[3].point(lambda v:255 if v>128 else 0); mask.paste(255,(round(x*16)+6,round(y*16)+3),a)
    px=img.load(); mp=mask.load()
    for yy in range(img.height):
        for xx in range(img.width):
            if mp[xx,yy]: r,g,b,a=px[xx,yy]; px[xx,yy]=(int(r*0.52),int(g*0.58),int(b*0.74),a)
    for im,x,y in objs: img.alpha_composite(im,(round(x*16),round(y*16)))
    return img
D=scene2(30,13,[(house_chiproof(6,4,'lwnwmr','lwmdnr','front'),1,9),(house_chiproof(5,4,'lwpwr','lmdnr','side','sto','sto'),7,9),
               (house_chiproof(7,4,'lwnwnwr','lwmdnwr','side'),12,9),(house_chiproof(6,4,'lwpwpr','lwmdnr','front'),19,9)],10)
D.resize((D.width*2,D.height*2),Image.NEAREST).save('/tmp/j8city/diagD.png')
