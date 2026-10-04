import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/lab_bench/work')
from s5lib import *
LEG = {
 'o':'hinoki:0','p':'hinoki:1','s':'hinoki:2','m':'hinoki:3','h':'hinoki:4','H':'hinoki:5','L':'hinoki:6',
 'k':'vdwood:0','K':'vdwood:1','j':'vdwood:2','i':'vdwood:3',
 'W':'vwhite:5','w':'vwhite:6','S':'vwhite:3','D':'vwhite:2','d':'vwhite:1',
 'g':'vgreen:4','G':'vgreen:3','F':'vgreen:2','b':'vblue:4','B':'vblue:3','r':'vred:4','R':'vred:3','y':'vyellow:4',
 'x':'vblack:3',
}
SLIP = {'g':('g','G','F'),'b':('b','B','B'),'r':('r','R','R')}
def slipper(c,x,y,col,tall=True):
    t,tm,td = SLIP[col]
    # 뒤꿈치(위) 4px, 몸통, 코 캡(아래)
    c.rect(x+1,y,3,1,'S'); c.rect(x,y+1,5,3,'W'); c.rect(x,y+4,5,2,'W')
    c.vl(x,y+1,5,'S'); c.vl(x+4,y+1,5,'D'); c.hl(x+1,y,3,'W')
    c.rect(x,y+6,5,3,t); c.rect(x+1,y+9,3,1,tm); c.hl(x,y+6,5,tm) if False else None
    c.vl(x+4,y+6,3,tm); c.hl(x+1,y+9,3,td)
    c.px(x+1,y+7,'W')
    c.hl(x+1,y+2,3,'S')
def cell(c,x,y,slip):
    # 셀 안 6x7
    c.rect(x,y,6,7,'K'); c.hl(x,y,6,'k'); c.vl(x,y,7,'k')
    if slip=='none': return
    t={'g':('g','G'),'b':('b','B'),'r':('r','R'),'y':('y','y')}
    if slip in ('g','b','r'):
        a,bb=t[slip]
        c.rect(x+1,y+3,4,2,'W'); c.hl(x+1,y+3,4,'w'); c.rect(x+1,y+5,4,2,a); c.hl(x+1,y+6,4,bb)
    elif slip=='sn':   # 운동화 앞코
        c.rect(x+1,y+4,4,3,'D'); c.hl(x+1,y+4,4,'W'); c.hl(x+1,y+6,4,'d'); c.rect(x+1,y+5,2,1,'S')
def lockerA(c, cellmap, strong=False):
    c.rect(0,1,32,29,'m')
    # 윗띠
    c.rect(0,1,32,3,'H'); c.hl(0,1,32,'L'); c.hl(0,3,32,'h'); c.hl(0,4,32,'s')
    # 세로 칸막이
    for x in (0,8,15,22,29,30,31): pass
    c.rect(0,4,32,26,'m')
    cols=[1,8,15,22]
    for r,y in enumerate((5,13,21)):
        for ci,x in enumerate(cols):
            cell(c,x,y,cellmap[r][ci])
    # 칸막이 선(경계 밝게)
    for y in (12,20,28): c.hl(0,y,32,'h')
    for y in (11,19,27): pass
    c.vl(0,4,26,'h'); c.vl(31,4,26,'s')
    # 밑 받침
    c.rect(0,29,32,2,'s'); c.hl(0,29,32,'m'); c.hl(0,30,32,'o'); c.hl(0,31,32,'~') if False else None
    return c
M1=[['g','b','sn','none'],['r','none','g','b'],['sn','g','b','r']]
def A():
    c=C(32,32,LEG); lockerA(c,M1); return c
