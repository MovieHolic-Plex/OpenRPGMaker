#!/usr/bin/env python3
"""EasyRPG RTP 칩셋 실측 — 숫자만 뽑는다(그림은 make_crops.py). 원본 픽셀은 저장하지 않는다.
원본: public/assets/easyrpg-chipset-*.png (brave-stone 워크트리), CC BY 4.0 · EasyRPG RTP (Exterior 는 CC0 JasonPerry)."""
import sys, numpy as np
from PIL import Image
ROOT='/home/main/.herdr/worktrees/rpg-zzu/worktree-brave-stone-6ff0/public/assets/'
EX=np.array(Image.open(ROOT+'easyrpg/chipset/Exterior.png').convert('RGBA')).astype(int)
CT=np.array(Image.open(ROOT+'easyrpg-chipset-combined-town-transparent.png').convert('RGBA')).astype(int)
AC=np.array(Image.open(ROOT+'easyrpg/charset/Actor1.png').convert('RGBA')).astype(int)
def L(a): return (0.3*a[...,0]+0.59*a[...,1]+0.11*a[...,2])
def tiles(a,c0,r0,nc,nr): return a[r0*16:(r0+nr)*16, c0*16:(c0+nc)*16]
def period(sig,maxp=20):
    s=sig-sig.mean(); best=[]
    for p in range(2,min(maxp,len(sig)//2)):
        n=len(s)-p
        c=(s[:n]*s[p:]).sum()/max(1e-9,(s*s).sum())
        best.append((c,p))
    return sorted(best,reverse=True)[:3]
def rowprof(t): return L(t).mean(axis=1)
out=[]
def P(*a): print(*a); 
# 1. 지붕 기와(빨강) : 열 14~15, 행 12~13
for name,src,c0,r0 in [('ex 빨강 기와',EX,14,12),('ct 주황 기와',CT,14,12)]:
    t=tiles(src,c0,r0,2,2); rp=rowprof(t)
    P(name,'행 밝기(32행):',' '.join(f'{int(v)}' for v in rp))
    P('  세로 주기 후보',[(round(c,2),p) for c,p in period(rp)],' 가로 주기 후보',[(round(c,2),p) for c,p in period(L(t).mean(axis=0),16)])
    dark=[i for i,v in enumerate(rp) if v<rp.mean()*0.55]
    P('  어두운 행(처마 그림자 띠) 인덱스',dark)
# 2. 벽돌 벽 : 열 14~15 행 10~11
for name,src,c0,r0 in [('ex 크림 벽돌',EX,14,10),('ex 회색 벽돌',EX,14,11),('ct 벽돌',CT,14,10)]:
    t=tiles(src,c0,r0,2,1); rp=rowprof(t)
    P(name,'세로 주기',[(round(c,2),p) for c,p in period(rp)],'가로 주기',[(round(c,2),p) for c,p in period(L(t).mean(axis=0),16)])
# 3. 문(ct 열 26 행 3~4)
t=tiles(CT,26,3,1,2); a=t[...,3]>0
ys,xs=np.where(a); P('ct 문 bbox w×h',xs.max()-xs.min()+1,ys.max()-ys.min()+1)
lum=L(t); 
P('  문 열 0 밝기(윤곽)',[int(v) for v in lum[:,0][::4]],' 열 8',[int(v) for v in lum[:,8][::4]])
dk=(lum<lum[a].mean()*0.5)&a
P('  어두운 픽셀 비율(윤곽·틈)',round(dk.sum()/a.sum(),2),' 테두리 어두운 열 수(왼쪽)',[int(dk[:,x].mean()*100) for x in range(4)])
# 4. 창(ex 격자창 근처 : 8 크기 예측)  → 별도 측정표 아래
# 5. 지면 오토타일 가장자리 : 흙 덩이 ex 열 0~2 행 13~15, 모래 열 4~5
for name,src,c0,r0 in [('ex 흙 덩이',EX,0,12),('ex 모래 덩이',EX,3,12)]:
    t=tiles(src,c0,r0,3,4)
    # 풀색(녹색 우세)이 아닌 픽셀 = 덩이
    g=(t[...,1]>t[...,0]+15)&(t[...,1]>t[...,2]+15)
    solid=~g
    P(name,'덩이 비율',round(solid.mean(),2))
    # 각 행의 왼쪽 가장자리 위치
    for y in (0,2,4,6,8,10,12,14,16,24,32,40,48,56):
        if y<t.shape[0]:
            xs=np.where(solid[y])[0]; P('   y',y,'덩이 x 범위',(xs.min(),xs.max()) if len(xs) else None)
    break
# 6. 캐릭터 : Actor1 첫 캐릭터 24×32 프레임
f=AC[0:32,0:24]; a=f[...,3]>0; ys,xs=np.where(a); P('Actor1 프레임 첫 칸 bbox',xs.min(),ys.min(),xs.max()-xs.min()+1,ys.max()-ys.min()+1)
# 7. 상하층 분리 : ct 하층(열 6~17)·상층(열 18~29) 채워진 칸 수
def filled(a,c0,c1):
    n=0
    for r in range(16):
        for c in range(c0,c1):
            if (a[r*16:(r+1)*16,c*16:(c+1)*16,3]>0).any(): n+=1
    return n
P('ct 자동타일 열 0~5 채움',filled(CT,0,6),'하층 열 6~17',filled(CT,6,18),'상층 열 18~29',filled(CT,18,30))
# 8. 지면 덩이(오토타일 견본) bbox·모서리 : 흙(열0~2 행13~15), 모래(열3~5), 자갈 광장(열9~11 행5~7 ex)
def blob(name,src,c0,r0,nc,nr,isbg):
    t=tiles(src,c0,r0,nc,nr); m=~isbg(t)
    ys,xs=np.where(m); W=nc*16; H=nr*16
    P(name,'bbox',xs.min(),ys.min(),xs.max()+1,ys.max()+1,'/',W,H)
    # 모서리 반경: 맨 위 행에서 덩이가 처음 시작하는 x
    top=[np.where(m[y])[0] for y in range(H)]
    first=[(y,int(t_.min()),int(t_.max())) for y,t_ in enumerate(top) if len(t_)][:8]
    P('   위쪽 8행 (y,x시작,x끝)',first)
    # 왼쪽 벽 흔들림 : 세로 중간 행들의 x 시작 min/max
    mid=[int(t_.min()) for t_ in top[H//4:3*H//4] if len(t_)]
    P('   왼쪽 가장자리 x 시작 범위(중간 절반)',min(mid),max(mid))
isgrass=lambda t:(t[...,1]>t[...,0]+15)&(t[...,1]>t[...,2]+15)
blob('ex 흙 덩이',EX,0,13,3,3,isgrass)
blob('ex 모래 덩이',EX,3,13,3,3,isgrass)
# 자갈 광장 : 배경이 풀
blob('ex 자갈 광장',EX,9,5,3,3,isgrass)
# 광장 테두리 어두운 띠 두께: 중앙 가로줄의 왼쪽 8픽셀 밝기
t=tiles(EX,9,5,3,3); lm=L(t)[24]; P('   광장 y=24 왼쪽 12px 밝기',[int(v) for v in lm[:12]])
