import sys; sys.path.insert(0,'tiledata/atlas-pick/work')
from s1lib import G
# ---------------- 조회대 ----------------
PM = {'T':('mconc',5),'S':('mconc',4),'f':('mconc',2),'e':('mconc',1),'k':('mconc',0),'W':('mconc',6),
      'R':('mmetal',5),'r':('mmetal',4),'q':('mmetal',3),'p':('mmetal',2),
      'b':('vblack',2),'B':('vblack',4),'l':('vblack',6)}
def podium(v):
    g = G(48,32,PM)
    if v in 'AB':
        # 위판 (11..18), 앞면 (19..28)
        g.rect(2,11,44,8,'T'); g.hl(2,11,44,'W')
        g.rect(2,19,44,10,'f'); g.hl(2,19,44,'S')
        g.vl(2,19,10,'S'); g.rect(43,19,3,10,'e')
        g.hl(2,28,44,'k')
        # 앞 계단 두 줄 (가운데)
        g.rect(14,23,20,2,'T'); g.rect(14,25,20,2,'S'); g.hl(14,26,20,'f')
        g.rect(11,27,26,2,'T'); g.rect(11,29,26,2,'S'); g.hl(11,30,26,'e'); g.vl(11,29,2,'W')
        g.vl(36,29,2,'e')
    else:
        # C: 계단이 앞 전폭 세 줄, 위판이 조금 좁다
        g.rect(4,11,40,7,'T'); g.hl(4,11,40,'W')
        g.rect(4,18,40,5,'f'); g.hl(4,18,40,'S'); g.rect(41,18,3,5,'e')
        g.rect(2,23,44,2,'T'); g.rect(2,25,44,2,'S'); g.hl(2,26,44,'f')
        g.rect(1,27,46,2,'T'); g.rect(1,29,46,2,'S'); g.hl(1,30,46,'e')
        g.vl(1,29,2,'W'); g.vl(46,29,2,'e')
    # 난간(뒤쪽): 가로 살 두 줄 + 기둥
    L,Rr = (3,44) if v!='C' else (5,42)
    g.hl(L,5,Rr-L+1,'R'); g.hl(L,6,Rr-L+1,'q')
    g.hl(L,9,Rr-L+1,'r'); g.hl(L,10,Rr-L+1,'p')
    for x in range(L,Rr+1,7): g.vl(x,5,7,'r'); g.px(x,5,'R'); g.px(x,11,'p')
    g.vl(Rr,5,7,'q')
    # 마이크 스탠드: 가운데 (x=24) 밑판 y=17
    mx = 24 if v!='C' else 20
    g.hl(mx-2,17,5,'p'); g.hl(mx-1,16,3,'q')
    g.vl(mx,8,9,'q'); g.vl(mx,8,8,'r')
    g.rect(mx-1,4,3,4,'b'); g.px(mx-1,4,'l'); g.vl(mx-1,5,3,'B'); g.hl(mx-1,7,3,'b')
    if v=='B':
        # 그림자·접지
        g.rect(3,25,8,3,'e'); g.rect(37,25,6,3,'e'); g.hl(3,13,42,'W'); g.hl(3,14,0,'W'); g.hl(3,16,42,'S')
        g.hl(3,31,43,'~') ; g.hl(4,29,0,'-')
        g.pts('-',10,31, 9,31)
        g.vl(mx+3,17,1,'~'); g.hl(mx+2,18,4,'-')
    else:
        g.hl(3,31,42,'-')
    return g
PN = {'A':'A: 콘크리트 단 + 앞 계단 두 줄 + 뒤 쇠 난간 + 가운데 마이크 스탠드(윗면 보이는 각)',
      'B':'B: 명암 강화 — 위판 왼쪽 가장자리 밝은 줄, 오른쪽 어두운 면, 마이크 그림자, 바닥 접지 그림자',
      'C':'C: 계단이 앞 전폭 세 줄로 넓고 위판이 좁은 실루엣, 마이크는 왼쪽 치우침'}
# ---------------- 방송 책상 ----------------
DM = {'T':('locker',5),'S':('locker',4),'f':('locker',3),'e':('locker',2),'k':('locker',1),'W':('locker',6),
      'b':('vblack',1),'B':('vblack',3),'c':('vblack',4),'l':('vblack',6),'m':('vblack',5),
      's':('mdglass',4),'t':('mdglass',6),'u':('mdglass',7),
      'R':('vred',4),'G':('vgreen',4),'y':('vyellow',5),
      'M':('mmetal',5),'n':('mmetal',4),'o':('mmetal',3),'p':('mmetal',2),'w':('vwhite',5)}
