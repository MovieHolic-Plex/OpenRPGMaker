import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/hamlet/work')
from comp import *
M=dict(STD); M.update({'1':('mwood',4),'2':('mwood',3),'3':('mwood',1),'4':('mwood',0),'5':('mwood',5),'6':('mwood',2)})
def pier(cv,x0,x1,y,posts,joint=4):
    for x in range(x0,x1+1):
        cv[y][x]='4'
        cv[y+1][x]='5' if (x-x0)%joint else '6'
        cv[y+2][x]='2'
        cv[y+3][x]='3'
    for p in posts:
        for j in range(y+4,y+8):
            cv[j][p]='4'; cv[j][p+1]='3'
def walk(cv,x0,x1,y0,y1):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            cv[y][x]='4' if x in (x0,x1) else ('5' if (y%2) else '2')
def boat(cv,x,y,sail='W',big=1):
    rows=["...t.....","...tV....","...tVW...","...tVWW..","...tVWWY.","...tVWWYY","...tVWWYY","...t.....",".a4bbbbb4",".a4bbbb4."]
    rows=[r.ljust(9,'.') for r in rows]
    put(cv,x,y,rows)
def bigboat(cv,x,y):
    rows=["......t........",
          "......tVW......",
          ".....tVWWW.....",
          "....tVWWWWY....",
          "....tVWWWWYY...",
          "...tVWWWWWYY...",
          "...tVWWWWWYY...",
          "..tVWWWWWWYYY..",
          "..tVWWWWWWYYY..",
          "......t........",
          "..a44bbbbbb44..",
          "..a4bbbbbbbb4..",
          "...44bbbbbb4...",
          "....444444.....",]
    put(cv,x,y,[r.ljust(15,'.') for r in rows])
