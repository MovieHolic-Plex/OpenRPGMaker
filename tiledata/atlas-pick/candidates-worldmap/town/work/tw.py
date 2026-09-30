import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/hamlet/work')
from comp import *
M=dict(STD); M.update({'E':('wdirt',0),'F':('wdirt',1),'e':('wdirt',2),'G':('wdirt',3),'D':('mwood',0),'A':('mwood',2)})
def rect(cv,x0,y0,x1,y1,ch):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): cv[y][x]=ch
def crenel(cv,x0,x1,y,step=4,w=2,h=2,body='U',top='X',ol='z'):
    """흉벽 톱니: y 줄부터 h 줄 높이, 폭 w 칸 이 step 마다"""
    for x in range(x0,x1+1):
        if (x-x0)%step<w:
            for j in range(h):
                cv[y+j][x]=top if j==0 else body
            cv[y][x]=top
    # 좌우 윤곽
    for x in range(x0,x1+1):
        if (x-x0)%step==0: 
            for j in range(h): cv[y+j][x]=ol if j>0 else ol
def wallface(cv,x0,x1,y0,y1,shade=False):
    """벽 앞면: 윗줄 밝은 선, 아래로 갈수록 어둡게, 벽돌 이음"""
    rect(cv,x0,y0,x1,y0,'Z')
    for y in range(y0+1,y1):
        for x in range(x0,x1+1):
            joint=((y-y0)%2==0) and ((x+(y//2)*2)%4==0)
            cv[y][x]='s' if joint else ('U' if y<y0+3 else 'S')
    rect(cv,x0,y1,x1,y1,'z')
def gate(cv,cx,y0,y1,w=4):
    x0=cx-w//2
    rect(cv,x0-1,y0,x0+w,y1,'z'); rect(cv,x0,y0+1,x0+w-1,y1,'D')
    cv[y0+1][x0]='z';cv[y0+1][x0+w-1]='z'
def tower(cv,x0,y0,w,h):
    crenel(cv,x0,x0+w-1,y0,step=3,w=2,h=2)
    wallface(cv,x0,x0+w-1,y0+2,y0+h-1)
    for y in range(y0+2,y0+h): cv[y][x0]='z' if cv[y][x0]!='Z' else 'z'; cv[y][x0+w-1]='z'
