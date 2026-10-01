import math, sys
W=H=32
TONE='0123456789abcde'
class G:
    def __init__(s):
        s.m=[['.']*W for _ in range(H)]; s.t=[['0']*W for _ in range(H)]
    def set(s,x,y,m,t):
        if 0<=x<W and 0<=y<H: s.m[y][x]=m; s.t[y][x]=TONE[t]
    def get(s,x,y):
        return (s.m[y][x], TONE.index(s.t[y][x])) if 0<=x<W and 0<=y<H else ('.',0)
def ell(cx,cy,a,b):
    S=set()
    for y in range(H):
        for x in range(W):
            if ((x+0.5-cx)/a)**2+((y+0.5-cy)/b)**2<=1: S.add((x,y))
    return S
def octa(cx,cy,a,b,c):
    # octagon: half-width a, half-height b, chamfer c
    S=set()
    for y in range(H):
        for x in range(W):
            dx=abs(x+0.5-cx); dy=abs(y+0.5-cy)
            if dx<=a and dy<=b and dx+dy*a/b*0+ (dy/b*a) <= a*2-0 and (dx/a + dy/b) <= 2-c: S.add((x,y))
    return S
def shift(S,dy): return {(x,y+dy) for x,y in S}
def extrude(top,h):
    U=set(top)
    for d in range(1,h+1): U|=shift(top,d)
    return U
