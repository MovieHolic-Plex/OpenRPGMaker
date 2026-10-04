# house forms v2 (2026-09-28 user verdict: "지붕이 ㅁ자로만 보이면 안 된다"). The main roof is STEEP: its ridge is the top of
# the silhouette (the back slope hides behind it), hip ends fall from the ridge ends to the eave corners, so every range
# reads as a trapezoid with volume. The roof overhangs the walls by 2 px each side and throws a shadow on the wall top.
# Every builder returns dict(im, door=cell offset of the door column, chim=[(x,y) px of chimney tops], below=px under base)
import sys, os, random; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import pj, pv
from pv import walls, stack, mul as _mul
WD=pv.WD
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c[:3])+((c[3],) if len(c)>3 else (255,))
def steep_hip(st,W,H,e=None,yb=0.45,ends=True):
    # ends: True (both hipped), False (both gable ends), or 'L' / 'R' / 'LR' = which ends are hipped
    e=e if e is not None else min(W//3,int(H*0.9))
    hl=ends is True or (isinstance(ends,str) and 'L' in ends); hr=ends is True or (isinstance(ends,str) and 'R' in ends)
    el=e if hl else 0; er=e if hr else 0
    fr=pj.pairtex(st,'front',W,H).load(); lt=pj.pairtex(st,'back',W,H).load(); le=pj.nstex(st,'l',W,H).load(); re=pj.nstex(st,'r',W,H).load()
    o=Image.new('RGBA',(W,H)); px=o.load(); YB=H*yb
    for y in range(H):
        xl=el*(1-(y+0.5)/H); xr=W-er*(1-(y+0.5)/H)
        for x in range(W):
            xx=x+0.5
            if el and xx<el and y<YB*(1-xx/el): continue
            if er and xx>W-er and y<YB*(1-(W-xx)/er): continue
            if xx<xl: c=le[x,y]; k=1.02
            elif xx>xr: c=re[x,y]; k=0.8
            else: c=fr[x,y] if y>3 else lt[x,y]; k=1.12-0.24*(y/H)
            if el and xx<el and abs(y-YB*(1-xx/el))<1: c=WD[4]; k=1
            if er and xx>W-er and abs(y-YB*(1-(W-xx)/er))<1: c=WD[2]; k=1
            if el and abs(xx-xl)<1 and y>0: c=WD[5]; k=1
            if er and abs(xx-xr)<1 and y>0: c=WD[1]; k=1
            if y<2 and xl<=xx<=xr: c=(WD[6] if y==0 else WD[2]); k=1
            if not el and x<2: c=WD[4] if x==1 else WD[1]; k=1          # gable end: barge board
            if not er and x>=W-2: c=WD[2] if x==W-2 else WD[1]; k=1
            px[x,y]=mul(tuple(c[:3])+(255,),k)
    return o
def volume(im,roof_h,o=2,shadow=4):
    im=im.copy(); px=im.load(); W,H=im.size
    for y in range(roof_h,H):
        for x in list(range(0,o))+list(range(W-o,W)): px[x,y]=(0,0,0,0)
    for y in range(roof_h,min(H,roof_h+shadow)):
        for x in range(o,W-o):
            if px[x,y][3]: px[x,y]=mul(px[x,y],0.55+0.1*(y-roof_h))
    return im
def kinds_for(w,style,shop,r,door=None):
    d=door if door is not None else (r.randint(2,w-3) if w>=5 else w//2)
    k=['l']+['p']*(w-2)+['r']; k[d]='d'
    for i in range(1,w-1):
        if i==d: continue
        if abs(i-d)==1: k[i]=('m' if i<d else 'n') if style=='tim' else 'p'
        elif shop and style!='sto': k[i]='s' if (i-d)%2==0 else ('m' if i<d else 'n')
        else: k[i]='w' if (i-d)%2==0 else ('p' if style=='sto' else ('m' if i<d else 'n'))
    up=['l']+['p']*(w-2)+['r']
    for i in range(1,w-1): up[i]='w' if i%2==1 else ('p' if style=='sto' else 'm' if i<w//2 else 'n')
    return ''.join(k),''.join(up),d
def body(st,gs,s,k,up):
    if s==1: return walls(gs,k,1,gs)
    return stack((walls(st,up,1,st,'eave'),0),(walls(gs,k,1,gs,'plain'),0))
_L=[None]
def L():
    if _L[0] is None: _L[0]=pj.library()
    return _L[0]
def chimney(im,x,y,st):
    cs='sto' if st=='sto' else 'tim'
    im.alpha_composite(L()[f'{cs}.chimney.top'],(x,y)); im.alpha_composite(L()[f'{cs}.chimney.bot'],(x,y+16))
    return (x+8,y+2)
def house(st,w,s,gs=None,shop=False,seed=0,hipped=True,chim=True,door=None):
    # a range with a steep roof: hipped (trapezoid) or plain gable ends (still steep, barge boards at the ends)
    r=random.Random(seed); gs=gs or st; W=w*16; Rh=44
    k,up,d=kinds_for(w,'sto' if gs=='sto' else st,shop,r,door=door)
    roof=steep_hip(st,W,Rh,ends=hipped); b=body(st,gs,s,k,up)
    pad=16 if chim else 0
    im=Image.new('RGBA',(W,pad+Rh+b.height)); im.alpha_composite(roof,(0,pad)); im.alpha_composite(b,(0,pad+Rh))
    im=volume(im,pad+Rh); ch=[]
    if chim:
        cx=r.choice([c for c in range(1,w-1) if abs(c-d)>1] or [1])*16
        ch.append(chimney(im,cx,pad-12+int(Rh*0.25),st))
    return dict(im=im,door=d,chim=ch,below=0,above=pad)
def lhouse(st,w,s,wings,gs=None,seed=0,chim=True):
    # main steep-hip range + cross wings coming toward the viewer (col, proj rows). A wing's ridge is as high as the
    # main ridge: over the main roof only its valley triangle shows (apex on the main ridge), below the main eave it is
    # full width and ends in a gable; its walls stand proj rows lower than the main walls. Door on the first wing.
    r=random.Random(seed); gs=gs or st; W=w*16; Rh=44
    cov={c+i for c,p in wings for i in range(3)}
    k,up,d=kinds_for(w,'sto' if gs=='sto' else st,False,r,door=next((i for i in range(2,w-2) if i not in cov and i-1 not in cov and i+1 not in cov),None))
    k=''.join('p' if (i in cov and ch=='d') else ch for i,ch in enumerate(k))
    ends=('' if any(c<=1 for c,p in wings) else 'L')+('' if any(c+3>=w-1 for c,p in wings) else 'R')
    roof=steep_hip(st,W,Rh,ends=ends or False); b=body(st,gs,s,k,up); P=max(p for c,p in wings)
    pad=16 if chim else 0
    im=Image.new('RGBA',(W,pad+Rh+b.height+P*16)); im.alpha_composite(roof,(0,pad)); im.alpha_composite(b,(0,pad+Rh))
    im=volume(im,pad+Rh)
    old=pv.PEAK[0]; pv.PEAK[0]=False
    door=d
    for j,(c,p) in enumerate(wings):
        G=20; rh=Rh+p*16; g=pv.gable_end(st,48,rh,G); gp=g.load()
        for y in range(Rh):                                        # valley triangle over the main roof
            half=24*(y+1)/Rh
            for x in range(48):
                dd=abs(x+0.5-24)
                if dd>half: gp[x,y]=(0,0,0,0)
                elif dd>half-1.5: gp[x,y]=(60,34,30,255)
        wk='ldr' if j==0 else 'lwr'
        if j==0: door=c+1
        wb=body(st,gs,s,wk,'lwr')
        im.alpha_composite(g,(c*16,pad)); im.alpha_composite(wb,(c*16,pad+rh))
    pv.PEAK[0]=old
    ch=[]
    if chim:
        free=[x for x in range(1,w-1) if all(abs(x-(c+1))>2 for c,p in wings)]
        if free: ch.append(chimney(im,r.choice(free)*16,pad-12+int(Rh*0.25),st))
    return dict(im=im,door=door,chim=ch,below=0,above=pad)
def backwing(st,w,s,col,p=2,gs=None,seed=0):
    # a wing going away (north): only its roof shows above the main ridge, ending in a peak; below that it hides
    h=house(st,w,s,gs=gs,seed=seed,chim=False); im0=h['im']; G=20; wr=p*16
    old=pv.PEAK[0]; pv.PEAK[0]=True
    g=pv.gable_end(st,48,wr+G,G,window=False); pv.PEAK[0]=old
    g=g.crop((0,0,48,wr))                                      # the peak and the run down to the main ridge only
    im=Image.new('RGBA',(im0.width,wr+im0.height)); im.alpha_composite(g,(col*16,0)); im.alpha_composite(im0,(0,wr))
    h['im']=im; return h
def cross(st,w,s,gables,gs=None,seed=0):
    # a long steep roof with forward gables whose ridges rise ABOVE the main ridge (peaked far ends)
    r=random.Random(seed); gs=gs or st; W=w*16; Rh=44; G=20
    cov={c+i for c in gables for i in range(3)}
    k,up,d=kinds_for(w,'sto' if gs=='sto' else st,False,r)
    k=''.join(('w' if ch=='d' else ch) if i in cov else ch for i,ch in enumerate(k))
    roof=steep_hip(st,W,Rh); b=body(st,gs,s,k,up)
    im=Image.new('RGBA',(W,G+Rh+b.height+16)); im.alpha_composite(roof,(0,G)); im.alpha_composite(b,(0,G+Rh)); im=volume(im,G+Rh)
    for j,c in enumerate(gables):
        gg=pv.gable_end(st,48,G+Rh+16,G); wk='ldr' if j==0 else 'lwr'
        im.alpha_composite(gg,(c*16,0)); im.alpha_composite(body(st,gs,s,wk,'lwr'),(c*16,G+Rh+16))
    return dict(im=im,door=gables[0]+1,chim=[],below=0)
def gfront(st,wc,s,gs=None):
    im=pv.gfront(st,wc,s,gs=gs); return dict(im=im,door=wc//2,chim=[],below=0)

def balcony_house(st='tim',gs='sto',seed=21):
    # user verdict: balcony with the stair climbing ALONG the wall (not toward the viewer)
    h=house(st,8,2,gs=gs,seed=seed,door=2); im=h['im']; base=im.height-1
    stp=pv.stair_side(rise=32,depth=7,run=6,up='L'); bal=pv.balcony_side(48)
    o=Image.new('RGBA',(im.width,im.height+6)); o.alpha_composite(im); o.alpha_composite(bal,(24,base-32-6)); o.alpha_composite(stp,(72,base+4-stp.height))
    h=dict(h); h['im']=o; h['below']=6; return h
