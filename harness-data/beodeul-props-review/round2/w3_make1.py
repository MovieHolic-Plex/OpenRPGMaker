import sys; sys.path.insert(0,'round2')
from w3_common import *
def P(im,x,y,c):
    if 0<=x<im.width and 0<=y<im.height: im.putpixel((x,y),c+(255,) if len(c)==3 else c)

# ---------- hanging sign ----------
o=load(R1+'existing-bd-out-hanging-sign.png')
n=Image.new('RGBA',(16,16),(0,0,0,0))
A=(53,54,58);B=(37,38,40);C=(62,64,61);D=(87,88,95)
# bracket: top outline, lit top face, front
for x in range(1,15):
    P(n,x,0,D)
    p=o.getpixel((x,1)); n.putpixel((x,1),p)
P(n,1,0,C);P(n,14,0,C)
for x in (3,12): P(n,x,2,D)
# sign
E=(41,25,15);F=(69,42,23);G=(162,110,54);H=(198,146,80);Jc=(94,58,28);L=(116,76,42);Ns=(236,192,74)
for x in range(2,14): P(n,x,3,E)
# top face thickness (2 rows lit)
for x in range(3,13):
    P(n,x,4,H); P(n,x,5,H if x not in (3,) else G)
P(n,2,4,E);P(n,13,4,E);P(n,2,5,E);P(n,13,5,E)
P(n,3,4,G);P(n,12,4,(162,110,54))
# orig rows 6..11 -> new rows 7..12 ; row 13 -> 13 ; row 14 -> 14
def copyrow(sy,dy):
    for x in range(16):
        p=o.getpixel((x,sy))
        if p[3]: n.putpixel((x,dy),p)
for sy in range(6,13): copyrow(sy,sy)
# first front row: make a darker separation under top face so it reads as a step
copyrow(13,13); copyrow(14,14)
# the dark line between top face and front: row 7 gets F in edge columns? keep orig. add subtle shade row
for x in range(4,12): 
    if n.getpixel((x,6))[:3]==Jc: n.putpixel((x,6),F+(255,))
n.save(R2+'out-hanging-sign.png'); compare(o,n,R2+'out-hanging-sign-compare.png')

# ---------- signpost ----------
o=load(R1+'existing-bd-out-signpost.png')
n=Image.new('RGBA',(16,32),(0,0,0,0))
D2=(42,26,15);Lh=(136,90,38);Mh=(111,71,37);Bk=(84,55,25);Hb=(111,71,37)
# copy original from row 11 down unchanged (lower post, board2 body etc.) later; build in order
for y in range(32):
    for x in range(16):
        p=o.getpixel((x,y))
        if p[3] and y>=18: n.putpixel((x,y),p)
# post lower part rows 11..17 copy except board rows
def cp(sy,dy,xs=range(16)):
    for x in xs:
        p=o.getpixel((x,sy))
        if p[3]: n.putpixel((x,dy),p)
# post top: rows 1..4
for x in (7,8): P(n,x,1,D2)
P(n,7,2,Lh);P(n,8,2,Mh);P(n,7,3,Lh);P(n,8,3,Mh)
cp(4,4);cp(5,5)  # post front (c d / e f)
# board1: orig rows 6..10 -> top outline row5, top face row 6, front rows 7..10
def board(top, x0,x1, orig_top):
    # outline far edge
    for x in range(x0,x1+1): P(n,x,top,D2)
    # top face lit
    for x in range(x0+1,x1):
        P(n,x,top+1,Lh if x<x1-3 else Hb)
    P(n,x0,top+1,D2);P(n,x1,top+1,D2)
board(5,2,12,6)
for sy,dy in zip(range(7,11),range(7,11)): cp(sy,dy)
# board front first row (row7) is original 'chhh..hc' ; fine
# post rows 11..12 (orig e f)
cp(11,11);cp(12,12)
# board2: orig 13..17 -> outline 12 (covered?) top face 13
board(12,3,13,13)
# board2 outline row 12 overwrote post at x7,8 -> restore as top outline fine
for sy in range(14,18): cp(sy,sy)
for sy in range(18,32): cp(sy,sy)
# fix: post rows between board1 bottom (10) and board2 top (12): row 11 post
n.save(R2+'out-signpost.png'); compare(o,n,R2+'out-signpost-compare.png')

# ---------- woodpile ----------
o=load(R1+'existing-bd-out-woodpile.png')
n=Image.new('RGBA',(32,32),(0,0,0,0))
O=(42,26,15);Bb=(69,42,23);L=(136,90,38);M=(111,71,37);E=(99,55,18)
def strip(x0,x1,yt,yb):
    w=x1-x0+1
    for y in range(yt,yb+1):
        for i in range(w):
            x=x0+i
            if y==yt:
                if 1<=i<=w-2: P(n,x,y,O)
                continue
            if i==0 or i==w-1: c=O
            elif y==yt+1 and (i==1 or i==w-2): c=O
            elif i==1: c=L
            elif i==w-2: c=E
            else: c=M if (y+i)%3 else L
            P(n,x,y,c)
# level3 outer, level2 outer, then top three (back to front)
LANES=[(8,13),(14,19),(20,25)]
for (a,bx) in LANES:
    # each log body: rounded far end, lit left, shaded right
    for y in range(12,17):
        for x in range(a,bx+1):
            k=x-a
            if y==12:
                if 1<=k<=4: P(n,x,y,O)
                continue
            if k==0 and y>=13: c=O if y==13 else Bb
            elif k==5: c=O
            elif y==13: c=L
            elif k==1: c=L
            elif k in (2,3): c=M if (x+y)%2 else L
            else: c=E
            if k==0 and y>=14: c=Bb
            P(n,x,y,c)
for y in range(13,17): P(n,7,y,O)
tmp=Image.new('RGBA',(32,32),(0,0,0,0)); tmp.paste(o,(0,16))
n.alpha_composite(tmp)
n.save(R2+'out-woodpile.png'); compare(o,n,R2+'out-woodpile-compare.png')

# ---------- gate-wood ----------
o=load(R1+'gate-wood.png'); fence=load(R1+'fence-wood-set.png')
n=Image.new('RGBA',(32,16),(0,0,0,0))
for y in range(16):
    for x in list(range(6,10))+list(range(22,26)):
        p=o.getpixel((x,y))
        if p[3]: n.putpixel((x,y),p)
a=(61,34,12);b=(113,77,41);c=(136,90,38);d=(84,55,25);e=(30,21,10)
def rail(y0,x0=10,x1=21):
    for x in range(x0,x1+1):
        P(n,x,y0,c); P(n,x,y0+1,b); P(n,x,y0+2,e)
rail(6);rail(10)
for x in range(11,21):
    yy=12-round((x-11)*(5/9))
    for dy,c2 in ((-1,c),(0,d),(1,e)):
        if 6<=yy+dy<=12: P(n,x,yy+dy,c2)
# posts rails continue: post front stays on top
for y in range(4,15):
    for x in list(range(6,10))+list(range(22,26)):
        p=o.getpixel((x,y))
        if p[3] and x in (9,22): n.putpixel((x,y),p)
n.save(R2+'gate-wood.png'); compare(o,n,R2+'gate-wood-compare.png')
