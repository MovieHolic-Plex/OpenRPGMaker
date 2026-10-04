"""버들항 변형 1번 — 강가 물레방아 마을용 새 조각(손 도트, Python/Pillow). 버들항 v6 의 px2 엔진과 팔레트를 그대로 쓴다.
3/4 시점(윗면+앞면), 빛 왼쪽 위. 생성 이미지·외부 그림 복사 없음."""
import bdv, math
from bdv import px2, pz, Image
from bdv_market import _rect, _plank_front, _disc, _h
C=px2.C

def _lit(x,y,cx,cy):
    """왼쪽 위가 밝은 단계(2..5)."""
    d=(x-cx)+(y-cy)*0.6
    return 5 if d<-4 else 4 if d<1 else 3 if d<5 else 2

# ------------------------------------------------------------------ 물레방아 (정면, 위에서 물을 받는 윗물받이식)
def waterwheel(seed=1):
    """물레방아 48x64: 바퀴 반지름 22, 살 여덟, 물받이 널 열두 장, 두 기둥. 위 왼쪽 홈통에서 물이 떨어진다. 아래 22px 는 물에 잠긴다."""
    W,H=48,64; cx,cy=24,30; c=C(W,H,seed=seed*7+1100)
    c.group(1); c.new()
    for px_ in (2,42):                                            # 받침 기둥 둘 (바퀴 뒤)
        for y in range(20,61):
            for x in range(px_,px_+4):
                c.tone(x,y,'bark',5 if x==px_ else 3 if x<px_+3 else 2)
        for x in range(px_-1,px_+5): c.tone(x,20,'bark',5); c.tone(x,21,'bark',3)
    c.new()                                                       # 홈통 (물을 바퀴 꼭대기로)
    for x in range(0,26):
        c.tone(x,1,'wood',5); c.tone(x,2,'wood',4)
        for y in range(3,6): c.tone(x,y,'wood',3 if y<5 else 2)
    for y in range(0,7): c.tone(0,y,'wood',4); c.tone(1,y,'wood',3)
    for x in range(2,25):                                          # 홈통 속 물
        c.tone(x,2,'teal',5 if x%5 else 6)
    c.new()                                                       # 바퀴 두께 = 윗면 (뒤 테를 4px 위로 밀어 초승달로 보인다)
    for y in range(0,cy+1):
        for x in range(cx-24,cx+25):
            db=math.hypot(x+.5-cx,y+.5-(cy-4)); df=math.hypot(x+.5-cx,y+.5-cy)
            if df>22.0 and db<=23.0:
                c.tone(x,y,'wood',4 if db>21.6 else (6 if x<cx+6 else 5))
    c.new()                                                       # 물받이 널 (바퀴 둘레 바깥으로 1px)
    NP=12
    for k in range(NP):
        a=k*2*math.pi/NP+0.13
        for r in range(17,24):
            for w in (-2,-1,0,1,2):
                x=int(round(cx+math.cos(a)*r-math.sin(a)*w)); y=int(round(cy+math.sin(a)*r+math.cos(a)*w))
                if r>=24: t=2
                else: t=5 if math.cos(a)<-0.2 or math.sin(a)<-0.6 else 3 if math.cos(a)<0.5 else 2
                if abs(w)==2: t=max(1,t-1)
                c.tone(x,y,'wood',t)
    c.new()                                                       # 테두리 두 겹
    for y in range(cy-23,cy+24):
        for x in range(cx-23,cx+24):
            d=math.hypot(x+.5-cx,y+.5-cy)
            if 19<=d<=22 or 13.2<=d<=14.6:
                c.tone(x,y,'bark',_lit(x,y,cx,cy) if d>15 else 3)
    c.new()                                                       # 살 여덟
    for k in range(8):
        a=k*math.pi/4+0.13
        for r in range(3,20):
            for w in (0,1):
                x=int(round(cx+math.cos(a)*r-math.sin(a)*w)); y=int(round(cy+math.sin(a)*r+math.cos(a)*w))
                c.tone(x,y,'wood',5 if (math.cos(a)<0 or math.sin(a)<-0.5) and w==0 else 3 if w==0 else 2)
    c.new()
    _disc(c,cx,cy,4,'bark',lambda x,y:_lit(x,y,cx,cy))            # 굴대 통
    _disc(c,cx,cy,2,'iron',lambda x,y:4 if x<cx else 2)
    c.tone(cx-1,cy-1,'iron',6)
    im=pz.fin(c)
    # 물에 잠긴 아래쪽: 물빛을 덮고 잘 안 보이게, 수면선에 거품
    WL=46; px=im.load()
    for y in range(WL,H):
        k=min(1.0,0.5+(y-WL)*0.03)
        for x in range(W):
            r,g,b,a=px[x,y]
            if a:
                px[x,y]=(int(r*(1-k)+52*k),int(g*(1-k)+104*k),int(b*(1-k)+128*k),int(a*0.85))
    for x in range(W):
        if px[x,WL][3] and _h(x,0,seed+5)>0.35: px[x,WL]=(226,240,240,255)
        if px[x,WL-1][3] and _h(x,1,seed+6)>0.7: px[x,WL-1]=(226,240,240,255)
    for y in range(8,22):                                         # 홈통 끝에서 떨어지는 물줄기
        x=23+int(_h(y,0,seed)*2)
        if im.getpixel((x,y))[3]==0 or True:
            if px[x,y][3]==0: px[x,y]=(150,200,214,200)
    return im

