import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
def canvas(W=32,H=32): return [["."]*W for _ in range(H)]
def put(g,x,y,rows):
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch!=".": g[y+j][x+i]=ch
def rect(g,x,y,w_,h,ch):
    for j in range(h):
        for i in range(w_): g[y+j][x+i]=ch
def out(g): return ["".join(r) for r in g]
P=["..p..",".phhp","phhhp","phkhp","phhhp","ppppp"]
P2=["..p..",".pHHp","pHHHp","pHkHp","pHHHp","ppppp"]
def roofA(g):
    # 기와 지붕: 2줄 용마루 + 3줄 기와 + 처마
    put(g,4,1,["..RRRRRRRRRRRRRRRRRRRRRRRR.."[:0] or ""])
def build(variant):
    g=canvas()
    if variant in "AB":
        # 지붕 (박공 앞면) y1..7
        for j,(x0,x1) in enumerate([(9,22),(7,24),(5,26),(3,28),(1,30)]):
            for x in range(x0,x1+1): g[1+j][x]="q" if j==0 else ("Q" if j<3 else "L")
        for x in range(1,31): g[6][x]="s"; g[7][x]="t"
        for x in range(2,30): g[8][x]="~" if False else "."
        # 기와 결
        for j in range(2,5):
            for x in range(4+ (j%2),28,3): g[1+j][x]="s"
        for x in range(9,23): g[1][x]="R"
        for x in range(1,31): g[5][x]="L"
        # 기둥
        rect(g,3,8,2,22,"D"); rect(g,27,8,2,22,"D")
        for y in range(8,30): g[y][3]="F"; g[y][4]="D"; g[y][27]="D"; g[y][28]="d"
        # 가로대
        rect(g,3,11,26,2,"E"); rect(g,3,19,26,2,"E")
        for x in range(3,29): g[11][x]="F"; g[12][x]="D"; g[19][x]="F"; g[20][x]="D"
        # 패: 위줄 y13..18, 아래줄 y21..26
        for k in range(5):
            x=5+4*k; put(g,x,13+(k%2),P if k%2==0 else P2)
        for k in range(5):
            x=6+4*k; put(g,x,21+(k%2),P2 if k%2==0 else P)
        # 빨간 끈 점: 패 윗 점 바로 위 가로대에
        for k in range(5): g[12][7+4*k]="r"
        for k in range(5): g[20][8+4*k]="r"
        # 아래 그림자
        for x in range(3,29): g[30][x]="~"
        for x in (2,29): g[30][x]="-"
        # 받침돌
        rect(g,2,29,4,1,"n"); rect(g,26,29,4,1,"n")
    return g
mats=["q kawara 5","Q kawara 4","L kawara 3","s kawara 1","t kawara 0","R kawara 6",
"D sumi 1","F sumi 3","d sumi 0","E sumi 2",
"p hinoki 1","h hinoki 5","H hinoki 4","k sumi 0","r akachin 4","n ishi 2"]
if __name__=="__main__":
    g=build("A")
    # 'P' (패) 와 'P' (기와) 충돌 방지: 패 팔레트는 h/H 로 P→h
    rows=out(g)
    rows=[r.replace("d","d") for r in rows]
    w('ema_rack','A',(2,2),"강남 결: 기와 박공 지붕 밑 두 단 가로대, 오각 패 여덟 장(쓴 점·빨간 끈 점), 두 기둥",mats,rows)
