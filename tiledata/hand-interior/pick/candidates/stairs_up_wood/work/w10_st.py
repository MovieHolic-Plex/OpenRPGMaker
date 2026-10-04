import sys; sys.path.insert(0,'.')
from w10lib import *
S='stairs_up_wood'
W,H=48,48
def emit2(name,raw,mat):
    for (x,y) in ((0,0),(1,0),(0,1),(46,0),(47,0),(47,1)): raw.put(x,y,'.')
    out=[f'// w10 {name}',f'@size {W} {H}','@cell 16','@palette palette.pal','@block 0 0']+raw.rows()
    used=sorted({c for r in mat.rows() for c in r}-set('.~-'))
    for c in used: out.append(f'@mat {c} wood {c}')
    out.append('@mblock 0 0'); out+=mat.rows()
    p=f'{CAND}/{S}/{name}.pxg'; open(p,'w').write('\n'.join(out)+'\n'); check(p)
def walls(raw,left_lit=False,joints=True,y0=0):
    for y in range(y0,H):
        for x,c in zip(range(0,4),'ABCD'): raw.put(x,y,c)
        for x,c in zip(range(44,48),'CBFA'): raw.put(x,y,c)
        if joints and y%8==7:
            raw.put(1,y,'A'); raw.put(2,y,'B'); raw.put(3,y,'C'); raw.put(45,y,'F'); raw.put(46,y,'F')
        if left_lit:
            raw.put(3,y,'D'); raw.put(4,y,'.') 
def build(strong):
    raw=Cv(W,H); mat=Cv(W,H)
    walls(raw)
    # 위 어두운 입구
    raw.rect(4,0,40,5,'E'); raw.hline(4,5,40,'F')
    raw.rect(4,0,1,5,'F') if False else None
    n=7; th=3; rh=3
    for k in range(n):
        y=6+k*6                      # 위에서 아래로. k=0 이 가장 멀다
        depth=(n-1-k)                # 0 = 가장 가까움
        dk = 0 if not strong else 0
        far=1 if k<2 else 0          # 먼 두 단은 한 단계 어둡게
        if strong: far = 2 if k<2 else (1 if k<4 else 0)
        tread=[ '7','6','6' ]
        for j in range(th):
            for x in range(4,44):
                t=int(tread[j])-far
                if x<7: t+=1 if not strong else 1
                if x>=39: t-=1
                mat.put(x,y+j,str(max(1,min(7,t))))
        # 앞 모서리(코 끝) 밝은 줄
        for x in range(4,44):
            t=7-far - (1 if x>=39 else 0)
            mat.put(x,y,str(max(2,t)))
        # 챌판(앞면)
        for j in range(rh):
            for x in range(4,44):
                base=[2,3,3][j] if not strong else [1,2,3][j]
                t=base-(1 if far and strong else 0)
                if x<7: t+=1
                if x>=39: t-=1
                if j==0 and strong: t=1
                mat.put(x,y+th+j,str(max(1,min(7,t))))
        # 판자 이음(세로) 몇 곳
        for x in (15,27,35):
            for j in range(rh): mat.put(x+(k%2)*3,y+th+j,'1')
        # 마루 끝 이음
        if not strong:
            for x in (13,26,38): mat.put(x+(k%3),y+1,'5' if far==0 else '4')
    # 옆 손잡이 판(좌 밝음/우 어두움)
    for y in range(6,48):
        mat.put(4,y,'7' if not strong else '6'); mat.put(5,y,'5'); 
        mat.put(43,y,'2'); mat.put(42,y,'3')
    return raw,mat
raw,mat=build(False); emit2('w10-A',raw,mat)
raw,mat=build(True)
# 코 끝에서 챌판으로 떨어지는 그림자 줄 (더 어둡게) + 바닥 어둡게
for k in range(7):
    y=6+k*6
    for x in range(6,42): mat.put(x,y+3,'0' if False else '1')
emit2('w10-B',raw,mat)

# ---- C: 원근 계단 (위로 갈수록 좁아짐) ----
raw=Cv(W,H); mat=Cv(W,H)
walls(raw)
raw.rect(4,0,40,5,'E'); raw.hline(4,5,40,'F')
for k in range(7):
    y=6+k*6; sh=6-k
    lo=4+2*sh; hi=43-2*sh
    far=2 if k<2 else (1 if k<4 else 0)
    # 옆 돌벽 (계단 뒤 양쪽 그늘)
    for yy in range(y,y+6):
        for x in range(4,lo): raw.put(x,yy,'D' if x<lo-1 else 'C') if k>=0 and x<lo else None
        for x in range(hi+1,44): raw.put(x,yy,'F' if x>hi+1 else 'A')
    for x in range(lo,hi+1):
        for j in range(3):
            t=[7,6,6][j]-far
            if x==lo: t+=1
            if x>=hi-1: t-=1
            mat.put(x,y+j,str(max(1,min(7,t))))
        for j in range(3):
            t=[1,2,3][j]-(1 if far>=2 else 0)
            if x==lo: t+=1
            if x>=hi-1: t-=1
            mat.put(x,y+3+j,str(max(1,min(7,t))))
    for x in (lo+9+(k%2)*3,hi-10-(k%2)*3):
        for j in range(3): mat.put(x,y+3+j,'1')
# 벽 바탕 위쪽 어두운 그라데이션
emit2('w10-C',raw,mat)
