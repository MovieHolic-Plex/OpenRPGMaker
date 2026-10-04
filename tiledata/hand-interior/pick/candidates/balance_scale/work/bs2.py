from w6lib import emit, Cv
from bs import LG
def pan(c,cx,y,strong):
    x0=cx-3
    c.hl(x0,y,7,'g'); c.px(x0+6,y,'d' if strong else 'e')
    c.hl(x0+1,y+1,5,'e'); c.px(x0+1,y+1,'f'); c.px(x0+5,y+1,'c')
    c.hl(x0+2,y+2,3,'c'); c.px(x0+2,y+2,'d'); c.px(x0+4,y+2,'b')
def chains(c,cx,by,py):
    pts=[(-1,1),(1,1),(-1,2),(1,2),(-2,3),(2,3),(-2,4),(2,4)]
    # 보 끝(cx,by) 에서 접시 끝으로 갈라져 내려오는 사슬(py 는 접시 윗변)
    n=py-by
    for k in range(1,n):
        d=1 if k<=n//2-0 else 2
        d=1 if k<n-3 else 2
        col='d'
        c.px(cx-d,by+k,col); c.px(cx+d,by+k,'c' if d else col)
def build(strong,tilt=0):
    c=Cv(16,16)
    # 밑돌
    c.hl(2,12,12,'m'); c.hl(2,13,12,'k'); c.hl(2,14,12,'j')
    c.vl(2,13,2,'l'); c.vl(13,12,3,'i'); c.px(13,12,'k')
    c.hl(3,15,10,'n' if strong else 'h'); 
    if strong:
        c.px(13,14,'h')
    # 기둥 받침
    c.hl(5,11,6,'e'); c.px(5,11,'f'); c.px(10,11,'c'); c.hl(6,10,4,'d'); c.px(6,10,'e')
    for y in range(3,10): c.px(7,y,'f'); c.px(8,y,'c')
    # 보 (선형 기울기)
    def by(x): return 2+(0 if 6<=x<=9 else (tilt if x<6 else -tilt))
    for x in range(3,13):
        y=by(x)
        c.px(x,y,'g' if x<8 else 'f'); c.px(x,y+1,'d' if x<8 else 'c')
    ly=by(3); ry=by(12)
    c.px(2,ly,'e'); c.px(2,ly+1,'c'); c.px(13,ry,'c'); c.px(13,ry+1,'b')
    c.px(7,1,'g'); c.px(8,1,'e'); c.px(7,2,'g'); c.px(8,2,'f')
    c.px(7,3,'e'); c.px(8,3,'c')
    Ly=8+tilt; Ry=8-tilt
    # 사슬 - 삼각
    for cx,b,py in ((3,ly+2,Ly),(12,ry+2,Ry)):
        n=py-b
        for k in range(n):
            d=1 if k<n-2 else 2
            c.px(cx-d,b+k,'d'); c.px(cx+d,b+k,'c')
    pan(c,3,Ly,strong); pan(c,12,Ry,strong)
    # 쇠추 (왼) : 접시 위 3x2
    c.rect(2,Ly-2,3,2,'v'); c.hl(2,Ly-2,3,'q'); c.px(2,Ly-2,'q'); c.px(4,Ly-1,'o'); c.px(3,Ly-1,'v')
    c.px(2,Ly-1,'v') 
    # 금화 (오른)
    c.hl(11,Ry-1,3,'s'); c.px(11,Ry-1,'t'); c.px(13,Ry-1,'u'); c.hl(11,Ry-2,2,'t') 
    c.px(12,Ry-2,'w'); c.px(11,Ry-2,'t')
    return c
if __name__=='__main__':
    for nm,st,t in (('A',0,0),('B',1,0),('C',0,1)):
        c=build(st,t); c.show(); print()
        emit(f'../w6-{nm}.pxg',LG,c.rows())
