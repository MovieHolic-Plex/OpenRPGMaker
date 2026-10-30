"""첫사랑 엔딩 A·B·C 카드 그림 — 게임 속 도트로 만든 장면 (2026-10-30 r3, 사용자 「엔딩 이미지가 너무 형편없음」).

예전 카드는 공용 애니풍 전신 초상을 사진 같은 도시 위에 오려 붙인 콜라주였다(인물이 배경과 따로 놀고, 밤에 밀짚모자, 아래가 잘림).
이제는 게임 화면과 같은 16px 도트로 짓는다. 재료는 모두 저장소 안의 그림이다 — 새로 생성한 사람·그림은 없다:
  - 옥상 난간·바닥: fl_rooftop 을 런타임으로 찍은 ending-src/rooftop-fence.png (QA 체크포인트 묶음 first-love-endart, ea-roof)
  - 밤 거리: fl_street_pm 을 찍은 ending-src/street-night-office.png (ea-street, 세계 좌표 (80,80)~(400,300))
  - 하늘·빌딩: public/assets/panoramas/oprn-pano-{sunset,sunset-clouds,sunset-skyline,night,night-stars-*,sky-day-city-*}.png
  - 인물: 걷기 칩 Modern2.png (서하 6번·지후 2번, 게임과 같은 칩)
A = 노을 옥상 난간 앞에 나란히 선 두 사람(뒷모습, 해가 빌딩 뒤로), B = 별 뜬 밤 옥상에 혼자 선 서하(손에 연두색 편지),
C = 비 오는 밤 회사 문 앞에 혼자 선 서하. 엔딩 카드의 가운데 글 판(약 x 418~1254, y 141~800)을 피해 인물은 오른쪽(A·B)·왼쪽 아래(C)에 둔다.
A 는 에필로그 대사창(아래 28%) 위에도 보이도록 인물을 화면 52~66% 높이에 둔다.
논리 해상도 280×157 에 짓고, r4 부터는 인물이 크게 보이게 209×118 창을 골라 ×8 최근접 확대(도트 유지) → 1672×941.
r4: A·B 인물은 오른쪽 삼분선(글 판 왼쪽 기둥, presentation.textSide), C 는 왼쪽 삼분선. 승강장 고백의 회상 그림(first-love-memory.jpg)도
방송실 맵(ending-src/broadcast-room.png, 체크포인트 ea-bcast) + 어린 서하·지후 칩 + 세피아로 짓는다.
실행: python3 scripts/content/first-love/bake_ending_cards.py  (결정적)
"""
from __future__ import annotations

import random
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
TITLE = ROOT / "public/assets/generated/title"
SRC = Path(__file__).resolve().parent / "ending-src"
R = str(ROOT / "public/assets") + "/"
LW,LH=280,157   # logical
SCALE=6
CH=Image.open(R+'generated/charsets/Modern2.png').convert('RGBA')
def chip(idx,dirrow,frame=1):
    bx=(idx%4)*72; by=(idx//4)*128
    return CH.crop((bx+frame*24, by+dirrow*32, bx+frame*24+24, by+dirrow*32+32))
UP,RIGHT,DOWN,LEFT=0,1,2,3
SEOHA,JIHU=6,2
def pano(n): return Image.open(R+'panoramas/'+n).convert('RGBA')
def arr(im): return np.asarray(im.convert('RGBA')).astype(np.float32)/255
def img(a): return Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8),'RGBA')
def grade(im, mul, add=(0,0,0)):
    a=arr(im); a[...,:3]=a[...,:3]*np.array(mul)+np.array(add); return img(a)
def recolor_sil(im, top, bot, win=None, winp=0.5, seed=1):
    """silhouette: opaque pixels -> vertical gradient top->bot; bright pixels (windows) -> warm lights."""
    a=arr(im); h=a.shape[0]; t=np.linspace(0,1,h)[:,None,None]
    col=np.array(top)*(1-t)+np.array(bot)*t
    lum=a[...,:3].mean(axis=2)
    out=a.copy(); out[...,:3]=col[...,:3] if col.shape[-1]==3 else col
    if win is not None:
        rng=np.random.default_rng(seed)
        bright=(lum>np.percentile(lum[a[...,3]>0.5],80))&(a[...,3]>0.5)
        on=bright&(rng.random(lum.shape)<winp)
        out[on,:3]=np.array(win)
    return img(out)
