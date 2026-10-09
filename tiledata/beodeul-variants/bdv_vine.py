"""버들항 변형 1번 — 언덕 포도원 마을용 새 조각(손 도트, Python/Pillow). 버들항 v6 의 px2 엔진과 chipset 팔레트를 그대로 쓴다.
3/4 시점(윗면+앞면), 빛 왼쪽 위. 생성 이미지·외부 그림 복사 없음."""
import bdv, math
from bdv import px2, pz, Image
C=px2.C
def _h(x,y,s): return px2._hash(x,y,s)

# ------------------------------------------------------------------ 포도밭 이랑 (칸 마스크 오토타일)
def vine_field(mask,seed=3):
    """칸 마스크(True=포도밭)를 받아 이랑 무늬 바닥 그림을 만든다. 이랑 1줄 = 1칸: 윗줄 덩굴(잎+송이), 아랫줄 풀길.
    가장자리는 이웃 칸이 없는 쪽만 들쭉날쭉 깎이고 흙 테두리가 깔린다."""
    hc=len(mask); wc=len(mask[0]); W=wc*16; H=hc*16
    c=C(W,H,seed=seed); c.group(1); c.new()
    def m(cx,cy): return 0<=cx<wc and 0<=cy<hc and mask[cy][cx]
    for y in range(H):
        for x in range(W):
            cx,cy=x//16,y//16
            if not m(cx,cy): continue
            lx,ly=x%16,y%16
            d=99
            if not m(cx-1,cy): d=min(d,lx)
            if not m(cx+1,cy): d=min(d,15-lx)
            if not m(cx,cy-1): d=min(d,ly)
            if not m(cx,cy+1): d=min(d,15-ly)
            hh=_h(x,y,seed)
            if d==0 and hh<0.6: continue
            if d==1 and hh<0.25: continue
            # 흙 바탕
            t=3 if hh<0.7 else 2 if hh<0.86 else 4
            row=cy   # 이랑 번호(칸 단위)
            if d<=2 and d>=0: c.tone(x,y,'dirt',2 if d<2 else 3); continue
            # 풀길 (아랫줄)
            if ly>=12:
                if ly in (13,14):
                    g=3 if _h(x//2,y,seed+3)<0.55 else 4
                    if _h(x,y,seed+5)>0.85: g=5
                    c.tone(x,y,'moss',g)
                else: c.tone(x,y,'dirt',t)
                continue
            # 덩굴 줄 (윗줄) — 포기 하나 8px, 사이에 1px 틈
            p=(x//8)+cx*2+row*7
            gap=(x%8==7)
            if ly==0 or ly==11:
                c.tone(x,y,'dirt',2 if ly==11 else t); continue
            hp=_h(p,row,seed+9)
            if hp<0.06:             # 죽은 포기 (마른 그루터기)
                c.tone(x,y,'dirt',t)
                if 2<=x%8<=4 and 4<=ly<=9: c.tone(x,y,'bark',3 if ly<7 else 2)
                continue
            if gap: c.tone(x,y,'dirt',2); continue
            # 잎
            base=5 if ly<=3 else 4 if ly<=6 else 3
            j=_h(x,y,seed+11)
            if j<0.22: base-=1
            elif j>0.86: base+=1
            if x%8==0: base=min(6,base+1)
            mat='leaf'
            if hp>0.93: mat='gold'; base=max(3,min(5,base-1))     # 누렇게 든 포기
            elif hp>0.85: mat='moss'
            c.tone(x,y,mat,max(1,min(6,base)))
            # 송이: 잎 아래쪽에 매달림
            if ly in (8,9,10) and mat!='gold' and hp<0.75:
                xx=x%8
                if (ly==8 and 2<=xx<=5) or (ly==9 and 2<=xx<=4) or (ly==10 and 3<=xx<=4 and hp<0.6):
                    c.tone(x,y,'shroom',2 if xx>=4 else 3)
                    if ly==8 and xx==2: c.tone(x,y,'pink',3)
        # 지지대 기둥: 16px 마다
    for cy in range(hc):
        for cx in range(wc):
            if not m(cx,cy): continue
            for ly in range(0,12):
                x=cx*16+15; y=cy*16+ly
                if d_ok(m,cx,cy,x,y,W):
                    c.tone(x,y,'bark',5 if ly>0 else 6)
                    c.tone(x-1,y,'bark',3) if 0<ly else None
    return c.img(outline=False)

def d_ok(m,cx,cy,x,y,W):
    return m(cx+1,cy) or (x%16==15)

# ------------------------------------------------------------------ 올리브 나무
def olive(v=0,seed=1):
    """올리브 나무 48x52: 비틀린 짧은 줄기(밑변=줄기 폭 6) + 은빛 도는 낮고 넓은 수관. v=0,1,2 는 수관 덩이 배치가 다르다."""
    W,H=48,52; c=C(W,H,seed=seed*17+v*5+2); c.shadow(24,49,17,3.2,a=85)
    tx=21
    # 줄기 (밑변 폭 6 = 줄기 폭 6, 위로 갈수록 두 가지로 갈라짐)
    c.group(1); c.new()
    for y in range(31,50):
        for x in range(tx,tx+6):
            t=5 if x<tx+2 else 4 if x<tx+4 else 2
            if (y+x*3)%7==0: t-=1
            if y>=46 and x==tx: t=4
            c.tone(x,y,'bark',max(1,t))
    # 옹이
    c.tone(tx+2,40,'bark',2); c.tone(tx+3,40,'bark',2); c.tone(tx+2,41,'dark',3)
    # 갈라진 가지
    for k,(x0,x1) in enumerate(((tx+1,tx-7),(tx+4,tx+13))):
        for i in range(12):
            f=i/11; x=int(round(x0+(x1-x0)*f)); y=31-int(f*9)
            for w in range(3): c.tone(x+w,y,'bark',4 if (w==0 and k==0) else 3 if w<2 else 2)
    # 수관 덩이
    c.group(2)
    clumps=[[(24,17,13,10),(11,24,10,8),(37,25,10,8),(24,28,9,6)],
            [(23,15,12,9),(10,21,9,8),(38,22,9,9),(19,29,8,6),(32,29,8,6)],
            [(24,14,14,10),(9,25,9,7),(39,26,8,7),(24,27,10,7)]][v%3]
    for cx,cy,rx,ry in clumps:
        c.new(); c.ellipsoid(cx,cy,rx,ry,'moss',amb=0.14,bias=-0.05,bump=0.35,bsc=2.2)
    # 은빛 잎 (올리브 잎 뒷면)
    for y in range(H):
        for x in range(W):
            if c.m[y][x]=='moss':
                hh=_h(x,y,seed+41+v)
                if hh>0.70:
                    tt=c.t_of(x,y); c.tone(x,y,'mstone',max(2,min(6,tt+ (1 if hh>0.85 else 0))))
                elif hh<0.05: c.tone(x,y,'shroom',2)   # 익은 올리브 알갱이
    return pz.fin(c)

# ------------------------------------------------------------------ 술 창고
def winery():
    """포도주 창고 128x82 (8칸 폭): 돌 벽 + 붉은 기와 지붕, 가운데 아치 겹문(구름다리 아님), 양쪽 덧창 창, 문 위 포도송이 간판."""
    W,H=128,82; c=C(W,H,seed=907); c.shadow(64,78,60,3.4,a=80)
    # ---- 벽
    c.group(1); c.new()
    y0,y1=34,77
    for y in range(y0,y1+1):
        crs=(y-y0)//7; ry=(y-y0)%7
        for x in range(5,W-5):
            off=(crs%2)*7
            jx=(x+off)%14
            t=4
            if ry==6: t=3               # 줄눈
            elif jx==13: t=3
            else:
                hh=_h((x+off)//14,crs,17)
                t=4 if hh<0.55 else 5 if hh<0.8 else 3
                if x<9: t=min(6,t+1)
            if y>=y1-3: t=max(2,t-1)
            if y<y0+3: t=max(2,t-1)    # 처마 그늘
            c.tone(x,y,'stone',t)
    # 모서리 돌(크림색)
    c.new()
    for y in range(y0,y1+1):
        for x in list(range(5,10))+list(range(W-10,W-5)):
            k=((y-y0)//7)%2
            if (x<W//2 and (5+k*2<=x<=9)) or (x>=W//2 and (W-10-k*2<=x<=W-6)):
                c.tone(x,y,'cream',5 if ((y-y0)%7)!=6 else 3)
    # ---- 창 둘 (벽 가운데 높이)
    def window(x,y):
        c.new()
        for yy in range(y,y+15):
            for xx in range(x,x+12):
                c.tone(xx,yy,'cream',5 if (xx==x or yy==y) else 3 if (xx==x+11 or yy==y+14) else 4)
        c.new()
        for yy in range(y+2,y+13):
            for xx in range(x+2,x+10):
                c.tone(xx,yy,'dark',3 if (yy<y+5) else 2)
        for yy in range(y+2,y+13): c.tone(x+6,yy,'cream',3)          # 문설주
        c.tone(x+3,y+3,'cryst',3); c.tone(x+4,y+3,'cryst',4); c.tone(x+8,y+3,'cryst',3)
        c.new()                                                    # 덧창(열림)
        for yy in range(y,y+15):
            for xx in (x-4,x-3,x-2,x-1): c.tone(xx,yy,'wood',3 if xx<x-2 else 4 if yy%4 else 2)
            for xx in (x+12,x+13,x+14,x+15): c.tone(xx,yy,'wood',3 if xx>x+13 else 4 if yy%4 else 2)
    window(18,46); window(W-30,46)
    # ---- 아치 문 (2칸 폭)
    cx=64; r=16; ytop=44
    c.new()                                                        # 아치 돌테
    for y in range(ytop-3,y1+1):
        for x in range(cx-r-4,cx+r+4):
            dx=x+0.5-cx
            if y<ytop+r-3:
                dd=math.hypot(dx,y+0.5-(ytop+r))
                if dd<=r+4 and dd>r-0.5:
                    k=int((math.atan2(y-(ytop+r),dx)+3.14159)*7)
                    c.tone(x,y,'cream',5 if k%2 else 3)
            else:
                if abs(dx)>r-0.5 and abs(dx)<=r+4:
                    k=(y-ytop)//6
                    c.tone(x,y,'cream',5 if k%2 else 3)
    c.new()                                                        # 문짝
    for y in range(ytop,y1+1):
        for x in range(cx-r,cx+r):
            dx=x+0.5-cx
            if y<ytop+r and math.hypot(dx,y+0.5-(ytop+r))>r-0.5: continue
            left=dx<0
            t=4 if left else 3
            if (x-cx+r)%4==0: t-=1
            if abs(dx)<0.6: t=1
            c.tone(x,y,'wood',max(1,t))
    for yy in (ytop+13,ytop+22):                                  # 쇠 띠
        for x in range(cx-r,cx+r):
            if abs(x+0.5-cx)>0.6: c.tone(x,yy,'iron',3); c.tone(x,yy+1,'iron',2)
    c.tone(cx-3,ytop+20,'gold',5); c.tone(cx-3,ytop+21,'gold',3); c.tone(cx+2,ytop+20,'gold',5); c.tone(cx+2,ytop+21,'gold',3)
    # 문턱
    c.new()
    for y in range(y1-1,y1+3):
        for x in range(cx-r-4,cx+r+4): c.tone(x,y,'stone',5 if y==y1-1 else 3)
    # ---- 문 위 포도송이 간판 (오른쪽 창과 문 사이)
    c.new()
    for x in range(86,96): c.tone(x,40,'iron',3)                   # 팔
    c.tone(86,41,'iron',2)
    for yy in range(43,53):
        for xx in range(87,95): c.tone(xx,yy,'wood',3 if xx==87 or yy==43 else 4)
    for i,(gx,gy) in enumerate(((89,46),(92,46),(90,49),(93,49),(91,51),(89,49))):
        c.tone(gx,gy,'shroom',3); c.tone(gx+1,gy,'shroom',2)
    c.tone(91,44,'leaf',4); c.tone(92,44,'leaf',3)
    # ---- 지붕
    c.group(2); c.new()
    for y in range(0,25):
        ins=int((24-y)*0.22)
        for x in range(ins,W-ins):
            r_=(y//4)%2
            t=5 if (x+r_*7)%14<10 else 4
            if (y%4)==3: t=3
            if (x+r_*7)%14==13: t=3
            if y<3: t=6
            if x<ins+3: t=6
            if x>W-ins-4: t=3
            if _h(x//3,y//2,55)>0.93: t=max(2,t-1)
            c.tone(x,y,'red',min(6,t))
    c.new()
    for y in range(25,34):
        for x in range(0,W):
            t=4 if y<27 else 3 if y<30 else 2 if y<32 else 1
            if (x%16)==0: t=max(1,t-1)
            c.tone(x,y,'wood',t)
    # 서까래 머리
    for x in range(4,W-4,8):
        for yy in (27,28): c.tone(x,yy,'bark',5); c.tone(x+1,yy,'bark',3)
    return pz.fin(c)

# ------------------------------------------------------------------ 통·술통
def _barrel(c,cx,by,r=7,h=15,ro=0):
    top=by-h
    c.new()
    for y in range(top-3,by+4):
        for x in range(cx-r-2,cx+r+3):
            dx=(x+0.5-cx); 
            hw=r*(1+0.10*math.sin(math.pi*min(1,max(0,(y-top)/max(1,h)))))
            inTop=(dx/(r*0.92))**2+((y+0.5-top)/3.0)**2<=1
            inBody=(y>=top and abs(dx)<=hw and y<=by+ 3.0*math.sqrt(max(0,1-(dx/hw)**2)))
            if inTop:
                t=5 if (x+ro)%4 else 4
                if (dx/(r*0.92))**2+((y+0.5-top)/3.0)**2>0.72: t=3
                c.tone(x,y,'wood',t)
            elif inBody:
                nx=dx/hw
                t=5 if nx<-0.45 else 4 if nx<0.15 else 3 if nx<0.6 else 2
                if int(x+ro+r*2)%4==0: t=max(1,t-1)
                c.tone(x,y,'wood',t)
    # 쇠테
    c.new()
    for hy in (top+3,top+4,by-5,by-4):
        for y in (hy,):
            for x in range(cx-r-2,cx+r+3):
                dx=(x+0.5-cx); hw=r*(1+0.10*math.sin(math.pi*min(1,max(0,(y-top)/max(1,h)))))
                if y>=top and abs(dx)<=hw: c.tone(x,y,'iron',5 if dx<-hw*0.4 else 3 if dx<hw*0.4 else 2)

def barrels_standing(seed=1):
    """서 있는 술통 세 개 (뒤 하나, 앞 둘). 48x40"""
    W,H=48,40; c=C(W,H,seed=seed*5+120); c.shadow(24,36,21,3,a=85)
    c.group(1); _barrel(c,24,26,7,14,ro=1)
    c.group(2); _barrel(c,12,36,8,15,ro=0)
    c.group(3); _barrel(c,35,36,8,15,ro=2)
    return pz.fin(c)

def _cask34(c,cx,cy,r,back,gr,ro=0):
    """3/4 로 누인 술통: 마구리(앞 원 = 앞면, 한 단 어둡다) + 뒤로 물러나는 배 윗면 곡선 띠(밝다, 살대 세로줄, 쇠테 호).
    옆면은 보이지 않는다. (cx,cy) 는 앞 원의 중심."""
    c.group(gr); c.new()
    hoops={3,back-2}
    for s in range(back,0,-1):                    # 뒤에서 앞으로 겹쳐 그려 윗면 띠를 만든다
        rr=r*(1-0.06*(s/back))                    # 뒤로 갈수록 살짝 가늘게(원근)
        for y in range(int(cy-s-rr)-1,int(cy-s)+1):
            for x in range(int(cx-rr)-1,int(cx+rr)+2):
                dx=(x+0.5-cx)/rr; dy=(y+0.5-(cy-s))/rr
                if dx*dx+dy*dy>1 or dy>0.05: continue
                nx=dx
                t=5 if nx<-0.35 else 4 if nx<0.25 else 3 if nx<0.7 else 2
                if dy<-0.8: t=min(6,t+1)              # 배 맨 위 하이라이트
                if (x+ro)%4==0: t=max(1,t-1)           # 살대 이음
                if s in hoops and dy>-0.93: c.tone(x,y,'iron',5 if nx<0 else 3)
                else: c.tone(x,y,'wood',t)
    c.new()
    for y in range(cy-r,cy+r+1):                   # 앞 원(마구리)
        for x in range(cx-r,cx+r+1):
            dx=(x+0.5-cx)/r; dy=(y+0.5-cy)/r; d=dx*dx+dy*dy
            if d>1: continue
            t=4 if (dx+dy)<-0.4 else 3 if (dx+dy)<0.35 else 2
            if (x-cx+r)%4==0: t=max(1,t-1)
            if d>0.72: t=3 if (dx+dy)<0.2 else 1
            c.tone(x,y,'wood',t)
    for ang in range(0,360,3):                     # 쇠테
        a=math.radians(ang); x=int(round(cx+math.cos(a)*(r-2.3))); y=int(round(cy+math.sin(a)*(r-2.3)))
        c.tone(x,y,'iron',4 if math.cos(a)+math.sin(a)<0 else 2)
    c.tone(cx-1,cy-1,'dark',3); c.tone(cx,cy-1,'dark',2)       # 마개
    c.tone(cx,cy+r//2+1,'gold',4); c.tone(cx,cy+r//2+2,'gold',3)   # 꼭지

def cask_rack(seed=1):
    """나무 시렁 위에 누인 술통 셋 (밑 둘, 위 하나). 3/4: 시렁 윗판(T 밝음, 깊이 10) + 앞판(F 한 단 어둡다) + 다리,
    통은 마구리 원(앞면) + 뒤로 눕는 배의 윗면 띠. 64x66"""
    W,H=64,66; c=C(W,H,seed=seed*3+300); c.shadow(32,63,29,2.6,a=85)
    c.group(1); c.new()
    for x in (5,W-9):                                          # 다리(앞면 아래로)
        for y in range(57,64): c.tone(x,y,'bark',4); c.tone(x+1,y,'bark',3); c.tone(x+2,y,'bark',2); c.tone(x+3,y,'bark',1)
    for y in range(47,57):                                     # 윗판 T (위에서 본 널판, 앞뒤 깊이 10)
        for x in range(2,W-2):
            t=5 if (x//8+y//5)%2 else 4
            if y==47: t=6
            if x%8==7: t=3
            if x<4: t=6
            c.tone(x,y,'wood',t)
    for y in range(57,61):                                     # 앞판 F (한 단 어둡다)
        for x in range(2,W-2):
            c.tone(x,y,'wood',3 if y<59 else 2)
            if x%16==0: c.tone(x,y,'wood',1)
    _cask34(c,16,46,10,8,1,ro=0); _cask34(c,48,46,10,8,1,ro=2)
    _cask34(c,32,31,10,8,2,ro=1)
    return pz.fin(c)

def wine_press():
    """나무 포도 압착기 48x58: 살대 통 + 위에서 누르는 나사 대와 가로 손잡이, 앞 홈통과 받침."""
    W,H=48,58; c=C(W,H,seed=811); c.shadow(24,54,20,3,a=85)
    c.group(1); c.new()
    for y in range(44,52):                                      # 받침대 (윗면+앞면)
        for x in range(3,W-3):
            c.tone(x,y,'wood',5 if y==44 else 4 if y<47 else 3 if y<50 else 2)
    for x in range(3,W-3):
        if x%6==0:
            for y in range(45,52): c.tone(x,y,'wood',2)
    c.group(2); c.new()                                         # 통 (살대)
    for y in range(20,45):
        prof=1-0.03*abs((y-32)/12)
        hw=int(13*prof)
        for x in range(24-hw,24+hw):
            nx=(x+0.5-24)/hw
            t=5 if nx<-0.4 else 4 if nx<0.2 else 3 if nx<0.65 else 2
            if (x-(24-hw))%3==0: t=1                              # 살대 사이 틈
            c.tone(x,y,'wood',t)
    c.new()                                                     # 윗둘레 (눌린 포도)
    for y in range(17,24):
        for x in range(10,38):
            dx=(x+0.5-24)/14; dy=(y+0.5-20)/3.4
            if dx*dx+dy*dy<=1:
                if dx*dx+dy*dy>0.7: c.tone(x,y,'wood',5 if dx<0 else 3)
                else: c.tone(x,y,'shroom',3 if (x+y)%3 else 2); 
    for hy in (24,25,38,39):                                    # 쇠테
        for x in range(11,37): c.tone(x,hy,'iron',4 if x<22 else 2)
    c.group(3); c.new()                                         # 나사 대 + 손잡이
    for y in range(2,20):
        for x in (22,23,24,25): c.tone(x,y,'bark',5 if x==22 else 4 if x==23 else 3)
        if y%3==0:
            for x in (21,26): c.tone(x,y,'bark',2)
    for x in range(6,42): c.tone(x,5,'bark',5 if x<24 else 3); c.tone(x,6,'bark',3 if x<24 else 2)
    c.tone(5,5,'bark',6); c.tone(42,5,'bark',2)
    c.new()                                                     # 홈통(앞으로 삐져나온 주둥이)
    for y in range(40,45):
        for x in range(20,29): c.tone(x,y,'wood',4 if y<42 else 3)
    for x in range(22,27): c.tone(x,45,'shroom',3)
    return pz.fin(c)

# ------------------------------------------------------------------ 포도 덩굴 그늘 시렁
def pergola(wc=3,seed=1):
    """길 위에 얹은 포도 시렁 wc칸 폭 x 3칸 높이. 양쪽 기둥, 위에 덩굴 잎 지붕과 늘어진 송이. 가운데는 걸어 지나간다."""
    W=wc*16; H=52; c=C(W,H,seed=seed*7+600); 
    c.group(1)
    # 뒤 가로 보와 뒤 기둥은 윗면에서 보임
    c.new()
    for x in (2,W-6):
        for y in range(16,48):
            c.tone(x,y,'bark',5); c.tone(x+1,y,'bark',4); c.tone(x+2,y,'bark',3); c.tone(x+3,y,'bark',2)
    c.group(2); c.new()
    # 덩굴 지붕 (윗면)
    for y in range(4,22):
        for x in range(0,W):
            edge=(y<7 and _h(x,y,seed)<0.4) or (x<2 and _h(x,y,seed+1)<0.5) or (x>W-3 and _h(x,y,seed+2)<0.5)
            if edge: continue
            hh=_h(x,y,seed+3)
            t=6 if y<9 and hh>0.55 else 5 if y<12 else 4 if y<16 else 3
            if hh<0.18: t=max(1,t-1)
            c.tone(x,y,'leaf' if hh<0.9 else 'lily',t)
    c.new()                                     # 가로 보 앞면
    for x in range(0,W):
        c.tone(x,22,'bark',6 if x%12 else 4); c.tone(x,23,'bark',4); c.tone(x,24,'bark',2)
    c.new()                                     # 늘어진 송이
    for gx in range(6,W-4,7):
        gy=25+int(_h(gx,0,seed+7)*3)
        for k in range(5):
            w=2 if k<3 else 1
            for xx in range(gx-w+(1 if w==1 else 0),gx+w+1): c.tone(xx,gy+k,'shroom',3 if xx<=gx else 2)
        c.tone(gx-1,gy,'pink',3)
    c.group(3); c.new()                          # 앞 기둥
    for x in (0,W-4):
        for y in range(22,50):
            c.tone(x,y,'bark',6); c.tone(x+1,y,'bark',5); c.tone(x+2,y,'bark',3); c.tone(x+3,y,'bark',2)
    return pz.fin(c)

# ------------------------------------------------------------------ 포도 바구니
def grape_baskets(seed=1):
    """수확한 포도 바구니 둘 (갈대 바구니, 자주빛 송이가 수북). 32x26"""
    W,H=32,26; c=C(W,H,seed=seed*2+700); c.shadow(16,23,13,2.2,a=85)
    def basket(cx,by,rx,hgt):
        c.new()
        for y in range(by-hgt,by+1):
            k=(y-(by-hgt))/max(1,hgt)
            hw=int(rx*(1-0.18*k))
            for x in range(cx-hw,cx+hw+1):
                nx=(x-cx)/max(1,hw)
                t=5 if nx<-0.4 else 4 if nx<0.3 else 3
                if (x+y)%3==0: t=max(1,t-2)
                c.tone(x,y,'rope',t)
        c.new()
        for y in range(by-hgt-4,by-hgt+2):
            for x in range(cx-rx+1,cx+rx):
                dx=(x+0.5-cx)/rx; dy=(y+0.5-(by-hgt-1))/4
                if dx*dx+dy*dy<=1:
                    t=3 if (x*3+y)%5 else 2
                    if (x+y)%4==0: t=4
                    c.tone(x,y,'shroom',t)
                    if (x*7+y*3)%11==0: c.tone(x,y,'pink',3)
        c.tone(cx+rx-3,by-hgt-3,'leaf',4); c.tone(cx+rx-4,by-hgt-3,'leaf',3)
    c.group(1); basket(10,21,8,9)
    c.group(2); basket(23,22,7,8)
    return pz.fin(c)


# ------------------------------------------------------------------ 언덕 위 신전 (돌 지붕)
def _slab_roof(side,w,h):
    """돌판 지붕 바닥(능선이 남북): 세로로 줄지은 돌판 줄, 줄마다 가로 이음이 엇갈린다. 왼쪽 비탈 밝음(5~6), 오른쪽 한 단 어둡다(3~4).
    기둥과 같은 plaster 램프(CRM)를 쓴다."""
    CRM=bdv.roman.CRM
    o=Image.new('RGBA',(w,h)); p=o.load()
    for y in range(h):
        for x in range(w):
            col=x//6; xin=x%6
            jy=(y+col*5)%9                      # 줄마다 엇갈린 가로 이음
            base=5 if side=='l' else 3
            t=base
            if xin==0: t=base-1 if xin==0 and side=='l' else base-1
            if xin==5 and side=='l': t=base+1   # 돌판 오른쪽 위 모서리 반사
            if jy==0: t=base-1
            if jy==1 and side=='l': t=min(6,base+1)
            if _h(x,y,7)>0.92: t=max(2,t-1)
            elif _h(x,y,9)>0.93: t=min(6,t+1)
            r,g,b=CRM[max(1,min(6,t))]; p[x,y]=(r,g,b,255)
    return o
def temple_stone(wc=7):
    """신전: v6pieces.temple6 와 같은 앞모습(삼각 박공·여섯 기둥·계단)인데 지붕을 붉은 기와가 아니라 기둥과 같은 석재(plaster 램프)
    돌판으로 덮는다. 윗면(비탈) 밝음 > 앞면(박공·기둥 벽) 한 단 어둡다."""
    orig=bdv.pj.nstex
    bdv.pj.nstex=lambda style,side,w,h:_slab_roof(side,w,h)
    try: return bdv.v6pieces.temple6(wc)
    finally: bdv.pj.nstex=orig

NEW=dict(temple_stone=temple_stone,vine_field=vine_field,olive=olive,winery=winery,barrels_standing=barrels_standing,cask_rack=cask_rack,wine_press=wine_press,pergola=pergola,grape_baskets=grape_baskets)
