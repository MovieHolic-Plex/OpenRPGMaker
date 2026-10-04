# batch 6a: village house kit (chipset idiom: half-timber frame + plaster infill or stone, scale-tile roof, front gable)
# wall columns: L end | M plain, brace '\' | N plain, brace '/' | W window | D door | R end
# roof columns: hL hip end | r plain | gL gM gR front gable (over the door, 3 wide) | hR hip end
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
PAL.setdefault('slate',['#0e0c1e','#1e1a3c','#2e2a5e','#443e86','#5e58a8','#827cc6','#b0aae0']); GRAIN.setdefault('slate',(0.06,2))
PAL.setdefault('plaster',['#3a3028','#665a4c','#907f6a','#b4a288','#cebf a2'.replace(' ',''),'#e2d6bc','#f4ecd8']); GRAIN.setdefault('plaster',(0.1,1.6))
P={}; WATER=set()
STYLES={'timber':dict(roof='cloth',infill='plaster',beam='bark',found='stone'),
        'stone': dict(roof='slate',infill='stone',beam='bark',found='mstone')}
RH=32; SH=32

def cols_for(w,door=None,windows='auto',gable=True):
    # user rules (2026-09-25): a wall face is >= 3 cells; windows only on plain inner cells not next to the door
    assert w>=3
    door=w//2 if door is None else door
    cols=['L']+['M']*(w-2)+['R']; cols[door]='D'
    for i in range(1,w-1):
        if cols[i]=='M':
            cols[i]='M' if i<door else 'N'                                  # braces mirror about the door
            if (windows=='auto' and abs(i-door)>1) or (windows!='auto' and i in windows and abs(i-door)>1): cols[i]='W'
    roof=['hL']+['r']*(w-2)+['hR']
    if gable and 1<=door<=w-2 and w>=5: roof[door-1:door+2]=['gL','gM','gR']
    return cols,roof

def _roof_px(c,x,y,W,R):
    xx=x%16; course=y//4; off=2 if course%2 else 0; lx=(xx+off)%4; ly=y%4
    v=0.92-0.3*(y/RH)
    if ly==3: v-=0.32
    elif lx==0 or lx==3: v-=0.16 if ly>0 else 0.05
    elif ly==0 and lx==1: v+=0.1
    return v

