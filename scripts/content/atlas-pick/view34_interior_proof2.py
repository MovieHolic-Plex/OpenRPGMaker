#!/usr/bin/env python3
"""실내 3/4 증명 2판(modern-style-bible.md §11-4) — 전수조사(2026-10-01)에서 계속 틀린 유형의 기준 그림.
둥근 기둥(타원 머리·밑동) · 옆을 보는 의자(E/W) · 옆을 보는 회중석 · 북향 긴의자 · 석관 · 성경대.
  python3 scripts/content/atlas-pick/view34_interior_proof2.py
출력: tiledata/atlas-pick/style-demo-view34/interior-new-{column,chair-e,chair-w,pew-e,pew-n,sarcophagus,lectern}.png
     (+ 같은 이름의 interior-old-*: 전수조사 때 시트에 구워져 있던 틀린 그림 — 이미 있으면 덮지 않는다)"""
import os, sys
import numpy as np
from PIL import Image
T=-1
class G:
    def __init__(s,w,h): s.w,s.h=w,h; s.c=np.full((h,w),T,np.int64); s.z=np.full((h,w),-1e9)
    def put(s,x,y,col,z=0):
        if 0<=x<s.w and 0<=y<s.h and z>=s.z[y,x]: s.c[y,x]=col; s.z[y,x]=z
    def rect(s,x,y,w,h,col,z=0):
        for j in range(h):
            for i in range(w): s.put(x+i,y+j,col,z)
    def outline(s,col,skip_bottom=False):
        m=s.c!=T; o=s.c.copy()
        for y in range(s.h):
            for x in range(s.w):
                if not m[y,x]: continue
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X,Y=x+dx,y+dy
                    if not(0<=X<s.w and 0<=Y<s.h) or not m[Y,X]:
                        o[y,x]=col; break
        s.c=o
    def img(s,shadow=None):
        a=np.zeros((s.h,s.w,4),np.uint8)
        for y in range(s.h):
            for x in range(s.w):
                v=s.c[y,x]
                if v!=T: a[y,x]=((v>>16)&255,(v>>8)&255,v&255,255)
        return Image.fromarray(a,'RGBA')

def ramp(dx,cols):
    """dx -1..1 (왼→오) → 원통 음영. 빛이 왼쪽 위라 밝은 띠가 왼쪽 1/3."""
    t=(dx+1)/2  # 0..1
    # 밝은 정점 t=0.28
    if t<0.12: k=1
    elif t<0.42: k=len(cols)-1
    else: k=max(0,int(round((1-(t-0.42)/0.58)*(len(cols)-2))))
    return cols[k]

def cylinder(g,cx,rx,ry,ytop,ybot,cols,z=0):
    """원통 옆면: 각 열에서 앞 호(ytop+e)부터 아래 앞 호(ybot+e)까지."""
    for x in range(int(np.floor(cx-rx)),int(np.ceil(cx+rx))):
        dx=(x+0.5-cx)/rx
        if abs(dx)>1: continue
        e=ry*np.sqrt(1-dx*dx)
        for y in range(int(round(ytop+e)),int(round(ybot+e))):
            g.put(x,y,ramp(dx,cols),z)

def disk_top(g,cx,cy,rx,ry,top,hi,edge,z=1):
    """원판 윗면 타원(중심 cy). 왼쪽 위 hi, 앞 호 1행은 edge(앞 가장자리 하이라이트)."""
    for x in range(int(np.floor(cx-rx)),int(np.ceil(cx+rx))):
        dx=(x+0.5-cx)/rx
        if abs(dx)>1: continue
        e=ry*np.sqrt(1-dx*dx)
        y0,y1=int(round(cy-e)),int(round(cy+e))
        for y in range(y0,y1):
            col=top
            if dx<-0.25 and y<cy: col=hi
            g.put(x,y,col,z)
        if y1-1>=y0: g.put(x,y1-1,edge,z)

