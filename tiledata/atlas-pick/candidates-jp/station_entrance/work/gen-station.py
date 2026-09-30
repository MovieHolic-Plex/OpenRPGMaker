import sys
sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import w
from j4_fac import *
MATS=["o lacq 1","O lacq 2","L lacq 4",
"e kgreen 0","f kgreen 1","G kgreen 2","g kgreen 3","F kgreen 4",
"w mwhite 3","W mwhite 4","V mwhite 2","U mwhite 1","X mwhite 5",
"d mconc 1","c mconc 2","C mconc 3","D mconc 4","E mconc 5",
"t mtile 3","T mtile 4","s mtile 2","S mtile 5","u mtile 1",
"a mdglass 0","b mdglass 1","h mdglass 2","i mdglass 3","j mdglass 4","k mdglass 5",
"p mpave 0","q mpave 2","r mpave 4","P mpave 6",
"m mmetal 3","M mmetal 5","n mmetal 1","y taxi 4","Y taxi 3"]
GL=["####.######",
    "#..#.#....#",
    "####.#....#",
    "#..#.######",
    "####.#.#..#",
    "..#..#.#.#.",
    "#####.##..#",
    ".#.#.#.....",
    "#.#.#.#...."]
# 駅 12w x 11h hand-drawn
K=[
"#####.######",
"#...#.#....#",
"#####.#....#",
"#...#.######",
"#####.#.#.#.",
"..#...#.#.#.",
"#####.#..#..",
".#.#..#.#.#.",
"#.#.#.##..##",
]
K=[
"#####..#####",
"#...#..#...#",
"#####..#...#",
"#...#..#####",
"#####..#.#.#",
"..#....#.#.#",
"#####..#..#.",
".#.#.#.#.#.#",
"#.#.#.##...#",
]
K=[
"######.#######",
"#....#.#.....#",
"######.#.....#",
"#....#.#######",
"######....#...",
"..#......#.#..",
"######...#.#..",
"#.#..#..#...#.",
"#.#..#..#...#.",
"..#....#.....#",
"#.#.#..#.....#",
]
def glyph(g,x,y,ch,rows=K,scale_v=1):
    for j,r in enumerate(rows):
        for i,c_ in enumerate(r):
            if c_=='#':
                for dy in range(scale_v): P(g,x+i,y+j*scale_v+dy,ch)
def sign_band(g,t):
    R(g,0,0,79,0,t['cap1']); R(g,0,1,79,1,'C'); R(g,0,2,79,2,'c')
    R(g,0,3,79,23,'d')                       # outer frame / shade
    R(g,2,3,77,22,'c'); R(g,2,3,77,3,'C')
    R(g,3,4,76,6,t['gt']); R(g,3,4,76,4,t['gh'])
    R(g,3,7,76,19,t['board']); R(g,3,7,76,7,t['bh'])
    R(g,3,20,76,21,t['gb']); R(g,3,21,76,21,'f')
    R(g,3,7,3,19,t['bh'])
    R(g,76,7,76,19,t['bs'])
    # glyph in centre : 12 wide x 9 tall, doubled vertically look -> use scale_v
    glyph(g,33,8,t['ink'],K,1)
    # side line marks : green rounded squares with white dot
    for x0 in (10,62):
        R(g,x0,9,x0+7,16,t['gt']); R(g,x0+1,8,x0+6,17,t['gt'])
        R(g,x0+3,11,x0+4,14,t['board'])
        R(g,x0+1,9,x0+6,9,t['gh'])
    # rivets / bars beside glyph
    R(g,22,12,29,13,t['gt']); R(g,50,12,57,13,t['gt'])
def piers(g,y0,y1,t):
    for x0,x1 in((0,13),(66,79)):
        R(g,x0,y0,x1,y1,'t')
        for y in range(y0,y1+1,6): R(g,x0,y,x1,y,'s')
        for x in range(x0+3,x1,7): R(g,x,y0,x,y1,'s')
        R(g,x0,y0,x1,y0+1,'u')
        R(g,x0,y0,x0,y1,'T'); R(g,x1,y0,x1,y1,'s')
    # pillars edge
    R(g,14,y0,17,y1,'c'); R(g,14,y0,14,y1,'D'); R(g,17,y0,17,y1,'d')
    R(g,62,y0,65,y1,'c'); R(g,62,y0,62,y1,'D'); R(g,65,y0,65,y1,'d')
