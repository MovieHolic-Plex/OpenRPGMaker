import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/lab_bench/work')
from s5lib import *
LEG = {
 'o':'mconc:0','p':'mconc:1','s':'mconc:2','m':'mconc:3','W':'mconc:4','L':'mconc:5','H':'mconc:6',
 'k':'locker:0','d':'locker:1','D':'locker:2','M':'locker:3','N':'locker:4','O':'locker:5','P':'locker:6',
 'g':'mglass:5','G':'mglass:6','f':'mglass:3','e':'mglass:2','r':'mwhite:5',
 'y':'vbrass:4','z':'vbrass:6','Y':'vbrass:2','l':'vyellow:5','q':'mmetal:2','u':'mmetal:5','b':'vblack:2','B':'vblack:3',
 'c':'mgran:2','C':'mgran:3','n':'mgran:4','v':'vblack:1','a':'vwhite:5',
}
def wall(c):
    c.rect(0,0,32,48,'m')
    # 처마 턱 y0..4
    c.rect(0,0,32,3,'W'); c.hl(0,0,32,'L'); c.hl(0,2,32,'s'); c.hl(0,3,32,'p')
    # 콘크리트 결(이음 가로줄)
    c.hl(0,24,32,'s'); c.hl(0,25,32,'W')
    c.hl(0,36,32,'s')
    c.pts('W',3,12,4,12,26,30,27,30,5,40,6,40,25,18,26,18)
    c.pts('s',20,14,21,14,8,31,9,31,28,42,29,42)
    # 걸레받이
    c.rect(0,44,32,4,'s'); c.hl(0,44,32,'W'); c.hl(0,47,32,'p')
def door(c, hi=False):
    # 문틀 x9..22, 문 x10..21 y16..44
    c.rect(9,14,14,31,'s'); c.vl(9,14,31,'m'); c.vl(22,14,31,'p'); c.hl(9,14,14,'W')
    c.rect(10,15,12,30,'M'); c.vl(10,15,30,'N'); c.vl(21,15,30,'D'); c.hl(10,15,12,'O'); c.hl(10,44,12,'d')
    # 유리창 x13..18 y18..27
    c.rect(13,18,6,9,'e'); c.rect(14,19,4,7,'g'); c.hl(13,18,6,'D'); c.vl(13,18,9,'D'); c.hl(13,26,6,'N')
    c.pts('r',14,19,14,20)
    c.vl(16,19,7,'f')
    # 판넬 홈
    c.hl(12,30,8,'D'); c.hl(12,31,8,'N'); c.hl(12,40,8,'D'); c.hl(12,41,8,'N')
    c.rect(19,33,1,4,'u'); c.pts('P',19,33); c.pts('q',19,36)
    # 문 아래 문턱
    c.rect(8,44,16,1,'p')
def lamp(c, glow=False):
    c.rect(14,8,4,4,'l'); c.hl(14,8,4,'z'); c.vl(14,8,4,'z'); c.hl(13,7,6,'q'); c.hl(13,12,6,'q') if False else None
    c.hl(14,12,4,'u'); c.px(17,11,'y') if False else None
def A():
    c=C(32,48,LEG); wall(c); door(c); lamp(c)
    c.hl(4,4,24,'~') if False else None
    return c
def B():
    c=C(32,48,LEG); wall(c)
    # 오른쪽 아래 벽 그늘
    c.rect(23,4,9,40,'p') if False else None
    for x in range(24,32): c.vl(x,4,40,'s')
    c.vl(23,4,40,'m')
    for x in range(0,3): c.vl(x,4,40,'W')
    door(c); lamp(c)
    c.hl(0,3,32,'p'); c.hl(0,4,32,'o')
    c.hl(9,4,14,'-') if False else None
    # 처마 밑 그림자 & 등 불빛 번짐
    c.rect(9,5,14,3,'-'); c.hl(11,5,10,'~')
    c.hl(11,13,10,'%'); c.hl(12,14,8,'%')
    c.rect(23,15,2,30,'~'); c.rect(10,45,14,1,'-') if False else None
    c.px(14,19,'&'); c.px(15,19,'&'); c.px(14,20,'&')
    c.rect(13,18,6,1,'D'); c.hl(12,28,10,'-')
    c.hl(0,44,32,'L'); c.hl(0,47,32,'o'); c.hl(0,46,32,'p')
    return c
def Cc():
    # 실루엣 재해석: 튀어나온 콘크리트 지붕(캐노피)이 문 위로 크게, 문 양옆 벽이 빠진 계단실 상자 형태
    c=C(32,48,LEG); wall(c)
    c.rect(0,0,32,6,'W'); c.hl(0,0,32,'H'); c.hl(0,5,32,'p'); c.hl(0,4,32,'s'); c.hl(0,6,32,'o')
    c.rect(4,6,24,3,'-'); 
    door(c); lamp(c)
    c.rect(4,10,2,34,'s'); c.rect(26,10,2,34,'s'); c.vl(4,10,34,'W'); c.vl(27,10,34,'p')
    c.rect(6,44,20,1,'W')
    # 문 위 표지판
    c.rect(11,10,10,2,'y') if False else None
    return c
for n,f,note in (('A',A,'콘크리트 벽에 쇠(locker) 문 한 짝, 작은 유리창·손잡이, 위 처마 턱과 작은 노란 등, 맨 아래는 걸레받이 줄'),
                 ('B',B,'같은 모양에 빛 구조: 왼쪽 밝은 벽·오른쪽 그늘, 처마 밑 그림자 띠, 등 아래 바닥 불빛 번짐(%), 창 반사(&), 걸레받이 밝은 윗줄'),
                 ('C',Cc,'실루엣 재해석: 두꺼운 캐노피 지붕이 문 위로 나오고 양옆 기둥 벽이 안으로 들어간 계단실 입구')):
    c=f(); c.emit('roof_stairhouse','s5-'+n,note); print(n)
