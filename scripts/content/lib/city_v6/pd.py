# batch 4: more jungle objects (fixed front-above view, chipset texture)
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
from pa import mossify, vine
P={}; WATER=set()

FLAME=["......x.....",
       ".....xo.....",
       "....oxo..x..",
       "....oxxo.o..",
       "...ooxxoo...",
       "...fooxoof..",
       "..ffoxxxofF.",
       "..FfoooofF..",
       "...FfffFF...",]
FK={'x':('fire',6),'o':('fire',4),'f':('fire',3),'F':('fire',2)}

def cave():
    # dungeon mouth in a mossy rock mound, front-facing and symmetric; the dark arch is the walkable entrance
    c=C(48,48,seed=81); c.shadow(24,45,23,2.6)
    c.group(1); c.ellipsoid(24,22,21,19,'mstone',amb=0.25,bump=0.45,bsc=4)
    c.group(2); c.ellipsoid(7,36,8,9,'mstone',amb=0.25,bump=0.4,bsc=3)
    c.group(3); c.ellipsoid(41,36,8,9,'mstone',amb=0.25,bump=0.4,bsc=3,bias=-0.05)
    c.group(4); c.new()
    for y in range(22,46):
        for x in range(12,37):
            dx=(x+0.5-24)/10.5; dy=(y+0.5-33)/11
            if (dy<0 and dx*dx+dy*dy<=1) or (dy>=0 and abs(dx)<=1):
                d=max(0,1-abs(dx))*0.25; c.setv(x,y,'dark',0.35-d-0.004*(y-22),grain=False)
    # voussoir stones around the arch, each its own block
    k=0
    for a in range(0,181,20):
        r=math.radians(a); k+=1; c.group(10+k)
        c.ellipsoid(24+math.cos(r)*11.5,33-math.sin(r)*12,2.7,2.2,'mstone',bias=-0.08,bump=0.2)
    for s in (-1,1):
        for y in (37,42):
            k+=1; c.group(10+k); c.ellipsoid(24+s*11.8,y,2.5,2.5,'mstone',bias=-0.12)
    c.group(40); c.box(21,18,6,2,3,'mstone',bias=0.05)            # keystone with a carved eye
    c.tone(23,22,'teal',4); c.tone(24,22,'teal',5); c.tone(23,21,'mstone',1); c.tone(24,21,'mstone',1)
    mossify(c,2,2,46,20,'mstone',thr=0.5,topbias=0.45)
    for x0 in (19,29): vine(c,[(x0,23),(x0+1,25),(x0,27)])
    return c
P['던전 입구 (바위 동굴)']=cave

def arch():
    # ruined temple archway: two pillars under a carved lintel; the middle column is walkable
    c=C(48,48,seed=82); c.shadow(24,45.5,23,2.2)
    c.group(1); c.box(5,16,9,2,28,'mstone')
    c.group(2); c.box(34,16,9,2,28,'mstone',bias=-0.04)
    for x in (7,10,36,39):
        for y in range(19,43): c.darken(x,y,1)
    c.group(3); c.box(4,42,11,1,3,'mstone',bias=0.05); c.group(4); c.box(33,42,11,1,3,'mstone',bias=0.02)
    c.group(5); c.box(2,3,44,4,10,'mstone')                     # lintel: top 4 rows, face 10
    for x in range(2,46): c.darken(x,8,1); c.darken(x,15,1)
    # carved face panel in the middle
    face=["..kkkkkkkkkkk..",
          ".k12222222221k.",
          ".k2k00k2k00k2k.",
          ".k22222k22222k.",
          ".k2222k1k2222k.",
          ".k22k00000k22k.",
          "..kkkkkkkkkkk.."]
    c.lit(face,16,8,{'k':('mstone',1),'0':('mstone',0),'1':('mstone',5),'2':('mstone',3)})
    for x in (6,10,36,40): c.tone(x,10,'mstone',1); c.tone(x+1,11,'mstone',1); c.tone(x,12,'mstone',1)  # glyphs
    # crack and a missing corner
    c.line(30,8,33,15,'mstone',0)
    for (x,y) in ((45,3),(45,4),(44,3),(45,5)): c.m[y][x]=None
    c.group(6); c.ellipsoid(40,45,3,1.8,'mstone',bump=0.3)       # fallen chip
    mossify(c,2,2,46,44,'mstone',thr=0.62,topbias=0.35)
    vine(c,[(9,13),(8,17),(9,21),(8,25)]); vine(c,[(38,13),(39,17),(38,21)])
    return c
P['무너진 신전 아치']=arch

