import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
def canvas(W=32,H=16): return [["."]*W for _ in range(H)]
def out(g): return ["".join(r) for r in g]
def piece(g,x,y,rows):
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch!=".": g[y+j][x+i]=ch
mats=["o mwhite 0","W mwhite 4","V mwhite 3","Z mwhite 2",
"p mmetal 5","q mmetal 3","r mmetal 1",
"b kblue 3","B kblue 2","c kblue 1","d kblue 5",
"s sakura 3","S sakura 2","t sakura 1","u sakura 5",
"y taxi 4","Y taxi 3","z taxi 1","x taxi 5","%% "][:-1]
SHIRT=[ "ooo......ooo",
        "oWWoooooWWWo",
        "oWWWWVVWWWWo",
        "oWWWWVVWWWWo",
        "ooWWWVVWWWoo",
        ".oWWWVVWWWo.",
        ".oWWVVVVWWo.",
        ".oWWVVVVWZo.",
        ".oWWVVVVWZo.",
        ".oWZVVVVZZo.",
        ".oooooooooo."]
TOWEL=["ccccccc",
       "cddddbc",
       "cbbbbBc",
       "cWWWWWc",
       "cbbbbBc",
       "cddddbc",
       "cbbbbBc",
       "cBBBBBc",
       "ccccccc"]
SOCK1=["oooo","uSSo","usso","usso","ussoo","uSSSo","ooooo"]
SOCK2=["oooo","xzzo","xyyo","xyyo","xyyoo","xYYYo","ooooo"]
def pole(g):
    for x in range(0,32): g[1][x]="p"; g[2][x]="q"
def A():
    g=canvas(); pole(g)
    piece(g,1,3,SHIRT); piece(g,14,3,TOWEL)
    piece(g,22,3,SOCK1); piece(g,27,3,SOCK2)
    # 집게(빨래 고정) 점
    for x in (4,8,16,18): g[3][x]="r"
    return g
def B():
    g=canvas(); pole(g)
    # 아침 햇살: 왼쪽 위에서 흰 옷이 빛나고, 빨래 아래 바닥 쪽에 %번짐(그림자는 ~)
    piece(g,1,3,SHIRT); piece(g,14,3,TOWEL); piece(g,22,3,SOCK1); piece(g,27,3,SOCK2)
    for x in range(1,13): 
        for y in range(4,12):
            if g[y][x]=="V": g[y][x]="W"
    for y in range(4,12): g[y][8]="V"; g[y][9]="V"
    for x in range(2,31): g[14][x]="~" if 1<x<24 else "-"
    for x in range(2,12): g[13][x]="%"
    for x in range(14,21): g[13][x]="%"
    return g
def C():
    g=canvas(); pole(g)
    # 다시: 줄에 널린 옷이 바람에 한쪽으로 쏠린 흔들림 — 셔츠는 소매 하나 펄럭, 수건 가장자리 접힘, 양말 가로
    piece(g,2,3,["ooo.......",
                 "oWWooooooo",
                 "oWWWWWWWWWo",
                 "oWWWVVVWWWWo",
                 "oWWVVVVWWWWo",
                 "ooWVVVVWWWo",
                 ".oWVVVVWZo.",
                 ".oWVVVVWZo.",
                 ".oWVVVZZZo.",
                 ".ooooooooo."])
    piece(g,13,3,["ccccccc",
                  "cddddbcc",
                  "cbbbbBBc",
                  "cWWWWWWc",
                  "cbbbbbBc",
                  "cBBBBBc",
                  "ccccccc"])
    piece(g,22,3,SOCK1)
    piece(g,27,3,["ooooo","xzzzo","xyyyo","xyyyo","xYYYo","ooooo"])
    for x in (5,9,15,17): g[3][x]="r"
    return g
if __name__=="__main__":
    w('laundry','A',(2,1),"강남 결: 빨래 장대 한 줄에 흰 셔츠·파란 줄무늬 수건·분홍/노랑 양말, 집게 점",mats,out(A()))
    w('laundry','B',(2,1),"빛 구조: 왼쪽 위 빛으로 흰 옷이 밝게, 아래로 짧은 그림자와 %빛 번짐",mats,out(B()))
    w('laundry','C',(2,1),"다시 생각: 바람에 쏠려 펄럭이는 셔츠 소매·수건 끝, 양말 크기 차이",mats,out(C()))
