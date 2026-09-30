from w6lib import emit, Cv
LG={'0':'wood:0','1':'wood:1','2':'wood:2','3':'wood:3','4':'wood:4','5':'wood:5','6':'wood:6',
 'p':'dwood:1','q':'dwood:2','r':'dwood:3',
 'a':'iron:0','b':'iron:1','c':'iron:2','d':'iron:3',
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
MARKS=[[(0,1)],[(1,1)],[(0,0),(1,2)],[(1,0),(0,2)],[(0,1),(1,1)],[(1,1)]]
def A(strong=False):
    c=Cv(16,16)
    frame(c,2,1,13,13 if strong else 14,strong)
    y1=13 if strong else 14
    # 석판 바탕
    c.rect(4,3,8,y1-5,'b')
    for x in range(4,12): c.px(x,3,'a')
    for y in range(3,y1-1): c.px(4,y,'a')
    for x in range(4,12): c.px(x,y1-2,'c')
    ys=[4,8] if not strong else [4,8]
    cards(c,ys,[5,8],MARKS) if False else None
    cards(c,[4,8],[5,7,9],MARKS)
    # 카드 아래 선반 홈
    for y in (7,11 if not strong else 11):
        c.hl(5,y,6,'d' if not strong else 'c')
    # 못 머리
    c.px(3,2,'h'); c.px(12,2,'g'); c.px(3,y1-1,'g'); c.px(12,y1-1,'i')
    return c
c=A(); emit('../w6-A.pxg',LG,c.rows())
c=A(True)
for y in range(2,15): c.px(14,y,'~')
for x in range(3,15): c.px(x,14,'~')
c.px(15,3,'-') if False else None
for y in range(3,14): c.px(15,y,'-')
for x in range(4,16): c.px(x,15,'-') if False else None
emit('../w6-B.pxg',LG,c.rows())
# C: 지붕 얹은 삼각머리 번호판 + 아래 세 칸 큰 번호
c=Cv(16,16)
# 지붕 (박공)
roof=["......6.........","....655.........","...6555.........","..65555444444...".replace('4','4')]
c=Cv(16,16)
for i,y in enumerate(range(1,5)):
    x0=7-i*2; x1=8+i*2
    for x in range(x0,x1+1): c.px(x,y,'4' if x<8 else '2')
    c.px(x0,y,'6'); c.px(x1,y,'q')
c.hl(1,5,14,'q'); c.hl(1,5,7,'3')
# 몸통
c.rect(3,6,10,8,'2')
c.vl(3,6,8,'4'); c.vl(12,6,8,'1'); c.hl(3,13,10,'p')
c.rect(4,7,8,5,'a'); c.hl(4,7,8,'a'); c.hl(4,11,8,'c')
# 큰 번호 셋 (3x3 카드)
for xi,x in enumerate((4.5,)): pass
for x,m in ((4,[(1,0),(1,1),(1,2)]),(7,[(0,0),(1,0),(1,1),(2,2),(0,2)]),(10,[(0,0),(2,0),(1,1),(0,2),(2,2)])):
    pass
c.rect(4,8,2,3,'w'); c.rect(7,8,2,3,'w'); c.rect(10,8,2,3,'w')
c.hl(4,8,2,'z'); c.hl(7,8,2,'z'); c.hl(10,8,2,'z')
c.hl(4,10,2,'x'); c.hl(7,10,2,'x'); c.hl(10,10,2,'x')
c.px(5,9,'a'); c.px(7,9,'a'); c.px(9,10,'a') if False else None; c.px(10,9,'a'); c.px(11,10,'a')
c.hl(3,12,10,'3'); c.hl(3,12,1,'5')
# 십자 장식 (지붕 꼭대기)
c.px(7,0,'j'); c.px(8,0,'j') if False else None
c.px(6,1,'6') if False else None
# 걸이 못
c.px(7,2,'h'); c.px(8,2,'g')
c.px(3,13,'g'); c.px(12,13,'i')
emit('../w6-C.pxg',LG,c.rows())
