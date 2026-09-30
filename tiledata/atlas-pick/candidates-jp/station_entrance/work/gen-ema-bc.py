import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
import importlib.util
sp=importlib.util.spec_from_file_location('ema','tiledata/atlas-pick/candidates-jp/station_entrance/work/gen-ema.py'); E=importlib.util.module_from_spec(sp); sp.loader.exec_module(E)
mats=E.mats
# B: A 를 왼쪽 위 빛으로 강하게, 발치에 그림자 늘이고 % 번짐
g=E.build("A")
for y in range(1,7):
    for x in range(1,16):
        if g[y][x]=="L": g[y][x]="Q"
        elif g[y][x]=="Q": g[y][x]="q"
        elif g[y][x]=="s": g[y][x]="L"
for y in range(8,30):
    if g[y][3]=="F": g[y][3]="E"
    if g[y][4]=="D": g[y][4]="F"
for y in (29,30,31):
    for x in range(32): 
        if g[y][x] in ".~-": g[y][x]="."
for x in range(5,32): g[30][x]="~"
for x in range(7,31): g[31][x]="-" if x>20 else "~"
for x in range(0,5): g[30][x]="%"
for x in range(0,3): g[29][x]="%" if g[29][x]=="." else g[29][x]
rows=E.out(g)
w('ema_rack','B',(2,2),"빛 구조: 왼쪽 위 빛으로 지붕·기둥 왼쪽을 밝히고, 오른쪽 아래로 긴 그림자 + 왼쪽 발치 빛 번짐",mats+["j kawara 6"],rows)
# C: 다시 생각 — 구리 지붕(kasa) 뾰족 + 굵은 기둥 + 큼직한 패 3+3 촘촘히 겹침
g=E.canvas()
for j in range(7):
    x0=15-2*j-1 if False else 14-j*2; x1=17+j*2
    x0=max(1,x0); x1=min(30,x1)
    for x in range(x0,x1+1):
        g[1+j][x]="R" if j<2 else ("Q" if j<4 else "L")
    g[1+j][x0]="t"; g[1+j][x1]="t"
for x in range(1,31): g[8][x]="s"; g[9][x]="t"
for x in range(1,31,3): g[7][x]="s"
for x in (14,15,16,17): g[0][x]="."
for y in range(10,30):
    for x in (3,4,5): g[y][x]="F" if x==3 else ("D" if x==4 else "d")
    for x in (26,27,28): g[y][x]="F" if x==26 else ("D" if x==27 else "d")
for x in range(3,29):
    g[12][x]="F"; g[13][x]="D"
Pc=["..p..",".phhp","phhhp","phkhp","phhhp","ppppp"]
Pd=["..p..",".pHHp","pHHHp","pHkHp","pHHHp","ppppp"]
Pb=["..p...",".phhhp","phhhhp","phhkhp","phhhhp","pppppp"]
Pe=["..p...",".pHHHp","pHHHHp","pHHkHp","pHHHHp","pppppp"]
for k in range(4):
    x=6+5*k if False else 6+5*k
    E.put(g,x,14+(k%2)*2,Pb if k%2==0 else Pe)
for k in range(3):
    x=8+5*k
    E.put(g,x,22+(k%2),Pe if k%2==0 else Pb)
for x in range(6,26):
    for y,ch in ((20,"F"),(21,"D")):
        if g[y][x]==".": g[y][x]=ch
for k in range(4): g[13][8+5*k]="r"
for k in range(3): g[21+0][10+5*k]="r" if g[21][10+5*k]=="." else g[21][10+5*k]
for x in range(3,29): g[30][x]="~"
for x in (2,29): g[30][x]="-"
rows=E.out(g)
w('ema_rack','C',(2,2),"다시 생각: 뾰족한 청록 구리 지붕 + 굵은 기둥 + 큼직한 패 세 겹(윗줄 넷·아랫줄 셋)이 엇갈려 겹침",mats,rows)
