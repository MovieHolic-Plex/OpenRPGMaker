"""버들항 변형 1번 — 새로 찍은 조각(손 도트, Python/Pillow). 버들항 v6 의 px2 그리기 엔진과 chipset 팔레트를 그대로 쓴다.
규칙: 3/4 시점(윗면+앞면), 빛 왼쪽 위, 윤곽은 pz.fin 안쪽 윤곽. 생성 이미지·외부 그림 복사 없음."""
import bdv, math, random
from bdv import px2, pz, Image
C=px2.C
def _h(x,y,s): return px2._hash(x,y,s)

# ------------------------------------------------------------------ 어촌 포구
def jetty(wc,hc,face=True,seed=1):
    """잔교(나무 부두). wc x hc 칸의 널판 윗면(세로 널판) + face 면 앞면 16px:
    윗면 가장자리 턱(왼쪽 밝음·오른쪽 어두움), 앞 들보(F 위 4px), 그 밑 말뚝 사이 그늘(물 위 1m 높이)과 물그림자."""
    W=wc*16; D=hc*16; F=16 if face else 0
    c=C(W,D+F,seed=seed)
    c.group(1); c.new()
    for y in range(D):
        for x in range(W):
            p=x//4; seam=(x%4==3)
            t=[4,5,4,3][(p*3+(p>>1))%4]
            if (x%4==0): t=min(6,t+1)
            if seam: t=2
            if (y+p*7+seed*5)%23==0 and not seam: t=2
            if x<2: t=min(6,t+1)              # 왼쪽 턱(빛)
            if x>=W-2: t=max(2,t-1)           # 오른쪽 턱(그늘)
            if y==0 and not face: t=max(t,4)
            if (_h(x,y,seed)>0.93): t=max(2,t-1)
            c.tone(x,y,'wood',t)
    for by in range(8,D,32):                  # 보 못자국
        for x in range(W):
            if x%4==1 and by<D: c.tone(x,by,'iron',3)
    if face:
        c.new()
        for y in range(D,D+4):                # 앞 들보: 윗면보다 한 단 어두움
            for x in range(W):
                c.tone(x,y,'wood',3 if y==D else 2)
        # 들보 밑 그늘은 칠하지 않고(투명) 마지막에 물 색으로 채운다. 말뚝(굵은 통나무)만 찍는다.
        for px in range(0,W,16):
            for y in range(D+4,D+F):
                for x in range(px+2,px+8):
                    dx=(x-px-2)/5.0
                    t=5 if dx<0.3 else 4 if dx<0.7 else 3
                    if y>=D+F-3: t=max(2,t-1)          # 물에 잠기는 밑동
                    if _h(x,y,seed+9)>0.88: t=max(2,t-1)
                    c.tone(x,y,'bark',t)
            for y in (D+8,D+9):               # 말뚝 밧줄
                for x in range(px+2,px+8): c.tone(x,y,'rope',4 if x<px+4 else 3)
    im=pz.fin(c)
    if face:                     # 앞면 밑 물그림자(오른쪽 아래로 길게)
        sh=Image.new('RGBA',(W,D+F+4),(0,0,0,0)); sh.alpha_composite(im); p=sh.load()
        for y in range(D+4,D+F):         # 들보 밑 빈 칸은 물 색 그늘
            for x in range(W):
                if p[x,y][3]==0:
                    k=(y-(D+4))/(F-4); p[x,y]=(8+int(6*k),26+int(14*k),34+int(14*k),215)
        for y in range(D+F,D+F+4):
            for x in range(W):
                if (x+y)%2==0 or y<D+F+2: p[x,y]=(8,28,34,110 if y<D+F+2 else 60)
        im=sh
    return im

def jetty_post():
    """잔교 계선주(굵은 기둥). 위에서 본 윗면 타원(밝음) + 원통 몸통 + 밧줄 감김. 16x24."""
    c=C(16,24,seed=811); c.shadow(9,21,6,1.2)
    c.group(1); c.new()
    cx=8.0
    for y in range(9,22):
        for x in range(4,12):
            dx=(x+.5-cx)/4
            if y>19 and (dx*dx+((y-19)/2.5)**2)>1: continue      # 아래 둥근 밑동
            t=5 if dx<-0.4 else 4 if dx<0.1 else 3 if dx<0.6 else 2
            if _h(x,y,811)>0.85: t=max(2,t-1)
            c.tone(x,y,'bark',t)
    for y in (14,15,18):
        for x in range(4,12): c.tone(x,y,'rope',4 if x<8 else 3)
    c.new()
    for y in range(5,14):                                        # 윗면 타원
        for x in range(3,13):
            dx=(x+.5-cx)/4.4; dy=(y+.5-9)/2.8
            if dx*dx+dy*dy<=1: c.tone(x,y,'bark',6 if dx<0.2 and dy<0.3 else 5)
    return pz.fin(c)

