# 『폴른 스타』 떨어진 별의 관 — 그을린 구덩이에 동서로 누운 관 모양 은빛 배(오프닝 crash 컷). 48x32(3x2칸).
# 3/4 탑뷰: 머리(서쪽) 1/4 어깨에서 가장 넓고 둥근 두 끝으로 좁아지는 관 모양 볼록 뚜껑(크롬처럼 윗쪽 긴 반사광 + 가운데
# 아래 어두운 반사띠) + 뚜껑 둘레 끊기지 않은 밝은 테와 바로 아래 어두운 이음매 + 남쪽 앞면(위→아래 매끈한 그러데이션,
# 고른 리벳 줄, 발 쪽 그을음) + 머리 쪽 테 두른 타원 유리창(사선 반짝임) + 가운데 희미하게 빛나는 별 문양 + 발 쪽 빛나는 지그재그 금.
# 코드 손 도트, 생성 그림 없음. 실행: python3 scripts/content/fallen-star-vessel-draw.py → /tmp/vessel/vessel.png
import os, math
from PIL import Image
W,H=48,32
im=Image.new('RGBA',(W,H),(0,0,0,0)); px=im.load()
R=[(40,54,64),(66,84,96),(98,116,128),(134,150,160),(176,190,198),(214,224,228)]
SPEC=(244,250,252)
OUT=(26,36,46,255)
GL=[(40,86,104),(84,150,168),(196,240,246)]
GLOW=(132,232,236)
SOOT=(34,30,30)
def put(p,c):
    if 0<=p[0]<W and 0<=p[1]<H: px[p]=c+(255,) if len(c)==3 else c
X0,X1,SH=1,46,11          # 머리 끝, 발 끝, 어깨
CY=9.0                    # 뚜껑 축
HW_HEAD,HW_SH,HW_FOOT=2.4,7.6,2.4
CAP=1.5                   # 둥근 끝 반지름(가로)
def hw(x):
    if abs(x-SH)<1.6: base=HW_SH-0.4
    elif x<SH: base=HW_HEAD+(HW_SH-HW_HEAD)*(x-X0)/(SH-X0)
    else: base=HW_SH+(HW_FOOT-HW_SH)*(x-SH)/(X1-SH)
    d=min(x-X0,X1-x)
    if d<0: return 0
    if d<CAP: base*=math.sqrt(max(0,1-((CAP-d)/CAP)**2))*0.55+0.45 if d>0.3 else 0
    return base
lid=set()
for x in range(W):
    for y in range(H):
        w=hw(x+0.5)
        if w>0 and abs(y+0.5-CY)<w: lid.add((x,y))
DEP=8
body=set((x,y+d) for (x,y) in lid for d in range(DEP+1) if y+d<H)
# 두 끝을 둥글게: 끝 열일수록 세로 길이를 줄여(가운데 맞춤) 곧은 세로 윤곽이 5칸을 넘지 않게 한다.
for x0,step in ((min(x for x,_ in body),1),(max(x for x,_ in body),-1)):
    for d,keep in enumerate((5,8,10,12)):
        x=x0+step*d; col=sorted(y for (xx,y) in body if xx==x)
        if len(col)<=keep: continue
        mid=(col[0]+col[-1])/2; lo=round(mid-keep/2); hi=lo+keep-1
        for y in col:
            if y<lo or y>hi: body.discard((x,y)); lid.discard((x,y))
side=body-lid
# 반투명 그림자(남동)
for (x,y) in body:
    for (dx,dy) in [(1,1),(2,1),(1,2),(2,2)]:
        q=(x+dx,y+dy)
        if q not in body and 14<=q[0]<W and q[1]<H and q[1]>=12: px[q]=(12,10,8,110)
# 앞면: 매끈한 세로 그러데이션(위 밝음 → 아래 어둠). 맨 윗줄은 이음매 어둠.
for (x,y) in side:
    top=min(yy for (xx,yy) in side if xx==x); bot=max(yy for (xx,yy) in side if xx==x); u=y-top
    if u==0: k=0
    elif u<=2: k=3
    elif u<=4: k=2
    elif y<bot: k=1
    else: k=0
    put((x,y),R[k])