def inside(g,y0,y1,t):
    R(g,18,y0,61,y1,'b')
    R(g,18,y0,61,y0+1,'a')                       # under-sign shadow
    R(g,18,y0+2,61,y0+3,'a')
    R(g,18,y0+5,61,y0+5,t['strip']); 
    # back wall far
    R(g,18,y0+6,61,y1-7,'h')
    # gate bank
    for x0 in (26,40,54):
        R(g,x0,y1-13,x0+5,y1-6,'i')
        R(g,x0,y1-13,x0+5,y1-13,t['gate'])
        R(g,x0+1,y1-11,x0+4,y1-10,'k' if t['gate']!='M' else 'M')
    for x0 in (32,46):
        R(g,x0,y1-10,x0+6,y1-10,'j')
    # floor
    R(g,18,y1-5,61,y1,t['floor']);
    R(g,18,y1-5,61,y1-5,t['floor2'])
def base_apron(g,y0):
    R(g,0,y0,79,47,'q'); R(g,0,y0,79,y0,'r')
    for x in range(0,80,10): R(g,x,y0+1,x,47,'p')
    R(g,0,y0+2,79,y0+2,'p') if False else None
    R(g,0,47,79,47,'p')
TA=dict(cap1='D',gt='G',gh='g',gb='f',board='W',bh='X',bs='V',ink='o',strip='j',gate='M',floor='q',floor2='r')
def A():
    g=canvas(80,48,'c')
    sign_band(g,TA); piers(g,24,42,TA); inside(g,24,42,TA); base_apron(g,43)
    return g
def B():
    t=dict(TA,board='X',bh='X',bs='W',gh='F',gt='g',gb='G',strip='k',floor='r',floor2='P')
    g=canvas(80,48,'c')
    sign_band(g,t); piers(g,24,42,t); inside(g,24,42,t)
    # stronger contrast: darker interior
    R(g,18,24,61,26,'a')
    base_apron(g,43)
    # shadow under sign onto piers
    R(g,0,24,13,26,'s'); R(g,66,24,79,26,'s')
    # inner glow spill fan on apron
    for y in range(43,48):
        for x in range(80):
            half=22+(y-43)*4
            if abs(x-39.5)<=half: g[y][x]='%'
    for x in range(80):
        if g[45][x]!='%': g[45][x]='-'
        if g[46][x]!='%': g[46][x]='~' if x%2==0 else '-'
    return g
def C():
    g=canvas(80,48,'c')
    piers(g,8,42,TA); inside(g,8,42,TA)
    # striped awning
    R(g,0,0,79,0,'D'); R(g,0,1,79,1,'d')
    for x in range(80):
        ch='G' if (x//5)%2==0 else 'W'
        for y in range(2,7): g[y][x]=ch
        g[2][x]='g' if ch=='G' else 'X'
        g[6][x]='f' if ch=='G' else 'V'
    R(g,0,7,79,7,'d')
    for x in range(0,80,5):
        g[6][x]='d'
    # tate sign on left pier
    R(g,0,9,17,29,'d'); R(g,1,10,16,28,'W'); R(g,1,10,16,10,'X')
    R(g,1,10,1,28,'X'); R(g,16,10,16,28,'V')
    R(g,1,10,16,12,'G'); R(g,1,10,16,10,'g'); R(g,1,27,16,28,'G')
    R(g,8,8,9,8,'d')
    glyph(g,2,14,'o')
    # clock on right pier
    for (cx,cy,r) in [(72,17,6)]:
        for y in range(cy-r,cy+r+1):
            for x in range(cx-r,cx+r+1):
                dd=(x-cx)**2+(y-cy)**2
                if dd<=r*r+1: g[y][x]='X' if dd<(r-2)**2 else 'd'
        R(g,cx,cy-4,cx,cy,'o'); R(g,cx,cy,cx+3,cy,'o')
        for (dx,dy) in((0,-5),(0,5),(-5,0),(5,0)): g[cy+dy][cx+dx]='o'
    R(g,72,7,72,10,'d')
    base_apron(g,43)
    return g
if __name__=='__main__':
    w('station_entrance','A',(5,3),"강남 결: 초록 줄 사이 흰 띠 간판에 「駅」, 양옆 타일 벽·기둥, 어두운 열린 입구 속 개찰구 세 대, 발치 포장",MATS,out(A()))
    w('station_entrance','B',(5,3),"빛 구조: 간판을 안에서 밝혀 흰빛 강하게, 입구 속은 더 어둡게 대비, 간판 밑 그늘, 발치에 안쪽 불빛이 새는 부채꼴 번짐",MATS,out(B()))
    w('station_entrance','C',(5,3),"실루엣 재구상: 초록·흰 줄무늬 차양 밑 어두운 열린 입구, 왼쪽 기둥에 세로 「駅」 달간판, 오른쪽 기둥에 벽시계",MATS,out(C()))
