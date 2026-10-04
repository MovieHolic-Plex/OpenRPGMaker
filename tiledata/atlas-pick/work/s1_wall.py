import sys; sys.path.insert(0,'work')
from s1lib import G

def wall_cols(g, x0, x1, v):
    """벽 세로 띠(x0..x1-1) 를 위에서 아래로 그린다. 16x32 공통 행 구성: 0-13 크림, 14-15 레일, 16-28 징두리, 29-31 걸레받이."""
    W = x1 - x0
    if v == 'A':
        g.rect(x0,0,W,1,'c'); g.rect(x0,1,W,12,'C'); g.rect(x0,13,W,1,'c')
        for x in range(x0,x1):
            if (x*7)%5==0: g.px(x,4,'L'); 
            if (x*5)%7==0: g.px(x,9,'L')
        g.hl(x0,14,W,'H'); g.hl(x0,15,W,'r'); g.hl(x0,16,W,'d')
        g.rect(x0,17,W,12,'m')
        for x in range(x0,x1):
            if x%8==3: g.vl(x,17,12,'l')
            if x%8==7: g.vl(x,17,12,'d')
        g.hl(x0,29,W,'k'); g.hl(x0,30,W,'K'); g.hl(x0,31,W,'B')
    elif v == 'B':
        g.rect(x0,0,W,3,'c'); g.rect(x0,3,W,4,'C'); g.rect(x0,7,W,6,'L'); g.rect(x0,13,W,1,'C')
        for x in range(x0,x1):
            if x%8==1: g.vl(x,3,10,'W')
            if x%8 in (6,7): g.vl(x,3,10,'C') if False else None
        g.hl(x0,14,W,'w'); g.hl(x0,15,W,'H'); g.hl(x0,16,W,'s'); g.hl(x0,17,W,'d')
        g.rect(x0,18,W,11,'m')
        for x in range(x0,x1):
            if x%8 in (1,2): g.vl(x,18,11,'h')
            if x%8 in (3,): g.vl(x,18,11,'l')
            if x%8 in (6,7): g.vl(x,18,11,'d')
        g.hl(x0,29,W,'k'); g.hl(x0,30,W,'K'); g.hl(x0,31,W,'s')
    else:  # C: 나무 손잡이 레일 + 세로 홈판 징두리(락커 회색)
        g.rect(x0,0,W,1,'c'); g.rect(x0,1,W,13,'C')
        for x in range(x0,x1):
            g.px(x,2,'L') if x%4==0 else None
        g.hl(x0,13,W,'c')
        g.hl(x0,14,W,'p'); g.hl(x0,15,W,'q'); g.hl(x0,16,W,'d')
        g.rect(x0,17,W,12,'o')
        for x in range(x0,x1):
            if x%4==0: g.vl(x,17,12,'u')
            if x%4==1: g.vl(x,17,12,'O')
        g.hl(x0,29,W,'p'); g.hl(x0,30,W,'q'); g.hl(x0,31,W,'B')

MATS = {
 'A': {'c':('cream',2),'C':('cream',4),'L':('cream',5),'H':('lino',6),'r':('lino',5),'d':('lino',2),'m':('lino',4),'l':('lino',5),'k':('locker',4),'K':('locker',3),'B':('locker',1)},
 'B': {'c':('cream',2),'C':('cream',3),'L':('cream',4),'W':('cream',5),'H':('lino',5),'w':('lino',6),'s':('lino',1),'d':('lino',2),'m':('lino',3),'h':('lino',5),'l':('lino',4),'k':('locker',4),'K':('locker',3)},
 'C': {'c':('cream',3),'C':('cream',4),'L':('cream',5),'p':('vpine',4),'q':('vpine',2),'d':('vdwood',1),'o':('locker',3),'u':('locker',2),'O':('locker',4),'B':('vdwood',0)},
}
NOTE_W = {'A':'A: 크림 윗벽 + 연녹 리놀륨 징두리(세로 이음) + 회색 걸레받이, 레일 밝은 줄',
          'B':'B: 명암 강화 — 윗벽 위쪽 그늘·아래쪽 밝음, 레일 밑 그림자 줄, 징두리 세로 광택/그늘 반복',
          'C':'C: 나무 손잡이 레일 + 세로 홈판 회색 징두리 + 나무 걸레받이(같은 칸수 다른 실루엣)'}
if __name__ == '__main__':
    for v in 'ABC':
        g = G(16,32,MATS[v]); wall_cols(g,0,16,v)
        g.write('hall_wall', f's1-{v}', NOTE_W[v])
