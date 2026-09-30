import sys; sys.path.insert(0,'.')
exec(open('s5-rest1.py').read().split('# ================= kiosk_counter')[0])
import math

# ================= composer_frames 48x16
def frame(c,x,y,w,h,kind,head,v):
    F=lambda t:k(('vbrass:%d' if kind=='gold' else 'vwood:%d')%t)
    if kind=='gold': hi,body,lo,dk=F(6),F(4),F(2),F(0)
    else: hi,body,lo,dk=F(7),F(5),F(3),F(1)
    c.rect(x,y,w,h,body); c.hl(x,y,w,hi); c.vl(x,y,h,hi); c.hl(x,y+h-1,w,dk); c.vl(x+w-1,y,h,lo)
    c.hl(x+1,y+h-2,w-2,lo) if v=='B' else None
    ix,iy,iw,ih=x+2,y+2,w-4,h-4
    bg=k('vdwood:1') if v!='B' else k('vdwood:0')
    c.rect(ix,iy,iw,ih,bg); c.hl(ix,iy,iw,k('vdwood:0')); c.vl(ix,iy,ih,k('vdwood:0'))
    hair=k('vwhite:5'); hairS=k('vwhite:3'); face=k('vlinen:5'); faceS=k('vlinen:3'); cloth=k('vblack:2'); clothH=k('vblack:4'); cravat=k('vwhite:6')
    cx=ix+iw//2
    # 옷 (아래)
    c.rect(ix+1,iy+ih-3,iw-2,3,cloth); c.hl(ix+1,iy+ih-3,iw-2,clothH)
    c.px(cx,iy+ih-3,cravat); c.px(cx-1,iy+ih-3,cravat) if head!='tall' else None
    if head=='round':      # 둥근 머리 + 옆 말린 곱슬 
        c.rect(cx-2,iy+2,4,4,face); c.hl(cx-2,iy+5,4,faceS)
        c.rect(cx-3,iy+1,6,2,hair); c.hl(cx-3,iy+1,6,k('vwhite:6')); c.rect(cx-3,iy+3,1,3,hair); c.rect(cx+2,iy+3,1,3,hairS)
        c.px(cx-4,iy+4,hair); c.px(cx+3,iy+5,hairS)
        c.pts(k('vblack:1'),cx-1,iy+3,cx,iy+3) if False else None
    elif head=='tall':     # 길쭉한 머리 + 긴 가발
        c.rect(cx-1,iy+2,3,5,face); c.px(cx+1,iy+5,faceS); c.px(cx+1,iy+6,faceS)
        c.rect(cx-2,iy+1,5,2,hair); c.hl(cx-2,iy+1,5,k('vwhite:6'))
        c.rect(cx-2,iy+3,1,5,hair); c.rect(cx+2,iy+3,1,5,hairS); c.px(cx-3,iy+6,hair); c.px(cx+3,iy+7,hairS)
    else:                  # 좁고 작은 머리, 뒤로 묶은 꼬리
        c.rect(cx-1,iy+3,3,4,face); c.px(cx+1,iy+6,faceS); c.px(cx+1,iy+5,faceS)
        c.rect(cx-2,iy+2,5,2,hair); c.hl(cx-2,iy+2,5,k('vwhite:6')); c.px(cx-2,iy+4,hair)
        c.px(cx+3,iy+3,hairS); c.px(cx+3,iy+4,hairS); c.px(cx+3,iy+5,hairS) if False else None