def nb4(x,y): return [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
def tier(g,top,h,cx,a,mat,topt,sidet,rimt,line,kind):
    sil=extrude(top,h); side=sil-top
    for (x,y) in top:
        t=topt
        if (x,y-1) not in top or (x-1,y) not in top: t=min(6,topt+1)   # 왼쪽·위 모서리 밝게
        g.set(x,y,mat,t)
    for (x,y) in side:
        u=(x+0.5-cx)/a
        if kind=='oct':
            t=sidet+1 if u<-0.45 else (sidet if u<0.45 else sidet-1)
        else:
            t=sidet+1 if u<-0.55 else (sidet if u<0.0 else (sidet-1 if u<0.6 else max(sidet-2,1)))
        g.set(x,y,mat,t)
    # 윗면 앞 입술 밝은 줄
    for (x,y) in top:
        if (x,y+1) in side: g.set(x,y,mat,min(6,topt+1) if x<cx else topt)
    # 윤곽
    for (x,y) in sil:
        if any(n not in sil for n in nb4(x,y)): g.set(x,y,mat,line)
    return sil
def dim(g,S,d):
    for (x,y) in S:
        m,t=g.get(x,y)
        if m!='.': g.set(x,y,m,max(1,t-d))
def stand(g,x0,ytop,frame,fm,sheet_notes=True,pole='b',pt=4):
    # 악보판 10x7, 아래 턱, 기둥, 삼발이
    for y in range(ytop,ytop+7):
        for x in range(x0,x0+10):
            edge = x in (x0,x0+9) or y in (ytop,ytop+6)
            if edge: g.set(x,y,fm,frame)
            else: g.set(x,y,'l',5 if (x<x0+5 or y<ytop+2) else 4)
    if sheet_notes:
        for k,y in enumerate((ytop+2,ytop+4)):
            for x in range(x0+2,x0+8):
                if (x+k)%3!=0: g.set(x,y,'l',2)
        g.set(x0+2,ytop+3,'l',2); g.set(x0+5,ytop+3,'l',2)
    # 턱
    for x in range(x0+1,x0+9): g.set(x,ytop+7,fm,frame+1 if x<x0+5 else frame)
    # 기둥
    px=x0+4
    for y in range(ytop+8,ytop+12):
        g.set(px,y,pole,pt+1); g.set(px+1,y,pole,pt-1)
    # 삼발이
    for x in range(px-3,px+5):
        g.set(x,ytop+12,pole,pt if x<px+1 else pt-2)
    g.set(px-2,ytop+13,pole,pt-2); g.set(px+3,ytop+13,pole,pt-2)
def baton(g,pts_handle,pts_shaft,pts_shadow,hm='k',ht=2):
    for x,y in pts_shadow: 
        m,t=g.get(x,y)
        if m!='.': g.set(x,y,m,max(1,t-2))
    for x,y in pts_shaft: g.set(x,y,'l',6)
    for x,y in pts_handle: g.set(x,y,hm,ht)
HEAD='''@size 32 32
@cell 16
@palette palette.pal
@mat d dwood 4
@mat l linen 5
@mat b brass 4
@mat k black 3
@mat i iron 3
@mat r red 3
@mat w wood 5
@mat p pine 4
'''
def write(name,g,note):
    out=[HEAD.rstrip('\n'),'@mblock 0 0']+[''.join(r) for r in g.m]+['@tblock 0 0']+[''.join(('.' if g.m[y][x]=='.' else g.t[y][x]) for x in range(W)) for y in range(H)]
    open(name+'.pxg','w').write('\n'.join(out)+'\n'); open(name+'.note','w').write(note+'\n')

# ---------- D: 팔레트 그대로 팔각 2단, 놋쇠 악보대 ----------
def D():
    g=G()
    lo=octa(16,19.5,14,6.5,0.42); sl=tier(g,lo,5,16,14,'d',4,3,0,0,'oct')
    up=octa(16,12.5,10,5,0.4);   su=tier(g,up,3,16,10,'d',5,3,0,0,'oct')
    dim(g,{(x,y) for (x,y) in lo if (x,y-1) in su and (x,y) not in su},1)
    stand(g,11,1,2,'b',True,'b',4)
    baton(g,[(17,14),(18,14)],[(19,13),(20,13),(21,12),(22,12)],[(19,14),(20,14),(21,13),(22,13)],'d',1)
    write('w31-D',g,'팔각 2단 나무 단(윗단 윗면 넓게, 아랫단 둘레 보임) + 놋쇠 악보대(악보에 음표 점) + 윗면에 놓인 흰 지휘봉')
# ---------- E: 둥근 2단 + 붉은 융단 원반 + 검은 철 악보대 ----------
def E():
    g=G()
    lo=ell(16,19.2,14,6.6); tier(g,lo,5,16,14,'d',4,3,0,0,'rnd')
    up=ell(16,12.6,10,5.2); su=tier(g,up,3,16,10,'d',5,3,0,0,'rnd')
    dim(g,{(x,y) for (x,y) in lo if (x,y-1) in su and (x,y) not in su},1)
    # 붉은 융단 원반(윗면 가운데)
    rug=ell(16,12.6,7.2,3.4)
    for (x,y) in rug: g.set(x,y,'r',3 if x<18 else 2)
    for (x,y) in rug:
        if any(n not in rug for n in nb4(x,y)): g.set(x,y,'r',2 if x<18 else 1)
    stand(g,11,1,1,'k',True,'k',3)
    baton(g,[(17,14),(18,14)],[(19,13),(20,13),(21,12),(22,12)],[(19,14),(20,14),(21,13),(22,13)],'k',2)
    write('w31-E',g,'둥근 2단 나무 단 + 윗면 붉은 융단 원반 + 검은 철 악보대와 흰 지휘봉(융단 위에 또렷)')
# ---------- F: 팔각 1단 넓은 윗면 + 놋쇠 테두리 + 소나무빛 ----------
def F():
    g=G()
    lo=octa(16,19,14.5,7.5,0.5); sl=tier(g,lo,5,16,14.5,'p',4,3,0,0,'oct')
    # 놋쇠 테두리(윗면 안쪽 한 줄)
    inner={(x,y) for (x,y) in lo if all(n in lo for n in nb4(x,y))}
    edge={(x,y) for (x,y) in inner if any(n not in inner for n in nb4(x,y)) and (x,y+1) in lo}
    for (x,y) in edge: g.set(x,y,'b',4 if x<16 else 3)
    # 윗면 무늬: 소나무 판 이음 한 줄
    for (x,y) in lo:
        pass
    # 지휘봉 자리 문양(윗면 가운데 작은 원)
    stand(g,11,1,2,'b',True,'i',3)
    baton(g,[(15,16),(16,16)],[(17,15),(18,15),(19,14),(20,14),(21,13)],[(17,16),(18,16),(19,15),(20,15),(21,14)],'d',1)
    write('w31-F',g,'팔각 1단 넓은 소나무빛 단(윗면이 가장 크게 보임) + 놋쇠 테두리 + 철 기둥 놋쇠 악보대 + 흰 지휘봉')
D();E();F()