def monitor(g,x,y,w,v):
    g.rect(x,y,w,9,'b'); g.hl(x,y,w,'m'); g.vl(x,y,9,'m')
    g.rect(x+1,y+1,w-2,6,'s')
    g.hl(x+1,y+1,w-2,'t') if v!='A' else None
    for k in range(3): g.hl(x+2,y+2+k*2,w-4-(k%2)*3,'u' if k==0 else 't')
    g.hl(x,y+8,w,'c')
    g.rect(x+w//2-1,y+9,3,2,'B'); g.hl(x+w//2-3,y+11,7,'c')
def desk(v):
    g = G(48,32,DM)
    top = 12 if v!='C' else 13
    g.rect(1,top,46,15,'T' if v!='B' else 'S'); g.hl(1,top,46,'W'); g.vl(1,top,15,'W')
    g.vl(46,top,15,'f'); g.hl(1,top+14,46,'f')
    if v=='B':
        g.rect(2,top+1,44,3,'T'); g.hl(2,top+13,45,'e'); g.vl(45,top+1,14,'e')
    # 앞면 + 다리
    g.rect(1,27,46,3,'f'); g.hl(1,27,46,'S'); g.hl(1,29,46,'e')
    g.rect(2,27,4,4,'e'); g.rect(42,27,4,4,'e'); g.hl(2,30,4,'k'); g.hl(42,30,4,'k'); g.vl(2,27,3,'f')
    # 모니터 둘 (뒤)
    if v!='C':
        monitor(g,3,1,12,v); monitor(g,33,1,12,v)
    else:
        monitor(g,3,2,12,v); monitor(g,19,1,12,v)
    # 믹서 (앞 가운데)
    mx0,mw = (14,20) if v!='C' else (26,20)
    g.rect(mx0,top+5,mw,9,'b'); g.hl(mx0,top+5,mw,'m'); g.vl(mx0,top+5,9,'m'); g.hl(mx0,top+13,mw,'B'); g.vl(mx0+mw-1,top+5,9,'B')
    for k in range(5):
        x = mx0+3+k*3
        g.vl(x,top+7,5,'c')                        # 슬라이더 줄 1px
        g.px(x,top+8+(k*2)%4,'w')                   # 노브
    g.pts('R',mx0+mw-3,top+6); g.pts('G',mx0+mw-3,top+8)
    g.pts('y',mx0+2,top+6)
    for x in range(mx0+2,mx0+mw-4,3): g.px(x,top+6,'c')
    # 마이크 스탠드(목 휜)
    if v!='C':
        bx = 40
    else:
        bx = 6
    g.hl(bx-2,top+13,5,'p'); g.hl(bx-1,top+12,3,'o')
    g.vl(bx,top+5,8,'n')
    g.hl(bx,top+3,0,'n')
    g.px(bx,top+4,'n'); g.px(bx+1,top+3,'n'); g.px(bx+2,top+3,'n')
    g.rect(bx+2,top+3,3,3,'b'); g.px(bx+2,top+3,'l'); g.hl(bx+2,top+5,3,'B')
    # 헤드폰
    hx = 5 if v!='C' else 16
    g.hl(hx,top+8,6,'c'); g.vl(hx,top+9,3,'c'); g.vl(hx+5,top+9,3,'c')
    g.hl(hx+1,top+7,4,'m')
    g.rect(hx-1,top+11,3,3,'b'); g.rect(hx+4,top+11,3,3,'b'); g.px(hx-1,top+11,'m'); g.px(hx+4,top+11,'m')
    if v=='B':
        g.hl(2,31,45,'~'); g.hl(6,top+14,0,'-')
        g.rect(mx0+1,top+14,mw,1,'-'); 
        g.hl(bx-1,top+14,6,'-')
    else:
        g.hl(3,31,44,'-')
    return g
DN = {'A':'A: 잠금 회색 책상 윗면 ¾, 가운데 믹서(슬라이더 1px 줄·노브·불 빨강/초록), 뒤 모니터 둘, 휜 마이크, 헤드폰',
      'B':'B: 명암 강화 — 윗면 뒷쪽 밝은 띠·앞쪽 어두운 띠, 믹서/마이크/헤드폰 밑 그림자, 모니터 위 밝은 줄',
      'C':'C: 배치 재해석 — 모니터 둘을 왼쪽에 붙이고 믹서를 오른쪽, 마이크는 왼쪽·헤드폰 오른쪽'}
if __name__=='__main__':
    for v in 'ABC':
        podium(v).write('assembly_podium',f's1-{v}',PN[v])
        desk(v).write('broadcast_desk',f's1-{v}',DN[v])
