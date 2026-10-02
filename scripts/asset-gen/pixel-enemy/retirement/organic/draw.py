"""Editable final-grid anatomical drawings for the retired organic monsters.
All silhouettes, joint coordinates and surface marks are authored here, not traced.
"""
import math, sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pe_lib import Pen, NAMES
from beast_lib import blob, mass, bez, tube, settle, dot
from pe_rig import cap
CELL = 64
G = CELL - 4

# Nine joint configurations: breath, guard, recoil, stride and attack stay separate.
BOB = [0, 1, -1, 2, 0, -2, 1, 3, 0]
JAW = [1, 2, 0, 3, 1, 6, 2, 0, 0]
SWAY = [0, 1, -1, -4, 3, 5, 2, -3, 0]

def palette(b, l, s, a='9dad60', e='e4d667', h='e5d8b3', q='70505e'):
    return dict(o='191d2d', b=b, l=l, s=s, h=h, a=a, e=e, q=q,
                w='f7ebd1', r='a95452', m='445364', n='8a9ba5', k='c9d4cf')

PALS = {
'crab':palette('76716e','b1a292','484951','697d42'),
'spider':palette('644576','ac80ad','362b50','75984e','f56b62'),
'widow':palette('3c3b55','797488','24253c','bb4263','ee625c'),
'scorpion':palette('b48847','e2bc72','6e5038','775338'),
'centipede':palette('684363','a16c8c','372844','d68b40','f26359'),
'fire':palette('70416c','bd80a4','352841','ed9e44','ff7053'),
'ant':palette('a04f40','d8875b','612f35','bd9a52','efcb78'),
'beetle':palette('355274','708db5','2c304e','8270a5','cddaec'),
'mantis':palette('63864b','b4cc76','3c573c','927153','e8d988'),
'wolf':palette('788391','b6c1c4','414957','bdc3c5'),
'dire':palette('424754','87909d','292d41','666080','bc87ed'),
'horse':palette('a06846','cd9961','613f34','654338'),
'unicorn':palette('d5d8d5','f4edda','899cac','b8bde1','90ccdd','fff5dc'),
'cat':palette('c18443','edb972','70452d','453c35','b8ce6c'),
'shadow':palette('68507c','b398b2','352d53','292541','e2bd68'),
'tiger':palette('c4823d','f0b565','795033','302d39','e3bd66'),
'rat':palette('876146','bda07a','493938','be8c7c','ec685a'),
'goat':palette('946c48','c8ad81','5b4135','c8b8a0'),
'deer':palette('916846','d6b37c','573f34','71975c','b0e48b'),
'ape':palette('777d82','b2b7ad','454650','7a9258','f8994f'),
'cockatrice':palette('94744b','d1ae77','574637','b54f50','e4c877'),
'bat':palette('896548','c4a07a','4b3641','6a3e48','e3bd71'),
'moth':palette('aa865f','dbbb89','594639','6c4b42','151b2a'),
'hawk':palette('966b4f','d8c7a2','503943','dcad55','e2be60'),
'fish':palette('477ba0','93c8d0','304b72','df9755','edd568'),
'piranha':palette('3f6f9d','79b4d4','273c62','e5914e','efd571'),
'shark':palette('537e9b','99c3cd','344a66','ced9cb','f0d982'),
'snake':palette('719856','b3cd82','395637','926f46','e0d372'),
'eel':palette('386c9b','7bb5d5','2b3c69','edd266','edda68'),
'parasite':palette('bc665b','e7a085','783c4e','dd876f','e3c594'),
'worm':palette('a17c4e','d6b984','61483b','937c59','eeae67'),
'squid':palette('6f4d86','aa89b8','392d58','74c6bd','f3d477'),
}

def poly(p,pts,c='b',edge='o'): p.poly([(round(x),round(y)) for x,y in pts],c,edge)
def line(p,pts,c='o',w=1): p.line([(round(x),round(y)) for x,y in pts],c,w)
def ell(p,x,y,rx,ry,ang=0,far=False):
    return blob(p,x,y,rx,ry,ang, keys={'l':'s','b':'s','s':'o'} if far else {})
def stroke(p,pts,w=3,c='b',far=False):
    cap(p,pts,w,'s' if far else c,lit=None if far else 'l',dark=None if far else 's')
def curve(p,pts,w=2,c='b',far=False):
    q=bez(pts); stroke(p,q,w,c,far)
def eye(p,x,y,n,large=False):
    if n==7:
        line(p,[(x-1,y-1),(x+1,y+1)],'o'); line(p,[(x-1,y+1),(x+1,y-1)],'o')
    else:
        if large: ell(p,x,y,3,3); p.d.ellipse((x-2,y-2,x+2,y+2),fill=p.pal['e'])
        else: p.box((round(x),round(y),round(x+1),round(y+1)),'e')
        dot(p,x+1,y,'o')
        if large: dot(p,x-1,y-1,'w')
def mouth(p,x,y,n,width=8,saber=False):
    op=JAW[n]
    if op:
        poly(p,[(x,y),(x+width,y-1),(x+width-1,y+op),(x+1,y+op+1)],'o',None)
        for i in range(1,width-1,3):
            poly(p,[(x+i,y),(x+i+2,y),(x+i+1,y+min(3,op))],'w',None)
        if op>3: line(p,[(x+2,y+op),(x+width-3,y+op)],'r')
    else: line(p,[(x,y),(x+width,y-1)],'o')
    if saber:
        for dx in (1,6): poly(p,[(x+dx,y),(x+dx+2,y),(x+dx+1,y+7)],'w','o')
def spikes(p,pts,c='a'):
    for x,y,sz in pts:
        poly(p,[(x-2,y+1),(x,y-sz),(x+2,y+2)],c)
def scale_marks(p,cx,cy,rows=3):
    for j in range(rows):
        for i in range(5-j):
            x=cx+i*4+j*2; y=cy+j*3
            line(p,[(x,y),(x+1,y+1),(x+2,y)],'s')

def claw(p,x,y,op,n,far=False):
    ell(p,x,y,5,4,-12,far)
    poly(p,[(x+1,y-3),(x+4,y-5-op),(x+10,y-3-op),(x+7,y-op),(x+3,y)],'s' if far else 'b')
    poly(p,[(x+2,y+1),(x+8,y+1),(x+10,y-1),(x+8,y+4),(x+3,y+4)],'s' if far else 'b')
    if not far: line(p,[(x,y-2),(x+4,y-3-op),(x+7,y-3-op)],'l')

# CRUSTACEAN: asymmetrical crusher claw, rock facets, stalks, four leg pairs.
def crab(p,n):
    if n==8:
        ell(p,25,53,14,5)
        for x in (15,21,28,34): line(p,[(x,52),(x-2,47),(x+2,44)],'s',2)
        claw(p,46,54,0,n); line(p,[(32,52),(44,54)],'s',3)
        poly(p,[(6,59),(8,50),(14,47),(20,51),(23,59)],'s'); line(p,[(10,51),(14,53),(15,58)],'o'); return
    bx=27+SWAY[n]//2; by=43+BOB[n]
    for far in (True,False):
        for i in range(4):
            x=bx-10+i*5+(2 if far else 0); spread=[-8,-6,5,9][i]+(n==4)*(i%2*4-2)+(3 if far else 0)
            yy=G-(1 if far else 0)-(2 if n==2 and i==0 else 0)
            stroke(p,[(x,by+2),(x+spread,by+5+i%2*2),(x+spread-3,yy)],2,far=far)
        if far: stroke(p,[(bx+7,by-1),(bx+11,by-7),(bx+16,by-9)],3,far=True); claw(p,bx+16,by-9,1,n,True)
    poly(p,[(bx-14,by),(bx-11,by-10),(bx-5,by-14),(bx+4,by-13),(bx+11,by-7),(bx+13,by+1),(bx+8,by+6),(bx-8,by+6)],'b')
    poly(p,[(bx-12,by-2),(bx-9,by-9),(bx-5,by-12),(bx+4,by-11),(bx+1,by-4),(bx-4,by)],'l',None)
    poly(p,[(bx+2,by-2),(bx+10,by-7),(bx+12,by+1),(bx+7,by+4)],'s',None)
    line(p,[(bx-4,by-10),(bx-1,by-5),(bx+4,by-3),(bx+6,by+2)],'o'); line(p,[(bx-1,by-5),(bx-5,by-2)],'o')
    for x,y in [(bx-8,by-4),(bx+3,by-9),(bx+6,by+1)]: poly(p,[(x-2,y),(x,y-2),(x+3,y),(x+1,y+2)],'a',None)
    for x in (bx+8,bx+12):
        stroke(p,[(x-1,by-4),(x,by-11-(n==2))],2,'b'); eye(p,x,by-12-(n==2),n)
    cx=bx+18+SWAY[n]//2; cy=by+(4 if n==5 else -8 if n==3 else -1)
    stroke(p,[(bx+9,by+3),(bx+13,cy+5),(cx-4,cy)],4)
    claw(p,cx,cy,[1,2,0,5,2,0,3,4,0][n],n)
    poly(p,[(cx-2,cy-2),(cx,cy-4),(cx+2,cy-3),(cx+1,cy)],'a',None)

