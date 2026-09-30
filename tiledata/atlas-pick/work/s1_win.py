import sys; sys.path.insert(0,'tiledata/atlas-pick/work')
from s1lib import G
M = {'F':('mmetal',5),'f':('mmetal',4),'e':('mmetal',3),'d':('mmetal',2),'k':('mmetal',1),
     'g':('mglass',4),'h':('mglass',5),'s':('mglass',3),'w':('mglass',7),'i':('mglass',2),
     'a':('mdglass',3),'b':('mdglass',4),'c':('mdglass',5),'n':('mdglass',2),
     'L':('cream',5),'l':('cream',4),'m':('cream',3),'o':('cream',2),
     'T':('mconc',5),'t':('mconc',4),'u':('mconc',2),'U':('mconc',1)}
def frame(g, x0, y0, x1, y1, v, hi='F', mid='f', lo='e', dk='d'):
    """바깥 틀 (x0..x1, y0..y1 포함). 왼쪽 위 밝게·오른쪽 아래 어둡게."""
    w = x1-x0+1; h = y1-y0+1
    g.rect(x0,y0,w,h,mid)
    g.hl(x0,y0,w,hi); g.vl(x0,y0,h,hi)
    g.hl(x0,y1,w,dk); g.vl(x1,y0,h,dk)
def sill(g, y, v, thick):
    g.hl(0,y,32,'T')
    for j in range(1,thick): g.hl(0,y+j,32,'t')
    g.hl(0,y+thick,32,'u')
    if v=='B':
        g.hl(0,y+thick+1,32,'~')
def glass_class(g, x0,y0,x1,y1,v, kind='g'):
    for y in range(y0,y1+1):
        t=(y-y0)/(y1-y0+1)
        if v=='B': c='h' if t<0.25 else ('g' if t<0.7 else 's')
        else: c='h' if t<0.3 else 'g'
        g.hl(x0,y,x1-x0+1,c)
def build(kind, v):
    g = G(32,32,M)
    hall = kind=='hall'
    top = 5 if hall else 2
    bot = 24 if hall else 26          # 아래 틀 끝 행
    # 위·아래 틀 가로
    frame(g,0,top,31,top+2,v)          # 위 틀 3행
    frame(g,0,bot-1,31,bot,v)          # 아래 틀 2행
    gy0, gy1 = top+3, bot-2
    # 옆 틀(반쪽) 열 0-1, 30-31 + 가운데 겹침 15-16
    for x0,x1 in ((0,1),(30,31),(15,16)):
        frame(g,x0,gy0,x1,gy1,v)
    # 유리 두 짝
    for xa,xb in ((2,14),(17,29)):
        if hall:
            g.rect(xa,gy0,xb-xa+1,gy1-gy0+1,'b')
            # 흐릿한 교실: 책상 윗면 줄
            rows = [gy0+ (gy1-gy0)//2 + 2, gy0 + (gy1-gy0)//2 + 5]
            for r in rows:
                if gy0<=r<=gy1: g.hl(xa+1,r,xb-xa-1,'c')
            g.hl(xa,gy0,xb-xa+1,'a')
            if v=='B':
                g.rect(xa,gy1-2,xb-xa+1,3,'n')
        else:
            glass_class(g,xa,gy0,xb,gy1,v)
    # 유리 반사 사선 (&: 반투명)
    for xa,xb in ((2,14),(17,29)):
        n = 3 if v!='A' else 2
        for k in range(n):
            for j in range(0, gy1-gy0-1):
                x = xa+3+k*4+ (gy1-gy0-j)//2
                if x<=xb: g.px(x,gy0+1+j,'&')
    if v=='C':
        # 위 환기창(고정) 나눔 틀
        ty = gy0+4 if not hall else gy0+3
        g.hl(2,ty,13,'e'); g.hl(17,ty,13,'e')
        g.hl(2,ty+1,13,'d'); g.hl(17,ty+1,13,'d')
        g.hl(2,ty-1,13,'f'); g.hl(17,ty-1,13,'f')
    # 반짝 점
    g.pts('w',3,gy0+1, 18,gy0+1) if v!='A' else g.pts('w',3,gy0+1)
    if kind=='class':
        # 묶은 커튼 (왼쪽)
        cw = 7
        for y in range(gy0, gy1+1):
            for x in range(2,2+cw):
                dx=x-2
                # 위쪽이 넓고 묶음(y~gy0+11)에서 좁아졌다 아래로 다시 벌어진다
                mid=gy0+ (gy1-gy0)*6//10
                width = cw if abs(y-mid)>1 else cw-2
                if y> mid+1: width = cw-1 - (y-mid)//5
                if dx>=width: continue
                c = 'L' if dx%3==0 else ('l' if dx%3==1 else 'm')
                if v=='B': c = {'L':'L','l':'m','m':'o'}[c] if dx>=width-2 else c
                g.px(x,y,c)
        g.hl(2,mid,cw-2,'o') if True else None
        g.px(2+cw-3,mid,'m')
        sill(g,bot+1,v,2)
    else:
        sill(g,bot+1,v,1)
    return g
NOTES = {
 ('class','A'):'A: 알루미늄 두 짝 미닫이(가운데 겹침 틀) + 왼쪽 묶은 크림 커튼 + 콘크리트 창턱, 유리 하늘 톤·사선 반사 둘',
 ('class','B'):'B: 명암 강화 — 유리 위 밝고 아래 어두운 3단, 반사 사선 셋, 커튼 오른쪽 그늘, 창턱 밑 접지 그림자',
 ('class','C'):'C: 같은 칸수에서 위쪽에 고정 환기창 줄을 나눈 두 짝 + 커튼 + 창턱',
 ('hall','A'):'A: 복도 쪽 낮은 미닫이 두 짝, 어두운 유리 안에 흐릿한 책상 줄 둘, 얇은 창턱, 커튼 없음',
 ('hall','B'):'B: 명암 강화 — 교실 안쪽 어두운 3단, 반사 사선 셋, 얇은 창턱 접지 그림자',
 ('hall','C'):'C: 위 환기창 줄을 나눈 복도 창(class_window C 와 같은 가족), 책상 줄 흐릿',
}
if __name__=='__main__':
    for kind,slug in (('class','class_window'),('hall','hall_window')):
        for v in 'ABC':
            build(kind,v).write(slug,f's1-{v}',NOTES[(kind,v)])