def B():
    c=C(32,32,LEG); lockerA(c,M1)
    # 빛 구조 강화: 칸 안 오른쪽 그늘, 윗면 하이라이트, 접지 그림자
    for y in (5,13,21):
        for x in (1,8,15,22):
            c.rect(x+1,y+1,5,1,'k'); c.vl(x+5,y,7,'k') if False else None
    c.hl(0,1,32,'L'); c.hl(0,2,32,'H')
    c.rect(29,5,3,25,'p'); c.vl(28,4,26,'s')
    c.hl(0,30,32,'o'); c.hl(1,31,31,'-'); c.rect(30,29,2,2,'~')
    c.hl(0,28,32,'s')
    return c
def Cc():
    # 실루엣 재해석: 다리 달린 열린 신발 선반 — 아래가 트인 짧은 다리, 앞으로 삐져나온 실내화
    c=C(32,32,LEG)
    c.rect(0,1,32,2,'H'); c.hl(0,1,32,'L'); c.hl(0,2,32,'h')
    c.rect(0,3,32,22,'m')
    c.rect(1,4,30,20,'K')
    # 두 단 선반, 4칸
    c.rect(1,12,30,1,'m') ; c.rect(1,13,30,1,'s')
    c.rect(1,23,30,2,'h'); c.hl(1,24,30,'s')
    for x in (8,15,22): c.vl(x,4,20,'m'); c.vl(x+1,4,20,'s')
    # 실내화 (앞 튀어나옴): 윗칸
    for i,(x,col) in enumerate(((2,'g'),(9,'b'),(16,'r'),(23,'g'))):
        a,bb={'g':('g','G'),'b':('b','B'),'r':('r','R')}[col]
        c.rect(x,8,5,3,'W'); c.rect(x,10,5,2,a); c.hl(x,11,5,bb); c.hl(x,8,5,'w')
    # 아랫칸: 두 칸 비어 있고 두 칸에 운동화
    for x in (2,16):
        c.rect(x,19,5,4,'D'); c.hl(x,19,5,'W'); c.hl(x,22,5,'d'); c.px(x,21,'S')
    c.rect(0,3,1,22,'h'); c.rect(31,3,1,22,'s')
    # 다리
    c.rect(1,25,3,6,'s'); c.rect(28,25,3,6,'s'); c.vl(1,25,6,'m'); c.hl(1,30,3,'o'); c.hl(28,30,3,'o')
    c.hl(4,31,24,'-'); c.rect(4,26,24,1,'-') if False else None
    return c
for n,f,note in (('A',A,'현관 신발장 — 히노키 나무, 3단×4열 칸, 칸마다 흰 실내화(초록·파랑·빨강 코)와 운동화 앞코, 빈 칸 한 개, 윗면 띠. 좌우 이어 붙는 폭'),
                 ('B',B,'같은 모양에 윗면 밝은 띠, 칸 안쪽 윗그늘, 오른쪽 그늘 단, 접지 그림자 2줄'),
                 ('C',Cc,'실루엣 재해석: 다리 달린 열린 선반형 — 칸막이 없이 두 단, 실내화가 칸 앞으로 나와 보이고 아래가 트인다')):
    c=f(); c.emit('shoe_locker','s5-'+n,note); print(n)

# ---- slippers 16x16
def slp(kind):
    c=C(16,16,LEG)
    if kind=='A':
        slipper(c,3,3,'g'); slipper(c,9,3,'g')
        c.hl(3,13,11,'-'); c.hl(4,14,10,'-') if False else None
    elif kind=='B':
        slipper(c,3,3,'b'); slipper(c,9,3,'b')
        c.rect(4,13,11,1,'~'); c.hl(5,14,10,'-')
        c.vl(3,4,5,'w'); c.vl(9,4,5,'w')
    else:
        # 실루엣 재해석: 한 짝은 앞을 향해 눕고 한 짝은 비스듬히 뒤집힌 옆모습
        # 옆모습 실내화 (왼쪽 뒤꿈치, 오른쪽 코): 두 짝을 위·아래로 엇갈려
        for (x,y,a,bb) in ((2,3,'r','R'),(4,9,'r','R')):
            c.rect(x,y,4,3,'W'); c.hl(x,y,4,'w'); c.rect(x+4,y+1,5,2,'W'); c.rect(x+7,y,3,3,a); c.hl(x+7,y+2,3,bb); c.hl(x,y+2,7,'S'); c.hl(x+4,y+1,3,'w')
            c.hl(x,y+3,10,'d')
        c.hl(3,13,10,'-')
    return c