def shadow_under(canvas, x, y, w=14, h=4, dx=0, alpha=0.35):
    a=arr(canvas)
    for yy in range(y-h//2, y+h//2+1):
        for xx in range(x-w//2+dx, x+w//2+dx+1):
            if 0<=yy<a.shape[0] and 0<=xx<a.shape[1]:
                if ((xx-x-dx)/(w/2))**2+((yy-y)/(h/2))**2<=1: a[yy,xx,:3]*=1-alpha
    return img(a)
# r4: 인물을 크게 — 논리 209×118 창을 ×8 로(도트 한 칸 = 8px 고르게). 창은 장면마다 인물이 글 판 반대편 삼분선에 오게 고른다.
CW,CH8=209,118
def finish_crop(canvas, name, box, vignette=0.35, bias=(0.5,0.5)):
    x0,y0=box
    win=canvas.convert('RGB').crop((x0,y0,x0+CW,y0+CH8)).resize((CW*8,CH8*8),Image.NEAREST).crop((0,0,1672,941))
    a=np.asarray(win).astype(np.float32)/255
    h,w=a.shape[:2]; yy,xx=np.mgrid[0:h,0:w]; d=np.sqrt(((xx-w*bias[0])/(w*0.62))**2+((yy-h*bias[1])/(h*0.62))**2)
    a*= (1-vignette*np.clip(d-0.55,0,1)**1.6)[...,None]
    Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(TITLE / f'first-love-{name}.jpg', quality=95, subsampling=0)
def finish(canvas, name, vignette=0.35):
    big=canvas.convert('RGB').resize((LW*SCALE,LH*SCALE),Image.NEAREST).crop((4,0,4+1672,941))
    a=np.asarray(big).astype(np.float32)/255
    h,w=a.shape[:2]; yy,xx=np.mgrid[0:h,0:w]; d=np.sqrt(((xx-w/2)/(w/2))**2+((yy-h/2)/(h/2))**2)
    a*= (1-vignette*np.clip(d-0.55,0,1)**1.6)[...,None]
    Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(TITLE / f'first-love-ending-{name}.jpg', quality=95, subsampling=0)

# ---------- rooftop base ----------
roof=Image.open(SRC / 'rooftop-fence.png').convert('RGBA')   # fence top at y=46
def roof_scene(sky_layers, floor_mul, floor_add, fence_y=70, x0=100):
    c=Image.new('RGBA',(LW,LH),(0,0,0,255))
    for L in sky_layers: c.alpha_composite(L)
    fl=roof.crop((x0,46,x0+LW,46+LH-fence_y))
    fl=grade(fl,floor_mul,floor_add)
    c.alpha_composite(fl,(0,fence_y))
    return c

def sunset_sky():
    c=Image.new('RGBA',(LW,LH),(0,0,0,0))
    c.alpha_composite(pano('oprn-pano-sunset.png').crop((260,42,260+LW,42+LH)),(0,0))   # horizon row 112 -> 70
    c.alpha_composite(pano('oprn-pano-sunset-clouds.png').crop((60,0,60+LW,100)),(0,-14))
    far=recolor_sil(pano('oprn-pano-sky-day-city-far.png').crop((40,0,40+LW,240)),(0.62,0.40,0.55),(0.45,0.28,0.45),win=(1.0,0.80,0.50),winp=0.18)
    c.alpha_composite(far,(0,-28))
    near=recolor_sil(pano('oprn-pano-sky-day-city-near.png').crop((300,0,300+LW,240)),(0.42,0.24,0.38),(0.30,0.17,0.30),win=(1.0,0.78,0.45),winp=0.22,seed=2)
    c.alpha_composite(near,(0,-77))
    c.alpha_composite(pano('oprn-pano-sunset-skyline.png').crop((330,0,330+LW,240)),(0,-43))
    return c
def night_sky():
    n=pano('oprn-pano-night.png'); c=Image.new('RGBA',(LW,LH),(0,0,0,255))
    c.alpha_composite(n.crop((0,0,LW,min(LH,n.height))),(0,0))
    c.alpha_composite(pano('oprn-pano-night-stars-far.png').crop((0,0,LW,LH)),(0,0))
    c.alpha_composite(pano('oprn-pano-night-stars-near.png').crop((20,0,20+LW,LH)),(0,0))
    far=recolor_sil(pano('oprn-pano-sky-day-city-far.png').crop((40,0,40+LW,240)),(0.17,0.19,0.32),(0.11,0.12,0.22),win=(1.0,0.86,0.52),winp=0.3,seed=3)
    c.alpha_composite(far,(0,-20))
    near=recolor_sil(pano('oprn-pano-sky-day-city-near.png').crop((300,0,300+LW,240)),(0.10,0.11,0.20),(0.07,0.07,0.14),win=(1.0,0.8,0.45),winp=0.4,seed=5)
    c.alpha_composite(near,(0,-72))
    c.alpha_composite(recolor_sil(pano('oprn-pano-sunset-skyline.png').crop((330,0,330+LW,240)),(0.05,0.05,0.10),(0.04,0.04,0.08),win=(1.0,0.8,0.45),winp=0.9,seed=4),(0,-43))
    return c

def lamp_glow(c, pts, col, k):
    a=arr(c); h,w=a.shape[:2]; yy,xx=np.mgrid[0:h,0:w]
    for (x,y) in pts:
        d=np.sqrt(((xx-x)/22.0)**2+((yy-y-6)/14.0)**2); g=np.clip(1-d,0,1)**2
        B=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16.0
        th=B[yy%4,xx%4]; q=np.floor(g*3+th)/3.0     # 3 hard steps, Bayer-dithered edges
        a[...,:3]+=(q*k)[...,None]*np.array(col)
    return img(a)
# A (r4): 노을 옥상, 난간 앞에 나란히 선 두 사람의 뒷모습. 인물이 화면 오른쪽 삼분선(글 판은 왼쪽 기둥, presentation.textSide left),
# 화분 둘 사이 트인 난간 — 예전엔 작은 두 사람이 화면 오른쪽 끝, 반쯤 잘린 화분 옆에 붙었고 아래 40%가 빈 바닥이었다(r4 검수).
RX0=177                      # 옥상 그림에서 잘라 올 x — 왼쪽 화분(192~224)·오른쪽 화분(352~384)이 다 들어온다
c=roof_scene([sunset_sky()],(1.12,0.80,0.66),(0.05,0.0,0.0),x0=RX0)
a=arr(c); t=np.linspace(1,0,LW)[None,:,None]; a[70:,:, :3]+= (np.array([0.10,0.04,-0.02])*t)[...,:3]; c=img(a)
fx=312-RX0-20; fy=70+3
for x,ch in [(fx,chip(SEOHA,UP)),(fx+16,chip(JIHU,UP))]:
    c=shadow_under(c,x+12,fy+31,w=12,h=3,alpha=0.30)
    c.alpha_composite(grade(ch,(1.08,0.92,0.84)),(x,fy))
c=lamp_glow(c,[(199-RX0,123),(375-RX0,123)],(1.0,0.75,0.45),0.35)
finish_crop(c,'ending-a',(0,22),bias=(0.6,0.45))
# B (r4): 별 뜬 밤 옥상, 같은 난간 자리에 서하 혼자 — 손에 연두색 편지.
c=roof_scene([night_sky()],(0.42,0.46,0.66),(0,0,0.02),x0=RX0)
x=312-RX0-12; y=70+3
c=shadow_under(c,x+12,y+31,w=14,h=4,alpha=0.4)
c.alpha_composite(grade(chip(SEOHA,UP),(0.62,0.66,0.9)),(x,y))
a=arr(c); a[y+18:y+21,x+19:x+21,:3]=np.array([0.86,0.92,0.80])   # the pale green letter in her hand
c=img(a)
c=lamp_glow(c,[(375-RX0,123)],(1.0,0.8,0.5),0.5)
finish_crop(c,'ending-b',(0,22),bias=(0.6,0.45))

# ---------- street (night) ----------
street=Image.open(SRC / 'street-night-office.png').convert('RGBA')   # world (80,80)..(400,300) of fl_street_pm
def erase(im, box, dx):
    x0,y0,x1,y1=box; im.paste(im.crop((x0+dx,y0,x1+dx,y1)),(x0,y0)); return im
def rain(c, n=260, seed=7, ground_y=None, col=(0.72,0.80,0.95), alpha=0.55):
    a=arr(c); rng=random.Random(seed); h,w=a.shape[:2]
    for _ in range(n):
        x=rng.randrange(-20,w); y=rng.randrange(-10,h); L=rng.randrange(4,9)
        al=alpha*rng.uniform(0.5,1.0)
        for k in range(L):
            yy=y+k; xx=x+k//3
            if 0<=yy<h and 0<=xx<w: a[yy,xx,:3]=a[yy,xx,:3]*(1-al)+np.array(col)*al
    if ground_y is not None:
        for _ in range(n//9):
            x=rng.randrange(0,w); y=rng.randrange(ground_y,h)
            for (dx,dy) in [(-1,-1),(1,-1),(0,0)]:
                xx,yy=x+dx,y+dy
                if 0<=yy<h and 0<=xx<w: a[yy,xx,:3]=a[yy,xx,:3]*0.75+np.array(col)*0.25
    return img(a)
def wet(c, ground_y, strength=0.45, smear=14):
    a=arr(c); lum=a[...,:3].max(axis=2)
    bright=np.clip((lum-0.45)/0.4,0,1)[...,None]*a[...,:3]
    out=a.copy(); h=a.shape[0]
    for y in range(ground_y,h):
        acc=np.zeros_like(bright[0])
        for k in range(1,smear):
            src=y-k*1
            if src<0: break
            acc+=bright[src]*(1-k/smear)
        out[y,:,:3]+=acc/smear*strength*1.2
    return img(out)

# C (r4): 비 오는 밤 회사 문 앞에 혼자 선 서하 — 왼쪽 삼분선(글 판은 오른쪽 기둥, textSide right), 발은 대화창 위.
SX0,SY0=9,79                 # 밤거리 그림에서 잘라 올 창(209×118)
c=street.crop((SX0,SY0,SX0+CW,SY0+CH8)).copy()
c=grade(c,(0.78,0.84,1.0))
sx,sy=146-80-SX0,212-80-SY0   # 회사 문 앞, 가로등 아래(세계 (146,212))
c=shadow_under(c,sx+12,sy+31,w=12,h=3,alpha=0.35)
c.alpha_composite(grade(chip(SEOHA,DOWN),(0.8,0.85,1.0)),(sx,sy))
c=wet(c,ground_y=145-SY0)
c=rain(c,n=320,seed=11,ground_y=145-SY0)
finish_crop(c,'ending-c',(0,0),vignette=0.45,bias=(0.35,0.5))

# ---------- 회상(승강장 고백의 기억): 10년 전 방송실 사연함 앞의 두 사람 ----------
# 방송실 맵(fl_broadcast)을 찍은 그림 + 어린 서하(Modern2 0번)·어린 지후(Modern1 0번) 칩. 사연함 판(13~14칸) 아래에 마주 선다.
# 예전 회상 그림은 고해상 애니 키아트(romance-school)라 16px 게임과 결이 달랐다(r3 처음 하는 사람 검수).
bc=Image.open(SRC / 'broadcast-room.png').convert('RGBA')
bc.paste(bc.crop((272,170,288,232)),(256,170))      # 찍을 때 남은 어른 서하(16,13)를 옆 칸 바닥·벽으로 덮는다
M1=Image.open(R+'generated/charsets/Modern1.png').convert('RGBA')
def chip_of(sheet, idx, dirrow, frame=1):
    bx=(idx%4)*72; by=(idx//4)*128
    return sheet.crop((bx+frame*24, by+dirrow*32, bx+frame*24+24, by+dirrow*32+32))
young_seoha=chip_of(CH,0,RIGHT); young_jihu=chip_of(M1,0,LEFT)
for tx,ch in [(13,young_seoha),(14,young_jihu)]:
    bc=shadow_under(bc,tx*16+8,13*16+15,w=12,h=3,alpha=0.3)
    bc.alpha_composite(ch,(tx*16-4,13*16+16-32))
# 바랜 기억 — 따뜻한 세피아, 가운데에서 번지는 빛.
a=arr(bc); lum=(a[...,:3]*np.array([0.30,0.59,0.11])).sum(axis=2,keepdims=True)
sep=lum*np.array([1.08,0.92,0.72])+np.array([0.06,0.03,0.0])
a[...,:3]=a[...,:3]*0.35+sep*0.65
bc=img(a)
finish_crop(bc,'memory',(120,139),vignette=0.55,bias=(0.5,0.55))