def hut():
    # tribal stilt hut: thatched hip roof, plank wall with a door, platform on stilts and a ladder
    c=C(48,48,seed=83); c.shadow(24,45.5,21,2.2)
    c.group(1)
    for x in (7,17,29,39):
        c.new()
        for y in range(34,46): c.setv(x,y,'bark',0.8); c.setv(x+1,y,'bark',0.45)
    c.group(2); c.box(3,30,42,2,4,'wood')                      # platform deck + front beam
    for x in range(3,45,5): c.tone(x,33,'wood',1)
    c.group(3); c.box(9,19,30,0,11,'wood',front=0.62)          # plank wall
    for x in range(9,39,3):
        for y in range(19,30): c.darken(x,y,1)
    c.group(4); c.new()
    for y in range(22,30):
        for x in range(20,28): c.setv(x,y,'dark',0.3-0.02*(y-22),grain=False)
    for x in range(20,28): c.tone(x,21,'bark',2)
    c.group(5)                                                  # thatch hip roof
    c.poly([(12,2),(36,2),(47,22),(1,22)],'rope',lambda x,y:0.95-0.3*(y-2)/20-0.12*max(0,x-24)/23)
    for y in range(3,22):
        for x in range(1,47):
            if c.m[y][x]=='rope' and (x*3+y)%5==0: c.darken(x,y,1)
    for x in range(12,37): c.tone(x,2,'rope',6); c.tone(x,3,'rope',5)
    for x in range(1,47):
        if c.m[21][x]=='rope': c.tone(x,21,'rope',1)
        if c.m[20][x]=='rope' and x%2: c.tone(x,22,'rope',2)       # ragged eave fringe
    c.group(6); c.new()                                          # ladder
    for y in range(30,46): c.tone(20,y,'bark',4); c.tone(27,y,'bark',3)
    for y in range(32,46,3):
        for x in range(21,27): c.tone(x,y,'bark',5)
    return c
P['부족 오두막 (기둥 위)']=hut

