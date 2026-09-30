import sys; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import pj, pv
from PIL import Image
from pj_demo import storeyrows as SR
import pj_demo
L=pv.L()
def RRn(st,w,rows,nb):
    nf=rows-nb
    names=['ridge']+['back']*(nb-1)+['front']+['body']*(nf-2)+(['eave'] if nf>=2 else [])
    return [' '.join(f'{st}.roof.{n}.'+('l' if i==0 else 'r' if i==w-1 else 'm') for i in range(w)) for n in names]
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c[:3])+(c[3],)
def volume(im,roof_h,o=2,shadow=4,grad=True):
    # eave overhang: walls inset o px each side (the roof stays full width); eave shadow on the wall top;
    # the front slope darkens toward the eave, the ridge side catches light
    im=im.copy(); px=im.load(); W,H=im.size
    for y in range(roof_h,H):
        for x in list(range(0,o))+list(range(W-o,W)): px[x,y]=(0,0,0,0)
    for y in range(roof_h,min(H,roof_h+shadow)):
        for x in range(o,W-o): px[x,y]=mul(px[x,y],0.55+0.1*(y-roof_h))
    if grad:
        for y in range(0,roof_h):
            k=1.08-0.2*(y/roof_h)
            for x in range(W):
                if px[x,y][3]: px[x,y]=mul(px[x,y],k)
    for y in range(roof_h):                                 # barge boards on the roof ends
        for x,c in ((0,1),(1,4),(W-2,2),(W-1,1)): 
            if px[x,y][3]: px[x,y]=pv.WD[c]+(255,)
    return im
def house(st,w,s,R,nb,vol):
    walls=(SR(st,'lwpdpwr'[:w-1]+'r','eave','jetty')+SR('sto','l'+'wpdpw'[:w-2]+'r','plain','base')) if s==2 else SR(st,'l'+'wpdpw'[:w-2]+'r','eave','base')
    im=pj.assemble(RRn(st,w,R,nb)+walls,L)
    return volume(im,R*16) if vol else im
from vstudy import row
A=[house('tim',7,2,4,2,False),house('tim',6,1,3,1,False),house('sto',7,2,4,2,False)]
B=[house('tim',7,2,4,1,False),house('tim',6,1,3,1,False),house('sto',7,2,4,1,False)]
C=[house('tim',7,2,4,1,True),house('tim',6,1,3,1,True),house('sto',7,2,4,1,True)]
for n,v in (('A',A),('B',B),('C',C)):
    im=row(v); im.save(f'/tmp/j8city/roof_{n}.png')

def steep_hip(st,W,H,e=None,ridge_cap=True):
    # a steep hipped roof seen from the front and above: the ridge IS the top of the silhouette (the back slope is
    # hidden behind it), the two hip ends fall from the ridge ends to the eave corners -> a trapezoid, never a box.
    # front slope: east-west courses (shaded tile) lighter at the ridge, darker at the eave; hip ends: north-south
    # courses (nstex), west lit, east in shade; hip lines and ridge cap in the chipset wood/roof tones.
    e=e if e is not None else min(W//3,int(H*0.9))
    fr=pj.pairtex(st,'front',W,H).load(); lt=pj.pairtex(st,'back',W,H).load(); le=pj.nstex(st,'l',W,H).load(); re=pj.nstex(st,'r',W,H).load()
    o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(H):
        xl=e*(1-(y+0.5)/H); xr=W-xl
        for x in range(W):
            xx=x+0.5
            yb=H*0.45                                         # the back eave corner, hidden behind the ridge
            if xx<e and y<yb*(1-xx/e): continue               # empty above the back hip line (west)
            if xx>W-e and y<yb*(1-(W-xx)/e): continue         # (east)
            if xx<xl: c=le[x,y]; k=1.02
            elif xx>xr: c=re[x,y]; k=0.8
            else:
                c=fr[x,y] if y>3 else lt[x,y]; k=1.12-0.24*(y/H)
            if (xx<e and abs(y-yb*(1-xx/e))<1) or (xx>W-e and abs(y-yb*(1-(W-xx)/e))<1): c=pv.WD[4] if xx<W/2 else pv.WD[2]; k=1
            if abs(xx-xl)<1 and y>0: c=pv.WD[5]; k=1
            if abs(xx-xr)<1 and y>0: c=pv.WD[1]; k=1
            if y<2 and xl<=xx<=xr: c=(pv.WD[6] if y==0 else pv.WD[2]); k=1
            px[x,y]=mul(tuple(c[:3])+(255,),k)
    # the silhouette above the hip ends is empty: cut the triangles above each hip line's top
    for y in range(H):
        pass
    return o
def house_hip(st,w,s):
    W=w*16; R=3 if s==1 else 4
    walls=(SR(st,'lwpdpwr'[:w-1]+'r','eave','jetty')+SR('sto','l'+'wpdpw'[:w-2]+'r','plain','base')) if s==2 else SR(st,'l'+'wpdpw'[:w-2]+'r','eave','base')
    wim=pj.assemble(walls,L); roof=steep_hip(st,W,R*16-4)
    im=Image.new('RGBA',(W,roof.height+wim.height)); im.alpha_composite(roof,(0,0)); im.alpha_composite(wim,(0,roof.height))
    return volume(im,roof.height,grad=False)
D=[house_hip('tim',7,2),house_hip('tim',6,1),house_hip('sto',7,2)]
row(D).save('/tmp/j8city/roof_D.png')