class C:
    def __init__(s,w,h): s.w,s.h=w,h; s.a=np.zeros((h,w,4),np.uint8)
    def P(s,x,y,c,al=255):
        if 0<=x<s.w and 0<=y<s.h: s.a[y,x]=((c>>16)&255,(c>>8)&255,c&255,al)
    def R(s,x,y,w,h,c,al=255):
        for j in range(h):
            for i in range(w): s.P(x+i,y+j,c,al)
    def img(s): return Image.fromarray(s.a,'RGBA')
def box3(c,x,y,w,T,F,top,hi,back,edge,front,frontlo,ol,right=None):
    """바깥 윤곽 포함 상자: (x,y) 윤곽 왼쪽 위, 폭 w(윤곽 포함). 반환: 앞면 첫 행 y."""
    c.R(x,y,w,T+F+2,ol)
    c.R(x+1,y+1,w-2,T,top); c.R(x+1,y+1,w-2,1,back); c.R(x+1,y+2,1,max(0,T-2),hi)
    c.R(x+1,y+T,w-2,1,edge)
    fy=y+1+T
    c.R(x+1,fy,w-2,F,front); c.R(x+1,fy+F-1,w-2,1,frontlo)
    if right is not None: c.R(x+w-2,fy,1,F,right)
    return fy

MB=dict(o=0x3a3440,d=0x5b5561,m=0x7d7682,n=0x9f97a3,l=0xbbb4be,L=0xd1cdd4,w=0xe8e6e9,W=0xffffff)
def column(P=MB):
    g=G(16,48)
    side=[P['d'],P['m'],P['n'],P['l'],P['L'],P['w']]
    # 밑동 원판: 중심 cx=8, rx 7, ry 2.5, 윗면 cy=41, 옆면 3행
    cylinder(g,8,7,2.5,41,44,[P['o'],P['d'],P['m'],P['n'],P['l']],z=0)
    disk_top(g,8,41,7,2.5,P['L'],P['w'],P['W'],z=1)
    # 몸통: rx 4, 위는 캡 밑(가려짐) 아래는 밑동 윗면에 박힘
    cylinder(g,8,4,1.5,8,41,[P['d'],P['m'],P['n'],P['l'],P['L'],P['W']],z=2)
    # 캡: 윗면 cy=3, rx 7, ry 3, 옆면 3행
    cylinder(g,8,7,3,3,6,[P['o'],P['d'],P['m'],P['n'],P['l']],z=3)
    disk_top(g,8,3,7,3,P['w'],P['W'],P['W'],z=4)
    g.outline(P['o'])
    # 캡 밑 그림자 2행(몸통 위)
    for y in (10,11):
        for x in range(5,11):
            if g.c[y,x]!=T and g.c[y,x]!=P['o']: g.c[y,x]=P['m'] if y==10 else P['n']
    # 홈(플루팅)
    for y in range(13,40):
        if g.c[y,7]!=P['o']: g.c[y,7]=P['n']
        if g.c[y,9]!=P['o']: g.c[y,9]=P['m']
    im=g.img()
    # 바닥 그림자(밑동 오른쪽 아래)
    import numpy as np
    a=np.array(im)
    for x in range(4,16):
        if a[47,x,3]==0: a[47,x]=(0,0,0,80)
    return Image.fromarray(a,'RGBA')

