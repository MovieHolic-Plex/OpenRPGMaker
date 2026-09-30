"""버들항 변형 1번 — 성벽 교역 도시 시장 구역용 새 조각(손 도트, Python/Pillow). 버들항 v6 의 px2 엔진과 팔레트를 그대로 쓴다.
3/4 시점(윗면+앞면), 빛 왼쪽 위. 생성 이미지·외부 그림 복사 없음."""
import bdv, math
from bdv import px2, pz, Image
C=px2.C
def _h(x,y,s): return px2._hash(x,y,s)

def _rect(c,x0,y0,x1,y1,mat,fn):
    """x0..x1-1, y0..y1-1 를 fn(x,y)->톤 으로 칠한다."""
    for y in range(y0,y1):
        for x in range(x0,x1): c.tone(x,y,mat,fn(x,y))

def _plank_front(c,x0,y0,x1,y1,mat='wood',seed=1,pw=4):
    """앞면 널판: 세로 널 폭 pw, 사이 틈, 왼쪽이 밝다."""
    for y in range(y0,y1):
        for x in range(x0,x1):
            i=(x-x0)//pw; lx=(x-x0)%pw
            t=4 if y<y0+2 else 3
            if lx==pw-1: t=1
            elif lx==0: t+=1
            if _h(i,y//5,seed)>0.82: t-=1
            c.tone(x,y,mat,max(1,min(6,t)))

def _disc(c,cx,cy,r,mat,tf):
    for y in range(int(cy-r)-1,int(cy+r)+2):
        for x in range(int(cx-r)-1,int(cx+r)+2):
            if (x+.5-cx)**2+(y+.5-cy)**2<=r*r: c.tone(x,y,mat,tf(x,y))

# ------------------------------------------------------------------ 건초 더미 (마구간 곁)
def hay_bales(seed=1):
    """건초 단 셋(둘 아래·하나 위) 32x30. 윗면 밝은 금빛, 앞면 짚 결과 밧줄 두 줄."""
    W,H=32,30; c=C(W,H,seed=seed*3+900); c.shadow(16,27,15,2.5,a=85)
    def bale(x0,y0,w,h,sd):
        c.group(1); c.new()
        for y in range(y0,y0+h):
            for x in range(x0,x0+w):
                top=y<y0+4
                if top: t=5 if x<x0+w*0.55 else 4
                else:
                    t=4 if x<x0+w*0.4 else 3 if x<x0+w-4 else 2
                    if _h(x,y//2,sd)>0.72: t-=1
                    if (y-y0)%3==0 and _h(x,y,sd+1)>0.4: t+=0
                if top and _h(x,y,sd+2)>0.7: t-=1
                c.tone(x,y,'gold',max(1,min(6,t)))
        for rx in (x0+w//4,x0+w*3//4):                  # 밧줄 두 줄
            for y in range(y0+3,y0+h): c.tone(rx,y,'rope',3); c.tone(rx+1,y,'rope',2)
        for x in range(x0,x0+w):                       # 삐져나온 짚
            if _h(x,0,sd+7)>0.6: c.tone(x,y0-1,'gold',4)
    bale(2,17,15,10,1)
    bale(16,16,14,11,2)
    bale(7,7,15,10,3)
    return pz.fin(c)

# ------------------------------------------------------------------ 말 물통
def trough(seed=1):
    """나무 물통 32x20: 윗면에 물, 앞면 널판과 쇠테."""
    W,H=32,24; c=C(W,H,seed=seed*5+910); c.shadow(16,21,15,2,a=85)
    c.group(1); c.new()
    for y in range(3,8):                                         # 윗면 (테두리+물)
        for x in range(2,30):
            edge=(y==3 or x<4 or x>27)
            if edge: c.tone(x,y,'wood',5 if x<16 else 4)
            else:
                t=4
                if _h(x,y,seed+2)>0.85: t=5
                c.tone(x,y,'teal',t)
    c.new()
    _plank_front(c,2,8,30,19,'wood',seed=seed+4,pw=4)
    for y in range(8,19):                                        # 앞면은 한 단 눌러 윗면과 갈라 준다
        for x in range(2,30):
            lx=(x-2)%4
            c.tone(x,y,'wood',1 if lx==3 else 3 if lx==0 else 2)
    for hx in (8,21):                                            # 쇠테
        for y in range(8,19): c.tone(hx,y,'iron',4); c.tone(hx+1,y,'iron',2)
    for x in range(3,29): c.tone(x,18,'wood',2)
    c.new()                                                      # 다리(짧게)
    for x in (3,4,26,27):
        for y in range(19,21): c.tone(x,y,'bark',3)
    return pz.fin(c)

# ------------------------------------------------------------------ 고삐 매는 가로대
def hitching_rail(seed=1):
    """말 매는 가로대 48x22: 기둥 둘 + 가로 막대 + 고삐 고리 하나."""
    W,H=48,22; c=C(W,H,seed=seed*7+920); c.shadow(24,19,22,2,a=80)
    c.group(1)
    for px in (4,41):
        c.new()
        for y in range(2,19):
            for x in (px,px+1,px+2): c.tone(x,y,'bark',5 if x==px else 4 if x==px+1 else 2)
        for x in (px,px+1,px+2): c.tone(x,2,'bark',6 if x==px else 5)
    c.new()
    for y in (6,7,8):
        for x in range(3,45): c.tone(x,y,'wood',5 if y==6 else 4 if y==7 else 2)
    c.new()                                                      # 고삐 고리
    for x,y in ((20,9),(19,10),(21,10),(19,11),(21,11),(20,12)): c.tone(x,y,'iron',4 if x<21 else 2)
    c.tone(20,8,'rope',4)
    return pz.fin(c)

# ------------------------------------------------------------------ 짐수레
def wagon(seed=1,cover=(0.0)):
    """덮개 씌운 짐수레 64x46: 앞면 널판, 바퀴 둘(정면), 밝은 베 덮개 윗면, 끌채 앞으로."""
    W,H=64,46; c=C(W,H,seed=seed*11+930); c.shadow(32,42,29,3,a=85)
    c.group(1); c.new()                                          # 덮개 (윗면: 둥근 지붕)
    for y in range(2,20):
        prof=(y-2)/18
        hw=int(24*(0.55+0.45*math.sin(min(1,prof*1.35)*math.pi/2)))
        for x in range(32-hw,32+hw):
            nx=(x+0.5-32)/hw
            t=6 if nx<-0.55 else 5 if nx<-0.1 else 4 if nx<0.45 else 3
            if y>=17: t-=1
            if _h(x//2,y,seed)>0.86: t-=1
            c.tone(x,y,'cream',max(1,min(6,t)))
    for hx in (12,24,36,48):                                     # 덮개 이음 줄
        for y in range(4,18): c.tone(hx,y,'cream',2 if y%3 else 3)
    c.new()                                                      # 앞면 (수레 몸통)
    _plank_front(c,7,20,57,32,'wood',seed=seed+2,pw=5)
    for x in range(7,57): c.tone(x,20,'wood',5); c.tone(x,31,'wood',2)
    for x in (7,8,55,56):
        for y in range(20,32): c.tone(x,y,'bark',3 if x in (7,55) else 2)
    c.new()                                                      # 바퀴 둘
    for wx in (14,50):
        _disc(c,wx,33,8,'bark',lambda x,y: 5 if (x+y)%7==0 else 3 if x<wx else 2)
        _disc(c,wx,33,5,'wood',lambda x,y: 1)
        for k in range(8):
            a=k*math.pi/4
            for r in range(1,6): c.tone(int(wx+math.cos(a)*r),int(33+math.sin(a)*r),'wood',4 if k%2 else 3)
        _disc(c,wx,33,1.6,'iron',lambda x,y: 4)
    c.new()                                                      # 끌채
    for x in range(26,38):
        for y in (40,41): c.tone(x,y,'wood',4 if y==40 else 2)
    return pz.fin(c)

# ------------------------------------------------------------------ 대장간 마당 (모루·석탄통·담금 통)
def forge_yard(seed=1):
    """대장간 앞 48x30: 그루터기 위 모루, 담금물 통, 석탄 통. 불씨 한 점."""
    W,H=48,30; c=C(W,H,seed=seed*13+940); c.shadow(24,27,22,2.5,a=85)
    c.group(1); c.new()                                          # 그루터기
    for y in range(15,26):
        for x in range(5,17):
            nx=(x+0.5-11)/6
            c.tone(x,y,'bark',5 if nx<-0.3 else 4 if nx<0.4 else 2)
    for x in range(5,17): c.tone(x,15,'bark',6 if x<11 else 5)
    c.new()                                                      # 모루
    for y in range(6,15):
        for x in range(3,19):
            if y<=9: t=6 if (x<8 and y==6) else 5 if x<16 else 4       # 윗면 4줄(밝음)
            elif y<11 and 3<=x<=18: t=3 if x<11 else 2
            else:
                if not 7<=x<=14: continue
                t=3 if x<11 else 2
            c.tone(x,y,'iron',t)
    for x in range(3,6): c.tone(x,10,'iron',3)                   # 뿔 밑
    c.new()                                                      # 담금물 통
    for y in range(17,27):
        for x in range(21,32):
            top=y<20
            if top:
                edge=(y==17 or x in (21,31))
                c.tone(x,y,'wood' if edge else 'teal',5 if edge else (3 if y==18 else 4))
            else:
                nx=(x+0.5-26)/5.5
                c.tone(x,y,'wood',5 if nx<-0.4 else 4 if nx<0.2 else 3 if nx<0.65 else 2)
    for y in (21,25):
        for x in range(21,32): c.tone(x,y,'iron',4 if x<26 else 2)
    c.new()                                                      # 석탄 통
    for y in range(13,27):
        for x in range(34,46):
            if y<17:
                edge=(y==13 or x in (34,45))
                if edge: c.tone(x,y,'wood',5 if x<40 else 4)
                else:
                    t=3 if _h(x,y,seed+5)<0.55 else 2
                    if _h(x,y,seed+6)>0.85: t=5
                    c.tone(x,y,'dark',t+1)
                    if _h(x,y,seed+8)>0.96: c.tone(x,y,'fire',3)
            else:
                _plank_front(c,34,17,46,27,'wood',seed=seed+9,pw=4)
    c.new()
    for x in (36,38,39,42): c.tone(x,15,'dark',4)
    return pz.fin(c)

# ------------------------------------------------------------------ 길드 깃발 기둥
def banner_pole(hue='red',seed=1):
    """길드 깃발 기둥 16x64: 위쪽 가로대에 늘어진 깃발, 금빛 문장. hue=red|teal."""
    W,H=16,64; c=C(W,H,seed=seed*17+950); c.shadow(8,61,6,2,a=80)
    c.group(1); c.new()
    for y in range(3,62):
        c.tone(7,y,'bark',5); c.tone(8,y,'bark',3)
    c.tone(7,2,'gold',6); c.tone(8,2,'gold',4); c.tone(7,1,'gold',5)
    c.new()
    for x in range(2,14): c.tone(x,5,'bark',5 if x<8 else 3)
    c.tone(2,4,'gold',5); c.tone(13,4,'gold',3)
    c.new()
    for y in range(6,32):                                        # 깃발 (아래 끝은 톱니)
        for x in range(3,13):
            if y>28 and ((x+y)%4<2) and x!=7 and x!=8 and False: continue
            if y>=28 and abs(x-7.5)<(y-27)*1.0 and False: continue
            notch = y>=27 and abs(x-7.5)<=(y-26)*0.9 and False
            if y>=27 and abs(x-7.5)<((y-26)*1.2)*0.0+ (y-26)*0.9 and y>=29: continue
            t=5 if x<6 else 4 if x<9 else 3
            if x>=11: t=2
            if _h(x,y//3,seed+3)>0.85: t-=1
            c.tone(x,y,hue,max(1,min(6,t)))
    c.new()                                                      # 금빛 문장 (작은 저울)
    for x in range(4,12): c.tone(x,12,'gold',5)
    for y in range(12,20): c.tone(7,y,'gold',5); c.tone(8,y,'gold',3)
    for x,y in ((4,14),(5,15),(6,15),(9,15),(10,15),(11,14)): c.tone(x,y,'gold',4)
    for x in range(4,7): c.tone(x,17,'gold',4)
    for x in range(9,12): c.tone(x,17,'gold',3)
    c.new()                                                      # 돌 받침 (윗면 2줄 + 앞면 2줄)
    for y in range(57,61):
        for x in range(4,12):
            if y<=58: c.tone(x,y,'stone',6 if y==57 and x<8 else 5)
            else: c.tone(x,y,'stone',3 if x<8 else 2)
    return pz.fin(c)

# ------------------------------------------------------------------ 통행세 초소
def toll_booth(seed=1):
    """성문 안쪽 통행세 초소 32x56: 기와 지붕, 앞이 트인 벽, 계산대와 장부."""
    W,H=32,56; c=C(W,H,seed=seed*19+960); c.shadow(16,53,14,2.5,a=85)
    c.group(1); c.new()                                          # 뒷벽(회벽)
    for y in range(22,50):
        for x in range(4,28):
            t=4 if x<10 else 3 if x<22 else 2
            c.tone(x,y,'plaster',t)
    c.new()                                                      # 열린 앞(어두운 내부)
    for y in range(28,46):
        for x in range(8,24): c.tone(x,y,'dark',2 if y<36 else 3)
    c.new()                                                      # 계산대
    for y in range(41,50):
        for x in range(3,29):
            if y<43: c.tone(x,y,'wood',5 if x<16 else 4)
            else:
                lx=(x-3)%5
                c.tone(x,y,'wood',1 if lx==4 else 4 if lx==0 else 3)
    for x in range(10,19): c.tone(x,41,'cream',5)                # 장부
    c.tone(10,40,'cream',6); c.tone(18,40,'cream',4)
    c.new()                                                      # 기둥
    for px_ in (4,26):
        for y in range(20,50):
            c.tone(px_,y,'bark',5); c.tone(px_+1,y,'bark',3)
    c.new()                                                      # 지붕 (앞이 낮은 삼각 기와: 윗면 + 처마)
    for y in range(2,24):
        prof=(y-2)/21
        hw=int(6+prof*11)
        for x in range(16-hw,16+hw):
            nx=(x+0.5-16)/max(1,hw)
            t=5 if nx<-0.2 else 4 if nx<0.5 else 3
            if (x+(y//3)*2)%5==0: t-=1
            if y>=21: t=2
            c.tone(x,y,'clay',max(1,min(6,t)))
    for x in range(1,31):
        c.tone(x,22,'clay',2); c.tone(x,23,'wood',2)
    return pz.fin(c)

# ------------------------------------------------------------------ 포목 좌판 (노란 줄무늬 차양)
def cloth_stall(hue='gold',seed=1):
    """포목 좌판 48x50: 노랑·아이보리 줄무늬 차양, 앞 걸이에 늘어진 천 필."""
    W,H=48,50; c=C(W,H,seed=seed*23+970); c.shadow(24,47,21,2.5,a=85)
    c.group(1); c.new()
    for y in range(20,44):                                       # 뒷 진열대 (나무 앞면)
        for x in range(4,44):
            t=3 if y<22 else 4
            if (x-4)%5==4: t=1
            c.tone(x,y,'wood',t)
    c.new()                                                      # 걸린 천 필들 (세로 줄)
    cols=(('red',4),('teal',4),('cream',5),('pink',4),('gold',4),('teal',3),('red',3))
    for k,(m,t0) in enumerate(cols):
        x0=6+k*5
        for y in range(23,38 - (k%3)*2):
            for x in range(x0,x0+4):
                t=t0 if x<x0+2 else t0-1
                if y>34-(k%3)*2: t-=1
                c.tone(x,y,m,max(1,t))
    c.new()                                                      # 좌판 앞 (계산 판)
    for y in range(38,46):
        for x in range(2,46):
            c.tone(x,y,'wood',5 if y==38 else 4 if y<41 else 3 if y<44 else 2)
    c.new()                                                      # 기둥
    for px_ in (3,43):
        for y in range(12,46): c.tone(px_,y,'bark',5); c.tone(px_+1,y,'bark',3)
    c.new()                                                      # 차양 (윗면 줄무늬 + 앞 늘어진 주름)
    for y in range(3,20):
        for x in range(1,47):
            stripe=((x+1)//4)%2==0
            m='gold' if stripe else 'cream'
            t=5 if y<8 else 4 if y<16 else 3
            if x<8: t+=1
            if x>38: t-=1
            c.tone(x,y,m,max(1,min(6,t)))
    for x in range(1,47):                                        # 톱니 주름 가장자리
        stripe=((x+1)//4)%2==0
        c.tone(x,20,'gold' if stripe else 'cream',2)
        if (x%4) in (1,2): c.tone(x,21,'gold' if stripe else 'cream',2)
    return pz.fin(c)

# ------------------------------------------------------------------ 곡식 자루 쌓기
def sack_pile(seed=1):
    """곡식 자루 무더기 32x28: 아래 둘, 위 하나. 묶은 입."""
    W,H=32,28; c=C(W,H,seed=seed*29+980); c.shadow(16,25,14,2.5,a=85)
    def sack(cx,by,w,h,sd):
        c.group(1); c.new()
        for y in range(by-h,by):
            r=(y-(by-h))/h
            hw=int((w/2)*(0.55+0.7*math.sin(min(1,r*1.15)*math.pi*0.55)))
            if r<0.14: hw=3
            for x in range(int(cx-hw),int(cx+hw)):
                nx=(x+0.5-cx)/max(1,hw)
                t=5 if nx<-0.35 else 4 if nx<0.25 else 3 if nx<0.7 else 2
                if _h(x,y,sd)>0.86: t-=1
                c.tone(x,y,'cream',max(1,min(6,t)))
        for x in range(int(cx-3),int(cx+3)): c.tone(x,by-h+3,'rope',3)   # 묶음 끈
        c.new()                                                          # 윗면: 벌어진 자루 주둥이(밝은 타원)
        ty=by-h-1
        for y in range(ty-1,ty+3):
            for x in range(int(cx-5),int(cx+5)):
                dx=(x+0.5-cx)/5.0; dy=(y+0.5-(ty+0.5))/2.0
                if dx*dx+dy*dy<=1: c.tone(x,y,'cream',6 if dx<0.2 else 5)
        c.tone(int(cx)-1,ty,'dark',2); c.tone(int(cx),ty,'dark',2)
    sack(9,26,14,14,1); sack(23,26,14,13,2); sack(16,15,14,12,3)
    return pz.fin(c)

# 조각 목록: (이름, 그림 함수 결과, 설명)
def all_parts():
    return [('hay_bales',hay_bales(),'건초 단 더미 (마구간 곁)'),
            ('trough',trough(),'말 물통'),
            ('hitching_rail',hitching_rail(),'말 매는 가로대'),
            ('wagon',wagon(),'덮개 씌운 짐수레'),
            ('forge_yard',forge_yard(),'대장간 마당: 모루·담금물 통·석탄 통'),
            ('banner_red',banner_pole('red'),'길드 깃발 기둥 (붉은색)'),
            ('banner_teal',banner_pole('teal',2),'길드 깃발 기둥 (청록색)'),
            ('toll_booth',toll_booth(),'통행세 초소'),
            ('cloth_stall',cloth_stall(),'포목 좌판 (노랑 줄무늬 차양)'),
            ('sack_pile',sack_pile(),'곡식 자루 무더기')]