notes={'A':'바닥에 나란히 놓인 실내화 한 켤레 — 흰 몸통·초록 고무 코·회색 뒤꿈치 줄, 발치 그림자 1줄',
       'B':'같은 켤레(파랑 코)에 왼쪽 밝은 테·오른쪽 어두운 단, 발치 반투명 그림자 2줄',
       'C':'실루엣 재해석: 위에서 본 한 켤레가 아니라 옆모습의 빨강 코 실내화 두 짝이 엇갈려 놓임'}
for k in 'ABC':
    slp(k).emit('slippers','s5-'+k,notes[k]); print('slip',k)

# ---- genkan_step 32x16
def step(kind):
    c=C(32,16,LEG)
    # 윗면 y1..11: 널 4장 (각 2행 + 틈)
    ys=[1,4,7,10]
    for i,y in enumerate(ys):
        c.rect(0,y,32,2,'h' if i%2==0 else 'H')
        c.hl(0,y,32,'H' if i%2==0 else 'L')
        if i<3: c.hl(0,y+2,32,'j')
    # 널 끝 이음 표시(무늬 결)
    c.pts('m',5,2,6,2,20,5,21,5,12,8,13,8,26,11,27,11)
    if kind=='B': 
        for y in ys[2:]: c.hl(0,y+1,32,'m')
        c.hl(0,1,32,'L'); c.hl(0,2,32,'H')
    # 앞 턱 y12..13
    c.rect(0,12,32,2,'s'); c.hl(0,12,32,'m'); c.hl(0,13,32,'p')
    # 다리 y14..15
    c.rect(1,14,3,2,'p'); c.rect(28,14,3,2,'p'); c.hl(1,15,3,'o'); c.hl(28,15,3,'o')
    if kind=='B':
        c.hl(4,15,24,'-'); c.hl(4,14,24,'~')
        c.rect(0,10,32,2,'m') if False else None
        c.vl(31,1,12,'m') if False else None
        c.rect(28,1,4,11,'m') if False else None
    return c
def stepC():
    # 실루엣 재해석: 낮은 두 단 계단식 발판 (뒤가 한 단 높다)
    c=C(32,16,LEG)
    c.rect(0,1,32,4,'H'); c.hl(0,1,32,'L'); c.hl(0,4,32,'j'); c.hl(0,3,32,'h')
    c.rect(0,5,32,2,'s'); c.hl(0,5,32,'m')
    c.rect(0,7,32,4,'h'); c.hl(0,7,32,'H'); c.hl(0,9,32,'j'); c.hl(0,10,32,'m')
    c.rect(0,11,32,3,'s'); c.hl(0,11,32,'m'); c.hl(0,13,32,'p')
    c.pts('m',6,2,7,2,22,8,23,8)
    c.rect(1,14,3,2,'p'); c.rect(28,14,3,2,'p'); c.hl(1,15,3,'o'); c.hl(28,15,3,'o')
    return c
nn={'A':'가로 널 네 장, 틈 어두운 줄, 앞 턱 2px, 낮은 다리 — 신발장과 같은 히노키. 좌우 이어 붙는 폭',
    'B':'같은 모양에 윗면 널 밝기 대비 키우고 앞 턱 아래 접지 그림자 2줄',
    'C':'실루엣 재해석: 낮은 두 단 계단식 발판 — 뒤 단이 한 단 높고 앞 단이 낮다'}
for k in 'ABC':
    (stepC() if k=='C' else step(k)).emit('genkan_step','s5-'+k,nn[k]); print('step',k)