# ------------------------------------------------------------------ 나무 널다리 (동서로 놓인 사람 다리)
def plank_footbridge(wc=4,seed=1):
    """나무 널다리: 물 wc 칸 + 양쪽 둑 8px 씩. 64 높이(4칸): 위 한 칸=먼 난간, 가운데 두 칸=널 바닥, 아래 한 칸=앞면·다리발·물그늘."""
    RW=wc*16; W=RW+16; H=64; c=C(W,H,seed=seed*3+1110)
    c.group(1); c.new()
    def post(x,y0,y1):
        for y in range(y0,y1):
            for xx in (x,x+1,x+2): c.tone(xx,y,'bark',5 if xx==x else 3 if xx==x+1 else 2)
        for xx in (x,x+1,x+2): c.tone(xx,y0-1,'bark',5 if xx==x else 4)
    # 먼 난간
    for x in range(2,W-2):
        c.tone(x,4,'wood',5); c.tone(x,5,'wood',4); c.tone(x,11,'wood',3)
    for x in range(0,W,16):
        post(x+(1 if x==0 else 0) if x<W-2 else W-3,2,16)
    post(W-3,2,16)
    c.new()
    # 널 바닥 (가로 널, 폭 4px 마다 틈)
    for y in range(16,48):
        i=(y-16)//4; ly=(y-16)%4
        for x in range(0,W):
            t=4 if ly<3 else 1
            if ly==0: t=5
            if _h(x//9,i,seed)>0.8: t-=1
            if x<3: t=max(1,t-1)
            c.tone(x,y,'wood',max(1,min(6,t)))
    # 널 못
    for i in range(8):
        for x in (3,W-4):
            c.tone(x,16+i*4+1,'iron',3)
    c.new()
    # 앞면 (바닥 두께 + 다리발)
    for y in range(48,54):
        for x in range(0,W): c.tone(x,y,'wood',3 if y<51 else 2)
    for x in range(0,W): c.tone(x,48,'wood',5)
    for x in range(0,W,16):
        for y in range(48,60):
            for xx in (x+5,x+6,x+7,x+8): c.tone(xx,y,'bark',4 if xx==x+5 else 3 if xx<x+8 else 2)
    # 가까운 난간
    c.new()
    for x in range(2,W-2):
        c.tone(x,36,'wood',5); c.tone(x,37,'wood',4); c.tone(x,43,'wood',3)
    for x in range(0,W,16):
        post(min(x,W-3) if x else 1,34,50)
    post(W-3,34,50)
    im=pz.fin(c)
    # 물 위 그림자 (양쪽 둑 8px 는 제외)
    px=im.load()
    for y in range(58,64):
        for x in range(10,W-10):
            if px[x,y][3]==0: px[x,y]=(14,30,44,int(110-(y-58)*14))
    return im

# ------------------------------------------------------------------ 맷돌 (누운 것 하나, 세운 것 하나)
def millstones(seed=1):
    """맷돌 32x30: 누워 있는 맷돌(윗면 타원 + 홈 + 두께), 벽에 기대 세운 맷돌, 돌 부스러기."""
    W,H=32,30; c=C(W,H,seed=seed*5+1120); c.shadow(16,26,15,2.5,a=85)
    c.group(1); c.new()
    # 세운 맷돌 (뒤, 오른쪽)
    for y in range(3,20):
        for x in range(17,30):
            nx=(x+.5-23.5)/6.5; ny=(y+.5-11.5)/8.5
            if nx*nx+ny*ny<=1:
                d=nx*nx+ny*ny
                t=5 if nx<-0.35 else 4 if nx<0.35 else 3
                if d>0.72: t-=1
                if _h(x,y,seed)>0.86: t-=1
                c.tone(x,y,'mstone',max(1,min(6,t)))
    _disc(c,23.5,11.5,1.6,'dark',lambda x,y:1)
    for k in range(6):
        a=k*math.pi/3
        for r in range(3,7): c.tone(int(23.5+math.cos(a)*r),int(11.5+math.sin(a)*r*1.2),'mstone',2)
    c.new()
    # 누운 맷돌 (앞, 왼쪽): 두께 6px + 윗면 타원
    cx,cy=13,17
    for y in range(cy,cy+7):
        for x in range(1,26):
            nx=(x+.5-cx)/12.5
            if abs(nx)<=1: c.tone(x,y,'stone',4 if nx<-0.4 else 3 if nx<0.4 else 2)
    for y in range(6,cy+3):
        for x in range(0,27):
            nx=(x+.5-cx)/12.8; ny=(y+.5-cy)/8.5
            if nx*nx+ny*ny<=1:
                t=5 if nx<-0.3 else 4
                if _h(x,y,seed+2)>0.85: t-=1
                c.tone(x,y,'mstone',t if nx*nx+ny*ny<0.85 else t-1)
    for k in range(10):                                           # 갈이 홈: 방사선
        a=k*math.pi/5
        for r in range(3,11):
            x=int(cx+math.cos(a)*r); y=int(cy-2+math.sin(a)*r*0.62)
            c.tone(x,y,'mstone',2)
    _disc(c,cx,cy-2,2.4,'dark',lambda x,y:1)                      # 가운데 구멍
    c.tone(cx-1,cy-3,'mstone',3)
    c.new()
    for (x,y) in ((27,25),(29,23),(3,25),(28,26)): c.tone(x,y,'stone',4); c.tone(x+1,y,'stone',3)
    return pz.fin(c)

# ------------------------------------------------------------------ 밀 단 세움 (밭 가장자리)
def wheat_stooks(v=0,seed=1):
    """베어 세운 밀 단 32x30 (v=0: 셋, v=1: 둘). 원뿔 모양, 허리를 짚끈으로 묶었다."""
    W,H=32,30; c=C(W,H,seed=seed*9+1130+v); c.shadow(16,27,14,2.4,a=80)
    sp=[(9,26,11),(22,25,10),(16,17,9)] if v==0 else [(10,26,12),(23,26,11)]
    c.group(1); c.new()
    for cx,by,hh in sp:
        c.new()
        top=by-int(hh*2.2)
        for y in range(top,by+1):
            prof=(y-top)/(by-top+1e-9)
            hw=max(1,int(1+prof*hh*0.62))
            for x in range(cx-hw,cx+hw+1):
                nx=(x+.5-cx)/(hw+.5)
                t=5 if nx<-0.4 else 4 if nx<0.25 else 3 if nx<0.7 else 2
                if _h(x,y//2,seed+cx)>0.7: t-=1
                if (x+y)%5==0 and prof>0.3: t=max(1,t-1)
                c.tone(x,y,'gold',max(1,min(6,t)))
        for x in range(cx-int(hh*0.62*0.55)-1,cx+int(hh*0.62*0.55)+2):   # 끈
            c.tone(x,top+int((by-top)*0.42),'rope',3); c.tone(x,top+int((by-top)*0.42)+1,'rope',2)
        for k in range(-2,3):                                     # 삐져나온 이삭
            c.tone(cx+k,top-1,'gold',5 if k<=0 else 4)
        c.tone(cx-1,top-2,'gold',5); c.tone(cx+1,top-2,'gold',4)
    return pz.fin(c)

# ------------------------------------------------------------------ 허수아비
def scarecrow(seed=1):
    """허수아비 32x44: 기둥+가로대, 자루 머리에 밀짚모자, 낡은 청록 윗옷, 어깨에 까마귀 한 마리."""
    W,H=32,44; c=C(W,H,seed=seed*3+1140); c.shadow(16,41,8,1.8,a=85)
    c.group(1); c.new()
    for y in range(12,38):
        for x in (15,16): c.tone(x,y,'bark',4 if x==15 else 2)
    c.new()                                                       # 돌 받침 (윗면 4줄 + 앞면 2줄)
    for y in range(37,43):
        for x in range(10,23):
            if y<41: c.tone(x,y,'stone',5 if (y==37 and x<16) else 4)
            else: c.tone(x,y,'stone',3 if y==41 else 2)
    c.new()
    for x in range(3,29):                                         # 가로대
        c.tone(x,17,'wood',5); c.tone(x,18,'wood',3)
    c.new()
    for y in range(17,31):                                        # 윗옷
        hw=6+(1 if y>24 else 0)
        for x in range(16-hw,16+hw):
            t=4 if x<14 else 3 if x<17 else 2
            if _h(x,y,seed)>0.85: t-=1
            c.tone(x,y,'teal',t)
    for x in range(6,26):                                         # 소매
        for y in (18,19,20):
            if x<10 or x>21: c.tone(x,y,'teal',3 if x<16 else 2)
    for x in (4,5,26,27):                                         # 소매 끝 짚
        for y in range(20,23): c.tone(x,y,'gold',5 if x<16 else 3)
    for x in range(12,20): c.tone(x,29,'rope',3)                  # 허리끈
    c.new()
    for y in range(7,16):                                         # 자루 머리
        for x in range(12,20):
            if (x-15.5)**2/16+(y-11)**2/20<=1: c.tone(x,y,'cloth',5 if x<15 else 4)
    c.tone(14,11,'dark',1); c.tone(17,11,'dark',1)
    for x in range(14,18): c.tone(x,14,'dark',2)
    c.new()
    for y in range(3,8):                                          # 밀짚모자: 챙 넓게 + 봉
        for x in range(9,23):
            if y>=6 or 12<=x<=19: c.tone(x,y,'gold',5 if x<15 else 4 if y<7 else 3)
    for x in range(8,24): c.tone(x,7,'gold',3)
    c.new()
    for y in range(13,16):                                        # 어깨 까마귀
        for x in range(22,28):
            c.tone(x,y,'dark',3 if y==13 else 2)
    c.tone(28,14,'gold',5); c.tone(23,12,'dark',2); c.tone(24,12,'dark',3)
    return pz.fin(c)

# ------------------------------------------------------------------ 빨랫줄
def laundry_line(seed=1):
    """빨랫줄 48x40: 기둥 둘, 줄 하나, 빨래 넷(흰 천·청록 옷·붉은 천·자루옷)."""
    W,H=48,40; c=C(W,H,seed=seed*3+1150); c.shadow(24,37,22,2,a=70)
    c.group(1); c.new()
    for px_ in (2,44):
        for y in range(3,32):
            for x in (px_,px_+1): c.tone(x,y,'bark',4 if x==px_ else 2)
        c.tone(px_,2,'bark',5); c.tone(px_+1,2,'bark',3)
        for y in range(32,38):                                    # 돌 받침 (윗면 4줄 + 앞면 2줄)
            for x in range(px_-2,px_+4):
                if y<36: c.tone(x,y,'stone',5 if (y==32 and x<px_+1) else 4)
                else: c.tone(x,y,'stone',3 if y==36 else 2)
    def line_y(x): return 5+int(1.6*math.sin((x-2)/42*math.pi))
    c.new()
    def cloth(x0,w,h,mat,tones):
        c.new()
        for x in range(x0,x0+w):
            for y in range(line_y(x)+1,line_y(x)+1+h+(1 if (x-x0)%3==1 else 0)):
                t=tones[0] if x<x0+w*0.35 else tones[1] if x<x0+w*0.75 else tones[2]
                if y==line_y(x)+1: t+=1
                if _h(x,y,seed+x0)>0.9: t-=1
                c.tone(x,y,mat,max(1,min(6,t)))
    cloth(6,9,16,'cream',(5,4,3)); cloth(17,8,11,'teal',(4,3,2)); cloth(27,7,17,'red',(4,3,2)); cloth(36,6,9,'cream',(5,4,3))
    c.new()
    for x in range(3,45): c.tone(x,line_y(x),'rope',4)
    for x0 in (8,12,19,23,29,33,38,41): c.tone(x0,line_y(x0)+1,'wood',5)   # 집게
    return pz.fin(c)

# ------------------------------------------------------------------ 밀가루 손수레
def flour_cart(seed=1):
    """밀가루 손수레 48x38: 외바퀴 없는 두 바퀴 손수레, 흰 밀가루 자루 셋, 앞으로 손잡이."""
    W,H=48,38; c=C(W,H,seed=seed*7+1160); c.shadow(24,34,21,2.6,a=85)
    c.group(1); c.new()
    for y in range(18,21):                                      # 짐칸 윗테 (안쪽 어둡고 앞 테두리 밝다)
        for x in range(6,38):
            c.tone(x,y,'wood',2 if y==18 else 5 if x<22 else 4)
    _plank_front(c,6,21,38,29,'wood',seed=seed+1,pw=5)
    for x in range(6,38): c.tone(x,21,'wood',5); c.tone(x,28,'wood',2)
    for x in (6,7,37):
        for y in range(21,29): c.tone(x,y,'bark',3 if x<37 else 2)
    for i,(sx,sy) in enumerate(((7,7),(16,7),(25,7))):          # 자루 셋 (윗면 4줄, 짐칸 윗테 위로 솟음)
        c.new()
        for y in range(sy,19):
            for x in range(sx,sx+11):
                nx=(x-sx)/10
                t=4 if nx<0.35 else 3 if nx<0.7 else 2
                if y<sy+5: t=6 if nx<0.5 else 5
                if _h(x,y,seed+i)>0.93 and y>=sy+5: t-=1
                c.tone(x,y,'cream',max(1,t))
        for x in range(sx,sx+11): c.tone(x,sy+5,"rope",3)
    c.new()
    for wx in (14,31):
        _disc(c,wx,30,6,'bark',lambda x,y: 5 if (x+y)%7==0 else 3 if x<wx else 2)
        _disc(c,wx,30,4,'wood',lambda x,y: 1)
        for k in range(8):
            a=k*math.pi/4
            for r in range(1,5): c.tone(int(wx+math.cos(a)*r),int(30+math.sin(a)*r),'wood',4 if k%2 else 3)
        _disc(c,wx,30,1.3,'iron',lambda x,y:4)
    c.new()
    for x in range(38,47):
        c.tone(x,25,'wood',4); c.tone(x,26,'wood',2)
    c.tone(46,24,'wood',3)
    return pz.fin(c)

# ------------------------------------------------------------------ 수문 (물레방아 앞 물막이)
def sluice_gate(seed=1):
    """수문 32x40: 나무 기둥 둘 사이에 올려 둔 널문, 위에 감아올리는 손잡이 축과 톱니바퀴, 문 밑으로 흐르는 물자국."""
    W,H=32,40; c=C(W,H,seed=seed*3+1170); c.shadow(16,37,14,2,a=70)
    c.group(1); c.new()
    for px_ in (2,25):
        for y in range(6,38):
            for x in range(px_,px_+5): c.tone(x,y,'bark',5 if x==px_ else 4 if x==px_+1 else 3 if x<px_+4 else 2)
        for x in range(px_,px_+5): c.tone(x,5,'bark',5)
    c.new()
    for x in range(7,25):                                          # 올려 둔 널문(윗부분)
        for y in range(15,26):
            t=4 if (x-7)%5 else 1
            if y<17: t=5
            c.tone(x,y,'wood',t)
    for y in range(26,37):                                         # 문 아래로 흐르는 물
        for x in range(7,25):
            c.tone(x,y,'teal',5 if (x+y)%4==0 else 4 if x<15 else 3)
    c.new()
    for x in range(1,31):                                          # 위 가로보: 윗면 5줄 + 앞면 3줄
        for y in range(7,12): c.tone(x,y,'wood',6 if (y==7 and x<14) else 5)
        for y in range(12,15): c.tone(x,y,'wood',3 if y<14 else 2)
    _disc(c,16,4,3.4,'iron',lambda x,y:4 if x<16 else 2)         # 감아올리는 축
    for k in range(6):
        a=k*math.pi/3
        c.tone(int(16+math.cos(a)*4.5),int(4+math.sin(a)*4.5),'iron',5)
    for y in range(13,17): c.tone(16,y,'rope',3); c.tone(17,y,'rope',2)                       # 끌어올리는 줄
    return pz.fin(c)

# ------------------------------------------------------------------ 둥근 짚가리
def haystack(seed=1):
    """둥근 짚가리 32x34: 가운데 장대, 꼭대기 뾰족, 옆에 짚 결 줄무늬."""
    W,H=32,34; c=C(W,H,seed=seed*3+1180); c.shadow(16,31,14,2.6,a=85)
    c.group(1); c.new()
    for y in range(4,31):
        prof=(y-4)/26
        hw=max(2,int(3+math.sin(min(1,prof*1.1)*math.pi/2)*11))
        for x in range(16-hw,16+hw):
            nx=(x+.5-16)/hw
            t=5 if nx<-0.5 else 4 if nx<0.1 else 3 if nx<0.6 else 2
            if (y+x//3)%4==0 and prof>0.25: t=max(1,t-1)
            if _h(x,y//2,seed)>0.83: t-=1
            c.tone(x,y,'gold',max(1,min(6,t)))
    for y in range(0,6): c.tone(16,y,'bark',4); c.tone(17,y,'bark',2)
    return pz.fin(c)

def all_parts():
    return [('waterwheel',waterwheel(),'물레방아: 위 왼쪽 홈통, 지름 44px 바퀴, 아래 22px 물에 잠김'),
            ('plank_footbridge',plank_footbridge(4),'나무 널다리 (물 4칸 + 양쪽 둑 8px)'),
            ('millstones',millstones(),'맷돌 (누운 것·세운 것)'),
            ('wheat_stooks_a',wheat_stooks(0),'밀 단 세움 (셋)'),
            ('wheat_stooks_b',wheat_stooks(1),'밀 단 세움 (둘)'),
            ('scarecrow',scarecrow(),'허수아비 (까마귀 한 마리)'),
            ('laundry_line',laundry_line(),'빨랫줄 (빨래 넷)'),
            ('flour_cart',flour_cart(),'밀가루 손수레'),
            ('sluice_gate',sluice_gate(),'수문 (널문·감아올리는 축)'),
            ('haystack',haystack(),'둥근 짚가리')]