# ARACHNID: eight legs and distinct abdomen form; widow has taller round abdomen.
def spider(p,n,widow=False):
    if n==8:
        ell(p,24,55,12,5); ell(p,40,56,7,4)
        for i in range(4):
            x=20+i*5; stroke(p,[(x,54),(x-3,48),(x+2,45)],2)
            stroke(p,[(x+1,57),(x+4,58),(x+9,57)],2)
        eye(p,44,54,n); return
    ax,ay=(23,35+BOB[n]); tx,ty=(39+SWAY[n]//2,42+BOB[n])
    for far in (True,False):
        for i in range(4):
            hip=(tx-5+i*2,ty-2+(not far)*3)
            side=[-24,-15,6,13][i]
            knee=(hip[0]+side+(3 if far else 0),ty-11+i*2-(4 if far else 0))
            ft=(hip[0]+side+[-3,-4,4,0][i]+(3 if far else 0),G-(1 if far else 0))
            if n==4: knee=(knee[0]+(-2 if i%2 else 2),knee[1]); ft=(ft[0]+(-3 if i%2 else 3),ft[1]-(3 if i%2 else 0))
            if n==5 and i>=2: knee=(hip[0]+9,ty-8); ft=(min(60,hip[0]+14),ty+4+i)
            if n==3: knee=(knee[0]-3,knee[1]-2)
            stroke(p,[hip,knee,ft],2 if far else 3,far=far)
        if far:
            ell(p,ax,ay,12 if widow else 13,13 if widow else 10,-12)
            for x,y in [(ax-9,ay-4),(ax-3,ay-10),(ax+4,ay-10)]: spikes(p,[(x,y,4)],'b')
            if widow:
                poly(p,[(ax-2,ay-4),(ax+4,ay-3),(ax+1,ay),(ax+4,ay+5),(ax-3,ay+3),(ax,ay)],'a',None)
            else:
                poly(p,[(ax-8,ay-3),(ax-2,ay-7),(ax+5,ay-2),(ax+3,ay+2),(ax-4,ay+2)],'a',None)
                line(p,[(ax-6,ay-3),(ax-3,ay-5),(ax+1,ay-4)],'l')
    ell(p,tx-4,ty,8,7); ell(p,tx+3,ty,6,5)
    spikes(p,[(tx-8,ty-5,3),(tx-2,ty-6,3)],'b')
    for x,y in [(tx+3,ty-2),(tx+7,ty-2),(tx+2,ty+1),(tx+6,ty+1)]: eye(p,x,y,n)
    op=JAW[n]//2
    for yy in (ty+3,ty+6):
        poly(p,[(tx+6,yy),(tx+10,yy+op),(tx+11,yy+3+op),(tx+8,yy+2+op)],'h')

# SCORPION: eight legs, curved five-segment tail, two pincers.
def scorpion(p,n):
    if n==8:
        ell(p,27,54,15,5)
        for i in range(4): line(p,[(16+i*6,55),(13+i*6,49),(17+i*6,47)],'s',2)
        curve(p,[(12,54),(6,48),(8,43),(13,47)],3)
        claw(p,44,55,1,n); line(p,[(34,54),(44,55)],'s',3); return
    bx=27+SWAY[n]//2; by=45+BOB[n]
    for far in (True,False):
        for i in range(4):
            x=bx-8+i*5+(2 if far else 0); sh=[-12,-8,8,13][i]+(2 if far else 0)
            stroke(p,[(x,by),(x+sh,by+5),(x+sh-2,59-(far))],2,far=far)
        if far: stroke(p,[(bx+6,by-1),(bx+14,by-6),(bx+20,by-6)],3,far=True); claw(p,bx+20,by-6,2,n,True)
    # Tail articulates at each segment instead of a fixed overlaid curve.
    tail=[(bx-12,by),(bx-17,by-8),(bx-17+SWAY[n],by-18),(bx-10+SWAY[n],by-24),(bx+1+SWAY[n],by-23),(bx+7+SWAY[n],by-15)]
    if n==5: tail=[(bx-12,by),(bx-14,by-10),(bx-8,by-22),(bx+5,by-24),(bx+17,by-20),(bx+24,by-12)]
    stroke(p,tail,4)
    for i,(x,y) in enumerate(tail[:-1]): ell(p,x,y,3.2,3.2); line(p,[(x-1,y-2),(x+1,y-1)],'h')
    x,y=tail[-1]; poly(p,[(x-2,y-3),(x+3,y-2),(x+4,y+3),(x+1,y+7),(x,y+1)],'a')
    ell(p,bx,by,13,7); ell(p,bx+10,by,6,5)
    for x in range(bx-9,bx+6,4): line(p,[(x,by-5),(x+1,by+4)],'s')
    for x,y in [(bx-6,by-2),(bx+1,by),(bx-2,by+3)]: poly(p,[(x,y),(x+2,y-1),(x+3,y+1),(x+1,y+2)],'a',None)
    eye(p,bx+12,by-2,n)
    cx=bx+20+(n==5)*3; cy=by+3-(n==3)*7
    stroke(p,[(bx+9,by+3),(bx+13,cy+4),(cx-5,cy)],4); claw(p,cx,cy,[1,2,0,4,1,0,2,3,0][n],n)

# ELONGATED ARTHROPOD: 11 linked plates, 22 jointed orange legs, two antennae.
def centipede(p,n,fire=False):
    if n==8:
        for i in range(11):
            x=8+i*4; y=56+(i%3==0)
            ell(p,x,y,4,3)
            line(p,[(x,y),(x-2,y-5),(x+1,y-7)],'a')
        ell(p,53,56,5,4); eye(p,55,55,n); return
    # near circle turns toward the right at the head; fire uses open C and long flat plates.
    coords=[]
    for i in range(11):
        t=(145+i*25 if fire else 120+i*27)*math.pi/180
        x=28+18*math.cos(t); y=37+15*math.sin(t)
        if n==4: x+=2*math.sin(i*1.4); y+=math.cos(i*1.3)*2
        if n==5: x+=i*.25; y-=i*.45
        if n==3: x-=i*.3; y+=i*.1
        if n==6: x+=math.sin(i*.8)*2; y+=math.cos(i*.8)*2
        y+=BOB[n]*(i/11); coords.append((x,y))
    stroke(p,coords,4,'a')
    for i,(x,y) in enumerate(coords):
        for side in (-1,1):
            ang=(145+i*25 if fire else 120+i*27)*math.pi/180
            dx,dy=math.cos(ang)*side,math.sin(ang)*side
            kn=(x+dx*5,y+dy*5+1); ft=(x+dx*7+(i%2*2-1)*(n==4),y+dy*7+3)
            stroke(p,[(x,y),kn,ft],1,'a')
        ell(p,x,y,4.5,3.7,i*25)
        line(p,[(x-2,y-2),(x,y-2)],'l')
        if fire and i%2==0: spikes(p,[(x,y-2,3)],'a')
    x,y=coords[-1]; ell(p,x+3,y-1,5,5); eye(p,x+5,y-3,n)
    op=JAW[n]//2
    for dy in (-3,3):
        stroke(p,[(x+6,y+dy),(x+10,y+dy+op*(1 if dy>0 else -1)),(x+12,y+dy)],2,'a')
    for dy in (-4,0): curve(p,[(x+3,y+dy),(x+6,y+dy-7),(x+10+SWAY[n],y+dy-6)],1,'a')

# THREE INSECT TAGMATA: antennae, six legs, elbowed mandibles/horns.
def insect(p,n,beetle=False):
    if n==8:
        ell(p,22,55,13,5); ell(p,39,56,7,4); ell(p,49,56,5,4)
        for i in range(3): stroke(p,[(30+i*6,55),(27+i*6,48),(31+i*6,47)],2)
        if beetle: poly(p,[(49,54),(54,49),(57,50),(54,56)],'b')
        return
    y=42+BOB[n]; tx=37+SWAY[n]//2
    for far in (True,False):
        for i in range(3):
            x=tx-5+i*5+(2 if far else 0); dx=[-14,-3,12][i]+(3 if far else 0)
            ft=(x+dx+(n==4)*(i%2*5-2),G-(1 if far else 0))
            kn=(x+dx,y+5+(i%2)*2)
            if n==5 and i==2: ft=(x+14,y+9); kn=(x+10,y+3)
            stroke(p,[(x,y),kn,ft],2,far=far)
        if far:
            ell(p,21,y-2,14 if beetle else 11,10 if beetle else 8,-10)
            if beetle:
                line(p,[(20,y-11),(24,y-3),(24,y+5)],'s'); line(p,[(13,y-7),(17,y-8),(19,y-7)],'k')
                poly(p,[(9,y-2),(16,y-6),(17,y+3),(11,y+4)],'a',None)
            else:
                line(p,[(16,y-8),(17,y+2)],'s'); line(p,[(23,y-9),(26,y+2)],'s')
                spikes(p,[(15,y-7,2),(23,y-8,3)],'b')
    ell(p,tx-3,y,7,6); ell(p,tx+7,y-2,7,7)
    eye(p,tx+10,y-4,n)
    if beetle:
        poly(p,[(tx+7,y-8),(tx+12,y-18+SWAY[n]),(tx+19,y-18+SWAY[n]),(tx+16,y-14+SWAY[n]),(tx+12,y-13),(tx+11,y-7)],'b')
        line(p,[(tx+10,y-10),(tx+13,y-16+SWAY[n]),(tx+16,y-17+SWAY[n])],'l')
        poly(p,[(tx-6,y-4),(tx-3,y-15),(tx+2,y-16),(tx,y-10),(tx-1,y-4)],'a')
    else:
        for dy in (-4,1): curve(p,[(tx+5,y+dy),(tx+9,y-11+dy),(tx+15+SWAY[n]//2,y-12+dy)],1)
        spikes(p,[(tx-4,y-5,3),(tx+3,y-8,2)],'b')
        op=JAW[n]
        poly(p,[(tx+11,y),(tx+17,y-4-op),(tx+19,y-3-op),(tx+17,y+1),(tx+13,y+3)],'h')
        poly(p,[(tx+11,y+3),(tx+16,y+5+op),(tx+19,y+4+op),(tx+17,y+2),(tx+13,y+1)],'b')

# MANTIS: long prothorax, triangular head, FOUR walking legs + TWO raptorial legs.
def mantis(p,n):
    if n==8:
        ell(p,22,55,14,4)
        stroke(p,[(33,54),(40,55),(45,54)],3)
        poly(p,[(45,53),(53,54),(48,58)],'b')
        for i in range(2): stroke(p,[(26+i*7,55),(21+i*8,49),(23+i*8,46)],2)
        stroke(p,[(40,54),(45,49),(52,50)],3); return
    bx=25+SWAY[n]//2; by=46+BOB[n]
    hx=38+SWAY[n]; hy=24+BOB[n]
    for far in (True,False):
        for i in range(2):
            hip=(bx+i*7,by); kn=(bx-9+i*20+(3 if far else 0),by+3); ft=(bx-13+i*27+(3 if far else 0)+(n==4)*(-3 if i==0 else 3),59-far)
            stroke(p,[hip,kn,ft],2,far=far)
        if far:
            ell(p,bx-8,by-2,14,5,-18); line(p,[(bx-19,by-4),(bx-7,by-7),(bx+1,by-3)],'a')
            for i in range(5): line(p,[(bx-16+i*4,by-3),(bx-15+i*4,by)],'s')
    stroke(p,[(bx+2,by-3),(hx-4,hy+5)],5)
    line(p,[(bx+2,by-6),(hx-6,hy+5)],'a')
    poly(p,[(hx-7,hy-4),(hx+7,hy-4),(hx+2,hy+6),(hx-3,hy+5)],'b')
    poly(p,[(hx-5,hy-3),(hx+5,hy-3),(hx+1,hy)],'l',None)
    eye(p,hx-4,hy-2,n,True); eye(p,hx+5,hy-2,n,True)
    for dx in (-3,3): line(p,[(hx+dx,hy-4),(hx+dx-2,hy-11),(hx+dx+2+SWAY[n]//2,hy-14)],'a')
    for far in (True,False):
        sx=hx-3+far*3; sy=hy+9+far*2
        el,tip=((sx+8,sy+1),(sx+4,sy+14))
        if n==3: el,tip=((sx-6,sy-6),(sx+3,sy-15))
        if n==5: el,tip=((sx+8,sy+1),(60-far*2,sy+10-far*8))
        if n==6: el,tip=((sx+9,sy-2),(sx+10,sy+9))
        if n==7: el,tip=((sx-6,sy+2),(sx-8,sy+11))
        if n in (1,2): el=(el[0],el[1]+n); tip=(tip[0]+n-1,tip[1])
        stroke(p,[(sx,sy),el],3,far=far)
        dx,dy=tip[0]-el[0],tip[1]-el[1]; ll=math.hypot(dx,dy); nx,ny=-dy/ll,dx/ll
        poly(p,[el,(el[0]+nx*4,el[1]+ny*4),(el[0]+dx*.6+nx*3,el[1]+dy*.6+ny*3),tip,(el[0]+dx*.6-nx,el[1]+dy*.6-ny)],'s' if far else 'b')
        line(p,[el,tip],'h' if not far else 'a')
        for f in (.25,.5,.75):
            x,y=el[0]+dx*f,el[1]+dy*f
            poly(p,[(x,y),(x-nx*3-dx/ll,y-ny*3-dy/ll),(x+dx/ll,y+dy/ll)],'s')

# Quadruped geometry table: muzzle length, torso, legs, head, stance and tail.
BEASTS={
'wolf-01':('wolf',13,7,13,6,'ruff','bush'),
'wolf-dire':('dire',15,8,11,7,'ruff','low'),
'horse-01':('horse',14,8,21,8,'horse','mane'),
'unicorn-01':('unicorn',13,7,22,8,'unicorn','flow'),
'cat-01':('cat',10,7,12,5,'cat','up'),
'cat-shadow':('shadow',12,6,14,5,'cat','curl'),
'tiger-saber':('tiger',15,10,14,7,'tiger','long'),
'rat-giant':('rat',11,8,8,5,'rat','bare'),
'goat-mountain':('goat',12,8,17,6,'goat','stub'),
'deer-forest':('deer',12,7,23,6,'deer','stub'),
}

def beast(p,n,slug):
    _,rx,ry,legs,hr,kind,tail=BEASTS[slug]
    y=G-legs-ry+BOB[n]; x=27+SWAY[n]//2
    if n==8:
        # Side fall preserves species tail, torso and face; limbs fold above the body.
        ell(p,27,55,rx+3,4)
        ell(p,46,55,hr,4)
        for a,b in [(18,25),(31,36)]: stroke(p,[(a,55),(a+2,50),(b,51)],3)
        if kind in ('horse','unicorn','deer','goat'): poly(p,[(44,54),(47,48),(50,53)],'b')
        if kind in ('cat','tiger'): poly(p,[(43,53),(44,49),(47,53)],'b')
        curve(p,[(15,54),(7,51),(5,55),(9,57)],2 if tail=='bare' else 3)
        if kind=='unicorn': poly(p,[(48,53),(58,48),(51,55)],'h')
        if kind=='goat': curve(p,[(44,53),(42,47),(47,45),(49,48)],3,'a')
        if kind=='deer':
            line(p,[(44,54),(40,49),(41,43)],'a',2); line(p,[(41,47),(36,46),(34,42)],'a')
            line(p,[(46,53),(47,48),(52,45)],'a',2)
        if kind=='tiger': mouth(p,49,54,0,5,True)
        eye(p,48,54,7); return
    # Horses and deer carry the head higher on a long inclined neck.
    tall=kind in ('horse','unicorn','deer','goat')
    hx=x+14+SWAY[n]//3; hy=y-(13 if tall else 3)+BOB[n]//2
    if n==3: hy+=3; hx-=3
    if n==5: hx+=2; hy+=4
    if n==7: hx-=4; hy-=1
    if kind=='horse': hy=max(23,hy)
    if kind=='unicorn': hy=max(29,hy)
    if kind=='deer': hy=max(29,hy)
    # Tail is species anatomy, never a disconnected effect.
    tx=x-rx+3; ty=y
    if tail in ('bush','low'):
        poly(p,[(tx+2,ty-2),(tx-6,ty-3),(tx-12,ty+3+(n==2)*3),(tx-9,ty+9),(tx-5,ty+7),(tx+3,ty+4)],'b')
        line(p,[(tx-8,ty+3),(tx-4,ty+3),(tx,ty+1)],'l')
    elif tail in ('up','curl'):
        curve(p,[(tx,ty+2),(tx-7,ty-7),(tx-9+SWAY[n],ty-17),(tx-3,ty-18+BOB[n])],3)
    elif tail in ('flow','mane'):
        poly(p,[(tx,ty-4),(tx-5,ty-2),(tx-8,ty+10),(tx-4,ty+15+SWAY[n]//2),(tx-1,ty+9),(tx+2,ty)],'a')
        line(p,[(tx-3,ty),(tx-5,ty+10)],'h' if kind=='unicorn' else 's')
    elif tail in ('bare','long'):
        curve(p,[(tx,ty+3),(tx-9,ty+9),(tx-11,ty+4+SWAY[n]),(tx-9,ty-4)],2 if tail=='bare' else 3,'q' if tail=='bare' else 'b')
    else: poly(p,[(tx,ty-1),(tx-6,ty-3),(tx-4,ty+4),(tx+1,ty+4)],'b')
    # Four legs drawn with individual hip, knee, ankle; far pair uses shadow color.
    for far in (True,False):
        for front in (False,True):
            hip=(x+(rx-4 if front else -rx+5)+(2 if far else 0),y+ry-2)
            footx=hip[0]+(1 if front else -4)
            knee=(hip[0]+(0 if front else 3),hip[1]+legs*.55)
            end=(footx,G-(1 if far else 0))
            if n==4:
                step=(6 if front else -7)*(1 if not far else -1)
                knee=(knee[0]+step*.5,knee[1]-2); end=(footx+step,G-(2 if far else 0))
            if n==5:
                knee=(hip[0]+(7 if front else -5),hip[1]+4)
                end=(min(59,hip[0]+(13 if front else -11)),G-(5 if front else 0))
            if n==3 and front: knee=(hip[0]-3,knee[1]+2); end=(footx-4,G-far)
            if tall and front and n in (0,1,2,6):
                knee=(hip[0]+5,hip[1]+4+n%3); end=(hip[0]+9,hip[1]+8+n%3)
            if kind=='rat' and front and n in (0,1,2,3): end=(hip[0]+6,hip[1]+2+n%3); knee=(hip[0]+2,hip[1]+3)
            stroke(p,[hip,knee,end],3 if tall else 4,far=far)
            poly(p,[(end[0]-1,end[1]-2),(end[0]+3,end[1]-1),(end[0]+4,end[1]),(end[0]-2,end[1])],'o' if tall else 's')
            if kind in ('cat','tiger') and front and not far:
                ell(p,knee[0],knee[1],3,2)
                p.box((round(knee[0]-3),round(knee[1]-1),round(knee[0]+3),round(knee[1]+1)),'q')
                if kind=='cat': spikes(p,[(knee[0]+1,knee[1]-1,3)],'n')
        if far:
            # Distinct back line and chest, not a universal oval body.
            poly(p,[(x-rx,y-1),(x-rx+4,y-ry),(x+rx-5,y-ry+1),(x+rx,y-ry-2),(x+rx+3,y+3),(x+rx-1,y+ry),(x-3,y+ry+1),(x-rx+1,y+ry-3)],'b')
            poly(p,[(x-rx+3,y-2),(x-rx+5,y-ry+2),(x+rx-3,y-ry+2),(x+rx,y-1),(x+2,y+1),(x-rx+4,y+2)],'l',None)
            line(p,[(x-rx+5,y+ry-2),(x+1,y+ry),(x+rx-2,y+ry-2)],'s',2)
            if kind in ('cat','tiger'):
                for dx in (-8,-2,5): poly(p,[(x+dx,y-ry+1),(x+dx+3,y-ry+2),(x+dx+1,y+1),(x+dx-1,y+3)],'a',None)
            if kind=='horse':
                poly(p,[(x-6,y-ry),(x+8,y-ry),(x+10,y-2),(x-4,y+2)],'q')
                poly(p,[(x-4,y-ry-2),(x+6,y-ry-2),(x+7,y-ry+2),(x-3,y-ry+3)],'n')
                line(p,[(x-1,y-ry+1),(x,y+ry)],'q',2)
                line(p,[(x+1,y+6),(x+6,y+6)],'k')
    if tall:
        poly(p,[(x+rx-7,y+3),(x+rx-5,y-5),(hx-6,hy-3),(hx+1,hy+1),(hx+1,hy+10),(x+rx+2,y+6)],'b')
        poly(p,[(x+rx-5,y-3),(hx-5,hy-2),(hx-3,hy+6),(x+rx-2,y+2)],'l',None)
        if kind in ('horse','unicorn'):
            poly(p,[(hx-6,hy-6),(hx-10,hy-1),(hx-9,hy+7),(x+rx-5,y-3),(x+rx-2,y-8)],'a')
            for i in range(4): line(p,[(hx-7-i,hy+i*3),(hx-5-i,hy+i*3+1)],'h' if kind=='unicorn' else 's')
        if kind=='horse':
            poly(p,[(hx-5,hy+2),(hx-1,hy+4),(x+rx+1,y+3),(x+rx-3,y+5),(hx-7,hy+7)],'n')
            line(p,[(hx-4,hy+5),(hx-2,hy+6),(x+rx-1,y+3)],'k')
            line(p,[(hx-5,hy+7),(hx-1,hy+9)],'m')
    elif kind=='ruff':
        poly(p,[(hx-6,hy-6),(hx-3,hy-8),(hx-1,hy-4),(hx+1,hy-6),(hx+3,hy+6),(hx-2,hy+10),(hx-4,hy+7),(hx-8,hy+8)],'h')
    # Heads use different angular cheek and muzzle profiles.
    mu=10 if kind=='ruff' else 8 if tall else 5 if kind=='rat' else 5
    mx=min(61,hx+mu)
    poly(p,[(hx-hr,hy-3),(hx-hr+2,hy-hr),(hx+2,hy-hr),(hx+5,hy-3),(mx,hy),(mx,hy+4),(hx+3,hy+7),(hx-4,hy+6)],'b')
    poly(p,[(hx-hr+2,hy-3),(hx-hr+3,hy-hr+2),(hx+1,hy-hr+2),(hx+4,hy),(mx-1,hy+1),(hx+3,hy+3),(hx-3,hy+1)],'l',None)
    if kind=='rat':
        ell(p,hx-5,hy-7,4,5); ell(p,hx-5,hy-7,2,3); line(p,[(hx-6,hy-8),(hx-4,hy-6)],'q',2)
    else:
        for ex in (hx-hr+2,hx):
            poly(p,[(ex-2,hy-hr+2),(ex-2,hy-hr-6),(ex+2,hy-hr-2),(ex+3,hy-hr+3)],'b')
            line(p,[(ex-1,hy-hr-2),(ex+1,hy-hr+1)],'s')
    eye(p,hx+3,hy-2,n)
    p.box((mx-1,hy+1,mx,hy+2),'o')
    mouth(p,hx+4,hy+4,n,max(3,mx-hx-3),kind=='tiger')
    if kind in ('cat','tiger'):
        for dy in (1,4): line(p,[(hx+1,hy+dy),(hx-5,hy+dy-1)],'h')
        if kind=='cat':
            stroke(p,[(hx-4,hy+5),(hx-1,hy+8),(hx+3,hy+7)],3,'q'); spikes(p,[(hx-2,hy+6,3)],'n')
        else:
            poly(p,[(x+rx-2,y-ry),(x+rx+5,y-ry+1),(x+rx+5,y+6),(x+rx-1,y+8),(x+rx-4,y+1)],'n')
            line(p,[(x+rx-2,y-ry+2),(x+rx+2,y-ry+3),(x+rx+3,y+1)],'k')
            line(p,[(x+rx,y),(x+rx+2,y-2)],'m')
    if kind=='horse':
        poly(p,[(hx-3,hy-hr),(hx+3,hy-hr),(hx+5,hy-2),(mx,hy),(mx,hy+2),(hx+2,hy+1)],'n')
        eye(p,hx+3,hy-2,n); line(p,[(hx,hy-hr+1),(hx+3,hy-5)],'k')
    if kind=='unicorn':
        poly(p,[(hx+1,hy-hr+1),(hx+8,hy-hr-15),(hx+5,hy-hr+2)],'h')
        for i in range(3): line(p,[(hx+3+i,hy-hr-i*3),(hx+5+i,hy-hr-i*3)],'n')
    if kind=='goat':
        for dx in (-4,1):
            curve(p,[(hx+dx,hy-hr),(hx-6+dx,hy-hr-9),(hx-13+dx,hy-hr-5),(hx-8+dx,hy-hr+2)],4,'a')
        poly(p,[(hx,hy+7),(hx+5,hy+6),(hx+2,hy+14),(hx-1,hy+10)],'s')
    if kind=='deer':
        for dx,dy in [(-2,0),(-7,2)]:
            stalk=[(hx+dx,hy-hr+1),(hx-4+dx,hy-hr-7+dy),(hx-8+dx,hy-hr-15+dy)]
            stroke(p,stalk,2,'h')
            for i in range(2):
                x1=hx-3+dx-i*4; y1=hy-hr-6+dy-i*7
                line(p,[(x1,y1),(x1+5,y1-3),(x1+6,y1-7)],'h',2)
                line(p,[(x1,y1-1),(x1-5,y1-2),(x1-6,y1-6)],'a',2)
            line(p,[(hx-7+dx,hy-hr-13+dy),(hx-5+dx,hy-hr-13+dy)],'e')
        line(p,[(hx-2,hy-5),(hx,hy-2),(hx+1,hy-5)],'e')

# FLEXIBLE ORGANISMS. Every sample centre changes with pose: coils flex, not slide.
def serpent(p,n,eel=False):
    if n==8:
        curve(p,[(7,56),(14,52),(27,59),(39,53),(52,57)],6)
        ell(p,52,56,7,4); eye(p,54,55,7); return
    if eel:
        points=[(11,48,2),(9+SWAY[n],34,3),(19,19+BOB[n],4),(34,19-BOB[n],4),(39,33,5),(25,43,5),(37+SWAY[n],49,5),(48+SWAY[n]//2,37+BOB[n],6)]
        if n==5: points[-2:]=[(37,42,5),(50,33,6)]
        seg=bez(points,80)
        tube(p,seg,'b','o','s','l')
        # Zigzag bands occupy the body, with separate short lightning forks.
        for i in range(5,75,8):
            x,y,r=seg[i]; line(p,[(x-2,y-r+1),(x+1,y-1),(x-2,y+2),(x+2,y+r-1)],'a',2)
        hx,hy=points[-1][:2]; ell(p,hx,hy,7,6,-20)
        poly(p,[(hx+4,hy-4),(hx+10,hy-2),(hx+10,hy+3),(hx+4,hy+5)],'b')
        eye(p,hx+4,hy-3,n); mouth(p,hx+4,hy+2,n,6)
        for x,y in [(12,17),(47,18),(7,43)]:
            shift=(n%3)-1
            line(p,[(x+shift,y),(x+3+shift,y+4),(x+1+shift,y+5),(x+5+shift,y+10)],'a',2)
        return
    # Coil encloses actual negative space; flattened coils visibly differ from hood.
    curve(p,[(9,54),(18,44+BOB[n]),(37,49),(37,56),(16,57),(12,52)],6)
    curve(p,[(23,54),(28,44),(32+SWAY[n],35+BOB[n]),(36+SWAY[n],22+BOB[n])],7)
    hx=38+SWAY[n]; hy=22+BOB[n]
    if n==5: hx=48; hy=26
    if n==3: hx=31; hy=22
    poly(p,[(hx-4,hy-3),(hx-12,hy+2),(hx-11,hy+14),(hx-5,hy+21),(hx+4,hy+15),(hx+7,hy+4)],'b')
    poly(p,[(hx-9,hy+3),(hx-5,hy+1),(hx-3,hy+15),(hx-6,hy+17)],'a',None)
    poly(p,[(hx-3,hy+2),(hx+3,hy+3),(hx+1,hy+14),(hx-2,hy+18)],'l',None)
    line(p,[(hx-5,hy+7),(hx-2,hy+7),(hx+2,hy+6)],'s'); line(p,[(hx-5,hy+11),(hx-2,hy+11),(hx+2,hy+10)],'s')
    ell(p,hx,hy,7,5,-10)
    poly(p,[(hx+1,hy-4),(hx+9,hy-2),(hx+10,hy+2),(hx+4,hy+6),(hx-1,hy+3)],'b')
    line(p,[(hx+1,hy-3),(hx+7,hy-2)],'l')
    eye(p,hx+4,hy-2,n)
    mouth(p,hx+3,hy+3,n,7)
    if n in (0,2,5): line(p,[(hx+7,hy+4+JAW[n]),(hx+12,hy+5+JAW[n]),(hx+13,hy+4+JAW[n])],'r')
    scale_marks(p,14,48,2)

def worm(p,n,sand=False):
    if n==8:
        for i in range(7): ell(p,10+i*6,55,5,4)
        ell(p,53,55,6,4); eye(p,54,54,7)
        curve(p,[(53,55),(58,51),(59,48)],1,'a'); return
    centres=[]
    for i in range(8):
        t=math.radians(135+i*29)
        x=27+18*math.cos(t); y=39+13*math.sin(t)
        y+=BOB[n]*math.sin(i*.8); x+=SWAY[n]*i/10
        centres.append((x,y))
    # rear narrows toward the hooked tail; plate overlaps show segmented tube.
    for i,(x,y) in enumerate(centres):
        ell(p,x,y,4+i*.5,4.2+i*.3,-20+i*27)
        line(p,[(x-2,y-3),(x+1,y-3)],'l')
        if sand:
            spikes(p,[(x-1,y-3,3+i%2)],'a')
            line(p,[(x+2,y),(x+3,y+2)],'s')
        else: line(p,[(x-3,y+1),(x-1,y+3),(x+3,y+3)],'a',2)
    hx,hy=centres[-1]; hx+=3
    ell(p,hx,hy,8,8)
    # Right-facing open rim with a circular void and radial teeth.
    poly(p,[(hx+1,hy-7),(hx+7,hy-5-JAW[n]/3),(hx+10,hy),(hx+7,hy+6+JAW[n]/3),(hx+1,hy+7)],'o')
    line(p,[(hx+1,hy-6),(hx+5,hy-5),(hx+7,hy-2)],'h',2)
    line(p,[(hx+2,hy+5),(hx+6,hy+4)],'a',2)
    for dy in (-4,0,4): poly(p,[(hx+4,hy+dy-1),(hx+8,hy+dy),(hx+4,hy+dy+1)],'w',None)
    for i in range(4 if sand else 6):
        ang=(-75+i*30)*math.pi/180
        sx=hx+6; sy=hy+math.sin(ang)*6
        mx=min(58,sx+5+SWAY[n]*.4); my=sy+math.sin(ang)*6
        ex=min(59,mx+3); ey=my+math.sin(ang)*4+BOB[n]*(i%2*2-1)
        curve(p,[(sx,sy),(mx,my),(ex,ey)],1 if sand else 2,'a')

# FLYERS: side profile with two asymmetric wings; fore-edge rays articulate.
def flyer(p,n,kind):
    if n==8:
        ell(p,34,55,12,5)
        poly(p,[(31,54),(13,51),(6,56),(18,59),(32,58)],'a')
        poly(p,[(33,55),(49,51),(58,54),(49,59)],'s')
        ell(p,46,54,5,4); eye(p,48,53,7)
        if kind=='hawk': poly(p,[(50,54),(58,55),(54,58)],'a')
        return
    cy=32+BOB[n]; cx=34+SWAY[n]//2
    flap=[0,5,-5,-10,10,-2,3,9,0][n]
    if kind=='moth':
        # four lobes, softly scalloped tips but hard pixel edges.
        for far in (True,False):
            sx=cx+(3 if far else -2); sign=1 if far else -1
            pts=[(sx,cy),(sx+sign*10,cy-18+flap),(sx+sign*20,cy-15+flap),(sx+sign*21,cy-5+flap),(sx+sign*19,cy+3),(sx+sign*21,cy+11-flap//2),(sx+sign*18,cy+18-flap//2),(sx+sign*6,cy+12),(sx,cy+4)]
            poly(p,pts,'s' if far else 'b')
            for dx,dy,rr in [(14,-7,5),(14,9,4)]:
                x=sx+sign*dx; y=cy+dy+(flap if dy<0 else -flap//2)
                line(p,[(x-sign*rr,y),(x-sign*rr,y-3),(x,y-rr),(x+sign*rr,y-1),(x+sign*(rr-1),y+3),(x,y+3),(x-sign*2,y),(x+sign*2,y)],'a',2)
            line(p,[(sx,cy),(sx+sign*18,cy-9+flap)],'l')
        ell(p,cx,cy+3,4,12,-15)
        for i in range(6): line(p,[(cx-3,cy-5+i*3),(cx+2,cy-4+i*3)],'s')
        ell(p,cx+6,cy-7,6,6)
        eye(p,cx+8,cy-8,n,True)
        for dx in (2,6):
            curve(p,[(cx+dx,cy-12),(cx+dx+3,cy-22),(cx+dx+8,cy-24+BOB[n])],1,'h')
            for i in range(3): line(p,[(cx+dx+3,cy-18-i*2),(cx+dx+7,cy-19-i*2)],'h')
        for i in range(3): line(p,[(cx+3,cy+i*4),(cx+9,cy+2+i*4),(cx+11,cy+7+i*3)],'s')
        return
    # far wing points to rear-up; near wing reaches rear-left with splayed fingers/feathers.
    far=[(cx+2,cy),(cx+10,cy-15+flap),(cx+22,cy-17+flap),(cx+20,cy-10+flap),(cx+15,cy-2),(cx+9,cy+6)]
    if kind=='hawk':
        far=[(cx+2,cy),(cx+10,cy-15+flap),(cx+21,cy-18+flap),(cx+20,cy-13+flap),(cx+23,cy-14+flap),(cx+19,cy-8+flap),(cx+21,cy-8+flap),(cx+16,cy-2),(cx+17,cy+1),(cx+9,cy+6)]
    poly(p,far,'s')
    if kind=='hawk':
        for i in range(3): line(p,[(cx+5,cy),(cx+19-i*2,cy-13+flap+i*4)],'b')
    near=[(cx-1,cy),(cx-9,cy-13-flap//2),(cx-24,cy-12-flap//2),(cx-27,cy-4-flap//2),(cx-20,cy-1),(cx-18,cy+5),(cx-12,cy+3),(cx-8,cy+9),(cx-3,cy+5)]
    poly(p,near,'a' if kind=='bat' else 'b')
    if kind=='bat':
        for tip in [(cx-24,cy-12-flap//2),(cx-20,cy-1),(cx-18,cy+5),(cx-8,cy+9)]:
            line(p,[(cx,cy),(cx-9,cy-11-flap//2),tip],'b',2)
            line(p,[(cx-9,cy-11-flap//2),tip],'l')
        line(p,[(cx+2,cy),(cx+10,cy-14+flap),(cx+21,cy-16+flap)],'b',2)
        ell(p,cx,cy+4,6,10,-10)
        poly(p,[(cx-4,cy-4),(cx-5,cy-13),(cx-1,cy-9),(cx+2,cy-4)],'b')
        poly(p,[(cx+4,cy-5),(cx+5,cy-14),(cx+8,cy-9),(cx+8,cy-3)],'b')
        ell(p,cx+7,cy-2,6,5); eye(p,cx+10,cy-4,n)
        mouth(p,cx+8,cy+1,n,6)
        for x in (cx-2,cx+3): stroke(p,[(x,cy+10),(x+2,cy+17),(x+5,cy+16)],1,'h')
    else:
        for i in range(5):
            x=cx-23+i*3; y=cy-9-flap//2+i*2
            line(p,[(cx-2,cy),(x,y)],'s',2); line(p,[(x,y),(x+1,y-3)],'h')
        ell(p,cx+1,cy+2,8,10,-30)
        poly(p,[(cx-4,cy+6),(cx-10,cy+14),(cx-16,cy+12),(cx-9,cy+7)],'b')
        for i in range(3): line(p,[(cx-11+i*2,cy+12),(cx-5+i*2,cy+7)],'s')
        poly(p,[(cx+3,cy-1),(cx+8,cy-6),(cx+10,cy),(cx+7,cy+10),(cx+2,cy+6)],'h',None)
        ell(p,cx+10,cy-5,6,5); eye(p,cx+13,cy-7,n)
        poly(p,[(cx+13,cy-4),(cx+20,cy-3),(cx+18,cy+1),(cx+15,cy-1)],'a')
        for dx in (0,7):
            stroke(p,[(cx+dx,cy+10),(cx+dx+2,cy+18),(cx+dx+6,cy+19)],2,'a')
            for i in range(2): line(p,[(cx+dx+2,cy+18),(cx+dx+4+i*3,cy+22-(n==5)*4)],'a')

# COCKATRICE: bird legs/comb, reptile body and long scaled recurved tail.
def cockatrice(p,n):
    if n==8:
        curve(p,[(27,55),(13,50),(6,56),(11,58)],4)
        ell(p,33,55,12,4); ell(p,49,54,5,4)
        spikes(p,[(47,51,3),(51,51,4)],'a'); poly(p,[(51,54),(58,55),(53,57)],'h')
        stroke(p,[(36,56),(35,51),(40,51)],2,'a'); return
    y=39+BOB[n]; x=31+SWAY[n]//2
    curve(p,[(x-7,y+6),(x-18,y+4),(x-25,y-5),(x-23,y-16),(x-14,y-16+SWAY[n])],4)
    for i in range(4): poly(p,[(x-22+i*3,y-6-i*2),(x-25+i*3,y-8-i*2),(x-21+i*3,y-9-i*2)],'a')
    for far in (True,False):
        xx=x+4*far-4
        knee=(xx+3+SWAY[n]//3,y+13); foot=(xx+1,G-far)
        if far and n in (0,1,2): knee=(xx+5,y+10); foot=(xx+10,y+9+n)
        if n==4: foot=(xx+8*(1 if far else -1),G-far)
        stroke(p,[(xx,y+6),knee,foot],3,'a',far)
        for i in range(3): line(p,[foot,(foot[0]+3+i*2,foot[1]-i%2)],'h')
        if far: ell(p,x,y,12,10,-15)
    poly(p,[(x-8,y-5),(x+3,y-7),(x+8,y),(x+4,y+5),(x-4,y+3)],'s')
    for i in range(3): line(p,[(x-6+i*4,y-3),(x-2+i*4,y+2)],'l')
    scale_marks(p,x-8,y+3,2)
    hx=x+14+SWAY[n]//3; hy=y-13
    stroke(p,[(x+7,y),(hx-5,hy+2)],6)
    ell(p,hx,hy,6,6); eye(p,hx+3,hy-2,n)
    spikes(p,[(hx-4,hy-5,4),(hx,hy-5,6),(hx+4,hy-4,4)],'a')
    poly(p,[(hx-1,hy+4),(hx+3,hy+4),(hx+3,hy+10),(hx,hy+12),(hx-2,hy+8)],'a')
    op=JAW[n]//2
    poly(p,[(hx+4,hy),(hx+12,hy+1),(hx+8,hy+3),(hx+5,hy+3)],'h')
    poly(p,[(hx+5,hy+3+op),(hx+11,hy+2+op),(hx+7,hy+5+op)],'h')

# AQUATIC: fishes articulate fork tail, fins and jaw; shark adds four scaled legs.
def fish(p,n,kind):
    if n==8:
        ell(p,31,55,17,4)
        poly(p,[(16,54),(7,51),(9,59),(17,57)],'a')
        poly(p,[(31,54),(35,49),(40,55)],'b')
        ell(p,49,55,6,4); eye(p,50,54,7); return
    y=35+BOB[n]; x=31+SWAY[n]//2
    shark=kind=='shark'
    # Four jointed scaled terrestrial legs are visible below the shark belly.
    if shark:
        y=40+BOB[n]
        for far in (True,False):
            for dx in (-9,11):
                end=(x+dx+(-3 if dx<0 else 3)+(n==4)*(4 if far else -4),G-far)
                stroke(p,[(x+dx,y+5),(x+dx+2,y+12),end],4,far=far)
                for j in range(3): line(p,[(end[0]-1+j*2,end[1]-1),(end[0]+j*2,end[1])],'h')
                line(p,[(x+dx,y+9),(x+dx+2,y+10)],'s')
    tx=x-16; ty=y+SWAY[n]//3
    poly(p,[(tx+3,y-2),(tx-8,ty-12-BOB[n]),(tx-5,ty-2),(tx-9,ty+10+BOB[n]),(tx+3,y+3)],'b' if shark else 'a')
    line(p,[(tx-5,ty-7),(tx+1,y)],'l'); line(p,[(tx-5,ty+7),(tx+1,y+1)],'s')
    poly(p,[(x-8,y-7),(x-2,y-20),(x+5,y-8)],'b')
    line(p,[(x-6,y-8),(x-2,y-16),(x+1,y-10)],'l')
    ell(p,x,y,19,10,-2)
    poly(p,[(x-12,y+4),(x+3,y+4),(x+15,y+1),(x+17,y+4),(x+11,y+8),(x-6,y+8)],'a' if not shark else 'h',None)
    if not shark:
        poly(p,[(x+1,y+2),(x-4+SWAY[n],y+13),(x+7,y+7)],'a')
        line(p,[(x+2,y+4),(x+1+SWAY[n],y+9)],'h')
        scale_marks(p,x-12,y-4,3)
    else:
        poly(p,[(x-1,y+1),(x+4,y+13),(x+10,y+6)],'b')
    hx=x+15; hy=y-1
    if kind=='piranha': ell(p,hx-1,hy,10,10); poly(p,[(hx-8,hy-5),(hx+5,hy-5),(hx+8,hy),(hx+4,hy+7),(hx-3,hy+6)],'a')
    eye(p,hx+2,hy-4,n)
    line(p,[(hx-6,hy-3),(hx-8,hy+1),(hx-6,hy+4)],'s')
    if shark:
        for i in range(3): line(p,[(hx-11+i*3,hy-2),(hx-12+i*3,hy+3)],'s')
    mouth(p,hx,hy+3,n,min(9,61-hx))

# CEPHALOPOD: triangular mantle, two fins, ten arms and hook-shaped beak.
def squid(p,n):
    if n==8:
        poly(p,[(8,54),(23,49),(38,52),(40,58),(22,59)],'b')
        for i in range(5): curve(p,[(35,55+i%2),(46,53+i),(54+i,57),(58,55+i%3)],2)
        eye(p,37,54,7); return
    cx=34+SWAY[n]//2; cy=36+BOB[n]
    for i in range(10):
        sx=cx-8+i*2; sy=cy+10
        dx=(i-4.5)*3
        tip=(min(60,max(3,cx+dx*1.7+SWAY[n]*(i%2*2-1))),G-4-i%3)
        joint=(cx+dx,cy+22+math.sin(i+n*.5)*2)
        if n==3: tip=(cx+dx*1.2,cy+15+i%3*3)
        if n==5 and i>5: tip=(58,cy+5+i*2); joint=(cx+16,cy+15)
        curve(p,[(sx,sy),joint,tip,(tip[0]+(2 if i<5 else -2),tip[1]-4)],2 if i<8 else 3,far=i<4)
        if i>=4:
            for j in (.3,.6,.85):
                x=sx+(joint[0]-sx)*j; y=sy+(joint[1]-sy)*j
                line(p,[(x,y),(x+1,y+1)],'a')
    poly(p,[(cx-8,cy-1),(cx-15,cy-7),(cx-12,cy-17),(cx-4,cy-9)],'b')
    poly(p,[(cx+5,cy-3),(cx+11,cy-12),(cx+16,cy-5),(cx+9,cy+1)],'s')
    poly(p,[(cx-10,cy+7),(cx-10,cy-6),(cx-3,cy-25),(cx+1,cy-28),(cx+7,cy-15),(cx+10,cy+4),(cx+5,cy+11),(cx-5,cy+11)],'b')
    poly(p,[(cx-8,cy-5),(cx-2,cy-23),(cx+1,cy-24),(cx+2,cy-13),(cx-2,cy+3),(cx-7,cy+7)],'l',None)
    for x,y in [(cx-3,cy-11),(cx+4,cy-5),(cx-6,cy+3),(cx+2,cy+5)]:
        poly(p,[(x,y-1),(x+2,y-1),(x+3,y+1),(x+1,y+2),(x-1,y+1)],'a',None)
    eye(p,cx+6,cy+2,n,True)
    op=JAW[n]//2
    poly(p,[(cx+8,cy+5),(cx+18,cy+6),(cx+14,cy+11),(cx+11,cy+8)],'h')
    poly(p,[(cx+10,cy+9+op),(cx+16,cy+10+op),(cx+11,cy+13+op)],'a')

# ROCK GORILLA: knuckle arms, barrel chest, squat bent legs, orange fissures and moss.
def ape(p,n):
    if n==8:
        ell(p,28,53,17,7); ell(p,44,54,8,6)
        stroke(p,[(21,52),(14,55),(11,58)],7)
        stroke(p,[(35,52),(45,51),(54,55)],8)
        poly(p,[(18,48),(22,45),(27,47),(25,50)],'a')
        line(p,[(29,52),(34,55),(33,59)],'e'); eye(p,47,53,7); return
    x=32+SWAY[n]//2; y=33+BOB[n]
    for far in (True,False):
        hx=x-7 if not far else x+8
        stroke(p,[(hx,y+10),(hx-4,y+17),(hx+1,59-far)],6,far=far)
        ell(p,hx+2,58-far,5,3,far=far)
        if far:
            stroke(p,[(x+8,y-2),(x+18,y+8),(x+21,y+20)],8,far=True)
            ell(p,x+21,y+22,6,5,far=True)
    poly(p,[(x-16,y+8),(x-17,y-3),(x-12,y-13),(x+1,y-17),(x+12,y-10),(x+14,y+6),(x+8,y+15),(x-7,y+15)],'b')
    poly(p,[(x-14,y-2),(x-10,y-11),(x,y-14),(x+4,y-9),(x-2,y+2),(x-10,y+5)],'l',None)
    poly(p,[(x-8,y+6),(x+8,y+5),(x+8,y+12),(x-4,y+13)],'s',None)
    line(p,[(x-5,y-8),(x-2,y-1),(x+2,y+3),(x,y+12)],'o',2)
    line(p,[(x-5,y-8),(x-2,y-1),(x+2,y+3),(x,y+12)],'e')
    arm=[(x-11,y),(x-16,y+12),(x-15,57)]
    if n==3: arm=[(x-11,y),(x-16,y-10),(x-10,y-20)]
    if n==5: arm=[(x-11,y),(x+7,y+4),(x+19,y+9)]
    if n==7: arm=[(x-11,y),(x-17,y+8),(x-20,y+16)]
    stroke(p,arm,9); ex,ey=arm[-1]; ell(p,ex,ey,7,6)
    for dx in (-3,0,3): line(p,[(ex+dx,ey-3),(ex+dx,ey+2)],'s')
    for x1,y1 in [(x-12,y-6),(x+8,y-8),(arm[1][0],arm[1][1]-2)]:
        poly(p,[(x1-4,y1),(x1-2,y1-3),(x1+2,y1-2),(x1+5,y1),(x1+3,y1+3),(x1-2,y1+2)],'a')
        line(p,[(x1-1,y1-1),(x1+2,y1)],'l')
    hx=x+8; hy=y-12+BOB[n]//2
    poly(p,[(hx-9,hy+2),(hx-9,hy-6),(hx-4,hy-11),(hx+3,hy-10),(hx+8,hy-4),(hx+9,hy+8),(hx+3,hy+12),(hx-4,hy+10)],'b')
    poly(p,[(hx-6,hy),(hx+6,hy),(hx+7,hy+8),(hx,hy+9),(hx-4,hy+6)],'s',None)
    poly(p,[(hx-6,hy-8),(hx-3,hy-12),(hx+3,hy-11),(hx+5,hy-8),(hx+1,hy-6),(hx-4,hy-6)],'a')
    line(p,[(hx-4,hy-2),(hx+7,hy-2)],'o',2)
    eye(p,hx+4,hy-1,n); p.box((hx+5,hy+2,hx+8,hy+3),'o')
    mouth(p,hx+1,hy+6,n,7)
    line(p,[(hx-7,hy-3),(hx-4,hy+1),(hx-6,hy+6)],'e')

MAP={
'crab-01':('crab',crab),
'spider-01':('spider',lambda p,n:spider(p,n)),
'spider-widow':('widow',lambda p,n:spider(p,n,True)),
'scorpion-01':('scorpion',scorpion),
'centipede-01':('centipede',lambda p,n:centipede(p,n)),
'centipede-fire':('fire',lambda p,n:centipede(p,n,True)),
'ant-soldier':('ant',lambda p,n:insect(p,n)),
'beetle-horn':('beetle',lambda p,n:insect(p,n,True)),
'mantis-01':('mantis',mantis),
'snake-01':('snake',lambda p,n:serpent(p,n)),
'eel-electric':('eel',lambda p,n:serpent(p,n,True)),
'parasite-01':('parasite',lambda p,n:worm(p,n)),
'worm-sand':('worm',lambda p,n:worm(p,n,True)),
'bat-cave':('bat',lambda p,n:flyer(p,n,'bat')),
'moth-dust':('moth',lambda p,n:flyer(p,n,'moth')),
'bird-hawk':('hawk',lambda p,n:flyer(p,n,'hawk')),
'cockatrice-01':('cockatrice',cockatrice),
'fish-01':('fish',lambda p,n:fish(p,n,'fish')),
'fish-piranha':('piranha',lambda p,n:fish(p,n,'piranha')),
'shark-land':('shark',lambda p,n:fish(p,n,'shark')),
'squid-deep':('squid',squid),
'ape-stone':('ape',ape),
}
for slug,props in BEASTS.items(): MAP[slug]=(props[0],lambda p,n,slug=slug:beast(p,n,slug))
AIR={'bat-cave','moth-dust','bird-hawk','fish-01','fish-piranha','squid-deep','eel-electric'}

def draw(slug,n):
    key,fn=MAP[slug]; p=Pen(CELL,PALS[key]); fn(p,n)
    raw=p.im.getbbox()
    assert raw and raw[0]>0 and raw[1]>0 and raw[2]<CELL and raw[3]<CELL, (slug,NAMES[n],raw,'source clipping')
    # Keep final coordinates/pixels whole. Align feet; airborne cells keep clearance.
    settle(p,G if n==8 or slug not in AIR else G-7+(n%3-1))
    return p

# Two small JRPG beasts found by final catalog audit, distinct from collection art.
PALS['fox']=palette('4d7850','92b178','294a3c','85a45c','dbbd68','eadbb6')
PALS['pup']=palette('d58742','f2b774','8b4a36','ec663e','58383b','fff0b6')

def leaf(p,x,y,dx,dy,n,c='a'):
    # Midrib is integrated into a tapered leaf, not a free floating effect.
    ex=x+dx; ey=y+dy; nx=-dy/5; ny=dx/5
    poly(p,[(x,y),(x+dx*.35+nx,y+dy*.35+ny),(ex,ey),(x+dx*.5-nx,y+dy*.5-ny)],c)
    line(p,[(x,y),(ex,ey)],'h')

def flame(p,x,y,n):
    flick=[0,1,-1,-3,2,4,1,-2,0][n]
    poly(p,[(x-5,y+3),(x-6,y-2),(x-3,y-6),(x-2,y-11+flick),(x+1,y-6),(x+4,y-8-flick),(x+3,y-2),(x+5,y+1),(x+2,y+5),(x-2,y+5)],'a')
    poly(p,[(x-3,y+2),(x-2,y-3),(x,y-6+flick//2),(x+2,y),(x+1,y+3)],'h',None)

def small_beast(p,n,fox=False):
    if n==8:
        ell(p,30,55,12,4); ell(p,47,55,6,4)
        stroke(p,[(24,55),(21,51),(25,51)],3)
        stroke(p,[(39,55),(43,51),(46,53)],3)
        if fox:
            leaf(p,21,55,-15,-8,n); leaf(p,46,53,-3,-9,n)
        else:
            curve(p,[(20,54),(12,52),(10,55),(13,57)],3)
            flame(p,12,52,8)
        eye(p,49,54,7); return
    x=30+SWAY[n]//2; y=43+BOB[n]
    hx=x+15+SWAY[n]//3; hy=y-10+BOB[n]//2
    if n==5: hx+=2; hy+=3
    if n==7: hx-=3; hy+=2
    if fox:
        curve(p,[(x-8,y),(x-18,y-5),(x-22,y-14+BOB[n])],4)
        leaf(p,x-14,y-2,-9,-17+SWAY[n]//2,n)
        leaf(p,x-17,y-7,-7,5,n,'b')
    else:
        curve(p,[(x-9,y+1),(x-16,y-6),(x-22,y-5),(x-21,y+2),(x-16,y+1)],4)
        flame(p,x-19,y-7,n)
    for far in (True,False):
        for front in (False,True):
            hip=(x+(7 if front else -7)+far*3,y+5)
            knee=(hip[0]+(1 if front else 3),y+11)
            foot=(hip[0]+(1 if front else -3),G-far)
            if front and not far and n in (0,1,2,6): knee=(hip[0]+5,y+9); foot=(hip[0]+9,y+8+n%3)
            if n==4: foot=(foot[0]+(6 if front else -5)*(1 if not far else -1),G-far)
            if n==5: knee=(hip[0]+(7 if front else -2),y+8); foot=(min(60,hip[0]+(12 if front else -9)),G-(4 if front else 0))
            if n==3: knee=(hip[0]-2,y+12); foot=(foot[0]-3,G-far)
            stroke(p,[hip,knee,foot],3 if fox else 4,far=far)
            ell(p,foot[0]+1,foot[1]-1,3,2,far=far)
        if far:
            ell(p,x,y,11,7 if fox else 9,-10)
            poly(p,[(x+1,y),(x+8,y-4),(x+10,y+4),(x+4,y+6)],'h',None)
    stroke(p,[(x+7,y-2),(hx-3,hy+3)],6,'h' if fox else 'b')
    if fox:
        # Slender angular muzzle, cream cheek, long living leaf ears.
        poly(p,[(hx-7,hy-3),(hx-4,hy-8),(hx+3,hy-6),(hx+6,hy-1),(hx+12,hy+2),(hx+10,hy+5),(hx+2,hy+7),(hx-6,hy+3)],'b')
        poly(p,[(hx-4,hy+1),(hx+3,hy),(hx+9,hy+3),(hx+5,hy+6),(hx-1,hy+5)],'h',None)
        leaf(p,hx-4,hy-4,-3,-13+BOB[n],n); leaf(p,hx+1,hy-4,3,-12,n)
        for dx,dy in [(-6,3),(-1,5),(3,4)]: leaf(p,hx+dx,hy+dy,-5+dx//2,7,n)
        leaf(p,x-4,y-5,-4,-7,n,'b')
        eye(p,hx+4,hy-2,n); dot(p,hx+11,hy+2,'o')
        mouth(p,hx+5,hy+4,n,6)
    else:
        # Rounded puppy face, soft floppy ears, paired cheek flames, short muzzle.
        ell(p,hx,hy,8,8)
        ell(p,hx-7,hy,4,7,-20)
        ell(p,hx+3,hy+4,7,4)
        flame(p,hx-6,hy-4,n); flame(p,hx+4,hy-5,n)
        eye(p,hx+4,hy-2,n,True); p.box((hx+8,hy+2,hx+10,hy+3),'o')
        # Warm smile is preserved through idle; attack opens into a barking muzzle.
        mouth(p,hx+3,hy+5,n,7)
        if n in (0,1,2,6): line(p,[(hx+2,hy+5),(hx+4,hy+7),(hx+7,hy+6)],'o')
MAP['leaf-fox']=('fox',lambda p,n:small_beast(p,n,True))
MAP['fire-pup']=('pup',lambda p,n:small_beast(p,n,False))
