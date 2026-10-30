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
논리 해상도 280×157 에 짓고 ×6 최근접 확대(도트 유지) → 1672×941.
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
# A2: rooftop sunset, both at fence, backs
c=roof_scene([sunset_sky()],(1.12,0.80,0.66),(0.05,0.0,0.0))
# warm light wash from left (sun) fading right
a=arr(c); t=np.linspace(1,0,LW)[None,:,None]; a[70:,:, :3]+= (np.array([0.10,0.04,-0.02])*t)[...,:3]; c=img(a)
fx=213; fy=70+3
for x,ch in [(fx,chip(SEOHA,UP)),(fx+16,chip(JIHU,UP))]:
    c=shadow_under(c,x+12,fy+36,w=9,h=12,dx=0,alpha=0.30)
    c.alpha_composite(grade(ch,(1.08,0.92,0.84)),(x,fy))
c=lamp_glow(c,[(99,123),(275,123)],(1.0,0.75,0.45),0.35)
finish(c,'a')
# B2: rooftop night, Seoha alone at fence
c=roof_scene([night_sky()],(0.42,0.46,0.66),(0,0,0.02))
x=222; y=70+3
c=shadow_under(c,x+12,y+31,w=14,h=4,alpha=0.4)
c.alpha_composite(grade(chip(SEOHA,UP),(0.62,0.66,0.9)),(x,y))
a=arr(c); a[y+18:y+21,x+19:x+21,:3]=np.array([0.86,0.92,0.80])   # the pale green letter in her hand
c=img(a)
c=lamp_glow(c,[(99,123),(275,123)],(1.0,0.8,0.5),0.5)
finish(c,'b')

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

# C1: rain in front of the office tower
c=street.crop((20,20,20+LW,20+LH)).copy()
c=grade(c,(0.78,0.84,1.0))
sx,sy=146-100,212-100           # at tower door, under the light
c=shadow_under(c,sx+12,sy+31,w=12,h=3,alpha=0.35)
c.alpha_composite(grade(chip(SEOHA,DOWN),(0.8,0.85,1.0)),(sx,sy))
c=wet(c,ground_y=125)
c=rain(c,n=420,seed=11,ground_y=125)
finish(c,'c',vignette=0.45)


