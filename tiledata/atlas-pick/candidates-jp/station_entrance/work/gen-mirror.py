import sys, math; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
def canvas(W=16,H=48): return [["."]*W for _ in range(H)]
def out(g): return ["".join(r) for r in g]
def disc(g,cx,cy,R,rim=1.2,inner=None):
    # 반사경: 테 두 겹(바깥 어둠 O, 안쪽 밝음 P) + 안쪽 하늘(s)/길(l)
    for y in range(len(g)):
        for x in range(len(g[0])):
            d=math.hypot(x+0.5-cx,y+0.5-cy)
            if d<=R:
                if d>R-1.0: g[y][x]="O"
                elif d>R-2.0: g[y][x]="P" if (x+0.5<cx+1 and y+0.5<cy+1) else "Q"
                else:
                    dx=x+0.5-cx; dy=y+0.5-cy
                    # 하늘: 위쪽, 길: 아래쪽 대각
                    if dy+0.35*dx< -1.2: g[y][x]="s" if dx<1 else "t"
                    elif dy+0.35*dx>1.0: g[y][x]="l" if dx<0 else "m"
                    else: g[y][x]="u"
def pole(g,x,y0,y1):
    for y in range(y0,y1+1):
        g[y][x-1]="O"; g[y][x]="P"; g[y][x+1]="Q"; g[y][x+2]="O"
def sign(g,x0,y0,w_=8,h=7):
    for j in range(h):
        for i in range(w_):
            edge= j in(0,h-1) or i in(0,w_-1)
            g[y0+j][x0+i]="O" if edge else "B"
    # 흰 화살표(가운데 선 + 머리)
    cx=x0+w_//2; cy=y0+h//2
    for i in range(1,w_-1): g[cy][x0+i]="W"
    g[cy-1][x0+w_-3]="W"; g[cy+1][x0+w_-3]="W"; g[cy-2][x0+w_-4]="W"; g[cy+2][x0+w_-4]="W"
def base(g,y):
    for i,(x0,x1) in enumerate([(5,10),(4,11),(4,11)]):
        for x in range(x0,x1+1):
            g[y+i][x]="k" if i==0 else "n"
    for x in range(4,12): g[y+2][x]="d"
mats=["O korange 0","P korange 4","Q korange 2","s mglass 6","t mglass 5","l mglass 4","m mglass 3","u mwhite 2","W mwhite 4","B kblue 3","w mwhite 5","k pole 3","n pole 2","d pole 0","g korange 5"]
def A():
    g=canvas(); disc(g,8,7.5,7); pole(g,7,15,45); sign(g,4,25,8,7); base(g,44)
    g[4][4]="w"; g[4][5]="w"; g[5][4]="w"
    for x in range(3,13): g[47][x]="~"
    return g
def B():
    g=A()
    # 빛: 거울 반짝임 크게, 기둥 왼쪽 밝게, 오른쪽 아래 긴 그림자, 왼쪽 % 빛
    g[3][3]="w";g[3][4]="w";g[4][3]="w";g[4][4]="w";g[5][3]="w"
    for y in [y for y in range(16,44) if not 25<=y<=31]:
        g[y][7]="g"
    for x in range(3,16): g[47][x]="~" if x<13 else "-"
    for x in range(0,3): g[46][x]="%"; 
    for x in range(0,4): g[45][x]="%" if g[45][x]=="." else g[45][x]
    return g
def C():
    g=canvas()
    # 다시: 두 방향 거울 — 큰 거울 하나 뒤로 작은 거울, 굽은 팔
    disc(g,6.5,6.5,5.8)
    tmp=canvas(); disc(tmp,11.5,15.5,3.8)
    for y in range(48):
        for x in range(16):
            if tmp[y][x]!="." and g[y][x]==".": g[y][x]=tmp[y][x]
    pole(g,7,20,45)
    for x in range(8,12): g[19][x]="Q"; g[20][x]="O"
    sign(g,4,30,8,7); base(g,44)
    g[3][3]="w";g[3][4]="w";g[4][3]="w"
    for x in range(3,13): g[47][x]="~"
    return g
if __name__=="__main__":
    w('curve_mirror','A',(1,3),"강남 결: 주황 테 두 겹의 둥근 거울(하늘·길 두 덩이·반짝임), 4폭 기둥, 가운데 파란 화살표 표지, 회색 받침",mats,out(A()))
    w('curve_mirror','B',(1,3),"빛 구조: 반짝임을 키우고 기둥 왼쪽에 밝은 줄, 오른쪽으로 긴 그림자 + 왼쪽 발치 빛 번짐",mats,out(B()))
    w('curve_mirror','C',(1,3),"다시 생각: 큰 거울 뒤로 작은 거울이 삐져나온 두 방향 반사경, 굽은 팔로 기둥에 붙음",mats,out(C()))
