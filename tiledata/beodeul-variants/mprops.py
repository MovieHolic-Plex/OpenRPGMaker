# 버들항 변형 2 — 광산 계곡 「검은재골」 손 도트 소품·땅 (city_v6 C 볼륨 페인터, 6단 명암·윤곽 결은 버들항과 같다)
from vprops import *
import inspect
PAL['tail']=['#0e1c22','#16303a','#22484f','#33625f','#4d7e72','#7aa294','#b4c8b0']    # 광재 연못(회청록·탁함)
PAL['rust']=['#2a1410','#4e2418','#7c3a22','#a25a30','#c47c40','#dc9f5c','#f0c88c']     # 철광석
PAL['rail']=['#14161c','#2a2e38','#464c58','#6c7480','#98a0aa','#c4cad2','#e8ecf0']
PAL['gravel']=['#241c1a','#3c302c','#5a4a42','#7a6658','#988472','#b6a28c','#d4c4ac']
PAL['brick']=['#2a1614','#45221e','#6a342a','#8c4a38','#a8604a','#c27a5c','#dc9a78']
PAL['ash']=['#1a1618','#2e2a2c','#463f42','#625a5c','#827878','#a39a96','#c6beb8']
GRAIN.update({'tail':(0.03,2),'rust':(0.12,1.6),'rail':(0.05,1.4),'gravel':(0.16,1.6),'ash':(0.14,1.8),'brick':(0.12,1.4)})
# 눈 없는 전나무 (pine 의 눈 층을 같은 침엽 밝은 톤으로)
exec(inspect.getsource(pine).replace("c.setv(x,y,'snow',min(1.0,v+0.28))","c.setv(x,y,'pine',min(1.0,v+0.02))").replace("c.setv(x,y,'pine',v-0.05)","c.setv(x,y,'pine',v-0.16)").replace("def pine","def _fir"),globals())
def fir(n=3,seed=1,w=None): return fin(_fir(n,seed,w))

def thick(c,x0,y0,x1,y1,w,mat,tones=(5,4,2)):
    """굵기 w 화소 선. 왼쪽 화소 밝게·오른쪽 어둡게."""
    n=int(max(abs(x1-x0),abs(y1-y0)))+1
    for i in range(n):
        f=i/max(1,n-1); x=int(round(x0+(x1-x0)*f)); y=int(round(y0+(y1-y0)*f))
        for k in range(w):
            t=tones[0] if k==0 else (tones[-1] if k==w-1 else tones[1])
            T(c,x+k,y,mat,t)

def rectT(c,x0,y0,x1,y1,mat,fn):
    for y in range(y0,y1):
        for x in range(x0,x1): T(c,x,y,mat,fn(x,y))

def adit():
    """갱도 입구 48x50: 바위 입, 굵은 동바리 틀, 어두운 갱, 걸린 등."""
    c=C(48,50,seed=301); c.shadow(24,47,22,2.2,110)
    # 바위 면(슬래그 섞인 돌) — 윗부분 둥글게
    c.new(); c.ellipsoid(24,14,23,13,'stone',bias=-0.06,bump=0.5,bsc=3.0)
    c.new(); c.box(1,14,46,2,34,'stone',top=0.8,front=0.52,bias=-0.06)
    # 갱구 안쪽 (어둠) — 위는 아치
    for y in range(14,48):
        for x in range(11,37):
            inner=y>=19 or ((x-23.5)/12.5)**2+((y-19)/6.0)**2<=1
            if not inner: continue
            d=(y-14)/34.0
            t=1 if y<34 else 2
            if y>=44: t=3 if (x%4<2) else 2       # 바닥 자갈
            if 26<=y<44 and (x in (11,36)): t=1
            T(c,x,y,'coal',t)
    # 갱 안 침목 두 개(깊이감)
    for (yy,xa,xb) in ((36,16,31),(41,14,33)): 
        for x in range(xa,xb): T(c,x,yy,'wood',2)
    for x in (18,29):
        for y in range(36,48): T(c,x,y,'rail',2 if y%6 else 1)
    # 동바리: 기둥 + 들보 (3/4: 앞면만)
    for y in range(16,48):
        for k in range(4):
            T(c,7+k,y,'wood',5 if k==0 else (4 if k<3 else 2)); T(c,37+k,y,'wood',5 if k==0 else (4 if k<3 else 2))
    for k in range(5):
        for x in range(5,43): T(c,x,14+k,'wood',5 if k==0 else (4 if k<3 else 2))
    for x in range(5,43,7): T(c,x,16,'wood',2)            # 들보 이음 눈금
    for (xa,ya,xb,yb) in ((11,19,15,23),(36,19,32,23)):   # 모서리 버팀대
        thick(c,xa,ya,xb,yb,3,'wood',(5,4,2))
    # 바닥 돌 턱
    for x in range(3,45): T(c,x,47,'stone',3 if x%3 else 2)
    # 걸린 등
    for y in range(20,23): T(c,15,y,'iron',3)
    for (dx,dy,t) in ((0,0,6),(1,0,5),(-1,0,5),(0,1,5),(0,2,4),(1,1,4),(-1,1,4)): T(c,15+dx,23+dy,'fire',t)
    return fin(c)

