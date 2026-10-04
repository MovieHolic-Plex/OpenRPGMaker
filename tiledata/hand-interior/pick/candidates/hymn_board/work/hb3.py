from w6lib import emit, Cv
LG={'0':'wood:0','1':'wood:1','2':'wood:2','3':'wood:3','4':'wood:4','5':'wood:5','6':'wood:6',
 'p':'dwood:1','q':'dwood:2','r':'dwood:3',
 'a':'iron:1','b':'iron:2','c':'iron:3','d':'iron:4',
 'w':'white:4','x':'white:3','z':'ice:6',
 'g':'brass:4','h':'brass:5','i':'brass:2','j':'gold:5',
 '~':'P:~','-':'P:-'}
D={'1':['.X.','XX.','.X.','.X.','XXX'],'7':['XXX','..X','.X.','.X.','.X.'],'4':['X.X','X.X','XXX','..X','..X'],'2':['XXX','..X','XXX','X..','XXX'],'3':['XXX','..X','.XX','..X','XXX'],'5':['XXX','X..','XXX','..X','XXX']}
def dig(c,x,y,g,col='w',sh='x'):
    for j,r in enumerate(D[g]):
        for i,ch in enumerate(r):
            if ch=='X': c.px(x+i,y+j,col)
def frame(c,x0,y0,x1,y1,strong,thick=2):
    for t in range(thick):
        for x in range(x0+t,x1-t+1):
            c.px(x,y0+t,('6' if t==0 else '4') if strong else ('5' if t==0 else '3'))
            c.px(x,y1-t,('p' if t==0 else 'q'))
        for y in range(y0+t,y1-t+1):
            c.px(x0+t,y,'5' if t==0 else '4')
            c.px(x1-t,y,('q' if t==0 else '1') if strong else ('q' if t==0 else '2'))
    c.px(x0,y0,'6'); c.px(x1,y1,'p')
def slate(c,x0,y0,x1,y1):
    c.rect(x0,y0,x1-x0+1,y1-y0+1,'c')
    c.hl(x0,y0,x1-x0+1,'a'); c.vl(x0,y0,y1-y0+1,'a')
    c.hl(x0,y1,x1-x0+1,'d'); c.vl(x1,y0,y1-y0+1,'b')
def board(strong):
    c=Cv(16,16); y1=13 if strong else 14
    frame(c,1,1,14,y1,strong)
    slate(c,3,3,12,y1-2)
    # 제목 띠 황동
    c.hl(4,4,8,'g'); c.hl(4,4,3,'h'); c.px(11,4,'i')
    a,b=('1','7') if not strong else ('4','2')
    dig(c,4,6,a); dig(c,9,6,b)
    # 자리 못 구멍
    c.hl(4,y1-3,8,'a') if False else None
    c.px(2,2,'h'); c.px(13,2,'g'); c.px(2,y1-1,'g'); c.px(13,y1-1,'i')
    return c
c=board(False); emit('../w6-A.pxg',LG,c.rows())
c=board(True)
for y in range(3,14): c.px(15,y,'~')
for x in range(2,16): c.px(x,14,'~')
c.px(15,2,'-'); c.px(1,14,'-')
emit('../w6-B.pxg',LG,c.rows())
# C: 박공 지붕 얹은 번호판
c=Cv(16,16)
for i,y in enumerate(range(1,5)):
    x0=7-i*2; x1=8+i*2
    for x in range(x0,x1+1): c.px(x,y,'4' if x<8 else '2')
    c.px(x0,y,'6'); c.px(x1,y,'q')
    if i: c.hl(x0+1,y,2,'5')
c.hl(1,5,14,'q'); c.hl(1,5,6,'3'); c.px(1,5,'5')
c.px(7,0,'j'); c.px(8,0,'j'); c.px(7,1,'j'); c.px(8,1,'h')   # 꼭대기 십자 아님: 작은 황동 장식
c.rect(2,6,12,8,'2'); c.vl(2,6,8,'4'); c.vl(13,6,8,'1'); c.hl(2,13,12,'p'); c.hl(2,6,12,'1'); c.hl(2,6,1,'4')
slate(c,3,7,12,12)
dig(c,4,7,'3') if False else None
dig(c,4,7,'2'); dig(c,9,7,'5')
c.px(2,13,'g'); c.px(13,13,'i')
emit('../w6-C.pxg',LG,c.rows())
