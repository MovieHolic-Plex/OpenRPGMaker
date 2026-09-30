import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/lab_bench/work')
from s5lib import *
LEG = {
 'o':'cream:0','p':'cream:1','S':'cream:2','D':'cream:2','W':'cream:4','L':'cream:5','M':'cream:3',
 'k':'vblack:1','K':'vblack:2','h':'vblack:3',
 'g':'mglass:5','G':'mglass:6','f':'mglass:3','d':'mglass:2','r':'mwhite:5',
 'y':'vbrass:4','Y':'vbrass:2','z':'vbrass:6',
 'b':'vwood:4','B':'vwood:3','c':'vwood:2','a':'vred:3','e':'vgreen:4','l':'vblue:4','q':'mmetal:2','u':'mmetal:4',
 'w':'vdwood:5','x':'vdwood:3','t':'vdwood:2','n':'vdwood:6',
}
def body(c, bright=False):
    # 몸통 x2..29 y2..29
    c.rect(2,2,28,28,'W'); c.vl(2,2,28,'L'); c.vl(29,2,28,'S'); c.hl(2,1,28,'L'); c.hl(2,29,28,'o')
    c.hl(3,1,26,'L'); c.hl(2,0,28,'M') if False else None
    c.px(2,1,'M'); c.px(29,1,'S')
    # 윗판 턱
    c.hl(2,2,28,'W'); c.hl(2,3,28,'S')
    # 유리 칸 (x4..27,y5..18): 세로 가운데 문틀
    c.rect(4,5,24,14,'d'); c.rect(5,6,10,12,'g'); c.rect(17,6,10,12,'g')
    c.vl(15,5,14,'M'); c.vl(16,5,14,'M'); c.hl(4,18,24,'S'); c.hl(4,5,24,'S')
    c.vl(4,5,14,'S'); c.vl(27,5,14,'S')
    # 선반 둘
    for x0 in (5,17):
        c.hl(x0,11,10,'w'); c.hl(x0,12,10,'t')
    # 병
    c.rect(6,8,2,3,'b'); c.px(6,7,'y'); c.px(7,7,'y'); c.rect(9,8,2,3,'g'); c.px(9,7,'r'); c.rect(12,7,2,4,'e'); c.px(12,7,'z')
    c.rect(18,8,2,3,'a'); c.px(18,7,'y'); c.rect(21,7,3,4,'g'); c.px(21,7,'r'); c.rect(21,9,3,2,'l'); c.rect(25,8,1,3,'b'); c.px(25,7,'y')
    c.rect(6,14,2,3,'l'); c.rect(9,13,2,4,'g'); c.rect(12,14,2,3,'b'); c.rect(18,14,3,3,'e'); c.px(18,13,'y'); c.rect(22,13,2,4,'g'); c.rect(25,14,2,3,'a')
    c.px(6,13,'y'); c.px(7,13,'y')
    # 아래 문
    c.rect(3,20,26,8,'W'); c.vl(3,20,8,'L'); c.vl(28,20,8,'S'); c.hl(3,19,26,'M'); c.hl(3,20,26,'L'); c.vl(15,20,8,'D'); c.vl(16,20,8,'L'); c.hl(3,27,26,'S')
    c.pts('q',13,23,13,24,18,23,18,24)
    # 발
    c.rect(3,30,3,2,'S'); c.rect(26,30,3,2,'S'); c.hl(3,31,3,'o'); c.hl(26,31,3,'o')
def A():
    c=C(32,32,LEG); body(c)
    # 유리 반사 한 줄
    c.pts('r',6,7) if False else None
    c.pts('G',10,6,9,7,8,8) if False else None
    return c
def B():
    c=C(32,32,LEG); body(c)
    # 유리 반사 빗금(&)과 어두운 안쪽
    for i in range(5): c.px(7+i,7+i-0,'&') if False else None
    c.pts('&',6,6,7,6,6,7, 18,6,19,6,18,7, 12,9,13,9,12,10)
    c.rect(20,15,6,2,'&') if False else None
    c.hl(5,17,10,'f'); c.hl(17,17,10,'f')
    c.rect(3,20,2,8,'L'); c.hl(3,20,26,'L')
    c.rect(24,20,5,8,'S'); c.hl(4,26,24,'D'); c.hl(3,27,26,'D')
    c.rect(27,3,2,26,'S'); c.hl(3,28,26,'o')
    c.rect(30,5,2,25,'~'); c.hl(6,31,24,'-'); c.rect(29,30,3,1,'~')
    return c
def Cc():
    # 실루엣 재해석: 나무 진열장 — 위가 왕관형 턱(양옆 튀어나옴), 유리문 하나 크게, 아래 서랍 둘
    c=C(32,32,LEG)
    c.rect(1,1,30,3,'b'); c.hl(1,1,30,'n'); c.hl(1,3,30,'c'); c.vl(30,1,3,'B')
    c.rect(3,4,26,26,'b'); c.vl(3,4,26,'n'); c.vl(28,4,26,'B'); c.vl(29,4,26,'c')
    c.rect(5,6,22,13,'d'); c.rect(6,7,20,11,'g'); c.hl(6,12,20,'w'); c.hl(6,13,20,'t')
    c.rect(7,9,2,3,'l'); c.rect(10,8,2,4,'g'); c.px(10,8,'r'); c.rect(13,9,2,3,'a'); c.rect(17,8,3,4,'e'); c.px(17,8,'z'); c.rect(22,9,2,3,'b')
    c.rect(7,15,3,3,'g'); c.rect(11,14,2,4,'a'); c.rect(15,15,3,3,'l'); c.rect(20,14,2,4,'e'); c.rect(23,15,2,3,'g')
    c.hl(5,18,22,'c')
    c.hl(4,20,24,'c')
    c.rect(5,21,22,4,'B'); c.hl(5,21,22,'b'); c.pts('y',15,23,16,23); c.hl(5,24,22,'c')
    c.rect(5,26,22,3,'B'); c.hl(5,26,22,'b'); c.pts('y',15,27,16,27); c.hl(5,28,22,'c')
    c.rect(2,30,4,2,'c'); c.rect(26,30,4,2,'c')
    return c
for n,f,note in (('A',A,'키 큰 크림 약품장 — 위 유리문 두 짝에 갈색·투명·색 병이 두 선반, 아래 크림 서랍문 둘. 실험대와 같은 크림 몸통·놋 병뚜껑'),
                 ('B',B,'같은 모양에 & 유리 반사 빗금, 왼쪽 테 밝고 오른쪽·아래 어두운 단, 오른쪽·발치 접지 그림자'),
                 ('C',Cc,'실루엣 재해석: 나무(vwood) 진열장 — 위쪽 튀어나온 왕관 턱, 큰 통유리 문 한 짝에 병 두 줄, 아래 서랍 둘, 굵은 발')):
    c=f(); c.emit('lab_cabinet','s5-'+n,note); print(n)
