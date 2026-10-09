import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/hamlet/work')
from comp import *
M=dict(STD); M.update({'o':('mwhite',0),'W':('mwhite',2),'V':('mwhite',4),'Y':('mwhite',1),'w':('mwhite',3),'F':('mwhite',5),
 'K':('mred',1),'R':('mred',3),'r':('mred',4),'q':('mred',1),'Q':('mred',2),
 'y':('wgold',3),'h':('wgold',4),'z':('wrock',0),'s':('wrock',1),'S':('wrock',2),'U':('wrock',3),'X':('wrock',4),'Z':('wrock',5),'C':('wrock',6),
 'G':('wgold',0),'H':('wgold',1),'D':('mwood',0),'g':('mglass',4),'A':('wroofr',0),'B':('wroofr',2),'N':('wroofr',3),'P':('wroofr',4),'T':('wroofr',1)})
def hw_at(y): return 3 if y<12 else 4 if y<18 else 5
def body_row(cv,y,band=None,shade=3):
    hw=hw_at(y); x0=8-hw; x1=8+hw-1
    for x in range(x0,x1+1):
        if x==x0 or x==x1: ch='K' if band else 'o'
        else:
            i=x-x0-1; n=x1-x0-1  # 0..n-1
            if band:
                ch='r' if i<max(1,n//3) else 'Q' if i>=n-max(1,n//3) else 'R'
                if i>=n-1: ch='q'
            else:
                ch='V' if i<max(1,n//3) else 'W' if i<n-max(1,n//3) else 'w' if False else 'Y' if i>=n-max(1,n//3) else 'W'
                if i==0: ch='F'
        cv[y][x]=ch
def rocks(cv,y0=24):
    for y in range(y0,32):
        hw=6 if y==24 else 7 if y==25 else 8
        for x in range(8-hw,8+hw):
            i=x-(8-hw)
            if y==y0: ch='z' if i in (0,2*hw-1) else 'Z'
            elif y==31: ch='z'
            else:
                ch='z' if i in (0,2*hw-1) else ('X' if (i+y)%5<2 else 'U' if (i+y)%5<4 else 'S')
                if i>=2*hw-4: ch='S' if (i+y)%3 else 's'
            cv[y][x]=ch
