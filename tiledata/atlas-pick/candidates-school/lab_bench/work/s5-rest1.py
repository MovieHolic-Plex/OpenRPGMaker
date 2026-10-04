import sys; sys.path.insert(0,'.')
from s5lib import *
import string
LEG={}; _pool=iter(string.ascii_letters+string.digits+'!@$^*+=_:;,/?')
_rev={}
def k(spec):
    if spec in ('~','-','%','&'): return spec
    if spec not in _rev:
        ch=next(_pool); _rev[spec]=ch; LEG[ch]=spec
    return _rev[spec]
def newc(w,h):
    c=C(w,h,LEG); return c
def ell(c,cx,cy,rx,ry,ch):
    for y in range(c.h):
        for x in range(c.w):
            if ((x+0.5-cx)/rx)**2+((y+0.5-cy)/ry)**2<=1: c.px(x,y,ch)
def emit3(slug,fs,notes):
    for n,f in zip('ABC',fs):
        f().emit(slug,'s5-'+n,notes[n]); 

# ================= kiosk_counter 48x32
def kiosk(v):
    c=newc(48,32)
    P=lambda t:k('vpine:%d'%t); Cr=lambda t:k('cream:%d'%t); G=lambda t:k('mglass:%d'%t)
    Y=lambda t:k('vyellow:%d'%t); R=lambda t:k('vred:%d'%t); W=lambda t:k('vwhite:%d'%t); K=lambda t:k('vblack:%d'%t)
    I=lambda t:k('viron:%d'%t); L=lambda t:k('vlinen:%d'%t)
    if v=='C':
        # 차양 매점: 줄무늬 차양 + 중앙 유리장 + 앞 판
        c.rect(0,0,48,6,R(3)); 
        for x in range(0,48,6): c.rect(x,0,3,6,W(5))
        c.hl(0,0,48,W(6)); c.hl(0,5,48,R(1))
        for x in range(0,48,3): c.px(x+1,6,R(2)); c.px(x+1,7,R(1)) if x%6==0 else None
        c.rect(1,6,2,22,P(1)); c.rect(45,6,2,22,P(1)); c.vl(1,6,22,P(4)); c.vl(46,6,22,P(2))
        # 뒤 어두운 안쪽
        c.rect(3,8,42,8,P(0)); 
        # 유리장 (가운데)
        c.rect(10,10,20,7,G(2)); c.hl(10,10,20,G(5)); c.vl(10,10,7,G(4)); c.vl(29,10,7,G(1))
        c.hl(11,13,18,Cr(3))
        for i,x in enumerate((12,17,22)): 
            c.rect(x,11,4,2,(Y(4),R(4),L(4))[i]); c.hl(x,11,4,(Y(5),R(5),L(5))[i])
        for x in (12,17,23): c.rect(x,14,3,2,W(5)); c.px(x+1,14,W(6)); c.px(x+1,15,K(2))
        # 과자 상자와 계산대 (위 카운터)
        c.rect(33,10,8,6,I(3)); c.rect(34,11,6,2,G(5)); c.hl(33,10,8,I(5)); c.px(35,14,Y(4)); c.px(37,14,R(4))
        c.rect(4,12,4,4,Y(3)); c.hl(4,12,4,Y(4)); c.rect(4,16,4,0,Y(3))
        # 카운터 몸체
        c.rect(0,16,48,3,Cr(4)); c.hl(0,16,48,Cr(5)); c.hl(0,18,48,Cr(2))
        c.rect(0,19,48,10,P(3)); c.hl(0,19,48,P(5)); c.hl(0,28,48,P(1)); c.hl(0,29,48,P(0))
        for x in (11,23,35): c.vl(x,20,8,P(1)); c.vl(x+1,20,8,P(4))
        c.vl(47,19,10,P(2))
        c.hl(1,30,47,'-'); c.hl(3,31,44,'~') if v=='C' else None
        return c
    # A/B: 유리 진열장(왼) + 계산대(오)
    c.rect(0,16,48,3,Cr(4)); c.hl(0,16,48,Cr(5)); c.hl(0,18,48,Cr(2))
    c.rect(0,19,48,10,P(3)); c.hl(0,19,48,P(5)); c.hl(0,28,48,P(1)); c.hl(0,29,48,P(0))
    for x in (15,31): c.vl(x,20,8,P(1)); c.vl(x+1,20,8,P(4))
    c.vl(47,19,10,P(2)); c.vl(0,19,10,P(4))
    # 유리 진열장 x1..32 y7..15
    c.rect(1,7,32,9,G(2)); c.hl(1,7,32,I(4)); c.hl(1,15,32,I(2)); c.vl(1,7,9,I(4)); c.vl(32,7,9,I(1))
    c.hl(2,11,30,Cr(4)); c.hl(2,12,30,Cr(2))   # 중간 선반
    # 위 칸: 빵 봉지
    bags=[(3,Y(4),Y(5)),(9,R(4),R(5)),(15,L(4),L(5)),(21,Y(3),Y(4)),(27,R(3),R(4))]
    for x,a,b in bags:
        c.rect(x,8,5,3,a); c.hl(x,8,5,b); c.px(x+2,9,W(5)) if x in (3,21) else None
    # 아래 칸: 주먹밥(흰 삼각) + 봉지
    for x in (3,9,15):
        c.pts(W(6),x+2,13, x+1,14, x+2,14, x+3,14); c.pts(W(5),x+1,15,x+2,15,x+3,15); c.px(x+2,15,K(2)) 
        c.px(x+2,13,W(6))
    for x,a,b in ((22,Y(3),Y(4)),(27,R(3),R(4))):
        c.rect(x,12,5,3,a); c.hl(x,12,5,b)
    if v=='B':
        for i in range(5): c.px(3+i*2,8+ (i%2)*0,'&') if False else None
        # 유리 반사 &
        c.pts('&',2,8,3,8,4,9,5,9,2,9)
        c.pts('&',25,8,26,8,27,8,28,9,29,9,26,9)
        c.hl(2,14,0,'&')
        c.pts('&',2,13,2,14,3,14) if False else None
    # 과자 상자(위)
    c.rect(4,2,11,5,R(3)); c.hl(4,2,11,R(5)); c.vl(4,2,5,R(4)); c.vl(14,2,5,R(1)); c.hl(4,6,11,R(1)); c.rect(5,3,9,2,Y(4)); c.hl(5,3,9,Y(5))
    c.pts(R(2),7,4,9,4,11,4)
    # 계산대
    c.rect(36,8,10,8,I(3)); c.hl(36,8,10,I(5)); c.vl(36,8,8,I(4)); c.vl(45,8,8,I(1)); c.hl(36,15,10,I(1))
    c.rect(37,9,6,3,G(5)); c.hl(37,9,6,G(6)); c.rect(37,13,2,1,W(3)); c.rect(40,13,2,1,W(3)); c.px(43,13,R(3))
    if v=='B':
        c.pts('&',38,10,39,10,38,11)
        c.rect(0,29,48,1,P(0))
        c.hl(1,30,47,'-'); c.hl(2,31,45,'~')
        c.vl(46,19,10,P(1)); c.hl(1,26,46,P(2)) if False else None
        # 진열장 그림자 아래 카운터 윗면
        c.hl(1,17,32,Cr(3))
    else:
        c.hl(1,30,47,'-')
    return c