def headframe():
    """권양 탑 48x64: 기울어진 다리, 위 도르래, 줄, 바닥 작업대."""
    c=C(48,64,seed=302); c.shadow(24,61,21,2.2,100)
    c.new(); c.box(4,54,40,3,6,'wood',top=0.92,front=0.55)        # 바닥 작업대
    for x in range(6,42,5): T(c,x,58,'wood',2)
    thick(c,7,56,21,8,4,'wood',(5,4,2)); thick(c,40,56,27,8,4,'wood',(4,3,2))   # 다리
    for (yy,xa,xb) in ((28,14,34),(44,10,38)):                    # 가로 버팀
        for x in range(xa,xb):
            T(c,x,yy,'wood',5); T(c,x,yy+1,'wood',4); T(c,x,yy+2,'wood',2)
    thick(c,14,44,32,30,2,'wood',(4,3,3)); thick(c,34,44,17,30,2,'wood',(4,3,3))  # 엇갈림
    # 도르래 바퀴
    cx,cy,R=24,8,6
    for y in range(cy-R,cy+R+1):
        for x in range(cx-R,cx+R+1):
            d=math.hypot(x-cx,y-cy)
            if R-1.4<=d<=R+0.4: T(c,x,y,'iron',5 if (x+y)<cx+cy else 3)
            elif d<R-1.4: T(c,x,y,'iron',1 if d<1.6 else 2)
    for a in range(4):
        ang=a*math.pi/4
        for r in range(1,R-1): T(c,int(round(cx+math.cos(ang)*r)),int(round(cy+math.sin(ang)*r)),'iron',4)
    # 줄과 통(케이지)
    for y in range(cy+R,50): T(c,23,y,'rope',5 if y%4 else 3); T(c,24,y,'rope',3)
    c.new(); c.box(18,46,12,3,6,'wood',top=0.95,front=0.6)
    for x in range(18,30): T(c,x,49,'iron',3)
    return fin(c)

def cart_v(load=True):
    """광차(수직 선로 위, 앞에서 본 짧은 면) 16x20."""
    c=C(16,20,seed=311); c.shadow(8,17.5,6,1.2,90)
    c.new(); c.box(3,4,10,3,9,'iron',top=0.95,front=0.5)
    for y in range(9,13):
        for x in range(3,13): T(c,x,y,'rust' if (x+y)%5 else 'iron',3 if y<11 else 2)
    if load: c.new(); c.ellipsoid(8,4.5,4.6,2.6,'coal',bump=0.6,bsc=2.0)
    for x in (2,12): 
        for y in range(13,18): T(c,x,y,'iron',2); T(c,x+1,y,'iron',3)
    for x in range(3,13): T(c,x,4,'iron',5)
    return fin(c)