WD=dict(k=0x000000,w0=0x411e05,w1=0x63310b,w2=0x6d3b15,w3=0x9a5435,w4=0x9e684b,w5=0xb77246,w6=0xd59147)
RD=dict(r0=0x67030c,r1=0xa5010a,r2=0xc30014,r3=0xe03a3a)
SS=dict(o=0x1c1418,a=0x333942,b=0x49505d,c=0x606878,d=0x828a95,e=0xa5adb2,f=0xc8d0d0)
W=WD
def chair_e(flip=False):
    """동쪽을 보는 의자 16x16: 좌판 윗면 5행 + 앞면 1행 + 다리, 서쪽 가장자리에 등받이(윗날 면 + 남쪽 끝면)."""
    c=C(16,16)
    # 등받이 기둥(서쪽): 윤곽 x2..5, 윗날 y1..5 밝음, 남쪽 끝면 y6..12, 뒷다리 y13..14
    c.R(2,0,4,16,W['k']); c.R(3,1,2,5,W['w6']); c.R(4,2,1,3,W['w5'])
    c.R(3,6,2,7,W['w3']); c.R(4,6,1,7,W['w2'])
    c.R(3,13,2,2,W['w1']); c.R(2,15,4,1,0); c.P(2,15,W['k']); c.P(5,15,W['k'])
    # 좌판: x5..14 윤곽, 윗면 y7..12(T=5: 8..12), 앞면 y13
    c.R(5,7,10,8,W['k'])
    c.R(6,8,8,5,W['w5']); c.R(6,8,8,1,W['w4']); c.R(6,9,1,3,W['w6']); c.R(6,12,8,1,W['w6'])
    c.R(6,13,8,1,W['w2'])
    # 앞다리 2개
    c.R(5,15,10,1,0)
    for lx in (6,12): c.R(lx-1,14,3,2,W['k']); c.P(lx,14,W['w1']); c.P(lx,15,W['w1'])
    c.P(lx-1,15,W['k'])
    im=c.img()
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def pew_e(n=2):
    """동쪽을 보는 회중석 16x(16n+16): 좌판 윗면(방석) + 서쪽 등판(윗날+끝면) + 남쪽 끝판 앞면 + 북쪽 끝판 안쪽 면."""
    H=16*n+16; c=C(16,H)
    yN=16; yS=H-1                    # 바닥 칸 북·남 끝
    seatT=yN-6; seatF=yS-6           # 좌판 윗면(높이 6) 북끝·앞 가장자리
    # 등판(서쪽 x1..4): 높이 좌판+10 → 윗날 y0..seatF-10, 끝면 ~seatF
    c.R(1,seatT-10,4,seatF-seatT+11+6,W['k'])
    c.R(2,seatT-9,2,seatF-seatT,W['w6']); c.R(3,seatT-8,1,seatF-seatT-2,W['w5'])
    c.R(2,seatF-9,2,9,W['w3']); c.R(3,seatF-9,1,9,W['w2'])
    # 좌판 x4..15
    c.R(4,seatT-1,12,seatF-seatT+3,W['k'])
    c.R(5,seatT,10,seatF-seatT+1,W['w4']); c.R(5,seatT,1,seatF-seatT,W['w5'])
    # 방석(붉은) — 칸마다 하나
    L=(seatF-seatT-3)//n
    for i in range(n):
        y0=seatT+2+i*L
        c.R(6,y0,8,L-2,RD['r2']); c.R(6,y0,8,1,RD['r3']); c.R(6,y0,1,L-2,RD['r3']); c.R(6,y0+L-3,8,1,RD['r1']); c.R(13,y0,1,L-2,RD['r1'])
    c.R(5,seatF,10,1,W['w6'])        # 좌판 앞 가장자리
    # 북쪽 끝판: 안쪽(남쪽을 보는) 면이 좌판 위로 4px, 윗날 1행
    c.R(4,seatT-6,12,6,W['k']); c.R(5,seatT-5,10,1,W['w6']); c.R(5,seatT-4,10,3,W['w3']); c.R(5,seatT-1,10,1,W['w1'])
    # 남쪽 끝판(앞면): 좌판 앞에서 4px 위 윗날 → 바닥까지
    top=seatF-4
    c.R(1,top-1,15,yS-top+2,W['k'])
    c.R(2,top,13,2,W['w6']); c.R(2,top,1,2,W['w5'])           # 윗날(위에서 본 끝판 두께)
    c.R(2,top+2,13,yS-top-3,W['w3']); c.R(2,top+2,13,1,W['w1'])  # 앞면 + 처마 그늘
    c.R(4,top+4,9,yS-top-8,W['w2']); c.R(4,top+4,9,1,W['w0']); c.R(4,top+4,1,yS-top-8,W['w1'])  # 오목 판
    c.R(2,yS-2,13,1,W['w1'])
    c.R(0,yS,16,1,0); c.R(1,yS,2,1,W['k']); c.R(13,yS,2,1,W['k'])
    return c.img()
