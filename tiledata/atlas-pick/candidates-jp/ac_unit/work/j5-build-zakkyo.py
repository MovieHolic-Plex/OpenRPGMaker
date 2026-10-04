import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
K=lambda r:(lambda t:(r,t))
Cn=K('mconc'); Gl=K('mglass'); Me=K('mmetal'); Ak=K('akachin'); Kb=K('kblue'); Tx=K('taxi'); Ne=K('neon'); Lq=K('lacq'); Wh=K('mwhite'); Ye=K('myellow'); Mr=K('mred'); Ko=K('korange'); Pv=K('mpave')
G={
'中':["..##..","######","##..##","##..##","######","..##..","..##..","..##.."],
'王':["######","..##..","..##..","######","..##..","..##..","..##..","######"],
'米':["..##..","#.##.#",".####.","######",".####.","#.##.#","..##..","..##.."],
'日':["######","##..##","##..##","######","##..##","##..##","##..##","######"],
}
def glyph(c,x,y,ch,col):
    for j,r in enumerate(G[ch]):
        for i,k in enumerate(r):
            if k=='#': c.put(x+i,y+j,col)
FL=[11,24,37,50]; GY=63
def board(c,x,y,w,h,ramp,ch,gcol,shade=False):
    c.rect(x,y,w,h,ramp(3))
    c.hl(x,y,w,ramp(4)); c.vl(x,y,h,ramp(4))
    c.hl(x,y+h-1,w,ramp(1)); c.vl(x+w-1,y,h,ramp(1))
    glyph(c,x+(w-6)//2,y+(h-8)//2,ch,gcol)
    if shade:
        c.hl(x+1,y+h,w,'~'); c.vl(x+w,y+1,h,'~')
        c.hl(x,y,w,ramp(5)); c.put(x,y,ramp(5))
def window(c,x,y,w,h,kind,shade=False):
    c.rect(x,y,w,h,Me(2)); c.hl(x,y,w,Me(4)); c.vl(x,y,h,Me(4))
    ix,iy,iw,ih=x+1,y+1,w-2,h-2
    if kind=='blue':
        c.rect(ix,iy,iw,ih,Gl(3)); c.hl(ix,iy+ih-2,iw,Gl(2)); c.hl(ix,iy+ih-1,iw,Gl(1))
        for k in range(4): c.put(ix+1+k,iy+3-k,Gl(5)); c.put(ix+2+k,iy+3-k,Gl(5))
    elif kind=='lit':
        c.rect(ix,iy,iw,ih,Ye(4)); c.hl(ix,iy,iw,Ye(5)); c.hl(ix,iy+ih-1,iw,Ye(3))
        c.rect(ix+iw//2-1,iy+2,3,ih-2,Lq(2)); c.rect(ix+iw//2-1,iy+1,3,2,Lq(3))   # 사람 그림자
    elif kind=='pink':
        c.rect(ix,iy,iw,ih,Ne(3)); c.hl(ix,iy,iw,Ne(4)); c.hl(ix,iy+ih-1,iw,Ne(2))
        c.vl(ix+iw//2,iy,ih,Ne(1)); 
    elif kind=='ac':
        c.rect(ix,iy,iw,ih,Gl(3)); c.hl(ix,iy+ih-2,iw,Gl(2)); c.hl(ix,iy+ih-1,iw,Gl(1))
        c.rect(ix+iw-6,iy+ih-4,5,4,Wh(4)); c.hl(ix+iw-6,iy+ih-4,5,Wh(5)); c.put(ix+iw-4,iy+ih-2,Lq(1))
    c.hl(x-1,y+h,w+2,Cn(6)); c.hl(x-1,y+h+1,w+2,Cn(2))
def wall(c,x0,x1,y0,y1,shade):
    for y in range(y0,y1):
        for x in range(x0,x1):
            c.put(x,y,Cn(4))
    for y in range(y0,y1): c.put(x0,y,Cn(5)); c.put(x1-1,y,Cn(3))
def build(c,X,shade):
    wall(c,0,48,8,80,shade)
    # 지붕 난간
    c.hl(0,8,48,Cn(6)); c.rect(0,9,48,2,Cn(4)); c.hl(0,10,48,Cn(3))
    c.hl(1,8,46,Cn(6))
    # 물탱크
    c.rect(31,1,11,6,Me(4)); c.vl(31,1,6,Me(6)); c.vl(32,1,6,Me(5)); c.vl(40,1,6,Me(3)); c.vl(41,1,6,Me(2))
    c.hl(31,1,11,Me(6)); c.hl(33,0,7,Me(5)); c.hl(31,3,11,Me(3)); c.hl(31,5,11,Me(3))
    c.hl(31,6,11,Me(2)); c.vl(33,7,1,Me(1)); c.vl(39,7,1,Me(1)); c.put(33,7,Me(2)); c.put(39,7,Me(2))
    c.hl(4,7,5,Me(3)); c.vl(6,2,5,Me(4)); c.hl(5,3,3,Me(3))  # 안테나
    kinds=['blue','lit','ac','pink']
    boards=[(Ak,'中'),(Kb,'王'),(Tx,'米'),(Ne,'日')]
    for i,fy in enumerate(FL):
        c.hl(0,fy,48,Cn(6)); c.hl(0,fy+1,48,Cn(3))
        if i>0: pass
        if shade: c.hl(0,fy+2,48,'~'); c.hl(0,fy+3,48,'-')
        b=boards[i]
        gc=Lq(1) if b[0] is Tx else Wh(5)
        board(c,2,fy+1,10,11,b[0],b[1],gc,shade)
        window(c,15,fy+3,13,8,kinds[i],shade)
        window(c,31,fy+3,13,8,kinds[(i+1)%4] if i%2==0 else 'blue',shade)
        if shade and kinds[i] in('lit','pink'):
            for y in range(fy+2,fy+13): c.put(14,y,'%'); 
        # 우측 가는 세로판
        c.vl(46,fy+2,10,b[0](2)); c.vl(45,fy+2,10,b[0](4))
    # 1층
    c.hl(0,GY,48,Cn(6)); c.hl(0,GY+1,48,Cn(3))
    for x in range(0,48):
        col=Mr(4) if (x//3)%2==0 else Wh(5)
        c.hl(x,GY+2,1,col); c.hl(x,GY+3,1,col); c.hl(x,GY+4,1,col if (x//3)%2==0 else Wh(4))
        c.put(x,GY+5,(Mr(2) if (x//3)%2==0 else Wh(3)) if (x%3)!=1 else None) if False else c.put(x,GY+5,Mr(2) if (x//3)%2==0 else Wh(3))
    if shade:
        c.hl(0,GY+6,48,'~'); c.hl(0,GY+7,48,'-')
    # 문
    c.rect(14,GY+6,20,13,Me(2)); c.hl(14,GY+6,20,Me(5)); c.vl(14,GY+6,13,Me(5))
    c.rect(16,GY+7,7,11,Gl(3)); c.rect(25,GY+7,7,11,Gl(3))
    for gx in (16,25):
        c.hl(gx,GY+15,7,Gl(2)); c.hl(gx,GY+16,7,Gl(1)); c.hl(gx,GY+17,7,Gl(1))
        for k in range(5): c.put(gx+1+k,GY+12-k,Gl(5))
    c.vl(23,GY+7,11,Me(4)); c.vl(24,GY+7,11,Me(2)); c.put(22,GY+12,Me(7)); c.put(25,GY+12,Me(7)); c.vl(22,GY+11,3,Me(6)) if False else None
    c.hl(14,GY+18,20,Cn(2))
    # 문 옆 포스터·메뉴판
    c.rect(2,GY+7,10,9,Lq(3)); c.hl(2,GY+7,10,Lq(5)); c.vl(2,GY+7,9,Lq(5)); c.hl(2,GY+15,10,Lq(1)); c.vl(11,GY+7,9,Lq(1))
    c.hl(4,GY+9,6,Wh(5)); c.hl(4,GY+11,5,Ye(4)); c.hl(4,GY+13,6,Tx(4))
    c.rect(36,GY+7,10,11,Gl(3)); c.hl(36,GY+7,10,Me(4)); c.vl(36,GY+7,11,Me(4)); c.hl(36,GY+17,10,Me(2)); c.vl(45,GY+7,11,Me(2))
    for k in range(6): c.put(38+k,GY+13-k,Gl(5))
    c.hl(37,GY+15,8,Gl(2)); c.hl(37,GY+16,8,Gl(1))
    c.hl(0,79,48,Pv(3)); c.hl(0,78,48,Cn(2))
# ---- A
c=C(48,80)
build(c,'A',False)
for y in range(0,8):
    for x in range(48):
        if c.g[y][x] is None: pass
finish(c,'zakkyo_building','A',"강남: 4층 잡거빌딩 — 층마다 색 다른 세로 간판(中王米日)+창 두 개(불 켜진 창·에어컨·분홍 창), 1층 줄무늬 차양+유리문, 옥상 물탱크·안테나")
# ---- B
c=C(48,80)
build(c,'B',True)
finish(c,'zakkyo_building','B',"빛 강화: 층 슬래브 아래 반투명 그림자, 간판·차양 아래 그림자, 켜진 창 옆 %빛 번짐, 간판 윗변 밝은 면")
# ---- C  튀어나온 간판 실루엣
c=C(48,80)
for y in range(8,80):
    for x in range(14,48): c.put(x,y,Cn(4))
    c.put(14,y,Cn(5)); c.put(47,y,Cn(3))
c.hl(14,8,34,Cn(6)); c.rect(14,9,34,2,Cn(4)); c.hl(14,10,34,Cn(3))
c.rect(30,1,11,6,Me(4)); c.vl(30,1,6,Me(6)); c.vl(31,1,6,Me(5)); c.vl(39,1,6,Me(3)); c.vl(40,1,6,Me(2)); c.hl(30,1,11,Me(6)); c.hl(30,3,11,Me(3)); c.hl(30,5,11,Me(3)); c.hl(30,6,11,Me(2)); c.hl(32,0,7,Me(5))
c.vl(32,7,1,Me(2)); c.vl(38,7,1,Me(2)); c.vl(20,0,8,Me(4)); c.hl(18,2,5,Me(3))
kinds=['blue','lit','ac','pink']
boards=[(Ak,'中'),(Kb,'王'),(Tx,'米'),(Ne,'日')]
for i,fy in enumerate(FL):
    c.hl(14,fy,34,Cn(6)); c.hl(14,fy+1,34,Cn(3))
    b=boards[i]; gc=Lq(1) if b[0] is Tx else Wh(5)
    # 건물 밖으로 튀어나온 세로판 (왼쪽 0..13) — 층마다 폭이 다름
    bw=[12,9,13,10][i]; bx=[1,4,0,3][i]
    board(c,bx,fy+1,bw,11,b[0],b[1],gc,False)
    c.hl(bx+bw,fy+6,14-(bx+bw),Me(3))
    window(c,19,fy+3,20,8,kinds[i])
    c.vl(43,fy+2,10,b[0](2)); c.vl(42,fy+2,10,b[0](4))
c.hl(14,GY,34,Cn(6)); c.hl(14,GY+1,34,Cn(3))
for x in range(14,48):
    col=Mr(4) if (x//3)%2==0 else Wh(5)
    for y in (GY+2,GY+3,GY+4): c.put(x,y,col)
    c.put(x,GY+5,Mr(2) if (x//3)%2==0 else Wh(3))
c.rect(19,GY+6,20,13,Me(2)); c.hl(19,GY+6,20,Me(5)); c.vl(19,GY+6,13,Me(5))
for gx in (21,30):
    c.rect(gx,GY+7,8,11,Gl(3)); c.hl(gx,GY+15,8,Gl(2)); c.hl(gx,GY+16,8,Gl(1)); c.hl(gx,GY+17,8,Gl(1))
    for k in range(5): c.put(gx+1+k,GY+12-k,Gl(5))
c.vl(29,GY+7,11,Me(4)); c.vl(28,GY+7,11,Me(2))
c.hl(19,GY+18,20,Cn(2))
c.rect(41,GY+7,6,11,Gl(3)); c.hl(41,GY+15,6,Gl(2)); c.hl(41,GY+16,6,Gl(1))
# 1층 입간판 (튀어나옴)
c.rect(2,GY+8,10,10,Tx(4)); c.hl(2,GY+8,10,Tx(5)); c.hl(2,GY+17,10,Tx(2)); c.vl(11,GY+8,10,Tx(2)); c.hl(4,GY+11,6,Lq(1)); c.hl(4,GY+13,5,Lq(1)); c.hl(4,GY+15,6,Lq(1))
c.hl(0,79,48,Pv(3)); c.hl(14,78,34,Cn(2))
finish(c,'zakkyo_building','C',"재해석: 건물 몸통을 좁히고 층마다 폭이 다른 세로 간판이 왼쪽 밖으로 튀어나온 들쭉날쭉한 실루엣(번화가 간판 숲), 창은 층당 하나로 크게")
sheet('zakkyo_building',5)
