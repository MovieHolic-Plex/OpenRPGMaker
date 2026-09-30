from w6lib import emit, Cv
LG={'0':'wood:0','1':'wood:1','2':'wood:2','3':'wood:3','4':'wood:4','5':'wood:5','6':'wood:6',
 'p':'dwood:1','q':'dwood:2','r':'dwood:3',
 'a':'iron:1','b':'iron:2','c':'iron:3','d':'iron:4',
 'w':'white:4','x':'white:3','y':'white:2','z':'ice:6',
 'g':'brass:4','h':'brass:5','i':'brass:2','j':'gold:5',
 '~':'P:~','-':'P:-'}
def cards(c, ys, xs, marks):
    for yi,y in enumerate(ys):
        for xi,x in enumerate(xs):
            c.rect(x,y,2,3,'w'); c.hl(x,y,2,'z'); c.hl(x,y+2,2,'x')
            m=marks[(yi*len(xs)+xi)%len(marks)]
            for (dx,dy) in m: c.px(x+dx,y+dy,'a')
def frame(c, x0,y0,x1,y1, strong):
    # 테두리 : 왼쪽/위 밝게, 오른쪽/아래 어둡게
    for x in range(x0,x1+1): c.px(x,y0,'5' if strong else '4'); c.px(x,y1,'p' if strong else 'q')
    for y in range(y0,y1+1): c.px(x0,y,'4'); c.px(x1,y,'q' if strong else '2')
    c.px(x0,y0,'6'); c.px(x1,y0,'3'); c.px(x0,y1,'2'); c.px(x1,y1,'p')
    # 안쪽 한 겹
    for x in range(x0+1,x1): c.px(x,y0+1,'3'); c.px(x,y1-1,'1')
    for y in range(y0+1,y1): c.px(x0+1,y,'3'); c.px(x1-1,y,'1')

G={'1':['.X.','.X.','.X.'],'7':['XXX','..X','.X.'],'4':['X.X','XXX','..X'],'2':['XX.','.X.','XXX']}
def card(c,x,y,g,dark='a'):
    c.rect(x,y,3,3,'w'); c.hl(x,y,3,'z'); c.vl(x+2,y+1,2,'x'); c.hl(x,y+2,3,'x') if False else None
    for j,r in enumerate(G[g]):
        for i,ch in enumerate(r):
            if ch=='X': c.px(x+i,y+j,dark)
def board(strong):
    c=Cv(16,16)
    y1=13 if strong else 14
    frame(c,2,1,13,y1,strong)
    c.rect(4,3,8,y1-4,'c')
    for x in range(4,12): c.px(x,3,'b')
    for y in range(3,y1-1): c.px(4,y,'b')
    # 제목 띠 (황동)
    c.hl(5,4,6,'g'); c.hl(5,4,1,'h'); c.hl(10,4,1,'i')
    # 카드 두 줄 (한 줄에 3칸 폭 카드 둘 옆으로 붙음)
    ry=[6] if strong else [6,10]
    for k,y in enumerate(ry):
        card(c,5,y,('1','4')[k]); card(c,8,y,('7','2')[k])
    c.px(3,2,'h'); c.px(12,2,'g'); c.px(3,y1-1,'g'); c.px(12,y1-1,'i')
    return c
if False: pass

c=board(False); emit('../w6-A.pxg',LG,c.rows())
c=board(True)
for y in range(2,15): c.px(14,y,'-' if y==2 else '~')
for x in range(3,15): c.px(x,14,'~')
for y in range(3,14): c.px(15,y,'-') if False else None
emit('../w6-B.pxg',LG,c.rows())
