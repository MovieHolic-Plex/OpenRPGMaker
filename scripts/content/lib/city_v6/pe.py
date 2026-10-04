# batch 4b: redraws (well, canoe, obelisk, termite mound) + stilt-hut kit
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
PAL.setdefault('clay',['#1c0f0b','#3a1f16','#5c3321','#7e4a2e','#9e653e','#bc8558','#d8a878']); GRAIN.setdefault('clay',(0.16,1.5))
from pa import mossify, vine
P={}; WATER=set()

def masonry_ring(c,cx,y0,y1,rx,course=4,stone=6,mat='stone',seed=0,bulge=2.5):
    # upright round wall built of individual blocks: each block is its own shape so mortar contours appear
    k=0
    for ci,yy in enumerate(range(y0,y1+3,course)):
        off=(stone//2) if ci%2 else 0
        for sx in range(int(cx-rx)-stone+off,int(cx+rx)+1,stone):
            k+=1; c.group(500+k); c.new(); b=(_hash(sx,yy,seed+3)-0.5)*0.18
            for y in range(yy,min(y1+3,yy+course)):
                for x in range(sx,sx+stone):
                    dx=(x+0.5-cx)/rx
                    if abs(dx)>1: continue
                    if y>y1-1+bulge*math.sqrt(max(0,1-dx*dx)): continue
                    nz=math.sqrt(1-dx*dx); edge=0.1 if y==yy else (-0.08 if y==yy+course-1 else 0)
                    c.setv(x,y,mat,c.shade(dx,0.1,nz,0.3)+b+edge)

def well():
    # village well: round stone ring from the front-above. The 3D cue is inside the hole: the far inner wall shows as a
    # dark stone band above the water. Curved front wall of small courses, two thin posts, windlass, rope and bucket
    # above the hole, and a small shingled roof kept high so the ring stays visible.
    c=C(32,32,seed=91); c.shadow(16,29.4,14.5,2)
    cx,cy,rx,ry=16,19,12.5,5
    c.group(6); c.new()                                               # rim: top face of the ring
    for y in range(12,26):
        for x in range(2,31):
            dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry
            if dx*dx+dy*dy<=1: c.setv(x,y,'stone',0.98-0.12*dy-0.1*max(0,dx))
    c.group(7); c.new()
    for y in range(12,26):
        for x in range(2,31):
            dx=(x+0.5-cx)/(rx-3.2); dy=(y+0.5-cy+0.2)/(ry-1.9)
            if dx*dx+dy*dy<=1:
                if dy<-0.15: c.tone(x,y,'stone',2 if dy<-0.6 else 1)          # far inner wall, in shade
                else: c.tone(x,y,'teal',1 if dy<0.5 else 2)                # water
    for x in range(12,15): c.tone(x,20,'teal',4)
    c.tone(19,21,'teal',3); c.tone(20,21,'teal',3)
    # front wall: 5 rows hanging below the rim's front curve, so its top and bottom edges both curve
    for x in range(2,31):
        dx=(x+0.5-cx)/rx
        if abs(dx)>1: continue
        yt=int(round(cy+ry*math.sqrt(1-dx*dx)))
        for j in range(5):
            y=yt+1+j; course=0 if j<2 else 1; off=3 if course else 0
            v=0.08+c.shade(dx,0.1,math.sqrt(1-dx*dx),0.3)+(_hash((x+off)//6,course,91)-0.5)*0.14
            if j==2 or (x+off)%6==0: v-=0.3
            if j==4: v-=0.2
            c.setv(x,y,'stone',v,oid=700)
        c.tone(x,yt,'stone',5 if dx<0.3 else 4)                          # the rim's front lip
    for y in range(12,24):                                            # keep the rim mid-grey like the chipset's
        for x in range(32):
            if c.m[y][x]=='stone' and (c.fix[y][x] is None or c.fix[y][x]>=3): c.darken(x,y,1)
    c.group(1)
    for x in (4,26):                                                  # thin posts on the rim ends
        c.new()
        for y in range(5,20): c.tone(x,y,'wood',4); c.tone(x+1,y,'wood',2)
    c.group(2); c.hcyl(5,26,7,1.3,'wood',bias=0.05)                   # windlass
    c.new(); c.tone(27,6,'wood',3); c.tone(28,7,'wood',3); c.tone(28,8,'wood',2)   # crank
    c.new()
    for y in range(9,13): c.tone(16,y,'rope',4)                       # rope and bucket above the hole
    c.group(3); c.box(14,12,5,1,3,'wood',bias=0.05); c.new()
    for x in range(14,19): c.tone(x,14,'iron',3)
    c.group(9); c.new()                                               # small roof, 2 shingle courses, ridge
    for y in range(0,5):
        x0=6-y; x1=26+y
        for x in range(x0,x1+1):
            t=5 if y in (1,3) else 4
            if (x+(2 if y>=3 else 0))%4==0 and y>0: t-=1
            if x>16: t-=1
            c.tone(x,y,'clay',max(1,t))
    for x in range(6,27): c.tone(x,0,'clay',6 if x<=16 else 5)
    for x in range(1,32): c.tone(x,5,'clay',2)
    return c
P['돌 우물']=well

def canoe():
    # dugout canoe lying east-west on the water, front-above view: outer hull, the hollow, a paddle inside
    c=C(48,16,seed=92)
    top=lambda x:4.6-2.6*((x-24)/22)**4                           # gunwale rises at bow and stern
    bot=lambda x:12.2-4.5*((x-24)/22)**4
    c.group(1); c.new()
    for x in range(2,47):
        t,b=top(x),bot(x)
        for y in range(int(t),int(b)+1):
            dy=(y+0.5-t)/max(1,b-t)*2-1; nz=math.sqrt(max(0,1-dy*dy))
            c.setv(x,y,'wood',c.shade(0,dy*0.9+0.1,nz,0.25)+0.05)
    c.group(2); c.new()                                           # the hollow: far wall lit, floor dark
    for y in range(1,10):
        for x in range(5,44):
            dx=(x+0.5-24)/19; dy=(y+0.5-5.2)/2.3
            if dx*dx+dy*dy<=1 and y<=top(x)+0.5: c.tone(x,y,'wood',3 if dy<-0.35 else (2 if dy<0.3 else 1))
    for x in range(3,46):                                         # gunwale highlight
        y=int(top(x)); 
        if c.m[y][x]: c.tone(x,y,'wood',6 if x<24 else 5)
    for x0 in (15,33):                                           # thwarts
        c.group(3); c.box(x0,3,3,1,2,'wood',bias=0.15)
    for ex,s in ((2,1),(45,-1)):                                  # carved bow and stern knobs
        c.group(4); c.ellipsoid(ex+s*1.5,2.2,1.8,1.6,'wood',bias=0.2)
        c.tone(ex+s*2,5,'red',4); c.tone(ex+s*2,6,'cream',5); c.tone(ex+s*2,7,'red',3)
    c.group(5); c.line(12,5,29,3,'bark',5)                       # paddle: shaft + leaf blade
    c.group(6); c.ellipsoid(32.5,3,4,1.3,'bark',bias=0.15)
    for x in range(3,46): c.sh[13][x]=80; c.sh[14][x]=55 if 8<x<40 else 0
    return c
P['통나무 카누']=canoe; WATER.add('통나무 카누')

def obelisk():
    c=C(16,48,seed=93); c.shadow(8,44.6,7.5,1.8)
    c.group(1); c.box(0,40,16,2,4,'mstone')
    c.group(2); c.box(2,36,12,2,4,'mstone',bias=0.04)
    c.group(3); c.new()
    for y in range(9,37):
        f=(y-9)/28; x0=round(4-1*f); x1=round(11+1*f)
        for x in range(x0,x1+1):
            if x<=x0+1: v=1.0
            elif x>=x1-1: v=0.38
            else: v=0.72-0.1*f
            c.setv(x,y,'mstone',v)
    # recessed panel with engraved glyphs
    for y in range(13,34):
        c.tone(5,y,'mstone',2); c.tone(10,y,'mstone',5)
    for x in range(5,11): c.tone(x,13,'mstone',2); c.tone(x,34,'mstone',5)
    glyphs=[["0110","1001","0110"],["0100","1110","0100"],["1001","0110","1001"]]
    for i,g in enumerate(glyphs):
        for j,row in enumerate(g):
            for k,ch in enumerate(row):
                if ch=='1': c.tone(6+k,16+i*6+j,'mstone',2); c.tone(6+k,17+i*6+j,'mstone',5) if j==len(g)-1 or g[j+1][k]=='0' else None
    c.group(4); c.new()                                           # pyramidion
    for y in range(3,9):
        hw=(y-2)*0.75
        for x in range(4,12):
            if abs(x+0.5-8)<=hw+0.3: c.tone(x,y,'gold',6 if (x<8 and y<5) else (5 if x<8 else 3))
    c.tone(7,2,'gold',6)
    mossify(c,0,36,16,45,'mstone',thr=0.6)
    vine(c,[(4,10),(3,14),(4,18),(3,22)])
    c.spark=[(6,3)]
    return c
P['덩굴 감긴 오벨리스크']=obelisk

def termite():
    # cathedral termite mound of red laterite: three ribbed cones with real volume
    c=C(32,32,seed=94); c.shadow(16,29.6,14,2.2)
    def cone(cx,top,base,hw,g,bias=0.0):
        c.group(g); c.new()
        for y in range(top,base+1):
            f=(y-top)/max(1,base-top); w=0.9+hw*(f**0.8)
            for x in range(int(cx-w)-1,int(cx+w)+2):
                dx=(x+0.5-cx)/w
                if abs(dx)>1: continue
                rib=(vnoise(x*2.2,y*0.35,1.0,g*11)-0.5)*0.7
                nx=dx+rib; nz=math.sqrt(max(0.05,1-dx*dx)); L=math.sqrt(nx*nx+0.09+nz*nz)
                c.setv(x,y,'clay',c.shade(nx/L,-0.3/L,nz/L,0.3)+bias-0.1*f)
    c.group(3); c.ellipsoid(16,26.5,13.5,3,'clay',amb=0.3,bump=0.5,bias=-0.12)
    cone(23,9,27,5,1,-0.08); cone(8,12,27,4.5,2,-0.02); cone(16,1,28,7.5,3)
    for (x,h) in ((3,3),(5,2),(27,3),(29,2),(20,2)):                 # grass tufts at the foot
        for j in range(h): c.tone(x,29-j,'leaf',4-j%2); c.tone(x+1,29-j+1,'leaf',3)
    return c
P['흰개미 둔덕']=termite

# ---------- stilt hut kit ----------
# rows (16px each): R0 roof upper (ridge), R1 roof lower (eave fringe), R2 plank wall, R3 deck + stilts
# columns: L end, M plain, D door (+ladder), W window, R end. build(w, door=None) -> grid of names
def _hut_canvas(cols):
    n=len(cols); W=n*16; c=C(W,64,seed=95); c.period=16
    # roof (hip): slope only in the end columns
    c.group(1); c.new()
    for y in range(2,31):
        inset=round(11*(30-y)/28)
        for x in range(0,W):
            if x<inset or x>W-1-inset: continue
            xx=x%16; tier=(y-2)%7; v=0.98-0.4*tier/6-0.12*(y-2)/28
            if (xx*3+y)%4==0: v-=0.14
            if tier==6 and (xx%4)!=1: v-=0.25
            if x>=W-16: v-=0.12*(1-(W-1-x-inset)/max(1,16-inset)) if W-1-x<16 else 0
            c.setv(x,y,'rope',v)
    for x in range(11,W-11): c.tone(x,2,'rope',6); c.tone(x,3,'rope',5)
    for x in range(0,W):
        if c.m[30][x]: c.tone(x,30,'rope',1)
        if c.m[29][x] and x%2: c.tone(x,31,'rope',2)
    # wall under the eave
    c.group(2); c.new()
    for y in range(32,46):
        for x in range(5,W-5): c.setv(x,y,'wood',0.66-0.12*(y-32)/14-(0.16 if x%4==1 else 0))
    for x in range(5,W-5): c.tone(x,32,'wood',1)
    for i,k in enumerate(cols):
        x0=i*16
        if k=='D':
            c.group(3); c.new()
            for y in range(35,46):
                for x in range(x0+4,x0+12): c.setv(x,y,'dark',0.3-0.02*(y-35),grain=False)
            for x in range(x0+3,x0+13): c.tone(x,34,'bark',3)
            for y in range(34,46): c.tone(x0+3,y,'bark',4); c.tone(x0+12,y,'bark',2)
        if k=='W':
            c.group(3); c.new()
            for y in range(36,42):
                for x in range(x0+5,x0+11): c.tone(x,y,'dark',1 if y<39 else 2)
            for x in range(x0+4,x0+12): c.tone(x,35,'bark',4); c.tone(x,42,'bark',5)
            for y in range(36,42): c.tone(x0+4,y,'bark',4); c.tone(x0+11,y,'bark',2); c.tone(x0+8,y,'bark',3)
    # deck: top + front beam, then stilts under each column
    c.group(4); c.box(1,46,W-2,2,3,'wood')
    for x in range(1,W-1,16): 
        for dx in (0,15): c.tone(x+dx,48,'wood',1) if 0<x+dx<W-1 else None
    for i,k in enumerate(cols):
        x0=i*16; c.group(10+i)
        for sx in ((x0+3,) if k=='L' else (x0+11,) if k=='R' else () if k=='D' else (x0+7,)):
            c.new()
            for y in range(51,64): c.setv(sx,y,'bark',0.9); c.setv(sx+1,y,'bark',0.55)
        if k=='D':
            c.new()
            for y in range(46,64): c.tone(x0+4,y,'bark',4); c.tone(x0+11,y,'bark',3)
            for y in range(52,64,3):
                for x in range(x0+5,x0+11): c.tone(x,y,'bark',5)
    return c

def hut_build(w,door=None,windows=()):
    door=w//2 if door is None else door
    cols=['L']+['M']*(w-2)+['R']
    cols[door]='D'
    for i in windows:
        if 0<i<w-1 and i!=door: cols[i]='W'
    return cols

def hut(w,door=None,windows=()):
    return _hut_canvas(hut_build(w,door,windows))
P['기둥 오두막 3칸']=lambda: hut(3)
P['기둥 오두막 5칸']=lambda: hut(5,windows=(1,3))
P['기둥 오두막 7칸']=lambda: hut(7,door=2,windows=(1,4,5))
