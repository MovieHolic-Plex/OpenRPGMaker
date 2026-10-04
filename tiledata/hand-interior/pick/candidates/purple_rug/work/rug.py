from w6lib import emit, Cv
LG={str(i):f'purple:{i}' for i in range(7)}
LG.update({'a':'gold:1','b':'gold:2','c':'gold:3','d':'gold:4','e':'gold:5','f':'gold:6',
 'l':'linen:3','m':'linen:4','n':'linen:5','o':'linen:2','~':'P:~','-':'P:-'})
def weave(c,x0,y0,x1,y1,strong=False):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            k=(x-y)%4
            c.px(x,y,'5' if k==0 else '4' if k in(1,2) else '3') if False else None
            v=(x+y)%4; u=(x-y)%4
            c.px(x,y,'4')
            if u==0 and (x+y)%8 < 4: c.px(x,y,'5')
            if u==2 and (x+y)%8 >= 4: c.px(x,y,'3')
def diamond(c,cx,cy,r,col,fill=None):
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            d=abs(x-cx)+abs(y-cy)
            if d==r: c.px(x,y,col)
            elif fill and d<r: c.px(x,y,fill)
def rug(strong):
    c=Cv(32,32)
    # 술 (위/아래)
    for x in range(4,28):
        if x%2==0:
            c.px(x,0,'m'); c.px(x,31,'l') if strong else c.px(x,31,'m')
            c.px(x,30,'o') if False else None
    for x in range(4,28):
        if x%2==1: c.px(x,0,'l'); c.px(x,31,'o')
    # 바깥 테두리 1..30
    c.rect(1,1,30,30,'1')
    for x in range(1,31): c.px(x,1,'2' if strong else '1'); c.px(x,30,'0')
    for y in range(1,31): c.px(1,y,'3' if strong else '2'); c.px(30,y,'0' if strong else '1')
    if not strong:
        for x in range(1,31): c.px(x,1,'1')
        c.px(1,1,'2')
    # 금띠
    for x in range(2,30): c.px(x,2,'e' if strong else 'd'); c.px(x,29,'b')
    for y in range(2,30): c.px(2,y,'e' if strong else 'd'); c.px(29,y,'b')
    c.px(2,2,'f'); c.px(29,29,'a')
    # 안쪽 자주 띠 + 무늬띠
    c.rect(3,3,26,26,'2')
    for x in range(3,29): c.px(x,3,'3'); c.px(x,28,'1')
    for y in range(3,29): c.px(3,y,'3'); c.px(28,y,'1')
    # 무늬띠 : 작은 마름모 연속
    for k in range(5,27,4):
        for (x,y) in ((k,4),(k+1,5) ,(k-1,5),(k,6)): pass
    c.rect(4,4,24,24,'5')
    # 무늬띠 4..7 : 짙은 자주 + 밝은 마름모
    c.rect(4,4,24,24,'3')
    for x in range(4,28): c.px(x,4,'4'); c.px(x,27,'2')
    for y in range(4,28): c.px(4,y,'4'); c.px(27,y,'2')
    for k in range(6,26,4):
        for (px,py) in ((k,5),(k,6),(k-1,6),(k+1,6),(k,7)): pass
    # 가운데 안쪽 판 9..22
    c.rect(8,8,16,16,'4')
    weave(c,9,9,22,22)
    for x in range(8,24): c.px(x,8,'2'); c.px(x,23,'5')
    for y in range(8,24): c.px(8,y,'2'); c.px(23,y,'5')
    c.px(8,23,'3'); c.px(23,8,'3')
    # 띠 무늬 : 위/아래 마름모 줄
    for k in range(6,26,4):
        for yy in (5,25):
            c.px(k,yy,'6' if strong else '5'); c.px(k-1,yy+1,'5'); c.px(k+1,yy+1,'5'); c.px(k,yy+2,'4') if False else None
            c.px(k,yy+1,'6')
    for k in range(6,26,4):
        for xx in (5,25):
            c.px(xx,k,'6' if strong else '5'); c.px(xx+1,k-1,'5'); c.px(xx+1,k+1,'5'); c.px(xx+1,k,'6')
    # 중앙 메달리온
    diamond(c,16,16,6,'d',None)
    diamond(c,16,16,5,'b')
    diamond(c,16,16,4,'6' if strong else '5',fill='3')
    diamond(c,16,16,2,'d',fill='e')
    c.px(16,16,'f')
    for (x,y) in ((16,9),(16,23),(9,16),(23,16)): c.px(x,y,'d')
    return c
c=rug(False); emit('../w6-A.pxg',LG,c.rows())
c=rug(True)
emit('../w6-B.pxg',LG,c.rows())