def lighthouse():
    """등대 48x144: 아래가 넓은 원뿔 탑(회반죽 + 붉은 띠), 문·환기창, 회랑, 불 켜진 등롱, 붉은 지붕. 빛은 왼쪽 위."""
    W,H=48,144; cx=24.0
    c=C(W,H,seed=907); c.shadow(24,138,22,4,a=90)
    yb=134; yt=40
    def rx(y): return 9.5+(y-yt)*(15.5-9.5)/(yb-yt)
    c.group(1); c.new()
    # 돌 밑단(둥근 받침)
    for y in range(yb-8,yb+4):
        r=rx(min(y,yb))+ (2.2 if y>=yb-8 else 0)
        for x in range(int(cx-r)-1,int(cx+r)+2):
            dx=(x+.5-cx)/r
            if abs(dx)>1: continue
            if y>yb+3*math.sqrt(max(0,1-dx*dx)): continue
            v=c.shade(dx,0.15,math.sqrt(1-dx*dx),0.22)
            c.setv(x,y,'stone',v-0.02*((y//4)%2))
    c.group(2); c.new()
    for y in range(yt,yb-6):
        r=rx(y)
        band=((y-yt)//22)%2==1       # 회반죽 / 붉은 띠 번갈아
        for x in range(int(cx-r)-1,int(cx+r)+2):
            dx=(x+.5-cx)/r
            if abs(dx)>1: continue
            v=c.shade(dx,0.1,math.sqrt(1-dx*dx),0.2)
            c.setv(x,y,'red' if band else 'plaster',v+(0.04 if band else 0.0))
    # 돌 쌓임 줄눈(살짝)
    c.new()
    for y in range(yt+3,yb-8,7):
        r=rx(y)
        for x in range(int(cx-r)+1,int(cx+r)):
            if (x*3+y)%9==0: c.darken(x,y,1)
    # 문 (앞면 가운데 아래) — 돌 아치
    for y in range(yb-22,yb-6):
        for x in range(20,29):
            top=(y-(yb-22))
            if top<3 and (x<21+2-top or x>27-2+top): continue
            c.tone(x,y,'dark',1 if 22<=x<=26 else 2)
    for x in range(19,30): c.tone(x,yb-23,'stone',5)
    for y in range(yb-22,yb-6): c.tone(19,y,'stone',5); c.tone(29,y,'stone',3)
    # 환기창(작은 슬릿)
    for y in (yt+28,yt+56,yt+74):
        for dy in range(4): c.tone(23,y+dy,'dark',1); c.tone(24,y+dy,'dark',2)
        c.tone(22,y,'stone',5); c.tone(25,y,'stone',3)
    # 회랑(발코니): 탑 꼭대기보다 넓은 원반. 윗면 타원(밝음) + 앞면 받침 + 난간, 등롱은 타원 가운데에 앉는다
    gy=yt-2; gcy=gy+1; GRX=14.5; GRY=5.2
    c.group(3); c.new()
    for y in range(gcy-6,gcy+7):
        for x in range(int(cx-GRX)-1,int(cx+GRX)+2):
            dx=(x+.5-cx)/GRX; dy=(y+.5-gcy)/GRY
            if dx*dx+dy*dy<=1: c.setv(x,y,'stone',0.98-0.12*max(0,dy)-0.05*dx)
    for y in range(gcy,gcy+8):                          # 앞면(받침 띠): 타원 앞 호 밑으로 F
        for x in range(int(cx-GRX),int(cx+GRX)+1):
            dx=(x+.5-cx)/GRX
            if abs(dx)>1: continue
            yarc=gcy+GRY*math.sqrt(max(0,1-dx*dx))
            k=y-yarc
            if 0<=k<4.5: c.setv(x,y,'stone',0.46-0.06*k+0.1*(-dx))
    c.new()
    for i in range(0,30,3):                             # 난간 기둥 (앞 호만)
        x=int(cx-GRX+0.5)+i
        dx=(x+.5-cx)/GRX
        if abs(dx)>=1: continue
        yy=gcy+int(GRY*math.sqrt(1-dx*dx))
        for k in range(1,6): c.tone(x,yy-k,'iron',5 if x<cx else 3)
    for x in range(int(cx-GRX+0.5),int(cx+GRX)):
        dx=(x+.5-cx)/GRX
        if abs(dx)>=1: continue
        yy=gcy+int(GRY*math.sqrt(1-dx*dx)); c.tone(x,yy-6,'iron',6 if x<cx else 4)
    # 등롱 방(유리·불빛): 밑이 타원 가운데에 닿는다
    c.group(4); c.new()
    ly0=gcy-22; ly1=gcy+2
    for y in range(ly0,ly1+1):
        for x in range(int(cx-8),int(cx+9)):
            dx=(x+.5-cx)/8
            if abs(dx)>1: continue
            if y>ly1-2 and ((y-(ly1-2))/2.2)**2+dx*dx>1: continue
            gl=6 if (x<cx and y<ly0+9) else 5 if y<ly0+14 else 4
            c.tone(x,y,'fire',gl-(1 if abs(dx)>0.7 else 0))
    for x in (int(cx-8),int(cx-3),int(cx+2),int(cx+7)):      # 철 창살
        for y in range(ly0,ly1-1): c.tone(x,y,'iron',5 if x<cx else 3)
    for x in range(int(cx-9),int(cx+10)): c.tone(x,ly0,'iron',5)
    for x in range(int(cx-8),int(cx+9)):
        dx=(x+.5-cx)/8
        if abs(dx)<=1: c.tone(x,ly1-1+int(1.6*math.sqrt(max(0,1-dx*dx))),'iron',3)
    # 붉은 지붕(원뿔) + 꼭대기 장식
    c.new()
    for y in range(ly0-14,ly0):
        r=1.5+(y-(ly0-14))*(11.0-1.5)/14
        for x in range(int(cx-r)-1,int(cx+r)+2):
            dx=(x+.5-cx)/r
            if abs(dx)>1: continue
            c.setv(x,y,'clay',c.shade(dx,0.2,math.sqrt(1-dx*dx),0.2)+0.05)
    for y in range(ly0-20,ly0-13): c.tone(24,y,'iron',4); c.tone(23,y,'iron',5)
    c.tone(23,ly0-21,'gold',6); c.tone(24,ly0-21,'gold',5); c.tone(23,ly0-22,'gold',5)
    return pz.fin(c)

def fish_market():
    """생선 시장 지붕 6칸x5칸(96x88): 기둥만 있는 열린 지붕, 앞판 그림 간판(물고기), 판매대 위 생선·상자. 앞면 3/4."""
    W,H=96,88
    c=C(W,H,seed=641); c.shadow(48,84,44,3,a=80)
    # 뒷벽·뒷 기둥
    c.group(1); c.new()
    for x in (6,W-8):
        for y in range(30,78): c.tone(x,y,'bark',5); c.tone(x+1,y,'bark',3)
    # 뒷벽 판자 (지붕 밑 그늘)
    c.group(1); c.new()
    for y in range(28,54):
        for x in range(8,W-8):
            t=2 if (x//5)%2 else 1
            if y<34: t=1
            c.tone(x,y,'wood',t)
    # 판매대 (나무 상판 + 앞면)
    c.group(2)
    c.box(4,54,W-8,6,9,'wood',top=0.92,front=0.55)
    for x in range(8,W-8,16):
        for y in range(63,69): c.tone(x,y,'wood',2)
    # 판매대 위: 생선 바구니·상자·생선
    c.group(3)
    def crate(x,y,w=13):
        c.new()
        for yy in range(y,y+7):
            for xx in range(x,x+w):
                c.tone(xx,yy,'wood',5 if yy==y else 3 if yy<y+2 else 2 if (xx-x)%4==0 else 3)
        for xx in range(x+1,x+w-1):
            for k in range(3):
                m='cream' if (xx+k)%3 else 'slate'
                c.tone(xx,y-1-k%2,m,5 if (xx-x)<w//2 else 4)
    for x in (10,30,68): crate(x,50)
    c.new()
    for i,x in enumerate((50,56,62)):                 # 생선 진열(가로 한 줄)
        y=52
        for dx in range(6): c.tone(x+dx,y,'slate',5 if dx<3 else 3)
        c.tone(x+6,y-1,'slate',4); c.tone(x+6,y+1,'slate',4); c.tone(x+1,y-1,'slate',6)
    # 앞 기둥
    c.group(4); c.new()
    for x in (0,W-4):
        for y in range(26,80): 
            c.tone(x,y,'bark',5); c.tone(x+1,y,'bark',4); c.tone(x+2,y,'bark',3); c.tone(x+3,y,'bark',2)
    # 지붕: 위에서 본 경사면(기와) 26행 + 처마 앞판
    c.group(5); c.new()
    for y in range(0,24):
        ins=int((24-y)*0.15)          # 위쪽이 살짝 좁은 사다리꼴
        for x in range(ins,W-ins):
            r=(y//4)%2
            t=5 if (x+r*6)%12<9 else 4
            if (y%4)==3: t=3
            if (x+r*6)%12==11: t=3
            if y<3: t=6
            if x<ins+2: t=6
            if x>W-ins-3: t=3
            c.tone(x,y,'clay',t)
    c.new()
    for y in range(24,32):            # 처마 앞판 + 그림자
        for x in range(0,W):
            t=4 if y<26 else 3 if y<28 else 2 if y<30 else 1
            if x%16 in (0,) : t=max(1,t-1)
            c.tone(x,y,'wood',t)
    # 앞판 물고기 그림(금빛)
    c.new()
    fx=W//2-9; fy=26
    for dx in range(10): c.tone(fx+dx,fy+1,'gold',5 if dx<5 else 4)
    for dx in range(2,8): c.tone(fx+dx,fy,'gold',6); c.tone(fx+dx,fy+2,'gold',4)
    for k in range(3): c.tone(fx+10+k,fy+1-(k%2)*1,'gold',4); c.tone(fx+10+k,fy+2+(k%2),'gold',4)
    c.tone(fx+1,fy+1,'dark',1)
    return pz.fin(c)

def drying_rack(v=0,seed=1):
    """생선 말림대: 다리가 받친 널 선반. 윗면 = 생선을 널어 둔 살대 선반(T 8px, 밝음), 앞면 = 앞 들보(한 단 어두움)
    + 그 밑으로 매달린 생선. v=0: 32x32, v=1: 48x32(선반 두 칸)."""
    W=32 if v==0 else 48; H=32
    c=C(W,H,seed=700+v); c.shadow(W//2+1,29.6,W//2-1,1.4)
    sy=10; T=8; Fh=4                      # 선반 윗면 y 10~17, 앞 들보 y 18~21
    c.group(1); c.new()
    for x in (2,W-5):                     # 앞 다리(들보 밑으로)
        for y in range(sy+T+Fh,29):
            c.tone(x,y,'wood',5); c.tone(x+1,y,'wood',4); c.tone(x+2,y,'wood',2)
    c.group(2); c.new()
    for y in range(sy,sy+T):              # 선반 윗면: 세로 살대 + 그 위의 생선
        for x in range(1,W-1):
            t=5 if (x%3==0) else 4
            if y==sy: t=6
            if x==1: t=6
            if x==W-2: t=3
            if y==sy+T-1: t=3
            c.tone(x,y,'wood',t)
    n=(W-8)//6
    for i in range(n):                    # 널어 둔 생선(가로로 누운 몸통 + 꼬리)
        fx=4+i*6; fy=sy+2+((i*5)%3)
        m='cream' if i%2 else 'slate'
        for k in range(5): c.tone(fx+k,fy,m,6 if k<3 else 5); c.tone(fx+k,fy+1,m,4)
        c.tone(fx+5,fy,m,3); c.tone(fx-1,fy+1,'dark',1)
    c.group(3); c.new()
    for y in range(sy+T,sy+T+Fh):         # 앞 들보
        for x in range(1,W-1):
            c.tone(x,y,'wood',3 if y==sy+T else 2)
    # 들보에 매단 생선(앞)
    for i in range(3 if v==0 else 5):
        x=5+i*(W-10)//(2 if v==0 else 4)
        L=5+((i*3)%3)
        c.tone(x,sy+T+Fh,'rope',3)
        for k in range(L):
            m='slate' if (i+k)%4 else 'cream'
            c.tone(x,sy+T+Fh+1+k,m,5 if k<L//2 else 4); c.tone(x+1,sy+T+Fh+1+k,m,3)
    return pz.fin(c)

def upturned_boat():
    """엎어 말리는 작은 배 (3/4): 윗면 = 둥근 선체 등(밝음·용골선), 앞면 = 물려 놓인 널판(겹붙임 줄), 뱃전 밑에 괴는 받침목. 32x24."""
    W,H=32,24; c=C(W,H,seed=311); c.shadow(17,22.0,15,1.6)
    def half(x):                            # 뱃머리 양 끝이 뾰족한 렌즈 반폭
        dx=(x+.5-16)/15.5
        return max(0.0,1-abs(dx)**2.3)
    c.group(1); c.new()
    ytop,ymid,ybot=3,11,20                  # 등(윗면) 3~11, 앞 널판 11~20
    for x in range(1,31):
        hh=half(x)
        if hh<=0: continue
        y0=int(round(ymid-8.0*hh)); y1=int(round(ymid+ (ybot-ymid)*hh))
        for y in range(y0,y1+1):
            if y<ymid:                       # 윗면
                k=(ymid-y)/max(1,ymid-y0)
                v=0.95-0.35*(1-k)*0.6-0.03*(x-16)/15
                c.setv(x,y,'wood',v)
            else:                            # 앞면(한 단 어두움) + 널판 줄
                k=(y-ymid)/max(1,y1-ymid)
                v=0.52-0.12*k-0.04*(x-16)/15
                c.setv(x,y,'bark' if (y-ymid)%3 else 'wood',v)
    c.new()
    for x in range(3,29):                    # 용골선(윗면 가운데 능선)
        hh=half(x); y=int(round(ymid-4.0*hh))
        c.tone(x,y,'bark',6 if x<16 else 5)
    for x in range(2,30):                    # 앞 널판 이음(곡선)
        hh=half(x)
        for f in (0.35,0.7):
            y=int(round(ymid+(ybot-ymid)*hh*f))
            if y>ymid: c.tone(x,y,'bark',2)
    for x in (9,22):                         # 받침목
        for y in range(ybot-1,ybot+2): c.tone(x,y,'wood',2); c.tone(x+1,y,'wood',3)
    return pz.fin(c)

def lobster_pots():
    """통발 더미 (3/4): 원통 통발 셋. 윗면 = 타원 뚜껑(깔때기 입구 구멍), 앞면 = 그물 몸통 + 나무 테. 32x24."""
    c=C(32,24,seed=515); c.shadow(16,22.0,14,1.4)
    def pot(cx,ytop,r,h,gid):
        ry=max(2.0,r*0.42)
        c.group(gid); c.new()
        for y in range(int(ytop+ry)-1,int(ytop+h+ry)+1):            # 몸통
            for x in range(cx-r,cx+r+1):
                dx=(x+.5-cx)/r
                if abs(dx)>1: continue
                if y>ytop+h and ((y-(ytop+h))/ry)**2+dx*dx>1: continue
                t=5 if dx<-0.35 else 4 if dx<0.15 else 3 if dx<0.65 else 2
                if (x+y)%3==0: t=max(1,t-1)
                if y in (int(ytop+ry)+1, int(ytop+h)-1): t=0
                if t: c.tone(x,y,'rope',t)
                else: c.tone(x,y,'wood',5 if dx<0 else 3)
        c.new()
        for y in range(int(ytop-ry)-1,int(ytop+ry)+2):               # 윗면 타원
            for x in range(cx-r,cx+r+1):
                dx=(x+.5-cx)/r; dy=(y+.5-ytop)/ry
                if dx*dx+dy*dy<=1:
                    c.tone(x,y,'rope',6 if dx<0.1 else 5)
                if dx*dx+dy*dy<=0.22: c.tone(x,y,'dark',1 if dx<0.1 else 2)
        for x in range(cx-r+1,cx+r):                                 # 뚜껑 테
            dx=(x+.5-cx)/r
            if abs(dx)<1: c.tone(x,int(ytop+ry*math.sqrt(1-dx*dx)),'wood',5 if dx<0 else 3)
    pot(22,11,6,7,1)
    pot(8,13,6,7,2)
    pot(15,6,6,6,3)
    return pz.fin(c)

FISH=dict(jetty=jetty,jetty_post=jetty_post,lighthouse=lighthouse,fish_market=fish_market,drying_rack=drying_rack,upturned_boat=upturned_boat,lobster_pots=lobster_pots)
