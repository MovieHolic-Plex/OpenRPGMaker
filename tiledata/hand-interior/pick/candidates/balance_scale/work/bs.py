from w6lib import emit, Cv
LG={}
for i,ch in enumerate('abcdefg'): LG[ch]=f'brass:{i}'
for i,ch in enumerate('nhijklm'): LG[ch]=f'wood:{i}'
LG.update({'r':'iron:1','o':'iron:2','p':'iron:4','q':'iron:5','v':'iron:3',
 'u':'gold:3','s':'gold:4','t':'gold:6','w':'gold:5','~':'P:~','-':'P:-'})

def pan(c,cx,y,strong,dy=0):
    # 접시: 윗변 밝게, 그릇 아래로 좁아짐
    x0=cx-3
    c.hl(x0,y,7,'g'); c.px(x0+6,y,'e' if strong else 'f')
    c.px(x0,y,'g')
    c.hl(x0+1,y+1,5,'e'); c.px(x0+1,y+1,'f'); c.px(x0+5,y+1,'c')
    c.hl(x0+2,y+2,3,'c'); c.px(x0+2,y+2,'d'); c.px(x0+4,y+2,'b')
    if strong: c.px(x0+6,y,'d')
def chains(c,cx,by,py,strong):
    # 보 끝(cx,by) 에서 접시 양끝(cx-2,py)/(cx+2,py) 으로 내려오는 사슬
    n=py-by
    for k in range(1,n):
        d=1 if k<n/2 else 2
        d=min(2, 1+(k*2)//n)
        c.px(cx-d,by+k,'v' if k%2 else 'p'); c.px(cx+d,by+k,'o' if k%2 else 'v')
def build(strong, tilt=0, weights=True, name=''):
    c=Cv(16,16)
    # 밑돌: 윗면(밝음)-앞면-밑
    c.hl(2,12,12,'m'); c.hl(2,13,12,'k'); c.hl(2,14,12,'j'); c.hl(3,15,10,'h')
    c.px(2,12,'m'); c.vl(2,13,3,'l' if strong else 'k'); c.vl(13,12,3,'i'); c.px(13,12,'k')
    c.px(2,15,'.'); c.px(13,15,'.')
    c.px(13,13,'i'); c.px(13,14,'h'); c.hl(3,15,10,'n' if strong else 'h')
    # 기둥 받침 놋쇠
    c.hl(5,11,6,'e'); c.px(5,11,'f'); c.px(10,11,'c'); c.hl(6,10,4,'d'); c.px(6,10,'e'); 
    # 기둥
    for y in range(3,10):
        c.px(7,y,'f'); c.px(8,y,'c')
    # 보
    ly=2+tilt; ry=2-tilt
    for x in range(3,13):
        # 기울기: 보를 두 칸 사이 선형으로
        yy=ly if x<=5 else (ry if x>=10 else 2)
        c.px(x,yy,'g' if x<8 else 'f'); c.px(x,yy+1,'d' if x<8 else 'c')
    c.px(2,ly,'e');c.px(13,ry,'c');c.px(2,ly+1,'c');c.px(13,ry+1,'b')
    # 꼭지 구슬
    c.px(7,1,'g'); c.px(8,1,'e'); c.px(7,0,'.'); 
    c.px(7,2,'g'); c.px(8,2,'f'); c.px(7,3,'e'); c.px(8,3,'c')
    # 사슬
    Ly=8+tilt*2; Ry=8-tilt*2
    chains(c,3,ly+1,Ly,strong); chains(c,12,ry+1,Ry,strong)
    pan(c,3,Ly,strong); pan(c,12,Ry,strong)
    if weights:
        # 왼 접시에 쇠추 (2x2), 오른 접시에 금화 더미
        c.rect(2,Ly-2,3,2,'v'); c.hl(2,Ly-2,3,'q'); c.px(2,Ly-2,'p') ; c.px(4,Ly-1,'o'); c.px(2,Ly-1,'v'); c.px(3,Ly-1,'v')
        c.hl(11,Ry-1,3,'s'); c.px(11,Ry-1,'t'); c.px(13,Ry-1,'u'); c.px(12,Ry-2,'t'); c.px(13,Ry-2,'w') if False else None
    if strong:
        c.hl(3,15,10,'n')
        for x in range(4,14): c.px(x,15,'n')
    return c
if __name__=='__main__':
    for nm,st,t,wt in (('A',0,0,True),('B',1,0,True)):
        c=build(st,t,wt); c.show(); print()
        emit(f'../w6-{nm}.pxg',LG,c.rows())
