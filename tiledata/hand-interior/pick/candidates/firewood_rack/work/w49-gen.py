import sys
W=int(sys.argv[1]); out=sys.argv[2]
H=32
g=[['.']*W for _ in range(H)]
def put(x,y,c):
    if 0<=x<W and 0<=y<H: g[y][x]=c
# rail top surface rows 2-5, front edge 6, front face 7-8, eave shadow 9-10
top=['A']*W
for x in range(W): put(x,2,'A')
for x in range(W):
    put(x,3,'P' if (x*7)%11 else 'B'); put(x,4,'B' if (x*5)%13 else 'E'); put(x,5,'B' if (x*3)%9 else 'P')
    put(x,6,'J'); put(x,7,'E'); put(x,8,'C'); put(x,9,'N'); put(x,10,'F')
# posts
for y in range(7,31):
    for x,c in ((0,'D'),(1,'E'),(2,'D')): put(x,y,c)
    for x,c in ((W-3,'D'),(W-2,'I'),(W-1,'D')): put(x,y,c)
# interior
for y in range(11,28):
    for x in range(3,W-3): put(x,y,'F' if (x+y)%3 else 'H')
LOG=[".GGG.","GJKKG","GKPKN","GLLLN",".NNN."]
LOG2=[".GGG.","GMJKG","GKLPN","GJLLN",".NNN."]
LOG3=[".GGG.","GJJKG","GKPLN","GKLLN",".NNN."]
LOGS=[LOG,LOG2,LOG3]
def log(x0,y0,v):
    for j,row in enumerate(LOGS[v%3]):
        for i,c in enumerate(row):
            if c!='.': put(x0+i,y0+j,c)
ys=[11,15,19,23]
n=0
for li,y0 in enumerate(ys):
    if li%2==0: xs=list(range(3,W-3,5))
    else: xs=list(range(0,W-3,5)); xs=[x+(2 if True else 0) for x in xs]; xs=[x-5+ (5-2) for x in xs]
    # staggered: shift by 2
    xs=[x for x in range(3-3,W-3,5)] if li%2 else list(range(3,W-3,5))
    if li%2: xs=[x+0 for x in range(0+0,W-3,5)]
    for x0 in xs:
        # keep circles' visible part inside interior only
        n+=1; log(x0 if li%2==0 else x0+0, y0, n+li)
# interior clip: restore posts over any overflow
for y in range(7,31):
    for x,c in ((0,'D'),(1,'E'),(2,'D')): put(x,y,c)
    for x,c in ((W-3,'D'),(W-2,'I'),(W-1,'D')): put(x,y,c)
# bottom plank
for x in range(W):
    put(x,28,'E'); put(x,29,'Q'); put(x,30,'I'); put(x,31,'D')
for x in range(W): put(x,28,'B' if 2<x<W-3 else 'E')
rows=[''.join(r) for r in g]
open(out,'w').write(f"// w49 firewood rack — 마구리 원이 엇갈려 쌓인 장작 더미 + 틀 윗판 윗면\n@size {W} {H}\n@cell 16\n@palette palette.pal\n@block 0 0\n"+'\n'.join(rows)+'\n')