def house(cols,roof,floors=1,style='timber',seed=120):
    st=STYLES[style]; n=len(cols); W=n*16; H=RH+SH*floors
    c=C(W,H+1,seed=seed); c.period=16; B=st['beam']; R=st['roof']
    # ---------- walls: one storey = 2 rows (32px) so a 16x24 character fits the door ----------
    for f in range(floors):
        y0=RH+SH*(floors-1-f); ground=(f==0)
        c.group(10+f); c.new()
        for y in range(y0,y0+SH):
            for x in range(W):
                if st['infill']=='plaster': v=0.66+(vnoise(x%16,y,3,seed)-0.5)*0.12-0.06*(y-y0)/SH
                else:
                    row=(y-y0)//4; off=4 if row%2 else 0; v=0.6+(_hash(((x%16)+off)//8,row,seed)-0.5)*0.22
                    if (y-y0)%4==3 or ((x%16)+off)%8==7: v-=0.28
                c.setv(x,y,st['infill'],v)
        def post(x,y1,y2):
            for y in range(y1,y2):
                for k in range(3): c.tone(x+k,y,B,(4,3,1)[k])
        yb=y0+SH-2                                                                  # foundation / jetty rows
        for x in range(W): c.tone(x,y0,B,4); c.tone(x,y0+1,B,2)
        if style=='timber':
            for x in range(W): c.tone(x,y0+19,B,4); c.tone(x,y0+20,B,2)              # mid rail at sill height
        if ground:
            for x in range(W):
                c.setv(x,yb,st['found'],0.72); c.setv(x,yb+1,st['found'],0.45)
                if x%8==0: c.tone(x,yb,st['found'],2)
        elif style=='timber':
            for x in range(W): c.tone(x,yb,B,4); c.tone(x,yb+1,B,1)
        else:
            for x in range(W): c.setv(x,yb,'stone',0.95); c.setv(x,yb+1,'stone',0.5)
        for i,k in enumerate(cols):
            x0=i*16; kk=k if (ground or k!='D') else 'W'
            if style=='timber':
                post(x0,y0,yb)
                if kk=='R': post(x0+13,y0,yb)
                if kk in 'MN':
                    for (ya,yz) in ((y0+2,y0+19),(y0+21,yb)):
                        n=yz-ya
                        for j in range(n):
                            x=x0+3+round(j*10/n) if kk=='M' else x0+13-round(j*10/n)
                            c.tone(x,ya+j,B,3); c.tone(x+(1 if kk=='M' else -1),ya+j,B,2)
            else:
                for (qx,side) in (((x0,1) if kk=='L' else (None,0)),((x0+12,-1) if kk=='R' else (None,0))):
                    if qx is None: continue
                    for q in range(0,SH-4,4):
                        wq=4 if (q//4)%2 else 3
                        for y in range(y0+2+q,min(yb,y0+5+q)):
                            for x in range(qx if side>0 else qx+4-wq,(qx+wq) if side>0 else qx+4): c.setv(x,y,'stone',0.9)
            if kk=='W':
                wy=y0+6
                c.new()
                for y in range(wy,wy+12):
                    for x in range(x0+5,x0+12):
                        if y==wy and x in (x0+5,x0+11): continue
                        c.tone(x,y,'cryst',1 if y<wy+4 else 2)
                c.tone(x0+6,wy+2,'cryst',5); c.tone(x0+6,wy+3,'cryst',4); c.tone(x0+10,wy+8,'cryst',4)
                for y in range(wy,wy+12): c.tone(x0+8,y,B,3)
                for x in range(x0+5,x0+12): c.tone(x,wy+6,B,3)
                for y in range(wy,wy+13): c.tone(x0+4,y,B,4); c.tone(x0+12,y,B,1)
                for x in range(x0+5,x0+12): c.tone(x,wy-1,B,4)
                for x in range(x0+3,x0+14): c.tone(x,wy+13,'wood',5); c.tone(x,wy+14,'wood',2)       # sill
            if kk=='D':
                dy=y0+6; c.new()
                for y in range(dy,yb):
                    for x in range(x0+4,x0+13):
                        if y==dy and x in (x0+4,x0+12): continue
                        if y==dy+1 and x in (x0+4,x0+12): continue
                        c.setv(x,y,'wood',0.68-(0.22 if (x-x0)%3==1 else 0)-0.12*(y-dy)/(yb-dy))
                for y in range(dy,yb): c.tone(x0+3,y,B,4); c.tone(x0+13,y,B,1)
                for x in range(x0+5,x0+12): c.tone(x,dy-1,B,4)
                for (x,y) in ((x0+5,dy+5),(x0+11,dy+5),(x0+5,dy+17),(x0+11,dy+17)): c.tone(x,y,'iron',4)
                c.tone(x0+11,dy+11,'gold',5); c.tone(x0+11,dy+12,'gold',3)
                for x in range(x0+2,x0+15): c.tone(x,yb,st['found'],6); c.tone(x,yb+1,st['found'],3)
    for x in range(1,W-1):                                                         # eave shadow on the top storey
        c.darken(x,RH,2); c.darken(x,RH+1,1); c.darken(x,RH+2,1)
    # ---------- roof ----------
    c.group(1); c.new()
    for y in range(RH):
        inset=round(9*(RH-1-y)/(RH-1))                                             # hip: ends slope inward
        for x in range(W):
            if x<inset or x>W-1-inset: continue
            v=_roof_px(c,x,y,W,R)
            if x<16: v+=0.12                                                       # left hip catches the light
            if x>=W-16 and x>W-1-inset-(16-inset) : v-=0.2 if x>W-17 else 0
            c.setv(x,y,R,v)
    for y in range(RH):                                                            # hip ridges
        inset=round(9*(RH-1-y)/(RH-1)); c.tone(inset,y,R,6 if y<RH-1 else 3); c.tone(W-1-inset,y,R,2)
        if inset<16: c.tone(inset+ (16-inset if False else 0),y,R,6) if False else None
    for x in range(9,W-9): c.tone(x,0,R,6); c.tone(x,1,R,4)
    for x in range(W): c.tone(x,RH-1,R,1)
    # front gable over the door: a raised '/\' roof with a timber or stone gable wall inside
    if 'gM' in roof:
        g0=roof.index('gL')*16; gx=g0+24
        c.group(2); c.new()
        for y in range(0,RH+2):
            half=int(23*y/(RH+1))+1
            for x in range(gx-half,gx+half+1):
                if not (0<=x<W): continue
                edge=half-abs(x-gx)
                if edge<=5:                                                       # roof planes, 6px thick
                    v=_roof_px(c,x+ (y if x<gx else -y),y,W,R)+(0.12 if x<gx else -0.14)
                    c.setv(x,y,R,v)
                else:
                    if st['infill']=='plaster':
                        c.setv(x,y,'plaster',0.68)
                        if abs(x-gx)<=1: c.tone(x,y,B,3 if x<=gx else 2)
                        if y in (RH-6,RH-5): c.tone(x,y,B,3)
                    else:
                        row=y//4; off=4 if row%2 else 0; v=0.6+(_hash((x+off)//8,row,seed)-0.5)*0.22
                        if y%4==3 or (x+off)%8==7: v-=0.28
                        c.setv(x,y,'stone',v)
        for y in range(0,RH+2):
            half=int(23*y/(RH+1))+1
            for x in (gx-half,gx+half):
                if 0<=x<W: c.tone(x,y,R,5 if x<gx else 1)
        c.tone(gx,0,R,6)
        c.new()                                                                    # round gable window
        for y in range(15,22):
            for x in range(gx-3,gx+4):
                if (x-gx)**2+(y-18.5)**2<=11: c.tone(x,y,'cryst',2 if y<18 else 3)
        c.tone(gx-1,17,'cryst',5)
        for y in range(15,22): c.tone(gx,y,B,3) if (gx-0)**0 else None
    return c

def chimney(style='timber'):
    c=C(16,32,seed=130); c.group(1); c.box(4,6,8,2,20,'red' if style=='timber' else 'stone')
    for y in range(8,26):
        for x in range(4,12):
            if (y%3==0) or ((x+(2 if (y//3)%2 else 0))%4==0): c.darken(x,y,1)
    c.group(2); c.box(3,4,10,2,2,'stone',bias=0.1)
    c.new()
    for x in range(5,11): c.tone(x,4,'dark',1)
    return c

def build(w,floors=1,style='timber',door=None,gable=True):
    cols,roof=cols_for(w,door,gable=gable); return house(cols,roof,floors,style)
P['반목조 집 5칸 1층']=lambda: build(5)
P['반목조 집 7칸 2층']=lambda: build(7,2)
P['돌집 7칸 1층']=lambda: build(7,style='stone')
P['돌집 7칸 2층']=lambda: build(7,2,'stone',door=2)
P['굴뚝 (반목조)']=lambda: chimney('timber')
P['굴뚝 (돌)']=lambda: chimney('stone')
