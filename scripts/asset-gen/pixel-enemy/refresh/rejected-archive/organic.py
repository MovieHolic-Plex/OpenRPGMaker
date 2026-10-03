"""Forty-six original native-grid organic battlers, authored as integer clusters.
No source images are sampled. Nine articulated poses change anatomical joints.
"""
import math,sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import Canvas, POSES, run_group

# Harmonized ink, restrained species palettes, shared horn/teeth materials.
def palette(base,light,shade,accent='ad7652',eye='efd06e',pale='dbccb0'):
    return dict(o='1d2838',s=shade,b=base,l=light,h=pale,a=accent,e=eye,
                w='fff0ce',k='3c3142',r='96515b',q='d58378',z='68778a',v='a0aeb6')
PAL={
'wolf':palette('718493','a7bdc1','425363','c0cec9'),
'dire':palette('4c586b','8295a1','2d364d','667786','efad67'),
'hell':palette('5b4752','997168','342f43','eaa052','ffdc88'),
'boar':palette('806054','ba9374','4c3e45','bcb7a0'),
'bear':palette('815c48','bc9572','4d3a39','d5b697'),
'horse':palette('9b7150','d2a976','624a3e','443943'),
'unicorn':palette('c7d0c5','edf0d5','778c9e','ad9aba','8be0d5'),
'cat':palette('b38b56','e1bd7a','705444','55423e','a7e194'),
'shadow':palette('594d78','8a7ca0','332e50','aaa1bf','eacc62'),
'tiger':palette('c78c50','edbb70','845939','373340'),
'rat':palette('84726a','b9a191','53474b','c9908d','ea9b80'),
'goat':palette('9c8c72','d7c9a3','615946','86705b'),
'deer':palette('947255','cbb08a','5f4b41','6c9f7e'),
'fox':palette('6e9479','adcc92','425e55','d5bf6d','f3d585'),
'pup':palette('ba744c','e6ad65','754e43','ffd184','f8ecae'),
'spider':palette('775e83','b998a4','493e62','a9b59e','efa95e'),
'widow':palette('414f64','788897','29344b','d45c70','ffb692'),
'crab':palette('789198','b9c9b8','475c70','d5b989'),
'crabred':palette('b6725a','e2b084','734757','a89f78'),
'scorpion':palette('af8954','ddbd7a','72583e','958573'),
'scorpiondark':palette('677f8b','a7b5b1','3f5369','c9a879'),
'mantis':palette('648c68','a9c894','3d5c53','d1c4a0'),
'blade':palette('8aa78c','cce0b5','4e6f68','b8d1cd'),
'bee':palette('c9a158','efd087','746049','8c7c92'),
'beetle':palette('465d7c','8598b1','2a3c58','c9bc9a','ffcf70'),
'ant':palette('a57158','d7ab76','664b46','b4bd96'),
'centipede':palette('916b7e','c999a4','563e5c','dab27c'),
'fire':palette('78495a','be7680','443448','f2b767','ffdb85'),
'moth':palette('af9e89','e3d3af','766578','b48386'),
'parasite':palette('aa7071','dca394','694857','d6c297'),
'snake':palette('79977b','b3c694','466456','e6c993'),
'viper':palette('879976','bec99a','505f50','9c764d'),
'worm':palette('ae9275','dfcaaa','766053','8d7064'),
'bat':palette('7e7390','bba5ae','4a405e','be9080'),
'vampire':palette('504a70','8f7595','303048','cb7a87','f8b590'),
'cavebat':palette('687e89','a6b9ba','3b5366','b69a8f'),
'bird':palette('937766','d9c3a0','534754','d7ad6d'),
'cockatrice':palette('a78862','d7c597','66534c','b65c63'),
'fish':palette('648f9d','a4ccbd','395e78','cf996e'),
'piranha':palette('588694','a1c6c1','354f6c','cf7c70'),
'shark':palette('6b8e9d','b0c9c5','3d596f','d7ba9b'),
'squid':palette('94769c','c7a9be','584565','a7ccb7'),
'eel':palette('4e7785','90adb1','2d4b66','ead576'),
'ape':palette('7b8883','b2c0a7','485751','8f7964','efb77e'),
}
class Art:
    """Coordinates are articulated in native canvas units, then integer stamped."""
    def __init__(self,cell,key,n):
        self.c=Canvas(cell,PAL[key]);self.cell=cell;self.f=cell/64;self.n=n
    def pt(self,p):
        x,y=p
        if hasattr(self,'fallen_plane'):anchor,factor=self.fallen_plane;y=anchor+(y-anchor)*factor
        return (max(1,min(self.cell-2,round(x*self.f))),max(1,min(self.cell-4,round(y*self.f))))
    def poly(self,pts,col='b',edge='o'):self.c.poly([self.pt(p) for p in pts],col,edge)
    def line(self,pts,col='o',width=1):
        w=max(1,round(width*self.f));r=w//2
        points=[(max(1+r,min(self.cell-2-r,self.pt(p)[0])),max(1+r,min(self.cell-4-r,self.pt(p)[1]))) for p in pts]
        self.c.line(points,col,w)
    def box(self,x,y,w,h,col):
        a=self.pt((x,y));b=self.pt((x+w-1,y+h-1));self.c.box((*a,*b),col)
    def oval(self,x,y,rx,ry,col='b',edge='o'):
        self.c.oval((*self.pt((x-rx,y-ry)),*self.pt((x+rx,y+ry))),col,edge)
    def dot(self,x,y,col):self.c.pixel(*self.pt((x,y)),col)
    def tube(self,pts,w,col='b',far=False):
        self.line(pts,'o',w+2);self.line(pts,'s' if far else col,w)
        if not far:self.line([(x-1,y-1) for x,y in pts],'l',max(1,w//3))
    def eye(self,x,y,large=False):
        if self.n in (7,8):self.line([(x-1,y),(x,y+1),(x+2,y)],'o');return
        self.box(x-1,y-1,4 if large else 3,3 if large else 2,'o')
        self.box(x,y,2,1,'e');self.dot(x+1,y,'o');
        if large:self.dot(x,y-1,'w')
    def jaw(self,x,y,w,op=0,fanged=False):
        op=op or [1,2,1,0,2,5,2,0,0][self.n]
        self.poly([(x,y),(x+w,y-1),(x+w-1,y+op),(x+1,y+op+1)],'k')
        if op>1:
            for dx in range(2,w-1,4):self.poly([(x+dx,y),(x+dx+2,y),(x+dx+1,y+min(3,op))],'w',None)
            self.line([(x+2,y+op),(x+w-2,y+op-1)],'r')
        if fanged:
            self.poly([(x+2,y),(x+5,y),(x+4,y+6),(x+3,y+7)],'w')
    def horn(self,pts):
        self.poly(pts,'h');self.line(pts[:3],'w');
    def marks(self,pts,color='s'):
        for x,y in pts:self.line([(x,y),(x+2,y+1),(x+3,y)],color)

# Root movement shifts drawn joints, never source bitmap pixels.
BOB=[0,1,-1,2,-1,1,1,3,0]
LEAN=[0,0,1,-3,1,4,2,-3,0]
HEAD=[0,1,-1,-4,2,3,2,-3,0]

QUAD={
'wolf-grey':('wolf', 'wolf',1),'wolf-01':('wolf','wolf',2),'wolf-dire':('dire','dire',3),
'hound-hell':('hell','hell',3),'boar-tusk':('boar','boar',1),'bear-brown':('bear','bear',1),
'horse-01':('horse','horse',1),'unicorn-01':('unicorn','unicorn',1),'cat-01':('cat','cat',1),
'cat-shadow':('shadow','shadow',2),'tiger-saber':('tiger','tiger',3),'rat-giant':('rat','rat',1),
'goat-mountain':('goat','goat',1),'deer-forest':('deer','deer',1),
'leaf-fox':('fox','fox',1),'fire-pup':('pup','pup',1),
}

def mammal(a,kind,variant):
    n=a.n;dead=n==8;horse=kind in ('horse','unicorn','deer','goat');big=kind in ('bear','boar','dire','hell','tiger')
    bob=BOB[n];lean=LEAN[n];g=60
    # Species body silhouette ratios and independent muzzle/neck joints.
    dims={
    'wolf':(27,36,16,8,46,26),'dire':(26,36,17,11,44,30),'hell':(27,37,16,10,46,26),
    'boar':(27,40,19,13,45,34),'bear':(26,39,19,14,44,30),
    'horse':(26,34,17,10,44,16),'unicorn':(26,33,17,10,44,17),
    'cat':(26,41,15,8,46,32),'shadow':(25,45,17,7,46,37),'tiger':(27,38,18,11,45,30),
    'rat':(26,43,16,10,47,38),'goat':(26,36,16,10,46,25),'deer':(27,35,15,9,46,23),
    'fox':(26,41,14,8,46,31),'pup':(26,42,13,9,45,30)}
    cx,cy,rx,ry,hx,hy=dims[kind];cx+=lean;cy+=bob;hx+=HEAD[n];hy+=bob
    if dead:
        cx,cy=27,53;hx,hy=46,53;ry=max(4,ry//2)
    # Tail: long articulated curls, fox leaf fan, heat plume, boar corkscrew.
    td=[0,1,-1,-3,3,4,1,-3,0][n]
    if kind in ('wolf','dire','hell','fox','pup'):
        if dead:tail=[(cx-rx+3,52),(14,53),(7,57),(4,56),(7,52),(12,49),(19,49)]
        elif kind=='fox':tail=[(cx-rx+4,cy),(12,37+td),(6,31+td),(3,33+td),(5,43),(13,48),(20,45)]
        elif kind=='pup':tail=[(cx-rx+3,cy),(11,37),(7,30+td),(8,39),(3,37),(6,48),(15,49)]
        else:tail=[(cx-rx+3,cy),(12,36+td),(6,35+td),(3,38+td),(5,43+td),(10,46),(17,46)]
        a.poly(tail,'a' if kind in ('fox','pup') else 'b');a.line(tail[:3],'l',2)
        a.poly([(tail[2][0]+1,tail[2][1]+2),(tail[3][0]+1,tail[3][1]+1),(tail[4][0]+2,tail[4][1]-1),(tail[5][0],tail[5][1]-2)],'h' if kind in ('wolf','fox') else 'l',None)
        if kind=='pup':a.poly([(7,43),(10,36+td),(12,43),(14,39),(15,47),(9,47)],'w',None)
    elif kind in ('cat','shadow','tiger','rat'):
        tt=[(cx-rx+3,cy),(8,cy+1),(4,cy-5-td),(5,cy-12-td),(10,cy-15-td),(14,cy-12-td)] if not dead else [(15,53),(8,52),(4,55),(8,59),(13,57)]
        a.tube(tt,2 if kind=='rat' else 3,'a' if kind=='rat' else 'b')
        if kind=='tiger':
            for x,y in tt[1:]:a.line([(x-1,y-1),(x+1,y+1)],'a',2)
    elif kind in ('horse','unicorn'):
        t=[(cx-rx+3,cy-4),(8,cy+5),(6,cy+13),(9,cy+12),(11,cy+16),(15,cy+11),(15,cy+2)] if not dead else [(13,51),(5,55),(5,58),(15,58),(18,53)]
        a.poly(t,'a');a.line(t[:3],'l')
    elif kind=='boar':
        if dead:a.tube([(13,53),(7,51),(4,54),(7,57),(10,54)],2)
        else:a.tube([(12,36+bob),(6,32+bob),(4,35+bob),(6,38+bob),(9,36+bob)],2)
    else:a.poly([(cx-rx+3,cy),(cx-rx-3,cy-4),(cx-rx-5,cy),(cx-rx+1,cy+4)],'a')
    # Four limbs: hind hock bends opposite foreleg elbow, stride changes planting.
    legs=[(-9,5,-3,True),(10,4,2,True),(-8,8,-2,False),(11,7,3,False)]
    for off,dy,knee,far in legs:
        stride=([0,0,1,-2,4,-3,-1,1,0][n])*(1 if off>0 else -1)
        x=cx+off+(2 if far else 0);y=cy+dy
        if dead:
            a.tube([(x,53),(x-4,49 if far else 54),(x-7,47 if far else 58)],3 if horse else 4,far=far);continue
        foot=x+stride+(1 if off>0 else -2)
        lift=3 if n==4 and ((off<0 and not far) or (off>0 and far)) else 0
        if n==5 and off>0 and not far:foot+=3;lift=6
        width=6 if kind=='dire' and off>0 else 3 if horse else 4 if kind in ('wolf','fox','cat','shadow','pup','rat') else 5
        a.tube([(x,y),(x+knee,51+bob),(foot,58-lift)],width,far=far)
        a.poly([(foot-width/2-1,56-lift),(foot+width/2+2,56-lift),(foot+width/2+3,g-lift),(foot-width/2-1,g-lift)],'s' if far else 'a' if horse else 'b')
        if not far:
            a.line([(foot-1,58-lift),(foot+3,58-lift)],'l');a.line([(foot+1,58-lift),(foot+1,60-lift)],'o')
            if kind in ('wolf','dire','hell','cat','shadow','tiger','bear'):a.dot(foot+3,59-lift,'h')
    # An angular, shaded torso with chest and rump masses rather than a flat oval.
    a.poly([(cx-rx,cy-2),(cx-rx+3,cy-ry+3),(cx-7,cy-ry),(cx+7,cy-ry-1),(cx+rx-3,cy-ry+4),(cx+rx,cy-1),(cx+rx-3,cy+ry-2),(cx+4,cy+ry),(cx-9,cy+ry-1),(cx-rx,cy+4)],'b')
    a.poly([(cx-rx+2,cy-2),(cx-rx+5,cy-ry+4),(cx-7,cy-ry+2),(cx+6,cy-ry+1),(cx+9,cy-5),(cx+1,cy-3),(cx-8,cy-2)],'l',None)
    a.poly([(cx-rx+2,cy+3),(cx-6,cy+4),(cx+7,cy+3),(cx+rx-1,cy-1),(cx+rx-4,cy+ry-2),(cx+3,cy+ry-1),(cx-9,cy+ry-2)],'s',None)
    a.line([(cx-10,cy-3),(cx-7,cy+2),(cx-8,cy+6)],'s');a.line([(cx+6,cy-4),(cx+9,cy),(cx+8,cy+5)],'s')
    if kind in ('dire','hell','boar','bear','wolf'):
        for x,y in [(cx-10,cy+3),(cx-5,cy+5),(cx+2,cy+5),(cx+7,cy+4)]:a.poly([(x-2,y-1),(x,y+3),(x+2,y)],'s',None)
    if kind=='tiger':
        for x,y in [(cx-11,cy-7),(cx-3,cy-8),(cx+5,cy-7),(cx-6,cy+3),(cx+3,cy+3)]:a.poly([(x-2,y),(x+1,y+1),(x+2,y+5),(x,y+3)],'a',None)
    if kind=='deer':
        for x,y in [(cx-9,cy-5),(cx-4,cy-6),(cx+1,cy-5),(cx-6,cy),(cx+3,cy-1)]:a.box(x,y,2,1,'h')
    if kind=='boar':
        for x in range(-11,12,4):a.poly([(cx+x,cy-ry+4),(cx+x+1,cy-ry-3),(cx+x+3,cy-ry+3)],'a')
    # Near haunch and shoulder overlap the belly: muscle volumes, broken lit fur.
    if not dead:
        a.poly([(cx-12,cy-3),(cx-6,cy-6),(cx-2,cy-2),(cx-2,cy+5),(cx-6,cy+10),(cx-12,cy+8),(cx-14,cy+3)],'b',None)
        a.poly([(cx-11,cy-2),(cx-7,cy-4),(cx-4,cy-1),(cx-5,cy+3),(cx-10,cy+4)],'l',None)
        a.line([(cx-2,cy),(cx-3,cy+5),(cx-6,cy+8)],'s')
        a.poly([(cx+7,cy-5),(cx+13,cy-5),(cx+16,cy+1),(cx+13,cy+9),(cx+8,cy+7),(cx+5,cy+1)],'b',None)
        a.poly([(cx+8,cy-3),(cx+12,cy-3),(cx+13,cy+2),(cx+10,cy+4),(cx+8,cy+1)],'l',None)
        a.line([(cx+6,cy-1),(cx+6,cy+4),(cx+9,cy+7)],'s')
        # Fur follows rump/chest flow in angular two to five pixel clusters.
        if not horse:
            for x,y in [(cx-9,cy-5),(cx-4,cy-7),(cx+1,cy-7),(cx+8,cy-6),(cx-9,cy+5),(cx+11,cy+4)]:
                a.poly([(x-2,y-1),(x+1,y),(x+2,y+3),(x,y+1),(x-3,y+1)],'s' if y>cy else 'b',None)
                a.line([(x-1,y-2),(x+1,y-1)],'h' if kind in ('wolf','fox') else 'l')
            for x,y in [(cx-12,cy-2),(cx-6,cy+3),(cx+10,cy)]:a.line([(x,y),(x+2,y+1),(x+1,y+2)],'s')
        if kind in ('dire','hell'):
            for dx,dy in [(-7,-9),(-3,-11),(1,-12),(7,-10),(12,-7)]:
                a.poly([(cx+dx-3,cy+dy+5),(cx+dx-1,cy+dy-1),(cx+dx+2,cy+dy+3),(cx+dx+4,cy+dy+1),(cx+dx+4,cy+dy+7)],'s' if kind=='dire' else 'a')
                a.line([(cx+dx,cy+dy+2),(cx+dx+2,cy+dy+5)],'l')
    if kind=='dire' and not dead:
        # Heavy predatory neck: continuous jagged dark fur, not discrete armor tiles.
        a.poly([(cx+2,cy-11),(cx+8,cy-17),(cx+12,cy-14),(hx-5,hy-10),(hx-2,hy-7),(hx-5,hy+2),(hx-3,hy+6),(hx-7,hy+9),(hx-5,hy+13),(hx-11,hy+12),(hx-10,hy+18),(cx+10,cy+15),(cx+9,cy+9),(cx+5,cy+9),(cx+4,cy+2)],'s')
        a.poly([(cx+8,cy-13),(cx+11,cy-11),(hx-6,hy-7),(hx-8,hy+2),(cx+13,cy+4),(cx+9,cy),(cx+6,cy-5)],'b',None)
        a.line([(cx+8,cy-10),(cx+10,cy-7),(cx+12,cy-5)],'l')
        for x,y in [(hx-7,hy+4),(hx-10,hy+8),(cx+9,cy+10)]:a.line([(x-2,y-2),(x,y),(x-1,y+3)],'a')
    if kind=='tiger' and not dead:
        a.poly([(cx+5,cy-8),(cx+10,cy-15),(cx+15,cy-11),(cx+18,cy-4),(cx+14,cy+4),(cx+7,cy+4)],'b',None)
        a.poly([(cx+8,cy-8),(cx+10,cy-12),(cx+13,cy-9),(cx+14,cy-4),(cx+11,cy-2)],'l',None)
        for dx in (7,12):a.poly([(cx+dx,cy-10),(cx+dx+3,cy-8),(cx+dx+4,cy-3),(cx+dx+1,cy-5)],'a',None)
    # Tall ungulate neck, broad ursine head, low feline stalking neck, canine mane.
    if horse and not dead:
        a.poly([(cx+8,cy-6),(hx-5,hy-3),(hx+3,hy+2),(hx+1,hy+13),(cx+13,cy+5)],'b')
        a.poly([(hx-5,hy+2),(hx-2,hy+5),(cx+14,cy),(cx+12,cy-4)],'l',None)
        if kind in ('horse','unicorn'):a.poly([(hx-6,hy-4),(hx-9,hy+1),(hx-8,hy+8),(hx-11,hy+15),(cx+9,cy-3),(hx-4,hy+2)],'a')
    elif not dead and kind!='dire':
        a.poly([(cx+7,cy-7),(hx-5,hy-3),(hx+1,hy+4),(hx-1,hy+13),(cx+10,cy+7),(cx+5,cy+1)],'b')
        a.poly([(cx+9,cy-4),(hx-4,hy+2),(hx-2,hy+10),(cx+11,cy+3)],'h' if kind in ('wolf','fox','pup') else 'l',None)
        if kind in ('dire','hell','wolf','bear','goat'):
            for dx,dy in [(-7,5),(-5,10),(-10,14)]:a.poly([(hx+dx,hy+dy-5),(hx+dx-5,hy+dy),(hx+dx+2,hy+dy+2)],'s' if kind in ('dire','hell') else 'b')
    # Head vertices distinguish muzzle length, rounded bear ears, pointed cats, boar snout.
    if kind in ('bear','boar','rat'):
        head=[(hx-8,hy-2),(hx-4,hy-7),(hx+3,hy-7),(hx+7,hy-2),(hx+10,hy+2),(hx+8,hy+7),(hx,hy+9),(hx-7,hy+5)]
    elif kind in ('cat','shadow','tiger'):
        head=[(hx-8,hy-3),(hx-5,hy-8),(hx+2,hy-8),(hx+7,hy-4),(hx+8,hy+2),(hx+6,hy+7),(hx-2,hy+9),(hx-8,hy+4)]
    elif kind in ('horse','unicorn'):
        head=[(hx-5,hy-6),(hx+1,hy-7),(hx+4,hy-2),(hx+10,hy+7),(hx+13,hy+12),(hx+11,hy+15),(hx+6,hy+14),(hx+1,hy+7),(hx-5,hy+2)]
    elif kind in ('deer','goat'):
        head=[(hx-5,hy-6),(hx+1,hy-7),(hx+5,hy-3),(hx+10,hy+4),(hx+9,hy+8),(hx+4,hy+9),(hx-1,hy+5),(hx-6,hy+2)]
    else:head=[(hx-7,hy-3),(hx-2,hy-7),(hx+3,hy-5),(hx+5,hy-1),(hx+10,hy+1),(hx+11,hy+5),(hx+5,hy+8),(hx-3,hy+8),(hx-8,hy+3)]
    if dead:head=[(x,y-2) for x,y in head]
    a.poly(head,'b');a.poly([(hx-5,hy-2),(hx-1,hy-5),(hx+3,hy-3),(hx+4,hy),(hx,hy+2),(hx-5,hy+1)],'l',None)
    a.poly([(hx-4,hy+4),(hx+3,hy+2),(hx+9,hy+3),(hx+8,hy+6),(hx+2,hy+7),(hx-3,hy+6)],'h' if kind in ('wolf','fox','rat','bear','horse','unicorn','deer','goat','pup') else 'l',None)
    if kind in ('wolf','dire','hell','fox','pup','cat','shadow','tiger'):
        a.poly([(hx-7,hy+1),(hx-10,hy+4),(hx-6,hy+4),(hx-9,hy+8),(hx-3,hy+7),(hx-1,hy+5)],'b')
        a.line([(hx-7,hy+2),(hx-4,hy+4),(hx-3,hy+6)],'h' if kind in ('wolf','fox','pup') else 'l')
        a.line([(hx-4,hy-1),(hx-1,hy-2),(hx+3,hy-1)],'s')
    if kind in ('bear','rat'):
        for ex in (-6,1):a.oval(hx+ex,hy-6,3,3,'b');a.oval(hx+ex,hy-6,1,1,'a',None)
    elif kind=='boar':a.poly([(hx-5,hy-3),(hx-6,hy-12),(hx,hy-7),(hx+2,hy-3)],'b');a.line([(hx-4,hy-8),(hx-1,hy-4)],'a')
    else:
        a.poly([(hx-5,hy-3),(hx-5,hy-12 if kind in ('fox','pup','wolf','dire') else hy-10),(hx+1,hy-6),(hx+1,hy-3)],'b');a.poly([(hx-4,hy-7),(hx-4,hy-10),(hx-1,hy-6)],'a',None)
    a.eye(hx+2,hy,large=kind in ('cat','shadow','pup','rat'))
    nx=hx+(6 if kind in ('cat','shadow','tiger') else 8)
    a.box(nx,hy+2,2 if kind in ('cat','shadow','tiger') else 3,2,'o');a.dot(nx,hy+2,'v')
    a.jaw(hx+2,hy+5,5 if kind in ('cat','shadow','tiger') else 7, fanged=kind=='tiger')
    if kind in ('cat','shadow','tiger'):
        a.line([(hx+3,hy+4),(hx+7,hy+5)],'h');a.line([(hx+2,hy+6),(hx+6,hy+8)],'h')
    if kind=='boar':
        a.horn([(hx+1,hy+6),(hx+3,hy+12),(hx+9,hy+12),(hx+13,hy+8),(hx+14,hy+1),(hx+12,hy-3),(hx+12,hy+5),(hx+8,hy+8),(hx+5,hy+7),(hx+4,hy+4)])
        a.line([(hx+4,hy+9),(hx+8,hy+9),(hx+11,hy+6)],'w')
    if kind in ('horse','unicorn'):
        a.poly([(hx+1,hy),(hx+4,hy+1),(hx+10,hy+10),(hx+8,hy+13),(hx+5,hy+8)],'l',None)
        a.poly([(hx+7,hy+9),(hx+11,hy+9),(hx+13,hy+12),(hx+10,hy+14),(hx+7,hy+12)],'a')
        a.dot(hx+10,hy+11,'o');a.line([(hx+9,hy+13),(hx+12,hy+12)],'s')
    if kind=='tiger':
        for dx in (1,6):
            a.horn([(hx+dx,hy+5),(hx+dx+3,hy+5),(hx+dx+3,hy+11),(hx+dx+1,hy+16),(hx+dx-1,hy+17),(hx+dx+1,hy+10)])
    if kind=='goat':
        a.horn([(hx-3,hy-4),(hx-8,hy-9),(hx-9,hy-16),(hx-6,hy-17),(hx-6,hy-10),(hx,hy-6)])
        a.poly([(hx+1,hy+8),(hx,hy+15),(hx+4,hy+13),(hx+5,hy+8)],'h')
    if kind=='unicorn':a.horn([(hx+2,hy-5),(hx+9,hy-17),(hx+5,hy-5)])
    if kind=='deer':
        for ex in (-5,0):
            a.tube([(hx+ex,hy-5),(hx+ex-3,hy-11),(hx+ex-2,hy-18)],2,'h')
            a.line([(hx+ex-3,hy-11),(hx+ex-7,hy-13),(hx+ex-7,hy-17)],'h',2)
            a.line([(hx+ex-2,hy-15),(hx+ex+2,hy-18)],'h',2)
    if kind in ('hell','pup'):
        for x,y in [(cx-8,cy-6),(cx+1,cy-8),(hx-5,hy+7)]:a.poly([(x-2,y+2),(x,y-4),(x+1,y),(x+4,y-3),(x+3,y+3)],'a');a.dot(x,y-1,'w')
    if kind=='fox':
        for x,y in [(cx-6,cy-7),(cx+1,cy-8),(hx-5,hy-6)]:a.poly([(x-2,y+2),(x-4,y-4),(x+1,y-2),(x+4,y+2),(x,y+3)],'a');a.line([(x-2,y-2),(x+1,y+1)],'h')
    if kind=='shadow':
        a.line([(cx-10,cy+1),(cx-3,cy-1),(cx+3,cy)],'a');a.poly([(hx-6,hy-7),(hx-10,hy-10),(hx-8,hy-2)],'a')
    if variant==2 and kind=='wolf':
        a.poly([(hx-8,hy+2),(hx-12,hy+7),(hx-5,hy+6)],'a');a.line([(cx-8,cy-5),(cx,cy-6),(cx+6,cy-4)],'h')

BUG={
'spider-cave':('spider','cave'),'spider-01':('spider','tarantula'),'spider-widow':('widow','widow'),
'crab-rock':('crab','rock'),'crab-01':('crabred','crab'),
'scorpion-sand':('scorpion','sand'),'scorpion-01':('scorpiondark','scorpion'),
'mantis-blade':('blade','blade'),'mantis-01':('mantis','mantis'),
'bee-giant':('bee','bee'),'beetle-horn':('beetle','beetle'),
'ant-soldier':('ant','ant'),'centipede-01':('centipede','centipede'),
'centipede-fire':('fire','fire'),'moth-dust':('moth','moth'),
'parasite-01':('parasite','parasite')}

def segmented_leg(a,pts,far=False,width=2):
    a.tube(pts,width,far=far)
    if not far:
        for x,y in pts[1:-1]:a.poly([(x-1,y-2),(x+2,y-1),(x+1,y+2),(x-2,y+1)],'a')
    a.line([pts[-2],pts[-1]],'o')
    tx,ty=pts[-1]
    if ty>=58 and a.n!=8:
        a.poly([(tx-1,ty-1),(tx+1,ty),(tx+1,60),(tx-1,60)],'s' if far else 'b')

def spider(a,kind):
    n=a.n;dead=n==8;cx=29+LEAN[n]//2;cy=39+BOB[n]
    large=kind=='widow';long=kind=='cave';cy-=3 if large else 0
    if dead:cx,cy=25,53
    # Eight separately bent legs; far legs behind abdomen, near legs in front.
    for far in (True,False):
        for i in range(4):
            root=(cx+2+i*3,cy+2);knee=(cx-18+i*11+(3 if far else 0),cy-8+i%2*3)
            fy=58+(i%2)*2;stride=([0,1,-1,-2,4,3,1,-2,0][n])*(-1 if i<2 else 1)
            toe=(8+i*15+stride+(1 if far else -1),fy-(3 if n==4 and i%2 else 0))
            if n==5 and i>=2:knee=(knee[0]+4,knee[1]-4);toe=(min(61,toe[0]+2),fy-7)
            if dead:knee=(cx-12+i*9,48-i%2*3);toe=(cx-7+i*7,45+i%2*3)
            segmented_leg(a,[root,knee,(knee[0]-1 if i<2 else knee[0]+3,knee[1]+10),toe],far,3 if kind=='tarantula' else 2)
        if far:
            # Rear abdomen contour, robust tarantula vs slender cave species vs widow dome.
            ax=cx-8;ay=cy-4
            rx=13 if long else 11;ry=14 if large else 8
            a.poly([(ax-rx,ay-2),(ax-rx+3,ay-ry+3),(ax-3,ay-ry),(ax+5,ay-ry+1),(ax+rx,ay-3),(ax+rx-1,ay+5),(ax+4,ay+ry),(ax-7,ay+ry-1),(ax-rx,ay+4)],'b')
            a.poly([(ax-rx+3,ay-3),(ax-rx+5,ay-ry+4),(ax-2,ay-ry+2),(ax+5,ay-ry+3),(ax+3,ay-2),(ax-4,ay+2)],'l',None)
            a.poly([(ax+5,ay-1),(ax+rx-1,ay),(ax+rx-3,ay+6),(ax+3,ay+ry-1),(ax-5,ay+ry-2),(ax-1,ay+3)],'s',None)
            if large:a.poly([(ax,ay-6),(ax+5,ay-3),(ax+1,ay),(ax+5,ay+3),(ax,ay+6),(ax-3,ay+2),(ax-1,ay)],'a')
            else:
                for j in range(3):a.line([(ax-7+j*4,ay-5),(ax-5+j*4,ay),(ax-6+j*4,ay+5)],'s')
                a.marks([(ax-8,ay-3),(ax-2,ay-7),(ax+4,ay-4)],'h')
    hx=cx+13+HEAD[n]//2;hy=cy+3
    a.poly([(hx-9,hy-4),(hx-5,hy-9),(hx+2,hy-8),(hx+7,hy-2),(hx+7,hy+4),(hx+1,hy+8),(hx-7,hy+6)],'b')
    a.poly([(hx-6,hy-3),(hx-3,hy-6),(hx+2,hy-5),(hx+3,hy-1),(hx-2,hy+2)],'l',None)
    a.eye(hx+3,hy-1,True);a.eye(hx,hy+2);a.dot(hx+4,hy+3,'e');a.dot(hx-3,hy,'e')
    for dx in (-3,3):
        bite=[0,1,0,-2,1,4,2,-1,0][n]
        a.poly([(hx+dx,hy+5),(hx+dx+4,hy+6),(hx+dx+5,hy+10+bite),(hx+dx+2,hy+12),(hx+dx+1,hy+8)],'a')
        a.line([(hx+dx+1,hy+6),(hx+dx+3,hy+8)],'h')
    if kind=='tarantula':
        for x,y in [(cx-11,cy-9),(cx-5,cy-10),(hx-7,hy),(hx-5,hy+5)]:a.line([(x-2,y-2),(x,y),(x-2,y+1)],'a')

def crab(a,kind):
    n=a.n;cx=27+LEAN[n]//2;cy=43+BOB[n];dead=n==8
    if dead:cx,cy=26,53
    # Four walking leg pairs fan beneath the carapace.
    for far in (True,False):
        for i in range(4):
            root=(cx-9+i*6,cy+1);outside=(-11,-9,10,14)[i];step=[0,1,-1,-2,3,2,1,-2,0][n]*(1 if i>1 else -1)
            knee=(root[0]+outside,cy+5+i%2*3);toe=(root[0]+outside-2+step,59-i%2)
            if dead:knee=(root[0]+outside//2,48);toe=(root[0]+outside//2+2,44+i%2*3)
            segmented_leg(a,[root,knee,toe],far,2)
        if far:
            a.tube([(cx+7,cy-3),(cx+12,cy-11),(cx+17,cy-13)],4,far=True)
            a.poly([(cx+12,cy-17),(cx+20,cy-17),(cx+23,cy-12),(cx+19,cy-8),(cx+14,cy-9)],'s')
    shell=[(cx-14,cy),(cx-12,cy-9),(cx-6,cy-14),(cx+5,cy-14),(cx+12,cy-8),(cx+14,cy+1),(cx+8,cy+6),(cx-7,cy+6)]
    a.poly(shell,'b');a.poly([(cx-11,cy-3),(cx-9,cy-9),(cx-5,cy-12),(cx+4,cy-12),(cx+5,cy-6),(cx,cy-2),(cx-7,cy)],'l',None)
    a.poly([(cx+5,cy-5),(cx+11,cy-8),(cx+12,cy+1),(cx+7,cy+4),(cx-6,cy+4),(cx-1,cy)],'s',None)
    a.line([(cx-4,cy-12),(cx-3,cy-6),(cx+3,cy-3),(cx+6,cy+3)],'o')
    if kind=='rock':
        for dx,dy in [(-7,-7),(2,-9),(6,-2)]:
            a.poly([(cx+dx-3,cy+dy+2),(cx+dx-1,cy+dy-3),(cx+dx+3,cy+dy-4),(cx+dx+5,cy+dy),(cx+dx+2,cy+dy+3)],'a')
            a.line([(cx+dx-1,cy+dy-2),(cx+dx+2,cy+dy-3)],'h')
    else:
        for dx,dy in [(-8,-6),(-2,-9),(5,-6),(-1,1)]:a.poly([(cx+dx-1,cy+dy),(cx+dx,cy+dy-2),(cx+dx+2,cy+dy+1)],'a')
    for dx in (8,12):
        a.tube([(cx+dx,cy-4),(cx+dx+1,cy-12-(n==2))],2);a.eye(cx+dx+1,cy-13-(n==2),True)
    # Crusher claw hinged open during windup, closed at contact.
    hx=cx+22+HEAD[n]//3;hy=cy-1-[0,1,0,8,1,-1,1,-2,0][n]
    if dead:hx,hy=49,54
    a.tube([(cx+9,cy+2),(cx+15,hy+7),(hx-4,hy+3)],5)
    opening=[3,4,2,7,4,0,4,2,0][n]
    a.poly([(hx-5,hy-1),(hx-3,hy-7-opening),(hx+3,hy-8-opening),(hx+9,hy-3-opening),(hx+8,hy-opening),(hx+2,hy-2),(hx,hy+3)],'b')
    a.poly([(hx-3,hy+1),(hx+4,hy+1),(hx+8,hy-1),(hx+8,hy+5),(hx+3,hy+8),(hx-3,hy+6)],'b')
    a.line([(hx-2,hy-5-opening),(hx+3,hy-6-opening),(hx+6,hy-3-opening)],'l',2)
    a.poly([(hx+1,hy+2),(hx+6,hy+2),(hx+5,hy+5),(hx+1,hy+6)],'s',None)

def scorpion(a,kind):
    n=a.n;cx=25+LEAN[n];cy=46+BOB[n];dead=n==8
    if dead:cx,cy=27,54
    tail=[(cx-10,cy),(16,40),(10,32),(10,21),(16,14),(25,14),(31,19)]
    if kind=='scorpion':tail=[(cx-11,cy),(13,36),(10,25),(15,17),(27,15),(38,20)]
    if n==3:tail=[(x-2,y-3) for x,y in tail]
    if n==5:tail=[(cx-10,cy),(18,37),(18,25),(27,21),(40,25),(48,33)]
    if dead:tail=[(16,54),(11,50),(6,48),(4,53),(8,56)]
    a.tube(tail,5)
    for j,(x,y) in enumerate(tail[1:-1]):a.line([(x-2,y-2),(x+2,y+2)],'o');a.box(x-2,y-3,3,1,'h')
    x,y=tail[-1];a.poly([(x-3,y-3),(x+2,y-3),(x+5,y+1),(x+4,y+6),(x+1,y+8),(x+2,y+3),(x-2,y+1)],'a');a.dot(x+1,y-2,'h')
    for far in (True,False):
        for i in range(4):
            rx=cx-8+i*5;step=3 if n==4 and i%2 else -1 if n==3 else 0
            pts=[(rx,cy),(rx-5+(i>1)*13,cy+5),(rx-7+(i>1)*17+step,60-i%2)]
            if dead:pts=[(rx,54),(rx-3,48),(rx+1,46)]
            segmented_leg(a,pts,far,2)
        if far:a.tube([(cx+8,cy-2),(cx+16,cy-9),(cx+22,cy-9)],3,far=True)
    a.poly([(cx-14,cy-2),(cx-10,cy-8),(cx-2,cy-10),(cx+8,cy-7),(cx+13,cy-1),(cx+9,cy+6),(cx-1,cy+7),(cx-10,cy+4)],'b')
    a.poly([(cx-11,cy-2),(cx-8,cy-6),(cx-1,cy-8),(cx+7,cy-5),(cx+3,cy-1),(cx-6,cy+1)],'l',None)
    for dx in (-9,-4,1,6):a.line([(cx+dx,cy-6),(cx+dx+1,cy+4)],'s')
    a.eye(cx+10,cy-2);a.eye(cx+6,cy-3)
    hx=cx+24+HEAD[n]//3;hy=cy+1-(7 if n==3 else 0)
    if dead:hx,hy=48,55
    a.tube([(cx+9,cy+3),(cx+15,hy+6),(hx-6,hy+2)],4)
    op=[2,3,1,6,3,0,3,1,0][n]
    a.poly([(hx-6,hy-2),(hx-3,hy-7-op),(hx+3,hy-6-op),(hx+7,hy-2-op),(hx+3,hy-op),(hx,hy-1),(hx-2,hy+3)],'b')
    a.poly([(hx-5,hy+1),(hx+2,hy+2),(hx+6,hy),(hx+4,hy+6),(hx-2,hy+7),(hx-6,hy+4)],'b')
    a.line([(hx-3,hy-4-op),(hx+1,hy-4-op),(hx+3,hy-2-op)],'l');a.line([(hx-2,hy+5),(hx+2,hy+4)],'s')

# Insects: narrow articulated thorax and large abdomen, with nonidentical wing/arm species.
def wing(a,root,tip,lower,color='a',pattern=False):
    x,y=root;tx,ty=tip;lx,ly=lower
    pts=[(x,y),(tx-3,ty+2),(tx,ty),(tx+1,ty+7),(lx,ly),(x+2,y+3)]
    a.poly(pts,color);a.poly([(x,y),(tx-2,ty+4),(tx-1,ty+8),(lx-1,ly-2),(x+1,y+2)],'h',None)
    a.line([(x,y),(tx-1,ty+5),(lx,ly-1)],'s');a.line([(x+1,y+1),(tx+1,ty+10)],'a')
    if pattern:
        a.oval(tx,ty+8,3,4,'s');a.oval(tx,ty+8,1,2,'a');a.marks([(tx-3,ty+3),(lx-1,ly-4)],'o')

def flying_insect(a,kind):
    n=a.n;dead=n==8;cx=32+LEAN[n]//2;cy=34+BOB[n];flap=[0,-6,5,-2,-4,10,1,6,0][n]
    if kind=='moth' and dead:
        a.poly([(10,58),(13,49),(23,50),(31,56),(38,49),(53,51),(57,58),(31,60)],'a')
        a.line([(14,53),(26,57),(37,53),(51,56)],'s')
        a.poly([(19,54),(24,51),(34,51),(41,54),(40,58),(30,59),(20,57)],'b')
        a.line([(22,53),(34,53),(39,55)],'l')
        for x in (25,30,35):a.line([(x,53),(x+1,57)],'s')
        a.oval(43,55,5,4);a.eye(45,55)
        a.line([(44,52),(48,49),(52,50)],'o');a.line([(45,53),(51,52),(54,54)],'o')
        return
    if kind=='moth':
        if dead:
            a.poly([(10,58),(13,47),(27,50),(32,55),(38,47),(54,51),(58,58),(33,60)],'a')
        else:
            for far in (True,False):
                sign=-1 if far else 1
                wing(a,(cx,cy),(cx+sign*25,14+flap),(cx+sign*21,40+flap),'b',True)
                wing(a,(cx,cy+3),(cx+sign*19,40+flap),(cx+sign*13,52+flap//2),'a',True)
        a.poly([(cx-3,cy-12),(cx+3,cy-10),(cx+5,cy+8),(cx+2,cy+17),(cx-2,cy+15),(cx-5,cy+2)],'b')
        a.line([(cx-1,cy-8),(cx-1,cy+12)],'l',2)
        hx,hy=cx+1,cy-12
        if dead:hx,hy=40,54
        a.oval(hx,hy,4,4);a.eye(hx+1,hy)
        for dx in (-3,3):a.line([(hx+dx,hy-2),(hx+dx*2,hy-8),(hx+dx*3,hy-9)],'o');a.dot(hx+dx*3,hy-9,'a')
        if not dead:
            for i in range(3):segmented_leg(a,[(cx+2,cy+i*4),(cx+8,cy+i*4+5),(cx+13+(n==5)*3,cy+i*4+4)],False,1)
        return
    # Bee: foreshortened abdomen, broad back wings, fuzzy gold thorax, stinger.
    if dead:cx,cy=27,53
    else:
        wing(a,(cx-2,cy-4),(cx-13,12+flap),(cx-14,26+flap),'v')
        wing(a,(cx+3,cy-5),(cx+16,11-flap//2),(cx+17,29-flap//2),'v')
    for far in (True,False):
        for i in range(3):
            x=cx-6+i*6;y=cy+7
            pts=[(x,y),(x-2+(i>0)*6,y+6),(x+1+(i>0)*7+(3 if n==5 else 0),y+11)]
            if dead:pts=[(x,54),(x-3,49),(x+1,48)]
            segmented_leg(a,pts,far,2)
        if far:
            a.poly([(cx-22,cy+3),(cx-18,cy-7),(cx-11,cy-9),(cx-5,cy-4),(cx-4,cy+6),(cx-13,cy+12),(cx-19,cy+10)],'b')
            for dx in (-17,-10):a.poly([(cx+dx-1,cy-7),(cx+dx+3,cy-5),(cx+dx+3,cy+8),(cx+dx-1,cy+10)],'s',None)
            a.line([(cx-18,cy-5),(cx-16,cy-7),(cx-12,cy-6)],'l')
            a.poly([(cx-20,cy+7),(cx-26,cy+12),(cx-20,cy+10)],'h')
    a.poly([(cx-7,cy-7),(cx-3,cy-11),(cx+4,cy-10),(cx+9,cy-4),(cx+8,cy+6),(cx+1,cy+9),(cx-7,cy+5)],'b')
    a.poly([(cx-5,cy-6),(cx-1,cy-8),(cx+3,cy-7),(cx+5,cy-2),(cx,cy),(cx-5,cy-2)],'l',None)
    hx=cx+11+HEAD[n]//2;hy=cy-2
    a.oval(hx,hy,7,6,'s');a.oval(hx+3,hy-1,3,4,'a');a.eye(hx+4,hy-2,True)
    a.poly([(hx+4,hy+3),(hx+8,hy+4),(hx+9,hy+7),(hx+5,hy+6)],'h')
    for dx in (-1,3):a.line([(hx+dx,hy-4),(hx+dx+2,hy-10),(hx+dx+5,hy-10)],'o');a.dot(hx+dx+5,hy-10,'a')

def mantis(a,kind):
    n=a.n;dead=n==8;cx=28+LEAN[n];cy=38+BOB[n]
    if dead:cx,cy=25,54
    # Hooked abdomen is deliberately unlike ants/beetles; long tibiae plant backward.
    a.poly([(cx-5,cy-1),(cx-14,cy-5),(cx-21,cy-3),(cx-24,cy+2),(cx-18,cy+8),(cx-10,cy+10),(cx-5,cy+5)],'b')
    a.poly([(cx-19,cy-2),(cx-13,cy-3),(cx-6,cy+1),(cx-11,cy+3),(cx-17,cy+3)],'l',None)
    for dx in (-19,-14,-9):a.line([(cx+dx,cy),(cx+dx-1,cy+6)],'s')
    for far in (True,False):
        for i in range(2):
            x=cx-5+i*6;step=[0,1,-1,-2,3,5,1,-2,0][n]
            pts=[(x,cy+3),(x-9,cy+10),(x-8+step*(i*2-1),59),(x-4+step*(i*2-1),60)]
            if dead:pts=[(x,54),(x-5,48),(x-9,49)]
            segmented_leg(a,pts,far,2)
    hx=cx+10+HEAD[n]//2;hy=22+BOB[n]
    if dead:hx,hy=46,54
    a.tube([(cx,cy+3),(cx+7,cy-4),(hx-1,hy+3)],5)
    a.poly([(hx-7,hy-2),(hx-2,hy-6),(hx+6,hy-4),(hx+8,hy),(hx+3,hy+5),(hx-3,hy+6)],'b')
    a.poly([(hx-4,hy-2),(hx-1,hy-4),(hx+5,hy-2),(hx+2,hy+1)],'l',None)
    a.eye(hx+5,hy,True);a.eye(hx-3,hy+1)
    a.line([(hx-4,hy-4),(hx-9,hy-12),(hx-12,hy-12)],'o');a.line([(hx+3,hy-5),(hx+5,hy-13),(hx+9,hy-15)],'o')
    a.jaw(hx+2,hy+3,4)
    for far in (True,False):
        rx=hx-2 if far else hx+2;ry=hy+8
        if n==5:elbow=(50,30 if far else 39);tip=(59,43 if far else 54)
        elif n==3:elbow=(rx-3,ry+8);tip=(rx+3,ry-8)
        elif dead:elbow=(43,49);tip=(51,49)
        else:elbow=(rx+6,ry+9);tip=(rx+12,ry+1)
        a.tube([(rx,ry),elbow],3,far=far)
        ex,ey=elbow;tx,ty=tip
        a.poly([(ex-2,ey+2),(ex+3,ey+3),(tx+2,ty),(tx,ty-5),(tx-3,ty+1),(ex+1,ey-3)],'s' if far else 'a')
        if not far:
            a.line([(ex+2,ey+1),(tx+1,ty-1)],'w');
            for j in range(3):a.poly([(ex+1+j*2,ey-j*3),(ex-2+j*2,ey-j*3-2),(ex+3+j*2,ey-j*3-2)],'h')
    if kind=='blade':
        a.poly([(cx-16,cy-3),(cx-10,cy-12),(cx+1,cy-8),(cx+3,cy-2),(cx-6,cy)],'a');a.line([(cx-13,cy-4),(cx-7,cy-8),(cx,cy-4)],'w')


def beetle_ant(a,kind):
    n=a.n;dead=n==8;cx=28+LEAN[n]//2;cy=40+BOB[n]
    if dead:cx,cy=27,53
    for far in (True,False):
        for i in range(3):
            x=cx-7+i*7;dy=0 if far else 3;step=[0,1,-1,-3,3,4,1,-2,0][n]*(1 if i==2 else -1)
            pts=[(x,cy+dy),(x-7+i*6,cy+10),(x-11+i*10+step,60)]
            if dead:pts=[(x,53),(x-4+i*3,46),(x-2+i*4,43)]
            segmented_leg(a,pts,far,3 if kind=='beetle' else 2)
        if far:
            if kind=='beetle':
                a.poly([(cx-17,cy),(cx-14,cy-11),(cx-7,cy-17),(cx+2,cy-16),(cx+10,cy-9),(cx+11,cy+2),(cx+4,cy+11),(cx-8,cy+11),(cx-15,cy+6)],'b')
                a.poly([(cx-13,cy-2),(cx-11,cy-10),(cx-5,cy-13),(cx+1,cy-12),(cx+2,cy-4),(cx-6,cy+3),(cx-11,cy+4)],'l',None)
                a.poly([(cx+3,cy-11),(cx+8,cy-7),(cx+9,cy+2),(cx+3,cy+9),(cx-3,cy+9),(cx+1,cy+2)],'s',None)
                a.line([(cx-3,cy-14),(cx-1,cy),(cx+1,cy+9)],'o');a.line([(cx-6,cy-12),(cx-4,cy-3)],'h')
                a.marks([(cx-11,cy-5),(cx-10,cy+2),(cx+5,cy-4),(cx+4,cy+3)],'a')
            else:
                a.poly([(cx-20,cy-2),(cx-18,cy-9),(cx-12,cy-12),(cx-5,cy-9),(cx-2,cy-2),(cx-5,cy+6),(cx-12,cy+9),(cx-19,cy+5)],'b')
                a.poly([(cx-17,cy-3),(cx-14,cy-9),(cx-9,cy-8),(cx-8,cy-2),(cx-13,cy+2)],'l',None)
                a.line([(cx-9,cy-7),(cx-8,cy+4)],'s');a.tube([(cx-2,cy),(cx+4,cy-1)],3)
    hx=cx+15+HEAD[n]//2;hy=cy-3
    a.poly([(hx-10,hy-4),(hx-4,hy-9),(hx+3,hy-7),(hx+8,hy-1),(hx+7,hy+6),(hx,hy+9),(hx-8,hy+5)],'b')
    a.poly([(hx-7,hy-3),(hx-3,hy-6),(hx+2,hy-5),(hx+4,hy),(hx-1,hy+2)],'l',None)
    a.eye(hx+4,hy-1,True)
    if kind=='beetle':
        a.horn([(hx+1,hy-6),(hx+4,hy-14),(hx+10,hy-18),(hx+9,hy-12),(hx+7,hy-9),(hx+5,hy-4)])
        a.horn([(hx-7,hy-5),(hx-9,hy-13),(hx-6,hy-17),(hx-4,hy-11),(hx-2,hy-7)])
    else:
        for dx in (-3,3):a.line([(hx+dx,hy-5),(hx+dx+2,hy-13),(hx+dx+8,hy-14)],'o',2);a.dot(hx+dx+8,hy-14,'a')
    bite=[1,2,1,5,2,0,3,1,0][n]
    for dx in (-2,3):a.poly([(hx+dx,hy+5),(hx+dx+5,hy+5),(hx+dx+6,hy+9+bite),(hx+dx+2,hy+11),(hx+dx+2,hy+8)],'h')


def centipede(a,kind):
    n=a.n;dead=n==8;fire=kind=='fire'
    centers=[]
    for i in range(8):
        x=8+i*5;wave=math.sin(i*.7+n*.5)*2
        y=44+wave+(BOB[n]//2)
        if fire:y=46-math.sin(i*.45)*14+wave
        if n==3:y+=i*.3-2
        if n==5:x+=i*.3;y+=i*.7-4
        if dead:y=55-((i%3)==0)
        centers.append((x,y))
    for far in (True,False):
        for i,(x,y) in enumerate(centers):
            step=(2 if n==4 and i%2 else -1 if n==4 else 0)
            pts=[(x,y+3),(x-3+(2 if far else 0),y+9),(x+2+step,59-i%2)]
            if dead:pts=[(x,54),(x-3,49),(x-1,47)]
            segmented_leg(a,pts,far,1 if far else 2)
        if far:
            for i,(x,y) in enumerate(centers):
                a.poly([(x-4,y-4),(x-2,y-7),(x+3,y-7),(x+5,y-2),(x+4,y+4),(x-2,y+5),(x-5,y+2)],'b')
                a.poly([(x-3,y-3),(x-1,y-5),(x+2,y-5),(x+3,y-1),(x-1,y)],'l',None)
                a.line([(x-3,y+2),(x+1,y+3),(x+4,y)],'s')
                if fire:a.poly([(x-2,y-6),(x,y-11),(x+2,y-6)],'a');a.dot(x,y-7,'w')
                else:a.poly([(x-3,y-4),(x-4,y-8),(x-1,y-6)],'a')
    x,y=centers[-1];hx=x+4+HEAD[n]//3;hy=y-3
    a.poly([(hx-5,hy-4),(hx+1,hy-7),(hx+7,hy-3),(hx+8,hy+3),(hx+3,hy+8),(hx-4,hy+5)],'b')
    a.poly([(hx-3,hy-3),(hx,hy-5),(hx+4,hy-2),(hx+1,hy+1)],'l',None);a.eye(hx+4,hy,True)
    for dy in (-2,3):a.poly([(hx+4,hy+dy+2),(hx+10,hy+dy),(hx+9,hy+dy+5),(hx+6,hy+dy+4)],'a')
    a.line([(hx-1,hy-5),(hx+1,hy-13),(hx+7,hy-14)],'o');a.line([(hx+4,hy-4),(hx+9,hy-8),(hx+12,hy-7)],'o')


def parasite(a):
    n=a.n;dead=n==8;cx=29+LEAN[n];cy=45+BOB[n]
    if dead:cx,cy=28,53
    # Invasive leech with segmented armored belly, four hooked graspers, sucker mouth.
    for far in (True,False):
        for i in range(3):
            x=cx-11+i*9;pts=[(x,cy+3),(x+3,cy+9),(x+8+(n==5)*3,58-i%2)]
            if dead:pts=[(x,54),(x+3,48),(x+7,47)]
            segmented_leg(a,pts,far,2)
        if far:
            a.poly([(cx-23,cy+6),(cx-20,cy-1),(cx-13,cy-11),(cx-3,cy-14),(cx+6,cy-11),(cx+14,cy-3),(cx+17,cy+5),(cx+11,cy+11),(cx-3,cy+12),(cx-17,cy+10)],'b')
            a.poly([(cx-18,cy+1),(cx-11,cy-9),(cx-2,cy-11),(cx+6,cy-8),(cx+7,cy-2),(cx-1,cy+1),(cx-13,cy+5)],'l',None)
            for i in range(6):
                x=cx-16+i*5;a.line([(x,cy-4-(3-abs(3-i))),(x+2,cy+5),(x,cy+9)],'s');a.dot(x+1,cy+4,'h')
    hx=cx+18+HEAD[n]//2;hy=cy
    a.oval(hx,hy,7,8,'a');a.oval(hx+2,hy+1,4,5,'k');a.oval(hx+2,hy+1,2,2,'r',None)
    if n in (3,5):a.oval(hx+2,hy+1,5,6,'k')
    for ang in range(0,360,45):
        x=hx+2+math.cos(math.radians(ang))*4;y=hy+1+math.sin(math.radians(ang))*5
        a.poly([(x-1,y-1),(x+1,y-1),(hx+2+(x-hx-2)*.55,hy+1+(y-hy-1)*.55)],'w',None)
    a.eye(hx-2,hy-7)

BATS={'bat':('bat','plain'),'bat-vampire':('vampire','vampire'),'bat-cave':('cavebat','cave')}
def bat(a,kind):
    n=a.n;dead=n==8;cx=32+LEAN[n]//2;cy=34+BOB[n];flap=[0,-7,7,-4,-10,12,2,8,0][n]
    if dead:cx,cy=33,53
    # Finger bones articulate independently; scallops are membrane boundaries.
    for far in (True,False):
        sign=-1 if far else 1;root=(cx+(0 if far else 3),cy-5)
        if dead:
            pts=[root,(cx+sign*14,47),(cx+sign*25,56),(cx+sign*17,59),(cx+sign*6,57),(cx,58)]
        else:
            tx=cx+sign*27;top=17+flap+(5 if far else 0)
            pts=[root,(cx+sign*9,cy-13),(cx+sign*16,top+1),(tx,top-3),(tx-sign*2,top+6),
                (cx+sign*24,cy+11-flap//2),(cx+sign*20,cy+5),(cx+sign*16,cy+7),
                (cx+sign*15,cy+15-flap//3),(cx+sign*11,cy+9),(cx+sign*7,cy+11),(cx+sign*5,cy+15),(cx,cy+10)]
        a.poly(pts,'s' if far else 'a')
        if not dead:
            a.poly([root,(cx+sign*13,top+5),(tx-sign*3,top+1),(cx+sign*23,cy+7-flap//2),(cx+sign*18,cy+2),(cx+sign*13,cy+4),(cx+sign*7,cy+9)],'r' if kind=='vampire' else 'b',None)
            for tip in (pts[3],pts[5],pts[8],pts[11]):a.line([root,(cx+sign*12,cy-8),tip],'o');a.line([(root[0]+sign,root[1]),(cx+sign*12,cy-9)],'l')
            a.horn([(cx+sign*9,cy-13),(cx+sign*12,cy-18),(cx+sign*13,cy-12)])
            if kind=='vampire':a.poly([(cx+sign*16,cy+7),(cx+sign*17,cy+12),(cx+sign*19,cy+15),(cx+sign*16,cy+15)],'a')
        else:a.line([root,pts[2],pts[4]],'l')
    a.poly([(cx-5,cy-7),(cx-3,cy-11),(cx+4,cy-10),(cx+8,cy-3),(cx+7,cy+10),(cx+2,cy+15),(cx-4,cy+10),(cx-6,cy)],'b')
    a.poly([(cx-3,cy-5),(cx+1,cy-7),(cx+4,cy-3),(cx+4,cy+5),(cx,cy+8),(cx-3,cy+3)],'l',None)
    a.poly([(cx,cy+8),(cx+5,cy+5),(cx+6,cy+10),(cx+2,cy+13)],'s',None)
    if not dead:
        for dx in (-2,4):
            kick=7 if n==5 else -2 if n==3 else 0
            a.tube([(cx+dx,cy+10),(cx+dx-2+kick//2,cy+15),(cx+dx+2+kick,cy+18)],2)
            a.line([(cx+dx+2+kick,cy+17),(cx+dx+5+kick,cy+17),(cx+dx+4+kick,cy+19)],'h')
    hx=cx+4+HEAD[n]//2;hy=cy-12
    if dead:hx,hy=46,53
    a.poly([(hx-8,hy-1),(hx-5,hy-7),(hx+2,hy-8),(hx+7,hy-2),(hx+10,hy+3),(hx+6,hy+8),(hx-3,hy+7),(hx-8,hy+3)],'b')
    a.poly([(hx-5,hy-2),(hx-2,hy-5),(hx+2,hy-5),(hx+5,hy-1),(hx,hy+1)],'l',None)
    for dx,dy in [(-6,-13),(-1,-17 if kind=='cave' else -13)]:
        a.poly([(hx+dx-2,hy-4),(hx+dx-2,hy+dy),(hx+dx+4,hy+dy+4),(hx+dx+3,hy-3)],'b')
        a.poly([(hx+dx-1,hy-7),(hx+dx-1,hy+dy+3),(hx+dx+2,hy+dy+5),(hx+dx+1,hy-5)],'r',None)
    a.eye(hx+3,hy,True);a.box(hx+7,hy+3,3,2,'o');a.jaw(hx+1,hy+4,8, fanged=kind=='vampire')
    if kind=='cave':a.poly([(hx-7,hy+3),(hx-9,hy+8),(hx-3,hy+6)],'h')

SERPENTS={'snake-viper':('viper','viper'),'snake-01':('snake','cobra'),'worm-sand':('worm','worm'),'eel-electric':('eel','eel')}
def serpentine(a,kind):
    n=a.n;dead=n==8;lean=LEAN[n];bob=BOB[n]
    if kind=='worm':return worm(a)
    if kind=='eel':return eel(a)
    # Three coiled bands support a lifting neck. Hood changes silhouette, not just hue.
    cy=51+bob//2
    a.poly([(5,55),(8,47),(18,42),(28,42),(38,48),(39,54),(31,59),(13,60),(6,58)],'b')
    a.poly([(8,51),(15,46),(25,45),(31,48),(24,50),(14,51)],'l',None)
    a.line([(10,56),(20,54),(30,55),(34,52)],'s',2)
    a.poly([(15,54),(17,47),(25,43),(34,45),(42,50),(45,56),(40,59),(31,60),(23,58)],'b')
    a.poly([(19,49),(26,46),(33,47),(37,50),(31,51),(24,52)],'l',None)
    a.line([(23,56),(32,54),(39,55)],'s',2)
    a.tube([(8,55),(4,52),(3,48)],2)
    hx=44+HEAD[n];hy=(24 if kind=='cobra' else 28)+bob
    if n==3:hy+=3;hx-=1
    if n==5:hx=50;hy=38
    if dead:hx,hy=49,53
    neck=[(35,55),(35,44),(37,35),(hx-3,hy+6)] if not dead else [(35,56),(41,52),(48,53)]
    if kind=='cobra' and not dead:
        a.poly([(37,47),(30,39),(31,27+bob),(37,20+bob),(45,20+bob),(51,26+bob),(52,39),(45,49)],'b')
        a.poly([(35,38),(34,28+bob),(38,24+bob),(40,30),(41,43)],'l',None)
        a.poly([(45,24+bob),(49,28+bob),(49,37),(45,42)],'s',None)
        a.line([(35,27+bob),(36,34),(39,37)],'a',2);a.line([(47,27+bob),(47,33),(44,37)],'a',2)
    a.tube(neck,8)
    if dead:
        a.poly([(34,56),(38,53),(44,52),(48,54),(49,56),(43,56),(39,57)],'h')
        for x in (37,41,45):a.line([(x,54),(x+1,56)],'s')
    else:
        a.poly([(35,55),(34,49),(35,42),(38,35),(hx,hy+5),(hx+3,hy+7),(40,40),(39,49),(39,55)],'h')
        for i in range(5):a.line([(35+i*.8,51-i*4),(39+i*.8,51-i*4)],'s')
    a.poly([(hx-8,hy-2),(hx-3,hy-7),(hx+5,hy-5),(hx+11,hy),(hx+12,hy+5),(hx+7,hy+8),(hx-2,hy+9),(hx-7,hy+5)],'b')
    a.poly([(hx-5,hy-1),(hx-1,hy-4),(hx+4,hy-3),(hx+7,hy),(hx+1,hy+2)],'l',None)
    a.eye(hx+6,hy+1,True);a.jaw(hx+2,hy+5,9)
    if n==5:a.poly([(hx+3,hy+5),(hx+6,hy+5),(hx+5,hy+10)],'w')
    if n not in (7,8):a.line([(hx+10,hy+7),(hx+15,hy+8),(hx+17,hy+6)],'r');a.line([(hx+15,hy+8),(hx+17,hy+10)],'r')
    for x,y in [(13,47),(21,45),(27,48),(23,50),(34,49),(30,46)]:
        if kind=='viper':a.poly([(x-2,y),(x,y-2),(x+3,y),(x+1,y+2)],'a',None)
        else:a.marks([(x,y)],'s')


def worm(a):
    n=a.n;dead=n==8;cx=31+LEAN[n];cy=44+BOB[n]
    if dead:
        for i in range(6):
            x=8+i*7;y=56-i//2
            a.poly([(x-4,y-2),(x-3,y-5),(x+2,y-6),(x+6,y-2),(x+6,y+3),(x+1,60),(x-4,y+3)],'b')
            a.line([(x-2,y-3),(x+2,y-4),(x+4,y-1)],'l',2)
            a.line([(x+4,y),(x+3,y+4)],'s')
        a.oval(51,54,9,6,'a');a.oval(53,55,6,4,'k')
        for x,y in [(49,53),(53,52),(57,54),(54,57),(50,57)]:a.poly([(x-1,y),(x+1,y),(53,55)],'h',None)
        return
    # Segments widen toward the gaping four-lobed sandworm crown.
    centers=[(9,55,4),(17,52,6),(24,47,7),(29,39,8),(32,30,9),(37+HEAD[n]//2,24+BOB[n],11)]
    if n==3:centers=[(x-2,y+2,rad) for x,y,rad in centers]
    if n==5:centers=[(9,55,4),(18,54,6),(28,51,7),(37,44,8),(43,38,9),(49,33,11)]
    if dead:centers=[(8,56,4),(16,56,6),(25,55,7),(35,55,8),(44,53,8),(51,53,9)]
    for i,(x,y,r) in enumerate(centers):
        a.poly([(x-r,y-3),(x-r+3,y-r+2),(x+2,y-r),(x+r,y-3),(x+r,y+4),(x+3,y+r),(x-r+2,y+r-1)],'b')
        a.poly([(x-r+3,y-2),(x-r+5,y-r+3),(x+1,y-r+2),(x+4,y-3),(x-1,y)],'l',None)
        a.line([(x-r+2,y+4),(x,y+5),(x+r-1,y+2)],'s',2)
        a.line([(x-r+3,y+5),(x-1,y+6)],'a')
        if i<5:a.poly([(x-r+2,y-3),(x-r-2,y-6),(x-r-1,y),(x-r+2,y+2)],'a')
    x,y,r=centers[-1];op=[6,7,5,4,7,10,6,3,3][n]
    a.poly([(x-7,y-5),(x-2,y-10),(x+5,y-8),(x+10,y-2),(x+9,y+6),(x+2,y+10),(x-6,y+7),(x-10,y)],'a')
    a.oval(x+1,y+1,op//2+2,op,'k');a.oval(x+2,y+3,max(1,op//3),max(1,op//2),'r',None)
    for dx,dy in [(-5,-5),(1,-7),(6,-3),(6,4),(0,7),(-5,4)]:
        a.poly([(x+dx-1,y+dy-1),(x+dx+2,y+dy),(x+dx*.5,y+dy*.5+1)],'w')
    a.line([(x-7,y-4),(x-3,y-8)],'h');a.line([(x-7,y+5),(x-2,y+8)],'h')


def eel(a):
    n=a.n;dead=n==8;wave=[0,2,-2,-4,3,6,1,-3,0][n]
    pts=[(6,41),(8,32),(17,29),(25,35),(26,45),(22,49),(16,46),(16,39),(23,35),(33,36),(41,30),(48,27)]
    if n==5:pts=[(6,43),(10,36),(19,35),(25,41),(25,50),(18,51),(14,44),(20,38),(31,39),(42,37),(50,37)]
    elif dead:pts=[(5,57),(10,52),(19,51),(25,55),(24,58),(16,58),(16,54),(29,53),(39,55),(51,53)]
    else:pts=[(x,y+math.sin(i*.6)*wave) for i,(x,y) in enumerate(pts)]
    # A dorsal ribbon follows the same spine with serrated sparks.
    for i in range(len(pts)-1):
        x,y=pts[i];nx,ny=pts[i+1]
        a.poly([(x,y-2),(x-1,y-7),(x+3,y-5),(nx,ny-5),(nx,ny-2)],'a')
    a.tube(pts,6)
    for i,(x,y) in enumerate(pts[1:-1]):
        a.line([(x-1,y+1),(x+2,y+3)],'s');
        if i%2==0:a.poly([(x-2,y-2),(x+2,y-2),(x,y),(x+3,y+1)],'a',None)
    hx,hy=pts[-1];hx+=3
    a.poly([(hx-5,hy-5),(hx+2,hy-7),(hx+10,hy-2),(hx+11,hy+4),(hx+6,hy+8),(hx-3,hy+7)],'b')
    a.poly([(hx-3,hy-3),(hx+2,hy-4),(hx+7,hy-1),(hx+1,hy+1)],'l',None)
    a.poly([(hx-2,hy+4),(hx+8,hy+1),(hx+9,hy+5),(hx+4,hy+7)],'h',None)
    a.eye(hx+5,hy,True);a.jaw(hx+2,hy+4,8)
    a.poly([(hx-4,hy+1),(hx-9,hy+6),(hx-3,hy+6)],'a')
    if n in (3,5):
        for x,y in [(12,24),(33,23),(54,17)]:a.line([(x,y+6),(x+2,y),(x+5,y+2),(x+7,y-3)],'a');a.dot(x+2,y,'w')

BIRDS={'bird-hawk':('bird','hawk'),'cockatrice-01':('cockatrice','cockatrice')}
def feather_wing(a,root,tip,spread,far=False):
    x,y=root;tx,ty=tip
    a.poly([(x-4,y+4),(x-5,y-2),(x+1,y-5),(tx-6,ty),(tx,ty-3),(tx+3,ty+2),(tx-2,ty+6),(tx-5,ty+7),(tx-6,ty+11),(tx-10,ty+10),(tx-12,ty+14),(x+8,y+8)],'s' if far else 'b')
    if not far:
        a.poly([(x-2,y),(x+3,y-3),(tx-5,ty+2),(tx-7,ty+6),(x+7,y+5)],'l',None)
        for j in range(4):a.line([(x+5+j*2,y+3),(tx-4-j*3,ty+6+j*2)],'s');a.line([(tx-5-j*3,ty+5+j*2),(tx-4-j*3,ty+6+j*2)],'h')
    a.line([(x,y-2),(tx-6,ty+2),(tx,ty)],'l' if not far else 'b')

def bird(a,kind):
    n=a.n;dead=n==8;ground=kind=='cockatrice';cx=29+LEAN[n]//2;cy=(37 if ground else 33)+BOB[n]
    if dead:cx,cy=27,53
    # Cockatrice coils a barbed reptilian tail; hawk's tail fans into flight feathers.
    if ground:
        tail=[(cx-9,cy+2),(14,43),(8,40),(5,33),(8,26),(13,25),(16,28),(14,33),(11,32)] if not dead else [(17,55),(10,54),(5,57),(9,59),(14,57)]
        a.tube(tail,4)
        for i,(x,y) in enumerate(tail[1:-1]):a.poly([(x,y-1),(x-2,y-5),(x+3,y-1)],'a')
    else:
        a.poly([(cx-5,cy+2),(cx-23,cy+9),(cx-22,cy+14),(cx-15,cy+12),(cx-16,cy+17),(cx-8,cy+13),(cx-7,cy+18),(cx+1,cy+9)],'b')
        for dx in (-18,-12,-6):a.line([(cx-3,cy+5),(cx+dx,cy+12)],'s');a.line([(cx+dx-1,cy+11),(cx+dx+2,cy+12)],'h')
    if not dead:
        flap=[0,-9,6,-5,-11,4,2,8,0][n]
        if ground:feather_wing(a,(cx+1,cy-4),(cx+5,cy-12-flap//2),0,True)
        else:feather_wing(a,(cx+1,cy-5),(cx-18,max(5,10+flap)),0,True)
    for far in (True,False):
        if ground:
            x=cx+(6 if far else -2);step=[0,0,1,-3,4,3,1,-1,0][n]*(1 if far else -1)
            pts=[(x,cy+8),(x+3,cy+15),(x+2+step,58)] if not dead else [(x,55),(x+3,50),(x+8,48)]
        else:
            x=cx+(5 if far else -1);pts=[(x,cy+7),(x+3,cy+14),(x+8+(n==5)*5,cy+13-(n==5)*3)] if not dead else [(x,55),(x+2,51),(x+7,49)]
        a.tube(pts,2,'a',far=far)
        fx,fy=pts[-1]
        for dx in (-1,3,5):a.line([(fx,fy),(fx+dx,fy+2)],'a');a.dot(fx+dx,fy+2,'h')
    a.poly([(cx-11,cy-1),(cx-8,cy-8),(cx-2,cy-11),(cx+8,cy-9),(cx+14,cy-2),(cx+12,cy+6),(cx+5,cy+11),(cx-5,cy+9),(cx-11,cy+4)],'b')
    a.poly([(cx+6,cy-7),(cx+10,cy-3),(cx+9,cy+4),(cx+4,cy+8),(cx-2,cy+6),(cx,cy)],'h',None)
    a.poly([(cx-8,cy-3),(cx-4,cy-8),(cx+4,cy-6),(cx+3,cy-2),(cx-3,cy)],'l',None)
    if not dead:
        if ground:feather_wing(a,(cx-3,cy),(cx-12,cy+1),0)
        else:feather_wing(a,(cx+3,cy-1),(cx+24,15-flap//2),0)
    else:feather_wing(a,(cx-2,cy),(cx-14,51),0)
    hx=cx+15+HEAD[n]//2;hy=cy-12
    if dead:hx,hy=47,53
    a.poly([(cx+8,cy-3),(hx-7,hy-3),(hx+2,hy-5),(hx+5,hy+1),(hx+3,hy+7),(cx+11,cy+5)],'b')
    a.poly([(hx-5,hy-2),(hx-1,hy-6),(hx+5,hy-5),(hx+8,hy),(hx+6,hy+6),(hx-1,hy+7),(hx-6,hy+3)],'b')
    a.poly([(hx-3,hy-2),(hx+2,hy-3),(hx+5,hy-1),(hx+2,hy+2)],'l',None)
    a.eye(hx+5,hy,True);a.poly([(hx+7,hy+1),(hx+13,hy+3),(hx+13,hy+6),(hx+10,hy+9),(hx+9,hy+5),(hx+5,hy+5)],'a');a.line([(hx+8,hy+2),(hx+11,hy+4)],'w')
    if ground:
        a.poly([(hx-6,hy-4),(hx-6,hy-10),(hx-2,hy-8),(hx+1,hy-12),(hx+3,hy-8),(hx+7,hy-8),(hx+5,hy-3)],'a')
        a.poly([(hx+1,hy+6),(hx+3,hy+12),(hx+7,hy+10),(hx+7,hy+6)],'a');a.dot(hx+3,hy+8,'q')
        for x,y in [(cx-6,cy+5),(cx+3,cy+7)]:a.marks([(x,y)],'s')
    else:a.line([(hx-5,hy-3),(hx-1,hy-3),(hx+4,hy-1)],'s',2)

AQUATIC={'fish-01':('fish','fish'),'fish-piranha':('piranha','piranha'),'shark-land':('shark','shark'),'squid-deep':('squid','squid')}
def fish(a,kind):
    n=a.n;dead=n==8;piranha=kind=='piranha';cx=32+LEAN[n]//2;cy=34+BOB[n]
    if dead:cx,cy=32,53;a.fallen_plane=(53,.4)
    wave=[0,2,-2,-4,3,5,2,-3,0][n]
    # Fan tail and angular dorsal/anal fins articulate away from the trunk.
    a.poly([(cx-14,cy-3),(cx-25,cy-12+wave),(cx-23,cy-1),(cx-26,cy+9+wave),(cx-15,cy+5)],'a')
    a.line([(cx-16,cy),(cx-23,cy-7+wave)],'h');a.line([(cx-16,cy+2),(cx-24,cy+6+wave)],'s')
    a.poly([(cx-9,cy-8),(cx-6,cy-17),(cx,cy-20 if piranha else cy-16),(cx+4,cy-15),(cx+8,cy-7)],'a')
    for dx in (-5,0,4):a.line([(cx+dx,cy-9),(cx+dx-1,cy-14)],'s')
    a.poly([(cx-7,cy+7),(cx-7,cy+15),(cx+3,cy+12),(cx+7,cy+7)],'a')
    body=[(cx-17,cy-2),(cx-12,cy-9),(cx-3,cy-13),(cx+9,cy-10),(cx+17,cy-4),(cx+23,cy-2),(cx+25,cy+3),(cx+22,cy+9),(cx+11,cy+13),(cx-2,cy+12),(cx-12,cy+7)]
    if piranha:body=[(cx-15,cy-1),(cx-11,cy-12),(cx-2,cy-17),(cx+8,cy-14),(cx+15,cy-7),(cx+22,cy-4),(cx+24,cy+5),(cx+21,cy+13),(cx+10,cy+17),(cx-1,cy+15),(cx-12,cy+8)]
    a.poly(body,'b');a.poly([(cx-12,cy-4),(cx-7,cy-9),(cx+1,cy-10),(cx+10,cy-7),(cx+12,cy-2),(cx+3,cy),(cx-7,cy)],'l',None)
    a.poly([(cx-11,cy+4),(cx+2,cy+3),(cx+14,cy+2),(cx+22,cy+5),(cx+17,cy+9),(cx+8,cy+11),(cx-3,cy+10)],'h',None)
    a.line([(cx+10,cy-7),(cx+7,cy-1),(cx+8,cy+5),(cx+11,cy+9)],'s',2)
    a.line([(cx+13,cy-6),(cx+11,cy),(cx+13,cy+6)],'s')
    a.eye(cx+16,cy-3,True);a.jaw(cx+15 if piranha else cx+16,cy+3,9 if piranha else 8,op=([3,4,3,2,4,7,3,1,1][n] if piranha else 0))
    if piranha:
        for dx in (16,19,22):a.poly([(cx+dx,cy+3),(cx+dx+2,cy+3),(cx+dx+1,cy+6)],'w',None)
    finx=cx+1;finy=cy+2
    a.poly([(finx,finy),(finx+8,finy+3),(finx+2,finy+11+wave//2),(finx-3,finy+7)],'a');a.line([(finx+1,finy+3),(finx+3,finy+7)],'h')
    for i in range(3):
        for j in range(3-i):a.marks([(cx-9+j*5+i*2,cy-2+i*3)],'s')
    if dead:
        a.poly([(cx-2,cy+12),(cx+10,cy+15),(cx+5,cy+18),(cx-3,cy+16)],'h')
    if piranha:
        a.poly([(cx+19,cy-8),(cx+16,cy-8),(cx+15,cy-5),(cx+20,cy-4)],'s',None)
        a.poly([(cx+10,cy+11),(cx+21,cy+8),(cx+22,cy+13),(cx+13,cy+16)],'a',None)
        for dx in (-9,-3,3):a.poly([(cx+dx,cy-12),(cx+dx+1,cy-20),(cx+dx+4,cy-14)],'a')


def shark(a):
    n=a.n;dead=n==8;cx=29+LEAN[n]//2;cy=38+BOB[n]
    if dead:cx,cy=28,52
    # Land shark is a muscular hexapedal predator, rather than a floating fish recolor.
    a.poly([(cx-16,cy),(cx-24,cy-13),(cx-25,cy-3),(cx-22,cy+2),(cx-26,cy+13),(cx-18,cy+6)],'b')
    a.line([(cx-18,cy+1),(cx-22,cy-7)],'l')
    for far in (True,False):
        for i in range(3):
            x=cx-12+i*10;step=[0,0,1,-3,4,4,1,-2,0][n]*(-1 if i==0 else 1)
            pts=[(x,cy+5),(x+2,cy+13),(x+step+5,58)] if not dead else [(x,53),(x-2,49),(x+3,47)]
            a.tube(pts,4,far=far);fx,fy=pts[-1]
            a.poly([(fx-2,fy-1),(fx+4,fy-1),(fx+5,fy+2),(fx-3,fy+2)],'s' if far else 'b')
            if not far:
                for dx in (1,3,5):a.dot(fx+dx,fy+1,'h')
        if far:
            a.poly([(cx-5,cy-7),(cx-2,cy-22),(cx+5,cy-17),(cx+10,cy-6)],'b')
            a.poly([(cx-1,cy-16),(cx+2,cy-16),(cx+6,cy-8),(cx,cy-8)],'l',None)
            a.poly([(cx-16,cy-1),(cx-12,cy-9),(cx-4,cy-12),(cx+11,cy-9),(cx+19,cy-4),(cx+28,cy-1),(cx+30,cy+4),(cx+25,cy+11),(cx+13,cy+15),(cx-4,cy+10),(cx-13,cy+5)],'b')
            a.poly([(cx-12,cy-2),(cx-8,cy-7),(cx,cy-10),(cx+11,cy-6),(cx+20,cy-2),(cx+12,cy+1),(cx-1,cy)],'l',None)
            a.poly([(cx-8,cy+5),(cx+7,cy+4),(cx+21,cy+2),(cx+27,cy+5),(cx+24,cy+9),(cx+12,cy+12),(cx-1,cy+8)],'h',None)
    for dx in (3,7,11):a.line([(cx+dx,cy-6),(cx+dx-1,cy-1),(cx+dx+1,cy+5)],'s')
    a.eye(cx+22,cy-1,True);a.jaw(cx+16,cy+5,13)
    a.poly([(cx-1,cy+1),(cx+5,cy+3),(cx+9,cy+12),(cx+2,cy+10),(cx-4,cy+4)],'b');a.line([(cx,cy+3),(cx+4,cy+7)],'l')


def squid(a):
    n=a.n;dead=n==8;cx=31+LEAN[n]//2;cy=32+BOB[n];wave=[0,2,-2,-4,3,5,2,-3,0][n]
    if dead:cx,cy=29,51
    if dead:
        for i in range(8):
            sx=32+i*1.5;sy=55+i%2
            a.tube([(sx,sy),(42+i*1.8,54+i%3),(55-i%3*2,58),(51-i%2*4,60)],2,'s' if i%2==0 else 'b',far=i%2==0)
            a.dot(49+i%3*3,58,'h')
        a.poly([(13,58),(14,51),(19,47),(29,46),(36,49),(40,54),(38,59),(28,60),(19,59)],'b')
        a.poly([(16,53),(20,49),(28,48),(33,50),(31,53),(22,54)],'l',None)
        a.poly([(16,56),(24,55),(34,56),(37,58),(27,59),(19,58)],'s',None)
        a.oval(35,54,4,4,'h');a.eye(36,54,True)
        a.poly([(15,53),(7,55),(6,59),(15,58)],'a')
        return
    # Eight arms rooted in a common skirt, each curling at a different depth.
    for i in range(8):
        rx=cx-8+i*2.5;ry=cy+9
        side=-1 if i<4 else 1;spread=(4-abs(3.5-i))*2
        tipx=rx+side*(9+abs(3.5-i)*2)+wave*(1 if i%2 else -1)
        tipy=53+(i%3)*3
        pts=[(rx,ry),(rx+side*5,ry+11),(tipx,tipy),(tipx-side*3,tipy+3),(tipx-side*5,tipy+1)]
        if n==5 and i>4:pts=[(rx,ry),(rx+8,ry+3),(min(61,rx+16),ry+2),(min(59,rx+16),ry-3)]
        if dead:pts=[(rx,54),(rx+side*8,58),(tipx,56),(tipx-side*3,53)]
        a.tube(pts,3,'s' if i%2==0 else 'b',far=i%2==0)
        if i%2:
            for x,y in pts[1:3]:a.dot(x,y+1,'h');a.dot(x+side*2,y+1,'a')
    top=10+BOB[n]
    if dead:top=44
    a.poly([(cx-12,cy+7),(cx-12,cy-4),(cx-8,top+4),(cx-1,top),(cx+6,top+2),(cx+11,top+10),(cx+13,cy+5),(cx+8,cy+13),(cx-6,cy+13)],'b')
    a.poly([(cx-9,cy-1),(cx-6,top+5),(cx-1,top+3),(cx+4,top+5),(cx+3,cy-1),(cx-2,cy+4),(cx-8,cy+3)],'l',None)
    a.poly([(cx+5,top+7),(cx+9,top+11),(cx+11,cy+4),(cx+6,cy+9),(cx+2,cy+7)],'s',None)
    if not dead:
        a.poly([(cx-10,cy-7),(cx-19,cy-1),(cx-17,cy+6),(cx-11,cy+4)],'a');a.line([(cx-15,cy),(cx-12,cy+1)],'h')
        a.poly([(cx+10,cy-7),(cx+18,cy-1),(cx+17,cy+6),(cx+11,cy+4)],'a');a.line([(cx+12,cy),(cx+16,cy+2)],'h')
    a.oval(cx+6,cy+5,5,5,'h');a.oval(cx+7,cy+5,3,3,'o');a.eye(cx+7,cy+4,True)
    a.oval(cx-5,cy+6,3,3,'s');a.eye(cx-4,cy+5)
    a.poly([(cx+1,cy+10),(cx+5,cy+12),(cx+2,cy+16),(cx-1,cy+12)],'k');a.dot(cx+2,cy+11,'h')


def ape(a):
    n=a.n;dead=n==8;cx=30+LEAN[n]//2;cy=37+BOB[n]
    if dead:cx,cy=27,52
    for far in (True,False):
        x=cx+(9 if far else -7);y=cy+10
        pts=[(x,y),(x-2,54),(x+3+(n==4)*3,59)] if not dead else [(x,54),(x-5,51),(x-9,54)]
        a.tube(pts,6,far=far);fx,fy=pts[-1];a.poly([(fx-4,fy-3),(fx+6,fy-3),(fx+7,fy+1),(fx-5,fy+1)],'s' if far else 'b');a.line([(fx+1,fy-1),(fx+1,fy+1)],'o')
        armx=cx+(8 if far else -11);army=cy-4
        elbow=(armx+(7 if far else -5),cy+6)
        hand=(armx+(12 if far else -8),56)
        if n==3 and not far:elbow=(cx-17,cy-10);hand=(cx-10,cy-17)
        if n==5 and not far:elbow=(cx+12,cy-3);hand=(cx+27,cy-1)
        if dead:elbow=(armx-5,54);hand=(armx-12,56)
        a.tube([(armx,army),elbow,hand],7,far=far)
        hx,hy=hand;a.poly([(hx-5,hy-4),(hx+3,hy-5),(hx+6,hy),(hx+3,hy+4),(hx-4,hy+4)],'s' if far else 'b')
        if not far:
            a.line([(hx-3,hy-2),(hx+1,hy-3),(hx+3,hy)],'l');
            for dx in (-2,1,3):a.line([(hx+dx,hy+1),(hx+dx,hy+3)],'o')
    a.poly([(cx-14,cy),(cx-13,cy-10),(cx-7,cy-16),(cx+3,cy-17),(cx+12,cy-10),(cx+15,cy+1),(cx+10,cy+11),(cx,cy+15),(cx-10,cy+10)],'b')
    a.poly([(cx-10,cy-8),(cx-5,cy-13),(cx+2,cy-13),(cx+8,cy-8),(cx+5,cy-4),(cx-3,cy-3)],'l',None)
    a.poly([(cx-8,cy),(cx,cy-3),(cx+8,cy),(cx+7,cy+8),(cx,cy+11),(cx-6,cy+6)],'a',None)
    a.line([(cx,cy-1),(cx,cy+7)],'s');a.line([(cx-7,cy+2),(cx-3,cy+3)],'s');a.line([(cx+3,cy+3),(cx+7,cy+2)],'s')
    for dx,dy in [(-10,-9),(5,-11),(-6,6),(8,6)]:
        a.poly([(cx+dx-2,cy+dy),(cx+dx,cy+dy-4),(cx+dx+4,cy+dy-2),(cx+dx+5,cy+dy+2),(cx+dx+1,cy+dy+3)],'v')
        a.line([(cx+dx,cy+dy-3),(cx+dx+3,cy+dy-1)],'h')
    if n==5:
        a.poly([(cx-10,cy-3),(cx-5,cy-7),(cx+4,cy-5),(cx+17,cy-1),(cx+23,cy),(cx+25,cy+5),(cx+20,cy+8),(cx+14,cy+5),(cx+1,cy+3),(cx-8,cy+5)],'b')
        a.poly([(cx-6,cy-4),(cx-3,cy-5),(cx+6,cy-2),(cx+17,cy+1),(cx+18,cy+3),(cx+7,cy+1),(cx-4,cy)],'l',None)
        a.line([(cx+18,cy+2),(cx+22,cy+3),(cx+24,cy+5)],'s')
        for dx in (18,21,23):a.line([(cx+dx,cy+4),(cx+dx,cy+7)],'o')
    hx=cx+5+HEAD[n]//2;hy=cy-18
    if dead:hx,hy=44,52
    a.poly([(hx-9,hy),(hx-8,hy-7),(hx-2,hy-11),(hx+5,hy-10),(hx+10,hy-4),(hx+9,hy+7),(hx+1,hy+10),(hx-7,hy+7)],'b')
    a.poly([(hx-7,hy-2),(hx-3,hy-5),(hx+5,hy-5),(hx+8,hy-1),(hx+4,hy+7),(hx-4,hy+6)],'a',None)
    a.line([(hx-5,hy-2),(hx-2,hy-3),(hx+2,hy-2),(hx+6,hy-3)],'o',2);a.eye(hx+5,hy);a.eye(hx-2,hy)
    a.box(hx+1,hy+2,4,2,'o');a.jaw(hx-1,hy+5,8)
    a.poly([(hx-3,hy-10),(hx-2,hy-15),(hx+4,hy-13),(hx+5,hy-9)],'v')


def draw(slug,pose,cell):
    n=POSES.index(pose)
    if slug in QUAD:
        key,kind,variant=QUAD[slug];a=Art(cell,key,n);mammal(a,kind,variant)
    elif slug in BUG:
        key,kind=BUG[slug];a=Art(cell,key,n)
        if kind in ('cave','tarantula','widow'):spider(a,kind)
        elif kind in ('rock','crab'):crab(a,kind)
        elif kind in ('sand','scorpion'):scorpion(a,kind)
        elif kind in ('blade','mantis'):mantis(a,kind)
        elif kind in ('bee','moth'):flying_insect(a,kind)
        elif kind in ('beetle','ant'):beetle_ant(a,kind)
        elif kind in ('centipede','fire'):centipede(a,kind)
        elif kind=='parasite':parasite(a)
    elif slug in BATS:
        key,kind=BATS[slug];a=Art(cell,key,n);bat(a,kind)
    elif slug in SERPENTS:
        key,kind=SERPENTS[slug];a=Art(cell,key,n);serpentine(a,kind)
    elif slug in BIRDS:
        key,kind=BIRDS[slug];a=Art(cell,key,n);bird(a,kind)
    elif slug in AQUATIC:
        key,kind=AQUATIC[slug];a=Art(cell,key,n)
        if kind in ('fish','piranha'):fish(a,kind)
        elif kind=='shark':shark(a)
        else:squid(a)
    elif slug=='ape-stone':a=Art(cell,'ape',n);ape(a)
    else:raise ValueError(slug)
    return a.c.im

# Earlier rejected anatomy remains below this module's historical helpers only.
# Every public draw/command now delegates to the canonical fresh source.
_rejected_draw = draw

def draw(slug, pose, cell=None):
    from registry import draw_entry
    return draw_entry(slug, pose)

if __name__ == '__main__':
    from registry import helper
    helper.run_group('organic', lambda slug, pose, cell: draw(slug, pose, cell))
