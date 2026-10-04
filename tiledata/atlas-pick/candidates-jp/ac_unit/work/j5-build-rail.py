import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
G=lambda t:('mgran',t); Cn=lambda t:('mconc',t); M=lambda t:('mmetal',t); A=lambda t:('masph',t); Wd=lambda t:('mwood',t)
TILE=["d...l...d.....l.","..l...d.....d...","...d..l..l....d.","l.....d.d...l...","..d.l......d..l.",".....d..l.......","d..l...d...d.l..","....d.l.....d...",".l.....d..l.....","...d.l...d....l.","d.....l.....d...","..l.d.....l...d.",".....l..d.....l.","l..d......d.l...","..d...l.l.....d.","....d....d..l..."]
def gravel(c,base,dk,lt,x0=0,x1=32):
    c.rect(x0,0,x1-x0,16,base)
    for j,r in enumerate(TILE):
        for i,ch in enumerate(r):
            for off in (0,16):
                x=i+off
                if x0<=x<x1:
                    if ch=='d': c.put(x,j,dk)
                    elif ch=='l': c.put(x,j,lt)
def rails(c,xs,cols):
    for x0 in xs:
        for k,col in enumerate(cols): c.vl(x0+k,0,16,col)
RAILS=(8,21)
# ================= rail A
c=C(32,16)
gravel(c,G(2),G(1),G(3))
for y0 in (2,10):
    c.rect(2,y0,28,4,Cn(4)); c.hl(2,y0,28,Cn(5)); c.hl(2,y0+3,28,Cn(2)); c.vl(29,y0,4,Cn(2)); c.vl(2,y0,4,Cn(5))
rails(c,RAILS,[M(6),M(4),M(2)])
for y in (3,11):
    for x in (7,11,20,24): c.put(x,y,M(1))
finish(c,'rail_track','A',"강남 바닥 결: 자갈(회색 3단 점) 위에 콘크리트 침목 가로 2줄(주기 8), 세로 은색 레일 3px(왼쪽 밝은 윗선), 침목 위 체결 점. 위아래로 이어 붙음")
# crossing A
c=C(32,16)
c.rect(0,0,32,16,A(3))
for j,r in enumerate(TILE):
    for i,ch in enumerate(r):
        for off in (0,16):
            x=i+off
            if x<8 or x>=24:
                if ch=='d': c.put(x,j,A(2))
                elif ch=='l': c.put(x,j,A(4))
c.rect(11,0,10,16,A(1))
for y0 in (0,8):
    c.hl(11,y0,10,A(0)); c.hl(11,y0+1,10,A(2))
for (x,y) in ((13,4),(18,4),(13,12),(18,12)): c.put(x,y,A(3)); c.put(x,y+1,A(0))
c.vl(7,0,16,A(0)); c.vl(24,0,16,A(0)); c.vl(11,0,16,A(0)); c.vl(20,0,16,A(0))
rails(c,RAILS,[M(6),M(4),M(2)])
finish(c,'crossing_deck','A',"레일(같은 x)만 남기고 사이에 어두운 고무판(가로 이음 주기 8, 볼트 4개), 양옆은 아스팔트 점무늬. 선로와 위아래·좌우 정렬")
# ================= B
c=C(32,16)
gravel(c,G(2),G(1),G(4))
for y0 in (2,10):
    c.rect(2,y0,28,4,Cn(4)); c.hl(2,y0,28,Cn(6)); c.hl(2,y0+1,28,Cn(5)); c.hl(2,y0+3,28,Cn(2)); c.vl(2,y0,4,Cn(6)); c.vl(29,y0,4,Cn(1)); c.vl(28,y0+1,3,Cn(2))
    c.hl(3,y0+4,27,G(0)); c.hl(4,y0+5,27,G(1))
rails(c,RAILS,[M(7),M(5),M(3),M(1)])
for x0 in RAILS:
    for y in range(16):
        if not (2<=y%8<=5): c.put(x0+4,y,G(0))
for y in (3,11):
    for x in (6,11,19,24): c.put(x,y,M(2)); 