def cart_h(load=True):
    """광차(수평 선로 위, 긴 옆면) 28x20."""
    c=C(28,20,seed=312); c.shadow(14,17.5,11,1.2,90)
    c.new(); c.box(2,5,24,3,8,'iron',top=0.95,front=0.5)
    for y in range(8,13):
        for x in range(2,26):
            T(c,x,y,'rust' if (x//3+y)%4 else 'iron',4 if y<10 else 2)
    for x in (2,8,14,20,25): 
        for y in range(8,13): T(c,x,y,'iron',2)
    if load: c.new(); c.ellipsoid(14,5,10,3,'coal',bump=0.6,bsc=2.0); c.ellipsoid(10,4,4,2,'rust',bump=0.5,bsc=2.0)
    for x in (5,20):
        for dy in range(13,17):
            for dx in range(0,4): T(c,x+dx,dy,'iron',5 if (dx==0 or dy==13) else 2) if (dx*dx+ (dy-14.5)**2)<=6 else None
    return fin(c)

def slag_heap(w=48,h=34,seed=1):
    c=C(w,h,seed); c.shadow(w/2,h-3.5,w*0.46,2.6,100)
    c.ellipsoid(w*0.40,h*0.60,w*0.36,h*0.34,'slag',bump=0.6,bsc=2.4)
    c.ellipsoid(w*0.68,h*0.68,w*0.27,h*0.26,'slag',bump=0.6,bsc=2.4)
    c.ellipsoid(w*0.45,h*0.40,w*0.2,h*0.20,'slag',bias=0.03,bump=0.7,bsc=2.0)
    for i in range(int(w*h/60)):
        x=int(hsh(i,seed,1)*w); y=int(hsh(i,seed,2)*h)
        if c.inb(x,y) and c.m[y][x] and hsh(i,seed,3)>0.4: T(c,x,y,'coal' if i%2 else 'ash',2 if i%2 else 5)
    return fin(c)

def ore_pile(w=28,h=18,seed=1):
    c=C(w,h,seed); c.shadow(w/2,h-2.5,w*0.44,1.8,90)
    c.ellipsoid(w*0.45,h*0.58,w*0.40,h*0.38,'coal',bias=0.12,bump=0.8,bsc=2.0)
    c.ellipsoid(w*0.66,h*0.66,w*0.26,h*0.28,'coal',bias=0.08,bump=0.8,bsc=2.0)
    for i in range(12):
        x=int(w*0.2+hsh(i,seed,4)*w*0.6); y=int(h*0.3+hsh(i,seed,5)*h*0.4)
        if c.inb(x,y) and c.m[y][x]: T(c,x,y,'rust' if i%3 else 'gold',5 if i%3 else 4)
    return fin(c)

def slag_rock(w=24,h=18,seed=1):
    c=C(w,h,seed); c.shadow(w/2,h-2.5,w*0.44,2.0,100)
    c.ellipsoid(w/2,h*0.55,w*0.44,h*0.40,'slag',bias=-0.02,bump=0.55,bsc=2.6)
    return fin(c)

def ore_bin():
    """광석 빈 32x34: 다리 네 개 위 깔때기 통, 앞 미닫이 홈통."""
    c=C(32,34,seed=321); c.shadow(16,31,14,2,100)
    for x in (3,26):
        for y in range(22,32):
            for k in range(3): T(c,x+k,y,'wood',5 if k==0 else (4 if k==1 else 2))
    c.new(); c.box(1,2,30,4,20,'wood',top=0.95,front=0.56)
    for x in range(2,30):                                          # 윗면 광석
        for y in range(3,6): T(c,x,y,'coal' if (x+y)%3 else 'rust',3 if y>3 else 4)
    for x in range(1,31,5):
        for y in range(6,22): T(c,x,y,'wood',2)
    for y in (10,17):
        for x in range(1,31): T(c,x,y,'iron',3)
    for x in range(12,20):                                           # 홈통 입
        for y in range(18,23): T(c,x,y,'coal',1 if y<21 else 2)
    return fin(c)

def tool_rack():
    """곡괭이 걸이 32x28."""
    c=C(32,28,seed=331); c.shadow(16,25,13,1.6,90)
    for x in (3,27):
        for y in range(6,26):
            for k in range(3): T(c,x+k,y,'wood',5 if k==0 else (4 if k==1 else 2))
    for x in range(3,30):
        T(c,x,6,'wood',5); T(c,x,7,'wood',4); T(c,x,8,'wood',2)
    for px_ in (8,15,22):
        for y in range(9,20): T(c,px_,y,'bark',4); T(c,px_+1,y,'bark',2)
        for i in range(-4,6):
            yy=9+abs(i)//3; T(c,px_+i,yy-1 if abs(i)>2 else yy-2,'iron',5 if i<0 else 3)
        T(c,px_-4,10,'iron',2); T(c,px_+5,10,'iron',2)
    return fin(c)

def rail_buffer():
    """선로 끝 막이 16x16 (가로 선로 끝): 말뚝 둘과 가로 들보."""
    c=C(16,16,seed=341); c.shadow(8,13.5,6,1.2,80)
    for y in range(3,14):
        for k in range(3): T(c,3+k,y,'wood',5 if k==0 else (4 if k==1 else 2))
    for y in range(6,15):
        for k in range(3): T(c,9+k,y,'wood',5 if k==0 else (4 if k==1 else 2))
    for x in range(3,13): T(c,x,8,'iron',5); T(c,x,9,'iron',3)
    return fin(c)

def sluice():
    """씻는 홈통 48x32: 다리 위 기운 나무 통과 물."""
    c=C(48,32,seed=351); c.shadow(24,29,21,1.8,90)
    for x in (4,18,32,43):
        for y in range(17,30):
            for k in range(3): T(c,x+k,y,'wood',5 if k==0 else (4 if k==1 else 2))
    for x in range(1,47):
        yb=int(12+x*0.12)
        for y in range(yb,yb+5): T(c,x,y,'wood',5 if y==yb else (4 if y<yb+3 else 2))
        for y in range(yb-3,yb): T(c,x,y,'tail',4 if y==yb-1 else 3)
    for x in range(1,47,5):
        yb=int(12+x*0.12); T(c,x,yb-1,'tail',6)
    return fin(c)

def kiln():
    """제련로 (용광로) 40x40: 돌 몸체, 불 켜진 아치 입, 위 굴뚝 받침."""
    c=C(40,40,seed=361); c.shadow(20,37,18,2.2,110)
    c.new(); c.box(2,6,36,5,27,'stone',top=0.95,front=0.52)
    for y in range(11,33):                                        # 돌 이음
        for x in range(2,38):
            if ((x+(y//5%2)*3)%8==0) or y%5==0: T(c,x,y,'stone',2)
    # 불 켜진 입
    for y in range(18,33):
        for x in range(12,28):
            if y>=22 or ((x-19.5)/7.5)**2+((y-22)/4.0)**2<=1:
                d=(y-18)/14.0
                T(c,x,y,'fire',6 if (abs(x-19.5)<3 and y>27) else (5 if d>0.45 else 4) if (x+y)%3 else 3)
    for x in range(11,29): T(c,x,17,'stone',5) if False else None
    for x in range(11,29): T(c,x,33,'coal',2)
    for y in range(6,11):                                          # 윗면 그을림
        for x in range(2,38):
            if (x+y)%4==0: T(c,x,y,'ash',3)
    return fin(c)

def chimney():
    """벽돌 굴뚝 24x80: 붉은 벽돌 몸통, 벽돌 이음, 위 테두리."""
    c=C(24,80,seed=371); c.shadow(12,77,10,2,100)
    c.cylinder(12,4,74,6.5,'brick',capry=2.4,amb=0.2)
    c.cylinder(12,62,76,9.5,'brick',capry=3.0,amb=0.2)
    for y in range(6,76):
        for x in range(2,22):
            if not (c.inb(x,y) and c.m[y][x]): continue
            if y%3==0: T(c,x,y,'brick',2)
            elif (x+(y//3%2)*2)%4==0: T(c,x,y,'brick',2)
    for x in range(5,20): 
        if c.inb(x,4): T(c,x,4,'coal',2)
    for y in (13,14):
        for x in range(5,20):
            if c.inb(x,y) and c.m[y][x]: T(c,x,y,'brick',5 if y==13 else 3)
    return fin(c)

def smoke(frame=0,w=28,h=44,seed=5):
    """굴뚝 연기: 증기 그림을 재로 물들인다."""
    im=steam(frame,w,h,seed).copy(); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if a:
                l=(r+g+b)/3/255.0
                t=int(round(2+l*3)); col=hx(PAL['ash'][min(6,t)])
                px[x,y]=col+(int(a*0.8),)
    return im

def cart_track_stop(): return rail_buffer()

def lamp_post():
    """광산 가로등 16x36: 돌 받침 위 굵은 동바리 기둥, 위쪽 팔걸이 들보와 버팀대, 쇠사슬에 매달린 철 등롱."""
    c=C(16,36,seed=381); c.shadow(6,33,6,1.5,90)
    for y in range(11,32):                                        # 기둥 (왼 밝음·가운데·오른 어두움)
        T(c,5,y,'wood',5); T(c,6,y,'wood',4); T(c,7,y,'wood',2)
    for y in (16,22,28): 
        for x in (5,6,7): T(c,x,y,'wood',2 if x<7 else 1)         # 결 틈
    for x in range(3,10):                                         # 돌 받침 (앞면 윗면)
        T(c,x,30,'stone',5 if x<6 else 4)
    for y in range(31,34):
        for x in range(3,10): T(c,x,y,'stone',4 if x<5 else (3 if x<8 else 2))
    T(c,5,32,'stone',2); T(c,7,31,'stone',2)                      # 돌 틈
    for x in range(5,14): T(c,x,9,'wood',5); T(c,x,10,'wood',4)   # 팔걸이 들보
    for x in range(5,14): T(c,x,11,'wood',2) if x>6 else None
    for (x,y) in ((8,12),(9,11)): T(c,x,y,'wood',3)              # 버팀대
    T(c,7,13,'wood',3); T(c,8,12,'wood',3)
    T(c,13,8,'iron',4); T(c,13,9,'iron',5)                        # 들보 끝 고리
    for y in (11,12): T(c,13,y,'iron',3 if y==11 else 2)          # 쇠사슬
    for x in range(11,16): T(c,x,13,'iron',5 if x<13 else 3)      # 등롱 뚜껑
    T(c,12,12,'iron',4); T(c,13,12,'iron',5); T(c,14,12,'iron',3)
    for y in range(14,19):                                        # 등롱 몸통 (쇠틀 + 불빛)
        T(c,11,y,'iron',4); T(c,15,y,'iron',2)
        for x in (12,13,14): T(c,x,y,'fire',6 if (x==13 and 15<=y<=17) else (5 if y in (15,16,17) else 4))
    for x in range(11,16): T(c,x,19,'iron',2)                     # 등롱 바닥
    T(c,13,20,'iron',3)
    return fin(c)

def timber_pile():
    """갱목 더미 32x16: 눕힌 통나무·각재를 엇갈려 네 단으로 쌓고, 쇠띠로 묶고, 맨 위에 광석 덩이."""
    c=C(32,16,seed=173); c.shadow(16,14.5,15,1.3,90)
    rows=((12,2,30),(9,4,28),(6,3,29),(3,5,26))                   # (밑줄 y, 왼 x, 오른 x)
    for r,(y,xa,xb) in enumerate(rows):
        for yy in range(y,y+3):                                   # 단 하나 = 3화소 높이 각재
            t=5 if yy==y else (4 if yy==y+1 else 2)
            for x in range(xa,xb): T(c,x,yy,'wood',t)
        for x in range(xa+3+r*2,xb-2,9 if r%2 else 7): T(c,x,y+1,'wood',3)     # 결 마디
        for yy in range(y,y+3):                                   # 오른쪽 단면 (둥근 나이테)
            T(c,xb,yy,'bark',2); T(c,xb+1,yy,'bark',1) if yy==y+1 else None
        T(c,xb-1,y+1,'wood',6)                                    # 단면 밝은 점(나이테)
        T(c,xa-1,y+1,'bark',1)
    for xs in (9,21):                                             # 쇠띠
        for y in range(3,15):
            if c.inb(xs,y) and c.m[y][xs]: T(c,xs,y,'iron',3 if y%4 else 5)
            if c.inb(xs+1,y) and c.m[y][xs+1]: T(c,xs+1,y,'iron',2)
    for (x0,x1,y,tt) in ((13,19,2,(3,4,5,4,3,2)),(14,18,1,(4,6,5,3)),(15,17,0,(5,4))):   # 광석 더미 (윗줄일수록 좁게)
        for i,x in enumerate(range(x0,x1)): T(c,x,y,'rust' if (x+y)%5 else 'coal',tt[i])
    for x in (12,19,20): T(c,x,2,'coal',2)
    T(c,22,2,'rust',5); T(c,23,2,'rust',3); T(c,23,1,'rust',4)
    return fin(c)

def miner_bench():
    c=C(32,20,seed=391); c.shadow(16,17,13,1.4,80)
    c.new(); c.box(2,6,28,3,4,'wood',top=0.95,front=0.6)
    for x in (4,25):
        for y in range(13,18):
            for k in range(3): T(c,x+k,y,'wood',5 if k==0 else (4 if k==1 else 2))
    return fin(c)