def composer(v):
    c=newc(48,16)
    kinds=[('gold','round'),('wood','tall'),('gold','narrow')]
    for i,(kd,hd) in enumerate(kinds):
        frame(c,i*16+1,1,14,14,kd,hd,v)
    if v=='B':
        for i in range(3):
            c.pts('%',i*16+2,2,i*16+3,2,i*16+2,3)
            c.hl(i*16+2,15,14,'-') if False else None
    if v=='C':
        # 실루엣: 크기 다르게 — 가운데 액자 큼(16x16 전부), 양옆 작음
        c=newc(48,16)
        frame(c,1,3,12,12,'gold','round',v)
        frame(c,15,0,18,16,'wood','tall',v)
        frame(c,35,3,12,12,'gold','narrow',v)
        # 가운데 액자 윗장식
        c.hl(20,0,8,k('vwood:7')); c.pts(k('vwood:7'),22,0,25,0)
    return c
emit3('composer_frames',[lambda:composer('A'),lambda:composer('B'),lambda:composer('C')],
 {'A':'작곡가 초상 액자 셋 — 금·나무·금 틀, 흰 가발 덩이에 살구빛 얼굴, 어두운 옷과 흰 목수건, 머리 모양이 서로 다름(둥근 곱슬·길쭉 긴머리·좁은 묶음머리)',
  'B':'같은 모양에 틀 왼쪽 위 빛(%)·안쪽을 더 어둡게 눌러 초상이 떠 보이게',
  'C':'실루엣 재해석: 가운데 큰 나무 액자를 양옆 작은 금 액자가 낮게 받쳐 높이가 다른 세 장'})