# 리벳: 앞면 u==2 줄, 4칸마다 고르게 — 윗칸 빛, 아랫칸 그늘
for x in range(4,W-3,4):
    col=[yy for (xx,yy) in side if xx==x]
    if len(col)<5: continue
    t=min(col); put((x,t+1),R[5]); put((x,t+2),R[1])
# 발 쪽 그을음 얼룩(앞면) — 가운데 짙고 가장자리 옅게 번진 한 덩이
for (x,y) in side:
    top=min(yy for (xx,yy) in side if xx==x)
    if y-top<2: continue
    d=math.hypot((x-39)/1.6,(y-(top+4)))
    if d<1.6: put((x,y),SOOT)
    elif d<3.2: put((x,y),R[0])
# 뚜껑: 볼록 크롬 — v=-1(북쪽 끝)~+1(남쪽 끝)
for (x,y) in lid:
    v=(y+0.5-CY)/max(0.1,hw(x+0.5))
    if v<-0.75: k=4
    elif v<-0.25: k=5
    elif v<0.15: k=3
    elif v<0.55: k=2
    else: k=3
    put((x,y),R[k])
# 긴 반사광: v≈-0.5 줄을 따라 한 줄(끝 가까이는 끊는다)
for x in range(SH-2,X1-5):
    ys=[y for (xx,y) in lid if xx==x]
    if not ys: continue
    y=round(CY-0.5*hw(x+0.5)-0.5); put((x,y),SPEC)
# 뚜껑 둘레: 북·서쪽 가장자리는 R4, 남쪽 가장자리는 끊기지 않은 밝은 테(R5), 바로 아래 앞면 첫 줄이 어두운 이음매
for (x,y) in lid:
    if (x,y+1) not in lid: put((x,y),R[5])
    elif (x,y-1) not in lid or (x-1,y) not in lid or (x+1,y) not in lid: put((x,y),R[4] if y<CY else R[3])
# 머리 쪽 타원 유리창 + 밝은 테 + 사선 반짝임
wc=(8.5,8.8); wa,wb=4.2,3.0
win=set((x,y) for (x,y) in lid if ((x+0.5-wc[0])/wa)**2+((y+0.5-wc[1])/wb)**2<1)
for (x,y) in win: put((x,y),GL[0] if y+0.5>wc[1]+0.6 else GL[1])
for (x,y) in lid:
    if (x,y) not in win and any(n in win for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]): put((x,y),R[5] if y<=wc[1] else R[4])
for p in [(6,8),(7,7),(8,8),(9,9)]:
    if p in win: put(p,GL[2])
# 가운데 별 문양(희미한 빛) — 별에서 온 배
sx,sy=24,9
for p in [(sx,sy-1),(sx-1,sy),(sx+1,sy),(sx,sy+1)]: put(p,GL[1])
put((sx,sy),GLOW)
for p in [(sx-2,sy),(sx+2,sy)]: put(p,R[4])
# 발 쪽 빛나는 지그재그 금(7칸)
crack=[(36,7),(37,8),(37,9),(38,10),(39,10),(39,11),(40,12)]
for i,p in enumerate(crack): put(p,GLOW if i%2==0 else R[0])
for p in [(36,8),(38,9),(40,11)]: put(p,R[0])
# 윤곽(물든 한 색)
for y in range(H):
    for x in range(W):
        if (x,y) in body: continue
        if any(n in body for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]): put((x,y),OUT)
bb=im.getbbox(); out=Image.new('RGBA',(W,H),(0,0,0,0)); out.paste(im.crop((0,0,W,bb[3])),(0,H-bb[3]))
os.makedirs('/tmp/vessel',exist_ok=True); out.save('/tmp/vessel/vessel.png')
print('colors',len(set(c for c in out.get_flattened_data() if c[3]==255)))