def pew_n():
    """북쪽(제단)을 보는 긴 의자 32x24: 등판 뒷면이 앞, 그 위로 방석 띠 2행 + 끝판(팔걸이) 윗날."""
    c=C(32,24)
    # 끝판 두 개(양 끝, 높이 좌판+4) 윗날
    for x in (0,28):
        c.R(x,2,4,22,W['k']); c.R(x+1,3,2,2,W['w6']); c.R(x+1,5,2,16,W['w3']); c.R(x+2,5,1,16,W['w2'])
    # 좌판·방석 띠(등판 뒤로 보이는 것)
    c.R(3,1,26,6,W['k']); c.R(4,2,24,2,RD['r2']); c.R(4,2,24,1,RD['r3']); c.R(4,4,24,1,W['w4'])
    # 등판: 윗날 2행 + 앞(뒷)면
    c.R(3,4,26,17,W['k'])
    c.R(4,5,24,2,W['w6']); c.R(4,5,1,2,W['w5'])
    c.R(4,7,24,12,W['w3']); c.R(4,7,24,1,W['w1'])
    for px in (5,17):  # 오목 판 두 장
        c.R(px,9,10,8,W['w2']); c.R(px,9,10,1,W['w0']); c.R(px,9,1,8,W['w1']); c.R(px+1,16,9,1,W['w4'])
    c.R(4,18,24,1,W['w1'])
    # 등판 아래 그늘(좌판 밑)
    c.R(3,21,26,2,W['w0']); c.R(3,23,26,1,0)
    for x in (0,28): c.R(x,23,4,1,W['k'])
    return c.img()
def sarcophagus():
    """석관 32x32(2x1): 뚜껑 윗면 12행(누운 조각을 위에서 본다) + 뚜껑 앞날 3행 + 몸통 앞면 + 받침."""
    c=C(32,32); S=SS
    c.R(0,1,32,17,S['o'])
    c.R(1,2,30,12,S['d']); c.R(1,2,30,1,S['c']); c.R(1,3,1,10,S['e'])
    c.R(1,13,30,1,S['f'])                                  # 앞 가장자리 하이라이트
    c.R(1,14,30,2,S['c']); c.R(1,15,30,1,S['b'])           # 뚜껑 앞날
    # 누운 조각(위에서): 머리 서쪽, 발 동쪽. 밝은 윗면 + 오른쪽 아래 그늘
    def blob(x,y,w,h):
        c.R(x,y,w,h,S['e']); c.R(x,y,w,1,S['f']); c.R(x,y,1,h,S['f']); c.R(x+1,y+h,w,1,S['b']); c.R(x+w,y+1,1,h,S['b'])
    # 누운 조각(위에서 내려다본 사람): 머리(서) → 어깨 → 포갠 손 → 옷자락 → 발끝(동, 위로 솟은 두 발)
    L,M,D,H=S['e'],S['d'],S['b'],S['f']
    rows={4:'......LLL.................',
          5:'.....LHHLL...LLLLLLL......',
          6:'....LHLLLLLLLLHHHHHHLLL.L.',
          7:'....LHLLLLLLMMLLLLLLLLLLHL',
          8:'....LLLLLLLLLMMLLLLLLLLLLL',
          9:'.....LMLLLLLLLLLLLLLLLLMLM',
          10:'......MMLLMMMMMMMMMMMMMM.M',
          11:'........MM.................'}
    for y,r in rows.items():
        for i,ch in enumerate(r):
            if ch!='.': c.P(3+i,y,{'L':L,'M':D,'H':H,'D':D}[ch])
    c.R(6,6,2,2,M); c.P(6,6,H)                              # 얼굴
    # 몸통 앞면(뚜껑보다 1px 안쪽)
    c.R(1,17,30,12,S['o']); c.R(2,17,28,11,S['c']); c.R(2,17,28,2,S['a'])  # 뚜껑 처마 그림자
    for px in (4,17):
        c.R(px,20,11,6,S['b']); c.R(px,20,11,1,S['a']); c.R(px,20,1,6,S['a']); c.R(px+1,25,10,1,S['d'])
    c.R(2,27,28,1,S['b'])
    # 받침
    c.R(0,28,32,4,S['o']); c.R(1,28,30,1,S['e']); c.R(1,29,30,2,S['c']); c.R(1,30,30,1,S['b'])
    c.R(0,31,32,1,S['o'])
    return c.img()