# ================= cleaning_locker 16x32
def cleaning(v):
    c=newc(16,32)
    Lk=lambda t:k('locker:%d'%t); M=lambda t:k('mmetal:%d'%t); P=lambda t:k('vpine:%d'%t); Y=lambda t:k('vyellow:%d'%t)
    top = 4 if v!='C' else 5
    # 빗자루 끝
    if v=='C':
        c.pts(P(4),11,1,11,2,10,3,10,4,9,0) if False else None
        for i in range(5): c.px(11-i//2,4-i,P(4)); c.px(12-i//2,4-i,P(2))
    else:
        c.rect(10,0,2,4,P(4)); c.vl(11,0,4,P(2)); c.hl(10,0,2,P(6))
    # 몸체
    c.rect(1,top,14,26-top+3,Lk(3))   # y top..29
    c.hl(1,top,14,Lk(6)); c.hl(1,top+1,14,Lk(5)); c.vl(1,top,29-top+1,Lk(5)); c.vl(14,top,29-top+1,Lk(2)); c.hl(1,29,14,Lk(0)); c.hl(1,28,14,Lk(1))
    if v=='C':
        c.pts('.',1,4,14,4); c.hl(2,4,12,Lk(5)); c.pts('.',1,3,14,3)
        c.pts(Lk(6),2,4)
    # 문
    dx,dy,dw,dh=3,top+2,10,29-top-3
    c.rect(dx,dy,dw,dh,Lk(4)); c.hl(dx,dy,dw,Lk(2)); c.vl(dx,dy,dh,Lk(2)); c.hl(dx,dy+dh-1,dw,Lk(5)); c.vl(dx+dw-1,dy,dh,Lk(5))
    # 환기 틈
    for i in range(4 if v!='C' else 3):
        y=dy+3+i*3
        c.hl(dx+2,y,6,Lk(0)); c.hl(dx+2,y+1,6,Lk(5)) 
    # 손잡이
    c.rect(11,17,2,4,M(4)); c.vl(11,17,4,M(6)); c.vl(12,17,4,M(2)); c.px(11,17,M(7))
    # 발
    c.rect(2,30,2,1,Lk(0)); c.rect(12,30,2,1,Lk(0))
    if v=='B':
        c.vl(13,top+1,29-top,Lk(2)); c.hl(3,dy+dh-1,10,Lk(6))
        c.hl(1,30,14,'-') if False else None
        c.rect(4,31,11,1,'~'); c.rect(14,30,2,2,'~')
        c.pts('%',2,top+2,2,top+3,3,top+2)
        c.px(3,top+2,Lk(6))
    else:
        c.hl(3,31,11,'-')
    return c
emit3('cleaning_locker',[lambda:cleaning('A'),lambda:cleaning('B'),lambda:cleaning('C')],
 {'A':'청소 도구함 — 좁고 긴 회청색 금속 사물함, 문 한 짝, 환기 틈 4줄, 금속 손잡이, 위로 빗자루 자루 끝이 삐져나옴, 바닥에 짧은 발',
  'B':'같은 모양에 오른쪽 어두운 단, 문 아랫단 하이라이트, 접지 그림자 반투명, 왼쪽 위 빛 번짐(%)',
  'C':'실루엣 재해석: 윗면이 한 칸 낮고 빗자루 자루가 비스듬히 튀어나옴, 환기 틈 3줄'})

# ================= class_clock 16x16
def clock(v):
    c=newc(16,16)
    Bk=lambda t:k('vblack:%d'%t); W=lambda t:k('vwhite:%d'%t)
    cx=cy=7.5
    if v=='C':
        # 철망 보호 시계: 네모 틀 + 둥근 시계
        c.rect(0,0,16,16,k('viron:2'))
        c.hl(0,0,16,k('viron:5')); c.vl(0,0,16,k('viron:4')); c.hl(0,15,16,k('viron:0')); c.vl(15,0,16,k('viron:1'))
        for y in range(16):
            for x in range(16):
                d=math.hypot(x+0.5-8,y+0.5-8)
                if d<=6.6: c.px(x,y,W(6))
                elif d<=7.4: c.px(x,y,Bk(2))
        for x,y in ((1,1),(14,1),(1,14),(14,14)): c.px(x,y,k('viron:6'))
        c.pts('.',0,0,1,0,0,1,15,0,14,0,15,1,0,15,1,15,0,14,15,15,14,15,15,14)
        R=6
    else:
        for y in range(16):
            for x in range(16):
                d=math.hypot(x+0.5-8,y+0.5-8)
                if d<=7.0: c.px(x,y,W(6))
                elif d<=8.0: c.px(x,y,Bk(2))
        R=7
    # 점 12/3/6/9
    off=R-2
    for dx,dy in ((0,-off),(off,0),(0,off),(-off,0)):
        px,py=8+dx,8+dy
        if dx==0: c.rect(7,py-(1 if dy<0 else 0)+(0 if dy<0 else 0) if False else (py if dy>0 else py-1),2,1,Bk(3)) if False else None
    c.rect(7,8-R+1,2,1,Bk(3)); c.rect(7,8+R-2,2,1,Bk(3)); c.rect(8-R+1,7,1,2,Bk(3)); c.rect(8+R-2,7,1,2,Bk(3))
    # 시침: 10시 방향, 분침: 2시 방향 (10:10)
    c.rect(7,7,2,2,Bk(1))
    c.pts(Bk(1),6,6,5,5,6,5,5,6) if False else None
    for (x,y) in ((6,6),(5,5),(6,5),(5,6)): c.px(x,y,Bk(1))
    c.px(4,4,Bk(1)) if v!='C' else None
    for (x,y) in ((9,6),(10,5),(11,4),(10,6),(9,5)) : c.px(x,y,Bk(1))
    if v=='C': c.px(11,4,W(6))
    if v=='B':
        c.pts('&',3,4,4,3,5,2,3,5,2,6) if v=='B' else None
        c.hl(5,15,8,'~') if False else None
        c.pts('~',9,15,10,15,11,14,12,14,13,13,14,12,14,11,15,10) if False else None
    return c
emit3('class_clock',[lambda:clock('A'),lambda:clock('B'),lambda:clock('C')],
 {'A':'교실 벽시계 — 흰 문자판, 검은 테, 시침·분침 굵게 10시 10분, 12·3·6·9시에만 점',
  'B':'같은 시계에 유리 반사(&)를 왼쪽 위 호에 얹음',
  'C':'실루엣 재해석: 둥근 시계를 네모난 회색 철망 틀이 감싼 체육관식 시계'})