finish(c,'rail_track','B',"침목 윗면 2줄 밝게+아래 그늘, 침목 밑 자갈에 접지 그림자, 레일은 윗선 가장 밝고 오른쪽 1px 그늘+바닥에 그림자 번짐, 레일 4단 명암")
c=C(32,16)
c.rect(0,0,32,16,A(3))
for j,r in enumerate(TILE):
    for i,ch in enumerate(r):
        for off in (0,16):
            x=i+off
            if x<8 or x>=25:
                if ch=='d': c.put(x,j,A(2))
                elif ch=='l': c.put(x,j,A(5))
c.rect(12,0,9,16,A(1))
for y0 in (0,8):
    c.hl(12,y0,9,Cn(3)); c.hl(12,y0+1,9,A(2)); c.hl(12,y0+7,9,A(0))
    for (x,y) in ((14,y0+4),(19,y0+4)): c.put(x,y,Cn(3)); c.put(x+1,y+1,A(0))
c.vl(7,0,16,A(0)); c.vl(11,0,16,A(0)); c.vl(25,0,16,A(0)); c.vl(20,0,16,A(0)); c.vl(12,0,16,A(0)); c.vl(21,0,16,A(1))
c.vl(25,0,16,A(0)); c.vl(26,0,16,A(2))
rails(c,RAILS,[M(7),M(5),M(3),M(1)])
finish(c,'crossing_deck','B',"고무판에 윗줄 밝은 모서리·아랫줄 그늘로 두께감, 볼트 밝은 점+그림자, 레일 오른쪽에 그늘 줄 — 선로 B 와 같은 레일 위치·같은 4단 명암")
# ================= C
c=C(32,16)
c.rect(0,0,32,16,G(1))
CH=["ll","ld"]
for (x,y) in ((1,1),(5,0),(12,2),(17,1),(26,0),(29,2),(2,7),(13,6),(18,7),(28,6),(4,13),(9,12),(14,14),(22,13),(27,15),(30,11)):
    c.rect(x,y,2,2,G(3)); c.put(x,y,G(4)); c.put(x+1,y+1,G(0))
for y0 in (1,9):
    c.rect(2,y0,28,5,Wd(3)); c.hl(2,y0,28,Wd(4)); c.hl(2,y0+4,28,Wd(1)); c.vl(29,y0,5,Wd(1))
    for x in (5,9,14,19,25): c.put(x,y0+2,Wd(2))
    c.hl(4,y0+5,26,G(0))
rails(c,(7,21),[M(7),M(5),M(4),M(2)])
for y0 in (1,9):
    for x in (6,11,20,25): c.rect(x,y0+1,1,3,M(1))
finish(c,'rail_track','C',"재해석: 나무 침목(갈색, 굵은 5줄)+덩어리 자갈+더 굵은 은색 레일 4px 로 멀리서도 선로로 읽히게. 침목 밑 그림자. 위아래 이어 붙음(주기 8)")
c=C(32,16)
c.rect(0,0,32,16,A(3))
for (x,y) in ((1,2),(4,9),(2,13),(5,5),(27,3),(29,10),(26,14),(30,6)):
    c.put(x,y,A(5)); c.put(x+1,y+1,A(2))
c.rect(11,0,10,16,Cn(3))
for y0 in (0,8):
    c.hl(11,y0,10,Cn(5)); c.hl(11,y0+7,10,Cn(1))
    for k in range(3): c.put(13+k*3,y0+2+k,Cn(1)); c.put(14+k*3,y0+2+k,Cn(4)) if False else None
    for x in (13,17): c.hl(x,y0+3,2,Cn(1)); c.hl(x,y0+4,2,Cn(5))
c.vl(10,0,16,A(0)); c.vl(21,0,16,A(0)) if False else None
rails(c,(7,21),[M(7),M(5),M(4),M(2)])
c.vl(11,0,16,Cn(1)); c.vl(20,0,16,Cn(1))
c.vl(6,0,16,A(0)); c.vl(25,0,16,A(0))
finish(c,'crossing_deck','C',"재해석: 밝은 콘크리트 패널(윗 모서리 밝게·아래 이음 어둡게, 손잡이 홈 2개)로 아스팔트와 확실히 구분, 레일 4px(선로 C 와 같은 x)")
sheet('rail_track',8); sheet('crossing_deck',8)
