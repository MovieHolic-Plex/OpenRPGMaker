import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/lab_bench/work')
from s5lib import *
LEG = {
 'W':'vwhite:5','w':'vwhite:6','S':'vwhite:3','D':'vwhite:2','d':'vwhite:1','o':'vwhite:0',
 'n':'vlinen:4','N':'vlinen:3','m':'vlinen:5','k':'vlinen:2','K':'vlinen:1',
 'g':'viron:3','G':'viron:2',
}
def line(c,x0,y0,x1,y1,ch):
    n=max(abs(x1-x0),abs(y1-y0))
    for i in range(n+1):
        c.px(round(x0+(x1-x0)*i/n), round(y0+(y1-y0)*i/n), ch)
def frame(c, sh=False):
    # 앞 기둥 x3..4 / x59..60, 가로대 y6..7
    c.rect(3,6,2,23,'W'); c.rect(59,6,2,23,'W'); c.rect(3,6,58,2,'W')
    c.vl(3,6,23,'w'); c.hl(3,6,58,'w')
    c.vl(4,7,22,'S'); c.vl(60,6,23,'D'); c.vl(61,6,23,'d') if False else None
    c.hl(4,7,56,'S'); c.pts('D',60,7)
    # 바닥 받침
    c.rect(2,29,4,1,'D'); c.rect(58,29,4,1,'D')
def net(c, ch1, ch2, dense=False):
    # 뒤판 x10..53 y10..26, 격자 3px 간격
    for x in range(10,54,3): c.vl(x,10,17,ch1)
    for y in range(10,27,3): c.hl(10,y,44,ch1)
    # 뒤 가로대
    c.hl(10,9,44,ch2)
    # 옆 그물(원근): 앞 기둥 위 → 뒤 기둥
    line(c,5,8,10,10,ch1); line(c,58,8,53,10,ch1)
    line(c,5,15,10,16,ch1); line(c,58,15,53,16,ch1)
    line(c,5,22,10,22,ch1); line(c,58,22,53,22,ch1)
    line(c,5,28,10,26,ch1); line(c,58,28,53,26,ch1)
    c.vl(10,10,17,ch2); c.vl(53,10,17,ch2)
    # 뒤 받침대
    c.rect(9,27,3,2,'g'); c.rect(52,27,3,2,'g'); c.hl(10,28,44,'G') if False else None
    c.hl(9,29,3,'G'); c.hl(52,29,3,'G')
def A():
    c=C(64,32,LEG); net(c,'N','n'); frame(c)
    c.hl(6,29,52,'~') if False else None
    return c
def B():
    c=C(64,32,LEG); net(c,'N','m'); frame(c)
    # 지면 그림자(오른쪽 아래)
    c.hl(6,30,54,'-'); c.rect(5,29,3,2,'~'); c.rect(61,29,3,3,'~'); c.hl(13,29,38,'-')
    c.vl(5,8,21,'-'); c.vl(61,8,21,'-') if False else None
    pass
    # 그물 그림자 오른쪽
    for x in range(41,54,3): c.vl(x,10,17,'K')
    for y in range(10,27,3): c.hl(41,y,13,'K')
    c.hl(3,6,58,'W'); c.pts('W',3,7,3,8)
    return c
def Cc():
    # 실루엣 재해석: 굵은 3px 기둥, 뒤로 크게 처진 그물(아래쪽이 넓어지는 삼각 그물)
    c=C(64,32,LEG)
    c.rect(4,6,3,23,'W'); c.rect(57,6,3,23,'W'); c.rect(4,6,56,3,'W')
    c.vl(4,6,23,'w'); c.hl(4,6,56,'w'); c.vl(6,7,22,'S'); c.vl(59,6,23,'D'); c.hl(7,8,50,'S')
    c.rect(2,29,6,1,'D'); c.rect(56,29,6,1,'D')
    # 뒤로 처진 그물: 위는 앞 가로대, 아래는 안쪽으로 밀림
    for x in range(8,57,3):
        line(c,x,9,x,19,'N')
    for y in range(11,27,3): 
        inset=max(0,(y-9)//3)
        c.hl(7+inset,y,50-2*inset,'N')
    line(c,7,9,12,27,'n'); line(c,56,9,51,27,'n')
    c.hl(12,27,40,'n')
    for x in range(12,52,3): c.vl(x,20,8,'N')
    c.rect(11,27,4,2,'g'); c.rect(49,27,4,2,'g'); c.hl(11,29,4,'G'); c.hl(49,29,4,'G')
    return c
for n,f,note in (('A',A,'흰 쇠 기둥·가로대 2px, 뒤로 처진 그물 1px 격자(사이 투명), 뒤 받침 두 개. 폭 4칸 전부'),
                 ('B',B,'같은 모양에 왼위 밝은 하이라이트·오른쪽 기둥 어둡게, 그물 오른쪽 그늘, 기둥 발치와 가로대 밑 접지 그림자(~ -)'),
                 ('C',Cc,'실루엣 재해석: 3px 굵은 기둥, 위에서 아래로 좁혀 들어가는 깊이 그물(사다리꼴), 앞 기둥 넓은 받침')):
    c=f(); c.emit('soccer_goal','s5-'+n,note); print(n)