def lectern():
    """성경대 16x32: 기운 받침판 윗면 9행(펼친 책: 두 쪽 + 가운데 접힘 + 글줄) + 앞 턱 + 앞판 + 둥근 기둥 + 받침 윗면."""
    c=C(16,32); P1,P2,P3,TX=0xfff8ea,0xe7ded0,0xb9ab9d,0x8e8378
    c.R(1,7,14,13,WD['k'])
    c.R(2,8,12,8,WD['w5']); c.R(2,8,12,1,WD['w4']); c.R(2,9,1,6,WD['w6'])
    c.R(3,9,5,6,P1); c.R(8,9,5,6,P2); c.R(7,9,1,6,P3); c.R(8,9,1,6,P3)          # 두 쪽 + 접힘
    c.R(3,9,10,1,P2)
    for y in (10,12,14):
        c.R(4,y,3,1,TX if y!=14 else P3); c.R(9,y,3,1,TX if y!=14 else P3)       # 글줄(쪽 폭 가득, 짧은 점 아님)
    c.R(4,11,2,1,P3); c.R(10,13,2,1,P3)
    c.P(12,15,0xc30014); c.P(12,16,0xc30014); c.P(12,17,0xa5010a)              # 책갈피(오른쪽 끝으로 늘어짐)
    c.R(2,16,12,1,WD['w6'])                                                       # 앞 턱(책 받침) 윗면
    c.R(2,17,12,2,WD['w3']); c.R(2,17,12,1,WD['w2']); c.R(12,15,1,1,0xc30014)
    c.R(2,19,12,1,WD['w1'])
    c.R(5,20,6,7,WD['k']); c.R(6,20,1,7,WD['w6']); c.R(7,20,2,7,WD['w4']); c.R(9,20,1,7,WD['w2']); c.R(6,20,4,1,WD['w0'])
    c.R(2,26,12,6,WD['k']); c.R(3,27,10,2,WD['w5']); c.R(5,27,6,1,WD['w4']); c.R(3,28,10,1,WD['w6'])
    c.R(3,29,10,2,WD['w2']); c.R(3,30,10,1,WD['w1'])
    a=np.array(c.img())
    for p in ((2,26),(13,26),(2,31),(13,31),(1,7),(14,7)): a[p[1],p[0]]=0
    b=a.copy(); b[8:21]=a[7:20]; b[7]=0; a=b
    for x in range(4,16):
        if a[31,x,3]==0: a[31,x]=(28,20,24,110)
    return Image.fromarray(a,'RGBA')

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', '..', '..', 'tiledata', 'atlas-pick', 'style-demo-view34')
    for name, im in (('column', column()), ('chair-e', chair_e()), ('chair-w', chair_e(True)), ('pew-e', pew_e(2)),
                     ('pew-n', pew_n()), ('sarcophagus', sarcophagus()), ('lectern', lectern())):
        im.save(os.path.join(out, 'interior-new-%s.png' % name)); print('interior-new-%s.png' % name, im.size)