emit3('kiosk_counter',[lambda:kiosk('A'),lambda:kiosk('B'),lambda:kiosk('C')],
 {'A':'매점 계산대 — 소나무 몸체·크림 상판, 왼쪽 유리 진열장(빵 봉지·삼각 주먹밥), 위에 과자 상자, 오른쪽 작은 계산기',
  'B':'같은 구성에 유리 반사(&)와 접지 그림자 두 줄, 상판 안쪽 그늘',
  'C':'실루엣 재해석: 줄무늬 차양이 씌워진 매점 창구 — 가운데 작은 유리장, 양옆 기둥, 과자 상자·계산기는 뒤 선반'})

# ================= bulletin_board 32x32
def paper(c,x,y,w,h,col,hi,tilt,pin,txt):
    for j in range(h):
        off = 0 if tilt==0 else ((j*2)//h if tilt>0 else -((j*2)//h))
        c.hl(x+off,y+j,w,col)
        c.px(x+off+w,y+j,k('cork:1'))   # 오른쪽 그림자
        if txt and j>=3 and (j%2==1) and j<h-1: c.hl(x+off+1,y+j,w-3,txt)
    c.hl(x,y,w,hi)
    c.hl(x+1,y+h,w,k('cork:1'))
    c.px(x+w//2,y,pin)
def bulletin(v):
    c=newc(32,32)
    D=lambda t:k('vdwood:%d'%t); CK=lambda t:k('cork:%d'%t)
    W=k('vwhite:6'); Wh=k('vwhite:5'); Wt=k('vwhite:2'); Ye=k('vyellow:6'); Yh=k('vyellow:5'); Yt=k('vyellow:3')
    Pk=k('vred:6'); Pkh=k('vred:5'); Pkt=k('vred:4'); Bl=k('vblue:6'); Blt=k('vblue:4')
    pr=k('vred:3'); pb=k('vblue:3')
    c.rect(0,0,32,32,D(3)); c.hl(0,0,32,D(6)); c.vl(0,0,32,D(5)); c.hl(0,31,32,D(1)); c.vl(31,0,32,D(2))
    c.hl(1,1,30,D(5)); c.vl(1,1,30,D(4)); c.hl(1,30,30,D(2)); c.vl(30,1,30,D(2))
    c.rect(2,2,28,28,CK(3))
    import random; rnd=random.Random(7)
    for _ in range(60):
        x=rnd.randrange(2,30); y=rnd.randrange(2,30); c.px(x,y,CK(2 if rnd.random()<.5 else 4))
    c.hl(2,2,28,CK(1)); c.vl(2,2,28,CK(2)) if v!='A' else None
    if v in ('A','B'):
        paper(c,4,4,10,9,W,Wh,0,pr,Wt)
        paper(c,17,4,8,10,Ye,Yh,1,pb,Yt)
        paper(c,5,16,7,9,Pk,Pkh,-1,pb,Pkt)
        paper(c,15,17,11,8,W,Wh,1,pr,Wt)
        paper(c,25,7,3,7,Bl,Bl,0,pr,None) if False else None
        paper(c,13,26,6,3,Ye,Yh,0,pr,None)
        if v=='B':
            c.rect(2,2,28,1,CK(1)); c.rect(2,3,28,1,CK(2)); c.rect(29,3,1,26,CK(1))
            c.hl(1,30,30,D(1)); c.hl(1,31,30,D(0)); c.rect(30,1,1,30,D(1))
            c.pts('%',3,3,4,3,5,3,3,4)
    else:
        # 실루엣: 겹친 종이 더미를 여러 겹으로, 한 장은 모서리가 접힘, 액자 가운데 가로 걸침대
        paper(c,3,3,14,12,W,Wh,0,pr,Wt)
        paper(c,12,7,14,12,Ye,Yh,-1,pb,Yt)
        paper(c,4,17,12,11,Pk,Pkh,1,pb,Pkt)
        paper(c,19,21,9,7,Bl,Bl,0,pr,Blt)
        c.rect(16,15,4,4,k('vwhite:4')); c.pts(CK(1),19,15,19,16,18,17)
        c.hl(3,15,14,W) if False else None
    c.pts('.',0,0,1,0,0,1,31,0,30,0,31,1,0,31,1,31,0,30,31,31,30,31,31,30)
    return c
emit3('bulletin_board',[lambda:bulletin('A'),lambda:bulletin('B'),lambda:bulletin('C')],
 {'A':'코르크 게시판 — 짙은 나무 틀, 흰·연노랑·연분홍 종이 네다섯 장이 살짝 기울어 압정(빨강·파랑)으로 고정, 종이 안에 희미한 글줄',
  'B':'같은 판에 틀 안쪽 윗그늘, 종이 아래 그림자, 왼쪽 위 빛 번짐(%)',
  'C':'실루엣 재해석: 종이 대여섯 장이 서로 겹치고 한 장은 모서리가 접힌 빽빽한 게시판'})

# ================= vaulting_box 32x32
def vault(v):
    c=newc(32,32)
    P=lambda t:k('vpine:%d'%t); W=lambda t:k('vwhite:%d'%t); L=lambda t:k('vlinen:%d'%t)
    if v=='C':
        # 계단식: 단마다 폭 줄어듦, 쿠션은 작게
        tiers=[(2,21,28,6),(5,15,22,6),(8,10,16,5)]  # x, y, w, h  (아래→위)
        widths=[(1,22,30),(4,17,24),(7,12,18),(10,8,12)]
    for _ in (0,):
        pass
    if v!='C':
        # 쿠션 윗면 (위에서 살짝)
        c.rect(2,4,28,5,W(6)); c.hl(2,4,28,W(6)); c.hl(3,3,26,W(5)); c.hl(2,8,28,W(4)); c.vl(2,4,5,W(5)); c.vl(29,4,5,W(3))
        c.pts(L(3),8,6,16,5,23,6)
        c.hl(3,9,26,L(2))
        # 단 4
        ys=[10,15,20,25]
        for i,y in enumerate(ys):
            c.rect(2,y,28,5,P(3)); c.hl(2,y,28,P(5)); c.hl(2,y+4,28,P(1)); c.vl(2,y,5,P(4)); c.vl(29,y,5,P(2))
        # 손잡이 구멍
        for x,y in ((9,16),(20,21)): c.rect(x,y,5,2,P(0)); c.hl(x,y,5,P(0)); c.hl(x+1,y+2,3,P(5)) if False else None
        c.pts(P(3),9,17,13,17)
        c.rect(2,29,28,1,P(0))
        if v=='B':
            c.rect(24,10,5,19,P(2)); c.vl(23,10,19,P(2))
            for y in (10,15,20,25): c.hl(2,y,21,P(6)); c.hl(2,y+1,21,P(4))
            c.pts('%',3,4,4,4,5,4)
            c.hl(3,30,27,'-'); c.hl(4,31,26,'~'); c.rect(28,4,2,5,W(3))
        else:
            c.hl(3,30,27,'-')
    else:
        # 계단식 실루엣
        def tier(x,y,w,h):
            c.rect(x,y,w,h,P(3)); c.hl(x,y,w,P(5)); c.hl(x,y+h-1,w,P(1)); c.vl(x,y,h,P(4)); c.vl(x+w-1,y,h,P(2))
        tier(1,23,30,6); tier(4,17,24,6); tier(7,12,18,5)
        c.rect(6,25,4,2,P(0)); c.rect(21,25,4,2,P(0))
        c.rect(12,14,7,2,P(0))
        # 쿠션 (위)
        c.rect(8,6,16,6,W(6)); c.hl(9,5,14,W(5)); c.hl(8,11,16,W(4)); c.vl(23,6,6,W(3)); c.pts(L(3),13,8,18,8)
        c.hl(2,29,28,P(0)); c.hl(3,30,27,'-'); c.hl(5,31,25,'~')
    return c
emit3('vaulting_box',[lambda:vault('A'),lambda:vault('B'),lambda:vault('C')],
 {'A':'뜀틀 — 소나무 4단, 단마다 어두운 이음선, 손잡이 구멍 두 개, 위에 흰 가죽 쿠션(윗면이 살짝 보임)',
  'B':'같은 모양에 오른쪽 그늘 단·단 윗선 밝기 대비·접지 그림자 2줄, 쿠션 왼쪽 위 빛',
  'C':'실루엣 재해석: 단이 위로 갈수록 좁아지는 3단 계단식 뜀틀, 쿠션이 작다'})