def well():
    c=C(32,32,seed=84); c.shadow(16,29.5,14,2)
    c.group(1); c.cylinder(16,16,26,12,'stone',capry=5)
    for y in range(17,28):
        for x in range(4,29):
            if c.m[y][x]=='stone' and ((y-16)%4==0 or ((x+(4 if (y-16)//4%2 else 0))%8==0)): c.darken(x,y,1)
    c.new()
    for y in range(12,21):
        for x in range(6,27):
            dx=(x+0.5-16)/9; dy=(y+0.5-16)/3.4
            if dx*dx+dy*dy<=1: c.tone(x,y,'teal',1 if dy<0 else 2)
    c.group(2)
    for x in (4,27):
        c.new()
        for y in range(2,18): c.setv(x,y,'bark',0.8); c.setv(x+1,y,'bark',0.45)
    c.group(3); c.hcyl(4,29,4,1.6,'bark',bias=0.1)
    c.group(4); c.line(16,5,16,11,'rope',4)
    c.group(5); c.box(14,11,5,1,3,'wood')
    mossify(c,3,12,29,27,'stone',thr=0.72)
    return c
P['돌 우물']=well

def brazier():
    c=C(16,32,seed=85); c.shadow(8,29.5,6.5,1.6)
    c.group(1); c.box(3,25,10,1,4,'mstone')
    c.group(2); c.box(5,16,6,0,9,'mstone',front=0.7)
    for y in range(17,25): c.darken(9,y,1)
    c.group(3); c.ellipsoid(8,15,6.5,3,'stone',bias=0.05)
    c.new()
    for x in range(3,14): c.tone(x,13,'dark',2) if abs(x-8)<5 else None
    c.group(4); c.new(); c.lit(FLAME,2,4,FK)
    c.spark=[(4,2),(12,3)]
    return c
P['돌 화로']=brazier

def canoe():
    # dugout canoe lying east-west on the water, seen from the front and above
    c=C(48,16,seed=86)
    c.group(1)
    c.poly([(1,5),(6,4),(42,4),(47,5),(44,12),(4,12)],'wood',lambda x,y:0.8-0.35*(y-4)/8)
    c.new()
    for y in range(5,9):
        for x in range(4,45):
            dx=(x+0.5-24)/19.5; dy=(y+0.5-6.3)/2.4
            if dx*dx+dy*dy<=1: c.tone(x,y,'wood',1 if y<7 else 2)
    for x in range(6,43): c.tone(x,4,'wood',6) if c.m[4][x] else None
    for x in (14,34):
        for y in range(5,9): c.tone(x,y,'wood',4)                  # thwarts
    c.group(2); c.line(10,9,36,3,'bark',5); c.line(10,10,36,4,'bark',3)   # paddle across
    c.group(3); c.ellipsoid(37.5,3.5,2.5,1.3,'bark',bias=0.2)
    for x in range(3,46): c.sh[13][x]=90; c.sh[14][x]=60 if 6<x<42 else 0
    return c
P['통나무 카누']=canoe; WATER.add('통나무 카누')

def obelisk():
    c=C(16,48,seed=87); c.shadow(8,45.5,7,1.8)
    c.group(1); c.box(1,40,14,2,5,'mstone')
    c.group(2); c.poly([(4,9),(12,9),(13,40),(3,40)],'mstone',lambda x,y:0.95 if x<8 else 0.55)
    c.group(3); c.poly([(8,2),(12,9),(4,9)],'gold',lambda x,y:0.95 if x<8 else 0.55)
    for i,y in enumerate(range(13,36,5)):                        # sparse carved glyphs down the face
        g=((6,y),(7,y),(7,y+1)) if i%2 else ((6,y),(6,y+1),(7,y+1),(8,y+1))
        for (x,yy) in g: c.tone(x,yy,'mstone',2); c.tone(x,yy+1,'mstone',5) if c.m[yy+1][x]=='mstone' and (x,yy+1) not in g else None
    mossify(c,2,30,14,44,'mstone',thr=0.62,topbias=0.0)
    vine(c,[(4,10),(4,14),(3,18)])
    c.spark=[(7,3)]
    return c
P['덩굴 감긴 오벨리스크']=obelisk

def heliconia():
    # lobster-claw flower: one upright spike of big red boat-shaped bracts, alternating, yellow rims; two paddle leaves low
    c=C(16,32,seed=88); c.shadow(8,29.5,6.5,1.6)
    for s_,tipx in ((-1,1),(1,14)):
        c.group(20+s_); c.poly([(8,29),(8+s_*2,24),(tipx,17),(tipx+s_*-1,15),(8+s_*1,21)],'leaf',(lambda x,y:0.85) if s_<0 else (lambda x,y:0.55))
        c.line(8,28,tipx+(1 if s_<0 else -1),17,'leaf',2)
    c.group(1); c.new()
    for y in range(3,29): c.tone(8,y,'leaf',3); c.tone(7,y,'leaf',4) if y>20 else None
    c.group(2)
    for i,y in enumerate((5,9,13,17)):
        s_=1 if i%2 else -1; c.new()
        boat=["yrrrrr.","yRrrrrr",".yRRRr.","..yyy.."]
        for j,row in enumerate(boat):
            for k,ch in enumerate(row):
                if ch=='.': continue
                x=8+s_*(k+1) if s_>0 else 8-(k+1)
                t={'r':5,'R':3,'y':None}[ch]
                if t is None: c.tone(x,y+j-2,'gold',5 if j<2 else 4)
                else: c.tone(x,y+j-2,'red',t if s_<0 else t-1)
    return c
P['헬리코니아 (게발 꽃)']=heliconia

def termite():
    # cathedral termite mound: tall fluted clay spires, lit from the upper left
    c=C(32,32,seed=89); c.shadow(16,29.5,13,2)
    def spire(cx,top,base,hw,g,bias=0.0):
        c.group(g); c.poly([(cx-1,top),(cx+1,top),(cx+hw,base),(cx-hw,base)],'dirt',lambda x,y:(0.95 if x<cx else 0.6)+bias)
        c.ellipsoid(cx,top+0.5,1.6,1.2,'dirt',bias=0.25+bias)
    spire(22,8,28,5,1,-0.06); spire(9,11,28,5,2,0.02); spire(16,2,29,7,3)
    for x in range(3,30):
        for y in range(3,29):
            if c.m[y][x]=='dirt' and x%3==1 and vnoise(x,y,2,5)>0.4: c.darken(x,y,1)
    for (x,y) in ((14,18),(18,23),(10,23),(23,19)): c.tone(x,y,'dark',1); c.tone(x,y+1,'dirt',1)
    c.group(9); c.ellipsoid(16,27,13,3,'dirt',amb=0.3,bump=0.4,bias=-0.05)
    return c
P['흰개미 둔덕']=termite

def fruit():
    c=C(16,16,seed=90); c.shadow(8,14.2,7,1.6)
    c.group(1); c.cylinder(8,8,13,6,'rope',capry=2.2)
    for y in range(9,14):
        for x in range(2,15):
            if c.m[y][x]=='rope' and (x+y)%3==0: c.darken(x,y,1)
    c.group(2)
    for (x0,t) in ((4,5),(7,6),(10,5)):
        c.new()
        for j in range(5): c.tone(x0+j//2,7-j+ (1 if j==4 else 0),'gold',t-(1 if j>2 else 0))
    c.group(3); c.ellipsoid(12,6.5,2,2,'red',bias=0.1)
    c.group(4); c.ellipsoid(5,7,1.8,1.8,'cloth',bias=0.1)
    c.tone(12,4,'leaf',4); c.tone(5,5,'leaf',4)
    return c
P['과일 바구니']=fruit
